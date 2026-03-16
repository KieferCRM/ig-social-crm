"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  HotLeadNotificationMode,
  SocialScript,
  WorkspaceSettings,
} from "@/lib/workspace-settings";

type SettingsResponse = {
  settings?: WorkspaceSettings;
  error?: string;
};

const NOTIFICATION_OPTIONS: Array<{
  value: HotLeadNotificationMode;
  label: string;
}> = [
  { value: "immediate", label: "Notify immediately" },
  { value: "business_hours", label: "Notify during business hours" },
  { value: "daily_summary", label: "Include in daily summary" },
  { value: "crm_only", label: "Mark in CRM only" },
];

function emptySettings(): WorkspaceSettings {
  return {
    booking_link: "",
    hot_lead_notification_mode: "business_hours",
    hot_lead_business_hours_start: "09:00",
    hot_lead_business_hours_end: "18:00",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
    saved_scripts: [],
    documents: [],
  };
}

export default function WorkspaceSettingsClient() {
  const [settings, setSettings] = useState<WorkspaceSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/workspace/settings", { cache: "no-store" });
        const data = (await response.json()) as SettingsResponse;
        if (!active) return;
        if (!response.ok || !data.settings) {
          setMessage(data.error || "Could not load workspace settings.");
          setLoading(false);
          return;
        }
        setSettings(data.settings);
        setMessage("");
      } catch {
        if (active) setMessage("Could not load workspace settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const scriptRows = useMemo(() => settings.saved_scripts || [], [settings.saved_scripts]);

  function updateScript(id: string, nextBody: string) {
    setSettings((previous) => ({
      ...previous,
      saved_scripts: previous.saved_scripts.map((script) =>
        script.id === id ? { ...script, body: nextBody } : script
      ),
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        booking_link: settings.booking_link,
        hot_lead_notification_mode: settings.hot_lead_notification_mode,
        hot_lead_business_hours_start: settings.hot_lead_business_hours_start,
        hot_lead_business_hours_end: settings.hot_lead_business_hours_end,
        instagram_url: settings.instagram_url,
        facebook_url: settings.facebook_url,
        tiktok_url: settings.tiktok_url,
        saved_scripts: settings.saved_scripts.map((script: SocialScript) => ({
          id: script.id,
          title: script.title,
          body: script.body,
          category: script.category,
        })),
      };

      const response = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.settings) {
        setMessage(data.error || "Could not save workspace settings.");
        return;
      }
      setSettings(data.settings);
      setMessage("Workspace settings saved.");
    } catch {
      setMessage("Could not save workspace settings.");
    } finally {
      setSaving(false);
    }
  }

  const buyerLink = origin ? `${origin}/buyer` : "/buyer";
  const sellerLink = origin ? `${origin}/seller` : "/seller";

  return (
    <section className="crm-card crm-section-card crm-stack-12">
      <div className="crm-section-head">
        <div>
          <h2 className="crm-section-title">Workspace settings</h2>
          <p className="crm-section-subtitle">
            Keep booking, hot-lead notifications, social links, and saved scripts in one place.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading workspace settings...</div>
      ) : (
        <>
          <div className="crm-grid-cards-2">
            <article className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>Call booking</div>
              <label className="crm-filter-field">
                <span>Booking link</span>
                <input
                  value={settings.booking_link}
                  onChange={(event) =>
                    setSettings((previous) => ({ ...previous, booking_link: event.target.value }))
                  }
                  placeholder="https://calendly.com/your-link"
                />
              </label>
              <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                Shown after buyer and seller form submission as an optional next step.
              </div>
            </article>

            <article className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>Hot lead notifications</div>
              <label className="crm-filter-field">
                <span>Preference</span>
                <select
                  value={settings.hot_lead_notification_mode}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      hot_lead_notification_mode: event.target.value as HotLeadNotificationMode,
                    }))
                  }
                >
                  {NOTIFICATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="crm-inline-actions" style={{ gap: 10 }}>
                <label className="crm-filter-field" style={{ flex: 1 }}>
                  <span>Business hours start</span>
                  <input
                    type="time"
                    value={settings.hot_lead_business_hours_start}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        hot_lead_business_hours_start: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="crm-filter-field" style={{ flex: 1 }}>
                  <span>Business hours end</span>
                  <input
                    type="time"
                    value={settings.hot_lead_business_hours_end}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        hot_lead_business_hours_end: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </article>
          </div>

          <div className="crm-grid-cards-3">
            <label className="crm-filter-field">
              <span>Instagram URL</span>
              <input
                value={settings.instagram_url}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, instagram_url: event.target.value }))
                }
                placeholder="https://instagram.com/yourprofile"
              />
            </label>
            <label className="crm-filter-field">
              <span>Facebook URL</span>
              <input
                value={settings.facebook_url}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, facebook_url: event.target.value }))
                }
                placeholder="https://facebook.com/yourpage"
              />
            </label>
            <label className="crm-filter-field">
              <span>TikTok URL</span>
              <input
                value={settings.tiktok_url}
                onChange={(event) =>
                  setSettings((previous) => ({ ...previous, tiktok_url: event.target.value }))
                }
                placeholder="https://tiktok.com/@yourprofile"
              />
            </label>
          </div>

          <article className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>Public forms</div>
            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              These are the two V1 forms for social profiles, QR codes, DMs, comments, and direct
              link sharing.
            </div>
            <div className="crm-grid-cards-2">
              <div className="crm-intake-link-box">
                <div className="crm-detail-label">Buyer form</div>
                <code>{buyerLink}</code>
              </div>
              <div className="crm-intake-link-box">
                <div className="crm-detail-label">Seller form</div>
                <code>{sellerLink}</code>
              </div>
            </div>
            <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
              <a href="/buyer" target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                Open buyer form
              </a>
              <a href="/seller" target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                Open seller form
              </a>
              <a href="/app/intake" className="crm-btn crm-btn-primary">
                Open intake workspace
              </a>
            </div>
          </article>

          <article className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>Saved scripts</div>
            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Keep lightweight outreach copy close to the Social Media page and everyday follow-up.
            </div>
            <div className="crm-stack-8">
              {scriptRows.map((script) => (
                <label key={script.id} className="crm-filter-field">
                  <span>{script.title}</span>
                  <textarea
                    rows={4}
                    value={script.body}
                    onChange={(event) => updateScript(script.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>

          <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Save once and the intake, social, and follow-up surfaces will use the same settings.
            </div>
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>

          {message ? (
            <div
              className={`crm-chip ${message.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}
              style={{ width: "fit-content" }}
            >
              {message}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
