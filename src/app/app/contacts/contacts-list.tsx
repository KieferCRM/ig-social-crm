"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ContactRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  ig_username: string | null;
  stage: string | null;
  lead_temp: string | null;
  source: string | null;
  intent: string | null;
  timeline: string | null;
  time_last_updated: string | null;
  tags: string[];
};

type DealSummary = {
  id: string;
  lead_id: string | null;
  stage: string | null;
  property_address: string | null;
};

function contactName(c: ContactRow): string {
  const combined = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  const name = c.full_name?.trim() || combined || c.canonical_email || c.canonical_phone;
  if (name) return name;
  if (c.ig_username) return `@${c.ig_username.replace(/^@+/, "")}`;
  return "Unnamed";
}

function timeAgo(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const TEMP_COLORS: Record<string, { bg: string; color: string }> = {
  Hot:  { bg: "#fef2f2", color: "#dc2626" },
  Warm: { bg: "#fffbeb", color: "#d97706" },
  Cold: { bg: "#eff6ff", color: "#2563eb" },
};

function TempBadge({ temp }: { temp: string | null }) {
  if (!temp) return <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>;
  const c = TEMP_COLORS[temp] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: c.bg, color: c.color }}>
      {temp.toUpperCase()}
    </span>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

type EditForm = {
  full_name: string;
  canonical_phone: string;
  canonical_email: string;
  lead_temp: string;
  intent: string;
  timeline: string;
  stage: string;
  tags: string;
  notes: string;
};

