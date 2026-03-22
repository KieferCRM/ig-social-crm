"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import LockboxMark from "@/components/branding/lockbox-mark";
import { FEATURE_SIGNUP_ENABLED, PRODUCT_NAME } from "@/lib/features";

type AuthMode = "sign_in" | "sign_up" | "recovery";
type BusyAction = "sign_in" | "sign_up" | "forgot" | "reset" | null;

type Track = "solo_agent" | "off_market_agent";

const SOLO_VALUE_BULLETS = [
  "Capture website, social, and QR-code inquiries automatically",
  "Turn inbound details into organized deals without manual re-entry",
  "See what needs follow-up today without digging through tabs",
];

const OFF_MARKET_VALUE_BULLETS = [
  "Capture seller acquisition leads and buyer responses from social and outreach",
  "Organize property analysis, controlled deals, and disposition follow-up in one place",
  "Keep tags, buyer lists, and next steps visible without working out of notes",
];

const SOLO_PREVIEW_ROWS = [
  { source: "Instagram", detail: "Buyer inquiry enters the workspace with a deal and next step", status: "Captured", tone: "ok" },
  { source: "Open house QR", detail: "Seller details arrive ready for intake review", status: "Ready", tone: "warn" },
  { source: "Concierge", detail: "Missed-call follow-up collects the basics automatically", status: "In progress", tone: "default" },
] as const;

const OFF_MARKET_PREVIEW_ROWS = [
  { source: "Facebook seller post", detail: "Seller acquisition lead lands with property context and a hot next step", status: "Captured", tone: "ok" },
  { source: "Direct outreach", detail: "Cash buyer response enters tagged and ready for disposition follow-up", status: "Ready", tone: "warn" },
  { source: "Today", detail: "Controlled property and buyer blast tasks stay visible without jumping between notes", status: "In progress", tone: "default" },
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
  const [track, setTrack] = useState<Track>("solo_agent");

  const createAccountLabel = FEATURE_SIGNUP_ENABLED ? "Create Account" : "Request Early Access";
  const isBusy = busyAction !== null;

  const enterWorkspace = useEffectEvent(async () => {
    if (isEnteringWorkspaceRef.current) return;
    isEnteringWorkspaceRef.current = true;

    if (mode === "sign_up") {
      router.replace(
        `/setup/account-type${track === "off_market_agent" ? "?track=off_market_agent" : "?track=solo_agent"}`
      );
      router.refresh();
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
        void enterWorkspace();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, enterWorkspace]);

  useEffect(() => {
    let cancelled = false;

    async function restoreActiveSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session || mode === "recovery") return;
      await enterWorkspace();
    }

    void restoreActiveSession();

    return () => {
      cancelled = true;
    };
  }, [mode, supabase, enterWorkspace]);

  useEffect(() => {
    const params =
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    const requestedMode = params?.get("mode");
    const requestedTrack = params?.get("track");
    if (requestedMode === "sign_up" || requestedMode === "signup") {
      setMode("sign_up");
      setError(null);
      setMessage(null);
    }
    if (requestedMode === "sign_in" || requestedMode === "signin") {
      setMode("sign_in");
      setError(null);
      setMessage(null);
    }
    if (requestedTrack === "off_market_agent") {
      setTrack("off_market_agent");
      return;
    }
    setTrack("solo_agent");
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

    await enterWorkspace();
  }

  async function handleSignUp() {
    if (!validateEmail() || !validatePassword()) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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
      setBusyAction(null);
      await enterWorkspace();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!signInError) {
      setBusyAction(null);
      await enterWorkspace();
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
        ? track === "off_market_agent"
          ? "Create your workspace, then choose the Off-Market Agent path to start with acquisition and disposition-oriented examples."
          : "Create your workspace, then choose the Solo Agent path to start with broad inbound buyer and seller examples."
        : "Sign in to review new inquiries, update deals faster, and keep follow-up clear.";
  const modeHelper =
    mode === "recovery"
      ? "Use the same email on your account."
      : mode === "sign_up"
        ? "New here? Create your workspace first, then choose the account path that fits how you operate."
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
  const valueBullets = track === "off_market_agent" ? OFF_MARKET_VALUE_BULLETS : SOLO_VALUE_BULLETS;
  const previewRows = track === "off_market_agent" ? OFF_MARKET_PREVIEW_ROWS : SOLO_PREVIEW_ROWS;
  const trackLabel = track === "off_market_agent" ? "Off-Market Agent path" : "Solo Agent path";

  return (
    <main className="crm-auth-shell">
      <div className="crm-auth-layout">
        <section className="crm-card crm-auth-card">
          <div className="crm-auth-brand">
            <LockboxMark className="crm-auth-logo" variant="full" decorative />
            <div className="crm-auth-kicker">
              {track === "off_market_agent" ? "For off-market real estate agents" : "For solo real estate agents"}
            </div>
          </div>

          <div className="crm-auth-copy">
            <h1 className="crm-auth-title">{heading}</h1>
            <p className="crm-auth-subtitle">{subheading}</p>
            <p className="crm-auth-helper">{modeHelper}</p>
            {mode === "sign_up" ? (
              <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="crm-chip crm-chip-ok">{trackLabel}</span>
                <Link href="/" className="crm-auth-link">
                  Back to home
                </Link>
              </div>
            ) : null}
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

            {mode === "recovery" || mode === "sign_up" ? (
              <div className="crm-auth-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
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
          <div className="crm-auth-panel-kicker">
            {track === "off_market_agent" ? "Off-market workflow for solo operators" : "Inbound CRM for solo real estate agents"}
          </div>
          <h2 className="crm-auth-panel-title">
            {track === "off_market_agent"
              ? "Run acquisition and disposition from one calmer workspace."
              : "Stop manually re-entering inbound inquiries."}
          </h2>
          <p className="crm-auth-panel-body">
            {track === "off_market_agent"
              ? "LockboxHQ can open with seller acquisition, property control, and buyer disposition examples so the workspace looks closer to how off-market agents actually operate."
              : "LockboxHQ captures social, form, open-house, and Concierge inquiries, then turns them into organized deals with a clear next action."}
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
              <span className="crm-auth-preview-label">
                {track === "off_market_agent" ? "How the off-market path starts" : "How inquiries enter LockboxHQ"}
              </span>
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
              <div>1. Choose Solo Agent or Off-Market Agent</div>
              <div>2. Open Today, Deals, Intake, and Priorities</div>
              <div>3. Start from a sample workspace that matches your path</div>
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
