-- Migration 007: Create finio_cma_bundle table
-- Source: 3-Engine-supabase-event-store-schema-v1_0.md §2.7

CREATE TABLE finio_cma_bundle (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction    TEXT        NOT NULL DEFAULT 'UK',
  source_key      TEXT        NOT NULL,
                              -- e.g. 'ONS_CPI', 'BOE_BANK_RATE', 'PLSA_RLS_MODERATE_SINGLE',
                              --       'HMRC_IHT_RECEIPTS', 'OBR_GDP_GROWTH'
  metric_key      TEXT        NOT NULL,  -- e.g. 'cpi_rate', 'bank_rate', 'rls_moderate_single_annual'
  value           JSONB       NOT NULL,  -- numeric, string, or object
  unit            TEXT,                  -- 'GBP', 'pct', 'index'
  reference_date  DATE        NOT NULL,  -- date the figure relates to (not the fetch date)
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_url      TEXT,                  -- original publication URL for X22 breadcrumb
  confidence      TEXT        NOT NULL DEFAULT 'high'
                              CHECK (confidence IN ('high', 'medium', 'low')),
  licence         TEXT,                  -- 'OGL', 'commercial_restricted', 'commercial_free'
  is_current      BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (jurisdiction, metric_key, reference_date)
);

COMMENT ON TABLE finio_cma_bundle IS
  'Class 2 context data. One row per metric per reference_date. '
  'is_current = true marks the figure used by the engine. Prior rows retained for history. '
  'Source: EDA spec v1.0 §3/§3.4.';
