"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  type QuestionnaireConfig,
  type QuestionnaireQuestion,
  type QuestionnaireVariant,
} from "@/lib/questionnaire";

type IntakeResponse = {
  ok?: boolean;
  ignored?: boolean;
  status?: "inserted" | "updated";
  lead_id?: string;
  reminder_created?: boolean;
  deal_created?: boolean;
  recommendation_created?: boolean;
  error?: string;
};

type QuestionnaireResponse = {
  config?: QuestionnaireConfig;
  booking_link?: string;
  error?: string;
};

type TransportFields = {
  source: string;
  external_id: string;
  website: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

function createEmptyTransport(defaultSource: string): TransportFields {
  return {
    source: defaultSource,
    external_id: "",
    website: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
  };
}

function clean(value: string): string {
  return value.trim();
}

function buildDefaultAnswers(config: QuestionnaireConfig): Record<string, string> {
  return Object.fromEntries(config.questions.map((question) => [question.id, ""]));
}

function isCoreField(field: string): boolean {
  return !field.startsWith("custom.");
}

function pickPayloadField(
  field: string,
  value: string
): Record<string, string> | null {
  if (!value) return null;
  if (field === "phone") return { phone: value };
  if (field === "full_name") return { full_name: value };
  if (field === "email") return { email: value };
  if (field === "intent") return { intent: value };
  if (field === "timeline") return { timeline: value };
  if (field === "budget_range") return { budget_range: value };
  if (field === "location_area") return { location_area: value };
  if (field === "contact_preference") return { contact_preference: value };
  if (field === "notes") return { notes: value };
  if (field === "source") return { source: value };
  if (field === "property_context") return { property_context: value };
  if (field === "financing_status") return { financing_status: value };
  if (field === "seller_readiness") return { seller_readiness: value };
  if (field === "agency_status") return { agency_status: value };
  if (field === "property_type") return { property_type: value };
  return null;
}

function renderQuestionInput(
  question: QuestionnaireQuestion,
  value: string,
  onChange: (value: string) => void
) {
  const label = (
    <span>
      {question.label}
      {question.required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
    </span>
  );

  if (question.input_type === "textarea") {
    return (
      <label className="crm-public-intake-field crm-public-intake-field-full">
        {label}
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
        />
      </label>
    );
  }

  if (question.input_type === "select") {
    return (
      <label className="crm-public-intake-field">
        {label}
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{question.placeholder || "Select one"}</option>
          {(question.options || []).map((option) => (
            <option key={`${question.id}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (question.input_type === "radio") {
    return (
      <fieldset className="crm-public-intake-field crm-public-intake-field-full">
        <legend>{label}</legend>
        <div className="crm-public-intake-radio-row">
          {(question.options || []).map((option) => (
            <label key={`${question.id}-${option}`} className="crm-public-intake-radio-chip">
              <input
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.input_type === "checkbox_group") {
    const selected = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    function toggle(option: string) {
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
      onChange(next.join(", "));
    }

    return (
      <fieldset className="crm-public-intake-field crm-public-intake-field-full">
        <legend>{label}</legend>
        <div className="crm-public-intake-radio-row">
          {(question.options || []).map((option) => (
            <label key={`${question.id}-${option}`} className="crm-public-intake-radio-chip">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="crm-public-intake-field">
      {label}
      <input
        type={question.input_type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.placeholder}
      />
    </label>
  );
}

export default function IntakeForm({
  defaultSource = "website_form",
  variant,
}: {
  defaultSource?: string;
  variant?: QuestionnaireVariant;
}) {
  const [config, setConfig] = useState<QuestionnaireConfig>(DEFAULT_QUESTIONNAIRE_CONFIG);
  const [answers, setAnswers] = useState<Record<string, string>>(
    buildDefaultAnswers(DEFAULT_QUESTIONNAIRE_CONFIG)
  );
  const [transport, setTransport] = useState<TransportFields>(
    createEmptyTransport(defaultSource)
  );
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [bookingLink, setBookingLink] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTransport((prev) => ({
      ...prev,
      source: params.get("source") || prev.source,
      external_id: params.get("external_id") || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    }));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const search = new URLSearchParams();
        if (variant) search.set("variant", variant);
        const response = await fetch(`/api/intake/config${search.toString() ? `?${search.toString()}` : ""}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as QuestionnaireResponse;
        if (!active) return;
        const nextConfig = response.ok && data.config ? data.config : DEFAULT_QUESTIONNAIRE_CONFIG;
        setConfig(nextConfig);
        setBookingLink(response.ok && data.booking_link ? data.booking_link : "");
        setAnswers((previous) => {
          const next = buildDefaultAnswers(nextConfig);
          for (const key of Object.keys(next)) {
            if (previous[key]) next[key] = previous[key];
          }
          return next;
        });
      } catch {
        if (active) {
          setConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
        }
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, [variant]);

  const requiredMissing = useMemo(() => {
    return config.questions.some((question) => question.required && !clean(answers[question.id] || ""));
  }, [answers, config.questions]);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiredMissing) {
      setMessage("Please complete the required fields.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const questionnaireAnswers: Record<string, string> = {};
      const payload: Record<string, unknown> = {
        questionnaire_answers: questionnaireAnswers,
        source: transport.source || "website_form",
        form_variant: variant || null,
        external_id: transport.external_id || "",
        website: transport.website || "",
        utm_source: transport.utm_source || "",
        utm_medium: transport.utm_medium || "",
        utm_campaign: transport.utm_campaign || "",
      };

      if (variant === "buyer") payload.intent = "Buy";
      if (variant === "seller") payload.intent = "Sell";

      for (const question of config.questions) {
        const value = clean(answers[question.id] || "");
        if (!value) continue;

        questionnaireAnswers[question.id] = value;

        if (!isCoreField(question.crm_field)) continue;
        const patch = pickPayloadField(question.crm_field, value);
        if (patch) {
          Object.assign(payload, patch);
        }
      }

      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, consent_to_sms: smsConsent }),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Could not submit the intake form.");
        return;
      }

      setSubmitted(true);
      setMessage(
        data.deal_created
          ? "Thanks. Your inquiry is in and the agent's workspace has already been updated."
          : "Thanks. Your inquiry is in."
      );
    } catch {
      setMessage("Could not submit the intake form.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="crm-card crm-public-intake-confirmation">
        <div className="crm-stack-8" style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Inquiry received</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Your details were sent to the agent for review.
          </p>
          <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
            <div style={{ fontWeight: 700 }}>What happens next</div>
            <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
              The agent will review your inquiry, prioritize it, and follow up with the right next
              step.
            </p>
          </div>
          {bookingLink ? (
            <div className="crm-inline-actions" style={{ justifyContent: "center" }}>
              <a
                href={bookingLink}
                target="_blank"
                rel="noreferrer"
                className="crm-btn crm-btn-primary"
              >
                Book a call now
              </a>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="crm-card crm-public-intake-form">
      <form onSubmit={submitForm} className="crm-public-intake-form-grid">
        <div className="crm-public-intake-hero">
          <p className="crm-page-kicker">
            {variant === "seller"
              ? "Seller Intake"
              : variant === "buyer"
                ? "Buyer Intake"
                : "Inbound Real Estate Intake"}
          </p>
          <h2 style={{ margin: 0 }}>{config.title}</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>{config.description}</p>
        </div>

        <div className="crm-public-intake-grid">
          {config.questions.map((question) =>
            renderQuestionInput(question, answers[question.id] || "", (value) =>
              updateAnswer(question.id, value)
            )
          )}
        </div>

        {message ? (
          <div style={{ fontSize: 13, color: submitted ? "var(--ok)" : "var(--foreground)" }}>
            {message}
          </div>
        ) : null}

        <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            The agent uses this intake to create and prioritize the deal automatically.
          </div>
          <button type="submit" className="crm-btn crm-btn-primary" disabled={saving || !smsConsent}>
            {saving ? "Submitting..." : config.submit_label}
          </button>
        </div>

        <div className="crm-public-intake-consent">
          <label className="crm-public-intake-consent-checkbox">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
            />
            <span>
              I agree to receive text messages regarding my inquiry, including automated responses.
            </span>
          </label>
          <p className="crm-public-intake-consent-disclosure">
            By providing your phone number and submitting this form, you consent to receive text
            messages from the agent. Message frequency varies. Message and data rates may apply.
            Reply STOP to unsubscribe. Reply HELP for help. Consent is not a condition of purchase.
          </p>
        </div>
      </form>
    </section>
  );
}
