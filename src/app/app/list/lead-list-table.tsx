"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SourceDetail = Record<string, unknown> | null;

export type LeadListRow = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  source_detail: SourceDetail;
};

type ViewFilters = {
  search: string;
  stage: string;
  temp: string;
  source: string;
  contact: "all" | "with_contact" | "missing_contact";
};

type SavedView = {
  id: string;
  name: string;
  filters: ViewFilters;
};

const STORAGE_KEY = "igcrm_lead_list_saved_views_v1";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSyntheticHandle(handle: string | null): boolean {
  if (!handle) return false;
  const value = handle.trim().toLowerCase();
  if (!value) return false;
  if (/^(import|intake|manual|event)_lead_[0-9a-f]{8}$/.test(value)) return true;
  if (/^(import|intake|manual)_[a-z0-9_]+_[0-9a-f]{8}$/.test(value)) return true;
  return false;
}

function displayName(lead: LeadListRow): string {
  const detail = lead.source_detail || {};
  const full = asText(lead.full_name) || asText(detail.full_name);
  const first = asText(lead.first_name) || asText(detail.first_name);
  const last = asText(lead.last_name) || asText(detail.last_name);
  if (full) return full;
  if (first || last) return `${first} ${last}`.trim();
  if (lead.canonical_email) return lead.canonical_email;
  if (lead.canonical_phone) return lead.canonical_phone;
  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) return `@${lead.ig_username}`;
  return "Unnamed lead";
}

function emailOf(lead: LeadListRow): string {
  return asText(lead.canonical_email) || asText(lead.source_detail?.email);
}

function phoneOf(lead: LeadListRow): string {
  return asText(lead.canonical_phone) || asText(lead.source_detail?.phone);
}

function tagsOf(lead: LeadListRow): string {
  return asText(lead.source_detail?.tags);
}

