import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DashboardPanel from "./dashboard-panel";
export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
};

type ConversationRow = {
  id: string;
  meta_participant_id: string | null;
};

type MessageRow = {
  conversation_id: string;
  direction: "in" | "out";
  ts: string | null;
  created_at: string;
};

type RadarItem = {
  kind: "new_inbound_unanswered" | "hot_no_followup" | "stale_revive";
  priority: number;
  lead: LeadRow;
  reason: string;
};

function normalizeHandle(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export default async function AppHome() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  const teamId = memberships?.[0]?.team_id || null;
  const ownerOrTeam = teamId ? `agent_id.eq.${user.id},team_id.eq.${teamId}` : `agent_id.eq.${user.id}`;

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, ig_username, stage, lead_temp, source, intent, timeline, last_message_preview, time_last_updated"
    )
    .or(ownerOrTeam);
  const leadRows = (leads || []) as LeadRow[];
  const nowTime = new Date().getTime();

  const total = leadRows.length;
  const hot = leadRows.filter((l) => l.lead_temp === "Hot").length;
  const newLeads = leadRows
    .filter((l) => l.stage === "New")
    .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""));
  const newCount = newLeads.length;
  const closed = leadRows.filter((l) => l.stage === "Closed").length;
  const conversion = total > 0 ? Math.round((closed / total) * 1000) / 10 : 0;
  const hasMovedStage = leadRows.some((l) => (l.stage || "New") !== "New");
  const staleLeadCount = leadRows.filter((l) => {
    if (!l.time_last_updated) return false;
    return new Date(l.time_last_updated).getTime() < nowTime - 7 * 24 * 3600_000;
  }).length;

  const [
    { count: metaConnections },
    { count: reminderCount },
    { count: overdueReminderCount },
    { data: pendingReminders },
    { data: conversations },
  ] = await Promise.all([
    supabase
      .from("meta_tokens")
      .select("agent_id", { count: "exact", head: true })
      .or(ownerOrTeam),
    supabase
      .from("follow_up_reminders")
      .select("id", { count: "exact", head: true })
      .or(ownerOrTeam),
    supabase
      .from("follow_up_reminders")
      .select("id", { count: "exact", head: true })
      .or(ownerOrTeam)
      .eq("status", "pending")
      .lt("due_at", new Date().toISOString()),
    supabase
      .from("follow_up_reminders")
      .select("lead_id")
      .or(ownerOrTeam)
      .eq("status", "pending"),
    supabase
      .from("conversations")
      .select("id,meta_participant_id")
      .or(ownerOrTeam),
  ]);

  const conversationRows = (conversations || []) as ConversationRow[];
  const conversationIds = conversationRows.map((c) => c.id);
  const { data: messages } =
    conversationIds.length === 0
      ? { data: [] as MessageRow[] }
      : await supabase
          .from("messages")
          .select("conversation_id,direction,ts,created_at")
          .or(ownerOrTeam)
          .in("conversation_id", conversationIds)
          .order("ts", { ascending: true });
  const messageRows = (messages || []) as MessageRow[];

  const byConversation = new Map<
    string,
    Array<{ direction: "in" | "out"; ts: string | null; created_at: string }>
  >();
  for (const msg of messageRows) {
    const list = byConversation.get(msg.conversation_id) || [];
    list.push(msg);
    byConversation.set(msg.conversation_id, list);
  }

  let unansweredInboundCount = 0;
  let responseCount = 0;
  let responseMinutesTotal = 0;
  const now = nowTime;

  for (const [, convoMessages] of byConversation) {
    if (convoMessages.length === 0) continue;

    const latest = convoMessages[convoMessages.length - 1];
    const latestTs = new Date(latest.ts || latest.created_at).getTime();
    if (latest.direction === "in" && !Number.isNaN(latestTs) && latestTs < now - 2 * 3600_000) {
      unansweredInboundCount += 1;
    }

    const firstInbound = convoMessages.find((m) => m.direction === "in");
    if (!firstInbound) continue;
    const firstInboundTs = new Date(firstInbound.ts || firstInbound.created_at).getTime();
    if (Number.isNaN(firstInboundTs)) continue;
    const firstOutboundAfter = convoMessages.find((m) => {
      if (m.direction !== "out") return false;
      const outTs = new Date(m.ts || m.created_at).getTime();
      return !Number.isNaN(outTs) && outTs >= firstInboundTs;
    });
    if (!firstOutboundAfter) continue;
    const firstOutTs = new Date(firstOutboundAfter.ts || firstOutboundAfter.created_at).getTime();
    if (Number.isNaN(firstOutTs)) continue;

    responseCount += 1;
    responseMinutesTotal += (firstOutTs - firstInboundTs) / 60000;
  }

  const avgFirstResponseMinutes = responseCount > 0 ? Math.round(responseMinutesTotal / responseCount) : null;

  const leadByHandle = new Map<string, LeadRow>();
  for (const lead of leadRows) {
    leadByHandle.set(normalizeHandle(lead.ig_username), lead);
  }
  const pendingLeadIds = new Set(
    (pendingReminders || [])
      .map((r) => r.lead_id)
      .filter((id): id is string => Boolean(id))
  );
  const conversationById = new Map<string, ConversationRow>();
  for (const convo of conversationRows) {
    conversationById.set(convo.id, convo);
  }

  const radar: RadarItem[] = [];
  const usedLeadIds = new Set<string>();

  for (const [conversationId, convoMessages] of byConversation) {
    if (convoMessages.length === 0) continue;
    const latest = convoMessages[convoMessages.length - 1];
    const latestTs = new Date(latest.ts || latest.created_at).getTime();
    if (latest.direction !== "in" || Number.isNaN(latestTs) || latestTs > now - 2 * 3600_000) continue;

    const convo = conversationById.get(conversationId);
    const lead = leadByHandle.get(normalizeHandle(convo?.meta_participant_id));
    if (!lead || usedLeadIds.has(lead.id)) continue;

    usedLeadIds.add(lead.id);
    radar.push({
      kind: "new_inbound_unanswered",
      priority: 1,
      lead,
      reason: "Inbound DM is waiting 2+ hours without response.",
    });
  }

  for (const lead of leadRows) {
    if (usedLeadIds.has(lead.id)) continue;
    if (lead.lead_temp !== "Hot") continue;
    if (pendingLeadIds.has(lead.id)) continue;
    const lastUpdateTs = new Date(lead.time_last_updated || "").getTime();
    if (Number.isNaN(lastUpdateTs) || lastUpdateTs > now - 24 * 3600_000) continue;

    usedLeadIds.add(lead.id);
    radar.push({
      kind: "hot_no_followup",
      priority: 2,
      lead,
      reason: "Hot lead has no follow-up activity in 24+ hours.",
    });
  }

  for (const lead of leadRows) {
    if (usedLeadIds.has(lead.id)) continue;
    if (lead.stage === "Closed") continue;
    if (pendingLeadIds.has(lead.id)) continue;
    const lastUpdateTs = new Date(lead.time_last_updated || "").getTime();
    if (Number.isNaN(lastUpdateTs) || lastUpdateTs > now - 14 * 24 * 3600_000) continue;

    usedLeadIds.add(lead.id);
    radar.push({
      kind: "stale_revive",
      priority: 3,
      lead,
      reason: "Lead has been inactive for 14+ days with no pending reminder.",
    });
  }

  radar.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.lead.time_last_updated || "").localeCompare(a.lead.time_last_updated || "");
  });

  const checklist = [
    {
      label: "Connect Meta channel",
      href: "/app/settings/channels",
      done: (metaConnections ?? 0) > 0,
    },
    {
      label: "Import first lead (or wait for DM ingest)",
      href: "/app/import",
      done: total > 0,
    },
    {
      label: "Create first reminder",
      href: "/app/reminders",
      done: (reminderCount ?? 0) > 0,
    },
    {
      label: "Move first lead beyond New stage",
      href: "/app/kanban",
      done: hasMovedStage,
    },
  ];
  const completedSteps = checklist.filter((step) => step.done).length;
  const progressPct = Math.round((completedSteps / checklist.length) * 100);

  return (
    <main className="crm-container" style={{ padding: "8px 0 24px", maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
            Speed-to-lead command center for social conversations.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/app/kanban" className="crm-btn crm-btn-primary">
            <span
              style={{
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              Open Kanban
            </span>
          </Link>
          <Link href="/app/list" className="crm-btn crm-btn-secondary">
            <span
              style={{
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              Open List
            </span>
          </Link>
        </div>
      </div>

      <div
        className="crm-card"
        style={{
          marginTop: 14,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          maxWidth: 360,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f6d365, #fda085)",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span style={{ position: "absolute", left: 8, top: 10, width: 4, height: 4, borderRadius: "50%", background: "#333" }} />
          <span style={{ position: "absolute", right: 8, top: 10, width: 4, height: 4, borderRadius: "50%", background: "#333" }} />
          <span style={{ position: "absolute", left: 10, top: 18, width: 10, height: 5, borderBottom: "2px solid #333", borderRadius: "0 0 10px 10px" }} />
        </div>
        <div style={{ fontSize: 13 }}>
          <strong>Scout</strong> is watching for new inbound leads.
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {error ? (
          <div
            className="crm-card"
            style={{
              padding: 12,
              background: "#fff5f5",
              color: "var(--danger)",
              fontSize: 14,
            }}
          >
            Could not load your dashboard counts.
          </div>
        ) : null}
      </div>

      <DashboardPanel
        total={total}
        hot={hot}
        newCount={newCount}
        closed={closed}
        conversion={conversion}
        newLeads={newLeads.slice(0, 3)}
      />

      <section
        className="crm-card"
        style={{
          marginTop: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Solo Agent Setup Checklist</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>
              Complete these once so your CRM runs with minimal manual input.
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#444", fontWeight: 700 }}>
            {completedSteps}/{checklist.length} complete ({progressPct}%)
          </div>
        </div>

        <div style={{ marginTop: 10, height: 8, background: "#eee6d6", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: progressPct === 100 ? "var(--ok)" : "var(--brand-ink)",
            }}
          />
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {checklist.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "9px 10px",
                background: step.done ? "#f1fbf4" : "var(--surface-strong)",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14 }}>{step.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: step.done ? "var(--ok)" : "var(--ink-muted)" }}>
                {step.done ? "Complete" : "Open"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="crm-card"
        style={{
          marginTop: 14,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700 }}>Urgent Now</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>
          Highest-priority lead actions based on inbox response, heat, and follow-up gaps.
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {radar.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ok)" }}>No urgent actions right now.</div>
          ) : (
            radar.slice(0, 8).map((item) => (
              <div
                key={`${item.kind}-${item.lead.id}`}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 10,
                  background: "var(--surface-strong)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    @{item.lead.ig_username || "unknown"}{" "}
                    <span style={{ fontWeight: 500, color: "var(--ink-muted)", fontSize: 12 }}>
                      ({item.kind.replaceAll("_", " ")})
                    </span>
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13, color: "var(--foreground)" }}>{item.reason}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      className={`crm-chip ${item.priority === 1 ? "crm-chip-danger" : item.priority === 2 ? "crm-chip-warn" : "crm-chip-ok"}`}
                    >
                      Priority {item.priority === 1 ? "P1" : item.priority === 2 ? "P2" : "P3"}
                    </span>
                    <span className="crm-chip">Owner: You</span>
                    <span className="crm-chip">Stage: {item.lead.stage || "—"}</span>
                    <span className="crm-chip">Temp: {item.lead.lead_temp || "—"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "6px 9px" }}>
                    Open in Kanban
                  </Link>
                  <Link
                    href={`/app/reminders?lead_id=${encodeURIComponent(item.lead.id)}`}
                    className="crm-btn crm-btn-secondary"
                    style={{ fontSize: 12, padding: "6px 9px" }}
                  >
                    Set Reminder
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        className="crm-card"
        style={{
          marginTop: 14,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700 }}>Recent Activity + SLA Snapshot</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Unanswered inbound (2h+)</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: unansweredInboundCount > 0 ? "var(--danger)" : "var(--foreground)" }}>
              {unansweredInboundCount}
            </div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Overdue reminders</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: (overdueReminderCount || 0) > 0 ? "var(--danger)" : "var(--foreground)" }}>
              {overdueReminderCount || 0}
            </div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Stale leads (7d+)</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: staleLeadCount > 0 ? "var(--warn)" : "var(--foreground)" }}>
              {staleLeadCount}
            </div>
          </div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Avg first response</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800 }}>
              {avgFirstResponseMinutes === null ? "—" : `${avgFirstResponseMinutes}m`}
            </div>
          </div>
        </div>
      </section>

      <div
        className="crm-card-muted"
        style={{
          marginTop: 16,
          padding: 14,
          color: "var(--ink-muted)",
          fontSize: 14,
        }}
      >
        {total === 0 ? (
          <span>No leads yet. Once DMs arrive, they’ll show up here.</span>
        ) : (
          <span>Metrics update automatically from your leads table.</span>
        )}
      </div>
    </main>
  );
}
