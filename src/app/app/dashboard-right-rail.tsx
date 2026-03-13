"use client";

import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency, parsePositiveDecimal } from "@/lib/deal-metrics";
import { dealStageLabel, normalizeDealStage, type DealStage } from "@/lib/deals";

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
  activeDeals,
  underContract,
  closingThisMonth,
  priorityDeals,
}: {
  activeDeals: number;
  underContract: number;
  closingThisMonth: number;
  priorityDeals: PriorityDeal[];
}) {
  return (
    <div className="crm-utility-rail">
      <section className="crm-card crm-utility-card crm-dashboard-secondary-card">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Deals snapshot</h2>
            <p className="crm-section-subtitle" style={{ marginTop: 4 }}>Keep active transactions visible without leaving today&apos;s queue.</p>
          </div>
          <Link href="/app/deals" className="crm-btn crm-btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }}>
            Open deals
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
              body="When a lead turns serious, convert it to a deal so close dates and next steps stay visible."
              action={<Link href="/app/list" className="crm-btn crm-btn-secondary">Open leads</Link>}
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
          <h2 className="crm-section-title">Keep the workspace moving</h2>
        </div>
        <p className="crm-section-subtitle" style={{ marginTop: 0 }}>
          Start where progress is most likely: today&apos;s leads, the pipeline, or your intake link.
        </p>
        <div className="crm-stack-8">
          <Link href="/app/list?follow_up=due" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Review due follow-ups</Link>
          <Link href="/app/kanban" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Open pipeline</Link>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>Share intake link</Link>
        </div>
      </section>
    </div>
  );
}
