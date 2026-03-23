"use client";

/**
 * /app/secretary — Secretary Command Center
 *
 * AI call handling, SMS conversations, transcripts, and alerts in one place.
 * Tabs: Activity | Conversations | Transcripts | Alerts
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "activity" | "conversations" | "transcripts" | "alerts";
type LeadTemp = string | null;

type LeadRef = {
  id: string;
  full_name: string | null;
  canonical_phone: string | null;
  lead_temp: LeadTemp;
};

type ActivityItem = {
  id: string;
  created_at: string;
  channel: string;
  direction: string;
  interaction_type: string;
  status: string;
  raw_message_body: string | null;
  summary: string | null;
  lead_id: string;
  leads: LeadRef | null;
};

type ConversationThread = {
  id: string;
  created_at: string;
  channel: string;
  direction: string;
  raw_message_body: string | null;
  lead_id: string;
  leads: LeadRef | null;
};

type ThreadMessage = {
  id: string;
  created_at: string;
  channel: string;
  direction: string;
  raw_message_body: string | null;
  interaction_type: string;
};

type Transcript = {
  id: string;
  created_at: string;
  channel: string;
  direction: string;
  interaction_type: string;
  status: string;
  raw_transcript: string | null;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  lead_id: string;
  leads: LeadRef | null;
};

type Alert = {
  id: string;
  created_at: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  metadata: Record<string, unknown>;
  lead_id: string | null;
  leads: LeadRef | null;
};

type SecretarySettings = {
  receptionist_enabled: boolean;
  communications_enabled: boolean;
  business_phone_number: string;
  call_handling_mode: string;
  after_hours_enabled: boolean;
  voice_tier: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMP_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  hot:  { bg: "#fee2e2", color: "#dc2626", label: "Hot" },
  warm: { bg: "#fef3c7", color: "#d97706", label: "Warm" },
  cold: { bg: "#eff6ff", color: "#2563eb", label: "Cold" },
};

function TempBadge({ temp }: { temp: LeadTemp }) {
  const key = (temp ?? "").toLowerCase();
  const s = TEMP_STYLES[key];
  if (!s) return <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", borderRadius: 4, padding: "1px 6px" }}>—</span>;
  return <span style={{ fontSize: 11, color: s.color, background: s.bg, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>{s.label}</span>;
}

function leadLabel(lead: LeadRef | null): string {
  if (!lead) return "Unknown";
  return lead.full_name || lead.canonical_phone || "Unknown";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  missed_call_textback: "Missed call textback",
  call_inbound: "Inbound call",
  call_outbound: "Outbound call",
  voice: "Voice call",
  system: "System",
};

const CALL_HANDLING_LABELS: Record<string, string> = {
  qualify_transfer: "Qualify then transfer",
  always_transfer: "Always transfer",
  always_ai: "AI always handles",
  qualify_callback: "Qualify then callback",
};

function tempBorderColor(temp: LeadTemp): string {
  const key = (temp ?? "").toLowerCase();
  if (key === "hot") return "#dc2626";
  if (key === "warm") return "#d97706";
  if (key === "cold") return "#2563eb";
  return "#e5e7eb";
}

// ---------------------------------------------------------------------------
// Secretary Status Bar
// ---------------------------------------------------------------------------

function SecretaryStatusBar({ settings }: { settings: SecretarySettings | null }) {
  if (!settings) {
    return (
      <div className="crm-card crm-section-card" style={{ background: "#f9fafb" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>Loading Secretary status…</p>
      </div>
    );
  }

  const hasPhone = Boolean(settings.business_phone_number);

  if (!hasPhone) {
    return (
      <div className="crm-card crm-section-card" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 14 }}>Secretary is not yet configured</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
              Set up your business phone number to activate call and text handling.
            </p>
          </div>
          <Link href="/app/settings/receptionist" className="crm-btn crm-btn-primary">
            Set up Secretary →
          </Link>
        </div>
      </div>
    );
  }

  const isActive = settings.receptionist_enabled && settings.voice_tier !== "none";

  return (
    <div
      className="crm-card crm-section-card"
      style={{
        background: isActive ? "#f0fdf4" : "#f9fafb",
        border: `1px solid ${isActive ? "#bbf7d0" : "var(--border)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isActive ? "#16a34a" : "#9ca3af",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#166534" : "#6b7280" }}>
              {isActive ? "Secretary is active" : "Secretary is inactive"}
            </span>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            {settings.business_phone_number}
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            {CALL_HANDLING_LABELS[settings.call_handling_mode] ?? settings.call_handling_mode}
          </span>
          {settings.after_hours_enabled && (
            <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
              After-hours on
            </span>
          )}
        </div>
        <Link href="/app/settings/receptionist" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}>
          Secretary Settings →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Activity
// ---------------------------------------------------------------------------

function ActivityTab({ items, loading, isActive }: { items: ActivityItem[]; loading: boolean; isActive: boolean }) {
  if (loading) {
    return <p style={{ color: "var(--ink-muted)", padding: "16px 0" }}>Loading activity…</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? "#16a34a" : "#9ca3af", display: "inline-block" }} />
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          {isActive ? "Secretary is active and listening" : "Secretary is offline"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="crm-card crm-section-card" style={{ textAlign: "center", padding: 32, color: "var(--ink-muted)" }}>
          No activity yet. Calls and texts will appear here when they come in.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="crm-card"
            style={{
              padding: "10px 14px",
              borderLeft: `3px solid ${tempBorderColor(item.leads?.lead_temp ?? null)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                {formatTime(item.created_at)}
              </span>
              <span style={{ fontSize: 11, background: "#f3f4f6", borderRadius: 4, padding: "1px 6px", color: "#374151" }}>
                {CHANNEL_LABELS[item.channel] ?? item.channel}
              </span>
              {item.leads ? (
                <Link
                  href={`/app/leads/${item.leads.id}`}
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", textDecoration: "none" }}
                >
                  {leadLabel(item.leads)}
                </Link>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-body)" }}>Unknown</span>
              )}
              <TempBadge temp={item.leads?.lead_temp ?? null} />
              {item.raw_message_body && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 220,
                  }}
                >
                  {item.raw_message_body}
                </span>
              )}
            </div>
            {item.leads && (
              <Link
                href={`/app/leads/${item.leads.id}`}
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 11, padding: "2px 8px" }}
              >
                View lead
              </Link>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Conversations
// ---------------------------------------------------------------------------

function ConversationsTab({ threads, loading }: { threads: ConversationThread[]; loading: boolean }) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [readSet, setReadSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("secretary_read_threads");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const openThread = async (leadId: string) => {
    setOpenLeadId(leadId);
    setReadSet((prev) => {
      const next = new Set(prev);
      next.add(leadId);
      try { localStorage.setItem("secretary_read_threads", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/receptionist/threads/${leadId}`);
      const data = await res.json() as { thread?: { interactions?: ThreadMessage[] } };
      setThreadMessages(data.thread?.interactions ?? []);
    } catch {
      setThreadMessages([]);
    } finally {
      setThreadLoading(false);
    }
  };

  const sendReply = async (leadId: string) => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await fetch(`/api/receptionist/threads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setReplyText("");
      await openThread(leadId);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  if (openLeadId) {
    const thread = threads.find((t) => t.lead_id === openLeadId);
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <button
          className="crm-btn crm-btn-secondary"
          style={{ width: "fit-content", fontSize: 12 }}
          onClick={() => setOpenLeadId(null)}
        >
          ← All conversations
        </button>

        {thread?.leads && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/app/leads/${thread.leads.id}`}
              style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-primary)", textDecoration: "none" }}
            >
              {leadLabel(thread.leads)}
            </Link>
            <TempBadge temp={thread.leads.lead_temp} />
            <Link href={`/app/leads/${thread.leads.id}`} className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }}>
              View lead →
            </Link>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 6,
            maxHeight: 420,
            overflowY: "auto",
            padding: "8px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {threadLoading ? (
            <p style={{ color: "var(--ink-muted)", padding: "8px 0", margin: 0 }}>Loading messages…</p>
          ) : threadMessages.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", padding: "8px 0", margin: 0 }}>No messages yet.</p>
          ) : (
            threadMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: msg.direction === "out" ? "row-reverse" : "row",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    maxWidth: "72%",
                    padding: "8px 12px",
                    borderRadius: msg.direction === "out" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.direction === "out" ? "var(--ink-primary)" : "#f3f4f6",
                    color: msg.direction === "out" ? "#fff" : "var(--ink-body)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {msg.raw_message_body ?? "(no content)"}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: msg.direction === "out" ? "right" : "left" }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="crm-input"
            style={{ flex: 1, fontSize: 13 }}
            placeholder="Type a message…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendReply(openLeadId);
              }
            }}
          />
          <button
            className="crm-btn crm-btn-primary"
            onClick={() => void sendReply(openLeadId)}
            disabled={sending || !replyText.trim()}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <p style={{ color: "var(--ink-muted)", padding: "16px 0" }}>Loading conversations…</p>;

  if (threads.length === 0) {
    return (
      <div className="crm-card crm-section-card" style={{ textAlign: "center", padding: 32, color: "var(--ink-muted)" }}>
        No SMS conversations yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {threads.map((thread) => {
        const isUnread = thread.direction === "in" && !readSet.has(thread.lead_id);
        return (
          <button
            key={thread.lead_id}
            onClick={() => void openThread(thread.lead_id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: isUnread ? "#eff6ff" : "var(--surface)",
              border: `1px solid ${isUnread ? "#bfdbfe" : "var(--border)"}`,
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "left",
              gap: 12,
              width: "100%",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: "var(--ink-body)" }}>
                  {leadLabel(thread.leads)}
                </span>
                <TempBadge temp={thread.leads?.lead_temp ?? null} />
                {isUnread && (
                  <span style={{ fontSize: 10, background: "#2563eb", color: "#fff", borderRadius: 10, padding: "0 6px", fontWeight: 700 }}>
                    New
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {thread.direction === "in" ? "Lead: " : "You: "}
                {thread.raw_message_body ?? "(no content)"}
              </div>
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
              {formatTime(thread.created_at)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Transcripts
// ---------------------------------------------------------------------------

function TranscriptsTab({ calls, loading }: { calls: Transcript[]; loading: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) return <p style={{ color: "var(--ink-muted)", padding: "16px 0" }}>Loading transcripts…</p>;

  const openCall = openId ? calls.find((c) => c.id === openId) : null;

  if (openCall) {
    const payload = openCall.structured_payload ?? {};
    const duration = payload.call_duration_seconds as number | undefined;
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <button
          className="crm-btn crm-btn-secondary"
          style={{ width: "fit-content", fontSize: 12 }}
          onClick={() => setOpenId(null)}
        >
          ← All transcripts
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {openCall.leads ? (
            <Link
              href={`/app/leads/${openCall.leads.id}`}
              style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-primary)", textDecoration: "none" }}
            >
              {leadLabel(openCall.leads)}
            </Link>
          ) : (
            <span style={{ fontWeight: 700, fontSize: 15 }}>Unknown</span>
          )}
          <TempBadge temp={openCall.leads?.lead_temp ?? null} />
          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
            {new Date(openCall.created_at).toLocaleString()}
          </span>
          {duration !== undefined && (
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")} min
            </span>
          )}
          {openCall.leads && (
            <Link href={`/app/leads/${openCall.leads.id}`} className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }}>
              View lead →
            </Link>
          )}
        </div>

        {openCall.summary && (
          <div className="crm-card crm-section-card" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Call Summary</div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-body)", lineHeight: 1.7 }}>{openCall.summary}</p>
          </div>
        )}

        <div className="crm-card crm-section-card">
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Full Transcript</div>
          <pre
            style={{
              margin: 0,
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
              color: "var(--ink-body)",
            }}
          >
            {openCall.raw_transcript ?? "(No transcript available)"}
          </pre>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="crm-card crm-section-card" style={{ textAlign: "center", padding: 32, color: "var(--ink-muted)" }}>
        No call transcripts yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {calls.map((call) => {
        const payload = call.structured_payload ?? {};
        const duration = payload.call_duration_seconds as number | undefined;
        const isInProgress = call.status === "queued" || call.status === "logged";

        return (
          <button
            key={call.id}
            onClick={() => setOpenId(call.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "left",
              gap: 12,
              width: "100%",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-body)" }}>
                  {leadLabel(call.leads)}
                </span>
                <TempBadge temp={call.leads?.lead_temp ?? null} />
                <span style={{ fontSize: 11, background: "#f3f4f6", borderRadius: 4, padding: "1px 6px", color: "#374151" }}>
                  {CHANNEL_LABELS[call.channel] ?? call.channel}
                </span>
                {isInProgress && (
                  <span style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                    Live
                  </span>
                )}
                {duration !== undefined && !isInProgress && (
                  <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")} min
                  </span>
                )}
              </div>
              {call.summary && (
                <div style={{ fontSize: 12, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {call.summary}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
              {formatTime(call.created_at)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Alerts
// ---------------------------------------------------------------------------

// ── Co-pilot draft card ──────────────────────────────────────────────────────

function PaReplyDraftCard({ alert, onDone }: { alert: Alert; onDone: (id: string) => void }) {
  const meta = alert.metadata ?? {};
  const draftReply = (meta.draft_reply as string | null) ?? alert.message;
  const reasoning = meta.reasoning as string | null;
  const intent = meta.intent as string | null;
  const confidence = meta.confidence as string | null;
  const suggestedAction = meta.suggested_action as { type: string; followup_date?: string } | null;
  const leadMessage = meta.lead_message as string | null;

  const isAppointmentRequest = suggestedAction?.type === "create_appointment_request";
  const [editedReply, setEditedReply] = useState(draftReply ?? "");
  const [apptDateTime, setApptDateTime] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const actionLabel = (type: string | null | undefined) => {
    if (!type) return null;
    if (type === "move_stage_dead") return "Move deal → Dead";
    if (type === "move_stage_negotiating") return "Move deal → Negotiating";
    if (type === "move_stage_offer_sent") return "Move deal → Offer Sent";
    if (type === "set_followup_date") return `Set follow-up → ${suggestedAction?.followup_date ?? "date"}`;
    if (type === "no_crm_action") return null;
    return null;
  };

  const action = actionLabel(suggestedAction?.type);

  async function handleApprove(skipReply = false) {
    setSending(true);
    try {
      // If PA suggested scheduling an appointment, create it first
      if (isAppointmentRequest && apptDateTime) {
        await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Call with ${alert.leads ? leadLabel(alert.leads) : "Lead"}`,
            scheduled_at: new Date(apptDateTime).toISOString(),
            lead_id: alert.lead_id,
            deal_id: meta.deal_id as string | null ?? null,
            appointment_type: "call",
          }),
        });
      }
      await fetch("/api/secretary/pa-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id, messageBody: editedReply, skipReply }),
      });
      setDone(true);
      onDone(alert.id);
    } catch { /* ignore */ } finally { setSending(false); }
  }

  if (done) return null;

  return (
    <div className="crm-card" style={{ padding: "14px 16px", border: "2px solid #7c3aed", borderRadius: 10, background: "#faf5ff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", borderRadius: 4, padding: "1px 7px", fontWeight: 700 }}>PA DRAFT</span>
        {intent && <span style={{ fontSize: 11, color: "var(--ink-muted)", background: "#f3f4f6", borderRadius: 4, padding: "1px 6px" }}>{intent.replace(/_/g, " ")}</span>}
        {confidence && <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{confidence} confidence</span>}
        {alert.leads && (
          <Link href={`/app/leads/${alert.leads.id}`} style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, textDecoration: "none", marginLeft: "auto" }}>
            {leadLabel(alert.leads)} →
          </Link>
        )}
      </div>

      {leadMessage && (
        <div style={{ marginBottom: 10, padding: "8px 12px", background: "#f1f5f9", borderRadius: 6, borderLeft: "3px solid #94a3b8" }}>
          <div style={{ fontSize: 10, color: "var(--ink-faint)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lead said</div>
          <div style={{ fontSize: 13, color: "var(--ink-body)" }}>{leadMessage}</div>
        </div>
      )}

      {reasoning && (
        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 10, fontStyle: "italic" }}>{reasoning}</div>
      )}

      {isAppointmentRequest && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 4, fontWeight: 600 }}>Schedule appointment</div>
          <input
            type="datetime-local"
            value={apptDateTime}
            onChange={(e) => setApptDateTime(e.target.value)}
            style={{ fontSize: 13, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, width: "100%", boxSizing: "border-box" as const }}
          />
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 4, fontWeight: 600 }}>Draft reply (edit before sending)</div>
        <textarea
          rows={3}
          value={editedReply}
          onChange={(e) => setEditedReply(e.target.value)}
          style={{ width: "100%", fontSize: 13, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 11, color: editedReply.length > 160 ? "#dc2626" : "var(--ink-faint)", textAlign: "right", marginTop: 2 }}>
          {editedReply.length}/160
        </div>
      </div>

      {action && (
        <div style={{ marginBottom: 10, fontSize: 12, color: "#7c3aed", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>CRM action:</span> {action}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, background: "#7c3aed", border: "none" }}
          disabled={sending || !editedReply.trim()} onClick={() => void handleApprove(false)}>
          {sending ? "Sending…" : "Approve & Send"}
        </button>
        {action && (
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}
            disabled={sending} onClick={() => void handleApprove(true)}>
            Just do the action (no reply)
          </button>
        )}
        <button className="crm-btn crm-btn-secondary" style={{ fontSize: 12, color: "var(--ink-muted)" }}
          disabled={sending} onClick={async () => {
            setSending(true);
            try {
              await fetch(`/api/secretary/alerts/${alert.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }) });
              setDone(true);
              onDone(alert.id);
            } finally { setSending(false); }
          }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AlertsTab({
  alerts,
  loading,
  onResolve,
  onTempSet,
}: {
  alerts: Alert[];
  loading: boolean;
  onResolve: (id: string) => void;
  onTempSet: (leadId: string, temp: string, alertId: string) => Promise<void>;
}) {
  const [settingTempFor, setSettingTempFor] = useState<string | null>(null);
  const [savingTemp, setSavingTemp] = useState(false);

  const handleSetTemp = async (leadId: string, temp: string, alertId: string) => {
    setSavingTemp(true);
    try {
      await onTempSet(leadId, temp, alertId);
      setSettingTempFor(null);
    } finally {
      setSavingTemp(false);
    }
  };

  if (loading) return <p style={{ color: "var(--ink-muted)", padding: "16px 0" }}>Loading alerts…</p>;

  const openAlerts = alerts.filter((a) => a.status === "open");
  const resolvedAlerts = alerts.filter((a) => a.status !== "open");

  if (openAlerts.length === 0 && resolvedAlerts.length === 0) {
    return (
      <div className="crm-card crm-section-card" style={{ textAlign: "center", padding: 32, color: "var(--ink-muted)" }}>
        No alerts. You're all caught up.
      </div>
    );
  }

  const renderAlert = (alert: Alert) => {
    // PA co-pilot drafts get their own rich card
    if (alert.alert_type === "pa_reply_draft" && alert.status === "open") {
      return <PaReplyDraftCard key={alert.id} alert={alert} onDone={onResolve} />;
    }

    const isUrgent = alert.severity === "urgent";
    const isUnclassified = alert.alert_type === "unclassified_lead";
    const isOpen = alert.status === "open";

    return (
      <div
        key={alert.id}
        className="crm-card"
        style={{
          padding: "10px 14px",
          background: isUrgent && isOpen ? "#fff1f2" : isOpen ? "var(--surface)" : "#f9fafb",
          border: `1px solid ${isUrgent && isOpen ? "#fecdd3" : "var(--border)"}`,
          borderLeft: isUrgent && isOpen ? "3px solid #dc2626" : undefined,
          opacity: isOpen ? 1 : 0.55,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              {isUrgent && isOpen && (
                <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                  URGENT
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-body)" }}>{alert.title}</span>
              {alert.leads && (
                <Link
                  href={`/app/leads/${alert.leads.id}`}
                  style={{ fontSize: 12, color: "var(--ink-primary)", textDecoration: "none", fontWeight: 500 }}
                >
                  {leadLabel(alert.leads)}
                </Link>
              )}
              {alert.leads && <TempBadge temp={alert.leads.lead_temp} />}
              <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{formatTime(alert.created_at)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5 }}>{alert.message}</p>

            {isUnclassified && alert.leads && isOpen && (
              settingTempFor === alert.id ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Set temperature:</span>
                  {(["Hot", "Warm", "Cold"] as const).map((t) => {
                    const s = TEMP_STYLES[t.toLowerCase()];
                    return (
                      <button
                        key={t}
                        className="crm-btn crm-btn-secondary"
                        style={{ fontSize: 11, padding: "2px 10px", background: s?.bg, color: s?.color }}
                        disabled={savingTemp}
                        onClick={() => void handleSetTemp(alert.leads!.id, t, alert.id)}
                      >
                        {t}
                      </button>
                    );
                  })}
                  <button
                    className="crm-btn crm-btn-secondary"
                    style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => setSettingTempFor(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="crm-btn crm-btn-secondary"
                  style={{ marginTop: 6, fontSize: 11, padding: "2px 8px" }}
                  onClick={() => setSettingTempFor(alert.id)}
                >
                  Set temperature
                </button>
              )
            )}
          </div>

          {isOpen ? (
            <button
              className="crm-btn crm-btn-secondary"
              style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0 }}
              onClick={() => onResolve(alert.id)}
            >
              Dismiss
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>Resolved</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {openAlerts.map(renderAlert)}
      {resolvedAlerts.length > 0 && openAlerts.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-faint)" }}>Resolved</p>
          {resolvedAlerts.map(renderAlert)}
        </div>
      )}
      {resolvedAlerts.length > 0 && openAlerts.length === 0 && resolvedAlerts.map(renderAlert)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SecretaryPage() {
  const [tab, setTab] = useState<Tab>("activity");
  const [settings, setSettings] = useState<SecretarySettings | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [settingsRes, feedRes, convRes, transRes, alertRes] = await Promise.all([
        fetch("/api/receptionist/settings"),
        fetch("/api/secretary/feed"),
        fetch("/api/secretary/conversations"),
        fetch("/api/secretary/transcripts"),
        fetch("/api/secretary/alerts"),
      ]);

      const [settingsData, feedData, convData, transData, alertData] = await Promise.all([
        settingsRes.json() as Promise<{ settings?: SecretarySettings }>,
        feedRes.json() as Promise<{ items?: ActivityItem[] }>,
        convRes.json() as Promise<{ threads?: ConversationThread[] }>,
        transRes.json() as Promise<{ calls?: Transcript[] }>,
        alertRes.json() as Promise<{ alerts?: Alert[]; open_count?: number }>,
      ]);

      if (settingsData.settings) setSettings(settingsData.settings);
      setActivity(feedData.items ?? []);
      setConversations(convData.threads ?? []);
      setTranscripts(transData.calls ?? []);
      setAlerts(alertData.alerts ?? []);
      setAlertCount(alertData.open_count ?? 0);
      setLastRefresh(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const timer = setInterval(() => void fetchAll(), 30_000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/secretary/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: "resolved" } : a)));
      setAlertCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const setLeadTemp = async (leadId: string, temp: string, _alertId: string) => {
    await fetch(`/api/leads/simple/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_temp: temp }),
    });
    // Update local alert lead_temp
    setAlerts((prev) =>
      prev.map((a) =>
        a.leads?.id === leadId
          ? { ...a, leads: { ...a.leads!, lead_temp: temp.toLowerCase() } }
          : a
      )
    );
  };

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "activity",      label: "Activity" },
    { id: "conversations", label: "Conversations" },
    { id: "transcripts",   label: "Transcripts" },
    { id: "alerts",        label: "Alerts", count: alertCount },
  ];

  const isActive = Boolean(settings?.receptionist_enabled && settings.voice_tier !== "none");

  return (
    <div className="crm-page-shell">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Secretary</h1>
          <p className="crm-page-subtitle">
            AI call handling, SMS conversations, transcripts, and alerts in one place.
          </p>
        </div>
        {lastRefresh && (
          <span style={{ fontSize: 11, color: "var(--ink-faint)", alignSelf: "flex-end" }}>
            Updated {formatTime(lastRefresh.toISOString())}
          </span>
        )}
      </div>

      {/* Status Bar */}
      <SecretaryStatusBar settings={settings} />

      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 0 }}>
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === id ? 700 : 400,
              color: tab === id ? "var(--ink-primary)" : "var(--ink-muted)",
              background: "transparent",
              border: "none",
              borderBottom: tab === id ? "2px solid var(--ink-primary)" : "2px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: -1,
            }}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "#dc2626",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "0 5px",
                  minWidth: 16,
                  textAlign: "center",
                  lineHeight: "16px",
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ paddingTop: 16 }}>
        {tab === "activity" && (
          <ActivityTab items={activity} loading={loading} isActive={isActive} />
        )}
        {tab === "conversations" && (
          <ConversationsTab threads={conversations} loading={loading} />
        )}
        {tab === "transcripts" && (
          <TranscriptsTab calls={transcripts} loading={loading} />
        )}
        {tab === "alerts" && (
          <AlertsTab
            alerts={alerts}
            loading={loading}
            onResolve={(id) => void resolveAlert(id)}
            onTempSet={setLeadTemp}
          />
        )}
      </div>
    </div>
  );
}
