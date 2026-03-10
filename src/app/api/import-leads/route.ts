import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeConsent } from "@/lib/consent";
import {
  applyLeadCreatedRules,
  listActiveLeadCreatedRules,
  type LeadForAutomation,
} from "@/lib/automation-rules";

type CsvRow = Record<string, string>;

type ImportError = {
  row: number;
  message: string;
};

type ImportSkip = {
  row: number;
  reason: string;
};

type StageMappingSummary = {
  raw_stage: string;
  mapped_stage: string;
  count: number;
};

type PreparedImportRow = {
  row: number;
  data: CsvRow;
  identity: string;
  igInput: string;
  emailCanonical: string;
  phoneCanonical: string;
  externalId: string;
};

type ValidImportRow = PreparedImportRow & {
  igUsername: string;
};

type UpsertedLeadRow = {
  id: string;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
};

const KNOWN_HEADERS = new Set([
  "ig_username",
  "email",
  "phone",
  "first_name",
  "last_name",
  "full_name",
  "tags",
  "external_id",
  "intent",
  "timeline",
  "lead_temp",
  "source",
  "notes",
  "stage",
  "budget_range",
  "location_area",
  "contact_preference",
  "next_step",
  "consent_to_email",
  "consent_to_sms",
  "consent_source",
  "consent_timestamp",
  "consent_text_snapshot",
]);

const HEADER_ALIASES: Record<string, string> = {
  instagram: "ig_username",
  instagram_handle: "ig_username",
  ig_handle: "ig_username",
  username: "ig_username",
  contact: "ig_username",
  instagram_username: "ig_username",
  email_address: "email",
  e_mail: "email",
  primary_email: "email",
  email_1: "email",
  email1: "email",
  mobile: "phone",
  cell: "phone",
  phone_number: "phone",
  primary_phone: "phone",
  phone_1: "phone",
  phone1: "phone",
  firstname: "first_name",
  lastname: "last_name",
  name: "full_name",
  first: "first_name",
  last: "last_name",
  tag: "tags",
  labels: "tags",
  lead_id: "external_id",
  fub_id: "external_id",
  contact_id: "external_id",
  lead_temperature: "lead_temp",
  temperature: "lead_temp",
  status: "stage",
  price_range: "budget_range",
  budget: "budget_range",
  area: "location_area",
  location: "location_area",
  preferred_contact: "contact_preference",
  contact_method: "contact_preference",
  next_action: "next_step",
};

const ALLOWED_STAGES = new Set(["New", "Contacted", "Qualified", "Closed"]);
const ALLOWED_TEMPS = new Set(["Cold", "Warm", "Hot"]);
const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const IMPORT_MAX_ROWS = 5000;
const LOOKUP_CHUNK_SIZE = 500;
const WRITE_CHUNK_SIZE = 200;
const STAGE_ALIASES: Record<string, string> = {
  lead: "New",
  "new lead": "New",
  inquiry: "New",
  "new inquiry": "New",
  prospect: "Contacted",
  "warm prospect": "Contacted",
  sphere: "Contacted",
  nurture: "Contacted",
  engaged: "Contacted",
  "follow up": "Contacted",
  "hot prospect": "Qualified",
  "active buyer": "Qualified",
  "active seller": "Qualified",
  client: "Qualified",
  qualified: "Qualified",
  "under contract": "Closed",
  sold: "Closed",
  closed: "Closed",
  "closed won": "Closed",
  won: "Closed",
  "closed lost": "Closed",
  lost: "Closed",
};
const LEAD_TEMP_ALIASES: Record<string, string> = {
  cold: "Cold",
  "cold prospect": "Cold",
  warm: "Warm",
  lead: "Warm",
  prospect: "Warm",
  "warm prospect": "Warm",
  sphere: "Warm",
  hot: "Hot",
  "hot prospect": "Hot",
};

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return HEADER_ALIASES[normalized] || normalized;
}

