#!/usr/bin/env node

import fs from "fs";
import path from "path";

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

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeMode(rawMode) {
  if (!rawMode) return "core";
  const cleaned = rawMode.trim().toLowerCase();
  if (cleaned === "solo-prod" || cleaned === "solo_prod") return "solo_prod";
  return cleaned;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = normalizeMode(modeArg ? modeArg.split("=")[1] : "core");

const REQUIRED_BY_MODE = {
  core: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  meta: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "META_APP_ID",
    "META_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN",
    "META_TOKEN_ENCRYPTION_KEY",
  ],
  solo_prod: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "INTAKE_AGENT_ID",
    "INGEST_WEBHOOK_SECRET",
    "INGEST_PROCESSOR_SECRET",
    "RATE_LIMIT_REDIS_REST_URL",
    "RATE_LIMIT_REDIS_REST_TOKEN",
  ],
};

if (!Object.prototype.hasOwnProperty.call(REQUIRED_BY_MODE, mode)) {
  console.error("Unknown mode. Use --mode=core, --mode=meta, or --mode=solo-prod.");
  process.exit(1);
}

const required = [...REQUIRED_BY_MODE[mode]];

if (mode === "solo_prod" && process.env.NEXT_PUBLIC_FEATURE_META_ENABLED === "true") {
  for (const key of REQUIRED_BY_MODE.meta) {
    if (!required.includes(key)) required.push(key);
  }
}

if (mode === "solo_prod" && process.env.FEATURE_MANYCHAT_ENABLED === "true") {
  for (const key of ["MANYCHAT_WEBHOOK_SECRET", "MANYCHAT_AGENT_ID"]) {
    if (!required.includes(key)) required.push(key);
  }
}

const missing = required.filter((name) => {
  const value = process.env[name];
  return !value || value.trim() === "";
});

if (missing.length > 0) {
  console.error(`Missing required env vars for ${mode} mode:`);
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl && !isValidUrl(supabaseUrl)) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is present but is not a valid http(s) URL.");
  process.exit(1);
}

if (mode === "solo_prod") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl || !isHttpsUrl(siteUrl)) {
    console.error("NEXT_PUBLIC_SITE_URL must be set to an https URL in solo-prod mode.");
    process.exit(1);
  }

  const redisUrl = process.env.RATE_LIMIT_REDIS_REST_URL;
  if (!redisUrl || !isHttpsUrl(redisUrl)) {
    console.error("RATE_LIMIT_REDIS_REST_URL must be set to an https URL in solo-prod mode.");
    process.exit(1);
  }

  const intakeAgentId = process.env.INTAKE_AGENT_ID || "";
  if (!isUuid(intakeAgentId)) {
    console.error("INTAKE_AGENT_ID must be a valid UUID in solo-prod mode.");
    process.exit(1);
  }

  if (process.env.FEATURE_MANYCHAT_ENABLED === "true") {
    const manychatAgentId = process.env.MANYCHAT_AGENT_ID || "";
    if (!isUuid(manychatAgentId)) {
      console.error("MANYCHAT_AGENT_ID must be a valid UUID when FEATURE_MANYCHAT_ENABLED=true.");
      process.exit(1);
    }
  }

  if (process.env.META_WEBHOOK_DEV_HEADER_ENABLED === "true") {
    console.error("META_WEBHOOK_DEV_HEADER_ENABLED must not be true in solo-prod mode.");
    process.exit(1);
  }
}

console.log(`Env preflight passed (${mode} mode).`);
