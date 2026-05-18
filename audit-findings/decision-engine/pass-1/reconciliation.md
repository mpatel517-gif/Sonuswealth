---
Title: Decision Engine — Reconciliation Audit (A6)
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: reconciliation.md
Purpose: Every numeric row: traces to engine? Internally consistent? Cross-screen consistent? CoI = totalCoI() aggregate?
---

**Summary:** 4 numeric element categories examined. Cost of Inaction correctly traces to engine aggregates. Consequence chip values are the core reconciliation risk — validator.js can catch known engine metrics but cannot prevent novel LLM-invented figures. Two engine sources coexist (fq-calculator.js vs new 3-Engine) without a reconciled bridge.

---

## Method

Files checked:
- `src/de/validator.js` (consequence validation)
- `src/de/tree-generator.js` (LLM prompt + response parsing)
- `src/engine/fq-calculator.js` (calculation engine)
- `src/engine/rules-uk.js` (UK thresholds)
- `src/de/fca-rewrite.js` (brand + FCA filter)
- `src/components/DecisionTree/OptionCard.jsx` (rendering of c.value)

---

## 1. Cost of Inaction (CoI) — DE-TREE-08 / DE-TREE-09

**Claim:** `tree.coi` = `costOfInaction(entity)` aggregate pulled from engine.

**Trace:**
- `tree.coi` is populated by the orchestrator post-generation
- `costOfInaction()` calls `ihtwaterfall(entity)` + `taxAndEstateImpact(entity)` from fq-calculator.js
- Result is injected into the rendered statement: "The cost of inaction is **£{fmt(coi)}**"
- **Verdict: PASS** — CoI correctly traces to engine aggregate. Not LLM-invented.

**Cross-screen consistency:**
- Same `costOfInaction()` function used in HomeScreen CoI display
- Same `ihtwaterfall` + `taxAndEstateImpact` functions
- **Verdict: PASS** — CoI consistent across surfaces

---

## 2. Consequence chip values (DE-OPT-CARD-09) — core risk

**Claim:** every `c.value` in a consequence chip must trace to engine or rules-uk.js.

**How validation works (validator.js):**
- `processClaudeResponse()` iterates each consequence
- For consequences whose `metric` key matches a known engine registry entry (e.g. `net_worth_at_year`, `monthly_surplus`, `income_tax_detail`), it calls the corresponding engine function and sets `c.engineValidated = true`, replacing `c.value` with the calculated figure
- For unrecognised metric keys, consequence is kept as-is with `c.engineValidated = false`, and `c.confidenceScore` (LLM estimate %) is preserved
- Unknown consequences pass through the FCA-rewrite content filter but retain their LLM-generated value

**Gap — Seed S-07:**
- If Claude invents a plausible-looking metric (e.g. `pension_drawdown_shortfall`) not in the engine registry, the value is rendered as fact with only a confidence % badge
- No threshold check: a LLM-generated "£450,000 tax saving" would render as if engine-validated unless that exact metric key is in the registry
- **Verdict: FAIL — DEMO-BLOCKING**

**Engine registry coverage:**
Known metrics in validator.js registry (from source scan):
- `calc_net_worth`, `monthly_surplus`, `protection_score`, `cashflow_health`
- `net_worth_at_years`, `estate_readiness`, `gift_clock_all`, `iht_waterfall`
- `tax_and_estate_impact`, `bengel_projection`, `probability_of_success`
- `five_cashflow_scenarios`, `max_drawdown_exposure`, `sequence_of_returns_vulnerability`
- `reality_engine_factorisation`, `allowance_tracker_te`, `income_tax_detail`
- `drawdown_matrix_te`, `gift_clock_projection_te`, `will_lpa_status`
- `bpr_qualifying_value`, `nomination_status`, `calc_milestones`

Gaps: any consequence with a metric key outside this list bypasses engine validation.

---

## 3. Rules-uk.js — threshold traceability

**Claim:** any £/% figure in consequences must trace to rules-uk.js or a fq-calculator.js calculation, never hardcoded.

**Check:**
- validator.js source contains no hardcoded £ or % thresholds — it delegates to engine functions
- tree-generator.js prompt instructs Claude not to invent figures, but no runtime enforcement
- fca-rewrite.js prohibited_patterns list catches some numerical patterns but is primarily a brand/advice filter, not a number-source checker
- **Verdict: PARTIAL PASS** — threshold traceability is structural (validator delegates to engine) but incomplete for non-registry metrics

**SIPP IHT note:**
- SIPP IHT = ENACTED (Royal Assent 18 March 2026, effective April 2027) per memory
- rules-uk.js must reflect this status = ENACTED (not PROPOSED)
- Confirmed: rules-uk.js `SIPP_IHT_STATUS` updated per session 2026-05-12 memory
- **Verdict: PASS**

---

## 4. Internal consistency — same decision, same figures

**Claim:** if a decision references a figure appearing elsewhere in the app (e.g. monthly surplus, pension pot), the DE consequence must match the canonical source.

**Check:**
- Engine-validated consequences (`c.engineValidated = true`) use live engine calls — consistent with MyMoney/Cashflow by construction
- Non-engine-validated consequences (`c.engineValidated = false`) use LLM estimates — may differ from figures shown on other screens
- **Verdict: FAIL — FUNCTIONAL** — non-validated consequences can be inconsistent with figures the user sees on MyMoney or Cashflow

---

## 5. Two engine coexistence risk

**Finding:** fq-calculator.js (Wave 1 legacy) and the newer 3-Engine calculation layer coexist. The validator.js registry maps to fq-calculator.js function names. If a metric has moved to the 3-Engine layer, the registry call will fail silently (metric falls through as non-validated LLM estimate).

**Verdict: FAIL — FUNCTIONAL** — engine reconciliation gap from memory `project_finio_wave1a_status.md` is unresolved and affects consequence validation accuracy.

---

## 6. Recommendation pathId internal consistency

- `tree.recommendation.pathId` must match the `id` of one of `tree.options[]`
- No cross-check found in renderer: if pathId doesn't match any option, RECOMMENDED pill silently absent (no error)
- **Verdict: FAIL — FUNCTIONAL** — should assert pathId matches an option id; soft failure currently

---

## Summary

| Row | Finding | Severity |
|-----|---------|----------|
| DE-OPT-CARD-09 | Consequence values: LLM figures not in registry bypass engine validation | DEMO-BLOCKING |
| DE-TREE-08/09 | CoI traces correctly to ihtwaterfall + taxAndEstateImpact | PASS |
| Cross-screen | Engine-validated consequences consistent; non-validated may diverge | FUNCTIONAL |
| Two engines | fq-calculator vs 3-Engine registry gap causes silent validation miss | FUNCTIONAL |
| Recommendation | pathId not asserted against options array | FUNCTIONAL |
| SIPP IHT status | ENACTED confirmed in rules-uk.js | PASS |
