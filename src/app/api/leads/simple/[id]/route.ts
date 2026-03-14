import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";
import { withReminderOwnerColumn } from "@/lib/reminders";
import { normalizeLeadEmail, normalizeLeadPhone } from "@/lib/leads/identity";

type Params = {
  params: Promise<{ id: string }>;
};

type ReminderRow = {
  id: string;
  due_at: string | null;
  status: "pending" | "done" | string | null;
  note?: string | null;
};

type LeadPatchBody = {
  full_name?: string | null;
  canonical_email?: string | null;
  canonical_phone?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  contact_preference?: string | null;
  next_step?: string | null;
  source?: string | null;
  notes?: string | null;
  deal_price?: number | string | null;
  commission_percent?: number | string | null;
  commission_amount?: number | string | null;
  close_date?: string | null;
};

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);
const ALLOWED_TEMPS = new Set(["Cold", "Warm", "Hot"]);

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableDecimal(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "invalid";
    return value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return "invalid";
    return parsed > 0 ? parsed : null;
  }
  return "invalid";
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leadSelections = [
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,created_at,source_detail,custom_fields,deal_price,commission_percent,commission_amount,close_date",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,source_detail,custom_fields,deal_price,commission_percent,commission_amount,close_date",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,created_at,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,next_step,notes,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,created_at",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,next_step,notes,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,created_at,source_detail,custom_fields",
    "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,next_step,notes,last_message_preview,time_last_updated",
  ];
  const ownerColumns = ["agent_id", "owner_user_id", "assignee_user_id"] as const;

  let lead: Record<string, unknown> | null = null;
  let leadError: string | null = null;

  for (const select of leadSelections) {
    for (const ownerColumn of ownerColumns) {
      const { data, error } = await supabase
        .from("leads")
        .select(select)
        .eq("id", id)
        .or(ownerFilter(auth.context, ownerColumn))
        .maybeSingle();

      if (!error) {
        lead = (data as Record<string, unknown> | null) || null;
        leadError = null;
        if (lead) break;
        continue;
      }
      leadError = error.message;
    }
    if (lead) break;
  }

  if (leadError) {
    return NextResponse.json({ error: leadError }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { data: reminderData } = await withReminderOwnerColumn((ownerColumn) =>
    supabase
      .from("follow_up_reminders")
      .select("id,due_at,status,note")
      .eq(ownerColumn, auth.context.user.id)
      .eq("lead_id", id)
      .order("due_at", { ascending: true })
      .limit(20)
  );

  const reminders = ((reminderData || []) as ReminderRow[]).map((item) => ({
    id: item.id,
    due_at: item.due_at || "",
    status: item.status || "pending",
    note: item.note || null,
  }));

  return NextResponse.json({ lead, reminders });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<LeadPatchBody>(request, {
    maxBytes: 32 * 1024,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.data || {};
  const update: Record<string, unknown> = {
    time_last_updated: new Date().toISOString(),
  };

  const has = (key: keyof LeadPatchBody): boolean =>
    Object.prototype.hasOwnProperty.call(body, key);

  if (has("full_name")) update.full_name = optionalString(body.full_name);

  if (has("canonical_email")) update.canonical_email = normalizeLeadEmail(body.canonical_email);

  if (has("canonical_phone")) update.canonical_phone = normalizeLeadPhone(body.canonical_phone);

  if (has("stage")) {
    const stage = optionalString(body.stage);
    if (!stage || !ALLOWED_STAGES.has(stage)) {
      return NextResponse.json({ error: "stage is invalid." }, { status: 400 });
    }
    update.stage = stage;
  }

  if (has("lead_temp")) {
    const leadTemp = optionalString(body.lead_temp);
    if (!leadTemp || !ALLOWED_TEMPS.has(leadTemp)) {
      return NextResponse.json({ error: "lead_temp is invalid." }, { status: 400 });
    }
    update.lead_temp = leadTemp;
  }

  if (has("intent")) update.intent = optionalString(body.intent);
  if (has("timeline")) update.timeline = optionalString(body.timeline);
  if (has("budget_range")) update.budget_range = optionalString(body.budget_range);
  if (has("location_area")) update.location_area = optionalString(body.location_area);
  if (has("contact_preference")) update.contact_preference = optionalString(body.contact_preference);
  if (has("next_step")) update.next_step = optionalString(body.next_step);
  if (has("source")) update.source = optionalString(body.source);
  if (has("notes")) update.notes = optionalString(body.notes);

  if (has("deal_price")) {
    const parsedPrice = parseNullableDecimal(body.deal_price);
    if (parsedPrice === "invalid") {
      return NextResponse.json({ error: "deal_price must be a valid number." }, { status: 400 });
    }
    update.deal_price = parsedPrice;
  }

  if (has("commission_percent")) {
    const parsedPercent = parseNullableDecimal(body.commission_percent);
    if (parsedPercent === "invalid") {
      return NextResponse.json(
        { error: "commission_percent must be a valid number." },
        { status: 400 }
      );
    }
    update.commission_percent = parsedPercent;
  }

  if (has("commission_amount")) {
    const parsedAmount = parseNullableDecimal(body.commission_amount);
    if (parsedAmount === "invalid") {
      return NextResponse.json(
        { error: "commission_amount must be a valid number." },
        { status: 400 }
      );
    }
    update.commission_amount = parsedAmount;
  }

  if (has("close_date")) {
    const closeDate = optionalString(body.close_date);
    if (!closeDate) {
      update.close_date = null;
    } else {
      const date = new Date(closeDate);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "close_date is invalid." }, { status: 400 });
      }
      update.close_date = date.toISOString().slice(0, 10);
    }
  }

  const ownerClause = [
    ownerFilter(auth.context, "agent_id"),
    ownerFilter(auth.context, "owner_user_id"),
    ownerFilter(auth.context, "assignee_user_id"),
  ].join(",");

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", id)
    .or(ownerClause)
    .select(
      "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,stage,lead_temp,source,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,last_communication_at,urgency_level,urgency_score,created_at,source_detail,custom_fields,deal_price,commission_percent,commission_amount,close_date"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ lead: data });
}
