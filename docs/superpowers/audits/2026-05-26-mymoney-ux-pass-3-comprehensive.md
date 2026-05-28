# MyMoney — UX Audit Pass 3 (comprehensive)

**Date:** 2026-05-26
**Persona:** Mr T Core (`?demo=mrt-core&tab=money`)
**Branch:** `mymoney-l3-rebuild` (uncommitted)
**Scope:** Acts 1–6, all sparse tiles, Liabilities pattern, Cashflow inline, missing filter drawer
**Source:** `C:/Users/Powernet/Desktop/finio/src/screens/MyMoney.jsx` (3,800+ lines) + `src/components/MyMoney/*`

Severity: **BLOCK** = blocks ship · **HIGH** = visible regression · **MED** = polish · **LOW** = paper-cut

Live eyebrow ordering from DOM scan: `BALANCE SHEET → NET WORTH → 6 hero metrics → LIQUIDITY TIMELINE → PENSIONS · SAVINGS · PROPERTY → BUSINESS · PROTECTION → ALTERNATIVES · OBLIGATIONS → WHAT YOU OWE → HOW INCOME IS SPENT → TAX & ALLOWANCES → COST OF DOING NOTHING`. Pass 2 only walked through `TAX & ALLOWANCES` — missed the Liabilities pattern problem and never opened the question of whether MONTHLY CASH FLOW belongs here at all.

---

## §1 Sparse tiles — Alternatives, Obligations, Protection

| Sev | Surface | Problem | Proposed fix | File:line |
|---|---|---|---|---|
| **HIGH-1** | `ALTERNATIVES` tile | Renders just `£15k VCT + £8k SEIS` totals with no `contextLine`/`status`/CoI. Compare: Pensions tile shows "315 days until SIPP joins IHT estate", Cash shows "10.6mo cover". Empty desert next to populated tiles = visual asymmetry founder rightly called out. | When persona HAS alternatives: surface (a) chattels exemption status for tangibles (wine/art/gold), (b) CGT exposure on disposal for crypto/PE, (c) illiquidity flag with months to convert, (d) volatility band. The bones exist — `tile.contextLine` is set at L3146 but ONLY for `a.type === 'wine'`. Extend to crypto/gold/PE/EIS-SEIS-VCT. | `MyMoney.jsx:3144-3147` |
| **HIGH-2** | `OBLIGATIONS` tile | Same problem. Persona has family commitments but the tile shows £-value only. CoI line missing despite `coiForDomain(entity, 'obligations')` being called for every tile. | At L3148 only `contextLine` is set, and only if `annual > 0`. Add `status` chip: `{ label: 'X yr horizon · £Yk/yr', tone: 'warn' }`. Add 2nd line: time-to-end for fixed-term obligations (alimony, dependants ageing out). Route tap to Cashflow tab (already wired at L3252) BUT also surface the £/mo impact on surplus — currently you can see the obligation total but not its drag on the £-figure right above it. | `MyMoney.jsx:3148-3151` |
| **HIGH-3** | `PROTECTION` tile | Has `contextLine` + `status` (good) but no premium-load number, no coverage-gap %. Mr T has life cover — tile says "Trust setup needed" but doesn't say "£500k cover · £42/mo · 3.2× income (target 10×)". The COI line would carry the persuasive number. | At L3087-3093 add coverage ratio + monthly premium + gap to target. CoI for under-insurance is computable — `getCoverageGap(entity)` exists per protection drill. Surface here. | `MyMoney.jsx:3087-3093` |
| MED-4 | All 10 tiles | `costOfInaction` line set at L3203 from `coiForDomain` — but several domains return `null` (alternatives, obligations, protection in some persona shapes). Need engine work: every domain needs a CoI heuristic, even if conservative ("not modelled"). | Backfill `coiForDomain` for `alternatives`, `obligations`, `protection`, `cash` (currently silent for Mr T). | `src/engine/canonical-metrics.js` + L3202 |

---

## §2 Liabilities — pattern divergence (the founder's complaint)

