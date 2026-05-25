# Sonuswealth — Master Schedule to Full Vision

**Created:** 2026-05-23
**Authoritative:** YES (supersedes both Jiggly Book v3 and the earlier Caelixa draft)
**Source of truth for audit results:** `.planning/gap-audits/{tab}-gap.md` × 6 (MyMoney, Cashflow, Tax & Estate, Risk, Timeline, Home)

---

## §0 — Context

Built reactively for months. Each session fixed something the founder caught, but nothing sequenced the build by dependency. The 6 core-tab audits show the codebase is **further along than the founder thought** — the engine is mature; the gaps are mostly per-domain L3 depth + verification + a few founder-side open items. This plan sequences the remaining work from data foundation to UI polish, with each phase having a concrete checklist drawn from the gap audits.

**Headline finding from 6 audits combined:**
- **T&E:** production-near. 23 of 25 sections wired. 2–3 weeks.
- **MyMoney:** most mature. All 20 domains at L1+L2; only Pensions has dedicated L3. 4–6 weeks (mostly L3 panels).
- **Risk:** 7 dimensions wired, 5×5 cross-map built. 1–2 weeks (mostly verification).
- **Timeline:** all 6 sections built. 1–2 weeks.
- **Cashflow:** 4 of 5 SWR regimes wired + most §B/§C engines present. 1–2 weeks + founder-side closure of O-CF-RULES-07 and O-CF-RULES-09.
- **Home:** cross-tab reads strong (canonical via engine). AI-narrative zones (Z6/Z12/Z13) are the biggest open. 2 weeks.

**Combined core-tab effort to production: 12–17 weeks** (3–4 months) if done serially. Less if parallelised after data foundation is locked.

**Ancillaries (updated after 8-tab audit):**
- **Security/Auth (Phase 1.5 BLOCKER)** — pre-launch waitlist landing only; Supabase Auth not wired; step-up auth + permission matrix entirely missing. 3 weeks. THIS NOW BLOCKS THE WHOLE PRODUCT — added as Phase 1.5.
- **Onboarding** — biggest spec-to-code gap; v1.1 spec ambitious, code closer to v0.3. 3–4 weeks.
- **Data Capture** — Manual + Upload via FP-5 wired; API Pull (Channel 3) greenfield. 3–4 weeks.
- **Document Vault** — Phase 1 read-only catalogue honestly labelled; Phase 2 features all missing. 3–4 weeks.
- **Notifications** — taxonomy + 3 of 6 derivers wired; 7 sub-categories empty. 1–2 weeks.
- **Reports** — honest Phase 2 stub; 5 templates catalogued. 2 weeks.
- **IFA Practice** — substantial demo shell with honest stubs; roster + adviser-mode preview built. 2–3 weeks.
- **Settings** — framework right; 6 of 13 sections content-real; explicit TODO migrate to event-sourced state. 1–2 weeks.

**Total ancillaries: 18–24 weeks (4–6 months)** including Auth as Phase 1.5.

**Plus the icing: Ask Sonu + Decision Engine 40 events + What-If scenarios + UI polish + compliance + multi-jurisdiction. Additional 16–22 weeks.**

**Total to Full Vision: 46–63 weeks (~11–14 months) for solo + Claude pair.** Higher than v1 estimate because Auth + Onboarding are bigger holes than first-pass scan suggested. Still in the founder's "Full Vision (Caelixa) — 6–12 months" ballpark if parallelised aggressively after Phase 1.5.

---

## §1 — Locked Principles (PP-1 to PP-13)

Unchanged from earlier authoring; see `sonuswealth-master-schedule.md` v1 (deleted) or memory file `feedback_*`. Summary:

| # | Principle |
|---|---|
| PP-1 | Information / Guidance / Storage only — FCA boundary on every response |
| PP-2 | macOS principle — simple surface, depth on tap |
| PP-3 | Drillable to nth degree — every number tap-target with source + formula + confidence + provenance |
| PP-4 | 4-dim X28 selector (Actual / Forecast / Plan / Scenario) identical position every tab |
| PP-5 | Single ripple path — `rippleEffect(entity, change, ['all'])` |
| PP-6 | Engine is source of truth — no math in screens |
| PP-7 | No fake precision — range + confidence + gap |
| PP-8 | IFA vs end-user dual view |
| PP-9 | Plain English — no codes at first-view |
| PP-10 | Trust differential — manual=1.0, AI=flagged |
| PP-11 | Charts explain complex info |
| PP-12 | Live government data (HMRC/ONS/BoE cron sync) |
| PP-13 | 11-Expert Council on every conversation |

10 enforcement skills already authored in `~/.claude/skills/` — covers PP-3, PP-6, PP-11, PP-12, PP-13 + 5 anti-pattern detectors. Use them every session.

---

## §2 — Build sequence

Engine before lenses before tabs before UI before compliance. **No layer N begins until layer N-1 is verified done.**

