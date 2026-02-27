"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

const STAGES = ["New", "Contacted", "Warm", "Hot", "Closed"] as const;
const TEMPS = ["Cold", "Warm", "Hot"] as const;

type Stage = (typeof STAGES)[number];
type Temp = (typeof TEMPS)[number];

type ImportRow = {
  ig_username: string;
  intent?: string;
  timeline?: string;
  lead_temp?: Temp | string;
  source?: string;
  notes?: string;
  stage?: Stage | string;
  timestamp?: string;
};

function normIg(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function cleanStr(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function pickHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

// Very small CSV parser (handles commas + quotes).
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // double quote escape
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      lines.push(cur.replace(/\r$/, ""));
      cur = "";
      continue;
    }

    cur += ch;
  }
  if (cur.length) lines.push(cur.replace(/\r$/, ""));

  const splitLine = (line: string) => {
    const out: string[] = [];
    let cell = "";
    let q = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        const next = line[i + 1];
        if (q && next === '"') {
          cell += '"';
          i++;
        } else {
          q = !q;
        }
        continue;
      }

      if (ch === "," && !q) {
        out.push(cell);
        cell = "";
        continue;
      }

      cell += ch;
    }
    out.push(cell);
    return out.map((s) => s.trim());
  };

  const rawHeaders = splitLine(lines[0] ?? "");
  const headers = rawHeaders.map(pickHeader);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.every((c) => c.trim() === "")) continue;

    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cols[c] ?? "";
    }
    rows.push(obj);
  }

  return { headers, rows };
}

export default function ImportPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
    if (!file) {
      setStatus("Pick a CSV file first.");
      return;
    }

    setBusy(true);
    setStatus("Reading file...");

    try {
      // 1) Confirm logged-in user (this is the agent_id we must write)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Not logged in. Go to /auth and log in first.");

      const agent_id = user.id;

      // 2) Read + parse CSV
      const text = await file.text();
      const parsed = parseCsv(text);

      // Expected headers from your Sheets export
      // Timestamp, IG Username, Intent, Timeline, Lead Temp, Source, Notes, Stage
      const toRow = (r: Record<string, string>): ImportRow | null => {
        const igRaw =
          r["ig username"] ?? r["ig_username"] ?? r["instagram"] ?? r["ig handle"] ?? "";

        const ig = cleanStr(igRaw);
        if (!ig) return null;

        const stageRaw = cleanStr(r["stage"]);
        const stage = stageRaw && STAGES.includes(stageRaw as any) ? (stageRaw as Stage) : "New";

        const tempRaw = cleanStr(r["lead temp"] ?? r["lead_temp"]);
        const lead_temp =
          tempRaw && TEMPS.includes(tempRaw as any) ? (tempRaw as Temp) : tempRaw; // allow unknowns without breaking

        const timestamp = cleanStr(r["timestamp"]);

        return {
          ig_username: normIg(ig),
          intent: cleanStr(r["intent"]),
          timeline: cleanStr(r["timeline"]),
          lead_temp,
          source: cleanStr(r["source"]),
          notes: cleanStr(r["notes"]),
          stage,
          timestamp,
        };
      };

      const cleaned: ImportRow[] = parsed.rows
        .map(toRow)
        .filter((x): x is ImportRow => Boolean(x));

      if (cleaned.length === 0) {
        setStatus("No rows found with an IG Username column.");
        setBusy(false);
        return;
      }

      setStatus(`Parsed ${cleaned.length} rows. Uploading...`);

      // 3) Build upsert payload with agent_id
      // Important: we must include agent_id so RLS insert policy passes.
      const payload = cleaned.map((r) => ({
        agent_id,
        ig_username: r.ig_username,
        intent: r.intent ?? null,
        timeline: r.timeline ?? null,
        lead_temp: r.lead_temp ?? null,
        source: r.source ?? null,
        notes: r.notes ?? null,
        stage: (r.stage ?? "New") as string,
        // Only include timestamp if present; otherwise let DB default handle it (if you have one).
        ...(r.timestamp ? { timestamp: r.timestamp } : {}),
      }));

      // 4) Upsert in chunks so we don’t blow request limits
      const chunkSize = 500;
      let upserted = 0;

      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);

        const { error } = await supabase
          .from("leads")
          .upsert(chunk, { onConflict: "agent_id,ig_username" });

        if (error) throw error;
        upserted += chunk.length;
        setStatus(`Uploaded ${upserted}/${payload.length}...`);
      }

      setStatus(`✅ Done. Upserted ${payload.length} lead(s).`);
    } catch (e: any) {
      setStatus(`❌ Import failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Import Leads</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            Upload a CSV exported from your Google Sheet. We’ll upsert by{" "}
            <code>(agent_id, ig_username)</code> so there are no duplicates.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/app" style={{ textDecoration: "none" }}>
            ← Dashboard
          </Link>
          <Link href="/app/kanban" style={{ textDecoration: "none" }}>
            Pipeline →
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleUpload}
            disabled={busy || !file}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: busy || !file ? "#f5f5f5" : "#fff",
              cursor: busy || !file ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div style={{ marginTop: 12, color: status.startsWith("❌") ? "#b00020" : "#333" }}>
          {status || "Pick a CSV and click Upload."}
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
          Expected columns (case-insensitive): <b>IG Username</b>, Intent, Timeline, Lead Temp, Source,
          Notes, Stage, Timestamp.
        </div>
      </div>
    </main>
  );
}