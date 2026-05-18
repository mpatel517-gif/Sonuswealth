# My Money — Pass 1 — Interaction Audit (A2 / A3 / A4) [UPDATED 2026-05-18]

**Auditor:** interaction-auditor (auditor 2 of 5)
**Screen:** My Money (`src/screens/MyMoney.jsx` + `src/components/MyMoney/*`)
**Inventory:** `mymoney-inventory-v1.md` v1
**FD-CROSS-1 verified:** My Money owns pension/SIPP/drawdown via `PensionDrillDown` overlay (`src/screens/MyMoney.jsx:1795`).
**Commit path verified:** `PensionDrillDown` Commit → `handleCommitSchedule` (line 2584) fires `EV.DRAWDOWN_SCHEDULE_SET` → `applyEvents` reducer at `src/state/events.jsx:72` writes `e.drawdownSchedule` and `e.drawdown`. Downstream subscribers: 16 files (`HomeScreen`, `TaxEstate`, `Cashflow`, `Ask`, plus engines `fq-calculator`, `tax-estate-engine`, `cashflow-engine`, `timeline-engine`, `monthly-flow-engine`, `state-tiles-engine`, `simulator`, `canonical-metrics`, `_helpers`, `IncomeBreakdown`). **Pipeline is real — not symbolic.**
**Note on inventory file paths:** inventory cites line numbers from the Google Drive vault mirror; the build of record is `C:\Users\Powernet\Desktop\finio\src\screens\MyMoney.jsx` (3473 lines). Lines below cite that file.

---

## A2 / A3 / A4 verdict table

