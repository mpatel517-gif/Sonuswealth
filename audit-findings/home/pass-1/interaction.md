---
Title: Home Screen — Interaction Audit (A2/A3/A4) — Stage B Pass-1
Version: pass-1-stage-b
Date: 2026-05-18
Auditors: A2 (handler exists), A3 (destination correct), A4 (destination coherent)
Screen: HomeScreen.jsx v2.1
---

## Method

For every interactive or data-bearing element: trace the actual code handler (onClick, onKeyDown, route resolution). Test:
- A2: real handler exists and fires
- A3: routes to the surface that OWNS the subject (FD-CROSS-1 principle)
- A4: landing is SOURCE / ACTION / DECISION — not a describe-only dead end

Routing vocabulary: `onNav(screen)` where screen ∈ { 'money', 'tax', 'risk', 'flow', 'timeline', 'de' }

---

## Critical routing map: ACTION_ROUTE_OVERRIDE (L112–125)

The build maintains a UI-level routing override because the engine's `calcAPQ()` mis-routes several actions:

```js
const ACTION_ROUTE_OVERRIDE = {
  'cgt-bedisa':            'tax',     // CORRECT
  'life-in-trust':         'tax',     // CORRECT (estate action)
  'nominations':           'tax',     // CORRECT (estate action)
  'fallback-iht':          'tax',     // CORRECT
  'pension-drawdown':      'tax',     // *** FAIL — should be 'money' ***
  'pension-contributions': 'money',   // CORRECT
  'income-protection':     'risk',    // CORRECT
  'will-update':           'tax',     // CORRECT
  'sipp-nominations':      'tax',     // CORRECT (estate/nominations)
  'wrapper-sequencing':    'tax',     // CORRECT (IHT/estate wrapper)
  'debt-clearance':        'money',   // CORRECT
  'isa-allowance':         'money',   // CORRECT
}
```

**CRITICAL FINDING — H-ACT-01:** `'pension-drawdown'` is mapped to `'tax'` in ACTION_ROUTE_OVERRIDE. This means the route variable `safeRoute(action)` returns `'tax'` for pension drawdown actions. **However**, the "Show me how →" button at L1658 has a SPECIAL CASE override:

```jsx
if (action.id === 'pension-drawdown') {
  onDrillMetric?.('pension-drawdown')   // opens local PensionDrawdownPanel
} else {
  onNav?.(route)
}
```

And in the APQDrillPanel (L1099–1107), the full-list panel also has:
```jsx
if (action.id === 'pension-drawdown') { onClose(); onNav?.('tax'); return }
```

**Net result:** "Show me how →" in ActionsCard correctly opens `PensionDrawdownPanel` (a local, engine-bound drawdown surface — ACTION/DECISION). But tapping the row in the APQDrillPanel full list routes to 'tax'. This is inconsistent — same action, two different routes depending on entry point.

---

## Region 3 — Anchor row drillables

| ID | Element | Handler (A2) | Destination (A3) | Coherent? (A4) | Verdict | Notes |
|----|---------|-------------|-----------------|----------------|---------|-------|
| H-ANCH-01 | Net Worth | `onDrillMetric('netWorth')` → `setLocalDrill('networth')` → `NetWorthDrillPanel` | Home-local SOURCE panel | Yes — shows composition breakdown | PASS | |
| H-ANCH-02 | Wealth Score | `onOpenBreakdown?.()` → parent Dashboard's score detail | SOURCE — full score breakdown | Depends on parent | PASS (conditional) | If Dashboard provides onOpenBreakdown; stub acceptable |
| H-ANCH-03 | Risk Score | `onDrillMetric('riskScore')` → pushed to `onDrillMetric` or stubbed | SOURCE — risk breakdown | Depends on parent | PASS (conditional) | |
| H-ANCH-03b | Gap count badge | `onDrillMetric('gaps')` → `setLocalDrill('apq')` → APQDrillPanel | SOURCE + ACTION — ranked gap list | Yes — APQ shows ranked actions | PASS | |
| H-ANCH-04 | Cost of Inaction | `onDrillMetric('coi')` → `setLocalDrill('coi')` → CoIDrillPanel | SOURCE — per-domain CoI breakdown | Yes — drills to domain rows with tab routes | PASS | |
| H-ANCH-04c | SIPP countdown | `onNav?.('tax')` | ACTION — T&E owns IHT/SIPP | Yes — Tax & Estate is the correct canonical surface | PASS | |

