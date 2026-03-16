import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const howItWorks = [
  {
    title: "Capture every inbound inquiry",
    body: "Use one intake link across Instagram, Facebook, TikTok, your website, open houses, and QR placements.",
  },
  {
    title: "Organize it into a deal automatically",
    body: "Each inquiry lands with source, timeframe, contact details, and a working deal record already started.",
  },
  {
    title: "Know the next move quietly",
    body: "Merlyn surfaces the next step, hot leads, and active deal work without turning the CRM into a command center.",
  },
] as const;

const overviewCards = [
  {
    title: "Inbound capture",
    body: "Shareable forms, QR-ready intake, and Concierge capture feed the same calm workspace.",
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
  { label: "New inquiry", source: "Instagram", detail: "Buyer asks about East Nashville and wants to move within 0-3 months." },
  { label: "Hot lead", source: "Open house QR", detail: "Seller gave a direct callback number and needs a quick follow-up." },
  { label: "Next action", source: "Today", detail: "Text Jordan first, then call this afternoon if there is no reply." },
] as const;

export default function HomePage() {
  const primaryHref = "/auth?mode=sign_up";
  const secondaryHref = "/auth";

  return (
    <main className="merlyn-marketing merlyn-marketing--home">
      <div className="merlyn-marketing__veil" />

      <div className="merlyn-marketing__container merlyn-marketing__container--home">
        <header className="merlyn-nav">
          <Link href="/" className="merlyn-nav__brand">
            <MerlynMascot variant="full" decorative className="merlyn-nav__logo" />
          </Link>

          <div className="merlyn-nav__actions">
            <Link href={secondaryHref} className="merlyn-button merlyn-button-secondary">
              Sign In
            </Link>
            <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
              Start your workspace
            </Link>
          </div>
        </header>

        <section className="merlyn-hero merlyn-hero--home">
          <div className="merlyn-hero__intro">
            <span className="merlyn-hero__eyebrow">Inbound real estate CRM for solo agents</span>
            <h1>Capture the inquiry, create the deal, and show the next best step.</h1>
            <p className="merlyn-hero__body">
              Merlyn turns inbound form submissions, social inquiries, open-house scans, and Concierge
              conversations into organized deals without manual CRM entry.
            </p>

            <div className="merlyn-hero__actions merlyn-hero__actions--home">
              <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
                Start your workspace
              </Link>
              <Link href={secondaryHref} className="merlyn-button merlyn-button-secondary">
                Sign in
              </Link>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero__note">
                New signup is currently limited while workspace setup is finalized. Existing accounts can still
                sign in.
              </p>
            ) : null}
          </div>

          <aside className="merlyn-hero-frame merlyn-surface" aria-label="Merlyn product preview">
            <div className="merlyn-preview-header">
              <div>
                <div className="merlyn-preview-kicker">Inside the workspace</div>
                <h2>One calm place for intake, deals, and priorities.</h2>
              </div>
              <span className="merlyn-preview-chip">Live workflow</span>
            </div>

            <div className="merlyn-preview-visual">
              <section className="merlyn-preview-spotlight">
                <div className="merlyn-preview-spotlight__label">Needs attention now</div>
                <strong>Jordan Mitchell</strong>
                <p>Buyer inquiry from Instagram. East Nashville. 0-3 month timeframe. Text first.</p>
                <div className="merlyn-preview-spotlight__meta">
                  <span>Hot lead</span>
                  <span>Instagram</span>
                  <span>Deal created</span>
                </div>
              </section>

              <section className="merlyn-preview-stream">
                {workflowItems.map((item) => (
                  <article key={item.label} className="merlyn-preview-row">
                    <div className="merlyn-preview-row__label">{item.label}</div>
                    <div className="merlyn-preview-row__body">
                      <strong>{item.source}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </aside>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-section__header">
            <span className="merlyn-section__eyebrow">How it works</span>
            <h2>Three clean steps from inbound inquiry to active follow-up.</h2>
          </div>

          <div className="merlyn-card-grid merlyn-card-grid--triple">
            {howItWorks.map((item, index) => (
              <article key={item.title} className="merlyn-surface merlyn-info-card">
                <span className="merlyn-info-card__index">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-section__header">
            <span className="merlyn-section__eyebrow">Why it feels different</span>
            <h2>Built to save time, not create more data entry.</h2>
          </div>

          <div className="merlyn-card-grid merlyn-card-grid--triple">
            {overviewCards.map((item) => (
              <article key={item.title} className="merlyn-surface merlyn-info-card merlyn-info-card--overview">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="merlyn-concierge-band merlyn-surface">
          <div className="merlyn-concierge-band__copy">
            <span className="merlyn-section__eyebrow">Concierge capture</span>
            <h2>Missed call in. Intake captured. Deal started automatically.</h2>
            <p>
              Merlyn Concierge can text back after a missed call, collect the basics, and feed the same
              intake and deal workflow your form uses.
            </p>
          </div>
          <div className="merlyn-concierge-band__steps">
            <span>Missed call</span>
            <span>Concierge qualifies</span>
            <span>Deal appears in CRM</span>
          </div>
        </section>

        <section className="merlyn-final-cta merlyn-surface">
          <div className="merlyn-final-cta__copy">
            <span className="merlyn-section__eyebrow">Ready to make inbound easier?</span>
            <h2>Start with a workspace that shows what matters now.</h2>
            <p>Set up your intake, review seeded sample deals, and start capturing real inquiries fast.</p>
          </div>
          <div className="merlyn-final-cta__actions">
            <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
              Start your workspace
            </Link>
            <Link href={secondaryHref} className="merlyn-button merlyn-button-secondary">
              Sign in
            </Link>
          </div>
        </section>

        <footer className="merlyn-footer merlyn-footer--slim">
          <span>Merlyn</span>
          <nav className="merlyn-footer__links" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
