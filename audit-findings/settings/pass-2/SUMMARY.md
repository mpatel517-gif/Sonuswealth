# Settings — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| DB-1 | Account.jsx used own score formula | FIXED | Account.jsx:5 imports calcFQ/fqBand/lifeStageFor from engine; :47–50 all called |
| DB-2 | 3× FQ / Financial Quotient strings | FIXED | All replaced: BRAND.scoreShort (L88,101), BRAND.score (L90). Zero FQ strings remain. |
| DB-3 | Settings PlanRow no onClick | FIXED | handleClick() at L93–98; onNav+onClose passed at call site |
| DB-4 | SCORING_VERSION / RISK_VERSION hardcoded | FIXED | Engine exports 'Sonuswealth-1.0' / 'Sonuswealth-Risk-1.0'; Settings.jsx imports both :615–616 |
| DB-5 | Tax year hardcoded | PARTIAL → FIXED | Settings.jsx L594 uses `TAX.taxYear ?? '2026/27'`. TAX.taxYear was undefined — fq-calculator.js now maps `TAX_JSON._meta?.taxYear ?? '2026/27'` into TAX const (fixed in pass-2) |

## Regressions found
None.

## New findings
- **NF-1 (FIXED in pass-2):** `TAX.taxYear` was never mapped from `TAX_JSON._meta.taxYear` — fallback `'2026/27'` always fired. Fixed in fq-calculator.js.
- **NF-2 (LOW):** `src/rules/tax-2026.json` L13 `_disclaimer` field says "Finio updates this file" — FD-NAME-1 violation in a source file. Not UI-visible.

## Verdict
**PASS** — All 5 DB findings resolved. TAX.taxYear now properly mapped. NF-2 minor source file naming for FUNCTIONAL backlog.
