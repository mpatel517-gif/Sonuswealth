// DecumulationStrategy.jsx — the "Decide" layer. Guided plan (from
// decumulation-plan.js) on top; interactive sequencer (target income →
// live POS via monteCarloPOS) below. FCA framed throughout.
// OverlayShell prop is onBack (not onClose).
import { useMemo, useState } from 'react'
import OverlayShell from '../../shared/OverlayShell.jsx'
import { buildDecumulationPlan } from '../../../engine/decumulation-plan.js'
import { monteCarloPOS } from '../../../engine/scenarios.js'
import { useEvents, EV } from '../../../state/events.jsx'

const fmt = (n) => `£${Math.round(+n || 0).toLocaleString('en-GB')}`
const clampPct = (p) => Math.max(0, Math.min(100, Math.round(p)))

const ACTION_TONE = { verify: 'var(--c-gold,#E8B84B)', 'tax-free-cash': 'var(--c-acc,#5ddbc2)', flex: 'var(--c-acc,#5ddbc2)', 'time-2027': 'var(--c-coral,#FF6F7D)' }

function Metric({ label, value, tone, small }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: small ? 12 : 18, fontWeight: 800, color: tone || 'var(--c-text)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--c-text3)' }}>{label}</div>
    </div>
  )
}

export function DecumulationStrategy({ entity, pots = [], personaId, onClose, onHome }) {
  const total = pots.reduce((s, p) => s + (+p.value || 0), 0)
  const age = entity?.age ?? 65
  const plan = useMemo(() => buildDecumulationPlan(pots, { age }), [pots, age])

  const [target, setTarget] = useState(Math.round(total * 0.04))
  const pos = useMemo(() => {
    if (!total) return 0
    const r = monteCarloPOS(entity, { annual: target }, { pensionPot: total, terminalAge: 95, simulations: 2000 })
    let p = r?.probability ?? 0
    p = p <= 1 ? p * 100 : p
    return clampPct(p)
  }, [entity, target, total])

  const { commit } = useEvents()
  const [saved, setSaved] = useState(false)
  const saveAsPlan = () => {
    if (personaId) commit(personaId, { type: EV.SCENARIO_SAVED, payload: { kind: 'decumulation', targetIncome: target, pots: pots.map(p => p.name) } })
    setSaved(true)
  }

  return (
    <OverlayShell
      title="Turn your pensions into income"
      subtitle={`${fmt(total)} across ${pots.length} pot${pots.length !== 1 ? 's' : ''}`}
      onBack={onClose}
      onHome={onHome}
    >
      <div style={{ padding: 16, display: 'grid', gap: 18 }}>
        {/* GUIDED */}
        <div>
          <div className="sw-eyebrow">A SENSIBLE ORDER — AND WHY</div>
          <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 10 }}>
            {plan.sequence.map(s => (
              <li key={s.order} style={{ display: 'flex', gap: 10 }}>
                <span style={{ flex: '0 0 24px', height: 24, borderRadius: 12, background: ACTION_TONE[s.action] || 'var(--c-acc,#5ddbc2)', color: '#06231f', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 13 }}>{s.order}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 2 }}>{s.reason}</div>
                </div>
              </li>
            ))}
          </ol>
          {plan.flags.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {plan.flags.map(f => (
                <div key={f.code} style={{ fontSize: 12, color: f.severity === 'warn' ? 'var(--c-gold,#E8B84B)' : 'var(--c-text3)' }}>• {f.message}</div>
              ))}
            </div>
          )}
        </div>

        {/* INTERACTIVE */}
        <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
          <div className="sw-eyebrow">TRY A WITHDRAWAL LEVEL</div>
          <div style={{ fontSize: 'var(--fs-hero,30px)', fontWeight: 800, marginTop: 4 }}>{fmt(target)}<span style={{ fontSize: 13, color: 'var(--c-text3)', fontWeight: 600 }}> /yr</span></div>
          <input type="range" min={Math.round(total * 0.02)} max={Math.round(total * 0.08)} step={500} value={target} onChange={e => setTarget(+e.target.value)} style={{ width: '100%', marginTop: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
            <Metric label="Chance it lasts to 95" value={`${pos}%`} tone={pos >= 85 ? 'var(--c-good,#5DDBA8)' : pos >= 60 ? 'var(--c-gold,#E8B84B)' : 'var(--c-coral,#FF6F7D)'} />
            <Metric label="≈ % of pot / yr" value={`${total ? ((target / total) * 100).toFixed(1) : '0'}%`} />
            <Metric label="Above your allowance" value="income tax applies" small />
          </div>
          {pos >= 99 && <div style={{ fontSize: 12, color: 'var(--c-good,#5DDBA8)', marginTop: 8 }}>Near-certain to last — you may be able to spend more, or pass more on.</div>}
          <button type="button" onClick={saveAsPlan} style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--c-acc,#5ddbc2)', background: saved ? 'var(--c-acc,#5ddbc2)' : 'transparent', color: saved ? '#06231f' : 'var(--c-acc,#5ddbc2)', fontWeight: 700, cursor: 'pointer' }}>{saved ? 'Added to your Plan ✓' : 'Add to my Plan'}</button>
        </div>

        <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>Modelling, not a guarantee. Information and guidance only — not personal advice. Verify with an FCA-authorised adviser before acting.</div>
      </div>
    </OverlayShell>
  )
}
