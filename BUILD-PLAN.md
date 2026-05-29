# SONUSWEALTH — BUILD PLAN

> This file tells GSD what to build, in what order, and how to verify each piece.
> Use with `/gsd:execute` or feed to Agent Teams as the task list.

---

## OVERVIEW

Three waves, executed in order. Each wave can run agents in parallel within the wave, but waves run sequentially. Wave 0 must finish before Wave 1 starts. Wave 1 must finish before Wave 2 starts.

**Why this order matters:** Wave 0 creates the engine functions that Waves 1 and 2 consume. Wave 1 builds the simpler screens. Wave 2 builds the complex screens that depend on Wave 1 data patterns.

```
Wave 0: Engine extensions (1 agent, ~2 hours)
   ↓ must complete first
Wave 1: Simple screens (5 agents in parallel, ~4 hours)
   ↓ stabilise + verify
Wave 2: Complex screens (3 agents in parallel, ~6 hours)
   ↓ stabilise + verify
Integration test pass
```

---

## WAVE 0 — ENGINE EXTENSIONS

**Branch:** `wave-0-engine`
**Agent count:** 1 (sequential — engine is one file)
**Model:** Opus
**Estimated time:** 2 hours

### What this agent does

Extends `src/engine/fq-calculator.js` with stub functions that Wave 1 and Wave 2 screens need. These are function signatures with placeholder return values — the real calculation logic comes later. The point is to give screen agents something to import.

### Spec reference

Foundation v1.8 §6.3 lists all ~74 engine functions. The existing file already has ~20 working functions. This wave adds stubs for the rest.

### Tasks

**Task 0.1:** Read existing `fq-calculator.js` completely. List every exported function. Do not modify anything yet.

**Task 0.2:** Add time-window functions (X28):
```javascript
// Stub signatures — return sensible defaults
export function getTimeWindow(entity) { return { id: 'current-tax-year', start: '2026-04-06', end: '2027-04-05', label: 'Tax Year 2026/27' }; }
export function getViewMode(entity, screen) { return 'actual'; }
export function applyTimeWindow(data, window, aggregation) { return data; }
```

**Task 0.3:** Add plan functions:
```javascript
export function planFor(entity, planType) { return null; } // null = no active plan
export function commitPlan(entity, planType, planData) { return { id: 'plan-stub', committed: true }; }
export function planStaleness(entity, planType) { return { stale: false, severity: 'none' }; }
export function planConflicts(entity) { return []; }
```

**Task 0.4:** Add forecast and variance functions:
```javascript
export function forecastFor(entity, metric, window) { return []; }
export function varianceFor(entity, mode, window) { return { variance: 0, direction: 'neutral' }; }
```

**Task 0.5:** Add diff/causality functions (X29):
```javascript
export function diffSet(entity, sinceTimestamp) { return []; }
export function causalityChain(entity, metricChange) { return { chain: [], plainEnglish: 'No changes detected' }; }
export function acknowledgeDiff(entity, diffId) { return true; }
```

**Task 0.6:** Add action/goal-seek functions (X24):
```javascript
export function actionsForAssetType(assetType) { return []; }
export function actionsForComponent(entity, componentId) { return []; }
export function simulateAction(entity, action) { return { netWorthDelta: 0, scoreDelta: 0, riskDelta: 0 }; }
export function goalSeek(entity, targetMetric, targetValue, targetWindow) { return []; }
export function solveForVariables(entity, fixedMetrics, freeVariables, target) { return []; }
export function rippleEffect(entity, change) { return []; }
export function lifeEventPaths(entity, targetMetric, targetValue) { return []; }
export function aiFollowUp(entity, committedAction) { return { suggestion: null }; }
```

**Task 0.7:** Add pride/celebration functions (X26):
```javascript
export function milestoneCheck(entity) { return []; }
export function streakCheck(entity) { return { active: false, days: 0 }; }
export function celebrationTrigger(entity, event) { return null; }
```

**Task 0.8:** Add estate functions (X27):
```javascript
export function beneficiaryAnalysis(entity) { return { beneficiaries: [], effectiveRate: 0 }; }
export function giftClockAll(entity) { return []; }
export function estateReadinessIndex(entity) { return 0; }
```

