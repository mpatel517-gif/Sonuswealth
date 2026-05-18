// ─────────────────────────────────────────────────────────────────────────────
// MyMoney.jsx — full spec compliance rewrite (10 May 2026)
// Spec: 2-Product/2-Product-mymoney-v2_7.md
// ─────────────────────────────────────────────────────────────────────────────
//   · D-WRAPPER-FIRST-1  → every asset/liability stamped with wrapper badge
//   · 19 of 19 domains   → A B C D E F G H I J K L M N O U V W X (NRI gated)
//   · 5-method drawdown  → Bengen / Guyton-Klinger / Bucket / Floor-Upside / CoI
//   · X28 top-bar        → 7 windows, 4 view modes (Actual / Forecast / Plan /
//                          Scenario); variance overlay when mode≠Actual
//   · X29 diff layer     → DiffBadge / DeltaChip / CausalityStripe everywhere
//   · Triple anchor      → NW + Wealth Score + Risk Score, each with delta chip
//   · SurplusTile        → engine.monthlySurplus
//   · Director gate      → hasPersonaFlag(entity,'director') wraps Domain X
//   · NRI gate           → hasPersonaFlag(entity,'nri') wraps Indian assets
//   · Banded income      → non_savings → savings → dividends ordering
//   · ExplainerChips     → MM-1 (Net Worth), MM-2 (Wrappers)
//   · ANI 6-step display, salary sacrifice optimiser, allowance tracker,
//     drawdown matrix, wrapper composition bar, plan staleness banner.
//   · Wired UniversalAddButton → OverlayShell sheet → ASSET_VALUE_UPDATED event
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import {
  // formatting + identity
  fmt, netWorth, netWorthAtWindow, investable, guardrail,
  // CoI + IHT
  ihtDynamic, ihtSippDelta, costOfInaction, totalCoI, coiCashflowVariants,
  coiForDomain,
  // Triple-anchor scores
  calcFQ, calcRisk, fqBand, riskBand,
  // Pension drilldown
  sippProjection, sippProjectionSeries, nominationStatus,
  drawdownEfficiencyRatio, prcPccSpread,
  // Wrapper / persona / surplus / liquidity
  getWrapper, hasPersonaFlag, monthlySurplus, liquidityBuffer,
  // 5-method drawdown
  bengenProjection, guytonKlingerPath, bucketAllocation,
  floorUpsideSplit, swrFromRegime, drawdownMatrix,
  // Tax
  calcANI, calcPersonalAllowance, calcDividendTax, calcHICBC, calcPSA,
  calcAllIncome, classifyIncomeType, allowanceTracker, calcMarriageAllowance,
  // Plan / temporal
  planFor, planStaleness, varianceFor,
  // Priority cards + decumulation
  calcAge, taxEfficiencyScore, effectiveBeneficiaryRate,
  // Tax constants
  TAX,
} from '../engine/fq-calculator.js'

import { BRAND } from '../config/brand.js'
import {
  X28TopBar, TIME_WINDOWS,
  TripleAnchor, OverlayShell, RevealCard,
  DiffBadge, DeltaChip, CausalityStripe,
  ExplainerChip, PlanStalenessBanner, ProvenanceChip, Num,
  FadeInOnMount, RevealStagger, DrawSVG,
} from '../components/shared/index.js'
// StateTileRow replaced by PriorityCards (Phase 2C) — import removed (C-01)
import UniversalAddButton from '../components/MyMoney/UniversalAddButton.jsx'
// Phase 2 follow-up — balance-sheet view + 10 grouped categories per
// MyMoney v2.7 §3.4 + taxonomy-driven add flow.
import BalanceSheet       from '../components/MyMoney/BalanceSheet.jsx'
import CategoryCard       from '../components/MyMoney/CategoryCard.jsx'
import AddItemSheet       from '../components/MyMoney/AddItemSheet.jsx'
import TileGrid           from '../components/MyMoney/TileGrid.jsx'
import TodayMoveCard      from '../components/MyMoney/TodayMoveCard.jsx'
import TaxTreatmentBlock  from '../components/MyMoney/TaxTreatmentBlock.jsx'
import DrillContextStub, { SchemeQualityStub } from '../components/MyMoney/DrillContextStub.jsx'
// Pivot views (item 7) — Balance Sheet (default) / Income / Insurance / Bonds.
// Each pivot is a different aggregation of the SAME entity. Founder direction
// 2026-05-12: "tree across all domains · Not only IS/BS/Insurance/Bonds —
// everything was specced."
import PivotView, { PivotToggle } from '../components/MyMoney/PivotView.jsx'
// Per-category drill-down panels — taxonomy-driven detail per
// 3-Engine-mm-asset-taxonomy-v1_0.md (Domain C/D/E/F · G · H/I · J/K/L · N).
import InvestmentsDrillDown from '../components/MyMoney/InvestmentsDrillDown.jsx'
import PropertyDrillDown    from '../components/MyMoney/PropertyDrillDown.jsx'
import BusinessDrillDown    from '../components/MyMoney/BusinessDrillDown.jsx'
import ProtectionDrillDown  from '../components/MyMoney/ProtectionDrillDown.jsx'
import LiabilitiesDrillDown from '../components/MyMoney/LiabilitiesDrillDown.jsx'
import WhatIfLibrary        from '../components/MyMoney/WhatIfLibrary.jsx'
import { EV } from '../state/events.jsx'

// ═════════════════════════════════════════════════════════════════════════════
// §1 WRAPPER BADGE (D-WRAPPER-FIRST-1)
// ═════════════════════════════════════════════════════════════════════════════

// Semantic chip-class mapping per spec §2.1.
//   PENSION / SIPP / SSAS / workplace DC → Amber (--c-gold) — C-05 fix
//   ISA / CASH                            → Mint
//   GIA                                   → Neutral text — C-04 fix
//                                           (base .sw-chip already renders
//                                           as --c-text2 so no class needed)
//   EIS / SEIS / VCT / TRUST              → Violet
//   BOND_ON / BOND_OFF                    → Amber
//   PROPERTY                              → Orange (estate dimension) — C-06
//                                           handled via inline override below;
//                                           no orange class in design tokens.
//   STATE                                 → Neutral text
//   UNKNOWN                               → warn / dashed (handled in render)
const WRAPPER_CHIP_CLASS = {
  PENSION:  'sw-chip-amber',
  STATE:    '',                  // neutral — base chip styling
  ISA:      'sw-chip-mint',
  CASH:     'sw-chip-mint',
  GIA:      '',                  // neutral — base chip styling per spec §2.1
  EIS:      'sw-chip-violet',
  SEIS:     'sw-chip-violet',
  VCT:      'sw-chip-violet',
  TRUST:    'sw-chip-violet',
  BOND_ON:  'sw-chip-amber',
  BOND_OFF: 'sw-chip-amber',
  PROPERTY: 'sw-chip-amber',     // base class — orange tone applied inline
  UNKNOWN:  'sw-chip-warn',
}

// PROPERTY needs orange-not-amber per spec §2.1. No orange chip class in the
// design system; apply via inline override so the chip + composition-bar
// segment both render in the same palette tone.
const WRAPPER_INLINE_OVERRIDE = {
  PROPERTY: { background: 'color-mix(in srgb, #FF9F0A 18%, transparent)', color: '#FF9F0A' },
}

// Retain explicit foreground hex for the composition bar (needs solid fills,
// not transparent tints). Chip text colours come from design-tokens.css now.
const WRAPPER_PALETTE = {
  PENSION:  { fg: '#7AA7FF' },
  ISA:      { fg: '#2DF2C3' },
  GIA:      { fg: '#C58CFF' },
  BOND_ON:  { fg: '#FFB347' },
  BOND_OFF: { fg: '#FF9500' },
  EIS:      { fg: '#FF598C' },
  SEIS:     { fg: '#FF6B6B' },
  VCT:      { fg: '#E77BFF' },
  TRUST:    { fg: '#BDA5FF' },
  CASH:     { fg: '#34C759' },
  PROPERTY: { fg: '#FF9F0A' },
  STATE:    { fg: '#8FA8C8' },
  UNKNOWN:  { fg: '#9CA3AF' },
}

// Lay-readable wrapper labels per spec §2.1. C-07/C-08 fix: the underscore
// `BOND_ON` / `BOND_OFF` strings read as switch states. Spec uses middle-dot
// `BOND·ON` for IDs and "Onshore bond" / "Offshore bond" as the visible
// English label. We render the English label by default; pass a custom
// `label` to override (e.g. composition bar shows "Onshore bond · £20k").
const WRAPPER_LABEL = {
  PENSION:  'Pension',
  ISA:      'ISA',
  GIA:      'GIA',
  CASH:     'Cash',
  PROPERTY: 'Property',
  EIS:      'EIS',
  SEIS:     'SEIS',
  VCT:      'VCT',
  TRUST:    'Trust',
  BOND_ON:  'Onshore bond',
  BOND_OFF: 'Offshore bond',
  STATE:    'State',
  UNKNOWN:  'WRAPPER?',
}

function WrapperBadge({ wrapper, label, size = 'sm', onClick }) {
  const chipClass = WRAPPER_CHIP_CLASS[wrapper] ?? 'sw-chip-violet'
  const sizeClass = size === 'lg' ? '' : 'sw-chip-sm'
  // Spec §2.1 D-WRAPPER-FIRST-1: unknown wrapper → grey "WRAPPER?" badge with
  // dashed border + click-to-prompt for missing wrapper info (FP-4 path).
  const unknown = wrapper === 'UNKNOWN'
  // L-02 fix: prefer lay-readable English label over the raw enum.
  const displayLabel = label != null ? label : (WRAPPER_LABEL[wrapper] || wrapper)
  const inlineOverride = WRAPPER_INLINE_OVERRIDE[wrapper]
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={['sw-chip', chipClass, sizeClass].filter(Boolean).join(' ')}
      style={{
        fontWeight: 700, letterSpacing: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        ...(inlineOverride || null),
        ...(unknown ? {
          border: '1px dashed currentColor',
          background: 'transparent',
          color: 'var(--c-text2)',
        } : null),
      }}
      title={unknown ? 'We need more information to calculate tax treatment. Tap to add wrapper details.' : undefined}
    >
      {displayLabel}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §2 SHARED PRIMITIVES (small helpers used across domain cards)
// ═════════════════════════════════════════════════════════════════════════════

function SectionTitle({ children, accessory }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
      margin: 'var(--space-lg) 0 var(--space-sm)',
    }}>
      <span className="sw-eyebrow" style={{ flex: 1 }}>{children}</span>
      {accessory}
    </div>
  )
}

// Section-delimiter card — visual separator between Sections A / B / C.
function SectionDelimiter({ eyebrow, title, sub }) {
  return (
    <FadeInOnMount
      className="sw-card sw-card-elevated"
      style={{
        marginTop: 'var(--space-3xl)',
        marginBottom: 'var(--space-md)',
        padding: 'var(--space-md) var(--space-lg)',
        background: 'linear-gradient(180deg, var(--c-surface) 0%, var(--c-surface2) 100%)',
      }}
    >
      <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>
      <div style={{
        fontSize: 16, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.3,
      }}>{title}</div>
      {sub && (
        <div style={{
          fontSize: 12, color: 'var(--c-text3)', marginTop: 2,
        }}>{sub}</div>
      )}
    </FadeInOnMount>
  )
}

