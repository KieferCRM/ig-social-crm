import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { interpretLeadReply } from "@/lib/receptionist/pa-interpreter";
import {
  buildMissedCallStarterText,
  readReceptionistSettingsFromAgentSettings,
  shouldSendMissedCallTextback,
  type ReceptionistSettings,
} from "@/lib/receptionist/settings";
import {
  extractStructuredFieldsFromSms,
  nextMissingReceptionistQuestion,
  normalizePhoneToE164,
  upsertReceptionistLead,
  type ReceptionistLeadRow,
} from "@/lib/receptionist/lead-upsert";
import { detectUrgency } from "@/lib/receptionist/urgency";
import {
  sendReceptionistSms,
  startReceptionistBridgeCall,
  type CallBridgeResult,
  type SmsSendResult,
} from "@/lib/receptionist/provider";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export type LeadInteractionRow = {
  id: string;
  agent_id: string;
  lead_id: string;
  channel: "sms" | "missed_call_textback" | "call_outbound" | "call_inbound" | "system" | "voice";
  direction: "in" | "out" | "system";
  interaction_type: string;
  status: "queued" | "sent" | "delivered" | "received" | "missed" | "completed" | "failed" | "logged";
  raw_transcript: string | null;
  raw_message_body: string | null;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  provider_message_id: string | null;
  provider_call_id: string | null;
  created_at: string;
};

