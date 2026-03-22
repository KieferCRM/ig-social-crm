#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const BASE_URL = (process.env.SMOKE_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const AGENT_ID = process.env.AGENT_ID || process.env.INTAKE_AGENT_ID || "";
const SECRET = process.env.RECEPTIONIST_WEBHOOK_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`PASS: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function required(name, value) {
  if (!value || !value.trim()) fail(`Missing required env var: ${name}`);
}

async function postWebhook(payload) {
  const response = await fetch(`${BASE_URL}/api/receptionist/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-receptionist-secret": SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { response, data };
}

async function run() {
  required("AGENT_ID or INTAKE_AGENT_ID", AGENT_ID);
  required("RECEPTIONIST_WEBHOOK_SECRET", SECRET);
  required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  required("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now().toString(36);
  const fromPhone = `+15551${Date.now().toString().slice(-7)}`;

  const smsPayload = {
    event_type: "sms_inbound",
    agent_id: AGENT_ID,
    from_phone: fromPhone,
    to_phone: "+15550001111",
    message_body: "Need to buy this week in Austin around 700k. call me today",
    provider: "mock",
    provider_message_id: `SM_${stamp}`,
  };

  const smsResult = await postWebhook(smsPayload);
  assert(
    smsResult.response.ok && smsResult.data?.ok,
    `sms_inbound failed: ${JSON.stringify(smsResult.data)}`
  );
  const leadId = smsResult.data?.result?.leadId;
  assert(typeof leadId === "string" && leadId.length > 0, "sms_inbound did not return leadId.");
  ok("sms_inbound accepted");

  const { data: leadAfterSms, error: leadAfterSmsError } = await admin
    .from("leads")
    .select("id,agent_id,canonical_phone,source,urgency_level,urgency_score")
    .eq("id", leadId)
    .eq("agent_id", AGENT_ID)
    .maybeSingle();

  assert(!leadAfterSmsError, `lead lookup failed: ${leadAfterSmsError?.message}`);
  assert(leadAfterSms?.canonical_phone, "lead canonical_phone missing after sms_inbound.");
  ok("lead upsert by phone");

  const { data: interactionsAfterSms, error: interactionsAfterSmsError } = await admin
    .from("lead_interactions")
    .select("id,channel,direction,interaction_type,status")
    .eq("agent_id", AGENT_ID)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(20);

  assert(!interactionsAfterSmsError, `interaction lookup failed: ${interactionsAfterSmsError?.message}`);
  const smsInboundInteraction = (interactionsAfterSms || []).find(
    (row) => row.channel === "sms" && row.direction === "in"
  );
  assert(Boolean(smsInboundInteraction), "sms inbound interaction was not logged.");
  ok("sms interaction logging");

  const missedPayload = {
    event_type: "missed_call",
    agent_id: AGENT_ID,
    from_phone: fromPhone,
    to_phone: "+15550001111",
    provider: "mock",
    provider_call_id: `CA_MISSED_${stamp}`,
  };

  const missedResult = await postWebhook(missedPayload);
  assert(
    missedResult.response.ok && missedResult.data?.ok,
    `missed_call failed: ${JSON.stringify(missedResult.data)}`
  );
  assert(missedResult.data?.result?.leadId === leadId, "missed_call did not resolve to same lead.");
  ok("missed_call lead resolution");

  const { data: interactionsAfterMissed, error: interactionsAfterMissedError } = await admin
    .from("lead_interactions")
    .select("id,channel,direction,interaction_type,status")
    .eq("agent_id", AGENT_ID)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(30);

  assert(!interactionsAfterMissedError, `interaction lookup failed: ${interactionsAfterMissedError?.message}`);
  const missedInteraction = (interactionsAfterMissed || []).find(
    (row) => row.channel === "missed_call_textback" && row.interaction_type === "missed_call"
  );
  assert(Boolean(missedInteraction), "missed_call interaction was not logged.");
  ok("missed call workflow logging");

  const callPayload = {
    event_type: "call_inbound",
    agent_id: AGENT_ID,
    from_phone: fromPhone,
    to_phone: "+15550001111",
    call_status: "completed",
    transcript: "I am ready now and need a tour this week. Please call me.",
    provider: "mock",
    provider_call_id: `CA_IN_${stamp}`,
  };

  const callResult = await postWebhook(callPayload);
  assert(
    callResult.response.ok && callResult.data?.ok,
    `call_inbound failed: ${JSON.stringify(callResult.data)}`
  );
  ok("call_inbound accepted");

  const { data: finalLead, error: finalLeadError } = await admin
    .from("leads")
    .select("id,urgency_level,urgency_score")
    .eq("id", leadId)
    .eq("agent_id", AGENT_ID)
    .maybeSingle();

  assert(!finalLeadError, `final lead lookup failed: ${finalLeadError?.message}`);
  assert(finalLead?.urgency_level === "high", "lead urgency_level was not raised to high.");
  assert((finalLead?.urgency_score || 0) >= 50, "lead urgency_score did not reach threshold.");
  ok("urgency updates");

  const { data: alerts, error: alertsError } = await admin
    .from("receptionist_alerts")
    .select("id,alert_type,severity,status")
    .eq("agent_id", AGENT_ID)
    .eq("lead_id", leadId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);

  assert(!alertsError, `alert lookup failed: ${alertsError?.message}`);
  assert((alerts || []).length > 0, "expected at least one open receptionist alert.");
  ok("alert creation");

  console.log("PASS: receptionist smoke checks complete.");
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown receptionist smoke failure.");
});
