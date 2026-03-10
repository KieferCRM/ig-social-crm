import Link from "next/link";
import { FEATURE_META_ENABLED, FEATURE_SIGNUP_ENABLED, PRODUCT_NAME, PRODUCT_STAGE_LABEL } from "@/lib/features";
import MerlynMascot from "@/components/branding/merlyn-mascot";

const pillars = [
  {
    title: "Capture Every Signal",
    body: FEATURE_META_ENABLED
      ? "Instagram and Facebook conversations map into a clean pipeline without manual re-entry."
      : "Forms, CSV imports, webhooks, and manual intake map into a clean pipeline without manual re-entry.",
  },
  {
    title: "Move Fast, Daily",
    body: "You see exactly who needs follow-up now, not after they go cold.",
  },
  {
    title: "Operate In One Place",
    body: "Lead state, notes, reminders, and conversation history stay in a single command center.",
  },
];

const steps = ["Ingest", "Deduplicate", "Prioritize", "Follow Up", "Close"];

export default function HomePage() {
  return (
    <main className="merlyn-home">
      <div className="merlyn-home__container">
        <header className="merlyn-home__header">
          <div className="merlyn-home__brand">{PRODUCT_NAME}</div>
          <div className="merlyn-home__header-actions">
            <span className="merlyn-chip">{PRODUCT_STAGE_LABEL}</span>
            <Link href="/auth" className="merlyn-btn merlyn-btn--ghost">
              Log In
            </Link>
            <Link href="/intake" className="merlyn-btn merlyn-btn--primary">
              Open Intake
            </Link>
          </div>
        </header>

        <section className="merlyn-hero">
          <div className="merlyn-hero__copy">
            <p className="merlyn-hero__eyebrow">Real Estate Lead Capture Website</p>
            <h1>Run your pipeline with quiet confidence.</h1>
            <p className="merlyn-hero__subtitle">
              {PRODUCT_NAME} turns social lead chaos into clear next moves so solo operators can follow up faster and close with less noise.
            </p>
            <div className="merlyn-hero__actions">
              <Link href="/intake" className="merlyn-btn merlyn-btn--primary">
                Start Intake
              </Link>
              <Link href="/app/intake" className="merlyn-btn merlyn-btn--ghost">
                Open Lead Intake Hub
              </Link>
            </div>
            {!FEATURE_SIGNUP_ENABLED ? (
              <p className="merlyn-hero__note">New signup is paused while launch onboarding is finalized. Existing accounts work normally.</p>
            ) : null}
          </div>

          <aside className="merlyn-preview">
            <div className="merlyn-preview__title">
              <MerlynMascot className="merlyn-preview__mascot" decorative />
              Today&apos;s Focus
            </div>
            <ul className="merlyn-preview__list">
              <li>4 hot leads need replies in the next hour</li>
              <li>2 reminders overdue from yesterday</li>
              <li>1 duplicate source event auto-merged</li>
            </ul>
            <div className="merlyn-preview__status">
              <span className="merlyn-dot" />
              Pipeline signal is clear
            </div>
          </aside>
        </section>

        <section className="merlyn-steps">
          {steps.map((step, index) => (
            <div key={step} className="merlyn-step">
              <span>{step}</span>
              {index < steps.length - 1 ? <span className="merlyn-step__arrow">→</span> : null}
            </div>
          ))}
        </section>

        <section className="merlyn-pillars">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="merlyn-pillar">
              <h2>{pillar.title}</h2>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="merlyn-cta">
          <h3>Built for solo operators who execute daily.</h3>
          <p>From webhook ingest to reminders and timeline history, your system stays tight and moves every lead forward.</p>
          <div className="merlyn-hero__actions">
            <Link href="/intake" className="merlyn-btn merlyn-btn--primary">
              Open Intake Form
            </Link>
            <Link href="/auth" className="merlyn-btn merlyn-btn--ghost">
              Log In
            </Link>
          </div>
        </section>

        <footer className="merlyn-footer">
          <span>
            {PRODUCT_NAME} • {PRODUCT_STAGE_LABEL}
          </span>
          <span className="merlyn-footer__links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
