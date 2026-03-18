import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";
import DemoRequestForm from "@/components/demo-request-form";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const howItWorks = [
  {
    title: "Share one intake link",
    body: "Post it on your social profiles, website, or open house QR code. Any inquiry submitted goes straight into the CRM.",
  },
  {
    title: "Every inquiry becomes a deal",
    body: "Contact details, source, timeframe, and a working deal record are created automatically — no manual entry required.",
  },
  {
    title: "Know exactly what to do next",
    body: "LockboxHQ surfaces your hottest leads and the single most important action so nothing slips through the cracks.",
  },
] as const;

const overviewCards = [
  {
    title: "It fills itself",
    body: "One intake link captures everything. No more copy-pasting names and numbers into a spreadsheet after every inquiry.",
  },
  {
    title: "Built for solo agents",
    body: "No complex setup, no team features you don't need. Just a clean workspace that keeps your pipeline organized.",
  },
  {
    title: "Less admin, more selling",
    body: "Spend your time on clients, not data entry. LockboxHQ handles the paperwork so you can focus on closing.",
  },
] as const;

const workflowItems = [
  { label: "New inquiry", source: "Intake form", detail: "Buyer asks about East Nashville and wants to move within 0-3 months." },
  { label: "Hot lead", source: "Open house QR", detail: "Seller gave a direct callback number and needs a quick follow-up." },
  { label: "Next action", source: "Today", detail: "Text Jordan first, then call this afternoon if there is no reply." },
] as const;

export default function HomePage() {
  const signInHref = "/auth";
  const signUpHref = "/auth?mode=sign_up";

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
          </div>
        </header>

        <section className="lockbox-hero lockbox-hero--home">
          <div className="lockbox-hero__intro">
            <span className="lockbox-hero__eyebrow">Early access — now accepting beta testers</span>
            <h1>The CRM that fills itself so you can focus on closing.</h1>
            <p className="lockbox-hero__body">
              LockboxHQ captures every inbound inquiry through a single intake link and automatically
              creates organized deals — no manual data entry, no missed follow-ups.
            </p>

            <div className="lockbox-hero__actions lockbox-hero__actions--home">
              <a href="#demo" className="lockbox-button lockbox-button-primary">
                Request Early Access
              </a>
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
            <h2>Three steps from inquiry to active deal — automatically.</h2>
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
            <span className="lockbox-section__eyebrow">Why agents love it</span>
            <h2>Built to save time, not create more work.</h2>
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
            <span className="lockbox-section__eyebrow">AI Concierge — coming soon</span>
            <h2>Never lose a lead to a missed call again.</h2>
            <p>
              When a potential client calls and you can't answer, AI Concierge automatically follows up
              via text, collects their details, and creates a deal in your CRM — without you lifting a finger.
            </p>
          </div>
          <div className="lockbox-concierge-band__steps">
            <span>Missed call</span>
            <span>Automatic text follow-up</span>
            <span>Deal created in CRM</span>
          </div>
        </section>

        <section id="demo" className="lockbox-final-cta lockbox-surface">
          <div className="lockbox-final-cta__copy">
            <span className="lockbox-section__eyebrow">Ready to see it in action?</span>
            <h2>Get a personalized demo in minutes.</h2>
            <p>See how LockboxHQ captures inbound inquiries and turns them into organized deals — no setup required on your end.</p>
          </div>
          <DemoRequestForm />
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
