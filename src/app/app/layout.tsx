"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Link href="/app/import" style={{ textDecoration: "none", fontWeight: 600 }}>
          Import CSV
        </Link>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            cursor: "pointer",
            background: "#fff",
          }}
        >
          Logout
        </button>
      </div>

      {children}
    </div>
  );
}
