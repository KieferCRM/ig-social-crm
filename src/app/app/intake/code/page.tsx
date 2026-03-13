"use client";

import Link from "next/link";
import EmbedSnippet from "@/app/intake/embed-snippet";

export default function IntakeCodePage() {
  return (
    <main className="crm-page" style={{ maxWidth: 880, display: "grid", gap: 12 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Intake embed code</h1>
            <p className="crm-page-subtitle">
              Copy the website button or iframe code for your intake form from inside your workspace only.
            </p>
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-inline-actions">
          <Link href="/app/intake" className="crm-btn crm-btn-secondary">
            Back to intake
          </Link>
        </div>
        <EmbedSnippet />
      </section>
    </main>
  );
}
