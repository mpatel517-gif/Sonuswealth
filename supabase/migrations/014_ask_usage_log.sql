-- ============================================================================
-- SONUSWEALTH — L1-1 ASK USAGE LOG
-- Date: 2026-05-28
-- Migration: 014_ask_usage_log
--
-- Created by L1-1 (Anthropic key removal + proxy). The ask-sonu-proxy Edge
-- Function logs per-call usage here so the founder can:
--   1. Track Anthropic spend per user
--   2. Detect anomalous usage (bot hitting the proxy, runaway loop)
--   3. Audit which users actually use Ask Sonu post-launch
--
-- NO MESSAGE CONTENT is stored — only counts + model + timestamp. This is a
-- privacy-preserving choice; if message content ever needs storage (e.g. for
-- training data), it must go through a separate consent flow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS finio_ask_usage_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model           text NOT NULL,
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the founder's two common queries:
--   (a) "what's user X's monthly Ask spend"  → (user_id, created_at)
--   (b) "what's total daily spend by model"  → (model, created_at)
CREATE INDEX IF NOT EXISTS idx_ask_usage_user_ts ON finio_ask_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_usage_model_ts ON finio_ask_usage_log (model, created_at DESC);

-- RLS: users see only their own rows. Service role bypasses (the Edge Function
-- writes as service role; admin queries via service-role-key too).
ALTER TABLE finio_ask_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_usage"
  ON finio_ask_usage_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated users — the proxy writes
-- as service role, and users should not be able to manufacture usage rows.

COMMENT ON TABLE finio_ask_usage_log IS
  'Per-call usage log for ask-sonu-proxy. Stores token counts only, never message content.';
