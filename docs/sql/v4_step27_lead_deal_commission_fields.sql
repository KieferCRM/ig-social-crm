-- V4 Step 27: commission-aware lead performance fields
-- Adds nullable deal revenue columns directly to leads (no transaction subsystem).

begin;

alter table public.leads
  add column if not exists deal_price numeric(14,2),
  add column if not exists commission_percent numeric(6,3),
  add column if not exists commission_amount numeric(14,2),
  add column if not exists close_date date;

create index if not exists idx_leads_agent_stage_close_date
  on public.leads (agent_id, stage, close_date desc);

notify pgrst, 'reload schema';

commit;
