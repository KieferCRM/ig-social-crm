"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_NAME } from "@/lib/features";

type AuthMode = "sign_in" | "sign_up" | "recovery";
type BusyAction = "sign_in" | "sign_up" | "forgot" | "reset" | null;

type BootstrapResponse = {
  ok?: boolean;
  already_initialized?: boolean;
  seeded_sample_workspace_data?: boolean;
  error?: string;
};

const valueBullets = [
  "Capture website, social, and QR-code inquiries automatically",
  "Turn inbound details into organized deals without manual re-entry",
  "See what needs follow-up today without digging through tabs",
];

const previewRows = [
  { source: "Instagram", detail: "Buyer inquiry enters the workspace with a deal and next step", status: "Captured", tone: "ok" },
  { source: "Open house QR", detail: "Seller details arrive ready for intake review", status: "Ready", tone: "warn" },
  { source: "Concierge", detail: "Missed-call follow-up collects the basics automatically", status: "In progress", tone: "default" },
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
  const isEnteringWorkspaceRef = useRef(false);

  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const createAccountLabel = FEATURE_SIGNUP_ENABLED ? "Create Account" : "Request Early Access";
  const isBusy = busyAction !== null;

  const enterTodayPage = useEffectEvent(async () => {
    if (isEnteringWorkspaceRef.current) return;
    isEnteringWorkspaceRef.current = true;

    const bootstrap = await bootstrapWorkspace();
    if (!bootstrap.ok) {
      setError(bootstrap.error);
      setBusyAction(null);
      isEnteringWorkspaceRef.current = false;
      return;
    }

    router.replace("/app");
    router.refresh();
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError(null);
        setMessage("Create a new password for your workspace.");
        return;
      }

      if (event === "SIGNED_IN") {
        void enterTodayPage();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, enterTodayPage]);

  useEffect(() => {
    let cancelled = false;

    async function restoreActiveSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session || mode === "recovery") return;
      await enterTodayPage();
    }

    void restoreActiveSession();

    return () => {
      cancelled = true;
    };
  }, [mode, supabase, enterTodayPage]);

  useEffect(() => {
    const requestedMode =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "sign_up" || requestedMode === "signup") {
      setMode("sign_up");
      setError(null);
      setMessage(null);
      return;
    }

    if (requestedMode === "sign_in" || requestedMode === "signin") {
      setMode("sign_in");
      setError(null);
      setMessage(null);
    }
  }, []);

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

  async function bootstrapWorkspace(): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json()) as BootstrapResponse;
      if (!response.ok || !data.ok) {
        return {
          ok: false,
          error:
            data.error ||
            "Your account is ready, but sample workspace setup did not finish.",
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "Your account is ready, but sample workspace setup did not finish.",
      };
    }
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

    await enterTodayPage();
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
      await enterTodayPage();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!signInError) {
      await enterTodayPage();
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

  const heading =
    mode === "recovery"
      ? "Reset your password"
      : mode === "sign_up"
        ? `Create your ${PRODUCT_NAME} workspace`
        : "Welcome back";
  const subheading =
    mode === "recovery"
      ? "Create a new password to get back into your workspace."
      : mode === "sign_up"
        ? "Create your workspace, capture inbound inquiries automatically, and open with sample deals so you can see how it works."
        : "Sign in to review new inquiries, update deals faster, and keep follow-up clear.";
  const modeHelper =
    mode === "recovery"
      ? "Use the same email on your account."
      : mode === "sign_up"
        ? "New here? Create your workspace and go straight into the real intake, deals, and priorities flow."
        : "Already have an account? Your intake queue, deals, and priorities will be waiting.";
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
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">For solo real estate agents</div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">{heading}</h1>
            <p className="crm-auth-subtitle">{subheading}</p>
            <p className="crm-auth-helper">{modeHelper}</p>
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
              <span>{mode === "sign_in" ? "New to LockboxHQ?" : "Already have an account?"}</span>
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
          <div className="crm-auth-panel-kicker">Inbound CRM for solo real estate agents</div>
          <h2 className="crm-auth-panel-title">Stop manually re-entering inbound inquiries.</h2>
          <p className="crm-auth-panel-body">
            LockboxHQ captures social, form, open-house, and Concierge inquiries, then turns them into organized deals with a clear next action.
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
              <span className="crm-auth-preview-label">How inquiries enter LockboxHQ</span>
              <span className="crm-chip crm-chip-ok">Built in</span>
            </div>

            <div className="crm-auth-preview-list">
              {previewRows.map((row) => (
                <div key={row.source} className="crm-auth-preview-row">
                  <div>
                    <div className="crm-auth-preview-source">{row.source}</div>
                    <div className="crm-auth-preview-detail">{row.detail}</div>
                  </div>
                  <span className={`crm-chip${row.tone === "ok" ? " crm-chip-ok" : row.tone === "warn" ? " crm-chip-warn" : ""}`}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="crm-auth-next-steps">
            <div className="crm-auth-next-steps-title">What happens after you sign in</div>
            <div className="crm-auth-next-steps-list">
              <div>1. Open Today, Deals, Intake, and Priorities</div>
              <div>2. Share your intake link and QR code</div>
              <div>3. Start capturing and working inbound deals</div>
            </div>
          </div>

          <div className="crm-auth-links">
            <Link href="/">Back to overview</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
