"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "What should I focus on today?",
  "Who needs follow-up?",
  "How's my pipeline?",
];

async function sendChat(messages: Message[]): Promise<string | null> {
  try {
    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = (await res.json()) as { text?: string };
    return data.text ?? null;
  } catch {
    return null;
  }
}

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const reply = await sendChat(next);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: reply ?? "Sorry, I couldn't get a response. Try again.",
      },
    ]);
    setLoading(false);
  }

  function handleSubmit() {
    const q = input.trim();
    if (!q || loading) return;
    void send(q);
  }

  return (
    <>
      {/* Floating button — collapsed state */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="AI Assistant"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: open ? "var(--ink, #1e293b)" : "var(--brand, #16a34a)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
          zIndex: 1100,
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        {open ? "✕" : "✦"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            right: 24,
            width: 370,
            maxHeight: 520,
            background: "var(--surface-1, #fff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            zIndex: 1099,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "11px 14px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface-2, #f8fafc)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
              Ask anything about your business
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 13,
                  textAlign: "center",
                  paddingTop: 12,
                  lineHeight: 1.5,
                }}
              >
                Your second brain. Ask about deals, contacts, priorities — anything.
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "87%",
                  background:
                    msg.role === "user"
                      ? "var(--brand, #16a34a)"
                      : "var(--surface-2, #f1f5f9)",
                  color: msg.role === "user" ? "#fff" : "var(--ink)",
                  borderRadius:
                    msg.role === "user"
                      ? "12px 12px 4px 12px"
                      : "12px 12px 12px 4px",
                  padding: "8px 12px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "var(--surface-2, #f1f5f9)",
                  borderRadius: "12px 12px 12px 4px",
                  padding: "10px 14px",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--ink-muted, #94a3b8)",
                      opacity: 0.6,
                      animation: `floatingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts — shown only before first message */}
          {messages.length === 0 && (
            <div
              style={{
                padding: "0 14px 10px",
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  disabled={loading}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "var(--surface-2, #f8fafc)",
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 14px",
              borderTop: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <input
              ref={inputRef}
              style={{
                flex: 1,
                fontSize: 13,
                padding: "7px 10px",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 8,
                background: "var(--background)",
                color: "var(--foreground)",
                outline: "none",
              }}
              placeholder="Ask anything..."
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--brand, #16a34a)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: !input.trim() || loading ? 0.45 : 1,
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatingDot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </>
  );
}
