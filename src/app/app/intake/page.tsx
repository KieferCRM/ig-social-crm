"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import { sourceChannelTone } from "@/lib/inbound";

type Submission = {
  id: string;
  lead_name: string;
  source: string;
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
  const [shareLink, setShareLink] = useState("/intake");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareLink(`${window.location.origin}/intake`);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSubmissions() {
      try {
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
        setSelectedId((current) => current || nextSubmissions[0]?.id || "");
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
  }, []);

  const selectedSubmission = useMemo(
    () => submissions.find((item) => item.id === selectedId) || submissions[0] || null,
    [selectedId, submissions]
  );

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Intake</p>
            <h1 className="crm-page-title">Inbound review queue</h1>
            <p className="crm-page-subtitle">
              This is where new social, form, open-house, and Concierge inquiries land before you work the deal.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/intake" target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
              Open public form
            </Link>
            <Link href="/app/intake/code" className="crm-btn crm-btn-primary">
              Share intake
            </Link>
          </div>
        </div>

        <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="crm-chip">Share link: {shareLink}</span>
          <span className="crm-chip">New today: {submissions.length}</span>
          <span className="crm-chip crm-chip-danger">
            Hot: {submissions.filter((item) => item.temperature === "Hot").length}
          </span>
          <span className="crm-chip crm-chip-ok">
            Converted: {submissions.filter((item) => item.deal_id).length}
          </span>
        </div>
      </section>

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
                  No inbound submissions yet. Social, forms, open house, and Concierge traffic will appear here.
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
                  <div className="crm-inline-actions" style={{ gap: 6 }}>
                    <StatusBadge label={submission.source} tone={sourceChannelTone(submission.source)} />
                    <StatusBadge label={submission.intent} tone="default" />
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
                  See what the system understood and which deal it created.
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
                    <div className="crm-inline-actions" style={{ gap: 8 }}>
                      <StatusBadge label={selectedSubmission.source} tone={sourceChannelTone(selectedSubmission.source)} />
                      <StatusBadge label={selectedSubmission.temperature} tone={temperatureTone(selectedSubmission.temperature)} />
                    </div>
                  </div>

                  <div className="crm-detail-grid">
                    <div>
                      <div className="crm-detail-label">Intent</div>
                      <div>{selectedSubmission.intent}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Timeline</div>
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
            ) : null}
          </article>
        </section>
      ) : null}
    </main>
  );
}
