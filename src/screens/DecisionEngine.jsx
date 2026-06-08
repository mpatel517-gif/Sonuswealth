// ─────────────────────────────────────────────────────────────────────────────
// DecisionEngine — Phase 3 module. 7-station decision flow with the §13.12
// Decision Wheel (now draggable) at the Priorities station.
//
// Spec: 2-Product-ai-decision-engine-v1_0.md. Property is canonical:
// "Should I keep, sell, or let my flat?" (value is the lever, not hard-coded).
//
// Founder 2026-06-06: every station must carry a lever, dynamic guidance, and a
// chart — and the flow must END in a multi-factor answer. The old 9-step flow
// had three stations that broke that bar (Weights had no on-screen consequence;
// Unconsidered + the thin Recommendation were narration). They're folded:
//   0. Identify the decision
//   1. Capture context
//   2. Options — model it: amount lever + comparison/trajectory charts
//   3. Priorities — drag priorities → options re-rank LIVE + counter-frame
//      (merges old Weights + Ranked + Unconsidered; DE-NAR-01)
//   4. Answer — the verdict + impact across every factor (DE-NAR-02)
//   5. Stress-test (Phase 2: Monte Carlo via D-DE-MC-1)
//   6. Commit (fires decision_committed event per spec §8)
//
// Phase 2 imports for engine wiring:
// import { simulateAction, enumeratePaths, readAssetPicture, generateRecommendation }
//   from '../engine/decision-engine.js'
// (decision-engine.js to be created in next wave — see CRIT DE-MATH-02.)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useRef } from 'react'
import { simulateAction, enumeratePaths, generateRecommendation, stressTest, marginalRateFor } from '../engine/decision-engine.js'
import { TAX } from '../engine/fq-calculator.js'
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
    bottomLine: 'Bottom line: keeps your home with no tax to pay — but it earns nothing and stays fully in your estate.',
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
    bottomLine: 'Bottom line: turns the home into yearly rental income — but you become a landlord and pay income tax on the rent.',
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
    bottomLine: 'Bottom line: frees a large lump sum and cuts your future tax — but you pay capital gains tax now.',
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
    bottomLine: 'Bottom line: more rental income — but your money stays locked in property and capital gains tax is due on the sale.',
    explanation: 'Earns more rent, but ties your money up in property again. Capital gains tax is due on the sale, and your money stays concentrated in one type of asset.',
  },
]

