# Money-Surface Component Inventory + Tile Blueprint

**Date:** 2026-06-01
**Status:** DOCUMENTED — the locked reference for rolling the pension-tile blueprint to every tile, every tab, every persona.
**Cluster:** 2-Product / MyMoney (+ shared)
**Owner:** founder + Claude (product-architect)

**Summary:** Every component we added / removed / adjusted / simplified while converging the pension surface, plus the resulting **tile blueprint** and the **rollout checklist** to apply it across all tiles, tabs and personas.
**Tags:** #mymoney #blueprint #components #rollout
**Updated:** 2026-06-01

---

## 1. Components ADDED

| Component | Path | What it does |
|---|---|---|
| **TrajectoryBar** | `src/components/MyMoney/TrajectoryBar.jsx` | Pattern A temporal bar. Solid = Now, faint = Future drift, gold tip = Plan boost. Compact (bar + "→ £X"); tap → exact Now/Future/Plan. Pure markup; caller passes the 3 values. |
| **ContributionDecomposition** | `src/components/MyMoney/L3/ContributionDecomposition.jsx` | Stacked area: contributed base (you + employer) vs investment growth. "What I put in vs what it grew" — decomposition, not overlay. |
| **FundDonut** | `src/components/MyMoney/L3/FundDonut.jsx` | Part-to-whole donut for "what's inside this pot", colour-aligned to fund rows. |
| **PotBadge / potBadge()** | `src/components/MyMoney/L3/PensionSummaryDrill.jsx` | Refined colour-coded scheme-type pill (SIPP/SSAS blue, DB violet, FAD teal, legacy neutral). Replaced the basic dashed boxes. |

## 2. Components REMOVED / SIMPLIFIED

| Removed | Where | Why |
|---|---|---|
| Per-holding **name legend** (Vanguard/Hargreaves/Wayne 49%…) | CategoryTile composition | macOS PP-2 — names are drill detail, not surface. Bar + "across N" stays. ([[feedback_no_holding_names_on_tiles]]) |
| **"See all N pensions →"** button | CategoryTile | Redundant with "across N" + "View detail →". |
| **`minHeight: 320`** fixed floor | CategoryTile + LiabilityTile | Voided sparse tiles, couldn't equalise tall ones. Now size-to-content + per-row grid stretch. |
| **MiniTrendLines** sparkline | CategoryTile (top-right), PensionLeaf fund rows, PensionSummaryDrill pot rows | Replaced by the meaningful now→future TrajectoryBar. |
| **InlineFuture** (interim "→ £X" text-only) | CategoryTile | Superseded — the bar itself sits inline next to the value. |
| Empty-data category tiles (Business/Alternatives when £0) | TileGrid | "Only show what a person has." Add via the Add-category control. |

## 3. Components ADJUSTED

| Component | Change |
|---|---|
| **CategoryTile** | Value row = big number **+ TrajectoryBar inline** (Now/Future/Plan). Footer = `View detail →` · `What if ⚡` · `+ Add`. Heights sync per row. No name legend. |
| **TileGrid** | Filters to held categories (`hasData`). Threads `trajectory`, `activeLens`, `onWhatIf`. Wrapper `height:100%` for row-equal heights. |
| **LiabilityTile** | Dropped 320 floor; single-debt width capped; reads `l.rate` (was hollow). |
| **PensionLeaf** | DB/zero-value guard (guaranteed-income panel, no £0 projection); InteractiveProjection (history + drag retire + net-of-charges); ContributionDecomposition; FundDonut; per-fund TrajectoryBars. |
| **PensionSummaryDrill** | Colour-coded badges; per-pot TrajectoryBars; DB row shows CETV not £0; CTA uses `--c-on-accent`. |
| **InteractiveProjection** | "Today's money" toggle uses `--c-on-accent` (light-theme contrast). |
| **AskPill** | `position: fixed` (was absolute — scrolled over content); `.sw-ask-pill` clears the 240px sidebar on desktop. |

## 4. Engine / data / tokens

- `src/engine/projection.js` — `projectValue(now, rate, years, contributionPerYear)` used for Future (no contrib) vs Plan (with contrib).
- `src/rules/personas/persona-a.json` — seeded SIPP funds, contributions, valuation history (demo richness; Wayne left sparse for graceful-degradation).
- `src/index.css` — **`--c-on-accent`** token (dark #06231f / light #ffffff) — fixes dark-text-on-indigo buttons in light theme.

---

## 5. THE TILE BLUEPRINT (what every category tile must be)

1. **Header**: icon · LABEL · 12-mo change %.
2. **Value row**: big number **+ TrajectoryBar inline** (Now solid · Future faint · Plan gold tip; tap = exact 3-way). Headline figure = active lens value.
3. **Composition** (if N>1 holdings): "across N {noun}" + one **drillable colour bar**. **No name legend.**
4. **One context line** (cost-of-waiting / relief) — earns its place or is cut.
5. **≤1 status chip** (e.g. SIPP-IHT delta).
6. **Footer** (symmetric across all tiles): `View detail →` · `What if ⚡` (topic-scoped) · `+ Add`.
7. **Height** syncs with its row; sizes to content (no fixed floor).
8. **Only render if the user holds it.** Empty categories → Add-category control, not a tile.

**Temporal:** Future = autopilot growth (no new money). Plan = Future + planned contributions/committed scenarios (real, never faked; plan==future when none). Global Today/Future/Plan lens sets the headline figure.

**What-if (3 tiers):** global (Home) · tab-scoped (this tab's topics) · per-item (`What if ⚡`, this topic only) — all bound to the shared scenario engine.

---

## 6. ROLLOUT CHECKLIST — apply to all tiles, tabs, personas

Most of the blueprint lives in the **shared** CategoryTile/TileGrid, so MyMoney tiles inherit it already. Remaining work:

**Per persona (a–g):** verify each renders correctly — held-categories filter, trajectory bar (+ plan where contributions exist), DB/edge handling, no name legend, pill fixed. (a/c/f spot-checked; b/d/e/g pending visual.)

**Per tab:** the trajectory bar + temporal lens + per-item what-if currently live on **MyMoney**. Extend to:
- **Home** — NW tile + pillar tiles get the trajectory bar.
- **Cashflow** — surplus/runway tiles.
- **Tax & Estate** — IHT/liability tiles.
- **Risk**, **Timeline** — where a value projects.

**Per-item what-if (tier 3):** upgrade the entry (currently a topic-seeded Ask) to the **inline mini-what-if** (drag retire/contribution in place), bound to the shared engine.

**Remaining trajectory increments:** wire per-category committed-scenario deltas into Plan beyond contributions; big number follows the global lens on switch.

**Gate per rollout step:** §9.5 snap (3 viewports × 2 themes) + numeric tie-out (Σ tile Futures == NW Future).
