import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import WholesalerProfile from "@/components/profile/WholesalerProfile";
import AgentProfile from "@/components/profile/AgentProfile";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ProfileNotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{ fontSize: 48, margin: "0 0 16px" }}>🌿</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "#1a1a1a" }}>Profile not found</h1>
        <p style={{ color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
          This profile link is no longer active or does not exist.
        </p>
      </div>
    </main>
  );
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ agentSlug: string }>;
}) {
  const { agentSlug: param } = await params;
  const admin = supabaseAdmin();
  let agentId: string;

  if (UUID_RE.test(param)) {
    const { data } = await admin
      .from("agents")
      .select("id, vanity_slug")
      .eq("id", param)
      .maybeSingle();
    if (!data) return <ProfileNotFound />;
    if (data.vanity_slug) redirect(`/p/${data.vanity_slug}`);
    agentId = data.id as string;
  } else {
    const { data } = await admin
      .from("agents")
      .select("id")
      .ilike("vanity_slug", param)
      .maybeSingle();

    if (data) {
      agentId = data.id as string;
    } else {
      const { data: hist } = await admin
        .from("agent_slug_history")
        .select("agent_id, agents!inner(id, vanity_slug)")
        .ilike("old_slug", param)
        .maybeSingle();

      if (hist) {
        const agent = (hist as unknown as { agents: { vanity_slug: string | null; id: string } }).agents;
        redirect(`/p/${agent.vanity_slug ?? agent.id}`);
      }

      return <ProfileNotFound />;
    }
  }

  const { data: agent } = await admin
    .from("agents")
    .select("id, full_name, brokerage, vanity_slug, settings")
    .eq("id", agentId)
    .maybeSingle();

  if (!agent) return <ProfileNotFound />;

  const ws = readWorkspaceSettingsFromAgentSettings(agent.settings);

  if (!ws.profile_public) return <ProfileNotFound />;
  const receptionist = readReceptionistSettingsFromAgentSettings(agent.settings);

  const profile = {
    agentId: agent.id as string,
    slug: (agent.vanity_slug as string | null) ?? (agent.id as string),
    fullName: (agent.full_name as string | null) ?? "",
    brokerage: (agent.brokerage as string | null) ?? "",
    companyName: ws.profile_company_name || (agent.brokerage as string | null) || "",
    tagline: ws.profile_tagline,
    bio: ws.profile_bio,
    headshotUrl: ws.profile_headshot_url,
    serviceAreas: ws.profile_service_areas,
    testimonials: ws.profile_testimonials,
    listings: ws.profile_listings,
    showContactForm: ws.profile_show_contact_form,
    instagramUrl: ws.instagram_url,
    facebookUrl: ws.facebook_url,
    tiktokUrl: ws.tiktok_url,
    youtubeUrl: ws.youtube_url,
    linkedinUrl: ws.linkedin_url,
    bookingLink: ws.booking_link,
    officeHoursStart: receptionist.office_hours_start,
    officeHoursEnd: receptionist.office_hours_end,
    operatorPath: ws.operator_path,
  };

  if (ws.profile_template === "agent") {
    return <AgentProfile profile={profile} />;
  }

  return <WholesalerProfile profile={profile} />;
}
