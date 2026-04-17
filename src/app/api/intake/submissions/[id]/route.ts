import { NextResponse } from "next/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Verify the lead belongs to this agent before deleting
  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .or(ownerFilter(auth.context, "agent_id"))
    .maybeSingle();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead not found or access denied." }, { status: 404 });
  }

  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not delete lead." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
