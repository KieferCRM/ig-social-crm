-- V2 Step 14: Appointment outcome tracking

begin;

create table if not exists public.lead_appointments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null check (status in ('booked','no_show','won','lost','other')),
  event_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_appointments_agent_event_at
  on public.lead_appointments (agent_id, event_at desc);

create index if not exists idx_lead_appointments_lead_event_at
  on public.lead_appointments (lead_id, event_at desc);

alter table public.lead_appointments enable row level security;

drop policy if exists lead_appointments_select_own on public.lead_appointments;
create policy lead_appointments_select_own on public.lead_appointments
for select to authenticated
using (agent_id = auth.uid());

drop policy if exists lead_appointments_insert_own on public.lead_appointments;
create policy lead_appointments_insert_own on public.lead_appointments
for insert to authenticated
with check (agent_id = auth.uid());

drop policy if exists lead_appointments_update_own on public.lead_appointments;
create policy lead_appointments_update_own on public.lead_appointments
for update to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

drop policy if exists lead_appointments_delete_own on public.lead_appointments;
create policy lead_appointments_delete_own on public.lead_appointments
for delete to authenticated
using (agent_id = auth.uid());

commit;