---

## Region 4 — Radar card dimension drills

| ID | Element | Handler (A2) | Destination (A3) | Coherent? (A4) | Verdict | Notes |
|----|---------|-------------|-----------------|----------------|---------|-------|
| H-RAD-01–07 | Each dimension node | `onDrillMetric('wealth.{dim}')` → RadarAnchor → `DimExplainerStub` via `setStubMetric(dimKey)` | DIM_EXPLAINERS[dimKey].route: behaviour→money, capital→money, tax→tax, protection→risk, cashflow→flow, debt→money, estate→tax | "Go to {TAB} →" button leads to owning tab | PASS | All 7 dimensions have correct owning routes in DIM_EXPLAINERS |
| H-RAD-08 | Gap markers | Same as dimension nodes (gap dimension tap) | Same as above | Same as above | PASS | |
| H-RAD-00 | "See all 7 dimensions" | Handled by RadarAnchor internal state | SOURCE — radar detail | Yes | PASS | |
| H-RAD-10 | Brief insight (protection review) | Routes in brief: `route: 'risk'` | ACTION — Risk tab | Yes | PASS | |

**DIM_EXPLAINERS routing table (verified):**
- `behaviour` → `money` (MyMoney) ✓
- `capital` → `money` (MyMoney) ✓
- `tax` → `tax` (Tax & Estate) ✓
- `protection` → `risk` (Risk) ✓
- `cashflow` → `flow` (Cashflow) ✓
- `debt` → `money` (MyMoney) ✓
- `estate` → `tax` (Tax & Estate) ✓

All 7 dimension drill routes are correct per FD-CROSS-1 owns-subject principle.

---

## Region 5 — Actions card ("What to do next")

| ID | Action ID | Route override | "Show me how" handler | APQDrillPanel handler | A3 correct? | A4 coherent? | Verdict |
|----|-----------|---------------|----------------------|----------------------|-------------|-------------|---------|
| H-ACT-01 | `pension-drawdown` | `ACTION_ROUTE_OVERRIDE['pension-drawdown'] = 'tax'` | **Special case: opens `PensionDrawdownPanel` (local)** | `onNav('tax')` — WRONG | ActionsCard: YES (PensionDrawdownPanel = ACTION) | ActionsCard: YES | **FAIL — INCONSISTENT** ActionsCard "Show me how" → correct local panel; APQDrillPanel row → `tax` = WRONG (should be `money`) |
| H-ACT-02 | `life-in-trust` / `income-protection` | `income-protection → 'risk'` | `onNav('risk')` | `onNav('risk')` | YES — Risk owns protection | Yes — Risk tab has protection action | PASS |
| H-ACT-03 | `pension-contributions` | `'money'` | `onNav('money')` | `onNav('money')` | YES | Yes — MyMoney owns pension contributions | PASS |
| H-ACT-04 | `isa-allowance` | `'money'` | `onNav('money')` | `onNav('money')` | YES — MyMoney owns ISA contributions | Yes | PASS |
| H-ACT-05 | `cgt-bedisa` | `'tax'` | `onNav('tax')` | `onNav('tax')` | YES — T&E owns CGT | Yes | PASS |
| H-ACT-06 | `will-update` / `nominations` | `'tax'` | `onNav('tax')` | `onNav('tax')` | YES — T&E owns will/estate | Yes | PASS |
| H-ACT-0x | "Show me how →" for all non-drawdown | `onNav(route)` | PASS | PASS | Per-row routing verified above | Per-row | PASS |
| H-ACT-SEE | "See all N →" | `onDrillMetric('apq')` → APQDrillPanel | SOURCE/ACTION — full ranked list | Yes — shows all engine actions | PASS | |

---

