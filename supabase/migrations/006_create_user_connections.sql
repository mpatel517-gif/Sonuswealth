-- Migration 006: Create finio_user_connections table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.6

CREATE TABLE finio_user_connections (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id               UUID        NOT NULL REFERENCES finio_entities(id),
  aggregator              TEXT        NOT NULL
                                      CHECK (aggregator IN (
                                        'truelayer',    -- UK launch (Q-D confirmed)
                                        'salt_edge',    -- non-UK v1.1
                                        'india_aa',     -- India AA framework (separate class)
                                        'manual'        -- soft-launch fallback
                                      )),
  connection_status       TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (connection_status IN (
                                        'active',
                                        'broken',       -- aggregator webhook error; auto-detected
                                        'revoked',      -- user-revoked
                                        'expired'       -- day-90 consent expiry
                                      )),
  jurisdiction            TEXT        NOT NULL DEFAULT 'UK',
  consent_established_at  TIMESTAMPTZ NOT NULL,
  consent_expires_at      TIMESTAMPTZ NOT NULL,  -- typically T+90 days (UK Open Banking standard)
  last_refreshed_at       TIMESTAMPTZ,            -- last successful pull from aggregator
  last_known_account_count INTEGER,               -- preserved on disconnect
  aggregator_connection_ref TEXT,                 -- aggregator's own connection/token reference
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_user_connections IS
  'Class 3 user-data connections. UK launch: TrueLayer only (Q-D/Q-J confirmed). '
  'Consent expiry at day 90 (UK Open Banking). '
  'Source: EDA spec v1.0 §4/§5.';
