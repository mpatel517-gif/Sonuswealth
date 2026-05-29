-- ============================================================================
-- SONUSWEALTH — L3-5 EXTERNALISED CONTENT TABLE
-- Date: 2026-05-28
-- Migration: 015_finio_content
--
-- Created by L3-5 (Phase-2 content refresh). The companion Edge Function
-- `content-pull` reads from this table and returns the active bundle.
-- The client (src/hooks/useContent.js) overlays this data on top of the
-- bundled static src/content/uk-en.json so that:
--
--   * Static keys load instantly at page paint (no network blocking)
--   * Live keys override on next paint, refreshed nightly via cron
--   * If the network is down or the function 500s, the static bundle is
--     the source of truth — copy never disappears
--
-- WHY THIS EXISTS (founder pushback): "how can we update the app with
-- new content without a deploy?". Edit a row here → users see new copy
-- by tomorrow's refresh (or immediately if they refresh the page after
-- the cron runs). No code deploy needed.
--
-- WHAT THIS IS NOT FOR:
--   * Legal text (T&Cs, privacy policy) — those are markdown files under
--     content control in the repo, NEVER editable via this table.
--   * The FCA disclaimer — canonical source is BRAND.disclaimer.
--   * Tax rates / monetary thresholds — those live in src/rules/*.json
--     under the rules-bundle versioning scheme, NEVER as free text.
--
-- A compromise of this table can change marketing copy, empty-state
-- microcopy, and onboarding wording. It CANNOT change legal posture or
-- numerical engine outputs. That's the deliberate blast-radius boundary.
-- ============================================================================

CREATE TABLE IF NOT EXISTS finio_content (
  -- key: dot-path matching src/content/uk-en.json ("home.heroEyebrow")
  key            text        NOT NULL,
  -- locale: 'uk-en' is the only locale today; reserved for future expansion.
  locale         text        NOT NULL DEFAULT 'uk-en',
  -- value: the user-facing string. Limit 4kB per row — copy, not long-form.
  value          text        NOT NULL CHECK (char_length(value) <= 4096),
  -- version: monotonic per (key, locale). Lets the client detect drift.
  version        integer     NOT NULL DEFAULT 1,
  -- active: lets the founder soft-disable a key without deleting the row.
  active         boolean     NOT NULL DEFAULT true,
  -- editor: who last touched this row (service-role or human via SQL editor).
  edited_by      text,
  edited_note    text,
  -- timestamps
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (key, locale)
);

-- Indexes for the two read patterns:
--   (a) "give me every active key for locale X" → (locale, active)
--   (b) "what's the latest version of key Y"     → (key) for direct lookup
CREATE INDEX IF NOT EXISTS idx_finio_content_locale_active
  ON finio_content (locale, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_finio_content_updated
  ON finio_content (updated_at DESC);

-- Auto-bump updated_at + version on UPDATE.
CREATE OR REPLACE FUNCTION _finio_content_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  -- Only bump version when value actually changes — saves churn on flag-only
  -- edits (active toggle, edited_note refresh).
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finio_content_touch ON finio_content;
CREATE TRIGGER finio_content_touch
  BEFORE UPDATE ON finio_content
  FOR EACH ROW EXECUTE FUNCTION _finio_content_touch();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Public read of ACTIVE rows. Anyone hitting the Edge Function gets the
-- bundle. Writes are service-role only — the founder edits via the Supabase
-- dashboard (which runs as service role) or via a future admin UI.
ALTER TABLE finio_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_active_content"
  ON finio_content
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated. Service role
-- bypasses RLS entirely, so the dashboard + Edge Function admin path
-- both work as-is.

COMMENT ON TABLE finio_content IS
  'L3-5 externalised user-facing copy. Live override of src/content/uk-en.json. NEVER for legal text, tax rates, or engine outputs.';

-- ─── SEED: bootstrap with the Phase-1 keys so the table is not empty ────────
-- These mirror src/content/uk-en.json verbatim — editing here = live override.
-- If a row is deleted, the client falls back to the static bundle.
INSERT INTO finio_content (key, locale, value, edited_by, edited_note) VALUES
  ('common.fcaFooter',           'uk-en', 'Information only · Derived from your data · Not regulated advice',                                                                          'seed-015', 'Bootstrap from src/content/uk-en.json'),
  ('common.comingSoon',          'uk-en', 'Coming next',                                                                                                                                'seed-015', 'Bootstrap'),
  ('common.dataPending',         'uk-en', 'data pending',                                                                                                                               'seed-015', 'Bootstrap'),
  ('common.emptyGeneric',        'uk-en', 'No data yet — add details to populate this view.',                                                                                           'seed-015', 'Bootstrap'),
  ('common.loading',             'uk-en', 'Loading your figures…',                                                                                                                       'seed-015', 'Bootstrap'),
  ('common.errorFallback',       'uk-en', 'Something went wrong loading this view. Refresh to try again.',                                                                              'seed-015', 'Bootstrap'),

  ('home.heroEyebrow',           'uk-en', 'Your wealth, today',                                                                                                                          'seed-015', 'Bootstrap'),
  ('home.heroAddIncomeCta',      'uk-en', 'Add an income source',                                                                                                                        'seed-015', 'Bootstrap'),
  ('home.emptyState',            'uk-en', 'Add a salary, savings or property to see your full picture.',                                                                                'seed-015', 'Bootstrap'),

  ('money.balanceSheetTitle',    'uk-en', 'What you own and owe',                                                                                                                        'seed-015', 'Bootstrap'),
  ('money.balanceSheetEyebrow',  'uk-en', 'Balance sheet · today',                                                                                                                       'seed-015', 'Bootstrap'),
  ('money.emptyAssets',          'uk-en', 'Add an asset to start your balance sheet — a salary or savings account works.',                                                              'seed-015', 'Bootstrap'),
  ('money.emptyLiabilities',     'uk-en', 'No debts on file. Add a mortgage or loan if you have one.',                                                                                  'seed-015', 'Bootstrap'),
  ('money.businessEmpty',        'uk-en', 'No business interests on file. Add a director shareholding to see retained-profit, dividend and BPR analysis.',                              'seed-015', 'Bootstrap'),
  ('money.trustsEmpty',          'uk-en', 'No trusts on file. Add a settlor or beneficiary role to see IHT positioning.',                                                                'seed-015', 'Bootstrap'),
  ('money.protectionEmpty',      'uk-en', 'No protection cover on file. Life, critical illness and income protection sit here once added.',                                              'seed-015', 'Bootstrap'),

  ('cashflow.heroEyebrow',       'uk-en', 'This year''s flow',                                                                                                                            'seed-015', 'Bootstrap'),
  ('cashflow.deficitHeadline',   'uk-en', 'Spending currently exceeds income.',                                                                                                          'seed-015', 'Bootstrap'),
  ('cashflow.emptyState',        'uk-en', 'Add income and essentials to see your cashflow story.',                                                                                       'seed-015', 'Bootstrap'),
  ('cashflow.noBillsState',      'uk-en', 'No bills detected yet. Bill calendar populates once you add fixed bills (+ Bill) or connect Open Banking.',                                   'seed-015', 'Bootstrap'),
  ('cashflow.noSubsState',       'uk-en', 'Recurring-charge detection arrives with Open Banking (Phase 1.2). Until then, add subscriptions manually so they appear in your essentials total.', 'seed-015', 'Bootstrap'),

  ('tax.heroEyebrow',            'uk-en', 'Tax & estate',                                                                                                                                'seed-015', 'Bootstrap'),
  ('tax.noTaxData',              'uk-en', 'Add income and assets to see your tax position.',                                                                                             'seed-015', 'Bootstrap'),
  ('tax.noEstateData',           'uk-en', 'Add property and pension to see your IHT exposure.',                                                                                          'seed-015', 'Bootstrap'),
  ('tax.ihtProjectionNote',      'uk-en', 'Projections use frozen nil-rate bands and current rules. Budget changes update overnight.',                                                   'seed-015', 'Bootstrap'),

  ('risk.heroEyebrow',           'uk-en', 'Risk dimensions',                                                                                                                             'seed-015', 'Bootstrap'),
  ('risk.noRiskData',            'uk-en', 'Add at least one investment or pension to see your risk profile.',                                                                            'seed-015', 'Bootstrap'),
  ('risk.concentrationLabel',    'uk-en', 'Concentration',                                                                                                                               'seed-015', 'Bootstrap'),

  ('timeline.heroEyebrow',       'uk-en', 'What''s next',                                                                                                                                  'seed-015', 'Bootstrap'),
  ('timeline.noEvents',          'uk-en', 'No scheduled tax or pension events for the next 12 months.',                                                                                  'seed-015', 'Bootstrap'),

  ('ask.placeholder',            'uk-en', 'Ask Sonu about your money…',                                                                                                                  'seed-015', 'Bootstrap'),
  ('ask.disclaimer',             'uk-en', 'Sonu is information-only and never makes regulated recommendations. Verify decisions with a qualified UK financial adviser.',                  'seed-015', 'Bootstrap'),
  ('ask.emptyState',             'uk-en', 'Start a conversation — ask about ISAs, pensions, IHT, drawdown rates, or anything in your dashboard.',                                         'seed-015', 'Bootstrap'),

  ('onboarding.welcomeTitle',    'uk-en', 'Welcome',                                                                                                                                     'seed-015', 'Bootstrap'),
  ('onboarding.welcomeSub',      'uk-en', 'We''ll walk through your money in 4 steps. Skip anything you don''t have yet — you can add it later.',                                          'seed-015', 'Bootstrap'),
  ('onboarding.savedHint',       'uk-en', 'Saved — pick up where you left off any time.',                                                                                                'seed-015', 'Bootstrap'),
  ('onboarding.completionHeadline','uk-en','You''re set. Open your dashboard.',                                                                                                            'seed-015', 'Bootstrap'),
  ('onboarding.incompleteHint',  'uk-en', 'We''ve saved what you entered. Come back any time to finish.',                                                                                 'seed-015', 'Bootstrap'),

  ('legal.fcaBoundary',          'uk-en', 'Sonuswealth provides information and guidance, not regulated financial advice. We don''t recommend specific products, brokers, or platforms.',     'seed-015', 'Bootstrap'),
  ('legal.privacyShort',         'uk-en', 'We store your figures so we can show them back to you — nothing is sold or shared. Read the full privacy policy.',                            'seed-015', 'Bootstrap')
ON CONFLICT (key, locale) DO NOTHING;
