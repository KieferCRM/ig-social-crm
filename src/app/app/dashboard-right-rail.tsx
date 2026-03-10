"use client";

import Link from "next/link";

export default function DashboardRightRail() {
  return (
    <div className="crm-utility-rail">
      <section className="crm-card crm-utility-card">
        <div style={{ fontWeight: 700 }}>Quick Actions</div>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <Link href="/app/list" className="crm-btn crm-btn-primary">Open Leads</Link>
          <Link href="/app/kanban" className="crm-btn crm-btn-secondary">Open Pipeline</Link>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary">Open Lead Intake</Link>
          <Link href="/intake" target="_blank" rel="noreferrer" className="crm-btn crm-btn-secondary">Open Intake Form</Link>
        </div>
      </section>
    </div>
  );
}
