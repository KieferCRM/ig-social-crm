"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import {
  type Appointment,
  type AppointmentType,
  type AppointmentStatus,
  appointmentStatusTone,
  formatAppointmentTime,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/appointments";
import type { DealFollowup, CalendarTask } from "@/lib/appointments";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledBlast = { id: string; tag: string; message: string; scheduled_at: string };

type GoogleEvent = { id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink: string; location: string | null };

type CalendarEvent =
  | { type: "appointment"; id: string; title: string; time: string; raw: Appointment }
  | { type: "followup"; id: string; title: string; raw: DealFollowup }
  | { type: "task"; id: string; title: string; raw: CalendarTask }
  | { type: "blast"; id: string; title: string; time: string; raw: ScheduledBlast }
  | { type: "google"; id: string; title: string; time: string; raw: GoogleEvent };

type AppointmentResponse = { appointment?: Appointment; error?: string };
type AppointmentsResponse = { appointments?: Appointment[]; error?: string };

type Draft = {
  title: string;
  scheduled_at: string;
  duration_minutes: string;
  appointment_type: AppointmentType;
  location: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  scheduled_at: "",
  duration_minutes: "30",
  appointment_type: "call",
  location: "",
  notes: "",
};

// ─── Color scheme ─────────────────────────────────────────────────────────────

const EVENT_COLOR: Record<CalendarEvent["type"], string> = {
  appointment: "#2563eb",
  followup: "#ea580c",
  task: "#7c3aed",
  blast: "#15803d",
  google: "#db4437",
};

