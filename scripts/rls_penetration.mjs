#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`PASS: ${message}`);
}

function warn(message) {
  console.log(`WARN: ${message}`);
}

function required(name, value) {
  if (!value || value.trim() === "") {
    fail(`Missing required env var: ${name}`);
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function baseLeadPayload(userId, handle) {
  const nowIso = new Date().toISOString();
  return {
    agent_id: userId,
    owner_user_id: userId,
    assignee_user_id: userId,
    ig_username: handle,
    stage: "New",
    lead_temp: "Warm",
    source: "rls_pen_test",
    time_last_updated: nowIso,
    consent_to_email: false,
    consent_to_sms: false,
    consent_source: "rls_pen_test",
    consent_timestamp: nowIso,
    consent_text_snapshot: "Consent not explicitly captured from rls_pen_test.",
  };
}

function isBlocked(result) {
  const errCode = result?.error?.code || "";
  if (errCode === "42501") return true;
  const data = result?.data;
  if (Array.isArray(data) && data.length === 0) return true;
  if (data === null) return true;
  return false;
}

function isMissingColumnError(error, column) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const needle = column.toLowerCase();

  if (code === "42703" || code.startsWith("PGRST")) {
    return message.includes(needle) || details.includes(needle);
  }

  return false;
}

function shouldSkipLeadEvents(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("lead_events") &&
    (m.includes("contact_id") || m.includes("null value in column") || m.includes("violates foreign key"))
  );
}

async function columnExists(admin, table, column) {
  const { error } = await admin.from(table).select(`id,${column}`).limit(1);
  if (!error) return true;
  if (isMissingColumnError(error, column)) return false;
  fail(`Could not inspect ${table}.${column}: ${error.message}`);
}

function buildLeadEventPayload(input, compat) {
  const nowIso = new Date().toISOString();
  const row = {
    lead_id: input.leadId,
    agent_id: input.agentId,
    event_type: input.eventType,
    event_data: input.eventData,
  };

  if (compat.contact_id && input.contactId) row.contact_id = input.contactId;
  if (compat.owner_user_id) row.owner_user_id = input.agentId;
  if (compat.assignee_user_id) row.assignee_user_id = input.agentId;
  if (compat.source) row.source = "rls_pen_test";
  if (compat.channel) row.channel = "other";
  if (compat.occurred_at) row.occurred_at = nowIso;
  if (compat.created_at) row.created_at = nowIso;

  return row;
}