**Task 0.9:** Verify all exports. Run `npm run build` to confirm zero errors. Every new function must be exported. Every existing function must still work unchanged.

### Verification checklist
- [ ] `npm run build` passes with zero errors
- [ ] All existing functions unchanged (compare with backup)
- [ ] All new functions exported and importable
- [ ] No hardcoded financial values in stubs
- [ ] Each stub has a `// STUB: implement at s02a` comment
- [ ] No `eval()`, no `dangerouslySetInnerHTML`, no secrets

---

## WAVE 1 — SIMPLE SCREENS (5 AGENTS IN PARALLEL)

**Branch:** `wave-1-screens`
**Agent count:** 5 (parallel — no file conflicts between agents)
**Model:** Sonnet (Opus for Agent F if budget allows)
**Estimated time:** 4 hours per agent, running simultaneously

### Agent A — Home Screen

**Output files:** `src/screens/HomeScreen.jsx` + sub-components in `src/components/Home/`
**Spec:** `2-Product-home-v1_3.md` (zones Z1–Z14)
**Must read:** CLAUDE.md (this project file) + Home spec + `fq-calculator.js`

**CRITICAL:** HomeScreen.jsx already exists with Jit's radar component. **Do not delete or overwrite the radar.** Build around it. If unsure which part is the radar, look for the radar/spider chart visualisation and leave it exactly as-is.

**Key requirements:**
- Triple anchor at top (NW + Wealth Score + Risk Score)
- 14 zones per spec, scrollable
- Each zone is a card following the 9-zone card anatomy (X12)
- Cost of Inaction strip always visible
- Time-window selector in top bar (7 windows per X28)
- Dark mode default, light mode supported
- All financial numbers via engine functions, formatted with `fmt()`
- Rules version label top-right
- Disclaimer at bottom

**Sub-components to create:**
- `src/components/Home/TripleAnchor.jsx` (shared — other screens import this)
- `src/components/Home/CostOfInactionStrip.jsx`
- `src/components/Home/TimeWindowSelector.jsx` (shared — other screens import this)
- `src/components/Home/ZoneCard.jsx` (reusable card wrapper)

