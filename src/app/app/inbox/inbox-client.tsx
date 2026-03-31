"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type WorkspaceDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  deal_id: string;
  lead_id: string;
  tags: string[];
  status: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  signed_url?: string | null;
};

type DealOption = { id: string; label: string };
type LeadOption = { id: string; label: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; bg: string; color: string }> = {
  created_lead:    { label: "Lead created",    bg: "#dcfce7", color: "#15803d" },
  updated_deal:    { label: "Deal updated",    bg: "#dbeafe", color: "#1d4ed8" },
  logged_note:     { label: "Note logged",     bg: "#f3e8ff", color: "#7c3aed" },
  stored_document: { label: "Document stored", bg: "#fef9c3", color: "#a16207" },
  none:            { label: "No action",       bg: "#f3f4f6", color: "#6b7280" },
};

const DOC_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:  { label: "Draft",  bg: "#f3f4f6", color: "#6b7280" },
  sent:   { label: "Sent",   bg: "#dbeafe", color: "#1d4ed8" },
  signed: { label: "Signed", bg: "#dcfce7", color: "#15803d" },
  final:  { label: "Final",  bg: "#fef9c3", color: "#a16207" },
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

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InboxClient({
  agentId,
  inboxEmail,
  isOffMarketAccount,
  deals,
  leads,
}: {
  agentId: string;
  inboxEmail: string | null;
  isOffMarketAccount: boolean;
  deals: DealOption[];
  leads: LeadOption[];
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [tab, setTab] = useState<"emails" | "documents">("emails");

  // ── Email state ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState<"all" | "unread" | "attachments">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");

  // ── Document state ──────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [docMessage, setDocMessage] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDealId, setDocDealId] = useState("");
  const [docLeadId, setDocLeadId] = useState("");
  const [docFileType, setDocFileType] = useState("agreement");
  const [docStatus, setDocStatus] = useState("draft");
  const [docTags, setDocTags] = useState("");
  const [filterDealId, setFilterDealId] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [docSearch, setDocSearch] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocStatus, setEditDocStatus] = useState("");
  const [editDocFileType, setEditDocFileType] = useState("");
  const [editDocTags, setEditDocTags] = useState("");
  const [editDocSaving, setEditDocSaving] = useState(false);

  // ── Email load + realtime ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setEmailLoading(true);
      const { data } = await supabase
        .from("inbox_messages")
        .select("*")
        .eq("agent_id", agentId)
        .order("received_at", { ascending: false })
        .limit(100);
      setMessages((data ?? []) as InboxMessage[]);
      setEmailLoading(false);
    }
    void load();

    const channel = supabase
      .channel(`inbox-${agentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inbox_messages", filter: `agent_id=eq.${agentId}` }, (payload) => {
        setMessages((prev) => [payload.new as InboxMessage, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inbox_messages", filter: `agent_id=eq.${agentId}` }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === (payload.new as InboxMessage).id ? (payload.new as InboxMessage) : m));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [agentId, supabase]);

  // ── Document load ───────────────────────────────────────────────────────────
  async function loadDocuments() {
    setDocLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const data = await res.json() as { documents?: WorkspaceDocument[]; error?: string };
      setDocuments(data.documents ?? []);
    } catch {
      setDocMessage("Could not load documents.");
    } finally {
      setDocLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "documents" && documents.length === 0 && !docLoading) {
      void loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Email actions ───────────────────────────────────────────────────────────
  async function markRead(id: string) {
    await supabase.from("inbox_messages").update({ read: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
  }

  async function markAllRead() {
    await supabase.from("inbox_messages").update({ read: true }).eq("agent_id", agentId).eq("read", false);
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

  // ── Document actions ────────────────────────────────────────────────────────
  async function uploadDocument() {
    if (!docFile) { setDocMessage("Choose a file first."); return; }
    setDocSaving(true);
    setDocMessage("");
    try {
      const formData = new FormData();
      formData.set("file", docFile);
      formData.set("deal_id", docDealId);
      formData.set("lead_id", docLeadId);
      formData.set("file_type", docFileType);
      formData.set("status", docStatus);
      formData.set("tags", docTags);
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setDocMessage(data.error ?? "Could not upload."); return; }
      setDocFile(null);
      setDocDealId("");
      setDocLeadId("");
      setDocFileType("agreement");
      setDocStatus("draft");
      setDocTags("");
      setDocMessage("Document uploaded.");
      await loadDocuments();
    } catch {
      setDocMessage("Could not upload document.");
    } finally {
      setDocSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    const doc = documents.find((d) => d.id === id);
    if (!window.confirm(`Remove "${doc?.file_name ?? "this document"}"?`)) return;
    try {
      const res = await fetch("/api/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setDocMessage(data.error ?? "Could not remove."); return; }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setDocMessage("Could not remove document.");
    }
  }

  async function saveDocEdit(id: string) {
    setEditDocSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: editDocStatus, file_type: editDocFileType, tags: editDocTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setDocMessage(data.error ?? "Could not save."); return; }
      setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, status: editDocStatus, file_type: editDocFileType, tags: editDocTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) } : d));
      setEditingDocId(null);
    } catch {
      setDocMessage("Could not save.");
    } finally {
      setEditDocSaving(false);
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const filteredMessages = messages.filter((m) => {
    if (emailFilter === "unread") return !m.read;
    if (emailFilter === "attachments") return m.has_attachments;
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const dealOk = !filterDealId || doc.deal_id === filterDealId;
        const statusOk = filterStatus === "all" || doc.status === filterStatus;
        const searchOk = !docSearch || doc.file_name.toLowerCase().includes(docSearch.toLowerCase());
        return dealOk && statusOk && searchOk;
      })
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }, [documents, filterDealId, filterStatus, docSearch]);

  // Deal link target — traditional → /app/deals, off-market → /app/pipeline
  const dealHref = (dealId: string) =>
    isOffMarketAccount ? `/app/pipeline?deal=${dealId}` : `/app/deals?deal=${dealId}`;

  // ── Render ────────────────────────────────────────────────────────────────--

  return (
    <main className="crm-page crm-stack-12">

      {/* Header */}
      <section className="crm-card crm-section-card crm-stack-8">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="crm-page-kicker">Inbox</p>
            <h1 className="crm-page-title" style={{ marginBottom: 4 }}>
              {tab === "emails" ? (
                <>Emails{unreadCount > 0 && <span style={{ marginLeft: 10, fontSize: 13, background: "var(--brand)", color: "#fff", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>{unreadCount} new</span>}</>
              ) : "Documents"}
            </h1>
            {tab === "emails" ? (
              inboxEmail ? (
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Drop address:{" "}
                  <span
                    style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--ink)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 6, cursor: "pointer" }}
                    onClick={() => void navigator.clipboard.writeText(inboxEmail)}
                    title="Click to copy"
                  >
                    {inboxEmail}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 8 }}>click to copy · share with your TC, title company, and lender</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Set a vanity slug in{" "}
                  <a href="/app/settings/profile" style={{ color: "var(--brand)" }}>Settings → Profile</a>
                  {" "}to activate your drop address. Then forward signed docs, inspection reports, and transaction emails here.
                </div>
              )
            ) : (
              <p className="crm-page-subtitle" style={{ marginTop: 2 }}>
                {isOffMarketAccount
                  ? "Contracts, seller notes, photos, and deal files tied to the right opportunity."
                  : "Agreements, contracts, disclosures, and transaction files tied to the right deal."}
              </p>
            )}
          </div>

          {tab === "emails" && unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginTop: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
          {(["emails", "documents"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 13,
                fontWeight: tab === t ? 700 : 400,
                padding: "8px 16px",
                borderRadius: "8px 8px 0 0",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
                background: "transparent",
                color: tab === t ? "var(--ink)" : "var(--ink-muted)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "emails" ? "Emails" : "Documents"}
              {t === "emails" && unreadCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, background: "var(--brand)", color: "#fff", borderRadius: 10, padding: "1px 6px" }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── EMAILS TAB ──────────────────────────────────────────────────────── */}
      {tab === "emails" && (
        <>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "unread", "attachments"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setEmailFilter(f)}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  background: emailFilter === f ? "var(--ink)" : "transparent",
                  color: emailFilter === f ? "#fff" : "var(--ink-muted)",
                  cursor: "pointer",
                  fontWeight: emailFilter === f ? 600 : 400,
                }}
              >
                {f === "all" ? "All" : f === "unread" ? "Unread" : "Has Attachments"}
              </button>
            ))}
          </div>

          <section className="crm-card crm-section-card" style={{ padding: 0, overflow: "hidden" }}>
            {emailLoading ? (
              <div style={{ padding: 24, color: "var(--ink-muted)", fontSize: 13 }}>Loading...</div>
            ) : filteredMessages.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-body)", marginBottom: 8 }}>
                  {emailFilter !== "all" ? `No ${emailFilter} messages.` : "No emails yet."}
                </div>
                {emailFilter === "all" && (
                  <div style={{ fontSize: 13, color: "var(--ink-muted)", maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
                    {inboxEmail
                      ? <>Share <strong>{inboxEmail}</strong> with your TC, title company, lender, and clients. Signed contracts, inspection reports, and closing docs will appear here automatically.</>
                      : "Set a vanity slug in Settings → Profile to activate your drop address."}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredMessages.map((msg, i) => {
                  const isExpanded = expandedId === msg.id;
                  const actionMeta = ACTION_META[msg.ai_action ?? "none"] ?? ACTION_META.none!;
                  const isLast = i === filteredMessages.length - 1;
                  const dealLabel = msg.linked_deal_id ? deals.find((d) => d.id === msg.linked_deal_id)?.label : null;
                  const leadLabel = msg.linked_lead_id ? leads.find((l) => l.id === msg.linked_lead_id)?.label : null;

                  return (
                    <div key={msg.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
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
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: msg.read ? "transparent" : "var(--brand)" }} />
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
                            {/* Deal context badge — key addition for traditional agents */}
                            {dealLabel && (
                              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px", background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border)", flexShrink: 0 }}>
                                {dealLabel}
                              </span>
                            )}
                            {!dealLabel && leadLabel && (
                              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px", background: "var(--surface-2)", color: "var(--ink-muted)", border: "1px solid var(--border)", flexShrink: 0 }}>
                                {leadLabel}
                              </span>
                            )}
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
                              <span style={{ fontSize: 11, color: "var(--ink-faint)", alignSelf: "center" }}>Stored to Documents</span>
                            </div>
                          )}

                          {msg.body_text && (
                            <div style={{ fontSize: 13, color: "var(--ink-body)", whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 300, overflowY: "auto", background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px" }}>
                              {msg.body_text.slice(0, 2000)}
                              {msg.body_text.length > 2000 && <span style={{ color: "var(--ink-faint)" }}>{"\n\n"}[truncated]</span>}
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                            {msg.linked_deal_id && (
                              <a href={dealHref(msg.linked_deal_id)} style={{ fontSize: 12, color: "var(--brand)" }} onClick={(e) => e.stopPropagation()}>
                                View deal →
                              </a>
                            )}
                            {msg.linked_lead_id && (
                              <a href={`/app/contacts?contact=${msg.linked_lead_id}`} style={{ fontSize: 12, color: "var(--brand)" }} onClick={(e) => e.stopPropagation()}>
                                View contact →
                              </a>
                            )}
                            {msg.from_email && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setReplyingToId((prev) => prev === msg.id ? null : msg.id); setReplyText(""); setReplyError(""); }}
                                style={{ fontSize: 12, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontWeight: 600 }}
                              >
                                {replyingToId === msg.id ? "Cancel" : "↩ Reply"}
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this message?")) void deleteMessage(msg.id); }}
                              style={{ marginLeft: "auto", fontSize: 12, color: "var(--danger, #dc2626)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                            >
                              Delete
                            </button>
                          </div>

                          {replyingToId === msg.id && (
                            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>To: <strong>{msg.from_name ?? msg.from_email}</strong></div>
                              <textarea
                                autoFocus
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write your reply..."
                                rows={5}
                                style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-1, #fff)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                              />
                              {replyError && <div style={{ fontSize: 12, color: "var(--danger, #dc2626)" }}>{replyError}</div>}
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <button onClick={() => void sendReply(msg.id)} disabled={replySending || !replyText.trim()} className="crm-btn crm-btn-primary" style={{ fontSize: 13 }}>
                                  {replySending ? "Sending..." : "Send reply"}
                                </button>
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
        </>
      )}

      {/* ── DOCUMENTS TAB ───────────────────────────────────────────────────── */}
      {tab === "documents" && (
        <>
          {/* Upload */}
          <section className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <h2 className="crm-section-title">Upload document</h2>
            </div>

            <div className="crm-grid-cards-2">
              <label className="crm-filter-field">
                <span>Related deal</span>
                <select value={docDealId} onChange={(e) => setDocDealId(e.target.value)}>
                  <option value="">No deal selected</option>
                  {deals.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <label className="crm-filter-field">
                <span>Related contact</span>
                <select value={docLeadId} onChange={(e) => setDocLeadId(e.target.value)}>
                  <option value="">No contact selected</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </label>
              <label className="crm-filter-field">
                <span>Document type</span>
                <select value={docFileType} onChange={(e) => setDocFileType(e.target.value)}>
                  <option value="agreement">Agreement</option>
                  <option value="contract">Contract</option>
                  <option value="disclosure">Disclosure</option>
                  <option value="inspection">Inspection report</option>
                  <option value="checklist">Checklist</option>
                  <option value="media">Photo / Media</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="crm-filter-field">
                <span>Status</span>
                <select value={docStatus} onChange={(e) => setDocStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="signed">Signed</option>
                  <option value="final">Final</option>
                </select>
              </label>
            </div>

            <div className="crm-grid-cards-2">
              <label className="crm-filter-field">
                <span>Tags</span>
                <input value={docTags} onChange={(e) => setDocTags(e.target.value)} placeholder="contract, seller, pending" />
              </label>
              <label className="crm-filter-field">
                <span>File</span>
                <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
              {docMessage && (
                <span style={{ fontSize: 13, color: docMessage.includes("Could not") || docMessage.includes("Choose") ? "var(--danger)" : "var(--success, #15803d)" }}>
                  {docMessage}
                </span>
              )}
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void uploadDocument()} disabled={docSaving}>
                {docSaving ? "Uploading..." : "Upload document"}
              </button>
            </div>
          </section>

          {/* Filters + list */}
          <section className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <h2 className="crm-section-title">All documents</h2>
            </div>

            <div className="crm-grid-cards-3" style={{ gap: 10 }}>
              <label className="crm-filter-field">
                <span>Search</span>
                <input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="Search by filename..." />
              </label>
              <label className="crm-filter-field">
                <span>Deal</span>
                <select value={filterDealId} onChange={(e) => setFilterDealId(e.target.value)}>
                  <option value="">All deals</option>
                  {deals.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <label className="crm-filter-field">
                <span>Status</span>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="signed">Signed</option>
                  <option value="final">Final</option>
                </select>
              </label>
            </div>

            {docLoading ? <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading documents...</div> : null}

            {!docLoading && filteredDocuments.length === 0 && (
              <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
                {documents.length === 0
                  ? "No documents yet. Upload agreements, contracts, and deal files above, or forward emails with attachments to your drop address."
                  : "No documents match these filters."}
              </div>
            )}

            <div className="crm-stack-8">
              {filteredDocuments.map((doc) => {
                const statusMeta = DOC_STATUS_META[doc.status] ?? DOC_STATUS_META.draft!;
                const dealLabel = deals.find((d) => d.id === doc.deal_id)?.label;
                const leadLabel = leads.find((l) => l.id === doc.lead_id)?.label;

                return (
                  <article key={doc.id} className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div className="crm-stack-4">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700 }}>📎 {doc.file_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: statusMeta.bg, color: statusMeta.color }}>
                            {statusMeta.label.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                          {doc.file_type} · {formatBytes(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                      <div className="crm-inline-actions" style={{ gap: 8 }}>
                        {doc.signed_url && <a href={doc.signed_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">Open</a>}
                        {editingDocId !== doc.id && <button type="button" className="crm-btn crm-btn-secondary" onClick={() => { setEditingDocId(doc.id); setEditDocStatus(doc.status); setEditDocFileType(doc.file_type); setEditDocTags(doc.tags.join(", ")); }}>Edit</button>}
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void deleteDocument(doc.id)}>Remove</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ink-muted)", flexWrap: "wrap" }}>
                      {dealLabel && <span>Deal: <strong style={{ color: "var(--ink-body)" }}>{dealLabel}</strong></span>}
                      {leadLabel && <span>Contact: <strong style={{ color: "var(--ink-body)" }}>{leadLabel}</strong></span>}
                      {doc.tags.length > 0 && <span>Tags: <strong style={{ color: "var(--ink-body)" }}>{doc.tags.join(", ")}</strong></span>}
                    </div>

                    {editingDocId === doc.id && (
                      <div className="crm-stack-8" style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                        <div className="crm-grid-cards-3" style={{ gap: 10 }}>
                          <label className="crm-filter-field">
                            <span>Status</span>
                            <select value={editDocStatus} onChange={(e) => setEditDocStatus(e.target.value)}>
                              <option value="draft">Draft</option>
                              <option value="sent">Sent</option>
                              <option value="signed">Signed</option>
                              <option value="final">Final</option>
                            </select>
                          </label>
                          <label className="crm-filter-field">
                            <span>Type</span>
                            <select value={editDocFileType} onChange={(e) => setEditDocFileType(e.target.value)}>
                              <option value="agreement">Agreement</option>
                              <option value="contract">Contract</option>
                              <option value="disclosure">Disclosure</option>
                              <option value="inspection">Inspection report</option>
                              <option value="checklist">Checklist</option>
                              <option value="media">Photo / Media</option>
                              <option value="other">Other</option>
                            </select>
                          </label>
                          <label className="crm-filter-field">
                            <span>Tags</span>
                            <input value={editDocTags} onChange={(e) => setEditDocTags(e.target.value)} placeholder="contract, seller" />
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveDocEdit(doc.id)} disabled={editDocSaving}>
                            {editDocSaving ? "Saving..." : "Save"}
                          </button>
                          <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setEditingDocId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