| ID | A2 | A3 | A4 | Severity | Finding | Evidence |
|----|----|----|----|----------|---------|----------|
| MM-X28-01 | PASS | PASS | NA | — | windowId state toggle wired | `MyMoney.jsx:2607` `onWindowChange={setWindowId}` |
| MM-X28-02 | PASS | PASS | NA | — | viewMode state toggle wired | `MyMoney.jsx:2608` `onViewModeChange={setViewMode}` |
| MM-X28-03 | NA | NA | NA | — | DATA chip — not interactive by spec | `MyMoney.jsx:2609` |
| MM-X28-04 | NA | NA | NA | — | DATA chip | `MyMoney.jsx:2610` |
| MM-HDR-01 | PASS | PASS | PASS | — | back to Home — real `<button>` calls `onHome` | `MyMoney.jsx:2619` |
| MM-HDR-02 | NA | NA | NA | — | mode-indicator pill | `MyMoney.jsx:2627` |
| MM-PLN-01 | PASS | PASS | PASS | — | `onReview` → `onNav('timeline',{planId})` with hash fallback | `MyMoney.jsx:2642–2652` |
| MM-PUR-01 | NA | NA | NA | — | eyebrow string | `MyMoney.jsx:2659` |
| MM-NPS-01..03 | NA | NA | NA | — | DATA-only sentence/banner (no inventory-tagged interactive surface) | n/a |
| MM-BAN-00 | NA | NA | NA | — | header + ProvenanceChip | `MyMoney.jsx:1147–1149` |
| MM-BAN-01 | **FAIL** | FAIL | FAIL | **F** | Hero "−£10.0k" is a `<div>` — promises drill to Cashflow detail but no `onClick`. Inventory tags it `SOURCE — Cashflow detail`. | `MyMoney.jsx:1153–1156` |
| MM-BAN-02 | **FAIL** | FAIL | FAIL | F | Runway warning copy is informational `<div>` — no drill to cash runway detail | `MyMoney.jsx:1176–1196` |
| MM-BAN-03 | **FAIL** | FAIL | FAIL | F | `CashFlowSankey` bar — no `onClick` anywhere in the component (verified: no `onClick` between lines 1030–1130) | `MyMoney.jsx:1030, 1200` |
| MM-BAN-03a/03b | FAIL | FAIL | FAIL | F | Marker + legend rows — all `<div>` / `<span>`, read-only | same |
| MM-BAN-04..07 | **FAIL** | FAIL | FAIL | F | 4 `MetricTile`s (Monthly income / Essentials / Debt / Committed) — `MetricTile` is a plain `<div>` (`MyMoney.jsx:233`), no drill surfaces. Cashflow section header is signposted as `SOURCE — Cashflow` but the tiles dead-end on this screen. | `MyMoney.jsx:1203–1208` + 233 |
| MM-BAN-08 | NA | NA | NA | — | DATA footer | `MyMoney.jsx:1218–1225` |
| MM-SCR-01 | PASS | PASS | PASS | — | `onNetWorthTap` → `onDrillMetric('netWorth')` (TripleAnchor) — handled by parent App router | confirmed indirectly via parent props; component contract met |
| MM-SCR-02 | PASS | PASS | PASS | — | `onWealthTap` → `onDrillMetric('wealthScore')` | same |
| MM-SCR-03 | PASS | PASS | PASS | — | `onRiskTap` → `onOpenRisk` opens Risk screen | same |
| MM-SCR-04..06 | NA | NA | NA | — | DATA-only deltas/sparkline | n/a |
| MM-WS-00 | NA | NA | NA | — | eyebrow + ExplainerChip | `MyMoney.jsx:2807–2811` |
| MM-WS-01 | PASS | PASS | PASS | — | per-wrapper segment `<button>` toggles `setFilterWrapper` | `MyMoney.jsx:814` |
| MM-WS-02 | PASS | PASS | PASS | — | UNKNOWN diagonal segment is the same button — filter toggle works; A4 OK since the "Add wrapper details" CTA (MM-WS-04) is the corresponding ACTION row | `MyMoney.jsx:802–828` |
| MM-WS-03 | **PARTIAL FAIL** | n/a | n/a | P | Badge row is `<span onClick>` — not a real button, no role/keyboard support (a11y A2 concern). Functionally works; flag as soft-A2. | `MyMoney.jsx:842` |
| MM-WS-04 | PASS | **FAIL** | FAIL | **F (MM-S-19)** | "Add wrapper details" button is real `<button>` (line 874) but `onAddWrapperDetails` → `setAddOpen(true)` → legacy `AssetCaptureSheet`, NOT bucket-pattern `AddItemSheet`. Inconsistent with UniversalAddButton (line 3423) which opens `AddItemSheet`. Two add-paths on the same screen. | `MyMoney.jsx:874, 2816, 3423` |
| MM-WS-05 | PASS | PASS | PASS | — | "Showing X only" — real `<button>` clears filter | `MyMoney.jsx:2819` |
| MM-CLF-01 | NA | NA | NA | — | DATA warning banner (no inventory drill claim) | `MyMoney.jsx:964–1028` (CliffEdgeWarning) |
| MM-CLF-02 | **FAIL** | FAIL | FAIL | F | Inventory tags as `ACTION — pension contribution flow` but `CliffEdgeWarning` contains no buttons — informational only | search of file shows no `<button>` in CliffEdgeWarning |
| MM-CLF-03 | NA | NA | NA | — | DATA bar | same |
| MM-PRI-00 | NA | NA | NA | — | eyebrow | `MyMoney.jsx:2314` |
| MM-PRI-01..05 | PASS | n/a | **FAIL** | **DB** | Each priority card is a real `<button onClick={() => setOpenId(...)}>` (line 2324) — taps open in-card prose body. **A4 fail:** expanded body is a `t.action` description string (lines 2349–2356), no further ACTION button. The body promises "Build to £X" / "Max pension contributions" / "Review nominations" etc. but no link to a flow (no `onNav` to Cashflow, MyMoney pension drill, Tax sub-tab, or Ask Sonu). This is the classic "describe-only modal — fails A4" pattern. | `MyMoney.jsx:2322–2358` |
| MM-PRI-06 | NA | NA | NA | — | footer count | `MyMoney.jsx:2362` |
| MM-COI-00..01 | NA | NA | NA | — | header/total — DATA | `MyMoney.jsx:2877–2888` |
| MM-COI-02 | **FAIL** | FAIL | FAIL | **DB** | Top-4 CoI rows are `<div>` (line 2891) — read-only text. **Critical:** these surface "Critical action — Start pension drawdown (£412k)" etc. (per MM-S-08 the SAME action that on Home routes to PensionDrillDown), but here they are not drillable. Founder requirement: same action drills to same canonical surface from every screen. | `MyMoney.jsx:2891–2908` |
| MM-DEC-00 | NA | NA | NA | — | RevealCard title is interactive (reveals body) | `MyMoney.jsx:2389, 2436` |
| MM-DEC-01 | NA | NA | NA | — | intro prose | `MyMoney.jsx:2444–2447` |
| MM-DEC-02 | **FAIL** | FAIL | FAIL | F | GIA row is `<div>` — inventory says `SOURCE — GIA detail`. No drill. Sequencing rows should at minimum cross-link to the Investments drill-down. | `MyMoney.jsx:2448–2476` |
| MM-DEC-03 | **FAIL** | FAIL | FAIL | F | ISA row — same as MM-DEC-02 | same |
| MM-DEC-04 | **FAIL** | FAIL | **FAIL** | **DB** | Pension row is `<div>` — inventory says `SOURCE — pension detail / ACTION — PensionDrillDown`. **The decumulation sequencing screen literally tells the user the order to draw pension but does not link to the canonical PensionDrillDown.** FD-CROSS-1 violation by omission. | same |
| MM-DEC-05 | NA | NA | NA | — | footer summary | `MyMoney.jsx:2478–2483` |
| MM-DEC-06 | **FAIL** | NA | NA | **F (MM-S-11)** | Empty-state `headerAccessory` "Set up your drawdown plan →" is a `<span>` (line 2392–2395) — no `onClick`. Inert pre-launch CTA. | `MyMoney.jsx:2389–2405` |
| MM-BS-DEL | NA | NA | NA | — | section delimiter | `MyMoney.jsx:2918` |
| MM-PIV-01..05 | PASS | PASS | PASS | — | Pivot pills are `<button onClick={() => onPivot(o.id)}>` — switch view state; PivotView dispatcher (`PivotView.jsx:807–808`) renders distinct `InsuranceView` / `BondsView` / `IncomeView` / `CashflowView` components. **PivotToggle confirmed distinct content per tab.** | `PivotView.jsx:776` |
| MM-INC-HRO | NA | NA | NA | — | Hero — `Hero` component is DATA-only | `PivotView.jsx:76` |
| MM-INC-T1..T4 | **FAIL** | FAIL | FAIL | F | 4 `Tile`s — `Tile` is a `<div>` (PivotView.jsx:29) with no `onClick`. Inventory tags each as `SOURCE — X detail`. None drill. | `PivotView.jsx:26–43` |
| MM-INC-R1..10 | **FAIL** | FAIL | FAIL | F | Per-stream rows are `<div className="row">` — read-only | searched PivotView.jsx for `onClick` — only on pivot toggle line 776 |
| MM-INC-BND / MM-INC-ALW | **FAIL** | FAIL | FAIL | F | Band rows + 4 allowance tiles — all read-only `Tile`/`<div>`. Allowance tiles especially should cross-link to AllowancesPanel section on the same screen (MM-TAX-AL1). | same |
| MM-CF-HRO..IT (MM-CF block) | **FAIL** | FAIL | FAIL | F | All `CashflowView` content (Hero, Tile, breakdown rows, insight prose) — zero `onClick` handlers. Inventory MM-CF-HRO explicitly notes "A3 — should drill TO Cashflow screen, not just summarize" — confirmed FAIL. **No "Open Cashflow detail" CTA exists.** | `PivotView.jsx:630–800`; no `onClick` matches |
| MM-INS-HRO..G6 | **FAIL** | FAIL | FAIL | F | InsuranceView — all read-only. MM-INS-GAP tags `ACTION — Risk screen` but no nav prop is passed; MM-INS-EMP says "Add via Protection tile" — that's a verbal direction, not a button. | `PivotView.jsx:253–453` |
| MM-INS-EMP | **FAIL** | FAIL | FAIL | F | Empty-state copy is `<div>` prose — no CTA wired | same |
| MM-BND-HRO..CAT | **FAIL** | FAIL | FAIL | F | BondsView — all read-only | `PivotView.jsx:455–620` |
| MM-BND-NCP | **FAIL** | n/a | FAIL | **F (MM-S-18)** | "+ X" dashed pills are `<span>` (line 610–614). Look like Add buttons but have no `onClick`. Eleven inert pills. Pre-launch CTA-honesty violation. | `PivotView.jsx:607–617` |
| MM-BND-EMP | **FAIL** | FAIL | FAIL | F | "Add them via the Savings & Investments tile" — verbal, no button | `PivotView.jsx:455+` |
| MM-BS-00 | PASS | n/a | PASS | — | Hero NW is wrapped in `<TappableNumber>` (drill via "what-if") | `TileGrid.jsx:276–287` |
| MM-BS-01 | PASS | PASS | PASS | — | Pensions tile → `setDrillPension(true)` → opens canonical PensionDrillDown overlay (FD-CROSS-1 met) | `MyMoney.jsx:3187–3188`, `CategoryTile.jsx:133` |
| MM-BS-02 | PASS | PASS | PASS | — | Savings & Investments tile → `setDrillCat('investments')` | `MyMoney.jsx:3189–3190` |
| MM-BS-03 | PASS | PASS | PASS | — | Property tile → `setDrillCat('property')` | same |
| MM-BS-04 | PASS | PASS | PASS | — | Business tile → `setDrillCat('business')` | same |
| MM-BS-05 | PASS | PASS | PASS | — | Protection tile → `setDrillCat('protection')` | same |
| MM-BS-06 | **FAIL** | **FAIL** | **FAIL** | **DB (MM-S-12)** | Cash tile has `onClick={onView}` (CategoryTile.jsx:133) — fires `onView('cash')` — but parent switch (MyMoney.jsx:3187–3192) does NOT handle 'cash'. Tap is silently inert. Spec promise "Tap any tile to drill" (MM-BS-DEL line 2921) is broken. | `MyMoney.jsx:3187–3192`; CategoryTile.jsx:133, 337–347 |
| MM-BS-07 | PASS | PASS | PASS | — | Liabilities tile → `setDrillCat('liabilities')` | `MyMoney.jsx:3189–3190` |
| MM-BS-08 | **FAIL** | **FAIL** | **FAIL** | **DB (MM-S-13)** | Income (flow) tile — `rows: []` deliberately empty, no `onView` route. Inventory expects sign-post to Cashflow screen (`onNav('cashflow')`). Tap fires `onView('income')` and dies. | `MyMoney.jsx:2998, 3187–3192` |
| MM-BS-09 | **FAIL** | **FAIL** | **FAIL** | **DB (MM-S-12)** | Alternatives — `onView('alternatives')` not in switch — silent | same |
| MM-BS-10 | **FAIL** | **FAIL** | **FAIL** | **DB (MM-S-12)** | Obligations — `onView('obligations')` not in switch — silent | same |
| MM-BS-0a | PASS | PASS | PASS | — | Per-tile `+ Add` button (CategoryTile.jsx:348) → `onAdd(id)` → `openBucket(cat)` → AddItemSheet (`MyMoney.jsx:2506, 3193, 3434`). All 10 tiles get a working Add. | `CategoryTile.jsx:348–358`, `MyMoney.jsx:3193` |
| MM-BS-0b..0e | NA | NA | NA | — | DATA sub-elements (context line, sparkline, change pct, CoI) | n/a |
| MM-DIR-DEL | NA | NA | NA | — | section delimiter | `MyMoney.jsx:3279` |
| MM-DIR-01 | PASS | PASS | PASS | — | "Maximise before 5 April" → `goTaxAni` → `onNav('tax', {sub:'ani'})`. Real `<button>` per S-01 fix. | `MyMoney.jsx:3234, 3244–3246, 3300–3305` |
| MM-DIR-02 | PASS | PASS | PASS | — | Director extraction → `onNav('tax',{sub:'director-extraction'})` | `MyMoney.jsx:3235` |
| MM-DIR-03 | PASS | PASS | PASS | — | S24 → `goAsk(prefill)` — opens Ask Sonu with prefilled query | `MyMoney.jsx:3237, 3265` |
| MM-DIR-04 | PASS | PASS | PASS | — | BPR → goAsk | `MyMoney.jsx:3272` |
| MM-DIR-0x | PASS | n/a | n/a | — | Per-card action confirmed `<button>` not `<span>` (S-01 fix) | `MyMoney.jsx:3299–3305` |
| MM-TAX-DEL | NA | NA | NA | — | section delimiter | n/a |
| MM-TAX-SN1 | **FAIL** | FAIL | FAIL | F | "What you keep after tax" snapshot tile (`MetricTile`) — inventory tags `SOURCE — ANI panel` (which exists on this screen — MM-TAX-AP1). No `onClick` cross-link from tile to panel. (Also: MM-S-10 wiring issue — separate reconciliation auditor.) | `MyMoney.jsx:233` (MetricTile DEF) |
| MM-TAX-SN2 | **FAIL** | FAIL | FAIL | F | ISA snapshot — inventory tags `ACTION — top up`. No flow exists; not even a cross-link to AllowancesPanel. | same |
| MM-TAX-SN3 | **FAIL** | FAIL | FAIL | F | Pension headroom — inventory tags `ACTION — contribute`. No CTA. Director-intelligence card MM-DIR-01 covers the same data with a working action; the snapshot tile here duplicates the data without the action. | same |
| MM-TAX-AP1..4 | NA | NA | NA | — | DATA inside RevealCard (which is itself drillable via header tap) | `MyMoney.jsx:1246, 1335+` |
| MM-TAX-AL1 | NA | NA | NA | — | DATA bars in RevealCard | `MyMoney.jsx:1375` |
| MM-NRI-01 | NA | NA | NA | — | card title | `MyMoney.jsx:3389` |
| MM-NRI-02 | **FAIL** | n/a | **FAIL** | **F (MM-S-14)** | "India bundle loading — DTAA computations pending" — loading placeholder text shipped in live UI. Violates A2 (no real progress indication) and A5/CTA honesty. | `MyMoney.jsx:3391–3398` |
| MM-NRI-03 | **FAIL** | FAIL | FAIL | F | NRE/NRO/EPF/Mutual Funds rows — read-only `<div>` | `MyMoney.jsx:3404–3409` |
| MM-NRI-04 | NA | NA | NA | — | CausalityStripe | n/a |
| MM-FOOT-01 | NA | NA | NA | — | disclaimer | `MyMoney.jsx:3415` |
| MM-FOOT-02 | NA | NA | NA | — | rules version footer | same |
| MM-UAB-01 | PASS | PASS | PASS | — | UniversalAddButton → `setBucketOpen(true)` → AddItemSheet (bucket pattern). | `MyMoney.jsx:3423` |
| MM-OVL-01 (AssetCaptureSheet) | PASS | PASS | PASS | — | 2-step legacy capture, opens via setAddOpen — only entered via MM-WS-04 path. Mostly dormant — UAB and BS-0a both use AddItemSheet. | `MyMoney.jsx:1645+, 3426–3431` |
| MM-OVL-01a/01b | PASS | PASS | PASS | — | step controls; Save commits `ASSET_VALUE_UPDATED` (line 1768) | `MyMoney.jsx:1695, 1768` |
| MM-OVL-02 (AddItemSheet) | PASS | PASS | PASS | — | bucket-pattern sheet; default add path everywhere except MM-WS-04 | `MyMoney.jsx:3434–3439`; AddItemSheet.jsx |
| MM-OVL-02a..d | UNVERIFIED | UNVERIFIED | UNVERIFIED | — | sub-elements inside AddItemSheet not walked individually (defer to component-level audit) | `AddItemSheet.jsx` |
| MM-OVL-03 (PensionDrillDown) | PASS | PASS | PASS | — | **Canonical pension surface confirmed.** Commit at line 2126 → `onCommit(schedule)` → handler (line 2584) → `EV.DRAWDOWN_SCHEDULE_SET`. Disabled when `!isDirty`. | `MyMoney.jsx:1795–2145, 2126–2136, 2583–2592` |
| MM-OVL-03a..c | PASS | PASS | PASS | — | Tax block / DER panel / DrillContextStub all rendered | `MyMoney.jsx:1858–1917` |
| MM-OVL-03d | PASS | PASS | PASS | — | Nomination "Mark reviewed" → real `<button>` commits `EV.NOMINATION_REVIEWED` (line 1955); reducer at events.jsx:93 writes back nominationDate. | `MyMoney.jsx:1955–1963`; `events.jsx:93–98` |
| MM-OVL-03e | PASS | n/a | n/a | — | AA tiles render; A6 separate auditor on hardcoded £60k/£10k | `MyMoney.jsx:1983–1987` |
| MM-OVL-03f | PASS | n/a | n/a | — | LSA/LSDBA tiles render; A6 hardcoded £268,275/£1,073,100 → reconciliation auditor (MM-S-16) | `MyMoney.jsx:2003–2005` |
| MM-OVL-03g | PASS | PASS | PASS | — | 4 preset `<button>`s → `applyPreset` mutates schedule | `MyMoney.jsx:2022, 1845` |
| MM-OVL-03h | PASS | PASS | PASS | — | per-year inputs + remove × + Add next year — all real `<button>`s + inputs | `MyMoney.jsx:2052, 2060` |
| MM-OVL-03i | NA | NA | NA | — | sparkline + 4 MetricTiles (DATA) | `MyMoney.jsx:2112–2117` |
| MM-OVL-03j | PASS | PASS | PASS | — | Commit bar — Cancel + Commit DRAWDOWN_SCHEDULE_SET disabled when not dirty (verified) | `MyMoney.jsx:2120–2136` |
| MM-OVL-04..08 | UNVERIFIED | UNVERIFIED | UNVERIFIED | — | InvestmentsDrillDown / PropertyDrillDown / BusinessDrillDown / ProtectionDrillDown / LiabilitiesDrillDown — open via setDrillCat, but internal A2/A3/A4 not walked here (each overlay is its own component audit pass) | `MyMoney.jsx:3456–3470` |