export type ReceptionistAlertRow = {
  id: string;
  agent_id: string;
  lead_id: string | null;
  alert_type: string;
  severity: "info" | "high" | "urgent";
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AgentReceptionistContext = {
  agentId: string;
  agentName: string;
  settings: ReceptionistSettings;
  isOffMarketAccount: boolean;
};

export type LeadCommunicationThread = {
  lead: Pick<
    ReceptionistLeadRow,
    | "id"
    | "full_name"
    | "canonical_phone"
    | "canonical_email"
    | "stage"
    | "lead_temp"
    | "urgency_level"
    | "urgency_score"
    | "source"
  >;
  interactions: LeadInteractionRow[];
  alerts: ReceptionistAlertRow[];
};

export type InboundSmsWorkflowResult = {
  leadId: string;
  createdLead: boolean;
  urgent: boolean;
  askedQuestion: string | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compactText(value: string | null | undefined, max = 220): string | null {
  const text = optionalString(value);
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function stopsAutomation(messageBody: string): boolean {
  return /\b(stop|unsubscribe|do\s*not\s*text|don't\s*text|dont\s*text|opt\s*out)\b/i.test(
    messageBody
  );
}

export async function loadAgentReceptionistContext(
  admin: AdminClient,
  agentId: string
): Promise<AgentReceptionistContext> {
  const { data, error } = await admin
    .from("agents")
    .select("full_name,settings")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const settings = readReceptionistSettingsFromAgentSettings(data?.settings || null);
  const onboarding = readOnboardingStateFromAgentSettings(data?.settings || null);

  return {
    agentId,
    agentName: optionalString(data?.full_name || null) || "your agent",
    settings,
    isOffMarketAccount: onboarding.account_type === "off_market_agent",
  };
}

/**
 * For off-market agents: creates or updates the pipeline deal linked to a receptionist lead.
 * If an active deal already exists for the lead, it's touched (updated_at) but not overwritten.
 * Runs fire-and-forget; errors are logged but do not fail the parent workflow.
 */
async function upsertOffMarketDealForReceptionistLead(
  admin: AdminClient,
  agentId: string,
  lead: ReceptionistLeadRow,
  sourceLabel: string
): Promise<void> {
  try {
    // Look for an active deal (not closed/lost/dead)
    const { data: existingDeal } = await admin
      .from("deals")
      .select("id")
      .eq("agent_id", agentId)
      .eq("lead_id", lead.id)
      .neq("stage", "closed")
      .neq("stage", "lost")
      .neq("stage", "dead")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDeal?.id) {
      // Touch updated_at so the deal surfaces in recency-sorted views
      await admin
        .from("deals")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingDeal.id);
      return;
    }

    // Determine deal type from intent
    const intentLower = (lead.intent || "").trim().toLowerCase();
    const dealType = intentLower.includes("sell") ? "listing" : "buyer";

    // Build concise notes from available lead fields
    const noteParts: string[] = [`Secretary lead via ${sourceLabel}.`];
    if (lead.timeline) noteParts.push(`Timeline: ${lead.timeline}.`);
    if (lead.lead_temp) noteParts.push(`Temp: ${lead.lead_temp}.`);

    await admin.from("deals").insert({
      agent_id: agentId,
      lead_id: lead.id,
      stage: "prospecting",
      stage_entered_at: new Date().toISOString(),
      deal_type: dealType,
      // Use location_area as best available address proxy for SMS/call leads
      property_address: optionalString(lead.location_area),
      price: null,
      expected_close_date: null,
      notes: noteParts.join(" "),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[receptionist] off-market deal upsert failed", err instanceof Error ? err.message : err);
  }
}

export async function insertLeadInteraction(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
  channel: LeadInteractionRow["channel"];
  direction: LeadInteractionRow["direction"];
  interactionType: string;
  status: LeadInteractionRow["status"];
  messageBody?: string | null;
  transcript?: string | null;
  summary?: string | null;
  providerMessageId?: string | null;
  providerCallId?: string | null;
  structuredPayload?: Record<string, unknown>;
  createdAt?: string;
}): Promise<LeadInteractionRow> {
  const createdAt = input.createdAt || new Date().toISOString();

  // Idempotency: if a provider ID is present, skip insert if already recorded
  if (input.providerMessageId) {
    const { data: existing } = await input.admin
      .from("lead_interactions")
      .select("id,agent_id,lead_id,channel,direction,interaction_type,status,raw_transcript,raw_message_body,summary,structured_payload,provider_message_id,provider_call_id,created_at")
      .eq("agent_id", input.agentId)
      .eq("provider_message_id", input.providerMessageId)
      .maybeSingle();
    if (existing) return existing as LeadInteractionRow;
  }

  if (input.providerCallId) {
    const { data: existing } = await input.admin
      .from("lead_interactions")
      .select("id,agent_id,lead_id,channel,direction,interaction_type,status,raw_transcript,raw_message_body,summary,structured_payload,provider_message_id,provider_call_id,created_at")
      .eq("agent_id", input.agentId)
      .eq("provider_call_id", input.providerCallId)
      .maybeSingle();
    if (existing) return existing as LeadInteractionRow;
  }

  const { data, error } = await input.admin
    .from("lead_interactions")
    .insert({
      agent_id: input.agentId,
      lead_id: input.leadId,
      channel: input.channel,
      direction: input.direction,
      interaction_type: input.interactionType,
      status: input.status,
      raw_message_body: optionalString(input.messageBody),
      raw_transcript: optionalString(input.transcript),
      summary: compactText(input.summary || input.messageBody || null),
      structured_payload: input.structuredPayload || {},
      provider_message_id: optionalString(input.providerMessageId || null),
      provider_call_id: optionalString(input.providerCallId || null),
      created_at: createdAt,
    })
    .select(
      "id,agent_id,lead_id,channel,direction,interaction_type,status,raw_transcript,raw_message_body,summary,structured_payload,provider_message_id,provider_call_id,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not log interaction.");
  }

  const leadPatch: Record<string, unknown> = {
    time_last_updated: createdAt,
    last_communication_at: createdAt,
  };

  const messagePreview = compactText(input.messageBody || input.summary || null, 180);
  if (messagePreview) {
    leadPatch.last_message_preview = messagePreview;
  }

  await input.admin
    .from("leads")
    .update(leadPatch)
    .eq("id", input.leadId)
    .eq("agent_id", input.agentId);

  return data as LeadInteractionRow;
}

export async function createReceptionistAlert(input: {
  admin: AdminClient;
  agentId: string;
  leadId?: string | null;
  alertType: string;
  severity: ReceptionistAlertRow["severity"];
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<ReceptionistAlertRow | null> {
  const { data, error } = await input.admin
    .from("receptionist_alerts")
    .insert({
      agent_id: input.agentId,
      lead_id: input.leadId || null,
      alert_type: input.alertType,
      severity: input.severity,
      title: compactText(input.title, 140) || "Receptionist Alert",
      message: compactText(input.message, 500) || "Lead activity needs attention.",
      metadata: input.metadata || {},
      status: "open",
    })
    .select("id,agent_id,lead_id,alert_type,severity,title,message,status,metadata,created_at")
    .single();

  if (error || !data) {
    return null;
  }

  return data as ReceptionistAlertRow;
}

async function loadLeadForAgent(
  admin: AdminClient,
  agentId: string,
  leadId: string
): Promise<ReceptionistLeadRow | null> {
  const { data, error } = await admin
    .from("leads")
    .select(
      "id,agent_id,ig_username,canonical_email,canonical_phone,raw_email,raw_phone,full_name,first_name,last_name,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,notes,next_step,urgency_level,urgency_score,source_detail"
    )
    .eq("id", leadId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ReceptionistLeadRow | null) || null;
}

export async function getLeadCommunicationThread(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
}): Promise<LeadCommunicationThread | null> {
  const lead = await loadLeadForAgent(input.admin, input.agentId, input.leadId);
  if (!lead) return null;

  const { data: interactionsData, error: interactionsError } = await input.admin
    .from("lead_interactions")
    .select(
      "id,agent_id,lead_id,channel,direction,interaction_type,status,raw_transcript,raw_message_body,summary,structured_payload,provider_message_id,provider_call_id,created_at"
    )
    .eq("agent_id", input.agentId)
    .eq("lead_id", input.leadId)
    .order("created_at", { ascending: true })
    .limit(160);

  if (interactionsError) {
    throw new Error(interactionsError.message);
  }

  const { data: alertsData, error: alertsError } = await input.admin
    .from("receptionist_alerts")
    .select("id,agent_id,lead_id,alert_type,severity,title,message,status,metadata,created_at")
    .eq("agent_id", input.agentId)
    .eq("lead_id", input.leadId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);

  if (alertsError) {
    throw new Error(alertsError.message);
  }

  return {
    lead: {
      id: lead.id,
      full_name: lead.full_name,
      canonical_phone: lead.canonical_phone,
      canonical_email: lead.canonical_email,
      stage: lead.stage,
      lead_temp: lead.lead_temp,
      urgency_level: lead.urgency_level,
      urgency_score: lead.urgency_score,
      source: lead.source,
    },
    interactions: ((interactionsData || []) as LeadInteractionRow[]).map((row) => ({
      ...row,
      structured_payload:
        row.structured_payload && typeof row.structured_payload === "object" && !Array.isArray(row.structured_payload)
          ? (row.structured_payload as Record<string, unknown>)
          : {},
    })),
    alerts: ((alertsData || []) as ReceptionistAlertRow[]).map((row) => ({
      ...row,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
    })),
  };
}

async function maybeSendNotificationSms(input: {
  context: AgentReceptionistContext;
  body: string;
}): Promise<SmsSendResult | null> {
  const toPhone = normalizePhoneToE164(input.context.settings.notification_phone_number);
  const fromPhone = normalizePhoneToE164(input.context.settings.business_phone_number);
  if (!toPhone || !fromPhone) return null;

  return sendReceptionistSms({
    agentId: input.context.agentId,
    fromPhone,
    toPhone,
    text: input.body,
  });
}

export async function notifyAgentFormSubmission(
  admin: AdminClient,
  agentId: string,
  opts: { leadName: string | null; phone: string | null; formLabel: string; details?: string | null }
): Promise<void> {
  const context = await loadAgentReceptionistContext(admin, agentId);
  const displayName = opts.leadName || opts.phone || "New lead";
  const baseLine = `${displayName}${opts.phone ? ` · ${opts.phone}` : ""} submitted the ${opts.formLabel}.`;
  const alertMessage = opts.details ? `${baseLine} ${opts.details}` : baseLine;
  const smsText = opts.details
    ? `LockboxHQ: New ${opts.formLabel} — ${displayName}${opts.phone ? `, ${opts.phone}` : ""}. ${opts.details}`
    : `LockboxHQ: New ${opts.formLabel} — ${displayName}${opts.phone ? `, ${opts.phone}` : ""}.`;

  await createReceptionistAlert({
    admin,
    agentId,
    alertType: "form_submission",
    severity: "info",
    title: `New ${opts.formLabel} submission`,
    message: alertMessage,
    metadata: { form_label: opts.formLabel, lead_name: opts.leadName, phone: opts.phone, details: opts.details ?? null },
  });

  const fromPhone = normalizePhoneToE164(context.settings.business_phone_number);
  const toPhone = normalizePhoneToE164(context.settings.notification_phone_number);
  if (fromPhone && toPhone) {
    await sendReceptionistSms({ agentId, fromPhone, toPhone, text: smsText });
  } else {
    // Email fallback for agents without Secretary SMS configured
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const { data: userData } = await admin.auth.admin.getUserById(agentId);
        const agentEmail = userData?.user?.email;
        if (agentEmail) {
          const resend = new Resend(apiKey);
          await resend.emails.send({
            from: "LockboxHQ <onboarding@resend.dev>",
            to: agentEmail,
            subject: `New ${opts.formLabel} — ${displayName}`,
            text: `${alertMessage}\n\nLog in to LockboxHQ to view and respond:\nhttps://lockboxhq.com/app`,
          });
        }
      } catch (err) {
        console.warn("[intake] agent email fallback failed", err instanceof Error ? err.message : err);
      }
    }
  }
}

