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
type Body = { status?: "done" | "dismissed" };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 1024 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const newStatus = parsed.data.status ?? "done";
  if (!["done", "dismissed"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const agentId = auth.context.user.id;
  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
  };
  if (newStatus === "done") {
    update.completed_at = now;
  }

  const { error } = await admin
    .from("lead_recommendations")
    .update(update)
    .eq("id", id)
    .or(`owner_user_id.eq.${agentId},agent_id.eq.${agentId}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
