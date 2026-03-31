-- =============================================================================
-- v5_step07_intake_links.sql
-- Shareable intake link registry
--
-- Agents create named links (e.g. "Open House – 123 Main St") that generate
-- a unique slug and QR code. Each link routes to a buyer, seller, or contact
-- form and tags submissions with the link's source_label for CRM attribution.
-- =============================================================================

begin;

create table if not exists public.intake_links (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null,
  slug            text not null unique,
  name            text not null,                       -- display name, e.g. "Open House – 123 Main"
  form_type       text not null,                       -- "buyer" | "seller" | "contact"
  headline        text,                                -- optional override shown at top of form
  source_label    text not null,                       -- written to leads.source on submission
  submission_count int not null default 0,
  created_at      timestamptz not null default now()
);

-- Lookup by slug (public form page)
create index if not exists intake_links_slug_idx
  on public.intake_links (slug);

-- Agent's own links
create index if not exists intake_links_agent_id_idx
  on public.intake_links (agent_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.intake_links enable row level security;

-- Agents can read and manage their own links
create policy "agent_read_intake_links"
  on public.intake_links for select
  using (agent_id = auth.uid());

create policy "agent_insert_intake_links"
  on public.intake_links for insert
  with check (agent_id = auth.uid());

create policy "agent_update_intake_links"
  on public.intake_links for update
  using (agent_id = auth.uid());

create policy "agent_delete_intake_links"
  on public.intake_links for delete
  using (agent_id = auth.uid());

-- Public form page needs to read any link by slug (anon)
create policy "anon_read_intake_links"
  on public.intake_links for select
  to anon
  using (true);

-- Service role bypasses RLS — no extra policy needed

-- ── Helper function ───────────────────────────────────────────────────────────

-- Called by /api/intake when a form is submitted via a /l/[slug] link.
-- Runs as security definer so the anon/service role can increment the counter.
create or replace function public.increment_intake_link_count(p_slug text)
returns void
language sql
security definer
as $$
  update public.intake_links
  set submission_count = submission_count + 1
  where slug = p_slug;
$$;

commit;
