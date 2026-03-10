import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseServer } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  status?: "open" | "done" | "dismissed";
};

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as PatchBody;
  const status = body.status;

  if (!status || !["open", "done", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "status must be one of: open, done, dismissed." }, { status: 400 });
  }

  const selection = "id,lead_id,person_id,reason_code,title,description,priority,status,due_at,created_at";

  const { data: ownerData, error: ownerError } = await supabase
    .from("lead_recommendations")
    .update({ status })
    .eq("id", id)
    .eq("owner_user_id", auth.context.user.id)
    .select(selection)
    .maybeSingle();

  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 500 });
  if (ownerData) return NextResponse.json({ recommendation: ownerData });
  return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
}
