import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const positioningBadges = [
  "Built for off-market agents",
  "Deal-first pipeline",
  "Seller context in one place",
  "Documents tied to every opportunity",
  "AI concierge follow-up support",
] as const;

const problemPoints = [
  "Seller conversations, deal notes, and status updates end up split across texts, calls, notebooks, and downloads.",
  "Important context gets lost when several distressed or direct-to-seller opportunities are moving at once.",
  "Contracts, photos, disclosures, and supporting files are buried in folders instead of tied to the right property.",
  "Follow-up is manual, inconsistent, and easy to miss when the day gets busy.",
] as const;

const solutionModules = [
  "Seller contact record",
  "Property details and notes",
  "Documents and files",
  "Deal stage and activity history",
  "Next step and reminders",
  "AI concierge guidance",
] as const;

const featureCards = [
  {
    title: "Deal pipeline visibility",
    body: "Track every opportunity by stage so you can see what is new, active, stalled, or ready to move without digging for it.",
  },
  {
    title: "Property and seller organization",
    body: "Keep seller details, property context, motivation, and supporting notes attached to the actual opportunity.",
  },
  {
    title: "Conversation tracking",
    body: "Store updates, call context, and follow-up notes in one running record so the full deal history stays clear.",
  },
  {
    title: "Opportunity prioritization",
    body: "See which deals need attention now so hot opportunities do not disappear under everything else.",
  },
  {
    title: "Activity timeline",
    body: "Review what happened, when it happened, and what still needs to happen next before you pick up the phone.",
  },
  {
    title: "Task and reminder support",
    body: "Keep momentum on live deals with practical next-step reminders tied directly to the opportunity.",
  },
] as const;

const documentRows = [
  { name: "Purchase agreement", meta: "Signed • Marcus Hale" },
  { name: "Property photos", meta: "8 files • 214 County Line Rd" },
  { name: "Seller notes", meta: "Updated today" },
  { name: "Disclosure packet", meta: "Awaiting upload" },
] as const;

const aiConciergePoints = [
  "Summarize recent seller conversations without rewriting the same notes twice.",
  "Surface missing context before a deal stalls.",
  "Suggest the next practical step based on what has already happened.",
  "Reduce the mental load of remembering who needs what next.",
] as const;

const howItWorksSteps = [
  "An opportunity enters the system from outreach, a reply, or a new seller conversation.",
  "Seller, property, and deal context are organized inside one workspace.",
  "Documents, notes, and activity stay attached to the opportunity as it moves forward.",
  "The AI concierge helps keep next steps clear so the deal does not go quiet.",
] as const;

const useCases = [
  "Managing multiple distressed property conversations at once without losing seller context.",
  "Keeping contract files and supporting material attached to the right opportunity.",
  "Tracking seller notes, timelines, motivation, and missing details before the next call.",
  "Seeing which deals are closest to moving so time goes to the right opportunities first.",
  "Maintaining a clean record of the full opportunity history from first contact through active deal.",
] as const;

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="lockbox-section__header">
      <span className="lockbox-section__eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {body ? <p className="lockbox-offmarket-section-body">{body}</p> : null}
    </div>
  );
}