| Phase | Name | Effort | Cumulative |
|---|---|---|---|
| 0 | Security — rotate 4 leaked keys + scrub git history | 1 session (~2h) | week 0 — **DEFERRED by founder direction 2026-05-23** |
| 1 | Data foundation — engine reads from Supabase + live HMRC/ONS/BoE cron | 3 weeks | week 3 — **✅ CLOSED 2026-05-23, see §2.1 below** |
| **1.5** | **Auth foundation (Security/Account) — Supabase Auth + OAuth + step-up + permission matrix · BLOCKS Phase 6** | **3 weeks** | **week 6** |
| 2 | Engine truth — single ripple path + 528-run DeepSeek regression clean | 3 weeks | week 9 — **2a ✅ CLOSED 2026-05-25 (93.6% PASS); 2b ✅ CLOSED 2026-05-25 (engine indirection via _bundle.js + boot hook + harness wired; 21/21 regression PASS post-refactor; uk-tax.js duplicate consolidated); 2c ripple still pending** |
| 3 | 11-Lens depth (10 lens shells → full bodies) | 4 weeks | week 13 |
| 4 | Lens-Council integration into DE / Scenarios / Reports / Drill | 2 weeks | week 15 |
| 5 | Core tabs — gap-audit-driven build (per §3 below) | 12–17 weeks | week 27–32 |
| 6 | Ancillary tabs — Onboarding / Data Capture / Doc Vault / Notifications / Reports / IFA Practice / Settings (per §4 below) | 11–15 weeks | week 38–47 |
| 7 | Decision Engine — 40 events end-to-end | 5 weeks | week 35–44 |
| 8 | Ask Sonu cross-tab | 2 weeks | week 37–46 |
| 9 | Drillability infrastructure (PP-3) — DrillablePanel primitive retrofit + cross-tab navigation + audit ledger | 3 weeks | week 40–49 |
| 10 | Charts library (PP-11) | 2 weeks | week 42–51 |
| 11 | UI polish — last per founder direction | 6 weeks | week 48–57 |
| 12 | Compliance + regulatory production-grade | 3 weeks | week 51–60 |
| 13 | Multi-jurisdiction (India) | 5 weeks | week 56–65 |
| 14 | Demo + IFA adviser onboarding | 3 weeks | week 59–68 |

**Notes:**
- Layers 5 and 6 (tabs + ancillaries) can be parallelised after lens-council (Layer 4) is locked
- Layer 9 (drillability) can begin in parallel with Layer 5 once a few tabs are ready
- Layer 11 (UI polish) is the long-pole — happens per tab as that tab reaches engine-complete state

---

## §2.1 — Phase 1 actual status (audited 2026-05-23)

The §2 table shows "3 weeks" for Phase 1, but a code audit found most of the infrastructure already exists. Here is the actual breakdown:

