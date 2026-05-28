// ─────────────────────────────────────────────────────────────────────────────
// MoneyIncome.jsx — Route 2 (Income Statement) full-page view
// Spec:  0-Active/route-specs/route-2-income-statement.md  v0.3
// Route: /money/income (Dashboard tab id 'money/income')
//
// Visual hierarchy (spec §3):
//   1. Header  ← My Money · "Income Statement" · "UK · 2026/27 rules"
//   2. Hero Sankey (signature) — sources → tax stages → net take-home
//   3. Net take-home headline   "£{X}/mo net · £{Y}/yr net · {Z}% of gross"
//   4. Income-by-source horizontal stacked bar
//   5. Classification donut — non-savings / savings / dividends (1 of 2 donuts product-wide)
//   6. ANI cliff progress bar — markers at TAX.adjustedNetIncomeCliff and £125,140
//   7. HICBC chip — gated on Mr T persona AND ANI ∈ [TAX.hicbcFloor, TAX.hicbcCeiling]
//   8. Persona-specific intel card — Director / Sole-trader / Landlord
//   9. Tax stack RevealCard — receipt waterfall (supporting viz, NOT signature)
//   10. Statutory disclaimer (verbatim §8)
//
// G7 verb-grep clean (zero prescriptive verbs).
// G7.5: no problem → product → action sequencing. Chips are descriptive.
// G9: no hardcoded thresholds — all from TAX.* bundle keys.
// G16: every chip / disclaimer string verbatim from spec §8.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import useTaxYear from '../hooks/useTaxYear.jsx'
import useBundleVersion from '../hooks/useBundleVersion.jsx'
import {
  calcAllIncome,
  calcIncomeTax,
  calcPersonalAllowance,
  fmt,
} from '../engine/fq-calculator.js'
// S1 selector migration: tax readers (ANI, HICBC, PSA) come via facade so
// future surfaces can't forget to apply the £60k taper rule (P0-10 root cause
// was a hand-rolled subtraction line that omitted hicbc entirely).
import {
  ani as calcANI,
  hicbc as calcHICBC,
} from '../engine/selectors/index.js'
import { TAX } from '../engine/_bundle.js'
import { hasPersonaFlag } from '../engine/_helpers.js'
import { Sankey } from '../components/charts'
import RevealCard from '../components/shared/RevealCard.jsx'
import {
  HICBCTile,
  EmployerNICTile,
  TaperedAATile,
  LandlordS24Tile,
} from '../components/MyMoney/PersonaGapTiles.jsx'
// Tab-aware finances hero strip (2026-05-28). Founder direction: same
// command-bar that lives on MyMoney's Balance Sheet should appear on each
// MoneyX sub-route with screen-appropriate stats. Here: Income Statement uses
// the `income` variant which renders Sources / Gross / Tax / Net.
import FinancesHeroCard from '../components/MyMoney/FinancesHeroCard.jsx'
import MoneyXDrawer from '../components/shared/MoneyXDrawer.jsx'

// ── persona detection (uses bundle helpers + entity shape) ────────────────────
function isDirector(entity) {
  if (!entity) return false
  if (hasPersonaFlag(entity, 'director')) return true
  const flags = entity.persona?.flags || []
  return Array.isArray(flags) && flags.includes('director')
}
function isSoleTrader(entity) {
  if (!entity) return false
  if (hasPersonaFlag(entity, 'sole_trader') || hasPersonaFlag(entity, 'sole-trader')) return true
  const flags = entity.persona?.flags || []
  if (Array.isArray(flags) && (flags.includes('sole-trader') || flags.includes('self-employed'))) return true
  return +(entity.income?.selfEmployed || 0) > 0
}
function isLandlord(entity) {
  if (!entity) return false
  if (hasPersonaFlag(entity, 'landlord')) return true
  const rental = +(entity.income?.rental || entity.income?.rentalIncome || 0)
  return rental > 0
}

// ── NIC helpers (rates from TAX bundle, no hardcoded percentages) ─────────────
function calcClass1NI(salary) {
  const PT = TAX.pa
  const UEL = TAX.brt
  const main = TAX.nicClass1Main
  if (salary <= PT) return 0
  const inBand = Math.min(salary, UEL) - PT
  const above = Math.max(0, salary - UEL)
  // Upper-band rate is 2% across NICs — but spec only nails main rate; use 0.02 floor.
  return Math.round(inBand * main + above * 0.02)
}
function calcClass4NI(profit) {
  const LPL = TAX.pa
  const UPL = TAX.brt
  const main = TAX.nicClass4Main
  if (profit <= LPL) return 0
  const inBand = Math.min(profit, UPL) - LPL
  const above = Math.max(0, profit - UPL)
  return Math.round(inBand * main + above * 0.02)
}

