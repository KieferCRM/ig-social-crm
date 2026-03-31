"use client";

import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import ManualLeadForm from "@/app/app/list/manual-lead-form";
import { sourceChannelTone } from "@/lib/inbound";

// ─── Types ────────────────────────────────────────────────────────────────────

type Submission = {
  id: string;
  lead_name: string;
  source: string;
  is_sample_workspace?: boolean;
  intent: string;
  timeline: string;
  temperature: string;
  stage: string;
  property_context: string;
  budget_range: string | null;
  deal_id: string | null;
  deal_stage: string | null;
  next_action: string | null;
  next_action_detail: string | null;
  next_action_priority: string | null;
  next_action_due_at: string | null;
  timestamp: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function temperatureTone(value: string): "lead-hot" | "lead-warm" | "lead-cold" {
  const n = value.trim().toLowerCase();
  if (n === "hot") return "lead-hot";
  if (n === "warm") return "lead-warm";
  return "lead-cold";
}

// ─── Submission filter type ───────────────────────────────────────────────────

type SubmissionFilter = "all" | "hot" | "buyer" | "seller" | "no-deal";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntakeWorkspacePage() {
  // ── Submissions state ──────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");
  const [subFilter, setSubFilter] = useState<SubmissionFilter>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingSubs(true);
      try {
        const res = await fetch("/api/intake/submissions", { cache: "no-store" });
        const data = (await res.json()) as { submissions?: Submission[]; error?: string };
        if (!active) return;
        if (!res.ok) { setSubsError(data.error ?? "Could not load submissions"); return; }
        const next = data.submissions ?? [];
        setSubmissions(next);
        setSelectedId((cur) => (next.some((s) => s.id === cur) ? cur : (next[0]?.id ?? "")));
        setSubsError(null);
      } catch {
        if (active) setSubsError("Could not load submissions");
      } finally {
        if (active) setLoadingSubs(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reloadToken]);

  const hotCount = submissions.filter((s) => s.temperature === "Hot").length;
  const convertedCount = submissions.filter((s) => s.deal_id).length;
  const sampleCount = submissions.filter((s) => s.is_sample_workspace).length;

  const filteredSubmissions = useMemo(() => {
    if (subFilter === "all") return submissions;
    if (subFilter === "hot") return submissions.filter((s) => s.temperature === "Hot");
    if (subFilter === "buyer") return submissions.filter((s) => s.intent?.toLowerCase().includes("buy"));
    if (subFilter === "seller") return submissions.filter((s) => s.intent?.toLowerCase().includes("sell"));
    if (subFilter === "no-deal") return submissions.filter((s) => !s.deal_id);
    return submissions;
  }, [submissions, subFilter]);

  const selectedSubmission = useMemo(
    () => filteredSubmissions.find((s) => s.id === selectedId) ?? filteredSubmissions[0] ?? null,
    [selectedId, filteredSubmissions]
  );

  async function handleClearSampleData() {
    if (sampleBusy) return;
    setSampleBusy(true);
    setSampleMessage("");
    try {
      const res = await fetch("/api/onboarding/sample-workspace", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; removed?: number; error?: string };
      if (!res.ok) { setSampleMessage(data.error ?? "Could not remove sample data."); return; }
      setSampleMessage(`Removed ${data.removed ?? 0} sample lead${data.removed === 1 ? "" : "s"}.`);
      setReloadToken((v) => v + 1);
    } catch {
      setSampleMessage("Could not remove sample data.");
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Inquiries</p>
            <h1 className="crm-page-title">Inbound leads</h1>
            <p className="crm-page-subtitle">
              Review new inquiries, confirm what arrived, and move each lead into the right stage.
            </p>
          </div>
          <div className="crm-page-actions">
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => setShowManualForm((v) => !v)}
            >
              {showManualForm ? "Cancel" : "Add manually"}
            </button>
            {sampleCount > 0 ? (
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void handleClearSampleData()}
                disabled={sampleBusy}
              >
                {sampleBusy ? "Removing…" : "Remove sample data"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="crm-inline-actions" style={{ gap: 0, borderBottom: "1px solid var(--border)", marginTop: 4 }}>
          <button
            type="button"
            disabled
            style={{
              background: "none",
              border: "none",
              borderBottom: "2px solid var(--ink)",
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              cursor: "default",
              marginBottom: -1,
            }}
          >
            {`Submissions${submissions.length > 0 ? ` (${submissions.length})` : ""}`}
          </button>
        </div>
      </section>

      <section className="crm-card crm-section-card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="crm-chip">Total: {submissions.length}</span>
          <span className="crm-chip crm-chip-danger">Hot: {hotCount}</span>
          <span className="crm-chip crm-chip-ok">Converted: {convertedCount}</span>
          {sampleCount > 0 ? <span className="crm-chip">Sample: {sampleCount}</span> : null}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {(["all", "hot", "buyer", "seller", "no-deal"] as SubmissionFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSubFilter(f)}
                className={`crm-btn crm-btn-secondary${subFilter === f ? " crm-btn-active" : ""}`}
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {f === "no-deal" ? "No deal" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {sampleMessage ? (
          <div className={`crm-chip ${sampleMessage.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`} style={{ marginTop: 8 }}>
            {sampleMessage}
          </div>
        ) : null}
      </section>

      {showManualForm ? (
        <ManualLeadForm
          onSaved={() => { setReloadToken((v) => v + 1); setShowManualForm(false); }}
          onCancel={() => setShowManualForm(false)}
        />
      ) : null}

      {loadingSubs ? (
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading submissions…</div>
        </section>
      ) : subsError ? (
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{subsError}</div>
        </section>
      ) : (
        <section className="crm-intake-grid">
          <article className="crm-card crm-section-card crm-stack-8">
            <div className="crm-section-head">
              <h2 className="crm-section-title">
                {subFilter === "all" ? "All submissions" : `Filtered — ${subFilter}`}
              </h2>
            </div>
            <div className="crm-stack-8">
              {filteredSubmissions.length === 0 ? (
                <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                  {submissions.length === 0
                    ? "No submissions yet. Share a form link and leads will appear here."
                    : "No submissions match this filter."}
                </div>
              ) : null}
              {filteredSubmissions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedId(sub.id)}
                  className={`crm-card-muted crm-intake-row${selectedSubmission?.id === sub.id ? " crm-intake-row-active" : ""}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="crm-stack-4" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{sub.lead_name}</div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{sub.property_context}</div>
                    </div>
                    <StatusBadge label={sub.temperature} tone={temperatureTone(sub.temperature)} />
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 6, flexWrap: "wrap" }}>
                    <StatusBadge label={sub.source} tone={sourceChannelTone(sub.source)} />
                    <StatusBadge label={sub.intent} tone="default" />
                    {sub.deal_id ? <StatusBadge label="Deal linked" tone="ok" /> : null}
                    {sub.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{formatDate(sub.timestamp)}</div>
                </button>
              ))}
            </div>
          </article>

          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Submission detail</h2>
                <p className="crm-section-subtitle">What the system understood and what was created.</p>
              </div>
            </div>
            {selectedSubmission ? (
              <>
                <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedSubmission.lead_name}</div>
                      <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>{selectedSubmission.property_context}</div>
                    </div>
                    <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge label={selectedSubmission.source} tone={sourceChannelTone(selectedSubmission.source)} />
                      <StatusBadge label={selectedSubmission.temperature} tone={temperatureTone(selectedSubmission.temperature)} />
                      {selectedSubmission.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                    </div>
                  </div>
                  <div className="crm-detail-grid">
                    <div><div className="crm-detail-label">Intent</div><div>{selectedSubmission.intent}</div></div>
                    <div><div className="crm-detail-label">Timeframe</div><div>{selectedSubmission.timeline}</div></div>
                    <div><div className="crm-detail-label">Budget</div><div>{selectedSubmission.budget_range ?? "Not provided"}</div></div>
                    <div><div className="crm-detail-label">Lead stage</div><div>{selectedSubmission.stage}</div></div>
                  </div>
                </div>
                <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>CRM result</div>
                  <div className="crm-detail-grid">
                    <div><div className="crm-detail-label">Deal created</div><div>{selectedSubmission.deal_id ? "Yes" : "No"}</div></div>
                    <div><div className="crm-detail-label">Deal stage</div><div>{selectedSubmission.deal_stage ?? "—"}</div></div>
                    <div><div className="crm-detail-label">Next action</div><div>{selectedSubmission.next_action ?? "Not set"}</div></div>
                    <div><div className="crm-detail-label">Due</div><div>{formatDate(selectedSubmission.next_action_due_at)}</div></div>
                  </div>
                  {selectedSubmission.next_action_detail ? (
                    <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{selectedSubmission.next_action_detail}</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                Select a submission to see how it mapped into the CRM.
              </div>
            )}
        </section>
      ) : null}
    </main>
  );
}
