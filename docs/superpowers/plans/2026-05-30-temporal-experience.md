# Temporal Experience Implementation Plan — 1b + 1c (engine + primitive)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure per-node projection engine (`projection.js`) and the reusable direction-aware `TrajectoryBar` primitive — the foundation every temporal tab reads.

**Architecture:** A pure, Node-testable engine computes `{ now, future, plan }` for any taxonomy node by compounding its value to a horizon age at the CMA asset-class rate (reusing `financial-math.js` `fv`/`fvAnnuity`), with Plan = Future + committed `SCENARIO_SAVED` deltas. A thin React primitive renders three states as one bar; its geometry is a pure, separately-tested function.

**Tech Stack:** Vite/React/plain-JS. Tests are Node `.mjs` (no JSX loader). CMA from `src/engine/cma.js`. TVM from `src/engine/modules/financial-math.js`. Personas in `src/rules/personas/`.

**Scope:** This plan = increments 1b + 1c only. 1d–1g (MyMoney/Cashflow/What-if/Home UI) are separate plans authored after these land and the bar is visually reviewed.

---

## File Structure

- Create `src/engine/projection.js` — pure projection: `growthRateFor`, `projectValue`, `projectNode`, `projectTaxonomy`. One responsibility: turn today's values into horizon values.
- Create `tests/projection.mjs` — Node contract test for the above.
- Create `src/components/MyMoney/L3/TrajectoryBar.jsx` — thin presentational bar (Pattern A).
- Create `src/components/MyMoney/L3/trajectory-geometry.js` — pure segment-width math (testable in Node).
- Create `tests/trajectory-geometry.mjs` — Node test for the geometry.
- Modify `package.json` — add `test:projection` + `test:trajectory` scripts.
- Modify `src/state/events.jsx` — add `{ includeScenarios }` option to `applyEvents` (Task 5).

---

## Task 1: Growth-rate mapping (node type → CMA expected return)

**Files:**
- Create: `src/engine/projection.js`
- Test: `tests/projection.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/projection.mjs
import { growthRateFor } from '../src/engine/projection.js'
import CMA from '../src/rules/cma-2026.json' with { type: 'json' }

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e

console.log('\n── Task1 growthRateFor ──')
log(near(growthRateFor('pension-sipp', CMA), CMA.assetClasses.global_equity.expectedReturn),
  'pension → global_equity rate')
log(near(growthRateFor('property-btl', CMA), CMA.assetClasses.property.expectedReturn),
  'property → property rate')
log(near(growthRateFor('cash-savings', CMA), CMA.assetClasses.cash.expectedReturn),
  'cash → cash rate')
log(near(growthRateFor('alt-crypto', CMA), CMA.assetClasses.alternatives.expectedReturn),
  'alt → alternatives rate')
log(growthRateFor('totally-unknown-type', CMA) === CMA.growth,
  'unknown type → blended growth fallback')
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/projection.mjs`
Expected: FAIL — `growthRateFor is not a function` / import error.

- [ ] **Step 3: Minimal implementation**

