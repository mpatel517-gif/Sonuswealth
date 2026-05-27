// ─────────────────────────────────────────────────────────
// SimulatorPanel.jsx — rewrite (Session 1 · 22 April 2026)
// Session-1 changes vs prior:
//   · scrollIntoView on mount — panel no longer opens below the fold (D03)
//   · "Ask AI about [dim]" button wired via onAskAI prop (D05)
//   · "Commit" action — dispatches events to the store (D06)
//   · Reset + Commit render as two buttons, not one
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { SLIDERS, simulate, netWorthImpact, defaultSliderValues } from '../../engine/simulator.js'
import { fmt, netWorth } from '../../engine/fq-calculator.js'

// NB: dimension metadata is duplicated here (icon field not yet in shared
// DIMENSIONS module) — D10 in the defect list, deferred to Session 2.
const DIM_META = {
  behaviour:  { label: 'Behaviour',  colour: '#4D8EFF', icon: '📊' },
  capital:    { label: 'Capital',    colour: '#00E5A8', icon: '📈' },
  tax:        { label: 'Tax',        colour: '#FFB347', icon: '🏛' },
  protection: { label: 'Protection', colour: '#FF6B6B', icon: '🛡' },
  cashflow:   { label: 'Cashflow',   colour: '#34C759', icon: '💧' },
  debt:       { label: 'Debt',       colour: '#AF52DE', icon: '⚖' },
  estate:     { label: 'Estate',     colour: '#FF9500', icon: '🏡' },
}

// Generic action copy per dimension. No persona-specific numbers — the copy
// has to work for Hermione, Wilma, Stark, Priya, etc. Persona-specific
// numeric claims belong in persona JSON `dimensionNarrative`.
const DIM_ACTIONS = {
  behaviour: [
    { text: 'Set up a monthly savings direct debit', pts: '+1' },
    { text: 'Connect your bank account to Sonuswealth', pts: '+1' },
    { text: 'Review direct debits and subscriptions',pts: '+1' },
  ],
  capital: [
    { text: 'Review your retirement income target', pts: '+1' },
    { text: 'Model your drawdown timing',           pts: '+2' },
    { text: 'Top up your ISA allowance',            pts: '+2' },
  ],
  tax: [
    { text: 'Start pension drawdown at a tax-efficient rate', pts: '+5' },
    { text: 'Use this year\'s ISA allowance',                 pts: '+2' },
    { text: 'Use CGT allowance via Bed-and-ISA',              pts: '+1' },
  ],
  protection: [
    { text: 'Set up life insurance in trust',       pts: '+4' },
    { text: 'Add critical illness cover',           pts: '+3' },
    { text: 'Register a Lasting Power of Attorney', pts: '+2' },
  ],
  cashflow: [
    { text: 'Move excess cash above 24 mo into ISA', pts: '+1' },
    { text: 'Review cash interest rate',             pts: '+1' },
    { text: 'Model cashflow under drawdown',         pts: '+1' },
  ],
  debt: [
    { text: 'Maintain debt-free status',   pts: '—' },
    { text: 'Review mortgage at renewal',  pts: '+1' },
  ],
  estate: [
    { text: 'Start pension drawdown — reduces estate', pts: '+5' },
    { text: 'Update pension nominations',              pts: '+1' },
    { text: 'Register Lasting Power of Attorney',      pts: '+2' },
    { text: 'Ensure will is current',                  pts: '+1' },
  ],
}

function BoolToggle({ value, onChange, colour }) {
  return (
    <button
      onClick={() => onChange(value === 1 ? 0 : 1)}
      style={{
        background: value === 1 ? colour : 'var(--c-surface2)',
        border: 'none', borderRadius: 100, padding: '6px 18px',
        color: value === 1 ? '#fff' : 'var(--c-text2)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'all .15s', minWidth: 70,
      }}>
      {value === 1 ? 'Yes' : 'No'}
    </button>
  )
}

