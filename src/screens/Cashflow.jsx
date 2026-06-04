// ─────────────────────────────────────────────────────────────────────────────
// Cashflow.jsx — Sonuswealth Cashflow tab · v3 POLISHED
// Spec: 2-Product/2-Product-cashflow-v1_7.md
//
// Single-scroll: §A NOW → §B TRAJECTORY → §C DEPTH per spec §2.1.
// All numbers come from engine functions — no hardcoding.
// CMA bundle (UK-CMA-2026.1) wired from src/rules/cma-2026.json.
//
// Polish layer (10 May 2026):
//   · Design tokens / sw-* utilities everywhere (sw-card, sw-card-elevated,
//     sw-hero, sw-hero-md, sw-eyebrow, sw-bar, sw-chip, sw-press, sw-lift)
//   · Reveal primitives (FadeInOnMount, RevealStagger, DrawSVG)
//   · Counter-up hero via <Num animate>
//   · Cascade halo on CoI tick · pulse-glow on PRC/PCC + Reality Engine
//   · Animated progress bars (mini-bar fills CSS-transition from 0→value)
//   · Sticky section delimiters with letter badge
//   · sw-tab-slide on viewMode change · re-key on window change
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react'

// Canonical facade engine (Wave 1A): imports cashflow-engine via cf_* re-exports.
// S1 selector migration (Phase 2): canonical readers pulled via selector facade.
import { netWorth, fq as calcFQ, ani as _aniSel } from '../engine/selectors/index.js'
const calcANI = (e, b) => _aniSel(e, b)
import {
  // Core
  fmt, calcRisk, fqBand, riskBand,
  // Cashflow Health (§3B)
  cashflowHealth,
  // §A NOW
  calcAllIncome, classifyIncomeType, monthlySurplus, cashflowFlow, inferLifeStage,
  calcAge,
  liquidityBuffer, recommendedSurplusAllocation,
  debtRatio,
  // §B TRAJECTORY
  swrFromRegime, fundedRatio, fiRatio,
  guytonKlingerPath, goalSeek,
  // §C DEPTH
  totalCoI, coiCashflowVariants,
  // Cashflow-engine re-exports
  cf_probabilityOfSuccess,
  cf_sequenceOfReturnsVulnerability,
  cf_prcPccSpread,
  cf_realityEngineFactorisation,
  cf_maxDrawdownExposure,
  cf_portfolioEfficiency,
} from '../engine/fq-calculator.js'

// Active-CMA layer: the live assumptions (baseline ⊕ any user override from
// Settings → Assumptions). getActiveCMA() for transient drill panels; the
// useActiveCMA() hook in the main screen subscribes so memos recompute when a
// dial moves. Replaces the old static `import CMA_BUNDLE from cma-2026.json`.
import { getActiveCMA } from '../engine/cma.js'
import { useActiveCMA } from '../state/useActiveCMA.js'

// L3-3 (2026-05-28): tax-band + NI breakdown for L4 drills inside cashflow drill panels.
import { incomeTaxDetail, nicsDetail } from '../engine/tax-estate-engine.js'

// §B goal-engine wire-up (2026-06-03): the ONE engine that produces the real
// tax-minimising drawdown SEQUENCE (year-by-year per-pot draws + ranked routes)
// for decumulators — replaces the relabeled-G-K "Optimal" + the forward-table stub.
import { goalSpec as buildGoalSpec } from '../engine/goal-engine.js'
import { solveDecumulation } from '../engine/decumulation-solver.js'
import { compareMethods, recommendMethodForGoal, methodPath, METHODS } from '../engine/withdrawal-methods.js'
import { useEvents, EV } from '../state/events.jsx'

// L3-3 (2026-05-28): DrillStack wiring so existing L3 drill panels can chain
// to L4 row-level breakdowns (gross income → per-source; tax & NI → per-band).
import { DrillStackProvider, useDrillStackContext } from '../components/MyMoney/L3/DrillStack.jsx'
import { DrillableNumber } from '../components/MyMoney/L3/DrillableNumber.jsx'

// L3-4 (2026-05-28): externalised copy lookup. See src/content/uk-en.json
// and src/hooks/useContent.js for the bundle + hook.
import { getContent } from '../hooks/useContent.js'

import { BRAND } from '../config/brand.js'
import TripleAnchor from '../components/shared/TripleAnchor.jsx'
// v0.3 R3 SIGNATURE — calendar heatmap of monthly surplus/deficit.
import { CalendarHeatmap } from '../components/charts'
import {
  X28TopBar,
  CoIOdometer,
  ExplainerChip,
  Num,
  FadeInOnMount,
  RevealStagger,
  DrawSVG,
} from '../components/shared/index.js'
import {
  useCascadeTrigger,
  usePrevious,
} from '../hooks/useAnimation.jsx'
import useBundleVersion from '../hooks/useBundleVersion.jsx'
import { useTemporalMode } from '../state/temporalMode.jsx'

// Phase 2 Batch C — premium Cashflow components. Aliased as *V2 to avoid
// colliding with the local components of the same name defined below. The
// local versions remain available; the V2 renders take precedence in the JSX.
import FundedRatioGaugeV2  from '../components/Cashflow/FundedRatioGauge.jsx'
import PoSChartV2          from '../components/Cashflow/PoSChart.jsx'
import ScenarioMatrixV2    from '../components/Cashflow/ScenarioMatrix.jsx'
import CashflowWaterfallV2 from '../components/Cashflow/CashflowWaterfall.jsx'
import SequenceStressVisV2 from '../components/Cashflow/SequenceStressVis.jsx'
import EfficientFrontierV2 from '../components/Cashflow/EfficientFrontier.jsx'

// v0.3 R3v2 signature — Sankey for money in → money out (founder direction
// 2026-05-26: the screen needs a story comp, not just a waterfall).
import Sankey from '../components/charts/Sankey.jsx'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

// L3-3 (2026-05-28): plain-English labels for income type keys (matches the
// taxonomy.incomeTypes labels — kept local because Cashflow doesn't otherwise
// import taxonomy and we want the drill to stay zero-dep).
const _INCOME_TYPE_LABELS = {
  'employment':       'Employment',
  'self-employment':  'Self-employment',
  'dividends':        'Dividends',
  'rental':           'Rental',
  'savings-interest': 'Savings interest',
  'overseas':         'Overseas income',
  'state-pension':    'State pension',
  'drawdown':         'Pension drawdown',
  'other':            'Other',
}
function _incomeTypeLabel(key) {
  return _INCOME_TYPE_LABELS[key] || String(key || 'Income').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase())
}

function fmtSeedNum(v) {
  const n = +v || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${sign}£${(abs / 1_000).toFixed(0)}k`
  return `${sign}£${abs.toLocaleString()}`
}

function ScenarioSeedBanner({ seed, onDismiss }) {
  if (!seed) return null
  const label = seed.label || seed.metric || seed.category || 'this value'
  const current  = seed.formatted || (seed.current != null ? fmtSeedNum(seed.current) : null)
  const proposed = seed.proposed != null ? fmtSeedNum(seed.proposed) : null
  const showCompare = current && proposed && current !== proposed
  const line = seed.line || null
  return (
    <div role="status" style={{
      margin: '8px 0 4px', padding: '12px 14px', borderRadius: 14,
      border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
      background: 'color-mix(in srgb, var(--c-acc) 8%, var(--c-surface))',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
          letterSpacing: 0.6, textTransform: 'uppercase' }}>Modeling</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
          marginTop: 2, lineHeight: 1.35 }}>
          {String(label).replace(/^(\w)/, c => c.toUpperCase())}
          {showCompare && (
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
              {' '}— from <span style={{ color: 'var(--c-text2)' }}>{current}</span>
              {' '}to <span style={{ color: 'var(--c-acc)' }}>{proposed}</span>
            </span>
          )}
        </div>
        {line && (
          <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.4 }}>
            {line}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss scenario seed"
        className="sw-press"
        style={{
          border: '1px solid var(--c-border)', background: 'var(--c-surface2)',
          color: 'var(--c-text2)', borderRadius: 8, padding: '4px 10px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >Clear</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Monthly Surplus Drill Panel
// Full-screen overlay showing income → deductions → surplus waterfall
// with per-item breakdown and allocation guidance.
// ═══════════════════════════════════════════════════════════════════════════

function SurplusDrillPanel({ entity, onClose }) {
  // L3-3 (2026-05-28): wrap in DrillStackProvider so child rows can chain to
  // L4 row-level breakdowns (gross income → per-source, tax & NI → per-band).
  return (
    <DrillStackProvider>
      <SurplusDrillPanelInner entity={entity} onClose={onClose} />
    </DrillStackProvider>
  )
}

function SurplusDrillPanelInner({ entity, onClose }) {
  const drillStack   = useDrillStackContext()
  const CMA_BUNDLE  = getActiveCMA()
  const incomeAll  = useMemo(() => { try { return calcAllIncome(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const ms         = useMemo(() => { try { return monthlySurplus(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const lb         = useMemo(() => { try { return liquidityBuffer(entity) } catch { return null } }, [entity])
  const taxDetail  = useMemo(() => { try { return incomeTaxDetail(entity) } catch { return null } }, [entity])
  const nicDetail  = useMemo(() => { try { return nicsDetail(entity) } catch { return null } }, [entity])
  const surplusAlloc = useMemo(() => {
    const s = ms?.surplus
    if (s == null) return null
    try { return recommendedSurplusAllocation(entity, s) } catch { return null }
  }, [entity, ms])

  // CANONICAL: every figure from cashflowFlow — the SAME fn the now-tile,
  // waterfall, Sankey and Home use — so this drill cannot diverge. The old code
  // recomputed surplus from fields that don't exist (incomeAll.tax_total_annual
  // → £0) and OMITTED protection, showing a +£6k SURPLUS when the engine says a
  // −£5k DEFICIT (founder 2026-06-04 reconciliation flag).
  const flow        = useMemo(() => { try { return cashflowFlow(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const gross       = +(flow?.gross ?? 0)
  const taxAnn      = +(flow?.taxAndNI ?? 0)
  const committedAnn= +(flow?.committed ?? 0)
  const essAnn      = +(flow?.essentials ?? 0)
  const debtAnn     = +(flow?.debtService ?? 0)
  const protAnn     = +(flow?.protection ?? 0)
  const surplusAnn  = +(flow?.surplusAnnual ?? 0)
  const surplusMo   = +(flow?.surplusMonthly ?? 0)

  // L3-3 row-level L4 drill payloads — engine-derived, no fabrication.
  const incomeSourceBreakdown = useMemo(() => {
    const items = Array.isArray(incomeAll?.items) ? incomeAll.items : []
    const map = new Map()
    for (const it of items) {
      const t = it.type || 'other'
      map.set(t, (map.get(t) || 0) + (+it.amount || 0))
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ label: _incomeTypeLabel(k), value: v, formatted: fmt(v) }))
      .sort((a, b) => b.value - a.value)
  }, [incomeAll])

  const taxBandBreakdown = useMemo(() => {
    const out = []
    const bands = Array.isArray(taxDetail?.bands) ? taxDetail.bands : []
    for (const b of bands) {
      if (!b || (+b.tax || 0) === 0) continue
      out.push({ label: b.band || b.label || `Income tax — ${Math.round((+b.rate || 0) * 100)}%`, value: +b.tax || 0, formatted: fmt(+b.tax || 0) })
    }
    if ((+nicDetail?.class1 || 0) > 0) out.push({ label: 'NI — Class 1 (employee)',      value: +nicDetail.class1, formatted: fmt(+nicDetail.class1) })
    if ((+nicDetail?.class4 || 0) > 0) out.push({ label: 'NI — Class 4 (self-employed)', value: +nicDetail.class4, formatted: fmt(+nicDetail.class4) })
    return out
  }, [taxDetail, nicDetail])

  const steps = [
    {
      label: 'Gross income',         value: gross,        colour: 'var(--c-mint-text)',  kind: 'income',    note: incomeAll?.marginal_band ? `${incomeAll.marginal_band} band` : null,
      drill: incomeSourceBreakdown.length > 0 ? {
        metric: 'Gross income',
        value: fmt(gross) + '/yr',
        formula: `Sum of ${incomeSourceBreakdown.length} income source${incomeSourceBreakdown.length === 1 ? '' : 's'} from your entity record.`,
        source: 'calcAllIncome(entity) · src/engine/fq-calculator.js',
        confidence: 'high',
        breakdown: incomeSourceBreakdown,
      } : null,
    },
    {
      label: 'Tax & NI',             value: -taxAnn,      colour: 'var(--c-coral-text)', kind: 'deduction', note: null,
      drill: taxBandBreakdown.length > 0 ? {
        metric: 'Tax & NI',
        value: fmt(taxAnn) + '/yr',
        formula: `Income tax across ${taxBandBreakdown.filter(r => !/^NI/.test(r.label)).length} band${taxBandBreakdown.length === 1 ? '' : 's'} plus National Insurance contributions.`,
        source: 'incomeTaxDetail + nicsDetail · src/engine/tax-estate-engine.js',
        confidence: 'high',
        breakdown: taxBandBreakdown,
      } : null,
    },
    { label: 'Pension & ISA put aside', value: -committedAnn, colour: 'var(--c-acc)',        kind: 'deduction', note: committedAnn > 0 ? 'Contributions you set aside' : null },
    { label: 'Essentials',           value: -essAnn,      colour: 'var(--c-amber-text)', kind: 'deduction', note: 'Housing, bills, transport' },
    { label: 'Debt service',         value: -debtAnn,     colour: 'var(--c-acc3, var(--c-text3))', kind: 'deduction', note: 'Loans and cards' },
    { label: 'Protection premiums',  value: -protAnn,     colour: 'var(--c-coral-text)', kind: 'deduction', note: 'Life · CI · IP · PMI' },
    { label: 'Net surplus × 12',     value: surplusAnn,   colour: surplusAnn >= 0 ? 'var(--c-mint-text)' : 'var(--c-coral-text)', kind: 'surplus', note: null },
  ].filter(s => Math.abs(s.value) > 0)

  const maxAbs = Math.max(...steps.map(s => Math.abs(s.value)), 1)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'cf-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <style>{`
        @keyframes cf-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button
          onClick={onClose}
          className="sw-press"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Monthly cashflow breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>{surplusMo >= 0 ? 'Monthly surplus' : 'Monthly deficit'}</div>
          <div style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: surplusMo >= 0 ? 'var(--c-mint-text)' : 'var(--c-coral-text)',
          }}>
            {surplusMo >= 0 ? '+' : '−'}{fmt(Math.abs(surplusMo))}/mo
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            {fmt(gross)}/yr gross · {surplusMo >= 0 ? `${fmt(surplusAnn)}/yr surplus` : `${fmt(Math.abs(surplusAnn))}/yr shortfall, covered from savings or pots`}
          </div>
          <span className="sw-chip sw-chip-sm" style={{ marginTop: 8, display: 'inline-block' }}>
            From your data
          </span>
        </div>

        {/* Waterfall bars */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Income to surplus</div>
          {gross === 0 && (
            <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              No income data yet — add income to see the waterfall.
            </div>
          )}
          {steps.map(({ label, value, colour, note, drill }) => {
            const w = (Math.abs(value) / maxAbs) * 100
            const isDeduction = value < 0
            return (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    {drill ? (
                      <DrillableNumber
                        metric={drill.metric}
                        value={drill.value}
                        formula={drill.formula}
                        source={drill.source}
                        confidence={drill.confidence}
                        breakdown={drill.breakdown}
                        onDrill={drillStack.pushNumber}
                      >
                        <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
                      </DrillableNumber>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
                    )}
                    {note && <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>{note}</div>}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: isDeduction ? 'var(--c-danger)' : colour,
                  }}>
                    {isDeduction ? '−' : '+'}{fmt(Math.abs(value))}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.max(2, w)}%`,
                    background: colour,
                    transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Surplus allocation */}
        {surplusAlloc && surplusMo > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Where to put the surplus</div>
            {(surplusAlloc.allocations || []).map((al, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{al.label || al.bucket}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(al.monthlyAmount || al.amount || 0)}/mo
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Liquidity context */}
        {lb?.months != null && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Emergency buffer</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)' }}>
              {lb.months >= 24 ? `${(lb.months / 12).toFixed(1)} years` : `${lb.months.toFixed(1)} months`} of essentials
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
              {lb.months >= 6 ? 'Healthy — well above the typical 3–6 month range (information only)' : lb.months >= 3 ? 'Adequate (3–6 months)' : 'Below the typical 3–6 month range (information only)'}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          {getContent('common.fcaFooter', 'Information only · Derived from your data · Not regulated advice')}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Income Breakdown Drill Panel
// ═══════════════════════════════════════════════════════════════════════════

function IncomeBreakdownDrillPanel({ entity, onClose }) {
  return (
    <DrillStackProvider>
      <IncomeBreakdownDrillPanelInner entity={entity} onClose={onClose} />
    </DrillStackProvider>
  )
}

function IncomeBreakdownDrillPanelInner({ entity, onClose }) {
  const drillStack = useDrillStackContext()
  const CMA_BUNDLE = getActiveCMA()
  const incomeAll = useMemo(() => { try { return calcAllIncome(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const inc = entity?.income || {}

  // L3-3: byType drill payload (non-savings / savings / dividends / cgt)
  const byTypeBreakdown = useMemo(() => {
    const t = incomeAll?.byType || {}
    const rows = []
    if ((+t.non_savings || 0) > 0) rows.push({ label: 'Non-savings (employment, self-employed, rental, pension)', value: +t.non_savings, formatted: fmt(+t.non_savings) })
    if ((+t.savings || 0)     > 0) rows.push({ label: 'Savings interest', value: +t.savings,     formatted: fmt(+t.savings) })
    if ((+t.dividends || 0)   > 0) rows.push({ label: 'Dividends',        value: +t.dividends,   formatted: fmt(+t.dividends) })
    if ((+t.cgt || 0)         > 0) rows.push({ label: 'Capital gains',    value: +t.cgt,         formatted: fmt(+t.cgt) })
    return rows
  }, [incomeAll])

  const sources = [
    { label: 'Salary', monthly: +(inc.salary ?? 0) / 12, annual: +(inc.salary ?? 0) },
    { label: 'Self-employment', monthly: +(inc.selfEmployed ?? inc.selfEmployment ?? 0) / 12, annual: +(inc.selfEmployed ?? inc.selfEmployment ?? 0) },
    { label: 'Rental', monthly: +(inc.rental ?? 0) / 12, annual: +(inc.rental ?? 0) },
    { label: 'Dividends', monthly: +(inc.dividends ?? 0) / 12, annual: +(inc.dividends ?? 0) },
    { label: 'Pension', monthly: +(inc.pension ?? 0) / 12, annual: +(inc.pension ?? 0) },
    { label: 'Other', monthly: +(inc.other ?? 0) / 12, annual: +(inc.other ?? 0) },
  ].filter(s => s.annual > 0)

  const totalAnnual = sources.reduce((s, r) => s + r.annual, 0) || +(incomeAll?.gross_annual ?? incomeAll?.total ?? 0)
  const maxAnnual = Math.max(...sources.map(s => s.annual), 1)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'cf-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Income breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Income sources</div>
          {sources.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              No income data — add income sources to see breakdown.
            </div>
          )}
          {sources.map(({ label, monthly, annual }) => {
            const w = (annual / maxAnnual) * 100
            return (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(monthly)}/mo · {fmt(annual)}/yr
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.max(2, w)}%`,
                    background: 'var(--c-success)',
                    transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                  }} />
                </div>
              </div>
            )
          })}
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c-sep)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            {byTypeBreakdown.length > 0 ? (
              <DrillableNumber
                metric="Income by tax category"
                value={fmt(totalAnnual) + '/yr'}
                formula="Income reclassified into non-savings, savings, dividends and capital-gains categories — the band order HMRC uses when applying tax."
                source="calcAllIncome(entity).byType · src/engine/fq-calculator.js"
                confidence="high"
                breakdown={byTypeBreakdown}
                onDrill={drillStack.pushNumber}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Total · by tax band</span>
              </DrillableNumber>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Total</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalAnnual / 12)}/mo · {fmt(totalAnnual)}/yr
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          {getContent('common.fcaFooter', 'Information only · Derived from your data · Not regulated advice')}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Health Score Drill Panel
// ═══════════════════════════════════════════════════════════════════════════

function HealthScoreDrillPanel({ entity, onClose }) {
  return (
    <DrillStackProvider>
      <HealthScoreDrillPanelInner entity={entity} onClose={onClose} />
    </DrillStackProvider>
  )
}

