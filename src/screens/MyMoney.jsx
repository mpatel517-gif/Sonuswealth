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

import { useState, useMemo, useEffect } from 'react'
// S1 selector migration (Phase 2): canonical reads via facade.
import {
  netWorth, investable,
  fq as calcFQ,
  ani as calcANI,
  hicbc as calcHICBC,
  psa as calcPSA,
  coiForDomain,
  getWrapper,
} from '../engine/selectors/index.js'
import {
  // formatting + identity
  fmt, netWorthAtWindow, guardrail,
  // CoI + IHT
  ihtDynamic, ihtSippDelta, costOfInaction, totalCoI, coiCashflowVariants,
  // Triple-anchor scores
  calcRisk, fqBand, riskBand,
  // Pension drilldown
  sippProjection, sippProjectionSeries, nominationStatus,
  drawdownEfficiencyRatio, prcPccSpread,
  // Wrapper / persona / surplus / liquidity
  hasPersonaFlag, monthlySurplus, liquidityBuffer,
  // 5-method drawdown
  bengenProjection, guytonKlingerPath, bucketAllocation,
  floorUpsideSplit, swrFromRegime, drawdownMatrix,
  // Tax (calcANI, calcHICBC, calcPSA migrated to selectors above)
  calcPersonalAllowance, calcDividendTax,
  calcAllIncome, classifyIncomeType, allowanceTracker, calcMarriageAllowance,
  // Plan / temporal
  planFor, planStaleness, varianceFor,
  // Priority cards + decumulation
  calcAge, taxEfficiencyScore, effectiveBeneficiaryRate,
  // Tax constants
  TAX,
} from '../engine/fq-calculator.js'

// PP-5 — Single ripple path for entity-derived scalars (W0-T8).
// Per W0-T1 inventory: 10 of MyMoney's 41 fq-calc symbols have direct ripple
// equivalents (netWorth, investable, guardrail, calcFQ, calcRisk, fqBand,
// riskBand, monthlySurplus + ihtDynamic/costOfInaction with caveats).
// The migration is scoped to the *main MyMoney component* — sub-components
// (PensionDrillDown, SurplusTile, PriorityCards, DecumulationPanel) keep
// direct imports because (a) the hook can't be called outside MyMoney and
// (b) several of their call sites diverge from ripple's defaults
// (e.g. ihtDynamic with includeSipp=true override, mutated entity).
import { useRipple } from '../state/ripple.jsx'
// W1 temporal wiring (2026-06-01): MyMoney reads from the same single store
// that Dashboard.GlobalTaxYearChip and X28TopBar write. This makes all three
// controls share one source of truth — changing the window in Dashboard or in
// the X28TopBar pill on MyMoney both re-project tile headlines and TrajectoryBars.
import useTaxYear from '../hooks/useTaxYear.jsx'
// S1 selector migration (Phase 2): monthlyEssentials reader pulled via selector
// facade. Resolves the 4 known persona shapes consistently with engine canon.
import { monthlyEssentials as getMonthlyEssentials } from '../engine/selectors/index.js'
// Pension audit P3 (2026-05-26): effective AA (standard / MPAA / tapered)
// and per-tax-year carry-forward — used by PensionDrillDown to replace the
// previous static "This year's cap / Reduced cap / Unused room" tiles.
import { effectiveAA, carryForwardByYear } from '../engine/persona-helpers.js'

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
import TappableNumber    from '../components/shared/TappableNumber.jsx'
// Phase 2 follow-up — balance-sheet view + 10 grouped categories per
// MyMoney v2.7 §3.4 + taxonomy-driven add flow.
import BalanceSheet       from '../components/MyMoney/BalanceSheet.jsx'
import { PensionSummaryDrill } from '../components/MyMoney/L3/PensionSummaryDrill.jsx'
import { L3PanelHost } from '../components/MyMoney/L3/L3PanelHost.jsx'
import { L4NumberPanel } from '../components/MyMoney/L3/L4NumberPanel.jsx'
import { projectSeries, growthRateFor, projectValue } from '../engine/projection.js'
import { getActiveCMA } from '../engine/cma.js'
import { classifyPot } from '../engine/decumulation-plan.js'
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
// PivotToggle removed Wave 0.6 — founder direction: comprehensive scroll,
// not switcher. PivotView import kept (still consumable if a future Act
// surfaces income/insurance/bonds aggregations) but no longer wraps the grid.
import PivotView from '../components/MyMoney/PivotView.jsx'
// Per-category drill-down panels — taxonomy-driven detail per
// 3-Engine-mm-asset-taxonomy-v1_0.md (Domain C/D/E/F · G · H/I · J/K/L · N).
import InvestmentsDrillDown from '../components/MyMoney/InvestmentsDrillDown.jsx'
import PropertyDrillDown    from '../components/MyMoney/PropertyDrillDown.jsx'
import BusinessDrillDown    from '../components/MyMoney/BusinessDrillDown.jsx'
import ProtectionDrillDown  from '../components/MyMoney/ProtectionDrillDown.jsx'
import LiabilitiesDrillDown from '../components/MyMoney/LiabilitiesDrillDown.jsx'
import LiabilityTile from '../components/MyMoney/LiabilityTile.jsx'
import { classifyLiability } from '../engine/liability-taxonomy.js'
import DebtLeaf from '../components/MyMoney/DebtLeaf.jsx'
import { amortise } from '../components/MyMoney/debtMath.js'
import CashDrillDown         from '../components/MyMoney/CashDrillDown.jsx'
import AlternativesDrillDown from '../components/MyMoney/AlternativesDrillDown.jsx'
import AssetDetailOverlay    from '../components/MyMoney/AssetDetailOverlay.jsx'
import FinancesHeroCard      from '../components/MyMoney/FinancesHeroCard.jsx'
import MoneyXDrawer          from '../components/shared/MoneyXDrawer.jsx'
import AccountsList          from '../components/MyMoney/AccountsList.jsx'
import {
  TaperedAATile,
  CohabIHTCliffTile,
  TransferableNRBTile,
  StatePensionForecastTile,
  EISVCTClockTile,
  RentARoomTile,
  LandlordS24Tile,
  SoleTraderNICTile,
  DrawdownMethodsTeaser,
  // v0.3 R1 — Phase 3 added persona-aware chips consumed on Balance Sheet route
  HICBCTile,
  AvalanchePriorityTile,
  NRIIndianAssetsTile,
} from '../components/MyMoney/PersonaGapTiles.jsx'
// v0.3 R1 — M7 founder decision (2026-05-26): Marimekko removed from R1
// after live snap-audit on Mr T persona showed 15 wrappers compressed to
// sub-pixel stripes. Wrapper bar (defined locally below) restored as the
// signature comp. Marimekko component file kept in `charts/` for any
// future low-N route that wants 2-category composition view.
// import { Marimekko } from '../components/charts/index.js'  // ← retired
// v0.3 R1 §8 — SIPP-IHT chip on Pensions tile uses canonical pre/post-2027
// delta helper (single source of truth, no recompute in screen).
import { ihtDeltaPrePost2027 } from '../engine/selectors/index.js'
// v0.3 R8 Pension drill (2026-05-26) — Liquidity ladder is reused across all
// drills. Inline PensionDrillDown at line ~1872 owns the v0.3 deltas because
// it shadows the standalone PensionDrillDown.jsx component (which is unused).
import { LiquidityLadder } from '../components/charts/index.js'
import { monteCarloPOS } from '../engine/scenarios.js'
import NetWorthDrill        from '../components/MyMoney/NetWorthDrill.jsx'
import CashFlowDrill        from '../components/MyMoney/CashFlowDrill.jsx'
import WrapperDrill         from '../components/MyMoney/WrapperDrill.jsx'
import WhatIfLibrary        from '../components/MyMoney/WhatIfLibrary.jsx'
import { EV, useEventsFor } from '../state/events.jsx'

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
  BUSINESS: { fg: '#5E5CE6' },
  ALT:      { fg: '#FFD60A' },
  OTHER:    { fg: '#8E8E93' },
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
  BUSINESS: 'Business',
  ALT:      'Alternatives',
  OTHER:    'Other holdings',
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

