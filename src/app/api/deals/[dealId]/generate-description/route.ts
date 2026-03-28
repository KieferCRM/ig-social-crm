import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await params;

  const { data: deal } = await supabase
    .from("deals")
    .select("id, property_address, price, deal_details, notes, agent_id")
    .eq("id", dealId)
    .eq("agent_id", user.id)
    .maybeSingle();

  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const details = (deal.deal_details ?? {}) as Record<string, unknown>;
  const address = deal.property_address ?? "the property";
  const listPrice = details.list_price ?? deal.price ?? null;
  const mlsNumber = details.mls_number ?? null;
  const notes = deal.notes ?? "";

  const { features } = await req.json() as { features?: string };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured." }, { status: 503 });

  const client = new Anthropic({ apiKey });

  const prompt = `Write a professional real estate listing description for the following property.

Property address: ${address}
${listPrice ? `List price: $${listPrice}` : ""}
${mlsNumber ? `MLS: ${mlsNumber}` : ""}
${features ? `Agent notes / features to highlight:\n${features}` : ""}
${notes ? `Additional context:\n${notes}` : ""}

Write a compelling, 3-4 paragraph listing description that:
- Opens with a strong, vivid hook about the property
- Highlights key features and selling points naturally
- Mentions neighborhood/location benefits if inferable
- Ends with a call to action for showings
- Sounds warm and professional, not overly salesy
- Is 150-200 words total

Return only the description text, no headers or labels.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const description = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
  if (!description) return NextResponse.json({ error: "Failed to generate description." }, { status: 500 });

  return NextResponse.json({ description });
}
