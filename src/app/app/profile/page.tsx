import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { readWorkspaceSettingsFromAgentSettings } from "@/lib/workspace-settings";
import ProfilePageClient from "./ProfilePageClient";

export default async function MyProfilePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("full_name, brokerage, vanity_slug, settings")
    .eq("id", user.id)
    .maybeSingle();

  const slug = (agent?.vanity_slug as string | null) ?? user.id;
  const ws = readWorkspaceSettingsFromAgentSettings(agent?.settings);

  return (
    <ProfilePageClient
      slug={slug}
      fullName={(agent?.full_name as string | null) ?? ""}
      initialSettings={{
        profile_company_name: ws.profile_company_name,
        profile_tagline: ws.profile_tagline,
        profile_bio: ws.profile_bio,
        profile_headshot_url: ws.profile_headshot_url,
        profile_service_areas: ws.profile_service_areas,
        profile_testimonials: ws.profile_testimonials,
        profile_listings: ws.profile_listings,
        profile_show_contact_form: ws.profile_show_contact_form,
        profile_public: ws.profile_public,
        profile_template: ws.profile_template,
        instagram_url: ws.instagram_url,
        facebook_url: ws.facebook_url,
        tiktok_url: ws.tiktok_url,
        youtube_url: ws.youtube_url,
        linkedin_url: ws.linkedin_url,
      }}
    />
  );
}
