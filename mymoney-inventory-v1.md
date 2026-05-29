# My Money Screen — Element Inventory v1

**Screen:** Sonuswealth My Money (build: `src/screens/MyMoney.jsx`)
**Status:** Enumerated from React component (`src/screens/MyMoney.jsx`, 3473 lines)
+ imported MyMoney/* panels + overlays. Seed (screenshot-derived) rows preserved
and marked `(scrn-confirmed)` where the component matches; new rows added from
JSX walk. Awaiting founder review before five auditors run.
**Design baseline:** No HTML mockup in repo (component IS the structural truth — flagged in header per inventory-builder rule).
**Spec / intent reference:** `2-Product/2-Product-mymoney-v2_7.md` (cited at top of component).
**Reconciliation baseline:** engine — `src/engine/fq-calculator.js` + `src/engine/modules/*` (UK rules in `UK-2026.1.1.json`); brand SoT — `src/config/brand.js`.

---

## How to use

Identical discipline to `home-inventory-v1.md`: every element is one row; the audit walks
rows and records a verdict per row; the six assertions (A1–A6) and the
SOURCE/ACTION/DECISION drill rule apply. See `home-inventory-v1.md` for the full legend —
not repeated here.

`Verdict`: `PASS` · `FAIL` · `NA` · `UNVERIFIED` (default) · `BLOCKED`.
`Owns-subject destination`: the *expected* drill target, routed by the element's domain.

## Screen context

My Money is the **19-domain** money surface: twin-anchor cashflow + balance-sheet hero,
pivot toggle (Balance sheet / Income / Cash flow / Insurance / Bonds), 5-method drawdown
framework, 5 director-intelligence cards (gated by `hasPersonaFlag('director')`), NRI
gate (`hasPersonaFlag('nri')`). Pension / SIPP / drawdown is **owned here** — this is
where Home's "Start pension drawdown" action should land (PensionDrillDown overlay,
§4.5.1–§4.5.6, with editable schedule + commit bar firing `DRAWDOWN_SCHEDULE_SET`).

## Confirmed founder decisions

| FD | Decision |
|----|----------|
| FD-NAME-1 | Product name is **Sonuswealth** (D-NAME-2, locked 9 May 2026, `src/config/brand.js` is SoT). Casing: logo lowercase, body sentence-case, slogans all-caps allowed. Sonuswealth / Finio in user-facing strings = FAIL. See `home-inventory-v1.md` for full rule. |
| FD-CROSS-1 | Every critical action is a **surface-instance**, not a pointer — each surface owns its own angle/layout/data. **My Money owns the doing** for pension/SIPP/drawdown (the canonical surface — `PensionDrillDown` overlay with editable schedule, presets, projection, commit). Other surfaces (Home/T&E/Timeline/Cashflow/Risk) each present their own angle of the same action with their own data. See `home-inventory-v1.md` for the angles table. Supersedes prior FD-MM-2 wording. |
| FD-LOGO-1 | Brand assets at `Codex UI/deliverables/sonuswealth-site/assets/`. See home-inventory FD-LOGO-1. |
| FD-MASCOT-1 | Sonnu (owl), 6 life-stage forms. Placement = Wave 7. See home-inventory FD-MASCOT-1. |
| FD-MM-1 | Layout order frozen — audit fixes what exists, adds no components (Waves 0–6). |

---

## ELEMENT TABLE

### Region 1 — Shell / chrome
Same as Home `H-CHR-01..12`. Reconcile sidebar + topbar score chip identically.
Component receives `onHome`, `onOpenRisk`, `onDrillMetric`, `onNav` from parent App router.

### Region 2 — X28 top bar + plan banner + screen purpose

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-X28-01 | X28TopBar — 7 time windows (current-period / +1y / +3y / +5y / +10y / +20y / retirement) | NAV | mode state = windowId | UNVERIFIED | `setWindowId`; affects projection via `netWorthAtWindow` |
| MM-X28-02 | X28TopBar — view-mode pills (Actual / Forecast / Plan / Scenario) | NAV | mode state = viewMode | UNVERIFIED | `setViewMode`; triggers `sw-tab-slide` re-key cascade |
| MM-X28-03 | X28TopBar — rules-version chip (`BRAND.rulesVersion`) | DATA | SOURCE — rules version detail | UNVERIFIED | A6 — must match brand.js |
| MM-X28-04 | X28TopBar — data-date chip (`BRAND.dataDate`) | DATA | SOURCE — data freshness | UNVERIFIED | A6 |
| MM-HDR-01 | "← Home" back button | ACTION | Home screen | UNVERIFIED | `onHome` prop |
| MM-HDR-02 | "FORECAST · variance overlay active" pill (when viewMode !== 'actual') | DATA | NA (state indicator) | UNVERIFIED | only visible when viewMode ≠ actual |
| MM-PLN-01 | PlanStalenessBanner — stale-plans list | DATA+ACTION | ACTION — Timeline (where plans live), deep-linked via planId | UNVERIFIED | `onReview` → `onNav('timeline', {planId})`; only renders critical plans |
| MM-PUR-01 | Screen-purpose eyebrow "MyMoney · What do I own, what do I owe, and what comes in?" | DATA | NA | UNVERIFIED | A5 plain-English check |

### Region 3 — Net-position sentence (Phase 2A — one-line verdict)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-NPS-01 | Urgent-signal sentence (1 of 4 branches based on surplus/runway/FI ratio) | DATA | NA | UNVERIFIED | A5 — must read as plain English; A6 — figures must reconcile to `monthlySurplus`, `investable`, `targetIncome*25` |
| MM-NPS-02 | Supporting-signal sub-sentence | DATA | NA | UNVERIFIED | A5 |
| MM-NPS-03 | Banner background coral when `!pos` (deficit) | DATA | NA (visual) | UNVERIFIED | semantic colour check |

### Region 4 — Cashflow banner (`SurplusTile` — deficit users show ABOVE anchor, surplus users BELOW)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BAN-00 | Section header "Monthly cash flow" + ProvenanceChip | DATA | NA | UNVERIFIED | provenance: "Your data · Apr 2026" — verify date is live |
| MM-BAN-01 | Headline "−£10.0k · spending records income this month" — `SurplusTile` hero (scrn-confirmed) | DATA | SOURCE — Cashflow detail | UNVERIFIED | from `monthlySurplus(entity)`; copy is unclear English (A5); reconcile sign + value |
| MM-BAN-02 | "Liquid cash covers X months at this rate" runway warning (scrn-confirmed) | DATA | SOURCE — cash runway detail | UNVERIFIED | only renders when `!pos`; urgent < 3mo / warn < 6mo |
| MM-BAN-03 | Income-vs-spend bar — `CashFlowSankey` (4-seg proportional bar) (scrn-confirmed) | DATA | SOURCE — Cashflow | UNVERIFIED | shows Essentials / Debt / Committed / Surplus-or-Shortfall |
| MM-BAN-03a | Sankey income marker line (deficit users only) | DATA | SOURCE — income | UNVERIFIED | white line at `(income/totalBarV)%` |
| MM-BAN-03b | Sankey legend (4 dot-rows: label + £/mo) | DATA | SOURCE — segment detail | UNVERIFIED | |
| MM-BAN-04 | Mini-tile — Monthly income (scrn-confirmed) | DATA | SOURCE — income detail | UNVERIFIED | **£0 for £3.63m persona — see seed MM-S-01; engine fn = `monthlySurplus(entity).income`** |
| MM-BAN-05 | Mini-tile — Essentials | DATA | SOURCE — essentials detail | UNVERIFIED | from `monthlySurplus.essential` |
| MM-BAN-06 | Mini-tile — Debt payments (scrn-confirmed) | DATA | SOURCE — debt detail | UNVERIFIED | from `monthlySurplus.debtService` |
| MM-BAN-07 | Mini-tile — Committed (scrn-confirmed) | DATA | SOURCE — commitments detail | UNVERIFIED | from `monthlySurplus.committed` |
| MM-BAN-08 | Self-comparison delta "↑ £X net worth vs last month" footer | DATA | SOURCE — NW history | UNVERIFIED | from `entity.trajectories.netWorthHistory[-2..-1]`; conditional render |

### Region 5 — Triple-score anchor (`TripleAnchor` component)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-SCR-01 | Net Worth card (£3.63m) (scrn-confirmed) | ANCHOR | SOURCE — balance sheet (R8) | UNVERIFIED | `netWorth(e)`; must equal Home + balance sheet hero; `onNetWorthTap` → `onDrillMetric('netWorth')` |
| MM-SCR-02 | Wealth Score card (47) (scrn-confirmed) | ANCHOR | SOURCE — score breakdown | UNVERIFIED | `calcFQ(e).total`; must equal Home value; `onWealthTap` → `onDrillMetric('wealthScore')` |
| MM-SCR-03 | Risk Score card (56) (scrn-confirmed) | ANCHOR | SOURCE — Risk screen | UNVERIFIED | `calcRisk(e).total`; `onRiskTap` → `onOpenRisk` |
| MM-SCR-04 | NW DeltaChip ("net worth change vs last month") | DATA | SOURCE — NW month-over-month | UNVERIFIED | derived strictly from `trajectories.netWorthHistory[-2..-1]`; renders nothing when <2 points |
| MM-SCR-05 | VarianceBadge (Δ vs actual mode) | DATA | NA (mode indicator) | UNVERIFIED | only when `viewMode !== 'actual'` |
| MM-SCR-06 | nwTrendPct (sparkline trend %) | DATA | SOURCE — NW history | UNVERIFIED | from `((last-prev)/prev)*100` |

### Region 6 — "How your money is held" (`WrapperCompositionBar`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-WS-00 | Section eyebrow "How your money is held" + ExplainerChip MM-2 | DATA | NA | UNVERIFIED | A5 |
| MM-WS-01 | Composition bar — segments per wrapper (PENSION/ISA/GIA/EIS/SEIS/VCT/BOND_ON/BOND_OFF/CASH/PROPERTY/UNKNOWN) (scrn-confirmed) | DATA+ACTION | filter state = filterWrapper | UNVERIFIED | each segment is a button; toggles `setFilterWrapper`; sized by total £ |
| MM-WS-02 | Composition bar — UNKNOWN diagonal-stripe segment | DATA | ACTION — Add wrapper details (opens AssetCaptureSheet) | UNVERIFIED | dashed border; flags unresolved tax treatment |
| MM-WS-03 | Wrapper badge row beneath bar (clickable label + £) | ACTION | filter state | UNVERIFIED | mirrors segment buttons |
| MM-WS-04 | "WRAPPER? — X of your assets can't be classified" alert + "Add wrapper details" CTA | ACTION | ACTION — AssetCaptureSheet (`setAddOpen(true)`) | UNVERIFIED | only when `unknownAmount > 0`; routes to legacy AssetCaptureSheet not bucket-pattern AddItemSheet — verify |
| MM-WS-05 | Active filter chip "Showing X only — clear ×" | ACTION | clears filterWrapper | UNVERIFIED | only when `filterWrapper !== null` |

### Region 7 — ANI cliff-edge warning (`CliffEdgeWarning`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-CLF-01 | Cliff warning banner — "£Xk from the £100k income cliff" OR "£100k income threshold passed" | DATA | SOURCE — ANI / tax cliff detail | UNVERIFIED | only when `ani > 80,000`; from `calcANI(entity).ani` |
| MM-CLF-02 | Pension-to-solve copy (recommended contribution to fall below £100k) | DATA+ACTION | ACTION — pension contribution flow | UNVERIFIED | A5 + A6 — must reconcile to AA headroom |
| MM-CLF-03 | Progress bar to cliff + 60% marker | DATA | SOURCE — taper detail | UNVERIFIED | |

### Region 8 — Priority cards (`PriorityCards`, max 3 attention-needed)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-PRI-00 | Eyebrow "Needs your attention" | DATA | NA | UNVERIFIED | hidden when all 5 metrics green (shows "All five metrics are healthy" card instead) |
| MM-PRI-01 | Card — Emergency cover (🛡) — months runway (scrn ≈ "safety net") | DATA+ACTION | SOURCE — cash runway / ACTION — build cash | UNVERIFIED | `cash / monthlySpend`; opens action body on tap; only renders when `monthlySpend > 0` |
| MM-PRI-02 | Card — Debt burden (⚖) — payoff years | DATA+ACTION | SOURCE — debt / ACTION — repayment plan | UNVERIFIED | |
| MM-PRI-03 | Card — Retirement funded (🎯) — % of FI target (scrn-confirmed "Retirement funded 65%") | DATA+ACTION | SOURCE — retirement funding / ACTION — increase pension | UNVERIFIED | reconcile to engine; **scrn shows 65% — verify** |
| MM-PRI-04 | Card — Estate efficiency (🏛) — "Xp/£" (scrn-confirmed "64p/£") | DATA+ACTION | SOURCE — Tax & Estate | UNVERIFIED | A5 — "p/£" is jargon (seed MM-S-07); from `effectiveBeneficiaryRate(entity).rate` |
| MM-PRI-05 | Card — Tax shelter usage (📊) — % (scrn-confirmed "0%") | DATA+ACTION | SOURCE — tax shelter detail | UNVERIFIED | **scrn 0% vs £800k ISA = MM-S-02 reconciliation FAIL; from `taxEfficiencyScore(entity).total`** |
| MM-PRI-0x | Per-card "Act now"/"Watch" band chip + BulletChart (% of target) | DATA | NA (visual band) | UNVERIFIED | band thresholds: bad/warn/good |
| MM-PRI-0y | Per-card expanded action body (on tap) | DATA | ACTION — recommended next step | UNVERIFIED | A4 — copy proposes specific action |
| MM-PRI-06 | "+ N more metrics also need attention" footer | DATA | NA | UNVERIFIED | only when `>3` bad |

### Region 9 — "Cost of doing nothing" ranked panel (Phase 1F)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-COI-00 | Header "Cost of doing nothing — Ranked by annual cost" | DATA | NA | UNVERIFIED | A5 |
| MM-COI-01 | "Total est. £X/yr" — canonical aggregate | DATA | SOURCE — totalCoI breakdown | UNVERIFIED | from `totalCoI(entity).total` (not regex sum) |
| MM-COI-02 | Top 4 ranked rows (1–4 ordinal markers, copy from `coiForDomain`) | DATA+ACTION | SOURCE — per-domain CoI / ACTION — owning surface for that domain | UNVERIFIED | scrn-confirmed "Critical action — Start pension drawdown (£412k)" — MM-ACT-01 in seed; **£412k vs Home £340k → seed MM-S-03 reconciliation FAIL** |

### Region 10 — Decumulation panel ("Which pot to draw from first")

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-DEC-00 | Card title "Which pot to draw from first" + "X yr to retirement" accessory (scrn-confirmed) | DATA | NA | UNVERIFIED | when `investable(entity) < 10000` → empty-state body with CTA "Set up your drawdown plan →" |
| MM-DEC-01 | Intro copy "The sequence you draw from these pots determines your tax bill in retirement..." | DATA | NA | UNVERIFIED | A5 |
| MM-DEC-02 | Sequence row 1 — GIA (taxable account) — £X · "CGT on gains..." | DATA | SOURCE — GIA detail | UNVERIFIED | |
| MM-DEC-03 | Sequence row 2 — ISA (tax-free) — £X · "Zero tax on withdrawal..." | DATA | SOURCE — ISA detail | UNVERIFIED | reconcile to MM-AST-02 / MM-PRI-05 |
| MM-DEC-04 | Sequence row 3 — SIPP / Pension — £X · "25% tax-free lump sum..." | DATA | SOURCE — pension detail / ACTION — PensionDrillDown | UNVERIFIED | sequencing of pension drawdown — links to canonical pension drill |
| MM-DEC-05 | Footer "Total investable £X · At 4% SWR £Y/yr" | DATA | SOURCE — SWR detail | UNVERIFIED | A6 |
| MM-DEC-06 | Empty-state CTA "Set up your drawdown plan →" (when `inv < 10000`) | DATA | NA (currently inert — see notes) | UNVERIFIED | **`accessory` is a `<span>` not a button — no onClick — flag (A2 FAIL risk; pre-launch CTA honesty)** |

### Region 11 — Section delimiter "Balance sheet"

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BS-DEL | Section delimiter card — eyebrow "Your financial picture" / title "Balance sheet" / sub "Tap any tile to drill into it · tap + Add to capture new items" | DATA | NA | UNVERIFIED | A5 — promises drillability + Add |

### Region 12 — Pivot toggle (Balance sheet / Income / Cash flow / Insurance / Bonds)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-PIV-01 | Pivot pill — Balance sheet (active default) (scrn-confirmed) | NAV | pivot state = 'balance-sheet' | UNVERIFIED | renders TileGrid |
| MM-PIV-02 | Pivot pill — Income (scrn-confirmed) | NAV | pivot state = 'income' | UNVERIFIED | renders `IncomeView` |
| MM-PIV-03 | Pivot pill — Cash flow (scrn-confirmed) | NAV | pivot state = 'cashflow' | UNVERIFIED | renders `CashflowView` |
| MM-PIV-04 | Pivot pill — Insurance (scrn-confirmed) | NAV | pivot state = 'insurance' | UNVERIFIED | renders `InsuranceView` |
| MM-PIV-05 | Pivot pill — Bonds (scrn-confirmed) | NAV | pivot state = 'bonds' | UNVERIFIED | renders `BondsView` |

### Region 12A — Pivot content: Income view (`PivotView.IncomeView`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-INC-HRO | Hero "Money coming in · £X/mo" + sub "£X a year · taxable income £X · marginal rate X%" | DATA | SOURCE — income aggregate | UNVERIFIED | |
| MM-INC-T1 | Tile — Total each year | DATA | SOURCE | UNVERIFIED | |
| MM-INC-T2 | Tile — Taxable income (HMRC) | DATA | SOURCE — ANI panel | UNVERIFIED | from `entity.income.ani` |
| MM-INC-T3 | Tile — Marginal rate | DATA | SOURCE — bands detail | UNVERIFIED | from `entity.income.marginal_rate` |
| MM-INC-T4 | Tile — Income sources count | DATA | NA | UNVERIFIED | |
| MM-INC-R0 | Group "Where your income comes from" | DATA | NA | UNVERIFIED | |
| MM-INC-R1..10 | Per-stream rows (Salary, Dividends, SE, Rental, State pension, DB pension, DC drawdown, Interest, Overseas, Trust) — only renders rows with `monthly > 0` | DATA | SOURCE — per-stream detail | UNVERIFIED | each with tax note + share bar |
| MM-INC-BND | Group "Where each pound of your income lands" — 4 band rows (Tax-free / Basic / Higher / Additional) | DATA | SOURCE — band detail | UNVERIFIED | |
| MM-INC-ALW | Group "How much of your tax-free allowances you've used this year" — 4 tiles (ISA / Pension AA / CGT / Dividends) | DATA | SOURCE — AllowancesPanel | UNVERIFIED | reconcile to MM-TAX rows |

### Region 12B — Pivot content: Cash flow view (`PivotView.CashflowView`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-CF-HRO | Hero "+£X/mo" or "−£X/mo" + sub | DATA | SOURCE — Cashflow screen | UNVERIFIED | A3 — should drill TO Cashflow screen, not just summarize |
| MM-CF-T1 | Tile — Monthly income | DATA | SOURCE | UNVERIFIED | |
| MM-CF-T2 | Tile — Monthly outgoings | DATA | SOURCE | UNVERIFIED | |
| MM-CF-IN | Income breakdown group — 6 rows (Salary, Dividends, Rental net, State pension, Bank interest, Other) | DATA | SOURCE | UNVERIFIED | |
| MM-CF-SP | Spending breakdown group — 5 rows (Essential, Mortgage/rent, Debt repayments, Family commitments, Pension contributions) | DATA | SOURCE | UNVERIFIED | |
| MM-CF-IT | Insight group "What this means for you" — surplus or deficit prose | DATA | NA | UNVERIFIED | A5 |

### Region 12C — Pivot content: Insurance view (`PivotView.InsuranceView`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-INS-HRO | Hero "What you're insured for · £X life cover · £Y annual premium · N policies" | DATA | SOURCE | UNVERIFIED | |
| MM-INS-T1..4 | 4 tiles — Total life cover · Total premium · Active policies · Pillars covered (N/4) | DATA | SOURCE | UNVERIFIED | |
| MM-INS-GAP | "Protection gaps" group — 4 pillar cards (Die / Seriously ill / Can't work / Fall ill non-urgent) | DATA | ACTION — protection (Risk screen) | UNVERIFIED | benchmarks: life 10× / CI 5× / IP 60% |
| MM-INS-G1..6 | Policy groups — Life & death · Health & illness · Income replacement · Business protection · General insurance · Business cover | DATA | SOURCE — per-policy detail | UNVERIFIED | each row: provider, premium, cover, trust chip |
| MM-INS-EMP | Empty state "No policies captured" group | DATA | ACTION — Add via Protection tile | UNVERIFIED | A5 |

### Region 12D — Pivot content: Bonds view (`PivotView.BondsView`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BND-HRO | Hero "Bonds — gilts, corporate, and investment bonds · £X · N holdings · £Y in investment bonds" | DATA | SOURCE | UNVERIFIED | |
| MM-BND-T1..4 | 4 tiles — Income next 12 months · Holdings · Investment bonds · Avg yield | DATA | SOURCE | UNVERIFIED | |
| MM-BND-LAD | Maturity-ladder group — 5 buckets (<1y · 1–3y · 3–7y · 7–15y · >15y) | DATA | SOURCE | UNVERIFIED | from `it.maturity_date` |
| MM-BND-CAT | Per-category groups (UK gilt / Investment bond — onshore / offshore / Corporate bond — IG / HY / Bond ETF) — each with CGT chip + holdings list | DATA | SOURCE | UNVERIFIED | |
| MM-BND-NCP | "Not captured yet" group — 11 dashed pills (gilt-short/long, index-linked, IG, HY, ETF, with-profits, endowment, loan notes, QCB, NS&I IL) | DATA | NA (sign-post) | UNVERIFIED | **inert dashed pills — flag CTA honesty pre-launch (A2 — no tap target despite "+" prefix)** |
| MM-BND-EMP | Empty state "No bond holdings captured yet" group | DATA | ACTION — Add via Savings & Investments tile | UNVERIFIED | A4 — "Add them via the Savings & Investments tile" is a verbal direction not a button |

### Region 13 — Balance-sheet tile grid (`TileGrid` with 10 category cards)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-BS-00 | TileGrid hero — projection.value + projection meta + total assets / liabilities (scrn ≈ "Total Net Worth panel") | DATA | SOURCE — full BS | UNVERIFIED | uses `projection.value` not raw `nw` so X28 future-mode shows projected NW (`isProjected` flag) |
| MM-BS-01 | Category — Pensions (A · B) (scrn-confirmed asset card £850k) | DATA+ACTION | ACTION — PensionDrillDown (`onView('pensions')` → `setDrillPension(true)`) | UNVERIFIED | per FD-CROSS-1 — canonical pension surface |
| MM-BS-02 | Category — Savings & Investments (C · D · E · F) (scrn-confirmed asset card £800k ISA) | DATA+ACTION | ACTION — InvestmentsDrillDown (`onView('investments')`) | UNVERIFIED | reconcile to MM-PRI-05 tax shelter % |
| MM-BS-03 | Category — Property (G) (scrn-confirmed £1.80m) | DATA+ACTION | ACTION — PropertyDrillDown (`onView('property')`) | UNVERIFIED | |
| MM-BS-04 | Category — Business Assets (H · I [· X if director]) (scrn empty-state) | DATA+ACTION | ACTION — BusinessDrillDown (`onView('business')`) | UNVERIFIED | scrn shows empty state — empty copy hardcoded |
| MM-BS-05 | Category — Protection (J · K · L) (scrn empty-state) | DATA+ACTION | ACTION — ProtectionDrillDown (`onView('protection')`) | UNVERIFIED | |
| MM-BS-06 | Category — Cash (M) (scrn-confirmed £180k) | DATA+ACTION | SOURCE — cash detail | UNVERIFIED | **no drill-down case in onView switch — `onView('cash')` does nothing — A2 FAIL risk** |
| MM-BS-07 | Category — Liabilities (N) (scrn empty-state, `liability: true`) | DATA+ACTION | ACTION — LiabilitiesDrillDown (`onView('liabilities')`) | UNVERIFIED | scrn-confirmed empty state copy "Lucky you." |
| MM-BS-08 | Category — Income (flow) (O · W) — `rows: []` deliberately empty | DATA | SOURCE — Cashflow screen (sign-post tile) | UNVERIFIED | **deliberately empty rows; spec §3.4 says "income shown in flow-context below NW + on Cashflow"; A4 — must route somewhere, not dead-end** |
| MM-BS-09 | Category — Alternatives (U) | DATA+ACTION | SOURCE — alternatives detail | UNVERIFIED | no drill-down — same A2 risk as MM-BS-06 |
| MM-BS-10 | Category — Obligations (V) | DATA+ACTION | SOURCE — obligations detail | UNVERIFIED | no drill-down — same A2 risk |
| MM-BS-0a | Per-tile `+ Add` CTA → `onAdd(id)` → `openBucket(cat)` → `AddItemSheet(bucketCat)` | ACTION | ACTION — AddItemSheet sheet | UNVERIFIED | |
| MM-BS-0b | Per-tile context line + status chip (engine-derived: AA headroom, ISA room, RNRB, BPR, trust setup, debt rate, cash months) | DATA | SOURCE — context-line origin | UNVERIFIED | each chip optionally has `explainerId` (MM-AA / MM-2 / MM-RNRB / MM-BPR) |
| MM-BS-0c | Per-tile 12-month sparkline series (derived from CAT_MONTHLY_DRIFT, only 5 categories) | DATA | SOURCE — trajectory | UNVERIFIED | **back-cast simulation, not real history — flag as honest-data concern** |
| MM-BS-0d | Per-tile change pct (only 4 driver categories) | DATA | SOURCE — NW trajectory | UNVERIFIED | uses overall NW delta as proxy, not per-category — flag |
| MM-BS-0e | Per-tile `costOfInaction` line (from `coiForDomain`) | DATA | SOURCE — CoI breakdown | UNVERIFIED | A5 + A6 |

### Region 14 — Director intelligence layer (gated by `hasPersonaFlag(entity,'director')`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-DIR-DEL | Section delimiter "Director intelligence — What matters most for company directors" | DATA | NA | UNVERIFIED | only renders when `items.length > 0` |
| MM-DIR-01 | Card — "Pension headroom available" (only when `aaLeft > 1000`) — action "Maximise before 5 April" | DATA+ACTION | ACTION — Tax sub-tab 'ani' (`onNav('tax', {sub: 'ani'})`) | UNVERIFIED | requires `onNav` wired |
| MM-DIR-02 | Card — "Director salary above optimal" OR "Director extraction mix" — action "Review salary/dividend split" / "Review extraction strategy" | DATA+ACTION | ACTION — Tax sub-tab 'director-extraction' (`onNav('tax', {sub: 'director-extraction'})`) | UNVERIFIED | branches on `salaryTooHigh` |
| MM-DIR-03 | Card — "Section 24 restriction on BTL" (only when `hasBTL && btlMortgageInterest > 0`) — action "Consider whether BTL is still efficient" | DATA+ACTION | ACTION — Ask Sonu prefill (`onNav('ask', {prefill: ...})`) | UNVERIFIED | |
| MM-DIR-04 | Card — "Business Property Relief clock" (only when `bprAssets.length > 0`) — action "Confirm BPR status with adviser" | DATA+ACTION | ACTION — Ask Sonu prefill | UNVERIFIED | |
| MM-DIR-0x | Per-card action button (real `<button>` post-S-01 fix) | ACTION | per-card target | UNVERIFIED | confirm not `<span>` |

### Region 15 — Tax & allowances section

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-TAX-DEL | Section delimiter "Tax & allowances — What you keep and what you're sheltering · Tap a row to expand · these numbers show you the gaps HMRC won't point out" (scrn-confirmed) | DATA | NA | UNVERIFIED | A5 |
| MM-TAX-SN1 | Tax snapshot tile — "What you keep after tax" (ANI · % of gross) (scrn ≈ "Tax kept after tax £0") | DATA | SOURCE — ANI panel | UNVERIFIED | from `calcANI(entity).ani`; **scrn £0 — flag as wiring issue (MM-S-10)** |
| MM-TAX-SN2 | Tax snapshot tile — "ISA room left this tax year" (conditional `isaLeft > 1000`) (scrn-confirmed "ISA unused this tax year £20k") | DATA+ACTION | SOURCE — AllowancesPanel ISA / ACTION — top up | UNVERIFIED | A5 — "resets 6 April" |
| MM-TAX-SN3 | Tax snapshot tile — "Pension headroom" (conditional `pensionLeft > 1000`) | DATA+ACTION | SOURCE — AA tracker / ACTION — contribute | UNVERIFIED | |
| MM-TAX-AP1 | `ANIPanel` — "What you actually keep from what you earn" + 6-step display (scrn ≈ MM-TAX-03) | DATA | SOURCE — full ANI flow | UNVERIFIED | 6 steps with ExplainerChip MM-ANI |
| MM-TAX-AP2 | ANIPanel — 4-tile grid (Tax-free slice · Tax-free interest · Child benefit clawback · Marriage allowance transfer) | DATA | SOURCE — each allowance | UNVERIFIED | |
| MM-TAX-AP3 | ANIPanel — £100k–£125,140 PA taper warning banner (conditional) | DATA | SOURCE — taper detail | UNVERIFIED | |
| MM-TAX-AP4 | ANIPanel — HICBC active warning banner (conditional) | DATA | SOURCE — HICBC detail | UNVERIFIED | |
| MM-TAX-AL1 | `AllowancesPanel` — "Tax-free allowances — how much you've used this year" + 5 bars (scrn ≈ "Your free allowance — 0% used") | DATA | SOURCE — allowance tracker | UNVERIFIED | bars: ISA / PSA / CGT / Dividend / PA |

### Region 16 — NRI gate (gated by `hasPersonaFlag(entity,'nri')`)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-NRI-01 | Card title "Indian assets — held as a non-resident" + WrapperBadge "Non-resident" | DATA | NA | UNVERIFIED | |
| MM-NRI-02 | "India bundle loading — DTAA computations pending" banner | DATA | NA | UNVERIFIED | **placeholder text visible to user — A5/A2 flag — "loading" copy in shipped UI** |
| MM-NRI-03 | Rows — NRE Account · NRO Account · EPF · Mutual Funds | DATA | SOURCE — per-account detail | UNVERIFIED | |
| MM-NRI-04 | CausalityStripe sources "Your data · IN-2026.1" | DATA | NA | UNVERIFIED | |

### Region 17 — Footer / disclaimer

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-FOOT-01 | Disclaimer paragraph (`BRAND.disclaimer`) | DATA | NA | UNVERIFIED | A5 + FCA boundary |
| MM-FOOT-02 | Rules version + data date footer | DATA | NA | UNVERIFIED | A6 |

### Region 18 — Universal Add Button (floating)

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-UAB-01 | Floating + button (`UniversalAddButton`) | ACTION | opens `AddItemSheet` (bucket pattern) via `setBucketOpen(true)` | UNVERIFIED | aria-label "Add asset" |

### Region 19 — Overlays / sheets

| ID | Element | Type | Owns-subject destination | Verdict | Notes |
|----|---------|------|--------------------------|---------|-------|
| MM-OVL-01 | `AssetCaptureSheet` (legacy 19-domain picker — `addOpen` state) | OVERLAY | 19-domain catch list + form (label/provider/value) → ASSET_VALUE_UPDATED event | UNVERIFIED | director gate inside (`d.id === 'X' && !hasPersonaFlag('director')` hides Director row) |
| MM-OVL-01a | AssetCaptureSheet step 1 — domain picker (20 rows incl. Director gate) | ACTION | step state = form | UNVERIFIED | A · C · D · E_EIS · E_SEIS · E_VCT · F_ON · F_OFF · G · H · I · J · J2 · K · L · M · N · U · V · W · X |
| MM-OVL-01b | AssetCaptureSheet step 2 — form (label · provider · value£) + Save | ACTION | commits `ASSET_VALUE_UPDATED` event | UNVERIFIED | |
| MM-OVL-02 | `AddItemSheet` (bucket pattern, taxonomy-driven — `bucketOpen` state) | OVERLAY | 3-step: category → type → fields → commit | UNVERIFIED | rooted in 3-Engine-mm-asset-taxonomy-v1_0.md |
| MM-OVL-02a | AddItemSheet step indicators (Category · Type · Fields) | DATA | step state | UNVERIFIED | |
| MM-OVL-02b | AddItemSheet category grid (10 categories per spec §3.4) | ACTION | step state = type | UNVERIFIED | |
| MM-OVL-02c | AddItemSheet type picker (per-category taxonomy) | ACTION | step state = fields | UNVERIFIED | |
| MM-OVL-02d | AddItemSheet field form + commit | ACTION | commits event with `{category, ...}` payload | UNVERIFIED | |
| MM-OVL-03 | `PensionDrillDown` (canonical pension surface — `drillPension` state) | OVERLAY | 6-section flow per spec §4.5 + commit `DRAWDOWN_SCHEDULE_SET` | UNVERIFIED | **THIS IS THE FD-CROSS-1 CANONICAL DRAWDOWN SURFACE** — Home `H-ACT-01` must route here |
| MM-OVL-03a | PensionDrillDown Tax-treatment block (PENSION wrapper · IT/CGT/IHT) | DATA | SOURCE — tax rules | UNVERIFIED | |
| MM-OVL-03b | PensionDrillDown Drawdown Efficiency Ratio panel (actual / optimal / status) | DATA | SOURCE — DER engine fn | UNVERIFIED | from `drawdownEfficiencyRatio(entity)` |
| MM-OVL-03c | PensionDrillDown — DrillContextStub "Scheme quality · charges" (knowledge-hall context) | DATA | SOURCE — charges / FSCS / Defaqto | UNVERIFIED | |
| MM-OVL-03d | §1 Scheme list + nominations rows (color-coded by `nominationStatus` — stale/missing/aging/current) | DATA+ACTION | ACTION — Mark reviewed (commits `NOMINATION_REVIEWED` event) | UNVERIFIED | |
| MM-OVL-03e | §2 AA / MPAA / Carry Forward — 3 tiles (This year's cap · Reduced cap · Unused room) | DATA | SOURCE — allowance rules | UNVERIFIED | hardcoded £60k / £10k — verify against rules-uk.js / UK-2026.1.1.json |
| MM-OVL-03f | §3 LSA / LSDBA / PCLS — 3 tiles | DATA | SOURCE — lump-sum cap rules | UNVERIFIED | hardcoded £268,275 / £1,073,100 — **flag: NOT traced to engine constants (A6 risk)** |
| MM-OVL-03g | §4 Drawdown schedule editor — preset pills (Take nothing · Basic-rate band £37,700/yr · SWR · Smooth withdrawals) | ACTION | applies preset to schedule rows | UNVERIFIED | |
| MM-OVL-03h | §4 Drawdown schedule rows (per-year age + amount£ inputs · remove × · "+ Add next year") | ACTION | mutates schedule state | UNVERIFIED | |
| MM-OVL-03i | §5 Projected impact — sparkline + 4 tiles (Pot value · Total drawn · IHT with plan · IHT saved) | DATA | SOURCE — projection | UNVERIFIED | from `sippProjection` + `sippProjectionSeries` + `ihtDynamic` |
| MM-OVL-03j | §6 Commit bar — Cancel + "Commit DRAWDOWN_SCHEDULE_SET" (disabled when not dirty) | ACTION | commits `DRAWDOWN_SCHEDULE_SET` event | UNVERIFIED | dirty-check via `isDirty` |
| MM-OVL-04 | `InvestmentsDrillDown` (`drillCat==='investments'` state) | OVERLAY | 6-section investments flow | UNVERIFIED | Sections: wrapper tax / ISA room / CGT today / EIS·SEIS·VCT / Investment bonds / All holdings |
| MM-OVL-05 | `PropertyDrillDown` (`drillCat==='property'`) | OVERLAY | 4-section property flow | UNVERIFIED | Sections: own/let / tax treatment / primary residence / BTL portfolio / not captured |
| MM-OVL-06 | `BusinessDrillDown` (`drillCat==='business'`) | OVERLAY | 6-section business-assets flow | UNVERIFIED | Sections: composition / tax / BPR position / companies / share schemes / DLA / not captured |
| MM-OVL-07 | `ProtectionDrillDown` (`drillCat==='protection'`) | OVERLAY | 6-section protection flow | UNVERIFIED | Sections: cover gaps / core policies (life/CI/IP/PMI) / business protection / general insurance / business cover / not captured |
| MM-OVL-08 | `LiabilitiesDrillDown` (`drillCat==='liabilities'`) | OVERLAY | 4-section liabilities flow | UNVERIFIED | Sections: what you owe / LTV / each debt detail / not captured |

---

## SEED FINDINGS (confirm, severity-assign, extend)

| Seed | Element(s) | Issue | Likely severity |
|------|-----------|-------|-----------------|
| MM-S-01 | MM-BAN-04 | Monthly income shows £0 for a £3.63m drawdown persona — probable data-wiring gap; the −£10.0k headline depends on it | DEMO-BLOCKING |
| MM-S-02 | MM-PRI-05 ↔ MM-BS-02 | "Tax shelter usage 0%" (Priority card) sits on the same screen as an £800k ISA — `taxEfficiencyScore` is not picking up the ISA balance | DEMO-BLOCKING |
| MM-S-03 | MM-COI-02 ↔ Home H-ANCH-04 | Cost of Inaction shows £412k here vs £340K on the Home design baseline — does not reconcile | DEMO-BLOCKING |
| MM-S-04 | MM-COI-02 / general | Build placeholder text ("mapping inbound", "draft inbound") visible in the live UI — likely in `coiForDomain` copy or upstream | DEMO-BLOCKING |
| MM-S-05 | MM-BS-* | Asset cards in inconsistent states — some carry drill-downs (pensions/investments/property/business/protection/liabilities), some don't (cash, alternatives, obligations, income, **scrn confirms** "tap any tile to drill" is promised but not uniform via `onView` switch | FUNCTIONAL |
| MM-S-06 | MM-BAN-* | `−£0` / `+£0` rendered — `fmt()` not handling signed zero (scrn-confirmed in seed) | FUNCTIONAL |
| MM-S-07 | MM-PRI-04 | "Estate efficiency 64p/£" — jargon with no plain-English meaning (per `effectiveBeneficiaryRate.rate × 100`) | FUNCTIONAL |
| MM-S-08 | MM-COI-02 / MM-BS-01 / MM-OVL-03 | "Start pension drawdown" appears on My Money CoI panel AND on Home — must route to the SAME `PensionDrillDown` overlay and show the SAME impact figure | DEMO-BLOCKING |
| MM-S-09 | MM-SCR-01/02/03 | Net Worth £3.63m / Wealth 47 / Risk 56 appear to match Home — confirm as PASS, including format consistency | (verify) |
| MM-S-10 | MM-TAX-SN1 et al | Multiple `£0` values rendered — distinguish "genuinely zero" from "unwired / not yet loaded" (calcANI returns 0 on certain entity shapes) | FUNCTIONAL |
| MM-S-11 | MM-DEC-06 | "Set up your drawdown plan →" empty-state accessory is a `<span>` not a `<button>` — no onClick handler — pre-launch CTA-honesty rule violation | FUNCTIONAL |
| MM-S-12 | MM-BS-06 / MM-BS-09 / MM-BS-10 | Cash / Alternatives / Obligations tiles have no `onView` handler — tapping them is silently inert ("tap any tile to drill" promise broken) | DEMO-BLOCKING |
| MM-S-13 | MM-BS-08 | Income (flow) tile has `rows: []` deliberately — needs to be a sign-post to Cashflow, not a dead tile. No `onView` route — A4 risk | FUNCTIONAL |
| MM-S-14 | MM-NRI-02 | "India bundle loading — DTAA computations pending" — loading copy visible in shipped UI (only renders if NRI flag set, but still real placeholder text) | FUNCTIONAL |
| MM-S-15 | MM-BS-0c | Per-tile sparklines are BACK-CAST from `CAT_MONTHLY_DRIFT` constants — not real time-series. Charts pretending to show history they don't have | FUNCTIONAL |
| MM-S-16 | MM-OVL-03f | LSA £268,275 / LSDBA £1,073,100 hardcoded in `MetricTile` props — not traced to rules-uk.js / UK-2026.1.1.json. If Budget changes the cap these don't follow | FUNCTIONAL |
| MM-S-17 | MM-OVL-03e | AA cap £60,000 / MPAA £10,000 hardcoded similarly — same concern as MM-S-16 | FUNCTIONAL |
| MM-S-18 | MM-BND-NCP / MM-BND-EMP / MM-INS-EMP | Multiple "Not captured yet" dashed "+ X" pills are inert — look like Add buttons but have no onClick. Pre-launch CTA honesty | FUNCTIONAL |
| MM-S-19 | MM-WS-04 | "Add wrapper details" CTA opens `AssetCaptureSheet` (legacy) not `AddItemSheet` (bucket pattern — the current default). Inconsistent capture path for wrapper-unknown items | FUNCTIONAL |
| MM-S-20 | MM-OVL-01 (AssetCaptureSheet) | Hardcoded H/I/U domain wrappers default to `'GIA'` in `ALL_DOMAINS` list despite C-01/C-02/C-03 comments in `rowsFor*` saying these are NOT GIA. Add path will tag the wrong wrapper on save | FUNCTIONAL |
| MM-S-21 | MM-X28-01/02 | X28 future-mode projection only changes hero NW in `MM-BS-00` (via `projection.value`) — other anchors (MM-SCR-01) and per-tile sparklines still show current-period NW. Mode is partially wired | FUNCTIONAL |

---

## COVERAGE MATH

Same as `home-inventory-v1.md`. This inventory is enumerated against the component;
Coverage = (rows with verdict ≠ UNVERIFIED) / (total rows). Total rows ≈ 135 (incl.
sub-rows in OVL-03 schedule editor, BS-0a..0e per-tile sub-elements, INC/CF/INS/BND
pivot sub-rows). "99% confident" is only valid when restated as "X of Y rows verified PASS."

---

*— end mymoney-inventory-v1.md —*
