# CLAUDE CODE INSTRUCTIONS — SONUSWEALTH PROJECT

You are operating in Track A (Claude Code · terminal) per finio-skill-v1_2.md §13.

## SESSION HANDOVER — last updated 2 May 2026 (A-homeV2-1 complete)

### Track B state (read this — Track B is AHEAD of CLAUDE.md)
- Latest tracker: `finiotracker-v5_22.md` (A-homeV2-1 Track A session)
- Latest foundation: `finio-foundation-v1_5.md`
- Latest arch master: `10-AllClusters-architecture-master-v1_2.md`
- **Track B next: B-perspec-patch-1 (section-number patch) — unblocked**
- **Track B demo: B-bruce-1 — unblocked (A6 complete)**

### CODE-TRACKER.md — NEW source of truth for build progress
- Created 1 May 2026 at `CODE-TRACKER.md` in repo root
- Tracks all phases P2–P8 with function-level status
- Shows interdependencies and critical path
- **Read this file at session start for current state**

### What is COMPLETE (Track A)

| # | Item | Notes |
|---|------|-------|
| A0.5 | D-RISK-BOUNDARY-1 verification | riskScore=60 boundary confirmed |
| A1 | `fundedRatio(entity, cma)` | `src/engine/fq-calculator.js` · FP-4 coverage · regression baseline |
| A2 | `HomeV2.jsx` | commit 899972d · matches preview.html · RadarChart redesigned |
| A5.5 | Mr T fixture suite — all 13 | `6.Finio/1-Clusters/3-Engine/mrT-*.json` · all pass R08 |
| P1.2 | R08 CLI validator | `tests/r08-validate.js` · `npm run test:r08` · 6 phases |
| **P2** | **6 foundational engine functions** | `calcAge` · `calcStateP` · `calcNetWorth` · `calcInvestable` · `calcGuardrail` · all 8 active R08 functions pass 0 failures across all 13 fixtures |
| **P3** | **9 cashflow engine functions** | `src/engine/cashflow-engine.js` · CF1–CF9 · 9/9 smoke pass · R08 0 failures · dual-path entity fix |
| **P4** | **19 Tax & Estate engine functions** | `src/engine/tax-estate-engine.js` · commit 2082256 · R08 0 failures · tax-2026.json rates fixed |
| **P5** | **Risk + Scoring suite** | `src/engine/risk-engine.js` · 4 functions · R08 0 failures · `financialProfile()` cell names patched |
| **A3 / P6** | **Monthly Flow engine** | `src/engine/monthly-flow-engine.js` · commit 9fdc381 · 35/35 smoke tests · HomeV2 FlowSection wired |
| **A5 Home suite** | **7 of 7 Home engine functions** | `src/engine/home-engine.js` · 68/68 smoke pass · C98 `stateTileJourney` ported in reconcile from romantic-feistel |
| **A5 Timeline suite** | **5 of 5 Timeline engine functions + Scenario CRUD stubs** | `src/engine/timeline-engine.js` · `calcAPQTimeline` · `calcMilestones` · `calcGoalProgress` · `calcScoreHistory` · `calcRiskHistory` · in-memory Scenario CRUD (Supabase persistence at Phase 2) |
| **A5 State-tiles** | **4 state-tile engine functions** | `src/engine/state-tiles-engine.js` · `safetyNetState` · `debtFreeState` · `fiState` · `beneficiaryState` · D-MM-7 decided per foundation v1.3 · Q-F PLSA fix is PROD-blocker not demo-blocker |
| **A5.5** | **Visual QA — all 13 Mr T fixtures** | `tests/visual-qa.js` · commit f9c95fb · R08 0 failures · visual-qa 56 checks 0 hard failures · 2 known gaps (aged-out floor · beneficiary inherited pension) flagged for Track B |
| **A6** | **Bruce Home wired** | commit 9892f57 · `calcAPQ → liveAlerts → wireEntity` · `costOfInaction` alias fixed · build 0 errors · 474KB |
| **A7** | **Supabase setup complete** | 7 tables · 17 indexes · 4 views · 3 RLS policies · `src/lib/supabase.js` · sonuswealth-dev project |
| **A-homeV2-1** | **HomeV2 + TaxEstate fixes** | Radar NODE_R fix · DimensionSheet z-stack fix · IHT multi-drawdown · back nav all screens · typography cleanup · 491KB |

