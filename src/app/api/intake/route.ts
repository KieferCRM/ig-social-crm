import { NextResponse } from "next/server";
import { Resend } from "resend";
import { normalizeConsent } from "@/lib/consent";
import {
  buildPropertyContext,
  normalizeLeadSourceChannel,
  buildTemperatureReason,
  inferDealType,
  inferLeadStage,
  inferLeadTemperature,
  inferNextAction,
  normalizeSourceChannel,
  sourceChannelLabel,
} from "@/lib/inbound";
import { getClientIp, parseJsonBody } from "@/lib/http";
import {
  buildSyntheticLeadHandle,
  findExistingLeadByIdentity,
  normalizeLeadEmail,
  normalizeLeadHandle,
  normalizeLeadPhone,
} from "@/lib/leads/identity";
import {
  getBuiltInQuestionnaireConfig,
  isCoreQuestionField,
  normalizeQuestionnaireVariant,
  readQuestionnaireFromAgentSettings,
  type QuestionnaireConfig,
} from "@/lib/questionnaire";
import { takeRateLimit } from "@/lib/rate-limit";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { notifyAgentFormSubmission } from "@/lib/receptionist/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inferLeadTags, normalizeTagList } from "@/lib/tags";

type IntakeBody = {
  agent_id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  ig_username?: string | null;
  external_id?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  property_context?: string | null;
  contact_preference?: string | null;
  notes?: string | null;
  source?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  website?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  financing_status?: string | null;
  seller_readiness?: string | null;
  agency_status?: string | null;
  property_type?: string | null;
  consent_to_email?: boolean | string | null;
  consent_to_sms?: boolean | string | null;
  consent_source?: string | null;
  consent_timestamp?: string | null;
  consent_text_snapshot?: string | null;
  form_variant?: string | null;
  questionnaire_answers?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
  link_slug?: string | null;
};