function HealthScoreDrillPanelInner({ entity, onClose }) {
  const drillStack = useDrillStackContext()
  const CMA_BUNDLE = getActiveCMA()
  const health = useMemo(() => { try { return cashflowHealth(entity, CMA_BUNDLE) } catch { return null } }, [entity])

  const BAND_COLOUR = { Critical: 'var(--c-danger)', Stressed: 'var(--c-warning)', Steady: 'var(--c-acc)', Healthy: 'var(--c-success)', Thriving: 'var(--c-success)' }
  const bandColour = BAND_COLOUR[health?.band] || 'var(--c-text)'

  const COMPONENTS = [
    { key: 'liquidityBuffer',  label: 'Liquidity buffer',   weight: 30, desc: 'Emergency reserves covering months of essentials' },
    { key: 'surplus',          label: 'Surplus ratio',      weight: 25, desc: 'Monthly income left after all outgoings' },
    { key: 'debtManageability',label: 'Debt service ratio', weight: 20, desc: 'Debt service as a share of gross income (CF-OVL-H-03)' },
    { key: 'incomeResilience', label: 'Income resilience',  weight: 15, desc: 'Diversity and stability of income sources' },
    { key: 'sequenceRisk',     label: 'Sequence resilience',weight: 10, desc: 'Portfolio exposure to poor early-retirement returns' },
    { key: 'fundedRatio',      label: 'Funded ratio',       weight: 0,  desc: 'Projected retirement assets vs target income need (CF-HERO-09)' },
  ]

  const ec = health?.components || {}

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'cf-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0,
        background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Cashflow health breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Cashflow Health Score</div>
          {health ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: bandColour }}>
                {health.total}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.6 }}>/100</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: bandColour, marginTop: 4 }}>
                {health.band}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--c-text3)' }}>Health score unavailable</div>
          )}
        </div>

        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Components</div>
          {COMPONENTS.map(({ key, label, weight, desc }) => {
            const raw = ec[key] ?? ec[label] ?? null
            const score = raw != null ? Math.max(0, Math.min(100, Math.round(+raw))) : null
            const contribution = score != null ? Math.round(score * weight / 100) : null
            const colour = score == null ? 'var(--c-text3)' : score >= 70 ? 'var(--c-success)' : score >= 40 ? 'var(--c-warning)' : 'var(--c-danger)'
            const breakdown = [
              { label: 'Sub-score (0-100)', value: score ?? 0, formatted: score != null ? `${score}/100` : '—' },
              { label: 'Weight in total',   value: weight,     formatted: `${weight}%` },
              { label: 'Contribution',      value: contribution ?? 0, formatted: contribution != null ? `${contribution} pts` : '—' },
            ]
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <DrillableNumber
                    metric={label}
                    value={score != null ? `${score}/100` : '—'}
                    formula={desc}
                    source="cashflowHealth(entity, CMA_BUNDLE) · src/engine/fq-calculator.js"
                    confidence={score != null ? 'high' : 'low'}
                    breakdown={breakdown}
                    onDrill={drillStack.pushNumber}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
                  </DrillableNumber>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                    {score != null ? `${score}/100` : '—'}
                    {contribution != null && <span style={{ fontSize: 11, color: 'var(--c-text3)', marginLeft: 4 }}>({weight}% weight → {contribution}pts)</span>}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${score ?? 0}%`,
                    background: colour,
                    transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{desc}</div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          {getContent('common.fcaFooter', 'Information only · Derived from your data · Not regulated advice')}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 R3v2 SIGNATURE — Money-in / Money-out Sankey
//
// Founder direction 2026-05-26: R3 owes a single comp that tells the user's
// money-flow story in 2 seconds. Sources (employment / rental / dividends /
// state pension / drawdown / interest) → middle stages (tax · pension · debt
// service · essentials) → sink (Net surplus / Net deficit).
//
// This replaces the calendar-heatmap-as-signature mis-tag flagged by the
// dataviz critique. The heatmap stays as a secondary depth strip.
// ─────────────────────────────────────────────────────────────────────────────
function CashflowMoneySankey({ entity, incomeAll, ms, flow }) {
  // Single source of truth: cashflowFlow (net-of-tax). All aggregates below come
  // from it so the Sankey ties out to the reconciliation strip and to Home's
  // surplus by construction (2026-06-02 correctness gate).
  const f = flow || cashflowFlow(entity)

  // Source nodes derived from the SAME income items that f.gross sums (grouped by
  // type) — so Σ sources === f.gross exactly. Previously these were re-summed
  // from entity.income sub-fields, which drifted from the engine total.
  const SRC_LABELS = {
    employment: 'Employment', 'self-employment': 'Self-employment',
    dividends: 'Dividends', rental: 'Rental', 'savings-interest': 'Interest',
    'state-pension': 'State pension', drawdown: 'Pension drawdown',
    overseas: 'Overseas', other: 'Other',
  }
  const byLabel = {}
  for (const it of (incomeAll?.items || [])) {
    const lbl = SRC_LABELS[it.type] || 'Other'
    byLabel[lbl] = (byLabel[lbl] || 0) + (+it.amount || 0)
  }
  const sources = Object.entries(byLabel)
    .map(([label, value]) => ({ id: 'src:' + label.toLowerCase().replace(/\s+/g, '_'), label, value }))
    .filter(s => s.value > 0)

  const gross = f.gross
  if (!gross || sources.length === 0) {
    return null // honest hide when no income — no fake Sankey
  }

  const taxAnn       = f.taxAndNI
  const pensionAnn   = f.committed
  const essentials   = f.essentials
  const debtService  = f.debtService
  const protection   = f.protection
  const surplus      = f.surplusAnnual

  // Sankey nodes: sources → stages → sink
  // Stages: tax, pension, essentials, debt, protection — only render those with positive flow
  const stageNodes = []
  if (taxAnn > 0)       stageNodes.push({ id: 'stage:tax',        label: 'Tax & NI',       type: 'stage' })
  if (pensionAnn > 0)   stageNodes.push({ id: 'stage:pension',    label: 'Pension',        type: 'stage' })
  if (essentials > 0)   stageNodes.push({ id: 'stage:essentials', label: 'Essentials',     type: 'stage' })
  if (debtService > 0)  stageNodes.push({ id: 'stage:debt',       label: 'Debt service',   type: 'stage' })
  if (protection > 0)   stageNodes.push({ id: 'stage:protection', label: 'Protection',     type: 'stage' })

  const sinkLabel = surplus >= 0 ? 'Net surplus' : 'Net deficit'
  const sinkId = 'sink:net'

  // N-1 fix (2026-05-28): when surplus < 0, the previous model spread each
  // source proportionally across all stages — but the stage TOTAL exceeded
  // gross income, so the Sankey library's source-node labels showed each
  // source's edges summing to (stage_total × src.share), inflating Bruce's
  // Rental from £19,200 to £54,214 (×2.83). Fix: model the deficit as a
  // virtual "Drawdown / borrowing" source whose value equals |deficit|.
  // Effective gross = real gross + |deficit|. Real sources now contribute
  // their actual £-value worth of outflow; the virtual source contributes
  // the rest.
  const deficitGap = surplus < 0 ? Math.abs(surplus) : 0
  const effectiveGross = gross + deficitGap

  const virtualSource = deficitGap > 0
    ? { id: 'src:drawdown_gap', label: 'From savings / borrowing', value: deficitGap }
    : null

  const sourceNodes = [
    ...sources.map(s => ({ id: s.id, label: s.label, type: 'source' })),
    ...(virtualSource ? [{ id: virtualSource.id, label: virtualSource.label, type: 'source', tone: 'coral' }] : []),
  ]
  const sinkNode = [{ id: sinkId, label: sinkLabel, type: 'sink' }]
  const nodes = [...sourceNodes, ...stageNodes, sinkNode[0]]

  const links = []
  const stages = [
    taxAnn > 0       && { id: 'stage:tax',        value: taxAnn,      label: 'Tax & NI' },
    pensionAnn > 0   && { id: 'stage:pension',    value: pensionAnn,  label: 'Pension' },
    essentials > 0   && { id: 'stage:essentials', value: essentials,  label: 'Essentials' },
    debtService > 0  && { id: 'stage:debt',       value: debtService, label: 'Debt service' },
    protection > 0   && { id: 'stage:protection', value: protection,  label: 'Protection' },
  ].filter(Boolean)

  // Effective inflow set: real sources + (virtual drawdown source when in deficit).
  const allInflows = virtualSource ? [...sources, virtualSource] : sources

  // Source → stage (proportional to effectiveGross). Each real source's
  // outgoing edges now sum to its actual src.value (since effectiveGross
  // includes the deficit gap), restoring honest source-side labels.
  for (const src of allInflows) {
    const srcShare = src.value / effectiveGross
    for (const stg of stages) {
      const flow = Math.round(stg.value * srcShare)
      if (flow > 0) links.push({ source: src.id, target: stg.id, value: flow, label: `${src.label} → ${stg.label}` })
    }
    // Source → sink (their share of surplus). Only fires in the positive-surplus case.
    if (surplus > 0) {
      const sinkFlow = Math.round(surplus * srcShare)
      if (sinkFlow > 0) links.push({ source: src.id, target: sinkId, value: sinkFlow, label: `${src.label} → ${sinkLabel}` })
    }
  }

  return (
    <div className="sw-card sw-card-elevated" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="sw-eyebrow">Money flow · this year</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
            Where it comes from → where it goes → what's left.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: surplus >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)', fontVariantNumeric: 'tabular-nums' }}>
            {surplus < 0 ? '−' : ''}£{Math.round(Math.abs(surplus) / 1000)}k
          </div>
          <div className="sw-eyebrow" style={{ fontSize: 9, marginTop: 2 }}>{sinkLabel} / yr</div>
        </div>
      </div>
      <Sankey
        nodes={nodes}
        links={links}
        ariaLabel={`Money flow Sankey. ${sources.length} sources totalling £${Math.round(gross/1000)}k, ${stages.length} expense stages, ${sinkLabel.toLowerCase()} £${Math.round(Math.abs(surplus)/1000)}k.`}
      />
      {/* V-3 fix (2026-05-28): explicit reconciliation strip so the headline
          ("Net deficit −£86k") ties out visibly to the receipt items. Before
          this strip the user could read Rental + Dividends + State pension on
          the left and Essentials + Debt service on the right, see them roughly
          net to zero, and miss the Tax & NI stage that bridges the −£86k gap.
          Showing Tax & NI + Pension (even when £0) makes the math transparent. */}
      <div style={{
        marginTop: 10, padding: '8px 10px',
        background: 'var(--c-tint-neutral)', borderRadius: 8,
        fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.6,
        fontVariantNumeric: 'tabular-nums',
      }} aria-label="Cashflow reconciliation strip">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(gross/1000)}k</strong> gross</span>
          <span style={{ color: 'var(--c-text3)' }}>−</span>
          <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(taxAnn/1000)}k</strong> tax & NI</span>
          <span style={{ color: 'var(--c-text3)' }}>−</span>
          <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(pensionAnn/1000)}k</strong> pension</span>
          <span style={{ color: 'var(--c-text3)' }}>−</span>
          <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(essentials/1000)}k</strong> essentials</span>
          <span style={{ color: 'var(--c-text3)' }}>−</span>
          <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(debtService/1000)}k</strong> debt</span>
          {protection > 0 && <span style={{ color: 'var(--c-text3)' }}>−</span>}
          {protection > 0 && <span><strong style={{ color: 'var(--c-text)' }}>£{Math.round(protection/1000)}k</strong> protection</span>}
          <span style={{ color: 'var(--c-text3)' }}>=</span>
          <span><strong style={{ color: surplus >= 0 ? 'var(--c-acc)' : 'var(--c-coral, #FF6F7D)' }}>
            {surplus < 0 ? '−' : ''}£{Math.round(Math.abs(surplus)/1000)}k
          </strong> {sinkLabel.toLowerCase()}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 R3 §3 SIGNATURE — CashflowCalendarHeatmap
// Wraps the shared CalendarHeatmap component with entity-derived data. 12 cells,
// each = one month's surplus/deficit £. Coral = deficit, accent = surplus.
// Falls back to a flat baseline if `trajectories.monthlySurplusHistory` is
// absent — see route-3-cashflow.md §4.1 + §9 empty state.
// ─────────────────────────────────────────────────────────────────────────────
function CashflowCalendarHeatmap({ entity }) {
  const months = (() => {
    // Preferred path — pre-recorded trajectory.
    const hist = entity?.trajectories?.monthlySurplusHistory
    if (Array.isArray(hist) && hist.length > 0) {
      return hist.slice(-12).map((v, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (11 - i))
        const date = d.toISOString().slice(0, 7)
        const value = typeof v === 'object' ? +(v.surplus || v.value || 0) : +v
        return { date, value: isFinite(value) ? value : 0 }
      })
    }
    // Fallback — derive 12 months from annualised surplus with realistic UK
    // seasonality (Task #100 fix, 2026-05-26). Indexed by calendar month so
    // Jan/Feb show post-Christmas tightness, Apr shows tax-year bump,
    // Jul/Aug summer holiday drag, Dec gift load. Same shape for every entity
    // but scaled by their actual annual surplus so the cells render
    // informative variance rather than a flat single-tone strip.
    // Task #100 fix v2 (2026-05-26): persona shapes use income.dividends /
    // income.rentalIncome / income.salary / income.statePension.annual rather
    // than a single income.gross. Sum the known sub-fields so the fallback
    // actually has a non-zero baseline for retired/decum personas.
    const incObj = entity?.income || {}
    const directGross = +(incObj.gross || incObj.annual || entity?.annualIncome || 0)
    const sumSubfields = +(
      (+incObj.salary || 0)
      + (+incObj.employment || 0)
      + (+incObj.selfEmployed || 0)
      + (+incObj.dividends || 0)
      + (+incObj.rental || 0)
      + (+incObj.rentalIncome || 0)
      + (+incObj.savingsInterest || 0)
      + (+incObj.overseasIncome || 0)
      + (+incObj.other || 0)
      + (+(incObj.statePension?.annual) || 0)
      + (+entity?.drawdown || 0)
    )
    const income = directGross || sumSubfields
    const spend = +(entity?.expenses?.annual
      || (entity?.expenses?.essentialsMonthly || 0) * 12
      || (entity?.expenses?.monthly || 0) * 12
      || (entity?.monthlyEssentials || 0) * 12
      || (entity?.spend?.monthlyEssentials || 0) * 12
      || 0)
    // Honest fallback — if surplus parses as 0 still, show absolute spend
    // pattern instead of a flat strip. Variance in WHAT it costs each month
    // is still useful info even when net surplus is unknown.
    let annualSurplus = (income - spend)
    if (!annualSurplus) annualSurplus = -spend || income || 12000 // visible variance, sign-honest
    const baseMonthly = annualSurplus / 12

    // CX-5 (2026-05-28): seasonality multipliers were fabricated (12 hardcoded
    // numbers presented as if real). §9 honesty: don't paper over missing
    // data with invented patterns. If we have monthlySurplusHistory in the
    // persona, use it. Otherwise return a FLAT 12-month series and let the
    // heatmap render a uniform colour — visually says "no seasonality data
    // to show yet".
    const yr = new Date().getFullYear()
    const realHistory = Array.isArray(entity?.monthlySurplusHistory)
      ? entity.monthlySurplusHistory
      : Array.isArray(entity?.trajectories?.monthlySurplusHistory)
        ? entity.trajectories.monthlySurplusHistory
        : null

    const out = []
    if (realHistory && realHistory.length === 12) {
      // Use the real data. Each entry is either { date, value } or just a number.
      for (let cm = 0; cm < 12; cm++) {
        const r = realHistory[cm]
        const value = typeof r === 'number' ? r : Math.round(+r?.value || 0)
        const ds = (typeof r === 'object' && r?.date) || `${yr}-${String(cm + 1).padStart(2, '0')}`
        out.push({ date: ds, value })
      }
    } else {
      // No real history — flat baseMonthly. Heatmap renders uniform colour.
      // The honest empty state.
      for (let cm = 0; cm < 12; cm++) {
        const ds = `${yr}-${String(cm + 1).padStart(2, '0')}`
        out.push({ date: ds, value: Math.round(baseMonthly), isEstimate: true })
      }
    }
    return out
  })()
  const values = months.map(m => m.value).filter(v => isFinite(v))
  const min = values.length ? Math.min(...values, 0) : -1
  const max = values.length ? Math.max(...values, 0) : 1
  return (
    <div className="sw-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
        Monthly surplus · 12-month seasonality
      </div>
      <CalendarHeatmap
        months={months}
        range={[min, max]}
        ariaLabel={`Monthly surplus heatmap. ${months.length} months. Range £${Math.round(min/1000)}k to £${Math.round(max/1000)}k.`}
      />
      <div style={{
        fontSize: 10, color: 'var(--c-text3)', marginTop: 8,
        display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
      }}>
        <span>Surplus · Deficit (monthly)</span>
        <span style={{ fontFeatureSettings: '"tnum" 1' }}>
          {values.some(v => v < 0) ? 'Includes deficit months' : 'All months surplus'}
        </span>
      </div>
    </div>
  )
}

// Section drawer extracted 2026-05-28 to src/components/shared/MoneyXDrawer.jsx.
// Render via <MoneyXDrawer activeRoute="flow" entity={entity} onNav={onNav} />.
import MoneyXDrawer from '../components/shared/MoneyXDrawer.jsx'

// "Am I OK right now?" rebuilt to the drawer bar (founder 2026-06-04: "apply
// this logic to all tiles"). Leads with the net position + an INTERACTIVE
// break-even model (trim spend / add income + a back-solve that closes the gap),
// then COMPACT ROWS that open detail sub-drawers — replacing the old 8-card
// static scroll. msNet = signed monthly net (surplus − deficit), engine-sourced.
function NowDrawer({ entity, incomeAll, ms, msNet, flow, accountantMode, lb, surplusAlloc, onSurplusBreakdown, onIncomeBreakdown }) {
  const [openRow, setOpenRow] = useState(null)
  const [trim, setTrim] = useState(0)     // £/mo spending cut (delta on engine baseline)
  const [extra, setExtra] = useState(0)   // £/mo extra income (delta)
  const income = Math.round(ms.income || 0)
  const out = Math.round((ms.essential || 0) + (ms.committed || 0) + (ms.debtService || 0) + (ms.tax || 0))
  const newNet = msNet + trim + extra
  const deficit = Math.max(0, -msNet)
  const maxTrim = Math.max(100, Math.round((ms.essential || 0) + (ms.committed || 0)))
  const maxExtra = Math.max(500, income)
  const essPct = income > 0 ? Math.round(((ms.essential || 0) / income) * 100) : null
  const dirty = trim > 0 || extra > 0
  const inDeficit = msNet < 0
  const rows = [
    { key: 'flow', label: 'Where your money flows', stat: `${_gk(income)} in · ${_gk(out)} out`, render: (
      <>
        <CashflowMoneySankey entity={entity} incomeAll={incomeAll} ms={ms} flow={flow} />
        <CashflowWaterfallReconciled entity={entity} incomeAll={incomeAll} ms={ms} flow={flow} accountantMode={accountantMode} />
        <button onClick={onSurplusBreakdown} className="sw-chip sw-chip-sm sw-press" style={{ marginTop: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--c-acc)' }}>Full surplus breakdown ›</button>
      </>
    ) },
    { key: 'split', label: 'Essentials vs discretionary', stat: essPct != null ? `${essPct}% essential` : '—', render: (
      <>
        <EssentialsDiscretionarySplit ms={ms} />
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.5 }}>Subscriptions count toward essentials. Automatic detection arrives with Open Banking; until then they're inside the figures above.</div>
      </>
    ) },
    { key: 'income', label: 'Income — by source & tax band', stat: `${_gk(incomeAll?.total || income)} · ${incomeAll?.items?.length || 0} src`, render: (
      <>
        <IncomeBySourceCard entity={entity} incomeAll={incomeAll} />
        <IncomeBreakdownByBand incomeAll={incomeAll} />
        <button onClick={onIncomeBreakdown} className="sw-chip sw-chip-sm sw-press" style={{ marginTop: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--c-acc)' }}>Full income breakdown ›</button>
      </>
    ) },
    { key: 'buffer', label: 'Your safety buffer', stat: lb?.months != null ? (lb.months >= 24 ? `${Math.round(lb.months / 12)}+ yrs` : `${Math.round(lb.months)} mo`) : '—', render: <LiquidityBufferCard lb={lb} /> },
    ...(ms.surplus > 0 ? [{ key: 'alloc', label: 'What to do with your surplus', stat: `${_gk(ms.surplus)}/mo spare`, render: <SurplusAllocator surplus={ms.surplus} deficit={ms.deficit} alloc={surplusAlloc} /> }] : []),
  ]
  const open = rows.find(r => r.key === openRow)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* LEAD — net position + interactive break-even */}
      <div className="sw-card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: inDeficit ? 'var(--c-coral-text)' : msNet > 0 ? 'var(--c-mint-text)' : 'var(--c-text)' }}>
          {inDeficit ? 'In deficit' : msNet > 0 ? 'In surplus' : 'Breaking even'} {_gk(Math.abs(msNet))}/mo
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5, marginTop: 3 }}>
          {_gk(income)} comes in and {_gk(out)} goes out each month{inDeficit ? `, so you draw about ${_gk(deficit)}/mo from savings or pots to cover it.` : msNet > 0 ? `, leaving ${_gk(msNet)} spare.` : '.'}
        </div>
        <div style={{ marginTop: 10, display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'var(--c-surface2)' }}>
          <div style={{ width: `${Math.min(100, Math.round((income / Math.max(1, income, out)) * 100))}%`, background: 'var(--c-mint-text)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--c-text3)', marginTop: 3 }}><span>in {_gk(income)}</span><span>out {_gk(out)}</span></div>
        <div style={{ marginTop: 12, borderTop: '1px solid var(--c-sep)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)' }}>What would fix it? — drag a lever</div>
            {dirty && <button onClick={() => { setTrim(0); setExtra(0) }} style={{ background: 'none', border: 'none', color: 'var(--c-acc)', cursor: 'pointer', fontWeight: 700, fontSize: 11, padding: 0 }}>reset</button>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text2)', margin: '5px 0 7px' }}>New monthly position: <strong style={{ color: newNet >= 0 ? 'var(--c-mint-text)' : 'var(--c-coral-text)' }}>{newNet >= 0 ? '+' : '−'}{_gk(Math.abs(newNet))}/mo</strong></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            <SolverSlider label="Trim spending" value={trim} min={0} max={maxTrim} step={50} fmt={v => `−${_gk(v)}/mo`} onChange={setTrim} dirty={trim > 0} />
            <SolverSlider label="Extra income" value={extra} min={0} max={maxExtra} step={50} fmt={v => `+${_gk(v)}/mo`} onChange={setExtra} dirty={extra > 0} />
          </div>
          {inDeficit && <button onClick={() => { setExtra(Math.min(deficit, maxExtra)); setTrim(0) }} className="sw-chip sw-chip-sm sw-chip-mint sw-press" style={{ marginTop: 8, cursor: 'pointer', fontWeight: 700 }}>↩ Back-solve: close the {_gk(deficit)}/mo gap</button>}
          <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.5 }}>Drag a lever, or let it solve the gap. Illustration on your figures — not advice.</div>
        </div>
      </div>
      {/* COMPACT ROWS → detail sub-drawers */}
      {rows.map(r => (
        <button key={r.key} onClick={() => setOpenRow(r.key)} className="sw-lift sw-pressable" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', width: '100%', padding: '11px 13px', borderRadius: 12, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{r.label}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text2)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{r.stat}</div>
          <span style={{ color: 'var(--c-text3)', fontSize: 18, flexShrink: 0, lineHeight: 1 }}>›</span>
        </button>
      ))}
      {open && (
        <DrillStackProvider>
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--c-bg)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 16px 96px' }}>
              <button onClick={() => setOpenRow(null)} className="sw-pressable" style={{ background: 'none', border: 'none', color: 'var(--c-acc)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--c-text)', margin: '8px 0 14px' }}>{open.label}</h2>
              <RevealStagger interval={60} startDelay={40}>{open.render}</RevealStagger>
            </div>
          </div>
        </DrillStackProvider>
      )}
    </div>
  )
}

export default function Cashflow({ entity, onHome, onBack, onNav, onOpenRisk, onDrillMetric, scenarioSeed, onScenarioSeedConsumed }) {
  // Back-routing (2026-05-28): if the user came from another screen (e.g.
  // MyMoney → Cashflow via section-nav chip), the back chevron should return
  // there, not jump to Home. Dashboard threads `onBack=goBack` which reads
  // the previous tab from Dashboard's history ref. Fallback to onHome when
  // unwired (standalone snap, deep-link entry, etc.).
  const goBackOrHome = onBack || onHome
  const [windowId, setWindowId] = useState('current-period')
  // F4 (2026-06-02): viewMode now reads the SHARED temporal store (useTemporalMode)
  // instead of a local useState, so the global tax-year/mode chip and the other
  // tabs stay in sync — previously Cashflow's Today/Future/Plan was an island.
  // Phase 2 note: content sections below still do not branch per mode (Future/Plan
  // show the honest "(coming soon)" chip); differentiated projected/plan content is
  // a separate engine-wiring task.
  const { mode: viewMode, setMode: setViewMode } = useTemporalMode()
  const [accountantMode, setAccountantMode] = useState(
    inferAccountantMode(entity)
  )
  const [swrRegime, setSwrRegime] = useState('bengen')
  // L3 drill panel — 'surplus' | 'income' | 'health'
  const [drillView, setDrillView] = useState(null)
  // Seed banner state — set when a scenario seed lands from the TappableNumber
  // bus. Cleared once user dismisses or after 30s. Keeps the visible "I see
  // your what-if" affordance even after Dashboard's seed-state clears.
  const [activeSeed, setActiveSeed] = useState(null)
  useEffect(() => {
    if (!scenarioSeed) return
    setViewMode('scenario')
    setActiveSeed(scenarioSeed)
    onScenarioSeedConsumed?.()
  }, [scenarioSeed, onScenarioSeedConsumed])

  // A4 last-mile (2026-05-28): bv invalidates every engine memo below when
  // the user flips the TY chip, so the screen recomputes against the new
  // bundle instead of showing yesterday's numbers.
  const bv = useBundleVersion()
  // Live assumptions: subscribing here re-renders the screen when the user moves
  // a dial in Settings → Assumptions; `cv` is threaded into every CMA-using memo
  // below (alongside bv) so the projections recompute against the new numbers.
  const { cma: CMA_BUNDLE, version: cv } = useActiveCMA()

  // ── Anchors ────────────────────────────────────────────────────────────
  // Use calcFQ (canonical per Home v1.4 §Q1.2) — was calcFQCalibrated which
  // returned a different total and made the score inconsistent across tabs.
  const fq        = calcFQ(entity)
  const risk      = calcRisk(entity)
  const nw        = netWorth(entity)
  const fqBandObj = fqBand(fq.total)
  const rkBandObj = riskBand(risk.total)

  // ── Cashflow Health (§3B hero) ─────────────────────────────────────────
  const health = useMemo(
    () => cashflowHealth(entity, CMA_BUNDLE),
    [entity, bv, cv]
  )

  // ── §A NOW computations ────────────────────────────────────────────────
  const incomeAll = useMemo(
    () => calcAllIncome(entity, CMA_BUNDLE),
    [entity, bv, cv]
  )
  const ms = useMemo(() => monthlySurplus(entity, CMA_BUNDLE), [entity, bv, cv])
  // Net monthly position. monthlySurplus clamps surplus to ≥0 and routes the
  // negative into `deficit`, so surplus − deficit is the true signed figure that
  // reconciles with Home's deficit hero (same engine, was read off the wrong key).
  const msNet = (+(ms?.surplus) || 0) - (+(ms?.deficit) || 0)
  // Canonical net-of-tax cashflow — single source for Sankey + waterfall so they
  // cannot diverge and tax & NI are real, never £0 (2026-06-02 correctness gate).
  const flow = useMemo(() => cashflowFlow(entity, CMA_BUNDLE), [entity, bv, cv])
  const lb = useMemo(() => liquidityBuffer(entity), [entity, bv, cv])
  const surplusAlloc = useMemo(
    () => recommendedSurplusAllocation(entity, ms.surplus),
    [entity, ms.surplus, bv, cv]
  )

  // ── §B TRAJECTORY computations ─────────────────────────────────────────
  const swr = useMemo(
    () => swrFromRegime(swrRegime, null, CMA_BUNDLE),
    [swrRegime, bv, cv]
  )
  // swrRegime threaded so the picker actually drives the gauge (A2 — the picker
  // was a dead control: fundedRatio read entity.swrRegime, never the UI state).
  const fr = useMemo(() => fundedRatio(entity, CMA_BUNDLE, { swrRegime }), [entity, swrRegime, bv, cv])
  const fi = useMemo(() => fiRatio(entity), [entity, bv, cv])

  // The ONE engine: real tax-minimising drawdown sequence (per-pot, per-year +
  // ranked routes). Decumulators only — the goal spec routes accumulators away
  // (solver returns null), so this card is a decumulation surface. Computed
  // FIRST so the probabilistic cards below can reuse its target/horizon and
  // can't contradict the deterministic plan on the same screen (one-engine).
  const decSolve = useMemo(() => {
    try {
      const spec = buildGoalSpec(entity)
      if (spec.branch !== 'decumulation') return null
      // perHolding: per-asset-class growth (cash ~3% vs equity ~6%) + per-line
      // CGT (real embedded gain, not flat 0.4). Opt-in so test baselines stay
      // flat; production uses the accurate engine.
      return solveDecumulation({ entity, goalSpec: spec, opts: { perHolding: true } })
    } catch { return null }
  }, [entity, bv, cv])
  // Same target income + horizon the deterministic plan resolved, so the MC
  // fan / sequence-stress / GK corridor share one set of assumptions with it.
  const trajOpts = useMemo(() => {
    const i = decSolve?.inputs
    if (!i) return {}
    const portfolio = (decSolve.network?.nodes || []).filter(n => n.kind === 'pot').reduce((s, n) => s + (n.value || 0), 0)
    return {
      targetIncome: i.incomeTargetAnnual,
      horizonYears: Math.max(5, i.horizonAge - i.currentAge),
      startAge: i.currentAge,
      startValue: portfolio || undefined,
    }
  }, [decSolve])

  // Year-1 income range across the 5 pacing methods — drives the "How fast can
  // I spend?" tile headline so it reads as a real spending range, not "5 methods".
  const methodsRange = useMemo(() => {
    if (!decSolve?.rankedPaths?.length) return null
    try {
      const portfolio = (decSolve.network?.nodes || []).filter(n => n.kind === 'pot').reduce((s, n) => s + (n.value || 0), 0)
      const ws = compareMethods({
        portfolio, years: Math.max(1, (decSolve.inputs?.horizonAge || 95) - (decSolve.inputs?.currentAge || 65)),
        growth: decSolve.inputs?.growth ?? 0.05, inflation: decSolve.inputs?.inflation ?? 0.025,
        essentialsAnnual: Math.round((decSolve.inputs?.incomeTargetAnnual || 0) * 0.6), age: decSolve.inputs?.currentAge || 65,
      }).map(m => m.year1Withdrawal || 0).filter(Boolean)
      return ws.length ? { lo: Math.min(...ws), hi: Math.max(...ws) } : null
    } catch { return null }
  }, [decSolve])

  // 1000-run Monte Carlo per spec §5.4 / §5.5 (O-CF-RULES-01).
  const pos = useMemo(
    () => cf_probabilityOfSuccess(entity, CMA_BUNDLE, 1000, trajOpts),
    [entity, bv, cv, trajOpts]
  )
  const seqVuln = useMemo(
    () => cf_sequenceOfReturnsVulnerability(entity, CMA_BUNDLE, trajOpts),
    [entity, bv, cv, trajOpts]
  )
  const gkPath = useMemo(
    () => guytonKlingerPath(entity, trajOpts.horizonYears || 30, CMA_BUNDLE),
    [entity, bv, cv, trajOpts]
  )

  // ── §C DEPTH computations ──────────────────────────────────────────────
  const coi = useMemo(() => totalCoI(entity, CMA_BUNDLE), [entity, bv, cv])
  const coiVar = useMemo(() => coiCashflowVariants(entity), [entity, bv, cv])
  const prcPcc = useMemo(() => cf_prcPccSpread(entity), [entity, bv, cv])
  const reality = useMemo(
    () => cf_realityEngineFactorisation(entity, CMA_BUNDLE),
    [entity, bv, cv]
  )
  const mdd = useMemo(
    () => cf_maxDrawdownExposure(entity, CMA_BUNDLE),
    [entity, bv, cv]
  )
  const eff = useMemo(
    () => cf_portfolioEfficiency(entity, CMA_BUNDLE),
    [entity, bv, cv]
  )

  // §A "Now" section content — built here (parent scope: entity/incomeAll/ms/
  // flow/accountantMode/surplusAlloc/lb/setDrillView all available) and passed
  // as the 'now' question-tile's render-prop content, so the drill buttons keep
  // working and nothing is re-typed.
  const nowSectionContent = (
    <NowDrawer
      entity={entity}
      incomeAll={incomeAll}
      ms={ms}
      msNet={msNet}
      flow={flow}
      accountantMode={accountantMode}
      lb={lb}
      surplusAlloc={surplusAlloc}
      onSurplusBreakdown={() => setDrillView('surplus')}
      onIncomeBreakdown={() => setDrillView('income')}
    />
  )

  // ── Render ─────────────────────────────────────────────────────────────
  // L3 drill overlay — takes full screen priority
  if (drillView === 'surplus') {
    return <SurplusDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }
  if (drillView === 'income') {
    return <IncomeBreakdownDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }
  if (drillView === 'health') {
    return <HealthScoreDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }

  return (
    <div style={S.shell}>
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div style={S.header}>
        <button
          onClick={goBackOrHome}
          className="sw-press"
          style={S.backBtn}
          aria-label={onBack ? 'Back to previous screen' : 'Back to home'}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={S.headerTitle}>Cashflow</div>
        {/* P&L view toggle REMOVED (founder 2026-06-04 — "redundant"): the
            accountant view is auto-inferred (inferAccountantMode) and the
            waterfall already shows its own Simple/Accountant indicator, so a
            floating top-level toggle was redundant chrome. */}
        <div style={{ width: 1 }} />
      </div>

      {/* ── Scrollable body — STORY-FIRST ORDER (R3v2 founder direction 2026-05-26) ─
           Chrome contract: NW/Wealth/Risk pills live in the GLOBAL HEADER (Dashboard.jsx).
           Body order: Today/Future/Plan/What if PRIMARY → Story banner ANSWER →
           Health overview → Numeric depth (waterfall, scenarios) → Engine internals (collapsed).

           Body TripleAnchor + SubAnchor removed — they either duplicated the global
           header (NW/Wealth/Risk) or surfaced engineer-jargon (PRC/PCC) above the story.
           PRC/PCC moves to the engine-detail reveal at the bottom of the screen. */}
      <div style={S.body}>

        {/* §0 — STATEMENT STRIP (MoneyXDrawer) REMOVED from Cashflow (founder
             decision 2026-06-04, locking a 3×-oscillating call). The Balance
             Sheet / Income Statement / Tax / Protection / Trusts / Cost-of-
             inaction cross-statement nav dominated the top of the tab (worst on
             mobile, where it overflowed) and answered "why am I seeing Balance
             Sheet on Cashflow?". Other statements are reachable via the sidebar
             and contextual deep-links. Strip stays on the screens where it fits. */}

        {/* §1 — Today / Future / Plan / What if — PRIMARY navigation chrome.
            Moved to top of body (was mid-page round 7) so the user has the
            time-axis context before reading any number. */}
        <FadeInOnMount delay={20}>
          <X28TopBar
            window={windowId}
            viewMode={viewMode}
            onWindowChange={setWindowId}
            onViewModeChange={setViewMode}
            showWindowRow={false}
          />
        </FadeInOnMount>

        {/* §2 — STORY BANNER — the 10-second answer.
            R3v2 (2026-05-26): real-answer card now computes a single sentence
            framing the user's actual position, not just the question. */}
        <FadeInOnMount delay={60}>
          <PurposeStatement
            entity={entity}
            lb={lb}
            fr={fr}
            pos={pos?.pos ?? pos}
            fi={fi}
            ms={ms}
            decSolve={decSolve}
          />
        </FadeInOnMount>

        {/* Cashflow Health Score REMOVED (founder decision 2026-06-04): the
            composite band needed an apology note ("reads Healthy but surplus is
            £0") and blended accumulation metrics into a single number that
            contradicted the hero. The "Am I OK right now?" tile owns that job
            honestly and per-persona. CashflowHealthHero kept in-file for the
            health drill only (reachable from that tile if ever wanted).

            Monthly seasonality heatmap REMOVED: it rendered 12 identical green
            bars ("all months surplus") — placeholder data with no real series,
            and it contradicted the actual surplus. Real-or-nothing per §9. */}

        {/* Scenario seed banner — surfaces what the user asked us to model when
            they landed here via a TappableNumber "Tweak in scenario mode" link. */}
        {viewMode === 'scenario' && activeSeed && (
          <ScenarioSeedBanner seed={activeSeed} onDismiss={() => setActiveSeed(null)} />
        )}

        {/* View-mode context chip — differentiates Today/Future/Plan visually.
            Phase 2: remove once each mode branches to distinct content. */}
        {viewMode !== 'scenario' && viewMode !== 'actual' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 16px',
            background: 'var(--c-surface2)',
            borderRadius: 'var(--r-md, 12px)',
            fontSize: 11, fontWeight: 600, color: 'var(--c-text2)',
            letterSpacing: '0.04em',
            margin: '0 0 4px',
          }}>
            <span style={{ color: 'var(--c-acc)' }}>●</span>
            {viewMode === 'forecast' && "Showing today's figures — forward-modelled spend isn't on this tab yet (coming soon). See Timeline for projections."}
            {viewMode === 'plan'     && "Showing today's figures — plan-vs-actual variance isn't on this tab yet (coming soon)."}
          </div>
        )}

        {/* View-mode + window aware container — re-key triggers reveal animations */}
        <div
          key={`${viewMode}::${windowId}`}
          className="sw-tab-slide"
          style={{ display: 'contents' }}
        >
          {/* WHOLE-TAB QUESTION-TILE GRID (redesign complete): §A "Now" + the
              four trajectory tiles + §C "Costs" are now one adaptive grid, each
              tile opening a full-screen page that renders the SAME components
              (moved, not rewritten). The long A/B/C scroll the founder flagged
              is gone; the headline band above answers "will my money last?". */}
          {/* A4 — pin the face (Building wealth / Drawing income) or leave Auto. */}
          <LifeStageOverrideChip entity={entity} />

          <CashflowTrajectoryTiles
            entity={entity}
            fr={fr}
            fi={fi}
            pos={pos}
            seqVuln={seqVuln}
            gkPath={gkPath}
            swr={swr}
            swrRegime={swrRegime}
            setSwrRegime={setSwrRegime}
            decSolve={decSolve}
            extraTiles={[
              // §A "Now" → first tile (the whole NOW section moved intact).
              { key: 'now', position: 'start', q: 'Am I OK right now?',
                // Net = surplus − deficit. monthlySurplus clamps surplus to ≥0
                // (negatives go to `deficit`), so reading `surplus` alone made
                // everyone "In surplus £0". Net ties this tile to Home's deficit.
                headline: (msNet > 0 ? 'In surplus' : msNet < 0 ? 'In deficit' : 'Breaking even'),
                sub: `${msNet < 0 ? '−' : ''}${fmtSeedNum(Math.abs(msNet))}/mo · spend, buffer & income`,
                tone: (msNet > 0 ? 'mint' : msNet < 0 ? 'coral' : 'acc'),
                content: nowSectionContent },
              // Methods → its own tile (decumulators with a solved plan only).
              ...(decSolve?.rankedPaths?.length ? [{ key: 'methods', q: 'How fast can I spend?',
                headline: methodsRange ? `${fmtSeedNum(methodsRange.lo)}–${fmtSeedNum(methodsRange.hi)}/yr` : 'Pace options',
                sub: 'five ways to pace it — steady ↔ flexible', tone: 'acc',
                content: (<MethodsComparison
                  portfolio={(decSolve.network?.nodes || []).filter(n => n.kind === 'pot').reduce((s, n) => s + (n.value || 0), 0)}
                  years={(decSolve.inputs?.horizonAge || 95) - (decSolve.inputs?.currentAge || 65)}
                  growth={decSolve.inputs?.growth ?? 0.05}
                  inflation={decSolve.inputs?.inflation ?? 0.025}
                  essentialsAnnual={Math.round((decSolve.inputs?.incomeTargetAnnual || 0) * 0.6)}
                  age={decSolve.inputs?.currentAge || 65}
                  horizon={decSolve.inputs?.horizonAge || 95}
                  primaryGoal={decSolve.binding?.primaryGoal || 'min_lifetime_tax'} />) }] : []),
              // §C "Costs/Depth" → last tile (engine internals, always-open here).
              { key: 'costs', q: "What's it costing?", headline: coi?.total ? `${fmtSeedNum(coi.total)}/yr` : 'See depth',
                sub: 'cost of inaction · charges · efficiency', tone: 'acc',
                content: (<EngineInternalsReveal alwaysOpen coi={coi} coiVar={coiVar} prcPcc={prcPcc} reality={reality} mdd={mdd} eff={eff} fi={fi} health={health} fr={fr} pos={pos} />) },
            ]}
          />

          {/* §C engine internals moved into the 'costs' question-tile (extraTiles). */}
        </div>

        {/* Disclaimer footer */}
        <div style={S.disclaimer}>
          {BRAND.disclaimer}<br />
          {BRAND.rulesVersion} · UK-CMA-2026.1 · Last verified: {BRAND.dataDate}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE INTERNALS REVEAL — R3v2 (2026-05-26) story-first methodology
// ═══════════════════════════════════════════════════════════════════════════
// Wraps the analytical-layer cards (PRC/PCC, Reality Engine, Implied MDD,
// Efficient Frontier, Confidence summary, CoI variants) behind a single
// "Show engine detail" toggle so the screen reads as a narrative above the
// fold. Power users / IFA reviewers expand to see the methodology.

function EngineInternalsReveal({ coi, coiVar, prcPcc, reality, mdd, eff, fi, health, fr, pos, alwaysOpen = false }) {
  const [open, setOpen] = useState(!!alwaysOpen)
  return (
    <div style={{ marginTop: alwaysOpen ? 0 : 16 }}>
      {!alwaysOpen && (
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 12, fontWeight: 700, color: 'var(--c-text2)',
        }}
      >
        <span>
          {open ? '▾' : '▸'} Show methodology
        </span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 500 }}>
          {open ? 'Hide' : 'Show methodology'}
        </span>
      </button>
      )}
      {open && (
        <div style={{ marginTop: 12 }}>
          <SectionDelimiter
            letter="C"
            title="What waiting costs you"
            subtitle="The price of leaving things as they are — and where charges quietly erode the plan."
            chipClass="sw-chip-violet"
          />
          <RevealStagger interval={60} startDelay={50}>
            <CoIOdometerWithHalo coi={coi} />
            <CfCoiVariantsCard coiVar={coiVar} />
            {/* PRC/PCC Spread + Reality Engine stub cards REMOVED from the user
                surface (founder decision 2026-06-04). Both are founder-IP stubs
                that rendered "methodology in progress" / "Experimental" to users
                — engineer diagnostics, not a cost the user can act on. They live
                in the engine (cf_prcPccSpread / cf_realityEngineFactorisation)
                for when the methodology is defined; until then they don't face
                users. O-CF-RULES-07 / O-CF-RULES-09. */}
            <MaxDrawdownCard mdd={mdd} />
            <EfficientFrontierV2
              userPosition={eff?.user_position || null}
              reference={eff?.reference || null}
              frontierPoints={eff?.frontier_points || null}
              distanceToFrontier={eff?.distance_to_frontier ?? null}
            />
            <FiProgressDepthCard fi={fi} />
            <ConfidenceIntervalSummary
              health={health}
              fr={fr}
              pos={pos}
              coi={coi}
            />
          </RevealStagger>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// CAT-04: accept both array AND object shapes for entity.income. Object
// shape (e.g. { directorSalary: 12k, dividends: 50k }) was previously
// invisible — Mr T-style accountant personas slipped through into Simple
// view. Normalise then probe for director / self-employment markers.
function inferAccountantMode(entity) {
  const inc = entity?.income
  const incomeArr = Array.isArray(inc)
    ? inc
    : (inc && typeof inc === 'object')
      ? Object.entries(inc).map(([type, amount]) => ({ type, amount }))
      : []
  if (incomeArr.length) {
    const TYPES = /director|self[_-]?employ|dividend/i
    if (incomeArr.some(i => {
      const t = String(i?.type || '').replace(/[_-]/g, '').toLowerCase()
      return /director|selfemployment|dividend/.test(t) || TYPES.test(i?.type || '')
    })) return true
    // Common object-shape keys.
    if (incomeArr.some(i => /^(directorSalary|dividends|selfEmployment)$/i.test(i?.type || ''))) return true
  }
  if (entity?.selfEmployed === true) return true
  const flags = entity?.persona?.flags || entity?.flags || []
  if (Array.isArray(flags) && flags.includes('director')) return true
  const occ = String(entity?.occupation || '').toLowerCase()
  if (/architect|consultant|freelance|contractor|director|founder/.test(occ)) return true
  return false
}

function humanise(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
}

function pct(n) {
  if (n === null || n === undefined) return '—'
  return `${Math.round(n * 100)}%`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ── Sub-anchor (D-ANCHOR-2) ──────────────────────────────────────────────
// STUB-03: prcPccSpread is a methodology stub (O-CF-RULES-07). Engine
// may return a value, but it carries `status: 'stub'` — never render the
// precise figure as if it were real. Always show "Coming next" until
// methodology lands.
function SubAnchor({ prcPcc }) {
  const stub =
    prcPcc?.status === 'stub' ||
    prcPcc?.insufficient_data ||
    prcPcc?.spread_pp == null
  // v0.3 R3 fix (2026-05-26): "PRC – PCC" / "Capital Efficiency" labels are
  // engineer-jargon for retail users. Relabel to "Return vs cost margin" with
  // a plain-English tooltip; mark Experimental rather than "PRC-PCC". Hide
  // entirely while methodology is still stub.
  if (stub) return null
  return (
    <div
      className="sw-card"
      style={S.subAnchor}
      title="The spread between your personal return and your personal cost of capital — methodology in development"
    >
      <div>
        <div className="sw-eyebrow">Return vs cost margin</div>
        <div style={S.subAnchorValue}>
          {`${prcPcc.spread_pp.toFixed(2)} pp`}
        </div>
      </div>
      <span className="sw-chip sw-chip-sm sw-chip-mint">
        Experimental
      </span>
    </div>
  )
}

// ── §3A — X25 purpose + real-answer banner ──────────────────────────────
// v0.3 R3 fix (2026-05-26): purpose-statement was a floating question with
// no answer next to it. The answer IS computable from runway + funded ratio
// + PoS. Surface it inline so the user sees the headline take in 3 seconds.
// ── Hero: TWO LENSES, clearly separated (founder decision 2026-06-04) ────────
// The old single sentence welded two disagreeing numbers with "but" ("pots
// stretch the full plan BUT cover only 48%") and never named WHY they differ.
// They were never contradictory: `fundedRatio` counts INVESTABLE POTS ONLY
// (excludes state pension + DB + annuities); `solveDecumulation` includes that
// secure-income floor. The gap between them IS the secure income. So we show
// two named lenses instead of one hedged line — never blended, never "but".
//   Decumulator → Lens A "Your plan" (lived answer, incl. secure floor) ·
//                 Lens B "If markets disappoint" (investment self-sufficiency)
//   Accumulator → funded-ratio is the WRONG metric (it assumes zero future
//                 saving), so Lens A "On track" (FI progress) · Lens B
//                 "Resilience" (buffer + the surplus lever). No doom %.
const HERO_TONE = {
  good: 'var(--c-acc)', warn: '#FF9500', bad: 'var(--c-coral, #FF6F7D)', neutral: 'var(--c-text3)',
}
function HeroLens({ label, head, sub, tone = 'neutral', gauge = null, tieout }) {
  const c = HERO_TONE[tone] || HERO_TONE.neutral
  return (
    <div data-tieout={tieout} style={{
      flex: '1 1 240px', minWidth: 0,
      padding: '12px 14px',
      background: `color-mix(in srgb, ${c} 9%, var(--c-surface))`,
      border: `1px solid color-mix(in srgb, ${c} 26%, transparent)`,
      borderRadius: 'var(--r-md, 12px)',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: c, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.32 }}>
        {head}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: 'var(--c-text3)', lineHeight: 1.45, marginTop: 5 }}>
          {sub}
        </div>
      )}
      {gauge != null && (
        <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: 'var(--c-surface2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, Math.min(100, Math.round(gauge * 100)))}%`, height: '100%', background: c, borderRadius: 99 }} />
        </div>
      )}
    </div>
  )
}

