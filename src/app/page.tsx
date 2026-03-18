import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const howItWorks = [
  {
    title: "Capture every inbound inquiry",
    body: "Share one intake link on your social profiles, website, open houses, or anywhere you connect with clients.",
  },
  {
    title: "Organize it into a deal automatically",
    body: "Each inquiry lands with source, timeframe, contact details, and a working deal record already started.",
  },
  {
    title: "Know the next move quietly",
    body: "LockboxHQ surfaces the next step, hot leads, and active deal work without turning the CRM into a command center.",
  },
] as const;

const overviewCards = [
  {
    title: "Inbound capture",
    body: "One shareable intake link works across social profiles, your website, open houses, and QR placements.",
  },
  {
    title: "Deal-first visibility",
    body: "See which deals are active, which inquiries are hot, and what needs an update right now.",
  },
  {
    title: "Quiet follow-up guidance",
    body: "Get one clear next best action instead of a noisy pile of reminders and AI widgets.",
  },
] as const;

const workflowItems = [
  { label: "New inquiry", source: "Intake form", detail: "Buyer asks about East Nashville and wants to move within 0-3 months." },
  { label: "Hot lead", source: "Open house QR", detail: "Seller gave a direct callback number and needs a quick follow-up." },
  { label: "Next action", source: "Today", detail: "Text Jordan first, then call this afternoon if there is no reply." },
] as const;

export default function HomePage() {
  const primaryHref = "/auth?mode=sign_up";
  const secondaryHref = "/auth";

  return (
    <main className="lockbox-marketing lockbox-marketing--home">
      <div className="lockbox-marketing__veil" />

      <div className="lockbox-marketing__container lockbox-marketing__container--home">
        <header className="lockbox-nav">
          <Link href="/" className="lockbox-nav__brand">
            <LockboxMark variant="full" decorative className="lockbox-nav__logo" />
          </Link>

          <div className="lockbox-nav__actions">
            <Link href={secondaryHref} className="lockbox-button lockbox-button-secondary">
              Sign In
            </Link>
            <Link href={primaryHref} className="lockbox-button lockbox-button-primary">
              Start your workspace
            </Link>
          </div>
        </header>

        <section className="lockbox-hero lockbox-hero--home">
          <div className="lockbox-hero__intro">
            <span className="lockbox-hero__eyebrow">Self-filling CRM for solo real estate agents</span>
            <h1>Capture the inquiry, create the deal, and show the next best step.</h1>
            <p className="lockbox-hero__body">
              LockboxHQ fills itself. Share one intake link anywhere you get clients — social profiles, your
              website, open houses — and every inquiry lands as an organized deal without manual CRM entry.
            </p>

            <div className="lockbox-hero__actions lockbox-hero__actions--home">
              <Link href={primaryHref} className="lockbox-button lockbox-button-primary">
                Start your workspace
              </Link>
              <Link href={secondaryHref} className="lockbox-button lockbox-button-secondary">
                Sign in
              </Link>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="lockbox-hero__note">
                New signup is currently limited while workspace setup is finalized. Existing accounts can still
                sign in.
              </p>
            ) : null}
          </div>

          <aside className="lockbox-hero-frame lockbox-surface" aria-label="LockboxHQ product preview">
            <div className="lockbox-preview-header">
              <div>
                <div className="lockbox-preview-kicker">Inside the workspace</div>
                <h2>One calm place for intake, deals, and priorities.</h2>
              </div>
              <span className="lockbox-preview-chip">Live workflow</span>
            </div>

            <div className="lockbox-preview-visual">
              <section className="lockbox-preview-spotlight">
                <div className="lockbox-preview-spotlight__label">Needs attention now</div>
                <strong>Jordan Mitchell</strong>
                <p>Buyer inquiry via intake form. East Nashville. 0-3 month timeframe. Text first.</p>
                <div className="lockbox-preview-spotlight__meta">
                  <span>Hot lead</span>
                  <span>Intake form</span>
                  <span>Deal created</span>
                </div>
              </section>

              <section className="lockbox-preview-stream">
                {workflowItems.map((item) => (
                  <article key={item.label} className="lockbox-preview-row">
                    <div className="lockbox-preview-row__label">{item.label}</div>
                    <div className="lockbox-preview-row__body">
                      <strong>{item.source}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </aside>
        </section>

        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">How it works</span>
            <h2>Three clean steps from inbound inquiry to active follow-up.</h2>
          </div>

          <div className="lockbox-card-grid lockbox-card-grid--triple">
            {howItWorks.map((item, index) => (
              <article key={item.title} className="lockbox-surface lockbox-info-card">
                <span className="lockbox-info-card__index">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">Why it feels different</span>
            <h2>Built to save time, not create more data entry.</h2>
          </div>

          <div className="lockbox-card-grid lockbox-card-grid--triple">
            {overviewCards.map((item) => (
              <article key={item.title} className="lockbox-surface lockbox-info-card lockbox-info-card--overview">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lockbox-concierge-band lockbox-surface">
          <div className="lockbox-concierge-band__copy">
            <span className="lockbox-section__eyebrow">Concierge capture — coming soon</span>
            <h2>Missed call in. Intake captured. Deal started automatically.</h2>
            <p>
              LockboxHQ Concierge will text back after a missed call, collect the basics, and feed the same
              intake and deal workflow your form uses.
            </p>
          </div>
          <div className="lockbox-concierge-band__steps">
            <span>Missed call</span>
            <span>Concierge qualifies</span>
            <span>Deal appears in CRM</span>
          </div>
        </section>

        <section className="lockbox-final-cta lockbox-surface">
          <div className="lockbox-final-cta__copy">
            <span className="lockbox-section__eyebrow">Ready to see it in action?</span>
            <h2>Get a personalized demo in minutes.</h2>
            <p>See how LockboxHQ captures inbound inquiries and turns them into organized deals — no setup required on your end.</p>
          </div>
          <div className="lockbox-final-cta__actions">
            <Link href="/demo" className="lockbox-button lockbox-button-primary">
              Request a Demo
            </Link>
            <Link href={primaryHref} className="lockbox-button lockbox-button-secondary">
              Start your workspace
            </Link>
          </div>
        </section>

        <footer className="lockbox-footer lockbox-footer--slim">
          <span>LockboxHQ</span>
          <nav className="lockbox-footer__links" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