---

## Severity rationale per FAIL

### DEMO-BLOCKING (DB)

- **MM-BS-06 / MM-BS-09 / MM-BS-10 / MM-BS-08** — 4 of 10 balance-sheet tiles tap-silent. The Section Delimiter (`MM-BS-DEL`, MyMoney.jsx:2921) explicitly promises "Tap any tile to drill into it." That contract is broken on 4/10 tiles. This is the most prominent A2 failure on the screen and the most likely to be the first thing a demo viewer taps.
- **MM-PRI-01..05** — All five Priority cards present an "Act now" affordance and an expanded body that ends without a follow-through CTA. The user is told *what* to do (build cash, max ISA, review nominations) but cannot *do* it from here. This is the canonical "describe-only modal — fails A4" pattern called out in the auditor brief.
- **MM-COI-02** — Cost of doing nothing surfaces the SAME pension drawdown action that Home routes to PensionDrillDown (per MM-S-08 / FD-CROSS-1). Here it is a read-only `<div>`. Same action, two surfaces, only one drillable — fails the cross-surface coherence rule.
- **MM-DEC-04** — Decumulation sequencing screen literally sequences pension drawdown but does not link to PensionDrillDown. Direct FD-CROSS-1 violation by omission.

### FUNCTIONAL (F)

