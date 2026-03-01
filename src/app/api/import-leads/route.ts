import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type CsvRow = Record<string, string>;

type ImportError = {
  row: number;
  message: string;
};

const ALLOWED_HEADERS = new Set([
  "ig_username",
  "intent",
  "timeline",
  "lead_temp",
  "source",
  "notes",
  "stage",
]);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeIg(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
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

function friendlyDbMessage(error: { code?: string | null; message: string }): string {
  if (
    error.code === "23505" ||
    /duplicate key value|unique constraint/i.test(error.message)
  ) {
    return "Duplicate IG username for this account.";
  }
  return error.message;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field 'file'." }, { status: 400 });
    }

    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const text = await file.text();
    const parsed = parseCsv(text);

    if (!parsed.headers.includes("ig_username")) {
      return NextResponse.json(
        {
          error: "Missing required header: ig_username.",
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [{ row: 1, message: "Missing required header: ig_username." }],
        },
        { status: 400 }
      );
    }

    const unknownHeaders = parsed.headers.filter((h) => h.length > 0 && !ALLOWED_HEADERS.has(h));
    if (unknownHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Unsupported header(s): ${unknownHeaders.join(", ")}`,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: [{ row: 1, message: `Unsupported header(s): ${unknownHeaders.join(", ")}` }],
        },
        { status: 400 }
      );
    }

    const errors: ImportError[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const seenInFile = new Set<string>();
    const validRows: Array<{ row: number; data: CsvRow; ig: string }> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const rowNumber = i + 2;
      const raw = parsed.rows[i]["ig_username"] ?? "";
      const normalized = normalizeIg(raw);

      if (!normalized) {
        errors.push({ row: rowNumber, message: "ig_username is required." });
        continue;
      }

      if (seenInFile.has(normalized)) {
        skipped += 1;
        continue;
      }
      seenInFile.add(normalized);

      validRows.push({ row: rowNumber, data: parsed.rows[i], ig: normalized });
    }

    const existingHandles = new Set<string>();
    const chunkSize = 500;

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize).map((row) => row.ig);
      const { data, error } = await supabase
        .from("leads")
        .select("ig_username")
        .in("ig_username", chunk);

      if (error) {
        return NextResponse.json(
          {
            error: friendlyDbMessage(error),
            inserted,
            updated,
            skipped,
            errors,
          },
          { status: 500 }
        );
      }

      for (const row of data ?? []) {
        if (typeof row.ig_username === "string") {
          existingHandles.add(normalizeIg(row.ig_username));
        }
      }
    }

    for (const row of validRows) {
      const stageValue = asOptionalString(row.data["stage"]);
      const intent = asOptionalString(row.data["intent"]);
      const timeline = asOptionalString(row.data["timeline"]);
      const leadTemp = asOptionalString(row.data["lead_temp"]);
      const source = asOptionalString(row.data["source"]);
      const notes = asOptionalString(row.data["notes"]);

      const payload: Record<string, string> = {
        agent_id: user.id,
        ig_username: row.ig,
        stage: stageValue ?? "New",
        time_last_updated: new Date().toISOString(),
      };
      if (intent !== null) payload.intent = intent;
      if (timeline !== null) payload.timeline = timeline;
      if (leadTemp !== null) payload.lead_temp = leadTemp;
      if (source !== null) payload.source = source;
      if (notes !== null) payload.notes = notes;

      const existed = existingHandles.has(row.ig);

      const { error } = await supabase
        .from("leads")
        .upsert(payload, { onConflict: "agent_id,ig_username" });

      if (error) {
        errors.push({ row: row.row, message: friendlyDbMessage(error) });
        continue;
      }

      if (existed) {
        updated += 1;
      } else {
        inserted += 1;
        existingHandles.add(row.ig);
      }
    }

    return NextResponse.json({ inserted, updated, skipped, errors });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Import failed.";

    return NextResponse.json(
      {
        error: friendlyDbMessage({ message: errorMessage }),
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [] as ImportError[],
      },
      { status: 500 }
    );
  }
}
