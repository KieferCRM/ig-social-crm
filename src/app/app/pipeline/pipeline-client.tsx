"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { parsePositiveDecimal, formatCurrency, asInputNumber, asInputDate } from "@/lib/deal-metrics";
import {
  PIPELINE_TAGS,
  normalizeOffMarketStage,
  pipelineStageLabel,
  pipelineStageTone,
  type OffMarketStage,
} from "@/lib/pipeline";
import { DEFAULT_PIPELINE_STAGES, type PipelineStageConfig } from "@/lib/pipeline-settings";
import { sourceChannelLabel } from "@/lib/inbound";
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
  assignment_price: number | null;
  acreage: number | null;
  mls_number: string | null;
  parcel_id: string | null;
  stage: string;
  tags: string[];
  stage_entered_at: string | null;
  next_followup_date: string | null;
  expected_close_date: string | null;
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
  assignment_price: string;
  acreage: string;
  mls_number: string;
  parcel_id: string;
  stage: OffMarketStage;
  tags: string[];
  next_followup_date: string;
  expected_close_date: string;
  notes: string;
};

// ─── Tag system ──────────────────────────────────────────────────────────────

type AgentTag = { name: string; color: string };

const TAG_COLORS = [
  "#6b7280", // gray (default)
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#16a34a", // green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // purple
  "#db2777", // pink
];

function tagColor(name: string, tags: AgentTag[]): string {
  return tags.find((t) => t.name === name)?.color ?? "#6b7280";
}

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

function hoursInStage(stageEnteredAt: string | null, updatedAt: string | null): number {
  const ref = stageEnteredAt || updatedAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, (Date.now() - ts) / 3_600_000);
}

