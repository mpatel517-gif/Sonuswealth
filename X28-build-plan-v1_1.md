# CAELIXA — X28 BUILD PLAN

**File:** `X28-build-plan-v1_1.md`
**Version:** v1.1
**Date:** 2026-05-04 (same-day version bump per skill v1.3 §13.9 collision-recovery)
**Cluster:** 4-Operations
**Status:** DOCUMENTED · pre-build planning artefact · founder-approved
**Supersedes:** `X28-build-plan-v1_0.md` (v1.0 audit-retained)

**Material changes at v1.1 (3 deltas from v1.0):**

| § | Change | Decision |
|---|--------|----------|
| §A task 4/5 · §D Wave 1A · §E risk 3 · §G approval task 2 · §F failure modes | Event store is **Supabase from Wave 1A onwards**. localStorage stub language removed. Wave 1A pre-task added: Supabase events table + `eventStore.js` adapter. | D-EVENTSTORE-1 |
| §B task 8 · §D Wave 1C task 12 · §E risk 1 | Window-ID refactor is **atomic in-place rename in one coordinated commit**. No shim-and-migrate. No backward-compat aliases. | D-QUALITY-BAR-1 |
| §C row 19 · §E risk 6 | HomeV2.jsx **superseded** by radar component on HomeScreen.jsx. Wave 1E task 19 proceeds on HomeScreen.jsx without coordination guard. Radar component internals remain Jit's domain — extend via existing onWealthTap/onRiskTap/onNetWorthTap props or wrap. | D-HOMEV2-1 |

**Authority:**
- `parts/1-Foundation/1-Foundation-X28-temporal-view-design-v1_1.md` (deepest engineering contract)
- `parts/200 Project Updates/finio-foundation-v1_8.md` §3.5.X28 (cross-cutting authority)
- `parts/10-All Clusters/10-AllClusters-architecture-master-v1_3.md` §36 (per-tab summary + decisions)
- per-tab §X28-* sections in cashflow v1.3, home v1.3, mymoney v2.3, tax-estate v1.3, timeline v1.3
- Risk overlay v1.4 — confirmed NOT in X28 scope (point-in-time only); no X28 work this phase
- `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md` (event store schema authority — D-EVENTSTORE-1)

**Goal:** Reach X28 CODED across all five primary tabs + Settings, with the 9 X28 engine functions reaching real implementation in parallel. Per CLAUDE.md §8 sequencing, X28 lands before per-tab depth pull-through.

**Scope:** Phase 1 of the May 20 cross-cutting build. Phase 2 (X29) and Phase 3 (X24) follow this; per-tab depth waves come after all three cross-cuttings are stable.

---

## §A — ENGINE WORK

All 9 X28 functions exist as Wave-0 stubs in `src/engine/fq-calculator.js` (lines 1298–1352). Each must be replaced with a real implementation matching the X28 design v1.1 contract. Plus parameter expansion across 7 existing chart-rendering functions per §4.2.

**Status flag:** "stub" = signature exists but body returns a placeholder; "real-impl" = body matches the X28 design contract; "param-expansion" = existing real function gains `(window, viewMode)` params with backward-compatible defaults.

