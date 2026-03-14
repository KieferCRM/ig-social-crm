"use client";

import Link from "next/link";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  type QuestionnaireConfig,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type QuestionnaireResponse = {
  config?: QuestionnaireConfig;
  error?: string;
};

type InstallPreviewMode = "link" | "embed";

type PreviewField = {
  crmField: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "email" | "tel" | "select" | "textarea";
  options?: string[];
};

const TRUST_POINTS = [
  "No account required for the lead",
  "Takes under 1 minute",
  "Sent directly into your CRM",
] as const;

const SHARE_EXAMPLES = [
  "Instagram bio",
  "Facebook post",
  "Website button",
  "Open house QR code",
] as const;

const EMBED_HELPERS = [
  "Paste into a website HTML block",
  "Use on landing pages or contact pages",
] as const;

const DEFAULT_PREVIEW_FIELDS: PreviewField[] = [
  { crmField: "full_name", label: "Full Name", placeholder: "Jordan Mitchell", required: true, type: "text" },
  { crmField: "email", label: "Email", placeholder: "jordan@email.com", required: true, type: "email" },
  { crmField: "phone", label: "Phone", placeholder: "(615) 555-0182", required: true, type: "tel" },
  {
    crmField: "intent",
    label: "Intent",
    placeholder: "Select intent",
    type: "select",
    options: ["Buy", "Sell", "Invest", "Just browsing"],
  },
  { crmField: "location_area", label: "Preferred Location", placeholder: "East Nashville", type: "text" },
  {
    crmField: "budget_range",
    label: "Budget",
    placeholder: "Select budget",
    type: "select",
    options: ["Under $250k", "$250k-$500k", "$500k-$750k", "$750k-$1M", "$1M+"],
  },
  {
    crmField: "timeline",
    label: "Timeline",
    placeholder: "Select timeline",
    type: "select",
    options: ["ASAP", "1-3 months", "3-6 months", "6+ months", "Just browsing"],
  },
  {
    crmField: "contact_preference",
    label: "Preferred Contact Method",
    placeholder: "Select contact method",
    type: "select",
    options: ["Text", "Call", "Email"],
  },
  {
    crmField: "notes",
    label: "Notes",
    placeholder: "Anything else that would help before we follow up?",
    type: "textarea",
  },
  {
    crmField: "source",
    label: "How did you find us?",
    placeholder: "Instagram, referral, Zillow, Google, etc.",
    type: "text",
  },
];

function questionMap(config: QuestionnaireConfig): Map<string, QuestionnaireQuestion> {
  const map = new Map<string, QuestionnaireQuestion>();
  for (const question of config.questions) {
    if (question.crm_field) map.set(question.crm_field, question);
  }
  return map;
}

function overlayPreviewFields(config: QuestionnaireConfig): PreviewField[] {
  const map = questionMap(config);
  return DEFAULT_PREVIEW_FIELDS.map((field) => {
    const match = map.get(field.crmField);
    if (!match) return field;

    return {
      ...field,
      label: match.label || field.label,
      placeholder: match.placeholder || field.placeholder,
      required: match.required,
      type:
        field.crmField === "intent" ||
        field.crmField === "timeline" ||
        field.crmField === "budget_range" ||
        field.crmField === "contact_preference"
          ? "select"
          : field.type,
    };
  });
}

function fieldByKey(fields: PreviewField[], key: string): PreviewField {
  return fields.find((field) => field.crmField === key) || DEFAULT_PREVIEW_FIELDS.find((field) => field.crmField === key)!;
}

function PreviewInput({ field }: { field: PreviewField }) {
  const type = field.type || "text";

  return (
    <label className={`crm-intake-install-preview-field${type === "textarea" ? " crm-intake-install-preview-field-full" : ""}`}>
      <span>
        {field.label}
        {field.required ? <em>Required</em> : null}
      </span>
      {type === "textarea" ? (
        <textarea disabled rows={3} className="crm-intake-install-preview-input" placeholder={field.placeholder} />
      ) : type === "select" ? (
        <select disabled className="crm-intake-install-preview-input">
          <option>{field.placeholder}</option>
          {(field.options || []).map((option) => (
            <option key={`${field.crmField}-${option}`}>{option}</option>
          ))}
        </select>
      ) : (
        <input disabled type={type} className="crm-intake-install-preview-input" placeholder={field.placeholder} />
      )}
    </label>
  );
}

