"use client";

import { useState } from "react";

type WeekAppointment = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  lead: { full_name: string | null } | null;
  deal: { property_address: string | null } | null;
};

type WeekStripProps = {
  startDate: string; // YYYY-MM-DD — today in agent timezone
  appointmentDates: string[]; // YYYY-MM-DD[]
  followupDates: string[]; // YYYY-MM-DD[]
  taskDates: string[]; // YYYY-MM-DD[]
  appointments?: WeekAppointment[];
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const eLabel = e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${sLabel} – ${eLabel}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatFullDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

const HEAT_COLORS = {
  0: "transparent",
  1: "#bfdbfe",
  2: "#fde68a",
  3: "#fca5a5",
};

const HEAT_TEXT = {
  0: "var(--ink-faint)",
  1: "#1d4ed8",
  2: "#92400e",
  3: "#b91c1c",
};

export default function WeekStrip({ startDate, appointmentDates, followupDates, taskDates, appointments = [] }: WeekStripProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = addDays(startDate, weekOffset * 7);
  const weekEnd = addDays(startDate, weekOffset * 7 + 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, weekOffset * 7 + i));

  const apptSet = appointmentDates.reduce<Record<string, number>>((acc, d) => {
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  const followupSet = followupDates.reduce<Record<string, number>>((acc, d) => {
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  const taskSet = taskDates.reduce<Record<string, number>>((acc, d) => {
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  const dayAppointments = selectedDay
    ? appointments.filter((a) =>
        new Date(a.scheduled_at).toLocaleDateString("en-CA") === selectedDay
      )
    : [];

  const followupCount = selectedDay ? (followupSet[selectedDay] ?? 0) : 0;
  const taskCount = selectedDay ? (taskSet[selectedDay] ?? 0) : 0;

  return (
    <>
      <article className="crm-card crm-section-card crm-stack-10">
        {/* Nav controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
            className="crm-btn crm-btn-secondary"
            style={{ fontSize: 13, opacity: weekOffset === 0 ? 0.4 : 1 }}
          >
            ← Prev
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {formatWeekRange(weekStart, weekEnd)}
            </span>
            {weekOffset > 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 12 }}
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset((o) => Math.min(7, o + 1))}
            disabled={weekOffset === 7}
            className="crm-btn crm-btn-secondary"
            style={{ fontSize: 13, opacity: weekOffset === 7 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>

        {/* Day tiles */}
        <div style={{ display: "flex", gap: 6 }}>
          {days.map((day) => {
            const isToday = day === startDate;
            const appts = apptSet[day] ?? 0;
            const followups = followupSet[day] ?? 0;
            const tasks = taskSet[day] ?? 0;
            const total = appts + followups + tasks;
            const level = heatLevel(total);

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: isToday ? "var(--brand-faint, #eff6ff)" : "var(--surface-2)",
                  border: isToday ? "1.5px solid var(--brand)" : "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  padding: "10px 6px 6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 72,
                }}
              >
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isToday ? "var(--brand)" : "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  {formatDayName(day)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                  {formatMonthDay(day)}
                </div>
                {total > 0 ? (
                  <div style={{ fontSize: 16, fontWeight: 800, color: HEAT_TEXT[level], marginTop: 2, lineHeight: 1 }}>
                    {total}
                  </div>
                ) : (
                  <div style={{ height: 19 }} />
                )}
                {/* Heat bar */}
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: HEAT_COLORS[level],
                }} />
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ink-faint)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 3, background: HEAT_COLORS[1], borderRadius: 2, display: "inline-block" }} />
            Light
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 3, background: HEAT_COLORS[2], borderRadius: 2, display: "inline-block" }} />
            Busy
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 3, background: HEAT_COLORS[3], borderRadius: 2, display: "inline-block" }} />
            Heavy
          </span>
        </div>
      </article>

      {/* Day popup modal */}
      {selectedDay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1050,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedDay(null); }}
        >
          <div
            className="crm-card"
            style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{formatFullDay(selectedDay)}</div>
                {selectedDay === startDate && (
                  <div style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600, marginTop: 2 }}>Today</div>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            {/* Appointments */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-muted)", marginBottom: 8 }}>
                Appointments ({dayAppointments.length})
              </div>
              {dayAppointments.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>None scheduled</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayAppointments.map((a) => (
                    <div key={a.id} className="crm-card-muted" style={{ padding: "10px 12px", borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 3 }}>
                        {formatTime(a.scheduled_at)}
                        {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                        {a.location ? ` · ${a.location}` : ""}
                      </div>
                      {(a.lead?.full_name ?? a.deal?.property_address) && (
                        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                          {a.lead?.full_name ?? a.deal?.property_address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-ups + tasks summary */}
            {(followupCount > 0 || taskCount > 0) && (
              <div style={{ display: "flex", gap: 10 }}>
                {followupCount > 0 && (
                  <div className="crm-card-muted" style={{ padding: "8px 12px", borderRadius: 8, flex: 1, fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{followupCount}</span> follow-up{followupCount !== 1 ? "s" : ""} due
                  </div>
                )}
                {taskCount > 0 && (
                  <div className="crm-card-muted" style={{ padding: "8px 12px", borderRadius: 8, flex: 1, fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{taskCount}</span> task{taskCount !== 1 ? "s" : ""} due
                  </div>
                )}
              </div>
            )}

            {dayAppointments.length === 0 && followupCount === 0 && taskCount === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", padding: "8px 0" }}>
                Nothing scheduled for this day.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
