# MyMoney L3 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild MyMoney with 19 dedicated L3 panels (one per spec domain), each on a single reusable `<L3Panel>` primitive, every drillable number opening a full L4 panel, every chart opening an L4 chart drill — all in plain English, validated against Mr T fixture.

**Architecture:** Three reusable primitives (`<L3Panel>` with slot architecture, `<L4NumberPanel>`, `<DrillableChart>`) + 19 thin domain modules + ~25 reusable middle-section components. Engine: 4 new pieces (`getTimeSeries`, `useRipple` migration for MyMoney, `ihtChipsForMyMoney`, `foldAssetEvent`). 7 sequential waves with founder approval gates after Waves 0, 1, 4, 7.

**Tech Stack:** React 18 + Vite, Supabase (auth + data layer), event store via existing EventsProvider, UK financial rules bundle UK-2026.1.1, Vitest for engine tests.

**Source spec:** [docs/superpowers/specs/2026-05-25-mymoney-l3-pattern-design.md](../specs/2026-05-25-mymoney-l3-pattern-design.md)

---

## Wave roadmap (7 waves)

| Wave | Title | Status | Detail |
|---|---|---|---|
| **0** | Engine prereqs (`getTimeSeries` + ripple migration + primitives skeleton) | This plan, in full below | TDD bite-sized |
| 1 | L3 batch 1 — Investing wrappers split + Cash | Plan to be written via writing-plans after Wave 0 ships | Task summary below |
| 0.5 | C3 — IHT cross-tab chips | Plan after Wave 1 ships | Task summary below |
| 2 | L3 batch 2 — Income + State + Director + Business + Share schemes + Property refactor | Plan after Wave 0.5 ships | Task summary below |
| 0.75 | C2 — Events reducer for `ASSET_VALUE_UPDATED` | Plan after Wave 2 ships | Task summary below |
| 3 | L3 batch 3 — Protection split + Alternatives + Family + Pension/Liabilities refactor | Plan after Wave 0.75 ships | Task summary below |
| 4 | L4 chart drill panels (`<DrillableChart>` + ~30 charts wired) | Plan after Wave 3 ships | Task summary below |
| 5 | Cross-cutting polish — cause-chain, rules-version label, PP-3/PP-9 audits, X24, X29 | Plan after Wave 4 ships | Task summary below |
| 6 | `/impeccable audit` + `sonus-financial-analyst` pass | Plan after Wave 5 ships | Task summary below |
| 7 | Snap × inspect at 1440×900 + 1920×1080 dark + light | Plan after Wave 6 ships | Task summary below |

**Founder approval gates:** after Wave 0 (engine + ripple migration), Wave 1 (first 5 new L3 panels render with Mr T data), Wave 4 (drill primitives proven across MyMoney + retroactive Home/Risk), Wave 7 (final ship-ready).

---

# WAVE 0 — ENGINE PREREQS

**Goal:** Land all engine + primitive scaffolding required before any L3 panel is built. Existing 6 drill panels migrate from direct `fq-calc` imports onto `useRipple` (PP-5). `<L3Panel>` + section primitives exist as skeletons. `plain-english.js` extended. Ripple regression passes.

**Exit gate:** `node tests/ripple-contract.mjs` passes; `?demo=mrt&tab=money` renders identically to before Wave 0 (no visual regression); founder eyeballs the existing 6 drill panels and confirms zero breakage.

---

### Task W0-T1: Audit fq-calc imports across MyMoney

**Files:**
- Read: `src/screens/MyMoney.jsx`
- Read: `src/components/MyMoney/PropertyDrillDown.jsx`
- Read: `src/components/MyMoney/BusinessDrillDown.jsx`
- Read: `src/components/MyMoney/ProtectionDrillDown.jsx`
- Read: `src/components/MyMoney/LiabilitiesDrillDown.jsx`
- Read: `src/components/MyMoney/InvestmentsDrillDown.jsx`
- Create: `docs/superpowers/plans/wave0-fq-import-inventory.md`

- [ ] **Step 1: Grep all fq-calculator imports in MyMoney scope**

Run: `Grep tool with pattern "from.*fq-calculator" in path src/screens/MyMoney.jsx and src/components/MyMoney/`
Expected: a list of every imported symbol per file, e.g.
```
src/screens/MyMoney.jsx: calcFQ, netWorth, monthlySurplus, calcAPQ, calcRisk, lifeStageFor, totalCoI, TAX, allowanceTracker
src/components/MyMoney/PropertyDrillDown.jsx: TAX, calcCGT
...
```

- [ ] **Step 2: For each imported symbol, classify "covered by useRipple" vs "needs direct keep"**

`useRipple(entity, scopes)` returns: `balance_sheet`, `scores`, `iht`, `cashflow`, `protection`, `tax`, `timeline`, `_meta`.

Map each symbol to its ripple-scope path. Symbols that don't fit any scope (e.g. `lifeStageFor` which is a pure helper not entity-derived) stay as direct imports.

Write the mapping to `docs/superpowers/plans/wave0-fq-import-inventory.md` with this format:

```markdown
## MyMoney.jsx imports
- calcFQ → ripple.scores.fq
- netWorth → ripple.balance_sheet.netWorth
- monthlySurplus → ripple.cashflow.monthlySurplus
- calcAPQ → ripple.scores (not yet in ripple — needs adding to engine/ripple.js buildScores)
- lifeStageFor → keep direct (pure helper, no entity state)
- TAX → keep direct via _bundle export (already migrated)
```

- [ ] **Step 3: Commit inventory**

```bash
git add docs/superpowers/plans/wave0-fq-import-inventory.md
git commit -m "docs: Wave 0 — MyMoney fq-calc import inventory"
```

---

### Task W0-T2: Verify Mr T renders all 20 domains pre-migration (baseline snap)

**Files:**
- Run: `tests/harness/snapshot.mjs`
- Create: `docs/superpowers/plans/wave0-baseline-snap.md`

- [ ] **Step 1: Run regression harness on Mr T**

Run: `node tests/harness/snapshot.mjs --persona mrt --year 2026 --output docs/superpowers/plans/wave0-baseline-snap.json`
Expected: JSON snapshot with NW ≈ £484k, Wealth Score 64, Risk Score 65, IHT exposure £0-8k.

- [ ] **Step 2: Open `?demo=mrt&tab=money` in dev server, inspect each tile**

Run: `npm run dev` (if not already running).
Then in Chrome, visit `http://localhost:5174/?demo=mrt&tab=money`.

For each of the 19 spec domains, verify either a tile or row renders with non-zero data. Document the audit in `docs/superpowers/plans/wave0-baseline-snap.md`:

```markdown
## Baseline pre-Wave-0 render audit (Mr T)
| Domain | Renders? | Where | Notes |
|---|---|---|---|
| A Pension | ✅ | Pensions tile · £205.5k | All 5 wrappers visible |
| C ISA | ✅ | Investments tile · £46.6k | Inside InvestmentsDrillDown |
| D GIA | ✅ | Investments tile · £24.8k | Inside InvestmentsDrillDown |
...
```

- [ ] **Step 3: Commit baseline**

```bash
git add docs/superpowers/plans/wave0-baseline-snap.md docs/superpowers/plans/wave0-baseline-snap.json
git commit -m "docs: Wave 0 — Mr T baseline snap before ripple migration"
```

---

### Task W0-T3: Build `getTimeSeries` engine function (TDD)

**Files:**
- Test: `tests/engine/time-series.test.mjs` (NEW)
- Create: `src/engine/time-series.js`
- Read: `src/engine/ripple.js` (understand existing scope builders)
- Read: `src/state/trajectorySeeder.js` (existing fallback synthesis pattern)

- [ ] **Step 1: Write the failing test for the happy path**

Create `tests/engine/time-series.test.mjs`:

