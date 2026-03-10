import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeadDetail = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  source: string | null;
  source_ref_id: string | null;
  stage: string | null;
  lead_temp: string | null;
  intent: string | null;
  timeline: string | null;
  budget_range: string | null;
  location_area: string | null;
  contact_preference: string | null;
  next_step: string | null;
  notes: string | null;
  tags: string[] | null;
  last_message_preview: string | null;
  time_last_updated: string | null;
  created_at: string | null;
  source_detail: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isSyntheticHandle(handle: string | null): boolean {
  if (!handle) return false;
  const value = handle.trim().toLowerCase();
  if (!value) return false;
  if (/^(import|intake|manual|event)_lead_[0-9a-f]{8}$/.test(value)) return true;
  if (/^(import|intake|manual)_[a-z0-9_]+_[0-9a-f]{8}$/.test(value)) return true;
  return false;
}

function leadDisplayName(lead: LeadDetail): string {
  const full = firstNonEmpty(lead.full_name);
  if (full) return full;

  const first = firstNonEmpty(lead.first_name);
  const last = firstNonEmpty(lead.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;

  const email = firstNonEmpty(lead.canonical_email);
  if (email) return email;

  const phone = firstNonEmpty(lead.canonical_phone);
  if (phone) return phone;

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) {
    return `@${lead.ig_username}`;
  }

  return "Unnamed lead";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function asJson(value: unknown): string {
  return JSON.stringify(value || {}, null, 2);
}

function formatTags(value: string[] | null): string {
  if (!Array.isArray(value) || value.length === 0) return "-";
  return value.join(", ");
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,ig_username,full_name,first_name,last_name,canonical_email,canonical_phone,source,source_ref_id,stage,lead_temp,intent,timeline,budget_range,location_area,contact_preference,next_step,notes,tags,last_message_preview,time_last_updated,created_at,source_detail,custom_fields"
    )
    .eq("id", id)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (error) {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const lead = data as LeadDetail;
  const displayName = leadDisplayName(lead);

  return (
    <main className="crm-page" style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{displayName}</h1>
          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
            Full lead profile with source and custom field data.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/app" className="crm-btn crm-btn-secondary">
            Dashboard
          </Link>
          <Link href="/app/list" className="crm-btn crm-btn-secondary">
            Lead List
          </Link>
        </div>
      </div>

      <section className="crm-card" style={{ marginTop: 14, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="crm-chip">Stage: {lead.stage || "New"}</span>
          <span className="crm-chip">Temp: {lead.lead_temp || "Warm"}</span>
          <span className="crm-chip">Source: {lead.source || "-"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Name</div>
            <div style={{ marginTop: 4 }}>{firstNonEmpty(lead.full_name, `${lead.first_name || ""} ${lead.last_name || ""}`.trim()) || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Email</div>
            <div style={{ marginTop: 4 }}>{firstNonEmpty(lead.canonical_email) || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Phone</div>
            <div style={{ marginTop: 4 }}>{firstNonEmpty(lead.canonical_phone) || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Instagram</div>
            <div style={{ marginTop: 4 }}>
              {lead.ig_username && !isSyntheticHandle(lead.ig_username) ? `@${lead.ig_username}` : "-"}
            </div>
          </div>
        </div>
      </section>

      <section className="crm-card" style={{ marginTop: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Qualification Data</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Intent</div>
            <div style={{ marginTop: 4 }}>{lead.intent || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Timeline</div>
            <div style={{ marginTop: 4 }}>{lead.timeline || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Budget Range</div>
            <div style={{ marginTop: 4 }}>{lead.budget_range || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Location Area</div>
            <div style={{ marginTop: 4 }}>{lead.location_area || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Contact Preference</div>
            <div style={{ marginTop: 4 }}>{lead.contact_preference || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Next Step</div>
            <div style={{ marginTop: 4 }}>{lead.next_step || "-"}</div>
          </div>
        </div>
      </section>

      <section className="crm-card" style={{ marginTop: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Activity</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Last message preview</div>
            <div style={{ marginTop: 4 }}>{lead.last_message_preview || "-"}</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Notes</div>
            <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{lead.notes || "-"}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Tags</div>
              <div style={{ marginTop: 4 }}>{formatTags(lead.tags)}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>External ID</div>
              <div style={{ marginTop: 4 }}>{lead.source_ref_id || "-"}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Created</div>
              <div style={{ marginTop: 4 }}>{formatDate(lead.created_at)}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Last Updated</div>
              <div style={{ marginTop: 4 }}>{formatDate(lead.time_last_updated)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="crm-card" style={{ marginTop: 14, padding: 14, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Structured Source Data</h2>
        <pre className="crm-card-muted" style={{ margin: 0, padding: 12, overflow: "auto", fontSize: 12 }}>
          {asJson(lead.source_detail)}
        </pre>
      </section>

      <section className="crm-card" style={{ marginTop: 14, padding: 14, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Custom Fields</h2>
        <pre className="crm-card-muted" style={{ margin: 0, padding: 12, overflow: "auto", fontSize: 12 }}>
          {asJson(lead.custom_fields)}
        </pre>
      </section>
    </main>
  );
}
