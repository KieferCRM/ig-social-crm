import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeConsent } from "@/lib/consent";
import { applyLeadCreatedRules, listActiveLeadCreatedRules } from "@/lib/automation-rules";

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("leads")
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,intent,timeline,last_message_preview,next_step")
    .or(ownerFilter(auth.context))
    .order("ig_username", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data || [] });
}

type CreateLeadBody = {
  ig_username?: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  tags?: string | null;
  external_id?: string | null;
  stage?: string | null;
  lead_temp?: string | null;
  source?: string | null;
  intent?: string | null;
  timeline?: string | null;
  notes?: string | null;
  consent_to_email?: boolean | string | null;
  consent_to_sms?: boolean | string | null;
  consent_source?: string | null;
  consent_timestamp?: string | null;
  consent_text_snapshot?: string | null;
};

type UpdateLeadBody = {
  id?: string;
  stage?: string | null;
};

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function syntheticIgUsername(identity: string): string {
  return `manual_lead_${shortHash(identity)}`;
}

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = supabaseAdmin();

  const body = (await request.json()) as CreateLeadBody;
  const rawHandle = optionalString(body.ig_username) || "";
  const ig = normalizeHandle(rawHandle);
  const email = normalizeEmail(optionalString(body.email) || "");
  const phone = normalizePhone(optionalString(body.phone) || "");
  const externalId = (optionalString(body.external_id) || "").toLowerCase();
  const firstName = optionalString(body.first_name) || "";
  const lastName = optionalString(body.last_name) || "";
  const fullName = optionalString(body.full_name) || "";
  const tags = optionalString(body.tags) || "";
  const displayName = fullName || `${firstName} ${lastName}`.trim();
  const identity =
    (ig ? `ig_${ig}` : "") ||
    (email ? `email_${email}` : "") ||
    (phone ? `phone_${phone}` : "") ||
    (externalId ? `ext_${externalId}` : "") ||
    (displayName ? `name_${displayName.toLowerCase()}` : "");
  const resolvedIg = ig || syntheticIgUsername(identity || "manual_lead");

  if (!identity) {
    return NextResponse.json(
      { error: "Provide one identity value: ig_username, email, phone, external_id, or full_name." },
      { status: 400 }
    );
  }

  const sourceDetail: Record<string, string> = {};
  if (firstName) sourceDetail.first_name = firstName;
  if (lastName) sourceDetail.last_name = lastName;
  if (fullName) sourceDetail.full_name = fullName;
  if (email) sourceDetail.email = email;
  if (phone) sourceDetail.phone = phone;
  if (tags) sourceDetail.tags = tags;
  if (externalId) sourceDetail.external_id = externalId;
  sourceDetail.manual_identity = identity;

  const nowIso = new Date().toISOString();
  const source = optionalString(body.source) || "manual";
  const consent = normalizeConsent({
    source,
    consent_to_email: body.consent_to_email,
    consent_to_sms: body.consent_to_sms,
    consent_source: body.consent_source,
    consent_timestamp: body.consent_timestamp,
    consent_text_snapshot: body.consent_text_snapshot,
    nowIso,
  });

  const payload: Record<string, unknown> = {
    agent_id: auth.context.user.id,
    owner_user_id: auth.context.user.id,
    assignee_user_id: auth.context.user.id,
    ig_username: resolvedIg,
    stage: optionalString(body.stage) || "New",
    lead_temp: optionalString(body.lead_temp) || "Warm",
    source,
    time_last_updated: nowIso,
    latest_source_method: "manual",
    first_source_method: "manual",
    source_confidence: ig || email || phone ? "exact" : "unknown",
    source_detail: sourceDetail,
    raw_email: email || null,
    raw_phone: phone || null,
    canonical_email: email || null,
    canonical_phone: phone || null,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || displayName || null,
    source_ref_id: externalId || null,
    consent_to_email: consent.consent_to_email,
    consent_to_sms: consent.consent_to_sms,
    consent_source: consent.consent_source,
    consent_timestamp: consent.consent_timestamp,
    consent_text_snapshot: consent.consent_text_snapshot,
    custom_fields: {},
  };

  const intent = optionalString(body.intent);
  const timeline = optionalString(body.timeline);
  const notes = optionalString(body.notes);

  if (intent) payload.intent = intent;
  if (timeline) payload.timeline = timeline;
  if (notes) payload.notes = notes;

  const { data: existedLead } = await supabase
    .from("leads")
    .select("id")
    .eq("agent_id", auth.context.user.id)
    .eq("ig_username", resolvedIg)
    .maybeSingle();

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "agent_id,ig_username" })
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,time_last_updated")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!existedLead?.id) {
    const rules = await listActiveLeadCreatedRules(admin, auth.context);
    if (rules.length > 0) {
      await applyLeadCreatedRules(admin, auth.context, {
        id: data.id,
        ig_username: data.ig_username || null,
        stage: data.stage || null,
        lead_temp: data.lead_temp || null,
      }, rules);
    }
  }

  return NextResponse.json({ lead: data });
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as UpdateLeadBody;
  const id = optionalString(body.id) || "";
  const stage = optionalString(body.stage) || "";

  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (!stage || !ALLOWED_STAGES.has(stage)) {
    return NextResponse.json({ error: "stage is invalid." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      stage,
      time_last_updated: new Date().toISOString(),
    })
    .eq("id", id)
    .or(ownerFilter(auth.context))
    .select("id,ig_username,owner_user_id,assignee_user_id,stage,lead_temp,source,time_last_updated")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "lead not found." }, { status: 404 });

  return NextResponse.json({ lead: data });
}
