import type { PostgrestError } from "@supabase/supabase-js";

export type ReminderOwnerColumn = "owner_user_id" | "agent_id";

type QueryResult<T> = {
  data: T;
  error: PostgrestError | null;
};

function isMissingReminderOwnerColumn(error: PostgrestError, column: ReminderOwnerColumn): boolean {
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("follow_up_reminders") &&
    msg.includes(column) &&
    (msg.includes("does not exist") || msg.includes("schema cache"))
  );
}

export async function withReminderOwnerColumn<T>(
  run: (ownerColumn: ReminderOwnerColumn) => PromiseLike<QueryResult<T>>
): Promise<QueryResult<T> & { ownerColumn: ReminderOwnerColumn }> {
  const ownerFirst = await run("owner_user_id");
  const ownerMissing =
    ownerFirst.error && isMissingReminderOwnerColumn(ownerFirst.error, "owner_user_id");

  if (!ownerFirst.error || !ownerMissing) {
    return { ...ownerFirst, ownerColumn: "owner_user_id" };
  }

  const agentSecond = await run("agent_id");
  return { ...agentSecond, ownerColumn: "agent_id" };
}