function EditModal({ contact, onClose, onSaved }: {
  contact: ContactRow;
  onClose: () => void;
  onSaved: (updated: Partial<ContactRow>) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    full_name: contactName(contact) === "Unnamed" ? "" : contactName(contact),
    canonical_phone: contact.canonical_phone ?? "",
    canonical_email: contact.canonical_email ?? "",
    lead_temp: contact.lead_temp ?? "",
    intent: contact.intent ?? "",
    timeline: contact.timeline ?? "",
    stage: contact.stage ?? "New",
    tags: contact.tags.join(", "),
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof EditForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        full_name: form.full_name || null,
        canonical_phone: form.canonical_phone || null,
        canonical_email: form.canonical_email || null,
        lead_temp: form.lead_temp || null,
        intent: form.intent || null,
        timeline: form.timeline || null,
        stage: form.stage || "New",
        tags: form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      };
      if (form.notes.trim()) body.notes = form.notes.trim();

      const res = await fetch(`/api/leads/simple/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Could not save."); return; }

      onSaved({
        full_name: form.full_name || null,
        canonical_phone: form.canonical_phone || null,
        canonical_email: form.canonical_email || null,
        lead_temp: form.lead_temp || null,
        intent: form.intent || null,
        timeline: form.timeline || null,
        stage: form.stage || "New",
        tags: form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      });
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Edit Contact</div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--ink-muted)", lineHeight: 1 }}>×</button>
        </div>

        <div className="crm-stack-10">
          <div className="crm-grid-cards-2" style={{ gap: 12 }}>
            <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
              <span>Full name</span>
              <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Jane Smith" />
            </label>
            <label className="crm-filter-field">
              <span>Phone</span>
              <input value={form.canonical_phone} onChange={(e) => set("canonical_phone", e.target.value)} placeholder="+1 555 000 0000" />
            </label>
            <label className="crm-filter-field">
              <span>Email</span>
              <input value={form.canonical_email} onChange={(e) => set("canonical_email", e.target.value)} placeholder="jane@email.com" />
            </label>
            <label className="crm-filter-field">
              <span>Temperature</span>
              <select value={form.lead_temp} onChange={(e) => set("lead_temp", e.target.value)}>
                <option value="">Not set</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </label>
            <label className="crm-filter-field">
              <span>Intent</span>
              <select value={form.intent} onChange={(e) => set("intent", e.target.value)}>
                <option value="">Not set</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
                <option value="Rent">Rent</option>
                <option value="Invest">Invest</option>
              </select>
            </label>
            <label className="crm-filter-field">
              <span>Timeline</span>
              <select value={form.timeline} onChange={(e) => set("timeline", e.target.value)}>
                <option value="">Not set</option>
                <option value="0-3 months">0–3 months</option>
                <option value="3-6 months">3–6 months</option>
                <option value="6-12 months">6–12 months</option>
                <option value="12+ months">12+ months</option>
              </select>
            </label>
            <label className="crm-filter-field">
              <span>Stage</span>
              <select value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
            <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
              <span>Tags (comma separated)</span>
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="cash buyer, motivated seller, acquisition" />
            </label>
            <label className="crm-filter-field" style={{ gridColumn: "1 / -1" }}>
              <span>Notes</span>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any notes about this contact..." style={{ resize: "vertical", fontFamily: "inherit" }} />
            </label>
          </div>

          {error && <div className="crm-chip crm-chip-danger" style={{ width: "fit-content" }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="crm-btn crm-btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save contact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main List ─────────────────────────────────────────────────────────────────

function exportContactsCSV(contacts: ContactRow[]) {
  const headers = ["Name", "Phone", "Email", "Temperature", "Intent", "Timeline", "Stage", "Tags", "Last Updated"];
  const rows = contacts.map((c) => [
    contactName(c),
    c.canonical_phone ?? "",
    c.canonical_email ?? "",
    c.lead_temp ?? "",
    c.intent ?? "",
    c.timeline ?? "",
    c.stage ?? "",
    c.tags.join("; "),
    c.time_last_updated ? new Date(c.time_last_updated).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContactsList({
  contacts: initialContacts,
  deals,
  isOffMarketAccount,
}: {
  contacts: ContactRow[];
  deals: DealSummary[];
  isOffMarketAccount: boolean;
}) {
  const [contacts, setContacts] = useState<ContactRow[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("all");
  const [filterIntent, setFilterIntent] = useState("all");
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkTagging, setBulkTagging] = useState(false);

  const dealsByLead = useMemo(() => {
    const map = new Map<string, DealSummary[]>();
    for (const deal of deals) {
      if (!deal.lead_id) continue;
      const cur = map.get(deal.lead_id) ?? [];
      cur.push(deal);
      map.set(deal.lead_id, cur);
    }
    return map;
  }, [deals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      const nameOk = !q ||
        contactName(c).toLowerCase().includes(q) ||
        (c.canonical_phone ?? "").includes(q) ||
        (c.canonical_email ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.includes(q));
      const tempOk = filterTemp === "all" || c.lead_temp === filterTemp;
      const intentOk = filterIntent === "all" || c.intent === filterIntent;
      return nameOk && tempOk && intentOk;
    });
  }, [contacts, search, filterTemp, filterIntent]);

  function handleSaved(id: string, updated: Partial<ContactRow>) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  async function handleBulkTag() {
    const tag = bulkTag.trim().toLowerCase();
    if (!tag || selected.size === 0) return;
    setBulkTagging(true);
    const ids = Array.from(selected);
    await Promise.all(ids.map(async (id) => {
      const contact = contacts.find((c) => c.id === id);
      if (!contact) return;
      const newTags = Array.from(new Set([...contact.tags, tag]));
      await fetch(`/api/leads/simple/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, tags: newTags } : c));
    }));
    setBulkTag("");
    setSelected(new Set());
    setBulkTagging(false);
  }

  return (
    <div className="crm-stack-10">
      {/* Filters + toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email, tag…"
          className="crm-input"
          style={{ maxWidth: 280, fontSize: 13 }}
          autoComplete="off"
        />
        <select value={filterTemp} onChange={(e) => setFilterTemp(e.target.value)} className="crm-input" style={{ fontSize: 13, width: "auto" }}>
          <option value="all">All temps</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
        </select>
        <select value={filterIntent} onChange={(e) => setFilterIntent(e.target.value)} className="crm-input" style={{ fontSize: 13, width: "auto" }}>
          <option value="all">All intents</option>
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
          <option value="Rent">Rent</option>
          <option value="Invest">Invest</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{filtered.length} of {contacts.length}</span>
        <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => exportContactsCSV(filtered)}>
          Export CSV
        </button>
      </div>

      {/* Bulk tag bar */}
      {selected.size > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            placeholder="Tag to add (e.g. cash buyer)"
            className="crm-input"
            style={{ fontSize: 13, maxWidth: 220 }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleBulkTag(); }}
          />
          <button type="button" className="crm-btn crm-btn-primary" style={{ fontSize: 12 }} disabled={!bulkTag.trim() || bulkTagging} onClick={() => void handleBulkTag()}>
            {bulkTagging ? "Tagging..." : "Add tag"}
          </button>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
          {contacts.length === 0
            ? "No contacts yet. Add one manually or let the Secretary capture inbound leads automatically."
            : "No contacts match these filters."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px", width: 36 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                </th>
              {["Name", "Phone", "Email", "Temp", "Intent", isOffMarketAccount ? "Deals" : "Stage", "Last touch", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const linkedDeals = dealsByLead.get(contact.id) ?? [];
                const phone = contact.canonical_phone;
                const email = contact.canonical_email;

                return (
                  <tr
                    key={contact.id}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s", background: selected.has(contact.id) ? "var(--surface-2)" : undefined }}
                    onMouseEnter={(e) => { if (!selected.has(contact.id)) e.currentTarget.style.background = "var(--surface-hover, #f9fafb)"; }}
                    onMouseLeave={(e) => { if (!selected.has(contact.id)) e.currentTarget.style.background = ""; }}
                  >
                    <td style={{ padding: "10px 12px", width: 36 }}>
                      <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleSelect(contact.id)} />
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {contactName(contact)}
                      {contact.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                          {contact.tags.slice(0, 2).map((t) => (
                            <span key={t} style={{ fontSize: 10, background: "#f3f4f6", color: "var(--ink-muted)", borderRadius: 3, padding: "1px 5px" }}>{t}</span>
                          ))}
                          {contact.tags.length > 2 && <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>+{contact.tags.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {phone
                        ? <a href={`tel:${phone}`} style={{ color: "var(--ink-primary)", textDecoration: "none" }}>{phone}</a>
                        : <span style={{ color: "var(--ink-faint)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email
                        ? <a href={`mailto:${email}`} style={{ color: "var(--ink-primary)", textDecoration: "none" }}>{email}</a>
                        : <span style={{ color: "var(--ink-faint)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <TempBadge temp={contact.lead_temp} />
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: contact.intent ? "var(--ink-body)" : "var(--ink-faint)" }}>
                      {contact.intent ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {isOffMarketAccount ? (
                        linkedDeals.length > 0
                          ? <Link href="/app/pipeline" style={{ color: "var(--ink-primary)", textDecoration: "none", fontWeight: 500 }}>{linkedDeals.length} deal{linkedDeals.length > 1 ? "s" : ""}</Link>
                          : <span style={{ color: "var(--ink-faint)" }}>—</span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>{contact.stage ?? "New"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--ink-muted)" }}>
                      {timeAgo(contact.time_last_updated)}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() => setEditingContact(contact)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingContact && (
        <EditModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSaved={(updated) => { handleSaved(editingContact.id, updated); setEditingContact(null); }}
        />
      )}
    </div>
  );
}