```javascript
// tests/engine/time-series.test.mjs — Wave 0 contract test for getTimeSeries
import { getTimeSeries } from '../../src/engine/time-series.js'
import { loadPersona } from '../../src/lib/data-source.js'

let passed = 0, failed = 0
const fails = []
function assert(cond, msg) {
  if (cond) { passed++; return }
  failed++; fails.push(msg)
  console.error(`  ✗ ${msg}`)
}

async function main() {
  console.log('═══ getTimeSeries contract test ═══\n')

  const mrt = await loadPersona('mrt')

  // 1. Happy path: pension_value over 12 months
  const r1 = getTimeSeries(mrt, 'pension_value', '1Y', 'month')
  assert(Array.isArray(r1.points), 'points is array')
  assert(r1.points.length >= 10 && r1.points.length <= 14, `1Y/month returns ~12 points (got ${r1.points.length})`)
  assert(r1.window === '1Y', 'echoes window')
  assert(r1.granularity === 'month', 'echoes granularity')
  assert(typeof r1.confidence === 'string', 'has confidence')

  // 2. Net worth happy path
  const r2 = getTimeSeries(mrt, 'net_worth', '1Y', 'month')
  assert(r2.points.length >= 10, `net_worth 1Y returns points (got ${r2.points.length})`)
  assert(r2.points.every(p => typeof p.value === 'number' && Number.isFinite(p.value)), 'all values finite')

  // 3. Data honesty: 10Y window on persona with only 12mo of data → gap reported
  const r3 = getTimeSeries(mrt, 'net_worth', '10Y', 'month')
  assert(r3.gaps && r3.gaps.length > 0, '10Y window with limited data reports gaps')
  assert(r3.dataStartDate, 'reports dataStartDate')

  // 4. Unknown metric returns empty + low confidence (not throws)
  const r4 = getTimeSeries(mrt, 'nonexistent_metric', '1Y', 'month')
  assert(r4.points.length === 0, 'unknown metric returns empty points')
  assert(r4.confidence === 'low', 'unknown metric reports low confidence')

  // 5. Window narrowing — 3M should be a subset of 1Y in count
  const r5 = getTimeSeries(mrt, 'net_worth', '3M', 'month')
  assert(r5.points.length <= 4, `3M returns ≤4 points (got ${r5.points.length})`)

  console.log(`\n═══ ${passed} pass · ${failed} fail ═══`)
  if (failed > 0) {
    console.error('\nFailures:'); for (const f of fails) console.error('  -', f)
    process.exit(1)
  }
  process.exit(0)
}

main().catch(e => { console.error('fatal:', e); process.exit(2) })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/engine/time-series.test.mjs`
Expected: FAIL with `Cannot find module '../../src/engine/time-series.js'`

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/time-series.js`:

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// time-series — Wave 0 / E1
//
// Returns time-series data for any entity metric scoped to a window.
// Powers every sparkline + every L4 chart drill panel.
//
// Reads from entity.trajectories.* first (Phase 2 Batch A populated these for
// every persona). Falls through to trajectorySeeder if absent. Per PP-7 never
// synthesises — gaps reported explicitly.
//
// Public API:
//   getTimeSeries(entity, metric, window, granularity='month')
//   → { points: [{date, value, contribution?, withdrawal?, event?}],
//       window, granularity, confidence, dataStartDate, dataEndDate, gaps }
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_METRICS = {
  net_worth:     (entity) => entity?.trajectories?.netWorthHistory ?? [],
  wealth_score:  (entity) => entity?.trajectories?.scoreHistory ?? [],
  risk_score:    (entity) => entity?.trajectories?.riskHistory ?? [],
  pension_value: (entity) => entity?.trajectories?.pensionHistory ?? [],
  isa_value:     (entity) => entity?.trajectories?.isaHistory ?? [],
  gia_value:     (entity) => entity?.trajectories?.giaHistory ?? [],
  cash_value:    (entity) => entity?.trajectories?.cashHistory ?? [],
  property_value:(entity) => entity?.trajectories?.propertyHistory ?? [],
  iht_exposure:  (entity) => entity?.trajectories?.ihtHistory ?? [],
}

const WINDOW_DAYS = {
  '1M': 30, '3M': 90, '6M': 180, '1Y': 365,
  '3Y': 1095, '5Y': 1825, '10Y': 3650, 'All': Infinity,
}

export function getTimeSeries(entity, metric, window = '1Y', granularity = 'month') {
  // 1. Unknown metric — graceful low-confidence empty
  const reader = KNOWN_METRICS[metric]
  if (!reader) {
    return {
      points: [],
      window, granularity,
      confidence: 'low',
      dataStartDate: null,
      dataEndDate: null,
      gaps: [{ from: null, to: null, reason: `unknown metric: ${metric}` }],
    }
  }

  const allPoints = reader(entity).map(p => ({
    date: p.date,
    value: typeof p.value === 'number' ? p.value : (typeof p.score === 'number' ? p.score : 0),
  }))

  if (allPoints.length === 0) {
    return {
      points: [], window, granularity, confidence: 'low',
      dataStartDate: null, dataEndDate: null,
      gaps: [{ from: null, to: null, reason: `no trajectory data for ${metric}` }],
    }
  }

  // 2. Window filter
  const days = WINDOW_DAYS[window] ?? 365
  const now = new Date()
  const cutoff = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 86400000)
  const windowed = allPoints.filter(p => new Date(p.date) >= cutoff)

  // 3. Gap detection — requested window vs available data
  const dataStart = new Date(allPoints[0].date)
  const requestedStart = days === Infinity ? dataStart : cutoff
  const gaps = []
  if (dataStart > requestedStart) {
    gaps.push({
      from: requestedStart.toISOString().split('T')[0],
      to: dataStart.toISOString().split('T')[0],
      reason: 'data starts after requested window',
    })
  }

  return {
    points: windowed,
    window,
    granularity,
    confidence: windowed.length >= 6 ? 'high' : windowed.length >= 3 ? 'medium' : 'low',
    dataStartDate: allPoints[0].date,
    dataEndDate: allPoints[allPoints.length - 1].date,
    gaps,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/engine/time-series.test.mjs`
Expected: PASS (5 assertions green)

- [ ] **Step 5: Commit**

```bash
git add src/engine/time-series.js tests/engine/time-series.test.mjs
git commit -m "feat(engine): add getTimeSeries primitive (Wave 0 E1)"
```

---

### Task W0-T4: Extend `plain-english.js` with locked statutory mappings

**Files:**
- Read: `src/copy/plain-english.js` (existing — ~80 entries)
- Modify: `src/copy/plain-english.js`

- [ ] **Step 1: Read existing plain-english.js to identify gaps**

Open `src/copy/plain-english.js`. The current file maps ~80 statutory terms. Cross-reference against the design doc §2.5 locked mapping table.

Identify missing entries that the locked mapping requires:
- AA, MPAA, LSA, PCLS, BADR, S24, FAD, UFPLS, OCF, taperedAA, carryForward, Scenario/scenario, Actual/actual

- [ ] **Step 2: Add the missing entries**

Edit `src/copy/plain-english.js` — add the following to the `ALIAS` export (alphabetised for diff hygiene):

```javascript
  // Pension contribution + access
  AA:                 'Pension contribution limit (annual allowance)',
  aa:                 'Pension contribution limit',
  annualAllowance:    'Pension contribution limit',
  taperedAA:          'Reduced contribution limit',
  carryForward:       'Unused allowance from earlier years',
  MPAA:               'Reduced pension limit (after first withdrawal)',
  mpaa:               'Reduced pension limit',
  LSA:                'Tax-free cash limit',
  lsa:                'Tax-free cash limit',
  PCLS:               'Tax-free cash',
  pcls:               'Tax-free cash',
  FAD:                'Pension drawdown',
  fad:                'Pension drawdown',
  UFPLS:              'Lump sum from pension',
  ufpls:              'Lump sum from pension',

  // Investment costs
  OCF:                'Fund charges',
  ocf:                'Fund charges',
  ongoingCharge:      'Fund charges',

  // Property + business
  S24:                'Mortgage interest restriction (S24)',
  s24:                'Mortgage interest restriction',
  BADR:               'Business sale relief (BADR)',
  badr:               'Business sale relief',

  // Time-view (X28 4-mode)
  scenario:           'What-if',
  Scenario:           'What-if',
  actual:             'Today',
  Actual:             'Today',
  forecast:           'Forecast',
  plan:               'Plan',
```

