"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import KpiCard from "@/components/ui/kpi-card";
import StatusBadge from "@/components/ui/status-badge";
import {
  DEMO_ONBOARDING_KEY,
  DEMO_STORAGE_KEY,
  createAutomaticInquiryLead,
  createFollowUpForLead,
  createGeneratedInquiryLead,
  createLeadFromDemoForm,
  createSeedDemoWorkspace,
  shouldResetDemoWorkspace,
  type DemoDeal,
  type DemoLead,
  type DemoLeadStage,
  type DemoWorkspaceState,
} from "@/lib/demoData";

const LEAD_STAGE_ORDER: DemoLeadStage[] = ["New", "Qualified", "Active Deal", "Closed"];
const SIGNUP_HREF = "/auth?mode=sign_up";

type DemoInquiryDraft = {
  fullName: string;
  email: string;
  phone: string;
  intent: string;
  timeline: string;
  budget: string;
  area: string;
  contactPreference: string;
  notes: string;
  referralSource: string;
};

const EMPTY_INQUIRY_DRAFT: DemoInquiryDraft = {
  fullName: "",
  email: "",
  phone: "",
  intent: "Buying",
  timeline: "1-3 months",
  budget: "$500k-$750k",
  area: "",
  contactPreference: "Text",
  notes: "",
  referralSource: "",
};

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

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value.trim();
}

function formatContactLine(lead: DemoLead): string {
  const parts = [lead.intent, lead.area, lead.budget].filter(Boolean);
  return parts.join(" • ");
}

function formatContextMeta(lead: DemoLead): string {
  const phone = formatPhoneDisplay(lead.phone);
  return [lead.source, lead.timeline, phone || lead.email].filter(Boolean).join(" • ");
}

function nextStage(stage: DemoLeadStage): DemoLeadStage {
  const currentIndex = LEAD_STAGE_ORDER.indexOf(stage);
  if (currentIndex < 0 || currentIndex === LEAD_STAGE_ORDER.length - 1) return LEAD_STAGE_ORDER[0];
  return LEAD_STAGE_ORDER[currentIndex + 1];
}

