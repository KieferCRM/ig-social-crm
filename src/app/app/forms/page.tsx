"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

// ── Types ──────────────────────────────────────────────────────────────────────

type QuestionType = "text" | "dropdown" | "yesno";

type GenericQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[]; // for dropdown
};

type GenericForm = {
  id: string;
  title: string;
  description: string;
  questions: GenericQuestion[];
  submission_count: number;
};

// ── Small helpers ──────────────────────────────────────────────────────────────

function newQuestion(): GenericQuestion {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: false,
    options: [],
  };
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

// ── Mini share card (no dep on IntakeShareKit to stay lightweight) ─────────────

function FormShareCard({
  path,
  submissionCount,
  downloadName,
}: {
  path: string;
  submissionCount: number;
  downloadName: string;
}) {
  const [url, setUrl] = useState(`https://lockboxhq.com${path}`);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?format=png&size=520x520&data=${encodeURIComponent(url)}`,
    [url]
  );

  async function handleCopy() {
    const ok = await copyText(url);
    setMsg(ok ? "Link copied" : "Copy failed");
    window.setTimeout(() => setMsg(""), 1800);
  }

  async function handleDownloadQr() {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="crm-stack-8">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="crm-chip">{submissionCount} submissions</div>
        <Link
          href={path}
          target="_blank"
          rel="noreferrer"
          className="crm-btn crm-btn-secondary"
          style={{ fontSize: 13 }}
        >
          Preview
        </Link>
      </div>

      <div className="crm-intake-link-box">
        <div className="crm-detail-label">Shareable link</div>
        <code style={{ fontSize: 12, wordBreak: "break-all" }}>{url}</code>
      </div>

      <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="crm-btn crm-btn-primary" onClick={handleCopy}>
          Copy link
        </button>
        <button type="button" className="crm-btn crm-btn-secondary" onClick={handleDownloadQr}>
          Download QR
        </button>
        {msg ? <span className="crm-chip crm-chip-ok" style={{ fontSize: 12 }}>{msg}</span> : null}
      </div>

      <div className="crm-intake-qr-card" style={{ maxWidth: 140 }}>
        <img src={qrUrl} alt="QR code" style={{ width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ── Question editor row ────────────────────────────────────────────────────────

function QuestionRow({
  q,
  onChange,
  onDelete,
}: {
  q: GenericQuestion;
  onChange: (updated: GenericQuestion) => void;
  onDelete: () => void;
}) {
  return (
    <div className="crm-card-muted" style={{ padding: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>
            Question label
          </div>
          <input
            className="crm-input"
            type="text"
            value={q.label}
            placeholder="e.g. What is your timeline?"
            onChange={(e) => onChange({ ...q, label: e.target.value })}
          />
        </div>

        <div style={{ flex: "0 1 140px" }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>
            Type
          </div>
          <select
            className="crm-input"
            value={q.type}
            onChange={(e) =>
              onChange({ ...q, type: e.target.value as QuestionType, options: [] })
            }
          >
            <option value="text">Text</option>
            <option value="dropdown">Dropdown</option>
            <option value="yesno">Yes / No</option>
          </select>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => onChange({ ...q, required: e.target.checked })}
            />
            Required
          </label>
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={onDelete}
          >
            Remove
          </button>
        </div>
      </div>

      {q.type === "dropdown" && (
        <div style={{ marginTop: 10 }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>
            Options (one per line)
          </div>
          <textarea
            className="crm-input"
            rows={3}
            value={q.options.join("\n")}
            placeholder={"Option A\nOption B\nOption C"}
            onChange={(e) =>
              onChange({
                ...q,
                options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      )}
    </div>
  );
}

// ── Generic form builder modal ─────────────────────────────────────────────────

function GenericFormModal({
  agentId,
  editing,
  onClose,
  onSaved,
}: {
  agentId: string;
  editing: GenericForm | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [questions, setQuestions] = useState<GenericQuestion[]>(editing?.questions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateQuestion(idx: number, updated: GenericQuestion) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  }

  function deleteQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Form title is required.");
      return;
    }

    setSaving(true);
    setError("");

    const row = {
      agent_id: agentId,
      title: title.trim(),
      description: description.trim() || null,
      questions,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (editing) {
      ({ error: err } = await supabase
        .from("generic_forms")
        .update(row)
        .eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("generic_forms").insert(row));
    }

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    onSaved();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="crm-card"
        style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{editing ? "Edit Form" : "New Custom Form"}</h3>
          <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="crm-stack-10">
          <label className="crm-public-intake-field crm-public-intake-field-full">
            <span>Form Title <span style={{ color: "var(--danger, #dc2626)" }}>*</span></span>
            <input
              className="crm-input"
              type="text"
              value={title}
              placeholder="e.g. Open House Sign-In"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="crm-public-intake-field crm-public-intake-field-full">
            <span>Description</span>
            <input
              className="crm-input"
              type="text"
              value={description}
              placeholder="Optional — shown below the title"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="crm-stack-8">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="crm-detail-label">Questions ({questions.length})</div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 13 }}
                onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 && (
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                No questions yet. Add one above.
              </div>
            )}

            <div className="crm-stack-6">
              {questions.map((q, idx) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  onChange={(updated) => updateQuestion(idx, updated)}
                  onDelete={() => deleteQuestion(idx)}
                />
              ))}
            </div>
          </div>

          {error ? (
            <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
          ) : null}

          <div className="crm-inline-actions" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Form"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [sellerCount, setSellerCount] = useState(0);
  const [buyerCount, setBuyerCount] = useState(0);
  const [genericForms, setGenericForms] = useState<GenericForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<GenericForm | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      setAgentId(user.id);

      // Submission counts for built-in forms — stored as form_variant in custom_fields
      const [sellerRes, buyerRes, formsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", user.id)
          .eq("source", "website_form")
          .contains("custom_fields", { form_variant: "off_market_seller" }),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", user.id)
          .eq("source", "website_form")
          .contains("custom_fields", { form_variant: "off_market_buyer" }),
        supabase
          .from("generic_forms")
          .select("id, title, description, questions")
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      setSellerCount(sellerRes.count ?? 0);
      setBuyerCount(buyerRes.count ?? 0);

      const forms = formsRes.data || [];

      // Fetch submission counts for each generic form
      const withCounts: GenericForm[] = await Promise.all(
        forms.map(async (f) => {
          const { count } = await supabase
            .from("generic_form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_id", f.id);
          return {
            id: f.id as string,
            title: f.title as string,
            description: (f.description as string) || "",
            questions: (f.questions as GenericQuestion[]) || [],
            submission_count: count ?? 0,
          };
        })
      );

      if (!active) return;
      setGenericForms(withCounts);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleDeleteForm(id: string) {
    if (!window.confirm("Delete this form? All submissions will be lost.")) return;
    await supabase.from("generic_forms").delete().eq("id", id);
    setGenericForms((prev) => prev.filter((f) => f.id !== id));
  }

  function afterSave() {
    setShowBuilder(false);
    setEditingForm(null);
    setLoading(true);
    // Reload
    const reload = async () => {
      if (!agentId) return;
      const { data } = await supabase
        .from("generic_forms")
        .select("id, title, description, questions")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      const forms = data || [];
      const withCounts: GenericForm[] = await Promise.all(
        forms.map(async (f) => {
          const { count } = await supabase
            .from("generic_form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_id", f.id);
          return {
            id: f.id as string,
            title: f.title as string,
            description: (f.description as string) || "",
            questions: (f.questions as GenericQuestion[]) || [],
            submission_count: count ?? 0,
          };
        })
      );

      setGenericForms(withCounts);
      setLoading(false);
    };
    void reload();
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--ink-muted)" }}>Loading forms...</div>
    );
  }

  return (
    <div className="crm-stack-10">
      {/* ── Seller Form ── */}
      <section className="crm-card crm-section-card">
        <div className="crm-section-head">
          <div>
            <p className="crm-page-kicker">Built-in</p>
            <h2 className="crm-section-title">Seller Form</h2>
            <p className="crm-section-subtitle">
              Collects name, phone, email, property address, acreage, asking price, and notes.
              Submissions create a new deal in the pipeline.
            </p>
          </div>
        </div>
        {agentId ? (
          <FormShareCard
            path={`/forms/seller/${agentId}`}
            submissionCount={sellerCount}
            downloadName="seller-form-qr.png"
          />
        ) : null}
      </section>

      {/* ── Buyer Form ── */}
      <section className="crm-card crm-section-card">
        <div className="crm-section-head">
          <div>
            <p className="crm-page-kicker">Built-in</p>
            <h2 className="crm-section-title">Buyer Form</h2>
            <p className="crm-section-subtitle">
              Collects name, phone, email, price range, location preference, and notes.
              Submissions create a new buyer lead.
            </p>
          </div>
        </div>
        {agentId ? (
          <FormShareCard
            path={`/forms/buyer/${agentId}`}
            submissionCount={buyerCount}
            downloadName="buyer-form-qr.png"
          />
        ) : null}
      </section>

      {/* ── Generic Forms ── */}
      <section className="crm-card crm-section-card">
        <div className="crm-section-head">
          <div>
            <p className="crm-page-kicker">Custom</p>
            <h2 className="crm-section-title">Custom Forms</h2>
            <p className="crm-section-subtitle">
              Build any form from scratch with text, dropdown, or yes/no questions.
              Each form gets a unique shareable link and QR code.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => {
                setEditingForm(null);
                setShowBuilder(true);
              }}
            >
              + New Form
            </button>
          </div>
        </div>

        {genericForms.length === 0 ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>
            No custom forms yet. Click &ldquo;New Form&rdquo; to create one.
          </div>
        ) : (
          <div className="crm-stack-8">
            {genericForms.map((form) => (
              <div
                key={form.id}
                className="crm-card-muted"
                style={{ padding: 16, borderRadius: 8 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{form.title}</div>
                    {form.description ? (
                      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>
                        {form.description}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                      {form.questions.length} question{form.questions.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        setEditingForm(form);
                        setShowBuilder(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      style={{ fontSize: 12, color: "var(--danger, #dc2626)" }}
                      onClick={() => handleDeleteForm(form.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <FormShareCard
                  path={`/forms/generic/${form.id}`}
                  submissionCount={form.submission_count}
                  downloadName={`${form.title.toLowerCase().replace(/\s+/g, "-")}-qr.png`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Builder modal ── */}
      {showBuilder && agentId ? (
        <GenericFormModal
          agentId={agentId}
          editing={editingForm}
          onClose={() => {
            setShowBuilder(false);
            setEditingForm(null);
          }}
          onSaved={afterSave}
        />
      ) : null}
    </div>
  );
}
