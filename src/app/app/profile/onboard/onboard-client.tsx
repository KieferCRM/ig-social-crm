"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

const PROMPTS = [
  "I wholesale houses in Nashville. Been doing this 3 years.",
  "We're a land acquisition company working in rural Tennessee and Kentucky.",
  "Solo investor focused on pre-foreclosures and inherited properties.",
  "Off-market acquisition firm. Closed 40+ deals last year.",
  "I flip distressed properties in the Southeast. Work with all conditions.",
  "Small team — we find deals, assign to buyers, close fast.",
];

export default function OnboardClient() {
  const searchParams = useSearchParams();
  const prefilledPrompt = searchParams.get("prompt");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  const hasStarted = messages.length > 0 || loading;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (prefilledPrompt) {
      void sendMessage(prefilledPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(userText: string | null) {
    const next: Message[] = userText
      ? [...messages, { role: "user" as const, content: userText }]
      : messages;

    if (userText) setMessages(next);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/profile/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json() as { message?: string; done?: boolean; slug?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const aiMessage = data.message ?? "";
      const display = aiMessage.replace(/```settings[\s\S]*?```/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: display || aiMessage }]);

      if (data.done) {
        if (data.slug) setSlug(data.slug);
        setDone(true);
      }
    } catch {
      setError("Connection error. Check your internet and try again.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    void sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) return;
      setInput("");
      void sendMessage(text);
    }
  }

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .prompt-chip:hover {
          background: #f0ebe0 !important;
          border-color: #c9a07a !important;
          color: #2d4a2d !important;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

        {/* Header */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>
              LockboxHQ · Website Builder
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
              {hasStarted ? "Answer each question — your page builds as you go" : "Answer 7 questions and your page goes live instantly"}
            </div>
          </div>
          {hasStarted && (
            <Link href="/app/profile" style={{ fontSize: 12, color: "var(--ink-muted)", textDecoration: "none" }}>← Back</Link>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

          {/* Welcome state — shown before chat starts */}
          {!hasStarted && (
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px", animation: "fadeIn 0.4s ease" }}>

              {/* Dark hero */}
              <div style={{
                borderRadius: 20,
                background: "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 50%, #1c3220 100%)",
                padding: "40px 36px",
                marginBottom: 20,
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(160,120,80,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(160,120,80,0.2)", border: "1px solid rgba(160,120,80,0.4)",
                    borderRadius: 20, padding: "4px 12px", marginBottom: 18,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a07850" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#c9a07a", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Website Builder</span>
                  </div>

                  <h2 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                    Let&apos;s build your public page.
                  </h2>
                  <p style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
                    I&apos;ll ask you 7 questions about your business. Your answers become polished marketing copy — bio, process steps, stats, and a color palette — published instantly.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginBottom: 32 }}>
                    {[
                      "Company name & tagline",
                      "Stats you're proud of",
                      "Markets you work in",
                      "Your story & bio",
                      "Your process (3 steps)",
                      "Brand color palette",
                    ].map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#a07850", fontSize: 10, flexShrink: 0 }}>✦</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void sendMessage(null)}
                    style={{
                      background: "#a07850", color: "#fff", border: "none",
                      padding: "13px 28px", borderRadius: 10, fontWeight: 800,
                      fontSize: 15, cursor: "pointer", letterSpacing: "-0.01em",
                    }}
                  >
                    Start building →
                  </button>
                </div>
              </div>

              {/* Suggested prompts */}
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "22px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: 4 }}>
                  Or start with a quick intro
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--ink-faint)" }}>
                  Tap one — the AI will pick up from there.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="prompt-chip"
                      onClick={() => void sendMessage(prompt)}
                      style={{
                        padding: "8px 14px", borderRadius: 20,
                        background: "var(--surface-strong, #f8fafc)",
                        border: "1px solid var(--border)",
                        fontSize: 12, color: "var(--ink-muted)",
                        cursor: "pointer", transition: "all 0.15s",
                        textAlign: "left",
                      }}
                    >
                      &ldquo;{prompt}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {hasStarted && (
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "12px 16px",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: msg.role === "user" ? "#2d4a2d" : "var(--surface)",
                    color: msg.role === "user" ? "#fff" : "var(--ink)",
                    fontSize: 14, lineHeight: 1.65,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", height: 16 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#a07850", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {done && (
                <div style={{ textAlign: "center", padding: "28px 20px", background: "#f0fdf4", borderRadius: 16, border: "1px solid #bbf7d0", marginTop: 8 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🌿</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#2d4a2d", marginBottom: 8 }}>Your page is live.</div>
                  <div style={{ fontSize: 14, color: "#5a5a4a", marginBottom: 24 }}>Click below to see it.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    {slug && (
                      <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" style={{ background: "#2d4a2d", color: "#fff", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                        View live page →
                      </a>
                    )}
                    <Link href="/app/profile" style={{ background: "#fff", color: "#2d4a2d", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", border: "1px solid #bbf7d0" }}>
                      My Page
                    </Link>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input — only shown once chat has started and not done */}
        {hasStarted && !done && (
          <div style={{ padding: "12px 16px 20px", borderTop: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
            {error && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8, textAlign: "center" }}>{error}</div>
            )}
            <form onSubmit={handleSubmit} style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 12,
                  border: "1px solid var(--border)", fontSize: 14,
                  lineHeight: 1.5, resize: "none", outline: "none",
                  background: "var(--surface-strong)", color: "var(--ink)",
                  fontFamily: "inherit", maxHeight: 120, overflowY: "auto",
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  padding: "12px 18px", borderRadius: 12,
                  background: loading || !input.trim() ? "var(--border)" : "#2d4a2d",
                  color: "#fff", border: "none",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: 14, flexShrink: 0, transition: "background 0.15s",
                }}
              >
                Send
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--ink-faint)", margin: "8px 0 0" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </>
  );
}
