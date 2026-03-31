import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { WORKSPACE_DOCUMENT_BUCKET } from "@/lib/workspace-settings";
import { writeDealEvent, writeLeadRecommendation } from "@/lib/crm-events";

export const dynamic = "force-dynamic";

// ─── Postmark inbound payload types ───────────────────────────────────────────

type PostmarkAttachment = {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
};

type PostmarkInboundMessage = {
  MessageID?: string;
  From?: string;
  FromName?: string;
  To?: string;
  ToFull?: Array<{ Email?: string; MailboxHash?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  Attachments?: PostmarkAttachment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSlug(to: string): string | null {
  // sarah@inbox.lockboxhq.com → "sarah"
  const match = to.match(/^([^@+]+)/);
  return match?.[1]?.toLowerCase() ?? null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ─── Claude email processor ───────────────────────────────────────────────────

type EmailAnalysis = {
  summary: string;
  action: "created_lead" | "updated_deal" | "logged_note" | "stored_document" | "none";
  is_transcript: boolean;
  contact_name: string | null;
  contact_intent: "buyer" | "seller" | "both" | null;
  property_address: string | null;
  deal_address_hint: string | null; // fuzzy match hint for existing deals
  lead_name_hint: string | null;
  note: string | null;
};

async function analyzeEmail(
  subject: string,
  body: string,
  attachmentNames: string[],
  apiKey: string,
): Promise<EmailAnalysis> {
  const client = new Anthropic({ apiKey });

  const prompt = `You are processing an email received by a real estate agent's CRM inbox.

Subject: ${subject}
Body:
${body.slice(0, 3000)}
${attachmentNames.length > 0 ? `\nAttachments: ${attachmentNames.join(", ")}` : ""}

Analyze this email and respond with a JSON object (no markdown, raw JSON only):
{
  "summary": "one sentence describing what this email is and what action was taken",
  "action": "created_lead" | "updated_deal" | "logged_note" | "stored_document" | "none",
  "is_transcript": true | false,
  "contact_name": "full name of the person this email is about or from, else null",
  "contact_intent": "buyer" | "seller" | "both" | null,
  "property_address": "property address if mentioned, else null",
  "deal_address_hint": "partial address to fuzzy-match an existing deal, else null",
  "lead_name_hint": "name to fuzzy-match an existing lead, else null",
  "note": "key information to log as a note (max 300 chars), else null"
}

Rules:
- If the body looks like a call transcript (timestamps, Q&A, speaker labels), set is_transcript: true
- If subject or attachments suggest a signed contract, set action: stored_document
- If a new person is introduced who isn't likely an existing contact, set action: created_lead
- If it's about an existing deal (mentions an address), set action: updated_deal or logged_note
- For contact_intent: set "seller" if they want to sell a property, "buyer" if they want to buy, "both" if both, null if unclear
- If the email is a Plaud/call transcript about a buyer consultation or showing, set contact_intent: "buyer"
- Keep summary concise and specific`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!text) throw new Error("no response");
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned) as EmailAnalysis;
  } catch {
    return {
      summary: `Email from ${subject}`,
      action: "none",
      is_transcript: false,
      contact_name: null,
      contact_intent: null,
      property_address: null,
      deal_address_hint: null,
      lead_name_hint: null,
      note: null,
    };
  }
}

// ─── CRM actions ──────────────────────────────────────────────────────────────

