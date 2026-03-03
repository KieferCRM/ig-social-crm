"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useEffect, useState } from "react";

type WorkspaceContext = {
  workspace_mode: "solo" | "team" | null;
  full_access: boolean;
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => supabaseBrowser(), []);
  const [workspace, setWorkspace] = useState<WorkspaceContext>({
    workspace_mode: null,
    full_access: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await fetch("/api/workspace/context");
        if (!response.ok) return;
        const data = (await response.json()) as WorkspaceContext;
        if (!cancelled) setWorkspace(data);
      } catch {
        // no-op
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const isSelectPage = pathname === "/app/select-workspace";
  const showSoloNav =
    workspace.full_access || workspace.workspace_mode === "solo" || workspace.workspace_mode === "team";
  const showTeamNav = workspace.full_access || workspace.workspace_mode === "team";

  return (
    <div className="crm-shell">
      <div className="crm-container" style={{ padding: 24 }}>
        <div
          className="crm-card"
          style={{
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>IG SOCIAL CRM</span>
            <span className="crm-chip crm-chip-ok">
              {workspace.full_access
                ? "FULL ACCESS"
                : workspace.workspace_mode === "team"
                  ? "TEAM MODE"
                  : workspace.workspace_mode === "solo"
                    ? "SOLO MODE"
                    : "MODE PENDING"}
            </span>
            {workspace.full_access ? <span className="crm-chip">SOLO + TEAM</span> : null}
          </div>
          <button
            onClick={handleLogout}
            className="crm-btn crm-btn-secondary"
            style={{ padding: "7px 12px", fontSize: 13 }}
          >
            Logout
          </button>
        </div>

        {!isSelectPage ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            {showSoloNav ? (
              <>
                <Link href="/app" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Dashboard
                </Link>
                <Link href="/app/settings/channels" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Settings
                </Link>
                <Link href="/app/settings/automation" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Automation
                </Link>
                <Link href="/app/reminders" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Reminders
                </Link>
                <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Kanban
                </Link>
                <Link href="/app/list" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  List
                </Link>
                <Link href="/app/import" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                  Import/Export
                </Link>
              </>
            ) : null}
            {showTeamNav ? (
              <Link href="/app/team" className="crm-btn crm-btn-secondary" style={{ fontWeight: 600 }}>
                Team Hub
              </Link>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
