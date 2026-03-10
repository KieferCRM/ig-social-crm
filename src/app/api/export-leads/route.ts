import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  // Prevent spreadsheet formula execution on open.
  const trimmedStart = s.trimStart();
  if (/^[=+\-@]/.test(trimmedStart) || trimmedStart.startsWith("\t")) {
    s = `'${s}`;
  }

  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("leads")
    .select(
      "ig_username,intent,timeline,budget_range,location_area,contact_preference,next_step,lead_temp,source,notes,stage,time_last_updated,last_message_preview,owner_user_id,assignee_user_id,first_source_channel,latest_source_channel,source_confidence"
    )
    .or(ownerFilter(auth.context))
    .order("time_last_updated", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "ig_username",
    "intent",
    "timeline",
    "budget_range",
    "location_area",
    "contact_preference",
    "next_step",
    "lead_temp",
    "source",
    "notes",
    "stage",
    "time_last_updated",
    "last_message_preview",
    "owner_user_id",
    "assignee_user_id",
    "first_source_channel",
    "latest_source_channel",
    "source_confidence",
  ];

  const lines = [headers.join(",")];

  for (const row of data || []) {
    lines.push(headers.map((h) => csvEscape((row as Record<string, unknown>)[h])).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=leads-export.csv",
    },
  });
}
