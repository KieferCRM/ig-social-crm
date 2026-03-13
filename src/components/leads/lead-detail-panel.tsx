"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  asInputDate,
  asInputNumber,
  calculateCommissionAmount,
  formatCurrency,
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

type LeadInteraction = {
  id: string;
  channel: "sms" | "missed_call_textback" | "call_outbound" | "call_inbound" | "system" | "voice";
  direction: "in" | "out" | "system";
  interaction_type: string;
  status: "queued" | "sent" | "delivered" | "received" | "missed" | "completed" | "failed" | "logged";
  raw_transcript: string | null;
  raw_message_body: string | null;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  provider_message_id: string | null;
  provider_call_id: string | null;
  created_at: string;
};

type ReceptionistAlert = {
  id: string;
  alert_type: string;
  severity: "info" | "high" | "urgent";
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  metadata: Record<string, unknown>;
  created_at: string;
};

type LeadThreadResponse = {
  thread?: {
    lead?: {
      urgency_level?: string | null;
      urgency_score?: number | null;
    };
    interactions?: LeadInteraction[];
    alerts?: ReceptionistAlert[];
  };
  channel?: {
    receptionist_enabled?: boolean;
    communications_enabled?: boolean;
    business_phone_number?: string;
  };
  error?: string;
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

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
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

function tagsFromLead(lead: LeadDetail): string | null {
  if (Array.isArray(lead.tags) && lead.tags.length > 0) {
    return lead.tags.join(", ");
  }
  const tagText = lead.source_detail?.tags;
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

function toPhoneActionValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, "").trim();
  return normalized || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstStringFromRecord(
  record: Record<string, unknown> | null,
  keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

function leadContactName(lead: LeadDetail): string {
  const full = firstNonEmpty(lead.full_name);
  if (full) return full;
  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return "Not provided";
}

function primaryHandleFromLead(lead: LeadDetail): string | null {
  const direct = cleanHandle(lead.ig_username);
  if (direct) return direct;

  const source = asRecord(lead.source_detail);
  const custom = asRecord(lead.custom_fields);
  const raw =
    firstStringFromRecord(source, [
      "primary_handle",
      "handle",
      "username",
      "social_handle",
      "instagram_handle",
      "facebook_handle",
      "tiktok_handle",
    ]) ||
    firstStringFromRecord(custom, [
      "primary_handle",
      "handle",
      "username",
      "social_handle",
      "instagram_handle",
      "facebook_handle",
      "tiktok_handle",
    ]);

  if (!raw) return null;
  const cleaned = raw.replace(/^@+/, "").trim();
  if (!cleaned || cleaned.includes(" ")) return null;
  return `@${cleaned}`;
}

function originSourceDetail(lead: LeadDetail): string | null {
  const source = asRecord(lead.source_detail);
  const custom = asRecord(lead.custom_fields);
  return (
    firstStringFromRecord(source, [
      "origin_detail",
      "origin",
      "source_detail",
      "source_page",
      "source_form",
      "source_campaign",
      "referral_source",
      "referrer",
      "landing_page",
      "website",
      "form_url",
      "source_url",
    ]) ||
    firstStringFromRecord(custom, [
      "origin_detail",
      "origin",
      "source_detail",
      "source_page",
      "source_form",
      "source_campaign",
      "referral_source",
      "referrer",
      "landing_page",
      "website",
      "form_url",
      "source_url",
    ])
  );
}

function sourceUrlFromLead(lead: LeadDetail): string | null {
  const source = asRecord(lead.source_detail);
  const custom = asRecord(lead.custom_fields);
  const fromSource =
    firstStringFromRecord(source, [
      "profile_url",
      "external_profile_url",
      "source_url",
      "origin_url",
      "landing_page_url",
      "website_url",
      "website",
      "form_url",
      "referrer_url",
      "facebook_profile_url",
      "instagram_profile_url",
    ]) ||
    firstStringFromRecord(custom, [
      "profile_url",
      "external_profile_url",
      "source_url",
      "origin_url",
      "landing_page_url",
      "website_url",
      "website",
      "form_url",
      "referrer_url",
      "facebook_profile_url",
      "instagram_profile_url",
    ]);
  return normalizeHttpUrl(fromSource);
}

function sourceLabelForExternalAction(url: string): string {
  const normalized = url.toLowerCase();
  if (normalized.includes("instagram.com")) return "Open Instagram Profile";
  if (normalized.includes("facebook.com")) return "Open Facebook Profile";
  if (normalized.includes("tiktok.com")) return "Open TikTok Profile";
  if (normalized.includes("linkedin.com")) return "Open LinkedIn Profile";
  return "Open Source Page";
}

function externalActionForLead(
  lead: LeadDetail,
  primaryHandle: string | null
): { label: string; href: string } | null {
  const explicitUrl = sourceUrlFromLead(lead);
  if (explicitUrl) {
    return {
      label: sourceLabelForExternalAction(explicitUrl),
      href: explicitUrl,
    };
  }

  if (!primaryHandle) return null;

  const handle = primaryHandle.replace(/^@+/, "").trim();
  if (!handle) return null;

  const normalizedSource = (lead.source || "").trim().toLowerCase();
  if (normalizedSource.includes("facebook") || normalizedSource === "fb") {
    return {
      label: "Open Facebook Profile",
      href: `https://www.facebook.com/${encodeURIComponent(handle)}`,
    };
  }

  return {
    label: normalizedSource.includes("instagram") || normalizedSource === "ig" ? "Open Instagram Profile" : "Open Profile",
    href: `https://www.instagram.com/${encodeURIComponent(handle)}/`,
  };
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

function recordRows(
  record: Record<string, unknown> | null,
  hiddenKeys: string[] = []
): Array<{ key: string; label: string; value: string }> {
  if (!record) return [];
  const hidden = new Set(hiddenKeys);
  const rows: Array<{ key: string; label: string; value: string }> = [];

  for (const [key, rawValue] of Object.entries(record)) {
    if (hidden.has(key)) continue;
    const value = fieldValue(rawValue);
    if (!value) continue;
    rows.push({
      key,
      label: fieldLabel(key),
      value,
    });
  }

  return rows.slice(0, 24);
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-card-muted" style={{ padding: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function interactionStatusChipClass(status: LeadInteraction["status"]): string {
  if (status === "failed" || status === "missed") return "crm-chip crm-chip-danger";
  if (status === "queued" || status === "sent") return "crm-chip crm-chip-warn";
  if (status === "delivered" || status === "received" || status === "completed") return "crm-chip crm-chip-ok";
  return "crm-chip";
}

function interactionChannelLabel(channel: LeadInteraction["channel"]): string {
  if (channel === "sms") return "SMS";
  if (channel === "missed_call_textback") return "Missed Call Text-Back";
  if (channel === "call_outbound") return "Outbound Call";
  if (channel === "call_inbound") return "Inbound Call";
  if (channel === "voice") return "Voice";
  return "System";
}

function interactionDirectionLabel(direction: LeadInteraction["direction"]): string {
  if (direction === "in") return "Inbound";
  if (direction === "out") return "Outbound";
  return "System";
}

function sortedInteractions(items: LeadInteraction[]): LeadInteraction[] {
  return [...items].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
}

function upsertInteraction(items: LeadInteraction[], next: LeadInteraction): LeadInteraction[] {
  const map = new Map<string, LeadInteraction>();
  for (const item of items) map.set(item.id, item);
  map.set(next.id, next);
  return sortedInteractions(Array.from(map.values()));
}

export default function LeadDetailPanel({ leadId, open, initialLead = null, onClose }: LeadDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [reminders, setReminders] = useState<ReminderPreview[]>([]);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [receptionistAlerts, setReceptionistAlerts] = useState<ReceptionistAlert[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [threadChannel, setThreadChannel] = useState<LeadThreadResponse["channel"] | null>(null);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [commNotice, setCommNotice] = useState("");
  const [dealDraft, setDealDraft] = useState<DealDraft | null>(null);
  const [dealSaving, setDealSaving] = useState(false);
  const [dealNotice, setDealNotice] = useState("");
  const communicationSectionRef = useRef<HTMLElement | null>(null);
  const smsComposerRef = useRef<HTMLTextAreaElement | null>(null);

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
    setInteractions([]);
    setReceptionistAlerts([]);
    setThreadChannel(null);
    setError("");
    setThreadError("");
    setCommNotice("");
    setSmsDraft("");
    setDealNotice("");
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
    const selectedLeadId = leadId;
    if (!open || !selectedLeadId) return;
    let cancelled = false;

    async function loadThread(currentLeadId: string) {
      setThreadLoading(true);
      try {
        const response = await fetch(`/api/receptionist/threads/${encodeURIComponent(currentLeadId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as LeadThreadResponse;

        if (!response.ok || !data.thread) {
          if (!cancelled) setThreadError(data.error || "Communication history is unavailable.");
          return;
        }

        if (!cancelled) {
          setThreadError("");
          setInteractions(sortedInteractions(data.thread.interactions || []));
          setReceptionistAlerts(data.thread.alerts || []);
          setThreadChannel(data.channel || null);
          const urgencyLevel = data.thread.lead?.urgency_level ?? null;
          const urgencyScore =
            typeof data.thread.lead?.urgency_score === "number"
              ? data.thread.lead.urgency_score
              : null;
          setLead((previous) =>
            previous
              ? {
                  ...previous,
                  urgency_level: urgencyLevel,
                  urgency_score: urgencyScore,
                }
              : previous
          );
        }
      } catch {
        if (!cancelled) setThreadError("Communication history is unavailable.");
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    }

    void loadThread(selectedLeadId);
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
  const tempLabel = displayLead ? prettyLabel(displayLead.lead_temp) : "";
  const sourceLabel = displayLead ? sourceDisplayLabel(displayLead.source) : "";
  const handleValue = displayLead ? primaryHandleFromLead(displayLead) : null;
  const emailValue = firstNonEmpty(displayLead?.canonical_email || null);
  const phoneValue = firstNonEmpty(displayLead?.canonical_phone || null);
  const nameValue = displayLead ? leadContactName(displayLead) : "Not provided";
  const platformValue = sourceLabel || "Not specified";
  const sourceDetailValue = displayLead ? originSourceDetail(displayLead) : null;
  const phoneActionValue = toPhoneActionValue(phoneValue);
  const emailHref = emailValue ? `mailto:${encodeURIComponent(emailValue)}` : null;
  const externalAction = displayLead ? externalActionForLead(displayLead, handleValue) : null;

  const communicationsEnabled = threadChannel
    ? Boolean(threadChannel.receptionist_enabled && threadChannel.communications_enabled)
    : true;
  const businessPhone = firstNonEmpty(threadChannel?.business_phone_number || null);
  const communicationBlocker = !phoneActionValue
    ? "No phone number is stored for this lead."
    : !communicationsEnabled
      ? "Receptionist communications are currently disabled in settings."
      : !businessPhone
        ? "Add a business phone number in Receptionist Settings."
        : null;
  const canRunCommunications = !communicationBlocker;
  const urgencyLabel = prettyLabel(displayLead?.urgency_level);
  const urgencyScore =
    typeof displayLead?.urgency_score === "number" && Number.isFinite(displayLead.urgency_score)
      ? Math.max(0, Math.min(100, Math.round(displayLead.urgency_score)))
      : null;

  const leadSummary = useMemo(() => (displayLead ? summaryRows(displayLead) : []), [displayLead]);
  const sourceDetailRows = useMemo(
    () =>
      recordRows(asRecord(displayLead?.source_detail || null), [
        "intake_identity",
        "manual_identity",
      ]),
    [displayLead?.source_detail]
  );
  const customFieldRows = useMemo(
    () => recordRows(asRecord(displayLead?.custom_fields || null)),
    [displayLead?.custom_fields]
  );
  const notesText = firstNonEmpty(displayLead?.notes || null);
  const lastUpdatedText = formatDateTime(displayLead?.time_last_updated);
  const lastActivityText = firstNonEmpty(displayLead?.last_message_preview || null);
  const createdAtText = formatDateTime(displayLead?.created_at);
  const lastCommunicationText = formatDateTime(displayLead?.last_communication_at);
  const dealPrice = parsePositiveDecimal(displayLead?.deal_price);
  const commissionPercent = parsePositiveDecimal(displayLead?.commission_percent);
  const commissionAmount =
    parsePositiveDecimal(displayLead?.commission_amount) ?? calculateCommissionAmount(dealPrice, commissionPercent);
  const closeDateText = firstNonEmpty(displayLead?.close_date || null);
  const hasDealData = dealPrice !== null || commissionPercent !== null || commissionAmount !== null || Boolean(closeDateText);
  const pendingReminders = reminders.filter((item) => item.status === "pending");
  const nextReminder = pendingReminders[0] || null;

  useEffect(() => {
    if (!displayLead?.id) {
      setDealDraft(null);
      return;
    }

    setDealDraft({
      deal_price: asInputNumber(displayLead.deal_price),
      commission_percent: asInputNumber(displayLead.commission_percent),
      commission_amount: asInputNumber(displayLead.commission_amount),
      close_date: asInputDate(displayLead.close_date),
      commissionAmountManuallyEdited: Boolean(parsePositiveDecimal(displayLead.commission_amount)),
    });
  }, [
    displayLead?.id,
    displayLead?.deal_price,
    displayLead?.commission_percent,
    displayLead?.commission_amount,
    displayLead?.close_date,
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

  const merlynGuidance = useMemo(() => {
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
      items.push("Hot lead has gone quiet. Prioritize a same-day call or SMS re-engagement.");
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

  function focusTextComposer() {
    communicationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => smsComposerRef.current?.focus(), 120);
  }

  async function runCallBridge() {
    if (!displayLead?.id) return;
    if (communicationBlocker) {
      setCommNotice(communicationBlocker);
      return;
    }
    setCommNotice("");
    setCalling(true);
    try {
      const response = await fetch("/api/receptionist/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: displayLead.id }),
      });
      const data = (await response.json()) as {
        interaction?: LeadInteraction;
        call?: { ok?: boolean; status?: string; error?: string };
        error?: string;
      };

      if (!response.ok) {
        setCommNotice(data.error || "Could not start click-to-call.");
        return;
      }

      if (data.interaction) {
        setInteractions((previous) => upsertInteraction(previous, data.interaction as LeadInteraction));
      }

      if (data.call?.ok) {
        setCommNotice("Bridge call started. Your forwarding phone rings first.");
      } else {
        setCommNotice(data.call?.error || "Call attempt logged, but bridge could not be completed.");
      }
    } catch {
      setCommNotice("Could not start click-to-call.");
    } finally {
      setCalling(false);
    }
  }

  async function sendSmsMessage() {
    const text = smsDraft.trim();
    if (!text || !displayLead?.id) return;
    if (communicationBlocker) {
      setCommNotice(communicationBlocker);
      return;
    }
    setSmsSending(true);
    setCommNotice("");
    try {
      const response = await fetch(`/api/receptionist/threads/${encodeURIComponent(displayLead.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as {
        interaction?: LeadInteraction;
        delivery?: { ok?: boolean; status?: string; error?: string };
        error?: string;
      };

      if (!response.ok || !data.interaction) {
        setCommNotice(data.error || "Could not send text.");
        return;
      }

      setSmsDraft("");
      setInteractions((previous) => upsertInteraction(previous, data.interaction as LeadInteraction));
      if (data.delivery?.ok) {
        setCommNotice("Text sent from your Merlyn business number.");
      } else {
        setCommNotice(data.delivery?.error || "Message logged, but external delivery failed.");
      }
    } catch {
      setCommNotice("Could not send text.");
    } finally {
      setSmsSending(false);
    }
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

  async function saveDealDetails() {
    if (!displayLead?.id || !dealDraft) return;
    setDealSaving(true);
    setDealNotice("");

    try {
      const dealPriceValue = parsePositiveDecimal(dealDraft.deal_price);
      const commissionPercentValue = parsePositiveDecimal(dealDraft.commission_percent);
      let commissionAmountValue = parsePositiveDecimal(dealDraft.commission_amount);
      if (!dealDraft.commissionAmountManuallyEdited && commissionAmountValue === null) {
        commissionAmountValue = calculateCommissionAmount(dealPriceValue, commissionPercentValue);
      }

      let closeDateValue: string | null = null;
      if (dealDraft.close_date.trim()) {
        const date = new Date(dealDraft.close_date);
        if (Number.isNaN(date.getTime())) {
          setDealNotice("Close date must be a valid date.");
          return;
        }
        closeDateValue = date.toISOString().slice(0, 10);
      }

      const response = await fetch(`/api/leads/simple/${encodeURIComponent(displayLead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_price: dealPriceValue,
          commission_percent: commissionPercentValue,
          commission_amount: commissionAmountValue,
          close_date: closeDateValue,
        }),
      });

      const data = (await response.json()) as LeadUpdateResponse;
      if (!response.ok || !data.lead) {
        setDealNotice(data.error || "Could not save deal details.");
        return;
      }

      setLead(data.lead);
      setDealNotice("Deal details saved. Performance metrics will update on refresh.");
    } catch {
      setDealNotice("Could not save deal details.");
    } finally {
      setDealSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="crm-detail-overlay" onClick={onClose}>
      <aside className="crm-card crm-detail-shell" onClick={(event) => event.stopPropagation()}>
        <section className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 700 }}>Lead Command Workspace</div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800 }}>{headerIdentity?.primary.label || "Lead"}</div>
              {headerIdentity?.secondary ? (
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>{headerIdentity.secondary}</div>
              ) : null}
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {stageLabel ? <span className="crm-chip">{stageLabel}</span> : null}
                {tempLabel ? <span className={leadTempChipClass(displayLead?.lead_temp || null)}>{tempLabel}</span> : null}
                {sourceLabel ? <span className="crm-chip crm-chip-info">{sourceLabel}</span> : null}
                {urgencyLabel ? (
                  <span className={urgencyLabel.toLowerCase() === "high" ? "crm-chip crm-chip-danger" : "crm-chip"}>
                    Urgency: {urgencyLabel}
                    {urgencyScore !== null ? ` (${urgencyScore})` : ""}
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                Open in Pipeline
              </Link>
              <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
                Close
              </button>
            </div>
          </div>

          {loading && displayLead ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-muted)" }}>Refreshing details...</div>
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
            <div className="crm-detail-grid">
              <div style={{ display: "grid", gap: 12 }}>
                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Contact Info</h2>
                    {platformValue !== "Not specified" ? <span className="crm-chip crm-chip-info">{platformValue}</span> : null}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <MiniField label="Name" value={nameValue} />
                    <MiniField label="Phone" value={phoneValue || "Not provided"} />
                    <MiniField label="Email" value={emailValue || "Not provided"} />
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <MiniField label="Primary handle" value={handleValue || "Not available"} />
                    <MiniField label="Platform" value={platformValue} />
                    <MiniField label="Origin / Source detail" value={sourceDetailValue || "Not available"} />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      onClick={runCallBridge}
                      disabled={!canRunCommunications || calling}
                    >
                      {calling ? "Calling..." : "Call"}
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      onClick={focusTextComposer}
                      disabled={!canRunCommunications}
                    >
                      Text
                    </button>
                    {emailHref ? (
                      <a className="crm-btn crm-btn-secondary" href={emailHref}>Email</a>
                    ) : (
                      <button type="button" className="crm-btn crm-btn-secondary" disabled>Email</button>
                    )}
                    {externalAction ? (
                      <a className="crm-btn crm-btn-secondary" href={externalAction.href} target="_blank" rel="noopener noreferrer">
                        {externalAction.label}
                      </a>
                    ) : (
                      <button type="button" className="crm-btn crm-btn-secondary" disabled>Open Source/Profile</button>
                    )}
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {businessPhone ? <span className="crm-chip">Business #: {businessPhone}</span> : null}
                    {!communicationsEnabled ? <span className="crm-chip crm-chip-warn">Receptionist communications disabled</span> : null}
                    {communicationBlocker ? <span className="crm-chip crm-chip-warn">{communicationBlocker}</span> : null}
                    <Link href="/app/settings/receptionist" className="crm-btn crm-btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }}>
                      Receptionist Settings
                    </Link>
                  </div>
                </section>

                <section ref={communicationSectionRef} className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Communications</h2>
                    <span className="crm-chip">{interactions.length} interaction(s)</span>
                  </div>

                  {threadLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)" }}>Loading communication history...</div>
                  ) : null}
                  {threadError ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--warn)" }}>{threadError}</div>
                  ) : null}
                  {commNotice ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)" }}>{commNotice}</div>
                  ) : null}

                  {receptionistAlerts.length > 0 ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {receptionistAlerts.slice(0, 3).map((alert) => (
                        <div key={alert.id} className="crm-card" style={{ padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13 }}>{alert.title}</strong>
                            <span className={alert.severity === "urgent" ? "crm-chip crm-chip-danger" : "crm-chip crm-chip-warn"}>
                              {prettyLabel(alert.severity)}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>{alert.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                    {interactions.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>No call or text history yet.</div>
                    ) : (
                      interactions.map((interaction) => (
                        <article key={interaction.id} className="crm-card" style={{ padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                              {interactionChannelLabel(interaction.channel)} • {interactionDirectionLabel(interaction.direction)} • {prettyLabel(interaction.interaction_type)}
                            </div>
                            <span className={interactionStatusChipClass(interaction.status)}>{prettyLabel(interaction.status)}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 13, whiteSpace: "pre-wrap" }}>
                            {interaction.raw_message_body || interaction.summary || "No content available."}
                          </div>
                          {interaction.raw_transcript ? (
                            <details style={{ marginTop: 8 }}>
                              <summary style={{ fontSize: 12, color: "var(--ink-muted)", cursor: "pointer" }}>View transcript</summary>
                              <div style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap" }}>{interaction.raw_transcript}</div>
                            </details>
                          ) : null}
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-muted)" }}>
                            {formatDateTime(interaction.created_at)}
                            {interaction.provider_message_id ? ` • msg:${interaction.provider_message_id}` : ""}
                            {interaction.provider_call_id ? ` • call:${interaction.provider_call_id}` : ""}
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <textarea
                      ref={smsComposerRef}
                      value={smsDraft}
                      onChange={(event) => setSmsDraft(event.target.value)}
                      placeholder="Send a text from your Merlyn business number..."
                      rows={3}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary"
                        onClick={sendSmsMessage}
                        disabled={!smsDraft.trim() || smsSending || !canRunCommunications}
                      >
                        {smsSending ? "Sending..." : "Send Text"}
                      </button>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary"
                        onClick={() => setSmsDraft("")}
                        disabled={!smsDraft.trim() || smsSending}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Lead Summary</h2>
                  </div>
                  {leadSummary.length === 0 ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-muted)" }}>
                      Summary details are still being collected.
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 8,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {leadSummary.map((row) => (
                        <MiniField key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Notes</h2>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
                    {notesText || "No notes yet."}
                  </div>
                </section>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Follow-Ups</h2>
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <MiniField label="Recommended next action" value={recommendedAction} />
                    <MiniField
                      label="Next step"
                      value={firstNonEmpty(displayLead.next_step) || "Set a specific next action for this lead."}
                    />
                    <MiniField
                      label="Contact preference"
                      value={firstNonEmpty(displayLead.contact_preference) || "Not set yet"}
                    />
                  </div>
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Reminders</h2>
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <MiniField label="Pending reminders" value={String(pendingReminders.length)} />
                    <MiniField
                      label="Next reminder"
                      value={
                        nextReminder
                          ? `${formatDateTime(nextReminder.due_at)}${nextReminder.note ? ` • ${nextReminder.note}` : ""}`
                          : "No reminders scheduled."
                      }
                    />
                  </div>
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Recent Activity</h2>
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <MiniField label="Last message" value={lastActivityText || "No recent activity yet."} />
                    <MiniField label="Last communication" value={lastCommunicationText || "No communication logged"} />
                    <MiniField label="Profile updated" value={lastUpdatedText || "No timestamp available"} />
                    <MiniField label="Lead created" value={createdAtText || "No timestamp available"} />
                  </div>
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Deal Details</h2>
                    {stageLabel ? (
                      <span className={stageLabel.toLowerCase() === "closed" ? "crm-chip crm-chip-ok" : "crm-chip"}>
                        {stageLabel}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 8,
                      }}
                    >
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Sale Price</span>
                        <input
                          inputMode="decimal"
                          placeholder="450000"
                          value={dealDraft?.deal_price || ""}
                          onChange={(event) => updateDealPrice(event.target.value)}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Commission %</span>
                        <input
                          inputMode="decimal"
                          placeholder="3"
                          value={dealDraft?.commission_percent || ""}
                          onChange={(event) => updateCommissionPercent(event.target.value)}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Commission Amount</span>
                        <input
                          inputMode="decimal"
                          placeholder="13500"
                          value={dealDraft?.commission_amount || ""}
                          onChange={(event) => updateCommissionAmount(event.target.value)}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Close Date</span>
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

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="crm-chip">
                        Deal Value: {formatCurrency(parsePositiveDecimal(dealDraft?.deal_price || null))}
                      </span>
                      <span className="crm-chip">
                        Commission Rate: {formatPercentLabel(parsePositiveDecimal(dealDraft?.commission_percent || null))}
                      </span>
                      <span
                        className={
                          dealDraft?.commissionAmountManuallyEdited ? "crm-chip crm-chip-info" : "crm-chip crm-chip-ok"
                        }
                      >
                        {dealDraft?.commissionAmountManuallyEdited
                          ? "Commission amount is manually set"
                          : "Commission auto-calculates from price and %"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary"
                        onClick={() => void saveDealDetails()}
                        disabled={dealSaving || !displayLead?.id}
                      >
                        {dealSaving ? "Saving..." : "Save Deal Details"}
                      </button>
                      {dealNotice ? <span className="crm-chip">{dealNotice}</span> : null}
                    </div>

                    {stageLabel.toLowerCase() !== "closed" ? (
                      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        Avg Commission / Deal only counts leads in Closed stage.
                      </div>
                    ) : null}

                    {!hasDealData ? (
                      <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        Add sale price and commission details to unlock revenue metrics.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="crm-card-muted" style={{ padding: 12 }}>
                  <div className="crm-section-head">
                    <h2 className="crm-section-title">Merlyn Guidance</h2>
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {merlynGuidance.map((item, index) => (
                      <div key={`${index}-${item.slice(0, 20)}`} className="crm-card" style={{ padding: 10, fontSize: 13 }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </section>

                <details className="crm-card-muted" style={{ padding: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Structured Source Data</summary>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {sourceDetailRows.length > 0 ? (
                      sourceDetailRows.map((row) => (
                        <div key={row.key} className="crm-card" style={{ padding: 10 }}>
                          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{row.label}</div>
                          <div style={{ marginTop: 4, fontSize: 13 }}>{row.value}</div>
                        </div>
                      ))
                    ) : (
                      <div className="crm-card" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
                        No structured source data yet.
                      </div>
                    )}
                  </div>
                </details>

                <details className="crm-card-muted" style={{ padding: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Custom Fields</summary>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {customFieldRows.length > 0 ? (
                      customFieldRows.map((row) => (
                        <div key={row.key} className="crm-card" style={{ padding: 10 }}>
                          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{row.label}</div>
                          <div style={{ marginTop: 4, fontSize: 13 }}>{row.value}</div>
                        </div>
                      ))
                    ) : (
                      <div className="crm-card" style={{ padding: 10, fontSize: 13, color: "var(--ink-muted)" }}>
                        No custom field data yet.
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
