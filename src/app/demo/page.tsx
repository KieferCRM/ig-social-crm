"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import {
  demoDeals,
  demoFollowUps,
  demoLeads,
  type DemoDeal,
  type DemoFollowUp,
  type DemoLead,
  type DemoLeadStage,
} from "@/lib/demoData";

const LEAD_STAGE_ORDER: DemoLeadStage[] = ["New", "Qualified", "Active Deal", "Closed"];

function stageTone(stage: DemoLeadStage): "default" | "ok" | "warn" | "info" {
  if (stage === "Closed") return "ok";
  if (stage === "Active Deal") return "info";
  if (stage === "Qualified") return "warn";
  return "default";
}

function tempTone(temp: DemoLead["temp"]): "default" | "warn" | "danger" {
  if (temp === "Hot") return "danger";
  if (temp === "Warm") return "warn";
  return "default";
}

function nextStage(stage: DemoLeadStage): DemoLeadStage {
  const currentIndex = LEAD_STAGE_ORDER.indexOf(stage);
  if (currentIndex < 0 || currentIndex === LEAD_STAGE_ORDER.length - 1) return LEAD_STAGE_ORDER[0];
  return LEAD_STAGE_ORDER[currentIndex + 1];
}

export default function DemoPage() {
  const [leads, setLeads] = useState<DemoLead[]>(demoLeads);
  const [followUps, setFollowUps] = useState<DemoFollowUp[]>(demoFollowUps);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  const followUpsOpen = useMemo(
    () => followUps.filter((item) => item.status === "Open"),
    [followUps]
  );

  const stageCounts = useMemo(
    () =>
      LEAD_STAGE_ORDER.map((stage) => ({
        stage,
        count: leads.filter((lead) => lead.stage === stage).length,
        items: leads.filter((lead) => lead.stage === stage),
      })),
    [leads]
  );

  const dealsByLeadId = useMemo(() => {
    const map = new Map<string, DemoDeal[]>();
    for (const deal of demoDeals) {
      const current = map.get(deal.leadId) || [];
      current.push(deal);
      map.set(deal.leadId, current);
    }
    return map;
  }, []);

  const activeDeals = demoDeals.length;
  const hotLeads = leads.filter((lead) => lead.temp === "Hot").length;
  const qualifiedLeads = leads.filter((lead) => lead.stage === "Qualified").length;

  function showDemoToast() {
    setToast("Demo mode — changes reset when refreshed.");
  }

  function handleAdvanceLead(leadId: string) {
    setLeads((previous) =>
      previous.map((lead) =>
        lead.id === leadId ? { ...lead, stage: nextStage(lead.stage) } : lead
      )
    );
    showDemoToast();
  }

  function handleMarkFollowUpDone(followUpId: string) {
    setFollowUps((previous) =>
      previous.map((item) =>
        item.id === followUpId ? { ...item, status: "Done" } : item
      )
    );
    showDemoToast();
  }

  return (
    <main className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <MerlynMascot decorative />
          <div>
            <div className="crm-sidebar-brand-name">MERLYN</div>
            <div className="crm-sidebar-brand-tag">Demo workspace for solo agents</div>
          </div>
        </div>

        <nav className="crm-sidebar-nav">
          <a href="#demo-today" className="crm-sidebar-nav-link crm-sidebar-nav-link-active">Today</a>
          <a href="#demo-pipeline" className="crm-sidebar-nav-link">Pipeline</a>
          <a href="#demo-deals" className="crm-sidebar-nav-link">Deals</a>
          <a href="#demo-followups" className="crm-sidebar-nav-link">Follow-ups</a>
        </nav>

        <div className="crm-sidebar-footer">
          <span className="crm-chip crm-chip-info crm-sidebar-mode-chip">DEMO MODE</span>
          <Link href="/signup" className="crm-btn crm-btn-secondary crm-sidebar-logout">
            Create workspace
          </Link>
        </div>
      </aside>

      <div className="crm-workspace">
        <div className="crm-demo-banner">
          <span>Demo workspace — exploring Merlyn with sample leads.</span>
          <Link href="/signup" className="crm-btn crm-btn-primary">
            Create your workspace
          </Link>
        </div>

        <header className="crm-topbar">
          <div>
            <div className="crm-topbar-kicker">MERLYN DEMO</div>
            <h1 className="crm-topbar-title">Understand the workflow in 30 seconds</h1>
            <p className="crm-topbar-subtitle">
              New inquiries arrive, follow-ups stay visible, and active deals remain easy to track.
            </p>
          </div>
          <div className="crm-topbar-signal">
            <span className="crm-topbar-sigil" aria-hidden />
            <div>
              <div className="crm-topbar-signal-title">Sample data loaded</div>
              <div className="crm-topbar-signal-subtitle">Nothing here writes to your database.</div>
            </div>
          </div>
        </header>

        <div className="crm-workspace-content crm-stack-12">
          <section id="demo-today" className="crm-kpi-grid crm-dashboard-kpi-grid">
            <KpiCard label="Leads" value={leads.length} helper="Inbound inquiries in the workspace" />
            <KpiCard label="Hot leads" value={hotLeads} tone="danger" helper="Need quick follow-up" />
            <KpiCard label="Qualified" value={qualifiedLeads} tone="warn" helper="Ready for next-step work" />
            <KpiCard label="Active deals" value={activeDeals} tone="ok" helper="Transactions in motion" />
          </section>

          <section className="crm-dashboard-main-columns">
            <section className="crm-card crm-dashboard-primary-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <div>
                  <h2 className="crm-section-title">Focus today</h2>
                  <p className="crm-section-subtitle">The follow-ups that show how Merlyn keeps progress visible.</p>
                </div>
                <StatusBadge label={`${followUpsOpen.length} open`} tone={followUpsOpen.length > 0 ? "warn" : "ok"} />
              </div>

              <div className="crm-stack-8">
                {followUps.map((item) => {
                  const lead = leads.find((entry) => entry.id === item.leadId);
                  return (
                    <article key={item.id} className="crm-card-muted crm-demo-followup-card">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: "var(--ink-muted)" }}>
                          {lead?.fullName || "Lead"} • {item.dueLabel}
                        </div>
                      </div>
                      <div className="crm-inline-actions">
                        <StatusBadge label={item.channel} tone="info" />
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          style={{ padding: "6px 9px", fontSize: 12 }}
                          onClick={() => handleMarkFollowUpDone(item.id)}
                        >
                          {item.status === "Done" ? "Done" : "Mark done"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="crm-card crm-dashboard-secondary-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <div>
                  <h2 className="crm-section-title">Demo cues</h2>
                  <p className="crm-section-subtitle">What to pay attention to as you click around.</p>
                </div>
              </div>
              <div className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>1. Open a lead</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  Review the contact, source, stage, and next step together.
                </div>
              </div>
              <div className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>2. Scan the pipeline</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  See how new inquiries move into qualified work and active deals.
                </div>
              </div>
              <div className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>3. Review deals</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  Notice how timelines and next steps stay attached to real clients.
                </div>
              </div>
            </aside>
          </section>

          <section id="demo-pipeline" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Pipeline</h2>
                <p className="crm-section-subtitle">Every serious inquiry is visible by stage.</p>
              </div>
            </div>

            <div className="crm-demo-board">
              {stageCounts.map((column) => (
                <article key={column.stage} className="crm-card-muted crm-demo-column">
                  <div className="crm-section-head">
                    <h3 style={{ margin: 0, fontSize: 14 }}>{column.stage}</h3>
                    <span className="crm-chip">{column.count}</span>
                  </div>
                  <div className="crm-stack-8">
                    {column.items.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="crm-card crm-demo-lead-card"
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 13 }}>{lead.fullName}</strong>
                          <StatusBadge label={lead.temp} tone={tempTone(lead.temp)} />
                        </div>
                        <div style={{ marginTop: 5, fontSize: 12, color: "var(--ink-muted)" }}>{lead.title}</div>
                        <div style={{ marginTop: 7, fontSize: 12, color: "var(--ink-muted)" }}>
                          {lead.source} • {lead.nextStep}
                        </div>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="demo-deals" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Deals</h2>
                <p className="crm-section-subtitle">Sample transaction work tied back to live leads.</p>
              </div>
            </div>
            <div className="crm-grid-cards-3">
              {demoDeals.map((deal) => (
                <article key={deal.id} className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{deal.title}</strong>
                    <StatusBadge label={deal.stage} tone={deal.stage === "Inspection" ? "warn" : deal.stage === "Showing" ? "info" : "default"} />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>{deal.clientName}</div>
                  <div style={{ fontSize: 13 }}>{deal.address}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {deal.priceLabel} • {deal.timeline}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Next: {deal.nextStep}</div>
                </article>
              ))}
            </div>
          </section>

          <section id="demo-followups" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">What demo mode shows</h2>
                <p className="crm-section-subtitle">A quick walkthrough of the product story.</p>
              </div>
            </div>
            <div className="crm-grid-cards-3">
              <article className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700 }}>Lead capture</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
                  Website forms, QR codes, and bio links create leads without manual entry.
                </p>
              </article>
              <article className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700 }}>Follow-up clarity</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
                  Agents can see what to call, review, or update today without guessing.
                </p>
              </article>
              <article className="crm-card-muted" style={{ padding: 12 }}>
                <div style={{ fontWeight: 700 }}>Deal visibility</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
                  Active transactions stay connected to the original lead and next step.
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>

      {selectedLead ? (
        <div className="crm-detail-overlay crm-demo-detail-overlay" onClick={() => setSelectedLeadId("")}>
          <section
            className="crm-card crm-detail-shell crm-demo-detail-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-section-head crm-demo-detail-header">
              <div>
                <h2 className="crm-section-title crm-demo-detail-title">{selectedLead.fullName}</h2>
                <p className="crm-section-subtitle">{selectedLead.title}</p>
              </div>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setSelectedLeadId("")}>
                Close
              </button>
            </div>

            <div className="crm-detail-scroll crm-stack-12 crm-demo-detail-scroll">
              <section className="crm-card-muted crm-demo-detail-summary">
                <div className="crm-demo-detail-badges">
                  <StatusBadge label={selectedLead.stage} tone={stageTone(selectedLead.stage)} />
                  <StatusBadge label={selectedLead.temp} tone={tempTone(selectedLead.temp)} />
                  <StatusBadge label={selectedLead.source} tone="info" />
                </div>
                <div className="crm-demo-detail-meta">Last activity: {selectedLead.lastActivity}</div>
              </section>

              <section className="crm-detail-grid crm-demo-detail-grid">
                <article className="crm-card-muted crm-demo-detail-block">
                  <div className="crm-demo-detail-label">Contact</div>
                  <div className="crm-demo-detail-value">{selectedLead.email}</div>
                  <div className="crm-demo-detail-meta">{selectedLead.phone}</div>
                </article>
                <article className="crm-card-muted crm-demo-detail-block">
                  <div className="crm-demo-detail-label">Inquiry</div>
                  <div className="crm-demo-detail-value">{selectedLead.intent}</div>
                  <div className="crm-demo-detail-meta">{selectedLead.timeline}</div>
                </article>
                <article className="crm-card-muted crm-demo-detail-block">
                  <div className="crm-demo-detail-label">Area</div>
                  <div className="crm-demo-detail-value">{selectedLead.area}</div>
                  <div className="crm-demo-detail-meta">{selectedLead.source}</div>
                </article>
                <article className="crm-card-muted crm-demo-detail-block">
                  <div className="crm-demo-detail-label">Next step</div>
                  <div className="crm-demo-detail-value">{selectedLead.nextStep}</div>
                  <div className="crm-demo-detail-meta">
                    This is the kind of work Merlyn keeps visible each day.
                  </div>
                </article>
              </section>

              <section className="crm-card crm-section-card crm-stack-10 crm-demo-detail-section">
                <div className="crm-section-head">
                  <h3 className="crm-section-title">Notes</h3>
                </div>
                <div className="crm-card-muted crm-demo-detail-note">{selectedLead.notes}</div>
              </section>

              <section className="crm-card crm-section-card crm-stack-10 crm-demo-detail-section">
                <div className="crm-section-head">
                  <h3 className="crm-section-title">Related deals</h3>
                </div>
                {(dealsByLeadId.get(selectedLead.id) || []).length > 0 ? (
                  <div className="crm-stack-8 crm-demo-related-list">
                    {(dealsByLeadId.get(selectedLead.id) || []).map((deal) => (
                      <div key={deal.id} className="crm-card-muted crm-demo-related-card">
                        <div className="crm-demo-related-head">
                          <strong>{deal.title}</strong>
                          <StatusBadge
                            label={deal.stage}
                            tone={deal.stage === "Inspection" ? "warn" : deal.stage === "Showing" ? "info" : "default"}
                          />
                        </div>
                        <div className="crm-demo-detail-meta">
                          {deal.address} • {deal.nextStep}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="crm-card-muted crm-demo-detail-empty">
                    No deal attached yet. In Merlyn, this lead is still in the lead-management stage.
                  </div>
                )}
              </section>

              <section className="crm-card crm-section-card crm-stack-10 crm-demo-detail-section">
                <div className="crm-section-head">
                  <h3 className="crm-section-title">Try the workflow</h3>
                </div>
                <div className="crm-inline-actions crm-demo-detail-actions">
                  <button type="button" className="crm-btn crm-btn-primary" onClick={() => handleAdvanceLead(selectedLead.id)}>
                    Advance stage
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={showDemoToast}>
                    Save note
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary crm-demo-disabled"
                    aria-disabled="true"
                    onClick={showDemoToast}
                  >
                    Delete disabled in demo
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="crm-demo-toast">{toast}</div> : null}
    </main>
  );
}
