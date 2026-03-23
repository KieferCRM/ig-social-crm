"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = {
  connected: boolean;
  email?: string;
  imap_host?: string;
  smtp_host?: string;
  connected_at?: string;
};

type FormState = {
  email: string;
  password: string;
  imap_host: string;
  imap_port: string;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
};

type Provider = {
  label: string;
  imap_host: string;
  imap_port: number;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  instructions?: string;
  appPasswordUrl?: string;
};

const KNOWN_PROVIDERS: Record<string, Provider> = {
  "gmail.com": {
    label: "Gmail",
    imap_host: "imap.gmail.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    instructions: "Gmail requires an App Password — not your regular password. Enable 2-Step Verification in your Google Account, then go to Security → App Passwords to generate one.",
  },
  "googlemail.com": {
    label: "Gmail",
    imap_host: "imap.gmail.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    instructions: "Gmail requires an App Password — not your regular password.",
  },
  "outlook.com": {
    label: "Outlook",
    imap_host: "outlook.office365.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.office365.com", smtp_port: 587, smtp_secure: false,
    instructions: "Use an App Password from your Microsoft account (account.microsoft.com → Security → App passwords).",
  },
  "hotmail.com": {
    label: "Hotmail",
    imap_host: "outlook.office365.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.office365.com", smtp_port: 587, smtp_secure: false,
    instructions: "Use an App Password from your Microsoft account security settings.",
  },
  "icloud.com": {
    label: "iCloud",
    imap_host: "imap.mail.me.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.mail.me.com", smtp_port: 587, smtp_secure: false,
    instructions: "Use an app-specific password from appleid.apple.com → Sign-In and Security → App-Specific Passwords.",
  },
  "yahoo.com": {
    label: "Yahoo",
    imap_host: "imap.mail.yahoo.com", imap_port: 993, imap_tls: true,
    smtp_host: "smtp.mail.yahoo.com", smtp_port: 465, smtp_secure: true,
    instructions: "Use an App Password from Yahoo Account Security.",
  },
};

function BLANK_FORM(): FormState {
  return { email: "", password: "", imap_host: "", imap_port: "993", imap_tls: true, smtp_host: "", smtp_port: "465", smtp_secure: true };
}

