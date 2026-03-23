"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";
import { sourceChannelLabel, sourceChannelTone } from "@/lib/inbound";
import ContactTagsEditor from "./contact-tags-editor";

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

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v?.trim()) return v.trim();
  }
  return null;
}

function contactName(c: ContactRow): string {
  const combined = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return (
    firstNonEmpty(c.full_name) ||
    firstNonEmpty(combined) ||
    firstNonEmpty(c.canonical_email) ||
    firstNonEmpty(c.canonical_phone) ||
    (c.ig_username ? `@${c.ig_username.replace(/^@+/, "")}` : "Unnamed contact")
  );
}

function timeAgo(value: string | null): string {
  if (!value) return "No activity";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const TEMP_TONES: Record<string, "lead-hot" | "lead-warm" | "lead-cold"> = {
  Hot: "lead-hot",
  Warm: "lead-warm",
  Cold: "lead-cold",
};

export default function ContactsList({
  contacts,
  deals,
  isOffMarketAccount,
}: {
  contacts: ContactRow[];
  deals: DealSummary[];
  isOffMarketAccount: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filterTemp, setFilterTemp] = useState("all");
  const [filterIntent, setFilterIntent] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        (c.canonical_phone ?? "").toLowerCase().includes(q) ||
        (c.canonical_email ?? "").toLowerCase().includes(q);
      const tempOk = filterTemp === "all" || c.lead_temp === filterTemp;
      const intentOk = filterIntent === "all" || c.intent === filterIntent;
      return nameOk && tempOk && intentOk;
    });
  }, [contacts, search, filterTemp, filterIntent]);

  return (
    <div className="crm-stack-10">
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email…"
          className="crm-input"
          style={{ maxWidth: 260, fontSize: 13 }}
          autoComplete="off"
        />
        <select
          value={filterTemp}
          onChange={(e) => setFilterTemp(e.target.value)}
          className="crm-input"
          style={{ fontSize: 13, width: "auto" }}
        >
          <option value="all">All temperatures</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
        </select>
        <select
          value={filterIntent}
          onChange={(e) => setFilterIntent(e.target.value)}
          className="crm-input"
          style={{ fontSize: 13, width: "auto" }}
        >
          <option value="all">All intents</option>
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
          <option value="Rent">Rent</option>
          <option value="Invest">Invest</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          {filtered.length} of {contacts.length}
        </span>
      </div>

      {/* List */}
      <div className="crm-stack-4">
        {filtered.length === 0 ? (
          <div className="crm-card-muted" style={{ padding: 16, color: "var(--ink-muted)" }}>
            {contacts.length === 0
              ? "No contacts yet. Intake forms, manual entry, and Secretary capture will populate this list automatically."
              : "No contacts match these filters."}
          </div>
        ) : null}

        {filtered.map((contact) => {
          const isExpanded = expandedId === contact.id;
          const linkedDeals = dealsByLead.get(contact.id) ?? [];
          const phone = contact.canonical_phone;
          const email = contact.canonical_email;

          return (
            <article key={contact.id} className="crm-card-muted" style={{ padding: "12px 16px" }}>
              {/* Compact row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}
                onClick={() => setExpandedId(isExpanded ? null : contact.id)}
              >
                {/* Name + contact */}
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {contactName(contact)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                    {phone ? (
                      <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--ink-muted)", textDecoration: "none" }}>
                        {phone}
                      </a>
                    ) : email ? (
                      <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--ink-muted)", textDecoration: "none" }}>
                        {email}
                      </a>
                    ) : (
                      "No contact info"
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {contact.lead_temp ? (
                    <StatusBadge label={contact.lead_temp} tone={TEMP_TONES[contact.lead_temp] ?? "default"} />
                  ) : null}
                  {contact.source ? (
                    <StatusBadge label={sourceChannelLabel(contact.source)} tone={sourceChannelTone(contact.source)} />
                  ) : null}
                  {linkedDeals.length > 0 ? (
                    <span className="crm-chip">{linkedDeals.length} deal{linkedDeals.length > 1 ? "s" : ""}</span>
                  ) : null}
                </div>

                {/* Last touch + chevron */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{timeAgo(contact.time_last_updated)}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)", userSelect: "none" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded ? (
                <div className="crm-stack-8" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div className="crm-detail-grid">
                    {phone ? (
                      <div>
                        <div className="crm-detail-label">Phone</div>
                        <a href={`tel:${phone}`} style={{ color: "var(--ink-primary)", textDecoration: "none", fontWeight: 500 }}>{phone}</a>
                      </div>
                    ) : null}
                    {email ? (
                      <div>
                        <div className="crm-detail-label">Email</div>
                        <a href={`mailto:${email}`} style={{ color: "var(--ink-primary)", textDecoration: "none", fontWeight: 500 }}>{email}</a>
                      </div>
                    ) : null}
                    <div>
                      <div className="crm-detail-label">Intent</div>
                      <div>{contact.intent || "—"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Timeline</div>
                      <div>{contact.timeline || "—"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Stage</div>
                      <div>{contact.stage || "New"}</div>
                    </div>
                    <div>
                      <div className="crm-detail-label">Last touch</div>
                      <div>{contact.time_last_updated
                        ? new Date(contact.time_last_updated).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "—"}
                      </div>
                    </div>
                  </div>

                  {linkedDeals.length > 0 ? (
                    <div>
                      <div className="crm-detail-label" style={{ marginBottom: 6 }}>Linked deals</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {linkedDeals.map((deal) => (
                          <Link key={deal.id} href="/app/pipeline" className="crm-chip">
                            {deal.property_address || "Untitled deal"}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="crm-detail-label" style={{ marginBottom: 6 }}>Tags</div>
                    <ContactTagsEditor
                      contactId={contact.id}
                      initialTags={contact.tags}
                      isOffMarketAccount={isOffMarketAccount}
                    />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
