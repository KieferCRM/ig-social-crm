-- Agent emails: stores synced inbound emails + sent outbound emails per agent
create table if not exists agent_emails (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid not null references agents(id) on delete cascade,
  contact_id       uuid references leads(id) on delete set null,
  direction        text not null check (direction in ('inbound', 'outbound')),
  from_address     text,
  to_address       text,
  subject          text,
  body_text        text,
  body_html        text,
  message_id       text,                         -- deduplication key
  received_at      timestamptz,
  attachments      jsonb not null default '[]',  -- [{name, size, mime_type, document_id}]
  created_at       timestamptz not null default now()
);

create index if not exists agent_emails_agent_id_idx    on agent_emails(agent_id);
create index if not exists agent_emails_contact_id_idx  on agent_emails(contact_id);
create index if not exists agent_emails_received_at_idx on agent_emails(agent_id, received_at desc);
create unique index if not exists agent_emails_dedup_idx on agent_emails(agent_id, message_id)
  where message_id is not null;

-- RLS
alter table agent_emails enable row level security;

create policy "agent_emails_own" on agent_emails
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());
