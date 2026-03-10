"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_QUESTIONNAIRE_CONFIG,
  isCoreQuestionField,
  type QuestionnaireConfig,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type IntakeResponse = {
  ok?: boolean;
  ignored?: boolean;
  status?: "inserted" | "updated";
  lead_id?: string;
  reminder_created?: boolean;
  error?: string;
};

type IntakeConfigResponse = {
  config?: QuestionnaireConfig;
};

type TransportFields = {
  source: string;
  external_id: string;
  website: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

const EMPTY_TRANSPORT: TransportFields = {
  source: "website_intake",
  external_id: "",
  website: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
};

export default function IntakeForm() {
  const [config, setConfig] = useState<QuestionnaireConfig>(DEFAULT_QUESTIONNAIRE_CONFIG);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transport, setTransport] = useState<TransportFields>(EMPTY_TRANSPORT);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const requiredMissing = useMemo(() => {
    return config.questions.some((question) => question.required && !answers[question.id]?.trim());
  }, [answers, config.questions]);

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

    async function loadConfig() {
      setConfigLoading(true);
      try {
        const response = await fetch("/api/intake/config");
        const data = (await response.json()) as IntakeConfigResponse;
        const nextConfig = data.config || DEFAULT_QUESTIONNAIRE_CONFIG;
        setConfig(nextConfig);
        setAnswers((prev) => {
          const next: Record<string, string> = {};
          for (const question of nextConfig.questions) {
            next[question.id] = prev[question.id] || "";
          }
          return next;
        });
      } catch {
        setConfig(DEFAULT_QUESTIONNAIRE_CONFIG);
        setAnswers((prev) => {
          const next: Record<string, string> = {};
          for (const question of DEFAULT_QUESTIONNAIRE_CONFIG.questions) {
            next[question.id] = prev[question.id] || "";
          }
          return next;
        });
      } finally {
        setConfigLoading(false);
      }
    }

    void loadConfig();
  }, []);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function renderInput(question: QuestionnaireQuestion) {
    const value = answers[question.id] || "";
    if (question.input_type === "textarea") {
      return (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => updateAnswer(question.id, event.target.value)}
          placeholder={question.placeholder || question.prompt}
        />
      );
    }

    return (
      <input
        type={question.input_type}
        value={value}
        onChange={(event) => updateAnswer(question.id, event.target.value)}
        placeholder={question.placeholder || question.prompt}
      />
    );
  }

  async function submitForm() {
    if (requiredMissing) {
      setMessage("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        questionnaire_answers: answers,
        source: transport.source || "website_intake",
        external_id: transport.external_id || "",
        website: transport.website || "",
        utm_source: transport.utm_source || "",
        utm_medium: transport.utm_medium || "",
        utm_campaign: transport.utm_campaign || "",
      };

      for (const question of config.questions) {
        const answer = answers[question.id]?.trim();
        if (!answer) continue;
        if (!isCoreQuestionField(question.crm_field)) continue;
        payload[question.crm_field] = answer;
      }

      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Could not submit intake form.");
        return;
      }
      setSubmitted(true);
      setMessage(
        data.reminder_created
          ? "Thanks. We received your info and scheduled a follow-up."
          : config.success_message || "Thanks. We received your info."
      );
    } catch {
      setMessage("Could not submit intake form.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="crm-card" style={{ marginTop: 14, padding: 16 }}>
        <h2 style={{ margin: 0 }}>Request Received</h2>
        <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
          {message || "Thanks for sharing your details. We will follow up shortly."}
        </p>
      </section>
    );
  }

  return (
    <section className="crm-card" style={{ marginTop: 14, padding: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h2 style={{ margin: 0 }}>{config.title}</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>{config.description}</p>
      </div>

      {configLoading ? (
        <div style={{ marginTop: 14, color: "var(--ink-muted)", fontSize: 14 }}>
          Loading questionnaire...
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {config.questions.map((question) => (
            <label key={question.id} style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div style={{ fontWeight: 600 }}>
                {question.prompt}
                {question.required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
              </div>
              {renderInput(question)}
            </label>
          ))}

          <details className="crm-card-muted" style={{ padding: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Tracking Settings</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--ink-muted)" }}>
                Source label
                <input
                  value={transport.source}
                  onChange={(event) =>
                    setTransport((prev) => ({ ...prev, source: event.target.value }))
                  }
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--ink-muted)" }}>
                External ID (optional)
                <input
                  value={transport.external_id}
                  onChange={(event) =>
                    setTransport((prev) => ({ ...prev, external_id: event.target.value }))
                  }
                />
              </label>
            </div>
          </details>

          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            placeholder="Leave empty"
            value={transport.website}
            onChange={(event) =>
              setTransport((prev) => ({ ...prev, website: event.target.value }))
            }
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />

          <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
            <button
              className="crm-btn crm-btn-primary"
              onClick={() => void submitForm()}
              disabled={saving || configLoading}
            >
              {saving ? "Submitting..." : config.submit_label || "Submit"}
            </button>
          </div>
        </div>
      )}

      {message ? (
        <div
          style={{ marginTop: 10 }}
          className={`crm-chip ${
            message.includes("Could not") || message.includes("Please")
              ? "crm-chip-danger"
              : "crm-chip-ok"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