```js
// src/engine/projection.js
// Pure per-node projection engine for the temporal experience (#18).
// No React, Node-importable. Reads CMA via the caller (defaults to active).
import { getActiveCMA } from './cma.js'
import { fv, fvAnnuity } from './modules/financial-math.js'

// Map a taxonomy node type (taxonomy.js keys) → the CMA asset class whose
// expectedReturn drives its growth. Conservative: equities for pensions/ISA/GIA,
// property for property, cash for cash, alternatives for alts. Unknown → the
// blended portfolio growth scalar (cma.growth) so nothing silently reads 0.
const CLASS_FOR_TYPE = {
  'pension-sipp': 'global_equity', 'pension-personal': 'global_equity',
  'pension-occupational-dc': 'global_equity', 'pension-ssas': 'global_equity',
  'pension-avc': 'global_equity', 'pension-occupational-db': 'uk_gilts',
  'isa-stocks-shares': 'global_equity', 'isa-lifetime': 'global_equity',
  'isa-junior': 'global_equity', 'gia': 'global_equity',
  'isa-cash': 'cash', 'cash-current': 'cash', 'cash-savings': 'cash',
  'cash-easy-access': 'cash', 'cash-fixed-term': 'cash',
  'property-residence': 'property', 'property-btl': 'property',
  'property-second-home': 'property', 'property-commercial': 'property',
  'property-overseas': 'property',
  'alt-aim': 'alternatives', 'alt-eis': 'alternatives', 'alt-seis': 'alternatives',
  'alt-vct': 'alternatives', 'alt-crypto': 'alternatives', 'alt-art': 'alternatives',
  'alt-physical-gold': 'alternatives',
  'bond-onshore': 'corp_bonds', 'bond-offshore': 'corp_bonds',
}

export function growthRateFor(nodeType, cma = getActiveCMA()) {
  const cls = CLASS_FOR_TYPE[nodeType]
  if (cls && cma.assetClasses?.[cls]) return cma.assetClasses[cls].expectedReturn
  return cma.growth
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/projection.mjs`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection.js tests/projection.mjs
git commit -m "feat(projection-1b): growthRateFor — taxonomy type to CMA rate"
```

---

## Task 2: `projectValue` — compound a value (+ contributions) to a horizon

**Files:**
- Modify: `src/engine/projection.js`
- Test: `tests/projection.mjs`

- [ ] **Step 1: Add failing test (append to tests/projection.mjs)**

```js
import { projectValue } from '../src/engine/projection.js'
console.log('\n── Task2 projectValue ──')
log(projectValue(100000, 0.05, 0) === 100000, 'years=0 → unchanged (baseline)')
log(Math.round(projectValue(100000, 0.05, 10)) === 162889, '£100k @5% 10y = £162,889')
{
  // with £6,000/yr contributions on top
  const v = projectValue(100000, 0.05, 10, 6000)
  log(v > projectValue(100000, 0.05, 10), 'contributions raise the result')
  log(Number.isFinite(v), 'finite with contributions')
}
log(projectValue(100000, 0.05, -3) === 100000, 'negative years clamps to now')
```

- [ ] **Step 2: Run to verify the new block fails**

Run: `node tests/projection.mjs`
Expected: FAIL — `projectValue is not a function`.

- [ ] **Step 3: Implement (append to src/engine/projection.js)**

```js
// Compound `now` for `years` at annual `rate`, optionally adding a yearly
// contribution (end-of-year annuity). Reuses the canonical TVM helpers so the
// math matches the rest of the engine. years<=0 returns `now` (baseline-safe).
export function projectValue(now, rate, years, contributionPerYear = 0) {
  const y = Math.max(0, Math.floor(years || 0))
  if (y === 0) return now
  const grown = fv(rate, y, now)                          // fv(rate, nper, pv)
  const fromContribs = contributionPerYear
    ? fvAnnuity(rate, y, contributionPerYear)             // fvAnnuity(rate, nper, pmt)
    : 0
  return grown + fromContribs
}
```

> NOTE for executor: confirm `fv`/`fvAnnuity` signatures in `src/engine/modules/financial-math.js`. If `fv(rate, nper, pv)` returns a negative (finance sign convention), wrap with `Math.abs` or pass `pv` sign-corrected so the assertions above hold. Adjust the expected constant only if the helper's convention demands it; do NOT change the test intent (baseline + monotonic).

- [ ] **Step 4: Run to verify pass**

Run: `node tests/projection.mjs`
Expected: PASS (Task1 + Task2 blocks).

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection.js tests/projection.mjs
git commit -m "feat(projection-1b): projectValue — compound + contributions via financial-math"
```

---

## Task 3: `projectNode` — project a single taxonomy node

**Files:**
- Modify: `src/engine/projection.js`
- Test: `tests/projection.mjs`

- [ ] **Step 1: Add failing test**

```js
import { projectNode } from '../src/engine/projection.js'
console.log('\n── Task3 projectNode ──')
{
  const node = { value: 420000, type: 'pension-sipp' }
  const opts = { currentAge: 62, horizonAge: 62 }   // horizon == now
  log(projectNode(node, opts) === 420000, 'horizon=now → node value unchanged')
}
{
  const node = { value: 420000, type: 'pension-sipp' }
  const grown = projectNode(node, { currentAge: 62, horizonAge: 72 })
  log(grown > 420000, 'pension grows over 10y')
  log(Number.isFinite(grown), 'finite')
}
{
  const liab = { value: 200000, type: 'mortgage-residence', monthlyPayment: 1200, rate: 0.04 }
  const future = projectNode(liab, { currentAge: 40, horizonAge: 50, direction: 'shrink' })
  log(future < 200000, 'mortgage balance shrinks toward horizon')
  log(future >= 0, 'never negative')
}
```

