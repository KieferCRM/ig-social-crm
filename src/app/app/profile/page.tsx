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
    .select("vanity_slug, settings")
    .eq("id", user.id)
    .maybeSingle();

  const slug = (agent?.vanity_slug as string | null) ?? user.id;
  const ws = readWorkspaceSettingsFromAgentSettings(agent?.settings);

  const hasContent = Boolean(ws.profile_company_name || ws.profile_tagline || ws.profile_bio);

  return (
    <ProfilePageClient
      slug={slug}
      isPublic={ws.profile_public}
      hasContent={hasContent}
    />
  );
}
