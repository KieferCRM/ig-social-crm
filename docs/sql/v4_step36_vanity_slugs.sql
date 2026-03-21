begin;

-- Vanity slug for branded form URLs (e.g. /forms/seller/jane-smith-realty)
alter table public.agents
  add column if not exists vanity_slug text;

-- Case-insensitive unique index; only enforced on rows where slug is set
create unique index if not exists idx_agents_vanity_slug_lower
  on public.agents (lower(vanity_slug))
  where vanity_slug is not null;

-- History table: when an agent changes their slug, the old one is stored here
-- so existing shared links can still redirect to the new slug.
create table if not exists public.agent_slug_history (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.agents(id) on delete cascade,
  old_slug    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_slug_history_slug
  on public.agent_slug_history (lower(old_slug));

commit;
