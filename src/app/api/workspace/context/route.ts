import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeWorkspaceMode, parseFullAccessUserIds } from "@/lib/workspace-mode";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const fullAccessUsers = parseFullAccessUserIds(process.env.FULL_ACCESS_USER_IDS);
  const fullAccess = fullAccessUsers.has(user.id);
  const workspaceMode = normalizeWorkspaceMode(user.user_metadata?.workspace_mode);

  return NextResponse.json({
    user_id: user.id,
    workspace_mode: workspaceMode,
    full_access: fullAccess,
  });
}
