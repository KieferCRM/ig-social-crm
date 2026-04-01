/**
 * /api/secretary/blast
 *
 * POST  { command }          → interpret command, return preview (no send yet)
 * POST  { blastId, confirm } → confirm and execute a pending blast
 * GET                        → list recent blasts for this agent
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { interpretBlastCommand } from "@/lib/secretary/blast-interpreter";
import { sendReceptionistSms } from "@/lib/receptionist/provider";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import { normalizePhoneToE164 } from "@/lib/receptionist/lead-upsert";
import { tagsFromSourceDetail } from "@/lib/tags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("blasts")
    .select("*")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ blasts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { command?: string; blastId?: string; confirm?: boolean; cancel?: boolean; message?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // ── Cancel a pending blast ────────────────────────────────────────────────
  if (body.cancel && body.blastId) {
    await admin.from("blasts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.blastId)
      .eq("agent_id", user.id)
      .eq("status", "pending");
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  // ── Confirm + execute a pending blast ────────────────────────────────────
  if (body.confirm && body.blastId) {
    const { data: blast } = await admin
      .from("blasts")
      .select("*")
      .eq("id", body.blastId)
      .eq("agent_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (!blast) return NextResponse.json({ error: "Blast not found" }, { status: 404 });

    // Apply edited message if provided
    if (body.message && body.message.trim()) {
      await admin.from("blasts").update({ message: body.message.trim(), updated_at: new Date().toISOString() }).eq("id", body.blastId);
      (blast as BlastRow).message = body.message.trim();
    }

    // If scheduled for the future, just leave it pending — cron will fire it
    if (blast.scheduled_at && new Date(blast.scheduled_at as string) > new Date()) {
      return NextResponse.json({ ok: true, status: "scheduled", scheduled_at: blast.scheduled_at });
    }

    // Send now
    return sendBlast(blast as BlastRow, user.id, admin);
  }

  // ── Interpret a new command ───────────────────────────────────────────────
  if (!body.command) return NextResponse.json({ error: "command required" }, { status: 400 });

  // Load agent context
  const [{ data: agentRow }, { data: contactData }, { data: dealData }] = await Promise.all([
    admin.from("agents").select("settings").eq("id", user.id).maybeSingle(),
    admin.from("leads").select("source_detail,tags").eq("agent_id", user.id).limit(400),
    admin.from("deals").select("property_address,stage").eq("agent_id", user.id).neq("stage", "dead").limit(20),
  ]);

  const settings = readReceptionistSettingsFromAgentSettings(agentRow?.settings ?? null);
  const agentName = (agentRow?.settings as Record<string, unknown> | null)?.agent_name as string ?? "your agent";

  // Collect all unique tags
  const tagSet = new Set<string>();
  for (const c of (contactData ?? [])) {
    for (const t of tagsFromSourceDetail((c as Record<string, unknown>).source_detail)) tagSet.add(t);
    for (const t of ((c as Record<string, unknown>).tags as string[] ?? [])) tagSet.add(t);
  }

  const interpretation = await interpretBlastCommand({
    command: body.command,
    agentName,
    availableTags: Array.from(tagSet),
    recentDeals: (dealData ?? []).map((d) => ({
      address: (d as Record<string, unknown>).property_address as string ?? "Unknown",
      stage: (d as Record<string, unknown>).stage as string ?? "",
    })),
    nowIso: new Date().toISOString(),
    timezone: settings.office_hours_timezone ?? "America/New_York",
  });

  if (!interpretation) {
    return NextResponse.json({ error: "Could not interpret command. Try being more specific." }, { status: 422 });
  }

  // Count recipients
  const recipientCount = await countRecipients(admin, user.id, interpretation.tag);

  // Store as pending blast
  const { data: blast, error } = await admin
    .from("blasts")
    .insert({
      agent_id: user.id,
      tag: interpretation.tag,
      message: interpretation.message,
      scheduled_at: interpretation.scheduled_at ?? null,
      status: "pending",
      recipient_count: recipientCount,
      command: body.command,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    blast,
    interpretation,
    recipient_count: recipientCount,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type BlastRow = {
  id: string;
  agent_id: string;
  tag: string;
  message: string;
  scheduled_at: string | null;
  status: string;
  recipient_count: number;
};

async function countRecipients(admin: ReturnType<typeof supabaseAdmin>, agentId: string, tag: string): Promise<number> {
  const { data } = await admin
    .from("leads")
    .select("id,canonical_phone,source_detail,tags")
    .eq("agent_id", agentId)
    .not("canonical_phone", "is", null);

  if (!data) return 0;
  return data.filter((c) => {
    const allTags = [
      ...tagsFromSourceDetail((c as Record<string, unknown>).source_detail),
      ...((c as Record<string, unknown>).tags as string[] ?? []),
    ];
    return allTags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }).length;
}

async function sendBlast(blast: BlastRow, agentId: string, admin: ReturnType<typeof supabaseAdmin>) {
  // Mark as sending
  await admin.from("blasts").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", blast.id);

  // Load agent settings for fromPhone
  const { data: agentRow } = await admin.from("agents").select("settings").eq("id", agentId).maybeSingle();
  const settings = readReceptionistSettingsFromAgentSettings(agentRow?.settings ?? null);
  const fromPhone = normalizePhoneToE164(settings.business_phone_number);

  if (!fromPhone) {
    await admin.from("blasts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", blast.id);
    return NextResponse.json({ error: "No business phone configured." }, { status: 400 });
  }

  // Load recipients
  const { data: contacts } = await admin
    .from("leads")
    .select("id,canonical_phone,source_detail,tags")
    .eq("agent_id", agentId)
    .not("canonical_phone", "is", null);

  const matched = (contacts ?? []).filter((c) => {
    const allTags = [
      ...tagsFromSourceDetail((c as Record<string, unknown>).source_detail),
      ...((c as Record<string, unknown>).tags as string[] ?? []),
    ];
    return allTags.some((t) => t.toLowerCase() === blast.tag.toLowerCase());
  });

  // Deduplicate by normalized phone — one SMS per number, no matter how many lead records share it
  const seenPhones = new Set<string>();
  const uniquePhones: string[] = [];
  for (const contact of matched) {
    const toPhone = normalizePhoneToE164((contact as Record<string, unknown>).canonical_phone as string);
    if (!toPhone || seenPhones.has(toPhone)) continue;
    seenPhones.add(toPhone);
    uniquePhones.push(toPhone);
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const toPhone of uniquePhones) {
    const result = await sendReceptionistSms({ agentId, fromPhone, toPhone, text: blast.message });
    if (result.ok) sentCount++;
    else failedCount++;
  }

  const now = new Date().toISOString();
  await admin.from("blasts").update({
    status: "sent",
    sent_at: now,
    sent_count: sentCount,
    failed_count: failedCount,
    recipient_count: uniquePhones.length,
    updated_at: now,
  }).eq("id", blast.id);

  return NextResponse.json({ ok: true, status: "sent", sent_count: sentCount, failed_count: failedCount });
}