function PurposeStatement({ entity, lb, fr, pos, fi, ms, decSolve }) {
  // Runway months — prefer the liquidityBuffer engine answer; fall back to
  // cash ÷ essentials if needed.
  let runwayMo = +(lb?.months_covered ?? lb?.months ?? 0)
  if (!runwayMo && entity) {
    const cashLike = +(entity?.assets?.cash?.value
      || entity?.assets?.cash?.total
      || (Array.isArray(entity?.assets?.cash)
        ? entity.assets.cash.reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0)
        : 0)
      || 0)
    const mEss = +(entity?.expenses?.essentialsMonthly
      || entity?.expenses?.monthly
      || (entity?.expenses?.annual ? entity.expenses.annual / 12 : 0)
      || 0)
    if (cashLike && mEss) runwayMo = Math.round(cashLike / mEss)
  }
  const stage = (() => { try { return inferLifeStage(entity) } catch { return 'accumulator' } })()
  const isDecum = stage === 'decumulator' && !!decSolve?.rankedPaths?.length

  const fundedRatioVal = +(fr?.funded_ratio ?? fr?.ratio ?? 0)
  const fundedPct = fundedRatioVal > 0 ? Math.round(fundedRatioVal * 100) : null
  const swrPct = fr?.swr ? Math.round(fr.swr * 1000) / 10 : null
  const posPct = pos != null ? Math.round((+pos) * 100) : null

  let lensA, lensB, question
  if (isDecum) {
    const floor = decSolve.floor || {}
    const inp = decSolve.inputs || {}
    const target = inp.incomeTargetAnnual || fr?.target_income_real || 0
    const secure = floor.grossAnnual || 0
    // Tie out to the displayed target: residual = target − secure (gross basis),
    // so "£31k secure + £65k pots" sums to the £96k target on screen. (floor.
    // residualNeed is net-of-tax and wouldn't reconcile with the gross secure.)
    const residual = Math.max(0, target - secure)
    const lastsAge = decSolve.rankedPaths?.[0]?.depletedAtAge
    const horizonAge = inp.horizonAge || null
    question = 'Will your money last — and how much can you safely draw? Information only.'
    // Lens A — the LIVED plan: includes the secure-income floor, so it's the
    // complete answer ("lasts to X"), not the investments-only view.
    lensA = {
      label: 'Your plan',
      tone: lastsAge ? (lastsAge >= 90 ? 'good' : lastsAge >= 80 ? 'warn' : 'bad') : 'good',
      head: lastsAge
        ? `Drawing ${fmtSeedNum(target)}/yr, your money lasts to age ${lastsAge}.`
        : `Your ${fmtSeedNum(target)}/yr target holds${horizonAge ? ` through age ${horizonAge}` : ' for the full plan'} — your pots don’t run out.`,
      sub: secure > 0
        ? `${fmtSeedNum(secure)}/yr is secure income (state pension + DB); your pots supply the remaining ${fmtSeedNum(residual)}/yr.`
        : 'Every pound comes from your pots — no guaranteed income floor is captured yet.',
      tieout: 'cashflow.hero.plan',
    }
    // Lens B — investment self-sufficiency. The SAME funded ratio, but framed
    // honestly: it's what your pots alone would cover; the gap is the secure
    // income named in Lens A. Never welded to Lens A with "but".
    lensB = {
      label: 'If markets disappoint',
      tone: fundedRatioVal >= 0.85 ? 'good' : fundedRatioVal >= 0.6 ? 'warn' : 'bad',
      head: fundedPct != null
        ? `Your investments alone fund ${fundedPct}% of the target.`
        : 'Not enough investment data to stress-test.',
      sub: fundedPct != null
        ? `At a ${swrPct ?? 4}% safe-withdrawal rate your pots cover ${fundedPct}%; the rest leans on the secure income above.${posPct != null ? ` ${posPct}% of simulated markets sustain the full plan.` : ''}`
        : '',
      gauge: fundedPct != null ? fundedRatioVal : null,
      tieout: 'cashflow.hero.resilience',
    }
  } else {
    // Accumulator — funded-ratio assumes ZERO future saving, so it's the wrong
    // verdict here (that's why "under-funded 36%" was nonsense for a 35-yo).
    // Lens A = FI progress (a real current-state measure); Lens B = buffer +
    // the monthly-surplus lever. No doom percentage.
    const fiPct = fi?.ratio != null ? Math.round(fi.ratio * 100) : null
    const fiMult = fi?.multiple ?? null
    // monthlySurplus clamps surplus to ≥0 and puts the negative in `deficit`,
    // so the true net is surplus − deficit. Reading `surplus` alone made every
    // persona look like £0/"breaking even" (and Home, which reads the deficit,
    // disagreed). Net reconciles the two tabs.
    const surplusM = (+(ms?.surplus) || 0) - (+(ms?.deficit) || 0)
    question = 'Are you saving enough, and on track for the life you want? Information only.'
    lensA = {
      label: 'On track',
      tone: fiPct != null && fiPct >= 100 ? 'good' : fiPct != null && fiPct >= 40 ? 'warn' : 'neutral',
      head: fiPct != null
        ? (fiPct >= 100
            ? `You’ve reached financial independence — ${fiMult}× your target spend.`
            : `You’re ${fiPct}% of the way to financial independence.`)
        : 'Add investments and a target to track financial independence.',
      sub: fiPct != null
        ? `Financial independence ≈ 25× your annual spend. You hold ${fiMult}× today — keep investing to close the gap.`
        : '',
      tieout: 'cashflow.hero.fi',
    }
    lensB = {
      label: 'Resilience',
      tone: runwayMo >= 6 ? 'good' : runwayMo >= 3 ? 'warn' : 'bad',
      head: runwayMo > 0
        ? `Your cash buffer covers ${runwayMo} month${runwayMo === 1 ? '' : 's'} of essentials.`
        : 'No cash buffer captured yet.',
      sub: surplusM > 0
        ? `You’re saving about ${fmtSeedNum(surplusM)}/mo — the lever that compounds toward the goal.`
        : surplusM < 0
          ? `Spending exceeds income by ${fmtSeedNum(Math.abs(surplusM))}/mo — closing that gap is the first lever.`
          : 'Monthly surplus is about £0 — nothing is being saved right now; that’s the lever to watch.',
      tieout: 'cashflow.hero.resilience',
    }
  }

  const stageChip = stage === 'decumulator' ? 'Drawing income' : 'Building wealth'

  return (
    <div style={{ ...S.purpose, textAlign: 'left' }}>
      {/* TWO LENSES, never blended. Each owns its own number; Lens A's sub-line
          names WHY the two views differ (the secure income), so they read as
          complements, not the old self-contradicting "stretch ... but 48%". */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <HeroLens {...lensA} />
        <HeroLens {...lensB} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span className="sw-chip sw-chip-sm" data-tieout="cashflow.life-stage" style={{ fontWeight: 600 }}>
          {stageChip}
        </span>
        <div style={{ ...S.purposeLine2, fontSize: 11, color: 'var(--c-text3)' }}>
          {question}
        </div>
      </div>
    </div>
  )
}

// ── §3B — Cashflow Health hero ──────────────────────────────────────────
const HEALTH_BAND_CHIP = {
  Critical: 'sw-chip-coral',
  Stressed: 'sw-chip-amber',
  Steady:   'sw-chip-blue',
  Healthy:  'sw-chip-mint',
  Thriving: 'sw-chip-mint',
}
const HEALTH_COLOUR = {
  Critical: 'var(--c-coral-text)',
  Stressed: 'var(--c-amber-text)',
  Steady:   'var(--c-blue-text)',
  Healthy:  'var(--c-mint-text)',
  Thriving: 'var(--c-mint-text)',
}

// Spec §3B mandates exactly 5 cashflow-native components. Map engine keys
// (liquidityBuffer / surplus / sequenceVuln / protectionGap / taxEfficiency)
// to the spec-aligned UI labels and DROP the imposters:
//   · protectionGap belongs on Risk D5 (NOT cashflow) — removed entirely
//   · taxEfficiency belongs on Tax & Estate — removed from cashflow hero
// Surplus → "Surplus ratio", liquidityBuffer → "Bill coverage",
// sequenceVuln → "Sequence resilience". incomeResilience + fundedRatio +
// debtServiceRatio are computed UI-side from existing engine outputs.
const HEALTH_COMPONENT_LABEL = {
  liquidityBuffer:   'Bill coverage',
  surplus:           'Surplus ratio',
  sequenceVuln:      'Sequence resilience',
  incomeResilience:  'Income resilience',
  fundedRatio:       'Funded ratio',
  debtServiceRatio:  'Debt service ratio',
  billCoverage:      'Bill coverage',
  surplusRatio:      'Surplus ratio',
}

// v0.3 R3 fix (2026-05-26): plain-English tooltips for each sub-score so
// users can read what "100" or "40" actually means. Information only.
const HEALTH_COMPONENT_TIP = {
  liquidityBuffer:   'Months of essential bills your cash buffer covers. 100 = 6+ months covered.',
  billCoverage:      'Months of essential bills your cash buffer covers. 100 = 6+ months covered.',
  surplus:           'Monthly income minus all outgoings, as a share of income. 100 = strong surplus, 0 = zero surplus or deficit.',
  surplusRatio:      'Monthly income minus all outgoings, as a share of income. 100 = strong surplus, 0 = zero surplus or deficit.',
  incomeResilience:  'How much of your income is left after essentials. 100 = essentials are a small fraction of income.',
  fundedRatio:       'Projected retirement assets vs target income need. 100 = fully funded, 50 = half-funded.',
  debtServiceRatio:  'Monthly debt payments as a share of income. 100 = debt service under 10% of income, 0 = above 40%.',
  sequenceVuln:      'Resilience to a bad-returns sequence early in drawdown. Higher = more resilient.',
}

function CashflowHealthHero({ health, incomeAll, ms, fr, entity }) {
  if (!health) return null
  // Detect band crossings via prev band → flash via .sw-band-flash on the hero number
  const prevBand = usePrevious(health.band)
  const bandChanged = prevBand && prevBand !== health.band
  const numberClass = ['sw-hero', bandChanged ? 'sw-band-flash' : ''].filter(Boolean).join(' ')

  // ─── Spec-aligned component derivation (MATH-04, CAT-01, CAT-02) ───
  // Keep engine cashflow-native components; drop protectionGap (Risk-only)
  // and taxEfficiency (Tax-only). Top up with UI-derived ratios so we
  // surface the spec's full 5.
  const ec = health?.components || {}
  // Income resilience: months of essentials covered by liquid + investable
  // assets if income vanished. Coarse proxy from existing engine outputs.
  const annInc = +(incomeAll?.gross_annual ?? incomeAll?.total ?? 0)
  const essAnn = +(ms?.essentials_annual ?? (ms?.essential != null ? ms.essential * 12 : 0))
  const surplusAnn = +(ms?.surplus != null ? ms.surplus * 12 : 0)
  const incomeResilienceScore = annInc > 0
    ? Math.max(0, Math.min(100, Math.round((annInc - essAnn) / Math.max(annInc, 1) * 100)))
    : null
  // Funded ratio score: clamp engine ratio at 1.0 = 100, 0.5 = 50.
  const frRatio = +(fr?.ratio ?? fr?.value ?? 0)
  const fundedRatioScore = frRatio > 0
    ? Math.max(0, Math.min(100, Math.round(frRatio * 100)))
    : null
  // Debt service ratio (lower = better). DSR <10% → 100; >40% → 0.
  const debtAnn = +(ms?.debt_service_annual ?? (ms?.debtService != null ? ms.debtService * 12 : 0))
  const dsrPct = annInc > 0 ? (debtAnn / annInc) * 100 : null
  const debtServiceScore = dsrPct == null ? null
    : Math.max(0, Math.min(100, Math.round(100 - Math.max(0, (dsrPct - 10)) * 100 / 30)))

  // Final 5 — spec-aligned. Skip nulls so empty data shows honestly.
  const spec5 = [
    ['billCoverage',     ec.liquidityBuffer],
    ['surplusRatio',     ec.surplus],
    ['incomeResilience', incomeResilienceScore],
    ['fundedRatio',      fundedRatioScore],
    ['debtServiceRatio', debtServiceScore],
  ].filter(([, v]) => v != null && Number.isFinite(+v))

  // MATH-03 / MATH-05 narrative-consistency hint: surface a small caveat
  // when band reads "Healthy" but surplus is 0 or negative.
  const surplusContradiction = (
    health.band === 'Healthy' || health.band === 'Thriving'
  ) && (surplusAnn <= 0)

  const colour = HEALTH_COLOUR[health.band] || 'var(--c-text)'
  const chipClass = HEALTH_BAND_CHIP[health.band] || ''

  return (
    <div
      className="sw-card sw-card-elevated sw-lift"
      style={S.heroCard}
    >
      <div
        className="sw-eyebrow"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        Cashflow Health Score
        <ExplainerChip id="HOME-3" size={14} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 14,
        marginTop: 'var(--space-sm)', flexWrap: 'wrap',
      }}>
        <span className={numberClass} style={{ color: colour }}>
          <Num value={health.total} format="score" animate />
        </span>
        <span
          className={`sw-chip ${chipClass}`}
          style={{ fontWeight: 700, letterSpacing: 0.4 }}
        >
          {health.band}
        </span>
      </div>

      {surplusContradiction && (
        <div style={{
          marginTop: 'var(--space-sm)', padding: '6px 10px',
          background: 'var(--c-tint-amber, color-mix(in srgb, var(--c-amber-text) 8%, transparent))',
          border: '1px solid color-mix(in srgb, var(--c-amber-text) 25%, transparent)',
          borderRadius: 'var(--r-md)', fontSize: 11, color: 'var(--c-amber-text)',
          lineHeight: 1.4,
        }}>
          Note: band reads {health.band} but monthly surplus is £0 — score is
          driven by reserves + low debt. Surplus is the lever to watch.
        </div>
      )}

      <div style={S.heroComponents}>
        {/* v0.3 R3 fix (2026-05-26): five sub-scores rendered as bare numbers
            with no definitions. Added plain-English explainer block above the
            bars so user knows what 100/0/48/40 actually mean. Tooltips on
            each row as a secondary reading channel. */}
        <div style={{
          marginBottom: 8, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          Each sub-score is 0-100. Higher is better. Hover any row for the formula.
        </div>
        <RevealStagger interval={50} startDelay={120} as="div" style={S.heroComponentsGrid}>
          {spec5.map(([k, v]) => (
            <ComponentRow
              key={k}
              label={HEALTH_COMPONENT_LABEL[k] || humanise(k)}
              value={v}
              tip={HEALTH_COMPONENT_TIP[k]}
            />
          ))}
        </RevealStagger>
      </div>
    </div>
  )
}

