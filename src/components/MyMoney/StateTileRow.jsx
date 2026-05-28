// ─────────────────────────────────────────────────────────────────────────────
// StateTileRow — 5 plain-English KPI tiles with trends + tap-to-explain drill.
// Founder direction 2026-05-15: plain English, trends, tappable, explain all.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
// S1 selector migration (Phase 2)
import { investable } from '../../engine/selectors/index.js'
import {
  fmt,
  taxEfficiencyScore, effectiveBeneficiaryRate, beneficiaryAnalysis, calcAge,
} from '../../engine/fq-calculator.js'

// ── Colour helpers ────────────────────────────────────────────────────────────
function good()   { return 'var(--c-acc)'  }
function warn()   { return 'var(--c-gold)' }
function bad()    { return 'var(--c-coral, #FF6F7D)' }
function neutral(){ return 'var(--c-text2)' }

function bandColour(band) {
  if (band === 'good')    return good()
  if (band === 'warn')    return warn()
  if (band === 'bad')     return bad()
  return neutral()
}

// ── Trend indicator ───────────────────────────────────────────────────────────
// Shows ↑ / ↓ / → based on a signed pct value. Colour-coded.
function Trend({ pct, invertGood = false }) {
  if (pct == null || !Number.isFinite(pct)) return null
  const up   = pct > 0.3
  const down = pct < -0.3
  const flat = !up && !down
  const goodUp = !invertGood
  const color = flat ? 'var(--c-text3)'
    : (up && goodUp) || (down && !goodUp) ? good()
    : warn()
  const arrow = flat ? '→' : up ? '↑' : '↓'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 4, letterSpacing: 0 }}>
      {arrow}{flat ? '' : ` ${Math.abs(pct).toFixed(1)}%`}
    </span>
  )
}