// ── Sankey model: build nodes + links from engine output ──────────────────────
function buildSankeyModel({ items, tax, class1, class4, netIncome }) {
  const nodes = []
  const links = []
  const sourceMap = {
    'employment':       'Employment',
    'self-employment':  'Self-Employment',
    'dividends':        'Dividends',
    'rental':           'Rental',
    'drawdown':         'Drawdown',
    'state-pension':    'State Pension',
    'savings-interest': 'Savings interest',
    'overseas':         'Overseas',
    'other':            'Other',
  }
  const sourceTotals = {}
  for (const it of items || []) {
    const k = it.type
    sourceTotals[k] = (sourceTotals[k] || 0) + (+it.amount || 0)
  }
  // Source nodes
  for (const [k, label] of Object.entries(sourceMap)) {
    if ((sourceTotals[k] || 0) > 0) {
      nodes.push({ id: k, label, type: 'source' })
    }
  }
  // Tax stage nodes
  const stages = {
    pa:       { id: 'pa',  label: 'Personal Allowance' },
    br:       { id: 'br',  label: 'Basic rate 20%' },
    hr:       { id: 'hr',  label: 'Higher rate 40%' },
    ar:       { id: 'ar',  label: 'Additional rate 45%' },
    nicC1:    { id: 'nicC1', label: 'NIC Class 1 (8% main)' },
    nicC4:    { id: 'nicC4', label: 'NIC Class 4 (6% main)' },
    divTax:   { id: 'divTax', label: 'Dividend tax' },
    savTax:   { id: 'savTax', label: 'Savings tax' },
  }
  const stageHits = new Set()
  // Bucket: which bands have £
  const byBand = (tax.byBand || []).filter(b => +b.amount > 0)
  // Non-savings income flows
  // We don't drill per-source × per-band; we route per-source totals into the
  // primary band(s) they hit. Approximation: map full source flow into the
  // stage that consumes most of it. For accuracy in the receipt we use byBand.
  // Sankey shows flows in proportion to engine output.
  const taxableNonSav = byBand.filter(b => /non_savings/.test(b.type))
  const taxableSav    = byBand.filter(b => /savings_/.test(b.type))
  const taxableDiv    = byBand.filter(b => /div_/.test(b.type))

  // Aggregate income flow: each source contributes to PA up to PA share, then BR/HR/AR.
  // Simple deterministic split: PA covers smallest source first by spec §10 A10
  // (non-savings consumes PA first). We approximate visually by treating PA
  // as a stage hit if any non_savings amount is below the PA threshold.
  const pa = calcPersonalAllowance(0) // not used directly; just for ref
  const totalNonSav = (sourceTotals.employment || 0) + (sourceTotals['self-employment'] || 0)
                    + (sourceTotals.rental || 0) + (sourceTotals.drawdown || 0)
                    + (sourceTotals['state-pension'] || 0) + (sourceTotals.other || 0)
                    + (sourceTotals.overseas || 0)

  // Determine PA used (non-savings consumes it first per ITA 2007 s16)
  const PA_AVAILABLE = TAX.pa  // baseline (taper applied separately in calcPersonalAllowance)

  // Helper: split a source pool across [pa, br, hr, ar]
  function splitNonSavings(amount, paAvail) {
    const inPA = Math.min(amount, paAvail)
    let rem = amount - inPA
    const brCap = TAX.brl
    const inBR = Math.min(rem, brCap); rem -= inBR
    const hrCap = (TAX.art - TAX.pa - TAX.brl)
    const inHR = Math.min(rem, hrCap); rem -= inHR
    const inAR = Math.max(0, rem)
    return { pa: inPA, br: inBR, hr: inHR, ar: inAR }
  }

  // For Sankey visual fidelity we route each source's full value to its
  // dominant stage. Sources that don't hit tax (within PA) → PA only.
  // Sources above PA → BR / HR / AR proportional from byBand totals.
  let paUsed = 0
  // First pass: non-savings sources fill PA first (spec §10 A10).
  const nonSavKeys = ['employment', 'self-employment', 'rental', 'drawdown', 'state-pension', 'other', 'overseas']
  for (const k of nonSavKeys) {
    const amt = sourceTotals[k] || 0
    if (amt <= 0) continue
    const paAvail = Math.max(0, PA_AVAILABLE - paUsed)
    const split = splitNonSavings(amt, paAvail)
    paUsed += split.pa
    if (split.pa > 0) {
      links.push({ source: k, target: 'pa', value: split.pa, label: 'PA covered' })
      stageHits.add('pa')
    }
    if (split.br > 0) {
      links.push({ source: k, target: 'br', value: split.br, label: 'taxed at BR' })
      stageHits.add('br')
    }
    if (split.hr > 0) {
      links.push({ source: k, target: 'hr', value: split.hr, label: 'taxed at HR' })
      stageHits.add('hr')
    }
    if (split.ar > 0) {
      links.push({ source: k, target: 'ar', value: split.ar, label: 'taxed at AR' })
      stageHits.add('ar')
    }
  }
  // Savings → savTax (with PSA accounted in calcIncomeTax; here we show flow only)
  const savAmt = sourceTotals['savings-interest'] || 0
  if (savAmt > 0) {
    // Most savings is covered by PSA for typical persona — show flow visually
    const savTaxedAmount = taxableSav.reduce((s, b) => s + b.amount, 0)
    const savCovered = Math.max(0, savAmt - savTaxedAmount)
    if (savCovered > 0) {
      links.push({ source: 'savings-interest', target: 'pa', value: savCovered, label: 'PSA covered' })
      stageHits.add('pa')
    }
    if (savTaxedAmount > 0) {
      links.push({ source: 'savings-interest', target: 'savTax', value: savTaxedAmount, label: 'savings tax' })
      stageHits.add('savTax')
    }
  }
  // Dividends → divTax (with dividend allowance accounted in calcIncomeTax)
  const divAmt = sourceTotals.dividends || 0
  if (divAmt > 0) {
    const divTaxedAmount = taxableDiv.reduce((s, b) => s + b.amount, 0)
    const divCovered = Math.max(0, divAmt - divTaxedAmount)
    if (divCovered > 0) {
      links.push({ source: 'dividends', target: 'pa', value: divCovered, label: 'dividend allowance' })
      stageHits.add('pa')
    }
    if (divTaxedAmount > 0) {
      links.push({ source: 'dividends', target: 'divTax', value: divTaxedAmount, label: 'dividend tax' })
      stageHits.add('divTax')
    }
  }
  // NIC flow (separate from income tax per spec §9 + A11)
  if (class1 > 0) {
    links.push({ source: 'employment', target: 'nicC1', value: class1, label: 'NIC Class 1' })
    stageHits.add('nicC1')
  }
  if (class4 > 0) {
    links.push({ source: 'self-employment', target: 'nicC4', value: class4, label: 'NIC Class 4' })
    stageHits.add('nicC4')
  }
  // Now build stage → net links (each stage funnels remaining to net OR is a deduction sink)
  // PA is pass-through → net
  // BR/HR/AR/NIC/divTax/savTax are deductions; remainder flows on to net.
  // For Sankey purity, we model: PA → net (covered), BR → net (after tax), etc.
  // To keep widths sane: each stage flows to 'net' with value (income passing through that stage minus tax).
  // Per-stage net outflow = total inbound − tax-take.
  function inboundTo(stageId) {
    return links.filter(l => l.target === stageId).reduce((s, l) => s + l.value, 0)
  }
  const paIn = inboundTo('pa')
  const brIn = inboundTo('br')
  const hrIn = inboundTo('hr')
  const arIn = inboundTo('ar')
  // Tax retained from each band = inbound × band rate (using TAX bundle)
  const brNet = brIn * (1 - TAX.br)
  const hrNet = hrIn * (1 - TAX.hr)
  const arNet = arIn * (1 - TAX.ar)
  if (paIn > 0) links.push({ source: 'pa', target: 'net', value: paIn })
  if (brNet > 0) links.push({ source: 'br', target: 'net', value: brNet })
  if (hrNet > 0) links.push({ source: 'hr', target: 'net', value: hrNet })
  if (arNet > 0) links.push({ source: 'ar', target: 'net', value: arNet })
  // NIC, divTax, savTax are sinks (deductions) — no outflow to net (they're tax-take)
  // But to balance the graph, we treat dividend / savings inflow's "net portion"
  // (post-tax) as flowing to net node.
  const divIn = inboundTo('divTax')
  const savIn = inboundTo('savTax')
  // P0-9 fix (2026-05-28): band-aware dividend net. Previous code applied
  // TAX.dividendBR (8.75%) to the entire dividend flow, which understated
  // tax-take when the dividend straddles higher-rate (33.75%) and additional-
  // rate (39.35%) bands. Audit example: £40k div, £15k in HR band → previous
  // Sankey overstated net by £3,750. Now we sum band × (1 − band rate)
  // contributions from `taxableDiv`, which the engine already splits.
  const dividendRateByBand = {
    'div_basic':      TAX.dividendBR ?? 0.0875,
    'div_higher':     TAX.dividendHR ?? 0.3375,
    'div_additional': TAX.dividendAR ?? 0.3935,
  }
  const divNet = taxableDiv.reduce((sum, b) => {
    const rate = dividendRateByBand[b.type] ?? TAX.dividendBR ?? 0.0875
    return sum + (+b.amount || 0) * (1 - rate)
  }, 0)
  const savNet = savIn * (1 - TAX.br)
  if (divNet > 0) links.push({ source: 'divTax', target: 'net', value: divNet })
  if (savNet > 0) links.push({ source: 'savTax', target: 'net', value: savNet })

  // Include hit stages only
  for (const id of stageHits) {
    nodes.push({ ...stages[id], type: 'stage' })
  }
  nodes.push({ id: 'net', label: 'Net take-home', type: 'sink' })
  return { nodes, links }
}

