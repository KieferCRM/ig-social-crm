"use client";

import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import ManualLeadForm from "@/app/app/list/manual-lead-form";
import { sourceChannelTone } from "@/lib/inbound";

type Submission = {
  id: string;
  lead_name: string;
  source: string;
  is_sample_workspace?: boolean;
  intent: string;
  timeline: string;
  temperature: string;
  stage: string;
  property_context: string;
  budget_range: string | null;
  deal_id: string | null;
  deal_stage: string | null;
  next_action: string | null;
  next_action_detail: string | null;
  next_action_priority: string | null;
  next_action_due_at: string | null;
  timestamp: string | null;
};

type SubmissionFilter = "all" | "hot" | "buyer" | "seller" | "no-deal";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function temperatureTone(value: string): "lead-hot" | "lead-warm" | "lead-cold" {
  const n = value.trim().toLowerCase();
  if (n === "hot") return "lead-hot";
  if (n === "warm") return "lead-warm";
  return "lead-cold";
}

async function copyText(value: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(value); return true; }
  catch { return false; }
}

async function downloadQr(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function FormCard({ label, description, path, baseUrl }: {
  label: string;
  description: string;
  path: string;
  baseUrl: string;
}) {
  const [msg, setMsg] = useState("");
  const publicUrl = `${baseUrl}${path}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?format=png&size=520x520&data=${encodeURIComponent(publicUrl)}`;

  async function handleCopy() {
    const ok = await copyText(publicUrl);
    setMsg(ok ? "Copied!" : "Copy failed");
    setTimeout(() => setMsg(""), 1800);
  }

  return (
    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
      <div className="crm-stack-4">
        <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{description}</div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink-faint)", wordBreak: "break-all" }}>
        {publicUrl}
      </div>
      <div className="crm-inline-actions" style={{ gap: 8 }}>
        <button type="button" className="crm-btn crm-btn-primary" onClick={handleCopy} style={{ fontSize: 13 }}>
          Copy link
        </button>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => void downloadQr(qrUrl, `lockboxhq-${label.toLowerCase().replace(/\s+/g, "-")}.png`)}
          style={{ fontSize: 13 }}
        >
          Download QR
        </button>
        <a href={path} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>
          Preview
        </a>
      </div>
      {msg ? <span style={{ fontSize: 12, color: "var(--ok, #16a34a)" }}>{msg}</span> : null}
    </div>
  );
}

