"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Conversation = {
  id: string;
  platform: "ig" | "fb";
  meta_participant_id: string;
  last_message_preview: string | null;
  last_message_ts: string | null;
  ai_summary: string | null;
};

type Message = {
  id: string;
  direction: "in" | "out";
  text: string | null;
  ts: string | null;
  created_at: string;
};

type StatusTone = "ok" | "warn" | "danger";
type StatusState = {
  tone: StatusTone;
  text: string;
} | null;

function formatTs(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function DashboardSocialHub() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const handle = conversation.meta_participant_id?.toLowerCase() || "";
      const preview = conversation.last_message_preview?.toLowerCase() || "";
      const summary = conversation.ai_summary?.toLowerCase() || "";
      return handle.includes(q) || preview.includes(q) || summary.includes(q);
    });
  }, [conversations, search]);

  const statusClass =
    status?.tone === "danger"
      ? "crm-chip crm-chip-danger"
      : status?.tone === "warn"
        ? "crm-chip crm-chip-warn"
        : "crm-chip crm-chip-ok";

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setStatus(null);
    try {
      const response = await fetch("/api/conversations");
      const payload = (await response.json()) as { conversations?: Conversation[]; error?: string };
      if (!response.ok) {
        setStatus({ tone: "danger", text: payload.error || "Could not load conversations." });
        setConversations([]);
        return;
      }

      const rows = payload.conversations || [];
      setConversations(rows);
      setSelectedId((prev) => {
        if (rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id || "";
      });
    } catch {
      setStatus({ tone: "danger", text: "Could not load conversations." });
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      setLoadingMessages(true);
      setStatus(null);
      try {
        const response = await fetch(`/api/conversations/${selectedId}/messages`);
        const payload = (await response.json()) as { messages?: Message[]; error?: string };
        if (!response.ok) {
          setStatus({ tone: "danger", text: payload.error || "Could not load conversation messages." });
          return;
        }
        setMessages(payload.messages || []);
      } catch {
        setStatus({ tone: "danger", text: "Could not load conversation messages." });
      } finally {
        setLoadingMessages(false);
      }
    }

    void loadMessages();
  }, [selectedId]);

  useEffect(() => {
    if (!threadRef.current || loadingMessages) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, selectedId, loadingMessages]);

  async function queueReply() {
    if (!selectedId) return;
    const text = replyText.trim();
    if (!text) {
      setStatus({ tone: "danger", text: "Reply text is required." });
      return;
    }

    setReplySending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json()) as { message?: Message; warning?: string; error?: string };
      if (!response.ok || !payload.message) {
        setStatus({ tone: "danger", text: payload.error || "Could not queue reply." });
        return;
      }

      const sentMessage = payload.message;
      setMessages((prev) => [...prev, sentMessage]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                last_message_preview: sentMessage.text || c.last_message_preview,
                last_message_ts: sentMessage.ts || c.last_message_ts,
              }
            : c
        )
      );
      setReplyText("");
      if (payload.warning) {
        setStatus({ tone: "warn", text: payload.warning });
      } else {
        setStatus({ tone: "ok", text: "Reply queued." });
      }
    } catch {
      setStatus({ tone: "danger", text: "Could not queue reply." });
    } finally {
      setReplySending(false);
    }
  }

  return (
    <section className="crm-card" style={{ marginTop: 14, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Social Inbox</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>
            Monitor and respond to social conversations without leaving dashboard.
          </div>
        </div>
        <button className="crm-btn crm-btn-secondary" onClick={() => void loadConversations()} disabled={loadingConversations}>
          {loadingConversations ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by handle or message..."
        />
      </div>

      <div className="crm-social-grid" style={{ marginTop: 10 }}>
        <div className="crm-card-muted crm-social-list" style={{ padding: 8, overflow: "auto", display: "grid", gap: 8 }}>
          {loadingConversations ? (
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>No social conversations yet.</div>
          ) : (
            filteredConversations.slice(0, 60).map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className="crm-card"
                style={{
                  padding: 10,
                  textAlign: "left",
                  color: "var(--foreground)",
                  WebkitTextFillColor: "var(--foreground)",
                  appearance: "none",
                  WebkitAppearance: "none",
                  border: selectedId === conversation.id ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: selectedId === conversation.id ? "rgba(255, 187, 77, 0.16)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ color: "#eef6ff", WebkitTextFillColor: "#eef6ff" }}>
                    @{conversation.meta_participant_id || "unknown"}
                  </strong>
                  <span className="crm-chip">{conversation.platform.toUpperCase()}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#b9ccee", WebkitTextFillColor: "#b9ccee" }}>
                  {conversation.last_message_preview || "No message preview."}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#9eb6df", WebkitTextFillColor: "#9eb6df" }}>
                  Updated {formatTs(conversation.last_message_ts)}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="crm-card-muted" style={{ padding: 10, minHeight: 340 }}>
          {!selectedConversation ? (
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Select a conversation to view messages.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>@{selectedConversation.meta_participant_id}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)" }}>
                    {selectedConversation.ai_summary || "No summary yet."}
                  </div>
                </div>
                <span className="crm-chip">{selectedConversation.platform.toUpperCase()}</span>
              </div>

              <div ref={threadRef} className="crm-social-thread" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 8, overflow: "auto", display: "grid", gap: 6 }}>
                {loadingMessages ? (
                  <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>No messages in this conversation.</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: m.direction === "in" ? "flex-start" : "flex-end",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "88%",
                          padding: 8,
                          borderRadius: 10,
                          background: m.direction === "in" ? "var(--surface)" : "rgba(250,197,74,0.14)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                          {m.direction === "in" ? "Inbound" : "Outbound"} • {formatTs(m.ts || m.created_at)}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 13 }}>{m.text || "(no text)"}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <textarea
                rows={3}
                placeholder="Write reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void queueReply();
                  }
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  Tip: press Cmd/Ctrl + Enter to queue reply.
                </div>
                <button className="crm-btn crm-btn-primary" onClick={() => void queueReply()} disabled={replySending || !selectedId}>
                  {replySending ? "Queueing..." : "Queue Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {status ? (
        <div style={{ marginTop: 10 }} className={statusClass}>
          {status.text}
        </div>
      ) : null}
    </section>
  );
}
