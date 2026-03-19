import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function optStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function optNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = await takeRateLimit({
    key: `seller-property:${ip}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const leadId = optStr(body.lead_id);
  if (!leadId || !isUuid(leadId)) {
    return NextResponse.json({ error: "Invalid lead_id." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: lead, error: fetchError } = await admin
    .from("leads")
    .select("id, custom_fields")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const existing =
    lead.custom_fields && typeof lead.custom_fields === "object" && !Array.isArray(lead.custom_fields)
      ? (lead.custom_fields as Record<string, unknown>)
      : {};

  const propertyDetails: Record<string, unknown> = {
    property_type: optStr(body.property_type),
    owners_on_title: optNum(body.owners_on_title),
    beds: optNum(body.beds),
    baths: optNum(body.baths),
    sq_footage: optNum(body.sq_footage),
    water_type: optStr(body.water_type),
    sewage_type: optStr(body.sewage_type),
    property_condition: optStr(body.property_condition),
    reason_for_selling: optStr(body.reason_for_selling),
    property_notes: optStr(body.property_notes),
    full_details_received: true,
  };

  // Remove nulls to avoid overwriting existing values with null
  for (const key of Object.keys(propertyDetails)) {
    if (propertyDetails[key] === null) delete propertyDetails[key];
  }

  const updatedCustomFields = { ...existing, ...propertyDetails };

  const { error: updateError } = await admin
    .from("leads")
    .update({
      custom_fields: updatedCustomFields,
      time_last_updated: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    console.warn("[seller-property-details] update failed", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
