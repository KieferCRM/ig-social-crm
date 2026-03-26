"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import LockboxMark from "@/components/branding/lockbox-mark";
import { PRODUCT_NAME } from "@/lib/features";
import { type AccountType } from "@/lib/onboarding";
import { supabaseBrowser } from "@/lib/supabase/browser";
import FounderSwitcher from "@/components/founder/FounderSwitcher";
import FloatingAssistant from "@/components/ai/FloatingAssistant";

export default function AppShellClient({
  children,
  initialAccountType,
}: {
  children: ReactNode;
  initialAccountType: AccountType | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [alertCount, setAlertCount] = useState(0);

  // Global search
  type SearchResult = { id: string; type: "contact" | "deal"; label: string; sub: string; href: string };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json() as { results: SearchResult[] };
        setSearchResults(data.results ?? []);
        setSearchOpen(true);
      } catch { /* ignore */ }
    }, 280);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await fetch("/api/secretary/alerts/count");
        const data = await res.json() as { count?: number };
        setAlertCount(data.count ?? 0);
      } catch { /* ignore */ }
    };
    void fetchAlertCount();
    const timer = setInterval(() => void fetchAlertCount(), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const isOffMarketAccount = initialAccountType === "off_market_agent";

  const navItems = isOffMarketAccount
    ? [
        { href: "/app", label: "Home", active: pathname === "/app", count: 0 },
        { href: "/app/pipeline", label: "Pipeline", active: pathname.startsWith("/app/pipeline"), count: 0 },
        { href: "/app/contacts", label: "Contacts", active: pathname.startsWith("/app/contacts"), count: 0 },
        { href: "/app/calendar", label: "Calendar", active: pathname.startsWith("/app/calendar"), count: 0 },
        { href: "/app/documents", label: "Documents", active: pathname.startsWith("/app/documents"), count: 0 },
        { href: "/app/forms", label: "Forms", active: pathname.startsWith("/app/forms"), count: 0 },
        { href: "/app/priorities", label: "Tasks", active: pathname.startsWith("/app/priorities"), count: 0 },
        { href: "/app/analytics", label: "Analytics", active: pathname.startsWith("/app/analytics"), count: 0 },
        { href: "/app/secretary", label: "Assistant", active: pathname.startsWith("/app/secretary"), count: alertCount },
        {
          href: "/app/settings",
          label: "Settings",
          active:
            pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/receptionist"),
          count: 0,
        },
      ]
    : [
        { href: "/app", label: "Home", active: pathname === "/app", count: 0 },
        { href: "/app/deals", label: "Pipeline", active: pathname.startsWith("/app/deals"), count: 0 },
        { href: "/app/contacts", label: "Contacts", active: pathname.startsWith("/app/contacts"), count: 0 },
        { href: "/app/calendar", label: "Calendar", active: pathname.startsWith("/app/calendar"), count: 0 },
        {
          href: "/app/intake",
          label: "Inquiries",
          active:
            pathname.startsWith("/app/intake") ||
            pathname.startsWith("/app/ingestion") ||
            pathname.startsWith("/app/import"),
          count: 0,
        },
        { href: "/app/documents", label: "Documents", active: pathname.startsWith("/app/documents"), count: 0 },
        { href: "/app/social", label: "Social Leads", active: pathname.startsWith("/app/social"), count: 0 },
        { href: "/app/priorities", label: "Tasks", active: pathname.startsWith("/app/priorities"), count: 0 },
        { href: "/app/analytics", label: "Analytics", active: pathname.startsWith("/app/analytics"), count: 0 },
        { href: "/app/secretary", label: "Assistant", active: pathname.startsWith("/app/secretary"), count: alertCount },
        {
          href: "/app/settings",
          label: "Settings",
          active:
            pathname.startsWith("/app/settings") && !pathname.startsWith("/app/settings/receptionist"),
          count: 0,
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
        title: "Pipeline",
        subtitle: isOffMarketAccount
          ? "Work active opportunities from one board: stage, contact context, stale deals, and next steps stay visible."
          : "Track every client from first contact to close. Move stages fast, see context at a glance, and keep next steps visible.",
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
        title: isOffMarketAccount ? "Intake" : "Inquiries",
        subtitle: isOffMarketAccount
          ? "Review new inbound inquiries, confirm what the system created, and keep source context clear."
          : "Review new inquiries, confirm contact details, and get each lead into the right stage quickly.",
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
        title: "Social Leads",
        subtitle:
          "See leads that came from Instagram, Facebook, and TikTok. Follow up before they go cold.",
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
        title: "Tasks",
        subtitle: isOffMarketAccount
          ? "Actionable deal work first: due now, stale opportunities next, then the items that can wait."
          : "Who needs a call, who needs an update, and what can wait — all in one place.",
      };
    }
    if (pathname.startsWith("/app/analytics")) {
      return {
        title: "Analytics",
        subtitle: isOffMarketAccount
          ? "Pipeline health, deal volume, financial metrics, and follow-up status."
          : "Lead volume, temperature breakdown, source performance, and follow-up health.",
      };
    }
    if (pathname.startsWith("/app/secretary")) {
      return {
        title: "Assistant",
        subtitle:
          "AI call handling, SMS outreach, transcripts, and alerts in one place.",
      };
    }
    if (pathname.startsWith("/app/settings/receptionist")) {
      return {
        title: "Assistant Settings",
        subtitle:
          "Configure call handling, voice AI, after-hours mode, and SMS behavior.",
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
      title: "Home",
      subtitle: isOffMarketAccount
        ? "Your weekly ops view — brief, pipeline pulse, and everything that needs attention."
        : "Start with the deals, hot inquiries, and follow-ups that matter right now.",
    };
  }, [isOffMarketAccount, pathname]);

  return (
    <div className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <Image src="/logo.png" alt="LockboxHQ" width={80} height={80} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div>
            <div className="crm-sidebar-brand-name">{PRODUCT_NAME.toUpperCase()}</div>
            <div className="crm-sidebar-brand-tag">Stay in the field. We&apos;ll run the office.</div>
          </div>
        </div>

        {/* Global search */}
        <div ref={searchRef} style={{ position: "relative", padding: "0 4px 4px" }}>
          <input
            type="text"
            placeholder="Search contacts & deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "7px 10px",
              fontSize: 13,
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              background: "var(--surface-1, #fff)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          {searchOpen && searchResults.length > 0 && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 4,
              right: 4,
              background: "var(--surface-1, #fff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              zIndex: 999,
              overflow: "hidden",
            }}>
              {searchResults.map((r) => (
                <Link
                  key={r.type + r.id}
                  href={r.href}
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    textDecoration: "none",
                    borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: r.type === "contact" ? "var(--ink-primary, #0ea5e9)" : "#7c3aed",
                      background: r.type === "contact" ? "#e0f2fe" : "#ede9fe",
                      borderRadius: 4,
                      padding: "1px 5px",
                      flexShrink: 0,
                    }}>
                      {r.type === "contact" ? "Contact" : "Deal"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.label}
                    </span>
                  </div>
                  {r.sub && (
                    <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 1, paddingLeft: 42, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.sub}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
          {searchOpen && searchResults.length === 0 && searchQuery.length >= 2 && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 4,
              right: 4,
              background: "var(--surface-1, #fff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              color: "var(--ink-muted)",
              zIndex: 999,
            }}>
              No results
            </div>
          )}
        </div>

        <nav className="crm-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`crm-sidebar-nav-link${item.active ? " crm-sidebar-nav-link-active" : ""}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              {item.label}
              {item.count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "#dc2626",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "0 5px",
                    minWidth: 16,
                    textAlign: "center",
                    lineHeight: "16px",
                  }}
                >
                  {item.count}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="crm-sidebar-footer">
          <FounderSwitcher />
          <span className="crm-chip crm-sidebar-mode-chip">
            {process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? "PREVIEW" : process.env.NODE_ENV === "development" ? "DEV" : "LIVE WORKSPACE"}
          </span>
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
        </header>

        <div className="crm-workspace-content">{children}</div>
      </div>

      {isOffMarketAccount && <FloatingAssistant />}
    </div>
  );
}
