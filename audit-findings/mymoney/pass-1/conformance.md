# Conformance Audit — MyMoney pass-1

**Auditor:** A1 conformance pass (structural presence, right region, right content, right state)
**Source:** `src/screens/MyMoney.jsx` (3473 lines, read in full)
**Inventory:** `mymoney-inventory-v1.md`
**Date:** 2026-05-18
**Scope:** A1 only — is the element present, in the right region, with the right content/state?
Drill (A2), reconciliation (A3/A6), and scenario (A4/A5) belong to later passes.

---

## A1 Verdict Table

| Element ID | Description | A1 Verdict | Notes |
|------------|-------------|------------|-------|
| MM-X28-01 | X28TopBar — 7 time windows | PASS | `X28TopBar` rendered; `onWindowChange={setWindowId}`; windows via `TIME_WINDOWS` import |
| MM-X28-02 | X28TopBar — view-mode pills | PASS | `onViewModeChange={setViewMode}` present |
| MM-X28-03 | rules-version chip | PASS | `rulesVersion={BRAND.rulesVersion}` prop passed |
| MM-X28-04 | data-date chip | PASS | `dataDate={BRAND.dataDate}` prop passed |
| MM-HDR-01 | "← Home" back button | PASS | `<button onClick={onHome}>← Home</button>` at line 2619 |
| MM-HDR-02 | FORECAST · variance overlay pill | PASS | Conditional: `viewMode !== 'actual'` renders amber pill `{viewMode.toUpperCase()} · variance overlay active` |
| MM-PLN-01 | PlanStalenessBanner | PASS | `PlanStalenessBanner plans={stalePlans}`; `onReview` routes to timeline via `onNav('timeline', {planId})` |
| MM-PUR-01 | Screen-purpose eyebrow | PASS | "MyMoney · What do I own, what do I owe, and what comes in?" rendered in header div |
| MM-NPS-01 | Urgent-signal sentence (4 branches) | PASS | IIFE computes `urgentSignal` from 4 branches on `surplus`/`monthsRunway`/`fiRat_` |
| MM-NPS-02 | Supporting-signal sub-sentence | PASS | `supportingSignal` rendered conditionally below urgent sentence |
| MM-NPS-03 | Banner background coral when `!pos` | PASS | `background: color-mix(in srgb, var(--c-coral) 6%, ...)` and border tinted coral when `!pos` |
| MM-BAN-00 | "Monthly cash flow" header + ProvenanceChip | PASS | `sw-eyebrow` "Monthly cash flow"; `ProvenanceChip sources={['Your data','Apr 2026']}` — date is hardcoded string, not `BRAND.dataDate` (see DECISION-NEEDED D2) |
| MM-BAN-01 | SurplusTile hero | PASS | `SurplusTile` renders `pos/neg {amt}` from `monthlySurplus`; hero copy is "spending exceeds income this month" (not "spending records income" as inventory says — inventory copy is wrong/stale, build copy is clearer) |
| MM-BAN-02 | Runway warning | PASS | "Liquid cash covers X months at this rate" rendered when `!pos && monthsRunway`; urgent/warn thresholds present |
| MM-BAN-03 | CashFlowSankey 4-seg bar | PASS | `CashFlowSankey` inline; segments: Essentials/Debt/Committed/Surplus-or-Shortfall |
| MM-BAN-03a | Sankey income marker line | PASS | `incomePct` computed; white line at `calc(${incomePct}% - 1px)` for deficit users |
| MM-BAN-03b | Sankey legend | PASS | Legend rendered per segment with label + `fmtK(s.v)` |
| MM-BAN-04 | Mini-tile Monthly income | PASS | `MetricTile label="Monthly income" value={fmt(m.income||0)}`; seed MM-S-01 £0 risk still present |
| MM-BAN-05 | Mini-tile Essentials | PASS | `MetricTile label="Essentials"` |
| MM-BAN-06 | Mini-tile Debt payments | PASS | `MetricTile label="Debt payments"` |
| MM-BAN-07 | Mini-tile Committed | PASS | `MetricTile label="Committed"` |
| MM-BAN-08 | Self-comparison delta footer | PASS | Rendered from `trajectories.netWorthHistory[-2..-1]` when `delta != 0` |
| MM-SCR-01 | Net Worth anchor card | PASS | `TripleAnchor netWorthVal={nw}`; `onNetWorthTap={() => onDrillMetric('netWorth')}` |
| MM-SCR-02 | Wealth Score anchor card | PASS | `fqTotal={fq.total}`; `onWealthTap={() => onDrillMetric('wealthScore')}` |
| MM-SCR-03 | Risk Score anchor card | PASS | `riskTotal={risk.total}`; `onRiskTap={onOpenRisk}` |
| MM-SCR-04 | NW DeltaChip | PASS | `DeltaChip delta={nwDelta}` from traj[-2..-1]; renders nothing when < 2 points |
| MM-SCR-05 | VarianceBadge | PASS | `VarianceBadge entity/mode1="actual"/mode2={viewMode}/window={windowId}`; only renders when modes differ |
| MM-SCR-06 | nwTrendPct sparkline trend % | PASS | Computed inline `((last-prev)/prev)*100`; passed to `TripleAnchor` as `nwTrendPct` |
| MM-WS-00 | "How your money is held" + ExplainerChip MM-2 | PASS | `sw-eyebrow` "How your money is held"; `ExplainerChip id="MM-2"` |
| MM-WS-01 | Composition bar segments | PASS | `WrapperCompositionBar` buttons per wrapper; `onSegmentTap={setFilterWrapper}` |
| MM-WS-02 | UNKNOWN diagonal-stripe segment | PASS | `repeating-linear-gradient(45deg, ...)` + dashed border for `UNKNOWN` wrapper |
| MM-WS-03 | Wrapper badge row beneath bar | PASS | `<span onClick>` per entry, toggles `filterWrapper` |
| MM-WS-04 | WRAPPER? alert + "Add wrapper details" CTA | PASS | Rendered when `unknownAmount > 0`; real `<button>` opens `setAddOpen(true)` → `AssetCaptureSheet` (legacy, not `AddItemSheet`); seed MM-S-19 confirmed |
| MM-WS-05 | Active filter chip | PASS | "Showing {filterWrapper} only — clear ×" button; `onClick={() => setFilterWrapper(null)}` |
| MM-CLF-01 | Cliff warning banner | PASS | `CliffEdgeWarning` renders; trigger: `distance <= 20_000` (ani within 20k of cliff, >= £80k); shows "£X from the £100k income cliff" or "threshold passed" |
| MM-CLF-02 | Pension-to-solve copy | PASS | "A £X pension contribution pulls you below it" / "keeps you below the cliff" in sub-line |
| MM-CLF-03 | Progress bar + 60% marker | FAIL | Progress bar present; `barFill = (ani/cliff)*100`. Cliff marker drawn at `left: 100%`. **No 60% marker exists** in `CliffEdgeWarning`. `src/screens/MyMoney.jsx:1010` |
| MM-PRI-00 | Eyebrow "Needs your attention" | PASS | `sw-eyebrow` "Needs your attention"; all-green state renders "All five metrics are healthy" card |
| MM-PRI-01 | Emergency cover card | PASS | `safetyBand` from `cash/monthlySpend`; excluded when `monthlySpend === 0`; icon 🛡 |
| MM-PRI-02 | Debt burden card | PASS | `debtBand + debtPct` computed; icon ⚖ |
| MM-PRI-03 | Retirement funded card | PASS | `fiRat_ = inv/fiTarget`; icon 🎯 |
| MM-PRI-04 | Estate efficiency card | PASS | `ebr = effectiveBeneficiaryRate`; renders as "Xp/£"; seed MM-S-07 jargon confirmed (A5 concern) |
| MM-PRI-05 | Tax shelter usage card | PASS | `tax = taxEfficiencyScore`; renders `tax.total%`; seed MM-S-02 reconciliation risk confirmed (A6 concern) |
| MM-PRI-0x | Per-card band chip + BulletChart | PASS | "Act now" (band=bad) / "Watch" (band=warn); `BulletChart pct={t.pct}` present |
| MM-PRI-0y | Per-card expanded action body on tap | PASS | `isOpen && <div>{t.action}</div>` inside button `onClick` toggle |
| MM-PRI-06 | "+ N more metrics" footer | PASS | `{hiddenBadCount} more metric{s} also need attention` when `hiddenBadCount > 0` |
| MM-COI-00 | Header "Cost of doing nothing" | PASS | "Cost of doing nothing" eyebrow; "Ranked by annual cost — act on the top item first" sub |
| MM-COI-01 | "Total est. £X/yr" canonical aggregate | PASS | `totalCoIEst` from `coi.total` (memoised); rendered when `> 0` |
| MM-COI-02 | Top 4 ranked rows | PASS | `ranked.slice(0,4)` with ordinal circles; text from `coiForDomain` strings |
| MM-DEC-00 | "Which pot to draw from first" + years accessory | PASS | `RevealCard title="Which pot to draw from first"`; `headerAccessory` shows `yearsToRetire` or "At retirement age" |
| MM-DEC-01 | Intro copy about sequence + tax bill | PASS | "The sequence you draw from these pots determines your tax bill in retirement" present |
| MM-DEC-02 | Sequence row 1 — GIA | PASS | `order:1` GIA with CGT tax note |
| MM-DEC-03 | Sequence row 2 — ISA | PASS | `order:2` ISA; "Zero tax on withdrawal, ever" |
| MM-DEC-04 | Sequence row 3 — SIPP/Pension | PASS | `order:3` "SIPP / Pension"; "25% tax-free lump sum" note; no tap-to-drill from sequence row itself |
| MM-DEC-05 | Footer "Total investable · SWR" | PASS | "Total investable: {fmt(inv)} · At 4% safe withdrawal: {fmt(...)}/yr" rendered when `inv > 0` |
| MM-DEC-06 | Empty-state CTA "Set up your drawdown plan →" | FAIL | `headerAccessory` is `<span>` not `<button>`; no `onClick`. `src/screens/MyMoney.jsx:2393`. Seed MM-S-11 confirmed. |
| MM-BS-DEL | Section delimiter "Balance sheet" | PASS | `SectionDelimiter eyebrow="Your financial picture" title="Balance sheet" sub="Tap any tile to drill into it · tap + Add to capture new items"` |
| MM-PIV-01 | Pivot pill — Balance sheet (default) | PASS | `PivotToggle` present; default `pivot="balance-sheet"` |
| MM-PIV-02 | Pivot pill — Income | PASS | `pivot='income'` renders `PivotView` |
| MM-PIV-03 | Pivot pill — Cash flow | PASS | `pivot='cashflow'` renders `PivotView` |
| MM-PIV-04 | Pivot pill — Insurance | PASS | `pivot='insurance'` renders `PivotView` |
| MM-PIV-05 | Pivot pill — Bonds | PASS | `pivot='bonds'` renders `PivotView` |
| MM-INC-HRO | Income pivot hero | NA | In `PivotView.jsx` (imported) — not inlined; separate component audit required |
| MM-INC-T1 | Income tile — Total each year | NA | In `PivotView.jsx` |
| MM-INC-T2 | Income tile — Taxable income | NA | In `PivotView.jsx` |
| MM-INC-T3 | Income tile — Marginal rate | NA | In `PivotView.jsx` |
| MM-INC-T4 | Income tile — Income sources count | NA | In `PivotView.jsx` |
| MM-INC-R0 | Group "Where your income comes from" | NA | In `PivotView.jsx` |
| MM-INC-R1..10 | Per-stream income rows | NA | In `PivotView.jsx` |
| MM-INC-BND | Group "Where each pound lands" | NA | In `PivotView.jsx` |
| MM-INC-ALW | Group allowances | NA | In `PivotView.jsx` |
| MM-CF-HRO | Cashflow pivot hero | NA | In `PivotView.jsx` |
| MM-CF-T1 | Monthly income tile | NA | In `PivotView.jsx` |
| MM-CF-T2 | Monthly outgoings tile | NA | In `PivotView.jsx` |
| MM-CF-IN | Income breakdown group | NA | In `PivotView.jsx` |
| MM-CF-SP | Spending breakdown group | NA | In `PivotView.jsx` |
| MM-CF-IT | Insight group "What this means" | NA | In `PivotView.jsx` |
| MM-INS-HRO | Insurance pivot hero | NA | In `PivotView.jsx` |
| MM-INS-T1..4 | Insurance 4 tiles | NA | In `PivotView.jsx` |
| MM-INS-GAP | Protection gaps group | NA | In `PivotView.jsx` |
| MM-INS-G1..6 | Policy groups | NA | In `PivotView.jsx` |
| MM-INS-EMP | Empty state "No policies" | NA | In `PivotView.jsx` |
| MM-BND-HRO | Bonds pivot hero | NA | In `PivotView.jsx` |
| MM-BND-T1..4 | Bonds 4 tiles | NA | In `PivotView.jsx` |
| MM-BND-LAD | Maturity-ladder group | NA | In `PivotView.jsx` |
| MM-BND-CAT | Per-category bond groups | NA | In `PivotView.jsx` |
| MM-BND-NCP | "Not captured yet" dashed pills | NA | In `PivotView.jsx` |
| MM-BND-EMP | Empty state "No bond holdings" | NA | In `PivotView.jsx` |
| MM-BS-00 | TileGrid hero — projection.value | PASS | `TileGrid netWorth={projection.value}`; `isProjected` flag; X28 window meta passed |
| MM-BS-01 | Category — Pensions | PASS | `id='pensions'`; `onView('pensions')` → `setDrillPension(true)` |
| MM-BS-02 | Category — Savings & Investments | PASS | `id='investments'`; `onView('investments')` → `setDrillCat('investments')` |
| MM-BS-03 | Category — Property | PASS | `id='property'`; `onView('property')` → `setDrillCat('property')` |
| MM-BS-04 | Category — Business Assets | PASS | `id='business'`; director gated; `onView('business')` → `setDrillCat('business')` |
| MM-BS-05 | Category — Protection | PASS | `id='protection'`; `onView('protection')` → `setDrillCat('protection')` |
| MM-BS-06 | Category — Cash (no drill) | FAIL | `id='cash'` in CATEGORIES; `onView` switch at `src/screens/MyMoney.jsx:3187` handles only pensions/investments/property/business/protection/liabilities — 'cash' falls through silently. Seed MM-S-12 confirmed. |
| MM-BS-07 | Category — Liabilities | PASS | `id='liabilities'`; `onView('liabilities')` → `setDrillCat('liabilities')`; empty copy "Lucky you." present |
| MM-BS-08 | Category — Income (flow) | PASS | `id='income'` with `rows:[]` deliberately per spec §3.4; no `onView` route (intentional sign-post tile); seed MM-S-13 matches spec intent |
| MM-BS-09 | Category — Alternatives | FAIL | `id='alternatives'` in CATEGORIES; `onView` switch has no 'alternatives' case. `src/screens/MyMoney.jsx:3187`. Seed MM-S-12 confirmed. |
| MM-BS-10 | Category — Obligations | FAIL | `id='obligations'` in CATEGORIES; `onView` switch has no 'obligations' case. `src/screens/MyMoney.jsx:3187`. Seed MM-S-12 confirmed. |
| MM-BS-0a | Per-tile + Add CTA | PASS | `onAdd={openBucket}`; `openBucket(cat)` → `setBucketCat + setBucketOpen` |
| MM-BS-0b | Per-tile context line + status chip | PASS | `contextLine` and `status` computed per category; `explainerId` attached where relevant |
| MM-BS-0c | Per-tile 12-month sparkline | PASS | `series` backcast from `CAT_MONTHLY_DRIFT` for 5 categories; seed MM-S-15 confirmed (not real history) |
| MM-BS-0d | Per-tile change pct | PASS | `changePct` from NW trajectory for 4 driver categories; proxy not per-category — seed MM-S-15 |
| MM-BS-0e | Per-tile costOfInaction line | PASS | `coiForDomain(entity, c.id)` per tile; assigned when non-null |
| MM-DIR-DEL | Section delimiter "Director intelligence" | PASS | `SectionDelimiter` inside `hasPersonaFlag(entity,'director')` gate; only renders when `items.length > 0` |
| MM-DIR-01 | Pension headroom card | PASS | `aaLeft > 1000`; action `goTaxAni` → `onNav('tax',{sub:'ani'})` |
| MM-DIR-02 | Director salary/extraction card | PASS | Dual-branch on `salaryTooHigh`; both variants present; `goTaxExtraction` |
| MM-DIR-03 | Section 24 BTL card | PASS | `hasBTL && btlMortgageInterest > 0`; routes to `goAsk` prefill |
| MM-DIR-04 | BPR clock card | PASS | `bprAssets.length > 0`; routes to `goAsk` prefill |
| MM-DIR-0x | Per-card action `<button>` | PASS | Real `<button type="button" onClick={item.onAction}>` — seed S-01 fix confirmed |
| MM-TAX-DEL | Section delimiter "Tax & allowances" | PASS | `SectionDelimiter eyebrow="Tax & allowances"` title/sub present |
| MM-TAX-SN1 | Tax snapshot — "What you keep after tax" | PASS | `value=fmt(a.ani)`; conditional on `calcANI` succeeding |
| MM-TAX-SN2 | Tax snapshot — "ISA room left" | PASS | Conditional `isaLeft > 1000`; "resets 6 April" sub present |
| MM-TAX-SN3 | Tax snapshot — "Pension headroom" | PASS | Conditional `pensionLeft > 1000` |
| MM-TAX-AP1 | ANIPanel 6-step display | PASS | `ANIPanel` with 6-step stepper; `ExplainerChip id="MM-ANI"` |
| MM-TAX-AP2 | ANIPanel 4-tile grid | PASS | 2×2: tax-free slice / PSA / HICBC charge / marriage allowance |
| MM-TAX-AP3 | ANIPanel PA taper warning | PASS | `a.ani > 100000 && a.ani < 125140` → amber warning rendered |
| MM-TAX-AP4 | ANIPanel HICBC warning | PASS | `hicbc.charge > 0` → coral warning rendered |
| MM-TAX-AL1 | AllowancesPanel — 5 bars | PASS | `AllowancesPanel` renders 5 `Bar` components: ISA/PSA/CGT/Dividend/PA |
| MM-NRI-01 | "Indian assets" card + "Non-resident" badge | PASS | `RevealCard title="Indian assets — held as a non-resident"`; `WrapperBadge label="Non-resident"` |
| MM-NRI-02 | "India bundle loading" banner | PASS | Text present; seed MM-S-14 confirmed — placeholder visible when nri flag set |
| MM-NRI-03 | NRE/NRO/EPF/Mutual Funds rows | PASS | 4 rows from `entity.assets.indianAssets` |
| MM-NRI-04 | CausalityStripe IN-2026.1 | PASS | `CausalityStripe sources={['Your data','IN-2026.1']}` |
| MM-FOOT-01 | Disclaimer paragraph | PASS | `{BRAND.disclaimer}` in `<p className="disclaimer">` |
| MM-FOOT-02 | Rules version + data date | PASS | `{BRAND.rulesVersion} · {BRAND.dataDate}` after disclaimer |
| MM-UAB-01 | Floating + button UniversalAddButton | PASS | `UniversalAddButton onSelect={() => setBucketOpen(true)}`; component imported and rendered |
| MM-OVL-01 | AssetCaptureSheet (legacy, addOpen) | PASS | `AssetCaptureSheet open={addOpen}` rendered; `onAddWrapperDetails` routes here |
| MM-OVL-01a | AssetCaptureSheet step 1 — domain picker | PASS | `ALL_DOMAINS` 21-row list (A through X); director gate present |
| MM-OVL-01b | AssetCaptureSheet step 2 — form | PASS | label/provider/value fields; commits `ASSET_VALUE_UPDATED` |
| MM-OVL-02 | AddItemSheet (bucket pattern, bucketOpen) | PASS | `AddItemSheet open={bucketOpen} initialCategory={bucketCat}` rendered |
| MM-OVL-02a | AddItemSheet step indicators | NA | In `AddItemSheet.jsx` (imported component) |
| MM-OVL-02b | AddItemSheet category grid | NA | In `AddItemSheet.jsx` |
| MM-OVL-02c | AddItemSheet type picker | NA | In `AddItemSheet.jsx` |
| MM-OVL-02d | AddItemSheet field form + commit | NA | In `AddItemSheet.jsx` |
| MM-OVL-03 | PensionDrillDown (canonical drawdown surface) | PASS | `PensionDrillDown` rendered when `drillPension`; 6-section flow inlined; FD-CROSS-1 honoured |
| MM-OVL-03a | Tax-treatment block | PASS | `TaxTreatmentBlock wrapper="PENSION"` in §1 |
| MM-OVL-03b | Drawdown Efficiency Ratio panel | PASS | `drawdownEfficiencyRatio(entity)` called; rendered between §1 and §2 |
| MM-OVL-03c | DrillContextStub "Scheme quality" | PASS | `DrillContextStub eyebrow="Scheme quality · charges"` with `SchemeQualityStub` preview and 5 bullets |
| MM-OVL-03d | §1 Scheme list + nominations | PASS | `nominationStatus` rows; colour-coded; "Mark reviewed" `<button>` commits `NOMINATION_REVIEWED` |
| MM-OVL-03e | §2 AA/MPAA/Carry Forward 3 tiles | FAIL | `fmt(60000)` and `fmt(10000)` hardcoded at `src/screens/MyMoney.jsx:1983`. Not from `rules-uk.js` / `UK-2026.1.1.json`. Seed MM-S-17 confirmed. |
| MM-OVL-03f | §3 LSA/LSDBA/PCLS 3 tiles | FAIL | `268275`, `1073100`, `0.25` hardcoded at `src/screens/MyMoney.jsx:2003`. Not traced to engine constants. Seed MM-S-16 confirmed. |
| MM-OVL-03g | §4 Drawdown preset pills | PASS | 4 presets; `applyPreset(id)` |
| MM-OVL-03h | §4 Drawdown schedule rows | PASS | Per-year age+amount inputs; remove ×; "+ Add next year" |
| MM-OVL-03i | §5 Projected impact — sparkline + 4 tiles | PASS | `DrawSVG` sparkline from `sippProjectionSeries`; 4 `MetricTile` |
| MM-OVL-03j | §6 Commit bar | PASS | Cancel + "Commit DRAWDOWN_SCHEDULE_SET"; disabled when `!isDirty` |
| MM-OVL-04 | InvestmentsDrillDown | PASS | `drillCat === 'investments'` → component rendered |
| MM-OVL-05 | PropertyDrillDown | PASS | `drillCat === 'property'` → component rendered |
| MM-OVL-06 | BusinessDrillDown | PASS | `drillCat === 'business'` → component rendered |
| MM-OVL-07 | ProtectionDrillDown | PASS | `drillCat === 'protection'` → component rendered |
| MM-OVL-08 | LiabilitiesDrillDown | PASS | `drillCat === 'liabilities'` → component rendered |

