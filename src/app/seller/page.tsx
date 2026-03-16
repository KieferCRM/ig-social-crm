import IntakeForm from "@/app/intake/intake-form";

export const dynamic = "force-dynamic";

export default function SellerFormPage() {
  return (
    <main className="crm-public-intake-page">
      <section className="crm-card crm-public-intake-hero">
        <div className="crm-public-intake-kicker">Seller form</div>
        <h1>Tell us about the property.</h1>
        <p>
          Share the property details and timing so the agent can qualify the opportunity and follow
          up the right way.
        </p>
        <div className="crm-inline-actions">
          <span className="crm-chip crm-chip-info">No account required</span>
          <span className="crm-chip">Seller-focused qualification</span>
        </div>
      </section>
      <IntakeForm defaultSource="website_form" variant="seller" />
    </main>
  );
}
