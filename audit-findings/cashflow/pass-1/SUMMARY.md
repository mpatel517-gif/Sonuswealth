# Cashflow Screen — Stage B Pass-1 Audit SUMMARY

**Date:** 2026-05-18
**Component audited:** `src/screens/Cashflow.jsx` (2,894 LOC) + `src/components/Cashflow/*`
**Inventory:** `cashflow-inventory-v1.md` (v1 · 102 rows)
**Auditor files:** conformance.md · interaction.md · reconciliation.md · domain.md · scenario.md

---

## 1. Aggregate counts (cross-auditor)

Many findings overlap across auditors (mock-fallback chain flagged by A6 + Scenario; internal codes flagged by A5 + A1). Counts below are raw per-auditor; the unique estimate is orchestrator's deduplication.

| Auditor | DEMO-BLOCKING | FUNCTIONAL | POLISH |
|---------|--------------|------------|--------|
| A1 Conformance | 0 | 12 | 1 |
| A2/A3/A4 Interaction | 4 | 26 | 5 |
| A6 Reconciliation | 5 | 9 | 1 |
| A5 Domain | 6 | 9 | 2 |
| Scenario | 6 | 12 | 3 |
| **Unique (estimated after dedup)** | **~14** | **~30** | **~6** |

Coverage: A1 = 102/102 rows (100%); A5 Domain = 97/102 rows (100% of domain-bearing rows); Scenario = 25/25 scenario rows (100%); A2/A3/A4 = 102/102; A6 = 102/102.

---

## 2. All DEMO-BLOCKING findings

| # | Element ID | One-line description | File:line |
|---|-----------|----------------------|-----------|
| DB-1 | CF-CHR-03 | "Simple view / P&L view" toggle does nothing — `accountantMode` only consumed by dead legacy waterfall, not active V2 waterfall | `Cashflow.jsx:530,638,740` |
| DB-2 | CF-POSC-02 | PoSChartV2 renders synthetic mock path (`1_000_000+i×80k+sin(i×0.6)×30k`) when `median_path`/`bands` null — no disclosure | `Cashflow.jsx:806-812`; `components/Cashflow/PoSChart.jsx:63-67` |
| DB-3 | CF-SEQ-03/04 | SequenceStressVisV2 renders `1_000_000×1.045^i` mock paths when `good_path`/`bad_path` null — no disclosure | `Cashflow.jsx:813-817`; `components/Cashflow/SequenceStressVis.jsx:35-43` |
| DB-4 | CF-EFF-01..03 | EfficientFrontierV2 renders mock frontier + fabricated `distanceToFrontier=0.012` gap when engine null | `Cashflow.jsx:848-853`; `components/Cashflow/EfficientFrontier.jsx:37` |
| DB-5 | CF-SCEN-02/03 | ScenarioMatrixV2 renders 5 hardcoded mock scenarios (drawdown £38k/£34k/£28k/£46k, PoS 94%/88%/97%/68%) when `fiveScen.scenarios` null | `Cashflow.jsx:824-828`; `components/Cashflow/ScenarioMatrix.jsx:66-73,118` |
| DB-6 | CF-POSC-01 | PoS probability fallback `\|\| 0.94` at call site — if engine null the chart shows 94% PoS with no disclosure | `Cashflow.jsx:807` |
| DB-7 | CF-SUB-01 | Sub-anchor chip renders `"methodology pending O-CF-RULES-07"` and value `"PRC – PCC"` — internal spec code + unexplained acronym at user-facing top layer | `Cashflow.jsx:938` |
| DB-8 | CF-ED-01 | `const cohortMedian = 58` hardcoded; UI reads "UK 45-54 cohort median: 58%" with no source or provenance | `Cashflow.jsx:1292` |
| DB-9 | CF-INC-01 | "Income by source" empty-state shows "Domain O source split" — internal canonical-domain code visible in user copy | `Cashflow.jsx` income empty-state region |
| DB-10 | CF-GS-01 | GoalSeek chip reads `"X24 mode 3"` — internal scenario-engine spec code at top layer | `Cashflow.jsx:2314` |
| DB-11 | CF-COI-01 | CoI odometer reads `coi.byDomain.estatePlanning \|\| coi.total` — narrows 9-domain aggregate CoI to single estate domain; violates skill §2.7 FD-CROSS-1 | `Cashflow.jsx:2392` |
| DB-12 | CF-X28-02 (SC-1) | View-mode pills (Today/Future/Plan/What if) change label only — no figure, chart, or computation re-renders for chosen horizon; decorative row presented as functional | `Cashflow.jsx:528,714` |
| DB-13 | CF-HERO-09 | "Funded ratio" in Health Hero has no counterpart in HealthScoreDrillPanel — tapping hero row has no SOURCE landing | `Cashflow.jsx` HealthScoreDrillPanel definition |
| DB-14 | CF-OVL-H-03 | HealthScoreDrillPanel labels differ from hero card (Debt manageability ≠ Debt service ratio; Funded ratio absent from drill; Sequence resilience absent from hero) — irreconcilable label sets on same surface | `Cashflow.jsx` HealthScoreDrillPanel definition |

