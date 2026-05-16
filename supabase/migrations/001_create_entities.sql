-- Migration 001: Create finio_entities table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.1

CREATE TABLE finio_entities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT        NOT NULL
                              CHECK (entity_type IN (
                                'individual',
                                'couple_member',
                                'minor',
                                'company',
                                'trust',
                                'pension_scheme',
                                'ifa_practice',
                                'employer'
                              )),
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_entities IS
  'Minimal entity table. Extended at Part 10 session with: display_name, date_of_birth, '
  'life_stage, onboarding_archetype, settings_refs, consent flags, soft-delete columns.';
