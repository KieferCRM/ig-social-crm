-- V3 Team collaboration foundation: team workspaces, role-based collaboration, assignment, tasking, source attribution,
-- reporting primitives, and role-restricted destructive actions.

begin;

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('agent','team_lead','admin','broker_owner')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role text not null check (role in ('agent','team_lead','admin')),
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_chats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_comments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  is_handoff_note boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  assignee_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_at timestamptz,
  recurrence text check (recurrence in ('none','daily','weekly','monthly')),
  source_event text,
  sla_bucket text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.team_stage_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  flow_type text not null check (flow_type in ('buyer','listing','lease')),
  stage text not null,
  stage_order int not null,
  required_fields text[] not null default '{}'::text[],
  unique(team_id, flow_type, stage)
);

create table if not exists public.team_sla_rules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  inbound_response_target_minutes int not null default 15,
  stale_lead_hours int not null default 48,
  overdue_task_hours int not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select tm.team_id
  from public.team_members tm
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.joined_at asc
  limit 1
$$;

create or replace function public.current_team_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select tm.role
  from public.team_members tm
  where tm.user_id = auth.uid()
    and tm.status = 'active'
  order by tm.joined_at asc
  limit 1
$$;

revoke all on function public.current_team_id() from public;
revoke all on function public.current_team_role() from public;
grant execute on function public.current_team_id() to authenticated, service_role;
grant execute on function public.current_team_role() to authenticated, service_role;

create or replace function public.is_team_adminish()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_team_role() in ('team_lead','admin','broker_owner'), false)
$$;

alter table public.leads
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.leads
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.leads
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null;
alter table public.leads
  add column if not exists visibility text not null default 'team_visible' check (visibility in ('private','team_visible','broker_visible'));
alter table public.leads
  add column if not exists archived_at timestamptz;
alter table public.leads
  add column if not exists first_source_channel text check (first_source_channel in ('ig','fb','webform','website','email','phone','manual','import_csv','other'));
alter table public.leads
  add column if not exists latest_source_channel text check (latest_source_channel in ('ig','fb','webform','website','email','phone','manual','import_csv','other'));
alter table public.leads
  add column if not exists first_source_method text check (first_source_method in ('webhook','api','manual','import','unknown'));
alter table public.leads
  add column if not exists latest_source_method text check (latest_source_method in ('webhook','api','manual','import','unknown'));
alter table public.leads
  add column if not exists first_touch_at timestamptz;
alter table public.leads
  add column if not exists first_touch_message_id text;
alter table public.leads
  add column if not exists source_detail jsonb not null default '{}'::jsonb;
alter table public.leads
  add column if not exists source_confidence text not null default 'unknown' check (source_confidence in ('exact','inferred','unknown'));
alter table public.leads
  add column if not exists flow_type text not null default 'buyer' check (flow_type in ('buyer','listing','lease'));

update public.leads
set owner_user_id = coalesce(owner_user_id, agent_id),
    assignee_user_id = coalesce(assignee_user_id, agent_id),
    latest_source_channel = coalesce(latest_source_channel,
      case
        when lower(coalesce(source,'')) like '%instagram%' or lower(coalesce(source,'')) = 'ig' then 'ig'
        when lower(coalesce(source,'')) like '%facebook%' or lower(coalesce(source,'')) = 'fb' then 'fb'
        when lower(coalesce(source,'')) like '%webform%' then 'webform'
        when lower(coalesce(source,'')) like '%website%' then 'website'
        when lower(coalesce(source,'')) like '%email%' then 'email'
        when lower(coalesce(source,'')) like '%phone%' then 'phone'
        when coalesce(source,'') = '' then null
        else 'other'
      end),
    first_source_channel = coalesce(first_source_channel,
      case
        when lower(coalesce(source,'')) like '%instagram%' or lower(coalesce(source,'')) = 'ig' then 'ig'
        when lower(coalesce(source,'')) like '%facebook%' or lower(coalesce(source,'')) = 'fb' then 'fb'
        when lower(coalesce(source,'')) like '%webform%' then 'webform'
        when lower(coalesce(source,'')) like '%website%' then 'website'
        when lower(coalesce(source,'')) like '%email%' then 'email'
        when lower(coalesce(source,'')) like '%phone%' then 'phone'
        when coalesce(source,'') = '' then null
        else 'other'
      end),
    latest_source_method = coalesce(latest_source_method, 'unknown'),
    first_source_method = coalesce(first_source_method, 'unknown');

update public.leads l
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = l.agent_id
  and tm.status = 'active'
  and l.team_id is null;

create index if not exists idx_leads_team_updated
  on public.leads (team_id, time_last_updated desc);
create index if not exists idx_leads_team_owner
  on public.leads (team_id, owner_user_id, assignee_user_id);
