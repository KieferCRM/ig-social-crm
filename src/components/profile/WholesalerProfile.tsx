import type { ProfileTestimonial, ProfileListing, ProfileStat, ProfileHowItWorksStep, ProfileTheme } from "@/lib/workspace-settings";

export type PublicProfile = {
  agentId: string;
  slug: string;
  fullName: string;
  brokerage: string;
  companyName: string;
  tagline: string;
  bio: string;
  headshotUrl: string;
  serviceAreas: string[];
  testimonials: ProfileTestimonial[];
  listings: ProfileListing[];
  showContactForm: boolean;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  linkedinUrl: string;
  bookingLink: string;
  officeHoursStart: string;
  officeHoursEnd: string;
  operatorPath: string;
  stats: ProfileStat[];
  howItWorks: ProfileHowItWorksStep[];
  theme?: ProfileTheme | null;
};

const DEFAULT_PALETTE = {
  bg: "#faf8f4",
  surface: "#ffffff",
  green: "#2d4a2d",
  greenLight: "#3d6b3d",
  brown: "#7c5c3a",
  brownLight: "#a07850",
  cream: "#f5f0e8",
  creamDark: "#ede6d6",
  ink: "#1c1c1c",
  inkMuted: "#5a5a4a",
  inkFaint: "#8a8a7a",
  line: "#e0d8c8",
  heroBg: "linear-gradient(160deg, #2d4a2d 0%, #1a2e1a 60%, #0f1f0f 100%)",
} as const;

function buildPalette(theme?: ProfileTheme | null) {
  if (!theme) return DEFAULT_PALETTE;
  return {
    bg: theme.bg,
    surface: theme.surface,
    green: theme.primary,
    greenLight: theme.primaryLight,
    brown: theme.accent,
    brownLight: theme.accent,
    cream: theme.bg,
    creamDark: theme.line,
    ink: theme.ink,
    inkMuted: theme.inkMuted,
    inkFaint: theme.inkMuted,
    line: theme.line,
    heroBg: theme.heroBg,
  };
}

