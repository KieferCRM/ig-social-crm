-- V4 Step 31: Off-market pipeline additional columns + expanded stage values
-- Run after v4_step29_deals_board_foundation.sql

begin;

-- 1. New columns
alter table public.deals
  add column if not exists offer_price numeric(14,2);

alter table public.deals
  add column if not exists tags text[] not null default '{}';

alter table public.deals
  add column if not exists stage_entered_at timestamptz;

alter table public.deals
  add column if not exists next_followup_date date;

-- 2. Back-fill stage_entered_at for existing rows (use updated_at as best proxy)
update public.deals
set stage_entered_at = updated_at
where stage_entered_at is null;

-- 3. Expand the stage check constraint to include off-market pipeline stages.
--    Must drop + recreate because Postgres doesn't support ALTER CONSTRAINT.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'deals_stage_check'
      and conrelid = 'public.deals'::regclass
  ) then
    alter table public.deals drop constraint deals_stage_check;
  end if;

  alter table public.deals add constraint deals_stage_check check (
    stage in (
      -- General board stages (kept for existing kanban)
      'new',
      'showing',
      'offer_made',
      'under_contract',
      'inspection',
      'appraisal',
      'closing',
      'closed',
      'lost',
      -- Off-market pipeline stages
      'prospecting',
      'offer_sent',
      'negotiating',
      'dead'
    )
  );
end $$;

-- 4. Index to speed up tag filtering (GIN for array containment)
create index if not exists idx_deals_tags
  on public.deals using gin (tags);

notify pgrst, 'reload schema';

commit;
