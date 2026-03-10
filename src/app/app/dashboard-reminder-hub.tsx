"use client";

import { useEffect, useMemo, useState } from "react";

type Reminder = {
  id: string;
  lead_id: string | null;
  conversation_id: string | null;
  due_at: string;
  status: "pending" | "done";
  note: string | null;
  preset: string | null;
};

type Lead = {
  id: string;
  ig_username: string;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  next_step: string | null;
};

type ReengagementLead = {
  id: string;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
  time_last_updated: string | null;
};

export default function DashboardReminderHub() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [queue, setQueue] = useState<ReengagementLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copyingId, setCopyingId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [preset, setPreset] = useState<"1d" | "3d" | "1w">("1d");
  const [note, setNote] = useState("");

  const overdueCount = useMemo(() => {
    const nowIso = new Date().toISOString();
    return reminders.filter((r) => r.status === "pending" && r.due_at < nowIso).length;
  }, [reminders]);

  useEffect(() => {
    const fromUrl =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lead_id") || "" : "";
    if (fromUrl) setLeadId(fromUrl);

    async function load() {
      setLoading(true);
      const [reminderResponse, leadResponse, queueResponse] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/leads/simple"),
        fetch("/api/reengagement/queue"),
      ]);

      const reminderPayload = (await reminderResponse.json()) as { reminders?: Reminder[]; error?: string };
      const leadPayload = (await leadResponse.json()) as { leads?: Lead[]; error?: string };
      const queuePayload = (await queueResponse.json()) as { queue?: ReengagementLead[]; error?: string };

      if (!reminderResponse.ok) setMessage(reminderPayload.error || "Could not load reminders.");
      if (!leadResponse.ok) setMessage(leadPayload.error || "Could not load leads.");
      if (!queueResponse.ok) setMessage(queuePayload.error || "Could not load re-engagement queue.");

      setReminders((reminderPayload.reminders || []).filter((r) => r.status === "pending"));
      setLeads(leadPayload.leads || []);
      setQueue(queuePayload.queue || []);
      setLoading(false);
    }

    void load();
  }, []);

  function buildSuggestedReply(lead: Lead | undefined, reminder: Reminder): string {
    const handle = lead?.ig_username ? `@${lead.ig_username}` : "there";
    const intent = lead?.intent?.trim();
    const timeline = lead?.timeline?.trim();
    const nextStep = lead?.next_step?.trim();
    const source = lead?.source?.trim();
    const lines = [
      `Hey ${handle}, quick follow-up from my last message.`,
      intent ? `You mentioned you're focused on ${intent}.` : "",
      timeline ? `Since your timeline is ${timeline}, I can help you move this forward now.` : "I can help you move this forward now.",
      nextStep ? `Next best step: ${nextStep}.` : "Want me to send your best next options and lock in a quick call?",
      source ? `(Context: ${source})` : "",
      reminder.note ? `Reminder note: ${reminder.note}` : "",
    ].filter(Boolean);
    return lines.join(" ");
  }

  async function addReminder() {
    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId || null, preset, note: note || null }),
    });
    const data = (await response.json()) as { reminder?: Reminder; error?: string };
    if (!response.ok || !data.reminder) {
      setMessage(data.error || "Could not create reminder.");
      return;
    }
    setReminders((prev) => [...prev, data.reminder!].sort((a, b) => a.due_at.localeCompare(b.due_at)));
    setNote("");
    setMessage("Reminder created.");
  }

  async function markDone(id: string) {
    const response = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    const data = (await response.json()) as { reminder?: Reminder; error?: string };
    if (!response.ok || !data.reminder) {
      setMessage(data.error || "Could not update reminder.");
      return false;
    }
    setReminders((prev) => prev.filter((r) => r.id !== id));
    return true;
  }

  async function copySuggestedReply(reminder: Reminder): Promise<boolean> {
    const lead = leads.find((l) => l.id === reminder.lead_id);
    const text = buildSuggestedReply(lead, reminder);
    try {
      setCopyingId(reminder.id);
      await navigator.clipboard.writeText(text);
      setMessage("Suggested reply copied.");
      return true;
    } catch {
      setMessage("Could not copy reply.");
      return false;
    } finally {
      setCopyingId("");
    }
  }

  async function copyAndDone(reminder: Reminder) {
    const copied = await copySuggestedReply(reminder);
    if (copied) await markDone(reminder.id);
  }

  async function queueReminder(nextLeadId: string) {
    const response = await fetch("/api/reengagement/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: nextLeadId }),
    });
    const data = (await response.json()) as { reminder?: Reminder; skipped?: boolean; error?: string };
    if (!response.ok) {
      setMessage(data.error || "Could not queue reminder.");
      return;
    }
    if (data.reminder) {
      setReminders((prev) => [...prev, data.reminder!].sort((a, b) => a.due_at.localeCompare(b.due_at)));
    }
    setQueue((prev) => prev.filter((lead) => lead.id !== nextLeadId));
    setMessage(data.skipped ? "Pending reminder already exists." : "Reminder queued.");
  }

  return (
    <section id="reminder-hub" className="crm-card" style={{ marginTop: 14, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>Reminder Hub</div>
        <span className={`crm-chip ${overdueCount > 0 ? "crm-chip-danger" : "crm-chip-ok"}`}>
          {overdueCount > 0 ? `${overdueCount} overdue` : "No overdue"}
        </span>
      </div>

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 120px 1fr auto", gap: 8 }}>
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">Select lead</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>@{lead.ig_username}</option>
          ))}
        </select>
        <select value={preset} onChange={(e) => setPreset(e.target.value as "1d" | "3d" | "1w")}>
          <option value="1d">1 day</option>
          <option value="3d">3 days</option>
          <option value="1w">1 week</option>
        </select>
        <input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="crm-btn crm-btn-primary" onClick={() => void addReminder()}>Add</button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Loading reminders...</div>
        ) : reminders.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>No pending reminders right now.</div>
        ) : (
          reminders.slice(0, 6).map((reminder) => {
            const lead = leads.find((l) => l.id === reminder.lead_id);
            return (
              <div key={reminder.id} className="crm-card-muted" style={{ padding: 10, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>
                    {new Date(reminder.due_at).toLocaleString()} • {lead ? `@${lead.ig_username}` : "No lead"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      className="crm-btn crm-btn-secondary"
                      style={{ padding: "6px 9px", fontSize: 12 }}
                      disabled={copyingId === reminder.id}
                      onClick={() => void copySuggestedReply(reminder)}
                    >
                      {copyingId === reminder.id ? "Copying..." : "Copy"}
                    </button>
                    <button
                      className="crm-btn crm-btn-primary"
                      style={{ padding: "6px 9px", fontSize: 12 }}
                      disabled={copyingId === reminder.id}
                      onClick={() => void copyAndDone(reminder)}
                    >
                      Copy + Done
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>
                  {buildSuggestedReply(lead, reminder)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-muted)" }}>
          Re-engagement queue ({queue.length})
        </summary>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {queue.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>No stale leads currently need re-engagement.</div>
          ) : (
            queue.slice(0, 4).map((lead) => (
              <div key={lead.id} className="crm-card-muted" style={{ padding: 10, border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 13 }}>
                  <strong>@{lead.ig_username || "unknown"}</strong>{" "}
                  <span style={{ color: "var(--ink-muted)" }}>
                    ({lead.stage || "-"} • {lead.lead_temp || "-"})
                  </span>
                </div>
                <button className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }} onClick={() => void queueReminder(lead.id)}>
                  Queue
                </button>
              </div>
            ))
          )}
        </div>
      </details>

      {message ? (
        <div style={{ marginTop: 10 }} className={`crm-chip ${message.includes("Could") ? "crm-chip-danger" : "crm-chip-ok"}`}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