## DEMO-BLOCKING finding — H-ACT-01 routing inconsistency

**Finding ID:** INT-01
**Severity:** DEMO-BLOCKING
**Elements:** H-ACT-01, APQDrillPanel

**Issue:** Pension drawdown action has two different routing behaviours depending on entry point:
1. `ActionsCard` "Show me how →" → `onDrillMetric('pension-drawdown')` → `PensionDrawdownPanel` (correct — local ACTION panel)
2. `APQDrillPanel` row tap → `onNav('tax')` (incorrect — T&E does NOT own the doing for drawdown; MyMoney does per FD-CROSS-1 and MM inventory FD)

**Code location:**
- ActionsCard special case: `HomeScreen.jsx` L1658
- APQDrillPanel: `HomeScreen.jsx` L1105: `if (action.id === 'pension-drawdown') { onClose(); onNav?.('tax'); return }`

**Fix:** APQDrillPanel line should route to `'money'` (or open PensionDrawdownPanel). The 'tax' route for pension-drawdown in ACTION_ROUTE_OVERRIDE is also wrong — it should be 'money'. The special-case ActionsCard logic compensates but the underlying map is inconsistent.

---

## Region 6 — What-If section

| ID | Element | Handler (A2) | Destination (A3) | Coherent? (A4) | Verdict |
|----|---------|-------------|-----------------|----------------|---------|
| H-WI-01–05 | Scenario row (first 5) | `onClick={() => onSelectScenario(s)}` → `setIntakeScenario(s)` → `ScenarioIntake` overlay | DECISION — scenario engine (engine=true) or Ask Sonu (engine=false) | Yes — ScenarioIntake shows context + routes to `onNav('de', { query, eventId })` | PASS |
| H-WI-06 | "See all 12 →" | `setShowAll(s => !s)` — local toggle | NA — expands same list | Yes | PASS |
| H-WI-07 | Freeform + "Ask Sonu →" | `onFreeform(freeform.trim())` → `onNav('de', { query })` | DECISION — DE with query | Yes — DecisionEngine receives query | PASS |

**ScenarioIntake routing:** when user submits, calls `onNav('de', { query, eventId })`. For engine=true scenarios (retire, part_time, downsize, lump_pension, market_drop, gift), the `eventId` is set — DE can pre-match the event. For engine=false (Ask Sonu), `eventId` is null but `query` is rich. Routing is coherent.

---

## Region 7 — Plan strip

| ID | Element | Handler (A2) | Destination (A3) | Coherent? (A4) | Verdict |
|----|---------|-------------|-----------------|----------------|---------|
| H-PLAN-01 | Plan strip (no-plan state) | `onClick={() => onNav?.('timeline')}` | DECISION — Timeline owns plan creation | Yes — Timeline §E has plan builder | PASS |
| H-PLAN-02 | "Set plan →" | Same handler | Same | Same | PASS |

---

## Unlisted interactive elements

| Element | Handler | A3 correct? | Notes |
|---------|---------|-------------|-------|
| `SippIhtCountdown` | `onNav?.('tax')` | YES — T&E owns IHT/SIPP | Correct route |
| `StateTilesCard` tiles | `onNav?.(tile.route)` per tile | Per tile: FI→money, Debt→money, Protection→risk, Cashflow→flow, Estate→tax, Tax→tax | All 6 tile routes correct per FD-CROSS-1 |

---

## Summary of interaction findings

| ID | Severity | Element | Issue |
|----|----------|---------|-------|
| INT-01 | DEMO-BLOCKING | H-ACT-01 / APQDrillPanel | Pension drawdown routes to 'tax' from APQDrillPanel; should be 'money' or open PensionDrawdownPanel. ActionsCard itself is correct. |
| INT-02 | FUNCTIONAL | ACTION_ROUTE_OVERRIDE | `'pension-drawdown': 'tax'` in the map is wrong. It's compensated by the special-case in ActionsCard but is a latent bug — any new code that calls `safeRoute()` for pension-drawdown will get the wrong screen. |

Total: 1 DEMO-BLOCKING, 1 FUNCTIONAL
