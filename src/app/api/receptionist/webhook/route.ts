import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { readTextBody } from "@/lib/http";
import {
  processInboundCallLog,
  processInboundSms,
  processMissedCall,
} from "@/lib/receptionist/service";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReceptionistWebhookBody = {
  event_type?: string;
  agent_id?: string;
  from_phone?: string;
  to_phone?: string;
  message_body?: string;
  transcript?: string;
  provider?: string;
  provider_message_id?: string;
  provider_call_id?: string;
  call_status?: string;
};

type ParsedWebhookPayload = {
  body: ReceptionistWebhookBody;
  formParams: URLSearchParams | null;
};

function optionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function resolveAgentId(body: ReceptionistWebhookBody): string | null {
  const fromBody = optionalString(body.agent_id || null);
  if (fromBody && isUuid(fromBody)) return fromBody;

  const intakeAgent = optionalString(process.env.INTAKE_AGENT_ID || null);
  if (intakeAgent && isUuid(intakeAgent)) return intakeAgent;

  return null;
}

function inferEventType(partial: ReceptionistWebhookBody): string {
  const explicit = optionalString(partial.event_type || null);
  if (explicit) return explicit.toLowerCase();

  const messageBody = optionalString(partial.message_body || null);
  const providerMessageId = optionalString(partial.provider_message_id || null);
  if (messageBody || providerMessageId) return "sms_inbound";

  const callStatus = (optionalString(partial.call_status || null) || "").toLowerCase();
  const providerCallId = optionalString(partial.provider_call_id || null);
  const transcript = optionalString(partial.transcript || null);
  if (callStatus || providerCallId || transcript) {
    if (["no-answer", "no_answer", "busy", "failed", "canceled", "cancelled", "missed"].includes(callStatus)) {
      return "missed_call";
    }
    return "call_inbound";
  }

  return "";
}

function parseFormBody(params: URLSearchParams): ReceptionistWebhookBody {
  const callStatus = optionalString(params.get("call_status") || params.get("CallStatus"));

  const body: ReceptionistWebhookBody = {
    event_type: optionalString(params.get("event_type")) || null || undefined,
    agent_id:
      optionalString(params.get("agent_id")) ||
      optionalString(params.get("AgentId")) ||
      undefined,
    from_phone:
      optionalString(params.get("from_phone")) ||
      optionalString(params.get("From")) ||
      undefined,
    to_phone:
      optionalString(params.get("to_phone")) ||
      optionalString(params.get("To")) ||
      undefined,
    message_body:
      optionalString(params.get("message_body")) ||
      optionalString(params.get("Body")) ||
      undefined,
    transcript:
      optionalString(params.get("transcript")) ||
      optionalString(params.get("SpeechResult")) ||
      optionalString(params.get("TranscriptionText")) ||
      undefined,
    provider:
      optionalString(params.get("provider")) ||
      (params.has("MessageSid") || params.has("CallSid") ? "twilio" : undefined),
    provider_message_id:
      optionalString(params.get("provider_message_id")) ||
      optionalString(params.get("MessageSid")) ||
      optionalString(params.get("SmsSid")) ||
      undefined,
    provider_call_id:
      optionalString(params.get("provider_call_id")) ||
      optionalString(params.get("CallSid")) ||
      undefined,
    call_status: callStatus || undefined,
  };

  if (!body.event_type) {
    body.event_type = inferEventType(body) || undefined;
  }

  return body;
}

function parseJsonBody(rawBody: string): ReceptionistWebhookBody | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as ReceptionistWebhookBody;
  } catch {
    return null;
  }
}

function parseIncomingPayload(contentType: string, rawBody: string): ParsedWebhookPayload | null {
  const normalizedType = contentType.toLowerCase();

  if (normalizedType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    return {
      body: parseFormBody(params),
      formParams: params,
    };
  }

  const json = parseJsonBody(rawBody);
  if (!json) return null;
  if (!json.event_type) {
    json.event_type = inferEventType(json) || undefined;
  }

  return {
    body: json,
    formParams: null,
  };
}

function canonicalWebhookUrl(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = optionalString(request.headers.get("x-forwarded-proto"));
  const forwardedHost =
    optionalString(request.headers.get("x-forwarded-host")) ||
    optionalString(request.headers.get("host"));

  if (forwardedProto) {
    url.protocol = `${forwardedProto.split(",")[0].trim()}:`;
  }

  if (forwardedHost) {
    url.host = forwardedHost.split(",")[0].trim();
  }

  return url.toString();
}

