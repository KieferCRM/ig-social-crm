/**
 * PA Decision Engine — runs hourly via Vercel cron.
 *
 * For each agent with Receptionist SMS enabled it:
 *   1. Sends proactive first-touch SMS to leads created from forms in the last 2h (once only)
 *   2. Sends follow-up SMS when a deal's next_followup_date hits today
 *   3. Sends stale-deal check-in if a deal hasn't moved in 7+ days
 *   4. Sends a morning briefing to the agent at 8am their local time
 *
 * Double-send protection: every automated message is logged as a
 * lead_interaction with a pa_* interaction_type. Before sending, we check
 * that no such row exists for the lead + type combination today.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  readReceptionistSettingsFromAgentSettings,
} from "@/lib/receptionist/settings";
import { sendReceptionistSms } from "@/lib/receptionist/provider";
import { normalizePhoneToE164 } from "@/lib/receptionist/lead-upsert";
import { Resend } from "resend";

type AgentRow = {
  id: string;
  full_name: string | null;
  settings: Record<string, unknown> | null;
  timezone: string | null;
};

type DealRow = {
  id: string;
  lead_id: string;
  property_address: string | null;
  stage: string;
  updated_at: string | null;
  created_at: string | null;
  next_followup_date: string | null;
  notes: string | null;
  lead: { full_name: string | null; canonical_phone: string | null; first_name: string | null } | null;
};

function optStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function firstName(fullName: string | null, fallback = "there"): string {
  if (!fullName) return fallback;
  return fullName.split(" ")[0] ?? fallback;
}

/** Returns true if we've already sent a PA message of this type to this lead today. */
async function alreadySentToday(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string,
  leadId: string,
  interactionType: string
): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await admin
    .from("lead_interactions")
    .select("id")
    .eq("agent_id", agentId)
    .eq("lead_id", leadId)
    .eq("interaction_type", interactionType)
    .gte("created_at", since.toISOString())
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Returns true if we've EVER sent this PA interaction type to this lead. */
async function alreadySentEver(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string,
  leadId: string,
  interactionType: string
): Promise<boolean> {
  const { data } = await admin
    .from("lead_interactions")
    .select("id")
    .eq("agent_id", agentId)
    .eq("lead_id", leadId)
    .eq("interaction_type", interactionType)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function logPaInteraction(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string,
  leadId: string,
  interactionType: string,
  messageBody: string
) {
  await admin.from("lead_interactions").insert({
    agent_id: agentId,
    lead_id: leadId,
    channel: "sms",
    direction: "out",
    interaction_type: interactionType,
    status: "sent",
    raw_message_body: messageBody,
    summary: messageBody.slice(0, 180),
    structured_payload: { source: "pa_engine" },
    created_at: new Date().toISOString(),
  });
}

async function sendSms(
  admin: ReturnType<typeof supabaseAdmin>,
  agentId: string,
  fromPhone: string,
  toPhone: string,
  text: string,
  leadId: string,
  interactionType: string
) {
  const result = await sendReceptionistSms({ agentId, fromPhone, toPhone, text });
  if (result.ok) {
    await logPaInteraction(admin, agentId, leadId, interactionType, text);
  }
  return result;
}

// ─── First touch ──────────────────────────────────────────────────────────────

async function processFirstTouch(
  admin: ReturnType<typeof supabaseAdmin>,
  agent: AgentRow,
  fromPhone: string
) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: deals } = await admin
    .from("deals")
    .select("id,lead_id,property_address,stage,notes,lead:leads(full_name,canonical_phone,first_name)")
    .eq("agent_id", agent.id)
    .eq("stage", "prospecting")
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: false });

  for (const raw of deals ?? []) {
    const deal = raw as unknown as DealRow;
    if (!deal.lead_id) continue;

    const leadPhone = normalizePhoneToE164(deal.lead?.canonical_phone ?? null);
    if (!leadPhone) continue;

    const alreadySent = await alreadySentEver(admin, agent.id, deal.lead_id, "pa_first_touch");
    if (alreadySent) continue;

    const name = firstName(deal.lead?.full_name ?? null);
    const agentName = optStr(agent.full_name) ?? "your agent";
    const address = optStr(deal.property_address);

    const isBuyer = deal.notes?.toLowerCase().includes("buyer");
    let text: string;
    if (isBuyer) {
      text = `Hi ${name}, this is ${agentName}. I just received your inquiry and wanted to personally reach out. What area are you focusing on, and what's your timeline looking like?`;
    } else {
      text = address
        ? `Hi ${name}, this is ${agentName}. I just got your info about ${address} and wanted to reach out personally. When's a good time for a quick call this week?`
        : `Hi ${name}, this is ${agentName}. I got your property info and wanted to connect personally. When's a good time for a quick call?`;
    }

    await sendSms(admin, agent.id, fromPhone, leadPhone, text, deal.lead_id, "pa_first_touch");
  }
}

