"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PRODUCT_NAME } from "@/lib/features";

export default function AuthPage() {
  const router = useRouter();

  const supabase = useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isEmailValid = email.trim() !== "" && email.includes("@");
  const isPasswordValid = password.length >= 6;
  const isFormValid = isEmailValid && isPasswordValid;

  async function handleAuth() {
    if (!isEmailValid) {
      setError("Enter a valid email");
      return;
    }

    if (!isPasswordValid) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

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
    if (!isEmailValid) {
      setError("Enter a valid email");
      return;
    }

    if (!isPasswordValid) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

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

    setMessage("Sign-up complete. Check your email confirmation link, then sign in.");
    setLoading(false);
  }

  return (
    <main className="crm-shell" style={{ padding: 24 }}>
      <div
        className="crm-card"
        style={{
          maxWidth: 440,
          margin: "70px auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 22,
        }}
      >
        <div className="crm-chip" style={{ width: "fit-content" }}>
          {PRODUCT_NAME} Access
        </div>
        <h2 style={{ margin: 0 }}>Welcome Back</h2>
        <p style={{ marginTop: 0, color: "var(--ink-muted)" }}>
          Log in to your {PRODUCT_NAME} workspace and continue lead execution.
        </p>

        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}
        {message && <div style={{ color: "var(--ok)", fontSize: 14 }}>{message}</div>}

        <button onClick={handleAuth} disabled={loading || !isFormValid} className="crm-btn crm-btn-primary">
          {loading ? "Loading..." : "Log In"}
        </button>

        <button
          onClick={handleSignup}
          disabled={loading || !isFormValid}
          className="crm-btn crm-btn-secondary"
        >
          {loading ? "Loading..." : "Sign Up"}
        </button>
      </div>
    </main>
  );
}