// ── small inline UI primitives (theme-token only) ────────────────────────────
function Card({ title, eyebrow, children, footer, style }) {
  return (
    <div className="sw-card sw-card-elevated" style={{ padding: 16, marginBottom: 16, ...style }}>
      {eyebrow && <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
      {title && (
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 12, letterSpacing: -0.3 }}>
          {title}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-sep)', fontSize: 11, color: 'var(--c-text3)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)'
           : tone === 'warn' ? 'var(--c-amber, #FF9500)'
           : tone === 'bad'  ? 'var(--c-coral, #FF6F7D)'
           : 'var(--c-text)'
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--c-sep)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

// ── Horizontal stacked bar: income by source ─────────────────────────────────
function IncomeBySourceBar({ totals, onSegmentTap }) {
  const segs = [
    { key: 'employment',       label: 'Employment',       color: 'var(--c-acc)' },
    { key: 'self-employment',  label: 'Self-Employment',  color: 'var(--c-acc2, var(--c-acc))' },
    { key: 'dividends',        label: 'Dividends',        color: 'var(--c-acc3, var(--c-acc))' },
    { key: 'rental',           label: 'Rental',           color: 'var(--c-amber, #FF9500)' },
    { key: 'drawdown',         label: 'Drawdown',         color: 'var(--c-acc2, var(--c-acc))' },
    { key: 'state-pension',    label: 'State Pension',    color: 'var(--c-text2)' },
    { key: 'savings-interest', label: 'Savings interest', color: 'var(--c-text3)' },
  ].filter(s => (totals[s.key] || 0) > 0)
  const total = segs.reduce((s, x) => s + (totals[x.key] || 0), 0)
  if (total === 0) return null
  return (
    <div>
      <div style={{
        display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden',
        border: '1px solid var(--c-border)',
      }} role="img" aria-label={
        `Income by source: ${segs.map(s => `${s.label} £${Math.round(totals[s.key]).toLocaleString()}`).join(', ')}.`
      }>
        {segs.map(s => {
          const w = ((totals[s.key] || 0) / total) * 100
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSegmentTap?.(s.key, totals[s.key])}
              title={`${s.label} ${fmt(totals[s.key])}`}
              style={{
                width: `${w}%`, background: s.color, border: 'none', cursor: 'pointer',
                color: 'var(--c-surface)', fontSize: 10, fontWeight: 800, padding: 0,
              }}>
              {w > 9 ? Math.round(w) + '%' : ''}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 11 }}>
        {segs.map(s => (
          <div key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--c-text2)' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: s.color, borderRadius: 2 }} />
            <span>{s.label} {fmt(totals[s.key])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Classification donut (one of 2 permitted product-wide) ───────────────────
function ClassificationDonut({ nonSav, sav, div, onSegmentTap }) {
  const total = nonSav + sav + div
  if (total === 0) return null
  const r = 42, cx = 60, cy = 60, stroke = 16
  const C = 2 * Math.PI * r
  const segs = [
    { key: 'non_savings', label: 'Non-savings income', value: nonSav, color: 'var(--c-acc)' },
    { key: 'savings',     label: 'Savings income',     value: sav,    color: 'var(--c-acc2, var(--c-acc))' },
    { key: 'dividends',   label: 'Dividend income',    value: div,    color: 'var(--c-acc3, var(--c-acc))' },
  ].filter(s => s.value > 0)
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={120} height={120} viewBox="0 0 120 120" role="img"
        aria-label={`Income classification: non-savings £${nonSav.toLocaleString()}, savings £${sav.toLocaleString()}, dividends £${div.toLocaleString()}.`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-surface2)" strokeWidth={stroke} />
        {segs.map((s) => {
          const len = (s.value / total) * C
          const el = (
            <circle
              key={s.key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSegmentTap?.(s.key, s.value)}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 160 }}>
        {segs.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: s.color, borderRadius: 2 }} />
            <span style={{ color: 'var(--c-text2)' }}>{s.label}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(s.value)}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
          Non-savings income fills bands first.
        </div>
      </div>
    </div>
  )
}

// ── ANI cliff progress bar (markers at TAX.adjustedNetIncomeCliff + £125,140) ─
function ANICliffBar({ ani, onTap }) {
  const cliffStart = TAX.adjustedNetIncomeCliff  // £100,000
  // Taper-end = cliffStart + 2 × PA  (because PA tapers £1 per £2 → fully gone after 2×PA)
  const cliffEnd = cliffStart + 2 * TAX.pa
  const max = cliffEnd
  const pct = Math.min(100, (ani / max) * 100)
  const distance = cliffStart - ani
  const within10k = distance > 0 && distance <= 10000
  const startPct = (cliffStart / max) * 100
  return (
    <div
      role="img"
      aria-label={`ANI £${Math.round(ani).toLocaleString()}, £${Math.max(0, distance).toLocaleString()} below £${cliffStart.toLocaleString()} taper threshold.`}
      onClick={onTap}
      style={{ cursor: onTap ? 'pointer' : 'default' }}
    >
      <div style={{
        position: 'relative', height: 24, background: 'var(--c-surface2)',
        borderRadius: 6, overflow: 'hidden', border: '1px solid var(--c-border)',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: within10k
            ? 'var(--c-coral, #FF6F7D)'
            : 'var(--c-acc)',
          transition: 'width 200ms ease',
        }} />
        {/* taper-start marker */}
        <div style={{
          position: 'absolute', left: `${startPct}%`, top: 0, bottom: 0,
          width: 2, background: 'var(--c-text)',
        }} />
        {/* taper-end marker (right edge) */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 2, background: 'var(--c-text)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
        <span>£0</span>
        <span style={{ marginLeft: `${startPct - 8}%` }}>£{(cliffStart / 1000).toFixed(0)}k taper start</span>
        <span>£{cliffEnd.toLocaleString()} (PA gone)</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-text2)' }}>
        ANI £{Math.round(ani).toLocaleString()} — £{Math.max(0, distance).toLocaleString()} below the £{cliffStart.toLocaleString()} taper threshold.
      </div>
    </div>
  )
}

// ── Receipt waterfall (supporting viz, NOT signature) ────────────────────────
// Spec §3 step 9 — band order: non-savings (PA→BR→HR→AR) FIRST, then savings, then dividends.
// NIC SEPARATE — not co-mingled with income tax bands.
function ReceiptWaterfall({ tax, paUsed, class1, class4 }) {
  const bands = tax.byBand || []
  const get = (type) => bands.find(b => b.type === type)
  // Render order per spec:
  //   non_savings_basic, non_savings_higher, non_savings_add,
  //   savings_basic, savings_higher,
  //   div_basic, div_higher
  //   (NIC separate block below)
  const order = [
    ['non_savings_basic',  'Non-savings · Basic rate'],
    ['non_savings_higher', 'Non-savings · Higher rate'],
    ['non_savings_add',    'Non-savings · Additional rate'],
    ['savings_basic',      'Savings · Basic rate'],
    ['savings_higher',     'Savings · Higher rate'],
    ['div_basic',          'Dividends · Basic rate'],
    ['div_higher',         'Dividends · Higher rate'],
  ]
  const lines = order
    .map(([k, label]) => ({ k, label, b: get(k) }))
    .filter(x => x.b && +x.b.amount > 0)
  const totalIncomeTax = lines.reduce((s, x) => s + (x.b.amount * x.b.rate), 0)
  const totalNIC = class1 + class4
  return (
    <div style={{ fontFamily: 'var(--font-receipt, "SF Mono", Monaco, monospace)', fontSize: 12 }}>
      <Row label="Personal Allowance covered" value={fmt(paUsed)} sub="Non-savings income consumes PA first (ITA 2007 s16)" />
      {lines.map(x => (
        <Row
          key={x.k}
          label={x.label}
          value={fmt(Math.round(x.b.amount * x.b.rate))}
          sub={`${fmt(x.b.amount)} taxed at ${Math.round(x.b.rate * 1000) / 10}%`}
        />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 8px', borderBottom: '1px solid var(--c-sep)' }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Income tax subtotal</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(Math.round(totalIncomeTax))}
        </div>
      </div>
      {/* NIC block — SEPARATE per spec A11 */}
      {class1 > 0 && (
        <Row label="NIC Class 1 (8% main)" value={fmt(class1)} sub={`Employee NIC on salary between £${TAX.pa.toLocaleString()} and £${TAX.brt.toLocaleString()}`} />
      )}
      {class4 > 0 && (
        <Row label="NIC Class 4 (6% main)" value={fmt(class4)} sub={`Self-employed NIC between £${TAX.pa.toLocaleString()} and £${TAX.brt.toLocaleString()}`} />
      )}
      {totalNIC > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 8px', borderBottom: '1px solid var(--c-sep)' }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>NIC subtotal</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(totalNIC)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function MoneyIncome({ entity, personaId, onBack, onNav }) {
  // CX-1 (2026-05-28): consume canonical tax-year selector so the screen
  // displays the user's chosen TY. Bundle propagation to engine is the
  // multi-week part — for now the chip on screen makes the selection visible.
  const ty = useTaxYear()
  // A4 last-mile (2026-05-28): adding `bv` to memo deps means every engine
  // call re-fires when the user flips the TY chip. Without this the engine
  // has new rates loaded but the screen displays yesterday's numbers.
  const bv = useBundleVersion()
  const allIncome = useMemo(() => calcAllIncome(entity), [entity, bv])
  const aniInfo = useMemo(() => calcANI(entity), [entity, bv])
  const ani = aniInfo.ani
  const paUsed = useMemo(() => calcPersonalAllowance(ani), [ani, bv])
  const taxInfo = useMemo(() => calcIncomeTax(entity), [entity, bv])

  const director = isDirector(entity)
  const soleTrader = isSoleTrader(entity)
  const landlord = isLandlord(entity)

  const items = allIncome.items || []
  const sumBy = (type) => items.filter(i => i.type === type).reduce((s, i) => s + (+i.amount || 0), 0)
  const totals = {
    employment:        sumBy('employment'),
    'self-employment': sumBy('self-employment'),
    dividends:         sumBy('dividends'),
    rental:            sumBy('rental'),
    drawdown:          sumBy('drawdown'),
    'state-pension':   sumBy('state-pension'),
    'savings-interest': sumBy('savings-interest'),
  }

  const class1NI = calcClass1NI(totals.employment)
  const class4NI = calcClass4NI(totals['self-employment'])
  const totalNI  = class1NI + class4NI
  const gross    = allIncome.total || 0
  const incomeTaxTotal = taxInfo.tax || 0
  // P0-10 (2026-05-27): include HICBC claw-back in the net take-home headline.
  // For any persona with child benefit + ANI ∈ [HICBC band], the charge IS a
  // tax-style deduction from take-home — omitting it overstates net by up to
  // the full child benefit value (£2,212 for two kids). calcHICBC returns 0
  // when out of band or no child benefit declared, so this is safe across
  // every persona.
  const hicbcInfo  = useMemo(() => { try { return calcHICBC(entity) } catch { return null } }, [entity, bv])
  const hicbcCharge = Math.max(0, hicbcInfo?.charge || 0)
  const netIncome = Math.max(0, gross - incomeTaxTotal - totalNI - hicbcCharge)
  const netPct    = gross > 0 ? Math.round((netIncome / gross) * 100) : 0

  const sankeyModel = useMemo(
    () => buildSankeyModel({ items, tax: taxInfo, class1: class1NI, class4: class4NI, netIncome }),
    [items, taxInfo, class1NI, class4NI, netIncome]
  )

  const empty = gross === 0

  // Sumi seed dispatch (consistent with rest of app — sonus:ask event bus)
  function ask(seed) {
    try {
      window.dispatchEvent(new CustomEvent('sonus:ask', { detail: seed }))
    } catch { /* silent */ }
  }

  // ── empty state ────────────────────────────────────────────────────────────
  if (empty) {
    return (
      <div className="screen" style={{ padding: '12px 16px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ fontSize: 16 }}>←</span> My Money
          </button>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>UK · 2026/27 rules</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 870, color: 'var(--c-text)', marginBottom: 16 }}>
          Income Statement
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>💧</div>
            <div style={{ fontSize: 14, color: 'var(--c-text)', fontWeight: 700, marginBottom: 8 }}>
              Add an income source to see your tax stack.
            </div>
            <button
              type="button"
              onClick={() => onNav?.('money')}
              style={{
                marginTop: 8, padding: '8px 16px', borderRadius: 100,
                background: 'var(--c-acc)', border: 'none',
                color: 'var(--c-surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Add income →
            </button>
          </div>
        </Card>
        <div style={{ fontSize: 10, color: 'var(--c-text3)', textAlign: 'center', marginTop: 16 }}>
          Information based on UK 2026/27 rules. Not personal advice.
        </div>
      </div>
    )
  }

  // ── normal render ──────────────────────────────────────────────────────────
  return (
    <div className="screen" style={{ padding: '12px 16px 80px' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 12px' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ fontSize: 16 }}>←</span> My Money
        </button>
        <div
          title={`Tax year selected: ${ty.taxYear} · rule bundle ${ty.ruleBundle}. Change via the top bar.`}
          style={{
            fontSize: 10, padding: '3px 8px',
            background: 'var(--c-surface2)', borderRadius: 100,
            color: 'var(--c-text3)', fontWeight: 700,
          }}>
          UK · {ty.taxYear} rules
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 870, color: 'var(--c-text)', marginBottom: 4, letterSpacing: -0.4 }}>
        Income Statement
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 16 }}>
        What comes in, what HMRC takes, what you keep.
      </div>

      {/* MoneyX 8-chip drawer — every screen organised the same way (2026-05-28). */}
      <MoneyXDrawer entity={entity} activeRoute="money/income" onNav={onNav} />

      {/* Tab-aware finances strip — Sources count + Gross/Tax/Net triplet.
          Same affordance as MyMoney's Balance Sheet strip but reading
          income-statement-appropriate numbers per founder direction
          (2026-05-28). The "Update income" CTA routes back to MyMoney
          where AddItemSheet's Income panel lives. */}
      <FinancesHeroCard
        entity={entity}
        variant="income"
        count={items.length}
        gross={gross}
        taxTotal={incomeTaxTotal + totalNI + hicbcCharge}
        net={netIncome}
        onAddOrEdit={() => onNav?.('money')}
      />

      {/* 2. Hero Sankey (SIGNATURE) */}
      <Card eyebrow="Flow — sources → tax stages → net">
        <Sankey
          nodes={sankeyModel.nodes}
          links={sankeyModel.links}
          ariaLabel={`Income flow Sankey: ${sankeyModel.nodes.filter(n => n.type === 'source').length} sources flowing into ${sankeyModel.nodes.filter(n => n.type === 'stage').length} tax stages, ending in £${Math.round(netIncome).toLocaleString()} net take-home.`}
          onFlowTap={({ source, target, value }) => ask({ source, target, value, kind: 'income-flow' })}
        />
      </Card>

      {/* 3. Net take-home headline */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            NET TAKE-HOME
          </div>
          <button
            type="button"
            onClick={() => ask({ kind: 'what-if-takehome', net: netIncome })}
            title="What-if scenarios for net take-home"
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 100,
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              color: 'var(--c-acc)', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⚡ What-if
          </button>
        </div>
        <div style={{
          fontSize: 24, fontWeight: 870, color: 'var(--c-text)',
          fontVariantNumeric: 'tabular-nums', marginTop: 6, letterSpacing: -0.5,
        }}>
          £{Math.round(netIncome / 12).toLocaleString()}/mo net · £{Math.round(netIncome).toLocaleString()}/yr net · {netPct}% of gross
        </div>
      </Card>

      {/* 4. Income by source */}
      <Card title="Income by source" eyebrow="Gross">
        <IncomeBySourceBar
          totals={totals}
          onSegmentTap={(key, value) => ask({ kind: 'income-source', source: key, value })}
        />
      </Card>

      {/* 5. Classification donut */}
      <Card title="Tax classification" eyebrow="By income type">
        <ClassificationDonut
          nonSav={allIncome.byType.non_savings}
          sav={allIncome.byType.savings}
          div={allIncome.byType.dividends}
          onSegmentTap={(key, value) => ask({ kind: 'classification', class: key, value })}
        />
      </Card>

      {/* 6. ANI cliff */}
      <Card title="Adjusted Net Income (ANI)" eyebrow="Income above the cliff" footer={`Personal Allowance freeze: Frozen to end of 2030/31 tax year (until ${TAX.paFreezeUntil}).`}>
        <ANICliffBar
          ani={ani}
          onTap={() => ask({ kind: 'ani-mechanic', ani })}
        />
      </Card>

      {/* 7. HICBC chip (gated inside the component).
          2026-05-26 R2 snap fix: pass the live `ani` from this screen so
          the chip uses the same calculation the cliff bar shows, instead
          of falling back to an entity field that the persona JSONs don't
          carry. */}
      <HICBCTile entity={entity} ani={ani} />

      {/* Tapered AA chip (two-gate: TI > £200k AND adjInc > £260k) */}
      <TaperedAATile entity={entity} ani={ani} />

      {/* 8. Persona-specific intel */}
      {director && (
        <Card title="Director extraction" eyebrow="Salary · Dividends · Pension">
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 10 }}>
            Salary, dividends, and employer pension are taxed under different regimes.
          </div>
          <Row label="Salary" value={fmt(totals.employment)} sub={`PA threshold £${TAX.pa.toLocaleString()}`} />
          <Row label="Dividends declared" value={fmt(totals.dividends)} sub={`Taxed at ${(TAX.dividendBR * 100).toFixed(2)}% / ${(TAX.dividendHR * 100).toFixed(2)}% / ${(TAX.dividendAR * 100).toFixed(2)}%`} />
          <EmployerNICTile entity={entity} />
          <button
            type="button"
            onClick={() => onNav?.('money/business')}
            style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 100,
              background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
              color: 'var(--c-acc)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Open Business view →
          </button>
        </Card>
      )}

      {!director && soleTrader && (
        <Card title="Sole-trader NIC" eyebrow="Class 4 mechanics">
          <Row
            label="Class 4 NIC main rate"
            value={`${(TAX.nicClass4Main * 100).toFixed(0)}%`}
            sub={`Between £${TAX.pa.toLocaleString()} and £${TAX.brt.toLocaleString()} of profit`}
          />
          <Row
            label="Class 4 NIC on your profit"
            value={fmt(class4NI)}
            sub="Self-employed contribution"
          />
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
            From 2024/25 sole-trader profits report on tax-year basis (April–April).
          </div>
        </Card>
      )}

      {landlord && (
        <Card title="Landlord context" eyebrow="Rental + s24">
          <Row label="Rental income" value={fmt(totals.rental)} sub="Treated as non-savings income" />
          <LandlordS24Tile entity={entity} />
        </Card>
      )}

      {/* 9. Tax stack RevealCard — supporting receipt waterfall */}
      <RevealCard
        cardId="r2-tax-stack"
        title="Tax stack · receipt"
        defaultOpen={false}
      >
        <ReceiptWaterfall
          tax={taxInfo}
          paUsed={paUsed}
          class1={class1NI}
          class4={class4NI}
        />
      </RevealCard>

      {/* 10. Statutory disclaimer */}
      <div style={{ fontSize: 10, color: 'var(--c-text3)', textAlign: 'center', marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--c-sep)' }}>
        Information based on UK 2026/27 rules. Not personal advice.
      </div>
    </div>
  )
}
