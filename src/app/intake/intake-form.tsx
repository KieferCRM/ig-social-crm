"use client";

import { useEffect, useMemo, useState } from "react";

type IntakeResponse = {
  ok?: boolean;
  ignored?: boolean;
  status?: "inserted" | "updated";
  lead_id?: string;
  reminder_created?: boolean;
  error?: string;
};

type TransportFields = {
  source: string;
  external_id: string;
  website: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

type IntakeFields = {
  full_name: string;
  email: string;
  phone: string;
  intent: string;
  timeline: string;
  budget_range: string;
  location_area: string;
  contact_preference: string;
  referral_source: string;
  notes: string;
};

function createEmptyTransport(defaultSource: string): TransportFields {
  return {
    source: defaultSource,
    external_id: "",
    website: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
  };
}

const EMPTY_FORM: IntakeFields = {
  full_name: "",
  email: "",
  phone: "",
  intent: "",
  timeline: "",
  budget_range: "",
  location_area: "",
  contact_preference: "",
  referral_source: "",
  notes: "",
};

function clean(value: string): string {
  return value.trim();
}

export default function IntakeForm({
  defaultSource = "website_intake",
}: {
  defaultSource?: string;
}) {
  const [form, setForm] = useState<IntakeFields>(EMPTY_FORM);
  const [transport, setTransport] = useState<TransportFields>(
    createEmptyTransport(defaultSource)
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTransport((prev) => ({
      ...prev,
      source: params.get("source") || prev.source,
      external_id: params.get("external_id") || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    }));
  }, []);

  const requiredMissing = useMemo(() => {
    return !clean(form.full_name) || !clean(form.email);
  }, [form.email, form.full_name]);

  function updateField<K extends keyof IntakeFields>(key: K, value: IntakeFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function mergedNotes(): string {
    const notes = clean(form.notes);
    const referral = clean(form.referral_source);
    if (!notes && !referral) return "";
    if (notes && !referral) return notes;
    if (!notes && referral) return `How they found us: ${referral}`;
    return `${notes}\n\nHow they found us: ${referral}`;
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiredMissing) {
      setMessage("Please complete Full Name and Email.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const fullName = clean(form.full_name);
      const email = clean(form.email);
      const phone = clean(form.phone);
      const intent = clean(form.intent);
      const timeline = clean(form.timeline);
      const budgetRange = clean(form.budget_range);
      const locationArea = clean(form.location_area);
      const contactPreference = clean(form.contact_preference);
      const referralSource = clean(form.referral_source);
      const notes = mergedNotes();

      const questionnaireAnswers: Record<string, string> = {};
      if (fullName) questionnaireAnswers.full_name = fullName;
      if (email) questionnaireAnswers.email = email;
      if (phone) questionnaireAnswers.phone = phone;
      if (intent) questionnaireAnswers.intent = intent;
      if (timeline) questionnaireAnswers.timeline = timeline;
      if (budgetRange) questionnaireAnswers.budget_range = budgetRange;
      if (locationArea) questionnaireAnswers.location_area = locationArea;
      if (contactPreference) questionnaireAnswers.contact_preference = contactPreference;
      if (referralSource) questionnaireAnswers.source = referralSource;
      if (clean(form.notes)) questionnaireAnswers.notes = clean(form.notes);

      const payload: Record<string, unknown> = {
        full_name: fullName,
        email,
        phone: phone || undefined,
        intent: intent || undefined,
        timeline: timeline || undefined,
        budget_range: budgetRange || undefined,
        location_area: locationArea || undefined,
        contact_preference: contactPreference || undefined,
        notes: notes || undefined,
        questionnaire_answers: questionnaireAnswers,
        source: transport.source || "website_intake",
        external_id: transport.external_id || "",
        website: transport.website || "",
        utm_source: transport.utm_source || "",
        utm_medium: transport.utm_medium || "",
        utm_campaign: transport.utm_campaign || "",
      };

      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as IntakeResponse;
      if (!response.ok || !data.ok) {
        setMessage(data.error || "Could not submit intake form.");
        return;
      }

      setSubmitted(true);
      setMessage(
        data.reminder_created
          ? "Thanks. We received your details and scheduled follow-up."
          : "Thanks. We received your details."
      );
    } catch {
      setMessage("Could not submit intake form.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="crm-card" style={{ marginTop: 14, padding: 16 }}>
        <div style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Request Received</h2>
          <p style={{ margin: 0, color: "var(--ink-muted)", maxWidth: 520 }}>
            Your inquiry has been sent to the agent.
          </p>
          <div className="crm-card-muted" style={{ width: "100%", maxWidth: 560, padding: 14, display: "grid", gap: 8, textAlign: "left" }}>
            <div style={{ fontWeight: 700 }}>What happens next</div>
            <div style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.6 }}>
              The agent will review your request and reach out shortly to discuss next steps or schedule a showing.
            </div>
            <div style={{ fontSize: 13, color: "var(--foreground)" }}>
              Typical response time is within a few hours.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="crm-card" style={{ marginTop: 14, padding: 16 }}>
        <form onSubmit={submitForm} style={{ display: "grid", gap: 12 }}>
          <section className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Contact</div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Full Name <span style={{ color: "var(--danger)" }}>*</span>
                <input
                  required
                  autoComplete="name"
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                  placeholder="Jane Doe"
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Email <span style={{ color: "var(--danger)" }}>*</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="jane@email.com"
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Phone
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="(555) 555-5555"
                />
              </label>
            </div>
          </section>

          <section className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Lead Details</div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Intent
                <select
                  value={form.intent}
                  onChange={(event) => updateField("intent", event.target.value)}
                >
                  <option value="">Select intent</option>
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                  <option value="Invest">Invest</option>
                  <option value="Just browsing">Just browsing</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Timeline
                <input
                  value={form.timeline}
                  onChange={(event) => updateField("timeline", event.target.value)}
                  placeholder="30-60 days"
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Budget Range
                <input
                  value={form.budget_range}
                  onChange={(event) => updateField("budget_range", event.target.value)}
                  placeholder="$400k - $550k"
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Preferred Location
                <input
                  value={form.location_area}
                  onChange={(event) => updateField("location_area", event.target.value)}
                  placeholder="City, neighborhood, or area"
                />
              </label>
            </div>
          </section>

          <section className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Follow-up</div>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Contact Preference
              <select
                value={form.contact_preference}
                onChange={(event) => updateField("contact_preference", event.target.value)}
              >
                <option value="">Select preference</option>
                <option value="Text">Text</option>
                <option value="Call">Call</option>
                <option value="Email">Email</option>
              </select>
            </label>
          </section>

          <section className="crm-card-muted" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Additional</div>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              How did you find us?
              <input
                value={form.referral_source}
                onChange={(event) => updateField("referral_source", event.target.value)}
                placeholder="Instagram, referral, website, etc."
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Notes / Anything else we should know
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Share any additional context."
              />
            </label>
          </section>

          <input
            type="hidden"
            name="source"
            value={transport.source}
          />
          <input type="hidden" name="external_id" value={transport.external_id} />
          <input type="hidden" name="website" value={transport.website} />
          <input type="hidden" name="utm_source" value={transport.utm_source} />
          <input type="hidden" name="utm_medium" value={transport.utm_medium} />
          <input type="hidden" name="utm_campaign" value={transport.utm_campaign} />

          <div>
            <button className="crm-btn crm-btn-primary" type="submit" disabled={saving}>
              {saving ? "Submitting..." : "Submit"}
            </button>
          </div>

          {message ? (
            <div
              style={{ marginTop: 2, width: "fit-content" }}
              className={`crm-chip ${
                message.includes("Could not") || message.includes("Please")
                  ? "crm-chip-danger"
                  : "crm-chip-ok"
              }`}
            >
              {message}
            </div>
          ) : null}
        </form>
      </section>
    </>
  );
}