async function applyAnalysis(
  analysis: EmailAnalysis,
  agentId: string,
  admin: ReturnType<typeof supabaseAdmin>,
  fromEmail: string | null,
): Promise<{ linked_deal_id: string | null; linked_lead_id: string | null }> {
  let linkedDealId: string | null = null;
  let linkedLeadId: string | null = null;

  // Priority 1: match sender email against leads.canonical_email — most reliable signal
  if (fromEmail) {
    const cleanFrom = fromEmail.trim().toLowerCase().replace(/^.*<(.+)>$/, "$1");
    const { data: emailMatchedLead } = await admin
      .from("leads")
      .select("id")
      .eq("agent_id", agentId)
      .eq("canonical_email", cleanFrom)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (emailMatchedLead?.id) {
      linkedLeadId = emailMatchedLead.id as string;
    }
  }

  // Priority 2: match deal by address hint from Claude
  if (analysis.deal_address_hint) {
    const { data: deal } = await admin
      .from("deals")
      .select("id")
      .eq("agent_id", agentId)
      .ilike("property_address", `%${analysis.deal_address_hint}%`)
      .limit(1)
      .maybeSingle();
    linkedDealId = deal?.id ?? null;
  }

  // Priority 3: match lead by name hint if email match didn't find one
  if (!linkedLeadId && analysis.lead_name_hint) {
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("agent_id", agentId)
      .ilike("full_name", `%${analysis.lead_name_hint}%`)
      .limit(1)
      .maybeSingle();
    linkedLeadId = lead?.id ?? null;
  }

  // If we have a lead but no deal yet, look up their active deal
  if (linkedLeadId && !linkedDealId) {
    const { data: leadDeal } = await admin
      .from("deals")
      .select("id")
      .eq("agent_id", agentId)
      .eq("lead_id", linkedLeadId)
      .neq("stage", "closed")
      .neq("stage", "lost")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    linkedDealId = leadDeal?.id ?? null;
  }

  // Create a lead if Claude says so and we found a name
  if (analysis.action === "created_lead" && analysis.contact_name && !linkedLeadId) {
    const intentMap: Record<string, string> = {
      buyer: "Buy",
      seller: "Sell",
      both: "Buy and sell",
    };
    const intent = analysis.contact_intent ? (intentMap[analysis.contact_intent] ?? "Sell") : "Sell";
    const { data: newLead } = await admin.from("leads").insert({
      agent_id: agentId,
      full_name: analysis.contact_name,
      source: "inbox",
      intent,
    }).select("id").single();
    linkedLeadId = newLead?.id ?? null;
  }

  // Log a note to the deal or lead
  if (analysis.note && (linkedDealId ?? linkedLeadId)) {
    const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formatted = `[${timestamp} via inbox] ${analysis.note}`;

    if (linkedDealId) {
      const { data: deal } = await admin.from("deals").select("notes").eq("id", linkedDealId).maybeSingle();
      const existing = asString(deal?.notes);
      await admin.from("deals").update({
        notes: existing ? `${existing}\n${formatted}` : formatted,
        updated_at: new Date().toISOString(),
      }).eq("id", linkedDealId);
    } else if (linkedLeadId) {
      const { data: lead } = await admin.from("leads").select("notes").eq("id", linkedLeadId).maybeSingle();
      const existing = asString(lead?.notes);
      await admin.from("leads").update({ notes: existing ? `${existing}\n${formatted}` : formatted }).eq("id", linkedLeadId);
    }
  }

  return { linked_deal_id: linkedDealId, linked_lead_id: linkedLeadId };
}

// ─── Attachment storage ────────────────────────────────────────────────────────

