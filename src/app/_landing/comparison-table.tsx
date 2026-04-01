"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Check, X } from "lucide-react";

const rows = [
  { feature: "Captures every inquiry automatically", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "Creates deals without manual entry", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "Buyer & listing pipelines built-in", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "AI voice secretary for missed calls", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "Transaction checklists for every deal", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "Built for solo real estate agents", lockbox: true, spreadsheet: false, genericCrm: false },
  { feature: "Free to start, no credit card", lockbox: true, spreadsheet: true, genericCrm: false },
] as const;

export default function ComparisonTable() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55 }}
      className="lockbox-surface lockbox-comparison"
    >
      <div className="lockbox-comparison__table">
        {/* Header */}
        <div className="lockbox-comparison__row lockbox-comparison__row--header">
          <div className="lockbox-comparison__cell lockbox-comparison__cell--feature" />
          <div className="lockbox-comparison__cell lockbox-comparison__cell--highlight">
            <span className="lockbox-comparison__col-label">LockboxHQ</span>
          </div>
          <div className="lockbox-comparison__cell">
            <span className="lockbox-comparison__col-label lockbox-comparison__col-label--muted">Spreadsheet</span>
          </div>
          <div className="lockbox-comparison__cell">
            <span className="lockbox-comparison__col-label lockbox-comparison__col-label--muted">Generic CRM</span>
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <motion.div
            key={row.feature}
            className="lockbox-comparison__row"
            initial={{ opacity: 0, x: -10 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
          >
            <div className="lockbox-comparison__cell lockbox-comparison__cell--feature">
              {row.feature}
            </div>
            <div className="lockbox-comparison__cell lockbox-comparison__cell--highlight">
              {row.lockbox
                ? <Check size={18} strokeWidth={2.5} className="lockbox-comparison__check" />
                : <X size={16} strokeWidth={2} className="lockbox-comparison__x" />}
            </div>
            <div className="lockbox-comparison__cell">
              {row.spreadsheet
                ? <Check size={18} strokeWidth={2.5} className="lockbox-comparison__check" />
                : <X size={16} strokeWidth={2} className="lockbox-comparison__x" />}
            </div>
            <div className="lockbox-comparison__cell">
              {row.genericCrm
                ? <Check size={18} strokeWidth={2.5} className="lockbox-comparison__check" />
                : <X size={16} strokeWidth={2} className="lockbox-comparison__x" />}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
