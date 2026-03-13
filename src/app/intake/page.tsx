import IntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

export default function IntakePage() {
  return (
    <main className="crm-public-intake-page">
      <section className="crm-card crm-public-intake-hero">
        <div className="crm-public-intake-kicker">Merlyn lead intake</div>
        <h1>Tell us what you need.</h1>
        <p>
          Share a few quick details so the agent can review your request and follow up with the right next step.
        </p>
        <div className="crm-inline-actions">
          <span className="crm-chip crm-chip-info">No account required</span>
          <span className="crm-chip">Takes about 2 minutes</span>
        </div>
      </section>
      <IntakeForm />
    </main>
  );
}
