"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type WorkspaceMode = "solo" | "team";

function callbackMessage(metaState: string | null): string {
  if (metaState === "connected") return "Meta account connected.";
  if (metaState === "error_state") return "Meta connect failed: invalid state.";
  if (metaState === "error_store") return "Meta connect failed: token save error.";
  if (metaState === "error_callback") return "Meta connect failed during callback.";
  if (metaState === "error_unauthorized") return "Please log in and try again.";
  return "";
}

export default function ChannelsSettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(false);
  const [modeLoading, setModeLoading] = useState<WorkspaceMode | null>(null);
  const [message, setMessage] = useState("");
  const [urlMessage, setUrlMessage] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");
  const [eventWarning, setEventWarning] = useState("");
  const [events, setEvents] = useState<
    Array<{
      id: string;
      created_at: string;
      status: "processed" | "deduped" | "failed" | "ignored";
      mode: "dev" | "meta";
      meta_message_id: string | null;
      meta_participant_id: string | null;
      reason: string | null;
    }>
  >([]);
  const [summary, setSummary] = useState({
    processed: 0,
    deduped: 0,
    failed: 0,
    ignored: 0,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlMessage(callbackMessage(params.get("meta")));

    async function loadWorkspaceMode() {
      try {
        const response = await fetch("/api/workspace/context");
        if (!response.ok) return;
        const data = (await response.json()) as { workspace_mode: WorkspaceMode | null };
        setWorkspaceMode(data.workspace_mode);
      } catch {
        // no-op
      }
    }

    async function loadEvents() {
      setEventLoading(true);
      setEventError("");
      setEventWarning("");
      try {
        const response = await fetch("/api/meta/webhook/events");
        const data = (await response.json()) as {
          events?: Array<{
            id: string;
            created_at: string;
            status: "processed" | "deduped" | "failed" | "ignored";
            mode: "dev" | "meta";
            meta_message_id: string | null;
            meta_participant_id: string | null;
            reason: string | null;
          }>;
          summary?: { last_24h?: { processed?: number; deduped?: number; failed?: number; ignored?: number } };
          warning?: string;
          error?: string;
        };

        if (!response.ok) {
          setEventError(data.error || "Could not load webhook status.");
          return;
        }

        setEvents(data.events || []);
        setSummary({
          processed: data.summary?.last_24h?.processed || 0,
          deduped: data.summary?.last_24h?.deduped || 0,
          failed: data.summary?.last_24h?.failed || 0,
          ignored: data.summary?.last_24h?.ignored || 0,
        });
        setEventWarning(data.warning || "");
      } catch {
        setEventError("Could not load webhook status.");
      } finally {
        setEventLoading(false);
      }
    }

    void loadWorkspaceMode();
    void loadEvents();
  }, []);

  async function switchWorkspaceMode(mode: WorkspaceMode) {
    setWorkspaceMessage("");
    setModeLoading(mode);
    const { error } = await supabase.auth.updateUser({
      data: { workspace_mode: mode },
    });
    setModeLoading(null);
    if (error) {
      setWorkspaceMessage("Could not switch workspace mode.");
      return;
    }

    setWorkspaceMode(mode);
    setWorkspaceMessage(`Switched to ${mode} mode.`);
    router.push(mode === "team" ? "/app/team" : "/app");
    router.refresh();
  }

  async function connectMeta() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/meta/connect/start", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        connect_url?: string;
      };

      if (!response.ok) {
        setMessage(data.error || "Failed to start Meta connect.");
        return;
      }

      if (data.connect_url) {
        window.location.href = data.connect_url;
        return;
      }

      setMessage(data.message || "Meta connect started.");
    } catch {
      setMessage("Failed to start Meta connect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>Channels</h1>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Meta (Instagram + Facebook)</div>
        <button
          onClick={connectMeta}
          disabled={loading}
          style={{
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Connecting..." : "Connect Meta"}
        </button>

        <div style={{ marginTop: 10, color: "#444", fontSize: 14 }}>
          {message || urlMessage}
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Workspace Mode</div>
        <div style={{ color: "#444", fontSize: 14, marginBottom: 10 }}>
          Current mode: {workspaceMode ? workspaceMode : "not selected"}
        </div>
        {workspaceMode === "solo" ? (
          <button
            onClick={() => void switchWorkspaceMode("team")}
            disabled={modeLoading === "team"}
            style={{
              padding: "10px 14px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              cursor: modeLoading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {modeLoading === "team" ? "Switching..." : "Switch To Team Workspace"}
          </button>
        ) : null}
        {workspaceMode === "team" ? (
          <button
            onClick={() => void switchWorkspaceMode("solo")}
            disabled={modeLoading === "solo"}
            style={{
              padding: "10px 14px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              cursor: modeLoading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {modeLoading === "solo" ? "Switching..." : "Switch To Solo Workspace"}
          </button>
        ) : null}
        {workspaceMessage ? (
          <div style={{ marginTop: 10, fontSize: 13, color: workspaceMessage.includes("Could") ? "#b00020" : "#186a3b" }}>
            {workspaceMessage}
          </div>
        ) : null}
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Webhook Ingestion Status (last 24h)</div>

        {eventLoading ? (
          <div style={{ color: "#555", fontSize: 14 }}>Loading webhook status...</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
              <span>Processed: {summary.processed}</span>
              <span>Deduped: {summary.deduped}</span>
              <span>Ignored: {summary.ignored}</span>
              <span style={{ color: summary.failed > 0 ? "#b00020" : "#444" }}>Failed: {summary.failed}</span>
            </div>

            {eventWarning ? <div style={{ color: "#8a5200", fontSize: 13 }}>{eventWarning}</div> : null}
            {eventError ? <div style={{ color: "#b00020", fontSize: 13 }}>{eventError}</div> : null}

            {summary.failed > 0 ? (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Recent failures</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {events
                    .filter((e) => e.status === "failed")
                    .slice(0, 8)
                    .map((event) => (
                      <div
                        key={event.id}
                        style={{
                          border: "1px solid #f0caca",
                          borderRadius: 8,
                          padding: 8,
                          background: "#fff5f5",
                          fontSize: 12,
                          color: "#7f1d1d",
                        }}
                      >
                        <div>{new Date(event.created_at).toLocaleString()}</div>
                        <div>Reason: {event.reason || "unknown"}</div>
                        <div>
                          Message: {event.meta_message_id || "—"} | Participant: {event.meta_participant_id || "—"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 4, color: "#186a3b", fontSize: 13 }}>
                No webhook failures recorded in the last 24 hours.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