// ── Explanation overlay ───────────────────────────────────────────────────────
function ExplanationModal({ tile, onClose }) {
  if (!tile) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tile.label}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(5,20,36,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 80px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 28px',
          width: '100%', maxWidth: 480,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          animation: 'sw-fade-up 240ms var(--ease-out-cubic) both',
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--c-border)', margin: '0 auto 20px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `color-mix(in srgb, ${bandColour(tile.band)} 15%, var(--c-surface2))`,
            border: `1px solid color-mix(in srgb, ${bandColour(tile.band)} 30%, transparent)`,
            display: 'grid', placeItems: 'center',
            fontSize: 18,
          }}>{tile.icon}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.1 }}>
              {tile.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 3 }}>
              {tile.tagline}
            </div>
          </div>
        </div>

        {/* Current value */}
        <div style={{
          background: 'var(--c-surface2)', borderRadius: 12, padding: '14px 16px',
          marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 10,
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: bandColour(tile.band), letterSpacing: -0.5 }}>
            {tile.value}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.4 }}>
            {tile.sub}
          </div>
        </div>

        {/* What it means */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6,
            textTransform: 'uppercase', marginBottom: 6 }}>What this measures</div>
          <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55 }}>
            {tile.explain}
          </div>
        </div>

        {/* Why it matters */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6,
            textTransform: 'uppercase', marginBottom: 6 }}>Why it matters</div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55 }}>
            {tile.why}
          </div>
        </div>

        {/* Action */}
        {tile.action && (
          <div style={{
            background: `color-mix(in srgb, ${bandColour(tile.band)} 10%, var(--c-surface2))`,
            border: `1px solid color-mix(in srgb, ${bandColour(tile.band)} 25%, transparent)`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: bandColour(tile.band), letterSpacing: 0.6,
              textTransform: 'uppercase', marginBottom: 4 }}>To improve this</div>
            <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.5 }}>
              {tile.action}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px', borderRadius: 12,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text)', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StateTileRow({ entity }) {
  const [open, setOpen] = useState(null)

  const a    = entity.assets || {}
  const liab = entity.liabilities || {}
  const target = entity.targetIncome || 0
  const cash   = a.cash?.total || a.cash?.value || 0
  const monthlySpend = target / 12

  // Trajectory-based trend (MoM % change in NW → proxy for asset tiles)
  let nwTrendPct = null
  const traj = entity?.trajectories?.netWorthHistory
  if (Array.isArray(traj) && traj.length >= 2) {
    const last = +(traj[traj.length - 1]?.value || 0)
    const prev = +(traj[traj.length - 2]?.value || 0)
    if (prev > 0) nwTrendPct = ((last - prev) / prev) * 100
  }

  // ── Safety Net / Emergency cover ─────────────────────────────────────────
  const months = monthlySpend > 0 ? cash / monthlySpend : 0
  const safetyBand = months >= 6 ? 'good' : months >= 3 ? 'warn' : 'bad'
  const safetyTrend = nwTrendPct  // cash roughly tracks NW

  // ── Money owed / Debt ────────────────────────────────────────────────────
  const mortgage     = liab.mortgage || {}
  const otherLoans   = liab.otherLoans || []
  const monthlyDebtPay = (mortgage.monthlyPayment || 0)
    + otherLoans.reduce((s, l) => s + (l.monthlyPayment || 0), 0)
  const totalDebt = (mortgage.outstanding || 0)
    + otherLoans.reduce((s, l) => s + (l.outstanding || l.outstanding_balance || 0), 0)
  const debtYears = monthlyDebtPay > 0 ? totalDebt / (monthlyDebtPay * 12) : 0
  const debtBand  = totalDebt === 0 ? 'good' : debtYears < 5 ? 'good' : debtYears < 15 ? 'warn' : 'bad'
  // Debt goes down = good (invert: positive trend = debt reducing = good)
  const debtTrendPct = nwTrendPct != null ? -nwTrendPct : null  // as NW rises, debt ratio falls

  // ── Retirement funded / FI Ratio ─────────────────────────────────────────
  const inv      = investable(entity)
  const fiTarget = target * 25
  const fiRat    = fiTarget > 0 ? inv / fiTarget : 0
  const fiBand   = fiRat >= 1 ? 'good' : fiRat >= 0.3 ? 'warn' : 'bad'
  const fiTrendPct = nwTrendPct  // investable tracks with NW

  // Project pension pot to retirement age using 5% real growth; compute shortfall
  const dob = entity?.individual?.dob || entity?.personal?.dob
  const currentAge = dob ? calcAge(dob) : 47         // default to 47 if no DOB
  const retirementAge = 67
  const yearsToRetire = Math.max(0, retirementAge - currentAge)
  const projectedPot  = inv * Math.pow(1.05, yearsToRetire)
  const shortfall     = Math.max(0, fiTarget - projectedPot)
  const annualContribNeeded = shortfall > 0 && yearsToRetire > 0
    ? shortfall / (((Math.pow(1.05, yearsToRetire) - 1) / 0.05))  // FV annuity formula
    : 0

  // ── Estate efficiency / Beneficiaries ────────────────────────────────────
  let benData = { beneficiaries: [], effectiveRate: 0 }
  try { benData = beneficiaryAnalysis(entity) || benData } catch { /* silent */ }
  const benList = entity.beneficiaries || benData.beneficiaries || []
  let ebr = { rate: 1, ihtDue: 0 }
  try { ebr = effectiveBeneficiaryRate(entity) || ebr } catch { /* silent */ }
  const benBand = ebr.rate >= 0.8 ? 'good' : ebr.rate >= 0.5 ? 'warn' : 'bad'

  // ── In tax shelters / Tax Efficiency ─────────────────────────────────────
  let tax = { total: 0, breakdown: { isa: 0, aa: 0 } }
  try { tax = taxEfficiencyScore(entity) || tax } catch { /* silent */ }
  const taxBand = tax.total >= 80 ? 'good' : tax.total >= 40 ? 'warn' : 'bad'

  const tiles = [
    {
      id:      'safety',
      icon:    '🛡',
      label:   'Emergency cover',
      tagline: 'How many months your cash covers if income stops',
      value:   monthlySpend > 0 ? `${months.toFixed(1)} mo` : '—',
      sub:     `${fmt(cash)} in cash accounts`,
      band:    safetyBand,
      trend:   safetyTrend,
      invertTrend: false,
      explain: `You have ${fmt(cash)} in cash. At your current spending level, that covers approximately ${months.toFixed(1)} months if your income stopped tomorrow.`,
      why:     `Most financial advisers recommend 3–6 months of essential spending in easy-access cash. It's the difference between a job loss being a nuisance and a financial crisis.`,
      action:  months < 3
        ? `Build to ${fmt(monthlySpend * 3)} (3 months of essentials). Use a Cash ISA or easy-access savings account — any interest above £500 is taxed so shelter it first.`
        : months >= 6
        ? `You're well covered. Extra cash above 6 months is sitting idle — consider moving it to an ISA or SIPP where it works harder.`
        : `You're within range. Aim for one more month of cash as a buffer — ${fmt(monthlySpend)} would do it.`,
    },
    {
      id:      'debt',
      icon:    '⚖',
      label:   'Money owed',
      tagline: 'Total debt and how long until it\'s cleared',
      value:   totalDebt === 0 ? 'Clear' : fmt(totalDebt),
      sub:     totalDebt === 0
        ? 'No liabilities on record'
        : monthlyDebtPay > 0
          ? `Clears in ${debtYears.toFixed(0)} yr at current payments`
          : 'No payment schedule set',
      band:    debtBand,
      trend:   debtTrendPct,
      invertTrend: true,
      explain: totalDebt === 0
        ? `You have no recorded liabilities. If you have any mortgages or loans, add them so your net worth and estate calculations are accurate.`
        : `You owe ${fmt(totalDebt)} across all loans and mortgages. ${monthlyDebtPay > 0 ? `At your current repayment rate of ${fmt(monthlyDebtPay)}/month, this clears in ${debtYears.toFixed(1)} years.` : 'No repayment schedule is set yet.'}`,
      why:     `Debt is the opposite of wealth. High debt relative to assets compresses your net worth, limits what you can invest, and can create an estate that passes problems to your family. Not all debt is bad — a mortgage on an appreciating property can be rational — but it all needs to be tracked.`,
      action:  totalDebt === 0
        ? null
        : debtYears > 20
          ? `Your debt horizon is long. Overpaying the mortgage by even £100/month can shave years off the term and save thousands in interest. Check your lender's ERC-free overpayment allowance (typically 10% per year).`
          : `You're on track. Focus surplus cash on pensions and ISAs before paying down the mortgage faster — the tax relief on pension contributions usually wins.`,
    },
    {
      id:      'fi',
      icon:    '🎯',
      label:   'Retirement funded',
      tagline: 'How much of your retirement target you\'ve saved so far',
      value:   fiTarget > 0 ? `${Math.round(fiRat * 100)}%` : '—',
      sub:     fiTarget > 0
        ? shortfall > 0
          ? `Shortfall at ${retirementAge}: ${fmt(shortfall)} · add ${fmt(Math.round(annualContribNeeded / 100) * 100)}/yr`
          : `On track — projected pot: ${fmt(projectedPot)}`
        : 'Set a target annual income to calculate',
      band:    fiBand,
      trend:   fiTrendPct,
      invertTrend: false,
      explain: `The 25× rule: your target annual retirement income multiplied by 25 gives the pot you need. At a 4% safe withdrawal rate it lasts indefinitely. You've saved ${fmt(inv)} (${Math.round(fiRat * 100)}% of the ${fmt(fiTarget)} target). At 5% real growth your pot reaches ${fmt(Math.round(projectedPot / 1000) * 1000)} by age ${retirementAge}${shortfall > 0 ? ` — still ${fmt(shortfall)} short` : ' — on track'}.`,
      why:     `This is the single most important long-term metric. People underestimate how much they need because they think in terms of what they earn, not what they spend. The rule-of-25 is deliberately conservative — it survives most 30-year retirement windows even in poor-sequence-of-returns scenarios.`,
      // Tax+FCA / IFA audit 2026-05-26: "focus on maximising" and "highest-
      // return action available to you" crossed COBS 9A. Reframed as
      // descriptive mechanics — what tax relief does + how the cap works.
      action:  fiRat < 0.3
        ? `Pension contributions attract tax relief at marginal income tax rate. At 40% higher-rate, a £1 gross contribution has a net cost of 60p; at 45% additional rate, 55p; at 20% basic rate, 80p (up to 48% in Scotland for 2026/27).`
        : fiRat < 1
          ? `Pension AA is £60,000 this tax year, plus unused carry-forward from the past 3 years. ISA AA is £20,000 with no carry-forward. Both reset 6 April.`
          : `Beyond accumulation, decumulation involves withdrawal sequencing across pots, IHT planning, and beneficiary nominations — each governed by different rules.`,
    },
    {
      id:      'estate',
      icon:    '🏛',
      label:   'Estate efficiency',
      tagline: 'How much of your estate reaches family vs HMRC',
      value:   `${Math.round(ebr.rate * 100)}p/£`,
      sub:     benList.length > 0
        ? `${benList.length} named · ${ebr.ihtDue > 0 ? fmt(ebr.ihtDue) + ' IHT due' : 'No IHT due'}`
        : ebr.ihtDue > 0
          ? `${fmt(ebr.ihtDue)} IHT due — no beneficiaries set`
          : 'No beneficiaries set',
      band:    benBand,
      trend:   null,
      invertTrend: false,
      explain: `For every £1 in your estate, ${Math.round(ebr.rate * 100)}p reaches your family after inheritance tax. If your estate is above the nil-rate band (£325k, or £500k if your home passes to children), the remainder is taxed at 40%.`,
      why:     `HMRC is the default beneficiary of any estate that hasn't been planned. Spouses, ISAs, pensions (not in the estate pre-75), BPR-qualifying assets, and gifts-out-of-income can each reduce what the taxman takes — but they need to be set up deliberately.`,
      action:  ebr.ihtDue > 0
        ? `You have an estimated ${fmt(ebr.ihtDue)} IHT liability. Priority: (1) nominate your pension to bypass estate, (2) make sure any life cover is in trust, (3) consider annual gifts up to £3k — all free of IHT.`
        : benList.length === 0
          ? `You don't have beneficiaries set. Even if there's no tax due now, set nominations on every pension and insurance policy so they bypass probate.`
          : `Your estate looks broadly clean. Review nominations annually and after any life change (marriage, divorce, new child).`,
    },
    {
      id:      'tax',
      icon:    '📊',
      label:   'In tax shelters',
      tagline: 'How much of your allowances you\'re actually using',
      value:   `${tax.total}%`,
      sub:     `ISA ${tax.breakdown.isa}% used · Pension ${tax.breakdown.aa}% used`,
      band:    taxBand,
      trend:   null,
      invertTrend: false,
      explain: `${tax.total}% of your available tax-sheltering capacity is being used. This covers your ISA allowance (£20k/yr), pension annual allowance (£60k/yr), and other reliefs. The higher this number, the more of your wealth is growing tax-free.`,
      why:     `Every pound outside a tax shelter pays up to 45% income tax, 28% CGT, or 40% IHT unnecessarily. The ISA and pension allowances reset every April — any unused allowance is gone forever. Most people use less than 20% of what's available to them.`,
      action:  tax.total < 40
        ? `You have significant unused capacity. Priority: max your ISA (£${Math.round((20000 - (20000 * tax.breakdown.isa / 100)) / 1000)}k remaining) then pension (up to £60k/yr with tax relief at your marginal rate).`
        : tax.total < 80
          ? `You're using some capacity. Check if you have carry-forward pension allowance from the past 3 years — this can unlock more than the standard £60k.`
          : `You're highly optimised. Focus shifts to estate planning and extracting value from existing shelters efficiently.`,
    },
  ]

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 6,
        marginBottom: 12,
      }}>
        {tiles.map(t => {
          const colour = bandColour(t.band)
          return (
            <button
              key={t.id}
              onClick={() => setOpen(t)}
              style={{
                background: 'var(--c-surface)',
                border: `1px solid color-mix(in srgb, ${colour} 25%, var(--c-border))`,
                borderRadius: 12, padding: '10px 8px',
                textAlign: 'left', cursor: 'pointer',
                minWidth: 0, width: '100%',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = `0 4px 16px color-mix(in srgb, ${colour} 15%, transparent)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              {/* Label row */}
              <div style={{
                fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                textTransform: 'uppercase', letterSpacing: 0.6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 4,
              }}>
                {t.label}
              </div>

              {/* Value + trend */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 'var(--fs-title, 16px)', fontWeight: 800,
                  color: colour, lineHeight: 1.1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {t.value}
                </span>
                <Trend pct={t.trend} invertGood={t.invertTrend} />
              </div>

              {/* Sub-line */}
              <div style={{
                fontSize: 9, color: 'var(--c-text3)', marginTop: 3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.sub}
              </div>

              {/* Tap hint */}
              <div style={{
                fontSize: 8, color: colour, marginTop: 5,
                fontWeight: 700, opacity: 0.7, letterSpacing: 0.3,
              }}>
                Tap to explain →
              </div>
            </button>
          )
        })}
      </div>

      <ExplanationModal tile={open} onClose={() => setOpen(null)} />
    </>
  )
}
