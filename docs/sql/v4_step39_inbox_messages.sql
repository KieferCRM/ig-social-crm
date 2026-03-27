-- =============================================================================
-- v4_step39_inbox_messages.sql
-- Inbox messages table for LockboxHQ email inbox
-- Each agent has a unique inbox: [vanity_slug]@inbox.lockboxhq.com
-- Emails are parsed by Postmark and processed by Claude
-- =============================================================================

begin;

create table if not exists public.inbox_messages (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references public.agents(id) on delete cascade,

  -- Email metadata
  postmark_message_id text,                        -- idempotency
  from_email          text,
  from_name           text,
  subject             text,
  body_text           text,
  received_at         timestamptz not null default now(),

  -- AI processing
  processed           boolean not null default false,
  ai_summary          text,                        -- one-line summary of what Claude extracted
  ai_action           text,                        -- created_lead | updated_deal | logged_note | stored_document | none

  -- CRM links (set by Claude)
  linked_deal_id      uuid references public.deals(id) on delete set null,
  linked_lead_id      uuid references public.leads(id) on delete set null,

  -- Attachments
  has_attachments     boolean not null default false,
  attachment_names    text[],                      -- filenames for display

  -- UI state
  read                boolean not null default false,

  created_at          timestamptz not null default now()
);

-- Unique on postmark message ID per agent (idempotency)
create unique index if not exists idx_inbox_messages_postmark_id
  on public.inbox_messages (agent_id, postmark_message_id)
  where postmark_message_id is not null;

-- Fast lookup by agent, newest first
create index if not exists idx_inbox_messages_agent_received
  on public.inbox_messages (agent_id, received_at desc);

-- RLS
alter table public.inbox_messages enable row level security;

create policy "agent owns inbox messages"
  on public.inbox_messages
  for all
  using (agent_id = auth.uid());

commit;

-- Verification:
-- SELECT COUNT(*) FROM inbox_messages;
