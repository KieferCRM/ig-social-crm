"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";
import ManualLeadForm from "@/app/app/list/manual-lead-form";
import { sourceChannelTone } from "@/lib/inbound";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Submission = {
  id: string;
  lead_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  is_sample_workspace?: boolean;
  intent: string;
  timeline: string;
  temperature: string;
  stage: string;
  property_context: string;
  budget_range: string | null;
  location_area: string | null;
  deal_id: string | null;
  deal_stage: string | null;
  deal_address: string | null;
  next_action: string | null;
  next_action_detail: string | null;
  next_action_priority: string | null;
  next_action_due_at: string | null;
  qualification_reason: string | null;
  qualification_score: number | null;
  timestamp: string | null;
  ic_status: "new" | "reviewed" | "actioned";
};

type SubmissionFilter = "all" | "new" | "hot" | "buyer" | "seller" | "no-deal";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 60) return diffMins <= 1 ? "Just now" : `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function temperatureTone(value: string): "lead-hot" | "lead-warm" | "lead-cold" {
  const n = value.trim().toLowerCase();
  if (n === "hot") return "lead-hot";
  if (n === "warm") return "lead-warm";
  return "lead-cold";
}

function priorityColor(priority: string | null): string {
  if (priority === "urgent" || priority === "high") return "var(--danger, #dc2626)";
  if (priority === "medium") return "var(--warning, #d97706)";
  return "var(--ink-muted)";
}

function ScoreDots({ score }: { score: number | null }) {
  if (score === null) return null;
  const clamped = Math.min(10, Math.max(0, score));
  const filled = Math.round(clamped / 2);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i <= filled
              ? clamped >= 8 ? "var(--danger, #dc2626)" : clamped >= 5 ? "var(--warning, #d97706)" : "var(--ink-muted)"
              : "var(--border, #e2e8f0)",
          }}
        />
      ))}
      <span style={{ fontSize: 11, color: "var(--ink-muted)", marginLeft: 2 }}>{clamped}/10</span>
    </div>
  );
}

export default function IntakeCoordinatorPage() {
  const [tab, setTab] = useState<"queue" | "forms">("queue");
  const [baseUrl, setBaseUrl] = useState("https://lockboxhq.com");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [vanitySlug, setVanitySlug] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setAgentId(user.id);
      supabase.from("agents").select("vanity_slug").eq("id", user.id).maybeSingle().then(({ data }) => {
        setVanitySlug((data?.vanity_slug as string | null) ?? null);
      });
    });
  }, []);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [localStatus, setLocalStatus] = useState<Record<string, "new" | "reviewed" | "actioned">>({});
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showManualForm, setShowManualForm] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");
  const [subFilter, setSubFilter] = useState<SubmissionFilter>("all");
  const [copyMsg, setCopyMsg] = useState<Record<string, string>>({});
  const prevCountRef = useRef(0);

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
        prevCountRef.current = next.length;
      } catch {
        if (active) setSubsError("Could not load submissions");
      } finally {
        if (active) setLoadingSubs(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reloadToken]);

  const enrichedSubmissions = useMemo(() =>
    submissions.map((s) => ({ ...s, ic_status: localStatus[s.id] ?? s.ic_status })),
    [submissions, localStatus]
  );

  const newCount = enrichedSubmissions.filter((s) => s.ic_status === "new").length;
  const hotCount = enrichedSubmissions.filter((s) => s.temperature === "Hot").length;
  const convertedCount = enrichedSubmissions.filter((s) => s.deal_id).length;
  const sampleCount = enrichedSubmissions.filter((s) => s.is_sample_workspace).length;

  const filteredSubmissions = useMemo(() => {
    let list = enrichedSubmissions;
    if (subFilter === "new") return list.filter((s) => s.ic_status === "new");
    if (subFilter === "hot") return list.filter((s) => s.temperature === "Hot");
    if (subFilter === "buyer") return list.filter((s) => s.intent?.toLowerCase().includes("buy"));
    if (subFilter === "seller") return list.filter((s) => s.intent?.toLowerCase().includes("sell"));
    if (subFilter === "no-deal") return list.filter((s) => !s.deal_id);
    return list;
  }, [enrichedSubmissions, subFilter]);

  const selectedSubmission = useMemo(
    () => filteredSubmissions.find((s) => s.id === selectedId) ?? filteredSubmissions[0] ?? null,
    [selectedId, filteredSubmissions]
  );

  function markStatus(id: string, status: "reviewed" | "actioned") {
    setLocalStatus((prev) => ({ ...prev, [id]: status }));
  }

  async function handleCopy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopyMsg((prev) => ({ ...prev, [key]: "Copied!" }));
    setTimeout(() => setCopyMsg((prev) => ({ ...prev, [key]: "" })), 1800);
  }

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

  async function handleDownloadQr(url: string, filename: string) {
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

  return (
    <main className="crm-page crm-page-wide crm-stack-12">

      {/* Header */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Intake Coordinator</p>
            <h1 className="crm-page-title">Your lead intake queue</h1>
            <p className="crm-page-subtitle">
              Every inbound lead scored, routed, and ready for your review. Nothing gets missed.
            </p>
          </div>
          {tab === "queue" ? (
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
          {(["queue", "forms"] as const).map((t) => (
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
              {t === "queue"
                ? `Queue${submissions.length > 0 ? ` (${submissions.length})` : ""}`
                : "Forms"}
            </button>
          ))}
        </div>
      </section>

      {/* ── Queue tab ── */}
      {tab === "queue" ? (
        <div className="crm-stack-12">

          {/* Action-required banner */}
          {newCount > 0 ? (
            <section style={{
              background: "var(--danger-subtle, #fef2f2)",
              border: "1px solid var(--danger-border, #fecaca)",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--danger, #dc2626)" }}>
                    {newCount} lead{newCount !== 1 ? "s" : ""} need{newCount === 1 ? "s" : ""} your review
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                    Your Intake Coordinator processed and scored {newCount === 1 ? "this lead" : "these leads"} — review and mark as actioned when done.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setSubFilter("new")}
              >
                Show new only
              </button>
            </section>
          ) : submissions.length > 0 ? (
            <section style={{
              background: "var(--ok-subtle, #f0fdf4)",
              border: "1px solid var(--ok-border, #bbf7d0)",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <div style={{ fontSize: 13, color: "var(--ok, #16a34a)", fontWeight: 600 }}>
                Queue clear — all leads reviewed.
              </div>
            </section>
          ) : null}

          {/* Stats row */}
          <section className="crm-card crm-section-card">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="crm-chip">Total: {submissions.length}</span>
              {newCount > 0 ? <span className="crm-chip crm-chip-danger">Needs review: {newCount}</span> : null}
              <span className="crm-chip crm-chip-danger">Hot: {hotCount}</span>
              <span className="crm-chip crm-chip-ok">Converted: {convertedCount}</span>
              {sampleCount > 0 ? <span className="crm-chip">Sample: {sampleCount}</span> : null}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["all", "new", "hot", "buyer", "seller", "no-deal"] as SubmissionFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSubFilter(f)}
                    className={`crm-btn crm-btn-secondary${subFilter === f ? " crm-btn-active" : ""}`}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    {f === "no-deal" ? "No deal" : f === "new" ? `New (${newCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
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
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Your Intake Coordinator is loading the queue…</div>
            </section>
          ) : subsError ? (
            <section className="crm-card crm-section-card">
              <div style={{ color: "var(--danger)", fontSize: 13 }}>{subsError}</div>
            </section>
          ) : (
            <section className="crm-intake-grid">

              {/* Left — queue list */}
              <article className="crm-card crm-section-card crm-stack-8">
                <div className="crm-section-head">
                  <h2 className="crm-section-title">
                    {subFilter === "all" ? "All leads" : subFilter === "new" ? "Needs review" : `Filtered — ${subFilter}`}
                  </h2>
                </div>
                <div className="crm-stack-8">
                  {filteredSubmissions.length === 0 ? (
                    <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                      {submissions.length === 0
                        ? "No leads yet. Share a form link and your Intake Coordinator will process them here."
                        : "No leads match this filter."}
                    </div>
                  ) : null}
                  {filteredSubmissions.map((sub) => {
                    const isNew = sub.ic_status === "new";
                    const isActioned = sub.ic_status === "actioned";
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedId(sub.id)}
                        className={`crm-card-muted crm-intake-row${selectedSubmission?.id === sub.id ? " crm-intake-row-active" : ""}`}
                        style={{ position: "relative", opacity: isActioned ? 0.6 : 1 }}
                      >
                        {isNew ? (
                          <div style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--danger, #dc2626)",
                          }} />
                        ) : null}
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
                          {isActioned ? <StatusBadge label="Actioned" tone="ok" /> : null}
                          {sub.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                        </div>
                        <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>{formatDate(sub.timestamp)}</div>
                      </button>
                    );
                  })}
                </div>
              </article>

              {/* Right — detail panel */}
              <article className="crm-card crm-section-card crm-stack-10">
                {selectedSubmission ? (
                  <>
                    {/* Lead identity */}
                    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedSubmission.lead_name}</div>
                          <div style={{ color: "var(--ink-muted)", marginTop: 4, fontSize: 13 }}>{selectedSubmission.property_context}</div>
                        </div>
                        <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                          <StatusBadge label={selectedSubmission.source} tone={sourceChannelTone(selectedSubmission.source)} />
                          <StatusBadge label={selectedSubmission.temperature} tone={temperatureTone(selectedSubmission.temperature)} />
                          {selectedSubmission.is_sample_workspace ? <StatusBadge label="Sample" tone="default" /> : null}
                        </div>
                      </div>

                      {/* Contact info */}
                      {(selectedSubmission.phone || selectedSubmission.email) ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                          {selectedSubmission.phone ? (
                            <button
                              type="button"
                              onClick={() => void handleCopy(selectedSubmission.phone!, "phone")}
                              style={{ fontSize: 13, color: "var(--ink-primary, #0ea5e9)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                            >
                              {copyMsg["phone"] ?? selectedSubmission.phone}
                            </button>
                          ) : null}
                          {selectedSubmission.email ? (
                            <button
                              type="button"
                              onClick={() => void handleCopy(selectedSubmission.email!, "email")}
                              style={{ fontSize: 13, color: "var(--ink-primary, #0ea5e9)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                            >
                              {copyMsg["email"] ?? selectedSubmission.email}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="crm-detail-grid">
                        <div><div className="crm-detail-label">Intent</div><div>{selectedSubmission.intent}</div></div>
                        <div><div className="crm-detail-label">Timeframe</div><div>{selectedSubmission.timeline}</div></div>
                        <div><div className="crm-detail-label">Budget</div><div>{selectedSubmission.budget_range ?? "Not provided"}</div></div>
                        <div><div className="crm-detail-label">Area</div><div>{selectedSubmission.location_area ?? "Not provided"}</div></div>
                      </div>
                    </div>

                    {/* IC scoring */}
                    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>IC Assessment</span>
                        <ScoreDots score={selectedSubmission.qualification_score} />
                      </div>
                      {selectedSubmission.qualification_reason ? (
                        <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
                          {selectedSubmission.qualification_reason}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>No scoring detail available.</div>
                      )}
                    </div>

                    {/* Suggested next action */}
                    {selectedSubmission.next_action ? (
                      <div className="crm-card-muted crm-stack-8" style={{ padding: 16, borderLeft: `3px solid ${priorityColor(selectedSubmission.next_action_priority)}` }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Suggested next step</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: priorityColor(selectedSubmission.next_action_priority) }}>
                          {selectedSubmission.next_action}
                        </div>
                        {selectedSubmission.next_action_detail ? (
                          <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
                            {selectedSubmission.next_action_detail}
                          </div>
                        ) : null}
                        {selectedSubmission.next_action_due_at ? (
                          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                            Due: {new Date(selectedSubmission.next_action_due_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* CRM result */}
                    <div className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>What was created</div>
                      <div className="crm-detail-grid">
                        <div>
                          <div className="crm-detail-label">Contact</div>
                          <div style={{ color: "var(--ok, #16a34a)", fontWeight: 600 }}>✓ Created</div>
                        </div>
                        <div>
                          <div className="crm-detail-label">Deal</div>
                          {selectedSubmission.deal_id ? (
                            <Link href={`/app/deals`} style={{ color: "var(--ok, #16a34a)", fontWeight: 600, textDecoration: "none" }}>
                              ✓ {selectedSubmission.deal_address ?? "Deal linked"}
                            </Link>
                          ) : (
                            <div style={{ color: "var(--ink-muted)" }}>Not created</div>
                          )}
                        </div>
                        <div>
                          <div className="crm-detail-label">Deal stage</div>
                          <div>{selectedSubmission.deal_stage ?? "—"}</div>
                        </div>
                        <div>
                          <div className="crm-detail-label">Lead stage</div>
                          <div>{selectedSubmission.stage}</div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {selectedSubmission.ic_status !== "actioned" ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          style={{ fontSize: 13 }}
                          onClick={() => markStatus(selectedSubmission.id, "actioned")}
                        >
                          Mark actioned
                        </button>
                      ) : null}
                      {selectedSubmission.ic_status === "new" ? (
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          style={{ fontSize: 13 }}
                          onClick={() => markStatus(selectedSubmission.id, "reviewed")}
                        >
                          Mark reviewed
                        </button>
                      ) : null}
                      <Link
                        href={`/app/contacts`}
                        className="crm-btn crm-btn-secondary"
                        style={{ fontSize: 13, textDecoration: "none" }}
                      >
                        View contact →
                      </Link>
                      {selectedSubmission.deal_id ? (
                        <Link
                          href={`/app/deals`}
                          className="crm-btn crm-btn-secondary"
                          style={{ fontSize: 13, textDecoration: "none" }}
                        >
                          View deal →
                        </Link>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                    {submissions.length === 0
                      ? "No leads in the queue yet. Share a form link and your Intake Coordinator will process them here."
                      : "Select a lead to see the full IC assessment."}
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
              <h2 className="crm-section-title">Your intake forms</h2>
              <p className="crm-section-subtitle">
                Share these links anywhere — social bio, open house table, business card. Every submission goes straight to your queue.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {[
              { label: "Buyer Form", description: "Looking to buy — area, budget, timeline.", path: `/forms/buyer/${vanitySlug ?? agentId ?? ""}` },
              { label: "Seller Form", description: "Ready to sell — address, condition, timing.", path: `/forms/seller/${vanitySlug ?? agentId ?? ""}` },
              { label: "Contact Form", description: "Just a contact — name, phone, quick note.", path: `/forms/contact/${vanitySlug ?? agentId ?? ""}` },
            ].map(({ label, description, path }) => {
              const publicUrl = `${baseUrl}${path}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?format=png&size=520x520&data=${encodeURIComponent(publicUrl)}`;
              const key = label;
              return (
                <div key={label} className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                  <div className="crm-stack-4">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
                    <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>{description}</div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink-faint)", wordBreak: "break-all" }}>
                    {publicUrl}
                  </div>
                  <div className="crm-inline-actions" style={{ gap: 8 }}>
                    <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleCopy(publicUrl, key)} style={{ fontSize: 13 }}>
                      {copyMsg[key] ?? "Copy link"}
                    </button>
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void handleDownloadQr(qrUrl, `lockboxhq-${label.toLowerCase().replace(/\s+/g, "-")}.png`)} style={{ fontSize: 13 }}>
                      Download QR
                    </button>
                    <a href={path} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>
                      Preview
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

    </main>
  );
}
