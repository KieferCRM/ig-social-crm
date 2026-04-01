/**
 * PATCH /api/tasks/[id]
 *
 * Authenticated. Marks a lead_recommendation as done or dismissed.
 * Sets completed_at timestamp on completion.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
type Body = {
  status?: "done" | "dismissed";
  title?: string;
  due_at?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  deal_id?: string | null;
};

const ALLOWED_PRIORITIES = new Set(["urgent", "high", "medium", "low"]);

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 4096 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { status, title, due_at, priority, deal_id } = parsed.data;
  const agentId = auth.context.user.id;
  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const ownerClause = `owner_user_id.eq.${agentId},agent_id.eq.${agentId}`;

  // Status transition (mark done / dismissed)
  if (status !== undefined) {
    if (!["done", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const update: Record<string, unknown> = { status, updated_at: now };
    if (status === "done") update.completed_at = now;
    const { error } = await admin
      .from("lead_recommendations")
      .update(update)
      .eq("id", id)
      .or(ownerClause);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Field edit (title / due_at / priority)
  const update: Record<string, unknown> = { updated_at: now };

  if (title !== undefined) {
    const trimmed = title.trim();
    if (!trimmed) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = trimmed;
  }
  if (due_at !== undefined) {
    const d = new Date(due_at);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    update.due_at = d.toISOString();
  }
  if (priority !== undefined) {
    if (!ALLOWED_PRIORITIES.has(priority)) return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    update.priority = priority;
  }
  if (deal_id !== undefined) {
    update.deal_id = deal_id || null;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("lead_recommendations")
    .update(update)
    .eq("id", id)
    .or(ownerClause)
    .select("id, title, description, priority, status, due_at, reason_code, metadata, lead_id, deal_id, completed_at, created_at, updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, task: data });
}
