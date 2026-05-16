# CAELIXA CODE TRACKER
**Generated:** 1 May 2026
**Last validated:** R08 PASS · 0 failures · 33 stubs pending

---

## EXECUTIVE SUMMARY

| Phase | Status | Progress |
|-------|--------|----------|
| P2 Engine Functions | **MOSTLY DONE** | 50/65 functions |
| P2.10 Supabase Setup | **✅ COMPLETE** | 7 tables, 17 indexes, 4 views, 3 RLS |
| P3 UI Primitives | NOT STARTED | 0/3 |
| P4 Static Screens | PARTIAL | 1/9 (HomeV2 exists, needs review) |
| P5 Wire to Engine | PARTIAL | 1/7 (Home alerts wired) |
| P6 Validation | PARTIAL | R08 exists, visual-qa exists |
| P7 Demo Personas | NOT STARTED | 0/3 |
| P8 Demo Prep | NOT STARTED | 0/4 |

---

## PHASE 2 — ENGINE FUNCTIONS

### P2.1 — Foundational (fq-calculator.js)
**Status:** ✅ COMPLETE (core functions)
**File:** `src/engine/fq-calculator.js` (65KB · 38 exports)

| Function | Status | Notes |
|----------|--------|-------|
| `calcAge()` | ✅ ACTIVE | R08 validated |
| `calcStateP()` | ✅ ACTIVE | R08 validated |
| `calcNetWorth()` | ✅ ACTIVE | R08 validated |
| `calcInvestable()` | ✅ ACTIVE | R08 validated |
| `calcGuardrail()` | ✅ ACTIVE | R08 validated |
| `lifeStageFor()` | ✅ ACTIVE | R08 validated |
| `incomeTax()` | ✅ ACTIVE | R08 validated |
| `fundedRatio()` | ✅ ACTIVE | R08 validated |
| `calcFQ()` | ✅ BUILT | Main FQ scoring |
| `calcAPQ()` | ✅ BUILT | Action Priority Queue |
| `financialProfile()` | ✅ BUILT | 5x5 cross-map (D-RISK-1) |
| `ihtSippDelta()` | ✅ BUILT | CoI scalar |
| `ihtDynamic()` | ✅ BUILT | Dynamic IHT calc |
| `netWorth()` | ✅ BUILT | Simple NW |
| `investable()` | ✅ BUILT | Investable assets |
| `guardrail()` | ✅ BUILT | Guardrail calc |
| `fmt()` | ✅ BUILT | Currency formatter |
| `daysLeft()` | ✅ BUILT | Days to tax year end |
| `sippProjection()` | ✅ BUILT | SIPP projection |
| `sippProjectionSeries()` | ✅ BUILT | SIPP series |
| `drawdownTotal()` | ✅ BUILT | Drawdown totals |
| `lsaHeadroom()` | ✅ BUILT | LSA calc |
| `costOfInaction` | ✅ BUILT | Alias for backward compat |

---

### P2.2 — Cashflow Suite
**Status:** ✅ COMPLETE (9/9)
**File:** `src/engine/cashflow-engine.js` (41KB)

| Function | Status | Spec |
|----------|--------|------|
| `swrRegime()` | ✅ BUILT | CF §4 |
| `guytonKlinger()` | ✅ BUILT | CF §4 |
| `maxDrawdownExposure()` | ✅ BUILT | CF §5 |
| `sequenceOfReturnsVulnerability()` | ✅ BUILT | CF §5 |
| `probabilityOfSuccess()` | ✅ BUILT | CF §6 |
| `portfolioEfficiency()` | ✅ BUILT | CF §6 |
| `prcPccSpread()` | ✅ BUILT | CF §7 |
| `realityEngineFactorisation()` | ✅ BUILT | CF §6.2 |
| `fiveCashflowScenarios()` | ✅ BUILT | CF §6.4 |

---

### P2.3 — Tax & Estate Suite
**Status:** ✅ COMPLETE (23 functions)
**File:** `src/engine/tax-estate-engine.js` (59KB)

