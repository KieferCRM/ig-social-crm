"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/ui/status-badge";

type LeadForAsk = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  time_last_updated: string | null;
};

type Reminder = {
  id: string;
  lead_id: string | null;
  due_at: string;
  status: "pending" | "done";
  note: string | null;
};

type GuidancePriority = "Urgent" | "High" | "Normal";
type ContactMethod = "Call" | "SMS" | "Email";

type GuidanceItem = {
  leadId: string;
  leadName: string;
  reason: string;
  priority: GuidancePriority;
  action: ContactMethod;
};

function normalize(value: string | null | undefined, fallback: string): string {
  return (value || fallback).trim().toLowerCase();
}

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

function leadDisplayName(lead: LeadForAsk): string {
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

  if (lead.ig_username && !isSyntheticHandle(lead.ig_username)) return `@${lead.ig_username}`;
  return "Unnamed lead";
}

function daysSince(dateIso: string | null): number {
  if (!dateIso) return 999;
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return 999;
  return (Date.now() - ts) / (24 * 3600_000);
}

function leadTempRank(value: string | null): number {
  const temp = normalize(value, "warm");
  if (temp === "hot") return 3;
  if (temp === "warm") return 2;
  if (temp === "cold") return 1;
  return 1;
}

function topHottestLeads(leads: LeadForAsk[], limit = 3): LeadForAsk[] {
  return leads
    .filter((lead) => normalize(lead.stage, "new") !== "closed")
    .sort((a, b) => {
      const tempDiff = leadTempRank(b.lead_temp) - leadTempRank(a.lead_temp);
      if (tempDiff !== 0) return tempDiff;
      return (b.time_last_updated || "").localeCompare(a.time_last_updated || "");
    })
    .slice(0, limit);
}

function firstNameForMessage(lead: LeadForAsk): string {
  const first = firstNonEmpty(lead.first_name);
  if (first) return first;
  return leadDisplayName(lead).split(" ")[0] || "there";
}

function priorityRank(priority: GuidancePriority): number {
  if (priority === "Urgent") return 3;
  if (priority === "High") return 2;
  return 1;
}

function priorityTone(priority: GuidancePriority): "danger" | "warn" | "info" {
  if (priority === "Urgent") return "danger";
  if (priority === "High") return "warn";
  return "info";
}

function buildGuidance(leads: LeadForAsk[], reminders: Reminder[]): GuidanceItem[] {
  const now = Date.now();
  const reminderByLead = new Map<string, { overdue: number; dueSoon: number }>();
  for (const reminder of reminders) {
    if (!reminder.lead_id || reminder.status !== "pending") continue;
    const dueAt = new Date(reminder.due_at).getTime();
    const current = reminderByLead.get(reminder.lead_id) || { overdue: 0, dueSoon: 0 };
    if (dueAt < now) current.overdue += 1;
    if (dueAt >= now && dueAt < now + 24 * 3600_000) current.dueSoon += 1;
    reminderByLead.set(reminder.lead_id, current);
  }

  const guidance: GuidanceItem[] = [];

  for (const lead of leads) {
    if (normalize(lead.stage, "new") === "closed") continue;
    const staleDays = daysSince(lead.time_last_updated);
    const reminder = reminderByLead.get(lead.id) || { overdue: 0, dueSoon: 0 };
    const name = leadDisplayName(lead);

    if (reminder.overdue > 0) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `${reminder.overdue} follow-up reminder(s) are overdue and need attention.`,
        priority: "Urgent",
        action: "Call",
      });
      continue;
    }

    if (normalize(lead.stage, "new") === "new") {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason:
          staleDays <= 1
            ? "New lead submitted recently. Fast response keeps momentum."
            : "New lead has not been contacted yet.",
        priority: staleDays > 1 ? "Urgent" : "High",
        action: "Call",
      });
      continue;
    }

    if (normalize(lead.lead_temp, "warm") === "hot" && staleDays >= 2) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `Hot lead has been inactive for ${Math.round(staleDays)} day(s).`,
        priority: "Urgent",
        action: "Call",
      });
      continue;
    }

    if (normalize(lead.lead_temp, "warm") === "warm" && staleDays >= 2) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `Warm lead has not been touched for ${Math.round(staleDays)} day(s).`,
        priority: "High",
        action: "SMS",
      });
      continue;
    }

    if (reminder.dueSoon > 0) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `${reminder.dueSoon} follow-up due within 24 hours.`,
        priority: "High",
        action: "SMS",
      });
      continue;
    }

    if (staleDays >= 4) {
      guidance.push({
        leadId: lead.id,
        leadName: name,
        reason: `No recent activity for ${Math.round(staleDays)} day(s).`,
        priority: "Normal",
        action: "Email",
      });
    }
  }

  return guidance
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 5);
}

function buildWeeklyFollowUpDraft(leads: LeadForAsk[], guidance: GuidanceItem[]): string {
  const fromGuidance = guidance
    .filter((item) => item.priority === "Urgent" || item.priority === "High")
    .slice(0, 3)
    .map((item) => leads.find((lead) => lead.id === item.leadId))
    .filter((lead): lead is LeadForAsk => Boolean(lead));

  const selected = fromGuidance.length > 0 ? fromGuidance : topHottestLeads(leads, 3);
  if (selected.length === 0) {
    return "No active leads found yet. Once leads are added, I can draft weekly follow-ups from your hottest contacts.";
  }

  const names = selected.map((lead) => leadDisplayName(lead)).join(", ");
  const sampleName = firstNameForMessage(selected[0]);

  return [
    `Target this week: ${names}.`,
    "Suggested follow-up draft:",
    `Hi ${sampleName}, just checking in this week to see where you are in your home search and what would be most helpful next. If you'd like, I can send a few options that match what you're looking for.`,
  ].join("\n");
}

