# Per-tile Temporal (Now / Future / Plan) + topic-scoped What-if — design spec

**Date:** 2026-06-01
**Status:** DOCUMENTED (awaiting founder sign-off on the 2 forks in §6)
**Cluster:** 2-Product / MyMoney
**Owner:** founder + Claude (product-architect)

**Summary:** Every balance-sheet tile carries its OWN Now→Future→Plan trajectory (Pattern A bar) instead of the values being driven only by a global tab that today does nothing to the tiles. The global What-if tab is removed — a separate global What-if surface is being built — and each tile gets a small, topic-scoped What-if instead.
**Tags:** #mymoney #temporal #blueprint
**Updated:** 2026-06-01

---

## 1. Why

Two confirmed problems:

- **The global Future/Plan/What-if tabs don't change the tiles.** Switching to Future flips a label but NW/category values stay at today's numbers (verified persona-a, even at a 10-year horizon). The tiles read today's `subtotals`; `projection`/`viewMode` only feed the trend-boxes. So Future/Plan/What-if feel empty.
- **Founder direction (2026-06-01):** "we discussed having this for future, plan and whatif on all the tiles … maybe we don't need the whatif drawer at the top anymore — we're constructing a separate global whatif. The smaller what-if on the tile should represent that topic only."

So: move the temporal representation ONTO each tile (Pattern A, previously recommended), and stop double-owning What-if at the top.

## 2. The primitive — TrajectoryBar (Pattern A)

One horizontal bar per tile, replacing/augmenting the current 12-month sparkline:

- **Solid segment** = Now (today's value).
- **Faint extension** = Future drift (grown on autopilot to the horizon, no new decisions).
- **Accent tip** = Plan boost (Future + committed scenario deltas for THIS category).
- **The big number** on the tile = whichever lens is active (see §4). The drift and plan-gap read as *visible lengths*, not three competing figures.
- **On tap** = exact 3-way readout: `Now £X · Future £Y · Plan £Z` (e.g. pension `£420k · £612k · £680k`).

Zero number-clutter at rest; instant read of "how much does growth add, how much does my plan add." Degrades: if future==now (current-period horizon) the bar is just the solid Now segment — honest, not fake.

## 3. Data (engine — no new math invented)

`projection.js` already has `projectTaxonomy(entity, { horizonAge, planEntity })` → `{ byNode, totals: { now, future, plan } }` and per-node `projectNode`. Per-category Now/Future/Plan:

- **Now** = today's category subtotal (existing).
- **Future** = sum of that category's nodes projected to the horizon at CMA rates.
- **Plan** = Future re-run on `planEntity` (base ⊕ committed `SCENARIO_SAVED` deltas) filtered to that category.

Horizon source = the existing tax-year/horizon selector (5y/10y/20y/Lifetime). Current-period ⇒ Future==Now.

## 4. Interaction model (the change)

- **Keep Today / Future / Plan as a GLOBAL LENS.** It sets which value is the "big number" on every tile's trajectory bar (Pattern A: "big number = whichever lens is active"). This reconciles "per-tile representation" with one coherent global control — you don't lose the at-a-glance NW-at-horizon.

### Three tiers of What-if (founder clarified 2026-06-01)

What-if is NOT removed — it exists at three nested scopes, each narrower than the last:

1. **Global What-if** — lives on the **Home** screen. Whole-portfolio scenarios across every tab.
2. **Tab What-if** — the tab's own "What if" tab (e.g. MyMoney's). Scoped to **that tab's topics only** (MyMoney = balance-sheet categories), NOT global. *Action: rescope the existing MyMoney What-if tab so its scenario library is filtered to MyMoney topics.*
3. **Per-item What-if** — a small **"What if ⚡" next to "View detail"** on each tile. Scoped to **that one item/topic** (the pension tile's what-if is about pensions only). Inline mini-what-if (Fork B), bound to the shared scenario engine. *First step shipped: the button + a topic-seeded Ask-Sonu what-if entry; the full inline drag-in-place mini is the next increment.*

## 5. Increments (each ships + snaps)

1. `TrajectoryBar` primitive (pure SVG) + node tests for the 3-segment geometry.
2. Per-category `{now, future, plan}` selector reusing `projectTaxonomy`; unit-tested against a persona.
3. Wire into `CategoryTile` (replace `trendSeries` sparkline with TrajectoryBar; big number follows the global lens).
4. Remove the global What-if tab; verify the separate global What-if entry still reachable.
5. Per-tile What-if affordance (per Fork B).
6. Snap matrix 3×2 across personas a/c/f; numeric tie-out (sum of tile Futures == NW Future).

## 6. Forks — DECIDED (founder, 2026-06-01)

- **Fork A — Future/Plan: global lens or fully per-tile?** → **GLOBAL LENS drives tiles.** Keep Today/Future/Plan at the top; it sets the big number on every tile's trajectory bar. What-if leaves the top.
- **Fork B — what does the per-tile What-if open?** → **INLINE mini-what-if on the tile** (topic-scoped). Mitigation for the divergence risk: the inline what-if MUST bind to the same `projection.js` + scenario-delta engine as the global What-if surface — a lighter UI over shared math, never a second scenario engine.

## 7. Out of scope

The separate global What-if surface itself (being built elsewhere). This spec only removes the redundant top tab and defines the tile-level entry into it.
