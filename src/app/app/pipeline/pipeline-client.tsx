"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { parsePositiveDecimal, formatCurrency, asInputNumber, asInputDate } from "@/lib/deal-metrics";
import {
  OFF_MARKET_STAGES,
  PIPELINE_TAGS,
  normalizeOffMarketStage,
  offMarketStageLabel,
  pipelineStageLabel,
  pipelineStageTone,
  type OffMarketStage,
} from "@/lib/pipeline";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import { supabaseBrowser } from "@/lib/supabase/browser";

// ─── Local types ────────────────────────────────────────────────────────────

type PipelineDeal = {
  id: string;
  lead_id: string;
  seller_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
  seller_source: string | null;
  property_address: string | null;
  price: number | null;
  offer_price: number | null;
  stage: string;
  tags: string[];
  stage_entered_at: string | null;
  next_followup_date: string | null;
  notes: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type AddDraft = {
  property_address: string;
  seller_name: string;
  asking_price: string;
  offer_price: string;
  stage: OffMarketStage;
  tags: string[];
  next_followup_date: string;
  notes: string;
};

type DetailDraft = {
  property_address: string;
  asking_price: string;
  offer_price: string;
  stage: OffMarketStage;
  tags: string[];
  next_followup_date: string;
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_ADD_DRAFT: AddDraft = {
  property_address: "",
  seller_name: "",
  asking_price: "",
  offer_price: "",
  stage: "prospecting",
  tags: [],
  next_followup_date: "",
  notes: "",
};

function daysInStage(stageEnteredAt: string | null, updatedAt: string | null): number {
  const ref = stageEnteredAt || updatedAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function priceDisplay(value: number | null): string {
  if (value === null) return "—";
  return formatCurrency(value);
}

function dateDisplay(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function toggleTag(current: string[], tag: string): string[] {
  return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
}

// ─── Raw DB row types ─────────────────────────────────────────────────────────

type RawLeadField = { full_name?: unknown; canonical_phone?: unknown; canonical_email?: unknown; source?: unknown } | null;

type RawDealRow = {
  id?: unknown;
  lead_id?: unknown;
  property_address?: unknown;
  price?: unknown;
  offer_price?: unknown;
  stage?: unknown;
  tags?: unknown;
  stage_entered_at?: unknown;
  next_followup_date?: unknown;
  notes?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
  lead?: RawLeadField | RawLeadField[];
};

function mapDealRow(row: RawDealRow): PipelineDeal | null {
  const id = typeof row.id === "string" ? row.id : "";
  const leadId = typeof row.lead_id === "string" ? row.lead_id : "";
  if (!id || !leadId) return null;

  const rawLead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
  const sellerName =
    rawLead && typeof rawLead === "object" && typeof rawLead.full_name === "string"
      ? rawLead.full_name
      : null;
  const sellerPhone =
    rawLead && typeof rawLead === "object" && typeof rawLead.canonical_phone === "string"
      ? rawLead.canonical_phone
      : null;
  const sellerEmail =
    rawLead && typeof rawLead === "object" && typeof rawLead.canonical_email === "string"
      ? rawLead.canonical_email
      : null;
  const sellerSource =
    rawLead && typeof rawLead === "object" && typeof rawLead.source === "string"
      ? rawLead.source
      : null;

  return {
    id,
    lead_id: leadId,
    seller_name: sellerName,
    seller_phone: sellerPhone,
    seller_email: sellerEmail,
    seller_source: sellerSource,
    property_address: typeof row.property_address === "string" ? row.property_address : null,
    price: typeof row.price === "number" ? row.price : null,
    offer_price: typeof row.offer_price === "number" ? row.offer_price : null,
    stage: typeof row.stage === "string" ? row.stage : "prospecting",
    tags: Array.isArray(row.tags)
      ? (row.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    stage_entered_at: typeof row.stage_entered_at === "string" ? row.stage_entered_at : null,
    next_followup_date:
      typeof row.next_followup_date === "string" ? row.next_followup_date : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

function draftFromDeal(deal: PipelineDeal): DetailDraft {
  return {
    property_address: deal.property_address || "",
    asking_price: asInputNumber(deal.price),
    offer_price: asInputNumber(deal.offer_price),
    stage: normalizeOffMarketStage(deal.stage),
    tags: deal.tags.slice(),
    next_followup_date: asInputDate(deal.next_followup_date),
    notes: deal.notes || "",
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PipelineClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Custom tags — loaded from agents.settings.pipeline_tags
  const [agentTags, setAgentTags] = useState<string[]>([...PIPELINE_TAGS]);
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown>>({});
  const [newTagInput, setNewTagInput] = useState("");

  // Filters
  const [stageFilter, setStageFilter] = useState<"all" | OffMarketStage>("all");
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  // Add Deal modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>(EMPTY_ADD_DRAFT);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Deal detail modal
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);

  // ── Load deals ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    async function loadDeals() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      if (active) setAgentId(user.id);

      // Load agent settings for custom tags
      const { data: agentRow } = await supabase
        .from("agents")
        .select("settings")
        .eq("id", user.id)
        .maybeSingle();

      if (active && agentRow?.settings) {
        const settings = agentRow.settings as Record<string, unknown>;
        setAgentSettings(settings);
        const savedTags = settings.pipeline_tags;
        if (Array.isArray(savedTags) && savedTags.length > 0) {
          setAgentTags(savedTags.filter((t): t is string => typeof t === "string"));
        }
      }

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,lead_id,property_address,price,offer_price,stage,tags,stage_entered_at,next_followup_date,notes,updated_at,created_at,lead:leads(full_name,canonical_phone,canonical_email,source)"
        )
        .eq("agent_id", user.id)
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (error) {
        setStatus("Could not load pipeline deals.");
        setLoading(false);
        return;
      }

      const rows = (data || []) as RawDealRow[];
      setDeals(rows.map(mapDealRow).filter((r): r is PipelineDeal => r !== null));
      setStatus("");
      setLoading(false);
    }

    void loadDeals();
    return () => {
      active = false;
    };
  }, [supabase, refreshKey]);

  // ── Sync detail draft when selected deal changes ────────────────────────────

  useEffect(() => {
    if (!selectedDeal) {
      setDetailDraft(null);
      setDetailDirty(false);
      return;
    }
    setDetailDraft(draftFromDeal(selectedDeal));
    setDetailDirty(false);
  }, [selectedDeal]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const stageOk = stageFilter === "all" || deal.stage === stageFilter;
      const tagOk =
        tagFilters.length === 0 || tagFilters.some((t) => deal.tags.includes(t));
      return stageOk && tagOk;
    });
  }, [deals, stageFilter, tagFilters]);

  const stageCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const deal of deals) {
      map[deal.stage] = (map[deal.stage] || 0) + 1;
    }
    return map;
  }, [deals]);

  const tagCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const deal of deals) {
      for (const tag of deal.tags) {
        map[tag] = (map[tag] || 0) + 1;
      }
    }
    return map;
  }, [deals]);

  // ── Add Deal ─────────────────────────────────────────────────────────────────

  async function handleAddDeal() {
    const address = addDraft.property_address.trim();
    const sellerName = addDraft.seller_name.trim();

    if (!address) {
      setAddError("Property address is required.");
      return;
    }
    if (!sellerName) {
      setAddError("Seller name is required.");
      return;
    }

    setAddSaving(true);
    setAddError("");

    // 1. Create a lead record for the seller
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .insert({
        agent_id: agentId,
        owner_user_id: agentId,
        assignee_user_id: agentId,
        full_name: sellerName,
        first_source_method: "manual",
        latest_source_method: "manual",
        source: "manual",
        stage: "New",
        lead_temp: "Warm",
        time_last_updated: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (leadError || !leadData?.id) {
      setAddError(leadError?.message || "Could not create seller record.");
      setAddSaving(false);
      return;
    }

    // 2. Create the deal
    const askingPrice = parsePositiveDecimal(addDraft.asking_price);
    const offerPrice = parsePositiveDecimal(addDraft.offer_price);
    const now = new Date().toISOString();

    const { error: dealError } = await supabase.from("deals").insert({
      agent_id: agentId,
      lead_id: leadData.id,
      property_address: address,
      deal_type: "listing",
      price: askingPrice,
      offer_price: offerPrice,
      stage: addDraft.stage,
      tags: addDraft.tags,
      stage_entered_at: now,
      next_followup_date: addDraft.next_followup_date || null,
      notes: addDraft.notes.trim() || null,
    });

    setAddSaving(false);

    if (dealError) {
      setAddError(dealError.message);
      return;
    }

    setIsAddOpen(false);
    setAddDraft(EMPTY_ADD_DRAFT);
    setRefreshKey((k) => k + 1);
  }

  // ── Save Detail ──────────────────────────────────────────────────────────────

  async function handleSaveDetail() {
    if (!selectedDeal || !detailDraft) return;

    const address = detailDraft.property_address.trim();
    if (!address) {
      setStatus("Property address is required.");
      return;
    }

    setDetailSaving(true);
    const now = new Date().toISOString();
    const stageChanged = detailDraft.stage !== selectedDeal.stage;

    const { error } = await supabase
      .from("deals")
      .update({
        property_address: address,
        price: parsePositiveDecimal(detailDraft.asking_price),
        offer_price: parsePositiveDecimal(detailDraft.offer_price),
        stage: detailDraft.stage,
        tags: detailDraft.tags,
        stage_entered_at: stageChanged ? now : selectedDeal.stage_entered_at,
        next_followup_date: detailDraft.next_followup_date || null,
        notes: detailDraft.notes.trim() || null,
        updated_at: now,
      })
      .eq("id", selectedDeal.id);

    setDetailSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setDetailDirty(false);
    setStatus("Deal saved.");
    setRefreshKey((k) => k + 1);
  }

  function openDetail(deal: PipelineDeal) {
    setSelectedDeal(deal);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
    setSelectedDeal(null);
  }

  // ── Tag management ────────────────────────────────────────────────────────────

  async function saveAgentTags(tags: string[]) {
    if (!agentId) return;
    const newSettings = { ...agentSettings, pipeline_tags: tags };
    setAgentSettings(newSettings);
    await supabase
      .from("agents")
      .update({ settings: newSettings })
      .eq("id", agentId);
  }

  async function handleAddTag() {
    const tag = newTagInput.trim();
    if (!tag || agentTags.includes(tag)) {
      setNewTagInput("");
      return;
    }
    const next = [...agentTags, tag];
    setAgentTags(next);
    setNewTagInput("");
    await saveAgentTags(next);
  }

  async function handleDeleteTag(tag: string) {
    const next = agentTags.filter((t) => t !== tag);
    setAgentTags(next);
    // Also clear this tag from active filters
    setTagFilters((prev) => prev.filter((t) => t !== tag));
    await saveAgentTags(next);
  }

  // ── Loading / auth guard ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading pipeline...</div>
        </section>
      </main>
    );
  }

  if (!agentId) {
    return (
      <main className="crm-page">
        <section className="crm-card crm-section-card">
          <h1 className="crm-page-title">Pipeline</h1>
          <p className="crm-page-subtitle">Sign in to view your pipeline.</p>
        </section>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="crm-page crm-page-wide">
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>

        {/* ── Sidebar Filters ── */}
        <aside className="crm-card crm-section-card" style={{ position: "sticky", top: 16 }}>
          {/* Stage filter */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)", marginBottom: 8 }}>
              Stage
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                type="button"
                onClick={() => setStageFilter("all")}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: stageFilter === "all" ? 600 : 400,
                  background: stageFilter === "all" ? "var(--line)" : "transparent",
                  color: "var(--foreground)",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span>All stages</span>
                <span className="crm-chip" style={{ fontSize: 11 }}>{deals.length}</span>
              </button>

              {OFF_MARKET_STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: stageFilter === stage ? 600 : 400,
                    background: stageFilter === stage ? "var(--line)" : "transparent",
                    color: "var(--foreground)",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span>{offMarketStageLabel(stage)}</span>
                  <span className="crm-chip" style={{ fontSize: 11 }}>{stageCountMap[stage] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />

          {/* Tag filter */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)", marginBottom: 8 }}>
              Tags
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {agentTags.map((tag) => (
                <div
                  key={tag}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "4px 0",
                      flex: 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tagFilters.includes(tag)}
                      onChange={() => setTagFilters((prev) => toggleTag(prev, tag))}
                      style={{ accentColor: "var(--brand)", width: 14, height: 14, cursor: "pointer" }}
                    />
                    <span style={{ flex: 1 }}>{tag}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                      {tagCountMap[tag] || 0}
                    </span>
                  </label>
                  <button
                    type="button"
                    title="Remove tag"
                    onClick={() => void handleDeleteTag(tag)}
                    style={{
                      fontSize: 14,
                      lineHeight: 1,
                      color: "var(--ink-faint)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 4px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {tagFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTagFilters([])}
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "4px 0",
                  }}
                >
                  Clear filters
                </button>
              )}

              {/* Add new tag */}
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  type="text"
                  value={newTagInput}
                  placeholder="New tag..."
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddTag(); }}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: "4px 8px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  style={{
                    fontSize: 13,
                    padding: "4px 8px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--background)",
                    cursor: "pointer",
                    color: "var(--foreground)",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="crm-stack-12">
          {/* Header */}
          <section className="crm-card crm-section-card">
            <div>
              <p className="crm-page-kicker">Off-Market</p>
              <h1 className="crm-page-title">Pipeline</h1>
              <p className="crm-page-subtitle">
                Track every off-market opportunity from first contact to close. Filter by stage or
                tag to focus on what needs attention now.
              </p>
            </div>

            {/* Stats + action */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                <StatusBadge label={`${deals.filter((d) => d.stage !== "closed" && d.stage !== "dead").length} active`} tone="ok" />
                <StatusBadge label={`${deals.filter((d) => d.stage === "under_contract").length} under contract`} tone="stage-contract" />
                <StatusBadge label={`${deals.filter((d) => d.stage === "closed").length} closed`} tone="stage-closed" />
                {filteredDeals.length !== deals.length && (
                  <StatusBadge label={`${filteredDeals.length} shown`} tone="default" />
                )}
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => {
                  setAddDraft(EMPTY_ADD_DRAFT);
                  setAddError("");
                  setIsAddOpen(true);
                }}
              >
                Add New Deal
              </button>
            </div>
          </section>

          {status && (
            <section className="crm-card crm-section-card">
              <div style={{ fontSize: 13 }}>{status}</div>
            </section>
          )}

          {/* Table */}
          <section className="crm-card crm-section-card">
            {filteredDeals.length === 0 ? (
              <EmptyState
                title={deals.length === 0 ? "No deals yet" : "No deals match these filters"}
                body={
                  deals.length === 0
                    ? "Add your first off-market deal using the button above."
                    : "Clear a filter or select a different stage to see more deals."
                }
              />
            ) : (
              <div className="crm-table-wrap crm-lead-table-scroll">
                <table className="crm-data-table">
                  <thead>
                    <tr>
                      <th>Property Address</th>
                      <th>Seller Name</th>
                      <th>Source</th>
                      <th>Asking Price</th>
                      <th>Offer Price</th>
                      <th>Stage</th>
                      <th>Days in Stage</th>
                      <th>Next Follow-up</th>
                      <th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((deal) => (
                      <tr
                        key={deal.id}
                        onClick={() => openDetail(deal)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 600, maxWidth: 220 }}>
                          {deal.property_address || "—"}
                        </td>
                        <td>{deal.seller_name || "—"}</td>
                        <td>
                          {deal.seller_source ? (
                            <StatusBadge
                              label={sourceChannelLabel(deal.seller_source)}
                              tone={sourceChannelTone(deal.seller_source)}
                            />
                          ) : "—"}
                        </td>
                        <td>{priceDisplay(deal.price)}</td>
                        <td>{priceDisplay(deal.offer_price)}</td>
                        <td>
                          <StatusBadge
                            label={pipelineStageLabel(deal.stage)}
                            tone={pipelineStageTone(deal.stage)}
                          />
                        </td>
                        <td>{daysInStage(deal.stage_entered_at, deal.updated_at)}d</td>
                        <td>{dateDisplay(deal.next_followup_date)}</td>
                        <td className="crm-truncate-cell" style={{ maxWidth: 160 }}>
                          {deal.tags.length > 0 ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {deal.tags.map((tag) => (
                                <span key={tag} className="crm-chip" style={{ fontSize: 11 }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Add New Deal Modal ── */}
      {isAddOpen && (
        <div
          className="crm-modal-backdrop"
          onClick={() => {
            if (!addSaving) setIsAddOpen(false);
          }}
        >
          <section
            className="crm-card crm-deal-detail-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Add New Deal</h2>
                <p className="crm-section-subtitle" style={{ marginTop: 4 }}>
                  Creates a seller record and adds the deal to your pipeline.
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={() => setIsAddOpen(false)}
                disabled={addSaving}
              >
                Cancel
              </button>
            </div>

            <div className="crm-two-column-form">
              <label className="crm-filter-field">
                <span>Property Address *</span>
                <input
                  value={addDraft.property_address}
                  placeholder="123 Main St, Nashville TN"
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, property_address: e.target.value }))
                  }
                />
              </label>

              <label className="crm-filter-field">
                <span>Seller Name *</span>
                <input
                  value={addDraft.seller_name}
                  placeholder="John Smith"
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, seller_name: e.target.value }))
                  }
                />
              </label>

              <label className="crm-filter-field">
                <span>Asking Price</span>
                <input
                  value={addDraft.asking_price}
                  placeholder="350000"
                  inputMode="decimal"
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, asking_price: e.target.value }))
                  }
                />
              </label>

              <label className="crm-filter-field">
                <span>Offer Price</span>
                <input
                  value={addDraft.offer_price}
                  placeholder="320000"
                  inputMode="decimal"
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, offer_price: e.target.value }))
                  }
                />
              </label>

              <label className="crm-filter-field">
                <span>Stage</span>
                <select
                  value={addDraft.stage}
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      stage: normalizeOffMarketStage(e.target.value),
                    }))
                  }
                >
                  {OFF_MARKET_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {offMarketStageLabel(stage)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-filter-field">
                <span>Next Follow-up Date</span>
                <input
                  type="date"
                  value={addDraft.next_followup_date}
                  disabled={addSaving}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, next_followup_date: e.target.value }))
                  }
                />
              </label>
            </div>

            {/* Tags */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--ink-muted)" }}>
                Tags
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {agentTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={addSaving}
                    onClick={() =>
                      setAddDraft((prev) => ({ ...prev, tags: toggleTag(prev.tags, tag) }))
                    }
                    className={addDraft.tags.includes(tag) ? "crm-chip crm-chip-ok" : "crm-chip"}
                    style={{ cursor: "pointer", border: "none" }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <label className="crm-filter-field">
              <span>Notes</span>
              <textarea
                rows={3}
                value={addDraft.notes}
                disabled={addSaving}
                placeholder="Any context about the property or seller..."
                onChange={(e) => setAddDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>

            {addError && (
              <div className="crm-auth-feedback crm-auth-feedback-error" role="alert">
                {addError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setIsAddOpen(false)}
                disabled={addSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void handleAddDeal()}
                disabled={addSaving}
              >
                {addSaving ? "Adding deal..." : "Add Deal"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Deal Detail Modal ── */}
      {isDetailOpen && selectedDeal && detailDraft && (
        <div className="crm-modal-backdrop" onClick={closeDetail}>
          <section
            className="crm-card crm-deal-detail-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="crm-section-head">
              <div>
                <h2 className="crm-section-title">Deal Detail</h2>
                <p className="crm-section-subtitle" style={{ marginTop: 4 }}>
                  {selectedDeal.seller_name || "Unknown seller"} ·{" "}
                  <StatusBadge
                    label={pipelineStageLabel(selectedDeal.stage)}
                    tone={pipelineStageTone(selectedDeal.stage)}
                  />
                </p>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "6px 8px", fontSize: 12 }}
                onClick={closeDetail}
              >
                Close
              </button>
            </div>

            <div className="crm-two-column-form">
              <label className="crm-filter-field">
                <span>Property Address</span>
                <input
                  value={detailDraft.property_address}
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, property_address: e.target.value } : prev
                    );
                    setDetailDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Seller Name</span>
                <input value={selectedDeal.seller_name || "—"} disabled readOnly />
              </label>

              <label className="crm-filter-field">
                <span>Phone</span>
                {selectedDeal.seller_phone ? (
                  <a
                    href={`tel:${selectedDeal.seller_phone}`}
                    style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", padding: "6px 0", display: "block" }}
                  >
                    {selectedDeal.seller_phone}
                  </a>
                ) : (
                  <input value="—" disabled readOnly />
                )}
              </label>

              <label className="crm-filter-field">
                <span>Email</span>
                {selectedDeal.seller_email ? (
                  <a
                    href={`mailto:${selectedDeal.seller_email}`}
                    style={{ fontSize: 14, color: "var(--brand)", textDecoration: "none", padding: "6px 0", display: "block" }}
                  >
                    {selectedDeal.seller_email}
                  </a>
                ) : (
                  <input value="—" disabled readOnly />
                )}
              </label>

              <label className="crm-filter-field">
                <span>Asking Price</span>
                <input
                  value={detailDraft.asking_price}
                  inputMode="decimal"
                  placeholder="350000"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, asking_price: e.target.value } : prev
                    );
                    setDetailDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Offer Price</span>
                <input
                  value={detailDraft.offer_price}
                  inputMode="decimal"
                  placeholder="320000"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, offer_price: e.target.value } : prev
                    );
                    setDetailDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Stage</span>
                <select
                  value={detailDraft.stage}
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev
                        ? { ...prev, stage: normalizeOffMarketStage(e.target.value) }
                        : prev
                    );
                    setDetailDirty(true);
                  }}
                >
                  {OFF_MARKET_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {offMarketStageLabel(stage)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-filter-field">
                <span>Next Follow-up Date</span>
                <input
                  type="date"
                  value={detailDraft.next_followup_date}
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, next_followup_date: e.target.value } : prev
                    );
                    setDetailDirty(true);
                  }}
                />
              </label>
            </div>

            {/* Tags */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--ink-muted)" }}>
                Tags
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {agentTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={detailSaving}
                    onClick={() => {
                      setDetailDraft((prev) =>
                        prev ? { ...prev, tags: toggleTag(prev.tags, tag) } : prev
                      );
                      setDetailDirty(true);
                    }}
                    className={
                      detailDraft.tags.includes(tag) ? "crm-chip crm-chip-ok" : "crm-chip"
                    }
                    style={{ cursor: "pointer", border: "none" }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <label className="crm-filter-field">
              <span>Notes</span>
              <textarea
                rows={4}
                value={detailDraft.notes}
                disabled={detailSaving}
                onChange={(e) => {
                  setDetailDraft((prev) =>
                    prev ? { ...prev, notes: e.target.value } : prev
                  );
                  setDetailDirty(true);
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                {daysInStage(selectedDeal.stage_entered_at, selectedDeal.updated_at)}d in stage
                {selectedDeal.created_at
                  ? ` · Added ${new Date(selectedDeal.created_at).toLocaleDateString()}`
                  : ""}
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => void handleSaveDetail()}
                disabled={!detailDirty || detailSaving}
              >
                {detailSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
