Title: Temporal-mode + drill-to-source + plain-English audit (10-point challenge #9/#6/#5)
Version: 0.1 (in progress)
Date: 2026-06-02
Status: OPEN
Cluster: 2-Product (cross-tab)
File name: temporal-drilldown-audit-2026-06-02.md
Purpose: Evidence-backed fault register for the founder's 10-point completeness challenge — #9 (Actual/Plan/Future/What-if), #6 (drill-to-source-to-decision), #5 (plain-English). Audit-first; batch-fix after.

> **FOUNDER DIRECTION 2026-06-02:** Cashflow, Tax & Estate, and Risk tabs all need **reorganizing** — the founder will review/drive the IA redesign. Until then, keep work on these three to **correctness/wiring only** (tax-figure reads, drill-to-source, advice-boundary compliance — all survive a reorg). Do NOT invest in layout/IA polish on these three; it will be replaced. MyMoney is not in scope for reorg → safe for deeper work.

**Summary:** The four temporal modes are uniformly present as a toggle but only genuinely implemented on MyMoney (with a debt-projection bug) and Timeline; Home and Cashflow stub Future/Plan as "coming soon". This register captures every fault before any fix, per the founder's audit-first / no-whack-a-mole principle.
**Tags:** #temporal #drilldown #plain-english #audit #cross-tab
**Updated:** 2026-06-02

---

## DIMENSION #9 — Actual / Future / Plan / What-if

### Cross-tab implementation matrix (from source, 2026-06-02)

| Tab | Toggle present | Mode source | Future | Plan | What-if | Notes |
|---|---|---|---|---|---|---|
| MyMoney | ✓ (window + mode) | local `viewMode` synced from store | ✓ computes | ✓ computes | ✓ WhatIfLibrary | **F2 debt-grow bug**, **F1 invisible at default window** |
| Home | ✓ | `useTemporalMode()` shared | ✗ "coming in Phase 2" (`HomeScreen.jsx:2103-2111`) | ✗ same stub | partial | toggle real, output stubbed |
| Cashflow | ✓ | **local `useState('actual')`** (`Cashflow.jsx:993`) — NOT shared store | ✗ "coming soon" (`:1226`) | ✗ "coming soon" (`:1227`) | scenario seed only | won't sync with global tax-year chip |
| Tax & Estate | ✓ (`TaxEstate.jsx:2562`) | local `useState('actual')` | ? unconfirmed | ? unconfirmed | ? | wiring to be confirmed by audit agent |
| Risk | ✗ none | — | — | — | — | no temporal mode at all (snapshot) |
| Timeline | ✓ | local `useState('actual')` (`:2371`) | ✓ score-journey | ✓ plan-primary (X28.6) | — | goal-seek works for 4 metrics, stubs 8 plan types; **§9 honesty violation STILL LIVE** via PlanRow Edit (see F6) |

### Refinements from cross-tab audit (2026-06-02)
- **Home is half-wired, not a pure stub.** The radar polygon DOES change in all 4 modes (`RadarAnchor.jsx:88-94` `projectDimsForward`/`planDims`, What-if drag→`goalSeek`→CausalStoryPanel is fully real). BUT the 4 anchor headline numbers (NW/Wealth Score/Risk/CoI) take no `viewMode` prop (`HomeScreen.jsx:2070-2077`) → frozen at "today" in every mode, while a *"5-year projection — coming in Phase 2"* banner shows (`:2103-2124`). So a user in "Future" sees a projected radar above an un-projected net worth — §9.5 Gate-2 inconsistency.
- **Tax & Estate `viewMode` is DECORATIVE.** Declared `:2562`, passed to X28TopBar `:2738`, then never read — no displayed number branches on it (only `x28Window` is load-bearing, driving the `bv` bundle memo). Flipping actual↔projected on T&E changes nothing.
- **Risk has NO temporal toggle — and that's DEFENSIBLE** (spec §33c O-RISK-17: a point-in-time resilience score doesn't map onto FY/RY/TY12). Not a gap; it exposes change-over-time via RiskHistory + shock trajectories instead.

**F6 — Timeline goal-seek "coming soon" is a LIVE §9 honesty violation (regression the code thinks is fixed).** Goal-seek's real solver covers 4 metrics only (`SUPPORTED_METRICS=['wealthScore','riskScore','netWorth','iht']`, `Timeline.jsx:1532`); the 8 plan types (retirement/estate/cashflow/debt/gift/protection/tax/custom) hit "coming soon" (`:1535-1540,:1701`). The dropdown was hardened to disable them (P1-23, `:1605`), but the **"Edit · Goal-seek" button on every existing plan row** (`PlanRow :1199` → `openGoalSeek :2592` → `:1535`) routes 7-of-8 committed plan types straight to "coming soon." Interactive control that pretends to act and dead-ends. Severity: HIGH (confirmed live affordance-pretends regression).

