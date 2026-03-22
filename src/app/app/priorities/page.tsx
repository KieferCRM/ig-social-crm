"use client";

/**
 * /app/priorities — Off-Market Task Management
 *
 * Four columns: Due Now | Update This Deal | Upcoming | Reminders This Week
 * Supports: manual task creation, mark done, completed today section.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Priority = "urgent" | "high" | "medium" | "low";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: string;
  due_at: string | null;
  reason_code: string;
  metadata: Record<string, unknown>;
  lead_id: string | null;
  completed_at: string | null;
  updated_at: string;
  lead: { id: string; full_name: string | null; canonical_phone: string | null } | null;
};

type Reminder = {
  id: string;
  due_at: string;
  status: string;
  note: string | null;
  lead_id: string | null;
  lead: { id: string; full_name: string | null; canonical_phone: string | null } | null;
};

type StaleDeal = {
  id: string;
  lead_id: string | null;
  property_address: string | null;
  stage: string | null;
  updated_at: string | null;
};

type LeadOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function leadDisplayName(lead: { full_name?: string | null; first_name?: string | null; last_name?: string | null; canonical_phone?: string | null; ig_username?: string | null } | null): string {
  if (!lead) return "Unknown";
  const full = lead.full_name?.trim();
  if (full) return full;
  const parts = [lead.first_name?.trim(), lead.last_name?.trim()].filter(Boolean).join(" ");
  if (parts) return parts;
  if (lead.canonical_phone) return lead.canonical_phone;
  if (lead.ig_username) return `@${lead.ig_username}`;
  return "Unnamed lead";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isOverdue(due_at: string | null | undefined): boolean {
  if (!due_at) return false;
  return new Date(due_at).getTime() < Date.now();
}

function isDueToday(due_at: string | null | undefined): boolean {
  if (!due_at) return false;
  const d = new Date(due_at);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isThisWeek(due_at: string | null | undefined): boolean {
  if (!due_at) return false;
  const d = new Date(due_at).getTime();
  const now = Date.now();
  return d <= now + 7 * 24 * 3600_000;
}

function prettyPriority(p: Priority | string): string {
  if (p === "urgent") return "Urgent";
  if (p === "high") return "High";
  if (p === "medium") return "Medium";
  return "Low";
}

function prettyStage(stage: string | null): string {
  if (!stage) return "Unknown stage";
  return stage.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_CHIP: Record<string, { bg: string; color: string }> = {
  urgent: { bg: "#fee2e2", color: "#dc2626" },
  high:   { bg: "#fef3c7", color: "#d97706" },
  medium: { bg: "#eff6ff", color: "#2563eb" },
  low:    { bg: "#f3f4f6", color: "#6b7280" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_CHIP[priority] ?? PRIORITY_CHIP.low;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, borderRadius: 4, padding: "1px 6px" }}>
      {prettyPriority(priority)}
    </span>
  );
}

function SourceBadge({ reasonCode }: { reasonCode: string }) {
  if (reasonCode !== "manual") return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", borderRadius: 4, padding: "1px 6px" }}>
      Manual
    </span>
  );
}

function ReminderBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", borderRadius: 4, padding: "1px 6px" }}>
      Reminder
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task Card
// ---------------------------------------------------------------------------

function TaskCard({
  task,
  onDone,
  marking,
}: {
  task: Task;
  onDone: (id: string) => void;
  marking: boolean;
}) {
  const overdue = isOverdue(task.due_at);
  return (
    <div
      style={{
        background: overdue ? "#fff7ed" : "var(--surface, #fff)",
        border: `1px solid ${overdue ? "#fed7aa" : "var(--border, #e5e7eb)"}`,
        borderLeft: `3px solid ${overdue ? "#ea580c" : task.priority === "urgent" ? "#dc2626" : task.priority === "high" ? "#d97706" : "var(--border, #e5e7eb)"}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <PriorityBadge priority={task.priority} />
            <SourceBadge reasonCode={task.reason_code} />
            {overdue && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "1px 6px" }}>
                Overdue
              </span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-body)" }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.5 }}>{task.description}</div>
          )}
          {task.lead && (
            <Link
              href={`/app/leads/${task.lead.id}`}
              style={{ fontSize: 12, color: "var(--ink-primary)", textDecoration: "none", marginTop: 2, display: "block" }}
            >
              {leadDisplayName(task.lead)} →
            </Link>
          )}
        </div>
        <button
          className="crm-btn crm-btn-secondary"
          style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0, whiteSpace: "nowrap" }}
          disabled={marking}
          onClick={() => onDone(task.id)}
        >
          {marking ? "…" : "Mark done"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: overdue ? "#ea580c" : "var(--ink-faint)" }}>
        {overdue ? `Overdue — was due ${formatDate(task.due_at)}` : `Due ${formatDate(task.due_at)}`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reminder Card
// ---------------------------------------------------------------------------

function ReminderCard({
  reminder,
  onDone,
  marking,
  showInColumn,
}: {
  reminder: Reminder;
  onDone: (id: string) => void;
  marking: boolean;
  showInColumn?: boolean;
}) {
  const overdue = isOverdue(reminder.due_at);
  const today = isDueToday(reminder.due_at);

  return (
    <div
      style={{
        background: overdue ? "#fff7ed" : "var(--surface, #fff)",
        border: `1px solid ${overdue ? "#fed7aa" : "var(--border, #e5e7eb)"}`,
        borderLeft: `3px solid ${overdue ? "#ea580c" : today ? "#d97706" : "#7c3aed"}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <ReminderBadge />
            {overdue && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#fee2e2", color: "#dc2626", borderRadius: 4, padding: "1px 6px" }}>
                Overdue
              </span>
            )}
            {today && !overdue && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#d97706", borderRadius: 4, padding: "1px 6px" }}>
                Today
              </span>
            )}
          </div>
          {reminder.lead ? (
            <Link
              href={`/app/leads/${reminder.lead.id}`}
              style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-primary)", textDecoration: "none" }}
            >
              {leadDisplayName(reminder.lead)}
            </Link>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-body)" }}>No lead linked</span>
          )}
          {reminder.note && (
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.5 }}>{reminder.note}</div>
          )}
        </div>
        <button
          className="crm-btn crm-btn-secondary"
          style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0, whiteSpace: "nowrap" }}
          disabled={marking}
          onClick={() => onDone(reminder.id)}
        >
          {marking ? "…" : "Mark done"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: overdue ? "#ea580c" : "var(--ink-faint)" }}>
        {overdue ? `Overdue — was due ${formatDateTime(reminder.due_at)}` : formatDateTime(reminder.due_at)}
      </div>
      {showInColumn && (
        <div style={{ fontSize: 10, color: "var(--ink-faint)", fontStyle: "italic" }}>Also in Reminders This Week</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Task Modal
// ---------------------------------------------------------------------------

function AddTaskModal({
  leads,
  onClose,
  onAdd,
}: {
  leads: LeadOption[];
  onClose: () => void;
  onAdd: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [priority, setPriority] = useState<Priority>("medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    if (!q) return leads.slice(0, 20);
    return leads
      .filter((l) => {
        const name = leadDisplayName(l).toLowerCase();
        const phone = (l.canonical_phone ?? "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [leads, leadSearch]);

  const submit = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!dueAt) { setError("Due date is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), lead_id: leadId || null, due_at: dueAt, priority, notes: notes.trim() || null }),
      });
      const data = await res.json() as { task?: Task; error?: string };
      if (!res.ok || !data.task) { setError(data.error ?? "Could not create task."); return; }
      onAdd(data.task);
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 480,
          display: "grid",
          gap: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add Task</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ink-muted)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#991b1b" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 }}>
              Task title <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              className="crm-input"
              style={{ width: "100%", fontSize: 13 }}
              placeholder="e.g. Follow up with John about offer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 }}>
              Related lead (optional)
            </label>
            <input
              className="crm-input"
              style={{ width: "100%", fontSize: 13, marginBottom: 4 }}
              placeholder="Search by name or phone…"
              value={leadSearch}
              onChange={(e) => { setLeadSearch(e.target.value); if (!e.target.value) setLeadId(""); }}
            />
            {leadSearch && (
              <div style={{ border: "1px solid var(--border)", borderRadius: 6, maxHeight: 160, overflowY: "auto", background: "var(--surface)" }}>
                {filteredLeads.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-muted)" }}>No leads found</div>
                ) : (
                  filteredLeads.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setLeadId(l.id); setLeadSearch(leadDisplayName(l)); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                        background: leadId === l.id ? "#eff6ff" : "transparent",
                        border: "none", cursor: "pointer", fontSize: 13,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {leadDisplayName(l)}
                      {l.canonical_phone && <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 8 }}>{l.canonical_phone}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
            {leadId && (
              <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>✓ Lead linked</div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 }}>
                Due date <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="date"
                className="crm-input"
                style={{ width: "100%", fontSize: 13 }}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 }}>
                Priority
              </label>
              <select
                className="crm-input"
                style={{ width: "100%", fontSize: 13 }}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 }}>
              Notes (optional)
            </label>
            <textarea
              className="crm-input"
              style={{ width: "100%", fontSize: 13, resize: "vertical", minHeight: 72 }}
              placeholder="Any extra context for this task…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="crm-btn crm-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="crm-btn crm-btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed Today Section
// ---------------------------------------------------------------------------

function CompletedToday({ tasks, reminders }: { tasks: Task[]; reminders: Reminder[] }) {
  const [open, setOpen] = useState(false);
  const count = tasks.length + reminders.length;
  if (count === 0) return null;

  return (
    <section style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", padding: "4px 0",
        }}
      >
        <span>{open ? "▾" : "▸"}</span>
        Completed today
        <span style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a", borderRadius: 10, padding: "0 6px", fontWeight: 700 }}>
          {count}
        </span>
      </button>

      {open && (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {tasks.map((t) => (
            <div
              key={t.id}
              style={{
                background: "#f9fafb", border: "1px solid var(--border)", borderRadius: 8,
                padding: "8px 12px", opacity: 0.7,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13, textDecoration: "line-through", color: "var(--ink-muted)" }}>{t.title}</span>
                <SourceBadge reasonCode={t.reason_code} />
                {t.lead && (
                  <Link href={`/app/leads/${t.lead.id}`} style={{ fontSize: 12, color: "var(--ink-primary)", textDecoration: "none" }}>
                    {leadDisplayName(t.lead)}
                  </Link>
                )}
              </div>
            </div>
          ))}
          {reminders.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#f9fafb", border: "1px solid var(--border)", borderRadius: 8,
                padding: "8px 12px", opacity: 0.7,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓</span>
                <ReminderBadge />
                {r.lead ? (
                  <Link href={`/app/leads/${r.lead.id}`} style={{ fontSize: 13, textDecoration: "line-through", color: "var(--ink-muted)" }}>
                    {leadDisplayName(r.lead)}
                  </Link>
                ) : (
                  <span style={{ fontSize: 13, textDecoration: "line-through", color: "var(--ink-muted)" }}>Reminder</span>
                )}
                {r.note && <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{r.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Column wrapper
// ---------------------------------------------------------------------------

function Column({
  title,
  count,
  chipClass,
  children,
  empty,
}: {
  title: string;
  count: number;
  chipClass?: string;
  children: React.ReactNode;
  empty: React.ReactNode;
}) {
  return (
    <article
      className="crm-card crm-section-card"
      style={{ display: "grid", gap: 8, alignContent: "start" }}
    >
      <div className="crm-section-head" style={{ marginBottom: 4 }}>
        <h2 className="crm-section-title">{title}</h2>
        <span className={chipClass ?? "crm-chip"}>{count}</span>
      </div>
      {count === 0 ? (
        <div style={{ padding: "12px 0", color: "var(--ink-muted)", fontSize: 13 }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>{children}</div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PrioritiesPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedToday, setCompletedToday] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [doneReminders, setDoneReminders] = useState<Reminder[]>([]);
  const [staleDeals, setStaleDeals] = useState<StaleDeal[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [markingTask, setMarkingTask] = useState<string | null>(null);
  const [markingReminder, setMarkingReminder] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, remRes, dealsRes, leadsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/tasks/reminders"),
        fetch("/api/tasks/stale-deals"),
        fetch("/api/tasks/leads-search"),
      ]);
      const [tasksData, remData, dealsData, leadsData] = await Promise.all([
        tasksRes.json() as Promise<{ open?: Task[]; completed_today?: Task[] }>,
        remRes.json() as Promise<{ reminders?: Reminder[] }>,
        dealsRes.json() as Promise<{ deals?: StaleDeal[] }>,
        leadsRes.json() as Promise<{ leads?: LeadOption[] }>,
      ]);
      setTasks(tasksData.open ?? []);
      setCompletedToday(tasksData.completed_today ?? []);
      setReminders(remData.reminders ?? []);
      setStaleDeals(dealsData.deals ?? []);
      setLeads(leadsData.leads ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Mark task done
  const markTaskDone = async (taskId: string) => {
    setMarkingTask(taskId);
    setActionError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setActionError(data.error ?? "Could not mark task done. Try again.");
        return;
      }
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (task) setCompletedToday((c) => [{ ...task, status: "done", completed_at: new Date().toISOString() }, ...c]);
        return prev.filter((t) => t.id !== taskId);
      });
    } catch {
      setActionError("Could not mark task done. Check your connection and try again.");
    } finally {
      setMarkingTask(null);
    }
  };

  // Mark reminder done
  const markReminderDone = async (reminderId: string) => {
    setMarkingReminder(reminderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setActionError(data.error ?? "Could not dismiss reminder. Try again.");
        return;
      }
      setReminders((prev) => {
        const rem = prev.find((r) => r.id === reminderId);
        if (rem) setDoneReminders((d) => [{ ...rem, status: "done" }, ...d]);
        return prev.filter((r) => r.id !== reminderId);
      });
    } catch {
      setActionError("Could not dismiss reminder. Check your connection and try again.");
    } finally {
      setMarkingReminder(null);
    }
  };

  // Add new task
  const addTask = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };

  // Derive columns
  // Due Now: urgent/high tasks + overdue/today reminders
  const dueNowTasks = tasks.filter((t) => t.priority === "urgent" || t.priority === "high");
  const dueNowReminders = reminders.filter((r) => isOverdue(r.due_at) || isDueToday(r.due_at));
  const dueNowCount = dueNowTasks.length + dueNowReminders.length;

  // Upcoming: medium/low tasks + reminders this week that are NOT overdue/today
  const upcomingTasks = tasks.filter((t) => t.priority === "medium" || t.priority === "low");
  const upcomingReminders = reminders.filter((r) => !isOverdue(r.due_at) && !isDueToday(r.due_at) && isThisWeek(r.due_at));
  const upcomingCount = upcomingTasks.length + upcomingReminders.length;

  // Reminders This Week: pending reminders not already shown in Due Now
  const dueNowReminderIds = new Set(dueNowReminders.map((r) => r.id));
  const remindersThisWeek = reminders.filter((r) => !dueNowReminderIds.has(r.id));

  if (loading) {
    return (
      <main className="crm-page crm-page-wide crm-stack-12">
        <p style={{ color: "var(--ink-muted)", padding: 16 }}>Loading tasks…</p>
      </main>
    );
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Off-Market</p>
            <h1 className="crm-page-title">Deal task queue</h1>
            <p className="crm-page-subtitle">
              Keep task work tied to deals: due now first, stale opportunities next, then the items that can wait.
            </p>
          </div>
          <div className="crm-page-actions">
            <button className="crm-btn crm-btn-primary" onClick={() => setShowModal(true)}>
              + Add Task
            </button>
            <Link href="/app/deals" className="crm-btn crm-btn-secondary">
              Open deals
            </Link>
          </div>
        </div>
      </section>

      {actionError ? (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
          {actionError}
          <button onClick={() => setActionError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 600 }}>Dismiss</button>
        </div>
      ) : null}

      {/* Four columns — responsive grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Column 1: Due Now */}
        <Column
          title="Due Now"
          count={dueNowCount}
          chipClass="crm-chip crm-chip-danger"
          empty="Nothing urgent right now."
        >
          {dueNowTasks.map((t) => (
            <TaskCard key={t.id} task={t} onDone={(id) => void markTaskDone(id)} marking={markingTask === t.id} />
          ))}
          {dueNowReminders.map((r) => (
            <ReminderCard key={r.id} reminder={r} onDone={(id) => void markReminderDone(id)} marking={markingReminder === r.id} showInColumn />
          ))}
        </Column>

        {/* Column 2: Update This Deal */}
        <Column
          title="Update This Deal"
          count={staleDeals.length}
          chipClass="crm-chip crm-chip-warn"
          empty="No stale deals right now."
        >
          {staleDeals.map((deal) => (
            <div
              key={deal.id}
              style={{
                background: "var(--surface, #fff)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-body)" }}>
                {deal.property_address ?? "Deal needs context"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {deal.stage && (
                  <span style={{ fontSize: 11, background: "#f3f4f6", color: "#374151", borderRadius: 4, padding: "1px 6px" }}>
                    {prettyStage(deal.stage)}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  No activity in 7+ days
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5 }}>
                This deal likely needs a quick update or follow-up to keep momentum.
              </div>
              <Link href="/app/pipeline" style={{ fontSize: 12, color: "var(--ink-primary)", textDecoration: "none" }}>
                Open pipeline →
              </Link>
            </div>
          ))}
        </Column>

        {/* Column 3: Upcoming */}
        <Column
          title="Upcoming"
          count={upcomingCount}
          chipClass="crm-chip"
          empty="No lower-priority follow-ups at the moment."
        >
          {upcomingTasks.map((t) => (
            <TaskCard key={t.id} task={t} onDone={(id) => void markTaskDone(id)} marking={markingTask === t.id} />
          ))}
          {upcomingReminders.map((r) => (
            <ReminderCard key={r.id} reminder={r} onDone={(id) => void markReminderDone(id)} marking={markingReminder === r.id} showInColumn />
          ))}
        </Column>

        {/* Column 4: Reminders This Week */}
        <Column
          title="Reminders This Week"
          count={remindersThisWeek.length}
          chipClass="crm-chip"
          empty="No reminders due this week."
        >
          {remindersThisWeek.map((r) => (
            <ReminderCard key={r.id} reminder={r} onDone={(id) => void markReminderDone(id)} marking={markingReminder === r.id} />
          ))}
        </Column>
      </div>

      {/* Completed Today */}
      <CompletedToday tasks={completedToday} reminders={doneReminders} />

      {/* Add Task Modal */}
      {showModal && (
        <AddTaskModal
          leads={leads}
          onClose={() => setShowModal(false)}
          onAdd={addTask}
        />
      )}
    </main>
  );
}
