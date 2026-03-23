import { redirect } from "next/navigation";
import CalendarClient from "./calendar-client";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Appointment, DealFollowup, CalendarTask } from "@/lib/appointments";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = supabaseAdmin();
  const agentId = user.id;

  const [{ data: apptData }, { data: dealData }, { data: taskData }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*,lead:leads(full_name,canonical_phone),deal:deals(property_address)")
      .eq("agent_id", agentId)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("deals")
      .select("id,property_address,next_followup_date,stage,lead:leads(full_name)")
      .eq("agent_id", agentId)
      .not("next_followup_date", "is", null)
      .neq("stage", "closed")
      .neq("stage", "dead"),
    admin
      .from("lead_recommendations")
      .select("id,title,due_at")
      .or(`owner_user_id.eq.${agentId},agent_id.eq.${agentId}`)
      .eq("status", "open")
      .not("due_at", "is", null),
  ]);

  return (
    <main className="crm-page crm-stack-12">
      <CalendarClient
        initialAppointments={(apptData ?? []) as Appointment[]}
        initialFollowups={(dealData ?? []) as DealFollowup[]}
        initialTasks={(taskData ?? []) as CalendarTask[]}
      />
    </main>
  );
}
