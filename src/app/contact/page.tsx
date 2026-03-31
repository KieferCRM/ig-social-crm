import FormRenderer from "@/components/forms/FormRenderer";

export const dynamic = "force-dynamic";

export default function ContactFormPage() {
  return (
    <main className="crm-public-intake-page">
      <section className="crm-card crm-public-intake-hero">
        <div className="crm-public-intake-kicker">Contact</div>
        <h1>Get in touch.</h1>
        <p>
          Drop your info and the agent will follow up. Buying, selling, or just have a
          question — anything works.
        </p>
        <div className="crm-inline-actions">
          <span className="crm-chip crm-chip-info">No account required</span>
          <span className="crm-chip">Quick and easy</span>
        </div>
      </section>
      {/* agentSlug is intentionally empty — intake API falls back to INTAKE_AGENT_ID */}
      <FormRenderer formType="contact" agentSlug="" source="contact_form" />
    </main>
  );
}
