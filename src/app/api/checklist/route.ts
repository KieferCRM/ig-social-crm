import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const [
    { data: agent },
    { count: contactCount },
    { count: dealCount },
  ] = await Promise.all([
    supabase.from("agents").select("vanity_slug, phone").eq("id", user.id).maybeSingle(),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
  ]);

  return NextResponse.json({
    hasSlug: Boolean(agent?.vanity_slug),
    hasContact: (contactCount ?? 0) > 0,
    hasDeal: (dealCount ?? 0) > 0,
    hasPhone: Boolean(agent?.phone),
  });
}
