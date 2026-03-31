import { notFound } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import FormRenderer from "@/components/forms/FormRenderer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formKeyForLinkType, type IntakeLinkFormType } from "@/lib/forms/templates";

export const dynamic = "force-dynamic";

type IntakeLinkRow = {
  id: string;
  agent_id: string;
  slug: string;
  name: string;
  form_type: string;
  headline: string | null;
  source_label: string;
};

export default async function PublicLinkFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug) notFound();

  const admin = supabaseAdmin();
  const { data: link } = await admin
    .from("intake_links")
    .select("id, agent_id, slug, name, form_type, headline, source_label")
    .eq("slug", slug)
    .maybeSingle<IntakeLinkRow>();

  if (!link) notFound();

  const formKey = formKeyForLinkType(link.form_type as IntakeLinkFormType);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <LockboxMark variant="full" decorative />
        </div>
        {link.headline ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 20,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            {link.headline}
          </div>
        ) : null}
        <FormRenderer
          formType={formKey}
          agentSlug={link.agent_id}
          source={link.source_label}
          linkSlug={link.slug}
        />
      </div>
    </main>
  );
}
