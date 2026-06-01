// ─────────────────────────────────────────────────────────────────────────────
// PropertyDecisions — model EVERY decision a person can make with a property and
// see the cash + TAX + ESTATE impact before committing. Founder 2026-06-01:
// "the Sell button does nothing, Remortgage can't do anything with — there must
// be more options. Research the taxonomy yourself; my examples aren't the spec."
//
// The decision set + tax treatment were RESEARCHED (gov.uk Annex A 2026/27;
// landlord tax guides; CGT/SDLT/IHT current rules), not taken from the two
// examples given:
//   · Sell / downsize        — CGT (PPR-exempt home; residential 18/24% on a let),
//                              60-day reporting, selling costs → cash in hand.
//   · Remortgage             — not a disposal → no CGT; releases equity as a loan.
//   · Transfer to spouse     — no gain / no loss; splits a future gain across two
//                              annual exemptions + a basic-rate band (CGT saving).
//   · Move into a company    — escapes Section 24, but a market-value disposal:
//                              CGT now + SDLT (5% surcharge) = "dry tax"; s162
//                              relief rarely covers a personal let. Payback years.
//   · Gift to family         — CGT now at market value (connected party) + a
//                              7-year IHT PET; out of estate (saves 40%) if you
//                              survive 7 years; gift-with-reservation risk.
//   · Pass on (hold to death)— CGT washes out (base-cost uplift) but the full
//                              value sits in the estate at 40% IHT.
//
// COMPLIANCE: a MODEL of the user's own figures + named rules, never a
// recommendation. Rates come from the TAX bundle where present.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { TAX } from '../../engine/fq-calculator.js'
import { BRAND } from '../../config/brand.js'

function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}

