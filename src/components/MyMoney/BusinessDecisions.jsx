// ─────────────────────────────────────────────────────────────────────────────
// BusinessDecisions — model the decisions a company owner / director makes, with
// the cash + TAX + ESTATE impact. Researched taxonomy (gov.uk + adviser guidance
// 2026/27), not assumed:
//   COMPANY shares:
//     · Extract profit — dividend (35.75% higher / 10.75% basic from Apr 2026,
//       after £500 allowance) vs employer pension (Corp-Tax deductible, no NI).
//     · Sell — BADR 18% (2026/27) up to the £1m lifetime cap if 5%+/2yr, else 24%.
//     · Gift — Business Property Relief 100% to £2.5m / 50% above (Apr 2026), a
//       7-year PET, with s165 hold-over so no CGT on the gift itself.
//     · Pass on — BPR applies on death; shares stay in the estate above the cap.
//   DIRECTOR'S LOAN (in credit): repay to yourself tax-free. (Overdrawn → S455
//     33.75% if not cleared 9m+1d after year end — flagged.)
//
// COMPLIANCE: a MODEL of the user's own figures + named rules, never advice.
// Emits structured `deltas` so "Add to plan" moves the Plan lens.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { TAX } from '../../engine/fq-calculator.js'
import { BRAND } from '../../config/brand.js'

function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}
function Row({ label, value, tone, strong }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'bad' ? 'var(--c-coral,#FF6F7D)' : tone === 'warn' ? '#FF9500' : 'var(--c-text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 850 : 700, color: fg, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
function Note({ children }) { return <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.45 }}>{children}</div> }

