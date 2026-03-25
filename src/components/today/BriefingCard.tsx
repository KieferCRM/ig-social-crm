"use client";

import { useRef, useState } from "react";

type Mode = "idle" | "loading" | "result";

const CHIPS = [
  { label: "Brief me", question: null },
  { label: "What's stale?", question: "What's stale?" },
  { label: "How's my pipeline?", question: "How's my pipeline?" },
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

  function reset() {
    setMode("idle");
    setResult(null);
    setInput("");
  }

  function handleSubmit() {
    const q = input.trim();
    if (!q) return;
    setInput("");
    void run(q);
  }

  return (
    <article className="crm-card crm-section-card">
      {/* Chips + input row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {CHIPS.map(({ label, question }) => (
          <button
            key={label}
            onClick={() => void run(question)}
            disabled={mode === "loading"}
            style={{
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              opacity: mode === "loading" ? 0.5 : 1,
            }}
          >
            {label}
          </button>
        ))}
        <input
          ref={inputRef}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            flex: 1,
            minWidth: 140,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--background)",
            color: "var(--foreground)",
          }}
          placeholder="Ask your pipeline…"
          value={input}
          disabled={mode === "loading"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || mode === "loading"}
          style={{
            fontSize: 12,
            padding: "5px 12px",
            borderRadius: 6,
            border: "none",
            background: "var(--brand)",
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            opacity: !input.trim() || mode === "loading" ? 0.5 : 1,
          }}
        >
          Ask
        </button>
      </div>

      {/* Loading skeleton */}
      {mode === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <div style={{ height: 11, borderRadius: 4, background: "var(--surface-2)", width: "85%" }} />
          <div style={{ height: 11, borderRadius: 4, background: "var(--surface-2)", width: "65%" }} />
        </div>
      )}

      {/* Result */}
      {mode === "result" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10 }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink)", margin: 0, flex: 1 }}>
            {result ?? "Couldn't get a response. Try again."}
          </p>
          <button
            onClick={reset}
            style={{ fontSize: 11, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, paddingTop: 1 }}
          >
            ✕
          </button>
        </div>
      )}
    </article>
  );
}
