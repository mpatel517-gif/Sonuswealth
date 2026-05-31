// PensionSummaryDrill.jsx — L2. Groups pots by type, shows per-pot trend/drag,
// one "Turn this into income" CTA, then the ordered §4.5 analysis spine.
// OverlayShell prop is onBack (not onClose).
import { useState } from 'react'
import OverlayShell from '../../shared/OverlayShell.jsx'
import { MiniTrendLines } from './MiniTrendLines.jsx'
import { PensionLeaf } from './PensionLeaf.jsx'
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
    <button
      type="button"
      onClick={() => onOpen(pot)}
      className="sw-press"
      style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', padding: '12px 8px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))', textAlign: 'left', cursor: 'pointer' }}
    >
      <span className={isSipp ? 'sw-chip-sm sw-chip-blue' : 'sw-chip-sm sw-chip-warn'} style={{ flexShrink: 0 }}>{pot.type || (isSipp ? 'SIPP' : 'Legacy')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{pot.name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{fmt(pot.value)} · {fmt(drag)}/yr fees · <span style={{ color: stale ? 'var(--c-gold,#E8B84B)' : 'var(--c-good,#5DDBA8)' }}>{stale ? 'nomination — review' : 'nomination up to date'}</span></div>
      </div>
      <MiniTrendLines series={[series]} width={64} height={24} />
      <span style={{ color: 'var(--c-text3)' }}>›</span>
    </button>
  )
}

function Section({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid var(--c-border,rgba(255,255,255,0.08))' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', background: 'transparent', border: 'none', color: 'var(--c-text)', cursor: 'pointer' }}>
        <span className="sw-eyebrow">{title}</span><span style={{ color: 'var(--c-text3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 8px 12px', fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5 }}>{children}</div>}
    </div>
  )
}

export function PensionSummaryDrill({ entity, pots = [], personaId, onClose, onHome, onPlanIncome }) {
  const cma = getActiveCMA()
  const [leaf, setLeaf] = useState(null)
  // Decumulation strategy lives on Cashflow (mymoney-checklist L18) — this drill
  // shows holdings (§4.5) and LINKS to the income plan rather than hosting it.
  const planIncome = () => (onPlanIncome ? onPlanIncome() : null)

  const total = pots.reduce((s, p) => s + (+p.value || 0), 0)
  const sipps  = pots.filter(p => classifyPot(p) === 'self-invested')
  const legacy = pots.filter(p => classifyPot(p) === 'workplace-legacy')
  const needReview = potsNeedingReview(pots).length

  const lsa = TAX?.lsa ?? 268275, lsdba = TAX?.lsdba ?? 1073100, aa = TAX?.pensionAA ?? 60000
  const tfcAvail = Math.min(total * 0.25, lsa)
  const totalFees = pots.reduce((s, p) => s + (+p.value || 0) * (+p.charge || 0), 0)

  if (leaf) return <PensionLeaf pot={leaf} entity={entity} pots={pots} personaId={personaId} onClose={() => setLeaf(null)} onHome={onHome} />

  return (
    <OverlayShell
      title="Your pensions"
      subtitle={`${fmt(total)} across ${pots.length} pension${pots.length !== 1 ? 's' : ''}${needReview ? ` · ${needReview} need review` : ''}`}
      onBack={onClose}
      onHome={onHome}
    >
      <div style={{ padding: 12 }}>
        {sipps.length > 0 && <>
          <div className="sw-eyebrow" style={{ marginTop: 4 }}>SELF-INVESTED · YOU CONTROL</div>
          {sipps.map(p => <PotRow key={p.name} pot={p} entity={entity} cma={cma} onOpen={setLeaf} />)}
        </>}
        {legacy.length > 0 && <>
          <div className="sw-eyebrow" style={{ marginTop: 14 }}>WORKPLACE / LEGACY · VERIFY FIRST</div>
          {legacy.map(p => <PotRow key={p.name} pot={p} entity={entity} cma={cma} onOpen={setLeaf} />)}
        </>}

        <button
          type="button"
          onClick={planIncome}
          className="sw-press"
          style={{ display: 'block', width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--r-lg,14px)', border: 'none', background: 'var(--c-acc,#5ddbc2)', color: '#06231f', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
        >
          Plan how to turn this into income →
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: 0.75, marginTop: 2 }}>across all your money, on Cashflow</span>
        </button>

        <div style={{ marginTop: 16 }}>
          <Section title="CONTRIBUTIONS">Annual Allowance headroom is {fmt(aa)} this year. If you have taken flexible income, the lower Money Purchase Annual Allowance may apply. Carry-forward from the last 3 years can add headroom — capture your contribution history to calculate it.</Section>
          <Section title="TAX-FREE CASH">Up to {fmt(tfcAvail)} available now (25% of your pots, within the {fmt(lsa)} Lump Sum Allowance). The combined cap including death benefits is {fmt(lsdba)}.</Section>
          <Section title="ESTATE (FROM APRIL 2027)">From 6 April 2027 unused pension pots count toward your estate for inheritance tax. <button type="button" onClick={planIncome} style={{ color: 'var(--c-acc,#5ddbc2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>See how this affects your income plan →</button></Section>
          <Section title="CHARGES">Total fees across your pots ≈ {fmt(totalFees)}/yr. Open a pot to see its drag.</Section>
          <Section title="DATA COMPLETENESS">{needReview ? `${needReview} pot${needReview > 1 ? 's' : ''} need a nomination review or guarantee check.` : 'All pots have a recent nomination on file.'}</Section>
        </div>

        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 14 }}>Information and guidance only. Not personal advice. Verify decisions with an FCA-authorised adviser before acting.</div>
      </div>
    </OverlayShell>
  )
}
