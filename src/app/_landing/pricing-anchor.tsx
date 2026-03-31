"use client";

import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Check } from "lucide-react";

const included = [
  "Buyer & listing pipelines",
  "Smart intake link",
  "Transaction checklists",
  "AI-powered inbox",
  "Deal details & notes",
  "No credit card required",
] as const;

type Props = { signUpHref: string };

export default function PricingAnchor({ signUpHref }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="lockbox-surface lockbox-pricing-anchor"
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className="lockbox-pricing-anchor__left">
        <span className="lockbox-section__eyebrow">Pricing</span>
        <h3 className="lockbox-pricing-anchor__headline">Free to start.<br />No credit card.</h3>
        <p className="lockbox-pricing-anchor__body">
          Get your full workspace up and running in minutes. Everything a solo agent needs is included — no paywalls on core features.
        </p>
        <Link href={signUpHref} className="lockbox-button lockbox-button-primary" style={{ width: "fit-content" }}>
          Start free workspace
        </Link>
      </div>
      <ul className="lockbox-pricing-anchor__list">
        {included.map((item) => (
          <li key={item} className="lockbox-pricing-anchor__item">
            <Check size={15} strokeWidth={2.5} className="lockbox-pricing-anchor__check" />
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
