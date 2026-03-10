"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FEATURE_AUTOMATION_UI_ENABLED, PRODUCT_NAME } from "@/lib/features";

type AutomationSettings = {
  intent_enabled: boolean;
  intent_question: string;
  timeline_enabled: boolean;
  timeline_question: string;
  budget_range_enabled: boolean;
  budget_range_question: string;
  location_area_enabled: boolean;
  location_area_question: string;
  contact_preference_enabled: boolean;
  contact_preference_question: string;
  next_step_enabled: boolean;
  next_step_question: string;
  completion_message: string;
};

type AutomationRule = {
  id: string;
  trigger_event: "lead_created";
  enabled: boolean;
  condition_stage: string | null;
  condition_lead_temp: string | null;
  delay_hours: number;
  reminder_note: string | null;
};

type RuleDraft = {
  condition_stage: string;
  condition_lead_temp: string;
  delay_hours: number;
  reminder_note: string;
};

const DEFAULTS: AutomationSettings = {
  intent_enabled: true,
  intent_question: "What are you looking for exactly (buy/sell/invest)?",
  timeline_enabled: true,
  timeline_question: "What is your ideal timeline to move?",
  budget_range_enabled: true,
  budget_range_question: "What budget range are you targeting?",
  location_area_enabled: true,
  location_area_question: "Which location or neighborhood is best for you?",
  contact_preference_enabled: true,
  contact_preference_question: "How do you prefer we stay in touch?",
  next_step_enabled: true,
  next_step_question: "What is the best next step for you right now?",
  completion_message: "Great, you are qualified. I can help with next steps now.",
};

const BUCKETS: Array<{ key: keyof AutomationSettings; question: keyof AutomationSettings; label: string }> = [
  { key: "intent_enabled", question: "intent_question", label: "Intent" },
  { key: "timeline_enabled", question: "timeline_question", label: "Timeline" },
  { key: "budget_range_enabled", question: "budget_range_question", label: "Budget/Price Range" },
  { key: "location_area_enabled", question: "location_area_question", label: "Location/Area" },
  { key: "contact_preference_enabled", question: "contact_preference_question", label: "Contact Preference" },
  { key: "next_step_enabled", question: "next_step_question", label: "Next Step" },
];

const PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  values: AutomationSettings;
}> = [
  {
    id: "off_market_buyer",
    name: "Off-Market Buyer",
    description: "Designed for high-intent buyers asking about inventory and timeline.",
    values: {
      intent_enabled: true,
      intent_question: "Are you buying for a primary home, investment, or both?",
      timeline_enabled: true,
      timeline_question: "How quickly do you want to purchase?",
      budget_range_enabled: true,
      budget_range_question: "What is your ideal budget range?",
      location_area_enabled: true,
      location_area_question: "Which neighborhoods are your top priorities?",
      contact_preference_enabled: true,
      contact_preference_question: "Do you prefer text, call, or email for updates?",
      next_step_enabled: true,
      next_step_question: "Would you like me to send available off-market matches now?",
      completion_message: "Perfect. I can send matching opportunities and book a quick strategy call.",
    },
  },
  {
    id: "off_market_seller",
    name: "Off-Market Seller",
    description: "Focused on motivation, timeline, and private-sale readiness.",
    values: {
      intent_enabled: true,
      intent_question: "Are you exploring a private sale, full listing, or comparing both?",
      timeline_enabled: true,
      timeline_question: "What timeline are you targeting for selling?",
      budget_range_enabled: true,
      budget_range_question: "What price range do you expect your property to land in?",
      location_area_enabled: true,
      location_area_question: "What area is the property located in?",
      contact_preference_enabled: true,
      contact_preference_question: "What is the best way to reach you for updates?",
      next_step_enabled: true,
      next_step_question: "Would you like a private-value strategy call this week?",
      completion_message: "Great. Next step is a short strategy call so we can map your best sale path.",
    },
  },
  {
    id: "minimal_fast_capture",
    name: "Minimal Fast Capture",
    description: "Shortest sequence for high DM volume when speed matters most.",
    values: {
      intent_enabled: true,
      intent_question: "Are you buying, selling, or investing?",
      timeline_enabled: true,
      timeline_question: "When are you looking to move?",
      budget_range_enabled: true,
      budget_range_question: "What budget range are you targeting?",
      location_area_enabled: false,
      location_area_question: "Which location or neighborhood is best for you?",
      contact_preference_enabled: false,
      contact_preference_question: "How do you prefer we stay in touch?",
      next_step_enabled: true,
      next_step_question: "Do you want me to send options and book a quick call?",
      completion_message: "Awesome, I have what I need. I can send matches and lock in a quick call.",
    },
  },
];

