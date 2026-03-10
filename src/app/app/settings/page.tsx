import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="crm-page" style={{ maxWidth: 980 }}>
      <h1 style={{ margin: 0 }}>Workspace Settings</h1>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Keep legal pages and workspace-level configuration tidy here. Lead intake workflows now live in the Lead Intake section.
      </p>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <section className="crm-card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Lead Intake System</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Build funnels, run imports, and monitor ingestion quality from one centralized hub.
          </p>
          <div>
            <Link href="/app/intake" className="crm-btn crm-btn-primary">
              Open Lead Intake
            </Link>
          </div>
        </section>

        <section className="crm-card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Workspace Legal</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
            Review customer-facing legal documents before launch updates.
          </p>
          <div>
            <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy Policy</Link>
          </div>
        </section>
      </div>

      <section className="crm-card" style={{ marginTop: 16, padding: 16, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Legal Pages</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
          Keep these pages accessible before launch.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
            Privacy Policy
          </Link>
          <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">
            Terms of Service
          </Link>
        </div>
      </section>
    </main>
  );
}
