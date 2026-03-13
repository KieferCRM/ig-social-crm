"use client";

import { useMemo, useState } from "react";
import LeadListTable, { type LeadListRow } from "./lead-list-table";
import ManualLeadForm from "./manual-lead-form";
import MergeTool from "./merge-tool";

type LeadWorkspaceClientProps = {
  leads: LeadListRow[];
  initialFilters: {
    search: string;
    stage: string;
    temp: string;
    source: string;
  };
  followUpDueMode: boolean;
  followUpLeadIds: string[];
  errorMessage?: string | null;
};

export default function LeadWorkspaceClient({
  leads,
  initialFilters,
  followUpDueMode,
  followUpLeadIds,
  errorMessage,
}: LeadWorkspaceClientProps) {
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const mergeableLeads = useMemo(
    () =>
      leads.map((lead) => ({
        id: String(lead.id),
        ig_username: lead.ig_username || null,
        full_name: lead.full_name || null,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        canonical_email: lead.canonical_email || null,
        canonical_phone: lead.canonical_phone || null,
        stage: lead.stage || null,
        lead_temp: lead.lead_temp || null,
      })),
    [leads]
  );

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Leads Workspace</h1>
            <p className="crm-page-subtitle">
              Search, filter, and open the right lead quickly without losing the table as your main working surface.
            </p>
          </div>
          <div className="crm-page-actions">
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => setAddLeadOpen(true)}>
              Add Lead
            </button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{errorMessage}</div>
        </section>
      ) : null}

      <LeadListTable
        leads={leads}
        initialFilters={initialFilters}
        followUpDueMode={followUpDueMode}
        followUpLeadIds={followUpLeadIds}
        toolbarActions={
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            style={{ padding: "7px 10px", fontSize: 12 }}
            onClick={() => setMergeOpen((value) => !value)}
          >
            {mergeOpen ? "Hide merge tool" : "Merge Leads"}
          </button>
        }
      />

      {mergeOpen ? <MergeTool leads={mergeableLeads} /> : null}

      {addLeadOpen ? (
        <div className="crm-workspace-tool-overlay" role="presentation" onClick={() => setAddLeadOpen(false)}>
          <aside
            className="crm-workspace-tool-drawer"
            aria-label="Add lead manually"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="crm-workspace-tool-drawer__header">
              <div>
                <h2 className="crm-section-title" style={{ margin: 0 }}>Add Lead</h2>
                <p className="crm-section-subtitle" style={{ marginTop: 4 }}>
                  Capture a referral, call, or manual inquiry without leaving the workspace.
                </p>
              </div>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setAddLeadOpen(false)}>
                Close
              </button>
            </div>
            <div className="crm-workspace-tool-drawer__body">
              <ManualLeadForm onSaved={() => setAddLeadOpen(false)} onCancel={() => setAddLeadOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