export async function processInboundSms(input: {
  admin: AdminClient;
  agentId: string;
  fromPhone: string;
  toPhone?: string | null;
  messageBody: string;
  providerMessageId?: string | null;
  provider?: string | null;
}): Promise<InboundSmsWorkflowResult> {
  const context = await loadAgentReceptionistContext(input.admin, input.agentId);
  const body = input.messageBody.trim();
  const occurredAt = new Date().toISOString();

  if (!body) {
    throw new Error("Inbound message is empty.");
  }

  const structured = extractStructuredFieldsFromSms(body);
  const urgency = detectUrgency(body, context.settings.escalation_keywords);

  const upsertResult = await upsertReceptionistLead({
    admin: input.admin,
    agentId: input.agentId,
    source: "sms_receptionist",
    values: {
      ...structured,
      phone: input.fromPhone,
      source: "sms_receptionist",
      source_detail: {
        channel: "sms",
        from_phone: input.fromPhone,
        to_phone: input.toPhone || null,
        provider: optionalString(input.provider || null),
      },
      urgency_level: urgency.isHigh ? "high" : null,
      urgency_score: urgency.score,
      interaction_at: occurredAt,
    },
  });

  const lead = upsertResult.lead;

  // Off-market pipeline: auto-create/update deal for this lead
  if (context.isOffMarketAccount) {
    await upsertOffMarketDealForReceptionistLead(input.admin, input.agentId, lead, "inbound SMS");
  }

  await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: lead.id,
    channel: "sms",
    direction: "in",
    interactionType: "sms_inbound",
    status: "received",
    messageBody: body,
    summary: compactText(body, 170),
    providerMessageId: input.providerMessageId,
    structuredPayload: {
      parsed_fields: structured,
      urgency_score: urgency.score,
      matched_keywords: urgency.matchedKeywords,
      provider: optionalString(input.provider || null),
    },
    createdAt: occurredAt,
  });

  if (urgency.isHigh) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: lead.id,
      alertType: "urgent_timing_detected",
      severity: "urgent",
      title: "Urgent lead response requested",
      message: `${lead.full_name || lead.canonical_phone || "Lead"} requested immediate support by text.`,
      metadata: {
        matched_keywords: urgency.matchedKeywords,
        urgency_score: urgency.score,
      },
    });

    await maybeSendNotificationSms({
      context,
      body: `LockboxHQ urgent lead alert: ${lead.full_name || lead.canonical_phone || "Lead"} asked for immediate help.`,
    });
  }

  if (upsertResult.previousUrgencyScore < 50 && urgency.score >= 50) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: lead.id,
      alertType: "urgency_threshold_crossed",
      severity: "high",
      title: "Urgency threshold crossed",
      message: `${lead.full_name || lead.canonical_phone || "Lead"} moved into high urgency.`,
      metadata: {
        previous_score: upsertResult.previousUrgencyScore,
        next_score: urgency.score,
      },
    });
  }

  let askedQuestion: string | null = null;
  const nextQuestion = nextMissingReceptionistQuestion(lead);
  const canAutoReply =
    context.settings.receptionist_enabled &&
    context.settings.communications_enabled &&
    Boolean(normalizePhoneToE164(context.settings.business_phone_number)) &&
    !stopsAutomation(body);

  if (nextQuestion && canAutoReply) {
    const sms = await sendReceptionistSms({
      agentId: input.agentId,
      fromPhone: context.settings.business_phone_number,
      toPhone: input.fromPhone,
      text: nextQuestion.prompt,
    });

    await insertLeadInteraction({
      admin: input.admin,
      agentId: input.agentId,
      leadId: lead.id,
      channel: "sms",
      direction: "out",
      interactionType: "qualification_prompt",
      status: sms.ok ? sms.status : "failed",
      messageBody: nextQuestion.prompt,
      providerMessageId: sms.providerMessageId,
      summary: `Prompted for ${nextQuestion.field}.`,
      structuredPayload: {
        question_field: nextQuestion.field,
        provider: sms.provider,
        error: sms.error,
      },
      createdAt: new Date().toISOString(),
    });

    if (!sms.ok) {
      await createReceptionistAlert({
        admin: input.admin,
        agentId: input.agentId,
        leadId: lead.id,
        alertType: "sms_send_failed",
        severity: "high",
        title: "Receptionist SMS failed",
        message: sms.error || "Could not send qualification prompt.",
        metadata: {
          question_field: nextQuestion.field,
        },
      });
    } else {
      askedQuestion = nextQuestion.prompt;
    }
  }

  // ── PA reply interpretation ───────────────────────────────────────────────
  // Check if this inbound message is a reply to a PA-sent message.
  // If so, run it through the AI interpreter and act based on pa_mode.
  void processPaReply({
    admin: input.admin,
    agentId: input.agentId,
    leadId: lead.id,
    messageBody: body,
    context,
    fromPhone: input.fromPhone,
  }).catch((err) =>
    console.warn("[pa-interpreter] reply processing failed", err instanceof Error ? err.message : err)
  );

  return {
    leadId: lead.id,
    createdLead: upsertResult.created,
    urgent: urgency.isHigh,
    askedQuestion,
  };
}

