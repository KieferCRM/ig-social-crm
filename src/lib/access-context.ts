import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AccessContext = {
  user: User;
};

export function ownerFilter(
  context: AccessContext,
  ownerColumn = "agent_id"
): string {
  return `${ownerColumn}.eq.${context.user.id}`;
}

export function canDeleteOwnedRecord(context: AccessContext, ownerUserId?: string | null): boolean {
  return Boolean(ownerUserId && ownerUserId === context.user.id);
}

declare global {
  var __merlyn_warned_agents_bootstrap__: boolean | undefined;
}

function maybeFullName(user: User): string | null {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const preferred =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    null;
  return preferred;
}

async function ensureAgentRow(supabase: SupabaseClient, user: User): Promise<void> {
  const payload = {
    id: user.id,
    email: user.email || null,
    full_name: maybeFullName(user),
  };

  const { error } = await supabase
    .from("agents")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: true });

  if (error && !globalThis.__merlyn_warned_agents_bootstrap__) {
    globalThis.__merlyn_warned_agents_bootstrap__ = true;
    console.warn("[access] agent bootstrap skipped", { error: error.message });
  }
}

export async function loadAccessContext(supabase: SupabaseClient): Promise<
  | { ok: false; status: 401; error: string }
  | { ok: true; context: AccessContext }
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  await ensureAgentRow(supabase, user);

  return {
    ok: true,
    context: {
      user,
    },
  };
}
