"use client";

import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency, parsePositiveDecimal } from "@/lib/deal-metrics";
import { dealStageLabel, normalizeDealStage, type DealStage } from "@/lib/deals";
import AskMerlynCard from "./ask-merlyn-card";

type LeadForAsk = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  time_last_updated: string | null;
};

type PriorityDeal = {
  id: string;
  client_name: string;
  property_address: string | null;
  price: number | string | null;
  stage: DealStage;
  expected_close_date: string | null;
  updated_at: string | null;
};

function dealStageTone(stage: DealStage): "default" | "ok" | "warn" | "danger" {
  if (stage === "lost") return "danger";
  if (stage === "closed") return "ok";
  if (stage === "under_contract" || stage === "inspection" || stage === "appraisal" || stage === "closing") {
    return "warn";
  }
  return "default";
}

function formatDealCloseDate(value: string | null): string {
  if (!value) return "No close date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No close date";
  return date.toLocaleDateString();
}

function formatDealPrice(value: number | string | null): string {
  const parsed = parsePositiveDecimal(value);
  if (parsed === null) return "-";
  return formatCurrency(parsed);
}

export default function DashboardRightRail({
  leads,
  activeDeals,
  underContract,
  closingThisMonth,
  priorityDeals,
}: {
  leads: LeadForAsk[];
  activeDeals: number;
  underContract: number;
  closingThisMonth: number;
  priorityDeals: PriorityDeal[];
}) {
  return (
    <div className="crm-utility-rail">
      <AskMerlynCard leads={leads} />

      <section className="crm-card crm-utility-card crm-dashboard-secondary-card">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Deals Snapshot</h2>
            <p className="crm-section-subtitle" style={{ marginTop: 4 }}>Track active transactions at a glance.</p>
          </div>
          <Link href="/app/deals" className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
            View All Deals
          </Link>
        </div>

        <div className="crm-inline-actions" style={{ marginTop: 8 }}>
          <span className="crm-chip">Active Deals: {activeDeals}</span>
          <span className="crm-chip">Under Contract: {underContract}</span>
          <span className="crm-chip">Closing This Month: {closingThisMonth}</span>
        </div>

        <div className="crm-stack-8" style={{ marginTop: 10 }}>
          {priorityDeals.length === 0 ? (
            <EmptyState
              title="No active deals yet"
              body="Convert a lead into a deal to start tracking your transaction pipeline."
              action={<Link href="/app/deals" className="crm-btn crm-btn-secondary">Open Deals Board</Link>}
            />
          ) : (
            priorityDeals.map((deal) => {
              const stage = normalizeDealStage(deal.stage);
              return (
                <article key={deal.id} className="crm-card-muted" style={{ padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{deal.client_name}</div>
                      {deal.property_address ? (
                        <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {deal.property_address}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge label={dealStageLabel(stage)} tone={dealStageTone(stage)} />
                  </div>
                  <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-muted)" }}>
                    <span>{formatDealPrice(deal.price)}</span>
                    <span>Close: {formatDealCloseDate(deal.expected_close_date)}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="crm-card crm-utility-card">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Quick Actions</h2>
        </div>
        <div className="crm-stack-8">
          <Link href="/app/list" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Open Leads</Link>
          <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Open Pipeline</Link>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Open Lead Intake</Link>
          <Link href="/app/onboarding" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Setup Guide</Link>
        </div>
      </section>
    </div>
  );
}
