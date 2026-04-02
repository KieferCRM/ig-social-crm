"use client";

import QRCode from "qrcode";
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
  options: string[];
};

type GenericForm = {
  id: string;
  title: string;
  description: string;
  questions: GenericQuestion[];
  submission_count: number;
  short_code: string | null;
};

const LINK_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
function genShortCode(): string {
  return Array.from({ length: 6 }, () => LINK_CHARS[Math.floor(Math.random() * LINK_CHARS.length)]).join("");
}

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
  downloadName,
}: {
  path: string;
  downloadName: string;
}) {
  const [url, setUrl] = useState(`https://lockboxhq.com${path}`);
  const [msg, setMsg] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => { setUrl(`${window.location.origin}${path}`); }, [path]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 400, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);

  async function handleCopy() {
    const ok = await copyText(url);
    setMsg(ok ? "Copied!" : "Failed");
    window.setTimeout(() => setMsg(""), 1800);
  }

  function handleDownloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="crm-stack-8">
      {/* Full URL */}
      <code style={{ display: "block", fontSize: 12, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {url}
      </code>
      {/* Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={handleCopy}>
          Copy link
        </button>
        <Link href={path} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }}>
          Preview
        </Link>
        <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setShowQr((v) => !v)}>
          {showQr ? "Hide QR" : "QR code"}
        </button>
        {msg ? <span style={{ fontSize: 12, color: "var(--ok, #16a34a)", fontWeight: 600 }}>{msg}</span> : null}
      </div>

      {/* QR panel */}
      {showQr ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {qrDataUrl ? <img src={qrDataUrl} alt="QR code" style={{ width: 100, height: 100, borderRadius: 6, border: "1px solid var(--border)" }} /> : <div style={{ width: 100, height: 100, borderRadius: 6, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-muted)" }}>Loading…</div>}
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
      <FormShareRow path={path} downloadName={downloadName} />
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
    const row: Record<string, unknown> = { agent_id: agentId, title: title.trim(), description: description.trim() || null, questions, updated_at: new Date().toISOString() };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("generic_forms").update(row).eq("id", editing.id));
    } else {
      row.short_code = genShortCode();
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

// ── Form Submissions Modal ─────────────────────────────────────────────────────

type SubmissionRow = {
  id: string;
  submission_data: Record<string, string>;
  created_at: string;
};

function FormSubmissionsModal({ form, onClose }: { form: GenericForm; onClose: () => void }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("generic_form_submissions")
      .select("id, submission_data, created_at")
      .eq("form_id", form.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!active) return;
        setSubmissions((data ?? []) as SubmissionRow[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, [supabase, form.id]);

  function formatTs(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 24, overflowY: "auto" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="crm-card" style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{form.title} — Submissions</h3>
            <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>{form.submission_count} total</div>
          </div>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>No submissions yet.</div>
        ) : (
          <div className="crm-stack-8">
            {submissions.map((sub) => (
              <div key={sub.id} className="crm-card-muted" style={{ padding: 14, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 10 }}>{formatTs(sub.created_at)}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {form.questions.map((q) => {
                    const answer = sub.submission_data[q.id];
                    return (
                      <div key={q.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: "var(--ink-muted)" }}>{q.label}</div>
                        <div>{answer ?? <span style={{ color: "var(--ink-faint)", fontStyle: "italic" }}>—</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [vanitySlug, setVanitySlug] = useState<string | null>(null);
  const [smartFormCount, setSmartFormCount] = useState(0);
  const [openHouseCount, setOpenHouseCount] = useState(0);
  const [genericForms, setGenericForms] = useState<GenericForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<GenericForm | null>(null);
  const [viewingSubmissions, setViewingSubmissions] = useState<GenericForm | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setAgentId(user.id);

      const { data: agentRow } = await supabase.from("agents").select("vanity_slug").eq("id", user.id).maybeSingle();
      if (active) {
        setVanitySlug((agentRow?.vanity_slug as string | null) ?? null);
      }

      const [smartFormRes, openHouseRes, formsRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", user.id).eq("source", "contact_form"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", user.id).eq("source", "open_house_form"),
        supabase.from("generic_forms").select("id, title, description, questions, short_code").eq("agent_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      setSmartFormCount(smartFormRes.count ?? 0);
      setOpenHouseCount(openHouseRes.count ?? 0);

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
            short_code: (f.short_code as string | null) ?? null,
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
      const { data } = await supabase.from("generic_forms").select("id, title, description, questions, short_code").eq("agent_id", agentId).order("created_at", { ascending: false });
      const forms = data || [];
      const withCounts: GenericForm[] = await Promise.all(
        forms.map(async (f) => {
          const { count } = await supabase.from("generic_form_submissions").select("id", { count: "exact", head: true }).eq("form_id", f.id);
          return { id: f.id as string, title: f.title as string, description: (f.description as string) || "", questions: (f.questions as GenericQuestion[]) || [], submission_count: count ?? 0, short_code: (f.short_code as string | null) ?? null };
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
        {!vanitySlug && agentId ? (
          <div style={{ fontSize: 13, color: "var(--ink-muted)", background: "var(--surface-2, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
            Set a custom URL slug in{" "}
            <a href="/app/settings/profile" style={{ color: "var(--accent, #2563eb)", textDecoration: "underline" }}>
              Settings → Profile
            </a>{" "}
            to get a branded form link instead of a raw UUID.
          </div>
        ) : null}
        <div className="crm-grid-cards-2">
          {agentId ? (
            <>
              <BuiltInFormCard
                label="Smart Lead Form"
                description="The one link to share everywhere — social bio, posts, mailers. Step 1 captures name and phone instantly. Step 2 asks buyer or seller questions based on what they choose."
                path={`/forms/${vanitySlug ?? agentId}`}
                submissionCount={smartFormCount}
                downloadName="smart-form-qr.png"
              />
              <BuiltInFormCard
                label="Open House Sign-In"
                description="QR code sign-in for open houses. Captures name, phone, email, buyer agent status, and how they heard about the open house."
                path={`/forms/open-house/${vanitySlug ?? agentId}`}
                submissionCount={openHouseCount}
                downloadName="open-house-signin-qr.png"
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
                      onClick={() => setViewingSubmissions(form)}
                    >
                      Submissions
                    </button>
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
                  downloadName={`${form.title.toLowerCase().replace(/\s+/g, "-")}-qr.png`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Submissions modal */}
      {viewingSubmissions && (
        <FormSubmissionsModal
          form={viewingSubmissions}
          onClose={() => setViewingSubmissions(null)}
        />
      )}

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
