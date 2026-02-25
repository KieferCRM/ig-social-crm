export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function PingPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not logged in</div>;
  }

  // Insert a test lead owned by current user
  const { error: insertError } = await supabase.from("leads").insert({
    ig_username: "test_user_" + Date.now(),
    intent: "buy",
    timeline: "soon",
    lead_temp: "warm",
    source: "manual_test",
    notes: "RLS test insert",
    stage: "New",
    agent_id: user.id
  });

  const { data } = await supabase
    .from("leads")
    .select("ig_username, agent_id")
    .limit(5);

  return (
    <main style={{ padding: 24 }}>
      <h1>RLS Insert Test</h1>
      <p>Logged in as: {user.email}</p>

      {insertError && (
        <pre style={{ color: "red" }}>
          Insert error: {insertError.message}
        </pre>
      )}

      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}