// Tiny row with a thin animated progress bar (0 → value).
// MATH-07 fix: engine returns components on 0–100 scale (not 0–20). Map
// straight through so bars don't saturate.
function ComponentRow({ label, value, tip }) {
  const pctV = Math.max(0, Math.min(100, Math.round(+value || 0)))
  const colour = pctV >= 70 ? 'var(--c-mint-text)'
              : pctV >= 40 ? 'var(--c-amber-text)'
              : 'var(--c-coral-text)'
  return (
    <div
      title={tip || undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
        padding: '4px 0',
        cursor: tip ? 'help' : 'default',
      }}
    >
      <div style={{
        flex: 1, fontSize: 11, color: 'var(--c-text2)',
      }}>{label}{tip && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--c-text3)' }}>ⓘ</span>}</div>
      <div className="sw-bar" style={{ flex: 1, maxWidth: 100 }}>
        <div className="fill" style={{ width: `${pctV}%`, background: colour }} />
      </div>
      <strong style={{
        minWidth: 24, textAlign: 'right',
        fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--c-text)',
      }}>{pctV}</strong>
    </div>
  )
}

// ── Section delimiter — sticky letter badge + title + 1-line purpose ────
// ── §B trajectory as question-tiles (2026-06-03) ───────────────────────────
// Founder: the §B trajectory scroll is "so long" and must be called from a
// drawer/tile like the balance sheet. Four question-tiles, each opening a
// full-screen page that renders the SAME components (moved, not rewritten).
// This is the first increment of the whole-tab question-tiles plan; §A/§C
// migration + the headline-answer band (evolving PurposeStatement) follow.
const CF_TILE_TITLES = {
  lastability: 'Will my money last?',
  drawdown: 'Where my income comes from',
  resilience: 'What if markets fall?',
  whatif: 'What would change it most?',
}
function QuestionTile({ q, headline, sub, tone, onClick }) {
  const accent = tone === 'coral' ? 'var(--c-coral-text)' : tone === 'mint' ? 'var(--c-mint-text)' : 'var(--c-acc)'
  return (
    <button onClick={onClick} className="sw-card sw-lift sw-pressable" style={{
      display: 'flex', flexDirection: 'column', textAlign: 'left', gap: 3, padding: '14px',
      borderRadius: 16, cursor: 'pointer', width: '100%', height: '100%', boxSizing: 'border-box',
      border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text3)' }}>{q}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{headline}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4 }}>{sub}</div>}
      <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--c-acc)' }}>View ›</div>
    </button>
  )
}
function CashflowTrajectoryTiles({ entity, fr, fi, pos, seqVuln, gkPath, swr, swrRegime, setSwrRegime, decSolve, extraTiles = [] }) {
  const [open, setOpen] = useState(null)
  const ratio = +(fr?.ratio || fr?.value || 0)
  const lastsAge = decSolve?.rankedPaths?.[0]?.depletedAtAge
  const routeName = decSolve?.rankedPaths?.[0]?.name
  const sev = seqVuln?.severity || seqVuln?.level
  // Adaptive face — three states: a decumulator WITH a solved plan asks "how do
  // I draw it down?"; a decumulator with NO target income (no routes) is prompted
  // to set one; an accumulator asks "am I on track?". Gate on rankedPaths so the
  // tile matches the drawer, never claiming a plan that isn't there.
  const isDecum = !!(decSolve?.rankedPaths?.length)
  let decumStage = false
  try { decumStage = inferLifeStage(entity) === 'decumulator' } catch { decumStage = false }
  const fiPct = fi?.ratio != null ? Math.round(fi.ratio * 100) : null
  // planAge = when pots deplete, or the plan horizon when they never do — so the
  // tile says "To age 95" in step with the hero, not the bare "0.48×" funded
  // ratio (which keys off depletedAtAge and is null when pots hold).
  const planAge = lastsAge || decSolve?.inputs?.horizonAge || null
  // Sustainability tile is ADAPTIVE — one tile, not two. Decumulators ask "will
  // it last" (plan answer + funded stress); accumulators ask "am I on track"
  // (FI progress, NOT funded-ratio doom). This kills the duplicate funded/FI
  // pair the founder flagged ("Will my money last 0.36×" beside "Building
  // wealth"). Both drill to the same lastability panel.
  const sustainTile = isDecum
    ? { key: 'lastability', q: 'Will my money last?', headline: planAge ? `To age ${planAge}` : (ratio ? `${ratio.toFixed(2)}×` : '—'),
        sub: ratio ? `plan + ${Math.round(ratio * 100)}% funded on investments` : 'your plan + market stress', tone: (planAge ? planAge >= 90 : ratio >= 1) ? 'mint' : 'coral' }
    : { key: 'lastability', q: 'Am I on track? (FI)', headline: fiPct != null ? (fiPct >= 100 ? 'On track' : `${fiPct}% to FI`) : '—',
        sub: 'progress to financial independence', tone: (fiPct != null && fiPct >= 100) ? 'mint' : 'acc' }
  // Drawdown tile only for decumulators — for an accumulator it would open an
  // empty ScenarioForwardSummary (decSolve is null → the panel returns null).
  // That empty-drawer bug is why the accumulator face must not show this tile.
  // Name by the user's GOAL (turn savings into income), never the engine's chosen
  // mechanism. "Pension-first sequence" was the solver's OUTPUT as a tile name —
  // exactly what every adviser source avoids ("where does your paycheck come
  // from", not "pension-first"). The order + its reasoning live INSIDE the drawer.
  // The tile answers "where does my income COME FROM" — so the headline is the
  // SOURCE SPLIT (guaranteed + pots), NOT the target spend. Showing the £96k
  // target here was wrong: it's the input, not the answer, and it duplicated the
  // hero. £47k secure + £49k pots = the £96k, but framed as "where from".
  const targetInc = decSolve?.inputs?.incomeTargetAnnual || 0
  const secureInc = decSolve?.floor?.grossAnnual || 0
  const fromPots = Math.max(0, targetInc - secureInc)
  const drawdownTile = isDecum
    ? { key: 'drawdown', q: 'Where my income comes from',
        headline: secureInc ? `${fmtSeedNum(secureInc)} + ${fmtSeedNum(fromPots)}` : (targetInc ? `${fmtSeedNum(targetInc)}/yr` : 'Your income plan'),
        sub: secureInc ? 'secure income + your pots, tax-smart order' : 'a tax-smart order across your pots', tone: 'acc' }
    : decumStage
      ? { key: 'drawdown', q: 'Where my income comes from', headline: 'Set a target', sub: 'add a target income to plan it', tone: 'acc' }
      : null
  const baseTiles = [
    sustainTile,
    ...(drawdownTile ? [drawdownTile] : []),
    { key: 'resilience', q: 'What if markets fall?', headline: sev ? `${sev} exposure` : 'Stress-tested', sub: 'a bad run of markets early on', tone: 'acc' },
    { key: 'whatif', q: 'What would change it most?', headline: 'Top levers', sub: 'what-if & goal-seek', tone: 'acc' },
  ]
  // Whole-tab grid: §A "now" tiles first, the trajectory four, then §C "costs"
  // (and methods) last — each extra tile carries its own render-prop content.
  const startTiles = extraTiles.filter(t => t.position === 'start')
  const endTiles = extraTiles.filter(t => t.position !== 'start')
  const tiles = [...startTiles, ...baseTiles, ...endTiles]
  const openTile = tiles.find(t => t.key === open)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tiles.map(t => <QuestionTile key={t.key} q={t.q} headline={t.headline} sub={t.sub} tone={t.tone} onClick={() => setOpen(t.key)} />)}
      </div>
      {open && (
        <DrillStackProvider>
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--c-bg)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 16px 96px' }}>
              <button onClick={() => setOpen(null)} className="sw-pressable" style={{ background: 'none', border: 'none', color: 'var(--c-acc)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>← Back</button>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: '8px 0 16px' }}>{openTile?.q || CF_TILE_TITLES[open]}</h2>
              <RevealStagger interval={60} startDelay={40}>
                {openTile?.content || null}
                {open === 'lastability' && <LastabilityDrawer entity={entity} decSolve={decSolve} fr={fr} fi={fi} />}
                {open === 'drawdown' && <ScenarioMatrixWithRecompute entity={entity} decSolve={decSolve} />}
                {open === 'resilience' && <>
                  <SequenceStressHero entity={entity} seqVuln={seqVuln} />
                  {pos && !pos.insufficient_data && Array.isArray(pos.per_year_percentiles) && pos.per_year_percentiles.length > 1 && (() => {
                    const startYear = new Date().getFullYear()
                    const pyp = pos.per_year_percentiles
                    const horizon = pos.horizon_years || (pyp.length - 1)
                    const series = key => pyp.map(p => ({ year: startYear + p.year, value: p[key] }))
                    return (<>
                      <PoSChartV2 probability={pos.pos ?? null} median={series('p50')} bands={{ p10: series('p10'), p90: series('p90') }} guardrail={null} horizonYears={horizon} />
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.5 }}>Each year separately simulated across {pos.runs || 1000} market paths (10th–90th percentile band), on the same target income and horizon as your plan. A range of outcomes under market uncertainty — not a probability of any single result.</div>
                    </>)
                  })()}
                  {seqVuln && seqVuln.good_path && seqVuln.bad_path && !seqVuln.insufficient_data && <SequenceStressVisV2 goodSequence={seqVuln.good_path} badSequence={seqVuln.bad_path} horizonYears={seqVuln.horizon_years || 30} />}
                  <GuytonKlingerCorridor path={gkPath} />
                </>}
                {open === 'whatif' && <GoalSeekCard entity={entity} />}
              </RevealStagger>
            </div>
          </div>
        </DrillStackProvider>
      )}
    </>
  )
}
function SectionDelimiter({ letter, title, subtitle, chipClass = 'sw-chip-mint' }) {
  return (
    <FadeInOnMount>
      <div className="sw-card sw-card-elevated" style={S.delimiter}>
        <span
          className={`sw-chip ${chipClass}`}
          style={S.delimiterLetter}
        >
          {letter}
        </span>
        <div>
          <div style={S.delimiterTitle}>{title}</div>
          <div style={S.delimiterSubtitle}>{subtitle}</div>
        </div>
      </div>
    </FadeInOnMount>
  )
}

// A4 — manual life-stage override. The §B face is inferred (inferLifeStage),
// but "not everyone wants a drawdown" — the user can pin it. Commits a
// PREFERENCE_SET event → folds into entity.preferences.lifeStageOverride, which
// inferBranch/inferLifeStage already read, so the drawdown plan card flips to
// the FI face (and back) on the next fold. Two real branches only (the engine
// knows accumulator/decumulator) + Auto — no cosmetic 4th option. Preserve/
// legacy intent lives in the drawdown plan's priority reorder, not here.
function LifeStageOverrideChip({ entity }) {
  const { commit } = useEvents()
  const pid = entity?.id || entity?.personaId
  const override = entity?.preferences?.lifeStageOverride || null
  const inferred = (() => { try { return inferLifeStage(entity) } catch { return 'accumulator' } })()
  const set = (val) => { if (pid) commit(pid, { type: EV.PREFERENCE_SET, ts: Date.now(), payload: { lifeStageOverride: val } }) }
  const seg = (val, label) => {
    const isOn = val === null ? !override : override === val
    return (
      <button key={val || 'auto'} onClick={() => set(val)} className="sw-press"
        style={{ padding: '4px 11px', borderRadius: 'var(--r-pill, 999px)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          border: isOn ? '1px solid var(--c-acc)' : '1px solid var(--c-border)',
          background: isOn ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)' : 'transparent',
          color: isOn ? 'var(--c-acc)' : 'var(--c-text3)' }}>
        {label}
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0 12px' }}>
      <span style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>This view:</span>
      {seg(null, 'Auto')}
      {seg('accumulator', 'Building wealth')}
      {seg('decumulator', 'Drawing income')}
      {!override && (
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>
          detected: {inferred === 'decumulator' ? 'drawing income' : 'building wealth'}
        </span>
      )}
    </div>
  )
}

// ── §A.1 Reconciled waterfall (MATH-01, MATH-02) ─────────────────────────
// Wraps the V2 visual with engine-derived steps that arithmetic-sum:
//   income − tax − pension − essentials − debt = surplus
// No hardcoded fallbacks; renders empty state when income is missing.
function CashflowWaterfallReconciled({ entity, incomeAll, ms, flow, accountantMode }) {
  // Single source of truth: canonical net-of-tax cashflowFlow. Every bar reads
  // from it, so the waterfall ties out to the Sankey and to Home's surplus by
  // construction, and Tax & NI are real (never £0) (2026-06-02 correctness gate).
  const f = flow || cashflowFlow(entity)
  const gross         = f.gross
  const taxAnn        = f.taxAndNI
  const pensionAnn    = f.committed     // pension + ISA contributions
  const essentialsAnn = f.essentials
  const debtAnn       = f.debtService
  const protAnn       = f.protection

  // Empty state when engine returns no income — no magic numbers.
  if (!gross || gross <= 0) {
    return (
      <div className="sw-card sw-card-elevated" style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Cashflow waterfall</div>
          <span className="sw-chip sw-chip-sm">data pending</span>
        </div>
        <div style={{
          marginTop: 'var(--space-md)', padding: 'var(--space-md)',
          background: 'var(--c-tint-neutral)', borderRadius: 'var(--r-md)',
          fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          No income data available for this entity yet — add a salary,
          dividend, rental or pension stream via <strong>+ Income</strong> to
          populate the waterfall.
        </div>
      </div>
    )
  }

  // Surplus comes straight from cashflowFlow (gross − tax − NI − contributions −
  // essentials − debt − protection), so the visible bars sum to it exactly.
  const surplusAnn = f.surplusAnnual

  // Build base steps; conditionally splice protection row when protAnn > 0
  // so personas with no cover (e.g. mrT-aged-out) don't see a £0 phantom row.
  const baseSteps = accountantMode
    ? [
        { id: 'revenue',    label: 'Revenue',              value: gross,            kind: 'income' },
        { id: 'tax',        label: 'Tax & NI',             value: -taxAnn,          kind: 'deduction',
          note: incomeAll?.marginal_band ? `${incomeAll.marginal_band} band` : null },
        { id: 'pension',    label: 'Pension (pre-tax)',     value: -pensionAnn,      kind: 'deduction',
          note: pensionAnn > 0 ? 'Salary sacrifice / contribution' : null },
        { id: 'opex',       label: 'Operating costs',      value: -essentialsAnn,   kind: 'deduction',
          note: 'Housing + bills + transport' },
        { id: 'debt',       label: 'Debt service',         value: -debtAnn,         kind: 'deduction',
          note: 'Loans + cards' },
        { id: 'surplus',    label: 'Net surplus',          value: surplusAnn,       kind: 'surplus' },
      ]
    : [
        { id: 'income',     label: 'Gross income',         value: gross,            kind: 'income' },
        { id: 'tax',        label: 'Tax & NI',             value: -taxAnn,          kind: 'deduction',
          note: incomeAll?.marginal_band ? `${incomeAll.marginal_band} band` : null },
        { id: 'pension',    label: 'Pension contribution', value: -pensionAnn,      kind: 'deduction',
          note: pensionAnn > 0 ? 'Salary sacrifice / contribution' : null },
        { id: 'essentials', label: 'Essentials',           value: -essentialsAnn,   kind: 'deduction',
          note: 'Housing + bills + transport' },
        { id: 'debt',       label: 'Debt service',         value: -debtAnn,         kind: 'deduction',
          note: 'Loans + cards' },
        { id: 'surplus',    label: 'Annual surplus',       value: surplusAnn,       kind: 'surplus' },
      ]
  const steps = protAnn > 0
    ? [
        ...baseSteps.slice(0, -1),  // everything except surplus
        { id: 'protection', label: 'Protection premiums', value: -protAnn, kind: 'deduction',
          note: 'Life · CI · IP · PMI cover' },
        baseSteps[baseSteps.length - 1],  // surplus last
      ]
    : baseSteps

  return (
    <div className="sw-card sw-card-elevated" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>
          {accountantMode ? 'P&L statement' : 'Cashflow waterfall'}
        </div>
        <span className={`sw-chip sw-chip-sm${accountantMode ? ' sw-chip-blue' : ''}`}>
          {accountantMode ? 'Accountant view' : 'Simple view'}
        </span>
      </div>
      <CashflowWaterfallV2 steps={steps} />
    </div>
  )
}

// ── §A.1 Cashflow waterfall (§4.3) ───────────────────────────────────────
// ── DEAD CODE REMOVED 2026-05-28 (P0-6 closure) ─────────────────────────
// Old `CashflowWaterfall` legacy component is DELETED. It used hardcoded
// `target * 0.62` for essentials and Math.max(0, gross - target - surplus*12)
// for tax — both fabricated. Live rendering uses `CashflowWaterfallReconciled`
// (above) which reads engine-derived `ms.essentials_annual`, `incomeAll.tax_total_annual`,
// and arithmetic-sums to a real surplus. There is now a single waterfall
// implementation and it ties out to engine math.
//
// If you ever need to add a discretionary band, do it on `CashflowWaterfallReconciled`,
// not by reviving this dead function.

// ── §A.2 Essentials vs Discretionary (§4.4) ─────────────────────────────
function EssentialsDiscretionarySplit({ ms }) {
  const essentialsPct = (ms?.income || 0) > 0
    ? Math.min(100, Math.round(((ms?.essential || 0) / ms.income) * 100))
    : 0
  // ONS Living Costs and Food Survey 2022-23, Table A6 — UK households aged 45-54,
  // essential spend as % of disposable income.
  const cohortMedian = 58 // Source: ONS
  const colour = essentialsPct >= 70 ? 'var(--c-coral-text)'
              : essentialsPct >= 60 ? 'var(--c-amber-text)'
              : 'var(--c-mint-text)'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Essentials vs Discretionary</div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
      }}>
        <span className="sw-hero-md" style={{ color: colour }}>
          <Num value={essentialsPct} format="score" animate />
          <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 4 }}>%</span>
        </span>
        <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
          essentials of income
        </div>
      </div>
      <div className="sw-bar" style={{ marginTop: 'var(--space-sm)', height: 8 }}>
        <div className="fill" style={{ width: `${essentialsPct}%`, background: colour }} />
      </div>
      <div style={S.implication}>
        UK 45-54 cohort median: {cohortMedian}% (Source: ONS Living Costs and Food Survey).
        {essentialsPct >= 70 && ' If essentials exceed 70%, a single income shock creates a cashflow gap within weeks.'}
      </div>
    </div>
  )
}

// ── §A.3 Bill calendar + 7-day summary (§4.6) ───────────────────────────
// STUB-06: removed hardcoded dueDay=14. The bill grid only highlights
// days that come from real bill records (entity.bills[].dueDay). Until
// that data exists for a persona the calendar shows an empty state
// instead of pretending a bill is due on the 14th.
function BillCalendar({ entity }) {
  const bills = Array.isArray(entity?.bills) ? entity.bills : []
  const realDueDays = bills
    .map(b => +(b?.dueDay ?? b?.due_day ?? b?.day ?? 0))
    .filter(d => d > 0 && d <= 28)
  const totalAmount = bills.reduce((s, b) =>
    s + +(b?.amount ?? b?.monthly ?? 0), 0)
  const hasReal = realDueDays.length > 0

  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Bill calendar</div>
        <span className="sw-chip sw-chip-sm">
          {hasReal ? 'Next 28 days' : 'data pending'}
        </span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', fontSize: 13, color: 'var(--c-text2)',
      }}>
        {hasReal
          ? `${bills.length} bill${bills.length > 1 ? 's' : ''} scheduled · ${fmt(totalAmount)}/mo total.`
          : getContent('cashflow.noBillsState', 'No bills detected yet. Bill calendar populates once you add fixed bills (+ Bill) or connect Open Banking.')}
      </div>
      {hasReal && (
        <div style={S.calendarGrid}>
          {Array.from({ length: 28 }, (_, i) => {
            const day = i + 1
            const isDue = realDueDays.includes(day)
            return (
              <div
                key={i}
                className={isDue ? 'sw-pulse-glow' : ''}
                style={{
                  ...S.calendarCell,
                  background: isDue ? 'var(--c-tint-coral-2)' : 'var(--c-tint-neutral)',
                  border: isDue ? '1px solid var(--c-coral-text)' : '1px solid transparent',
                }}
                title={isDue ? `Day ${day} — bill due` : ''}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── §A.4 Subscription tracker (§4.7) ────────────────────────────────────
// STUB-05: honest label on the chip ("Phase 1.2") + Manual-add CTA that
// matches what's actually wired (announces to screen-reader, hands off
// to /money manual-input). No pretending to be live.
function SubscriptionTracker({ entity }) {
  const subs = entity?.subscriptions || []
  const total = subs.reduce((s, x) => s + (+x.monthly || +x.amount || 0), 0)
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Subscriptions</div>
        <span className="sw-chip sw-chip-sm">
          {subs.length > 0 ? `${subs.length} active` : 'Manual add · coming soon'}
        </span>
      </div>
      <div style={{ marginTop: 'var(--space-md)' }}>
        {subs.length > 0 ? (
          <>
            <span className="sw-hero-sm">
              <Num value={total} format="currency" animate />
              <span style={{
                fontSize: 12, color: 'var(--c-text3)', fontWeight: 500, marginLeft: 6,
              }}>
                /month
              </span>
            </span>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
              {fmt(total * 12)}/year across {subs.length} subscription{subs.length === 1 ? '' : 's'}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5 }}>
            {getContent('cashflow.noSubsState',
              'Recurring-charge detection arrives with Open Banking (Phase 1.2). Until then, add subscriptions manually so they appear in your essentials total.')}
          </div>
        )}
        <button
          type="button"
          className="sw-press"
          onClick={() => {
            // Honest hand-off — surface a screen-reader announcement so
            // assistive tech doesn't get a silent button. Future PR: route
            // to /money manual-input flow.
            const msg = 'Manual subscription entry — coming next (Phase 1.2).'
            if (typeof window !== 'undefined' && window?.console) {
              console.info('[SubscriptionTracker] add CTA:', msg)
            }
          }}
          aria-label="Add subscription manually — coming next"
          style={{
            marginTop: 'var(--space-sm)',
            padding: '6px 12px', borderRadius: 'var(--r-pill)',
            background: 'var(--c-surface2)',
            color: 'var(--c-text2)',
            border: '1px solid var(--c-border)',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          + Add manually (coming next)
        </button>
      </div>
    </div>
  )
}

// ── §A.5 Surplus allocator (§4.8) — 8-priority list ─────────────────────
function SurplusAllocator({ surplus, deficit, alloc }) {
  const allocList = alloc || []
  // Fire the deficit explainer only on a genuine deficit. monthlySurplus clamps
  // surplus to >0 and routes the shortfall to .deficit, so the old `surplus <= 0`
  // test mis-fired at exact break-even (2026-06-02).
  if (+deficit > 0) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Deficit explainer</div>
          <span className="sw-chip sw-chip-sm sw-chip-coral">Deficit</span>
        </div>
        <div style={{
          marginTop: 'var(--space-md)',
          color: 'var(--c-coral-text)',
          fontSize: 13,
        }}>
          Spending currently exceeds income. The levers that affect this position are: income, essentials, discretionary spend, recurring subscriptions. Information only — speak to a qualified UK financial adviser for personal recommendations.
        </div>
      </div>
    )
  }
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Surplus allocator</div>
        <span className="sw-chip sw-chip-sm sw-chip-mint">{fmt(surplus)} / mo</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-sm)',
      }}>
        {allocList.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
            No prioritised actions returned — surplus is small or all priorities already met.
          </div>
        )}
        {/* STUB-07: each priority gets a Take Action CTA per spec §4.8.
            Action is honest — surfaces an SR-friendly hand-off until the
            standing-order wiring lands (Phase 1.2). */}
        <RevealStagger interval={80} startDelay={50}>
          {allocList.map(a => (
            <div key={a.priority} className="sw-lift" style={S.allocRow}>
              <div style={S.allocPriority}>{a.priority}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  {humanise(a.target)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{a.reason}</div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--c-mint-text)',
                fontVariantNumeric: 'tabular-nums',
                minWidth: 70, textAlign: 'right',
              }}>
                {fmt(a.amount)}
              </div>
              <button
                type="button"
                className="sw-press"
                onClick={() => {
                  if (typeof window !== 'undefined' && window?.console) {
                    console.info('[SurplusAllocator] action:', a.target, fmt(a.amount))
                  }
                }}
                aria-label={`Set up ${humanise(a.target)} — coming next`}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--r-pill)',
                  background: 'var(--c-surface2)', color: 'var(--c-mint-text)',
                  border: '1px solid var(--c-tint-mint-2)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.3, whiteSpace: 'nowrap',
                }}
              >
                Set up
              </button>
            </div>
          ))}
        </RevealStagger>
      </div>
    </div>
  )
}

// ── §A.6 Liquidity Buffer (§4.9) — 3-band tinted pill ───────────────────
const LB_CHIP = {
  Critical: 'sw-chip-coral',
  Building: 'sw-chip-amber',
  Covered:  'sw-chip-mint',
}
const LB_COLOUR = {
  Critical: 'var(--c-coral-text)',
  Building: 'var(--c-amber-text)',
  Covered:  'var(--c-mint-text)',
}

