import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";

export default async function CompletePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, settings")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = ((agent?.full_name as string | null) ?? "").split(" ")[0] || "there";
  const settings = (agent?.settings ?? {}) as Record<string, unknown>;
  const brokerage = (settings.brokerage as string | null) ?? "";
  const receptionistSettings = (settings.receptionist_settings as Record<string, unknown> | null) ?? {};
  const voiceName = (receptionistSettings.voice_name as string | null) ?? "";
  const handles = (settings.social_handles as Record<string, string> | null) ?? {};
  const socialCount = Object.values(handles).filter(Boolean).length;

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">Step 5 of 5 — You&apos;re all set</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">
              Welcome{firstName && firstName !== "there" ? `, ${firstName}` : ""}!
            </h1>
            <p className="crm-auth-subtitle">
              Your workspace is ready. Here&apos;s what we set up for you.
            </p>
          </div>

          <div className="crm-stack-10">
            {/* Summary checklist */}
            <div
              style={{
                background: "var(--surface-2, #f8fafc)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <SummaryRow
                done={!!agent?.full_name}
                label={agent?.full_name ? `Name saved — ${agent.full_name as string}` : "Name not set yet"}
                hint={!agent?.full_name ? "Add in Profile Settings" : undefined}
              />
              <SummaryRow
                done={!!brokerage}
                label={brokerage ? `Brokerage — ${brokerage}` : "Brokerage not set yet"}
                hint={!brokerage ? "Add in Profile Settings" : undefined}
              />
              <SummaryRow
                done={!!voiceName}
                label={voiceName ? `AI receptionist — ${voiceName}` : "AI receptionist not configured"}
                hint={!voiceName ? "Configure in Receptionist Settings" : undefined}
              />
              <SummaryRow
                done={socialCount > 0}
                label={socialCount > 0 ? `${socialCount} social handle${socialCount > 1 ? "s" : ""} saved` : "No social handles added yet"}
                hint={socialCount === 0 ? "Add in Profile Settings" : undefined}
              />
            </div>

            <Link href="/app" className="crm-btn crm-btn-primary" style={{ display: "block", textAlign: "center" }}>
              Go to my workspace
            </Link>
          </div>
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">What&apos;s next</div>
          <h2 className="crm-auth-panel-title">Start capturing leads immediately.</h2>
          <p className="crm-auth-panel-body">
            Share your intake form link with sellers and contacts. Your AI receptionist will answer calls
            and log leads directly to your CRM — all automatically.
          </p>
          <div className="crm-auth-value-list">
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Share your form link from the Forms page</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Connect your business phone in Receptionist Settings</span>
            </div>
            <div className="crm-auth-value-item">
              <span className="crm-auth-value-dot" aria-hidden />
              <span>Review your Today view every morning to stay on top of follow-ups</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SummaryRow({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: done ? "var(--ok, #16a34a)" : "var(--surface-3, #e2e8f0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {done ? (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-faint)" }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: done ? "var(--foreground)" : "var(--ink-muted)" }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 1 }}>{hint}</div>
        )}
      </div>
    </div>
  );
}
