"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { parsePositiveDecimal } from "@/lib/deal-metrics";
import {
  DEAL_BOARD_STAGES,
  DEAL_STAGE_VALUES,
  dealStageLabel,
  dealStageTone,
  dealTypeLabel,
  leadDisplayName,
  leadTempTone,
  normalizeDealStage,
  normalizeDealType,
  type DealStage,
  type DealWithLead,
} from "@/lib/deals";
import { normalizeSourceChannel, sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { readOnboardingStateFromAgentSettings, type AccountType } from "@/lib/onboarding";
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
  lead_temp?: unknown;
  source?: unknown;
  intent?: unknown;
  timeline?: unknown;
  location_area?: unknown;
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

function formatUpdatedAt(value: string | null): string {
  if (!value) return "No activity yet";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "No activity yet";
  const hours = Math.round((Date.now() - ts) / 3600_000);
  if (hours <= 24) return `${Math.max(hours, 1)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function draftFromDeal(deal: DealWithLead): DealDraft {
  return {
    property_address: deal.property_address || "",
    price:
      typeof deal.price === "number" || typeof deal.price === "string" ? String(deal.price) : "",
    stage: deal.stage,
    expected_close_date: deal.expected_close_date?.slice(0, 10) || "",
    notes: deal.notes || "",
  };
}

function mapDealRow(row: DealRow): DealWithLead | null {
  const id = asString(row.id);
  const agentId = asString(row.agent_id);
  const leadId = asString(row.lead_id);
  if (!id || !agentId || !leadId) return null;

  const leadValue = normalizeLeadValue(row.lead);
  const lead =
    leadValue && typeof leadValue === "object"
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
          lead_temp: typeof leadValue.lead_temp === "string" ? leadValue.lead_temp : null,
          source: typeof leadValue.source === "string" ? leadValue.source : null,
          intent: typeof leadValue.intent === "string" ? leadValue.intent : null,
          timeline: typeof leadValue.timeline === "string" ? leadValue.timeline : null,
          location_area:
            typeof leadValue.location_area === "string" ? leadValue.location_area : null,
        }
      : null;

  return {
    id,
    agent_id: agentId,
    lead_id: leadId,
    property_address: typeof row.property_address === "string" ? row.property_address : null,
    deal_type: normalizeDealType(typeof row.deal_type === "string" ? row.deal_type : null),
    price: typeof row.price === "number" || typeof row.price === "string" ? row.price : null,
    stage: normalizeDealStage(typeof row.stage === "string" ? row.stage : null),
    expected_close_date:
      typeof row.expected_close_date === "string" ? row.expected_close_date : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    lead: lead && lead.id ? lead : null,
  };
}

type SourceFilter = "all" | "instagram" | "facebook" | "tiktok" | "website_form" | "open_house" | "concierge" | "referral" | "manual" | "other";
type TempFilter = "all" | "Hot" | "Warm" | "Cold";

export default function DealsBoardClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [deals, setDeals] = useState<DealWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [draft, setDraft] = useState<DealDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [tempFilter, setTempFilter] = useState<TempFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "buyer" | "listing">("all");
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  // Add Deal modal
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealName, setAddDealName] = useState("");
  const [addDealType, setAddDealType] = useState<"buyer" | "listing">("buyer");
  const [addDealAddress, setAddDealAddress] = useState("");
  const [addDealPrice, setAddDealPrice] = useState("");
  const [addDealStage, setAddDealStage] = useState<DealStage>("New");
  const [addDealSaving, setAddDealSaving] = useState(false);
  const [addDealError, setAddDealError] = useState("");

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

      const { data: agentRow } = await supabase
        .from("agents")
        .select("settings")
        .eq("id", user.id)
        .maybeSingle();
      const onboardingState = readOnboardingStateFromAgentSettings(agentRow?.settings || null);
      setAccountType(onboardingState.account_type);

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,agent_id,lead_id,property_address,deal_type,price,stage,expected_close_date,notes,created_at,updated_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)"
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

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const sourceOk =
        sourceFilter === "all" ||
        (deal.lead?.source ? normalizeSourceChannel(deal.lead.source) === sourceFilter : false);
      const tempOk = tempFilter === "all" || (deal.lead?.lead_temp || "Warm") === tempFilter;
      const typeOk = typeFilter === "all" || deal.deal_type === typeFilter;
      return sourceOk && tempOk && typeOk;
    });
  }, [deals, sourceFilter, tempFilter, typeFilter]);

  const groupedColumns = useMemo(() => {
    return DEAL_BOARD_STAGES.map((stage) => ({
      stage,
      deals: filteredDeals
        .filter((deal) => deal.stage === stage)
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
    }));
  }, [filteredDeals]);

  const stats = useMemo(() => {
    const active = filteredDeals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost").length;
    const hot = filteredDeals.filter((deal) => (deal.lead?.lead_temp || "").toLowerCase() === "hot").length;
    const stale = filteredDeals.filter((deal) => {
      if (!deal.updated_at) return true;
      const ts = new Date(deal.updated_at).getTime();
      return Number.isNaN(ts) || ts < Date.now() - 5 * 24 * 3600_000;
    }).length;
    return { active, hot, stale };
  }, [filteredDeals]);

  const isOffMarketAccount = accountType === "off_market_agent";

  function patchDealLocal(dealId: string, patch: Partial<DealWithLead>) {
    setDeals((previous) => previous.map((deal) => (deal.id === dealId ? { ...deal, ...patch } : deal)));
  }

  async function persistDealPatch(dealId: string, patch: Partial<DealWithLead>) {
    const previous = deals;
    const updatedAt = new Date().toISOString();
    patchDealLocal(dealId, { ...patch, updated_at: updatedAt });

    const { error } = await supabase.from("deals").update({ ...patch, updated_at: updatedAt }).eq("id", dealId);

    if (error) {
      setDeals(previous);
      setStatus("Could not save deal updates. Reverted.");
      return false;
    }

    setStatus("");
    return true;
  }

  async function handleDrop(targetStage: DealStage, event: DragEvent<HTMLElement>) {
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

  async function handleAddDeal() {
    if (!addDealName.trim()) { setAddDealError("Client name is required."); return; }
    if (!agentId) return;
    setAddDealSaving(true);
    setAddDealError("");

    try {
      // Create lead first
      const leadRes = await fetch("/api/leads/simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: addDealName.trim(),
          source: "manual",
          intent: addDealType === "buyer" ? "Buy" : "Sell",
        }),
      });
      const leadData = (await leadRes.json()) as { lead?: { id: string }; error?: string };
      if (!leadRes.ok || !leadData.lead?.id) {
        setAddDealError(leadData.error || "Could not create contact.");
        return;
      }

      // Create deal
      const price = parsePositiveDecimal(addDealPrice) ?? null;
      const { data: dealRow, error: dealError } = await supabase
        .from("deals")
        .insert({
          agent_id: agentId,
          lead_id: leadData.lead.id,
          deal_type: addDealType,
          property_address: addDealAddress.trim() || null,
          price,
          stage: addDealStage,
          updated_at: new Date().toISOString(),
        })
        .select("id,agent_id,lead_id,property_address,deal_type,price,stage,expected_close_date,notes,created_at,updated_at")
        .single();

      if (dealError || !dealRow) {
        setAddDealError(dealError?.message || "Could not create deal.");
        return;
      }

      const newDeal: DealWithLead = {
        id: dealRow.id as string,
        agent_id: dealRow.agent_id as string,
        lead_id: dealRow.lead_id as string,
        property_address: dealRow.property_address as string | null,
        deal_type: normalizeDealType(dealRow.deal_type as string),
        price: dealRow.price as number | string | null,
        stage: normalizeDealStage(dealRow.stage as string),
        expected_close_date: dealRow.expected_close_date as string | null,
        notes: dealRow.notes as string | null,
        created_at: dealRow.created_at as string | null,
        updated_at: dealRow.updated_at as string | null,
        lead: {
          id: leadData.lead.id,
          full_name: addDealName.trim(),
          first_name: null,
          last_name: null,
          canonical_email: null,
          canonical_phone: null,
          ig_username: null,
          lead_temp: "Warm",
          source: "manual",
          intent: addDealType === "buyer" ? "Buy" : "Sell",
          timeline: null,
          location_area: null,
        },
      };

      setDeals((prev) => [newDeal, ...prev]);
      setAddDealOpen(false);
      setAddDealName("");
      setAddDealAddress("");
      setAddDealPrice("");
      setAddDealStage("New");
      setAddDealType("buyer");
    } catch {
      setAddDealError("Something went wrong. Please try again.");
    } finally {
      setAddDealSaving(false);
    }
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
          <p className="crm-page-subtitle">Sign in to view your deal board.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="crm-page crm-page-wide crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-page-header">
          <div className="crm-page-header-main">
            <p className="crm-page-kicker">Deals</p>
            <h1 className="crm-page-title">{isOffMarketAccount ? "Deal command board" : "Deal-first board"}</h1>
            <p className="crm-page-subtitle">
              {isOffMarketAccount
                ? "Work acquisition and disposition opportunities from one board with clear stage, contact context, and last activity."
                : "Scan stage, source, temperature, and last touch quickly so updating the board feels effortless."}
            </p>
          </div>
          <div className="crm-page-actions">
            <Link href={isOffMarketAccount ? "/app/documents" : "/app/intake"} className="crm-btn crm-btn-secondary">
              {isOffMarketAccount ? "Open documents" : "Review inquiries"}
            </Link>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => { setAddDealOpen(true); setAddDealError(""); }}
            >
              + Add {isOffMarketAccount ? "Deal" : "Client"}
            </button>
          </div>
        </div>

        <div className="crm-inline-actions" style={{ gap: 10, flexWrap: "wrap" }}>
          <StatusBadge label={`Active ${stats.active}`} tone="ok" />
          <StatusBadge label={`Hot ${stats.hot}`} tone={stats.hot > 0 ? "danger" : "default"} />
          <StatusBadge label={`Stale ${stats.stale}`} tone={stats.stale > 0 ? "warn" : "default"} />
        </div>

        <div className="crm-filter-row">
          <label className="crm-filter-field">
            <span>Source</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
              <option value="all">All sources</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="website_form">Website Form</option>
              <option value="open_house">Open House</option>
              <option value="concierge">Concierge</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="crm-filter-field">
            <span>Temperature</span>
            <select value={tempFilter} onChange={(event) => setTempFilter(event.target.value as TempFilter)}>
              <option value="all">All temperatures</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </label>
          <label className="crm-filter-field">
            <span>Deal type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | "buyer" | "listing")}>
              <option value="all">All deal types</option>
              <option value="buyer">Buyer</option>
              <option value="listing">Seller</option>
            </select>
          </label>
        </div>
      </section>

      {status ? (
        <section className="crm-card crm-section-card">
          <div style={{ fontSize: 13 }}>{status}</div>
        </section>
      ) : null}

      {filteredDeals.length === 0 ? (
        <EmptyState
          title="No deals match these filters"
          body="Inbound inquiries create deals automatically once they are captured, so this board will fill itself as new intake arrives."
          action={
            <div className="crm-inline-actions">
              <Link href="/app/intake" className="crm-btn crm-btn-primary">
                Open intake
              </Link>
            </div>
          }
        />
      ) : (
        <section className="crm-board-columns">
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
                    className="crm-card-muted crm-deal-card"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div className="crm-stack-4" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {deal.property_address || leadDisplayName(deal.lead)}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                          {leadDisplayName(deal.lead)}
                        </div>
                      </div>
                      {deal.lead?.lead_temp ? (
                        <StatusBadge label={deal.lead.lead_temp} tone={leadTempTone(deal.lead.lead_temp)} />
                      ) : null}
                    </div>

                    <div className="crm-inline-actions" style={{ gap: 6 }}>
                      <StatusBadge label={dealTypeLabel(deal.deal_type)} tone="default" />
                      {deal.lead?.source ? (
                        <StatusBadge label={sourceChannelLabel(deal.lead.source)} tone={sourceChannelTone(deal.lead.source)} />
                      ) : null}
                    </div>

                    <div className="crm-stack-4">
                      {deal.lead?.intent || deal.lead?.timeline || deal.lead?.location_area ? (
                        <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                          {[deal.lead?.intent, deal.lead?.timeline, deal.lead?.location_area]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                        Last touch {formatUpdatedAt(deal.updated_at)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {isDetailOpen && selectedDeal && draft ? (
        <div className="crm-modal-backdrop" onClick={() => setIsDetailOpen(false)}>
          <section className="crm-card crm-deal-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Deal detail</h2>
                <p className="crm-section-subtitle" style={{ marginTop: 4 }}>
                  Update the deal without leaving the board.
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={() => setIsDetailOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="crm-card-muted crm-stack-8" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{draft.property_address || "No property context yet"}</div>
                  <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
                    {leadDisplayName(selectedDeal.lead)}
                  </div>
                </div>
                <StatusBadge label={selectedDeal.lead?.lead_temp || "Warm"} tone={leadTempTone(selectedDeal.lead?.lead_temp)} />
              </div>
              <div className="crm-inline-actions" style={{ gap: 8 }}>
                <StatusBadge label={dealTypeLabel(selectedDeal.deal_type)} tone="default" />
                <StatusBadge label={dealStageLabel(selectedDeal.stage)} tone={dealStageTone(selectedDeal.stage)} />
                {selectedDeal.lead?.source ? (
                  <StatusBadge label={sourceChannelLabel(selectedDeal.lead.source)} tone={sourceChannelTone(selectedDeal.lead.source)} />
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                {[selectedDeal.lead?.intent, selectedDeal.lead?.timeline, selectedDeal.lead?.location_area]
                  .filter(Boolean)
                  .join(" • ") || "No additional qualification context yet."}
              </div>
            </div>

            <div className="crm-two-column-form">
              <label className="crm-filter-field">
                <span>Property / context</span>
                <input
                  value={draft.property_address}
                  onChange={(event) => {
                    setDraft((previous) => previous ? { ...previous, property_address: event.target.value } : previous);
                    setDraftDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Price</span>
                <input
                  value={draft.price}
                  inputMode="decimal"
                  onChange={(event) => {
                    setDraft((previous) => previous ? { ...previous, price: event.target.value } : previous);
                    setDraftDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Stage</span>
                <select
                  value={draft.stage}
                  onChange={(event) => {
                    const value = normalizeDealStage(event.target.value);
                    if (!(DEAL_STAGE_VALUES as readonly string[]).includes(value)) return;
                    setDraft((previous) => previous ? { ...previous, stage: value } : previous);
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

              <label className="crm-filter-field">
                <span>Expected close date</span>
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
            </div>

            <label className="crm-filter-field">
              <span>Notes</span>
              <textarea
                rows={6}
                value={draft.notes}
                onChange={(event) => {
                  setDraft((previous) => (previous ? { ...previous, notes: event.target.value } : previous));
                  setDraftDirty(true);
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                Last update {formatCloseDate(selectedDeal.updated_at)}
              </div>
              <div className="crm-inline-actions">
                {selectedDeal.lead?.id ? (
                  <Link href={`/app/leads/${selectedDeal.lead.id}`} className="crm-btn crm-btn-secondary">
                    Open record
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => void saveDealDraft()}
                  disabled={!draftDirty || savingDraft}
                >
                  {savingDraft ? "Saving..." : "Save deal"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Add Deal / Add Client modal */}
      {addDealOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAddDealOpen(false); }}
        >
          <div style={{ background: "var(--surface-1, #fff)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {isOffMarketAccount ? "Add Deal" : "Add Client"}
              </h2>
              <button type="button" onClick={() => setAddDealOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-muted)" }}>×</button>
            </div>

            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
              Client name *
              <input
                className="crm-input"
                value={addDealName}
                onChange={(e) => setAddDealName(e.target.value)}
                placeholder="Jane Smith"
                autoFocus
              />
            </label>

            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
              Deal type
              <select className="crm-input" value={addDealType} onChange={(e) => setAddDealType(e.target.value as "buyer" | "listing")}>
                <option value="buyer">Buyer</option>
                <option value="listing">Listing (Seller)</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
              Property address
              <input
                className="crm-input"
                value={addDealAddress}
                onChange={(e) => setAddDealAddress(e.target.value)}
                placeholder="123 Main St, Austin TX (optional)"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
                Price
                <input
                  className="crm-input"
                  value={addDealPrice}
                  onChange={(e) => setAddDealPrice(e.target.value)}
                  placeholder="450000"
                  type="number"
                  min="0"
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
                Stage
                <select className="crm-input" value={addDealStage} onChange={(e) => setAddDealStage(e.target.value as DealStage)}>
                  {DEAL_BOARD_STAGES.map((s) => (
                    <option key={s} value={s}>{dealStageLabel(s)}</option>
                  ))}
                </select>
              </label>
            </div>

            {addDealError && (
              <div style={{ fontSize: 13, color: "var(--color-error-text, #991b1b)", background: "var(--color-error-bg, #fee2e2)", border: "1px solid var(--color-error-border, #fca5a5)", borderRadius: 6, padding: "8px 12px" }}>
                {addDealError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setAddDealOpen(false)} disabled={addDealSaving}>
                Cancel
              </button>
              <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleAddDeal()} disabled={addDealSaving}>
                {addDealSaving ? "Adding..." : isOffMarketAccount ? "Add Deal" : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
