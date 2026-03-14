import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { mergeOnboardingIntoAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();
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

  const nextSettings = mergeOnboardingIntoAgentSettings(agentRow?.settings || null, {
    has_completed_onboarding: true,
    completed_at: new Date().toISOString(),
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

  return NextResponse.json({ ok: true });
}
