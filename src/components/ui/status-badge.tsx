"use client";

type StatusBadgeProps = {
  label: string;
  tone?:
    | "default"
    | "ok"
    | "warn"
    | "danger"
    | "info"
    | "ai"
    | "lead-hot"
    | "lead-warm"
    | "lead-cold"
    | "stage-new"
    | "stage-qualified"
    | "stage-active"
    | "stage-contract"
    | "stage-closed"
    | "stage-lost";
};

function classNameForTone(tone: StatusBadgeProps["tone"]): string {
  if (tone === "ok") return "crm-chip crm-chip-ok";
  if (tone === "warn") return "crm-chip crm-chip-warn";
  if (tone === "danger") return "crm-chip crm-chip-danger";
  if (tone === "info") return "crm-chip crm-chip-info";
  if (tone === "ai") return "crm-chip crm-chip-ai";
  if (tone === "lead-hot") return "crm-chip crm-chip-lead-hot";
  if (tone === "lead-warm") return "crm-chip crm-chip-lead-warm";
  if (tone === "lead-cold") return "crm-chip crm-chip-lead-cold";
  if (tone === "stage-new") return "crm-chip crm-chip-stage-new";
  if (tone === "stage-qualified") return "crm-chip crm-chip-stage-qualified";
  if (tone === "stage-active") return "crm-chip crm-chip-stage-active";
  if (tone === "stage-contract") return "crm-chip crm-chip-stage-contract";
  if (tone === "stage-closed") return "crm-chip crm-chip-stage-closed";
  if (tone === "stage-lost") return "crm-chip crm-chip-stage-lost";
  return "crm-chip";
}

export default function StatusBadge({ label, tone = "default" }: StatusBadgeProps) {
  return <span className={classNameForTone(tone)}>{label}</span>;
}
