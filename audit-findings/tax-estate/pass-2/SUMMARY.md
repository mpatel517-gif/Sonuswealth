# Tax & Estate — Stage B Pass-2 SUMMARY
**Date:** 2026-05-18

## DB fixes verification
| # | Finding | Status | Evidence |
|---|---------|--------|---------|
| DB-1 | £1.5m BPR chip error | FIXED | TaxEstate.jsx:1562: `50% above {fmt(allow?.individual \|\| 2500000)}` → shows "£2,500,000" |
| DB-2 | InheritanceStory CTA dead | FIXED | TaxEstate.jsx:2519: `onDrillMetric={onDrillMetric}` passed |
| DB-3 | Zero year-by-year IHT projections | DEFERRED | ihtProjection/ihtTimeline not built — known engine deferral |
| DB-4 | Cohabiting banner not tappable | FIXED | TaxEstate.jsx:1362–1374: role="button", onClick, onKeyDown |
| DB-5 | CoI odometer only estatePlanning | FIXED | TaxEstate.jsx:1587–1588: `coi?.total \|\| 0` |
| DB-6 | After-2027 tile wrong engine call | FIXED | TaxEstate.jsx:919–927: `te_ihtExposure(entity, 'UK-2026.1', { postPension: true })` |
| DB-7 | IHTWaterfall 4 silent bugs | FIXED | waterfall_components / delta_vs_baseline / iht_due property names correct throughout |
| DB-8 | NRB/RNRB ENACTED values | CONFIRMED PASS | tax-2026.json: nilRateBand:325000, rnrb:175000, ihtRate:0.40 — engine reads from JSON |

## Regressions found
None.

## New findings
- **NF-1 (COSMETIC/future):** After-2027 tile shows same object as today tile once `isPostPension===true` post-2027-04-06. Not triggered until then.
- **NF-2 (LOW):** Couple BPR allowance fallback `|| 5000000` — JSON key exists so currently fine.
- **NF-3 (UX):** DB-3 deferral has no "coming next" placeholder in Estate sub-tab. Should be labelled per §9 before demo.

## Verdict
**PASS** (with 1 deferral) — 7/8 DB findings resolved. DB-3 engine deferral confirmed. No regressions. NF-3 needs stub label before demo.
