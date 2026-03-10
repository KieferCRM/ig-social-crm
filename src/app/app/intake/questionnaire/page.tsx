"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import {
  cloneQuestionnaireConfig,
  CORE_FIELD_OPTIONS,
  DEFAULT_QUESTIONNAIRE_CONFIG,
  PREBUILT_QUESTIONNAIRE_CONFIG,
  isCoreQuestionField,
  type QuestionnaireConfig,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";

type QuestionnaireResponse = {
  config?: QuestionnaireConfig;
  error?: string;
};

type IconName = "drag" | "up" | "down" | "delete";

const INPUT_OPTIONS: Array<{ value: QuestionnaireQuestion["input_type"]; label: string }> = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "textarea", label: "Long Text" },
];

const CORE_LABELS = new Map(CORE_FIELD_OPTIONS.map((option) => [option.value, option.label]));

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function newQuestion(index: number): QuestionnaireQuestion {
  return {
    id: `question_${Date.now()}_${index}`,
    label: "New question",
    prompt: "What do you want to ask?",
    placeholder: "",
    crm_field: "custom.new_field",
    required: false,
    input_type: "text",
  };
}

function customKeyFromField(crmField: string): string {
  if (!crmField.startsWith("custom.")) return "";
  return crmField.slice("custom.".length);
}

function crmFieldLabel(crmField: string): string {
  const coreLabel = CORE_LABELS.get(crmField);
  if (coreLabel) return coreLabel;
  const customKey = customKeyFromField(crmField);
  if (customKey) return `Custom (${customKey})`;
  return crmField;
}

function Icon({ name }: { name: IconName }) {
  if (name === "drag") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="5" cy="4" r="1.2" />
        <circle cx="11" cy="4" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="11" cy="8" r="1.2" />
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="11" cy="12" r="1.2" />
      </svg>
    );
  }

  if (name === "up") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3 3.2 8h2.5v5h4.6V8h2.5L8 3Z" />
      </svg>
    );
  }

  if (name === "down") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 13 12.8 8h-2.5V3H5.7v5H3.2L8 13Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.3 4.3h7.4v1H4.3v-1Zm1 1.8h5.4l-.5 6H5.8l-.5-6ZM6.2 2.8h3.6l.5.9h2v1H3.7v-1h2l.5-.9Z" />
    </svg>
  );
}

function PreviewInput({ question }: { question: QuestionnaireQuestion }) {
  if (question.input_type === "textarea") {
    return <textarea rows={2} placeholder={question.placeholder} readOnly disabled />;
  }

  return (
    <input
      type={question.input_type === "tel" ? "tel" : question.input_type === "email" ? "email" : "text"}
      placeholder={question.placeholder}
      readOnly
      disabled
    />
  );
}