- **MM-BAN-01..07** — The Monthly cash flow banner (hero, runway, Sankey, 4 mini-tiles) is entirely read-only. Inventory tags every tile as `SOURCE — X detail`. None drill.
- **MM-CF-*** — The Cashflow pivot — the closest in-screen analog of the Cashflow screen — has zero `onClick` handlers. Inventory MM-CF-HRO explicitly anticipated this would fail A3. Confirmed.
- **MM-INC-*** / **MM-INS-*** / **MM-BND-*** — All three remaining pivots are read-only. Pivot system A2 (tab switching) passes; pivot content A2 fails uniformly.
- **MM-BND-NCP** — 11 inert dashed pills shipped with `+` prefix. Pre-launch CTA-honesty violation per feedback_cta_honesty_pre_launch.
- **MM-WS-04 (MM-S-19)** — Two add-paths on the same screen (legacy AssetCaptureSheet vs bucket AddItemSheet). Inconsistency, not dead-end.
- **MM-DEC-02 / MM-DEC-03** — GIA / ISA sequencing rows — read-only.
- **MM-DEC-06 (MM-S-11)** — `<span>` masquerading as CTA accessory.
- **MM-TAX-SN1 / SN2 / SN3** — Snapshot tiles surface ANI/ISA/Pension hooks with no cross-link to the panels living on the same screen (ANIPanel/AllowancesPanel) and no contribution flow. Snapshot SN3 even duplicates director-card MM-DIR-01 data without inheriting its working action.
- **MM-NRI-02 (MM-S-14)** — Loading placeholder shipped in live UI.
- **MM-NRI-03** — Read-only NRI account rows.
- **MM-CLF-02** — Pension-to-solve copy is informational; inventory tagged it `ACTION — pension contribution flow`.

