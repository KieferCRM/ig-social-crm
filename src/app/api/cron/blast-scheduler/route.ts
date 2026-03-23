/**
 * POST /api/cron/blast-scheduler
 * Fires any pending blasts whose scheduled_at has passed.
 * Run every 5 minutes via Vercel cron.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendReceptionistSms } from "@/lib/receptionist/provider";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import { normalizePhoneToE164 } from "@/lib/receptionist/lead-upsert";
import { tagsFromSourceDetail } from "@/lib/tags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  // Find pending scheduled blasts that are due
  const { data: duBlasts } = await admin
    .from("blasts")
    .select("*")
    .eq("status", "pending")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .limit(20);

  if (!duBlasts || duBlasts.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 });
  }

  let fired = 0;

  for (const blast of duBlasts) {
    const b = blast as Record<string, unknown>;
    const agentId = b.agent_id as string;

    // Mark as sending
    await admin.from("blasts").update({ status: "sending", updated_at: now }).eq("id", b.id as string);

    const { data: agentRow } = await admin.from("agents").select("settings").eq("id", agentId).maybeSingle();
    const settings = readReceptionistSettingsFromAgentSettings(agentRow?.settings ?? null);
    const fromPhone = normalizePhoneToE164(settings.business_phone_number);

    if (!fromPhone) {
      await admin.from("blasts").update({ status: "failed", updated_at: now }).eq("id", b.id as string);
      continue;
    }

    const { data: contacts } = await admin
      .from("leads")
      .select("id,canonical_phone,source_detail,tags")
      .eq("agent_id", agentId)
      .not("canonical_phone", "is", null);

    const recipients = (contacts ?? []).filter((c) => {
      const allTags = [
        ...tagsFromSourceDetail((c as Record<string, unknown>).source_detail),
        ...((c as Record<string, unknown>).tags as string[] ?? []),
      ];
      return allTags.some((t) => t.toLowerCase() === (b.tag as string).toLowerCase());
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of recipients) {
      const toPhone = normalizePhoneToE164((contact as Record<string, unknown>).canonical_phone as string);
      if (!toPhone) { failedCount++; continue; }
      const result = await sendReceptionistSms({ agentId, fromPhone, toPhone, text: b.message as string });
      if (result.ok) sentCount++;
      else failedCount++;
    }

    await admin.from("blasts").update({
      status: "sent",
      sent_at: now,
      sent_count: sentCount,
      failed_count: failedCount,
      recipient_count: recipients.length,
      updated_at: now,
    }).eq("id", b.id as string);

    fired++;
  }

  return NextResponse.json({ ok: true, fired });
}
