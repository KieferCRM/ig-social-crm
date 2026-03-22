"use client";

import { useState } from "react";
import StatusBadge from "@/components/ui/status-badge";
import {
  type Appointment,
  type AppointmentType,
  type AppointmentStatus,
  appointmentTypeLabel,
  appointmentStatusTone,
  formatAppointmentTime,
  formatAppointmentDate,
  groupByDate,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/appointments";

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

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

export default function CalendarClient({ initial }: { initial: Appointment[] }) {
  const [appointments, setAppointments] = useState<Appointment[]>(initial);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const now = new Date().toISOString();
  const upcoming = appointments.filter((a) => a.scheduled_at >= now && a.status !== "cancelled");
  const past = appointments.filter((a) => a.scheduled_at < now || a.status === "cancelled" || a.status === "completed");

  const upcomingGroups = groupByDate(upcoming);
  const pastGroups = groupByDate(past).reverse(); // most recent first

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
      setAppointments((prev) => [...prev, data.appointment!]);
      setIsAddOpen(false);
      setDraft(EMPTY_DRAFT);
    } catch { setError("Could not save appointment."); }
    finally { setSaving(false); }
  }

  function openEdit(appt: Appointment) {
    setSelectedId(appt.id);
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
    if (!selected || !editDraft) return;
    if (!editDraft.title.trim()) { setEditError("Title is required."); return; }
    setEditSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/appointments/${selected.id}`, {
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
      setAppointments((prev) => prev.map((a) => a.id === selected.id ? data.appointment! : a));
      setSelectedId(null);
    } catch { setEditError("Could not save."); }
    finally { setEditSaving(false); }
  }

  async function handleStatusChange(status: AppointmentStatus) {
    if (!selected) return;
    const res = await fetch(`/api/appointments/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res.json()) as AppointmentResponse;
    if (res.ok && data.appointment) {
      setAppointments((prev) => prev.map((a) => a.id === selected.id ? data.appointment! : a));
      setSelectedId(null);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm("Delete this appointment?")) return;
    await fetch(`/api/appointments/${selected.id}`, { method: "DELETE" });
    setAppointments((prev) => prev.filter((a) => a.id !== selected.id));
    setSelectedId(null);
  }

  // Reload from server
  async function reload() {
    const res = await fetch("/api/appointments");
    const data = (await res.json()) as AppointmentsResponse;
    if (data.appointments) setAppointments(data.appointments);
  }

  return (
    <div className="crm-stack-12">
      {/* Header */}
      <section className="crm-card crm-section-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="crm-page-kicker">PA Assistant</p>
            <h1 className="crm-page-title" style={{ margin: 0 }}>Calendar</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void reload()}>
              Refresh
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => { setDraft(EMPTY_DRAFT); setError(""); setIsAddOpen(true); }}
            >
              + Add Appointment
            </button>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section className="crm-card crm-section-card crm-stack-10">
        <h2 className="crm-section-title">Upcoming</h2>
        {upcomingGroups.length === 0 ? (
          <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
            No upcoming appointments. Add one above or the PA will schedule them automatically.
          </div>
        ) : (
          <div className="crm-stack-12">
            {upcomingGroups.map((group) => (
              <div key={group.date}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {group.label}
                </div>
                <div className="crm-stack-6">
                  {group.items.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onClick={() => openEdit(appt)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past / completed */}
      {pastGroups.length > 0 ? (
        <section className="crm-card crm-section-card crm-stack-10">
          <h2 className="crm-section-title" style={{ color: "var(--ink-muted)" }}>Past</h2>
          <div className="crm-stack-12">
            {pastGroups.slice(0, 3).map((group) => (
              <div key={group.date}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {group.label}
                </div>
                <div className="crm-stack-6">
                  {group.items.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onClick={() => openEdit(appt)}
                      muted
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Add modal */}
      {isAddOpen ? (
        <div className="crm-modal-backdrop" onClick={() => { if (!saving) setIsAddOpen(false); }}>
          <section className="crm-card crm-deal-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crm-section-head">
              <h2 className="crm-section-title">Add Appointment</h2>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</button>
            </div>
            <AppointmentForm draft={draft} onChange={setDraft} />
            {error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleAdd()} disabled={saving}>
                {saving ? "Saving..." : "Save Appointment"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* Edit modal */}
      {selected && editDraft ? (
        <div className="crm-modal-backdrop" onClick={() => { if (!editSaving) setSelectedId(null); }}>
          <section className="crm-card crm-deal-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crm-section-head">
              <h2 className="crm-section-title">Edit Appointment</h2>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setSelectedId(null)} disabled={editSaving}>Cancel</button>
            </div>

            <AppointmentForm draft={editDraft} onChange={setEditDraft} />

            {/* Status actions */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6 }}>Mark as</div>
              <div className="crm-inline-actions">
                {(["confirmed", "completed", "cancelled", "no_show"] as AppointmentStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    style={{ fontSize: 12 }}
                    onClick={() => void handleStatusChange(s)}
                    disabled={editSaving || selected.status === s}
                  >
                    {APPOINTMENT_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {editError ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{editError}</div> : null}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="crm-btn crm-btn-secondary" style={{ color: "var(--danger)" }} onClick={() => void handleDelete()} disabled={editSaving}>
                Delete
              </button>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleSaveEdit()} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AppointmentCard({ appt, onClick, muted }: { appt: Appointment; onClick: () => void; muted?: boolean }) {
  const context = appt.deal?.property_address ?? appt.lead?.full_name ?? null;
  return (
    <div
      className="crm-card-muted"
      onClick={onClick}
      style={{ padding: 14, cursor: "pointer", opacity: muted ? 0.7 : 1 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{appt.title}</div>
          {context ? <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>{context}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <StatusBadge label={appointmentTypeLabel(appt.appointment_type)} tone="default" />
          <StatusBadge label={APPOINTMENT_STATUS_LABELS[appt.status as keyof typeof APPOINTMENT_STATUS_LABELS] ?? appt.status} tone={appointmentStatusTone(appt.status)} />
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-muted)" }}>
        {formatAppointmentDate(appt.scheduled_at)} · {formatAppointmentTime(appt.scheduled_at)}
        {appt.duration_minutes ? ` · ${appt.duration_minutes}min` : ""}
        {appt.location ? ` · ${appt.location}` : ""}
      </div>
    </div>
  );
}

function AppointmentForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="crm-two-column-form">
      <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
        <span>Title *</span>
        <input
          value={draft.title}
          placeholder="e.g. Call with Sarah Johnson"
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="crm-filter-field">
        <span>Date & Time *</span>
        <input
          type="datetime-local"
          value={draft.scheduled_at}
          onChange={(e) => onChange({ ...draft, scheduled_at: e.target.value })}
        />
      </label>
      <label className="crm-filter-field">
        <span>Duration (minutes)</span>
        <select value={draft.duration_minutes} onChange={(e) => onChange({ ...draft, duration_minutes: e.target.value })}>
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
        <select value={draft.appointment_type} onChange={(e) => onChange({ ...draft, appointment_type: e.target.value as AppointmentType })}>
          {Object.entries(APPOINTMENT_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </label>
      <label className="crm-filter-field">
        <span>Location</span>
        <input
          value={draft.location}
          placeholder="Address or video link"
          onChange={(e) => onChange({ ...draft, location: e.target.value })}
        />
      </label>
      <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
        <span>Notes</span>
        <textarea
          rows={3}
          value={draft.notes}
          placeholder="Anything the PA should know before the appointment"
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
      </label>
    </div>
  );
}
