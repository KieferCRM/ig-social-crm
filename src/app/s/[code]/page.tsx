import LockboxMark from "@/components/branding/lockbox-mark";
import OffMarketSellerForm from "@/components/forms/OffMarketSellerForm";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function FormNotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
        <LockboxMark variant="full" decorative />
        <h1 style={{ marginTop: 32, fontSize: 22, fontWeight: 700 }}>Form not found</h1>
        <p style={{ marginTop: 12, color: "#64748b", lineHeight: 1.6 }}>
          This form link is no longer active. Contact the agent directly for a new link.
        </p>
      </div>
    </main>
  );
}

export default async function SellerShortPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const admin = supabaseAdmin();

  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("link_code", code)
    .maybeSingle();

  if (!data) return <FormNotFound />;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        <OffMarketSellerForm agentSlug={data.id as string} />
      </div>
    </main>
  );
}