export default function QuestionnaireSettingsPage() {
  const [config, setConfig] = useState<QuestionnaireConfig>(() =>
    cloneQuestionnaireConfig(DEFAULT_QUESTIONNAIRE_CONFIG)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dropTargetQuestionId, setDropTargetQuestionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/questionnaire");
        const data = (await response.json()) as QuestionnaireResponse;
        if (!response.ok) {
          setMessage(data.error || "Could not load questionnaire settings.");
          return;
        }
        setConfig(cloneQuestionnaireConfig(data.config || DEFAULT_QUESTIONNAIRE_CONFIG));
      } catch {
        setMessage("Could not load questionnaire settings.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const intakeUrl = useMemo(() => {
    if (typeof window === "undefined") return "/intake";
    return `${window.location.origin}/intake`;
  }, []);

  const requiredCount = useMemo(
    () => config.questions.filter((question) => question.required).length,
    [config.questions]
  );

  function updateQuestion(index: number, patch: Partial<QuestionnaireQuestion>) {
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      ),
    }));
  }

  function removeQuestion(index: number) {
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setConfig((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      const current = questions[index];
      questions[index] = questions[nextIndex];
      questions[nextIndex] = current;
      return { ...prev, questions };
    });
  }

  function moveQuestionById(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setConfig((prev) => {
      const sourceIndex = prev.questions.findIndex((question) => question.id === sourceId);
      const targetIndex = prev.questions.findIndex((question) => question.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return prev;

      const questions = [...prev.questions];
      const [moved] = questions.splice(sourceIndex, 1);
      questions.splice(targetIndex, 0, moved);
      return { ...prev, questions };
    });
  }

  function loadPrebuiltTemplate() {
    setConfig(cloneQuestionnaireConfig(PREBUILT_QUESTIONNAIRE_CONFIG));
    setMessage("Prebuilt questionnaire template loaded. Save to apply it.");
  }

  function onDragStart(event: DragEvent<HTMLElement>, questionId: string) {
    setDraggedQuestionId(questionId);
    setDropTargetQuestionId(questionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", questionId);
  }

  function onDragOver(event: DragEvent<HTMLElement>, questionId: string) {
    event.preventDefault();
    if (!draggedQuestionId || draggedQuestionId === questionId) return;
    setDropTargetQuestionId(questionId);
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent<HTMLElement>, questionId: string) {
    event.preventDefault();
    const sourceId = draggedQuestionId || event.dataTransfer.getData("text/plain");
    if (sourceId) {
      moveQuestionById(sourceId, questionId);
    }
    setDraggedQuestionId(null);
    setDropTargetQuestionId(null);
  }

  function onDragEnd() {
    setDraggedQuestionId(null);
    setDropTargetQuestionId(null);
  }

  async function saveConfig() {
    if (config.questions.length === 0) {
      setMessage("Add at least one question before saving.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await response.json()) as QuestionnaireResponse;
      if (!response.ok) {
        setMessage(data.error || "Could not save questionnaire settings.");
        return;
      }
      setConfig(cloneQuestionnaireConfig(data.config || config));
      setMessage("Questionnaire saved.");
    } catch {
      setMessage("Could not save questionnaire settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="crm-page">Loading questionnaire settings...</main>;
  }

  return (
    <main className="crm-page crm-funnel-builder-page">
      <section className="crm-card crm-funnel-builder-hero">
        <div>
          <p className="crm-funnel-kicker">Intake Funnel Builder</p>
          <h1 className="crm-funnel-title">Design Your Lead Intake Experience</h1>
          <p className="crm-funnel-subtitle">
            Build a guided questionnaire that captures the right lead context and maps every answer into your CRM pipeline.
          </p>
          <div className="crm-funnel-meta-row">
            <span className="crm-chip crm-chip-info">{config.questions.length} questions</span>
            <span className="crm-chip crm-chip-info">{requiredCount} required</span>
            <span className="crm-chip crm-chip-ok">Live at /intake</span>
          </div>
        </div>

        <div className="crm-funnel-hero-actions">
          <button className="crm-btn crm-btn-secondary" onClick={loadPrebuiltTemplate}>
            Load Prebuilt
          </button>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary">
            Lead Intake Hub
          </Link>
          <Link href="/intake" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
            Open Intake Form
          </Link>
          <button className="crm-btn crm-btn-primary" onClick={() => void saveConfig()} disabled={saving}>
            {saving ? "Saving..." : "Save Funnel"}
          </button>
        </div>
      </section>

      <div className="crm-funnel-builder-layout">
        <section className="crm-funnel-builder-main">
          <section className="crm-card crm-funnel-settings-card">
            <div className="crm-funnel-section-head">
              <h2>Funnel Settings</h2>
            </div>
            <div className="crm-funnel-settings-grid">
              <label>
                <span>Form title</span>
                <input
                  value={config.title}
                  onChange={(event) => setConfig((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>

              <label>
                <span>Submit label</span>
                <input
                  value={config.submit_label}
                  onChange={(event) => setConfig((prev) => ({ ...prev, submit_label: event.target.value }))}
                />
              </label>

              <label className="crm-funnel-span-2">
                <span>Description</span>
                <textarea
                  rows={2}
                  value={config.description}
                  onChange={(event) => setConfig((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <label className="crm-funnel-span-2">
                <span>Success message</span>
                <input
                  value={config.success_message}
                  onChange={(event) => setConfig((prev) => ({ ...prev, success_message: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="crm-card crm-funnel-questions-card">
            <div className="crm-funnel-section-head">
              <h2>Question Cards</h2>
              <button
                className="crm-btn crm-btn-secondary"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    questions: [...prev.questions, newQuestion(prev.questions.length)],
                  }))
                }
              >
                Add Question
              </button>
            </div>

            <div className="crm-funnel-question-list">
              {config.questions.map((question, index) => {
                const coreMapping = isCoreQuestionField(question.crm_field) ? question.crm_field : "custom";
                const isDragActive = draggedQuestionId === question.id;
                const isDropTarget = dropTargetQuestionId === question.id && draggedQuestionId !== question.id;

                return (
                  <article
                    key={question.id}
                    draggable
                    onDragStart={(event) => onDragStart(event, question.id)}
                    onDragOver={(event) => onDragOver(event, question.id)}
                    onDrop={(event) => onDrop(event, question.id)}
                    onDragEnd={onDragEnd}
                    className={`crm-funnel-question-card ${isDragActive ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
                  >
                    <div className="crm-funnel-question-head">
                      <div className="crm-funnel-question-title">
                        <span className="crm-funnel-drag-indicator" title="Drag to reorder">
                          <Icon name="drag" />
                        </span>
                        <strong>Question {index + 1}</strong>
                        {question.required ? <span className="crm-chip crm-chip-warn">Required</span> : null}
                      </div>
                      <div className="crm-funnel-question-actions">
                        <button
                          className="crm-icon-btn"
                          onClick={() => moveQuestion(index, -1)}
                          aria-label={`Move question ${index + 1} up`}
                          title="Move up"
                        >
                          <Icon name="up" />
                        </button>
                        <button
                          className="crm-icon-btn"
                          onClick={() => moveQuestion(index, 1)}
                          aria-label={`Move question ${index + 1} down`}
                          title="Move down"
                        >
                          <Icon name="down" />
                        </button>
                        <button
                          className="crm-icon-btn crm-icon-btn-danger"
                          onClick={() => removeQuestion(index)}
                          aria-label={`Remove question ${index + 1}`}
                          title="Remove question"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>

                    <div className="crm-funnel-map-line">
                      Maps to CRM field: <strong>{crmFieldLabel(question.crm_field)}</strong>
                    </div>

                    <div className="crm-funnel-question-grid">
                      <label>
                        <span>Label</span>
                        <input
                          value={question.label}
                          onChange={(event) => {
                            const nextLabel = event.target.value;
                            updateQuestion(index, {
                              label: nextLabel,
                              id: slugify(nextLabel) || question.id,
                            });
                          }}
                        />
                      </label>

                      <label>
                        <span>Input type</span>
                        <select
                          value={question.input_type}
                          onChange={(event) =>
                            updateQuestion(index, {
                              input_type: event.target.value as QuestionnaireQuestion["input_type"],
                            })
                          }
                        >
                          {INPUT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="crm-funnel-span-2">
                        <span>Question prompt</span>
                        <input
                          value={question.prompt}
                          onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                        />
                      </label>

                      <label className="crm-funnel-span-2">
                        <span>Placeholder</span>
                        <input
                          value={question.placeholder}
                          onChange={(event) => updateQuestion(index, { placeholder: event.target.value })}
                        />
                      </label>

                      <label>
                        <span>CRM mapping</span>
                        <select
                          value={coreMapping}
                          onChange={(event) => {
                            if (event.target.value === "custom") {
                              const existingCustom = customKeyFromField(question.crm_field);
                              updateQuestion(index, {
                                crm_field: `custom.${existingCustom || "field_name"}`,
                              });
                              return;
                            }
                            updateQuestion(index, { crm_field: event.target.value });
                          }}
                        >
                          {CORE_FIELD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          <option value="custom">Custom Field</option>
                        </select>
                      </label>

                      {coreMapping === "custom" ? (
                        <label>
                          <span>Custom field key</span>
                          <input
                            value={customKeyFromField(question.crm_field)}
                            onChange={(event) =>
                              updateQuestion(index, {
                                crm_field: `custom.${event.target.value}`,
                              })
                            }
                            placeholder="preferred_school_district"
                          />
                        </label>
                      ) : (
                        <label className="crm-funnel-required-toggle">
                          <span>Required</span>
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(event) => updateQuestion(index, { required: event.target.checked })}
                          />
                        </label>
                      )}

                      {coreMapping === "custom" ? (
                        <label className="crm-funnel-required-toggle">
                          <span>Required</span>
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(event) => updateQuestion(index, { required: event.target.checked })}
                          />
                        </label>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="crm-card crm-funnel-url-card">
            <div className="crm-funnel-url-title">Intake URL</div>
            <code>{intakeUrl}</code>
            {message ? (
              <span className={`crm-chip ${message.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}>
                {message}
              </span>
            ) : null}
          </section>
        </section>

        <aside className="crm-card crm-funnel-preview-panel">
          <div className="crm-funnel-preview-head">
            <p className="crm-funnel-preview-kicker">Live Form Preview</p>
            <h3>{config.title}</h3>
            <p>{config.description}</p>
          </div>
          <div className="crm-funnel-preview-body">
            {config.questions.map((question) => (
              <label key={`preview_${question.id}`} className="crm-funnel-preview-field">
                <span>
                  {question.prompt}
                  {question.required ? <em>Required</em> : null}
                </span>
                <PreviewInput question={question} />
                <small>Maps to: {crmFieldLabel(question.crm_field)}</small>
              </label>
            ))}
            <button className="crm-btn crm-btn-primary" disabled>
              {config.submit_label}
            </button>
            <p className="crm-funnel-preview-success">{config.success_message}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
