"use client";

import Link from "next/link";
import { motion } from "motion/react";

const workflowItems = [
  { label: "New inquiry", source: "Intake form", detail: "Buyer asks about East Nashville and wants to move within 0–3 months." },
  { label: "Hot lead", source: "Open house QR", detail: "Seller gave a direct callback number and needs a quick follow-up." },
  { label: "Next action", source: "Today", detail: "Text Jordan first, then call this afternoon if there's no reply." },
] as const;

const stats = [
  { value: "Zero", label: "manual entry" },
  { value: "1 link", label: "captures everything" },
  { value: "Every", label: "inquiry tracked" },
  { value: "Auto", label: "deal creation" },
] as const;

type Props = {
  signUpHref: string;
  signInHref: string;
  signupEnabled: boolean;
};

export default function AnimatedHero({ signUpHref, signInHref, signupEnabled }: Props) {
  return (
    <>
      {/* Social proof / stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        style={{
          display: "flex",
          gap: "clamp(16px, 3vw, 40px)",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "14px 20px",
          borderRadius: 16,
          border: "1px solid var(--lockbox-border)",
          background: "var(--lockbox-panel-glass)",
          backdropFilter: "blur(8px)",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "clamp(1rem, 1.4vw, 1.18rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--lockbox-text-primary)" }}>{s.value}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--lockbox-text-muted)" }}>{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Hero grid */}
      <div className="lockbox-hero lockbox-hero--home">
        {/* Left — headline + CTAs */}
        <div className="lockbox-hero__intro">
          <motion.span
            className="lockbox-hero__eyebrow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            Real estate CRM
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
          >
            The CRM that fills itself while you sell.
          </motion.h1>

          <motion.p
            className="lockbox-hero__body"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            LockboxHQ turns every inbound inquiry — from social, website, QR codes, or direct messages — into an organized deal. No copy-pasting. No spreadsheets. Just a clean pipeline that builds itself.
          </motion.p>

          <motion.div
            className="lockbox-hero__actions lockbox-hero__actions--home"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Link href={signUpHref} className="lockbox-button lockbox-button-primary">
              Start free workspace
            </Link>
            <a
              href="#how-it-works"
              className="lockbox-button lockbox-button-secondary"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See how it works
            </a>
          </motion.div>

          {!signupEnabled && (
            <motion.p
              className="lockbox-hero__note"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              New signup is currently limited while workspace setup is finalized. Existing accounts can still sign in.
            </motion.p>
          )}
        </div>

        {/* Right — animated product preview */}
        <motion.aside
          className="lockbox-hero-frame lockbox-surface"
          aria-label="LockboxHQ product preview"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="lockbox-preview-header">
            <div>
              <div className="lockbox-preview-kicker">Inside the workspace</div>
              <h2>One calm place for intake, deals, and priorities.</h2>
            </div>
            <motion.span
              className="lockbox-preview-chip"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              Live workflow
            </motion.span>
          </div>

          <div className="lockbox-preview-visual">
            <motion.section
              className="lockbox-preview-spotlight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="lockbox-preview-spotlight__label">Needs attention now</div>
              <strong>Jordan Mitchell</strong>
              <p>Buyer inquiry via intake form. East Nashville. 0–3 month timeframe. Text first.</p>
              <div className="lockbox-preview-spotlight__meta">
                <span>🔥 Hot lead</span>
                <span>Intake form</span>
                <span>Deal created</span>
              </div>
            </motion.section>

            <section className="lockbox-preview-stream">
              {workflowItems.map((item, i) => (
                <motion.article
                  key={item.label}
                  className="lockbox-preview-row"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 + i * 0.1 }}
                >
                  <div className="lockbox-preview-row__label">{item.label}</div>
                  <div className="lockbox-preview-row__body">
                    <strong>{item.source}</strong>
                    <p>{item.detail}</p>
                  </div>
                </motion.article>
              ))}
            </section>
          </div>
        </motion.aside>
      </div>

      {/* Sign in link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        style={{ margin: 0, fontSize: 13, color: "var(--lockbox-text-muted)", textAlign: "center" }}
      >
        Already have an account?{" "}
        <Link href={signInHref} style={{ color: "var(--lockbox-accent-bright)", fontWeight: 600, textDecoration: "none" }}>
          Sign in
        </Link>
      </motion.p>
    </>
  );
}
