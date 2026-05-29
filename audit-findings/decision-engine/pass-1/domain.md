---
Title: Decision Engine — Domain Audit (A5)
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: domain.md
Purpose: Domain checks — figures traceable, options financially sound, FCA framing neutral (no "option A is better"), plain English throughout, brand clean.
---

**Summary:** FCA framing is largely correct — no directive "you should" language found in rendered UI text. Core domain risk: brand drift filter covers consequence text only (not tree.statement, option names, rationale). Confidence % badge unexplained. Label formatting drops acronym casing.

---

## D1 — FCA framing: no recommendation language

**Test:** search rendered text for directive framing ("option A is better", "you should choose", "we recommend option").

**Findings:**
- "RECOMMENDED" pill on OptionCard: a data label tied to `tree.recommendation.pathId`. Does not say "this is better" in body copy — **PASS**
- `tree.recommendation.rationale` text: LLM-generated prose. FCA-rewrite content filter is applied to consequence text but the source code does not explicitly pass recommendation rationale through `fcaRewriteTree()`. Risk that rationale says "Option A gives the best outcome" — **FAIL — FUNCTIONAL**
- "Before committing" sub-decision text: static prose, no framing issue — **PASS**
- Sequence steps: action-verb bullets (e.g. "Open a SIPP", "Contact IFA") — not advice framing — **PASS**

**Verdict on FCA framing overall:** Mostly PASS at UI layer. Rationale text not filtered = risk.

---

## D2 — Brand drift (FD-NAME-1: Sonuswealth only)

**Filter location:** `fca-rewrite.js` `prohibited_patterns` array.

**What is filtered:**
- Consequence chip text (metric labels and values) passed through `fcaRewriteTree()`
- FCA boundary footer string — correct

**What is NOT filtered through brand rewrite:**
- `tree.statement` (the decision question displayed as H2)
- Option names (`option.name`)
- Option summary (`option.summary`)
- Full rationale (`option.rationale`)
- "For" / "Against" / "Risks" / "Sequence" bullet text
- `tree.recommendation.rationale`

**Risk:** LLM may output "Sonuswealth recommends…" or "your Finio score…" in any of these fields. Not caught.

**Verdict: FAIL — DEMO-BLOCKING** (Seed S-14)

FD-NAME-1 is DEMO-BLOCKING. The filter must be applied to all user-visible string fields, not just consequences.

---

## D3 — Comparison figures traceable

**Test:** for each consequence chip shown to user, can the figure be traced to an engine function or rules-uk.js?

- Engine-validated (c.engineValidated = true): figure computed by registered engine function — traceable — **PASS**
- Non-engine-validated (c.engineValidated = false): figure is LLM estimate — not directly traceable — **FAIL — DEMO-BLOCKING** (Seed S-07)

No hardcoded £ or % literals found in validator.js or OptionCard.jsx rendering code. The risk is LLM-invented figures passing through as unverified estimates, not hardcoding in code.

---

## D4 — Options financially sound

**Test:** do the options represent plausible UK financial paths? Spot-check against three starter chip scenarios.

**Scenario: "retire in 3 years"**
- Expected options: phased drawdown, full SIPP drawdown, part-time bridge, ISA-first strategy
- Tree-generator prompt instructs Claude to generate UK-appropriate options
- FCA rewrite removes product recommendations ("open a SIPP with X provider" would be filtered)
- No hardcoded nonsensical options found in source
- **Verdict: PASS** on financial plausibility (structural; cannot verify LLM output at audit time without live run)

**Scenario: "gifting to children"**
- Expected consequences include IHT implications, 7-year rule, allowances
- IHT threshold £325,000 residence nil-rate band £175,000 — from rules-uk.js (ENACTED)
- SIPP IHT ENACTED effective April 2027 — in rules-uk.js
- **Verdict: PASS** on threshold currency

**Scenario: "going part-time"**
- Expected consequences: NI contribution gaps, pension accrual, income tax band shift
- Tax thresholds from rules-uk.js (income tax, NI)
- **Verdict: PASS** structural

---

## D5 — Plain English throughout

**Test:** is jargon present in user-facing strings?

| Element | Issue | Verdict |
|---------|-------|---------|
| Header subtitle "engine-pure" | Builder jargon visible to user | FAIL — FUNCTIONAL (Seed S-01) |
| Confidence chip "67%" | No label explaining what the percentage means | FAIL — FUNCTIONAL |
| Event chip labels "iht_planning" | Lowercase slug, no acronym handling | FAIL — FUNCTIONAL (Seed S-11) |
| "UNCONSIDERED PATH" pill | Internal DE categorisation term — acceptable as product vocabulary | PASS |
| "engine ✓" badge | Technical but concise; acceptable | PASS |
| FCA boundary footer | Formal but not jargon | PASS |
| Option card "Sequence" heading | Clear enough | PASS |

---

## D6 — FCA boundary preserved in all output

**Check:**
- `fca-rewrite.js` appends canonical FCA boundary string to all tree output
- Static footer present in rendered output
- "Ask Sonnu" cross-link routes to Ask panel, not advice
- No product-specific recommendations found in renderer code
- **Verdict: PASS**

---

## D7 — Estimates labelled as estimates

**Test:** when a consequence value is not engine-validated, is it labelled as an estimate?

- `c.engineValidated = false` → ConfidenceChip renders percentage % instead of "engine ✓"
- Percentage alone is ambiguous (confidence in what?)
- No "estimate" or "~" prefix on the value itself
- **Verdict: FAIL — FUNCTIONAL** — users may read LLM-estimated figures as calculated facts

---

## Summary

| Check | Verdict | Severity |
|-------|---------|----------|
| FCA no directive framing | PASS (recommendation rationale at risk) | FUNCTIONAL |
| Brand drift filter covers all fields | FAIL | DEMO-BLOCKING |
| Comparison figures traceable | FAIL (non-registry metrics) | DEMO-BLOCKING |
| Options financially sound | PASS | — |
| Plain English — "engine-pure" jargon | FAIL | FUNCTIONAL |
| Plain English — confidence % unexplained | FAIL | FUNCTIONAL |
| Plain English — slug labels | FAIL | FUNCTIONAL |
| FCA boundary in all output | PASS | — |
| Estimates labelled as estimates | FAIL | FUNCTIONAL |
