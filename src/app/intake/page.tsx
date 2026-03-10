import IntakeForm from "./intake-form";
import EmbedSnippet from "./embed-snippet";

export const dynamic = "force-dynamic";

export default function IntakePage() {
  return (
    <main className="crm-container" style={{ padding: "12px 0 24px", maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>Get Matched With Off-Market Opportunities</h1>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Share a few details and we will follow up with the right next options.
      </p>
      <IntakeForm />
      <EmbedSnippet />
    </main>
  );
}