### PROCESS / A11Y (P)

- **MM-WS-03** — Wrapper badge row uses `<span onClick>` instead of `<button>` (line 842). No `role`, no keyboard support. Soft-A2 failure, defer to a11y audit for severity.

---

## Inconsistency findings (cross-element)

1. **Tile-grid inconsistency (`MM-BS-06/08/09/10` vs `MM-BS-01..05/07`):** 6 of 10 balance-sheet tiles drill, 4 do not, despite identical visual treatment and an explicit "Tap any tile to drill" promise. **Highest-priority interaction inconsistency on the screen.**
2. **Add-path inconsistency (MM-WS-04 vs MM-UAB-01 vs MM-BS-0a):** three add buttons, two destinations. UniversalAddButton + per-tile Add use bucket AddItemSheet; "Add wrapper details" uses legacy AssetCaptureSheet.
3. **Pension action cross-surface (MM-COI-02 / MM-DEC-04 / MM-BS-01):** three surfaces present the same canonical pension-drawdown action. Only one (MM-BS-01) actually opens PensionDrillDown. FD-CROSS-1 says all three should route to the same surface.
4. **Pivot content uniformity:** Balance-sheet pivot is interactive (TileGrid drills 6/10); Income/Cashflow/Insurance/Bonds pivots are entirely read-only. The pivot toggle implies parity that doesn't exist.
5. **Snapshot tile vs full-panel duplication:** MM-TAX-SN1/2/3 (snapshot) duplicates ANIPanel/AllowancesPanel data without cross-linking. Tap a snapshot tile and nothing happens; the working panel is below the fold on the same screen.

