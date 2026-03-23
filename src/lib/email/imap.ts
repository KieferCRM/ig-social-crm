import { ImapFlow } from "imapflow";
import type { EmailConfig } from "./credentials";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncResult = {
  synced: number;
  errors: string[];
};

export async function testImap(
  config: EmailConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_tls,
    auth: { user: config.email, pass: config.password },
    logger: false,
    connectionTimeout: 8000,
  });

  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyImapError(message) };
  }
}

// Sync the last N emails from INBOX, match to contacts by email address
export async function syncInbox(
  agentId: string,
  config: EmailConfig,
  supabase: SupabaseClient,
  limit = 50,
): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;

  // Load all known contact emails for this agent (for matching)
  const { data: contacts } = await supabase
    .from("leads")
    .select("id, canonical_email")
    .eq("agent_id", agentId)
    .not("canonical_email", "is", null);

  const emailToContactId = new Map<string, string>();
  for (const c of contacts ?? []) {
    if (c.canonical_email) {
      emailToContactId.set((c.canonical_email as string).toLowerCase().trim(), c.id as string);
    }
  }

  const client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_tls,
    auth: { user: config.email, pass: config.password },
    logger: false,
    connectionTimeout: 10000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch last `limit` messages (newest first)
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) return { synced: 0, errors: [] };

      const start = Math.max(1, total - limit + 1);
      const range = `${start}:*`;

      const rows: Array<{
        agent_id: string;
        contact_id: string | null;
        direction: string;
        from_address: string | null;
        to_address: string | null;
        subject: string | null;
        body_text: string | null;
        message_id: string | null;
        received_at: string | null;
        attachments: unknown[];
      }> = [];

      for await (const msg of client.fetch(range, {
        envelope: true,
        bodyStructure: true,
        bodyParts: ["text"],
        source: false,
      })) {
        try {
          const env = msg.envelope;
          const messageId = env?.messageId ?? null;
          const fromAddr = env?.from?.[0]?.address?.toLowerCase() ?? null;
          const toAddr = env?.to?.[0]?.address?.toLowerCase() ?? null;
          const subject = env?.subject ?? null;
          const receivedAt = env?.date?.toISOString() ?? null;

          // Match contact: check from/to against known contacts
          const contactId =
            (fromAddr && emailToContactId.get(fromAddr)) ||
            (toAddr && emailToContactId.get(toAddr)) ||
            null;

          // Only store emails that match a known contact OR are recent (last 20)
          if (!contactId && rows.length >= 20) continue;

          // Extract plain text body
          let bodyText: string | null = null;
          if (msg.bodyParts) {
            for (const [, buf] of msg.bodyParts) {
              if (buf) {
                bodyText = buf.toString("utf8").slice(0, 4000);
                break;
              }
            }
          }

          rows.push({
            agent_id: agentId,
            contact_id: contactId ?? null,
            direction: "inbound",
            from_address: fromAddr,
            to_address: toAddr,
            subject,
            body_text: bodyText,
            message_id: messageId,
            received_at: receivedAt,
            attachments: [],
          });
        } catch (msgErr) {
          errors.push(msgErr instanceof Error ? msgErr.message : String(msgErr));
        }
      }

      if (rows.length > 0) {
        // Upsert — skip duplicates by message_id
        const { error } = await supabase
          .from("agent_emails")
          .upsert(rows, { onConflict: "agent_id,message_id", ignoreDuplicates: true });

        if (error) {
          errors.push(error.message);
        } else {
          synced = rows.length;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { synced, errors };
}

function friendlyImapError(raw: string): string {
  if (/invalid.*(login|credentials|password)/i.test(raw)) return "Wrong email or password. If using Gmail, make sure to use an App Password.";
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(raw)) return "Could not reach the mail server. Check the IMAP host and port.";
  if (/LOGIN|AUTHENTICATE|535/i.test(raw)) return "Authentication failed. Check your email and app password.";
  if (/certificate|TLS|SSL/i.test(raw)) return "SSL/TLS error. Try toggling the TLS setting.";
  return raw.slice(0, 140);
}
