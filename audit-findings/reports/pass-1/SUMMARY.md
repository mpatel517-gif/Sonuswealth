# Reports Screen — Stage B Pass-1 SUMMARY
**Date:** 2026-05-18 | **Coverage:** 82.8% auditable rows (38 blocked pending Phase 2)

## Counts

| Severity | Count |
|----------|-------|
| DEMO-BLOCKING | 2 |
| FUNCTIONAL | 7 |
| POLISH | 5 |

## All DEMO-BLOCKING findings

| # | Element ID | Finding | File:line |
|---|-----------|---------|-----------|
| DB-01 | RP-FOOT-02 / RP-CHR-05 | FCA disclaimer absent — `BRAND.disclaimer` not rendered anywhere; no `BRAND` import. Screen previews 4 tax-touching report types. FD-RP-3: "Absence = DEMO-BLOCKING." | Reports.jsx (no BRAND import) |
| DB-02 | S-08 / RP-G-01 | Brand-leak gate — no Caelixa/Finio in stub today but Phase 2 PDF renderer must pull from brand.js. Becomes DEMO-BLOCKING if any Phase 2 template hardcodes "Caelixa"/"FQ Score". | Phase 2 pre-ship grep gate needed |

## Top 3 fix priorities

**P1 — Add `BRAND.disclaimer` to footer (fixes DB-01)**
`import { BRAND } from '../config/brand.js'` + render `BRAND.disclaimer` in footer. One import, one JSX element.

**P2 — Add `BRAND.rulesLabel()` strip (fixes F-01)**
Same import as P1, zero extra cost. Fulfils rules-bundle promise in intro copy.

**P3 — Remove vault promise (fixes F-04)**
Delete "Saved to your vault with a timestamp" from intro copy (~line 104). No UI surface backs this claim.

## DECISION-NEEDED
- RP-NW-10: Does Net Worth report require `BRAND.disclaimer`? FD-RP-3 marks it "borderline."
- RP-G-07: Remove vault promise sentence, or stub a past-reports empty-state list?