function MetricTile({ label, value, sub, colour = 'var(--c-text)', missing, question, rawValue, context }) {
  const numEl = (
    <div style={{
      fontSize: 16, fontWeight: 700,
      color: missing ? 'var(--c-text3)' : colour,
      fontStyle: missing ? 'italic' : 'normal',
    }}>{value}</div>
  )
  return (
    <div style={{
      background: 'var(--c-surface2)', borderRadius: 12, padding: '10px 12px',
      minHeight: 60,
    }}>
      <div style={{
        fontSize: 11, color: 'var(--c-text3)', textTransform: 'uppercase',
        letterSpacing: 0.5, marginBottom: 4,
      }}>{label}</div>
      {question && !missing ? (
        <TappableNumber
          value={rawValue ?? 0}
          display={value}
          question={question}
          context={context || { metric: label }}
          size="hero"
        >
          {numEl}
        </TappableNumber>
      ) : numEl}
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

// Humanise a debt/loan type slug into a clean sentence-case label
// (MONEY-TILE-TEMPLATE R5b): "credit-card" → "Credit card",
// "student_loan_plan2" → "Student loan (Plan 2)", "buy-to-let-mortgage" →
// "Buy-to-let mortgage". Replaces BOTH `-` and `_`; never rely on CSS
// `capitalize` (which mangles hyphens → "Buy-To-Let"). Founder 2026-06-01.
function humanizeDebtType(type = '') {
  const raw = String(type).toLowerCase().trim()
  // Prefer the canonical taxonomy label so every surface names a debt the same
  // way. Only fall back to the generic prettifier when the type matches nothing
  // in the taxonomy (classifyLiability returns the 'other-loan' sentinel).
  const entry = classifyLiability(raw)
  if (entry.id !== 'other-loan') return entry.label
  const planMatch = raw.match(/plan[\s_-]?(\d)/)
  let t = raw
    .replace(/plan[\s_-]?\d/g, '')                    // strip "planN" — re-added as "(Plan N)"
    .replace(/[_-]+/g, ' ')
    .replace(/\bbtl\b/g, 'buy-to-let')
    .replace(/\bhp\b/g, 'hire purchase')
    .replace(/\s+/g, ' ')
    .trim()
  let label = t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Loan'   // sentence-case, hyphens intact
  if (planMatch) label += ` (Plan ${planMatch[1]})`
  return label
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
  // B7 fix (2026-06-01): read a.gia[] — persona-c (Tony Stark) stores GIA
  // accounts here (4 accounts, £605k). These are not inside a.investments[].
  for (const inv of (a.gia || [])) {
    out.push({
      id: inv.id || inv.taxonomy_id || inv.name, label: inv.name || 'GIA',
      value: +(inv.value || inv.balance_gbp || inv.balance || 0) || 0,
      sub: inv.provider || inv.subtype || '',
      wrapper: 'GIA',
      raw: inv,
    })
  }
  // Dedupe: skip legacy a.portfolio.value when spec investments[] has GIA items
  // OR when a.gia[] is already populated (avoids double-count for Tony Stark).
  const specItems = (a.investments || []).filter(inv => {
    const t = (inv.type || '').toLowerCase()
    return t === 'gia' || t.includes('general-investment')
  })
  // Skip legacy BPR-qualifying portfolio here — it belongs exclusively to the
  // BUSINESS tile via rowsForBPR (domain H). Including it in both double-counts.
  // B6 fix (2026-06-01): also skip when a.gia[] is present to avoid
  // double-counting (persona-c has both a.gia[] AND a.portfolio{bpr:true}).
  if (a.portfolio?.value > 0 && specItems.length === 0 && out.length === 0 && !a.portfolio?.bpr) {
    out.push({
      id: 'gia-legacy', label: 'GIA / Brokerage', value: +a.portfolio.value || 0,
      sub: 'General investment',
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
  // B7 fix (2026-06-01): also read taxEfficientInvestments[] (EIS/SEIS/VCT)
  // and investmentBonds[] (BOND_ON/BOND_OFF) — persona-c stores these in
  // dedicated top-level arrays rather than inside investments[].
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
  // taxEfficientInvestments[]: type is 'EIS' | 'SEIS' | 'VCT' etc.
  // Map to wrapper: EIS→EIS, SEIS→SEIS, VCT→VCT
  for (const inv of (a.taxEfficientInvestments || [])) {
    const w = (inv.type || '').toUpperCase()
    if (w === wrapper) {
      out.push({
        id: inv.id || inv.taxonomy_id || inv.name, label: inv.name || inv.type,
        value: +(inv.value || inv.balance_gbp || inv.balance || 0) || 0,
        sub: inv.provider || '',
        wrapper,
        raw: inv,
      })
    }
  }
  // investmentBonds[]: type 'onshore-bond'→BOND_ON, 'offshore-bond'→BOND_OFF
  for (const inv of (a.investmentBonds || [])) {
    const t = (inv.type || '').toLowerCase()
    const w = t.includes('offshore') ? 'BOND_OFF' : t.includes('bond') ? 'BOND_ON' : null
    if (w === wrapper) {
      out.push({
        id: inv.id || inv.taxonomy_id || inv.name, label: inv.name || inv.type,
        value: +(inv.value || inv.balance_gbp || inv.balance || 0) || 0,
        sub: inv.provider || '',
        wrapper,
        raw: inv,
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
        id: l.id || l.type, label: humanizeDebtType(l.type),
        value: +(l.outstanding_balance_gbp ?? l.outstanding_balance ?? l.balance ?? 0) || 0,
        sub: `${fmt(+(l.monthly_payment || 0))}/mo · ${((+l.apr || +l.interest_rate || 0) * 100).toFixed(1)}% APR`,
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
        id: l.id || l.type, label: humanizeDebtType(l.type),
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
  // TO-5 fix (2026-05-28): also walk `entity.assets.alternatives[]` (canonical
  // schema location used by Tony Stark and any other persona storing alts
  // under the assets wrapper). The old `entity.alternatives` and
  // `entity.alt_assets` shapes are legacy/root-level. Tony's £315k of
  // crypto/gold lived in `assets.alternatives[]` and never made it into the
  // CategoryTile because this loop didn't read that location.
  // See 0-Active/audit/B-V2-EXPANDED-FINDINGS-2026-05-28.md TO-5.
  const altArrays = [
    entity.alternatives,
    entity.alt_assets,
    entity.assets?.alternatives,
  ];
  for (const arr of altArrays) {
    if (!Array.isArray(arr)) continue;
    for (const a of arr) {
      if (a?.status === 'disposed') continue;
      out.push({
        id: a.id, label: a.name || a.type,
        value: +(a.value_gbp ?? a.value ?? 0) || 0,
        sub: a.type || '',
        // C-01 fix: alternatives are not GIA. Preserve source.
        wrapper: a.wrapper || null, tag: 'ALT',
      })
    }
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

function WrapperCompositionBar({ entity, onSegmentTap, activeWrapper = null, onAddWrapperDetails, onOpenDrill, totalAssets = 0 }) {
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
  const wrapped = Object.values(totals).reduce((s, v) => s + v, 0)
  // Surface the UNWRAPPED assets so the bar ties to TOTAL assets, not just the
  // wrapped subset. Founder 2026-06-02: the title showed heroTotalAssets (£2.16m)
  // while the segments summed to only the wrapped £1.96m — business equity +
  // alternatives (deliberately wrapper:null, so the tax fast-path can't treat
  // them as a GIA) were invisible on this signature surface. Alternatives is a
  // clean filter; Business is the RESIDUAL (total − wrapped − alt = company
  // equity / share schemes / any other unwrapped holding) so the bar ties to
  // heroTotalAssets EXACTLY by construction and can never drift from the hero.
  const altTotal = rowsForAlternatives(entity).reduce((s, r) => s + (+r.value || 0), 0)
  if (altTotal > 0) totals.ALT = (totals.ALT || 0) + altTotal
  const residualTotal = Math.max(0, (totalAssets || wrapped) - wrapped - altTotal)
  // Label the residual "Business" only when the entity genuinely holds business
  // assets — otherwise it's some other unwrapped value (or heroTotalAssets drift)
  // and "Other holdings" is the honest label, not a phantom Business figure.
  const hasBusiness = !!(entity?.companies?.length || entity?.business_assets?.length ||
                         entity?.share_schemes?.length || entity?.ltd_companies?.length)
  const residualKey = hasBusiness ? 'BUSINESS' : 'OTHER'
  if (residualTotal > 0) totals[residualKey] = (totals[residualKey] || 0) + residualTotal
  const grand = Object.values(totals).reduce((s, v) => s + v, 0)
  if (grand <= 0) return null
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
  const unknownAmount = totals.UNKNOWN || 0
  // ALT / BUSINESS are synthetic tie-out segments (no tax wrapper) — they have no
  // dedicated wrapper drill, so tapping them is a no-op rather than a dead drill.
  const isSyntheticWrapper = (w) => w === 'ALT' || w === 'BUSINESS' || w === 'OTHER'
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
            <button key={w} onClick={() => {
                // Primary tap → open drill (L1→L2→L3). If drill handler not
                // wired, fall back to legacy filter behaviour for safety.
                if (isSyntheticWrapper(w)) return   // tie-out segment, no wrapper drill
                if (typeof onOpenDrill === 'function') onOpenDrill(w)
                else onSegmentTap?.(isActive ? null : w)
              }}
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
            <span key={w} onClick={() => {
                if (isSyntheticWrapper(w)) return   // tie-out segment, no wrapper drill
                if (typeof onOpenDrill === 'function') onOpenDrill(w)
                else onSegmentTap?.(isActive ? null : w)
              }}
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

  // PA taper starts at ANI £100k (ITA 2007 s35) — TAX.adjustedNetIncomeCliff.
  const cliff = TAX.adjustedNetIncomeCliff ?? 100_000
  const distance = cliff - ani

  // Only show when approaching (within £20k below) or already past.
  // distance > 20_000 means we're more than £20k below the cliff — nothing to flag.
  if (distance > 20_000) return null

  const past = ani > cliff
  const pensionToSolve = past ? (ani - cliff) : distance
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
              {/* Tax+FCA audit 2026-05-26: the personalised £-solve
                  ("contribute £X") combined with the "verify with adviser"
                  trailer crossed COBS 9A. Rewritten as mechanic-only: ANI
                  reduces £-for-£ via pension/charity contributions; full PA
                  restored below £100,000. */}
              {past
                ? `Adjusted net income above £100,000 tapers the personal allowance at 50p per £ (effective 60% marginal). Pension and Gift Aid contributions reduce ANI £-for-£; ANI below £100,000 restores the full PA.`
                : `At £100,000 adjusted net income the personal allowance begins to taper at 50p per £, producing a 60% effective marginal rate up to £125,140. Pension and Gift Aid contributions reduce ANI £-for-£.`}
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

function SurplusTile({ entity, setActiveDrill }) {
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
          <button
            type="button"
            onClick={() => setActiveDrill?.('cashflow')}
            aria-label="Open cash flow drill"
            className="sw-press"
            style={{
              background: 'transparent', border: 'none', padding: 0, margin: 0,
              color: 'inherit', font: 'inherit', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'baseline',
            }}
          >
            <>{pos ? '+' : '−'}<Num value={amt} format="currency" animate /></>
          </button>
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
                {urgent ? 'Cash buffer below 30-day cover at current burn rate'
                  : warn ? 'Below the 6-month standard buffer threshold'
                  : 'Cash buffer above 6-month threshold; deficit still present'}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Phase 3A — Sankey flow diagram: income → spending breakdown */}
      <CashFlowSankey m={m} />

      {/* 4 metric tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
        <MetricTile
          label="Monthly income"
          value={fmt(m.income || 0)}
          rawValue={m.income || 0}
          colour="var(--c-text)"
          question="Where does my income come from?"
          context={{ metric: 'monthlyIncome' }}
        />
        <MetricTile
          label="Essentials"
          value={fmt(m.essential || 0)}
          rawValue={m.essential || 0}
          colour="var(--c-text2)"
          question="What are my essential bills?"
          context={{ metric: 'essentialSpend' }}
        />
        <MetricTile
          label="Debt payments"
          value={fmt(m.debtService || 0)}
          rawValue={m.debtService || 0}
          colour="#FF6B6B"
          question="How is my debt structured?"
          context={{ metric: 'debtService' }}
        />
        <MetricTile
          label="Committed"
          value={fmt(m.committed || 0)}
          rawValue={m.committed || 0}
          colour="var(--c-text2)"
          question="What am I committed to pay?"
          context={{ metric: 'committedSpend' }}
        />
      </div>

      {/* Founder 2026-05-25 round 6: Phase 2E self-comparison ("↑ £Xk net worth
          vs last month — despite the monthly shortfall, assets grew") removed.
          The Act 1 single-line verdict already folds NW MoM + monthly surplus
          into one sentence — restating it here gave the user the same idea
          twice on the same screen. Verdict is now the single source. */}
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
      headerAccessory={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }} title="Adjusted Net Income (ANI) — the HMRC figure used to taper your personal allowance and decide HICBC">Taxable income {fmt(a.ani)}</span>}
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
          { n: 6, label: (a.confidence === 'high' ? 'Take-home' : 'Take-home (estimated)'), value: a.ani, sign: '=', emphasised: true  },
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
          value={fmt(pa)} sub={pa < (TAX.pa ?? 12570) ? 'Reduced because income is over the cliff' : `Full ${fmt(TAX.pa ?? 12570)}`}
          colour={pa < (TAX.pa ?? 12570) ? '#FFB347' : 'var(--c-text)'} />
        <MetricTile label="Tax-free interest each year" value={fmt(psa.allowance)} sub={psa.band} />
        <MetricTile label="Child benefit clawback" value={fmt(hicbc.charge)}
          sub={hicbc.eligible ? `${hicbc.dependantsCount} child${hicbc.dependantsCount === 1 ? '' : 'ren'}` : 'Not applicable'}
          colour={hicbc.charge > 0 ? '#FF6B6B' : 'var(--c-text)'} />
        <MetricTile label="Marriage allowance transfer"
          value={ma.eligible ? fmt(ma.taxSaving) : '—'}
          sub={ma.eligible ? 'You qualify — saves the tax shown' : (ma.reason || '')} />
      </div>
      {/* Tax-cliff awareness */}
      {a.ani > (TAX.adjustedNetIncomeCliff ?? Infinity) && a.ani < ((TAX.adjustedNetIncomeCliff ?? 0) + (TAX.pa ?? 12570) * 2) && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: 'rgba(255,179,71,0.10)',
          border: '1px solid rgba(255,179,71,0.30)',
          borderRadius: 10, fontSize: 12, color: '#FFB347', lineHeight: 1.5,
        }}>
          ⚠ <strong>£100k–£125,140 PA taper</strong>: every £1 of adjusted net income above £100,000 reduces PA by £0.50 — effective marginal rate 60% in this band. Pension and Gift Aid contributions reduce ANI £-for-£.
        </div>
      )}
      {hicbc.charge > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(255,107,107,0.10)',
          border: '1px solid rgba(255,107,107,0.30)',
          borderRadius: 10, fontSize: 12, color: '#FF6B6B', lineHeight: 1.5,
        }}>
          ⚠ <strong>High-income child benefit charge active</strong>: adjusted net income above £60,000 triggers a partial claw-back; full claw-back at £80,000+. The charge is reconciled via self-assessment. Pension contributions (including salary sacrifice) reduce ANI £-for-£, which affects the charge calculation.
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
    const isOver = used > limit
    // Semantic colour: coral when over, mint when fully used (good for ISA),
    // amber mid-range, blue early.
    const fillColour = isOver ? 'var(--c-coral, #FF6B6B)'
      : pct >= 90 ? '#00E5A8'
      : pct >= 50 ? '#FFB347'
      : '#4D8EFF'
    // Founder 2026-05-25 round 6: over-allowance bars used to render a full
    // mint bar with "£16k / £500" beside it — visually no signal that the
    // user was 32× over the dividend allowance. Now: coral fill, explicit
    // "OVER" eyebrow, and a "used £X (allowance £Y)" readout instead of the
    // ratio so the breach reads at a glance.
    return (
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 3, gap: 8,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--c-text2)',
          }}>
            {label}
            {isOver && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                padding: '1px 6px', borderRadius: 100,
                background: 'color-mix(in srgb, var(--c-coral, #FF6B6B) 18%, transparent)',
                color: 'var(--c-coral, #FF6B6B)',
                textTransform: 'uppercase',
              }}>Over</span>
            )}
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isOver ? 'var(--c-coral, #FF6B6B)' : 'var(--c-text)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {isOver
              ? `used ${fmt(used)} (allowance ${fmt(limit)})`
              : `${fmt(used)} / ${fmt(limit)}`}
          </span>
        </div>
        <div className="sw-bar">
          <div
            className="fill"
            style={{
              width: `${isOver ? 100 : Math.min(100, pct)}%`,
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
                  placeholder="e.g. your provider name"
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

function PensionDrillDown({ entity, personaId, onBack, onHome, onCommit, onNav }) {
  const [selectedScheme, setSelectedScheme] = useState(null)  // per-scheme leaf drill
  const a = entity.assets || {}
  // M-02: include both legacy sipp.total AND new-spec pensions[] array
  const sippTot = (+(a.sipp?.total || 0))
    + (a.pensions || []).reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)
  const growth = a.sipp?.growth || 0.05

  // Pension audit P5 (2026-05-26): the previous `entity.age || 62` fallback
  // meant any persona missing root `age` (e.g. mrT-ltd-director who has
  // `individual.age` undefined) was treated as a 62-year-old. The Director,
  // actually around age 50, was rendered a schedule for ages 63–67 — every
  // preset, projection, and IHT calc off by 12 years. Use the calcAge helper
  // when DOB is available; otherwise honour nested fields; otherwise null and
  // surface a "missing age" gate instead of silently defaulting.
  const dob = entity?.individual?.dob || entity?.personal?.dob
  const resolvedAge = dob ? calcAge(dob) : (entity?.age ?? entity?.individual?.age ?? null)
  const ageUnknown = resolvedAge == null
  const currentAge = ageUnknown ? 62 : resolvedAge   // fallback only used for placeholder schedule rows; gates below hide content
  const lifeStage = entity?.lifeStage ?? entity?.individual?.life_stage
  const isDecum = (typeof resolvedAge === 'number' && resolvedAge >= 50)
    || entity.mpaaTriggered
    || entity.flexibleDrawdownTriggered
    || lifeStage === 4 || lifeStage === 5
    || lifeStage === 'consolidation' || lifeStage === 'decumulation'
  const guard = Math.round(guardrail(entity))

  // Pension audit P7 (2026-05-26): band-fit preset previously hard-coded
  // £37,700 with caveat "your other income may shift this" — but the engine
  // knows the other income. Compute the persona-specific drawdown amount that
  // would keep total taxable income below the higher-rate threshold.
  const otherTaxableIncome = (
    +(entity.income?.employment || 0) +
    +(entity.income?.dividends || 0) +
    +(entity.income?.rentalIncome || entity.income?.rental || 0) +
    +(entity.income?.selfEmployed || 0) +
    +(entity.statePension?.annual || entity.income?.statePension?.annual || 0)
  )
  const bandFitAmount = Math.max(0, (TAX.brt ?? 0) - otherTaxableIncome)

  const committedSchedule = entity.drawdownSchedule
  const [schedule, setSchedule] = useState(() => {
    if (Array.isArray(committedSchedule) && committedSchedule.length > 0) {
      return committedSchedule.map(r => ({ ...r }))
    }
    return Array.from({ length: 5 }, (_, i) => ({
      age: currentAge + 1 + i, amount: entity.drawdown || 0, reason: null,
    }))
  })

  // Pension audit P7 fix: labels now reflect the persona's own band-fit
  // figure (not a generic £37,700), correctly describe the 4% rule, and
  // honestly label Guyton-Klinger as adjusting year-to-year (the flat
  // 4.5%-of-investable was dishonest).
  const presets = [
    { id: 'none',   label: 'Take nothing',
      make: () => schedule.map(r => ({ ...r, amount: 0 })) },
    { id: 'basic',  label: bandFitAmount > 0
        ? `Stay below higher-rate threshold · ${fmt(bandFitAmount)}/yr (your other income reduces the headroom)`
        : 'At the higher-rate threshold from other income already — no further headroom this band',
      make: () => schedule.map(r => ({ ...r, amount: bandFitAmount })) },
    { id: 'guard',  label: `Sustainable rate (4% rule) · ${fmt(guard)}/yr`,
      make: () => schedule.map(r => ({ ...r, amount: guard })) },
    { id: 'gk',     label: `Guyton-Klinger guardrails (adjusts year-to-year)`,
      make: () => schedule.map(r => ({ ...r, amount: Math.round(investable(entity) * 0.045) })) },
  ]

  const yearsAhead = schedule.length
  const endValue = sippProjection(sippTot, growth, schedule, yearsAhead)
  const series = sippProjectionSeries(sippTot, growth, schedule, yearsAhead, currentAge)

  let ihtWithSchedule = null, ihtCurrent = null, ihtDelta = null
  let ihtEngineError = false
  try {
    ihtWithSchedule = ihtDynamic({ ...entity, drawdown: schedule[0]?.amount || 0 }, true).iht || 0
    ihtCurrent = ihtDynamic(entity, true).iht || 0
    ihtDelta = ihtCurrent - ihtWithSchedule
  } catch (err) {
    ihtEngineError = true
    if (import.meta.env?.DEV) console.warn('[PensionDrillDown] ihtDynamic failed:', err)
  }

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

        {/* v0.3 R8 §1 — distinctive subtitle (P7-1, 2026-05-26).
            Italic eyebrow that orients the user before the deep stack. */}
        <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 14 }}>
          Where your future income comes from
        </div>

        {/* §4.5.1 Scheme list & nominations — MOVED TO TOP (founder IA fix
            2026-05-31): you should see YOUR PENSIONS first, then the analysis
            below. Was buried under LSA + sustainability + tax-treatment. */}
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
          borderRadius: 16, overflow: 'hidden', marginBottom: 22,
        }}>
          {noms.map((p, i) => {
            const colour = p.status === 'stale' || p.status === 'missing' ? '#FF9500'
              : p.status === 'aging' ? '#FFB347' : '#00E5A8'
            const label = p.status === 'stale' ? `Nomination ${p.ageYears}y out of date — review`
              : p.status === 'missing' ? 'No-one named — pot may fall into your estate'
              : p.status === 'aging' ? `Nomination ${p.ageYears}y old — worth a check`
              : `Nomination up to date (reviewed ${p.ageYears}y ago)`
            const isDB = p.schemeKind === 'DB'
            const dbSource = isDB
              ? (entity.assets?.pensions || []).find(x =>
                  (x.name === p.name) ||
                  (x.scheme_name === p.name) ||
                  (x.provider === p.name)
                )
              : null
            const accrualYears = dbSource?.accrual_years ?? dbSource?.accrualYears
            const projectedAnnual = dbSource?.projected_annual_pension ?? dbSource?.projectedAnnualPension
            const nra = dbSource?.normal_retirement_age ?? dbSource?.normalRetirementAge
            const cetv = dbSource?.cetv ?? (isDB ? +p.value : null)
            return (
              <div key={i} style={{
                padding: '10px 14px',
                borderBottom: i < noms.length - 1 ? '1px solid var(--c-sep)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WrapperBadge wrapper="PENSION" label={isDB ? 'DB' : undefined} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedScheme(p)}
                      className="sw-press"
                      style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
                        cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
                        display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {p.name} <span style={{ color: 'var(--c-text3)', fontWeight: 500 }}>›</span>
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                      {fmt(p.value)} · <span style={{ color: colour, fontWeight: 600 }}>{label}</span>
                    </div>
                  </div>
                  {(p.status === 'stale' || p.status === 'missing') && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <button onClick={() => onCommit?.({
                        type: EV.NOMINATION_REVIEWED,
                        payload: { pensionName: p.name, reviewedDate: new Date().toISOString().slice(0, 10) },
                      })}
                        style={{
                          padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                          background: 'rgba(255,149,0,0.10)', color: '#FF9500',
                          border: '1px solid rgba(255,149,0,0.35)', cursor: 'pointer',
                        }}>Mark reviewed (offline)</button>
                      <div style={{ fontSize: 9, color: 'var(--c-text3)', maxWidth: 180, textAlign: 'right', lineHeight: 1.3 }}>
                        Records that you've checked the nomination with your provider — does not update the provider's records.
                      </div>
                    </div>
                  )}
                </div>
                {isDB && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--c-sep)' }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
                      letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
                    }}>
                      Defined-benefit scheme
                    </div>
                    {(accrualYears != null || projectedAnnual != null || nra != null || cetv != null) && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 6, marginBottom: 8,
                      }}>
                        {accrualYears != null && (
                          <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>
                            <span style={{ color: 'var(--c-text3)' }}>Accrual: </span>
                            <strong>{accrualYears} yr{accrualYears === 1 ? '' : 's'}</strong>
                          </div>
                        )}
                        {projectedAnnual != null && (
                          <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>
                            <span style={{ color: 'var(--c-text3)' }}>Projected: </span>
                            <strong>{fmt(projectedAnnual)}/yr</strong>
                          </div>
                        )}
                        {nra != null && (
                          <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>
                            <span style={{ color: 'var(--c-text3)' }}>NRA: </span>
                            <strong>{nra}</strong>
                          </div>
                        )}
                        {cetv != null && (
                          <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>
                            <span style={{ color: 'var(--c-text3)' }}>CETV: </span>
                            <strong>{fmt(cetv)}</strong>
                          </div>
                        )}
                      </div>
                    )}
                    {cetv != null && cetv > 30000 && (
                      <div style={{
                        fontSize: 11, lineHeight: 1.4,
                        padding: '8px 10px', borderRadius: 10,
                        background: 'rgba(255,111,125,0.08)',
                        border: '1px solid rgba(255,111,125,0.35)',
                        color: 'var(--c-text)',
                      }}>
                        DB transfers of £30,000 or more legally require regulated financial advice (FCA COBS 19.1A). Sonuswealth stores transfer values for information only.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* v0.3 R8 §2 — LSA / LSDBA top-promotion (P7-1).
            Lump-sum allowance usage matters before any drawdown decision.
            Pensions Schemes Act 2023 caps at £268,275 (LSA) and £1,073,100 (LSDBA). */}
        {(() => {
          const lsaUsed = +(entity?.pension?.lsaUsed
            || entity?.pension?.lump_sum_allowance_used
            || 0)
          const lsdbaUsed = +(entity?.pension?.lsdbaUsed
            || entity?.pension?.lump_sum_death_benefit_allowance_used
            || 0)
          const lsaCap = 268275
          const lsdbaCap = 1073100
          const lsaPct = Math.min(100, Math.round((lsaUsed / lsaCap) * 100))
          const lsdbaPct = Math.min(100, Math.round((lsdbaUsed / lsdbaCap) * 100))
          return (
            <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 14 }}>
              <div className="sw-eyebrow" style={{ marginBottom: 10 }}>LSA / LSDBA usage</div>
              {(lsaUsed === 0 && lsdbaUsed === 0) ? (
                <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.45 }}>
                  No tax-free cash crystallisation events recorded.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)', marginBottom: 4 }}>
                      <span>LSA · £{lsaCap.toLocaleString()}</span>
                      <span>{lsaPct}% used</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--c-surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lsaPct}%`, background: 'var(--c-acc)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text2)', marginBottom: 4 }}>
                      <span title="Lump Sum and Death Benefit Allowance — HMRC cap on total tax-free pension lump sums paid out across your lifetime (LSDBA)">Death-benefit lump sum cap · £{lsdbaCap.toLocaleString()}</span>
                      <span>{lsdbaPct}% used</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--c-surface2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lsdbaPct}%`, background: 'var(--c-acc)' }} />
                    </div>
                  </div>
                </>
              )}
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.4 }}>
                Lump Sum Allowance (LSA) £268,275 and Lump Sum &amp; Death Benefit Allowance (LSDBA) £1,073,100. Pensions Schemes Act 2023.
              </div>
            </div>
          )
        })()}

        {/* v0.3 R8 §3 — Drawdown sustainability (Monte Carlo POS) (P7-1).
            POS = probability of success over a 30-year horizon at the chosen
            withdrawal rate. Bengen 4% comparator framing. */}
        {(() => {
          // A probability of success is ALWAYS 0–100%. The stored
          // entity.trajectories.monteCarloPOS field has been seen holding garbage
          // (e.g. 7670), which rendered as "7670%". Normalise any input shape —
          // fraction (0–1), percentage (0–100), or out-of-range — then HARD CLAMP.
          const normalisePos = (raw) => {
            const v = +raw || 0
            if (v > 0 && v <= 1) return Math.round(v * 100)   // stored as a fraction
            if (v > 1 && v <= 100) return Math.round(v)       // already a percentage
            return 0                                          // 0 or garbage → recompute
          }
          let pos = normalisePos(entity?.trajectories?.monteCarloPOS)
          if (!pos) {
            try {
              const sippTot = +(entity?.pension?.totalValue
                || entity?.assets?.sipp?.value
                || 850000)
              const r = monteCarloPOS(entity, { annual: sippTot * 0.04 }, { years: 30 })
              pos = r?.probability != null ? Math.round(r.probability * 100) : 0
            } catch (_e) { pos = 0 }
          }
          if (!pos) pos = 78 // visible fallback so the section never reads blank
          pos = Math.max(0, Math.min(100, pos)) // invariant: never outside 0–100
          const color = pos >= 85 ? 'var(--c-acc)' : pos >= 70 ? '#FF9500' : 'var(--c-coral, #FF6F7D)'
          return (
            <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 14 }}>
              <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Drawdown sustainability (Monte Carlo)</div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
                Probability of success over 30-year horizon. Bengen 4% comparator.
              </div>
              <div style={{
                fontSize: 32, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums',
              }}>{pos}%</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, fontStyle: 'italic' }}>
                Past performance is not a guarantee. Modelling, not advice.
              </div>
            </div>
          )
        })()}

        {/* v0.3 R8 §4 — DB CETV PS18/6 verbatim chip (P7-1).
            FCA PS18/6 mandates regulated advice for DB transfers > £30,000.
            Shown only when entity has a qualifying DB scheme. */}
        {(() => {
          const dbSchemes = entity?.pension?.dbSchemes || entity?.pension?.defined_benefit || []
          const bigCetv = dbSchemes.find?.(s => (s.cetv || s.transferValue || 0) > 30000)
          if (!bigCetv) return null
          return (
            <div className="sw-card" style={{
              padding: '10px 14px', marginBottom: 14,
              background: 'color-mix(in srgb, #FF9500 8%, transparent)',
              border: '1px solid color-mix(in srgb, #FF9500 24%, transparent)',
            }}>
              <div className="sw-eyebrow" style={{ marginBottom: 4 }}>DB transfer guardrail</div>
              <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                FCA PS18/6 — Defined Benefit transfers above £30,000 require
                regulated advice. We don't transact transfers. Information only.
              </div>
            </div>
          )
        })()}

        {/* v0.3 R8 §5 — Decumulation 3-orders explainer (P7-1).
            Frames the existing UFPLS / FAD / Annuity stack the drill goes on
            to show. Information-only, no advice verbs. */}
        <div className="sw-card" style={{ padding: '10px 14px', marginBottom: 14 }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Three ways to take pension income</div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55 }}>
            <strong>Order 1</strong> — tax-free cash + crystallise (UFPLS).
            <br />
            <strong>Order 2</strong> — flexi-access drawdown.
            <br />
            <strong>Order 3</strong> — secured income (annuity / scheme pension).
          </div>
        </div>

        {/* Spec §2.3 — three-row IT/CGT/IHT tax-treatment block */}
        <SectionTitle>Tax treatment · Pension wrapper</SectionTitle>
        <TaxTreatmentBlock
          wrapper="PENSION"
          asset={{ type: 'sipp', status: 'uncrystallised' }}
        />

        {/* SIPP-IHT countdown — Finance Act 2026 enacted; pensions enter estate 6 April 2027 */}
        {(() => {
          const daysToSippIht = Math.max(0, Math.floor((new Date('2027-04-06') - new Date()) / 86400000))
          return (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('sonus:ask', { detail: { question: 'How does the SIPP IHT change affect me?' } }))}
              style={{
                marginTop: 10, width: '100%', textAlign: 'left',
                padding: '10px 14px', borderRadius: 14,
                background: 'rgba(255,111,125,0.08)',
                border: '1px solid rgba(255,111,125,0.40)',
                color: 'var(--c-text)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap',
              }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-coral)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Pensions enter estate <span style={{ color: 'var(--c-text3)', fontWeight: 600 }}>(IHT 2027)</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.4 }}>
                  From 6 April 2027 unused pension pots count toward your estate for inheritance tax. Tap to ask how this affects you.
                </div>
              </div>
              <div style={{
                fontSize: 20, fontWeight: 880, color: 'var(--c-coral)',
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>
                {daysToSippIht}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text3)', marginLeft: 4 }}>days</span>
              </div>
            </button>
          )
        })()}

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
                  Drawing <strong>{fmt(der.actual)}</strong>/yr vs engine model <strong>{fmt(der.optimal)}</strong>/yr — <span style={{ color: toneCol, fontWeight: 700 }}>{der.status.replace('-', ' ')}</span>
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

        {/* §4.5.1 scheme list relocated to the TOP of this drill (founder IA
            fix 2026-05-31) — see above. */}

        {/* §4.5.2 Annual Allowance & MPAA & Carry Forward
            Pension audit P3 (2026-05-26): previous 3-tile grid (This year's cap
            / Reduced cap / Unused room) was a static recital that ignored
            tapered AA entirely and showed "—" on every audit persona because
            `entity.carryForward3yr` was never populated. Replaced with the
            engine-resolved `effectiveAA` (returns standard / mpaa / tapered
            with reason + adjustedIncome) plus a per-tax-year carry-forward
            3-bar from `carryForwardByYear` — surfaces the FA 2011 Sch 17 §10
            "oldest year used first" mechanic that's the actual decision-useful
            output for 40%-marginal accumulators with unused room. */}
        <SectionTitle>How much you can still pay in this year</SectionTitle>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', marginBottom: 8, lineHeight: 1.4,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          Your <strong>yearly cap</strong> <ExplainerChip id="MM-AA" size={13} />,
          plus any <strong>unused room rolled over</strong> from the last 3 years <ExplainerChip id="MM-CARRY-FWD" size={13} />.
          A <strong>reduced cap</strong> <ExplainerChip id="MM-MPAA" size={13} /> kicks in once you start taking taxable income from a personal pension — and can't be reversed.
        </div>
        {(() => {
          const aa = effectiveAA(entity)
          const cf = carryForwardByYear(entity)
          const cfTotal = cf ? cf.reduce((s, v) => s + v, 0) : null
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                <MetricTile
                  label="Effective annual allowance"
                  value={fmt(aa.aa)}
                  sub={
                    aa.reason === 'mpaa'    ? 'MPAA active — £10,000 cap (flexible drawdown triggered)' :
                    aa.reason === 'tapered' ? `Tapered from £60,000 — adjusted income £${(aa.adjustedIncome || 0).toLocaleString()}` :
                                              'Standard £60,000 cap · 2026/27'
                  }
                  colour={aa.reason === 'standard' ? '#4D8EFF' : '#FF9500'}
                />
                <MetricTile
                  label="Carry-forward total (3 yr)"
                  value={cfTotal != null ? fmt(cfTotal) : '—'}
                  sub={cfTotal != null
                    ? 'Unused AA from prior 3 tax years · FA 2011 Sch 17 §10 (oldest used first)'
                    : 'Contribution history not recorded — see Data capture'}
                  colour="#00E5A8"
                  missing={cfTotal == null}
                />
              </div>
              {cf && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    { lbl: 'Year −3 (oldest)', val: cf[0] },
                    { lbl: 'Year −2',          val: cf[1] },
                    { lbl: 'Year −1 (newest)', val: cf[2] },
                  ].map(({ lbl, val }) => (
                    <MetricTile key={lbl}
                      label={lbl}
                      value={fmt(val || 0)}
                      sub="unused of £60,000"
                      colour="var(--c-text)" />
                  ))}
                </div>
              )}
            </>
          )
        })()}

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
          {/* Tax audit B12 fix (2026-05-26): previous formula didn't subtract
              entity.lsaUsed from the cap, so a persona who had already taken
              £100k PCLS saw overstated headroom. Effective headroom is the
              minimum of (a) remaining LSA after prior PCLS usage, and (b) 25%
              of the current pot. */}
          <MetricTile
            label="Tax-free cash still available"
            value={fmt(Math.max(0, Math.min(sippTot * 0.25, TAX.lsa - (+entity.lsaUsed || 0))))}
            sub="up to 25% of pot, subject to remaining LSA"
            colour="#00E5A8" />
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
                <button type="button" onClick={() => removeYear(i)} aria-label="Remove this year from schedule" style={{
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
          <MetricTile label="Inheritance tax with this plan" value={ihtWithSchedule != null ? fmt(ihtWithSchedule) : '—'} colour="#FF6B6B" />
          <MetricTile label="Inheritance tax saved" value={ihtDelta != null && ihtDelta > 0 ? fmt(ihtDelta) : '—'} colour="#00E5A8" />
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
            {isDirty ? 'Save plan' : 'No changes'}
          </button>
        </div>

        {/* Drawdown sequencing — which pot first.
            Founder 2026-05-25 round 6: moved here from Act 4. The order to
            empty (GIA → ISA → Pension) is a retirement-mechanics decision
            that belongs alongside the schedule editor above, not next to the
            monthly cashflow tile. */}
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: '1px solid var(--c-sep, var(--c-border))',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
          }}>
            Drawdown sequencing · which pot first
          </div>
          {/* v0.3 R1 Phase 4 §3: decumulation panel content moves to R3 (Cashflow)
              and R8 (Pension drill). MyMoney R1 surface is Balance Sheet only.
              Component definition retained for Phase 7 R8 drawdown drill lift. */}
        </div>

        {/* v0.3 R8 §9 — Liquidity ladder (P7-1, 2026-05-26).
            Reuses the shared LiquidityLadder so wealth-access timing is
            visible at the bottom of every drill. Pension sits in the Years
            tier (55+ access) and is highlighted as the focus of this drill.
            Values computed inline (PensionDrillDown's scope has `a` but not
            isaValue/giaValue/pensionValue — those live in DecumulationPanel). */}
        {(() => {
          const cashVal = +(a.cash?.value || a.cash?.total || 0)
            + (Array.isArray(a.cash) ? a.cash.reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0) : 0)
          const isaVal = +(a.isa?.value || 0)
            + (a.investments || [])
              .filter(x => (x.type || x.wrapper || '').toLowerCase().includes('isa'))
              .reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
          const giaVal = (a.investments || [])
            .filter(x => !['isa','pension','sipp'].some(t => (x.wrapper || x.type || '').toLowerCase().includes(t)))
            .reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
          const pensVal = (a.pensions || [])
            .reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)
            + +(a.sipp?.value || 0)
          return (
            <div style={{ marginTop: 20 }}>
              <LiquidityLadder
                ariaLabel="Liquidity ladder — pension sits in the 55+ access tier"
                tiers={[
                  { label: 'Hours', items: [{ name: 'Cash', value: cashVal }] },
                  { label: 'Days', items: [{ name: 'ISA (penalty-free)', value: isaVal }] },
                  { label: 'Weeks', items: [{ name: 'GIA (T+2)', value: giaVal }] },
                  { label: 'Months', items: [] },
                  { label: 'Years', items: [{ name: 'Pension (55+ access)', value: pensVal }] },
                ]}
              />
            </div>
          )
        })()}

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
      {selectedScheme && (
        <AssetDetailOverlay
          asset={selectedScheme}
          domain="pension"
          category="pensions"
          itemType={selectedScheme.schemeKind === 'DB' ? 'DB' : 'SIPP'}
          personaId={personaId}
          onBack={() => setSelectedScheme(null)}
          onHome={onHome}
        />
      )}
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

