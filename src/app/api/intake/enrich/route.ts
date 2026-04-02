import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseJsonBody } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";

type EnrichBody = {
  lead_id: string;
  email?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  notes?: string | null;
  // stored in custom_fields
  property_address?: string | null;
  property_type?: string | null;
  financing_status?: string | null;
  asking_price?: string | null;
};

function optStr(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = await takeRateLimit(`enrich:${ip}`, 20, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = await parseJsonBody<EnrichBody>(request, { maxBytes: 16 * 1024 });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.data || {};
  const leadId = optStr(body.lead_id);
  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Verify the lead exists before updating
  const { data: existing, error: fetchError } = await admin
    .from("leads")
    .select("id, custom_fields")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const update: Record<string, unknown> = {
    time_last_updated: new Date().toISOString(),
  };

  if (optStr(body.email)) {
    update.canonical_email = optStr(body.email)!.toLowerCase();
  }
  if (optStr(body.intent)) update.intent = optStr(body.intent);
  if (optStr(body.timeline)) update.timeline = optStr(body.timeline);
  if (optStr(body.budget_range)) update.budget_range = optStr(body.budget_range);
  if (optStr(body.location_area)) update.location_area = optStr(body.location_area);
  if (optStr(body.notes)) update.notes = optStr(body.notes);

  // Extra fields go into custom_fields
  const existingCustom = (existing.custom_fields as Record<string, unknown>) || {};
  const newCustom: Record<string, unknown> = { ...existingCustom };
  if (optStr(body.property_address)) newCustom.property_address = optStr(body.property_address);
  if (optStr(body.property_type)) newCustom.property_type = optStr(body.property_type);
  if (optStr(body.financing_status)) newCustom.financing_status = optStr(body.financing_status);
  if (optStr(body.asking_price)) newCustom.asking_price = optStr(body.asking_price);

  if (Object.keys(newCustom).length > 0) {
    update.custom_fields = newCustom;
  }

  const { error: updateError } = await admin
    .from("leads")
    .update(update)
    .eq("id", leadId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
