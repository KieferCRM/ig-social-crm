-- V2 Steps 5-12 foundation: qualification settings, lead qualification fields, reminders

begin;

create table if not exists public.qualification_settings (
  agent_id uuid primary key references auth.users(id) on delete cascade,
  intent_enabled boolean not null default true,
  intent_question text not null default 'What are you looking for exactly (buy/sell/invest)?',
  timeline_enabled boolean not null default true,
  timeline_question text not null default 'What is your ideal timeline to move?',
  budget_range_enabled boolean not null default true,
  budget_range_question text not null default 'What budget range are you targeting?',
  location_area_enabled boolean not null default true,
  location_area_question text not null default 'Which location or neighborhood is best for you?',
  contact_preference_enabled boolean not null default true,
  contact_preference_question text not null default 'How do you prefer we stay in touch?',
  next_step_enabled boolean not null default true,
  next_step_question text not null default 'What is the best next step for you right now?',
  completion_message text not null default 'Great, you are qualified. I can help with next steps now.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists budget_range text;

alter table public.leads
  add column if not exists location_area text;

alter table public.leads
  add column if not exists contact_preference text;

alter table public.leads
  add column if not exists next_step text;

alter table public.leads
  add column if not exists last_qualification_bucket_asked text;

create table if not exists public.follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','done')),
  note text,
  preset text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_up_reminders_agent_due
  on public.follow_up_reminders (agent_id, due_at asc);

alter table public.qualification_settings enable row level security;
alter table public.follow_up_reminders enable row level security;

drop trigger if exists trg_qualification_settings_updated_at on public.qualification_settings;
create trigger trg_qualification_settings_updated_at
before update on public.qualification_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_follow_up_reminders_updated_at on public.follow_up_reminders;
create trigger trg_follow_up_reminders_updated_at
before update on public.follow_up_reminders
for each row
execute function public.set_updated_at();

drop policy if exists qualification_settings_select_own on public.qualification_settings;
create policy qualification_settings_select_own on public.qualification_settings
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists qualification_settings_insert_own on public.qualification_settings;
create policy qualification_settings_insert_own on public.qualification_settings
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists qualification_settings_update_own on public.qualification_settings;
create policy qualification_settings_update_own on public.qualification_settings
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists qualification_settings_delete_own on public.qualification_settings;
create policy qualification_settings_delete_own on public.qualification_settings
for delete to authenticated
using (agent_id = auth.uid());

drop policy if exists follow_up_reminders_select_own on public.follow_up_reminders;
create policy follow_up_reminders_select_own on public.follow_up_reminders
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists follow_up_reminders_insert_own on public.follow_up_reminders;
create policy follow_up_reminders_insert_own on public.follow_up_reminders
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists follow_up_reminders_update_own on public.follow_up_reminders;
create policy follow_up_reminders_update_own on public.follow_up_reminders
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists follow_up_reminders_delete_own on public.follow_up_reminders;
create policy follow_up_reminders_delete_own on public.follow_up_reminders
for delete to authenticated
using (agent_id = auth.uid());

commit;
