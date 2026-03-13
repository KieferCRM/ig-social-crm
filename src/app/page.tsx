import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_STAGE_LABEL } from "@/lib/features";

const proofBullets = [
  "Capture website, bio link, and QR-code inquiries without manual entry",
  "Keep active deals separate from raw inbound leads",
  "See exactly who needs follow-up today",
];

const flowSources = ["Website form", "Open house QR", "Bio link", "Missed calls"];

const howItWorks = [
  {
    step: "01",
    title: "Share your intake form",
    body: "Place one Merlyn form anywhere prospects already find you, from your website to open house QR codes.",
  },
  {
    step: "02",
    title: "Leads land in Merlyn automatically",
    body: "Each inquiry becomes an organized lead with source context attached, ready for review instead of manual entry.",
  },
  {
    step: "03",
    title: "Work the pipeline with clarity",
    body: "Move leads forward, separate active deals cleanly, and focus your day on the next follow-up that matters.",
  },
];

const benefitCards = [
  {
    label: "Capture",
    title: "Serious inquiries arrive already organized",
    body: "Merlyn turns inbound form submissions into structured leads without asking solo agents to re-enter details by hand.",
  },
  {
    label: "Pipeline",
    title: "Your lead flow stays readable",
    body: "Every inquiry sits in a clear stage-based workspace so you can qualify, review, and move quickly.",
  },
  {
    label: "Follow-up",
    title: "Know what needs attention next",
    body: "See follow-up priorities, recent activity, and who deserves outreach today without digging through scattered notes.",
  },
  {
    label: "Deals",
    title: "Track active deals without cluttering lead flow",
    body: "When an opportunity matures, it moves into a dedicated deals view so pipeline health stays easy to read.",
  },
];

const heroBoardLeads = [
  { source: "Website Form", detail: "Buyer inquiry submitted", tag: "New" },
  { source: "Open House QR", detail: "Seller lead captured", tag: "Qualified" },
  { source: "Bio Link Form", detail: "Showing request added", tag: "Showing" },
];

const heroTasks = [
  "Send follow-up to West Loop buyer lead",
  "Review seller intake from Saturday open house",
  "Update River North deal timeline",
];

