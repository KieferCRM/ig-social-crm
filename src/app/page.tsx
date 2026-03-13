import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_STAGE_LABEL } from "@/lib/features";

const valueBand = [
  "Capture serious inquiries automatically",
  "Keep leads and deals organized",
  "Know exactly who needs follow-up next",
];

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

const captureMethods = [
  {
    title: "Shareable Intake Form",
    kicker: "Live now",
    body: "A simple capture engine for websites, bio links, QR codes, and outbound campaigns. When someone submits, the lead is created automatically in Merlyn.",
    points: [
      "Website and landing-page ready",
      "Useful for bio links and open house QR codes",
      "Feeds directly into your CRM pipeline",
    ],
  },
  {
    title: "Concierge for Missed Calls",
    kicker: "In development",
    body: "When an agent misses a call, Merlyn Concierge is designed to text the lead back, collect inquiry details, and create the lead in the CRM automatically.",
    points: [
      "Built around missed-call recovery",
      "Keeps texting and call language inside Concierge",
      "Extends capture beyond forms without manual re-entry",
    ],
  },
];

const pipelineStages = ["New", "Qualified", "Showing", "Negotiating", "Closed"];

const reminders = [
  "3 leads need first follow-up today",
  "1 open house inquiry still needs qualification",
  "2 active deals are waiting on next-step updates",
];

const productCards = [
  {
    label: "Lead capture",
    title: "See where every inquiry came from",
    body: "From website form submissions to open house QR scans, Merlyn keeps your inbound lead sources organized and visible.",
  },
  {
    label: "Pipeline clarity",
    title: "Work leads without losing context",
    body: "Stages, notes, reminders, and next actions live together so your daily follow-up is easy to prioritize.",
  },
  {
    label: "Deal tracking",
    title: "Keep active deals separate from raw inbound leads",
    body: "Track transactions on a dedicated deals board while your lead pipeline stays focused on conversion and follow-up.",
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
            <a href="#capture-methods">Capture</a>
            <a href="#deals">Deals</a>
            <a href="#follow-up">Follow-Up</a>
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
              Merlyn helps solo agents capture serious inquiries through a shareable intake form and a missed-call Concierge, organize every lead and active deal in one place, and stay clear on who needs follow-up next.
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
                  <span>Buyer inquiry submitted for West Loop condo search</span>
                </div>
                <div className="merlyn-hero-preview__lead">
                  <strong>Open House QR</strong>
                  <span>Seller lead captured after Saturday tour</span>
                </div>
                <div className="merlyn-hero-preview__lead">
                  <strong>Missed Call Text</strong>
                  <span>New inquiry awaiting review in Concierge</span>
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

        <section className="merlyn-value-band">
          {valueBand.map((item) => (
            <div key={item} className="merlyn-value-band__item">
              <span className="merlyn-value-band__dot" aria-hidden />
              <span>{item}</span>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">How it works</div>
            <h2>From inbound inquiry to follow-up clarity in three steps.</h2>
            <p>
              Merlyn is built to reduce manual entry, surface the next move, and keep your lead pipeline readable at a glance.
            </p>
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

        <section id="capture-methods" className="merlyn-section">
          <div className="merlyn-section-head">
            <div className="merlyn-section-kicker">Capture methods</div>
            <h2>Two ways Merlyn brings serious inbound inquiries into the CRM.</h2>
            <p>
              The intake form is the live capture engine today. Concierge is the next extension, built to turn missed calls into structured leads.
            </p>
          </div>

          <div className="merlyn-capture-grid">
            {captureMethods.map((item) => (
              <article key={item.title} className="merlyn-surface merlyn-capture-card">
                <div className="merlyn-capture-card__head">
                  <h3>{item.title}</h3>
                  <span className={`merlyn-badge${item.kicker === "In development" ? " merlyn-badge-warm" : ""}`}>{item.kicker}</span>
                </div>
                <p>{item.body}</p>
                <ul className="merlyn-list">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="merlyn-section merlyn-section-split">
          <div className="merlyn-section-copy">
            <div className="merlyn-section-kicker">Leads and pipeline</div>
            <h2>Keep lead organization simple, visible, and actionable.</h2>
            <p>
              Merlyn gives solo agents a clear lead workspace, a stage-based pipeline, and the context needed to move inquiries forward without losing momentum.
            </p>
            <ul className="merlyn-list">
              <li>Visible lead stages and next actions</li>
              <li>Fast review of inbound form submissions</li>
              <li>Better daily prioritization for follow-up</li>
            </ul>
          </div>

          <div className="merlyn-surface merlyn-showcase">
            <div className="merlyn-showcase__kicker">Lead workspace snapshot</div>
            <div className="merlyn-showcase__grid">
              {productCards.map((card) => (
                <article key={card.title} className="merlyn-showcase__item">
                  <div className="merlyn-showcase__label">{card.label}</div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="deals" className="merlyn-section merlyn-section-split merlyn-section-split-reverse">
          <div className="merlyn-surface merlyn-deals-card">
            <div className="merlyn-deals-card__head">
              <div className="merlyn-showcase__label">Deals board</div>
              <span className="merlyn-badge merlyn-badge-subtle">Separate from leads</span>
            </div>
            <div className="merlyn-deals-card__metrics">
              <div>
                <span>Active deals</span>
                <strong>3</strong>
              </div>
              <div>
                <span>Under contract</span>
                <strong>2</strong>
              </div>
              <div>
                <span>Closing soon</span>
                <strong>1</strong>
              </div>
            </div>
            <p>
              Merlyn tracks active deals separately from raw inbound leads, so your pipeline stays focused on conversion while transactions remain easy to monitor.
            </p>
          </div>

          <div className="merlyn-section-copy">
            <div className="merlyn-section-kicker">Deals</div>
            <h2>Track active deals without muddying your lead pipeline.</h2>
            <p>
              Once an inquiry matures into a real transaction, Merlyn gives it a dedicated place to live. That separation helps agents see both new opportunity flow and active deal progress clearly.
            </p>
            <ul className="merlyn-list">
              <li>Separate board for active transactions</li>
              <li>Clear view of what is still a lead versus a deal</li>
              <li>Better operational clarity from first inquiry to close</li>
            </ul>
          </div>
        </section>

        <section id="follow-up" className="merlyn-section merlyn-section-split">
          <div className="merlyn-section-copy">
            <div className="merlyn-section-kicker">Reminders and follow-up</div>
            <h2>Stay clear on what needs attention next.</h2>
            <p>
              Merlyn is designed to reduce the mental overhead of solo-agent follow-up. The goal is simple: fewer missed opportunities and a clearer daily plan.
            </p>
          </div>

          <div className="merlyn-surface merlyn-reminder-card">
            <div className="merlyn-reminder-card__kicker">Today’s focus</div>
            <ul className="merlyn-reminder-list">
              {reminders.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="merlyn-reminder-card__footer">
              You always know which leads or deals need the next touch.
            </div>
          </div>
        </section>

        <section className="merlyn-final-cta">
          <div className="merlyn-final-cta__copy">
            <div className="merlyn-section-kicker">Ready to stop losing serious inquiries?</div>
            <h2>Stay organized from first inquiry to active deal.</h2>
            <p>
              Merlyn brings inbound capture, pipeline clarity, and deal visibility into one calm operating system for solo agents.
            </p>
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
