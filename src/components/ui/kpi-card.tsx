"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type KpiCardProps = {
  label: string;
  value: string | number;
  tone?: "default" | "ok" | "warn" | "danger";
  helper?: string;
  action?: ReactNode;
  href?: string;
  compact?: boolean;
};

function toneColor(tone: KpiCardProps["tone"]): string {
  if (tone === "ok") return "var(--ok)";
  if (tone === "warn") return "var(--warn)";
  if (tone === "danger") return "var(--danger)";
  return "var(--foreground)";
}

export default function KpiCard({
  label,
  value,
  tone = "default",
  helper,
  action,
  href,
  compact = false,
}: KpiCardProps) {
  const className = `crm-kpi-card crm-kpi-tone-${tone}${compact ? " crm-kpi-card-compact" : ""}${href ? " crm-kpi-card-link" : ""}`;

  const content = (
    <>
      <div className="crm-kpi-label">{label}</div>
      <div className="crm-kpi-value" style={{ color: toneColor(tone) }}>{value}</div>
      {helper ? <div className="crm-kpi-helper">{helper}</div> : null}
      {action ? <div className="crm-kpi-action">{action}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}`}>
        {content}
      </Link>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}
