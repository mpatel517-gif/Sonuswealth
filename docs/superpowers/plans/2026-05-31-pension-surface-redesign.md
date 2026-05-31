# Pension Surface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the pension surface (Home tile → grouped drill → per-pot leaf → withdrawal-strategy "Decide" view) as the reusable Have→Understand→Decide exemplar.

**Architecture:** A pure generator (`decumulation-plan.js`) produces the guided withdrawal sequence + flags from the pot list. Three new React surfaces (summary drill, per-pot leaf, decide view) consume it plus the existing projection/CMA and Monte-Carlo engines. The Home tile is modified to reveal composition. No engine math is invented — projection, POS, and TAX values all come from existing modules.

**Tech Stack:** Vite/React 19 plain-JS; Node `.mjs` tests; CSS design tokens (`--c-acc`, `--c-coral`, `--c-gold`, `sw-chip-*`, `sw-eyebrow`); MCP Claude_Preview for snap gate.

**Spec:** `docs/superpowers/specs/2026-05-31-pension-surface-redesign-design.md`

---

## Verified APIs (read before starting — do not re-derive)

- `pensionPots[]` element shape: `{ name, value, provider, type, charge, nominationDate }` (HomeScreen.jsx:1689,1703). `charge` is a fraction (0.0045 = 0.45%). `value` is £ absolute.
- `src/engine/projection.js`: `projectValue(now, rate, years, contributionPerYear=0)`, `growthRateFor(nodeType, cma=getActiveCMA())`. SIPP nodeType = `'pension-sipp'`, occupational-DB = `'pension-occupational-db'`, occupational-DC = `'pension-occupational-dc'`.
- `src/engine/cma.js`: `getActiveCMA()` → `{ growth, inflation, assetClasses:{ global_equity:{expectedReturn}, ... } }`.
- `src/engine/scenarios.js`: `monteCarloPOS(entity, schedule, options) → { probability, percentilesByAge, simulations, terminalAge, startAge }`. **`probability` is a fraction 0–1** (it is "% of simulations" expressed 0–1; verify in step and ×100 for display). `schedule` accepts `{ annual: number }`.
- `src/engine/fq-calculator.js`: exports `TAX` (UK figures) and `fmt`. **Never hardcode UK figures — read from `TAX`.**
- Events: `src/state/events.jsx` exports `useEvents()` + `EV`. Leaf edits commit `EV.ASSET_FIELD_CORRECTED`; saving a chosen sequence commits `EV.SCENARIO_SAVED`.
- Mounts: `OverlayShell` (`src/components/MyMoney/shared/OverlayShell.jsx`), `DrillStackProvider`/`useDrillStackContext` (`src/components/MyMoney/L3/DrillStack.jsx`), `L3PanelHost` (`src/components/MyMoney/L3/L3PanelHost.jsx`).

---

## File Structure

| File | New/Mod | Responsibility |
|---|---|---|
| `src/engine/decumulation-plan.js` | New | Pure: `classifyPot`, `potsNeedingReview`, `buildDecumulationPlan`. |
| `tests/decumulation-plan.mjs` | New | Contract for the above. |
| `src/engine/projection.js` | Mod | Add `projectSeries(now,rate,years,contrib=0)` → yearly array. |
| `tests/projection.mjs` | Mod | Add `projectSeries` cases. |
| `src/components/MyMoney/L3/MiniTrendLines.jsx` | New | Pure SVG: N normalised polylines from series arrays. |
| `src/components/MyMoney/L3/PensionLeaf.jsx` | New | L3 per-pot leaf (trend, £/yr drag, TFC share, 2027, sequence role, verify-flags, update-value). |
| `src/components/MyMoney/L3/PensionSummaryDrill.jsx` | New | L2 grouped-by-type list + CTA + ordered §4.5 spine. |
| `src/components/MyMoney/L3/DecumulationStrategy.jsx` | New | L3 Decide view: guided plan + interactive sequencer. |
| `src/screens/HomeScreen.jsx` | Mod | L1 tile: count + N-need-review + 3 trend-lines + labelled delta. |
| `src/screens/MyMoney.jsx` | Mod | Route inline PensionDrillDown → PensionSummaryDrill. |
| `0-Active/route-specs/.snap-verdict-pension-redesign.md` | New | §9.5 snap evidence. |
| `package.json` | Mod | Register `test:decumulation`. |

---

### Task 1: Decumulation plan generator (pure)

**Files:**
- Create: `src/engine/decumulation-plan.js`
- Test: `tests/decumulation-plan.mjs`
- Modify: `package.json` (add script)

- [ ] **Step 1: Write the failing test**