**Verification:**
- [ ] Renders in browser without errors
- [ ] Triple anchor shows three numbers
- [ ] Radar component still works (Jit's code intact)
- [ ] Dark and light mode both work
- [ ] No hardcoded financial values
- [ ] Under 300 lines per component

---

### Agent B — Cashflow Screen

**Output files:** `src/screens/Cashflow.jsx` + sub-components in `src/components/Cashflow/`
**Spec:** `2-Product-cashflow-v1_3.md`

**Key requirements:**
- Triple anchor at top (import shared component from Home)
- Time-window selector (import shared component from Home)
- Income vs expenditure summary
- Cashflow surplus/deficit per period
- Charts: income/expense breakdown, surplus trend, runway projection
- State tiles: Safety Net months, Cashflow Health
- All charts use recharts library
- Drill-down overlays for each income/expense category
- CoI strip if deadline-affected cashflow exists

**Verification:**
- [ ] Renders without errors
- [ ] Triple anchor displays correctly
- [ ] At least one chart renders with persona data
- [ ] Time window selector works
- [ ] No inline financial calculations

---

### Agent C — Tax & Estate Screen

**Output files:** `src/screens/TaxEstate.jsx` + sub-components in `src/components/TaxEstate/`
**Spec:** `2-Product-tax-estate-v1_3.md`

**Key requirements:**
- Triple anchor at top
- Time-window selector
- IHT exposure summary (using `ihtDynamic()` from engine)
- Cost of Inaction prominent display (using `costOfInaction()`)
- Gift clock section (using `giftPct()` and `taperBand()`)
- SIPP projection chart (using `sippProjection()`)
- Pension drawdown optimisation section
- CGT summary
- Income tax summary
- Beneficiary analysis section
- Rules version label: "UK-2026.1"
- Disclaimer mandatory on this screen (tax content)

**Verification:**
- [ ] IHT numbers come from engine, not hardcoded
- [ ] Cost of Inaction displays correctly
- [ ] Gift clock shows elapsed percentage
- [ ] Disclaimer present at bottom
- [ ] Rules version label visible

---

### Agent D — Settings Screen

**Output files:** `src/screens/Settings.jsx` + sub-components in `src/components/Settings/`
**Spec:** `2-Product-settings-master-v1_5.md`

**Key requirements:**
- Personal details section
- Entity management (household members)
- Theme toggle (dark/light)
- Longevity band selector (conservative 85 / median 88 / optimistic 92)
- Notification preferences
- Data management (export, delete)
- Plans management section (list active plans, staleness indicators)
- Currency and jurisdiction display
- Step-up auth gates on sensitive sections (visual only at this stage)
- About / version info

**Verification:**
- [ ] Theme toggle switches between dark and light mode
- [ ] Longevity selector has three options
- [ ] Plans section renders (even if empty)
- [ ] No sensitive data logged to console

---

### Agent E — Onboarding Screen

**Output files:** `src/screens/Onboarding.jsx` + sub-components in `src/components/Onboarding/`
**Spec:** `2-Product-onboarding-v1_1.md`

**Key requirements:**
- 7 onboarding questions (not more, not fewer)
- Progress indicator showing question number
- Each question maps to archetype classification
- Smooth transitions between questions
- "Skip" option available (FP-4: works with what it has)
- Final screen shows initial Sonuswealth Wealth Score + Risk Score
- Routes to Home screen on completion
- Mobile-optimised (full-screen cards, large tap targets)
- No back-end yet — store responses in React state

**Verification:**
- [ ] Exactly 7 questions render
- [ ] Can complete flow start to finish
- [ ] Final screen shows scores
- [ ] Skip works without crashing
- [ ] Mobile layout looks correct at 380px width

---

## WAVE 1 — STABILISATION (after all 5 agents complete)

Before starting Wave 2, run these checks:

1. `npm run build` — must pass with zero errors
2. Open browser — all 5 screens must render
3. Navigation between screens works (bottom nav bar)
4. Theme toggle works globally
5. Triple anchor appears on Home, Cashflow, Tax & Estate
6. No console errors in browser dev tools
7. Shared components (TripleAnchor, TimeWindowSelector) used consistently

**Fix any issues before proceeding to Wave 2.**

---

## WAVE 2 — COMPLEX SCREENS (3 AGENTS IN PARALLEL)

**Branch:** `wave-2-complex`
**Agent count:** 3 (parallel — no file conflicts)
**Model:** Opus recommended (complex specs)
**Estimated time:** 6 hours per agent

### Agent G — MyMoney Screen

**Output files:** `src/screens/MyMoney.jsx` + sub-components in `src/components/MyMoney/`
**Spec:** `2-Product-mymoney-v2_3.md` (3,215 lines — the biggest spec)

**This is the most complex screen.** Read the full spec before starting.

**Key requirements:**
- Triple anchor at top
- Time-window selector
- Asset composition strip (visual breakdown of all assets by category)
- L1 category rows (Property, Pensions, ISA, Cash, Investments, Debt)
- L2 drill-down (tap a category → see individual assets)
- L3 drill-down (tap an asset → see full detail + simulation workspace)
- State tiles: Safety Net, Debt Free, FI Ratio, Beneficiary
- Income section
- CoI strip
- Universal add ("+") button — routes to add flow for any asset type
- Zero-state cards for empty categories
- All financial numbers from engine functions
- Event envelope on all data writes (with correlation_id)

**Sub-components (suggested split for 300-line rule):**
- `AssetCompositionStrip.jsx`
- `CategoryRow.jsx` (reusable for each L1 category)
- `AssetDetailOverlay.jsx` (L2/L3 drill-down)
- `StateTileRow.jsx` (Safety Net, Debt Free, FI, Beneficiary)
- `IncomeSection.jsx`
- `UniversalAddButton.jsx`

**Verification:**
- [ ] All asset categories render from persona data
- [ ] Drill-down opens on tap
- [ ] State tiles show calculated values
- [ ] Universal add button visible
- [ ] No inline financial calculations
- [ ] correlation_id on all events

---

### Agent H — Timeline Screen

**Output files:** `src/screens/Timeline.jsx` + sub-components in `src/components/Timeline/`
**Spec:** `2-Product-timeline-v1_3.md`

**Key requirements:**
- Triple anchor at top
- Time-window selector (LIFETIME is default on this screen)
- Visual timeline showing life events past and projected
- Net worth trajectory chart (three scenarios: conservative, median, optimistic)
- Life stage indicators (Foundation → Accumulation → Consolidation → etc.)
- Plan section (§E): active plans listed, staleness indicators
- Milestone markers on timeline
- Longevity band visualisation (three vertical lines at 85/88/92)
- "What if" scenario launcher

**Verification:**
- [ ] Timeline renders with life events
- [ ] NW trajectory chart shows three scenario lines
- [ ] Life stage labels appear at correct ages
- [ ] Longevity bands visible on LIFETIME view
- [ ] Plans section renders (even if empty)

---

### Agent I — Risk Overlay

**Output files:** `src/screens/RiskOverlay.jsx` + sub-components in `src/components/Risk/`
**Spec:** `2-Product-risk-layer-v1_4.md`

**IMPORTANT:** Risk is an overlay, NOT a tab. It slides over the current screen when activated from the triple anchor's Risk Score tile.

**Key requirements:**
- Overlay panel (slides in from right or bottom)
- Zone 1: Risk Score headline (always sticky)
- Zone 2: 5×5 cross-map (Wealth Score band × Risk Score band → cell name)
- Zone 3: 7-dimension radar chart (the dimensions, not Jit's radar on Home)
- Zone 4: Protection gap analysis
- Zone 5: Shock scenarios (3 scenarios with impact)
- Zone 8: Score history chart with own history picker (1/3/6/12 months)
- Zone 12: Protection plan anchor (conditional — only shows if plan exists)
- NO top-bar time-window selector (Risk is always point-in-time)
- Close button returns to previous screen

**Key architectural note:** Risk overlay does NOT have the X28 window selector. Risk Score is always "right now." The Zone 8 history picker is a standalone control, NOT the X28 system. Do not add the time-window selector to this overlay.

**Verification:**
- [ ] Overlay opens and closes correctly
- [ ] 5×5 cross-map renders with cell name
- [ ] 7-dimension radar chart displays
- [ ] No X28 top-bar selector present
- [ ] Zone 8 has its own history picker
- [ ] Protection gap section renders

---

## WAVE 2 — STABILISATION

1. `npm run build` — zero errors
2. All 8 screens render in browser
3. Navigation works end-to-end (Onboarding → Home → all tabs)
4. Risk overlay opens from triple anchor on any screen
5. MyMoney drill-downs work
6. Timeline trajectory chart renders
7. Theme toggle works on every screen
8. No console errors
9. Run through with Bruce Wayne persona — all sections populated
10. Run through with Hermione persona — thin file, zero-state cards shown

---

## POST-WAVE CHECKLIST

After all waves complete:

### D-SEC-BUILD-1 Layer 2 — CODED Gate (10 checks)
1. [ ] All Layer 1 rules verified across all files
2. [ ] No exposed environment variables in client bundle
3. [ ] CSP headers configured (in `index.html` or Vercel config)
4. [ ] Rate limiting on any API endpoints (when Supabase wired)
5. [ ] Input validation on all form fields
6. [ ] Error messages don't leak internal state
7. [ ] Auth token refresh handles expiry (when auth wired)
8. [ ] Supabase RLS policies confirmed (when wired)
9. [ ] No cross-entity data leakage via URL
10. [ ] `npm audit` — no known critical CVEs

### Final verification
- [ ] `npm run build` succeeds
- [ ] App loads at localhost:5173
- [ ] Full user journey: Onboarding → Home → each tab → Risk overlay → Settings
- [ ] Bruce Wayne persona: all sections populated, numbers make sense
- [ ] Hermione persona: thin file, graceful zero-states
- [ ] Dark mode and light mode both work
- [ ] No console errors or warnings
- [ ] All financial numbers come from engine functions
- [ ] No hardcoded currency values in components
- [ ] `fmt()` used everywhere
