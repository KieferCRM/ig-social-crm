"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import { PRODUCT_NAME } from "@/lib/features";
import { readOnboardingStateFromAgentSettings, type AccountType } from "@/lib/onboarding";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccountType() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) return;

      const { data: agentRow } = await supabase
        .from("agents")
        .select("settings")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
      setAccountType(onboardingState.account_type);
    }

    void loadAccountType();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const isOffMarketAccount = accountType === "off_market_agent";

  const navItems = isOffMarketAccount
    ? [
        { href: "/app", label: "Today", active: pathname === "/app" },
        { href: "/app/pipeline", label: "Pipeline", active: pathname.startsWith("/app/pipeline") },
        { href: "/app/contacts", label: "Contacts", active: pathname.startsWith("/app/contacts") },
        { href: "/app/documents", label: "Documents", active: pathname.startsWith("/app/documents") },
        { href: "/app/forms", label: "Forms", active: pathname.startsWith("/app/forms") },
        { href: "/app/priorities", label: "Tasks", active: pathname.startsWith("/app/priorities") },
        {
          href: "/app/settings",
          label: "Settings",
          active:
            pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/receptionist"),
        },
      ]
    : [
        { href: "/app", label: "Today", active: pathname === "/app" },
        { href: "/app/deals", label: "Deals", active: pathname.startsWith("/app/deals") },
        { href: "/app/contacts", label: "Contacts", active: pathname.startsWith("/app/contacts") },
        {
          href: "/app/intake",
          label: "Intake",
          active:
            pathname.startsWith("/app/intake") ||
            pathname.startsWith("/app/ingestion") ||
            pathname.startsWith("/app/import"),
        },
        { href: "/app/documents", label: "Documents", active: pathname.startsWith("/app/documents") },
        { href: "/app/social", label: "Social Media", active: pathname.startsWith("/app/social") },
        { href: "/app/priorities", label: "Priorities", active: pathname.startsWith("/app/priorities") },
        {
          href: "/app/settings/receptionist",
          label: "Secretary",
          active: pathname.startsWith("/app/settings/receptionist"),
        },
        {
          href: "/app/settings",
          label: "Settings",
          active:
            pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/receptionist"),
        },
      ];

  const pageMeta = useMemo(() => {
    if (pathname.startsWith("/app/pipeline")) {
      return {
        title: "Pipeline",
        subtitle:
          "Track every off-market deal from prospecting to close. Filter by stage or tag to focus on what needs attention.",
      };
    }
    if (pathname.startsWith("/app/deals")) {
      return {
        title: "Deals",
        subtitle: isOffMarketAccount
          ? "Work active opportunities from one board: stage, contact context, stale deals, and next steps stay visible."
          : "Work the pipeline from one board: move stages fast, scan context quickly, and keep the next step visible.",
      };
    }
    if (pathname.startsWith("/app/contacts")) {
      return {
        title: "Contacts",
        subtitle: isOffMarketAccount
          ? "Keep sellers, buyers, and transaction relationships tied to the right deal so context stays usable."
          : "Organize buyers, sellers, and outreach groups with tags that stay usable day to day.",
      };
    }
    if (
      pathname.startsWith("/app/intake") ||
      pathname.startsWith("/app/ingestion") ||
      pathname.startsWith("/app/import")
    ) {
      return {
        title: "Intake",
        subtitle:
          "Review new inbound inquiries, confirm what the system created, and keep source context clear.",
      };
    }
    if (pathname.startsWith("/app/documents")) {
      return {
        title: "Documents",
        subtitle: isOffMarketAccount
          ? "Store agreements, seller notes, photos, and supporting files inside the right deal instead of scattered folders."
          : "Keep agreements, contracts, checklists, and deal files tied to the right record instead of scattered notes.",
      };
    }
    if (pathname.startsWith("/app/social")) {
      return {
        title: "Social Media",
        subtitle:
          "Plan outreach, keep scripts close, and move between platforms without turning the CRM into a scheduler.",
      };
    }
    if (pathname.startsWith("/app/forms")) {
      return {
        title: "Forms",
        subtitle:
          "Share seller and buyer intake forms with a link or QR code. Build custom forms for open houses, events, or any inquiry.",
      };
    }
    if (pathname.startsWith("/app/priorities")) {
      return {
        title: isOffMarketAccount ? "Tasks" : "Priorities",
        subtitle: isOffMarketAccount
          ? "Actionable deal work first: due now, stale opportunities next, then the items that can wait."
          : "Quiet operational guidance for what needs contact now, what needs an update, and what can wait.",
      };
    }
    if (pathname.startsWith("/app/settings/receptionist")) {
      return {
        title: "Secretary",
        subtitle:
          "Missed-call capture, form notifications, and direct SMS feed the same workspace without creating a separate CRM path.",
      };
    }
    if (pathname.startsWith("/app/settings")) {
      return {
        title: "Settings",
        subtitle:
          "Keep intake, compliance, and workspace behavior clear without adding extra setup complexity.",
      };
    }
    return {
      title: "Today",
      subtitle: isOffMarketAccount
        ? "Start with active deals, recent documents, upcoming tasks, and what needs attention now."
        : "Start with the deals, hot inquiries, and follow-ups that matter right now.",
    };
  }, [isOffMarketAccount, pathname]);

  return (
    <div className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <LockboxMark decorative />
          <div>
            <div className="crm-sidebar-brand-name">{PRODUCT_NAME.toUpperCase()}</div>
            <div className="crm-sidebar-brand-tag">
              {isOffMarketAccount
                ? "Deal command center for off-market agents"
                : "Smart CRM for inbound real estate agents"}
            </div>
          </div>
        </div>

        <nav className="crm-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`crm-sidebar-nav-link${item.active ? " crm-sidebar-nav-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="crm-sidebar-footer">
          <span className="crm-chip crm-sidebar-mode-chip">LIVE WORKSPACE</span>
          <button onClick={handleLogout} className="crm-btn crm-btn-secondary crm-sidebar-logout">
            Logout
          </button>
        </div>
      </aside>

      <div className="crm-workspace">
        <header className="crm-topbar">
          <div>
            <div className="crm-topbar-kicker">
              {isOffMarketAccount ? "Off-Market Workspace" : "Inbound Workspace"}
            </div>
            <h1 className="crm-topbar-title">{pageMeta.title}</h1>
            <p className="crm-topbar-subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className="crm-topbar-signal">
            <span className="crm-topbar-sigil" aria-hidden />
            <div>
              <div className="crm-topbar-signal-title">
                {isOffMarketAccount ? "Deals, docs, and tasks in one command view" : "Capture once, work the deal"}
              </div>
              <div className="crm-topbar-signal-subtitle">
                {isOffMarketAccount
                  ? "Seller context, documents, and next steps stay attached to the opportunity."
                  : "Intake, priorities, and deals stay in one operating system."}
              </div>
            </div>
          </div>
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>
    </div>
  );
}
