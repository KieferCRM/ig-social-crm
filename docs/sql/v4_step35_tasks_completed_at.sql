-- v4_step35_tasks_completed_at.sql
--
-- Adds completed_at column to lead_recommendations so the Tasks page
-- can show a "Completed Today" section and sort/filter by completion time.

begin;

alter table public.lead_recommendations
  add column if not exists completed_at timestamptz;

-- Backfill: set completed_at = updated_at for rows already marked done
update public.lead_recommendations
set completed_at = updated_at
where status = 'done' and completed_at is null;

commit;
