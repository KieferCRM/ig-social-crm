import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeConsent } from "@/lib/consent";
import {
  buildSyntheticLeadHandle,
  findExistingLeadByIdentity,
  normalizeLeadEmail,
  normalizeLeadHandle,
  normalizeLeadPhone,
} from "@/lib/leads/identity";

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("leads")
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,intent,timeline,last_message_preview,next_step,deal_price,commission_percent,commission_amount,close_date")
    .or(ownerFilter(auth.context))
    .order("ig_username", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data || [] });
}

type CreateLeadBody = {
  ig_username?: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  tags?: string | null;
  external_id?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  source?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  notes?: string | null;
  consent_to_email?: boolean | string | null;
  consent_to_sms?: boolean | string | null;
  consent_source?: string | null;
  consent_timestamp?: string | null;
  consent_text_snapshot?: string | null;
};

type UpdateLeadBody = {
  id?: string;
  stage?: string | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);
const ALLOWED_TEMPS = new Set(["Cold", "Warm", "Hot"]);

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = supabaseAdmin();

  const body = (await request.json()) as CreateLeadBody;
  const rawHandle = optionalString(body.ig_username) || "";
  const ig = normalizeLeadHandle(rawHandle);
  const email = normalizeLeadEmail(optionalString(body.email));
  const rawPhone = optionalString(body.phone);
  const phone = normalizeLeadPhone(rawPhone);
  const externalId = (optionalString(body.external_id) || "").toLowerCase();
  const firstName = optionalString(body.first_name) || "";
  const lastName = optionalString(body.last_name) || "";
  const fullName = optionalString(body.full_name) || "";
  const tags = optionalString(body.tags) || "";
  const displayName = fullName || `${firstName} ${lastName}`.trim();
  const identity =
    (ig ? `ig_${ig}` : "") ||
    (email ? `email_${email}` : "") ||
    (phone ? `phone_${phone}` : "") ||
    (externalId ? `ext_${externalId}` : "") ||
    (displayName ? `name_${displayName.toLowerCase()}` : "");
  const source = optionalString(body.source) || "manual";

  if (!identity) {
    return NextResponse.json(
      { error: "Provide one identity value: ig_username, email, phone, external_id, or full_name." },
      { status: 400 }
    );
  }

  const existingLead = await findExistingLeadByIdentity({
    admin,
    agentId: auth.context.user.id,
    source,
    sourceRefId: externalId || null,
    canonicalEmail: email,
    phoneInput: rawPhone || phone,
    igUsername: ig,
  });

  const stageInput = optionalString(body.stage);
  if (stageInput && !ALLOWED_STAGES.has(stageInput)) {
    return NextResponse.json({ error: "stage is invalid." }, { status: 400 });
  }

  const leadTempInput = optionalString(body.lead_temp);
  if (leadTempInput && !ALLOWED_TEMPS.has(leadTempInput)) {
    return NextResponse.json({ error: "lead_temp is invalid." }, { status: 400 });
  }

  const resolvedIg =
    ig ||
    existingLead?.ig_username ||
    buildSyntheticLeadHandle(identity ? "manual_lead" : "manual", identity || "manual_lead");

  const sourceDetailPatch: Record<string, string> = {};
  if (firstName) sourceDetailPatch.first_name = firstName;
  if (lastName) sourceDetailPatch.last_name = lastName;
  if (fullName) sourceDetailPatch.full_name = fullName;
  if (email) sourceDetailPatch.email = email;
  if (phone) sourceDetailPatch.phone = phone;
  if (tags) sourceDetailPatch.tags = tags;
  if (externalId) sourceDetailPatch.external_id = externalId;
  sourceDetailPatch.manual_identity = identity;
  const existingSourceDetail =
    existingLead?.source_detail &&
    typeof existingLead.source_detail === "object" &&
    !Array.isArray(existingLead.source_detail)
      ? existingLead.source_detail
      : {};
  const sourceDetail = { ...existingSourceDetail, ...sourceDetailPatch };

  const nowIso = new Date().toISOString();
  const consent = normalizeConsent({
    source,
    consent_to_email: body.consent_to_email,
    consent_to_sms: body.consent_to_sms,
    consent_source: body.consent_source,
    consent_timestamp: body.consent_timestamp,
    consent_text_snapshot: body.consent_text_snapshot,
    nowIso,
  });

  const payload: Record<string, unknown> = {
    agent_id: auth.context.user.id,
    owner_user_id: existingLead?.owner_user_id || auth.context.user.id,
    assignee_user_id: existingLead?.assignee_user_id || auth.context.user.id,
    ig_username: resolvedIg,
    stage: stageInput || existingLead?.stage || "New",
    lead_temp: leadTempInput || existingLead?.lead_temp || "Warm",
    source,
    time_last_updated: nowIso,
    latest_source_method: "manual",
    first_source_method: existingLead?.first_source_method || "manual",
    source_confidence: existingLead?.source_confidence || (ig || email || phone ? "exact" : "unknown"),
    source_detail: sourceDetail,
    consent_to_email: Boolean(existingLead?.consent_to_email || consent.consent_to_email),
    consent_to_sms: Boolean(existingLead?.consent_to_sms || consent.consent_to_sms),
    consent_source: existingLead?.consent_source || consent.consent_source,
    consent_timestamp: existingLead?.consent_timestamp || consent.consent_timestamp,
    consent_text_snapshot: existingLead?.consent_text_snapshot || consent.consent_text_snapshot,
    custom_fields: existingLead?.custom_fields || {},
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

  const intent = optionalString(body.intent);
  const timeline = optionalString(body.timeline);
  const budgetRange = optionalString(body.budget_range);
  const notes = optionalString(body.notes);

  if (intent) payload.intent = intent;
  if (timeline) payload.timeline = timeline;
  if (budgetRange) payload.budget_range = budgetRange;
  if (notes) payload.notes = notes;

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "agent_id,ig_username" })
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,time_last_updated,deal_price,commission_percent,commission_amount,close_date")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/app");
  revalidatePath("/app/list");
  revalidatePath("/app/kanban");
  revalidatePath(`/app/leads/${data.id}`);

  return NextResponse.json({ lead: data });
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as UpdateLeadBody;
  const id = optionalString(body.id) || "";
  const stage = optionalString(body.stage) || "";

  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (!stage || !ALLOWED_STAGES.has(stage)) {
    return NextResponse.json({ error: "stage is invalid." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      stage,
      time_last_updated: new Date().toISOString(),
    })
    .eq("id", id)
    .or(ownerFilter(auth.context))
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,time_last_updated,deal_price,commission_percent,commission_amount,close_date")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "lead not found." }, { status: 404 });

  revalidatePath("/app");
  revalidatePath("/app/list");
  revalidatePath("/app/kanban");
  revalidatePath(`/app/leads/${id}`);

  return NextResponse.json({ lead: data });
}
