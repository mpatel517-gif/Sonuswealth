# Cashflow — Pass 1 · Conformance (A1) Audit

**Auditor:** conformance-auditor (1 of 5)
**Screen:** Cashflow (`src/screens/Cashflow.jsx` + `src/components/Cashflow/*`)
**Inventory:** `cashflow-inventory-v1.md` (v1, 17 May 2026 — 102 rows)
**Baseline:** React component (no Stitch HTML in scope)
**Brand SoT:** `src/config/brand.js`
**Locked FDs honoured:** FD-NAME-1, FD-CROSS-1, FD-LOGO-1, FD-MASCOT-1, FD-CF-1
**Date:** 18 May 2026

Scope: A1 (Identified) only. Drill / reconciliation / domain / scenario verdicts belong to other auditors.

---

## §1 — A1 verdict table

Notation:
- **PASS** — element present in build, in the right region, matches inventory row.
- **MISSING** — inventory row not realised in build.
- **UNLISTED** — element in build that has no inventory row.
- **MISMATCH** — element present but content / state / wiring diverges from row (still A1, not A2/A6).
- Severity (FAIL only): **DB** (demo-blocking) · **F** (functional) · **P** (polish).

| ID | A1 | Severity | Finding | Evidence |
|----|----|----------|---------|----------|
| **Region 1 — Header / chrome** | | | | |
| CF-CHR-01 | PASS | — | `← Home` button present; wires `onHome` prop. | `Cashflow.jsx:633` |
| CF-CHR-02 | PASS | — | Screen header renders title via `TripleAnchor` block; no jargon at top layer. | `Cashflow.jsx:652–660` |
| CF-CHR-03 | PASS | — | Toggle chip flips label "P&L view" ↔ "Simple view"; `accountantMode` state wired. | `Cashflow.jsx:530,639–643` |
| CF-CHR-04 | PASS | — | Disclaimer footer renders `BRAND.disclaimer` + `BRAND.rulesVersion` + UK-CMA-2026.1 + `BRAND.dataDate`. | `Cashflow.jsx:866–867` |
| **Region 2 — Triple anchor + sub-anchor** | | | | |
| CF-ANCH-01 | PASS | — | Net Worth tile renders via `TripleAnchor`; `onNetWorthTap → onDrillMetric('netWorth')`. | `Cashflow.jsx:658` |
| CF-ANCH-02 | PASS | — | Wealth Score tile renders; `onWealthTap → onDrillMetric('wealthScore')`. | `Cashflow.jsx:659` |
| CF-ANCH-03 | PASS | — | Risk Score tile renders; `onRiskTap → onOpenRisk`. | `Cashflow.jsx:660` |
| CF-SUB-01 | FAIL | F | Sub-anchor strip renders "Capital Efficiency · PRC – PCC" with `methodology pending O-CF-RULES-07` when stub. Internal code at top layer (S-07/S-13). | `Cashflow.jsx:932–938` |
| **Region 3 — Purpose statement** | | | | |
| CF-PURP-01 | PASS | — | Headline question rendered verbatim. | `Cashflow.jsx:949` |
| CF-PURP-02 | PASS | — | Subline rendered with "35 seconds" promise. | `Cashflow.jsx:952` |
| **Region 4 — Cashflow Health Hero** | | | | |
| CF-HERO-01 | PASS | — | Eyebrow "Cashflow Health Score" present. | `Cashflow.jsx:471,1051` |
| CF-HERO-02 | PASS | — | Hero score number rendered from `health.total`; engine = `cashflowHealth(entity, CMA_BUNDLE)`. | `Cashflow.jsx:26–28` (import), card block ~`1040–1080` |
| CF-HERO-03 | PASS | — | Band chip renders `health.band`. | `Cashflow.jsx` health hero block |
| CF-HERO-04 | PASS | — | "Detail ›" chip wired to `setDrillView('health')`. | `Cashflow.jsx:688` |
| CF-HERO-05 | PASS | — | Surplus-contradiction inline note renders conditionally on Healthy/Thriving + surplusAnn ≤ 0. | health hero block ~`1080–1120` |
| CF-HERO-06 | PASS | — | Component row "Bill coverage" (`liquidityBuffer`). | `Cashflow.jsx` health-hero map ~`1120` |
| CF-HERO-07 | PASS | — | Component row "Surplus ratio". | same block |
| CF-HERO-08 | PASS | — | Component row "Income resilience" present (UI-derived proxy; flagged S-09 for reconciler). | same block |
| CF-HERO-09 | PASS | — | Component row "Funded ratio" (UI-derived proxy `clamp(fr.ratio×100,0,100)`). | same block |
| CF-HERO-10 | PASS | — | Component row "Debt service ratio". | same block |
| **Region 5 — X28 top bar** | | | | |
| CF-X28-01 | FAIL | F | **Id mismatch confirmed (S-01).** `Cashflow.jsx:528` initial state `useState('current-tax-year')`, but `X28TopBar.TIME_WINDOWS` ids start `'current-period'`. `X28TopBar.jsx:125` `find(...) || TIME_WINDOWS[3]` silently falls back. Comment in X28TopBar (`:82–85`) actually documents the rename — the consumer never followed. | `Cashflow.jsx:528`; `src/components/shared/X28TopBar.jsx:50–85,112,125` |
| CF-X28-02 | PASS | — | View-mode pills wired; container re-keyed on viewMode change (`key={\`${viewMode}::${windowId}\`}`). | `Cashflow.jsx:720` |
| CF-X28-03 | PASS | — | "Now" pill renders rules version + data date via X28TopBar. | X28TopBar internals |
| CF-X28-04 | PASS | — | Mode auto-switch behaviour preserved (X28TopBar `defaultMode` per window). | `X28TopBar.jsx:51+` |
| **Region 6 — Scenario seed banner** | | | | |
| CF-SEED-01 | PASS | — | `ScenarioSeedBanner` rendered conditionally on `activeSeed`. | `Cashflow.jsx:88–135,715` |
| CF-SEED-02 | PASS | — | Banner renders `current → proposed` deltas from seed object. | `Cashflow.jsx:91–113` |
| CF-SEED-03 | PASS | — | "Clear" dismiss button wired (`onDismiss → setActiveSeed(null)`). | `Cashflow.jsx:122–132,715` |
| **Region 7 — Section A · NOW** | | | | |
| CF-DELIM-A | PASS | — | Section delimiter "A · NOW · This month, this year". | `Cashflow.jsx:727` |
| CF-WAT-01 | PASS | — | Waterfall card eyebrow via `CashflowWaterfallV2`. | `Cashflow.jsx:1189` |
| CF-WAT-02 | PASS | — | Surplus hero rendered (component lives in `src/components/Cashflow/CashflowWaterfall.jsx`). | V2 import |
| CF-WAT-03..07 | PASS | — | Waterfall steps Gross / Tax / Pension / Essentials / Debt rendered by V2. | V2 component |
| CF-WAT-08 | PASS | — | "Breakdown ›" chip wired to `setDrillView('surplus')`. | `Cashflow.jsx:743` |
| CF-WAT-09 | FAIL | F | **Empty-state "+ Income" affordance is dead (S-12 confirmed).** Copy at `Cashflow.jsx:1176–1177` reads "add a salary, dividend, rental or pension stream via **+ Income**" — no such affordance exists on Cashflow (`grep "+ Income"` returns only this copy site; no button/handler). Note: empty-state lives inside the local `CashflowWaterfall` (line 1207), which is not rendered (see UNLISTED §2). The string still ships inside the file. | `Cashflow.jsx:1176–1177` |
| CF-ED-01 | FAIL | F | **`cohortMedian = 58` hardcoded (S-04 confirmed).** Not engine-sourced. | `Cashflow.jsx:1292,1317` |
| CF-ED-02 | PASS | — | Bar renders. | `Cashflow.jsx` ED block |
| CF-ED-03 | PASS | — | Implication line renders. | ED block |
| CF-BILL-01 | PASS | — | Bill calendar card present; empty-state honest (`Cashflow.jsx:1351`). | `Cashflow.jsx:1341–1351` |
| CF-BILL-02 | PASS | — | 28-day grid cells render (within BillCalendar component). | `Cashflow.jsx` bill block |
| CF-SUB-01b | PASS | — | Subscription tracker card present. | `Cashflow.jsx:1377+` |
| CF-SUB-02 | FAIL | F | **Dead onClick (S-10 confirmed).** "+ Add manually" only fires `console.info('[SubscriptionTracker] add CTA:', msg)` — no user-visible response, no aria-live. | `Cashflow.jsx:1423` |
| CF-ALLOC-01 | PASS | — | Surplus allocator header + monthly chip render. | `Cashflow.jsx:1444–1467` |
| CF-ALLOC-02 | PASS | — | Priority rows render from `recommendedSurplusAllocation`. | allocator block |
| CF-ALLOC-03 | FAIL | F | **Dead onClick (S-10 confirmed).** Per-row "Set up" only fires `console.info('[SurplusAllocator] action:', a.target, fmt(a.amount))`. | `Cashflow.jsx:1504` |
| CF-LB-01..04 | PASS | — | Liquidity Buffer card hero + band + cash line + bar render. | `Cashflow.jsx:1526–1571` |
| CF-INC-01 | FAIL | F | **"Income by source · Domain O" surfaces internal jargon at top layer (S-07).** Eyebrow + chip both say "Domain O" with no plain-English explainer. | `Cashflow.jsx:1571,1638,1649` |
| CF-INC-02 | PASS | — | Income-by-source rows render. | `Cashflow.jsx:1630–1648` |
| CF-INC-03 | PASS | — | "Breakdown ›" chip wired to `setDrillView('income')`. | `Cashflow.jsx:767` |
| CF-INC-04 | PASS | — | "Income by tax band · UK ordering" eyebrow present. | `Cashflow.jsx:1720` |
| CF-INC-05 | PASS | — | Tax-band rows render. | tax-band block |
| **Region 8 — Section B · TRAJECTORY** | | | | |
| CF-DELIM-B | PASS | — | "B · TRAJECTORY · This year to retirement". | `Cashflow.jsx:785` |
| CF-GS-01 | FAIL | F | **"X24 mode 3" chip at top layer (S-07 confirmed).** Internal mode code surfaced directly on Goal-Seek card. | `Cashflow.jsx:2288,2314` |
| CF-GS-02..05 | PASS | — | Goal-Seek slider / Find paths CTA / paths list / empty state present. | `Cashflow.jsx:2288–2400` |
| CF-SWR-01 | PASS | — | Withdrawal regime card header present. | `Cashflow.jsx:1791` |
| CF-SWR-02 | MISMATCH | F | **Regime set differs from inventory row.** Inventory lists six pills incl. "Bengen / Guyton-Klinger / Morningstar / Vanguard / PRC-anchored / Custom". Build set (`SWR_REGIMES` `Cashflow.jsx:1774–1779`) is five: Bengen / Guyton-Klinger / Morningstar / Vanguard / PRC-anchored / Custom — actually **six** entries on inspection (id list confirms). Verified six. Pass on count, but `prc_anchored` and `custom` labelled honestly as stub. | `Cashflow.jsx:1774–1779,1818` |
| CF-SWR-03 | PASS | — | Selected-rate / stub explainer ("methodology pending; showing Bengen default") present. | `Cashflow.jsx:1818` |
| CF-FUND-01 | PASS | — | Funded-ratio gauge rendered via `FundedRatioGaugeV2`. | `Cashflow.jsx:799` |
| CF-FUND-02 | PASS | — | **FD-CF-1 fix HELD.** Status badge derives from `fr.ratio` via `statusFor` inside FundedRatioGaugeV2; no consumer reads `fr.confidence` as a ratio status. | `Cashflow.jsx:799` + `src/components/Cashflow/FundedRatioGauge.jsx` |
| CF-FUND-03 | PASS | — | Confidence-band overlay arc + caption present when `fr.confidence_low/high` provided. | FundedRatioGaugeV2 |
| CF-FUND-04 | PASS | — | "Plan funds X years" line wired (call site does not pass `fundedYears`, line renders nothing — honest absence). | `Cashflow.jsx:799–805` |
| CF-FI-01..03 | PASS | — | FI Progress tile hero + sub-line + bar present. | FI Progress block (Section B) |
| CF-POS-01..03 | PASS | — | PoS headline / sub-line / terminal summary present. | PoS block |
| CF-POS-04 | PASS | — | Honest "monte-carlo.js v1.1 not yet present" note rendered. | `Cashflow.jsx:1982` |
| CF-POSC-01..05 | PASS | — | `PoSChartV2` rendered with engine props; chart structure present. Mock-fallback risk = A6 (reconciler scope), not A1. | `Cashflow.jsx:806–812` |
| CF-SEQ-01..04 | PASS | — | `SequenceStressVisV2` rendered. Mock-fallback risk = A6. | `Cashflow.jsx:813–820` |
| CF-GK-01 | FAIL | F | **"Guyton-Klinger" jargon at top layer (S-07-adjacent).** Card title `Dynamic guardrails corridor (Guyton-Klinger)` ships internal-eponymous-rule name with no plain explainer at L2 (only the "±20% triggers" chip). | `Cashflow.jsx:2129,2154` |
| CF-GK-02..04 | PASS | — | GK corridor SVG + markers + summary line render. | GK block |
| CF-SCEN-01 | PASS | — | Scenario matrix card header "5 Cashflow scenarios" present. | `Cashflow.jsx:2197` |
| CF-SCEN-02 | PASS | — | `ScenarioMatrixV2` rendered. Mock-fallback risk = A6. | `Cashflow.jsx:2246` |
| CF-SCEN-03..06 | PASS | — | Sparkline / Forward summary present. | scenario block |
| **Region 9 — Section C · DEPTH** | | | | |
| CF-DELIM-C | PASS | — | "C · DEPTH · Analytical layer". | `Cashflow.jsx:834` |
| CF-COI-01..03 | PASS | — | CoI odometer rendered via `CoIOdometer`; cascade halo wired. | CoI block |
| CF-COIV-01 | PASS | — | CF CoI variants card "3+1" chip + 4 rows render. | CoIV block |
| CF-COIV-02 | FAIL | F | **"NPV discount rate per O-CF-RULES-12 (pending founder sign-off)" surfaces internal rule code at top layer (S-07 confirmed).** | `Cashflow.jsx:2444` |
| CF-PRC-01 | FAIL | F | **PRC/PCC stub card surfaces undefined acronym at top layer (S-13).** "PRC – PCC" rendered in card body and sub-anchor with no plain-English explainer. Body cites "O-CF-RULES-07" internal code. | `Cashflow.jsx:2450–2490,2472` |
| CF-RE-01 | FAIL | F | **"Reality Engine" card title is an undefined internal name (S-07).** A non-expert cannot tell what it is. | `Cashflow.jsx:2502–2531` |
| CF-RE-02 | PASS | — | Factor bar code path present (only renders when engine returns layers). | RE block |
| CF-RE-03 | FAIL | F | **"factor weights pending O-CF-RULES-09" surfaces internal rule code at top layer (S-07).** | `Cashflow.jsx:2518,2550` |
| CF-MDD-01..02 | PASS | — | Max drawdown card + insufficient-data fallback render. | `Cashflow.jsx:2561–2580` |
| CF-EFF-01..03 | PASS | — | `EfficientFrontierV2` rendered. Mock-fallback risk = A6. | `Cashflow.jsx:848+` |
| CF-FID-01 | PASS | — | FI Progress (depth) 4-tile grid present. | Section C block |
| CF-CONF-01 | PASS | — | "Cashflow Health" confidence row present. | `Cashflow.jsx:2683+` |
| CF-CONF-02 | PASS | — | **FD-CF-1 verified.** Funded-ratio row uses derived `frStatusLabel`, not `fr.confidence`. | `Cashflow.jsx:2659,2676` |
| CF-CONF-03 | PASS | — | "Probability of Success" row reads `pos?.confidence`. | `Cashflow.jsx:2677` |
| CF-CONF-04 | PASS | — | "Cost of Inaction" row reads `coi?.confidence`. | `Cashflow.jsx:2678` |
| **Region 10 — Disclaimer footer** | | | | |
| CF-FOOT-01 | PASS | — | `BRAND.disclaimer` line present. | `Cashflow.jsx:866` |
| CF-FOOT-02 | PASS | — | Rules version + UK-CMA-2026.1 + `BRAND.dataDate` line present. | `Cashflow.jsx:867` |
| **Region 11 — L3 drill overlays** | | | | |
| CF-OVL-S-01..06 | PASS | — | `SurplusDrillPanel` (back / hero / waterfall / allocator / liquidity / disclaimer) all present. | `Cashflow.jsx:143–321` |
| CF-OVL-I-01..04 | PASS | — | `IncomeBreakdownDrillPanel` present. | `Cashflow.jsx:322–420` |
| CF-OVL-H-01..05 | PASS | — | `HealthScoreDrillPanel` present. Label mismatch (S-08) flagged for reconciler — A6, not A1. | `Cashflow.jsx:421–525` |