```js
// tests/decumulation-plan.mjs — guided withdrawal sequence contract.
import { classifyPot, potsNeedingReview, buildDecumulationPlan } from '../src/engine/decumulation-plan.js'

let fails = 0, passes = 0
const log = (ok, m) => { ok ? (passes++, console.log('✓ ' + m)) : (fails++, console.log('✗ ' + m)) }

const POTS = [
  { name: 'Vanguard SIPP',   value: 420000, type: 'SIPP',       charge: 0.0045, nominationDate: '2025-01-01' },
  { name: 'Hargreaves SIPP', value: 280000, type: 'SIPP',       charge: 0.0045, nominationDate: '2025-03-01' },
  { name: 'Wayne DC',        value: 150000, type: 'Legacy DC',  charge: 0.0090, nominationDate: '2019-01-01' },
]

console.log('\n── classifyPot ──')
log(classifyPot(POTS[0]) === 'self-invested', 'SIPP → self-invested')
log(classifyPot(POTS[2]) === 'workplace-legacy', 'Legacy DC → workplace-legacy')
log(classifyPot({ type: 'Occupational DB' }) === 'workplace-legacy', 'DB → workplace-legacy')

console.log('\n── potsNeedingReview ──')
{
  const r = potsNeedingReview(POTS, { now: new Date('2026-05-31') })
  log(r.length === 1 && r[0].name === 'Wayne DC', 'stale nomination (>2y) flagged; fresh ones not')
}

console.log('\n── buildDecumulationPlan ──')
{
  const p = buildDecumulationPlan(POTS, { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31'), flexibleIncomeTaken: false })
  log(Array.isArray(p.sequence) && p.sequence.length >= 4, 'sequence has ≥4 ordered steps')
  log(p.sequence[0].action === 'verify' && /legacy|guarantee|safeguard/i.test(p.sequence[0].reason), 'legacy ring-fenced as step 1 (verify)')
  log(p.sequence.some(s => s.action === 'tax-free-cash'), 'includes a tax-free-cash step')
  log(p.sequence.some(s => s.action === 'flex'), 'includes a flex-the-SIPPs step')
  log(p.sequence[p.sequence.length - 1].action === 'time-2027', 'final step times against April 2027')
  log(p.sequence.every((s, i) => s.order === i + 1), 'orders are 1..n contiguous')
  log(p.flags.some(f => f.code === 'VERIFY_LEGACY'), 'flags VERIFY_LEGACY when a legacy pot exists')
  log(p.flags.some(f => f.code === 'IHT_2027_SOON'), 'flags IHT_2027_SOON when within 365 days')
}
{
  const p = buildDecumulationPlan(POTS, { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31'), flexibleIncomeTaken: true })
  log(p.flags.some(f => f.code === 'MPAA'), 'flags MPAA when flexible income already taken')
}
{
  const p = buildDecumulationPlan([POTS[0], POTS[1]], { age: 63, iht2027: new Date('2027-04-06'), now: new Date('2026-05-31') })
  log(!p.flags.some(f => f.code === 'VERIFY_LEGACY'), 'no legacy flag when all pots are SIPPs')
  log(p.sequence[0].action !== 'verify', 'no verify step when nothing to verify')
}

console.log(`\ndecumulation-plan — pass=${passes} fail=${fails}`)
process.exit(fails === 0 ? 0 : 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:decumulation` (after adding script in Step 3a) — or `node tests/decumulation-plan.mjs`
Expected: FAIL — `Cannot find module '../src/engine/decumulation-plan.js'`.

- [ ] **Step 3a: Register the test script**

In `package.json` scripts, after the `"test:trajectory"` line add:
```json
    "test:decumulation": "node tests/decumulation-plan.mjs",
```

- [ ] **Step 3b: Write the implementation**

```js
// src/engine/decumulation-plan.js
// Pure, deterministic, Node-importable. Produces the guided withdrawal
// sequence + flags for a set of pension pots. Info/guidance only — every
// reason is framed as "advisers generally…", never "you should".
// Spec: docs/superpowers/specs/2026-05-31-pension-surface-redesign-design.md §3 (Decide).

const YEAR_MS = 365.25 * 24 * 3600 * 1000

// SIPP / personal = self-invested (user controls drawdown).
// Everything else (DB, occupational DC, legacy, workplace) = verify first.
export function classifyPot(pot = {}) {
  const t = String(pot.type || '').toLowerCase()
  if (/sipp|self|personal/.test(t)) return 'self-invested'
  return 'workplace-legacy'
}

// A pot needs review if its nomination is stale (>2y) or it is legacy/DB
// (guarantees unverified). `now` injectable for deterministic tests.
export function potsNeedingReview(pots = [], { now = new Date() } = {}) {
  return pots.filter(p => {
    const stale = p.nominationDate
      ? (now - new Date(p.nominationDate)) > 2 * YEAR_MS
      : true
    return stale || classifyPot(p) === 'workplace-legacy'
  })
}

// Build the ordered, reasoned sequence. `now`/`iht2027` injectable for tests.
export function buildDecumulationPlan(pots = [], opts = {}) {
  const {
    age = 65,
    now = new Date(),
    iht2027 = new Date('2027-04-06'),
    flexibleIncomeTaken = false,
  } = opts

  const legacy = pots.filter(p => classifyPot(p) === 'workplace-legacy')
  const sipps  = pots.filter(p => classifyPot(p) === 'self-invested')
  const steps = []

  if (legacy.length) {
    steps.push({
      action: 'verify',
      title: `Check your ${legacy.length > 1 ? 'workplace/legacy pensions' : legacy[0].name} first`,
      reason: 'Legacy and workplace schemes can carry protected tax-free cash, a protected retirement age, or safeguarded/guaranteed benefits. Advisers generally verify these before drawing anything — the pot may be worth more left untouched. Safeguarded benefits over £30,000 legally require regulated advice to transfer.',
    })
  }
  steps.push({
    action: 'tax-free-cash',
    title: 'Take tax-free cash in phases',
    reason: 'Up to 25% across your pots is tax-free (within the Lump Sum Allowance). Phasing it, rather than taking it all at once, preserves death-benefit flexibility and keeps more invested.',
  })
  if (sipps.length) {
    steps.push({
      action: 'flex',
      title: `Flex your ${sipps.length > 1 ? 'SIPPs' : sipps[0].name} for income`,
      reason: 'Self-invested pots are your adjustable income engine — you can vary withdrawals year to year to manage tax bands and sequence-of-returns risk.',
    })
  }
  steps.push({
    action: 'time-2027',
    title: 'Time it against 6 April 2027',
    reason: 'Until April 2027 pensions sit outside your estate, so the usual order is to spend other money first and leave pensions last. From April 2027 they count toward inheritance tax — which can flip the logic toward drawing or gifting sooner.',
  })

  const sequence = steps.map((s, i) => ({ ...s, order: i + 1 }))

  const flags = []
  if (legacy.length) flags.push({ code: 'VERIFY_LEGACY', severity: 'warn', message: `${legacy.length} workplace/legacy scheme${legacy.length > 1 ? 's need' : ' needs'} checking for guarantees before action.` })
  if (flexibleIncomeTaken) flags.push({ code: 'MPAA', severity: 'warn', message: 'You may have triggered the Money Purchase Annual Allowance — future contributions could be capped at the MPAA, not the full Annual Allowance.' })
  const daysTo2027 = Math.round((iht2027 - now) / (24 * 3600 * 1000))
  if (daysTo2027 > 0 && daysTo2027 <= 365) flags.push({ code: 'IHT_2027_SOON', severity: 'info', message: `Pensions enter your estate for inheritance tax in ${daysTo2027} days.` })
  const accessAge = 55 // 57 from April 2028 — sourced from TAX at call sites that have it
  if (age < accessAge) flags.push({ code: 'NO_ACCESS_YET', severity: 'info', message: `Personal pensions are normally accessible from age ${accessAge}.` })

  return { sequence, flags }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:decumulation`
