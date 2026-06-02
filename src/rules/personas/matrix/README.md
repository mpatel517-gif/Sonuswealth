# Matrix personas — NOT engine-tested (thin Supabase fixtures)

**These 84 files are NOT part of the regression baseline and are NOT validated by the production engine.** Read this before assuming "84 / 60-type" coverage.

## Why

Each matrix persona uses a **thin summary schema** — `{ id, meta, financial_vectors }` — e.g.:

```json
"financial_vectors": {
  "employment": { "salary": 45000, "dividends": 500 },
  "assets": { "sipp_balance": 12000, "isa_balance": 45000, "unquoted_trading_shares": 0, "overseas_accounts": 0 },
  "liabilities": { "directors_loan_balance": 0, "s455_tax_due": 0 },
  "residency": { "uk_years": 35, "thai_ltr_visa": false }
}
```

The production engine reads a **rich entity** (`assets[]`, `liabilities`, `income`, `profile.age`, property, pensions-with-providers, protection …). `financial_vectors` has none of that structure and is too sparse to reconstruct it. Running these through `generateSnapshot()` does **not throw**, but produces **hollow snapshots** (no assets → `netWorth` undefined / zeroed metrics) — i.e. not a test.

The former `tests/harness/run-matrix-engine.mjs` "validated" these by **reimplementing the calc against Supabase** — it never imported the engine, so a green run proved nothing about production. It was deleted 2026-06-02 to stop it reading as engine coverage.

## What IS engine-tested

`npm run regression:capture` / `regression:check` run the **real engine** over the ~30 engine-schema personas in `src/rules/personas/` (main + mrT family) and `historical/`. That is the genuine regression coverage, now deterministic and committed (`tests/regression-baseline.json`).

## To grow coverage

Author additional **engine-schema** personas (full `assets`/`income`/`liabilities`/`profile`) alongside the existing ones — they're picked up by the harness automatically. Do **not** add `financial_vectors` matrix files expecting engine validation. If the archetype breadth here is wanted in the engine, these 84 need regenerating in the engine schema (a real authoring task), not adapting.

See memory: `project_regression_harness_determinism_fixed`.
