"use client";

import Link from "next/link";
import AskMerlynCard from "./ask-merlyn-card";

type LeadForAsk = {
  id: string;
  ig_username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  stage: string | null;
  lead_temp: string | null;
  time_last_updated: string | null;
};

export default function DashboardRightRail({ leads }: { leads: LeadForAsk[] }) {
  return (
    <div className="crm-utility-rail">
      <AskMerlynCard leads={leads} />

      <section className="crm-card crm-utility-card">
        <div style={{ fontWeight: 700 }}>Quick Actions</div>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <Link href="/app/list" className="crm-btn crm-btn-primary">Open Leads</Link>
          <Link href="/app/kanban" className="crm-btn crm-btn-secondary">Open Pipeline</Link>
          <Link href="/app/intake" className="crm-btn crm-btn-secondary">Open Lead Intake</Link>
        </div>
      </section>
    </div>
  );
}
