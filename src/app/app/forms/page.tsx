"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";

// ── Types ──────────────────────────────────────────────────────────────────────

type QuestionType = "text" | "dropdown" | "yesno";

type GenericQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

type GenericForm = {
  id: string;
  title: string;
  description: string;
  questions: GenericQuestion[];
  submission_count: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function newQuestion(): GenericQuestion {
  return { id: crypto.randomUUID(), label: "", type: "text", required: false, options: [] };
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

// ── Compact share row ──────────────────────────────────────────────────────────

function FormShareRow({
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
  const [showQr, setShowQr] = useState(false);

  useEffect(() => { setUrl(`${window.location.origin}${path}`); }, [path]);

  const qrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?format=png&size=400x400&data=${encodeURIComponent(url)}`,
    [url]
  );

  async function handleCopy() {
    const ok = await copyText(url);
    setMsg(ok ? "Copied!" : "Failed");
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
      {/* Link row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <code style={{ flex: 1, fontSize: 12, color: "var(--ink-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url}
        </code>
        <button type="button" className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: "5px 12px", flexShrink: 0 }} onClick={handleCopy}>
          Copy link
        </button>
        <Link href={path} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "5px 12px", flexShrink: 0 }}>
          Preview
        </Link>
        <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "5px 12px", flexShrink: 0 }} onClick={() => setShowQr((v) => !v)}>
          {showQr ? "Hide QR" : "QR code"}
        </button>
        {msg ? <span style={{ fontSize: 12, color: "var(--ok, #16a34a)", fontWeight: 600 }}>{msg}</span> : null}
      </div>

      {/* QR panel */}
      {showQr ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <img src={qrUrl} alt="QR code" style={{ width: 100, height: 100, borderRadius: 6, border: "1px solid var(--border)" }} />
          <div className="crm-stack-6">
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>Print or share this QR code to send people directly to the form.</p>
            <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "5px 12px", width: "fit-content" }} onClick={handleDownloadQr}>
              Download QR
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Compact built-in form card ─────────────────────────────────────────────────

function BuiltInFormCard({
  label,
  description,
  path,
  submissionCount,
  downloadName,
}: {
  label: string;
  description: string;
  path: string;
  submissionCount: number;
  downloadName: string;
}) {
  return (
    <div className="crm-card crm-section-card crm-stack-10">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
          <span className="crm-chip" style={{ fontSize: 11 }}>{submissionCount} submissions</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>{description}</p>
      </div>
      <FormShareRow path={path} submissionCount={submissionCount} downloadName={downloadName} />
    </div>
  );
}

// ── Question editor row ────────────────────────────────────────────────────────

function QuestionRow({ q, onChange, onDelete }: {
  q: GenericQuestion;
  onChange: (updated: GenericQuestion) => void;
  onDelete: () => void;
}) {
  return (
    <div className="crm-card-muted" style={{ padding: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>Question</div>
          <input
            className="crm-input"
            type="text"
            value={q.label}
            placeholder="e.g. What is your timeline?"
            onChange={(e) => onChange({ ...q, label: e.target.value })}
          />
        </div>
        <div style={{ flex: "0 1 130px" }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>Type</div>
          <select
            className="crm-input"
            value={q.type}
            onChange={(e) => onChange({ ...q, type: e.target.value as QuestionType, options: [] })}
          >
            <option value="text">Text</option>
            <option value="dropdown">Dropdown</option>
            <option value="yesno">Yes / No</option>
          </select>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <input type="checkbox" checked={q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} />
            Required
          </label>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
      {q.type === "dropdown" && (
        <div style={{ marginTop: 10 }}>
          <div className="crm-detail-label" style={{ marginBottom: 4 }}>Options (one per line)</div>
          <textarea
            className="crm-input"
            rows={3}
            value={q.options.join("\n")}
            placeholder={"Option A\nOption B\nOption C"}
            onChange={(e) => onChange({ ...q, options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      )}
    </div>
  );
}

// ── Generic form builder modal ─────────────────────────────────────────────────

function GenericFormModal({ agentId, editing, onClose, onSaved }: {
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
    if (!title.trim()) { setError("Form title is required."); return; }
    setSaving(true);
    setError("");
    const row = { agent_id: agentId, title: title.trim(), description: description.trim() || null, questions, updated_at: new Date().toISOString() };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("generic_forms").update(row).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("generic_forms").insert(row));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="crm-card" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{editing ? "Edit Form" : "New Custom Form"}</h3>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Cancel</button>
        </div>

        <div className="crm-stack-10">
          <label className="crm-public-intake-field crm-public-intake-field-full">
            <span>Form Title <span style={{ color: "var(--danger, #dc2626)" }}>*</span></span>
            <input className="crm-input" type="text" value={title} placeholder="e.g. Open House Sign-In" onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="crm-public-intake-field crm-public-intake-field-full">
            <span>Description</span>
            <input className="crm-input" type="text" value={description} placeholder="Optional — shown below the title" onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="crm-stack-8">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="crm-detail-label">Questions ({questions.length})</div>
              <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }} onClick={() => setQuestions((prev) => [...prev, newQuestion()])}>
                + Add Question
              </button>
            </div>
            {questions.length === 0 && (
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>No questions yet. Add one above.</div>
            )}
            <div className="crm-stack-6">
              {questions.map((q, idx) => (
                <QuestionRow key={q.id} q={q} onChange={(updated) => updateQuestion(idx, updated)} onDelete={() => deleteQuestion(idx)} />
              ))}
            </div>
          </div>

          {error ? <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div> : null}

          <div className="crm-inline-actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="crm-btn crm-btn-primary" disabled={saving} onClick={handleSave}>
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
  const [isOffMarketAccount, setIsOffMarketAccount] = useState(false);
  const [sellerCount, setSellerCount] = useState(0);
  const [buyerCount, setBuyerCount] = useState(0);
  const [genericForms, setGenericForms] = useState<GenericForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<GenericForm | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setAgentId(user.id);

      const { data: agentRow } = await supabase.from("agents").select("settings").eq("id", user.id).maybeSingle();
      const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings ?? null);
      if (active) setIsOffMarketAccount(onboardingState.account_type === "off_market_agent");

      const [sellerRes, buyerRes, formsRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", user.id).eq("source", "seller_form"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", user.id).eq("source", "buyer_form"),
        supabase.from("generic_forms").select("id, title, description, questions").eq("agent_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      setSellerCount(sellerRes.count ?? 0);
      setBuyerCount(buyerRes.count ?? 0);

      const forms = formsRes.data || [];
      const withCounts: GenericForm[] = await Promise.all(
        forms.map(async (f) => {
          const { count } = await supabase.from("generic_form_submissions").select("id", { count: "exact", head: true }).eq("form_id", f.id);
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
    return () => { active = false; };
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
    const reload = async () => {
      if (!agentId) return;
      const { data } = await supabase.from("generic_forms").select("id, title, description, questions").eq("agent_id", agentId).order("created_at", { ascending: false });
      const forms = data || [];
      const withCounts: GenericForm[] = await Promise.all(
        forms.map(async (f) => {
          const { count } = await supabase.from("generic_form_submissions").select("id", { count: "exact", head: true }).eq("form_id", f.id);
          return { id: f.id as string, title: f.title as string, description: (f.description as string) || "", questions: (f.questions as GenericQuestion[]) || [], submission_count: count ?? 0 };
        })
      );
      setGenericForms(withCounts);
      setLoading(false);
    };
    void reload();
  }

  if (loading) {
    return <div style={{ padding: 32, color: "var(--ink-muted)" }}>Loading forms...</div>;
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Forms</h1>
            <p className="crm-page-subtitle">
              Share your built-in seller and buyer forms, or build custom forms for open houses and events. Each form gets a unique link and QR code.
            </p>
          </div>
        </div>
      </section>

      {/* Built-in forms — 2 column grid */}
      <section className="crm-stack-6">
        <div className="crm-detail-label" style={{ paddingLeft: 2 }}>Built-in forms</div>
        <div className="crm-grid-cards-2">
          {agentId ? (
            <>
              <BuiltInFormCard
                label="Seller Form"
                description="Collects name, phone, email, property address, acreage, asking price, and notes. Submissions create a new deal in the pipeline."
                path={`/forms/seller/${agentId}`}
                submissionCount={sellerCount}
                downloadName="seller-form-qr.png"
              />
              <BuiltInFormCard
                label={isOffMarketAccount ? "Contact Form" : "Buyer Form"}
                description={
                  isOffMarketAccount
                    ? "Captures name, phone, email, budget range, and notes. Use for general inquiries, open house sign-ins, referrals, or anyone reaching out about a property."
                    : "Collects name, phone, email, price range, location preference, and notes. Submissions create a new buyer lead."
                }
                path={`/forms/buyer/${agentId}`}
                submissionCount={buyerCount}
                downloadName={isOffMarketAccount ? "contact-form-qr.png" : "buyer-form-qr.png"}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Custom forms */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Custom Forms</h2>
            <p className="crm-section-subtitle">
              Build any form from scratch — text, dropdown, or yes/no questions. Each gets its own link and QR code.
            </p>
          </div>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            onClick={() => { setEditingForm(null); setShowBuilder(true); }}
          >
            + New Form
          </button>
        </div>

        {genericForms.length === 0 ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>
            No custom forms yet. Click &ldquo;New Form&rdquo; to create one.
          </div>
        ) : (
          <div className="crm-stack-6">
            {genericForms.map((form) => (
              <div key={form.id} className="crm-card-muted crm-stack-10" style={{ padding: 16, borderRadius: 8 }}>
                {/* Form header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{form.title}</span>
                      <span className="crm-chip" style={{ fontSize: 11 }}>{form.submission_count} submissions</span>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{form.questions.length} question{form.questions.length !== 1 ? "s" : ""}</span>
                    </div>
                    {form.description ? (
                      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>{form.description}</div>
                    ) : null}
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => { setEditingForm(form); setShowBuilder(true); }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      style={{ fontSize: 12, padding: "4px 10px", color: "var(--danger, #dc2626)" }}
                      onClick={() => handleDeleteForm(form.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Share controls */}
                <FormShareRow
                  path={`/forms/generic/${form.id}`}
                  submissionCount={form.submission_count}
                  downloadName={`${form.title.toLowerCase().replace(/\s+/g, "-")}-qr.png`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Builder modal */}
      {showBuilder && agentId ? (
        <GenericFormModal
          agentId={agentId}
          editing={editingForm}
          onClose={() => { setShowBuilder(false); setEditingForm(null); }}
          onSaved={afterSave}
        />
      ) : null}
    </main>
  );
}
