"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";

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

type ImportResponse = {
  total_rows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  skipped_rows?: ImportSkip[];
  stage_mappings?: StageMappingSummary[];
};

type CsvPreview = {
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  detectedMappings: StageMappingSummary[];
};

type FlowStep = "upload" | "review" | "importing" | "complete";

const STAGE_ALIAS_PREVIEW: Record<string, string> = {
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

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeStagePreview(value: string): string {
  if (!value.trim()) return "New";
  const normalized = normalizeToken(value);
  if (["new", "contacted", "qualified", "closed"].includes(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return STAGE_ALIAS_PREVIEW[normalized] || "New";
}

function parseCsvPreview(text: string): CsvPreview {
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rowCount: 0, sampleRows: [], detectedMappings: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  const sampleRows = rows.slice(0, 5);

  const stageIdx = headers.findIndex((header) => normalizeToken(header) === "stage" || normalizeToken(header) === "status");
  const stageCounts = new Map<string, number>();

  if (stageIdx >= 0) {
    for (const row of rows) {
      const raw = row[stageIdx] || "";
      if (!raw.trim()) continue;
      const mapped = normalizeStagePreview(raw);
      const key = `${raw}=>${mapped}`;
      stageCounts.set(key, (stageCounts.get(key) || 0) + 1);
    }
  }

  const detectedMappings: StageMappingSummary[] = Array.from(stageCounts.entries())
    .map(([key, count]) => {
      const [rawStage, mappedStage] = key.split("=>");
      return { raw_stage: rawStage, mapped_stage: mappedStage, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return { headers, rowCount: rows.length, sampleRows, detectedMappings };
}

function downloadTextFile(name: string, body: string) {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildImportReport(result: ImportResponse): string {
  const rows: string[] = ["row,action,detail"];
  for (const err of result.errors || []) {
    rows.push(`${err.row},error,${JSON.stringify(err.message)}`);
  }
  for (const skip of result.skipped_rows || []) {
    rows.push(`${skip.row},skipped,${JSON.stringify(skip.reason)}`);
  }
  return rows.join("\n");
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<FlowStep>("upload");
  const [message, setMessage] = useState("Choose a CSV file and run pre-check.");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const identityHeadersPresent = useMemo(() => {
    if (!preview) return false;
    const headers = preview.headers.map((header) => normalizeToken(header));
    return ["ig username", "email", "phone", "external id", "fub id", "contact id", "full name"].some((key) =>
      headers.includes(key)
    );
  }, [preview]);

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    if (!nextFile) {
      setPreview(null);
      setStep("upload");
      setMessage("Choose a CSV file and run pre-check.");
      return;
    }

    try {
      const text = await nextFile.text();
      const parsed = parseCsvPreview(text);
      setPreview(parsed);
      setStep("review");
      setMessage(`Pre-check complete. ${parsed.rowCount} row(s) detected.`);
    } catch {
      setPreview(null);
      setStep("upload");
      setMessage("Could not parse CSV preview.");
    }
  }

  async function runImport() {
    if (!file) {
      setMessage("Choose a CSV file first.");
      setStep("upload");
      return;
    }

    setStep("importing");
    setMessage("Importing CSV leads...");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import-leads", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as
        | ImportResponse
        | { error?: string; errors?: ImportError[]; skipped_rows?: ImportSkip[]; stage_mappings?: StageMappingSummary[] };

      if (!response.ok) {
        setResult({
          total_rows: preview?.rowCount || 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: Array.isArray(data?.errors) ? data.errors : [],
          skipped_rows: Array.isArray(data?.skipped_rows) ? data.skipped_rows : [],
          stage_mappings: Array.isArray(data?.stage_mappings) ? data.stage_mappings : preview?.detectedMappings || [],
        });
        setStep("complete");
        setMessage((data as { error?: string })?.error || "Import failed.");
        return;
      }

      setResult(data as ImportResponse);
      setStep("complete");
      setMessage("Import complete.");
    } catch {
      setStep("complete");
      setMessage("Import failed. Please try again.");
      setResult({
        total_rows: preview?.rowCount || 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        skipped_rows: [],
        stage_mappings: preview?.detectedMappings || [],
      });
    }
  }

  const reportCsv = result ? buildImportReport(result) : "";
  const visibleErrors = result?.errors?.slice(0, 20) ?? [];
  const visibleSkips = result?.skipped_rows?.slice(0, 20) ?? [];

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">CSV Import</h1>
            <p className="crm-page-subtitle">
              Import safely with validation, mapping preview, and clear post-import reporting inside the Lead Intake system.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/intake" className="crm-btn crm-btn-secondary">
              Lead Intake Hub
            </Link>
            <Link href="/app/list" className="crm-btn crm-btn-secondary">
              Leads
            </Link>
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-12">
        <div className="crm-inline-actions">
          <StatusBadge label={`1. Upload ${step === "upload" ? "(Current)" : ""}`.trim()} tone={step === "upload" ? "info" : "default"} />
          <StatusBadge label={`2. Review ${step === "review" ? "(Current)" : ""}`.trim()} tone={step === "review" ? "info" : "default"} />
          <StatusBadge label={`3. Import ${step === "importing" ? "(Current)" : ""}`.trim()} tone={step === "importing" ? "warn" : "default"} />
          <StatusBadge label={`4. Report ${step === "complete" ? "(Current)" : ""}`.trim()} tone={step === "complete" ? "ok" : "default"} />
        </div>

        <div className="crm-stack-10">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={step === "importing"}
            onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
          />

          <div className="crm-inline-actions">
            <button
              onClick={() => void runImport()}
              disabled={step === "importing" || !file}
              className="crm-btn crm-btn-primary"
            >
              {step === "importing" ? "Importing..." : "Run Import"}
            </button>

            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
                setStep("upload");
                setMessage("Choose a CSV file and run pre-check.");
              }}
              className="crm-btn crm-btn-secondary"
            >
              Reset
            </button>
          </div>

          <div className={`crm-chip ${message.includes("failed") || message.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`} style={{ width: "fit-content" }}>
            {message}
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Pre-Import Review</h2>
        </div>

        {!preview ? (
          <EmptyState title="No file analyzed yet" body="Upload a CSV to review rows, columns, and stage mappings before import." />
        ) : (
          <div className="crm-stack-10">
            <div className="crm-inline-actions">
              <StatusBadge label={`${preview.rowCount} rows detected`} tone="info" />
              <StatusBadge label={`${preview.headers.length} columns detected`} tone="info" />
              <StatusBadge label={identityHeadersPresent ? "Identity columns found" : "No obvious identity headers"} tone={identityHeadersPresent ? "ok" : "warn"} />
            </div>

            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Detected Headers</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {preview.headers.map((header) => (
                  <span key={header} className="crm-chip">{header}</span>
                ))}
              </div>
            </div>

            {preview.detectedMappings.length > 0 ? (
              <div className="crm-card-muted" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Stage Mapping Preview</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {preview.detectedMappings.map((mapping) => (
                    <div key={`${mapping.raw_stage}-${mapping.mapped_stage}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                      <span>{mapping.raw_stage}</span>
                      <span style={{ color: "var(--ink-muted)" }}>
                        {mapping.mapped_stage} ({mapping.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.sampleRows.length > 0 ? (
              <div className="crm-card-muted" style={{ padding: 10, overflowX: "auto" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Sample Rows</div>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                  <thead>
                    <tr>
                      {preview.headers.slice(0, 8).map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-muted)" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, idx) => (
                      <tr key={`sample-${idx}`}>
                        {row.slice(0, 8).map((value, valueIdx) => (
                          <td key={`sample-${idx}-${valueIdx}`} style={{ padding: 6, borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                            {value || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {result ? (
        <section className="crm-card crm-section-card crm-stack-12">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Import Report</h2>
            <div className="crm-page-actions">
              <button
                className="crm-btn crm-btn-secondary"
                onClick={() => downloadTextFile(`import_report_${Date.now()}.csv`, reportCsv)}
              >
                Download Report CSV
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div className="crm-card-muted" style={{ padding: 10 }}><strong>Total:</strong> {result.total_rows || 0}</div>
            <div className="crm-card-muted" style={{ padding: 10 }}><strong>Inserted:</strong> {result.inserted}</div>
            <div className="crm-card-muted" style={{ padding: 10 }}><strong>Updated:</strong> {result.updated}</div>
            <div className="crm-card-muted" style={{ padding: 10 }}><strong>Skipped:</strong> {result.skipped}</div>
            <div className="crm-card-muted" style={{ padding: 10 }}><strong>Errors:</strong> {result.errors.length}</div>
          </div>

          {(result.stage_mappings || []).length > 0 ? (
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Applied Stage Mappings</div>
              <div style={{ display: "grid", gap: 6 }}>
                {(result.stage_mappings || []).map((mapping) => (
                  <div key={`mapping-${mapping.raw_stage}-${mapping.mapped_stage}`} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{mapping.raw_stage}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{mapping.mapped_stage} ({mapping.count})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {visibleErrors.length > 0 ? (
            <div className="crm-card-muted" style={{ padding: 10, color: "var(--danger)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Error Rows ({visibleErrors.length})</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {visibleErrors.map((err, idx) => (
                  <li key={`error-${err.row}-${idx}`}>Row {err.row}: {err.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {visibleSkips.length > 0 ? (
            <div className="crm-card-muted" style={{ padding: 10, color: "var(--warn)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Skipped Rows ({visibleSkips.length})</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {visibleSkips.map((skip, idx) => (
                  <li key={`skip-${skip.row}-${idx}`}>Row {skip.row}: {skip.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="crm-card crm-section-card crm-stack-8">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Supported Fields</h2>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          Primary identity columns: <b>ig_username</b>, <b>email</b>, <b>phone</b>, <b>external_id</b>, or <b>full_name</b>. Also supports:
          first_name, last_name, full_name, tags, intent, timeline, budget_range, location_area, contact_preference,
          next_step, lead_temp, source, notes, stage. Common stage aliases are auto-mapped and extra columns are saved in custom fields.
        </div>
      </section>
    </main>
  );
}
