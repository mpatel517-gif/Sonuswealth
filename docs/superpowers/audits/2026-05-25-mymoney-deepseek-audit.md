# Sonuswealth Code Audit — MyMoney screen (2026-05-25)

## Your role

You are an expert React + UK fintech code reviewer. Audit the code below for bugs, data errors, logic mistakes, accessibility issues, plural-handling defects, financial-accuracy concerns, and misleading UI. The screen is part of a UK personal-wealth platform called Sonuswealth.

For each finding output ONE line in this exact format:

```
**[CRITICAL|HIGH|MEDIUM|LOW]** `FileName.jsx ~line X` — what's wrong — one-line fix
```

Group by severity (CRITICAL first). End with a count: "X critical, Y high, Z medium, W low".

Do not write prose between findings. Do not invent positive feedback. If the code has no bugs in a category, say "(none)" under that severity header.

## Specific suspect bugs the founder already reported — verify each

1. **Pension drill → Cost-of-Inaction routing collision.** User clicks the pension drill, then taps a "View detail / second page" affordance inside it, and ends up on the SAME visible screen as the Home tab's CoI drill. Find the routing / state-management cause.
2. **Sparklines and numbers are not drillable.** TripleAnchor £3.9m, Wealth/Risk scores, Monthly Cashflow numbers, wrapper-composition chips, Balance Sheet sparkline, sub-tile values. List each `file:line` where a number is rendered as bare `<span>` / `<div>` instead of wrapped in a tap-handler.
3. **"What moved this month" bars visually invisible.** £1k–£4k movements rendered against £3.9m opening balance. Find the bar-width scaling math and explain why bars are sub-pixel.
4. **PriorityCards possibly duplicated.** Verify whether MyMoney's "Emergency cover / Debt burden / Retirement funded / Estate efficiency / Tax shelter usage" cards exist anywhere on the Home screen.
5. **Savings & investments drill — "0 HOLDINGS" subtitle wrong.** Verify whether the holdings count matches the items the user actually has across legacy-schema and spec-schema personas.

## UK Financial Accuracy (2026/27) — check every numeric constant in the code

- ISA annual allowance £20,000?
- Pension Annual Allowance £60,000?
- Personal Allowance £12,570? (with taper above £100,000)
- Higher rate threshold £50,270?
- CGT rates 18% basic / 24% higher (NOT old 10/20)?
- CGT annual exempt amount £3,000?
- IHT nil-rate band £325,000, RNRB £175,000?
- LSA £268,275, LSDBA £1,073,100?
- MPAA £10,000?
- BPR cap £1m from April 2026, 50% above?
- BTL SDLT surcharge 5%?
- Pension IHT (Royal Assent 18 March 2026, effective April 2027) — flagged where relevant?

For any hardcoded number, flag if it should be sourced from a constants module instead.

## Component logic checklist

- All props declared are used.
- All `.map()` calls have `key` props.
- No `useMemo` with missing/wrong deps.
- No swallow-and-return-null try/catch hiding real errors.
- All `try{}` blocks initialise variables to safe sentinels (null, not 0, when 0 is a meaningful value).
- All SVG gradient IDs unique across instances.
- No internal engineering vocab visible to users (e.g. event names like `DRAWDOWN_SCHEDULE_SET`, taxonomy codes like `A · B`, engine confidence values like "low" / "high" in user copy).
- All `<a href>` tags that look like in-app navigation are real router calls, not browser navigations.

## CTA / Interaction checklist

- Every `onClick` is wired to a real function (not undefined).
- Every "tap" affordance shows `cursor: pointer` AND a handler.
- Every navigation CTA points to a destination that exists.
- No `disabled` state that blocks valid input.

## Text checklist

- No `undefined` / `NaN` / `[object Object]` in template literals.
- All dynamic values have fallback (`value ?? '—'`).
- Plural handling correct (1 loan vs 2 loans, 1 holding vs 2 holdings, 1 scheme vs 2 schemes, 1 property vs 2 properties).
- Grammatical correctness.

## Expected output format

Single ranked list per severity bucket. No prose. Be brutal.

---

## File 1: MyMoney screen — panel-stack routing (lines 2479-3502 of MyMoney.jsx)

