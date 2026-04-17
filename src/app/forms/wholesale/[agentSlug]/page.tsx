import { redirect } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import WholesalerSmartForm from "@/components/forms/WholesalerSmartForm";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export default async function WholesaleFormPage({
  params,
}: {
  params: Promise<{ agentSlug: string }>;
}) {
  const { agentSlug: param } = await params;
  const admin = supabaseAdmin();
  let resolvedAgentId: string;

  if (UUID_RE.test(param)) {
    const { data, error } = await admin
      .from("agents")
      .select("id, vanity_slug")
      .eq("id", param)
      .maybeSingle();

    if (error) {
      const { data: basic } = await admin.from("agents").select("id").eq("id", param).maybeSingle();
      if (!basic) return <FormNotFound />;
      resolvedAgentId = basic.id as string;
    } else {
      if (!data) return <FormNotFound />;
      if (data.vanity_slug) redirect(`/forms/wholesale/${data.vanity_slug}`);
      resolvedAgentId = data.id as string;
    }
  } else {
    const { data } = await admin
      .from("agents")
      .select("id")
      .ilike("vanity_slug", param)
      .maybeSingle();

    if (data) {
      resolvedAgentId = data.id as string;
    } else {
      const { data: hist } = await admin
        .from("agent_slug_history")
        .select("agent_id, agents!inner(id, vanity_slug)")
        .ilike("old_slug", param)
        .maybeSingle();

      if (hist) {
        const agent = (hist as unknown as { agents: { vanity_slug: string | null; id: string } }).agents;
        redirect(`/forms/wholesale/${agent.vanity_slug ?? agent.id}`);
      }

      return <FormNotFound />;
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        <WholesalerSmartForm agentSlug={resolvedAgentId} />
      </div>
    </main>
  );
}
