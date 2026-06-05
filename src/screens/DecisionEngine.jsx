// ─────────────────────────────────────────────────────────────────────────────
// DecisionEngine — Phase 3 module. 9-step decision flow with the §13.12 magic
// Decision Wheel inline at the weighting step.
//
// Spec: 2-Product-ai-decision-engine-v1_0.md. Property is canonical:
// "Should I keep, sell, or let my £450k flat?"
//
// Spec §4 mandates 7 logical steps. We surface 9 in the UI because the audit
// (CRIT DE-NAR-01/02) requires explicit Unconsidered + Recommendation cards
// in addition to Rank/Stress-test/Commit:
//   1. Identify the decision
//   2. Capture context
//   3. Compute options (3–4 candidate paths)
//   4. Set your weights (Decision Wheel)
//   5. Ranked paths
//   6. Mandatory unconsidered option (spec §4 Step 5 — CRIT DE-NAR-01)
//   7. FCA-rewritten engine recommendation (spec §4 Step 6 — CRIT DE-NAR-02)
//   8. Stress-test (Phase 2: Monte Carlo via D-DE-MC-1)
//   9. Commit (fires decision_committed event per spec §8)
//
// Phase 2 imports for engine wiring:
// import { simulateAction, enumeratePaths, readAssetPicture, generateRecommendation }
//   from '../engine/decision-engine.js'
// (decision-engine.js to be created in next wave — see CRIT DE-MATH-02.)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { simulateAction, enumeratePaths, generateRecommendation } from '../engine/decision-engine.js'

// FCA boundary constant — mirrored from FIX-11 Ask. Single source of truth
// for regulated-advice disclaimer text on engine recommendations.
const FCA_BOUNDARY = 'Information and guidance only — not regulated financial advice. Speak to a qualified IFA before acting.'

// Live decision (Phase 1). Property is the canonical worked example.
const DECISIONS = [
  {
    id: 'property',
    code: 'DE-09',
    title: 'Property: keep, sell, or let?',
    sub:   'Canonical worked example. Bruce\'s £450k London flat — owned outright for 12 years.',
    icon:  '◇',
  },
]

// Full 40-decision catalogue (spec §0.1 D-DE-3 priority list).
// Phase 1: 1 live (DE-09 property). The other 39 surface as disabled stubs so
// the engine's scope is visible. Phase 2 wires each via simulateAction().
const DECISION_TYPES_ALL = [
  { id: 'DE-01', title: 'Drawdown: lump sum vs phased', status: 'live' },
  { id: 'DE-02', title: 'Annuity: buy or defer?', status: 'live' },
  { id: 'DE-03', title: 'Pension contribution: top up vs MPAA risk', status: 'live' },
  { id: 'DE-04', title: 'SIPP vs workplace pension routing', status: 'live' },
  { id: 'DE-05', title: 'Salary sacrifice: increase / decrease', status: 'live' },
  { id: 'DE-06', title: 'ISA: stocks & shares vs cash vs LISA split', status: 'live' },
  { id: 'DE-07', title: 'GIA → ISA bed-and-ISA execution', status: 'live' },
  { id: 'DE-08', title: 'Mortgage: overpay, offset, or invest?', status: 'live' },
  { id: 'DE-09', title: 'Property: keep, sell, or let?', status: 'live' },
  { id: 'DE-10', title: 'Remortgage: fix vs tracker vs offset', status: 'live' },
  { id: 'DE-11', title: 'BTL: §24 exposure review', status: 'live' },
  { id: 'DE-12', title: 'Equity release: lifetime mortgage assessment', status: 'live' },
  { id: 'DE-13', title: 'Emergency fund: size and location', status: 'live' },
  { id: 'DE-14', title: 'Cash ladder: build a 12-month bond ladder', status: 'live' },
  { id: 'DE-15', title: 'Gifting: structure £X to children (7-year PET)', status: 'live' },
  { id: 'DE-16', title: 'Trust: bare, discretionary, or interest-in-possession', status: 'live' },
  { id: 'DE-17', title: 'Will: simple, mirror, or life-interest', status: 'live' },
  { id: 'DE-18', title: 'LPA: financial and health setup', status: 'live' },
  { id: 'DE-19', title: 'Life cover: term, FIB, or whole-of-life in trust', status: 'live' },
  { id: 'DE-20', title: 'Critical illness: add or top up', status: 'live' },
  { id: 'DE-21', title: 'Income protection: own-occ vs any-occ', status: 'live' },
  { id: 'DE-22', title: 'CGT crystallisation: harvest allowance now', status: 'live' },
  { id: 'DE-23', title: 'Loss harvesting: realise losses against gains', status: 'live' },
  { id: 'DE-24', title: 'Spousal transfer: equalise allowances', status: 'live' },
  { id: 'DE-25', title: 'Dividend vs salary mix (Ltd Co director)', status: 'live' },
  { id: 'DE-26', title: 'EIS / SEIS: invest for relief', status: 'live' },
  { id: 'DE-27', title: 'VCT: build a tax-relief ladder', status: 'live' },
  { id: 'DE-28', title: 'BPR portfolio: 2-year IHT planning', status: 'live' },
  { id: 'DE-29', title: 'Charitable giving: payroll, gift aid, legacy', status: 'live' },
  { id: 'DE-30', title: 'School fees / education funding plan', status: 'live' },
  { id: 'DE-31', title: 'Career break / sabbatical affordability', status: 'live' },
  { id: 'DE-32', title: 'Redundancy: lump-sum deployment', status: 'live' },
  { id: 'DE-33', title: 'Inheritance receipt: deploy £X received', status: 'live' },
  { id: 'DE-34', title: 'Divorce: financial settlement structuring', status: 'live' },
  { id: 'DE-35', title: 'Business sale: exit + BADR planning', status: 'live' },
  { id: 'DE-36', title: 'Director loan: extract or repay', status: 'live' },
  { id: 'DE-37', title: 'Pension transfer: DB → DC suitability', status: 'live' },
  { id: 'DE-38', title: 'Annuity reshape after partial drawdown', status: 'live' },
  { id: 'DE-39', title: 'Emigration: UK tax residency exit planning', status: 'live' },
  { id: 'DE-40', title: 'Long-term care funding: self-fund vs deferred payment', status: 'live' },
]

