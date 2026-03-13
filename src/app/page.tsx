import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const howItWorks = [
  {
    icon: "01",
    title: "Share your intake form",
    body: "Place one Merlyn form on your website, bio links, or open house QR codes.",
  },
  {
    icon: "02",
    title: "Leads land automatically",
    body: "Every submission becomes an organized lead with source context attached.",
  },
  {
    icon: "03",
    title: "Work the pipeline with clarity",
    body: "Review stages, next actions, and active deals without losing track of follow-up.",
  },
];

const benefitCards = [
  {
    title: "Capture without manual entry",
    body: "Inbound form submissions arrive in Merlyn already structured, so solo agents spend less time re-entering details.",
  },
  {
    title: "Stage-based pipeline clarity",
    body: "A clear workspace keeps new inquiries, qualified leads, and active opportunities easy to read at a glance.",
  },
  {
    title: "Know who to follow up with today",
    body: "Merlyn keeps the next important touch visible so serious inquiries do not slip behind the day.",
  },
];

const pipelineRows = [
  { stage: "New inquiry", source: "Website form", detail: "Buyer request added automatically" },
  { stage: "Qualified", source: "Open house QR", detail: "Seller intake reviewed and moved forward" },
  { stage: "Active deal", source: "Deals board", detail: "Timeline and next step visible in one place" },
];

const focusItems = [
  "Follow up with buyer inquiry from website form",
  "Review Saturday open house seller intake",
  "Update next step on active River North deal",
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

          <div className="merlyn-nav__actions">
            <Link href="/auth" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>
        </header>

        <section className="merlyn-hero">
          <div className="merlyn-hero__copy">
            <span className="merlyn-hero__eyebrow">Inbound lead CRM for solo real estate agents</span>
            <h1>Stop losing serious real estate inquiries.</h1>
            <p className="merlyn-hero__body">
              Merlyn captures inbound form submissions from your website, bio link, and QR codes, then organizes leads, deals, and follow-ups in one clear workspace.
            </p>

            <div className="merlyn-hero__actions">
              <Link href="/auth" className="merlyn-button merlyn-button-primary">
                Start with Merlyn
              </Link>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero__note">
                New signup is currently limited while onboarding is finalized. Existing accounts can sign in normally.
              </p>
            ) : null}
          </div>

          <aside className="merlyn-hero-frame merlyn-surface" aria-label="Merlyn product preview">
            <div className="merlyn-hero-frame__head">
              <div>
                <div className="merlyn-hero-frame__eyebrow">Workspace preview</div>
                <strong>Pipeline snapshot and follow-up focus</strong>
              </div>
            </div>

            <div className="merlyn-dashboard-preview">
              <section className="merlyn-dashboard-panel">
                <div className="merlyn-dashboard-panel__head">
                  <span className="merlyn-dashboard-panel__label">Pipeline</span>
                  <span className="merlyn-dashboard-panel__hint">Live view</span>
                </div>

                <div className="merlyn-pipeline-list">
                  {pipelineRows.map((item) => (
                    <article key={item.stage} className="merlyn-pipeline-row">
                      <div className="merlyn-pipeline-row__stage">{item.stage}</div>
                      <div className="merlyn-pipeline-row__body">
                        <strong>{item.source}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="merlyn-dashboard-panel">
                <div className="merlyn-dashboard-panel__head">
                  <span className="merlyn-dashboard-panel__label">Focus today</span>
                  <span className="merlyn-dashboard-panel__hint">3 follow-ups</span>
                </div>

                <ul className="merlyn-focus-list">
                  {focusItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">How it works</div>
            <h2>Three simple steps from inquiry to follow-up.</h2>
          </div>

          <div className="merlyn-steps-grid">
            {howItWorks.map((item) => (
              <article key={item.title} className="merlyn-surface merlyn-step-card">
                <div className="merlyn-step-card__index">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">Why Merlyn</div>
            <h2>Built to make inbound lead management feel lighter.</h2>
          </div>

          <div className="merlyn-benefits-grid merlyn-benefits-grid-compact">
            {benefitCards.map((card) => (
              <article key={card.title} className="merlyn-surface merlyn-benefit-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-surface merlyn-concierge-card merlyn-concierge-card-compact">
            <div className="merlyn-concierge-card__copy">
              <div className="merlyn-section-kicker">Coming soon</div>
              <h2>Missed-call capture is next.</h2>
              <p>Concierge texts missed callers back, collects details, and creates a lead automatically.</p>
            </div>
          </div>
        </section>

        <section className="merlyn-final-cta">
          <div className="merlyn-final-cta__copy">
            <div className="merlyn-section-kicker">Early access</div>
            <h2>Ready to work inbound leads more clearly?</h2>
            <p>Start with Merlyn and keep serious inquiries organized from first form submission to active deal.</p>
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
          </div>
          <div className="merlyn-footer__meta">
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
