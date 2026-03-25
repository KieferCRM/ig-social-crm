"use client";

import { useRef, useState } from "react";

type Mode = "idle" | "loading" | "result";

const CHIPS = [
  "Brief me",
  "What's stale?",
  "How's my pipeline?",
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Prompt chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => void run(chip === "Brief me" ? null : chip)}
              disabled={mode === "loading"}
              className="crm-btn crm-btn-secondary"
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Free text input */}
        <div style={{ display: "flex", gap: 6, minWidth: 200 }}>
          <input
            ref={inputRef}
            className="crm-input"
            style={{ fontSize: 12, padding: "4px 10px", flex: 1 }}
            placeholder="Ask your pipeline…"
            value={input}
            disabled={mode === "loading"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <button
            className="crm-btn crm-btn-primary"
            style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }}
            onClick={handleSubmit}
            disabled={!input.trim() || mode === "loading"}
          >
            Ask
          </button>
        </div>
      </div>

      {/* Result */}
      {mode === "loading" && (
        <div className="crm-stack-4" style={{ marginTop: 10 }}>
          <div style={{ height: 12, borderRadius: 4, background: "var(--surface-2)", width: "85%" }} />
          <div style={{ height: 12, borderRadius: 4, background: "var(--surface-2)", width: "68%" }} />
        </div>
      )}

      {mode === "result" && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink)", margin: 0, flex: 1 }}>
            {result ?? "Couldn't get a response. Try again."}
          </p>
          <button
            onClick={reset}
            style={{ fontSize: 11, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, paddingTop: 2 }}
          >
            ✕
          </button>
        </div>
      )}
    </article>
  );
}
