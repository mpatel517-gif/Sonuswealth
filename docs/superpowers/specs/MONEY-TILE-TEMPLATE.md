# THE MONEY TILE TEMPLATE — single source of truth

**Status:** LIVING. This is the authoritative spec for every balance-sheet tile (assets AND liabilities), every tab, every persona. **When a bug is found: fix it, encode the rule here, re-apply to all tiles, re-run the audit.** This file is always current.
**Owner:** founder + Claude. **Updated:** 2026-06-01.

**The loop (non-negotiable):** error found → fix → update this template's rule → apply to ALL tiles → audit every tile against every rule (§AUDIT) → only then "done."

**Architectural law (why drift happens):** one tile structure, one composition code path, one drill pattern. Assets and liabilities share the SAME tile component. If a rule lives in two places, they WILL diverge — converge them.

---

## R1 · A tile only exists if the person holds it
Empty category → no tile (use the Add-category control). No £0 tiles, no £0 rows inside drills. Verified per persona.

## R2 · Header = icon · LABEL · change%
- `change%` = the category's own annualised figure (real `valuation_history` if present, else its drift). **Always carries a basis label ("12-mo est.").** NEVER the net-worth change stamped on every tile. Same treatment on every tile.

## R3 · Value = big number, follows the active lens
- Today→now · Future→future · Plan→plan. Tappable (`⚡`) for the per-item what-if. Liabilities render negative (coral).

## R4 · Trajectory bar = the ONE trend/projection viz, inline next to the value
- Now → Future → Plan. **Assets grow** (future ≥ now); **liabilities shrink** (`invert`, future ≤ now, lower = good). 
- **Plan is REAL or absent** — `plan == future` unless a committed scenario/contribution exists. Never fake a gold tip.
- Present whenever `future ≠ now`. This bar — not a sparkline — carries "where it's going."

## R5 · Sparkline (header) — per-holding, REAL-data-driven, and CONSISTENT across tiles
Revised 2026-06-01 (founder: image 1 had sparklines on pensions but none on savings/property — "fix these against the template and see if the template works"). The honesty rule stands AND the tiles must look consistent — both, via real per-holding data:
- **One line PER holding**, and **every line uses that holding's OWN rate** so the lines genuinely diverge (NEVER one category drift applied to all → identical clones = the fake the founder caught).
- Source priority, per holding: (1) real `valuation_history`; else (2) reconstruct from that holding's own `growth_rate_assumption`; else (3) `growthRateFor(wrapper, getActiveCMA())`. All three are real, per-holding, dynamic — **no hardcoded `CAT_MONTHLY_DRIFT`** (see R14). Reconstructed lines are labelled "est."
- Because every holding has a rate (own or CMA), **every multi-holding tile gets a sparkline** → consistent across tiles. A 1-holding tile shows one line.

**Implementation reality (founder 2026-06-01, round 2 — "Did you fix the multiple spark lines required?"):**
- Build **one line PER holding** (`tile.trendSeries = number[][]`), not one category line — a tile with N holdings must render N lines. The row's per-holding data lives under `row.raw` (the display row's top-level fields are stripped of rate/history); read `raw.valuation_history` then `raw.growth_rate_assumption`/`raw.growth`, fall back to the wrapper/category CMA rate.
- `MiniTrendLines` plots each line as **% change from its own start on ONE shared y-scale** (trend, not absolute £ — absolute makes every line near-flat because the holding-size spread dwarfs 12-month growth). Faster-growing holdings visibly rise above slower (Mr T investments fan 4%→12%).
- **Honest overlap is not a bug:** holdings that genuinely share a growth assumption (e.g. two UK properties, two business holdings at the generic class rate) produce coincident % trajectories — they read as one line. The "across N" composition bar already states the count. To make same-rate holdings visibly distinct, seed **real per-holding `valuation_history`** (the gold path — Bruce's SIPPs); never fabricate divergence with cosmetic noise (that's the identical-clone fake under a disguise).

## R5b · Liability sparkline + trajectory + change% — same rules, debt-aware
- A debt's line/trajectory uses its **amortisation** (balance × rate − payment). If there's no payment/rate to amortise, there is **no `+0.0%` and no flat fake** — hide the change% (R7: no meaningless deltas). Founder 2026-06-01: Mr T's Credit-Card/Student-Loan/BTL showed "+0.0% · 12-mo est." — meaningless.
- Liability labels are **humanised dynamically** — "Credit card", "Student loan (Plan 2)", "Buy-to-let mortgage" — never raw `credit-card` / `student-loan-plan2` (replace BOTH `-` and `_`, expand `btl`/`plan2`). No CSS `capitalize` on a hyphenated slug.

## R6 · Composition = ONE pattern everywhere
- `across N {noun}` + a single **drillable colour bar**, each segment tapping into that holding. Shown when N ≥ 2 holdings.
- **No holding names** (Vanguard/Hargreaves) and **no wrapper-% legend** ("ISA 53% · GIA 47%") on the surface — that's drill detail. Kill the second composition code path. Same on pensions, savings, property, liabilities.
- **Pluralize the noun properly** — "across 2 **properties**", not "propertys"; "policies" not "policys" (-y→-ies, -s/x/ch/sh→-es). Use `pluralize()`, never `noun + 's'`. (Audit-found 2026-06-01.)

## R7 · Context line ≤1, real, earns its place. Status chip ≤1.
No duplicated context, no unlabelled deltas, no decoration.

## R8 · Footer = `View detail →` · `What if ⚡` · `+ Add` — IDENTICAL on every tile
Same labels, same order, asset and liability.