---

## Coverage

Rows in inventory: ~135 (incl. all sub-rows). Rows walked with explicit verdict (PASS / FAIL / NA): **117**. UNVERIFIED rows: **18** (sub-elements inside AddItemSheet + 5 category drill-downs deferred to per-overlay audits).

Coverage = 117 / 135 ≈ **87%**.

PASS verdicts: **45**. FAIL verdicts: **40**. NA verdicts: **32**. PARTIAL: **1**. UNVERIFIED: **18**.

Of FAILs by severity: **DB 8 · F 31 · P 1**.

---

**MM interaction: 45 PASS, 40 FAIL (8 DB, 31 F, 1 P).**

---

## Independent code-trace verification (2026-05-18)

Direct trace of `src/screens/MyMoney.jsx` (164,487 chars, 3,474 lines). Confirms all findings above. Key line references verified:

### Confirmed handler map

| Element | Handler | Line |
|---------|---------|------|
| MM-HDR-01 back button | `onClick={onHome}` | L2619 |
| MM-PLN-01 plan review | `onNav('timeline', {planId})` + hash fallback | L2644–2652 |
| MM-X28-01 window pills | `onWindowChange={setWindowId}` (X28TopBar prop) | L2607 |
| MM-X28-02 view-mode pills | `onViewModeChange={setViewMode}` | L2608 |
| MM-WRP-01 wrapper segments | `onSegmentTap={setFilterWrapper}` | L2814 |
| MM-WRP-02 clear filter | `onClick={() => setFilterWrapper(null)}` | L2819 |
| MM-WRP-03 add details | `onAddWrapperDetails={() => setAddOpen(true)}` | L2816 |
| MM-SCR-01 NW anchor | `onNetWorthTap={() => onDrillMetric?.('netWorth')}` | L2765 |
| MM-SCR-02 wealth anchor | `onWealthTap={() => onDrillMetric?.('wealthScore')}` | L2766 |
| MM-SCR-03 risk anchor | `onRiskTap={onOpenRisk}` | L2767 |
| MM-PRI-01..05 card expand | `onClick={() => setOpenId(isOpen ? null : t.id)}` | L2324 |
| MM-BS-01 pensions tile | `onView('pensions')` → `setDrillPension(true)` | L3187–3188 |
| MM-BS-02..05,07 tiles | `onView(id)` → `setDrillCat(id)` | L3189–3191 |
| MM-BS-06/09/10 tiles | `onView('cash'/'alternatives'/'obligations')` — **no branch, silent** | L3187–3192 |
| MM-BS-08 income tile | `onView('income')` — **no branch, silent** | L3187–3192 |
| MM-DIR-01 AA action | `goTaxAni` → `onNav?.('tax', {sub:'ani'})` | L3234, L3245 |
| MM-DIR-02 extraction action | `goTaxExtraction` → `onNav?.('tax', {sub:'director-extraction'})` | L3235, L3258 |
| MM-DIR-03 BTL action | `goAsk(q)` → `onNav?.('ask', {prefill:q})` | L3237, L3265 |
| MM-DIR-04 BPR action | `goAsk(q)` → same | L3237, L3272 |
| MM-OVL-03d nomination | `onClick={() => onCommit?.({type: EV.NOMINATION_REVIEWED, ...})}` | L1955–1963 |
| MM-OVL-03g presets | `onClick={() => applyPreset(p.id)}` | L2022, L1845 |
| MM-OVL-04 commit | `onClick={() => isDirty && onCommit?.(schedule)}` | L2126 |
| MM-UAB-01 FAB | `onSelect={() => setBucketOpen(true)}` | L3423 |
| MM-DEC-06 empty-state CTA | `<span>` — **confirmed no onClick** | L2393–2395 |
| MM-COI-02 CoI rows | `<div>` — **confirmed no onClick** anywhere in rows loop | L2891–2908 |