create unique index if not exists idx_leads_team_ig_unique
  on public.leads (team_id, ig_username)
  where team_id is not null;

alter table public.conversations
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.messages
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.follow_up_reminders
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.lead_appointments
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.meta_tokens
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.qualification_settings
  add column if not exists team_id uuid references public.teams(id) on delete set null;
do $$
begin
  if to_regclass('public.automation_settings') is not null then
    execute 'alter table public.automation_settings add column if not exists team_id uuid references public.teams(id) on delete set null';
  end if;
end $$;

update public.conversations c
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = c.agent_id and tm.status = 'active' and c.team_id is null;

update public.messages m
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = m.agent_id and tm.status = 'active' and m.team_id is null;

update public.follow_up_reminders r
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = r.agent_id and tm.status = 'active' and r.team_id is null;

update public.lead_appointments a
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = a.agent_id and tm.status = 'active' and a.team_id is null;

update public.meta_tokens t
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = t.agent_id and tm.status = 'active' and t.team_id is null;

update public.qualification_settings q
set team_id = tm.team_id
from public.team_members tm
where tm.user_id = q.agent_id and tm.status = 'active' and q.team_id is null;

do $$
begin
  if to_regclass('public.automation_settings') is not null then
    execute '
      update public.automation_settings a
      set team_id = tm.team_id
      from public.team_members tm
      where tm.user_id = a.agent_id and tm.status = ''active'' and a.team_id is null
    ';
  end if;
end $$;

create index if not exists idx_conversations_team_last_message
  on public.conversations (team_id, last_message_at desc);
create index if not exists idx_messages_team_conversation_ts
  on public.messages (team_id, conversation_id, ts desc);
create index if not exists idx_reminders_team_due
  on public.follow_up_reminders (team_id, due_at asc);
create index if not exists idx_appointments_team_event
  on public.lead_appointments (team_id, event_at desc);
create index if not exists idx_comments_lead_created
  on public.lead_comments (lead_id, created_at desc);
create index if not exists idx_tasks_team_due_status
  on public.lead_tasks (team_id, status, due_at asc);
create index if not exists idx_team_chat_team_created
  on public.team_chats (team_id, created_at desc);
create index if not exists idx_team_members_user_status
  on public.team_members (user_id, status);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.team_chats enable row level security;
alter table public.lead_comments enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.lead_activity_log enable row level security;
alter table public.team_stage_templates enable row level security;
alter table public.team_sla_rules enable row level security;

-- Teams policies