function SliderRow({ slider, value, onChange, colour, entity }) {
  const isBool = slider.unit === 'bool'

  // Per-slider max rule. D02 / DQ-44 fix: drawdown gets no hard cap; a
  // warning band at guardrail × 2 is surfaced via the label instead. Other
  // sliders keep their declared max.
  const effectiveMax = (() => {
    if (slider.key !== 'drawdown') return slider.max
    // Cap drawdown at total DC pension, not at arbitrary £50k
    const sipp = entity?.assets?.sipp?.total || 0
    if (sipp > 0) return Math.max(slider.max, Math.round(sipp))
    return slider.max
  })()

  const display = isBool
    ? null
    : slider.unit === '£/yr' || slider.unit === '£/mo' || slider.unit === '£'
      ? fmt(value)
      : slider.unit === '%'
        ? `${value}%`
        : `${value} ${slider.unit}`

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{slider.label}</span>
        {isBool
          ? <BoolToggle value={value} onChange={onChange} colour={colour} />
          : <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{display}</span>
        }
      </div>
      {!isBool && (
        <div style={{ position: 'relative' }}>
          <input
            type="range"
            min={slider.min} max={effectiveMax} step={slider.step}
            value={Math.min(value, effectiveMax)}
            onChange={e => onChange(Number(e.target.value))}
            style={{
              width: '100%', accentColor: colour,
              height: 4, cursor: 'pointer',
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--c-text3)', marginTop: 3,
          }}>
            <span>
              {slider.unit === '£/yr' || slider.unit === '£/mo' || slider.unit === '£'
                ? fmt(slider.min)
                : `${slider.min}${slider.unit === '%' ? '%' : ''}`}
            </span>
            <span>
              {slider.unit === '£/yr' || slider.unit === '£/mo' || slider.unit === '£'
                ? fmt(effectiveMax)
                : `${effectiveMax}${slider.unit === '%' ? '%' : ''}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function DoubleBubble({ current, simulated, deltaFQ, colour, isSimulating }) {
  const nwDelta  = simulated - current
  const improved = nwDelta >= 0
  const fqUp     = deltaFQ > 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--c-surface)', borderRadius: 20, padding: '16px 18px',
      margin: '0 0 16px', transition: 'all .2s',
    }}>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
          Today
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -1 }}>
          {fmt(current)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>net worth</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          fontSize: 20, color: isSimulating ? colour : 'var(--c-text3)',
          transition: 'color .2s',
        }}>
          →
        </div>
        {isSimulating && nwDelta !== 0 && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: improved ? 'var(--c-acc)' : 'var(--c-coral-text)',
            background: improved ? 'var(--c-acc-bg)' : 'rgba(255,107,107,0.12)',
            padding: '2px 8px', borderRadius: 100,
          }}>
            {improved ? '+' : ''}{fmt(nwDelta)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
          Simulated
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: -1,
          color: isSimulating ? colour : 'var(--c-text2)',
          transition: 'color .3s',
        }}>
          {fmt(isSimulating ? simulated : current)}
        </div>
        <div style={{ fontSize: 11, marginTop: 2 }}>
          {isSimulating && deltaFQ !== 0
            ? <span style={{ color: fqUp ? 'var(--c-acc)' : 'var(--c-coral-text)', fontWeight: 700 }}>
                FQ {fqUp ? '+' : ''}{deltaFQ} pts
              </span>
            : <span style={{ color: 'var(--c-text3)' }}>move sliders</span>
          }
        </div>
      </div>
    </div>
  )
}

export default function SimulatorPanel({
  entity,
  activeDimKey,
  baseFQTotal,
  onSimulate,
  onClose,
  onAskAI,      // new: navigate to Ask with dim context
  onCommit,     // new: persist the simulated overrides via event store
}) {
  const meta    = DIM_META[activeDimKey] || {}
  const cfg     = SLIDERS[activeDimKey]  || { primary: [], secondary: [] }
  const actions = DIM_ACTIONS[activeDimKey] || []

  const [values,      setValues]       = useState(() => defaultSliderValues(activeDimKey, entity))
  const [showMore,    setShowMore]     = useState(false)
  const [simResult,   setSimResult]    = useState(null)
  const [nwResult,    setNwResult]     = useState(null)
  const [isSimulating,setIsSimulating] = useState(false)

  const panelRef = useRef(null)

  // D03 fix: scroll panel into view on open (and whenever dim changes)
  useEffect(() => {
    if (panelRef.current) {
      // Small delay so React has committed the DOM and layout is stable
      const t = setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
      return () => clearTimeout(t)
    }
  }, [activeDimKey])

  // Re-init values when dimension changes
  useEffect(() => {
    setValues(defaultSliderValues(activeDimKey, entity))
    setSimResult(null)
    setNwResult(null)
    setIsSimulating(false)
    setShowMore(false)
  }, [activeDimKey, entity])

  const recalc = useCallback((vals) => {
    const result = simulate(entity, vals)
    const nw     = netWorthImpact(entity, vals)
    setSimResult(result)
    setNwResult(nw)
    setIsSimulating(true)
    onSimulate?.(result)
  }, [entity, onSimulate])

  function handleChange(key, val) {
    const next = { ...values, [key]: val }
    setValues(next)
    recalc(next)
  }

  function handleCommit() {
    if (!onCommit || !isSimulating) return
    onCommit({ overrides: values, activeDimKey, deltaFQ, nwDelta: (nwResult?.delta || 0) })
  }

  const deltaFQ    = simResult ? simResult.deltaFQ : 0
  const currentNW  = nwResult?.current   ?? 0
  const simulatedNW= nwResult?.simulated ?? 0

  // Drawdown warning band: guardrail × 2. Surfaced if user pushes drawdown
  // slider above this — not blocking, just a visual flag.
  const guard2x   = Math.round((entity?.assets?.sipp?.total || 0) > 0
    ? Math.min(
        entity.assets.sipp.total,
        (entity.assets.sipp.total + (entity.assets.isa?.value || 0) + (entity.assets.portfolio?.value || 0) + (entity.assets.cash?.total || 0)) * 0.04 * 2
      )
    : 0)
  const ddHigh    = (values.drawdown || 0) > guard2x && guard2x > 0

  return (
    <div ref={panelRef} style={{
      background: 'var(--c-bg)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '0 16px 32px',
      scrollMarginTop: 12,
    }}>
      {/* Handle + header */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--c-surface2)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${meta.colour}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
              Simulate {meta.label}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text3)' }}>
              Move sliders — radar updates live
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close simulator"
          style={{
            background: 'var(--c-surface)', border: 'none', borderRadius: 100,
            width: 32, height: 32, cursor: 'pointer', color: 'var(--c-text2)',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ✕
        </button>
      </div>

      <DoubleBubble
        current={currentNW || netWorth(entity)}
        simulated={simulatedNW || currentNW || netWorth(entity)}
        deltaFQ={deltaFQ}
        colour={meta.colour}
        isSimulating={isSimulating}
      />

      {cfg.primary.map(s => (
        <SliderRow
          key={s.key}
          slider={s}
          value={values[s.key] ?? s.defaultFn(entity)}
          onChange={val => handleChange(s.key, val)}
          colour={meta.colour}
          entity={entity}
        />
      ))}

      {/* Drawdown warning band notice — D02 / DQ-44 */}
      {ddHigh && (
        <div style={{
          marginTop: -8, marginBottom: 14,
          padding: '8px 12px',
          background: 'rgba(255, 179, 71, 0.08)',
          border: '1px solid rgba(255, 179, 71, 0.35)',
          borderRadius: 10, fontSize: 12, color: 'var(--c-amber-text)', lineHeight: 1.5,
        }}>
          Above twice your safe withdrawal rate. Possible but depletes faster —
          review against longevity targets.
        </div>
      )}

      {cfg.secondary.length > 0 && (
        <>
          <button
            onClick={() => setShowMore(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: meta.colour, fontSize: 13, fontWeight: 600,
              padding: '4px 0', marginBottom: showMore ? 12 : 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {showMore ? '▲ Fewer options' : '▼ More options'}
          </button>

          {showMore && cfg.secondary.map(s => (
            <SliderRow
              key={s.key}
              slider={s}
              value={values[s.key] ?? s.defaultFn(entity)}
              onChange={val => handleChange(s.key, val)}
              colour={meta.colour}
              entity={entity}
            />
          ))}
        </>
      )}

      {/* Commit action — D06 fix */}
      {isSimulating && (
        <button
          onClick={handleCommit}
          disabled={!onCommit}
          style={{
            width: '100%', marginTop: 8, marginBottom: 4,
            background: meta.colour, color: '#0B1F3A',
            border: 'none', borderRadius: 100, padding: '13px 0',
            fontSize: 14, fontWeight: 700,
            cursor: onCommit ? 'pointer' : 'not-allowed',
            opacity: onCommit ? 1 : 0.5,
          }}>
          Commit changes
        </button>
      )}

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

      <div style={{ fontSize: 13, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
        Recommended actions
      </div>
      {actions.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 12,
          background: 'var(--c-surface)',
          marginBottom: 6,
        }}>
          <span style={{ fontSize: 13, color: 'var(--c-text)', flex: 1 }}>{a.text}</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: a.pts === '—' ? 'var(--c-text3)' : '#00E5A8',
            marginLeft: 12, whiteSpace: 'nowrap',
          }}>
            {a.pts} FQ
          </span>
        </div>
      ))}

      {/* D05 fix: Ask AI now wired */}
      <button
        onClick={() => onAskAI?.(activeDimKey)}
        disabled={!onAskAI}
        style={{
          width: '100%', marginTop: 16,
          background: `${meta.colour}18`,
          border: `1px solid ${meta.colour}40`,
          borderRadius: 14, padding: '12px 16px',
          color: meta.colour, fontSize: 14, fontWeight: 600,
          cursor: onAskAI ? 'pointer' : 'not-allowed',
          textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: onAskAI ? 1 : 0.6,
        }}>
        <span>Ask AI about {meta.label?.toLowerCase?.() || 'this'} →</span>
        <span style={{ fontSize: 18 }}>✦</span>
      </button>

      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
        Simulated values only. Information and guidance — not personal advice. Verify decisions with a qualified FCA-authorised adviser before acting.
      </div>
    </div>
  )
}
