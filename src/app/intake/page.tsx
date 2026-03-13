import IntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

export default function IntakePage() {
  return (
    <main className="crm-container" style={{ padding: "12px 0 24px", maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>Lead Intake Form</h1>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Share a few quick details so our team can follow up with the right next step.
      </p>
      <IntakeForm />
    </main>
  );
}
