import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadAccessContext } from "@/lib/access-context";

type TeamRole = "team_lead" | "admin" | "broker_owner" | "member" | null;

export type TeamContext = {
  user: User;
  teamId: string | null;
  role: TeamRole;
};

export async function loadTeamContext(
  supabase: SupabaseClient
): Promise<
  | { ok: false; status: 401; error: string }
  | { ok: true; context: TeamContext }
> {
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return auth;

  // Solo-first runtime: team APIs stay available for compatibility but default inactive.
  return {
    ok: true,
    context: {
      user: auth.context.user,
      teamId: null,
      role: null,
    },
  };
}

export function canRunDestructiveAction(
  context: TeamContext,
  ownerUserId?: string | null
): boolean {
  if (ownerUserId && ownerUserId === context.user.id) return true;
  return (
    context.role === "team_lead" ||
    context.role === "admin" ||
    context.role === "broker_owner"
  );
}