const WEIGHTS_LABEL = {
  tax:       'Tax efficiency',
  risk:      'Risk level',
  liquidity: 'Access to cash',
  legacy:    'Estate (inheritance)',  // leads with "Estate" to match the wheel label (cert F3: labels disagreed on one screen)
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
  // The amount lever (property value / contribution / gift …) lives at the WIZARD
  // level, not inside the Options step, so dragging it flows through to the
  // ranking, the Answer station and the Commit record — not just the Options
  // preview (founder 2026-06-06: the Answer/Commit figures were static because
  // the slider was trapped in the Options step's local state).
  const [leverVal, setLeverVal] = useState(null)
  // Per-option what-if overrides for DE-09, keyed by option id (founder 2026-06-06:
  // tap an option → model its OWN drivers). Empty = defaults; merged in computedPaths.
  const [optLevers, setOptLevers] = useState({})

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

  // The active lever config + resolved value (falls back to its default until the
  // user drags). Recomputing computedPaths from this is what makes every station
  // dynamic, not just the Options preview.
  const lever = decision ? leverFor(decision.code || decision.id) : null
  const leverValue = leverVal == null ? (lever?.def ?? 0) : leverVal
  // Marginal rate for the property what-if drawers (taxing rental income).
  const propMr = useMemo(() => { try { return marginalRateFor(entity) } catch { return 0.40 } }, [entity])

  // Reset the lever + per-option overrides to defaults whenever the decision
  // changes, so a value set for one decision (e.g. an £800k property) never leaks
  // into another (e.g. a pension contribution).
  useEffect(() => { setLeverVal(null); setOptLevers({}) }, [decision])

  // Computed paths: for DE-09 (property) recompute impacts from the property-value
  // lever + the entity's marginal rate; for levered engine decisions recompute
  // each path via simulateAction with the lever amount; otherwise enumeratePaths.
  const computedPaths = useMemo(() => {
    if (!decision) return []
    const decId = decision.code || decision.id
    // Attach the plain-English option gloss (founder 2026-06-06) to every path so
    // each step can show "what this option means" + "good if…" in plain words.
    const withGloss = (arr) => (arr || []).map(p => {
      const g = optionGloss(decId, p.id)
      return { ...p, plainLabel: g?.plain || null, goodIf: g?.goodIf || null }
    })
    if (decId === 'DE-09') {
      const mr = (() => { try { return marginalRateFor(entity) } catch { return 0.40 } })()
      return withGloss(PROPERTY_PATHS.map(p => {
        const impact = propertyImpact(p.id, leverValue, mr, optLevers[p.id])
        const netIncome = impact.yield_p_a - impact.income_tax_p_a
        return {
          ...p,
          impact,
          // delta drives the comparison chart + the engine-shaped reads: nw proxy =
          // cash freed; iht = change vs the (now dynamic) property value; income =
          // rent NET of income tax (honest comparison across options).
          simulation: { delta: { nw: impact.liquidity, iht: impact.iht_in_estate - leverValue, income: netIncome } },
        }
      }))
    }
    try {
      // Engine paths use {id,label,riskLevel,detail,simulation}; the wizard's
      // step components were built for the property-path shape {title,sub,impact}.
      // Normalise so every step renders for all 40 cases (not just DE-09).
      const raw = enumeratePaths(entity, decId)
      return withGloss((raw || []).map(p => {
        let sim = p.simulation
        // If this decision has an amount lever, recompute the path with it so the
        // ranking + Answer + Commit reflect the user's amount, not the default.
        if (lever && lever.param && entity) {
          try { sim = { ...(p.simulation || {}), ...simulateAction(entity, decId, { [lever.param]: leverValue, pathId: p.id, riskLevel: p.riskLevel }) } } catch { /* keep default sim */ }
        }
        return {
          ...p,
          simulation: sim,
          title: p.title || p.label,
          sub:   p.sub || (p.riskLevel ? `${p.riskLevel[0].toUpperCase()}${p.riskLevel.slice(1)} risk` : ''),
        }
      }))
    } catch { return [] }
  }, [decision, entity, lever, leverValue, optLevers])

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
  // 7 working stations (founder 2026-06-06: every step must carry a lever, live
  // guidance, a chart, and the flow must END in a multi-factor answer). The old
  // 9-step flow had three steps that broke that bar: Weights (sliders whose
  // consequence — the re-rank — lived on the NEXT screen, so it read "static"),
  // Unconsidered (pure narration), and a thin Recommendation. Those are folded:
  //  • Priorities = old Weights + Ranked + Unconsidered → drag a priority and the
  //    options re-order LIVE on the same screen (visible consequence), with the
  //    bottom option surfaced as the counter-frame.
  //  • Answer = rebuilt Recommendation → the verdict + impact across every factor
  //    (net worth, tax, inheritance, income/return, risk, access to cash).
  const STEPS = [
    'Identify',         // 0 — pick the decision (spec §4.1)
    'Context',          // 1 — your situation (spec §4.2)
    'Options',          // 2 — model it: lever + comparison/trajectory charts (§4.3)
    'Priorities',       // 3 — drag priorities → live re-rank + counter-frame (§4.4/4.5, DE-NAR-01)
    'Answer',           // 4 — the verdict + multi-factor impact (§4 Step 6, DE-NAR-02)
    'Stress-test',      // 5 — re-run against setbacks (§4.6)
    'Commit',           // 6 — save to Timeline + adviser summary (§4.7 + §8)
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
    if (step === 3) return chosen != null   // must pick on the Priorities step
    if (step === 5) return stressTested
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
      detail: `Chose: ${final?.plainLabel || final?.title || '—'}${engineRec?.impact?.nwGain ? ` · ${nwLabelFor(decision?.code || decision?.id).toLowerCase()} ${fmtSigned(engineRec.impact.nwGain)} over ${engineRec.impact.horizon}y` : ''}`,
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
          }}>← Back</button>
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
        <StepOptions
          paths={computedPaths}
          decId={decision.code || decision.id}
          lever={lever}
          leverVal={leverValue}
          onLever={setLeverVal}
          propValue={leverValue}
          propMr={propMr}
          optLevers={optLevers}
          onModelOption={(id, lv) => setOptLevers(prev => ({ ...prev, [id]: lv }))}
        />
      )}
      {step === 3 && decision && (
        <StepPriorities
          weights={weights}
          onChange={setWeights}
          ranked={ranked}
          chosen={chosen}
          onPick={setChosen}
        />
      )}
      {step === 4 && decision && (
        <StepAnswer
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          weights={weights}
          engineRec={engineRec}
          decId={decision.code || decision.id}
        />
      )}
      {step === 5 && decision && (
        <StepStressTest
          entity={entity}
          decId={decision.code || decision.id}
          path={ranked.find(p => p.id === chosen) || ranked[0]}
          tested={stressTested}
          onTested={() => setStressTested(true)}
        />
      )}
      {step === 6 && decision && (
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

// What the engine's nwDelta REALLY represents for decisions where it isn't net
// worth (founder 2026-06-06: premiums / loans / income / tax were mislabelled
// "Net worth"). Used to relabel the chip + chart axis. Absent → 'Net worth'.
const NW_METRIC_LABEL = {
  'DE-01': 'Tax saved',        'DE-02': 'Income uplift',
  'DE-11': 'Tax cost (5yr)',   'DE-12': 'Long-run loan cost',
  'DE-18': 'Cost avoided',
  'DE-19': 'Premium (10yr)',   'DE-20': 'Premium (5yr)',  'DE-21': 'Premium (5yr)',
  'DE-31': 'Savings drawn',  // cert: DE-31 maths fine; nwDelta is a drawdown, must not read "Net worth"
}
// G-6 (audit BM-3/BM-8): one quantity wears ONE label across EVERY station, so a
// tax saving never reads "Net worth" on the verdict/commit/adviser surfaces. This
// resolver was previously consumed only by the Options step. New per-decision keys
// are added in the calc-audit wave, where each decision's nwDelta semantics are
// confirmed against the engine — adding a wrong key here would itself be a mislabel.
const nwLabelFor = (decId) => NW_METRIC_LABEL[decId] || 'Net worth'
// Cost-type decisions where a "longer bar = better" comparison would give bad
// advice (cheapest cover / loan / tax exposure isn't "best"). Suppress the
// headline bar; the per-option figures + 'Good if' carry the comparison.
const SUPPRESS_NW_CHART = new Set(['DE-11', 'DE-12', 'DE-19', 'DE-20', 'DE-21', 'DE-40'])

// Continuous "model it" levers (PP-3 Goal-Seek): decisions where you control an
// AMOUNT. The Options step shows a slider bounded by the max allowed and
// recomputes the comparison live. `param` must match the simulateAction key.
function leverFor(decId) {
  const isa = TAX.isaAllowance || 20000
  const aa  = TAX.pensionAA || 60000
  const M = {
    'DE-03': { param: 'contribution',   label: 'How much you pay into your pension',  max: aa,     step: 1000,  def: Math.min(aa, 20000) },
    'DE-06': { param: 'isaAmount',      label: 'How much you put in an ISA this year', max: isa,   step: 500,   def: isa },
    'DE-08': { param: 'monthlySurplus', label: 'Spare money each month',              max: 3000,   step: 50,    def: 500, perMonth: true },
    'DE-15': { param: 'giftAmount',     label: 'How much you gift',                   max: 200000, step: 5000,  def: 50000 },
    'DE-26': { param: 'eisAmount',      label: 'How much you invest (EIS/SEIS)',      max: 200000, step: 5000,  def: 20000 },
    'DE-27': { param: 'vctAmount',      label: 'How much you invest in VCTs',         max: 200000, step: 5000,  def: 20000 },
    'DE-28': { param: 'bprAmount',      label: 'How much you hold in BPR assets',     max: 500000, step: 10000, def: 100000 },
    'DE-29': { param: 'donationAmount', label: 'How much you donate',                 max: 50000,  step: 1000,  def: 5000 },
    'DE-32': { param: 'redundancyAmount', label: 'Redundancy lump sum',               max: 200000, step: 5000,  def: 50000 },
    'DE-33': { param: 'inheritanceAmount', label: 'Inheritance received',             max: 500000, step: 10000, def: 100000 },
    'DE-35': { param: 'saleProceeds',   label: 'Business sale proceeds',              max: 2000000,step: 50000, def: 500000 },
    'DE-37': { param: 'cetvAmount',     label: 'Transfer value (CETV)',               max: 1000000,step: 25000, def: 400000 },
    'DE-05': { param: 'sacrifice',      label: 'How much salary you sacrifice',       max: 30000,  step: 1000,  def: 5000 },
    'DE-07': { param: 'bedIsaAmount',   label: 'How much you move into an ISA',       max: isa,    step: 500,   def: isa },
    'DE-12': { param: 'releaseAmount',  label: 'How much you release',                max: 300000, step: 10000, def: 60000 },
    'DE-22': { param: 'harvestAmount',  label: 'How much gain you crystallise',       max: 50000,  step: 1000,  def: TAX.cgaAllowance || 3000 },
    'DE-23': { param: 'lossAmount',     label: 'How much loss you realise',           max: 50000,  step: 1000,  def: 10000 },
    'DE-36': { param: 'loanAmount',     label: 'Director loan balance',               max: 200000, step: 5000,  def: 50000 },
    // Property is keep/let/sell (discrete), but its INPUT — the property's value —
    // is the lever: it drives rent, sale proceeds, CGT and estate. custom:'property'
    // recomputes the option impacts locally (DE-09 uses PROPERTY_PATHS, not the
    // engine), which also de-hardcodes the old fixed £450k example.
    'DE-09': { param: 'propertyValue', label: "Your property's value", min: 50000, max: 2000000, step: 25000, def: 450000, custom: 'property', hint: 'Starting figure is an estimate — drag to your property’s actual value.' },
  }
  return M[decId] || null
}

// DE-09 per-option what-if (founder 2026-06-06: "tap a bar → model THAT option").
// Each option exposes its OWN drivers — rent + costs for letting, purchase price +
// pension split for selling — so you model it independently, not just via the
// shared property value. `recomputePropertyOption` is the SINGLE model used for
// BOTH the default impact and the modelled impact, and `propertyDefaults` are set
// so the untouched drawer reproduces the headline numbers exactly (no jump).

// Slider specs shown in each option's what-if drawer. Bounds scale off the value.
function propertyLeverSpecs(id, V) {
  const v = Math.max(1, +V || 0)
  switch (id) {
    case 'keep_use': return [
      { key: 'roomRent', label: 'Let a spare room (£/yr)', min: 0, max: 20000, step: 500, hint: 'First £7,500/yr is tax-free (Rent-a-Room scheme).' },
    ]
    case 'let': return [
      { key: 'grossRent', label: 'Rent you charge (£/yr)', min: 0, max: Math.round(v * 0.09 / 500) * 500, step: 500, hint: 'Starting figure is an estimate (~5% of the value) — set your actual or expected rent.' },
      { key: 'costsPct',  label: 'Running costs', min: 0, max: 50, step: 1, unit: '%', hint: 'Letting agent, repairs, insurance, gaps between tenants.' },
    ]
    case 'sell_isa': return [
      { key: 'buyPrice',     label: 'What you originally paid', min: 0, max: Math.round(v / 5000) * 5000, step: 5000, hint: 'Sets the gain you pay CGT on.' },
      { key: 'toPensionPct', label: 'Share you move into a pension', min: 0, max: 100, step: 5, unit: '%', hint: 'A pension sits outside your estate; an ISA stays in it.' },
    ]
    case 'sell_btl_replace': return [
      { key: 'buyPrice', label: 'What you originally paid', min: 0, max: Math.round(v / 5000) * 5000, step: 5000, hint: 'Sets the gain you pay CGT on — starting figure is an estimate, use your actual purchase price.' },
      { key: 'newYield', label: 'New rental yield (gross)', min: 2, max: 10, step: 0.2, unit: '%' },
      { key: 'costsPct', label: 'Running costs', min: 0, max: 50, step: 1, unit: '%' },
    ]
    default: return []
  }
}

// Default lever values — chosen so recompute(defaults) reproduces the headline
// model (let: net rent = value×3.7%; sell: gain over a £125k base proxy; BTL:
// net yield ≈ 5%). Changing one driver only moves that option.
function propertyDefaults(id, V) {
  const v = Math.max(0, +V || 0)
  switch (id) {
    case 'keep_use':         return { roomRent: 0 }
    case 'let':              return { grossRent: Math.round(v * 0.05 / 500) * 500, costsPct: 26 }
    case 'sell_isa':         return { buyPrice: 125000, toPensionPct: 35 }
    case 'sell_btl_replace': return { buyPrice: 125000, newYield: 6.8, costsPct: 26 }
    default:                 return {}
  }
}

function recomputePropertyOption(id, lv, V, mr) {
  const v = Math.max(0, +V || 0)
  const AEA = TAX.cgaAllowance || 3000
  const rate = TAX.cgtHigher || 0.24
  const cgtOn = (gain) => Math.round(Math.max(0, gain - AEA) * rate)
  const taxRent = (rent) => Math.round(Math.max(0, rent) * mr)
  switch (id) {
    case 'keep_use': {
      const room = Math.max(0, lv.roomRent || 0)
      // Rent-a-Room: first £7,500/yr of room rent is tax-free.
      return { yield_p_a: room, income_tax_p_a: Math.round(Math.max(0, room - 7500) * mr), cgt_today: 0, iht_in_estate: v, liquidity: 0, complexity: 1 }
    }
    case 'let': {
      const gross = Math.max(0, lv.grossRent ?? Math.round(v * 0.05))
      const net = Math.round(gross * (1 - (lv.costsPct ?? 26) / 100))
      return { yield_p_a: net, income_tax_p_a: taxRent(net), cgt_today: 0, iht_in_estate: v, liquidity: 0, complexity: 3 }
    }
    case 'sell_isa': {
      const cgt = cgtOn(v - (lv.buyPrice ?? 125000))
      const net = Math.max(0, v - cgt)
      const inEstate = Math.round(net * (1 - (lv.toPensionPct ?? 33) / 100))
      return { yield_p_a: 0, income_tax_p_a: 0, cgt_today: cgt, iht_in_estate: inEstate, liquidity: net, complexity: 2 }
    }
    case 'sell_btl_replace': {
      const cgt = cgtOn(v - (lv.buyPrice ?? 125000))
      const gross = Math.round(v * (lv.newYield ?? 6.8) / 100)
      const net = Math.round(gross * (1 - (lv.costsPct ?? 26) / 100))
      return { yield_p_a: net, income_tax_p_a: taxRent(net), cgt_today: cgt, iht_in_estate: v, liquidity: 0, complexity: 4 }
    }
    default: return { yield_p_a: 0, income_tax_p_a: 0, cgt_today: 0, iht_in_estate: v, liquidity: 0, complexity: 1 }
  }
}

// Default impact (or modelled, when `overrides` supplied from the what-if drawer).
function propertyImpact(id, value, marginalRate = 0.40, overrides) {
  const V = Math.max(0, +value || 0)
  return recomputePropertyOption(id, { ...propertyDefaults(id, V), ...(overrides || {}) }, V, marginalRate)
}

// Option-aware factor list for a property option (founder 2026-06-06: "if CGT is
// £0 why show it when income tax is what affects this decision"). Shows ONLY the
// factors that are a real trade-off for THIS option — rent + its income tax for
// letting; cash + CGT for selling — and never a £0 line that isn't the point.
// Shared by the Options cards, the Answer station, and the Commit step so all
// three read identically. `dir`: good (accent) / bad (cost, coral) / neutral.
function propertyFactors(im, id) {
  if (!im) return []
  const F = []
  if (im.yield_p_a > 0) {
    // ONE income number = the net you keep, which is exactly the comparison bar
    // (founder 2026-06-06: the bar showed net while the card led with gross →
    // looked like a mismatch). Gross rent + the tax are the breakdown beneath it,
    // not competing headline figures.
    const net = Math.max(0, im.yield_p_a - im.income_tax_p_a)
    F.push({ label: 'Income you keep / yr', value: fmt(net), dir: 'good', note: `${fmt(im.yield_p_a)} rent after costs, less ${fmt(im.income_tax_p_a)} income tax.` })
    if (im.income_tax_p_a > 0) {
      F.push({ label: 'Income tax on rent / yr', value: fmtSigned(-im.income_tax_p_a), dir: 'bad', note: `Tax on the £${im.yield_p_a.toLocaleString('en-GB')} rent at your marginal rate.` })
    }
  } else if (id === 'keep_use') {
    F.push({ label: 'Income each year', value: 'None', dir: 'neutral', note: 'Living in it yourself produces no income.' })
  }
  if (im.cgt_today > 0) F.push({ label: 'Capital gains tax now', value: fmtSigned(-im.cgt_today), dir: 'bad', note: 'Tax on the gain if you sell now.' })
  if (im.liquidity > 0) F.push({ label: 'Cash freed up', value: fmt(im.liquidity), dir: 'good', note: 'Money released you could use or reinvest.' })
  F.push({ label: 'Stays in your estate', value: fmt(im.iht_in_estate), dir: 'neutral', note: 'Value that still counts towards inheritance tax — lower means a smaller estate, which suits you only if cutting IHT is your goal.' })
  return F
}

// The PRIMARY driver for each property option — the one the user grabs ON the
// comparison bar itself (founder 2026-06-07: "make the slider in the bar itself
// like the property value one"). The bar's fill shows where you've set this
// driver (exactly like the property-value slider's fill = its value); the live
// figure on the right is the OUTCOME that setting produces. One driver per bar;
// any finer drivers (costs %, purchase price) sit as compact sliders beneath.
function propertyBarDriver(id, V) {
  const v = Math.max(1, +V || 0)
  switch (id) {
    case 'keep_use':         return { key: 'roomRent',     label: 'Spare-room rent you charge', min: 0, max: 20000, step: 500, unit: '£', hint: 'First £7,500/yr is tax-free (Rent-a-Room scheme).' }
    case 'let':              return { key: 'grossRent',    label: 'Rent you charge',            min: 0, max: Math.round(v * 0.09 / 500) * 500, step: 500, unit: '£', hint: 'Starting figure is an estimate (~5% of value) — set your actual or expected rent.' }
    case 'sell_isa':         return { key: 'toPensionPct', label: 'Share you move into a pension', min: 0, max: 100, step: 5, unit: '%', hint: 'More into a pension means a smaller estate; the rest goes to an ISA.' }
    case 'sell_btl_replace': return { key: 'newYield',     label: 'New rental yield (gross)',    min: 2, max: 10, step: 0.2, unit: '%', hint: 'The income rate on the replacement rental.' }
    default:                 return null
  }
}

// Finer drivers for an option — shown as compact sliders directly under its bar,
// so every figure is adjustable, not just the headline one (the primary driver
// is excluded here; it lives ON the bar).
function propertySecondarySpecs(id, V) {
  const primary = propertyBarDriver(id, V)?.key
  return propertyLeverSpecs(id, V).filter(s => s.key !== primary)
}

// What the bar's right-hand figure means for THIS option — income for the
// income-bearing paths, estate for the shelter path. Each bar shows its own real
// outcome (founder priority: flexibility + honesty over a single forced metric).
function propertyBarOutcome(im, id) {
  if (!im) return { label: 'Outcome', text: '—', dir: 'neutral' }
  if (id === 'sell_isa') {
    return { label: 'Stays in your estate', text: fmt(im.iht_in_estate), dir: 'neutral' }
  }
  const net = Math.max(0, (im.yield_p_a || 0) - (im.income_tax_p_a || 0))
  if (net <= 0) return { label: 'Income you keep / yr', text: 'None', dir: 'neutral' }
  return { label: 'Income you keep / yr', text: fmt(net), dir: 'good' }
}

// A horizontal bar that IS a slider — drag the fill itself (founder 2026-06-07).
// Visual fill + thumb beneath a transparent native range input, so it looks like
// the property-value control, drags reliably in light/dark, and stays keyboard-
// accessible. `pct` reflects the driver's position within its range.
function BarSlider({ min = 0, max = 100, step = 1, value, onChange, fill = 'var(--c-acc)', height = 26, ariaLabel }) {
  const lo = +min, hi = +max
  const pct = hi > lo ? Math.max(0, Math.min(100, ((+value - lo) / (hi - lo)) * 100)) : 0
  return (
    <div style={{ position: 'relative', height, touchAction: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: fill, borderRadius: 6, transition: 'width .04s linear' }} />
      </div>
      <div style={{ position: 'absolute', top: 2, bottom: 2, left: `calc(${pct}% - 6px)`, width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 5, height: '100%', borderRadius: 4, background: 'var(--c-text)', opacity: 0.92, boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'ew-resize' }} />
    </div>
  )
}

function OptionLever({ lever, value, onChange }) {
  const f = (v) => `£${Math.round(+v).toLocaleString('en-GB')}${lever.perMonth ? '/mo' : ''}`
  return (
    <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 14, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg, 20px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', minWidth: 0 }}>{lever.label}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-acc)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{f(value)}</span>
      </div>
      <input type="range" min={lever.min ?? 0} max={lever.max} step={lever.step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} aria-label={lever.label} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--c-text3)', marginTop: 2 }}>
        <span>{f(lever.min ?? 0)}</span><span>max {f(lever.max)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.5 }}>
        {lever.hint || 'Drag to model the amount — the comparison below updates with your number.'}
      </div>
    </div>
  )
}


