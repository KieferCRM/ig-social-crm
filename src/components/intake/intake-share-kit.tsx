"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type IntakeShareKitProps = {
  intakePath: string;
  title: string;
  description: string;
  openLabel?: string;
  downloadName?: string;
  placementSuggestions?: string[];
};

const DEFAULT_PLACEMENTS = [
  "Open house sign-in table",
  "Business card",
  "Flyer",
  "Instagram bio",
  "Facebook profile",
  "TikTok bio",
] as const;

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function IntakeShareKit({
  intakePath,
  title,
  description,
  openLabel = "Open intake form",
  downloadName = "intake-qr.png",
  placementSuggestions,
}: IntakeShareKitProps) {
  const [intakeUrl, setIntakeUrl] = useState(`https://lockboxhq.com${intakePath}`);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIntakeUrl(`${window.location.origin}${intakePath}`);
  }, [intakePath]);

  const qrCodeUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?format=png&size=520x520&data=${encodeURIComponent(intakeUrl)}`,
    [intakeUrl]
  );

  const placements = placementSuggestions?.length
    ? placementSuggestions
    : [...DEFAULT_PLACEMENTS];

  async function handleCopyLink() {
    const ok = await copyText(intakeUrl);
    setMessage(ok ? "Link copied" : "Copy failed");
    window.setTimeout(() => setMessage(""), 1800);
  }

  async function handleDownloadQr() {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(qrCodeUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section className="crm-card crm-section-card crm-stack-10">
      <div className="crm-section-head">
        <div>
          <p className="crm-page-kicker">Share Intake</p>
          <h2 className="crm-section-title">{title}</h2>
          <p className="crm-section-subtitle">{description}</p>
        </div>
      </div>

      <div className="crm-intake-share-grid">
        <div className="crm-stack-8">
          <div className="crm-intake-link-box">
            <div className="crm-detail-label">Shareable link</div>
            <code>{intakeUrl}</code>
          </div>

          <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="crm-btn crm-btn-primary" onClick={handleCopyLink}>
              Copy link
            </button>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={handleDownloadQr}>
              Download QR
            </button>
            <Link href={intakePath} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
              {openLabel}
            </Link>
          </div>

          {message ? <div className="crm-chip crm-chip-ok">{message}</div> : null}

          <div className="crm-stack-6">
            <div className="crm-detail-label">Works well on</div>
            <div className="crm-intake-placement-list">
              {placements.map((item) => (
                <span key={item} className="crm-intake-placement-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="crm-intake-qr-card">
          <img src={qrCodeUrl} alt="QR code for the intake form" className="crm-intake-qr-image" />
          <div className="crm-intake-qr-caption">Scan to open the intake form</div>
        </div>
      </div>
    </section>
  );
}
