"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  asInputDate,
  asInputNumber,
  calculateCommissionAmount,
  formatCurrency,
  parseDecimalValue,
  formatPercentLabel,
  parsePositiveDecimal,
} from "@/lib/deal-metrics";

type ReminderPreview = {
  id: string;
  due_at: string;
  status: "pending" | "done" | string;
  note: string | null;
};

type LeadDetail = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  contact_preference: string | null;
  next_step: string | null;
  notes: string | null;
  tags: string[] | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
  last_communication_at?: string | null;
  urgency_level?: string | null;
  urgency_score?: number | null;
  deal_price?: number | string | null;
  commission_percent?: number | string | null;
  commission_amount?: number | string | null;
  close_date?: string | null;
  created_at?: string | null;
  source_detail: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
};

type LeadDetailResponse = {
  lead?: LeadDetail;
  reminders?: ReminderPreview[];
  error?: string;
};

type LeadUpdateResponse = {
  lead?: LeadDetail;
  error?: string;
};

type LeadDetailPanelProps = {
  leadId: string | null;
  open: boolean;
  initialLead?: (Partial<LeadDetail> & { id: string }) | null;
  onClose: () => void;
};

type PrimaryIdentity = {
  label: string;
  kind: "name" | "handle" | "email" | "phone" | "fallback";
};

type DealDraft = {
  deal_price: string;
  commission_percent: string;
  commission_amount: string;
  close_date: string;
  commissionAmountManuallyEdited: boolean;
};

type LeadDraft = {
  full_name: string;
  canonical_phone: string;
  canonical_email: string;
  stage: string;
  lead_temp: string;
  notes: string;
  next_step: string;
  contact_preference: string;
};

type SaveNotice = {
  tone: "ok" | "error";
  text: string;
};

const STAGE_OPTIONS = ["New", "Contacted", "Qualified", "Closed"] as const;
const TEMP_OPTIONS = ["Cold", "Warm", "Hot"] as const;
const CONTACT_PREFERENCE_OPTIONS = ["Text", "Call", "Email"] as const;

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeEmailValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizePhoneValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function isSyntheticHandle(handle: string | null): boolean {
  if (!handle) return false;
  const value = handle.trim().toLowerCase();
  if (!value) return false;
  if (/^(import|intake|manual|event)_lead_[0-9a-f]{8}$/.test(value)) return true;
  if (/^(import|intake|manual)_[a-z0-9_]+_[0-9a-f]{8}$/.test(value)) return true;
  return false;
}

function cleanHandle(handle: string | null): string | null {
  if (!handle || isSyntheticHandle(handle)) return null;
  return `@${handle.trim().replace(/^@+/, "")}`;
}

function prettyLabel(value: string | null | undefined): string {
  const text = (value || "").trim();
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sourceDisplayLabel(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "manual") return "Direct Entry";
  if (normalized === "import") return "Imported";
  if (normalized === "intake" || normalized === "questionnaire") return "Intake Form";
  if (normalized === "fub" || normalized === "follow_up_boss" || normalized === "followupboss") {
    return "Follow Up Boss Import";
  }
  return prettyLabel(value);
}

function primaryIdentity(lead: LeadDetail): PrimaryIdentity {
  const full = firstNonEmpty(lead.full_name);
  if (full) return { label: full, kind: "name" };

  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return { label: combined, kind: "name" };

  const handle = cleanHandle(lead.ig_username);
  if (handle) return { label: handle, kind: "handle" };

  const email = firstNonEmpty(lead.canonical_email);
  if (email) return { label: email, kind: "email" };

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return { label: phone, kind: "phone" };

  return { label: "Unnamed lead", kind: "fallback" };
}

