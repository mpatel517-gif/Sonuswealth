# Tax & Estate — signature visual + chart system design

**Date:** 2026-06-08 · **Screen:** `src/screens/TaxEstate.jsx` (already refactored to tiles+drawers)
**Driver:** founder review — *"not enough thought has been put into this tab… it's lacking the in-depth visual aid the other 3 tabs have."*

## Context

The other three primary tabs each have a signature dataviz identity: Home = radar, Cashflow = Sankey, MyMoney = balance-sheet composition. Tax & Estate is tiles + text. The 1A/1B work fixed structure (categorisation, drawers, drillability) but gave the tab no visual identity and left several dead/duplicated controls. This spec adds the visual identity and resolves the 8 review findings.

### The 8 findings → how this design resolves them

| # | Finding | Resolution |
|---|---|---|
| 1 | Choices view **duplicates** (appends to) tile content; shows internal `DE-15`… codes | Choices **replaces** the tile grid when active (Cashflow pattern); strip the `DE-*` codes from the decision chips |
| 2 | Today/Future/Plan/What-if **do nothing** | Replace with a meaningful **Now / After-plan** toggle the radar + numbers respond to. Real Future/What-if (forward projection + Budget scenarios) return in Phase 2 |
| 3 | "Adj net income" unclear | Rename surface label → **"Income HMRC counts"** (full term + plain gloss inside the drawer) |
| 4 | Need charts per taxation matter | Each tile carries its **signature mini-chart on its face** (marginal-rate mountain, allowance gauges, IHT waterfall, gift-clock ring) — reuse existing chart components |
| 5 | Lacks an in-depth visual aid like the radar | **Tax & Estate radar** = the signature hero (below) |
| 6 | Want previous tax years without bloating the global dropdown | Compact **year-stepper** (◀ 2024/25 · 2026/27 ▸) on the tab, separate from the global horizon dropdown |
| 7 | Self-assessment **does nothing** | Becomes the **document home** — upload/scan SA302/P60/SIPP statements, show what's pre-fillable |
| 8 | Not enough thought | The radar + per-tile chart system + functional controls is the design thought |

## The signature visual — Tax & Estate radar

A 6-spoke radar, each spoke scored 0–100, each tappable to drill into its tile. Reuses `Dashboard/RadarChart.jsx` (already used on Home). Sits at the top of the tab (above the sub-anchor pills), always visible, the at-a-glance "how am I doing across tax & estate".

| Spoke | v1 score heuristic (engine) | Drills to tile |
|---|---|---|
| Income-tax efficiency | higher when effective rate is low for the income level | Income & tax |
| Allowances used | beneficial-allowance utilisation (ISA/pension headroom captured) | Allowances |
| Capital gains | 100 within annual exempt amount; falls as untaxed gains build | Capital gains |
| IHT exposure | `100 × (1 − iht_due / estate)` — 100 = no IHT due | Inheritance tax |
| Estate readiness | % of {will current, LPA registered, nominations set} | Wills & who inherits |
| Gift planning | annual-exemption + 7-year-clock usage | Gifts |

**New engine module:** `src/engine/tax-estate-radar.js` exporting `taxEstateRadar(entity, bundle)` → `{ spokes: [{ key, label, score, drillTile, basis }], overall }`. Each spoke carries a plain-English `basis` string for the drill. **All scores labelled provisional / pending the independent calc audit** (per `project_independent_calc_audit_required`); heuristics are v1 and need calibration — flagged in code + UI confidence chip.

**Now / After-plan toggle:** the radar renders two states — current, and projected after the user's recommended/committed actions (reuse the existing plan/decision deltas). The toggle replaces the dead view-mode bar.

## Per-tile mini-charts (reuse existing)

- Income & tax → `SteppedBandsChart` (marginal-rate mountain, already in file)
- Allowances → `GaugeBar` row (already in file) — headroom bars
- Capital gains → CGT gains-vs-exempt bar (CGTDetail already has it)
- Dividends → dividend allowance + rate bars (DividendDetail already)
- Inheritance tax → `IHTWaterfall` thumbnail / `IHTDeltaCard`
- Gifts → gift-clock ring (GiftClock already)

Tiles show the chart small; the drawer shows it full + the proof drill.

## Controls

- **Year-stepper (GLOBAL — all screens, founder 2026-06-08)** — a small inline `◀ 2024/25 · 2026/27 · 2027/28 ▸` control. It is **not** tax-only; it lives in the app header next to the global tax-year chip (`Dashboard.jsx` `GlobalTaxYearChip`) so it appears on every screen. Steps the active rule bundle (`src/rules/` UK-2021…UK-2027) via `setBundle` / the existing `useTaxYear` store, so every screen re-renders for the chosen year. Distinct from the horizon dropdown (which keeps Current/Last/Next/horizons — no big historical list added to it, per the founder). New shared component `src/components/shared/YearStepper.jsx`. (Engine already supports bundle-swap; prior-year *user* figures = Phase 2.)
- **Choices** — when the Choices tab is active, render `DecisionDrawers` **instead of** the tile grid; pass a prop to suppress the `DE-*` codes.

## Self-assessment → document home

Reuse the `src/services/parser.js` skeleton (mock provider exists). The tile drawer gets: an upload/scan affordance, the FP-5 verify modal (extracted fields → user confirms), and a "what we can pre-fill vs what's still needed" list. **Real OCR provider (anthropic-vision) is a follow-up** — v1 wires the upload UI + verify flow against the mock parser so the path is real and visible; swapping in real OCR is isolated to the parser provider.

## Scope / phasing of THIS increment

1. Quick fixes: Choices replace-not-append + strip DE codes; "Adj net income" rename. (small)
2. Tax & Estate radar + `tax-estate-radar.js` scoring + Now/After-plan toggle. (core)
3. Per-tile mini-charts surfaced on tile faces. (medium)
4. Year-stepper UI (bundle-swap). (medium)
5. Self-assessment document-home UI + verify flow against mock parser. (medium)

Deferred to Phase 2 proper: real OCR provider, real forward prediction + Budget what-ifs, prior-year *user* data store, reports.

## Component reuse (no new primitives except the radar scoring module + year-stepper)

`Dashboard/RadarChart.jsx`, existing `SteppedBandsChart`/`GaugeBar`/`IHTWaterfall`/`GiftClock`/`IHTDeltaCard` in-file, `services/parser.js`, the 1B `CategoryDrawer`/`CatTile`.

## Verification (CLAUDE.md §9.5)

Live DOM + screenshot on Bruce (`demo=a`) + Mr T (`demo=mrt-core`), both sub-tabs, 3 viewports × 2 themes; radar spokes tie to engine scores; spoke tap → correct drawer; Now/After-plan toggle re-renders radar; year-stepper swaps bundle (IHT/bands shift); Choices replaces grid; upload affordance + verify modal round-trip; build exit 0; regression 180/180.

## Out of scope / non-negotiable note

All radar scores + tax numbers remain **provisional, pending the independent calc audit** (the launch gate). This design adds presentation + the scoring layer; it does not certify the maths.
