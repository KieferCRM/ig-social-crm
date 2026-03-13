"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import { parsePositiveDecimal, formatCurrency, asInputDate, asInputNumber } from "@/lib/deal-metrics";
import {
  DEAL_BOARD_STAGES,
  DEAL_STAGE_VALUES,
  dealStageLabel,
  dealTypeLabel,
  leadDisplayName,
  normalizeDealStage,
  normalizeDealType,
  type DealBoardStage,
  type DealStage,
  type DealWithLead,
} from "@/lib/deals";
import { supabaseBrowser } from "@/lib/supabase/browser";

type DealDraft = {
  property_address: string;
  price: string;
  stage: DealStage;
  expected_close_date: string;
  notes: string;
};

type DealLeadRow = {
  id?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  canonical_email?: unknown;
  canonical_phone?: unknown;
  ig_username?: unknown;
} | null;

type DealRow = {
  id?: unknown;
  agent_id?: unknown;
  lead_id?: unknown;
  property_address?: unknown;
  deal_type?: unknown;
  price?: unknown;
  stage?: unknown;
  expected_close_date?: unknown;
  notes?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  lead?: DealLeadRow | DealLeadRow[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeLeadValue(
  value: DealLeadRow | DealLeadRow[] | undefined
): Exclude<DealLeadRow, null> | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  return first;
}

function formatCloseDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function draftFromDeal(deal: DealWithLead): DealDraft {
  return {
    property_address: deal.property_address || "",
    price: asInputNumber(parsePositiveDecimal(deal.price)),
    stage: deal.stage,
    expected_close_date: asInputDate(deal.expected_close_date),
    notes: deal.notes || "",
  };
}

function isCurrentMonth(dateValue: string | null): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function mapDealRow(row: DealRow): DealWithLead | null {
  const id = asString(row.id);
  const agentId = asString(row.agent_id);
  const leadId = asString(row.lead_id);
  if (!id || !agentId || !leadId) return null;

  const leadValue = normalizeLeadValue(row.lead);

  const lead = leadValue && typeof leadValue === "object"
    ? {
        id: asString(leadValue.id),
        full_name: typeof leadValue.full_name === "string" ? leadValue.full_name : null,
        first_name: typeof leadValue.first_name === "string" ? leadValue.first_name : null,
        last_name: typeof leadValue.last_name === "string" ? leadValue.last_name : null,
        canonical_email:
          typeof leadValue.canonical_email === "string" ? leadValue.canonical_email : null,
        canonical_phone:
          typeof leadValue.canonical_phone === "string" ? leadValue.canonical_phone : null,
        ig_username: typeof leadValue.ig_username === "string" ? leadValue.ig_username : null,
      }
    : null;

  return {
    id,
    agent_id: agentId,
    lead_id: leadId,
    property_address: typeof row.property_address === "string" ? row.property_address : null,
    deal_type: normalizeDealType(typeof row.deal_type === "string" ? row.deal_type : null),
    price:
      typeof row.price === "number" || typeof row.price === "string"
        ? row.price
        : null,
    stage: normalizeDealStage(typeof row.stage === "string" ? row.stage : null),
    expected_close_date:
      typeof row.expected_close_date === "string" ? row.expected_close_date : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    lead: lead && lead.id ? lead : null,
  };
}

export default function DealsBoardClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [deals, setDeals] = useState<DealWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);

  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [draft, setDraft] = useState<DealDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const draggedDealIdRef = useRef<string | null>(null);

  const selectedDeal = useMemo(
    () => deals.find((deal) => deal.id === selectedDealId) || null,
    [deals, selectedDealId]
  );

  useEffect(() => {
    if (!selectedDeal) {
      setDraft(null);
      setDraftDirty(false);
      return;
    }
    setDraft(draftFromDeal(selectedDeal));
    setDraftDirty(false);
  }, [selectedDeal]);

  useEffect(() => {
    if (!isDetailOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDetailOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDetailOpen]);

  useEffect(() => {
    async function loadDeals() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setStatus("You need to sign in first.");
        setDeals([]);
        setAgentId(null);
        setLoading(false);
        return;
      }

      setAgentId(user.id);

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,agent_id,lead_id,property_address,deal_type,price,stage,expected_close_date,notes,created_at,updated_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username)"
        )
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        setStatus("Could not load deals.");
        setDeals([]);
        setLoading(false);
        return;
      }

      const rows = Array.isArray(data) ? (data as DealRow[]) : [];
      setDeals(rows.map(mapDealRow).filter((row): row is DealWithLead => Boolean(row)));
      setStatus("");
      setLoading(false);
    }

    void loadDeals();
  }, [supabase]);

  const groupedColumns = useMemo(() => {
    return DEAL_BOARD_STAGES.map((stage) => ({
      stage,
      deals: deals
        .filter((deal) => deal.stage === stage)
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
    }));
  }, [deals]);

  const lostDeals = useMemo(
    () =>
      deals
        .filter((deal) => deal.stage === "lost")
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
    [deals]
  );

  const stats = useMemo(() => {
    const active = deals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost").length;
    const underContract = deals.filter((deal) => deal.stage === "under_contract").length;
    const closingThisMonth = deals.filter(
      (deal) =>
        deal.stage !== "lost" &&
        deal.stage !== "closed" &&
        isCurrentMonth(deal.expected_close_date)
    ).length;
    const totalClosed = deals.filter((deal) => deal.stage === "closed").length;
    return { active, underContract, closingThisMonth, totalClosed };
  }, [deals]);

  function patchDealLocal(dealId: string, patch: Partial<DealWithLead>) {
    setDeals((previous) =>
      previous.map((deal) => (deal.id === dealId ? { ...deal, ...patch } : deal))
    );
  }

  async function persistDealPatch(dealId: string, patch: Partial<DealWithLead>) {
    const previous = deals;
    const updatedAt = new Date().toISOString();
    patchDealLocal(dealId, { ...patch, updated_at: updatedAt });

    const { error } = await supabase
      .from("deals")
      .update({ ...patch, updated_at: updatedAt })
      .eq("id", dealId);

    if (error) {
      setDeals(previous);
      setStatus("Could not save deal updates. Reverted.");
      return false;
    }

    setStatus("");
    return true;
  }

  async function handleDrop(targetStage: DealBoardStage, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const idFromTransfer = event.dataTransfer.getData("text/plain");
    const dealId = idFromTransfer || draggedDealIdRef.current;
    draggedDealIdRef.current = null;

    if (!dealId) return;
    const current = deals.find((deal) => deal.id === dealId);
    if (!current || current.stage === targetStage) return;

    void persistDealPatch(dealId, { stage: targetStage });

    if (selectedDealId === dealId) {
      setDraft((previous) => (previous ? { ...previous, stage: targetStage } : previous));
      setDraftDirty(true);
    }
  }

  async function saveDealDraft() {
    if (!selectedDeal || !draft) return;
    const propertyAddress = draft.property_address.trim();
    if (!propertyAddress) {
      setStatus("Property address is required.");
      return;
    }

    const parsedPrice = parsePositiveDecimal(draft.price);
    if (draft.price.trim() && parsedPrice === null) {
      setStatus("Price must be a valid positive number.");
      return;
    }

    if (
      draft.expected_close_date.trim() &&
      Number.isNaN(new Date(draft.expected_close_date).getTime())
    ) {
      setStatus("Expected close date must be a valid date.");
      return;
    }

    setSavingDraft(true);

    const ok = await persistDealPatch(selectedDeal.id, {
      property_address: propertyAddress,
      price: parsedPrice,
      stage: draft.stage,
      expected_close_date: draft.expected_close_date.trim() || null,
      notes: draft.notes.trim() || null,
    });

    setSavingDraft(false);
    if (ok) {
      setDraftDirty(false);
      setStatus("Deal saved.");
    }
  }

  function openDealDetail(dealId: string) {
    setSelectedDealId(dealId);
    setIsDetailOpen(true);
  }

  if (loading) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading deals...</div>
        </section>
      </main>
    );
  }

  if (!agentId) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <h1 className="crm-page-title">Deals</h1>
          <p className="crm-page-subtitle">Sign in to view your transaction pipeline.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <h1 className="crm-page-title">Deals</h1>
            <p className="crm-page-subtitle">
              Track each transaction by stage, date, and linked lead without overloading the page.
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href="/app/list" className="crm-btn crm-btn-secondary">
              Leads
            </Link>
            <Link href="/app/kanban" className="crm-btn crm-btn-secondary">
              Pipeline
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Active Deals</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{stats.active}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Under Contract</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{stats.underContract}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Closing This Month</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{stats.closingThisMonth}</div>
        </article>
        <article className="crm-card crm-section-card">
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Total Closed Deals</div>
          <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700 }}>{stats.totalClosed}</div>
        </article>
      </section>

      {status ? (
        <section className="crm-card crm-section-card">
          <div style={{ fontSize: 13 }}>{status}</div>
        </section>
      ) : null}

      {deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          body="When a lead turns active, convert it to a deal so dates, notes, and next steps stay visible."
          action={
            <div className="crm-inline-actions">
              <Link href="/app/list" className="crm-btn crm-btn-primary">
                Open leads
              </Link>
            </div>
          }
        />
      ) : (
        <section
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(230px, 1fr)",
            gap: 10,
            overflowX: "auto",
            alignItems: "start",
            paddingBottom: 6,
          }}
        >
          {groupedColumns.map((column) => (
            <article
              key={column.stage}
              className="crm-card crm-section-card"
              style={{ minHeight: 320 }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void handleDrop(column.stage, event)}
            >
              <div className="crm-section-head">
                <h2 className="crm-section-title">{dealStageLabel(column.stage)}</h2>
                <span className="crm-chip">{column.deals.length}</span>
              </div>

              <div className="crm-stack-8">
                {column.deals.map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      draggedDealIdRef.current = deal.id;
                      event.dataTransfer.setData("text/plain", deal.id);
                    }}
                    onClick={() => openDealDetail(deal.id)}
                    className="crm-card-muted"
                    style={{
                      textAlign: "left",
                      padding: 10,
                      border:
                        selectedDealId === deal.id && isDetailOpen
                          ? "1px solid var(--accent)"
                          : "1px solid var(--line)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {deal.property_address || "No address yet"}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                      {leadDisplayName(deal.lead)}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="crm-chip">{dealTypeLabel(deal.deal_type)}</span>
                      <span className="crm-chip">
                        {formatCurrency(parsePositiveDecimal(deal.price))}
                      </span>
                      <span className="crm-chip">{dealStageLabel(deal.stage)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {lostDeals.length > 0 ? (
        <section className="crm-card crm-section-card crm-stack-8">
          <div className="crm-section-head">
            <h2 className="crm-section-title">Lost deals</h2>
            <span className="crm-chip">{lostDeals.length}</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {lostDeals.map((deal) => (
              <button
                key={deal.id}
                type="button"
                className="crm-card-muted"
                onClick={() => openDealDetail(deal.id)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  border: "1px solid var(--line)",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {deal.property_address || "No address yet"}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  {leadDisplayName(deal.lead)}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isDetailOpen && selectedDeal && draft ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(4, 10, 22, 0.72)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setIsDetailOpen(false)}
        >
          <section
            className="crm-card"
            style={{
              width: "min(700px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>Deal Details</strong>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={() => setIsDetailOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{draft.property_address || "No address yet"}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                {leadDisplayName(selectedDeal.lead)}
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="crm-chip">{dealTypeLabel(selectedDeal.deal_type)}</span>
                <span className="crm-chip">
                  Stage: {dealStageLabel(normalizeDealStage(draft.stage))}
                </span>
                <span className="crm-chip">
                  Price: {formatCurrency(parsePositiveDecimal(draft.price))}
                </span>
              </div>
            </div>

            <section className="crm-card-muted" style={{ padding: 10, display: "grid", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Linked Lead</strong>
              <div style={{ fontSize: 13 }}>{leadDisplayName(selectedDeal.lead)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-muted)" }}>
                <span>{selectedDeal.lead?.canonical_email || "No email"}</span>
                <span>{selectedDeal.lead?.canonical_phone || "No phone"}</span>
                {selectedDeal.lead?.id ? (
                  <Link href={`/app/leads/${selectedDeal.lead.id}`} className="crm-chip crm-chip-info">
                    Open Lead
                  </Link>
                ) : null}
              </div>
            </section>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Property Address</span>
              <input
                value={draft.property_address}
                onChange={(event) => {
                  setDraft((previous) =>
                    previous ? { ...previous, property_address: event.target.value } : previous
                  );
                  setDraftDirty(true);
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Price</span>
              <input
                inputMode="decimal"
                value={draft.price}
                onChange={(event) => {
                  setDraft((previous) =>
                    previous ? { ...previous, price: event.target.value } : previous
                  );
                  setDraftDirty(true);
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Stage</span>
              <select
                value={draft.stage}
                onChange={(event) => {
                  const value = normalizeDealStage(event.target.value);
                  if (!(DEAL_STAGE_VALUES as readonly string[]).includes(value)) return;
                  setDraft((previous) => (previous ? { ...previous, stage: value } : previous));
                  setDraftDirty(true);
                }}
              >
                {DEAL_STAGE_VALUES.map((stage) => (
                  <option key={stage} value={stage}>
                    {dealStageLabel(stage)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Expected Close Date</span>
              <input
                type="date"
                value={draft.expected_close_date}
                onChange={(event) => {
                  setDraft((previous) =>
                    previous ? { ...previous, expected_close_date: event.target.value } : previous
                  );
                  setDraftDirty(true);
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Notes</span>
              <textarea
                rows={5}
                value={draft.notes}
                onChange={(event) => {
                  setDraft((previous) =>
                    previous ? { ...previous, notes: event.target.value } : previous
                  );
                  setDraftDirty(true);
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                Last update: {formatCloseDate(selectedDeal.updated_at)}
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                style={{ padding: "8px 10px", fontSize: 12 }}
                onClick={() => void saveDealDraft()}
                disabled={!draftDirty || savingDraft}
              >
                {savingDraft ? "Saving..." : "Save Deal"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