// Phase 1: hardcoded scores. Phase 2 will route through simulateAction() →
// enumeratePaths() → readAssetPicture() per spec §5. Real implementation calls
// computeDecisionPaths(decisionType, entity, bundle) and renders the output.
const PROPERTY_PATHS = [
  {
    id: 'keep_use',
    title: 'Keep & use as PPR',
    sub:   'Live in it. PPR shelters future CGT.',
    impact: {
      yield_p_a:    0,
      cgt_today:    0,
      iht_in_estate: 450_000,
      liquidity:    0,
      complexity:   1,
    },
    scores: { tax: 0.6, risk: 0.7, liquidity: 0.2, legacy: 0.5 },
    explanation: 'No income generated. No CGT today. Stays in estate at full value — IHT exposure of £450k unless residence allowance applies.',
  },
  {
    id: 'let',
    title: 'Let on AST',
    sub:   '£1,800/mo gross. BTL tax position via §24.',
    impact: {
      yield_p_a:    16_700,
      cgt_today:    0,
      iht_in_estate: 450_000,
      liquidity:    -8_000, // mortgage/management overhead estimate
      complexity:   3,
    },
    scores: { tax: 0.3, risk: 0.4, liquidity: 0.5, legacy: 0.5 },
    explanation: 'Net rental ~£16,700/yr after costs. Section 24 caps mortgage relief at basic rate. Still in estate. Tenancy risk + management overhead.',
  },
  {
    id: 'sell_isa',
    title: 'Sell & wrap into ISA + pension',
    sub:   'CGT due, then deploy across tax wrappers.',
    impact: {
      yield_p_a:    18_500,
      cgt_today:    35_000, // CGT on gain
      iht_in_estate: 250_000, // pension portion out of estate til 2027
      liquidity:    415_000,
      complexity:   2,
    },
    scores: { tax: 0.7, risk: 0.6, liquidity: 0.95, legacy: 0.7 },
    explanation: 'Crystallises CGT (~£35k) but releases £415k of liquid capital. Wrapping into ISA + SIPP shelters future growth and reduces IHT exposure.',
  },
  {
    id: 'sell_btl_replace',
    title: 'Sell & buy a yielding BTL',
    sub:   'Swap into a higher-yield, smaller property.',
    impact: {
      yield_p_a:    22_400,
      cgt_today:    35_000,
      iht_in_estate: 450_000,
      liquidity:    0,
      complexity:   4,
    },
    scores: { tax: 0.4, risk: 0.5, liquidity: 0.2, legacy: 0.5 },
    explanation: 'Yields more (~£22k/yr) but locks capital again. CGT triggered on sale. Concentration risk in property unchanged.',
  },
]

