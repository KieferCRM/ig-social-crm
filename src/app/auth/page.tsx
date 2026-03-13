"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import MerlynMascot from "@/components/branding/merlyn-mascot";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_NAME } from "@/lib/features";

type AuthMode = "sign_in" | "sign_up" | "recovery";
type BusyAction = "sign_in" | "sign_up" | "forgot" | "reset" | null;

const valueBullets = [
  "Capture leads automatically",
  "Keep every inquiry organized",
  "Follow up with the right prospects faster",
];

const previewRows = [
  { source: "Instagram DM", detail: "Buyer inquiry captured and assigned", tone: "ok" },
  { source: "Website Form", detail: "New seller lead needs review today", tone: "warn" },
  { source: "Facebook Lead", detail: "Follow-up overdue from yesterday", tone: "default" },
] as const;

function toFriendlyError(message: string): string {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "That email and password combination did not match our records.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Check your inbox to confirm your account, then sign in.";
  }
  return message;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const createAccountLabel = FEATURE_SIGNUP_ENABLED ? "Create Account" : "Request Early Access";
  const isBusy = busyAction !== null;

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError(null);
        setMessage("Create a new password for your workspace.");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  function switchMode(nextMode: Exclude<AuthMode, "recovery">) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  }

  function validateEmail(): boolean {
    if (email.trim() && email.includes("@")) return true;
    setError("Enter a valid email address.");
    return false;
  }

  function validatePassword(): boolean {
    if (password.length >= 6) return true;
    setError("Password must be at least 6 characters.");
    return false;
  }

  async function handleSignIn() {
    if (!validateEmail() || !validatePassword()) return;

    setBusyAction("sign_in");
    setError(null);
    setMessage(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(toFriendlyError(authError.message));
      setBusyAction(null);
      return;
    }

    router.push("/app");
  }

  async function handleSignUp() {
    if (!validateEmail() || !validatePassword()) return;

    setBusyAction("sign_up");
    setError(null);
    setMessage(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(toFriendlyError(authError.message));
      setBusyAction(null);
      return;
    }

    if (data.session) {
      router.push("/app");
      return;
    }

    setMessage("Check your email to confirm your account, then sign in to your workspace.");
    setBusyAction(null);
  }

  async function handleForgotPassword() {
    if (!validateEmail()) return;

    setBusyAction("forgot");
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (resetError) {
      setError(toFriendlyError(resetError.message));
      setBusyAction(null);
      return;
    }

    setMessage("Password reset instructions are on the way. Check your email for the recovery link.");
    setBusyAction(null);
  }

  async function handlePasswordReset() {
    if (!validatePassword()) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusyAction("reset");
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(toFriendlyError(updateError.message));
      setBusyAction(null);
      return;
    }

    setMessage("Password updated. You can sign in with your new password now.");
    setBusyAction(null);
    setMode("sign_in");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "recovery") {
      await handlePasswordReset();
      return;
    }

    if (mode === "sign_up") {
      await handleSignUp();
      return;
    }

    await handleSignIn();
  }

  const heading = mode === "recovery" ? "Reset your password" : `Welcome to ${PRODUCT_NAME}`;
  const subheading =
    mode === "recovery"
      ? "Create a new password to get back into your lead pipeline."
      : "Sign in to manage leads, track activity, and see who needs follow-up today.";
  const primaryLabel =
    busyAction === "sign_in"
      ? "Signing In..."
      : busyAction === "sign_up"
        ? `${createAccountLabel}...`
        : busyAction === "reset"
          ? "Saving Password..."
          : mode === "sign_up"
            ? createAccountLabel
            : mode === "recovery"
              ? "Save New Password"
              : "Sign In";

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <MerlynMascot className="crm-auth-mark" variant="icon" decorative />
            <div>
              <div className="crm-chip" style={{ width: "fit-content" }}>
                {PRODUCT_NAME} for Real Estate Agents
              </div>
              <div className="crm-auth-kicker">Inbound lead command center</div>
            </div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">{heading}</h1>
            <p className="crm-auth-subtitle">{subheading}</p>
          </div>

          {mode !== "recovery" ? (
            <div className="crm-auth-tabs" role="tablist" aria-label="Authentication options">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign_in"}
                className={`crm-auth-tab${mode === "sign_in" ? " crm-auth-tab-active" : ""}`}
                onClick={() => switchMode("sign_in")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sign_up"}
                className={`crm-auth-tab${mode === "sign_up" ? " crm-auth-tab-active" : ""}`}
                onClick={() => switchMode("sign_up")}
              >
                {createAccountLabel}
              </button>
            </div>
          ) : (
            <div className="crm-auth-recovery-banner">Recovery mode active</div>
          )}

          <form className="crm-auth-form" onSubmit={handleSubmit}>
            <div className="crm-auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@agency.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy}
              />
            </div>

            <div className="crm-auth-field">
              <div className="crm-auth-field-head">
                <label htmlFor="password">Password</label>
                {mode === "sign_in" ? (
                  <button
                    type="button"
                    className="crm-auth-link"
                    onClick={handleForgotPassword}
                    disabled={isBusy}
                  >
                    {busyAction === "forgot" ? "Sending reset link..." : "Forgot password?"}
                  </button>
                ) : null}
              </div>
              <input
                id="password"
                type="password"
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                placeholder={mode === "recovery" ? "Create a new password" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
              />
            </div>

            {mode === "recovery" ? (
              <div className="crm-auth-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isBusy}
                />
              </div>
            ) : null}

            {error ? (
              <div className="crm-auth-feedback crm-auth-feedback-error" role="alert">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="crm-auth-feedback crm-auth-feedback-success" aria-live="polite">
                {message}
              </div>
            ) : null}

            <button type="submit" disabled={isBusy} className="crm-btn crm-btn-primary crm-auth-submit">
              {primaryLabel}
            </button>
          </form>

          {mode !== "recovery" ? (
            <div className="crm-auth-footer">
              <span>{mode === "sign_in" ? "New to Merlyn?" : "Already have an account?"}</span>
              <button
                type="button"
                className="crm-auth-link"
                onClick={() => switchMode(mode === "sign_in" ? "sign_up" : "sign_in")}
                disabled={isBusy}
              >
                {mode === "sign_in" ? createAccountLabel : "Sign In"}
              </button>
            </div>
          ) : (
            <div className="crm-auth-footer">
              <span>Ready to return to your workspace?</span>
              <button type="button" className="crm-auth-link" onClick={() => switchMode("sign_in")} disabled={isBusy}>
                Back to Sign In
              </button>
            </div>
          )}
        </section>

        <aside className="crm-card crm-auth-trust-panel">
          <div className="crm-auth-panel-kicker">Built for solo real estate agents</div>
          <h2 className="crm-auth-panel-title">Every inbound inquiry organized the moment it lands.</h2>
          <p className="crm-auth-panel-body">
            Merlyn captures serious leads from Instagram, Facebook, your website, and forms so you can focus on follow-up instead of manual entry.
          </p>

          <div className="crm-auth-value-list">
            {valueBullets.map((item) => (
              <div key={item} className="crm-auth-value-item">
                <span className="crm-auth-value-dot" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="crm-card-muted crm-auth-preview-card">
            <div className="crm-auth-preview-head">
              <span className="crm-auth-preview-label">Today in your pipeline</span>
              <span className="crm-chip crm-chip-ok">Live</span>
            </div>

            <div className="crm-auth-preview-list">
              {previewRows.map((row) => (
                <div key={row.source} className="crm-auth-preview-row">
                  <div>
                    <div className="crm-auth-preview-source">{row.source}</div>
                    <div className="crm-auth-preview-detail">{row.detail}</div>
                  </div>
                  <span className={`crm-chip${row.tone === "ok" ? " crm-chip-ok" : row.tone === "warn" ? " crm-chip-warn" : ""}`}>
                    {row.tone === "ok" ? "Ready" : row.tone === "warn" ? "Needs review" : "Follow up"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-auth-microcopy">
            No manual lead entry. No guesswork about who needs attention next.
          </div>

          <div className="crm-auth-links">
            <Link href="/">Back to overview</Link>
            <Link href="/intake">See intake form</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
