"use client";

import { useRef, useState } from "react";

type Mode = "idle" | "loading" | "result" | "asking";

const CHIPS = [
  "What's going stale?",
  "How's my pipeline?",
  "What did I miss?",
];

async function fetchBrief(question: string | null): Promise<string | null> {
  try {
    const res = await fetch("/api/today/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json() as { text?: string };
    return data.text ?? null;
  } catch {
    return null;
  }
}

export default function BriefingCard() {
  const [mode, setMode] = useState<Mode>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(question: string | null) {
    setMode("loading");
    const text = await fetchBrief(question);
    setResult(text);
    setMode("result");
  }

  function openAsking() {
    setMode("asking");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleChip(chip: string) {
    void run(chip);
  }

  function handleSubmit() {
    const q = input.trim();
    if (!q) return;
    void run(q);
  }

  return (
    <article className="crm-card crm-section-card crm-stack-8">
      <h2 className="crm-section-title">AI Assistant</h2>

      {mode === "idle" && (
        <button
          className="crm-btn crm-btn-primary"
          style={{ alignSelf: "flex-start" }}
          onClick={() => void run(null)}
        >
          Brief me
        </button>
      )}

      {mode === "loading" && (
        <div className="crm-stack-6">
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "88%" }} />
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "72%" }} />
          <div style={{ height: 14, borderRadius: 4, background: "var(--surface-2)", width: "80%" }} />
        </div>
      )}

      {mode === "result" && result && (
        <div className="crm-stack-8">
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink)", margin: 0 }}>
            {result}
          </p>
          <button
            onClick={openAsking}
            style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--brand)", cursor: "pointer", alignSelf: "flex-start", textDecoration: "underline" }}
          >
            Ask something else
          </button>
        </div>
      )}

      {mode === "result" && !result && (
        <div className="crm-stack-8">
          <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: 0 }}>
            Couldn&apos;t generate a brief right now. Try again in a moment.
          </p>
          <button
            onClick={() => setMode("idle")}
            style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--brand)", cursor: "pointer", alignSelf: "flex-start", textDecoration: "underline" }}
          >
            Try again
          </button>
        </div>
      )}

      {mode === "asking" && (
        <div className="crm-stack-8">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 13 }}
              >
                {chip}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              className="crm-input"
              style={{ flex: 1, fontSize: 13 }}
              placeholder="Ask anything about your pipeline…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
            <button
              className="crm-btn crm-btn-primary"
              style={{ fontSize: 13, flexShrink: 0 }}
              onClick={handleSubmit}
              disabled={!input.trim()}
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
