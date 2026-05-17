# HomeScreen Action Fixes — Pension Flow · APQ Drills · Plan Progress · CoI Reconciliation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every broken action flow on HomeScreen that the founder has identified over 4 days: pension drawdown routes to a useless page, APQ drill panel is a dead list, plan progress shows 0%/On course contradiction, CoI £ doesn't connect to the pension drawdown action, and What-If queries produce generic DE responses.

**Architecture:** All fixes are in `src/screens/HomeScreen.jsx` except Task 3 (Cashflow funded ratio label, `src/screens/Cashflow.jsx`) and Task 5 (ScenarioIntake query instruction, `src/components/Home/ScenarioIntake.jsx`). Task 1 adds one new file: `src/components/Home/PensionDrawdownPanel.jsx`. No engine changes. No new routes. No TypeScript.

**Tech Stack:** React 18, inline styles, `src/engine/fq-calculator.js` functions (`ihtSippDelta`, `calcFQ`, `planFor`, `fmt`, `guardrail`, `netWorth`), CSS variables from `src/index.css`.

---

## Root Cause Summary (read before touching code)

| Symptom | Root cause | File:line |
|---|---|---|
| "Start pension drawdown" → Cashflow (income screen) | `ACTION_ROUTE_OVERRIDE['pension-drawdown'] = 'flow'` overrides engine's correct `screen: 'tax'` | `HomeScreen.jsx:116` |
| Tapping pension drawdown shows nothing useful | No dedicated panel — just blind tab navigation | — |
| "See all 6 →" panel rows do nothing | `APQDrillPanel` receives no `onNav` prop; rows have `cursor:default`, no handler | `HomeScreen.jsx:1361, 1053` |
| Plan progress: 0% but "On course" | Bruce's retirement plan `target` is `{ date, monthlyDrawdown }` not a number — `pct` always 0; `onTrack` defaults to `true` | `HomeScreen.jsx:667–670` |
| CoI £412k has no visible link to pension drawdown | Expanded action row shows `detail` text only; no formatted £ exposure or breakdown link | `HomeScreen.jsx:1593` |
| CoI drill "Pension drawdown strategy" row → Cashflow | `COI_DOMAIN_META.drawdown.screen = 'flow'` | `HomeScreen.jsx:886` |
| What-If queries → generic DE answers | Query has entity context but no instruction to return structured actionable steps | `ScenarioIntake.jsx:93–108` |

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/components/Home/PensionDrawdownPanel.jsx` | **Create** | Full-screen overlay: SIPP IHT exposure, countdown, drawdown plan, 4 specific steps, CTAs |
| `src/screens/HomeScreen.jsx` | Modify | Remove wrong override, wire PensionDrawdownPanel, fix APQDrillPanel, fix plan progress, fix CoI domain meta |
| `src/screens/Cashflow.jsx` | Modify | Fix "A HIGH FUNDED RATIO" label for ratio < 0.85 |
| `src/components/Home/ScenarioIntake.jsx` | Modify | Append structured-response instruction to every query |

---

## Task 1: PensionDrawdownPanel — dedicated overlay for the #1 CRIT action

**Files:**
- Create: `src/components/Home/PensionDrawdownPanel.jsx`
- Modify: `src/screens/HomeScreen.jsx`

**Context:** When a user taps "Start pension drawdown" → expands → "Show me how →", they currently land on the Cashflow income waterfall. This is wrong. They need a purpose-built panel that explains the SIPP IHT situation specifically for their data, shows a monthly drawdown target, and links to Tax & Estate for nominations and Timeline for trajectory. The engine already has all these numbers.

Key engine facts for Bruce Wayne (persona-a):
- `ihtSippDelta(entity)` = the IHT estate exposure from SIPP not being in drawdown
- `guardrail(entity)` = safe annual withdrawal rate
- `entity.plans` contains `{ id: 'plan-drawdown', target: { date: '2027-04-05', monthlyDrawdown: 8000, tfcStrategy: 'phased' } }`
- April 2027 deadline is hardcoded in the engine at `TAX.deadline = '2027-04-06'`
- `daysLeft()` in the engine = days until 6 Apr 2027

- [ ] **Step 1: Create `src/components/Home/PensionDrawdownPanel.jsx`**

```jsx
import { useMemo } from 'react'
import {
  ihtSippDelta, guardrail, netWorth, calcFQ, planFor, fmt,
} from '../../engine/fq-calculator.js'