function LiquidityBufferCard({ lb }) {
  if (!lb) return null
  const c = LB_COLOUR[lb.band] || 'var(--c-text)'
  const chip = LB_CHIP[lb.band] || ''
  const fillPct = Math.min(100, ((lb.months || 0) / 6) * 100)
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Liquidity Buffer</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>{lb.band}</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
      }}>
        <span className="sw-hero-md" style={{ color: c }}>
          {/* One-decimal, matching the §3A banner + drill — format="score"
              integer-rounded this to a different figure (5.7 → 6) and read as a
              second liquidity number (2026-06-02 single-source fix). */}
          {lb.months.toFixed(1)}
          <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 4 }}>mo</span>
        </span>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          3-band: Critical &lt;1mo · Building 1–3mo · Covered 3+mo
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
        {fmt(lb.accessibleCash || 0)} cash · {fmt(lb.monthlyEssential || 0)}/month essentials
      </div>
      <div className="sw-bar" style={{ marginTop: 'var(--space-sm)', height: 8 }}>
        <div className="fill" style={{ width: `${fillPct}%`, background: c }} />
      </div>
    </div>
  )
}

// ── §A.7a Income by source — Domain O split (CAT-03) ────────────────────
// Spec §4.3: split income into salary / dividends / rental / drawdown /
// interest / pension instead of presenting a single income band. Reads
// entity.income (array or object shape) and groups by canonical source.
const SOURCE_LABEL = {
  salary:     'Salary / employment',
  dividends:  'Dividends',
  rental:     'Rental',
  drawdown:   'Pension drawdown',
  interest:   'Interest / savings',
  pension:    'State / DB pension',
  selfemp:    'Self-employment',
  other:      'Other',
}
const SOURCE_COLOUR = {
  salary:    'var(--c-blue-text)',
  dividends: 'var(--c-violet-text)',
  rental:    'var(--c-amber-text)',
  drawdown:  'var(--c-mint-text)',
  interest:  'var(--c-mint-text)',
  pension:   'var(--c-blue-text)',
  selfemp:   'var(--c-coral-text)',
  other:     'var(--c-text3)',
}
function classifyIncomeSource(rawType) {
  const t = String(rawType || '').toLowerCase().replace(/[_-]/g, '')
  if (/^(salary|employment|paye)$/.test(t)) return 'salary'
  if (/director/.test(t))                   return 'salary'
  if (/dividend/.test(t))                   return 'dividends'
  if (/rental|rent/.test(t))                return 'rental'
  if (/drawdown/.test(t))                   return 'drawdown'
  if (/interest|savings/.test(t))           return 'interest'
  if (/pension|statepension/.test(t))       return 'pension'
  if (/selfemploy|sole/.test(t))            return 'selfemp'
  return 'other'
}
function IncomeBySourceCard({ entity, incomeAll }) {
  const inc = entity?.income
  const incomeArr = Array.isArray(inc)
    ? inc
    : (inc && typeof inc === 'object')
      ? Object.entries(inc).map(([type, amount]) => ({ type, amount }))
      : []
  // Group annual amounts.
  const buckets = {}
  for (const row of incomeArr) {
    const src = classifyIncomeSource(row?.type)
    const amount = +(row?.annual ?? row?.amount ?? row?.monthly_amount * 12 ?? 0)
    if (!amount) continue
    buckets[src] = (buckets[src] || 0) + amount
  }
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
    || +(incomeAll?.gross_annual ?? incomeAll?.total ?? 0)

  if (entries.length === 0) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Income by source</div>
          <span className="sw-chip sw-chip-sm">data pending</span>
        </div>
        <div style={{
          marginTop: 'var(--space-md)', fontSize: 12, color: 'var(--c-text3)',
          lineHeight: 1.5,
        }}>
          Add salary / dividends / rental / drawdown / interest / pension
          rows to see your income breakdown.
        </div>
      </div>
    )
  }

  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Income by source</div>
        <span className="sw-chip sw-chip-sm">Domain O</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-sm)',
      }}>
        {entries.map(([k, v]) => {
          const pctV = total > 0 ? Math.round((v / total) * 100) : 0
          const fillW = Math.round((v / max) * 100)
          return (
            <div key={k} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
            }}>
              <div style={{
                width: 130, fontSize: 11, color: 'var(--c-text2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {SOURCE_LABEL[k] || k}
              </div>
              <div className="sw-bar" style={{ flex: 1, height: 8 }}>
                <div
                  className="fill"
                  style={{ width: `${fillW}%`, background: SOURCE_COLOUR[k] || 'var(--c-text3)' }}
                />
              </div>
              <div style={{
                minWidth: 36, textAlign: 'right',
                fontSize: 11, color: 'var(--c-text3)',
              }}>
                {pctV}%
              </div>
              <div style={{
                minWidth: 80, textAlign: 'right',
                fontSize: 12, fontWeight: 700, color: 'var(--c-text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(v)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── §A.7 Income breakdown by tax band (D-INCOME-ORDERING-1) ─────────────
const BAND_LABEL = {
  non_savings: 'Non-savings (employment, rental, drawdown)',
  savings:     'Savings (interest)',
  dividends:   'Dividends',
  cgt:         'Capital gains',
}
const BAND_COLOUR = {
  non_savings: 'var(--c-blue-text)',
  savings:     'var(--c-mint-text)',
  dividends:   'var(--c-violet-text)',
  cgt:         'var(--c-amber-text)',
}

function IncomeBreakdownByBand({ incomeAll }) {
  const order = ['non_savings', 'savings', 'dividends', 'cgt']
  const total = incomeAll?.total || 0
  const byType = incomeAll?.byType || {}
  const max = Math.max(
    1,
    ...order.map(b => byType[b] || 0)
  )
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Income by tax band</div>
        <span className="sw-chip sw-chip-sm">UK ordering</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-sm)',
      }}>
        {order.map(band => {
          const v = byType[band] || 0
          if (v === 0) return null
          const pctV = total > 0 ? Math.round((v / total) * 100) : 0
          const fillW = Math.round((v / max) * 100)
          return (
            <div key={band} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
            }}>
              <div style={{
                width: 110, fontSize: 11, color: 'var(--c-text2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {BAND_LABEL[band]}
              </div>
              <div className="sw-bar" style={{ flex: 1, height: 8 }}>
                <div
                  className="fill"
                  style={{ width: `${fillW}%`, background: BAND_COLOUR[band] }}
                />
              </div>
              <div style={{
                minWidth: 36, textAlign: 'right',
                fontSize: 11, color: 'var(--c-text3)',
              }}>
                {pctV}%
              </div>
              <div style={{
                minWidth: 80, textAlign: 'right',
                fontSize: 12, fontWeight: 700, color: 'var(--c-text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(v)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── §B.1 SWR regime picker (§5.1) — spec-aligned 6 pills (STUB-08) ────
// Spec calls for: Bengen / Guyton-Klinger / Morningstar / Vanguard /
// PRC-anchored / Custom. Old floor_upside + bucket retired into the
// engine-friendly Custom catch-all.
const REGIMES = [
  { id: 'bengen',         label: 'Bengen 4% rule',          note: 'Classic' },
  { id: 'guyton_klinger', label: 'Guyton-Klinger 4.5%',     note: 'Dynamic guardrails' },
  { id: 'morningstar',    label: 'Morningstar UK 3.8%',     note: 'Cohort-adjusted (UK retirement income research)' },
  { id: 'vanguard',       label: 'Vanguard 3.3%',           note: 'Cohort-adjusted' },
  { id: 'prc_anchored',   label: 'Personal-return-anchored', note: 'Experimental' },
  { id: 'custom',         label: 'Custom',                  note: 'Override rate' },
]

// CANDIDATE-FOR-REMOVAL (redesign Phase B): the SWR picker is the rate-ASSUMPTION
// knob (it now drives the funded gauge via fundedRatio opts.swrRegime — A2). It
// overlaps the MethodDrawer (pacing comparison) inside the drawdown plan. Keep both
// for now (founder); decide in Phase B whether the gauge + MethodDrawer make it
// redundant.
function SwrRegimePicker({ regime, onChange, swr }) {
  // STUB-08: PRC-anchored and Custom aren't engine-backed yet — engine
  // returns the Bengen fallback rate. Surface that honestly rather than
  // showing the silent fallback as if it were the regime's true rate.
  const selectedDef = REGIMES.find(r => r.id === regime)
  const isStubRegime = regime === 'prc_anchored' || regime === 'custom'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Withdrawal-rate assumption</div>
        <span className={`sw-chip sw-chip-sm ${isStubRegime ? '' : 'sw-chip-mint'}`}>
          {isStubRegime ? 'Coming next' : swr?.source}
        </span>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)',
        marginTop: 'var(--space-md)',
      }}>
        {REGIMES.map(r => (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            className={`sw-chip sw-press ${regime === r.id ? 'sw-chip-mint' : ''}`}
            style={{ cursor: 'pointer', fontWeight: 600 }}
            title={r.note || ''}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div style={{
        marginTop: 'var(--space-md)', fontSize: 13, color: 'var(--c-text2)',
      }}>
        {isStubRegime ? (
          <>
            <strong style={{ color: 'var(--c-text)' }}>{selectedDef?.label}</strong> —
            methodology pending; showing Bengen default ({((swr?.rate || 0.04) * 100).toFixed(1)}%)
            until the engine surfaces the regime-specific rate.
          </>
        ) : (
          <>
            Selected SWR: <strong style={{ color: 'var(--c-mint-text)' }}>
              {((swr?.rate || 0) * 100).toFixed(1)}%
            </strong>
            {selectedDef?.note && (
              <span style={{ color: 'var(--c-text3)', marginLeft: 6 }}>
                · {selectedDef.note}
              </span>
            )}
          </>
        )}
      </div>
      <div style={{ marginTop: 'var(--space-sm)', fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>
        Sets the safe-withdrawal-rate behind the <strong>funded gauge</strong> — a more cautious rate (e.g. 3.3%) needs a bigger pot to count as fully funded. (Different from the <em>pacing methods</em> in the drawdown plan, which compare how fast to spend.)
      </div>
    </div>
  )
}

// ── §B.2 Funded ratio gauge (§5.2) — half-circle, animated ─────────────
function FundedRatioGauge({ fr }) {
  if (!fr || fr.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Funded ratio</div>
        <div style={{
          marginTop: 'var(--space-sm)', color: 'var(--c-text3)', fontSize: 12,
        }}>
          Insufficient data — add target income and retirement assets.
        </div>
      </div>
    )
  }
  const ratio = fr.ratio || 0
  // Thresholds match FundedRatioGauge.jsx statusFor() — ratio < 0.85 is Under-funded
  const zone = ratio >= 1.1  ? 'Over-funded'
             : ratio >= 1.0  ? 'On track'
             : ratio >= 0.85 ? 'Approaching target'
             : 'Under-funded'
  const c = ratio >= 1.0  ? 'var(--c-mint-text)'
           : ratio >= 0.85 ? 'var(--c-amber-text)'
           : 'var(--c-coral-text)'
  const chip = ratio >= 1.0  ? 'sw-chip-mint'
             : ratio >= 0.85 ? 'sw-chip-amber'
             : 'sw-chip-coral'

  // Half-circle gauge — DrawSVG animates the stroke-dashoffset.
  const r = 60, W = 200, H = 110, cx = W / 2, cy = 90
  const angle = Math.min(1.5, ratio) / 1.5 * Math.PI
  const x = cx - r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)

  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Funded ratio</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>{zone}</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
      }}>
        <DrawSVG duration={1200} easing="cubic-bezier(0.4, 0, 0.2, 1)">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                  fill="none" stroke="var(--c-tint-neutral-2)" strokeWidth="10" />
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`}
                  fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" />
            <text x={cx} y={cy - 8} textAnchor="middle"
                  fontSize="22" fontWeight="800" fill={c}>
              {ratio.toFixed(2)}x
            </text>
          </svg>
        </DrawSVG>
        <div>
          <div className="sw-eyebrow">{fr?.regime} · horizon {fr?.horizon_years}y</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
            Required: {fmt(fr?.required_assets || 0)}<br />
            Projected: {fmt(fr?.actual_assets_at_retirement || 0)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── §B.3 FI progress tile (§5.3) ────────────────────────────────────────
function FiProgressTile({ fi }) {
  if (!fi) return null
  const pctV = Math.min(100, Math.round((fi.ratio || 0) * 100))
  const c = pctV >= 100 ? 'var(--c-mint-text)'
           : pctV >= 50 ? 'var(--c-amber-text)'
           : 'var(--c-coral-text)'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>FI progress</div>
        <span className="sw-chip sw-chip-sm">25× target rule</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
      }}>
        <span className="sw-hero-md" style={{ color: c }}>
          <Num value={pctV} format="score" animate />
          <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 4 }}>%</span>
        </span>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          {fi.multiple ?? '—'}× current target · target {fmt(fi.fiTarget || 0)}
        </div>
      </div>
      <div className="sw-bar" style={{ marginTop: 'var(--space-sm)', height: 8 }}>
        <div className="fill" style={{ width: `${pctV}%`, background: c }} />
      </div>
    </div>
  )
}

// ── §B.6 Sequence-of-returns stress (§5.6) ──────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// P13-3 (2026-05-28, IFA must-fix #3): SequenceStressHero
// Story-banner version of sequence-of-returns risk. Renders ONLY at
// distribution / preservation / legacy life-stage (and only if the engine has
// adverse-path data). At accumulation, no point — there's no drawdown yet.
// Leads with the bad-luck depletion age + £ at risk; client-comprehensible
// version of "what happens if early years go wrong."
// ─────────────────────────────────────────────────────────────────────────────
function SequenceStressHero({ entity, seqVuln }) {
  // Accept both string codes ('distribution', 'preservation') and numeric codes
  // (4=pre-retirement, 5=distribution, 6=legacy/preservation in this codebase).
  const lifeStageStr = String(entity?.lifeStage || entity?.life_stage || '').toLowerCase()
  const lifeStageNum = +entity?.lifeStage
  const isDecum =
    lifeStageStr === 'distribution' || lifeStageStr === 'preservation' ||
    lifeStageStr === 'legacy' || lifeStageStr === 'pre-retirement' ||
    lifeStageNum === 4 || lifeStageNum === 5 || lifeStageNum === 6
  if (!isDecum) return null
  if (!seqVuln || seqVuln.insufficient_data) return null

  const sev = seqVuln.bad_years_severity
  const colour =
    sev === 'severe'   ? 'var(--c-coral-text)' :
    sev === 'moderate' ? 'var(--c-amber-text)' :
                         'var(--c-acc)'
  const bg =
    sev === 'severe'   ? 'var(--c-tint-coral)' :
    sev === 'moderate' ? 'var(--c-tint-amber)' :
                         'var(--c-tint-blue)'

  const medianAgeRaw = seqVuln.median_depletion_age
  const adverseAgeRaw = seqVuln.adverse_depletion_age
  // V-4 fix (2026-05-28): cap displayed terminal age at 100. Engine math
  // stays unchanged — display layer only. Beyond 100 the projection is
  // clinically nonsense and corrodes trust even when arithmetically correct
  // (Bruce 62 + 54y horizon → "age 116" reads as absurd).
  const TERMINAL_CAP = 100
  const medianAge = medianAgeRaw
  const adverseAge = adverseAgeRaw
  const medianOutlives = typeof medianAgeRaw === 'number' && medianAgeRaw > TERMINAL_CAP
  const adverseOutlives = typeof adverseAgeRaw === 'number' && adverseAgeRaw > TERMINAL_CAP
  const yearsLost = medianAge && adverseAge ? medianAge - adverseAge : null
  const poundsAtRisk = seqVuln.vulnerability_pounds

  return (
    <div role="region" aria-label="Sequence-of-returns risk story" style={{
      margin: '0 0 14px', padding: '16px 18px',
      background: bg,
      border: `1px solid ${colour}`,
      borderRadius: 16,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase', color: colour, marginBottom: 6 }}>
        If early retirement years went wrong
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.4, lineHeight: 1.3, marginBottom: 8 }}>
        {yearsLost > 0
          ? <>A bad-luck sequence in the first few years of drawdown shortens your funded window by <span style={{ color: colour }}>~{yearsLost} years</span>.</>
          : <>Your funded window is resilient to typical sequence risk — the bad-luck scenario shortens it minimally.</>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10 }}>
        {medianOutlives
          ? <>Median scenario: money <strong style={{ color: 'var(--c-text)' }}>outlives the plan horizon</strong>.</>
          : <>Median scenario: money lasts to age <strong style={{ color: 'var(--c-text)' }}>{medianAge}</strong>.</>}
        {' '}
        {adverseOutlives
          ? <>Adverse (1-in-5) scenario: money <strong style={{ color: colour }}>outlives the plan horizon</strong>.</>
          : <>Adverse (1-in-5) scenario: money runs out at age <strong style={{ color: colour }}>{adverseAge}</strong>.</>}
        {poundsAtRisk > 0 && <> About <strong style={{ color: colour }}>{fmt(poundsAtRisk)}</strong> of plan value sits in this risk band.</>}
      </div>
      {seqVuln.mitigation_savings && (
        <div style={{
          padding: '8px 10px', background: 'var(--c-surface)', borderRadius: 10,
          fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--c-text2)' }}>Levers that reduce the gap:</strong>
          {' '}3-year cash buffer adds <strong style={{ color: 'var(--c-acc)' }}>+{seqVuln.mitigation_savings.hold_3yr_cash_buffer}y</strong> ·
          {' '}switching to Guyton-Klinger guardrails adds <strong style={{ color: 'var(--c-acc)' }}>+{seqVuln.mitigation_savings.switch_to_gk_corridor}y</strong>.
          {' '}Both are information only — discuss with a regulated adviser before changing drawdown strategy.
        </div>
      )}
    </div>
  )
}

function SequenceOfReturnsCard({ seqVuln }) {
  if (!seqVuln || seqVuln.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Sequence-of-returns stress</div>
        <div style={{
          marginTop: 'var(--space-sm)', color: 'var(--c-text3)', fontSize: 12,
        }}>
          Insufficient data.
        </div>
      </div>
    )
  }
  const sev = seqVuln.bad_years_severity
  const c = sev === 'severe' ? 'var(--c-coral-text)'
         : sev === 'moderate' ? 'var(--c-amber-text)'
         : 'var(--c-mint-text)'
  const chip = sev === 'severe' ? 'sw-chip-coral'
              : sev === 'moderate' ? 'sw-chip-amber'
              : 'sw-chip-mint'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Sequence-of-returns stress</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>{sev}</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
      }}>
        <Stat label="Median deplete" value={`age ${seqVuln.median_depletion_age}`} />
        <Stat label="Adverse deplete" value={`age ${seqVuln.adverse_depletion_age}`} colour={c} />
        <Stat label="Vulnerability" value={`${seqVuln.vulnerability_years}y`} colour={c} />
        <Stat label="Pounds at risk" value={fmt(seqVuln.vulnerability_pounds)} colour={c} />
      </div>
      {seqVuln.mitigation_savings && (
        <div style={{
          marginTop: 'var(--space-sm)', fontSize: 11, color: 'var(--c-text3)',
        }}>
          Mitigation: 3yr cash buffer saves {seqVuln.mitigation_savings.hold_3yr_cash_buffer}y · GK corridor saves {seqVuln.mitigation_savings.switch_to_gk_corridor}y.
        </div>
      )}
    </div>
  )
}

// ── §B.7 Guyton-Klinger corridor (§5.7) — DrawSVG envelope ─────────────
function GuytonKlingerCorridor({ path }) {
  if (!path || path.length === 0) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Dynamic guardrails corridor (Guyton-Klinger)</div>
      </div>
    )
  }
  const W = 320, H = 110, pL = 40, pR = 8, pT = 10, pB = 22
  const pw = W - pL - pR, ph = H - pT - pB
  const maxBal = Math.max(...path.map(p => p.balance), 1)
  const px = i => pL + (i / Math.max(1, path.length - 1)) * pw
  const py = v => pT + ph - (v / maxBal) * ph
  const d = path.map((p, i) =>
    (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ',' + py(p.balance).toFixed(1)
  ).join(' ')
  // Build the ±20% corridor envelope around the median path
  const upper = path.map((p, i) =>
    (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ',' + py(p.balance * 1.2).toFixed(1)
  ).join(' ')
  const lower = path.map((p, i) =>
    (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ',' + py(p.balance * 0.8).toFixed(1)
  ).join(' ')
  const raises = path.filter(p => p.rule === 'prosperity').length
  const cuts = path.filter(p => p.rule === 'preservation').length

  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Dynamic guardrails corridor (Guyton-Klinger)</div>
        <span className="sw-chip sw-chip-sm">±20% triggers</span>
      </div>
      <DrawSVG duration={1100}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{
          display: 'block', marginTop: 'var(--space-sm)',
        }}>
          <path d={upper} fill="none" stroke="var(--c-tint-mint-2)" strokeWidth="1" strokeDasharray="2 3" />
          <path d={lower} fill="none" stroke="var(--c-tint-mint-2)" strokeWidth="1" strokeDasharray="2 3" />
          <path d={d} fill="none" stroke="var(--c-mint-text)" strokeWidth="2" />
          {path.map((p, i) =>
            p.rule === 'prosperity' ? (
              <circle key={i} cx={px(i)} cy={py(p.balance)} r="3" fill="var(--c-mint-text)" />
            ) : p.rule === 'preservation' ? (
              <circle key={i} cx={px(i)} cy={py(p.balance)} r="3" fill="var(--c-coral-text)" />
            ) : null
          )}
        </svg>
      </DrawSVG>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--c-text3)' }}>
        Expected over {path.length}y: {raises} raises · {cuts} cuts.
      </div>
    </div>
  )
}

// ── Scenario matrix wrapper with real selection state (STUB-02) ────────
// Tracks active scenario in local state so onSelect actually does work;
// recomputes a small forward-cashflow summary keyed to the selection.
function ScenarioMatrixWithRecompute({ entity, decSolve }) {
  // The old generic 5-scenario picker (cf_fiveCashflowScenarios) is removed: it
  // showed the same Status-quo / Underspend / G-K / Adverse / Long-life set for
  // EVERY user (not dynamic) with a mislabelled "Optimal", and conflated
  // withdrawal METHOD with draw ORDER. Its two real jobs are now properly homed
  // — draw ORDER in the routes strip below, withdrawal METHOD in the MethodDrawer.
  return <ScenarioForwardSummary entity={entity} decSolve={decSolve} />
}

// Compact £ formatters for the dense drawdown table.
const _gk = (n) => {
  const v = Math.round(+n || 0)
  if (Math.abs(v) >= 1e6) return '£' + (v / 1e6).toFixed(1) + 'm'
  if (Math.abs(v) >= 1000) return '£' + Math.round(v / 1000) + 'k'
  return '£' + v
}
const _gmo = (n) => '£' + Math.round((+n || 0) / 12).toLocaleString()

// ── Depletion curve — stacked pot balances over the drawdown horizon ───
// Plots the REAL end-of-year balances (`potsEnd`) the solver computed, so the
// curve turns over honestly (doctrine §4: a decumulating asset shows its
// lifecycle, never an ever-rising line) AND the stack order makes the draw
// sequence visible — you SEE which pot drains first. No fabricated growth
// curve; every point is a balance the engine decremented.
const _POTS = [
  // bottom→top of the stack; drawn pots (cash/gia/isa) sit under the preserved
  // pension so the pension "tail" — what survives for the estate — reads on top.
  { key: 'cash',    label: 'Cash',    color: 'var(--c-text3)' },
  { key: 'gia',     label: 'GIA',     color: 'var(--c-amber-text)' },
  { key: 'isa',     label: 'ISA',     color: 'var(--c-mint-text)' },
  { key: 'pension', label: 'Pension', color: 'var(--c-acc)' },
]
function DepletionCurve({ schedule, depletedAtAge }) {
  const pts = (schedule || []).filter(r => r && r.potsEnd)
  if (pts.length < 2) return null
  const maxV = Math.max(...pts.map(r => r.potsTotal || 0), 1) * 1.05
  if (maxV <= 1.05) return null   // no drawable pots → nothing to deplete
  const W = 320, H = 150, pL = 44, pR = 10, pT = 12, pB = 26
  const pw = W - pL - pR, ph = H - pT - pB
  const n = pts.length
  const px = i => pL + (n === 1 ? 0 : (i / (n - 1)) * pw)
  const py = v => pT + ph - (Math.max(0, v) / maxV) * ph
  // cumulative band tops, bottom→top, per point
  const band = (idx) => {
    const lowerKeys = _POTS.slice(0, idx).map(p => p.key)
    const upToKeys = _POTS.slice(0, idx + 1).map(p => p.key)
    const sum = (r, keys) => keys.reduce((s, k) => s + Math.max(0, r.potsEnd[k] || 0), 0)
    let d = ''
    pts.forEach((r, i) => { d += (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(sum(r, upToKeys)).toFixed(1) + ' ' })
    for (let i = n - 1; i >= 0; i--) d += 'L' + px(i).toFixed(1) + ',' + py(sum(pts[i], lowerKeys)).toFixed(1) + ' '
    return d + 'Z'
  }
  const totalLine = pts.map((r, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(r.potsTotal || 0).toFixed(1)).join(' ')
  const ageOf = i => pts[i].age
  const depIdx = depletedAtAge ? pts.findIndex(r => r.age >= depletedAtAge) : -1
  const yTicks = [0, maxV / 2, maxV]
  const xTickIdx = [0, Math.floor((n - 1) / 2), n - 1]
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
        Pots over time
      </div>
      <DrawSVG duration={900}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img"
             aria-label="Stacked pot balances declining across the drawdown years">
          {/* Y gridlines + £ labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={pL} y1={py(v)} x2={W - pR} y2={py(v)} stroke="var(--c-tint-neutral-2)" strokeWidth="0.5" strokeDasharray="2 3" />
              <text x={pL - 4} y={py(v) + 3} fontSize="8" fill="var(--c-text3)" textAnchor="end">{_gk(v)}</text>
            </g>
          ))}
          {/* Stacked pot bands (real balances) */}
          {_POTS.map((p, idx) => <path key={p.key} d={band(idx)} fill={p.color} opacity="0.55" />)}
          {/* Total outline */}
          <path d={totalLine} fill="none" stroke="var(--c-text2)" strokeWidth="1.5" />
          {/* Funds-low marker */}
          {depIdx >= 0 && (
            <g>
              <line x1={px(depIdx)} y1={pT} x2={px(depIdx)} y2={pT + ph} stroke="var(--c-coral-text)" strokeWidth="1" strokeDasharray="3 2" />
              <text x={px(depIdx)} y={pT - 3} fontSize="8" fill="var(--c-coral-text)" textAnchor="middle">funds low</text>
            </g>
          )}
          {/* X axis — age, labelled */}
          {xTickIdx.map((i, k) => (
            <text key={k} x={px(i)} y={H - 8} fontSize="8" fill="var(--c-text3)"
                  textAnchor={k === 0 ? 'start' : k === xTickIdx.length - 1 ? 'end' : 'middle'}>age {ageOf(i)}</text>
          ))}
          <text x={2} y={pT + 2} fontSize="8" fill="var(--c-text3)">£</text>
        </svg>
      </DrawSVG>
      {/* Legend (composition needs a key) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {_POTS.map(p => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--c-text3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, opacity: 0.55, display: 'inline-block' }} />{p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// SolverSlider — one labelled control for the live decumulation panel.
function SolverSlider({ label, value, min, max, step, fmt, onChange, dirty }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, flex: '1 1 140px', minWidth: 128 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.3 }}>
        <span>{label}</span>
        <span style={{ color: dirty ? 'var(--c-acc)' : 'var(--c-text2)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} aria-label={label}
        style={{ width: '100%', accentColor: 'var(--c-acc)' }} />
    </label>
  )
}

// The four decumulation priorities the SOLVER actually responds to (each maps
// to a scoring objective in decumulation-solver). Reordering these is how the
// user controls which route ranks #1 — turning the engine's default ranking
// (e.g. estate-first → pension-first) from a hidden assumption into a lever.
const RANKABLE_GOALS = [
  { type: 'income_floor',      label: 'Secure essential income for life' },
  { type: 'max_lifetime_spend', label: 'Spend more while I can enjoy it' },
  { type: 'min_lifetime_tax',  label: 'Pay less tax over my lifetime' },
  { type: 'legacy',            label: 'Leave more to family, after tax' },
]

// Draw-order network — pots (nodes) → "Your income" (sink), edges in the
// solved draw sequence. Reads solve.network (decumulation-solver buildNetwork):
// nodes {id,value,kind:'pot'} + the income sink; edges {from,order,kind}. The
// edge order comes from the #1 ranked path, so when the user back-solves a
// different target (or reorders priorities) and the ranking flips, THIS map
// redraws — the founder's "the network diagram may change too". Year-1 draws
// (£/yr per pot) come from the schedule so each node carries its real flow.
const _POT_PRETTY = { pension: 'Pension', isa: 'ISA', gia: 'GIA', cash: 'Cash', sipp: 'SIPP', db: 'DB pension' }
const _POT_IDS = ['pension', 'isa', 'gia', 'cash']
// Secure-income stream labels for the floor node (state/DB/annuity/rental).
const _STREAM_PRETTY = { state: 'State pension', DB: 'DB pension', lifetimeAnnuity: 'Annuity', PLA: 'Annuity', rental: 'Rental' }
function _secureStreamLabel(streams) {
  if (!streams?.length) return 'state pension, DB & guaranteed income'
  return streams.filter(s => s.gross > 0)
    .map(s => `${_STREAM_PRETTY[s.type] || (s.source === 'BTL' ? 'Rental' : 'Income')} ${_gk(s.gross)}`).join(' · ')
}
function DrawNetworkDiagram({ route, network, netTotal, currentAge }) {
  // Pot starting values come from the network; the per-pot draw TIMING + amounts
  // come from the SELECTED route's schedule (not always the #1 path), so the map
  // follows whichever route the user is reading + answers "how much from each pot
  // and from what age" — not just the year-1 snapshot (where only the first pot
  // shows a draw and the rest read £0).
  const potVal = {}
  ;(network?.nodes || []).filter(n => n.kind === 'pot').forEach(n => { potVal[n.id] = n.value || 0 })
  const sched = route?.schedule || []
  if (!sched.length || !Object.keys(potVal).length) return null

  // Per pot: first age drawn, £/yr while active (total ÷ active years), total.
  const info = {}
  _POT_IDS.forEach(id => {
    if (!(id in potVal)) return
    let firstAge = null, total = 0, activeYears = 0
    sched.forEach(yr => {
      const d = yr.draws?.[id] || 0
      if (d > 0) { if (firstAge == null) firstAge = yr.age; total += d; activeYears++ }
    })
    info[id] = { firstAge, total, perYear: activeYears ? Math.round(total / activeYears) : 0, value: potVal[id], drawn: total > 0 }
  })
  // Drawn pots in true draw order (by first age); preserved pots after.
  const drawn = _POT_IDS.filter(id => info[id]?.drawn).sort((a, b) => (info[a].firstAge ?? 1e9) - (info[b].firstAge ?? 1e9))
  const preserved = _POT_IDS.filter(id => info[id] && !info[id].drawn && info[id].value > 0)
  const seq = [...drawn, ...preserved]
  if (!seq.length) return null
  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th']

  // Secure-income floor node (P3 buildNetwork) — guaranteed income that feeds the
  // sink ALONGSIDE the pots, so the map no longer implies all income is drawn
  // from pots. Rendered as an extra row, never a depletable pot.
  const secureNode = (network?.nodes || []).find(n => n.kind === 'secure')
  const nRows = seq.length + (secureNode ? 1 : 0)
  // Calendar year beside each age (founder: years beside ages on the map).
  const baseYear = new Date().getFullYear()
  const calYear = (age) => (currentAge && age != null) ? baseYear + (age - currentAge) : null

  const rowH = 66, padY = 12
  const H = padY * 2 + nRows * rowH - 14
  const viewW = 340, leftW = 158, sinkX = 254, sinkCY = H / 2
  const potCY = i => padY + i * rowH + 26
  return (
    <div style={{ marginTop: 12, padding: '12px 12px 14px', borderRadius: 12, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>
        Your money map — {route?.name || 'draw order'}
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 8 }}>
        How much comes from each pot, and from what age, under this route (ranked under your priorities). Dragging the income changes <b>when</b> each pot is used; reorder your priorities (or pick another route) to change the <b>order</b>.
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: viewW, margin: '0 auto' }}>
        <svg width="100%" viewBox={`0 0 ${viewW} ${H}`} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Draw-order map: pots feeding your income">
          {seq.map((id, i) => {
            const d = info[id]
            if (!d.drawn) return null // preserved pots don't feed income — no edge
            const y = potCY(i), first = i === 0
            return (
              <path key={id} d={`M ${leftW} ${y} C ${leftW + 44} ${y}, ${sinkX - 34} ${sinkCY}, ${sinkX} ${sinkCY}`}
                fill="none" stroke="var(--c-acc)" strokeWidth={first ? 2.4 : 1.6}
                opacity={first ? 1 : 0.5} />
            )
          })}
          {secureNode && (() => {
            const y = potCY(seq.length)
            return (
              <path key="secure-edge" d={`M ${leftW} ${y} C ${leftW + 44} ${y}, ${sinkX - 34} ${sinkCY}, ${sinkX} ${sinkCY}`}
                fill="none" stroke="var(--c-mint-text)" strokeWidth={2} opacity={0.85} strokeDasharray="5 3" />
            )
          })()}
        </svg>
        {/* Pot nodes (left) — order badge, pot size, £/yr + start age (or preserved) */}
        {seq.map((id, i) => {
          const d = info[id]
          return (
            <div key={id} style={{ position: 'absolute', left: 0, top: `${(potCY(i) - 27) / H * 100}%`, width: leftW - 8,
              padding: '7px 9px', borderRadius: 10, background: 'var(--c-surface)', boxSizing: 'border-box',
              border: d.drawn && i === 0 ? '1px solid var(--c-acc)' : '1px solid var(--c-border)', opacity: d.drawn ? 1 : 0.62 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {d.drawn && <span style={{ fontSize: 9, fontWeight: 800, color: i === 0 ? 'var(--c-acc)' : 'var(--c-text3)' }}>{ORD[i] || ''}</span>}
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>{_POT_PRETTY[id] || id}</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 1 }}>{_gk(d.value)} pot</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: d.drawn ? 'var(--c-acc)' : 'var(--c-text3)', marginTop: 1 }}>
                {d.drawn ? `${_gk(d.perYear)}/yr from age ${d.firstAge}${calYear(d.firstAge) ? ` · ${calYear(d.firstAge)}` : ''}` : 'kept — not drawn'}
              </div>
            </div>
          )
        })}
        {/* Secure-income floor node — guaranteed inflow, not a depletable pot. */}
        {secureNode && (
          <div style={{ position: 'absolute', left: 0, top: `${(potCY(seq.length) - 27) / H * 100}%`, width: leftW - 8,
            padding: '7px 9px', borderRadius: 10, background: 'color-mix(in srgb, var(--c-mint-text) 12%, var(--c-surface))',
            border: '1px solid var(--c-mint-text)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-mint-text)' }}>FLOOR</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>Secure income</span>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--c-mint-text)', marginTop: 1 }}>{_gk(secureNode.value)}/yr guaranteed</div>
            <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 1 }}>{_secureStreamLabel(secureNode.streams)}</div>
          </div>
        )}
        {/* Income sink (right) */}
        <div style={{ position: 'absolute', right: 0, top: `${(sinkCY - 22) / H * 100}%`, width: 86,
          padding: '7px 8px', borderRadius: 10, background: 'color-mix(in srgb, var(--c-acc) 14%, var(--c-surface))', border: '1px solid var(--c-acc)', boxSizing: 'border-box', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text)' }}>Your income</div>
          {netTotal != null && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-acc)', marginTop: 1 }}>{_gk(netTotal)}/yr</div>}
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 8 }}>
        Pot sizes are today&rsquo;s value; the £/yr is the future (nominal) draw averaged over the years that pot funds your income, which is why a later pot can pay more than its size today (it grows first). The <span style={{ color: 'var(--c-mint-text)', fontWeight: 700 }}>green floor</span> is guaranteed income (state pension, DB, rental) that isn&rsquo;t drawn from a pot &mdash; it keeps paying even after the pots run out. The year-by-year table below has the exact figures.
      </div>
    </div>
  )
}

// Assumptions + rules behind the plan — answers the founder's "I don't know
// what assumptions are taking place" by surfacing solve.methodology: the
// editable assumptions (growth/horizon/etc) AND the named rules applied, each
// with plain-English + legal source + status (ENACTED/METHOD). This is the
// "surface methodology to the user" directive made real — drillable to bedrock.
function AssumptionsPanel({ methodology }) {
  const [open, setOpen] = useState(false)
  const assumptions = methodology?.assumptions || []
  const rules = methodology?.rules || []
  if (!assumptions.length && !rules.length) return null
  return (
    <div style={{ marginTop: 14, borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-surface2)', padding: '10px 12px' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="sw-pressable"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text2)' }}>What this plan assumes</span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{open ? 'Hide ▲' : 'Show ▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 8 }}>You&rsquo;re drawing down, not contributing. On these assumptions — which you can change:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assumptions.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11 }}>
                <span style={{ color: 'var(--c-text2)' }}>{a.name}</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{a.value}</span>
              </div>
            ))}
          </div>
          {rules.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--c-border)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Rules applied</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {rules.map((r, i) => (
                  <div key={r.id || i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)' }}>{r.rule}</span>
                      {r.status && <span className="sw-chip sw-chip-sm" style={{ fontSize: 8.5 }}>{r.status}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 2 }}>{r.plainEnglish}</div>
                    {r.source && <div style={{ fontSize: 9.5, color: 'var(--c-text3)', marginTop: 2, opacity: 0.85 }}>Source: {r.source}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The REAL drawdown plan (one-engine). For decumulators, solveDecumulation
// gives the tax-minimising per-pot, per-year sequence + the routes it ranked.
// The panel lets the user move THEIR assumptions (target income, plan horizon,
// growth) AND reorder their priorities, and watch the plan re-solve — their
// inputs, not our forecast.
// Compliance: routes are "ranked under your priorities", never "optimal/best".
// Five withdrawal-PACING methods (how fast to spend the pot), a different lens
// from the draw ORDER. Standalone so it renders both inside the drawdown drawer
// (withToggle) and as its own "How fast can I spend?" question-tile (always open).
// Plain-English layer over the academic method names. The founder's complaint:
// "5 methods" / "Bengen · Guyton-Klinger" means nothing to a real user. Lead
// with what each one DOES and the income SHAPE (the real differentiator — every
// method "lasts to 95+" here, so that line discriminates nothing); keep the
// academic name as small provenance for the curious.
const METHOD_PLAIN = {
  bengen:          { name: 'Steady & predictable',           shape: 'a fixed income that rises with inflation',
    how: 'You take 4% of your starting pot in year one, then give yourself an inflation pay-rise every year after — no matter what your investments do.' },
  guyton_klinger:  { name: 'Flexible guardrails',            shape: 'more on average, but it rises and falls with markets',
    how: 'You start a little higher, then follow two rules: after a bad year you skip your inflation rise, and after a good year you take an extra one — so your income gently tracks your luck.' },
  vanguard:        { name: 'A share of your pot',            shape: 'tracks the pot, smoothed by a floor and a ceiling',
    how: 'Each year you take a set percentage of whatever your pot is worth that year — but a cap and a floor stop your income from jumping or dropping too far.' },
  bucket:          { name: 'Cash-buffer first',              shape: 'steady — you spend cash in downturns so you never sell low',
    how: 'You split your money into three pots — cash, medium-risk and growth. You spend from cash, and only refill it from growth after good years, so you never sell investments in a crash.' },
  floor_guardrail: { name: 'Protect essentials, flex the rest', shape: 'essentials are never cut; the extra flexes up and down',
    how: 'First you lock in enough safe income to cover your essentials for life. Only the money above essentials flexes up and down — so a bad market can trim your luxuries but never your basics.' },
}
// Worked example in plain English, using THIS user's real numbers (from the
// engine's methodPath), so the abstract rule becomes concrete.
function methodNarrative(id, { age0, w1, w2, portfolio, essentialsAnnual }) {
  const m = v => _gk(v || 0)
  switch (id) {
    case 'bengen':
      return `Year 1 (age ${age0}): you draw ${m(w1)} — that's 4% of your ${m(portfolio)} pot. Year 2: you add an inflation pay-rise to ${m(w2)}, and you take it whether markets rose or fell. The upside is certainty — your income never surprises you. The risk: a bad early run shrinks the pot while your withdrawals keep climbing.`
    case 'guyton_klinger':
      return `Year 1 (age ${age0}): you draw ${m(w1)}. After a strong year you'd give yourself a raise; after a poor year you'd skip the inflation rise (and trim a little if it's really bad). Over time this usually pays more than a fixed rule — the trade-off is your income moving up and down with markets.`
    case 'vanguard':
      return `Year 1 (age ${age0}): you take ${m(w1)} — a set share of today's pot. If the pot grows, next year's income rises; if it falls, it dips to around ${m(w2)} — but a ceiling and floor stop either from lurching. You stay responsive to markets without the whiplash.`
    case 'bucket':
      return `Year 1 (age ${age0}): you spend ${m(w1)} from your cash bucket — roughly two years of spending kept in cash. In a downturn you keep spending cash and leave your investments alone to recover, refilling the bucket after good years. The catch: it only works if you actually top the bucket back up.`
    case 'floor_guardrail': {
      const disc = Math.max(0, (w1 || 0) - (essentialsAnnual || 0))
      return `Your essentials (about ${m(essentialsAnnual)}/yr) are secured first at a safe rate — they're never cut. On top, your discretionary income starts around ${m(disc)}/yr and flexes with markets. In a crash your basics are untouched and only the extra dips. This fixes the main flaw of the other four — none of them protect the income you actually need.`
    }
    default: return ''
  }
}
// Pot-balance-over-time chart for ONE method — labelled axes, area+line, a
// "runs out" marker. Reuses the DepletionCurve visual language; recomputes as the
// growth slider moves so the user can SEE the sensitivity, not read a static table.
function MethodChart({ path }) {
  const pts = (path || []).filter(Boolean)
  if (pts.length < 2) return null
  const maxV = Math.max(...pts.map(r => r.balance || 0), 1) * 1.05
  const W = 320, H = 150, pL = 44, pR = 10, pT = 12, pB = 26, pw = W - pL - pR, ph = H - pT - pB
  const n = pts.length
  const px = i => pL + (i / (n - 1)) * pw
  const py = v => pT + ph - (Math.max(0, v) / maxV) * ph
  const line = pts.map((r, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(r.balance || 0).toFixed(1)).join(' ')
  const area = `M${px(0).toFixed(1)},${py(0).toFixed(1)} ` + pts.map((r, i) => 'L' + px(i).toFixed(1) + ',' + py(r.balance || 0).toFixed(1)).join(' ') + ` L${px(n - 1).toFixed(1)},${py(0).toFixed(1)} Z`
  const depIdx = pts.findIndex(r => (r.balance || 0) <= 0)
  const yTicks = [0, maxV / 2, maxV]
  const xIdx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Your pot over time</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Pot balance across the drawdown years under this method, on your assumptions">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pL} y1={py(v)} x2={W - pR} y2={py(v)} stroke="var(--c-tint-neutral-2)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={pL - 4} y={py(v) + 3} fontSize="8" fill="var(--c-text3)" textAnchor="end">{_gk(v)}</text>
          </g>
        ))}
        <path d={area} fill="var(--c-acc)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--c-acc)" strokeWidth="1.75" />
        {depIdx >= 0 && (
          <g>
            <line x1={px(depIdx)} y1={pT} x2={px(depIdx)} y2={pT + ph} stroke="var(--c-coral-text)" strokeWidth="1" strokeDasharray="3 2" />
            <text x={px(depIdx)} y={pT - 3} fontSize="8" fill="var(--c-coral-text)" textAnchor="middle">runs out</text>
          </g>
        )}
        {xIdx.map((i, k) => (
          <text key={k} x={px(i)} y={H - 8} fontSize="8" fill="var(--c-text3)" textAnchor={k === 0 ? 'start' : k === xIdx.length - 1 ? 'end' : 'middle'}>age {pts[i].age}</text>
        ))}
        <text x={2} y={pT + 2} fontSize="8" fill="var(--c-text3)">£</text>
      </svg>
    </div>
  )
}
// Tiny pot-trajectory sparkline for the compact method rows (balance-sheet grammar).
function MiniSparkline({ path, color = 'var(--c-acc)' }) {
  const pts = (path || []).filter(Boolean)
  if (pts.length < 2) return null
  const W = 60, H = 22
  const maxV = Math.max(...pts.map(r => r.balance || 0), 1)
  const n = pts.length
  const px = i => (i / (n - 1)) * W
  const py = v => H - (Math.max(0, v) / maxV) * (H - 3) - 1.5
  const d = pts.map((r, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(r.balance || 0).toFixed(1)).join(' ')
  const dep = pts.some(r => (r.balance || 0) <= 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d={d} fill="none" stroke={dep ? 'var(--c-coral-text)' : color} strokeWidth="1.5" />
    </svg>
  )
}
// Back-solve: find the draw level (rateScale) so the pot lasts to ~targetAge.
// Higher scale → draws more → depletes earlier; bisection converges on the most
// you could draw and still reach the target. The "drag the outcome, solve the
// lever" interaction the founder wants everywhere.
function solveDrawScaleForAge(methodId, baseOpts, targetAge) {
  const age0 = baseOpts.age || 65
  const endAge = age0 + (baseOpts.years || 30) - 1
  const tgt = Math.min(targetAge, endAge + 1)
  let lo = 0.3, hi = 3
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2
    let path = []
    try { path = methodPath(methodId, { ...baseOpts, rateScale: mid }) } catch { /* */ }
    const dep = path.find(r => (r.balance || 0) <= 0)
    const depAge = dep ? dep.age : endAge + 1
    if (depAge >= tgt) lo = mid; else hi = mid
  }
  return Math.round(lo * 100) / 100
}
// Per-method drawer — INTERACTIVE, MULTI-VARIABLE + BACK-SOLVE. Flex the pot, the
// draw level and growth and watch the chart / income / longevity move; or drag
// the "last to age" target and the engine solves the draw for you. (founder
// 2026-06-04: "interactive = all equations, not one"; "back solver everywhere".)
function MethodDetail({ method, opts, horizon, recommended, onBack }) {
  const p = METHOD_PLAIN[method.id] || { name: method.label }
  const age0 = opts.age || 65
  const endAge = age0 + (opts.years || 30) - 1
  const seedG = Math.round((opts.growth ?? 0.05) * 1000) / 10
  const seedPotK = Math.max(10, Math.round((opts.portfolio || 0) / 1000))
  const [gPct, setGPct] = useState(seedG)
  const [potK, setPotK] = useState(seedPotK)
  const [drawScale, setDrawScale] = useState(1)
  const dirty = Math.abs(gPct - seedG) > 0.001 || potK !== seedPotK || Math.abs(drawScale - 1) > 0.001
  const reset = () => { setGPct(seedG); setPotK(seedPotK); setDrawScale(1) }
  const liveOpts = useMemo(() => ({ ...opts, portfolio: potK * 1000, growth: gPct / 100, rateScale: drawScale }), [opts, potK, gPct, drawScale])
  const path = useMemo(() => { try { return methodPath(method.id, liveOpts) } catch { return [] } }, [method.id, liveOpts])
  const depletes = path.find(r => (r.balance || 0) <= 0)
  const lastsHorizon = !depletes
  const lastsAge = depletes ? depletes.age : endAge
  const w1 = path[0]?.withdrawal ?? 0
  const w2 = path[1]?.withdrawal ?? w1
  const idxs = [...new Set([0, 4, 9, 19, path.length - 1].filter(i => i >= 0 && i < path.length))]
  const rows = idxs.map(i => path[i]).filter(Boolean)
  const onTargetAge = (tAge) => setDrawScale(solveDrawScaleForAge(method.id, { ...opts, portfolio: potK * 1000, growth: gPct / 100 }, tAge))
  return (
    <DrillStackProvider>
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--c-bg)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 16px 96px' }}>
          <button onClick={onBack} className="sw-pressable" style={{ background: 'none', border: 'none', color: 'var(--c-acc)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>← Methods</button>
          <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--c-text)', margin: '8px 0 2px' }}>
            {p.name}{recommended && <span className="sw-chip sw-chip-sm sw-chip-blue" style={{ marginLeft: 8, verticalAlign: 'middle' }}>fits your #1 priority</span>}
          </h2>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 14 }}>{method.label} · {method.source}</div>

          <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 5 }}>How it works</div>
            <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55 }}>{p.how || method.summary}</div>
          </div>

          <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)' }}>Explore it — drag any lever</div>
              {dirty && <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--c-acc)', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: 11 }}>reset</button>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 2 }}>
              Year-1 income <strong style={{ color: 'var(--c-text)' }}>{_gk(w1)}</strong> · {lastsHorizon ? <>lasts to age <strong style={{ color: 'var(--c-mint-text)' }}>{endAge}+</strong></> : <>runs out at age <strong style={{ color: 'var(--c-coral-text)' }}>{lastsAge}</strong></>}
            </div>
            <MethodChart path={path} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
              <SolverSlider label="Starting pot" value={potK} min={Math.max(10, Math.round(seedPotK * 0.3))} max={Math.round(seedPotK * 2)} step={10} fmt={() => _gk(potK * 1000)} onChange={setPotK} dirty={potK !== seedPotK} />
              <SolverSlider label="Draw level" value={drawScale} min={0.4} max={2} step={0.05} fmt={() => `${_gk(w1)}/yr`} onChange={setDrawScale} dirty={Math.abs(drawScale - 1) > 0.001} />
              <SolverSlider label="Growth (nominal)" value={gPct} min={1} max={9} step={0.5} fmt={v => `${v}%`} onChange={setGPct} dirty={Math.abs(gPct - seedG) > 0.001} />
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
              <SolverSlider label="↩ Back-solve — make it last to" value={Math.min(Math.max(lastsAge, age0 + 5), 105)} min={age0 + 5} max={105} step={1} fmt={v => `age ${v}`} onChange={onTargetAge} dirty={false} />
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>Drag the age you want it to last to — the engine solves the most you could draw, and the chart + numbers follow.</div>
            </div>
          </div>

          <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 5 }}>How it plays out for you</div>
            <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6 }}>{methodNarrative(method.id, { age0, w1, w2, portfolio: liveOpts.portfolio, essentialsAnnual: opts.essentialsAnnual })}</div>
            {rows.length > 1 && (
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ color: 'var(--c-text3)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px 4px 0', fontWeight: 600 }}>Age</th>
                      <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>You draw</th>
                      <th style={{ padding: '4px 0 4px 8px', fontWeight: 600, textAlign: 'right' }}>Pot left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--c-sep, var(--c-border))' }}>
                        <td style={{ padding: '5px 8px 5px 0', color: 'var(--c-text)' }}>{r.age}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--c-text)' }}>{_gk(r.withdrawal)}</td>
                        <td style={{ padding: '5px 0 5px 8px', textAlign: 'right', color: r.balance <= 0 ? 'var(--c-coral-text)' : 'var(--c-text3)' }}>{r.balance <= 0 ? 'gone' : _gk(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.5 }}>
                  Constant-return illustration on your assumptions (not a forecast); real markets vary year to year — see "What if markets fall?" for the stochastic view.
                </div>
              </div>
            )}
          </div>

          <div className="sw-card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--c-mint-text)' }}>Strength:</strong> {method.strength}.<br />
              <strong style={{ color: 'var(--c-amber-text)' }}>Watch:</strong> {method.weakness}.<br />
              <strong style={{ color: 'var(--c-text)' }}>Lasts:</strong> {lastsHorizon ? `to age ${endAge}+ on these levers` : `funds run low by age ${lastsAge}`}.
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 12, lineHeight: 1.5 }}>
            A general approach advisers reference, shown as an illustration on your assumptions — not a personal recommendation.
          </div>
        </div>
      </div>
    </DrillStackProvider>
  )
}
// ── Accumulation projection — the accumulator face of "Will my money last?" ──
// Compound a pot forward with annual saving. Pure & deterministic; mirrors
// methodPath's grammar so the chart/back-solve language is shared.
function accumProjection({ pot, annualSaving, growth, age0, years }) {
  const out = []
  let bal = +pot || 0
  const g = growth != null ? +growth : 0.05
  const sv = +annualSaving || 0
  const n = Math.max(1, years)
  for (let y = 0; y <= n; y++) { out.push({ age: age0 + y, balance: Math.round(bal) }); bal = bal * (1 + g) + sv }
  return out
}
// Back-solve: the annual saving needed to reach fiTarget by targetAge (bisection).
function solveSavingForFI({ pot, growth, age0, targetAge, fiTarget }) {
  const years = Math.max(1, targetAge - age0)
  let lo = 0, hi = Math.max(fiTarget, 1e5)
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2
    const end = accumProjection({ pot, annualSaving: mid, growth, age0, years }).slice(-1)[0].balance
    if (end >= fiTarget) hi = mid; else lo = mid
  }
  return Math.round(hi)
}
// Rising pot vs the FI target line — labelled axes + "FI reached" marker.
function AccumChart({ path, target }) {
  const pts = (path || []).filter(Boolean)
  if (pts.length < 2) return null
  const maxV = Math.max(...pts.map(r => r.balance || 0), target || 0, 1) * 1.05
  const W = 320, H = 150, pL = 44, pR = 10, pT = 12, pB = 26, pw = W - pL - pR, ph = H - pT - pB
  const n = pts.length
  const px = i => pL + (i / (n - 1)) * pw
  const py = v => pT + ph - (Math.max(0, v) / maxV) * ph
  const line = pts.map((r, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(r.balance || 0).toFixed(1)).join(' ')
  const area = `M${px(0).toFixed(1)},${py(0).toFixed(1)} ` + pts.map((r, i) => 'L' + px(i).toFixed(1) + ',' + py(r.balance || 0).toFixed(1)).join(' ') + ` L${px(n - 1).toFixed(1)},${py(0).toFixed(1)} Z`
  const reachIdx = pts.findIndex(r => (r.balance || 0) >= (target || Infinity))
  const yTicks = [0, maxV / 2, maxV]
  const xIdx = [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Your savings over time</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Projected savings climbing toward your financial-independence target, on your assumptions">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pL} y1={py(v)} x2={W - pR} y2={py(v)} stroke="var(--c-tint-neutral-2)" strokeWidth="0.5" strokeDasharray="2 3" />
            <text x={pL - 4} y={py(v) + 3} fontSize="8" fill="var(--c-text3)" textAnchor="end">{_gk(v)}</text>
          </g>
        ))}
        {target > 0 && target < maxV && (
          <g>
            <line x1={pL} y1={py(target)} x2={W - pR} y2={py(target)} stroke="var(--c-mint-text)" strokeWidth="1" strokeDasharray="4 2" />
            <text x={W - pR} y={py(target) - 3} fontSize="8" fill="var(--c-mint-text)" textAnchor="end">FI target {_gk(target)}</text>
          </g>
        )}
        <path d={area} fill="var(--c-acc)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--c-acc)" strokeWidth="1.75" />
        {reachIdx > 0 && (
          <g>
            <line x1={px(reachIdx)} y1={pT} x2={px(reachIdx)} y2={pT + ph} stroke="var(--c-mint-text)" strokeWidth="1" strokeDasharray="3 2" />
            <text x={px(reachIdx)} y={pT - 3} fontSize="8" fill="var(--c-mint-text)" textAnchor="middle">FI at {pts[reachIdx].age}</text>
          </g>
        )}
        {xIdx.map((i, k) => (
          <text key={k} x={px(i)} y={H - 8} fontSize="8" fill="var(--c-text3)" textAnchor={k === 0 ? 'start' : k === xIdx.length - 1 ? 'end' : 'middle'}>age {pts[i].age}</text>
        ))}
        <text x={2} y={pT + 2} fontSize="8" fill="var(--c-text3)">£</text>
      </svg>
    </div>
  )
}

