-- v3 step 19: automation rules foundation (no-Meta dependency)
-- Creates user-configurable rules that auto-create follow-up reminders
-- when new leads are added/imported.

begin;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  trigger_event text not null default 'lead_created' check (trigger_event in ('lead_created')),
  enabled boolean not null default true,
  condition_stage text,
  condition_lead_temp text,
  delay_hours integer not null default 24 check (delay_hours >= 1 and delay_hours <= 720),
  reminder_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.automation_rules
set owner_user_id = coalesce(owner_user_id, agent_id)
where owner_user_id is null;

create index if not exists idx_automation_rules_owner on public.automation_rules (owner_user_id);
create index if not exists idx_automation_rules_team on public.automation_rules (team_id);
create index if not exists idx_automation_rules_event_enabled on public.automation_rules (trigger_event, enabled);

alter table public.automation_rules enable row level security;

drop trigger if exists trg_automation_rules_updated_at on public.automation_rules;
create trigger trg_automation_rules_updated_at
before update on public.automation_rules
for each row
execute function public.set_updated_at();

drop policy if exists automation_rules_select_team_or_owner on public.automation_rules;
create policy automation_rules_select_team_or_owner on public.automation_rules
for select to authenticated
using (
  owner_user_id = auth.uid()
  or (team_id is not null and team_id = public.current_team_id())
);

drop policy if exists automation_rules_insert_team_or_owner on public.automation_rules;
create policy automation_rules_insert_team_or_owner on public.automation_rules
for insert to authenticated
with check (
  (
    owner_user_id = auth.uid()
    and (team_id is null or team_id = public.current_team_id())
  )
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists automation_rules_update_team_or_owner on public.automation_rules;
create policy automation_rules_update_team_or_owner on public.automation_rules
for update to authenticated
using (
  owner_user_id = auth.uid()
  or (team_id is not null and team_id = public.current_team_id())
)
with check (
  (
    owner_user_id = auth.uid()
    and (team_id is null or team_id = public.current_team_id())
  )
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

drop policy if exists automation_rules_delete_owner_or_adminish on public.automation_rules;
create policy automation_rules_delete_owner_or_adminish on public.automation_rules
for delete to authenticated
using (
  owner_user_id = auth.uid()
  or (team_id = public.current_team_id() and public.is_team_adminish())
);

commit;
