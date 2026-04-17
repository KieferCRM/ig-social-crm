const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type GoogleOAuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  connected_email: string;
  calendar_id: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  colorId: string | null;
};

// ─── Auth URL ────────────────────────────────────────────────────────────────

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── Token exchange ──────────────────────────────────────────────────────────

type RawTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json() as RawTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error(data.error_description ?? data.error ?? "Token exchange failed");
  }

  const email = await fetchUserEmail(data.access_token);

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    connected_email: email,
    calendar_id: "primary",
  };
}

// ─── Token refresh ───────────────────────────────────────────────────────────

export async function refreshAccessToken(tokens: GoogleOAuthTokens): Promise<GoogleOAuthTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json() as RawTokenResponse;
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Token refresh failed");
  }

  return {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

// ─── Ensure valid token ──────────────────────────────────────────────────────

export async function ensureValidToken(tokens: GoogleOAuthTokens): Promise<{ tokens: GoogleOAuthTokens; refreshed: boolean }> {
  if (Date.now() < tokens.expires_at - 60_000) {
    return { tokens, refreshed: false };
  }
  const refreshed = await refreshAccessToken(tokens);
  return { tokens: refreshed, refreshed: true };
}

// ─── Revoke token ────────────────────────────────────────────────────────────

export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, { method: "POST" });
}

// ─── Fetch user email ────────────────────────────────────────────────────────

async function fetchUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { email?: string };
    return data.email ?? "";
  } catch {
    return "";
  }
}

// ─── Fetch events ────────────────────────────────────────────────────────────

export async function fetchCalendarEvents(
  tokens: GoogleOAuthTokens,
  options: { timeMin?: string; timeMax?: string; maxResults?: number } = {}
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(options.maxResults ?? 50),
  });
  if (options.timeMin) params.set("timeMin", options.timeMin);
  if (options.timeMax) params.set("timeMax", options.timeMax);

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(tokens.calendar_id)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  type RawEvent = {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
    colorId?: string;
  };
  type RawEventsResponse = { items?: RawEvent[] };

  const data = await res.json() as RawEventsResponse;
  return (data.items ?? []).map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    summary: e.summary ?? "(No title)",
    description: e.description ?? null,
    location: e.location ?? null,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
    htmlLink: e.htmlLink ?? "",
    colorId: e.colorId ?? null,
  }));
}

// ─── Create event ─────────────────────────────────────────────────────────────

export async function createCalendarEvent(
  tokens: GoogleOAuthTokens,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string; // ISO datetime
    end: string;   // ISO datetime
  }
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(tokens.calendar_id)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start, timeZone: "UTC" },
        end: { dateTime: event.end, timeZone: "UTC" },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Create event failed: ${res.status}`);
  }

  const data = await res.json() as { id?: string; htmlLink?: string };
  return { id: data.id ?? "", htmlLink: data.htmlLink ?? "" };
}

// ─── Settings key ────────────────────────────────────────────────────────────

export const GOOGLE_OAUTH_KEY = "google_oauth_v1";

export function readGoogleTokens(settings: unknown): GoogleOAuthTokens | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const raw = (settings as Record<string, unknown>)[GOOGLE_OAUTH_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.access_token !== "string" ||
    typeof r.refresh_token !== "string" ||
    typeof r.expires_at !== "number"
  ) return null;
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: r.expires_at,
    connected_email: typeof r.connected_email === "string" ? r.connected_email : "",
    calendar_id: typeof r.calendar_id === "string" ? r.calendar_id : "primary",
  };
}
