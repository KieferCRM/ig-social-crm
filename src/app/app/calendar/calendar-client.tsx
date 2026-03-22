"use client";

import { useState } from "react";
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
import type { DealFollowup, CalendarTask } from "./page";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent =
  | { type: "appointment"; id: string; title: string; time: string; raw: Appointment }
  | { type: "followup"; id: string; title: string; raw: DealFollowup }
  | { type: "task"; id: string; title: string; raw: CalendarTask };

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
};

const EVENT_BG: Record<CalendarEvent["type"], string> = {
  appointment: "#dbeafe",
  followup: "#ffedd5",
  task: "#ede9fe",
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
  tasks: CalendarTask[]
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
}: {
  initialAppointments: Appointment[];
  initialFollowups: DealFollowup[];
  initialTasks: CalendarTask[];
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [appointments, setAppointments] = useState(initialAppointments);

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

  const eventMap = buildEventMap(appointments, initialFollowups, initialTasks);
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
            {/* Legend */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginRight: 8 }}>
              {(["appointment", "followup", "task"] as CalendarEvent["type"][]).map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: EVENT_COLOR[t], display: "inline-block" }} />
                  {t === "appointment" ? "Appointments" : t === "followup" ? "Follow-ups" : "Tasks"}
                </div>
              ))}
            </div>
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