### P3 cashflow functions built (29 April 2026)
- `swrRegime` · `guytonKlinger` · `maxDrawdownExposure` · `sequenceOfReturnsVulnerability` · `probabilityOfSuccess` · `portfolioEfficiency` · `prcPccSpread` · `realityEngineFactorisation` · `fiveCashflowScenarios`
- CMA bundle: `src/rules/cma-2026.json` (UK-CMA-2026.1)
- Dual-path entity fix: `_assetVals()` helper reads both simple-path (`a.sipp.total`) and complex-path (`a.pensions[]`) entity formats
- CF7 `prcPccSpread`: handles `Decision[]` (v1.1) and single decision object (backward-compatible)
- CF8 `realityEngineFactorisation`: confidence always LOW at v1.0 per spec §22.5
- CF9 `fiveCashflowScenarios`: uses 100 MC runs per scenario (500 on standalone CF5 calls)

### P4 Tax & Estate functions built (29 April 2026)
- Tax sub-tab: `taxThisYear` · `incomeTaxDetail` · `nicsDetail` · `cgtDetail` · `dividendTaxDetail` · `allowanceTracker` · `taxDrag` · `drawdownMatrix`
- Estate sub-tab: `ihtExposure` · `ihtWaterfall` · `giftClockProjection` · `trustPeriodicCharge` · `trustContribution` · `taxAndEstateImpact` (DUAL-IMPACT) · `nominationStatus` (full) · `beneficiaryChain` · `rnrbTaper` · `bprClock` · `bprQualifyingValue` · `selfAssessment` · `willLpaStatus`
- CoI + new: `costOfInaction` (rich structured object · `byAction.sortedByPriority` per T&E v1.1 §17.4) · `bprAllowanceTracker` (v1.1 NEW)
- Rules fixed: `tax-2026.json` — dividend +2pp (0.1075/0.3575) · BADR 18% · APR/BPR £2.5m combined allowance
- Refactor: `costOfInaction` in `fq-calculator.js` renamed to `ihtSippDelta` (scalar) to avoid collision · `cashflow-engine.js` import alias updated
- Known gap: `costOfInaction` missing `sourceEvents` + `lastRecomputed` fields (arch master §13) — no current consumer needs them · add at s02a screen build

### P5 Risk + Scoring functions built (29 April 2026)
- `runShock(entity, shockId, bundle)` — 5 shocks × 3-metric output (NW delta · FQ delta · RS delta)
- `riskShockSuite(entity, bundle)` — all 5 shocks in one call, keyed by shockId
- `whatWouldHelpMost(entity, shockId)` — mitigation ranking sorted by most-reduces-impact (D-RISK-12)
- `projectBTR(entity, months, engagementLevel)` — D7 BTR trajectory simulation (low/medium/high)
- Shock IDs: `job_loss` · `illness` · `market_fall` · `rate_rise` · `death`
- O-RISK-16: `lowDataWarning` flag fires when data completeness < 60% (threshold pending founder sign-off)
- `financialProfile()` patched: cell names → v1.1 §4.9 canonical list · key format → `exceptional_exposed` · `chipName` field added for D-RISK-1 chip display

### A3 / P6 Monthly Flow functions built (29 April 2026)
- `monthlyFlow(entity)` → `{ monthlyIncome, monthlyExpenses, surplus, surplusAnnual, components{}, allocationPressure{}, statePensionInPayment, confidence, rulesVersion }`
- `allocationPressure(entity)` → convenience wrapper returning `{ debtServiceRatio, commitRatio, liquidMonths }`
- State pension in-payment: uses explicit `inPayment` flag first; falls back to `age >= startAge`
- Expense proxy: `entity.expenses.monthly` if set; else `entity.targetIncome / 12`
- Confidence: HIGH (real income + explicit expenses) · MEDIUM (real income only) · LOW (no income sources)
- Demo: Bruce shows **−£10k/month deficit** (no drawdown, no active income) → motivates drawdown conversation
- HomeV2 `FlowSection` wired to engine — real surplus/deficit + real allocation pressure bars
- Also fixed: pre-existing `costOfInaction → ihtSippDelta` import in HomeV2.jsx
- Build errors fixed in A6: `costOfInaction` backward-compat alias re-added to `fq-calculator.js` — Ask/MyMoney/TaxEstate/HomeScreen now build clean

