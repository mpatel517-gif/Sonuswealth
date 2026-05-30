# Temporal Experience — Now / Future / Plan / What-if

**Status:** DESIGNED (awaiting plan)
**Date:** 2026-05-30
**Owner:** founder + Claude
**Tracks:** task #18 (temporal views across all tabs)
**Depends on (already shipped this session):** active-CMA assumption engine (`src/engine/cma.js`), drill-to-leaf taxonomy (`L3PanelHost` + `DrillStack`), shared temporal-mode context (`src/state/temporalMode.jsx`, increment 1a), scenario/event engine (`SCENARIO_SAVED`, `applyEvents`).

**Summary:** A single temporal model — Now / Future / Plan with a per-asset What-if fork — applied consistently across every tab via one reusable `TrajectoryBar` primitive. The product differentiator is the *drift-vs-plan gap*: not a projection chart, but two reconciled lines whose shaded difference is "what your decisions are worth," live-reactive to the user's own assumptions and drillable to its causes.
**Tags:** #temporal #projection #scenario #cma
**Updated:** 2026-05-30

---

## 1. The model (approved)

The shared mode (`temporalMode.jsx`, keys `actual`/`forecast`/`plan`/`scenario`) carries ONE meaning on every tab:

| Mode | Label | Meaning |
|---|---|---|
| `actual`   | **Now**     | Today's actual figures — what you have. |
| `forecast` | **Future**  | **Drift** — assets/income/liabilities projected to the anchor age on autopilot: CMA growth per asset class, inflation, the contributions & drawdowns you *already* make, **zero new decisions**. |
| `plan`     | **Plan**    | **Intent** — the identical projection *with your committed actions applied* (saved scenarios). |
| `scenario` | **What-if** | Not a tab-wide column. A *contextual fork* off a single asset (see §5). It is the verb that moves an asset from Future into Plan. |

**Horizon (approved): persona-anchored + scrub.** Default anchor:
- Accumulators (pre-retirement) → **retirement age** (`entity.retirementAge` ?? state-pension age).
- Retirees / decumulation → **longevity age** (`entity.longevityAge` ?? 95) — frames "will it last?".

A single scrubber lets the user slide the horizon to any age for depth. The headline figure is always "at the moment that matters to you," never an arbitrary +10y.

### The differentiator (approved)
The **gap between Future (drift) and Plan (intent)** is the hero, repeated on every surface. Three properties, each reusing engine work already shipped:
1. **It breathes** — Future/Plan recompute live as the user drags CMA assumptions (`useActiveCMA`). Assumptions are a first-class dial, not a buried setting.
2. **Drill the delta** — tap any gap → decomposes to *why* (which committed action, which tax event, which growth assumption), via the existing `DrillStack`.
3. **Info-only** — the gap describes consequences of the user's *own* committed actions ("your plan adds £142k by 67"), never a recommendation. FCA boundary intact; no advice verbs.

**Honest scope note:** drift-vs-plan twin lines exist in adviser tools (Voyant, Timeline). The defensible novelty is making that surface consumer-grade, drill-everywhere, and live-reactive to the user's own assumptions inside a non-advice frame. We do not claim the twin-line itself is new.

---

## 2. Core primitive — `TrajectoryBar`

