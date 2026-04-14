"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Intent = "Buying" | "Selling" | "Both" | "";

type Step1 = {
  full_name: string;
  phone: string;
  intent: Intent;
};

type Step2Buying = {
  email: string;
  location_area: string;
  budget_range: string;
  financing_status: string;
  timeline: string;
  motivation: string;
  decision_makers: string;
  blocker: string;
  contact_preference: string;
  referral_source: string;
};

type Step2Selling = {
  email: string;
  property_address: string;
  property_type: string;
  timeline: string;
  asking_price: string;
  motivation: string;
  decision_makers: string;
  contact_preference: string;
  referral_source: string;
};

type Step2Both = {
  email: string;
  property_address: string;
  location_area: string;
  budget_range: string;
  timeline: string;
  motivation: string;
  decision_makers: string;
  contact_preference: string;
  referral_source: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMELINE_OPTIONS = [
  "ASAP",
  "Within 30 days",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "No rush / Just exploring",
];

const BUDGET_OPTIONS = [
  "Under $200k",
  "$200k–$350k",
  "$350k–$500k",
  "$500k–$750k",
  "$750k–$1M",
  "$1M+",
];

const PROPERTY_TYPE_OPTIONS = [
  "Single Family Home",
  "Condo / Townhome",
  "Multi-Family",
  "Land Only",
  "Commercial",
  "Other",
];

const REFERRAL_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "Google",
  "Friend or referral",
  "Yard sign",
  "Open house",
  "Other",
];