export default function LeadCaptureSetupPage() {
  const [questionnaireConfig, setQuestionnaireConfig] = useState<QuestionnaireConfig>(DEFAULT_QUESTIONNAIRE_CONFIG);
  const [intakeUrl, setIntakeUrl] = useState("/intake");
  const [previewMode, setPreviewMode] = useState<InstallPreviewMode>("link");
  const [linkMessage, setLinkMessage] = useState("");
  const [embedMessage, setEmbedMessage] = useState("");
  const previewRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIntakeUrl(`${window.location.origin}/intake`);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    async function loadQuestionnaire() {
      try {
        const response = await fetch("/api/questionnaire", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as QuestionnaireResponse;
        if (!mounted) return;

        if (response.ok && data.config) {
          setQuestionnaireConfig(data.config);
        } else {
          setQuestionnaireConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
        }
      } catch {
        if (mounted) setQuestionnaireConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadQuestionnaire();

    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const embedUrl = useMemo(() => `${intakeUrl}?source=website_embed`, [intakeUrl]);
  const embedSnippet = useMemo(
    () =>
      `<iframe src="${embedUrl}" style="width:100%;max-width:760px;height:780px;border:0;border-radius:16px;" loading="lazy"></iframe>`,
    [embedUrl]
  );
  const previewFields = useMemo(() => overlayPreviewFields(questionnaireConfig), [questionnaireConfig]);
  const previewTitle = questionnaireConfig.title || "Lead Intake Form";
  const previewDescription =
    questionnaireConfig.description ||
    "Answer a few quick questions so the agent can follow up with the right next step.";

  const contactFields = useMemo(
    () => ["full_name", "email", "phone"].map((key) => fieldByKey(previewFields, key)),
    [previewFields]
  );
  const searchFields = useMemo(
    () => ["intent", "location_area", "budget_range", "timeline"].map((key) => fieldByKey(previewFields, key)),
    [previewFields]
  );
  const detailFields = useMemo(
    () => ["contact_preference", "notes"].map((key) => fieldByKey(previewFields, key)),
    [previewFields]
  );
  const optionalField = useMemo(() => fieldByKey(previewFields, "source"), [previewFields]);

  function setTransientMessage(
    setter: Dispatch<SetStateAction<string>>,
    value: string,
    durationMs = 1800
  ) {
    setter(value);
    window.setTimeout(() => setter(""), durationMs);
  }

  async function copyValue(value: string, setter: Dispatch<SetStateAction<string>>) {
    try {
      await navigator.clipboard.writeText(value);
      setTransientMessage(setter, "Copied");
    } catch {
      setTransientMessage(setter, "Copy failed", 2200);
    }
  }

  function openPreviewTab(mode: InstallPreviewMode) {
    setPreviewMode(mode);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="crm-page crm-page-wide crm-intake-install-page">
      <section className="crm-card crm-section-card crm-intake-install-header">
        <div className="crm-intake-install-header__copy">
          <p className="crm-intake-install-kicker">Lead Capture Install</p>
          <h1 className="crm-page-title">Install Your Lead Capture Form</h1>
          <p className="crm-page-subtitle">
            Share a link anywhere or embed the full form on your website. Every submission flows directly into Merlyn.
          </p>
        </div>
        <div className="crm-intake-install-trust-row">
          {TRUST_POINTS.map((item) => (
            <span key={item} className="crm-chip crm-chip-ok">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="crm-intake-install-methods">
        <article className="crm-card crm-section-card crm-intake-install-card">
          <div className="crm-intake-install-card__head">
            <div>
              <p className="crm-intake-install-card__eyebrow">Share Link</p>
              <h2 className="crm-section-title">Use one link anywhere you ask for inquiries.</h2>
            </div>
          </div>
          <p className="crm-section-subtitle">
            Best for Facebook posts, Instagram bios, website buttons, email blasts, and open house QR codes.
          </p>
          <div className="crm-intake-install-link-box">
            <code>{intakeUrl}</code>
          </div>
          <div className="crm-intake-install-card__actions">
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void copyValue(intakeUrl, setLinkMessage)}>
              Copy Link
            </button>
            <Link href="/intake" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
              Open Preview
            </Link>
            {linkMessage ? (
              <span className={`crm-chip ${linkMessage === "Copied" ? "crm-chip-ok" : "crm-chip-danger"}`}>{linkMessage}</span>
            ) : null}
          </div>
          <div className="crm-intake-install-example-row">
            {SHARE_EXAMPLES.map((item) => (
              <span key={item} className="crm-intake-install-example-pill">
                {item}
              </span>
            ))}
          </div>
        </article>

        <article className="crm-card crm-section-card crm-intake-install-card">
          <div className="crm-intake-install-card__head">
            <div>
              <p className="crm-intake-install-card__eyebrow">Embed Full Form</p>
              <h2 className="crm-section-title">Place the full questionnaire directly on your site.</h2>
            </div>
          </div>
          <p className="crm-section-subtitle">
            Best when you want prospects to complete the full form without leaving your landing page or contact page.
          </p>
          <pre className="crm-intake-install-code-block">
            <code>{embedSnippet}</code>
          </pre>
          <div className="crm-intake-install-card__actions">
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void copyValue(embedSnippet, setEmbedMessage)}>
              Copy Embed Code
            </button>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => openPreviewTab("embed")}>
              Preview Form
            </button>
            {embedMessage ? (
              <span className={`crm-chip ${embedMessage === "Copied" ? "crm-chip-ok" : "crm-chip-danger"}`}>{embedMessage}</span>
            ) : null}
          </div>
          <div className="crm-intake-install-helper-list">
            {EMBED_HELPERS.map((item) => (
              <div key={item} className="crm-intake-install-helper-item">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section ref={previewRef} className="crm-card crm-section-card crm-intake-install-preview">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Live Preview</h2>
            <p className="crm-section-subtitle">
              This is the experience your prospect sees when they open the link or view the embedded form.
            </p>
          </div>
          <div className="crm-intake-install-preview-tabs" role="tablist" aria-label="Lead capture preview">
            <button
              type="button"
              role="tab"
              aria-selected={previewMode === "link"}
              className={`crm-intake-install-preview-tab${previewMode === "link" ? " is-active" : ""}`}
              onClick={() => setPreviewMode("link")}
            >
              Preview Link Experience
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={previewMode === "embed"}
              className={`crm-intake-install-preview-tab${previewMode === "embed" ? " is-active" : ""}`}
              onClick={() => setPreviewMode("embed")}
            >
              Preview Embedded Form
            </button>
          </div>
        </div>

        <div className={`crm-intake-install-preview-shell crm-intake-install-preview-shell--${previewMode}`}>
          {previewMode === "link" ? (
            <div className="crm-intake-install-preview-frame">
              <div className="crm-intake-install-preview-frame__top">
                <span>merlyn.com</span>
                <span>Secure form</span>
              </div>
              <div className="crm-intake-install-preview-frame__hero">
                <div className="crm-intake-install-preview-badge">Shareable form</div>
                <h3>{previewTitle}</h3>
                <p>{previewDescription}</p>
              </div>
            </div>
          ) : (
            <div className="crm-intake-install-embed-chrome">
              <span>Embedded on your website</span>
              <span>Inline on-page form</span>
            </div>
          )}

          <div className="crm-intake-install-form-card">
            <div className="crm-intake-install-form-card__head">
              <h3>{previewTitle}</h3>
              <p>{previewDescription}</p>
            </div>

            <div className="crm-intake-install-form-group">
              <div className="crm-intake-install-form-group__label">Contact</div>
              <div className="crm-intake-install-form-grid">
                {contactFields.map((field) => (
                  <PreviewInput key={field.crmField} field={field} />
                ))}
              </div>
            </div>

            <div className="crm-intake-install-form-group">
              <div className="crm-intake-install-form-group__label">What are you looking for?</div>
              <div className="crm-intake-install-form-grid">
                {searchFields.map((field) => (
                  <PreviewInput key={field.crmField} field={field} />
                ))}
              </div>
            </div>

            <div className="crm-intake-install-form-group">
              <div className="crm-intake-install-form-group__label">Additional Details</div>
              <div className="crm-intake-install-form-grid">
                {detailFields.map((field) => (
                  <PreviewInput key={field.crmField} field={field} />
                ))}
              </div>
            </div>

            <details className="crm-intake-install-optional">
              <summary>Add extra details</summary>
              <div className="crm-intake-install-optional__body">
                <div className="crm-intake-install-form-group__label">Optional</div>
                <div className="crm-intake-install-form-grid">
                  <PreviewInput field={optionalField} />
                </div>
              </div>
            </details>

            <button type="button" disabled className="crm-btn crm-btn-primary crm-intake-install-submit">
              {questionnaireConfig.submit_label || "Submit Request"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
