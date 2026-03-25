import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateMorningBriefing } from "@/lib/today/morning-briefing";
import { leadDisplayName, normalizeDealStage, type DealLeadSummary } from "@/lib/deals";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function mapLead(value: DealLeadSummary | DealLeadSummary[] | undefined): DealLeadSummary | null {
  const lead = Array.isArray(value) ? value[0] : value;
  if (!lead || typeof lead !== "object") return null;
  return {
    id: typeof lead.id === "string" ? lead.id : "",
    full_name: typeof lead.full_name === "string" ? lead.full_name : null,
    first_name: typeof lead.first_name === "string" ? lead.first_name : null,
    last_name: typeof lead.last_name === "string" ? lead.last_name : null,
    canonical_email: typeof lead.canonical_email === "string" ? lead.canonical_email : null,
    canonical_phone: typeof lead.canonical_phone === "string" ? lead.canonical_phone : null,
    ig_username: typeof lead.ig_username === "string" ? lead.ig_username : null,
    lead_temp: typeof lead.lead_temp === "string" ? lead.lead_temp : null,
    source: typeof lead.source === "string" ? lead.source : null,
    intent: typeof lead.intent === "string" ? lead.intent : null,
    timeline: typeof lead.timeline === "string" ? lead.timeline : null,
    location_area: typeof lead.location_area === "string" ? lead.location_area : null,
  };
}

function isStale(updatedAt: string | null, days: number): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return ts < Date.now() - days * 24 * 3600_000;
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  if (onboardingState.account_type !== "off_market_agent") {
    return NextResponse.json({ error: "not applicable" }, { status: 400 });
  }

  const agentTimezone = (agentRow?.timezone as string | null) ?? "America/New_York";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTimezone });
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
  const eightWeeksOut = new Date(Date.now() + 56 * 24 * 3600_000).toISOString();

  const [{ data: dealData }, { data: appointmentData }, { data: paDraftData }, { data: taskData }, { data: formAlertData }] =
    await Promise.all([
      supabase
        .from("deals")
        .select("id,lead_id,property_address,stage,updated_at,next_followup_date,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)")
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id,title,scheduled_at,location,lead:leads(full_name)")
        .eq("agent_id", user.id)
        .neq("status", "cancelled")
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", todayEnd)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("receptionist_alerts")
        .select("id")
        .eq("agent_id", user.id)
        .eq("alert_type", "pa_reply_draft")
        .eq("status", "open"),
      supabase
        .from("lead_recommendations")
        .select("id,title,priority,due_at")
        .or(`owner_user_id.eq.${user.id},agent_id.eq.${user.id}`)
        .eq("status", "open")
        .lte("due_at", eightWeeksOut)
        .order("due_at", { ascending: true })
        .limit(20),
      supabase
        .from("receptionist_alerts")
        .select("id")
        .eq("agent_id", user.id)
        .in("alert_type", ["form_submission", "call_inbound"])
        .eq("status", "open"),
    ]);

  type RawDeal = { id: unknown; lead_id: unknown; property_address: unknown; stage: unknown; updated_at: unknown; next_followup_date: unknown; lead?: DealLeadSummary | DealLeadSummary[] };
  const deals = ((dealData || []) as RawDeal[]).map((row) => ({
    propertyAddress: asString(row.property_address),
    stage: normalizeDealStage(asString(row.stage)),
    updatedAt: asString(row.updated_at),
    nextFollowupDate: asString(row.next_followup_date),
    lead: mapLead(row.lead),
  }));

  const activeDeals = deals.filter((d) => d.stage !== "closed" && d.stage !== "lost" && d.stage !== "dead");
  const staleDeals = activeDeals.filter((d) => isStale(d.updatedAt, 7));
  const followupsDue = activeDeals.filter((d) => d.nextFollowupDate && d.nextFollowupDate <= todayStr);

  type RawAppt = { id: unknown; title: unknown; scheduled_at: unknown; location: unknown; lead?: { full_name?: string | null } | null };
  const todayAppointments = ((appointmentData ?? []) as RawAppt[]).map((a) => ({
    title: asString(a.title) ?? "Appointment",
    scheduledAt: asString(a.scheduled_at) ?? "",
    location: asString(a.location),
    leadName: (a.lead as { full_name?: string | null } | null)?.full_name ?? null,
  }));

  type RawTask = { id: unknown; title: unknown; priority: unknown; due_at: unknown };
  const tasksDue = ((taskData ?? []) as RawTask[]).map((t) => ({
    title: asString(t.title) ?? "Task",
    priority: asString(t.priority) ?? "medium",
  }));

  const briefing = await generateMorningBriefing({
    todayStr,
    activeDeals: activeDeals.map((d) => ({
      propertyAddress: d.propertyAddress,
      stage: d.stage,
      updatedAt: d.updatedAt,
      nextFollowupDate: d.nextFollowupDate,
      leadName: leadDisplayName(d.lead),
      leadPhone: d.lead?.canonical_phone ?? null,
    })),
    followupsDue: followupsDue.map((d) => ({
      propertyAddress: d.propertyAddress,
      leadName: leadDisplayName(d.lead),
      nextFollowupDate: d.nextFollowupDate,
      stage: d.stage,
    })),
    staleDeals: staleDeals.map((d) => ({
      propertyAddress: d.propertyAddress,
      leadName: leadDisplayName(d.lead),
      updatedAt: d.updatedAt,
      stage: d.stage,
    })),
    todayAppointments,
    secretaryDrafts: (paDraftData ?? []).length,
    tasksDueToday: tasksDue,
    newLeadsOvernight: (formAlertData ?? []).length,
  });

  if (!briefing) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json(briefing);
}
