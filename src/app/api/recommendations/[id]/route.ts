import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type Params = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  status?: "open" | "done" | "dismissed";
};

const ALLOWED_STATUS = new Set(["open", "done", "dismissed"]);

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedBody = await parseJsonBody<PatchBody>(request, { maxBytes: 8 * 1024 });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const status = parsedBody.data.status;
  if (!status || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_recommendations")
    .update({ status })
    .eq("id", id)
    .or(ownerFilter(auth.context, "owner_user_id"))
    .select("id,lead_id,person_id,reason_code,title,description,priority,status,due_at,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });

  return NextResponse.json({ recommendation: data });
}
