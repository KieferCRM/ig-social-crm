export type AppointmentType = "call" | "showing" | "consultation" | "walkthrough" | "other";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export type Appointment = {
  id: string;
  agent_id: string;
  lead_id: string | null;
  deal_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  confirmed_by_lead: boolean;
  lead_reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  lead?: { full_name: string | null; canonical_phone: string | null } | null;
  deal?: { property_address: string | null } | null;
};

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  call:         "Phone Call",
  showing:      "Property Showing",
  consultation: "Consultation",
  walkthrough:  "Walkthrough",
  other:        "Other",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled:  "Scheduled",
  confirmed:  "Confirmed",
  completed:  "Completed",
  cancelled:  "Cancelled",
  no_show:    "No Show",
};

export function appointmentTypeLabel(type: string): string {
  return APPOINTMENT_TYPE_LABELS[type as AppointmentType] ?? type;
}

export function appointmentStatusTone(status: string): string {
  switch (status) {
    case "confirmed":  return "ok";
    case "completed":  return "stage-closed";
    case "cancelled":  return "danger";
    case "no_show":    return "warn";
    default:           return "default";
  }
}

export function formatAppointmentTime(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return scheduledAt;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatAppointmentDate(scheduledAt: string): string {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return scheduledAt;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function isUpcoming(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() > Date.now();
}

// Group appointments by date string (YYYY-MM-DD in local time)
export function groupByDate(
  appointments: Appointment[]
): Array<{ date: string; label: string; items: Appointment[] }> {
  const map = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at);
    const key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const existing = map.get(key) ?? [];
    existing.push(appt);
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      label: new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      items: items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    }));
}
