import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  PROFILE_PALETTES,
  mergeWorkspaceSettingsIntoAgentSettings,
  readWorkspaceSettingsFromAgentSettings,
} from "@/lib/workspace-settings";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are a professional real estate website designer and copywriter for LockboxHQ. Your job is to conduct a friendly onboarding interview and build a complete, polished public profile page for a real estate professional.

Ask one focused question at a time. Be conversational and warm. When you have enough information, generate their full website configuration.

## Interview Flow
Ask these in order, one at a time:
1. What's your company name? (or your name if you operate solo)
2. In one sentence, what do you do and who do you help? (this becomes the tagline)
3. What areas or markets do you work in?
4. Describe your process — how does working with you go from first contact to closed deal? (3-4 steps)
5. Do you have any stats you're proud of? (deals closed, years in business, response time, states served — whatever feels right)
6. Tell me a bit about yourself or your company story. (this becomes the bio)
7. What's your brand vibe? Pick the one that fits best: Earthy & grounded / Modern & clean / Bold & professional / Warm & approachable / Fresh & coastal

## Color Palettes
- earthy: deep greens, warm browns — land, nature, roots
- modern: dark navy, clean whites, blue accent — sleek and sharp
- bold: deep navy, gold accent — luxury and authority
- warm: rich amber, burnt orange — welcoming and energetic
- clean: teal, seafoam — fresh and trustworthy

## When You Have All Answers
Output a JSON block (and ONLY this JSON, no surrounding text) wrapped exactly like this:

\`\`\`settings
{
  "profile_company_name": "...",
  "profile_tagline": "...",
  "profile_bio": "...",
  "profile_service_areas": ["...", "..."],
  "profile_how_it_works": [
    { "id": "1", "step": "01", "title": "...", "body": "..." },
    { "id": "2", "step": "02", "title": "...", "body": "..." },
    { "id": "3", "step": "03", "title": "...", "body": "..." }
  ],
  "profile_stats": [
    { "id": "1", "value": "...", "label": "..." }
  ],
  "profile_theme": {
    "palette": "earthy"
  }
}
\`\`\`

## Copywriting Rules
- Taglines: punchy, specific, no fluff. Bad: "We help you buy and sell homes." Good: "Off-market land deals, closed fast and honest."
- Bio: 2-3 paragraphs, personal, story-driven. Write in first person unless they gave a company name.
- How It Works: verb-led titles (Submit, Evaluate, Close), short body copy (2 sentences max)
- Stats: use the numbers they gave — don't invent them. If none, omit the array.
- Always write polished marketing copy from rough answers. Transform "I've been doing this 10 years" into "10+ Years in the Market".`;

function extractSettings(text: string): Record<string, unknown> | null {
  const match = text.match(/```settings\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveTheme(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const paletteName = typeof r.palette === "string" ? r.palette : "earthy";
  const base = PROFILE_PALETTES[paletteName] ?? PROFILE_PALETTES.earthy;
  return { ...base, ...r };
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { messages?: Message[] };
  try {
    body = await req.json() as { messages?: Message[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages: Message[] = body.messages?.length
    ? body.messages
    : [{ role: "user", content: "Hi, I'm ready to build my profile page." }];

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      messages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI service unavailable";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const rawSettings = extractSettings(text);

  if (rawSettings) {
    if (rawSettings.profile_theme) {
      rawSettings.profile_theme = resolveTheme(rawSettings.profile_theme);
    }

    const admin = supabaseAdmin();
    const { data: agent } = await admin
      .from("agents")
      .select("settings, vanity_slug")
      .eq("id", user.id)
      .maybeSingle();

    const current = readWorkspaceSettingsFromAgentSettings(agent?.settings);
    const updated = mergeWorkspaceSettingsIntoAgentSettings(agent?.settings, {
      ...current,
      ...rawSettings,
      profile_public: true,
    });

    const { error: saveError } = await admin
      .from("agents")
      .upsert({ id: user.id, settings: updated, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .eq("id", user.id);

    if (saveError) {
      return NextResponse.json({ error: `Saved AI response but failed to write profile: ${saveError.message}` }, { status: 500 });
    }

    const slug = (agent?.vanity_slug as string | null) ?? user.id;
    return NextResponse.json({ message: text, done: true, settings: rawSettings, slug });
  }

  return NextResponse.json({ message: text, done: false });
}
