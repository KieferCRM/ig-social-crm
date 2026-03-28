"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

type Card = {
  title: string;
  body: string;
  index?: number;
};

export function AnimatedInfoCards({ cards, showIndex = false }: { cards: readonly Card[]; showIndex?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="lockbox-card-grid lockbox-card-grid--triple">
      {cards.map((card, i) => (
        <motion.article
          key={card.title}
          className={`lockbox-surface lockbox-info-card${showIndex ? "" : " lockbox-info-card--overview"}`}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          {showIndex && (
            <span className="lockbox-info-card__index">0{i + 1}</span>
          )}
          <h3>{card.title}</h3>
          <p>{card.body}</p>
        </motion.article>
      ))}
    </div>
  );
}

export function AnimatedFeatureGrid({ features }: { features: readonly { icon: string; title: string; body: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          className="lockbox-surface"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: i * 0.08 }}
          style={{ padding: "20px 22px", display: "grid", gap: 10 }}
        >
          <div style={{ fontSize: 22 }}>{f.icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.98rem", letterSpacing: "-0.02em", color: "var(--lockbox-text-primary)", marginBottom: 6 }}>
              {f.title}
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--lockbox-text-secondary)", lineHeight: 1.6 }}>
              {f.body}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