- [ ] **Step 2: Run — verify fail**

Run: `node tests/projection.mjs`
Expected: FAIL — `projectNode is not a function`.

- [ ] **Step 3: Implement (append)**

```js
// Project one node to the horizon. Assets/income grow via projectValue; a node
// flagged direction:'shrink' (liability) amortises its balance toward zero at
// its recorded rate/payment. Pure — caller supplies ages + cma.
export function projectNode(node, opts = {}) {
  const { currentAge, horizonAge, direction = 'grow', cma = getActiveCMA() } = opts
  const years = Math.max(0, (horizonAge ?? currentAge) - (currentAge ?? 0))
  const now = +node.value || 0
  if (years === 0) return now

  if (direction === 'shrink') {
    // Amortise: balance after `years` of fixed monthly payments at monthly rate.
    const r = (+node.rate || 0) / 12
    const pmt = +node.monthlyPayment || 0
    const n = years * 12
    if (pmt <= 0) return now                       // no payment recorded → unchanged
    let bal = now
    if (r === 0) bal = now - pmt * n
    else bal = now * Math.pow(1 + r, n) - pmt * ((Math.pow(1 + r, n) - 1) / r)
    return Math.max(0, Math.round(bal))
  }

  const rate = growthRateFor(node.type, cma)
  const contrib = (+node.monthlyContribution || 0) * 12
  return Math.round(projectValue(now, rate, years, contrib))
}
```

- [ ] **Step 4: Run — verify pass**

Run: `node tests/projection.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection.js tests/projection.mjs
git commit -m "feat(projection-1b): projectNode — grow assets/income, amortise liabilities"
```

---

## Task 4: `projectTaxonomy` — walk all nodes, return totals + reconcile

**Files:**
- Modify: `src/engine/projection.js`
- Test: `tests/projection.mjs`

- [ ] **Step 1: Add failing test (uses a real persona)**

```js
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { projectTaxonomy } from '../src/engine/projection.js'
import { fundedRatio, investable } from '../src/engine/fq-calculator.js'
import { getBundle } from '../src/engine/_bundle.js'
import CMA from '../src/rules/cma-2026.json' with { type: 'json' }
getBundle()
const personasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rules', 'personas')
const loadP = async f => JSON.parse(await readFile(join(personasDir, f), 'utf8'))

console.log('\n── Task4 projectTaxonomy ──')
{
  const e = await loadP('persona-a.json')          // Bruce, decumulation
  const r = projectTaxonomy(e, { horizonAge: 62, cma: CMA }) // horizon == his age now
  log(Math.abs(r.totals.now - investable(e)) / Math.max(1, investable(e)) < 0.25,
    `now total ≈ investable (now £${Math.round(r.totals.now).toLocaleString()})`)
  log(r.totals.future === r.totals.now, 'horizon=now → future === now (baseline)')
}
{
  const e = await loadP('persona-c.json')          // Tony Stark
  const r = projectTaxonomy(e, { horizonAge: 80, cma: CMA })
  log(r.totals.future > r.totals.now, 'future grows over horizon')
  log(r.totals.plan === r.totals.future, 'plan === future with no committed scenarios')
  log(Number.isFinite(r.totals.future), 'future finite')
  log(Array.isArray(r.byNode) && r.byNode.length > 0, `byNode populated (${r.byNode.length})`)
}
```

- [ ] **Step 2: Run — verify fail**

Run: `node tests/projection.mjs`
Expected: FAIL — `projectTaxonomy is not a function`.

- [ ] **Step 3: Implement (append)**

