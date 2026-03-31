import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { IntakeLinkFormType } from "@/lib/forms/templates";

export const dynamic = "force-dynamic";

const VALID_FORM_TYPES = new Set<IntakeLinkFormType>(["buyer", "seller", "contact"]);

function generateSlug(name: string): string {
  // Sanitize name into slug prefix (max 24 chars), append random suffix
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 7); // 5 random alphanum chars
  return prefix ? `${prefix}-${suffix}` : suffix;
}

function defaultSourceLabel(name: string, formType: IntakeLinkFormType): string {
  const typeLabel = formType === "buyer" ? "Buyer" : formType === "seller" ? "Seller" : "Contact";
  return `${typeLabel} – ${name}`;
}

// ── GET /api/intake-links ─────────────────────────────────────────────────────

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("intake_links")
    .select("id, slug, name, form_type, headline, source_label, submission_count, created_at")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

// ── POST /api/intake-links ────────────────────────────────────────────────────

type CreateBody = {
  name?: string;
  form_type?: string;
  headline?: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = (body.name ?? "").trim();
  const formType = body.form_type as IntakeLinkFormType | undefined;
  const headline = (body.headline ?? "").trim() || null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!formType || !VALID_FORM_TYPES.has(formType)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  // Generate a unique slug — retry once on collision
  const admin = supabaseAdmin();
  let slug = generateSlug(name);
  const { data: existing } = await admin
    .from("intake_links")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = generateSlug(name); // second attempt with different random suffix

  const { data, error } = await admin
    .from("intake_links")
    .insert({
      agent_id: user.id,
      slug,
      name,
      form_type: formType,
      headline,
      source_label: defaultSourceLabel(name, formType),
      submission_count: 0,
    })
    .select("id, slug, name, form_type, headline, source_label, submission_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data }, { status: 201 });
}