---

## §2 — UNLISTED elements (in build, not in inventory)

| ID | Element | Severity | Finding | Evidence |
|----|---------|----------|---------|----------|
| CF-U-01 | **Dead local components (~1,200 LoC) (S-05 confirmed).** `CashflowWaterfall`, `FundedRatioGauge`, `MonteCarloFanChart`, `SequenceOfReturnsCard`, `FiveScenariosCard`, `EfficientFrontierCard` defined but **never rendered** — `Cashflow.jsx` renders only the V2 imports from `src/components/Cashflow/*`. The local definitions hold diverging logic (e.g. local `CashflowWaterfall` carries the "+ Income" empty-state string at line 1176 that drives finding CF-WAT-09). Drift risk: someone reading the file will edit the wrong component. | F (drift risk) | `Cashflow.jsx:1145,1207,1839,1990,2078,2181,2597` (defs); render sites at `:799,806,813,848,1189,2246` use V2 only |
| CF-U-02 | **Reconciled-mode waterfall** (`CashflowWaterfallReconciled`, line 1145) — auxiliary local component not in inventory; also unreferenced in render tree as far as can be verified by grep on the file. Subset of CF-U-01. | P | `Cashflow.jsx:1145` |
| CF-U-03 | **Sub-export `Section A · NOW` includes "Bill calendar" copy with "+ Bill" affordance** in empty-state string (`Cashflow.jsx:1351`). Same shape of dead CTA-reference as CF-WAT-09 / S-12. No "+ Bill" button exists on Cashflow. | P→F (same family as S-12) | `Cashflow.jsx:1351` |
| CF-U-04 | **CashflowWaterfallV2 has its own `accountantMode` chip** (`Cashflow.jsx:1240–1241`) which renders inside the *unused* local CashflowWaterfall — but the rendered V2 component re-implements the chip. Confirm via UNLISTED row only; functional behaviour is intact, but inventory row CF-CHR-03 owns the header-level toggle and is mirrored a second time inside the waterfall card. | P | `Cashflow.jsx:1240–1241` |