export default function IntakeWorkspacePage() {
  const [tab, setTab] = useState<"submissions" | "forms">("submissions");
  const [baseUrl, setBaseUrl] = useState("https://lockboxhq.com");

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");
  const [subFilter, setSubFilter] = useState<SubmissionFilter>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingSubs(true);
      try {
        const res = await fetch("/api/intake/submissions", { cache: "no-store" });
        const data = (await res.json()) as { submissions?: Submission[]; error?: string };
        if (!active) return;
        if (!res.ok) { setSubsError(data.error ?? "Could not load submissions"); return; }
        const next = data.submissions ?? [];
        setSubmissions(next);
        setSelectedId((cur) => (next.some((s) => s.id === cur) ? cur : (next[0]?.id ?? "")));
        setSubsError(null);
      } catch {
        if (active) setSubsError("Could not load submissions");
      } finally {
        if (active) setLoadingSubs(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reloadToken]);

  const hotCount = submissions.filter((s) => s.temperature === "Hot").length;
  const convertedCount = submissions.filter((s) => s.deal_id).length;
  const sampleCount = submissions.filter((s) => s.is_sample_workspace).length;

  const filteredSubmissions = useMemo(() => {
    if (subFilter === "all") return submissions;
    if (subFilter === "hot") return submissions.filter((s) => s.temperature === "Hot");
    if (subFilter === "buyer") return submissions.filter((s) => s.intent?.toLowerCase().includes("buy"));
    if (subFilter === "seller") return submissions.filter((s) => s.intent?.toLowerCase().includes("sell"));
    if (subFilter === "no-deal") return submissions.filter((s) => !s.deal_id);
    return submissions;
  }, [submissions, subFilter]);

  const selectedSubmission = useMemo(
    () => filteredSubmissions.find((s) => s.id === selectedId) ?? filteredSubmissions[0] ?? null,
    [selectedId, filteredSubmissions]
  );

  async function handleClearSampleData() {
    if (sampleBusy) return;
    setSampleBusy(true);
    setSampleMessage("");
    try {
      const res = await fetch("/api/onboarding/sample-workspace", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; removed?: number; error?: string };
      if (!res.ok) { setSampleMessage(data.error ?? "Could not remove sample data."); return; }
      setSampleMessage(`Removed ${data.removed ?? 0} sample lead${data.removed === 1 ? "" : "s"}.`);
      setReloadToken((v) => v + 1);
    } catch {
      setSampleMessage("Could not remove sample data.");
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">

      {/* Header */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Inquiries</p>
            <h1 className="crm-page-title">Forms and inbound leads</h1>
            <p className="crm-page-subtitle">
              Share your forms anywhere you collect leads. Every submission auto-updates your CRM.
            </p>
          </div>
          {tab === "submissions" ? (
            <div className="crm-page-actions">
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => setShowManualForm((v) => !v)}
              >
                {showManualForm ? "Cancel" : "Add manually"}
              </button>
              {sampleCount > 0 ? (
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => void handleClearSampleData()}
                  disabled={sampleBusy}
                >
                  {sampleBusy ? "Removing…" : "Remove sample data"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Tab bar */}
        <div className="crm-inline-actions" style={{ gap: 0, borderBottom: "1px solid var(--border)", marginTop: 4 }}>
          {(["submissions", "forms"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent",
                padding: "8px 18px",
                fontSize: 14,
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? "var(--ink)" : "var(--ink-muted)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t === "submissions"
                ? `Submissions${submissions.length > 0 ? ` (${submissions.length})` : ""}`
                : "Forms"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Submissions tab ── */}
      {tab === "submissions" ? (
        <div className="crm-stack-12">
          <section className="crm-card crm-section-card">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="crm-chip">Total: {submissions.length}</span>
              <span className="crm-chip crm-chip-danger">Hot: {hotCount}</span>
              <span className="crm-chip crm-chip-ok">Converted: {convertedCount}</span>
              {sampleCount > 0 ? <span className="crm-chip">Sample: {sampleCount}</span> : null}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {(["all", "hot", "buyer", "seller", "no-deal"] as SubmissionFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSubFilter(f)}
                    className={`crm-btn crm-btn-secondary${subFilter === f ? " crm-btn-active" : ""}`}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    {f === "no-deal" ? "No deal" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {sampleMessage ? (
              <div className={`crm-chip ${sampleMessage.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`} style={{ marginTop: 8 }}>
                {sampleMessage}
              </div>
            ) : null}
          </section>

          {showManualForm ? (
            <ManualLeadForm
              onSaved={() => { setReloadToken((v) => v + 1); setShowManualForm(false); }}
              onCancel={() => setShowManualForm(false)}
            />
          ) : null}

          {loadingSubs ? (
            <section className="crm-card crm-section-card">
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading submissions…</div>
            </section>
          ) : subsError ? (
            <section className="crm-card crm-section-card">
              <div style={{ color: "var(--danger)", fontSize: 13 }}>{subsError}</div>
            </section>
          ) : (
            <section className="crm-intake-grid">
              <article className="crm-card crm-section-card crm-stack-8">
                <div className="crm-section-head">
                  <h2 className="crm-section-title">
                    {subFilter === "all" ? "All submissions" : `Filtered — ${subFilter}`}
                  </h2>
                </div>
                <div className="crm-stack-8">
                  {filteredSubmissions.length === 0 ? (
                    <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                      {submissions.length === 0
                        ? "No submissions yet. Share a form link and leads will appear here."
                        : "No submissions match this filter."}
                    </div>
                  ) : null}
                  {filteredSubmissions.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedId(sub.id)}
                      className={`crm-card-muted crm-intake-row${selectedSubmission?.id === sub.id ? " crm-intake-row-active" : ""}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div className="crm-stack-4" style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{sub.lead_name}</div>
                          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{sub.property_context}</div>
                        </div>
                        <StatusBadge label={sub.temperature} tone={temperatureTone(sub.temperature)} />
                      </div>
                      <div className="crm-inline-actions" style={{ gap: 6, flexWrap: "wrap" }}>
                        <StatusBadge label={sub.source} tone={sourceChannelTone(sub.source)} />
                        <StatusBadge label={sub.intent} tone="default" />
                        {sub.deal_id ? <StatusBadge label="Deal linked" tone="ok" /> : null}
                        {sub.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                      </div>
                      <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{formatDate(sub.timestamp)}</div>
                    </button>
                  ))}
                </div>
              </article>

              <article className="crm-card crm-section-card crm-stack-10">
                <div className="crm-section-head">
                  <div>
                    <h2 className="crm-section-title">Submission detail</h2>
                    <p className="crm-section-subtitle">What the system understood and what was created.</p>
                  </div>
                </div>
                {selectedSubmission ? (
                  <>
                    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedSubmission.lead_name}</div>
                          <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>{selectedSubmission.property_context}</div>
                        </div>
                        <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                          <StatusBadge label={selectedSubmission.source} tone={sourceChannelTone(selectedSubmission.source)} />
                          <StatusBadge label={selectedSubmission.temperature} tone={temperatureTone(selectedSubmission.temperature)} />
                          {selectedSubmission.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                        </div>
                      </div>
                      <div className="crm-detail-grid">
                        <div><div className="crm-detail-label">Intent</div><div>{selectedSubmission.intent}</div></div>
                        <div><div className="crm-detail-label">Timeframe</div><div>{selectedSubmission.timeline}</div></div>
                        <div><div className="crm-detail-label">Budget</div><div>{selectedSubmission.budget_range ?? "Not provided"}</div></div>
                        <div><div className="crm-detail-label">Lead stage</div><div>{selectedSubmission.stage}</div></div>
                      </div>
                    </div>
                    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700 }}>CRM result</div>
                      <div className="crm-detail-grid">
                        <div><div className="crm-detail-label">Deal created</div><div>{selectedSubmission.deal_id ? "Yes" : "No"}</div></div>
                        <div><div className="crm-detail-label">Deal stage</div><div>{selectedSubmission.deal_stage ?? "—"}</div></div>
                        <div><div className="crm-detail-label">Next action</div><div>{selectedSubmission.next_action ?? "Not set"}</div></div>
                        <div><div className="crm-detail-label">Due</div><div>{formatDate(selectedSubmission.next_action_due_at)}</div></div>
                      </div>
                      {selectedSubmission.next_action_detail ? (
                        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{selectedSubmission.next_action_detail}</div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                    Select a submission to see how it mapped into the CRM.
                  </div>
                )}
              </article>
            </section>
          )}
        </div>
      ) : null}

      {/* ── Forms tab ── */}
      {tab === "forms" ? (
        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <div>
              <h2 className="crm-section-title">Your forms</h2>
              <p className="crm-section-subtitle">
                Three forms ready to share anywhere — social bio, open house table, business card. Copy the link or download a QR code.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <FormCard
              label="Buyer form"
              description="Looking to buy — area, budget, timeline."
              path="/buyer"
              baseUrl={baseUrl}
            />
            <FormCard
              label="Seller form"
              description="Ready to sell — address, condition, timing."
              path="/seller"
              baseUrl={baseUrl}
            />
            <FormCard
              label="Generic form"
              description="Just a contact — name, phone, quick note."
              path="/contact"
              baseUrl={baseUrl}
            />
          </div>
        </section>
      ) : null}

    </main>
  );
}
