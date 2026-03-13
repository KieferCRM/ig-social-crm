"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function resetSession() {
      try {
        const supabase = supabaseBrowser();
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Best-effort session reset.
      }

      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // Ignore storage cleanup failures.
      }

      if (!cancelled) {
        router.replace("/auth?mode=sign_up");
      }
    }

    resetSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">Resetting your session</h1>
            <p className="crm-auth-subtitle">
              Clearing the current workspace session and sending you back to sign up.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
