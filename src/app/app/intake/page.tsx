"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  type QuestionnaireConfig,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type SubmissionItem = {
  id: string;
  lead_name: string;
  intent: string;
  timeline: string;
  timestamp: string | null;
};

type SubmissionResponse = {
  submissions?: SubmissionItem[];
  error?: string;
};

type QuestionnaireResponse = {
  config?: QuestionnaireConfig;
  error?: string;
};

const LINK_PLACEMENT_CARDS = [
  {
    title: "Website button",
    body: "Use the intake link behind your Contact or Get Started button so serious inquiries come in cleanly.",
  },
  {
    title: "Instagram bio",
    body: "Place the link in your bio so buyers and sellers can submit details without messaging back and forth.",
  },
  {
    title: "Email Signature",
    body: "Add a simple Start here link to every outbound email so warm replies have a clear next step.",
  },
] as const;

function formatDateTime(value: string | null): string {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString();
}

function previewFieldType(question: QuestionnaireQuestion): "text" | "email" | "tel" | "textarea" | "select" {
  if (question.input_type === "textarea") return "textarea";
  if (question.crm_field === "intent" || question.crm_field === "timeline" || question.crm_field === "contact_preference") {
    return "select";
  }
  return question.input_type;
}

function previewOptions(question: QuestionnaireQuestion): string[] {
  if (question.crm_field === "intent") return ["Buying", "Selling", "Investing"];
  if (question.crm_field === "timeline") return ["ASAP", "30-60 days", "3-6 months", "Just researching"];
  if (question.crm_field === "contact_preference") return ["Text", "Phone", "Email"];
  return [];
}