async function processPaReply(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
  messageBody: string;
  context: AgentReceptionistContext;
  fromPhone: string;
}): Promise<void> {
  // Only run if comms enabled and not a stop message
  if (!input.context.settings.communications_enabled) return;
  if (stopsAutomation(input.messageBody)) return;

  // Check if lead has a recent outbound PA message (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: paMessages } = await input.admin
    .from("lead_interactions")
    .select("id")
    .eq("agent_id", input.agentId)
    .eq("lead_id", input.leadId)
    .eq("direction", "out")
    .like("interaction_type", "pa_%")
    .gte("created_at", sevenDaysAgo)
    .limit(1)
    .maybeSingle();

  if (!paMessages) return; // Not a PA conversation — skip

  // Load deal context
  const { data: dealRow } = await input.admin
    .from("deals")
    .select("id,property_address,stage")
    .eq("agent_id", input.agentId)
    .eq("lead_id", input.leadId)
    .neq("stage", "closed")
    .neq("stage", "dead")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: leadRow } = await input.admin
    .from("leads")
    .select("full_name")
    .eq("id", input.leadId)
    .maybeSingle();

  const todayStr = new Date().toLocaleDateString("en-CA");

  const interpretation = await interpretLeadReply({
    messageBody: input.messageBody,
    agentName: input.context.agentName,
    lead: {
      leadName: (leadRow as { full_name: string | null } | null)?.full_name ?? null,
      propertyAddress: (dealRow as { property_address: string | null } | null)?.property_address ?? null,
      dealStage: (dealRow as { stage: string } | null)?.stage ?? null,
    },
    todayStr,
  });

  if (!interpretation) return;

  const paMode = input.context.settings.pa_mode;
  const fromPhone = normalizePhoneToE164(input.context.settings.business_phone_number);
  const dealId = (dealRow as { id: string } | null)?.id ?? null;

  if (paMode === "autopilot") {
    // Execute action immediately
    await executePaAction({
      admin: input.admin,
      agentId: input.agentId,
      leadId: input.leadId,
      dealId,
      interpretation,
      fromPhone,
      toPhone: input.fromPhone,
      context: input.context,
    });
  } else {
    // Copilot: create draft alert for agent to review
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: input.leadId,
      alertType: "pa_reply_draft",
      severity: "info",
      title: `PA draft reply ready — ${(leadRow as { full_name: string | null } | null)?.full_name ?? "Lead"}`,
      message: interpretation.draftReply,
      metadata: {
        intent: interpretation.intent,
        confidence: interpretation.confidence,
        reasoning: interpretation.reasoning,
        draft_reply: interpretation.draftReply,
        suggested_action: interpretation.suggestedAction,
        from_phone: fromPhone,
        to_phone: input.fromPhone,
        deal_id: dealId,
        lead_message: input.messageBody,
      },
    });
  }
}