drop policy if exists teams_select_visible on public.teams;
create policy teams_select_visible on public.teams
for select to authenticated
using (
  id in (
    select team_id from public.team_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists teams_insert_owner on public.teams;
create policy teams_insert_owner on public.teams
for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists teams_update_adminish on public.teams;
create policy teams_update_adminish on public.teams
for update to authenticated
using (id = public.current_team_id() and public.is_team_adminish())
with check (id = public.current_team_id() and public.is_team_adminish());

-- Team members policies

drop policy if exists team_members_select_visible on public.team_members;
create policy team_members_select_visible on public.team_members
for select to authenticated
using (
  user_id = auth.uid()
  or team_id = public.current_team_id()
);

drop policy if exists team_members_insert_adminish on public.team_members;
create policy team_members_insert_adminish on public.team_members
for insert to authenticated
with check (team_id = public.current_team_id() and public.is_team_adminish());

drop policy if exists team_members_update_adminish on public.team_members;
create policy team_members_update_adminish on public.team_members
for update to authenticated
using (team_id = public.current_team_id() and public.is_team_adminish())
with check (team_id = public.current_team_id() and public.is_team_adminish());

-- Team invites policies

drop policy if exists team_invites_select_visible on public.team_invites;
create policy team_invites_select_visible on public.team_invites
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists team_invites_insert_adminish on public.team_invites;
create policy team_invites_insert_adminish on public.team_invites
for insert to authenticated
with check (team_id = public.current_team_id() and public.is_team_adminish());

drop policy if exists team_invites_update_adminish on public.team_invites;
create policy team_invites_update_adminish on public.team_invites
for update to authenticated
using (team_id = public.current_team_id() and public.is_team_adminish())
with check (team_id = public.current_team_id() and public.is_team_adminish());

-- Collaboration policies

drop policy if exists team_chats_select_visible on public.team_chats;
create policy team_chats_select_visible on public.team_chats
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists team_chats_insert_member on public.team_chats;
create policy team_chats_insert_member on public.team_chats
for insert to authenticated
with check (team_id = public.current_team_id() and created_by_user_id = auth.uid());

drop policy if exists lead_comments_select_visible on public.lead_comments;
create policy lead_comments_select_visible on public.lead_comments
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists lead_comments_insert_member on public.lead_comments;
create policy lead_comments_insert_member on public.lead_comments
for insert to authenticated
with check (team_id = public.current_team_id() and author_user_id = auth.uid());

drop policy if exists lead_comments_update_owner_or_admin on public.lead_comments;
create policy lead_comments_update_owner_or_admin on public.lead_comments
for update to authenticated
using (team_id = public.current_team_id() and (author_user_id = auth.uid() or public.is_team_adminish()))
with check (team_id = public.current_team_id() and (author_user_id = auth.uid() or public.is_team_adminish()));

drop policy if exists lead_comments_delete_owner_or_admin on public.lead_comments;
create policy lead_comments_delete_owner_or_admin on public.lead_comments
for delete to authenticated
using (team_id = public.current_team_id() and (author_user_id = auth.uid() or public.is_team_adminish()));

drop policy if exists lead_tasks_select_visible on public.lead_tasks;
create policy lead_tasks_select_visible on public.lead_tasks
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists lead_tasks_insert_member on public.lead_tasks;
create policy lead_tasks_insert_member on public.lead_tasks
for insert to authenticated
with check (team_id = public.current_team_id());

drop policy if exists lead_tasks_update_member on public.lead_tasks;
create policy lead_tasks_update_member on public.lead_tasks
for update to authenticated
using (team_id = public.current_team_id())
with check (team_id = public.current_team_id());

drop policy if exists lead_tasks_delete_adminish on public.lead_tasks;
create policy lead_tasks_delete_adminish on public.lead_tasks
for delete to authenticated
using (team_id = public.current_team_id() and public.is_team_adminish());

drop policy if exists lead_activity_log_select_visible on public.lead_activity_log;
create policy lead_activity_log_select_visible on public.lead_activity_log
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists lead_activity_log_insert_member on public.lead_activity_log;
create policy lead_activity_log_insert_member on public.lead_activity_log
for insert to authenticated
with check (team_id = public.current_team_id());

drop policy if exists team_stage_templates_select_visible on public.team_stage_templates;
create policy team_stage_templates_select_visible on public.team_stage_templates
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists team_stage_templates_manage_adminish on public.team_stage_templates;
create policy team_stage_templates_manage_adminish on public.team_stage_templates
for all to authenticated
using (team_id = public.current_team_id() and public.is_team_adminish())
with check (team_id = public.current_team_id() and public.is_team_adminish());

drop policy if exists team_sla_rules_select_visible on public.team_sla_rules;
create policy team_sla_rules_select_visible on public.team_sla_rules
for select to authenticated
using (team_id = public.current_team_id());

drop policy if exists team_sla_rules_manage_adminish on public.team_sla_rules;
create policy team_sla_rules_manage_adminish on public.team_sla_rules
for all to authenticated
using (team_id = public.current_team_id() and public.is_team_adminish())
with check (team_id = public.current_team_id() and public.is_team_adminish());

-- Existing table policy upgrades for collaboration visibility

-- leads

drop policy if exists leads_select_own on public.leads;
drop policy if exists leads_insert_own on public.leads;
drop policy if exists leads_update_own on public.leads;
drop policy if exists leads_delete_own on public.leads;

drop policy if exists leads_select_team_or_owner on public.leads;
create policy leads_select_team_or_owner on public.leads
for select to authenticated
using (
  agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id())
);

drop policy if exists leads_insert_team_or_owner on public.leads;
create policy leads_insert_team_or_owner on public.leads
for insert to authenticated
with check (
  (
    agent_id = auth.uid()
    and (team_id is null or team_id = public.current_team_id())
  )
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists leads_update_team_or_owner on public.leads;
create policy leads_update_team_or_owner on public.leads
for update to authenticated
using (
  agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id())
)
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists leads_delete_owner_or_adminish on public.leads;
create policy leads_delete_owner_or_adminish on public.leads
for delete to authenticated
using (
  agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish())
);

-- conversations

drop policy if exists conversations_select_own on public.conversations;
drop policy if exists conversations_insert_own on public.conversations;
drop policy if exists conversations_update_own on public.conversations;
drop policy if exists conversations_delete_own on public.conversations;

drop policy if exists conversations_select_team_or_owner on public.conversations;
create policy conversations_select_team_or_owner on public.conversations
for select to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()));

drop policy if exists conversations_insert_team_or_owner on public.conversations;
create policy conversations_insert_team_or_owner on public.conversations
for insert to authenticated
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists conversations_update_team_or_owner on public.conversations;
create policy conversations_update_team_or_owner on public.conversations
for update to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()))
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists conversations_delete_owner_or_adminish on public.conversations;
create policy conversations_delete_owner_or_adminish on public.conversations
for delete to authenticated
using (agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish()));

-- messages

drop policy if exists messages_select_own on public.messages;
drop policy if exists messages_insert_own on public.messages;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_delete_own on public.messages;

