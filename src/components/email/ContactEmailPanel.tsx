"use client";

import { useEffect, useState } from "react";

type Email = {
  id: string;
  direction: "inbound" | "outbound";
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string | null;
};

type ComposeState = {
  subject: string;
  body: string;
};

export default function ContactEmailPanel({
  contactId,
  contactEmail,
}: {
  contactId: string;
  contactEmail: string | null;
}) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<ComposeState>({ subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/email/contact/${contactId}`)
      .then(r => r.json())
      .then((d: { emails?: Email[] }) => { setEmails(d.emails ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [contactId]);

  async function handleSend() {
    if (!contactEmail) return;
    setSending(true);
    setSendMsg("");
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: contactEmail,
        subject: form.subject,
        text: form.body,
        contact_id: contactId,
      }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    setSending(false);
    if (!res.ok || !data.ok) {
      setSendMsg(data.error ?? "Could not send.");
    } else {
      setSendMsg("Sent!");
      setComposing(false);
      setForm({ subject: "", body: "" });
      // Append optimistically
      setEmails(prev => [{
        id: crypto.randomUUID(),
        direction: "outbound",
        from_address: null,
        to_address: contactEmail,
        subject: form.subject,
        body_text: form.body,
        received_at: new Date().toISOString(),
      }, ...prev]);
      window.setTimeout(() => setSendMsg(""), 3000);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Compose button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Emails {emails.length > 0 && <span style={{ fontWeight: 400 }}>({emails.length})</span>}
        </div>
        {contactEmail && !composing && (
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => setComposing(true)}
          >
            + Compose
          </button>
        )}
        {!contactEmail && (
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>No email address on file</span>
        )}
      </div>

      {/* Compose form */}
      {composing && (
        <div className="crm-stack-8" style={{ background: "var(--surface-2, #f8fafc)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>To: <strong>{contactEmail}</strong></div>
          <input
            className="crm-input"
            placeholder="Subject"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          />
          <textarea
            className="crm-input"
            placeholder="Message..."
            rows={5}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            style={{ resize: "vertical" }}
          />
          {sendMsg && (
            <div style={{ fontSize: 13, fontWeight: 600, color: sendMsg === "Sent!" ? "var(--ok, #16a34a)" : "#dc2626" }}>{sendMsg}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              disabled={sending || !form.subject || !form.body}
              onClick={() => void handleSend()}
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={() => { setComposing(false); setSendMsg(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      {loading ? (
        <div style={{ fontSize: 13, color: "var(--ink-faint)", padding: "8px 0" }}>Loading emails...</div>
      ) : emails.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-faint)", padding: "8px 0" }}>
          {contactEmail ? "No emails yet. Emails from this contact will appear here after the next sync." : "Add an email address to this contact to enable email."}
        </div>
      ) : (
        <div className="crm-stack-4">
          {emails.map(email => (
            <div
              key={email.id}
              onClick={() => setExpanded(expanded === email.id ? null : email.id)}
              style={{
                background: email.direction === "outbound" ? "#f0fdf4" : "var(--surface-1, #fff)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "9px 12px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    color: email.direction === "outbound" ? "#16a34a" : "var(--ink-primary, #0ea5e9)",
                    background: email.direction === "outbound" ? "#dcfce7" : "#e0f2fe",
                    borderRadius: 4, padding: "1px 5px", flexShrink: 0,
                  }}>
                    {email.direction === "outbound" ? "Sent" : "Received"}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email.subject || "(no subject)"}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>
                  {formatDate(email.received_at)}
                </span>
              </div>
              {expanded === email.id && email.body_text && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)", whiteSpace: "pre-wrap", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  {email.body_text.slice(0, 1200)}{email.body_text.length > 1200 ? "…" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
