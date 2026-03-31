"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const testimonials = [
  {
    quote: "I used to lose leads just from forgetting to follow up after open houses. LockboxHQ captures everything automatically — I just show up and the pipeline builds itself.",
    name: "Marcus T.",
    role: "Solo Agent · Nashville, TN",
    initials: "MT",
  },
  {
    quote: "I switched from a spreadsheet I'd been using for 4 years. Setup took 10 minutes. Now I can actually see which buyers are hot without scrolling through rows.",
    name: "Priya S.",
    role: "Independent Agent · Austin, TX",
    initials: "PS",
  },
  {
    quote: "The AI secretary alone is worth it. I was showing a home and missed 3 calls — all 3 got logged as leads before I even walked out the door.",
    name: "Devon R.",
    role: "Solo Agent · Atlanta, GA",
    initials: "DR",
  },
] as const;

export default function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="lockbox-card-grid lockbox-card-grid--triple">
      {testimonials.map((t, i) => (
        <motion.div
          key={t.name}
          className="lockbox-surface lockbox-testimonial"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          <p className="lockbox-testimonial__quote">&ldquo;{t.quote}&rdquo;</p>
          <div className="lockbox-testimonial__author">
            <div className="lockbox-testimonial__avatar" aria-hidden="true">{t.initials}</div>
            <div>
              <div className="lockbox-testimonial__name">{t.name}</div>
              <div className="lockbox-testimonial__role">{t.role}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