function applyProvider(form: FormState, p: Provider): FormState {
  return { ...form, imap_host: p.imap_host, imap_port: String(p.imap_port), imap_tls: p.imap_tls, smtp_host: p.smtp_host, smtp_port: String(p.smtp_port), smtp_secure: p.smtp_secure };
}

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM());
  const [provider, setProvider] = useState<Provider | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ imap: { ok: boolean; error?: string }; smtp: { ok: boolean; error?: string } } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [disconnecting, setDisconnecting] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    void fetch("/api/settings/email")
      .then(r => r.json())
      .then(d => setStatus(d as ConnectionStatus))
      .catch(() => setStatus({ connected: false }));
  }, []);

  function handleEmailChange(email: string) {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    const p = KNOWN_PROVIDERS[domain] ?? null;
    setProvider(p);
    setForm(prev => p ? applyProvider({ ...prev, email }, p) : { ...prev, email });
    setTestResult(null);
    setSaveMsg("");
  }

  function set(key: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
    setSaveMsg("");
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        imap_host: form.imap_host.trim(),
        imap_port: parseInt(form.imap_port, 10),
        imap_tls: form.imap_tls,
        smtp_host: form.smtp_host.trim(),
        smtp_port: parseInt(form.smtp_port, 10),
        smtp_secure: form.smtp_secure,
      }),
    });
    const data = await res.json() as typeof testResult;
    setTestResult(data);
    setTesting(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    const res = await fetch("/api/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        imap_host: form.imap_host.trim(),
        imap_port: parseInt(form.imap_port, 10),
        imap_tls: form.imap_tls,
        smtp_host: form.smtp_host.trim(),
        smtp_port: parseInt(form.smtp_port, 10),
        smtp_secure: form.smtp_secure,
      }),
    });
    const data = await res.json() as { ok?: boolean; error?: string; email?: string };
    setSaving(false);
    if (!res.ok || !data.ok) {
      setSaveMsg(data.error ?? "Could not save.");
    } else {
      setSaveMsg("Connected!");
      setStatus({ connected: true, email: data.email, imap_host: form.imap_host, smtp_host: form.smtp_host, connected_at: new Date().toISOString() });
      setForm(BLANK_FORM());
      setTestResult(null);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect your email? Synced email history will remain but no new emails will be pulled.")) return;
    setDisconnecting(true);
    await fetch("/api/settings/email", { method: "DELETE" });
    setDisconnecting(false);
    setStatus({ connected: false });
    setTestResult(null);
    setSaveMsg("");
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/email/sync", { method: "POST" });
    const data = await res.json() as { ok?: boolean; synced?: number; error?: string };
    setSyncing(false);
    if (!res.ok || !data.ok) {
      setSyncMsg(data.error ?? "Sync failed.");
    } else {
      setSyncMsg(`Synced ${data.synced ?? 0} emails.`);
      window.setTimeout(() => setSyncMsg(""), 4000);
    }
  }

  const canTest = form.email && form.password && form.imap_host && form.smtp_host;
  const canSave = testResult?.imap.ok && testResult?.smtp.ok;

  if (status === null) {
    return <main className="crm-page crm-stack-12" style={{ maxWidth: 680 }}><div style={{ color: "var(--ink-muted)", padding: 32 }}>Loading...</div></main>;
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 680 }}>
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Email</h1>
            <p className="crm-page-subtitle">
              Connect your inbox to sync emails with contacts, send directly from the CRM, and auto-attach files to deals.
            </p>
          </div>
        </div>
      </section>

      {/* Connected state */}
      {status.connected ? (
        <>
          <section className="crm-card crm-section-card crm-stack-10">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>Connected</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{status.email}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              IMAP: {status.imap_host} · SMTP: {status.smtp_host}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={syncing}
                onClick={() => void handleSync()}
              >
                {syncing ? "Syncing..." : "Sync inbox now"}
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                disabled={disconnecting}
                onClick={() => void handleDisconnect()}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
              {syncMsg && (
                <span style={{ fontSize: 13, fontWeight: 600, color: syncMsg.startsWith("Synced") ? "var(--ok, #16a34a)" : "#dc2626" }}>
                  {syncMsg}
                </span>
              )}
            </div>
          </section>

          <section className="crm-card crm-section-card crm-stack-10">
            <h2 className="crm-section-title">How it works</h2>
            <div className="crm-stack-6" style={{ fontSize: 14 }}>
              <div>📥 <strong>Inbound:</strong> Emails from known contacts are automatically synced and appear on their contact record every 15 minutes.</div>
              <div>📤 <strong>Outbound:</strong> Send emails directly from a contact&apos;s page — they&apos;ll be sent from your real inbox and logged here.</div>
              <div>📎 <strong>Attachments (coming soon):</strong> PDFs detected in emails will be auto-attached to the matching deal.</div>
            </div>
          </section>
        </>
      ) : (
        /* Connect form */
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title">Connect your email</h2>

          {/* Email field — triggers auto-detect */}
          <label className="crm-filter-field">
            <span>Your email address</span>
            <input
              className="crm-input"
              type="email"
              placeholder="you@yourdomain.com"
              value={form.email}
              onChange={e => handleEmailChange(e.target.value)}
              autoComplete="off"
            />
          </label>

          {/* Provider hint */}
          {provider && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
              <strong>{provider.label} detected.</strong>
              {provider.instructions && <span> {provider.instructions}</span>}
              {provider.appPasswordUrl && (
                <> <a href={provider.appPasswordUrl} target="_blank" rel="noreferrer" style={{ color: "var(--ink-primary)" }}>Generate App Password →</a></>
              )}
            </div>
          )}

          {!provider && form.email.includes("@") && (
            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--ink-muted)" }}>
              Custom domain detected — you&apos;ll need to fill in the server settings below. Check with your email host for the correct IMAP/SMTP details.
            </div>
          )}

          <label className="crm-filter-field">
            <span>App password</span>
            <input
              className="crm-input"
              type="password"
              placeholder="App password (not your regular password)"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {/* Advanced settings toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--ink-primary)", padding: 0, textAlign: "left" }}
          >
            {showAdvanced ? "▼" : "▶"} Advanced server settings {provider ? "(auto-filled)" : "(required for custom domain)"}
          </button>

          {showAdvanced && (
            <div className="crm-stack-8">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
                <label className="crm-filter-field" style={{ margin: 0 }}>
                  <span>IMAP host</span>
                  <input className="crm-input" value={form.imap_host} onChange={e => set("imap_host", e.target.value)} placeholder="imap.yourdomain.com" />
                </label>
                <label className="crm-filter-field" style={{ margin: 0, minWidth: 70 }}>
                  <span>Port</span>
                  <input className="crm-input" type="number" value={form.imap_port} onChange={e => set("imap_port", e.target.value)} />
                </label>
                <label className="crm-filter-field" style={{ margin: 0 }}>
                  <span>TLS</span>
                  <input type="checkbox" checked={form.imap_tls} onChange={e => set("imap_tls", e.target.checked)} style={{ width: 18, height: 18 }} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
                <label className="crm-filter-field" style={{ margin: 0 }}>
                  <span>SMTP host</span>
                  <input className="crm-input" value={form.smtp_host} onChange={e => set("smtp_host", e.target.value)} placeholder="smtp.yourdomain.com" />
                </label>
                <label className="crm-filter-field" style={{ margin: 0, minWidth: 70 }}>
                  <span>Port</span>
                  <input className="crm-input" type="number" value={form.smtp_port} onChange={e => set("smtp_port", e.target.value)} />
                </label>
                <label className="crm-filter-field" style={{ margin: 0 }}>
                  <span>SSL</span>
                  <input type="checkbox" checked={form.smtp_secure} onChange={e => set("smtp_secure", e.target.checked)} style={{ width: 18, height: 18 }} />
                </label>
              </div>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className="crm-stack-6">
              <StatusLine label="IMAP (read email)" result={testResult.imap} />
              <StatusLine label="SMTP (send email)" result={testResult.smtp} />
            </div>
          )}

          {saveMsg && (
            <div style={{ fontSize: 13, fontWeight: 600, color: saveMsg === "Connected!" ? "var(--ok, #16a34a)" : "#dc2626" }}>
              {saveMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              disabled={!canTest || testing}
              onClick={() => void handleTest()}
            >
              {testing ? "Testing..." : "Test connection"}
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Connecting..." : "Save & connect"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
            Test connection first — the Save button activates once both checks pass.
          </p>
        </section>
      )}
    </main>
  );
}

function StatusLine({ label, result }: { label: string; result: { ok: boolean; error?: string } }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
      <span style={{ fontWeight: 700, color: result.ok ? "var(--ok, #16a34a)" : "#dc2626", flexShrink: 0 }}>
        {result.ok ? "✓" : "✗"}
      </span>
      <span>
        <strong>{label}:</strong>{" "}
        {result.ok ? "OK" : <span style={{ color: "#dc2626" }}>{result.error}</span>}
      </span>
    </div>
  );
}
