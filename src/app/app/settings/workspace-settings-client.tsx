"use client";

import { useEffect, useState } from "react";
import type { WorkspaceSettings } from "@/lib/workspace-settings";

type SettingsResponse = {
  settings?: WorkspaceSettings;
  error?: string;
};

function emptySettings(): WorkspaceSettings {
  return {
    booking_link: "",
    hot_lead_notification_mode: "business_hours",
    hot_lead_business_hours_start: "09:00",
    hot_lead_business_hours_end: "18:00",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
    youtube_url: "",
    linkedin_url: "",
    saved_scripts: [],
    documents: [],
    operator_path: "real_estate",
    profile_template: "wholesaler",
    profile_company_name: "",
    profile_tagline: "",
    profile_bio: "",
    profile_headshot_url: "",
    profile_service_areas: [],
    profile_testimonials: [],
    profile_listings: [],
    profile_show_contact_form: true,
    profile_public: false,
    profile_stats: [],
    profile_how_it_works: [],
    profile_theme: null,
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

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        // Preserve existing values for fields we no longer show
        booking_link: settings.booking_link,
        instagram_url: settings.instagram_url,
        facebook_url: settings.facebook_url,
        tiktok_url: settings.tiktok_url,
        saved_scripts: settings.saved_scripts,
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
      setMessage("Settings saved.");
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
            Manage hot-lead notification preferences for your workspace.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading workspace settings...</div>
      ) : (
        <>
          <div className="crm-inline-actions" style={{ justifyContent: "flex-end" }}>
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
