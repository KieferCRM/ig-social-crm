import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_STAGE_LABEL } from "@/lib/features";

const howItWorks = [
  {
    step: "01",
    title: "Share your intake form",
    body: "Place one Merlyn form on your website, bio links, Facebook blasts, or open house QR codes.",
  },
  {
    step: "02",
    title: "Inquiries become organized leads",
    body: "Every form submission lands inside the CRM with context attached, ready for review and follow-up.",
  },
  {
    step: "03",
    title: "Work the pipeline with clarity",
    body: "Move leads through stages, track active deals, and stay clear on what deserves attention today.",
  },
];

const pipelineStages = ["New", "Qualified", "Showing", "Negotiating", "Closed"];

const productCards = [
  {
    label: "Capture",
    title: "Bring serious inquiries into the CRM automatically",
    body: "Use one shareable intake form across your website, bio links, Facebook blasts, and open house QR codes.",
  },
  {
    label: "Pipeline",
    title: "See what needs follow-up without digging",
    body: "Leads arrive organized, move through clear stages, and stay easy to review when it is time to act.",
  },
  {
    label: "Deals",
    title: "Track active deals separately from raw leads",
    body: "Once an opportunity matures, Merlyn gives it a dedicated deals board so your pipeline stays clean.",
  },
];

export default function HomePage() {
  return (
    <main className="merlyn-marketing">
      <div className="merlyn-marketing__veil" />

      <div className="merlyn-marketing__container">
        <header className="merlyn-nav">
          <Link href="/" className="merlyn-nav__brand">
            <MerlynMascot variant="full" decorative className="merlyn-nav__logo" />
          </Link>

          <nav className="merlyn-nav__links" aria-label="Primary">
            <a href="#how-it-works">How It Works</a>
            <a href="#product-overview">Product</a>
            <a href="#concierge">Concierge</a>
          </nav>

          <div className="merlyn-nav__actions">
            <span className="merlyn-badge">{PRODUCT_STAGE_LABEL}</span>
            <Link href="/auth" className="merlyn-button merlyn-button-secondary">
              Log In
            </Link>
            <Link href="/auth" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>
        </header>

        <section className="merlyn-hero-section">
          <div className="merlyn-hero-copy">
            <div className="merlyn-section-kicker">Inbound lead command center for solo real estate agents</div>
            <h1>Capture inbound real estate leads automatically.</h1>
            <p className="merlyn-hero-copy__body">
              Merlyn helps solo agents capture serious inquiries through a shareable intake form and a missed-call Concierge, organize leads and deals in one place, and know exactly who needs follow-up next.
            </p>

            <div className="merlyn-hero-copy__actions">
              <Link href="/auth" className="merlyn-button merlyn-button-primary">
                Start with Merlyn
              </Link>
              <a href="#how-it-works" className="merlyn-button merlyn-button-secondary">
                See How It Works
              </a>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero-copy__note">
                New signup is currently limited while onboarding is finalized. Existing accounts can sign in normally.
              </p>
            ) : null}
          </div>

          <aside className="merlyn-hero-preview">
            <div className="merlyn-hero-preview__topbar">
              <span className="merlyn-hero-preview__eyebrow">Product view</span>
              <span className="merlyn-badge merlyn-badge-subtle">Live workflow</span>
            </div>

            <div className="merlyn-hero-preview__board">
              <section className="merlyn-hero-preview__panel">
                <div className="merlyn-hero-preview__panel-kicker">New inquiries</div>
                <div className="merlyn-hero-preview__lead">
                  <strong>Website Form</strong>
                  <span>Buyer inquiry submitted and added automatically</span>
                </div>
                <div className="merlyn-hero-preview__lead">
                  <strong>Open House QR</strong>
                  <span>Seller lead captured after Saturday tour</span>
                </div>
                <div className="merlyn-hero-preview__lead">
                  <strong>Missed Call Text</strong>
                  <span>Upcoming Concierge flow creates a lead after the reply</span>
                </div>
              </section>

              <section className="merlyn-hero-preview__panel">
                <div className="merlyn-hero-preview__panel-kicker">Pipeline today</div>
                <div className="merlyn-stage-strip">
                  {pipelineStages.map((stage) => (
                    <span key={stage} className="merlyn-stage-pill">
                      {stage}
                    </span>
                  ))}
                </div>
                <div className="merlyn-hero-preview__metric-row">
                  <div>
                    <div className="merlyn-hero-preview__metric-label">Needs follow-up</div>
                    <div className="merlyn-hero-preview__metric-value">5</div>
                  </div>
                  <div>
                    <div className="merlyn-hero-preview__metric-label">Active deals</div>
                    <div className="merlyn-hero-preview__metric-value">3</div>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </section>

        <section id="how-it-works" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">How it works</div>
            <h2>From inquiry to follow-up clarity in three simple steps.</h2>
            <p>Share the form, let leads appear automatically, and work the pipeline with less manual cleanup.</p>
          </div>

          <div className="merlyn-steps-grid">
            {howItWorks.map((item) => (
              <article key={item.step} className="merlyn-surface merlyn-step-card">
                <div className="merlyn-step-card__index">{item.step}</div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="product-overview" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">Product overview</div>
            <h2>Capture, organize, and move opportunities forward.</h2>
            <p>Merlyn keeps the story simple: capture inbound leads, work the pipeline clearly, and track active deals separately.</p>
          </div>

          <div className="merlyn-steps-grid merlyn-product-grid">
            {productCards.map((card) => (
              <article key={card.title} className="merlyn-surface merlyn-step-card">
                <div className="merlyn-showcase__label">{card.label}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="concierge" className="merlyn-section">
          <div className="merlyn-surface merlyn-concierge-band">
            <div className="merlyn-concierge-band__copy">
              <div className="merlyn-section-kicker">Concierge</div>
              <h2>Missed-call capture, without the manual chase.</h2>
              <p>
                Merlyn Concierge is coming soon. It is designed to text missed callers back, collect inquiry details, and create the lead in the CRM automatically.
              </p>
            </div>
            <span className="merlyn-badge merlyn-badge-warm">Coming soon</span>
          </div>
        </section>

        <section className="merlyn-final-cta">
          <div className="merlyn-final-cta__copy">
            <div className="merlyn-section-kicker">Ready to stop losing serious inquiries?</div>
            <h2>Start with a clearer way to capture and work inbound leads.</h2>
            <p>Merlyn helps solo agents stay organized from first inquiry to active deal without adding more manual work.</p>
          </div>
          <div className="merlyn-final-cta__actions">
            <Link href="/auth" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
            <Link href="/auth" className="merlyn-button merlyn-button-secondary">
              Sign In
            </Link>
          </div>
        </section>

        <footer className="merlyn-footer">
          <div className="merlyn-footer__brand">
            <MerlynMascot variant="full" decorative tone="light" />
            <p>Inbound lead capture and pipeline clarity for solo real estate agents.</p>
          </div>
          <div className="merlyn-footer__meta">
            <span>{PRODUCT_STAGE_LABEL}</span>
            <span className="merlyn-footer__links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/auth">Log In</Link>
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
