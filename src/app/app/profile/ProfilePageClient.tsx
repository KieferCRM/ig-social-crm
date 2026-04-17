"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  isPublic: boolean;
  hasContent: boolean;
};

// ── Animated preview cycling through profile sections ─────────────────────────

const PREVIEW_SLIDES = [
  {
    label: "Hero",
    content: (
      <div style={{ background: "linear-gradient(160deg,#2d4a2d 0%,#1a2e1a 60%,#0f1f0f 100%)", padding: "24px 20px", borderRadius: "0 0 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(160,120,80,0.4)", border: "2px solid rgba(160,120,80,0.6)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: "-0.01em" }}>TerraVixen Co.</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>Nashville, TN</div>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Off-market land deals,<br />closed fast and honest.
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 14 }}>
          We specialize in motivated sellers, inherited properties, and pre-foreclosures across Middle Tennessee.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ background: "#a07850", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>Submit a Property →</div>
          <div style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }}>Book a Call</div>
        </div>
      </div>
    ),
  },
  {
    label: "Stats",
    content: (
      <div style={{ background: "#f5f0e8", padding: "20px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a07850", marginBottom: 14 }}>By the numbers</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>
          {[["47+", "Deals Closed"], ["5 yrs", "In Business"], ["100%", "Off-Market"], ["2 days", "Avg Response"]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #e0d8c8" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#2d4a2d", letterSpacing: "-0.02em" }}>{val}</div>
              <div style={{ fontSize: 9, color: "#5a5a4a", marginTop: 3, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Process",
    content: (
      <div style={{ background: "#faf8f4", padding: "20px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a07850", marginBottom: 14 }}>How It Works</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[["01", "You Reach Out", "Tell us about the property. No pressure."], ["02", "We Evaluate", "Fair offer based on what it's actually worth."], ["03", "We Close Clean", "Fast closing on your timeline. We handle it."]].map(([step, title, body]) => (
            <div key={step} style={{ background: "#f0ebe0", borderRadius: 8, padding: "10px 12px", border: "1px solid #e0d8c8" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#a07850", letterSpacing: "0.1em", marginBottom: 3 }}>{step}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#2d4a2d", marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 10, color: "#5a5a4a", lineHeight: 1.4 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Testimonial",
    content: (
      <div style={{ background: "#faf8f4", padding: "20px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a07850", marginBottom: 14 }}>What People Say</div>
        <div style={{ background: "#f0ebe0", borderRadius: 10, padding: "14px 16px", border: "1px solid #e0d8c8", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#5a5a4a", lineHeight: 1.6, fontStyle: "italic", marginBottom: 10 }}>
            &ldquo;Kiefer was straight with us from day one. No games, no lowball surprises. We closed in 11 days and walked away happy.&rdquo;
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#2d4a2d" }}>Marcus T.</div>
          <div style={{ fontSize: 10, color: "#8a8a7a" }}>Inherited property seller</div>
        </div>
        <div style={{ background: "#f0ebe0", borderRadius: 10, padding: "14px 16px", border: "1px solid #e0d8c8" }}>
          <div style={{ fontSize: 11, color: "#5a5a4a", lineHeight: 1.6, fontStyle: "italic", marginBottom: 10 }}>
            &ldquo;I&apos;ve sold three properties through this team. Fast, fair, and they always follow through.&rdquo;
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#2d4a2d" }}>Diana R.</div>
          <div style={{ fontSize: 10, color: "#8a8a7a" }}>Landlord</div>
        </div>
      </div>
    ),
  },
  {
    label: "Palette",
    content: (
      <div style={{ background: "#faf8f4", padding: "20px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a07850", marginBottom: 14 }}>Choose your vibe</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { name: "Earthy", hero: "linear-gradient(135deg,#2d4a2d,#0f1f0f)", accent: "#a07850", active: true },
            { name: "Modern", hero: "linear-gradient(135deg,#1e293b,#0f172a)", accent: "#2563eb", active: false },
            { name: "Bold", hero: "linear-gradient(135deg,#1a1a2e,#0d0d1a)", accent: "#c9a84c", active: false },
            { name: "Warm", hero: "linear-gradient(135deg,#92400e,#5c2d0a)", accent: "#d97706", active: false },
            { name: "Fresh", hero: "linear-gradient(135deg,#0f766e,#065f55)", accent: "#0891b2", active: false },
          ].map(({ name, hero, accent, active }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: active ? "#f0ebe0" : "transparent", border: active ? "1px solid #e0d8c8" : "1px solid transparent" }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: hero, flexShrink: 0 }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: accent, flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "#2d4a2d" : "#5a5a4a" }}>{name}</div>
              {active && <div style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#a07850", letterSpacing: "0.05em" }}>SELECTED</div>}
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const PROMPTS = [
  "I wholesale houses in Nashville. Been doing this 3 years.",
  "We're a land acquisition company working in rural Tennessee and Kentucky.",
  "Solo investor focused on pre-foreclosures and inherited properties.",
  "Off-market acquisition firm. Closed 40+ deals last year.",
  "I flip distressed properties in the Southeast. Work with all conditions.",
  "Small team — we find deals, assign to buyers, close fast.",
];

function AnimatedPreview() {
  const [slide, setSlide] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setSlide((s) => (s + 1) % PREVIEW_SLIDES.length);
        setFading(false);
      }, 300);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Browser chrome */}
      <div style={{ background: "#1e1e1e", borderRadius: "12px 12px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#28c840" }} />
        <div style={{ flex: 1, background: "#2d2d2d", borderRadius: 4, padding: "3px 10px", marginLeft: 8 }}>
          <div style={{ fontSize: 9, color: "#888", letterSpacing: "0.02em" }}>lockboxhq.com/p/your-slug</div>
        </div>
      </div>

      {/* Slide tabs */}
      <div style={{ background: "#f0ebe0", display: "flex", gap: 0, borderBottom: "1px solid #e0d8c8" }}>
        {PREVIEW_SLIDES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => { setFading(true); setTimeout(() => { setSlide(i); setFading(false); }, 150); }}
            style={{
              flex: 1, padding: "6px 4px", fontSize: 9, fontWeight: i === slide ? 800 : 500,
              color: i === slide ? "#2d4a2d" : "#8a8a7a",
              background: i === slide ? "#fff" : "transparent",
              border: "none", cursor: "pointer",
              borderBottom: i === slide ? "2px solid #2d4a2d" : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        borderRadius: "0 0 12px 12px",
        overflow: "hidden",
        transition: "opacity 0.3s",
        opacity: fading ? 0 : 1,
        minHeight: 240,
        border: "1px solid #e0d8c8",
        borderTop: "none",
      }}>
        {PREVIEW_SLIDES[slide].content}
      </div>

      {/* Glow underneath */}
      <div style={{ position: "absolute", bottom: -20, left: "10%", right: "10%", height: 40, background: "rgba(45,74,45,0.2)", filter: "blur(20px)", pointerEvents: "none" }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProfilePageClient({ slug, isPublic, hasContent }: Props) {
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : "https://lockboxhq.com"}/p/${slug}`;
  const [copied, setCopied] = useState(false);
  const [pub, setPub] = useState(isPublic);
  const [toggling, setToggling] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function togglePublic() {
    setToggling(true);
    try {
      await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_public: !pub }),
      });
      setPub((v) => !v);
    } finally {
      setToggling(false);
    }
  }

  // ── Welcome screen ───────────────────────────────────────────────────────────
  if (!hasContent) {
    return (
      <>
        <style>{`
          @keyframes gradientShift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes floatUp {
            0%   { opacity: 0; transform: translateY(16px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(45,74,45,0); }
            50%       { box-shadow: 0 0 32px 4px rgba(45,74,45,0.18); }
          }
          .welcome-prompt-chip:hover {
            background: rgba(255,255,255,0.18) !important;
            border-color: rgba(255,255,255,0.4) !important;
            transform: translateY(-1px);
          }
        `}</style>

        <div style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "32px 20px 64px",
        }}>
          <div style={{ width: "100%", maxWidth: 960 }}>

            {/* Hero card — dark gradient */}
            <div style={{
              borderRadius: 24,
              background: "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 40%, #1c3220 70%, #0f1f0f 100%)",
              backgroundSize: "300% 300%",
              animation: "gradientShift 8s ease infinite",
              padding: "52px 48px 48px",
              marginBottom: 20,
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Texture overlay */}
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(160,120,80,0.12) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(45,74,45,0.2) 0%, transparent 50%)", pointerEvents: "none" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", position: "relative" }}>

                {/* Left column */}
                <div style={{ animation: "floatUp 0.6s ease forwards" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(160,120,80,0.2)", border: "1px solid rgba(160,120,80,0.4)",
                    borderRadius: 20, padding: "5px 12px", marginBottom: 20,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a07850", animation: "pulse-glow 2s ease-in-out infinite" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a07a", letterSpacing: "0.06em", textTransform: "uppercase" }}>LockboxHQ Website Builder</span>
                  </div>

                  <h1 style={{ margin: "0 0 16px", fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                    Your public page,<br />built in 2 minutes.
                  </h1>
                  <p style={{ margin: "0 0 28px", fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
                    Answer 7 questions. We write the copy, set the palette, and publish your site — so sellers and buyers can find you and take action.
                  </p>

                  {/* What you get */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
                    {[
                      ["✦", "Hero with your name, tagline & photo"],
                      ["✦", "Stats bar — deals, years, response time"],
                      ["✦", "Your process in 3 steps"],
                      ["✦", "Testimonials & service areas"],
                      ["✦", "5 color palettes to choose from"],
                      ["✦", "Instant publish — your link, live"],
                    ].map(([icon, text]) => (
                      <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 10, color: "#a07850", flexShrink: 0 }}>{icon}</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{text}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/app/profile/onboard"
                    style={{
                      display: "inline-block",
                      background: "#a07850",
                      color: "#fff",
                      padding: "14px 32px",
                      borderRadius: 10,
                      fontWeight: 800,
                      fontSize: 15,
                      textDecoration: "none",
                      letterSpacing: "-0.01em",
                      animation: "pulse-glow 3s ease-in-out infinite",
                      transition: "transform 0.15s",
                    }}
                  >
                    Let&apos;s build it →
                  </Link>
                  <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    Free · 2 minutes · You can edit anything after
                  </div>
                </div>

                {/* Right column — animated preview */}
                <div style={{ animation: "floatUp 0.6s 0.15s ease both" }}>
                  <AnimatedPreview />
                </div>
              </div>
            </div>

            {/* Suggested prompts */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: "28px 32px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: 6 }}>
                Not sure what to say? Start with one of these:
              </div>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--ink-faint)" }}>
                Click any prompt — the AI will use it as your starting point.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PROMPTS.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/app/profile/onboard?prompt=${encodeURIComponent(prompt)}`}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 20,
                      background: "var(--surface-strong, #f1f5f9)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      color: "var(--ink-muted)",
                      textDecoration: "none",
                      transition: "all 0.15s",
                      display: "inline-block",
                    }}
                    className="welcome-prompt-chip"
                  >
                    &ldquo;{prompt}&rdquo;
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </>
    );
  }

  // ── Hub view (has content) ───────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px 80px" }}>

      {/* Status banner */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 18px", borderRadius: 12, marginBottom: 32,
        background: pub ? "var(--ok-bg, #f0fdf4)" : "var(--surface-strong, #f8fafc)",
        border: `1px solid ${pub ? "var(--ok-border, #bbf7d0)" : "var(--border, #e2e8f0)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: pub ? "var(--ok, #16a34a)" : "var(--ink-faint, #94a3b8)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: pub ? "var(--ok, #16a34a)" : "var(--ink-muted)" }}>
            {pub ? "Live — visible to the public" : "Hidden — only you can see it"}
          </span>
        </div>
        <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: "4px 12px" }} onClick={() => void togglePublic()} disabled={toggling}>
          {toggling ? "..." : pub ? "Take offline" : "Make public"}
        </button>
      </div>

      {/* URL row */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-muted)", marginBottom: 8 }}>Your page URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ flex: 1, fontSize: 13, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--ink)", wordBreak: "break-all" }}>
            {publicUrl}
          </code>
          <button type="button" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={() => void handleCopy()}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn-secondary" style={{ fontSize: 12, whiteSpace: "nowrap", textDecoration: "none" }}>
            Preview →
          </a>
        </div>
      </div>

      {/* Rebuild CTA */}
      <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 14 }}>✨</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>Rebuild with AI</h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.65, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Answer a few questions and we&apos;ll regenerate your page with fresh copy, your stats, and a new palette.
        </p>
        <Link href="/app/profile/onboard" className="crm-btn crm-btn-primary" style={{ fontSize: 14, padding: "12px 28px", textDecoration: "none", fontWeight: 700 }}>
          Rebuild with AI →
        </Link>
      </div>
    </div>
  );
}
