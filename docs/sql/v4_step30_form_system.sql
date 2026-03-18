-- V4 Step 30: Form system fields on leads table

begin;

-- Add form_type to track which form template generated the lead
alter table public.leads
  add column if not exists form_type text;

-- Add ai_followup_sent flag for Concierge automation
alter table public.leads
  add column if not exists ai_followup_sent boolean not null default false;

-- Add lead_score for AI-assigned qualification (hot/warm/cold override)
alter table public.leads
  add column if not exists lead_score text
  check (lead_score in ('hot', 'warm', 'cold'));

-- Index for querying by form type
create index if not exists idx_leads_form_type
  on public.leads (agent_id, form_type);

-- Index for ai followup queue
create index if not exists idx_leads_ai_followup
  on public.leads (agent_id, ai_followup_sent)
  where ai_followup_sent = false;

notify pgrst, 'reload schema';

commit;
