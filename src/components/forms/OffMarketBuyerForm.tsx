"use client";

import { useState } from "react";

type IntakeResponse = {
  ok?: boolean;
  lead_id?: string;
  error?: string;
};

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 24 }}>
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 9999,
          background: "var(--brand, #16a34a)",
          transition: "background 0.2s",
        }}
      />
      <div
        style={{
          width: 36,
          height: 4,
          borderRadius: 9999,
          background: step === 2 ? "var(--brand, #16a34a)" : "var(--border, #e2e8f0)",
          transition: "background 0.2s",
        }}
      />
    </div>
  );
}

function PrivacyNote() {
  return (
    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>
      Your information is private and only shared with the agent.
    </p>
  );
}

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

function isYes(value: string): boolean {
  return value.trim().toLowerCase() === "yes";
}

function buildBudgetRange(min: string, max: string): string {
  const low = min.trim();
  const high = max.trim();
  if (low && high) return `${low} - ${high}`;
  return low || high || "";
}

function buildStep2Notes(input: {
  firstName: string;
  coBuyerInvolved: string;
  coBuyerName: string;
  financingStatus: string;
  preapprovalStatus: string;
  lenderName: string;
  preapprovalAmount: string;
  budgetMin: string;
  budgetMax: string;
  hasPropertyToSell: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqFootage: string;
  preferredAreas: string;
  mustHaves: string;
  timeline: string;
  firstTimeBuyer: string;
  buyingReason: string;
  agencyStatus: string;
  previousPurchase: string;
  notes: string;
}): string {
  const parts: string[] = [];

  if (input.coBuyerInvolved) {
    parts.push(
      input.coBuyerInvolved === "Yes"
        ? `Co-buyer: yes${input.coBuyerName ? ` (${input.coBuyerName})` : ""}`
        : "Co-buyer: no"
    );
  }
  if (input.financingStatus) parts.push(`Financing: ${input.financingStatus}`);
  if (input.preapprovalStatus) parts.push(`Pre-approved: ${input.preapprovalStatus}`);
  if (input.lenderName) parts.push(`Lender: ${input.lenderName}`);
  if (input.preapprovalAmount) parts.push(`Pre-approval amount: ${input.preapprovalAmount}`);
  if (input.budgetMin || input.budgetMax) {
    parts.push(`Budget: ${buildBudgetRange(input.budgetMin, input.budgetMax)}`);
  }
  if (input.hasPropertyToSell) parts.push(`Property to sell first: ${input.hasPropertyToSell}`);
  if (input.propertyType) parts.push(`Property type: ${input.propertyType}`);
  if (input.bedrooms) parts.push(`Beds: ${input.bedrooms}`);
  if (input.bathrooms) parts.push(`Baths: ${input.bathrooms}`);
  if (input.sqFootage) parts.push(`Min sq ft: ${input.sqFootage}`);
  if (input.preferredAreas) parts.push(`Areas: ${input.preferredAreas}`);
  if (input.mustHaves) parts.push(`Must-haves: ${input.mustHaves}`);
  if (input.timeline) parts.push(`Timeline: ${input.timeline}`);
  if (input.firstTimeBuyer) parts.push(`First-time buyer: ${input.firstTimeBuyer}`);
  if (input.buyingReason) parts.push(`Reason: ${input.buyingReason}`);
  if (input.agencyStatus) parts.push(`Representation: ${input.agencyStatus}`);
  if (input.previousPurchase) parts.push(`Purchased before: ${input.previousPurchase}`);
  if (input.notes) parts.push(`Notes: ${input.notes}`);

  if (!parts.length) return "";
  const leadLabel = input.firstName ? `Buyer intake for ${input.firstName}` : "Buyer intake";
  return `${leadLabel}. ${parts.join(" · ")}`;
}

