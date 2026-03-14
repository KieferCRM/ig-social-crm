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

  if (pathname.startsWith("/app/onboarding")) {
    return <>{children}</>;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const navItems = [
    { href: "/app", label: "Dashboard", active: pathname === "/app" },
    { href: "/app/list", label: "Leads", active: pathname.startsWith("/app/list") },
    { href: "/app/kanban", label: "Pipeline", active: pathname.startsWith("/app/kanban") },
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
      href: "/app/settings/receptionist",
      label: "Concierge",
      active: pathname.startsWith("/app/settings/receptionist"),
    },
    {
      href: "/app/settings",
      label: "Settings",
      active: pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/receptionist"),
    },
  ];

  const pageMeta = useMemo(() => {
    if (pathname.startsWith("/app/list")) {
      return {
        title: "Leads",
        subtitle: "Scan every inquiry, filter fast, and open the right record without losing context.",
      };
    }
    if (pathname.startsWith("/app/kanban")) {
      return {
        title: "Pipeline",
        subtitle: "See which leads need a response, what stage they are in, and what should move next.",
      };
    }
    if (pathname.startsWith("/app/deals")) {
      return {
        title: "Deals",
        subtitle: "Track active transactions, close dates, and the next step without spreadsheet sprawl.",
      };
    }
    if (pathname.startsWith("/app/onboarding")) {
      return {
        title: "Setup",
        subtitle: "Get your intake link live and make sure the first lead lands in the right place.",
      };
    }
    if (pathname.startsWith("/app/intake") || pathname.startsWith("/app/ingestion") || pathname.startsWith("/app/import")) {
      return {
        title: "Lead Intake",
        subtitle: "Share your form, review submissions, and make sure new inquiries enter Merlyn cleanly.",
      };
    }
    if (pathname.startsWith("/app/settings/receptionist")) {
      return {
        title: "Concierge",
        subtitle: "Set up missed-call text-back and direct calling or texting unlocks so inbound opportunities do not go cold.",
      };
    }
    if (pathname.startsWith("/app/settings")) {
      return {
        title: "Settings",
        subtitle: "Keep the workspace understandable, compliant, and ready to use without extra setup debt.",
      };
    }
    return {
      title: "Today",
      subtitle: "Start with the leads and deals that need attention first.",
    };
  }, [pathname]);

  return (
    <div className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <MerlynMascot decorative />
          <div>
            <div className="crm-sidebar-brand-name">{PRODUCT_NAME.toUpperCase()}</div>
            <div className="crm-sidebar-brand-tag">Inbound lead CRM for solo agents</div>
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
          <span className="crm-chip crm-chip-ok crm-sidebar-mode-chip">LIVE WORKSPACE</span>
          <button onClick={handleLogout} className="crm-btn crm-btn-secondary crm-sidebar-logout">
            Logout
          </button>
        </div>
      </aside>

      <div className="crm-workspace">
        <header className="crm-topbar">
          <div>
            <div className="crm-topbar-kicker">MERLYN</div>
            <h1 className="crm-topbar-title">{pageMeta.title}</h1>
            <p className="crm-topbar-subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className="crm-topbar-signal">
            <span className="crm-topbar-sigil" aria-hidden />
            <div>
              <div className="crm-topbar-signal-title">Workspace ready</div>
              <div className="crm-topbar-signal-subtitle">Intake, leads, and deals are in one place.</div>
            </div>
          </div>
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>
    </div>
  );
}