### A5 Home suite functions built (30 April 2026)
- `computeSinceLastVisit(entity, since)` — C97 · daily delta strip · biggestMover · biggestEvent · mostUrgentChange (CoI-based)
- `whatActionWouldItTake(entity, targetScore, targetMonth)` — C99 · greedy APQ inverse-solve · feasibility + action set
- `compositeTrajectory(entity, range, includeCohort, includeFan, scenarios)` — C100 · 4-layer (yourLine · cohortMedian · projectedFan log-normal · scenarios)
- `cohortRankHistory(entity, cohort, range)` — C101 · deterministic stub · confidence LOW · cohort data post-launch
- `realityEngineState(entity, bundle)` — C102 · 3-ring (personal · system · external) · O-HOME-1 defaults applied
- `prcPccCurrent(entity)` — C103 · thin extract from `prcPccSpread` · for Home micro spread bar
- `stateTileJourney(entity, tile, projectionHorizon)` — C98 · ported from romantic-feistel in reconcile · routes to state-tiles-engine functions · CoI-of-delay for `fi` and `beneficiary` tiles only (per spec §16.3)
- `_nw()` helper: `calcNetWorth(entity).net || netWorth(entity)` — handles both simple-path and complex-path entities

### A5.5 Visual QA results (30 April 2026)
- **R08**: 0 failures across 8 active functions × 13 fixtures
- **visual-qa**: 56 range checks · 0 hard failures · 2 known gaps annotated:
  - `mrT-aged-out` FQ/Risk: FINIO-1.0 scoring floor (~46) exceeds fixture expected range [18,35] — fixture ranges predate current floors — Track B to update
  - `mrT-beneficiary` FQ: inherited SIPP (340k) triggers maximum estate CoI penalty + momentum -0.30 — engine doesn't differentiate inherited vs own SIPP — Track B decision needed
- Adapter fixes applied: `value_gbp` property field · trust_status `startsWith('in-trust')` · `relevant-life-policy` → lifeInsurance · `dividend_income_annual` to total income · `income_band_uk` field · cross-border field variants

### A6 Bruce Home wired (30 April 2026)
- `Dashboard.jsx`: `calcAPQ(entity) → liveAlerts → wireEntity = { ...entity, alerts: liveAlerts }` → passed to HomeV2
- Alert format: `{ level, colour, badge, days, headline, context, action, screen }` — matches HomeV2 SignalStrip/NextAction/AlertCards contract
- `fq-calculator.js`: `costOfInaction` backward-compat alias added → fixes Ask · MyMoney · TaxEstate · HomeScreen imports
- Build: 0 errors · 474KB · all 48 modules transform clean
- Visual verify: pending (Chrome extension unavailable at session close) — navigate to `localhost:5175` to confirm

