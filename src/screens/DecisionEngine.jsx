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

import { useMemo, useState, useEffect } from 'react'
import { simulateAction, enumeratePaths, generateRecommendation, stressTest } from '../engine/decision-engine.js'
import { objectiveFor, optionGloss } from '../engine/decision-content.js'
import { PathComparisonChart, DecisionTrajectoryChart, BeforeAfterBar } from '../components/Decisions/DecisionCharts.jsx'
import { checklistFor, reviewHintFor } from '../engine/decision-commit-content.js'
import { DECISION_TYPES_ALL, DECISION_CATEGORIES } from '../engine/decision-catalogue.js'

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
// DECISION_TYPES_ALL + DECISION_CATEGORIES now live in
// ../engine/decision-catalogue.js (shared with the per-screen DecisionDrawers).

// Phase 1: hardcoded scores. Phase 2 will route through simulateAction() →
// enumeratePaths() → readAssetPicture() per spec §5. Real implementation calls
// computeDecisionPaths(decisionType, entity, bundle) and renders the output.
const PROPERTY_PATHS = [
  {
    id: 'keep_use',
    title: 'Keep it and live in it',
    sub:   'Your main home — no capital gains tax when you sell.',
    impact: {
      yield_p_a:    0,
      cgt_today:    0,
      iht_in_estate: 450_000,
      liquidity:    0,
      complexity:   1,
    },
    scores: { tax: 0.6, risk: 0.7, liquidity: 0.2, legacy: 0.5 },
    explanation: 'No income, and no capital gains tax to pay. Stays in your estate at full value, so it could be taxed when you die unless the main-home allowance applies.',
  },
  {
    id: 'let',
    title: 'Rent it out',
    sub:   'Earn rent — but landlord rules limit your mortgage tax relief.',
    impact: {
      yield_p_a:    16_700,  // net rent, after mortgage/management overhead
      cgt_today:    0,
      iht_in_estate: 450_000,
      liquidity:    0,        // renting frees up NO lump sum — you keep the asset.
                              // (overhead is a cost, already netted in yield_p_a —
                              // it is not a change in cash freed up. Founder 2026-06-06.)
      complexity:   3,
    },
    scores: { tax: 0.3, risk: 0.4, liquidity: 0.5, legacy: 0.5 },
    explanation: 'Earns rent after costs, but the landlord rules limit how much mortgage interest you can offset against tax. Still counts toward your estate, with tenants and upkeep to manage.',
  },
  {
    id: 'sell_isa',
    title: 'Sell and move into tax-free wrappers',
    sub:   'Pay capital gains tax now; shelter the rest from future tax.',
    impact: {
      yield_p_a:    18_500,
      cgt_today:    35_000, // CGT on gain
      iht_in_estate: 250_000, // pension portion out of estate til 2027
      liquidity:    415_000,
      complexity:   2,
    },
    scores: { tax: 0.7, risk: 0.6, liquidity: 0.95, legacy: 0.7 },
    explanation: 'You pay capital gains tax now, but free up a large lump of cash. Moving it into an ISA and a pension shelters future growth from tax and trims your estate.',
  },
  {
    id: 'sell_btl_replace',
    title: 'Sell and buy a higher-income rental',
    sub:   'More rental income, but your money stays tied up in property.',
    impact: {
      yield_p_a:    22_400,
      cgt_today:    35_000,
      iht_in_estate: 450_000,
      liquidity:    0,
      complexity:   4,
    },
    scores: { tax: 0.4, risk: 0.5, liquidity: 0.2, legacy: 0.5 },
    explanation: 'Earns more rent, but ties your money up in property again. Capital gains tax is due on the sale, and your money stays concentrated in one type of asset.',
  },
]

const WEIGHTS_LABEL = {
  tax:       'Tax efficiency',
  risk:      'Risk level',
  liquidity: 'Access to cash',
  legacy:    'Inheritance',
}

