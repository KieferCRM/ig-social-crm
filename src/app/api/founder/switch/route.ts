import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mergeOnboardingIntoAgentSettings, type AccountType, ACCOUNT_TYPE_VALUES } from "@/lib/onboarding";
import { type BillingTier, voiceTierForBillingTier } from "@/lib/billing";
import { RECEPTIONIST_SETTINGS_KEY } from "@/lib/receptionist/settings";

export const dynamic = "force-dynamic";

const BILLING_TIERS: BillingTier[] = ["core_crm", "secretary_sms", "secretary_voice"];

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify founder role
  const admin = supabaseAdmin();
  const { data: agent } = await admin
    .from("agents")
    .select("role, settings, billing_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (agent?.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { account_type?: string; billing_tier?: string };

  let newSettings = (agent.settings ?? {}) as Record<string, unknown>;
  const updatePayload: Record<string, unknown> = {};

  // Switch account type
  if (body.account_type) {
    if (!(ACCOUNT_TYPE_VALUES as readonly string[]).includes(body.account_type)) {
      return NextResponse.json({ error: "Invalid account_type" }, { status: 400 });
    }
    newSettings = mergeOnboardingIntoAgentSettings(newSettings, {
      account_type: body.account_type as AccountType,
      has_completed_onboarding: true,
    });
    updatePayload.settings = newSettings;
  }

  // Switch billing tier
  if (body.billing_tier) {
    if (!BILLING_TIERS.includes(body.billing_tier as BillingTier)) {
      return NextResponse.json({ error: "Invalid billing_tier" }, { status: 400 });
    }
    const tier = body.billing_tier as BillingTier;
    const voiceTier = voiceTierForBillingTier(tier);

    // Update voice_tier in receptionist settings
    const currentReceptionist = (newSettings[RECEPTIONIST_SETTINGS_KEY] ?? {}) as Record<string, unknown>;
    newSettings = {
      ...newSettings,
      [RECEPTIONIST_SETTINGS_KEY]: {
        ...currentReceptionist,
        voice_tier: voiceTier,
        receptionist_enabled: tier !== "core_crm",
        communications_enabled: tier !== "core_crm",
      },
    };
    updatePayload.billing_tier = tier;
    updatePayload.settings = newSettings;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin
    .from("agents")
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// GET — return current founder state
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: agent } = await admin
    .from("agents")
    .select("role, billing_tier, settings")
    .eq("id", user.id)
    .maybeSingle();

  if (agent?.role !== "founder") {
    return NextResponse.json({ isFounder: false });
  }

  const settings = (agent.settings ?? {}) as Record<string, unknown>;
  const onboarding = (settings.onboarding ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    isFounder: true,
    account_type: onboarding.account_type ?? null,
    billing_tier: agent.billing_tier ?? "core_crm",
  });
}