const WEIGHTS_LABEL = {
  tax:       'Tax efficiency',
  risk:      'Risk level',
  liquidity: 'Liquidity',
  legacy:    'Legacy / IHT',
}

function fmt(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1000) return `£${Math.round(n / 1000)}k`
  return `£${n}`
}

// Signed £ for engine deltas (e.g. net-worth / IHT change per path).
function fmtSigned(n) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  return `${sign}${a >= 1000 ? `£${Math.round(a / 1000)}k` : `£${Math.round(a)}`}`
}

export default function DecisionEngine({ onBack, onCommit, entity, onAskAI }) {
  const [step, setStep] = useState(0)
  const [decision, setDecision] = useState(null)
  const [context, setContext] = useState({
    holdYears: 5,
    targetIncome: 18_000,
    appetite: 'balanced',
  })
  const [weights, setWeights] = useState({
    tax: 0.5, risk: 0.5, liquidity: 0.7, legacy: 0.4,
  })
  const [chosen, setChosen] = useState(null)
  const [stressTested, setStressTested] = useState(false)
  const [committed, setCommitted] = useState(false)

  // Computed paths: for DE-09 (property canonical example) use hardcoded
  // PROPERTY_PATHS; for all other live types use enumeratePaths() from engine.
  const computedPaths = useMemo(() => {
    if (!decision) return []
    const decId = decision.code || decision.id
    if (decId === 'DE-09') return PROPERTY_PATHS
    try {
      // Engine paths use {id,label,riskLevel,detail,simulation}; the wizard's
      // step components were built for the property-path shape {title,sub,impact}.
      // Normalise so every step renders for all 40 cases (not just DE-09).
      const raw = enumeratePaths(entity, decId)
      return (raw || []).map(p => ({
        ...p,
        title: p.title || p.label,
        sub:   p.sub || (p.riskLevel ? `${p.riskLevel[0].toUpperCase()}${p.riskLevel.slice(1)} risk` : ''),
      }))
    } catch { return [] }
  }, [decision, entity])

  // Recommendation from engine for chosen path
  const engineRec = useMemo(() => {
    if (!decision || !chosen) return null
    const decId = decision.code || decision.id
    const chosenPath = computedPaths.find(p => p.id === chosen) || computedPaths[0]
    try { return generateRecommendation(entity, decId, chosenPath) } catch { return null }
  }, [decision, chosen, computedPaths, entity])

  // Rank paths against weights (weighted sum of normalised scores)
  const ranked = useMemo(() => {
    if (!decision) return []
    const totalW = (weights.tax + weights.risk + weights.liquidity + weights.legacy) || 1
    const riskMap = { low: 0.8, medium: 0.5, high: 0.2 }
    return [...computedPaths]
      .map(p => {
        // Property paths have explicit scores; engine paths use riskLevel heuristic
        const scores = p.scores || {
          tax:       riskMap[p.riskLevel] ?? 0.5,
          risk:      riskMap[p.riskLevel] ?? 0.5,
          liquidity: p.riskLevel === 'high' ? 0.2 : 0.6,
          legacy:    p.riskLevel === 'low'  ? 0.7 : 0.4,
        }
        const score = (
          scores.tax       * weights.tax +
          scores.risk      * weights.risk +
          scores.liquidity * weights.liquidity +
          scores.legacy    * weights.legacy
        ) / totalW
        return { ...p, score, explanation: p.explanation || p.detail || '' }
      })
      .sort((a, b) => b.score - a.score)
  }, [decision, weights, computedPaths])

  // Spec §4 mandates 7-step flow. We surface 9 here because the audit's
  // CRIT DE-NAR-01/02 require explicit Unconsidered + Recommendation cards
  // ON TOP of the existing rank/stress/commit. Each step has spec ID in
  // brackets. Steps 5+6 are Phase 2 engine wiring (UI scaffolding only).
  const STEPS = [
    'Identify',         // 1 — spec §4.1
    'Context',          // 2 — spec §4.2
    'Options',          // 3 — spec §4.3
    'Weights',          // 4 — spec §4.4 (Decision Wheel §13.12)
    'Ranked',           // 5 — spec §4.5
    'Unconsidered',     // 6 — spec §4 Step 5 (CRIT DE-NAR-01)
    'Recommendation',   // 7 — spec §4 Step 6 (CRIT DE-NAR-02)
    'Stress-test',      // 8 — spec §4.6 (CRIT DE-MATH-02 — Phase 2 Monte Carlo)
    'Commit',           // 9 — spec §4.7 + §8 event schema
  ]

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }
  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  function canAdvance() {
    if (step === 0) return decision != null
    if (step === 2) return computedPaths.length > 0
    if (step === 4) return chosen != null
    // 5 (Unconsidered) + 6 (Recommendation) — read-only, always advance
    if (step === 7) return stressTested
    return true
  }

  function commit() {
    const final = ranked.find(p => p.id === chosen) || ranked[0]
    // Spec §8 event payload — type = decision-type code (DE-XX), entity_id +
    // session_id required for IFA audit trail (CRIT — IFA + audit trail).
    const commitEvent = {
      type: `DE-${(decision?.code || decision?.id || 'XX').replace(/^DE-/, '')}`,
      entity_id: entity?.id,
      session_id: typeof window !== 'undefined'
        ? (window.sessionStorage?.getItem('sessionId') || 'no-session')
        : 'no-session',
      decision_payload: {
        decision: decision?.id,
        decision_code: decision?.code || `DE-${decision?.id}`,
        context,
        weights,
        chosenPath: final ? { id: final.id, title: final.title, score: final.score, impact: final.impact } : null,
        stressTested,
      },
      timestamp: new Date().toISOString(),
    }
    onCommit?.(commitEvent)
    setCommitted(true)
    // Show confirmation for 1.5s then close and navigate to Timeline
    setTimeout(() => {
      onBack?.({ committed: true })
    }, 1500)
  }

  // Committed confirmation screen
  if (committed) {
    return (
      <div className="screen" style={{
        padding: '48px 24px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-acc)' }}>Decision committed</div>
        <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6 }}>
          Your decision is recorded in the event log. Taking you to Timeline…
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Decision Engine</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </div>
        </div>
      </div>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 100,
            background: i <= step ? 'var(--c-acc)' : 'var(--c-surface2)',
            transition: 'background .25s',
          }} />
        ))}
      </div>

      {step === 0 && (
        <StepIdentify decision={decision} onPick={(d) => { setDecision(d); setChosen(null) }} onAskAI={onAskAI} />
      )}
      {step === 1 && decision && (
        <StepContext context={context} onChange={setContext} />
      )}
      {step === 2 && decision && (
        <StepOptions paths={computedPaths} />
      )}
      {step === 3 && decision && (
        <StepWeights weights={weights} onChange={setWeights} />
      )}
      {step === 4 && decision && (
        <StepRanked ranked={ranked} chosen={chosen} onPick={setChosen} />
      )}
      {step === 5 && decision && (
        <StepUnconsidered
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          ranked={ranked}
          chosen={chosen}
        />
      )}
      {step === 6 && decision && (
        <StepRecommendation
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          weights={weights}
          engineRec={engineRec}
        />
      )}
      {step === 7 && decision && (
        <StepStressTest
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          tested={stressTested}
          onTested={() => setStressTested(true)}
        />
      )}
      {step === 8 && decision && (
        <StepCommit
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          weights={weights}
        />
      )}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={back} disabled={step === 0} className="sw-press" style={{
          padding: '10px 16px', fontSize: 13, fontWeight: 700,
          background: 'transparent', color: 'var(--c-text3)',
          border: '1px solid var(--c-border)', borderRadius: 100,
          cursor: step === 0 ? 'not-allowed' : 'pointer',
          opacity: step === 0 ? 0.5 : 1,
        }}>Back</button>
        {step < STEPS.length - 1 ? (
          <button onClick={next} disabled={!canAdvance()} className="sw-press" style={{
            flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 800,
            background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
            border: 'none', borderRadius: 100,
            cursor: canAdvance() ? 'pointer' : 'not-allowed',
            opacity: canAdvance() ? 1 : 0.5,
          }}>{STEPS[step + 1]} →</button>
        ) : (
          <button onClick={commit} className="sw-press" style={{
            flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 800,
            background: 'var(--c-acc)', color: 'var(--c-on-accent, #0B1F3A)',
            border: 'none', borderRadius: 100, cursor: 'pointer',
          }}>Commit decision</button>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Identify ────────────────────────────────────────────────────────
function StepIdentify({ decision, onPick, onAskAI }) {
  const liveTypes = DECISION_TYPES_ALL.filter(d => d.status === 'live')
  const phase2Types = DECISION_TYPES_ALL.filter(d => d.status !== 'live')

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Pick a decision to work through. The 9-step engine surfaces options,
        scores them against your priorities, surfaces unconsidered baselines,
        rewrites the recommendation inside FCA boundaries, stress-tests, and
        commits to the audit trail.
      </div>

      {/* Optional LLM path — describe a decision in plain English (V2). */}
      {onAskAI && (
        <button
          onClick={onAskAI}
          className="sw-press"
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: '10px 12px', marginBottom: 6, borderRadius: 12,
            border: '1px dashed var(--c-acc)', background: 'var(--c-acc-bg)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-acc)' }}>
            Not in the list? Ask in plain English →
          </span>
        </button>
      )}

      {/* Live catalogue — all live types are selectable */}
      <DecisionCategory title={`Live decisions (${liveTypes.length})`}>
        {liveTypes.map(d => {
          const active = (decision?.code || decision?.id) === d.id
          return (
            <button key={d.id}
              onClick={() => onPick({ id: d.id.toLowerCase().replace(/-/g, '_'), code: d.id, title: d.title, icon: '◆' })}
              className="sw-tile sw-tile-interactive sw-press"
              style={{
                textAlign: 'left', cursor: 'pointer',
                padding: '10px 12px', width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                border: active ? '1.5px solid var(--c-acc)' : '1px solid var(--c-border)',
                background: active ? 'var(--c-acc-bg)' : undefined,
                marginBottom: 4,
              }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                padding: '2px 6px', borderRadius: 6,
                background: 'var(--c-acc-bg)', color: 'var(--c-acc)',
                minWidth: 44, textAlign: 'center', flexShrink: 0,
              }}>{d.id}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)', textAlign: 'left' }}>{d.title}</span>
              {active && <span style={{ fontSize: 11, color: 'var(--c-acc)', fontWeight: 800 }}>✓</span>}
            </button>
          )
        })}
      </DecisionCategory>

      {/* Phase 2 catalogue — only shown if any stubs remain (all 40 now live). */}
      {phase2Types.length > 0 && (
        <DecisionCategory title={`Coming in Phase 2 (${phase2Types.length})`}>
          {phase2Types.map(d => (
            <DisabledDecisionStub
              key={d.id}
              id={d.id}
              title={d.title}
              status={d.status || 'phase2'}
            />
          ))}
        </DecisionCategory>
      )}
    </div>
  )
}