function buildPreview(settings: AutomationSettings): string[] {
  const lines: string[] = ["Agent: Thanks for reaching out. I can help quickly."];
  for (const bucket of BUCKETS) {
    if (settings[bucket.key]) {
      lines.push(`Agent: ${settings[bucket.question]}`);
      lines.push("Lead: [example response]");
    }
  }
  lines.push(`Agent: ${settings.completion_message}`);
  return lines;
}

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULTS);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleMessage, setRuleMessage] = useState("");
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>({
    condition_stage: "",
    condition_lead_temp: "",
    delay_hours: 24,
    reminder_note: "New lead needs follow-up.",
  });
  const previewLines = buildPreview(settings);

  useEffect(() => {
    if (!FEATURE_AUTOMATION_UI_ENABLED) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [settingsResponse, rulesResponse] = await Promise.all([
          fetch("/api/automation/settings"),
          fetch("/api/automation/rules"),
        ]);

        const settingsData = (await settingsResponse.json()) as { settings?: Partial<AutomationSettings>; error?: string };
        if (!settingsResponse.ok) {
          setMessage(settingsData.error || "Could not load automation settings.");
          setLoading(false);
          return;
        }

        setSettings({ ...DEFAULTS, ...(settingsData.settings || {}) });

        const rulesData = (await rulesResponse.json()) as { rules?: AutomationRule[]; error?: string };
        if (rulesResponse.ok) {
          setRules(rulesData.rules || []);
        } else {
          setRuleMessage(rulesData.error || "Rules unavailable (apply step 19 SQL in Supabase).");
        }
      } catch {
        setMessage("Could not load automation settings.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (!FEATURE_AUTOMATION_UI_ENABLED) {
    return (
      <main className="crm-page" style={{ maxWidth: 760 }}>
        <div className="crm-card" style={{ padding: 16 }}>
          <h1 style={{ margin: 0 }}>Automation</h1>
          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
            Automation settings are hidden right now while core CRM workflows are being finalized.
          </p>
          <Link href="/app" className="crm-btn crm-btn-secondary" style={{ marginTop: 10 }}>
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error || "Could not save automation settings.");
        return;
      }
      setMessage("Automation settings saved.");
    } catch {
      setMessage("Could not save automation settings.");
    } finally {
      setSaving(false);
    }
  }

  async function createRule() {
    setRuleSaving(true);
    setRuleMessage("");
    try {
      const response = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_event: "lead_created",
          enabled: true,
          condition_stage: ruleDraft.condition_stage || null,
          condition_lead_temp: ruleDraft.condition_lead_temp || null,
          delay_hours: ruleDraft.delay_hours,
          reminder_note: ruleDraft.reminder_note,
        }),
      });
      const data = (await response.json()) as { rule?: AutomationRule; error?: string };
      if (!response.ok || !data.rule) {
        setRuleMessage(data.error || "Could not create rule.");
        return;
      }
      setRules((prev) => [...prev, data.rule as AutomationRule]);
      setRuleMessage("Rule created.");
    } catch {
      setRuleMessage("Could not create rule.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function toggleRule(rule: AutomationRule) {
    setRuleSaving(true);
    setRuleMessage("");
    try {
      const response = await fetch(`/api/automation/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = (await response.json()) as { rule?: AutomationRule; error?: string };
      if (!response.ok || !data.rule) {
        setRuleMessage(data.error || "Could not update rule.");
        return;
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? (data.rule as AutomationRule) : r)));
    } catch {
      setRuleMessage("Could not update rule.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function deleteRule(id: string) {
    setRuleSaving(true);
    setRuleMessage("");
    try {
      const response = await fetch(`/api/automation/rules/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setRuleMessage(data.error || "Could not delete rule.");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setRuleMessage("Could not delete rule.");
    } finally {
      setRuleSaving(false);
    }
  }

  if (loading) {
    return <main className="crm-page">Loading automation settings...</main>;
  }

  return (
    <main className="crm-page" style={{ maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Automation</h1>
      <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
        Configure qualification prompts so {PRODUCT_NAME} asks the next missing field automatically.
      </p>

      <div style={{ marginTop: 16 }} className="crm-grid">
        {BUCKETS.map((bucket) => (
          <div key={bucket.key} className="crm-card" style={{ padding: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={Boolean(settings[bucket.key])}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    [bucket.key]: e.target.checked,
                  }))
                }
                style={{ width: 18, height: 18 }}
              />
              {bucket.label}
            </label>

            <div style={{ marginTop: 8 }}>
              <input
                value={String(settings[bucket.question] || "")}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    [bucket.question]: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="crm-card" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ fontWeight: 700 }}>Real Estate Presets</div>
        <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
          Start with a proven script, then customize.
        </div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {PRESETS.map((preset) => (
            <div key={preset.id} className="crm-card-muted" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700 }}>{preset.name}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>{preset.description}</div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => setSettings(preset.values)}
              >
                Apply preset
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="crm-card" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}>Completion message</div>
        <textarea
          rows={3}
          value={settings.completion_message}
          onChange={(e) => setSettings((prev) => ({ ...prev, completion_message: e.target.value }))}
        />
      </div>

      <div className="crm-card" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ fontWeight: 700 }}>Live DM Flow Preview</div>
        <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
          This shows the exact sequence your lead sees when automation is active.
        </div>
        <div className="crm-card-muted" style={{ marginTop: 10, padding: 10, display: "grid", gap: 8 }}>
          {previewLines.map((line, idx) => (
            <div
              key={`${line}-${idx}`}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: line.startsWith("Agent:") ? "var(--surface)" : "var(--surface-strong)",
                fontSize: 13,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="crm-card" style={{ marginTop: 14, padding: 12 }}>
        <div style={{ fontWeight: 700 }}>Autopilot Reminder Rules</div>
        <div style={{ marginTop: 4, color: "var(--ink-muted)", fontSize: 13 }}>
          Automatically create reminders when a new lead is added (manual or CSV import).
        </div>

        <div className="crm-card-muted" style={{ marginTop: 10, padding: 10, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <select
              value={ruleDraft.condition_stage}
              onChange={(e) => setRuleDraft((prev) => ({ ...prev, condition_stage: e.target.value }))}
            >
              <option value="">Any stage</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Closed">Closed</option>
            </select>
            <select
              value={ruleDraft.condition_lead_temp}
              onChange={(e) => setRuleDraft((prev) => ({ ...prev, condition_lead_temp: e.target.value }))}
            >
              <option value="">Any temperature</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
            <input
              type="number"
              min={1}
              max={720}
              value={ruleDraft.delay_hours}
              onChange={(e) => setRuleDraft((prev) => ({ ...prev, delay_hours: Number(e.target.value || 24) }))}
              placeholder="Delay hours"
            />
          </div>
          <textarea
            rows={2}
            value={ruleDraft.reminder_note}
            onChange={(e) => setRuleDraft((prev) => ({ ...prev, reminder_note: e.target.value }))}
            placeholder="Reminder note"
          />
          <div>
            <button onClick={createRule} disabled={ruleSaving} className="crm-btn crm-btn-secondary">
              {ruleSaving ? "Saving..." : "Add Rule"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {rules.length === 0 ? (
            <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>No rules yet.</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="crm-card-muted" style={{ padding: 10, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>
                    Lead Created • {rule.condition_stage || "Any Stage"} • {rule.condition_lead_temp || "Any Temp"} • {rule.delay_hours}h
                  </div>
                  <span className={`crm-chip ${rule.enabled ? "crm-chip-ok" : "crm-chip-warn"}`}>
                    {rule.enabled ? "Enabled" : "Paused"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Note: {rule.reminder_note || "Automated follow-up reminder"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="crm-btn crm-btn-secondary" onClick={() => toggleRule(rule)} disabled={ruleSaving}>
                    {rule.enabled ? "Pause" : "Enable"}
                  </button>
                  <button className="crm-btn crm-btn-secondary" onClick={() => deleteRule(rule.id)} disabled={ruleSaving}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {ruleMessage ? (
          <div style={{ marginTop: 10 }} className={`crm-chip ${ruleMessage.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}>
            {ruleMessage}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary">
          {saving ? "Saving..." : "Save Automation"}
        </button>
        {message ? (
          <span className={`crm-chip ${message.includes("Could") ? "crm-chip-danger" : "crm-chip-ok"}`}>
            {message}
          </span>
        ) : null}
      </div>
    </main>
  );
}