```jsx
// State
const [drillPension, setDrillPension] = useState(false)
const [drillCat, setDrillCat] = useState(null) // 'investments' | 'property' | 'business' | 'protection' | 'liabilities' | null

// Triple anchor
<TripleAnchor
  netWorthVal={nw}
  fqTotal={fq.total}
  fqBand={fqBandObj}
  riskTotal={risk.total}
  riskBand={rkBandObj}
  onNetWorthTap={() => onDrillMetric?.('netWorth')}
  onWealthTap={() => onDrillMetric?.('wealthScore')}
  onRiskTap={onOpenRisk}
/>

// CoI ranked list
{ranked.slice(0, 4).map((r, i) => {
  const handleCoIRowClick = () => {
    if (r.id === 'pensions') setDrillPension(true)
    else if (r.id === 'investments' || r.id === 'cash' || r.id === 'alternatives') setDrillCat('investments')
    else if (r.id === 'property') setDrillCat('property')
    else if (r.id === 'business') setDrillCat('business')
    else if (r.id === 'protection') setDrillCat('protection')
    else if (r.id === 'liabilities') setDrillCat('liabilities')
    else if (r.id === 'obligations') onNav?.('flow')
  }
  // ...
})}

// Panel routing at bottom of MyMoney
{drillPension && (
  <PensionDrillDown
    entity={entity}
    personaId={personaId}
    onBack={() => setDrillPension(false)}
    onHome={onHome}
    onCommit={(eventOrSchedule) => {
      if (Array.isArray(eventOrSchedule)) handleCommitSchedule(eventOrSchedule)
      else if (eventOrSchedule?.type) handleNominationEvent(eventOrSchedule)
    }}
  />
)}
{drillCat === 'investments' && (
  <InvestmentsDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
)}
{drillCat === 'property' && (<PropertyDrillDown ... />)}
{drillCat === 'business' && (<BusinessDrillDown ... />)}
{drillCat === 'protection' && (<ProtectionDrillDown ... />)}
{drillCat === 'liabilities' && (<LiabilitiesDrillDown ... />)}
```

## File 2: PensionDrillDown commit button (line 2080-2089)

```jsx
<button onClick={() => isDirty && onCommit?.(schedule)}
  disabled={!isDirty}
  style={{ ... }}>
  {isDirty ? 'Commit DRAWDOWN_SCHEDULE_SET' : 'No changes'}
</button>
```

## File 3: TileGrid "What moved your net worth" waterfall (lines 448-551 of TileGrid.jsx)

```jsx
{Array.isArray(trajectory) && trajectory.length >= 2 && momDelta != null && (() => {
  const prev = +trajectory[trajectory.length - 2]?.value || 0
  const curr = +trajectory[trajectory.length - 1]?.value || 0
  const totalDelta = curr - prev

  const pensionSub = map.pensions?.subtotal     || 0
  const investSub  = map.investments?.subtotal  || 0
  const propSub    = map.property?.subtotal     || 0
  const cashSub    = map.cash?.subtotal         || 0
  const businessSub= map.business?.subtotal     || 0
  const altSub     = map.alternatives?.subtotal || 0
  const liabAbs    = Math.abs(totalLiabilities || 0)

  const weightedTotal = pensionSub + investSub + propSub + cashSub + businessSub + altSub + liabAbs
  if (totalDelta === 0 && weightedTotal === 0) return null

  const share = (w) => weightedTotal > 0 ? (w / weightedTotal) * totalDelta : 0
  const attrBars = [
    { label: 'Pensions',     value: share(pensionSub),  color: '#7AA7FF' },
    { label: 'Investments',  value: share(investSub),   color: 'var(--c-acc)' },
    { label: 'Property',     value: share(propSub),     color: '#FFB347' },
    { label: 'Cash',         value: share(cashSub),     color: '#34C759' },
    { label: 'Business',     value: share(businessSub), color: 'var(--c-acc)' },
    { label: 'Alternatives', value: share(altSub),      color: '#BA8CFF' },
    { label: 'Debt change',  value: share(liabAbs),     color: 'var(--c-coral, #FF6F7D)' },
  ].filter(b => Math.abs(b.value) >= 1)

  const attributed = attrBars.reduce((s, b) => s + b.value, 0)
  const residual = totalDelta - attributed
  if (Math.abs(residual) >= 1) attrBars.push({ label: 'Unattributed', value: residual, color: 'var(--c-text3)' })

  const bars = [
    { label: 'Opening', value: prev, isBase: true, color: 'var(--c-text3)' },
    ...attrBars,
    { label: 'Closing', value: curr, isBase: true, color: totalDelta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)' },
  ]

  const maxVal = Math.max(...bars.map(b => Math.abs(b.isBase ? b.value : b.value) + (b.isBase ? 0 : prev)))
  const barMaxW = 100

  return (
    <div>
      {bars.map((b, i) => {
        const barW = b.isBase
          ? (b.value / maxVal) * barMaxW
          : (Math.abs(b.value) / maxVal) * barMaxW
        // render bar with width: `${barW}%`
      })}
    </div>
  )
})()}
```