// ── Field helpers ──────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`crm-public-intake-field${full ? " crm-public-intake-field-full" : ""}`}>
      <span>
        {label}
        {required ? <span style={{ color: "var(--danger, #dc2626)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select one</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressDots({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {[1, 2].map((s) => (
        <div
          key={s}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 9999,
            background: s <= step ? "var(--brand, #16a34a)" : "var(--border, #e2e8f0)",
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// ── Step 1 ─────────────────────────────────────────────────────────────────────

function Step1Form({
  agentSlug,
  onComplete,
}: {
  agentSlug: string;
  onComplete: (leadId: string, intent: Intent) => void;
}) {
  const [form, setForm] = useState<Step1>({ full_name: "", phone: "", intent: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof Step1, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit = form.full_name.trim() && form.phone.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentSlug,
          source: "contact_form",
          form_variant: "smart_form",
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          intent: form.intent || null,
          sms_consent: smsConsent,
          questionnaire_answers: {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            intent: form.intent || "",
          },
        }),
      });
      const data = await res.json() as { ok?: boolean; lead_id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      onComplete(data.lead_id!, form.intent);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
      <ProgressDots step={1} />

      <div className="crm-public-intake-hero">
        <h2 style={{ margin: 0 }}>Let&apos;s get started</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          Drop your info and we&apos;ll follow up — no pressure.
        </p>
      </div>

      <div className="crm-public-intake-grid">
        <Field label="Full Name" required full>
          <input
            type="text"
            value={form.full_name}
            placeholder="Jane Smith"
            onChange={(e) => set("full_name", e.target.value)}
          />
        </Field>

        <Field label="Phone Number" required full>
          <input
            type="tel"
            value={form.phone}
            placeholder="(615) 555-0100"
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>

        <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
          <legend>What brings you here?</legend>
          <div className="crm-smart-form-intent-row">
            {(["Buying", "Selling", "Both"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`crm-smart-form-intent-chip${form.intent === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                onClick={() => set("intent", form.intent === opt ? "" : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div> : null}

      <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>
          Your information is kept private and only shared with the agent.
        </p>
        <button
          type="submit"
          className="crm-btn crm-btn-primary"
          disabled={saving || !canSubmit || !smsConsent}
        >
          {saving ? "One moment..." : "Continue"}
        </button>
      </div>

      <div className="crm-public-intake-consent">
        <label className="crm-public-intake-consent-checkbox">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
          />
          <span>
            I agree to receive text messages regarding my inquiry, including automated responses.
          </span>
        </label>
        <p className="crm-public-intake-consent-disclosure">
          By providing your phone number and submitting this form, you consent to receive text
          messages from the agent. Message frequency varies. Message and data rates may apply.
          Reply STOP to unsubscribe. Reply HELP for help. Consent is not a condition of purchase.
        </p>
      </div>
    </form>
  );
}

// ── Step 2 ─────────────────────────────────────────────────────────────────────

function Step2Form({
  leadId,
  intent,
  onComplete,
  onSkip,
}: {
  leadId: string;
  intent: Intent;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [buying, setBuying] = useState<Step2Buying>({
    email: "", location_area: "", budget_range: "", financing_status: "", timeline: "",
    motivation: "", decision_makers: "", blocker: "", contact_preference: "", referral_source: "",
  });
  const [selling, setSelling] = useState<Step2Selling>({
    email: "", property_address: "", property_type: "", timeline: "", asking_price: "",
    motivation: "", decision_makers: "", contact_preference: "", referral_source: "",
  });
  const [both, setBoth] = useState<Step2Both>({
    email: "", property_address: "", location_area: "", budget_range: "", timeline: "",
    motivation: "", decision_makers: "", contact_preference: "", referral_source: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: Record<string, string | null> = { lead_id: leadId };

    if (intent === "Buying") {
      payload.email = buying.email || null;
      payload.location_area = buying.location_area || null;
      payload.budget_range = buying.budget_range || null;
      payload.financing_status = buying.financing_status || null;
      payload.timeline = buying.timeline || null;
      payload.motivation = buying.motivation || null;
      payload.decision_makers = buying.decision_makers || null;
      payload.blocker = buying.blocker || null;
      payload.contact_preference = buying.contact_preference || null;
      payload.referral_source = buying.referral_source || null;
      payload.intent = "Buying";
    } else if (intent === "Selling") {
      payload.email = selling.email || null;
      payload.property_address = selling.property_address || null;
      payload.property_type = selling.property_type || null;
      payload.timeline = selling.timeline || null;
      payload.asking_price = selling.asking_price || null;
      payload.motivation = selling.motivation || null;
      payload.decision_makers = selling.decision_makers || null;
      payload.contact_preference = selling.contact_preference || null;
      payload.referral_source = selling.referral_source || null;
      payload.intent = "Selling";
    } else {
      payload.email = both.email || null;
      payload.property_address = both.property_address || null;
      payload.location_area = both.location_area || null;
      payload.budget_range = both.budget_range || null;
      payload.timeline = both.timeline || null;
      payload.motivation = both.motivation || null;
      payload.decision_makers = both.decision_makers || null;
      payload.contact_preference = both.contact_preference || null;
      payload.referral_source = both.referral_source || null;
      payload.intent = "Both";
    }

    try {
      const res = await fetch("/api/intake/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const title = intent === "Buying"
    ? "Tell us what you're looking for"
    : intent === "Selling"
    ? "Tell us about your property"
    : "A few more details";

  const subtitle = "Optional — the more you share, the better we can help.";

  return (
    <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
      <ProgressDots step={2} />

      <div className="crm-public-intake-hero">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>{subtitle}</p>
      </div>

      <div className="crm-public-intake-grid">
        {intent === "Buying" && (
          <>
            <Field label="Email Address" full>
              <input type="email" value={buying.email} placeholder="you@email.com" onChange={(e) => setBuying((p) => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Areas or Neighborhoods You're Interested In" full>
              <input type="text" value={buying.location_area} placeholder="East Nashville, 37206, Green Hills..." onChange={(e) => setBuying((p) => ({ ...p, location_area: e.target.value }))} />
            </Field>
            <SelectField label="Budget Range" value={buying.budget_range} options={BUDGET_OPTIONS} onChange={(v) => setBuying((p) => ({ ...p, budget_range: v }))} />
            <SelectField label="Timeline to Buy" value={buying.timeline} options={TIMELINE_OPTIONS} onChange={(v) => setBuying((p) => ({ ...p, timeline: v }))} />
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Pre-approved for a mortgage?</legend>
              <div className="crm-smart-form-intent-row">
                {["Yes", "No", "In progress"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${buying.financing_status === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setBuying((p) => ({ ...p, financing_status: p.financing_status === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <Field label="Why are you looking to move?" full>
              <textarea rows={3} value={buying.motivation} placeholder="e.g. Job relocation, lease ending, growing family..." onChange={(e) => setBuying((p) => ({ ...p, motivation: e.target.value }))} />
            </Field>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Is anyone else involved in this decision?</legend>
              <div className="crm-smart-form-intent-row">
                {["Just me", "Spouse / partner", "Yes — someone else"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${buying.decision_makers === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setBuying((p) => ({ ...p, decision_makers: p.decision_makers === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Best way to reach you?</legend>
              <div className="crm-smart-form-intent-row">
                {["Call", "Text", "Email"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${buying.contact_preference === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setBuying((p) => ({ ...p, contact_preference: p.contact_preference === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <SelectField label="How did you hear about us?" value={buying.referral_source} options={REFERRAL_OPTIONS} onChange={(v) => setBuying((p) => ({ ...p, referral_source: v }))} />
          </>
        )}

        {intent === "Selling" && (
          <>
            <Field label="Email Address" full>
              <input type="email" value={selling.email} placeholder="you@email.com" onChange={(e) => setSelling((p) => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Property Address" full>
              <input type="text" value={selling.property_address} placeholder="123 Main St, Nashville, TN" onChange={(e) => setSelling((p) => ({ ...p, property_address: e.target.value }))} />
            </Field>
            <SelectField label="Property Type" value={selling.property_type} options={PROPERTY_TYPE_OPTIONS} onChange={(v) => setSelling((p) => ({ ...p, property_type: v }))} />
            <SelectField label="Timeline to Sell" value={selling.timeline} options={TIMELINE_OPTIONS} onChange={(v) => setSelling((p) => ({ ...p, timeline: v }))} />
            <Field label="Rough Asking Price in Mind?">
              <input type="text" value={selling.asking_price} placeholder="e.g. $450,000 — okay to estimate" onChange={(e) => setSelling((p) => ({ ...p, asking_price: e.target.value }))} />
            </Field>
            <Field label="Why are you selling?" full>
              <textarea rows={3} value={selling.motivation} placeholder="e.g. Downsizing, relocation, divorce, inherited property..." onChange={(e) => setSelling((p) => ({ ...p, motivation: e.target.value }))} />
            </Field>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Is anyone else involved in this decision?</legend>
              <div className="crm-smart-form-intent-row">
                {["Just me", "Spouse / partner", "Yes — someone else"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${selling.decision_makers === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setSelling((p) => ({ ...p, decision_makers: p.decision_makers === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Best way to reach you?</legend>
              <div className="crm-smart-form-intent-row">
                {["Call", "Text", "Email"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${selling.contact_preference === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setSelling((p) => ({ ...p, contact_preference: p.contact_preference === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <SelectField label="How did you hear about us?" value={selling.referral_source} options={REFERRAL_OPTIONS} onChange={(v) => setSelling((p) => ({ ...p, referral_source: v }))} />
          </>
        )}

        {(intent === "Both" || intent === "") && (
          <>
            <Field label="Email Address" full>
              <input type="email" value={both.email} placeholder="you@email.com" onChange={(e) => setBoth((p) => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Property Address (if selling)" full>
              <input type="text" value={both.property_address} placeholder="123 Main St, Nashville, TN" onChange={(e) => setBoth((p) => ({ ...p, property_address: e.target.value }))} />
            </Field>
            <Field label="Where Are You Looking to Buy?">
              <input type="text" value={both.location_area} placeholder="East Nashville, 37206..." onChange={(e) => setBoth((p) => ({ ...p, location_area: e.target.value }))} />
            </Field>
            <SelectField label="Budget Range" value={both.budget_range} options={BUDGET_OPTIONS} onChange={(v) => setBoth((p) => ({ ...p, budget_range: v }))} />
            <SelectField label="Timeline" value={both.timeline} options={TIMELINE_OPTIONS} onChange={(v) => setBoth((p) => ({ ...p, timeline: v }))} />
            <Field label="Why are you moving?" full>
              <textarea rows={3} value={both.motivation} placeholder="e.g. Upsizing, job change, looking to cash out equity..." onChange={(e) => setBoth((p) => ({ ...p, motivation: e.target.value }))} />
            </Field>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Is anyone else involved in this decision?</legend>
              <div className="crm-smart-form-intent-row">
                {["Just me", "Spouse / partner", "Yes — someone else"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${both.decision_makers === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setBoth((p) => ({ ...p, decision_makers: p.decision_makers === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
              <legend>Best way to reach you?</legend>
              <div className="crm-smart-form-intent-row">
                {["Call", "Text", "Email"].map((opt) => (
                  <button key={opt} type="button"
                    className={`crm-smart-form-intent-chip${both.contact_preference === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                    onClick={() => setBoth((p) => ({ ...p, contact_preference: p.contact_preference === opt ? "" : opt }))}
                  >{opt}</button>
                ))}
              </div>
            </fieldset>
            <SelectField label="How did you hear about us?" value={both.referral_source} options={REFERRAL_OPTIONS} onChange={(v) => setBoth((p) => ({ ...p, referral_source: v }))} />
          </>
        )}
      </div>

      {error ? <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div> : null}

      <div className="crm-inline-actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="crm-btn crm-btn-secondary" onClick={onSkip}>
          Skip
        </button>
        <button type="submit" className="crm-btn crm-btn-primary" disabled={saving}>
          {saving ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

// ── Confirmation ───────────────────────────────────────────────────────────────

function Confirmation() {
  return (
    <section className="crm-card crm-public-intake-confirmation">
      <div className="crm-stack-8" style={{ textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>You&apos;re all set</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          Your info was sent to the agent. Expect a follow-up soon.
        </p>
        <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>What happens next</div>
          <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
            The agent will review your details and reach out with the right next step.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function SmartForm({ agentSlug }: { agentSlug: string }) {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [leadId, setLeadId] = useState<string>("");
  const [intent, setIntent] = useState<Intent>("");

  if (step === "done") return <Confirmation />;

  return (
    <section className="crm-card crm-public-intake-form">
      {step === 1 && (
        <Step1Form
          agentSlug={agentSlug}
          onComplete={(id, i) => {
            setLeadId(id);
            setIntent(i);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <Step2Form
          leadId={leadId}
          intent={intent}
          onComplete={() => setStep("done")}
          onSkip={() => setStep("done")}
        />
      )}
    </section>
  );
}
