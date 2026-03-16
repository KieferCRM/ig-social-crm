"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import IntakeShareKit from "@/components/intake/intake-share-kit";
import ManualLeadForm from "@/app/app/list/manual-lead-form";
import { sourceChannelTone } from "@/lib/inbound";

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

type IntakeResponse = {
  submissions?: Submission[];
  error?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function temperatureTone(value: string): "default" | "warn" | "danger" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "hot") return "danger";
  if (normalized === "warm") return "warn";
  return "default";
}

export default function IntakeWorkspacePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSubmissions() {
      try {
        setLoading(true);
        const response = await fetch("/api/intake/submissions", { cache: "no-store" });
        const data = (await response.json()) as IntakeResponse;
        if (!active) return;
        if (!response.ok) {
          setError(data.error || "Could not load intake.");
          setLoading(false);
          return;
        }
        const nextSubmissions = data.submissions || [];
        setSubmissions(nextSubmissions);
        setSelectedId((current) =>
          nextSubmissions.some((item) => item.id === current) ? current : nextSubmissions[0]?.id || ""
        );
        setError(null);
      } catch {
        if (active) setError("Could not load intake.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSubmissions();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const selectedSubmission = useMemo(
    () => submissions.find((item) => item.id === selectedId) || submissions[0] || null,
    [selectedId, submissions]
  );

  const hotCount = submissions.filter((item) => item.temperature === "Hot").length;
  const convertedCount = submissions.filter((item) => item.deal_id).length;
  const sampleCount = submissions.filter((item) => item.is_sample_workspace).length;

  async function handleClearSampleData() {
    if (sampleBusy) return;
    setSampleBusy(true);
    setSampleMessage("");

    try {
      const response = await fetch("/api/onboarding/sample-workspace", { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; removed?: number; error?: string };
      if (!response.ok) {
        setSampleMessage(data.error || "Could not remove sample data.");
        return;
      }

      setSampleMessage(`Removed ${data.removed || 0} sample lead${data.removed === 1 ? "" : "s"}.`);
      setReloadToken((value) => value + 1);
    } catch {
      setSampleMessage("Could not remove sample data.");
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Intake</p>
            <h1 className="crm-page-title">Inbound capture hub</h1>
            <p className="crm-page-subtitle">
              Share your intake, review what just came in, add something manually when needed, and clean up
              sample data if you seeded test records.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/intake" target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
              Open public form
            </Link>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => setShowManualForm((value) => !value)}
            >
              {showManualForm ? "Close manual entry" : "Add lead manually"}
            </button>
            {sampleCount > 0 ? (
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void handleClearSampleData()}
                disabled={sampleBusy}
              >
                {sampleBusy ? "Removing samples..." : "Remove sample data"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="crm-chip">New today: {submissions.length}</span>
          <span className="crm-chip crm-chip-danger">Hot: {hotCount}</span>
          <span className="crm-chip crm-chip-ok">Converted: {convertedCount}</span>
          {sampleCount > 0 ? <span className="crm-chip">Sample records: {sampleCount}</span> : null}
        </div>

        {sampleMessage ? (
          <div className={`crm-chip ${sampleMessage.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}>
            {sampleMessage}
          </div>
        ) : null}
      </section>

      <IntakeShareKit
        intakePath="/intake"
        title="Create one QR-ready intake that works everywhere."
        description="Use this share link and QR code for open houses, business cards, flyers, and social profiles."
        openLabel="Preview public intake"
        downloadName="merlyn-intake-qr.png"
        placementSuggestions={[
          "Open house sign-in table",
          "Business card",
          "Flyer",
          "Sign rider",
          "Instagram bio",
          "Facebook profile",
        ]}
      />

      {showManualForm ? (
        <ManualLeadForm
          onSaved={() => {
            setReloadToken((value) => value + 1);
          }}
          onCancel={() => setShowManualForm(false)}
        />
      ) : null}

      {loading ? (
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading inbound queue...</div>
        </section>
      ) : null}

      {error ? (
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="crm-intake-grid">
          <article className="crm-card crm-section-card crm-stack-8">
            <div className="crm-section-head">
              <h2 className="crm-section-title">Newest inbound</h2>
            </div>
            <div className="crm-stack-8">
              {submissions.length === 0 ? (
                <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                  No inbound submissions yet. New form, social, open house, and Concierge traffic will appear
                  here.
                </div>
              ) : null}
              {submissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedId(submission.id)}
                  className={`crm-card-muted crm-intake-row${selectedSubmission?.id === submission.id ? " crm-intake-row-active" : ""}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="crm-stack-4" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{submission.lead_name}</div>
                      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                        {submission.property_context}
                      </div>
                    </div>
                    <StatusBadge label={submission.temperature} tone={temperatureTone(submission.temperature)} />
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 6, flexWrap: "wrap" }}>
                    <StatusBadge label={submission.source} tone={sourceChannelTone(submission.source)} />
                    <StatusBadge label={submission.intent} tone="default" />
                    {submission.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{formatDate(submission.timestamp)}</div>
                </button>
              ))}
            </div>
          </article>

          <article className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Mapped intake</h2>
                <p className="crm-section-subtitle">
                  See what the system understood, which deal it created, and what should happen next.
                </p>
              </div>
            </div>

            {selectedSubmission ? (
              <>
                <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedSubmission.lead_name}</div>
                      <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>
                        {selectedSubmission.property_context}
                      </div>
                    </div>
                    <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge label={selectedSubmission.source} tone={sourceChannelTone(selectedSubmission.source)} />
                      <StatusBadge label={selectedSubmission.temperature} tone={temperatureTone(selectedSubmission.temperature)} />
                      {selectedSubmission.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                    </div>
                  </div>

                  <div className="crm-detail-grid">
                    <div>
                      <div className="crm-detail-label">Intent</div>
                      <div>{selectedSubmission.intent}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Timeframe</div>
                      <div>{selectedSubmission.timeline}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Budget / price</div>
                      <div>{selectedSubmission.budget_range || "Not provided"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Lead stage</div>
                      <div>{selectedSubmission.stage}</div>
                    </div>
                  </div>
                </div>

                <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>System result</div>
                  <div className="crm-detail-grid">
                    <div>
                      <div className="crm-detail-label">Deal created</div>
                      <div>{selectedSubmission.deal_id ? "Yes" : "No"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Deal stage</div>
                      <div>{selectedSubmission.deal_stage || "Pending"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Next action</div>
                      <div>{selectedSubmission.next_action || "Not set"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Due</div>
                      <div>{formatDate(selectedSubmission.next_action_due_at)}</div>
                    </div>
                  </div>
                  {selectedSubmission.next_action_detail ? (
                    <div style={{ color: "var(--ink-muted)" }}>{selectedSubmission.next_action_detail}</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                Select a submission to inspect how it mapped into the CRM.
              </div>
            )}
          </article>
        </section>
      ) : null}
    </main>
  );
}
