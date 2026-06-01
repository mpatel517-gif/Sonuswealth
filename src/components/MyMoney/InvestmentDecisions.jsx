// ─────────────────────────────────────────────────────────────────────────────
// InvestmentDecisions — model EVERY decision for an investment holding and see
// the cash + TAX impact before committing. Wrapper-aware (the property pattern
// generalised). Researched taxonomy (gov.uk + adviser guidance, 2026/27):
//   · GIA            — Sell/realise (CGT 18/24% over £3k exempt) · Bed & ISA
//                      (shelter future growth, 30-day rule doesn't bridge
//                      wrappers) · Hold (defer).
//   · EIS/SEIS/VCT   — Hold to clear the relief clock (EIS/SEIS 3y, VCT 5y) vs
//                      Sell now (income-tax relief clawback + lose CGT freedom).
//   · Bonds (on/off) — Withdraw within the 5%/yr tax-deferred allowance vs
//                      Surrender (chargeable-event gain, top-slicing relief).
//   · ISA            — Withdraw (tax-free) vs Top up this year's allowance.
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

export default function InvestmentDecisions({ asset = {}, wrapper = 'GIA', isHigherRate = true, onAddToPlan }) {
  const value = +(asset.value ?? asset.balance ?? asset.balance_gbp ?? 0)
  const basis = +asset.cost_base || (asset.embedded_gain != null ? value - +asset.embedded_gain : 0)
  const gain = Math.max(0, value - (basis || 0))
  const exempt = TAX?.cgaAllowance ?? TAX?.cgtAnnualExempt ?? 3000
  const cgtRate = isHigherRate ? (TAX?.cgtHigher ?? 0.24) : (TAX?.cgtBasic ?? 0.18)   // non-residential 24/18
  const isaAllow = TAX?.isaAllowance ?? 20000
  const isaUsed = +asset.contribution_current_tax_year || 0
  const isaRoom = Math.max(0, isaAllow - isaUsed)

  const W = String(wrapper).toUpperCase()
  const isISA = W === 'ISA'
  const isRelief = ['EIS', 'SEIS', 'VCT'].includes(W)
  const isBond = W === 'BOND_ON' || W === 'BOND_OFF'
  const decisions = isISA ? ['withdraw', 'topup']
    : isRelief ? ['hold', 'sellnow']
    : isBond ? ['withdraw5', 'surrender']
    : ['sell', 'bedisa', 'hold']
  const LABEL = { sell: 'Sell / realise', bedisa: 'Bed & ISA', hold: 'Hold', withdraw: 'Withdraw', topup: 'Top up', sellnow: 'Sell now', withdraw5: 'Withdraw 5%', surrender: 'Surrender' }
  const [pick, setPick] = useState(decisions[0])
  const active = decisions.includes(pick) ? pick : decisions[0]
  const [saved, setSaved] = useState(null)

  const fireAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: q, context: { metric: 'investmentDecision', decision: active, wrapper: W, name: asset.name, value, scope: 'mymoney' } } }))
  const addPlan = (label, summary, deltas) => { onAddToPlan?.({ kind: 'investment-decision', decision: active, wrapper: W, label, summary, asset: asset.name, deltas }); setSaved(active) }

  let body = null, askQ = '', planLabel = '', planSummary = '', planDeltas = []

  if (active === 'sell') {
    const taxable = Math.max(0, gain - exempt)
    const cgt = Math.round(taxable * cgtRate)
    const net = value - cgt
    askQ = `If I sold ${asset.name || 'this holding'} now, what CGT would I pay and how could I reduce it (e.g. spread across tax years)?`
    planLabel = 'Sell / realise'; planSummary = `Realise ${gbp(value)} → ${gbp(net)} after ${gbp(cgt)} CGT`
    planDeltas = [{ category: 'investments', deltaNow: -value }, { category: 'cash', deltaNow: net }]
    body = (<>
      <Row label="Market value" value={gbp(value)} />
      <Row label="Cost basis" value={basis ? gbp(basis) : 'not captured'} />
      <Row label={`Taxable gain (after £${exempt / 1000}k exempt)`} value={gbp(taxable)} tone="warn" />
      <Row label={`CGT at ${Math.round(cgtRate * 100)}%`} value={gbp(cgt)} tone="bad" />
      <Row label="Cash after sale" value={gbp(net)} tone="good" strong />
      <Note>Gains above the £{exempt / 1000}k annual exemption are taxed at {Math.round(cgtRate * 100)}%. Realising across two tax years (exchange before 6 April, complete after) uses two exemptions. A spouse transfer first uses a second exemption + their lower band.</Note>
    </>)
  }
  if (active === 'bedisa') {
    const moved = Math.min(value, isaRoom)
    const gainSheltered = gain * (moved / Math.max(1, value))
    askQ = `If I did a Bed & ISA on ${asset.name || 'this holding'}, how much could I shelter this year and what does it save long-term?`
    planLabel = 'Bed & ISA'; planSummary = `Shelter ${gbp(moved)} into your ISA`
    planDeltas = []  // value stays; it's a tax-efficiency move, not a balance change
    body = (<>
      <Row label="ISA room left this year" value={gbp(isaRoom)} tone={isaRoom > 0 ? 'good' : 'neutral'} />
      <Row label="Could move now" value={gbp(moved)} tone="good" strong />
      <Row label="Gain sheltered from future CGT" value={gbp(gainSheltered)} tone="good" />
      <Note>Selling in your GIA and re-buying inside the ISA moves future growth out of CGT permanently. Because they're separate wrappers, the 30-day “bed-and-breakfast” rule doesn't apply. The sale itself still uses this year's CGT exemption.</Note>
    </>)
  }
  if (active === 'hold' && !isRelief) {
    askQ = `What happens if I just hold ${asset.name || 'this holding'} — CGT deferred, but is the gain building up?`
    planLabel = 'Hold'; planSummary = 'Defer — no tax now'
    body = (<>
      <Row label="Tax now" value="£0 — no disposal" tone="good" />
      <Row label="Embedded gain building" value={gbp(gain)} tone={gain > exempt ? 'warn' : 'neutral'} />
      <Note>Holding defers CGT, but the gain keeps building — once it's well above the £{exempt / 1000}k exemption, a future single sale is taxed in one hit. Using the exemption a bit each year (or Bed & ISA) keeps it in check.</Note>
    </>)
  }
  if (active === 'hold' && isRelief) {
    const held = asset.year_purchased ? (2026 - +asset.year_purchased) : null
    const need = +asset.minimum_hold_years || (W === 'VCT' ? 5 : 3)
    const relief = +asset.income_tax_relief_claimed || 0
    const clears = asset.year_purchased ? +asset.year_purchased + need : null
    askQ = `How long until ${asset.name || 'this scheme'} clears its relief clawback period, and what do I keep if I hold?`
    planLabel = 'Hold to clear relief'; planSummary = clears ? `Relief safe from ${clears}` : 'Hold to keep relief'
    body = (<>
      <Row label="Income-tax relief claimed" value={relief ? gbp(relief) : '—'} tone="good" />
      <Row label="Held / required" value={`${held != null ? held : '—'} of ${need} years`} tone={held != null && held < need ? 'warn' : 'good'} />
      <Row label="Relief safe from" value={clears || '—'} strong />
      <Note>{W === 'VCT' ? 'VCTs need a 5-year hold to keep the income-tax relief (20% on subscriptions from April 2026); dividends are tax-free throughout.' : `${W} needs a ${need}-year hold to keep the relief; gains are then CGT-free, with loss relief if it fails.`} Selling before {clears || 'the clock clears'} repays the relief.</Note>
    </>)
  }
  if (active === 'sellnow') {
    const relief = +asset.income_tax_relief_claimed || 0
    const held = asset.year_purchased ? (2026 - +asset.year_purchased) : null
    const need = +asset.minimum_hold_years || (W === 'VCT' ? 5 : 3)
    const early = held != null && held < need
    askQ = `If I sold ${asset.name || 'this scheme'} now, would I lose the tax relief, and what would I net?`
    planLabel = 'Sell now'; planSummary = early ? `Clawback ${gbp(relief)} relief` : `Realise ${gbp(value)}`
    planDeltas = [{ category: 'investments', deltaNow: -value }, { category: 'cash', deltaNow: value - (early ? relief : 0) }]
    body = (<>
      <Row label="Proceeds" value={gbp(value)} />
      <Row label="Relief clawback" value={early ? `−${gbp(relief)}` : 'None — clock cleared'} tone={early ? 'bad' : 'good'} />
      <Row label="CGT on gain" value={['EIS', 'SEIS'].includes(W) && !early ? 'Nil — exempt after hold' : 'May apply'} tone={early ? 'warn' : 'good'} />
      <Row label="Net after clawback" value={gbp(value - (early ? relief : 0))} tone="good" strong />
      <Note>{early ? `Selling before ${asset.year_purchased ? +asset.year_purchased + need : 'the hold clears'} repays the ${gbp(relief)} income-tax relief${['EIS', 'SEIS'].includes(W) ? ' and forfeits the CGT exemption' : ''}.` : 'The hold period is cleared — the relief is safe and (for EIS/SEIS) gains are CGT-free.'}</Note>
    </>)
  }
  if (active === 'withdraw5' || active === 'withdraw') {
    const usedPct = +asset.withdrawal_5pct_used_pct || 0
    const annualAllow = Math.round(value * 0.05)
    const remainAllow = Math.round(annualAllow * (1 - Math.min(1, usedPct)))
    askQ = `How much can I take from ${asset.name || 'this'} ${isBond ? 'bond tax-deferred this year' : 'ISA tax-free'}, and what happens above that?`
    planLabel = isBond ? 'Withdraw 5%' : 'Withdraw'; planSummary = `Take ${gbp(isBond ? remainAllow : value)}${isBond ? ' tax-deferred' : ' tax-free'}`
    planDeltas = [{ category: 'investments', deltaNow: -(isBond ? remainAllow : value) }, { category: 'cash', deltaNow: (isBond ? remainAllow : value) }]
    body = isBond ? (<>
      <Row label="5%/yr tax-deferred allowance" value={gbp(annualAllow)} />
      <Row label="Used this year" value={`${Math.round(usedPct * 100)}%`} tone={usedPct > 0.7 ? 'warn' : 'neutral'} />
      <Row label="Can still take tax-deferred" value={gbp(remainAllow)} tone="good" strong />
      <Note>You can withdraw 5% of the original premium each year (cumulative to 100%) with the tax deferred. Beyond it, the excess is a chargeable-event gain taxed at your marginal rate, with top-slicing relief.</Note>
    </>) : (<>
      <Row label="Withdrawal" value={gbp(value)} tone="good" />
      <Row label="Tax" value="£0 — ISA withdrawals are tax-free" tone="good" strong />
      <Note>ISA withdrawals are entirely tax-free. If it's a flexible ISA you can replace what you take out within the same tax year without it counting against your allowance again.</Note>
    </>)
  }
  if (active === 'surrender') {
    const premium = basis || value
    const ceGain = Math.max(0, value - premium)
    const tax = Math.round(ceGain * (isHigherRate ? 0.20 : 0))   // onshore: 20% credit already paid; HR extra ~20%
    askQ = `If I fully surrendered ${asset.name || 'this bond'}, what's the chargeable-event gain and could top-slicing reduce the tax?`
    planLabel = 'Surrender'; planSummary = `Chargeable gain ${gbp(ceGain)}`
    planDeltas = [{ category: 'investments', deltaNow: -value }, { category: 'cash', deltaNow: value - tax }]
    body = (<>
      <Row label="Surrender value" value={gbp(value)} />
      <Row label="Chargeable-event gain" value={gbp(ceGain)} tone="warn" />
      <Row label={`Indicative ${W === 'BOND_ON' ? 'higher-rate' : 'marginal'} tax`} value={gbp(tax)} tone="bad" />
      <Row label="Cash after tax" value={gbp(value - tax)} tone="good" strong />
      <Note>{W === 'BOND_ON' ? 'An onshore bond carries a 20% basic-rate credit; only higher/additional-rate tax is due on the gain.' : 'An offshore bond rolls up gross — the whole gain is taxed at your marginal rate on surrender.'} Top-slicing spreads the gain over the years held and often cuts the tax — worth modelling before you surrender.</Note>
    </>)
  }
  if (active === 'topup') {
    askQ = `How much ISA allowance do I have left this year and what's the benefit of topping up ${asset.name || 'this ISA'}?`
    planLabel = 'Top up ISA'; planSummary = `${gbp(isaRoom)} allowance left`
    body = (<>
      <Row label="ISA allowance this year" value={gbp(isaAllow)} />
      <Row label="Used so far" value={gbp(isaUsed)} />
      <Row label="Room remaining" value={gbp(isaRoom)} tone={isaRoom > 0 ? 'good' : 'neutral'} strong />
      <Note>Anything you add inside the ISA grows free of CGT and income tax forever, and withdrawals are tax-free. The allowance resets each 6 April and can't be carried forward — use it or lose it.</Note>
    </>)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Model a decision</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Weigh up your options for this holding — the cash and tax impact before you act. Nothing here changes your records.
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
