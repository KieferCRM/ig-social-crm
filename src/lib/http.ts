type JsonParseResult<T> =
  | { ok: true; data: T; raw: string }
  | { ok: false; status: number; error: string };

type ReadTextResult =
  | { ok: true; raw: string }
  | { ok: false; status: number; error: string };

type BodyOptions = {
  maxBytes: number;
};

function contentLength(request: Request): number | null {
  const header = request.headers.get("content-length");
  if (!header) return null;
  const parsed = Number(header);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isOverLimit(request: Request, maxBytes: number): boolean {
  const length = contentLength(request);
  return length !== null && length > maxBytes;
}

function bodyTooLargeMessage(maxBytes: number): string {
  const kb = Math.ceil(maxBytes / 1024);
  return `Payload too large. Max ${kb}KB.`;
}

export function getClientIp(request: Request): string {
  const fromCf = request.headers.get("cf-connecting-ip");
  if (fromCf) return fromCf.trim();

  const fromReal = request.headers.get("x-real-ip");
  if (fromReal) return fromReal.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export async function readTextBody(
  request: Request,
  { maxBytes }: BodyOptions
): Promise<ReadTextResult> {
  if (isOverLimit(request, maxBytes)) {
    return { ok: false, status: 413, error: bodyTooLargeMessage(maxBytes) };
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body." };
  }

  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return { ok: false, status: 413, error: bodyTooLargeMessage(maxBytes) };
  }

  return { ok: true, raw };
}

export async function parseJsonBody<T>(
  request: Request,
  { maxBytes }: BodyOptions
): Promise<JsonParseResult<T>> {
  const body = await readTextBody(request, { maxBytes });
  if (!body.ok) return body;
  if (!body.raw.trim()) {
    return { ok: false, status: 400, error: "Request body is required." };
  }

  try {
    return { ok: true, data: JSON.parse(body.raw) as T, raw: body.raw };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON payload." };
  }
}