### Faults

**F1 — Modes invisible at the default window (MyMoney).** `current-period` → `windowYears === 0` → every mode returns today's value (`MyMoney.jsx:3376`). Switching Today→Future→Plan changes nothing but a badge reading "projected at Current period" (self-contradictory). Discoverability dead; matches the 2026-05-26 "none of them work" complaint. Severity: HIGH (reads as broken).

**F2 — Forecast grows debt instead of amortizing it (MyMoney), and contradicts the tiles.** At 10y horizon hero shows Liabilities £410k → £606k (verified live, Mr T). Root: `MyMoney.jsx:3489-3504` forces the Assets−Liab=NW identity by scaling BOTH sides by `Math.pow(1.04, yrs)`. The per-tile TrajectoryBars on the same screen show those debts `→ £0` (correct, via `projection.js:72` `direction:'shrink'`). Three disagreeing projection models: (1) hero NW = flat `cur×1.04^yrs` (`fq-calculator.js:2536` `netWorthAtYears`), (2) hero strip = both-sides×factor, (3) tiles = per-node grow/shrink. Severity: HIGH (§9.5 Gate-2 violation, visible on one screen).

**F3 — Home & Cashflow stub Future/Plan as "coming soon".** Interactive toggle lands on a placeholder. Violates CLAUDE.md §9.2 (interactive + dead-wired). Severity: HIGH (the core #9 claim fails on 2 of 6 tabs).

**F4 — Cashflow viewMode not on the shared store.** `Cashflow.jsx:993` local state; other tabs use `useTemporalMode()`. The global tax-year/mode chip won't drive Cashflow. Severity: MEDIUM (cross-tab desync).

**F5 — Window-select / store desync (MyMoney).** Changing the window `<select>` updated local `windowId` but left `localStorage.sonuswealth.temporal.window` at `current-period` (verified live). Tabs reading the store see a different horizon than MyMoney. Severity: MEDIUM.

### Recommended batch-fix (after audit complete)
Make the per-node `projectTaxonomy` model (`projection.js`) the single source for ALL projected figures (hero + tiles + Home + Cashflow). Deprecate flat-4% `netWorthAtYears`. Derive hero NW = Σ(projected assets) − Σ(amortized liabilities) so the identity holds *because* the components are right, not by scaling both sides. Move Cashflow/T&E/Timeline onto the shared `useTemporalMode()` store. Implement (not stub) Future/Plan on Home and Cashflow, or honestly relabel until built. Expected: projected numbers change across tabs (correctly); re-baseline regression.

---

## DIMENSION #6 — Drill-to-source-to-decision

### Cross-cutting pattern A — HERO numbers don't drill from where the user reads them
The single most-read number on several screens is a dead figure:
- **MyMoney hero** NW/Assets/Liabilities — `FinancesHeroCard.jsx:53` `Stat` has only `data-tieout` attrs, no `onClick`. NetWorthDrill opens only via a `sonus:networth-drill` window event from Dashboard (`MyMoney.jsx:3244-3254`), NOT by tapping the figure on MyMoney. (needs live confirm — see spot-checks)
- **Risk Score** (the hero ring) — `RiskRing` (`Risk.jsx:139-190`) is pure SVG, no tap; drill is wired only to the *secondary* Wealth/NW tiles. The screen's primary number is the one you can't tap.
- **Home** concentration chip, SIPP-delta — sourced but not tappable.
- **Cashflow** liquidity buffer, funded ratio gauge, PoS % — dead reads.

### Cross-cutting pattern B — drill chains dead-end in CANNED TEXT, not the user's facts
- **Home** `DimExplainerStub` (`:1319-1386`) — terminal of every state-tile/radar drill — renders static `DIM_EXPLAINERS` copy identical for every persona; shows `{score} pts` but never decomposes to the entity facts/rules that produced it.
- **Risk** `DimSheet` (`:809-862`) — 6 of 7 dimensions show prose `RISK_DIM_DESCRIPTIONS` + score, no "which of your facts drove this." Only `depExp` drills further.
- **Home** plan-progress % (`:816-843`) = time-elapsed-since-plan-creation when a target *date* exists, NOT money-toward-goal — "47%" reads as "47% to my number" but means "47% of the calendar passed." Misleading provenance.

### Cross-cutting pattern C — MyMoney leaves are the GOLD STANDARD (the bar others should meet)
Where reachable, MyMoney leaves fully satisfy "value + when-captured + rule": `AssetDetailOverlay` (source+date+manual/parsed/synced, growth labelled "your assumption, not a forecast"), `PensionLeaf` (captured growth assumption, honest "not yet captured", DB-vs-DC honesty), `DebtLeaf` (lender-captured balance + APR + rate-type as drillable FactRows). The tile→drill→leaf ladder works for all 7 asset categories + liabilities. **The gap is the hero entry points, not the leaves.**

### Cross-cutting pattern D — HARDCODED tax/benchmark figures in DISPLAY COPY (second tax-key bug class)
The engine calcs read TAX correctly, but user-facing *prose* types the numbers — they drift at the next Budget. Distinct from the 2026-06-01 wrong-key fix (that was engine calcs; this is display strings):
- **T&E:** RNRB taper `2000000`/`2350000` (`:1620-1622`), BPR allowance `2_500_000` (`:1940,:1966`), BPR rates `0.5/1.0` (`:1845-1847`), dividend rate chips `10.75/35.75/39.35%` (`:734-735`), 60%-taper lower bound `100000` (`:489,:2653` — comment self-flags missing `TAX.paTaperStart`). NRB/CGT drills read TAX but keep literal `??` fallbacks that mask a missing-bundle failure.
- **MyMoney:** ANI cliff thresholds `£100,000/£125,140/£60,000/£80,000` typed in copy (`:1251,:1641,:1651`) — comment `:1216` names `TAX.adjustedNetIncomeCliff` but the strings don't use it.
- **Home:** score-donut gold target `68` magic number (`:357`, `getWealthTarget` imported but unused here); CoI dates `'Mar 2026'`/`'6 Apr 2027'` + `new Date('2027-04-06')` inline (`:346-352,:534-535`); £20k ISA strings (`:1184-1185`).
- **Cashflow:** ONS `cohortMedian = 58` literal (`:1999`); **PoS chart band shape FABRICATED in UI** (`terminal * Math.pow(t,1.2)`, `:1350-1361`) — engine returns terminals only, the envelope is decorative interpolation presented as a projection.

## DIMENSION #5 — Plain-English

### Cross-cutting pattern E — ADVICE-BOUNDARY slips in imperative voice (highest regulatory risk)
Multiple screens issue directed recommendations rather than guidance. On an FCA information-not-advice platform these are RED:
- **T&E (sharpest):** "Consider harvesting up to {£exempt} in gains per tax year" (`:2144`), "Maximise pre-cap contributions while available" (`:668-669`), "Move to ISA saves £X/year" (`:751`). Imperative verbs + personalised £ = personal-recommendation territory.
- **Home:** "Clear high-rate debt before increasing investment contributions" (`:1313`), "Draw down ISA before SIPP in retirement" (`:1394`), "Maximise ISA and pension before investing in a GIA" (`:1309`). Reframe as third-person ("many people…") + qualifier.
- **Risk:** `RISK_DECISIONS` "Maintain 6-12 months cash buffer", "Opportunity to accept more investment risk" (`:1617-1621`) — no "information not advice" qualifier, while the shock cards right beside them correctly carry "est · not advice."
- Note: **MyMoney's decision modellers PASS** — `WhatYouCanDo`/`DebtLeaf` are correctly worded ("Information, not advice", "money math, not a recommendation", CTA "Explore with Sonu"). That's the FCA-safe model the others should copy.

### Cross-cutting pattern F — internal codes / spec IDs / dev artifacts leaking to the surface
- **Cashflow:** `Domain O` chip (`:2355`), spec IDs `CF-OVL-H-03`/`CF-HERO-09` flowing into `DrillableNumber.formula` (`:593,:596`), `3+1` chip (`:3211`), `pp` unit + "personal-cost-of-capital" (`:3276`), "Reality Engine"/"Factor weights" (`:3302-3339`).
- **Timeline:** "Capital Efficiency (PRC/PCC)" dead `—`/"Coming next" sub-anchor at top layer (`:2493-2497`); decision-log leaks "Step-up: L1 · ID: <internal>" (`:1087`); §B Plan-mode hardcoded "Retirement plan active" though 8 plan types exist (`:585,:598,:607`).
- **Home:** build stamp `{BUILD}` visible top-right (`:250`), "powered by 11 specialist lenses" architecture leak (`:2052`), "+N Wealth Score" deltas with no "/100" baseline (`:184,:1624,:2329`).
- **MyMoney:** `CETV` un-glossed on pension leaf (`PensionLeaf.jsx:92`), `GIA` used as a holding-name fallback `inv.name||'GIA'` (`:472,:498` — code-as-name), `ANI` in cliff copy before expansion. (Most wrapper codes ARE well-glossed via ExplainerChips — CETV/GIA-name are the outliers.)

---

## PRIORITISED BATCH-FIX QUEUE (proposed — for founder sign-off)

**P0 — FCA advice-boundary (regulatory, existential): ✅ DONE 2026-06-02 (commit 3cbbc73).** Reworded every imperative recommendation in pattern E across T&E (3 strings), Home (DIM_EXPLAINERS.lift ×7 + COI_DOMAIN_META.action ×10), Risk (RISK_DECISIONS ×5 + added "General information, not personal advice." qualifier). Substance kept, imperative voice removed, MyMoney `WhatYouCanDo` used as template. Build clean; Risk verified live (qualifier renders, no old imperatives leak).

**P1 progress (2026-06-02):** ✅ **F2 DONE (commit cd4648e)** — hero liabilities now amortise via debtMath.amortise() instead of growing; hero NW derived as Assets−Liabilities; verified live (today £1.75m/£2.16m/£410k ties; 10y forecast £2.84m/£3.19m/£353k, debt amortised down). Engine untouched → no re-baseline. ✅ **F6 DONE (commit 7664dbb)** — per-plan "Edit · Goal-seek" gated to plan types with a real solver metric (retirement→netWorth, estate→iht); others show honest "isn't available yet" text instead of a dead button. ✅ **F4 DONE (commit afb78fd)** — Cashflow viewMode now on shared useTemporalMode store (verified: clicking Future writes sonus.temporalMode='forecast'). ✅ **F1 DONE (commit afb78fd)** — default-window forecast/plan badge now prompts "pick a forward window" instead of the contradictory "projected at Current period" (verified live). ✅ **Home/Cashflow Future/Plan honest relabel DONE (commit 5d71511)** — Cashflow's false "Viewing projected figures" → "Showing today's figures…(coming soon)"; Home "coming in Phase 2" → "Headline figures still show today" + radar-shape clarification. #9 now substantially closed (F1/F2/F4/F6 + relabel). Remaining P1 (deferred): **F5 window/store desync** (fiddly — dual stores `sonuswealth.temporal` windowId vs X28 control + multiple `<select>`s; needs careful investigation) · **implement-or-relabel Home/Cashflow Future/Plan** (judgment: build real projections vs honest relabel — Home radar already moves, Cashflow shows "coming soon" chips) · (asset per-class CMA growth = refinement, not bug).

**P1 — Temporal model unification (F1/F2/F3/F4/F6):** make per-node `projectTaxonomy` the single projected-figure source (assets grow / debt amortizes; hero NW = Σassets−Σliab so the identity holds because the parts are right). Move Cashflow/T&E/Timeline onto shared `useTemporalMode`. Implement or honestly relabel Home/Cashflow Future/Plan. Fix Timeline PlanRow Edit→coming-soon (F6). Re-baseline regression after.

**P2 — Hardcoded-tax-in-copy sweep (pattern D):** 🔄 **PART 1 DONE (commit 2140008)** — T&E (dividend rates, RNRB taper, BPR cap/rate, ANI cliff ×4, PA-taper desc) + MyMoney (ANI cliff copy, HICBC £60k/£80k, fixed a latent double-£ bug) now read from `TAX`. Scoping win: the bundle already exposes every key → screen-only swaps, no engine change/re-baseline. **Remaining P2:** pension AA £60k/£260k prose + ISA £20k prose (MyMoney `:2548/2573/2954`), Home wealth-target `68` (non-tax — `getWealthTarget`), Cashflow ONS `58` + the **fabricated PoS band shape** (`terminal*t^1.2` — read engine series or label illustrative). Original note: remove the masking `??` literal fallbacks (let a missing bundle error, not silently show stale).

**P3 — Hero drillability (pattern A) + canned-text drill-ends (pattern B):** 🔄 **MyMoney hero DONE (commit c72fb64)** — NW/Assets/Liab figures now tap → NetWorthDrill (assets-vs-liabilities breakdown, verified live). **Deferred to founder's Risk reorg:** Risk Score ring tappable + Risk DimSheet canned-text decompose. **Remaining (Home, not in reorg):** Home DimExplainer canned-text → user's own facts; Home plan-% time-elapsed→money-toward-goal.

**P4 — Code/artifact leak cleanup (pattern F):** strip spec IDs, build stamp, Domain O / PRC-PCC dead sub-anchors, GIA-as-name, gloss CETV/ANI on first use.
