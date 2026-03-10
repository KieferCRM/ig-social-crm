#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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

const AUTO_START =
  process.env.SMOKE_AUTO_START === undefined
    ? true
    : process.env.SMOKE_AUTO_START.toLowerCase() === "true";
const AUTO_START_PORT = Number(process.env.SMOKE_AUTO_START_PORT || "4010");
const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${AUTO_START_PORT}`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SMOKE_TEST_EMAIL = process.env.SMOKE_TEST_EMAIL || "";
const SMOKE_TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD || "";
const INTAKE_AGENT_ID = process.env.INTAKE_AGENT_ID || "";

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
  if (!value || value.trim() === "") {
    fail(`Missing required env var: ${name}`);
  }
}

function normalizeBase(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isLocalBaseUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function supabaseAuthCookieName(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  const projectRef = host.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function toJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(baseUrl, path, options = {}) {
  const target = `${baseUrl}${path}`;
  try {
    return await fetch(target, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    throw new Error(`Request failed for ${target}: ${reason}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs, getLogs) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
      if (response.status > 0 && response.status < 500) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown";
    }
    await sleep(500);
  }

  const logs = getLogs();
  fail(
    `Timed out waiting for app server at ${baseUrl}. Last error: ${lastError}\n` +
      `Server logs (tail):\n${logs}`
  );
}

async function authSession() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: SMOKE_TEST_EMAIL,
      password: SMOKE_TEST_PASSWORD,
    }),
  });

  const data = await toJson(response);
  if (!response.ok) {
    fail(`Supabase login failed: ${JSON.stringify(data)}`);
  }

  const accessToken = data.access_token || data.session?.access_token;
  const refreshToken =
    data.refresh_token ||
    data.session?.refresh_token ||
    data.refreshToken ||
    data.session?.refreshToken ||
    "";
  const userId = data.user?.id || data.session?.user?.id;
  const expiresIn =
    Number(data.expires_in || data.session?.expires_in || data.expiresIn || 3600) || 3600;
  const expiresAt =
    Number(data.expires_at || data.session?.expires_at || data.expiresAt) ||
    Math.floor(Date.now() / 1000) + expiresIn;
  const tokenType = data.token_type || data.session?.token_type || "bearer";

  assert(typeof accessToken === "string" && accessToken.length > 20, "Missing access token.");
  assert(typeof userId === "string" && userId.length > 0, "Missing user id.");

  const safeRefreshToken = refreshToken || accessToken;
  if (!refreshToken) {
    console.warn("WARN: refresh token missing from auth response; using access token fallback for smoke auth.");
  }

  const sessionForCookie = {
    access_token: accessToken,
    refresh_token: safeRefreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: tokenType,
    user: data.user || data.session?.user || { id: userId },
  };

  const cookieName = supabaseAuthCookieName(SUPABASE_URL);
  const cookieValue = `base64-${toBase64Url(JSON.stringify(sessionForCookie))}`;
  const cookieHeader = `${cookieName}=${cookieValue}`;

  return { cookieHeader };
}