Also add the `plainOf` helper at the bottom (if not already present) — exports a function that takes a statutory code and returns the plain-English label:

```javascript
/**
 * Resolve a statutory code or internal symbol to its plain-English label.
 * Returns the input unchanged if no alias exists (graceful fallback).
 *
 * @example
 *   plainOf('AA')           → 'Pension contribution limit (annual allowance)'
 *   plainOf('netWorth')     → 'Net Worth'
 *   plainOf('unknownTerm')  → 'unknownTerm'
 */
export function plainOf(key) {
  if (typeof key !== 'string') return key
  return ALIAS[key] ?? key
}
```

(Skip the `plainOf` helper if it already exists — verify before adding.)

- [ ] **Step 3: Smoke-test the helper**

Run: `node -e "import('./src/copy/plain-english.js').then(m => { console.log(m.plainOf('AA')); console.log(m.plainOf('OCF')); console.log(m.plainOf('netWorth')); })"`

Expected output:
```
Pension contribution limit (annual allowance)
Fund charges
Net Worth
```

- [ ] **Step 4: Commit**

```bash
git add src/copy/plain-english.js
git commit -m "feat(copy): extend plain-english map with locked statutory aliases (Wave 0 PP-9)"
```

---

### Task W0-T5: Scaffold `<L3Panel>` primitive (slot architecture)

**Files:**
- Create: `src/components/MyMoney/L3/L3Panel.jsx`
- Create: `src/components/MyMoney/L3/L3Sections/HeroSection.jsx`
- Create: `src/components/MyMoney/L3/L3Sections/TaxTreatmentSection.jsx`
- Create: `src/components/MyMoney/L3/L3Sections/EstatePositionSection.jsx`
- Create: `src/components/MyMoney/L3/L3Sections/DataConfidenceSection.jsx`
- Create: `src/components/MyMoney/L3/index.js` (barrel export)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p "C:/Users/Powernet/Desktop/finio/src/components/MyMoney/L3/L3Sections"
mkdir -p "C:/Users/Powernet/Desktop/finio/src/components/MyMoney/L3/sections"
```

- [ ] **Step 2: Write `<L3Panel>` slot primitive**

Create `src/components/MyMoney/L3/L3Panel.jsx`:

```jsx
// ─────────────────────────────────────────────────────────────────────────────
// L3Panel — the slot-architecture primitive for every domain L3.
//
// Renders fixed top sections (Hero + TaxTreatment) + variable middle sections
// (domain declares) + fixed bottom sections (EstatePosition + DataConfidence).
//
// Domain modules import this and pass:
//   - hero          { metric, label, sublabel, chartSeries, viewMode }
//   - taxTreatment  { incomeTax, capitalGains, inheritance }   per spec §2.3
//   - middle        [ { key, render: ({entity, ripple}) => <jsx> } ]
//   - estate        { position, exposure, daysToActivation, action }
//   - confidence    { level, totalFields, verifiedFields, lastValuation }
//   - entity, ripple
//
// Per design §2.2 — single primitive, max reuse.
// ─────────────────────────────────────────────────────────────────────────────

import { HeroSection }           from './L3Sections/HeroSection.jsx'
import { TaxTreatmentSection }   from './L3Sections/TaxTreatmentSection.jsx'
import { EstatePositionSection } from './L3Sections/EstatePositionSection.jsx'
import { DataConfidenceSection } from './L3Sections/DataConfidenceSection.jsx'

