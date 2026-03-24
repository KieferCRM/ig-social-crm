import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { readReceptionistSettingsFromAgentSettings } from "@/lib/receptionist/settings";
import ReceptionistClient from "./receptionist-client";

export default async function ReceptionistSetupPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: agent } = await supabase
    .from("agents")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  const settings = readReceptionistSettingsFromAgentSettings(agent?.settings ?? null);

  return (
    <ReceptionistClient
      initialPreset={settings.voice_preset || "female"}
      initialVoiceName={settings.voice_name || ""}
    />
  );
}