async function storeAttachments(
  attachments: PostmarkAttachment[],
  agentId: string,
  dealId: string | null,
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<void> {
  for (const att of attachments) {
    try {
      const buffer = Buffer.from(att.Content, "base64");
      const docId = crypto.randomUUID();
      const safeName = att.Name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const storagePath = `${agentId}/${docId}-${safeName}`;

      const { error: uploadError } = await admin.storage
        .from(WORKSPACE_DOCUMENT_BUCKET)
        .upload(storagePath, buffer, {
          contentType: att.ContentType || "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) continue;

      // Add to agent's workspace documents
      const { data: agentRow } = await admin.from("agents").select("settings").eq("id", agentId).maybeSingle();
      const settings = (agentRow?.settings ?? {}) as Record<string, unknown>;
      const docs = Array.isArray(settings.workspace_documents) ? settings.workspace_documents : [];
      docs.push({
        id: docId,
        file_name: att.Name,
        storage_path: storagePath,
        file_type: "agreement",
        deal_id: dealId ?? "",
        lead_id: "",
        tags: ["inbox"],
        status: "draft",
        mime_type: att.ContentType || "application/octet-stream",
        size_bytes: att.ContentLength ?? buffer.length,
        uploaded_at: new Date().toISOString(),
        uploaded_by: agentId,
      });
      await admin.from("agents").update({ settings: { ...settings, workspace_documents: docs } }).eq("id", agentId);
    } catch {
      // non-critical — don't fail the whole request
    }
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Validate webhook token
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expectedToken = process.env.POSTMARK_INBOUND_TOKEN;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as PostmarkInboundMessage;

  const admin = supabaseAdmin();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Resolve agent from To address
  const toEmail = body.ToFull?.[0]?.Email ?? body.To ?? "";
  const slug = extractSlug(toEmail);
  if (!slug) return NextResponse.json({ ok: true }); // ignore malformed

  const { data: agentRow } = await admin
    .from("agents")
    .select("id")
    .ilike("vanity_slug", slug)
    .maybeSingle();

  if (!agentRow?.id) {
    // Unknown slug — still return 200 so Postmark doesn't retry
    return NextResponse.json({ ok: true });
  }

  const agentId = agentRow.id as string;
  const postmarkMessageId = asString(body.MessageID);

  // Idempotency check
  if (postmarkMessageId) {
    const { data: existing } = await admin
      .from("inbox_messages")
      .select("id")
      .eq("agent_id", agentId)
      .eq("postmark_message_id", postmarkMessageId)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true });
  }

  const fromEmail = asString(body.From) ?? asString(body.FromName);
  const fromName = asString(body.FromName);
  const subject = asString(body.Subject) ?? "(no subject)";
  const bodyText = asString(body.TextBody) ?? (body.HtmlBody ? stripHtml(body.HtmlBody) : "");
  const attachments = Array.isArray(body.Attachments) ? body.Attachments : [];
  const attachmentNames = attachments.map((a) => a.Name).filter(Boolean);
  const hasAttachments = attachments.length > 0;

  // Analyze with Claude
  let analysis: EmailAnalysis = {
    summary: `Email: ${subject}`,
    action: "none",
    is_transcript: false,
    contact_name: null,
    contact_intent: null,
    property_address: null,
    deal_address_hint: null,
    lead_name_hint: null,
    note: null,
  };

  if (apiKey && bodyText) {
    analysis = await analyzeEmail(subject, bodyText, attachmentNames, apiKey);
  }

  // Apply CRM actions (pass fromEmail for email-first lead matching)
  const { linked_deal_id, linked_lead_id } = await applyAnalysis(analysis, agentId, admin, fromEmail);

  // Store attachments
  if (hasAttachments) {
    await storeAttachments(attachments, agentId, linked_deal_id, admin);
  }

  // Insert inbox message
  await admin.from("inbox_messages").insert({
    agent_id: agentId,
    postmark_message_id: postmarkMessageId,
    from_email: fromEmail,
    from_name: fromName,
    subject,
    body_text: bodyText.slice(0, 10000),
    received_at: body.Date ? new Date(body.Date).toISOString() : new Date().toISOString(),
    processed: true,
    ai_summary: analysis.summary,
    ai_action: analysis.action,
    linked_deal_id,
    linked_lead_id,
    has_attachments: hasAttachments,
    attachment_names: attachmentNames.length > 0 ? attachmentNames : null,
    read: false,
  });

  // ── Unified recommendation + deal event ────────────────────────────────
  if (linked_lead_id) {
    const recTitle = hasAttachments
      ? `Document received from ${fromName || fromEmail || "contact"} — review and file`
      : `Email received from ${fromName || fromEmail || "contact"} — follow up`;
    const recDesc = analysis.summary ?? subject;

    void writeLeadRecommendation({
      admin,
      agentId,
      leadId: linked_lead_id,
      dealId: linked_deal_id,
      title: recTitle,
      description: recDesc,
      priority: hasAttachments ? "high" : "medium",
      reasonCode: hasAttachments ? "document_received" : "email_received",
      metadata: {
        source_channel: "email",
        subject,
        has_attachments: hasAttachments,
        ai_action: analysis.action,
      },
    }).catch(() => {});
  }

  if (linked_deal_id) {
    void writeDealEvent({
      admin,
      agentId,
      dealId: linked_deal_id,
      eventType: hasAttachments ? "document_received" : "email_received",
      sourceChannel: "email",
      summary: analysis.summary ?? subject,
      metadata: {
        from_email: fromEmail,
        from_name: fromName,
        subject,
        has_attachments: hasAttachments,
        attachment_names: attachmentNames.length > 0 ? attachmentNames : null,
        ai_action: analysis.action,
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
