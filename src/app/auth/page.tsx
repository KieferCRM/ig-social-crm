"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthPage() {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuth() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/app");
  }

  async function handleSignup() {
  setLoading(true);
  setError(null);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    setError(error.message);
    setLoading(false);
    return;
  }

  if (data.session) {
    router.push("/app");
    return;
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    setError(loginError.message);
    setLoading(false);
    return;
  }

  router.push("/app");
}

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "100px auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2>Login</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 8 }}
      />

      {error && (
        <div style={{ color: "red", fontSize: 14 }}>
          {error}
        </div>
      )}

      <button onClick={handleAuth} disabled={loading}>
        {loading ? "Loading..." : "Login"}
      </button>

      <button onClick={handleSignup} disabled={loading}>
        {loading ? "Loading..." : "Sign Up"}
      </button>
    </div>
  );
}