export const dynamic = "force-dynamic";

export default function IntakePage() {
  return (
    <main className="crm-public-intake-page">
      <section className="crm-card crm-public-intake-hero">
        <div className="crm-public-intake-kicker">LockboxHQ intake</div>
        <h1>Choose the form that fits.</h1>
        <p>
          Use the buyer form for simple inbound interest, or the seller form for property-specific
          acquisition details.
        </p>
        <div className="crm-inline-actions">
          <span className="crm-chip crm-chip-info">No account required</span>
          <span className="crm-chip">Takes about 2 minutes</span>
        </div>
      </section>

      <section className="crm-public-intake-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <article className="crm-card crm-section-card crm-stack-10">
          <div className="crm-page-kicker">Buyer Form</div>
          <h2 style={{ margin: 0 }}>For buyer inquiries</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Lightweight and high-conversion for social, QR, and general lead capture.
          </p>
          <a href="/buyer" className="crm-btn crm-btn-primary">
            Open buyer form
          </a>
        </article>

        <article className="crm-card crm-section-card crm-stack-10">
          <div className="crm-page-kicker">Seller Form</div>
          <h2 style={{ margin: 0 }}>For seller inquiries</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Adds the extra property context your acquisition workflow needs before the first call.
          </p>
          <a href="/seller" className="crm-btn crm-btn-primary">
            Open seller form
          </a>
        </article>
      </section>
    </main>
  );
}
