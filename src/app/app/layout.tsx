"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PRODUCT_NAME } from "@/lib/features";
import MerlynMascot from "@/components/branding/merlyn-mascot";

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      aria-hidden="true"
      style={{ color: "#9fd8ff", opacity: 0.92 }}
    >
      <path
        d="m8 1.6 1.5 3.5 3.5 1.5-3.5 1.5L8 11.6 6.5 8.1 3 6.6l3.5-1.5L8 1.6Z"
        fill="currentColor"
      />
      <path d="m12.7 10.1.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6Z" fill="currentColor" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [merlynConciergeOpen, setMerlynConciergeOpen] = useState(false);
  const [merlynConciergeNotifyTapped, setMerlynConciergeNotifyTapped] = useState(false);

  const supabase = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    if (!merlynConciergeOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMerlynConciergeOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [merlynConciergeOpen]);

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
      label: "Lead Intake",
      active:
        pathname.startsWith("/app/intake") ||
        pathname.startsWith("/app/ingestion") ||
        pathname.startsWith("/app/import") ||
        pathname.startsWith("/app/settings/questionnaire"),
    },
  ];
  const settingsItem = {
    href: "/app/settings",
    label: "Settings",
    active: pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/questionnaire"),
  };
  const socialLinks = [
    { label: "Instagram", href: "https://www.instagram.com/" },
    { label: "Facebook", href: "https://www.facebook.com/" },
    { label: "Messenger", href: "https://www.messenger.com/" },
    { label: "TikTok", href: "https://www.tiktok.com/" },
    { label: "Email (Gmail)", href: "https://mail.google.com/" },
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
    if (pathname.startsWith("/app/deals")) {
      return {
        title: "Deals Board",
        subtitle: "Track every transaction from first showing through close.",
      };
    }
    if (pathname.startsWith("/app/onboarding")) {
      return {
        title: "Quick Setup",
        subtitle: "Get your first lead into the CRM in minutes.",
      };
    }
    if (pathname.startsWith("/app/performance")) {
      return {
        title: "Performance (Legacy)",
        subtitle: "Merlyn is focused on lead response and deal movement. Use Dashboard and Deals for daily operations.",
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
      subtitle: "Your daily control panel for response speed and pipeline movement.",
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

          <Link
            href={settingsItem.href}
            className={`crm-sidebar-nav-link${settingsItem.active ? " crm-sidebar-nav-link-active" : ""}`}
          >
            {settingsItem.label}
          </Link>

          <button
            type="button"
            className={`crm-sidebar-nav-link crm-sidebar-nav-link-locked${merlynConciergeOpen ? " crm-sidebar-nav-link-locked-open" : ""}`}
            onClick={() => setMerlynConciergeOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <SparkleIcon />
              <span>Merlyn Concierge (Coming Soon)</span>
            </span>
          </button>

          <button
            type="button"
            className={`crm-sidebar-nav-link crm-sidebar-nav-toggle${socialsOpen ? " crm-sidebar-nav-link-active" : ""}`}
            onClick={() => setSocialsOpen((previous) => !previous)}
            aria-expanded={socialsOpen}
          >
            <span>Socials</span>
            <span className={`crm-sidebar-nav-chevron${socialsOpen ? " crm-sidebar-nav-chevron-open" : ""}`}>▾</span>
          </button>

          {socialsOpen ? (
            <div className="crm-sidebar-subnav">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crm-sidebar-subnav-link"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
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
            <div className="crm-topbar-kicker">MERLYN INTELLIGENCE</div>
            <h1 className="crm-topbar-title">{pageMeta.title}</h1>
            <p className="crm-topbar-subtitle">{pageMeta.subtitle}</p>
          </div>
          <div className="crm-topbar-signal">
            <span className="crm-topbar-sigil" aria-hidden />
            <div>
              <div className="crm-topbar-signal-title">Merlyn Active</div>
              <div className="crm-topbar-signal-subtitle">Assistant synced to today&apos;s pipeline.</div>
            </div>
          </div>
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>

      {merlynConciergeOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(4, 10, 22, 0.72)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setMerlynConciergeOpen(false)}
        >
          <section
            className="crm-card"
            style={{ width: "min(520px, 100%)", padding: 16, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-section-head">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <SparkleIcon />
                <h2 className="crm-section-title" style={{ margin: 0 }}>Merlyn Concierge</h2>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={() => setMerlynConciergeOpen(false)}
              >
                Close
              </button>
            </div>

            <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 14, lineHeight: 1.6 }}>
              Merlyn is currently learning how to handle calls, SMS, and missed-call follow-ups for you automatically.
              <br />
              This feature is coming soon.
            </p>

            <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className="crm-btn crm-merlyn-concierge-notify"
                onClick={() => setMerlynConciergeNotifyTapped(true)}
              >
                Notify Me When Ready
              </button>
              {merlynConciergeNotifyTapped ? <span className="crm-chip crm-chip-ok">We&apos;ll notify you when it&apos;s live.</span> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