## File 4: SurplusTile — bare hero number (lines 1147-1243 of MyMoney.jsx)

```jsx
function SurplusTile({ entity }) {
  const m = monthlySurplus(entity)
  const surplus = m.surplus || -(m.deficit || 0)
  const pos = surplus >= 0
  const amt = Math.abs(surplus)
  const accentColor = pos ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'

  return (
    <FadeInOnMount className="sw-card" style={{...}}>
      <div style={{...}}>
        <span className="sw-eyebrow" style={{ flex: 1 }}>Monthly cash flow</span>
        <ProvenanceChip sources={['Your data', 'Apr 2026']} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: !pos ? 8 : 14 }}>
        <div className="sw-hero-md" style={{ color: accentColor }}>
          {pos ? '+' : '−'}<Num value={amt} format="currency" animate />
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.3 }}>
          {pos
            ? `left over after all costs · £${Math.round(amt * 12 / 1000)}k/yr to save or invest`
            : `spending exceeds income this month`}
        </div>
      </div>

      <CashFlowSankey m={m} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
        <MetricTile label="Monthly income" value={fmt(m.income || 0)} colour="var(--c-text)" />
        <MetricTile label="Essentials" value={fmt(m.essential || 0)} colour="var(--c-text2)" />
        <MetricTile label="Debt payments" value={fmt(m.debtService || 0)} colour="#FF6B6B" />
        <MetricTile label="Committed" value={fmt(m.committed || 0)} colour="var(--c-text2)" />
      </div>
    </FadeInOnMount>
  )
}
```

## File 5: DrillContextStub — Ask Sonu anchor (lines 19-95)

```jsx
export default function DrillContextStub({
  eyebrow, title, preview = null, bullets = [],
  askQuestion, askRoute = '/ask',
}) {
  const askHref = `${askRoute}?q=${encodeURIComponent(askQuestion || title)}`
  return (
    <div className="sw-card" style={{ ... }}>
      ...
      {askQuestion && (
        <a href={askHref} className="sw-press" style={{ ... }}>
          ☉ Ask Sonu about this
        </a>
      )}
    </div>
  )
}
```

## File 6: InvestmentsDrillDown — subtitle + items.length (lines 103-150)

```jsx
export default function InvestmentsDrillDown({ entity, personaId, onBack, onHome }) {
  const [selected, setSelected] = useState(null)
  const a = entity.assets || {}
  const items = a.investments || []

  const byWrapper = items.reduce((acc, it) => {
    const w = inferWrapper(it)
    acc[w] = (acc[w] || 0) + (+it.value || +it.balance || 0)
    return acc
  }, {})
  if (a.isa?.value != null) byWrapper.ISA = (byWrapper.ISA || 0) + (+a.isa.value || 0)
  else if (typeof a.isa === 'number') byWrapper.ISA = (byWrapper.ISA || 0) + (+a.isa || 0)
  if (a.portfolio?.value != null) byWrapper.GIA = (byWrapper.GIA || 0) + (+a.portfolio.value || 0)
  const total = Object.values(byWrapper).reduce((s, v) => s + v, 0)

  return (
    <OverlayShell title="Savings & investments · drill-down"
      subtitle={`${fmt(total)} · ${items.length} holdings`}
      onBack={onBack} onHome={onHome}>
      ...
    </OverlayShell>
  )
}
```

## File 7: LiabilitiesDrillDown subtitle (line 134-135)

