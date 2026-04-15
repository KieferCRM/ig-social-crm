"use client";

import { useState } from "react";
import { FORM_TEMPLATES, type FormField } from "@/lib/forms/templates";

type IntakeResponse = {
  ok?: boolean;
  error?: string;
};

const CRM_FIELDS = new Set([
  "phone", "full_name", "email", "intent", "timeline", "budget_range",
  "location_area", "contact_preference", "notes", "source", "property_context",
  "financing_status", "seller_readiness", "agency_status", "property_type",
]);

function isVisible(field: FormField, answers: Record<string, string>): boolean {
  if (!field.showIf) return true;
  const current = answers[field.showIf.field] || "";
  return field.showIf.values.includes(current);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <span>
      {field.label}
      {field.required ? <span style={{ color: "var(--danger, #dc2626)" }}> *</span> : null}
    </span>
  );

  if (field.type === "select") {
    return (
      <label className="crm-public-intake-field">
        {label}
        {field.tooltip ? (
          <span style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4, display: "block" }}>
            {field.tooltip}
          </span>
        ) : null}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select one</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className="crm-public-intake-field crm-public-intake-field-full">
        <legend>{label}</legend>
        <div className="crm-public-intake-radio-row">
          {(field.options || []).map((opt) => (
            <label key={opt} className="crm-public-intake-radio-chip">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="crm-public-intake-field crm-public-intake-field-full">
        {label}
        <textarea
          rows={4}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="crm-public-intake-field">
      {label}
      {field.tooltip ? (
        <span style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4, display: "block" }}>
          {field.tooltip}
        </span>
      ) : null}
      <input
        type={field.type}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function FormRenderer({
  formType,
  agentSlug,
  source,
}: {
  formType: string;
  agentSlug: string;
  source?: string;
}) {
  const template = FORM_TEMPLATES[formType];
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries((template?.fields || []).map((f) => [f.id, ""]))
  );
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!template) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--ink-muted)" }}>
        Form not found.
      </div>
    );
  }

  function update(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  const visibleFields = template.fields.filter((f) => isVisible(f, answers));

  const requiredMissing = visibleFields.some(
    (f) => f.required && !(answers[f.id] || "").trim()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiredMissing) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    const questionnaire_answers: Record<string, string> = {};
    const custom_fields_input: Record<string, string> = {};
    const payload: Record<string, unknown> = {
      agent_id: agentSlug,
      source: source ?? `web_form_${agentSlug}`,
      form_variant: formType,
      questionnaire_answers,
    };

    // Set default intent from template
    if (template.intent) {
      payload.intent = template.intent;
    }

    for (const field of visibleFields) {
      const value = (answers[field.id] || "").trim();
      if (!value) continue;

      questionnaire_answers[field.id] = value;

      if (field.crm_field) {
        if (field.crm_field.startsWith("custom.")) {
          const key = field.crm_field.slice("custom.".length);
          if (key) custom_fields_input[key] = value;
        } else if (CRM_FIELDS.has(field.crm_field)) {
          // intent_type maps to intent
          if (field.crm_field === "intent") {
            payload.intent = value;
          } else {
            payload[field.crm_field] = value;
          }
        }
      }
    }

    if (Object.keys(custom_fields_input).length > 0) {
      payload.custom_fields = custom_fields_input;
    }

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, consent_to_sms: smsConsent }),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
            Your details were sent to the agent. You can expect a follow-up soon.
          </p>
          <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
            <div style={{ fontWeight: 700 }}>What happens next</div>
            <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
              The agent will review your inquiry and reach out with the right next step.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="crm-card crm-public-intake-form">
      {template.headline ? (
        <div
          className="crm-card-muted"
          style={{ padding: "16px 20px", borderRadius: 8, marginBottom: 8 }}
        >
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{template.headline}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
        <div className="crm-public-intake-hero">
          <h2 style={{ margin: 0 }}>{template.title}</h2>
          {template.description ? (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>{template.description}</p>
          ) : null}
        </div>

        <div className="crm-public-intake-grid">
          {visibleFields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={answers[field.id] || ""}
              onChange={(value) => update(field.id, value)}
            />
          ))}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
        ) : null}

        <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Your information is kept private and only shared with the agent.
          </div>
          <button
            type="submit"
            className="crm-btn crm-btn-primary"
            disabled={saving || requiredMissing || !smsConsent}
          >
            {saving ? "Submitting..." : "Submit"}
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
