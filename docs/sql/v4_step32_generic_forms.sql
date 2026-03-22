-- Generic forms: agent-created custom question forms
create table if not exists public.generic_forms (
  id          uuid        primary key default gen_random_uuid(),
  agent_id    uuid        not null references public.agents(id) on delete cascade,
  title       text        not null default 'Custom Form',
  description text,
  questions   jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.generic_forms enable row level security;

-- Agents can fully manage their own forms
create policy "agents_manage_own_generic_forms"
  on public.generic_forms

  for all
  using  (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- Generic form submissions
create table if not exists public.generic_form_submissions (
  id              uuid        primary key default gen_random_uuid(),
  form_id         uuid        not null references public.generic_forms(id) on delete cascade,
  submission_data jsonb       not null default '{}'::jsonb,
  ip_address      text,
  submitted_at    timestamptz not null default now()
);

alter table public.generic_form_submissions enable row level security;

-- Agents can read submissions that belong to their forms
create policy "agents_read_own_form_submissions"
  on public.generic_form_submissions
  for select
  using (
    exists (
      select 1 from public.generic_forms gf
      where gf.id = form_id
        and gf.agent_id = auth.uid()
    )
  );

-- Public (unauthenticated) can insert submissions
create policy "public_insert_form_submissions"
  on public.generic_form_submissions
  for insert
  with check (true);

-- Index for fast submission count queries
create index if not exists generic_form_submissions_form_id_idx
  on public.generic_form_submissions (form_id);

-- Index for agent lookup on forms
create index if not exists generic_forms_agent_id_idx
  on public.generic_forms (agent_id);
