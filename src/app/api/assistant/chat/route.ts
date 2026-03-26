import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";
import { leadDisplayName, normalizeDealStage, type DealLeadSummary } from "@/lib/deals";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

type Message = { role: "user" | "assistant"; content: string };

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

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (24 * 3600_000));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { messages?: Message[] };
  const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const { data: agentRow } = await supabase
    .from("agents")
    .select("settings, timezone, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const agentTimezone = (agentRow?.timezone as string | null) ?? "America/New_York";
  const agentName = (agentRow?.full_name as string | null) ?? null;
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: agentTimezone });
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();

  type RawDeal = {
    id: unknown; lead_id: unknown; property_address: unknown; stage: unknown;
    updated_at: unknown; next_followup_date: unknown; stage_entered_at: unknown;
    asking_price: unknown; notes: unknown;
    lead?: DealLeadSummary | DealLeadSummary[];
  };

  type RawLead = {
    id: unknown; full_name: unknown; canonical_phone: unknown; canonical_email: unknown;
    budget_range: unknown; intent: unknown; timeline: unknown; location_area: unknown;
    financing_status: unknown; lead_temp: unknown; source: unknown;
    next_followup_date: unknown; created_at: unknown; notes: unknown;
  };

  type RawAppt = {
    id: unknown; title: unknown; scheduled_at: unknown; location: unknown;
    lead?: { full_name?: string | null } | null;
  };

  type RawTask = { id: unknown; title: unknown; priority: unknown; due_at: unknown; status: unknown };

  const [
    { data: dealData },
    { data: closedDealData },
    { data: appointmentData },
    { data: taskData },
    { data: recentLeadData },
    { data: formAlertData },
  ] = await Promise.all([
    // All active deals
    supabase
      .from("deals")
      .select("id,lead_id,property_address,stage,updated_at,next_followup_date,stage_entered_at,asking_price,notes,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)")
      .eq("agent_id", user.id)
      .not("stage", "in", "(closed,dead)")
      .order("updated_at", { ascending: false }),
    // Closed deals this year
    supabase
      .from("deals")
      .select("id,property_address,asking_price,updated_at")
      .eq("agent_id", user.id)
      .eq("stage", "closed")
      .gte("updated_at", startOfYear),
    // Upcoming appointments (14 days)
    supabase
      .from("appointments")
      .select("id,title,scheduled_at,location,lead:leads(full_name)")
      .eq("agent_id", user.id)
      .neq("status", "cancelled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", twoWeeksOut)
      .order("scheduled_at", { ascending: true })
      .limit(20),
    // Open tasks
    supabase
      .from("lead_recommendations")
      .select("id,title,priority,due_at,status")
      .or(`owner_user_id.eq.${user.id},agent_id.eq.${user.id}`)
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(30),
    // Recent leads (last 30 days)
    supabase
      .from("leads")
      .select("id,full_name,canonical_phone,canonical_email,budget_range,intent,timeline,location_area,financing_status,lead_temp,source,next_followup_date,created_at,notes")
      .eq("agent_id", user.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    // Unread form alerts
    supabase
      .from("receptionist_alerts")
      .select("id")
      .eq("agent_id", user.id)
      .in("alert_type", ["form_submission", "call_inbound"])
      .eq("status", "open"),
  ]);

  // Process active deals
  const activeDeals = ((dealData || []) as RawDeal[]).map((row) => {
    const lead = mapLead(row.lead);
    const days = daysSince(asString(row.updated_at));
    return {
      address: asString(row.property_address) ?? "Unknown address",
      stage: normalizeDealStage(asString(row.stage)),
      sellerName: leadDisplayName(lead) ?? "Unknown seller",
      sellerPhone: lead?.canonical_phone ?? null,
      askingPrice: asString(row.asking_price),
      nextFollowup: asString(row.next_followup_date),
      daysSinceActivity: days,
      isOverdue: asString(row.next_followup_date) ? asString(row.next_followup_date)! <= todayStr : false,
      isStale: days !== null && days > 7,
      notes: asString(row.notes),
    };
  });

  // Closed deals this year
  const closedDeals = closedDealData ?? [];
  const closedCount = closedDeals.length;
  const closedValue = closedDeals.reduce((sum, d) => {
    const price = typeof (d as { asking_price?: unknown }).asking_price === "number"
      ? (d as { asking_price: number }).asking_price
      : 0;
    return sum + price;
  }, 0);

  // Appointments
  const appointments = ((appointmentData ?? []) as RawAppt[]).map((a) => ({
    title: asString(a.title) ?? "Appointment",
    scheduledAt: asString(a.scheduled_at) ?? "",
    location: asString(a.location),
    leadName: (a.lead as { full_name?: string | null } | null)?.full_name ?? null,
  }));

  // Tasks
  const tasks = ((taskData ?? []) as RawTask[]).map((t) => ({
    title: asString(t.title) ?? "Task",
    priority: asString(t.priority) ?? "medium",
    dueAt: asString(t.due_at),
    isOverdue: asString(t.due_at) ? asString(t.due_at)! < todayStr : false,
  }));

  // Recent leads
  const recentLeads = ((recentLeadData ?? []) as RawLead[]).map((l) => ({
    name: asString(l.full_name) ?? "Unknown",
    phone: asString(l.canonical_phone),
    budget: asString(l.budget_range),
    intent: asString(l.intent),
    timeline: asString(l.timeline),
    area: asString(l.location_area),
    financing: asString(l.financing_status),
    temp: asString(l.lead_temp),
    source: asString(l.source),
    nextFollowup: asString(l.next_followup_date),
    daysAgo: daysSince(asString(l.created_at)),
    notes: asString(l.notes),
  }));

  const overdueFollowups = activeDeals.filter((d) => d.isOverdue);
  const staleDeals = activeDeals.filter((d) => d.isStale);
  const overdueTasks = tasks.filter((t) => t.isOverdue);
  const newAlerts = (formAlertData ?? []).length;

  const accountLabel = onboardingState.account_type === "off_market_agent"
    ? "off-market real estate acquisitions agent"
    : "real estate agent";

  const systemPrompt = `You are a trusted business assistant and co-worker for ${agentName ? agentName : "a"} ${accountLabel}. You have complete, real-time visibility into their entire business — every deal, contact, appointment, and task.

Your role is to act like a sharp, knowledgeable colleague who knows everything about their book of business. Help them prioritize their day, answer questions about specific deals or contacts, draft messages, flag risks, and think through decisions.

Guidelines:
- Be direct and specific. Use real names, addresses, and numbers from the data.
- Sound like a trusted colleague, not a chatbot. Conversational, confident, and concise.
- If they ask you to draft a text, email, or voicemail — write it.
- If they ask a general real estate or business question, answer it.
- Keep responses tight unless they ask for more detail.
- Never make up data that isn't in the business snapshot below.
- Today is ${todayStr}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTIVE PIPELINE (${activeDeals.length} deals):
${activeDeals.length === 0 ? "No active deals." : activeDeals.map((d) =>
  `• ${d.address} | ${d.stage} | Seller: ${d.sellerName}${d.sellerPhone ? ` (${d.sellerPhone})` : ""}${d.askingPrice ? ` | Asking: $${d.askingPrice}` : ""}${d.daysSinceActivity !== null ? ` | Last activity: ${d.daysSinceActivity}d ago` : ""}${d.nextFollowup ? ` | Next follow-up: ${d.nextFollowup}` : ""}${d.isStale ? " ⚠ STALE" : ""}${d.isOverdue ? " 🔴 OVERDUE" : ""}${d.notes ? `\n  Notes: ${d.notes.slice(0, 120)}` : ""}`
).join("\n")}

OVERDUE FOLLOW-UPS (${overdueFollowups.length}):
${overdueFollowups.length === 0 ? "None." : overdueFollowups.map((d) => `• ${d.sellerName} — ${d.address} (${d.stage}), due ${d.nextFollowup}`).join("\n")}

STALE DEALS — no activity in 7+ days (${staleDeals.length}):
${staleDeals.length === 0 ? "None." : staleDeals.map((d) => `• ${d.sellerName} — ${d.address} (${d.stage}), ${d.daysSinceActivity}d ago`).join("\n")}

UPCOMING APPOINTMENTS (${appointments.length}):
${appointments.length === 0 ? "None scheduled." : appointments.map((a) => {
  const dt = new Date(a.scheduledAt);
  const label = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " at " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `• ${label} — ${a.title}${a.leadName ? ` with ${a.leadName}` : ""}${a.location ? ` @ ${a.location}` : ""}`;
}).join("\n")}

OPEN TASKS (${tasks.length}):
${tasks.length === 0 ? "None." : tasks.slice(0, 15).map((t) => `• [${t.priority.toUpperCase()}] ${t.title}${t.dueAt ? ` — due ${t.dueAt}` : ""}${t.isOverdue ? " 🔴 OVERDUE" : ""}`).join("\n")}

RECENT LEADS — last 30 days (${recentLeads.length}):
${recentLeads.length === 0 ? "None." : recentLeads.map((l) =>
  `• ${l.name}${l.phone ? ` (${l.phone})` : ""} | ${l.intent ?? "unknown intent"}${l.budget ? ` | Budget: ${l.budget}` : ""}${l.area ? ` | Area: ${l.area}` : ""}${l.financing ? ` | ${l.financing}` : ""}${l.temp ? ` | ${l.temp} lead` : ""}${l.daysAgo !== null ? ` | ${l.daysAgo}d ago` : ""}${l.nextFollowup ? ` | Follow-up: ${l.nextFollowup}` : ""}${l.notes ? `\n  Notes: ${l.notes.slice(0, 100)}` : ""}`
).join("\n")}

CLOSED DEALS THIS YEAR: ${closedCount}${closedValue > 0 ? ` | Total value: $${closedValue.toLocaleString()}` : ""}

UNREAD ALERTS: ${newAlerts} new form submissions / inbound calls awaiting review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : null;

    if (!text) return NextResponse.json({ error: "no response" }, { status: 503 });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[assistant/chat]", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
