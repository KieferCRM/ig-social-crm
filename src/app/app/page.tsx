import Link from "next/link";

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function AppHome() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Components can't set cookies
        },
      },
    }
  );

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, stage, lead_temp");

  const total = leads?.length ?? 0;
  const hot = (leads ?? []).filter((l) => l.lead_temp === "Hot").length;
  const newCount = (leads ?? []).filter((l) => l.stage === "New").length;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: 8, color: "#666" }}>
            Overview of your pipeline.
          </p>
        </div>

        <Link href="/app/kanban" style={{ textDecoration: "none" }}>
          <span
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              background: "#fff",
              fontWeight: 600,
            }}
          >
            Open Pipeline →
          </span>
        </Link>
      </div>

      <div style={{ marginTop: 20 }}>
        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #f0caca",
              background: "#fff5f5",
              color: "#8a1f1f",
              fontSize: 14,
            }}
          >
            Could not load your dashboard counts.
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>Total leads</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
            {total}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>Hot leads</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
            {hot}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>New</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>
            {newCount}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: "1px solid #e5e5e5",
          background: "#fafafa",
          color: "#444",
          fontSize: 14,
        }}
      >
        {total === 0 ? (
          <span>No leads yet. Once ManyChat sends qualified leads, they’ll show up here.</span>
        ) : (
          <span>Counts update automatically based on your leads table.</span>
        )}
      </div>
    </main>
  );
}