function answerAskMerlyn(question: string, leads: LeadForAsk[], reminders: Reminder[], guidance: GuidanceItem[]): string {
  const lower = question.toLowerCase();
  const activeLeads = leads.filter((lead) => normalize(lead.stage, "new") !== "closed");

  if (activeLeads.length === 0) {
    return "You have no active leads yet. Start with your intake form or import to begin getting daily guidance.";
  }

  if (lower.includes("write") || lower.includes("draft")) {
    return buildWeeklyFollowUpDraft(leads, guidance);
  }

  if (lower.includes("hot")) {
    const hottest = topHottestLeads(leads, 3);
    return hottest
      .map((lead, index) => {
        const stale = Math.max(0, Math.round(daysSince(lead.time_last_updated)));
        const temp = normalize(lead.lead_temp, "warm");
        return `${index + 1}. ${leadDisplayName(lead)} (${temp})${stale > 0 ? ` - last activity ${stale} day(s) ago` : " - active today"}`;
      })
      .join("\n");
  }

  if (lower.includes("follow-up") || lower.includes("follow up")) {
    const now = Date.now();
    const dueItems = reminders
      .filter((item) => item.status === "pending")
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    if (dueItems.length === 0) {
      return "No pending follow-ups are due right now. Focus on new leads and warm re-engagement.";
    }
    return dueItems
      .slice(0, 3)
      .map((item, index) => {
        const lead = leads.find((candidate) => candidate.id === item.lead_id);
        const name = lead ? leadDisplayName(lead) : "Unknown lead";
        const dueTs = new Date(item.due_at).getTime();
        const timing = dueTs < now ? "overdue" : "due soon";
        return `${index + 1}. ${name} - ${timing}`;
      })
      .join("\n");
  }

  if (lower.includes("next")) {
    const top = guidance[0];
    if (!top) return "You are caught up. Review intake responses and schedule fresh follow-ups for warm leads.";
    return `${top.action} ${top.leadName} (${top.priority}). ${top.reason}`;
  }

  const top = guidance[0];
  if (!top) return "You are in a good spot. Keep checking new intake submissions and prioritize warm leads every morning.";
  return `Top priority: ${top.action} ${top.leadName} (${top.priority}). ${top.reason}`;
}

export default function AskMerlynCard({ leads }: { leads: LeadForAsk[] }) {
  const [askQuestion, setAskQuestion] = useState("");
  const [askResponse, setAskResponse] = useState("Ask Merlyn what to prioritize today.");
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    async function loadReminders() {
      try {
        const response = await fetch("/api/reminders");
        const data = (await response.json()) as { reminders?: Reminder[] };
        if (!response.ok) return;
        setReminders((data.reminders || []).filter((item) => item.status === "pending"));
      } catch {
        setReminders([]);
      }
    }

    void loadReminders();
  }, []);

  const guidance = useMemo(() => buildGuidance(leads, reminders), [leads, reminders]);

  function runAskMerlyn(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question) {
      setAskResponse("Enter a question, or tap one of the quick prompts.");
      return;
    }
    setAskQuestion(question);
    setAskResponse(answerAskMerlyn(question, leads, reminders, guidance));
  }

  return (
    <section className="crm-card crm-utility-card crm-dashboard-secondary-card">
      <div className="crm-section-head">
        <h2 className="crm-section-title">Merlyn Assistant</h2>
        <p className="crm-section-subtitle">Pipeline Intelligence</p>
      </div>

      <div className="crm-stack-8" style={{ marginTop: 8 }}>
        <div className="crm-stack-8">
          <div style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-faint)", fontWeight: 700 }}>
            Suggested Actions
          </div>
          {guidance.length === 0 ? (
            <div className="crm-card-muted" style={{ padding: 8, fontSize: 12, color: "var(--ink-muted)" }}>
              No urgent actions right now.
            </div>
          ) : (
            guidance.slice(0, 3).map((item) => {
              return (
                <article key={`${item.leadId}-${item.reason}`} className="crm-card-muted" style={{ padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.leadName}</div>
                    <StatusBadge label={item.priority} tone={priorityTone(item.priority)} />
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-muted)" }}>{item.reason}</div>
                  <div className="crm-card-actions" style={{ marginTop: 6 }}>
                    <Link href={`/app/leads/${item.leadId}`} className="crm-btn crm-btn-secondary" style={{ padding: "5px 8px", fontSize: 11 }}>
                      Open Lead
                    </Link>
                    <span className="crm-chip">Calls live in Merlyn Concierge</span>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="crm-stack-8" style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-faint)", fontWeight: 700 }}>
            Ask Merlyn
          </div>
          <div className="crm-inline-actions">
            {[
              "What should I do next?",
              "Which leads are hottest?",
              "Write a follow-up for this week",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ padding: "5px 8px", fontSize: 11 }}
                onClick={() => runAskMerlyn(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              runAskMerlyn(askQuestion);
            }}
            className="crm-inline-actions"
          >
            <input
              type="text"
              value={askQuestion}
              onChange={(event) => setAskQuestion(event.target.value)}
              placeholder="Ask Merlyn about your leads"
              style={{
                flex: 1,
                minWidth: 220,
                padding: "8px 10px",
              }}
            />
            <button type="submit" className="crm-btn crm-btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }}>
              Ask
            </button>
          </form>

          <div className="crm-card-muted" style={{ padding: 8 }}>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "pre-wrap" }}>{askResponse}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
