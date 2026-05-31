// PensionLeaf.jsx — L3 per-pension leaf. "How is THIS pot doing + its role."
// Reuses projection (trend), decumulation-plan (sequence role), events (update).
// OverlayShell prop is onBack (not onClose); default export.
import { useState } from 'react'
import OverlayShell from '../../shared/OverlayShell.jsx'
import { InteractiveProjection } from './InteractiveProjection.jsx'
import { ContributionDecomposition } from './ContributionDecomposition.jsx'
import { FundDonut } from './FundDonut.jsx'
import { MiniTrendLines } from './MiniTrendLines.jsx'
import { growthRateFor, projectSeries } from '../../../engine/projection.js'
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
  // Normalise across pot shapes (value|balance, charge|charges_percent) and
  // prefer THIS pot's captured growth assumption over the class proxy — so two
  // pots no longer share one rate (doctrine §2: prefer the captured fact).
  const value = +pot.value || +pot.balance || 0
  const charge = +pot.charge || +pot.charges_percent || 0
  const rate = +pot.growth_rate_assumption || growthRateFor(nodeType, cma)
  const funds = Array.isArray(pot.funds) ? pot.funds : []
  const retireYrs = Math.max(1, retire - age)
  const history = Array.isArray(pot.valuation_history) ? pot.valuation_history : []
  const contributedToDate = pot.contributed_to_date || null
  const contributionMonthly = pot.contribution_monthly || null
  const inflation = cma?.inflation ?? 0.025
  const netRealRate = Math.max(0, rate - charge - inflation)   // matches the projection's real-terms mid line
  const contribAnnual = (((+(contributionMonthly?.personal) || 0) + (+(contributionMonthly?.employer) || 0))) * 12   // same forward contributions both charts use, so age-67 ties out
  const FUND_PALETTE = ['var(--c-acc,#5ddbc2)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-coral,#FF6F7D)', 'var(--c-text3,#8895a7)']

  const dragPerYear = Math.round(value * charge)
  const lsa = TAX?.lsa ?? 268275
  const tfcShare = Math.min(value * 0.25, lsa)

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
          <div style={{ fontSize: 'var(--fs-hero,34px)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</div>
          <span className={isSipp ? 'sw-chip sw-chip-blue' : 'sw-chip sw-chip-warn'} style={{ display: 'inline-block', marginTop: 6 }}>{pot.type || (isSipp ? 'SIPP' : 'Legacy')}</span>
        </div>

        {/* Interactive projection — drag growth, toggle real-terms, watch it move */}
        <InteractiveProjection
          now={value}
          baselineRate={rate}
          charge={charge}
          inflation={inflation}
          currentAge={age}
          retirementAge={retire}
          contributionPerYear={contribAnnual}
          history={history}
        />

        {/* What you put in vs what it grew (doctrine: decomposition, not overlay) */}
        {contributedToDate ? (
          <ContributionDecomposition
            now={value}
            currentAge={age}
            retireAge={retire}
            rate={netRealRate}
            contributedToDate={contributedToDate}
            contributionMonthly={contributionMonthly || {}}
          />
        ) : (
          <div style={{ padding: 10, borderRadius: 'var(--r-md,10px)', border: '1px dashed var(--c-border,rgba(255,255,255,0.2))' }}>
            <div className="sw-eyebrow">WHAT YOU PUT IN vs WHAT IT GREW</div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4 }}>Contribution history isn't captured for this pot yet. Add what you and any employer have paid in to see how much of {fmt(value)} is money invested versus investment growth.</div>
          </div>
        )}

        {pot.provider && <Row label="Provider" value={pot.provider} hint="Who administers this pot." />}
        <Row label="Annual charge" value={`${(charge * 100).toFixed(2)}% ≈ ${fmt(dragPerYear)}/yr`} hint="What this pot costs you each year in fees." />
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

        {/* Holdings inside this pot — the fund-level drill (doctrine §3). Renders
            real funds when captured; honest capture state when not. */}
        <div>
          <div className="sw-eyebrow">WHAT'S INSIDE THIS POT</div>
          {funds.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
                <FundDonut funds={funds} colors={FUND_PALETTE} />
              </div>
              {funds.map((fnd, i) => {
                const fv = +fnd.value || 0
                const fg = +fnd.growth_rate_assumption || rate
                const pct = value ? Math.round((fv / value) * 100) : 0
                return (
                  <div key={(fnd.name || '') + i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: FUND_PALETTE[i % FUND_PALETTE.length], display: 'inline-block', flexShrink: 0, opacity: 0.85 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{fnd.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{fmt(fv)} · {pct}% of pot · {(fg * 100).toFixed(1)}% assumed growth</div>
                    </div>
                    <MiniTrendLines series={[projectSeries(fv, fg, retireYrs)]} width={64} height={22} />
                  </div>
                )
              })}
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>Each line is that fund projected at its own assumption — not past performance. The pot's blended rate ({(rate * 100).toFixed(1)}%) drives the projection above.</div>
            </div>
          ) : (
            <div style={{ marginTop: 6, padding: 10, borderRadius: 'var(--r-md,10px)', border: '1px dashed var(--c-border,rgba(255,255,255,0.2))' }}>
              <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>Fund mix isn't captured for this pot yet. Add the funds to replace the {(rate * 100).toFixed(1)}% blended assumption with each holding's real growth — and to see how it's invested.</div>
            </div>
          )}
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
