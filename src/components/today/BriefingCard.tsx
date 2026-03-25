"use client";

import { useEffect, useState } from "react";

type Briefing = {
  text: string;
  generatedAt: string;
};

export default function BriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/today/briefing")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (data && typeof data === "object" && "text" in data) {
          setBriefing(data as Briefing);
        }
      })
      .catch(() => { /* silent fail */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <article className="crm-card crm-section-card crm-stack-8">
      <div className="crm-section-head">
        <h2 className="crm-section-title">Weekly Brief</h2>
        {briefing && (
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            {briefing.generatedAt}
          </div>
        )}
      </div>

      {loading ? (
        <div className="crm-stack-6">
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "90%" }} />
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "75%" }} />
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "82%" }} />
        </div>
      ) : briefing ? (
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink)", margin: 0 }}>
          {briefing.text}
        </p>
      ) : (
        <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: 0 }}>
          Open your pipeline and set follow-up dates to get a personalized weekly brief.
        </p>
      )}
    </article>
  );
}