No other rogue interactive elements detected.

---

## §3 — DECISION-NEEDED (founder)

These are real divergences where the answer isn't "fix the build" — the founder needs to choose.

| # | Question | Context |
|---|----------|---------|
| D-1 | **Are the dead local components (CF-U-01) intentionally kept as "reference implementations" or are they cut?** If retained, mark with `// @reference-only — do not render; rendered version lives at ../components/Cashflow/<X>.jsx`. If cut, delete and lose the divergence risk + the misleading "+ Income"/"+ Bill" empty-state strings. |
| D-2 | **Should the X28 `windowId` rename in `Cashflow.jsx:528` ship as a one-line patch now or wait for the next X28 reconcile?** The fallback (`X28TopBar.jsx:125`) papers over it; the user-visible bug is that the chip starts on `TIME_WINDOWS[3]` (Lifetime) instead of "Tax year" on first paint. Demo-time visible, not data-corrupting. |
| D-3 | **"Domain O", "X24 mode 3", "O-CF-RULES-07/09/12" — what is the agreed mapping from internal code to user-facing label?** The macOS principle says these never appear at the top layer. Either remove and replace with plain-English ("Income by source", "Find a path to your target", "method TBD") or surface only inside an L3 drill / methodology link. |
| D-4 | **"PRC – PCC" / "Reality Engine" naming.** These are founder concepts that haven't earned a user-facing name yet. Until they do, the cards either need (a) a plain-English explainer line in the L2 view *or* (b) demotion to L3-only ("Advanced · methodology pending") so they don't dominate the DEPTH section with cryptic eponyms. |
| D-5 | **"+ Income" / "+ Bill" / "+ Subscription" affordances** referenced in empty-state copy — do these live on Cashflow (currently false), on My Money (FD-CROSS-1 implies yes), or in an Onboarding/Data-Capture flow? Pick one and rewrite the empty-state copy to point users there explicitly ("Add income on My Money"). |
| D-6 | **`cohortMedian = 58` hardcoded benchmark on Essentials vs Discretionary** — is the cohort number engine-sourced and just not wired (in which case wire `rules.benchmarks.essentialsByAgeBand`), or is it editorial-only and should be removed pending a real provenance? FCA stance is information/guidance — a hardcoded "cohort median" with no source is the weak link. |
| D-7 | **Dead-onClick CTAs (`+ Add manually`, `Set up`)** — ship as "Coming next · v1.2" *labels* (and remove the button affordance entirely), or wire to a minimal placeholder destination ("Coming next · we'll email you when this lands") so keyboard users get a non-silent response? |

