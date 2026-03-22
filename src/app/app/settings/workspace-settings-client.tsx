"use client";

import { useEffect, useMemo, useState } from "react";
import type { SocialScript, WorkspaceSettings } from "@/lib/workspace-settings";

type SettingsResponse = {
  settings?: WorkspaceSettings;
  error?: string;
};

function emptySettings(): WorkspaceSettings {
  return {
    booking_link: "",
    hot_lead_notification_mode: "business_hours", // kept in type for DB compat
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
