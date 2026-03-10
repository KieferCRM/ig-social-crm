export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { normalizeConsent } from "@/lib/consent";

export default async function PingPage() {
  if (process.env.NODE_ENV === "production") {
    return <div>Not Found</div>;
  }

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
  const consent = normalizeConsent({
    source: "manual_test",
    consent_source: "manual_test",
  });
  const { error: insertError } = await supabase.from("leads").insert({
    ig_username: "test_user_" + user.id.slice(0, 8),
    intent: "buy",
    timeline: "soon",
    lead_temp: "warm",
    source: "manual_test",
    consent_to_email: consent.consent_to_email,
    consent_to_sms: consent.consent_to_sms,
    consent_source: consent.consent_source,
    consent_timestamp: consent.consent_timestamp,
    consent_text_snapshot: consent.consent_text_snapshot,
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