async function executePaAction(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
  dealId: string | null;
  interpretation: Awaited<ReturnType<typeof interpretLeadReply>>;
  fromPhone: string | null;
  toPhone: string;
  context: AgentReceptionistContext;
}): Promise<void> {
  if (!input.interpretation) return;
  const { suggestedAction, draftReply, intent } = input.interpretation;

  // Don't reply on stop
  if (intent === "stop") return;

  // Execute CRM action
  if (input.dealId) {
    if (suggestedAction.type === "move_stage_dead") {
      await input.admin.from("deals").update({ stage: "dead", updated_at: new Date().toISOString() }).eq("id", input.dealId);
    } else if (suggestedAction.type === "move_stage_negotiating") {
      await input.admin.from("deals").update({ stage: "negotiating", updated_at: new Date().toISOString() }).eq("id", input.dealId);
    } else if (suggestedAction.type === "move_stage_offer_sent") {
      await input.admin.from("deals").update({ stage: "offer_sent", updated_at: new Date().toISOString() }).eq("id", input.dealId);
    } else if (suggestedAction.type === "set_followup_date" && suggestedAction.followup_date) {
      await input.admin.from("deals").update({
        next_followup_date: suggestedAction.followup_date,
        updated_at: new Date().toISOString(),
      }).eq("id", input.dealId);
    }

    if (suggestedAction.notes) {
      const { data: deal } = await input.admin.from("deals").select("notes").eq("id", input.dealId).maybeSingle();
      const existingNotes = (deal as { notes: string | null } | null)?.notes ?? "";
      const newNote = `[PA ${new Date().toLocaleDateString()}] ${suggestedAction.notes}`;
      await input.admin.from("deals").update({
        notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote,
      }).eq("id", input.dealId);
    }
  }

  // Send the draft reply
  if (input.fromPhone && draftReply) {
    const sms = await sendReceptionistSms({
      agentId: input.agentId,
      fromPhone: input.fromPhone,
      toPhone: input.toPhone,
      text: draftReply,
    });

    await insertLeadInteraction({
      admin: input.admin,
      agentId: input.agentId,
      leadId: input.leadId,
      channel: "sms",
      direction: "out",
      interactionType: "pa_auto_reply",
      status: sms.ok ? "sent" : "failed",
      messageBody: draftReply,
      providerMessageId: sms.providerMessageId,
      summary: draftReply.slice(0, 160),
      structuredPayload: {
        source: "pa_interpreter",
        intent: input.interpretation.intent,
        action: suggestedAction.type,
        confidence: input.interpretation.confidence,
      },
      createdAt: new Date().toISOString(),
    });
  }
}

