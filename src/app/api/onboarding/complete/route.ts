import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import {
  type AccountType,
  mergeOnboardingIntoAgentSettings,
  readOnboardingStateFromAgentSettings,
} from "@/lib/onboarding";
import { seedSampleWorkspaceForAgent } from "@/lib/sample-workspace";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const auth = await loadAccessContext(supabase);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: agentRow, error: agentError } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
  const accountType = onboardingState.account_type;

  if (!accountType) {
    return NextResponse.json(
      { error: "Choose your account type before entering the workspace." },
      { status: 400 }
    );
  }

  const alreadyInitialized =
    onboardingState.has_completed_onboarding && onboardingState.has_seeded_sample_workspace_data;

  if (alreadyInitialized) {
    return NextResponse.json({
      ok: true,
      already_initialized: true,
      seeded_sample_workspace_data: false,
    });
  }

  let seededSampleWorkspaceData = false;

  if (!onboardingState.has_seeded_sample_workspace_data) {
    try {
      await seedSampleWorkspaceForAgent(admin, auth.context.user.id, accountType as AccountType);
      seededSampleWorkspaceData = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not seed sample workspace data.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const nextSettings = mergeOnboardingIntoAgentSettings(agentRow?.settings || null, {
    has_completed_onboarding: true,
    completed_at: new Date().toISOString(),
    has_seeded_sample_workspace_data: true,
    account_type: accountType,
    account_type_selected_at:
      onboardingState.account_type_selected_at || new Date().toISOString(),
  });

  const { error } = await supabase
    .from("agents")
    .update({ settings: nextSettings })
    .eq("id", auth.context.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (seededSampleWorkspaceData || !onboardingState.has_completed_onboarding) {
    revalidatePath("/app");
    revalidatePath("/app/intake");
    revalidatePath("/app/deals");
    revalidatePath("/app/priorities");
  }

  return NextResponse.json({
    ok: true,
    already_initialized: false,
    seeded_sample_workspace_data: seededSampleWorkspaceData,
    account_type: accountType,
  });
}
