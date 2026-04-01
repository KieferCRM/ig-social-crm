/**
 * GET /api/tasks  — open tasks + completed today
 * POST /api/tasks — create a manual task
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const agentId = auth.context.user.id;
  const ownerFilter = `owner_user_id.eq.${agentId},agent_id.eq.${agentId}`;

  // Midnight today (local UTC)
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const TASK_SELECT = "id, title, description, priority, status, due_at, reason_code, metadata, lead_id, deal_id, completed_at, created_at, updated_at";

  const [{ data: open }, { data: done }] = await Promise.all([
    admin
      .from("lead_recommendations")
      .select(TASK_SELECT)
      .or(ownerFilter)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false }),
    admin
      .from("lead_recommendations")
      .select(TASK_SELECT)
      .or(ownerFilter)
      .eq("status", "done")
      .gte("updated_at", todayMidnight.toISOString())
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  // Enrich with lead and deal info
  const allTasks = [...(open ?? []), ...(done ?? [])];
  const leadIds = [...new Set(allTasks.map((t) => t.lead_id).filter(Boolean) as string[])];
  const dealIds = [...new Set(allTasks.map((t) => t.deal_id).filter(Boolean) as string[])];

  let leadsMap: Record<string, { id: string; full_name: string | null; canonical_phone: string | null }> = {};
  let dealsMap: Record<string, { id: string; property_address: string | null }> = {};

  await Promise.all([
    leadIds.length > 0
      ? admin.from("leads").select("id, full_name, canonical_phone").in("id", leadIds)
          .then(({ data }) => { leadsMap = Object.fromEntries((data ?? []).map((l) => [l.id, l])); })
      : Promise.resolve(),
    dealIds.length > 0
      ? admin.from("deals").select("id, property_address").in("id", dealIds)
          .then(({ data }) => { dealsMap = Object.fromEntries((data ?? []).map((d) => [d.id, d])); })
      : Promise.resolve(),
  ]);

  const enrich = (tasks: typeof allTasks) =>
    tasks.map((t) => ({
      ...t,
      lead: t.lead_id ? (leadsMap[t.lead_id] ?? null) : null,
      deal: t.deal_id ? (dealsMap[t.deal_id] ?? null) : null,
    }));

  return NextResponse.json({
    open: enrich(open ?? []),
    completed_today: enrich(done ?? []),
  });
}

// ---------------------------------------------------------------------------
// POST — create manual task
// ---------------------------------------------------------------------------

type CreateTaskBody = {
  title?: string;
  lead_id?: string | null;
  deal_id?: string | null;
  due_at?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  notes?: string | null;
};

const ALLOWED_PRIORITIES = new Set(["urgent", "high", "medium", "low"]);

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<CreateTaskBody>(request, { maxBytes: 8 * 1024 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { title, lead_id, deal_id, due_at, priority = "medium", notes } = parsed.data;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!due_at) return NextResponse.json({ error: "Due date is required." }, { status: 400 });
  if (!ALLOWED_PRIORITIES.has(priority)) return NextResponse.json({ error: "Invalid priority." }, { status: 400 });

  const dueDate = new Date(due_at);
  if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });

  const agentId = auth.context.user.id;
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("lead_recommendations")
    .insert({
      agent_id: agentId,
      owner_user_id: agentId,
      lead_id: lead_id || null,
      deal_id: deal_id || null,
      reason_code: "manual",
      title: title.trim(),
      description: notes?.trim() || null,
      priority,
      status: "open",
      due_at: dueDate.toISOString(),
      metadata: { source: "manual", notes: notes?.trim() || null },
    })
    .select("id, title, description, priority, status, due_at, reason_code, metadata, lead_id, deal_id, completed_at, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with lead and deal
  let lead = null;
  let deal = null;
  await Promise.all([
    data?.lead_id
      ? admin.from("leads").select("id, full_name, canonical_phone").eq("id", data.lead_id).maybeSingle()
          .then(({ data: row }) => { lead = row ?? null; })
      : Promise.resolve(),
    data?.deal_id
      ? admin.from("deals").select("id, property_address").eq("id", data.deal_id).maybeSingle()
          .then(({ data: row }) => { deal = row ?? null; })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ task: { ...data, lead, deal } }, { status: 201 });
}
