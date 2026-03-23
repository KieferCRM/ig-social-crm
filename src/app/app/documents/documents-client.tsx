"use client";

import { useEffect, useMemo, useState } from "react";

type LeadOption = {
  id: string;
  label: string;
};

type DealOption = {
  id: string;
  label: string;
};

type WorkspaceDocumentRow = {
  id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  deal_id: string;
  lead_id: string;
  tags: string[];
  status: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  signed_url?: string | null;
};

type DocumentsResponse = {
  documents?: WorkspaceDocumentRow[];
  error?: string;
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:  { label: "Draft",  bg: "#f3f4f6", color: "#6b7280" },
  sent:   { label: "Sent",   bg: "#dbeafe", color: "#1d4ed8" },
  signed: { label: "Signed", bg: "#dcfce7", color: "#15803d" },
  final:  { label: "Final",  bg: "#fef9c3", color: "#a16207" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px", background: meta.bg, color: meta.color }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DocumentsClient({
  deals,
  leads,
  isOffMarketAccount,
  initialDealId,
  initialLeadId,
}: {
  deals: DealOption[];
  leads: LeadOption[];
  isOffMarketAccount: boolean;
  initialDealId: string;
  initialLeadId: string;
}) {
  const [documents, setDocuments] = useState<WorkspaceDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Upload form
  const [selectedDealId, setSelectedDealId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [fileType, setFileType] = useState("agreement");
  const [status, setStatus] = useState("draft");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Filters
  const [filterDealId, setFilterDealId] = useState(initialDealId);
  const [filterLeadId, setFilterLeadId] = useState(initialLeadId);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editFileType, setEditFileType] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function loadDocuments() {
    try {
      setLoading(true);
      const response = await fetch("/api/documents", { cache: "no-store" });
      const data = (await response.json()) as DocumentsResponse;
      if (!response.ok) {
        setMessage(data.error || "Could not load documents.");
        return;
      }
      setDocuments(data.documents || []);
      setMessage("");
    } catch {
      setMessage("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    const timer = setInterval(() => void loadDocuments(), 55 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const dealOk = !filterDealId || doc.deal_id === filterDealId;
        const leadOk = !filterLeadId || doc.lead_id === filterLeadId;
        const statusOk = filterStatus === "all" || doc.status === filterStatus;
        const searchOk = !search || doc.file_name.toLowerCase().includes(search.toLowerCase());
        return dealOk && leadOk && statusOk && searchOk;
      })
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }, [documents, filterDealId, filterLeadId, filterStatus, search]);

  async function uploadDocument() {
    if (!file) { setMessage("Choose a file first."); return; }
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("deal_id", selectedDealId);
      formData.set("lead_id", selectedLeadId);
      formData.set("file_type", fileType);
      formData.set("status", status);
      formData.set("tags", tags);
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) { setMessage(data.error || "Could not upload document."); return; }
      setFile(null);
      setSelectedDealId("");
      setSelectedLeadId("");
      setFileType("agreement");
      setStatus("draft");
      setTags("");
      setMessage("Document uploaded.");
      await loadDocuments();
    } catch {
      setMessage("Could not upload document.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    const doc = documents.find((d) => d.id === id);
    const label = doc?.file_name ?? "this document";
    if (!window.confirm(`Remove "${label}"? This cannot be undone.`)) return;
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) { setMessage(data.error || "Could not remove document."); return; }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setMessage("Document removed.");
    } catch {
      setMessage("Could not remove document.");
    }
  }

  function startEdit(doc: WorkspaceDocumentRow) {
    setEditingId(doc.id);
    setEditStatus(doc.status);
    setEditFileType(doc.file_type);
    setEditTags(doc.tags.join(", "));
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const response = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: editStatus,
          file_type: editFileType,
          tags: editTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) { setMessage(data.error || "Could not save changes."); return; }
      setDocuments((prev) => prev.map((d) => d.id === id
        ? { ...d, status: editStatus, file_type: editFileType, tags: editTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) }
        : d
      ));
      setEditingId(null);
    } catch {
      setMessage("Could not save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="crm-stack-12">
      {/* Upload */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Upload document</h2>
            <p className="crm-section-subtitle">
              {isOffMarketAccount
                ? "Attach contracts, seller notes, disclosures, and supporting files directly to the active opportunity."
                : "Store agreements, contracts, checklists, and supporting files with the right deal."}
            </p>
          </div>
        </div>

        <div className="crm-grid-cards-2">
          <label className="crm-filter-field">
            <span>Related deal</span>
            <select value={selectedDealId} onChange={(e) => setSelectedDealId(e.target.value)}>
              <option value="">No deal selected</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Related contact</span>
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)}>
              <option value="">No contact selected</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Document type</span>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="agreement">Agreement</option>
              <option value="contract">Contract</option>
              <option value="checklist">Checklist</option>
              <option value="disclosure">Disclosure</option>
              <option value="media">Photo / Media</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="final">Final</option>
            </select>
          </label>
        </div>

        <div className="crm-grid-cards-2">
          <label className="crm-filter-field">
            <span>Tags</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="contract, seller, pending" />
          </label>

          <label className="crm-filter-field">
            <span>File</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="crm-btn crm-btn-primary" onClick={() => void uploadDocument()} disabled={saving}>
            {saving ? "Uploading..." : "Upload document"}
          </button>
        </div>

        {message ? (
          <div
            className={`crm-chip ${message.includes("Could not") || message.includes("Choose") ? "crm-chip-danger" : "crm-chip-ok"}`}
            style={{ width: "fit-content" }}
          >
            {message}
          </div>
        ) : null}
      </section>

      {/* List */}
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Documents</h2>
            <p className="crm-section-subtitle">
              {isOffMarketAccount
                ? "Filter by opportunity, contact, or status to keep document review deal-centered."
                : "Reopen the files you touched most recently."}
            </p>
          </div>
        </div>

        {/* Filters + search */}
        <div className="crm-grid-cards-2" style={{ gap: 10 }}>
          <label className="crm-filter-field">
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by filename..." />
          </label>

          <label className="crm-filter-field">
            <span>Status</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="final">Final</option>
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Deal</span>
            <select value={filterDealId} onChange={(e) => setFilterDealId(e.target.value)}>
              <option value="">All deals</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Contact</span>
            <select value={filterLeadId} onChange={(e) => setFilterLeadId(e.target.value)}>
              <option value="">All contacts</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        </div>

        {loading ? <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading documents...</div> : null}

        {!loading && filteredDocuments.length === 0 ? (
          <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
            {documents.length === 0
              ? "No documents yet. Upload agreements, contracts, and checklist files here."
              : "No documents match these filters."}
          </div>
        ) : null}

        <div className="crm-stack-8">
          {filteredDocuments.map((doc) => (
            <article key={doc.id} className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="crm-stack-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{doc.file_name}</span>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    {doc.file_type} · {formatBytes(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                  </div>
                </div>
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  {doc.signed_url ? (
                    <a href={doc.signed_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">Open</a>
                  ) : null}
                  {editingId !== doc.id ? (
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => startEdit(doc)}>Edit</button>
                  ) : null}
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void deleteDocument(doc.id)}>Remove</button>
                </div>
              </div>

              {/* Linked deal / contact */}
              <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ink-muted)", flexWrap: "wrap" }}>
                <span>Deal: <strong style={{ color: "var(--ink-body)" }}>{deals.find((d) => d.id === doc.deal_id)?.label || "Not linked"}</strong></span>
                <span>Contact: <strong style={{ color: "var(--ink-body)" }}>{leads.find((l) => l.id === doc.lead_id)?.label || "Not linked"}</strong></span>
                {doc.tags.length > 0 && <span>Tags: <strong style={{ color: "var(--ink-body)" }}>{doc.tags.join(", ")}</strong></span>}
              </div>

              {/* Inline edit form */}
              {editingId === doc.id ? (
                <div className="crm-stack-8" style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
                  <div className="crm-grid-cards-3" style={{ gap: 10 }}>
                    <label className="crm-filter-field">
                      <span>Status</span>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="signed">Signed</option>
                        <option value="final">Final</option>
                      </select>
                    </label>
                    <label className="crm-filter-field">
                      <span>Type</span>
                      <select value={editFileType} onChange={(e) => setEditFileType(e.target.value)}>
                        <option value="agreement">Agreement</option>
                        <option value="contract">Contract</option>
                        <option value="checklist">Checklist</option>
                        <option value="disclosure">Disclosure</option>
                        <option value="media">Photo / Media</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="crm-filter-field">
                      <span>Tags</span>
                      <input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="contract, seller" />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="crm-btn crm-btn-primary" onClick={() => void saveEdit(doc.id)} disabled={editSaving}>
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
