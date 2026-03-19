"use client";

import { useState } from "react";
import type { GenericForm, GenericQuestion } from "@/app/forms/generic/[formId]/page";

type IntakeResponse = { ok?: boolean; error?: string };

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: GenericQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = (
    <span>
      {question.label}
      {question.required ? <span style={{ color: "var(--danger, #dc2626)" }}> *</span> : null}
    </span>
  );

  if (question.type === "yesno") {
    return (
      <fieldset className="crm-public-intake-field crm-public-intake-field-full">
        <legend>{label}</legend>
        <div className="crm-public-intake-radio-row">
          {["Yes", "No"].map((opt) => (
            <label key={opt} className="crm-public-intake-radio-chip">
              <input
                type="radio"
                name={question.id}
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

  if (question.type === "dropdown") {
    return (
      <label className="crm-public-intake-field">
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select one</option>
          {(question.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="crm-public-intake-field crm-public-intake-field-full">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function GenericFormRenderer({ form }: { form: GenericForm }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.questions.map((q) => [q.id, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function update(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  const requiredMissing = form.questions.some(
    (q) => q.required && !(answers[q.id] || "").trim()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiredMissing) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/forms/generic/${form.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
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
          <h2 style={{ margin: 0 }}>Response received</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Your answers were sent to the agent. You can expect a follow-up soon.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="crm-card crm-public-intake-form">
      <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
        <div className="crm-public-intake-hero">
          <h2 style={{ margin: 0 }}>{form.title}</h2>
          {form.description ? (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>{form.description}</p>
          ) : null}
        </div>

        {form.questions.length === 0 ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 14, padding: "8px 0" }}>
            This form has no questions yet.
          </div>
        ) : (
          <div className="crm-public-intake-grid">
            {form.questions.map((q) => (
              <QuestionInput
                key={q.id}
                question={q}
                value={answers[q.id] || ""}
                onChange={(v) => update(q.id, v)}
              />
            ))}
          </div>
        )}

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
            disabled={saving || requiredMissing || form.questions.length === 0}
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