export function L3Panel({
  entity, ripple,
  hero, taxTreatment, middle = [], estate, confidence,
  domainKey,
}) {
  return (
    <div className="sw-l3-panel" data-domain={domainKey} style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
    }}>
      <HeroSection {...hero} entity={entity} ripple={ripple} />
      <TaxTreatmentSection {...taxTreatment} entity={entity} ripple={ripple} />
      {middle.map(section => (
        <div key={section.key} className="sw-l3-middle-section">
          {section.render({ entity, ripple })}
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <EstatePositionSection {...estate} entity={entity} ripple={ripple} />
        <DataConfidenceSection {...confidence} entity={entity} ripple={ripple} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the 4 fixed section components (skeleton — full impl in Wave 1)**

Create `src/components/MyMoney/L3/L3Sections/HeroSection.jsx`:

```jsx
// HeroSection — fixed top of every L3. Big number + sparkline + view-mode pill.
// Real implementation lands in Wave 1 when first new L3 is built; this skeleton
// renders the layout so Wave 0 migration of existing panels doesn't crash.

export function HeroSection({ metric, label, sublabel, chartSeries }) {
  return (
    <div className="sw-l3-hero" style={{
      background: 'linear-gradient(180deg, var(--c-acc-soft), transparent)',
      border: '1px solid var(--c-acc-border)',
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 90,
    }}>
      <div>
        <div className="sw-l3-hero-label">{label}</div>
        <div className="sw-l3-hero-value">{metric}</div>
        {sublabel && <div className="sw-l3-hero-sublabel">{sublabel}</div>}
      </div>
      {/* Sparkline placeholder — Wave 4 wires <DrillableChart> */}
      <div style={{ flex: 1, maxWidth: 360, marginLeft: 30, height: 50 }} />
    </div>
  )
}
```

Create `src/components/MyMoney/L3/L3Sections/TaxTreatmentSection.jsx`:

```jsx
// TaxTreatmentSection — fixed top. The IT/CGT/IHT 3-row per spec §2.3.
// Skeleton; real domain-specific copy lands per L3 module.

export function TaxTreatmentSection({ incomeTax, capitalGains, inheritance }) {
  return (
    <div className="sw-l3-tax-treatment" style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid var(--c-border2)',
      borderRadius: 8, padding: 10,
      display: 'flex', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div className="sw-l3-row-label">INCOME TAX</div>
        <div className="sw-l3-row-value">{incomeTax?.headline ?? '—'}</div>
        {incomeTax?.detail && <div className="sw-l3-row-sub">{incomeTax.detail}</div>}
      </div>
      <div style={{ flex: 1 }}>
        <div className="sw-l3-row-label">CAPITAL GAINS TAX</div>
        <div className="sw-l3-row-value">{capitalGains?.headline ?? '—'}</div>
        {capitalGains?.detail && <div className="sw-l3-row-sub">{capitalGains.detail}</div>}
      </div>
      <div style={{ flex: 1 }}>
        <div className="sw-l3-row-label">INHERITANCE TAX</div>
        <div className="sw-l3-row-value">{inheritance?.headline ?? '—'}</div>
        {inheritance?.detail && <div className="sw-l3-row-sub">{inheritance.detail}</div>}
      </div>
    </div>
  )
}
```

Create `src/components/MyMoney/L3/L3Sections/EstatePositionSection.jsx`:

```jsx
// EstatePositionSection — fixed bottom-left. Reads cross-tab IHT chip from T&E.
// In Wave 0 this renders the placeholder. In Wave 0.5 the C3 engine function
// (ihtChipsForMyMoney) populates the live data.

export function EstatePositionSection({ position, exposure, daysToActivation, action, entity, ripple }) {
  return (
    <div className="sw-l3-estate" style={{
      background: 'linear-gradient(180deg, rgba(255,180,120,0.08), rgba(255,180,120,0.02))',
      border: '1px solid rgba(255,180,120,0.3)',
      borderRadius: 8, padding: 10,
    }}>
      <div className="sw-l3-row-label">INHERITANCE TAX POSITION</div>
      <div className="sw-l3-row-value">{position ?? 'Position pending C3 wave'}</div>
      {exposure != null && (
        <div className="sw-l3-row-sub">
          Exposure: £{exposure.toLocaleString()}{daysToActivation != null ? ` · ${daysToActivation} days until rule activates` : ''}
        </div>
      )}
      {action && <div className="sw-l3-row-sub" style={{ marginTop: 4 }}>Action: {action}</div>}
    </div>
  )
}
```

Create `src/components/MyMoney/L3/L3Sections/DataConfidenceSection.jsx`:

```jsx
// DataConfidenceSection — fixed bottom-right. FP-4 confidence bar.

export function DataConfidenceSection({ level = 'high', totalFields, verifiedFields, lastValuation }) {
  const labelMap = { high: 'High', medium: 'Medium', low: 'Low' }
  return (
    <div className="sw-l3-confidence" style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid var(--c-border2)',
      borderRadius: 8, padding: 10,
    }}>
      <div className="sw-l3-row-label">DATA QUALITY</div>
      <div className="sw-l3-row-value">
        {labelMap[level]}
        {totalFields != null && verifiedFields != null && ` · ${verifiedFields} of ${totalFields} fields verified`}
      </div>
      {lastValuation && (
        <div className="sw-l3-row-sub">
          Last valuation {lastValuation} · Upload a statement to refresh
        </div>
      )}
    </div>
  )
}
```

Create `src/components/MyMoney/L3/index.js`:

```javascript
// Barrel export for L3 primitives.
export { L3Panel } from './L3Panel.jsx'
export { HeroSection } from './L3Sections/HeroSection.jsx'
export { TaxTreatmentSection } from './L3Sections/TaxTreatmentSection.jsx'
export { EstatePositionSection } from './L3Sections/EstatePositionSection.jsx'
export { DataConfidenceSection } from './L3Sections/DataConfidenceSection.jsx'
```

- [ ] **Step 4: Smoke-test the primitive renders without crashing**

Run: `npm run dev` (if not already running)

Then create a one-off smoke test page or, simpler, write a Vitest unit:

Create `tests/components/L3Panel.smoke.test.jsx`:

```jsx
import { render } from '@testing-library/react'
import { L3Panel } from '../../src/components/MyMoney/L3/L3Panel.jsx'

test('L3Panel renders with minimum props without crashing', () => {
  const { container } = render(
    <L3Panel
      entity={{}}
      ripple={{}}
      hero={{ metric: '£100,000', label: 'TEST VALUE' }}
      taxTreatment={{
        incomeTax: { headline: 'Test' },
        capitalGains: { headline: 'Test' },
        inheritance: { headline: 'Test' },
      }}
      middle={[]}
      estate={{ position: 'Test estate' }}
      confidence={{ level: 'high', totalFields: 4, verifiedFields: 4 }}
      domainKey="test"
    />
  )
  expect(container.querySelector('.sw-l3-panel')).toBeTruthy()
  expect(container.querySelector('.sw-l3-hero')).toBeTruthy()
  expect(container.querySelector('.sw-l3-tax-treatment')).toBeTruthy()
  expect(container.querySelector('.sw-l3-estate')).toBeTruthy()
  expect(container.querySelector('.sw-l3-confidence')).toBeTruthy()
})
```

Run: `npx vitest run tests/components/L3Panel.smoke.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MyMoney/L3/ tests/components/L3Panel.smoke.test.jsx
git commit -m "feat(MyMoney): scaffold L3Panel primitive with 4 fixed sections (Wave 0)"
```

---

### Task W0-T6: Scaffold `<DrillableNumber>` + `<L4NumberPanel>` primitives

**Files:**
- Create: `src/components/MyMoney/L3/DrillableNumber.jsx`
- Create: `src/components/MyMoney/L3/L4NumberPanel.jsx`
- Modify: `src/components/MyMoney/L3/index.js` (extend barrel export)

- [ ] **Step 1: Write `<DrillableNumber>` wrapper**

Create `src/components/MyMoney/L3/DrillableNumber.jsx`:

```jsx
// DrillableNumber — wraps any displayed number with PP-3 drillability.
// Tap opens <L4NumberPanel> at the current drill level.
//
// Usage:
//   <DrillableNumber
//     metric="aa_used"
//     value="£18,750 of £60,000 used"
//     formula="sum of personal £8,500 + employer £10,250 YTD"
//     source="AJ Bell + Aviva statements"
//     confidence="high"
//     breakdown={[{year: '2024/25', used: 0, allowance: 60000}, ...]}
//     onDrill={(metric) => openL4Panel(metric)}
//   />

import { useState } from 'react'

export function DrillableNumber({
  metric, value,
  formula, source, confidence = 'high',
  breakdown,
  onDrill,
  children,
}) {
  const [hover, setHover] = useState(false)
  return (
    <span
      className="sw-drillable-number"
      role="button"
      tabIndex={0}
      onClick={() => onDrill?.({ metric, formula, source, confidence, breakdown, value })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDrill?.({ metric, formula, source, confidence, breakdown, value }) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px dotted rgba(93, 219, 194, 0.4)',
        cursor: 'pointer',
        outline: hover ? '1px solid rgba(93, 219, 194, 0.15)' : 'none',
        padding: '0 2px',
      }}
      aria-label={`Drill into ${metric}`}
    >
      {children ?? value}
    </span>
  )
}
```

- [ ] **Step 2: Write `<L4NumberPanel>` skeleton**

Create `src/components/MyMoney/L3/L4NumberPanel.jsx`:

```jsx
// L4NumberPanel — full-screen drill panel for any drillable number.
// Per design §2.4 — 6 sections (Restated, Formula, Source, Visual, Actions, X24 What-if).
//
// Skeleton: Wave 0 ships the 6-section layout; per-metric data shapes get
// populated when the first L3 panel that uses them is built (Wave 1+).

export function L4NumberPanel({
  metric, value,
  formula, source, confidence,
  breakdown,
  onBack,
}) {
  return (
    <div className="sw-l4-number-panel" style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
    }}>
      {/* Section 1 — Restated big number + plain-English explanation */}
      <div className="sw-l4-restated" style={{
        background: 'linear-gradient(180deg, var(--c-acc-soft), transparent)',
        border: '1px solid var(--c-acc-border)',
        borderRadius: 8, padding: '16px 18px',
      }}>
        <div className="sw-eyebrow">{metric}</div>
        <div className="sw-l3-hero-value" style={{ fontSize: 32 }}>{value}</div>
      </div>

      {/* Section 2 — Formula breakdown */}
      <div className="sw-l4-section">
        <div className="sw-l3-row-label">HOW THIS IS CALCULATED</div>
        <div className="sw-l3-row-value">{formula ?? 'Formula not yet wired'}</div>
      </div>

      {/* Section 3 — Source provenance */}
      <div className="sw-l4-section">
        <div className="sw-l3-row-label">WHERE THE DATA CAME FROM</div>
        <div className="sw-l3-row-value">{source ?? '—'}</div>
        <div className="sw-l3-row-sub">Confidence: {confidence}</div>
      </div>

      {/* Section 4 — Visual breakdown (placeholder; Wave 4 wires DrillableChart) */}
      <div className="sw-l4-section">
        <div className="sw-l3-row-label">VISUAL BREAKDOWN</div>
        {breakdown
          ? <pre style={{ fontSize: 10, opacity: 0.7 }}>{JSON.stringify(breakdown, null, 2)}</pre>
          : <div className="sw-l3-row-sub">Chart wires in Wave 4</div>}
      </div>

      {/* Section 5 — Action chips (X24 mode 2) — populated per-metric in Wave 1+ */}
      <div className="sw-l4-section">
        <div className="sw-l3-row-label">WHAT YOU CAN DO</div>
        <div className="sw-l3-row-sub">Action chips populated per metric</div>
      </div>

      {/* Section 6 — X24 "What if this were different?" affordance */}
      <div className="sw-l4-section">
        <div className="sw-l3-row-label">WHAT IF THIS WERE DIFFERENT?</div>
        <div className="sw-l3-row-sub">Goal-seek wires per metric in Wave 5</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Extend barrel export**

Edit `src/components/MyMoney/L3/index.js` to include:

```javascript
export { DrillableNumber } from './DrillableNumber.jsx'
export { L4NumberPanel } from './L4NumberPanel.jsx'
```

- [ ] **Step 4: Smoke-test renders**

Create `tests/components/DrillableNumber.smoke.test.jsx`:

```jsx
import { render, fireEvent } from '@testing-library/react'
import { DrillableNumber } from '../../src/components/MyMoney/L3/DrillableNumber.jsx'

test('DrillableNumber fires onDrill on click with full metric payload', () => {
  let captured = null
  const { getByText } = render(
    <DrillableNumber
      metric="aa_used"
      value="£18,750 of £60,000 used"
      formula="sum of personal + employer YTD"
      source="AJ Bell + Aviva"
      confidence="high"
      onDrill={(p) => { captured = p }}
    />
  )
  fireEvent.click(getByText('£18,750 of £60,000 used'))
  expect(captured?.metric).toBe('aa_used')
  expect(captured?.formula).toBe('sum of personal + employer YTD')
  expect(captured?.confidence).toBe('high')
})
```

Run: `npx vitest run tests/components/DrillableNumber.smoke.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MyMoney/L3/DrillableNumber.jsx src/components/MyMoney/L3/L4NumberPanel.jsx src/components/MyMoney/L3/index.js tests/components/DrillableNumber.smoke.test.jsx
git commit -m "feat(MyMoney): scaffold DrillableNumber + L4NumberPanel primitives (Wave 0)"
```

---

### Task W0-T7: Scaffold `<DrillableChart>` + `<L4ChartPanel>` primitives

**Files:**
- Create: `src/components/MyMoney/L3/DrillableChart.jsx`
- Create: `src/components/MyMoney/L3/L4ChartPanel.jsx`
- Modify: `src/components/MyMoney/L3/index.js`

- [ ] **Step 1: Write `<DrillableChart>` wrapper**

Create `src/components/MyMoney/L3/DrillableChart.jsx`:

```jsx
// DrillableChart — wraps any chart with PP-3 + chart-drill behaviour.
// Default render shows the configured "story" window (per-chart configurable).
// Tap opens <L4ChartPanel> with time-window + comparison + annotation controls.

import { useState } from 'react'

export function DrillableChart({
  metric,
  defaultWindow = '1Y',          // per-chart story default
  granularity = 'month',
  children,                      // the inline chart JSX (sparkline etc)
  onDrill,
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="sw-drillable-chart"
      role="button"
      tabIndex={0}
      onClick={() => onDrill?.({ metric, defaultWindow, granularity })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDrill?.({ metric, defaultWindow, granularity }) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px dotted rgba(93, 219, 194, 0.3)',
        cursor: 'pointer',
        outline: hover ? '1px solid rgba(93, 219, 194, 0.15)' : 'none',
        borderRadius: 4,
      }}
      aria-label={`Drill into ${metric} chart`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write `<L4ChartPanel>` skeleton**

Create `src/components/MyMoney/L3/L4ChartPanel.jsx`:

```jsx
// L4ChartPanel — full-screen chart drill with time-window + comparison +
// chart-type + annotation controls. Skeleton in Wave 0; full controls wired
// in Wave 4 when DrillableChart is rolled out across all charts.

import { useState } from 'react'
import { getTimeSeries } from '../../../engine/time-series.js'

const TIME_WINDOWS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', 'All']

export function L4ChartPanel({
  metric,
  defaultWindow = '1Y',
  entity,
  onBack,
}) {
  const [window, setWindow] = useState(defaultWindow)
  const series = getTimeSeries(entity, metric, window, 'month')

  return (
    <div className="sw-l4-chart-panel" style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
    }}>
      {/* Hero */}
      <div className="sw-l3-hero" style={{
        background: 'linear-gradient(180deg, var(--c-acc-soft), transparent)',
        border: '1px solid var(--c-acc-border)',
        borderRadius: 8, padding: '12px 14px',
      }}>
        <div className="sw-eyebrow">{metric} · {window}</div>
        <div className="sw-l3-hero-value" style={{ fontSize: 22 }}>
          {series.points.length > 0
            ? `£${series.points[series.points.length - 1].value.toLocaleString()}`
            : 'No data'}
        </div>
        {series.gaps.length > 0 && (
          <div className="sw-l3-row-sub" style={{ color: 'var(--c-coral)' }}>
            Data only goes back to {series.dataStartDate}
          </div>
        )}
      </div>

      {/* Time window controls */}
      <div className="sw-l4-controls" style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid var(--c-border2)',
        borderRadius: 8, padding: 10,
      }}>
        <div className="sw-l3-row-label">TIME WINDOW</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {TIME_WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={'sw-pill' + (window === w ? ' sw-pill-active' : '')}
              style={{
                padding: '3px 8px', borderRadius: 10,
                background: window === w ? 'rgba(93,219,194,0.15)' : 'rgba(255,255,255,0.04)',
                border: '1px solid ' + (window === w ? 'rgba(93,219,194,0.4)' : 'rgba(255,255,255,0.08)'),
                color: window === w ? 'var(--c-acc)' : 'inherit',
                fontSize: 11, cursor: 'pointer',
              }}
            >{w}</button>
          ))}
        </div>
        <div className="sw-l3-row-sub" style={{ marginTop: 8 }}>
          Comparison overlay · Chart type · Annotations — wire in Wave 4
        </div>
      </div>

      {/* Chart area */}
      <div className="sw-l4-chart-area" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--c-border2)',
        borderRadius: 8, padding: 12,
        minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {series.points.length === 0
          ? <div className="sw-l3-row-sub">No data for this metric · window {window}</div>
          : <div className="sw-l3-row-sub">Sparkline rendering wires in Wave 4 · {series.points.length} points loaded</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Extend barrel export**

Edit `src/components/MyMoney/L3/index.js` to include:

```javascript
export { DrillableChart } from './DrillableChart.jsx'
export { L4ChartPanel } from './L4ChartPanel.jsx'
```

- [ ] **Step 4: Smoke-test renders**

Create `tests/components/DrillableChart.smoke.test.jsx`:

```jsx
import { render, fireEvent } from '@testing-library/react'
import { DrillableChart } from '../../src/components/MyMoney/L3/DrillableChart.jsx'

test('DrillableChart fires onDrill on click with metric + window', () => {
  let captured = null
  const { container } = render(
    <DrillableChart metric="pension_value" defaultWindow="5Y" onDrill={(p) => { captured = p }}>
      <svg width="100" height="30" />
    </DrillableChart>
  )
  const el = container.querySelector('.sw-drillable-chart')
  fireEvent.click(el)
  expect(captured?.metric).toBe('pension_value')
  expect(captured?.defaultWindow).toBe('5Y')
})
```

Run: `npx vitest run tests/components/DrillableChart.smoke.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MyMoney/L3/DrillableChart.jsx src/components/MyMoney/L3/L4ChartPanel.jsx src/components/MyMoney/L3/index.js tests/components/DrillableChart.smoke.test.jsx
git commit -m "feat(MyMoney): scaffold DrillableChart + L4ChartPanel primitives (Wave 0)"
```

---

### Task W0-T8: Migrate MyMoney.jsx top-level from direct fq-calc to `useRipple`

**Files:**
- Modify: `src/screens/MyMoney.jsx`
- Read: `src/state/ripple.jsx` (existing hook)
- Read: `docs/superpowers/plans/wave0-fq-import-inventory.md`

- [ ] **Step 1: Read the existing useRipple hook to confirm API**

Read `src/state/ripple.jsx`. Confirm the hook signature is `useRipple(entity, scopes = ['all'])` and that it returns the ripple output shape from `engine/ripple.js`.

- [ ] **Step 2: Edit MyMoney.jsx — replace direct fq-calc imports with useRipple**

Locate the top-of-file imports in `src/screens/MyMoney.jsx`. Replace:

```javascript
import { calcFQ, calcRisk, netWorth, monthlySurplus, ...etc } from '../engine/fq-calculator.js'
```

with:

```javascript
import { useRipple } from '../state/ripple.jsx'
import { lifeStageFor } from '../engine/fq-calculator.js'  // pure helpers stay direct
import { TAX } from '../engine/_bundle.js'                  // already migrated to bundle
```

Then inside the `MyMoney` component, add at the top:

```javascript
const ripple = useRipple(entity, ['balance_sheet', 'scores', 'tax', 'cashflow', 'iht', 'protection'])
```

And replace every site that reads:
- `calcFQ(entity)` → `ripple.scores.fq`
- `calcRisk(entity)` → `ripple.scores.risk`
- `netWorth(entity)` → `ripple.balance_sheet.netWorth`
- `monthlySurplus(entity)` → `ripple.cashflow.monthlySurplus`
- `calcAPQ(entity)` → `ripple.scores.apq` (if APQ is in scope; else add direct import)
- `totalCoI(entity, ...)` → keep direct for now if not yet in ripple

Per the inventory in step W0-T1, each callsite is enumerated. Apply systematically.

- [ ] **Step 3: Run dev server, visit `/?demo=mrt&tab=money`, verify no console errors**

Run: `npm run dev` (if not already running)

Then visit `http://localhost:5174/?demo=mrt&tab=money` in Chrome. Open DevTools console.

Expected: zero errors. NW renders £484k. Wealth Score 64. Risk Score 65. Monthly surplus renders.

- [ ] **Step 4: Run ripple-contract regression**

Run: `node tests/ripple-contract.mjs`
Expected: 103/103 pass (no regression from Phase 2c baseline).

- [ ] **Step 5: Commit**

```bash
git add src/screens/MyMoney.jsx
git commit -m "refactor(MyMoney): migrate top-level from direct fq-calc to useRipple (Wave 0 F4)"
```

---

### Task W0-T9: Migrate PensionDrillDown to useRipple

**Files:**
- Modify: `src/screens/MyMoney.jsx` (PensionDrillDown function at line ~1738)

- [ ] **Step 1: Locate PensionDrillDown function**

Run: `Grep tool with pattern "function PensionDrillDown" in src/screens/MyMoney.jsx`
Expected: one match at approximately line 1738.

- [ ] **Step 2: Audit fq-calc usage inside PensionDrillDown**

Read lines 1738 onwards in MyMoney.jsx. Identify every reference to imports from fq-calculator.js used inside the function (or its children). Common candidates: `calcAnnualAllowance`, `calcLSAUsage`, `calcCarryForward`, `calcMPAA`, `projectedPensionValue`, `dbProjectedPension`, `sippihtExposure`, `isRuleActive`, `chargeImpact`, `contributionsYTD`.

- [ ] **Step 3: For each, decide ripple-scope or keep-direct**

`calcAnnualAllowance`, `calcLSAUsage`, `calcCarryForward`, `calcMPAA` → these come from `allowanceTracker` already. If they're already in ripple's `tax` scope via the driver-engine, route through ripple. Otherwise, accept direct imports for tax-engine helpers in Wave 0 — promote to ripple in Wave 5.

- [ ] **Step 4: Apply the migration**

Edit PensionDrillDown to consume `ripple` prop passed from parent (MyMoney). Add `ripple` to the destructured props. Replace ripple-scoped calls.

- [ ] **Step 5: Verify Pension drill renders identically**

Visit `?demo=mrt&tab=money`, expand Pensions, click drill. Verify all 4 wrappers (AJ Bell, SSAS, Aviva legacy, Nest) + 1 DB scheme render with the same values as baseline snap from W0-T2.

- [ ] **Step 6: Commit**

```bash
git add src/screens/MyMoney.jsx
git commit -m "refactor(PensionDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T10: Migrate PropertyDrillDown to useRipple

**Files:**
- Modify: `src/components/MyMoney/PropertyDrillDown.jsx`

- [ ] **Step 1: Audit fq-calc imports in the file**

Read `src/components/MyMoney/PropertyDrillDown.jsx`. Identify every `from '../../engine/fq-calculator.js'` import.

- [ ] **Step 2: Apply migration per W0-T9 template**

Replace ripple-scoped calls with `useRipple`. Keep pure helpers (`lifeStageFor`, `formatCurrency`) as direct imports.

- [ ] **Step 3: Verify Property drill renders identically against Mr T**

Visit `?demo=mrt&tab=money`, expand Property, click drill. Verify Residence + BTL Manchester both render with rental P&L, S24 position.

- [ ] **Step 4: Commit**

```bash
git add src/components/MyMoney/PropertyDrillDown.jsx
git commit -m "refactor(PropertyDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T11: Migrate BusinessDrillDown to useRipple

**Files:**
- Modify: `src/components/MyMoney/BusinessDrillDown.jsx`

- [ ] **Step 1: Apply same migration pattern as W0-T10**
- [ ] **Step 2: Verify Business drill renders identically against Mr T (Synthetic Tech equity £145k + EMI £18k + DLA £18.5k)**
- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/BusinessDrillDown.jsx
git commit -m "refactor(BusinessDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T12: Migrate ProtectionDrillDown to useRipple

**Files:**
- Modify: `src/components/MyMoney/ProtectionDrillDown.jsx`

- [ ] **Step 1: Apply same migration pattern**
- [ ] **Step 2: Verify Protection drill renders identically (5 Mr T policies)**
- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/ProtectionDrillDown.jsx
git commit -m "refactor(ProtectionDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T13: Migrate LiabilitiesDrillDown to useRipple

**Files:**
- Modify: `src/components/MyMoney/LiabilitiesDrillDown.jsx`

- [ ] **Step 1: Apply same migration pattern**
- [ ] **Step 2: Verify Liabilities drill renders identically (4 Mr T liabilities)**
- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/LiabilitiesDrillDown.jsx
git commit -m "refactor(LiabilitiesDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T14: Migrate InvestmentsDrillDown to useRipple

**Files:**
- Modify: `src/components/MyMoney/InvestmentsDrillDown.jsx`

- [ ] **Step 1: Apply same migration pattern**
- [ ] **Step 2: Verify Investments drill renders identically (ISA + GIA + EIS/SEIS/VCT + Bonds — pre-split bundle)**

This panel gets split into 4 in Wave 1 (ISAL3, GIAL3, TaxAdvantagedL3, BondsL3). For now it stays bundled.

- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/InvestmentsDrillDown.jsx
git commit -m "refactor(InvestmentsDrillDown): migrate to useRipple (Wave 0 F4)"
```

---

### Task W0-T15: Run full regression + visual diff against W0-T2 baseline

**Files:**
- Run: `tests/ripple-contract.mjs`
- Run: `tests/harness/snapshot.mjs`
- Compare: `docs/superpowers/plans/wave0-baseline-snap.md` vs current state

- [ ] **Step 1: Run ripple-contract regression**

Run: `node tests/ripple-contract.mjs`
Expected: 103/103 pass.

- [ ] **Step 2: Run snapshot harness on Mr T**

Run: `node tests/harness/snapshot.mjs --persona mrt --year 2026 --output docs/superpowers/plans/wave0-post-migration-snap.json`

- [ ] **Step 3: Diff baseline vs post-migration snapshots**

Compare `wave0-baseline-snap.json` and `wave0-post-migration-snap.json`. The two MUST be identical (apart from `_meta` timestamp).

Run: `diff docs/superpowers/plans/wave0-baseline-snap.json docs/superpowers/plans/wave0-post-migration-snap.json`
Expected: only `_meta.computedAt` differs.

- [ ] **Step 4: Visual smoke test in browser**

Visit `http://localhost:5174/?demo=mrt&tab=money`. Click into every drill (Pension, Property, Business, Protection, Liabilities, Investments). Verify zero console errors, identical rendered values to baseline.

Also smoke-test other 6 personas via persona switcher: `?demo=a`, `?demo=b`, `?demo=c`, `?demo=d`, `?demo=e`, `?demo=g`. Verify no regression on any.

- [ ] **Step 5: Update inventory + commit verification artifacts**

Append to `docs/superpowers/plans/wave0-fq-import-inventory.md`:

```markdown
## Wave 0 post-migration verification (2026-MM-DD)
- ripple-contract: 103/103 PASS
- snapshot baseline diff: only `_meta.computedAt` differs
- visual smoke: 7 personas × 6 drill panels = 42 surface checks, zero regressions
- WAVE 0 EXIT GATE PASSED
```

```bash
git add docs/superpowers/plans/wave0-post-migration-snap.json docs/superpowers/plans/wave0-fq-import-inventory.md
git commit -m "test(Wave 0): regression clean — F4 migration complete with zero behavioural change"
```

---

### Task W0-T16: Founder approval gate

**Action only — no code.**

- [ ] **Step 1: Notify founder Wave 0 is complete with all gates green**

Tell founder:
- ripple-contract regression: 103/103 pass
- 6 drill panels migrated to useRipple, zero behavioural change
- 7 personas visually verified at 1440×900
- `getTimeSeries` engine function ships
- `<L3Panel>`, `<L4NumberPanel>`, `<DrillableNumber>`, `<DrillableChart>`, `<L4ChartPanel>` primitives scaffolded
- plain-english.js extended with locked statutory mappings
- All 16 commits clean, in order

Ask founder to:
1. Visit `http://localhost:5174/?demo=mrt&tab=money` and click through each drill — confirm "looks identical to before"
2. Approve to proceed to Wave 1
3. If anything looks off, list specific issues

- [ ] **Step 2: On approval, mark Wave 0 task complete in TaskList**

Use `TaskUpdate` to mark `MM-WAVE-0` as `completed`.

- [ ] **Step 3: Invoke writing-plans for Wave 1 detail**

Per the roadmap, Wave 1 detail-plan is written via a separate `writing-plans` invocation after Wave 0 exit gate. This honours YAGNI — we plan with current code state, not hypothetical future state.

---

# WAVES 1-7 — TASK SUMMARIES

The following waves are NOT detailed step-by-step in this document. Each is planned via a separate `writing-plans` invocation immediately after the prior wave's exit gate is met. This is deliberate per Karpathy YAGNI: we plan code against the actual state, not against assumed-future state.

Each summary below lists the tasks at concept level so the founder + executor can see scope. Full bite-sized TDD plans land just-in-time.

---

## Wave 1 — L3 batch 1 (Investing wrappers split + Cash)

**Goal:** First 5 new L3 panels render for Mr T with depth. Splits the existing bundled InvestmentsDrillDown into 4 dedicated panels.

**Tasks (concept level):**
1. Write `<L3Panel>` slot integration test — fixture-driven render of all 4 fixed sections + 2 mocked middle sections
2. Build `AAPositionSection` middle component (used by PensionL3 later, but built here as the first reusable section)
3. Build `ISAAllowanceSection` middle component
4. Build `CGTPositionSection` middle component (used by GIAL3, BondsL3, PropertyL3)
5. Build `Bond5pctSection` middle component
6. Build `ReliefHorizonSection` middle component (used by TaxAdvantagedL3)
7. Build `FundChargesSection` middle component
8. Build `PerAccountSection` middle component (used by CashL3)
9. Build `LiquidityBandSection` middle component
10. Build `ISAL3` domain module using `<L3Panel>` + above sections
11. Build `GIAL3` domain module
12. Build `TaxAdvantagedL3` domain module
13. Build `BondsL3` domain module
14. Build `CashL3` domain module
15. Deprecate `InvestmentsDrillDown.jsx` (leave file for now, just remove from MyMoney import)
16. Wire L3 routing in MyMoney.jsx — clicking ISA tile opens ISAL3, GIA tile opens GIAL3, etc.
17. Verify Mr T renders all 5 panels with depth (Vanguard ISA, Barclays Cash ISA, Interactive Investor GIA, Octopus EIS/SEIS/VCT, Pru+Quilter bonds, 3 bank accounts)
18. Plain-English audit on Wave 1 panels — grep for raw statutory codes
19. Founder approval gate

**Exit gate:** All 5 new L3 panels live, Mr T renders all wrappers, PP-9 clean.

---

## Wave 0.5 — C3 IHT cross-tab chips

**Goal:** Estate section of every L3 panel activates with live IHT chips from T&E.

**Tasks (concept level):**
1. Build `ihtChipsForMyMoney(entity, ripple)` engine function — returns Map<assetId, chipData>
2. Vitest unit — confirm Mr T's SIPP (£205k), BTL (£198k), Business equity (£0 due to BPR) all return correct chip data
3. Wire `ihtChipsForMyMoney` into `EstatePositionSection` — replace placeholder with live chip
4. Verify Wave 1 panels (ISAL3, GIAL3, TaxAdvantagedL3, BondsL3, CashL3) all show meaningful Estate position (or "No estate impact" for non-applicable wrappers)
5. Add IHT chip rendering to L1 tiles (SIPP / property / business at the tile level, not just L3)
6. Snap-verify before/after at 1440×900

---

## Wave 2 — L3 batch 2 (Income + State + Director + Business + Share schemes + Property refactor)

**Goal:** 5 more new L3 panels + refactor Property panel onto primitive.

**Tasks (concept level):**
1. Build `IncomeBreakdownSection`, `TaxBandPositionSection` middle components
2. Build `StatePensionForecastSection` middle component
3. Build `CompanyDashboardSection`, `ANISection`, `DirectorRemixSection` middle components
4. Build `BPRPositionSection`, `ShareholdingSection` middle components
5. Build `VestingSection` middle component
6. Build `PerPropertySection`, `RentalPnLSection`, `S24Section`, `MortgageProfileSection` middle components
7. Build `IncomeL3`, `StateBenefitsL3`, `DirectorL3`, `BusinessL3`, `ShareSchemesL3` domain modules
8. Refactor existing `PropertyDrillDown` → `PropertyL3` using `<L3Panel>` primitive
9. Wire L3 routing for all 6 new panels in MyMoney.jsx
10. Verify Mr T renders all panels (5 income streams, state pension forecast £11,502, Synthetic Tech dashboard, BPR £145k, EMI £18k, Residence + BTL)
11. Plain-English audit on Wave 2 panels
12. Engine work alongside if needed (e.g. extend driver-engine.js with `directorRemix`)

---

## Wave 0.75 — C2 events fold reducer

**Goal:** AddItemSheet writes persist through to MyMoney render.

**Tasks (concept level):**
1. Build `foldAssetEvent(entity, envelope)` engine function supporting 4 envelope types (ASSET_VALUE_UPDATED, ASSET_ADDED, ASSET_REMOVED, ASSET_RENAMED)
2. Wire into existing EventsProvider applyEvents chain
3. Vitest unit — emit envelope, verify entity diff matches expected
4. Browser test — add £5,000 to GIA via AddItemSheet, observe value update on L1 tile and inside GIAL3
5. Update L4NumberPanel — Section 5 (Actions) becomes live for "Edit" and "Update valuation"
6. Verify ripple still fires correctly post-fold (ripple-contract regression)

---

## Wave 3 — L3 batch 3 (Protection split + Alternatives + Family + Pension/Liabilities refactor)

**Goal:** Final 5 new L3 panels + refactor Protection/Pension/Liabilities onto primitive. All 19 panels live.

**Tasks (concept level):**
1. Build `PerPolicySection`, `ProtectionGapSection` middle components
2. Build `PerAssetSection` (for Alternatives), `DependantSection` middle components
3. Build `PerLoanSection` middle component (for Liabilities refactor)
4. Split existing `ProtectionDrillDown` → `ProtectionL3` (J only) + `GeneralInsuranceL3` (K) + `BusinessInsuranceL3` (L)
5. Build `AlternativesL3`, `FamilyObligationsL3` domain modules
6. Refactor existing `PensionDrillDown` → `PensionL3` using `<L3Panel>` primitive (this is the biggest refactor — Domain B nests inside)
7. Refactor existing `LiabilitiesDrillDown` → `LiabilitiesL3`
8. Verify all 19 L3 panels render for Mr T per §8 contract in design doc
9. Plain-English audit on Wave 3 panels
10. Full L1 → L3 navigation smoke test across all 19 domains

**Exit gate:** All 19 L3 panels live, Mr T validation contract met, PP-9 100% clean across MyMoney.

---

## Wave 4 — L4 chart drill panels

**Goal:** `<DrillableChart>` + `<L4ChartPanel>` wired across all ~30 charts. Retroactive across Home + Risk + Cashflow.

**Tasks (concept level):**
1. Replace L4ChartPanel skeleton with full implementation — render actual chart (line/area/candle/bar)
2. Wire 4 control groups (time window · comparison · chart type · annotations) per design §2.4
3. Apply `<DrillableChart>` to every Hero sparkline in 19 L3 panels (~19 charts)
4. Apply `<DrillableChart>` to every L3 middle-section chart (~10-15 more)
5. Apply retroactively to Home Score Journey, Risk radar trajectory, Cashflow PoS fan, T&E IHT trajectory
6. Verify 5Y view available on Mr T pension value chart (the worked example from brainstorming)
7. Comparison overlay test — Mr T NW vs Mr T NW (prior period offset), confirm renders
8. Data-honesty test — request 10Y view on Mr T (data starts ~Jun 2025), confirm greyed band + tooltip
9. Snap-verify at 1440×900 + 1920×1080 dark + light
10. Founder approval gate

**Exit gate:** Every chart in MyMoney + Home Score Journey + Risk radar drill-target opens L4 with full controls.

---

## Wave 5 — Cross-cutting polish

**Goal:** All locked principles (PP-1 through PP-10) enforced cross-product within MyMoney scope.

**Tasks (concept level):**
1. A2 — daily NW cause-chain (engine emits `metric_changed` events with `primary_driver` + `secondary_effects[]`; render as ribbon under NW anchor)
2. A3 — rules version label (UK-2026.1.1) pinned in top header
3. PP-3 audit — Grep every `{value}` / `£{x}` / `{score}` rendering in MyMoney scope; verify wrapped in `<DrillableNumber>` or has documented exception
4. PP-9 audit — Grep for raw statutory codes (`AA|LSA|PCLS|OCF|CGT|IHT|S24|BADR|MPAA|FAD|UFPLS|ANI|RNRB|BPR`) outside `plain-english.js`; zero results required
5. B3 — wire X24 mode-3 "What if this were different?" affordance on hero metrics of every L3 (long-press → goal-seek slide-over)
6. B4 — X29 visual-diff contract: tint NW changes, animate delta chip, reveal cause chain
7. D1 — verify `TaxTreatmentBlock` (existing engine output) is rendered as part of `TaxTreatmentSection` for every L3
8. Snap-verify entire MyMoney tab at 1440×900 + 1920×1080 dark + light

---

## Wave 6 — `/impeccable audit` + `sonus-financial-analyst`

**Goal:** Technical + financial-grade pass before declaring shippable.

**Tasks (concept level):**
1. Invoke `impeccable` skill on MyMoney scope — a11y (WCAG AA), tap targets (≥44px), keyboard nav, focus rings, console errors, broken routes
2. Invoke `sonus-financial-analyst` on each persona — verify every visible number against UK-2026.1.1 bundle (ISA £20k, AA £60k, CGT £3k AEA, IHT NRB £325k, etc.); fix any RATE MISMATCH inline
3. Invoke `sonuswealth-compliance` skill — FCA boundary check on every advisor copy, every chip, every action recommendation
4. Invoke `sonuswealth-ifa-auditor` — chartered planner-grade audit of decisions surfaced in L3 + L4 panels
5. Invoke `sonuswealth-tax-accountant` — UK chartered accountant audit of tax calculations on every L3
6. Invoke `sonuswealth-dataviz-critic` — chart quality audit on every L4 chart drill
7. Address all findings inline

**Exit gate:** Each invoked audit returns 0 critical findings.

---

## Wave 7 — Snap × inspect (final ship gate)

**Goal:** Per CLAUDE.md §9 — declared done only after audit-clean snap × every viewport × every theme × every panel.

**Tasks (concept level):**
1. Snap every L3 panel at 1440×900 dark
2. Snap every L3 panel at 1440×900 light
3. Snap every L3 panel at 1920×1080 dark
4. Snap every L3 panel at 1920×1080 light
5. Snap every L4 number panel at 1440×900 × 2 themes (sample of 10 representative numbers)
6. Snap every L4 chart panel at 1440×900 × 2 themes (sample of 10 representative charts)
7. Click every CTA in every L1 → L2 → L3 → L4 navigation chain. Verify destination renders. Log dead links.
8. Verify Mr T renders all 19 domains with depth (per §8 contract in design doc)
9. Verify no spec ☐ in mymoney-checklist regresses to 🔄
10. Founder eyeballs at 1440×900 for 30 minutes, marks any issue
11. Address final-pass issues
12. Re-snap affected panels
13. Mark Wave 7 + MyMoney rebuild as `completed` in tasks
14. Master "done" gate — proceed to next tab (Cashflow per master schedule §3)

---

## Plan self-review (per writing-plans skill)

**1. Spec coverage:**

Walked through design doc §1-§13. Every section maps to a wave:
- §1 Context → captured in plan preamble
- §2 Architecture → Waves 0-3 build the primitives + per-domain modules
- §3 Domain → Panel mapping → Waves 1-3 cover all 19 panels
- §4 File structure → Wave 0 task W0-T5/T6/T7 + Waves 1-3 task lists reference each file
- §5 Engine wiring → Wave 0 (E1, F4), Wave 0.5 (C3), Wave 0.75 (C2)
- §6 Build sequence → exactly mirrored in this plan's wave structure
- §7 Cross-tab dependencies → Wave 0.5 + Wave 5 enforcement
- §8 Mr T validation contract → exit gate of every wave
- §9 Verification + acceptance gates → exit gate of every wave + Wave 6/7
- §10 Out of scope → respected
- §11 Risks → mitigations applied in Wave 0 task structure (e.g. T2 baseline snap + T15 regression)
- §12 Open questions → none blocking
- §13 Decision audit trail → preserved in source spec

No spec gaps detected.

**2. Placeholder scan:**

Wave 0 tasks W0-T1 through W0-T15: every step has actual code, actual commands, actual expected output. No "TBD" / "TODO" / "fill in details".

Waves 1-7 are at task-summary level by deliberate design choice (YAGNI — plan code against actual codebase state, not hypothetical). The roadmap explicitly notes "Plan to be written via writing-plans after Wave N ships."

**3. Type consistency:**

Verified across Wave 0 tasks:
- `getTimeSeries(entity, metric, window, granularity)` signature consistent W0-T3 step 3 + W0-T7 L4ChartPanel usage
- `useRipple(entity, scopes)` signature consistent across W0-T8 through W0-T14
- `<L3Panel>` props consistent W0-T5 + W0-T6 references
- `<DrillableNumber>` `onDrill` payload shape consistent W0-T6 step 1 + step 4 test

---

*End of plan.*