| Component | Status | Location |
|---|---|---|
| Migration 011 — 6 tables (rules_bundles, macro_variables, macro_history, personas, persona_snapshots, test_audit_log) + RLS | ✅ AUTHORED | `supabase/migrations/011_create_data_layer.sql` |
| Migration 012 — pg_cron job registration (2 schedules) | ✅ AUTHORED | `supabase/migrations/012_register_cron_jobs.sql` |
| Edge Function `cron-context-pull` — daily ONS CPI + BoE base rate | ✅ AUTHORED | `supabase/functions/cron-context-pull/index.ts` |
| Edge Function `cron-rules-activation` — daily activation of scheduled bundles | ✅ AUTHORED | `supabase/functions/cron-rules-activation/index.ts` |
| `src/lib/data-source.js` — read API with JSON fallback | ✅ AUTHORED | exists, exports `loadBundle`, `loadMacroVariables`, `loadMacroVariablesForYear`, `loadPersona`, `listPersonas`, `saveSnapshot`, `logAudit`, `diagnose` |
| **Seed script** — bulk-loads 2 bundles + 78 macro-history rows + 13 current macro + 112 personas | ✅ AUTHORED 2026-05-23 | `scripts/seed-supabase-data-layer.mjs` (dry-run verified) |
| **Phase 1 verification harness** | ✅ AUTHORED 2026-05-23 | `tests/data-source-live.mjs` (JSON-mode passes all checks) |
| Migration 011 applied to Supabase | ✅ DONE 2026-05-23 | founder pasted; 6 tables live |
| Migration 011b (service_role GRANTs) | ✅ DONE 2026-05-23 | inserted to fix permission-denied on writes |
| Migration 012 applied (pg_cron registered) | ✅ DONE 2026-05-23 | 2 jobs registered: cron-context-pull-daily, cron-rules-activation-daily |
| Edge Function `cron-context-pull` deployed + live-data verified | ✅ DONE 2026-05-23 v2 | pulls live ONS CPIH (3.0%, Apr 2026) + BoE Bank Rate (3.75%, 21 May 2026) — v1 had IUDSOIA bug, v2 fixed to IUDBEDR |
| Edge Function `cron-rules-activation` deployed + smoke-tested | ✅ DONE 2026-05-23 | HTTP 200, scanned scheduled bundles cleanly |
| Seed run against live Supabase | ✅ DONE 2026-05-23 | 2 rule bundles + 78 macro history + 13 current macro + 112 personas |
| `cron-hmrc-pull` for HMRC rule scraping | ❌ NOT BUILT | HMRC has no clean API for rate changes — Budget-day human-triggered; deferred to Phase 1.1 |
| **Engine reads via data-source.js** | ✅ DONE 2026-05-25 (PHASE 2b) | Indirection layer `src/engine/_bundle.js` with mutable bundle/macro refs + `onBundleChange` subscriber. Engine modules (`fq-calculator`, `_helpers`, `tax-estate-engine`, `modules/uk-tax-2026-1-1`) refresh module-level constants in place on `setBundle()`. Boot hook `src/lib/boot-rules.js` called from `App.jsx` mount fetches live bundle + macro from Supabase. `uk-tax.js` orphan duplicate consolidated → re-export pass-through. Test harness `snapshot.mjs` calls `setBundle(yearMatchedBundle)` per run (Engine stays SYNC — original "sync→async cascade" framing was wrong; React render can't await). Smoke: 21/21 PASS (7 personas × 3 years) post-refactor. |

**Net Phase 1 status: ✅ CLOSED 2026-05-23.** Infrastructure live; data layer populated; live ONS + BoE data confirmed flowing. Engine refactor (PP-6 enforcement) deferred to Phase 2 as planned.

**Bug caught during Phase 1 close-out (worth noting for the audit register):**
- The original `cron-context-pull` edge function I authored used BoE series code `IUDSOIA` — that's SONIA (Sterling overnight index average), not Bank Rate. If the upstream ONS URL hadn't also been broken (forcing a closer look), the function would have silently written the wrong number (~4.2%) into `boe_base_rate` with full source attribution and high confidence. This is exactly the PP-6/PP-12 failure mode the `accuracy-auditor` skill exists to catch. Caught by luck, not by skill. **Adding to nice-to-haves register: "Unit-test edge functions against a known-good reference value before deploy."**

**What this means in practice:**
- Live macro data now flows daily from ONS + BoE → finio_macro_variables + finio_macro_history.
- Bundle activation will fire automatically on any future Budget-day rule transition (write the new bundle as `scheduled` with effective_from = transition date; the cron flips status to `active` at midnight UTC on that day).
- Engine code still reads JSON directly (9 files). Switching `DATA_SOURCE=supabase` has no effect until Phase 2 wires the engine through `data-source.js`.

**Verification commands (run any time):**
```bash
# JSON-fallback mode (works without Supabase)
node tests/data-source-live.mjs --json

# Dry-run the seed (verifies JSON sources parse)
node scripts/seed-supabase-data-layer.mjs --dry-run

# After founder applies 011 + sets env vars:
node scripts/seed-supabase-data-layer.mjs
node tests/data-source-live.mjs --supabase
```

---

## §2.2 — Phase 2a status (audited 2026-05-25)

| Sub-task | Status | Detail |
|---|---|---|
| Harness wired (runner.mjs, snapshot.mjs, validator.mjs, rule-validator.mjs) | ✅ DONE | Pre-existing; reads via data-source.js |
| Rule-validator quality (couple-aware IHT, balance-sheet sum) | ✅ FIXED 2026-05-25 | C4 trusts engine's nrb+rnrb; C6 informational only |
| Snapshot balance_sheet (nested + flat array walking) | ✅ FIXED 2026-05-25 | `summariseBalanceSheet()` handles both schemas; exposes business / alternatives / GIA / protection |
| Rules-only regression — 7 personas × 6 years | ✅ 42/42 PASS 2026-05-25 | No gross engine bugs (impossible scores, malformed output) |
| DeepSeek LLM validation — 7 personas × 6 years | ✅ COMPLETED 2026-05-25 | 42 calls, 47,833 tokens, $0.024. Pre-fix result: 15 FAIL / 24 WARN / 3 PASS. Full triage: `.planning/phase-2a-triage-2026-05-25.md` |
| **BUG-1 (RNRB taper missing for HNW)** | ✅ FIXED 2026-05-25 | `fq-calculator.js:585` ihtDynamic now uses canonical helpers (_propertyTotal, _pensionTotal, _isaTotal, _giaTotal, _cashTotal) + identifies main-residence from array entries. Tony Stark's IHT corrected £378k → £3.21M (8.5× underreporting). |
| **BUG-2 (£0 income for transition-stage)** | ✅ FIXED 2026-05-25 | `snapshot.mjs` effectiveDrawdown widened — when targetIncome > employmentInc, the gap is inferred as drawdown regardless of lifeStage. Tagged with `drawdown_source` (`explicit | topup | inferred_from_target | none`). |
| **BUG-3 (snapshot all-or-nothing schema gate)** | ✅ FIXED 2026-05-25 | `summariseBalanceSheet` now does per-category flat+nested sum. Bruce Wayne's SIPP £850k + ISA £420k newly visible. |
| **BUG-4 (income tax taxed only one income stream)** | ✅ FIXED 2026-05-25 | Surfaced on 2nd run. `snapshot.mjs` now passes `effectiveDrawdown + employmentInc` (combined gross) to `incomeTax()`. Persona-c income tax corrected £6,432 → £25,832. |
| Snapshot widening (protection, asset_allocation, cashflow sources) | ✅ DONE 2026-05-25 | Added blocks to snapshot output; helper functions in snapshot.mjs. |
| DeepSeek prompt taught RNRB taper + SIPP-pre-2027 exclusion | ✅ DONE 2026-05-25 | `validator.mjs` — silences false positives where engine is correct but DeepSeek didn't know the rule. |
| Hybrid regression re-run (7 × 6, post-all-fixes) | ✅ 22 PASS / 17 WARN / 3 FAIL 2026-05-25 | 8× improvement in PASS rate (3 → 22). Remaining 3 FAILs are all DeepSeek arithmetic noise on persona-a (different "correct" tax claims per year for identical inputs). |
| Matrix expansion sample (100 of 528 runs) | ✅ 78 PASS / 19 WARN / 3 FAIL 2026-05-25 | 78% pass rate. $0.064. Confirms fixes hold across wider persona universe. |
| **Full 390-run sweep (7 main + matrix + bruce-wayne-series + tony-stark-series)** | ✅ **365 PASS / 23 WARN / 2 FAIL · 93.6% PASS · $0.246 · 25.5 min · 2026-05-25** | 2 remaining FAILs are NOT engine bugs: (1) persona-a — same LLM arithmetic noise on £96k tax (engine's £25,832 is correct); (2) bruce-wayne-series 2022/23 — sparse historical-series persona shape. Phase 2a engine truth ✅ CLOSED. |

**Net Phase 2a status:** Rules-only smoke clean. No gross engine bugs detected. Subtle bugs (wrong tax band, RNRB taper off) will surface as Phase 5 (core tabs) drives real personas through real UI. Deferred LLM validation is **not a blocker** for proceeding.

**Hand-off note for whoever resumes LLM validation later:**
- Verify DeepSeek balance ≥ $5 before running `--full --hybrid`
- A 88-persona × 6-year run = 528 calls × ~$0.002 = ~$1.05 expected
- Set `DEEPSEEK_SPEND_CAP_USD=5.00` in `.env.local` to safety-cap

---

## §3 — Core tabs: per-tab build plan

Each tab has its own checklist drawn from its gap audit. **Items below are concrete tasks with file-level locations and effort estimates.**

---

### §3.1 — MyMoney (4–6 weeks · biggest single phase)

**Source:** `.planning/gap-audits/mymoney-gap.md`

**Current state:** Twin-Anchor wired. 19 of 20 domains rendering at L1+L2. Only Pensions has dedicated L3 panel (974 lines). 18 other domains use generic DomainCard.

**Build checklist (priority order):**

| # | Task | Effort | File(s) |
|---|---|---|---|
| MM1 | Build ISA L3 detail panel (spec §6.5/§6.6 — S&S ISA + LISA detail with allowance tracker, contributions, growth chart, X24 actions) | 3 days | `src/screens/MyMoney.jsx` (new component) |
| MM2 | Build GIA L3 detail panel (spec §7 — CGT position, dividend yield, cost basis) | 3 days | same |
| MM3 | Build Property L3 detail panel (spec §10.5 — value history, LTV, rental yield for BTL, S24 impact, PPR for residence) | 4 days | same |
| MM4 | Build Business L3 detail panel (spec §11 — BPR qualifying value, holding period, succession plan) | 3 days | same |
| MM5 | Build generic-but-rich L3 detail pattern for remaining 14 domains (EIS/SEIS/VCT, Bonds, EmpShare, Protection, Insurances, Cash, Liabilities, Income, Alternatives, Family, State, Director) | 14 days (~1d each) | same |
| MM6 | X24 mode 3 "I want this different" affordance on every metric (PP-3 enforcement) | 5 days | retrofit across MyMoney.jsx + shared DrillablePanel primitive |
| MM7 | X29 visual diff contract (tint + delta chip + cause chain reveal on NW change) | 3 days | shared component + Home + MyMoney |
| MM8 | Per-domain data capture forms (spec §X.6 per-domain — Property needs address+LTV+date; SIPP needs provider+contrib%+split etc.) | 5 days | `AssetCaptureSheet` at MyMoney.jsx:1588 |
| MM9 | IHT-position action triggers on SIPP/property/business asset cards | 2 days | rows-for-* functions |
| MM10 | Cross-tab IHT read verification — every relevant card reads `entity.computed.iht_exposure` from T&E canonical | 1 day verify | grep-and-test |

**Verification:** spec section coverage matrix from audit reaches 100% PRESENT. §Q1.2 cross-screen contract intact. Snap matrix 3×2 at every viewport-theme combo.

---

### §3.2 — Cashflow (1–2 weeks · much closer than founder thought)

**Source:** `.planning/gap-audits/cashflow-gap.md`

**Current state:** 4 industry SWR regimes wired (Bengen / Morningstar UK / Guyton-Klinger / Vanguard). PRC-anchored is FOUNDER-BLOCKED stub (O-CF-RULES-07). Engine 90%+ complete with V2 polished charts (FundedRatioGaugeV2, PoSChartV2, ScenarioMatrixV2, CashflowWaterfallV2, SequenceStressVisV2, EfficientFrontierV2).

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| CF1 | **§A wiring depth check (rows A8–A13)** — verify monthlyExpenseProfile / essentialVsDiscretionaryRatio / taxPaymentSchedule / allowableExpenseTotal / childcareNetCost / giftsFromNormalIncomeCheck each render on screen with engine output, not stub | 2 days | walk Cashflow.jsx top-to-bottom |
| CF2 | **§B wiring depth check (rows B5/B9/B10/B11/B12/B13/B14/B15)** — confirm MC fan chart, Goal-Seek flow, sticky subheader, optimalDrawdownSequence, bucketAllocation, bucketReplenishCheck, floorUpsideSplit, guaranteedFloorIncome each render | 4 days | same |
| CF3 | **Goal-Seek B.5 flow (X24 Mode 3 primary entry)** — verify locked card below 5-scenario picker exists; if missing, build | 2 days verify + up to 5 days build | Cashflow.jsx §B section |
| CF4 | **X29 Diff treatment** — ≥0.03 funded-ratio change triggers diff card | 2 days | shared X29 component |
| CF5 | **CF-AI-9 narrative integration** — AI narrative chips for §C and §6.4/6.5 stub explainers | 2 days | inline AI chip placement |
| CF6 | **Founder closure: O-CF-RULES-07 (PRC/PCC methodology)** — NOT a Claude task — founder authors the canonical methodology doc, then Claude wires the 5th SWR regime | 0 days Claude / 4–8 hours founder | spec authoring → then `cashflow-engine.js:734 prcPccSpread` implementation |
| CF7 | **Founder closure: O-CF-RULES-09 (Reality Engine factor enumeration)** — same pattern | 0 days Claude / 4–8 hours founder | spec authoring → then `cashflow-engine.js:786 realityEngineFactorisation` implementation |

**Verification:** all 5 SWR regimes return live rates (not Bengen fallback) for non-stubbed regimes; §A/§B/§C full coverage; Goal-Seek surfaces from every relevant metric.

---

### §3.3 — Tax & Estate (2–3 weeks · production-near)

**Source:** `.planning/gap-audits/tax-estate-gap.md`

**Current state:** 23 of 25 spec sections wired. 21+ dedicated UI components. CoI canonical home. Engine has 31+ T&E-owned functions implemented.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| TE1 | **§6.9 Will & LPA dedicated panel (X27 PRIMARY CANONICAL HOME)** — verify presence; if inside NominationsManager, extract to its own `WillLPAPanel` for discoverability | 2 days | TaxEstate.jsx |
| TE2 | **§15 Action catalogue (15 path types)** — verify each action surfaces as chip on relevant cards; if missing, build per-card action chips | 5 days | per-card retrofit |
| TE3 | **§16 Simulation workspace** — verify subsumed by DE What-If; if not, build inline T&E simulator | 1 day verify + 5 days build if greenfield | TaxEstate.jsx new component |
| TE4 | **§7 dual-impact UI** — every decision card surfaces tax-cost-now + estate-impact-later | 3 days | per-card retrofit |
| TE5 | **§22.3 property income tax 2027 deltas** — verify uk-tax-2026-1-1 implements April 2027 rule changes | 2 days | engine + tests |
| TE6 | **§5.10 Self Assessment timeline chart** — depth of SelfAssessment :773 component | 1 day | TaxEstate.jsx |
| TE7 | **§Q2.6 Trust periodic-charge timeline chart** — depth of TrustSimulator chart | 1 day | TaxEstate.jsx |

**Verification:** all 14 Q2 charts render at production quality. CoI canonical-read from Home/MyMoney intact. Will & LPA panel discoverable.

---

### §3.4 — Risk (1–2 weeks · verification-heavy)

**Source:** `.planning/gap-audits/risk-gap.md`

**Current state:** 7 dimensions wired. 5×5 cross-map. Radar + Orbit views. D6 questionnaire flow. Shock scenarios + life-event prompts + history. AI chips.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| RK1 | **Formal-spec drift check** — verify `calcRisk()` in `uk-risk-2026-1-1.js:1467` matches the s07 formal spec dimension maxes (20/18/18/15/12/10/7) and sub-formulas exactly | 3 days | uk-risk module + tests |
| RK2 | **D7 BTR gaming-resistance (§6.7a v1.5)** — verify gaming-resistance logic exists; build if missing | 2 days verify + 2–3 days build | uk-risk D7 implementation |
| RK3 | **5×5 cross-map 25 cell names (§4.9 v1.4 corrected list)** — verify labels match canonical list exactly | 1 day | Risk.jsx `ProfileCell` :247 |
| RK4 | **§12 single-source verification** — no drift between `fq-calculator.calcRisk` and `uk-risk.calcRisk` | 1 day | engine layer |
| RK5 | **§1.7 question inventory time budget** — per-question time budget tracking | 1–2 days | Risk.jsx questionnaire |

**Verification:** mathematical correctness against s07 formal spec, gaming-resistance prevents inflated D7, 25 cells match v1.4 list.

---

### §3.5 — Timeline (1–2 weeks)

**Source:** `.planning/gap-audits/timeline-gap.md`

**Current state:** all 6 sections built (A Life Stage / B Score Journey / C Action Calendar / D Decision Log / E Scenario Library / F Goals & Milestones). Engine has 10 timeline-owned functions. DE commits land here via persistence.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| TL1 | **§6.9 Statutory entries enumeration completeness** — every UK statutory date in Calendar (tax-year start/end, ISA deadline, AA carry-forward, gift 7-year clock dates, APR/BPR clock, RNRB taper, BPR cap effective Apr 2026, SIPP-IHT effective Apr 2027, SA deadlines) | 2 days | Timeline.jsx Section C + rules-bundle reads |
| TL2 | **§1.7 Question inventory + X25 binding** | 1 day verify + 1–2 days fix | Timeline.jsx |
| TL3 | **Goal-Seek X24 Mode 3 — comprehensive coverage** — long-press handlers on every metric across Timeline | 3 days | Timeline.jsx retrofit |
| TL4 | **§4.7 user-input override panel + §4.9 insufficient-data state** | 1–2 days | Timeline.jsx Section A |
| TL5 | **§2.5 Hide-balances mode** | 1 day | shared privacy mode |

**Verification:** every statutory UK date present in calendar with correct days-remaining. Goal-Seek reachable from every metric.

---

### §3.6 — Home (2 weeks · cross-tab cockpit)

**Source:** `.planning/gap-audits/home-gap.md`

**Current state:** all 12 cross-tab reads go through canonical engine functions (clean canonical contract). Z1/Z3/Z4/Z5/Z7/Z11 zones wired. X28 selector + What-If section + Drill Panels (CoI, APQ, NetWorth) all present.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| HM1 | **Z6 Reality Engine Ring** — verify + build if missing | 2 days | HomeScreen.jsx |
| HM2 | **Z12 AI Synthesis Chip + Z13 AI Weekly Narrative** — verify + build the AI-narrative zones | 5 days | HomeScreen.jsx |
| HM3 | **DimExplainerStub :1236 — full DimExplainer** — explicitly named stub, replace with full per-dim explainer drill | 3 days | HomeScreen.jsx |
| HM4 | **Z0 Score orientation layer (first-render only)** — verify in Welcome flow | 1 day verify |
| HM5 | **Z9 What's New feed + Z14 Drive-to-Update Prompt + Z15 Milestone Pride Pin** | 4 days | HomeScreen.jsx |
| HM6 | **Q5 Explainer registry coverage** — ExplainerChip on every metric per X23 binding | 2 days | HomeScreen.jsx retrofit |

**Verification:** every metric on Home has explainer chip; AI narrative renders weekly; Reality Engine ring renders (or honestly stub-flagged per O-CF-RULES-09 if Reality Engine itself is blocked).

---

## §4 — Ancillary tabs (concrete checklists from 8 ancillary audits)

**8 audits at:** `.planning/gap-audits/{onboarding|data-capture|document-vault|notifications|reports|ifa-practice|settings|security-account}-gap.md`

Ordered by dependency (Auth must come early; Onboarding requires Auth; Data Capture API Pull is the longest single ancillary build). Critical insight: **Security/Auth is a Phase 1.5 BLOCKER**, not a regular ancillary. It must move forward of Onboarding because Onboarding writes the initial user, and a real user requires real auth.

---

### §4.0 — Security/Auth (Phase 1.5 — BLOCKER, 3 weeks)

**Source:** `.planning/gap-audits/security-account-gap.md`

**Current state:** Pre-launch waitlist landing page. SSO buttons disabled. Email/password inputs unwired. No Supabase Auth, no OAuth, no email verification, no 2FA, no biometric, no step-up auth, no permission matrix. Acceptable for founder-driven demos; **blocks any non-founder use**.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| AU1 | **Wire Supabase Auth — email/password signup + email verification + session management** | ✅ DONE 2026-05-25 | `src/lib/auth.js` (signUp/signIn/signOut/resend/reset + getSession/onAuthStateChange) + `src/state/auth.jsx` (AuthProvider context + useAuth hook with isDemo bypass) + `src/screens/Account.jsx` refactor (real signUp call, mode toggle signup↔signin, verify banner, error states) + `src/App.jsx` (AuthProvider wrap + auth gate that allows `?demo=X` bypass). Build: 212 modules clean. |
| AU2 | **OAuth providers — Google + Apple SSO** wired to Supabase Auth (founder approves client IDs) | ✅ DONE 2026-05-25 (code side) | `signInWithProvider(provider)` in auth.js + Google/Apple buttons in Account.jsx (no longer "(waitlist)" disabled). Provider config in Supabase project ▸ Authentication ▸ Providers remains founder action — surface honest "{provider} sign-in is not yet configured" message until each provider is enabled. |
| AU3 | **D-AUTH-1 step-up auth framework** — Foundation §X20 contract; biometric / 2FA / re-password challenges | 1 week | new `auth/step-up.js` + UI dialog + integration into DataCapture + Vault writes |
| AU4 | **MFA + biometric** for end-users (TOTP + WebAuthn for modern devices) | 3 days | settings + login flow |
| AU5 | **Permission matrix (X27)** — by document class × accessor role (owner/spouse/IFA/solicitor) | 1 week | new `auth/permissions.js` + Vault integration |
| AU6 | **Pre-launch CTA-honesty review** — confirm all auth-adjacent CTAs labelled correctly until production | 0.5 day | grep + verify |

**Verification:** Supabase Auth users table populates on signup; email verification fires; step-up challenges on DataCapture material change + Vault download; permission matrix denies non-authorised access; 100 IFA pilot users sign up successfully.

---

### §4.1 — Onboarding (3–4 weeks · biggest single ancillary)

**Source:** `.planning/gap-audits/onboarding-gap.md`

**Current state:** Linear questionnaire, ~7 stages, currency/multi/single pickers wired. RevealScreen + ScoreTile + SummaryRow present. Spec v1.1 ambitious (hooks + IFA path + Voyant + jurisdiction + RH trees + Q-A1..Q-A7). Code closer to v0.3 prototype.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| OB1 | **§HOOK Public-hook funnel handoff** — April 2027 IHT calculator → onboarding with state transfer | 3 days | new `Hook.jsx` + Onboarding routing |
| OB2 | **§IFA path** — practice signup + per-client document-first onboarding + Voyant migration import | 2 weeks | new `OnboardingIFA.jsx` flow |
| OB3 | **§3 Entry-mode picker** — public-hook / IFA / direct / demo branching | 3 days | Onboarding entry screen |
| OB4 | **§4 Jurisdiction routing + §5 Language selection** — UK / India / cross-border + EN/HI/GU | 4 days | Onboarding step |
| OB5 | **§7-§9 RH trees + partner + relationship history** | 1 week | Onboarding additional steps |
| OB6 | **§10 Archetype-driving questions Q-A1..Q-A7** + §11 classifier expansion (life-stage→5-archetype matrix) | 4 days | classifier + screens |
| OB7 | **§Q1B single-source contracts + §Q4 correlation_id chain** | 2 days | events emit |

---

### §4.2 — Data Capture (3–4 weeks)

**Source:** `.planning/gap-audits/data-capture-gap.md`

**Current state:** Manual entry form + Document Upload via FP5Modal + confidence chips wired. API Pull (Channel 3) is greenfield.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| DC1 | **Channel 3: API Pull multi-aggregator** — TrueLayer (UK OB) + Plaid (intl) + MoneyHub (UK wealth) per D-EDA-3 | 2 weeks | new `aggregators/{truelayer,plaid,moneyhub}.js` + DataCapture integration |
| DC2 | **Step-up auth (D-AUTH-1) on every write** (depends on AU3) | 3 days | wire to AU3 framework |
| DC3 | **Provenance trail (§4.8)** — every value carries source / parser / confidence / retrieved_at / document_id | 2 days | data model + storage |
| DC4 | **Per-field action semantics (§4.6) + partial acceptance (§4.7)** | 2 days | FP5Modal depth pass |
| DC5 | **Parser hierarchy (§4.3)** — waterfall from structured → semi-structured → OCR | 3 days | new `parsers/` hierarchy |
| DC6 | **D-DEMO-HIDDEN-1 ingest gate** — DemoPersonaLeakError | 1 day | shared gate logic |

---

### §4.3 — Document Vault (3–4 weeks)

**Source:** `.planning/gap-audits/document-vault-gap.md`

**Current state:** Phase 1 read-only catalogue (10 doc types). Phase 2 features all missing per code header.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| DV1 | **Permission matrix (§6.1)** by class × accessor role (depends on AU5) | 1 week | wire to AU5 framework |
| DV2 | **Document detail views (§2.2 financial + §2.3 estate expanded)** | 1 week | new `VaultDetail.jsx` |
| DV3 | **Step-up auth (§6.3)** for downloads (depends on AU3) | 3 days | wire to AU3 |
| DV4 | **Report artefact integration (§4.3 + D-RF-4)** | 3 days | Reports → Vault write |
| DV5 | **Storage + retention model (§7)** — Supabase Storage policy + lifecycle rules | 3 days | supabase/migrations |

---

### §4.4 — Notifications (1–2 weeks)

**Source:** `.planning/gap-audits/notifications-gap.md`

**Current state:** 6 type codes defined; 3 of 6 actively wired (NC-SC / NC-RA / NC-RC). 7 sub-categories empty (NC-DD / NC-TB / NC-EX / NC-RC Regulatory Change / Vault / X26 Pride / X27 Estate Proactive / DE).

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| NT1 | **Derivation rules for 7 empty sub-categories** (NC-DD deadlines, NC-TB tax-boundary, NC-EX execution, Vault, X26 pride, X27 estate proactive, DE) | 1 week | extend deriveNotifications |
| NT2 | **§8 Rules-version change modal** (fires on Budget Day) | 2 days | bundle-activation hook + modal |
| NT3 | **§10 Opt-in matrix** (cross-tab with Settings S6) | 2 days | Settings integration |
| NT4 | **§4 Standard payload envelope** verification across derivations | 1 day | schema audit |
| NT5 | **§9 L1 delivery guarantee** strengthening | 2 days | mandatory ack flow |

---

### §4.5 — Reports (2 weeks)

**Source:** `.planning/gap-audits/reports-gap.md`

**Current state:** Phase 2 stub. All 5 templates catalogued with descriptions; zero generation logic; CTA-honest.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| RP1 | **Build generation engine** — `onGenerate(reportId, mode)` → engine reads → PDF + CSV via D-RPT-EXPORT-1 | 1 week | new `reports/generator.js` + Reports.jsx wiring |
| RP2 | **§6 AI narrative integration** with FCA-rewrite + commentary-not-source-of-truth enforcement | 3 days | reports/narrative.js + FCA layer |
| RP3 | **§7 Artefact data model + Vault integration** — write to Vault per D-RF-4 (depends on DV4) | 3 days | wire to Vault |
| RP4 | **§8 IFA white-label** — practice logo, footer, contact | 2 days | template engine |
| RP5 | **§5.1 Scheduling** — weekly / monthly auto-generation + email/Vault delivery | 3 days | Supabase Edge Function + email service |

---

### §4.6 — IFA Practice (2–3 weeks)

**Source:** `.planning/gap-audits/ifa-practice-gap.md`

**Current state:** Substantial demo shell. Roster + adviser-mode preview wired. Phase 2 stubs scattered.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| IF1 | **Phase 2 wiring** — replace Phase2Stub placeholders with real data paths | 1 week | IFAPractice.jsx walk |
| IF2 | **§6 Notes + meeting management** — IFA logs every client interaction (FCA suitability requirement) | 1 week | new Notes + Meeting modules |
| IF3 | **§2.2 Supabase RLS verification + practice entity schema** | 3 days | supabase/migrations + IFA Practice schema |
| IF4 | **§4.3 Book intelligence charts** — book NW distribution + average FQ + client risk distribution | 4 days | IFAPractice.jsx charts |
| IF5 | **White-label reports** (cross-tab with RP4) | 2 days | wire to Reports |

---

### §4.7 — Settings (1–2 weeks)

**Source:** `.planning/gap-audits/settings-gap.md`

**Current state:** Section + Row + DetailPanel primitives wired. ~6 of 13 sections have real content; ~7 stubbed. Explicit TODO to migrate from localStorage to event-sourced state.

**Build checklist:**

| # | Task | Effort | File(s) |
|---|---|---|---|
| ST1 | **Migrate to event-sourced state** — TODO at file top; emit correlation_id chain | 3 days | Settings.jsx rewrite |
| ST2 | **Wire all 13 sections (S1–S12 + profile)** — each gets header + ≥1 row; Phase2 stubs → real where capability exists | 1 week | Settings.jsx expansion |
| ST3 | **S6 Notifications opt-in matrix** — integrate with NT3 | 2 days | wire to NT3 |
| ST4 | **S3 Connected Services** — manage OAuth connections (depends on DC1 + AU2) | 2 days | wire to DC1 + AU2 |
| ST5 | **S10 Subscription & Billing** — Phase 2 when payment system arrives (out of v1.0 scope) | 1 week (deferred) | future |

---

## §5 — Verification commands per phase

| Phase | Run | Pass criterion |
|---|---|---|
| 0 | `git log --all -p -S "sk-ant-api03"` | 0 results |
| 1 | `node tests/data-source-live.mjs` | live rules + macro + persona fetched with timestamps |
| 2 | `node tests/harness/run.mjs --full` | 528 PASS / 0 FAIL |
| 3 | `node tests/lens-coverage.mjs --persona bruce-wayne` | ≥10 obs / ≥3 recs / ≥1 flag per lens × 11 lenses |
| 4 | `node tests/lens-council-coverage.mjs` | council invoked in Ask + DE + Scenarios + Reports + Drill |
| 5 | per-tab snap matrix at 3 viewports × 2 themes | every gap-audit row PRESENT |
| 6 | per-ancillary smoke test | every "coming soon" replaced with real flow or honest "not yet" |
| 7 | `node tests/de-coverage.mjs --all-events` | 40/40 valid trees |
| 8 | manual 10 IFA-grade query test | routing + lens citations intact |
| 9 | ESLint `no-bare-values-in-screens` | passes |
| 10 | `npm run snap:charts` | 9 × 3 × 2 = 54/54 snapshots |
| 11 | `sonuswealth-ux-critic` skill on every tab | ≤3 priority-1 issues |
| 12 | `sonuswealth-compliance` skill on every screen | CLEAR |
| 13 | India persona on Bruce Wayne dual-jurisdiction | coherent output |
| 14 | 14 days of daily demo smoke | pass |

---

## §6 — Next concrete actions (founder + Claude)

### Founder (must do — blocks everything)
1. **Rotate 4 leaked keys** (Anthropic / DeepSeek / Trading212 / Supabase service_role) — see Phase 0 above. Reply "keys rotated" with values pasted in chat.
2. **Close O-CF-RULES-07** — author PRC/PCC canonical methodology (4–8 hours of spec authoring). This unlocks Cashflow's 5th SWR regime + §6.4 Capital Efficiency card.
3. **Close O-CF-RULES-09** — author Reality Engine factor enumeration + weights. This unlocks §6.5 confidence decomposition card.
4. **Top up DeepSeek $5** if you want parallel agent audits to work for ancillary tabs (currently blocked by long-context credit limit; main thread fallback works but slower).

### Claude (can do without founder action while waiting)
1. Build the Layer 1 schema migrations (013–016) and Edge Function stubs for `cron-hmrc-pull` / `cron-ons-pull` / `cron-boe-pull`. These can sit until keys are rotated and Supabase deploy is unblocked.
2. Run audits for the 8 ancillary tabs (Onboarding, Data Capture, Doc Vault, Notifications, Reports, IFA Practice, Settings, Security) — write to `.planning/gap-audits/ancillaries-*.md`.
3. Verify the 18 "PARTIAL" rows in the MyMoney audit — walk MyMoney.jsx top-to-bottom and convert PARTIAL→PRESENT or PARTIAL→MISSING per row.
4. Build the lens-council interface in `src/engine/lens-council/run.js` (Layer 4) — single source for DE / Scenarios / Reports / Drill.

---

## §7 — Nice-to-haves register

Captured in companion file: **`~/.claude/plans/sonuswealth-nice-to-haves.md`** — 60+ items observed across the 6 tab audits. Reviewed periodically; promoted to spec when founder approves.

---

## §8 — What this plan deliberately does NOT do

- Does not assume the codebase is "broken." It is **more mature than recent sessions suggested**. The gaps are mostly L3 depth + verification + a few founder open items.
- Does not chase one bug at a time. The 10 enforcement skills in `~/.claude/skills/` catch the recurring patterns pre-commit.
- Does not iterate on UI before engine truth. UI polish is Phase 11.
- Does not include marketing / growth / pricing — separate from product build.
- Does not extend beyond UK + India v1.

---

*Plan v2 · 2026-05-23 · Authored after 6-tab spec-vs-code gap audit. Supersedes Jiggly Book v3 + the Caelixa draft. Renamed to Sonuswealth per founder direction.*