function formatPrice(price: number) {
  if (!price) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function formatHour(hhmm: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return null;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function SocialIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
    facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    tiktok: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    youtube: "M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z",
    linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  };
  const d = icons[type];
  if (!d) return null;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const DEFAULT_HOW_IT_WORKS = [
  { id: "1", step: "01", title: "You Reach Out", body: "Tell us about your property. We listen first — no pressure, no scripts, no wasted time." },
  { id: "2", step: "02", title: "We Come to You", body: "We evaluate quickly and honestly. You get a fair offer based on what the property is actually worth." },
  { id: "3", step: "03", title: "We Close Clean", body: "Fast, straightforward closing on your timeline. We handle the details so you don't have to." },
];

const VALUES = [
  { name: "Integrity", body: "We do what we say. Every handshake, every promise, every deal." },
  { name: "Authenticity", body: "We show up as ourselves — honest, approachable, and real." },
  { name: "Stewardship", body: "Land is a trust passed from one hand to the next. We treat it accordingly." },
  { name: "Connection", body: "Relationships come first. We build our business on people, not just properties." },
  { name: "Legacy", body: "We help families and investors build stories that last for generations." },
  { name: "Work Ethic", body: "Trust earned the old-fashioned way — through consistency and follow-through." },
];

export default function WholesalerProfile({ profile }: { profile: PublicProfile }) {
  const P = buildPalette(profile.theme);
  const displayName = profile.companyName || profile.fullName || "Our Company";
  const tagline = profile.tagline || "Land, lifestyle & legacy — off-market properties done right.";
  const bio = profile.bio || "TerraVixen Co. was built on a love for the land and the people who care for it. We're a land, lifestyle, and legacy company specializing in off-market properties — the kind you don't find online, but through connection, conversation, and trust.\n\nRooted in the earth that grounds us and guided by instinct and a fearless sense of direction, we bring a personal touch back to real estate. Our work is about more than transactions — it's about matching good people with good ground and helping each property's story continue in the right hands.";
  const hoursStart = formatHour(profile.officeHoursStart);
  const hoursEnd = formatHour(profile.officeHoursEnd);

  const socialLinks = [
    { type: "instagram", url: profile.instagramUrl },
    { type: "facebook", url: profile.facebookUrl },
    { type: "tiktok", url: profile.tiktokUrl },
    { type: "youtube", url: profile.youtubeUrl },
    { type: "linkedin", url: profile.linkedinUrl },
  ].filter((s) => s.url);

  const hasTestimonials = profile.testimonials.length > 0;
  const hasListings = profile.listings.length > 0;
  const hasServiceAreas = profile.serviceAreas.length > 0;
  const hasStats = profile.stats.length > 0;
  const howItWorksSteps = profile.howItWorks.length > 0 ? profile.howItWorks : DEFAULT_HOW_IT_WORKS;

  return (
    <div style={{ background: P.bg, minHeight: "100vh", fontFamily: "'Satoshi', 'Avenir Next', 'Segoe UI', sans-serif", color: P.ink }}>

      {/* NAV */}
      <nav style={{ background: P.green, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 rgba(0,0,0,0.2)" }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>{displayName}</span>
        {profile.showContactForm && (
          <a
            href={`/forms/${profile.slug}`}
            style={{ background: P.brownLight, color: "#fff", padding: "9px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}
          >
            Submit a Property
          </a>
        )}
      </nav>

      {/* HERO */}
      <section style={{ background: P.heroBg, padding: "72px 24px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* subtle texture overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 70% 30%, rgba(160,120,80,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

        {profile.headshotUrl ? (
          <img
            src={profile.headshotUrl}
            alt={profile.fullName}
            style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: `3px solid ${P.brownLight}`, marginBottom: 24, position: "relative" }}
          />
        ) : (
          <div style={{ width: 112, height: 112, borderRadius: "50%", background: "rgba(160,120,80,0.25)", border: `2px solid rgba(160,120,80,0.5)`, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, position: "relative" }}>
            🌿
          </div>
        )}

        <h1 style={{ color: "#fff", fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {displayName}
        </h1>
        {profile.fullName && profile.companyName && (
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, margin: "0 0 18px", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>{profile.fullName}</p>
        )}
        <p style={{ color: "rgba(255,255,255,0.82)", fontSize: "clamp(15px, 2.5vw, 19px)", maxWidth: 540, margin: "0 auto 36px", lineHeight: 1.65, fontWeight: 400 }}>
          {tagline}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {profile.showContactForm && (
            <a
              href={`/forms/${profile.slug}`}
              style={{ background: P.brownLight, color: "#fff", padding: "14px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", letterSpacing: "-0.01em" }}
            >
              Submit a Property →
            </a>
          )}
          {profile.bookingLink && (
            <a
              href={profile.bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "14px 32px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}
            >
              Book a Call
            </a>
          )}
        </div>
      </section>

      {/* STATS BAR */}
      {hasStats && (
        <div style={{ background: P.cream, borderBottom: `1px solid ${P.creamDark}` }}>
          <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0 }}>
            {profile.stats.map((stat, i) => (
              <div key={stat.id} style={{ padding: "28px 32px", textAlign: "center", borderRight: i < profile.stats.length - 1 ? `1px solid ${P.line}` : "none", flex: "1 0 140px" }}>
                <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, color: P.green, letterSpacing: "-0.02em", lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: P.inkMuted, marginTop: 6, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px" }}>

        {/* ABOUT */}
        <section style={{ padding: "60px 0 52px", borderBottom: `1px solid ${P.line}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 20px" }}>About</p>
          <p style={{ fontSize: "clamp(16px, 2vw, 18px)", lineHeight: 1.8, color: P.inkMuted, margin: 0, whiteSpace: "pre-wrap" }}>
            {bio}
          </p>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 32px" }}>How It Works</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {howItWorksSteps.map((item) => (
              <div key={item.id} style={{ background: P.cream, borderRadius: 14, padding: "28px 22px", border: `1px solid ${P.creamDark}` }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: P.brownLight, marginBottom: 12 }}>{item.step}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: P.green, marginBottom: 10, letterSpacing: "-0.01em" }}>{item.title}</div>
                <div style={{ fontSize: 13, color: P.inkMuted, lineHeight: 1.65 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SERVICE AREAS */}
        {hasServiceAreas && (
          <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}` }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 22px" }}>Where We Work</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {profile.serviceAreas.map((area) => (
                <span key={area} style={{ background: P.creamDark, color: P.green, padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: `1px solid ${P.line}` }}>
                  {area}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ACTIVE LISTINGS */}
        {hasListings && (
          <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}` }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 28px" }}>Active Deals</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
              {profile.listings.filter((l) => l.status === "active").map((listing) => (
                <div key={listing.id} style={{ background: P.surface, borderRadius: 14, overflow: "hidden", border: `1px solid ${P.line}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.address} style={{ width: "100%", height: 150, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: 150, background: P.cream, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🏡</div>
                  )}
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 6, lineHeight: 1.4 }}>{listing.address}</div>
                    {formatPrice(listing.price) && (
                      <div style={{ fontSize: 17, fontWeight: 900, color: P.green, letterSpacing: "-0.01em" }}>{formatPrice(listing.price)}</div>
                    )}
                    {listing.description && (
                      <div style={{ fontSize: 12, color: P.inkMuted, marginTop: 8, lineHeight: 1.6 }}>{listing.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TESTIMONIALS */}
        {hasTestimonials && (
          <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}` }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 28px" }}>What People Say</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {profile.testimonials.map((t) => (
                <div key={t.id} style={{ background: P.cream, borderRadius: 14, padding: "28px 24px", border: `1px solid ${P.creamDark}` }}>
                  <p style={{ fontSize: 14, lineHeight: 1.75, color: P.inkMuted, margin: "0 0 20px", fontStyle: "italic" }}>&ldquo;{t.text}&rdquo;</p>
                  <div style={{ fontSize: 13, fontWeight: 800, color: P.green, letterSpacing: "-0.01em" }}>{t.author_name}</div>
                  {t.author_role && <div style={{ fontSize: 12, color: P.inkFaint, marginTop: 3 }}>{t.author_role}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* VALUES */}
        <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 32px" }}>What We Stand For</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {VALUES.map((v) => (
              <div key={v.name} style={{ padding: "20px 0", borderTop: `2px solid ${P.creamDark}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: P.green, marginBottom: 8, letterSpacing: "-0.01em" }}>{v.name}</div>
                <div style={{ fontSize: 13, color: P.inkMuted, lineHeight: 1.65 }}>{v.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT CTA */}
        {profile.showContactForm && (
          <section style={{ padding: "52px 0 48px", borderBottom: `1px solid ${P.line}`, textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: P.brownLight, margin: "0 0 16px" }}>Have a Property to Sell?</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, color: P.green, margin: "0 0 14px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              We work directly with motivated sellers.
            </h2>
            <p style={{ fontSize: 15, color: P.inkMuted, margin: "0 0 32px", lineHeight: 1.7, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              Off-market, honest, and fast. If the timing is right and the land is right, we&apos;ll make it simple.
            </p>
            <a
              href={`/forms/${profile.slug}`}
              style={{ display: "inline-block", background: P.green, color: "#fff", padding: "15px 36px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none", letterSpacing: "-0.01em" }}
            >
              Submit Your Property →
            </a>
          </section>
        )}

        {/* FOOTER */}
        <footer style={{ padding: "40px 0 56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {(hoursStart && hoursEnd) && (
            <p style={{ fontSize: 13, color: P.inkFaint, margin: 0 }}>
              Available {hoursStart} – {hoursEnd}
            </p>
          )}
          {socialLinks.length > 0 && (
            <div style={{ display: "flex", gap: 20 }}>
              {socialLinks.map((s) => (
                <a key={s.type} href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: P.inkFaint, display: "flex", alignItems: "center", transition: "color 0.15s" }}>
                  <SocialIcon type={s.type} />
                </a>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: P.inkFaint, margin: 0, letterSpacing: "0.02em" }}>
            Powered by <strong style={{ color: P.brownLight }}>LockboxHQ</strong>
          </p>
        </footer>

      </div>
    </div>
  );
}
