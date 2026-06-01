// ─────────────────────────────────────────────────────────────────────────────
// CashDecisions — model the decisions for a cash account. Researched UK rules
// (2026/27): Personal Savings Allowance (£1,000 basic / £500 higher / £0
// additional), interest taxed at marginal rate above it; Cash ISA shelters
// interest tax-free; FSCS protects £85k per banking licence; cash above an
// emergency buffer loses real value to inflation.
//   · Move to a Cash ISA — shelter the interest from tax.
//   · Switch rate        — what a better easy-access rate would earn.
//   · Put surplus to work — cash above the buffer, invested (accepting risk).
//   · Emergency buffer    — months of essentials this covers.
//
// COMPLIANCE: a MODEL of the user's own figures + named rules, never advice.
// Emits structured `deltas` so "Add to plan" moves the Plan lens.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
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

export default function CashDecisions({ asset = {}, marginalRate = 0.4, psa = 500, monthlyEssentials = 0, totalCash = 0, isaRoom = 20000, onAddToPlan }) {
  const value = +(asset.value ?? asset.balance ?? 0)
  const rate = +asset.rate > 0 ? +asset.rate : 0.04
  const interest = Math.round(value * rate)
  const bestRate = 0.048   // indicative top easy-access; labelled

  const decisions = ['isa', 'switch', 'invest', 'buffer']
  const LABEL = { isa: 'Move to a Cash ISA', switch: 'Switch rate', invest: 'Put surplus to work', buffer: 'Emergency buffer' }
  const [pick, setPick] = useState('isa')
  const active = decisions.includes(pick) ? pick : decisions[0]
  const [saved, setSaved] = useState(null)
  const fireAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: q, context: { metric: 'cashDecision', decision: active, name: asset.name, value, scope: 'mymoney' } } }))
  const addPlan = (label, summary, deltas) => { onAddToPlan?.({ kind: 'cash-decision', decision: active, label, summary, asset: asset.name, deltas }); setSaved(active) }

  let body = null, askQ = '', planLabel = '', planSummary = '', planDeltas = []

  if (active === 'isa') {
    const moved = Math.min(value, isaRoom)
    const taxedInterest = Math.max(0, interest - psa)
    const taxSaved = Math.round(taxedInterest * marginalRate)
    askQ = `Should I move ${asset.name || 'this cash'} into a Cash ISA, and how much interest tax would it save?`
    planLabel = 'Move to a Cash ISA'; planSummary = `Shelter ${gbp(moved)} of interest from tax`
    planDeltas = []   // stays cash, just a tax-free wrapper
    body = (<>
      <Row label={`Interest this year (~${(rate * 100).toFixed(1)}%)`} value={gbp(interest)} />
      <Row label="Your savings allowance" value={gbp(psa)} tone="good" />
      <Row label="Taxed interest above the allowance" value={gbp(taxedInterest)} tone={taxedInterest > 0 ? 'warn' : 'neutral'} />
      <Row label={`Tax saved by moving to an ISA (${Math.round(marginalRate * 100)}%)`} value={gbp(taxSaved)} tone="good" strong />
      <Note>Interest above your £{psa.toLocaleString()} Personal Savings Allowance is taxed at your marginal rate. A Cash ISA shelters it entirely — useful once your savings throw off more interest than the allowance covers. The ISA allowance is shared with your stocks-and-shares ISA.</Note>
    </>)
  }
  if (active === 'switch') {
    const better = Math.round(value * bestRate)
    const gainMore = better - interest
    askQ = `My ${asset.name || 'account'} pays ${(rate * 100).toFixed(1)}% — how much more would a top easy-access rate earn, and is my money still protected?`
    planLabel = 'Switch to a better rate'; planSummary = `~${gbp(gainMore)}/yr more interest`
    body = (<>
      <Row label={`At your current ${(rate * 100).toFixed(1)}%`} value={`${gbp(interest)}/yr`} />
      <Row label={`At a top ~${(bestRate * 100).toFixed(1)}% easy-access`} value={`${gbp(better)}/yr`} tone="good" />
      <Row label="Extra interest a year" value={`~${gbp(gainMore)}`} tone="good" strong />
      <Note>Rates shown are indicative. Keep no more than £85,000 per banking licence so the full balance stays FSCS-protected. Switching easy-access savings carries no tax event — it's the same wrapper.</Note>
    </>)
  }
  if (active === 'invest') {
    const buffer = monthlyEssentials > 0 ? monthlyEssentials * 6 : 0
    const surplus = Math.max(0, totalCash - buffer)
    const onThis = Math.min(value, surplus)
    askQ = `How much of my cash is sitting above a sensible emergency buffer, and what are the trade-offs of investing it?`
    planLabel = 'Move surplus to investments'; planSummary = `${gbp(onThis)} above your buffer`
    planDeltas = onThis > 0 ? [{ category: 'cash', deltaNow: -onThis }, { category: 'investments', deltaNow: onThis }] : []
    body = (<>
      <Row label="Suggested buffer (6 months essentials)" value={buffer > 0 ? gbp(buffer) : 'set essentials to size it'} />
      <Row label="Total cash you hold" value={gbp(totalCash)} />
      <Row label="Cash above the buffer" value={gbp(surplus)} tone={surplus > 0 ? 'warn' : 'good'} strong />
      <Note>Cash beyond an emergency buffer steadily loses real value to inflation. Putting the surplus into investments aims for higher long-term growth but accepts the risk of short-term falls — only sensible for money you won't need for several years. This is a trade-off to weigh, not a recommendation.</Note>
    </>)
  }
  if (active === 'buffer') {
    const months = monthlyEssentials > 0 ? (value / monthlyEssentials) : null
    askQ = `Does ${asset.name || 'this account'} give me enough of an emergency buffer, and where should the buffer sit?`
    planLabel = 'Hold as buffer'; planSummary = months ? `${months.toFixed(1)} months covered` : 'Emergency buffer'
    body = (<>
      <Row label="This balance" value={gbp(value)} />
      <Row label="Covers (months of essentials)" value={months != null ? `${months.toFixed(1)} months` : '—'} tone={months != null && months >= 3 ? 'good' : 'warn'} strong />
      <Note>The usual rule of thumb is 3–6 months of essential spending in instant-access cash. Keeping the buffer easy to reach (and FSCS-protected) matters more than squeezing the last bit of interest out of it.</Note>
    </>)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Model a decision</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Your options for this cash — the tax and trade-offs before you act. Nothing here changes your records.
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
