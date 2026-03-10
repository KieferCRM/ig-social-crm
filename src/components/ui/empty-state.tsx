"use client";

import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export default function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="crm-empty-state">
      <div className="crm-empty-state-title">{title}</div>
      <div className="crm-empty-state-body">{body}</div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
