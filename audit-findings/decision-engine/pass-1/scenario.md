---
Title: Decision Engine — Scenario Audit (Pass 1)
Version: 1.0
Date: 2026-05-18
Status: DOCUMENTED
Cluster: 10-All Clusters / Audit
File name: scenario.md
Purpose: Decision Engine IS a scenario surface. Test all 7 scenario criteria. Multi-option central — confirm distinct options render. Finance-bound and time-projected mandatory.
---

**Summary:** DE passes multi-option distinctness and finance-bound criteria (engine-validated consequences). Fails time-projection (no required horizon), user-data binding in starter-chip generated trees, and scenario-save destination. 3 DEMO-BLOCKING, 3 FUNCTIONAL.

---

## Scenario criteria applied

The 7 scenario criteria applied to Decision Engine specifically:

1. **Finance-bound** — outputs anchored to user's actual financial data (not static examples)
2. **Time-projected** — options show consequences over a horizon (e.g. "in 3 years", "at retirement")
3. **Multi-option** — distinct A/B/C/D options rendered comparably, not collapsed to one answer
4. **Comparable** — options expose same consequence dimensions for side-by-side assessment
5. **Actionable** — each option leads to canonical owning surface; not describe-only
6. **Saveable / committable** — user can save as scenario or commit to a plan
7. **FCA-compliant** — no directive recommendation, estimates labelled, brand clean

---

## C1 — Finance-bound

**Requirement:** tree consequences must use the user's actual data (pension pot, income, net worth), not generic UK average figures.

**Actual:**
- Orchestrator injects `entity` (user's financial snapshot) into the tree-generator prompt
- Engine-validated consequences are calculated from `entity` data — finance-bound by construction
- Non-validated consequences are LLM estimates: may reference user data from prompt context but not bound to calculated figures

**Verdict: PARTIAL PASS / FAIL**
- Engine-validated fields: **PASS** — finance-bound
- Non-validated fields: **FAIL — DEMO-BLOCKING** — LLM estimates may not reflect user's actual data; no runtime guard

---

## C2 — Time-projected

**Requirement:** options must show consequences over a time horizon. "Retire in 3 years" starter chip must produce a tree showing a 3-year path.

**Actual:**
- tree-generator.js JSON schema for options does not include a required `horizon` or `timeframe` field
- `tree.horizon` is referenced in the renderer (DecisionTree/index.jsx) but is optional
- Starter chip "retire in 3 years" submits query text — Claude may or may not generate time-projected options
- No assertion that every option must carry a `yearsToRealise` or equivalent field
- `tree.horizon` may be null; renderer falls back silently with no time label shown

**Verdict: FAIL — DEMO-BLOCKING** (Seed S-12)

This is a mandatory criterion for Decision Engine per FD-DE-1. The tree schema must require `horizon` or `timeframe` on each option.

---

## C3 — Multi-option distinct rendering

**Requirement:** A/B/C/D must render as distinct, comparable cards. Not collapsed to one answer.

**Actual:**
- `mainOptions.map()` renders separate `OptionCard` per option — structurally distinct
- Letter badges A/B/C/D assigned from array index
- Visual separation: individual cards with expand/collapse
- **Verdict: PASS** — distinct rendering confirmed

**But: option count not enforced:**
- If Claude returns 2 options, only 2 cards render — FD-DE-1 4-option minimum violated silently
- **Verdict: FAIL — DEMO-BLOCKING** for the count requirement (Seed S-03/S-05)

---

## C4 — Comparable

**Requirement:** options expose the same consequence dimensions so user can compare like-for-like.

**Actual:**
- Each option has its own `consequences[]` array
- No schema enforcement that all options must expose the same metric keys
- Option A might show `monthly_surplus` and `iht_waterfall`; Option B might show `protection_score` and `cashflow_health` — different dimensions
- No "consequence matrix" view that aligns metrics across options

**Verdict: FAIL — FUNCTIONAL**

Side-by-side comparability depends on LLM consistency. No structural guarantee.

---

## C5 — Actionable

**Requirement:** each option leads to canonical owning surface for "the doing." Describe-only = fail.

**Actual:**
- "Commit to this path" button present on each main option card — structural intent exists
- Commit exit routing: modal closes, no navigation to Timeline plan strip — describe-only at exit point
- "Before committing" sub-decisions: static text, no drill to child DE tree
- "Sequence" steps: action verbs present but no links to owning surfaces (e.g. pension contribution step does not link to MyMoney pension section)

**Verdict: FAIL — DEMO-BLOCKING** (Seed S-16, S-08)

The DE generates options but the "doing" surfaces are never reached.

---

## C6 — Saveable / committable

**Requirement:** user can save as scenario (Timeline) or commit to a plan (Timeline plan strip). Both exits must land on a coherent surface.

**Actual:**
- "Commit to this path": `orc.commit()` → `planId` returned → modal closes — **no Timeline navigation**
- "Save as scenario": `orc.saveScenario()` → `draftId` returned → modal closes — **no scenarios surface to land on**
- Timeline.jsx has no scenario inbox or draft list identified

**Verdict: FAIL — DEMO-BLOCKING** for commit (S-16); FAIL — FUNCTIONAL for save (no destination)

---

## C7 — FCA-compliant

**Requirement:** no directive recommendation, estimates labelled, brand clean (Sonuswealth only).

**Actual:**
- No directive "you should choose Option A" language in renderer
- RECOMMENDED pill is a neutral label, not advice
- Brand filter covers consequence text only — tree.statement, option names, rationale NOT filtered
- Confidence % badge unlabelled (user cannot distinguish estimate from calculation)
- FCA boundary footer present on all output

**Verdict: PARTIAL FAIL**
- No directive language: **PASS**
- Brand filter incomplete: **FAIL — DEMO-BLOCKING** (Seed S-14)
- Estimate labelling: **FAIL — FUNCTIONAL**
- FCA footer: **PASS**

---

## Scenario surface self-assessment

| Criterion | Verdict | Severity |
|-----------|---------|----------|
| C1 Finance-bound | PARTIAL (engine-validated = PASS; non-validated = FAIL) | DEMO-BLOCKING |
| C2 Time-projected | FAIL — horizon field not required | DEMO-BLOCKING |
| C3 Multi-option distinct | PASS (rendering) / FAIL (count not enforced) | DEMO-BLOCKING |
| C4 Comparable | FAIL — no cross-option schema | FUNCTIONAL |
| C5 Actionable | FAIL — exits don't reach "doing" surfaces | DEMO-BLOCKING |
| C6 Saveable/committable | FAIL — commit: no Timeline nav; save: no destination | DEMO-BLOCKING / FUNCTIONAL |
| C7 FCA-compliant | PARTIAL — framing OK; brand filter incomplete; estimates unlabelled | DEMO-BLOCKING / FUNCTIONAL |

**DEMO-BLOCKING count: 5 criteria with at least one DEMO-BLOCKING failure**

Decision Engine does not pass as a scenario surface in its current state. The core loop — submit decision → receive 4 time-projected options → commit to plan — breaks at the exit step.