```js
// Walk the investable + property + liability nodes of an entity and project each
// to the horizon. Returns per-node rows + now/future/plan totals.
// `plan` applies committed-scenario deltas when the caller passes a pre-folded
// `planEntity` (base ⊕ SCENARIO_SAVED); without it, plan === future.
export function projectTaxonomy(entity, opts = {}) {
  const { horizonAge, cma = getActiveCMA(), planEntity = null } = opts
  const currentAge = entity?.age ?? 65
  const collect = (e) => {
    const rows = []
    const a = e?.assets || {}
    const push = (value, type, dir = 'grow', extra = {}) => {
      if (!value) return
      rows.push({ value: +value, type, direction: dir, ...extra })
    }
    ;(a.sipp?.pensions || []).forEach(p => push(p.value, 'pension-sipp', 'grow', { monthlyContribution: p.monthlyContribution }))
    ;(a.pensions || []).forEach(p => push(p.balance || p.cetv || p.value, 'pension-occupational-db'))
    ;(a.investments || []).forEach(i => push(i.value || i.balance, i.type?.includes('ISA') ? 'isa-stocks-shares' : 'gia'))
    ;(a.bank || []).forEach(b => push(b.balance, 'cash-savings'))
    if (a.residence) push(a.residence.value, 'property-residence')
    ;(a.property || []).forEach(p => push(p.value || p.value_gbp, 'property-btl'))
    ;(a.alternatives || []).forEach(x => push(x.value || x.value_gbp, 'alt-crypto'))
    return rows
  }
  const baseRows = collect(entity)
  const byNode = baseRows.map(n => ({
    type: n.type,
    now: n.value,
    future: projectNode(n, { currentAge, horizonAge, direction: n.direction, cma }),
  }))
  const planRows = planEntity ? collect(planEntity) : baseRows
  const planTotal = planRows.reduce((s, n) =>
    s + projectNode(n, { currentAge, horizonAge, direction: n.direction, cma }), 0)
  const totals = {
    now:    byNode.reduce((s, n) => s + n.now, 0),
    future: byNode.reduce((s, n) => s + n.future, 0),
    plan:   planTotal,
  }
  return { byNode, totals }
}
```

> NOTE for executor: the `now ≈ investable` assertion uses a loose 25% band because `investable()` excludes property while this walker includes it — they will NOT match exactly. If you'd rather tie out tightly, split the walker total into `investableTotal` vs `allAssetsTotal` and assert the former against `investable(e)`. Keep the baseline assertion (`horizon=now → future===now`) strict — that one must hold exactly.

- [ ] **Step 4: Run — verify pass**

Run: `node tests/projection.mjs`
Expected: PASS (all four task blocks).

- [ ] **Step 5: Commit**

```bash
git add src/engine/projection.js tests/projection.mjs
git commit -m "feat(projection-1b): projectTaxonomy — per-node + totals, baseline-preserving"
```

---

## Task 5: `applyEvents({ includeScenarios })` — separate corrections from plan forks

**Files:**
- Modify: `src/state/events.jsx` (the `applyEvents` function, ~line 91)
- Test: `tests/projection.mjs`

- [ ] **Step 1: Add failing test**

```js
import { applyEvents, EV } from '../src/state/events.jsx'
console.log('\n── Task5 applyEvents includeScenarios ──')
{
  const base = { age: 60, assets: { bank: [{ id: 'b1', balance: 1000 }] } }
  const evs = [
    { type: EV.ASSET_FIELD_CORRECTED, payload: { path: 'assets.bank[0].balance', value: 2000 } },
    { type: EV.SCENARIO_SAVED, payload: { /* a committed fork */ scenarioId: 's1' } },
  ]
  const future = applyEvents(base, evs, { includeScenarios: false })
  const plan   = applyEvents(base, evs, { includeScenarios: true })
  log(future.assets.bank[0].balance === 2000, 'correction applied in Future (real data)')
  log(future._scenariosApplied !== true, 'scenario NOT applied in Future')
  log(plan._scenariosApplied === true, 'scenario applied in Plan')
}
```

- [ ] **Step 2: Run — verify fail**

Run: `node tests/projection.mjs`
Expected: FAIL — Future still applies scenario (no option support yet).

- [ ] **Step 3: Implement**

Modify `applyEvents` signature + the `SCENARIO_SAVED` case in `src/state/events.jsx`:

```js
// signature (was: applyEvents(baseEntity, events = []))
export function applyEvents(baseEntity, events = [], opts = {}) {
  const { includeScenarios = true } = opts
  if (!events.length) return baseEntity
  const e = JSON.parse(JSON.stringify(baseEntity))
  for (const ev of events) {
    switch (ev.type) {
      // ... existing cases unchanged ...
      case EV.SCENARIO_SAVED: {
        if (!includeScenarios) break        // Future excludes committed forks
        // existing scenario-fold logic (or, if none yet, mark applied):
        e._scenariosApplied = true
        // TODO(executor): apply the actual fork deltas from ev.payload here if a
        // SCENARIO_SAVED fold already exists elsewhere; otherwise this flag is the
        // seam 1f will build on.
        break
      }
    }
  }
  return e
}
```