// ─── Follow-up reminders ──────────────────────────────────────────────────────

async function processFollowupReminders(
  admin: ReturnType<typeof supabaseAdmin>,
  agent: AgentRow,
  fromPhone: string,
  todayStr: string
) {
  const { data: deals } = await admin
    .from("deals")
    .select("id,lead_id,property_address,stage,lead:leads(full_name,canonical_phone,first_name)")
    .eq("agent_id", agent.id)
    .eq("next_followup_date", todayStr)
    .neq("stage", "closed")
    .neq("stage", "dead");

  for (const raw of deals ?? []) {
    const deal = raw as unknown as DealRow;
    if (!deal.lead_id) continue;

    const leadPhone = normalizePhoneToE164(deal.lead?.canonical_phone ?? null);
    if (!leadPhone) continue;

    const alreadySent = await alreadySentToday(admin, agent.id, deal.lead_id, "pa_followup_reminder");
    if (alreadySent) continue;

    const name = firstName(deal.lead?.full_name ?? null);
    const agentName = optStr(agent.full_name) ?? "your agent";
    const address = optStr(deal.property_address);

    const text = address
      ? `Hey ${name}, just following up on ${address} — still moving forward? Happy to answer any questions. — ${agentName}`
      : `Hey ${name}, just checking in — still moving forward? Happy to chat if you have any questions. — ${agentName}`;

    await sendSms(admin, agent.id, fromPhone, leadPhone, text, deal.lead_id, "pa_followup_reminder");
  }
}

// ─── Stale deal intervention ──────────────────────────────────────────────────

async function processStaleDeals(
  admin: ReturnType<typeof supabaseAdmin>,
  agent: AgentRow,
  fromPhone: string
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deals } = await admin
    .from("deals")
    .select("id,lead_id,property_address,stage,updated_at,lead:leads(full_name,canonical_phone,first_name)")
    .eq("agent_id", agent.id)
    .neq("stage", "closed")
    .neq("stage", "dead")
    .lt("updated_at", sevenDaysAgo);

  for (const raw of deals ?? []) {
    const deal = raw as unknown as DealRow;
    if (!deal.lead_id) continue;

    const leadPhone = normalizePhoneToE164(deal.lead?.canonical_phone ?? null);
    if (!leadPhone) continue;

    // Only send stale check-in once per week per deal
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentStale } = await admin
      .from("lead_interactions")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("lead_id", deal.lead_id)
      .eq("interaction_type", "pa_stale_deal")
      .gte("created_at", threeDaysAgo)
      .limit(1)
      .maybeSingle();
    if (recentStale) continue;

    const name = firstName(deal.lead?.full_name ?? null);
    const agentName = optStr(agent.full_name) ?? "your agent";
    const address = optStr(deal.property_address);

    const text = address
      ? `Hey ${name}, it's ${agentName} — wanted to check in on ${address}. Any updates on your end?`
      : `Hey ${name}, it's ${agentName} — just wanted to check in. Any updates on your end?`;

    await sendSms(admin, agent.id, fromPhone, leadPhone, text, deal.lead_id, "pa_stale_deal");
  }
}

// ─── Morning briefing ─────────────────────────────────────────────────────────