drop policy if exists messages_select_team_or_owner on public.messages;
create policy messages_select_team_or_owner on public.messages
for select to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()));

drop policy if exists messages_insert_team_or_owner on public.messages;
create policy messages_insert_team_or_owner on public.messages
for insert to authenticated
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists messages_update_team_or_owner on public.messages;
create policy messages_update_team_or_owner on public.messages
for update to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()))
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists messages_delete_owner_or_adminish on public.messages;
create policy messages_delete_owner_or_adminish on public.messages
for delete to authenticated
using (agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish()));

-- reminders

drop policy if exists follow_up_reminders_select_own on public.follow_up_reminders;
drop policy if exists follow_up_reminders_insert_own on public.follow_up_reminders;
drop policy if exists follow_up_reminders_update_own on public.follow_up_reminders;
drop policy if exists follow_up_reminders_delete_own on public.follow_up_reminders;

drop policy if exists follow_up_reminders_select_team_or_owner on public.follow_up_reminders;
create policy follow_up_reminders_select_team_or_owner on public.follow_up_reminders
for select to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()));

drop policy if exists follow_up_reminders_insert_team_or_owner on public.follow_up_reminders;
create policy follow_up_reminders_insert_team_or_owner on public.follow_up_reminders
for insert to authenticated
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists follow_up_reminders_update_team_or_owner on public.follow_up_reminders;
create policy follow_up_reminders_update_team_or_owner on public.follow_up_reminders
for update to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()))
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists follow_up_reminders_delete_owner_or_adminish on public.follow_up_reminders;
create policy follow_up_reminders_delete_owner_or_adminish on public.follow_up_reminders
for delete to authenticated
using (agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish()));

-- appointments

drop policy if exists lead_appointments_select_own on public.lead_appointments;
drop policy if exists lead_appointments_insert_own on public.lead_appointments;
drop policy if exists lead_appointments_update_own on public.lead_appointments;
drop policy if exists lead_appointments_delete_own on public.lead_appointments;

drop policy if exists lead_appointments_select_team_or_owner on public.lead_appointments;
create policy lead_appointments_select_team_or_owner on public.lead_appointments
for select to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()));

drop policy if exists lead_appointments_insert_team_or_owner on public.lead_appointments;
create policy lead_appointments_insert_team_or_owner on public.lead_appointments
for insert to authenticated
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists lead_appointments_update_team_or_owner on public.lead_appointments;
create policy lead_appointments_update_team_or_owner on public.lead_appointments
for update to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()))
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists lead_appointments_delete_owner_or_adminish on public.lead_appointments;
create policy lead_appointments_delete_owner_or_adminish on public.lead_appointments
for delete to authenticated
using (agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish()));

-- meta tokens

drop policy if exists meta_tokens_select_own on public.meta_tokens;
drop policy if exists meta_tokens_insert_own on public.meta_tokens;
drop policy if exists meta_tokens_update_own on public.meta_tokens;
drop policy if exists meta_tokens_delete_own on public.meta_tokens;

drop policy if exists meta_tokens_select_team_or_owner on public.meta_tokens;
create policy meta_tokens_select_team_or_owner on public.meta_tokens
for select to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()));

drop policy if exists meta_tokens_insert_team_or_owner on public.meta_tokens;
create policy meta_tokens_insert_team_or_owner on public.meta_tokens
for insert to authenticated
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists meta_tokens_update_team_or_owner on public.meta_tokens;
create policy meta_tokens_update_team_or_owner on public.meta_tokens
for update to authenticated
using (agent_id = auth.uid() or (team_id is not null and team_id = public.current_team_id()))
with check (
  (agent_id = auth.uid() and (team_id is null or team_id = public.current_team_id()))
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists meta_tokens_delete_owner_or_adminish on public.meta_tokens;
create policy meta_tokens_delete_owner_or_adminish on public.meta_tokens
for delete to authenticated
using (agent_id = auth.uid() or (team_id = public.current_team_id() and public.is_team_adminish()));

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

drop trigger if exists trg_team_members_updated_at on public.team_members;
create trigger trg_team_members_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

drop trigger if exists trg_team_invites_updated_at on public.team_invites;
create trigger trg_team_invites_updated_at
before update on public.team_invites
for each row
execute function public.set_updated_at();

drop trigger if exists trg_lead_comments_updated_at on public.lead_comments;
create trigger trg_lead_comments_updated_at
before update on public.lead_comments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_lead_tasks_updated_at on public.lead_tasks;
create trigger trg_lead_tasks_updated_at
before update on public.lead_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_team_sla_rules_updated_at on public.team_sla_rules;
create trigger trg_team_sla_rules_updated_at
before update on public.team_sla_rules
for each row
execute function public.set_updated_at();

commit;