function loadInitialWorkspace(): DemoWorkspaceState {
  if (typeof window === "undefined") {
    return createSeedDemoWorkspace();
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoWorkspaceState;
      if (!shouldResetDemoWorkspace(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore bad demo state and rebuild the sandbox from seed data.
  }

  return createSeedDemoWorkspace();
}

export default function DemoPage() {
  const [workspace, setWorkspace] = useState<DemoWorkspaceState | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedPreview, setSelectedPreview] = useState<"link" | "embedded">("link");
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState("");
  const [animatedLeadId, setAnimatedLeadId] = useState("");
  const [dragLeadId, setDragLeadId] = useState("");
  const [inquiryDraft, setInquiryDraft] = useState<DemoInquiryDraft>(EMPTY_INQUIRY_DRAFT);
  const [leadDraft, setLeadDraft] = useState<DemoLead | null>(null);

  useEffect(() => {
    const nextWorkspace = loadInitialWorkspace();
    setWorkspace(nextWorkspace);
    if (typeof window !== "undefined") {
      const onboardingSeen = window.localStorage.getItem(DEMO_ONBOARDING_KEY) === "1";
      setShowOnboarding(!onboardingSeen);
    }
  }, []);

  useEffect(() => {
    if (!workspace || typeof window === "undefined") return;
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (!workspace || workspace.simulatedFirstInquiry || !showOnboarding) return;
    const timer = window.setTimeout(() => {
      simulateAutomaticInquiry();
      completeOnboarding();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [workspace, showOnboarding]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!animatedLeadId) return;
    const timer = window.setTimeout(() => setAnimatedLeadId(""), 1800);
    return () => window.clearTimeout(timer);
  }, [animatedLeadId]);

  const selectedLead = useMemo(
    () => workspace?.leads.find((lead) => lead.id === selectedLeadId) || null,
    [workspace, selectedLeadId]
  );

  useEffect(() => {
    setLeadDraft(selectedLead ? { ...selectedLead } : null);
  }, [selectedLead]);

  const stageCounts = useMemo(
    () =>
      LEAD_STAGE_ORDER.map((stage) => ({
        stage,
        count: workspace?.leads.filter((lead) => lead.stage === stage).length || 0,
        items: workspace?.leads.filter((lead) => lead.stage === stage) || [],
      })),
    [workspace]
  );

  const followUpsOpen = useMemo(
    () => workspace?.followUps.filter((item) => item.status === "Open") || [],
    [workspace]
  );

  const dealsByLeadId = useMemo(() => {
    const map = new Map<string, DemoDeal[]>();
    for (const deal of workspace?.deals || []) {
      const current = map.get(deal.leadId) || [];
      current.push(deal);
      map.set(deal.leadId, current);
    }
    return map;
  }, [workspace]);

  function updateWorkspace(updater: (current: DemoWorkspaceState) => DemoWorkspaceState) {
    setWorkspace((current) => {
      if (!current) return current;
      const next = updater(current);
      return {
        ...next,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function showDemoToast(message: string) {
    setToast(message);
  }

  function completeOnboarding() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_ONBOARDING_KEY, "1");
    }
    setShowOnboarding(false);
  }

  function addLeadToWorkspace(lead: DemoLead, message: string, options?: { markSimulated?: boolean }) {
    setAnimatedLeadId(lead.id);
    updateWorkspace((current) => ({
      ...current,
      simulatedFirstInquiry: current.simulatedFirstInquiry || Boolean(options?.markSimulated),
      leads: [lead, ...current.leads],
      followUps: [createFollowUpForLead(lead), ...current.followUps],
    }));
    showDemoToast(message);
  }

  function simulateAutomaticInquiry() {
    if (!workspace || workspace.simulatedFirstInquiry) return;
    addLeadToWorkspace(createAutomaticInquiryLead(), "New inquiry captured from questionnaire.", {
      markSimulated: true,
    });
  }

  function handleGenerateInquiry() {
    if (!workspace) return;
    const count = workspace.generatorCount + 1;
    const lead = createGeneratedInquiryLead(count);
    setAnimatedLeadId(lead.id);
    updateWorkspace((current) => ({
      ...current,
      generatorCount: count,
      leads: [lead, ...current.leads],
      followUps: [createFollowUpForLead(lead), ...current.followUps],
    }));
    showDemoToast("New inquiry captured from questionnaire.");
  }

  function handleSubmitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lead = createLeadFromDemoForm(inquiryDraft);
    addLeadToWorkspace(lead, "Inquiry captured and added to pipeline.");
    setInquiryDraft(EMPTY_INQUIRY_DRAFT);
    setShowInquiryForm(false);
    setSelectedLeadId(lead.id);
  }

  function handleLeadDraftChange<Key extends keyof DemoLead>(key: Key, value: DemoLead[Key]) {
    setLeadDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleSaveLead() {
    if (!leadDraft) return;
    updateWorkspace((current) => ({
      ...current,
      leads: current.leads.map((lead) =>
        lead.id === leadDraft.id
          ? {
              ...leadDraft,
              phone: formatPhoneDisplay(leadDraft.phone),
              email: leadDraft.email.trim(),
              notes: leadDraft.notes.trim(),
              nextStep: leadDraft.nextStep.trim(),
              lastActivity: "Just updated",
            }
          : lead
      ),
    }));
    showDemoToast("Demo mode — changes reset when refreshed.");
  }

  function handleAdvanceLead(leadId: string) {
    updateWorkspace((current) => ({
      ...current,
      leads: current.leads.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              stage: nextStage(lead.stage),
              lastActivity: "Stage updated just now",
            }
          : lead
      ),
    }));
    showDemoToast("Lead moved to the next stage.");
  }

  function handleStageDrop(stage: DemoLeadStage) {
    if (!dragLeadId) return;
    updateWorkspace((current) => ({
      ...current,
      leads: current.leads.map((lead) =>
        lead.id === dragLeadId
          ? {
              ...lead,
              stage,
              lastActivity: `Moved to ${stage}`,
            }
          : lead
      ),
    }));
    setDragLeadId("");
    showDemoToast(`Lead moved to ${stage}.`);
  }

  function handleMarkFollowUpDone(followUpId: string) {
    updateWorkspace((current) => ({
      ...current,
      followUps: current.followUps.map((item) =>
        item.id === followUpId ? { ...item, status: "Done" } : item
      ),
    }));
    showDemoToast("Demo mode — changes reset when refreshed.");
  }

  if (!workspace) {
    return null;
  }

  const totalLeads = workspace.leads.length;
  const hotLeads = workspace.leads.filter((lead) => lead.temp === "Hot").length;
  const qualifiedLeads = workspace.leads.filter((lead) => lead.stage === "Qualified").length;
  const activeDeals = workspace.deals.length;

  return (
    <main className="crm-shell crm-shell-v2">
      <aside className="crm-sidebar">
        <div className="crm-sidebar-brand">
          <MerlynMascot decorative />
          <div>
            <div className="crm-sidebar-brand-name">MERLYN</div>
            <div className="crm-sidebar-brand-tag">Interactive demo for solo agents</div>
          </div>
        </div>

        <nav className="crm-sidebar-nav">
          <a href="#demo-dashboard" className="crm-sidebar-nav-link crm-sidebar-nav-link-active">Today</a>
          <a href="#demo-pipeline" className="crm-sidebar-nav-link">Pipeline</a>
          <a href="#demo-form-preview" className="crm-sidebar-nav-link">Inquiry form</a>
          <a href="#demo-deals" className="crm-sidebar-nav-link">Deals</a>
        </nav>

        <div className="crm-sidebar-footer crm-demo-sidebar-footer">
          <span className="crm-chip crm-chip-info crm-sidebar-mode-chip">DEMO MODE</span>
          <div className="crm-stack-8">
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowInquiryForm(true)}>
              View Inquiry Form
            </button>
            <Link href={SIGNUP_HREF} className="crm-btn crm-btn-primary crm-sidebar-logout">
              Create My Workspace
            </Link>
          </div>
        </div>
      </aside>

      <div className="crm-workspace">
        <div className="crm-demo-banner">
          <div className="crm-demo-banner-copy">
            <strong>You are exploring the Merlyn demo workspace.</strong>
            <span>Leads arrive automatically from the inquiry form and stay organized by stage.</span>
          </div>
          <Link href={SIGNUP_HREF} className="crm-btn crm-btn-primary">
            Create My Workspace
          </Link>
        </div>

        <header id="demo-dashboard" className="crm-topbar crm-demo-topbar">
          <div>
            <div className="crm-topbar-kicker">MERLYN DEMO</div>
            <h1 className="crm-topbar-title">Watch new inquiries turn into real pipeline work</h1>
            <p className="crm-topbar-subtitle">
              This sandbox behaves like Merlyn: inquiry forms create leads automatically, and you can edit,
              move, and review everything without affecting production data.
            </p>
          </div>
          <div className="crm-demo-topbar-actions">
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowInquiryForm(true)}>
              View Inquiry Form
            </button>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={handleGenerateInquiry}>
              Generate Test Inquiry
            </button>
            <Link href={SIGNUP_HREF} className="crm-btn crm-btn-primary">
              Create My Workspace
            </Link>
          </div>
        </header>

        <div className="crm-workspace-content crm-stack-12">
          <section className="crm-kpi-grid crm-dashboard-kpi-grid">
            <KpiCard label="Leads" value={totalLeads} helper="Questionnaire submissions in the workspace" />
            <KpiCard label="Hot leads" value={hotLeads} tone="danger" helper="Need quick follow-up" />
            <KpiCard label="Qualified" value={qualifiedLeads} tone="warn" helper="Ready for next-step work" />
            <KpiCard label="Active deals" value={activeDeals} tone="ok" helper="Live business in motion" />
          </section>

          <section className="crm-dashboard-main-columns crm-demo-dashboard-columns">
            <section className="crm-card crm-dashboard-primary-card crm-section-card crm-stack-10">
              <div className="crm-section-head">
                <div>
                  <h2 className="crm-section-title">Focus today</h2>
                  <p className="crm-section-subtitle">
                    Merlyn keeps the next calls, reviews, and updates visible after an inquiry arrives.
                  </p>
                </div>
                <StatusBadge label={`${followUpsOpen.length} open`} tone={followUpsOpen.length > 0 ? "warn" : "ok"} />
              </div>

              <div className="crm-stack-8">
                {workspace.followUps.map((item) => {
                  const lead = workspace.leads.find((entry) => entry.id === item.leadId);
                  return (
                    <article key={item.id} className="crm-card-muted crm-demo-followup-card">
                      <div className="crm-stack-6">
                        <div className="crm-demo-followup-title">{item.title}</div>
                        <div className="crm-demo-followup-meta">
                          {lead?.fullName || "Lead"} • {item.dueLabel}
                        </div>
                      </div>
                      <div className="crm-inline-actions">
                        <StatusBadge label={item.channel} tone="info" />
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
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
                  <h2 className="crm-section-title">Why the demo matters</h2>
                  <p className="crm-section-subtitle">The whole point is simple: no manual entry, no missed serious inquiry.</p>
                </div>
              </div>
              <div className="crm-card-muted crm-demo-cue-card">
                <div className="crm-demo-cue-title">1. A prospect fills out your form</div>
                <div className="crm-demo-cue-body">Use the demo form or watch the automatic inquiry arrive on first load.</div>
              </div>
              <div className="crm-card-muted crm-demo-cue-card">
                <div className="crm-demo-cue-title">2. Merlyn creates the lead automatically</div>
                <div className="crm-demo-cue-body">A fresh card appears in the pipeline with stage, source, and next step already visible.</div>
              </div>
              <div className="crm-card-muted crm-demo-cue-card">
                <div className="crm-demo-cue-title">3. The agent takes action</div>
                <div className="crm-demo-cue-body">Open the lead, edit details, move stages, add notes, and keep follow-up on track.</div>
              </div>
            </aside>
          </section>

          <section id="demo-pipeline" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Lead pipeline</h2>
                <p className="crm-section-subtitle">
                  Drag cards between stages, open any lead, and see how Merlyn turns inquiries into active work.
                </p>
              </div>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={handleGenerateInquiry}>
                Generate Test Inquiry
              </button>
            </div>

            <div className="crm-demo-board">
              {stageCounts.map((column) => (
                <article
                  key={column.stage}
                  className="crm-card-muted crm-demo-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleStageDrop(column.stage)}
                >
                  <div className="crm-section-head">
                    <div>
                      <h3 className="crm-demo-column-title">{column.stage}</h3>
                      <div className="crm-demo-column-subtitle">{column.count} leads in this stage</div>
                    </div>
                    <StatusBadge label={`${column.count}`} tone={stageTone(column.stage)} />
                  </div>

                  <div className="crm-stack-8">
                    {column.items.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        draggable
                        className={`crm-card crm-demo-lead-card${lead.id === animatedLeadId ? " crm-demo-lead-card-new" : ""}${lead.id === selectedLeadId ? " crm-demo-lead-card-selected" : ""}`}
                        onClick={() => setSelectedLeadId(lead.id)}
                        onDragStart={() => setDragLeadId(lead.id)}
                        onDragEnd={() => setDragLeadId("")}
                      >
                        <div className="crm-demo-lead-card-head">
                          <strong className="crm-demo-lead-name">{lead.fullName}</strong>
                          <StatusBadge label={lead.temp} tone={tempTone(lead.temp)} />
                        </div>
                        <div className="crm-demo-lead-context">{formatContactLine(lead)}</div>
                        <div className="crm-demo-lead-meta">{formatContextMeta(lead)}</div>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="demo-form-preview" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Inquiry form demo</h2>
                <p className="crm-section-subtitle">
                  This is what prospects fill out. In demo mode, every submission creates a lead in the pipeline.
                </p>
              </div>
              <div className="crm-inline-actions">
                <button
                  type="button"
                  className={`crm-btn ${selectedPreview === "link" ? "crm-btn-primary" : "crm-btn-secondary"}`}
                  onClick={() => setSelectedPreview("link")}
                >
                  Preview Link Experience
                </button>
                <button
                  type="button"
                  className={`crm-btn ${selectedPreview === "embedded" ? "crm-btn-primary" : "crm-btn-secondary"}`}
                  onClick={() => setSelectedPreview("embedded")}
                >
                  Preview Embedded Form
                </button>
                <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowInquiryForm(true)}>
                  Open Demo Form
                </button>
              </div>
            </div>

            <div className="crm-demo-preview-shell">
              <div className="crm-demo-preview-topbar">
                <span>{selectedPreview === "link" ? "Shared intake link" : "Embedded questionnaire"}</span>
                <span>Prospect view</span>
              </div>
              <div className="crm-demo-form-preview">
                <div className="crm-demo-form-head">
                  <div className="crm-demo-form-kicker">Merlyn inquiry form</div>
                  <h3>Tell us what you are looking for</h3>
                  <p>This preview matches the form that creates new leads inside the workspace.</p>
                </div>

                <div className="crm-demo-form-grid">
                  <label className="crm-demo-field">
                    <span>Full Name</span>
                    <input type="text" value="Sarah Thompson" readOnly />
                  </label>
                  <label className="crm-demo-field">
                    <span>Email</span>
                    <input type="email" value="sarah.thompson@example.com" readOnly />
                  </label>
                  <label className="crm-demo-field">
                    <span>Phone</span>
                    <input type="text" value="(615) 555-0107" readOnly />
                  </label>
                  <label className="crm-demo-field">
                    <span>Intent</span>
                    <select value="Buying" disabled>
                      <option>Buying</option>
                    </select>
                  </label>
                  <label className="crm-demo-field">
                    <span>Preferred Location</span>
                    <input type="text" value="East Nashville" readOnly />
                  </label>
                  <label className="crm-demo-field">
                    <span>Budget</span>
                    <select value="$500k-$750k" disabled>
                      <option>$500k-$750k</option>
                    </select>
                  </label>
                  <label className="crm-demo-field">
                    <span>Timeline</span>
                    <select value="1-3 months" disabled>
                      <option>1-3 months</option>
                    </select>
                  </label>
                  <label className="crm-demo-field">
                    <span>Contact Preference</span>
                    <select value="Text" disabled>
                      <option>Text</option>
                    </select>
                  </label>
                </div>

                <label className="crm-demo-field">
                  <span>Additional Details</span>
                  <textarea readOnly value="Looking for a walkable neighborhood and quick weekend tours." />
                </label>

                <div className="crm-demo-form-footer">
                  <button type="button" className="crm-btn crm-btn-primary" onClick={() => setShowInquiryForm(true)}>
                    Submit Demo Inquiry
                  </button>
                  <div className="crm-demo-form-note">
                    In demo mode this creates a sandbox lead so you can see Merlyn capture it instantly.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="demo-deals" className="crm-card crm-section-card crm-stack-10">
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Deals</h2>
                <p className="crm-section-subtitle">Transactions stay connected to the original inquiry and the next step.</p>
              </div>
            </div>
            <div className="crm-grid-cards-3">
              {workspace.deals.map((deal) => (
                <article key={deal.id} className="crm-card-muted crm-demo-deal-card">
                  <div className="crm-demo-deal-head">
                    <strong>{deal.title}</strong>
                    <StatusBadge
                      label={deal.stage}
                      tone={deal.stage === "Inspection" ? "warn" : deal.stage === "Showing" ? "info" : "default"}
                    />
                  </div>
                  <div className="crm-demo-deal-meta">{deal.clientName}</div>
                  <div className="crm-demo-deal-address">{deal.address}</div>
                  <div className="crm-demo-deal-meta">
                    {deal.priceLabel} • {deal.timeline}
                  </div>
                  <div className="crm-demo-deal-meta">Next: {deal.nextStep}</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {selectedLead && leadDraft ? (
        <div className="crm-detail-overlay crm-demo-detail-overlay" onClick={() => setSelectedLeadId("")}>
          <section
            className="crm-card crm-detail-shell crm-demo-detail-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-section-head crm-demo-detail-header">
              <div>
                <div className="crm-topbar-kicker">Quick Edit</div>
                <h2 className="crm-section-title crm-demo-detail-title">{selectedLead.fullName}</h2>
                <p className="crm-section-subtitle">{formatContextMeta(selectedLead)}</p>
              </div>
              <div className="crm-inline-actions">
                <Link href={SIGNUP_HREF} className="crm-btn crm-btn-secondary">
                  Create My Workspace
                </Link>
                <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setSelectedLeadId("")}>
                  Close
                </button>
              </div>
            </div>

            <div className="crm-detail-scroll crm-stack-12 crm-demo-detail-scroll">
              <section className="crm-card-muted crm-demo-detail-summary">
                <div className="crm-demo-detail-badges">
                  <StatusBadge label={selectedLead.stage} tone={stageTone(selectedLead.stage)} />
                  <StatusBadge label={selectedLead.temp} tone={tempTone(selectedLead.temp)} />
                  <StatusBadge label={selectedLead.source} tone="info" />
                </div>
                <div className="crm-demo-detail-meta">
                  Last activity: {selectedLead.lastActivity}
                </div>
              </section>

              <section className="crm-card crm-section-card crm-demo-detail-section">
                <div className="crm-section-head">
                  <div>
                    <h3 className="crm-section-title">Lead basics</h3>
                    <p className="crm-section-subtitle">Update the contact details and status you need for quick follow-up.</p>
                  </div>
                </div>
                <div className="crm-demo-form-grid crm-demo-editor-grid">
                  <label className="crm-demo-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={leadDraft.fullName}
                      onChange={(event) => handleLeadDraftChange("fullName", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Phone</span>
                    <input
                      type="text"
                      value={leadDraft.phone}
                      onChange={(event) => handleLeadDraftChange("phone", event.target.value)}
                      onBlur={() => handleLeadDraftChange("phone", formatPhoneDisplay(leadDraft.phone))}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={leadDraft.email}
                      onChange={(event) => handleLeadDraftChange("email", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Stage</span>
                    <select
                      value={leadDraft.stage}
                      onChange={(event) => handleLeadDraftChange("stage", event.target.value as DemoLeadStage)}
                    >
                      {LEAD_STAGE_ORDER.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-demo-field">
                    <span>Temperature</span>
                    <select
                      value={leadDraft.temp}
                      onChange={(event) => handleLeadDraftChange("temp", event.target.value as DemoLead["temp"])}
                    >
                      <option value="Cold">Cold</option>
                      <option value="Warm">Warm</option>
                      <option value="Hot">Hot</option>
                    </select>
                  </label>
                  <label className="crm-demo-field">
                    <span>Source</span>
                    <input type="text" value={leadDraft.source} readOnly />
                  </label>
                </div>
              </section>

              <section className="crm-card crm-section-card crm-demo-detail-section">
                <div className="crm-section-head">
                  <div>
                    <h3 className="crm-section-title">Qualification</h3>
                    <p className="crm-section-subtitle">Keep the inquiry context clean so the next move stays obvious.</p>
                  </div>
                </div>
                <div className="crm-demo-form-grid crm-demo-editor-grid">
                  <label className="crm-demo-field">
                    <span>Intent</span>
                    <input
                      type="text"
                      value={leadDraft.intent}
                      onChange={(event) => handleLeadDraftChange("intent", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Area</span>
                    <input
                      type="text"
                      value={leadDraft.area}
                      onChange={(event) => handleLeadDraftChange("area", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Budget</span>
                    <input
                      type="text"
                      value={leadDraft.budget}
                      onChange={(event) => handleLeadDraftChange("budget", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field">
                    <span>Timeline</span>
                    <input
                      type="text"
                      value={leadDraft.timeline}
                      onChange={(event) => handleLeadDraftChange("timeline", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field crm-demo-field-wide">
                    <span>Next step</span>
                    <input
                      type="text"
                      value={leadDraft.nextStep}
                      onChange={(event) => handleLeadDraftChange("nextStep", event.target.value)}
                    />
                  </label>
                  <label className="crm-demo-field crm-demo-field-wide">
                    <span>Notes</span>
                    <textarea
                      value={leadDraft.notes}
                      onChange={(event) => handleLeadDraftChange("notes", event.target.value)}
                    />
                  </label>
                </div>
                <div className="crm-inline-actions crm-demo-detail-actions">
                  <button type="button" className="crm-btn crm-btn-primary" onClick={handleSaveLead}>
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() => handleAdvanceLead(selectedLead.id)}
                  >
                    Move to Next Stage
                  </button>
                </div>
              </section>

              <section className="crm-card crm-section-card crm-stack-10 crm-demo-detail-section">
                <div className="crm-section-head">
                  <div>
                    <h3 className="crm-section-title">Related deals</h3>
                    <p className="crm-section-subtitle">Demo transactions remain tied to the inquiry that created them.</p>
                  </div>
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
                    No deal attached yet. In Merlyn, this lead is still being qualified and worked forward.
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {showInquiryForm ? (
        <div className="crm-detail-overlay crm-demo-modal-overlay" onClick={() => setShowInquiryForm(false)}>
          <section
            className="crm-card crm-demo-modal-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-section-head crm-demo-modal-header">
              <div>
                <div className="crm-topbar-kicker">Merlyn inquiry form</div>
                <h2 className="crm-section-title">Submit a demo inquiry</h2>
                <p className="crm-section-subtitle">
                  This uses the same lead-capture story Merlyn agents share publicly, but stays inside the demo sandbox.
                </p>
              </div>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowInquiryForm(false)}>
                Close
              </button>
            </div>

            <form className="crm-demo-modal-form" onSubmit={handleSubmitInquiry}>
              <div className="crm-demo-form-grid">
                <label className="crm-demo-field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={inquiryDraft.fullName}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, fullName: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="crm-demo-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={inquiryDraft.email}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, email: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="crm-demo-field">
                  <span>Phone</span>
                  <input
                    type="text"
                    value={inquiryDraft.phone}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                    onBlur={() =>
                      setInquiryDraft((current) => ({
                        ...current,
                        phone: formatPhoneDisplay(current.phone),
                      }))
                    }
                    required
                  />
                </label>
                <label className="crm-demo-field">
                  <span>Intent</span>
                  <select
                    value={inquiryDraft.intent}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, intent: event.target.value }))
                    }
                  >
                    <option value="Buying">Buy</option>
                    <option value="Selling">Sell</option>
                    <option value="Investing">Invest</option>
                    <option value="Just browsing">Just browsing</option>
                  </select>
                </label>
                <label className="crm-demo-field">
                  <span>Preferred Location</span>
                  <input
                    type="text"
                    value={inquiryDraft.area}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, area: event.target.value }))
                    }
                    placeholder="East Nashville"
                  />
                </label>
                <label className="crm-demo-field">
                  <span>Budget</span>
                  <select
                    value={inquiryDraft.budget}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, budget: event.target.value }))
                    }
                  >
                    <option value="Under $250k">Under $250k</option>
                    <option value="$250k-$500k">$250k-$500k</option>
                    <option value="$500k-$750k">$500k-$750k</option>
                    <option value="$750k-$1M">$750k-$1M</option>
                    <option value="$1M+">$1M+</option>
                  </select>
                </label>
                <label className="crm-demo-field">
                  <span>Timeline</span>
                  <select
                    value={inquiryDraft.timeline}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({ ...current, timeline: event.target.value }))
                    }
                  >
                    <option value="ASAP">ASAP</option>
                    <option value="1-3 months">1-3 months</option>
                    <option value="3-6 months">3-6 months</option>
                    <option value="6+ months">6+ months</option>
                    <option value="Just browsing">Just browsing</option>
                  </select>
                </label>
                <label className="crm-demo-field">
                  <span>Contact Preference</span>
                  <select
                    value={inquiryDraft.contactPreference}
                    onChange={(event) =>
                      setInquiryDraft((current) => ({
                        ...current,
                        contactPreference: event.target.value,
                      }))
                    }
                  >
                    <option value="Text">Text</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                  </select>
                </label>
              </div>

              <label className="crm-demo-field crm-demo-field-wide">
                <span>Additional Details</span>
                <textarea
                  value={inquiryDraft.notes}
                  onChange={(event) =>
                    setInquiryDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="What kind of property or timing should the agent know about?"
                />
              </label>

              <label className="crm-demo-field crm-demo-field-wide crm-demo-field-optional">
                <span>How did you find us?</span>
                <input
                  type="text"
                  value={inquiryDraft.referralSource}
                  onChange={(event) =>
                    setInquiryDraft((current) => ({ ...current, referralSource: event.target.value }))
                  }
                  placeholder="Instagram bio link, QR code, website button..."
                />
              </label>

              <div className="crm-inline-actions crm-demo-modal-actions">
                <button type="submit" className="crm-btn crm-btn-primary">
                  Submit Demo Inquiry
                </button>
                <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setShowInquiryForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {showOnboarding ? (
        <div className="crm-detail-overlay crm-demo-modal-overlay crm-demo-onboarding-overlay">
          <section className="crm-card crm-demo-onboarding-shell">
            <div className="crm-topbar-kicker">Welcome to the demo</div>
            <h2 className="crm-section-title">See how Merlyn captures leads automatically</h2>
            <div className="crm-stack-10">
              <div className="crm-card-muted crm-demo-onboarding-step">
                <strong>Step 1</strong>
                <span>This is your lead pipeline.</span>
              </div>
              <div className="crm-card-muted crm-demo-onboarding-step">
                <strong>Step 2</strong>
                <span>When someone fills out your inquiry form, a lead appears here automatically.</span>
              </div>
              <div className="crm-card-muted crm-demo-onboarding-step">
                <strong>Step 3</strong>
                <span>Watch what happens next.</span>
              </div>
            </div>
            <div className="crm-demo-onboarding-actions">
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => {
                  simulateAutomaticInquiry();
                  completeOnboarding();
                }}
              >
                Show me now
              </button>
              <div className="crm-demo-onboarding-note">The demo will auto-capture a new inquiry in a few seconds.</div>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="crm-demo-toast">{toast}</div> : null}
    </main>
  );
}