// "Will my money last?" — rebuilt to the interactive bar (founder 2026-06-04:
// every tile must inform graphically, support multi-variable what-if + back-solve,
// and reconcile). Decumulator: a real depletion chart on the recommended method
// with pot / draw / growth levers + a "make it last to age X" back-solve; the
// secure-income floor is named as the second lens (never welded with "but"); the
// funded gauge stays as a pots-only secondary read with the gap explained.
// Accumulator: a savings projection toward the FI target with pot / saving / growth
// levers + a "reach FI by age X" back-solve — closing P4-03 (the accumulator had
// zero interactive surfaces) and P4-14 (funded gauge had no back-solve).
function LastabilityDrawer({ entity, decSolve, fr, fi }) {
  if (decSolve?.rankedPaths?.length) return <LastDecum entity={entity} decSolve={decSolve} fr={fr} />
  return <LastAccum entity={entity} fi={fi} />
}

function LastDecum({ decSolve, fr }) {
  const inp = decSolve.inputs || {}
  const age0 = inp.currentAge || 65
  const horizonAge = inp.horizonAge || 95
  // Simulate PAST the plan horizon so "will it last?" can actually be explored —
  // the back-solve target and the depletion curve must reach beyond the plan, not
  // clamp at it. (Plan horizon 95 made "make it last to 100" a no-op.)
  const simEndAge = Math.max(horizonAge + 5, 105)
  const years = Math.max(1, simEndAge - age0)
  const portfolio0 = (decSolve.network?.nodes || []).filter(n => n.kind === 'pot').reduce((s, n) => s + (n.value || 0), 0)
  const seedG = Math.round((inp.growth ?? 0.05) * 1000) / 10
  const seedPotK = Math.max(10, Math.round(portfolio0 / 1000))
  const essentials = Math.round((inp.incomeTargetAnnual || 0) * 0.6)
  const primaryGoal = decSolve.binding?.primaryGoal || 'min_lifetime_tax'
  const methodId = recommendMethodForGoal(primaryGoal)
  const plain = METHOD_PLAIN[methodId] || { name: (METHODS[methodId] || {}).label || 'your plan' }
  const secureGross = decSolve.floor?.grossAnnual || 0
  const infl = inp.inflation ?? 0.025

  const [gPct, setGPct] = useState(seedG)
  const [potK, setPotK] = useState(seedPotK)
  const [drawScale, setDrawScale] = useState(1)
  const dirty = Math.abs(gPct - seedG) > 0.001 || potK !== seedPotK || Math.abs(drawScale - 1) > 0.001
  const reset = () => { setGPct(seedG); setPotK(seedPotK); setDrawScale(1) }
  const liveOpts = useMemo(() => ({ portfolio: potK * 1000, years, growth: gPct / 100, inflation: infl, essentialsAnnual: essentials, age: age0, rateScale: drawScale }), [potK, gPct, drawScale, years, infl, essentials, age0])
  const path = useMemo(() => { try { return methodPath(methodId, liveOpts) } catch { return [] } }, [methodId, liveOpts])
  const depletes = path.find(r => (r.balance || 0) <= 0)
  const lastsHorizon = !depletes                    // survives the whole simulation
  const lastsAge = depletes ? depletes.age : simEndAge
  const w1 = path[0]?.withdrawal ?? 0
  const onTargetAge = (tAge) => setDrawScale(solveDrawScaleForAge(methodId, { portfolio: potK * 1000, years, growth: gPct / 100, inflation: infl, essentialsAnnual: essentials, age: age0 }, tAge))
  const frRatio = +(fr?.ratio || fr?.value || 0)

  return (<>
    <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 4 }}>The answer, on your plan</div>
      <div style={{ fontSize: 15, color: 'var(--c-text)', lineHeight: 1.5 }}>
        Your <strong>{_gk(potK * 1000)}</strong> of pots, drawn using <strong>{plain.name}</strong>, {lastsHorizon
          ? <>last beyond <strong style={{ color: 'var(--c-mint-text)' }}>age {horizonAge}</strong> — your full plan and more — on these assumptions.</>
          : <>run low at <strong style={{ color: 'var(--c-coral-text)' }}>age {lastsAge}</strong> on these assumptions.</>}
      </div>
      {secureGross > 0 && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.5 }}>
          On top of the pots, your <strong style={{ color: 'var(--c-mint-text)' }}>secure income {_gk(secureGross)}/yr</strong> (state pension, DB &amp; guaranteed income) is paid <strong>for life</strong> — it never runs out. The pots only have to cover the gap above it.
        </div>
      )}
    </div>

    <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)' }}>Explore it — drag any lever</div>
        {dirty && <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--c-acc)', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: 11 }}>reset</button>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 2 }}>
        Year-1 income <strong style={{ color: 'var(--c-text)' }}>{_gk(w1)}</strong> · {lastsHorizon ? <>lasts past age <strong style={{ color: 'var(--c-mint-text)' }}>{horizonAge}</strong></> : <>runs out at age <strong style={{ color: 'var(--c-coral-text)' }}>{lastsAge}</strong></>}
      </div>
      <MethodChart path={path} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        <SolverSlider label="Pot at retirement" value={potK} min={Math.max(10, Math.round(seedPotK * 0.3))} max={Math.round(seedPotK * 2)} step={10} fmt={() => _gk(potK * 1000)} onChange={setPotK} dirty={potK !== seedPotK} />
        <SolverSlider label="Draw level" value={drawScale} min={0.4} max={2} step={0.05} fmt={() => `${_gk(w1)}/yr`} onChange={setDrawScale} dirty={Math.abs(drawScale - 1) > 0.001} />
        <SolverSlider label="Growth (nominal)" value={gPct} min={1} max={9} step={0.5} fmt={v => `${v}%`} onChange={setGPct} dirty={Math.abs(gPct - seedG) > 0.001} />
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
        <SolverSlider label="↩ Back-solve — make it last to" value={Math.min(Math.max(lastsAge, age0 + 5), 105)} min={age0 + 5} max={105} step={1} fmt={v => `age ${v}`} onChange={onTargetAge} dirty={false} />
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>Drag the age you want it to last to — the engine solves the most you could draw, and the chart + numbers follow.</div>
      </div>
    </div>

    {frRatio > 0 && (
      <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 6 }}>Second lens — pots only</div>
        <FundedRatioGaugeV2 ratio={frRatio} confidence={fr?.confidence_low != null ? { low: +fr.confidence_low, high: +fr.confidence_high } : null} fundedYears={fr?.fundedYears || fr?.years || null} />
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6, lineHeight: 1.5 }}>
          This gauge weighs your <strong>investable pots alone</strong> against a safe-withdrawal target — it deliberately ignores secure income. That's why it can read "{Math.round(frRatio * 100)}% funded" while the plan above lasts to {lastsHorizon ? `age ${horizonAge}+` : `age ${lastsAge}`}: {secureGross > 0 ? `the difference is the ${_gk(secureGross)}/yr of secure income carrying the rest.` : 'the two simply measure different things.'}
        </div>
      </div>
    )}

    <div className="sw-card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 5 }}>How this pace plays out</div>
      <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.6 }}>{methodNarrative(methodId, { age0, w1, w2: path[1]?.withdrawal ?? w1, portfolio: liveOpts.portfolio, essentialsAnnual: essentials })}</div>
    </div>
    <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 12, lineHeight: 1.5 }}>
      A constant-return illustration on your assumptions — not a forecast. Real markets vary year to year; see "What if markets fall?" for the stochastic view.
    </div>
  </>)
}

