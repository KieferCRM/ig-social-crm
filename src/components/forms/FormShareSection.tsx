"use client";

import { useEffect, useMemo, useState } from "react";
import IntakeShareKit from "@/components/intake/intake-share-kit";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { FORM_TEMPLATES } from "@/lib/forms/templates";

const FORM_LABELS: Record<string, { title: string; description: string; placements: string[] }> = {
  generic_seller: {
    title: "General seller form",
    description: "Share for any seller inquiry — social profiles, website, or direct outreach.",
    placements: ["Instagram bio", "Facebook post", "Website", "Direct outreach", "Business card"],
  },
  generic_buyer: {
    title: "General buyer form",
    description: "Use for buyer leads from social, open houses, or any inbound channel.",
    placements: ["Instagram bio", "Facebook post", "Open house sign-in", "Website"],
  },
  combo_sell_buy: {
    title: "Buy or sell form",
    description: "One form that adapts based on what the client wants to do.",
    placements: ["Website", "Instagram bio", "Email signature", "Business card"],
  },
  rural_land_seller: {
    title: "Rural land & property form",
    description: "Designed for land and off-market rural seller leads.",
    placements: ["Facebook rural groups", "Printed flyer", "Direct mail QR code"],
  },
  distressed_wholesale: {
    title: "Distressed property form",
    description: "For wholesale and off-market distressed seller acquisition.",
    placements: ["Facebook seller post", "Direct mail", "Cold outreach follow-up"],
  },
  probate_inherited: {
    title: "Probate & inherited property form",
    description: "For heirs, executors, and attorneys with inherited properties.",
    placements: ["Attorney referral", "Probate court outreach", "Direct mail"],
  },
  commercial_multifamily: {
    title: "Commercial & multi-family form",
    description: "For commercial and multi-family seller leads.",
    placements: ["LinkedIn", "Commercial broker outreach", "Direct mail"],
  },
};

export default function FormShareSection() {
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    void supabase.auth.getUser().then(({ data }) => {
      setAgentId(data.user?.id || null);
    });
  }, []);

  const intakeRouterPath = useMemo(
    () => (agentId ? `/intake/${agentId}` : null),
    [agentId]
  );

  if (!agentId) {
    return (
      <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading form links...</div>
    );
  }

  return (
    <div className="crm-stack-12">
      {intakeRouterPath ? (
        <IntakeShareKit
          intakePath={intakeRouterPath}
          title="Intake router — all form types"
          description="Share this one link and clients self-select the right form. Works for any situation."
          openLabel="Preview router"
          downloadName="lockboxhq-intake-router-qr.png"
          placementSuggestions={["Instagram bio", "Website", "Business card", "Open house", "Email signature"]}
        />
      ) : null}

      {Object.keys(FORM_TEMPLATES).map((formType) => {
        const meta = FORM_LABELS[formType];
        if (!meta) return null;
        return (
          <IntakeShareKit
            key={formType}
            intakePath={`/form/${agentId}/${formType}`}
            title={meta.title}
            description={meta.description}
            openLabel="Preview form"
            downloadName={`lockboxhq-${formType}-qr.png`}
            placementSuggestions={meta.placements}
          />
        );
      })}
    </div>
  );
}
