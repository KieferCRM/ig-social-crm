"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { PRODUCT_NAME } from "@/lib/features";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const navItems = [
    { href: "/app", label: "Today", active: pathname === "/app" },
    { href: "/app/deals", label: "Deals", active: pathname.startsWith("/app/deals") },
    {
      href: "/app/intake",
      label: "Intake",
      active:
        pathname.startsWith("/app/intake") ||
        pathname.startsWith("/app/ingestion") ||
        pathname.startsWith("/app/import"),
    },
    {
      href: "/app/priorities",
      label: "Priorities",
      active: pathname.startsWith("/app/priorities"),
    },
    {
      href: "/app/settings/receptionist",
      label: "Concierge",
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
    if (pathname.startsWith("/app/deals")) {
      return {
        title: "Deals",
        subtitle:
          "Work the pipeline from one board: move stages fast, scan context quickly, and keep the next step visible.",
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
    if (pathname.startsWith("/app/priorities")) {
      return {
        title: "Priorities",
        subtitle:
          "Quiet operational guidance for what needs contact now, what needs an update, and what can wait.",
      };
    }
    if (pathname.startsWith("/app/settings/receptionist")) {
      return {
        title: "Concierge",
        subtitle:
          "Missed-call capture and follow-up intake feed the same workspace without creating a separate CRM path.",
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
      subtitle:
        "Start with the deals, hot inquiries, and follow-ups that matter right now.",
    };
  }, [pathname]);

  return (
    <div className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <MerlynMascot decorative />
          <div>
            <div className="crm-sidebar-brand-name">{PRODUCT_NAME.toUpperCase()}</div>
            <div className="crm-sidebar-brand-tag">Inbound CRM for solo real estate agents</div>
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
            <div className="crm-topbar-kicker">Inbound Workspace</div>
            <h1 className="crm-topbar-title">{pageMeta.title}</h1>
            <p className="crm-topbar-subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className="crm-topbar-signal">
            <span className="crm-topbar-sigil" aria-hidden />
            <div>
              <div className="crm-topbar-signal-title">Capture once, work the deal</div>
              <div className="crm-topbar-signal-subtitle">
                Intake, priorities, and deals stay in one operating system.
              </div>
            </div>
          </div>
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>
    </div>
  );
}