---

## UNLISTED elements found in build

Elements present in `MyMoney.jsx` but absent from the inventory:

1. **`DrawdownFrameworkPanel`** (`src/screens/MyMoney.jsx:1428–1555`) — 5-method drawdown panel (Bengen/GK/Bucket/Floor-Upside/CoI variants). Defined in §9 but **not rendered in the main screen return()**. Only accessible via "Drill-down ›" button prop inside `PensionDrillDown`. Not in inventory.

2. **`DrawdownMatrixPanel`** (`src/screens/MyMoney.jsx:1561–1615`) — £5k-step annual income table. Defined in §10 but **never rendered anywhere** in the component tree. Dead code. Not in inventory.

3. **`IncomeSection`** (`src/screens/MyMoney.jsx:897–956`) — banded income card defined as §6 helper. **Not rendered** in the main `MyMoney` return block. Income view is delivered via `PivotView` "Income" pivot. Superseded but not removed. Not in inventory.

4. **`TodayMoveCard`** — imported at `src/screens/MyMoney.jsx:63` but an inline comment at line 2836 states "Today's Move REMOVED from MyMoney 2026-05-15". Dead import. Not in inventory.

---

## DECISION-NEEDED divergences

| # | Element(s) | Divergence | Question for founder |
|---|-----------|------------|----------------------|
| D1 | MM-CLF-03 | Inventory specifies a "60% marker" on the cliff progress bar. Build draws only a cliff marker at `left: 100%`. `src/screens/MyMoney.jsx:1010–1017`. | Is a 60% taper-zone marker spec-required on the bar? If yes: add a marker at the point where PA taper begins relative to the cliff. |
| D2 | MM-BAN-00 | `ProvenanceChip` receives `sources={['Your data', 'Apr 2026']}` — date is a hardcoded string, not `BRAND.dataDate`. `src/screens/MyMoney.jsx:1149`. | Should provenance date track `BRAND.dataDate`, or is a static display date acceptable pre-live-data-ingestion? |
| D3 | MM-INC-HRO through MM-BND-EMP (27 pivot rows) | All pivot content lives in `src/components/MyMoney/PivotView.jsx` — not inlined. 27 NA rows cannot be A1-verified from the main component. | Should a pass-1b cover `PivotView.jsx` against these inventory rows? |
| D4 | MM-OVL-04..08 (drill components) | `InvestmentsDrillDown`, `PropertyDrillDown`, `BusinessDrillDown`, `ProtectionDrillDown`, `LiabilitiesDrillDown` — internal conformance unverified in this pass. | Should each drill-down component be audited separately against its spec sections, or is routing-switch presence sufficient for A1? |
| D5 | `DrawdownFrameworkPanel` / `DrawdownMatrixPanel` | Both defined in `MyMoney.jsx` but neither is in the main screen render. `DrawdownFrameworkPanel` is accessible only inside `PensionDrillDown`. `DrawdownMatrixPanel` is unreachable. | Should the 5-method drawdown framework appear on the main MyMoney screen, or only inside PensionDrillDown? Is `DrawdownMatrixPanel` deferred (Wave 7+) or should it be deleted? |
| D6 | `IncomeSection` (§6) | Defined but never rendered. Income view is served by PivotView. | Should `IncomeSection` be deleted, or reserved for a future direct-screen placement? |
| D7 | `TodayMoveCard` import | Dead import; removed component per 2026-05-15 comment. No functional impact. | Can this import be removed in the next code-cleanup pass? |