One reusable component placed on **every taxonomy node row and every drill leaf** (assets, liabilities, income sources, pensions, trusts — the entire taxonomy, per task #16 parity).

**Contract**
```
<TrajectoryBar
  now={number}          // today's value
  future={number}       // drift value at horizon
  plan={number}         // committed-plan value at horizon
  direction="grow"      // 'grow' (assets/income) | 'shrink' (liabilities)
  activeMode={mode}     // from useTemporalMode — which value is the big number
  horizonLabel="age 67" // for the on-tap exact read
  onExpand={fn}         // opens exact 3-way + drill
/>
```

**Visual (Pattern A — approved):** a single horizontal bar that encodes all three states by length + shade:
- solid segment = **Now**
- faint extension = **Future** drift
- accent tip = the **Plan** boost (the gap)
- big number = whichever lens is active; the other two are small ghosts; exact 3-way on tap.

**Direction-awareness:**
- `grow` (assets, income): bar extends rightward through Now→Future→Plan.
- `shrink` (liabilities): bar retracts; "Plan" overpayment shows as a shorter accent (good = smaller).
- **switch-on/off** (income sources): a node whose Now=0 but Future>0 (state pension, drawdown) or Now>0 but Future=0 (employment ending at retirement) renders as an explicit "starts/stops at age X" bar — honest about income turning on and off.
- **flat** (|future−now| and |plan−now| < threshold): near-flat bar, honest "this barely changes."

**Why a primitive, not per-screen markup:** consistency across the taxonomy (founder requirement), single place to tune the visual, testable in isolation.

---

## 3. Projection engine — computing Now / Future / Plan per node

New pure module `src/engine/projection.js` (Node-importable, testable, no React). The substantive new engine work.

```
projectNode(entity, node, { horizonAge, mode, cma }) -> number
projectTaxonomy(entity, { horizonAge, cma }) -> { byNode, totals: { now, future, plan } }
```

**Future (drift) per node type:**
- **Investable assets** (ISA/GIA/pension/cash/investments): grow at the node's CMA asset-class `expectedReturn` (from `getActiveCMA()`) for `years = horizonAge − currentAge`; add ongoing contributions (monthly × 12 × years, simplified) for accumulators; subtract scheduled drawdowns for decumulation (reuse `drawdownSchedule`).
- **Property**: grow at `cma.assetClasses.property.expectedReturn`.
- **Alternatives**: grow at `cma.assetClasses.alternatives.expectedReturn`.
- **Liabilities**: amortise to the horizon at the recorded rate/term (existing payoff math in the drill components).
- **Income sources**: employment → continues to retirement then 0; state pension/drawdown/annuity → 0 until start age then the engine value; rental/dividends → grow with inflation. Reuse `taxonomy.js` income keys + existing income selectors.

**Plan (intent) per node:** identical to Future, then apply the deltas from **committed scenario events** (`SCENARIO_SAVED` payloads). A committed "sell BTL at 65" zeroes that property node from age 65 and credits proceeds to the chosen destination node; "add £200/mo pension" raises that node's contribution.

**Event-class distinction (important):** the event log carries two kinds of events that must be folded differently for this feature:
- *Corrections* (`ASSET_FIELD_CORRECTED`, `ASSET_VALUE_UPDATED`, document captures) = the user's **real, current data**. These belong in **both** Future and Plan (and Now).
- *Committed plan forks* (`SCENARIO_SAVED`) = **future decisions**. These belong in **Plan only**.

So: **Now/Future read the corrections-applied entity** (real data, no plan forks); **Plan reads corrections + committed forks**. `applyEvents` gains an options flag (e.g. `{ includeScenarios: boolean }`) so the same fold produces the Future base and the Plan base. The gap is then exactly the committed forks' value — provable in the test (§8).

**Reuse, don't duplicate:** portfolio-level sustainability stays in `fundedRatio` / `probabilityOfSuccess` (already CMA-wired). `projection.js` is the *per-node* layer that those don't provide. Where both produce a total, a reconciliation test (§8) asserts they agree at the portfolio level.

**Live-reactivity:** because every value derives from `getActiveCMA()`, dragging an assumption recomputes Future/Plan everywhere the bars subscribe (via `useActiveCMA` + the version signal already in place).

---

## 4. Per-tab application

**MyMoney (balance sheet):**
- Summary + category level: clean 3-column `Now · Future · Plan` mini-table (few rows, fits 375px) with the gap called out ("Your plan adds £142k by age 67").
- Asset-row level: a `TrajectoryBar` per row (Pattern A). The temporal pill sets `activeMode` (which number is big); the bar always shows the 3-way shape.
- A **Compare** affordance opens a roomy full-screen `Now | Future | Plan` table (the columns get their own surface — never cramped into the dense list).
- Each Future/Plan cell drills to "how this grows."

**Cashflow (forward projection):**
- Industry-standard substance: a year-by-year model to the anchor age — income stack (employment → pension → state pension → drawdown) minus inflating expenses, tracking portfolio balance, with the `probabilityOfSuccess` Monte Carlo **probability cone** ("your money lasts to ~92 in the typical case").
- Unique composition: **twin lines** (drift vs plan) with the shaded gap; **live-reactive** to assumption dials; **drill-the-year** (tap a year → decompose income/spend/tax that year); honest **crossover marker** (the age drift runs dry vs where plan holds).

**Home:** the What-if becomes the **aggregate** — a roll-up of every per-asset fork added to Plan ("you've committed 3 changes worth +£142k") + a guided entry that routes the user to the *relevant asset's* What-if rather than presenting a blank canvas. (This fixes the "mis-configured" feeling: Home was trying to be the editor; it should be the dashboard of forks made elsewhere.)

**TaxEstate / Risk / Timeline:** Now/Future/Plan apply where there is a real story:
- TaxEstate: Future = IHT/estate at horizon on drift (already partly modelled via `ihtDynamic` pre/post-2027); Plan = with committed gifting/structuring. Reuse native estate drills.
- Risk: Future = projected resilience as the portfolio matures; Plan = with committed protection/EF changes. (Lighter — may be Future-only initially.)
- Timeline: already temporal; the pill filters committed (Plan) vs projected (Future) events.
- **What-if is NOT forced onto tabs without a story** (founder direction) — it lives where an asset/topic fork is meaningful.

---

## 5. What-if — per-asset fork + Add-to-Plan loop (approved)

Every asset row and its drill leaf gets a **⚡ What if?** chip. Tapping opens a sheet scoped to that asset's *type*, with a curated, answerable menu (not a blank canvas):
- Property/BTL → sell · rates +2% · gift to children · remortgage
- Pension → retire 5y earlier · add £X/mo · take 25% tax-free now
- Cash → move £X to ISA · hold as emergency fund

Each choice runs the **scenario engine** and shows the **ripple** across the whole position (net worth, the drift-vs-plan gap, IHT, cashflow) — drillable, plain English, no advice verb. The curated menus are defined per taxonomy type in a `whatIfMenus` map keyed by `assetTypes`/`liabilityTypes`/`incomeTypes`.

**The loop:** "Add to Plan" commits the fork (`SCENARIO_SAVED`) → it appears in the **Plan** column everywhere and widens the drift-vs-plan gap by its value. So: Now (have) → Future (drift) → ⚡What-if (fork one asset) → Plan (committed forks). What-if is the verb that graduates an asset from Future into Plan.

---

## 6. Guardrails (info / guidance / storage — not advice)

- No advice verbs anywhere ("you should", "we recommend"). Copy describes consequences of the user's *own* inputs/committed actions.
- Every projection labels its assumptions inline (the `AssumptionsChip` already built) and is reachable to the editor.
- Projections are clearly "illustrative, not a forecast"; Monte Carlo results stated as ranges/probabilities, never a single promised number.
- FCA-sensitive taxonomy nodes (per `taxonomy.js` `fcaSensitive`) keep the existing Ask-Sonu boundary banner on any What-if that touches them.

---

## 7. Components & data flow

```
temporalMode.jsx (built) ─ mode ─┐
useActiveCMA (built) ─ assumptions ┤
                                   ├─► projection.js (new, pure) ─► { now, future, plan } per node
event store / SCENARIO_SAVED ──────┘
        │
        ├─► TrajectoryBar (new primitive)  ── on every node row + leaf
        ├─► MyMoney 3-col summary + Compare surface (new)
        ├─► Cashflow twin-line + probability cone (extends existing Cashflow projections)
        ├─► WhatIfSheet (new) ── per-type curated menus ─► scenario engine ─► ripple ─► Add to Plan
        └─► Home aggregate-of-forks card (rework existing What-if)
```

Each unit is independently testable: `projection.js` (node math, pure), `TrajectoryBar` (visual, props-only), `whatIfMenus` (data), `WhatIfSheet` (scenario wiring).

---

## 8. Testing & numeric integrity (CLAUDE.md §9.5)

- `tests/projection.mjs` — per-node Now/Future/Plan finite, monotonic where expected, baseline-preserving (at horizon=now, future===now===plan with no committed events).
- **Reconciliation:** sum of `projectTaxonomy().totals.future` agrees with `fundedRatio`/portfolio projection at the same horizon/assumptions (tie-out, like §9.5 Gate 2).
- **Plan = Future + committed deltas:** with zero `SCENARIO_SAVED` events, Plan === Future exactly. Adding one fork moves Plan by exactly that fork's value.
- Per-increment MCP snap at 3 viewports × 2 themes (Gate 1).

---

## 9. Increment plan (Phase 1 of the schedule)

- **1a — shared temporal context** ✅ done + verified (`temporalMode.jsx`, Home migrated).
- **1b — `projection.js` + `tests/projection.mjs`** (engine first, no UI — the keystone the bars read).
- **1c — `TrajectoryBar` primitive + unit snaps** (visual, isolated).
- **1d — MyMoney**: 3-col summary + bars on rows + Compare surface.
- **1e — Cashflow**: twin-line projection + probability cone + drill-the-year.
- **1f — What-if**: `whatIfMenus` + `WhatIfSheet` + Add-to-Plan loop.
- **1g — Home aggregate-of-forks** rework + migrate remaining tabs (Risk/Timeline/TaxEstate) to read the shared mode.

Phase 2 (task #17, tax module) follows and slots its future-tax projection into this temporal "Future" frame.

---

## 10. Out of scope (YAGNI)

- Multi-scenario A/B/C comparison (one Plan = the set of committed forks; comparing alternative plans is a later feature).
- Editable per-year cashflow cells (read/drill only this phase).
- Goal-probability optimisation ("what's the cheapest plan to hit 90% success") — future.