function normalizeIg(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function normalizeNameIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function buildSyntheticIgUsername(identity: string): string {
  return `import_lead_${shortHash(identity)}`;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cell.trim());
      cell = "";
      continue;
    }

    cell += ch;
  }

  out.push(cell.trim());
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      lines.push(current.replace(/\r$/, ""));
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    lines.push(current.replace(/\r$/, ""));
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows: CsvRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const cols = splitCsvLine(lines[lineIndex]);
    if (cols.every((c) => c === "")) continue;

    const row: CsvRow = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cols[i] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function asOptionalString(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizedToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeStageInput(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  for (const allowed of ALLOWED_STAGES) {
    if (allowed.toLowerCase() === trimmed.toLowerCase()) return allowed;
  }
  return STAGE_ALIASES[normalizedToken(trimmed)] || null;
}

function normalizeLeadTempInput(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  for (const allowed of ALLOWED_TEMPS) {
    if (allowed.toLowerCase() === trimmed.toLowerCase()) return allowed;
  }
  return LEAD_TEMP_ALIASES[normalizedToken(trimmed)] || null;
}

function friendlyDbMessage(error: { code?: string | null; message: string }): string {
  if (
    error.code === "23505" ||
    /duplicate key value|unique constraint/i.test(error.message)
  ) {
    return "Duplicate lead identity for this account.";
  }
  return error.message;
}

function normalizeSourceChannel(value: string | null): string | null {
  const source = (value || "").trim().toLowerCase();
  if (!source) return null;
  if (source === "ig" || source.includes("instagram")) return "ig";
  if (source === "fb" || source.includes("facebook")) return "fb";
  if (source.includes("webform")) return "webform";
  if (source.includes("website") || source.includes("site")) return "website";
  if (source.includes("email")) return "email";
  if (
    source.includes("phone") ||
    source.includes("call") ||
    source.includes("sms") ||
    source.includes("text")
  ) {
    return "phone";
  }
  return "other";
}

function buildLeadPayload(userId: string, row: ValidImportRow): Record<string, unknown> {
  const nowIso = new Date().toISOString();
  const stageValue = asOptionalString(row.data["stage"]);
  const intent = asOptionalString(row.data["intent"]);
  const timeline = asOptionalString(row.data["timeline"]);
  const leadTemp = asOptionalString(row.data["lead_temp"]);
  const source = asOptionalString(row.data["source"]);
  const notes = asOptionalString(row.data["notes"]);
  const budgetRange = asOptionalString(row.data["budget_range"]);
  const locationArea = asOptionalString(row.data["location_area"]);
  const contactPreference = asOptionalString(row.data["contact_preference"]);
  const nextStep = asOptionalString(row.data["next_step"]);
  const firstName = asOptionalString(row.data["first_name"]);
  const lastName = asOptionalString(row.data["last_name"]);
  const fullName = asOptionalString(row.data["full_name"]);
  const email = asOptionalString(row.data["email"]);
  const phone = asOptionalString(row.data["phone"]);
  const canonicalEmail = email ? normalizeEmail(email) : null;
  const canonicalPhone = phone ? normalizePhone(phone) || null : null;
  const tags = asOptionalString(row.data["tags"]);
  const externalId = asOptionalString(row.data["external_id"]);
  const sourceChannel = normalizeSourceChannel(source);
  const sourceValue = source || "csv_import";
  const consent = normalizeConsent({
    source: sourceValue,
    consent_to_email: row.data["consent_to_email"],
    consent_to_sms: row.data["consent_to_sms"],
    consent_source: row.data["consent_source"],
    consent_timestamp: row.data["consent_timestamp"],
    consent_text_snapshot: row.data["consent_text_snapshot"],
    nowIso,
  });

  const sourceDetail: Record<string, string> = {};
  const customFields: Record<string, string> = {};
  if (firstName) sourceDetail.first_name = firstName;
  if (lastName) sourceDetail.last_name = lastName;
  if (fullName) sourceDetail.full_name = fullName;
  if (email) sourceDetail.email = email;
  if (phone) sourceDetail.phone = phone;
  if (tags) sourceDetail.tags = tags;
  if (externalId) sourceDetail.external_id = externalId;
  sourceDetail.import_identity = row.identity;

  for (const [key, value] of Object.entries(row.data)) {
    if (KNOWN_HEADERS.has(key)) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    sourceDetail[`raw_${key}`] = trimmed;
    customFields[key] = trimmed;
  }

  const payload: Record<string, unknown> = {
    agent_id: userId,
    owner_user_id: userId,
    assignee_user_id: userId,
    ig_username: row.igUsername,
    stage: stageValue ?? "New",
    time_last_updated: nowIso,
    latest_source_method: "import",
    first_source_method: "import",
    source_confidence: sourceChannel ? "exact" : "unknown",
    source_detail: sourceDetail,
    raw_email: email,
    raw_phone: phone,
    canonical_email: canonicalEmail,
    canonical_phone: canonicalPhone,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    source_ref_id: externalId,
    consent_to_email: consent.consent_to_email,
    consent_to_sms: consent.consent_to_sms,
    consent_source: consent.consent_source,
    consent_timestamp: consent.consent_timestamp,
    consent_text_snapshot: consent.consent_text_snapshot,
    custom_fields: customFields,
  };

  if (intent !== null) payload.intent = intent;
  if (timeline !== null) payload.timeline = timeline;
  if (leadTemp !== null) payload.lead_temp = leadTemp;
  if (source !== null) payload.source = source;
  if (sourceChannel) {
    payload.first_source_channel = sourceChannel;
    payload.latest_source_channel = sourceChannel;
  }
  if (notes !== null) payload.notes = notes;
  if (budgetRange !== null) payload.budget_range = budgetRange;
  if (locationArea !== null) payload.location_area = locationArea;
  if (contactPreference !== null) payload.contact_preference = contactPreference;
  if (nextStep !== null) payload.next_step = nextStep;

  return payload;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field 'file'." }, { status: 400 });
    }

    if (file.size > IMPORT_MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `CSV is too large. Max ${(IMPORT_MAX_FILE_BYTES / (1024 * 1024)).toFixed(
            0
          )}MB.`,
        },
        { status: 413 }
      );
    }

    const supabase = await supabaseServer();
    const auth = await loadAccessContext(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const admin = supabaseAdmin();

    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: "CSV is empty." }, { status: 400 });
    }

    if (parsed.rows.length > IMPORT_MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows. Max ${IMPORT_MAX_ROWS} rows per import.` },
        { status: 400 }
      );
    }

    const errors: ImportError[] = [];
    const skippedRows: ImportSkip[] = [];
    const stageMappingCounts = new Map<string, number>();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const insertedLeadsForAutomation: LeadForAutomation[] = [];

    const preparedRows: PreparedImportRow[] = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const rowNumber = i + 2;
      const rowData = parsed.rows[i];
      const ig = normalizeIg(rowData["ig_username"] ?? "");
      const email = normalizeEmail(rowData["email"] ?? "");
      const phone = normalizePhone(rowData["phone"] ?? "");
      const externalId = (rowData["external_id"] ?? "").trim().toLowerCase();
      const firstName = asOptionalString(rowData["first_name"]);
      const lastName = asOptionalString(rowData["last_name"]);
      const fullName =
        asOptionalString(rowData["full_name"]) ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        null;
      const nameIdentity = fullName ? normalizeNameIdentity(fullName) : "";
      const rawStage = asOptionalString(rowData["stage"]);
      const normalizedStage = normalizeStageInput(rawStage);
      if (rawStage && !normalizedStage) {
        rowData["import_stage_raw"] = rawStage;
      }
      rowData["stage"] = normalizedStage || "New";
      if (rawStage) {
        const stageKey = `${rawStage}=>${rowData["stage"]}`;
        stageMappingCounts.set(stageKey, (stageMappingCounts.get(stageKey) || 0) + 1);
      }

      const rawLeadTemp = asOptionalString(rowData["lead_temp"]);
      const normalizedLeadTempFromInput = normalizeLeadTempInput(rawLeadTemp);
      const inferredLeadTempFromStage = rawLeadTemp ? null : normalizeLeadTempInput(rawStage);
      if (rawLeadTemp && !normalizedLeadTempFromInput) {
        rowData["import_lead_temp_raw"] = rawLeadTemp;
      }
      rowData["lead_temp"] = normalizedLeadTempFromInput || inferredLeadTempFromStage || "";

      const identity =
        (ig ? `ig_${ig}` : "") ||
        (email ? `email_${email}` : "") ||
        (phone ? `phone_${phone}` : "") ||
        (externalId ? `ext_${externalId}` : "") ||
        (nameIdentity ? `name_${nameIdentity}` : "");

      if (!identity) {
        errors.push({
          row: rowNumber,
          message:
            "Row needs one identity value: ig_username, email, phone, external_id, or full_name.",
        });
        continue;
      }

      preparedRows.push({
        row: rowNumber,
        data: rowData,
        identity,
        igInput: ig,
        emailCanonical: email,
        phoneCanonical: phone,
        externalId,
      });
    }

    const existingHandles = new Set<string>();
    const existingByEmail = new Map<string, string>();
    const existingByPhone = new Map<string, string>();
    const existingByExternal = new Map<string, string>();

    const registerExistingRows = (
      rows: Array<{
        ig_username?: string | null;
        canonical_email?: string | null;
        canonical_phone?: string | null;
        source_ref_id?: string | null;
      }>
    ) => {
      for (const row of rows) {
        const handle = normalizeIg(row.ig_username || "");
        if (!handle) continue;

        existingHandles.add(handle);

        const email = normalizeEmail((row.canonical_email || "").trim());
        if (email) existingByEmail.set(email, handle);

        const phone = normalizePhone((row.canonical_phone || "").trim());
        if (phone) existingByPhone.set(phone, handle);

        const externalId = ((row.source_ref_id || "").trim() || "").toLowerCase();
        if (externalId) existingByExternal.set(externalId, handle);
      }
    };

    const queryExisting = async (
      column: "ig_username" | "canonical_email" | "canonical_phone" | "source_ref_id",
      values: string[]
    ) => {
      if (values.length === 0) return null;

      for (let i = 0; i < values.length; i += LOOKUP_CHUNK_SIZE) {
        const chunk = values.slice(i, i + LOOKUP_CHUNK_SIZE);
        const { data, error } = await supabase
          .from("leads")
          .select("ig_username,canonical_email,canonical_phone,source_ref_id")
          .eq("agent_id", auth.context.user.id)
          .in(column, chunk);

        if (error) return error;
        registerExistingRows((data || []) as Array<Record<string, string | null>>);
      }

      return null;
    };

    const igInputs = Array.from(
      new Set(preparedRows.map((row) => row.igInput).filter(Boolean))
    );
    const emailInputs = Array.from(
      new Set(preparedRows.map((row) => row.emailCanonical).filter(Boolean))
    );
    const phoneInputs = Array.from(
      new Set(preparedRows.map((row) => row.phoneCanonical).filter(Boolean))
    );
    const externalInputs = Array.from(
      new Set(preparedRows.map((row) => row.externalId).filter(Boolean))
    );

    for (const [column, values] of [
      ["ig_username", igInputs],
      ["canonical_email", emailInputs],
      ["canonical_phone", phoneInputs],
      ["source_ref_id", externalInputs],
    ] as const) {
      const lookupError = await queryExisting(column, values);
      if (lookupError) {
        return NextResponse.json(
          {
            error: friendlyDbMessage(lookupError),
            inserted,
            updated,
            skipped,
            errors,
          },
          { status: 500 }
        );
      }
    }

    const existingHandlesBefore = new Set(existingHandles);

    const fileByEmail = new Map<string, string>();
    const fileByPhone = new Map<string, string>();
    const fileByExternal = new Map<string, string>();
    const seenHandlesInFile = new Set<string>();
    const validRows: ValidImportRow[] = [];

    for (const row of preparedRows) {
      const dbMatchedHandle =
        (row.externalId ? existingByExternal.get(row.externalId) : undefined) ||
        (row.emailCanonical ? existingByEmail.get(row.emailCanonical) : undefined) ||
        (row.phoneCanonical ? existingByPhone.get(row.phoneCanonical) : undefined) ||
        undefined;

      const fileMatchedHandle =
        (row.externalId ? fileByExternal.get(row.externalId) : undefined) ||
        (row.emailCanonical ? fileByEmail.get(row.emailCanonical) : undefined) ||
        (row.phoneCanonical ? fileByPhone.get(row.phoneCanonical) : undefined) ||
        undefined;

      const existingIgHandle =
        row.igInput && existingHandlesBefore.has(row.igInput) ? row.igInput : "";

      const resolvedHandle = normalizeIg(
        existingIgHandle ||
          dbMatchedHandle ||
          row.igInput ||
          fileMatchedHandle ||
          buildSyntheticIgUsername(row.identity)
      );

      if (!resolvedHandle) {
        errors.push({ row: row.row, message: "Could not derive a stable identity handle." });
        skipped += 1;
        skippedRows.push({ row: row.row, reason: "Could not resolve a stable identity handle." });
        continue;
      }

      if (seenHandlesInFile.has(resolvedHandle)) {
        skipped += 1;
        skippedRows.push({ row: row.row, reason: "Duplicate identity in this CSV file." });
        continue;
      }

      seenHandlesInFile.add(resolvedHandle);

      if (row.emailCanonical) fileByEmail.set(row.emailCanonical, resolvedHandle);
      if (row.phoneCanonical) fileByPhone.set(row.phoneCanonical, resolvedHandle);
      if (row.externalId) fileByExternal.set(row.externalId, resolvedHandle);

      validRows.push({
        ...row,
        igUsername: resolvedHandle,
      });
    }

    for (let i = 0; i < validRows.length; i += WRITE_CHUNK_SIZE) {
      const chunkRows = validRows.slice(i, i + WRITE_CHUNK_SIZE);
      const chunkPayload = chunkRows.map((row) =>
        buildLeadPayload(auth.context.user.id, row)
      );

      const existedBefore = new Set(
        chunkRows
          .filter((row) => existingHandlesBefore.has(row.igUsername))
          .map((row) => row.igUsername)
      );

      const { data: chunkData, error: chunkError } = await supabase
        .from("leads")
        .upsert(chunkPayload, { onConflict: "agent_id,ig_username" })
        .select("id,ig_username,stage,lead_temp");

      if (!chunkError) {
        const upsertedRows = (chunkData || []) as UpsertedLeadRow[];
        const upsertedByHandle = new Map<string, UpsertedLeadRow>();

        for (const upserted of upsertedRows) {
          const handle = normalizeIg(upserted.ig_username || "");
          if (handle) upsertedByHandle.set(handle, upserted);
        }

        for (const row of chunkRows) {
          if (existedBefore.has(row.igUsername)) {
            updated += 1;
          } else {
            inserted += 1;
            existingHandlesBefore.add(row.igUsername);
            const upserted = upsertedByHandle.get(row.igUsername);
            if (upserted?.id) {
              insertedLeadsForAutomation.push({
                id: upserted.id,
                ig_username: upserted.ig_username,
                stage: upserted.stage,
                lead_temp: upserted.lead_temp,
              });
            }
          }
        }

        continue;
      }

      for (const row of chunkRows) {
        const existed = existingHandlesBefore.has(row.igUsername);

        const { data: upserted, error } = await supabase
          .from("leads")
          .upsert(buildLeadPayload(auth.context.user.id, row), {
            onConflict: "agent_id,ig_username",
          })
          .select("id,ig_username,stage,lead_temp")
          .single();

        if (error) {
          errors.push({ row: row.row, message: friendlyDbMessage(error) });
          continue;
        }

        if (existed) {
          updated += 1;
        } else {
          inserted += 1;
          existingHandlesBefore.add(row.igUsername);

          if (upserted?.id) {
            insertedLeadsForAutomation.push({
              id: upserted.id,
              ig_username: upserted.ig_username,
              stage: upserted.stage,
              lead_temp: upserted.lead_temp,
            });
          }
        }
      }
    }

    if (insertedLeadsForAutomation.length > 0) {
      const rules = await listActiveLeadCreatedRules(admin, auth.context);
      if (rules.length > 0) {
        const seen = new Set<string>();
        for (const lead of insertedLeadsForAutomation) {
          if (seen.has(lead.id)) continue;
          seen.add(lead.id);
          await applyLeadCreatedRules(admin, auth.context, lead, rules);
        }
      }
    }
    const stageMappings: StageMappingSummary[] = Array.from(stageMappingCounts.entries())
      .map(([key, count]) => {
        const [rawStage, mappedStage] = key.split("=>");
        return { raw_stage: rawStage, mapped_stage: mappedStage, count };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total_rows: parsed.rows.length,
      inserted,
      updated,
      skipped,
      errors,
      skipped_rows: skippedRows,
      stage_mappings: stageMappings,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import failed.";

    return NextResponse.json(
      {
        error: friendlyDbMessage({ message: errorMessage }),
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [] as ImportError[],
        skipped_rows: [] as ImportSkip[],
        stage_mappings: [] as StageMappingSummary[],
      },
      { status: 500 }
    );
  }
}