| Sev | Surface | Problem | Proposed fix | File:line |
|---|---|---|---|---|
| **BLOCK-1** | `WHAT YOU OWE` Liabilities list | Renders as a plain `<button>` row list — left label/APR/monthly, right balance. NO CategoryTile primitive, NO sparkline, NO COW line, NO status pill. Adjacent assets above use the rich `CategoryTile` grid. Visual rupture mid-page. Founder direction (round 6, L3005) was to REMOVE the Liabilities tile from "What you own" because liabilities aren't assets — but the fix dropped them into a degraded pattern instead of an equivalent-but-distinct-tone pattern. | Build `LiabilityTile` mirroring `CategoryTile` shape: balance hero, debt-cost sparkline (amortising = downward trend already specced in `CAT_MONTHLY_DRIFT.liabilities = -0.0042` at L3177), APR chip as `status`, "saves £Xk if paid 12mo early" as `costOfInaction`. Group into 2-up grid: secured (mortgage, BTL) vs unsecured (credit-card, student-loan). Render as `<LiabilityGrid>` analogous to `<TileGrid>`. | `MyMoney.jsx:3266-3350` + new `src/components/MyMoney/LiabilityTile.jsx` |
| HIGH-5 | Liabilities row tap target | All 4 rows route to the SAME `setActiveDrill('liabilities')`. No drill-by-debt-type. User can't tap "Credit Card £2k" and land on a credit-card-specific section of the drill. | Pass `debtId` into drill; `LiabilitiesDrillDown` scrolls to that section. Same pattern as wrapper-filter on assets side. | `MyMoney.jsx:3320` |
| MED-6 | `SectionDelimiter` "What you owe" eyebrow | Eyebrow on `WHAT YOU OWE` is identical typographic weight to `BALANCE SHEET` above — so the page reads as two side-by-side balance-sheet halves stacked. The asset side is the L1 anchor + 6 metrics + 10 tiles; the liability side is 4 rows. Asymmetric content, symmetric framing — looks unfinished. | Either (a) collapse liabilities under a "Net worth" parent delimiter with sub-eyebrows for assets vs debts, or (b) make the WHAT YOU OWE section visibly heavier with its own composition bar (high-rate red → low-rate amber gradient by APR). | `MyMoney.jsx:3301` |

---

## §3 Cashflow inline (Act 4) — design rupture

| Sev | Surface | Problem | Proposed fix | File:line |
|---|---|---|---|---|
| **HIGH-7** | `<SurplusTile>` | Hero `−£XYZ` (or `+£`) in coral/mint at `--sw-hero-md`, optional banner (Liquid cash covers N months), Sankey diagram, then 4 small drill tiles. This is its own design language — none of which echoes the CategoryTile grid above or the AllowanceTracker bars below. Section reads as a stranded Cashflow-tab preview embedded mid-MyMoney. | Per **HIGH-5 from prior audit (already flagged)**: relocate the full SurplusTile to the Cashflow tab. On MyMoney, replace with a single 1-row "Monthly flow" CategoryTile-style summary: `+£X surplus · saves £Y/yr · tap to open Cashflow`. The CashFlowSankey, runway warning, runway bar — all that belongs on Cashflow tab where it has room to breathe. | `MyMoney.jsx:1179-1259, 3358` |
| MED-8 | `Monthly cash flow` eyebrow vs `HOW YOUR INCOME IS SPENT · £7K/MO` | Two different eyebrow styles within ~80px. SurplusTile uses `sw-eyebrow` class (L1194); the inline `<div>` at L1117 uses inline-styled fontSize 9. They render at different sizes. | Use `sw-eyebrow` for both. Founder direction 2026-05-25 round 5: typographic floor enforced. | `MyMoney.jsx:1117-1122` |
| LOW-9 | Sankey segment labels | At <13% width (L1139) the £ amount inside segment is hidden. On a 480px viewport with 4-segment income split, every segment falls below 13%. Result: bar chart with no inline labels, legend below as the only readable surface. Defeats the point of putting amounts inline. | Drop the threshold to 8% AND add tooltip-on-tap (mobile has no hover). Or label every segment regardless and let small segments truncate with ellipsis. | `MyMoney.jsx:1139-1146` |

---

## §4 Tax & Decisions (Acts 5–6) — sections Pass 2 never opened

