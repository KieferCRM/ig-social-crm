import { redirect } from "next/navigation";
import CalendarClient from "./calendar-client";
import { supabaseServer } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/appointments";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data } = await supabase
    .from("appointments")
    .select("*,lead:leads(full_name,canonical_phone),deal:deals(property_address)")
    .eq("agent_id", user.id)
    .order("scheduled_at", { ascending: true });

  const appointments = (data ?? []) as Appointment[];

  return (
    <main className="crm-page crm-stack-12" style={{ maxWidth: 860 }}>
      <CalendarClient initial={appointments} />
    </main>
  );
}