export async function processMissedCall(input: {
  admin: AdminClient;
  agentId: string;
  fromPhone: string;
  toPhone?: string | null;
  providerCallId?: string | null;
  provider?: string | null;
}): Promise<{ leadId: string; textbackSent: boolean }> {
  const context = await loadAgentReceptionistContext(input.admin, input.agentId);
  const occurredAt = new Date().toISOString();

  const upsertResult = await upsertReceptionistLead({
    admin: input.admin,
    agentId: input.agentId,
    source: "missed_call_textback",
    values: {
      phone: input.fromPhone,
      source: "missed_call_textback",
      next_step: "Call back this lead",
      source_detail: {
        channel: "phone",
        event: "missed_call",
        from_phone: input.fromPhone,
        to_phone: input.toPhone || null,
        provider: optionalString(input.provider || null),
      },
      interaction_at: occurredAt,
    },
  });

  const lead = upsertResult.lead;

  // Off-market pipeline: auto-create/update deal for this lead
  if (context.isOffMarketAccount) {
    await upsertOffMarketDealForReceptionistLead(input.admin, input.agentId, lead, "missed call");
  }

  await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: lead.id,
    channel: "missed_call_textback",
    direction: "in",
    interactionType: "missed_call",
    status: "missed",
    summary: "Inbound call missed. Text-back workflow started.",
    providerCallId: input.providerCallId,
    structuredPayload: {
      provider: optionalString(input.provider || null),
      from_phone: input.fromPhone,
      to_phone: input.toPhone || null,
    },
    createdAt: occurredAt,
  });

  const fromBusinessPhone = normalizePhoneToE164(context.settings.business_phone_number);
  const canTextback = shouldSendMissedCallTextback(context.settings) && Boolean(fromBusinessPhone);

  if (!canTextback) {
    return { leadId: lead.id, textbackSent: false };
  }

  const starter = buildMissedCallStarterText(context.agentName, context.settings);
  const sms = await sendReceptionistSms({
    agentId: input.agentId,
    fromPhone: fromBusinessPhone || context.settings.business_phone_number,
    toPhone: input.fromPhone,
    text: starter,
  });

  await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: lead.id,
    channel: "missed_call_textback",
    direction: "out",
    interactionType: "missed_call_textback",
    status: sms.ok ? sms.status : "failed",
    messageBody: starter,
    providerMessageId: sms.providerMessageId,
    summary: "Missed-call text-back sent.",
    structuredPayload: {
      provider: sms.provider,
      error: sms.error,
    },
    createdAt: new Date().toISOString(),
  });

  if (!sms.ok) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: lead.id,
      alertType: "missed_call_textback_failed",
      severity: "high",
      title: "Missed-call text-back failed",
      message: sms.error || "Could not send missed-call text-back.",
      metadata: {},
    });
  }

  return { leadId: lead.id, textbackSent: sms.ok };
}

