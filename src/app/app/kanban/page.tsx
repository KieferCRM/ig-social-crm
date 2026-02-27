"use client";

import { type DragEvent, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const stages = ["New", "Contacted", "Warm", "Hot", "Closed"];

export default function KanbanPage() {
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const supabaseRef = useRef<ReturnType<typeof supabaseBrowser> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = supabaseBrowser();
  const supabase = supabaseRef.current;

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const draggedLeadIdRef = useRef<string | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  async function loadLeads() {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("time_last_updated", { ascending: false });

    setLeads(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  async function handleDrop(targetStage: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();

    const leadIdFromTransfer = e.dataTransfer.getData("text/plain");
    const draggedId = leadIdFromTransfer || draggedLeadIdRef.current;
    if (!draggedId) return;

    const currentLead = leads.find((l) => String(l.id) === String(draggedId));
    if (!currentLead) return;
    if (currentLead.stage === targetStage) {
      setStatus("");
      return;
    }

    const leadId = currentLead.id;
    const previousLeads = leads;

    setStatus("");
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: targetStage } : l))
    );
    setSelectedLead((prev: any) =>
      prev?.id === leadId ? { ...prev, stage: targetStage } : prev
    );

    const { error } = await supabase
      .from("leads")
      .update({ stage: targetStage })
      .eq("id", leadId);

    draggedLeadIdRef.current = null;

    if (error) {
      setLeads(previousLeads);
      setSelectedLead((prev: any) =>
        prev?.id === leadId ? { ...prev, stage: currentLead.stage } : prev
      );
      setStatus("Could not update stage. Reverted change.");
    }
  }

  // Debounced autosave for detail panel edits
  useEffect(() => {
    if (!selectedLead) return;

    // Don't autosave immediately when switching to a different lead
    if (lastSelectedIdRef.current !== selectedLead.id) {
      lastSelectedIdRef.current = selectedLead.id;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const snapshot = {
      id: selectedLead.id,
      intent: selectedLead.intent ?? "",
      timeline: selectedLead.timeline ?? "",
      source: selectedLead.source ?? "",
      stage: selectedLead.stage ?? "New",
      notes: selectedLead.notes ?? "",
    };

    autosaveTimerRef.current = setTimeout(async () => {
      setSaving(true);

      const { error } = await supabase
        .from("leads")
        .update({
          intent: snapshot.intent,
          timeline: snapshot.timeline,
          source: snapshot.source,
          stage: snapshot.stage,
          notes: snapshot.notes,
        })
        .eq("id", snapshot.id);

      if (error) {
        console.error("Autosave failed:", error);
        setSaving(false);
        return;
      }

      // Keep board in sync without reloading everything
      setLeads((prev) =>
        prev.map((l) =>
          l.id === snapshot.id
            ? {
                ...l,
                intent: snapshot.intent,
                timeline: snapshot.timeline,
                source: snapshot.source,
                stage: snapshot.stage,
                notes: snapshot.notes,
              }
            : l
        )
      );

      setSaving(false);
    }, 650);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [selectedLead, supabase]);

  const grouped = stages.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.stage === stage),
  }));

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
  <div>
    <h1 style={{ margin: 0 }}>Pipeline</h1>
    <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
      Click a lead to edit. Changes autosave.
    </div>
  </div>

  <a href="/app" style={{ textDecoration: "none", fontWeight: 600 }}>
    ← Dashboard
  </a>
</div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 24,
          alignItems: "flex-start",
        }}
      >
        {grouped.map((column) => (
          <div
            key={column.stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => void handleDrop(column.stage, e)}
            style={{
              flex: 1,
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <h3>{column.stage}</h3>

            {column.leads.map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => {
                  const id = String(lead.id);
                  draggedLeadIdRef.current = id;
                  e.dataTransfer.setData("text/plain", id);
                }}
                onClick={() => setSelectedLead(lead)}
                style={{
                  background: "white",
                  padding: 8,
                  marginBottom: 8,
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: "pointer",
                  border:
                    selectedLead?.id === lead.id
                      ? "2px solid #111"
                      : "2px solid transparent",
                }}
              >
                <strong>@{lead.ig_username}</strong>

                <div
                  style={{
                    marginTop: 4,
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      lead.lead_temp === "Hot"
                        ? "#ffe5e5"
                        : lead.lead_temp === "Warm"
                        ? "#fff4e5"
                        : "#f0f0f0",
                    color:
                      lead.lead_temp === "Hot"
                        ? "#d40000"
                        : lead.lead_temp === "Warm"
                        ? "#b26b00"
                        : "#555",
                  }}
                >
                  {lead.lead_temp?.toUpperCase() || "—"}
                </div>

                <div style={{ marginTop: 6 }}>{lead.intent}</div>
              </div>
            ))}
          </div>
        ))}

        <div
          style={{
            width: 320,
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            padding: 12,
            position: "sticky",
            top: 24,
            height: "fit-content",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Lead</strong>
            {selectedLead ? (
              <button onClick={() => setSelectedLead(null)}>Close</button>
            ) : null}
          </div>

          {!selectedLead ? (
            <p style={{ marginTop: 12, color: "#666", fontSize: 14 }}>
              Click a lead to view details.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Instagram</div>
                <div style={{ fontWeight: 700 }}>
                  @{selectedLead.ig_username}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Temperature</div>
                <div style={{ fontWeight: 700 }}>
                  {selectedLead.lead_temp || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Intent</div>
                <input
                  value={selectedLead.intent || ""}
                  onChange={(e) =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      intent: e.target.value,
                    }))
                  }
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Timeline</div>
                <input
                  value={selectedLead.timeline || ""}
                  onChange={(e) =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      timeline: e.target.value,
                    }))
                  }
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Source</div>
                <input
                  value={selectedLead.source || ""}
                  onChange={(e) =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      source: e.target.value,
                    }))
                  }
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Stage</div>
                <select
                  value={selectedLead.stage || "New"}
                  onChange={(e) =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      stage: e.target.value,
                    }))
                  }
                  style={{ width: "100%", padding: 8 }}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Notes</div>
                <textarea
                  value={selectedLead.notes || ""}
                  onChange={(e) =>
                    setSelectedLead((prev: any) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  rows={5}
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              <button disabled style={{ opacity: 0.7 }}>
                {saving ? "Saving..." : "Autosave enabled"}
              </button>
            </div>
          )}
        </div>
      </div>

      {status ? (
        <div style={{ marginTop: 10, color: "#b00020", fontSize: 13 }}>{status}</div>
      ) : null}
    </main>
  );
}