function computeTwilioSignature(url: string, params: URLSearchParams, authToken: string): string {
  const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  let payload = url;

  for (const [key, value] of sortedEntries) {
    payload += `${key}${value}`;
  }

  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function twilioSignatureAuthorized(
  request: Request,
  formParams: URLSearchParams | null
): boolean | null {
  const signature = optionalString(request.headers.get("x-twilio-signature"));
  if (!signature) return null;

  if (!formParams) return false;

  const authToken = optionalString(process.env.TWILIO_AUTH_TOKEN || null);
  if (!authToken) return false;

  const expected = computeTwilioSignature(canonicalWebhookUrl(request), formParams, authToken);
  return safeEquals(signature, expected);
}

function sharedSecretAuthorized(
  request: Request,
  allowOpenWithoutSecret: boolean
): boolean {
  const secret = optionalString(process.env.RECEPTIONIST_WEBHOOK_SECRET || null);
  if (!secret) return allowOpenWithoutSecret;

  const header =
    optionalString(request.headers.get("x-receptionist-secret")) ||
    optionalString(request.headers.get("authorization"));

  if (!header) return false;
  if (header === secret) return true;
  if (header === `Bearer ${secret}`) return true;
  return false;
}

function webhookAuthorized(
  request: Request,
  formParams: URLSearchParams | null
): boolean {
  const twilio = twilioSignatureAuthorized(request, formParams);
  if (twilio === true) return true;
  if (twilio === false) {
    return sharedSecretAuthorized(request, false);
  }
  return sharedSecretAuthorized(request, true);
}

export async function POST(request: Request) {
  const bodyRead = await readTextBody(request, { maxBytes: 96 * 1024 });
  if (!bodyRead.ok) {
    return NextResponse.json({ error: bodyRead.error }, { status: bodyRead.status });
  }

  const parsed = parseIncomingPayload(
    request.headers.get("content-type") || "application/json",
    bodyRead.raw
  );

  if (!parsed) {
    return NextResponse.json({ error: "Invalid receptionist webhook payload." }, { status: 400 });
  }

  if (!webhookAuthorized(request, parsed.formParams)) {
    return NextResponse.json({ error: "Unauthorized receptionist webhook." }, { status: 401 });
  }

  const body = parsed.body;
  const eventType = inferEventType(body);
  const agentId = resolveAgentId(body);

  if (!agentId) {
    return NextResponse.json(
      { error: "Agent could not be resolved. Pass agent_id or configure INTAKE_AGENT_ID." },
      { status: 400 }
    );
  }

  const fromPhone = optionalString(body.from_phone || null);
  if (!fromPhone) {
    return NextResponse.json({ error: "from_phone is required." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  try {
    if (eventType === "sms_inbound") {
      const messageBody = optionalString(body.message_body || null);
      if (!messageBody) {
        return NextResponse.json({ error: "message_body is required for sms_inbound." }, { status: 400 });
      }

      const result = await processInboundSms({
        admin,
        agentId,
        fromPhone,
        toPhone: optionalString(body.to_phone || null),
        messageBody,
        providerMessageId: optionalString(body.provider_message_id || null),
        provider: optionalString(body.provider || null),
      });

      return NextResponse.json({ ok: true, event_type: "sms_inbound", result });
    }

    if (eventType === "missed_call") {
      const result = await processMissedCall({
        admin,
        agentId,
        fromPhone,
        toPhone: optionalString(body.to_phone || null),
        providerCallId: optionalString(body.provider_call_id || null),
        provider: optionalString(body.provider || null),
      });

      return NextResponse.json({ ok: true, event_type: "missed_call", result });
    }

    if (eventType === "call_inbound") {
      const result = await processInboundCallLog({
        admin,
        agentId,
        fromPhone,
        toPhone: optionalString(body.to_phone || null),
        transcript: optionalString(body.transcript || null),
        callStatus: optionalString(body.call_status || null),
        providerCallId: optionalString(body.provider_call_id || null),
        provider: optionalString(body.provider || null),
      });

      return NextResponse.json({ ok: true, event_type: "call_inbound", result });
    }

    return NextResponse.json(
      {
        error: "Unsupported event_type. Use sms_inbound, missed_call, or call_inbound.",
      },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receptionist webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