### A7 Supabase setup (1 May 2026)
- **Project:** sonuswealth-dev (`yknnfglfbpcyxcllrvmd.supabase.co`)
- **Schema deployed:** 7 tables · 17 indexes · 4 views · 3 RLS policies
- **Tables:** `finio_entities` · `finio_entity_relationships` · `finio_events` · `finio_bundle_snapshots` · `finio_scheduled_activations` · `finio_user_connections` · `finio_cma_bundle`
- **Client:** `@supabase/supabase-js` installed · `src/lib/supabase.js` configured
- **Env:** `.env.local` has `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
- **Migrations:** `supabase/migrations/001-010*.sql` (individual) + `000_all_migrations_combined.sql`
- **Unblocked:** Rules Management API (15 functions) · Timeline Scenario CRUD persistence

### A-homeV2-1 HomeV2 + TaxEstate fixes (2 May 2026)
- **Radar fix:** NODE_R 174→142 — nodes now fit inside 338px container
- **DimensionSheet fix:** Moved fixed overlays outside scrollable container using React fragment — z-stack works correctly
- **IHT multi-drawdown:** Rebuilt IHTPlanner with add/remove entries + purpose dropdown (6 categories: Living expenses · Tax-free lump sum · Home improvements · Gifting strategy · Care costs provision · Other)
- **Back navigation:** Added "← Home" button to TaxEstate · Risk · Plan · Ask screens
- **Typography:** Replaced hardcoded fontWeight 780/820/830/850/880/900 with WEIGHT tokens in HomeV2 + RadarChart
- **Score Journey:** Added explanation text: "Your projected score over the next 12 months..."
- **OrbitView:** Made drillable (onDimTap wired)
- **Light theme:** Added CSS classes `themed-card` · `themed-card-hero` — component refactor still needed (O-THEME-1)
- **Build:** 491KB · passes
- **Decisions:** D-IHT-1 (multi-drawdown) · D-NAV-1 (back buttons) · D-SHEET-1 (fragment z-stack)

### R08 status — 30 April 2026 (A5.5 complete)
- **8/41 ACTIVE** · 0 failures · 33 stubs pending
- Active: `fundedRatio` · `calcNetWorth` · `calcInvestable` · `calcGuardrail` · `calcAge` · `lifeStageFor` · `calcStateP` · `incomeTax`
- R08 tolerance: `Math.max(50000, midpoint × 20%)`
- Note: R08 stub names (`calcIHT`, `calcNRB` etc.) predate final function names — stubs are stale labels, not failures
- visual-qa.js: 56 range checks · 2 annotated gaps (aged-out floor · beneficiary inherited SIPP) · 0 hard failures

### What to build next (Track A)

Critical path to IFA demo (20 May 2026): **Design review → UI primitives → static screens → wire**

**Supabase COMPLETE** (1 May 2026) — 7 tables, client configured, Rules API unblocked.

| Priority | Task | Gate |
|---|---|---|
| ~~Cleanup~~ | ~~Delete `HomeScreenJit.jsx` + `.backup`~~ | ✅ Done |
| ~~P3~~ | ~~Cashflow suite (9 functions)~~ | ✅ Done |
| ~~**P4**~~ | ~~Tax & Estate suite (19 functions)~~ | ✅ Done |
| ~~**P5**~~ | ~~Risk + Scoring suite~~ | ✅ Done |
| ~~**A3 / P6**~~ | ~~Monthly Flow engine~~ | ✅ Done |
| ~~**A5**~~ | ~~Remaining engine functions~~ | ✅ Done — Home 7/7 · Timeline 5/5 · State-tiles 4/4 |
| ~~**A5.5**~~ | ~~Mr T fixture QA~~ | ✅ Done · 2 gaps logged for Track B |
| ~~**A6**~~ | ~~Bruce Home wired~~ | ✅ Done · merged PR #1 · live on Vercel |
| ~~**P3.1 Design review**~~ | ~~Flag 3 weakest decisions~~ | ✅ Done (A-homeV2-1) |
| **NEXT: A-polish-1** | Visual polish pass · remaining typography · light theme component refactor | After user testing |
| **P3.2 UI primitives** | `<Number />` · `<DepthCard />` · `<TripleAnchor />` | After P3.1 · gates all screens |
| **P4.1 HomeV2 review pass** | Fix "Finio Score" label → "Sonuswealth Wealth Score" · spec drift corrections | After P3.2 |
| **P4.2 MyMoney screen** | Static first · founder visual sign-off · then wire to engine | After P4.1 |
| **P4.3 Cashflow screen** | Static → wire | After P4.2 |
| **P4.4 Tax & Estate screen** | Static → wire | After P4.3 |
| **P4.5 Timeline screen** | Static → wire | After P4.4 |
| **P4.6 Risk overlay** | Static → wire | After P4.5 |
| **P4.7 Settings screen** | Static → wire · blocked O-SET-G + O-SET-H + O-SET-13 | After P4.6 |
| **P4.8-P4.9 Reports** | R01 + R07 templates · blocked O-REP-1 | After P4.7 |
| ~~**Supabase setup**~~ | ~~Database, schema, event store~~ | ✅ Done (A7) |
| **Rules Management API (15 fns)** | Engine stubs → real implementation | **UNBLOCKED** |
| **Aggregator interface** | IAggregator + AggregatorRegistry | After Rules API |
| **B-bruce-1** | Bruce demo prep · 6 engagement modes | Track B — UNBLOCKED NOW |

**See CODE-TRACKER.md for detailed function-level status and interdependencies.**

### Open decisions blocking Track A

| ID | Decision | Urgency |
|----|----------|---------|
| Q-B9-1 | Beneficiary group vs modifier | Before classifier CODED |
| O-SET-13 | Recalculation lock UX | Before Settings.jsx |
| O-REP-1 | Paged.js vs browser native PDF | Before Reports build |
| **O-THEME-1** | Light theme component refactor — inline styles use hardcoded dark RGBA | Before light theme gate |
| **O-MM-TXE-1** | MyMoney + TaxEstate fontWeight:900 → WEIGHT.bold | Polish pass |

### Key files

- **`CODE-TRACKER.md`** — master build progress tracker · phases P2–P8 · interdependencies · created 1 May 2026
- `src/engine/fq-calculator.js` — foundational engine (8 active functions) · `ihtSippDelta` · `financialProfile()` (v1.1 §4.9 cell names · key format `fq_rs`)
- `src/engine/home-engine.js` — Home suite (7 functions · A5 complete) · C97 C98 C99 C100 C101 C102 C103
- `src/engine/timeline-engine.js` — Timeline suite (5 functions + scenario CRUD stubs · A5 complete)
- `src/engine/state-tiles-engine.js` — 4 state-tile engine functions (A5 complete)
- `tests/reconcile-smoke.js` — integration smoke for timeline + risk + state-tiles + C98 (21/21)
- `tests/visual-qa.js` — 13-fixture visual QA · `npm run test:qa` · 56 checks
- `tests/r08-validate.js` — R08 CLI · `npm run test:r08` · 0 failures
- `src/engine/cashflow-engine.js` — cashflow engine (9 functions · P3 complete)
- `src/engine/tax-estate-engine.js` — tax & estate engine (19 functions · P4 complete)
- `src/engine/risk-engine.js` — risk shock + BTR engine (4 functions · P5 complete)
- `src/engine/monthly-flow-engine.js` — monthly flow engine (2 functions · A3 complete)
- `src/rules/tax-2026.json` — UK tax rules bundle (UK-2026.1 · rates verified 29 Apr 2026)
- `src/rules/cma-2026.json` — UK Capital Market Assumptions bundle (UK-CMA-2026.1)
- `src/screens/HomeV2.jsx` — home screen ✅ · alerts engine-driven (A6)
- `src/screens/Dashboard.jsx` — routes entity + wireEntity · calcAPQ alert wiring (A6)
- `regression-baselines/baseline-FINIO-1.0-UK-2026.1.json` — regression anchor (persona-b riskBand=Protected)
- `src/lib/supabase.js` — Supabase client + table/view constants (A7)
- `supabase/migrations/` — 10 migration files · schema spec §7

### Ground truth design file
`C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\Codex\2904 codex\preview.html`

### Dev server
`npm run dev` — port 5173 (or 5174)

---

## PRODUCT NAME

**Sonuswealth** — formerly "finio" during development. Never use "finio" in user-facing output, UI strings, or code comments.
Score product: **Sonuswealth Wealth Score** · Consumer phrase: **My Wealth Score**
Punchline: *Know your wealth. Raise your score.*
Strapline: *A calmer way to see, score, and grow your financial world.*

---

## READ FIRST (in this order)

1. `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\finio-foundation-v1_5.md` — current foundation · WHAT
2. `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\finio-skill-v1_2.md` — current skill · HOW
3. `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\finiotracker-v5_22.md` — current tracker · sequencing
4. The relevant per-tab spec for the current task (see REFERENCE: SPEC FILES table below)
5. `design-references/INDEX.md` then the relevant Sonuswealth design file(s)

These five sources are authoritative. Foundation + skill + tracker are loaded automatically into Claude.ai chat sessions; you must read them yourself at session start in Claude Code.

---

## YOUR FILE OWNERSHIP (skill §13.2)

You **WRITE** only:
- `/src/**/*` (source code)
- `/tests/**/*` (tests)
- git history

You **NEVER write**:
- `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\**\*.md` — all specs, foundation, skill, tracker, handover, SSR are Claude.ai chat owned
- `/design-references/**/*` — Track B chat owns these
- `HomeScreen.jsx` radar component — Jit-owned · skill §10

---

## EVERY BUILD SESSION OPENS WITH 5 PHASES (skill §6 + §1.5)

| Phase | Action |
|-------|--------|
| 0 | Up to 3 clarifying questions where the answer changes scope. If none, skip. |
| 1 | Spec discovery — list features touched · governing spec for each |
| 2 | Code audit — read relevant files · identify defects against spec |
| 3 | Scope proposal — what this session fixes · what defers |
| 4 | Wait for founder approval — do not build until "confirmed — start with X" |

---

## BEFORE EVERY COMMIT — 5-POINT SELF-VERIFICATION (skill §5.5)

1. Engine functions only — no tax/IHT/score/net-worth calculation inline in components
2. `fmt()` for currency — no `` `£${value}` `` direct interpolation
3. No hardcoded thresholds — all values from `tax-2026.json` / rules bundle / params
4. Under 300 lines per component file — split into sub-components if approaching
5. Backup before edit — timestamped ZIP + README before screen file edit · founder confirms

If any check fails, the session is not complete. Fix or revert.

---

## SYNCHRONIZATION TRIGGERS — STOP AND SURFACE TO CHAT WHEN (skill §13.4)

- Code requires an engine function not yet specified — spec change first
- Code requires a rules-bundle value not yet captured — bundle update first
- Code requires a screen layout decision not in the spec — spec section first
- Code touches `HomeScreen.jsx` radar component — Jit-owned · never overwrite
- Code requires an architectural decision (cascade halo · breadcrumb pattern) — arch master v1.1 governs
- 5-point self-verification fails on any check — stop · fix in chat first if scope was wrong

---

## DEPLOY DISCIPLINE (skill §8)

Three commands: `git add .` · `git commit -m "..."` · `git push`.
Vercel auto-deploys within 60 seconds.
**NEVER push to main without explicit founder confirmation.**
Branch-and-PR workflow when uncertain.

---

## VISUAL ANALYSIS HABIT (skill §14)

After every component render or material edit: screenshot at 480px viewport.
Founder posts screenshot to chat: *"Verify against [spec section] and Sonuswealth design [filename]. Flag any drift on layout · spacing · colour · typography · interaction."*
Fix all drift before next commit.

**DESIGN SELF-CRITICISM (applies from A2 onwards):** At the start of each screen-build session, apply best-judgement self-criticism to the Sonuswealth design files in `design-references/`. Identify the 3 weakest design decisions, state why, and propose improvements. Surface to Opus chat for review before committing to any screen code.

---

## OUTPUT REFINEMENT HABIT (skill §2.4)

After substantive first-pass output (engine function · component code · contested decision):
1. State three weakest points
2. Propose a rewrite addressing them
3. Hand both versions back · founder picks or merges

---

## NON-NEGOTIABLES (foundation §3.4 / skill §9)

- Engine is source of truth · screens are presentation only
- 5-tab navigation locked: **Home · MyMoney · Cashflow · Tax & Estate · Timeline**
- Risk-as-layer (overlay · not a tab)
- Triple-anchor: Net Worth + Sonuswealth Wealth Score + Risk Score · equal weight
- Six jurisdictions: UK · India · Thailand · Canada · Ireland · Australia · **NO USA**
- Dark mode default · Apple-style light mode (deep graphite / soft blue / white · mist / slate / calm blue)
- No hardcoded product name in code — use `{{PRODUCT_NAME}}` token (resolves to "Sonuswealth" / "Sonuswealth Wealth Score" at render time)
- No hardcoded tax rules · jurisdictions · language assumptions
- Every entity is a first-class object · event-sourced state · effective dates · never overwrite
- Storage: Supabase Postgres — schema spec at `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\3-Engine\3-Engine-supabase-event-store-schema-v1_0.md`
- Deployment: Vercel auto-deploys on git push to main

---

## ADDITIONAL TIPS

**Tip 1 — 95% confidence rule (Nat):** Before building anything, ask clarifying questions until you are 95% confident you understand the full scope, have all data you need, and can implement without hitting unknown blockers. Starting at 70% confidence causes rework and session waste. The 5-phase build opener (§6) is the mechanism — Phase 0 questions are how you reach 95%.

---

## REFERENCE: ENGINE FUNCTION QUEUE

42 functions in s02a Phase 2 queue.
Full list: foundation v1.1 §6.3 + arch master v1.1 §30.
Arch master: `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\10-All Clusters\10-AllClusters-architecture-master-v1_1.md`

Build in dependency order. **First function to build: `fundedRatio()` per CF v1.1 §4.6.**
Gate: A0.5 D-RISK-BOUNDARY-1 propagation verification against `fq-calculator.js` must pass before A1.

---

## REFERENCE: SPEC FILES

All specs live at: `C:\Users\Mihir Patel.Mihir\My Drive\All Work\6.Finio\1-Clusters\`

| Spec | File | Round-2 status |
|------|------|----------------|
| Foundation | `finio-foundation-v1_5.md` | ✅ v1.5 (current · 2 May) |
| Skill | `finio-skill-v1_2.md` | ✅ v1.2 |
| Tracker | `finiotracker-v5_22.md` | ✅ v5.22 (current · 2 May) |
| Architecture Master | `10-All Clusters/10-AllClusters-architecture-master-v1_1.md` | ✅ v1.1 |
| Cashflow | `2-Product/2-Product-cashflow-v1_1.md` | ✅ round-2 done |
| Home | `2-Product/2-Product-home-v1_1.md` | ✅ round-2 done |
| MyMoney | `2-Product/2-Product-mymoney-v2_1.md` | ✅ round-2 done |
| Tax & Estate | `2-Product/2-Product-tax-estate-v1_1.md` | ✅ round-2 done |
| Timeline | `2-Product/2-Product-timeline-v1_1.md` | ✅ round-2 done |
| Risk Layer | `2-Product/2-Product-risk-layer-v1_1.md` | ✅ round-2 done |
| Onboarding | `2-Product/2-Product-onboarding-v1_0.md` | ✅ round-2 done (B9) |
| Settings | `2-Product/2-Product-settings-master-v1_1.md` | ✅ round-2 done (B10) |
| Data Capture | `2-Product/2-Product-data-capture-v1_1.md` | ✅ round-2 done (B11) |
| Archetypes | `2-Product/2-Product-archetypes-v1_0.md` | ✅ v1.0 |
| Mr T Fixtures | `3-Engine/3-Engine-mrT-fixture-spec-v1_0.md` | ✅ v1.0 |
| Supabase Schema | `3-Engine/3-Engine-supabase-event-store-schema-v1_0.md` | ✅ v1.0 |

---

## NEW WORKFLOW (2 May 2026)

**Problem:** Previous workflow (build → founder review → find issues → rework) was slow and frustrating.

**New workflow:**

| Phase | Who | What |
|-------|-----|------|
| A. Design Lock | Claude | Generate SCREEN-CONTRACT.md with all cards, graphs, data sources, journeys |
| B. Batch Review | Founder | Review ALL screen contracts in one session, approve/reject |
| C. Build All | Claude | Build all approved screens in one batch |
| D. Test Script | Claude | Write comprehensive test script for DeepSeek |
| E. DeepSeek QA | DeepSeek | Run test script, report failures |
| F. Fix Loop | Claude | Fix failures until 0 |

**Contract file:** `SCREEN-CONTRACT.md` in repo root — contains full specification for all 10 screens.

---

## ADDITIONAL REQUIREMENTS (2 May 2026)

### Security & Auth (full lifecycle)

| Feature | Status | Notes |
|---------|--------|-------|
| Account creation | NOT BUILT | Email → verify → password → optional 2FA/biometric |
| Login | NOT BUILT | Email+password / passkey / biometric / magic link |
| 2FA setup | NOT BUILT | TOTP app, backup codes |
| FaceID/TouchID | NOT BUILT | Biometric enrollment |
| Passkey management | NOT BUILT | WebAuthn registration |
| Password recovery | NOT BUILT | Email reset flow |
| Session management | NOT BUILT | Active sessions, revoke |
| Step-up auth matrix | SPEC DONE | Settings v1.1 §17 |
| Document Vault security | NOT BUILT | L1/L2 step-up per action |

### Billing (Settings S9)

| Feature | Status | Notes |
|---------|--------|-------|
| Plan display | NOT BUILT | Current tier, features |
| Payment method | NOT BUILT | Card on file, update |
| Invoices | NOT BUILT | History, download |
| Plan change | NOT BUILT | Upgrade/downgrade |
| Cancellation | NOT BUILT | With grace period |

### Parallel Work

HubSpot setup can run in separate Claude Code terminal — no conflicts with screen builds.

### Onboarding

Build last — demo can use persona-select bypass.

---

## KEY FILES FOR NEW WORKFLOW

- `SCREEN-CONTRACT.md` — master contract for all screens (approve before build)
- `tests/screen-tests.js` — comprehensive test script for DeepSeek (TBD)
- `tests/e2e/` — end-to-end journey tests (TBD)

---

— end of CLAUDE.md —
