"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import IntakeShareKit from "@/components/intake/intake-share-kit";

type OnboardingClientProps = {
  agentFirstName: string;
  intakePath: string;
};

const SAMPLE_PREVIEW = [
  {
    label: "Hot inquiry",
    detail: "Recent buyer inquiry with a 0-3 month timeframe and a next step due now.",
  },
  {
    label: "Warm follow-up",
    detail: "Seller opportunity with a 3-6 month timeframe and a scheduled follow-up.",
  },
  {
    label: "Active deal",
    detail: "One sample deal already sitting in the board so you can see the workflow clearly.",
  },
] as const;

export default function OnboardingClient({
  agentFirstName,
  intakePath,
}: OnboardingClientProps) {
  const router = useRouter();
  const [saveError, setSaveError] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  async function completeOnboarding() {
    if (isCompleting) return;
    setIsCompleting(true);
    setSaveError("");

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Unable to save onboarding progress.");
      }

      router.push("/app?onboarding=done");
      router.refresh();
    } catch {
      setSaveError("We couldn't finish setup yet. Try again.");
      setIsCompleting(false);
    }
  }

  return (
    <main className="crm-onboarding-page">
      <section className="crm-onboarding-shell crm-onboarding-shell-simplified">
        <header className="crm-onboarding-header">
          <div className="crm-onboarding-brand">
            <MerlynMascot decorative />
            <div>
              <div className="crm-onboarding-brand-kicker">MERLYN</div>
              <div className="crm-onboarding-brand-subtitle">Inbound CRM for solo real estate agents</div>
            </div>
          </div>
          <div className="crm-onboarding-header-actions">
            <span className="crm-chip crm-chip-ok">First-time setup</span>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={completeOnboarding}
              disabled={isCompleting}
            >
              {isCompleting ? "Opening..." : "Open my workspace"}
            </button>
          </div>
        </header>

        <section className="crm-onboarding-hero crm-onboarding-hero-compact">
          <div className="crm-onboarding-headline">
            <div className="crm-onboarding-kicker">TURN ON YOUR INBOUND FLOW</div>
            <h1>{agentFirstName}, your workspace is almost ready.</h1>
            <p>
              Finish setup, share your intake link, and Merlyn will drop new inquiries into your actual
              workspace with sample records already waiting so you can see how everything works.
            </p>
            <div className="crm-onboarding-trust-row" aria-label="Setup highlights">
              <span>Real sample leads and deals</span>
              <span>QR ready for open houses</span>
              <span>Lives in your actual CRM</span>
            </div>
          </div>
        </section>

        <section className="crm-onboarding-simple-grid">
          <article className="crm-card crm-onboarding-card">
            <div className="crm-onboarding-card-head">
              <div>
                <div className="crm-onboarding-card-kicker">Questionnaire Preview</div>
                <h2>This is what your leads will fill out.</h2>
              </div>
            </div>

            <div className="crm-onboarding-form-preview">
              <div className="crm-onboarding-form-grid">
                <label className="crm-onboarding-field">
                  <span>Full name</span>
                  <input disabled value="" placeholder="Jordan Mitchell" />
                </label>
                <label className="crm-onboarding-field">
                  <span>Best phone number</span>
                  <input disabled value="" placeholder="(615) 555-0182" />
                </label>
                <label className="crm-onboarding-field">
                  <span>What are you looking to do?</span>
                  <select disabled defaultValue="">
                    <option value="">Choose one</option>
                    <option>Buy</option>
                    <option>Sell</option>
                    <option>Rent</option>
                    <option>Invest</option>
                  </select>
                </label>
                <label className="crm-onboarding-field">
                  <span>What&apos;s your timeframe?</span>
                  <select disabled defaultValue="">
                    <option value="">Choose one</option>
                    <option>0-3 months</option>
                    <option>3-6 months</option>
                    <option>6+ months</option>
                  </select>
                </label>
                <label className="crm-onboarding-field crm-onboarding-field-full">
                  <span>Area, neighborhood, or property</span>
                  <input disabled value="" placeholder="East Nashville or 123 Main St" />
                </label>
                <label className="crm-onboarding-field crm-onboarding-field-full">
                  <span>Anything else we should know?</span>
                  <textarea disabled rows={3} placeholder="Helpful details before the follow-up." />
                </label>
              </div>
            </div>
          </article>

          <IntakeShareKit
            intakePath={intakePath}
            title="Share your intake anywhere leads already find you."
            description="Use this link and QR code for open houses, business cards, flyers, and social profiles."
            openLabel="Preview intake form"
            downloadName="merlyn-intake-qr.png"
          />
        </section>

        <section className="crm-card crm-onboarding-card crm-onboarding-workflow-card">
          <div className="crm-onboarding-card-head">
            <div>
              <div className="crm-onboarding-card-kicker">Sample Workspace</div>
              <h2>You'll land in a real workspace, not a fake demo.</h2>
            </div>
          </div>

          <div className="crm-onboarding-workflow-grid">
            <div className="crm-onboarding-workflow-copy">
              <ol className="crm-onboarding-steps">
                <li>Finish onboarding once.</li>
                <li>Merlyn seeds a small set of clearly marked sample records.</li>
                <li>You can inspect Today, Deals, Intake, and Priorities right away.</li>
              </ol>
              <div className="crm-onboarding-action-note">
                Sample records are added once and can be removed later from Intake.
              </div>
            </div>

            <div className="crm-stack-8">
              {SAMPLE_PREVIEW.map((item) => (
                <div key={item.label} className="crm-onboarding-lead-card crm-onboarding-lead-card-static">
                  <div className="crm-onboarding-lead-card-head">
                    <strong>{item.label}</strong>
                    <span>Sample</span>
                  </div>
                  <div className="crm-onboarding-lead-card-note">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="crm-card crm-onboarding-card crm-onboarding-success-card">
          <div className="crm-onboarding-card-kicker">Ready To Start</div>
          <h2>Open your CRM, review the seeded sample data, then swap in real leads.</h2>
          <p>
            The Intake page will give you the QR code, the share link, and a manual add flow whenever you
            need to test or enter something by hand.
          </p>

          <div className="crm-onboarding-next-strip">
            <span>Share the intake link</span>
            <span>Review sample leads</span>
            <span>Remove samples when you're ready</span>
          </div>

          {saveError ? <div className="crm-onboarding-error">{saveError}</div> : null}
        </section>
      </section>
    </main>
  );
}