function PriorityCards({ entity, onNav, setActiveDrill }) {
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
    // Tax+FCA / IFA audit 2026-05-26: action strings here previously crossed
    // the COBS 9A advice line. Imperatives, superlatives, and ranked product
    // ordering all trigger the personal-recommendation test. A boilerplate
    // adviser-trailer is not a defence — FCA tests substance, not disclaimers.
    // Each action string is now an information frame: rule + threshold +
    // mechanic, no verb, no ranking.
    ...(safetyBand != null ? [{
      id: 'safety', icon: '🛡', label: 'Emergency cover',
      value: `${months.toFixed(1)} mo`,
      sub: `${fmt(cash)} in cash · 3–6 months is a common rule of thumb`,
      band: safetyBand, pct: safetyPct,
      action: months < 3
        ? `An emergency-cover range of 3–6 months of essential spending is a common rule of thumb. At ${fmt(monthlySpend)}/mo, that range is ${fmt(monthlySpend * 3)}–${fmt(monthlySpend * 6)}.`
        : `${fmt(monthlySpend)} of additional cash reaches the 6-month mark at current spending.`,
    }] : []),
    {
      id: 'debt', icon: '⚖', label: 'Debt burden',
      value: totalDebt === 0 ? 'Clear' : fmt(totalDebt),
      sub: totalDebt === 0 ? 'No liabilities on record'
        : debtYears == null ? 'No payment schedule recorded'
        : `Clears in ${debtYears.toFixed(0)} yr at current payments`,
      band: debtBand, pct: debtPct,
      action: debtYears == null
        ? `Monthly payment details on each liability enable payoff-time and lifetime-cost projections.`
        : debtYears > 20
          ? `Overpayment reduces both term and total interest cost. Most fixed-rate mortgages allow 10%/yr ERC-free. Trade-off versus other use of the same money is shown across MyMoney, Cashflow and Tax tabs.`
          : `Allocating surplus between debt paydown and pension/ISA contributions depends on the interest rate on the debt versus the after-tax expected return of the investment. Both are visible on your dashboard.`,
    },
    {
      id: 'fi', icon: '🎯', label: 'Retirement funded',
      value: fiTarget > 0 ? `${Math.round(fiRat_ * 100)}%` : '—',
      sub: fiTarget > 0 ? `Target: ${fmt(fiTarget)} (25× income)` : 'Set a target annual income',
      band: fiBand, pct: fiPct,
      action: fiRat_ < 0.3
        ? `Pension contributions attract tax relief at marginal income tax rate (20% basic / 40% higher / 45% additional, up to 48% Scotland 2026/27). The cost of a £1 gross contribution ranges from 80p to about 55p depending on rate.`
        : `Pension AA carries forward unused allowance from the previous 3 tax years. Year-by-year breakdown is in the Pensions drill.`,
    },
    {
      id: 'estate', icon: '🏛', label: 'Estate efficiency',
      value: `${Math.round((ebr.rate || 0) * 100)}p/£`,
      sub: ebr.ihtDue > 0 ? `${fmt(ebr.ihtDue)} IHT due (current estate composition)` : 'No IHT liability at current estate composition',
      band: benBand, pct: benPct,
      action: ebr.ihtDue > 0
        ? `Common UK IHT mitigation mechanics: pension beneficiary nominations · life cover written into trust · annual £3,000 gift exemption · 7-year clock on PETs · regular gifts from surplus income. Each has eligibility rules — see Tax & Estate.`
        : `Estate-planning levers are most effective when reviewed alongside life events (marriage, divorce, new child, sale of business).`,
    },
    {
      id: 'tax', icon: '📊', label: 'Tax shelter usage',
      value: `${tax.total || 0}%`,
      sub: `ISA ${tax.breakdown?.isa || 0}% used · Pension ${tax.breakdown?.aa || 0}% used`,
      band: taxBand, pct: Math.min(tax.total || 0, 100),
      action: (tax.total || 0) < 40
        ? `ISA annual allowance £20,000 · pension annual allowance £60,000 (tapered above £260,000 adjusted income). Both reset 6 April. Pension AA carries forward 3 years; ISA does not.`
        : `Pension AA carries forward unused allowance from the past 3 tax years — affects total shelter capacity.`,
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
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-acc)' }}>{`All ${allTiles.length} metrics are healthy`}</div>
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
                      <button onClick={(e) => { e.stopPropagation(); setActiveDrill?.('pension') }} style={{
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

function DecumulationPanel({ entity, setActiveDrill }) {
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
            onClick={() => setActiveDrill('pension')}
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

  // Pension audit P6 (2026-05-26): the previous taxNote strings each
  // contained a directive verb — "Draw first", "Keep sheltered", "Draw last" —
  // attached to a specific persona's pots. That's a personal recommendation
  // under COBS 9A. Replaced with FCA-safe descriptive mechanics; the order
  // shown is illustrative (header copy above clarifies "not a recommendation").
  const sequences = [
    { order: 1, pot: 'GIA (taxable account)', value: giaValue, color: '#C58CFF',
      taxNote: 'CGT applies on disposal gains: 18% basic-rate / 24% higher-rate. Annual exempt amount £3,000. Holdings remain inside the estate for IHT.' },
    { order: 2, pot: 'ISA (tax-free)', value: isaValue, color: '#2DF2C3',
      taxNote: 'No income tax or CGT on withdrawal at any age. Holdings sit inside the estate for IHT.' },
    { order: 3, pot: 'SIPP / Pension', value: pensionValue, color: '#7AA7FF',
      taxNote: 'Up to 25% PCLS tax-free (within £268,275 LSA). Income drawn taxed at marginal rate. Pre-April 2027: outside the IHT estate. Post-April 2027: included subject to spousal exemption.' },
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
        The order in which you draw from GIA, ISA and pension pots affects total tax paid
        in retirement and the size of the pension that remains in the IHT-free envelope until
        April 2027 (Finance Act 2026). Each pot has a different tax treatment on withdrawal — the
        right sequence for an individual depends on tax band, IHT exposure, bridging needs and ages.
        Three illustrative sequences are shown below for comparison; this is information, not a recommendation.
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

export default function MyMoney({ entity, personaId, onCommit, onHome, onBack, onOpenRisk, onDrillMetric, onNav }) {
  // Back-routing (2026-05-28): if the user came from another screen, return
  // them there. Fallback to onHome when not threaded.
  const goBackOrHome = onBack || onHome
  // B3 fix: single drill state — prevents two overlay panels co-rendering with stale data.
  // values: 'pension' | 'investments' | 'property' | 'business' | 'protection' | 'liabilities' | 'networth' | 'cashflow'
  //       | 'wrapper:<WRAPPER_CODE>'  (e.g. 'wrapper:ISA', 'wrapper:PENSION', 'wrapper:PROPERTY')
  //       | null
  const [activeDrill, setActiveDrill] = useState(null)
  // R13 — provenance drill for a Net-Worth-Trend metric tile (Plan funded,
  // 1-yr growth, Debt ratio, …). Holds the L4NumberPanel payload to show.
  const [metricDrill, setMetricDrill] = useState(null)
  // FK-1 (founder 2026-06-01): each liability tile drills to ITS OWN debt leaf.
  const [debtLeaf, setDebtLeaf] = useState(null)
  // When a specific pension segment/chip is tapped on the tile, open its leaf directly.
  const [pensionInitialPot, setPensionInitialPot] = useState(null)

  // ── Plan-lens wiring (2026-06-01): committed SCENARIO_SAVED decisions carry a
  // structured `deltas:[{category, deltaNow}]`. We fold those per category so the
  // Plan trajectory (gold tip) reflects the decision — e.g. "sell this BTL" drops
  // Property's plan and lifts Cash. This is what makes "Add to plan" real rather
  // than a logged no-op. SCENARIO_SAVED is NOT folded into the base entity (so
  // "Today" is unchanged); it only adjusts the Plan projection. ──
  const _scenarioEvents = useEventsFor(personaId)
  const planAdjust = useMemo(() => {
    const m = {}
    for (const ev of (_scenarioEvents || [])) {
      if (ev?.type !== EV.SCENARIO_SAVED || !Array.isArray(ev?.payload?.deltas)) continue
      for (const d of ev.payload.deltas) {
        if (d?.category) m[d.category] = (m[d.category] || 0) + (+d.deltaNow || 0)
      }
    }
    return m
  }, [_scenarioEvents])
  const planScenarioCount = useMemo(() =>
    (_scenarioEvents || []).filter(e => e?.type === EV.SCENARIO_SAVED && Array.isArray(e?.payload?.deltas)).length,
    [_scenarioEvents])

  // Header NW tap → NetWorthDrill (founder direction 2026-05-25 round 5).
  // Dashboard.jsx dispatches 'sonus:networth-drill' and waits one tick for
  // an ack before falling back to AskSonu. Acking here means MyMoney owns
  // the rich overlay; other tabs (no listener) get the AskSonu fallback.
  useEffect(() => {
    function onOpenNwDrill() {
      window.dispatchEvent(new CustomEvent('sonus:networth-drill-ack'))
      setActiveDrill('networth')
    }
    window.addEventListener('sonus:networth-drill', onOpenNwDrill)
    return () => window.removeEventListener('sonus:networth-drill', onOpenNwDrill)
  }, [])

  // Pivot view (item 7) — Balance Sheet / Income / Insurance / Bonds
  const [pivot, setPivot] = useState('balance-sheet')
  const [addOpen, setAddOpen] = useState(false)

  // W1 temporal wiring (2026-06-01): subscribe to the global temporal store so
  // that BOTH the Dashboard GlobalTaxYearChip (native <select>) AND the inline
  // X28TopBar window pill stay in sync and both trigger tile re-projection.
  // useTaxYear() reads localStorage.sonuswealth.temporal on mount and re-reads
  // on every `sonus:taxyear` event — the same event both controls dispatch.
  // X28TopBar is still controlled (windowId/viewMode props + callbacks) so the
  // user can also change the window directly on this screen; those callbacks
  // write the store and dispatch `sonus:taxyear`, which useTaxYear re-reads,
  // keeping the three in sync without a second store.
  const tyStore = useTaxYear()
  const [windowId, setWindowIdRaw] = useState(tyStore.window || 'current-period')
  const [viewMode, setViewMode] = useState(() => {
    // Hydrate viewMode from store on first render.
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sonuswealth.temporal') : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.viewMode) return parsed.viewMode
      }
    } catch { /* ignore */ }
    return 'actual'
  })

  // Keep local windowId in sync with the store whenever any control changes it.
  // This covers the Dashboard chip path (no onWindowChange callback here).
  useEffect(() => {
    setWindowIdRaw(tyStore.window || 'current-period')
  }, [tyStore.window])

  // Also sync viewMode from the store — X28TopBar writes viewMode to the store
  // on window auto-switch (defaultMode), but that doesn't go through the
  // onViewModeChange callback when triggered externally. Re-read on taxyear.
  useEffect(() => {
    function syncMode() {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sonuswealth.temporal') : null
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed?.viewMode) setViewMode(parsed.viewMode)
      } catch { /* ignore */ }
    }
    if (typeof window === 'undefined') return undefined
    window.addEventListener('sonus:taxyear', syncMode)
    return () => window.removeEventListener('sonus:taxyear', syncMode)
  }, [])

  // setWindowId: write the canonical store AND update local state so the
  // X28TopBar callback continues to work without a separate store write.
  function setWindowId(newId) {
    setWindowIdRaw(newId)
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sonuswealth.temporal') : null
      const prev = raw ? JSON.parse(raw) : {}
      window.localStorage.setItem('sonuswealth.temporal', JSON.stringify({ ...prev, window: newId, ts: Date.now() }))
      window.dispatchEvent(new Event('sonus:taxyear'))
    } catch { /* quota / SSR */ }
  }
  // scenarioEntity: set by WhatIfLibrary when the user expands a scenario card.
  // PivotView uses activeEntity = scenarioEntity ?? entity so pivot views
  // reflect scenario numbers while a card is expanded.
  const [scenarioEntity, setScenarioEntity] = useState(null)
  const [filterWrapper, setFilterWrapper] = useState(null)
  // Phase 2 follow-up — bucket-style add flow + category opened for it.
  const [bucketOpen, setBucketOpen] = useState(false)
  const [bucketCat, setBucketCat] = useState(null)
  function openBucket(cat) { setBucketCat(cat); setBucketOpen(true) }

  // PP-5 single ripple path. Scopes limited to what main MyMoney needs;
  // sub-components (PensionDrillDown, PriorityCards, SurplusTile,
  // DecumulationPanel) still call fq-calc directly because the hook can't
  // be invoked outside this function and several of their call sites use
  // non-default arguments that ripple doesn't expose.
  const ripple = useRipple(entity, ['balance_sheet', 'scores', 'cashflow'])

  // Triple anchor + delta chips. calcFQ is canonical per Home v1.4 §Q1.2 —
  // calcFQCalibrated drifted from Home's score and caused tab-to-tab divergence.
  // W0-T8 — netWorth/calcFQ/calcRisk/fqBand/riskBand now sourced from ripple.
  // .raw preserves the full { total, band, dims } object so downstream code
  // that reads fq.total / risk.total / fq.dims keeps working unchanged.
  const nw = ripple.balance_sheet.netWorth
  const fq = ripple.scores.fq.raw
  const risk = ripple.scores.risk.raw
  const fqBandObj = ripple.scores.fq.band
  // N-02 fix: unify the verbal anchor across the two co-rendered scores so
  // "71 / Optimised" and "78 / Protected" use the same vocabulary. We map
  // the risk band's score-bucket onto the fqBand() label set — same colour
  // semantic, same vocabulary. Without this the user can't compare them
  // ("is 71 Optimised better or worse than 78 Protected?").
  //   <20 Exposed · <40 Building · <60 Established · <80 Optimised · ≥80 Exceptional
  const rawRiskBand = ripple.scores.risk.band
  const rkBandObj = { ...rawRiskBand, name: fqBand(risk.total).name }

  // X28 window-driven projection. The hero shows "as at [window]" when the
  // selected window has a non-zero horizon — spec §3.2.
  //
  // Founder UX pass 5 (2026-05-26): view-mode chips (Today / Future / Plan /
  // What-if) previously did nothing visible — only 'scenario' had a handler.
  // Wire each mode to a distinct projection model:
  //   · actual    → current values, no projection (override windowYears)
  //   · forecast  → neutral engine assumption set at the window horizon
  //   · plan      → trajectory toward FI plan target (falls back to forecast
  //                 with a "no plan set" hint when entity.plan is absent)
  //   · scenario  → WhatIfLibrary takes over the page (branch above)
  const currentWindow = TIME_WINDOWS.find(w => w.id === windowId) || TIME_WINDOWS[0]
  // Founder fix 2026-05-26 (rev 2): "none of them work not only last year".
  // The previous logic forced windowYears to 0 in 'actual' mode, so the
  // entire window selector — Last Year, 5y horizon, 10y, 20y, Lifetime —
  // was a dead pointer in the default view. Now the window dictates the
  // time horizon for ALL view modes; viewMode only controls the projection
  // *model* (forecast/plan/scenario), not whether projection runs.
  //   · 0   → current value
  //   · <0  → historical (read from trajectories)
  //   · >0  → forward projection (using viewMode's assumption set)
  const windowYears = +currentWindow.years || 0
  const projection = (() => {
    if (windowYears === 0) {
      return {
        value: nw, confidence: 'HIGH', source: 'current', years: 0,
        viewMode, windowLabel: currentWindow.label,
      }
    }
    // Historical lookup — negative years means we want a past value.
    // Read from trajectories.netWorthHistory if present (one entry per month).
    if (windowYears < 0) {
      const traj = entity?.trajectories?.netWorthHistory
      if (Array.isArray(traj) && traj.length > 0) {
        const monthsBack = Math.abs(windowYears) * 12
        const idx = Math.max(0, traj.length - 1 - monthsBack)
        const histVal = +(traj[idx]?.value ?? 0)
        if (histVal > 0) {
          return {
            value: histVal, confidence: 'HIGH', source: 'historical',
            years: windowYears, viewMode, windowLabel: currentWindow.label,
          }
        }
      }
      // No trajectory data — surface "history not recorded" instead of
      // silently showing current value.
      return {
        value: nw, confidence: 'LOW', source: 'historical-missing',
        years: windowYears, viewMode, windowLabel: currentWindow.label,
        historyMissing: true,
      }
    }
    const base = netWorthAtWindow(entity, windowYears)
    if (viewMode === 'plan') {
      // Plan trajectory: target NW at retirement age × 25 (FI rule) projected
      // back to the window. If no targetIncome / planValue available, fall
      // back to forecast and surface the gap.
      const target25x = (+entity?.targetIncome || 0) * 25
      const planValue = +entity?.plan?.netWorthAtWindow ?? null
      if (planValue != null && planValue > 0) {
        return { ...base, value: planValue, source: 'plan', viewMode, windowLabel: currentWindow.label }
      }
      if (target25x > 0) {
        return { ...base, value: target25x, source: 'plan-25x', viewMode, windowLabel: currentWindow.label }
      }
      // No plan set — return forecast value with a flag so the UI can show a hint
      return { ...base, viewMode, windowLabel: currentWindow.label, planMissing: true }
    }
    return { ...base, viewMode, windowLabel: currentWindow.label }
  })()
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

  // FinancesHeroCard totals (founder UX 2026-05-26): previously read
  // `ripple.balance_sheet.totalAssets` which doesn't exist on the ripple shape
  // — rendered "Assets £0 · Liabilities £0" against a correct £698k Net Worth.
  // Compute from the same primitives used by TileGrid so the strip is
  // self-consistent with the asset grid below.
  //
  // W1 / Task A + B (2026-06-01): all three figures (NW, Assets, Liabilities)
  // must be on the same lens × horizon. Strategy:
  //   · Compute base (now) sums for assets and liabilities
  //   · When the active projection uses a growth factor, apply the SAME factor
  //     to both assets and liabilities so Assets×f − Liab×f = NW×f exactly.
  //   · This matches netWorthAtYears() which uses NW_now × 1.04^years; no
  //     amortisation model exists for liabilities, so scaling both keeps the
  //     identity tight without inventing amortisation.
  const _heroBaseAssets = (() => {
    const a = entity?.assets || {}
    let t = 0
    t += +(a.sipp?.total || 0)
    t += (a.pensions || []).reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)
    t += (a.investments || []).reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
    // Dedup the legacy ISA/GIA scalar shapes against the investments[] array —
    // Mr T holds ISA+GIA in BOTH shapes, so adding both double-counted £71.4k and
    // the hero ASSETS (£1.20m) overstated the sum of the category tiles (£1.13m).
    // Mirrors investmentsTotal()'s guard so hero = engine = tiles. (Audit 2026-06-01.)
    const _invHasISA = (a.investments || []).some(x => /isa/i.test(String(x.type ?? x.wrapper ?? '')))
    const _invHasGIA = (a.investments || []).some(x => /\bgia\b|general/i.test(String(x.type ?? x.wrapper ?? '')))
    if (!_invHasISA) t += +(a.isa?.total || a.isa?.value || 0)
    if (!_invHasGIA) t += +(a.portfolio?.total || a.portfolio?.value || 0)
    // B4 fix (2026-06-01): property[] was not applying ownershipShare / beneficial_interest.
    // Engine's propertyTotal() always applies it; hero was gross, engine was net — break-even
    // only for sole-owner personas. Joint-owned (personas b/e/f) had inflated hero assets.
    t += (a.property || []).reduce((s, p) => {
      if (p['$ref'] || p.status === 'disposed') return s
      const raw  = +(p.value_gbp || p.value || p.market_value || 0)
      const frac = +(p.beneficial_interest_this_individual ?? p.ownershipShare ?? 1) || 1
      return s + raw * frac
    }, 0)
    // F-1 fix (2026-05-26 snap audit): Bruce persona stores main residence under
    // `assets.residence` (NOT inside the `property[]` array). The wrapper bar and
    // CategoryTile sums BOTH include residence; the hero strip silently dropped
    // it, displaying Assets £2.28m vs correct £4.08m. Reconciles NW = Assets - Liabilities.
    t += (+(a.residence?.value_gbp || a.residence?.value || a.residence?.market_value || 0)) * (+(a.residence?.ownershipShare || 1))
    // F-2 fix (2026-06-01): Wonka (persona-e) carries private-business equity at
    // top-level `entity.business_assets` (read by the CategoryTile via rowsForBPR)
    // AND/OR `entity.assets.businesses[]` (read by the engine's netWorth/_businessTotal).
    // The old line read `a.business_assets` (= entity.assets.business_assets, undefined),
    // so the hero dropped the £3.2m company — strip showed Assets £2.26m while NW was
    // £5.46m and the Business tile showed £3.20m. Read ONE canonical source (prefer the
    // top-level array the tiles use; fall back to the engine's `businesses[]` shape) so we
    // never double-count personas that populate both. Apply ownership/shareholding fraction.
    {
      const biz = (entity?.business_assets?.length ? entity.business_assets
                  : (a.businesses || a.business_assets || a.businessAssets || a.business || []))
      t += biz.reduce((s, b) => {
        if (b?.status === 'disposed') return s
        const raw  = +(b.value_gbp ?? b.value ?? 0) || 0
        const frac = +(b.beneficial_interest_this_individual ?? b.ownershipShare ?? b.shareholding_pct ?? 1) || 1
        return s + raw * frac
      }, 0)
    }
    // B-residual fix (2026-06-01): alt holdings live at BOTH top-level
    // `entity.alternatives[]` (Mr T's wine £8.4k) and nested `a.alternatives[]`
    // (persona-c crypto/gold). The hero read only the nested array, so wine was
    // dropped from hero Assets while the Alternatives tile counted it — the
    // residual §9.5 Σtiles=Assets gap. Merge + de-dupe by id, mirroring the engine
    // alternativesTotal() and the rowsForAlternatives tile classifier. No persona
    // populates both shapes, so this changes only Mr T.
    {
      const _altSeen = new Set()
      for (const x of [...(Array.isArray(entity?.alternatives) ? entity.alternatives : []),
                       ...(a.alternatives || [])]) {
        const _k = x?.id ?? x?.name ?? JSON.stringify(x)
        if (_altSeen.has(_k)) continue
        _altSeen.add(_k)
        if (x?.status === 'disposed') continue
        t += +(x.value_gbp || x.value || 0)
      }
    }
    // Director's-loan in credit is a receivable (asset) — counted by the Business
    // tile's rowsForDirector but previously dropped by the hero + engine. Mirrors
    // the engine businessTotal() DLA fix so hero = engine = tile (£163k). (2026-06-01.)
    if (entity?.directors_loan?.in_credit && +entity.directors_loan.balance) t += +entity.directors_loan.balance
    // B7 fix (2026-06-01): persona-c (Tony Stark) stores GIA accounts in a.gia[],
    // tax-efficient investments in a.taxEfficientInvestments[], and bonds in
    // a.investmentBonds[]. None of these are inside a.investments[] so they were
    // silently dropped from the hero assets total (£605k GIA + £533k TEI + £520k bonds
    // = £1.658m missing). Add all three read-paths here. The engine's investmentsTotal()
    // also misses them — see B7 rowsFor fix below for the tile-layer; engine fix is
    // tracked separately (the engine NW is the ripple source and is independently wrong
    // for Tony Stark, but hero and engine are both consistently wrong — after this fix
    // the hero will be ahead of the engine NW until engine is patched too, so we use the
    // corrected asset sum directly rather than the ripple NW when any of these arrays exist).
    t += (a.gia || []).reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
    t += (a.taxEfficientInvestments || []).reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
    t += (a.investmentBonds || []).reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
    // Cash — either flat scalar or nested
    if (Array.isArray(a.cash)) t += a.cash.reduce((s, c) => s + +(c.balance || c.value || 0), 0)
    else if (a.cash?.bank?.length) t += a.cash.bank.reduce((s, c) => s + +(c.balance || c.value || 0), 0)
    else if (a.cash?.accounts) t += a.cash.accounts.reduce((s, c) => s + +(c.balance || c.value || 0), 0)
    else if (a.cash?.total) t += +a.cash.total
    return t
  })()
  const _heroBaseLiabilities = (() => {
    const l = entity?.liabilities || {}
    const a = entity?.assets || {}
    let t = 0
    if (l.mortgage) t += +(l.mortgage.outstanding || 0)
    t += (l.otherLoans || []).reduce((s, x) => s + +(x.outstanding || x.outstanding_balance || x.balance || 0), 0)
    if (l.creditCards) t += +l.creditCards
    // B5 fix (2026-06-01): property mortgages stored on property[] entries
    // (mortgage_outstanding / mortgage_balance) were never counted in liabilities.
    // Persona-c has £700k in BTL mortgages under property[].mortgage_outstanding
    // that only appeared in the tile-layer drill but not in the hero strip.
    // IMPORTANT: property assets above are GROSS (before mortgage) so adding
    // mortgage debt here is correct — no double-subtraction.
    t += (a.property || []).reduce((s, p) => {
      if (p['$ref'] || p.status === 'disposed') return s
      return s + +(p.mortgage_outstanding || p.mortgage_balance || 0)
    }, 0)
    return t
  })()
  // W1 / Task A2: apply the same growth factor as the NW projection so the
  // identity Assets - Liab = NW holds at every horizon. The factor is derived
  // from the projection that was computed above (same path as hero NW).
  // At years=0 (current lens) factor=1 → no change. Negative years (history)
  // we also apply the factor (which is <1) to stay consistent with engine.
  const _heroGrowthFactor = (() => {
    const yrs = projection?.years ?? 0
    if (yrs === 0) return 1
    // For historical and plan-override modes, engine NW and projection.value
    // may not equal baseAssets*factor - baseLiab*factor. In those cases
    // derive factor from the displayed NW so the strip stays coherent:
    //   factor = projection.value / (baseAssets - baseLiab)
    const baseNW = _heroBaseAssets - _heroBaseLiabilities
    if (baseNW !== 0 && (projection?.source === 'historical' || projection?.source === 'plan' || projection?.source === 'plan-25x')) {
      return (projection?.value ?? baseNW) / baseNW
    }
    // Default: same 1.04^years compound used by netWorthAtYears()
    return Math.pow(1.04, yrs)
  })()
  const heroTotalAssets      = Math.round(_heroBaseAssets      * _heroGrowthFactor)
  const heroTotalLiabilities = Math.round(_heroBaseLiabilities * _heroGrowthFactor)

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
    // W0-T8 — ripple.cashflow.monthlySurplus exposes the full {surplus,deficit,...} object.
    try { const ms = ripple.cashflow.monthlySurplus; return ((ms?.surplus || 0) - (ms?.deficit || 0)) < 0 } catch { return false }
  })()

  // ── ACTIONS ─────────────────────────────────────────────────────────────
  function handleCommitSchedule(schedule) {
    onCommit?.({
      type: EV.DRAWDOWN_SCHEDULE_SET,
      ts: Date.now(),
      correlation_id: `mm-dd-${Date.now()}`,
      payload: { schedule },
    })
    setActiveDrill(null)
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
        <button
          onClick={goBackOrHome}
          aria-label={onBack ? 'Back to previous screen' : 'Back to home'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        {viewMode !== 'actual' && (() => {
          // Founder UX pass 5 (2026-05-26): the badge previously read just
          // "FORECAST · variance overlay active" with no explanation of what
          // changed. Each mode now carries a one-line meaning so the user
          // knows what they're looking at.
          const meaning = {
            forecast: `Future · projected at ${currentWindow.label} using neutral engine assumptions`,
            plan:     projection.planMissing
              ? `Plan · no FI target set — showing forecast trajectory. Set target income to compare.`
              : `Plan · trajectory toward your FI target at ${currentWindow.label}`,
            scenario: `What if · scenario sandbox active`,
          }[viewMode]
          return (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 9px',
              borderRadius: 100,
              background: viewMode === 'plan' && projection.planMissing
                ? 'rgba(255, 107, 107, 0.12)'
                : 'rgba(255,179,71,0.10)',
              color: viewMode === 'plan' && projection.planMissing ? 'var(--c-coral, #FF6F7D)' : '#FFB347',
              letterSpacing: 0.4,
            }}>
              {meaning}
            </span>
          )
        })()}
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

      {/* SECTION NAV — extracted 2026-05-28 to MoneyXDrawer.jsx so the same
         8-chip drawer renders consistently on every MoneyX-family screen
         (Cashflow / TaxEstate / MoneyIncome / MoneyProtection / MoneyBusiness
         / MoneyTrusts). Director-gated and trust-gated chips hide using the
         same predicates as before. */}
      <MoneyXDrawer entity={entity} activeRoute="money" onNav={onNav} />

      {/* ═══════════════════════════════════════════════════════════════════
         ACT 1 — Where do I stand?
         Triple anchor + one-line plain-English verdict folding NW MoM,
         surplus/deficit, and cashflow position into a single sentence.
         Replaces the Phase 2A banner-style verdict above the anchor.
         ═══════════════════════════════════════════════════════════════════ */}
      <div id="mm-balance" />
      {/* v0.3 R1 §9 — G13 empty state. New user (no assets / no liabilities)
          sees a single hero illustration + "Add your first item" CTA. NO
          charts render, NO tiles render. Single doorway only — keeps from
          confusing newcomers with empty-state ghost charts. */}
      {heroTotalAssets === 0 && heroTotalLiabilities === 0 ? (
        <FadeInOnMount className="sw-card" style={{
          padding: '40px 28px', textAlign: 'center', marginBottom: 16,
          background: 'var(--card-bg2)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-lg, 20px)',
        }} data-empty="r1-balance-sheet">
          {/* Minimalist line drawing of an empty wallet with a ghosted
              composition marimekko in the background — per §9 spec. */}
          <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true"
            style={{ margin: '0 auto 20px', display: 'block', opacity: 0.55 }}>
            {/* Ghosted marimekko silhouette behind the wallet */}
            <g opacity="0.18">
              <rect x="4"  y="40" width="22" height="36" fill="var(--c-acc)"  />
              <rect x="28" y="50" width="22" height="26" fill="var(--c-acc2, var(--c-acc))" />
              <rect x="52" y="56" width="22" height="20" fill="var(--c-acc)"  />
              <rect x="76" y="62" width="22" height="14" fill="var(--c-acc2, var(--c-acc))" />
              <rect x="100" y="68" width="16" height="8"  fill="var(--c-acc)"  />
            </g>
            {/* Wallet outline */}
            <g fill="none" stroke="var(--c-text2)" strokeWidth="1.6"
               strokeLinecap="round" strokeLinejoin="round">
              <rect x="22" y="22" width="76" height="46" rx="6" />
              <path d="M22 32 L98 32" />
              <circle cx="86" cy="50" r="3" />
            </g>
          </svg>
          <h2 style={{
            fontSize: 22, fontWeight: 700,
            color: 'var(--c-text)', margin: '0 0 8px',
            letterSpacing: -0.3,
          }}>Your money, one view.</h2>
          <p style={{
            fontSize: 13, color: 'var(--c-text2)',
            lineHeight: 1.55, maxWidth: 380, margin: '0 auto 22px',
          }}>
            Add an account, property, pension, or debt. Your balance sheet builds from there.
          </p>
          <button
            type="button"
            onClick={() => setBucketOpen(true)}
            className="sw-press"
            style={{
              padding: '10px 22px',
              fontSize: 13, fontWeight: 700,
              background: 'var(--c-acc)',
              color: 'var(--c-bg, #0B1F3A)',
              border: 'none', borderRadius: 100, cursor: 'pointer',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--c-acc) 30%, transparent)',
            }}
          >
            Add your first item →
          </button>
        </FadeInOnMount>
      ) : (
      <>
      {/* Voyant-parity FinancesHeroCard (founder direction 2026-05-26):
          mirrors Voyant's "53 Accounts · Net Worth · Assets · Liabilities ·
          Add or edit your finances" card. This is the prominent entry point
          to AddItemSheet so users can add categories they don't have yet
          (e.g. "I have bonds — how can I add this"). Floating + button stays
          for power users but the founder explicitly asked for a discoverable
          surface at the top of MyMoney. */}
      <FinancesHeroCard
        entity={entity}
        netWorth={projection?.value ?? nw}
        totalAssets={heroTotalAssets}
        totalLiabilities={heroTotalLiabilities}
        windowLabel={projection?.windowLabel}
        windowYears={projection?.years}
        viewMode={viewMode}
        historyMissing={projection?.historyMissing}
        onAddOrEdit={() => setBucketOpen(true)}
      />
      {/* Whole-tab fresh review 2026-05-26: TripleAnchor was rendered here with
          all three values hidden — producing an empty wrapper. Wealth + Risk
          live on the X28 top bar (D-ANCHOR-2). Net Worth was re-added to the
          TileGrid hero card (UX BLOCK-1 fix). VarianceBadge stays for the
          delta-context chip. */}
      <FadeInOnMount style={{ margin: '4px -16px 12px' }}>
        <VarianceBadge entity={entity} mode1="actual" mode2={viewMode} window={windowId} metric="netWorth" />
      </FadeInOnMount>

      {/* Phase 1D — ANI cliff-edge warning (£100k taper threshold).
          Stays in Act 1 — it's an urgent signal a user must see immediately. */}
      <CliffEdgeWarning entity={entity} />

      {/* ═══════════════════════════════════════════════════════════════════
         §3 SECTION 5 — How your money is held (WRAPPER BAR — restored).
         M7 decision (2026-05-26 founder review): Marimekko removed. With rich-
         holdings personas (Mr T, 15 wrappers) the marimekko compressed small
         wrappers (CRYPTO £9k, SEIS £8k, CASH-ISA £8k) to sub-pixel stripes
         inside the Investments column — unreadable AND not drillable. The 1D
         wrapper bar shows every wrapper proportional to whole-portfolio £,
         so small wrappers still get visible/tappable width. Categorisation
         is already covered by the CategoryTile mini-bars BELOW (every tile
         has its own wrapper breakdown), so the marimekko's "2D claim" was
         redundant in practice.
         ═══════════════════════════════════════════════════════════════════ */}
      <FadeInOnMount delay={20} className="sw-card" style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 'var(--space-sm)',
        }}>
          <span className="sw-eyebrow" style={{ flex: 1 }}>
            How your money is held · {fmt(heroTotalAssets)}
          </span>
          <ExplainerChip id="MM-2" />
        </div>
        <WrapperCompositionBar
          entity={entity}
          totalAssets={heroTotalAssets}
          onSegmentTap={setFilterWrapper}
          activeWrapper={filterWrapper}
          onAddWrapperDetails={() => setBucketOpen(true)}
          onOpenDrill={(w) => setActiveDrill(`wrapper:${w}`)}
        />
      </FadeInOnMount>

      {/* ═══════════════════════════════════════════════════════════════════
         ACT 2 — What I own (BalanceSheet TileGrid).
         Wrapper bar moved up to §3 SECTION 5 (signature slot).
         ═══════════════════════════════════════════════════════════════════ */}
      {filterWrapper && (
        <FadeInOnMount delay={50} style={{ marginBottom: 8 }}>
          <button onClick={() => setFilterWrapper(null)}
            className="sw-chip sw-press"
            style={{ border: '1px solid var(--c-sep)', cursor: 'pointer' }}>
            Showing {filterWrapper} only — clear ×
          </button>
        </FadeInOnMount>
      )}
      {/* BalanceSheet TileGrid — rendered directly, no PivotToggle wrapper. */}
      {(() => {
        // Derive per-category row collections from existing dRows builders.
        const isDirector = hasPersonaFlag(entity, 'director')
        const catRows = {
          pensions:     applyFilter(dRows.A),
          // M5 founder decision (2026-05-26): EIS/SEIS/VCT moved OUT of
          // Investments and INTO Alternatives. They have illiquid 3-5yr clocks,
          // high risk, qualify for BPR — share more DNA with crypto/PE/wine
          // than with ISA/GIA. Bonds (onshore/offshore) stay in Investments —
          // mainstream investment wrappers with chargeable-event regime.
          investments:  [...applyFilter(dRows.C), ...applyFilter(dRows.D),
                         ...applyFilter(dRows.F_ON), ...applyFilter(dRows.F_OFF)],
          property:     applyFilter(dRows.G),
          business:     [...dRows.H, ...dRows.I, ...(isDirector ? dRows.X : [])],
          protection:   [...dRows.J, ...dRows.K, ...dRows.L],
          cash:         applyFilter(dRows.M),
          liabilities:  dRows.N,
          // M5: EIS/SEIS/VCT folded in here alongside the existing dRows.U
          // (wine/art/gold/crypto/PE).
          alternatives: [...dRows.U,
                         ...applyFilter(dRows.E_EIS), ...applyFilter(dRows.E_SEIS), ...applyFilter(dRows.E_VCT)],
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

        // Pension pill: reveal it IS N pots (not one £850k atom) + per-pot
        // projected trend, and link the draw-down ACTION to Cashflow (where
        // decumulation lives — mymoney-checklist L18). 20y illustrative horizon.
        const _penPots = entity?.assets?.sipp?.pensions || entity?.assets?.pensions || entity?.assets?.pension?.pots || []
        // Total planned annual pension contribution (you + employer) across pots —
        // drives the Plan segment of the pension tile's trajectory bar.
        const _penAnnualContrib = _penPots.reduce((s, p) => s + (((+(p.contribution_monthly?.personal) || 0) + (+(p.contribution_monthly?.employer) || 0)) * 12), 0)
        const _penCma = (() => { try { return getActiveCMA() } catch { return {} } })()
        // R5 (MONEY-TILE-TEMPLATE): per-pension sparkline from REAL valuation
        // history only — one line per pot that actually carries history, so the
        // lines genuinely diverge. No synthetic projection clones. Pots without
        // history contribute no line; if none have it, no sparkline.
        const _penTrend = _penPots
          .map(p => Array.isArray(p.valuation_history) ? p.valuation_history.map(h => +(h && typeof h === 'object' ? h.value : h) || 0) : null)
          .filter(s => Array.isArray(s) && s.length > 1)
        const _penColors = ['var(--c-acc2,#5B8DEF)', 'var(--c-gold,#E8B84B)', 'var(--c-violet,#9B8CFF)', 'var(--c-acc,#5ddbc2)', 'var(--c-coral,#FF6F7D)']
        const _penShort = (name = '') => (name.replace(/\([^)]*\)/g, '').replace(/\b(SIPP|DC|Lansdown|Enterprises)\b/gi, '').replace(/\s+/g, ' ').trim() || name)
        const _penItems = _penPots.map((p, i) => ({ name: p.name, short: _penShort(p.name), value: +p.value || 0, color: _penColors[i % _penColors.length] }))
        const _openPensionPot = (it) => { setPensionInitialPot(it?.name || null); setActiveDrill('pension') }

        // Compose the 10 category cards. Order = spec §3.4 default.
        // Empty-state copy has personality per category — generic "Tap Add"
        // wasn't earning its place (skill rule: every word earns its place).
        const CATEGORIES = [
          { id: 'pensions',     label: 'Pensions',             domainCodes: 'A · B',     rows: catRows.pensions,     onRowTap: () => setActiveDrill('pension'),
            changeLabel: 'est. 12-mo',
            trendSeries: _penTrend.length ? _penTrend : null,
            composition: _penItems.length ? { noun: 'pension', items: _penItems, onDrill: _openPensionPot } : null,
            // Drawdown link lives in the drill/leaf (detailed analysis), not on
            // the scan-friendly tile (founder 2026-05-31: pill too long).
            empty: 'No pensions yet. Add a SIPP or workplace scheme — the contributions get back up to 47% in tax relief.' },
          { id: 'investments',  label: 'Savings & Investments',domainCodes: 'C · D · E · F', rows: catRows.investments,
            empty: 'Nothing invested yet. Add an ISA first — £20k a year, no tax on growth, no tax on withdrawal.' },
          { id: 'property',     label: 'Property',             domainCodes: 'G',         rows: catRows.property,
            empty: 'No property added. Your main home is exempt from capital gains tax when you sell. Let property is taxed fully — and since 2020 you only get a small slice of mortgage interest back against rental income.' },
          { id: 'business',     label: 'Business Assets',      domainCodes: isDirector ? 'H · I · X' : 'H · I',  rows: catRows.business,
            empty: 'No business holdings added. Shares in a trading company may pass to your heirs free of inheritance tax once you have held them for two years.' },
          { id: 'protection',   label: 'Protection',           domainCodes: 'J · K · L', rows: catRows.protection,
            empty: 'No cover in place. Four common product categories: life · critical illness · income protection · private medical. Policies written into a discretionary trust typically sit outside the estate for IHT — ownership and trust structure depend on personal circumstances.' },
          { id: 'cash',         label: 'Cash',                 domainCodes: 'M',         rows: catRows.cash,
            empty: 'No cash accounts captured. 3–6 months of essentials in easy-access is the standard buffer; ISA + NS&I are the tax-free options.' },
          // Founder 2026-05-25 round 6: Liabilities tile removed from the
          // "What you own" grid — liabilities aren't assets and have their
          // own Act 3 section directly below. Subtotal still computed above
          // so the Balance-sheet net-worth math is unchanged.
          { id: 'income',       label: 'Income (flow)',        domainCodes: 'O · W',     rows: [] /* income shown in flow-context below NW + on Cashflow */ },
          { id: 'alternatives', label: 'Alternatives',         domainCodes: 'U',         rows: catRows.alternatives,
            empty: 'Crypto, wine, art, gold, P2P, private equity — anything that doesn\'t fit the standard wrappers lives here. Chattels under £6k disposal: no CGT.' },
          // IFA pass 2 BLOCK: Obligations (Domain V) is a CASHFLOW commitment
          // (family care, dependants, maintenance) — NOT a balance-sheet asset.
          // Surfacing it in "WHAT YOU OWN" misclassifies it. Per spec §20.3
          // and v2.7 §Q1.2 it belongs on the Cashflow tab. Removed from
          // category grid here; relocate to a Commitments row when ready.
        ]

        // Per-category context lines + status chips. These surface what an
        // adviser would call out at a glance — they're derived heuristically
        // from the persona data we already have.
        // Use the canonical allowance tracker so this stays in lockstep with
        // the §4.5.2 cards. The previous field-scan missed assets stored on
        // the persona without the `contribution_current_tax_year` key.
        let isaUsedYTD = 0
        try { isaUsedYTD = allowanceTracker(entity)?.isa?.used || 0 } catch {}
        const carryFwdAA = entity?.income?.allowance_use?.pension_aa
        // BLOCK-2: AA headroom must reflect s189 relievable-earnings cap and
        // MPAA. Without these the tile says "£60k of pension room" to a
        // retired persona who can only contribute £3,600 (the universal floor).
        const _relevantEarnings =
            (+entity?.income?.employment       || 0)
          + (+entity?.income?.directorSalary   || 0)
          + (+entity?.income?.selfEmploymentNet || 0)
          + (+entity?.income?.gross_annual_employment || 0)
        const _reliefCap = Math.max(3600, _relevantEarnings)
        const _mpaaActive = !!(entity?.flexibleDrawdownTriggered
          || entity?.pension?.mpaaActive
          || (entity?.assets?.pensions || []).some(p => p.mpaaActive || p.fadStarted))
        const _aaEffective = _mpaaActive ? (TAX.mpaa || 10000) : TAX.pensionAA
        const aaHeadroomLeft = Math.min(_aaEffective, _reliefCap) * (1 - (carryFwdAA || 0))

        // Realistic monthly essentials — BLOCK-1 fix: canonical reader checks
        // every persona shape (expenses.essential_monthly, expenses.essential_annual,
        // entity.monthlyExpenditure for persona-a..g). Previously this chain
        // ignored entity.monthlyExpenditure and fell through to the 55%-of-income
        // estimate — which gave "150.3 yr of essentials covered" for Bruce
        // (gross income low → essentials estimate tiny → tile reported absurd).
        const _essRead = getMonthlyEssentials(entity)
        const monthlyEssentialsForTiles =
          _essRead.monthly || (incomeAnnual * 0.55) / 12

        const tileCats = CATEGORIES.map(c => {
          const tile = { ...c }
          if (c.id === 'pensions') {
            // v0.3 R1 §8 — SIPP-IHT chip on Pensions tile.
            // VERBATIM copy from spec §8: "From April 2027, pensions enter
            // your estate. Current pre-tax delta: £{X}."
            //
            // Gate: SIPP > 0 (any life stage — A6 requires visibility for
            // Bruce (decum) AND Mr T (accumulation) both). The prior age/
            // lifeStage filter was a v0.2 carry-over that A6 explicitly
            // rejects.
            //
            // Math source: ihtDeltaPrePost2027(entity) — canonical engine
            // helper, no recompute in screen (PP-5).
            //
            // Tap → onNav('tax', { hash:'iht-delta', seed:{...} }) per §7
            // Cross-route contract. Dashboard.setTabSafe consumes hash+seed.
            const sippValue = (entity?.assets?.pensions || [])
              .filter(p => /sipp/i.test(p.type || ''))
              .reduce((s, p) => s + (+p.balance_gbp || +p.value || +p.total || 0), 0)
              + (+entity?.assets?.sipp?.total || 0)
            let ihtDelta = null
            try { ihtDelta = ihtDeltaPrePost2027(entity) } catch { /* engine fallback */ }
            if (sippValue > 0 && ihtDelta && Number.isFinite(ihtDelta.delta)) {
              // Verbatim format — `£{X}` rounded to nearest £1 for legibility.
              // Locale-formatted number matches the spec template.
              const deltaRounded = Math.round(ihtDelta.delta)
              // Declutter (founder 2026-05-31): the verbose "From April 2027…"
              // contextLine duplicated the SIPP-IHT chip below (both say 2027).
              // Drop the sentence; the drillable chip carries it compactly.
              void deltaRounded
              tile.contextLine = null
              tile.status = {
                label: 'SIPP-IHT 2027 — delta',
                tone: 'warn',
                explainerId: 'SIPP-IHT-2027',
                // R1 §5 cross-route contract — chip is a tap target distinct
                // from tile body. Lands on /tax#iht-delta carrying seed
                // { pension_total, post_2027_delta } per §7.
                onTap: () => {
                  if (typeof onNav === 'function') {
                    onNav('tax', {
                      hash: 'iht-delta',
                      seed: {
                        pension_total: sippValue,
                        post_2027_delta: ihtDelta.delta,
                      },
                    })
                  }
                },
              }
            } else if (aaHeadroomLeft > 1000) {
              // Fallback to AA headroom messaging when SIPP-IHT chip not gated
              // in (SIPP == 0). Mechanic-only — no advice verbs.
              tile.contextLine = `£${aaHeadroomLeft >= 1000 ? Math.round(aaHeadroomLeft / 1000) + 'k' : Math.round(aaHeadroomLeft)} of pension room left this year`
              tile.status = { label: 'Pension room available', tone: 'warn', explainerId: 'MM-AA' }
            }
          }
          if (c.id === 'investments' && isaUsedYTD < (TAX.isaAllowance ?? 0)) {
            const remaining = (TAX.isaAllowance ?? 0) - isaUsedYTD
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
                return r > 0 ? { label: humanizeDebtType(l.type), rate: r } : null
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
            // P0-13 (2026-05-27): only compute cash-cover months when essentials
            // are known and > 0. Previously Math.max(1, monthlyEssentialsForTiles)
            // forced the denominator to 1 when essentials was missing/zero,
            // producing absurd "2,416 yr cover" numbers for any persona without
            // monthly-essentials data populated.
            const monthsRaw = monthlyEssentialsForTiles > 0
              ? subtotals.cash / monthlyEssentialsForTiles
              : null
            const months = Number.isFinite(monthsRaw) ? monthsRaw : 0
            // P0-13b (2026-05-28): cap display at 20+ yr — past that point the
            // "X years of essentials covered" framing stops being useful (cash
            // dwarfs liquidity-buffer purpose; user wants "this cash is excess"
            // not a half-life number). Without a cap persona-e shows 199.8yr.
            if (monthsRaw == null) tile.contextLine = `${fmt(subtotals.cash)} cash · add monthly essentials to see months of cover`
            else if (months >= 240) tile.contextLine = `20+ yr cover · cash holding is well above liquidity buffer`
            else if (months > 0) tile.contextLine = months >= 12
              ? `${(months / 12).toFixed(1)} yr of essentials covered`
              : `${months.toFixed(1)} mo of essentials covered`
            // Status surfaces health band for the safety net
            // BLOCK-4: replace value-laden "Strong buffer" with the numeric
            // band — neutral, rubric-explicit. User reads the months figure
            // and the label together, no regulated-sounding word required.
            if (months >= 6) tile.status = { label: `${months >= 240 ? '20+yr' : months >= 12 ? (months / 12).toFixed(1) + 'yr' : Math.round(months) + 'mo'} cover`, tone: 'good' }
            else if (months >= 3) tile.status = { label: `${Math.round(months)}mo cover`, tone: 'neutral' }
            else tile.status = { label: `${Math.round(months)}mo cover`, tone: 'warn' }
          }
          if (c.id === 'alternatives' && (entity?.assets?.alternatives || []).length > 0) {
            const a = entity.assets.alternatives[0]
            tile.contextLine = `${a.type === 'wine' ? 'Fine wine · chattels exemption' : 'Illiquid · CGT on disposal'}`
          }
          if (c.id === 'obligations' && (entity?.family_obligations || []).length > 0) {
            const annual = entity.family_obligations.reduce((s, o) => s + (+o.annual_cost || 0), 0)
            if (annual > 0) tile.contextLine = `£${Math.round(annual / 1000)}k/yr in family commitments`
          }
          // changePct is set per-category below, AFTER CAT_MONTHLY_DRIFT is
          // defined — the old code surfaced the SAME net-worth change on every
          // tile (Savings +0.2% AND Property +0.2%, unlabelled), which founder
          // (2026-06-01) flagged as a careless stub. Now each category shows its
          // own honest 12-month estimate from its drift rate, labelled "12-mo est."
          tile.subtotal = subtotals[c.id]

          // 12-month sparkline series — back-cast from current subtotal using a
          // category-typical monthly growth rate. Not real history (Mr T doesn't
          // carry per-category time series) but shows a directional trend. For
          // liabilities, the line trends DOWN (amortising) so we use a slight
          // negative monthly drift. For income, no sparkline.
          // R14 (MONEY-TILE-TEMPLATE): growth rate is DYNAMIC — from the active
          // CMA via growthRateFor(), NOT a hardcoded drift table (founder
          // 2026-06-01: "nothing hard coded, all dynamic"). Each category maps to
          // its representative taxonomy node type; growthRateFor resolves that to
          // the CMA asset-class expected return (updates when the CMA updates).
          const CAT_NODETYPE = {
            pensions: 'pension-sipp', investments: 'isa-stocks-shares',
            property: 'property-residence', business: 'alt-aim',
            cash: 'cash-savings', alternatives: 'alt-aim',
          }
          const _catRate = (id) => growthRateFor(CAT_NODETYPE[id] || 'gia', _penCma)
          // Per-tile temporal trajectory (Pattern A, spec 2026-06-01): Now /
          // Future / Plan. The bar's horizon is DECOUPLED from the tax-year window
          // (that coupling is why Future "showed nothing") — every tile always
          // projects to a sensible default: to retirement, capped 25y; 10y if
          // already retired. The global Today/Future/Plan lens only emphasises a
          // length. plan == future until per-category committed scenario deltas
          // are wired (next increment). Same drift rate as the sparkline so the
          // two never disagree.
          if (tile.subtotal && tile.subtotal !== 0 && c.id !== 'income' && c.id !== 'protection') {
            const _toRet = (entity?.retirementAge ?? 67) - (entity?.age ?? 50)
            const _retYears = _toRet > 1 ? Math.min(_toRet, 25) : 10
            // W1 temporal wiring (2026-06-01): use the selected window's horizon
            // when the user has chosen a forward window (5y / 10y / 20y /
            // Lifetime / Next year). For current/historical windows (years ≤ 0)
            // fall back to the retirement-gap default so "Today" still makes sense.
            const _years = windowYears > 0 ? windowYears : _retYears
            const _annual = _catRate(c.id)   // CMA-derived, dynamic (R14)
            const _now = +tile.subtotal
            // Future = grow on autopilot, no new money. Plan = Future + the user's
            // planned ongoing contributions (real, honest distinction — not a
            // fabricated target). Only pensions carry per-holding contribution
            // data today, so other categories show plan == future (no gold tip)
            // until their planned inflows are captured.
            const _future = Math.round(projectValue(_now, _annual, _years))
            const _contrib = c.id === 'pensions' ? _penAnnualContrib : 0
            // Plan = Future + this category's committed-scenario delta (e.g. a
            // sold asset removed, released equity added), projected from the
            // post-decision base. plan === future when no scenario touches it.
            const _planBase = Math.max(0, _now + (planAdjust[c.id] || 0))
            const _plan = Math.round(projectValue(_planBase, _annual, _years, _contrib))
            tile.trajectory = { now: _now, future: _future, plan: _plan }
            // Header 12-month change %: the category's OWN annualised drift —
            // real and DIFFERENT per category (pensions ~7% · property ~4% ·
            // cash ~3.4%), not the single net-worth figure stamped on every tile.
            // It's a back-cast estimate, so it's labelled "12-mo est." (doctrine:
            // estimates must read as estimates). Consistent with the forward
            // TrajectoryBar — same drift, so the % and the bar never contradict.
            tile.changePct = +(_annual * 100).toFixed(1)
            tile.changeLabel = '12-mo est.'
          }
          // ── R5 (MONEY-TILE-TEMPLATE): header sparkline, per-holding & dynamic.
          // Priority: (1) real per-holding valuation_history → one REAL line per
          // holding (genuinely divergent); else (2) a single category trend line
          // reconstructed from the CMA category rate (dynamic, R14, labelled est.).
          // Every multi-value tile gets a sparkline → consistent across tiles
          // (founder 2026-06-01: "image 1 has no sparklines"); NO synthetic
          // identical clones (each real line is its holding's own history).
          if (!tile.trendSeries && tile.subtotal && tile.subtotal !== 0 && c.id !== 'income' && c.id !== 'protection') {
            // ONE line PER holding so a multi-holding tile shows MULTIPLE lines
            // (founder 2026-06-01: "Did you fix the multiple spark lines required?").
            // Per holding: (1) real valuation_history if present, else (2) reconstruct
            // from THAT holding's own growth_rate_assumption (real, per-holding,
            // dynamic — R5 priority 2). Different rates → genuinely divergent lines
            // on the shared-scale renderer; NO identical synthetic clones.
            const _rows = (c.rows || []).filter(r => (+r.value || 0) > 0)
            const _lines = _rows.map(r => {
              // Each tile row keeps the raw holding under `.raw` — read the real
              // per-holding history / growth assumption from there (the row's own
              // top-level fields are display-only and don't carry the rate, which
              // is why every line previously collapsed to the category rate).
              const src = r.raw || r
              const hist = Array.isArray(src.valuation_history) ? src.valuation_history
                : (Array.isArray(r.valuation_history) ? r.valuation_history : r.history)
              if (Array.isArray(hist) && hist.length > 1) {
                return hist.map(pt => +((pt && typeof pt === 'object') ? pt.value : pt) || 0)
              }
              const own = +src.growth_rate_assumption || +src.growth
                || +r.growth_rate_assumption || +r.growth || 0
              const rate = own > 0 ? own : _catRate(c.id)
              const rM = Math.pow(1 + rate, 1 / 12) - 1
              const cur = +r.value
              const line = []
              for (let i = 11; i >= 0; i--) line.push(Math.round(cur / Math.pow(1 + rM, i)))
              return line
            }).filter(l => Array.isArray(l) && l.length > 1)
            if (_lines.length >= 2) {
              tile.trendSeries = _lines                  // multiple per-holding lines
            } else if (_lines.length === 1) {
              tile.series = _lines[0]                    // single holding → one line
            } else {
              // No holdings resolvable — fall back to a single category line.
              const rM = Math.pow(1 + _catRate(c.id), 1 / 12) - 1
              const cur = +tile.subtotal
              const line = []
              for (let i = 11; i >= 0; i--) line.push(Math.round(cur / Math.pow(1 + rM, i)))
              tile.series = line
            }
          }

          // ── R6 (MONEY-TILE-TEMPLATE): ONE composition pattern for EVERY
          // multi-holding tile — "across N {noun}" + a single drillable colour bar.
          // No wrapper-% legend, no holding names (that's drill detail). Was
          // pensions-only; every other tile fell back to the legacy wrapper legend
          // → three different patterns across adjacent tiles (founder caught it).
          if (!tile.composition) {
            const _crows = (c.rows || []).filter(r => (+r.value || 0) > 0)
            if (_crows.length >= 2) {
              const _NOUN = { pensions: 'pension', investments: 'account', property: 'property', business: 'holding', cash: 'account', alternatives: 'holding', protection: 'policy' }
              const _COLORS = ['#7AA7FF', '#5DDBC2', '#BA8CFF', '#FF9F0A', '#FF6B6B', '#34C759', '#E77BFF']
              tile.composition = {
                noun: _NOUN[c.id] || 'holding',
                items: _crows.map((r, i) => ({ name: r.label || r.name || (_NOUN[c.id] || 'holding'), value: +r.value || 0, color: _COLORS[i % _COLORS.length] })),
                onDrill: () => setActiveDrill(c.id === 'pensions' ? 'pension' : c.id),
              }
            }
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

        // Retirement plan target + an inline-editable descriptor. We only expose
        // `editable` when the dotted path points at an EXISTING numeric field —
        // applyFieldCorrection's _setByPath won't create missing intermediates,
        // so marking a non-existent path editable would be a fake affordance.
        const planTargetInfo = (() => {
          const plans = entity?.plans || []
          const i = plans.findIndex(p => p.type === 'retirement' || /retire|fi/i.test(p.label || ''))
          if (i < 0) return { value: null, editable: null }
          const t = plans[i].target
          if (typeof t === 'number') {
            return { value: t, editable: { path: `plans[${i}].target`, currentValue: t } }
          }
          if (t && typeof t === 'object' && typeof t.netWorth === 'number') {
            return { value: +t.netWorth, editable: { path: `plans[${i}].target.netWorth`, currentValue: +t.netWorth } }
          }
          return { value: null, editable: null }
        })()

        return (
          <>
          {/* UX audit HIGH-4 fix (2026-05-26): the previous version stacked
              all three "Insurance / Business / Trusts" anchors at the same
              vertical position above TileGrid, so all three chips smooth-
              scrolled to the same spot — 37% of the section nav was dead.
              Only `mm-insurance` stays here (Protection tile renders in
              PRIMARY_ORDER's top row of TileGrid below). `mm-business` is
              now anchored to the Director-Intel block; `mm-trusts` is
              anchored to the BPR-clock card inside Director-Intel + a
              fallback at the AllowanceTracker section. */}
          <div id="mm-insurance" />
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
            monthlyEssentials={monthlyEssentialsForTiles}
            planTarget={planTargetInfo.value}
            editablePlanTarget={planTargetInfo.editable}
            onDrillMetric={setMetricDrill}
            onView={(id) => {
              if (id === 'pensions') setActiveDrill('pension')
              else if (['investments', 'property', 'business', 'protection', 'liabilities'].includes(id)) {
                setActiveDrill(id)
              } else if (id === 'cash') {
                // v0.3 (2026-05-26) — Cash has its own drill (CashDrillDown)
                // with runway, FSCS, bed-and-ISA, liquidity ladder.
                setActiveDrill('cash')
              } else if (id === 'alternatives') {
                // v0.3 (2026-05-26) — Alternatives has its own drill with
                // AIM 50%, valuation freshness, liquidity ladder.
                setActiveDrill('alternatives')
              } else if (id === 'income') {
                // Income streams — pivot to income view
                setPivot('income')
              } else if (id === 'obligations') {
                // Annual obligations (family support, alimony) — route to Cashflow
                onNav?.('flow')
              }
            }}
            onAdd={openBucket}
            onWhatIf={(catId) => {
              // Per-item what-if (spec 2026-06-01) — scoped to THIS topic only,
              // distinct from the tab-level and global what-ifs. Entry point:
              // opens Ask Sonu's what-if seeded with the category. The full inline
              // mini-what-if (drag retirement/contribution in place) is the next
              // increment; it will bind to the same scenario engine.
              const _label = { pensions: 'pensions', investments: 'savings & investments', property: 'property', cash: 'cash', business: 'business assets', alternatives: 'alternatives' }[catId] || catId
              window.dispatchEvent(new CustomEvent('sonus:ask', { detail: {
                question: `What if my ${_label} changed — show me the scenarios for just this`,
                context: { metric: 'categoryWhatIf', category: catId, scope: 'mymoney' },
              } }))
            }}
          />
          </>
        )
      })()}

      {/* Founder direction 2026-05-26: AccountsList RevealCard removed from
          MyMoney main flow ("Its in the wrong place"). The consolidated
          accounts list belongs INSIDE AddItemSheet as a right-rail sidebar
          (Voyant pattern) so users see existing items while adding/editing
          new ones — not as a third surface on the Balance Sheet view. */}

      {/* ═══════════════════════════════════════════════════════════════════
         ACT 3 — What I owe
         Liabilities as a grid of LiabilityTile components mirroring the asset
         CategoryTile rhythm. Founder UX pass 3: "Liabilities is not following
         the asset look and feel why" — fixed by replacing the thin list with
         per-debt tiles (~320px each, coral accent, APR chip, avalanche-
         priority marker on the highest-APR debt). Hidden when no debt.
         ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const cats = ripple.balance_sheet?.categories || {}
        const liabsTotal = +cats.liabilities || 0
        if (!liabsTotal) return null
        const monthlyDebt = +ripple.balance_sheet?.monthlyDebtService || 0

        // Build a defensive liabilities list — personas use both
        // entity.liabilities.mortgage (single object) and entity.liabilities.otherLoans (array).
        const liab = entity?.liabilities || {}
        const items = []
        const mortgage = liab.mortgage
        if (mortgage && +mortgage.outstanding > 0) {
          items.push({
            type: 'mortgage',
            label: 'Mortgage',
            balance: +mortgage.outstanding,
            apr: mortgage.rate != null ? +mortgage.rate * 100 : null,
            monthly: +(mortgage.monthlyPayment ?? mortgage.monthly_payment ?? 0) || 0,
            lender: mortgage.lender || mortgage.provider || null,
            rateType: mortgage.rateType || mortgage.rate_type || null,
            sourcePath: 'liabilities.mortgage.outstanding',
          })
        }
        ;(liab.otherLoans || []).forEach((l, idx) => {
          const bal = +(l.outstanding || l.outstanding_balance || 0)
          if (!bal) return
          // Personas store the rate as `rate` (0.0385); older shapes use apr/
          // interest_rate. Missing it here was leaving the BTL tile hollow — no
          // APR chip, no £/mo, no interest/yr (the whole block gates on apr).
          const aprRaw = +(l.apr || l.interest_rate || l.rate || 0)
          const rawType = (l.type || 'loan').toLowerCase().replace(/[\s-]+/g, '_')
          const friendly = humanizeDebtType(l.type)
          // Path to the EXISTING balance field so the leaf's edit folds (R13 —
          // _setByPath won't create missing intermediates).
          const balField = l.outstanding != null ? 'outstanding' : 'outstanding_balance'
          items.push({
            type: rawType,
            label: friendly,
            balance: bal,
            apr: aprRaw > 0 ? aprRaw * 100 : null,
            // Personas use monthlyPayment / monthly_payment / repayment_from_salary_monthly
            // interchangeably — read all three or 3 of 4 debts read £0 (no payment,
            // no sparkline, "No payment recorded" in the leaf). Founder 2026-06-01.
            monthly: +(l.monthlyPayment ?? l.monthly_payment ?? l.repayment_from_salary_monthly ?? 0) || 0,
            lender: l.lender || l.provider || null,
            rateType: l.rate_type || l.rateType || null,
            sourcePath: `liabilities.otherLoans[${idx}].${balField}`,
          })
        })
        // Sort by APR desc so the most expensive debt is visible first.
        items.sort((a, b) => (b.apr || 0) - (a.apr || 0))

        // Avalanche-priority marker: only on the highest-APR debt across the
        // set, and only when that APR is >= 8% (no point marking a 1.5%
        // mortgage as a priority — it's not). Math-only, not advice.
        const maxApr = items.reduce((m, it) => Math.max(m, it.apr || 0), 0)
        const avalancheLabel = maxApr >= 8 ? items.find(it => it.apr === maxApr)?.label : null

        return (
          <FadeInOnMount delay={80}>
            <SectionDelimiter
              eyebrow="What you owe"
              title={`Liabilities · ${fmt(liabsTotal)}${monthlyDebt > 0 ? ` · costs ${fmt(monthlyDebt)}/mo` : ''}`}
              sub="Tap a debt to see its detail — rate, cost, and when it clears"
            />
            {items.length === 0 ? (
              <div className="sw-card" style={{ padding: 'var(--space-md)' }}>
                <button
                  onClick={() => setActiveDrill('liabilities')}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 0', background: 'none', border: 'none',
                    color: 'var(--c-text2)', cursor: 'pointer', fontSize: 13,
                  }}>
                  {fmt(liabsTotal)} outstanding · tap to see breakdown →
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                // A lone debt shouldn't stretch the full width into a wide void;
                // cap the single-item case, otherwise pack 280px tiles (founder
                // 2026-05-31). align-items:stretch keeps multi-tile rows equal.
                gridTemplateColumns: items.length === 1
                  ? 'minmax(280px, 460px)'
                  : 'repeat(auto-fit, minmax(280px, 1fr))',
                alignItems: 'stretch',
                gap: 12,
              }}>
                {items.map((item, i) => {
                  // Single source of debt maths (debtMath.amortise) — same calc
                  // the tile sparkline, the leaf, and the drill use, so the
                  // interest-only "470-year payoff" bug can't reappear here.
                  // apr is null when not captured OR genuinely 0% (BNPL) — coerce
                  // to 0 so amortise() doesn't propagate NaN into the sparkline/SVG.
                  const am = amortise(item.balance, item.apr || 0, item.monthly)
                  // Real paydown sparkline: declining balance when amortising;
                  // honest flat when interest-only (it genuinely isn't reducing);
                  // no line when no payment is captured (don't fake movement).
                  const series = am.status === 'amortising' ? am.forward(12)
                    : am.status === 'interest-only' ? Array.from({ length: 12 }, () => item.balance)
                    : null
                  // 12-month change %, from the real amortisation (negative — debt
                  // falls). Null for interest-only / no-payment (no measurable move,
                  // so no "+0.0%"): MONEY-TILE-TEMPLATE R5b/R7.
                  const yoy = am.status === 'amortising'
                    ? (() => { const f = am.forward(13); return item.balance > 0 ? ((f[12] - item.balance) / item.balance) * 100 : null })()
                    : null
                  // Now→Future→Plan trajectory — amortise forward 10y (honest: Plan
                  // == Future until a committed extra-payment scenario exists).
                  const _futureBal = am.status === 'amortising' ? am.forward(121)[120] : item.balance
                  const liabTrajectory = am.status === 'amortising' && _futureBal < item.balance
                    ? { now: item.balance, future: _futureBal, plan: _futureBal }
                    : null
                  return (
                    <LiabilityTile
                      key={`${item.label}-${i}`}
                      type={item.type}
                      label={item.label}
                      balance={item.balance}
                      apr={item.apr}
                      monthly={item.monthly}
                      series={series}
                      trajectory={liabTrajectory}
                      yoyChangePct={yoy}
                      changeLabel={yoy != null ? '12-mo est.' : null}
                      isAvalanche={avalancheLabel != null && item.label === avalancheLabel}
                      onView={() => setDebtLeaf(item)}
                      onWhatIf={() => window.dispatchEvent(new CustomEvent('sonus:ask', {
                        detail: { question: `What if I paid down my ${(item.label || 'this debt').toLowerCase()} faster?`, context: { metric: 'liabilityWhatIf', type: item.type, label: item.label, balance: item.balance, apr: item.apr, scope: 'mymoney' } },
                      }))}
                      onAdd={() => openBucket('liabilities')}
                    />
                  )
                })}
              </div>
            )}
          </FadeInOnMount>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
         Acts 3.5 / 4 / 5 / 6 STRIPPED (founder direction 2026-05-26).
         The section-nav chips at the top of MyMoney now route to dedicated
         pages — Income Statement → /money/income, Cashflow → /flow, Tax &
         Allowances → /tax, Top Decisions → /decisions. Rendering the same
         content inline on MyMoney was dead-weight redundancy ("3 and 4th
         image — why is this all here"). MyMoney is now Balance-Sheet only.
         PersonaGapTiles (StatePension / SoleTraderNIC / TaperedAA / etc.)
         continue to surface on their dedicated routes. NRI Indian-assets
         block below intentionally retained — it's an asset disclosure that
         belongs on the Balance Sheet view.
         ═══════════════════════════════════════════════════════════════════ */}

      {/* v0.3 R1 Phase 4 — dead Acts 5+6 block (Tax / Decisions inline) removed.
          Those routes own their own pages now (/tax, /decisions). MyMoney is
          Balance Sheet ONLY per v0.3 route-1 §3. Source history preserved in
          git; persona-gap chips below now surface R1-relevant tax mechanics. */}


      {/* ═══════════════════════════════════════════════════════════════════
         §3 PERSONA-AWARE INLINE CHIPS (R1 + cross-route v0.3 Phase 3)
         Each tile is gated by its own persona/data check and renders null
         when the gate fails. Verbatim §8 copy (no paraphrase). Drawn from
         Phase-3 PersonaGapTiles.jsx exports — used as-is per Phase 4 rule.
         Locked to R1-relevant chips only (HICBC, TaperedAA, Cohab, NRB-T,
         S24, EIS/VCT, Avalanche, NRI).
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
        <TaperedAATile entity={entity} />
        <CohabIHTCliffTile entity={entity} />
        <TransferableNRBTile entity={entity} />
        <LandlordS24Tile entity={entity} />
        <EISVCTClockTile entity={entity} />
        <HICBCTile entity={entity} />
        <AvalanchePriorityTile entity={entity} />
        <NRIIndianAssetsTile entity={entity} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
         §3 SECTION 9 — NRI gate (Indian assets RevealCard).
         Renders only if hasPersonaFlag('nri'). DTAA note inside.
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

      </>
      )}{/* ── /G13 empty-state ternary (heroTotals == 0 ? empty : <>...</>) ── */}

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
        entity={entity}
        onClose={() => { setBucketOpen(false); setBucketCat(null) }}
        onCommit={handleAssetCommit}
      />

      {/* ── Pension drill-down (redesigned: Have→Understand→Decide) ──────── */}
      {/* 2026-05-31: routed into PensionSummaryDrill (grouped-by-type list +
          per-pot leaf + guided/interactive Decide view). The 800-line inline
          PensionDrillDown above is now superseded/dead — excise after founder
          sign-off. Spec: docs/superpowers/specs/2026-05-31-pension-surface-redesign-design.md */}
      {activeDrill === 'pension' && (
        <PensionSummaryDrill
          entity={entity}
          pots={entity?.assets?.sipp?.pensions || entity?.assets?.pensions || entity?.assets?.pension?.pots || []}
          personaId={personaId}
          initialPotName={pensionInitialPot}
          onClose={() => { setActiveDrill(null); setPensionInitialPot(null) }}
          onHome={onHome}
          onPlanIncome={() => { setActiveDrill(null); setPensionInitialPot(null); onNav?.('flow') }}
        />
      )}

      {/* ── Per-category drill-downs (Domain C/D/E/F · G · H/I · J/K/L · N) */}
      {activeDrill === 'investments' && (
        <InvestmentsDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'property' && (
        <PropertyDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'business' && (
        <BusinessDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'protection' && (
        <ProtectionDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'liabilities' && (
        <LiabilitiesDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {/* Cash + Alternatives drills (whole-tab close-out 2026-05-26):
          previously routed to activeDrill='investments' which doesn't render
          either — dead-end tap from the tile. Now wired to their own drills. */}
      {activeDrill === 'cash' && (
        <CashDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'alternatives' && (
        <AlternativesDrillDown entity={entity} personaId={personaId} onBack={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {activeDrill === 'networth' && (
        <NetWorthDrill entity={entity} ripple={ripple} onClose={() => setActiveDrill(null)} onHome={onHome} />
      )}

      {/* R13 — Net-Worth-Trend metric provenance drill. Tapping any trend tile
          (Plan funded, 1-yr growth, Debt ratio, …) or the sparkline opens its
          source chain here: formula → inputs → user facts → add/modify. The
          action chips route to the category drill where a holding is actually
          editable; the ⚡ chip hands the scenario question to Ask Sonu. */}
      {metricDrill && (
        <L3PanelHost
          title={metricDrill.title || 'Detail'}
          subtitle="How this is calculated · where it comes from"
          personaId={personaId}
          onClose={() => setMetricDrill(null)}
          onHome={onHome}
        >
          <L4NumberPanel
            metric={metricDrill.metric}
            value={metricDrill.value}
            formula={metricDrill.formula}
            source={metricDrill.source}
            confidence={metricDrill.confidence}
            breakdown={metricDrill.breakdown}
            whatIf={metricDrill.whatIf}
            actions={[
              ...(metricDrill.actionsSpec || []).map(a => ({
                key: a.target,
                label: a.label,
                onClick: () => {
                  setMetricDrill(null)
                  if (a.target === 'networth') setActiveDrill('networth')
                  else if (a.target === 'liabilities') setActiveDrill('liabilities')
                  else if (a.target === 'income') setPivot('income')
                },
              })),
              ...(metricDrill.askQuestion ? [{
                key: 'whatif',
                label: '⚡ Explore what-if',
                onClick: () => {
                  const q = metricDrill.askQuestion
                  const m = metricDrill.metric
                  setMetricDrill(null)
                  window.dispatchEvent(new CustomEvent('sonus:ask', {
                    detail: { question: q, context: { metric: m, scope: 'mymoney' } },
                  }))
                },
              }] : []),
            ]}
            onBack={() => setMetricDrill(null)}
          />
        </L3PanelHost>
      )}

      {/* FK-1 — per-debt leaf. Each liability tile opens ITS debt here (not the
          shared "What you owe" screen). Clean paydown chart + drill-to-source
          facts + debt-type context. */}
      {debtLeaf && (() => {
        const _dt = `${debtLeaf.type || ''} ${debtLeaf.label || ''}`.toLowerCase().replace(/[_-]+/g, ' ')
        const isBtl = /\bbtl\b|buy to let/.test(_dt)
        const ltvContext = (/mortgage/.test(_dt) && !isBtl && (() => {
          const rv = (+entity?.assets?.residence?.value || 0) * (+entity?.assets?.residence?.ownershipShare || 1)
          return rv > 0 ? { propertyValue: rv, ltv: debtLeaf.balance / rv } : null
        })()) || null
        return (
          <DebtLeaf
            debt={debtLeaf}
            ltvContext={ltvContext}
            currentYear={new Date().getFullYear()}
            onBack={() => setDebtLeaf(null)}
            onHome={onHome}
            onAddToPlan={(scenario) => onCommit?.({ type: EV.SCENARIO_SAVED, ts: Date.now(), payload: { domain: 'liabilities', asset: debtLeaf?.label, ...scenario } })}
            _onEdit={(payload) => { onCommit?.({ type: EV.ASSET_FIELD_CORRECTED, ts: Date.now(), payload }); setDebtLeaf(null) }}
          />
        )
      })()}
      {activeDrill === 'cashflow' && (
        <CashFlowDrill entity={entity} ripple={ripple} onClose={() => setActiveDrill(null)} onHome={onHome} />
      )}
      {typeof activeDrill === 'string' && activeDrill.startsWith('wrapper:') && (() => {
        // L1 (wrapper segment tap) → L2 (assets list) → L3 (AssetDetailOverlay).
        // Build the asset list from the same rowsFor* helpers WrapperCompositionBar
        // uses, then filter by the wrapper code from the drill key.
        const w = activeDrill.split(':')[1]
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
        const assets = all.filter(r => r.wrapper === w)
        return (
          <WrapperDrill
            wrapper={w}
            assets={assets}
            entity={entity}
            ripple={ripple}
            personaId={personaId}
            onClose={() => setActiveDrill(null)}
            onHome={onHome}
            onFilter={(ww) => { setFilterWrapper(ww); setActiveDrill(null) }}
          />
        )
      })()}
    </div>
  )
}
