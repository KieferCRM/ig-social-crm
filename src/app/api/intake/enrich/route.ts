import { after } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseJsonBody, getClientIp } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { scoreLeadWithClaude } from "@/lib/leads/motivation-scorer";

type EnrichBody = {
  lead_id: string;
  // Top-level lead fields
  email?: string | null;
  intent?: string | null;
  timeline?: string | null;
  budget_range?: string | null;
  location_area?: string | null;
  notes?: string | null;
  // Stored in custom_fields
  property_address?: string | null;
  property_type?: string | null;
  financing_status?: string | null;
  asking_price?: string | null;
  motivation?: string | null;
  decision_makers?: string | null;
  contact_preference?: string | null;
  referral_source?: string | null;
  blocker?: string | null;
};

function optStr(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = await takeRateLimit({ key: `enrich:${ip}`, limit: 20, windowMs: 60_000 });
  if (!limited.allowed) {
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

  if (optStr(body.email)) update.canonical_email = optStr(body.email)!.toLowerCase();
  if (optStr(body.intent)) update.intent = optStr(body.intent);
  if (optStr(body.timeline)) update.timeline = optStr(body.timeline);
  if (optStr(body.budget_range)) update.budget_range = optStr(body.budget_range);
  if (optStr(body.location_area)) update.location_area = optStr(body.location_area);

  // Motivation goes into notes so it's visible on the lead record
  if (optStr(body.motivation)) update.notes = optStr(body.motivation);
  else if (optStr(body.notes)) update.notes = optStr(body.notes);

  // All enrichment fields go into custom_fields
  const existingCustom = (existing.custom_fields as Record<string, unknown>) || {};
  const newCustom: Record<string, unknown> = { ...existingCustom };

  const customFieldMap: Array<[keyof EnrichBody, string]> = [
    ["property_address", "property_address"],
    ["property_type", "property_type"],
    ["financing_status", "financing_status"],
    ["asking_price", "asking_price"],
    ["motivation", "motivation"],
    ["decision_makers", "decision_makers"],
    ["contact_preference", "contact_preference"],
    ["referral_source", "referral_source"],
    ["blocker", "blocker"],
  ];

  for (const [bodyKey, customKey] of customFieldMap) {
    const val = optStr(body[bodyKey] as string | null | undefined);
    if (val) newCustom[customKey] = val;
  }

  update.custom_fields = newCustom;

  const { error: updateError } = await admin
    .from("leads")
    .update(update)
    .eq("id", leadId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Fire Claude scoring after response is sent — user never waits
  after(async () => {
    await scoreLeadWithClaude(leadId);
  });

  return NextResponse.json({ ok: true });
}
