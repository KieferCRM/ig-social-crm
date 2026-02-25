"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Working...");

    let result;

    if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password,
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
    }

    if (result.error) {
      setStatus(result.error.message);
      return;
    }

    setStatus("Success ✅");
    router.push("/app");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 420 }}>
      <h1>{mode === "login" ? "Log in" : "Sign up"}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode("login")} disabled={mode === "login"}>
          Log in
        </button>
        <button onClick={() => setMode("signup")} disabled={mode === "signup"}>
          Sign up
        </button>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />

        <button type="submit">
          {mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>{status}</p>
    </main>
  );
}