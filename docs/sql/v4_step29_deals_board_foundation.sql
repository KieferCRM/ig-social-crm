-- V4 Step 29: Simple deals pipeline board foundation

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

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_address text not null,
  deal_type text not null,
  price numeric(14,2),
  stage text not null default 'new',
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals
  add column if not exists agent_id uuid references auth.users(id) on delete cascade;

alter table public.deals
  add column if not exists lead_id uuid references public.leads(id) on delete cascade;

alter table public.deals
  add column if not exists property_address text;

alter table public.deals
  add column if not exists deal_type text;

alter table public.deals
  add column if not exists price numeric(14,2);

alter table public.deals
  add column if not exists stage text;

alter table public.deals
  add column if not exists expected_close_date date;

alter table public.deals
  add column if not exists notes text;

alter table public.deals
  add column if not exists created_at timestamptz not null default now();

alter table public.deals
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deals_deal_type_check'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_deal_type_check
      check (deal_type in ('buyer', 'listing'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'deals_stage_check'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals
      add constraint deals_stage_check
      check (
        stage in (
          'new',
          'showing',
          'offer_made',
          'under_contract',
          'inspection',
          'appraisal',
          'closing',
          'closed',
          'lost'
        )
      );
  end if;
end $$;

update public.deals
set stage = 'new'
where stage is null;

alter table public.deals
  alter column stage set default 'new';

create index if not exists idx_deals_agent_id
  on public.deals (agent_id);

create index if not exists idx_deals_agent_stage
  on public.deals (agent_id, stage);

create index if not exists idx_deals_lead_id
  on public.deals (lead_id);

create index if not exists idx_deals_agent_expected_close_date
  on public.deals (agent_id, expected_close_date);

alter table public.deals enable row level security;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
before update on public.deals
for each row
execute function public.set_updated_at();

drop policy if exists deals_select_owner on public.deals;
drop policy if exists deals_insert_owner on public.deals;
drop policy if exists deals_update_owner on public.deals;
drop policy if exists deals_delete_owner on public.deals;

create policy deals_select_owner on public.deals
for select to authenticated
using (agent_id = auth.uid());

create policy deals_insert_owner on public.deals
for insert to authenticated
with check (agent_id = auth.uid());

create policy deals_update_owner on public.deals
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy deals_delete_owner on public.deals
for delete to authenticated
using (agent_id = auth.uid());

notify pgrst, 'reload schema';

commit;