export default function OffMarketBuyerForm({ agentSlug }: { agentSlug: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactPreference, setContactPreference] = useState("");
  const [coBuyerInvolved, setCoBuyerInvolved] = useState("");
  const [coBuyerName, setCoBuyerName] = useState("");
  const [financingStatus, setFinancingStatus] = useState("");
  const [preapprovalStatus, setPreapprovalStatus] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [preapprovalAmount, setPreapprovalAmount] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [hasPropertyToSell, setHasPropertyToSell] = useState("");
  const [otherFinancing, setOtherFinancing] = useState("");

  // Step 2 fields
  const [propertyType, setPropertyType] = useState("");
  const [preferredAreas, setPreferredAreas] = useState("");
  const [timeline, setTimeline] = useState("");
  const [firstTimeBuyer, setFirstTimeBuyer] = useState("");
  const [buyingReason, setBuyingReason] = useState("");
  const [agencyStatus, setAgencyStatus] = useState("");
  const [previousPurchase, setPreviousPurchase] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [sqFootage, setSqFootage] = useState("");
  const [mustHaves, setMustHaves] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const step1Valid =
    fullName.trim() &&
    phone.trim() &&
    contactPreference.trim() &&
    financingStatus.trim() &&
    budgetMin.trim() &&
    budgetMax.trim() &&
    hasPropertyToSell.trim() &&
    coBuyerInvolved.trim() &&
    (coBuyerInvolved !== "Yes" || coBuyerName.trim()) &&
    (financingStatus !== "Mortgage" || preapprovalStatus.trim()) &&
    (preapprovalStatus !== "Yes" || (lenderName.trim() && preapprovalAmount.trim())) &&
    (financingStatus !== "Other" || otherFinancing.trim());

  const step2Valid =
    propertyType.trim() &&
    preferredAreas.trim() &&
    timeline.trim() &&
    firstTimeBuyer.trim() &&
    agencyStatus.trim() &&
    previousPurchase.trim();

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1Valid) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    const budgetRange = buildBudgetRange(budgetMin, budgetMax);
    const payload: Record<string, unknown> = {
      agent_id: agentSlug,
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      contact_preference: contactPreference,
      financing_status: financingStatus,
      budget_range: budgetRange,
      intent: "Buy",
      form_variant: "off_market_buyer",
      source: `buyer_form_${agentSlug}`,
      custom_fields: {
        form_step: "1",
        co_buyer_involved: coBuyerInvolved,
        co_buyer_name: coBuyerName.trim() || null,
        preapproval_status: preapprovalStatus || null,
        lender_name: lenderName.trim() || null,
        preapproval_amount: preapprovalAmount.trim() || null,
        budget_min: budgetMin.trim(),
        budget_max: budgetMax.trim(),
        has_property_to_sell: hasPropertyToSell,
        other_financing: otherFinancing.trim() || null,
      },
    };

    if (financingStatus === "Other" && otherFinancing.trim()) {
      payload.custom_fields = {
        ...(payload.custom_fields as Record<string, unknown>),
        other_financing: otherFinancing.trim(),
      };
    }

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, consent_to_sms: smsConsent }),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
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

    if (!step2Valid) {
      setError("Please complete the required search details.");
      return;
    }

    setSaving(true);
    setError("");

    const notes = buildStep2Notes({
      firstName: fullName.trim().split(/\s+/)[0] || "",
      coBuyerInvolved,
      coBuyerName: coBuyerName.trim(),
      financingStatus,
      preapprovalStatus,
      lenderName: lenderName.trim(),
      preapprovalAmount: preapprovalAmount.trim(),
      budgetMin: budgetMin.trim(),
      budgetMax: budgetMax.trim(),
      hasPropertyToSell,
      propertyType,
      bedrooms: bedrooms.trim(),
      bathrooms: bathrooms.trim(),
      sqFootage: sqFootage.trim(),
      preferredAreas: preferredAreas.trim(),
      mustHaves: mustHaves.trim(),
      timeline: timeline.trim(),
      firstTimeBuyer,
      buyingReason,
      agencyStatus,
      previousPurchase,
      notes: additionalNotes.trim(),
    });

    const payload: Record<string, unknown> = {
      lead_id: leadId,
      agent_id: agentSlug,
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      contact_preference: contactPreference,
      financing_status: financingStatus,
      budget_range: buildBudgetRange(budgetMin, budgetMax),
      intent: "Buy",
      property_type: propertyType,
      location_area: preferredAreas.trim(),
      timeline: timeline.trim(),
      notes,
      form_variant: "off_market_buyer",
      source: `buyer_form_${agentSlug}`,
      custom_fields: {
        form_step: "2",
        lead_id: leadId,
        co_buyer_involved: coBuyerInvolved,
        co_buyer_name: coBuyerName.trim() || null,
        preapproval_status: preapprovalStatus || null,
        lender_name: lenderName.trim() || null,
        preapproval_amount: preapprovalAmount.trim() || null,
        budget_min: budgetMin.trim(),
        budget_max: budgetMax.trim(),
        has_property_to_sell: hasPropertyToSell,
        other_financing: otherFinancing.trim() || null,
        property_type_requested: propertyType,
        bedrooms: bedrooms.trim() || null,
        bathrooms: bathrooms.trim() || null,
        minimum_square_footage: sqFootage.trim() || null,
        preferred_areas: preferredAreas.trim(),
        must_haves: mustHaves.trim() || null,
        first_time_buyer: firstTimeBuyer || null,
        buying_reason: buyingReason || null,
        agency_status_choice: agencyStatus || null,
        purchased_before: previousPurchase || null,
        additional_notes: additionalNotes.trim() || null,
      },
    };

    if (financingStatus === "Other" && otherFinancing.trim()) {
      payload.custom_fields = {
        ...(payload.custom_fields as Record<string, unknown>),
        other_financing: otherFinancing.trim(),
      };
    }

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="crm-card crm-public-intake-confirmation">
        <div className="crm-stack-8" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>✓</div>
          <h2 style={{ margin: 0 }}>All set — we&apos;ll match you with options.</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            Your buyer criteria were sent to the agent. You can expect a follow-up soon.
          </p>
          <div className="crm-card-muted" style={{ padding: 16, textAlign: "left" }}>
            <div style={{ fontWeight: 700 }}>What happens next</div>
            <p style={{ margin: "8px 0 0", color: "var(--ink-muted)" }}>
              The agent will review your budget, financing, and search criteria, then reach out with the right opportunities.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (step === 1) {
    return (
      <section className="crm-card crm-public-intake-form">
        <ProgressBar step={1} />

        <form onSubmit={handleStep1Submit} className="crm-public-intake-form-grid">
          <div className="crm-public-intake-hero" style={{ marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Tell us about the buyer</h2>
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              Start with contact info and buying power. We&apos;ll use this to match the right opportunities.
            </p>
          </div>

          <div className="crm-public-intake-grid">
            <Field label="Full Name(s) of Buyer(s)" required full>
              <input
                type="text"
                value={fullName}
                placeholder="Jane Smith or Jane + John Smith"
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
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

            <Field label="Email Address">
              <input
                type="email"
                value={email}
                placeholder="you@email.com"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Preferred Contact Method" required>
              <select value={contactPreference} onChange={(e) => setContactPreference(e.target.value)}>
                <option value="">Select one</option>
                <option value="Call">Call</option>
                <option value="Text">Text</option>
                <option value="Email">Email</option>
              </select>
            </Field>

            <Field label="Will a co-buyer be involved?" required>
              <select value={coBuyerInvolved} onChange={(e) => setCoBuyerInvolved(e.target.value)}>
                <option value="">Select one</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>

            {isYes(coBuyerInvolved) ? (
              <Field label="Co-buyer Name" required full>
                <input
                  type="text"
                  value={coBuyerName}
                  placeholder="Optional if you want the agent to include them"
                  onChange={(e) => setCoBuyerName(e.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Will you be paying cash or using financing?" required>
              <select value={financingStatus} onChange={(e) => setFinancingStatus(e.target.value)}>
                <option value="">Select one</option>
                <option value="Cash">Cash</option>
                <option value="Mortgage">Mortgage</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            {financingStatus === "Other" ? (
              <Field label="Other Financing Details" full>
                <input
                  type="text"
                  value={otherFinancing}
                  placeholder="Describe your financing setup"
                  onChange={(e) => setOtherFinancing(e.target.value)}
                />
              </Field>
            ) : null}

            {financingStatus === "Mortgage" ? (
              <>
                <Field label="Have you been pre-approved?" required>
                  <select value={preapprovalStatus} onChange={(e) => setPreapprovalStatus(e.target.value)}>
                    <option value="">Select one</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="In progress">In progress</option>
                  </select>
                </Field>

                {isYes(preapprovalStatus) ? (
                  <>
                    <Field label="Lender Name" required>
                      <input
                        type="text"
                        value={lenderName}
                        placeholder="Lender or bank name"
                        onChange={(e) => setLenderName(e.target.value)}
                      />
                    </Field>

                    <Field label="Pre-approval Amount" required>
                      <input
                        type="text"
                        value={preapprovalAmount}
                        placeholder="$450,000"
                        onChange={(e) => setPreapprovalAmount(e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}

            <Field label="Minimum Budget" required>
              <input
                type="text"
                value={budgetMin}
                placeholder="$300,000"
                onChange={(e) => setBudgetMin(e.target.value)}
              />
            </Field>

            <Field label="Maximum Budget" required>
              <input
                type="text"
                value={budgetMax}
                placeholder="$450,000"
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </Field>

            <Field label="Do you need to sell before you buy?" required full>
              <select value={hasPropertyToSell} onChange={(e) => setHasPropertyToSell(e.target.value)}>
                <option value="">Select one</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>
          </div>

          {error ? <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div> : null}

          <div className="crm-stack-8">
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="crm-btn crm-btn-primary"
                disabled={saving || !step1Valid || !smsConsent}
                style={{ minWidth: 200 }}
              >
                {saving ? "Submitting..." : "Continue to search details →"}
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
            <PrivacyNote />
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="crm-card crm-public-intake-form">
      <ProgressBar step={2} />

      <form onSubmit={handleStep2Submit} className="crm-public-intake-form-grid">
        <div className="crm-public-intake-hero" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>What are you looking for?</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)" }}>
            A few more details help us match the right homes, land, or investment opportunities.
          </p>
        </div>

        <div className="crm-public-intake-grid">
          <Field label="Type of Property You're Seeking" required>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              <option value="">Select one</option>
              <option value="Single family">Single family</option>
              <option value="Condo">Condo</option>
              <option value="Townhome">Townhome</option>
              <option value="Land">Land</option>
              <option value="Multi-family">Multi-family</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Preferred Area(s) / City(ies)" required>
            <input
              type="text"
              value={preferredAreas}
              placeholder="Nashville, Franklin, Clarksville, or specific ZIP codes"
              onChange={(e) => setPreferredAreas(e.target.value)}
            />
          </Field>

          <Field label="Timeline" required>
            <input
              type="text"
              value={timeline}
              placeholder="ASAP, 3 months, or by the end of the year"
              onChange={(e) => setTimeline(e.target.value)}
            />
          </Field>

          <Field label="Bedrooms">
            <input
              type="number"
              min="0"
              max="20"
              value={bedrooms}
              placeholder="e.g. 3"
              onChange={(e) => setBedrooms(e.target.value)}
            />
          </Field>

          <Field label="Bathrooms">
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={bathrooms}
              placeholder="e.g. 2.5"
              onChange={(e) => setBathrooms(e.target.value)}
            />
          </Field>

          <Field label="Minimum Square Footage">
            <input
              type="number"
              min="0"
              value={sqFootage}
              placeholder="e.g. 1800"
              onChange={(e) => setSqFootage(e.target.value)}
            />
          </Field>

          <Field label="Must-Have Features" full>
            <textarea
              rows={4}
              value={mustHaves}
              placeholder="Garage, pool, school district, lot size, layout, or anything else important"
              onChange={(e) => setMustHaves(e.target.value)}
            />
          </Field>

          <Field label="Are you a first-time buyer?" required>
            <select value={firstTimeBuyer} onChange={(e) => setFirstTimeBuyer(e.target.value)}>
              <option value="">Select one</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>

          <Field label="Primary Reason for Buying">
            <select value={buyingReason} onChange={(e) => setBuyingReason(e.target.value)}>
              <option value="">Select one</option>
              <option value="Primary residence">Primary residence</option>
              <option value="Investment">Investment</option>
              <option value="Relocation">Relocation</option>
              <option value="Downsizing">Downsizing</option>
              <option value="Second home">Second home</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Do you already have a buyer's agent?" required>
            <select value={agencyStatus} onChange={(e) => setAgencyStatus(e.target.value)}>
              <option value="">Select one</option>
              <option value="I have an agent">I have an agent</option>
              <option value="I need representation">I need representation</option>
            </select>
          </Field>

          <Field label="Have you purchased real estate before?" required>
            <select value={previousPurchase} onChange={(e) => setPreviousPurchase(e.target.value)}>
              <option value="">Select one</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>

          <Field label="Additional Notes" full>
            <textarea
              rows={4}
              value={additionalNotes}
              placeholder="Anything else we should know before reaching out?"
              onChange={(e) => setAdditionalNotes(e.target.value)}
            />
          </Field>
        </div>

        {error ? <div style={{ fontSize: 13, color: "var(--danger, #dc2626)" }}>{error}</div> : null}

        <div className="crm-stack-8">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
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
              disabled={saving || !step2Valid}
              style={{ minWidth: 200 }}
            >
              {saving ? "Submitting..." : "Send buyer profile"}
            </button>
          </div>
          <PrivacyNote />
        </div>
      </form>
    </section>
  );
}
