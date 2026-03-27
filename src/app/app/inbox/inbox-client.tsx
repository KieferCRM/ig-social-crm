"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type InboxMessage = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  processed: boolean;
  ai_summary: string | null;
  ai_action: string | null;
  linked_deal_id: string | null;
  linked_lead_id: string | null;
  has_attachments: boolean;
  attachment_names: string[] | null;
  read: boolean;
};

const ACTION_META: Record<string, { label: string; bg: string; color: string }> = {
  created_lead:    { label: "Lead created",     bg: "#dcfce7", color: "#15803d" },
  updated_deal:    { label: "Deal updated",     bg: "#dbeafe", color: "#1d4ed8" },
  logged_note:     { label: "Note logged",      bg: "#f3e8ff", color: "#7c3aed" },
  stored_document: { label: "Document stored",  bg: "#fef9c3", color: "#a16207" },
  none:            { label: "No action",        bg: "#f3f4f6", color: "#6b7280" },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxClient({
  agentId,
  inboxEmail,
}: {
  agentId: string;
  inboxEmail: string | null;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "attachments">("all");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");

  // Initial load + Realtime subscription
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("inbox_messages")
        .select("*")
        .eq("agent_id", agentId)
        .order("received_at", { ascending: false })
        .limit(100);
      setMessages((data ?? []) as InboxMessage[]);
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel(`inbox-${agentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbox_messages", filter: `agent_id=eq.${agentId}` },
        (payload) => {
          setMessages((prev) => [payload.new as InboxMessage, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inbox_messages", filter: `agent_id=eq.${agentId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => m.id === (payload.new as InboxMessage).id ? (payload.new as InboxMessage) : m)
          );
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [agentId, supabase]);

  async function markRead(id: string) {
    await supabase.from("inbox_messages").update({ read: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
  }

  async function markAllRead() {
    await supabase
      .from("inbox_messages")
      .update({ read: true })
      .eq("agent_id", agentId)
      .eq("read", false);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  }

  async function sendReply(messageId: string) {
    if (!replyText.trim()) return;
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/inbox/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setReplyError(data.error ?? "Failed to send reply.");
      } else {
        setReplyingToId(null);
        setReplyText("");
      }
    } catch {
      setReplyError("Something went wrong. Please try again.");
    } finally {
      setReplySending(false);
    }
  }

  async function deleteMessage(id: string) {
    await supabase.from("inbox_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function toggleExpand(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.read) void markRead(id);
    setExpandedId((prev) => prev === id ? null : id);
  }

  const filtered = messages.filter((m) => {
    if (filter === "unread") return !m.read;
    if (filter === "attachments") return m.has_attachments;
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <main className="crm-page crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 className="crm-section-title" style={{ marginBottom: 4 }}>
              Inbox
              {unreadCount > 0 && (
                <span style={{ marginLeft: 10, fontSize: 13, background: "var(--brand)", color: "#fff", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                  {unreadCount} new
                </span>
              )}
            </h2>
            {inboxEmail ? (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Your inbox address:{" "}
                <span
                  style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--ink)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 6, cursor: "pointer" }}
                  onClick={() => void navigator.clipboard.writeText(inboxEmail)}
                  title="Click to copy"
                >
                  {inboxEmail}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 8 }}>click to copy</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Set up a vanity slug in{" "}
                <a href="/app/settings/profile" style={{ color: "var(--brand)" }}>Settings → Profile</a>
                {" "}to get your inbox address.
              </div>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {(["all", "unread", "attachments"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 12,
                padding: "4px 12px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: filter === f ? "var(--ink)" : "transparent",
                color: filter === f ? "#fff" : "var(--ink-muted)",
                cursor: "pointer",
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f === "all" ? "All" : f === "unread" ? "Unread" : "Has Attachments"}
            </button>
          ))}
        </div>
      </section>

      {/* Message list */}
      <section className="crm-card crm-section-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 24, color: "var(--ink-muted)", fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>
              {filter === "all"
                ? inboxEmail
                  ? `No messages yet. Share ${inboxEmail} with clients, title companies, or set it as your Plaud transcript destination.`
                  : "Set up your vanity slug to activate your drop address."
                : filter === "unread"
                  ? "No unread messages."
                  : "No messages with attachments."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((msg, i) => {
              const isExpanded = expandedId === msg.id;
              const actionMeta = ACTION_META[msg.ai_action ?? "none"] ?? ACTION_META.none;
              const isLast = i === filtered.length - 1;

              return (
                <div
                  key={msg.id}
                  style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
                >
                  {/* Row */}
                  <div
                    onClick={() => toggleExpand(msg.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 20px",
                      cursor: "pointer",
                      background: msg.read ? "transparent" : "var(--brand-faint, #f0fdf4)",
                      transition: "background 0.1s",
                    }}
                  >
                    {/* Unread dot */}
                    <div style={{ paddingTop: 5, flexShrink: 0 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: msg.read ? "transparent" : "var(--brand)",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontWeight: msg.read ? 500 : 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {msg.from_name ?? msg.from_email ?? "Unknown sender"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>
                          {formatRelative(msg.received_at)}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {msg.subject ?? "(no subject)"}
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {msg.ai_summary && (
                          <span style={{ fontSize: 12, color: "var(--ink-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {msg.ai_summary}
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: actionMeta.bg, color: actionMeta.color, flexShrink: 0 }}>
                          {actionMeta.label}
                        </span>
                        {msg.has_attachments && (
                          <span style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>
                            📎 {msg.attachment_names?.length ?? 1}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div style={{ padding: "0 20px 16px 40px", borderTop: "1px solid var(--border)" }}>
                      {msg.from_email && (
                        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 12, marginBottom: 8 }}>
                          From: {msg.from_name ? `${msg.from_name} <${msg.from_email}>` : msg.from_email}
                        </div>
                      )}

                      {msg.attachment_names && msg.attachment_names.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                          {msg.attachment_names.map((name) => (
                            <span key={name} style={{ fontSize: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", color: "var(--ink-muted)" }}>
                              📎 {name}
                            </span>
                          ))}
                          <span style={{ fontSize: 11, color: "var(--ink-faint)", alignSelf: "center" }}>
                            Stored to Documents
                          </span>
                        </div>
                      )}

                      {msg.body_text && (
                        <div style={{
                          fontSize: 13,
                          color: "var(--ink-body)",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                          maxHeight: 300,
                          overflowY: "auto",
                          background: "var(--surface-2)",
                          borderRadius: 8,
                          padding: "12px 14px",
                        }}>
                          {msg.body_text.slice(0, 2000)}
                          {msg.body_text.length > 2000 && (
                            <span style={{ color: "var(--ink-faint)" }}>{"\n\n"}[truncated]</span>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                        {msg.linked_deal_id && (
                          <a
                            href={`/app/pipeline?deal=${msg.linked_deal_id}`}
                            style={{ fontSize: 12, color: "var(--brand)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View deal →
                          </a>
                        )}
                        {msg.linked_lead_id && (
                          <a
                            href={`/app/contacts?contact=${msg.linked_lead_id}`}
                            style={{ fontSize: 12, color: "var(--brand)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View contact →
                          </a>
                        )}
                        {msg.from_email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingToId((prev) => prev === msg.id ? null : msg.id);
                              setReplyText("");
                              setReplyError("");
                            }}
                            style={{ fontSize: 12, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontWeight: 600 }}
                          >
                            {replyingToId === msg.id ? "Cancel" : "↩ Reply"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this message?")) void deleteMessage(msg.id);
                          }}
                          style={{ marginLeft: "auto", fontSize: 12, color: "var(--danger, #dc2626)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* Reply composer */}
                      {replyingToId === msg.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}
                        >
                          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                            To: <strong>{msg.from_name ?? msg.from_email}</strong>
                          </div>
                          <textarea
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write your reply..."
                            rows={5}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              fontSize: 13,
                              padding: "10px 12px",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "var(--surface-1, #fff)",
                              color: "var(--ink)",
                              resize: "vertical",
                              fontFamily: "inherit",
                              lineHeight: 1.5,
                            }}
                          />
                          {replyError && (
                            <div style={{ fontSize: 12, color: "var(--danger, #dc2626)" }}>{replyError}</div>
                          )}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button
                              onClick={() => void sendReply(msg.id)}
                              disabled={replySending || !replyText.trim()}
                              className="crm-btn crm-btn-primary"
                              style={{ fontSize: 13 }}
                            >
                              {replySending ? "Sending..." : "Send reply"}
                            </button>
                            <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                              Sent as: {agentId ? "Your Name via LockboxHQ" : ""} &lt;hello@lockboxhq.com&gt;
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
