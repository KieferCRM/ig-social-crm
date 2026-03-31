"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { parsePositiveDecimal, asInputDate } from "@/lib/deal-metrics";
import {
  BUYER_PIPELINE_STAGES,
  DEAL_BOARD_STAGES,
  DEAL_STAGE_VALUES,
  LISTING_PIPELINE_STAGES,
  dealStageLabel,
  dealStageTone,
  dealTypeLabel,
  getPipelineStages,
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

type AgentTag = { name: string; color: string };

const TAG_COLORS = [
  "#6b7280",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const DEFAULT_AGENT_TAGS: AgentTag[] = [
  { name: "First-Time Buyer", color: "#2563eb" },
  { name: "Pre-Approved", color: "#16a34a" },
  { name: "Cash Buyer", color: "#ca8a04" },
  { name: "Referral", color: "#7c3aed" },
  { name: "Relocation", color: "#0891b2" },
  { name: "Price Reduced", color: "#ea580c" },
  { name: "Multiple Offers", color: "#dc2626" },
  { name: "Expired Listing", color: "#6b7280" },
];

function tagColor(name: string, tags: AgentTag[]): string {
  return tags.find((t) => t.name === name)?.color ?? "#6b7280";
}

function toggleTag(current: string[], tag: string): string[] {
  return current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
}

type BuyerDetails = {
  preapproval_status?: string;
  preapproval_amount?: string;
  lender_name?: string;
  financing_type?: string;
  search_criteria?: string;
  price_range_min?: string;
  price_range_max?: string;
  move_in_timeline?: string;
  buyer_agreement_signed?: string;
  referral_source?: string;
};

type ListingDetails = {
  list_price?: string;
  original_list_price?: string;
  sale_price?: string;
  mls_number?: string;
  commission_rate?: string;
  listing_expiration_date?: string;
  seller_motivation?: string;
  showing_instructions?: string;
  concessions_offered?: string;
  earnest_money_amount?: string;
  referral_source?: string;
};

type DealDraft = {
  property_address: string;
  price: string;
  stage: DealStage;
  tags: string[];
  next_followup_date: string;
  expected_close_date: string;
  notes: string;
  buyerDetails?: BuyerDetails;
  listingDetails?: ListingDetails;
};

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
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
  tags?: unknown;
  stage_entered_at?: unknown;
  next_followup_date?: unknown;
  expected_close_date?: unknown;
  notes?: unknown;
  deal_details?: unknown;
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

function daysInStage(stageEnteredAt: string | null, updatedAt: string | null): number {
  const ref = stageEnteredAt || updatedAt;
  if (!ref) return 0;
  const ts = new Date(ref).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function isOverdue(value: string | null): boolean {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function draftFromDeal(deal: DealWithLead): DealDraft {
  const details = deal.deal_details ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    property_address: deal.property_address || "",
    price: typeof deal.price === "number" || typeof deal.price === "string" ? String(deal.price) : "",
    stage: deal.stage,
    tags: deal.tags.slice(),
    next_followup_date: asInputDate(deal.next_followup_date),
    expected_close_date: deal.expected_close_date?.slice(0, 10) || "",
    notes: deal.notes || "",
    buyerDetails: deal.deal_type === "buyer" ? {
      preapproval_status: str(details.preapproval_status),
      preapproval_amount: str(details.preapproval_amount),
      lender_name: str(details.lender_name),
      financing_type: str(details.financing_type),
      search_criteria: str(details.search_criteria),
      price_range_min: str(details.price_range_min),
      price_range_max: str(details.price_range_max),
      move_in_timeline: str(details.move_in_timeline),
      buyer_agreement_signed: str(details.buyer_agreement_signed),
      referral_source: str(details.referral_source),
    } : undefined,
    listingDetails: deal.deal_type === "listing" ? {
      list_price: str(details.list_price),
      original_list_price: str(details.original_list_price),
      sale_price: str(details.sale_price),
      mls_number: str(details.mls_number),
      commission_rate: str(details.commission_rate),
      listing_expiration_date: str(details.listing_expiration_date),
      seller_motivation: str(details.seller_motivation),
      showing_instructions: str(details.showing_instructions),
      concessions_offered: str(details.concessions_offered),
      earnest_money_amount: str(details.earnest_money_amount),
      referral_source: str(details.referral_source),
    } : undefined,
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
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
    stage_entered_at: typeof row.stage_entered_at === "string" ? row.stage_entered_at : null,
    next_followup_date: typeof row.next_followup_date === "string" ? row.next_followup_date : null,
    expected_close_date:
      typeof row.expected_close_date === "string" ? row.expected_close_date : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    deal_details: row.deal_details && typeof row.deal_details === "object" ? row.deal_details as Record<string, unknown> : null,
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
  const [status, setStatus] = useState(""); // kept for load errors only
  const [agentId, setAgentId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [draft, setDraft] = useState<DealDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [tempFilter, setTempFilter] = useState<TempFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "buyer" | "listing">("all");
  const [pipelineView, setPipelineView] = useState<"all" | "buyer" | "listing">("all");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const isOffMarketAccount = accountType === "off_market_agent";

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [checklistSeeding, setChecklistSeeding] = useState(false);

  // Appointments + documents on deal detail
  const [dealAppts, setDealAppts] = useState<Array<{ id: string; title: string; scheduled_at: string; appointment_type: string; status: string }>>([]);
  const [dealDocs, setDealDocs] = useState<Array<{ id: string; file_name: string; status: string; file_type: string; signed_url?: string | null }>>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFileType, setDocFileType] = useState("agreement");
  const [docStatus, setDocStatus] = useState("draft");

  // Add Deal modal
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descFeatures, setDescFeatures] = useState("");
  const [generatedDesc, setGeneratedDesc] = useState("");
  const [showDescGenerator, setShowDescGenerator] = useState(false);

  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealName, setAddDealName] = useState("");
  const [addDealType, setAddDealType] = useState<"buyer" | "listing">("buyer");
  const [addDealAddress, setAddDealAddress] = useState("");
  const [addDealPrice, setAddDealPrice] = useState("");
  const [addDealStage, setAddDealStage] = useState<DealStage>("new");
  const [addDealSaving, setAddDealSaving] = useState(false);
  const [addDealError, setAddDealError] = useState("");

  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("deals_view") as "list" | "kanban") ?? "kanban";
    }
    return "kanban";
  });

  const draggedDealIdRef = useRef<string | null>(null);

  // Tags
  const [agentTags, setAgentTags] = useState<AgentTag[]>(DEFAULT_AGENT_TAGS);
  const [agentSettings, setAgentSettings] = useState<Record<string, unknown>>({});
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]!);
  const [editingTagColor, setEditingTagColor] = useState<string | null>(null);
  const tagDragIdxRef = useRef<number | null>(null);

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

      if (agentRow?.settings) {
        const settings = agentRow.settings as Record<string, unknown>;
        setAgentSettings(settings);
        const savedTags = settings.deals_tags;
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
          "id,agent_id,lead_id,property_address,deal_type,price,stage,tags,stage_entered_at,next_followup_date,expected_close_date,notes,deal_details,created_at,updated_at,lead:leads(id,full_name,first_name,last_name,canonical_email,canonical_phone,ig_username,lead_temp,source,intent,timeline,location_area)"
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
      const tagOk = tagFilters.length === 0 || tagFilters.some((t) => deal.tags.includes(t));
      return sourceOk && tempOk && typeOk && tagOk;
    });
  }, [deals, sourceFilter, tempFilter, typeFilter, tagFilters]);

  const activeStages = useMemo(() => {
    if (accountType === "off_market_agent") return DEAL_BOARD_STAGES;
    return getPipelineStages(pipelineView) as readonly DealStage[];
  }, [accountType, pipelineView]);

  const groupedColumns = useMemo(() => {
    // In split view, filter deals to match pipeline type
    const viewDeals = accountType !== "off_market_agent" && pipelineView !== "all"
      ? filteredDeals.filter((d) => d.deal_type === pipelineView)
      : filteredDeals;

    return activeStages.map((stage) => ({
      stage,
      deals: viewDeals
        .filter((deal) => deal.stage === stage)
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")),
    }));
  }, [filteredDeals, activeStages, accountType, pipelineView]);

  const stats = useMemo(() => {
    const active = filteredDeals.filter((deal) => deal.stage !== "closed" && deal.stage !== "lost" && deal.stage !== "past_client").length;
    const hot = filteredDeals.filter((deal) => (deal.lead?.lead_temp || "").toLowerCase() === "hot").length;
    const stale = filteredDeals.filter((deal) => {
      if (!deal.updated_at) return true;
      const ts = new Date(deal.updated_at).getTime();
      return Number.isNaN(ts) || ts < Date.now() - 5 * 24 * 3600_000;
    }).length;
    return { active, hot, stale };
  }, [filteredDeals]);

  async function saveAgentTags(tags: AgentTag[]) {
    if (!agentId) return;
    const newSettings = { ...agentSettings, deals_tags: tags };
    setAgentSettings(newSettings);
    await supabase.from("agents").update({ settings: newSettings }).eq("id", agentId);
  }

  async function handleAddTag() {
    const name = newTagInput.trim();
    if (!name || agentTags.some((t) => t.name === name)) { setNewTagInput(""); return; }
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
      toast.error("Could not save deal update. Reverted.");
      return false;
    }

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

    void persistDealPatch(dealId, { stage: targetStage, stage_entered_at: new Date().toISOString() });

    if (selectedDealId === dealId) {
      setDraft((previous) => (previous ? { ...previous, stage: targetStage } : previous));
      setDraftDirty(true);
    }

    // Auto-seed TC checklist when moving to under_contract (no-op if already seeded)
    if (!isOffMarketAccount && targetStage === "under_contract") {
      void fetch(`/api/deals/${dealId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed_template: true }),
      }).then((res) => {
        if (res.ok) void loadChecklist(dealId);
      }).catch(() => {/* non-fatal */});
    }
  }

  async function saveDealDraft() {
    if (!selectedDeal || !draft) return;
    const propertyAddress = draft.property_address.trim();
    if (!propertyAddress) {
      toast.error("Property address is required.");
      return;
    }

    const parsedPrice = parsePositiveDecimal(draft.price);
    if (draft.price.trim() && parsedPrice === null) {
      toast.error("Price must be a valid positive number.");
      return;
    }

    setSavingDraft(true);

    const dealDetails = selectedDeal.deal_type === "buyer"
      ? (draft.buyerDetails ?? {})
      : selectedDeal.deal_type === "listing"
        ? (draft.listingDetails ?? {})
        : undefined;

    const ok = await persistDealPatch(selectedDeal.id, {
      property_address: propertyAddress,
      price: parsedPrice,
      stage: draft.stage,
      tags: draft.tags,
      next_followup_date: draft.next_followup_date.trim() || null,
      expected_close_date: draft.expected_close_date.trim() || null,
      notes: draft.notes.trim() || null,
      ...(dealDetails !== undefined ? { deal_details: dealDetails } : {}),
    });

    setSavingDraft(false);
    if (ok) {
      setDraftDirty(false);
      toast.success("Deal saved.");
      // Auto-seed TC checklist on manual stage change to under_contract
      if (!isOffMarketAccount && draft.stage === "under_contract" && selectedDeal.stage !== "under_contract") {
        void fetch(`/api/deals/${selectedDeal.id}/checklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed_template: true }),
        }).then((res) => {
          if (res.ok) void loadChecklist(selectedDeal.id);
        }).catch(() => {/* non-fatal */});
      }
    }
  }

  async function generateDescription() {
    if (!selectedDeal) return;
    setGeneratingDesc(true);
    setGeneratedDesc("");
    try {
      const res = await fetch(`/api/deals/${selectedDeal.id}/generate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: descFeatures }),
      });
      const data = await res.json() as { description?: string; error?: string };
      if (data.description) setGeneratedDesc(data.description);
      else setGeneratedDesc(data.error ?? "Failed to generate.");
    } catch {
      setGeneratedDesc("Something went wrong. Please try again.");
    } finally {
      setGeneratingDesc(false);
    }
  }

  async function loadChecklist(dealId: string) {
    setChecklistLoading(true);
    setChecklist([]);
    try {
      const res = await fetch(`/api/deals/${dealId}/checklist`);
      const data = await res.json() as { items?: ChecklistItem[] };
      setChecklist(data.items ?? []);
    } catch {
      // non-fatal
    } finally {
      setChecklistLoading(false);
    }
  }

  async function seedChecklist(dealId: string) {
    setChecklistSeeding(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed_template: true }),
      });
      const data = await res.json() as { items?: ChecklistItem[]; error?: string };
      if (data.items) setChecklist(data.items);
    } catch {
      // non-fatal
    } finally {
      setChecklistSeeding(false);
    }
  }

  async function addChecklistItem(dealId: string, label: string) {
    if (!label.trim()) return;
    const res = await fetch(`/api/deals/${dealId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    const data = await res.json() as { item?: ChecklistItem };
    if (data.item) {
      setChecklist((prev) => [...prev, data.item!]);
      setNewChecklistLabel("");
    }
  }

  async function toggleChecklistItem(dealId: string, item: ChecklistItem) {
    const newCompleted = !item.completed;
    // Optimistic update
    setChecklist((prev) =>
      prev.map((c) =>
        c.id === item.id
          ? { ...c, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : c
      )
    );
    const res = await fetch(`/api/deals/${dealId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: newCompleted }),
    });
    if (!res.ok) {
      // Revert
      setChecklist((prev) =>
        prev.map((c) => (c.id === item.id ? item : c))
      );
    }
  }

  async function deleteChecklistItem(dealId: string, itemId: string) {
    setChecklist((prev) => prev.filter((c) => c.id !== itemId));
    await fetch(`/api/deals/${dealId}/checklist/${itemId}`, { method: "DELETE" });
  }

  function openDealDetail(dealId: string) {
    setSelectedDealId(dealId);
    setIsDetailOpen(true);
    setChecklist([]);
    setNewChecklistLabel("");
    setDealAppts([]);
    setDealDocs([]);
    setShowDocUpload(false);
    setDocFile(null);
    void loadChecklist(dealId);

    // Load upcoming appointments for this deal
    void supabase
      .from("appointments")
      .select("id,title,scheduled_at,appointment_type,status")
      .eq("deal_id", dealId)
      .neq("status", "cancelled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5)
      .then(({ data }) => setDealAppts(data ?? []));

    // Load documents for this deal
    void fetch("/api/documents", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { documents?: Array<{ id: string; file_name: string; status: string; file_type: string; deal_id?: string; signed_url?: string | null }> }) => {
        setDealDocs((d.documents ?? []).filter((doc) => doc.deal_id === dealId));
      })
      .catch(() => {/* non-critical */});
  }

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
      const data = await res.json() as { ok?: boolean; document?: { id: string; file_name: string; status: string; file_type: string; signed_url?: string | null } };
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
        deal_details: null,
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
      setAddDealStage("new");
      setAddDealType("buyer");
      toast.success(`${addDealName.trim()} added to the board.`);
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
            <h1 className="crm-page-title">{isOffMarketAccount ? "Deal command board" : "Client pipeline"}</h1>
            <p className="crm-page-subtitle">
              {isOffMarketAccount
                ? "Work acquisition and disposition opportunities from one board with clear stage, contact context, and last activity."
                : "Buyer and listing pipelines in one board. Track stage, follow-up dates, and deal details without leaving the view."}
            </p>
          </div>
          <div className="crm-page-actions">
            {!isOffMarketAccount && (
              <div style={{ display: "flex", gap: 4 }}>
                {(["kanban", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setViewMode(mode); localStorage.setItem("deals_view", mode); }}
                    style={{
                      fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: viewMode === mode ? "var(--ink)" : "transparent",
                      color: viewMode === mode ? "#fff" : "var(--ink-muted)",
                      fontWeight: viewMode === mode ? 600 : 400,
                    }}
                  >
                    {mode === "kanban" ? "Board" : "List"}
                  </button>
                ))}
              </div>
            )}
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

        {/* Pipeline view switcher — traditional agents only */}
        {!isOffMarketAccount && (
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "buyer", "listing"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setPipelineView(v); setTypeFilter(v === "all" ? "all" : v); }}
                style={{
                  fontSize: 12, padding: "4px 14px", borderRadius: 20, cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: pipelineView === v ? "var(--ink)" : "transparent",
                  color: pipelineView === v ? "#fff" : "var(--ink-muted)",
                  fontWeight: pipelineView === v ? 600 : 400,
                }}
              >
                {v === "all" ? "All" : v === "buyer" ? "Buyer Pipeline" : "Listing Pipeline"}
              </button>
            ))}
          </div>
        )}

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

        {/* Tag filters — traditional only */}
        {!isOffMarketAccount && agentTags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>Tags:</span>
            {agentTags.map((tag) => {
              const active = tagFilters.includes(tag.name);
              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => setTagFilters((prev) => toggleTag(prev, tag.name))}
                  style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${active ? tag.color : "var(--border)"}`,
                    background: active ? tag.color : "transparent",
                    color: active ? "#fff" : "var(--ink-muted)",
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : tag.color, flexShrink: 0, display: "inline-block" }} />
                  {tag.name}
                </button>
              );
            })}
            {tagFilters.length > 0 && (
              <button type="button" onClick={() => setTagFilters([])} style={{ fontSize: 11, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px" }}>
                Clear
              </button>
            )}
          </div>
        )}
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
      ) : !isOffMarketAccount && viewMode === "list" ? (
        <section className="crm-card">
          <div className="crm-table-wrap">
            <table className="crm-data-table">
              <thead>
                <tr>
                  <th>Client / Property</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Price</th>
                  <th>Days in Stage</th>
                  <th>Next Follow-up</th>
                  <th>Tags</th>
                  <th>Last Touch</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => {
                  const overdue = isOverdue(deal.next_followup_date);
                  return (
                    <tr key={deal.id} onClick={() => openDealDetail(deal.id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600 }}>
                        <div>{deal.property_address || leadDisplayName(deal.lead)}</div>
                        {deal.property_address && (
                          <div style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-muted)" }}>{leadDisplayName(deal.lead)}</div>
                        )}
                      </td>
                      <td>
                        <StatusBadge label={dealTypeLabel(deal.deal_type)} tone="default" />
                      </td>
                      <td>
                        <StatusBadge label={dealStageLabel(deal.stage)} tone={dealStageTone(deal.stage)} />
                      </td>
                      <td style={{ color: "var(--ink-muted)" }}>
                        {typeof deal.price === "number" || typeof deal.price === "string" ? `$${Number(deal.price).toLocaleString()}` : "—"}
                      </td>
                      <td style={{ color: daysInStage(deal.stage_entered_at, deal.updated_at) > 14 ? "var(--color-warn)" : "var(--ink-muted)", fontWeight: daysInStage(deal.stage_entered_at, deal.updated_at) > 14 ? 600 : undefined }}>
                        {daysInStage(deal.stage_entered_at, deal.updated_at)}d
                      </td>
                      <td style={{ color: overdue ? "var(--color-danger)" : "var(--ink-muted)", fontWeight: overdue ? 600 : undefined }}>
                        {deal.next_followup_date ? new Date(deal.next_followup_date).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        {deal.tags.length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {deal.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="crm-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: tagColor(tag, agentTags), flexShrink: 0, display: "inline-block" }} />
                                {tag}
                              </span>
                            ))}
                            {deal.tags.length > 2 && <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>+{deal.tags.length - 2}</span>}
                          </div>
                        ) : "—"}
                      </td>
                      <td style={{ color: "var(--ink-faint)", fontSize: 12 }}>{formatUpdatedAt(deal.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
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
                    style={!isOffMarketAccount ? {
                      borderLeft: `3px solid ${deal.deal_type === "buyer" ? "#2563eb" : "#16a34a"}`,
                    } : undefined}
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
                      {!isOffMarketAccount && deal.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="crm-chip" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: tagColor(tag, agentTags), flexShrink: 0, display: "inline-block" }} />
                          {tag}
                        </span>
                      ))}
                      {!isOffMarketAccount && deal.tags.length > 2 && (
                        <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>+{deal.tags.length - 2}</span>
                      )}
                    </div>

                    <div className="crm-stack-4">
                      {deal.lead?.intent || deal.lead?.timeline || deal.lead?.location_area ? (
                        <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                          {[deal.lead?.intent, deal.lead?.timeline, deal.lead?.location_area]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span>Last touch {formatUpdatedAt(deal.updated_at)}</span>
                        {!isOffMarketAccount && (
                          <span style={{ color: daysInStage(deal.stage_entered_at, deal.updated_at) > 14 ? "var(--color-warn)" : "var(--ink-faint)" }}>
                            {daysInStage(deal.stage_entered_at, deal.updated_at)}d in stage
                          </span>
                        )}
                        {!isOffMarketAccount && deal.next_followup_date && (
                          <span style={{ color: isOverdue(deal.next_followup_date) ? "var(--color-danger)" : "var(--ink-faint)" }}>
                            {isOverdue(deal.next_followup_date) ? "Follow-up overdue" : `Follow-up ${new Date(deal.next_followup_date).toLocaleDateString()}`}
                          </span>
                        )}
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
                  {(isOffMarketAccount
                    ? DEAL_STAGE_VALUES
                    : selectedDeal?.deal_type === "buyer" ? BUYER_PIPELINE_STAGES : LISTING_PIPELINE_STAGES
                  ).map((stage) => (
                    <option key={stage} value={stage}>
                      {dealStageLabel(stage)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-filter-field">
                <span>Next follow-up</span>
                <input
                  type="date"
                  value={draft.next_followup_date}
                  style={draft.next_followup_date && isOverdue(draft.next_followup_date) ? { borderColor: "var(--color-danger)" } : undefined}
                  onChange={(event) => {
                    setDraft((previous) =>
                      previous ? { ...previous, next_followup_date: event.target.value } : previous
                    );
                    setDraftDirty(true);
                  }}
                />
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

            {/* Tags — traditional only */}
            {!isOffMarketAccount && (
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}>Tags</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {agentTags.map((tag) => {
                    const active = draft.tags.includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => {
                          setDraft((prev) => prev ? { ...prev, tags: toggleTag(prev.tags, tag.name) } : prev);
                          setDraftDirty(true);
                        }}
                        style={{
                          fontSize: 12, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                          border: `1px solid ${active ? tag.color : "var(--border)"}`,
                          background: active ? tag.color : "transparent",
                          color: active ? "#fff" : "var(--ink-muted)",
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : tag.color, flexShrink: 0, display: "inline-block" }} />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                {/* Add new tag inline */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: newTagColor === c ? "2px solid var(--foreground)" : "2px solid transparent", cursor: "pointer", padding: 0, flexShrink: 0 }}
                    />
                  ))}
                  <input
                    value={newTagInput}
                    placeholder="New tag..."
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddTag(); } }}
                    style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", flex: 1, minWidth: 100 }}
                  />
                  <button type="button" onClick={() => void handleAddTag()} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                    Add
                  </button>
                </div>
              </div>
            )}

            <label className="crm-filter-field">
              <span>Notes</span>
              <textarea
                rows={4}
                value={draft.notes}
                onChange={(event) => {
                  setDraft((previous) => (previous ? { ...previous, notes: event.target.value } : previous));
                  setDraftDirty(true);
                }}
              />
            </label>

            {/* Type-specific fields for traditional agents */}
            {!isOffMarketAccount && selectedDeal?.deal_type === "buyer" && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Buyer Details
                </div>
                <div className="crm-two-column-form">
                  <label className="crm-filter-field">
                    <span>Pre-approval status</span>
                    <select
                      value={draft.buyerDetails?.preapproval_status ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), preapproval_status: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    >
                      <option value="">Not set</option>
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="pre_approved">Pre-approved</option>
                      <option value="fully_approved">Fully approved</option>
                    </select>
                  </label>
                  <label className="crm-filter-field">
                    <span>Pre-approval amount</span>
                    <input
                      value={draft.buyerDetails?.preapproval_amount ?? ""}
                      placeholder="650000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), preapproval_amount: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Lender / mortgage contact</span>
                    <input
                      value={draft.buyerDetails?.lender_name ?? ""}
                      placeholder="First National Bank"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), lender_name: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Financing type</span>
                    <select
                      value={draft.buyerDetails?.financing_type ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), financing_type: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    >
                      <option value="">Not set</option>
                      <option value="conventional">Conventional</option>
                      <option value="fha">FHA</option>
                      <option value="va">VA</option>
                      <option value="cash">Cash</option>
                      <option value="usda">USDA</option>
                      <option value="jumbo">Jumbo</option>
                    </select>
                  </label>
                  <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Search criteria (beds, baths, area, must-haves)</span>
                    <input
                      value={draft.buyerDetails?.search_criteria ?? ""}
                      placeholder="3bd/2ba, North Austin, min 1500sqft, no HOA"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), search_criteria: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Budget min</span>
                    <input
                      value={draft.buyerDetails?.price_range_min ?? ""}
                      placeholder="300000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), price_range_min: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Budget max</span>
                    <input
                      value={draft.buyerDetails?.price_range_max ?? ""}
                      placeholder="500000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), price_range_max: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Move-in timeline</span>
                    <select
                      value={draft.buyerDetails?.move_in_timeline ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), move_in_timeline: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    >
                      <option value="">Not set</option>
                      <option value="asap">ASAP</option>
                      <option value="1_3_months">1–3 months</option>
                      <option value="3_6_months">3–6 months</option>
                      <option value="6_12_months">6–12 months</option>
                      <option value="no_rush">No rush</option>
                    </select>
                  </label>
                  <label className="crm-filter-field">
                    <span>Buyer agreement signed</span>
                    <select
                      value={draft.buyerDetails?.buyer_agreement_signed ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), buyer_agreement_signed: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    >
                      <option value="">Not set</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="sent">Sent — awaiting signature</option>
                    </select>
                  </label>
                  <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Referral source</span>
                    <input
                      value={draft.buyerDetails?.referral_source ?? ""}
                      placeholder="Referred by John Smith"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, buyerDetails: { ...(prev.buyerDetails ?? {}), referral_source: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {!isOffMarketAccount && selectedDeal?.deal_type === "listing" && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Listing Details
                </div>
                <div className="crm-two-column-form">
                  <label className="crm-filter-field">
                    <span>Original list price</span>
                    <input
                      value={draft.listingDetails?.original_list_price ?? ""}
                      placeholder="550000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), original_list_price: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Current list price</span>
                    <input
                      value={draft.listingDetails?.list_price ?? ""}
                      placeholder="525000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), list_price: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Sale price (at close)</span>
                    <input
                      value={draft.listingDetails?.sale_price ?? ""}
                      placeholder="510000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), sale_price: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>MLS number</span>
                    <input
                      value={draft.listingDetails?.mls_number ?? ""}
                      placeholder="MLS-123456"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), mls_number: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Commission rate (%)</span>
                    <input
                      value={draft.listingDetails?.commission_rate ?? ""}
                      placeholder="3.0"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), commission_rate: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Listing expiration date</span>
                    <input
                      type="date"
                      value={draft.listingDetails?.listing_expiration_date ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), listing_expiration_date: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field">
                    <span>Seller motivation</span>
                    <select
                      value={draft.listingDetails?.seller_motivation ?? ""}
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), seller_motivation: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    >
                      <option value="">Not set</option>
                      <option value="relocation">Relocation</option>
                      <option value="downsizing">Downsizing</option>
                      <option value="upsizing">Upsizing</option>
                      <option value="retirement">Retirement</option>
                      <option value="divorce">Divorce</option>
                      <option value="financial">Financial</option>
                      <option value="estate_sale">Estate sale</option>
                      <option value="investment">Investment / 1031</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="crm-filter-field">
                    <span>Earnest money amount</span>
                    <input
                      value={draft.listingDetails?.earnest_money_amount ?? ""}
                      placeholder="5000"
                      inputMode="decimal"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), earnest_money_amount: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Showing instructions</span>
                    <input
                      value={draft.listingDetails?.showing_instructions ?? ""}
                      placeholder="Lockbox on front door, call 30 min ahead, dog on premises"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), showing_instructions: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Concessions offered</span>
                    <input
                      value={draft.listingDetails?.concessions_offered ?? ""}
                      placeholder="$5,000 closing cost credit, home warranty included"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), concessions_offered: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Referral source</span>
                    <input
                      value={draft.listingDetails?.referral_source ?? ""}
                      placeholder="Referred by Jane Doe"
                      onChange={(e) => {
                        setDraft((prev) => prev ? { ...prev, listingDetails: { ...(prev.listingDetails ?? {}), referral_source: e.target.value } } : prev);
                        setDraftDirty(true);
                      }}
                    />
                  </label>
                  {selectedDeal?.created_at && (
                    <div className="crm-filter-field" style={{ alignSelf: "end", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>Days on market</span>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {Math.max(0, Math.floor((Date.now() - new Date(selectedDeal.created_at).getTime()) / 86_400_000))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Listing description generator */}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowDescGenerator((v) => !v)}
                    style={{ fontSize: 12, color: "#16a34a", background: "none", border: "1px solid #16a34a", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    ✦ {showDescGenerator ? "Hide" : "Generate listing description"}
                  </button>
                  {showDescGenerator && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        rows={3}
                        value={descFeatures}
                        onChange={(e) => setDescFeatures(e.target.value)}
                        placeholder="Optional: list key features to highlight (3bd/2ba, renovated kitchen, large backyard, cul-de-sac, etc.)"
                        style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
                      />
                      <button
                        type="button"
                        className="crm-btn crm-btn-primary"
                        style={{ fontSize: 12, alignSelf: "flex-start", background: "#16a34a" }}
                        onClick={() => void generateDescription()}
                        disabled={generatingDesc}
                      >
                        {generatingDesc ? "Generating..." : "Generate"}
                      </button>
                      {generatedDesc && (
                        <div style={{ fontSize: 13, background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--ink-body)" }}>
                          {generatedDesc}
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              style={{ fontSize: 11, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              onClick={() => { void navigator.clipboard.writeText(generatedDesc); toast.success("Copied to clipboard."); }}
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              style={{ fontSize: 11, color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              onClick={() => {
                                setDraft((prev) => prev ? { ...prev, notes: (prev.notes ? prev.notes + "\n\n" : "") + generatedDesc } : prev);
                                setDraftDirty(true);
                                setGeneratedDesc("");
                                setShowDescGenerator(false);
                              }}
                            >
                              Add to notes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Upcoming appointments */}
            {!isOffMarketAccount && dealAppts.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Upcoming Appointments</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {dealAppts.map((appt) => (
                    <div key={appt.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "#eff6ff", borderRadius: 6, padding: "6px 10px" }}>
                      <span style={{ color: "#2563eb", fontWeight: 600, flexShrink: 0 }}>
                        {new Date(appt.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" "}
                        {new Date(appt.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.title}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "capitalize", flexShrink: 0 }}>{appt.appointment_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {!isOffMarketAccount && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Documents ({dealDocs.length})
                  </div>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setShowDocUpload((v) => !v)}
                  >
                    {showDocUpload ? "Cancel" : "+ Add"}
                  </button>
                </div>

                {showDocUpload && (
                  <div style={{ background: "var(--surface-2, var(--line))", borderRadius: 8, padding: 12, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input type="file" style={{ fontSize: 13 }} onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={docFileType} onChange={(e) => setDocFileType(e.target.value)} style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="agreement">Agreement</option>
                        <option value="purchase_contract">Purchase Contract</option>
                        <option value="inspection_report">Inspection Report</option>
                        <option value="appraisal">Appraisal</option>
                        <option value="title_commitment">Title Commitment</option>
                        <option value="disclosure">Disclosure</option>
                        <option value="other">Other</option>
                      </select>
                      <select value={docStatus} onChange={(e) => setDocStatus(e.target.value)} style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
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
                      const sc = statusColors[doc.status] ?? statusColors.draft!;
                      return (
                        <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--line)", borderRadius: 8 }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: sc.bg, color: sc.color, flexShrink: 0 }}>
                            {doc.status.toUpperCase()}
                          </span>
                          {doc.signed_url && (
                            <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--brand)", flexShrink: 0 }}>View</a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Transaction Checklist — traditional agents only */}
            {!isOffMarketAccount && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Transaction Checklist
                    {checklist.length > 0 && (
                      <span style={{ marginLeft: 8, color: "var(--ink-faint)", fontWeight: 400, textTransform: "none" }}>
                        {checklist.filter((c) => c.completed).length}/{checklist.length} done
                      </span>
                    )}
                  </div>
                  {checklist.length === 0 && !checklistLoading && (
                    <button
                      type="button"
                      onClick={() => void seedChecklist(selectedDeal.id)}
                      disabled={checklistSeeding}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
                    >
                      {checklistSeeding ? "Loading..." : "Load template"}
                    </button>
                  )}
                </div>

                {checklistLoading ? (
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Loading checklist...</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {checklist.map((item) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => void toggleChecklistItem(selectedDeal.id, item)}
                          style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer", accentColor: "var(--ink-primary, #2563eb)" }}
                        />
                        <span style={{
                          fontSize: 13,
                          flex: 1,
                          color: item.completed ? "var(--ink-faint)" : "var(--ink-body)",
                          textDecoration: item.completed ? "line-through" : "none",
                        }}>
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteChecklistItem(selectedDeal.id, item.id)}
                          style={{ fontSize: 16, lineHeight: 1, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0 }}
                          aria-label="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input
                        value={newChecklistLabel}
                        onChange={(e) => setNewChecklistLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void addChecklistItem(selectedDeal.id, newChecklistLabel);
                        }}
                        placeholder="Add a step..."
                        style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--ink)", fontFamily: "inherit" }}
                      />
                      <button
                        type="button"
                        onClick={() => void addChecklistItem(selectedDeal.id, newChecklistLabel)}
                        disabled={!newChecklistLabel.trim()}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  {(isOffMarketAccount
                    ? DEAL_BOARD_STAGES
                    : addDealType === "buyer" ? BUYER_PIPELINE_STAGES : LISTING_PIPELINE_STAGES
                  ).map((s) => (
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
