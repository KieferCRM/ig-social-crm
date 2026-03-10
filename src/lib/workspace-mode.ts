export type WorkspaceMode = "solo";

export function normalizeWorkspaceMode(value: unknown): WorkspaceMode | null {
  if (value === "solo") return "solo";
  return null;
}

export function parseFullAccessUserIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}