export default function BusinessDecisions({ asset = {}, isHigherRate = true, onAddToPlan }) {
  const value = +(asset.value ?? asset.share_value_gbp ?? asset.estimated_value ?? asset.balance ?? 0)
  const basis = +asset.acquisition_cost || +asset.cost_base || 0
  const gain = Math.max(0, value - basis)
  const type = String(asset.type || '').toLowerCase()
  const isDLA = /director|loan|dla/.test(type) || asset.in_credit != null
  const isScheme = /emi|csop|saye|sip|rsu|share.?scheme|option/.test(type)

  // Researched rates (fallbacks = current 2026/27).
  // Audit fix (2026-06-01): keys were TAX.dividendHigher/dividendBasic/bprCap —
  // none exist in the bundle, so these silently fell back to the literals (correct
  // by luck). Correct keys are dividendHR/dividendBR/bprCombinedCap so the modeller
  // now tracks bundle updates.
  const divHigher = TAX?.dividendHR ?? 0.3575
  const divBasic = TAX?.dividendBR ?? 0.1075
  const divRate = isHigherRate ? divHigher : divBasic
  const corp = TAX?.corpMainRate ?? 0.25
  const badr = TAX?.badrRate ?? 0.18
  const cgt = isHigherRate ? (TAX?.cgtHigher ?? 0.24) : (TAX?.cgtBasic ?? 0.18)
  const bprCap = TAX?.bprCombinedCap ?? 2_500_000
  // shareholding_pct is stored as a fraction (1.0 = 100%); normalise so a 100%
  // director isn't read as 1% and wrongly denied BADR.
  const _rawPct = asset.shareholding_pct ?? asset.ownership_pct
  const ownPct = _rawPct == null ? 100 : (_rawPct <= 1 ? _rawPct * 100 : _rawPct)
  const qualifiesBadr = ownPct >= 5

  const decisions = isDLA ? ['repay']
    : isScheme ? ['exercise', 'hold']
    : ['extract', 'sell', 'gift', 'hold']
  const LABEL = { extract: 'Extract profit', sell: 'Sell shares', gift: 'Gift shares', hold: 'Pass on', repay: 'Repay to me', exercise: 'Exercise / sell' }
  const [pick, setPick] = useState(decisions[0])
  const active = decisions.includes(pick) ? pick : decisions[0]
  const [saved, setSaved] = useState(null)
  const [extract, setExtract] = useState(10000)

  const fireAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: q, context: { metric: 'businessDecision', decision: active, name: asset.name, value, scope: 'mymoney' } } }))
  const addPlan = (label, summary, deltas) => { onAddToPlan?.({ kind: 'business-decision', decision: active, label, summary, asset: asset.name, deltas }); setSaved(active) }

  let body = null, askQ = '', planLabel = '', planSummary = '', planDeltas = []

  if (active === 'extract') {
    const divNet = Math.round(extract * (1 - divRate))
    const pensionSaved = Math.round(extract * corp)   // corp tax the company saves by paying into pension
    askQ = `What's the most tax-efficient way to take ${gbp(extract)} out of my company — dividend, salary or employer pension?`
    planLabel = `Extract ${gbp(extract)}`; planSummary = `Dividend nets ${gbp(divNet)}; pension keeps ${gbp(extract)} + saves ${gbp(pensionSaved)} CT`
    planDeltas = [{ category: 'business', deltaNow: -extract }, { category: 'cash', deltaNow: divNet }]
    body = (<>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text2)', marginBottom: 6 }}>
        <span>Amount to take out</span><span style={{ fontWeight: 800, color: 'var(--c-text)' }}>{gbp(extract)}</span>
      </div>
      <input type="range" min={1000} max={50000} step={1000} value={extract} onChange={(e) => setExtract(+e.target.value)} style={{ width: '100%', accentColor: 'var(--c-acc)', marginBottom: 12 }} />
      <Row label={`As a dividend (${Math.round(divRate * 100)}% tax)`} value={`${gbp(divNet)} in pocket`} tone="warn" />
      <Row label="As an employer pension contribution" value={`${gbp(extract)} in pension`} tone="good" strong />
      <Row label="Corporation Tax saved by the pension route" value={gbp(pensionSaved)} tone="good" />
      <Note>Dividends above the £500 allowance are taxed at {Math.round(divBasic * 100)}% (basic) / {Math.round(divHigher * 100)}% (higher) from April 2026. An employer pension contribution is deductible against Corporation Tax and carries no National Insurance — the most efficient way to move company profit into your name, locked until age 57.</Note>
    </>)
  }
  if (active === 'sell') {
    const taxable = gain
    const tax = Math.round(taxable * (qualifiesBadr ? badr : cgt))
    const net = value - tax
    askQ = `If I sold my company shares for ${gbp(value)}, would Business Asset Disposal Relief apply and what would I net?`
    planLabel = 'Sell shares'; planSummary = `${gbp(value)} → ${gbp(net)} after ${gbp(tax)} CGT`
    planDeltas = [{ category: 'business', deltaNow: -value }, { category: 'cash', deltaNow: net }]
    body = (<>
      <Row label="Sale value" value={gbp(value)} />
      <Row label="Gain" value={gbp(gain)} />
      <Row label={qualifiesBadr ? `BADR at ${Math.round(badr * 100)}% (within £1m cap)` : `CGT at ${Math.round(cgt * 100)}%`} value={gbp(tax)} tone={qualifiesBadr ? 'good' : 'bad'} />
      <Row label="Cash after sale" value={gbp(net)} tone="good" strong />
      <Note>{qualifiesBadr ? `Business Asset Disposal Relief charges the first £1m of lifetime gains at ${Math.round(badr * 100)}% (2026/27) — you need a 5%+ holding, held two years, as an officer/employee.` : 'Without a 5% qualifying holding the gain is taxed at the normal CGT rate.'} The cash then sits in your estate, having left the BPR-sheltered wrapper.</Note>
    </>)
  }
  if (active === 'gift') {
    const reliefed = Math.min(value, bprCap)
    const above = Math.max(0, value - bprCap)
    const _ihtRate = TAX?.ihtRate ?? 0.40
    const ihtSaved = Math.round(reliefed * _ihtRate + above * (_ihtRate * 0.5)) // 100% relief within cap; 50% relief above = half-rate IHT
    askQ = `If I gifted my company shares to my children, how much Business Property Relief applies and what's the IHT and CGT position?`
    planLabel = 'Gift shares'; planSummary = `${gbp(reliefed)} at 100% BPR; 7-yr PET`
    planDeltas = [{ category: 'business', deltaNow: -value }]
    body = (<>
      <Row label="Value gifted" value={gbp(value)} />
      <Row label="100% Business Relief (to £2.5m cap)" value={gbp(reliefed)} tone="good" />
      {above > 0 && <Row label="Above cap (50% relief)" value={gbp(above)} tone="warn" />}
      <Row label="CGT now" value="Nil — s165 hold-over available" tone="good" />
      <Row label="IHT saved if you survive 7 years" value={`~${gbp(ihtSaved)}`} tone="good" strong />
      <Note>Trading-company shares qualify for Business Property Relief — 100% on the first £2.5m of combined business/agricultural property from April 2026, 50% above. A lifetime gift is also a 7-year potentially-exempt transfer, and s165 hold-over relief defers the capital gain so no CGT falls due on the gift itself.</Note>
    </>)
  }
  if (active === 'hold') {
    const reliefed = Math.min(value, bprCap)
    const above = Math.max(0, value - bprCap)
    const iht = Math.round(above * 0.20)
    askQ = `If I hold my company shares to death, what does Business Property Relief shelter and what IHT is left?`
    planLabel = 'Hold to death'; planSummary = `BPR shelters ${gbp(reliefed)}`
    body = (<>
      <Row label="100% Business Relief shelters" value={gbp(reliefed)} tone="good" />
      {above > 0 && <Row label="Above £2.5m cap — 50% relief, IHT on the rest" value={gbp(iht)} tone="bad" /> }
      <Row label="CGT" value="£0 — base cost uplifts on death" tone="good" />
      <Note>Holding qualifying trading shares to death keeps 100% Business Relief on the first £2.5m (50% above, from April 2026) and washes out the capital gain. The relief depends on the company staying a trading company — an investment company doesn't qualify.</Note>
    </>)
  }
  if (active === 'repay') {
    const credit = asset.in_credit !== false
    askQ = `My director's loan account ${credit ? 'is in credit' : 'is overdrawn'} — what are my options and the tax position?`
    planLabel = credit ? 'Repay loan to me' : 'Clear overdrawn loan'; planSummary = credit ? `Take ${gbp(value)} tax-free` : 'Avoid S455'
    planDeltas = credit ? [{ category: 'business', deltaNow: -value }, { category: 'cash', deltaNow: value }] : []
    body = credit ? (<>
      <Row label="Company owes you" value={gbp(value)} tone="good" />
      <Row label="Tax to take it back" value="£0 — repaying your own loan" tone="good" strong />
      <Note>The company owes you {gbp(value)}. You can draw it back at any time with no personal tax — it's the return of money you lent in, not income. Useful as a tax-free buffer when company cash allows.</Note>
    </>) : (<>
      <Row label="You owe the company" value={gbp(value)} tone="bad" />
      <Row label="S455 charge if not cleared 9m+1d after year-end" value={gbp(Math.round(value * (TAX?.s455Rate ?? 0.3375)))} tone="bad" strong />
      <Note>An overdrawn loan over £10,000 is also a benefit-in-kind unless you pay the official rate of interest. Clearing it before 9 months and 1 day after the year end avoids the 33.75% S455 charge (which is reclaimable once repaid).</Note>
    </>)
  }
  if (active === 'exercise') {
    askQ = `When should I exercise or sell ${asset.name || 'this share scheme'}, and what tax applies (income tax, NI, CGT, BADR)?`
    planLabel = 'Exercise / sell'; planSummary = `Realise ${gbp(value)}`
    planDeltas = [{ category: 'business', deltaNow: -value }, { category: 'cash', deltaNow: value }]
    body = (<>
      <Row label="Estimated value" value={gbp(value)} />
      <Row label="EMI / approved scheme" value="No income tax at grant; CGT on sale" tone="good" />
      <Note>Tax-advantaged schemes (EMI, CSOP, SAYE, SIP) skip income tax and NI at exercise — you pay CGT on the eventual gain, and EMI shares can qualify for BADR with the clock running from grant. Unapproved options are taxed as income at exercise.</Note>
    </>)
  }
  if (active === 'hold' && isScheme) { /* handled above for company; scheme hold falls through to generic */ }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Model a decision</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Your options for this business interest — the cash, tax and estate impact before you act. Nothing here changes your records.
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {decisions.map(d => (
          <button key={d} type="button" onClick={() => { setPick(d); setSaved(null) }} className="sw-press" style={{
            padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            border: `1px solid ${active === d ? 'color-mix(in srgb, var(--c-acc) 45%, transparent)' : 'var(--c-border)'}`,
            background: active === d ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)' : 'var(--c-surface2)',
            color: active === d ? 'var(--c-acc)' : 'var(--c-text2)',
          }}>{LABEL[d]}</button>
        ))}
      </div>
      <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '4px 14px 14px' }}>
        {body}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => fireAsk(askQ)} className="sw-press" style={{ background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)', color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⚡ Explore this with Sonu</button>
          <button type="button" onClick={() => addPlan(planLabel, planSummary, planDeltas)} className="sw-press" style={{ background: saved === active ? 'color-mix(in srgb, var(--c-acc) 18%, transparent)' : 'var(--c-surface2)', border: '1px solid var(--c-border)', color: saved === active ? 'var(--c-acc)' : 'var(--c-text2)', borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saved === active ? '✓ Added to your Plan' : '+ Add to plan'}</button>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>{BRAND.disclaimer}</p>
    </div>
  )
}
