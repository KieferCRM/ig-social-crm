import Link from "next/link";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";

const pipelineStats = [
  { label: "New", count: "12", tone: "new" },
  { label: "Qualified", count: "7", tone: "qualified" },
  { label: "Deals", count: "3", tone: "deals" },
];

const focusItems = [
  { task: "Call back River North buyer inquiry", due: "9:30a" },
  { task: "Send comps to open house seller lead", due: "11:00a" },
  { task: "Confirm next step on Oak Street deal", due: "2:15p" },
];

export default function HomePage() {
  return (
    <main className="merlyn-marketing merlyn-marketing--home">
      <div className="merlyn-marketing__veil" />

      <div className="merlyn-marketing__container merlyn-marketing__container--home">
        <header className="merlyn-nav merlyn-nav--minimal">
          <Link href="/" className="merlyn-nav__brand">
            <MerlynMascot variant="full" decorative className="merlyn-nav__logo" />
          </Link>
        </header>

        <section className="merlyn-hero merlyn-hero--home">
          <div className="merlyn-hero__intro">
            <span className="merlyn-hero__eyebrow">Interactive demo • No signup required</span>
            <h1>Stop losing serious real estate inquiries.</h1>
            <p className="merlyn-hero__body">
              Merlyn captures inbound form submissions from your website, bio link, and QR codes, then organizes leads, deals, and follow-ups in one clear workspace.
            </p>
          </div>

          <aside className="merlyn-hero-frame merlyn-surface" aria-label="Merlyn product preview">
            <div className="merlyn-stat-grid" aria-label="Pipeline snapshot">
              {pipelineStats.map((item) => (
                <article key={item.label} className={`merlyn-stat-card merlyn-stat-card--${item.tone}`}>
                  <span className="merlyn-stat-card__label">{item.label}</span>
                  <strong className="merlyn-stat-card__count">{item.count}</strong>
                </article>
              ))}
            </div>

            <div className="merlyn-preview-stack">
              <section className="merlyn-preview-panel">
                <div className="merlyn-preview-panel__head">
                  <span className="merlyn-preview-panel__title">Focus today</span>
                  <span className="merlyn-preview-panel__hint">3 follow-ups</span>
                </div>

                <ul className="merlyn-focus-list">
                  {focusItems.map((item) => (
                    <li key={item.task}>
                      <span>{item.task}</span>
                      <strong>{item.due}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>

          <div className="merlyn-hero__actions merlyn-hero__actions--home">
            <Link href="/demo" className="merlyn-button merlyn-button-primary">
              Start with Merlyn
            </Link>
          </div>

          {!FEATURE_SIGNUP_ENABLED ? (
            <p className="merlyn-hero__note merlyn-hero__note--home">
              New signup is currently limited while onboarding is finalized. Existing accounts can sign in normally.
            </p>
          ) : null}
        </section>

        <footer className="merlyn-footer merlyn-footer--slim">
          <nav className="merlyn-footer__links" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
