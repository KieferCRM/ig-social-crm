"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = "Seller" | "Buyer" | "";

type Step1 = {
  full_name: string;
  phone: string;
  role: Role;
};

type SellerForm = {
  property_address: string;
  condition: string;
  timeline: string;
  motivation: string;
  urgency_answer: string;
  decision_makers: string;
  asking_price: string;
  contact_preference: string;
};

type BuyerForm = {
  location_area: string;
  price_range: string;
  property_type: string;
  condition_tolerance: string;
  funding: string;
  contact_preference: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const CONDITION_OPTIONS = [
  "Needs Major Work",
  "Needs Cosmetic Updates",
  "Move-In Ready",
  "Not Sure",
];

const SELLER_TIMELINE_OPTIONS = [
  "ASAP",
  "Within 30 days",
  "1–3 months",
  "3–6 months",
  "No rush",
];

const MOTIVATION_OPTIONS = [
  "Pre-Foreclosure",
  "Inherited / Probate",
  "Divorce",
  "Job Relocation",
  "Burned-Out Landlord",
  "Tax Delinquent",
  "Downsizing",
  "Other",
];

const DECISION_MAKER_OPTIONS = ["Just me", "Spouse / partner", "Yes — someone else"];

const PRICE_RANGE_OPTIONS = [
  "Under $100k",
  "$100k–$200k",
  "$200k–$350k",
  "$350k–$500k",
  "$500k–$750k",
  "$750k+",
];

const PROPERTY_TYPE_OPTIONS = [
  "Single Family",
  "Multi-Family (2–4 units)",
  "Multi-Family (5+ units)",
  "Land",
  "Commercial",
];

const CONDITION_TOLERANCE_OPTIONS = [
  "Turnkey / Move-in ready",
  "Light rehab (paint, carpet)",
  "Full rehab OK",
  "Any condition",
];

const FUNDING_OPTIONS = [
  "Cash",
  "Hard money / private lender",
  "Conventional loan",
  "Partner / JV",
  "Other",
];

const CONTACT_OPTIONS = ["Call", "Text", "Email"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  full,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`crm-public-intake-field${full ? " crm-public-intake-field-full" : ""}`}>
      <span>
        {label}
        {required ? <span style={{ color: "var(--danger, #dc2626)" }}> *</span> : null}
      </span>
      {hint ? <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 400, display: "block", marginBottom: 4 }}>{hint}</span> : null}
      {children}
    </label>
  );
}

function ChipGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
      <legend>{legend}</legend>
      <div className="crm-smart-form-intent-row" style={{ flexWrap: "wrap" }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`crm-smart-form-intent-chip${value === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
            onClick={() => onChange(value === opt ? "" : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

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
  onComplete: (leadId: string, role: Role) => void;
}) {
  const [form, setForm] = useState<Step1>({ full_name: "", phone: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
          form_variant: "wholesaler_smart_form",
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          intent: form.role === "Seller" ? "Selling" : form.role === "Buyer" ? "Buying" : null,
          consent_to_sms: false,
          questionnaire_answers: {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            role: form.role || "",
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; lead_id?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      onComplete(data.lead_id!, form.role);
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
        <h2 style={{ margin: 0 }}>Get a cash offer today</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          Takes 2 minutes. No obligation, no pressure.
        </p>
      </div>

      <div className="crm-public-intake-grid">
        <Field label="Full Name" required full>
          <input
            type="text"
            value={form.full_name}
            placeholder="Jane Smith"
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          />
        </Field>

        <Field label="Phone Number" required full>
          <input
            type="tel"
            value={form.phone}
            placeholder="(615) 555-0100"
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </Field>

        <fieldset className="crm-smart-form-intent crm-public-intake-field-full">
          <legend>What brings you here?</legend>
          <div className="crm-smart-form-intent-row">
            {(["Seller", "Buyer"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`crm-smart-form-intent-chip${form.role === opt ? " crm-smart-form-intent-chip--selected" : ""}`}
                onClick={() => setForm((p) => ({ ...p, role: p.role === opt ? "" : opt }))}
              >
                {opt === "Seller" ? "I have a property to sell" : "I'm a cash buyer"}
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
          disabled={saving || !canSubmit}
        >
          {saving ? "One moment..." : "Continue →"}
        </button>
      </div>
    </form>
  );
}

// ── Step 2 — Seller (Four Pillars: Condition → Timeline → Motivation → Price) ──

function SellerStep2({
  leadId,
  onComplete,
  onSkip,
}: {
  leadId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<SellerForm>({
    property_address: "",
    condition: "",
    timeline: "",
    motivation: "",
    urgency_answer: "",
    decision_makers: "",
    asking_price: "",
    contact_preference: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof SellerForm>(key: K, value: SellerForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/intake/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          intent: "Selling",
          property_address: form.property_address || null,
          condition: form.condition || null,
          timeline: form.timeline || null,
          motivation: form.motivation || null,
          urgency_answer: form.urgency_answer || null,
          decision_makers: form.decision_makers || null,
          asking_price: form.asking_price || null,
          contact_preference: form.contact_preference || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
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

  return (
    <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
      <ProgressDots step={2} />

      <div className="crm-public-intake-hero">
        <h2 style={{ margin: 0 }}>Tell us about your property</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          A few quick questions so we can prepare a fair offer.
        </p>
      </div>

      <div className="crm-public-intake-grid">
        {/* Pillar 0 — Address */}
        <Field label="Property Address" full>
          <input
            type="text"
            value={form.property_address}
            placeholder="123 Main St, Nashville, TN"
            onChange={(e) => set("property_address", e.target.value)}
          />
        </Field>

        {/* Pillar 1 — Condition */}
        <ChipGroup
          legend="What's the condition of the property?"
          options={CONDITION_OPTIONS}
          value={form.condition}
          onChange={(v) => set("condition", v)}
        />

        {/* Pillar 2 — Timeline */}
        <ChipGroup
          legend="When do you need to sell?"
          options={SELLER_TIMELINE_OPTIONS}
          value={form.timeline}
          onChange={(v) => set("timeline", v)}
        />

        {/* Urgency follow-up (Steve Trang question) */}
        <Field
          label="What happens if you don't sell by then?"
          full
          hint="Optional — this helps us understand your situation better."
        >
          <textarea
            rows={3}
            value={form.urgency_answer}
            placeholder="e.g. I'll be behind on payments, or the estate needs to be settled..."
            onChange={(e) => set("urgency_answer", e.target.value)}
          />
        </Field>

        {/* Pillar 3 — Motivation */}
        <ChipGroup
          legend="What's your reason for selling?"
          options={MOTIVATION_OPTIONS}
          value={form.motivation}
          onChange={(v) => set("motivation", v)}
        />

        {/* Decision makers */}
        <ChipGroup
          legend="Is anyone else involved in this decision?"
          options={DECISION_MAKER_OPTIONS}
          value={form.decision_makers}
          onChange={(v) => set("decision_makers", v)}
        />

        {/* Contact preference */}
        <ChipGroup
          legend="Best way to reach you?"
          options={CONTACT_OPTIONS}
          value={form.contact_preference}
          onChange={(v) => set("contact_preference", v)}
        />

        {/* Pillar 4 — Price (LAST, always) */}
        <Field
          label="Do you have a number in mind?"
          hint="Optional — no commitment required. Knowing helps us move faster."
        >
          <input
            type="text"
            value={form.asking_price}
            placeholder="e.g. $180,000 — okay to estimate"
            onChange={(e) => set("asking_price", e.target.value)}
          />
        </Field>
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

// ── Step 2 — Buyer ─────────────────────────────────────────────────────────────

function BuyerStep2({
  leadId,
  onComplete,
  onSkip,
}: {
  leadId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<BuyerForm>({
    location_area: "",
    price_range: "",
    property_type: "",
    condition_tolerance: "",
    funding: "",
    contact_preference: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof BuyerForm>(key: K, value: BuyerForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/intake/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          intent: "Buying",
          location_area: form.location_area || null,
          budget_range: form.price_range || null,
          property_type: form.property_type || null,
          condition_tolerance: form.condition_tolerance || null,
          financing_status: form.funding || null,
          contact_preference: form.contact_preference || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
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

  return (
    <form onSubmit={handleSubmit} className="crm-public-intake-form-grid">
      <ProgressDots step={2} />

      <div className="crm-public-intake-hero">
        <h2 style={{ margin: 0 }}>Tell us what you&apos;re looking for</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          Help us match you with the right off-market deals.
        </p>
      </div>

      <div className="crm-public-intake-grid">
        <Field label="Target Markets / Areas" full>
          <input
            type="text"
            value={form.location_area}
            placeholder="e.g. Nashville metro, zip 37206, Murfreesboro..."
            onChange={(e) => set("location_area", e.target.value)}
          />
        </Field>

        <ChipGroup
          legend="Buy price range"
          options={PRICE_RANGE_OPTIONS}
          value={form.price_range}
          onChange={(v) => set("price_range", v)}
        />

        <ChipGroup
          legend="Property type"
          options={PROPERTY_TYPE_OPTIONS}
          value={form.property_type}
          onChange={(v) => set("property_type", v)}
        />

        <ChipGroup
          legend="Condition tolerance"
          options={CONDITION_TOLERANCE_OPTIONS}
          value={form.condition_tolerance}
          onChange={(v) => set("condition_tolerance", v)}
        />

        <ChipGroup
          legend="How are you funding deals?"
          options={FUNDING_OPTIONS}
          value={form.funding}
          onChange={(v) => set("funding", v)}
        />

        <ChipGroup
          legend="Best way to reach you?"
          options={CONTACT_OPTIONS}
          value={form.contact_preference}
          onChange={(v) => set("contact_preference", v)}
        />
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

function Confirmation({ role }: { role: Role }) {
  return (
    <section className="crm-card crm-public-intake-confirmation">
      <div className="crm-stack-8" style={{ textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>You&apos;re all set</h2>
        <p style={{ margin: 0, color: "var(--ink-muted)" }}>
          {role === "Seller"
            ? "Your property info was received. Expect a call or text soon — no pressure."
            : "Your buyer criteria were sent over. We'll be in touch when we have something that fits."}
        </p>
        <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>What happens next</div>
          <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
            {role === "Seller"
              ? "We'll review your property details and reach out with a fair, no-obligation offer."
              : "We'll add you to our buyer list and reach out when a deal matches your criteria."}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function WholesalerSmartForm({ agentSlug }: { agentSlug: string }) {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [leadId, setLeadId] = useState<string>("");
  const [role, setRole] = useState<Role>("");

  if (step === "done") return <Confirmation role={role} />;

  return (
    <section className="crm-card crm-public-intake-form">
      {step === 1 && (
        <Step1Form
          agentSlug={agentSlug}
          onComplete={(id, r) => {
            setLeadId(id);
            setRole(r);
            setStep(2);
          }}
        />
      )}
      {step === 2 && role === "Seller" && (
        <SellerStep2
          leadId={leadId}
          onComplete={() => setStep("done")}
          onSkip={() => setStep("done")}
        />
      )}
      {step === 2 && role !== "Seller" && (
        <BuyerStep2
          leadId={leadId}
          onComplete={() => setStep("done")}
          onSkip={() => setStep("done")}
        />
      )}
    </section>
  );
}