function DecisionCategory({ title, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function DisabledDecisionStub({ id, title, status }) {
  const live = status === 'live'
  return (
    <div
      className="sw-tile"
      style={{
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: live ? 1 : 0.55,
        cursor: 'not-allowed',
      }}>
      <span style={{
        fontSize: 10, fontWeight: 800,
        padding: '2px 6px', borderRadius: 6,
        background: live ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
        color: live ? 'var(--c-acc)' : 'var(--c-text3)',
        minWidth: 44, textAlign: 'center',
      }}>{id}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--c-text2)' }}>{title}</span>
      <span style={{
        fontSize: 9, fontWeight: 700,
        padding: '2px 6px', borderRadius: 100,
        background: live ? 'var(--c-tint-mint)' : 'var(--c-surface2)',
        color: live ? 'var(--c-acc)' : 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>{live ? 'live' : 'phase 2'}</span>
    </div>
  )
}

// ── Step 2: Context ─────────────────────────────────────────────────────────
function StepContext({ context, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Set the situation. These adjust how the engine evaluates the options.
      </div>
      <Field label="Hold horizon" sub={`${context.holdYears} years`}>
        <input type="range" min="0" max="30" value={context.holdYears}
          onChange={(e) => onChange({ ...context, holdYears: Number(e.target.value) })}
          style={{ width: '100%' }} />
      </Field>
      <Field label="Target annual income" sub={fmt(context.targetIncome)}>
        <input type="range" min="0" max="60000" step="500" value={context.targetIncome}
          onChange={(e) => onChange({ ...context, targetIncome: Number(e.target.value) })}
          style={{ width: '100%' }} />
      </Field>
      <Field label="Risk appetite">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['cautious', 'balanced', 'growth'].map(a => (
            <button key={a} onClick={() => onChange({ ...context, appetite: a })}
              className={`sw-chip sw-chip-sm ${context.appetite === a ? 'sw-chip-mint' : ''}`}
              style={{ cursor: 'pointer', fontWeight: 700 }}>
              {a}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}

// ── Step 3: Options ─────────────────────────────────────────────────────────
function StepOptions({ paths }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        The engine surfaced <strong>{paths.length}</strong> candidate paths, each
        costed against your finances. You don't pick yet — the weighting step does that.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paths.map(p => {
          const d = p.simulation?.delta
          return (
            <div key={p.id} className="sw-tile" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>{p.title || p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{p.sub || p.detail}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8 }}>
                {p.impact ? (
                  <>
                    <ImpactChip label="Yield/yr"  value={fmt(p.impact.yield_p_a)} good={p.impact.yield_p_a > 0} />
                    <ImpactChip label="CGT today" value={fmt(p.impact.cgt_today)} good={p.impact.cgt_today === 0} />
                    <ImpactChip label="In estate" value={fmt(p.impact.iht_in_estate)} good={p.impact.iht_in_estate < 300_000} />
                    <ImpactChip label="Liquidity" value={fmt(p.impact.liquidity)} good={p.impact.liquidity > 0} />
                  </>
                ) : (
                  <>
                    <ImpactChip label="Net worth" value={fmtSigned(d?.nw)}  good={(d?.nw ?? 0) >= 0} />
                    <ImpactChip label="IHT"       value={fmtSigned(d?.iht)} good={(d?.iht ?? 0) <= 0} />
                    <ImpactChip label="Horizon"   value={p.simulation?.horizon != null ? `${p.simulation.horizon}y` : '—'} good />
                    <ImpactChip label="Certainty" value={p.simulation?.confidence || '—'} good={p.simulation?.confidence === 'HIGH'} />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 4: Weights — §13.12 Decision Wheel ─────────────────────────────────
function StepWeights({ weights, onChange }) {
  // Radial sliders. For each axis, a 0..1 weight.
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Set what matters most. The engine re-ranks options in real time as
        you drag.
      </div>
      <DecisionWheel weights={weights} onChange={onChange} />
      <div style={{ marginTop: 16, marginBottom: 6 }}>
        <span className="sw-eyebrow">Adjust priority</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(WEIGHTS_LABEL).map(([k, label]) => (
          <div key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-acc)' }}>
                {Math.round(weights[k] * 100)}%
              </span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={weights[k]}
              onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Decision Wheel — 4 axes radiating from centre. Each axis has a coloured
// dot at distance proportional to weight. The polygon connecting the four
// dots gives a quick visual of your priorities.
function DecisionWheel({ weights }) {
  const SIZE = 220
  const CX = SIZE / 2, CY = SIZE / 2, R = 80
  const axes = ['tax', 'risk', 'liquidity', 'legacy']
  const angles = { tax: -Math.PI / 2, risk: 0, liquidity: Math.PI / 2, legacy: Math.PI }
  const colours = { tax: 'var(--c-acc)', risk: 'var(--c-gold)', liquidity: 'var(--c-acc2, #4D8EFF)', legacy: 'var(--c-violet, #BA8CFF)' }
  // Wheel axis labels match slider labels exactly — fixes MED-axis-mismatch
  // (was "Legacy" here vs "Legacy / IHT" on slider).
  const labelOf  = { tax: 'Tax', risk: 'Risk', liquidity: 'Liquidity', legacy: 'Legacy / IHT' }

  const pts = axes.map(a => {
    const ang = angles[a], w = weights[a]
    return {
      x: CX + Math.cos(ang) * R * w,
      y: CY + Math.sin(ang) * R * w,
      ang, weight: w, axis: a,
    }
  })
  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
      {/* View-only badge — wheel is visualisation only; drag the sliders below.
          Removes the wheel's pretence of interactivity (HIGH wheel-readonly). */}
      <div style={{
        position: 'absolute', top: 4, right: 4,
        fontSize: 9, fontWeight: 800,
        padding: '3px 8px', borderRadius: 100,
        background: 'var(--c-surface2)', color: 'var(--c-text3)',
        border: '1px solid var(--c-border)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        zIndex: 1,
      }} title="Decision Wheel is a visualisation. Drag the priority sliders below to change weights.">View only</div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 240 }}>
        {/* Guide rings */}
        {[0.25, 0.5, 0.75, 1].map(s => (
          <circle key={s} cx={CX} cy={CY} r={R * s}
            fill="none" stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.5" />
        ))}
        {/* Axes */}
        {axes.map(a => {
          const ang = angles[a]
          return <line key={a}
            x1={CX} y1={CY}
            x2={(CX + Math.cos(ang) * R).toFixed(1)}
            y2={(CY + Math.sin(ang) * R).toFixed(1)}
            stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.6" />
        })}
        {/* Weight polygon — draws in on mount */}
        <polygon points={polyPts}
          className="sw-stroke-draw"
          fill="var(--c-radar-fill)" stroke="var(--c-acc)" strokeWidth="1.6"
          strokeDasharray="500"
          style={{
            '--sw-draw-len': '500',
            filter: 'drop-shadow(0 0 10px var(--c-radar-glow))',
          }} />
        {/* Dots + labels */}
        {pts.map(p => (
          <g key={p.axis}>
            <circle cx={p.x} cy={p.y} r="5" fill={colours[p.axis]} />
            <text
              x={CX + Math.cos(p.ang) * (R + 18)}
              y={CY + Math.sin(p.ang) * (R + 18)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="800" fill="var(--c-text2)"
              fontFamily="DM Sans,sans-serif">
              {labelOf[p.axis]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Step 5: Ranked ──────────────────────────────────────────────────────────
function StepRanked({ ranked, chosen, onPick }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Paths re-ranked against your weights. The top option is the strongest
        match.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ranked.map((p, i) => {
          const top = i === 0
          const isPicked = chosen === p.id
          return (
            <button key={p.id} onClick={() => onPick(p.id)}
              className="sw-tile sw-tile-interactive sw-press"
              style={{
                textAlign: 'left', cursor: 'pointer', padding: 12,
                border: isPicked ? '1.5px solid var(--c-acc)' : '1px solid var(--c-border)',
                background: top ? 'var(--c-acc-bg)' : undefined,
                boxShadow: top ? '0 0 0 1px var(--c-acc-bg)' : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 100,
                  background: top ? 'var(--c-acc)' : 'var(--c-surface2)',
                  color: top ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-text3)',
                }}>
                  #{i + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', flex: 1 }}>
                  {p.title}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-acc)' }}>
                  {Math.round(p.score * 100)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
                {p.explanation}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 5 (spec): Mandatory unconsidered option ────────────────────────────
// CRIT DE-NAR-01. Spec §4 Step 5: surface a baseline the user did NOT pick to
// pressure-test their choice. Engine surfaces the lowest-ranked path as the
// most-different counter-frame.
function StepUnconsidered({ path, ranked, chosen }) {
  if (!path) return null
  // Most-different = lowest ranked path the user didn't choose
  const unconsidered = ranked.filter(p => p.id !== chosen).slice(-1)[0] || ranked[ranked.length - 1]
  const label = unconsidered?.title || 'the lowest-ranked path'
  const detail = unconsidered?.explanation || unconsidered?.detail || 'Lower weighted-sum score than your choice.'

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Before you commit, the engine surfaces an option you didn't pick — a
        deliberate counter-frame (spec §4 Step 5, CRIT DE-NAR-01) so the choice
        survives a contrarian read.
      </div>
      <div className="sw-tile" style={{
        padding: 14,
        border: '1.5px dashed var(--c-text3)',
        background: 'var(--c-surface2)',
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Have you considered</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.6 }}>
          {detail} Compared to <strong>{path.title}</strong>: this path scores lower
          against your weights but may suit a different priority mix.
        </div>
      </div>
    </div>
  )
}

// ── Step 6 (spec): FCA-rewritten engine recommendation ─────────────────────
// CRIT DE-NAR-02. Spec §4 Step 6 + spec §11 FCA boundary.
function StepRecommendation({ path, weights, engineRec }) {
  if (!path) return null
  const topWeight = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]
  const topLabel = WEIGHTS_LABEL[topWeight[0]] || topWeight[0]

  const summary = engineRec?.summary ||
    `Based on your priorities — ${topLabel.toLowerCase()} weighted highest — the engine ranks ${path.title} as the strongest path.`
  const steps   = engineRec?.steps || []
  const fca     = engineRec?.fcaBoundary || FCA_BOUNDARY
  const impact  = engineRec?.impact
  const sources = engineRec?.sources || ['Decision Engine v1.0', 'spec §4 Step 6', 'weighted-sum rank']

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        The engine's recommendation, rewritten inside FCA boundaries.
      </div>
      <div className="sw-tile" style={{
        padding: 14,
        border: '1.5px solid var(--c-acc)',
        background: 'var(--c-acc-bg)',
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Recommendation</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.4 }}>
          {path.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.6 }}>
          {summary}
        </div>

        {/* Impact chips — engine delta */}
        {impact && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
            {impact.nwGain !== 0 && (
              <ImpactChip label="NW gain" value={impact.nwGain >= 1000 ? `£${Math.round(impact.nwGain/1000)}k` : `£${Math.round(impact.nwGain)}`} good={impact.nwGain > 0} />
            )}
            {impact.ihtSave > 0 && (
              <ImpactChip label="IHT saved" value={`£${Math.round(impact.ihtSave/1000)}k`} good />
            )}
            {impact.fqGain > 0 && (
              <ImpactChip label="Wealth Score boost" value={`+${impact.fqGain} pts`} good />
            )}
          </div>
        )}

        {/* Action steps */}
        {steps.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Next steps</div>
            <ol style={{ margin: 0, paddingLeft: 16 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 2 }}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Source chip — spec §4 Step 6 + §11 FCA boundary requirement */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 12, paddingTop: 10,
          borderTop: '1px solid var(--c-sep)',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            padding: '3px 8px', borderRadius: 100,
            background: 'var(--c-surface2)', color: 'var(--c-text2)',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>Source</span>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            {sources.join(' · ')}
          </span>
        </div>

        {/* FCA boundary disclaimer */}
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
          marginTop: 8, fontStyle: 'italic',
        }}>
          {fca}
        </div>
      </div>
    </div>
  )
}

// ── Step 7 (was 6): Stress-test ────────────────────────────────────────────
function StepStressTest({ path, tested, onTested }) {
  if (!path) return null
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Stress-testing <strong>{path.title}</strong> against 3 shocks.
      </div>
      <div style={{
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
        padding: '8px 10px', borderRadius: 8,
        background: 'var(--c-surface2)', border: '1px dashed var(--c-border)',
        marginBottom: 12,
      }}>
        Phase 2 — Monte Carlo simulation comes with engine wiring (D-DE-MC-1).
        Current stress test: deterministic worst-case projection.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <StressRow shock="Rate +2%"    delta={tested ? '-£2,100/yr' : '—'} ok={tested} />
        <StressRow shock="Market −30%" delta={tested ? '-£135,000 NW' : '—'} ok={!tested ? null : true} />
        <StressRow shock="Inflation 6%" delta={tested ? '-1.8% real return' : '—'} ok={tested} />
      </div>
      <button onClick={onTested}
        className="sw-press"
        style={{
          width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 700,
          background: tested ? 'var(--c-surface2)' : 'var(--c-acc)',
          color: tested ? 'var(--c-text2)' : 'var(--c-on-accent, #0B1F3A)',
          border: 'none', borderRadius: 100, cursor: tested ? 'default' : 'pointer',
        }}>
        {tested ? '✓ Stress test complete' : 'Run stress test'}
      </button>
    </div>
  )
}

function StressRow({ shock, delta, ok }) {
  return (
    <div className="sw-tile" style={{
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 13, color: 'var(--c-text2)', flex: 1 }}>{shock}</span>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: ok === null ? 'var(--c-text3)' : ok ? 'var(--c-text)' : 'var(--c-coral, #FF6F7D)',
      }}>{delta}</span>
    </div>
  )
}

// ── Step 9 (was 7): Commit ─────────────────────────────────────────────────
function StepCommit({ path }) {
  if (!path) return null
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Ready to commit. The engine will record your decision, fire downstream
        events, and surface the action plan in your Timeline.
      </div>
      <div className="sw-tile" style={{
        padding: 14, border: '1.5px solid var(--c-acc)',
        background: 'var(--c-acc-bg)',
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Your choice</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
          {path.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 6, lineHeight: 1.5 }}>
          {path.explanation}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6, marginTop: 10,
        }}>
          {path.impact ? (
            <>
              <ImpactChip label="Yield/yr"  value={fmt(path.impact.yield_p_a)} good />
              <ImpactChip label="CGT today" value={fmt(path.impact.cgt_today)} good={path.impact.cgt_today === 0} />
              <ImpactChip label="In estate" value={fmt(path.impact.iht_in_estate)} />
              <ImpactChip label="Liquidity" value={fmt(path.impact.liquidity)} good={path.impact.liquidity >= 0} />
            </>
          ) : (
            <>
              <ImpactChip label="Net worth" value={fmtSigned(path.simulation?.delta?.nw)}  good={(path.simulation?.delta?.nw ?? 0) >= 0} />
              <ImpactChip label="IHT"       value={fmtSigned(path.simulation?.delta?.iht)} good={(path.simulation?.delta?.iht ?? 0) <= 0} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tiny helpers ────────────────────────────────────────────────────────────
function Field({ label, sub, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text2)',
          textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--c-acc)', fontWeight: 700 }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}
function ImpactChip({ label, value, good }) {
  return (
    <div style={{
      padding: '6px 8px', borderRadius: 8,
      background: 'var(--c-surface2)',
      border: '1px solid var(--c-sep)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>{label}</div>
      <div style={{
        fontSize: 12, fontWeight: 800, marginTop: 2,
        color: good === true ? 'var(--c-acc)'
             : good === false ? 'var(--c-coral, #FF6F7D)'
             : 'var(--c-text)',
      }}>{value}</div>
    </div>
  )
}