export async function sendManualSmsFromCrm(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
  text: string;
}): Promise<{ interaction: LeadInteractionRow; sms: SmsSendResult }> {
  const context = await loadAgentReceptionistContext(input.admin, input.agentId);
  if (!context.settings.receptionist_enabled || !context.settings.communications_enabled) {
    throw new Error("Receptionist communications are disabled.");
  }

  const lead = await loadLeadForAgent(input.admin, input.agentId, input.leadId);
  if (!lead) {
    throw new Error("Lead not found.");
  }

  const toPhone = normalizePhoneToE164(lead.canonical_phone);
  const fromPhone = normalizePhoneToE164(context.settings.business_phone_number);

  if (!toPhone) {
    throw new Error("Lead phone number is missing.");
  }
  if (!fromPhone) {
    throw new Error("Business phone number is not configured.");
  }

  const sms = await sendReceptionistSms({
    agentId: input.agentId,
    fromPhone,
    toPhone,
    text: input.text,
  });

  const interaction = await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: input.leadId,
    channel: "sms",
    direction: "out",
    interactionType: "manual_sms",
    status: sms.ok ? sms.status : "failed",
    messageBody: input.text,
    providerMessageId: sms.providerMessageId,
    summary: compactText(input.text, 170),
    structuredPayload: {
      provider: sms.provider,
      error: sms.error,
      initiated_by: "crm",
    },
  });

  if (!sms.ok) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: input.leadId,
      alertType: "manual_sms_failed",
      severity: "high",
      title: "Manual SMS failed",
      message: sms.error || "Could not send CRM text message.",
      metadata: {},
    });
  }

  return { interaction, sms };
}