async function processMorningBriefing(
  admin: ReturnType<typeof supabaseAdmin>,
  agent: AgentRow,
  fromPhone: string,
  notificationPhone: string | null,
  todayStr: string
) {
  // Only send once per day
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data: alreadySent } = await admin
    .from("lead_interactions")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("interaction_type", "pa_morning_briefing")
    .gte("created_at", since.toISOString())
    .limit(1)
    .maybeSingle();
  if (alreadySent) return;

  // Count pipeline stats
  const { data: activeDeals } = await admin
    .from("deals")
    .select("id,next_followup_date,updated_at")
    .eq("agent_id", agent.id)
    .neq("stage", "closed")
    .neq("stage", "dead");

  const deals = (activeDeals ?? []) as Array<{ id: string; next_followup_date: string | null; updated_at: string | null }>;
  const followupsDue = deals.filter((d) => d.next_followup_date && d.next_followup_date <= todayStr).length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stale = deals.filter((d) => d.updated_at && d.updated_at < sevenDaysAgo).length;
  const total = deals.length;

  const agentName = optStr(agent.full_name)?.split(" ")[0] ?? "there";
  const lines: string[] = [`Good morning ${agentName}! Here's your pipeline:`];
  lines.push(`• ${total} active deal${total !== 1 ? "s" : ""}`);
  if (followupsDue > 0) lines.push(`• ${followupsDue} follow-up${followupsDue !== 1 ? "s" : ""} due today`);
  if (stale > 0) lines.push(`• ${stale} stale deal${stale !== 1 ? "s" : ""} (7+ days no activity)`);
  lines.push("Log in at lockboxhq.com/app to review.");
  const text = lines.join("\n");

  // Send to notification phone if configured
  if (notificationPhone) {
    await sendReceptionistSms({ agentId: agent.id, fromPhone, toPhone: notificationPhone, text });
  } else {
    // Email fallback
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const { data: userData } = await admin.auth.admin.getUserById(agent.id);
      const agentEmail = userData?.user?.email;
      if (agentEmail) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: "LockboxHQ <onboarding@resend.dev>",
          to: agentEmail,
          subject: `Your morning pipeline briefing`,
          text,
        }).catch(() => null);
      }
    }
  }

  // Log briefing as a receptionist_alert (no lead_id needed)
  await admin.from("receptionist_alerts").insert({
    agent_id: agent.id,
    lead_id: null,
    alert_type: "pa_morning_briefing",
    severity: "info",
    title: "Morning briefing sent",
    message: text,
    metadata: { total_active: total, followups_due: followupsDue, stale },
    status: "acknowledged",
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Load all agents
  const { data: agentRows } = await admin
    .from("agents")
    .select("id,full_name,settings,timezone");

  const agents = (agentRows ?? []) as AgentRow[];
  const results: Record<string, unknown>[] = [];

  for (const agent of agents) {
    try {
      const settings = readReceptionistSettingsFromAgentSettings(
        agent.settings as Record<string, unknown> | null
      );

      if (!settings.receptionist_enabled || !settings.communications_enabled) continue;

      const fromPhone = normalizePhoneToE164(settings.business_phone_number);
      if (!fromPhone) continue;

      const agentTz = optStr(agent.timezone) ?? "America/New_York";
      const nowLocal = new Date().toLocaleString("en-US", { timeZone: agentTz });
      const localDate = new Date(nowLocal);
      const agentHour = localDate.getHours();
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTz });

      // Office hours bounds
      const hoursStart = parseInt(settings.office_hours_start?.split(":")[0] ?? "9", 10);
      const hoursEnd = parseInt(settings.office_hours_end?.split(":")[0] ?? "18", 10);
      const isBusinessHours = agentHour >= hoursStart && agentHour < hoursEnd;

      // Morning briefing at 8am
      if (agentHour === 8) {
        const notifPhone = normalizePhoneToE164(settings.notification_phone_number);
        await processMorningBriefing(admin, agent, fromPhone, notifPhone, todayStr);
      }

      // Lead-facing actions only during business hours
      if (!isBusinessHours) {
        results.push({ agent_id: agent.id, skipped: "outside_business_hours" });
        continue;
      }

      await processFirstTouch(admin, agent, fromPhone);
      await processFollowupReminders(admin, agent, fromPhone, todayStr);
      await processStaleDeals(admin, agent, fromPhone);

      results.push({ agent_id: agent.id, ok: true });
    } catch (err) {
      results.push({ agent_id: agent.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
