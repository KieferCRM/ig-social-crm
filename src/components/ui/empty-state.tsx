"use client";

import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
  eyebrow?: string;
};

export default function EmptyState({
  title,
  body,
  action,
  eyebrow = "Next step",
}: EmptyStateProps) {
  return (
    <div className="crm-empty-state">
      <div className="crm-empty-state-head">
        <span className="crm-empty-state-sigil" aria-hidden />
        <span className="crm-empty-state-eyebrow">{eyebrow}</span>
      </div>
      <div className="crm-empty-state-title">{title}</div>
      <div className="crm-empty-state-body">{body}</div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
