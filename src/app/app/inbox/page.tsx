import { supabaseServer } from "@/lib/supabase/server";
import { loadAccessContext } from "@/lib/access-context";
import InboxClient from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return <div className="crm-page"><p>Not signed in.</p></div>;

  const { data: agentRow } = await supabase
    .from("agents")
    .select("vanity_slug")
    .eq("id", auth.context.user.id)
    .maybeSingle();

  const vanitySlug = (agentRow?.vanity_slug as string | null) ?? null;
  const inboxEmail = vanitySlug ? `${vanitySlug}@inbox.lockboxhq.com` : null;

  return <InboxClient agentId={auth.context.user.id} inboxEmail={inboxEmail} />;
}
