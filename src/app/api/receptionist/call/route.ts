import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { loadAccessContext } from "@/lib/access-context";
import { startCrmBridgeCall } from "@/lib/receptionist/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type Body = {
  lead_id?: string;
};

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 8 * 1024 });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const leadId = (parsed.data.lead_id || "").trim();
  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required." }, { status: 400 });
  }

  try {
    const admin = supabaseAdmin();
    const result = await startCrmBridgeCall({
      admin,
      agentId: auth.context.user.id,
      leadId,
    });

    return NextResponse.json({
      interaction: result.interaction,
      call: {
        ok: result.call.ok,
        status: result.call.status,
        provider: result.call.provider,
        provider_call_id: result.call.providerCallId,
        error: result.call.error,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start click-to-call bridge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
