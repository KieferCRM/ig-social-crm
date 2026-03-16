import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DocumentsClient from "./documents-client";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  full_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
};

type DealRow = {
  id: string;
  property_address: string | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export default async function DocumentsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: leadData }, { data: dealData }] = await Promise.all([
    supabase
      .from("leads")
      .select("id,full_name,canonical_email,canonical_phone,ig_username")
      .eq("agent_id", user.id)
      .order("time_last_updated", { ascending: false })
      .limit(80),
    supabase
      .from("deals")
      .select("id,property_address")
      .eq("agent_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const leads = ((leadData || []) as LeadRow[]).map((lead) => ({
    id: lead.id,
    label:
      firstNonEmpty(lead.full_name, lead.canonical_email, lead.canonical_phone) ||
      (lead.ig_username ? `@${lead.ig_username}` : "Unnamed contact"),
  }));

  const deals = ((dealData || []) as DealRow[]).map((deal) => ({
    id: deal.id,
    label: firstNonEmpty(deal.property_address) || "Untitled deal",
  }));

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Documents</p>
            <h1 className="crm-page-title">Agreements and deal files</h1>
            <p className="crm-page-subtitle">
              Keep contracts, agreements, checklists, and supporting files tied to the right deal
              instead of scattered across notes and folders.
            </p>
          </div>
        </div>
      </section>

      <DocumentsClient deals={deals} leads={leads} />
    </main>
  );
}
