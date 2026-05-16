-- Migration 002: Create finio_entity_relationships table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.2

CREATE TABLE finio_entity_relationships (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id     UUID        NOT NULL REFERENCES finio_entities(id),
  entity_b_id     UUID        NOT NULL REFERENCES finio_entities(id),
  relationship    TEXT        NOT NULL,   -- 'spouse', 'civil_partner', 'parent_of', etc.
  authority       TEXT        NOT NULL,   -- 'full', 'view_only', 'none'
  effective_from  DATE        NOT NULL,
  effective_to    DATE,                   -- NULL = current
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE finio_entity_relationships IS
  'Entity relationships. Extended at Part 10. Required for joint-asset voice actions '
  '(deterministic second-party approval rule).';
