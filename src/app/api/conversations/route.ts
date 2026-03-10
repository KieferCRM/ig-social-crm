import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext, ownerFilter } from "@/lib/access-context";

type ConversationRow = {
  id: string;
  platform: "ig" | "fb";
  meta_thread_id: string;
  meta_participant_id: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessagePreviewRow = {
  conversation_id: string;
  text: string | null;
  ts: string | null;
  direction: "in" | "out";
  raw_json: { automated?: boolean; type?: string } | null;
};

type LeadSignalRow = {
  ig_username: string;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  next_step: string | null;
};

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function clip(value: string, max = 160): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function isGenericNoise(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;

  const noise = new Set([
    "ok",
    "okay",
    "thanks",
    "thank you",
    "great",
    "perfect",
    "sounds good",
    "got it",
    "👍",
    "👌",
  ]);

  if (noise.has(normalized)) return true;
  if (normalized.length <= 2) return true;
  return false;
}

function inferIntent(texts: string[]): string | null {
  const joined = texts.join(" ").toLowerCase();
  if (joined.includes("sell")) return "to sell";
  if (joined.includes("invest")) return "to invest";
  if (joined.includes("rent")) return "to rent";
  if (joined.includes("buy")) return "to buy";
  return null;
}

function inferTimeline(texts: string[]): string | null {
  const joined = texts.join(" ").toLowerCase();
  if (joined.includes("asap")) return "ASAP";
  if (joined.includes("soon")) return "soon";
  const match = joined.match(/\b(\d+\s*(day|week|month)s?)\b/);
  return match?.[1] ?? null;
}

function inferLocation(texts: string[]): string | null {
  for (const text of texts) {
    const match = text.match(/\b(?:in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function inferNextStep(texts: string[]): string | null {
  const joined = texts.join(" ").toLowerCase();
  if (joined.includes("tour")) return "schedule a property tour";
  if (joined.includes("call")) return "book a call";
  if (joined.includes("send") || joined.includes("options")) return "send matching options";
  return null;
}

function summarizeConversation(messages: MessagePreviewRow[], lead: LeadSignalRow | null): string | null {
  const relevant = messages
    .filter((m) => !m.raw_json?.automated)
    .map((m) => ({ ...m, text: (m.text || "").trim() }))
    .filter((m) => m.text.length > 0 && !isGenericNoise(m.text))
    .slice(0, 8);

  if (relevant.length === 0) return null;

  const inboundTexts = relevant
    .filter((m) => m.direction === "in")
    .map((m) => m.text as string);
  const contextTexts = (inboundTexts.length ? inboundTexts : relevant.map((m) => m.text as string)).slice(0, 4);

  const intent = lead?.intent?.trim() || inferIntent(contextTexts) || "guidance";
  const location = lead?.location_area?.trim() || inferLocation(contextTexts);
  const timeline = lead?.timeline?.trim() || inferTimeline(contextTexts);
  const budget = lead?.budget_range?.trim();
  const nextStep = lead?.next_step?.trim() || inferNextStep(contextTexts) || "send next-step options";

  const segments = [`Lead wants ${intent}`];
  if (location) segments.push(`in ${location}`);
  if (timeline) segments.push(`within ${timeline}`);
  if (budget) segments.push(`with budget ${budget}`);

  const sentence = `${segments.join(" ")}; next action: ${nextStep}.`;
  return clip(sentence, 170);
}

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select(
      "id, platform, meta_thread_id, meta_participant_id, last_message_at, created_at, updated_at"
    )
    .or(ownerFilter(auth.context))
    .order("last_message_at", { ascending: false });

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const rows = (conversations ?? []) as ConversationRow[];
  if (rows.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const ids = rows.map((c) => c.id);
  const handles = Array.from(new Set(rows.map((c) => normalizeHandle(c.meta_participant_id))));

  const { data: previewRows, error: previewError } = await supabase
    .from("messages")
    .select("conversation_id, text, ts, direction, raw_json")
    .or(ownerFilter(auth.context))
    .in("conversation_id", ids)
    .order("ts", { ascending: false });

  if (previewError) {
    return NextResponse.json({ error: previewError.message }, { status: 500 });
  }

  const previewByConversation = new Map<string, { text: string | null; ts: string | null }>();
  const rowsByConversation = new Map<string, MessagePreviewRow[]>();

  for (const row of (previewRows ?? []) as MessagePreviewRow[]) {
    if (!previewByConversation.has(row.conversation_id)) {
      previewByConversation.set(row.conversation_id, {
        text: row.text,
        ts: row.ts,
      });
    }

    const list = rowsByConversation.get(row.conversation_id) || [];
    if (list.length < 6) {
      list.push(row);
      rowsByConversation.set(row.conversation_id, list);
    }
  }

  const { data: leadRows, error: leadError } = await supabase
    .from("leads")
    .select("ig_username, intent, timeline, budget_range, location_area, next_step")
    .or(ownerFilter(auth.context))
    .in("ig_username", handles);

  if (leadError) {
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  const leadsByHandle = new Map<string, LeadSignalRow>();
  for (const lead of (leadRows ?? []) as LeadSignalRow[]) {
    leadsByHandle.set(normalizeHandle(lead.ig_username), lead);
  }

  const payload = rows.map((row) => ({
    ...row,
    last_message_preview: previewByConversation.get(row.id)?.text ?? null,
    last_message_ts: previewByConversation.get(row.id)?.ts ?? null,
    ai_summary: summarizeConversation(
      rowsByConversation.get(row.id) || [],
      leadsByHandle.get(normalizeHandle(row.meta_participant_id)) || null
    ),
  }));

  return NextResponse.json({ conversations: payload });
}