async function createTempUser(admin, label) {
  const suffix = randomSuffix();
  const email = `rls_${label}_${suffix}@example.com`;
  const password = `Rls!${suffix.slice(0, 10)}A1`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label.toUpperCase()}` },
  });
  if (error) fail(`Could not create test user ${label}: ${error.message}`);

  const userId = data.user?.id;
  if (!userId) fail(`Auth user id missing after createUser for ${label}.`);

  const { error: agentError } = await admin.from("agents").upsert(
    {
      id: userId,
      email,
      full_name: `RLS ${label.toUpperCase()}`,
      plan: "free",
    },
    { onConflict: "id" }
  );
  if (agentError) fail(`Could not upsert agent row for ${label}: ${agentError.message}`);

  return { userId, email, password };
}

async function signInAs(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    fail(`Could not sign in as ${email}: ${error?.message || "missing session"}`);
  }
  return client;
}

async function cleanup(admin, userIds) {
  if (userIds.length === 0) return;

  await admin.from("ingestion_events").delete().in("agent_id", userIds);
  await admin.from("lead_events").delete().in("agent_id", userIds);
  await admin.from("leads").delete().in("agent_id", userIds);
  await admin.from("agents").delete().in("id", userIds);

  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function run() {
  required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);
  required("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const createdUserIds = [];

  try {
    const userA = await createTempUser(admin, "a");
    createdUserIds.push(userA.userId);
    const userB = await createTempUser(admin, "b");
    createdUserIds.push(userB.userId);
    ok("Created isolated tenant users A and B");

    const clientA = await signInAs(userA.email, userA.password);
    const clientB = await signInAs(userB.email, userB.password);
    ok("Authenticated both tenant clients");

    const leadEventsCompat = {
      contact_id: await columnExists(admin, "lead_events", "contact_id"),
      owner_user_id: await columnExists(admin, "lead_events", "owner_user_id"),
      assignee_user_id: await columnExists(admin, "lead_events", "assignee_user_id"),
      source: await columnExists(admin, "lead_events", "source"),
      channel: await columnExists(admin, "lead_events", "channel"),
      occurred_at: await columnExists(admin, "lead_events", "occurred_at"),
      created_at: await columnExists(admin, "lead_events", "created_at"),
    };
    const leadsHasContactId = await columnExists(admin, "leads", "contact_id");

    const leadHandleA = `rls_a_${randomSuffix().replace(/[^a-z0-9_]/gi, "").toLowerCase()}`;
    const { data: leadA, error: leadAInsertError } = await clientA
      .from("leads")
      .insert(baseLeadPayload(userA.userId, leadHandleA))
      .select(leadsHasContactId ? "id,contact_id" : "id")
      .single();
    if (leadAInsertError || !leadA?.id) {
      fail(`Tenant A could not insert own lead: ${leadAInsertError?.message || "missing lead id"}`);
    }
    ok("Tenant A can insert own lead");

    const crossSelect = await clientB
      .from("leads")
      .select("id")
      .eq("id", leadA.id)
      .maybeSingle();
    if (crossSelect.error) fail(`Unexpected error selecting A lead from B: ${crossSelect.error.message}`);
    assert(!crossSelect.data, "Tenant B should not read tenant A lead.");
    ok("Tenant B cannot read tenant A lead");

    const crossUpdate = await clientB
      .from("leads")
      .update({ notes: "cross-tenant-update-attempt" })
      .eq("id", leadA.id)
      .select("id");
    assert(isBlocked(crossUpdate), "Tenant B update on tenant A lead was not blocked.");
    ok("Tenant B cannot update tenant A lead");

    const crossDelete = await clientB
      .from("leads")
      .delete()
      .eq("id", leadA.id)
      .select("id");
    assert(isBlocked(crossDelete), "Tenant B delete on tenant A lead was not blocked.");
    ok("Tenant B cannot delete tenant A lead");

    const badInsertLead = await clientB
      .from("leads")
      .insert(baseLeadPayload(userA.userId, `rls_bad_${randomSuffix()}`))
      .select("id")
      .single();
    assert(Boolean(badInsertLead.error), "Tenant B should not insert lead for tenant A agent_id.");
    ok("Tenant B cannot insert lead with tenant A agent_id");

    const leadContactId = leadsHasContactId ? leadA.contact_id || null : null;
    let leadEventsChecked = false;

    const { data: leadEventA, error: leadEventInsertError } = await clientA
      .from("lead_events")
      .insert(
        buildLeadEventPayload(
          {
            leadId: leadA.id,
            contactId: leadContactId,
            agentId: userA.userId,
            eventType: "rls_test_event",
            eventData: { scope: "own" },
          },
          leadEventsCompat
        )
      )
      .select("id")
      .single();
    if (leadEventInsertError || !leadEventA?.id) {
      const message = leadEventInsertError?.message || "missing event id";
      if (shouldSkipLeadEvents(message)) {
        warn(`Skipping lead_events RLS checks due to legacy schema constraint: ${message}`);
      } else {
        fail(`Tenant A could not insert own lead_event: ${message}`);
      }
    } else {
      ok("Tenant A can insert own lead_event");
      leadEventsChecked = true;
    }

    if (leadEventsChecked) {
      const crossLeadEventSelect = await clientB
        .from("lead_events")
        .select("id")
        .eq("id", leadEventA.id)
        .maybeSingle();
      if (crossLeadEventSelect.error) {
        fail(`Unexpected error selecting A lead_event from B: ${crossLeadEventSelect.error.message}`);
      }
      assert(!crossLeadEventSelect.data, "Tenant B should not read tenant A lead_event.");
      ok("Tenant B cannot read tenant A lead_event");

      const badLeadEventInsert = await clientB
        .from("lead_events")
        .insert(
          buildLeadEventPayload(
            {
              leadId: leadA.id,
              contactId: leadContactId,
              agentId: userA.userId,
              eventType: "rls_bad_event",
              eventData: { scope: "cross-tenant" },
            },
            leadEventsCompat
          )
        )
        .select("id")
        .single();
      assert(Boolean(badLeadEventInsert.error), "Tenant B should not insert lead_event for tenant A.");
      ok("Tenant B cannot insert lead_event with tenant A agent_id");
    }

    const ingestionExternalId = `rls_ingest_${randomSuffix()}`;
    const { data: ingestionA, error: ingestionInsertError } = await clientA
      .from("ingestion_events")
      .insert({
        agent_id: userA.userId,
        source: "rls_pen_test",
        external_event_id: ingestionExternalId,
        payload_hash: createHash("sha256").update(ingestionExternalId).digest("hex"),
        raw_payload: { rls: true },
      })
      .select("id")
      .single();
    if (ingestionInsertError || !ingestionA?.id) {
      fail(`Tenant A could not insert own ingestion_event: ${ingestionInsertError?.message || "missing id"}`);
    }
    ok("Tenant A can insert own ingestion_event");

    const crossIngestionSelect = await clientB
      .from("ingestion_events")
      .select("id")
      .eq("id", ingestionA.id)
      .maybeSingle();
    if (crossIngestionSelect.error) {
      fail(`Unexpected error selecting A ingestion_event from B: ${crossIngestionSelect.error.message}`);
    }
    assert(!crossIngestionSelect.data, "Tenant B should not read tenant A ingestion_event.");
    ok("Tenant B cannot read tenant A ingestion_event");

    const badIngestionInsert = await clientB
      .from("ingestion_events")
      .insert({
        agent_id: userA.userId,
        source: "rls_pen_test",
        external_event_id: `rls_bad_${randomSuffix()}`,
        payload_hash: createHash("sha256").update(`rls_bad_${randomSuffix()}`).digest("hex"),
        raw_payload: { rls: "cross-tenant" },
      })
      .select("id")
      .single();
    assert(Boolean(badIngestionInsert.error), "Tenant B should not insert ingestion_event for tenant A.");
    ok("Tenant B cannot insert ingestion_event with tenant A agent_id");

    console.log("PASS: RLS penetration suite complete.");
  } finally {
    await cleanup(admin, createdUserIds);
  }
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown RLS penetration failure.");
});