function MetricTile({ label, value, sub, colour = 'var(--c-text)', missing }) {
  return (
    <div style={{
      background: 'var(--c-surface2)', borderRadius: 12, padding: '10px 12px',
    }}>
      <div style={{
        fontSize: 11, color: 'var(--c-text3)', textTransform: 'uppercase',
        letterSpacing: 0.5, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 700,
        color: missing ? 'var(--c-text3)' : colour,
        fontStyle: missing ? 'italic' : 'normal',
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function VarianceBadge({ entity, mode1, mode2, window: win, metric = 'netWorth' }) {
  if (mode1 === mode2) return null
  let v = null
  try { v = varianceFor(entity, mode1, mode2, win)?.[metric] ?? null } catch { v = null }
  if (v == null || !Number.isFinite(v) || v === 0) return null
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
      background: 'rgba(255,179,71,0.10)', color: '#FFB347',
      letterSpacing: 0.4, marginLeft: 6,
    }}>
      Δ {fmt(v)} vs {mode1}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §3 DOMAIN BUILDERS — convert entity → wrapper-stamped rows for each domain
// ═════════════════════════════════════════════════════════════════════════════

function rowsForPensions(entity) {
  const a = entity.assets || {}
  const out = []
  // legacy
  for (const p of (a.sipp?.pensions || [])) {
    out.push({
      id: p.id || p.name, label: p.name || 'Pension', value: +p.value || 0,
      sub: `${p.provider || ''} · ${p.type || 'pension'}`.trim(),
      wrapper: 'PENSION', raw: p,
    })
  }
  // nested
  for (const p of (a.pensions || [])) {
    if (p.type === 'occupational-DB' && p.cetv == null) continue
    const v = +(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0)
    out.push({
      id: p.id || p.name, label: p.name || p.scheme_name || 'Pension', value: v,
      sub: `${p.provider || ''} · ${p.type || 'pension'}`.trim(),
      wrapper: getWrapper(p), raw: p,
    })
  }
  return out
}

function rowsForISAs(entity) {
  const a = entity.assets || {}
  const out = []
  // Spec shape: any investments[] items with ISA-related type.
  const specItems = (a.investments || []).filter(inv =>
    (inv.type || '').toLowerCase().includes('isa'))
  // Legacy shape: a.isa.value. Skip if spec items are present (avoids
  // double-counting when both shapes are populated — Mr T fixture case).
  if (a.isa?.value > 0 && specItems.length === 0) {
    out.push({
      id: 'isa-legacy', label: 'Stocks & Shares ISA', value: +a.isa.value || 0,
      sub: `Growing at ${((+a.isa.growth || 0.05) * 100).toFixed(1)}% p.a.`,
      wrapper: 'ISA',
    })
  }
  for (const inv of specItems) {
    out.push({
      id: inv.id || inv.name, label: inv.name || inv.type,
      value: +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0) || 0,
      sub: inv.provider || '',
      wrapper: 'ISA',
    })
  }
  return out
}

function rowsForGIA(entity) {
  const a = entity.assets || {}
  const out = []
  // Dedupe: skip legacy a.portfolio.value when spec investments[] has GIA items.
  const specItems = (a.investments || []).filter(inv => {
    const t = (inv.type || '').toLowerCase()
    return t === 'gia' || t.includes('general-investment')
  })
  if (a.portfolio?.value > 0 && specItems.length === 0) {
    out.push({
      id: 'gia-legacy', label: 'GIA / Brokerage', value: +a.portfolio.value || 0,
      sub: a.portfolio?.bpr ? 'BPR-qualifying' : 'General investment',
      wrapper: 'GIA',
    })
  }
  for (const inv of specItems) {
    out.push({
      id: inv.id || inv.name, label: inv.name || 'GIA',
      value: +(inv.balance_gbp ?? inv.balance ?? 0) || 0,
      sub: inv.provider || '',
      wrapper: 'GIA',
    })
  }
  return out
}

function rowsForByWrapper(entity, wrapper) {
  // Generic catch-all: BOND_ON, BOND_OFF, EIS, SEIS, VCT, TRUST
  const a = entity.assets || {}
  const out = []
  for (const inv of (a.investments || [])) {
    if (getWrapper(inv) === wrapper) {
      out.push({
        id: inv.id || inv.name, label: inv.name || inv.type, value: +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0) || 0,
        sub: inv.provider || '',
        wrapper,
      })
    }
  }
  return out
}

function rowsForBPR(entity) {
  // Domain H: BPR / APR / BADR business assets
  const a = entity.assets || {}
  const out = []
  if (a.portfolio?.bpr) out.push({
    id: 'gia-bpr', label: 'GIA — BPR qualifying', value: +a.portfolio.value || 0,
    sub: '100% IHT relief after 2 years',
    // BPR-qualifying portfolio sits inside a GIA — wrapper is GIA, tag flags BPR.
    wrapper: 'GIA', tag: 'BPR',
  })
  for (const b of (entity.business_assets || [])) {
    out.push({
      id: b.id || b.name, label: b.name || 'Business asset',
      value: +(b.value_gbp ?? b.value ?? 0) || 0,
      sub: `${b.qualifies_for_bpr ? 'BPR' : ''}${b.qualifies_for_apr ? ' · APR' : ''}${b.qualifies_for_badr ? ' · BADR' : ''}`.trim(),
      // C-02 fix: Ltd-company shares / unquoted business assets are NOT a GIA.
      // Preserve any source-supplied wrapper; otherwise leave null so the
      // wrapper composition bar (and tax fast-path) doesn't misclassify them
      // as a GIA. Use BPR tag for IHT signal when qualifying.
      wrapper: b.wrapper || null,
      tag: b.qualifies_for_bpr ? 'BPR' : 'BUSINESS',
    })
  }
  return out
}

function rowsForProperty(entity) {
  const a = entity.assets || {}
  const out = []
  if (a.residence?.value) out.push({
    id: 'residence', label: a.residence.address || 'Primary residence',
    value: (+a.residence.value || 0) * (+a.residence.ownershipShare || 1),
    sub: `${(+a.residence.ownershipShare || 1) * 100}% ownership · in estate`,
    wrapper: 'PROPERTY',
  })
  for (const p of (a.property || [])) {
    if (p['$ref'] || p.status === 'disposed') continue
    out.push({
      id: p.id || p.address, label: p.address || p.label || 'Property',
      value: +(p.value_gbp ?? p.value ?? 0) || 0,
      sub: `${p.use || 'residential'}${p.beneficial_interest_this_individual ? ` · ${p.beneficial_interest_this_individual * 100}% share` : ''}`,
      wrapper: 'PROPERTY',
    })
  }
  for (const p of (entity.rental_portfolio?.properties || [])) {
    if (p.status === 'disposed') continue
    out.push({
      id: p.id || p.address, label: p.address || 'Rental',
      value: +(p.value_gbp ?? p.value ?? p.estimated_value ?? 0) || 0,
      sub: 'BTL — gross yield ' + ((+p.gross_yield || 0) * 100).toFixed(1) + '%',
      wrapper: 'PROPERTY',
    })
  }
  return out
}

function rowsForCash(entity) {
  const a = entity.assets || {}
  const out = []
  // Dedupe: skip legacy a.cash.total when spec bank[] has accounts.
  const banks = a.bank || []
  const cashTotal = a.cash?.total || a.cash?.own || 0
  if (cashTotal > 0 && banks.length === 0) {
    out.push({
      id: 'cash-legacy', label: 'Cash & savings', value: cashTotal,
      sub: `${((+a.cash?.rate || 0.04) * 100).toFixed(1)}% rate`,
      wrapper: 'CASH',
    })
  }
  for (const b of banks) {
    out.push({
      id: b.id || b.account_name, label: b.account_name || b.bank || 'Bank',
      value: +(b.balance_gbp ?? b.balance ?? 0) || 0,
      sub: `${b.bank || ''}${b.interest_rate ? ` · ${(+b.interest_rate * 100).toFixed(1)}%` : ''}`.trim(),
      wrapper: 'CASH',
    })
  }
  return out
}

function rowsForLiabilities(entity) {
  const out = []
  const liab = entity.liabilities
  if (Array.isArray(liab)) {
    for (const l of liab) {
      out.push({
        id: l.id || l.type, label: (l.type || 'loan').replace(/_/g, ' '),
        value: +(l.outstanding_balance_gbp ?? l.outstanding_balance ?? l.balance ?? 0) || 0,
        sub: `${fmt(+(l.monthly_payment || 0))}/mo · ${(+l.apr || +l.interest_rate || 0) * 100}% APR`,
        wrapper: null, isLiability: true,
      })
    }
  } else if (liab) {
    if (liab.mortgage?.outstanding) out.push({
      id: 'mortgage', label: `Mortgage (${liab.mortgage.rateType || 'fixed'})`,
      value: +liab.mortgage.outstanding, sub: `${fmt(+liab.mortgage.monthlyPayment || 0)}/mo · ${liab.mortgage.remainingYears || 0} yrs`,
      isLiability: true,
    })
    for (const l of (liab.otherLoans || [])) {
      out.push({
        id: l.id || l.type, label: (l.type || 'Loan').replace(/_/g, ' '),
        value: +l.outstanding || 0, sub: `${fmt(+l.monthlyPayment || 0)}/mo`,
        isLiability: true,
      })
    }
  }
  return out
}

function rowsForProtection(entity) {
  // Domain J: protection in trust / individual
  const out = []
  const lp = entity.assets?.protection || {}
  if (lp.lifeInsurance?.exists) out.push({
    id: 'life', label: `Life cover${lp.lifeInsurance.inTrust ? ' (in trust)' : ''}`,
    value: +lp.lifeInsurance.amount || 0,
    sub: `${fmt(+lp.lifeInsurance.premium || 0)}/mo premium`,
    wrapper: lp.lifeInsurance.inTrust ? 'TRUST' : null, tag: 'LIFE',
  })
  if (lp.incomeProtection?.exists) out.push({
    id: 'ip', label: 'Income Protection',
    value: (+lp.incomeProtection.monthlyBenefit || 0) * 12,
    sub: `${fmt(+lp.incomeProtection.monthlyBenefit || 0)}/mo benefit`,
    tag: 'IP',
  })
  if (lp.criticalIllness?.exists) out.push({
    id: 'cic', label: 'Critical Illness',
    value: +lp.criticalIllness.amount || 0,
    sub: `${fmt(+lp.criticalIllness.premium || 0)}/mo premium`,
    tag: 'CIC',
  })
  if (lp.relevantLifePlan?.exists) out.push({
    id: 'rlp', label: 'Relevant Life Plan',
    value: +lp.relevantLifePlan.amount || 0,
    sub: 'Director-only — corporate-paid',
    wrapper: 'TRUST', tag: 'RLP',
  })
  for (const p of (entity.protection || [])) {
    out.push({
      id: p.id, label: p.product_name || p.type || 'Protection',
      value: +(p.cover_amount || p.amount || 0) || 0,
      sub: `${p.provider || ''}${p.premium_monthly ? ` · ${fmt(+p.premium_monthly)}/mo` : ''}`.trim(),
      wrapper: p.trust_status === 'in-trust' ? 'TRUST' : null,
    })
  }
  return out
}

function rowsForGeneralInsurance(entity) {
  // Domain K: general insurance — home, motor, travel, pet
  const out = []
  for (const p of (entity.general_insurance || [])) {
    out.push({
      id: p.id, label: p.type || 'General insurance',
      value: +(p.cover_amount || 0) || 0,
      sub: `${p.provider || ''}${p.premium_annual ? ` · ${fmt(+p.premium_annual)}/yr` : ''}`.trim(),
    })
  }
  return out
}

function rowsForBusinessInsurance(entity) {
  // Domain L: business insurance — keyman, shareholder protection, PII
  const out = []
  for (const p of (entity.business_insurance || [])) {
    out.push({
      id: p.id, label: p.type || 'Business cover',
      value: +(p.cover_amount || 0) || 0,
      sub: `${p.provider || ''}${p.premium_annual ? ` · ${fmt(+p.premium_annual)}/yr` : ''}`.trim(),
    })
  }
  return out
}

function rowsForEmployeeShare(entity) {
  // Domain I: EMI / SAYE / LTIP / RSU
  const out = []
  for (const s of (entity.share_schemes || entity.employee_shares || [])) {
    out.push({
      id: s.id, label: `${s.scheme_type || 'Share scheme'} — ${s.employer || ''}`.trim(),
      value: +(s.estimated_value || s.value_gbp || 0) || 0,
      sub: `${s.vesting_status || 'unvested'}${s.exercise_price ? ` · strike ${fmt(s.exercise_price)}` : ''}`,
      // C-03 fix: EMI/SAYE/LTIP/RSU are NOT GIA wrappers. EMI gains route
      // through CGT (often BADR 10%), SAYE has a savings element, RSU vests
      // as employment income. Forcing 'GIA' here routed them through the
      // wrong tax fast-path. Preserve any source-supplied wrapper; else null.
      wrapper: s.wrapper || null, tag: s.scheme_type,
    })
  }
  return out
}

function rowsForAlternatives(entity) {
  // Domain U: crypto, gold, art, PE, wine
  const out = []
  for (const inv of (entity.assets?.investments || [])) {
    const t = (inv.type || '').toLowerCase()
    if (t.includes('crypto') || t.includes('gold') || t.includes('art') ||
        t.includes('private-equity') || t.includes('wine') || t.includes('collectible')) {
      out.push({
        id: inv.id, label: inv.name || inv.type,
        value: +(inv.balance_gbp ?? inv.balance ?? inv.estimated_value ?? 0) || 0,
        sub: `${inv.type}${inv.last_valuation_date ? ` · ${inv.last_valuation_date}` : ''}`,
        // C-01 fix: alternatives (crypto, wine, gold, art, PE) are NOT held in
        // a GIA. Crypto/art/wine/gold are typically self-custodied or in a
        // safe-keeping context — no wrapper at all. Preserve any source
        // wrapper if explicitly supplied; otherwise leave null so the wrapper
        // composition bar hides them and the tax fast-path doesn't apply GIA
        // CGT logic to chattel/crypto/PE which have their own tax regimes.
        wrapper: inv.wrapper || null, tag: 'ALT',
      })
    }
  }
  for (const a of (entity.alternatives || entity.alt_assets || [])) {
    out.push({
      id: a.id, label: a.name || a.type,
      value: +(a.value_gbp ?? a.value ?? 0) || 0,
      sub: a.type || '',
      // C-01 fix: same reasoning — alternatives are not GIA. Preserve source.
      wrapper: a.wrapper || null, tag: 'ALT',
    })
  }
  return out
}

function rowsForFamilyObligations(entity) {
  // Domain V: dependants, school fees, parent care commitments
  const out = []
  for (const d of (entity.dependants || [])) {
    out.push({
      id: d.id || d.name, label: `${d.name || d.type} (age ${d.age || '?'})`,
      value: +(d.annual_cost || 0) || 0,
      sub: d.type || 'dependant',
      tag: 'OBLIG',
    })
  }
  for (const o of (entity.family_obligations || [])) {
    out.push({
      id: o.id, label: o.label || o.type,
      value: +(o.annual_cost || 0) || 0, sub: o.type || '',
      tag: 'OBLIG',
    })
  }
  return out
}

function rowsForStateBenefits(entity) {
  // Domain W: state pension / NI / benefits
  const out = []
  const sp = entity.income?.statePension
  if (sp?.annual) out.push({
    id: 'sp', label: 'State Pension',
    value: +sp.annual, sub: `From age ${sp.startAge || 67}`,
    wrapper: 'STATE', tag: 'SP',
  })
  if (entity.individual?.state_pension_accrued_years != null) out.push({
    id: 'sp-acc', label: 'NI qualifying years',
    value: +entity.individual.state_pension_accrued_years,
    sub: `${entity.individual.state_pension_accrued_years} of 35`,
    wrapper: 'STATE', tag: 'NI', isCount: true,
  })
  for (const b of (entity.benefits || [])) {
    out.push({
      id: b.id, label: b.type || 'Benefit',
      value: +(b.annual || 0) || 0, sub: '',
      wrapper: 'STATE',
    })
  }
  return out
}

function rowsForDirector(entity) {
  // Domain X: gated by hasPersonaFlag(entity,'director')
  const out = []
  for (const c of (entity.companies || entity.ltd_companies || [])) {
    out.push({
      id: c.id, label: c.name || 'Ltd company',
      value: +(c.share_value_gbp || c.value || 0) || 0,
      sub: `${c.role || 'Director'}${c.shareholding_pct ? ` · ${c.shareholding_pct * 100}%` : ''}`,
      tag: 'CO',
    })
  }
  if (entity.directors_loan?.balance) out.push({
    id: 'dla', label: "Director's Loan Account",
    value: +entity.directors_loan.balance,
    sub: entity.directors_loan.in_credit ? 'In credit (you owe co.)' : 'Co. owes you',
    tag: 'DLA',
  })
  return out
}

// ═════════════════════════════════════════════════════════════════════════════
// §4 ASSET ROW — wrapper-first render contract
// ═════════════════════════════════════════════════════════════════════════════

function AssetRow({ row, onTap, hideValue }) {
  const interactive = !!onTap
  return (
    <button
      onClick={onTap ? () => onTap(row) : undefined}
      className={interactive ? 'sw-press' : undefined}
      style={{
        width: '100%', padding: '10px 4px', display: 'flex',
        alignItems: 'center', gap: 10, background: 'transparent',
        border: 'none', borderBottom: '1px solid var(--c-sep)',
        cursor: interactive ? 'pointer' : 'default', textAlign: 'left',
        borderRadius: 8,
        transition: 'background var(--dur-fast) var(--ease-out-cubic)',
      }}
      onMouseEnter={interactive ? (e) => { e.currentTarget.style.background = 'var(--c-tint-neutral)' } : undefined}
      onMouseLeave={interactive ? (e) => { e.currentTarget.style.background = 'transparent' } : undefined}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {row.wrapper && <WrapperBadge wrapper={row.wrapper} />}
          {row.tag && (
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--c-text3)',
              fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            }}>{row.tag}</span>
          )}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{row.label}</div>
        {row.sub && (
          <div style={{
            fontSize: 11, color: 'var(--c-text3)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.sub}</div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: row.isLiability ? 'var(--c-coral, #FF6B6B)' : 'var(--c-text)',
        }}>
          {hideValue ? '—' : (row.isCount ? row.value : (row.isLiability ? '−' : '') + fmt(row.value))}
        </div>
      </div>
    </button>
  )
}

function DomainEmpty({ label }) {
  return (
    <div style={{
      fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic',
      padding: '8px 0', textAlign: 'center',
    }}>
      No {label} on file. Tap the + button to add.
    </div>
  )
}

// Render a domain card with rows + wrapper badges + total + diff
function DomainCard({ id, title, rows, total, deltaSince, sources, headerExtra, onRowTap, emptyLabel }) {
  // C-08: seed from 0 (not total) to avoid double-counting when total is also passed.
  // C-H04: exclude isCount rows (e.g. NI years) from the £ total.
  const safeTotal = rows
    .filter(r => !r.isCount)
    .reduce((s, r) => s + (r.isLiability ? -r.value : r.value), 0)
  const display = total != null ? total : safeTotal
  return (
    <RevealCard
      cardId={id}
      title={title}
      defaultOpen={rows.length > 0 && rows.length <= 3}
      headerAccessory={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {fmt(display)}
          </span>
          {deltaSince && <DeltaChip delta={deltaSince.value} format="currency" since={deltaSince.ts} />}
        </span>
      }
    >
      {headerExtra}
      {rows.length === 0
        ? <DomainEmpty label={emptyLabel || title.toLowerCase()} />
        : rows.map(r => (
          <AssetRow key={r.id || r.label} row={r} onTap={onRowTap} />
        ))}
      {sources?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <CausalityStripe sources={sources} />
        </div>
      )}
    </RevealCard>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §5 WRAPPER COMPOSITION BAR (§2.2 of spec)
// ═════════════════════════════════════════════════════════════════════════════

function WrapperCompositionBar({ entity, onSegmentTap, activeWrapper = null, onAddWrapperDetails }) {
  // Sum value by wrapper across all asset rows
  const totals = {}
  const all = [
    ...rowsForPensions(entity),
    ...rowsForISAs(entity),
    ...rowsForGIA(entity),
    ...rowsForByWrapper(entity, 'BOND_ON'),
    ...rowsForByWrapper(entity, 'BOND_OFF'),
    ...rowsForByWrapper(entity, 'EIS'),
    ...rowsForByWrapper(entity, 'SEIS'),
    ...rowsForByWrapper(entity, 'VCT'),
    ...rowsForByWrapper(entity, 'UNKNOWN'),
    ...rowsForCash(entity),
    ...rowsForProperty(entity),
  ]
  for (const r of all) {
    if (!r.wrapper) continue
    totals[r.wrapper] = (totals[r.wrapper] || 0) + r.value
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grand <= 0) return null
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
  const unknownAmount = totals.UNKNOWN || 0
  return (
    <div style={{ marginBottom: 'var(--space-md)' }}>
      <div
        style={{
          height: 12, borderRadius: 100, overflow: 'hidden',
          display: 'flex', gap: 2,
          // Animate scaleX from 0 → 1 on mount, anchored to the left edge.
          transformOrigin: 'left center',
          animation: 'sw-bar-grow 800ms var(--ease-out-expo) both',
        }}
      >
        {entries.map(([w, v]) => {
          const pal = WRAPPER_PALETTE[w] || WRAPPER_PALETTE.GIA
          const isActive = activeWrapper === w
          const isOther = activeWrapper && !isActive
          const isUnknown = w === 'UNKNOWN'
          const baseOpacity = isActive ? 1 : isOther ? 0.25 : 0.85
          // Diagonal-stripe pattern for UNKNOWN — visual cue that this slice is
          // unresolved and shouldn't be treated as a known wrapper bucket.
          const bg = isUnknown
            ? `repeating-linear-gradient(45deg, ${pal.fg} 0, ${pal.fg} 4px, transparent 4px, transparent 8px)`
            : pal.fg
          return (
            <button key={w} onClick={() => onSegmentTap?.(isActive ? null : w)}
              className="sw-press"
              style={{
                flex: v / grand, background: bg, opacity: baseOpacity,
                border: isUnknown ? `1px dashed ${pal.fg}` : 'none',
                cursor: 'pointer', minWidth: 4,
                boxShadow: isActive ? `0 0 12px ${pal.fg}88` : 'none',
                transform: isActive ? 'scaleY(1.18)' : 'scaleY(1)',
                transformOrigin: 'center',
                transition: 'opacity 200ms var(--ease-out-cubic), transform 200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)), box-shadow 200ms ease-out',
              }}
              onMouseEnter={(e) => { if (!activeWrapper) e.currentTarget.style.opacity = 1 }}
              onMouseLeave={(e) => { if (!activeWrapper) e.currentTarget.style.opacity = 0.85 }}
              aria-label={`${isUnknown ? 'Unresolved wrapper' : w} ${fmt(v)}${isActive ? ' · active filter' : ''}`} />
          )
        })}
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-sm)',
      }}>
        {entries.map(([w, v]) => {
          const isActive = activeWrapper === w
          const isOther = activeWrapper && !isActive
          const isUnknown = w === 'UNKNOWN'
          // L-02 fix: use lay-readable wrapper label, not raw enum.
          const layName = WRAPPER_LABEL[w] || w
          const badgeLabel = isUnknown ? `WRAPPER? · ${fmt(v)}` : `${layName} · ${fmt(v)}`
          return (
            <span key={w} onClick={() => onSegmentTap?.(isActive ? null : w)}
              className="sw-press"
              style={{
                cursor: 'pointer',
                opacity: isOther ? 0.32 : 1,
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                transition: 'opacity 200ms ease-out, transform 200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                display: 'inline-block',
              }}>
              <WrapperBadge wrapper={w} label={badgeLabel} />
            </span>
          )
        })}
      </div>
      {unknownAmount > 0 && (
        <div
          role="alert"
          style={{
            marginTop: 'var(--space-sm)',
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            border: '1px dashed var(--c-text3)',
            background: 'var(--c-tint-neutral)',
            color: 'var(--c-text2)',
            fontSize: 12, lineHeight: 1.4,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span>
            <strong style={{ color: 'var(--c-text)' }}>{fmt(unknownAmount)}</strong>{' '}
            of your assets can't be classified into a wrapper yet. Tax treatment can't be calculated until this is resolved.
          </span>
          <button
            type="button"
            className="sw-press"
            onClick={() => onAddWrapperDetails?.()}
            style={{
              border: '1px solid var(--c-acc)', background: 'transparent',
              color: 'var(--c-acc)', borderRadius: 999,
              padding: '6px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Add wrapper details
          </button>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §6 INCOME SECTION — banded by tax type (D-INCOME-ORDERING-1)
// ═════════════════════════════════════════════════════════════════════════════

function IncomeSection({ entity }) {
  const all = calcAllIncome(entity)
  if (!all.total) {
    return (
      <RevealCard cardId="income-domain-O" title="Money coming in" defaultOpen={false}>
        <DomainEmpty label="income" />
      </RevealCard>
    )
  }

  const groups = { non_savings: [], savings: [], dividends: [], cgt: [] }
  for (const it of all.items) {
    const cls = classifyIncomeType(it)
    // C-11: guard unknown classification keys — unknown types are silently skipped
    if (groups[cls]) groups[cls].push(it)
  }
  const order = ['non_savings', 'savings', 'dividends', 'cgt']
  const labels = {
    non_savings: 'Non-savings (employment, rental, drawdown)',
    savings: 'Savings interest',
    dividends: 'Dividends',
    cgt: 'Capital gains',
  }

  return (
    <RevealCard
      cardId="income-domain-O"
      title="Money coming in"
      defaultOpen={true}
      headerAccessory={
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-acc)' }}>
          {fmt(all.total)}/yr
        </span>
      }
    >
      {order.map(g => {
        if (groups[g].length === 0) return null
        return (
          <div key={g} style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--c-text3)',
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
            }}>{labels[g]} — {fmt(all.byType[g] || 0)}</div>
            {groups[g].map((it, i) => (
              <div key={i} className="row" style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--c-text)' }}>
                  {(it.type || 'income').replace(/-/g, ' ')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>
                  {fmt(it.amount)}
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <CausalityStripe sources={['Your data', BRAND.rulesVersion]} />
    </RevealCard>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §6B ANI CLIFF-EDGE WARNING (Phase 1D)
// Shows a bar when ANI is within £20k of the £100k personal allowance taper.
// Above £100k: 60% effective marginal rate band (PA tapers at 50p/£).
// ═════════════════════════════════════════════════════════════════════════════

function CliffEdgeWarning({ entity }) {
  let ani = 0
  try { ani = calcANI(entity)?.ani || 0 } catch { return null }

  const cliff = 100_000
  const distance = cliff - ani

  // Only show when approaching (within £20k below) or already past
  if (distance > 20_000) return null

  const past = distance < 0
  const pensionToSolve = past ? Math.abs(distance) : distance
  const barFill = Math.min(100, (ani / cliff) * 100)
  const color = past ? 'var(--c-coral, #FF6F7D)' : distance < 5_000 ? '#FFB347' : '#FFB347'

  return (
    <FadeInOnMount delay={40} style={{ marginBottom: 12 }}>
      <div style={{
        background: `color-mix(in srgb, ${color} 8%, var(--c-surface))`,
        border: `1px solid color-mix(in srgb, ${color} 35%, var(--c-border))`,
        borderRadius: 14, padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color }}>
              {past
                ? `£100k income threshold passed — 60% marginal rate in effect`
                : `£${fmt(distance)} from the £100k income cliff`}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>
              {past
                ? `Above £100k your personal allowance is tapering. A pension contribution of around £${fmt(pensionToSolve)} could help — verify the amount and timing with an adviser before acting.`
                : `Above £100k: your personal allowance disappears at 50p per £ — 60% effective rate. A pension contribution could help keep you below the threshold — verify with an adviser before acting.`}
            </div>
          </div>
        </div>
        {/* Progress bar to cliff */}
        <div style={{ position: 'relative', height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${barFill}%`,
            background: `linear-gradient(90deg, var(--c-acc), ${color})`,
            borderRadius: 100,
          }} />
          {/* Cliff marker */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '100%',
            width: 2, background: color, marginLeft: -2,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 8, color: 'var(--c-text3)' }}>Your income {fmt(ani)}</span>
          <span style={{ fontSize: 8, color, fontWeight: 700 }}>Cliff £100k</span>
        </div>
      </div>
    </FadeInOnMount>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §7 SURPLUS TILE (§3.6)
// ═════════════════════════════════════════════════════════════════════════════

// Phase 3A — Income flow breakdown bar (replaces SVG Sankey which had
// invisible flows + label-clipping issues on dark backgrounds)
function CashFlowSankey({ m }) {
  const income = Math.max(m.income || 1, 1)
  const surplus = (m.surplus || 0) - (m.deficit || 0)
  const isDeficit = surplus < 0

  function fmtK(v) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `£${(abs / 1_000_000).toFixed(1)}m`
    if (abs >= 1_000) return `£${(abs / 1_000).toFixed(0)}k`
    return `£${Math.round(abs)}`
  }

  // For deficit users the total bar = spending + shortfall (spending > income).
  // Shortfall gets a distinct bright-red so it never merges visually with Debt.
  const spentSegs = [
    { label: 'Essentials', v: m.essential || 0,   color: '#7AA7FF' },
    { label: 'Debt',       v: m.debtService || 0,  color: '#FF6F7D' },
    { label: 'Committed',  v: m.committed || 0,    color: '#FFB347' },
  ].filter(s => s.v > 0)

  const tailSeg = isDeficit
    ? { label: 'Shortfall', v: Math.abs(surplus), color: '#FF3B30' }  // distinct from Debt coral
    : surplus > 0
      ? { label: 'Surplus', v: surplus, color: 'var(--c-acc, #2DF2C3)' }
      : null

  const allSegs = tailSeg ? [...spentSegs, tailSeg] : spentSegs
  // C-05: empty state when no cash flow data available
  if (allSegs.length === 0) return (
    <div style={{ fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic', padding: '8px 0', marginBottom: 10 }}>
      No cash flow data — add income and spending to see your budget breakdown.
    </div>
  )
  const totalBarV = Math.max(allSegs.reduce((s, seg) => s + seg.v, 0), 1)

  // For deficit users, draw an income marker line so the user sees exactly where
  // their income runs out before the shortfall begins.
  const incomePct = isDeficit ? Math.min((income / totalBarV) * 100, 99) : null

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, color: 'var(--c-text3)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        How your income is spent · {fmtK(income)}/mo
      </div>

      {/* Proportional bar */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          {allSegs.map((s, i) => (
            <div
              key={i}
              style={{
                flex: s.v,
                background: s.color,
                opacity: s.label === 'Shortfall' ? 1 : 0.82,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={`${s.label}: ${fmtK(s.v)}`}
            >
              {/* Show £ amount inside the segment when it's wide enough */}
              {(s.v / totalBarV) > 0.13 && (
                <span style={{
                  fontSize: 8, fontWeight: 800, color: 'var(--c-bg, #051424)',
                  whiteSpace: 'nowrap', padding: '0 4px',
                }}>
                  {fmtK(s.v)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Income marker: white line where income runs out (deficit users only) */}
        {incomePct != null && (
          <div style={{
            position: 'absolute', top: -2, bottom: -2,
            left: `calc(${incomePct}% - 1px)`, width: 2,
            background: 'rgba(255,255,255,0.55)', borderRadius: 1,
          }} title={`Income: ${fmtK(income)}`} />
        )}
      </div>

      {/* Legend with labels + amounts — always readable, never clipped */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {allSegs.map((s, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2,
              background: s.color, opacity: 0.85,
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, color: 'var(--c-text3)' }}>{s.label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text2)' }}>{fmtK(s.v)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function SurplusTile({ entity }) {
  const m = monthlySurplus(entity)
  const surplus = m.surplus || -(m.deficit || 0)
  const pos = surplus >= 0
  const amt = Math.abs(surplus)
  const accentColor = pos ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)'


  return (
    <FadeInOnMount
      className="sw-card"
      style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 12 }}>
        <span className="sw-eyebrow" style={{ flex: 1 }}>Monthly cash flow</span>
        <ProvenanceChip sources={['Your data', 'Apr 2026']} />
      </div>

      {/* Hero + context */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: !pos ? 8 : 14 }}>
        <div className="sw-hero-md" style={{ color: accentColor }}>
          {pos ? '+' : '−'}<Num value={amt} format="currency" animate />
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.3 }}>
          {pos
            ? `left over after all costs · £${Math.round(amt * 12 / 1000)}k/yr to save or invest`
            : `spending exceeds income this month`}
        </div>
      </div>

      {/* Phase 1B — Runway warning: how many months of liquid cash remain */}
      {!pos && (() => {
        const cashLiquid = +(entity?.assets?.cash?.total || 0)
          || (entity?.assets?.cash_accounts || []).reduce((s, a) => s + (+a.balance_gbp || +a.balance || 0), 0)
          || +(entity?.assets?.cash?.value || 0)
        const monthly = Math.abs(surplus)
        const monthsRunway = cashLiquid > 0 && monthly > 0 ? cashLiquid / monthly : null
        if (!monthsRunway) return null
        const urgent = monthsRunway < 3
        const warn   = monthsRunway < 6
        const runwayColor = urgent ? 'var(--c-coral, #FF6F7D)' : warn ? '#FFB347' : 'var(--c-text2)'
        return (
          <div style={{
            background: urgent ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 8%, var(--c-surface2))' : 'var(--c-surface2)',
            border: `1px solid color-mix(in srgb, ${runwayColor} 30%, var(--c-border))`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{urgent ? '⚠' : '⏱'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: runwayColor }}>
                {`Liquid cash covers ${monthsRunway < 1
                  ? `${Math.round(monthsRunway * 30)} days`
                  : `${monthsRunway.toFixed(1)} months`} at this rate`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>
                {urgent ? 'Action needed — review committed spending below or add cash'
                  : warn ? 'Below the 6-month recommended buffer — monitor closely'
                  : 'You have breathing room, but the deficit needs addressing'}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Phase 3A — Sankey flow diagram: income → spending breakdown */}
      <CashFlowSankey m={m} />

      {/* 4 metric tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
        <MetricTile label="Monthly income" value={fmt(m.income || 0)} colour="var(--c-text)" />
        <MetricTile label="Essentials" value={fmt(m.essential || 0)} colour="var(--c-text2)" />
        <MetricTile label="Debt payments" value={fmt(m.debtService || 0)} colour="#FF6B6B" />
        <MetricTile label="Committed" value={fmt(m.committed || 0)} colour="var(--c-text2)" />
      </div>

      {/* Phase 2E — Self-comparison: how did this month compare to last? */}
      {(() => {
        const traj = entity?.trajectories?.netWorthHistory
        if (!Array.isArray(traj) || traj.length < 2) return null
        const last = +(traj[traj.length - 1]?.value || 0)
        const prev = +(traj[traj.length - 2]?.value || 0)
        const delta = last - prev
        if (!delta) return null
        return (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: delta >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)', fontWeight: 700 }}>
              {delta >= 0 ? '↑' : '↓'} {fmt(Math.abs(delta))}
            </span>
            net worth vs last month — despite the monthly shortfall, assets grew
          </div>
        )
      })()}
    </FadeInOnMount>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §8 ANI 6-STEP DISPLAY + SALARY SACRIFICE OPTIMISER + ALLOWANCE TRACKER
// ═════════════════════════════════════════════════════════════════════════════

function ANIPanel({ entity }) {
  // C-06: wrap calcANI — it can throw on unusual entity shapes
  let a
  try { a = calcANI(entity) } catch { return null }
  if (!a?.steps) return null
  const pa = calcPersonalAllowance(a.ani)
  const psa = calcPSA(entity)
  const hicbc = calcHICBC(entity)
  const ma = calcMarriageAllowance(entity)

  return (
    <RevealCard cardId="tax-ani" title="What you actually keep from what you earn" defaultOpen={false}
      headerAccessory={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>ANI {fmt(a.ani)}</span>}
    >
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <strong>How your take-home income is calculated</strong>
        <ExplainerChip id="MM-ANI" />
        <span>— six steps from total earnings to what HMRC counts as your income figure:</span>
      </div>
      {(() => {
        const steps = [
          { n: 1, label: 'Total income',       value: a.steps.total,             sign: '',  emphasised: true  },
          { n: 2, label: 'Gift Aid (grossed up)', value: a.steps.grossedUpGiftAid,  sign: '+', emphasised: false },
          { n: 3, label: 'Pension paid in',       value: a.steps.pensionContribs,   sign: '−', emphasised: false },
          { n: 4, label: 'Trading losses',        value: a.steps.tradeLosses,       sign: '−', emphasised: false },
          { n: 5, label: 'Interest you paid',     value: a.steps.interestPaid,      sign: '−', emphasised: false },
          { n: 6, label: `Take-home (${a.confidence})`, value: a.ani,            sign: '=', emphasised: true  },
        ]
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 0,
            position: 'relative',
            margin: '0 0 var(--space-sm)',
          }}>
            {/* Connector line behind dots */}
            <div style={{
              position: 'absolute',
              left: '8.33%',
              right: '8.33%',
              top: 14,
              height: 2,
              background: 'var(--c-sep)',
              borderRadius: 100,
              zIndex: 0,
            }} />
            {steps.map((s, i) => (
              <FadeInOnMount
                key={s.n}
                delay={i * 80}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '0 2px',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: s.emphasised ? 'var(--c-acc)' : 'var(--c-surface2)',
                  color: s.emphasised ? 'var(--c-bg, #0B1F3A)' : 'var(--c-text)',
                  border: `2px solid ${s.emphasised ? 'var(--c-acc)' : 'var(--c-sep)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  marginBottom: 4,
                }}>
                  {s.n}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--c-text3)',
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  lineHeight: 1.15,
                  minHeight: 22,
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: s.emphasised ? 'var(--c-acc)' : 'var(--c-text2)',
                  fontWeight: 700,
                  marginTop: 2,
                }}>
                  {s.sign}{fmt(s.value)}
                </div>
              </FadeInOnMount>
            ))}
          </div>
        )
      })()}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10,
      }}>
        <MetricTile label="Tax-free slice of income"
          value={fmt(pa)} sub={pa < 12570 ? 'Reduced because income is over £100k' : 'Full £12,570'}
          colour={pa < 12570 ? '#FFB347' : 'var(--c-text)'} />
        <MetricTile label="Tax-free interest each year" value={fmt(psa.allowance)} sub={psa.band} />
        <MetricTile label="Child benefit clawback" value={fmt(hicbc.charge)}
          sub={hicbc.eligible ? `${hicbc.dependantsCount} child${hicbc.dependantsCount === 1 ? '' : 'ren'}` : 'Not applicable'}
          colour={hicbc.charge > 0 ? '#FF6B6B' : 'var(--c-text)'} />
        <MetricTile label="Marriage allowance transfer"
          value={ma.eligible ? fmt(ma.taxSaving) : '—'}
          sub={ma.eligible ? 'You qualify — saves the tax shown' : (ma.reason || '')} />
      </div>
      {/* Tax-cliff awareness */}
      {a.ani > 100000 && a.ani < 125140 && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: 'rgba(255,179,71,0.10)',
          border: '1px solid rgba(255,179,71,0.30)',
          borderRadius: 10, fontSize: 12, color: '#FFB347', lineHeight: 1.5,
        }}>
          ⚠ <strong>£100k–£125,140 PA taper</strong>: every £1 over £100k loses £0.50 of PA — effective marginal rate 60%. Sacrificing into pension can recover this.
        </div>
      )}
      {hicbc.charge > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(255,107,107,0.10)',
          border: '1px solid rgba(255,107,107,0.30)',
          borderRadius: 10, fontSize: 12, color: '#FF6B6B', lineHeight: 1.5,
        }}>
          ⚠ <strong>Child benefit charge active</strong>: your income is over £60,000, so some or all of any child benefit is clawed back at tax-return time. Paying more into your pension (especially via salary sacrifice) reduces your taxable income £-for-£ and can wipe the charge entirely.
        </div>
      )}
    </RevealCard>
  )
}

