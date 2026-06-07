# Choices Module — Certification (product-architect, 6 lenses)

**Status:** DOCUMENTED · **Updated:** 2026-06-07 · **Source:** 10-component agent certification + 40-decision Wave 3-4 fix specs.
**Bottom line:** the flow is **structurally certified + FCA-defensible; its numbers are NOT yet certified** (34/40 decisions gated on the golden-vector calc-audit).

## Certification table
| Component | Verdict | Gate |
|---|---|---|
| content-fca (decision-content + commit-content) | **PASS** | — clean: 0 £/% literals, 0 advice phrasing, 0 product names, regulated decisions route to adviser |
| station-options | CONDITIONAL | F6: DE-09 value default £450k literal, not bound to entity |
| station-priorities | CONDITIONAL | F3 labels disagreed (FIXED) · F6 ranks on riskMap proxy not delta (G-7, gated) |
| station-answer | CONDITIONAL | F5 provenance one station away · empty-state vanished (FIXED) |
| station-commit | CONDITIONAL | mislabel/heuristic figures persisted to Timeline |
| station-identify-context | CONDITIONAL | F6: Context sliders inert (never read by ranking) |
| property-model (DE-09) | CONDITIONAL | F6: £450k + rent=value×5% never read entity |
| engine-methodology | CONDITIONAL | F2 DE-40 named providers (FIXED) |
| engine-simulate | CONDITIONAL | F5 3 copy⟂math pension-estate reversals (FIXED) |
| DecisionCharts | CONDITIONAL | duplicate formatter; tie-out not structurally guaranteed |

**Failure axis:** F6 (real-data binding) dominates — 5/10. F1/F4 pass everywhere.

## Certified-good (do NOT re-touch)
G-1 methodology map · self-contained _gbp/_pc crash-fix · DE-03/DE-06 already clean (use _marginalRate, post-2027 IHT zeroed) · DE-28 chartKey IHT · DE-27/28 product strips · DecisionCharts £0-income "None"/IHT-direction/labels · _annualIncome multi-shape aggregation · DE-09 single-source property model tie-out.

## Applied this session (safe — display/copy/label only)
- **F2 compliance:** DE-40 "Bupa, Legal & General" → "a specialist provider".
- **F5 copy⟂math (4 reversed pension-estate claims):** DE-04, DE-32, DE-33, and the pension_wrap path detail — all said pensions are "IHT-free from April 2027"; the enacted rule is the REVERSE (pensions ENTER the estate). Maths already correct (ihtDelta=0); copy now matches.
- **F3 label unify:** WEIGHTS_LABEL.legacy "Inheritance" → "Estate (inheritance)" (matches wheel "Estate").
- **station-answer empty-state:** fallback copy for approach-only decisions (wills/POA) so the factor tile never silently vanishes.
- **G-6 key:** DE-31 'Savings drawn' (maths cert-confirmed fine; nwDelta is a drawdown, must not read "Net worth").

## Remaining — CONDITIONAL gaps (front-end, ungated)
- DE-09/property: bind value+rent to `entity` holdings where present (BM-1 first-preference; "estimate" label is only the escape hatch).
- Context sliders (holdYears/targetIncome/appetite): wire to ranking or soften the copy (BM-11 inert lever).
- station-answer: surface the per-decision methodology receipt on the verdict (drillability).
- DecisionCharts: import one shared formatter (kill the byte-identical duplicate before it drifts); value-test "None" on both bar+card; clamp income both sides.
- Priorities: re-evaluate "✓ chosen" when weights change the top option.
- Remove dead code: DisabledDecisionStub (always-0 gate), PROPERTY_PATHS static .impact blocks (overwritten at runtime).

## Remaining — CALC-AUDIT-GATED (34/40, newMaths — CANNOT ship on build-green)
- **BM-7 income-tax modelling:** DE-01,02,05,08,11,24,25,26,27,33,36,37,38.
- **BM-4 IHT sign/mechanism:** DE-15 (CLT entry charge), DE-29 (rate-band cut not lifetime gift), DE-34 (per-path differentiator), DE-35 (BPR-loss on all sale paths).
- **BM-2 literals→estimated:** DE-07,09,10,12,13,14,39,40 (+ 0.15-on-NW proxy in DE-07/09/39).
- **BM-1 proxies/levers:** DE-16 (trust charges + lever), DE-30 (school-fee growth + lever).
- **BM-3 wrong bucket:** DE-17 (identical IHT), DE-18 (cost-avoid as NW), DE-19/20/21 (premium proxies; DE-21 claim-quality axis).
- **BM-2 ISA-shelter fudge:** DE-22, DE-23 (drop ×1.1).
- **G-7 ranking direction:** 39/40 rank on riskMap proxy — depends on trustworthy deltas, i.e. on the calc-audit.

**Gate:** each needs an accountant golden vector. Build-green + tests + verbatim-grep — the trio that already shipped real £-errors — does not clear this. Correct claim until then: *"built, routed, labelled, compliant; numbers not yet certified."*