```jsx
<OverlayShell title="What you owe · drill-down"
  subtitle={`${fmt(totalDebt)} total · ${allLoans.length} loans`}
```

## File 8: BusinessDrillDown subtitle (line 110-112)

```jsx
<OverlayShell title="Business assets · drill-down"
  subtitle={`${fmt(total)} · ${companies.length} co · ${shareSchemes.length} scheme`}
```

## File 9: PensionDrillDown — fragile try/catch (line 1779-1784)

```jsx
let ihtWithSchedule = 0, ihtCurrent = 0, ihtDelta = 0
try {
  ihtWithSchedule = ihtDynamic({ ...entity, drawdown: schedule[0]?.amount || 0 }, true).iht || 0
  ihtCurrent = ihtDynamic(entity, true).iht || 0
  ihtDelta = ihtCurrent - ihtWithSchedule
} catch { /* engine may not yet compute — silent */ }
```

## File 10: driver-engine fallback (lines 47-61)

```js
export function driver(entity, metric, level = 0) {
  if (!entity || !metric) return terminal(metric, 0)

  switch (metric) {
    case 'netWorth':       return drvNetWorth(entity, level)
    case 'wealthScore':    return drvWealthScore(entity, level)
    case 'riskScore':      return drvRiskScore(entity, level)
    case 'monthlySurplus': return drvSurplus(entity, level)
    case 'coi':            return drvCoI(entity, level)
    case 'plan:estate':    return drvPlanEstate(entity, level)
    case 'plan:gift':      return drvPlanGift(entity, level)
    case 'plan:tax':       return drvPlanTax(entity, level)
    default:               return terminal(metric, 0, 'Driver tree pending')
  }
}
```

## File 11: Dashboard — drill-stack overlay (lines 308-322 + 596-604 of Dashboard.jsx)

```jsx
const [detailStack, setDetailStack] = useState([])
const pushDetail = useCallback((metric) => {
  setDetailStack(prev => {
    const next = [...prev, { metric, label: metric }]
    recordDrill(tab, next)
    return next
  })
}, [tab])

{detailStack.length > 0 && (
  <DetailOverlay
    frame={driver(entity, detailStack[detailStack.length - 1].metric)}
    crumbs={detailStack.map(f => f.label || f.metric)}
    onDrill={pushDetail}
    onBack={popDetail}
    onClose={closeDetail}
  />
)}
```

## File 12: CategoryTile hero — bare £ number (lines 222-228)

```jsx
<div style={{
  fontSize: 24, fontWeight: 880, color: valueColor,
  letterSpacing: -0.5, lineHeight: 1, marginBottom: 4,
  fontVariantNumeric: 'tabular-nums',
}}>
  {isEmpty ? '—' : fmt(liability ? -Math.abs(total) : total)}
</div>
```

## File 13: WrapperCompositionBar segments (excerpt of MyMoney.jsx 781-905)

```jsx
{entries.map(([w, v]) => {
  return (
    <button key={w} onClick={() => onSegmentTap?.(isActive ? null : w)}
      className="sw-press"
      style={{ flex: v / grand, background: bg, opacity: baseOpacity, ... }}
      aria-label={`${isUnknown ? 'Unresolved wrapper' : w} ${fmt(v)}...`} />
  )
})}
```

## File 14: CliffEdgeWarning logic (lines 978-1036 of MyMoney.jsx)

```jsx
function CliffEdgeWarning({ entity }) {
  let ani = 0
  try { ani = calcANI(entity)?.ani || 0 } catch { return null }

  const cliff = 100_000
  const distance = cliff - ani

  if (distance > 20_000) return null

  const past = distance < 0
  const pensionToSolve = past ? Math.abs(distance) : distance
  const barFill = Math.min(100, (ani / cliff) * 100)
  ...
}
```

---

## Personas to test against

The codebase ships 7 fixture personas: `mrT-core`, `persona-a`, `persona-b`, `persona-c`, `persona-d`, `persona-e`, `persona-g`. Some store assets under legacy keys (`a.isa.value`, `a.portfolio.value`, `a.sipp.total`), others under spec keys (`a.investments[]`, `a.pensions[]`, `a.bank[]`). Audit code for both shapes and flag where one shape silently undercounts or hides items.

---

## Begin audit now. Output only the findings list — no preamble.