function AllowancesPanel({ entity }) {
  let t
  try { t = allowanceTracker(entity) } catch { return null }
  if (!t) return null
  const Bar = ({ label, used, limit, pct }) => {
    const over = pct > 100
    // Semantic colour: coral when over, mint when fully used (good for ISA),
    // amber mid-range, blue early.
    const fillColour = over ? '#FF6B6B'
      : pct >= 90 ? '#00E5A8'
      : pct >= 50 ? '#FFB347'
      : '#4D8EFF'
    return (
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: 3,
        }}>
          <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
            {fmt(used)} / {fmt(limit)}
          </span>
        </div>
        <div className="sw-bar">
          <div
            className="fill"
            style={{
              width: `${Math.min(100, pct)}%`,
              background: fillColour,
            }}
          />
        </div>
      </div>
    )
  }
  return (
    <RevealCard cardId="allowances" title="Tax-free allowances — how much you've used this year"
      defaultOpen={false}
      headerAccessory={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{t?.utilization ?? '—'}% used</span>}
    >
      <Bar label="ISA — tax-free shelter" used={t.isa.used} limit={t.isa.limit} pct={t.isa.pctUsed} />
      <Bar label="Tax-free interest on savings" used={t.psa.used} limit={t.psa.limit} pct={t.psa.pctUsed} />
      <Bar label="Tax-free capital gains" used={t.cgt.used} limit={t.cgt.limit} pct={t.cgt.pctUsed} />
      <Bar label="Tax-free dividends" used={t.dividend.used} limit={t.dividend.limit} pct={t.dividend.pctUsed} />
      <Bar label="Tax-free slice of income" used={t.pa.effective} limit={t.pa.limit} pct={t.pa.pctUsed} />
    </RevealCard>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §9 5-METHOD DRAWDOWN FRAMEWORK (§5 of spec)
// ═════════════════════════════════════════════════════════════════════════════

function DrawdownFrameworkPanel({ entity, onOpenDrillDown }) {
  const bengen = useMemo(() => bengenProjection(entity, 30), [entity])
  const gk     = useMemo(() => guytonKlingerPath(entity, 30), [entity])
  const buckets = useMemo(() => bucketAllocation(entity), [entity])
  const fu     = useMemo(() => floorUpsideSplit(entity), [entity])
  // H-06: guard null/throw from coiCashflowVariants
  const coiV   = useMemo(() => { try { return coiCashflowVariants(entity) || {} } catch { return {} } }, [entity])

  const yr1Bengen = bengen[0]?.withdrawal || 0
  const yr1GK     = gk[0]?.withdrawal || 0

  const cards = [
    {
      id: 'bengen', title: 'Fixed 4% a year',
      hero: fmt(yr1Bengen), heroLabel: 'Year 1 income',
      sub: `Over 30 years · pot at end ${fmt(bengen[bengen.length - 1]?.balance || 0)}`,
      colour: '#4D8EFF',
    },
    {
      id: 'gk', title: 'Smooth withdrawals',
      hero: fmt(yr1GK), heroLabel: 'Year 1 income (adjusts each year)',
      sub: `±20% swing · adjusts with inflation`,
      colour: '#00E5A8',
    },
    {
      id: 'bucket', title: 'Three pots — cash, medium, growth',
      hero: fmt(buckets.cash.target),
      heroLabel: 'Cash pot (years 0–2)',
      sub: `Medium ${fmt(buckets.medium.target)} · Growth ${fmt(buckets.growth.target)}`,
      colour: '#FFB347',
    },
    {
      id: 'floor', title: 'Guaranteed floor + market upside',
      hero: fmt(fu.floor.annual),
      heroLabel: 'Floor (state pension + annuity)',
      sub: `Upside ${fmt(fu.upside.annual)} · ratio ${(fu.ratio * 100).toFixed(0)}%`,
      colour: '#AF52DE',
    },
    {
      id: 'coi', title: 'Cost of waiting',
      hero: fmt(Object.values(coiV).reduce((s, v) => s + v, 0)),
      heroLabel: 'Total cost of un-decided actions (pension & ISA optimisation)',
      sub: `Drawdown ${fmt(coiV.drawdown)} · Wrapper choice ${fmt(coiV.wrapper)}`,
      colour: '#FF6B6B',
    },
  ]

  // Synthesis bar — yr-1 income comparison
  const yr1s = {
    Bengen: yr1Bengen,
    'GK-adaptive': yr1GK,
    'Floor+Upside': fu.floor.annual + fu.upside.annual,
  }
  const maxYr1 = Math.max(1, ...Object.values(yr1s))

  return (
    <RevealCard
      cardId="drawdown-framework"
      title="Drawdown — 5 methods (Domain B)"
      defaultOpen={true}
      headerAccessory={
        <button
          onClick={onOpenDrillDown}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 700,
            background: 'var(--c-acc-bg)', color: 'var(--c-acc)',
            border: '1px solid var(--c-acc)', borderRadius: 100,
            cursor: 'pointer',
          }}
        >Drill-down ›</button>
      }
    >
      <RevealStagger
        interval={60}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        {cards.map(c => (
          <div key={c.id} className="sw-card sw-lift" style={{
            background: 'var(--c-surface2)',
            border: `1px solid ${c.colour}33`,
            padding: 'var(--space-sm) var(--space-md)',
            cursor: 'default',
          }}>
            <div className="sw-eyebrow" style={{ color: c.colour, marginBottom: 3 }}>
              {c.title}
            </div>
            <div className="sw-hero-sm" style={{ lineHeight: 1.1 }}>{c.hero}</div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              {c.heroLabel}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text2)', marginTop: 4 }}>
              {c.sub}
            </div>
          </div>
        ))}
      </RevealStagger>

      {/* Synthesis bar: compare year-1 income across methods */}
      <div className="sw-eyebrow" style={{ marginBottom: 'var(--space-xs)' }}>
        Year-1 income comparison
      </div>
      {Object.entries(yr1s).map(([k, v]) => (
        <div key={k} style={{ marginBottom: 'var(--space-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{k}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>{fmt(v)}</span>
          </div>
          <div className="sw-bar">
            <div
              className="fill"
              style={{
                width: `${(v / maxYr1) * 100}%`,
                background: '#4D8EFF',
              }}
            />
          </div>
        </div>
      ))}

      <CausalityStripe sources={['CMA-2026.1', 'Bengen 1994', 'Morningstar UK 2024']} />
    </RevealCard>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §11 ASSET CAPTURE SHEET — wires UniversalAddButton onSelect
// ═════════════════════════════════════════════════════════════════════════════

const ALL_DOMAINS = [
  { id: 'A', label: 'Pension (SIPP / DC / DB)', wrapper: 'PENSION' },
  { id: 'C', label: 'ISA', wrapper: 'ISA' },
  { id: 'D', label: 'GIA / Brokerage', wrapper: 'GIA' },
  { id: 'E_EIS', label: 'EIS', wrapper: 'EIS' },
  { id: 'E_SEIS', label: 'SEIS', wrapper: 'SEIS' },
  { id: 'E_VCT', label: 'VCT', wrapper: 'VCT' },
  { id: 'F_ON', label: 'Investment bond — onshore', wrapper: 'BOND_ON' },
  { id: 'F_OFF', label: 'Investment bond — offshore', wrapper: 'BOND_OFF' },
  { id: 'G', label: 'Property (residence / BTL)', wrapper: 'PROPERTY' },
  { id: 'H', label: 'Business asset (BPR / APR / BADR)', wrapper: 'GIA' },
  { id: 'I', label: 'Employee share scheme (EMI / SAYE / RSU)', wrapper: 'GIA' },
  { id: 'J', label: 'Protection (in trust)', wrapper: 'TRUST' },
  { id: 'J2', label: 'Protection (individual)', wrapper: null },
  { id: 'K', label: 'General insurance', wrapper: null },
  { id: 'L', label: 'Business insurance', wrapper: null },
  { id: 'M', label: 'Cash & savings', wrapper: 'CASH' },
  { id: 'N', label: 'Liability (mortgage / loan / card)', wrapper: null },
  { id: 'U', label: 'Alternative (crypto / gold / art / PE)', wrapper: 'GIA' },
  { id: 'V', label: 'Family obligation', wrapper: null },
  { id: 'W', label: 'State benefit', wrapper: 'STATE' },
  { id: 'X', label: 'Director / Ltd company', wrapper: null },
]

function AssetCaptureSheet({ open, onClose, onCommit, entity }) {
  const [step, setStep] = useState('domain')   // 'domain' | 'form'
  const [domain, setDomain] = useState(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [provider, setProvider] = useState('')

  if (!open) return null

  function pick(d) {
    setDomain(d); setStep('form')
  }

  // Animation delay so children stagger in within the sheet body.
  const animBase = 60
  function commit() {
    const v = +value || 0
    onCommit?.({
      type: 'ASSET_VALUE_UPDATED',
      ts: Date.now(),
      correlation_id: `mm-add-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payload: {
        domain: domain.id,
        wrapper: domain.wrapper,
        name: name || domain.label,
        provider,
        value: v,
      },
    })
    setStep('domain'); setDomain(null); setName(''); setValue(''); setProvider('')
    onClose()
  }

  return (
    <OverlayShell title={step === 'domain' ? 'Add asset / liability' : `New ${domain?.label}`}
      subtitle={step === 'domain' ? '19 domains supported' : 'Captured to event store'}
      onBack={step === 'form' ? () => setStep('domain') : onClose}
      onHome={onClose}
    >
      <FadeInOnMount style={{ padding: '12px 16px 32px' }}>
        {step === 'domain' && (
          <div className="sw-card" style={{
            padding: 0,
            overflow: 'hidden',
          }}>
            {ALL_DOMAINS.map((d, i) => {
              if (d.id === 'X' && !hasPersonaFlag(entity, 'director')) return null
              return (
                <button
                  key={d.id}
                  onClick={() => pick(d)}
                  className="sw-press"
                  style={{
                    width: '100%', padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'transparent', border: 'none',
                    borderBottom: i < ALL_DOMAINS.length - 1 ? '1px solid var(--c-sep)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    animation: `sw-fade-up ${animBase + i * 18}ms var(--ease-out-cubic) both`,
                    animationDelay: `${i * 18}ms`,
                  }}
                >
                  <span style={{
                    width: 26, fontSize: 11, fontWeight: 700,
                    color: 'var(--c-text3)',
                  }}>{d.id}</span>
                  {d.wrapper && <WrapperBadge wrapper={d.wrapper} />}
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>{d.label}</span>
                  <span style={{ color: 'var(--c-text3)' }}>›</span>
                </button>
              )
            })}
          </div>
        )}
        {step === 'form' && domain && (
          <div>
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              borderRadius: 16, padding: '14px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {domain.wrapper && <WrapperBadge wrapper={domain.wrapper} size="lg" />}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  {domain.label}
                </span>
              </div>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)',
                  textTransform: 'uppercase', letterSpacing: 0.5 }}>Label</span>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder={domain.label}
                  style={{
                    width: '100%', marginTop: 4, padding: '8px 10px',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-sep)', borderRadius: 8,
                    color: 'var(--c-text)', fontSize: 14,
                  }} />
              </label>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)',
                  textTransform: 'uppercase', letterSpacing: 0.5 }}>Provider</span>
                <input value={provider} onChange={e => setProvider(e.target.value)}
                  placeholder="e.g. Vanguard, HSBC"
                  style={{
                    width: '100%', marginTop: 4, padding: '8px 10px',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-sep)', borderRadius: 8,
                    color: 'var(--c-text)', fontSize: 14,
                  }} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)',
                  textTransform: 'uppercase', letterSpacing: 0.5 }}>Value (£)</span>
                <input type="number" value={value} onChange={e => setValue(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%', marginTop: 4, padding: '8px 10px',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-sep)', borderRadius: 8,
                    color: 'var(--c-text)', fontSize: 14,
                  }} />
              </label>
            </div>
            <button onClick={commit}
              disabled={!value || +value <= 0}
              className="sw-press"
              style={{
                width: '100%', padding: '13px 0',
                background: value ? '#00E5A8' : 'var(--c-surface2)',
                color: value ? 'var(--c-bg, #0B1F3A)' : 'var(--c-text3)',
                border: 'none', borderRadius: 100,
                fontSize: 14, fontWeight: 700,
                cursor: value ? 'pointer' : 'not-allowed',
              }}>
              Save asset
            </button>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 8, textAlign: 'center' }}>
              Your data is saved locally and used to update your financial picture.
            </div>
          </div>
        )}
      </FadeInOnMount>
    </OverlayShell>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §12 PENSION DRILL-DOWN — 6-section spec (§4.5)
// ═════════════════════════════════════════════════════════════════════════════

function PensionDrillDown({ entity, personaId, onBack, onHome, onCommit }) {
  const a = entity.assets || {}
  // M-02: include both legacy sipp.total AND new-spec pensions[] array
  const sippTot = (+(a.sipp?.total || 0))
    + (a.pensions || []).reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)
  const growth = a.sipp?.growth || 0.05
  const currentAge = entity.age || 62
  const guard = Math.round(guardrail(entity))

  const committedSchedule = entity.drawdownSchedule
  const [schedule, setSchedule] = useState(() => {
    if (Array.isArray(committedSchedule) && committedSchedule.length > 0) {
      return committedSchedule.map(r => ({ ...r }))
    }
    return Array.from({ length: 5 }, (_, i) => ({
      age: currentAge + 1 + i, amount: entity.drawdown || 0, reason: null,
    }))
  })

  const presets = [
    { id: 'none',   label: 'Take nothing',                          make: () => schedule.map(r => ({ ...r, amount: 0 })) },
    { id: 'basic',  label: 'Stay in basic-rate band · £37,700/yr',  make: () => schedule.map(r => ({ ...r, amount: 37700 })) },
    { id: 'guard',  label: `Safe withdrawal rate · ${fmt(guard)}/yr`, make: () => schedule.map(r => ({ ...r, amount: guard })) },
    { id: 'gk',     label: `Smooth withdrawals · ${fmt(Math.round(investable(entity) * 0.045))}/yr`, make: () => schedule.map(r => ({ ...r, amount: Math.round(investable(entity) * 0.045) })) },
  ]

  const yearsAhead = schedule.length
  const endValue = sippProjection(sippTot, growth, schedule, yearsAhead)
  const series = sippProjectionSeries(sippTot, growth, schedule, yearsAhead, currentAge)

  let ihtWithSchedule = 0, ihtCurrent = 0, ihtDelta = 0
  try {
    ihtWithSchedule = ihtDynamic({ ...entity, drawdown: schedule[0]?.amount || 0 }, true).iht || 0
    ihtCurrent = ihtDynamic(entity, true).iht || 0
    ihtDelta = ihtCurrent - ihtWithSchedule
  } catch { /* engine may not yet compute — silent */ }

  const baselineSchedule = committedSchedule || schedule.map(r => ({ ...r, amount: 0 }))
  const isDirty = schedule.some((r, i) =>
    r.amount !== (baselineSchedule[i]?.amount ?? 0) ||
    (r.reason || null) !== (baselineSchedule[i]?.reason || null))

  function updateRow(i, patch) { setSchedule(s => s.map((r, j) => j === i ? { ...r, ...patch } : r)) }
  function addYear() {
    setSchedule(s => {
      const last = s[s.length - 1]
      return [...s, { age: (last?.age || currentAge) + 1, amount: last?.amount || 0, reason: null }]
    })
  }
  function removeYear(i) { setSchedule(s => s.filter((_, j) => j !== i)) }
  function applyPreset(id) { const p = presets.find(x => x.id === id); if (p) setSchedule(p.make()) }

  const noms = nominationStatus(entity) || []

  return (
    <OverlayShell title="Pensions · drill-down"
      subtitle={(() => {
        const pensionCount = (a.sipp?.pensions?.length || 0) + (a.pensions?.length || 0)
        return `${fmt(sippTot)} across ${pensionCount} pension${pensionCount === 1 ? '' : 's'}`
      })()}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Spec §2.3 — three-row IT/CGT/IHT tax-treatment block */}
        <SectionTitle>Tax treatment · Pension wrapper</SectionTitle>
        <TaxTreatmentBlock
          wrapper="PENSION"
          asset={{ type: 'sipp', status: 'uncrystallised' }}
        />

        {/* Drawdown Efficiency Ratio — engine canonical */}
        {(() => {
          let der
          try { der = drawdownEfficiencyRatio(entity) } catch { return null }
          if (!der || der.actual <= 0) return null
          const tone = der.status === 'on-target' ? 'good'
                     : der.status === 'aggressive' || der.status === 'over-drawing' ? 'warn'
                     : 'neutral'
          const toneCol = tone === 'good' ? 'var(--c-acc)'
                        : tone === 'warn' ? '#FFB347'
                        : 'var(--c-text2)'
          return (
            <div style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px solid ${toneCol}55`,
              background: 'var(--card-bg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Drawdown efficiency
                </div>
                <div style={{ fontSize: 13, color: 'var(--c-text)', marginTop: 4 }}>
                  Drawing <strong>{fmt(der.actual)}</strong>/yr vs engine optimal <strong>{fmt(der.optimal)}</strong>/yr — <span style={{ color: toneCol, fontWeight: 700 }}>{der.status.replace('-', ' ')}</span>
                </div>
              </div>
              <div style={{
                fontSize: 22, fontWeight: 880, color: toneCol,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {der.ratio.toFixed(2)}×
              </div>
            </div>
          )
        })()}

        {/* Knowledge-hall context — scheme quality + charges + FSCS cover */}
        <DrillContextStub
          eyebrow="Scheme quality · charges"
          title="What each pension scheme costs, how it's invested, and how it's protected"
          preview={<SchemeQualityStub />}
          bullets={[
            'Annual charge breakdown (platform + fund) per scheme',
            'Default fund glide-path and current allocation',
            'Defaqto rating per provider',
            'FSCS protection limit + spread across providers',
            'Self-select fund universe vs current allocation drift',
          ]}
          askQuestion="What are the real charges on my pensions, and how do my fund choices compare with the default?"
        />

        {/* §4.5.1 Scheme list & nominations */}
        <SectionTitle>1 · Your pensions and who they pay out to</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          Includes <strong>self-invested</strong> <ExplainerChip id="MM-SIPP" size={13} />,
          <strong>final-salary</strong> <ExplainerChip id="MM-DB" size={13} /> and
          <strong>workplace</strong> <ExplainerChip id="MM-WORKPLACE-DC" size={13} /> schemes.
          The "who inherits" line on each row is your <strong>beneficiary nomination</strong> <ExplainerChip id="MM-NOMINATION" size={13} />.
        </div>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          {noms.map((p, i) => {
            const colour = p.status === 'stale' || p.status === 'missing' ? '#FF9500'
              : p.status === 'aging' ? '#FFB347' : '#00E5A8'
            const label = p.status === 'stale' ? `Nomination ${p.ageYears}y out of date — review`
              : p.status === 'missing' ? 'No-one named — pot may fall into your estate'
              : p.status === 'aging' ? `Nomination ${p.ageYears}y old — worth a check`
              : `Nomination up to date (reviewed ${p.ageYears}y ago)`
            return (
              <div key={i} style={{
                padding: '10px 14px',
                borderBottom: i < noms.length - 1 ? '1px solid var(--c-sep)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <WrapperBadge wrapper="PENSION" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                    {fmt(p.value)} · <span style={{ color: colour, fontWeight: 600 }}>{label}</span>
                  </div>
                </div>
                {(p.status === 'stale' || p.status === 'missing') && (
                  <button onClick={() => onCommit?.({
                    type: EV.NOMINATION_REVIEWED,
                    payload: { pensionName: p.name, reviewedDate: new Date().toISOString().slice(0, 10) },
                  })}
                    style={{
                      padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,149,0,0.10)', color: '#FF9500',
                      border: '1px solid rgba(255,149,0,0.35)', cursor: 'pointer',
                    }}>Mark reviewed</button>
                )}
              </div>
            )
          })}
        </div>

        {/* §4.5.2 Annual Allowance & MPAA & Carry Forward */}
        <SectionTitle>2 · How much you can still pay in this year</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          Your <strong>yearly cap</strong> <ExplainerChip id="MM-AA" size={13} />,
          plus any <strong>unused room rolled over</strong> from the last 3 years <ExplainerChip id="MM-CARRY-FWD" size={13} />.
          A <strong>reduced cap</strong> <ExplainerChip id="MM-MPAA" size={13} /> kicks in once you start taking taxable income from a personal pension — and can't be reversed.
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          <MetricTile label="This year's cap" value={fmt(TAX.pensionAA)} sub="2026/27 tax year" colour="#4D8EFF" />
          <MetricTile label="Reduced cap (after drawdown)" value={entity.mpaaTriggered ? fmt(TAX.mpaa ?? 10000) : 'Not triggered'}
            sub={entity.mpaaTriggered ? `Active — locked at ${fmt(TAX.mpaa ?? 10000)}` : 'Full cap still available'} />
          <MetricTile label="Unused room from prior 3 yrs" value={fmt((+entity.carryForward3yr || 0))}
            sub="Carry forward — use before April" colour="#00E5A8" />
        </div>

        {/* §4.5.3 LSA / LSDBA / PCLS */}
        <SectionTitle>3 · How much tax-free cash you can take</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          A <strong>lifetime cap</strong> <ExplainerChip id="MM-LSA" size={13} /> limits how much tax-free cash you can take across all your pensions in your lifetime — currently £268,275.
          A <strong>combined cap</strong> <ExplainerChip id="MM-LSDBA" size={13} /> limits both your tax-free cash AND any lump sums paid to your family when you die — currently £1,073,100.
          When you first access a pension, you can normally take up to <strong>25% tax-free</strong> <ExplainerChip id="MM-PCLS" size={13} />.
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          <MetricTile label="Tax-free cash taken so far" value={fmt(+entity.lsaUsed || 0)} sub={`of £${(TAX.lsa/1000).toFixed(0)}k lifetime cap`} />
          <MetricTile label="Lifetime lump-sum cap used" value={fmt(+entity.lsdbaUsed || 0)} sub={`of £${(TAX.lsdba/1000).toFixed(0)}k incl. death benefits`} />
          <MetricTile label="Tax-free cash still available" value={fmt(Math.min(sippTot * 0.25, TAX.lsa))} sub="up to 25% of your pot" colour="#00E5A8" />
        </div>

        {/* §4.5.4 Drawdown schedule editor */}
        <SectionTitle>4 · How much to take out, year by year</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
        }}>
          You can leave the pot invested and take income as you need it, year by year.
          The four presets below model different approaches:
          <br /><strong>Take nothing</strong> keeps the pot fully invested.
          <br /><strong>Stay in basic-rate band</strong> caps each year's income at £37,700 so nothing tips into higher-rate tax.
          <br /><strong>Safe withdrawal rate</strong> uses the engine's "how much can I take without running out" calculation.
          <br /><strong>Smooth withdrawals</strong> takes more in good market years and trims in bad ones — your pot is more likely to last 10–20 years longer than a fixed amount, but some years your income will drop. <ExplainerChip id="MM-GUYTON-KLINGER" size={13} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {presets.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)} style={{
              padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              background: 'var(--c-surface)', color: 'var(--c-text2)',
              border: '1px solid var(--c-sep)', cursor: 'pointer',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 12,
        }}>
          {schedule.map((row, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderBottom: i < schedule.length - 1 ? '1px solid var(--c-sep)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 56, fontSize: 11, fontWeight: 700,
                color: 'var(--c-text3)', textTransform: 'uppercase',
              }}>Age {row.age}</span>
              <input type="number" min={0} step={500} value={row.amount || 0}
                onChange={e => updateRow(i, { amount: +e.target.value || 0 })}
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 13,
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-sep)', borderRadius: 8,
                  color: 'var(--c-text)',
                }} />
              {schedule.length > 1 && (
                <button onClick={() => removeYear(i)} style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'transparent', border: '1px solid var(--c-sep)',
                  color: 'var(--c-text3)', cursor: 'pointer',
                }}>×</button>
              )}
            </div>
          ))}
          <button onClick={addYear} style={{
            width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
            color: '#4D8EFF', background: 'rgba(77,142,255,0.08)',
            border: 'none', borderTop: '1px solid var(--c-sep)', cursor: 'pointer',
          }}>+ Add next year</button>
        </div>

        {/* §4.5.5 Projected impact */}
        <SectionTitle>5 · What this plan would do</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
        }}>
          Pot value at the end of the schedule, total drawn over those years, and how much inheritance tax this plan saves vs taking nothing.
        </div>
        {/* Sparkline drawn-in via DrawSVG — pension balance over the schedule. */}
        {Array.isArray(series) && series.length > 1 && (() => {
          const W = 320
          const H = 64
          const xs = series.map((_, i) => (i / (series.length - 1)) * W)
          const maxV = Math.max(...series.map(p => +p.balance || 0), 1)
          const minV = Math.min(...series.map(p => +p.balance || 0), 0)
          const span = Math.max(maxV - minV, 1)
          const ys = series.map(p => H - (((+p.balance || 0) - minV) / span) * (H - 4) - 2)
          const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
          return (
            <div className="sw-card" style={{
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-sm)',
              background: 'var(--c-surface2)',
            }}>
              <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Balance trajectory</div>
              <DrawSVG duration={900}>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  height={H}
                  style={{ display: 'block' }}
                  aria-hidden="true"
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="#4D8EFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </DrawSVG>
            </div>
          )
        })()}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricTile label={`Pot value in ${yearsAhead} years`} value={fmt(endValue)} colour="var(--c-text)" />
          <MetricTile label="Total drawn over this period" value={fmt(schedule.reduce((s, r) => s + (r.amount || 0), 0))} colour="#00E5A8" />
          <MetricTile label="Inheritance tax with this plan" value={fmt(ihtWithSchedule)} colour="#FF6B6B" />
          <MetricTile label="Inheritance tax saved" value={ihtDelta > 0 ? fmt(ihtDelta) : '—'} colour="#00E5A8" />
        </div>

        {/* §4.5.6 Commit bar */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button onClick={onBack} style={{
            flex: 1, padding: '13px 0', fontSize: 14, fontWeight: 600,
            background: 'var(--c-surface2)', color: 'var(--c-text2)',
            border: '1px solid var(--c-sep)', borderRadius: 100, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={() => isDirty && onCommit?.(schedule)}
            disabled={!isDirty}
            style={{
              flex: 2, padding: '13px 0', fontSize: 14, fontWeight: 700,
              background: isDirty ? '#00E5A8' : 'var(--c-surface2)',
              color: isDirty ? 'var(--c-bg, #0B1F3A)' : 'var(--c-text3)',
              border: 'none', borderRadius: 100,
              cursor: isDirty ? 'pointer' : 'not-allowed',
            }}>
            {isDirty ? 'Commit DRAWDOWN_SCHEDULE_SET' : 'No changes'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
    </OverlayShell>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §12B PRIORITY CARDS (Phase 2C) — replaces 5-tile StateTileRow with
//      2-3 dynamic cards showing only what needs attention.
//      Each card includes a BulletChart micro-chart (Phase 3C).
// ═════════════════════════════════════════════════════════════════════════════

// Phase 3C — Bullet micro-chart.
// Shows % of target with colour zones (red/amber/green).
// No status text — the parent card's badge already carries that signal;
// duplicating it with different thresholds caused contradictions (e.g.
// "Watch" badge + "Healthy" bullet for Emergency cover at 5.7/6 months).
function BulletChart({ pct = 0 }) {
  const safe = Math.min(Math.max(pct, 0), 100)
  const zone = safe < 30 ? 'var(--c-coral, #FF6F7D)' : safe < 70 ? '#FFB347' : 'var(--c-acc)'
  return (
    <div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--c-surface2)', position: 'relative', overflow: 'hidden' }}>
        {/* Zone bands (faint colour guide: red 0–30 / amber 30–70 / green 70–100) */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.12 }}>
          <div style={{ width: '30%', background: 'var(--c-coral, #FF6F7D)' }} />
          <div style={{ width: '40%', background: '#FFB347' }} />
          <div style={{ flex: 1, background: 'var(--c-acc)' }} />
        </div>
        {/* Current value */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${safe}%`, background: zone, borderRadius: 3,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ textAlign: 'right', marginTop: 2 }}>
        <span style={{ fontSize: 8, color: 'var(--c-text3)' }}>{safe.toFixed(0)}% of target</span>
      </div>
    </div>
  )
}

function PriorityCards({ entity, onNav, setDrillPension }) {
  const [openId, setOpenId] = useState(null)

  const a    = entity.assets || {}
  const liab = entity.liabilities || {}
  const target = +entity.targetIncome || 0
  const cash   = +(a.cash?.total || a.cash?.value || 0)
  const monthlySpend = target / 12

  // Emergency cover
  // C-02: when targetIncome=0, monthlySpend=0 → exclude safety tile rather than show wrong copy
  const months     = monthlySpend > 0 ? cash / monthlySpend : null
  const safetyBand = months == null ? null : months >= 6 ? 'good' : months >= 3 ? 'warn' : 'bad'
  const safetyPct  = months != null ? Math.min((months / 6) * 100, 100) : 0

  // Debt
  const mortgage   = liab.mortgage || {}
  const otherLoans = liab.otherLoans || []
  const totalDebt  = (mortgage.outstanding || 0)
    + otherLoans.reduce((s, l) => s + +(l.outstanding || l.outstanding_balance || 0), 0)
  const monthlyDebt = (mortgage.monthlyPayment || 0)
    + otherLoans.reduce((s, l) => s + +(l.monthlyPayment || 0), 0)
  const debtYears  = monthlyDebt > 0 ? totalDebt / (monthlyDebt * 12) : null
  // C-03: no payment data + debt present → 'warn', not 'good'
  const debtBand   = totalDebt === 0 ? 'good'
    : debtYears == null ? 'warn'
    : debtYears < 5 ? 'good' : debtYears < 15 ? 'warn' : 'bad'
  const debtPct    = totalDebt === 0 ? 100
    : debtYears == null ? 0
    : Math.max(0, 100 - Math.min((debtYears / 25) * 100, 100))

  // Retirement
  const inv     = investable(entity)
  const fiTarget = target * 25
  const fiRat_  = fiTarget > 0 ? inv / fiTarget : 0
  const fiBand  = fiRat_ >= 1 ? 'good' : fiRat_ >= 0.3 ? 'warn' : 'bad'
  const fiPct   = Math.min(fiRat_ * 100, 100)

  // Estate
  let ebr = { rate: 1, ihtDue: 0 }
  try { ebr = effectiveBeneficiaryRate(entity) || ebr } catch {}
  const benBand = ebr.rate >= 0.8 ? 'good' : ebr.rate >= 0.5 ? 'warn' : 'bad'
  const benPct  = Math.min((ebr.rate || 0) * 100, 100)

  // Tax shelters
  let tax = { total: 0, breakdown: { isa: 0, aa: 0 } }
  try { tax = taxEfficiencyScore(entity) || tax } catch {}
  const taxBand = tax.total >= 80 ? 'good' : tax.total >= 40 ? 'warn' : 'bad'

  const allTiles = [
    // C-02: only include safety tile when we have spend data to compute months
    ...(safetyBand != null ? [{
      id: 'safety', icon: '🛡', label: 'Emergency cover',
      value: `${months.toFixed(1)} mo`,
      sub: `${fmt(cash)} in cash · target: 6 months`,
      band: safetyBand, pct: safetyPct,
      action: months < 3
        ? `Build to ${fmt(monthlySpend * 3)} in easy-access cash (Cash ISA or savings). That's 3 months of essential spending.`
        : `One more month (${fmt(monthlySpend)}) reaches the 6-month buffer.`,
    }] : []),
    {
      id: 'debt', icon: '⚖', label: 'Debt burden',
      value: totalDebt === 0 ? 'Clear' : fmt(totalDebt),
      sub: totalDebt === 0 ? 'No liabilities on record'
        : debtYears == null ? 'No payment schedule — review needed'
        : `Clears in ${debtYears.toFixed(0)} yr`,
      band: debtBand, pct: debtPct,
      action: debtYears == null
        ? `Add monthly payment details to your liabilities so we can calculate payoff time and cost. Verify with an adviser.`
        : debtYears > 20
          ? `Overpaying by £100/month can shave years off the term — check your ERC-free allowance (typically 10%/yr). Verify with an adviser.`
          : `Focus surplus on pensions and ISAs before early repayment — tax relief usually wins. Verify with an adviser.`,
    },
    {
      id: 'fi', icon: '🎯', label: 'Retirement funded',
      value: fiTarget > 0 ? `${Math.round(fiRat_ * 100)}%` : '—',
      sub: fiTarget > 0 ? `Target: ${fmt(fiTarget)} (25× income)` : 'Set a target annual income',
      band: fiBand, pct: fiPct,
      action: fiRat_ < 0.3
        ? `Options include: maximising pension contributions — typically the highest-return action, since £1 costs only 60p after 40% tax relief. Verify with an adviser.`
        : `Consider checking carry-forward pension allowance from the past 3 years — this can unlock more than the standard annual cap. Verify with an adviser.`,
    },
    {
      id: 'estate', icon: '🏛', label: 'Estate efficiency',
      value: `${Math.round((ebr.rate || 0) * 100)}p/£`,
      sub: ebr.ihtDue > 0 ? `${fmt(ebr.ihtDue)} IHT due` : 'No IHT liability',
      band: benBand, pct: benPct,
      action: ebr.ihtDue > 0
        ? `Consider: nominating pension beneficiaries, putting life cover in trust, or using the £3k annual gift allowance — all potentially IHT-free. Verify with an adviser.`
        : `Review nominations annually and after any life change (marriage, divorce, new child).`,
    },
    {
      id: 'tax', icon: '📊', label: 'Tax shelter usage',
      value: `${tax.total || 0}%`,
      sub: `ISA ${tax.breakdown?.isa || 0}% used · Pension ${tax.breakdown?.aa || 0}% used`,
      band: taxBand, pct: Math.min(tax.total || 0, 100),
      action: (tax.total || 0) < 40
        ? `Significant unused capacity. Max ISA (£20k) then pension — allowances reset every April. Verify with an adviser.`
        : `Check carry-forward pension allowance from the past 3 years to unlock extra shelter. Verify with an adviser.`,
    },
  ]

  const needAttention = allTiles.filter(t => t.band !== 'good')
  const shown = needAttention.slice(0, 3)
  const healthyCount = allTiles.filter(t => t.band === 'good').length
  const hiddenBadCount = Math.max(0, needAttention.length - 3)

  if (needAttention.length === 0) {
    return (
      <FadeInOnMount delay={80} style={{ marginBottom: 12 }}>
        <div style={{
          background: 'color-mix(in srgb, var(--c-acc) 6%, var(--c-surface))',
          border: '1px solid color-mix(in srgb, var(--c-acc) 20%, var(--c-border))',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>✓</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-acc)' }}>All five metrics are healthy</div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
              Emergency cover · Debt · Retirement · Estate · Tax shelters — all green.
            </div>
          </div>
        </div>
      </FadeInOnMount>
    )
  }

  return (
    <FadeInOnMount delay={80} style={{ marginBottom: 12 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Needs your attention</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(t => {
          const colour = t.band === 'bad'
            ? 'var(--c-coral, #FF6F7D)'
            : t.band === 'warn' ? '#FFB347' : 'var(--c-acc)'
          const isOpen = openId === t.id
          return (
            <button
              key={t.id}
              onClick={() => setOpenId(isOpen ? null : t.id)}
              style={{
                background: `color-mix(in srgb, ${colour} 6%, var(--c-surface))`,
                border: `1px solid color-mix(in srgb, ${colour} 25%, var(--c-border))`,
                borderRadius: 12, padding: '12px 14px',
                textAlign: 'left', cursor: 'pointer', width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>{t.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 100,
                      background: `color-mix(in srgb, ${colour} 15%, var(--c-surface2))`,
                      color: colour, letterSpacing: 0.4,
                    }}>{t.band === 'bad' ? 'Act now' : 'Watch'}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{t.sub}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: colour, flexShrink: 0 }}>{t.value}</div>
              </div>
              <BulletChart pct={t.pct} />
              {isOpen && (
                <div style={{
                  marginTop: 10, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
                  paddingTop: 10,
                  borderTop: `1px solid color-mix(in srgb, ${colour} 15%, var(--c-sep))`,
                }}>
                  {t.action}
                  <div style={{ marginTop: 8 }}>
                    {(t.id === 'fi') && (
                      <button onClick={(e) => { e.stopPropagation(); setDrillPension?.(true) }} style={{
                        fontSize: 11, fontWeight: 700, color: colour,
                        background: `color-mix(in srgb, ${colour} 10%, var(--c-surface))`,
                        border: `1px solid color-mix(in srgb, ${colour} 25%, var(--c-border))`,
                        borderRadius: 100, padding: '4px 10px', cursor: 'pointer',
                      }}>View pension →</button>
                    )}
                    {(t.id === 'estate') && (
                      <button onClick={(e) => { e.stopPropagation(); onNav?.('tax') }} style={{
                        fontSize: 11, fontWeight: 700, color: colour,
                        background: `color-mix(in srgb, ${colour} 10%, var(--c-surface))`,
                        border: `1px solid color-mix(in srgb, ${colour} 25%, var(--c-border))`,
                        borderRadius: 100, padding: '4px 10px', cursor: 'pointer',
                      }}>Go to Tax & Estate →</button>
                    )}
                    {(t.id === 'tax') && (
                      <button onClick={(e) => { e.stopPropagation(); onNav?.('flow') }} style={{
                        fontSize: 11, fontWeight: 700, color: colour,
                        background: `color-mix(in srgb, ${colour} 10%, var(--c-surface))`,
                        border: `1px solid color-mix(in srgb, ${colour} 25%, var(--c-border))`,
                        borderRadius: 100, padding: '4px 10px', cursor: 'pointer',
                      }}>Go to Cashflow →</button>
                    )}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
      {/* H-03: show hidden bad count so user knows more exist beyond the 3 shown */}
      {hiddenBadCount > 0 && (
        <div style={{ fontSize: 10, color: '#FFB347', marginTop: 6, textAlign: 'center', fontWeight: 700 }}>
          + {hiddenBadCount} more metric{hiddenBadCount !== 1 ? 's' : ''} also need attention
        </div>
      )}
      {healthyCount > 0 && hiddenBadCount === 0 && (
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, textAlign: 'center' }}>
          {healthyCount} other metric{healthyCount !== 1 ? 's' : ''} {healthyCount !== 1 ? 'are' : 'is'} healthy
        </div>
      )}
    </FadeInOnMount>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §12C DECUMULATION PANEL (Phase 4E) — GIA → ISA → Pension sequencing
// ═════════════════════════════════════════════════════════════════════════════

function DecumulationPanel({ entity, setDrillPension }) {
  const inv = investable(entity)
  // N-03 fix: don't render an orphan "Which pot to draw from first" header
  // with no body. When the user has < £10k investable, swap the full panel
  // for a placeholder body with a CTA — keeps the section visible (so the
  // surrounding SectionDelimiter / "Balance sheet" rhythm stays consistent)
  // but signals honestly that there's nothing to sequence yet.
  if (inv < 10000) {
    return (
      <RevealCard cardId="decumulation-sequence-empty"
        title="Which pot to draw from first"
        defaultOpen={false}
        headerAccessory={
          <button
            onClick={() => setDrillPension(true)}
            style={{
              fontSize: 11, color: 'var(--c-acc)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Set up your drawdown plan →
          </button>
        }>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, padding: '4px 0' }}>
          You need investable assets across GIA, ISA and pension before
          we can sequence withdrawals. Add a savings or investment account
          to unlock this panel — once you have £10k+ across taxable, tax-free
          and pension wrappers we'll show you the order to draw from to
          minimise lifetime tax.
        </div>
      </RevealCard>
    )
  }

  const dob = entity?.individual?.dob || entity?.personal?.dob
  // M-05: prefer entity.age as fallback before hardcoded 47
  const age  = dob ? calcAge(dob) : (entity?.age || entity?.individual?.age || null)
  const yearsToRetire = age != null ? Math.max(0, 67 - age) : null

  const a = entity.assets || {}

  const giaValue = (a.investments || [])
    .filter(x => !['isa', 'pension', 'sipp'].some(t => (x.wrapper || x.type || '').toLowerCase().includes(t)))
    .reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
  const isaValue = +(a.isa?.value || 0)
    + (a.investments || [])
      .filter(x => (x.type || '').toLowerCase().includes('isa'))
      .reduce((s, x) => s + +(x.value || 0), 0)
  const pensionValue = (a.pensions || [])
    .reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)
    + +(a.sipp?.value || 0)

  const sequences = [
    { order: 1, pot: 'GIA (taxable account)', value: giaValue, color: '#C58CFF',
      taxNote: 'CGT on gains — 18% basic rate / 24% higher rate. Draw first to exit the taxable wrapper soonest.' },
    { order: 2, pot: 'ISA (tax-free)', value: isaValue, color: '#2DF2C3',
      taxNote: 'Zero tax on withdrawal, ever. Keep sheltered until GIA is cleared.' },
    { order: 3, pot: 'SIPP / Pension', value: pensionValue, color: '#7AA7FF',
      taxNote: '25% tax-free lump sum, then 75% taxed as income. Draw last — grows tax-free longest.' },
  ]

  return (
    <RevealCard cardId="decumulation-sequence"
      title="Which pot to draw from first"
      defaultOpen={false}
      headerAccessory={
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          {yearsToRetire == null ? 'Age unknown' : yearsToRetire > 0 ? `${yearsToRetire} yr to retirement` : 'At retirement age'}
        </span>
      }>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 12 }}>
        The sequence you draw from these pots determines your tax bill in retirement.
        The optimal order for most people: GIA first → ISA second → Pension last.
      </div>
      {sequences.map((s, i) => (
        <div key={s.pot} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
          borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: s.value > 0 ? s.color : 'var(--c-surface2)',
            color: s.value > 0 ? 'var(--c-bg, #051424)' : 'var(--c-text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, marginTop: 1,
          }}>{s.order}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: s.value > 0 ? s.color : 'var(--c-text3)' }}>
                {s.pot}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                background: `color-mix(in srgb, ${s.color} 15%, var(--c-surface2))`,
                color: s.color,
              }}>
                {s.value > 0 ? fmt(s.value) : 'None held'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.45 }}>{s.taxNote}</div>
          </div>
        </div>
      ))}
      {inv > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'var(--c-surface2)', fontSize: 11, color: 'var(--c-text2)',
        }}>
          Total investable: {fmt(inv)} · At 4% safe withdrawal: {fmt(Math.round(inv * 0.04 / 1000) * 1000)}/yr
        </div>
      )}
    </RevealCard>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// §13 MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════

