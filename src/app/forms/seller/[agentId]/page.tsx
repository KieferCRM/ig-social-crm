import LockboxMark from "@/components/branding/lockbox-mark";
import OffMarketSellerForm from "@/components/forms/OffMarketSellerForm";

export const dynamic = "force-dynamic";

export default async function SellerFormPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        <OffMarketSellerForm agentSlug={agentId} />
      </div>
    </main>
  );
}
