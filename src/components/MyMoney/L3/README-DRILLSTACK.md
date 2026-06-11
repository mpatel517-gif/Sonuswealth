# DrillStack — L4 depth wiring guide

**L3-1 (2026-05-28).** Founder pushback: "drilldowns are weak they dont go to another level — they stay at a particular level". This document is the retrofit guide for the 5 remaining drills.

## Status

**ALL DONE (verified 2026-06-11 — every drill imports DrillStackProvider).** This table
was stale for weeks and misled two audit agents into reporting "5 drills TODO";
keep it current when drills change.

| Drill | Status | File |
|---|---|---|
| Pension | ✓ DONE (canonical example) | PensionDrillDown.jsx |
| Investments | ✓ DONE | InvestmentsDrillDown.jsx |
| Property | ✓ DONE | PropertyDrillDown.jsx |
| Cash | ✓ DONE | CashDrillDown.jsx |
| Alternatives | ✓ DONE | AlternativesDrillDown.jsx |
| Liabilities | ✓ DONE | LiabilitiesDrillDown.jsx |
| Protection | ✓ DONE | ProtectionDrillDown.jsx |
| Business | ✓ DONE | BusinessDrillDown.jsx |

## The pattern (copy-paste from PensionDrillDown.jsx)

Each drill follows the same 4-step retrofit:

### 1. Add imports
```jsx
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
```

### 2. Wrap the export in DrillStackProvider
```jsx
export default function MyDrillDown(props) {
  return (
    <DrillStackProvider>
      <MyDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function MyDrillDownInner({ entity, onBack, onHome }) {
  // ...all existing logic moves here
}
```

### 3. Inside the inner component, get the drill stack + build a breakdown payload
```jsx
const drillStack = useDrillStackContext()

const breakdown = [
  { label: 'Account A', value: fmt(amountA) },
  { label: 'Account B', value: fmt(amountB) },
  // … one row per line item that composes the headline number
]
```

### 4. Replace the `subtitle` plain text with a `<DrillableNumber>`
```jsx
<OverlayShell
  title="Domain · drill-down"
  subtitle={
    <DrillableNumber
      metric="Total <domain>"
      value={fmt(total)}
      formula="One-sentence calculation in plain English"
      source="Where the numbers came from"
      confidence="high" | "medium" | "low"
      breakdown={breakdown}
      onDrill={drillStack.pushNumber}
    />
  }
  ...
>
```

That's it. The L4 panel appears as a slide-in overlay when the user taps the headline.

## Drill-points worth adding per domain

Beyond the headline, each drill has additional drillable opportunities. These are the suggested second-level drills per spec:

### Cash
- Total — opens per-account breakdown ✓ (matches pattern)
- Emergency-fund coverage months — drill into formula (essentials/month × months)
- Per-bank balances — could be a chart drill (account growth over time, L4ChartPanel)

### Alternatives
- Total alts — opens per-asset breakdown
- Each asset's projected IHT contribution if BPR ineligible

### Liabilities
- Total liabilities — opens per-debt breakdown
- Each debt's effective interest rate
- Cost-of-debt vs gross-asset-return drill (formula explainer)

### Protection
- Total cover — opens per-policy breakdown
- Cover gap — drill into formula (need vs have)
- In-trust vs estate flags — drill into per-policy detail

### Business
- Total business value — opens per-entity breakdown
- BPR-qualifying value — drill into formula + 2-year clock per entity
- Director comp — drill into salary/dividend split + tax

## L4 panel content

The `L4NumberPanel` renders 6 sections automatically:
1. **Restated big number** — passed via `value` prop
2. **HOW THIS IS CALCULATED** — passed via `formula` prop
3. **WHERE THE DATA CAME FROM** — passed via `source` + `confidence` props
4. **VISUAL BREAKDOWN** — passed via `breakdown` array
5. **WHAT YOU CAN DO** — passed via `actions` array (optional)
6. **WHAT IF THIS WERE DIFFERENT?** — passed via `whatIf` object (optional)

Section 5 (actions) is the L4 → L5 hop. An action can `pushPanel({ kind: 'chart', props: {...} })` to drill into a time-series chart. Section 6 (what-if) is reserved for goal-seek wiring (L3-8).

## Verification

After each retrofit:
1. `npm run build` clean
2. `npm run test:dynamic` still 12/12 PASS (no engine regression)
3. Manual: open the drill, tap the headline, verify L4 panel slides in + Back button works.
