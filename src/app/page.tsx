import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const howItWorks = [
  {
    title: "Share your intake form",
    body: "Place one Merlyn link on your website, bio, blasts, or open house QR codes.",
  },
  {
    title: "Leads appear automatically",
    body: "Each submission becomes a lead with the source, context, and contact details attached.",
  },
  {
    title: "Follow up with clarity",
    body: "See the stage, next step, and active deal work without bouncing between tools.",
  },
];

const overviewCards = [
  {
    title: "Capture",
    body: "Use one intake form across your website, bio links, Facebook blasts, and QR codes so serious inquiries land in Merlyn without manual entry.",
  },
  {
    title: "Pipeline",
    body: "Keep every lead organized by stage with source, contact details, and the next follow-up visible at a glance.",
  },
  {
    title: "Deals",
    body: "Once a lead becomes active business, move it into deal tracking so timelines, next steps, and transaction work stay clean.",
  },
];

const workflowItems = [
  { label: "New inquiry", source: "Website form", detail: "Buyer asks for a condo tour this weekend." },
  { label: "Qualified", source: "Open house QR", detail: "Seller intake reviewed and ready for pricing." },
  { label: "Next follow-up", source: "Today", detail: "Call Jordan Mitchell about Saturday showing." },
];

const previewColumns = [
  {
    title: "Capture",
    items: ["Website form", "Instagram bio link", "Open house QR"],
  },
  {
    title: "Pipeline",
    items: ["New", "Qualified", "Active deal"],
  },
  {
    title: "Today",
    items: ["Call buyer about showing", "Review seller intake", "Update inspection timeline"],
  },
];

export default function HomePage() {
  const primaryHref = "/auth?mode=sign_up";
  const secondaryHref = "/demo";

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
              View Demo
            </Link>
            <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>
        </header>

        <section className="merlyn-hero merlyn-hero--home">
          <div className="merlyn-hero__intro">
            <span className="merlyn-hero__eyebrow">Inbound lead CRM for solo real estate agents</span>
            <h1>Capture inbound real estate leads automatically.</h1>
            <p className="merlyn-hero__body">
              Merlyn helps solo agents capture serious inquiries through a shareable intake form and a missed-call Concierge, organize every lead and active deal in one place, and stay clear on who needs follow-up next.
            </p>

            <div className="merlyn-hero__actions merlyn-hero__actions--home">
              <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
                Start with Merlyn
              </Link>
              <Link href={secondaryHref} className="merlyn-button merlyn-button-secondary">
                View Demo
              </Link>
            </div>

            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero__note">
                New signup is currently limited while onboarding is finalized. Existing accounts can sign in, or you can explore the demo.
              </p>
            ) : null}
          </div>

          <aside className="merlyn-hero-frame merlyn-surface" aria-label="Merlyn product preview">
            <div className="merlyn-preview-header">
              <div>
                <div className="merlyn-preview-kicker">Inside the workspace</div>
                <h2>Capture, pipeline, and follow-up in one view.</h2>
              </div>
              <span className="merlyn-preview-chip">Merlyn preview</span>
            </div>

            <div className="merlyn-preview-visual">
              <section className="merlyn-preview-spotlight">
                <div className="merlyn-preview-spotlight__label">New inquiry</div>
                <strong>Jordan Mitchell</strong>
                <p>Buyer inquiry from website form. Wants to tour condos in The Gulch this weekend.</p>
                <div className="merlyn-preview-spotlight__meta">
                  <span>Website form</span>
                  <span>30-60 days</span>
                  <span>Call next</span>
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

              <section className="merlyn-preview-columns">
                {previewColumns.map((column) => (
                  <article key={column.title} className="merlyn-preview-column">
                    <div className="merlyn-preview-column__title">{column.title}</div>
                    <ul>
                      {column.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>
            </div>
          </aside>
        </section>

        <section className="merlyn-section">
          <div className="merlyn-section__header">
            <span className="merlyn-section__eyebrow">How it works</span>
            <h2>Three clean steps from inquiry to follow-up.</h2>
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
            <span className="merlyn-section__eyebrow">Product overview</span>
            <h2>Built for inbound capture, pipeline clarity, and active deal work.</h2>
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
            <span className="merlyn-section__eyebrow">Concierge coming soon</span>
            <h2>Missed call in. Text back out. Lead created automatically.</h2>
            <p>
              When an agent misses a call, Merlyn Concierge can text back, collect the inquiry details, and create the lead in the CRM automatically.
            </p>
          </div>
          <div className="merlyn-concierge-band__steps">
            <span>Missed call</span>
            <span>Merlyn texts back</span>
            <span>Lead created</span>
          </div>
        </section>

        <section className="merlyn-final-cta merlyn-surface">
          <div className="merlyn-final-cta__copy">
            <span className="merlyn-section__eyebrow">Ready to see it clearly?</span>
            <h2>Stop losing serious inquiries.</h2>
            <p>Start capturing inbound real estate leads automatically with Merlyn.</p>
          </div>
          <div className="merlyn-final-cta__actions">
            <Link href={primaryHref} className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
            <Link href={secondaryHref} className="merlyn-button merlyn-button-secondary">
              View Demo
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