| Function | Status | Domain |
|----------|--------|--------|
| `taxThisYear()` | ✅ BUILT | Tax |
| `incomeTaxDetail()` | ✅ BUILT | Tax |
| `nicsDetail()` | ✅ BUILT | Tax |
| `cgtDetail()` | ✅ BUILT | Tax |
| `dividendTaxDetail()` | ✅ BUILT | Tax |
| `allowanceTracker()` | ✅ BUILT | Tax |
| `taxDrag()` | ✅ BUILT | Tax |
| `drawdownMatrix()` | ✅ BUILT | Tax |
| `ihtExposure()` | ✅ BUILT | Estate |
| `ihtWaterfall()` | ✅ BUILT | Estate |
| `giftClockProjection()` | ✅ BUILT | Estate |
| `trustPeriodicCharge()` | ✅ BUILT | Estate |
| `trustContribution()` | ✅ BUILT | Estate |
| `taxAndEstateImpact()` | ✅ BUILT | Dual-impact |
| `nominationStatus()` | ✅ BUILT | Estate |
| `beneficiaryChain()` | ✅ BUILT | Estate |
| `rnrbTaper()` | ✅ BUILT | Estate |
| `bprClock()` | ✅ BUILT | Estate |
| `bprQualifyingValue()` | ✅ BUILT | Estate |
| `selfAssessment()` | ✅ BUILT | Tax |
| `willLpaStatus()` | ✅ BUILT | Estate |
| `costOfInaction()` | ✅ BUILT | CoI structured |
| `bprAllowanceTracker()` | ✅ BUILT | v1.1 NEW |

---

### P2.4 — Risk Layer
**Status:** ✅ COMPLETE (4 functions)
**File:** `src/engine/risk-engine.js` (15KB)

| Function | Status | Notes |
|----------|--------|-------|
| `runShock()` | ✅ BUILT | 5 shocks × 3 metrics |
| `riskShockSuite()` | ✅ BUILT | All 5 shocks |
| `whatWouldHelpMost()` | ✅ BUILT | Mitigation ranking |
| `projectBTR()` | ✅ BUILT | BTR trajectory |

---

### P2.5 — Timeline Suite
**Status:** ✅ COMPLETE (5 + 5 CRUD stubs)
**File:** `src/engine/timeline-engine.js` (25KB)

| Function | Status | Notes |
|----------|--------|-------|
| `calcAPQTimeline()` | ✅ BUILT | TL §10 |
| `calcMilestones()` | ✅ BUILT | TL §F |
| `calcGoalProgress()` | ✅ BUILT | TL §8 |
| `calcScoreHistory()` | ✅ BUILT | TL §9 |
| `calcRiskHistory()` | ✅ BUILT | TL §9 |
| `listScenarios()` | ⚠️ STUB | In-memory (Supabase later) |
| `openScenario()` | ⚠️ STUB | In-memory |
| `saveScenario()` | ⚠️ STUB | In-memory |
| `updateScenario()` | ⚠️ STUB | In-memory |
| `deleteScenario()` | ⚠️ STUB | In-memory |

---

### P2.6 — Home Suite
**Status:** ✅ COMPLETE (7 functions)
**File:** `src/engine/home-engine.js` (33KB)

| Function | ID | Status |
|----------|-----|--------|
| `computeSinceLastVisit()` | C97 | ✅ BUILT |
| `stateTileJourney()` | C98 | ✅ BUILT |
| `whatActionWouldItTake()` | C99 | ✅ BUILT |
| `compositeTrajectory()` | C100 | ✅ BUILT |
| `cohortRankHistory()` | C101 | ✅ BUILT |
| `realityEngineState()` | C102 | ✅ BUILT |
| `prcPccCurrent()` | C103 | ✅ BUILT |

---

### P2.7 — Rules Management API
**Status:** ❌ NOT STARTED (0/15)
**Blocked by:** Supabase setup

| Function | Status |
|----------|--------|
| `getRulesVersion()` | ❌ TODO |
| `loadBundle()` | ❌ TODO |
| `validateBundle()` | ❌ TODO |
| `diffBundles()` | ❌ TODO |
| `migrateEntity()` | ❌ TODO |
| ... (10 more) | ❌ TODO |

---

### P2.8 — State Tiles Engine
**Status:** ✅ COMPLETE (4 functions)
**File:** `src/engine/state-tiles-engine.js` (10KB)

| Function | Status |
|----------|--------|
| `safetyNetState()` | ✅ BUILT |
| `debtFreeState()` | ✅ BUILT |
| `fiState()` | ✅ BUILT |
| `beneficiaryState()` | ✅ BUILT |

---

### P2.9 — Aggregator Interface
**Status:** ❌ NOT STARTED
**Blocked by:** P2.7 Rules Management API

---

### P2.10 — Supabase Setup
**Status:** ✅ COMPLETE (1 May 2026)
**Project:** caelixa-dev (`yknnfglfbpcyxcllrvmd`)

