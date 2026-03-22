import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

export async function POST() {
  const supabase = await supabaseServer();
  const access = await loadAccessContext(supabase);
  if (!access.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = access.context;

  // Return existing code if already set
  const { data: agentRow } = await supabase
    .from("agents")
    .select("link_code")
    .eq("id", user.id)
    .maybeSingle();

  if (agentRow?.link_code) {
    return NextResponse.json({ link_code: agentRow.link_code as string });
  }

  // Generate unique code (retry up to 10x on collision)
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const { error } = await supabase
      .from("agents")
      .update({ link_code: code })
      .eq("id", user.id);

    if (!error) {
      return NextResponse.json({ link_code: code });
    }
    // error likely means unique constraint violation — retry
  }

  return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
}
