// Read and write email credentials from agent settings JSON
// Credentials are stored in agents.settings under the key "email_config"
// Note: for production, consider Supabase Vault for credential encryption

export type EmailConfig = {
  email: string;
  password: string;            // app password
  imap_host: string;
  imap_port: number;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  connected_at: string;        // ISO timestamp
};

export function readEmailConfig(settings: Record<string, unknown> | null): EmailConfig | null {
  if (!settings) return null;
  const cfg = settings["email_config"];
  if (!cfg || typeof cfg !== "object") return null;
  const c = cfg as Record<string, unknown>;
  if (typeof c.email !== "string" || typeof c.password !== "string") return null;
  return {
    email: c.email,
    password: c.password,
    imap_host: typeof c.imap_host === "string" ? c.imap_host : "imap.gmail.com",
    imap_port: typeof c.imap_port === "number" ? c.imap_port : 993,
    imap_tls: typeof c.imap_tls === "boolean" ? c.imap_tls : true,
    smtp_host: typeof c.smtp_host === "string" ? c.smtp_host : "smtp.gmail.com",
    smtp_port: typeof c.smtp_port === "number" ? c.smtp_port : 465,
    smtp_secure: typeof c.smtp_secure === "boolean" ? c.smtp_secure : true,
    connected_at: typeof c.connected_at === "string" ? c.connected_at : new Date().toISOString(),
  };
}

export function writeEmailConfig(
  settings: Record<string, unknown> | null,
  config: EmailConfig,
): Record<string, unknown> {
  return { ...(settings ?? {}), email_config: config };
}

export function clearEmailConfig(
  settings: Record<string, unknown> | null,
): Record<string, unknown> {
  const s = { ...(settings ?? {}) };
  delete s["email_config"];
  return s;
}
