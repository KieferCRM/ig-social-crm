export default function EmailSettingsPage() {
  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 680 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Email</h1>
            <p className="crm-page-subtitle">
              Connect your inbox to sync emails with contacts and send directly from the CRM.
            </p>
          </div>
        </div>
      </section>

      <section className="crm-card crm-section-card crm-stack-10" style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
        <h2 className="crm-section-title" style={{ marginBottom: 6 }}>Coming Soon</h2>
        <p style={{ fontSize: 14, color: "var(--ink-muted)", maxWidth: 420, margin: "0 auto" }}>
          Email integration is on the way. You&apos;ll be able to connect Gmail or any inbox to sync conversations with contacts and send emails directly from the CRM.
        </p>
      </section>
    </main>
  );
}
