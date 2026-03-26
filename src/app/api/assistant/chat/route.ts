import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leadDisplayName, normalizeDealStage, type DealLeadSummary } from "@/lib/deals";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { normalizeOffMarketStage, OFF_MARKET_STAGES } from "@/lib/pipeline";

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

// ─── Tool definitions ──────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_lead",
    description: "Create a new lead or contact in the CRM. Use when the agent mentions meeting someone new, getting a referral, or any new seller/buyer contact.",
    input_schema: {
      type: "object" as const,
      properties: {
        full_name: { type: "string", description: "Full name of the lead" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address" },
        intent: { type: "string", enum: ["seller", "buyer", "unknown"], description: "Are they a seller or buyer?" },
        location_area: { type: "string", description: "City, neighborhood, or area they're in or interested in" },
        notes: { type: "string", description: "Any notes about this person" },
      },
      required: ["full_name"],
    },
  },
  {
    name: "create_task",
    description: "Create a task or reminder. Use when the agent says 'remind me', 'I need to', 'follow up on', 'schedule', 'call', 'text', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "What needs to be done — be specific" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level" },
        deal_address: { type: "string", description: "Property address if this task is related to a specific deal (partial match OK)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_deal_stage",
    description: "Move a deal to a different stage in the pipeline. Use when the agent says a deal moved, they signed, they're under contract, sent an offer, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_address: { type: "string", description: "Property address of the deal (partial match OK)" },
        stage: {
          type: "string",
          enum: ["prospecting", "offer_sent", "negotiating", "under_contract", "closed", "dead"],
          description: "The new stage to move the deal to",
        },
      },
      required: ["deal_address", "stage"],
    },
  },
  {
    name: "schedule_followup",
    description: "Set or update the next follow-up date on a deal. Use when the agent says 'follow up with [seller] on [date]' or 'check back in X days'.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_address: { type: "string", description: "Property address of the deal (partial match OK)" },
        follow_up_date: { type: "string", description: "Date to follow up in YYYY-MM-DD format" },
      },
      required: ["deal_address", "follow_up_date"],
    },
  },
  {
    name: "log_note",
    description: "Add a note to a deal or lead. Use when the agent describes an interaction, outcome, or detail about a specific person or property.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_address: { type: "string", description: "Property address of the deal to note (partial match OK). Use this OR lead_name." },
        lead_name: { type: "string", description: "Name of the lead to note (partial match OK). Use this OR deal_address." },
        note: { type: "string", description: "The note to add" },
      },
      required: ["note"],
    },
  },
];

// ─── Tool executor ─────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>;

