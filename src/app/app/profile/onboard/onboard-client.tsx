"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

export default function OnboardClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Kick off with the first AI message
  useEffect(() => {
    void sendMessage(null);
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
      const data = await res.json() as { message?: string; done?: boolean; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const aiMessage = data.message ?? "";
      // Strip the settings block from display
      const display = aiMessage.replace(/```settings[\s\S]*?```/g, "").trim();

      setMessages(prev => [...prev, { role: "assistant", content: display || aiMessage }]);

      if (data.done) setDone(true);
    } catch {
      setError("Connection error. Try again.");
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
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#faf8f4", fontFamily: "'Satoshi','Avenir Next','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e0d8c8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#1c1c1c", letterSpacing: "-0.02em" }}>Build Your Website</div>
          <div style={{ fontSize: 12, color: "#8a8a7a", marginTop: 2 }}>Answer a few questions — we&apos;ll build your page</div>
        </div>
        <Link href="/app/profile" style={{ fontSize: 12, color: "#8a8a7a", textDecoration: "none" }}>← Back</Link>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 680, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%",
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user" ? "#2d4a2d" : "#ffffff",
              color: msg.role === "user" ? "#fff" : "#1c1c1c",
              fontSize: 14,
              lineHeight: 1.65,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              border: msg.role === "assistant" ? "1px solid #e0d8c8" : "none",
              whiteSpace: "pre-wrap",
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#ffffff", border: "1px solid #e0d8c8", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", height: 16 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#a07850", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#dc2626", padding: "8px 16px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}

        {done && (
          <div style={{ textAlign: "center", padding: "24px 16px", background: "#f0fdf4", borderRadius: 16, border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#2d4a2d", marginBottom: 8 }}>Your website is ready.</div>
            <div style={{ fontSize: 14, color: "#5a5a4a", marginBottom: 20 }}>Head to My Page to preview and fine-tune it.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/app/profile" style={{ background: "#2d4a2d", color: "#fff", padding: "11px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                View My Page →
              </Link>
              <Link href="/app/profile/onboard" onClick={() => { setMessages([]); setDone(false); void sendMessage(null); }} style={{ background: "#fff", color: "#2d4a2d", padding: "11px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", border: "1px solid #e0d8c8" }}>
                Start Over
              </Link>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!done && (
        <div style={{ padding: "12px 16px 20px", borderTop: "1px solid #e0d8c8", background: "#fff", flexShrink: 0 }}>
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
                flex: 1,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #e0d8c8",
                fontSize: 14,
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
                background: "#faf8f4",
                color: "#1c1c1c",
                fontFamily: "inherit",
                maxHeight: 120,
                overflowY: "auto",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: "12px 18px",
                borderRadius: 12,
                background: loading || !input.trim() ? "#e0d8c8" : "#2d4a2d",
                color: "#fff",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              Send
            </button>
          </form>
          <p style={{ textAlign: "center", fontSize: 11, color: "#8a8a7a", margin: "8px 0 0" }}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
