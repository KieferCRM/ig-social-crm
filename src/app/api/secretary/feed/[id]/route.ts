import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const agentId = auth.context.user.id;

  const { error } = await admin
    .from("lead_interactions")
    .delete()
    .eq("id", id)
    .eq("agent_id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