Expected: PASS — `pass=15 fail=0` (or higher).

- [ ] **Step 5: Commit**

```bash
git add src/engine/decumulation-plan.js tests/decumulation-plan.mjs package.json
git commit -m "feat(pension): guided decumulation-plan generator + tests"
```

---

### Task 2: projectSeries + MiniTrendLines

**Files:**
- Modify: `src/engine/projection.js` (add `projectSeries`)
- Modify: `tests/projection.mjs` (add cases)
- Create: `src/components/MyMoney/L3/MiniTrendLines.jsx`

- [ ] **Step 1: Add failing test cases to `tests/projection.mjs`**

Append before the final summary/`process.exit` block:
```js
console.log('\n── projectSeries ──')
{
  const s = projectSeries(100000, 0.05, 5)
  log(s.length === 6, 'series includes now + each year to horizon (n+1 points)')
  log(s[0] === 100000, 'first point is now')
  log(s[s.length - 1] > s[0], 'grows over the horizon at a positive rate')
}
{
  const s = projectSeries(100000, 0.05, 0)
  log(s.length === 1 && s[0] === 100000, 'horizon 0 → single now point (baseline-safe)')
}
```
Add `projectSeries` to the existing import line at the top of `tests/projection.mjs`:
```js
import { projectValue, projectNode, projectTaxonomy, growthRateFor, projectSeries } from '../src/engine/projection.js'
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:projection`
Expected: FAIL — `projectSeries is not a function`.

- [ ] **Step 3: Implement `projectSeries` in `src/engine/projection.js`**

After `projectValue` (line ~53) add:
```js
// Yearly value path from now to horizon (inclusive both ends) for sparklines.
// years<=0 ⇒ [now]. Reuses projectValue so the path matches the point engine.
export function projectSeries(now, rate, years, contributionPerYear = 0) {
  const y = Math.max(0, Math.floor(years || 0))
  const out = []
  for (let t = 0; t <= y; t++) out.push(Math.round(projectValue(now, rate, t, contributionPerYear)))
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:projection`
Expected: PASS — all prior cases + 5 new pass.

- [ ] **Step 5: Implement `MiniTrendLines.jsx`**

