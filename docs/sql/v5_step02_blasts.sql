-- v5_step02_blasts.sql
-- Group broadcast blasts — agent texts a tag group via Secretary AI command

CREATE TABLE IF NOT EXISTS blasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  message       TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ,                        -- null = immediate
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending',    -- pending | sending | sent | failed | cancelled
  recipient_count   INT DEFAULT 0,
  sent_count        INT DEFAULT 0,
  failed_count      INT DEFAULT 0,
  command       TEXT,                               -- the original natural language command
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents manage own blasts"
  ON blasts FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE INDEX IF NOT EXISTS blasts_agent_id_idx ON blasts(agent_id);
CREATE INDEX IF NOT EXISTS blasts_status_scheduled_idx ON blasts(status, scheduled_at) WHERE status = 'pending';
