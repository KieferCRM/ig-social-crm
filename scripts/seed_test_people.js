/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});
}

async function main() {
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, '.env.local');

  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found in project root');
  }

  const env = parseEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  const email = process.argv[2] || 'routeflow@test.com';

  let page = 1;
  let target = null;

  while (!target) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const users = data?.users || [];
    target = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());

    if (target || users.length < 200) break;
    page += 1;
  }

  if (!target) {
    throw new Error(`User not found for email: ${email}`);
  }

  const agentId = target.id;
  const now = new Date();

  const leads = [
    {
      ig_username: 'austin_buyer_jane',
      stage: 'New',
      lead_temp: 'Warm',
      intent: 'Looking for 3-bed in South Austin',
      timeline: '30-60 days',
      source: 'IG DM',
      notes: 'Pre-approved, wants good schools',
      last_message_preview: 'Can we tour this weekend?',
    },
    {
      ig_username: 'dallas_investor_mike',
      stage: 'Contacted',
      lead_temp: 'Hot',
      intent: 'Investment duplex in Dallas',
      timeline: 'ASAP',
      source: 'FB DM',
      notes: '1031 exchange deadline in 45 days',
      last_message_preview: 'Send me cap rate options please',
    },
    {
      ig_username: 'houston_relocate_amy',
      stage: 'Warm',
      lead_temp: 'Warm',
      intent: 'Relocating for work to Houston',
      timeline: '90 days',
      source: 'IG DM',
      notes: 'Needs near med center',
      last_message_preview: 'What neighborhoods do you recommend?',
    },
    {
      ig_username: 'firsthome_carlos',
      stage: 'Hot',
      lead_temp: 'Hot',
      intent: 'First-time buyer townhouse',
      timeline: '2-4 weeks',
      source: 'FB DM',
      notes: 'Needs low HOA',
      last_message_preview: 'I can do evenings after 6pm',
    },
    {
      ig_username: 'seller_kim_lakeway',
      stage: 'Closed',
      lead_temp: 'Warm',
      intent: 'Selling condo in Lakeway',
      timeline: 'listed',
      source: 'IG DM',
      notes: 'Already under contract',
      last_message_preview: 'Thanks for all your help!',
    },
  ].map((lead, i) => ({
    agent_id: agentId,
    ...lead,
    time_last_updated: new Date(now.getTime() - i * 3600_000).toISOString(),
  }));

  const { error: leadError } = await admin
    .from('leads')
    .upsert(leads, { onConflict: 'agent_id,ig_username' });

  if (leadError) throw new Error(`lead upsert failed: ${leadError.message}`);

  const conversations = leads.map((lead, i) => ({
    agent_id: agentId,
    platform: lead.source === 'FB DM' ? 'fb' : 'ig',
    meta_thread_id: `seed_thread_${lead.ig_username}`,
    meta_participant_id: lead.ig_username,
    last_message_at: new Date(now.getTime() - i * 1800_000).toISOString(),
  }));

  const { data: conversationRows, error: conversationError } = await admin
    .from('conversations')
    .upsert(conversations, { onConflict: 'agent_id,platform,meta_thread_id' })
    .select('id,meta_participant_id,platform');

  if (conversationError) throw new Error(`conversation upsert failed: ${conversationError.message}`);

  const byHandle = new Map((conversationRows || []).map((row) => [row.meta_participant_id, row]));

  const messages = [];
  for (const lead of leads) {
    const convo = byHandle.get(lead.ig_username);
    if (!convo) continue;

    const base = new Date(now.getTime() - Math.floor(Math.random() * 8) * 3600_000);

    messages.push({
      agent_id: agentId,
      conversation_id: convo.id,
      meta_message_id: `seed_${lead.ig_username}_in_1`,
      direction: 'in',
      text: lead.last_message_preview,
      ts: new Date(base.getTime() + 60_000).toISOString(),
      raw_json: { seed: true, platform: convo.platform },
    });

    messages.push({
      agent_id: agentId,
      conversation_id: convo.id,
      meta_message_id: `seed_${lead.ig_username}_out_1`,
      direction: 'out',
      text: 'Absolutely, I can help with that. I will send options shortly.',
      ts: new Date(base.getTime() + 120_000).toISOString(),
      raw_json: { seed: true, platform: convo.platform },
    });

    messages.push({
      agent_id: agentId,
      conversation_id: convo.id,
      meta_message_id: `seed_${lead.ig_username}_in_2`,
      direction: 'in',
      text: 'Perfect, thank you!',
      ts: new Date(base.getTime() + 180_000).toISOString(),
      raw_json: { seed: true, platform: convo.platform },
    });
  }

  const { error: messageError } = await admin
    .from('messages')
    .upsert(messages, { onConflict: 'agent_id,meta_message_id' });

  if (messageError) throw new Error(`message upsert failed: ${messageError.message}`);

  console.log('Seed complete');
  console.log(`email=${email}`);
  console.log(`agent_id=${agentId}`);
  console.log(`leads=${leads.length}`);
  console.log(`conversations=${conversations.length}`);
  console.log(`messages=${messages.length}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