```jsx
// MiniTrendLines.jsx — pure SVG. N polylines on a shared y-scale so multiple
// pots are visually comparable. No data fetching, no engine calls.
// series: number[][] (one array per line). Empty/zero-safe (renders nothing).

const PALETTE = ['var(--c-acc,#5ddbc2)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-coral,#FF6F7D)']

export function MiniTrendLines({ series = [], colors = PALETTE, width = 88, height = 28, strokeWidth = 1.5 }) {
  const lines = (series || []).filter(s => Array.isArray(s) && s.length > 1)
  if (!lines.length) return null
  const all = lines.flat()
  const min = Math.min(...all), max = Math.max(...all)
  const span = max - min || 1
  const maxLen = Math.max(...lines.map(s => s.length))
  const x = (i, len) => (len <= 1 ? 0 : (i / (len - 1)) * (width - strokeWidth)) + strokeWidth / 2
  const y = (v) => height - strokeWidth / 2 - ((v - min) / span) * (height - strokeWidth)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="projected trend" style={{ display: 'block' }}>
      {lines.map((s, li) => (
        <polyline
          key={li}
          fill="none"
          stroke={colors[li % colors.length]}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={s.map((v, i) => `${x(i, s.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/projection.js tests/projection.mjs src/components/MyMoney/L3/MiniTrendLines.jsx
git commit -m "feat(pension): projectSeries + MiniTrendLines (N projected sparklines)"
```

---

### Task 3: PensionLeaf (per-pot L3 leaf)

**Files:**
- Create: `src/components/MyMoney/L3/PensionLeaf.jsx`

Builds on Task 1 (`classifyPot`, `buildDecumulationPlan`) + Task 2 (`projectSeries`, `MiniTrendLines`). Mounts via `OverlayShell` (same pattern as `AssetDetailOverlay`). No new test — verified in the Task 8 snap gate; logic it depends on is already tested.

- [ ] **Step 1: Implement**

```jsx
// PensionLeaf.jsx — L3 per-pension leaf. "How is THIS pot doing + its role."
// Reuses projection (trend), decumulation-plan (sequence role), events (update).
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { MiniTrendLines } from './MiniTrendLines.jsx'
import { projectSeries, growthRateFor } from '../../../engine/projection.js'
import { getActiveCMA } from '../../../engine/cma.js'
import { classifyPot, buildDecumulationPlan } from '../../../engine/decumulation-plan.js'
import { TAX } from '../../../engine/fq-calculator.js'
import { useEvents, EV } from '../../../state/events.jsx'

const fmt = (n) => `£${Math.round(+n || 0).toLocaleString('en-GB')}`

export function PensionLeaf({ pot, entity, pots = [], personaId, onClose, onHome }) {
  const cma = getActiveCMA()
  const age = entity?.age ?? 65
  const years = Math.max(1, (entity?.retirementAge ?? 67) - age)
  const isSipp = classifyPot(pot) === 'self-invested'
  const nodeType = isSipp ? 'pension-sipp' : 'pension-occupational-dc'
  const rate = growthRateFor(nodeType, cma)
  const series = projectSeries(+pot.value || 0, rate, years)

  const dragPerYear = Math.round((+pot.value || 0) * (+pot.charge || 0))
  // This pot's share of the 25% tax-free cash, capped at the LSA across all pots.
  const lsa = TAX?.lsa ?? TAX?.lumpSumAllowance ?? 268275
  const tfcShare = Math.min((+pot.value || 0) * 0.25, lsa)

  const plan = buildDecumulationPlan(pots, { age })
  const role = isSipp
    ? plan.sequence.find(s => s.action === 'flex')
    : plan.sequence.find(s => s.action === 'verify')

  const { commit } = useEvents()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(+pot.value || 0))
  const saveValue = () => {
    if (personaId) commit(personaId, { type: EV.ASSET_FIELD_CORRECTED, payload: { category: 'pensions', name: pot.name, field: 'value', value: +val } })
    setEditing(false)
  }

  return (
    <OverlayShell title={pot.name} subtitle={isSipp ? 'Self-invested · you control drawdown' : 'Workplace / legacy · verify first'} onClose={onClose} onHome={onHome}>
      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        {/* Hero */}
        <div>
          <div className="sw-eyebrow">VALUE TODAY</div>
          <div style={{ fontSize: 'var(--fs-hero,34px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(pot.value)}</div>
          <span className={isSipp ? 'sw-chip sw-chip-blue' : 'sw-chip sw-chip-warn'} style={{ marginTop: 6 }}>{pot.type || (isSipp ? 'SIPP' : 'Legacy')}</span>
        </div>

        {/* Projected trend */}
        <div>
          <div className="sw-eyebrow">PROJECTED TO RETIREMENT (age {entity?.retirementAge ?? 67})</div>
          <MiniTrendLines series={[series]} width={220} height={48} />
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>Projection at {(rate * 100).toFixed(1)}% p.a. (assumption — not past performance). Adjust in Settings → Assumptions.</div>
        </div>

        {/* Charge as £/yr */}
        <Row label="Annual charge" value={`${((pot.charge || 0) * 100).toFixed(2)}% ≈ ${fmt(dragPerYear)}/yr`} hint="What this pot costs you each year in fees." />

        {/* Tax-free cash share */}
        <Row label="Tax-free cash from this pot" value={`up to ${fmt(tfcShare)}`} hint="25% of this pot, within your Lump Sum Allowance across all pensions." />

        {/* Nomination + 2027 */}
        <Row label="Who inherits" value={pot.nominationDate ? `Nomination on file (${pot.nominationDate})` : 'No nomination on file'} hint="From 6 April 2027 this pot counts toward your estate for inheritance tax." />

        {/* Role in the sequence */}
        {role && (
          <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-md,10px)', padding: 12 }}>
            <div className="sw-eyebrow">ITS ROLE IN YOUR WITHDRAWAL PLAN</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>Step {role.order}: {role.title}</div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4 }}>{role.reason}</div>
          </div>
        )}

        {/* Update value */}
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={val} onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ flex: 1, padding: 8 }} />
            <button type="button" onClick={saveValue} className="sw-btn">Save</button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="sw-btn-ghost" style={{ alignSelf: 'flex-start' }}>Update value</button>
        )}

        <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>Information and guidance only. Not personal advice.</div>
      </div>
    </OverlayShell>
  )
}

