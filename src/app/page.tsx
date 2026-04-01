import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";
import AnimatedHero from "./_landing/animated-hero";
import { AnimatedInfoCards, AnimatedFeatureGrid } from "./_landing/animated-cards";
import ComparisonTable from "./_landing/comparison-table";
import Testimonials from "./_landing/testimonials";
import PricingAnchor from "./_landing/pricing-anchor";

const howItWorks = [
  {
    title: "Share one intake link",
    body: "Post it on your social profiles, website, or open house QR code. Every inquiry submitted goes straight into your pipeline — no forwarding, no spreadsheet.",
  },
  {
    title: "Every inquiry becomes a deal",
    body: "Contact details, source channel, intent, and timeframe are captured automatically. A deal record is created before you even open the app.",
  },
  {
    title: "Know exactly what to do next",
    body: "LockboxHQ surfaces your hottest leads and the single most important action so nothing slips through the cracks on a busy day.",
  },
] as const;

export default function HomePage() {
  const signInHref = "/auth?track=solo_agent";
  const signUpHref = "/auth?mode=sign_up&track=solo_agent";
  const offMarketSignUpHref = "/auth?mode=sign_up&track=off_market_agent";

  return (
    <main className="lockbox-marketing lockbox-marketing--home">
<div className="lockbox-marketing__container lockbox-marketing__container--home">
        {/* Nav */}
        <header className="lockbox-nav">
          <Link href="/" className="lockbox-nav__brand">
            <LockboxMark variant="full" decorative className="lockbox-nav__logo" />
          </Link>
          <div className="lockbox-nav__actions">
            <Link href={signInHref} className="lockbox-button lockbox-button-secondary">
              Sign In
            </Link>
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Get started free
            </Link>
          </div>
        </header>

        {/* Animated hero + stats bar */}
        <AnimatedHero
          signUpHref={signUpHref}
          signInHref={signInHref}
          signupEnabled={FEATURE_SIGNUP_ENABLED}
        />

        {/* How it works */}
        <section className="lockbox-section" id="how-it-works">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">How it works</span>
            <h2>Three steps from inquiry to active deal — automatically.</h2>
          </div>
          <AnimatedInfoCards cards={howItWorks} showIndex />
        </section>

        {/* Features grid */}
        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">What&apos;s inside</span>
            <h2>Everything a solo agent needs. Nothing they don&apos;t.</h2>
          </div>
          <AnimatedFeatureGrid />
        </section>

        {/* Testimonials */}
        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">What agents say</span>
            <h2>Solo agents who made the switch.</h2>
          </div>
          <Testimonials />
        </section>

        {/* Comparison table */}
        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">Why LockboxHQ</span>
            <h2>Built for real estate. Not repurposed from something else.</h2>
          </div>
          <ComparisonTable />
        </section>

        {/* Pricing anchor */}
        <section className="lockbox-section" id="pricing">
          <PricingAnchor signUpHref={signUpHref} />
        </section>

        {/* Final CTA */}
        <section className="lockbox-final-cta lockbox-surface">
          <div className="lockbox-final-cta__copy">
            <span className="lockbox-section__eyebrow">Ready to start?</span>
            <h2>Your pipeline should build itself. Start today.</h2>
            <p>Share one link, capture every inquiry, and let LockboxHQ handle the intake while you focus on closing.</p>
          </div>
          <div className="lockbox-final-cta__actions">
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Start free workspace
            </Link>
            <Link href={offMarketSignUpHref} className="lockbox-button lockbox-button-secondary">
              Off-market path
            </Link>
            <Link href={signInHref} className="lockbox-button lockbox-button-secondary">
              Sign In
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="lockbox-footer lockbox-footer--slim">
          <span>LockboxHQ</span>
          <nav className="lockbox-footer__links" aria-label="Footer">
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:hello@lockboxhq.com">hello@lockboxhq.com</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
