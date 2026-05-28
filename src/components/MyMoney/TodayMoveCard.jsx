// ─────────────────────────────────────────────────────────────────────────────
// TodayMoveCard — single highest-impact action surfaced from entity state.
//
// Founder direction 2026-05-12: MyMoney was a balance sheet — informative but
// passive. The tab needs to surface ACTION. This card answers "what should I
// do this week?" with a ranked recommendation derived from open allowances,
// upcoming deadlines, and quantifiable gaps.
//
// Heuristic ranking — picks the move with highest £ impact among:
//   1. Pension AA headroom × marginal rate × days-to-deadline weight
//   2. ISA allowance unused × tax-free growth value (10yr horizon @ 7%)
//   3. Trust annual exemption (gift £3k tax-free outside estate)
//   4. CGT AEA unused (need GIA gains to compute realisation cost)
//   5. DLA outstanding (S455 risk)
//   6. Protection gap (months-of-cover < 3)
//
// This is a lightweight heuristic. A canonical `costOfInaction(entity, domain,
// bundle)` engine exists per 2-Product-mymoney-v2_7.md §0.1 — when wired up,
// this component swaps to consume it. For now, hand-coded ranker.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { monthlyEssentials as getMonthlyEssentials } from '../../engine/selectors/index.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

// Days until the next 5 April (UK tax year end). Returns 0–365.
function daysToTaxYearEnd(now = new Date()) {
  const year = now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() > 5)
    ? now.getFullYear() + 1
    : now.getFullYear()
  const taxEnd = new Date(year, 3, 5) // April is month 3
  return Math.max(0, Math.round((taxEnd - now) / (1000 * 60 * 60 * 24)))
}