const EVENT_BG: Record<CalendarEvent["type"], string> = {
  appointment: "#dbeafe",
  followup: "#ffedd5",
  task: "#ede9fe",
  blast: "#dcfce7",
  google: "#fce8e6",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

function buildEventMap(
  appointments: Appointment[],
  followups: DealFollowup[],
  tasks: CalendarTask[],
  blasts: ScheduledBlast[]
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  const add = (dateStr: string, event: CalendarEvent) => {
    const list = map.get(dateStr) ?? [];
    list.push(event);
    map.set(dateStr, list);
  };

  for (const appt of appointments) {
    if (appt.status === "cancelled") continue;
    const dateStr = appt.scheduled_at.split("T")[0];
    add(dateStr, {
      type: "appointment",
      id: appt.id,
      title: appt.title,
      time: formatAppointmentTime(appt.scheduled_at),
      raw: appt,
    });
  }

  for (const deal of followups) {
    add(deal.next_followup_date, {
      type: "followup",
      id: deal.id,
      title: deal.property_address ?? deal.lead?.full_name ?? "Follow-up",
      raw: deal,
    });
  }

  for (const task of tasks) {
    if (!task.due_at) continue;
    const dateStr = task.due_at.split("T")[0];
    add(dateStr, {
      type: "task",
      id: task.id,
      title: task.title,
      raw: task,
    });
  }

  for (const blast of blasts) {
    const dateStr = blast.scheduled_at.split("T")[0];
    add(dateStr, {
      type: "blast",
      id: blast.id,
      title: `Blast: ${blast.tag}`,
      time: formatAppointmentTime(blast.scheduled_at),
      raw: blast,
    });
  }

  return map;
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(local: string): string {
  return new Date(local).toISOString();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarClient({
  initialAppointments,
  initialFollowups,
  initialTasks,
  initialBlasts,
}: {
  initialAppointments: Appointment[];
  initialFollowups: DealFollowup[];
  initialTasks: CalendarTask[];
  initialBlasts: ScheduledBlast[];
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [appointments, setAppointments] = useState(initialAppointments);

  // Google Calendar state
  const searchParams = useSearchParams();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState("");
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);

  useEffect(() => {
    const err = searchParams.get("google_error");
    const connected = searchParams.get("google_connected");
    if (err) setGoogleError(`Google Calendar error: ${err}`);
    if (connected) setGoogleError("");

    async function loadGoogleEvents() {
      setGoogleLoading(true);
      try {
        const timeMin = new Date(viewYear, viewMonth, 1).toISOString();
        const timeMax = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
        const res = await fetch(`/api/calendar/google?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`);
        const data = await res.json() as { connected?: boolean; connected_email?: string; events?: GoogleEvent[]; error?: string };
        setGoogleConnected(data.connected ?? false);
        setGoogleEmail(data.connected_email ?? "");
        setGoogleEvents(data.events ?? []);
        if (data.error) setGoogleError(data.error);
      } catch {
        setGoogleError("Could not load Google Calendar.");
      } finally {
        setGoogleLoading(false);
      }
    }
    void loadGoogleEvents();
  }, [searchParams, viewYear, viewMonth]);

  async function handleGoogleDisconnect() {
    if (!window.confirm("Disconnect Google Calendar?")) return;
    setGoogleDisconnecting(true);
    await fetch("/api/auth/google/disconnect", { method: "POST" });
    setGoogleConnected(false);
    setGoogleEmail("");
    setGoogleEvents([]);
    setGoogleDisconnecting(false);
  }

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit modal
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const selectedAppt = appointments.find((a) => a.id === selectedApptId) ?? null;

  const baseEventMap = buildEventMap(appointments, initialFollowups, initialTasks, initialBlasts);

  // Merge Google Calendar events into the map
  const eventMap = new Map(baseEventMap);
  for (const ge of googleEvents) {
    const dateStr = ge.start.split("T")[0] ?? ge.start.slice(0, 10);
    if (!dateStr) continue;
    const timeLabel = ge.allDay ? "All day" : new Date(ge.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const list = eventMap.get(dateStr) ?? [];
    list.push({ type: "google", id: ge.id, title: ge.summary, time: timeLabel, raw: ge });
    eventMap.set(dateStr, list);
  }

  const today = todayStr();

  // ─── Month grid ─────────────────────────────────────────────────────────────

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ─── Appointment actions ─────────────────────────────────────────────────────

  function openAdd(dateStr?: string) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const defaultTime = dateStr
      ? `${dateStr}T09:00`
      : `${today}T09:00`;
    setDraft({ ...EMPTY_DRAFT, scheduled_at: defaultTime });
    setAddDate(dateStr ?? "");
    setError("");
    setIsAddOpen(true);
  }

  async function handleAdd() {
    if (!draft.title.trim()) { setError("Title is required."); return; }
    if (!draft.scheduled_at) { setError("Date and time required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          scheduled_at: fromLocalDatetimeInput(draft.scheduled_at),
          duration_minutes: parseInt(draft.duration_minutes, 10) || 30,
          appointment_type: draft.appointment_type,
          location: draft.location.trim() || null,
          notes: draft.notes.trim() || null,
        }),
      });
      const data = (await res.json()) as AppointmentResponse;
      if (!res.ok || !data.appointment) { setError(data.error ?? "Could not save."); return; }
      setAppointments(prev => [...prev, data.appointment!]);
      setIsAddOpen(false);
      setDraft(EMPTY_DRAFT);
    } catch { setError("Could not save appointment."); }
    finally { setSaving(false); }
  }

  function openEdit(appt: Appointment) {
    setSelectedApptId(appt.id);
    setEditDraft({
      title: appt.title,
      scheduled_at: toLocalDatetimeInput(appt.scheduled_at),
      duration_minutes: String(appt.duration_minutes),
      appointment_type: appt.appointment_type,
      location: appt.location ?? "",
      notes: appt.notes ?? "",
    });
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!selectedAppt || !editDraft) return;
    if (!editDraft.title.trim()) { setEditError("Title is required."); return; }
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/appointments/${selectedAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editDraft.title.trim(),
          scheduled_at: editDraft.scheduled_at ? fromLocalDatetimeInput(editDraft.scheduled_at) : undefined,
          duration_minutes: parseInt(editDraft.duration_minutes, 10) || 30,
          appointment_type: editDraft.appointment_type,
          location: editDraft.location.trim() || null,
          notes: editDraft.notes.trim() || null,
        }),
      });
      const data = (await res.json()) as AppointmentResponse;
      if (!res.ok || !data.appointment) { setEditError(data.error ?? "Could not save."); return; }
      setAppointments(prev => prev.map(a => a.id === selectedAppt.id ? data.appointment! : a));
      setSelectedApptId(null);
    } catch { setEditError("Could not save."); }
    finally { setEditSaving(false); }
  }

  async function handleStatusChange(status: AppointmentStatus) {
    if (!selectedAppt) return;
    const res = await fetch(`/api/appointments/${selectedAppt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res.json()) as AppointmentResponse;
    if (res.ok && data.appointment) {
      setAppointments(prev => prev.map(a => a.id === selectedAppt.id ? data.appointment! : a));
      setSelectedApptId(null);
    }
  }

  async function handleDelete() {
    if (!selectedAppt) return;
    if (!window.confirm("Delete this appointment?")) return;
    await fetch(`/api/appointments/${selectedAppt.id}`, { method: "DELETE" });
    setAppointments(prev => prev.filter(a => a.id !== selectedAppt.id));
    setSelectedApptId(null);
  }

  async function reload() {
    const res = await fetch("/api/appointments");
    const data = (await res.json()) as AppointmentsResponse;
    if (data.appointments) setAppointments(data.appointments);
  }

  // ─── Selected day events ──────────────────────────────────────────────────

  const dayEvents = selectedDate ? (eventMap.get(selectedDate) ?? []) : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={prevMonth} style={{ padding: "4px 10px" }}>←</button>
            <div style={{ fontWeight: 700, fontSize: 18, minWidth: 180, textAlign: "center" }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={nextMonth} style={{ padding: "4px 10px" }}>→</button>
            <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}
              onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}>
              Today
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Google Calendar connect/disconnect */}
            {googleLoading ? (
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Loading…</span>
            ) : googleConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                  {googleEmail || "Google Calendar"}
                </span>
                <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}
                  onClick={() => void handleGoogleDisconnect()} disabled={googleDisconnecting}>
                  {googleDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <a href="/api/auth/google/authorize" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Calendar
              </a>
            )}
            {googleError && (
              <span style={{ fontSize: 12, color: "var(--danger)" }}>{googleError}</span>
            )}
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void reload()}>Refresh</button>
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => openAdd()}>+ Add Appointment</button>
          </div>
        </div>
      </section>

      {/* Calendar grid */}
      <section className="crm-card crm-section-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div key={`empty-${idx}`} style={{
                  minHeight: 100,
                  borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--border)" : undefined,
                  borderBottom: idx < cells.length - 7 ? "1px solid var(--border)" : undefined,
                  background: "var(--surface-subtle, #fafafa)",
                }} />
              );
            }

            const dateStr = toDateStr(viewYear, viewMonth, day);
            const events = eventMap.get(dateStr) ?? [];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const MAX_SHOW = 3;
            const overflow = events.length - MAX_SHOW;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  minHeight: 100,
                  padding: "6px 6px 4px",
                  cursor: "pointer",
                  borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--border)" : undefined,
                  borderBottom: idx < cells.length - 7 ? "1px solid var(--border)" : undefined,
                  background: isSelected ? "var(--surface-hover, #f0f4ff)" : undefined,
                  transition: "background 0.1s",
                }}
              >
                {/* Day number */}
                <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? "#fff" : "var(--ink-base)",
                    background: isToday ? "#2563eb" : undefined,
                    borderRadius: isToday ? "50%" : undefined,
                    width: isToday ? 22 : undefined,
                    height: isToday ? 22 : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {day}
                  </span>
                  {events.length > 0 && (
                    <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>{events.length}</span>
                  )}
                </div>

                {/* Event chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {events.slice(0, MAX_SHOW).map(ev => (
                    <div
                      key={`${ev.type}-${ev.id}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        background: EVENT_BG[ev.type],
                        color: EVENT_COLOR[ev.type],
                        borderRadius: 4,
                        padding: "1px 5px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        borderLeft: `3px solid ${EVENT_COLOR[ev.type]}`,
                      }}
                    >
                      {ev.type === "appointment" ? `${ev.time} ${ev.title}` : ev.title}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div style={{ fontSize: 10, color: "var(--ink-muted)", paddingLeft: 4 }}>
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Day panel */}
      {selectedDate && (
        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="crm-section-title" style={{ margin: 0 }}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="crm-btn crm-btn-primary" style={{ fontSize: 12 }} onClick={() => openAdd(selectedDate)}>
                + Add Appointment
              </button>
              <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }} onClick={() => setSelectedDate(null)}>
                Close
              </button>
            </div>
          </div>

          {dayEvents.length === 0 ? (
            <div style={{ color: "var(--ink-muted)", fontSize: 13, padding: "8px 0" }}>No events on this day.</div>
          ) : (
            <div className="crm-stack-6">
              {dayEvents.map(ev => (
                <DayEventRow key={`${ev.type}-${ev.id}`} event={ev} onOpenAppt={openEdit} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add modal */}
      {isAddOpen && (
        <div className="crm-modal-backdrop" onClick={() => { if (!saving) setIsAddOpen(false); }}>
          <section className="crm-card crm-deal-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-section-head">
              <h2 className="crm-section-title">Add Appointment</h2>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</button>
            </div>
            <AppointmentForm draft={draft} onChange={setDraft} />
            {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleAdd()} disabled={saving}>
                {saving ? "Saving..." : "Save Appointment"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Edit modal */}
      {selectedAppt && editDraft && (
        <div className="crm-modal-backdrop" onClick={() => { if (!editSaving) setSelectedApptId(null); }}>
          <section className="crm-card crm-deal-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-section-head">
              <h2 className="crm-section-title">Edit Appointment</h2>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setSelectedApptId(null)} disabled={editSaving}>Cancel</button>
            </div>
            <AppointmentForm draft={editDraft} onChange={setEditDraft} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6 }}>Mark as</div>
              <div className="crm-inline-actions">
                {(["confirmed", "completed", "cancelled", "no_show"] as AppointmentStatus[]).map(s => (
                  <button key={s} type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }}
                    onClick={() => void handleStatusChange(s)} disabled={editSaving || selectedAppt.status === s}>
                    {APPOINTMENT_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {editError && <div style={{ color: "var(--danger)", fontSize: 13 }}>{editError}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="crm-btn crm-btn-secondary" style={{ color: "var(--danger)" }} onClick={() => void handleDelete()} disabled={editSaving}>Delete</button>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleSaveEdit()} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Day event row ─────────────────────────────────────────────────────────────

function DayEventRow({ event, onOpenAppt }: { event: CalendarEvent; onOpenAppt: (a: Appointment) => void }) {
  const color = EVENT_COLOR[event.type];
  const bg = EVENT_BG[event.type];

  if (event.type === "appointment") {
    const appt = event.raw;
    return (
      <div
        className="crm-card-muted"
        onClick={() => onOpenAppt(appt)}
        style={{ padding: 12, cursor: "pointer", borderLeft: `4px solid ${color}`, background: bg }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{appt.title}</div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
              {event.time}{appt.duration_minutes ? ` · ${appt.duration_minutes}min` : ""}{appt.location ? ` · ${appt.location}` : ""}
            </div>
          </div>
          <StatusBadge label={APPOINTMENT_STATUS_LABELS[appt.status] ?? appt.status} tone={appointmentStatusTone(appt.status)} />
        </div>
      </div>
    );
  }

  if (event.type === "followup") {
    const deal = event.raw;
    return (
      <div className="crm-card-muted" style={{ padding: 12, borderLeft: `4px solid ${color}`, background: bg }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{event.title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
          Follow-up due · {deal.stage.replace("_", " ")}
          {deal.lead?.full_name ? ` · ${deal.lead.full_name}` : ""}
        </div>
      </div>
    );
  }

  if (event.type === "blast") {
    const blast = event.raw;
    return (
      <div className="crm-card-muted" style={{ padding: 12, borderLeft: `4px solid ${color}`, background: bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Broadcast · {blast.tag}</div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>{event.time} · {blast.message.slice(0, 80)}{blast.message.length > 80 ? "…" : ""}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#15803d", borderRadius: 4, padding: "2px 7px", alignSelf: "flex-start" }}>SCHEDULED</span>
        </div>
      </div>
    );
  }

  if (event.type === "google") {
    const ge = event.raw;
    return (
      <a
        href={ge.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className="crm-card-muted"
        style={{ padding: 12, borderLeft: `4px solid ${color}`, background: bg, display: "block", textDecoration: "none" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{ge.summary}</div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
              {event.time}{ge.location ? ` · ${ge.location}` : ""}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: "#fce8e6", color: "#db4437", borderRadius: 4, padding: "2px 7px", alignSelf: "flex-start", flexShrink: 0 }}>GOOGLE</span>
        </div>
      </a>
    );
  }

  // task
  return (
    <div className="crm-card-muted" style={{ padding: 12, borderLeft: `4px solid ${color}`, background: bg }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{event.title}</div>
      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>Task due</div>
    </div>
  );
}

// ─── Appointment form ─────────────────────────────────────────────────────────

function AppointmentForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="crm-two-column-form">
      <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
        <span>Title *</span>
        <input value={draft.title} placeholder="e.g. Call with Sarah Johnson"
          onChange={e => onChange({ ...draft, title: e.target.value })} />
      </label>
      <label className="crm-filter-field">
        <span>Date & Time *</span>
        <input type="datetime-local" value={draft.scheduled_at}
          onChange={e => onChange({ ...draft, scheduled_at: e.target.value })} />
      </label>
      <label className="crm-filter-field">
        <span>Duration (minutes)</span>
        <select value={draft.duration_minutes} onChange={e => onChange({ ...draft, duration_minutes: e.target.value })}>
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
      </label>
      <label className="crm-filter-field">
        <span>Type</span>
        <select value={draft.appointment_type} onChange={e => onChange({ ...draft, appointment_type: e.target.value as AppointmentType })}>
          {Object.entries(APPOINTMENT_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </label>
      <label className="crm-filter-field">
        <span>Location</span>
        <input value={draft.location} placeholder="Address or video link"
          onChange={e => onChange({ ...draft, location: e.target.value })} />
      </label>
      <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
        <span>Notes</span>
        <textarea rows={3} value={draft.notes} placeholder="Anything to note"
          onChange={e => onChange({ ...draft, notes: e.target.value })} />
      </label>
    </div>
  );
}