export default function MyMoney({ entity, personaId, onCommit, onHome, onOpenRisk, onDrillMetric, onNav }) {
  const [drillPension, setDrillPension] = useState(false)
  // Per-category drill state — only one open at a time
  const [drillCat, setDrillCat] = useState(null) // 'investments' | 'property' | 'business' | 'protection' | 'liabilities' | null
  // Pivot view (item 7) — Balance Sheet / Income / Insurance / Bonds
  const [pivot, setPivot] = useState('balance-sheet')
  const [addOpen, setAddOpen] = useState(false)
  const [windowId, setWindowId] = useState('current-period')
  const [viewMode, setViewMode] = useState('actual')
  // scenarioEntity: set by WhatIfLibrary when the user expands a scenario card.
  // PivotView uses activeEntity = scenarioEntity ?? entity so pivot views
  // reflect scenario numbers while a card is expanded.
  const [scenarioEntity, setScenarioEntity] = useState(null)
  const [filterWrapper, setFilterWrapper] = useState(null)
  // Phase 2 follow-up — bucket-style add flow + category opened for it.
  const [bucketOpen, setBucketOpen] = useState(false)
  const [bucketCat, setBucketCat] = useState(null)
  function openBucket(cat) { setBucketCat(cat); setBucketOpen(true) }

  // Triple anchor + delta chips. calcFQ is canonical per Home v1.4 §Q1.2 —
  // calcFQCalibrated drifted from Home's score and caused tab-to-tab divergence.
  const nw = netWorth(entity)
  const fq = calcFQ(entity)
  const risk = calcRisk(entity)
  const fqBandObj = fqBand(fq.total)
  // N-02 fix: unify the verbal anchor across the two co-rendered scores so
  // "71 / Optimised" and "78 / Protected" use the same vocabulary. We map
  // the risk band's score-bucket onto the fqBand() label set — same colour
  // semantic, same vocabulary. Without this the user can't compare them
  // ("is 71 Optimised better or worse than 78 Protected?").
  //   <20 Exposed · <40 Building · <60 Established · <80 Optimised · ≥80 Exceptional
  const rawRiskBand = riskBand(risk.total)
  const rkBandObj = { ...rawRiskBand, name: fqBand(risk.total).name }

  // X28 window-driven projection. The hero shows "as at [window]" when the
  // selected window has a non-zero horizon — spec §3.2.
  const currentWindow = TIME_WINDOWS.find(w => w.id === windowId) || TIME_WINDOWS[0]
  const windowYears = +currentWindow.years || 0
  const projection = windowYears === 0
    ? { value: nw, confidence: 'HIGH', source: 'current', years: 0 }
    : netWorthAtWindow(entity, windowYears)
  const isProjected = projection.years !== 0

  // Asset rows by domain (memoised)
  const dRows = useMemo(() => ({
    A: rowsForPensions(entity),
    C: rowsForISAs(entity),
    D: rowsForGIA(entity),
    E_EIS:  rowsForByWrapper(entity, 'EIS'),
    E_SEIS: rowsForByWrapper(entity, 'SEIS'),
    E_VCT:  rowsForByWrapper(entity, 'VCT'),
    F_ON:   rowsForByWrapper(entity, 'BOND_ON'),
    F_OFF:  rowsForByWrapper(entity, 'BOND_OFF'),
    G:      rowsForProperty(entity),
    H:      rowsForBPR(entity),
    I:      rowsForEmployeeShare(entity),
    J:      rowsForProtection(entity),
    K:      rowsForGeneralInsurance(entity),
    L:      rowsForBusinessInsurance(entity),
    M:      rowsForCash(entity),
    N:      rowsForLiabilities(entity),
    U:      rowsForAlternatives(entity),
    V:      rowsForFamilyObligations(entity),
    W:      rowsForStateBenefits(entity),
    X:      rowsForDirector(entity),
  }), [entity])

  function applyFilter(rows) {
    if (!filterWrapper) return rows
    return rows.filter(r => r.wrapper === filterWrapper)
  }

  // H-07: totalAssets/totalLiab were computed here but never used (TileGrid uses its own subtotals). Removed.

  // Plan staleness
  const stalePlans = []
  try {
    const types = ['retirement', 'tax', 'estate', 'protection']
    for (const t of types) {
      const ps = planStaleness(entity, t)
      if (ps?.isCritical) stalePlans.push({ ...ps, type: t })
    }
  } catch { /* engine may not yet implement — silent */ }

  // CoI
  const coi = useMemo(() => totalCoI(entity), [entity])
  const dailyAccrual = Math.round(coi.total / Math.max(coi.daysToImpact || 365, 1))

  // Phase 2B — deficit user flag: cash flow becomes the lead anchor
  // H-01: strict < 0 so surplus=0 (exactly balanced) is not treated as deficit
  const isDeficit = (() => {
    try { const ms = monthlySurplus(entity); return (ms.surplus || 0) - (ms.deficit || 0) < 0 } catch { return false }
  })()

  // ── ACTIONS ─────────────────────────────────────────────────────────────
  function handleCommitSchedule(schedule) {
    onCommit?.({
      type: EV.DRAWDOWN_SCHEDULE_SET,
      ts: Date.now(),
      correlation_id: `mm-dd-${Date.now()}`,
      payload: { schedule },
    })
    setDrillPension(false)
  }
  function handleAssetCommit(event) {
    onCommit?.(event)
  }
  function handleNominationEvent(event) {
    onCommit?.(event)
  }

  return (
    <div className="screen">
      {/* ── X28 top-bar: 7 windows + 4 view modes + rules chip ───────────── */}
      <div style={{ margin: '0 -16px' }}>
        <X28TopBar
          window={windowId}
          viewMode={viewMode}
          onWindowChange={setWindowId}
          onViewModeChange={(m) => { setViewMode(m); if (m !== 'scenario') setScenarioEntity(null) }}
          rulesVersion={BRAND.rulesVersion}
          dataDate={BRAND.dataDate}
        />
      </div>

      {/* ── Header strip with home + view-mode hint ──────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0 4px',
      }}>
        <button onClick={onHome} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Home
        </button>
        {viewMode !== 'actual' && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px',
            borderRadius: 100, background: 'rgba(255,179,71,0.10)',
            color: '#FFB347', letterSpacing: 0.4,
          }}>
            {viewMode.toUpperCase()} · variance overlay active
          </span>
        )}
      </div>

      {/* ── Plan staleness banners ─────────────────────────────────────────
          S-02 fix: wire onReview to Timeline (where plans live). When a plan
          surfaces a planId we pass it via URL hash so Timeline can deep-link
          to that plan; otherwise we just land on Timeline. onNav is the
          App-level router prop. */}
      <PlanStalenessBanner
        plans={stalePlans}
        onReview={(plan) => {
          const planId = plan?.planId || plan?.id || plan?.type
          if (typeof onNav === 'function') {
            onNav('timeline', planId ? { planId } : undefined)
          } else if (typeof window !== 'undefined') {
            // Fallback when wired without onNav — preserves the affordance.
            window.location.hash = planId ? `#timeline?plan=${planId}` : '#timeline'
          }
        }}
      />

      {/* ── Screen purpose (X25) ─────────────────────────────────────────────
          Canonical from 2-Product-mymoney-v2_7.md §1.1. Every primary tab
          must surface its reason for being in one user-facing sentence at
          the top — not buried in a header, not phrased as a brand line.   */}
      <div style={{
        marginBottom: 'var(--space-md, 16px)',
        display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
          letterSpacing: 0.8, textTransform: 'uppercase',
        }}>
          MyMoney
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>·</span>
        <span style={{
          fontSize: 13, color: 'var(--c-text2)', fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          What do I own, what do I owe, and what comes in?
        </span>
      </div>

      {/* ── X28 view-mode aware container ──────────────────────────────────
           Re-keying on viewMode triggers the sw-tab-slide cinema cascade so
           switching Today / Future / Plan / What-if feels deliberate. Uses
           display:contents so the wrapper doesn't introduce a layout box. */}
      <div key={viewMode} className="sw-tab-slide" style={{ display: 'contents' }}>

      {/* ── What-If scenario library (viewMode === 'scenario') ───────────────
           Replaces the main content when the user selects the "What if" mode
           pill in X28TopBar. All other modes fall through to the normal view. */}
      {viewMode === 'scenario' && (
        <WhatIfLibrary entity={entity} onScenarioSelect={setScenarioEntity} />
      )}
      {viewMode === 'scenario' ? null : <>

      {/* Phase 2A — Net position sentence: one plain-English verdict per session */}
      {(() => {
        const m = monthlySurplus(entity)
        const surplus = m.surplus || -(m.deficit || 0)
        const pos = surplus >= 0
        const cashLiquid = +(entity?.assets?.cash?.total || entity?.assets?.cash?.value || 0)
        const monthsRunway = !pos && cashLiquid > 0 ? cashLiquid / Math.abs(surplus) : null
        const fiRat_ = (() => {
          try {
            const inv_ = investable(entity)
            const tgt_ = (entity?.targetIncome || 0) * 25
            return tgt_ > 0 ? inv_ / tgt_ : null
          } catch { return null }
        })()

        // Generate one sentence from the most urgent signal
        let urgentSignal = null
        let supportingSignal = null

        // N-01 fix: if there's a NW gain visible below the banner, the deficit
        // copy needs a bridge clause — otherwise "spending £552 more" and
        // "↑£5k assets grew" read as a contradiction. Compute the MoM NW
        // delta here so we can fold the bridge into the urgent sentence.
        const traj_ = entity?.trajectories?.netWorthHistory
        const nwMoM_ = (Array.isArray(traj_) && traj_.length >= 2)
          ? (+(traj_[traj_.length - 1]?.value || 0)) - (+(traj_[traj_.length - 2]?.value || 0))
          : null
        const bridgeClause = (!pos && nwMoM_ != null && nwMoM_ > 0)
          ? ` — but markets and contributions added ${fmt(nwMoM_)} so net worth still rose this month`
          : ''

        if (!pos && monthsRunway != null && monthsRunway < 3) {
          urgentSignal = `You're spending ${fmt(Math.abs(surplus))} more than you earn — liquid cash covers only ${monthsRunway.toFixed(1)} months.`
          supportingSignal = fqBandObj?.name === 'Optimised' ? 'Your overall financial health is strong, but cash flow needs immediate attention.' : null
        } else if (!pos) {
          urgentSignal = `You're spending ${fmt(Math.abs(surplus))} more than you earn each month${bridgeClause}.`
          supportingSignal = fiRat_ != null && fiRat_ < 0.5 ? `Your retirement is also ${Math.round(fiRat_ * 100)}% funded — both need attention.` : `Your wealth is still growing — but this needs fixing before it compounds.`
        } else if (fiRat_ != null && fiRat_ < 0.3) {
          urgentSignal = `You're saving ${fmt(surplus)}/month — good. But your retirement is only ${Math.round(fiRat_ * 100)}% funded.`
          supportingSignal = 'Options include directing surplus to a pension — 40% tax relief means every £1 could be worth £1.67. Verify with an adviser.'
        } else {
          urgentSignal = `You have ${fmt(surplus)}/month surplus and ${fqBandObj?.name?.toLowerCase() || 'solid'} overall financial health.`
          supportingSignal = 'Review the opportunities below to compound this further.'
        }

        return (
          <FadeInOnMount style={{ marginBottom: 10 }}>
            <div style={{
              background: !pos ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 6%, var(--c-surface))' : 'var(--c-surface)',
              border: `1px solid ${!pos ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 25%, var(--c-border))' : 'var(--c-border)'}`,
              borderRadius: 14, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.4, marginBottom: supportingSignal ? 4 : 0 }}>
                {urgentSignal}
              </div>
              {supportingSignal && (
                <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4 }}>{supportingSignal}</div>
              )}
            </div>
          </FadeInOnMount>
        )
      })()}

      {/* Phase 2B — For deficit users, cash flow is the lead signal; show before the anchor */}
      {isDeficit && <SurplusTile entity={entity} />}

      {/* ── Triple anchor (D-ANCHOR-1: triple, with X29 delta chips) ─────── */}
      <FadeInOnMount style={{ margin: '4px -16px 12px' }}>
        <TripleAnchor
          netWorthVal={nw}
          fqTotal={fq.total}
          fqBand={fqBandObj}
          riskTotal={risk.total}
          riskBand={rkBandObj}
          nwTrendPct={(() => {
            const traj = entity?.trajectories?.netWorthHistory
            if (!Array.isArray(traj) || traj.length < 2) return null
            const last = +(traj[traj.length - 1]?.value || 0)
            const prev = +(traj[traj.length - 2]?.value || 0)
            return prev > 0 ? ((last - prev) / prev) * 100 : null
          })()}
          onNetWorthTap={() => onDrillMetric?.('netWorth')}
          onWealthTap={() => onDrillMetric?.('wealthScore')}
          onRiskTap={onOpenRisk}
        />
        {/* Delta chips — ONE source of truth: trajectory[last] − trajectory[prev].
            M-04 / M-05 fix: previously fell back to `entity.quarterlyDelta`
            when trajectory was short, which silently swapped a quarterly
            number into a "monthly change" chip — producing the "+£5.5k
            header / +£11k waterfall" contradiction. If we don't have ≥2
            monthly trajectory points, we render nothing rather than a
            wrong-cadence number. */}
        {(() => {
          const traj = entity?.trajectories?.netWorthHistory
          if (!Array.isArray(traj) || traj.length < 2) return null
          const last = +(traj[traj.length - 1]?.value || 0)
          const prev = +(traj[traj.length - 2]?.value || 0)
          const nwDelta = last - prev
          if (!nwDelta) return null
          return (
            <div style={{
              display: 'flex', justifyContent: 'center', marginTop: 6,
              padding: '0 16px', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <DeltaChip delta={nwDelta} format="currency" />
              <div style={{ fontSize: 9, color: 'var(--c-text3)', letterSpacing: 0.3 }}>
                net worth change vs last month
              </div>
            </div>
          )
        })()}
        <VarianceBadge entity={entity} mode1="actual" mode2={viewMode} window={windowId} metric="netWorth" />
      </FadeInOnMount>

      {/* ── How your money is held (was: Wrapper composition) — row 2 ────────
           Moved above state tiles per founder direction 2026-05-15:
           "it should be 2nd row before safety net". Renamed to plain English.
           Filter: tap any wrapper segment to filter the tile grid below. */}
      <FadeInOnMount delay={60} className="sw-card">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 'var(--space-sm)',
        }}>
          <span className="sw-eyebrow" style={{ flex: 1 }}>
            How your money is held
          </span>
          <ExplainerChip id="MM-2" />
        </div>
        <WrapperCompositionBar
          entity={entity}
          onSegmentTap={setFilterWrapper}
          activeWrapper={filterWrapper}
          onAddWrapperDetails={() => setAddOpen(true)}
        />
        {filterWrapper && (
          <button onClick={() => setFilterWrapper(null)}
            className="sw-chip sw-press"
            style={{ border: '1px solid var(--c-sep)', cursor: 'pointer' }}>
            Showing {filterWrapper} only — clear ×
          </button>
        )}
      </FadeInOnMount>

      {/* Phase 1D — ANI cliff-edge warning (£100k taper threshold) */}
      <CliffEdgeWarning entity={entity} />

      {/* Phase 2C — Priority cards: only show what needs attention (replaces 5-tile StateTileRow) */}
      <PriorityCards entity={entity} onNav={onNav} setDrillPension={setDrillPension} />

      {/* ── Surplus tile (§3.6) — surplus users only; deficit users see it above the anchor ── */}
      {!isDeficit && <SurplusTile entity={entity} />}

      {/* Today's Move REMOVED from MyMoney 2026-05-15 — it duplicates the
          Priority Actions on the Home screen. MyMoney is a balance sheet,
          not an action panel. Actions live on Home. */}

      {/* Phase 1F — Aggregate CoI ranking: all cost-of-inaction items ranked by £ size.
          M-06 fix: aggregate "Total est." comes from the canonical engine
          (`totalCoI(entity).total`) — not from regex-parsing the plain-English
          per-domain sentences. The previous regex grabbed the FIRST £ figure
          in each sentence, which could be e.g. "£3k allowance" rather than
          the actual cost — producing an aggregate off by orders of magnitude.
          Per-row ranking still uses regex extraction (used only for ordering;
          the displayed string is the engine's copy). */}
      {(() => {
        const domains = ['pensions', 'investments', 'property', 'business', 'protection', 'cash', 'liabilities', 'alternatives', 'obligations']
        const ranked = domains.map(id => {
          const text = coiForDomain(entity, id)
          if (!text) return null
          // Use engine numeric byDomain value for sort — matches Home's totalCoI().byDomain
          const value = coi?.byDomain?.[id] ?? 0
          return { id, text, value }
        }).filter(Boolean).sort((a, b) => b.value - a.value)

        if (!ranked.length) return null
        // Canonical aggregate from the engine. `coi` is memoised at top of
        // MyMoney via `useMemo(() => totalCoI(entity), [entity])`.
        const totalCoIEst = +(coi?.total) || 0
        return (
          <FadeInOnMount delay={60} style={{ marginBottom: 12 }}>
            <div style={{
              background: 'color-mix(in srgb, var(--c-coral, #FF6F7D) 6%, var(--c-surface))',
              border: '1px solid color-mix(in srgb, var(--c-coral, #FF6F7D) 25%, var(--c-border))',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Cost of doing nothing
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>
                    Ranked by annual cost — act on the top item first
                  </div>
                </div>
                {totalCoIEst > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Total est.</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-coral, #FF6F7D)' }}>{fmt(totalCoIEst)}/yr</div>
                  </div>
                )}
              </div>
              {ranked.slice(0, 4).map((r, i) => {
                const handleCoIRowClick = () => {
                  if (r.id === 'pensions') setDrillPension(true)
                  else if (r.id === 'investments' || r.id === 'cash' || r.id === 'alternatives') setDrillCat('investments')
                  else if (r.id === 'property') setDrillCat('property')
                  else if (r.id === 'business') setDrillCat('business')
                  else if (r.id === 'protection') setDrillCat('protection')
                  else if (r.id === 'liabilities') setDrillCat('liabilities')
                  else if (r.id === 'obligations') onNav?.('flow')
                }
                return (
                  <button key={r.id} onClick={handleCoIRowClick} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '7px 0', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderTop: i > 0 ? '1px solid color-mix(in srgb, var(--c-coral, #FF6F7D) 12%, var(--c-sep))' : 'none',
                  }}>
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: '50%',
                      background: i === 0 ? 'var(--c-coral, #FF6F7D)' : 'var(--c-surface2)',
                      color: i === 0 ? '#fff' : 'var(--c-text3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</span>
                    <div style={{ fontSize: 11, color: i === 0 ? 'var(--c-text)' : 'var(--c-text2)', lineHeight: 1.45, flex: 1 }}>
                      {r.text}
                    </div>
                  </button>
                )
              })}
            </div>
          </FadeInOnMount>
        )
      })()}

      {/* Phase 4E — Decumulation sequencing: GIA → ISA → Pension order */}
      <DecumulationPanel entity={entity} setDrillPension={setDrillPension} />

      {/* §C — Balance Sheet / Financial Picture header. */}
      <SectionDelimiter
        eyebrow="Your financial picture"
        title="Balance sheet"
        sub="Tap any tile to drill into it · tap + Add to capture new items"
      />
      {/* Pivot toggle (item 7) — Balance Sheet / Income / Insurance / Bonds.
          Each pivot is a different aggregation of the same entity. */}
      <PivotToggle pivot={pivot} onPivot={setPivot} />
      {pivot !== 'balance-sheet' && (
        <PivotView pivot={pivot} entity={entity} scenarioEntity={scenarioEntity || null} />
      )}
      {pivot === 'balance-sheet' && (() => {
        // Derive per-category row collections from existing dRows builders.
        const isDirector = hasPersonaFlag(entity, 'director')
        const catRows = {
          pensions:     applyFilter(dRows.A),
          investments:  [...applyFilter(dRows.C), ...applyFilter(dRows.D),
                         // M-07: apply wrapper filter to EIS/SEIS/VCT/Bond rows too
                         ...applyFilter(dRows.E_EIS), ...applyFilter(dRows.E_SEIS), ...applyFilter(dRows.E_VCT),
                         ...applyFilter(dRows.F_ON), ...applyFilter(dRows.F_OFF)],
          property:     applyFilter(dRows.G),
          business:     [...dRows.H, ...dRows.I, ...(isDirector ? dRows.X : [])],
          protection:   [...dRows.J, ...dRows.K, ...dRows.L],
          cash:         applyFilter(dRows.M),
          liabilities:  dRows.N,
          alternatives: dRows.U,
          obligations:  dRows.V,
        }
        // Income is a flow, not a balance — kept here only because some
        // downstream components (e.g. monthlyEssentials fallback) need an
        // annual income proxy. C-09 fix: income is NOT folded into the
        // balance-sheet subtotals object below, and the "Income (flow)"
        // tile in CATEGORIES no longer carries a subtotal (it had none —
        // its tile renders the empty state and links to Cashflow).
        const income = entity?.income || {}
        const incomeAnnual = (+income.employment || 0) + (+income.directorSalary || 0)
                           + (+income.dividends || 0) + (+income.directorDividends || 0)
                           + (+income.rentalIncomeNet || +income.rentalIncome || 0)
                           + (+income.interest || 0)
                           + (+income.statePension?.annual || 0)
        // Sum per category for the BalanceSheet header. Excludes Income +
        // State Pension entitlement (Domain W) — both are flows.
        const sumRows = (arr) => (arr || []).reduce((s, r) => s + (+r.value || 0), 0)
        const subtotals = {
          pensions:        sumRows(catRows.pensions),
          investments:     sumRows(catRows.investments),
          property:        sumRows(catRows.property),
          business:        sumRows(catRows.business),
          'protection-sv': 0,  // surrender values only — not modelled at line-item level yet
          cash:            sumRows(catRows.cash),
          alternatives:    sumRows(catRows.alternatives),
          liabilities:     sumRows(catRows.liabilities),
          // C-09 fix: income deliberately excluded from balance-sheet subtotals.
          // The Income (flow) tile is intentionally a sign-post to Cashflow,
          // not a balance. Spec §3.4 / §3.5 explicitly separate flows.
          obligations:     (catRows.obligations || []).reduce((s, r) => s + (+r.value || 0), 0),
        }
        // Use the canonical netWorth(entity) so the headline matches the triple
        // anchor exactly. Category subtotals are still useful as proportional
        // breakdowns even when legacy + spec shapes co-exist (Mr T fixture).
        subtotals.netWorth = nw

        // Compose the 10 category cards. Order = spec §3.4 default.
        // Empty-state copy has personality per category — generic "Tap Add"
        // wasn't earning its place (skill rule: every word earns its place).
        const CATEGORIES = [
          { id: 'pensions',     label: 'Pensions',             domainCodes: 'A · B',     rows: catRows.pensions,     onRowTap: () => setDrillPension(true),
            empty: 'No pensions yet. Add a SIPP or workplace scheme — the contributions get back up to 47% in tax relief.' },
          { id: 'investments',  label: 'Savings & Investments',domainCodes: 'C · D · E · F', rows: catRows.investments,
            empty: 'Nothing invested yet. Add an ISA first — £20k a year, no tax on growth, no tax on withdrawal.' },
          { id: 'property',     label: 'Property',             domainCodes: 'G',         rows: catRows.property,
            empty: 'No property added. Your main home is exempt from capital gains tax when you sell. Let property is taxed fully — and since 2020 you only get a small slice of mortgage interest back against rental income.' },
          { id: 'business',     label: 'Business Assets',      domainCodes: isDirector ? 'H · I · X' : 'H · I',  rows: catRows.business,
            empty: 'No business holdings added. Shares in a trading company may pass to your heirs free of inheritance tax once you have held them for two years.' },
          { id: 'protection',   label: 'Protection',           domainCodes: 'J · K · L', rows: catRows.protection,
            empty: 'No cover in place. The four pillars: life · critical illness · income protection · private medical. Term life with the policy in trust is the cheapest IHT shield.' },
          { id: 'cash',         label: 'Cash',                 domainCodes: 'M',         rows: catRows.cash,
            empty: 'No cash accounts captured. 3–6 months of essentials in easy-access is the standard buffer; ISA + NS&I are the tax-free options.' },
          { id: 'liabilities',  label: 'Liabilities',          domainCodes: 'N',         rows: catRows.liabilities, liability: true,
            empty: 'No debt recorded. Lucky you.' },
          { id: 'income',       label: 'Income (flow)',        domainCodes: 'O · W',     rows: [] /* income shown in flow-context below NW + on Cashflow */ },
          { id: 'alternatives', label: 'Alternatives',         domainCodes: 'U',         rows: catRows.alternatives,
            empty: 'Crypto, wine, art, gold, P2P, private equity — anything that doesn\'t fit the standard wrappers lives here. Chattels under £6k disposal: no CGT.' },
          { id: 'obligations',  label: 'Obligations',          domainCodes: 'V',         rows: catRows.obligations,
            empty: 'No family commitments tracked. Parent care, dependants, ongoing maintenance — drag on cashflow you don\'t want missed.' },
        ]

        // Per-category context lines + status chips. These surface what an
        // adviser would call out at a glance — they're derived heuristically
        // from the persona data we already have.
        const isaUsedYTD = (entity?.assets?.investments || [])
          .filter(inv => (inv.type || '').toLowerCase().includes('isa'))
          .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
        const carryFwdAA = entity?.income?.allowance_use?.pension_aa
        const aaHeadroomLeft = (1 - (carryFwdAA || 0)) * TAX.pensionAA

        // Realistic monthly essentials — use entity.expenses if present, else
        // fall back to 55% of gross annual income / 12. Don't use director
        // salary alone (it's deliberately suppressed for NI optimisation on
        // Mr T-style personas and gives nonsense "27 months of cover").
        const monthlyEssentialsForTiles =
          +entity?.expenses?.essential_monthly || (incomeAnnual * 0.55) / 12

        const tileCats = CATEGORIES.map(c => {
          const tile = { ...c }
          if (c.id === 'pensions' && aaHeadroomLeft > 1000) {
            tile.contextLine = `£${Math.round(aaHeadroomLeft / 1000)}k of pension room left this year`
            tile.status = { label: 'Pension room available', tone: 'warn', explainerId: 'MM-AA' }
          }
          if (c.id === 'investments' && isaUsedYTD < 20000) {
            const remaining = 20000 - isaUsedYTD
            tile.contextLine = `£${Math.round(remaining / 1000)}k of tax-free ISA room left this year`
            tile.status = remaining > 5000 ? { label: 'Room to shelter cash', tone: 'good', explainerId: 'MM-2' } : null
          }
          if (c.id === 'property') {
            const hasBtl = (entity?.assets?.property || []).some(p => /buy-to-let|btl/i.test(p.use || p.type || ''))
            tile.contextLine = hasBtl
              ? 'Includes a let property — only a small slice of the mortgage interest counts against the rent'
              : 'Your home — passing it to children adds up to £175,000 of extra inheritance allowance'
            if (!hasBtl) tile.status = { label: 'Extra estate allowance', tone: 'good', explainerId: 'MM-RNRB' }
          }
          if (c.id === 'business' && (entity?.business_assets || []).some(b => b.qualifies_for_bpr)) {
            tile.status = { label: 'Inheritance-tax sheltered', tone: 'good', explainerId: 'MM-BPR' }
            tile.contextLine = 'Tax-free to your heirs after 2 years of qualifying ownership'
          }
          if (c.id === 'protection') {
            const inTrust = entity?.assets?.protection?.lifeInsurance?.inTrust
            tile.contextLine = inTrust
              ? 'Life cover is held in trust — pays out to family directly, no inheritance tax on it'
              : 'Life cover is part of your estate — putting it in trust would protect the payout from inheritance tax'
            tile.status = inTrust ? null : { label: 'Trust setup needed', tone: 'warn', explainerId: 'MM-RNRB' }
          }
          if (c.id === 'liabilities') {
            const loans = (entity?.liabilities?.otherLoans || [])
            const hasMortgage = (+entity?.liabilities?.mortgage?.outstanding || 0) > 0

            // Phase 1E — find the highest-rate (most expensive) debt for the tile
            const ratedDebts = [
              hasMortgage && entity.liabilities.mortgage.rate
                ? { label: 'Mortgage', rate: +(entity.liabilities.mortgage.rate) * 100 }
                : null,
              ...loans.map(l => {
                const r = +(l.apr || l.interest_rate || 0) * 100
                return r > 0 ? { label: (l.type || 'Loan').replace(/_/g, ' '), rate: r } : null
              }),
            ].filter(Boolean).sort((a, b) => b.rate - a.rate)

            const highestRateDebt = ratedDebts[0]
            const mortgageRate = entity?.liabilities?.mortgage?.rate
              ? `Mortgage ${(+entity.liabilities.mortgage.rate * 100).toFixed(1)}%`
              : null

            const bits = [
              hasMortgage && mortgageRate,
              loans.some(l => /student/i.test(l.type || '')) && 'student loan',
              loans.some(l => /credit-card|credit_card/i.test(l.type || '')) && 'credit card',
              loans.some(l => /buy-to-let|btl/i.test(l.type || '')) && 'BTL mortgage',
            ].filter(Boolean)

            tile.contextLine = bits.length > 0 ? bits.join(' · ') : 'No liabilities recorded'

            // Show highest-rate debt as an urgent signal
            if (highestRateDebt && highestRateDebt.rate > 5) {
              tile.status = {
                label: `${highestRateDebt.label} ${highestRateDebt.rate.toFixed(1)}% — highest cost`,
                tone: highestRateDebt.rate > 15 ? 'bad' : 'warn',
              }
            }
          }
          if (c.id === 'cash') {
            const months = (subtotals.cash / Math.max(1, monthlyEssentialsForTiles)) || 0
            if (months > 0) tile.contextLine = months >= 12
              ? `${(months / 12).toFixed(1)} yr of essentials covered`
              : `${months.toFixed(1)} mo of essentials covered`
            // Status surfaces health band for the safety net
            if (months >= 6) tile.status = { label: 'Strong buffer', tone: 'good' }
            else if (months >= 3) tile.status = { label: 'Adequate', tone: 'neutral' }
            else tile.status = { label: 'Thin', tone: 'warn' }
          }
          if (c.id === 'alternatives' && (entity?.assets?.alternatives || []).length > 0) {
            const a = entity.assets.alternatives[0]
            tile.contextLine = `${a.type === 'wine' ? 'Fine wine · chattels exemption' : 'Illiquid · CGT on disposal'}`
          }
          if (c.id === 'obligations' && (entity?.family_obligations || []).length > 0) {
            const annual = entity.family_obligations.reduce((s, o) => s + (+o.annual_cost || 0), 0)
            if (annual > 0) tile.contextLine = `£${Math.round(annual / 1000)}k/yr in family commitments`
          }
          // Mock-ish change pct — pulled from trajectory if available, else null
          const traj = entity?.trajectories?.netWorthHistory
          if (traj && traj.length >= 2 && c.id !== 'income') {
            // not category-specific in current data; surface NW change as a hint
            const lastTwo = traj.slice(-2)
            const ch = ((lastTwo[1].value - lastTwo[0].value) / Math.max(1, lastTwo[0].value)) * 100
            // Only assign a change pct if this category is one of the major drivers
            if (['pensions', 'investments', 'property', 'business'].includes(c.id)) {
              tile.changePct = +ch.toFixed(1)
            }
          }
          tile.subtotal = subtotals[c.id]

          // 12-month sparkline series — back-cast from current subtotal using a
          // category-typical monthly growth rate. Not real history (Mr T doesn't
          // carry per-category time series) but shows a directional trend. For
          // liabilities, the line trends DOWN (amortising) so we use a slight
          // negative monthly drift. For income, no sparkline.
          const CAT_MONTHLY_DRIFT = {
            pensions:     0.0058,   // ~7% annual
            investments:  0.0050,   // ~6% annual
            property:     0.0033,   // ~4% annual
            business:     0.0070,   // ~9% annual (private equity volatility)
            protection:   0.0,      // no movement
            cash:         0.0028,   // ~3.4% annual savings rate
            liabilities: -0.0042,   // amortising ~5%/yr
            alternatives: 0.0045,
            obligations:  0.0,
            income:       0.0,
          }
          // Sparklines only for categories with meaningful time-series narrative.
          // Protection/cash/alternatives/obligations have no growth story to chart.
          const SPARKLINE_CATS = ['pensions', 'investments', 'property', 'business', 'liabilities']
          if (SPARKLINE_CATS.includes(c.id) && tile.subtotal && tile.subtotal !== 0) {
            const drift = CAT_MONTHLY_DRIFT[c.id] ?? 0.004
            const cur = +tile.subtotal
            const sparkSeries = []
            for (let i = 11; i >= 0; i--) {
              sparkSeries.push(cur / Math.pow(1 + drift, i))
            }
            tile.series = sparkSeries
          }

          // Canonical per-tile cost-of-inaction string — engine owns the math
          // and the plain-English copy (canonical-metrics.coiForDomain). Returns
          // null when no meaningful CoI applies for this domain, in which case
          // we leave costOfInaction unset.
          const engineCoI = coiForDomain(entity, c.id)
          if (engineCoI) tile.costOfInaction = engineCoI

          return tile
        })

        // Asset / liability totals for the hero card
        const totalAssetsBS = ['pensions', 'investments', 'property', 'business', 'cash', 'alternatives']
          .reduce((s, k) => s + (subtotals[k] || 0), 0)
        const totalLiabilitiesBS = subtotals.liabilities || 0

        return (
          <TileGrid
            netWorth={projection.value}
            entity={entity}
            projection={isProjected ? {
              years: projection.years,
              confidence: projection.confidence,
              source: projection.source,
              currentValue: nw,
              windowLabel: currentWindow.full,
              viewMode,
            } : null}
            totalAssets={totalAssetsBS}
            totalLiabilities={totalLiabilitiesBS}
            categories={tileCats}
            trajectory={entity?.trajectories?.netWorthHistory}
            monthlyEssentials={+entity?.expenses?.essential_monthly || (incomeAnnual * 0.55) / 12}
            planTarget={(() => {
              const retPlan = (entity?.plans || []).find(p => p.type === 'retirement' || /retire|fi/i.test(p.label || ''))
              if (!retPlan) return null
              if (typeof retPlan.target === 'number') return retPlan.target
              if (retPlan.target && typeof retPlan.target === 'object') return +retPlan.target.netWorth || null
              return null
            })()}
            onView={(id) => {
              if (id === 'pensions') setDrillPension(true)
              else if (['investments', 'property', 'business', 'protection', 'liabilities'].includes(id)) {
                setDrillCat(id)
              } else if (id === 'cash') {
                // Cash lives under investments drill; scroll-open that panel
                setDrillCat('investments')
              } else if (id === 'alternatives') {
                // Alternatives (crypto/PE/commodities) live under investments drill
                setDrillCat('investments')
              } else if (id === 'income') {
                // Income streams — pivot to income view
                setPivot('income')
              } else if (id === 'obligations') {
                // Annual obligations (family support, alimony) — route to Cashflow
                onNav?.('flow')
              }
            }}
            onAdd={openBucket}
          />
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
         PHASE 4 — DIRECTOR INTELLIGENCE LAYER
         Only surfaces for director persona. Highest-value calculations
         specific to company directors: AA headroom, S24, BPR, extraction.
         ═══════════════════════════════════════════════════════════════════ */}
      {hasPersonaFlag(entity, 'director') && (() => {
        // 4A: Annual Allowance headroom
        const aaUsedRaw = entity?.income?.allowance_use?.pension_aa
        // M-12: guard — field could be a fraction (0-1) or absolute £. Treat >1 as absolute £.
        const aaUsed = aaUsedRaw != null
          ? (aaUsedRaw <= 1 ? aaUsedRaw * TAX.pensionAA : aaUsedRaw)
          : null
        const aaLeft = aaUsed != null ? Math.max(0, TAX.pensionAA - aaUsed) : null

        // 4B: Optimal salary/dividend split signal
        const currentSalary = +(entity?.income?.directorSalary || entity?.income?.employment || 0)
        const salaryTooHigh = currentSalary > 50_270  // into higher rate band

        // 4C: Section 24 BTL exposure
        const hasBTL = (entity?.assets?.property || []).some(p => /buy-to-let|btl/i.test(p.use || p.type || ''))
        const btlMortgageInterest = (() => {
          const btlLoans = (entity?.liabilities?.otherLoans || []).filter(l => /buy-to-let|btl/i.test(l.type || ''))
          return btlLoans.reduce((s, l) => s + (+l.monthlyPayment || 0) * 12, 0)
        })()
        const s24Tax = btlMortgageInterest > 0 ? btlMortgageInterest * 0.20 : 0  // tax credit lost vs pre-S24

        // 4D: BPR clock — check if business assets qualify
        const bprAssets = (entity?.business_assets || []).filter(b => b.qualifies_for_bpr)
        const bprEarliestDate = bprAssets.length > 0
          ? bprAssets.map(b => b.acquisition_date || b.start_date).filter(Boolean)[0]
          : null

        // N-08 / S-01 fix: each director-intelligence action gets an explicit
        // destination. `nav` is the App-level router (Tax sub-tab, Cashflow,
        // Ask Sonu) or — for "ask the engine" actions — an Ask Sonu
        // pre-filled query. Pills become real <button>s below.
        const goTaxAni = () => onNav?.('tax', { sub: 'ani' })
        const goTaxExtraction = () => onNav?.('tax', { sub: 'director-extraction' })
        const goTaxS24 = () => onNav?.('tax', { sub: 's24' })
        const goAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: q } }))

        const items = [
          aaLeft != null && aaLeft > 1000 ? {
            icon: '⌂', color: '#7AA7FF',
            title: 'Pension headroom available',
            body: `You have £${Math.round(aaLeft / 1000)}k of annual allowance unused this year. An employer contribution from your Ltd company gets full corporation tax deduction — effectively costing the company 75p per £1 you put in.`,
            action: 'Maximise before 5 April',
            onAction: goTaxAni,
          } : null,
          salaryTooHigh ? {
            icon: '⚙', color: '#FFB347',
            title: 'Director salary above optimal',
            body: `Your salary of ${fmt(currentSalary)}/yr tips into higher-rate income tax + NI. Most directors take £12,570 salary + dividends. Review your extraction mix — the saving can be £3k–£8k/yr in NI alone.`,
            action: 'Review salary/dividend split',
            onAction: goTaxExtraction,
          } : {
            icon: '⚙', color: 'var(--c-acc)',
            title: 'Director extraction mix',
            body: `As a director you control how you take money from your company. The optimal mix (salary + dividends + pension) changes as income grows and thresholds shift. Check your mix is still optimal for 2026/27.`,
            action: 'Review extraction strategy',
            onAction: goTaxExtraction,
          },
          hasBTL && btlMortgageInterest > 0 ? {
            icon: '⌖', color: '#FF9500',
            title: 'Section 24 restriction on BTL',
            body: `Your BTL mortgage interest of ${fmt(Math.round(btlMortgageInterest))}/yr no longer offsets rental income directly. You get only a 20% tax credit instead. At your marginal rate, this costs you ${fmt(Math.round(s24Tax))} extra tax annually vs pre-2017 rules.`,
            action: 'Consider whether BTL is still efficient',
            onAction: () => goAsk(`Given my BTL with ${fmt(Math.round(btlMortgageInterest))}/yr mortgage interest, is it still tax-efficient to hold personally under Section 24?`),
          } : null,
          bprAssets.length > 0 ? {
            icon: '⚇', color: 'var(--c-acc)',
            title: 'Business Property Relief clock',
            body: `${bprAssets.length} business asset${bprAssets.length > 1 ? 's' : ''} may qualify for 100% IHT exemption${bprEarliestDate ? ` — 2-year qualifying clock from ${bprEarliestDate}` : ' — confirm 2-year ownership period'}. The 2026 Budget caps BPR at £1m with 50% relief above — plan accordingly.`,
            action: 'Confirm BPR status with adviser',
            onAction: () => goAsk(`Do my business assets qualify for Business Property Relief? Owned since ${bprEarliestDate || 'unknown'}.`),
          } : null,
        ].filter(Boolean)

        if (!items.length) return null
        return (
          <>
            <SectionDelimiter
              eyebrow="Director intelligence"
              title="What matters most for company directors"
              sub="Tax efficiency levers specific to your director status"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {items.map((item, i) => (
                <div key={i} style={{
                  background: `color-mix(in srgb, ${item.color} 7%, var(--c-surface))`,
                  border: `1px solid color-mix(in srgb, ${item.color} 25%, var(--c-border))`,
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: `color-mix(in srgb, ${item.color} 18%, var(--c-surface2))`,
                      display: 'grid', placeItems: 'center', fontSize: 14,
                    }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 8 }}>{item.body}</div>
                      {/* N-08 / S-01 fix: real <button> with onClick — was an
                          inert <span> that looked like a CTA but did nothing
                          when tapped. Pre-launch CTA-honesty rule. */}
                      <button
                        type="button"
                        onClick={item.onAction}
                        className="sw-press"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                          color: item.color, textTransform: 'uppercase',
                          background: 'transparent', border: 'none',
                          padding: '4px 0', cursor: item.onAction ? 'pointer' : 'default',
                        }}
                      >
                        {item.action} →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
         TAX panels — ANI, allowances
         ═══════════════════════════════════════════════════════════════════ */}
      <SectionDelimiter
        eyebrow="Tax & allowances"
        title="What you keep and what you're sheltering"
        sub="Tap a row to expand · these numbers show you the gaps HMRC won't point out"
      />
      {/* Tax snapshot — surfaces top 2 actionable insights before the detail panels */}
      {(() => {
        let t, a
        try { t = allowanceTracker(entity) } catch { return null }
        try { a = calcANI(entity) } catch { return null }
        if (!t || !a) return null
        const isaLeft = Math.max(0, t.isa.limit - t.isa.used)
        const pensionLeft = (() => {
          try {
            const carryFwd = entity?.income?.allowance_use?.pension_aa
            return carryFwd != null ? Math.max(0, (1 - carryFwd) * TAX.pensionAA) : null
          } catch { return null }
        })()
        const insights = [
          { icon: '£', color: 'var(--c-acc)',
            label: 'What you keep after tax',
            value: fmt(a.ani),
            sub: `${Math.round((a.ani / Math.max(a.steps?.total || 1, 1)) * 100)}% of gross income reaches your pocket` },
          isaLeft > 1000 ? { icon: '🛡', color: '#5DDBC2',
            label: 'ISA room left this tax year',
            value: fmt(isaLeft),
            sub: 'This allowance resets 6 April · unused room disappears forever' } : null,
          pensionLeft && pensionLeft > 1000 ? { icon: '⌂', color: '#7AA7FF',
            label: 'Pension headroom',
            value: fmt(pensionLeft),
            sub: 'Contribute now for 40%+ tax relief at your rate' } : null,
        ].filter(Boolean)
        if (!insights.length) return null
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                background: `color-mix(in srgb, ${ins.color} 8%, var(--c-surface))`,
                border: `1px solid color-mix(in srgb, ${ins.color} 22%, var(--c-border))`,
                borderRadius: 14, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
                  {ins.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 880, color: ins.color, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, marginBottom: 4 }}>
                  {ins.value}
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>{ins.sub}</div>
              </div>
            ))}
          </div>
        )
      })()}
      <ANIPanel entity={entity} />
      <AllowancesPanel entity={entity} />

      {/* ═══════════════════════════════════════════════════════════════════
         NRI gate — Indian assets only render if hasPersonaFlag('nri')
         ═══════════════════════════════════════════════════════════════════ */}
      {hasPersonaFlag(entity, 'nri') && entity.assets?.indianAssets && (
        <RevealCard cardId="indian-assets" title="Indian assets — held as a non-resident" defaultOpen={true}
          headerAccessory={<WrapperBadge wrapper="GIA" label="Non-resident" />}>
          <div style={{
            background: 'rgba(255,179,71,.07)',
            border: '1px solid rgba(255,179,71,.25)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 12,
            fontSize: 13, color: '#FFB347',
          }}>
            India bundle loading — DTAA computations pending
          </div>
          {[
            { label: 'NRE Account', val: +entity.assets.indianAssets.nreAccount?.value_gbp || 0 },
            { label: 'NRO Account', val: +entity.assets.indianAssets.nroAccount?.value_gbp || 0 },
            { label: 'EPF',         val: +entity.assets.indianAssets.epf?.value_gbp_approx || 0 },
            { label: 'Mutual Funds',val: +entity.assets.indianAssets.mutualFunds?.value_gbp_approx || 0 },
          ].map((r, i) => (
            <div key={r.label} className="row" style={{ paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
              <div style={{ fontSize: 13, color: 'var(--c-text)' }}>{r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{fmt(r.val)}</div>
            </div>
          ))}
          <CausalityStripe sources={['Your data', 'IN-2026.1']} />
        </RevealCard>
      )}

      {/* ── Disclaimer + rules ──────────────────────────────────────────── */}
      <p className="disclaimer">{BRAND.disclaimer}<br />{BRAND.rulesVersion} · {BRAND.dataDate}</p>

      </>}{/* ── /non-scenario content fragment ─────────────────────────────── */}
      </div>{/* ── /sw-tab-slide viewMode wrapper ─────────────────────────── */}

      {/* ── Universal add button — wired to capture sheet ───────────────── */}
      {/* Floating + opens the new bucket-pattern AddItemSheet (rooted in
          3-Engine-mm-asset-taxonomy-v1_0.md). AssetCaptureSheet (legacy)
          remains available via addOpen but is no longer the default entry. */}
      <UniversalAddButton onSelect={() => setBucketOpen(true)} />

      {/* ── Asset capture sheet ─────────────────────────────────────────── */}
      <AssetCaptureSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCommit={handleAssetCommit}
        entity={entity}
      />

      {/* ── Bucket-pattern add sheet (Phase 2 follow-up · taxonomy-driven) ── */}
      <AddItemSheet
        open={bucketOpen}
        initialCategory={bucketCat}
        onClose={() => { setBucketOpen(false); setBucketCat(null) }}
        onCommit={handleAssetCommit}
      />

      {/* ── Pension drill-down ──────────────────────────────────────────── */}
      {drillPension && (
        <PensionDrillDown
          entity={entity}
          personaId={personaId}
          onBack={() => setDrillPension(false)}
          onHome={onHome}
          onCommit={(eventOrSchedule) => {
            if (Array.isArray(eventOrSchedule)) handleCommitSchedule(eventOrSchedule)
            else if (eventOrSchedule?.type) handleNominationEvent(eventOrSchedule)
          }}
        />
      )}

      {/* ── Per-category drill-downs (Domain C/D/E/F · G · H/I · J/K/L · N) */}
      {drillCat === 'investments' && (
        <InvestmentsDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
      )}
      {drillCat === 'property' && (
        <PropertyDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
      )}
      {drillCat === 'business' && (
        <BusinessDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
      )}
      {drillCat === 'protection' && (
        <ProtectionDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
      )}
      {drillCat === 'liabilities' && (
        <LiabilitiesDrillDown entity={entity} personaId={personaId} onBack={() => setDrillCat(null)} onHome={onHome} />
      )}
    </div>
  )
}