function safe(fn, fb) { try { return fn() ?? fb } catch { return fb } }

function daysUntil(dateStr) {
  return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / 86_400_000))
}

export default function PensionDrawdownPanel({ entity, onClose, onNav }) {
  const ihtExposure   = useMemo(() => safe(() => ihtSippDelta(entity), 0),       [entity])
  const annualRate    = useMemo(() => safe(() => guardrail(entity) * 0.6, 0),     [entity])
  const monthlyRate   = Math.round(annualRate / 12)
  const days          = daysUntil('2027-04-06')
  const plan          = useMemo(() => safe(() => planFor(entity, 'retirement'), null), [entity])
  const planMonthly   = plan?.target?.monthlyDrawdown || monthlyRate || 0
  const tfcStrategy   = plan?.target?.tfcStrategy || 'phased'
  const sippVal       = useMemo(() => {
    const a = entity?.assets || {}
    const num = v => {
      if (typeof v === 'number') return v
      if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
      return +v?.total || +v?.value || 0
    }
    return num(a.sipp) + num(a.pension) + num(a.pensions)
  }, [entity])

  const STEPS = [
    {
      n: 1,
      title: 'Confirm drawdown start',
      body: `Contact your SIPP provider to begin drawdown. You don't have to draw anything yet — crystallising the pot removes it from your estate before April 2027.`,
      cta: null,
    },
    {
      n: 2,
      title: `Draw ${fmt(planMonthly)}/month (${tfcStrategy === 'phased' ? 'phased TFC' : 'lump sum'})`,
      body: `This rate keeps you within your personal allowance and avoids higher-rate tax on drawdown income. Phased TFC means you take 25% tax-free cash progressively rather than all at once.`,
      cta: null,
    },
    {
      n: 3,
      title: 'Update beneficiary nominations',
      body: 'Your SIPP nominations tell the provider who inherits the pot. Uncrystallised funds pass outside your estate — crystallised funds need nominations updated. Do this with your provider and record it.',
      cta: { label: 'Review nominations in Tax & Estate →', route: 'tax' },
    },
    {
      n: 4,
      title: 'See your retirement trajectory',
      body: 'Once drawdown starts, your projected funded ratio and retirement income change. Check Timeline to see how your plan holds up.',
      cta: { label: 'Go to Timeline →', route: 'timeline' },
    },
  ]

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'nw-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Start pension drawdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Urgency banner */}
        <div style={{
          background: 'rgba(255,59,48,0.10)',
          border: '1px solid rgba(255,59,48,0.35)',
          borderRadius: 16, padding: '14px 18px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>⚖</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#ff3b30', marginBottom: 2 }}>
              SIPP IHT deadline
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.5 }}>
              {days} days · 6 April 2027
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 3 }}>
              Pensions enter the IHT estate from this date. Finance Act 2026 enacted.
            </div>
          </div>
        </div>

        {/* Your exposure */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 16, padding: '14px 18px', marginBottom: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>Your SIPP / pension value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.5 }}>{fmt(sippVal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>IHT exposure if no drawdown</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ff3b30', letterSpacing: -0.5 }}>{ihtExposure > 0 ? fmt(ihtExposure) : 'None'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--c-sep)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>Your drawdown plan</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-acc)' }}>
              {fmt(planMonthly)}/month · {tfcStrategy === 'phased' ? 'Phased tax-free cash' : 'Lump-sum TFC'} strategy
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
              Keeps income within personal allowance · avoids higher-rate tax on drawdown
            </div>
          </div>
        </div>

        {/* 4 steps */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 8 }}>
          What to do — 4 steps
        </div>
        {STEPS.map(step => (
          <div key={step.n} style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 10,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              background: 'var(--c-acc)', color: '#0B1F3A',
              fontSize: 12, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step.n}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6, lineHeight: 1.3 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55 }}>
                {step.body}
              </div>
              {step.cta && (
                <button
                  onClick={() => { onClose(); onNav?.(step.cta.route) }}
                  style={{
                    marginTop: 10, padding: '8px 16px', borderRadius: 999,
                    background: 'var(--c-acc)', border: 'none',
                    color: '#0B1F3A', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {step.cta.label}
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '8px 0 12px' }}>
          Information only · Figures from your data · Not regulated financial advice · FCA boundary applies
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Import PensionDrawdownPanel in HomeScreen.jsx**

At the top of `src/screens/HomeScreen.jsx`, after the existing imports, add:
```jsx
import PensionDrawdownPanel from '../components/Home/PensionDrawdownPanel.jsx'
```

- [ ] **Step 3: Add localDrill state for pension panel**

In the `HomeScreen` default export, find `const [localDrill, setLocalDrill] = useState(null)` (around line 1337). The existing `localDrill` state handles `'networth'`, `'coi'`, `'apq'`. Add `'pension-drawdown'` handling.

Find the `drillFn` definition (around line 1339) and add the pension-drawdown case:

```js
const drillFn = (metric) => {
  if (metric === 'netWorth' || metric === 'networth') { setLocalDrill('networth');          return }
  if (metric === 'coi')                               { setLocalDrill('coi');               return }
  if (metric === 'apq' || metric === 'gaps')          { setLocalDrill('apq');               return }
  if (metric === 'pension-drawdown')                  { setLocalDrill('pension-drawdown');  return }
  const dimKey = typeof metric === 'string' ? metric.replace(/^wealth\./, '') : metric
  const DIM_KEYS = ['behaviour', 'capital', 'tax', 'protection', 'cashflow', 'debt', 'estate']
  if (DIM_KEYS.includes(dimKey)) { setStubMetric(dimKey); return }
  if (onDrillMetric) onDrillMetric(metric)
  else setStubMetric(metric)
}
```

- [ ] **Step 4: Render PensionDrawdownPanel in the return block**

In the main return block (around line 1356), find the drill panel renders and add:
```jsx
{localDrill === 'pension-drawdown' && (
  <PensionDrawdownPanel entity={entity} onClose={() => setLocalDrill(null)} onNav={onNav} />
)}
```

Place it alongside the other drill panels (after `{localDrill === 'apq' && ...}`).

- [ ] **Step 5: Fix ACTION_ROUTE_OVERRIDE — remove the bad override**

Find line 116: `'pension-drawdown':      'flow',`

Delete that line entirely. The engine at `fq-calculator.js:1168` correctly sets `screen: 'tax'`. The `safeRoute` function will now fall through to `action.screen = 'tax'`.

But we don't want a generic Tax & Estate landing either. The "Show me how →" button in `ActionsCard` calls `onNav?.(route)`. Change the ActionsCard expanded row to check if the action id is `'pension-drawdown'` and open the panel instead:

Find the "Show me how →" button in `ActionsCard` (around line 1597):
```jsx
{route && (
  <button onClick={e => { e.stopPropagation(); onNav?.(route) }} ...>
    Show me how →
  </button>
)}
```

Replace with:
```jsx
{route && (
  <button
    onClick={e => {
      e.stopPropagation()
      if (action.id === 'pension-drawdown') {
        onDrillMetric?.('pension-drawdown')
      } else {
        onNav?.(route)
      }
    }}
    style={{
      padding: '8px 16px', borderRadius: 999, background: 'var(--c-acc)',
      border: 'none', color: '#0B1F3A', fontSize: 12, fontWeight: 700,
      cursor: 'pointer', fontFamily: 'inherit',
    }}
  >
    Show me how →
  </button>
)}
```

- [ ] **Step 6: Fix COI_DOMAIN_META drawdown route**

Find line 886:
```js
drawdown: { label: 'Pension drawdown strategy', screen: 'flow' },
```
Change to:
```js
drawdown: { label: 'SIPP estate exposure', screen: 'tax' },
```
This fixes the CoI drill panel routing AND makes the label honest (it's the IHT delta, not general drawdown strategy).

- [ ] **Step 7: Verify**

1. Navigate to `http://localhost:5174/?demo=a`
2. Tap "Start pension drawdown" CRIT action row → it expands
3. Tap "Show me how →" → PensionDrawdownPanel opens (not Cashflow)
4. Panel shows: days countdown, SIPP value, IHT exposure, 4 steps, CTA buttons
5. Tap "Review nominations in Tax & Estate →" → panel closes, Tax & Estate tab opens
6. Tap CoI (£412k) → CoI drill panel → "SIPP estate exposure" row → tapping routes to Tax & Estate

- [ ] **Step 8: Commit**
```bash
git add src/components/Home/PensionDrawdownPanel.jsx src/screens/HomeScreen.jsx
git commit -m "feat: PensionDrawdownPanel — dedicated SIPP IHT action overlay, fixes pension-drawdown route"
```

---

## Task 2: APQDrillPanel — make every row actionable

**Files:**
- Modify: `src/screens/HomeScreen.jsx` lines 1000–1102

**Context:** The "See all 6 →" button opens `APQDrillPanel`. Currently rows have `cursor: 'default'` and no click handler. Users can see their priorities but can't act. This needs the same pattern as `ActionsCard` expanded rows: click → navigate to relevant tab.

- [ ] **Step 1: Add `onNav` to the APQDrillPanel render call**

Find line 1361 in the main return block:
```jsx
{localDrill === 'apq' && <APQDrillPanel entity={entity} onClose={() => setLocalDrill(null)} />}
```
Change to:
```jsx
{localDrill === 'apq' && (
  <APQDrillPanel entity={entity} onNav={onNav} onClose={() => setLocalDrill(null)} />
)}
```

- [ ] **Step 2: Update APQDrillPanel component signature**

Find the function definition at line 1000:
```js
function APQDrillPanel({ entity, onClose }) {
```
Change to:
```js
function APQDrillPanel({ entity, onNav, onClose }) {
```

- [ ] **Step 3: Make each row clickable with routing**

Find the row render (around line 1049–1092). Replace the inner `<div>` for each item with:

```jsx
{items.map((action, i) => {
  const route = ACTION_ROUTE_OVERRIDE[action.id] || action.screen || null
  const impact = action?.impact?.finioScore || action?.impact?.score || 0
  return (
    <div
      key={action.id || i}
      onClick={() => {
        if (action.id === 'pension-drawdown') {
          onClose()
          setLocalDrill('pension-drawdown')
          return
        }
        if (route && onNav) { onClose(); onNav(route) }
      }}
      style={{
        padding: '12px 0',
        borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
        cursor: route || action.id === 'pension-drawdown' ? 'pointer' : 'default',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}
    >
      <span style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
        background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
        fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {i + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
          {action.title || action.headline || '—'}
        </div>
        {(action.context || action.detail || action.why) && (
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 6 }}>
            {action.context || action.detail || action.why}
          </div>
        )}
        {impact > 0 && (
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 100,
            background: 'rgba(93,219,194,0.12)', border: '1px solid rgba(93,219,194,0.25)',
            fontSize: 10, fontWeight: 700, color: 'var(--c-acc)',
          }}>
            +{impact} Wealth Score
          </span>
        )}
      </div>
      {(route || action.id === 'pension-drawdown') && (
        <span style={{ color: 'var(--c-text3)', fontSize: 18, flexShrink: 0, alignSelf: 'center' }}>›</span>
      )}
    </div>
  )
})}
```

Note: `APQDrillPanel` is defined BEFORE `ActionsCard` in the file, so `setLocalDrill` is NOT in scope. Instead, pass an `onPensionDrill` prop or restructure. Simpler fix: for `pension-drawdown` row, just navigate to `'tax'` (since we can't open the panel from inside APQDrillPanel without lifting state). Replace the pension-drawdown special case in the onClick with:
```js
if (action.id === 'pension-drawdown') { onClose(); onNav?.('tax'); return }
```
The full PensionDrawdownPanel is accessible from the Home action row — the APQ drill list routes to Tax & Estate as a fallback.

- [ ] **Step 4: Verify**

1. On Home screen tap "See all 6 →"
2. APQ drill panel opens — all rows now show "›" chevron
3. Tap "Start pension drawdown" → panel closes, Tax & Estate opens
4. Tap "Arrange life insurance in trust" → panel closes, My Money opens
5. Tap "Use £20k ISA allowance" → panel closes, My Money opens

- [ ] **Step 5: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "fix: APQDrillPanel — all rows actionable with tab routing"
```

---

## Task 3: Plan Progress — fix 0%/On course contradiction

**Files:**
- Modify: `src/screens/HomeScreen.jsx` lines 649–698 (`PlanProgressStrip`)

**Context:** Bruce Wayne's retirement plan has `target: { date: '2027-04-05', monthlyDrawdown: 8000, tfcStrategy: 'phased' }`. The current code tries to read `plan.target.netWorth || plan.target.value` — neither exists, so `target = 0`, `pct = 0`. The `onTrack` defaults to `true`, producing "0% · On course" which is contradictory.

The right display for a deadline-based drawdown plan: show the time elapsed toward the deadline (as a progress proxy), show the monthly drawdown target, and only show "On course" if `entity.drawdown > 0` (drawdown actually started).

- [ ] **Step 1: Replace `PlanProgressStrip` with a version that handles date-target plans**

Find the `PlanProgressStrip` function (line 649). Replace the entire function:

```jsx
function PlanProgressStrip({ entity, onNav }) {
  const plan = useMemo(() => safe(() => planFor(entity, 'retirement'), null), [entity])

  if (!plan) return (
    <div
      onClick={() => onNav?.('timeline')}
      style={{
        margin: '14px 16px 0', padding: '14px 18px',
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', flexShrink: 0 }}>Plan progress</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text2)' }}>
        No active plan — set one in the <strong style={{ color: 'var(--c-text)' }}>Timeline</strong> tab.
      </div>
      <span style={{ color: 'var(--c-acc)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Set plan →</span>
    </div>
  )

  // Detect plan type: date-target (drawdown) vs value-target (accumulation)
  const targetDate    = plan.target?.date || plan.horizonDate || null
  const targetValue   = typeof plan.target === 'number'
    ? plan.target
    : (plan.target?.netWorth || plan.target?.value || plan.targetValue || 0)
  const monthlyTarget = plan.target?.monthlyDrawdown || 0
  const drawdownStarted = (entity?.drawdown || 0) > 0

  const planName = plan.name || plan.label || plan.goal || 'Retirement plan'

  // For date-target plans: progress = time elapsed from plan creation to deadline
  let pct = 0
  let statusLabel = 'Not started'
  let statusColor = 'var(--c-text3)'

  if (targetDate) {
    const deadline     = new Date(targetDate)
    const created      = plan.createdAt ? new Date(plan.createdAt) : new Date(Date.now() - 86_400_000 * 365)
    const totalSpan    = deadline - created
    const elapsed      = Date.now() - created
    const timeProgress = Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)))

    if (drawdownStarted) {
      pct = timeProgress
      statusLabel = 'In progress'
      statusColor = 'var(--c-acc)'
    } else {
      pct = 0
      statusLabel = 'Action required'
      statusColor = 'var(--c-acc3)'
    }
  } else if (targetValue > 0) {
    const current = plan.progress?.current ?? plan.current ?? 0
    pct = Math.min(100, Math.round((current / targetValue) * 100))
    const onTrack = plan.progress?.onTrack ?? plan.onTrack ?? false
    statusLabel = onTrack ? 'On course' : 'Behind plan'
    statusColor = onTrack ? 'var(--c-acc)' : 'var(--c-acc3)'
  }

  const daysLeft = targetDate
    ? Math.max(0, Math.ceil((new Date(targetDate) - new Date()) / 86_400_000))
    : null

  return (
    <div style={{ margin: '14px 16px 0', padding: '14px 18px', background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', marginBottom: 2 }}>Plan progress</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {planName}
            {monthlyTarget > 0 && ` · ${fmt(monthlyTarget)}/month target`}
            {targetValue > 0 && ` · ${fmt(targetValue)} target`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {daysLeft !== null && (
            <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{daysLeft} days</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--c-surface2)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: drawdownStarted || (!targetDate && pct > 0) ? 'var(--c-acc)' : 'var(--c-acc3)',
          borderRadius: 100, transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 6 }}>
        {targetDate && !drawdownStarted
          ? `Drawdown not yet started — ${daysLeft} days until deadline`
          : targetDate && drawdownStarted
            ? `Drawdown active · ${daysLeft} days to deadline`
            : targetValue > 0
              ? <><strong style={{ color: 'var(--c-text)' }}>{pct}%</strong> · {fmt(plan.progress?.current ?? 0)} of {fmt(targetValue)}</>
              : null
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

1. Navigate to `http://localhost:5174/?demo=a`
2. Plan strip at bottom of Home screen now shows:
   - "Retirement plan · £8,000/month target" (not "0% · On course")
   - Status: "Action required" (orange) since `entity.drawdown = 0`
   - Bar: empty (red/orange) — honest, not falsely "0% On course"
   - Sub text: "Drawdown not yet started — 324 days until deadline"

- [ ] **Step 3: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "fix: PlanProgressStrip — handle date-target drawdown plans, remove false 0%/On course"
```

---

## Task 4: Cashflow funded ratio label — fix "A HIGH FUNDED RATIO" for 0.32

**Files:**
- Modify: `src/screens/Cashflow.jsx`

**Context:** Screenshot shows `0.32` labelled "A HIGH FUNDED RATIO". The `FundedRatioGauge` component (in `src/components/Cashflow/FundedRatioGauge.jsx`) correctly returns "Under-funded" for ratio < 0.85. The bug is in `Cashflow.jsx`'s local scoring or label rendering — there's a separate `fundedRatioScore` computation and metrics label map.

- [ ] **Step 1: Find the "A HIGH FUNDED RATIO" text in Cashflow.jsx**

```bash
grep -n "HIGH\|high funded\|A HIGH\|fundedRatioScore\|frRatio\|frLabel\|tier\|Tier" src/screens/Cashflow.jsx | head -30
```

Read the output to find exactly where the label comes from. It will be one of:
- A tier label based on `fundedRatioScore` (a 0–100 score derived from the ratio)
- A hardcoded label applied when score > some threshold

- [ ] **Step 2: Fix the label logic**

Once you find the label source, the fix is: a funded ratio < 0.85 (< 85% coverage) is "Under-funded" or "Below target" — never "High". The label must match the visual. Apply the same thresholds as `FundedRatioGauge.statusFor()`:

```js
function frLabel(ratio) {
  if (ratio < 0.85) return 'Under-funded'
  if (ratio < 1.0)  return 'Approaching target'
  if (ratio < 1.1)  return 'On track'
  return 'Over-funded'
}
```

Replace the incorrect label string or tier lookup with this function called with the actual `fr.ratio` value.

- [ ] **Step 3: Verify**

1. Navigate to `http://localhost:5174/?demo=a` → Cashflow tab
2. Scroll to the funded ratio section
3. Should now show "Under-funded" (not "A HIGH FUNDED RATIO") for Bruce Wayne's 0.32 ratio
4. Context text "Plan target is more than current trajectory can cover." should remain (it's already correct)

- [ ] **Step 4: Commit**
```bash
git add src/screens/Cashflow.jsx
git commit -m "fix: Cashflow funded ratio label — 0.32 is Under-funded not High"
```

---

## Task 5: ScenarioIntake — structured 4-option response from DE

**Files:**
- Modify: `src/components/Home/ScenarioIntake.jsx`

**Context:** The ScenarioIntake already prepends entity financial context (age, NW, SIPP, income, scores) before the query. But the DE returns a generic narrative response. The founder wants 4 specific, actionable options that reflect the user's projected financial status during the what-if period. Fix: append a structured-response instruction to every query so the DE knows to return actionable options.

- [ ] **Step 1: Find `buildEnrichedQuery` in ScenarioIntake.jsx**

It's at approximately line 93. The function currently returns:
```js
return ctx + enriched
```
where `ctx` = financial context preamble, `enriched` = base query + intake answers.

- [ ] **Step 2: Append response instruction**

Change the return to:
```js
const instruction = `

Please structure your response as 4 specific, actionable options for my situation. For each option:
1. Name the action clearly
2. State the financial impact in £ or % terms using my actual numbers above
3. Note the timing and urgency
4. Flag any tax or regulatory deadline I need to know about

Base all figures on my financial context above. Do not use placeholder amounts.`

return ctx + enriched + instruction
```

- [ ] **Step 3: Verify**

1. On Home screen, tap "What if I retired 5 years earlier?" → ScenarioIntake opens
2. Answer 3+ questions → tap "Explore this scenario →"
3. DE overlay opens with the query
4. Response should now contain 4 structured options with specific figures (not a generic narrative)

- [ ] **Step 4: Commit**
```bash
git add src/components/Home/ScenarioIntake.jsx
git commit -m "feat: ScenarioIntake — append structured 4-option response instruction to DE query"
```

---

## Task 6: Brand fix — "Sonuswealth" → "Caelixa" in DimExplainerStub

**Files:**
- Modify: `src/screens/HomeScreen.jsx` line 841

**Context:** DimExplainerStub eyebrow reads "Sonuswealth Wealth Score". Per §4 / D-NAME-1, the user-facing product name is **Caelixa**. "Sonuswealth" must not appear in any user-visible string.

- [ ] **Step 1: Fix the label**

Find line 841:
```jsx
Sonuswealth Wealth Score — {label}
```
Change to:
```jsx
Caelixa Wealth Score — {label}
```

- [ ] **Step 2: Scan for any other "Sonuswealth" in HomeScreen.jsx**

```bash
grep -n "Sonuswealth" src/screens/HomeScreen.jsx
```

Fix any additional occurrences found.

- [ ] **Step 3: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "fix: replace Sonuswealth with Caelixa in DimExplainerStub (D-NAME-1)"
```

---

## Self-Review

**Spec coverage:**
- ✅ "Start pension drawdown → screen 2 doesn't make sense" — Task 1: PensionDrawdownPanel replaces generic routing
- ✅ "CoI pill doesn't reconcile" — Task 1 Step 6: CoI domain label fixed + routes to Tax & Estate
- ✅ "All items drillable and actionable" — Task 2: APQDrillPanel rows now routable
- ✅ "Plan progress 0%/On course contradiction" — Task 3: date-target plan handled correctly
- ✅ "0.32 labelled HIGH FUNDED RATIO" — Task 4: label logic fixed in Cashflow
- ✅ "What-if → generic DE response" — Task 5: structured 4-option instruction appended
- ✅ Brand violation "Sonuswealth" — Task 6: fixed

**Placeholder scan:** Task 4 Step 1 requires a grep to find the exact line before editing — this is intentional (Cashflow.jsx is large and the exact line number must be confirmed at execution time). All other steps have complete code.

**Type consistency:** `onNav`, `onClose`, `entity`, `onDrillMetric` prop names match the existing patterns in HomeScreen.jsx throughout. `drillFn` is the local name for what's passed as `onDrillMetric` to children. `safe()` helper is defined at line 51 in HomeScreen and in PensionDrawdownPanel independently (copied pattern — no import needed, keeps component self-contained).