// Plain Title-case for the engine's HIGH/MED/LOW confidence enum (consistent with
// the chart's wording; never show raw "HIGH" to the user).
const CONF_LABEL = { HIGH: 'High', MED: 'Medium', MEDIUM: 'Medium', LOW: 'Low' }

// Single £ format rule across the engine UI (founder 2026-06-06): exact with
// commas below £10k (so £2,030 isn't lossily shown as "£2k"), £k to £999k, £m above.
function fmt(n) {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1_000_000) return `£${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`
  if (a >= 10_000)    return `£${Math.round(a / 1000)}k`
  return `£${Math.round(a).toLocaleString('en-GB')}`
}

// Signed £ for engine deltas (e.g. net-worth / IHT change per path).
function fmtSigned(n) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${sign}£${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`
  if (a >= 10_000)    return `${sign}£${Math.round(a / 1000)}k`
  return `${sign}£${Math.round(a).toLocaleString('en-GB')}`
}

// Objective banner — frames every decision in plain English (founder 2026-06-06:
// "I don't understand the options … what are the goals and objectives"). Reads
// decision-content.js. Renders across all steps once a decision is chosen.
function ObjectiveBanner({ code }) {
  const obj = objectiveFor(code)
  if (!obj) return null
  const Row = ({ label, text, accent }) => (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{
        fontSize: 10, fontWeight: 800, minWidth: 82, flexShrink: 0,
        color: accent ? 'var(--c-acc)' : 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 1,
      }}>{label}</span>
      <span style={{
        fontSize: 12.5, lineHeight: 1.5, flex: 1,
        color: accent ? 'var(--c-text)' : 'var(--c-text2)',
        fontWeight: accent ? 600 : 400,
      }}>{text}</span>
    </div>
  )
  return (
    <div className="sw-tile" style={{
      padding: 14, marginBottom: 16,
      border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>The decision</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.4, marginBottom: 10 }}>
        {obj.decision}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row label="Why it matters" text={obj.why} />
        <Row label="Your goal" text={obj.goal} accent />
      </div>
    </div>
  )
}

export default function DecisionEngine({ onBack, onCommit, entity, onAskAI, initialDecisionId }) {
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

  // Deep-link: opened from a per-screen "Decisions you can make here" drawer
  // with a specific decision → skip the catalogue and start inside it.
  useEffect(() => {
    if (!initialDecisionId) return
    const d = DECISION_TYPES_ALL.find(x => x.id === initialDecisionId)
    if (d) {
      setDecision({ id: d.id.toLowerCase().replace(/-/g, '_'), code: d.id, title: d.title, icon: '◆' })
      setChosen(null)
      setStep(1)
    }
  }, [initialDecisionId])

  // Computed paths: for DE-09 (property canonical example) use hardcoded
  // PROPERTY_PATHS; for all other live types use enumeratePaths() from engine.
  const computedPaths = useMemo(() => {
    if (!decision) return []
    const decId = decision.code || decision.id
    // Attach the plain-English option gloss (founder 2026-06-06) to every path so
    // each step can show "what this option means" + "good if…" in plain words.
    const withGloss = (arr) => (arr || []).map(p => {
      const g = optionGloss(decId, p.id)
      return { ...p, plainLabel: g?.plain || null, goodIf: g?.goodIf || null }
    })
    if (decId === 'DE-09') return withGloss(PROPERTY_PATHS.map(p => ({
      // Keep impact (drives the 4 property chips); add a comparable simulation so
      // the comparison chart renders. nw proxy = cash freed up by the option.
      ...p,
      simulation: p.simulation || { delta: { nw: p.impact?.liquidity || 0, iht: (p.impact?.iht_in_estate ?? 0) - 450000 } },
    })))
    try {
      // Engine paths use {id,label,riskLevel,detail,simulation}; the wizard's
      // step components were built for the property-path shape {title,sub,impact}.
      // Normalise so every step renders for all 40 cases (not just DE-09).
      const raw = enumeratePaths(entity, decId)
      return withGloss((raw || []).map(p => ({
        ...p,
        title: p.title || p.label,
        sub:   p.sub || (p.riskLevel ? `${p.riskLevel[0].toUpperCase()}${p.riskLevel.slice(1)} risk` : ''),
      })))
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
    // Timeline-ready record (founder 2026-06-06: committed decisions must SHOW on
    // Timeline, not just hit the event log). Matches Timeline's decision-log shape.
    commitEvent.record = {
      id: `${commitEvent.type}-${Date.now()}`,
      title: decision?.title || commitEvent.type,
      detail: `Chose: ${final?.plainLabel || final?.title || '—'}${engineRec?.impact?.nwGain ? ` · net worth ${fmtSigned(engineRec.impact.nwGain)} over ${engineRec.impact.horizon}y` : ''}`,
      date: commitEvent.timestamp.substring(0, 10),
      committed_at: commitEvent.timestamp,
      impact: { fqDelta: engineRec?.impact?.fqGain ?? null },
      source: 'Choices',
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
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-acc)' }}>Choice committed</div>
        <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6 }}>
          Saved to your choices. Taking you to your Timeline…
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
          <div className="sw-eyebrow">Choices</div>
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

      {/* Objective banner — frames the decision in plain English on every step
          after the catalogue (founder 2026-06-06). */}
      {decision && step > 0 && <ObjectiveBanner code={decision.code || decision.id} />}

      {step === 0 && (
        <StepIdentify decision={decision} onPick={(d) => { setDecision(d); setChosen(null); setStep(1) }} onAskAI={onAskAI} />
      )}
      {step === 1 && decision && (
        <StepContext context={context} onChange={setContext} />
      )}
      {step === 2 && decision && (
        <StepOptions paths={computedPaths} decId={decision.code || decision.id} />
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
          entity={entity}
          decId={decision.code || decision.id}
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          tested={stressTested}
          onTested={() => setStressTested(true)}
        />
      )}
      {step === 8 && decision && (
        <StepCommit
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          decId={decision.code || decision.id}
          engineRec={engineRec}
        />
      )}

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button onClick={back} disabled={step === 0} className="sw-press" style={{
          padding: '10px 16px', fontSize: 13, minHeight: 44, fontWeight: 700,
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
  const titleOf = (id) => (DECISION_TYPES_ALL.find(x => x.id === id) || {}).title || id
  const [openCats, setOpenCats] = useState(() => new Set())
  const toggleCat = (id) => setOpenCats(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const Row = (id) => (
    <button key={id}
      onClick={() => onPick({ id: id.toLowerCase().replace(/-/g, '_'), code: id, title: titleOf(id), icon: '◆' })}
      className="sw-tile sw-tile-interactive sw-press"
      style={{
        textAlign: 'left', cursor: 'pointer', padding: '10px 12px', width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        border: '1px solid var(--c-border)', marginBottom: 4,
      }}>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
        background: 'var(--c-acc-bg)', color: 'var(--c-acc)', minWidth: 44, textAlign: 'center', flexShrink: 0 }}>{id}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)', textAlign: 'left' }}>{titleOf(id)}</span>
      <span style={{ fontSize: 16, color: 'var(--c-text3)', fontWeight: 700, flexShrink: 0 }}>›</span>
    </button>
  )

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Pick a topic, then a decision to work through. The engine scores the
        options against your priorities and rewrites the recommendation inside
        FCA boundaries.
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

      {/* Categorised drawers — tap a topic to expand its decisions. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DECISION_CATEGORIES.map(cat => {
          const ids = cat.ids.filter(id => liveTypes.some(d => d.id === id))
          if (!ids.length) return null
          const open = openCats.has(cat.id)
          return (
            <div key={cat.id} className="sw-tile" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
              <button
                onClick={() => toggleCat(cat.id)}
                aria-expanded={open}
                className="sw-press"
                style={{
                  width: '100%', cursor: 'pointer', background: open ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
                  border: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <span style={{ fontSize: 16, color: 'var(--c-acc)', width: 22, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>{cat.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)' }}>{ids.length}</span>
                <span style={{ fontSize: 14, color: 'var(--c-text3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', width: 14, textAlign: 'center' }}>›</span>
              </button>
              {open && (
                <div style={{ padding: '8px 10px 4px' }}>
                  {ids.map(id => Row(id))}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
        A few details about your situation, so the options are weighed against what matters to you.
      </div>
      <Field label="How long you're planning for" sub={`${context.holdYears} years`}>
        <input type="range" min="0" max="30" value={context.holdYears}
          onChange={(e) => onChange({ ...context, holdYears: Number(e.target.value) })}
          style={{ width: '100%' }} />
      </Field>
      <Field label="Income you'd like each year" sub={fmt(context.targetIncome)}>
        <input type="range" min="0" max="60000" step="500" value={context.targetIncome}
          onChange={(e) => onChange({ ...context, targetIncome: Number(e.target.value) })}
          style={{ width: '100%' }} />
      </Field>
      <Field label="How much risk you're comfortable with">
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

// Decisions where time is the point — they get a trajectory chart on top of the
// comparison bars (pension contributions, mortgage overpay-vs-invest, drawdown
// timing). The trajectory self-hides if before/after data is missing.
const TIME_BASED_DECISIONS = new Set(['DE-01', 'DE-02', 'DE-03', 'DE-04', 'DE-05', 'DE-08'])

// ── Step 3: Options ─────────────────────────────────────────────────────────
function StepOptions({ paths, decId }) {
  const isProperty = decId === 'DE-09'
  // Headline metric = the FIRST that actually differs between options, so every
  // decision shows a real comparison: net worth → inheritance tax → financial-
  // health score. If none differ numerically (e.g. wills/POA differ in approach
  // not in your numbers) we say so rather than drawing identical bars. The chart
  // OWNS this metric — the option cards below show only the other figures, so no
  // number is shown twice (founder 2026-06-06: charts were redundant + anemic).
  const varies = (key) => new Set(paths.map(p => Math.round((p.simulation?.delta?.[key]) || 0))).size > 1
  const chartKey = varies('nw') ? 'nw' : varies('iht') ? 'iht' : varies('fq') ? 'fq' : null
  const showTrajectory = TIME_BASED_DECISIONS.has(decId)
  const horizon = paths[0]?.simulation?.horizon
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Here are <strong>{paths.length}</strong> ways to go, each worked out with your own
        numbers. You don't choose yet — the next step lets you set what matters most.
      </div>
      {chartKey ? (
        <div style={{ marginBottom: 14 }}>
          <PathComparisonChart
            paths={paths}
            valueKey={chartKey}
            axisLabel={isProperty && chartKey === 'nw' ? 'Cash freed up vs today' : undefined}
          />
        </div>
      ) : (
        <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 14, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
          These options differ in <strong>approach and risk</strong>, not in your headline numbers —
          compare the details on each below.
        </div>
      )}
      {showTrajectory && (
        <div style={{ marginBottom: 14 }}>
          <DecisionTrajectoryChart paths={paths} horizon={horizon} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paths.map(p => {
          const d = p.simulation?.delta
          // Build the chip set, EXCLUDING whatever the headline chart already
          // shows, so the card never repeats the chart's number.
          const chips = []
          if (p.impact) {
            chips.push({ label: 'Income / yr', value: fmt(p.impact.yield_p_a), good: p.impact.yield_p_a > 0 })
            chips.push({ label: 'Tax to pay now', value: fmt(p.impact.cgt_today), good: p.impact.cgt_today === 0 })
            chips.push({ label: 'Left in your estate', value: fmt(p.impact.iht_in_estate), good: p.impact.iht_in_estate < 300_000 })
            if (chartKey !== 'nw') chips.push({ label: 'Cash freed up', value: fmt(p.impact.liquidity), good: p.impact.liquidity > 0 })
          } else {
            if (chartKey !== 'nw') chips.push({ label: 'Net worth', value: fmtSigned(d?.nw), good: (d?.nw ?? 0) >= 0 })
            if (chartKey !== 'iht') chips.push({ label: 'Inheritance tax', value: fmtSigned(d?.iht), good: (d?.iht ?? 0) <= 0 })
            chips.push({ label: 'Time frame', value: p.simulation?.horizon != null ? `${p.simulation.horizon}y` : '—', good: true })
            chips.push({ label: 'Confidence', value: CONF_LABEL[p.simulation?.confidence] || p.simulation?.confidence || '—', good: p.simulation?.confidence === 'HIGH' })
          }
          return (
            <div key={p.id} className="sw-tile" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>{p.plainLabel || p.title || p.label}</div>
              {p.goodIf && (
                <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 3, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 700, color: 'var(--c-acc)' }}>Good if</span> {p.goodIf}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.45 }}>{p.sub || p.detail}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 4, marginTop: 8 }}>
                {chips.map((c, ci) => (
                  <ImpactChip key={ci} label={c.label} value={c.value} good={c.good} />
                ))}
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
  const labelOf  = { tax: 'Tax', risk: 'Risk', liquidity: 'Cash', legacy: 'Estate' }

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
        Your options, re-ordered by what you said matters most. The one at the
        top fits your priorities best.
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
                  {p.plainLabel || p.title}
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
  const label = unconsidered?.plainLabel || unconsidered?.title || 'the lowest-ranked path'
  const detail = unconsidered?.explanation || unconsidered?.detail || 'Lower weighted-sum score than your choice.'

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Before you decide, here's an option you didn't pick — shown on purpose,
        so your choice holds up even against the opposite view.
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
          {detail} Compared to <strong>{path.plainLabel || path.title}</strong>: this path scores lower
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
    `Based on your priorities — ${topLabel.toLowerCase()} weighted highest — the engine ranks ${path.plainLabel || path.title} as the strongest path.`
  const steps   = engineRec?.steps || []
  const fca     = engineRec?.fcaBoundary || FCA_BOUNDARY
  const impact  = engineRec?.impact
  const sources = engineRec?.sources || ['Your data', 'UK tax rules 2026/27', 'Ranked by your priorities']

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        What stands out for your priorities — information to weigh up, not advice.
      </div>
      <div className="sw-tile" style={{
        padding: 14,
        border: '1.5px solid var(--c-acc)',
        background: 'var(--c-acc-bg)',
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Recommendation</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.4 }}>
          {path.plainLabel || path.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.6 }}>
          {summary}
        </div>

        {/* Impact chips — engine delta */}
        {impact && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6, marginTop: 10 }}>
            {impact.nwGain !== 0 && (
              <ImpactChip label="Net worth" value={fmtSigned(impact.nwGain)} good={impact.nwGain > 0} />
            )}
            {impact.ihtSave > 0 && (
              <ImpactChip label="Inheritance tax saved" value={fmt(impact.ihtSave)} good />
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
      {/* Before/after net-worth chart — engine decisions carry a before/after */}
      {path.simulation?.before?.nw != null && (
        <div style={{ marginTop: 12 }}>
          <BeforeAfterBar label="Net worth" before={path.simulation.before.nw} after={path.simulation.after.nw} />
        </div>
      )}
    </div>
  )
}

// ── Step 7 (was 6): Stress-test ────────────────────────────────────────────
function StepStressTest({ entity, decId, path, tested, onTested }) {
  const res = useMemo(() => {
    if (!path) return null
    try { return stressTest(entity, decId, path) } catch { return null }
  }, [entity, decId, path])
  if (!path) return null
  const shocks = res?.shocks || []
  const verdict = {
    resilient: { text: 'This option holds up well — it doesn’t rely on markets rising.', color: 'var(--c-acc)' },
    moderate:  { text: 'This option is moderately exposed — a downturn would dent it, not break it.', color: 'var(--c-gold, #E8B84B)' },
    sensitive: { text: 'This option leans on investment growth, so a market fall would reduce its benefit most.', color: 'var(--c-coral, #FF6F7D)' },
  }[res?.resilience || 'moderate']

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 6 }}>
        We re-run your choice — <strong>{path.plainLabel || path.title}</strong> — against three
        setbacks, using your own assets, to see if it still holds up.
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 12 }}>
        Illustrative worst-case, not a forecast.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {shocks.map(s => (
          <div key={s.id} className="sw-tile" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', flex: 1 }}>{s.label}</span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: !tested ? 'var(--c-text3)' : s.impact < 0 ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text3)',
              }}>{!tested ? '—' : s.impact === 0 ? 'No real impact' : fmtSigned(s.impact)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.45 }}>{s.plain}</div>
            {tested && <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 3 }}>Hits: {s.affects}</div>}
          </div>
        ))}
      </div>
      {tested && verdict && (
        <div className="sw-tile" style={{
          padding: '10px 12px', marginBottom: 14,
          border: `1px solid ${verdict.color}`, background: 'var(--c-surface2)',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--c-text)', lineHeight: 1.5 }}>{verdict.text}</span>
        </div>
      )}
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
// Collapsible-free section wrapper for the commit step's four parts.
function CommitSection({ eyebrow, title, children }) {
  return (
    <div className="sw-tile" style={{ padding: 14, marginTop: 10, border: '1px solid var(--c-border)' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>
      {title && <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  )
}

// Plain-text adviser-ready summary (founder 2026-06-06) — shareable so a user can
// hand it to an FCA-authorised adviser to action. Information, not advice.
function buildAdviserSummary({ decId, path, steps, reviewHint, engineRec }) {
  const obj = objectiveFor(decId)
  const L = []
  L.push('SONUSWEALTH — DECISION SUMMARY')
  L.push('')
  if (obj?.decision) L.push(`Decision: ${obj.decision}`)
  L.push(`Chosen option: ${path?.plainLabel || path?.title || '—'}`)
  if (engineRec?.impact) {
    const i = engineRec.impact
    L.push(`Projected impact (illustrative, over ${i.horizon}y): net worth ${fmtSigned(i.nwGain)}${i.ihtSave ? `, inheritance tax saved ~${fmt(i.ihtSave)}` : ''}.`)
  }
  if (engineRec?.summary) { L.push(''); L.push(`Why: ${engineRec.summary}`) }
  if (steps?.length) { L.push(''); L.push('Action checklist:'); steps.forEach((s, i) => L.push(`  ${i + 1}. ${s}`)) }
  if (engineRec?.methodology?.assumptions?.length) { L.push(''); L.push('Assumptions:'); engineRec.methodology.assumptions.forEach(a => L.push(`  - ${a}`)) }
  if (reviewHint) { L.push(''); L.push(`When to revisit: ${reviewHint}`) }
  L.push('')
  L.push('Basis: UK 2026/27 tax rules. Information and guidance only — NOT regulated financial advice. Verify with an FCA-authorised adviser before acting.')
  return L.join('\n')
}

function StepCommit({ path, decId, engineRec }) {
  const [copied, setCopied] = useState(false)
  if (!path) return null
  const checklist  = checklistFor(decId, path.id)
  const steps      = checklist.length ? checklist : (engineRec?.steps || [])
  const reviewHint = reviewHintFor(decId)
  const methodology = engineRec?.methodology
  const summaryText = buildAdviserSummary({ decId, path, steps, reviewHint, engineRec })
  const copy = () => {
    try { navigator.clipboard?.writeText(summaryText); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Ready to save. This records your decision and its action plan to your Timeline —
        it doesn’t action anything with any provider. It’s your record and plan.
      </div>

      {/* Your choice */}
      <div className="sw-tile" style={{ padding: 14, border: '1.5px solid var(--c-acc)', background: 'var(--c-acc-bg)' }}>
        <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Your choice</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)' }}>
          {path.plainLabel || path.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 6, lineHeight: 1.5 }}>
          {path.explanation || path.detail}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 10 }}>
          {path.impact ? (
            <>
              <ImpactChip label="Income / yr"  value={fmt(path.impact.yield_p_a)} good />
              <ImpactChip label="Tax to pay now" value={fmt(path.impact.cgt_today)} good={path.impact.cgt_today === 0} />
              <ImpactChip label="Left in your estate" value={fmt(path.impact.iht_in_estate)} />
              <ImpactChip label="Cash freed up" value={fmt(path.impact.liquidity)} good={path.impact.liquidity >= 0} />
            </>
          ) : (
            <>
              <ImpactChip label="Net worth" value={fmtSigned(path.simulation?.delta?.nw)}  good={(path.simulation?.delta?.nw ?? 0) >= 0} />
              <ImpactChip label="Inheritance tax"       value={fmtSigned(path.simulation?.delta?.iht)} good={(path.simulation?.delta?.iht ?? 0) <= 0} />
            </>
          )}
        </div>
      </div>

      {/* 1 — Action checklist */}
      {steps.length > 0 && (
        <CommitSection eyebrow="Your action checklist" title="How to put this into action">
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 4 }}>{s}</li>
            ))}
          </ol>
        </CommitSection>
      )}

      {/* 2 — When to revisit */}
      {reviewHint && (
        <CommitSection eyebrow="When to revisit">
          <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5 }}>{reviewHint}</div>
        </CommitSection>
      )}

      {/* 3 — Adviser-ready summary */}
      <CommitSection eyebrow="Adviser-ready summary">
        <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10 }}>
          A plain summary of this decision — your choice, the options weighed, the assumptions,
          and the rule sources — to hand to an FCA-authorised adviser to action.
        </div>
        <button onClick={copy} className="sw-press" style={{
          padding: '8px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
          background: copied ? 'var(--c-surface2)' : 'var(--c-acc)',
          color: copied ? 'var(--c-text2)' : 'var(--c-on-accent, #0B1F3A)',
          border: 'none', borderRadius: 100,
        }}>{copied ? '✓ Copied to clipboard' : 'Copy summary'}</button>
      </CommitSection>

      {/* 4 — Methodology receipt */}
      {methodology && (
        <CommitSection eyebrow="How this was worked out">
          <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 8 }}>{methodology.basis}</div>
          {methodology.assumptions?.length > 0 && (
            <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
              {methodology.assumptions.map((a, i) => (
                <li key={i} style={{ fontSize: 11.5, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 2 }}>{a}</li>
              ))}
            </ul>
          )}
          {methodology.rules?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {methodology.rules.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--c-text2)', flex: 1 }}>{r.name}</span>
                  <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{r.value}</span>
                  <span style={{ color: 'var(--c-text3)', fontSize: 10 }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 8 }}>
            Rule set: {methodology.rulesVersion}
          </div>
        </CommitSection>
      )}
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
      padding: '6px 8px', borderRadius: 8, minWidth: 0,
      background: 'var(--c-surface2)',
      border: '1px solid var(--c-sep)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.4, overflowWrap: 'anywhere',
      }}>{label}</div>
      <div style={{
        fontSize: 12, fontWeight: 800, marginTop: 2, overflowWrap: 'anywhere',
        color: good === true ? 'var(--c-acc)'
             : good === false ? 'var(--c-coral, #FF6F7D)'
             : 'var(--c-text)',
      }}>{value}</div>
    </div>
  )
}
