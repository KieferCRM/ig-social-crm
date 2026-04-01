import { notFound } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import FormRenderer from "@/components/forms/FormRenderer";
import OffMarketBuyerForm from "@/components/forms/OffMarketBuyerForm";
import { FORM_TEMPLATES } from "@/lib/forms/templates";

export const dynamic = "force-dynamic";

export default async function FormPage({
  params,
}: {
  params: Promise<{ agentId: string; formType: string }>;
}) {
  const { agentId, formType } = await params;

  if (!agentId || !formType || !FORM_TEMPLATES[formType]) {
    notFound();
  }

  const template = FORM_TEMPLATES[formType];

  if (formType === "off_market_buyer") {
    return (
      <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <LockboxMark variant="full" decorative />
          </div>
          <OffMarketBuyerForm agentSlug={agentId} />
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
          {template.title}
        </h1>
        <FormRenderer formType={formType} agentSlug={agentId} />
      </div>
    </main>
  );
}
