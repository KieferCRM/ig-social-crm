import type { ProfileTestimonial, ProfileListing } from "@/lib/workspace-settings";

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
};

const P = {
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
} as const;

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

export default function WholesalerProfile({ profile }: { profile: PublicProfile }) {
  const displayName = profile.companyName || profile.fullName || "Our Company";
  const tagline = profile.tagline || "Land, lifestyle & legacy — off-market properties done right.";
  const bio = profile.bio || "We specialize in off-market properties — the kind you won't find listed online. Our work is built on genuine relationships, honest communication, and a deep respect for the land and the people connected to it.";
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

  return (
    <div style={{ background: P.bg, minHeight: "100vh", fontFamily: "'Satoshi', 'Avenir Next', 'Segoe UI', sans-serif", color: P.ink }}>

      {/* NAV */}
      <nav style={{ background: P.green, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>{displayName}</span>
        {profile.showContactForm && (
          <a
            href={`/forms/${profile.slug}`}
            style={{ background: P.brownLight, color: "#fff", padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Submit a Property
          </a>
        )}
      </nav>

      {/* HERO */}
      <section style={{ background: `linear-gradient(160deg, ${P.green} 0%, #1a2e1a 100%)`, padding: "64px 24px 56px", textAlign: "center" }}>
        {profile.headshotUrl && (
          <img
            src={profile.headshotUrl}
            alt={profile.fullName}
            style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: `3px solid ${P.brownLight}`, marginBottom: 20 }}
          />
        )}
        {!profile.headshotUrl && (
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: P.brownLight, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
            🌿
          </div>
        )}
        <h1 style={{ color: "#fff", fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {displayName}
        </h1>
        {profile.fullName && profile.companyName && (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, margin: "0 0 16px" }}>{profile.fullName}</p>
        )}
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "clamp(15px, 2.5vw, 18px)", maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.6 }}>
          {tagline}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {profile.showContactForm && (
            <a
              href={`/forms/${profile.slug}`}
              style={{ background: P.brownLight, color: "#fff", padding: "13px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
            >
              Submit a Property
            </a>
          )}
          {profile.bookingLink && (
            <a
              href={profile.bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", padding: "13px 28px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", border: "1px solid rgba(255,255,255,0.25)" }}
            >
              Book a Call
            </a>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>

        {/* ABOUT */}
        <section style={{ padding: "52px 0 44px", borderBottom: `1px solid ${P.line}` }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.brown, margin: "0 0 16px" }}>About</h2>
          <p style={{ fontSize: "clamp(15px, 2vw, 17px)", lineHeight: 1.75, color: P.inkMuted, margin: 0, whiteSpace: "pre-wrap" }}>
            {bio}
          </p>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ padding: "48px 0 44px", borderBottom: `1px solid ${P.line}` }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.brown, margin: "0 0 28px" }}>How It Works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
            {[
              { step: "01", title: "You Reach Out", body: "Tell us about your property. We listen first — no pressure, no scripts." },
              { step: "02", title: "We Evaluate", body: "We assess the opportunity quickly and come back with an honest offer." },
              { step: "03", title: "We Close", body: "Fast, straightforward closing. We handle the details so you don't have to." },
            ].map((item) => (
              <div key={item.step} style={{ background: P.cream, borderRadius: 12, padding: "24px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: P.brownLight, marginBottom: 10 }}>{item.step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: P.green, marginBottom: 8 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: P.inkMuted, lineHeight: 1.6 }}>{item.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SERVICE AREAS */}
        {hasServiceAreas && (
          <section style={{ padding: "48px 0 44px", borderBottom: `1px solid ${P.line}` }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.brown, margin: "0 0 20px" }}>Service Areas</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {profile.serviceAreas.map((area) => (
                <span key={area} style={{ background: P.creamDark, color: P.green, padding: "7px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                  {area}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ACTIVE LISTINGS */}
        {hasListings && (
          <section style={{ padding: "48px 0 44px", borderBottom: `1px solid ${P.line}` }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.brown, margin: "0 0 24px" }}>Active Deals</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {profile.listings.filter((l) => l.status === "active").map((listing) => (
                <div key={listing.id} style={{ background: P.surface, borderRadius: 12, overflow: "hidden", border: `1px solid ${P.line}` }}>
                  {listing.image_url && (
                    <img src={listing.image_url} alt={listing.address} style={{ width: "100%", height: 140, objectFit: "cover" }} />
                  )}
                  {!listing.image_url && (
                    <div style={{ width: "100%", height: 140, background: P.cream, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🏡</div>
                  )}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: P.ink, marginBottom: 4, lineHeight: 1.4 }}>{listing.address}</div>
                    {formatPrice(listing.price) && (
                      <div style={{ fontSize: 15, fontWeight: 800, color: P.green }}>{formatPrice(listing.price)}</div>
                    )}
                    {listing.description && (
                      <div style={{ fontSize: 12, color: P.inkMuted, marginTop: 6, lineHeight: 1.5 }}>{listing.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TESTIMONIALS */}
        {hasTestimonials && (
          <section style={{ padding: "48px 0 44px", borderBottom: `1px solid ${P.line}` }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.brown, margin: "0 0 24px" }}>What People Say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {profile.testimonials.map((t) => (
                <div key={t.id} style={{ background: P.cream, borderRadius: 12, padding: "24px 20px" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: P.inkMuted, margin: "0 0 16px", fontStyle: "italic" }}>"{t.text}"</p>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.green }}>{t.author_name}</div>
                  {t.author_role && <div style={{ fontSize: 12, color: P.inkFaint, marginTop: 2 }}>{t.author_role}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CONTACT CTA */}
        {profile.showContactForm && (
          <section style={{ padding: "48px 0 44px", borderBottom: `1px solid ${P.line}`, textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: P.green, margin: "0 0 12px", letterSpacing: "-0.01em" }}>Have a property to sell?</h2>
            <p style={{ fontSize: 15, color: P.inkMuted, margin: "0 0 28px", lineHeight: 1.6 }}>
              We work with motivated sellers directly. Off-market, honest, and fast.
            </p>
            <a
              href={`/forms/${profile.slug}`}
              style={{ display: "inline-block", background: P.green, color: "#fff", padding: "14px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
            >
              Submit Your Property
            </a>
          </section>
        )}

        {/* FOOTER */}
        <footer style={{ padding: "36px 0 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {(hoursStart && hoursEnd) && (
            <p style={{ fontSize: 13, color: P.inkFaint, margin: 0 }}>
              Available {hoursStart} – {hoursEnd}
            </p>
          )}
          {socialLinks.length > 0 && (
            <div style={{ display: "flex", gap: 16 }}>
              {socialLinks.map((s) => (
                <a key={s.type} href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: P.inkMuted, display: "flex", alignItems: "center" }}>
                  <SocialIcon type={s.type} />
                </a>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: P.inkFaint, margin: 0 }}>
            Powered by <strong style={{ color: P.brownLight }}>LockboxHQ</strong>
          </p>
        </footer>

      </div>
    </div>
  );
}