function LastAccum({ entity, fi }) {
  const age0 = (() => { try { return calcAge(entity?.individual?.dob) || 45 } catch { return 45 } })()
  const fiTarget = Math.round(fi?.fiTarget || 0)
  const invested0 = Math.round((fi?.fiTarget || 0) * (fi?.ratio || 0))
  const seedSaveAnnual = (() => { try { const m = monthlySurplus(entity, getActiveCMA()); const net = (+(m?.surplus) || 0) - (+(m?.deficit) || 0); return Math.max(0, Math.round(net * 12)) } catch { return 0 } })()
  const seedPotK = Math.max(1, Math.round(invested0 / 1000))
  const seedSaveK = Math.max(0, Math.round(seedSaveAnnual / 1000))
  const seedG = 5
  const horizonAge = Math.min(100, age0 + 45)
  const years = Math.max(1, horizonAge - age0)

  const [potK, setPotK] = useState(seedPotK)
  const [saveK, setSaveK] = useState(seedSaveK)
  const [gPct, setGPct] = useState(seedG)
  const dirty = potK !== seedPotK || saveK !== seedSaveK || Math.abs(gPct - seedG) > 0.001
  const reset = () => { setPotK(seedPotK); setSaveK(seedSaveK); setGPct(seedG) }
  const path = useMemo(() => accumProjection({ pot: potK * 1000, annualSaving: saveK * 1000, growth: gPct / 100, age0, years }), [potK, saveK, gPct, age0, years])
  const reachIdx = path.findIndex(r => (r.balance || 0) >= fiTarget)
  const fiAge = reachIdx >= 0 ? path[reachIdx].age : null
  const onTargetAge = (tAge) => { const sv = solveSavingForFI({ pot: potK * 1000, growth: gPct / 100, age0, targetAge: tAge, fiTarget }); setSaveK(Math.round(sv / 1000)) }

  if (!fiTarget) return <div style={{ fontSize: 13, color: 'var(--c-text3)', lineHeight: 1.6 }}>Add your investable savings and a target retirement income to project your path to financial independence.</div>

  return (<>
    <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)', marginBottom: 4 }}>The answer, on your plan</div>
      <div style={{ fontSize: 15, color: 'var(--c-text)', lineHeight: 1.5 }}>
        Saving <strong>{_gk(saveK * 1000)}/yr</strong> at <strong>{gPct}%</strong>, your <strong>{_gk(potK * 1000)}</strong> reaches your <strong>{_gk(fiTarget)}</strong> independence target {fiAge
          ? <>at <strong style={{ color: 'var(--c-mint-text)' }}>age {fiAge}</strong>.</>
          : <><strong style={{ color: 'var(--c-coral-text)' }}>not within this horizon</strong> — raise saving or growth below.</>}
      </div>
    </div>

    <div className="sw-card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text3)' }}>Explore it — drag any lever</div>
        {dirty && <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--c-acc)', cursor: 'pointer', fontWeight: 700, padding: 0, fontSize: 11 }}>reset</button>}
      </div>
      <AccumChart path={path} target={fiTarget} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        <SolverSlider label="Savings now" value={potK} min={0} max={Math.max(50, Math.round(seedPotK * 2 + 50))} step={5} fmt={() => _gk(potK * 1000)} onChange={setPotK} dirty={potK !== seedPotK} />
        <SolverSlider label="Saving / yr" value={saveK} min={0} max={Math.max(20, Math.round(seedSaveK * 2 + 20))} step={1} fmt={() => `${_gk(saveK * 1000)}/yr`} onChange={setSaveK} dirty={saveK !== seedSaveK} />
        <SolverSlider label="Growth (nominal)" value={gPct} min={1} max={9} step={0.5} fmt={v => `${v}%`} onChange={setGPct} dirty={Math.abs(gPct - seedG) > 0.001} />
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
        <SolverSlider label="↩ Back-solve — reach FI by" value={Math.min(Math.max(fiAge || (age0 + 20), age0 + 1), horizonAge)} min={age0 + 1} max={horizonAge} step={1} fmt={v => `age ${v}`} onChange={onTargetAge} dirty={false} />
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>Drag the age you want to be independent by — the engine solves how much you'd need to save each year, and the chart follows.</div>
      </div>
    </div>

    <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.5 }}>
      The 25× target is a long-standing planning rule of thumb (a ~4% withdrawal), not a guarantee. A constant-return illustration on your assumptions — not a forecast.
    </div>
  </>)
}
function MethodsComparison({ portfolio, years, growth, inflation, essentialsAnnual, age, horizon, primaryGoal, withToggle = false }) {
  const [open, setOpen] = useState(!withToggle)
  const [openMethod, setOpenMethod] = useState(null)
  const opts = { portfolio, years: Math.max(1, years), growth, inflation, essentialsAnnual, age }
  let methods = []
  try { methods = compareMethods(opts) } catch { methods = [] }
  const recId = recommendMethodForGoal(primaryGoal)
  const usable = portfolio > 0 && methods.length && methods.some(m => m.year1Withdrawal)
  const body = !usable
    ? <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>Pacing needs a drawable pot (pension / ISA / GIA / cash). Your income here comes from secure sources, or it hasn&rsquo;t been captured yet.</div>
    : (() => {
      const ws = methods.map(m => m.year1Withdrawal || 0).filter(Boolean)
      const lo = Math.min(...ws), hi = Math.max(...ws)
      const allLast = methods.every(m => m.lastsHorizon)
      return (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--c-text)' }}>Five ways to pace what you spend</strong> from your {_gk(portfolio)} of pots.{' '}
            {allLast ? `On your assumptions all five last to age ${horizon}+` : 'How long each lasts differs'} — the choice is{' '}
            <strong style={{ color: 'var(--c-text)' }}>how much you take early</strong> ({_gk(lo)}–{_gk(hi)}/yr) and{' '}
            <strong style={{ color: 'var(--c-text)' }}>how steady it stays</strong>. Tap one to open it — see how it works and drag the levers. An illustration, not advice.
          </div>
          {/* Compact DRAWER ROWS (founder: "make it a drawer, not 5 cards on one
              page") — name + income shape + a pot-trajectory sparkline + year-1
              income + lasts-age. The detail lives in the opened drawer. */}
          {methods.map(m => {
            const rec = m.id === recId
            const p = METHOD_PLAIN[m.id] || { name: m.label, shape: '' }
            const spark = (() => { try { return methodPath(m.id, opts) } catch { return [] } })()
            return (
              <button key={m.id} onClick={() => setOpenMethod(m)} className="sw-lift sw-pressable" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', width: '100%', padding: '10px 12px', borderRadius: 12, background: 'var(--c-surface)', border: rec ? '1.5px solid var(--c-acc)' : '1px solid var(--c-border)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{p.name}{rec && <span className="sw-chip sw-chip-sm sw-chip-blue" style={{ marginLeft: 6 }}>#1</span>}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.shape}</div>
                </div>
                <MiniSparkline path={spark} color={rec ? 'var(--c-acc)' : 'var(--c-text3)'} />
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: rec ? 'var(--c-acc)' : 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{_gk(m.year1Withdrawal)}</div>
                  <div style={{ fontSize: 9, color: 'var(--c-text3)' }}>yr-1 · to {m.lastsHorizon ? `${horizon}+` : m.depletesAtAge}</div>
                </div>
                <span style={{ color: 'var(--c-text3)', fontSize: 18, flexShrink: 0, lineHeight: 1 }}>›</span>
              </button>
            )
          })}
        </div>
      )
    })()
  const shell = !withToggle ? body : (
    <div style={{ marginTop: 14 }}>
      <button onClick={() => setOpen(s => !s)} className="sw-pressable"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', borderRadius: 12, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', cursor: 'pointer' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>Compare withdrawal methods</span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{open ? 'Hide ▲' : 'How fast to spend? ▼'}</span>
      </button>
      {open && body}
    </div>
  )
  return (
    <>
      {shell}
      {openMethod && <MethodDetail method={openMethod} opts={opts} horizon={horizon} recommended={openMethod.id === recId} onBack={() => setOpenMethod(null)} />}
    </>
  )
}
function ScenarioForwardSummary({ entity, decSolve }) {
  // Seed the controls from the engine's RESOLVED inputs (honest defaults, never
  // hardcoded). Sparse personas have no inputs → panel won't render (no routes).
  const seed = decSolve?.inputs || {}
  const seedTarget = seed.incomeTargetAnnual || 0
  const seedHorizon = seed.horizonAge || 95
  const seedGrowthPct = Math.round((seed.growth || 0.05) * 1000) / 10
  const currentAge = seed.currentAge || 60
  const [target, setTarget] = useState(seedTarget)
  const [horizon, setHorizon] = useState(seedHorizon)
  const [growthPct, setGrowthPct] = useState(seedGrowthPct)
  const [routeIdx, setRouteIdx] = useState(0)
  const [showMethods, setShowMethods] = useState(false)
  const { commit } = useEvents()
  const [savedAt, setSavedAt] = useState(null)

  // Priority order — seeded from the entity's default goalSpec, reorderable.
  const baseOrder = useMemo(() => {
    const pr = {}
    try { (buildGoalSpec(entity).goals || []).forEach(g => { if (g.priority != null) pr[g.type] = g.priority }) } catch { /* default below */ }
    return RANKABLE_GOALS.map(r => r.type).sort((a, b) => (pr[a] ?? 50) - (pr[b] ?? 50))
  }, [entity])
  const [order, setOrder] = useState(baseOrder)
  useEffect(() => { setOrder(baseOrder) }, [baseOrder])
  const goalsDirty = order.join('|') !== baseOrder.join('|')
  const moveGoal = (i, dir) => setOrder(o => {
    const j = i + dir; if (j < 0 || j >= o.length) return o
    const n = [...o];[n[i], n[j]] = [n[j], n[i]]; return n
  })

  const dT = target !== seedTarget
  const dH = horizon !== seedHorizon
  const dG = Math.abs(growthPct - seedGrowthPct) > 0.001
  const dirty = dT || dH || dG
  const anyDirty = dirty || goalsDirty

  // Re-solve LIVE on the user's assumptions + priority order (deterministic,
  // sub-ms). When nothing is touched, reuse the parent's default solve.
  const solve = useMemo(() => {
    // BRANCH GUARD (A4): decSolve is null when the entity is NOT a decumulator
    // (accumulator/preserver-as-accumulator or sparse). Never force a drawdown
    // solve in that case — even if the sliders are left dirty from a prior
    // decumulator state — so the override flips to the FI face honestly.
    if (!decSolve) return null
    if (!anyDirty) return decSolve
    try {
      const spec = goalsDirty
        ? buildGoalSpec(entity, { goals: order.map((t, i) => ({ type: t, priority: i + 1 })) })
        : buildGoalSpec(entity)
      return solveDecumulation({
        entity, goalSpec: spec,
        opts: { incomeTarget: target, horizonAge: horizon, growth: growthPct / 100 },
      })
    } catch { return decSolve }
  }, [entity, decSolve, anyDirty, goalsDirty, order, target, horizon, growthPct])

  const routes = solve?.rankedPaths || []

  if (routes.length) {
    const route = routes[Math.min(routeIdx, routes.length - 1)]
    const sched = route.schedule || []
    // Show the TRANSITION years (where the drawn-from pot changes), not just the
    // first 5 + last — otherwise the table reads "pension only" and hides every
    // year GIA/ISA/Cash are used (founder confusion: "why are they always £0?").
    const _dominant = r => {
      const d = r.draws || {}
      const e = [['pension', d.pension || 0], ['isa', d.isa || 0], ['gia', d.gia || 0], ['cash', d.cash || 0]].sort((a, b) => b[1] - a[1])
      return e[0][1] > 0 ? e[0][0] : 'none'
    }
    let rows = sched
    if (sched.length > 7) {
      const picked = []
      let prevDom = null
      sched.forEach((r, i) => {
        const dom = _dominant(r)
        if (i === 0 || i === sched.length - 1 || dom !== prevDom) picked.push(r)
        prevDom = dom
      })
      rows = picked.length > 9 ? [...picked.slice(0, 8), sched[sched.length - 1]] : picked
    }
    // Secure income (state pension / DB) = total income not drawn from the 4 pots.
    const _secure = r => Math.max(0, Math.round((r.net || 0) + (r.tax || 0) - ((r.draws?.pension || 0) + (r.draws?.isa || 0) + (r.draws?.gia || 0) + (r.draws?.cash || 0))))
    const y1 = sched[0]
    const cell = { padding: '4px 6px' }
    const resetAll = () => { setTarget(seedTarget); setHorizon(seedHorizon); setGrowthPct(seedGrowthPct); setOrder(baseOrder) }
    const targetMax = Math.max(120000, Math.round((seedTarget || 40000) * 1.6 / 1000) * 1000)
    // Portfolio + essentials for the method comparison (from the solved pots).
    const portfolio = (solve.network?.nodes || []).filter(n => n.kind === 'pot').reduce((s, n) => s + (n.value || 0), 0)
    const essentialsAnnual = Math.round((target || 0) * 0.6)
    const primaryGoal = solve.binding?.primaryGoal || order[0]
    // Save THIS route as the user's drawdown plan. A drawdown is a RECURRING
    // flow, so we persist the structured plan (route + assumptions + recurring
    // annual pot draws) rather than a one-off balance step — Timeline folds
    // SCENARIO_SAVED; the projection-aware pension-trajectory bend is Phase-4.
    const saveAsPlan = () => {
      const pid = entity?.id || entity?.personaId
      if (!pid) return
      commit(pid, {
        type: EV.SCENARIO_SAVED,
        ts: Date.now(),
        payload: {
          kind: 'decumulation', domain: 'cashflow',
          routeId: route.id, routeName: route.name,
          targetIncome: target, horizonAge: horizon, growthPct,
          priorities: order,
          year1: y1 ? { net: y1.net, draws: y1.draws, tax: y1.tax } : null,
          recurringAnnual: y1 ? { pensions: -y1.draws.pension, investments: -(y1.draws.isa + y1.draws.gia), cash: -y1.draws.cash } : null,
          afterIhtEstate: route.afterIhtEstate, totalTaxCost: route.totalTaxCost,
        },
      })
      setSavedAt(route.id)
    }
    const isSaved = savedAt === route.id
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardHeader}>
          <div style={S.cardTitle}>Your drawdown plan</div>
          <span className="sw-chip sw-chip-sm sw-chip-blue">ranked under your priorities</span>
        </div>

        {/* BACK-SOLVE HERO — the founder's "grab the £96k Net and drag it". The
            year-1 Net the user wanted to edit IS this target: the solver draws
            gross to NET this figure, so dragging it back-solves the whole plan —
            routes re-rank, tax re-computes, and the money-map below re-routes.
            One control for one value (no duplicate "target income" slider). */}
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--c-acc) 7%, var(--c-surface2))', border: '1px solid var(--c-acc)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text2)' }}>The income you want to live on</span>
            {dT && <button onClick={() => setTarget(seedTarget)} className="sw-pressable" style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-acc)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 4, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{fmt(target)}</span>
              <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>/yr · {_gmo(target)}/mo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>lasts to</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>age {route.depletedAtAge || `${horizon}+`}</span>
            </div>
          </div>
          <input type="range" min={0} max={targetMax} step={1000} value={target}
            onChange={e => setTarget(+e.target.value)} aria-label="The income you want to live on — drag to back-solve your drawdown plan"
            style={{ width: '100%', marginTop: 10, accentColor: 'var(--c-acc)', cursor: 'pointer' }} />
          {y1 && (
            <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 8, lineHeight: 1.5 }}>
              → Year 1 nets <b>{fmt(y1.net)}</b> after <b style={{ color: 'var(--c-coral-text)' }}>{fmt(y1.tax)} tax</b>. Drag the number — the routes, tax, runway and the money-map below all re-solve from it. Your assumption, not a forecast.
            </div>
          )}
        </div>

        {/* Live controls — move YOUR assumptions + priorities, watch it re-solve. */}
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Adjust your assumptions</span>
            {anyDirty && <button onClick={resetAll} className="sw-pressable" style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-acc)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <SolverSlider label="Plan to age" value={horizon} min={currentAge + 1} max={105} step={1} fmt={v => `age ${v}`} onChange={setHorizon} dirty={dH} />
            <SolverSlider label="Growth (nominal)" value={growthPct} min={1} max={8} step={0.5} fmt={v => `${v}%`} onChange={setGrowthPct} dirty={dG} />
          </div>

          {/* Priority order — #1 decides which route ranks first. The lever that
              turns the engine's default ranking into the user's stated choice. */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--c-border)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Your priorities — #1 ranks first (reorder with ▲▼)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {order.map((t, i) => {
                const g = RANKABLE_GOALS.find(r => r.type === t)
                const top = i === 0
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
                    background: top ? 'color-mix(in srgb, var(--c-acc) 12%, var(--c-surface))' : 'var(--c-surface)',
                    border: top ? '1px solid var(--c-acc)' : '1px solid var(--c-border)' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: top ? 'var(--c-acc)' : 'var(--c-text3)', minWidth: 16 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--c-text2)', fontWeight: top ? 700 : 500 }}>{g?.label || t}</span>
                    <button onClick={() => moveGoal(i, -1)} disabled={i === 0} aria-label={`Move ${g?.label} up`} className="sw-pressable"
                      style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--c-text3)' : 'var(--c-text)', opacity: i === 0 ? 0.3 : 1, fontSize: 13, lineHeight: 1, padding: 2 }}>▲</button>
                    <button onClick={() => moveGoal(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${g?.label} down`} className="sw-pressable"
                      style={{ background: 'none', border: 'none', cursor: i === order.length - 1 ? 'default' : 'pointer', color: i === order.length - 1 ? 'var(--c-text3)' : 'var(--c-text)', opacity: i === order.length - 1 ? 0.3 : 1, fontSize: 13, lineHeight: 1, padding: 2 }}>▼</button>
                  </div>
                )
              })}
            </div>
          </div>

          {anyDirty && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)' }}>Re-solved on your assumptions &amp; priorities — an illustration, not a forecast.</div>}
        </div>

        {/* Routes considered — compact selectable chips; full detail only for the
            selected route (founder: the strip was too bulky, keep interactivity). */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', margin: '12px 0 6px' }}>
          Routes considered ({routes.length})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {routes.map((r, i) => {
            const on = i === routeIdx
            return (
              <button key={r.rank ?? i} onClick={() => setRouteIdx(i)} className="sw-pressable" aria-pressed={on}
                style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 11,
                  fontWeight: on ? 800 : 600, whiteSpace: 'nowrap',
                  color: on ? 'var(--c-acc)' : 'var(--c-text2)',
                  background: on ? 'color-mix(in srgb, var(--c-acc) 14%, var(--c-surface2))' : 'var(--c-surface2)',
                  border: on ? '1px solid var(--c-acc)' : '1px solid var(--c-border)' }}>
                #{r.rank ?? i + 1} {r.name} · to {r.depletedAtAge || '95+'}
              </button>
            )
          })}
        </div>
        {/* Detail for the selected route only. */}
        {route && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--c-text3)' }}>
            <b style={{ color: 'var(--c-text2)' }}>#{route.rank ?? routeIdx + 1} {route.name}</b> — tax {_gk(route.totalTaxCost)} · est. left {_gk(route.afterIhtEstate)} · funds to age {route.depletedAtAge || '95+'}
          </div>
        )}

        {/* Money-map — pots → income in the solved draw order. Re-routes when the
            back-solve target above flips the #1 ranked path. */}
        <DrawNetworkDiagram route={route} network={solve.network} netTotal={y1?.net} currentAge={currentAge} />

        {/* Year 1 as a monthly instruction — answers "how much from each pot". */}
        {y1 && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--c-surface2)', border: '1px solid var(--c-border)', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.6 }}>
            To take <b>{fmt(y1.net)}/yr</b> ({_gmo(y1.net)}/mo) in year 1: pension <b>{_gmo(y1.draws.pension)}/mo</b>{y1.pclsTaxFree ? ` (${_gmo(y1.pclsTaxFree)} tax-free)` : ''}, ISA {_gmo(y1.draws.isa)}/mo, GIA {_gmo(y1.draws.gia)}/mo, cash {_gmo(y1.draws.cash)}/mo · tax {_gmo(y1.tax)}/mo.
          </div>
        )}

        {/* Depletion curve — see the shape before reading the rows. */}
        <DepletionCurve schedule={sched} depletedAtAge={route.depletedAtAge} />

        {/* Year-by-year sequence (per-pot draws). */}
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ color: 'var(--c-text3)', textAlign: 'right' }}>
                <th style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>Age</th>
                <th style={{ ...cell, fontWeight: 700 }}>Pension</th>
                <th style={{ ...cell, fontWeight: 700 }}>ISA</th>
                <th style={{ ...cell, fontWeight: 700 }}>GIA</th>
                <th style={{ ...cell, fontWeight: 700 }}>Cash</th>
                <th style={{ ...cell, fontWeight: 700 }}>Secure</th>
                <th style={{ ...cell, fontWeight: 700 }}>Tax</th>
                <th style={{ ...cell, fontWeight: 700 }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.age ?? i} style={{ textAlign: 'right', borderTop: '1px solid var(--c-border)' }}>
                  <td style={{ ...cell, textAlign: 'left', color: 'var(--c-text2)' }}>{r.age}</td>
                  <td style={{ ...cell, color: r.draws.pension > 0 ? 'var(--c-text)' : 'var(--c-text3)' }}>{_gk(r.draws.pension)}</td>
                  <td style={{ ...cell, color: r.draws.isa > 0 ? 'var(--c-text)' : 'var(--c-text3)' }}>{_gk(r.draws.isa)}</td>
                  <td style={{ ...cell, color: r.draws.gia > 0 ? 'var(--c-text)' : 'var(--c-text3)' }}>{_gk(r.draws.gia)}</td>
                  <td style={{ ...cell, color: r.draws.cash > 0 ? 'var(--c-text)' : 'var(--c-text3)' }}>{_gk(r.draws.cash)}</td>
                  <td style={{ ...cell, color: 'var(--c-mint-text)' }}>{_gk(_secure(r))}</td>
                  <td style={{ ...cell, color: 'var(--c-coral, #FF6F7D)' }}>{_gk(r.tax)}</td>
                  <td style={{ ...cell, color: 'var(--c-acc)', fontWeight: 700 }}>{_gk(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 6 }}>
            Key years only — each row is where the drawn-from pot changes, so you can see the hand-off pension&nbsp;→&nbsp;GIA&nbsp;→&nbsp;ISA&nbsp;→&nbsp;cash (the in-between years continue the same pot). <b>Secure</b> is income that isn&rsquo;t drawn from a pot — your state pension and any defined-benefit pension — which keeps paying even after the pots are spent.
          </div>
        </div>

        {/* Five ways to PACE withdrawals — a different lens from the draw ORDER
            above. Same component renders standalone in the 'methods' tile. */}
        <MethodsComparison
          portfolio={portfolio}
          years={horizon - currentAge}
          growth={growthPct / 100}
          inflation={seed.inflation ?? 0.025}
          essentialsAnnual={essentialsAnnual}
          age={currentAge}
          horizon={horizon}
          primaryGoal={primaryGoal}
          withToggle
        />

        {/* What this plan assumes — surfaces solve.methodology (assumptions + named rules). */}
        <AssumptionsPanel methodology={solve.methodology} />

        {Array.isArray(route.rationale) && route.rationale.length > 0 && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 16, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.6 }}>
            {route.rationale.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
        {/* Save this route as the user's drawdown plan → SCENARIO_SAVED ripple. */}
        <button onClick={saveAsPlan} disabled={isSaved} className="sw-pressable"
          style={{ marginTop: 14, width: '100%', padding: '11px 14px', borderRadius: 12, cursor: isSaved ? 'default' : 'pointer',
            background: isSaved ? 'var(--c-tint-neutral-2)' : 'var(--c-acc)', color: isSaved ? 'var(--c-text2)' : 'var(--c-bg)',
            border: 'none', fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
          {isSaved ? '✓ Saved to your plan — see Timeline' : `Save “${route.name}” as my plan`}
        </button>
        {isSaved && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>Recorded as your drawdown plan. It appears on your Timeline; this is your stored intention, not advice to act.</div>}

        {solve.coverage?.unknowns?.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>⚠ {solve.coverage.unknowns[0]}</div>
        )}
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          {solve.provenance ? solve.provenance + ' · ' : ''}{solve.disclaimer}
        </div>
      </div>
    )
  }

  // No solved drawdown. A decumulator who simply hasn't set a target income gets
  // prompted to set one (and can do it right here — dragging the income up makes
  // routes appear and the full plan renders). Accumulators get the FI surface.
  let isDecumStage = false
  try { isDecumStage = inferLifeStage(entity) === 'decumulator' } catch { isDecumStage = false }
  if (isDecumStage) {
    return (
      <div className="sw-card" style={S.card}>
        <div style={S.cardTitle}>Set a target retirement income</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6 }}>
          Tell us the income you&rsquo;d like to draw and we&rsquo;ll show how long your pots last, the most tax-efficient order to draw them, and a money-map of where each &pound; comes from.
        </div>
        <div style={{ marginTop: 14 }}>
          <SolverSlider label="Target income" value={target} min={0} max={150000} step={1000} fmt={v => v ? `${fmt(v)}/yr` : 'not set'} onChange={setTarget} dirty={dT} />
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>Drag the income up to generate your plan. Information and guidance, not advice.</div>
      </div>
    )
  }
  // Accumulator / sparse → progress to financial independence (25× target income).
  return <FIProgressTile entity={entity} />
}

// §5.3 FI progress — the accumulator face (§B X24 mode-3 entry). Progress to
// the 25× target-income FI number, from the canonical fiRatio selector. Honest
// empty when investable data is too sparse to be meaningful.
function FIProgressTile({ entity }) {
  let fi = null
  try { fi = fiRatio(entity) } catch { fi = null }
  const fiTarget = fi?.fiTarget || 0
  const ratio = fi?.ratio || 0
  const invested = Math.round(ratio * fiTarget)
  const pct = Math.min(100, Math.round(ratio * 100))
  const targetIncome = fiTarget ? Math.round(fiTarget / 25) : 0

  // Sparse → don't fabricate a progress bar off near-zero data.
  if (!fiTarget || fi?.confidence === 'LOW') {
    return (
      <div className="sw-card" style={S.card}>
        <div style={S.cardTitle}>Financial-independence progress</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          Add your investable savings and a target retirement income to see how far along you are toward financial independence. A year-by-year drawdown plan appears here once you start decumulating.
        </div>
      </div>
    )
  }
  const bandColour = pct >= 100 ? 'var(--c-mint-text)' : pct >= 50 ? 'var(--c-acc)' : 'var(--c-amber-text)'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Financial-independence progress</div>
        {fi.achieved
          ? <span className="sw-chip sw-chip-sm sw-chip-mint">FI reached</span>
          : <span className="sw-chip sw-chip-sm">{fi.multiple}× of {_gk(targetIncome)}/yr</span>}
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: bandColour, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>of the {_gk(fiTarget)} you&rsquo;d need (25× a {_gk(targetIncome)}/yr income)</span>
      </div>
      <div style={{ marginTop: 8, height: 8, borderRadius: 5, background: 'var(--c-tint-neutral-2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: bandColour, transition: 'width .4s ease' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.6 }}>
        You hold <b>{_gk(invested)}</b> of investable assets{fi.achieved ? '' : ` — about ${_gk(Math.max(0, fiTarget - invested))} to go`}. The 25× rule is a long-standing planning rule of thumb (a ~4% withdrawal), not a guarantee — your real number depends on your assumptions.
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.5 }}>
        When you start drawing an income, a tax-aware year-by-year drawdown plan replaces this tile. Information and guidance, not advice.
      </div>
    </div>
  )
}

// ── §B.9 Goal-Seek (§B.5 / X24 mode 3) — Find paths CTA ────────────────
// STUB-01 fix: button now wires onClick to goalSeek(). Slider sets the
// *target*; clicking Find paths commits it and runs the engine. Default
// run on mount so the card isn't empty.
function GoalSeekCard({ entity }) {
  const [target, setTarget] = useState(85)
  const [committedTarget, setCommittedTarget] = useState(85)
  const [running, setRunning] = useState(false)
  const paths = useMemo(
    () => goalSeek(entity, 'wealthScore', committedTarget, 'lifetime', {}) || [],
    [entity, committedTarget]
  )
  function runFindPaths() {
    setRunning(true)
    // Defer commit so the button registers a press state before the
    // (potentially heavy) goalSeek useMemo re-runs.
    requestAnimationFrame(() => {
      setCommittedTarget(target)
      setRunning(false)
    })
  }
  const dirty = target !== committedTarget
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Goal-Seek</div>
        <span className="sw-chip sw-chip-sm">Goal: paths to target Wealth Score</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-sm)',
      }}>
        <span className="sw-eyebrow">Target</span>
        <input
          type="range" min="50" max="100" step="5"
          value={target} onChange={e => setTarget(+e.target.value)}
          style={{ flex: 1 }}
          aria-label="Wealth Score target"
        />
        <strong style={{
          minWidth: 32, textAlign: 'right',
          fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--c-mint-text)',
        }}>{target}</strong>
        <button
          type="button"
          onClick={runFindPaths}
          disabled={running || !dirty}
          aria-label="Find paths to target"
          className="sw-press"
          style={{
            padding: '6px 14px', borderRadius: 'var(--r-pill)',
            background: dirty ? 'var(--c-mint-text)' : 'var(--c-tint-neutral-2)',
            color: dirty ? 'var(--c-bg)' : 'var(--c-text3)',
            border: 'none', cursor: dirty ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
            boxShadow: dirty ? '0 4px 12px var(--c-acc-bg)' : 'none',
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? 'Solving…' : dirty ? 'Find paths' : 'Up to date'}
        </button>
      </div>
      <div style={{
        marginTop: 6, fontSize: 11, color: 'var(--c-text3)',
      }}>
        Showing paths to Wealth Score {committedTarget}
        {dirty && <span style={{ color: 'var(--c-amber-text)' }}>
          {' '}· slider moved — press Find paths to re-solve.
        </span>}
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-xs)',
      }}>
        {(paths || []).slice(0, 3).map((p, i) => (
          <div key={i} style={S.gsRow}>
            <div style={{ flex: 1, fontSize: 13 }}>{humanise(p.action.kind)}</div>
            <div style={{
              minWidth: 90, textAlign: 'right',
              fontSize: 11, color: 'var(--c-text3)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(p.action.amount)}
            </div>
            <div style={{
              minWidth: 60, textAlign: 'right',
              fontSize: 11, fontWeight: 700, color: 'var(--c-mint-text)',
            }}>
              gap {p.gap}
            </div>
          </div>
        ))}
        {(paths || []).length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
            No solver paths returned for this target.
          </div>
        )}
      </div>
    </div>
  )
}

// ── CoIOdometer wrapper — adds cascade-halo on totalCoI change ─────────
function CoIOdometerWithHalo({ coi }) {
  const total = coi?.total ?? coi?.byDomain?.estatePlanning ?? 0
  const halo = useCascadeTrigger(Math.round(total))
  return (
    <div className={halo ? 'sw-cascade-halo' : ''} style={{ borderRadius: 'var(--r-lg)' }}>
      <CoIOdometer
        totalCoI={total}
        confidence={(coi.confidence || 'MED').toLowerCase()}
        provenance={[BRAND.rulesVersion, 'UK-CMA-2026.1']}
        byAction={Object.entries(coi?.byDomain || {}).map(([k, v]) => ({
          label: humanise(k),
          amount: v,
          key: k,
        }))}
      />
    </div>
  )
}

// ── §C.2 CF CoI variants card (§6.3b) — 3+1 director variants ───────────
function CfCoiVariantsCard({ coiVar }) {
  const rows = [
    { key: 'drawdown',     label: 'Withdrawal sequence',  v: coiVar?.drawdown || 0 },
    { key: 'wrapper',      label: 'Wrapper sequencing',   v: coiVar?.wrapper || 0 },
    { key: 'contribution', label: 'Pension opportunity',  v: coiVar?.contribution || 0 },
    { key: 'allowance',    label: 'Director / allowance', v: coiVar?.allowance || 0 },
  ]
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>CF Cost-of-Inaction variants</div>
        <span className="sw-chip sw-chip-sm sw-chip-coral">3+1</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-sm)',
      }}>
        {rows.map(r => (
          <div key={r.key} style={S.allocRow}>
            <div style={{ flex: 1, fontSize: 13 }}>{r.label}</div>
            <div style={{
              minWidth: 80, textAlign: 'right',
              fontSize: 13, fontWeight: 700, color: 'var(--c-coral-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(r.v)}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 'var(--space-sm)', fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic',
      }}>
        NPV discount-rate methodology in progress.
      </div>
    </div>
  )
}

// ── §C.3 PRC/PCC stub card (§6.4) — featured founder concept ───────────
// STUB-03: honour engine `status: 'stub'` flag — engine may return a
// fabricated spread_pp for layout purposes but it is NOT a real number.
function PrcPccStubCard({ prcPcc }) {
  const stub =
    prcPcc?.status === 'stub' ||
    prcPcc?.insufficient_data ||
    prcPcc?.spread_pp == null
  return (
    <div
      className="sw-card sw-card-elevated sw-lift sw-pulse-glow"
      style={S.featuredCard}
    >
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Personal return vs cost spread</div>
        <span className="sw-chip sw-chip-sm sw-chip-mint">Experimental</span>
      </div>
      {stub ? (
        <div style={{
          marginTop: 'var(--space-md)', fontSize: 12, color: 'var(--c-text3)',
        }}>
          <strong style={{ color: 'var(--c-text2)' }}>Coming next.</strong> Withdrawal-rate
          methodology in progress. Engine returns a layout-only envelope.
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)',
            marginTop: 'var(--space-md)',
          }}>
            <span
              className="sw-hero-md"
              style={{
                color: prcPcc.spread_pp >= 0 ? 'var(--c-mint-text)' : 'var(--c-coral-text)',
              }}
            >
              <Num value={prcPcc.spread_pp} format="percent" animate />
              <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 4 }}>pp</span>
            </span>
            <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
              personal-return vs personal-cost-of-capital
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-sm)', fontSize: 11, color: 'var(--c-text3)' }}>
            {prcPcc.prc_blocks?.length || 0} return blocks · {prcPcc.pcc_blocks?.length || 0} cost blocks
          </div>
        </>
      )}
    </div>
  )
}

// ── §C.4 Reality Engine stub (§6.5) — featured founder concept ─────────
// STUB-04: same as PRC/PCC — honour status flag and render "Coming next"
// rather than the stub-derived layer percentages, which are not real.
function RealityEngineStubCard({ reality }) {
  const isStub = reality?.status === 'stub' || !reality?.layers
  if (isStub) {
    return (
      <div
        className="sw-card sw-card-elevated sw-lift sw-pulse-glow"
        style={S.featuredCard}
      >
        <div style={S.cardTitle}>Reality Engine</div>
        <div style={{
          marginTop: 'var(--space-sm)', fontSize: 12, color: 'var(--c-text3)',
        }}>
          <strong style={{ color: 'var(--c-text2)' }}>Coming next.</strong> Factor
          weights in progress — personal / system / external split
          will land once methodology is signed off.
        </div>
      </div>
    )
  }
  const { personal, financial_system, external } = reality.layers
  return (
    <div
      className="sw-card sw-card-elevated sw-lift sw-pulse-glow"
      style={S.featuredCard}
    >
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Reality Engine</div>
        <span className="sw-chip sw-chip-sm sw-chip-violet">{reality.confidence}</span>
      </div>
      <div style={S.realityBar}>
        <div style={{ ...S.realitySeg, width: `${(personal?.share || 0) * 100}%`, background: 'var(--c-mint-text)' }} />
        <div style={{ ...S.realitySeg, width: `${(financial_system?.share || 0) * 100}%`, background: 'var(--c-amber-text)' }} />
        <div style={{ ...S.realitySeg, width: `${(external?.share || 0) * 100}%`, background: 'var(--c-coral-text)' }} />
      </div>
      <div style={{
        marginTop: 'var(--space-sm)', display: 'flex',
        justifyContent: 'space-between', fontSize: 11,
      }}>
        <span style={{ color: 'var(--c-mint-text)' }}>Personal {pct(personal?.share)}</span>
        <span style={{ color: 'var(--c-amber-text)' }}>System {pct(financial_system?.share)}</span>
        <span style={{ color: 'var(--c-coral-text)' }}>External {pct(external?.share)}</span>
      </div>
      <div style={{
        marginTop: 'var(--space-sm)', fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic',
      }}>
        Factor weights methodology in progress.
      </div>
    </div>
  )
}

// ── §C.5 Max-drawdown tolerance (§6.6) ──────────────────────────────────
function MaxDrawdownCard({ mdd }) {
  if (!mdd || mdd.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Max drawdown tolerance</div>
        <div style={{
          marginTop: 'var(--space-sm)', fontSize: 12, color: 'var(--c-text3)',
        }}>
          Insufficient data.
        </div>
      </div>
    )
  }
  const sev = mdd.mismatch_severity
  const c = sev === 'high' ? 'var(--c-coral-text)'
         : sev === 'medium' ? 'var(--c-amber-text)'
         : 'var(--c-mint-text)'
  const chip = sev === 'high' ? 'sw-chip-coral'
              : sev === 'medium' ? 'sw-chip-amber'
              : 'sw-chip-mint'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Max drawdown tolerance</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>{sev}</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
      }}>
        <Stat label="Implied MDD" value={pct(mdd.implied_max_drawdown)} colour={c} />
        <Stat label="Stated tolerance" value={pct(mdd.stated_tolerance)} />
        <Stat label="Mismatch" value={pct(mdd.mismatch)} colour={c} />
        <Stat label="60/40 reference" value={pct(mdd.rebalance_to_60_40)} />
      </div>
    </div>
  )
}

// ── §C.6 Efficient frontier (§6.7) ──────────────────────────────────────
function EfficientFrontierCard({ eff }) {
  if (!eff || eff.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Efficient frontier</div>
        <div style={{
          marginTop: 'var(--space-sm)', fontSize: 12, color: 'var(--c-text3)',
        }}>
          Insufficient data.
        </div>
      </div>
    )
  }
  const c = eff.position === 'on' ? 'var(--c-mint-text)' : 'var(--c-amber-text)'
  const chip = eff.position === 'on' ? 'sw-chip-mint' : 'sw-chip-amber'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Efficient frontier</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>{eff.position}</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
      }}>
        <Stat label="Portfolio return" value={pct(eff.portfolio_expected_return)} />
        <Stat label="Portfolio vol" value={pct(eff.portfolio_volatility)} />
        <Stat label="Frontier return" value={pct(eff.frontier_at_same_risk)} colour="var(--c-mint-text)" />
        <Stat label="Return gap" value={pct(eff.return_gap)} colour={c} />
      </div>
    </div>
  )
}

// ── §C.7 FI progress (§6.8) — same as §B.3 but in depth context ─────────
function FiProgressDepthCard({ fi }) {
  if (!fi) return null
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>FI progress (depth)</div>
        <span className="sw-chip sw-chip-sm">target {fmt(fi.fiTarget || 0)}</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
      }}>
        <Stat label="Ratio" value={`${fi.ratio}`} />
        <Stat label="Multiple" value={`${fi.multiple}×`} />
        <Stat label="Achieved" value={fi.achieved ? 'Yes' : 'No'}
              colour={fi.achieved ? 'var(--c-mint-text)' : 'var(--c-amber-text)'} />
        <Stat label="Confidence" value={fi.confidence} />
      </div>
    </div>
  )
}

// ── §C.8 Confidence-interval summary (§6.9) ─────────────────────────────
function ConfidenceIntervalSummary({ health, fr, pos, coi }) {
  // For the funded ratio row, show the status label (Under-funded / Approaching target /
  // On track / Over-funded) derived from fr.ratio — NOT fr.confidence.
  // fr.confidence = 'HIGH' means high calculation certainty, NOT that the ratio is high.
  // Showing 'HIGH' next to 'Funded ratio' is misleading when ratio is e.g. 0.32.
  const frStatusLabel = (() => {
    const r = +(fr?.ratio ?? fr?.value ?? 0)
    if (!fr || fr.insufficient_data || !r) return fr?.confidence || null
    if (r >= 1.1)  return 'Over-funded'
    if (r >= 1.0)  return 'On track'
    if (r >= 0.85) return 'Approaching target'
    return 'Under-funded'
  })()
  const frStatusChip = (() => {
    const r = +(fr?.ratio ?? fr?.value ?? 0)
    if (!fr || fr.insufficient_data || !r) return confChip(fr?.confidence)
    return r >= 1.0 ? 'sw-chip-mint' : r >= 0.85 ? 'sw-chip-amber' : 'sw-chip-coral'
  })()

  const rows = [
    { key: 'health', label: 'Cashflow Health',        conf: health?.confidence, chipClass: null },
    { key: 'fr',     label: 'Funded ratio',           conf: frStatusLabel,      chipClass: frStatusChip },
    { key: 'pos',    label: 'Probability of Success', conf: pos?.confidence,    chipClass: null },
    { key: 'coi',    label: 'Cost of Inaction',       conf: coi?.confidence,    chipClass: null },
  ]
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Confidence summary</div>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-xs)',
      }}>
        {rows.map(r => (
          <div key={r.key} style={S.allocRow}>
            <div style={{ flex: 1, fontSize: 12 }}>{r.label}</div>
            <span className={`sw-chip sw-chip-sm ${r.chipClass ?? confChip(r.conf)}`}>
              {r.conf || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function confChip(c) {
  const u = String(c || '').toUpperCase()
  if (u.includes('HIGH')) return 'sw-chip-mint'
  if (u.includes('MED'))  return 'sw-chip-amber'
  if (u.includes('LOW'))  return 'sw-chip-coral'
  return ''
}

// ── shared Stat tile ────────────────────────────────────────────────────
function Stat({ label, value, colour = 'var(--c-text)' }) {
  return (
    <div style={S.statTile}>
      <div className="sw-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ ...S.statValue, color: colour }}>{value}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S = {
  shell: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'var(--space-md) var(--space-lg) var(--space-sm)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    color: 'var(--c-mint-text)',
    fontSize: 13, fontWeight: 600, padding: '4px 0',
  },
  headerTitle: {
    fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
    letterSpacing: -0.2,
  },
  body: {
    flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    // R3v2 frontend critique fix (2026-05-26): bottom padding now reserves
    // room for the sticky Ask Sonu pill (~64px) PLUS the bottom-nav tab bar
    // (~80px). Previous --space-3xl (~40px) was insufficient so the pill
    // overlapped the last content card (Sankey / scenarios) at every viewport.
    paddingBottom: 160,
  },

  // Sub-anchor — full-width strip, sw-card supplies padding via design tokens
  subAnchor: {
    margin: 'var(--space-xs) var(--space-lg) var(--space-sm)',
    padding: 'var(--space-sm) var(--space-lg)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 'var(--space-md)',
  },
  subAnchorValue: {
    fontSize: 14, fontWeight: 800, color: 'var(--c-text)', marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },

  // Purpose
  purpose: {
    margin: 'var(--space-sm) var(--space-lg)',
    textAlign: 'center',
  },
  purposeLine1: {
    fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.4,
  },
  purposeLine2: {
    fontSize: 12, color: 'var(--c-text3)', marginTop: 4,
  },

  // Hero — uses sw-card sw-card-elevated; padding comes from design tokens
  heroCard: {
    margin: 'var(--space-sm) var(--space-lg) var(--space-md)',
    background: 'linear-gradient(135deg, var(--c-tint-mint) 0%, var(--c-surface) 60%)',
    border: '1px solid var(--c-tint-mint-2)',
  },
  heroComponents: {
    marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)',
    borderTop: '1px solid var(--c-tint-neutral-2)',
  },
  heroComponentsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 'var(--space-md)',
  },

  // Section delimiter — sticky, full-width
  delimiter: {
    margin: 'var(--space-2xl) var(--space-lg) var(--space-md)',
    padding: 'var(--space-md) var(--space-lg)',
    background: 'linear-gradient(180deg, var(--c-surface) 0%, var(--c-tint-neutral) 100%)',
    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    backdropFilter: 'blur(8px)',
  },
  delimiterLetter: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800, padding: 0,
    flexShrink: 0,
  },
  delimiterTitle: {
    fontSize: 14, fontWeight: 800, color: 'var(--c-text)', letterSpacing: 0.4,
  },
  delimiterSubtitle: {
    fontSize: 12, color: 'var(--c-text3)', marginTop: 2,
  },

  // Generic card — sw-card supplies padding; only override margin
  card: {
    margin: '0 var(--space-lg) var(--space-md)',
  },
  // Featured card variant for PRC/PCC + Reality Engine
  featuredCard: {
    margin: '0 var(--space-lg) var(--space-md)',
    border: '1px solid var(--c-tint-mint-2)',
  },
  cardHeader: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 'var(--space-sm)',
  },
  cardTitle: {
    fontSize: 13, fontWeight: 800, color: 'var(--c-text)',
  },
  implication: {
    marginTop: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--c-tint-neutral)',
    borderRadius: 'var(--r-md)',
    fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5,
  },

  // Bill calendar
  calendarGrid: {
    marginTop: 'var(--space-md)', display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
  },
  calendarCell: { aspectRatio: '1', borderRadius: 4 },

  // Allocator row
  allocRow: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
    padding: 'var(--space-xs) var(--space-sm)',
    borderRadius: 'var(--r-md)',
    background: 'var(--c-tint-neutral)',
  },
  allocPriority: {
    width: 26, height: 26, borderRadius: '50%',
    background: 'var(--c-tint-mint-2)', color: 'var(--c-mint-text)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },

  // Scenario row
  scenRow: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--c-tint-neutral)',
    borderRadius: 'var(--r-md)',
  },
  gsRow: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
    padding: 'var(--space-xs) var(--space-sm)',
    background: 'var(--c-tint-neutral)',
    borderRadius: 'var(--r-md)',
  },

  // Reality bar
  realityBar: {
    marginTop: 'var(--space-md)', height: 14, borderRadius: 'var(--r-pill)',
    overflow: 'hidden', display: 'flex',
    background: 'var(--c-tint-neutral-2)',
  },
  realitySeg: {
    height: '100%',
    transition: 'width var(--dur-slow, 600ms) var(--ease-out-cubic, cubic-bezier(0.33,1,0.68,1))',
  },

  // Stat tile
  statTile: {
    background: 'var(--c-tint-neutral)', borderRadius: 'var(--r-md)',
    padding: 'var(--space-sm) var(--space-md)',
  },
  statValue: {
    fontSize: 13, fontWeight: 700, marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },

  // Disclaimer
  disclaimer: {
    textAlign: 'center', fontSize: 10, color: 'var(--c-text3)',
    padding: 'var(--space-2xl) var(--space-2xl) var(--space-md)',
    lineHeight: 1.6,
  },
}
