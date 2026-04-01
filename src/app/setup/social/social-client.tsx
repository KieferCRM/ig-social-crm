"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LockboxMark from "@/components/branding/lockbox-mark";
import { getOnboardingStepKicker } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-telemetry";

type Props = {
  initialInstagram: string;
  initialFacebook: string;
  initialLinkedin: string;
  initialYoutube: string;
  initialWebsite: string;
};

export default function SocialClient({
  initialInstagram,
  initialFacebook,
  initialLinkedin,
  initialYoutube,
  initialWebsite,
}: Props) {
  const router = useRouter();
  const [instagram, setInstagram] = useState(initialInstagram);
  const [facebook, setFacebook] = useState(initialFacebook);
  const [linkedin, setLinkedin] = useState(initialLinkedin);
  const [youtube, setYoutube] = useState(initialYoutube);
  const [website, setWebsite] = useState(initialWebsite);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void recordOnboardingEvent({
      event_name: "step_view",
      step: "social",
      surface: "setup/social",
    });
  }, []);

  async function finish(skip = false) {
    setSaving(true);
    setError("");

    try {
      if (!skip) {
        const res = await fetch("/api/agent/social", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instagram, facebook, linkedin, youtube, website }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Could not save social handles.");
          setSaving(false);
          return;
        }
      }

      // Complete onboarding
      const completeResponse = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const completeData = (await completeResponse.json()) as { ok?: boolean; error?: string };
      if (!completeResponse.ok || !completeData.ok) {
        setError(completeData.error ?? "Could not complete onboarding.");
        setSaving(false);
        return;
      }

      void recordOnboardingEvent({
        event_name: "step_complete",
        step: "social",
        status: "completed",
        surface: "setup/social",
      });

      router.replace("/setup/complete");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">{getOnboardingStepKicker("social")}</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Where can people find you?</h1>
            <p className="crm-auth-subtitle">
              All optional. We&apos;ll use these to build your public agent profile — a single link you can share anywhere.
            </p>
          </div>

          <div className="crm-stack-10">
            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>Instagram</span>
              <input
                className="crm-input"
                type="text"
                placeholder="@yourhandle"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>Facebook</span>
              <input
                className="crm-input"
                type="text"
                placeholder="facebook.com/yourpage"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>LinkedIn</span>
              <input
                className="crm-input"
                type="text"
                placeholder="linkedin.com/in/yourprofile"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>YouTube</span>
              <input
                className="crm-input"
                type="text"
                placeholder="youtube.com/@yourchannel"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="crm-public-intake-field crm-public-intake-field-full">
              <span style={{ fontWeight: 600 }}>Website</span>
              <input
                className="crm-input"
                type="url"
                placeholder="yoursite.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoComplete="url"
              />
            </label>

            {error ? (
              <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
            ) : null}

            <div className="crm-inline-actions" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void finish(true)}
                disabled={saving}
                style={{ fontSize: 13 }}
              >
                {saving ? "Finishing..." : "Skip for now"}
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void finish(false)}
                disabled={saving}
              >
                {saving ? "Saving..." : "Finish setup"}
              </button>
            </div>
          </div>
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">Coming soon</div>
          <h2 className="crm-auth-panel-title">One link for everything.</h2>
          <p className="crm-auth-panel-body">
            Your public agent profile will combine your bio, social links, seller form, contact form,
            and reviews into a single shareable page — perfect for your Instagram bio, email signature,
            or business card.
          </p>
          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>All your links in one branded page</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>You can add or update handles anytime in Profile Settings</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>We store this now so your profile is ready when we launch it</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
