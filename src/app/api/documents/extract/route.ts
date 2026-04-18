import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import {
  WORKSPACE_DOCUMENT_BUCKET,
  withWorkspaceDocument,
  readWorkspaceSettingsFromAgentSettings,
  type DocumentExtraction,
  type WorkspaceDocument,
} from "@/lib/workspace-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();

const SUPPORTED_PDF = "application/pdf";
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { document_id?: string } = {};
  try {
    body = (await request.json()) as { document_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = String(body.document_id || "").trim();
  if (!documentId) return NextResponse.json({ error: "document_id is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: agentRow, error: loadError } = await admin
    .from("agents")
    .select("settings")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const settings = readWorkspaceSettingsFromAgentSettings(agentRow?.settings ?? null);
  const doc = settings.documents.find((d) => d.id === documentId);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Download file from storage
  const { data: fileData, error: downloadError } = await admin.storage
    .from(WORKSPACE_DOCUMENT_BUCKET)
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Could not download document file." }, { status: 500 });
  }

  const mimeType = doc.mime_type || "application/octet-stream";
  const isPdf = mimeType === SUPPORTED_PDF;
  const isImage = SUPPORTED_IMAGES.has(mimeType);

  if (!isPdf && !isImage) {
    // Mark as skipped — unsupported file type
    const updated = { ...doc, extraction_status: "skipped" as const };
    const nextSettings = withWorkspaceDocument(agentRow?.settings ?? null, updated);
    await admin.from("agents").upsert(
      { id: auth.context.user.id, settings: nextSettings, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    return NextResponse.json({ ok: true, extraction_status: "skipped", reason: "Unsupported file type. Only PDF and images are supported." });
  }

  // Load contacts and deals for matching context
  const [{ data: contacts }, { data: deals }] = await Promise.all([
    admin
      .from("leads")
      .select("id, full_name, first_name, last_name, canonical_email, canonical_phone")
      .eq("agent_id", auth.context.user.id)
      .not("full_name", "is", null)
      .limit(300),
    admin
      .from("deals")
      .select("id, property_address, stage")
      .eq("agent_id", auth.context.user.id)
      .not("stage", "in", '("closed","dead","lost")')
      .limit(200),
  ]);

  const contactContext = (contacts ?? [])
    .map((c) => `${c.id} | ${c.full_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()} | ${c.canonical_email ?? ""} | ${c.canonical_phone ?? ""}`)
    .join("\n");

  const dealContext = (deals ?? [])
    .map((d) => `${d.id} | ${d.property_address ?? ""} | ${d.stage ?? ""}`)
    .join("\n");

  const systemPrompt = `You are the Document Administrator for LockboxHQ, a real estate CRM for wholesalers and agents.
Your job is to extract structured data from uploaded real estate documents and match them to existing records.
Return ONLY valid JSON — no markdown, no explanation, no code blocks.`;

  const extractionPrompt = `Extract key information from this document and match it to existing records.

EXISTING CONTACTS (id | name | email | phone):
${contactContext || "None"}

EXISTING DEALS (id | address | stage):
${dealContext || "None"}

Return this exact JSON structure:
{
  "doc_type": "purchase_and_sale_agreement" | "assignment_contract" | "proof_of_funds" | "arv_comps_report" | "mao_calculation" | "title_report" | "earnest_money_receipt" | "purchase_agreement" | "listing_agreement" | "inspection_report" | "disclosure" | "other",
  "parties": [{ "role": "seller" | "buyer" | "assignor" | "assignee" | "agent" | "attorney" | "other", "name": "Full Name" }],
  "property_address": "full address or empty string",
  "purchase_price": "dollar amount as string or empty string",
  "assignment_fee": "dollar amount as string or empty string",
  "closing_date": "YYYY-MM-DD or empty string",
  "effective_date": "YYYY-MM-DD or empty string",
  "matched_lead_ids": ["matching contact id from EXISTING CONTACTS list — match on name similarity"],
  "matched_deal_id": "matching deal id from EXISTING DEALS list — match on property address similarity, or empty string",
  "confidence": "high" | "medium" | "low",
  "notes": "important flags: unsigned contract, missing signature, expired, multiple sellers, etc."
}`;

  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const contentBlock: Anthropic.MessageParam["content"] = isPdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as Anthropic.DocumentBlockParam,
        { type: "text", text: extractionPrompt },
      ]
    : [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        } as Anthropic.ImageBlockParam,
        { type: "text", text: extractionPrompt },
      ];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: contentBlock }],
  });

  const rawText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let extraction: DocumentExtraction;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    extraction = JSON.parse(jsonMatch[0]) as DocumentExtraction;
  } catch {
    return NextResponse.json({ error: "Could not parse extraction response from AI." }, { status: 500 });
  }

  // Determine status: if we have parties and address, try matching
  const hasMatches =
    extraction.matched_lead_ids?.length > 0 || Boolean(extraction.matched_deal_id);

  const extractionStatus = hasMatches ? "matched" : "needs_review";

  // If matched, apply lead_id/deal_id to the document
  const primaryLeadId = extraction.matched_lead_ids?.[0] ?? doc.lead_id;
  const primaryDealId = extraction.matched_deal_id || doc.deal_id;

  const updated: WorkspaceDocument = {
    ...doc,
    lead_id: primaryLeadId,
    deal_id: primaryDealId,
    extraction_status: extractionStatus,
    extraction,
  };

  const nextSettings = withWorkspaceDocument(agentRow?.settings ?? null, updated);
  const { error: saveError } = await admin.from("agents").upsert(
    { id: auth.context.user.id, settings: nextSettings, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ ok: true, extraction_status: extractionStatus, document: updated, extraction });
}
