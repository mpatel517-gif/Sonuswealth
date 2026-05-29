-- ============================================================================
-- SONUSWEALTH — PHASE 2 DATA LAYER MIGRATION
-- Purpose: Move rules, macro data, personas, snapshots, audit from JSON → DB
-- Date: 2026-05-21
-- Single source of truth for engine inputs and test outputs.
-- ============================================================================

-- ============================================================================
-- 011a: RULES BUNDLES (UK-YYYY.X.Y canonical rule bundles)
-- ============================================================================

CREATE TABLE finio_rules_bundles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id           TEXT        NOT NULL,     -- e.g. 'UK-2026.1.1'
  jurisdiction        TEXT        NOT NULL DEFAULT 'UK',
  tax_year            TEXT        NOT NULL,     -- '2026/27', '2021/22'
  effective_from      DATE        NOT NULL,     -- 2026-04-06 for UK
  effective_to        DATE,                     -- NULL = open-ended (current)
  status              TEXT        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('draft', 'in_bill', 'enacted',
                                                    'scheduled', 'active',
                                                    'superseded', 'archived',
                                                    'withdrawn')),
  content             JSONB       NOT NULL,     -- full rule bundle JSON
  source_url          TEXT,
  source_doc          TEXT,                     -- HMRC manual ref, FA section, etc.
  activated_at        TIMESTAMPTZ,
  superseded_by_id    UUID        REFERENCES finio_rules_bundles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, jurisdiction)
);

CREATE INDEX idx_rules_bundles_jurisdiction_taxyear
  ON finio_rules_bundles (jurisdiction, tax_year);
CREATE INDEX idx_rules_bundles_status
  ON finio_rules_bundles (status) WHERE status = 'active';

COMMENT ON TABLE finio_rules_bundles IS
  'Canonical jurisdiction rule bundles. Engine reads active bundle for the current tax year. Historical bundles preserved for back-testing.';

-- ============================================================================
-- 011b: MACRO VARIABLES (current values, latest snapshot)
-- ============================================================================

CREATE TABLE finio_macro_variables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction        TEXT        NOT NULL DEFAULT 'UK',
  variable_key        TEXT        NOT NULL,     -- 'cpi_inflation', 'boe_base_rate', ...
  label               TEXT        NOT NULL,
  value               NUMERIC     NOT NULL,
  unit                TEXT,                     -- 'percent', 'gbp', 'years', etc.
  source              TEXT,                     -- 'ONS', 'BoE', 'HMRC', ...
  source_url          TEXT,
  effective_date      DATE        NOT NULL,
  pulled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, variable_key)
);

CREATE INDEX idx_macro_variables_key
  ON finio_macro_variables (variable_key);

COMMENT ON TABLE finio_macro_variables IS
  'Current macroeconomic variables (latest pull). One row per (jurisdiction, key). For history see finio_macro_history.';

-- ============================================================================
-- 011c: MACRO HISTORY (per-year historical macro data, 2021-2026)
-- ============================================================================

CREATE TABLE finio_macro_history (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction        TEXT        NOT NULL DEFAULT 'UK',
  tax_year            TEXT        NOT NULL,     -- '2021/22', '2025/26'
  variable_key        TEXT        NOT NULL,
  value               NUMERIC     NOT NULL,
  effective_date      DATE        NOT NULL,
  source              TEXT,
  source_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, tax_year, variable_key)
);

CREATE INDEX idx_macro_history_year_jur
  ON finio_macro_history (jurisdiction, tax_year);
CREATE INDEX idx_macro_history_key
  ON finio_macro_history (variable_key);

COMMENT ON TABLE finio_macro_history IS
  'Per-year historical macro values. Drives back-testing and 6-year persona regression. Queried by getMacroVariablesForYear().';

-- ============================================================================
-- 011d: PERSONAS (replaces JSON files in src/rules/personas/)
-- ============================================================================

CREATE TABLE finio_personas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          TEXT        NOT NULL UNIQUE, -- 'persona-a', 'CASE-001', 'single-accumulation'
  family              TEXT        NOT NULL
                                  CHECK (family IN ('main', 'matrix', 'historical', 'case')),
  name                TEXT,
  archetype           TEXT,                     -- 'single', 'couple', 'landlord', 'ltd-director', 'sole-trader', 'beneficiary'
  life_stage          TEXT
                                  CHECK (life_stage IS NULL OR life_stage IN (
                                    'foundation', 'accumulation', 'consolidation',
                                    'transition', 'preservation', 'decumulation',
                                    'legacy', 'aged-out'
                                  )),
  jurisdiction        TEXT        NOT NULL DEFAULT 'UK',
  baseline_year       TEXT        NOT NULL DEFAULT '2026/27', -- the year the profile data represents
  profile             JSONB       NOT NULL,     -- full persona JSON
  source_file         TEXT,                     -- 'src/rules/personas/persona-a.json' (provenance)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_personas_family
  ON finio_personas (family);
CREATE INDEX idx_personas_archetype
  ON finio_personas (archetype);

COMMENT ON TABLE finio_personas IS
  '7 main + 81 matrix + 7 historical + 13 case personas. Engine reads profile JSONB. Source of truth replaces src/rules/personas/*.json.';

-- ============================================================================
-- 011e: PERSONA SNAPSHOTS (engine output per persona × year)
-- ============================================================================