---

## 3. Coverage line

| Auditor | Rows walked | Coverage |
|---------|-------------|---------|
| A1 Conformance | 102 / 102 | 100% |
| A5 Domain | 97 / 102 (5 pure-NAV skipped) | 100% on domain-bearing rows |
| A6 Reconciliation | 102 / 102 | 100% |
| A2/A3/A4 Interaction | 102 / 102 | 100% |
| Scenario | 25 / 25 scenario rows | 100% |

**Pass-1 is complete: all 102 inventory rows have a verdict from all five auditors.**

---

## 4. Top 3 fix priorities

### Priority 1 — Silent mock-fallback chain (DB-2, DB-3, DB-4, DB-5, DB-6)

**Root cause:** V2 chart components each have an internal synthetic-mock fallback that fires when their authoritative prop is null. Call sites pass `engineProp || null`, so any entity for which the engine returns null renders fully-dressed authoritative-looking charts driven by fabricated numbers with no disclosure. This is the highest-risk pattern in the build.

**Fix:** Add component contract — when primary data prop is null, render `<EmptyChart reason="..." />` not a synthetic series. Remove hardcoded fallback data from `ScenarioMatrix.jsx:66-73`. Change `probability || 0.94` to `probability ?? null` and gate chart render on non-null.

**Files:**
- `src/components/Cashflow/PoSChart.jsx:63-67`
- `src/components/Cashflow/SequenceStressVis.jsx:35-43`
- `src/components/Cashflow/EfficientFrontier.jsx:37`
- `src/components/Cashflow/ScenarioMatrix.jsx:66-73,118`
- `src/screens/Cashflow.jsx:807` (change `|| 0.94` to `?? null`)

---

### Priority 2 — View-mode pills decorative + windowId mismatch (DB-12, FUNCTIONAL SC-1b)

**Root cause:** `viewMode` state is set but has only one downstream gate (`viewMode === 'scenario'` for seed banner). No `useMemo` re-computes against the chosen horizon. `useState('current-tax-year')` at L528 matches no `X28TopBar.TIME_WINDOWS` id — fallback silently picks `next-period / forecast` as the default window.

**Fix:** Wire `viewMode` + `windowId` to a `horizonYears` derivation passed to all §B engine calls (`fundedRatio`, `cf_probabilityOfSuccess`, `cf_fiveCashflowScenarios`, `goalSeek`). Change initial `windowId` to `'current-period'`.

**File:** `src/screens/Cashflow.jsx:528` and all `useMemo` blocks in §B TRAJECTORY.

---

### Priority 3 — Internal codes at top layer + CoI single-domain (DB-7..DB-11)

**Root cause:** Five distinct internal spec codes visible to users (`O-CF-RULES-07`, `O-CF-RULES-09`, `O-CF-RULES-12`, `X24 mode 3`, `Domain O`). Plus CoI odometer reads only the `estatePlanning` slice of the 9-domain aggregate.

**Fix:**
- `Cashflow.jsx:938` — replace `'methodology pending O-CF-RULES-07'` with `'Calculation in progress'`
- `Cashflow.jsx:2314` — remove `X24 mode 3` chip; use `Forward planner` or no chip
- `Cashflow.jsx:2444` — remove `O-CF-RULES-12 (pending founder sign-off)` from visible text
- `Cashflow.jsx:2518,2550` — remove `O-CF-RULES-09` from visible text
- Income empty-state copy — remove `Domain O` reference
- `Cashflow.jsx:2392` — change `coi.byDomain.estatePlanning || coi.total` to `coi.total ?? 0`

---

## 5. Orchestrator notes

- **FD-CF-1 HELD:** Funded-ratio label fix (commit `533a8c0`) confirmed intact. Status derives from `fr.ratio` not `fr.confidence`. ✅
- **FD-NAME-1 HELD:** No `Caelixa` or `Finio` in user-facing JSX. Engine module comment (`// CAELIXA CASHFLOW ENGINE`) is in `cashflow-engine.js` — Wave 4 Morph sweep per FD-NAME-1. ✅
- **BRAND.disclaimer PASS:** `{BRAND.disclaimer}` at L866; rules version + data date use `BRAND.rulesVersion` / `BRAND.dataDate` from brand.js SoT. ✅
- **Dead code (S-05):** ~1,200 lines of V1 component definitions (lines ~1207–2629) never rendered. POLISH but diverge-risk. Recommend purge next cleanup pass.
- **`goalSeek` ignores `targetWindow`:** `fq-calculator.js:1766` — `targetWindow` in signature but never used. Goal-Seek time-window awareness is fiction. FUNCTIONAL.
- **Income drill entity shape:** `IncomeBreakdownDrillPanel` reads `entity.income` as flat object only — array-shaped income (CAT-03/04 entities) shows all-zero sources. Needs shape normalisation matching `cashflow-engine.js _liabArr` pattern.