function isStaleForStage(stage: string, stageEnteredAt: string | null, updatedAt: string | null): boolean {
  if (stage === "offer_sent" || stage === "negotiating") {
    return hoursInStage(stageEnteredAt, updatedAt) > 48;
  }
  return daysInStage(stageEnteredAt, updatedAt) > 14;
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

function isOverdue(value: string | null): boolean {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
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
  assignment_price?: unknown;
  acreage?: unknown;
  mls_number?: unknown;
  parcel_id?: unknown;
  stage?: unknown;
  tags?: unknown;
  stage_entered_at?: unknown;
  next_followup_date?: unknown;
  expected_close_date?: unknown;
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
    assignment_price: typeof row.assignment_price === "number" ? row.assignment_price : null,
    acreage: typeof row.acreage === "number" ? row.acreage : null,
    mls_number: typeof row.mls_number === "string" ? row.mls_number : null,
    parcel_id: typeof row.parcel_id === "string" ? row.parcel_id : null,
    stage: typeof row.stage === "string" ? row.stage : "prospecting",
    tags: Array.isArray(row.tags)
      ? (row.tags as unknown[]).filter((t): t is string => typeof t === "string")
      : [],
    stage_entered_at: typeof row.stage_entered_at === "string" ? row.stage_entered_at : null,
    next_followup_date:
      typeof row.next_followup_date === "string" ? row.next_followup_date : null,
    expected_close_date:
      typeof row.expected_close_date === "string" ? row.expected_close_date : null,
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
    assignment_price: asInputNumber(deal.assignment_price),
    acreage: deal.acreage != null ? String(deal.acreage) : "",
    mls_number: deal.mls_number ?? "",
    parcel_id: deal.parcel_id ?? "",
    stage: normalizeOffMarketStage(deal.stage),
    tags: deal.tags.slice(),
    next_followup_date: asInputDate(deal.next_followup_date),
    expected_close_date: asInputDate(deal.expected_close_date),
    notes: deal.notes || "",
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PipelineClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const searchParams = useSearchParams();

  const [stageConfig, setStageConfig] = useState<PipelineStageConfig[]>(DEFAULT_PIPELINE_STAGES);
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("pipeline_view") as "list" | "kanban") ?? "list";
    }
    return "list";
  });

  const draggedDealIdRef = useRef<string | null>(null);

  // Custom tags — loaded from agents.settings.pipeline_tags
  const [agentTags, setAgentTags] = useState<AgentTag[]>(
    [...PIPELINE_TAGS].map((t) => ({ name: t, color: "#6b7280" }))
  );
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown>>({});
  const [newTagInput, setNewTagInput] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]!);
  const [tagSearch, setTagSearch] = useState("");
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const tagDragIdxRef = useRef<number | null>(null);
  const [editingTagColor, setEditingTagColor] = useState<string | null>(null); // tag name being recolored

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
  const [dealAppts, setDealAppts] = useState<Array<{ id: string; title: string; scheduled_at: string; appointment_type: string; status: string }>>([]);
  const [dealDocs, setDealDocs] = useState<Array<{ id: string; file_name: string; status: string; file_type: string; signed_url?: string | null }>>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFileType, setDocFileType] = useState("agreement");
  const [docStatus, setDocStatus] = useState("draft");

  // ── Load deals ──────────────────────────────────────────────────────────────

  // Load custom stage config
  useEffect(() => {
    void fetch("/api/settings/pipeline-stages")
      .then((r) => r.json())
      .then((d: { stages?: PipelineStageConfig[] }) => {
        if (d.stages?.length) setStageConfig(d.stages);
      })
      .catch(() => {/* keep defaults */});
  }, []);

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
          const parsed = (savedTags as unknown[]).map((t) => {
            if (typeof t === "string") return { name: t, color: "#6b7280" };
            if (t && typeof t === "object" && "name" in t) return t as AgentTag;
            return null;
          }).filter((t): t is AgentTag => t !== null);
          if (parsed.length > 0) setAgentTags(parsed);
        }
      }

      const { data, error } = await supabase
        .from("deals")
        .select(
          "id,lead_id,property_address,price,offer_price,assignment_price,acreage,mls_number,parcel_id,stage,tags,stage_entered_at,next_followup_date,expected_close_date,notes,updated_at,created_at,lead:leads(full_name,canonical_phone,canonical_email,source)"
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

  // ── Auto-open deal from ?deal= URL param (e.g. linked from Drop inbox) ──────

  useEffect(() => {
    if (loading || deals.length === 0) return;
    const dealId = searchParams.get("deal");
    if (!dealId) return;
    const match = deals.find((d) => d.id === dealId);
    if (match) openDetail(match);
    // only run once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Sync detail draft + appointments when selected deal changes ─────────────

  useEffect(() => {
    if (!selectedDeal) {
      setDetailDraft(null);
      setDetailDirty(false);
      setDealAppts([]);
      setDealDocs([]);
      setShowDocUpload(false);
      setDocFile(null);
      return;
    }
    setDetailDraft(draftFromDeal(selectedDeal));
    setDetailDirty(false);

    // Load appointments linked to this deal
    void supabase
      .from("appointments")
      .select("id,title,scheduled_at,appointment_type,status")
      .eq("deal_id", selectedDeal.id)
      .neq("status", "cancelled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5)
      .then(({ data }) => setDealAppts(data ?? []));

    // Load documents linked to this deal
    const dealId = selectedDeal.id;
    void fetch("/api/documents", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { documents?: Array<{ id: string; file_name: string; status: string; file_type: string; deal_id?: string; signed_url?: string | null }> }) => {
        const docs = (d.documents ?? []).filter((doc) => doc.deal_id === dealId);
        setDealDocs(docs);
      })
      .catch(() => {/* non-critical */});
  }, [selectedDeal, supabase]);

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
        assignment_price: parsePositiveDecimal(detailDraft.assignment_price),
        acreage: detailDraft.acreage ? parsePositiveDecimal(detailDraft.acreage) : null,
        mls_number: detailDraft.mls_number.trim() || null,
        parcel_id: detailDraft.parcel_id.trim() || null,
        stage: detailDraft.stage,
        tags: detailDraft.tags,
        stage_entered_at: stageChanged ? now : selectedDeal.stage_entered_at,
        next_followup_date: detailDraft.next_followup_date || null,
        expected_close_date: detailDraft.expected_close_date || null,
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

  async function handleDeleteDeal() {
    if (!selectedDeal) return;
    if (!window.confirm("Delete this deal? This cannot be undone.")) return;
    const { error } = await supabase.from("deals").delete().eq("id", selectedDeal.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    closeDetail();
    setRefreshKey((k) => k + 1);
  }

  // ── Document upload ───────────────────────────────────────────────────────────

  async function handleDocUpload() {
    if (!docFile || !selectedDeal) return;
    setDocUploading(true);
    const form = new FormData();
    form.append("file", docFile);
    form.append("deal_id", selectedDeal.id);
    form.append("file_type", docFileType);
    form.append("status", docStatus);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; document?: { id: string; file_name: string; status: string; file_type: string; signed_url?: string | null } };
      if (data.ok && data.document) {
        setDealDocs((prev) => [...prev, data.document!]);
        setDocFile(null);
        setShowDocUpload(false);
        setDocFileType("agreement");
        setDocStatus("draft");
      }
    } catch {/* non-critical */}
    setDocUploading(false);
  }

  // ── Tag management ────────────────────────────────────────────────────────────

  async function saveAgentTags(tags: AgentTag[]) {
    if (!agentId) return;
    const newSettings = { ...agentSettings, pipeline_tags: tags };
    setAgentSettings(newSettings);
    await supabase
      .from("agents")
      .update({ settings: newSettings })
      .eq("id", agentId);
  }

  async function handleAddTag() {
    const name = newTagInput.trim();
    if (!name || agentTags.some((t) => t.name === name)) {
      setNewTagInput("");
      return;
    }
    const next = [...agentTags, { name, color: newTagColor }];
    setAgentTags(next);
    setNewTagInput("");
    await saveAgentTags(next);
  }

  async function handleDeleteTag(tagName: string) {
    const next = agentTags.filter((t) => t.name !== tagName);
    setAgentTags(next);
    setTagFilters((prev) => prev.filter((t) => t !== tagName));
    await saveAgentTags(next);
  }

  async function handleTagDrop(targetIdx: number) {
    const fromIdx = tagDragIdxRef.current;
    if (fromIdx === null || fromIdx === targetIdx) { tagDragIdxRef.current = null; return; }
    const next = [...agentTags];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(targetIdx, 0, moved!);
    setAgentTags(next);
    tagDragIdxRef.current = null;
    await saveAgentTags(next);
  }

  async function handleRecolorTag(tagName: string, color: string) {
    const next = agentTags.map((t) => t.name === tagName ? { ...t, color } : t);
    setAgentTags(next);
    setEditingTagColor(null);
    await saveAgentTags(next);
  }

  // ── Drag-and-drop stage update ────────────────────────────────────────────────

  async function handleDrop(targetStage: OffMarketStage, dealId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;

    const now = new Date().toISOString();
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage: targetStage, stage_entered_at: now } : d
      )
    );

    const { error } = await supabase
      .from("deals")
      .update({ stage: targetStage, stage_entered_at: now, updated_at: now })
      .eq("id", dealId);

    if (error) {
      setRefreshKey((k) => k + 1);
      setStatus("Could not move deal. Please try again.");
    }
  }

  function toggleView(mode: "list" | "kanban") {
    setViewMode(mode);
    localStorage.setItem("pipeline_view", mode);
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

              {stageConfig.map(({ value: stage, label }) => (
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
                  <span>{label}</span>
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

            {/* Search */}
            {agentTags.length > 4 && (
              <input
                type="text"
                value={tagSearch}
                placeholder="Search tags..."
                onChange={(e) => setTagSearch(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  background: "var(--background)",
                  color: "var(--foreground)",
                  marginBottom: 6,
                }}
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(() => {
                const filtered = tagSearch
                  ? agentTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                  : agentTags;
                const visible = tagsExpanded || tagSearch ? filtered : filtered.slice(0, 6);
                const hidden = tagSearch ? 0 : Math.max(0, filtered.length - 6);
                return (
                  <>
                    {visible.map((tag, idx) => (
                      <div key={tag.name}>
                        <div
                          draggable
                          onDragStart={() => { tagDragIdxRef.current = idx; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => void handleTagDrop(idx)}
                          style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 6, padding: "2px 0" }}
                        >
                          {/* Drag handle */}
                          <span style={{ color: "var(--ink-faint)", fontSize: 11, cursor: "grab", flexShrink: 0, lineHeight: 1, paddingTop: 1 }} title="Drag to reorder">⠿</span>
                          {/* Color dot — click to recolor */}
                          <span
                            title="Change color"
                            onClick={(e) => { e.stopPropagation(); setEditingTagColor(editingTagColor === tag.name ? null : tag.name); }}
                            style={{ width: 10, height: 10, borderRadius: "50%", background: tag.color, flexShrink: 0, display: "inline-block", cursor: "pointer", outline: editingTagColor === tag.name ? "2px solid var(--foreground)" : "none", outlineOffset: 1 }}
                          />
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, flex: 1, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={tagFilters.includes(tag.name)}
                              onChange={() => setTagFilters((prev) => toggleTag(prev, tag.name))}
                              style={{ accentColor: "var(--brand)", width: 13, height: 13, cursor: "pointer", flexShrink: 0 }}
                            />
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tag.name}</span>
                            <span style={{ fontSize: 11, color: "var(--ink-muted)", flexShrink: 0 }}>{tagCountMap[tag.name] || 0}</span>
                          </label>
                          <button
                            type="button"
                            title="Remove tag"
                            onClick={() => void handleDeleteTag(tag.name)}
                            style={{ fontSize: 14, lineHeight: 1, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: "2px 2px", flexShrink: 0 }}
                          >×</button>
                        </div>
                        {/* Inline color picker */}
                        {editingTagColor === tag.name && (
                          <div style={{ display: "flex", gap: 5, paddingLeft: 20, paddingBottom: 4, flexWrap: "wrap" }}>
                            {TAG_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() => void handleRecolorTag(tag.name, c)}
                                style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: tag.color === c ? "2px solid var(--foreground)" : "2px solid transparent", cursor: "pointer", padding: 0 }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {!tagSearch && hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagsExpanded((v) => !v)}
                        style={{ fontSize: 12, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0", marginTop: 2 }}
                      >
                        {tagsExpanded ? "Show less" : `Show ${hidden} more`}
                      </button>
                    )}
                  </>
                );
              })()}

              {tagFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTagFilters([])}
                  style={{ fontSize: 12, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" }}
                >
                  Clear filters
                </button>
              )}

              {/* Add new tag */}
              <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                {/* Color swatches */}
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", flexShrink: 0 }}>
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setNewTagColor(c)}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: c,
                        border: newTagColor === c ? "2px solid var(--foreground)" : "2px solid transparent",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="text"
                  value={newTagInput}
                  placeholder="New tag..."
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddTag(); }}
                  style={{ flex: 1, fontSize: 12, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)" }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddTag()}
                  style={{ fontSize: 13, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--background)", cursor: "pointer", color: "var(--foreground)" }}
                >+</button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="crm-stack-12">
          {/* Header */}
          <section className="crm-card crm-section-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              {/* Left: title + stats */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p className="crm-page-kicker" style={{ marginBottom: 2 }}>Off-Market</p>
                  <h1 className="crm-page-title" style={{ margin: 0 }}>Pipeline</h1>
                </div>
                <div style={{ width: 1, height: 32, background: "var(--line)", flexShrink: 0 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <StatusBadge label={`${deals.filter((d) => d.stage !== "closed" && d.stage !== "dead").length} active`} tone="ok" />
                  <StatusBadge label={`${deals.filter((d) => d.stage === "under_contract").length} under contract`} tone="stage-contract" />
                  <StatusBadge label={`${deals.filter((d) => d.stage === "closed").length} closed`} tone="stage-closed" />
                  {filteredDeals.length !== deals.length && (
                    <StatusBadge label={`${filteredDeals.length} shown`} tone="default" />
                  )}
                </div>
              </div>

              {/* Right: view toggle + primary action */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", border: "2px solid var(--ink-primary)", borderRadius: 8, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => toggleView("list")}
                    style={{
                      padding: "8px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      background: viewMode === "list" ? "var(--ink-primary)" : "transparent",
                      color: viewMode === "list" ? "#fff" : "var(--ink-primary)",
                      border: "none",
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                    }}
                  >
                    ☰ List
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleView("kanban")}
                    style={{
                      padding: "8px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      background: viewMode === "kanban" ? "var(--ink-primary)" : "transparent",
                      color: viewMode === "kanban" ? "#fff" : "var(--ink-primary)",
                      border: "none",
                      cursor: "pointer",
                      letterSpacing: "0.01em",
                    }}
                  >
                    ⊞ Kanban
                  </button>
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
                  + Add Deal
                </button>
              </div>
            </div>
          </section>

          {status && (
            <section className="crm-card crm-section-card">
              <div style={{ fontSize: 13 }}>{status}</div>
            </section>
          )}

          {/* Table / Kanban */}
          {viewMode === "list" ? (
            <section className="crm-card">
              {filteredDeals.length === 0 ? (
                <div style={{ padding: "24px 20px" }}>
                  <EmptyState
                    title={deals.length === 0 ? "No deals yet" : "No deals match these filters"}
                    body={
                      deals.length === 0
                        ? "Add your first off-market deal using the button above."
                        : "Clear a filter or select a different stage to see more deals."
                    }
                  />
                </div>
              ) : (
                <div className="crm-table-wrap">
                  <table className="crm-data-table">
                    <thead>
                      <tr>
                        <th>Property Address</th>
                        <th>Seller</th>
                        <th>Offer Price</th>
                        <th>Source</th>
                        <th>Stage</th>
                        <th>Time in Stage</th>
                        <th>Next Follow-up</th>
                        <th>Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map((deal) => {
                        const overdue = isOverdue(deal.next_followup_date);
                        const stale = isStaleForStage(deal.stage, deal.stage_entered_at, deal.updated_at);
                        const isOfferStage = deal.stage === "offer_sent" || deal.stage === "negotiating";
                        const timeLabel = isOfferStage
                          ? `${Math.floor(hoursInStage(deal.stage_entered_at, deal.updated_at))}h`
                          : `${daysInStage(deal.stage_entered_at, deal.updated_at)}d`;
                        return (
                          <tr
                            key={deal.id}
                            onClick={() => openDetail(deal)}
                            style={{ cursor: "pointer" }}
                          >
                            <td style={{ fontWeight: 600 }}>
                              {deal.property_address || "—"}
                            </td>
                            <td>
                              <div>{deal.seller_name || "—"}</div>
                              {deal.seller_phone && (
                                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>{deal.seller_phone}</div>
                              )}
                            </td>
                            <td>{priceDisplay(deal.offer_price ?? deal.price)}</td>
                            <td>
                              {deal.seller_source ? (
                                <span className="crm-chip" style={{ fontSize: 11 }}>
                                  {sourceChannelLabel(deal.seller_source)}
                                </span>
                              ) : "—"}
                            </td>
                            <td>
                              <StatusBadge
                                label={pipelineStageLabel(deal.stage)}
                                tone={pipelineStageTone(deal.stage)}
                              />
                            </td>
                            <td style={{ color: stale ? "#dc2626" : "var(--ink-muted)", fontWeight: stale ? 600 : undefined }}>
                              {timeLabel}
                              {stale && <span style={{ marginLeft: 4 }}>⚠</span>}
                            </td>
                            <td style={{ color: overdue ? "#dc2626" : undefined, fontWeight: overdue ? 600 : undefined }}>
                              {overdue && <span style={{ marginRight: 4 }}>⚠</span>}
                              {dateDisplay(deal.next_followup_date)}
                            </td>
                            <td>
                              {deal.tags.length > 0 ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  {deal.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="crm-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tagColor(tag, agentTags), flexShrink: 0, display: "inline-block" }} />
                                      {tag}
                                    </span>
                                  ))}
                                  {deal.tags.length > 2 && (
                                    <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                                      +{deal.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            /* ── Kanban board ── */
            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                alignItems: "flex-start",
                paddingBottom: 8,
              }}
            >
              {stageConfig.map(({ value: stage, label }) => {
                const stageDeals = filteredDeals.filter((d) => d.stage === stage);
                return (
                  <div
                    key={stage}
                    style={{ minWidth: 230, flex: "0 0 230px" }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) void handleDrop(stage, id);
                    }}
                  >
                    {/* Column header */}
                    <div
                      className="crm-card"
                      style={{
                        padding: "8px 12px",
                        marginBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {label}
                      </span>
                      <span className="crm-chip" style={{ fontSize: 11 }}>
                        {stageDeals.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
                      {stageDeals.map((deal) => {
                        const stale = isStaleForStage(deal.stage, deal.stage_entered_at, deal.updated_at);
                        const isOfferStage = deal.stage === "offer_sent" || deal.stage === "negotiating";
                        const timeLabel = isOfferStage
                          ? `${Math.floor(hoursInStage(deal.stage_entered_at, deal.updated_at))}h`
                          : `${daysInStage(deal.stage_entered_at, deal.updated_at)}d`;
                        return (
                          <div
                            key={deal.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", deal.id);
                              draggedDealIdRef.current = deal.id;
                            }}
                            onClick={() => openDetail(deal)}
                            className="crm-card"
                            style={{
                              padding: "10px 12px",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              userSelect: "none",
                              borderLeft: stale ? "3px solid #dc2626" : undefined,
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                              {deal.property_address || "No address"}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                              {deal.seller_name || "—"}
                            </div>
                            {deal.seller_phone && (
                              <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                                {deal.seller_phone}
                              </div>
                            )}
                            {(deal.offer_price ?? deal.price) != null && (
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
                                {priceDisplay(deal.offer_price ?? deal.price)}
                              </div>
                            )}
                            {deal.seller_source && (
                              <div>
                                <span className="crm-chip" style={{ fontSize: 10 }}>
                                  {sourceChannelLabel(deal.seller_source)}
                                </span>
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: stale ? "#dc2626" : "var(--ink-muted)", fontWeight: stale ? 600 : undefined }}>
                              <span>{timeLabel} in stage{stale ? " ⚠" : ""}</span>
                              {deal.next_followup_date && (
                                <span style={{ color: "var(--ink-muted)", fontWeight: "normal" }}>↑ {dateDisplay(deal.next_followup_date)}</span>
                              )}
                            </div>
                            {deal.tags.length > 0 && (
                              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                {deal.tags.map((tag) => (
                                  <span key={tag} className="crm-chip" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: tagColor(tag, agentTags), flexShrink: 0, display: "inline-block" }} />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                <span>Est. Asking Price Range</span>
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
                  {stageConfig.map(({ value: stage, label }) => (
                    <option key={stage} value={stage}>
                      {label}
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
                    key={tag.name}
                    type="button"
                    disabled={addSaving}
                    onClick={() =>
                      setAddDraft((prev) => ({ ...prev, tags: toggleTag(prev.tags, tag.name) }))
                    }
                    className={addDraft.tags.includes(tag.name) ? "crm-chip crm-chip-ok" : "crm-chip"}
                    style={{ cursor: "pointer", border: "none", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color, flexShrink: 0, display: "inline-block" }} />
                    {tag.name}
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
                <span>A-B Contract Price</span>
                <input
                  value={detailDraft.offer_price}
                  inputMode="decimal"
                  placeholder="200000"
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
                <span>B-C Contract Price</span>
                <input
                  value={detailDraft.assignment_price}
                  inputMode="decimal"
                  placeholder="250000"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, assignment_price: e.target.value } : prev
                    );
                    setDetailDirty(true);
                  }}
                />
              </label>

              {/* Spread — read-only calculated field */}
              {(() => {
                const ab = parsePositiveDecimal(detailDraft.offer_price);
                const bc = parsePositiveDecimal(detailDraft.assignment_price);
                if (ab === null || bc === null) return null;
                const spread = bc - ab;
                return (
                  <label className="crm-filter-field">
                    <span>Commission / Fee</span>
                    <div style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: spread >= 0 ? "#f0fdf4" : "#fef2f2",
                      color: spread >= 0 ? "#15803d" : "#dc2626",
                      fontWeight: 700,
                      fontSize: 14,
                    }}>
                      {spread >= 0 ? "+" : ""}{formatCurrency(spread)}
                    </div>
                  </label>
                );
              })()}

              <label className="crm-filter-field">
                <span>Acreage</span>
                <input
                  value={detailDraft.acreage}
                  inputMode="decimal"
                  placeholder="36.5"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) => prev ? { ...prev, acreage: e.target.value } : prev);
                    setDetailDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>MLS Number</span>
                <input
                  value={detailDraft.mls_number}
                  placeholder="MLS-123456"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) => prev ? { ...prev, mls_number: e.target.value } : prev);
                    setDetailDirty(true);
                  }}
                />
              </label>

              <label className="crm-filter-field">
                <span>Parcel ID</span>
                <input
                  value={detailDraft.parcel_id}
                  placeholder="123-456-789"
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) => prev ? { ...prev, parcel_id: e.target.value } : prev);
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
                  {stageConfig.map(({ value: stage, label }) => (
                    <option key={stage} value={stage}>
                      {label}
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

              <label className="crm-filter-field">
                <span>Target Close Date</span>
                <input
                  type="date"
                  value={detailDraft.expected_close_date}
                  disabled={detailSaving}
                  onChange={(e) => {
                    setDetailDraft((prev) =>
                      prev ? { ...prev, expected_close_date: e.target.value } : prev
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
                    key={tag.name}
                    type="button"
                    disabled={detailSaving}
                    onClick={() => {
                      setDetailDraft((prev) =>
                        prev ? { ...prev, tags: toggleTag(prev.tags, tag.name) } : prev
                      );
                      setDetailDirty(true);
                    }}
                    className={
                      detailDraft.tags.includes(tag.name) ? "crm-chip crm-chip-ok" : "crm-chip"
                    }
                    style={{ cursor: "pointer", border: "none", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color, flexShrink: 0, display: "inline-block" }} />
                    {tag.name}
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

            {/* Upcoming appointments for this deal */}
            {dealAppts.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Upcoming Appointments</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {dealAppts.map((appt) => (
                    <div key={appt.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-body)", background: "#eff6ff", borderRadius: 6, padding: "6px 10px" }}>
                      <span style={{ color: "#2563eb", fontWeight: 600 }}>
                        {new Date(appt.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" "}
                        {new Date(appt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.title}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "capitalize" }}>{appt.appointment_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Documents ({dealDocs.length})
                </div>
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setShowDocUpload((v) => !v)}
                >
                  {showDocUpload ? "Cancel" : "+ Add Document"}
                </button>
              </div>

              {showDocUpload && (
                <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="file"
                    style={{ fontSize: 13 }}
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={docFileType}
                      onChange={(e) => setDocFileType(e.target.value)}
                      style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                    >
                      <option value="agreement">Agreement</option>
                      <option value="ab_contract">A-B Contract</option>
                      <option value="bc_contract">B-C Contract</option>
                      <option value="tn_senate_bill">TN Senate Bill</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      value={docStatus}
                      onChange={(e) => setDocStatus(e.target.value)}
                      style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="signed">Signed</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    style={{ fontSize: 13, alignSelf: "flex-end" }}
                    disabled={!docFile || docUploading}
                    onClick={() => void handleDocUpload()}
                  >
                    {docUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              )}

              {dealDocs.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>No documents yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dealDocs.map((doc) => {
                    const statusColors: Record<string, { bg: string; color: string }> = {
                      draft:  { bg: "#f3f4f6", color: "#6b7280" },
                      sent:   { bg: "#dbeafe", color: "#1d4ed8" },
                      signed: { bg: "#dcfce7", color: "#15803d" },
                      final:  { bg: "#fef9c3", color: "#a16207" },
                    };
                    const sc = statusColors[doc.status] ?? statusColors.draft;
                    return (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.file_name}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: sc.bg, color: sc.color, flexShrink: 0 }}>
                          {doc.status.toUpperCase()}
                        </span>
                        {doc.signed_url && (
                          <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--brand)", flexShrink: 0 }}>
                            View
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
              <div className="crm-inline-actions" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  style={{ color: "var(--ink-muted)", fontSize: 13 }}
                  onClick={() => void handleDeleteDeal()}
                  disabled={detailSaving}
                >
                  Delete deal
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => void handleSaveDetail()}
                  disabled={!detailDirty || detailSaving}
                >
                  {detailSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
