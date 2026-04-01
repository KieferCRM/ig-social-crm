import Link from "next/link";

export default async function SettingsPage() {
  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Settings</h1>
            <p className="crm-page-subtitle">
              Keep the workspace clean, compliant, and easy to operate. Most teams only need the areas below.
            </p>
          </div>
        </div>
      </section>

      <div className="crm-grid-cards-3">
        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>AI Assistant</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Configure call handling, voice AI, SMS behavior, after-hours mode, and your business phone number.
          </p>
          <div>
            <Link href="/app/settings/receptionist" className="crm-btn crm-btn-primary">
              Assistant settings
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Pipeline Stages</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Rename or reorder your pipeline stages to match your workflow.
          </p>
          <div>
            <Link href="/app/settings/pipeline" className="crm-btn crm-btn-primary">
              Manage stages
            </Link>
          </div>
        </section>
        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Billing</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            View your current plan, upgrade or downgrade, and manage your payment details.
          </p>
          <div>
            <Link href="/app/settings/billing" className="crm-btn crm-btn-primary">
              Open billing
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Profile</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Update your name, brokerage, social handles, form URL slug, and timezone.
          </p>
          <div>
            <Link href="/app/settings/profile" className="crm-btn crm-btn-primary">
              Manage profile
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Email</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Connect your inbox to sync emails with contacts and send directly from the CRM.
          </p>
          <div>
            <Link href="/app/settings/email" className="crm-btn crm-btn-primary">
              Manage email
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Legal pages</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Review the customer-facing privacy and terms pages before sharing LockboxHQ publicly.
          </p>
          <div className="crm-inline-actions">
            <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
            <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
