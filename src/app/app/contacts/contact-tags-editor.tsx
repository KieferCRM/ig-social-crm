"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeTagList } from "@/lib/tags";

const OFF_MARKET_SUGGESTIONS = [
  "acquisition",
  "disposition",
  "motivated seller",
  "cash buyer",
  "needs comps",
  "docs missing",
];

export default function ContactTagsEditor({
  contactId,
  initialTags,
  isOffMarketAccount,
}: {
  contactId: string;
  initialTags: string[];
  isOffMarketAccount: boolean;
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState(initialTags.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const suggestions = useMemo(
    () => OFF_MARKET_SUGGESTIONS.filter((tag) => !tags.includes(tag)),
    [tags]
  );

  async function saveTags(nextValue: string) {
    const nextTags = normalizeTagList(nextValue);
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/leads/simple/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error || "Could not save tags.");
        return;
      }

      setTags(nextTags);
      setDraft(nextTags.join(", "));
      setMessage("Tags saved.");
      router.refresh();
    } catch {
      setMessage("Could not save tags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-stack-6">
      {tags.length > 0 ? (
        <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <span key={`${contactId}-${tag}`} className="crm-chip">
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>No tags yet</div>
      )}

      {isOffMarketAccount && suggestions.length > 0 ? (
        <div className="crm-inline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
          {suggestions.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              className="crm-chip"
              onClick={() => {
                const nextTags = normalizeTagList([...tags, tag]);
                setTags(nextTags);
                setDraft(nextTags.join(", "));
              }}
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}

      <div className="crm-inline-actions" style={{ gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add tags, comma separated"
          style={{ minWidth: 260, flex: "1 1 260px" }}
        />
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => void saveTags(draft)}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save tags"}
        </button>
      </div>

      {message ? (
        <div
          className={`crm-chip ${message.includes("Could not") ? "crm-chip-danger" : "crm-chip-ok"}`}
          style={{ width: "fit-content" }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