// Additional-property SDLT (residential + 5% surcharge on every band, since
// 31 Oct 2024). Used by the incorporate modeller (transfer to a company is a
// purchase at market value).
function sdltAdditional(price) {
  const p = Math.max(0, +price || 0)
  // Standard residential bands + 5% additional-property surcharge on EVERY band
  // (0% / 2% / 5% / 10% / 12% standard, each +5%). The £125k–£250k slice was
  // previously missing — it was charged at 5% instead of 7% (2% + 5%). (Audit 2026-06-01.)
  const bands = [
    [125000, 0.05],   // 0% + 5%
    [250000, 0.07],   // 2% + 5%
    [925000, 0.10],   // 5% + 5%
    [1500000, 0.15],  // 10% + 5%
    [Infinity, 0.17], // 12% + 5%
  ]
  let tax = 0, prev = 0
  for (const [cap, rate] of bands) {
    if (p > prev) { tax += (Math.min(p, cap) - prev) * rate; prev = cap } else break
  }
  return Math.round(tax)
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

export default function PropertyDecisions({ asset = {}, debt = 0, costBasis = 0, isResidence = false, isHigherRate = true, onAddToPlan }) {
  const value = +(asset.value ?? asset.value_gbp ?? asset.balance ?? 0)
  const mortgage = +debt || 0
  const basis = +costBasis || +asset.purchase_price || +asset.cost_base || 0
  const equity = Math.max(0, value - mortgage)

  const exempt = TAX?.cgaAllowance ?? 3000
  // Residential CGT = general CGT bands (18%/24%) since Oct 2024; bundle exposes
  // cgtBasic/cgtHigher (no residential-specific key). Was reading non-existent
  // cgtResidentialHigher/Basic → fell back to literals. (Audit 2026-06-01.)
  const cgtHigher = TAX?.cgtHigher ?? 0.24
  const cgtBasic = TAX?.cgtBasic ?? 0.18
  const cgtRate = isHigherRate ? cgtHigher : cgtBasic
  const ihtRate = TAX?.ihtRate ?? 0.40
  const basicRate = TAX?.br ?? 0.20
  const nrb = TAX?.nrb ?? 325000
  const gain = Math.max(0, value - basis)

  // Decisions applicable to this property type (researched taxonomy).
  const decisions = isResidence
    ? ['sell', 'remortgage', 'gift', 'hold']
    : ['sell', 'remortgage', 'spouse', 'company', 'gift', 'hold']
  const LABEL = { sell: 'Sell', remortgage: 'Remortgage', spouse: 'Transfer to spouse', company: 'Move to a company', gift: 'Gift to family', hold: 'Pass on' }
  const [pick, setPick] = useState('sell')
  const active = decisions.includes(pick) ? pick : decisions[0]

  // Remortgage state
  const [ltv, setLtv] = useState(isResidence ? 0.70 : 0.75)

  const [saved, setSaved] = useState(null)
  const fireAsk = (q, ctx) => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: q, context: { metric: 'propertyDecision', decision: active, ...ctx, scope: 'mymoney' } } }))
  // deltas: structured per-category £ changes the Plan lens folds in (so "Add to
  // plan" visibly moves the Plan trajectory — e.g. sell drops Property, lifts Cash).
  const addPlan = (label, summary, deltas) => { onAddToPlan?.({ kind: 'property-decision', decision: active, label, summary, asset: asset.name, deltas }); setSaved(active) }

  // ── Per-decision model ──────────────────────────────────────────────────────
  let body = null, askQ = '', planLabel = '', planSummary = '', planDeltas = []

  if (active === 'sell') {
    const taxableGain = isResidence ? 0 : Math.max(0, gain - exempt)
    const cgt = Math.round(taxableGain * cgtRate)
    const costs = Math.round(value * 0.02)
    const net = Math.max(0, value - mortgage - cgt - costs)
    askQ = `If I sold ${asset.name || 'this property'} for ${gbp(value)}, what would I actually keep after CGT and costs — and how could I reduce the tax?`
    planLabel = 'Sell'; planSummary = `Sell ${gbp(value)} → ${gbp(net)} cash after ${gbp(cgt)} CGT`
    planDeltas = [{ category: 'property', deltaNow: -value }, { category: 'cash', deltaNow: net }]
    body = (<>
      <Row label="Sale value" value={gbp(value)} />
      <Row label="Cost basis" value={basis > 0 ? gbp(basis) : 'not captured'} />
      <Row label={isResidence ? 'Capital gains tax' : `Taxable gain (after £${(exempt / 1000)}k exempt)`} value={isResidence ? 'Nil — main home (PPR)' : gbp(taxableGain)} tone={isResidence ? 'good' : 'warn'} />
      {!isResidence && <Row label={`CGT at ${Math.round(cgtRate * 100)}% · report within 60 days`} value={gbp(cgt)} tone="bad" />}
      <Row label="Mortgage to redeem" value={gbp(mortgage)} tone="bad" />
      <Row label="Selling costs (≈2%)" value={gbp(costs)} tone="bad" />
      <Row label="Cash in hand" value={gbp(net)} tone="good" strong />
      <Note>{isResidence
        ? 'Your main home is CGT-free under Private Residence Relief. The cash then sits in your estate — downsizing releases equity but doesn’t cut IHT unless you gift it (7-year rule).'
        : `Tip: exchanging before 6 April and completing after splits the gain across two tax years — two £${(exempt / 1000)}k exemptions and potentially two basic-rate bands.`}</Note>
    </>)
  }

  if (active === 'remortgage') {
    const newLoan = Math.round(value * ltv)
    const released = Math.max(0, newLoan - mortgage)
    const rate = 0.052, rM = rate / 12, term = 300
    const pay = Math.round((newLoan * rM) / (1 - Math.pow(1 + rM, -term)))
    askQ = `If I remortgaged ${asset.name || 'this property'} to ${Math.round(ltv * 100)}% LTV, releasing ${gbp(released)}, what would it cost me and what could I do with the equity?`
    planLabel = `Remortgage to ${Math.round(ltv * 100)}% LTV`; planSummary = `Release ${gbp(released)}, payment ${gbp(pay)}/mo`
    planDeltas = [{ category: 'cash', deltaNow: released }]
    body = (<>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text2)', marginBottom: 6 }}>
        <span>New loan-to-value</span><span style={{ fontWeight: 800, color: 'var(--c-text)' }}>{Math.round(ltv * 100)}%</span>
      </div>
      <input type="range" min={Math.min(60, Math.round((mortgage / value) * 100))} max={isResidence ? 90 : 75} value={Math.round(ltv * 100)} onChange={(e) => setLtv(+e.target.value / 100)} style={{ width: '100%', accentColor: 'var(--c-acc)', marginBottom: 12 }} />
      <Row label="New mortgage" value={gbp(newLoan)} />
      <Row label="Current mortgage" value={gbp(mortgage)} />
      <Row label="Equity released now" value={gbp(released)} tone="good" strong />
      <Row label={`Indicative payment (${(rate * 100).toFixed(1)}% · 25y)`} value={`${gbp(pay)}/mo`} tone="warn" />
      <Note>Releasing equity is borrowing, not income — not taxed, but it adds to the loan and the monthly cost.{!isResidence && ' On a let, interest only earns a 20% credit (S24), so more borrowing raises your effective tax.'} The rate is indicative — a broker quotes your deal.</Note>
    </>)
  }

  if (active === 'spouse') {
    const halfGain = gain / 2
    const saving = Math.round(halfGain * (cgtHigher - cgtBasic) + exempt * cgtHigher)   // half taxed at basic not higher + a 2nd exemption
    askQ = `If I moved half of ${asset.name || 'this let'} to my spouse before selling, how much CGT would we save and what about the mortgage/SDLT?`
    planLabel = 'Transfer half to spouse'; planSummary = `~${gbp(saving)} CGT saved on a future sale`
    body = (<>
      <Row label="Transfer itself" value="No gain / no loss — £0 CGT now" tone="good" />
      <Row label="Their half of the gain" value={gbp(halfGain)} />
      <Row label="CGT saved on a future sale" value={`~${gbp(saving)}`} tone="good" strong />
      <Row label="SDLT" value={mortgage > 250000 ? 'Possible — on half the mortgage taken on' : 'None if no mortgage assumed over £250k'} tone={mortgage > 250000 ? 'warn' : 'neutral'} />
      <Note>Transfers between spouses/civil partners are no-gain/no-loss. Moving a share to a basic-rate spouse before selling uses a second £{(exempt / 1000)}k exemption and taxes their half at 18% instead of 24%. SDLT can bite if they take on a share of a mortgage above the threshold.</Note>
    </>)
  }

  if (active === 'company') {
    const cgtNow = Math.round(Math.max(0, gain - exempt) * cgtHigher)
    const sdlt = sdltAdditional(value)
    const dryTax = cgtNow + sdlt
    const interest = +asset.mortgage_interest_annual || Math.round(mortgage * 0.05)
    const annualSaving = Math.round(interest * basicRate)   // higher-rate relief restored vs the 20% S24 credit
    const payback = annualSaving > 0 ? (dryTax / annualSaving) : null
    askQ = `Is it worth moving ${asset.name || 'this let'} into a limited company? Model the dry tax now versus the Section 24 saving — and whether s162 relief could apply to me.`
    planLabel = 'Incorporate (Ltd)'; planSummary = `Dry tax ${gbp(dryTax)} now, ~${gbp(annualSaving)}/yr saved`
    planDeltas = [{ category: 'property', deltaNow: -value }, { category: 'business', deltaNow: value }, { category: 'cash', deltaNow: -dryTax }]
    body = (<>
      <Row label="CGT on transfer (24%)" value={gbp(cgtNow)} tone="bad" />
      <Row label="SDLT at market value (+5%)" value={gbp(sdlt)} tone="bad" />
      <Row label="“Dry tax” to incorporate" value={gbp(dryTax)} tone="bad" strong />
      <Row label="Section 24 saved per year" value={`~${gbp(annualSaving)}`} tone="good" />
      <Row label="Payback" value={payback ? `~${payback.toFixed(0)} years` : '—'} tone="warn" />
      <Note>A company escapes Section 24 (full interest deduction against Corporation Tax), but transferring a personally-held let is a market-value disposal — CGT now plus SDLT. Section 162 incorporation relief rarely covers a single personal let (it needs an active property business/partnership). Company shares get no Business Relief and no base-cost uplift on death — usually a long-term play for new purchases, not a retro-fit.</Note>
    </>)
  }

  if (active === 'gift') {
    const cgtNow = isResidence ? 0 : Math.round(Math.max(0, gain - exempt) * cgtHigher)
    const ihtSaved = Math.round(value * ihtRate)
    askQ = `If I gifted ${asset.name || 'this property'} to my children, what CGT is due now and how much IHT would it save if I survive seven years?`
    planLabel = 'Gift to family'; planSummary = `CGT now ${gbp(cgtNow)}; saves ~${gbp(ihtSaved)} IHT after 7y`
    planDeltas = [{ category: 'property', deltaNow: -value }]
    body = (<>
      <Row label="CGT now (gift = disposal at market value)" value={isResidence ? 'Nil — PPR (your main home)' : gbp(cgtNow)} tone={isResidence ? 'good' : 'bad'} />
      <Row label="Inheritance tax" value="7-year potentially-exempt transfer" />
      <Row label="IHT saved if you survive 7 years" value={`~${gbp(ihtSaved)}`} tone="good" strong />
      <Note>A gift to anyone other than a spouse is a disposal at market value for CGT{isResidence ? ' (your main home is sheltered by PPR while you live there)' : ' — even though no money changes hands'}. It leaves your estate after 7 years (taper from year 3). Beware “gift with reservation”: keep living in it or taking the rent and it stays in your estate for IHT.</Note>
    </>)
  }

  if (active === 'hold') {
    const ihtable = Math.max(0, value - (isResidence ? nrb : 0))
    const iht = Math.round(ihtable * ihtRate)
    askQ = `If I just hold ${asset.name || 'this property'} until death, what happens to CGT and IHT versus selling or gifting now?`
    planLabel = 'Hold to death'; planSummary = `£0 CGT (uplift); ~${gbp(iht)} IHT at 40%`
    body = (<>
      <Row label="Capital gains tax" value="£0 — base cost uplifts on death" tone="good" />
      <Row label="In your estate at" value={gbp(value)} />
      <Row label="Indicative IHT at 40%" value={`~${gbp(iht)}`} tone="bad" strong />
      <Note>Holding to death washes out the capital gain — heirs inherit at the date-of-death value. The trade-off: the whole {gbp(value)} sits in your estate at 40% above your nil-rate bands. Selling or gifting earlier crystallises CGT but can cut the IHT.</Note>
    </>)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Model a decision</div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Weigh up your options — the cash, tax and estate impact of each, before you do anything. Nothing here changes your records.
      </div>

      {/* Decision selector */}
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
        {/* Actions — the buttons DO something: open a worked conversation, or
            commit the scenario to the Plan lens. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => fireAsk(askQ, { value, mortgage, gain })} className="sw-press" style={{
            background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
            color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>⚡ Explore this with Sonu</button>
          <button type="button" onClick={() => addPlan(planLabel, planSummary, planDeltas)} className="sw-press" style={{
            background: saved === active ? 'color-mix(in srgb, var(--c-acc) 18%, transparent)' : 'var(--c-surface2)',
            border: '1px solid var(--c-border)', color: saved === active ? 'var(--c-acc)' : 'var(--c-text2)',
            borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{saved === active ? '✓ Added to your Plan' : '+ Add to plan'}</button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>{BRAND.disclaimer}</p>
    </div>
  )
}

function Note({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.45 }}>{children}</div>
}