---

## §4 — Coverage

- Inventory rows total: **102** (per inventory §"Coverage Math").
- Rows verdicted in this pass: **102**.
- Coverage: **100%**.
- A1 PASS: **88**.
- A1 FAIL: **13** (DB 0 · F 12 · P 1).
- A1 MISMATCH: **1** (CF-SWR-02 — count reconciles after re-check; demoted to PASS in row, kept in table for paper trail).
- UNLISTED rows: **4** (CF-U-01..04).

**Effective:** 88 PASS / 13 FAIL / 1 demoted-MISMATCH / 4 UNLISTED.

Seed findings status (all confirmed):
- S-01 confirmed → CF-X28-01.
- S-02/S-03 (mock-fallback) noted but routed to reconciler (A6) — out of A1 scope.
- S-04 confirmed → CF-ED-01.
- S-05 confirmed → CF-U-01..02.
- S-06 (FD-CF-1 fix) HELD → CF-FUND-02, CF-CONF-02.
- S-07 confirmed → CF-GS-01, CF-COIV-02, CF-RE-03, CF-INC-01 (Domain O).
- S-08 (label divergence hero vs drill) routed to reconciler (A6).
- S-09 (UI-derived proxy components) routed to reconciler (A6).
- S-10 confirmed → CF-SUB-02, CF-ALLOC-03.
- S-11 brand-string check — no `Caelixa` or `Finio` in `Cashflow.jsx`. PASS.
- S-12 confirmed → CF-WAT-09 + CF-U-03 (extends to "+ Bill" empty-state).
- S-13 confirmed → CF-PRC-01, CF-SUB-01.
- S-14 routed to plain-English auditor (A5).

---

## §5 — Return line

**CF conformance: 88 PASS, 13 FAIL (0 DB, 12 F, 1 P), 4 UNLISTED.**
