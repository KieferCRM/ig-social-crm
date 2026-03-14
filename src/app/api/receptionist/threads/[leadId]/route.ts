import { NextResponse } from "next/server";
import { loadAccessContext } from "@/lib/access-context";
import { getLeadCommunicationThread, loadAgentReceptionistContext } from "@/lib/receptionist/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ leadId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { leadId } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();

  try {
    const [thread, context] = await Promise.all([
      getLeadCommunicationThread({
        admin,
        agentId: auth.context.user.id,
        leadId,
      }),
      loadAgentReceptionistContext(admin, auth.context.user.id),
    ]);

    if (!thread) {
      return NextResponse.json({ error: "Lead thread not found." }, { status: 404 });
    }

    return NextResponse.json({
      thread,
      channel: {
        receptionist_enabled: context.settings.receptionist_enabled,
        communications_enabled: context.settings.communications_enabled,
        business_phone_number: context.settings.business_phone_number,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load communication thread.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
