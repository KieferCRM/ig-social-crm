import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http";
import { loadAccessContext } from "@/lib/access-context";
import { sendManualSmsFromCrm } from "@/lib/receptionist/service";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ leadId: string }>;
};

type Body = {
  text?: string;
};

export async function POST(request: Request, { params }: Params) {
  const { leadId } = await params;
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 24 * 1024 });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const text = (parsed.data.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }

  try {
    const admin = supabaseAdmin();
    const result = await sendManualSmsFromCrm({
      admin,
      agentId: auth.context.user.id,
      leadId,
      text,
    });

    return NextResponse.json({
      interaction: result.interaction,
      delivery: {
        ok: result.sms.ok,
        status: result.sms.status,
        provider: result.sms.provider,
        provider_message_id: result.sms.providerMessageId,
        error: result.sms.error,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send CRM text.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