| Sev | Surface | Problem | Proposed fix | File:line |
|---|---|---|---|---|
| HIGH-10 | Tax snapshot 3-tile row at L3406 | "What you keep · ISA room left · Pension headroom" rendered as colored insight tiles at 160px min-width. On 480px mobile, grid auto-fits to 1 column → 3 stacked full-width tiles each 22px-hero. Eats 240+ vertical px before user reaches the actual AllowanceTracker bars below. Redundant: pension headroom shown HERE then ANI panel then headroom-explainer in director intel. | Collapse to single horizontal scroll chip row on mobile, or fold the 3 metrics into the AllowanceTracker bars above (already shows ISA room as a bar). | `MyMoney.jsx:3378-3424` |
| HIGH-11 | Director Intelligence section | Renders as 4 separately-styled colored cards stacked vertically, each ~140px tall. 4 items × 140 = 560px of director copy mid-screen for a director persona. Mr T Core is a director — this section is huge. Pattern is yet ANOTHER design language (color-borders, icon-tile, action-link inline). | Pattern-merge with `PriorityCards` (which Act 6 already does for everything else). Director items become rows in the unified Act 6 ranked list, not their own section. | `MyMoney.jsx:3474-3595` |
| MED-12 | Act 6 "Decisions to weigh" / Cost of doing nothing | Last section before footer. Merges PriorityCards + CoI. Confirmed at L3597-3615 doing the right thing — but no visible delimiter between Director Intel (still a section) and Act 6 (also a section). User can't tell where tax ends and decisions begin. | `<SectionDelimiter eyebrow="Decisions to weigh">` is somewhere lower — confirm it's the first child after the director-intel `</>`. If not, insert. | `MyMoney.jsx:3596+` |
| LOW-13 | `BPR clock` body copy | "The 2026 Budget caps BPR at £2.5m with 50% relief above" — figure should come from `rules-uk.js` not be hardcoded. If the cap changes you have to grep this string. | Wrap in `TAX.bprCap` reader. Same pattern as `TAX.pensionAA` already used at L3479. | `MyMoney.jsx:3541` |

---

## §5 Where is the filter drawer?

**Founder's mental model:** a top-of-screen tabbed drawer `[Balance Sheet · Income Statement · Cashflow · Trusts · Insurance]` that opens into pages.

**What actually existed in code:** `<PivotToggle>` component (defined in `src/components/MyMoney/PivotView.jsx`) rendering 4 pills — Balance Sheet (default) / Income / Insurance / Bonds. NOT 5 tabs. Trusts and a separate Cashflow tab were never built — those are spec gaps, not regressions.

**When added:** commit `2990c21` (2026-05-18, "IFA fixes: CoI separation, band label, SIPP countdown, logo consistency, gapDims unified, blank screen fix"). The toggle wrapped `<PivotView>` for all non-balance-sheet pivots.

**When removed:** **uncommitted** working-tree edit on branch `mymoney-l3-rebuild`. The diff shows:
```
- import PivotView, { PivotToggle } from '../components/MyMoney/PivotView.jsx'
+ // PivotToggle removed Wave 0.6 — founder direction: comprehensive scroll, not switcher.
+ // PivotView import kept (still consumable if a future Act surfaces income/insurance/bonds aggregations) but no longer wraps the grid.
+ import PivotView from '../components/MyMoney/PivotView.jsx'
- <PivotToggle pivot={pivot} onPivot={setPivot} />
- <PivotView pivot={pivot} entity={entity} scenarioEntity={...} />
```

**The verdict the founder needs to make:** "Wave 0.6 founder direction: comprehensive scroll, not switcher" is the locked decision that killed the drawer. If the founder is now asking where it went, that direction needs to be reversed explicitly — OR the comprehensive scroll needs to be restructured to give the same affordance (jump-to-section nav, sticky chips at top of viewport that scroll to PENSIONS / LIABILITIES / FLOW / TAX). Right now the page is 2,848+px tall with no in-page navigation. The drawer was the navigation. Removing it without replacement = regression.

`pivot` state and `setPivot('income')` callback still live at L2670 + L3249 — half-removed. The income-tile onView still tries to pivot but the toggle that would show the resulting view is gone, so tapping the income tile does NOTHING visible.

**Recommendation:** restore a sticky in-page section nav (NOT the old 4-pill toggle on top of a hidden-by-default view, since the comprehensive scroll IS the right decision — but a scrollspy jump-nav serves the founder's actual need: "let me get to Liabilities without scrolling 1,600px"). Suggested chips: `Balance · Liabilities · Flow · Tax · Decisions`. Maps cleanly to the existing 6 Acts.
