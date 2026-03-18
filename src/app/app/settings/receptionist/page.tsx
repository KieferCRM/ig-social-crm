"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePreviewMode } from "@/lib/use-preview-mode";
import {
  DEFAULT_RECEPTIONIST_SETTINGS,
  type ReceptionistPhoneSetupPath,
  type ReceptionistPhoneSetupStatus,
  type ReceptionistSettings,
} from "@/lib/receptionist/settings";

type SettingsResponse = {
  settings?: ReceptionistSettings;
  error?: string;
};

type NumberAssignResponse = {
  ok?: boolean;
  settings?: ReceptionistSettings;
  assignment?: {
    provider?: "mock" | "twilio";
    mode?: "real" | "mock";
    status?: "assigned" | "manual_review_required" | "failed";
    businessPhoneNumber?: string | null;
    error?: string | null;
  };
  error?: string;
};

type ToggleCardProps = {
  title: string;
  description: string;
  helper?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

type FieldProps = {
  label: string;
  helper: string;
  children: ReactNode;
};

type StatusMeta = {
  label: string;
  toneClass: string;
  helper: string;
};

type TimeOption = {
  value: string;
  label: string;
};

const EXISTING_NUMBER_LIVE_STATUSES = new Set<ReceptionistPhoneSetupStatus>([
  "existing_manual_review",
  "existing_ready",
  "porting_requested",
  "ported",
]);

const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Arizona Time (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)" },
];

function format12HourLabel(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function buildOfficeTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      options.push({ value, label: format12HourLabel(hour, minute) });
    }
  }
  return options;
}

const OFFICE_TIME_OPTIONS = buildOfficeTimeOptions();

function customTimeLabel(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return `${value} (Custom)`;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return `${value} (Custom)`;
  return `${format12HourLabel(hour, minute)} (Custom)`;
}

function keywordsToText(keywords: string[]): string {
  return keywords.join(", ");
}

function textToKeywords(value: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const raw of value.split(/[\n,;]+/)) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
  }

  return keywords;
}

function phoneSetupStatusMeta(status: ReceptionistPhoneSetupStatus): StatusMeta {
  if (status === "assigned") {
    return {
      label: "LockboxHQ number assigned",
      toneClass: "crm-chip crm-chip-ok",
      helper: "Your public business number is active in LockboxHQ.",
    };
  }

  if (status === "existing_submitted") {
    return {
      label: "Existing number submitted",
      toneClass: "crm-chip crm-chip-info",
      helper: "Your existing number request is captured and ready for setup-assisted review.",
    };
  }

  if (status === "existing_manual_review") {
    return {
      label: "Review required",
      toneClass: "crm-chip crm-chip-warn",
      helper: "A manual review step is required before this number can be fully active.",
    };
  }

  if (status === "existing_ready") {
    return {
      label: "Ready for manual setup",
      toneClass: "crm-chip crm-chip-ok",
      helper: "Core setup checks are complete and this number can be routed through manual steps.",
    };
  }

  if (status === "porting_requested") {
    return {
      label: "Porting requested",
      toneClass: "crm-chip crm-chip-info",
      helper: "Porting has been requested and is pending provider completion.",
    };
  }

  if (status === "ported") {
    return {
      label: "Ported",
      toneClass: "crm-chip crm-chip-ok",
      helper: "Your existing number has been ported and is ready to use in LockboxHQ.",
    };
  }

  return {
    label: "Not configured",
    toneClass: "crm-chip crm-chip-warn",
    helper: "Choose a phone setup path to unlock Concierge calling and texting.",
  };
}

function ToggleCard({ title, description, helper, checked, onChange }: ToggleCardProps) {
  return (
    <label className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          style={{ width: 18, height: 18 }}
        />
      </div>
      <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>{description}</span>
      {helper ? <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{helper}</span> : null}
    </label>
  );
}

function Field({ label, helper, children }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.4 }}>{helper}</span>
      {children}
    </label>
  );
}

