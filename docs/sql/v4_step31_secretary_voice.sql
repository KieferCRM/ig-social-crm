-- =============================================================================
-- v4_step31_secretary_voice.sql
-- Secretary Voice AI additions
-- =============================================================================
-- No new tables required for V1 of Secretary Voice.
-- Voice call state is passed via URL-encoded parameters between Twilio webhooks,
-- and final call data is stored in the existing lead_interactions table.
--
-- The new fields (voice_tier, voice_name, voice_id, etc.) are stored in the
-- existing agents.settings JSONB column under the receptionist_settings key.
-- No schema migration is needed for those.
--
-- This file documents the recommended index addition and the voice_tier
-- values you may want to enforce at the application layer.
-- =============================================================================

-- Optional: add an index on lead_interactions for faster voice call lookups
-- (already covered by the existing index on (agent_id, lead_id, created_at),
--  but this helps when looking up by provider_call_id / CallSid)
CREATE INDEX IF NOT EXISTS idx_lead_interactions_provider_call_id
  ON lead_interactions (provider_call_id)
  WHERE provider_call_id IS NOT NULL;

-- Optional: add a dedicated channel value for ElevenLabs streaming mode calls
-- The existing channel column already supports 'voice' per the V1 schema.
-- If you need to distinguish TTS+Gather vs. Streaming calls:
--   ALTER TYPE interaction_channel ADD VALUE IF NOT EXISTS 'voice_streaming';
-- (Only run if using a Postgres ENUM for channel — if it's a plain text column, skip)

-- =============================================================================
-- Voice Tier Values (stored in agents.settings->receptionist_settings->voice_tier)
-- =============================================================================
-- "none"   — Core CRM only. No Secretary features.
-- "sms"    — Secretary SMS: missed-call textback, inbound SMS handling.
-- "voice"  — Secretary Voice: all SMS features + AI voice call answering.
--
-- To grant an agent Secretary Voice access, run:
--   UPDATE agents
--   SET settings = jsonb_set(
--     COALESCE(settings, '{}'),
--     '{receptionist_settings, voice_tier}',
--     '"voice"'
--   )
--   WHERE id = '<AGENT_UUID>';
--
-- To check which agents have voice enabled:
--   SELECT id, full_name,
--     settings->'receptionist_settings'->>'voice_tier' AS voice_tier
--   FROM agents
--   WHERE settings->'receptionist_settings'->>'voice_tier' = 'voice';

-- =============================================================================
-- Twilio Webhook Configuration (not a SQL task, but documented here)
-- =============================================================================
-- On the Twilio phone number for each agent:
--
-- A Call Comes In (Voice Webhook):
--   POST https://YOUR_DOMAIN/api/receptionist/voice/inbound?agent_id=AGENT_UUID
--
-- Call Status Callback:
--   POST https://YOUR_DOMAIN/api/receptionist/voice/status?agent_id=AGENT_UUID
--
-- SMS Webhook (existing — no change):
--   POST https://YOUR_DOMAIN/api/receptionist/webhook
--   (with body: agent_id=AGENT_UUID or via INTAKE_AGENT_ID env var)

-- =============================================================================
-- Environment Variables Required for Secretary Voice
-- =============================================================================
-- ELEVENLABS_API_KEY     — ElevenLabs API key for TTS and Conversational AI
-- TWILIO_ACCOUNT_SID    — Twilio Account SID (already used for SMS)
-- TWILIO_AUTH_TOKEN     — Twilio Auth Token (already used for SMS)
-- RECEPTIONIST_PROVIDER — Set to "twilio" for live calls (default: "mock")
