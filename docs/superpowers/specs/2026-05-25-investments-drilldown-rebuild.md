# InvestmentsDrillDown rebuild — wireframe

**Purpose**: First production use of the L3Panel + L4 primitives. Establishes the pattern for the other 5 drilldowns once you approve.

**Three principles being satisfied** (your statement):
1. Everything drillable to its lowest source AND back to where it came from
2. Every screen easy to understand, best representation of the data
3. Charts > everything (charts easier to understand)

---

## Layout (top → bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ BACK ← Investments                                  CLOSE ✕ │  OverlayShell
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HERO — chart-first                                          │
│  £1.27m invested        ▲ +£18k MoM (+1.4%)                 │  ← number labels chart
│  ┌──────────────────────────────────────────────────────┐  │
│  │  12-month sparkline of total investments value        │  │  DrillableChart
│  │  (tappable → opens L4ChartPanel with 1M/3M/1Y/5Y      │  │  fires onDrill
│  │   window controls + comparison toggle + annotations)  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  TAX TREATMENT  (fixed, 3-row IT/CGT/IHT)                   │
│  • Income tax — ISA tax-free / GIA at marginal rate         │  per wrapper
│  • CGT — ISA exempt / GIA after £3k AEA                     │
│  • IHT — Outside estate for AIM-BPR / inside for ISA/GIA    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WRAPPER BREAKDOWN  (chart-first)                            │
│  ┌─────────────────┬─────────────────────────────────────┐  │
│  │   DONUT CHART   │  ISA   £420k   33%  ▶ drill         │  │
│  │   (tappable)    │  GIA   £680k   54%  ▶ drill         │  │  each row
│  │   → L4Chart     │  EIS   £80k    6%   ▶ drill         │  │  DrillableNumber
│  │     opens with  │  Bonds £90k    7%   ▶ drill         │  │  → L4NumberPanel
│  │     wrapper     │                                      │  │
│  │     trend over  │  Tap wrapper row → wrapper-specific  │  │
│  │     time        │  drill panel with holdings inside    │  │
│  └─────────────────┴─────────────────────────────────────┘  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ALLOWANCE TRACKER  (chart-first)                            │
│  ISA allowance  £8k / £20k used  ████░░░░  40%              │
│  CGT AEA        £1.2k / £3k used ███░░░░░  40%              │  bar charts
│  EIS/SEIS hold  3y of 5y         ███░░░░░░  (clawback risk) │  tappable rows
│                                                              │
│  (Each bar tap → L4NumberPanel with formula + source)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  HOLDINGS LIST  (chart-augmented)                            │
│  ────────────────────────────────────────────────────────  │
│  Fundsmith Equity      ISA    £180k    ▁▁▂▃▅▆▇  ▶          │  per-row
│  Vanguard FTSE Global  GIA    £220k    ▁▂▃▄▅▆▇  ▶          │  sparkline
│  Royal London ASF      Bond   £45k     ▁▁▂▂▃▃▄  ▶          │  drillable
│  ... (paginated/scrollable)                                 │
│                                                              │
│  Each row tap → AssetDetailOverlay (existing) with           │
│  holding detail + cost basis + unrealised gain               │
├─────────────────────────────────────────────────────────────┤
│  ESTATE POSITION  (fixed bottom-left, 2/3 width)             │
│  IHT exposure on investments: £127k (40% × £318k above NRB) │  cross-tab
│  ▶ See T&E for full estate picture                           │  IHT chip
├─────────────────────────────────────────────────────────────┤
│  DATA CONFIDENCE  (fixed bottom-right, 1/3 width)            │
│  ●●●○ High — 12 holdings · 4 valued today · 8 m/o avg ago    │
├─────────────────────────────────────────────────────────────┤
│  Information only · Derived from your data · Not regulated   │  per-drill footer
│  advice                                                       │  (already added)
└─────────────────────────────────────────────────────────────┘
```

## Round-trip drill mechanics

| User action | Opens | Back returns to |
|---|---|---|
| Tap hero chart | `L4ChartPanel` overlay (full screen) | InvestmentsDrillDown (state preserved via setActiveDrill) |
| Tap hero number `£1.27m` | `L4NumberPanel` overlay | InvestmentsDrillDown |
| Tap donut chart | `L4ChartPanel` with wrapper-split breakdown over time | InvestmentsDrillDown |
| Tap wrapper row (e.g. `ISA £420k`) | `WrapperDrillPanel` (sub-overlay, holdings filtered to ISA) | InvestmentsDrillDown |
| Tap allowance bar (ISA used) | `L4NumberPanel` (formula: `£20k − used = £12k remaining`, source: persona events log) | InvestmentsDrillDown |
| Tap holdings row | `AssetDetailOverlay` (existing component) | InvestmentsDrillDown |
| Tap any chip (e.g. "AIM-BPR exempt") | AskSonu sheet with pre-loaded question | InvestmentsDrillDown |

Every L4 panel has BACK button in the OverlayShell header.
Every L4 number panel has a "see in chart" affordance → swaps to L4ChartPanel for the same metric.

## Charts-first audit

| Old | New |
|---|---|
| Hero: number + tiny sparkline corner | Hero: full-width sparkline with number as label |
| Wrapper breakdown: text rows with chips | Donut chart + text rows side-by-side |
| Allowance tracker: text "8/20" | Progress bar chart |
| Holdings list: text only | Per-row sparkline |
| Tax treatment: 3-row text block | Kept as text (numbers + dates, no chart adds clarity) |

## What does NOT change

- Existing `AssetDetailOverlay` per-holding component (kept — it's the L4 for individual assets)
- Existing `TaxTreatmentBlock` (kept — engine output, already plain-English)
- Existing `DrillContextStub` / `SectorMixStub` (kept, but moved inside relevant sections)
- Per-drill FCA footer (already added)

## What gets removed

- 3 of the existing 5 stat tiles at top (consolidated into hero + allowance tracker)
- Inline chip clutter on each holding row (chips move into the AssetDetailOverlay)

## Build estimate

~1.5–2 hours for the rebuild itself. Same subagent dispatch pattern as previous batches:
1. Read existing InvestmentsDrillDown.jsx (already done)
2. Refactor onto L3Panel primitive (W0-T5)
3. Wire L4NumberPanel + L4ChartPanel into the 5 drill points listed in the round-trip table
4. Verify smoke 53/53 + ripple-contract 103/103 + vite build clean
5. Snap × inspect at 1440×900 + 1920×1080 dark+light

## Templated rollout

If you approve this pattern, the other 5 drilldown panels (Property / Business / Protection / Liabilities / inline Pension in MyMoney.jsx) get rebuilt against the same skeleton:
- Same 7-section structure (Hero chart / Tax treatment / Variable middle / Bottom Estate + Confidence)
- Same round-trip drill mechanics
- Domain-specific middle sections (Property = map + S24 + concentration; Business = BPR cap + concentration; Protection = pillar coverage chart; Liabilities = APR bar chart + LTV; Pension = AA tracker + drawdown projection)

---

## Decision needed

If this structure looks right, say "build it" and I dispatch the InvestmentsDrillDown rebuild subagent. If anything needs to change (section ordering, what gets cut, chart types, drill destinations), tell me before I dispatch.
