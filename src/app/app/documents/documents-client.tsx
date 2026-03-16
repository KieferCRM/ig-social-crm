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
}: {
  deals: DealOption[];
  leads: LeadOption[];
}) {
  const [documents, setDocuments] = useState<WorkspaceDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [fileType, setFileType] = useState("agreement");
  const [status, setStatus] = useState("draft");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
  }, []);

  const recentDocuments = useMemo(() => documents.slice(0, 12), [documents]);

  async function uploadDocument() {
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

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

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Could not upload document.");
        return;
      }

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
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Could not remove document.");
        return;
      }
      setDocuments((previous) => previous.filter((document) => document.id !== id));
      setMessage("Document removed.");
    } catch {
      setMessage("Could not remove document.");
    }
  }

  return (
    <div className="crm-stack-12">
      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <div>
            <h2 className="crm-section-title">Upload documents</h2>
            <p className="crm-section-subtitle">
              Store agreements, contracts, checklists, and supporting files with the right deal.
            </p>
          </div>
        </div>

        <div className="crm-grid-cards-2">
          <label className="crm-filter-field">
            <span>Related deal</span>
            <select value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)}>
              <option value="">No deal selected</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.label}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Related contact</span>
            <select value={selectedLeadId} onChange={(event) => setSelectedLeadId(event.target.value)}>
              <option value="">No contact selected</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.label}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-filter-field">
            <span>Document type</span>
            <select value={fileType} onChange={(event) => setFileType(event.target.value)}>
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
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
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
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="agreement, seller, docs missing"
            />
          </label>

          <label className="crm-filter-field">
            <span>File</span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
            Keep the minimum viable system simple: upload, attach, filter, and reopen quickly.
          </div>
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

      <section className="crm-card crm-section-card crm-stack-10">
        <div className="crm-section-head">
          <h2 className="crm-section-title">Recent documents</h2>
        </div>

        {loading ? (
          <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading documents...</div>
        ) : null}

        {!loading && recentDocuments.length === 0 ? (
          <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
            No documents yet. Upload agreements, contracts, and checklist files here.
          </div>
        ) : null}

        <div className="crm-stack-8">
          {recentDocuments.map((document) => (
            <article key={document.id} className="crm-card-muted crm-stack-8" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="crm-stack-4">
                  <div style={{ fontWeight: 700 }}>{document.file_name}</div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                    {document.file_type} · {document.status} · {formatBytes(document.size_bytes)}
                  </div>
                </div>
                <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  {document.signed_url ? (
                    <a href={document.signed_url} target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">
                      Open
                    </a>
                  ) : null}
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void deleteDocument(document.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="crm-detail-grid">
                <div>
                  <div className="crm-detail-label">Deal</div>
                  <div>{deals.find((deal) => deal.id === document.deal_id)?.label || "Not linked"}</div>
                </div>
                <div>
                  <div className="crm-detail-label">Contact</div>
                  <div>{leads.find((lead) => lead.id === document.lead_id)?.label || "Not linked"}</div>
                </div>
                <div>
                  <div className="crm-detail-label">Uploaded</div>
                  <div>{formatDate(document.uploaded_at)}</div>
                </div>
                <div>
                  <div className="crm-detail-label">Tags</div>
                  <div>{document.tags.length > 0 ? document.tags.join(", ") : "No tags"}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
