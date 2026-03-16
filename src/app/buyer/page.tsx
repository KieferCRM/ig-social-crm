import IntakeForm from "@/app/intake/intake-form";

export const dynamic = "force-dynamic";

export default function BuyerFormPage() {
  return (
    <main className="crm-public-intake-page">
      <section className="crm-card crm-public-intake-hero">
        <div className="crm-public-intake-kicker">Buyer form</div>
        <h1>Tell us what you are looking for.</h1>
        <p>
          Share a few quick details so the agent can review your goals and follow up with the best
          next step.
        </p>
        <div className="crm-inline-actions">
          <span className="crm-chip crm-chip-info">No account required</span>
          <span className="crm-chip">Built for social and QR traffic</span>
        </div>
      </section>
      <IntakeForm defaultSource="website_form" variant="buyer" />
    </main>
  );
}
