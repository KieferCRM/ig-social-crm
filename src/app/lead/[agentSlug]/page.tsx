import { notFound } from "next/navigation";
import IntakeForm from "@/app/intake/intake-form";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export default async function AgentLeadPage({
  params,
}: {
  params: Promise<{ agentSlug: string }>;
}) {
  const { agentSlug } = await params;
  const normalizedSlug = normalizeSlug(decodeURIComponent(agentSlug || ""));
  if (!normalizedSlug) {
    notFound();
  }

  return (
    <main className="crm-container" style={{ padding: "12px 0 24px", maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>Get Started</h1>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Share a few quick details and we&apos;ll follow up with the next best step.
      </p>
      <IntakeForm defaultSource={`lead_link_${normalizedSlug}`} />
    </main>
  );
}