function secondaryIdentityLine(lead: LeadDetail, primaryKind: PrimaryIdentity["kind"]): string {
  const bits: string[] = [];
  const handle = cleanHandle(lead.ig_username);
  const email = firstNonEmpty(lead.canonical_email);
  const phone = firstNonEmpty(lead.canonical_phone);
  const source = sourceDisplayLabel(lead.source);

  if (handle && primaryKind !== "handle") bits.push(handle);
  if (email && primaryKind !== "email") bits.push(email);
  if (phone && primaryKind !== "phone") bits.push(phone);
  if (source) bits.push(source);

  return bits.slice(0, 3).join(" • ") || "Lead profile";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (localDigits.length !== 10) return value;
  return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
}

function stripCurrencyFormatting(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[$,\s]/g, "");
}

function formatCurrencyInput(value: string | null | undefined): string {
  const parsed = parseDecimalValue(value);
  if (parsed === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function tagsFromLead(lead: LeadDetail): string | null {
  if (Array.isArray(lead.tags) && lead.tags.length > 0) {
    return lead.tags.join(", ");
  }
  const tagText = lead.source_detail?.tags;
  if (Array.isArray(tagText) && tagText.length > 0) {
    return tagText.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join(", ");
  }
  if (typeof tagText === "string" && tagText.trim()) {
    return tagText.trim();
  }
  return null;
}

function summaryRows(lead: LeadDetail): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const stage = prettyLabel(lead.stage);
  const temp = prettyLabel(lead.lead_temp);
  const source = sourceDisplayLabel(lead.source);
  const intent = firstNonEmpty(lead.intent);
  const timeline = firstNonEmpty(lead.timeline);
  const location = firstNonEmpty(lead.location_area);
  const budget = firstNonEmpty(lead.budget_range);
  const nextStep = firstNonEmpty(lead.next_step);
  const tags = tagsFromLead(lead);

  if (stage) rows.push({ label: "Stage", value: stage });
  if (temp) rows.push({ label: "Temperature", value: temp });
  if (source) rows.push({ label: "Source", value: source });
  if (intent) rows.push({ label: "Intent", value: intent });
  if (timeline) rows.push({ label: "Timeline", value: timeline });
  if (location) rows.push({ label: "Location area", value: location });
  if (budget) rows.push({ label: "Budget range", value: budget });
  if (nextStep) rows.push({ label: "Next step", value: nextStep });
  if (tags) rows.push({ label: "Tags", value: tags });

  return rows;
}

function leadTempChipClass(leadTemp: string | null): string {
  const normalized = (leadTemp || "").trim().toLowerCase();
  if (normalized === "hot") return "crm-chip crm-chip-danger";
  if (normalized === "warm") return "crm-chip crm-chip-warn";
  return "crm-chip";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fieldLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function fieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => fieldValue(item))
      .filter((item): item is string => Boolean(item));
    if (items.length === 0) return null;
    if (items.length <= 3) return items.join(", ");
    return `${items.slice(0, 3).join(", ")} +${items.length - 3} more`;
  }

  if (typeof value === "object") {
    const record = asRecord(value);
    if (!record) return null;

    const entries = Object.entries(record)
      .map(([key, item]) => {
        const formatted = fieldValue(item);
        if (!formatted) return null;
        return `${fieldLabel(key)}: ${formatted}`;
      })
      .filter((item): item is string => Boolean(item));

    if (entries.length === 0) return null;
    if (entries.length <= 2) return entries.join(" • ");
    return `${entries.slice(0, 2).join(" • ")} +${entries.length - 2} more`;
  }

  return null;
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted" style={{ padding: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13 }}>{value}</div>
    </div>
  );
}

