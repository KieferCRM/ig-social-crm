"use client";

type StatusBadgeProps = {
  label: string;
  tone?: "default" | "ok" | "warn" | "danger" | "info";
};

function classNameForTone(tone: StatusBadgeProps["tone"]): string {
  if (tone === "ok") return "crm-chip crm-chip-ok";
  if (tone === "warn") return "crm-chip crm-chip-warn";
  if (tone === "danger") return "crm-chip crm-chip-danger";
  if (tone === "info") return "crm-chip crm-chip-info";
  return "crm-chip";
}

export default function StatusBadge({ label, tone = "default" }: StatusBadgeProps) {
  return <span className={classNameForTone(tone)}>{label}</span>;
}