export default function ReceptionistSettingsPage() {
  const preview = usePreviewMode();
  const conciergeLocked = true;
  const [settings, setSettings] = useState<ReceptionistSettings>(DEFAULT_RECEPTIONIST_SETTINGS);
  const [keywordsText, setKeywordsText] = useState(
    keywordsToText(DEFAULT_RECEPTIONIST_SETTINGS.escalation_keywords)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigningNumber, setAssigningNumber] = useState(false);
  const [message, setMessage] = useState("");

  const communicationsActive = useMemo(
    () => settings.receptionist_enabled && settings.communications_enabled,
    [settings.communications_enabled, settings.receptionist_enabled]
  );

  const parsedKeywords = useMemo(() => textToKeywords(keywordsText), [keywordsText]);
  const phoneSetupMeta = useMemo(
    () => phoneSetupStatusMeta(settings.phone_setup_status),
    [settings.phone_setup_status]
  );
  const officeTimeOptions = useMemo(() => {
    const options = [...OFFICE_TIME_OPTIONS];
    const seen = new Set(options.map((item) => item.value));

    for (const value of [settings.office_hours_start, settings.office_hours_end]) {
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push({ value, label: customTimeLabel(value) });
    }

    return options;
  }, [settings.office_hours_end, settings.office_hours_start]);
  const timezoneOptions = useMemo(() => {
    if (TIMEZONE_OPTIONS.some((option) => option.value === settings.office_hours_timezone)) {
      return TIMEZONE_OPTIONS;
    }
    if (!settings.office_hours_timezone) return TIMEZONE_OPTIONS;
    return [
      ...TIMEZONE_OPTIONS,
      { value: settings.office_hours_timezone, label: `${settings.office_hours_timezone} (Custom)` },
    ];
  }, [settings.office_hours_timezone]);

  const isLockboxPath = settings.phone_setup_path !== "existing_number";
  const businessPhone = settings.business_phone_number.trim();
  const forwardingPhone = settings.forwarding_phone_number.trim();
  const hasBusinessPhone = businessPhone.length > 0;
  const hasForwardingPhone = forwardingPhone.length > 0;
  const activationReady = hasBusinessPhone && hasForwardingPhone;

  useEffect(() => {
    let canceled = false;

    async function loadSettings() {
      if (preview) {
        const previewSettings: ReceptionistSettings = {
          ...DEFAULT_RECEPTIONIST_SETTINGS,
          business_phone_number: "(615) 555-0188",
          forwarding_phone_number: "(615) 555-0100",
          notification_phone_number: "(615) 555-0100",
          custom_greeting: "Hi, this is LockboxHQ Concierge. Tell me a little about your property or what you are looking for and we will follow up shortly.",
          phone_setup_path: "lockbox_number",
          phone_setup_status: "assigned",
          business_number_provider: "preview",
        };
        if (!canceled) {
          setSettings(previewSettings);
          setKeywordsText(keywordsToText(previewSettings.escalation_keywords));
          setMessage("Preview mode only.");
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/receptionist/settings", { cache: "no-store" });
        const payload = (await response.json()) as SettingsResponse;

        if (!response.ok || !payload.settings) {
          if (!canceled) setMessage(payload.error || "Could not load Concierge settings.");
          return;
        }

        if (!canceled) {
          setSettings(payload.settings);
          setKeywordsText(keywordsToText(payload.settings.escalation_keywords));
        }
      } catch {
        if (!canceled) setMessage("Could not load Concierge settings.");
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      canceled = true;
    };
  }, [preview]);

  function selectPhoneSetupPath(nextPath: ReceptionistPhoneSetupPath) {
    setSettings((previous) => {
      const next: ReceptionistSettings = {
        ...previous,
        phone_setup_path: nextPath,
      };

      if (nextPath === "lockbox_number") {
        next.phone_setup_status = previous.business_phone_number.trim() ? "assigned" : "unassigned";
        if (!next.business_number_provider) {
          next.business_number_provider = "";
        }
        return next;
      }

      if (!previous.business_number_provider) {
        next.business_number_provider = "manual";
      }

      if (!previous.business_phone_number.trim()) {
        next.phone_setup_status = "unassigned";
      } else if (!EXISTING_NUMBER_LIVE_STATUSES.has(previous.phone_setup_status)) {
        next.phone_setup_status = "existing_submitted";
      }

      return next;
    });
  }

  async function assignLockboxNumber() {
    if (preview) {
      setMessage("Preview mode only.");
      return;
    }

    setAssigningNumber(true);
    setMessage("");

    try {
      const response = await fetch("/api/receptionist/number/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as NumberAssignResponse;
      if (!response.ok || !data.ok || !data.settings) {
        setMessage(data.error || data.assignment?.error || "Could not assign a LockboxHQ number.");
        return;
      }

      setSettings(data.settings);
      const mode = data.assignment?.mode === "mock" ? " (mock provider mode)" : "";
      setMessage(`LockboxHQ business number assigned${mode}.`);
    } catch {
      setMessage("Could not assign a LockboxHQ number.");
    } finally {
      setAssigningNumber(false);
    }
  }

  async function saveSettings() {
    if (preview) {
      setMessage("Preview mode only.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const nextKeywords = textToKeywords(keywordsText);
      const nowIso = new Date().toISOString();
      const trimmedBusinessPhone = settings.business_phone_number.trim();

      let nextStatus = settings.phone_setup_status;
      let nextSubmittedAt = settings.existing_number_submitted_at;
      let nextProvider = settings.business_number_provider;

      if (settings.phone_setup_path === "lockbox_number") {
        nextStatus = trimmedBusinessPhone ? "assigned" : "unassigned";
        nextSubmittedAt = "";
      } else {
        nextProvider = nextProvider || "manual";
        if (!trimmedBusinessPhone) {
          nextStatus = "unassigned";
          nextSubmittedAt = "";
        } else if (!EXISTING_NUMBER_LIVE_STATUSES.has(nextStatus)) {
          nextStatus = "existing_submitted";
          nextSubmittedAt = nextSubmittedAt || nowIso;
        }
      }

      const payload: ReceptionistSettings = {
        ...settings,
        business_phone_number: trimmedBusinessPhone,
        business_number_provider: nextProvider,
        escalation_keywords: nextKeywords,
        phone_setup_status: nextStatus,
        existing_number_submitted_at: nextSubmittedAt,
      };

      const response = await fetch("/api/receptionist/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.settings) {
        setMessage(data.error || "Could not save Concierge settings.");
        return;
      }

      setSettings(data.settings);
      setKeywordsText(keywordsToText(data.settings.escalation_keywords));
      setMessage("Concierge settings saved.");
    } catch {
      setMessage("Could not save Concierge settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading Concierge settings...</div>
        </section>
      </main>
    );
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Concierge</h1>
            <p className="crm-page-subtitle">
              Concierge is the premium upgrade for missed-call follow-up, direct calling and texting, and faster response on serious inbound inquiries.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/settings" className="crm-btn crm-btn-secondary">
              Back to Settings
            </Link>
          </div>
        </div>

        {conciergeLocked ? (
          <div className="crm-concierge-brew-banner">
            <div className="crm-concierge-brew-banner__eyebrow">Being Brewed</div>
            <div className="crm-concierge-brew-banner__title">Concierge is under construction right now.</div>
            <div className="crm-concierge-brew-banner__copy">
              This upgrade will unlock calling, texting, and missed-call follow-up inside LockboxHQ. For now, the setup page is view-only while the workflow is still being finished.
            </div>
          </div>
        ) : null}

        <div className="crm-card-muted" style={{ padding: 14, display: "grid", gap: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2 className="crm-section-title" style={{ margin: 0 }}>
              How it works
            </h2>
            <span
              className={
                communicationsActive && activationReady ? "crm-chip crm-chip-ok" : "crm-chip crm-chip-warn"
              }
            >
              {communicationsActive && activationReady ? "Live and ready" : "Setup in progress"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.55 }}>
            Once Concierge is active, your LockboxHQ business number can power missed-call text-back, direct SMS
            conversations, captured lead details, and urgent alerts without bouncing you across separate tools.
          </p>
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: "var(--ink)",
              display: "grid",
              gap: 6,
            }}
          >
            <li>Lead calls or texts your business number.</li>
            <li>LockboxHQ records the interaction and links it to a lead record.</li>
            <li>If the call is missed, LockboxHQ can send your starter SMS automatically.</li>
            <li>Lead replies are captured and qualification data updates the CRM.</li>
            <li>Urgent language can trigger high-priority alerts.</li>
          </ol>
        </div>
      </section>

      <div className={`crm-concierge-locked-shell${conciergeLocked ? " crm-concierge-locked-shell-active" : ""}`}>
        {conciergeLocked ? (
          <div className="crm-concierge-locked-overlay" aria-hidden="true">
            <div className="crm-concierge-locked-panel">
              <div className="crm-concierge-locked-panel__eyebrow">Premium Upgrade</div>
              <div className="crm-concierge-locked-panel__title">Concierge setup is being brewed.</div>
              <div className="crm-concierge-locked-panel__copy">
                The workflow for calling, texting, and missed-call follow-up is still under construction, so this page is intentionally view-only for now.
              </div>
            </div>
          </div>
        ) : null}

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Upgrade Status</h2>
            <span className={communicationsActive ? "crm-chip crm-chip-ok" : "crm-chip crm-chip-warn"}>
              {communicationsActive ? "Messaging Active" : "Messaging Paused"}
            </span>
          </div>

          <div className="crm-grid-cards-3">
            <ToggleCard
              title="Concierge Active"
              description="Master switch for the Concierge upgrade. Turn this on to unlock LockboxHQ communication workflows."
              checked={settings.receptionist_enabled}
              onChange={(next) =>
                setSettings((previous) => ({ ...previous, receptionist_enabled: next }))
              }
            />
            <ToggleCard
              title="Messaging Active"
              description="Allows SMS send and receive inside LockboxHQ after Concierge is enabled."
              helper="Tip: Concierge Active and Messaging Active both need to be on for automatic responses."
              checked={settings.communications_enabled}
              onChange={(next) =>
                setSettings((previous) => ({ ...previous, communications_enabled: next }))
              }
            />
            <ToggleCard
              title="Missed Call Auto-Reply"
              description="When enabled, Concierge can send your starter SMS after a missed call based on your after-hours rules."
              checked={settings.missed_call_textback_enabled}
              onChange={(next) =>
                setSettings((previous) => ({ ...previous, missed_call_textback_enabled: next }))
              }
            />
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Phone Setup</h2>
            <span className={phoneSetupMeta.toneClass}>{phoneSetupMeta.label}</span>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            Choose how Concierge should handle your public-facing business number. A new LockboxHQ number is the fastest path to activation.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Get a New LockboxHQ Number</h3>
                <span className="crm-chip crm-chip-ok">Recommended</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>
                Fastest upgrade setup. LockboxHQ assigns a business number so Concierge can start handling calls and texts quickly.
              </p>
              <button
                type="button"
                className={isLockboxPath ? "crm-btn crm-btn-primary" : "crm-btn crm-btn-secondary"}
                onClick={() => selectPhoneSetupPath("lockbox_number")}
                style={{ width: "fit-content" }}
              >
                {isLockboxPath ? "Selected" : "Choose This Path"}
              </button>
            </div>

            <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Use My Existing Business Number</h3>
                <span className="crm-chip">Setup-Assisted</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>
                Keep your current number. Some Concierge setups require manual review, forwarding configuration, or porting support.
              </p>
              <button
                type="button"
                className={!isLockboxPath ? "crm-btn crm-btn-primary" : "crm-btn crm-btn-secondary"}
                onClick={() => selectPhoneSetupPath("existing_number")}
                style={{ width: "fit-content" }}
              >
                {!isLockboxPath ? "Selected" : "Choose This Path"}
              </button>
            </div>
          </div>

          {isLockboxPath ? (
            <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>
                This path does not require manually typing a business number.
              </p>

              {hasBusinessPhone ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <Field
                    label="LockboxHQ Business Number"
                    helper="This is your public-facing number for lead calls and texts."
                  >
                    <input value={businessPhone} readOnly />
                  </Field>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="crm-chip crm-chip-ok">Assigned</span>
                    {settings.business_number_provider ? (
                      <span className="crm-chip">Provider: {settings.business_number_provider}</span>
                    ) : null}
                    <span className="crm-chip">Read-only in V1</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="crm-chip crm-chip-warn">No LockboxHQ number assigned yet</span>
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    onClick={() => void assignLockboxNumber()}
                    disabled={assigningNumber}
                    style={{ width: "fit-content" }}
                  >
                    {assigningNumber ? "Assigning..." : "Get My LockboxHQ Number"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}>
                Already using a business number? Keep it. LockboxHQ supports existing-number onboarding, and some cases may
                require porting or manual configuration.
              </p>
              <Field
                label="Existing Business Number"
                helper="This is the public-facing number you already use in marketing and client communication."
              >
                <input
                  value={settings.business_phone_number}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      business_phone_number: event.target.value,
                    }))
                  }
                  placeholder="+1..."
                />
              </Field>
              <Field
                label="Setup Notes (Optional)"
                helper="Add context for setup-assisted review, forwarding, or porting details."
              >
                <textarea
                  rows={3}
                  value={settings.existing_number_setup_notes}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      existing_number_setup_notes: event.target.value,
                    }))
                  }
                  placeholder="Example: Number is currently in another platform. Need guidance on forwarding or porting timeline."
                />
              </Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={phoneSetupMeta.toneClass}>{phoneSetupMeta.label}</span>
                {settings.existing_number_submitted_at ? (
                  <span className="crm-chip">
                    Submitted: {new Date(settings.existing_number_submitted_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)" }}>{phoneSetupMeta.helper}</p>
            </div>
          )}

          <div className="crm-grid-cards-3">
            <Field
              label="Forwarding Phone"
              helper="This is your real phone that rings when LockboxHQ bridges inbound and outbound calls."
            >
              <input
                value={settings.forwarding_phone_number}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, forwarding_phone_number: event.target.value }))
                }
                placeholder="+1..."
              />
            </Field>

            <Field
              label="Notification Phone"
              helper="Urgent lead alerts can be sent here. Leave blank if you only want in-app alerts."
            >
              <input
                value={settings.notification_phone_number}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, notification_phone_number: event.target.value }))
                }
                placeholder="+1..."
              />
            </Field>

            <div className="crm-card-muted" style={{ padding: 10, display: "grid", gap: 8, alignContent: "start" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Routing Readiness</span>
              <span className={hasBusinessPhone ? "crm-chip crm-chip-ok" : "crm-chip crm-chip-warn"}>
                {hasBusinessPhone ? "Business number configured" : "Business number missing"}
              </span>
              <span className={hasForwardingPhone ? "crm-chip crm-chip-ok" : "crm-chip crm-chip-warn"}>
                {hasForwardingPhone ? "Forwarding phone configured" : "Forwarding phone missing"}
              </span>
              <span className={activationReady ? "crm-chip crm-chip-ok" : "crm-chip"}>
                {activationReady ? "Call routing ready" : "Complete both numbers"}
              </span>
            </div>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">After-Hours Behavior</h2>
          </div>

          <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
              When After-Hours Mode is on, missed-call text-back runs only outside your office hours. When it is off,
              missed-call text-back can run anytime.
            </p>
            <ToggleCard
              title="After-Hours Mode"
              description="Limit missed-call auto-replies to outside your working hours."
              checked={settings.after_hours_enabled}
              onChange={(next) =>
                setSettings((previous) => ({ ...previous, after_hours_enabled: next }))
              }
            />
          </div>

          <div className="crm-grid-cards-3">
            <Field label="Office Hours Start" helper="Select when your day starts. Times are shown in standard AM/PM format.">
              <select
                value={settings.office_hours_start}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, office_hours_start: event.target.value }))
                }
              >
                {officeTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Office Hours End" helper="Select when your day ends. Times are shown in standard AM/PM format.">
              <select
                value={settings.office_hours_end}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, office_hours_end: event.target.value }))
                }
              >
                {officeTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Timezone" helper="Central Time is default. Choose your local timezone for after-hours logic.">
              <select
                value={settings.office_hours_timezone}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, office_hours_timezone: event.target.value }))
                }
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Urgency / Escalation</h2>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            If a lead uses phrases like "asap", "tour", or "ready now", LockboxHQ can flag that conversation as urgent
            and surface alerts faster.
          </p>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Escalation Keywords</span>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              Separate with commas, new lines, or semicolons.
            </span>
            <textarea
              rows={3}
              value={keywordsText}
              onChange={(event) => setKeywordsText(event.target.value)}
              placeholder="today, asap, ready now, call me, tour, offer"
            />
          </label>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {parsedKeywords.length > 0 ? (
              parsedKeywords.slice(0, 10).map((keyword) => (
                <span key={keyword} className="crm-chip" style={{ textTransform: "none" }}>
                  {keyword}
                </span>
              ))
            ) : (
              <span className="crm-chip crm-chip-warn">No keywords configured</span>
            )}
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Starter Message</h2>
          </div>

          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            This is the first automatic SMS sent after a missed call. Keep it professional and concise. This is not a
            live voice greeting.
          </p>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Missed-Call Starter Text</span>
            <textarea
              rows={4}
              value={settings.custom_greeting}
              onChange={(event) =>
                setSettings((previous) => ({ ...previous, custom_greeting: event.target.value }))
              }
              placeholder="Hi, this is the assistant for [Agent Name]. Sorry we missed your call. Are you looking to buy, sell, or invest?"
            />
          </label>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
            {!activationReady ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
                Complete Business Number and Forwarding Phone to fully activate call and text routing.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
                Phone setup looks good. Save to apply any changes.
              </p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Concierge Settings"}
              </button>
              <Link href="/app/list" className="crm-btn crm-btn-secondary">
                Open Leads Workspace
              </Link>
            </div>

            {message ? <div className="crm-chip">{message}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
