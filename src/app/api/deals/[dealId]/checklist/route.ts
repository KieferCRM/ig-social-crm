import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUYER_TEMPLATE = [
  "Collect executed purchase agreement",
  "Open escrow and confirm earnest money deposit",
  "Send contract to lender",
  "Schedule home inspection",
  "Review inspection report with buyer",
  "Negotiate inspection repairs / credits",
  "Confirm appraisal ordered by lender",
  "Review appraisal result",
  "Clear financing contingency",
  "Confirm title search ordered",
  "Review title commitment with buyer",
  "Coordinate homeowner's insurance binder",
  "Confirm clear to close from lender",
  "Schedule closing date and time",
  "Final walkthrough",
  "Confirm wire instructions with buyer",
  "Attend closing",
  "Hand over keys — send thank you",
] as const;

const LISTING_TEMPLATE = [
  "Collect executed purchase agreement",
  "Open escrow and confirm earnest money received",
  "Send contract to title company",
  "Deliver seller disclosures to buyer",
  "Schedule buyer's home inspection",
  "Negotiate inspection repairs / credits",
  "Confirm buyer appraisal ordered",
  "Review appraisal result with seller",
  "Confirm all contingencies cleared",
  "Confirm title search ordered",
  "Review title commitment with seller",
  "Coordinate deed preparation with title",
  "Confirm clear to close",
  "Schedule closing date and time",
  "Final walkthrough with buyer",
  "Confirm seller wire instructions",
  "Attend closing",
  "Collect proceeds confirmation — send thank you",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await params;

  // Verify deal belongs to agent
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("agent_id", user.id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const { data: items, error } = await supabase
    .from("deal_checklist_items")
    .select("id, label, completed, completed_at, sort_order, created_at")
    .eq("deal_id", dealId)
    .eq("agent_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: items ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await params;

  // Verify deal belongs to agent and get deal type for template
  const { data: deal } = await supabase
    .from("deals")
    .select("id, deal_type")
    .eq("id", dealId)
    .eq("agent_id", user.id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { label?: string; seed_template?: boolean };

  if (body.seed_template) {
    // Seed the appropriate template — skip if items already exist
    const { count } = await supabase
      .from("deal_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("deal_id", dealId)
      .eq("agent_id", user.id);

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Checklist already has items." }, { status: 409 });
    }

    const template = deal.deal_type === "listing" ? LISTING_TEMPLATE : BUYER_TEMPLATE;
    const rows = template.map((label, i) => ({
      deal_id: dealId,
      agent_id: user.id,
      label,
      sort_order: i,
    }));

    const { data: items, error } = await supabase
      .from("deal_checklist_items")
      .insert(rows)
      .select("id, label, completed, completed_at, sort_order, created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items });
  }

  // Add single item
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Label is required." }, { status: 400 });

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("deal_checklist_items")
    .select("sort_order")
    .eq("deal_id", dealId)
    .eq("agent_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = ((maxRow?.sort_order as number | null) ?? -1) + 1;

  const { data: item, error } = await supabase
    .from("deal_checklist_items")
    .insert({ deal_id: dealId, agent_id: user.id, label, sort_order: sortOrder })
    .select("id, label, completed, completed_at, sort_order, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item });
}