> NOTE: if `SCENARIO_SAVED` has no fold case today, ADD the case above. The `_scenariosApplied` marker is the minimal seam so the test proves the split; 1f wires the real deltas.

- [ ] **Step 4: Run — verify pass**

Run: `node tests/projection.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/events.jsx tests/projection.mjs
git commit -m "feat(projection-1b): applyEvents includeScenarios — corrections vs plan forks"
```

---

## Task 6: Register test script + full 1b green

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add script** (after `test:cma-override`):

```json
"test:projection": "node tests/projection.mjs",
```

- [ ] **Step 2: Run** `npm run test:projection` — Expected: all blocks PASS, exit 0.
- [ ] **Step 3: Build** `npm run build` — Expected: clean (no new modules broken).
- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(projection-1b): register test:projection — 1b engine complete"
```

---

## Task 7: TrajectoryBar geometry (pure, testable)

**Files:**
- Create: `src/components/MyMoney/L3/trajectory-geometry.js`
- Test: `tests/trajectory-geometry.mjs`

- [ ] **Step 1: Write failing test**

```js
// tests/trajectory-geometry.mjs
import { trajectorySegments } from '../src/components/MyMoney/L3/trajectory-geometry.js'
let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

console.log('\n── trajectorySegments ──')
{
  // grow: now 100, future 150, plan 180 → nowPct≈55.6, futurePct≈27.8, planPct≈16.7
  const s = trajectorySegments(100, 150, 180, 'grow')
  log(Math.abs(s.nowPct + s.futurePct + s.planPct - 100) < 0.01, 'grow segments sum to 100%')
  log(s.nowPct > s.futurePct && s.futurePct > s.planPct, 'grow ordering now>future>plan widths')
}
{
  const s = trajectorySegments(100, 100, 100, 'grow')
  log(Math.abs(s.nowPct - 100) < 0.01, 'flat node → all width is Now')
  log(s.futurePct === 0 && s.planPct === 0, 'flat node → no future/plan extension')
}
{
  // shrink: liability 200 now, 150 future, 120 plan → bar retracts; planPct is the
  // extra paydown beyond future.
  const s = trajectorySegments(200, 150, 120, 'shrink')
  log(s.direction === 'shrink', 'carries direction')
  log(s.nowPct + s.futurePct + s.planPct <= 100.01, 'shrink widths bounded')
}
{
  const s = trajectorySegments(0, 0, 0, 'grow')
  log(s.nowPct === 0 && s.futurePct === 0 && s.planPct === 0, 'all-zero node → empty bar, no NaN')
}

console.log(`\nTrajectory geometry — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
```

- [ ] **Step 2: Run — verify fail**

Run: `node tests/trajectory-geometry.mjs`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Implement**

```js
// src/components/MyMoney/L3/trajectory-geometry.js
// Pure geometry for TrajectoryBar. Turns (now, future, plan) into segment
// percentages of the bar. 'grow' bars extend right (now→future→plan); 'shrink'
// bars (liabilities) are scaled to the largest magnitude (the Now balance) so a
// shrinking balance reads as a retracting bar. Returns 0s for empty nodes (no NaN).
export function trajectorySegments(now, future, plan, direction = 'grow') {
  const n = +now || 0, f = +future || 0, p = +plan || 0
  if (direction === 'shrink') {
    // Largest is the starting balance; segments are the remaining + paid portions.
    const max = Math.max(n, f, p, 1)
    return {
      direction,
      nowPct: 0,                              // (UI renders shrink as remaining vs cleared)
      futurePct: Math.max(0, (f / max) * 100),
      planPct: Math.max(0, ((f - p) / max) * 100),   // extra paid off by the plan
      remainingPct: Math.max(0, (p / max) * 100),
    }
  }
  const total = Math.max(n, f, p)
  if (total <= 0) return { direction, nowPct: 0, futurePct: 0, planPct: 0 }
  const nowPct    = (Math.min(n, total) / total) * 100
  const futurePct = (Math.max(0, Math.min(f, total) - n) / total) * 100
  const planPct   = (Math.max(0, p - Math.max(n, f)) / total) * 100
  return { direction, nowPct, futurePct, planPct }
}
```

- [ ] **Step 4: Run — verify pass**

Run: `node tests/trajectory-geometry.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MyMoney/L3/trajectory-geometry.js tests/trajectory-geometry.mjs
git commit -m "feat(trajectory-1c): pure segment geometry (grow/shrink/flat, no NaN)"
```

---

## Task 8: TrajectoryBar component (thin render over geometry)

**Files:**
- Create: `src/components/MyMoney/L3/TrajectoryBar.jsx`

- [ ] **Step 1: Implement the component**

```jsx
// src/components/MyMoney/L3/TrajectoryBar.jsx
// Pattern A trajectory bar — one bar encodes Now/Future/Plan by length + shade.
// Big number = active lens; the other two are small ghosts. Geometry is the pure
// trajectorySegments() helper so this file stays presentational.
import { trajectorySegments } from './trajectory-geometry.js'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0)), s = n < 0 ? '−' : ''
  if (a >= 1e6) return `${s}£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `${s}£${(a / 1e3).toFixed(0)}k`
  return `${s}£${a.toLocaleString()}`
}

