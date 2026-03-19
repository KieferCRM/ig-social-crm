import Link from "next/link";
import { readOnboardingStateFromAgentSettings } from "@/lib/onboarding";
import { supabaseServer } from "@/lib/supabase/server";
import WorkspaceSettingsClient from "./workspace-settings-client";

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOffMarket = false;
  if (user) {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle();
    const onboarding = readOnboardingStateFromAgentSettings(agentRow?.settings ?? null);
    isOffMarket = onboarding.account_type === "off_market_agent";
  }

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 980 }}>
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Settings</h1>
            <p className="crm-page-subtitle">
              Keep the workspace clean, compliant, and easy to operate. Most teams only need the areas below.
            </p>
          </div>
        </div>
      </section>

      <WorkspaceSettingsClient />

      <div className="crm-grid-cards-3">
        {isOffMarket ? (
          <>
            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Pipeline</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Manage your off-market deal pipeline, stages, follow-up dates, and custom tags.
              </p>
              <div>
                <Link href="/app/pipeline" className="crm-btn crm-btn-primary">
                  Open pipeline
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Forms</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Share your seller and buyer intake forms. Build custom forms for events or open houses.
              </p>
              <div>
                <Link href="/app/forms" className="crm-btn crm-btn-primary">
                  Open forms
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Documents</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Keep agreements, seller notes, and supporting files attached to the right deal.
              </p>
              <div>
                <Link href="/app/documents" className="crm-btn crm-btn-primary">
                  Open documents
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Legal pages</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Review the customer-facing privacy and terms pages before sharing LockboxHQ publicly.
              </p>
              <div className="crm-inline-actions">
                <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
                <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Inbound intake</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Review inbound submissions, share your buyer and seller forms, and keep social and
                form capture flowing into deals cleanly.
              </p>
              <div>
                <Link href="/app/intake" className="crm-btn crm-btn-primary">
                  Open intake
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Documents</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Keep agreements, contracts, and checklist files attached to the right deal without
                scattering them across notes and folders.
              </p>
              <div>
                <Link href="/app/documents" className="crm-btn crm-btn-primary">
                  Open documents
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Secretary</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Premium upgrade for missed-call follow-up, direct calling and texting, and cleaner communication workflows.
              </p>
              <div>
                <Link href="/app/settings/receptionist" className="crm-btn crm-btn-primary">
                  Open Secretary
                </Link>
              </div>
            </section>

            <section className="crm-card crm-section-card crm-stack-10">
              <div style={{ fontWeight: 700 }}>Legal pages</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
                Review the customer-facing privacy and terms pages before sharing LockboxHQ publicly.
              </p>
              <div className="crm-inline-actions">
                <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
                <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
              </div>
            </section>
          </>
        )}
      </div>

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Need a quick check?</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)" }}>
          {isOffMarket
            ? "Before going live, verify your forms are shared, your pipeline has your first deal, and legal pages are reviewed."
            : "If you are getting ready to launch or share the product more widely, start with intake, priorities, Secretary, and legal."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isOffMarket ? (
            <>
              <Link href="/app/pipeline" className="crm-btn crm-btn-secondary">Pipeline</Link>
              <Link href="/app/forms" className="crm-btn crm-btn-secondary">Forms</Link>
              <Link href="/app/contacts" className="crm-btn crm-btn-secondary">Contacts</Link>
              <Link href="/app/documents" className="crm-btn crm-btn-secondary">Documents</Link>
              <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
              <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
            </>
          ) : (
            <>
              <Link href="/app/intake" className="crm-btn crm-btn-secondary">Intake</Link>
              <Link href="/app/social" className="crm-btn crm-btn-secondary">Social Media</Link>
              <Link href="/app/contacts" className="crm-btn crm-btn-secondary">Contacts</Link>
              <Link href="/app/settings/receptionist" className="crm-btn crm-btn-secondary">Secretary</Link>
              <Link href="/privacy" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Privacy</Link>
              <Link href="/terms" className="crm-btn crm-btn-secondary" target="_blank" rel="noreferrer">Terms</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
