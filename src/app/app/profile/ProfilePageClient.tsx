"use client";

import { useState } from "react";
import type { ProfileTemplate, ProfileTestimonial, ProfileListing, ProfileStat, ProfileHowItWorksStep, ProfileTheme } from "@/lib/workspace-settings";

type ProfileSettings = {
  booking_link: string;
  profile_company_name: string;
  profile_tagline: string;
  profile_bio: string;
  profile_headshot_url: string;
  profile_service_areas: string[];
  profile_testimonials: ProfileTestimonial[];
  profile_listings: ProfileListing[];
  profile_show_contact_form: boolean;
  profile_public: boolean;
  profile_template: ProfileTemplate;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  profile_stats: ProfileStat[];
  profile_how_it_works: ProfileHowItWorksStep[];
  profile_theme: ProfileTheme | null;
};

type Props = {
  slug: string;
  fullName: string;
  initialSettings: ProfileSettings;
};

export default function ProfilePageClient({ slug, fullName, initialSettings }: Props) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${slug}`;
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<ProfileSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newArea, setNewArea] = useState("");

  function set<K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json() as { settings?: unknown; error?: string };
      if (!res.ok || !data.settings) {
        setError(data.error ?? "Could not save.");
      } else {
        setSaved(true);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function addArea() {
    const area = newArea.trim();
    if (!area || settings.profile_service_areas.includes(area)) return;
    set("profile_service_areas", [...settings.profile_service_areas, area]);
    setNewArea("");
  }

  function removeArea(area: string) {
    set("profile_service_areas", settings.profile_service_areas.filter((a) => a !== area));
  }

  function addListing() {
    const id = `listing-${Date.now()}`;
    set("profile_listings", [...settings.profile_listings, { id, address: "", price: 0, description: "", status: "active", image_url: "" }]);
  }

  function updateListing(id: string, patch: Partial<ProfileListing>) {
    set("profile_listings", settings.profile_listings.map((l) => l.id === id ? { ...l, ...patch } : l));
  }

  function removeListing(id: string) {
    set("profile_listings", settings.profile_listings.filter((l) => l.id !== id));
  }

  function addStat() {
    const id = `stat-${Date.now()}`;
    set("profile_stats", [...settings.profile_stats, { id, label: "", value: "" }]);
  }
  function updateStat(id: string, patch: Partial<ProfileStat>) {
    set("profile_stats", settings.profile_stats.map((s) => s.id === id ? { ...s, ...patch } : s));
  }
  function removeStat(id: string) {
    set("profile_stats", settings.profile_stats.filter((s) => s.id !== id));
  }

  function addHowItWorksStep() {
    const idx = settings.profile_how_it_works.length + 1;
    const id = `step-${Date.now()}`;
    set("profile_how_it_works", [...settings.profile_how_it_works, { id, step: `0${idx}`, title: "", body: "" }]);
  }
  function updateHowItWorksStep(id: string, patch: Partial<ProfileHowItWorksStep>) {
    set("profile_how_it_works", settings.profile_how_it_works.map((s) => s.id === id ? { ...s, ...patch } : s));
  }
  function removeHowItWorksStep(id: string) {
    set("profile_how_it_works", settings.profile_how_it_works.filter((s) => s.id !== id));
  }

  function addTestimonial() {
    const id = `t-${Date.now()}`;
    set("profile_testimonials", [...settings.profile_testimonials, { id, author_name: "", author_role: "", text: "" }]);
  }

  function updateTestimonial(id: string, patch: Partial<ProfileTestimonial>) {
    set("profile_testimonials", settings.profile_testimonials.map((t) => t.id === id ? { ...t, ...patch } : t));
  }

  function removeTestimonial(id: string) {
    set("profile_testimonials", settings.profile_testimonials.filter((t) => t.id !== id));
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, background: "#fff", color: "var(--foreground)" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--foreground)" };
  const sectionStyle: React.CSSProperties = { marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid var(--line)" };
  const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--foreground)" };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" }}>My Public Page</h1>
        <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: 0 }}>
          This is your public-facing page. Share it with sellers, buyers, and anyone you work with.
        </p>
      </div>

      {/* Public URL */}
      <div style={{ ...sectionStyle, background: "var(--surface-strong)", borderRadius: 12, padding: 20, border: "1px solid var(--line)", marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 10 }}>Your Page URL</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ flex: 1, fontSize: 14, color: "var(--foreground)", background: "#fff", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", wordBreak: "break-all" }}>
            {publicUrl}
          </code>
          <button onClick={() => void handleCopy()} className="crm-btn crm-btn-secondary" style={{ whiteSpace: "nowrap", fontSize: 13 }}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <a href="/app/profile/onboard" className="crm-btn crm-btn-secondary" style={{ whiteSpace: "nowrap", fontSize: 13, textDecoration: "none" }}>
            ✨ Build with AI
          </a>
          <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn-secondary" style={{ whiteSpace: "nowrap", fontSize: 13, textDecoration: "none" }}>
            Preview →
          </a>
        </div>
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Basic Info</div>
        <div style={{ display: "grid", gap: 16 }}>
          <label>
            <span style={labelStyle}>Company / Business Name</span>
            <input style={inputStyle} value={settings.profile_company_name} onChange={(e) => set("profile_company_name", e.target.value)} placeholder={`e.g. TerraVixen Co.`} />
          </label>
          <label>
            <span style={labelStyle}>Tagline</span>
            <input style={inputStyle} value={settings.profile_tagline} onChange={(e) => set("profile_tagline", e.target.value)} placeholder="Land, lifestyle & legacy — off-market properties done right." />
          </label>
          <label>
            <span style={labelStyle}>Bio</span>
            <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} value={settings.profile_bio} onChange={(e) => set("profile_bio", e.target.value)} placeholder="Tell people who you are and what you do..." />
          </label>
          <label>
            <span style={labelStyle}>Headshot URL</span>
            <input style={inputStyle} value={settings.profile_headshot_url} onChange={(e) => set("profile_headshot_url", e.target.value)} placeholder="https://..." />
            <span style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4, display: "block" }}>Image upload coming soon — paste a URL for now.</span>
          </label>
          <label>
            <span style={labelStyle}>Booking Link</span>
            <input style={inputStyle} value={settings.booking_link} onChange={(e) => set("booking_link", e.target.value)} placeholder="https://calendly.com/your-link" />
            <span style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4, display: "block" }}>Adds a &ldquo;Book a Call&rdquo; button to your public page.</span>
          </label>
        </div>
      </div>

      {/* Service Areas */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Service Areas</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {settings.profile_service_areas.map((area) => (
            <span key={area} style={{ background: "var(--surface-strong)", border: "1px solid var(--line)", padding: "5px 12px", borderRadius: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              {area}
              <button onClick={() => removeArea(area)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="e.g. Nashville, TN" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }} />
          <button onClick={addArea} className="crm-btn crm-btn-secondary" style={{ whiteSpace: "nowrap", fontSize: 13 }}>Add</button>
        </div>
      </div>

      {/* Stats */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={sectionTitleStyle}>Stats</div>
            <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "-12px 0 0" }}>Numbers that build trust — deals closed, years in business, states served, etc. Shows as a bar under your hero.</p>
          </div>
          <button onClick={addStat} className="crm-btn crm-btn-secondary" style={{ fontSize: 13, flexShrink: 0 }}>+ Add</button>
        </div>
        {settings.profile_stats.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>No stats yet. Example: Value = "47", Label = "Deals Closed".</p>
        )}
        {settings.profile_stats.map((stat) => (
          <div key={stat.id} style={{ background: "var(--surface-strong)", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>Value</div>
                <input style={inputStyle} value={stat.value} onChange={(e) => updateStat(stat.id, { value: e.target.value })} placeholder="47" />
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>Label</div>
                <input style={inputStyle} value={stat.label} onChange={(e) => updateStat(stat.id, { label: e.target.value })} placeholder="Deals Closed" />
              </div>
            </div>
            <button onClick={() => removeStat(stat.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, padding: 0 }}>Remove</button>
          </div>
        ))}
      </div>

      {/* Listings */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={sectionTitleStyle}>Active Listings / Deals</div>
          <button onClick={addListing} className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>+ Add</button>
        </div>
        {settings.profile_listings.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>No listings yet. Add one to display it on your page.</p>
        )}
        {settings.profile_listings.map((listing) => (
          <div key={listing.id} style={{ background: "var(--surface-strong)", borderRadius: 10, padding: 16, marginBottom: 12, border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={inputStyle} value={listing.address} onChange={(e) => updateListing(listing.id, { address: e.target.value })} placeholder="Address" />
              <div style={{ display: "flex", gap: 10 }}>
                <input style={inputStyle} type="number" value={listing.price || ""} onChange={(e) => updateListing(listing.id, { price: Number(e.target.value) })} placeholder="Price" />
                <select style={inputStyle} value={listing.status} onChange={(e) => updateListing(listing.id, { status: e.target.value as ProfileListing["status"] })}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
              <input style={inputStyle} value={listing.description} onChange={(e) => updateListing(listing.id, { description: e.target.value })} placeholder="Short description" />
              <input style={inputStyle} value={listing.image_url} onChange={(e) => updateListing(listing.id, { image_url: e.target.value })} placeholder="Image URL (optional)" />
              <button onClick={() => removeListing(listing.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, textAlign: "left", padding: 0 }}>Remove listing</button>
            </div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={sectionTitleStyle}>How It Works</div>
            <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "-12px 0 16px" }}>Explain your process in 3–4 steps. Leave empty to use the default steps.</p>
          </div>
          <button onClick={addHowItWorksStep} className="crm-btn crm-btn-secondary" style={{ fontSize: 13, flexShrink: 0 }}>+ Add Step</button>
        </div>
        {settings.profile_how_it_works.map((step) => (
          <div key={step.id} style={{ background: "var(--surface-strong)", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 80 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>Step #</div>
                  <input style={inputStyle} value={step.step} onChange={(e) => updateHowItWorksStep(step.id, { step: e.target.value })} placeholder="01" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink-muted)" }}>Title</div>
                  <input style={inputStyle} value={step.title} onChange={(e) => updateHowItWorksStep(step.id, { title: e.target.value })} placeholder="You Reach Out" />
                </div>
              </div>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={step.body} onChange={(e) => updateHowItWorksStep(step.id, { body: e.target.value })} placeholder="Describe this step..." />
              <button onClick={() => removeHowItWorksStep(step.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, padding: 0, textAlign: "left" }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Testimonials */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={sectionTitleStyle}>Testimonials</div>
          <button onClick={addTestimonial} className="crm-btn crm-btn-secondary" style={{ fontSize: 13 }}>+ Add</button>
        </div>
        {settings.profile_testimonials.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>No testimonials yet.</p>
        )}
        {settings.profile_testimonials.map((t) => (
          <div key={t.id} style={{ background: "var(--surface-strong)", borderRadius: 10, padding: 16, marginBottom: 12, border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input style={inputStyle} value={t.author_name} onChange={(e) => updateTestimonial(t.id, { author_name: e.target.value })} placeholder="Name" />
                <input style={inputStyle} value={t.author_role} onChange={(e) => updateTestimonial(t.id, { author_role: e.target.value })} placeholder="Role (optional)" />
              </div>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={t.text} onChange={(e) => updateTestimonial(t.id, { text: e.target.value })} placeholder="What did they say?" />
              <button onClick={() => removeTestimonial(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, textAlign: "left", padding: 0 }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Social Links */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Social Links</div>
        <div style={{ display: "grid", gap: 12 }}>
          {(["instagram_url", "facebook_url", "tiktok_url", "youtube_url", "linkedin_url"] as const).map((key) => (
            <label key={key}>
              <span style={labelStyle}>{key.replace("_url", "").replace(/^\w/, (c) => c.toUpperCase())}</span>
              <input style={inputStyle} value={settings[key]} onChange={(e) => set(key, e.target.value)} placeholder="https://..." />
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Options</div>
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.profile_public} onChange={(e) => set("profile_public", e.target.checked)} style={{ width: "auto", marginTop: 2 }} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Make page public</span>
              <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "3px 0 0" }}>
                When off, your page is hidden — visitors see a "not found" page. Turn this on when you&apos;re ready to share your link.
              </p>
            </div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={settings.profile_show_contact_form} onChange={(e) => set("profile_show_contact_form", e.target.checked)} style={{ width: "auto" }} />
            <span style={{ fontSize: 14 }}>Show &quot;Submit a Property&quot; contact form button</span>
          </label>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => void handleSave()} className="crm-btn crm-btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "var(--ok)" }}>Saved</span>}
        {error && <span style={{ fontSize: 13, color: "var(--danger)" }}>{error}</span>}
      </div>

    </div>
  );
}
