import Link from "next/link";

export default function SettingsPage() {
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
          <div style={{ fontWeight: 700 }}>Inbound intake</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Review inbound submissions, share your form, and keep social and form capture flowing into deals cleanly.
          </p>
          <div>
            <Link href="/app/intake" className="crm-btn crm-btn-primary">
              Open intake
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Concierge</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Premium upgrade for missed-call follow-up, direct calling and texting in supported workspaces, and cleaner communication workflows.
          </p>
          <div>
            <Link href="/app/settings/receptionist" className="crm-btn crm-btn-primary">
              Open Concierge
            </Link>
          </div>
        </section>

        <section className="crm-card crm-section-card crm-stack-10">
          <div style={{ fontWeight: 700 }}>Legal pages</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Review the customer-facing privacy and terms pages before sharing Merlyn publicly.
          </p>
          <div className="crm-inline-actions">
            <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
            <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
          </div>
        </section>
      </div>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Need a quick check?</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
          If you are getting ready to launch or share the product more widely, start with intake, priorities, Concierge, and legal.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary">
            Intake
          </Link>
          <Link href="/app/priorities" className="crm-btn crm-btn-secondary">
            Priorities
          </Link>
          <Link href="/app/settings/receptionist" className="crm-btn crm-btn-secondary">
            Concierge
          </Link>
          <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
            Privacy
          </Link>
          <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
            Terms
          </Link>
        </div>
      </section>
    </main>
  );
}