| Item | Status |
|------|--------|
| Schema deployed | ✅ 7 tables |
| Indexes | ✅ 17 indexes |
| Views | ✅ 4 views |
| RLS policies | ✅ 3 policies |
| Client installed | ✅ `@supabase/supabase-js` |
| Client config | ✅ `src/lib/supabase.js` |
| Env vars | ✅ `.env.local` |

**Tables:**
- `finio_entities` — entity store
- `finio_entity_relationships` — relationships
- `finio_events` — canonical event store
- `finio_bundle_snapshots` — X22 breadcrumb
- `finio_scheduled_activations` — scheduler
- `finio_user_connections` — Open Banking
- `finio_cma_bundle` — Class 2 context data

**Migration files:** `supabase/migrations/001-010*.sql`

---

### P2.X — Monthly Flow (bonus)
**Status:** ✅ COMPLETE (2 functions)
**File:** `src/engine/monthly-flow-engine.js` (5KB)

| Function | Status |
|----------|--------|
| `monthlyFlow()` | ✅ BUILT |
| `allocationPressure()` | ✅ BUILT |

---

## PHASE 3 — UI PRIMITIVES

| Task | Status | Blocker |
|------|--------|---------|
| P3.1 Design self-criticism pass | ❌ NOT DONE | HomeV2 built prematurely |
| P3.2 `<Number />` component | ❌ NOT BUILT | Needs P3.1 |
| P3.2 `<DepthCard />` component | ❌ NOT BUILT | Needs P3.1 |
| P3.2 `<TripleAnchor />` v1.1 | ❌ NOT BUILT | Needs P3.1 |

---

## PHASE 4 — STATIC SCREENS

| Screen | Status | Notes |
|--------|--------|-------|
| P4.1 HomeV2 review pass | ⚠️ NEEDS REVIEW | Exists but pre-dates design self-criticism |
| P4.2 MyMoney static | ⚠️ LEGACY | `MyMoney.jsx` exists, not spec-compliant |
| P4.3 Cashflow static | ❌ NOT BUILT | No `Cashflow.jsx` |
| P4.4 Tax & Estate static | ⚠️ LEGACY | `TaxEstate.jsx` exists, not spec-compliant |
| P4.5 Timeline static | ⚠️ LEGACY | `Plan.jsx` exists (wrong name) |
| P4.6 Risk overlay static | ⚠️ LEGACY | `Risk.jsx` exists |
| P4.7 Settings + Reports | ⚠️ LEGACY | `Settings.jsx` exists |
| P4.8 R01 Portfolio Pulse | ❌ NOT BUILT | |
| P4.9 R07 IFA Brief | ❌ NOT BUILT | |

---

## PHASE 5 — WIRE SCREENS TO ENGINE

| Task | Status | Dependency |
|------|--------|------------|
| P5.1 MyMoney wired | ❌ NOT DONE | P4.2 |
| P5.2 Home wired | ⚠️ PARTIAL | A6 alert wiring done |
| P5.3 Tax & Estate wired | ❌ NOT DONE | P4.4 |
| P5.4 Cashflow wired | ❌ NOT DONE | P4.3 |
| P5.5 Timeline wired | ❌ NOT DONE | P4.5 |
| P5.6 Risk overlay wired | ❌ NOT DONE | P4.6 |
| P5.7 Reports wired | ❌ NOT DONE | P4.8, P4.9 |

---

## PHASE 6 — VALIDATION & TESTS

| Task | Status | Notes |
|------|--------|-------|
| P6.1 Test scripts | ✅ DONE | `r08-validate.js`, `visual-qa.js`, `reconcile-smoke.js` |
| P6.2 Run all 13 Mr T | ✅ DONE | 0 failures |
| P6.3 Regression baseline | ✅ DONE | `baseline-FINIO-1.0-UK-2026.1.json` |

---

## PHASE 7 — DEMO PERSONAS

| Task | Status | Dependency |
|------|--------|------------|
| P7.1 Bruce end-to-end | ❌ NOT STARTED | P5 all |
| P7.2 Tony Stark | ❌ NOT STARTED | P7.1 |
| P7.3 Hermione/Wonka/Anna | ❌ NOT STARTED | P7.1 |

---

## PHASE 8 — DEMO PREP (20 May target)

