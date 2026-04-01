// Auto-detect IMAP/SMTP settings from email domain

export type ProviderConfig = {
  imap: { host: string; port: number; tls: boolean };
  smtp: { host: string; port: number; secure: boolean };
  label: string;
  appPasswordUrl?: string;
  instructions?: string;
};

const PROVIDERS: Record<string, ProviderConfig> = {
  "gmail.com": {
    label: "Gmail",
    imap: { host: "imap.gmail.com", port: 993, tls: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    instructions: "Use an App Password, not your regular Gmail password. Go to Google Account → Security → 2-Step Verification → App Passwords.",
  },
  "googlemail.com": {
    label: "Gmail",
    imap: { host: "imap.gmail.com", port: 993, tls: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    instructions: "Use an App Password, not your regular Gmail password.",
  },
  "outlook.com": {
    label: "Outlook",
    imap: { host: "outlook.office365.com", port: 993, tls: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    instructions: "Use an App Password from your Microsoft account security settings.",
  },
  "hotmail.com": {
    label: "Hotmail",
    imap: { host: "outlook.office365.com", port: 993, tls: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    instructions: "Use an App Password from your Microsoft account security settings.",
  },
  "live.com": {
    label: "Live / Hotmail",
    imap: { host: "outlook.office365.com", port: 993, tls: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    instructions: "Use an App Password from your Microsoft account security settings.",
  },
  "icloud.com": {
    label: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993, tls: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
    instructions: "Use an app-specific password from appleid.apple.com.",
  },
  "me.com": {
    label: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993, tls: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
    instructions: "Use an app-specific password from appleid.apple.com.",
  },
  "yahoo.com": {
    label: "Yahoo",
    imap: { host: "imap.mail.yahoo.com", port: 993, tls: true },
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
    instructions: "Use an App Password from Yahoo Account Security.",
  },
};

export function detectProvider(email: string): ProviderConfig | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return PROVIDERS[domain] ?? null;
}

export function defaultProviderConfig(imapHost: string, smtpHost: string): ProviderConfig {
  return {
    label: "Custom",
    imap: { host: imapHost, port: 993, tls: true },
    smtp: { host: smtpHost, port: 587, secure: false },
    instructions: "Use your regular email password or an app password if your host requires it.",
  };
}
