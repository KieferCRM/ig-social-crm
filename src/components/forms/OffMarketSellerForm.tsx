"use client";

import { useState } from "react";

// ── Lead temperature inference ─────────────────────────────────────────────────

type LeadTemp = "Hot" | "Warm" | "Cold" | "unclassified";

function inferSellerLeadTemp(timeline: string): LeadTemp {
  const s = timeline.toLowerCase().trim();
  if (!s) return "unclassified";

  // Hot: urgency keywords
  if (/\b(asap|immediately|now|urgent|right away|this week|this month)\b/.test(s)) return "Hot";

  // Extract numeric units
  const monthM = s.match(/(\d+)\s*months?/);
  const weekM = s.match(/(\d+)\s*weeks?/);
  const yearM = s.match(/(\d+)\s*years?/);

  const months = monthM ? parseInt(monthM[1], 10) : null;
  const weeks = weekM ? parseInt(weekM[1], 10) : null;
  const years = yearM ? parseInt(yearM[1], 10) : null;

  // Hot: ≤8 weeks (≈2 months) or ≤1 month
  if (weeks !== null && weeks <= 8) return "Hot";
  if (months !== null && months <= 1) return "Hot";

  // Warm: 2–6 months
  if (months !== null && months >= 2 && months <= 6) return "Warm";

  // Cold: >6 months or years
  if (months !== null && months > 6) return "Cold";
  if (years !== null) return "Cold";

  // Text-based warm signals
  if (/within\s*(3|4|5|6)\s*months?/.test(s)) return "Warm";
  if (/\b(couple|few)\s*months?/.test(s)) return "Warm";
  if (/within\s*6\s*months?/.test(s)) return "Warm";

  // Text-based cold signals
  if (/\b(no rush|not sure|eventually|someday|exploring|later|whenever|flexible)\b/.test(s)) return "Cold";
  if (/6\s*months?\s*\+/.test(s)) return "Cold";
  if (/within\s*(a year|the year|12\s*months?)/.test(s)) return "Cold";

  return "unclassified";
}

// ── Progress indicator ─────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 24 }}>
      <div
        style={{
          width: 36, height: 4, borderRadius: 9999,
          background: "var(--brand, #16a34a)",
          transition: "background 0.2s",
        }}
      />
      <div
        style={{
          width: 36, height: 4, borderRadius: 9999,
          background: step === 2 ? "var(--brand, #16a34a)" : "var(--border, #e2e8f0)",
          transition: "background 0.2s",
        }}
      />
    </div>
  );
}

// ── Privacy note ───────────────────────────────────────────────────────────────

function PrivacyNote() {
  return (
    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>
      Your information is private and never listed publicly.
    </p>
  );
}

// ── Field helpers ──────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  full,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  full?: boolean;
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

// ── Submission types ───────────────────────────────────────────────────────────

type IntakeResponse = { ok?: boolean; lead_id?: string; error?: string };
type PropertyResponse = { ok?: boolean; error?: string };

// ── Main component ─────────────────────────────────────────────────────────────

