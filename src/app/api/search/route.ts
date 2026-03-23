import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const term = `%${q}%`;

  // Search contacts (leads)
  const { data: contacts } = await supabase
    .from("leads")
    .select("id, name, phone, email, tags")
    .eq("agent_id", user.id)
    .or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
    .limit(5);

  // Search deals
  const { data: deals } = await supabase
    .from("deals")
    .select("id, property_address, seller_name, stage")
    .eq("agent_id", user.id)
    .or(`property_address.ilike.${term},seller_name.ilike.${term}`)
    .limit(5);

  type Result = {
    id: string;
    type: "contact" | "deal";
    label: string;
    sub: string;
    href: string;
  };

  const results: Result[] = [
    ...(contacts ?? []).map((c) => ({
      id: c.id as string,
      type: "contact" as const,
      label: (c.name as string) || (c.phone as string) || (c.email as string) || "Unknown",
      sub: [c.phone, c.email].filter(Boolean).join(" · ") as string,
      href: `/app/contacts?contact=${c.id}`,
    })),
    ...(deals ?? []).map((d) => ({
      id: d.id as string,
      type: "deal" as const,
      label: (d.property_address as string) || (d.seller_name as string) || "Untitled deal",
      sub: (d.seller_name as string) || "",
      href: `/app/pipeline?deal=${d.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