function generateCandidates(entity) {
  const moves = []
  const marginal = +entity?.income?.marginal_rate || 0.40
  const days = daysToTaxYearEnd()

  // ── Pension AA headroom ────────────────────────────────────────────────
  const aaUsedPct = +entity?.income?.allowance_use?.pension_aa || 0
  const aaCap = 60_000
  const aaHeadroom = Math.max(0, (1 - aaUsedPct) * aaCap)
  if (aaHeadroom > 5_000) {
    const reliefValue = Math.round(aaHeadroom * marginal)
    moves.push({
      id: 'top-up-pension',
      eyebrow: 'High-leverage tax move',
      title: `Top up your pension by ${fmt(aaHeadroom)}`,
      sub: `You'd get ${fmt(reliefValue)} back in tax relief at your ${Math.round(marginal * 100)}% rate. Carry-forward unlocks the unused allowance from prior years.`,
      costOfInaction: `Walk away and ${fmt(reliefValue)} of relief is gone forever in ${days} days.`,
      value: reliefValue,
      deadline: `Tax year ends in ${days} days`,
      cta: 'Plan top-up',
      ctaTarget: 'pensions',
    })
  }

  // ── ISA allowance ──────────────────────────────────────────────────────
  const isaUsedYTD = (entity?.assets?.investments || [])
    .filter(inv => (inv.type || '').toLowerCase().includes('isa'))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
  const isaRemaining = Math.max(0, 20_000 - isaUsedYTD)
  if (isaRemaining > 1_000) {
    // 10-yr tax-free growth at 7% real vs. taxed GIA at marginal 24% CGT
    const giaGrowth = isaRemaining * (Math.pow(1.07, 10) - 1)
    const cgtCost = Math.max(0, giaGrowth - 3000) * 0.24
    const shieldValue = Math.round(cgtCost)
    moves.push({
      id: 'top-up-isa',
      eyebrow: 'Tax-free wrapper',
      title: `Use ${fmt(isaRemaining)} of ISA room`,
      sub: `Growth in an ISA is tax-free for life — you avoid CGT, dividend tax, and savings tax on everything inside.`,
      costOfInaction: `If this £${Math.round(isaRemaining / 1000)}k sits in a GIA instead, ~${fmt(shieldValue)} of CGT becomes payable over 10 years.`,
      value: shieldValue,
      deadline: `Tax year ends in ${days} days · allowance doesn't carry over`,
      cta: 'Plan ISA',
      ctaTarget: 'investments',
    })
  }

  // ── Annual gift exemption (£3k for IHT-free PETs)
  const giftsUsed = +entity?.assets?.trustGifts?.total || 0
  if (giftsUsed < 3000) {
    const giftRoom = 3000 - giftsUsed
    moves.push({
      id: 'annual-gift',
      eyebrow: 'Estate planning',
      title: `${fmt(giftRoom)} of IHT-free gifting available`,
      sub: `The annual exemption gifts immediately leave your estate — no 7-year clock, no PET. Use it or lose it.`,
      costOfInaction: `At 40% IHT, ${fmt(giftRoom)} sitting in your estate costs heirs ${fmt(Math.round(giftRoom * 0.4))}.`,
      value: Math.round(giftRoom * 0.4),
      deadline: `Resets ${days} days from now`,
      cta: 'Record gift',
      ctaTarget: 'estate',
    })
  }

  // ── DLA outstanding loan (S455 risk)
  const dla = entity?.directors_loan
  if (dla && !dla.in_credit && +dla.balance > 0) {
    const s455 = +dla.balance * 0.3375
    moves.push({
      id: 'repay-dla',
      eyebrow: 'Company year-end',
      title: `Repay director's loan ${fmt(dla.balance)}`,
      sub: `Outstanding at 9 months after year-end and the company is charged 33.75% S455 tax. Refundable when repaid, but parks cash with HMRC.`,
      costOfInaction: `S455 exposure: ${fmt(s455)} of company cash tied up if not cleared.`,
      value: Math.round(s455),
      deadline: `Watch company year-end date`,
      cta: 'View DLA',
      ctaTarget: 'business',
    })
  }

  // ── Protection gap
  const ipBenefit = +entity?.assets?.protection?.incomeProtection?.monthlyBenefit || 0
  const grossAnnual = +entity?.income?.gross_annual
    || (+entity?.income?.employment || 0)
    + (+entity?.income?.directorSalary || 0)
    + (+entity?.income?.directorDividends || 0)
    + (+entity?.income?.selfEmploymentNet || 0)
    + (+entity?.income?.rentalIncomeNet || 0)
  // BLOCK-1: canonical lookup includes entity.monthlyExpenditure (persona-a..g)
  const monthlyEss = getMonthlyEssentials(entity).monthly
    || (grossAnnual * 0.55) / 12
  if (monthlyEss > 0 && ipBenefit < monthlyEss * 0.6) {
    const gapMonthly = monthlyEss - ipBenefit
    moves.push({
      id: 'close-protection-gap',
      eyebrow: 'Resilience',
      title: `Income protection gap of ${fmt(gapMonthly)}/mo`,
      sub: `Your current cover replaces less than 60% of essential outgoings. The standard adviser benchmark is 50–65% of gross salary.`,
      costOfInaction: `If you can't work for 12 months, the family covers ${fmt(gapMonthly * 12)} from savings.`,
      value: Math.round(gapMonthly * 12),
      deadline: null,
      cta: 'Review cover',
      ctaTarget: 'protection',
    })
  }

  return moves
}