function matchesSearch(lead: LeadListRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    displayName(lead),
    lead.ig_username || "",
    emailOf(lead),
    phoneOf(lead),
    tagsOf(lead),
    lead.stage || "",
    lead.lead_temp || "",
    lead.source || "",
    lead.last_message_preview || "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

const DEFAULT_FILTERS: ViewFilters = {
  search: "",
  stage: "all",
  temp: "all",
  source: "all",
  contact: "all",
};

const SMART_LISTS: Array<{ key: string; label: string; filters: ViewFilters }> = [
  { key: "all", label: "All", filters: { ...DEFAULT_FILTERS } },
  { key: "new", label: "New", filters: { ...DEFAULT_FILTERS, stage: "New" } },
  { key: "hot", label: "Hot", filters: { ...DEFAULT_FILTERS, temp: "Hot" } },
  { key: "closed", label: "Closed", filters: { ...DEFAULT_FILTERS, stage: "Closed" } },
  { key: "with_contact", label: "With Contact", filters: { ...DEFAULT_FILTERS, contact: "with_contact" } },
  { key: "missing_contact", label: "Missing Contact", filters: { ...DEFAULT_FILTERS, contact: "missing_contact" } },
];

export default function LeadListTable({ leads }: { leads: LeadListRow[] }) {
  const [filters, setFilters] = useState<ViewFilters>(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedView[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [saveName, setSaveName] = useState("");
  const [activeSmartList, setActiveSmartList] = useState("all");
  const [viewMessage, setViewMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedViews));
  }, [savedViews]);

  const stageOptions = useMemo(
    () => ["all", ...Array.from(new Set(leads.map((l) => l.stage || "New"))).sort()],
    [leads]
  );
  const tempOptions = useMemo(
    () => ["all", ...Array.from(new Set(leads.map((l) => l.lead_temp || "Warm"))).sort()],
    [leads]
  );
  const sourceOptions = useMemo(
    () => ["all", ...Array.from(new Set(leads.map((l) => l.source || "unknown"))).sort()],
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return leads
      .filter((lead) => {
        if (!matchesSearch(lead, q)) return false;
        if (filters.stage !== "all" && (lead.stage || "New") !== filters.stage) return false;
        if (filters.temp !== "all" && (lead.lead_temp || "Warm") !== filters.temp) return false;
        if (filters.source !== "all" && (lead.source || "unknown") !== filters.source) return false;
        if (filters.contact === "with_contact" && !emailOf(lead) && !phoneOf(lead)) return false;
        if (filters.contact === "missing_contact" && (emailOf(lead) || phoneOf(lead))) return false;
        return true;
      })
      .sort((a, b) => (b.time_last_updated || "").localeCompare(a.time_last_updated || ""));
  }, [filters, leads]);

  function applyFilters(next: ViewFilters, smartListKey?: string) {
    setFilters(next);
    setActiveSmartList(smartListKey || "");
    setViewMessage("");
  }

  function saveCurrentView() {
    const name = saveName.trim();
    if (!name) {
      setViewMessage("Add a name before saving.");
      return;
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const next = [{ id, name, filters }, ...savedViews].slice(0, 12);
    setSavedViews(next);
    setSaveName("");
    setViewMessage("Saved view created.");
  }

  function removeView(id: string) {
    setSavedViews((prev) => prev.filter((view) => view.id !== id));
    setViewMessage("Saved view removed.");
  }

  return (
    <section className="crm-card" style={{ marginTop: 16, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>Leads</div>
        <span className="crm-chip">{filteredLeads.length} result(s)</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SMART_LISTS.map((preset) => (
          <button
            key={preset.key}
            className="crm-btn crm-btn-secondary"
            style={{
              padding: "6px 9px",
              fontSize: 12,
              border: activeSmartList === preset.key ? "1px solid var(--accent)" : "1px solid var(--line)",
            }}
            onClick={() => applyFilters(preset.filters, preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8 }}>
        <input
          placeholder="Search name, handle, email, phone, tags..."
          value={filters.search}
          onChange={(event) => applyFilters({ ...filters, search: event.target.value })}
        />
        <select value={filters.stage} onChange={(event) => applyFilters({ ...filters, stage: event.target.value })}>
          {stageOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All stages" : option}
            </option>
          ))}
        </select>
        <select value={filters.temp} onChange={(event) => applyFilters({ ...filters, temp: event.target.value })}>
          {tempOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All temps" : option}
            </option>
          ))}
        </select>
        <select value={filters.source} onChange={(event) => applyFilters({ ...filters, source: event.target.value })}>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All sources" : option}
            </option>
          ))}
        </select>
        <select
          value={filters.contact}
          onChange={(event) =>
            applyFilters({
              ...filters,
              contact: event.target.value as ViewFilters["contact"],
            })
          }
        >
          <option value="all">All contacts</option>
          <option value="with_contact">With phone/email</option>
          <option value="missing_contact">Missing phone/email</option>
        </select>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Save current filters as view..."
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          style={{ maxWidth: 280 }}
        />
        <button className="crm-btn crm-btn-primary" style={{ padding: "8px 10px" }} onClick={saveCurrentView}>
          Save View
        </button>
      </div>

      {savedViews.length > 0 ? (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {savedViews.map((view) => (
            <div key={view.id} className="crm-card-muted" style={{ padding: 8, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{view.name}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="crm-btn crm-btn-secondary"
                  style={{ padding: "6px 8px", fontSize: 12 }}
                  onClick={() => applyFilters(view.filters)}
                >
                  Open
                </button>
                <button
                  className="crm-btn crm-btn-secondary"
                  style={{ padding: "6px 8px", fontSize: 12 }}
                  onClick={() => removeView(view.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {viewMessage ? (
        <div style={{ marginTop: 8 }} className={`crm-chip ${viewMessage.includes("removed") || viewMessage.includes("created") ? "crm-chip-ok" : "crm-chip-danger"}`}>
          {viewMessage}
        </div>
      ) : null}

      <div className="crm-card" style={{ marginTop: 12, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
          <thead>
            <tr>
              {["Name", "Handle", "Email", "Phone", "Tags", "Stage", "Temp", "Source", "Last Message", "Updated", "View"].map((label) => (
                <th key={label} style={{ textAlign: "left", padding: 10, fontSize: 12, color: "var(--ink-muted)", borderBottom: "1px solid var(--line)" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)", fontWeight: 600 }}>{displayName(lead)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                  {lead.ig_username && !isSyntheticHandle(lead.ig_username) ? `@${lead.ig_username}` : "-"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{emailOf(lead) || "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{phoneOf(lead) || "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tagsOf(lead) || "-"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{lead.stage || "New"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{lead.lead_temp || "Warm"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{lead.source || "-"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)", maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lead.last_message_preview || "-"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                  {lead.time_last_updated ? new Date(lead.time_last_updated).toLocaleString() : "-"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                  <Link href={`/app/leads/${encodeURIComponent(lead.id)}`} className="crm-btn crm-btn-secondary" style={{ padding: "6px 9px", fontSize: 12 }}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
