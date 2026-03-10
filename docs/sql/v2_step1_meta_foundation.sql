-- V2 Step 1 foundation: Meta connect placeholder + DM storage + webhook stubs

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ig','fb')),
  meta_thread_id text not null,
  meta_participant_id text not null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agent_id, platform, meta_thread_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  meta_message_id text not null,
  direction text not null check (direction in ('in','out')),
  text text,
  ts timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(agent_id, meta_message_id)
);

create table if not exists public.meta_tokens (
  agent_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz,
  meta_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists last_message_preview text;

alter table public.leads
  add column if not exists source text;

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_meta_tokens_updated_at on public.meta_tokens;
create trigger trg_meta_tokens_updated_at
before update on public.meta_tokens
for each row
execute function public.set_updated_at();

create index if not exists idx_conversations_agent_last_message_at
  on public.conversations (agent_id, last_message_at desc);

create index if not exists idx_messages_conversation_ts
  on public.messages (conversation_id, ts desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.meta_tokens enable row level security;

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own on public.conversations
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own on public.conversations
for delete to authenticated
using (agent_id = auth.uid());

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
for delete to authenticated
using (agent_id = auth.uid());

drop policy if exists meta_tokens_select_own on public.meta_tokens;
create policy meta_tokens_select_own on public.meta_tokens
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists meta_tokens_insert_own on public.meta_tokens;
create policy meta_tokens_insert_own on public.meta_tokens
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists meta_tokens_update_own on public.meta_tokens;
create policy meta_tokens_update_own on public.meta_tokens
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists meta_tokens_delete_own on public.meta_tokens;
create policy meta_tokens_delete_own on public.meta_tokens
for delete to authenticated
using (agent_id = auth.uid());

commit;
