import { NextResponse } from "next/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { supabaseServer } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,source_detail,custom_fields"
    )
    .eq("id", id)
    .or(ownerFilter(auth.context))
    .maybeSingle();

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { data: reminders, error: reminderError } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .select("id,lead_id,due_at,status,note,created_at")
      .eq("lead_id", id)
      .or(ownerFilter(auth.context, ownerColumn))
      .order("due_at", { ascending: true })
  );

  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }

  return NextResponse.json({ lead, reminders: reminders || [] });
}