// DE-09 comparison where each bar IS a slider (founder 2026-06-07: "make the
// slider in the bar itself like the property value one"). Grab any option's bar
// and drag — its driver (rent, yield, pension split) moves under your finger and
// the outcome on the right updates live; finer drivers sit as compact sliders
// directly beneath. No hidden controls, nothing hard-coded, every option flexible.
function PropertyOptionsCompare({ paths, propValue, optLevers = {}, onModelOption }) {
  const fmtUnit = (s, v) => s?.unit === '%' ? `${(+v).toLocaleString('en-GB')}%` : `£${Math.round(+v).toLocaleString('en-GB')}`
  return (
    <div className="sw-card sw-card-elevated" style={{ padding: 18, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-lg, 20px)', boxShadow: 'var(--sh2)', marginBottom: 14 }}>
      <div className="sw-eyebrow">Compare your options</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3, marginBottom: 16 }}>
        Drag any bar to model that option — the figure on the right is what it gives you.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {(paths || []).map(p => {
          const driver = propertyBarDriver(p.id, propValue)
          const defaults = propertyDefaults(p.id, propValue)
          const merged = { ...defaults, ...(optLevers[p.id] || {}) }
          const outcome = propertyBarOutcome(p.impact, p.id)
          const secondary = propertySecondarySpecs(p.id, propValue)
          const setLever = (key, val) => onModelOption?.(p.id, { ...merged, [key]: val })
          const valColor = outcome.dir === 'good' ? 'var(--c-acc)' : outcome.dir === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
          if (!driver) return null
          return (
            <div key={p.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', minWidth: 0, overflowWrap: 'anywhere' }}>{p.plainLabel || p.title || p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: valColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{outcome.text}</span>
              </div>
              <BarSlider min={driver.min} max={driver.max} step={driver.step} value={merged[driver.key]}
                onChange={(v) => setLever(driver.key, v)} ariaLabel={`${driver.label} — ${p.plainLabel || p.title}`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5, gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text2)', fontWeight: 600 }}>{driver.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-text)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtUnit(driver, merged[driver.key])}</span>
              </div>
              {driver.hint && <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>{driver.hint}</div>}
              {secondary.map(s => (
                <div key={s.key} style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)' }}>{s.label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-text2)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtUnit(s, merged[s.key])}</span>
                  </div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={merged[s.key]}
                    onChange={(e) => setLever(s.key, Number(e.target.value))} style={{ width: '100%' }} aria-label={s.label} />
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 14, lineHeight: 1.5 }}>
        Each bar shows where you've set that option; the figure on the right is its outcome — rental income (after tax) for the letting options, the estate left for selling into a pension. Rental income is taxed at your rate; ISA and pension income is not. Illustrative, not a forecast.
      </div>
    </div>
  )
}

// ── Station 2: Options ──────────────────────────────────────────────────────
// The amount lever is now owned by the wizard (props), so `paths` already carries
// the impacts for the current lever value — dragging here flows through to the
// ranking, the Answer station and the Commit record, not just this preview.
function StepOptions({ paths, decId, lever, leverVal, onLever, propValue, optLevers = {}, onModelOption }) {
  const isProperty = decId === 'DE-09'
  // Property: every option's driver lives ON its comparison bar (drag the bar
  // itself), not in a hidden card drawer (founder 2026-06-07: "make the slider in
  // the bar itself like the property value one"). See PropertyOptionsCompare.
  const view = paths
  // Headline metric = the FIRST that actually differs between options, so every
  // decision shows a real comparison: net worth → inheritance tax → financial-
  // health score. If none differ numerically (e.g. wills/POA differ in approach
  // not in your numbers) we say so rather than drawing identical bars. The chart
  // OWNS this metric — the option cards below show only the other figures, so no
  // number is shown twice (founder 2026-06-06: charts were redundant + anemic).
  const varies = (key) => new Set(view.map(p => Math.round((p.simulation?.delta?.[key]) || 0))).size > 1
  // For property (keep/let/sell) the metric that varies meaningfully AND that the
  // user weighs is INCOME, not cash-freed (which is £0 for 3 of 4 options and read
  // as a contradiction next to the income chip). Founder 2026-06-06. Other
  // decisions fall through net worth → IHT → financial-health score.
  const canChartNw = !isProperty && varies('nw') && !SUPPRESS_NW_CHART.has(decId)
  const chartKey = isProperty ? 'income'
    : (canChartNw ? 'nw' : varies('iht') ? 'iht' : varies('fq') ? 'fq' : null)
  const nwLabel = NW_METRIC_LABEL[decId] || 'Net worth'
  // When the headline metric isn't net worth, caption the chart honestly.
  const chartAxisLabel = chartKey === 'nw' && NW_METRIC_LABEL[decId] ? `${nwLabel} vs today` : undefined
  const suppressedCost = SUPPRESS_NW_CHART.has(decId) && !chartKey
  const showTrajectory = TIME_BASED_DECISIONS.has(decId)
  const horizon = view[0]?.simulation?.horizon
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Here are <strong>{paths.length}</strong> ways to go, each worked out with your own
        numbers. You don't choose yet — the next step lets you set what matters most.
      </div>
      {lever && <OptionLever lever={lever} value={leverVal} onChange={onLever} />}
      {isProperty ? (
        <PropertyOptionsCompare paths={view} propValue={propValue} optLevers={optLevers} onModelOption={onModelOption} />
      ) : chartKey ? (
        <div style={{ marginBottom: 14 }}>
          <PathComparisonChart paths={view} valueKey={chartKey} axisLabel={chartAxisLabel}
            scrub={lever ? { lever, value: leverVal, onChange: onLever } : undefined} />
        </div>
      ) : (
        <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 14, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
          {suppressedCost
            ? <>These options trade off <strong>cost against the cover or benefit</strong> they give — the cheapest isn't automatically best. Compare the figures and "Good if" on each below.</>
            : <>These options differ in <strong>approach and risk</strong>, not in your headline numbers — compare the details on each below.</>}
        </div>
      )}
      {showTrajectory && (
        <div style={{ marginBottom: 14 }}>
          <DecisionTrajectoryChart paths={view} horizon={horizon} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {view.map(p => {
          const d = p.simulation?.delta
          // Build the chip set, EXCLUDING whatever the headline chart already
          // shows, so the card never repeats the chart's number.
          const chips = []
          if (p.impact) {
            // Option-aware factors (founder 2026-06-06): rent + its income tax for
            // letting, cash + CGT for selling — never a £0 line that isn't the
            // point. The income chart above compares options; these chips give the
            // per-option breakdown (incl. the rental income tax) it can't show.
            propertyFactors(p.impact, p.id).forEach(f =>
              chips.push({ label: f.label, value: f.value, good: f.dir === 'good' ? true : f.dir === 'bad' ? false : undefined }))
          } else {
            // Suppress a £0 chip (G-2a, audit BM-6): a "£0" line for a metric this
            // option doesn't move is noise, not information (founder: "if CGT is £0
            // why show it"). Time frame + confidence always show.
            if (chartKey !== 'nw' && Math.round(d?.nw || 0) !== 0) chips.push({ label: nwLabel, value: fmtSigned(d?.nw), good: (d?.nw ?? 0) >= 0 })
            if (chartKey !== 'iht' && Math.round(d?.iht || 0) !== 0) chips.push({ label: 'Inheritance tax', value: fmtSigned(d?.iht), good: (d?.iht ?? 0) <= 0 })
            chips.push({ label: 'Time frame', value: p.simulation?.horizon != null ? `${p.simulation.horizon}y` : '—', good: true })
            chips.push({ label: 'Confidence', value: CONF_LABEL[p.simulation?.confidence] || p.simulation?.confidence || '—', good: p.simulation?.confidence === 'HIGH' })
          }
          return (
            <div key={p.id} className="sw-tile" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>{p.plainLabel || p.title || p.label}</div>
              {p.bottomLine && (
                <div style={{ fontSize: 12, color: 'var(--c-text)', marginTop: 5, lineHeight: 1.5, paddingLeft: 8, borderLeft: '2px solid var(--c-acc)' }}>{p.bottomLine}</div>
              )}
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
              {/* Drivers now live ON the comparison bars above (drag the bar
                  itself) — the card stays a clean read of what the option means. */}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Station 3: Priorities — drag priorities, options re-rank LIVE ────────────
// Merges the old Weights + Ranked + Unconsidered steps. Founder 2026-06-06: the
// old Weights step changed an input (priority sliders / wheel) whose ONLY
// consequence — re-ranking the options — lived on the NEXT screen, so it read as
// "static / can't change anything". Here the re-rank happens on the same screen,
// live, as you drag; the wheel is draggable; the bottom-ranked option is the
// built-in counter-frame (DE-NAR-01).
function StepPriorities({ weights, onChange, ranked, chosen, onPick }) {
  const top = ranked[0]
  const counter = ranked.length > 1 ? ranked[ranked.length - 1] : null
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Set what matters most to you — drag the wheel or the sliders. Your options
        re-order <strong>live</strong> below as you change them; the one on top fits
        your priorities best. Tap an option to choose it.
      </div>
      <DecisionWheel weights={weights} onChange={onChange} />
      <div style={{ marginTop: 14, marginBottom: 6 }}>
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

      {/* Live re-rank — the visible consequence of the priorities above. */}
      <div style={{ marginTop: 18, marginBottom: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span className="sw-eyebrow">How your options rank now</span>
        <span style={{ fontSize: 10.5, color: 'var(--c-text3)' }}>re-orders as you drag</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ranked.map((p, i) => {
          const isTop = i === 0
          const isPicked = chosen === p.id
          return (
            <button key={p.id} onClick={() => onPick(p.id)}
              className="sw-tile sw-tile-interactive sw-press"
              style={{
                textAlign: 'left', cursor: 'pointer', padding: 12,
                border: isPicked ? '1.5px solid var(--c-acc)' : '1px solid var(--c-border)',
                background: isTop ? 'var(--c-acc-bg)' : undefined,
                transition: 'border-color .15s, background .15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                  background: isTop ? 'var(--c-acc)' : 'var(--c-surface2)',
                  color: isTop ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-text3)',
                }}>#{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', flex: 1 }}>
                  {p.plainLabel || p.title}
                </span>
                {isPicked && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-acc)' }}>✓ chosen</span>}
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

      {/* Counter-frame (DE-NAR-01) — the option your priorities push to the
          bottom, surfaced on purpose so the choice holds up against the opposite
          view. */}
      {counter && top && counter.id !== top.id && (
        <div className="sw-tile" style={{
          marginTop: 12, padding: '10px 12px',
          border: '1px dashed var(--c-text3)', background: 'var(--c-surface2)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Ruling out</span>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.5 }}>
            <strong>{counter.plainLabel || counter.title}</strong> ranks lowest for the priorities you set —
            worth a second look before you commit if access to cash or what you leave behind matters more than that.
          </div>
        </div>
      )}
    </div>
  )
}

// Decision Wheel — 4 axes radiating from centre, a draggable point on each.
// Drag a point in/out to set that priority's weight (0.05–1); the polygon and
// the live re-rank update with it. The sliders below are the same state, so
// either control works (touch-friendly fat hit targets on the points).
function DecisionWheel({ weights, onChange }) {
  const SIZE = 220
  const CX = SIZE / 2, CY = SIZE / 2, R = 80
  // viewBox padded so the edge labels ("Estate"/"Risk") aren't clipped.
  const VB = { x: -34, y: -16, w: SIZE + 68, h: SIZE + 32 }
  const axes = ['tax', 'risk', 'liquidity', 'legacy']
  const angles = { tax: -Math.PI / 2, risk: 0, liquidity: Math.PI / 2, legacy: Math.PI }
  const colours = { tax: 'var(--c-acc)', risk: 'var(--c-gold)', liquidity: 'var(--c-acc2, #4D8EFF)', legacy: 'var(--c-violet, #BA8CFF)' }
  const labelOf  = { tax: 'Tax', risk: 'Risk', liquidity: 'Cash', legacy: 'Estate' }
  const svgRef = useRef(null)
  const activeRef = useRef(null)
  const [active, setActive] = useState(null)

  // Map a pointer position to a 0.05–1 weight along the dragged axis by
  // projecting (cursor − centre) onto that axis's unit vector.
  const setFromPointer = (axis, clientX, clientY) => {
    const svg = svgRef.current; if (!svg || !onChange) return
    const rect = svg.getBoundingClientRect()
    const x = VB.x + ((clientX - rect.left) / rect.width) * VB.w
    const y = VB.y + ((clientY - rect.top) / rect.height) * VB.h
    const ang = angles[axis]
    const proj = ((x - CX) * Math.cos(ang) + (y - CY) * Math.sin(ang)) / R
    const w = Math.max(0.05, Math.min(1, proj))
    onChange({ ...weights, [axis]: Number(w.toFixed(2)) })
  }
  const onDown = (axis) => (e) => {
    e.preventDefault()
    activeRef.current = axis; setActive(axis)
    try { svgRef.current?.setPointerCapture?.(e.pointerId) } catch { /* no capture */ }
    setFromPointer(axis, e.clientX, e.clientY)
  }
  const onMove = (e) => { if (activeRef.current) setFromPointer(activeRef.current, e.clientX, e.clientY) }
  const onUp = (e) => {
    if (!activeRef.current) return
    activeRef.current = null; setActive(null)
    try { svgRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
  }

  const pts = axes.map(a => {
    const ang = angles[a], w = weights[a]
    return { x: CX + Math.cos(ang) * R * w, y: CY + Math.sin(ang) * R * w, ang, weight: w, axis: a }
  })
  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
      <svg ref={svgRef} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} width="100%"
        style={{ maxWidth: 248, touchAction: 'none', cursor: active ? 'grabbing' : 'default' }}
        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {/* Guide rings */}
        {[0.25, 0.5, 0.75, 1].map(s => (
          <circle key={s} cx={CX} cy={CY} r={R * s}
            fill="none" stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.5" />
        ))}
        {/* Axes */}
        {axes.map(a => {
          const ang = angles[a]
          return <line key={a} x1={CX} y1={CY}
            x2={(CX + Math.cos(ang) * R).toFixed(1)} y2={(CY + Math.sin(ang) * R).toFixed(1)}
            stroke="var(--c-sep)" strokeWidth="0.5" opacity="0.6" />
        })}
        {/* Weight polygon */}
        <polygon points={polyPts}
          fill="var(--c-radar-fill)" stroke="var(--c-acc)" strokeWidth="1.6"
          style={{ filter: 'drop-shadow(0 0 10px var(--c-radar-glow))', transition: active ? 'none' : 'all .12s ease-out' }} />
        {/* Draggable points + labels */}
        {pts.map(p => (
          <g key={p.axis}>
            {/* fat invisible hit target so the point is easy to grab on touch */}
            <circle cx={p.x} cy={p.y} r="18" fill="transparent"
              style={{ cursor: 'grab' }} onPointerDown={onDown(p.axis)} />
            <circle cx={p.x} cy={p.y} r={active === p.axis ? 7.5 : 5.5} fill={colours[p.axis]}
              stroke="var(--c-bg, #fff)" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
            <text
              x={CX + Math.cos(p.ang) * (R + 18)}
              y={CY + Math.sin(p.ang) * (R + 18)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="800" fill="var(--c-text2)"
              fontFamily="DM Sans,sans-serif" style={{ pointerEvents: 'none' }}>
              {labelOf[p.axis]}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 2 }}>
        Drag a point to set that priority — or use the sliders below.
      </div>
    </div>
  )
}

// ── Station 4: Answer — the verdict + multi-factor impact ───────────────────
// CRIT DE-NAR-02. Founder 2026-06-06: "the answer and the effect it could have
// to tax, my net worth, the risk and return plus other factors should be
// summarised — which we are lacking." This station IS that summary: the chosen
// option as the headline answer, then its effect across EVERY factor we have
// real data for (net worth, tax/CGT, inheritance, income/return, risk, access to
// cash). Factors with no data are omitted, never faked (doctrine §2/§5).
function FactorRow({ label, value, dir, note }) {
  const colour = dir === 'good' ? 'var(--c-acc)' : dir === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  // A colour-coded dot, not an arrow — these are status values, not changes, so
  // an up/down arrow would imply movement that isn't there.
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 8, color: colour, width: 12, flexShrink: 0, paddingTop: 5 }}>●</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text)' }}>{label}</div>
        {note && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>{note}</div>}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: colour, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

const RISK_PLAIN = { low: 'Lower risk', medium: 'Balanced risk', high: 'Higher risk' }

function StepAnswer({ path, weights, engineRec, decId }) {
  if (!path) return null
  const topWeight = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]
  const topLabel = WEIGHTS_LABEL[topWeight[0]] || topWeight[0]

  const im = path.impact
  const d  = path.simulation?.delta

  // The verdict prose. For property (path.impact), the engine's generic
  // generateRecommendation runs a DIFFERENT model than the property impacts, so
  // its £ claims (net worth / IHT) wouldn't tie out with the factor list below.
  // For property we therefore use a priorities-based line and let the factor
  // list be the single source of numbers (§9.5 Gate 2 — no two figures for one
  // quantity). Engine decisions share one model, so their summary ties out.
  const priorityLine = `It scores highest against what matters most to you — ${topLabel.toLowerCase()} weighted highest. Here's what it means across each factor.`
  const summary = im ? (path.bottomLine || priorityLine) : (engineRec?.summary || priorityLine)
  // Path-aware checklist first (so "Rent it out" shows letting steps, not the
  // generic sell/CGT steps), falling back to the engine's generic steps.
  const pathChecklist = (() => { try { return checklistFor(decId, path.id) || [] } catch { return [] } })()
  const steps   = pathChecklist.length ? pathChecklist : (engineRec?.steps || [])
  const fca     = engineRec?.fcaBoundary || FCA_BOUNDARY
  const impact  = engineRec?.impact
  const sources = engineRec?.sources || ['Your data', 'UK tax rules 2026/27', 'Ranked by your priorities']

  // Build the factor list from whatever real data this decision carries. Property
  // (path.impact) and engine paths (simulation.delta + engineRec.impact) have
  // different shapes; both feed the same plain-English factor rows.
  const factors = []
  if (im) {
    // Property keep/let/sell — option-aware factors (rent + its income tax for
    // letting, cash + CGT for selling), never a £0 line that isn't the point.
    factors.push(...propertyFactors(im, path.id))
  } else {
    const nw  = impact?.nwGain ?? d?.nw
    const iht = (impact?.ihtSave != null && impact.ihtSave > 0) ? -impact.ihtSave : d?.iht
    const inc = d?.income
    if (nw != null && Math.round(nw) !== 0) { const nwL = nwLabelFor(decId); factors.push({ label: nwL, value: fmtSigned(nw), dir: nw > 0 ? 'good' : 'bad', note: nwL === 'Net worth' ? `Change in what you're worth${impact?.horizon ? `, over about ${impact.horizon} years` : ''}.` : (impact?.horizon ? `From this choice, over about ${impact.horizon} years.` : 'From this choice.') }) }
    if (iht != null && Math.round(iht) !== 0) factors.push({ label: 'Inheritance tax', value: fmtSigned(iht), dir: iht <= 0 ? 'good' : 'bad', note: iht <= 0 ? 'Less tax your estate would owe.' : 'More tax your estate would owe.' })
    if (inc != null && Math.round(inc) !== 0) factors.push({ label: 'Income / return each year', value: fmtSigned(inc), dir: inc > 0 ? 'good' : 'bad', note: 'Yearly income or return this option adds.' })
    if (impact?.fqGain != null && impact.fqGain > 0) factors.push({ label: 'Wealth Score', value: `+${impact.fqGain} pts`, dir: 'good', note: 'How much your overall financial-health score improves.' })
  }
  // Risk + return read for every decision (path.riskLevel always present).
  if (path.riskLevel && RISK_PLAIN[path.riskLevel]) {
    factors.push({ label: 'Risk & return', value: RISK_PLAIN[path.riskLevel], dir: path.riskLevel === 'low' ? 'good' : path.riskLevel === 'high' ? 'bad' : 'neutral', note: path.riskLevel === 'high' ? 'Leans on markets — more upside, more downside.' : path.riskLevel === 'low' ? "Doesn't depend on markets rising." : 'A middle path on market exposure.' })
  }

  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Here's the answer to your question, and what it means across the things you
        care about — information to weigh up, not advice.
      </div>

      {/* The verdict */}
      <div className="sw-tile" style={{ padding: 14, border: '1.5px solid var(--c-acc)', background: 'var(--c-acc-bg)' }}>
        <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Your answer</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.3 }}>
          {path.plainLabel || path.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.6 }}>
          {summary}
        </div>
      </div>

      {/* Multi-factor impact — the summary the founder said was missing. */}
      {factors.length > 0 ? (
        <div className="sw-tile" style={{ padding: '6px 14px 12px', marginTop: 12, border: '1px solid var(--c-border)' }}>
          <div className="sw-eyebrow" style={{ margin: '10px 0 2px' }}>What it means for you</div>
          {factors.map((f, i) => <FactorRow key={i} {...f} />)}
        </div>
      ) : (
        // Cert P1: some decisions (wills, power of attorney) differ in APPROACH, not
        // in your headline £ — don't leave a silent gap where the factor tile was.
        <div className="sw-tile" style={{ padding: '12px 14px', marginTop: 12, border: '1px solid var(--c-border)', fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5 }}>
          This choice differs in <strong>approach and protection</strong>, not in your headline numbers — the difference is in how it works for you, compared on the options earlier.
        </div>
      )}

      {/* Before/after net worth — engine decisions carry a before/after. */}
      {path.simulation?.before?.nw != null && path.simulation?.after?.nw != null && (
        <div style={{ marginTop: 12 }}>
          <BeforeAfterBar label="Net worth" before={path.simulation.before.nw} after={path.simulation.after.nw} />
        </div>
      )}

      {/* Next steps + provenance + FCA boundary. */}
      <div className="sw-tile" style={{ padding: 14, marginTop: 12, border: '1px solid var(--c-border)' }}>
        {steps.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 6 }}>What you'd do next</div>
            <ol style={{ margin: 0, paddingLeft: 16 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 2 }}>{s}</li>
              ))}
            </ol>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: steps.length ? 10 : 0, borderTop: steps.length ? '1px solid var(--c-sep)' : 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 100, background: 'var(--c-surface2)', color: 'var(--c-text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Source</span>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{sources.join(' · ')}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}>
          {fca}
        </div>
      </div>
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
    L.push(`Projected impact (illustrative, over ${i.horizon}y): ${nwLabelFor(decId).toLowerCase()} ${fmtSigned(i.nwGain)}${i.ihtSave ? `, inheritance tax saved ~${fmt(i.ihtSave)}` : ''}.`)
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
            // Option-aware property factors — same source as the Answer station, so
            // Commit shows the rental income tax (not a £0 CGT line) and reflects
            // the property value the user set.
            propertyFactors(path.impact, path.id).map((f, i) => (
              <ImpactChip key={i} label={f.label} value={f.value} good={f.dir === 'good' ? true : f.dir === 'bad' ? false : undefined} />
            ))
          ) : (
            <>
              {Math.round(path.simulation?.delta?.nw || 0) !== 0 && (
                <ImpactChip label={nwLabelFor(decId)} value={fmtSigned(path.simulation?.delta?.nw)}  good={(path.simulation?.delta?.nw ?? 0) >= 0} />
              )}
              {Math.round(path.simulation?.delta?.iht || 0) !== 0 && (
                <ImpactChip label="Inheritance tax"       value={fmtSigned(path.simulation?.delta?.iht)} good={(path.simulation?.delta?.iht ?? 0) <= 0} />
              )}
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
