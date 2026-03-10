"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PRODUCT_NAME } from "@/lib/features";
import MerlynMascot from "@/components/branding/merlyn-mascot";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => supabaseBrowser(), []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const navItems = [
    { href: "/app", label: "Dashboard", active: pathname === "/app" },
    { href: "/app/list", label: "Leads", active: pathname.startsWith("/app/list") },
    { href: "/app/kanban", label: "Pipeline", active: pathname.startsWith("/app/kanban") },
    {
      href: "/app/intake",
      label: "Lead Intake",
      active:
        pathname.startsWith("/app/intake") ||
        pathname.startsWith("/app/ingestion") ||
        pathname.startsWith("/app/import") ||
        pathname.startsWith("/app/settings/questionnaire"),
    },
    {
      href: "/app/settings",
      label: "Settings",
      active: pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/questionnaire"),
    },
  ];

  const pageMeta = useMemo(() => {
    if (pathname.startsWith("/app/list")) {
      return {
        title: "Leads Workspace",
        subtitle: "Search, segment, and act on your lead portfolio quickly.",
      };
    }
    if (pathname.startsWith("/app/kanban")) {
      return {
        title: "Pipeline Board",
        subtitle: "Move deals forward with focused stage-by-stage management.",
      };
    }
    if (pathname.startsWith("/app/intake") || pathname.startsWith("/app/ingestion") || pathname.startsWith("/app/import") || pathname.startsWith("/app/settings/questionnaire")) {
      return {
        title: "Lead Intake System",
        subtitle: "Capture, import, map, and monitor how leads enter Merlyn.",
      };
    }
    if (pathname.startsWith("/app/settings")) {
      return {
        title: "Settings",
        subtitle: "Manage workspace preferences, deployment details, and legal links.",
      };
    }
    return {
      title: "Lead Command Center",
      subtitle: "Your daily control panel for response speed, follow-ups, and conversions.",
    };
  }, [pathname]);

  return (
    <div className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <MerlynMascot decorative />
          <div>
            <div className="crm-sidebar-brand-name">{PRODUCT_NAME.toUpperCase()}</div>
            <div className="crm-sidebar-brand-tag">Lead Intelligence for Agents</div>
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
          <span className="crm-chip crm-chip-ok crm-sidebar-mode-chip">SOLO MODE</span>
          <button onClick={handleLogout} className="crm-btn crm-btn-secondary crm-sidebar-logout">
            Logout
          </button>
        </div>
      </aside>

      <div className="crm-workspace">
        <header className="crm-topbar">
          <div>
            <div className="crm-topbar-kicker">MERLYN CRM</div>
            <h1 className="crm-topbar-title">{pageMeta.title}</h1>
            <p className="crm-topbar-subtitle">{pageMeta.subtitle}</p>
          </div>
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>
    </div>
  );
}