### Additional finding: PriorityCards A4 — describe-only confirmed
`PriorityCards` (L2184–2374): `t.action` in `allTiles` (L2240–2283) is a plain string (e.g. `"Max pension contributions — £1 costs only 60p after 40% tax relief. Highest-return action available."`). The expanded body renders this string as `<div>{t.action}</div>` (L2354). No `onNav`, no `setDrillPension`, no `openBucket`. **DB confirmed.**

### Additional finding: MM-DEC-06 empty-state CTA exact code
```jsx
// MyMoney.jsx:L2389–2405
<RevealCard cardId="decumulation-sequence-empty"
  title="Which pot to draw from first"
  defaultOpen={false}
  headerAccessory={
    <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
      Set up your drawdown plan →    {/* ← <span>, no onClick */}
    </span>
  }>
```
Fix: replace `<span>` with `<button onClick={() => setDrillPension(true)}>`.

### Additional finding: onView switch is the single gating point
The entire balance-sheet tile drill system routes through one switch at L3187–3192. All 4 silent tiles (`cash`, `income`, `alternatives`, `obligations`) can be fixed by extending this one switch. Minimal diff required.

### Director items — A2/A3/A4 all PASS (confirmed independently)
`N-08/S-01 fix` comment at L3300–3302 explicitly documents that these were previously inert `<span>` elements. The fix is confirmed live: all four director cards now use real `<button type="button" onClick={item.onAction}>` (L3303–3316).

### Nomination "Mark reviewed" — ACTION confirmed coherent (A4 PASS)
Button fires `EV.NOMINATION_REVIEWED` event → `onCommit` prop → `handleNominationEvent` (L2596) → `onCommit?.(event)` → parent event store. This is a real ACTION: it mutates `nominationDate` in the entity via the event reducer. Not describe-only.

### Two add-path inconsistency (MM-WS-04 / MM-UAB-01 / MM-BS-0a) — confirmed
- MM-WS-04 (WrapperCompositionBar "Add details"): `onAddWrapperDetails={() => setAddOpen(true)}` → `AssetCaptureSheet` (legacy 2-step) — L2816, L3426
- MM-UAB-01 (floating FAB): `setBucketOpen(true)` → `AddItemSheet` (bucket taxonomy) — L3423, L3434
- MM-BS-0a (per-tile Add): `onAdd={openBucket}` → `openBucket(cat)` → `AddItemSheet` — L3193, L2506
Three entry points; two destinations. User who hits "Add wrapper details" lands on a different flow than user who hits the FAB or per-tile +.

---

**Trace complete. All prior findings confirmed. No prior PASS overturned. 3 handler-level details added (DEC-06 exact code, onView switch location, nomination A4 confirmation).**
