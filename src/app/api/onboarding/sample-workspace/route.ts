import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { clearSampleWorkspaceForAgent } from "@/lib/sample-workspace";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const auth = await loadAccessContext(supabase);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await clearSampleWorkspaceForAgent(admin, auth.context.user.id);

    revalidatePath("/app");
    revalidatePath("/app/intake");
    revalidatePath("/app/deals");
    revalidatePath("/app/priorities");
    revalidatePath("/app/onboarding");

    return NextResponse.json({ ok: true, removed: result.removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not clear sample workspace data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