export function TrajectoryBar({ now, future, plan, direction = 'grow', activeMode = 'actual', horizonLabel, onExpand }) {
  const seg = trajectorySegments(now, future, plan, direction)
  const big = activeMode === 'forecast' ? future : activeMode === 'plan' ? plan : now
  return (
    <button type="button" onClick={onExpand} className="sw-press"
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
        border: 'none', padding: '6px 0', cursor: onExpand ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-body,15px)', fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(big)}</span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{fmt(now)} · {fmt(future)} · {fmt(plan)}</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--c-surface2,rgba(255,255,255,0.06))' }}>
        <div style={{ width: `${seg.nowPct}%`, background: 'var(--c-acc,#5ddbc2)' }} />
        <div style={{ width: `${seg.futurePct}%`, background: 'color-mix(in srgb, var(--c-acc,#5ddbc2) 45%, transparent)' }} />
        <div style={{ width: `${seg.planPct}%`, background: 'var(--c-good,#5DDBA8)' }} />
      </div>
      {horizonLabel && <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 3 }}>now → future → plan · {horizonLabel}</div>}
    </button>
  )
}
```

- [ ] **Step 2: Build** `npm run build` — Expected: clean, module count +1.

- [ ] **Step 3: Snap-verify (CLAUDE.md §9.5 Gate 1)** — temporarily render TrajectoryBar in PanelPreviewGallery (or a scratch `?panel=` entry) with grow + shrink + flat sample data; `preview_start` → `preview_screenshot` at mobile/desktop × dark/light. Confirm: grow bar extends, shrink bar retracts, flat bar is one solid segment, numbers legible. Remove the scratch entry after.

- [ ] **Step 4: Register geometry test in package.json**

```json
"test:trajectory": "node tests/trajectory-geometry.mjs",
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MyMoney/L3/TrajectoryBar.jsx package.json
git commit -m "feat(trajectory-1c): TrajectoryBar component (Pattern A) + snap-verified"
```

---

## Self-Review checklist (run before handing off)

- **Spec coverage:** 1b (projection engine, §3) + 1c (TrajectoryBar, §2) covered. Event-class split (§3) = Task 5. 1d–1g intentionally deferred to their own plans (stated in Scope).
- **Placeholder scan:** Two `NOTE for executor` blocks flag real signature/convention checks (financial-math sign convention; investable-vs-walker tie-out) — these are verification instructions, not placeholders; the test intent is fixed.
- **Type consistency:** `growthRateFor(type, cma)` · `projectValue(now, rate, years, contrib)` · `projectNode(node, opts)` · `projectTaxonomy(entity, opts)` · `trajectorySegments(now, future, plan, direction)` · `applyEvents(base, events, opts)` — names consistent across tasks and the component.

---

## Acceptance for 1b + 1c

- `npm run test:projection` green · `npm run test:trajectory` green · `npm run build` clean.
- TrajectoryBar snap-verified at 3 viewports × 2 themes (grow/shrink/flat).
- Baseline preserved: horizon=now ⇒ future===now===plan with no committed scenarios.
- Ready for 1d (MyMoney) to consume `projectTaxonomy` + `TrajectoryBar`.