| Task | Status |
|------|--------|
| P8.1 IFA dry-run | ❌ NOT STARTED |
| P8.2 Visual polish + light mode | ❌ NOT STARTED |
| P8.3 B13 walk-through script | ❌ NOT STARTED |
| P8.4 Cleanup HomeScreenJit.jsx | ❌ TODO (file deleted, backup exists) |

---

## KEY INTERDEPENDENCIES

```
P2.1 Foundational ──┬──> P2.2 Cashflow
                    ├──> P2.3 Tax & Estate
                    ├──> P2.4 Risk
                    └──> P2.6 Home

P2.2 + P2.3 ──────────> P2.4 Risk (CF metrics depend on calcRisk)

P2.4 + P2.5 ──────────> P2.6 Home (triple-anchor needs all)

P2.1-P2.6 ────────────> P2.7 Rules API (all domain suites first)

P2.7 Rules API ───────> P2.8 State Tiles (needs RulesManager)

P2.7 + P2.8 ──────────> P2.9 Aggregator

Supabase ─────────────> P2.7, P2.8, P2.9 (persistence layer)

P3.1 Design review ───> P3.2 Primitives ───> P4.* Static screens

P2 Engine complete ───> P5 Wiring (no inline calcs in components)

P4 Static sign-off ───> P5 Wiring (visual approval gate)

P5 All wired ─────────> P6 Validation ───> P7 Demo personas ───> P8 Demo
```

---

## CRITICAL PATH TO 20 MAY DEMO

1. ~~**Supabase setup**~~ — ✅ DONE (1 May 2026)
2. **P3.1 Design review** — HomeV2 drift check before more screens
3. **P3.2 UI primitives** — `<Number />`, `<DepthCard />` block all screens
4. **P4.1 HomeV2 review** — fix spec drift
5. **P4.2-P4.7 Static screens** — founder visual sign-off each
6. **P5.1-P5.7 Wire screens** — engine data flows in
7. **P7.1 Bruce demo** — first persona end-to-end
8. **P8.1-P8.4 Polish** — demo ready

---

## OPEN DECISIONS BLOCKING PROGRESS

| ID | Decision | Blocks |
|----|----------|--------|
| O-SET-G | Settings gate decision | Settings.jsx |
| O-SET-H | Settings gate decision | Settings.jsx |
| O-SET-13 | Recalc lock UX | Settings.jsx |
| O-REP-1 | Paged.js vs browser PDF | Reports |
| Q-B9-1 | Beneficiary group vs modifier | Classifier |

---

## FILES INVENTORY

### Engine (8 files)
- `src/engine/fq-calculator.js` — 65KB · core scoring
- `src/engine/cashflow-engine.js` — 41KB · CF suite
- `src/engine/tax-estate-engine.js` — 59KB · T&E suite
- `src/engine/risk-engine.js` — 15KB · shocks + BTR
- `src/engine/home-engine.js` — 33KB · Home suite
- `src/engine/timeline-engine.js` — 25KB · Timeline suite
- `src/engine/state-tiles-engine.js` — 10KB · state tiles
- `src/engine/monthly-flow-engine.js` — 5KB · flow

### Rules (3 files)
- `src/rules/tax-2026.json` — UK tax rules
- `src/rules/cma-2026.json` — Capital Market Assumptions
- `src/rules/life-stages.json` — life stage definitions

### Supabase (11 files)
- `src/lib/supabase.js` — client config + table/view constants
- `supabase/migrations/000_all_migrations_combined.sql` — full schema
- `supabase/migrations/001-010_*.sql` — individual migrations

### Tests (5 files)
- `tests/r08-validate.js` — R08 CLI validator
- `tests/visual-qa.js` — 13-fixture visual QA
- `tests/reconcile-smoke.js` — integration smoke
- `tests/home-engine-smoke.js` — home engine tests
- `tests/monthly-flow.test.js` — monthly flow tests

### Screens (15 files)
- `src/screens/HomeV2.jsx` — 28KB · current home
- `src/screens/Dashboard.jsx` — 17KB · routes entity
- `src/screens/MyMoney.jsx` — 37KB · legacy
- `src/screens/TaxEstate.jsx` — 17KB · legacy
- `src/screens/Risk.jsx` — 19KB · legacy
- `src/screens/Settings.jsx` — 20KB · legacy
- `src/screens/Plan.jsx` — 11KB · legacy (Timeline)
- Others: legacy/supporting

---

**NEXT IN QUEUE:** P2.7 Rules Management API (unblocked by Supabase) OR P3.1 Design review (can run parallel)
