import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import {
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

  if (!onboardingState.has_seeded_sample_workspace_data) {
    try {
      await seedSampleWorkspaceForAgent(admin, auth.context.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not seed sample workspace data.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const nextSettings = mergeOnboardingIntoAgentSettings(agentRow?.settings || null, {
    has_completed_onboarding: true,
    completed_at: new Date().toISOString(),
    has_seeded_sample_workspace_data: true,
  });

  const { error } = await supabase
    .from("agents")
    .update({ settings: nextSettings })
    .eq("id", auth.context.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/app");
  revalidatePath("/app/onboarding");
  revalidatePath("/app/intake");
  revalidatePath("/app/deals");
  revalidatePath("/app/priorities");

  return NextResponse.json({ ok: true, seeded_sample_workspace_data: true });
}
