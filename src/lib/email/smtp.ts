import nodemailer from "nodemailer";
import type { EmailConfig } from "./credentials";

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export async function sendEmail(
  config: EmailConfig,
  opts: SendEmailOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: { user: config.email, pass: config.password },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });

    await transporter.sendMail({
      from: config.email,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo ?? config.email,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlySmtpError(message) };
  }
}

export async function testSmtp(
  config: EmailConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: { user: config.email, pass: config.password },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlySmtpError(message) };
  }
}

function friendlySmtpError(raw: string): string {
  if (/invalid.*(login|credentials|password)/i.test(raw)) return "Wrong email or password. If using Gmail, make sure to use an App Password.";
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(raw)) return "Could not reach the mail server. Check the SMTP host and port.";
  if (/535|534|530/i.test(raw)) return "Authentication failed. Check your email and app password.";
  if (/certificate|TLS|SSL/i.test(raw)) return "SSL/TLS error. Try toggling the secure connection setting.";
  return raw.slice(0, 140);
}