export default function LeadDetailPanel({ leadId, open, initialLead = null, onClose }: LeadDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [reminders, setReminders] = useState<ReminderPreview[]>([]);
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [reminderDraft, setReminderDraft] = useState("");
  const [dealDraft, setDealDraft] = useState<DealDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);

  const seededLead = useMemo<LeadDetail | null>(() => {
    if (!initialLead) return null;
    return {
      id: initialLead.id,
      ig_username: initialLead.ig_username ?? null,
      full_name: initialLead.full_name ?? null,
      first_name: initialLead.first_name ?? null,
      last_name: initialLead.last_name ?? null,
      canonical_email: initialLead.canonical_email ?? null,
      canonical_phone: initialLead.canonical_phone ?? null,
      stage: initialLead.stage ?? null,
      lead_temp: initialLead.lead_temp ?? null,
      source: initialLead.source ?? null,
      intent: initialLead.intent ?? null,
      timeline: initialLead.timeline ?? null,
      budget_range: initialLead.budget_range ?? null,
      location_area: initialLead.location_area ?? null,
      contact_preference: initialLead.contact_preference ?? null,
      next_step: initialLead.next_step ?? null,
      notes: initialLead.notes ?? null,
      tags: Array.isArray(initialLead.tags) ? initialLead.tags : null,
      last_message_preview: initialLead.last_message_preview ?? null,
      time_last_updated: initialLead.time_last_updated ?? null,
      last_communication_at: initialLead.last_communication_at ?? null,
      urgency_level: initialLead.urgency_level ?? null,
      urgency_score:
        typeof initialLead.urgency_score === "number"
          ? initialLead.urgency_score
          : initialLead.urgency_score
            ? Number(initialLead.urgency_score)
            : null,
      deal_price: initialLead.deal_price ?? null,
      commission_percent: initialLead.commission_percent ?? null,
      commission_amount: initialLead.commission_amount ?? null,
      close_date: initialLead.close_date ?? null,
      created_at: initialLead.created_at ?? null,
      source_detail:
        initialLead.source_detail && typeof initialLead.source_detail === "object" && !Array.isArray(initialLead.source_detail)
          ? (initialLead.source_detail as Record<string, unknown>)
          : null,
      custom_fields:
        initialLead.custom_fields && typeof initialLead.custom_fields === "object" && !Array.isArray(initialLead.custom_fields)
          ? (initialLead.custom_fields as Record<string, unknown>)
          : null,
    };
  }, [initialLead]);

  useEffect(() => {
    if (!open || !leadId) return;
    setLead(seededLead);
    setReminders([]);
    setError("");
    setSaveNotice(null);
  }, [leadId, open, seededLead]);

  useEffect(() => {
    const selectedLeadId = leadId;
    if (!open || !selectedLeadId) return;
    let cancelled = false;

    async function loadLeadDetail(currentLeadId: string) {
      setLoading(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`/api/leads/simple/${encodeURIComponent(currentLeadId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as LeadDetailResponse;

        if (!response.ok || !data.lead) {
          if (!cancelled) setError("Some details are unavailable right now.");
          return;
        }

        if (!cancelled) {
          setLead(data.lead);
          setReminders(data.reminders || []);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Some details are unavailable right now.");
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    }

    void loadLeadDetail(selectedLeadId);
    return () => {
      cancelled = true;
    };
  }, [leadId, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const displayLead = lead || seededLead;

  const headerIdentity = useMemo(() => {
    if (!displayLead) return null;
    const primary = primaryIdentity(displayLead);
    const secondary = secondaryIdentityLine(displayLead, primary.kind);
    return { primary, secondary };
  }, [displayLead]);

  const stageLabel = displayLead ? prettyLabel(displayLead.stage) : "";
  const sourceLabel = displayLead ? sourceDisplayLabel(displayLead.source) : "";
  const emailValue = firstNonEmpty(displayLead?.canonical_email || null);
  const phoneValue = firstNonEmpty(displayLead?.canonical_phone || null);
  const urgencyLabel = prettyLabel(displayLead?.urgency_level);
  const urgencyScore =
    typeof displayLead?.urgency_score === "number" && Number.isFinite(displayLead.urgency_score)
      ? Math.max(0, Math.min(100, Math.round(displayLead.urgency_score)))
      : null;

  const leadSummary = useMemo(() => (displayLead ? summaryRows(displayLead) : []), [displayLead]);
  const dealPrice = parsePositiveDecimal(displayLead?.deal_price);
  const commissionPercent = parsePositiveDecimal(displayLead?.commission_percent);
  const commissionAmount =
    parsePositiveDecimal(displayLead?.commission_amount) ?? calculateCommissionAmount(dealPrice, commissionPercent);
  const closeDateText = firstNonEmpty(displayLead?.close_date || null);
  const hasDealData = dealPrice !== null || commissionPercent !== null || commissionAmount !== null || Boolean(closeDateText);
  const pendingReminders = reminders.filter((item) => item.status === "pending");
  const nextReminder = pendingReminders[0] || null;
  const actionEmailValue = normalizeEmailValue(draft?.canonical_email || emailValue);
  const emailHref = actionEmailValue ? `mailto:${encodeURIComponent(actionEmailValue)}` : null;

  useEffect(() => {
    if (!displayLead?.id) {
      setDraft(null);
      setReminderDraft("");
      setDealDraft(null);
      return;
    }

    setDraft({
      full_name: displayLead.full_name || "",
      canonical_phone: formatPhoneDisplay(displayLead.canonical_phone) || displayLead.canonical_phone || "",
      canonical_email: displayLead.canonical_email || "",
      stage: prettyLabel(displayLead.stage) || "New",
      lead_temp: prettyLabel(displayLead.lead_temp) || "Warm",
      notes: displayLead.notes || "",
      next_step: displayLead.next_step || "",
      contact_preference: displayLead.contact_preference || "",
    });

    setReminderDraft(toDateTimeLocalValue(nextReminder?.due_at));

    setDealDraft({
      deal_price: formatCurrencyInput(asInputNumber(displayLead.deal_price)),
      commission_percent: asInputNumber(displayLead.commission_percent),
      commission_amount: formatCurrencyInput(asInputNumber(displayLead.commission_amount)),
      close_date: asInputDate(displayLead.close_date),
      commissionAmountManuallyEdited: Boolean(parsePositiveDecimal(displayLead.commission_amount)),
    });
  }, [
    displayLead?.id,
    displayLead?.full_name,
    displayLead?.canonical_phone,
    displayLead?.canonical_email,
    displayLead?.stage,
    displayLead?.lead_temp,
    displayLead?.notes,
    displayLead?.next_step,
    displayLead?.contact_preference,
    displayLead?.deal_price,
    displayLead?.commission_percent,
    displayLead?.commission_amount,
    displayLead?.close_date,
    nextReminder?.due_at,
  ]);

  const recommendedAction = useMemo(() => {
    if (!displayLead) return "Open the lead timeline and set the next follow-up.";
    const stage = (displayLead.stage || "").trim().toLowerCase();
    const temp = (displayLead.lead_temp || "").trim().toLowerCase();
    if (stage === "new") return "Initial outreach now. First response speed is key.";
    if (temp === "hot") return "Contact today and secure a firm next step.";
    if (pendingReminders.length > 0) return "Clear pending reminders before end of day.";
    if (stage === "contacted") return "Confirm motivation, timeline, and buying/selling plan.";
    return "Queue a follow-up touchpoint to keep momentum.";
  }, [displayLead, pendingReminders.length]);

  const lockboxGuidance = useMemo(() => {
    if (!displayLead) return [] as string[];
    const items: string[] = [];
    const stage = (displayLead.stage || "").trim().toLowerCase();
    const temp = (displayLead.lead_temp || "").trim().toLowerCase();
    const updatedMs = displayLead.time_last_updated ? new Date(displayLead.time_last_updated).getTime() : NaN;
    const staleDays = Number.isFinite(updatedMs)
      ? Math.floor((Date.now() - updatedMs) / (24 * 3600_000))
      : null;

    if (stage === "new") {
      items.push("New leads convert best with rapid response. Make first contact as soon as possible.");
    }
    if (temp === "hot" && staleDays !== null && staleDays >= 1) {
      items.push("Hot lead has gone quiet. Prioritize a same-day call or email re-engagement.");
    }
    if (pendingReminders.length > 0) {
      items.push(
        `${pendingReminders.length} follow-up reminder(s) are pending. Clearing these quickly helps keep lead momentum strong.`
      );
    }
    if (!firstNonEmpty(displayLead.next_step)) {
      items.push("Set a clear next step to keep this relationship moving forward.");
    }
    if (!firstNonEmpty(displayLead.notes)) {
      items.push("Capture context in notes after every touchpoint so future follow-ups stay personal.");
    }
    if (items.length === 0) {
      items.push("Lead profile is in good shape. Keep response time and follow-up cadence consistent.");
    }

    return items.slice(0, 4);
  }, [displayLead, pendingReminders.length]);

  function updateDraftField<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  }

  function formatDraftPhoneOnBlur() {
    setDraft((previous) => {
      if (!previous) return previous;
      const normalized = normalizePhoneValue(previous.canonical_phone);
      return {
        ...previous,
        canonical_phone: normalized ? formatPhoneDisplay(normalized) : previous.canonical_phone.trim(),
      };
    });
  }

  function updateDealPrice(value: string) {
    setDealDraft((previous) => {
      if (!previous) return previous;
      const next: DealDraft = { ...previous, deal_price: value };
      if (!next.commissionAmountManuallyEdited) {
        const calculated = calculateCommissionAmount(
          parsePositiveDecimal(value),
          parsePositiveDecimal(next.commission_percent)
        );
        next.commission_amount = asInputNumber(calculated);
      }
      return next;
    });
  }

  function updateCommissionPercent(value: string) {
    setDealDraft((previous) => {
      if (!previous) return previous;
      const next: DealDraft = { ...previous, commission_percent: value };
      if (!next.commissionAmountManuallyEdited) {
        const calculated = calculateCommissionAmount(
          parsePositiveDecimal(next.deal_price),
          parsePositiveDecimal(value)
        );
        next.commission_amount = asInputNumber(calculated);
      }
      return next;
    });
  }

  function updateCommissionAmount(value: string) {
    setDealDraft((previous) =>
      previous
        ? {
            ...previous,
            commission_amount: value,
            commissionAmountManuallyEdited: value.trim().length > 0,
          }
        : previous
    );
  }

  function formatDealCurrencyField(key: "deal_price" | "commission_amount") {
    setDealDraft((previous) => {
      if (!previous) return previous;
      return { ...previous, [key]: formatCurrencyInput(previous[key]) };
    });
  }

  async function saveChanges() {
    if (!displayLead?.id || !draft || !dealDraft) return;
    setSaving(true);
    setSaveNotice(null);

    try {
      const leadResponse = await fetch(`/api/leads/simple/${encodeURIComponent(displayLead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: draft.full_name,
          canonical_phone: normalizePhoneValue(draft.canonical_phone),
          canonical_email: normalizeEmailValue(draft.canonical_email),
          stage: draft.stage,
          lead_temp: draft.lead_temp,
          notes: draft.notes,
          next_step: draft.next_step,
          contact_preference: draft.contact_preference,
          deal_price: parsePositiveDecimal(dealDraft.deal_price),
          commission_percent: parsePositiveDecimal(dealDraft.commission_percent),
          commission_amount: parsePositiveDecimal(dealDraft.commission_amount),
          close_date: dealDraft.close_date.trim() || null,
        }),
      });

      const leadData = (await leadResponse.json()) as LeadUpdateResponse;
      if (!leadResponse.ok || !leadData.lead) {
        setSaveNotice({ tone: "error", text: leadData.error || "Could not save lead changes." });
        return;
      }
      setLead(leadData.lead);

      const reminderDueAt = toIsoDateTime(reminderDraft);
      if (reminderDraft.trim() && !reminderDueAt) {
        setSaveNotice({ tone: "error", text: "Reminder date must be valid." });
        return;
      }

      if (reminderDueAt) {
        if (nextReminder?.id) {
          const reminderResponse = await fetch(`/api/reminders/${encodeURIComponent(nextReminder.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              due_at: reminderDueAt,
              note: draft.next_step || nextReminder.note,
            }),
          });
          const reminderData = (await reminderResponse.json()) as { reminder?: ReminderPreview; error?: string };
          if (!reminderResponse.ok || !reminderData.reminder) {
            setSaveNotice({ tone: "error", text: reminderData.error || "Lead saved, but reminder could not be updated." });
            return;
          }
          setReminders((previous) =>
            previous.map((item) => (item.id === reminderData.reminder?.id ? reminderData.reminder : item))
          );
        } else {
          const reminderResponse = await fetch("/api/reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: displayLead.id,
              due_at: reminderDueAt,
              note: draft.next_step || null,
              preset: "1d",
            }),
          });
          const reminderData = (await reminderResponse.json()) as { reminder?: ReminderPreview; error?: string };
          if (!reminderResponse.ok || !reminderData.reminder) {
            setSaveNotice({ tone: "error", text: reminderData.error || "Lead saved, but reminder could not be created." });
            return;
          }
          setReminders((previous) =>
            [...previous, reminderData.reminder as ReminderPreview].sort((a, b) => a.due_at.localeCompare(b.due_at))
          );
        }
      }

      setSaveNotice({ tone: "ok", text: "Changes saved." });
    } catch {
      setSaveNotice({ tone: "error", text: "Could not save changes." });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="crm-detail-overlay" onClick={onClose}>
      <aside className="crm-card crm-detail-shell" onClick={(event) => event.stopPropagation()}>
        <section className="crm-card-muted crm-detail-header">
          <div className="crm-detail-header__top">
            <div>
              <div className="crm-detail-kicker">Lead Command Workspace</div>
              <div className="crm-detail-title">{draft?.full_name || headerIdentity?.primary.label || "Lead"}</div>
              <div className="crm-detail-contact-line">
                <span>{formatPhoneDisplay(draft?.canonical_phone) || "No phone saved yet"}</span>
                <span>{draft?.canonical_email || "No email saved yet"}</span>
              </div>
              <div className="crm-detail-chip-row">
                {draft?.stage ? <span className="crm-chip">{draft.stage}</span> : stageLabel ? <span className="crm-chip">{stageLabel}</span> : null}
                {draft?.lead_temp ? <span className={leadTempChipClass(draft.lead_temp)}>{draft.lead_temp}</span> : null}
                {sourceLabel ? <span className="crm-chip crm-chip-info">{sourceLabel}</span> : null}
                {urgencyLabel ? (
                  <span className={urgencyLabel.toLowerCase() === "high" ? "crm-chip crm-chip-danger" : "crm-chip"}>
                    Urgency: {urgencyLabel}
                    {urgencyScore !== null ? ` (${urgencyScore})` : ""}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="crm-detail-header__actions">
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void saveChanges()}
                disabled={saving || !displayLead?.id || !draft || !dealDraft}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">
                Close
              </button>
            </div>
          </div>

          {loading && displayLead ? (
            <div className="crm-detail-status-note">Refreshing details...</div>
          ) : null}
          {saveNotice ? (
            <div className="crm-detail-status-note">
              <span className={`crm-chip ${saveNotice.tone === "ok" ? "crm-chip-ok" : "crm-chip-danger"}`}>{saveNotice.text}</span>
            </div>
          ) : null}
        </section>

        <div className="crm-detail-scroll">
          {!displayLead && loading ? (
            <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
              Loading lead details...
            </div>
          ) : null}

          {!displayLead && error ? (
            <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
              {error}
            </div>
          ) : null}

          {displayLead && error ? (
            <div className="crm-card-muted" style={{ padding: 10, fontSize: 13, color: "var(--warn)" }}>
              {error} Showing available fields.
            </div>
          ) : null}

          {displayLead ? (
            <div className="crm-detail-workspace">
              <section className="crm-card-muted crm-detail-section">
                <div className="crm-section-head">
                  <div>
                    <h2 className="crm-section-title">Quick Actions</h2>
                    <p className="crm-section-subtitle">Open the full record or send an email without leaving the dashboard.</p>
                  </div>
                </div>
                <div className="crm-detail-quick-actions">
                  {emailHref ? (
                    <a className="crm-btn crm-btn-secondary" href={emailHref}>Email</a>
                  ) : (
                    <button type="button" className="crm-btn crm-btn-secondary" disabled>Email</button>
                  )}
                  <Link href={`/app/leads/${encodeURIComponent(displayLead.id)}`} className="crm-btn crm-btn-secondary">
                    Open Full Record
                  </Link>
                </div>
              </section>

              <section className="crm-card-muted crm-detail-section">
                <div className="crm-section-head">
                  <div>
                    <h2 className="crm-section-title">Editable Lead Details</h2>
                    <p className="crm-section-subtitle">Update the essentials fast, then save and move on.</p>
                  </div>
                </div>

                <div className="crm-detail-grid-2">
                  <label className="crm-detail-field">
                    <span>Name</span>
                    <input
                      value={draft?.full_name || ""}
                      onChange={(event) => updateDraftField("full_name", event.target.value)}
                      placeholder="Lead name"
                    />
                  </label>
                  <label className="crm-detail-field">
                    <span>Phone</span>
                    <input
                      inputMode="tel"
                      value={draft?.canonical_phone || ""}
                      onChange={(event) => updateDraftField("canonical_phone", event.target.value)}
                      onBlur={formatDraftPhoneOnBlur}
                      placeholder="(256) 851-8200"
                    />
                  </label>
                  <label className="crm-detail-field">
                    <span>Email</span>
                    <input
                      inputMode="email"
                      value={draft?.canonical_email || ""}
                      onChange={(event) => updateDraftField("canonical_email", event.target.value)}
                      placeholder="agent@lead.com"
                    />
                  </label>
                  <label className="crm-detail-field">
                    <span>Stage</span>
                    <select
                      value={draft?.stage || "New"}
                      onChange={(event) => updateDraftField("stage", event.target.value)}
                    >
                      {STAGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-detail-field">
                    <span>Temperature</span>
                    <select
                      value={draft?.lead_temp || "Warm"}
                      onChange={(event) => updateDraftField("lead_temp", event.target.value)}
                    >
                      {TEMP_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-detail-field">
                    <span>Contact Preference</span>
                    <select
                      value={draft?.contact_preference || ""}
                      onChange={(event) => updateDraftField("contact_preference", event.target.value)}
                    >
                      <option value="">Not set</option>
                      {CONTACT_PREFERENCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="crm-detail-subsection">
                  <div className="crm-detail-subsection__label">Lead Summary</div>
                  {leadSummary.length === 0 ? (
                    <div className="crm-detail-empty">Summary details are still being collected.</div>
                  ) : (
                    <div className="crm-detail-grid-2">
                      {leadSummary.map((row) => (
                        <MiniField key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="crm-detail-subsection">
                  <div className="crm-detail-subsection__label">Lead Action Center</div>
                  <div className="crm-detail-action-stack">
                    <div className="crm-card crm-detail-action-card">
                      <div className="crm-detail-action-label">Next Recommended Action</div>
                      <div className="crm-detail-action-copy">{recommendedAction}</div>
                    </div>
                    <div className="crm-card crm-detail-action-card">
                      <div className="crm-detail-action-label">Next Reminder</div>
                      <div className="crm-detail-action-copy">
                        {nextReminder
                          ? `${formatDateTime(nextReminder.due_at)}${nextReminder.note ? ` • ${nextReminder.note}` : ""}`
                          : "No reminder scheduled"}
                      </div>
                    </div>
                    <div className="crm-card crm-detail-action-card">
                      <div className="crm-detail-action-label">Recent Activity</div>
                      <div className="crm-detail-activity-list">
                        <div>Lead created — {formatShortDate(displayLead.created_at) || "No timestamp"}</div>
                        <div>Profile updated — {formatShortDate(displayLead.time_last_updated) || "No timestamp"}</div>
                        <div>Last message — {firstNonEmpty(displayLead.last_message_preview) || "No recent message"}</div>
                      </div>
                    </div>
                    <div className="crm-card crm-detail-action-card">
                      <div className="crm-detail-action-label">LockboxHQ Insight</div>
                      <div className="crm-detail-action-copy">{lockboxGuidance[0] || "Keep follow-up tight and make the next step obvious."}</div>
                    </div>
                  </div>
                </div>

                <div className="crm-detail-grid-2">
                  <label className="crm-detail-field crm-detail-field-full">
                    <span>Next Step</span>
                    <textarea
                      rows={3}
                      value={draft?.next_step || ""}
                      onChange={(event) => updateDraftField("next_step", event.target.value)}
                      placeholder="Set the next move for this lead"
                    />
                  </label>
                  <label className="crm-detail-field crm-detail-field-full">
                    <span>Notes</span>
                    <textarea
                      rows={4}
                      value={draft?.notes || ""}
                      onChange={(event) => updateDraftField("notes", event.target.value)}
                      placeholder="Add call context, objections, or personal details"
                    />
                  </label>
                  <label className="crm-detail-field">
                    <span>Reminder / Next Reminder</span>
                    <input
                      type="datetime-local"
                      value={reminderDraft}
                      onChange={(event) => setReminderDraft(event.target.value)}
                    />
                  </label>
                </div>

                <div className="crm-detail-footer-actions">
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    onClick={() => void saveChanges()}
                    disabled={saving || !displayLead?.id || !draft || !dealDraft}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </section>

              <details className="crm-card-muted crm-detail-section crm-detail-deal-details">
                <summary className="crm-detail-deal-summary">
                  <div>
                    <h2 className="crm-section-title">Deal Details</h2>
                    <p className="crm-section-subtitle">Optional until this lead turns into active business.</p>
                  </div>
                  <span className="crm-chip">{hasDealData ? "Started" : "Optional"}</span>
                </summary>

                <div className="crm-detail-deal-body">
                  <div className="crm-detail-grid-2">
                    <label className="crm-detail-field">
                      <span>Sale Price</span>
                      <input
                        inputMode="decimal"
                        placeholder="$450,000"
                        value={dealDraft?.deal_price || ""}
                        onFocus={(event) => updateDealPrice(stripCurrencyFormatting(event.target.value))}
                        onBlur={() => formatDealCurrencyField("deal_price")}
                        onChange={(event) => updateDealPrice(event.target.value)}
                      />
                    </label>
                    <label className="crm-detail-field">
                      <span>Commission %</span>
                      <input
                        inputMode="decimal"
                        placeholder="3"
                        value={dealDraft?.commission_percent || ""}
                        onChange={(event) => updateCommissionPercent(event.target.value)}
                      />
                    </label>
                    <label className="crm-detail-field">
                      <span>Commission Amount</span>
                      <input
                        inputMode="decimal"
                        placeholder="$13,500"
                        value={dealDraft?.commission_amount || ""}
                        onFocus={(event) => updateCommissionAmount(stripCurrencyFormatting(event.target.value))}
                        onBlur={() => formatDealCurrencyField("commission_amount")}
                        onChange={(event) => updateCommissionAmount(event.target.value)}
                      />
                    </label>
                    <label className="crm-detail-field">
                      <span>Close Date</span>
                      <input
                        type="date"
                        value={dealDraft?.close_date || ""}
                        onChange={(event) =>
                          setDealDraft((previous) =>
                            previous ? { ...previous, close_date: event.target.value } : previous
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="crm-detail-chip-row">
                    <span className="crm-chip">
                      Sale Price: {formatCurrency(parsePositiveDecimal(dealDraft?.deal_price || null))}
                    </span>
                    <span className="crm-chip">
                      Commission Amount: {formatCurrency(parsePositiveDecimal(dealDraft?.commission_amount || null))}
                    </span>
                    <span className="crm-chip">
                      Commission Rate: {formatPercentLabel(parsePositiveDecimal(dealDraft?.commission_percent || null))}
                    </span>
                  </div>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