export default function LeadCaptureSetupPage() {
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [questionnaireConfig, setQuestionnaireConfig] = useState<QuestionnaireConfig>(DEFAULT_QUESTIONNAIRE_CONFIG);
  const [intakeUrl, setIntakeUrl] = useState("/intake");
  const [linkActionMessage, setLinkActionMessage] = useState("");
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIntakeUrl(`${window.location.origin}/intake`);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    async function loadWorkspaceData() {
      setSubmissionsLoading(true);
      setError("");
      try {
        const [submissionsResponse, questionnaireResponse] = await Promise.all([
          fetch("/api/intake/submissions", {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch("/api/questionnaire", {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);

        const submissionsData = (await submissionsResponse.json()) as SubmissionResponse;
        const questionnaireData = (await questionnaireResponse.json()) as QuestionnaireResponse;
        if (!mounted) return;

        if (submissionsResponse.ok) {
          setSubmissions(submissionsData.submissions || []);
        } else {
          setSubmissions([]);
          setError(submissionsData.error || "Could not load recent submissions.");
        }

        if (questionnaireResponse.ok && questionnaireData.config) {
          setQuestionnaireConfig(questionnaireData.config);
        } else {
          setQuestionnaireConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
        }
      } catch {
        if (!mounted) return;
        setSubmissions([]);
        setQuestionnaireConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
        setError("Could not load recent submissions.");
      } finally {
        window.clearTimeout(timeout);
        if (mounted) setSubmissionsLoading(false);
      }
    }

    void loadWorkspaceData();

    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const qrCodeUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(intakeUrl)}`,
    [intakeUrl]
  );

  function setTransientLinkMessage(value: string, durationMs = 1700) {
    setLinkActionMessage(value);
    window.setTimeout(() => setLinkActionMessage(""), durationMs);
  }

  async function shareIntakeLink() {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Merlyn Lead Capture Form",
          text: "Use this form to submit your real estate goals and contact details.",
          url: intakeUrl,
        });
        setTransientLinkMessage("Shared");
        return;
      }
      await navigator.clipboard.writeText(intakeUrl);
      setTransientLinkMessage("Copied");
    } catch {
      setTransientLinkMessage("Share failed", 2000);
    }
  }

  async function copyIntakeLink() {
    try {
      await navigator.clipboard.writeText(intakeUrl);
      setTransientLinkMessage("Copied");
    } catch {
      setTransientLinkMessage("Copy failed", 2000);
    }
  }

  const previewQuestions = questionnaireConfig.questions.length > 0
    ? questionnaireConfig.questions
    : DEFAULT_QUESTIONNAIRE_CONFIG.questions;

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Lead intake</h1>
            <p className="crm-page-subtitle">
              Share one intake form for buyers, sellers, and investors. When someone submits it, Merlyn creates the lead automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="crm-intake-hero-grid">
        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Share your lead capture link</h2>
            <span className="crm-chip crm-chip-ok">Ready now</span>
          </div>
          <p className="crm-section-subtitle">
            This is the link you share. Prospects open it, complete the questionnaire, and land in Merlyn automatically.
          </p>
          <div className="crm-card-muted" style={{ padding: 14 }}>
            <code style={{ wordBreak: "break-all", fontSize: 15, fontWeight: 700 }}>{intakeUrl}</code>
          </div>
          <div className="crm-inline-actions">
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void copyIntakeLink()}>
              Copy Link
            </button>
            <Link href="/intake" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
              Open Form
            </Link>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void shareIntakeLink()}>
              Share
            </button>
          </div>
          <div className="crm-inline-actions">
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowQrCode((value) => !value)}>
              {showQrCode ? "Hide QR code" : "Show QR code"}
            </button>
            {linkActionMessage ? (
              <span
                className={`crm-chip ${
                  linkActionMessage === "Copied" || linkActionMessage === "Shared"
                    ? "crm-chip-ok"
                    : "crm-chip-danger"
                }`}
              >
                {linkActionMessage}
              </span>
            ) : null}
          </div>

          {showQrCode ? (
            <div className="crm-card-muted crm-stack-10" style={{ padding: 12, width: "fit-content" }}>
              <img src={qrCodeUrl} alt="Lead intake QR code" width={220} height={220} style={{ borderRadius: 12 }} />
              <a className="crm-btn crm-btn-secondary" href={qrCodeUrl} target="_blank" rel="noreferrer">
                Open QR Image
              </a>
            </div>
          ) : null}
        </section>

        <aside className="crm-card crm-funnel-preview-panel crm-intake-preview-panel">
          <div className="crm-funnel-preview-head">
            <p className="crm-funnel-preview-kicker">Form Preview</p>
            <h3>{questionnaireConfig.title || "Lead Intake Form"}</h3>
            <p>
              {questionnaireConfig.description || "Answer a few quick questions so we can follow up with the right next step."}
            </p>
          </div>
          <div className="crm-funnel-preview-body">
            {previewQuestions.map((question) => {
              const type = previewFieldType(question);
              const options = previewOptions(question);
              return (
                <label key={question.id} className="crm-funnel-preview-field">
                  <span>
                    {question.label || question.prompt}
                    {question.required ? <em>Required</em> : null}
                  </span>
                  {type === "textarea" ? (
                    <textarea
                      disabled
                      rows={4}
                      className="crm-intake-preview-input"
                      placeholder={question.placeholder || question.prompt}
                    />
                  ) : type === "select" ? (
                    <select disabled className="crm-intake-preview-input">
                      <option>{question.placeholder || question.prompt}</option>
                      {options.map((option) => (
                        <option key={`${question.id}-${option}`}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      disabled
                      type={type}
                      className="crm-intake-preview-input"
                      placeholder={question.placeholder || question.prompt}
                    />
                  )}
                  <small>{question.prompt}</small>
                </label>
              );
            })}
          </div>
          <button type="button" disabled className="crm-btn crm-btn-primary crm-intake-preview-submit">
            {questionnaireConfig.submit_label || "Submit Intake"}
          </button>
          <p className="crm-funnel-preview-success">
            Visual preview only. Prospects see this experience when they open your intake link.
          </p>
        </aside>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Builder and import tools</h2>
        </div>
        <p className="crm-section-subtitle">
          Adjust the questionnaire when needed, or bring in an existing list without changing your capture link.
        </p>
        <div className="crm-inline-actions">
          <Link href="/app/intake/questionnaire" className="crm-btn crm-btn-secondary">
            Funnel Builder
          </Link>
          <Link href="/app/intake/import" className="crm-btn crm-btn-secondary">
            CSV Import
          </Link>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Best places to use it</h2>
        </div>
        <div className="crm-grid-cards-3">
          {LINK_PLACEMENT_CARDS.map((card) => (
            <article key={card.title} className="crm-card-muted" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{card.title}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Recent submissions</h2>
        </div>
        <p className="crm-section-subtitle">
          The latest leads created by your intake form.
        </p>
        {submissionsLoading ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading recent submissions...</div>
        ) : submissions.length === 0 ? (
          <EmptyState title="No submissions yet" body="Share the intake link on your site, bio, or email signature to start receiving inquiries." />
        ) : (
          <div className="crm-stack-8">
            {submissions.map((item) => (
              <Link
                key={item.id}
                href={`/app/leads/${item.id}`}
                className="crm-card-muted"
                style={{
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                  gap: 8,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Lead Name</div>
                  <div style={{ marginTop: 3, fontWeight: 700 }}>{item.lead_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Intent</div>
                  <div style={{ marginTop: 3 }}>{item.intent}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Timeline</div>
                  <div style={{ marginTop: 3 }}>{item.timeline}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Submitted</div>
                  <div style={{ marginTop: 3, fontSize: 12 }}>{formatDateTime(item.timestamp)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <section className="crm-card crm-section-card">
          <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>
        </section>
      ) : null}
    </main>
  );
}
