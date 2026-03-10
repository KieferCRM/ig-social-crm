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
  ctaLabel?: string;
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
  ctaLabel = "View leads",
}: KpiCardProps) {
  const body = (
    <>
      <div className="crm-kpi-label">{label}</div>
      <div className="crm-kpi-value" style={{ color: toneColor(tone) }}>{value}</div>
      {helper ? <div className="crm-kpi-helper">{helper}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
      {href ? <div className="crm-kpi-link-hint">{ctaLabel}</div> : null}
    </>
  );

  if (!href) {
    return <article className={`crm-kpi-card crm-kpi-tone-${tone}`}>{body}</article>;
  }

  return (
    <Link href={href} className={`crm-kpi-card crm-kpi-tone-${tone} crm-kpi-card-link`} aria-label={`${label}: ${ctaLabel}`}>
      {body}
    </Link>
  );
}
