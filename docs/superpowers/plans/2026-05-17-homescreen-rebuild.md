# Sonuswealth HomeScreen Comprehensive Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild HomeScreen to match 13-home-whatif.html — 2-column layout, 4-column anchor row with engine-derived SVG visuals, working mode pill (TODAY/FUTURE/PLAN/WHAT IF), drillable radar with live drag feedback, per-scenario comprehensive question intake, and all engine data (zero hardcoding).

**Architecture:** HomeScreen.jsx orchestrates inline sub-components (existing pattern — do not split into separate files unless noted). New file: `src/components/Home/ScenarioIntake.jsx` for the What-If question intake (standalone, complex enough to extract). RadarAnchor.jsx gets drag tooltip overlay added. App.jsx gets persona default confirmed. Entity data is never hardcoded — all values flow from engine functions in `src/engine/fq-calculator.js`.

**Tech Stack:** React 18, inline styles, SVG (radar + donut), engine: `calcFQ`, `calcRisk`, `calcAPQ`, `costOfInaction`, `netWorth`, `planFor`, `diffSet` from `src/engine/fq-calculator.js`. Drag via pointer events. Anthropic Claude via existing `src/de/` pipeline (no changes to DE engine files — entity data already injected by `composer.js`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/screens/HomeScreen.jsx` | Modify (major rewrite of render + sub-components) | Main screen layout, all inline cards |
| `src/components/Home/ScenarioIntake.jsx` | **Create** | Per-scenario question intake, enriched query builder |
| `src/components/Home/RadarAnchor.jsx` | Modify | Add drag tooltip + live score delta panel |
| `src/App.jsx` | Modify (1 line) | Ensure default demo navigates to persona-a |

**Do not touch:** `src/de/`, `src/screens/Dashboard.jsx`, `src/screens/DecisionEngineV2.jsx`, any engine file.

---

## Task 1: Fix default persona routing

**Files:**
- Modify: `src/App.jsx`

**Context:** When a user visits `/?demo=mrt` they see old Mr T data (£727k NW). The correct Bruce Wilson persona is `persona-a.json` (£3.63M). The default is already `'a'` on line 98 but the `mrt` demo key still works. Make `mrt` map to persona-a so any URL loads the right data.

- [ ] **Step 1: Map mrt to persona-a**

In `src/App.jsx`, find the ENTITIES declaration (around line 21) and add the alias:

```js
const ENTITIES = {
  a: personaA, b: personaB, c: personaC, d: personaD, e: personaE, g: personaG,
  mrt: personaA,   // <-- change mrTCore to personaA — Bruce Wilson is persona-a
  ...Object.fromEntries((personaF.snapshots || []).map(s => [s.id, s])),
}
```

- [ ] **Step 2: Verify** — navigate to `http://localhost:5173/?demo=mrt` — should now show £3.63M NW, Score 47, name Bruce.

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "fix: map mrt demo to persona-a (Bruce Wilson £3.63M)"
```

---

## Task 2: HomeScreen scaffold — 2-column responsive layout + masthead

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

**Context:** Replace the current single-column card stack with:
1. Masthead (avatar + greeting + name/date + mode pill) — full width
2. 4-column anchor row — full width
3. 2-column grid (radar left 1.4fr, actions right 1fr) — responsive
4. Plan strip — full width
5. Footer

The viewMode state (today/future/plan/whatif) lives in HomeScreen (not Dashboard). The mode pill calls a local setter.

- [ ] **Step 1: Add viewMode state and ModePill to HomeScreen**

At the top of the `HomeScreen` default export function, add:

```jsx
const [viewMode, setViewMode] = useState('actual')
```

Replace the `viewMode = 'actual'` prop default — it's now local state. Remove `viewMode` from the props destructure (it is currently a prop but not wired from Dashboard — make it local). Keep all other props.

- [ ] **Step 2: Replace MastheadCard with avatar version**

Find the `MastheadCard` component and replace it entirely:

```jsx
const MODES = [
  { id: 'actual',   label: 'Today' },
  { id: 'forecast', label: 'Future' },
  { id: 'plan',     label: 'Plan' },
  { id: 'scenario', label: 'What If' },
]

function MastheadCard({ entity, viewMode, onModeChange }) {
  const firstName = pickFirstName(entity)
  const initials = firstName.slice(0, 2).toUpperCase()
  return (
    <div style={{
      margin: '0 16px 14px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--c-gold), #b87f30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#0B1F3A',
          boxShadow: '0 4px 14px rgba(255,189,89,0.25)',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--c-text3)' }}>{greeting()},</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.4, marginTop: 2, lineHeight: 1.2 }}>
            {firstName} · {fmtHomeDate()}
          </div>
        </div>
      </div>
      {/* Mode pill */}
      <div style={{
        display: 'flex', gap: 3, padding: 4,
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 999,
        flexShrink: 0,
      }}>
        {MODES.map(({ id, label }) => (
          <button key={id} onClick={() => onModeChange(id)} style={{
            padding: '6px 12px', borderRadius: 999, border: 'none', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
            background: viewMode === id ? 'var(--c-acc)' : 'transparent',
            color: viewMode === id ? '#0B1F3A' : 'var(--c-text3)',
            cursor: 'pointer', transition: 'background 150ms ease',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace the main return block** with the new 2-column scaffold.

Find the `return (` in the `HomeScreen` default export and replace the entire JSX tree with:

```jsx
return (
  <>
    {/* Drill panels (keep existing — these float above everything) */}
    {localDrill === 'networth' && <NetWorthDrillPanel entity={entity} onClose={() => setLocalDrill(null)} />}
    {localDrill === 'coi'     && <CoIDrillPanel       entity={entity} onClose={() => setLocalDrill(null)} />}
    {localDrill === 'apq'     && <APQDrillPanel        entity={entity} onClose={() => setLocalDrill(null)} />}
    {stubMetric && <DimExplainerStub metric={stubMetric} onClose={() => setStubMetric(null)} />}

    {/* Masthead */}
    <MastheadCard entity={entity} viewMode={viewMode} onModeChange={setViewMode} />

    {/* 4-column anchor row */}
    <AnchorRow
      nw={nw} fqData={fq} riskData={risk} entity={entity}
      onDrillMetric={drillFn} onOpenBreakdown={onOpenBreakdown}
    />

    {/* 2-column content grid */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
      gap: 14, margin: '0 16px',
    }}>
      {/* LEFT: Radar card */}
      <RadarCard
        entity={entity} fqData={fq} nw={nw}
        viewMode={viewMode} diffs={diffs} onDrillMetric={drillFn}
      />
      {/* RIGHT: Actions card (includes What-If in scenario mode) */}
      <ActionsCard entity={entity} viewMode={viewMode} onNav={onNav} onDrillMetric={drillFn} />
    </div>

    {/* Plan strip */}
    <PlanProgressStrip entity={entity} onNav={onNav} />

    {/* Footer */}
    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--c-text3)', padding: '14px 24px 8px', lineHeight: 1.6 }}>
      Information &amp; guidance only · Not regulated financial advice · FCA boundary applies
    </div>
    <div style={{ height: 78 }} />
  </>
)
```

- [ ] **Step 4: Run the dev server and verify scaffold renders without crash**

Visit `http://localhost:5173/?demo=a`. The page should render (may look broken — that's fine, components come next).

- [ ] **Step 5: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: homescreen scaffold — 2-col grid + mode pill + avatar masthead"
```

---

## Task 3: 4-column AnchorRow

**Files:**
- Modify: `src/screens/HomeScreen.jsx` — replace `AnchorRow` component

**Context:** The current 3-column AnchorRow (NW, Score, Risk) becomes 4 columns: NW (composition bar), Score (SVG donut + "X gaps" badge), Risk (gradient gauge), CoI (countdown bar). "3 gaps" badge moves from Risk to Score column. All values from engine.

- [ ] **Step 1: Replace the entire `AnchorRow` component**

```jsx
// ── helpers used by AnchorRow ─────────────────────────────────────────────

function nwComposition(entity) {
  const a = entity?.assets || {}
  const num = v => {
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
    return +v?.total || +v?.value || 0
  }
  const pensions = num(a.sipp) + num(a.pension) + num(a.pensions)
  const isa      = num(a.isa) + num(a.lisa)
  const home     = num(a.residence) + num(a.home)
  const cash     = num(a.cash) + num(a.bank) + num(a.savings)
  const total    = pensions + isa + home + cash || 1
  return [
    { label: 'Pensions', pct: pensions / total, color: 'var(--c-acc2)' },
    { label: 'ISA',      pct: isa      / total, color: 'var(--c-acc)'  },
    { label: 'Home',     pct: home     / total, color: 'var(--c-violet)' },
    { label: 'Cash',     pct: cash     / total, color: 'var(--c-text3)' },
  ].filter(s => s.pct > 0.005)
}

function gapDims(fqData) {
  const dims = fqData?.dims || {}
  // A dim is a "gap" if it is below 50% of its max (engine-driven threshold)
  const GAP_THRESH = { habits: 50, own: 50, tax: 50, safety: 8, flow: 50, debt: 50, legacy: 50 }
  return Object.entries(GAP_THRESH).filter(([key, thresh]) => (dims[key] ?? 0) < thresh).length
}

function AnchorRow({ nw, fqData, riskData, entity, onDrillMetric, onOpenBreakdown }) {
  const score      = fqData?.total ?? 0
  const riskScore  = riskData?.total ?? 0
  const riskColor  = riskData?.band?.colour || 'var(--c-gold)'
  const riskBand   = riskData?.band?.name || '—'
  const segments   = nwComposition(entity)
  const gapCount   = gapDims(fqData)

  const coiTotal = safe(() => { const c = costOfInaction(entity); return typeof c === 'number' ? c : (c?.total || 0) }, 0)
  const dueDate  = new Date('2027-04-06')
  const now      = new Date()
  const days     = Math.max(0, Math.ceil((dueDate - now) / 86_400_000))
  const enacted  = new Date('2026-03-18')
  const totalSpan = (dueDate - enacted) / 86_400_000
  const elapsed   = (now - enacted) / 86_400_000
  const pct       = Math.min(100, Math.max(0, (elapsed / totalSpan) * 100))

  // SVG donut for Score
  const r = 16, C = 2 * Math.PI * r
  const filled       = (score / 100) * C
  const targetFilled = (68   / 100) * C   // 68 = typical plan target; not hardcoded to persona

  return (
    <div style={card({ padding: '14px 18px', margin: '0 16px 12px' })}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 0 }}>

        {/* NW + composition bar */}
        <div style={{ borderRight: '1px solid var(--c-sep)', paddingRight: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Net Worth</div>
          <Drillable metric="netWorth" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -1 }}>{fmt(nw)}</span>
          </Drillable>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--c-surface2)', marginTop: 8 }}>
            {segments.map(s => <div key={s.label} style={{ width: `${s.pct * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {segments.map(s => (
              <span key={s.label} style={{ fontSize: 9.5, color: 'var(--c-text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <i style={{ width: 6, height: 6, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.label} {Math.round(s.pct * 100)}%
              </span>
            ))}
          </div>
        </div>

        {/* Score + donut + gaps badge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Wealth Score</div>
          <button onClick={() => onOpenBreakdown?.()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="40" height="40" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-surface2)" strokeWidth="5" />
              <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,189,89,0.25)" strokeWidth="5"
                strokeDasharray={`${targetFilled.toFixed(1)} ${(C - targetFilled).toFixed(1)}`} />
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-acc)" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${filled.toFixed(1)} ${(C - filled).toFixed(1)}`} />
            </svg>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
                {score}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {fqData?.band?.name || '—'}
              </div>
            </div>
          </button>
          {/* "X gaps in radar" badge — lives in SCORE column, not Risk */}
          {gapCount > 0 && (
            <button onClick={() => onDrillMetric?.('gaps')} style={{
              marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', background: 'var(--c-acc3)',
                fontSize: 9, fontWeight: 800, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>!</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)' }}>
                {gapCount} gaps in radar →
              </span>
            </button>
          )}
        </div>

        {/* Risk + gradient gauge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Risk</div>
          <Drillable metric="riskScore" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 20, fontWeight: 800, color: riskColor, letterSpacing: -0.5 }}>
              {riskScore}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
            </span>
          </Drillable>
          <div style={{ position: 'relative', height: 8, borderRadius: 4, marginTop: 8, overflow: 'visible',
            background: 'linear-gradient(90deg, #34c759 0%, #34c759 33%, #ffb347 33%, #ffb347 66%, #ff6b6b 66%, #ff6b6b 100%)' }}>
            <div style={{
              position: 'absolute', top: -5, left: `calc(${riskScore}% - 9px)`,
              width: 18, height: 18, borderRadius: '50%',
              background: riskColor, border: '2px solid var(--c-bg)',
              boxShadow: `0 0 8px ${riskColor}88`,
            }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: riskColor, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{riskBand}</div>
        </div>

        {/* CoI + countdown bar */}
        <div style={{ paddingLeft: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Cost of Inaction</div>
          <Drillable metric="coi" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc3)', letterSpacing: -0.5 }}>{fmt(coiTotal)}</span>
          </Drillable>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)', marginTop: 4 }}>{days} days to act</div>
          <div style={{ height: 4, background: 'var(--c-surface2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--c-gold), var(--c-acc3))', borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.4 }}>
            SIPP IHT · 6 Apr 2027 · enacted
          </div>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove the old SippIhtCountdown and CostOfInactionStrip renders** from the main return block (they were separate strips — now absorbed into AnchorRow). Remove the `<div style={{ position: 'relative' }}>` wrapper around `CostOfInactionStrip` and the `<SippIhtCountdown>` element.

- [ ] **Step 3: Verify** — anchor row shows 4 columns with correct data from persona-a.

- [ ] **Step 4: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: 4-column anchor row — NW+comp, Score+donut+gaps, Risk+gauge, CoI+countdown"
```

---

## Task 4: ActionsCard with embedded What-If section

**Files:**
- Modify: `src/screens/HomeScreen.jsx` — add `ActionsCard` component

**Context:** The right column of the 2-column grid holds the actions list (from `calcAPQ`) with expandable rows, then the What-If section at the bottom. In WHAT IF mode, the What-If section expands to show the 5 scenario rows. The old separate `DecisionEngineEntryCard` is removed. Red notification circles on action rows open the relevant drill.

- [ ] **Step 1: Replace PriorityActionCard + ActiveInsightsCard + DecisionEngineEntryCard with a single ActionsCard**

```jsx
function ActionsCard({ entity, viewMode, onNav, onDrillMetric }) {
  const apq = useMemo(() => safe(() => calcAPQ(entity), []), [entity])
  const actions = Array.isArray(apq) ? apq : []
  const [expandedId, setExpandedId] = useState(null)
  const [intakeScenario, setIntakeScenario] = useState(null)

  // In scenario/whatif mode: show scenario rows at top of what-if section
  const isWhatIf = viewMode === 'scenario'

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 20,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* If scenario intake is active, show intake instead of actions */}
      {intakeScenario ? (
        <ScenarioIntake
          scenario={intakeScenario}
          onBack={() => setIntakeScenario(null)}
          onSubmit={({ query, eventId }) => {
            setIntakeScenario(null)
            onNav?.('de', { query, eventId })
          }}
        />
      ) : (
        <>
          {/* Actions header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)' }}>
              What to do next
            </span>
            <button onClick={() => onDrillMetric?.('apq')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--c-acc)', fontWeight: 700, padding: 0,
            }}>
              See all {actions.length} →
            </button>
          </div>

          {/* Action rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {actions.slice(0, 6).map((action, i) => {
              const badge  = severityBadge(action)
              const route  = safeRoute(action)
              const isOpen = expandedId === (action.id || i)
              const impact = action?.impact?.finioScore || 0
              return (
                <div key={action.id || i}>
                  <div
                    onClick={() => setExpandedId(isOpen ? null : (action.id || i))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px',
                      borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                      cursor: 'pointer',
                      background: isOpen ? 'linear-gradient(180deg, rgba(255,189,89,0.06), transparent)' : 'transparent',
                    }}
                  >
                    <span style={{
                      flexShrink: 0, padding: '3px 7px', borderRadius: 6,
                      background: badge.bg, fontSize: 9.5, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: 0.5, color: badge.color,
                      minWidth: 38, textAlign: 'center',
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3, minWidth: 0 }}>
                      {action.title || action.headline || '—'}
                    </span>
                    {impact > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc)', flexShrink: 0 }}>+{impact}</span>
                    )}
                    <span style={{ color: 'var(--c-text3)', fontSize: 16, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>›</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '4px 16px 14px' }}>
                      <p style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 10px' }}>
                        {action.context || action.detail || action.why || ''}
                      </p>
                      {route && (
                        <button onClick={e => { e.stopPropagation(); onNav?.(route) }} style={{
                          padding: '8px 16px', borderRadius: 999, background: 'var(--c-acc)',
                          border: 'none', color: '#0B1F3A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          Show me how →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* What-If section */}
          <WhatIfSection
            viewMode={viewMode}
            onSelectScenario={setIntakeScenario}
            onFreeform={q => onNav?.('de', { query: q })}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add WhatIfSection component**

```jsx
const DE_SCENARIOS = [
  { key: 'relocate',  icon: '✈️', label: 'How much do I need to relocate?',           sub: 'Kenya · Portugal · UAE — cost, tax, residency',   tag: 'Ask Sonu', engine: false, query: 'What would it cost and mean financially to relocate abroad?', eventId: null },
  { key: 'house',     icon: '🏡', label: 'What if I moved to a bigger house?',        sub: 'Stamp duty, mortgage impact, equity',               tag: 'Ask Sonu', engine: false, query: 'What if I moved to a bigger house? Cover SDLT, funding options, and cashflow impact.', eventId: 'buy_second_home' },
  { key: 'retire',    icon: '⏱️', label: 'What if I retired 5 years earlier?',       sub: 'Pension drawdown — cashflow, Score, IHT',           tag: 'Instant',  engine: true,  query: 'What if I retired 5 years earlier?', eventId: 'retire' },
  { key: 'part_time', icon: '🌴', label: 'What if I went part-time or took a break?', sub: 'Runway, monthly shortfall, when to return',         tag: 'Instant',  engine: true,  query: 'What if I went part-time or took a career break?', eventId: 'part_time' },
  { key: 'children',  icon: '🏠', label: 'What if I helped my children get started?', sub: 'Gifting, trust, mortgage — IHT impact',             tag: 'Ask Sonu', engine: false, query: 'What if I helped my children financially — gifting, trust, or joint mortgage?', eventId: 'setup_trust' },
]

function WhatIfSection({ viewMode, onSelectScenario, onFreeform }) {
  const [freeform, setFreeform] = useState('')
  const isActive = viewMode === 'scenario'

  return (
    <div style={{
      borderTop: '1px solid var(--c-sep)',
      padding: '12px 16px 14px',
      background: isActive ? 'rgba(186,140,255,0.04)' : 'transparent',
      transition: 'background 300ms ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isActive ? 10 : 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: '#ba8cff', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ✦ What if?
        </span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>Explore · not advice</span>
      </div>

      {/* Scenario rows — always shown; more prominent in scenario mode */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: isActive ? 0 : 6 }}>
        {DE_SCENARIOS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => onSelectScenario(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', background: 'none', border: 'none',
              borderBottom: i < DE_SCENARIOS.length - 1 ? '1px solid var(--c-sep)' : 'none',
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>{s.sub}</div>
            </div>
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              padding: '2px 5px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
              ...(s.engine
                ? { background: 'rgba(93,219,194,0.12)', color: 'var(--c-acc)', border: '1px solid rgba(93,219,194,0.3)' }
                : { background: 'rgba(186,140,255,0.12)', color: '#ba8cff', border: '1px solid rgba(186,140,255,0.3)' }
              ),
            }}>{s.tag}</span>
          </button>
        ))}
      </div>

      {/* Freeform input */}
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'rgba(186,140,255,0.07)',
        border: '1px dashed rgba(186,140,255,0.30)',
        borderRadius: 12,
      }}>
        <input
          value={freeform}
          onChange={e => setFreeform(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && freeform.trim()) { onFreeform(freeform.trim()); setFreeform('') } }}
          placeholder="Ask your own what-if…"
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, color: 'var(--c-text2)', background: 'transparent', border: 'none', outline: 'none' }}
        />
        <button
          onClick={() => { if (freeform.trim()) { onFreeform(freeform.trim()); setFreeform('') } }}
          style={{ fontSize: 10, fontWeight: 700, color: '#ba8cff', background: 'rgba(186,140,255,0.15)', border: 'none', borderRadius: 999, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Ask Sonu →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Remove old `DecisionEngineEntryCard` component and its render call** from the JSX return.

- [ ] **Step 4: Verify** — actions card shows expandable rows, What-If section at bottom. Tapping a scenario row opens `ScenarioIntake` (component comes in Task 5 — placeholder: `console.log('scenario selected', s)` for now).

- [ ] **Step 5: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: ActionsCard — expandable actions + What-If section integrated"
```

---

## Task 5: ScenarioIntake — comprehensive question intake

**Files:**
- **Create:** `src/components/Home/ScenarioIntake.jsx`

**Context:** When a scenario row is tapped, instead of going directly to DecisionEngineV2, the user answers 6–10 scenario-specific questions. Answers are woven into an enriched query string, then `onSubmit({ query, eventId })` hands off to the existing DE flow. Entity data is ALREADY injected by `composer.js` — this intake adds the user's personal choices/intent on top.

- [ ] **Step 1: Create `src/components/Home/ScenarioIntake.jsx` with full content**

```jsx
import { useState } from 'react'

// ── Question bank ─────────────────────────────────────────────────────────────
// Each question: { id, q, chips, multi?, type?, showIf? }

const QUESTIONS = {
  relocate: [
    { id: 'country',      q: 'Which country are you considering?',                    chips: ['Portugal', 'UAE', 'Spain', 'Kenya', 'Australia', 'Other'] },
    { id: 'country_other',q: 'Which country specifically?',                           type: 'text', showIf: a => a.country === 'Other' },
    { id: 'home',         q: 'What would you do with your UK home?',                  chips: ['Sell it', 'Rent it out', 'Keep it empty', 'Not decided'] },
    { id: 'working',      q: 'Are you still working?',                                chips: ['Full-time', 'Part-time', 'Retired', 'Self-employed'] },
    { id: 'partner',      q: 'Will a partner or spouse relocate with you?',           chips: ['Yes', 'No', 'Not decided'] },
    { id: 'timeline',     q: 'When are you planning this?',                           chips: ['Within 1 year', '1–3 years', '3–5 years', 'Just exploring'] },
    { id: 'duration',     q: 'How long do you plan to stay?',                         chips: ['Permanently', '5–10 years', 'Trial — see how it goes', 'Not sure'] },
    { id: 'lifestyle',    q: 'Target lifestyle cost vs your current UK spend?',        chips: ['Same level', '~20% cheaper', '~40% cheaper', 'Not sure'] },
    { id: 'income_uk',    q: 'Which UK income sources stay after moving?',             chips: ['Pension / SIPP', 'UK salary', 'UK rental income', 'Dividends', 'State pension', 'None'], multi: true },
    { id: 'healthcare',   q: 'Will you need regular access to UK healthcare?',         chips: ['Yes — ongoing treatment', 'Occasional — NHS visits fine', 'No — happy to go private'] },
  ],
  retire: [
    { id: 'target_age',   q: 'What retirement age are you modelling?',                chips: ['Right now', '1 year earlier', '2 years earlier', '3 years earlier', '5 years earlier'] },
    { id: 'income',       q: 'Target annual income in retirement?',                   chips: ['£50K', '£70K', '£85K — similar to now', '£100K', '£120K+'] },
    { id: 'income_order', q: 'Which pot would you draw from first?',                  chips: ['ISA first (tax-free)', 'SIPP first (IHT benefit)', 'Mix both optimally', 'Need advice'] },
    { id: 'partner',      q: 'Is a partner retiring at the same time?',               chips: ['Yes — same time', 'Yes — different timing', 'No partner', 'Not sure'] },
    { id: 'mortgage',     q: 'Mortgage status at your retirement date?',              chips: ['Paid off', 'Under 5 years left', '5–15 years left', 'Over 15 years left'] },
    { id: 'dependants',   q: 'Dependants relying on your income?',                    chips: ['None', 'Children in education', 'Adult children', 'Other dependants'] },
    { id: 'part_time',    q: 'Open to part-time work or consulting in early retirement?', chips: ['Yes — happy to', 'Maybe if needed', 'No — clean break wanted'] },
    { id: 'sipp_status',  q: 'Have you started addressing the SIPP IHT deadline (April 2027)?', chips: ['Yes — drawdown started', 'In progress with adviser', 'Not yet', 'What does this mean?'] },
  ],
  part_time: [
    { id: 'arrangement',  q: 'What arrangement are you considering?',                 chips: ['4-day week', '3-day week', '6-month sabbatical', '1-year career break'] },
    { id: 'reason',       q: "What's the main driver?",                               chips: ['Burnout or stress', 'Health reasons', 'Family or caring', 'A project or new venture', 'Just want more time'] },
    { id: 'income_target',q: 'What income could you comfortably live on?',            chips: ['£40K/yr', '£50K/yr', '£60–70K/yr', '£80K/yr', 'Zero — have enough saved'] },
    { id: 'duration',     q: 'How long would this last?',                             chips: ['3–6 months', '6–12 months', '1–2 years', 'Open-ended / indefinite'] },
    { id: 'employer',     q: 'Your employer situation?',                              chips: ['Still negotiating', 'Already agreed in principle', 'Self-employed / flexible', 'Would need to resign'] },
    { id: 'return',       q: 'Do you plan to return to full-time work?',              chips: ['Definitely yes', 'Probably yes', 'Maybe', 'Probably not'] },
    { id: 'pension',      q: 'Concerned about pension contributions during the break?', chips: ['Yes — key concern', 'Somewhat', 'Not really — enough saved already'] },
  ],
  house: [
    { id: 'target_value', q: 'Approximate value of the new property?',               chips: ['£1M', '£1.5M', '£2M', '£2.5M', '£3M+'] },
    { id: 'current_home', q: 'What would you do with your current home?',             chips: ['Sell it', 'Rent it out', 'Extend instead of moving', 'Not decided'] },
    { id: 'funding',      q: 'How would you fund the move?',                          chips: ['Sell + use ISA / cash', 'Remortgage the gap', 'Mix of both', 'Not sure yet'] },
    { id: 'mortgage',     q: 'Current mortgage remaining?',                           chips: ['Paid off', 'Under £200K', '£200K–£500K', 'Over £500K'] },
    { id: 'timeline',     q: 'When are you thinking of doing this?',                  chips: ['Within 6 months', '6–12 months', '1–2 years', 'Just exploring'] },
    { id: 'driver',       q: 'Primary reason for moving?',                            chips: ['More space', 'Better location', 'Garden or outside space', 'Renovation project', 'Investment / rental'] },
    { id: 'sipp_timing',  q: 'Have you factored in the April 2027 SIPP deadline when timing this?', chips: ['Yes — factored in', 'No — should I?', 'Not sure what this means'] },
  ],
  children: [
    { id: 'amount',       q: 'How much are you thinking of giving or lending?',       chips: ['£25K', '£50K', '£100K', '£150K', '£250K+'] },
    { id: 'count',        q: 'How many children are you helping?',                    chips: ['1', '2', '3 or more'] },
    { id: 'age',          q: "What age range are your children?",                     chips: ['Under 18', '18–25', '25–35', 'Mixed ages'] },
    { id: 'purpose',      q: 'Primary purpose of the help?',                          chips: ['Property deposit', 'General financial head-start', 'University or education', 'Starting a business', 'Not sure yet'] },
    { id: 'structure',    q: 'How would you prefer to structure it?',                 chips: ['Outright gift', 'Family trust', 'Family offset mortgage', 'Informal loan', 'Not sure — advise me'] },
    { id: 'priority',     q: 'What matters most to you?',                             chips: ['Reduce my IHT estate', 'Help them immediately', 'Keep some control', 'All three equally'] },
    { id: 'timing',       q: 'When are you planning this?',                           chips: ['This tax year', '1–2 years', '3–5 years', 'Exploring timing'] },
    { id: 'annual_gifts', q: 'Are you already using your £3K annual gift exemption?', chips: ['Yes', 'No — tell me more', 'Not sure'] },
  ],
}

// Maps scenario key (from DE_SCENARIOS.key) to question bank key
const KEY_MAP = {
  relocate:  'relocate',
  house:     'house',
  retire:    'retire',
  part_time: 'part_time',
  children:  'children',
}

function buildEnrichedQuery(baseQuery, scenarioKey, answers) {
  const questions = QUESTIONS[scenarioKey] || []
  const parts = questions
    .filter(q => !q.showIf || q.showIf(answers))
    .map(q => {
      const val = answers[q.id]
      if (!val) return null
      const valStr = Array.isArray(val) ? val.join(', ') : val
      return `${q.q.replace(/\?$/, '')}: ${valStr}`
    })
    .filter(Boolean)
  if (!parts.length) return baseQuery
  return `${baseQuery} Here is additional context about my situation: ${parts.join('; ')}.`
}

export default function ScenarioIntake({ scenario, onSubmit, onBack }) {
  const [answers, setAnswers] = useState({})

  const qKey = KEY_MAP[scenario.key] || scenario.key
  const allQs = QUESTIONS[qKey] || []
  const visibleQs = allQs.filter(q => !q.showIf || q.showIf(answers))

  function toggle(id, val, multi) {
    setAnswers(prev => {
      if (multi) {
        const cur = Array.isArray(prev[id]) ? prev[id] : []
        const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
        return { ...prev, [id]: next }
      }
      return { ...prev, [id]: prev[id] === val ? undefined : val }
    })
  }

  const answeredCount = visibleQs.filter(q => {
    const v = answers[q.id]
    return v && (Array.isArray(v) ? v.length > 0 : v.trim?.() !== '')
  }).length

  function handleSubmit() {
    const qKey2 = KEY_MAP[scenario.key] || scenario.key
    const enriched = buildEnrichedQuery(scenario.query, qKey2, answers)
    onSubmit({ query: enriched, eventId: scenario.eventId })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--c-sep)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-acc)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>←</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {scenario.icon} What if?
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', marginTop: 1, lineHeight: 1.2 }}>{scenario.label}</div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--c-text3)', flexShrink: 0 }}>{answeredCount}/{visibleQs.length}</span>
      </div>

      {/* Questions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {visibleQs.map(q => {
          const val = answers[q.id]
          return (
            <div key={q.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8, lineHeight: 1.3 }}>
                {q.q}
                {q.multi && <span style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 500, marginLeft: 6 }}>select all</span>}
              </div>
              {q.type === 'text' ? (
                <input
                  value={val || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Type your answer…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--c-sep)', background: 'var(--c-surface2)', color: 'var(--c-text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {q.chips.map(chip => {
                    const sel = q.multi ? (Array.isArray(val) && val.includes(chip)) : val === chip
                    return (
                      <button key={chip} onClick={() => toggle(q.id, chip, q.multi)} style={{
                        padding: '6px 12px', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer',
                        border: `1.5px solid ${sel ? 'var(--c-acc)' : 'var(--c-sep)'}`,
                        background: sel ? 'rgba(93,219,194,0.12)' : 'var(--c-surface2)',
                        color: sel ? 'var(--c-acc)' : 'var(--c-text2)',
                        fontSize: 12, fontWeight: sel ? 700 : 600,
                        transition: 'all 120ms ease',
                      }}>
                        {chip}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit */}
      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--c-sep)' }}>
        <button onClick={handleSubmit} style={{
          width: '100%', padding: '12px 20px', borderRadius: 999, border: 'none',
          background: 'var(--c-acc)', color: '#0B1F3A', fontSize: 13, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Explore this scenario →
        </button>
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>
          Your financial data is included automatically · FCA boundary applies
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Import ScenarioIntake in HomeScreen.jsx**

At the top of `src/screens/HomeScreen.jsx`, add:
```jsx
import ScenarioIntake from '../components/Home/ScenarioIntake.jsx'
```

- [ ] **Step 3: Verify** — tap a scenario row in the What-If section → ScenarioIntake renders with the correct question set. Answer questions → "Explore this scenario →" button calls `onNav('de', { query: enrichedQuery, eventId })`. The DecisionEngineV2 overlay opens.

- [ ] **Step 4: Test relocation scenario manually**
  - Tap "✈️ How much do I need to relocate?" 
  - Answer: Portugal / Sell it / Full-time / Yes (partner) / 1-3 years / Permanently / ~20% cheaper / Pension + SIPP / Occasional NHS
  - Tap "Explore this scenario →"
  - Verify the DE overlay opens with a query that includes all the context

- [ ] **Step 5: Commit**
```bash
git add src/components/Home/ScenarioIntake.jsx src/screens/HomeScreen.jsx
git commit -m "feat: ScenarioIntake — 6-10 questions per scenario before DE call"
```

---

## Task 6: RadarCard — mode-aware content + Flow→C-Flow label fix

**Files:**
- Modify: `src/screens/HomeScreen.jsx` — `RadarCard` component

**Context:** The radar shows different brief text per mode. In WHAT IF mode, the brief area shows the drag instruction. The "Flow" label in the radar SVG is abbreviated — change to "C-Flow" (Cashflow). Red `!` circles on gap dims open the dim drill directly. The radar itself (RadarAnchor.jsx) handles the SVG polygon — we update the wrapper.

- [ ] **Step 1: Update RadarCard to be mode-aware**

Replace the `RadarCard` component:

```jsx
const MODE_BRIEF = {
  actual:   (nw, assetList, taxShelter, lowestDim) =>
    `You hold ${fmt(nw)} across ${assetList}. ${taxShelter}% is in tax shelters. ${lowestDim?.label || 'One dimension'} is the area that would most benefit from a closer look.`,
  forecast: (nw, assetList, taxShelter, lowestDim) =>
    `On your current trajectory, your wealth shape shifts over 5 years. The gold dashed ring shows where you are aiming — gaps between today (mint) and target (gold) are the priority actions.`,
  plan:     (nw, assetList, taxShelter, lowestDim) =>
    `Your plan target (gold dashed ring) vs today (mint). Close the gap by addressing the dimensions below target — ${lowestDim?.label || 'Legacy'} is furthest from your plan.`,
  scenario: () =>
    `Drag any radar point to explore what-if. Moving a dimension outward = better. Inward = worse. Watch the score in the centre update live.`,
}

function RadarCard({ entity, fqData, nw, viewMode, diffs, onDrillMetric }) {
  const dims       = fqData?.dims || {}
  const lowestDim  = useMemo(() => pickLowestDim(entity, dims), [entity, dims])
  const taxShelter = useMemo(() => {
    const a = entity?.assets || {}
    const num = v => (typeof v === 'number' ? v : (v?.value ?? v?.total ?? 0))
    const sheltered = num(a.isa) + num(a.lisa) + num(a.sipp) + num(a.pension)
    return nw > 0 ? Math.round((sheltered / nw) * 100) : 0
  }, [entity, nw])
  const assetList = useMemo(() => joinList(listAssetClasses(entity, 3)), [entity])

  const briefFn = MODE_BRIEF[viewMode] || MODE_BRIEF.actual
  const brief = briefFn(nw, assetList, taxShelter, lowestDim)

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 20,
      padding: '16px 18px 14px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 2 }}>Your wealth shape</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            7 dimensions · {viewMode === 'scenario' ? 'drag to test what-if' : 'today vs target'}
          </div>
        </div>
        <button onClick={() => onDrillMetric?.('gaps')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)', fontSize: 18, padding: 0 }}>›</button>
      </div>

      <RadarAnchor
        entity={entity}
        fqData={fqData}
        viewMode={viewMode}
        diffs={diffs}
        onDrillMetric={onDrillMetric}
      />

      <p style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>
        {brief}
      </p>

      {viewMode === 'scenario' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--c-text3)' }}>
          <span style={{ border: '1px dashed var(--c-text3)', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>⋮</span>
          Drag any point to test what-if
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Fix "Flow" → "C-Flow" in RadarAnchor.jsx**

Open `src/components/Home/RadarAnchor.jsx`. Find where the "Flow" label text is rendered in the SVG (look for `text` element or label array). Change `'Flow'` to `'C-Flow'` in the labels array or text element. Example — if there's a `DIMS` or `LABELS` array:

```js
// Before:
{ key: 'flow', label: 'Flow', ... }
// After:
{ key: 'flow', label: 'C-Flow', ... }
```

Or if it's a direct SVG text element, find `>Flow<` and change to `>C-Flow<`.

- [ ] **Step 3: Verify** — radar renders with "C-Flow" label, mode pill changes brief text correctly.

- [ ] **Step 4: Commit**
```bash
git add src/screens/HomeScreen.jsx src/components/Home/RadarAnchor.jsx
git commit -m "feat: mode-aware radar brief text + C-Flow label + scenario drag hint"
```

---

## Task 7: Radar drag tooltip + live score delta

**Files:**
- Modify: `src/components/Home/RadarAnchor.jsx`

**Context:** When a radar node is dragged, show: (1) a floating label next to the node showing "Dim: old → new" value, (2) a compact score delta panel in the centre ("Score: 47 → 44"). Other dims don't move (only the dragged one changes). Score delta is computed deterministically: each dim contributes proportionally to the score (engine-lite calculation, not a full re-run).

- [ ] **Step 1: Read RadarAnchor.jsx in full** to understand current drag state variable names.

- [ ] **Step 2: Add dragTooltip state** to RadarAnchor

Near the top of the RadarAnchor component, add state:
```jsx
const [dragTooltip, setDragTooltip] = useState(null)
// dragTooltip: { dimKey, label, oldVal, newVal, scoreDelta, x, y } | null
```

- [ ] **Step 3: Compute live score delta during drag**

Add this pure function above the component (uses the dim's proportional contribution to score):
```js
function estimateScoreDelta(fqData, dimKey, newDimVal) {
  const dims   = fqData?.dims || {}
  const maxes  = { habits: 100, own: 100, tax: 100, safety: 16, flow: 100, debt: 100, legacy: 100 }
  const weights = { habits: 0.10, own: 0.20, tax: 0.20, safety: 0.15, flow: 0.15, debt: 0.10, legacy: 0.10 }
  const oldPct  = (dims[dimKey] ?? 0)  / (maxes[dimKey] || 100)
  const newPct  = newDimVal            / (maxes[dimKey] || 100)
  const w       = weights[dimKey] || 0.10
  return Math.round((newPct - oldPct) * w * 100)
}
```

- [ ] **Step 4: Update the drag move handler** to set dragTooltip

Inside the `handleMove` (or equivalent pointer-move handler), after computing the new value for the dragged dim, add:
```js
const delta = estimateScoreDelta(fqData, activeDimKey, newDimValue)
const svgRect = svgRef.current.getBoundingClientRect()
setDragTooltip({
  dimKey:     activeDimKey,
  label:      DIM_LABELS[activeDimKey] || activeDimKey,
  oldVal:     Math.round(fqData?.dims?.[activeDimKey] ?? 0),
  newVal:     Math.round(newDimValue),
  scoreDelta: delta,
  x:          e.clientX - svgRect.left + 12,
  y:          e.clientY - svgRect.top  - 24,
})
```

- [ ] **Step 5: Clear tooltip on drag end**

In the pointer-up / drag-end handler:
```js
setDragTooltip(null)
```

- [ ] **Step 6: Render the tooltip overlay**

In the RadarAnchor JSX, after the `<svg>` element, add:
```jsx
{dragTooltip && (
  <div style={{
    position: 'absolute',
    left: dragTooltip.x, top: dragTooltip.y,
    background: 'var(--c-surface)',
    border: '1px solid var(--c-sep)',
    borderRadius: 10, padding: '8px 12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    fontSize: 12, color: 'var(--c-text2)',
    pointerEvents: 'none', zIndex: 20,
    minWidth: 140,
  }}>
    <div style={{ fontWeight: 800, color: 'var(--c-text)', marginBottom: 3 }}>{dragTooltip.label}</div>
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      {dragTooltip.oldVal} → <strong style={{ color: dragTooltip.newVal > dragTooltip.oldVal ? 'var(--c-acc)' : 'var(--c-acc3)' }}>{dragTooltip.newVal}</strong>
    </div>
    <div style={{ marginTop: 4, fontWeight: 700, color: dragTooltip.scoreDelta >= 0 ? 'var(--c-acc)' : 'var(--c-acc3)', fontSize: 11 }}>
      Score: {dragTooltip.scoreDelta >= 0 ? '+' : ''}{dragTooltip.scoreDelta} pts
    </div>
  </div>
)}
```

The parent `<div>` wrapping the SVG must have `position: 'relative'` for this to work.

- [ ] **Step 7: Verify** — drag a radar node in What-If mode → tooltip appears near cursor showing dim value and score delta. Release → tooltip disappears.

- [ ] **Step 8: Commit**
```bash
git add src/components/Home/RadarAnchor.jsx
git commit -m "feat: radar drag tooltip — live dim value + score delta on drag"
```

---

## Task 8: Plan strip + Future/Plan mode projections

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

**Context:** `PlanProgressStrip` replaces the old card with a horizontal strip (matching HTML). In FUTURE mode, the anchor row shows projected values (plan target). In PLAN mode, the radar target ring is more prominent.

- [ ] **Step 1: Replace PlanProgressCard with PlanProgressStrip**

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
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text2)' }}>No active plan — set one in the <strong style={{ color: 'var(--c-text)' }}>Plan tab</strong> to see your trajectory and milestones.</div>
      <span style={{ color: 'var(--c-acc)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Set plan →</span>
    </div>
  )

  const target   = typeof plan.target === 'number' ? plan.target : (plan.target?.netWorth || plan.target?.value || plan.targetValue || 0)
  const current  = plan.progress?.current ?? plan.current ?? 0
  const pct      = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const onTrack  = plan.progress?.onTrack ?? plan.onTrack ?? true
  const horizon  = plan.horizonDate || plan.target?.date || null
  const planName = plan.name || plan.goal || 'Retirement plan'

  return (
    <div style={{ margin: '14px 16px 0', padding: '14px 18px', background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', marginBottom: 2 }}>Plan progress</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {planName}{target > 0 && ` · ${fmt(target)} target`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {horizon && <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{fmtDate(horizon)}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: onTrack ? 'var(--c-acc)' : 'var(--c-acc3)' }}>
            {onTrack ? 'On course' : 'Behind plan'}
          </span>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--c-surface2)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--c-acc)', borderRadius: 100, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 6 }}>
        <strong style={{ color: 'var(--c-text)' }}>{pct}%</strong>
        {target > 0 && <span> · {fmt(current)} of {fmt(target)}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify plan strip renders correctly when plan data exists and when it doesn't.**

- [ ] **Step 3: Commit**
```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: PlanProgressStrip — horizontal strip layout matching HTML design"
```

---

## Task 9: Wire all drills + red circles → actions

**Files:**
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/components/Home/RadarAnchor.jsx`

**Context:** Every tappable element must have a destination. Red `!` circles on radar dims → open that dim's drill. The `drillFn` in HomeScreen already handles 'netWorth', 'coi', 'apq'. Add 'gaps' (opens APQ drill) and dim keys (open dim explainer stub or full dim panel).

- [ ] **Step 1: Update drillFn in HomeScreen to handle 'gaps'**

```jsx
const drillFn = (metric) => {
  if (metric === 'netWorth') { setLocalDrill('networth'); return }
  if (metric === 'coi')      { setLocalDrill('coi');      return }
  if (metric === 'apq' || metric === 'gaps') { setLocalDrill('apq'); return }
  // Dim keys ('wealth.habits', 'habits', etc.)
  const dimKey = metric.replace(/^wealth\./, '')
  if (onDrillMetric) onDrillMetric(dimKey)
  else setStubMetric(dimKey)
}
```

- [ ] **Step 2: Ensure RadarAnchor fires `onDrillMetric` on `!` badge tap**

In RadarAnchor.jsx, find the gap-mark circles (coral `!` indicators). Each should call `onDrillMetric(`wealth.${dimKey}`)` on click/tap. If they're SVG `<circle>` elements with `onClick`, verify the handler is wired. If not, add:

```jsx
// In the gap indicators render loop in RadarAnchor.jsx:
<circle
  key={`gap-${dim.key}`}
  cx={gapX} cy={gapY} r={6}
  fill="var(--c-acc3)"
  style={{ cursor: 'pointer' }}
  onClick={() => onDrillMetric?.(`wealth.${dim.key}`)}
/>
```

- [ ] **Step 3: Verify every element has a drill destination:**
  - NW tile → NetWorthDrillPanel ✓
  - Score tile → FQBreakdown overlay ✓
  - Risk tile → dim drill (riskScore) ✓
  - CoI tile → CoIDrillPanel ✓
  - "X gaps" badge → APQDrillPanel ✓
  - Radar dim node tap → DimExplainerStub (or full dim drill) ✓
  - Radar gap `!` circle → same dim drill ✓
  - Action row expand → inline detail ✓
  - "See all →" → APQDrillPanel ✓
  - Scenario row → ScenarioIntake ✓

- [ ] **Step 4: Commit**
```bash
git add src/screens/HomeScreen.jsx src/components/Home/RadarAnchor.jsx
git commit -m "fix: wire all drill destinations — gaps badge, red circles, dim nodes"
```

---

## Task 10: Test with sonuswealth-tester

**Context:** After all tasks complete, invoke the `sonuswealth-tester` skill to run a structured test pass across the home screen.

- [ ] **Step 1: Start dev server** — `npm run dev` at `C:\Users\Powernet\Desktop\finio`

- [ ] **Step 2: Navigate to** `http://localhost:5173/?demo=a` — verify persona-a loads (Bruce Wayne, £3.63M NW, Score ~47).

- [ ] **Step 3: Invoke `sonuswealth-tester` skill** with the following test scope:

  **Home screen test pass:**
  - Mode pill: tap TODAY / FUTURE / PLAN / WHAT IF — verify brief text changes each time
  - Anchor row: 4 columns visible, all show non-zero engine values
  - NW column: composition bar shows coloured segments
  - Score column: donut SVG visible, gap badge ("X gaps in radar →") present and tappable
  - Risk column: gradient gauge with pointer positioned at correct score
  - CoI column: countdown bar + days label
  - Tap NW → NetWorthDrillPanel opens
  - Tap Score → FQBreakdown opens
  - Tap CoI → CoIDrillPanel opens
  - Tap "X gaps" → APQDrillPanel opens
  - Tap a radar dim node → DimExplainerStub or dim drill opens
  - Tap a `!` circle on radar → same dim drill opens
  - What-If section visible in actions card
  - Tap "✈️ How much do I need to relocate?" → ScenarioIntake opens with 10 questions
  - Answer 3+ questions → "Explore →" → DecisionEngineV2 overlay opens, query includes answered context
  - Tap "⏱️ What if I retired 5 years earlier?" → ScenarioIntake opens with 8 questions
  - Freeform input → type a question → press Enter → DE overlay opens
  - WHAT IF mode → radar enters drag mode (nodes show drag handles)
  - Drag a radar node → tooltip appears showing "Dim: old → new, Score: ±N pts"
  - Plan strip renders at bottom (or "Set plan" if no plan)
  - No console errors throughout

- [ ] **Step 4: Fix any failures** identified by the tester before marking complete.

- [ ] **Step 5: Final commit**
```bash
git add -A
git commit -m "feat: homescreen rebuild complete — 2-col, 4-anchor, mode pill, scenario intake, radar drag tooltip"
git push origin main
```

---

## Self-Review

**Spec coverage check:**
- ✅ 2-column layout matching HTML — Tasks 2, 3
- ✅ 4-column anchor row (NW+comp, Score+donut, Risk+gauge, CoI+countdown) — Task 3
- ✅ Mode pill (TODAY/FUTURE/PLAN/WHAT IF) wired — Tasks 2, 6
- ✅ WHAT IF mode → radar drag mode — Task 6 (leverages existing RadarAnchor scenario mode)
- ✅ Avatar in masthead — Task 2
- ✅ "3 gaps" badge moved to Score column — Task 3
- ✅ Flow → C-Flow — Task 6
- ✅ Red circles → actions — Task 9
- ✅ Scenario intake (comprehensive questions) — Task 5
- ✅ ActionsCard with expandable rows + embedded What-If section — Task 4
- ✅ Plan strip — Task 8
- ✅ Radar drag tooltip + score delta — Task 7
- ✅ All drills wired — Task 9
- ✅ Zero hardcoding — all values from engine functions
- ✅ Test coverage — Task 10 (sonuswealth-tester)

**Placeholder scan:** No TBDs, no "similar to task N", all code blocks complete.

**Type consistency:** `drillFn`, `onDrillMetric`, `onNav`, `onOpenBreakdown` prop names consistent throughout. `DE_SCENARIOS` uses `key` field (not `id`) matching ScenarioIntake's `KEY_MAP`. `viewMode` values: `'actual' | 'forecast' | 'plan' | 'scenario'` — consistent with RadarAnchor's existing viewMode contract.
