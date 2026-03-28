import Link from "next/link";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED } from "@/lib/features";
import AnimatedHero from "./_landing/animated-hero";
import { AnimatedInfoCards, AnimatedFeatureGrid } from "./_landing/animated-cards";

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

const whyAgentsUseIt = [
  {
    title: "It fills itself",
    body: "One intake link captures everything. No more copy-pasting names and numbers into a spreadsheet after every inquiry.",
  },
  {
    title: "Built for solo agents",
    body: "No complex setup, no team features you don't need. A clean workspace that keeps your buyer and listing pipelines organized.",
  },
  {
    title: "Less admin, more selling",
    body: "Spend your time on clients, not data entry. LockboxHQ handles the intake so you can focus on closing.",
  },
] as const;

const features = [
  { icon: "📥", title: "Smart Inbox", body: "Emails and voice transcripts land in your inbox, analyzed by AI, and linked to the right deal automatically." },
  { icon: "🏠", title: "Buyer Pipeline", body: "Track every buyer from first inquiry through pre-approval, active search, offer, and close." },
  { icon: "📋", title: "Listing Pipeline", body: "Manage listings from appointment through MLS, open house, offer, contract, and close." },
  { icon: "✅", title: "Transaction Checklist", body: "Predefined checklists for buyer and listing transactions so nothing gets missed on the way to close." },
  { icon: "🤖", title: "AI Secretary", body: "A voice AI that answers calls, qualifies leads, and adds them to your CRM while you're showing a home." },
  { icon: "📊", title: "Deal Details", body: "Pre-approval status, lender info, MLS numbers, commission rates — all tied to the right deal." },
] as const;

export default function HomePage() {
  const signInHref = "/auth?track=solo_agent";
  const signUpHref = "/auth?mode=sign_up&track=solo_agent";

  return (
    <main className="lockbox-marketing lockbox-marketing--home">
      <div className="lockbox-marketing__veil" />

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
            <span className="lockbox-section__eyebrow">What's inside</span>
            <h2>Everything a solo agent needs. Nothing they don't.</h2>
          </div>
          <AnimatedFeatureGrid features={features} />
        </section>

        {/* Why agents use it */}
        <section className="lockbox-section">
          <div className="lockbox-section__header">
            <span className="lockbox-section__eyebrow">Why solo agents use it</span>
            <h2>Built to save time, not create more work.</h2>
          </div>
          <AnimatedInfoCards cards={whyAgentsUseIt} />
        </section>

        {/* Final CTA */}
        <section className="lockbox-final-cta lockbox-surface">
          <div className="lockbox-final-cta__copy">
            <span className="lockbox-section__eyebrow">Ready to start?</span>
            <h2>Set up your workspace in minutes.</h2>
            <p>Share one link, capture every inquiry, and let LockboxHQ build your pipeline for you. No credit card required.</p>
          </div>
          <div className="lockbox-final-cta__actions">
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Start free workspace
            </Link>
            <Link href={signInHref} className="lockbox-button lockbox-button-secondary">
              Sign In
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="lockbox-footer lockbox-footer--slim">
          <span>LockboxHQ</span>
          <nav className="lockbox-footer__links" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:hello@lockboxhq.com">hello@lockboxhq.com</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