export default function TodayMoveCard({ entity, onTakeAction }) {
  const candidates = generateCandidates(entity)
  if (candidates.length === 0) return null

  // Pick highest-value
  candidates.sort((a, b) => (b.value || 0) - (a.value || 0))
  const top = candidates[0]
  const others = candidates.slice(1)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="sw-card sw-cinema sw-pressable" style={{
      padding: 16,
      background: `linear-gradient(135deg,
        color-mix(in srgb, var(--c-acc) 18%, var(--card-bg2)),
        color-mix(in srgb, var(--c-acc) 4%, var(--card-bg2)))`,
      border: '1px solid color-mix(in srgb, var(--c-acc) 38%, transparent)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2), 0 0 24px color-mix(in srgb, var(--c-acc) 24%, transparent)',
      marginBottom: 12,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top row — eyebrow + value chip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 10, fontWeight: 800, color: 'var(--c-acc)',
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--c-acc)', color: 'var(--c-bg)',
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 800,
          }}>✦</span>
          <span>Today's move</span>
          <span style={{ color: 'var(--c-text3)', fontWeight: 700 }}>·</span>
          <span style={{ color: 'var(--c-text2)', textTransform: 'none', letterSpacing: 0.2 }}>
            {top.eyebrow}
          </span>
        </div>
        {top.value > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 4,
            padding: '4px 10px', borderRadius: 100,
            background: 'color-mix(in srgb, var(--c-acc) 14%, transparent)',
            border: '1px solid color-mix(in srgb, var(--c-acc) 32%, transparent)',
            fontSize: 11, fontWeight: 800, color: 'var(--c-acc)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--c-text3)' }}>Worth</span>
            <span>{fmt(top.value)}</span>
          </div>
        )}
      </div>

      {/* Headline */}
      <div style={{
        fontSize: 'clamp(18px, 2.6vw, 22px)',
        fontWeight: 820, color: 'var(--c-text)',
        lineHeight: 1.15, marginBottom: 6, letterSpacing: -0.2,
      }}>
        {top.title}
      </div>

      {/* Body */}
      <div style={{
        fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
        marginBottom: 8,
      }}>
        {top.sub}
      </div>

      {/* Cost of inaction — emphasised */}
      <div style={{
        fontSize: 12, color: 'var(--c-text)', lineHeight: 1.5,
        marginBottom: 12, fontWeight: 600,
        paddingLeft: 10, borderLeft: '2px solid color-mix(in srgb, var(--c-coral, #FF6F7D) 50%, transparent)',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)',
          letterSpacing: 0.6, textTransform: 'uppercase', display: 'block', marginBottom: 2,
        }}>Cost of waiting</span>
        {top.costOfInaction}
      </div>

      {/* Footer — deadline + CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        {top.deadline && (
          <div style={{
            fontSize: 11, color: 'var(--c-text3)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10 }}>⏱</span>
            {top.deadline}
          </div>
        )}
        <button onClick={() => onTakeAction?.(top.ctaTarget, top.id)}
          className="sw-press"
          style={{
            padding: '7px 16px', borderRadius: 100,
            background: 'var(--c-acc)', color: 'var(--c-bg)',
            border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
            boxShadow: '0 0 18px color-mix(in srgb, var(--c-acc) 35%, transparent)',
          }}>
          {top.cta} →
        </button>
      </div>

      {/* Expandable "+ N other open moves" — collapsed by default. Click
          toggles a compact list of secondary candidates, each with their own
          headline + cost-of-waiting + jump CTA. */}
      {others.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-controls="todays-other-moves"
            className="sw-press"
            style={{
              marginTop: 10, paddingTop: 10, paddingBottom: 4,
              borderTop: '1px solid var(--c-sep)',
              background: 'transparent', border: 0, borderRadius: 0,
              width: '100%', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--c-text3)',
              letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 700,
            }}
          >
            <span>
              {expanded ? 'Hide' : '+'} {others.length} other open move{others.length > 1 ? 's' : ''}
            </span>
            <span style={{
              fontSize: 14, lineHeight: 1,
              transition: 'transform .25s cubic-bezier(.4,.0,.2,1)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>›</span>
          </button>
          {expanded && (
            <div
              id="todays-other-moves"
              style={{
                marginTop: 10,
                display: 'flex', flexDirection: 'column', gap: 8,
                animation: 'sw-fade-in 220ms ease-out',
              }}
            >
              {others.map(m => (
                <div key={m.id} style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: 'color-mix(in srgb, var(--c-bg) 60%, var(--c-surface))',
                  border: '1px solid var(--c-sep)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)',
                      marginBottom: 2, lineHeight: 1.3 }}>{m.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>
                      {m.costOfInaction}
                    </div>
                  </div>
                  {m.value > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-acc)',
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmt(m.value)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onTakeAction?.(m.ctaTarget, m.id)}
                    aria-label={m.cta}
                    className="sw-press"
                    style={{
                      padding: '5px 10px', borderRadius: 8,
                      border: '1px solid var(--c-border)',
                      background: 'var(--c-surface2)',
                      color: 'var(--c-text)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >{m.cta} →</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