## R9 · Every CTA opens a working destination
- `View detail →` opens the category drill **as a full-screen overlay** (DrillStack root is `position:fixed; inset:0`), NOT inline below. `What if ⚡` fires the topic-scoped what-if. `+ Add` opens the add flow at this category. The value `⚡` opens the item what-if. The icon opens the drill. **Each verified to actually navigate, live.**
- **Wherever you go, you must be able to get back (founder 2026-06-01).** EVERY drill surface — including L4 number/provenance panels — shows ← Back AND ⌂ Home. Gotcha: `L3PanelHost` must wrap `DrillStackProvider` OUTSIDE `OverlayShell` (the fixed DrillStack would otherwise paint over the shell's header), and pushed L-panels use `zIndex 600+i` (above the base shell's 500) so a deeper panel renders on top WITH its breadcrumb ← Back, not hidden behind the shell. A drill with no visible way back is a bug.

## R10 · The drill reads the SAME data the tile reads
Same fixture field names (`rate` not only `interest_rate`; `monthlyPayment` not only `monthly_payment`). The drill is itself a surface — R1 (only-what-they-have) and R9 (every CTA works) apply inside it too.

## R11 · Heights sync per row; size to content (no fixed floor).

## R12 · Works at 3 viewports × 2 themes; numeric tie-out holds (§9.5 Gate 2)
Σ tile values == hero Assets; Assets − Liabilities == NW, at every lens/horizon.

## R13 · EVERY number drills to its source — no exceptions, including summary metrics
Founder 2026-06-01: the Balance-Sheet Net-Worth-Trend metric tiles (1-Year Growth, Last Month, Debt Ratio, Time Covered, Income Buffer) and its sparkline "are not drillable — every item presented should explain and go to the nth degree to the source document, with a way to add/modify information." So: **every displayed figure — hero, tile, summary-strip metric, drill cell, trend line — is tappable** and opens a provenance chain bottoming out at a **user fact** (value + when captured + confidence, with add/modify) or a **named rule** (TAX/CMA/legislation + status). A number with no drill is a bug. (Product-architect doctrine §2–§3.)

**Canonical implementation (reuse — do NOT reinvent).** The R13 primitive already exists and is wired:
- `L4NumberPanel` (6 sections: restated value · HOW CALCULATED · WHERE FROM + confidence · recursive breakdown · WHAT YOU CAN DO incl. `LeafEditForm` → `ASSET_FIELD_CORRECTED` · WHAT IF) + `DrillableNumber` (dotted-underline tappable) + `DrillStack`/`DrillStackProvider` (pushes deeper levels) + `L3PanelHost` (OverlayShell chrome + edit-commit fold).
- A surface makes a number drillable by building an L4 payload `{ metric, value, formula, source, confidence, breakdown[], whatIf, actions? }` and opening it through `L3PanelHost`. Breakdown rows carry `.drill` to recurse; a leaf is `editable` ONLY when its dotted `path` provably EXISTS in the effective entity (`_setByPath` won't create intermediates — a non-existent path = a FAKE edit affordance). Composite figures (net worth, total assets) are not inline-editable — they route via `actions` to the category drill where holdings are edited.
- Worked example: the NW-trend tiles use `trendMetricDrill.js` (`buildTrendMetricDrill`) → `TileGrid` `onDrillMetric` → `MyMoney` hosts the overlay. Verified 2026-06-01: persona-a + Mr T, dark+light; recursive tie-out (assets £4.08m = Σ categories), CTA routing, and edit-commit live-recompute (Mr T target £2.5m→£3.0m flipped Plan funded 28%→23%).

## R14 · Nothing hardcoded — all dynamic
Founder 2026-06-01: "Make sure nothing is hard coded — it must be all dynamic." No magic numbers in render: growth rates from `getActiveCMA()` / per-holding `growth_rate_assumption`, thresholds from `TAX`/rules-uk, labels derived from data. `CAT_MONTHLY_DRIFT` and any literal rate/threshold in a component is a violation. Values come from the engine/selectors/fixtures, never typed into JSX.

## R15 · A drill is itself a full screen built to THIS template — categorised like the pension drill
Founder 2026-06-01: the liabilities drill "seems incomplete, not categorised properly like pensions … apply the same principles as every other screen"; Mr T's liabilities drill is "scrambled, cluttered, not properly thought through." So every category drill has the pension-drill shape: **grouped by type** → **per-item row → per-item leaf** (full detail, drill-to-source per R13) → composition (R6) → context/options. Same chrome (OverlayShell, R9), same depth, same cleanliness. A flat list of cards is not a drill.

**Done (liabilities, 2026-06-01):** `LiabilitiesDrillDown` Section 3 now groups loans by `loanCategory()` (Residential mortgage / BTL / Credit card / Student loan / …), each group a card with its own −£subtotal, debts ordered highest-APR within, every row a `<button>` → leaf (`AssetDetailOverlay`). Verified on Mr T: group subtotals (215k+124k+16k+2k) tie to the £357k liabilities total; back/home at every level. **Gotcha found in verification:** `loanCategory()` had no `residential-mortgage` case → the £215k home loan fell into "Other loan"; added the case (after BTL/commercial, before the fall-through). When grouping by a type-classifier, always check the classifier covers EVERY type present in the data, or the biggest item silently lands in the junk bucket.

---

## AUDIT — run before every "done"
Screenshot the actual viewport. For EVERY tile × EVERY rule above: pass/fail, verified by DOM/screenshot (not by "I changed it"). For each CTA: click it, confirm the destination renders. Per persona a–g. A single fail = not done; fix at source + update this template if a new rule emerged.
