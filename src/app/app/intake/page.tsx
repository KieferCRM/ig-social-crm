"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { QuestionnaireConfig } from "@/lib/questionnaire";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";

type HealthResponse = {
  db?: string;
  ingestion_queue?: {
    received?: number;
    failed?: number;
    dlq?: number;
    received_older_than_5m?: number;
  };
  alerts?: {
    has_dlq?: boolean;
    has_stuck_received?: boolean;
  };
  error?: string;
};

type QuestionnaireResponse = {
  config?: QuestionnaireConfig;
  error?: string;
};

type LeadListResponse = {
  leads?: Array<{ id: string; source: string | null; time_last_updated: string | null }>;
};

export default function LeadIntakeHubPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireConfig | null>(null);
  const [recentImportCount, setRecentImportCount] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const [intakeUrl, setIntakeUrl] = useState("/intake");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [healthResponse, questionnaireResponse, leadsResponse] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/questionnaire"),
          fetch("/api/leads/simple"),
        ]);

        const healthData = (await healthResponse.json()) as HealthResponse;
        if (healthResponse.ok) {
          setHealth(healthData);
        } else {
          setHealth(null);
          setError(healthData.error || "Could not load intake health.");
        }

        const questionnaireData = (await questionnaireResponse.json()) as QuestionnaireResponse;
        if (questionnaireResponse.ok) {
          setQuestionnaire(questionnaireData.config || null);
        } else {
          setQuestionnaire(null);
          setError((prev) => prev || questionnaireData.error || "Could not load questionnaire config.");
        }

        const leadData = (await leadsResponse.json()) as LeadListResponse;
        if (leadsResponse.ok && Array.isArray(leadData.leads)) {
          const sevenDaysAgo = Date.now() - 7 * 24 * 3600_000;
          const importLeads = leadData.leads.filter((lead) => {
            const source = (lead.source || "").toLowerCase();
            const updatedAt = lead.time_last_updated ? new Date(lead.time_last_updated).getTime() : 0;
            return source.includes("import") && updatedAt >= sevenDaysAgo;
          });
          setRecentImportCount(importLeads.length);
        }
      } catch {
        setError("Could not load lead intake hub.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIntakeUrl(`${window.location.origin}/intake`);
  }, []);

  const questionCount = questionnaire?.questions.length || 0;
  const requiredCount = questionnaire?.questions.filter((question) => question.required).length || 0;

  const mappingReady = useMemo(() => {
    if (!questionnaire) return false;
    return questionnaire.questions.some((question) =>
      ["full_name", "email", "phone", "ig_username"].includes(question.crm_field)
    );
  }, [questionnaire]);

  const queueHealthy = Boolean(
    health &&
      !health.alerts?.has_dlq &&
      !health.alerts?.has_stuck_received &&
      (health.ingestion_queue?.failed || 0) === 0
  );

  async function copyIntakeLink() {
    try {
      await navigator.clipboard.writeText(intakeUrl);
      setCopyMessage("Copied");
      window.setTimeout(() => setCopyMessage(""), 1500);
    } catch {
      setCopyMessage("Copy failed");
      window.setTimeout(() => setCopyMessage(""), 1800);
    }
  }

  return (
    <main className="crm-page" style={{ maxWidth: 1120, display: "grid", gap: 12 }}>
      <section className="crm-card" style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>Lead Intake Hub</h1>
        <p style={{ marginTop: 8, color: "var(--ink-muted)", maxWidth: 800 }}>
          This is where leads enter Merlyn. Build your intake funnel, share your lead capture link, and import existing contacts from CSV in one place.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <article className="crm-card" style={{ padding: 16, display: "grid", gap: 10, minHeight: 188 }}>
          <div className="crm-chip crm-chip-info" style={{ width: "fit-content" }}>Primary Action</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Build Funnel</div>
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>
            Design your questionnaire and map answers into your CRM fields.
          </div>
          <div style={{ marginTop: "auto" }}>
            <Link href="/app/intake/questionnaire" className="crm-btn crm-btn-primary">Open Funnel Builder</Link>
          </div>
        </article>

        <article className="crm-card" style={{ padding: 16, display: "grid", gap: 10, minHeight: 188 }}>
          <div className="crm-chip crm-chip-info" style={{ width: "fit-content" }}>Primary Action</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Share Intake Form</div>
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>
            Open your live intake page and share it anywhere leads find you.
          </div>
          <div style={{ marginTop: "auto" }}>
            <Link href="/intake" className="crm-btn crm-btn-primary" target="_blank" rel="noreferrer">Open Live Intake</Link>
          </div>
        </article>

        <article className="crm-card" style={{ padding: 16, display: "grid", gap: 10, minHeight: 188 }}>
          <div className="crm-chip crm-chip-info" style={{ width: "fit-content" }}>Primary Action</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Import Leads</div>
          <div style={{ color: "var(--ink-muted)", fontSize: 14 }}>
            Bring in your existing lead list from CSV with clear review and results.
          </div>
          <div style={{ marginTop: "auto" }}>
            <Link href="/app/intake/import" className="crm-btn crm-btn-primary">Open CSV Import</Link>
          </div>
        </article>
      </section>

      <section className="crm-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>How Lead Intake Works</div>
        <p style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: 14 }}>
          Set up your funnel once, share your link, and let Merlyn organize new and imported leads into your pipeline.
        </p>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div className="crm-card-muted" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Step 1</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>Build Funnel</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>Choose your intake questions and required fields.</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Step 2</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>Capture Leads</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>Leads submit your form or get imported from CSV.</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Step 3</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>Map Into CRM</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>Answers and import data fill your CRM fields automatically.</div>
          </div>
          <div className="crm-card-muted" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Step 4</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>Work The Pipeline</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-muted)" }}>Follow up quickly from your dashboard, leads list, and pipeline.</div>
          </div>
        </div>
      </section>

      <section className="crm-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Lead Capture Link</div>
        <p style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: 14 }}>
          Share this link in your bio, ads, DMs, and email campaigns.
        </p>
        <div className="crm-card-muted" style={{ marginTop: 10, padding: 12, display: "grid", gap: 10 }}>
          <code style={{ wordBreak: "break-all" }}>{intakeUrl}</code>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="crm-btn crm-btn-secondary" onClick={() => void copyIntakeLink()}>Copy Link</button>
            <Link href="/intake" className="crm-btn crm-btn-primary" target="_blank" rel="noreferrer">Open Form</Link>
            {copyMessage ? (
              <span className={`crm-chip ${copyMessage === "Copied" ? "crm-chip-ok" : "crm-chip-danger"}`}>{copyMessage}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Questions</div>
          <div style={{ marginTop: 5, fontWeight: 800, fontSize: 26 }}>{questionCount}</div>
        </div>
        <div className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Required Questions</div>
          <div style={{ marginTop: 5, fontWeight: 800, fontSize: 26 }}>{requiredCount}</div>
        </div>
        <div className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Imports (7 Days)</div>
          <div style={{ marginTop: 5, fontWeight: 800, fontSize: 26 }}>{recentImportCount}</div>
        </div>
        <div className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Mapping Status</div>
          <div style={{ marginTop: 8 }}>
            <StatusBadge label={mappingReady ? "Ready" : "Needs Update"} tone={mappingReady ? "ok" : "warn"} />
          </div>
        </div>
        <div className="crm-card-muted" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Lead Intake Link</div>
          <div style={{ marginTop: 8 }}>
            <StatusBadge label="Live" tone="ok" />
          </div>
        </div>
      </section>

      <section className="crm-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Ingestion Health</div>
          <StatusBadge label={queueHealthy ? "Healthy" : "Needs Attention"} tone={queueHealthy ? "ok" : "danger"} />
        </div>
        <p style={{ marginTop: 8, color: "var(--ink-muted)", fontSize: 14 }}>
          This section shows whether lead data is flowing in cleanly.
        </p>

        {loading ? (
          <div style={{ marginTop: 10, color: "var(--ink-muted)" }}>Loading ingestion health...</div>
        ) : health ? (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Database</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{health.db || "Unknown"}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Leads Received</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{health.ingestion_queue?.received || 0}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Failed Events</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{health.ingestion_queue?.failed || 0}</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Needs Manual Review</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{health.ingestion_queue?.dlq || 0}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "var(--ink-muted)" }}>Diagnostic queue (DLQ)</div>
            </div>
            <div className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Waiting Over 5 Minutes</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{health.ingestion_queue?.received_older_than_5m || 0}</div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <EmptyState title="Ingestion health unavailable" body={error || "Could not load ingestion health."} />
          </div>
        )}
      </section>
    </main>
  );
}