export async function startCrmBridgeCall(input: {
  admin: AdminClient;
  agentId: string;
  leadId: string;
}): Promise<{ interaction: LeadInteractionRow; call: CallBridgeResult }> {
  const context = await loadAgentReceptionistContext(input.admin, input.agentId);
  if (!context.settings.receptionist_enabled || !context.settings.communications_enabled) {
    throw new Error("Receptionist communications are disabled.");
  }

  const lead = await loadLeadForAgent(input.admin, input.agentId, input.leadId);
  if (!lead) {
    throw new Error("Lead not found.");
  }

  const leadPhone = normalizePhoneToE164(lead.canonical_phone);
  const fromPhone = normalizePhoneToE164(context.settings.business_phone_number);
  const forwardingPhone = normalizePhoneToE164(context.settings.forwarding_phone_number);

  if (!leadPhone) {
    throw new Error("Lead phone number is missing.");
  }
  if (!fromPhone) {
    throw new Error("Business phone number is not configured.");
  }
  if (!forwardingPhone) {
    throw new Error("Forwarding phone number is not configured.");
  }

  const call = await startReceptionistBridgeCall({
    agentId: input.agentId,
    fromPhone,
    leadPhone,
    forwardingPhone,
  });

  const interaction = await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: input.leadId,
    channel: "call_outbound",
    direction: "out",
    interactionType: "call_outbound",
    status: call.ok ? (call.status === "completed" ? "completed" : "queued") : "failed",
    summary: call.ok
      ? "Click-to-call bridge initiated. Agent phone rings first, then lead is dialed."
      : "Click-to-call bridge failed.",
    providerCallId: call.providerCallId,
    structuredPayload: {
      provider: call.provider,
      error: call.error,
      bridge_flow: "agent_first_then_lead",
    },
  });

  if (!call.ok) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: input.leadId,
      alertType: "call_bridge_failed",
      severity: "high",
      title: "Click-to-call bridge failed",
      message: call.error || "Could not start the outbound bridge call.",
      metadata: {},
    });
  }

  return { interaction, call };
}

function normalizeInboundCallStatus(value: string | null | undefined): LeadInteractionRow["status"] {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "missed" || normalized === "no-answer" || normalized === "no_answer") {
    return "missed";
  }
  if (normalized === "completed" || normalized === "answered") {
    return "completed";
  }
  if (normalized === "failed" || normalized === "busy") {
    return "failed";
  }
  return "received";
}

export async function processInboundCallLog(input: {
  admin: AdminClient;
  agentId: string;
  fromPhone: string;
  toPhone?: string | null;
  callStatus?: string | null;
  transcript?: string | null;
  providerCallId?: string | null;
  provider?: string | null;
}): Promise<{ leadId: string; urgent: boolean }> {
  const context = await loadAgentReceptionistContext(input.admin, input.agentId);
  const occurredAt = new Date().toISOString();
  const transcript = optionalString(input.transcript) || "";
  const urgency = detectUrgency(transcript, context.settings.escalation_keywords);

  const upsertResult = await upsertReceptionistLead({
    admin: input.admin,
    agentId: input.agentId,
    source: "call_inbound",
    values: {
      phone: input.fromPhone,
      source: "call_inbound",
      source_detail: {
        channel: "phone",
        event: "inbound_call",
        from_phone: input.fromPhone,
        to_phone: input.toPhone || null,
        provider: optionalString(input.provider || null),
      },
      urgency_level: urgency.isHigh ? "high" : null,
      urgency_score: urgency.score,
      interaction_at: occurredAt,
    },
  });

  const lead = upsertResult.lead;

  // Off-market pipeline: auto-create/update deal for this lead
  if (context.isOffMarketAccount) {
    await upsertOffMarketDealForReceptionistLead(input.admin, input.agentId, lead, "inbound call");
  }

  const status = normalizeInboundCallStatus(input.callStatus);

  await insertLeadInteraction({
    admin: input.admin,
    agentId: input.agentId,
    leadId: lead.id,
    channel: "call_inbound",
    direction: "in",
    interactionType: "call_inbound",
    status,
    transcript: transcript || null,
    summary: transcript
      ? compactText(transcript, 180)
      : `Inbound call ${status}.`,
    providerCallId: input.providerCallId,
    structuredPayload: {
      call_status: input.callStatus || null,
      provider: optionalString(input.provider || null),
      urgency_score: urgency.score,
      matched_keywords: urgency.matchedKeywords,
    },
    createdAt: occurredAt,
  });

  if (urgency.isHigh) {
    await createReceptionistAlert({
      admin: input.admin,
      agentId: input.agentId,
      leadId: lead.id,
      alertType: "inbound_call_urgent",
      severity: "urgent",
      title: "Urgent inbound call signal",
      message: `${lead.full_name || lead.canonical_phone || "Lead"} has urgent language in call transcript.`,
      metadata: {
        matched_keywords: urgency.matchedKeywords,
        urgency_score: urgency.score,
      },
    });
  }

  return { leadId: lead.id, urgent: urgency.isHigh };
}