async function executeTool(
  name: string,
  input: ToolInput,
  agentId: string,
  todayStr: string,
): Promise<string> {
  const admin = supabaseAdmin();

  if (name === "create_lead") {
    const full_name = asString(input.full_name) ?? "Unknown";
    const { data, error } = await admin.from("leads").insert({
      agent_id: agentId,
      full_name,
      canonical_phone: asString(input.phone),
      canonical_email: asString(input.email),
      intent: asString(input.intent) ?? "unknown",
      location_area: asString(input.location_area),
      notes: asString(input.notes),
      source: "assistant",
    }).select("id").single();
    if (error) return `Failed to create lead: ${error.message}`;
    return `Created lead: ${full_name} (id: ${data.id})`;
  }

  if (name === "create_task") {
    const title = asString(input.title) ?? "Task";
    const due_at = asString(input.due_date);
    const priority = asString(input.priority) ?? "medium";

    // Optionally link to a deal
    let dealId: string | null = null;
    const dealAddress = asString(input.deal_address);
    if (dealAddress) {
      const { data: deal } = await admin
        .from("deals")
        .select("id")
        .eq("agent_id", agentId)
        .ilike("property_address", `%${dealAddress}%`)
        .limit(1)
        .maybeSingle();
      dealId = deal?.id ?? null;
    }

    const { error } = await admin.from("lead_recommendations").insert({
      agent_id: agentId,
      owner_user_id: agentId,
      title,
      priority,
      due_at: due_at ?? todayStr,
      status: "open",
      ...(dealId ? { deal_id: dealId } : {}),
    });
    if (error) return `Failed to create task: ${error.message}`;
    return `Created task: "${title}"${due_at ? ` due ${due_at}` : ""}`;
  }

  if (name === "update_deal_stage") {
    const dealAddress = asString(input.deal_address);
    if (!dealAddress) return "No deal address provided.";
    const stage = normalizeOffMarketStage(asString(input.stage));
    if (!(OFF_MARKET_STAGES as readonly string[]).includes(stage)) {
      return `Invalid stage: ${String(input.stage)}`;
    }
    const { data: deal } = await admin
      .from("deals")
      .select("id, property_address")
      .eq("agent_id", agentId)
      .ilike("property_address", `%${dealAddress}%`)
      .limit(1)
      .maybeSingle();
    if (!deal) return `No deal found matching "${dealAddress}"`;
    const { error } = await admin.from("deals").update({
      stage,
      stage_entered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);
    if (error) return `Failed to update stage: ${error.message}`;
    return `Moved "${deal.property_address}" to ${stage}`;
  }

  if (name === "schedule_followup") {
    const dealAddress = asString(input.deal_address);
    if (!dealAddress) return "No deal address provided.";
    const followUpDate = asString(input.follow_up_date);
    if (!followUpDate) return "No follow-up date provided.";
    const { data: deal } = await admin
      .from("deals")
      .select("id, property_address")
      .eq("agent_id", agentId)
      .ilike("property_address", `%${dealAddress}%`)
      .limit(1)
      .maybeSingle();
    if (!deal) return `No deal found matching "${dealAddress}"`;
    const { error } = await admin.from("deals").update({
      next_followup_date: followUpDate,
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);
    if (error) return `Failed to schedule follow-up: ${error.message}`;
    return `Follow-up scheduled for ${followUpDate} on "${deal.property_address}"`;
  }

  if (name === "log_note") {
    const note = asString(input.note);
    if (!note) return "No note provided.";
    const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formatted = `[${timestamp}] ${note}`;

    const dealAddress = asString(input.deal_address);
    if (dealAddress) {
      const { data: deal } = await admin
        .from("deals")
        .select("id, property_address, notes")
        .eq("agent_id", agentId)
        .ilike("property_address", `%${dealAddress}%`)
        .limit(1)
        .maybeSingle();
      if (!deal) return `No deal found matching "${dealAddress}"`;
      const existing = asString(deal.notes);
      const updated = existing ? `${existing}\n${formatted}` : formatted;
      await admin.from("deals").update({ notes: updated, updated_at: new Date().toISOString() }).eq("id", deal.id);
      return `Note added to deal "${deal.property_address}"`;
    }

    const leadName = asString(input.lead_name);
    if (leadName) {
      const { data: lead } = await admin
        .from("leads")
        .select("id, full_name, notes")
        .eq("agent_id", agentId)
        .ilike("full_name", `%${leadName}%`)
        .limit(1)
        .maybeSingle();
      if (!lead) return `No lead found matching "${leadName}"`;
      const existing = asString(lead.notes);
      const updated = existing ? `${existing}\n${formatted}` : formatted;
      await admin.from("leads").update({ notes: updated }).eq("id", lead.id);
      return `Note added to lead "${lead.full_name}"`;
    }

    return "Provide either deal_address or lead_name to log a note.";
  }

  return `Unknown tool: ${name}`;
}

// ─── Route handler ─────────────────────────────────────────────────────────

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
    supabase
      .from("deals")
      .select("id,lead_id,property_address,stage,updated_at,next_followup_date,stage_entered_at,asking_price,notes,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)")
      .eq("agent_id", user.id)
      .not("stage", "in", "(closed,dead)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("deals")
      .select("id,property_address,asking_price,updated_at")
      .eq("agent_id", user.id)
      .eq("stage", "closed")
      .gte("updated_at", startOfYear),
    supabase
      .from("appointments")
      .select("id,title,scheduled_at,location,lead:leads(full_name)")
      .eq("agent_id", user.id)
      .neq("status", "cancelled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", twoWeeksOut)
      .order("scheduled_at", { ascending: true })
      .limit(20),
    supabase
      .from("lead_recommendations")
      .select("id,title,priority,due_at,status")
      .or(`owner_user_id.eq.${user.id},agent_id.eq.${user.id}`)
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(30),
    supabase
      .from("leads")
      .select("id,full_name,canonical_phone,canonical_email,budget_range,intent,timeline,location_area,financing_status,lead_temp,source,next_followup_date,created_at,notes")
      .eq("agent_id", user.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("receptionist_alerts")
      .select("id")
      .eq("agent_id", user.id)
      .in("alert_type", ["form_submission", "call_inbound"])
      .eq("status", "open"),
  ]);

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

  const closedDeals = closedDealData ?? [];
  const closedCount = closedDeals.length;
  const closedValue = closedDeals.reduce((sum, d) => {
    const price = typeof (d as { asking_price?: unknown }).asking_price === "number"
      ? (d as { asking_price: number }).asking_price
      : 0;
    return sum + price;
  }, 0);

  const appointments = ((appointmentData ?? []) as RawAppt[]).map((a) => ({
    title: asString(a.title) ?? "Appointment",
    scheduledAt: asString(a.scheduled_at) ?? "",
    location: asString(a.location),
    leadName: (a.lead as { full_name?: string | null } | null)?.full_name ?? null,
  }));

  const tasks = ((taskData ?? []) as RawTask[]).map((t) => ({
    title: asString(t.title) ?? "Task",
    priority: asString(t.priority) ?? "medium",
    dueAt: asString(t.due_at),
    isOverdue: asString(t.due_at) ? asString(t.due_at)! < todayStr : false,
  }));

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

You can also take action directly in the CRM. When the agent mentions something that should be logged, tracked, scheduled, or moved — do it. Don't ask for permission for obvious actions. If they say "I met Sarah today, seller in Austin", create the lead. If they say "follow up with Oak St on Friday", schedule it. If they say "we just went under contract on Elm St", move the deal. Then confirm what you did.

Guidelines:
- Be direct and specific. Use real names, addresses, and numbers from the data.
- Sound like a trusted colleague, not a chatbot. Conversational, confident, and concise.
- If they ask you to draft a text, email, or voicemail — write it.
- If they ask a general real estate or business question, answer it.
- Keep responses tight unless they ask for more detail.
- Never make up data that isn't in the business snapshot below.
- When you take an action, confirm it briefly: "Done — logged Sarah as a new seller lead."
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

  // Build message history for API
  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    let response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: apiMessages,
    });

    // Agentic loop — execute tools until Claude is done
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < 5) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await executeTool(
            block.name,
            block.input as ToolInput,
            user.id,
            todayStr,
          ),
        }))
      );

      apiMessages.push({ role: "assistant", content: response.content });
      apiMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages: apiMessages,
      });
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const text = textBlock?.text.trim() ?? null;

    if (!text) return NextResponse.json({ error: "no response" }, { status: 503 });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[assistant/chat]", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
