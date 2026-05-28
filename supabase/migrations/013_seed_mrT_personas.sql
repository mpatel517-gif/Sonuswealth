-- ─────────────────────────────────────────────────────────────────────────────
-- 013_seed_mrT_personas.sql — Phase A4 (why-do-you-have-async-balloon plan)
--
-- Registers the 13 mrT-*.json on-disk fixtures into finio_personas so the
-- production harness's --all-personas / --family=mrT paths resolve them when
-- running in Supabase mode. Until now these 13 fixtures sat unused on disk;
-- only mrT-core was occasionally smoked by wave0-snap-mrt.mjs.
--
-- The 13 fixtures use the engine-test schema (nested individual.{id,name,dob})
-- not the live-UI Bruce schema. UI rendering is OUT OF SCOPE for this seed —
-- they are engine-test fixtures, not UI demos. UI persona switcher exposes
-- mrt-core only (see src/App.jsx PERSONA_LIST).
--
-- Idempotent via ON CONFLICT — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO finio_personas (persona_id, family, name, archetype, life_stage, profile)
VALUES
  ('mrT-core',          'mrT', 'Mr T Core',                    '02', 'Accumulation',
   (SELECT row_to_json(t) FROM (SELECT 'mrT-core' AS id, 'engine-test' AS source) t)::jsonb),
  ('mrT-couple',        'mrT', 'Mr T · Couple',                '38', 'Consolidation',
   '{"source":"engine-test","note":"profile body loaded from disk JSON at runtime"}'::jsonb),
  ('mrT-divorced',      'mrT', 'Mr T · Divorced',              '38', 'Consolidation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-landlord',      'mrT', 'Mr T · Landlord',              '38', 'Consolidation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-ltd-director',  'mrT', 'Mr T · Ltd Director',          '02', 'Accumulation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-sole-trader',   'mrT', 'Mr T · Sole Trader',           '02', 'Accumulation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-decum-complex', 'mrT', 'Mr T · Decum complex',         '40', 'Decumulation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-aged-out',      'mrT', 'Mr T · Aged out',              '40', 'Decumulation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-beneficiary',   'mrT', 'Mr T · Beneficiary',           '40', 'Decumulation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-cohab-sep',     'mrT', 'Mr T · Cohab separated',       '38', 'Consolidation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-family',        'mrT', 'Mr T · Family',                '38', 'Consolidation',
   '{"source":"engine-test"}'::jsonb),
  ('mrT-uk-in',         'mrT', 'Mr T · UK / India',            '38', 'Consolidation',
   '{"source":"engine-test","jurisdiction":"UK+IN","note":"cross-border NRI"}'::jsonb),
  ('mrT-uk-th',         'mrT', 'Mr T · UK / Thailand',         '38', 'Consolidation',
   '{"source":"engine-test","jurisdiction":"UK+TH","note":"cross-border LTR"}'::jsonb)
ON CONFLICT (persona_id) DO UPDATE
  SET family     = EXCLUDED.family,
      name       = EXCLUDED.name,
      archetype  = EXCLUDED.archetype,
      life_stage = EXCLUDED.life_stage,
      profile    = EXCLUDED.profile,
      updated_at = NOW();

-- Verify
DO $$
DECLARE
  mrt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mrt_count FROM finio_personas WHERE family = 'mrT';
  RAISE NOTICE 'mrT family rows after migration: %', mrt_count;
  IF mrt_count <> 13 THEN
    RAISE WARNING 'Expected 13 mrT rows, got %', mrt_count;
  END IF;
END $$;
