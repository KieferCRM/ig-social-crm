"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MerlynMascot from "@/components/branding/merlyn-mascot";

type OnboardingClientProps = {
  agentFirstName: string;
  intakePath: string;
};

type StageKey = "new" | "contacted";

type DemoLead = {
  name: string;
  phone: string;
  intent: string;
  priceRange: string;
  timeline: string;
  notes: string;
};

const LINK_PLACEMENTS = [
  "Instagram bio",
  "Facebook profile",
  "TikTok bio",
  "Linktree",
  "Website contact page",
  "Email signature",
  "Open house QR code",
] as const;

const SIMULATED_LEAD: DemoLead = {
  name: "John Carter",
  phone: "(615) 555-0184",
  intent: "Buying",
  priceRange: "$450k-$600k",
  timeline: "3 Months",
  notes: "Looking for a home near downtown",
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function OnboardingClient({
  agentFirstName,
  intakePath,
}: OnboardingClientProps) {
  const router = useRouter();
  const [intakeUrl, setIntakeUrl] = useState(`https://merlyncrm.com${intakePath}`);
  const [qrVisible, setQrVisible] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [leadStage, setLeadStage] = useState<StageKey>("new");
  const [leadMoved, setLeadMoved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const qrCodeUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?format=png&size=520x520&data=${encodeURIComponent(intakeUrl)}`,
    [intakeUrl]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIntakeUrl(`${window.location.origin}${intakePath}`);
  }, [intakePath]);

  async function handleCopyLink() {
    const ok = await copyText(intakeUrl);
    setLinkMessage(ok ? "Copied" : "Copy failed");
    window.setTimeout(() => setLinkMessage(""), 1800);
  }

  async function handleDownloadQr() {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "merlyn-open-house-qr.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(qrCodeUrl, "_blank", "noopener,noreferrer");
    }
  }

  function simulateLeadAppearance() {
    if (isSimulating || showLead) return;
    setIsSimulating(true);
    window.setTimeout(() => {
      setShowLead(true);
      setLeadStage("new");
      setIsSimulating(false);
    }, 2400);
  }

  function handleDrop(stage: StageKey) {
    if (!showLead) return;
    setLeadStage(stage);
    if (stage === "contacted") {
      setLeadMoved(true);
    }
  }

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
      setSaveError("We couldn’t finish setup yet. Try again.");
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
              <div className="crm-onboarding-brand-subtitle">Inbound lead CRM for solo agents</div>
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
              {isCompleting ? "Opening..." : "Go To My CRM"}
            </button>
          </div>
        </header>

        <section className="crm-onboarding-hero crm-onboarding-hero-compact">
          <div className="crm-onboarding-headline">
            <div className="crm-onboarding-kicker">TURN ON YOUR LEAD CAPTURE</div>
            <h1>Turn On Your Lead Capture</h1>
            <p>
              Merlyn captures serious buyer and seller inquiries automatically. Add your intake link anywhere
              clients contact you.
            </p>
            <div className="crm-onboarding-trust-row" aria-label="Setup highlights">
              <span>No account required for the lead</span>
              <span>Takes under a minute</span>
              <span>Lead goes straight to your pipeline</span>
            </div>
          </div>
        </section>

        <section className="crm-onboarding-simple-grid">
          <article className="crm-card crm-onboarding-card">
            <div className="crm-onboarding-card-head">
              <div>
                <div className="crm-onboarding-card-kicker">Questionnaire Preview</div>
                <h2>This is what your clients fill out.</h2>
              </div>
            </div>

            <div className="crm-onboarding-form-preview">
              <div className="crm-onboarding-form-grid">
                <label className="crm-onboarding-field">
                  <span>Name</span>
                  <input disabled value="" placeholder="Jane Doe" />
                </label>
                <label className="crm-onboarding-field">
                  <span>Phone Number</span>
                  <input disabled value="" placeholder="(615) 555-0184" />
                </label>
                <label className="crm-onboarding-field">
                  <span>Buying or Selling</span>
                  <select disabled defaultValue="">
                    <option value="">Choose one</option>
                    <option>Buying</option>
                    <option>Selling</option>
                  </select>
                </label>
                <label className="crm-onboarding-field">
                  <span>Price Range</span>
                  <select disabled defaultValue="">
                    <option value="">Choose range</option>
                    <option>$250k-$450k</option>
                    <option>$450k-$600k</option>
                    <option>$600k+</option>
                  </select>
                </label>
                <label className="crm-onboarding-field">
                  <span>Timeline</span>
                  <select disabled defaultValue="">
                    <option value="">Choose timeline</option>
                    <option>ASAP</option>
                    <option>1-3 Months</option>
                    <option>3+ Months</option>
                  </select>
                </label>
                <label className="crm-onboarding-field crm-onboarding-field-full">
                  <span>Notes</span>
                  <textarea disabled rows={3} placeholder="Anything else we should know?" />
                </label>
              </div>
            </div>
          </article>

          <article className="crm-card crm-onboarding-card">
            <div className="crm-onboarding-card-head">
              <div>
                <div className="crm-onboarding-card-kicker">Your Lead Capture Link</div>
                <h2>Share this anywhere clients already contact you.</h2>
              </div>
            </div>

            <div className="crm-onboarding-link-box">
              <code>{intakeUrl.replace(/^https?:\/\//, "")}</code>
            </div>

            <div className="crm-onboarding-link-actions">
              <button type="button" className="crm-btn crm-btn-primary" onClick={handleCopyLink}>
                Copy Link
              </button>
              <Link href={intakePath} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                Open Form
              </Link>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setQrVisible((value) => !value)}
              >
                Generate QR Code
              </button>
            </div>

            {linkMessage ? <div className="crm-onboarding-link-status">{linkMessage}</div> : null}

            <div className="crm-onboarding-placement-list">
              {LINK_PLACEMENTS.map((item) => (
                <span key={item} className="crm-onboarding-placement-pill">
                  {item}
                </span>
              ))}
            </div>

            {qrVisible ? (
              <div className="crm-onboarding-qr-card">
                <img src={qrCodeUrl} alt="QR code for the Merlyn intake form" className="crm-onboarding-qr-image" />
                <div className="crm-onboarding-qr-actions">
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={handleDownloadQr}>
                    Download QR Code
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={handleCopyLink}>
                    Copy Intake Link
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </section>

        <section className="crm-card crm-onboarding-card crm-onboarding-workflow-card">
          <div className="crm-onboarding-card-head">
            <div>
              <div className="crm-onboarding-card-kicker">What Happens Next</div>
              <h2>{agentFirstName}, this is the whole Merlyn story in one view.</h2>
            </div>
          </div>

          <div className="crm-onboarding-workflow-grid">
            <div className="crm-onboarding-workflow-copy">
              <ol className="crm-onboarding-steps">
                <li>A client fills out your questionnaire</li>
                <li>Merlyn automatically creates a lead</li>
                <li>The lead appears in your pipeline</li>
              </ol>

              <div className="crm-onboarding-action-block">
                <button
                  type="button"
                  className="crm-btn crm-btn-primary crm-onboarding-simulate-btn"
                  onClick={simulateLeadAppearance}
                  disabled={isSimulating || showLead}
                >
                  {showLead ? "Lead Captured" : "See How Leads Appear"}
                </button>
                <div className="crm-onboarding-action-note">
                  Watch how Merlyn automatically captures inquiries.
                </div>
                {isSimulating ? <div className="crm-onboarding-loading">New inquiry received...</div> : null}
              </div>
            </div>

            <div className="crm-onboarding-pipeline">
              <div
                className={`crm-onboarding-column${leadStage === "new" ? " crm-onboarding-column-active" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop("new")}
              >
                <div className="crm-onboarding-column-head">
                  <strong>New Leads</strong>
                  <span>{showLead && leadStage === "new" ? 1 : 0}</span>
                </div>

                {showLead && leadStage === "new" ? (
                  <div
                    className="crm-onboarding-lead-card crm-onboarding-lead-card-enter"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", "lead")}
                  >
                    <div className="crm-onboarding-lead-card-head">
                      <strong>{SIMULATED_LEAD.name}</strong>
                      <span>Inquiry Form</span>
                    </div>
                    <div className="crm-onboarding-lead-card-meta">{SIMULATED_LEAD.phone}</div>
                    <div className="crm-onboarding-lead-card-meta">
                      {SIMULATED_LEAD.intent} • {SIMULATED_LEAD.priceRange} • {SIMULATED_LEAD.timeline}
                    </div>
                    <div className="crm-onboarding-lead-card-note">{SIMULATED_LEAD.notes}</div>
                    {!leadMoved ? <div className="crm-onboarding-tooltip">Drag this lead to Contacted.</div> : null}
                  </div>
                ) : (
                  <div className="crm-onboarding-column-empty">Your first lead will appear here automatically.</div>
                )}
              </div>

              <div
                className={`crm-onboarding-column${leadStage === "contacted" ? " crm-onboarding-column-active" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop("contacted")}
              >
                <div className="crm-onboarding-column-head">
                  <strong>Contacted</strong>
                  <span>{showLead && leadStage === "contacted" ? 1 : 0}</span>
                </div>

                {showLead && leadStage === "contacted" ? (
                  <div className="crm-onboarding-lead-card crm-onboarding-lead-card-contacted">
                    <div className="crm-onboarding-lead-card-head">
                      <strong>{SIMULATED_LEAD.name}</strong>
                      <span>Moved</span>
                    </div>
                    <div className="crm-onboarding-lead-card-meta">{SIMULATED_LEAD.phone}</div>
                    <div className="crm-onboarding-lead-card-note">Status updated. This lead is now being worked.</div>
                  </div>
                ) : (
                  <div className="crm-onboarding-column-empty">Move the lead here after it appears.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {leadMoved ? (
          <section className="crm-card crm-onboarding-card crm-onboarding-success-card">
            <div className="crm-onboarding-card-kicker">You’re Ready</div>
            <h2>You&apos;re ready to capture leads.</h2>
            <p>Put your link in front of real clients and Merlyn will handle the first step automatically.</p>

            <div className="crm-onboarding-next-strip">
              <span>Add the link to your Instagram bio</span>
              <span>Send it to a past client</span>
              <span>Print the QR code for your next open house</span>
            </div>

            {saveError ? <div className="crm-onboarding-error">{saveError}</div> : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
