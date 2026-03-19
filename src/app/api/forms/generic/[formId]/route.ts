import { NextResponse } from "next/server";
import { getClientIp, parseJsonBody } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildSyntheticLeadHandle } from "@/lib/leads/identity";

type SubmitBody = {
  answers?: Record<string, string> | null;
};

const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

function optStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Heuristic: find a value for common contact fields from question labels
function extractContact(
  questions: Array<{ id: string; label: string }>,
  answers: Record<string, string>
) {
  let name: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;

  for (const q of questions) {
    const label = q.label.toLowerCase();
    const val = optStr(answers[q.id]);
    if (!val) continue;

    if (!name && (label.includes("name") || label.includes("contact"))) {
      name = val;
    } else if (!phone && (label.includes("phone") || label.includes("mobile") || label.includes("cell"))) {
      phone = val;
    } else if (!email && (label.includes("email") || label.includes("e-mail"))) {
      email = val;
    }
  }

  return { name, phone, email };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const ip = getClientIp(request);

  const rate = await takeRateLimit({
    key: `generic_form:${ip}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      }
    );
  }

  const parsedBody = await parseJsonBody<SubmitBody>(request, { maxBytes: 32 * 1024 });
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const answers = parsedBody.data.answers || {};
  const admin = supabaseAdmin();

  // Load the form to verify it exists and get question labels
  const { data: form } = await admin
    .from("generic_forms")
    .select("id, agent_id, title, questions")
    .eq("id", formId)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 });
  }

  const agentId = form.agent_id as string;
  const questions = (form.questions as Array<{ id: string; label: string }>) || [];

  // Store raw submission
  const { error: submissionError } = await admin.from("generic_form_submissions").insert({
    form_id: formId,
    submission_data: answers,
    ip_address: ip,
  });

  if (submissionError) {
    return NextResponse.json(
      { error: submissionError.message || "Could not store submission." },
      { status: 500 }
    );
  }

  // Create a lead so the submission appears in the pipeline
  const { name, phone, email } = extractContact(questions, answers);

  if (name || phone || email) {
    const identity = email
      ? `email_${email}`
      : phone
        ? `phone_${phone}`
        : `name_${(name || "").toLowerCase()}`;
    const igHandle = buildSyntheticLeadHandle("generic_form", identity);
    const nowIso = new Date().toISOString();

    const { error: leadError } = await admin.from("leads").upsert(
      {
        agent_id: agentId,
        owner_user_id: agentId,
        assignee_user_id: agentId,
        ig_username: igHandle,
        full_name: name,
        canonical_email: email || null,
        raw_email: email || null,
        canonical_phone: phone || null,
        raw_phone: phone || null,
        stage: "New",
        lead_temp: "Warm",
        source: "generic_form",
        first_source_method: "api",
        latest_source_method: "api",
        source_confidence: email || phone ? "exact" : "unknown",
        first_source_channel: "other",
        latest_source_channel: "other",
        time_last_updated: nowIso,
        custom_fields: {
          form_id: formId,
          form_title: form.title,
          form_answers: answers,
        },
      },
      { onConflict: "agent_id,ig_username" }
    );

    if (leadError) {
      // Non-fatal: submission is already stored
      console.warn("[generic_form] lead upsert failed", leadError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
