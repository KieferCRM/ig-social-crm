import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string; itemId: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId, itemId } = await params;
  const body = await req.json().catch(() => ({})) as { completed?: boolean; label?: string };

  const patch: Record<string, unknown> = {};
  if (typeof body.completed === "boolean") {
    patch.completed = body.completed;
    patch.completed_at = body.completed ? new Date().toISOString() : null;
  }
  if (typeof body.label === "string" && body.label.trim()) {
    patch.label = body.label.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("deal_checklist_items")
    .update(patch)
    .eq("id", itemId)
    .eq("deal_id", dealId)
    .eq("agent_id", user.id)
    .select("id, label, completed, completed_at, sort_order, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; itemId: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId, itemId } = await params;

  const { error } = await supabase
    .from("deal_checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("deal_id", dealId)
    .eq("agent_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