async function run() {
  required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);
  required("SMOKE_TEST_EMAIL", SMOKE_TEST_EMAIL);
  required("SMOKE_TEST_PASSWORD", SMOKE_TEST_PASSWORD);
  required("INTAKE_AGENT_ID", INTAKE_AGENT_ID);

  const baseUrl = normalizeBase(BASE_URL);
  assert(
    isLocalBaseUrl(baseUrl),
    "SMOKE_BASE_URL must be localhost/127.0.0.1 for local smoke checks."
  );

  let serverProcess = null;
  let serverLogs = "";
  const appendLog = (chunk) => {
    if (!chunk) return;
    serverLogs += chunk.toString();
    if (serverLogs.length > 8000) {
      serverLogs = serverLogs.slice(serverLogs.length - 8000);
    }
  };

  try {
    if (AUTO_START) {
      serverProcess = spawn("npm", ["run", "start", "--", "--port", String(new URL(baseUrl).port || AUTO_START_PORT)], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "production" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      serverProcess.stdout.on("data", appendLog);
      serverProcess.stderr.on("data", appendLog);

      await waitForServer(baseUrl, 45_000, () => serverLogs);
      ok(`Started app server for smoke checks (${baseUrl})`);
    }

    const { cookieHeader } = await authSession();
    ok("Auth login (Supabase password grant)");

    const unauthApp = await request(baseUrl, "/app", { redirect: "manual" });
    assert(
      unauthApp.status >= 300 && unauthApp.status < 400,
      `Expected unauthenticated /app redirect, got ${unauthApp.status}`
    );
    const location = unauthApp.headers.get("location") || "";
    assert(location.includes("/auth"), "Expected /app unauth redirect target to include /auth.");
    ok("Auth guard redirect on /app");

    const leadsResponse = await request(baseUrl, "/api/leads/simple", {
      headers: { Cookie: cookieHeader },
    });
    const leadsData = await toJson(leadsResponse);
    assert(leadsResponse.ok, `Expected /api/leads/simple success, got ${leadsResponse.status}`);
    assert(Array.isArray(leadsData.leads), "Expected leads array from /api/leads/simple.");
    ok("Authenticated API access");

    const handle = `smoke_${Date.now().toString(36)}`;
    const csvFirst = `ig_username,intent,timeline,lead_temp,source,notes,stage\n${handle},buy,soon,Warm,IG DM,smoke import 1,New\n${handle},buy,soon,Warm,IG DM,duplicate row,New\n`;
    const formOne = new FormData();
    formOne.append("file", new Blob([csvFirst], { type: "text/csv" }), "smoke-first.csv");

    const importOne = await request(baseUrl, "/api/import-leads", {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: formOne,
    });
    const importOneData = await toJson(importOne);
    assert(importOne.ok, `First import failed: ${JSON.stringify(importOneData)}`);
    assert(importOneData.inserted === 1, `Expected first import inserted=1, got ${importOneData.inserted}`);
    assert(importOneData.skipped >= 1, `Expected first import skipped>=1, got ${importOneData.skipped}`);
    ok("Import dedupe inside single CSV");

    const csvSecond = `ig_username,intent,timeline,lead_temp,source,notes,stage\n${handle},invest,30 days,Hot,IG DM,smoke import 2,Contacted\n`;
    const formTwo = new FormData();
    formTwo.append("file", new Blob([csvSecond], { type: "text/csv" }), "smoke-second.csv");

    const importTwo = await request(baseUrl, "/api/import-leads", {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: formTwo,
    });
    const importTwoData = await toJson(importTwo);
    assert(importTwo.ok, `Second import failed: ${JSON.stringify(importTwoData)}`);
    assert(importTwoData.updated === 1, `Expected second import updated=1, got ${importTwoData.updated}`);
    ok("Import upsert update path (no duplicate contact creation)");

    const leadsAfterImport = await request(baseUrl, "/api/leads/simple", {
      headers: { Cookie: cookieHeader },
    });
    const leadsAfterData = await toJson(leadsAfterImport);
    const lead = (leadsAfterData.leads || []).find((row) => row.ig_username === handle);
    assert(lead?.id, "Could not resolve imported lead id for reminder test.");

    const reminderCreate = await request(baseUrl, "/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ lead_id: lead.id, preset: "1d", note: "Smoke reminder" }),
    });
    const reminderCreateData = await toJson(reminderCreate);
    assert(reminderCreate.ok, `Reminder create failed: ${JSON.stringify(reminderCreateData)}`);
    const reminderId = reminderCreateData.reminder?.id;
    assert(typeof reminderId === "string" && reminderId.length > 0, "Reminder id missing after create.");

    const reminderDone = await request(baseUrl, `/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ status: "done" }),
    });
    const reminderDoneData = await toJson(reminderDone);
    assert(reminderDone.ok, `Reminder update failed: ${JSON.stringify(reminderDoneData)}`);
    assert(reminderDoneData.reminder?.status === "done", "Reminder did not transition to done.");
    ok("Reminders create + complete");

    const intakeIdentity = Date.now().toString(36);
    const intakePayload = {
      full_name: `Smoke Intake ${intakeIdentity}`,
      email: `smoke-intake+${intakeIdentity}@example.com`,
      phone: "3125550123",
      source: "website_intake",
      stage: "New",
      lead_temp: "Warm",
      intent: "buy",
      timeline: "0-30 days",
      notes: "smoke intake submission",
    };

    const intakeOne = await request(baseUrl, "/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intakePayload),
    });
    const intakeOneData = await toJson(intakeOne);
    assert(intakeOne.ok, `Intake first submit failed: ${JSON.stringify(intakeOneData)}`);
    assert(intakeOneData.ok === true, "Expected intake first submit to return ok=true.");
    assert(
      intakeOneData.status === "inserted" || intakeOneData.status === "updated",
      `Expected intake status inserted/updated, got ${intakeOneData.status}`
    );

    const intakeTwo = await request(baseUrl, "/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intakePayload),
    });
    const intakeTwoData = await toJson(intakeTwo);
    assert(intakeTwo.ok, `Intake second submit failed: ${JSON.stringify(intakeTwoData)}`);
    assert(intakeTwoData.ok === true, "Expected intake second submit to return ok=true.");
    assert(intakeTwoData.status === "updated", "Expected intake second submit to update existing lead.");
    ok("Questionnaire intake insert + update path");

    console.log("PASS: Solo smoke suite complete.");
  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : "Unknown smoke test failure.");
});
