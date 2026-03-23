"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PIPELINE_STAGES, type PipelineStageConfig } from "@/lib/pipeline-settings";

export default function PipelineSettingsPage() {
  const [stages, setStages] = useState<PipelineStageConfig[]>(DEFAULT_PIPELINE_STAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/settings/pipeline-stages")
      .then((r) => r.json())
      .then((d: { stages?: PipelineStageConfig[] }) => {
        if (d.stages) setStages(d.stages);
        setLoading(false);
      });
  }, []);

  function moveUp(index: number) {
    if (index === 0) return;
    setStages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index === stages.length - 1) return;
    setStages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updateLabel(index: number, label: string) {
    setStages((prev) => prev.map((s, i) => i === index ? { ...s, label } : s));
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings/pipeline-stages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? "Could not save.");
      } else {
        setMsg("Saved.");
        setTimeout(() => setMsg(""), 3000);
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStages(DEFAULT_PIPELINE_STAGES);
    setMsg("");
  }

  if (loading) {
    return <main className="crm-page crm-stack-12" style={{ maxWidth: 600 }}><div style={{ color: "var(--ink-muted)", padding: 32 }}>Loading...</div></main>;
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 600 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Pipeline Stages</h1>
            <p className="crm-page-subtitle">
              Rename stages or drag them into the order that fits your workflow. Changes apply to your pipeline view, kanban, and dropdowns.
            </p>
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-stack-8">
          {stages.map((stage, i) => (
            <div
              key={stage.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--surface-2, #f8fafc)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {/* Reorder buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: i === 0 ? "default" : "pointer",
                    opacity: i === 0 ? 0.2 : 0.6,
                    padding: "0 4px",
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === stages.length - 1}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: i === stages.length - 1 ? "default" : "pointer",
                    opacity: i === stages.length - 1 ? 0.2 : 0.6,
                    padding: "0 4px",
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Position number */}
              <span style={{ fontSize: 12, color: "var(--ink-faint)", width: 20, textAlign: "center", flexShrink: 0 }}>
                {i + 1}
              </span>

              {/* Label input */}
              <input
                className="crm-input"
                type="text"
                value={stage.label}
                maxLength={32}
                onChange={(e) => updateLabel(i, e.target.value)}
                style={{ flex: 1, fontSize: 14, padding: "6px 10px" }}
              />

              {/* Stage value (read-only hint) */}
              <span style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>
                {stage.value}
              </span>
            </div>
          ))}
        </div>

        {msg && (
          <div style={{ fontSize: 13, fontWeight: 600, color: msg === "Saved." ? "var(--ok, #16a34a)" : "var(--danger, #dc2626)" }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={handleReset}
          >
            Reset to defaults
          </button>
        </div>
      </section>
    </main>
  );
}