const stageCounts = [
  { label: "New", value: "08" },
  { label: "Qualified", value: "14" },
  { label: "Deals", value: "03" },
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
            <a href="#how-it-works">How it works</a>
            <a href="#benefits">Why Merlyn</a>
            <a href="#concierge">Concierge</a>
          </nav>

          <div className="merlyn-nav__actions">
            <Link href="/auth" className="merlyn-nav__login">
              Log In
            </Link>
            <Link href="/auth" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>
        </header>

        <section className="merlyn-hero">
          <div className="merlyn-hero__copy">
            <span className="merlyn-hero__eyebrow">Merlyn for solo real estate agents</span>
            <h1>Stop losing serious real estate inquiries.</h1>
            <p className="merlyn-hero__body">
              Merlyn is the inbound lead CRM that captures inquiries through a shareable intake form and an upcoming missed-call Concierge, then organizes leads,
              deals, and follow-ups in one clear workspace.
            </p>

            <div className="merlyn-hero__actions">
              <Link href="/auth" className="merlyn-button merlyn-button-primary">
                Start with Merlyn
              </Link>
              <a href="#how-it-works" className="merlyn-button merlyn-button-secondary">
                See how it works
              </a>
            </div>

            <div className="merlyn-hero__proof">
              {proofBullets.map((item) => (
                <div key={item} className="merlyn-proof-pill">
                  <span className="merlyn-proof-pill__dot" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero__note">
                New signup is currently limited while onboarding is finalized. Existing accounts can sign in normally.
              </p>
            ) : null}
          </div>

          <aside className="merlyn-hero-frame merlyn-surface">
            <div className="merlyn-hero-frame__head">
              <div>
                <div className="merlyn-hero-frame__eyebrow">Inbound lead command center</div>
                <strong>One view for capture, pipeline, and deals</strong>
              </div>
              <span className="merlyn-badge">{PRODUCT_STAGE_LABEL}</span>
            </div>

            <div className="merlyn-hero-grid">
              <section className="merlyn-surface merlyn-stack-card">
                <div className="merlyn-stack-card__head">
                  <span className="merlyn-stack-card__label">New inquiries</span>
                  <span className="merlyn-badge merlyn-badge-subtle">Auto-captured</span>
                </div>
                <div className="merlyn-lead-list">
                  {heroBoardLeads.map((item) => (
                    <article key={item.source} className="merlyn-lead-item">
                      <div>
                        <strong>{item.source}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span>{item.tag}</span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="merlyn-surface merlyn-pipeline-card">
                <div className="merlyn-stack-card__label">Pipeline snapshot</div>
                <div className="merlyn-stage-metrics">
                  {stageCounts.map((item) => (
                    <div key={item.label} className="merlyn-stage-metric">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="merlyn-board-strip" aria-hidden>
                  <span>Intake captured</span>
                  <span>Qualified</span>
                  <span>Showing</span>
                  <span>Deal active</span>
                </div>
              </section>

              <section className="merlyn-surface merlyn-focus-card">
                <div className="merlyn-stack-card__head">
                  <span className="merlyn-stack-card__label">Today&apos;s focus</span>
                  <span className="merlyn-focus-card__count">3 items</span>
                </div>
                <ul className="merlyn-focus-list">
                  {heroTasks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </section>

        <section className="merlyn-flow-band">
          <div className="merlyn-flow-band__group">
            {flowSources.map((item) => (
              <span key={item} className="merlyn-flow-band__chip">
                {item}
              </span>
            ))}
          </div>
          <span className="merlyn-flow-band__arrow" aria-hidden>
            →
          </span>
          <div className="merlyn-flow-band__outcome">
            <strong>Organized leads</strong>
            <span>Clear stages, deal tracking, and follow-up visibility</span>
          </div>
        </section>

        <section id="how-it-works" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">How it works</div>
            <h2>Simple capture in, clear follow-up out.</h2>
            <p>Merlyn gives solo agents a tighter operating flow without turning lead management into admin work.</p>
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

        <section id="benefits" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">Why Merlyn</div>
            <h2>A calmer CRM for inbound real estate business.</h2>
            <p>Built for solo agents who need clearer lead flow, better follow-up visibility, and a cleaner path from inquiry to deal.</p>
          </div>

          <div className="merlyn-benefits-grid">
            {benefitCards.map((card) => (
              <article key={card.title} className="merlyn-surface merlyn-benefit-card">
                <div className="merlyn-benefit-card__label">{card.label}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="concierge" className="merlyn-section">
          <div className="merlyn-surface merlyn-concierge-card">
            <div className="merlyn-concierge-card__copy">
              <div className="merlyn-section-kicker">Concierge</div>
              <h2>Missed-call capture is the next extension.</h2>
              <p>
                Merlyn Concierge is in development. It is designed to text missed callers back, collect inquiry details, and create a lead automatically so missed
                inbound calls do not disappear.
              </p>
            </div>
            <div className="merlyn-concierge-card__meta">
              <span className="merlyn-badge merlyn-badge-warm">Coming soon</span>
              <p>Calling and texting stay contained inside the Concierge flow.</p>
            </div>
          </div>
        </section>

        <section className="merlyn-final-cta">
          <div className="merlyn-final-cta__copy">
            <div className="merlyn-section-kicker">Ready to work inbound leads more clearly?</div>
            <h2>Start with Merlyn and keep serious inquiries moving.</h2>
            <p>Capture inbound leads, keep your pipeline readable, and track deals without the usual solo-agent chaos.</p>
          </div>
          <div className="merlyn-final-cta__actions">
            <Link href="/auth" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>
        </section>

        <footer className="merlyn-footer">
          <div className="merlyn-footer__brand">
            <MerlynMascot variant="full" decorative tone="light" />
            <p>Inbound lead capture, pipeline clarity, and cleaner follow-up for solo real estate agents.</p>
          </div>
          <div className="merlyn-footer__meta">
            <span>{PRODUCT_STAGE_LABEL}</span>
            <span className="merlyn-footer__links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/auth">Start</Link>
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