export default function OffMarketPage() {
  const signInHref = "/auth?track=off_market_agent";
  const signUpHref = "/auth?mode=sign_up&track=off_market_agent";
  const soloHref = "/";

  return (
    <main className="lockbox-marketing lockbox-marketing--home">
      <div className="lockbox-marketing__veil" />

      <div className="lockbox-marketing__container lockbox-marketing__container--home">
        <header className="lockbox-nav">
          <Link href="/" className="lockbox-nav__brand">
            <LockboxMark variant="full" decorative className="lockbox-nav__logo" />
          </Link>

          <div className="lockbox-nav__actions">
            <Link href={signInHref} className="lockbox-button lockbox-button-secondary">
              Sign In
            </Link>
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Get Early Access
            </Link>
          </div>
        </header>

        <section className="lockbox-hero lockbox-hero--home">
          <div className="lockbox-hero__intro">
            <span className="lockbox-hero__eyebrow">Off Market Agent</span>
            <h1>Keep every off-market deal organized in one place.</h1>
            <p className="lockbox-hero__body">
              Off Market Agent is the deal-focused operating system for off-market real estate agents, wholesalers,
              and operators who need seller context, documents, and next steps to stay organized from first
              conversation to active deal.
            </p>

            <div className="lockbox-hero__actions lockbox-hero__actions--home">
              <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
                Get Early Access
              </Link>
              <Link href="#how-it-works" className="lockbox-button lockbox-button-secondary">
                See How It Works
              </Link>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="lockbox-hero__note">
                New signup is currently limited while workspace setup is finalized. Existing accounts can still sign in.
              </p>
            ) : null}
          </div>

          <aside className="lockbox-hero-frame lockbox-surface lockbox-offmarket-frame" aria-label="Off Market Agent workspace preview">
            <div className="lockbox-preview-header">
              <div>
                <div className="lockbox-preview-kicker">Deal workspace</div>
                <h2>The full opportunity picture, without the chaos.</h2>
              </div>
              <span className="lockbox-preview-chip">AI concierge inside</span>
            </div>

            <div className="lockbox-offmarket-board">
              <div className="lockbox-offmarket-column">
                <div className="lockbox-offmarket-column__title">New Opportunity</div>
                <div className="lockbox-offmarket-mini-card">
                  <strong>214 County Line Rd</strong>
                  <span>Marcus Hale • Seller call today</span>
                </div>
              </div>
              <div className="lockbox-offmarket-column">
                <div className="lockbox-offmarket-column__title">Negotiating</div>
                <div className="lockbox-offmarket-mini-card">
                  <strong>83 Cedar Bluff Ln</strong>
                  <span>Awaiting revised agreement</span>
                </div>
              </div>
              <div className="lockbox-offmarket-column">
                <div className="lockbox-offmarket-column__title">Awaiting Docs</div>
                <div className="lockbox-offmarket-mini-card">
                  <strong>17 Willow Creek</strong>
                  <span>Photos uploaded • Disclosure missing</span>
                </div>
              </div>
              <div className="lockbox-offmarket-column">
                <div className="lockbox-offmarket-column__title">Active Deal</div>
                <div className="lockbox-offmarket-mini-card">
                  <strong>Buyer list ready</strong>
                  <span>Cash buyers tagged for blast</span>
                </div>
              </div>
            </div>

            <div className="lockbox-offmarket-detail-grid">
              <section className="lockbox-preview-spotlight">
                <div className="lockbox-preview-spotlight__label">Opportunity detail</div>
                <strong>214 County Line Rd</strong>
                <p>Seller wants options this week. Property analysis complete. Agreement review is the next blocker.</p>
                <div className="lockbox-preview-spotlight__meta">
                  <span>Seller: Marcus Hale</span>
                  <span>Stage: Negotiating</span>
                  <span>Next: Call at 3:30 PM</span>
                </div>
              </section>

              <section className="lockbox-offmarket-ai-panel">
                <div className="lockbox-offmarket-ai-panel__kicker">AI concierge</div>
                <ul className="lockbox-offmarket-ai-panel__list">
                  <li>Seller wants speed more than price certainty.</li>
                  <li>Missing parcel photo and revised agreement upload.</li>
                  <li>Next step: call seller, then send updated docs.</li>
                </ul>
              </section>
            </div>
          </aside>
        </section>

        <section className="lockbox-offmarket-proof-strip lockbox-surface">
          {positioningBadges.map((badge) => (
            <span key={badge} className="lockbox-offmarket-proof-chip">
              {badge}
            </span>
          ))}
        </section>

        <section className="lockbox-section">
          <SectionHeader
            eyebrow="Why this exists"
            title="Off-market opportunities get messy fast when the system is notes, texts, and memory."
            body="This page is built for operators who are juggling seller conversations, property research, files, follow-up, and buyer activity at the same time."
          />

          <div className="lockbox-offmarket-problem-grid">
            {problemPoints.map((point) => (
              <article key={point} className="lockbox-surface lockbox-offmarket-problem-card">
                <div className="lockbox-offmarket-problem-card__icon" aria-hidden>
                  •
                </div>
                <p>{point}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-section">
          <SectionHeader
            eyebrow="The system"
            title="A unified workspace for every opportunity."
            body="Off Market Agent keeps the seller record, property details, documents, notes, stage, activity, and next action attached to the same deal so the full picture stays visible."
          />

          <div className="lockbox-offmarket-solution-grid">
            <div className="lockbox-surface lockbox-offmarket-solution-card">
              <div className="lockbox-offmarket-solution-card__title">Everything tied to the deal</div>
              <div className="lockbox-offmarket-module-grid">
                {solutionModules.map((item) => (
                  <div key={item} className="lockbox-offmarket-module">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="lockbox-surface lockbox-offmarket-solution-card">
              <div className="lockbox-offmarket-solution-card__title">What stays visible</div>
              <div className="lockbox-offmarket-stack">
                <div className="lockbox-offmarket-stack-row">
                  <strong>Seller context</strong>
                  <span>Motivation, notes, and status stay attached to the property.</span>
                </div>
                <div className="lockbox-offmarket-stack-row">
                  <strong>Deal status</strong>
                  <span>See what is hot, stalled, or waiting on documents without rebuilding context.</span>
                </div>
                <div className="lockbox-offmarket-stack-row">
                  <strong>Next step</strong>
                  <span>Know exactly what should happen next before an opportunity cools off.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lockbox-section" id="deal-workflow">
          <SectionHeader
            eyebrow="Deal workflow"
            title="Built around deals, not generic CRM busywork."
            body="The core product view is about visibility, momentum, and keeping each opportunity clean enough to move."
          />

          <div className="lockbox-card-grid lockbox-card-grid--triple">
            {featureCards.map((item) => (
              <article key={item.title} className="lockbox-surface lockbox-info-card lockbox-info-card--overview">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-section">
          <SectionHeader
            eyebrow="Documents organization"
            title="Keep contracts, notes, files, and supporting material attached to the right opportunity."
            body="Every deal has paperwork, photos, notes, disclosures, and context. Off Market Agent keeps it all inside the opportunity so nothing disappears into downloads, inboxes, or random folders."
          />

          <div className="lockbox-offmarket-doc-grid">
            <article className="lockbox-surface lockbox-offmarket-doc-card">
              <div className="lockbox-offmarket-doc-card__header">
                <div>
                  <div className="lockbox-preview-kicker">Opportunity record</div>
                  <h3>214 County Line Rd</h3>
                </div>
                <span className="lockbox-preview-chip">4 attached items</span>
              </div>
              <div className="lockbox-offmarket-doc-meta">
                <span>Seller: Marcus Hale</span>
                <span>Last note: Today, 1:18 PM</span>
                <span>Next action: Send revised agreement</span>
              </div>
              <div className="lockbox-offmarket-doc-list">
                {documentRows.map((row) => (
                  <div key={row.name} className="lockbox-offmarket-doc-row">
                    <strong>{row.name}</strong>
                    <span>{row.meta}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="lockbox-surface lockbox-offmarket-doc-support">
              <h3>What this fixes</h3>
              <p>
                Stop searching through downloads, texts, email attachments, and desktop folders to remember where the
                paperwork lives for a live deal.
              </p>
              <div className="lockbox-offmarket-doc-support__points">
                <span>Agreements tied to the opportunity</span>
                <span>Seller notes next to the docs</span>
                <span>Supporting material in one record</span>
              </div>
            </article>
          </div>
        </section>

        <section className="lockbox-section">
          <SectionHeader
            eyebrow="AI concierge"
            title="Useful AI support that helps keep deals moving."
            body="The AI concierge is embedded into the deal workflow. It is there to reduce the mental load, not to add another tool to manage."
          />

          <div className="lockbox-offmarket-ai-grid">
            <article className="lockbox-surface lockbox-offmarket-ai-feature">
              <div className="lockbox-offmarket-ai-feature__kicker">What it helps with</div>
              <div className="lockbox-offmarket-ai-feature__list">
                {aiConciergePoints.map((point) => (
                  <div key={point} className="lockbox-offmarket-ai-feature__item">
                    <span className="lockbox-offmarket-ai-feature__dot" aria-hidden />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="lockbox-surface lockbox-offmarket-ai-sidecard">
              <div className="lockbox-preview-kicker">Concierge snapshot</div>
              <h3>Your AI concierge helps keep every deal organized.</h3>
              <p>
                It remembers the context so you do not have to, surfaces what matters next, and supports follow-up
                without replacing your judgment.
              </p>
              <div className="lockbox-offmarket-ai-sidecard__summary">
                <strong>Conversation summary</strong>
                <span>Seller cares about timing and wants to review revised terms before Friday.</span>
              </div>
              <div className="lockbox-offmarket-ai-sidecard__summary">
                <strong>Suggested next action</strong>
                <span>Call seller, confirm terms, and upload the updated agreement to the opportunity.</span>
              </div>
            </article>
          </div>
        </section>

        <section className="lockbox-section" id="how-it-works">
          <SectionHeader
            eyebrow="How it works"
            title="A simple operating flow for off-market opportunities."
          />

          <div className="lockbox-offmarket-steps-grid">
            {howItWorksSteps.map((step, index) => (
              <article key={step} className="lockbox-surface lockbox-offmarket-step-card">
                <span className="lockbox-info-card__index">0{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-section">
          <SectionHeader
            eyebrow="Use cases"
            title="Specific to how off-market agents actually work."
          />

          <div className="lockbox-offmarket-usecase-grid">
            {useCases.map((item) => (
              <article key={item} className="lockbox-surface lockbox-offmarket-usecase-card">
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-final-cta lockbox-surface">
          <div className="lockbox-final-cta__copy">
            <span className="lockbox-section__eyebrow">Final step</span>
            <h2>Keep every off-market opportunity organized.</h2>
            <p>
              Request access and see how Off Market Agent helps you track deals, organize documents, and move faster
              with AI-assisted follow-through.
            </p>
          </div>
          <div className="lockbox-final-cta__actions">
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Request Early Access
            </Link>
            <Link href={soloHref} className="lockbox-button lockbox-button-secondary">
              View Solo Agent
            </Link>
          </div>
        </section>

        <footer className="lockbox-footer lockbox-footer--slim">
          <span>Off Market Agent</span>
          <nav className="lockbox-footer__links" aria-label="Footer navigation">
            <Link href="/auth?track=off_market_agent">Sign In</Link>
            <Link href="/">Solo Agent</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