| # | Function | Current state | Implementation contract | Complexity | Authoritative spec |
|---|---|---|---|---|---|
| 1 | `getTimeWindow(windowId, jurisdiction, referenceDate?, longevityConfig?)` | stub — returns hardcoded current-tax-year object | Resolve any of 7 canonical windows (CURRENT_MONTH · LAST_30_DAYS · TAX_YEAR · CALENDAR_YEAR · LAST_12_MONTHS · CUSTOM · LIFETIME). Jurisdiction-specific TAX_YEAR boundaries (UK 6 Apr–5 Apr). LIFETIME endpoint from `longevityConfig.band` ('conservative' 85 / 'median' 88 / 'optimistic' 92 / custom). Return `{ id, start, end, label, jurisdiction, isPastOnly, isFutureOnly }`. Pure compute. | S | X28 design v1.1 §1.1–§1.3 · §4.1 |
| 2 | `getViewMode(windowId, referenceDate?, hasActivePlan?)` | stub — returns 'actual' | Resolve default mode by window nature per §2.2 matrix. Return `{ defaultMode, availability: { actual, forecast, plan, scenario } }` where availability respects window past/future split + plan presence + scenario presence. Pure compute. | S | X28 design v1.1 §2.1–§2.2 · §4.1 |
| 3 | `applyTimeWindow(dataArray, window, viewMode, aggregation?)` | stub — returns input unchanged | Filter array to window range; apply aggregation (`'sum' \| 'average' \| 'end-of-period' \| 'time-series'`); handle missing data per O-X28-2 (carry-forward at v1.0). Pure compute. | M | X28 design v1.1 §4.1 |
| 4 | `forecastFor(entity, windowId, viewMode, params?)` | stub — returns `[]` | Forward-project entity values from current state via CMA bundle. Pure compute on call. **Snapshot writes (per Option D):** a separate `writeForecastSnapshot()` helper fires `FORECAST_SNAPSHOT` events at exactly four triggers — period boundary, plan commit, user checkpoint, major data ingest. Never on every call. Snapshots persist via Supabase event store (D-EVENTSTORE-1). | L | X28 design v1.1 §4.1 · §0.1 (Option D) · arch master §36.7 |
| 5 | `commitPlan(entity, planType, targets, assumptions, parentPlanId?)` | stub — returns `{ id: 'plan-stub', committed: true }` | Validate (targets nonempty · byDate ≥ today · custom requires label). Write `PLAN_COMMITMENT` event to **Supabase events table via `src/engine/eventStore.js` adapter** (D-EVENTSTORE-1; schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`). Auto-supersede any prior active plan of same `planType` (writes supersession chain via `supersedes` field). Return `{ planId, status: 'active', committedAt, reviewByDate, supersedes, correlationId }`. **No localStorage path.** | M | X28 design v1.1 §4.1 · §4.6 |
| 6 | `planFor(entity, planType, window?)` | stub — returns `null` | Read latest active `PLAN_COMMITMENT` event for `planType` **from Supabase events table via `eventStore.js` adapter**; if `planType='all'` return array. Optionally filter to plans touching `window`. Return `{ plan, staleness }` (calls `planStaleness` for convenience). | M | X28 design v1.1 §4.1 |
| 7 | `varianceFor(entity, mode1, mode2, window)` | stub — returns `{ variance: 0, direction: 'neutral' }` | Pure-compute variance card data. Resolves both modes via `getViewMode + applyTimeWindow + forecastFor + planFor`. Return `{ metric, mode1Value, mode2Value, variance, variancePct, direction: 'ahead' \| 'behind' \| 'on-track' (±5%), explainer }` (X25 plain-English). | M | X28 design v1.1 §2.4 · §4.1 |
| 8 | `planStaleness(planId, entity, bundles)` | stub — returns `{ stale: false, severity: 'none' }` | Six trigger types (time-elapsed · life-event · variance · rules-change · goal-achieved · goal-infeasible) with default thresholds per planType (retirement 24mo · estate 36mo · cashflow 12mo · debt 12mo · gift 6mo · protection 12mo · tax 12mo · custom 24mo). Highest single-trigger severity sets overall plan severity. Return `{ staleness, triggers[], severity, recommendedAction, reviewByDate }`. **Scheduler:** real X28 design assumes daily 03:00 UTC server-side run; for v1.0 demo this fires on session-start instead (see §E risk 5). | L | X28 design v1.1 §4.4 |
| 9 | `planConflicts(activePlans, entity)` | stub — returns `[]` | Pure-compute conflict detection across active plans. v1.0 detects 4 most-common pairs: retirement⊗estate · cashflow⊗debt · gift⊗estate · cashflow⊗retirement. Lazy — called only on Settings → §S-plans render. Return array of `{ planAId, planBId, conflictType, severity, description, suggestedResolution }`. | M | X28 design v1.1 §4.5 |
| 10 | Parameter expansion (7 existing functions) | existing real-impl with positional args | Add `(window, viewMode)` params with backward-compatible defaults to: `trajectoryData` · `sippProjection` · `ihtDynamic` · `netWorth` · `guardrail` · `incomeTax` · `costOfInaction`. Default view mode at LIFETIME = `plan` (per X28 v1.1 §4.2). | M | X28 design v1.1 §4.2 · arch master §30 |
| 11 | `migrateTemporalPreferences(prefsV1)` | does not exist | Pure function. Adds `plansPreferences` block with defaults; increments `schemaVersion` 1 → 2. Live in `src/engine/temporalPreferences-migrations.js`. | S | X28 design v1.1 §6 |

**Total engine work:** 9 stub-to-real + 7 param-expansions + 1 migration helper + Supabase event store adapter (Wave 1A pre-task per §D).

---

## §B — UI COMPONENTS (SHARED, USED BY ALL FIVE TABS)

| # | Component | What it renders | Engine fn(s) consumed | Authoritative spec | Complexity |
|---|---|---|---|---|---|
| 1 | `<ViewModeToggle />` | Four-segment control (Actual · Forecast · Plan · Scenario). Active mode highlighted. Plan greyed if no active plan touching window; Scenario greyed if no saved scenario. Renders adjacent to existing `<TimeWindowSelector />` in top bar. | `getViewMode` (for availability + default) · `planFor('all', window)` (for plan availability) | X28 design v1.1 §3.1 | M |
| 2 | `<VarianceOverlay variant="plan-vs-actual" \| "forecast-vs-actual" \| "forecast-vs-plan" />` | Chart-aware overlay rendering one of three pairings: solid actual + dashed plan target · solid actual + dashed prior forecast · dashed plan target + dotted forecast. Below the chart, a `<VarianceCard />` with X25 plain-English explainer. | `varianceFor(entity, mode1, mode2, window)` | X28 design v1.1 §2.4 · §4.1 | L (3 variants) |
| 3 | `<PlanStalenessCard />` | Plan target · current value · staleness reason · severity chip (review-due / stale / critical / broken) · primary CTA driven by `recommendedAction` (review / update / retire / celebrate-and-replace). Causality stripe colour-coded by trigger type per X29 visual contract. Tap-to-reveal trigger detail. | `planStaleness(planId, entity, bundles)` | X28 design v1.1 §3.6 · §4.4 | M |
| 4 | `<PlanCommitFlow />` | Multi-step modal/bottom-sheet. Captures plan metadata (planType · custom label if needed · targets array · byDate · assumptions block · longevityBand). Validates inputs. Calls `commitPlan` which writes `PLAN_COMMITMENT` event to Supabase events table. Triggered from X24 mode 3 "Commit as plan", Timeline §E plan-builder, Settings §S-plans "Set a plan" CTAs, "Promote scenario as plan". | `commitPlan(entity, planType, targets, assumptions, parentPlanId?)` | X28 design v1.1 §3.6 · §4.6 · §4.7 | L |
| 5 | `<PlanConflictBanner />` | Settings-only surface (no nagging cross-tab). Lists detected conflicts with description + suggested resolution (narrative, never auto-resolved). | `planConflicts(activePlans, entity)` | X28 design v1.1 §3.6 · §4.5 | S |
| 6 | `<NowPill />` (primitive) | Small "[Now]" badge rendering adjacent to numbers in X28-invariant zones. Signals that the window selector does not affect this number. | none — pure presentation | CF v1.3 §X28.4 · T&E v1.3 §X28.3 invariant pattern · MM v2.3 §X28-MM.3 | S |
| 7 | `<AsAtPill />` (primitive) | Small "[as at {window-end-date}]" watermark for date-anchored elements (e.g. gift clock rings) when window ≠ current. | none — pure presentation | T&E v1.3 §X28.8 (gift clock pattern) | S |
| 8 | Refactor: `<TimeWindowSelector />` | Existing component (`src/components/Home/TimeWindowSelector.jsx`). Window IDs do not match X28 design canonical IDs — must refactor. **Atomic in-place rename across engine consumers + UI callers + Cashflow.jsx state strings + tests in one coordinated commit (D-QUALITY-BAR-1). No shim-and-migrate. No backward-compat aliases.** | `getTimeWindow` | X28 design v1.1 §1.1 · §3.1 · §3.2 | M (atomic refactor + coordinated caller updates) |

**Window ID reconciliation needed.** Current `TimeWindowSelector` uses: `current-tax-year`, `last-tax-year`, `ytd`, `last-12-months`, `last-3-months`, `this-month`, `lifetime`. X28 design canonical IDs: `CURRENT_MONTH`, `LAST_30_DAYS`, `TAX_YEAR`, `CALENDAR_YEAR`, `LAST_12_MONTHS`, `CUSTOM`, `LIFETIME`. Three current windows map cleanly (`last-12-months → LAST_12_MONTHS`, `this-month → CURRENT_MONTH`, `lifetime → LIFETIME`). Three need normalisation (`current-tax-year → TAX_YEAR`, `last-tax-year` is **not** an X28 canonical window — drop or move to `CUSTOM`-preset, `ytd` is **not** canonical — covered by `CALENDAR_YEAR` + view-mode `actual` past-portion). One missing (`LAST_30_DAYS`). One missing (`CALENDAR_YEAR`). **Per D-QUALITY-BAR-1 the rename is atomic — single coordinated commit, no shims.** Refactor cost: M. Caller in `src/screens/Cashflow.jsx` needs the IDs threaded through.

---

## §C — PER-TAB INTEGRATION

Risk overlay v1.4 **confirmed NOT in X28 scope** (X28 design v1.1 §5.6 + Cashflow v1.3 §X28-CF cross-reference confirm: Risk is point-in-time always; the protection-plan anchor is a logical ownership, not a top-bar X28 selector).

| Tab | X28 elements needed | Driving spec sections | Effect on existing layout | Complexity |
|---|---|---|---|---|
| **Home** (`src/screens/HomeScreen.jsx`) | Top-bar selector + ViewModeToggle · NowPill on Triple-anchor (Z1) + Daily delta (Z2) + Reality Engine (Z6) · §SJ-PLAN-OVERLAY dashed plan target on Zone 5 Score Journey when Plan mode active · §X28.4 Forecast-vs-Plan VarianceCard below Z5 (when forecast diverges >5%) · §Z7-PLANS PlanStalenessCard Priority Actions banner (critical-severity only) | Home v1.3 §X28-HOME §X28.1–§X28.5 · §Z7-PLANS · §SJ-PLAN-OVERLAY | Top-bar gains 4-segment toggle (was selector only). Z1/Z2/Z6 gain pill markers. Z5 gains plan overlay + variance card. New Z7-PLANS banner above existing Priority Actions. | M |
| **MyMoney** (`src/screens/MyMoney.jsx`) | Top-bar selector + ViewModeToggle · NowPill on asset values (X28-invariant balance-sheet primary) · windowed sub-surfaces (income trends, state tile deltas, charts) respond to window · NO PlanStalenessCard (deep-link to Settings only) | MyMoney v2.3 §X28-MM.1–§X28-MM.6 | Top-bar gains 4-segment toggle. Asset rows gain NowPill. Income/trend/state-tile sub-cards become window-aware. | M |
| **Cashflow** (`src/screens/Cashflow.jsx`) | Top-bar already wired (`TimeWindowSelector` + window context strip exist) — add ViewModeToggle · NowPill on CoI odometer (§6.3) + Liquidity Buffer (§4.9) per §X28.4 invariant zones · Three variance overlays per §X28.5 (Plan-vs-Actual on FR + PoS, Forecast-vs-Actual on §A surplus, Forecast-vs-Plan on FR — most prominent for IFA demo) · §X28.6 accountant + TAX_YEAR vertical date-line splitting Actual + Forecast in §A waterfall · §X28.7 LIFETIME-isolation chip on MC fan, sequence-of-returns, G-K, 5 scenarios, Reality Engine, FI progress · §PLAN-ANCHOR-CF cashflow plan with single PlanStalenessCard at §B funded ratio | Cashflow v1.3 §X28-CF §X28.1–§X28.7 · §PLAN-ANCHOR-CF | Top-bar gains 4-segment toggle. §A waterfall gains accountant-mode date-line + chip. §B chart cards gain Plan-mode behaviour + variance overlays + LIFETIME-isolation chips. New PlanStalenessCard inline below FR gauge. | L |
| **Tax & Estate** (`src/screens/TaxEstate.jsx`) | Top-bar selector + ViewModeToggle on both sub-tabs · NowPill on CoI odometer + current IHT bill · §X28.8 gift clock AsAtPill watermark when window ≠ Now · Three simultaneous PlanStalenessCard instances (estate · gift · tax) — anti-nagging exception per §PLAN-ANCHOR-TE because T&E IS the canonical planning surface · IFA walkthrough flow: LIFETIME + Plan mode → estate plan target line → Forecast-vs-Plan VarianceCard → "Model action paths" → X24 mode 3 commit | Tax & Estate v1.3 §X28-TE §X28.1–§X28.8 · §PLAN-ANCHOR-TE | Top-bar gains 4-segment toggle. Tax sub-tab + Estate sub-tab both render variance overlays. Gift clock cards gain AsAtPill watermark. Three plan staleness cards inline. | L |
| **Timeline** (`src/screens/Timeline.jsx`) | Top-bar selector + ViewModeToggle (LIFETIME default) · §B Score Journey is **plan-primary surface** when retirement plan active · §X28.5 O-X28-13 implementation: when no retirement plan, Plan mode shows "suggested plan" preview based on PLSA Retirement Living Standards (suggested only — explicit confirm required to commit) · §B canonical X28+O-R3-5 hero with three-line longevity bands (85 / 88 / 92) · §E **canonical plan-builder home** — Active Plans subsection (E.0) shows committed plans, "+ Set a plan" CTA opens X24 mode 3 + PlanCommitFlow · §F supersession chain history view | Timeline v1.3 §X28-TL §X28.1–§X28.5 · §B · §E · §F | Top-bar gains 4-segment toggle. §B chart gains plan-primary mode + suggested-plan preview. §E gains Active Plans subsection (new). §F gains supersession history (new). | L |
| **Settings** (`src/screens/Settings.jsx`) | New §S-plans canonical management surface — list active plans, PlanStalenessCard per plan, PlanConflictBanner · §S7 4-mode UI (was 3-mode) · §S7 `plansPreferences` UI (default plan view, staleness notification cadence + severity threshold, time-elapsed thresholds per planType, conflict detection enable/disable) · `migrateTemporalPreferences` runs on schemaVersion=1 detection | Settings master v1.5 §S7 + §S-plans · X28 design v1.1 §6 | New §S-plans section. §S7 panel extended with 4-mode + plansPreferences. Migration runs on first load. | M |
| **Risk overlay** (`src/screens/RiskOverlay.jsx`) | **NONE this phase.** No top-bar X28 selector. Protection plan staleness surfaces in Settings §S-plans only. Risk Score is always point-in-time. | X28 design v1.1 §5.6 (carried verbatim from v1.0) · CF v1.3 §X28-CF cross-reference | No change. | — |

---

## §D — SEQUENCING WITHIN PHASE 1 (TOPO-SORTED)

Wave 1A through 1F. Each wave can run agents in parallel within the wave, but waves run sequentially.

### Wave 1A — Engine s02a-tier + Supabase event store (parallel within wave)

**Pre-task (D-EVENTSTORE-1) · GATING for items 4 and 5:** Supabase event store wire-up. Create `events` table in Supabase per schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`. Implement `src/engine/eventStore.js` adapter exposing minimum surface:
- `writeEvent(event)` — insert with `correlation_id` required
- `readEvents(entityId, filters?)` — filter by `entity_id`, `event_type`, `plan_type`, `is_active`
- `subscribeEvents(entityId, callback)` — Supabase realtime subscription
- `getLatestEvent(entityId, eventType, filters?)` — convenience for plan-active lookups

PLAN_COMMITMENT writer + reader path is the gating capability — must be exercisable end-to-end before items 4 and 5 unblock. **No localStorage shortcuts at any tier.** RLS policies (auth.uid() = user_id) wired from day one — entity isolation is non-negotiable.

These have no inter-dependency on the s02b-tier and are foundational for everything downstream.

1. **Real-impl `getTimeWindow`** — no engine deps · depends on jurisdiction bundle (UK-2026.1 already wired)
2. **Real-impl `applyTimeWindow`** — no engine deps · depends on `getTimeWindow` for window resolution
3. **Real-impl `getViewMode`** — depends on `planFor` (for `hasActivePlan` param). At Wave 1A, allow `getViewMode` to call `planFor` stub; both lift to real-impl in 1A; mutual stubs OK during wave
4. **Real-impl `commitPlan`** — depends on Supabase event store via `eventStore.js` (D-EVENTSTORE-1)
5. **Real-impl `planFor`** — depends on Supabase event store via `eventStore.js` (D-EVENTSTORE-1)
6. **`migrateTemporalPreferences`** — no deps

**Gating output of 1A:** all 6 functions return real values from real entity reads + real Supabase event reads. PLAN_COMMITMENT round-trip (write → read → render) demonstrable end-to-end. Wave 1B unblocked.

### Wave 1B — Engine s02b-tier + parameter expansion (parallel within wave)

7. **Real-impl `forecastFor`** — depends on CMA bundle (UK-CMA-2026.1; ship hardcoded UK-2026.1 defaults if bundle wiring slips, document in spec) · `applyTimeWindow`. `writeForecastSnapshot()` helper writes FORECAST_SNAPSHOT events to Supabase via `eventStore.js` at four trigger points only (D-EVENTSTORE-1).
8. **Real-impl `varianceFor`** — depends on `getViewMode`, `applyTimeWindow`, `forecastFor`, `planFor`
9. **Real-impl `planStaleness`** — depends on `planFor` + event listeners (`LIFE_EVENT`, `BUNDLE_ACTIVATED` — both via Supabase realtime subscription); session-start-fired (not daily) for v1.0
10. **Real-impl `planConflicts`** — depends on `planFor('all')`
11. **Parameter expansion** across 7 existing chart-rendering functions (`trajectoryData`, `sippProjection`, `ihtDynamic`, `netWorth`, `guardrail`, `incomeTax`, `costOfInaction`) — backward-compatible default behaviour preserved

### Wave 1C — UI primitives (depends on Wave 1A engine being real)

12. **Refactor `TimeWindowSelector`** — normalise window IDs to X28 canonical (CURRENT_MONTH · LAST_30_DAYS · TAX_YEAR · CALENDAR_YEAR · LAST_12_MONTHS · CUSTOM · LIFETIME). **Atomic single commit (D-QUALITY-BAR-1):** rename across engine consumers + UI callers + `Cashflow.jsx` state strings + tests in one coordinated change. No shim-and-migrate pattern. No backward-compat aliases. Branch must be green (`npm run build` zero errors) before merge.
13. **Build `<ViewModeToggle />`**
14. **Build `<NowPill />`** and **`<AsAtPill />`** (parallel — small primitives)
15. **Build `<PlanStalenessCard />`** (depends on `planStaleness` from 1B — can start scaffold against stub, finalise after 1B)

### Wave 1D — UI flows (depends on 1B + 1C)

16. **Build `<VarianceOverlay />`** with three variants (Plan-vs-Actual / Forecast-vs-Actual / Forecast-vs-Plan)
17. **Build `<PlanCommitFlow />`** — single shared component; multi-call-site (X24 mode 3, Timeline §E, Settings §S-plans, "promote scenario")
18. **Build `<PlanConflictBanner />`**

### Wave 1E — Per-tab integration (parallel — six independent agents)

Per CLAUDE.md §7, each per-tab agent reads CLAUDE.md → AUTHORITY-MAP.md → per-tab spec → spec authorities → engine before touching code. Each produces a WILL-BUILD / KNOWN-STUB-ENGINE / NOT-THIS-WAVE table for founder approval.

19. **Home** — top-bar 4-segment toggle · invariant pills (Z1/Z2/Z6) · Z5 plan overlay · Forecast-vs-Plan VarianceCard · Z7-PLANS staleness banner. **Touch HomeScreen.jsx (D-HOMEV2-1: HomeV2.jsx superseded; no Jit coordination guard for Zone 5 work). Constraint: do not modify radar component internals — Jit's domain — extend via existing `onWealthTap` / `onRiskTap` / `onNetWorthTap` props or wrap. Escalate to founder if Z5 work requires changes inside the radar.**
20. **MyMoney** — top-bar · NowPill on asset values · windowed sub-surfaces · NO staleness card
21. **Cashflow** — top-bar 4-segment (existing window-only selector extends) · CoI + Liquidity Buffer NowPill · 3 variance overlays · accountant TAX_YEAR date-line · LIFETIME-isolation chips · §PLAN-ANCHOR-CF staleness card
22. **Tax & Estate** — top-bar · CoI + IHT bill NowPill · gift clock AsAtPill · 3 simultaneous staleness cards · IFA walkthrough flow
23. **Timeline** — top-bar (LIFETIME default) · §B plan-primary mode + suggested-plan preview · §E Active Plans + plan-builder · §F supersession chain
24. **Settings §S-plans + §S7** — new §S-plans section · 4-mode UI · plansPreferences UI · migration runs on load

### Wave 1F — Cross-tab integration + persona walkthrough

25. **Verify `correlation_id`** present on every `PLAN_COMMITMENT` event written from every call site (Supabase events table query)
26. **Verify Plan-vs-Actual variance overlay** renders correctly across all five tabs with same plan
27. **Persona walkthrough** — Bruce Wayne (estate-primary), Hermione Granger (IFA), Tony Stark (BPR), Fred & Wilma (couple), Willy Wonka (degraded archetype)
28. **`npm run build`** zero errors · browser smoke at localhost:5173 · console clean · Supabase events table populated correctly

---

## §E — RISKS

1. **Window ID mismatch.** Current `TimeWindowSelector` IDs (`current-tax-year`, `last-tax-year`, `ytd`, `last-12-months`, `last-3-months`, `this-month`, `lifetime`) don't match X28 canonical (`CURRENT_MONTH`, `LAST_30_DAYS`, `TAX_YEAR`, `CALENDAR_YEAR`, `LAST_12_MONTHS`, `CUSTOM`, `LIFETIME`). Three windows are not in the canonical set (`last-tax-year`, `ytd`, `last-3-months`); two canonical windows are missing (`LAST_30_DAYS`, `CALENDAR_YEAR`). Cashflow.jsx already imports the existing IDs. **Mitigation:** task 12 in Wave 1C handles rename atomically (D-QUALITY-BAR-1). All callers (Cashflow.jsx state strings, engine consumers, tests) updated in one coordinated commit. No shim-and-migrate pattern. No backward-compat aliases.

2. **Top-bar layout shift.** Adding ViewModeToggle next to TimeWindowSelector changes the top-bar shape. Every screen that consumes the selector (Cashflow currently, Home/MyMoney/T&E/Timeline pending) needs the toggle wired in. Width budget at 480px max content width may force wrapping on narrow screens. **Mitigation:** design ViewModeToggle as compact 4-segment chip group; consider responsive collapse to icon-only on <380px width.

3. **Event store wiring scope.** `commitPlan` writes events; `planFor` reads them. Per D-EVENTSTORE-1, the event store is **Supabase from Wave 1A onwards** — no localStorage stub at any tier. **Implementation:** Wave 1A pre-task creates Supabase `events` table per schema at `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`, plus `src/engine/eventStore.js` adapter wrapping Supabase client. PLAN_COMMITMENT writer + reader path is the gating capability for Wave 1A items 4 and 5. RLS policies (auth.uid() = user_id) live from day one. Failure mode if this slips >1 day: founder escalation, not a localStorage fallback.

4. **CMA bundle not wired.** `forecastFor` depends on CMA bundle for growth/inflation/return assumptions. fq-calculator.js currently has hardcoded growth assumptions in places — a CLAUDE.md §6 rule violation if expanded. **Mitigation:** create `src/rules/cma-uk-2026-1.json` with launch-default assumptions during Wave 1B. `forecastFor` reads from bundle. Bundle activation/refresh is post-demo.

5. **Daily 03:00 UTC scheduler is server-side.** X28 design assumes server-side scheduler firing `planStaleness` daily across all users. Client-side Vite + React app cannot do this without a backend. **Mitigation for May 20:** fire `planStaleness` on session-start (every login/refresh); on `LIFE_EVENT` write (Supabase realtime subscription); on `BUNDLE_ACTIVATED` (when wired). Document the scheduler as deferred to post-demo backend wiring (Supabase Edge Functions cron). Acceptable for demo scope (founder + IFA personas, single-session walkthroughs).

6. **HomeV2.jsx superseded (D-HOMEV2-1, 4 May 2026).** HomeV2.jsx replaced by radar component on `HomeScreen.jsx`. Wave 1E task 19 (Home X28 integration) proceeds on `HomeScreen.jsx` without coordination guard. **Constraint:** the radar component within `HomeScreen.jsx` is Jit's domain — extend via props (existing `onWealthTap` / `onRiskTap` / `onNetWorthTap` pattern) or wrap; do not modify internals. If Z5 plan-overlay work requires changes inside the radar, escalate to founder before starting.

7. **Apparent contradiction: Risk overlay protection plan.** X28 design v1.1 §5.6 says Risk overlay anchors a protection plan. But Risk overlay is X28-out-of-scope (point-in-time). **Resolution (already in spec):** "anchor" is logical plan-type ownership, not a UI top-bar selector. Protection plan staleness surfaces in Settings §S-plans only. Risk overlay does NOT get a top-bar X28 selector. No contradiction — wording is subtle.

8. **PlanCommitFlow has many call sites.** X24 mode 3 commit, Timeline §E plan-builder, Settings §S-plans "Set a plan", "promote scenario as plan". Risk: divergent UX if implemented separately per site. **Mitigation:** single shared `<PlanCommitFlow />` portal-rendered; all callers `dispatch({ type: 'OPEN_PLAN_COMMIT', initial: {...} })` to a shared store/context. Listed in §B as task 17 with "single shared component" callout.

9. **Three simultaneous PlanStalenessCard on T&E.** §PLAN-ANCHOR-TE deliberately exempts T&E from the one-at-a-time rule because T&E IS the canonical planning surface. T&E v1.3 Q6 §0.6 weakness 2 acknowledges this risk and mitigates via D-CARD-REVEAL-1 inventory + life-stage-appropriate defaults + scroll-depth target. **Mitigation:** follow T&E v1.3 §CARD-REVEAL-1-TE inventory rules — Foundation users see fewer cards; Pre-retirement / Decumulation see all three. Confirm with founder if visual stack feels too dense at first persona walkthrough.

10. **forecastFor pure-compute vs FORECAST_SNAPSHOT events.** D-X28-OPTION-D: snapshots only at four trigger points, not on every call. `forecastFor` is called from variance overlays + chart rendering on every render. Risk: mixed semantics. **Mitigation:** `forecastFor` is pure compute (always callable, no event side-effect). Snapshot writes are gated by a separate `writeForecastSnapshot()` helper called from exactly four callers — period boundary scheduler, `commitPlan` post-write hook, user-initiated checkpoint button (Settings §S-plans), and major data ingest (post-Open-Banking-wiring; not in May 20 scope). All snapshot writes go through `eventStore.js` to Supabase (D-EVENTSTORE-1).

11. **PLSA Retirement Living Standards data needed for O-X28-13.** Timeline v1.3 §X28.5 "suggested plan" preview when no retirement plan exists requires PLSA Minimum/Moderate/Comfortable income levels per household type. Not in `src/rules/` today. **Mitigation:** create `src/rules/plsa-uk-2026.json` during Wave 1E task 23 with launch-default income levels. Bundle-versioned alongside CMA.

12. **fq-calculator.js PROTECTED rule.** CLAUDE.md §6 bullet 1: "Do not rebuild fq-calculator.js. Extend at the bottom only. Never modify or rewrite an existing exported function." The 9 X28 stubs are at the bottom (lines 1298+) marked "STUB: implement at s02a — Real calculation logic is implemented at s02a." Replacing stub bodies with real implementations is "extending" in spirit but technically modifying existing functions. **Mitigation:** explicit founder go-ahead before Wave 1A starts (this plan v1.1 approval is that go-ahead, recorded under D-QUALITY-BAR-1). Updated CLAUDE.md §6 bullet 1 carries the Wave 1A exception language. The 7 chart-rendering function param expansions in §A task 10 must be additive — new optional params with defaults, never modifying existing call shape.

13. **Timeline §F supersession-chain view is new UI surface.** Wave 1E task 23 adds §F (plan history) which doesn't exist in current Timeline.jsx. Chart taxonomy may need a new visual (linear timeline with plan-version chips). **Mitigation:** simple list view at v1.0 (table of `committedAt + targets summary + status`); fancier visual deferred. Document in spec walkthrough.

14. **PlanConflictBanner UX is narrative-only.** X28 design v1.1 §4.5: "suggested resolution narrative — never auto-resolved." Risk: users see a banner with text and no action. **Mitigation:** every conflict item ends with a "Discuss with adviser" link or "Adjust plan A" / "Adjust plan B" CTAs that launch PlanCommitFlow with the specific plan pre-loaded. Not auto-resolution; explicit user-driven resolution.

15. **Schema migration timing.** `migrateTemporalPreferences(prefsV1) → prefsV2` runs on first load detecting `schemaVersion: 1`. Risk: existing user prefs stored under different keys. **Mitigation:** check for existing `temporalPreferences` key in the user's preferences row in Supabase; if absent, write defaults; if present and v1, run migration; if v2, no-op. Document idempotency.

---

## §F — ESTIMATE

**Unit:** "agent-day" = ~6 hours focused agent work + ~1 hour founder review/sign-off.

| Wave | Work | Serial agent-days | Parallel wall-clock |
|---|---|---|---|
| 1A | Supabase event store wire-up + 6 engine fns × ~0.5 each | 3.5 | 1.5 (3 parallel agents — pre-task on critical path) |
| 1B | 4 engine fns + 7 param-expansions | 4.0 | 1.5 (3 parallel agents) |
| 1C | TimeWindowSelector atomic refactor + ViewModeToggle + NowPill + AsAtPill + PlanStalenessCard | 2.5 | 1.5 (2 parallel) |
| 1D | VarianceOverlay (×3) + PlanCommitFlow + PlanConflictBanner | 3.0 | 1.5 (2 parallel) |
| 1E | 6 per-tab agents (Home, MyMoney, CF, T&E, Timeline, Settings) | 5.5 | 1.5 (6 parallel) |
| 1F | Cross-tab integration + persona walkthrough + smoke | 1.0 | 1.0 (single) |
| **Total** | — | **19.5 agent-days serial** | **8.5 wall-clock days with parallelisation** |

**Calendar projection:** Today is 2026-05-04. Demo is 2026-05-20 — **16 calendar days remaining**. Phase 1 X28 alone consumes ~8.5 wall-clock days with 6-agent parallel capacity. Phases 2 (X29) + 3 (X24) + per-tab depth pull-through + INTEGRATION wave must fit into the remaining ~7.5 days.

**Margin assessment:** **Tight but feasible** with the assumptions:
- 6-agent parallel capacity (one Opus or Sonnet per work parcel in Wave 1B/1C/1D/1E)
- Supabase event store wire-up completes within Wave 1A pre-task budget (1 day max)
- HomeV2.jsx Zone 5 question resolved by D-HOMEV2-1 — Wave 1E task 19 unblocked from start
- Founder reviews same-day, not next-day
- No spec disagreements surface during build that require re-spec

**Failure modes that blow the timeline:**
- Wave 1A Supabase event store wire-up blocks for >1 day on RLS / auth / schema issues
- Window ID refactor (task 12) cascades into spec disagreements between current code and X28 canonical IDs
- Three-simultaneous-PlanStalenessCard on T&E feels too dense at first walkthrough and triggers a re-spec

**If Phase 1 slips by ≥3 wall-clock days:** founder must decide whether to (a) cut X29 visual sophistication (simpler diff treatment at v1.0), (b) cut suggested-plan preview on Timeline (let plan-empty state show "Set a plan" CTA only), or (c) move May 20 demo. Per CLAUDE.md §8 the May 20 deadline is binding — so (a) or (b) likely come first. **Founder decides — never the agent.**

---

## §G — APPROVAL CHECKPOINT

This plan is read-only until founder approves. After approval:
1. Wave 1A Pre-task starts — Supabase event store wire-up: `events` table created per schema, RLS policies live, `src/engine/eventStore.js` adapter exposes `writeEvent` / `readEvents` / `subscribeEvents` / `getLatestEvent`. PLAN_COMMITMENT writer + reader paths exercisable end-to-end (dummy entity test). **No localStorage path at any tier (D-EVENTSTORE-1).** Gates Wave 1A items 4 and 5.
2. Wave 1A items 1–6 dispatch — 3 parallel agents on `getTimeWindow + applyTimeWindow + getViewMode` (Agent β), `commitPlan + planFor` (Agent α, depends on pre-task), `migrateTemporalPreferences` (Agent γ).
3. Each agent produces the §7 Reading + Walk-through checklist before writing code.
4. Wave gates checked before next wave starts (`npm run build` green, founder smoke-tests in browser, Supabase events table populated correctly with PLAN_COMMITMENT round-trip demonstrable).

---

## §H — DECISIONS LOG (this plan only)

| ID | Date | Decision | Sections affected at v1.1 |
|---|---|---|---|
| D-HOMEV2-1 | 4 May 2026 | HomeV2.jsx superseded by radar component on HomeScreen.jsx. Wave 1E task 19 proceeds on HomeScreen.jsx without coordination guard. Radar component internals remain Jit's domain — extend via existing `onWealthTap` / `onRiskTap` / `onNetWorthTap` props or wrap. | §C row 19 · §E risk 6 · §D Wave 1E task 19 |
| D-EVENTSTORE-1 | 4 May 2026 | Supabase event store from Wave 1A onwards. No localStorage shortcuts at any tier. `src/engine/eventStore.js` adapter wraps Supabase client. PLAN_COMMITMENT writer + reader is the Wave 1A gating capability. Schema authority: `parts/3-Engine/3-Engine-supabase-event-store-schema-v1_0.md`. | §A task 4/5 · §D Wave 1A pre-task + items 4, 5 · §D Wave 1B item 7, 9 · §E risk 3, 5, 10 · §G approval task 1 · §F failure modes |
| D-QUALITY-BAR-1 | 4 May 2026 | First-round build target 85–90% ready. Atomic refactors over shims. TimeWindowSelector window-ID refactor is atomic in-place — single coordinated commit, no shims, no backward-compat aliases. fq-calculator.js Wave 1A stub-replacement is one-time founder-approved exception to the EXTEND-ONLY rule. | §B task 8 · §D Wave 1C task 12 · §E risk 1, 12 |

---

**Status:** DOCUMENTED · founder-approved (3 decisions absorbed at v1.1)
**Maintainer:** founder + Phase 1 lead agent
**Last updated:** 2026-05-04 (v1.0 → v1.1 same-day version bump per skill v1.3 §13.9)
