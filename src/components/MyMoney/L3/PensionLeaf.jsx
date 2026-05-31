// PensionLeaf.jsx — L3 per-pension leaf. "How is THIS pot doing + its role."
// Reuses projection (trend), decumulation-plan (sequence role), events (update).
// OverlayShell prop is onBack (not onClose); default export.
import { useState } from 'react'
import OverlayShell from '../../shared/OverlayShell.jsx'
import { InteractiveProjection } from './InteractiveProjection.jsx'
import { growthRateFor } from '../../../engine/projection.js'
import { getActiveCMA } from '../../../engine/cma.js'
import { classifyPot, rankDrawOrder } from '../../../engine/decumulation-plan.js'
import { TAX } from '../../../engine/fq-calculator.js'
import { useEvents, EV } from '../../../state/events.jsx'

const fmt = (n) => `£${Math.round(+n || 0).toLocaleString('en-GB')}`

function Row({ label, value, hint }) {
  return (
    <div style={{ borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))', paddingBottom: 10 }}>
      <div className="sw-eyebrow">{label.toUpperCase()}</div>
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

export function PensionLeaf({ pot, entity, pots = [], personaId, onClose, onHome, onPlanIncome }) {
  const cma = getActiveCMA()
  const age = entity?.age ?? 65
  const retire = entity?.retirementAge ?? 67
  const years = Math.max(1, retire - age)
  const isSipp = classifyPot(pot) === 'self-invested'
  const nodeType = isSipp ? 'pension-sipp' : 'pension-occupational-dc'
  const rate = growthRateFor(nodeType, cma)

  const dragPerYear = Math.round((+pot.value || 0) * (+pot.charge || 0))
  const lsa = TAX?.lsa ?? 268275
  const tfcShare = Math.min((+pot.value || 0) * 0.25, lsa)

  // This pot's specific position in the draw-order (ties leaf to the map).
  const enriched = pots.map(p => ({ ...p, expectedReturn: growthRateFor(classifyPot(p) === 'self-invested' ? 'pension-sipp' : 'pension-occupational-dc', cma) }))
  const ranked = rankDrawOrder(enriched).ranked
  const myRank = ranked.find(r => r.pot?.name === pot.name)
  const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }

  const { commit } = useEvents()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(+pot.value || 0))
  const saveValue = () => {
    if (personaId) commit(personaId, { type: EV.ASSET_FIELD_CORRECTED, payload: { category: 'pensions', name: pot.name, field: 'value', value: +val } })
    setEditing(false)
  }

  return (
    <OverlayShell
      title={pot.name}
      subtitle={isSipp ? 'Self-invested · you control drawdown' : 'Workplace / legacy · verify first'}
      onBack={onClose}
      onHome={onHome}
    >
      <div style={{ padding: 16, display: 'grid', gap: 16 }}>
        {/* Hero */}
        <div>
          <div className="sw-eyebrow">VALUE TODAY</div>
          <div style={{ fontSize: 'var(--fs-hero,34px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(pot.value)}</div>
          <span className={isSipp ? 'sw-chip sw-chip-blue' : 'sw-chip sw-chip-warn'} style={{ display: 'inline-block', marginTop: 6 }}>{pot.type || (isSipp ? 'SIPP' : 'Legacy')}</span>
        </div>

        {/* Interactive projection — drag growth, toggle real-terms, watch it move */}
        <InteractiveProjection
          now={+pot.value || 0}
          baselineRate={rate}
          inflation={cma?.inflation ?? 0.025}
          years={years}
          retirementAge={retire}
          onOpenAssumptions={() => window.dispatchEvent(new CustomEvent('sonus:open-assumptions'))}
        />

        {pot.provider && <Row label="Provider" value={pot.provider} hint="Who administers this pot." />}
        <Row label="Annual charge" value={`${((pot.charge || 0) * 100).toFixed(2)}% ≈ ${fmt(dragPerYear)}/yr`} hint="What this pot costs you each year in fees." />
        <Row label="Tax-free cash from this pot" value={`up to ${fmt(tfcShare)}`} hint="25% of this pot, within your Lump Sum Allowance across all pensions." />
        <Row label="Who inherits" value={pot.nominationDate ? `Nomination on file (${pot.nominationDate})` : 'No nomination on file'} hint="From 6 April 2027 this pot counts toward your estate for inheritance tax." />
        <Row label="Exit penalty / guarantees" value={isSipp ? 'None typical for a SIPP' : 'Not yet verified'} hint={isSipp ? 'Self-invested pots normally have no exit penalty.' : 'Legacy/workplace schemes can carry penalties, a protected pension age, or guaranteed benefits worth keeping. Check with the provider before drawing.'} />

        {/* Specific draw-order position — ties this leaf to the decision map */}
        {myRank && (
          <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-md,10px)', padding: 12 }}>
            <div className="sw-eyebrow">WHEN TO TURN THIS INTO INCOME</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>
              {myRank.priority === 'verify-keep' ? 'Verify before drawing' : `Drawn ${ORD[myRank.order] || myRank.order + 'th'} of ${ranked.length}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4 }}>{myRank.primaryReason}</div>
          </div>
        )}

        {/* What's inside — capture prompt (no holdings data yet) */}
        <div style={{ padding: 10, borderRadius: 'var(--r-md,10px)', border: '1px dashed var(--c-border,rgba(255,255,255,0.2))' }}>
          <div className="sw-eyebrow">WHAT'S INSIDE THIS POT</div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4 }}>Fund mix and actual return aren't captured yet. Add them to replace the {(rate * 100).toFixed(1)}% assumption with this pot's real growth — and to rank it precisely against your other pots.</div>
        </div>

        {/* Drawdown link — the income decision lives on Cashflow (whole-portfolio) */}
        {onPlanIncome && (
          <button
            type="button"
            onClick={onPlanIncome}
            className="sw-press"
            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--r-md,10px)', border: '1px solid color-mix(in srgb, var(--c-acc,#5ddbc2) 30%, transparent)', background: 'color-mix(in srgb, var(--c-acc,#5ddbc2) 8%, transparent)', color: 'var(--c-acc,#5ddbc2)', fontWeight: 700, cursor: 'pointer' }}
          >
            <span>Plan how to draw this as income — across all your money</span>
            <span aria-hidden>→</span>
          </button>
        )}

        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={val} onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--c-border,rgba(255,255,255,0.2))', background: 'var(--c-surface,rgba(255,255,255,0.04))', color: 'var(--c-text)' }} />
            <button type="button" onClick={saveValue} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--c-acc,#5ddbc2)', color: '#06231f', fontWeight: 700, cursor: 'pointer' }}>Save</button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--c-border,rgba(255,255,255,0.2))', background: 'transparent', color: 'var(--c-text)', cursor: 'pointer' }}>Update value</button>
        )}

        <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>Information and guidance only. Not personal advice.</div>
      </div>
    </OverlayShell>
  )
}