function Row({ label, value, hint }) {
  return (
    <div style={{ borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))', paddingBottom: 10 }}>
      <div className="sw-eyebrow">{label.toUpperCase()}</div>
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}
```

> Note: confirm `OverlayShell` prop names (`title`/`subtitle`/`onClose`/`onHome`) by opening `src/components/MyMoney/shared/OverlayShell.jsx`; match existing usage in `L3PanelHost.jsx`. Confirm `sw-btn`/`sw-btn-ghost` exist or substitute the project's button class.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0, no unresolved imports.

- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/L3/PensionLeaf.jsx
git commit -m "feat(pension): per-pot L3 leaf (trend, drag, TFC share, 2027, sequence role)"
```

---

### Task 4: PensionSummaryDrill (L2)

**Files:**
- Create: `src/components/MyMoney/L3/PensionSummaryDrill.jsx`

- [ ] **Step 1: Resolve exact TAX keys**

Run: `node -e "import('./src/engine/fq-calculator.js').then(m=>console.log(Object.keys(m.TAX)))"`
Expected: prints TAX keys. Find the keys for LSA (£268,275), LSDBA (£1,073,100), pension AA (£60,000), MPAA (£10,000). Use those exact keys below (replace `TAX.lsa` etc. if names differ). If a key is absent, fall back to the literal with a `// TODO source-from-TAX` note and flag it in the PR.

- [ ] **Step 2: Implement**

```jsx
// PensionSummaryDrill.jsx — L2. Groups pots by type, shows per-pot trend/drag,
// one "Turn this into income" CTA, then the ordered §4.5 analysis spine.
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { MiniTrendLines } from './MiniTrendLines.jsx'
import { PensionLeaf } from './PensionLeaf.jsx'
import { DecumulationStrategy } from './DecumulationStrategy.jsx'
import { projectSeries, growthRateFor } from '../../../engine/projection.js'
import { getActiveCMA } from '../../../engine/cma.js'
import { classifyPot, potsNeedingReview } from '../../../engine/decumulation-plan.js'
import { TAX } from '../../../engine/fq-calculator.js'

const fmt = (n) => `£${Math.round(+n || 0).toLocaleString('en-GB')}`

function PotRow({ pot, entity, cma, onOpen }) {
  const isSipp = classifyPot(pot) === 'self-invested'
  const years = Math.max(1, (entity?.retirementAge ?? 67) - (entity?.age ?? 65))
  const rate = growthRateFor(isSipp ? 'pension-sipp' : 'pension-occupational-dc', cma)
  const series = projectSeries(+pot.value || 0, rate, years)
  const drag = Math.round((+pot.value || 0) * (+pot.charge || 0))
  const stale = pot.nominationDate ? (Date.now() - new Date(pot.nominationDate)) > 2 * 365.25 * 864e5 : true
  return (
    <button type="button" onClick={() => onOpen(pot)} className="sw-press" style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '12px 8px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))', textAlign: 'left', cursor: 'pointer' }}>
      <span className={isSipp ? 'sw-chip-sm sw-chip-blue' : 'sw-chip-sm sw-chip-warn'}>{pot.type || (isSipp ? 'SIPP' : 'Legacy')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{pot.name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{fmt(pot.value)} · {fmt(drag)}/yr fees · <span style={{ color: stale ? 'var(--c-gold)' : 'var(--c-good,#5DDBA8)' }}>{stale ? 'nomination — review' : 'nomination up to date'}</span></div>
      </div>
      <MiniTrendLines series={[series]} width={64} height={24} />
      <span style={{ color: 'var(--c-text3)' }}>›</span>
    </button>
  )
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--c-border,rgba(255,255,255,0.08))' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '12px 8px', background: 'transparent', border: 'none', color: 'var(--c-text)', cursor: 'pointer' }}>
        <span className="sw-eyebrow">{title}</span><span>{open ? '–' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 8px 12px', fontSize: 13, color: 'var(--c-text2)' }}>{children}</div>}
    </div>
  )
}

export function PensionSummaryDrill({ entity, pots = [], personaId, onClose, onHome }) {
  const cma = getActiveCMA()
  const [leaf, setLeaf] = useState(null)
  const [strategy, setStrategy] = useState(false)

  const total = pots.reduce((s, p) => s + (+p.value || 0), 0)
  const sipps  = pots.filter(p => classifyPot(p) === 'self-invested')
  const legacy = pots.filter(p => classifyPot(p) === 'workplace-legacy')
  const needReview = potsNeedingReview(pots).length

  const lsa = TAX?.lsa ?? 268275, lsdba = TAX?.lsdba ?? 1073100, aa = TAX?.pensionAA ?? 60000
  const tfcAvail = Math.min(total * 0.25, lsa)

  if (leaf) return <PensionLeaf pot={leaf} entity={entity} pots={pots} personaId={personaId} onClose={() => setLeaf(null)} onHome={onHome} />
  if (strategy) return <DecumulationStrategy entity={entity} pots={pots} personaId={personaId} onClose={() => setStrategy(false)} onHome={onHome} />

  return (
    <OverlayShell title="Your pensions" subtitle={`${fmt(total)} across ${pots.length} pension${pots.length > 1 ? 's' : ''}${needReview ? ` · ${needReview} need review` : ''}`} onClose={onClose} onHome={onHome}>
      <div style={{ padding: 12 }}>
        {/* Section 1 — Holdings, grouped by type */}
        {sipps.length > 0 && <>
          <div className="sw-eyebrow" style={{ marginTop: 4 }}>SELF-INVESTED · YOU CONTROL</div>
          {sipps.map(p => <PotRow key={p.name} pot={p} entity={entity} cma={cma} onOpen={setLeaf} />)}
        </>}
        {legacy.length > 0 && <>
          <div className="sw-eyebrow" style={{ marginTop: 12 }}>WORKPLACE / LEGACY · VERIFY FIRST</div>
          {legacy.map(p => <PotRow key={p.name} pot={p} entity={entity} cma={cma} onOpen={setLeaf} />)}
        </>}

        {/* Primary CTA */}
        <button type="button" onClick={() => setStrategy(true)} className="sw-press" style={{ display: 'block', width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--r-lg,14px)', border: 'none', background: 'var(--c-acc,#5ddbc2)', color: '#06231f', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Turn this into income →
        </button>

        {/* §4.5 analysis spine — ordered, collapsible */}
        <div style={{ marginTop: 16 }}>
          <Section title="CONTRIBUTIONS" >Annual Allowance headroom is {fmt(aa)} this year. If you have taken flexible income, the lower Money Purchase Annual Allowance may apply. Carry-forward from the last 3 years can add headroom — capture your contribution history to calculate it.</Section>
          <Section title="TAX-FREE CASH">Up to {fmt(tfcAvail)} available now (25% of your pots, within the {fmt(lsa)} Lump Sum Allowance). The combined cap including death benefits is {fmt(lsdba)}.</Section>
          <Section title="ESTATE (FROM APRIL 2027)">From 6 April 2027 unused pension pots count toward your estate for inheritance tax. <button type="button" onClick={() => setStrategy(true)} style={{ color: 'var(--c-acc)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>See how this affects your plan →</button></Section>
          <Section title="CHARGES">Total fees across your pots ≈ {fmt(pots.reduce((s, p) => s + (+p.value || 0) * (+p.charge || 0), 0))}/yr. Open a pot to see its drag.</Section>
          <Section title="DATA COMPLETENESS">{needReview ? `${needReview} pot${needReview > 1 ? 's' : ''} need a nomination review or guarantee check.` : 'All pots have a recent nomination on file.'}</Section>
        </div>

        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 14 }}>Information and guidance only. Not personal advice. Verify decisions with an FCA-authorised adviser before acting.</div>
      </div>
    </OverlayShell>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/MyMoney/L3/PensionSummaryDrill.jsx
git commit -m "feat(pension): L2 grouped summary drill + ordered §4.5 spine + income CTA"
```

---

### Task 5: DecumulationStrategy (Decide view — guided + interactive)

**Files:**
- Create: `src/components/MyMoney/L3/DecumulationStrategy.jsx`

- [ ] **Step 1: Implement**

```jsx
// DecumulationStrategy.jsx — the "Decide" layer. Guided plan (from
// decumulation-plan.js) on top; interactive sequencer (target income →
// live POS via monteCarloPOS) below. FCA framed throughout.
import { useMemo, useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { buildDecumulationPlan } from '../../../engine/decumulation-plan.js'
import { monteCarloPOS } from '../../../engine/scenarios.js'
import { useEvents, EV } from '../../../state/events.jsx'

const fmt = (n) => `£${Math.round(+n || 0).toLocaleString('en-GB')}`
const clampPct = (p) => Math.max(0, Math.min(100, Math.round(p)))

const ACTION_TONE = { verify: 'var(--c-gold)', 'tax-free-cash': 'var(--c-acc)', flex: 'var(--c-acc)', 'time-2027': 'var(--c-coral)' }

export function DecumulationStrategy({ entity, pots = [], personaId, onClose, onHome }) {
  const total = pots.reduce((s, p) => s + (+p.value || 0), 0)
  const age = entity?.age ?? 65
  const plan = useMemo(() => buildDecumulationPlan(pots, { age }), [pots, age])

  // Interactive: target annual income (default 4% of pot).
  const [target, setTarget] = useState(Math.round(total * 0.04))
  const pos = useMemo(() => {
    if (!total) return 0
    const r = monteCarloPOS(entity, { annual: target }, { pensionPot: total, terminalAge: 95, simulations: 2000 })
    // probability is a 0–1 fraction; render as %.
    let p = r?.probability ?? 0
    p = p <= 1 ? p * 100 : p
    return clampPct(p)
  }, [entity, target, total])

  const { commit } = useEvents()
  const saveAsPlan = () => {
    if (personaId) commit(personaId, { type: EV.SCENARIO_SAVED, payload: { kind: 'decumulation', targetIncome: target, pots: pots.map(p => p.name) } })
  }

  return (
    <OverlayShell title="Turn your pensions into income" subtitle={`${fmt(total)} across ${pots.length} pots`} onClose={onClose} onHome={onHome}>
      <div style={{ padding: 16, display: 'grid', gap: 18 }}>
        {/* GUIDED */}
        <div>
          <div className="sw-eyebrow">A SENSIBLE ORDER — AND WHY</div>
          <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 10 }}>
            {plan.sequence.map(s => (
              <li key={s.order} style={{ display: 'flex', gap: 10 }}>
                <span style={{ flex: '0 0 24px', height: 24, borderRadius: 12, background: ACTION_TONE[s.action] || 'var(--c-acc)', color: '#06231f', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{s.order}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>{s.reason}</div>
                </div>
              </li>
            ))}
          </ol>
          {plan.flags.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {plan.flags.map(f => (
                <div key={f.code} style={{ fontSize: 12, color: f.severity === 'warn' ? 'var(--c-gold)' : 'var(--c-text3)' }}>• {f.message}</div>
              ))}
            </div>
          )}
        </div>

        {/* INTERACTIVE */}
        <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
          <div className="sw-eyebrow">TRY A WITHDRAWAL LEVEL</div>
          <div style={{ fontSize: 'var(--fs-hero,30px)', fontWeight: 800, marginTop: 4 }}>{fmt(target)}<span style={{ fontSize: 13, color: 'var(--c-text3)', fontWeight: 600 }}> /yr</span></div>
          <input type="range" min={Math.round(total * 0.02)} max={Math.round(total * 0.08)} step={500} value={target} onChange={e => setTarget(+e.target.value)} style={{ width: '100%', marginTop: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <Metric label="Chance it lasts to 95" value={`${pos}%`} tone={pos >= 85 ? 'var(--c-good,#5DDBA8)' : pos >= 60 ? 'var(--c-gold)' : 'var(--c-coral)'} />
            <Metric label="≈ % of pot / yr" value={`${total ? ((target / total) * 100).toFixed(1) : '0'}%`} />
            <Metric label="Taxable above allowance" value="income tax applies" small />
          </div>
          {pos >= 99 && <div style={{ fontSize: 12, color: 'var(--c-good,#5DDBA8)', marginTop: 8 }}>Near-certain to last — you may be able to spend more, or pass more on.</div>}
          <button type="button" onClick={saveAsPlan} className="sw-press" style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--c-acc)', background: 'transparent', color: 'var(--c-acc)', fontWeight: 700, cursor: 'pointer' }}>Add to my Plan</button>
        </div>

        <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>Modelling, not a guarantee. Information and guidance only — not personal advice. Verify with an FCA-authorised adviser before acting.</div>
      </div>
    </OverlayShell>
  )
}

function Metric({ label, value, tone, small }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: small ? 12 : 18, fontWeight: 800, color: tone || 'var(--c-text)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--c-text3)' }}>{label}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/MyMoney/L3/DecumulationStrategy.jsx
git commit -m "feat(pension): Decide view — guided plan + interactive sequencer (labelled POS)"
```

---

### Task 6: Home pension tile — reveal composition

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

- [ ] **Step 1: Locate the pension tile render**

Run: `grep -n "Pensions" src/screens/HomeScreen.jsx | head` and locate the CategoryTile/row that renders the pensions aggregate with its sparkline + delta (distinct from the breakdown overlay `rows[]` at ~1703). Identify the bare delta (e.g. "+0.2%") and the single `TrajectoryBar`/spark element.

- [ ] **Step 2: Build the per-pot series + counts where the tile is rendered**

Add near the pension tile's data prep (use the existing `pensionPots`):
```jsx
import { projectSeries, growthRateFor } from '../engine/projection.js'
import { getActiveCMA } from '../engine/cma.js'
import { classifyPot, potsNeedingReview } from '../engine/decumulation-plan.js'
import { MiniTrendLines } from '../components/MyMoney/L3/MiniTrendLines.jsx'
// …
const _cma = getActiveCMA()
const _years = Math.max(1, (a.retirementAge ?? 67) - (a.age ?? 65))
const pensionSeries = pensionPots.map(p =>
  projectSeries(+p.value || 0, growthRateFor(classifyPot(p) === 'self-invested' ? 'pension-sipp' : 'pension-occupational-dc', _cma), _years))
const pensionsNeedReview = potsNeedingReview(pensionPots).length
```

- [ ] **Step 3: Replace the bare delta + single spark in the pension tile**

Subline (truthful composition) — render under the £ value:
```jsx
<div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
  across {pensionPots.length} pension{pensionPots.length !== 1 ? 's' : ''}{pensionsNeedReview ? ` · ${pensionsNeedReview} need review` : ''}
</div>
```
Replace the single sparkline/`TrajectoryBar` with the 3 projected lines:
```jsx
<MiniTrendLines series={pensionSeries} width={88} height={28} />
```
If a "+0.2%" style delta remains, give it a basis or remove it:
```jsx
{/* delta must state period + basis, else omit */}
<span style={{ fontSize: 10, color: 'var(--c-text3)' }}>projected growth · {(growthRateFor('pension-sipp', _cma) * 100).toFixed(1)}%/yr</span>
```

- [ ] **Step 4: Verify build + that the tile still navigates to the drill**

Run: `npm run build`
Expected: exit 0. Manual: tile still opens the pension drill (wired in Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat(pension): Home tile reveals composition (count, need-review, 3 trend-lines)"
```

---

### Task 7: Wire MyMoney drill → PensionSummaryDrill

**Files:**
- Modify: `src/screens/MyMoney.jsx` (inline PensionDrillDown, ~1880–2260)

- [ ] **Step 1: Read the current inline PensionDrillDown**

Run: `grep -n "PensionDrillDown\|selectedScheme\|monteCarloPOS\|normalisePos" src/screens/MyMoney.jsx`
Confirm where the inline drill renders and how it receives the pots/entity.

- [ ] **Step 2: Replace the inline drill body with the new summary drill**

Import at top of `MyMoney.jsx`:
```jsx
import { PensionSummaryDrill } from '../components/MyMoney/L3/PensionSummaryDrill.jsx'
```
Resolve the pots from the entity the same way HomeScreen does:
```jsx
const pensionPots = (entity?.assets?.sipp?.pensions || entity?.assets?.pensions || entity?.assets?.pension?.pots || [])
```
Render the new drill in place of the old scattered-card body (keep the existing open/close trigger + `personaId`):
```jsx
<PensionSummaryDrill
  entity={entity}
  pots={pensionPots}
  personaId={personaId}
  onClose={closePensionDrill}
  onHome={() => { closePensionDrill(); onNav?.('home') }}
/>
```
Delete the old inline blocks now superseded: the flat scheme list, the standalone LSA/Monte-Carlo/3-ways/tax-treatment cards, and the `normalisePos` helper (POS now lives, labelled+clamped, inside `DecumulationStrategy`). Leave a one-line comment marking the removal.

- [ ] **Step 3: Verify build + no dead references**

Run: `npm run build`
Expected: exit 0. Run: `grep -n "normalisePos\|selectedScheme" src/screens/MyMoney.jsx` → expect no remaining references (or only the new drill's).

- [ ] **Step 4: Commit**

```bash
git add src/screens/MyMoney.jsx
git commit -m "refactor(pension): route MyMoney drill into PensionSummaryDrill; drop scattered cards"
```

---

### Task 8: §9.5 snap gate + numeric tie-outs (MANDATORY — do not skip)

**Files:**
- Create: `0-Active/route-specs/.snap-verdict-pension-redesign.md`

Per CLAUDE.md §9.5 Gate 1–2. `npm run build` passing is necessary but NOT sufficient.

- [ ] **Step 1: Start dev server**

Use `mcp__Claude_Preview__preview_start` (config `.claude/launch.json`). `preview_list` to confirm.

- [ ] **Step 2: Navigate + capture the 4 surfaces**

For Bruce: Home (pension tile) → open drill (L2 summary) → open a pot (L3 leaf) → "Turn this into income" (Decide). At each surface, `preview_resize` to 375×812, 768×1024, 1280×800, toggling `colorScheme:'light'` and `'dark'`. `preview_screenshot` each → 4 surfaces × 3 × 2 = 24 shots. Save paths.

- [ ] **Step 3: Numeric tie-outs via `preview_eval`**

Scrape the DOM and assert:
- Sum of the 3 pot values shown in the L2 list === the tile/L2 header total (£850k).
- Sum of per-pot "tax-free cash from this pot" ≤ the L2 "Tax-free cash available" headline, and headline === min(total×0.25, LSA).
- Decide-view POS renders within [0,100] and carries its question label ("Chance it lasts to 95").
- L1 subline shows "3 pensions" and the need-review count matches `potsNeedingReview`.

- [ ] **Step 4: Cross-check against acceptance criteria + write verdict**

Write `0-Active/route-specs/.snap-verdict-pension-redesign.md` with embedded screenshot paths + per-criterion yes/no against spec §7. Include tie-out results. Verdict: BUILD-READY / NOT-READY.

- [ ] **Step 5: Commit**

```bash
git add "0-Active/route-specs/.snap-verdict-pension-redesign.md"
git commit -m "test(pension): §9.5 snap verdict — 4 surfaces × 3 viewports × 2 themes + tie-outs"
```

---

## Self-Review

**Spec coverage:** §1 defects → T6 (composition, trend-lines, labelled delta), T4 (grouping, no Pension badge, drag, ordered spine), T3 (per-pot leaf depth), T5 (Decide layer, labelled POS), T1 (withdrawal strategy + 2027 + legacy ring-fence + MPAA). §2 pattern → all. §3 layers → T6/T4/T3/T5. §5 data honesty → T3 "projection not past performance". §7 acceptance → T8. ✅ No gaps.

**Placeholder scan:** T4 Step 1 and T6 Step 1 are *resolve-exact-value* steps with concrete commands + expected output (TAX keys / tile location), not placeholders. The one `// TODO source-from-TAX` is a conditional fallback with an explicit PR-flag instruction. OK.

**Type consistency:** `classifyPot` returns `'self-invested'|'workplace-legacy'` everywhere (T1/T3/T4/T6). `buildDecumulationPlan` step shape `{action,title,reason,order}` consistent T1↔T5↔T3. `projectSeries(now,rate,years,contrib)` consistent T2↔T3↔T4↔T6. `MiniTrendLines({series,...})` takes `number[][]` everywhere. `monteCarloPOS` returns `.probability` (0–1) — handled once in T5. ✅

**Scope:** Single subsystem (pension surface). Propagation to other categories explicitly deferred to spec §8. ✅
