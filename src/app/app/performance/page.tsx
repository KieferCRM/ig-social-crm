import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  return (
    <main className="crm-page" style={{ maxWidth: 980, display: "grid", gap: 12 }}>
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Performance (Legacy)</h2>
          <span className="crm-chip">Archived</span>
        </div>

        <p className="crm-page-subtitle" style={{ margin: 0 }}>
          Merlyn now prioritizes daily lead response, pipeline movement, and active deal execution.
          Advanced analytics are not part of the current operating workflow.
        </p>

        <div className="crm-inline-actions">
          <Link href="/app" className="crm-btn crm-btn-secondary" style={{ padding: "8px 10px", fontSize: 12 }}>
            Open Dashboard
          </Link>
          <Link href="/app/deals" className="crm-btn crm-btn-secondary" style={{ padding: "8px 10px", fontSize: 12 }}>
            Open Deals
          </Link>
          <Link href="/app/list" className="crm-btn crm-btn-secondary" style={{ padding: "8px 10px", fontSize: 12 }}>
            Open Leads
          </Link>
        </div>
      </section>
    </main>
  );
}
