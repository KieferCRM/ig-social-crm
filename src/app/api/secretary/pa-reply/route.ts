/**
 * POST /api/secretary/pa-reply
 * Agent approves (or edits) a co-pilot draft reply.
 * Sends the SMS, executes the CRM action, resolves the alert.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendReceptionistSms } from "@/lib/receptionist/provider";
import { normalizePhoneToE164 } from "@/lib/receptionist/lead-upsert";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import { insertLeadInteraction } from "@/lib/receptionist/service";
import type { PaSuggestedAction } from "@/lib/receptionist/pa-interpreter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { alertId: string; messageBody: string; skipReply?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

  const admin = supabaseAdmin();

  // Load the alert
  const { data: alert } = await admin
    .from("receptionist_alerts")
    .select("*")
    .eq("id", body.alertId)
    .eq("agent_id", user.id)
    .eq("alert_type", "pa_reply_draft")
    .maybeSingle();

  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  const meta = (alert.metadata ?? {}) as Record<string, unknown>;
  const toPhone = meta.to_phone as string | null;
  const dealId = meta.deal_id as string | null;
  const leadId = alert.lead_id as string | null;
  const suggestedAction = meta.suggested_action as PaSuggestedAction | null;

  // Load agent settings for fromPhone
  const { data: agentRow } = await admin.from("agents").select("settings").eq("id", user.id).maybeSingle();
  const settings = readReceptionistSettingsFromAgentSettings(agentRow?.settings ?? null);
  const fromPhone = normalizePhoneToE164(settings.business_phone_number);

  if (!body.skipReply && fromPhone && toPhone) {
    const sms = await sendReceptionistSms({
      agentId: user.id,
      fromPhone,
      toPhone,
      text: body.messageBody,
    });

    if (leadId) {
      await insertLeadInteraction({
        admin,
        agentId: user.id,
        leadId,
        channel: "sms",
        direction: "out",
        interactionType: "pa_copilot_reply",
        status: sms.ok ? "sent" : "failed",
        messageBody: body.messageBody,
        providerMessageId: sms.providerMessageId,
        summary: body.messageBody.slice(0, 160),
        structuredPayload: { source: "pa_copilot", alert_id: body.alertId },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Execute CRM action
  if (dealId && suggestedAction) {
    const now = new Date().toISOString();
    if (suggestedAction.type === "move_stage_dead") {
      await admin.from("deals").update({ stage: "dead", updated_at: now }).eq("id", dealId);
    } else if (suggestedAction.type === "move_stage_negotiating") {
      await admin.from("deals").update({ stage: "negotiating", updated_at: now }).eq("id", dealId);
    } else if (suggestedAction.type === "move_stage_offer_sent") {
      await admin.from("deals").update({ stage: "offer_sent", updated_at: now }).eq("id", dealId);
    } else if (suggestedAction.type === "set_followup_date" && suggestedAction.followup_date) {
      await admin.from("deals").update({ next_followup_date: suggestedAction.followup_date, updated_at: now }).eq("id", dealId);
    }
  }

  // Resolve the alert
  await admin.from("receptionist_alerts").update({ status: "resolved" }).eq("id", body.alertId);

  return NextResponse.json({ ok: true });
}