type ExistingLead = {
  id?: string | null;
  owner_user_id?: string | null;
  assignee_user_id?: string | null;
  ig_username?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  source?: string | null;
  source_ref_id?: string | null;
  source_detail?: unknown;
  canonical_email?: string | null;
  raw_email?: string | null;
  canonical_phone?: string | null;
  raw_phone?: string | null;
  first_source_method?: string | null;
  source_confidence?: string | null;
  consent_to_email?: boolean | null;
  consent_to_sms?: boolean | null;
  consent_source?: string | null;
  consent_timestamp?: string | null;
  consent_text_snapshot?: string | null;
  first_source_channel?: string | null;
  latest_source_channel?: string | null;
  custom_fields?: unknown;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function optionalAnswerString(value: unknown): string | null {
  if (typeof value === "string") return optionalString(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function customFieldString(fields: Record<string, unknown>, key: string): string | null {
  return optionalAnswerString(fields[key]);
}

function parseIntakeAgentId(): string | null {
  return optionalString(process.env.INTAKE_AGENT_ID || null);
}

async function loadAgentQuestionnaireConfig(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string,
  variant: string | null
): Promise<QuestionnaireConfig> {
  const normalizedVariant = normalizeQuestionnaireVariant(variant);
  if (normalizedVariant) {
    return getBuiltInQuestionnaireConfig(normalizedVariant);
  }
  const { data } = await admin.from("agents").select("settings").eq("id", agentId).maybeSingle();
  return readQuestionnaireFromAgentSettings(data?.settings || null);
}

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);
const ALLOWED_TEMPS = new Set(["Cold", "Warm", "Hot"]);
const INTAKE_MAX_BODY_BYTES = 64 * 1024;
const INTAKE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `intake:${ip}`,
    limit: INTAKE_RATE_LIMIT.limit,
    windowMs: INTAKE_RATE_LIMIT.windowMs,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      }
    );
  }

  const admin = supabaseAdmin();
  const parsedBody = await parseJsonBody<IntakeBody>(request, {
    maxBytes: INTAKE_MAX_BODY_BYTES,
  });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.data;

  // Resolve agent: prefer agent_id from body (form passes the agent's UUID), fall back to env
  const bodyAgentId = optionalString(body.agent_id);
  const intakeAgentId =
    bodyAgentId && isUuid(bodyAgentId) ? bodyAgentId : parseIntakeAgentId();

  if (!intakeAgentId) {
    return NextResponse.json(
      { error: "Intake destination is not configured. Set INTAKE_AGENT_ID." },
      { status: 500 }
    );
  }
  if (!isUuid(intakeAgentId)) {
    return NextResponse.json(
      { error: "Intake destination is invalid. INTAKE_AGENT_ID must be a UUID." },
      { status: 500 }
    );
  }

  if (optionalString(body.website)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const formVariant = normalizeQuestionnaireVariant(body.form_variant);
  const questionnaireConfig = await loadAgentQuestionnaireConfig(admin, intakeAgentId, formVariant);
  const questionnaireAnswers = asRecord(body.questionnaire_answers);
  const resolvedInput: IntakeBody = { ...body };
  const customQuestionnaireFields: Record<string, string> = {};

  if (!optionalString(resolvedInput.intent) && formVariant === "buyer") {
    resolvedInput.intent = "Buy";
  }
  if (!optionalString(resolvedInput.intent) && formVariant === "seller") {
    resolvedInput.intent = "Sell";
  }

  if (questionnaireAnswers) {
    for (const question of questionnaireConfig.questions) {
      const answer = optionalAnswerString(questionnaireAnswers[question.id]);
      if (!answer) continue;

      if (isCoreQuestionField(question.crm_field)) {
        const fieldKey = question.crm_field as keyof IntakeBody;
        const existingValue = optionalString(
          resolvedInput[fieldKey] as string | null | undefined
        );
        if (!existingValue) {
          (resolvedInput as Record<string, unknown>)[fieldKey] = answer;
        }
        continue;
      }

      if (question.crm_field.startsWith("custom.")) {
        const customKey = question.crm_field.slice("custom.".length).trim();
        if (customKey) {
          customQuestionnaireFields[customKey] = answer;
        }
      }
    }
  }

  const ig = normalizeLeadHandle(optionalString(resolvedInput.ig_username));
  const email = normalizeLeadEmail(optionalString(resolvedInput.email));
  const rawPhone = optionalString(resolvedInput.phone);
  const phone = normalizeLeadPhone(rawPhone);
  const externalId = (optionalString(resolvedInput.external_id) || "").toLowerCase();
  const firstName = optionalString(resolvedInput.first_name) || "";
  const lastName = optionalString(resolvedInput.last_name) || "";
  const fullName = optionalString(resolvedInput.full_name) || "";
  const displayName = fullName || `${firstName} ${lastName}`.trim();
  const identity =
    (ig ? `ig_${ig}` : "") ||
    (email ? `email_${email}` : "") ||
    (phone ? `phone_${phone}` : "") ||
    (externalId ? `ext_${externalId}` : "") ||
    (displayName ? `name_${displayName.toLowerCase()}` : "");

  if (!identity) {
    return NextResponse.json(
      { error: "Please provide at least one identity field (name, email, phone, or IG)." },
      { status: 400 }
    );
  }

  const existingLead = (await findExistingLeadByIdentity({
    admin,
    agentId: intakeAgentId,
    source: optionalString(resolvedInput.source),
    sourceRefId: externalId || null,
    canonicalEmail: email,
    phoneInput: rawPhone || phone,
    igUsername: ig,
  })) as ExistingLead | null;

  const qualification = inferLeadTemperature({
    intent: optionalString(resolvedInput.intent),
    timeline: optionalString(resolvedInput.timeline),
    budgetRange: optionalString(resolvedInput.budget_range),
    locationArea: optionalString(resolvedInput.location_area),
    propertyContext: optionalString(resolvedInput.property_context),
    phone,
    email,
    contactPreference: optionalString(resolvedInput.contact_preference),
    notes: optionalString(resolvedInput.notes),
    financingStatus: optionalString(resolvedInput.financing_status),
    sellerReadiness: optionalString(resolvedInput.seller_readiness),
    agencyStatus: optionalString(resolvedInput.agency_status),
  });

  const requestedStage = optionalString(resolvedInput.stage);
  if (requestedStage && !ALLOWED_STAGES.has(requestedStage)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  const requestedLeadTemp = optionalString(resolvedInput.lead_temp);
  if (requestedLeadTemp && !ALLOWED_TEMPS.has(requestedLeadTemp)) {
    return NextResponse.json({ error: "Invalid lead temperature." }, { status: 400 });
  }

  const requestedSource = optionalString(resolvedInput.source);
  const formDerivedSource =
    formVariant === "off_market_seller" || formVariant === "seller" ? "seller_form" :
    formVariant === "off_market_buyer" || formVariant === "buyer" ? "buyer_form" :
    null;
  const source = formDerivedSource || requestedSource || existingLead?.source || "website_form";
  const sourceChannel = normalizeSourceChannel(source) || "other";
  const stage = requestedStage || existingLead?.stage || inferLeadStage(qualification.temperature);
  const leadTemp = requestedLeadTemp || existingLead?.lead_temp || qualification.temperature;
  const nextAction = inferNextAction(
    {
      intent: optionalString(resolvedInput.intent),
      timeline: optionalString(resolvedInput.timeline),
      budgetRange: optionalString(resolvedInput.budget_range),
      locationArea: optionalString(resolvedInput.location_area),
      propertyContext: optionalString(resolvedInput.property_context),
      phone,
      email,
      contactPreference: optionalString(resolvedInput.contact_preference),
      notes: optionalString(resolvedInput.notes),
      financingStatus: optionalString(resolvedInput.financing_status),
      sellerReadiness: optionalString(resolvedInput.seller_readiness),
      agencyStatus: optionalString(resolvedInput.agency_status),
    },
    qualification
  );

  const existingSourceDetail = asRecord(existingLead?.source_detail) || {};
  const callerCustomFields = asRecord(body.custom_fields) || {};
  const preapprovalStatus = optionalString(
    callerCustomFields["preapproval_status"] as string | null | undefined
  );
  const buyerFormStep = customFieldString(callerCustomFields, "form_step");
  const isBuyerForm = formVariant === "buyer" || formVariant === "off_market_buyer";
  const buyerProfile: Record<string, unknown> = {};
  const buyerProfileSummaryParts: string[] = [];
  if (isBuyerForm) {
    const coBuyerInvolved = customFieldString(callerCustomFields, "co_buyer_involved");
    const coBuyerName = customFieldString(callerCustomFields, "co_buyer_name");
    const lenderName = customFieldString(callerCustomFields, "lender_name");
    const preapprovalAmount = customFieldString(callerCustomFields, "preapproval_amount");
    const budgetMin = customFieldString(callerCustomFields, "budget_min");
    const budgetMax = customFieldString(callerCustomFields, "budget_max");
    const hasPropertyToSell = customFieldString(callerCustomFields, "has_property_to_sell");
    const propertyTypeRequested =
      customFieldString(callerCustomFields, "property_type_requested") ||
      optionalString(resolvedInput.property_type);
    const bedrooms = customFieldString(callerCustomFields, "bedrooms");
    const bathrooms = customFieldString(callerCustomFields, "bathrooms");
    const minimumSquareFootage = customFieldString(callerCustomFields, "minimum_square_footage");
    const preferredAreas =
      customFieldString(callerCustomFields, "preferred_areas") ||
      optionalString(resolvedInput.location_area);
    const mustHaves = customFieldString(callerCustomFields, "must_haves");
    const firstTimeBuyer = customFieldString(callerCustomFields, "first_time_buyer");
    const buyingReason = customFieldString(callerCustomFields, "buying_reason");
    const agencyStatusChoice =
      customFieldString(callerCustomFields, "agency_status_choice") ||
      optionalString(resolvedInput.agency_status);
    const purchasedBefore = customFieldString(callerCustomFields, "purchased_before");
    const otherFinancing = customFieldString(callerCustomFields, "other_financing");

    if (coBuyerInvolved) {
      buyerProfile.co_buyer_involved = coBuyerInvolved;
      buyerProfileSummaryParts.push(
        coBuyerInvolved === "Yes"
          ? `Co-buyer: yes${coBuyerName ? ` (${coBuyerName})` : ""}`
          : "Co-buyer: no"
      );
    }
    if (coBuyerName) buyerProfile.co_buyer_name = coBuyerName;
    if (optionalString(resolvedInput.financing_status)) {
      buyerProfile.financing_status = optionalString(resolvedInput.financing_status);
      buyerProfileSummaryParts.push(`Financing: ${optionalString(resolvedInput.financing_status)}`);
    }
    if (preapprovalStatus) {
      buyerProfile.preapproval_status = preapprovalStatus;
      buyerProfileSummaryParts.push(`Pre-approved: ${preapprovalStatus}`);
    }
    if (lenderName) {
      buyerProfile.lender_name = lenderName;
      buyerProfileSummaryParts.push(`Lender: ${lenderName}`);
    }
    if (preapprovalAmount) {
      buyerProfile.preapproval_amount = preapprovalAmount;
      buyerProfileSummaryParts.push(`Pre-approval amount: ${preapprovalAmount}`);
    }
    if (budgetMin) buyerProfile.budget_min = budgetMin;
    if (budgetMax) buyerProfile.budget_max = budgetMax;
    if (budgetMin || budgetMax) {
      const budgetSummary = [budgetMin, budgetMax].filter(Boolean).join(" - ");
      buyerProfile.budget_range = budgetSummary;
      buyerProfileSummaryParts.push(`Budget: ${budgetSummary}`);
    }
    if (hasPropertyToSell) {
      buyerProfile.has_property_to_sell = hasPropertyToSell;
      buyerProfileSummaryParts.push(`Need to sell first: ${hasPropertyToSell}`);
    }
    if (propertyTypeRequested) {
      buyerProfile.property_type_requested = propertyTypeRequested;
      buyerProfileSummaryParts.push(`Property type: ${propertyTypeRequested}`);
    }
    if (bedrooms) {
      buyerProfile.bedrooms = bedrooms;
      buyerProfileSummaryParts.push(`Beds: ${bedrooms}`);
    }
    if (bathrooms) {
      buyerProfile.bathrooms = bathrooms;
      buyerProfileSummaryParts.push(`Baths: ${bathrooms}`);
    }
    if (minimumSquareFootage) {
      buyerProfile.minimum_square_footage = minimumSquareFootage;
      buyerProfileSummaryParts.push(`Min sq ft: ${minimumSquareFootage}`);
    }
    if (preferredAreas) {
      buyerProfile.preferred_areas = preferredAreas;
      buyerProfileSummaryParts.push(`Areas: ${preferredAreas}`);
    }
    if (mustHaves) {
      buyerProfile.must_haves = mustHaves;
      buyerProfileSummaryParts.push(`Must-haves: ${mustHaves}`);
    }
    if (firstTimeBuyer) {
      buyerProfile.first_time_buyer = firstTimeBuyer;
      buyerProfileSummaryParts.push(`First-time buyer: ${firstTimeBuyer}`);
    }
    if (buyingReason) {
      buyerProfile.buying_reason = buyingReason;
      buyerProfileSummaryParts.push(`Reason: ${buyingReason}`);
    }
    if (agencyStatusChoice) {
      buyerProfile.agency_status_choice = agencyStatusChoice;
      buyerProfileSummaryParts.push(`Representation: ${agencyStatusChoice}`);
    }
    if (purchasedBefore) {
      buyerProfile.purchased_before = purchasedBefore;
      buyerProfileSummaryParts.push(`Purchased before: ${purchasedBefore}`);
    }
    if (otherFinancing) buyerProfile.other_financing = otherFinancing;
  }
  const buyerProfileSummary =
    buyerProfileSummaryParts.length > 0 ? buyerProfileSummaryParts.join(" · ") : null;
  const inferredTags = inferLeadTags({
    intent: optionalString(resolvedInput.intent),
    source,
    leadTemp,
    timeline: optionalString(resolvedInput.timeline),
    financingStatus: optionalString(resolvedInput.financing_status),
    preapprovalStatus,
    propertyType:
      optionalString(resolvedInput.property_type) ||
      customFieldString(callerCustomFields, "property_type_requested"),
    firstTimeBuyer: customFieldString(callerCustomFields, "first_time_buyer"),
    buyingReason: customFieldString(callerCustomFields, "buying_reason"),
    hasPropertyToSell: customFieldString(callerCustomFields, "has_property_to_sell"),
    agencyStatus: optionalString(resolvedInput.agency_status),
  });
  const combinedTags = normalizeTagList([
    ...normalizeTagList(existingSourceDetail.tags),
    ...inferredTags,
    ...(formVariant ? [`${formVariant} form`] : []),
  ]);

  const sourceDetailPatch: Record<string, unknown> = {
    intake_identity: identity,
    source_channel: sourceChannel,
    source_channel_label: sourceChannelLabel(sourceChannel),
    qualification_score: qualification.score,
    qualification_reason: buildTemperatureReason(qualification),
    tags: combinedTags,
  };
  if (firstName) sourceDetailPatch.first_name = firstName;
  if (lastName) sourceDetailPatch.last_name = lastName;
  if (fullName) sourceDetailPatch.full_name = fullName;
  if (email) sourceDetailPatch.email = email;
  if (phone) sourceDetailPatch.phone = phone;
  if (optionalString(resolvedInput.intent)) sourceDetailPatch.intent = optionalString(resolvedInput.intent);
  if (optionalString(resolvedInput.timeline)) sourceDetailPatch.timeline = optionalString(resolvedInput.timeline);
  if (optionalString(resolvedInput.budget_range)) sourceDetailPatch.budget_range = optionalString(resolvedInput.budget_range);
  if (optionalString(resolvedInput.location_area)) sourceDetailPatch.location_area = optionalString(resolvedInput.location_area);
  if (optionalString(resolvedInput.property_context)) sourceDetailPatch.property_context = optionalString(resolvedInput.property_context);
  if (optionalString(resolvedInput.financing_status)) sourceDetailPatch.financing_status = optionalString(resolvedInput.financing_status);
  if (preapprovalStatus) sourceDetailPatch.preapproval_status = preapprovalStatus;
  if (optionalString(resolvedInput.seller_readiness)) sourceDetailPatch.seller_readiness = optionalString(resolvedInput.seller_readiness);
  if (optionalString(resolvedInput.agency_status)) sourceDetailPatch.agency_status = optionalString(resolvedInput.agency_status);
  if (optionalString(resolvedInput.property_type)) sourceDetailPatch.property_type = optionalString(resolvedInput.property_type);
  if (buyerProfileSummary) sourceDetailPatch.buyer_profile_summary = buyerProfileSummary;
  if (Object.keys(buyerProfile).length > 0) sourceDetailPatch.buyer_profile = buyerProfile;
  if (optionalString(resolvedInput.utm_source)) sourceDetailPatch.utm_source = optionalString(resolvedInput.utm_source);
  if (optionalString(resolvedInput.utm_medium)) sourceDetailPatch.utm_medium = optionalString(resolvedInput.utm_medium);
  if (optionalString(resolvedInput.utm_campaign)) sourceDetailPatch.utm_campaign = optionalString(resolvedInput.utm_campaign);
  if (externalId) sourceDetailPatch.external_id = externalId;
  if (formVariant) sourceDetailPatch.form_variant = formVariant;
  const sourceDetail: Record<string, unknown> = {
    ...existingSourceDetail,
    ...sourceDetailPatch,
  };
  const resolvedIg =
    ig || existingLead?.ig_username || buildSyntheticLeadHandle("intake_lead", identity);

  const nowIso = new Date().toISOString();
  const consent = normalizeConsent({
    source,
    consent_to_email: resolvedInput.consent_to_email,
    consent_to_sms: resolvedInput.consent_to_sms,
    consent_source: resolvedInput.consent_source,
    consent_timestamp: resolvedInput.consent_timestamp,
    consent_text_snapshot: resolvedInput.consent_text_snapshot,
    nowIso,
  });

  const payload: Record<string, unknown> = {
    agent_id: intakeAgentId,
    owner_user_id: existingLead?.owner_user_id || intakeAgentId,
    assignee_user_id: existingLead?.assignee_user_id || intakeAgentId,
    ig_username: resolvedIg,
    stage,
    lead_temp: leadTemp,
    source,
    time_last_updated: nowIso,
    latest_source_method: "api",
    first_source_method: existingLead?.first_source_method || "api",
    source_confidence:
      existingLead?.source_confidence || (ig || email || phone ? "exact" : "unknown"),
    source_detail: sourceDetail,
    consent_to_email: Boolean(existingLead?.consent_to_email || consent.consent_to_email),
    consent_to_sms: Boolean(existingLead?.consent_to_sms || consent.consent_to_sms),
    consent_source: existingLead?.consent_source || consent.consent_source || source,
    consent_timestamp: existingLead?.consent_timestamp || consent.consent_timestamp,
    consent_text_snapshot:
      existingLead?.consent_text_snapshot || consent.consent_text_snapshot || null,
    first_source_channel:
      normalizeLeadSourceChannel(existingLead?.first_source_channel) ||
      normalizeLeadSourceChannel(sourceChannel) ||
      "other",
    latest_source_channel: normalizeLeadSourceChannel(sourceChannel) || "other",
  };

  if (email) {
    payload.raw_email = email;
    payload.canonical_email = email;
  } else if (existingLead?.canonical_email) {
    payload.raw_email = existingLead.raw_email || existingLead.canonical_email;
    payload.canonical_email = existingLead.canonical_email;
  }

  if (phone) {
    payload.raw_phone = rawPhone || phone;
    payload.canonical_phone = phone;
  } else if (existingLead?.canonical_phone) {
    payload.raw_phone = existingLead.raw_phone || existingLead.canonical_phone;
    payload.canonical_phone = existingLead.canonical_phone;
  }

  if (firstName) payload.first_name = firstName;
  if (lastName) payload.last_name = lastName;
  if (fullName || displayName) payload.full_name = fullName || displayName;
  if (externalId) payload.source_ref_id = externalId;
  else if (existingLead?.source_ref_id) payload.source_ref_id = existingLead.source_ref_id;

  const intent = optionalString(resolvedInput.intent);
  const timeline = optionalString(resolvedInput.timeline);
  const notes = optionalString(resolvedInput.notes);
  const resolvedNotes = notes || buyerProfileSummary;
  const budgetRange = optionalString(resolvedInput.budget_range);
  const locationArea = optionalString(resolvedInput.location_area);
  const contactPreference = optionalString(resolvedInput.contact_preference);
  if (intent) payload.intent = intent;
  if (timeline) payload.timeline = timeline;
  if (resolvedNotes) payload.notes = resolvedNotes;
  if (budgetRange) payload.budget_range = budgetRange;
  if (locationArea) payload.location_area = locationArea;
  if (contactPreference) payload.contact_preference = contactPreference;

  const existingCustomFields = asRecord(existingLead?.custom_fields) || {};
  const derivedCustomFields: Record<string, unknown> = {
    qualification_score: qualification.score,
    next_action_title: nextAction.title,
    next_action_description: nextAction.description,
    property_context: optionalString(resolvedInput.property_context),
    financing_status: optionalString(resolvedInput.financing_status),
    seller_readiness: optionalString(resolvedInput.seller_readiness),
    agency_status: optionalString(resolvedInput.agency_status),
    property_type: optionalString(resolvedInput.property_type),
    buyer_profile_summary: buyerProfileSummary,
    buyer_profile: Object.keys(buyerProfile).length > 0 ? buyerProfile : null,
    form_variant: formVariant,
    tags: combinedTags,
  };

  payload.custom_fields = {
    ...existingCustomFields,
    ...derivedCustomFields,
    ...customQuestionnaireFields,
    ...callerCustomFields,
  };

  const { data: upsertedLead, error: upsertError } = await admin
    .from("leads")
    .upsert(payload, { onConflict: "agent_id,ig_username" })
    .select("id")
    .single();

  if (upsertError || !upsertedLead?.id) {
    return NextResponse.json(
      { error: upsertError?.message || "Could not ingest lead." },
      { status: 500 }
    );
  }

  const leadId = String(upsertedLead.id);
  const occurredAt = new Date().toISOString();
  const intakeEventRows: Array<Record<string, unknown>> = [];
  if (!existingLead?.id) {
    intakeEventRows.push({
      lead_id: leadId,
      agent_id: intakeAgentId,
      event_type: "created",
      event_data: {
        source,
        source_ref_id: externalId || null,
        method: "intake_form",
        form_variant: formVariant,
      },
      actor_id: null,
      created_at: occurredAt,
    });
  }
  intakeEventRows.push({
    lead_id: leadId,
    agent_id: intakeAgentId,
    event_type: "ingested",
    event_data: {
      source,
      source_ref_id: externalId || null,
      method: "intake_form",
      source_channel: sourceChannel,
      temperature: leadTemp,
      next_action: nextAction.title,
      form_variant: formVariant,
    },
    actor_id: null,
    created_at: occurredAt,
  });
  const { error: eventInsertError } = await admin.from("lead_events").insert(intakeEventRows);
  if (eventInsertError) {
    console.warn("[intake] lead_events insert failed", { error: eventInsertError.message });
  }

  let reminderCreated = false;
  const { data: existingReminder } = await withReminderOwnerColumn((ownerColumn) =>
    admin
      .from("follow_up_reminders")
      .select("id")
      .eq(ownerColumn, intakeAgentId)
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()
  );

  if (!existingReminder) {
    const { error: reminderError } = await withReminderOwnerColumn((ownerColumn) =>
      admin.from("follow_up_reminders").insert({
        [ownerColumn]: intakeAgentId,
        lead_id: leadId,
        conversation_id: null,
        due_at: nextAction.dueAt,
        status: "pending",
        note: nextAction.title,
        preset: "1d",
      })
    );
    reminderCreated = !reminderError;
  }

  let dealCreated = false;
  let dealId: string | null = null;
  const { data: existingDeal } = await admin
    .from("deals")
    .select("id,stage,notes")
    .eq("agent_id", intakeAgentId)
    .eq("lead_id", leadId)
    .neq("stage", "closed")
    .neq("stage", "lost")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDeal?.id) {
    dealId = String(existingDeal.id);
    if (isBuyerForm && buyerFormStep === "2" && resolvedNotes) {
      const { error: dealUpdateError } = await admin
        .from("deals")
        .update({
          property_address: buildPropertyContext({
            intent,
            locationArea,
            propertyContext: optionalString(resolvedInput.property_context),
          }),
          notes: resolvedNotes,
        })
        .eq("id", existingDeal.id);

      if (dealUpdateError) {
        console.warn("[intake] buyer deal update failed", { error: dealUpdateError.message });
      }
    }
  } else {
    const isOffMarketForm = formVariant === "off_market_seller" || formVariant === "off_market_buyer";
    // Auto-set follow-up date to tomorrow for off-market form submissions
    const autoFollowupDate = isOffMarketForm
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : null;
    // Capture asking_price from custom_fields if seller form
    const askingPriceRaw = optionalString(
      (asRecord(body.custom_fields) || {})["asking_price"] as string | null | undefined
    );
    const askingPriceNum = askingPriceRaw
      ? parseFloat(askingPriceRaw.replace(/[^0-9.]/g, ""))
      : null;
    const dealPrice = askingPriceNum && !Number.isNaN(askingPriceNum) ? askingPriceNum : null;

    const { data: insertedDeal, error: dealError } = await admin
      .from("deals")
      .insert({
        agent_id: intakeAgentId,
        lead_id: leadId,
        property_address: buildPropertyContext({
          intent,
          locationArea,
          propertyContext: optionalString(resolvedInput.property_context),
        }),
        deal_type: inferDealType(intent),
        price: dealPrice,
        stage: isOffMarketForm ? "prospecting" : "new",
        stage_entered_at: isOffMarketForm ? new Date().toISOString() : null,
        next_followup_date: autoFollowupDate,
        expected_close_date: null,
        notes:
          resolvedNotes ||
          `${sourceChannelLabel(sourceChannel)} inquiry. ${buildTemperatureReason(qualification)}`,
      })
      .select("id")
      .single();

    if (!dealError && insertedDeal?.id) {
      dealCreated = true;
      dealId = String(insertedDeal.id);
    } else if (dealError) {
      console.warn("[intake] deal insert failed", { error: dealError.message });
    }
  }

  // Notify agent of form submission (in-app alert + SMS)
  if (formDerivedSource) {
    const formLabel =
      formDerivedSource === "seller_form" ? "Seller Form" :
      formDerivedSource === "buyer_form" ? "Buyer Form" : "Form";
    const leadName = optionalString(
      resolvedInput.full_name ||
      (resolvedInput.first_name && resolvedInput.last_name
        ? `${resolvedInput.first_name} ${resolvedInput.last_name}`
        : resolvedInput.first_name || null)
    );

    // Build rich details for seller form notifications
    let details: string | null = null;
    if (formDerivedSource === "seller_form") {
      const callerFields = asRecord(body.custom_fields) || {};
      const detailParts: string[] = [];
      const propertyAddr = optionalString(resolvedInput.property_context);
      const sellerTimeline = optionalString(resolvedInput.timeline);
      const askingPrice = optionalString(callerFields["asking_price"] as string | null | undefined);
      if (propertyAddr) detailParts.push(`Address: ${propertyAddr}`);
      if (sellerTimeline) detailParts.push(`Timeline: ${sellerTimeline}`);
      if (askingPrice) detailParts.push(`Asking: ${askingPrice}`);
      detailParts.push(`Temp: ${leadTemp}`);
      details = detailParts.join(" · ");
    } else if (formDerivedSource === "buyer_form" && buyerProfileSummary) {
      details = [`Temp: ${leadTemp}`, buyerProfileSummary].join(" · ");
    }

    void notifyAgentFormSubmission(admin, intakeAgentId, {
      leadName,
      phone: phone || null,
      formLabel,
      details,
    }).catch((err: unknown) => {
      console.warn("[intake] form notification failed", err);
    });

    // Confirmation email to seller/buyer (if they provided an email)
    if (email) {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const confirmationName = leadName ? `, ${leadName.split(" ")[0]}` : "";
        void resend.emails.send({
          from: "LockboxHQ <onboarding@resend.dev>",
          to: email,
          subject: "We received your inquiry",
          text: `Hi${confirmationName},\n\nThanks for reaching out! We received your information and the agent will follow up with you soon.\n\nIf you have any questions in the meantime, feel free to reply to this email.\n\n— LockboxHQ`,
        }).catch((err: unknown) => {
          console.warn("[intake] seller confirmation email failed", err);
        });
      }
    }
  }

  let recommendationCreated = false;
  const { data: existingRecommendation } = await admin
    .from("lead_recommendations")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (!existingRecommendation) {
    const { error: recommendationError } = await admin.from("lead_recommendations").insert({
      agent_id: intakeAgentId,
      owner_user_id: intakeAgentId,
      lead_id: leadId,
      person_id: null,
      source_event_id: null,
      reason_code: leadTemp === "Hot" ? "hot_inbound" : "inbound_next_action",
      title: nextAction.title,
      description: nextAction.description,
      priority: nextAction.priority,
      due_at: nextAction.dueAt,
      metadata: {
        source_channel: sourceChannel,
        source_label: sourceChannelLabel(sourceChannel),
        temperature: leadTemp,
        qualification_score: qualification.score,
        deal_id: dealId,
        tags: combinedTags,
      },
    });
    recommendationCreated = !recommendationError;
  }

  // Increment submission_count on the intake_link if this came from one
  const linkSlug = optionalString(body.link_slug);
  if (linkSlug) {
    void admin.rpc("increment_intake_link_count", { p_slug: linkSlug }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    status: existingLead?.id ? "updated" : "inserted",
    lead_id: leadId,
    reminder_created: reminderCreated,
    deal_created: dealCreated,
    recommendation_created: recommendationCreated,
    temperature: leadTemp,
    next_action: nextAction.title,
  });
}
