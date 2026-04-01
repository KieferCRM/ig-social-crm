/**
 * GET  /api/agent/slug?slug=xxx  — check availability (no auth required)
 * PATCH /api/agent/slug          — update the calling agent's vanity slug
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadAccessContext } from "@/lib/access-context";
import { parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function validateSlug(slug: unknown): { ok: true; slug: string } | { ok: false; error: string } {
  if (typeof slug !== "string" || !slug.trim()) {
    return { ok: false, error: "Slug is required." };
  }
  const s = slug.trim().toLowerCase();
  if (!SLUG_RE.test(s)) {
    return {
      ok: false,
      error:
        "Slug must be 3–30 characters, use only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.",
    };
  }
  return { ok: true, slug: s };
}

// ── GET: availability check ───────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rawSlug = searchParams.get("slug") ?? "";

  const validated = validateSlug(rawSlug);
  if (!validated.ok) {
    return NextResponse.json({ available: false, error: validated.error });
  }

  const slug = validated.slug;
  const admin = supabaseAdmin();

  // Optional: if the caller is authenticated, exclude their own row so they can
  // re-save their current slug without seeing "already taken".
  let excludeId: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    excludeId = user?.id ?? null;
  } catch {
    // unauthenticated — fine
  }

  let query = admin
    .from("agents")
    .select("id")
    .ilike("vanity_slug", slug);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.maybeSingle();

  return NextResponse.json({ available: !data });
}

// ── PATCH: update slug ────────────────────────────────────────────────────────

type Body = { slug: string };

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await supabaseServer();
  const auth = await loadAccessContext(supabase);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = await parseJsonBody<Body>(request, { maxBytes: 512 });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const validated = validateSlug(parsed.data.slug);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const slug = validated.slug;
  const agentId = auth.context.user.id;
  const admin = supabaseAdmin();

  // Check availability (exclude self)
  const { data: conflict } = await admin
    .from("agents")
    .select("id")
    .ilike("vanity_slug", slug)
    .neq("id", agentId)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({ error: "That slug is already taken." }, { status: 409 });
  }

  // Read current slug so we can record it in history
  const { data: current } = await admin
    .from("agents")
    .select("vanity_slug")
    .eq("id", agentId)
    .maybeSingle();

  const oldSlug = current?.vanity_slug ?? null;

  // If slug is changing, record the old one
  if (oldSlug && oldSlug.toLowerCase() !== slug.toLowerCase()) {
    await admin.from("agent_slug_history").insert({ agent_id: agentId, old_slug: oldSlug });
  }

  // Update slug
  const { error } = await admin
    .from("agents")
    .update({ vanity_slug: slug, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug });
}
