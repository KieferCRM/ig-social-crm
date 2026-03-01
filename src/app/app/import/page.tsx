"use client";

import { useState } from "react";
import Link from "next/link";

type ImportError = {
  row: number;
  message: string;
};

type ImportResponse = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "importing" | "success" | "error">("idle");
  const [message, setMessage] = useState("Pick a CSV and click Import.");
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleImport() {
    if (!file) {
      setStatus("error");
      setMessage("Choose a CSV file first.");
      return;
    }

    setStatus("importing");
    setMessage("Importing...");
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
        | { error?: string; errors?: ImportError[] };

      if (!response.ok) {
        const errors = Array.isArray(data?.errors) ? data.errors : [];
        setResult({ inserted: 0, updated: 0, skipped: 0, errors });
        setStatus("error");
        setMessage((data as { error?: string })?.error || "Import failed.");
        return;
      }

      setResult(data as ImportResponse);
      setStatus("success");
      setMessage("Import complete.");
    } catch {
      setStatus("error");
      setMessage("Import failed. Please try again.");
    }
  }

  const errorRows = result?.errors?.slice(0, 10) ?? [];

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Import Leads</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            Upload CSV and upsert by <code>(agent_id, ig_username)</code>.
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
          disabled={status === "importing"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleImport}
            disabled={status === "importing" || !file}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: status === "importing" || !file ? "#f5f5f5" : "#fff",
              cursor: status === "importing" || !file ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {status === "importing" ? "Importing..." : "Import"}
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            color: status === "error" ? "#b00020" : "#333",
          }}
        >
          {message}
        </div>

        {result ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              background: "#fafafa",
              fontSize: 14,
              display: "grid",
              gap: 6,
            }}
          >
            <div>Inserted: {result.inserted}</div>
            <div>Updated: {result.updated}</div>
            <div>Skipped: {result.skipped}</div>
            <div>Errors: {result.errors.length}</div>
          </div>
        ) : null}

        {errorRows.length > 0 ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #f0caca",
              borderRadius: 10,
              background: "#fff5f5",
              color: "#8a1f1f",
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>First {errorRows.length} error(s)</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errorRows.map((err, idx) => (
                <li key={`${err.row}-${idx}`}>Row {err.row}: {err.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
          Accepted columns: <b>ig_username</b>, intent, timeline, lead_temp, source, notes, stage.
        </div>
      </div>
    </main>
  );
}