export default function OffMarketSellerForm({ agentSlug }: { agentSlug: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [timeline, setTimeline] = useState("");
  const [askingPrice, setAskingPrice] = useState("");

  // Step 2 fields
  const [propertyType, setPropertyType] = useState("");
  const [ownersOnTitle, setOwnersOnTitle] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqFootage, setSqFootage] = useState("");
  const [waterType, setWaterType] = useState("");
  const [sewageType, setSewageType] = useState("");
  const [condition, setCondition] = useState("");
  const [reasonForSelling, setReasonForSelling] = useState("");
  const [propertyNotes, setPropertyNotes] = useState("");

  // Step 1 validation
  const step1Valid =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    address.trim() &&
    timeline.trim() &&
    askingPrice.trim();

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1Valid) { setError("Please complete all required fields."); return; }

    setSaving(true);
    setError("");

    const inferredTemp = inferSellerLeadTemp(timeline);
    const payload: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      property_context: address.trim(),
      timeline: timeline.trim(),
      intent: "Sell",
      form_variant: "off_market_seller",
      source: `seller_form_${agentSlug}`,
      custom_fields: {
        asking_price: askingPrice.trim(),
        timeline_raw: timeline.trim(),
        lead_temp_inferred: inferredTemp,
      },
    };

    // Only send lead_temp if we have a confident classification
    if (inferredTemp !== "unclassified") {
      payload.lead_temp = inferredTemp;
    }

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as IntakeResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setLeadId(data.lead_id || null);
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      lead_id: leadId,
      property_type: propertyType,
      owners_on_title: ownersOnTitle ? parseInt(ownersOnTitle, 10) : null,
      beds: beds ? parseInt(beds, 10) : null,
      baths: baths ? parseFloat(baths) : null,
      sq_footage: sqFootage ? parseInt(sqFootage, 10) : null,
      water_type: waterType,
      sewage_type: sewageType,
      property_condition: condition,
      reason_for_selling: reasonForSelling || null,
      property_notes: propertyNotes || null,
    };

    try {
      const res = await fetch("/api/seller-property-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as PropertyResponse;
      if (!res.ok || !data.ok) {
        // Non-fatal: step 2 failure still shows confirmation since lead was captured in step 1
        console.warn("[seller-form] step 2 update failed:", data.error);
      }
      setSubmitted(true);
    } catch {
      // Same: show confirmation anyway — lead was captured in step 1
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <section className="crm-card crm-public-intake-confirmation">
        <div className="crm-stack-8" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>✓</div>
          <h2 style={{ margin: 0 }}>All set — we&apos;ll be in touch.</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Your details were sent to the agent. You can expect a follow-up soon.
          </p>
          <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
            <div style={{ fontWeight: 700 }}>What happens next</div>
            <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
              The agent will review your property details and reach out with a realistic next step — no obligation.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <section className="crm-card crm-public-intake-form">
        <ProgressBar step={1} />

        <form onSubmit={handleStep1Submit} className="crm-public-intake-form-grid">
          <div className="crm-public-intake-hero" style={{ marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Tell us about yourself</h2>
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              Share the basics and we&apos;ll follow up with next steps — no obligation.
            </p>
          </div>

          <div className="crm-public-intake-grid">
            <Field label="First Name" required>
              <input
                type="text"
                value={firstName}
                placeholder="Jane"
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>

            <Field label="Last Name" required>
              <input
                type="text"
                value={lastName}
                placeholder="Smith"
                autoComplete="family-name"
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>

            <Field label="Email Address">
              <input
                type="email"
                value={email}
                placeholder="you@email.com"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Phone Number" required>
              <input
                type="tel"
                value={phone}
                placeholder="(615) 555-0100"
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>

            <Field label="Property Address" required full>
              <input
                type="text"
                value={address}
                placeholder="123 Main St, Nashville, TN"
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>

            <Field label="Selling Timeline" required full>
              <input
                type="text"
                value={timeline}
                placeholder="e.g. ASAP, 3 months, by end of year"
                onChange={(e) => setTimeline(e.target.value)}
              />
            </Field>

            <Field label="Estimated Asking Price" required full>
              <input
                type="text"
                value={askingPrice}
                placeholder="e.g. $350,000"
                onChange={(e) => setAskingPrice(e.target.value)}
              />
            </Field>
          </div>

          {error ? (
            <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
          ) : null}

          <div className="crm-stack-8">
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="crm-btn crm-btn-primary"
                disabled={saving || !step1Valid}
                style={{ minWidth: 200 }}
              >
                {saving ? "Submitting..." : "Continue to property details →"}
              </button>
            </div>
            <PrivacyNote />
          </div>
        </form>
      </section>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────────

  return (
    <section className="crm-card crm-public-intake-form">
      <ProgressBar step={2} />

      <form onSubmit={handleStep2Submit} className="crm-public-intake-form-grid">
        <div className="crm-public-intake-hero" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>About your property</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            A few more details help us give you the most accurate follow-up.
          </p>
        </div>

        <div className="crm-public-intake-grid">
          <Field label="Property Type">
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              <option value="">Select one (optional)</option>
              <option value="Single family">Single family</option>
              <option value="Condo">Condo</option>
              <option value="Multi-family">Multi-family</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Land">Land</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Number of Owners on Title">
            <input
              type="number"
              min="1"
              max="10"
              value={ownersOnTitle}
              placeholder="e.g. 2"
              onChange={(e) => setOwnersOnTitle(e.target.value)}
            />
          </Field>

          <Field label="Beds">
            <input
              type="number"
              min="0"
              max="20"
              value={beds}
              placeholder="e.g. 3"
              onChange={(e) => setBeds(e.target.value)}
            />
          </Field>

          <Field label="Baths">
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={baths}
              placeholder="e.g. 2"
              onChange={(e) => setBaths(e.target.value)}
            />
          </Field>

          <Field label="Sq. Footage">
            <input
              type="number"
              min="0"
              value={sqFootage}
              placeholder="e.g. 1800"
              onChange={(e) => setSqFootage(e.target.value)}
            />
          </Field>

          <Field label="Water Type">
            <select value={waterType} onChange={(e) => setWaterType(e.target.value)}>
              <option value="">Select one (optional)</option>
              <option value="City water">City water</option>
              <option value="Well">Well</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Sewage Type">
            <select value={sewageType} onChange={(e) => setSewageType(e.target.value)}>
              <option value="">Select one (optional)</option>
              <option value="Public sewer">Public sewer</option>
              <option value="Septic">Septic</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Property Condition">
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Select one (optional)</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Needs work">Needs work</option>
            </select>
          </Field>

          <Field label="Reason for Selling" full>
            <select value={reasonForSelling} onChange={(e) => setReasonForSelling(e.target.value)}>
              <option value="">Select one (optional)</option>
              <option value="Downsizing">Downsizing</option>
              <option value="Relocating">Relocating</option>
              <option value="Inherited property">Inherited property</option>
              <option value="Financial reasons">Financial reasons</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Any Known Issues or Notes" full>
            <textarea
              rows={4}
              value={propertyNotes}
              placeholder="Anything we should know — repairs, liens, tenant situation, etc."
              onChange={(e) => setPropertyNotes(e.target.value)}
            />
          </Field>
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div>
        ) : null}

        <div className="crm-stack-8">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              style={{ fontSize: 13 }}
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              type="submit"
              className="crm-btn crm-btn-primary"
              disabled={saving}
              style={{ minWidth: 200 }}
            >
              {saving ? "Submitting..." : "Connect with an agent"}
            </button>
          </div>
          <PrivacyNote />
        </div>
      </form>
    </section>
  );
}