CREATE TABLE finio_persona_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          TEXT        NOT NULL REFERENCES finio_personas(persona_id) ON DELETE CASCADE,
  tax_year            TEXT        NOT NULL,     -- '2021/22' through '2026/27'
  engine_version      TEXT        NOT NULL,     -- 'FINIO-1.0' / commit hash
  rules_version       TEXT        NOT NULL,     -- 'UK-2026.1.1'
  snapshot_type       TEXT        NOT NULL DEFAULT 'historical'
                                  CHECK (snapshot_type IN ('historical', 'current',
                                                           'projected', 'what_if')),
  balance_sheet       JSONB,                    -- assets, liabilities, net worth
  pl                  JSONB,                    -- income, expenses, tax
  cashflow            JSONB,                    -- monthly flow, annual surplus
  risk                JSONB,                    -- 7-dim risk scores
  fq_score            INTEGER,                  -- 0-100 Sonuswealth Wealth Score
  risk_score          INTEGER,                  -- 0-100 Sonuswealth Risk Score
  net_worth           NUMERIC,
  iht_exposure        NUMERIC,
  cost_of_inaction    NUMERIC,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (persona_id, tax_year, engine_version, rules_version, snapshot_type)
);

CREATE INDEX idx_snapshots_persona_year
  ON finio_persona_snapshots (persona_id, tax_year);
CREATE INDEX idx_snapshots_type
  ON finio_persona_snapshots (snapshot_type);

COMMENT ON TABLE finio_persona_snapshots IS
  'Time-series engine output. 88 personas × 6 years = up to 528 historical snapshots. Drives demo: "how your finances changed year by year".';

-- ============================================================================
-- 011f: TEST AUDIT LOG (DeepSeek + Claude validation results)
-- ============================================================================

CREATE TABLE finio_test_audit_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID        NOT NULL,     -- groups one full regression run
  persona_id          TEXT        NOT NULL REFERENCES finio_personas(persona_id),
  tax_year            TEXT        NOT NULL,
  test_category       TEXT        NOT NULL
                                  CHECK (test_category IN ('tax', 'cashflow',
                                                           'balance_sheet',
                                                           'protection', 'estate',
                                                           'risk', 'overall')),
  status              TEXT        NOT NULL
                                  CHECK (status IN ('PASS', 'FAIL', 'WARN', 'SKIP')),
  score               INTEGER     CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  validator_provider  TEXT        NOT NULL DEFAULT 'deepseek'
                                  CHECK (validator_provider IN ('deepseek', 'claude',
                                                                'manual', 'rule_based')),
  validator_model     TEXT,                     -- 'deepseek-chat', 'claude-sonnet-4-6', etc.
  verdict             TEXT,                     -- the validator's reasoning
  engine_output       JSONB,                    -- snapshot of computed values at test time
  before_snapshot_id  UUID        REFERENCES finio_persona_snapshots(id),
  after_snapshot_id   UUID        REFERENCES finio_persona_snapshots(id),
  fix_commit          TEXT,                     -- git SHA of fix if a bug was found
  tokens_used         INTEGER,
  ran_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_run_id
  ON finio_test_audit_log (run_id);
CREATE INDEX idx_audit_persona_year
  ON finio_test_audit_log (persona_id, tax_year);
CREATE INDEX idx_audit_status
  ON finio_test_audit_log (status) WHERE status IN ('FAIL', 'WARN');

COMMENT ON TABLE finio_test_audit_log IS
  'Per-test results from DeepSeek/Claude validation. Groups into runs via run_id. Drives audit reports + admin dashboard.';

-- ============================================================================
-- 011g: RLS POLICIES (anon read for personas/snapshots; admin write only)
-- ============================================================================

ALTER TABLE finio_rules_bundles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_macro_variables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_macro_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_personas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_persona_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finio_test_audit_log      ENABLE ROW LEVEL SECURITY;

-- Anon (public) read on macro + rules + personas (test data is fine to expose)
CREATE POLICY anon_read_rules
  ON finio_rules_bundles FOR SELECT TO anon USING (true);

CREATE POLICY anon_read_macro_current
  ON finio_macro_variables FOR SELECT TO anon USING (true);

CREATE POLICY anon_read_macro_history
  ON finio_macro_history FOR SELECT TO anon USING (true);

CREATE POLICY anon_read_personas
  ON finio_personas FOR SELECT TO anon USING (true);

CREATE POLICY anon_read_snapshots
  ON finio_persona_snapshots FOR SELECT TO anon USING (true);

CREATE POLICY anon_read_audit
  ON finio_test_audit_log FOR SELECT TO anon USING (true);

-- service_role bypass is automatic. No writes from anon.

-- ============================================================================
-- 011h: ADD NEW TABLES TO TABLES CONSTANT (informational comment)
-- ============================================================================
-- src/lib/supabase.js needs these TABLES entries:
--   RULES_BUNDLES:        'finio_rules_bundles',
--   MACRO_VARIABLES:      'finio_macro_variables',
--   MACRO_HISTORY:        'finio_macro_history',
--   PERSONAS:             'finio_personas',
--   PERSONA_SNAPSHOTS:    'finio_persona_snapshots',
--   TEST_AUDIT_LOG:       'finio_test_audit_log',

-- ============================================================================
-- END OF 011 — DATA LAYER MIGRATION
-- ============================================================================