---

## Coverage

| Metric | Count |
|--------|-------|
| Rows checked | 150 |
| Inventory estimated total rows | ~135 + sub-rows |
| PASS | 113 |
| FAIL | 7 |
| NA (external components, not inlined) | 30 |

**FAIL summary:**

| ID | Severity | Description | File:line |
|----|----------|-------------|-----------|
| MM-CLF-03 | Low | 60% taper marker absent from cliff progress bar | `MyMoney.jsx:1010` |
| MM-DEC-06 | Functional | Empty-state drawdown CTA is inert `<span>` not `<button>` | `MyMoney.jsx:2393` |
| MM-BS-06 | Demo-blocking | Cash tile tap silently inert — no `onView` case | `MyMoney.jsx:3187` |
| MM-BS-09 | Functional | Alternatives tile tap silently inert | `MyMoney.jsx:3187` |
| MM-BS-10 | Functional | Obligations tile tap silently inert | `MyMoney.jsx:3187` |
| MM-OVL-03e | Functional | AA cap (£60k) and MPAA (£10k) hardcoded; won't track rule changes | `MyMoney.jsx:1983` |
| MM-OVL-03f | Functional | LSA (£268,275) and LSDBA (£1,073,100) hardcoded; won't track rule changes | `MyMoney.jsx:2003` |

**NA note:** 30 rows are NA because they reside in `PivotView.jsx` or `AddItemSheet.jsx` (imported components not read in this pass). These are not failures — they require separate component audit passes.
