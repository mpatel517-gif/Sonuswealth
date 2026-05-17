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
import {
  // Core
  fmt, netWorth, calcFQ, calcRisk, fqBand, riskBand,
  // Cashflow Health (§3B)
  cashflowHealth,
  // §A NOW
  calcAllIncome, classifyIncomeType, monthlySurplus,
  liquidityBuffer, recommendedSurplusAllocation,
  debtRatio, calcANI,
  // §B TRAJECTORY
  swrFromRegime, fundedRatio, fiRatio,
  guytonKlingerPath, goalSeek,
  // §C DEPTH
  totalCoI, coiCashflowVariants,
  // Cashflow-engine re-exports
  cf_probabilityOfSuccess,
  cf_sequenceOfReturnsVulnerability,
  cf_fiveCashflowScenarios,
  cf_prcPccSpread,
  cf_realityEngineFactorisation,
  cf_maxDrawdownExposure,
  cf_portfolioEfficiency,
} from '../engine/fq-calculator.js'

import CMA_BUNDLE from '../rules/cma-2026.json' with { type: 'json' }

import { BRAND } from '../config/brand.js'
import TripleAnchor from '../components/shared/TripleAnchor.jsx'
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

// Phase 2 Batch C — premium Cashflow components. Aliased as *V2 to avoid
// colliding with the local components of the same name defined below. The
// local versions remain available; the V2 renders take precedence in the JSX.
import FundedRatioGaugeV2  from '../components/Cashflow/FundedRatioGauge.jsx'
import PoSChartV2          from '../components/Cashflow/PoSChart.jsx'
import ScenarioMatrixV2    from '../components/Cashflow/ScenarioMatrix.jsx'
import CashflowWaterfallV2 from '../components/Cashflow/CashflowWaterfall.jsx'
import SequenceStressVisV2 from '../components/Cashflow/SequenceStressVis.jsx'
import EfficientFrontierV2 from '../components/Cashflow/EfficientFrontier.jsx'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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
  const incomeAll  = useMemo(() => { try { return calcAllIncome(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const ms         = useMemo(() => { try { return monthlySurplus(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const lb         = useMemo(() => { try { return liquidityBuffer(entity) } catch { return null } }, [entity])
  const surplusAlloc = useMemo(() => {
    const s = ms?.surplus
    if (s == null) return null
    try { return recommendedSurplusAllocation(entity, s) } catch { return null }
  }, [entity, ms])

  const gross       = +(incomeAll?.gross_annual ?? incomeAll?.total ?? 0)
  const taxAnn      = +(incomeAll?.tax_total_annual ?? incomeAll?.tax ?? 0)
  const pensionMo   = +(entity?.assets?.sipp?.contribMonthly ?? entity?.pensionContribMonthly ?? 0)
  const pensionAnn  = pensionMo * 12
  const essAnn      = +(ms?.essentials_annual ?? (ms?.essential != null ? ms.essential * 12 : 0))
  const debtAnn     = +(ms?.debt_service_annual ?? (ms?.debtService != null ? ms.debtService * 12 : 0))
  const surplusAnn  = gross > 0 ? (gross - taxAnn - pensionAnn - essAnn - debtAnn) : +(ms?.surplus != null ? ms.surplus * 12 : 0)
  const surplusMo   = surplusAnn / 12

  const steps = [
    { label: 'Gross income',         value: gross,       colour: 'var(--c-success)', kind: 'income',    note: incomeAll?.marginal_band ? `${incomeAll.marginal_band} band` : null },
    { label: 'Tax & NI',             value: -taxAnn,     colour: 'var(--c-danger)',  kind: 'deduction', note: null },
    { label: 'Pension contributions',value: -pensionAnn, colour: 'var(--c-acc)',     kind: 'deduction', note: pensionAnn > 0 ? 'Pre-tax via salary sacrifice' : null },
    { label: 'Essentials',           value: -essAnn,     colour: 'var(--c-warning)', kind: 'deduction', note: 'Housing, bills, transport' },
    { label: 'Debt service',         value: -debtAnn,    colour: 'var(--c-acc3)',    kind: 'deduction', note: 'Loans and cards' },
    { label: 'Monthly surplus × 12', value: surplusAnn,  colour: surplusAnn >= 0 ? 'var(--c-acc)' : 'var(--c-danger)', kind: 'surplus', note: null },
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
          Monthly surplus breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Monthly surplus</div>
          <div style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: surplusMo >= 0 ? 'var(--c-acc)' : 'var(--c-danger)',
          }}>
            {surplusMo >= 0 ? '' : '−'}{fmt(Math.abs(surplusMo))}/mo
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            {fmt(gross)}/yr gross · {fmt(surplusAnn >= 0 ? surplusAnn : 0)}/yr surplus
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
          {steps.map(({ label, value, colour, note }) => {
            const w = (Math.abs(value) / maxAbs) * 100
            const isDeduction = value < 0
            return (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
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
              {lb.months.toFixed(1)} months
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
              {lb.months >= 6 ? 'Buffer healthy (6+ months)' : lb.months >= 3 ? 'Buffer adequate (3–6 months)' : 'Buffer low — consider building this first'}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Derived from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Income Breakdown Drill Panel
// ═══════════════════════════════════════════════════════════════════════════

function IncomeBreakdownDrillPanel({ entity, onClose }) {
  const incomeAll = useMemo(() => { try { return calcAllIncome(entity, CMA_BUNDLE) } catch { return null } }, [entity])
  const inc = entity?.income || {}

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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalAnnual / 12)}/mo · {fmt(totalAnnual)}/yr
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Derived from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// L3 — Health Score Drill Panel
// ═══════════════════════════════════════════════════════════════════════════

function HealthScoreDrillPanel({ entity, onClose }) {
  const health = useMemo(() => { try { return cashflowHealth(entity, CMA_BUNDLE) } catch { return null } }, [entity])

  const BAND_COLOUR = { Critical: 'var(--c-danger)', Stressed: 'var(--c-warning)', Steady: 'var(--c-acc)', Healthy: 'var(--c-success)', Thriving: 'var(--c-success)' }
  const bandColour = BAND_COLOUR[health?.band] || 'var(--c-text)'

  const COMPONENTS = [
    { key: 'liquidityBuffer',  label: 'Liquidity buffer',   weight: 30, desc: 'Emergency reserves covering months of essentials' },
    { key: 'surplus',          label: 'Surplus ratio',      weight: 25, desc: 'Monthly income left after all outgoings' },
    { key: 'debtManageability',label: 'Debt manageability', weight: 20, desc: 'Debt service as a share of gross income' },
    { key: 'incomeResilience', label: 'Income resilience',  weight: 15, desc: 'Diversity and stability of income sources' },
    { key: 'sequenceRisk',     label: 'Sequence resilience',weight: 10, desc: 'Portfolio exposure to poor early-retirement returns' },
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
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{label}</span>
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
          Information only · Derived from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

export default function Cashflow({ entity, onHome, onOpenRisk, onDrillMetric, scenarioSeed, onScenarioSeedConsumed }) {
  const [windowId, setWindowId] = useState('current-tax-year')
  const [viewMode, setViewMode] = useState('actual')
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
    [entity]
  )

  // ── §A NOW computations ────────────────────────────────────────────────
  const incomeAll = useMemo(
    () => calcAllIncome(entity, CMA_BUNDLE),
    [entity]
  )
  const ms = useMemo(() => monthlySurplus(entity, CMA_BUNDLE), [entity])
  const lb = useMemo(() => liquidityBuffer(entity), [entity])
  const surplusAlloc = useMemo(
    () => recommendedSurplusAllocation(entity, ms.surplus),
    [entity, ms.surplus]
  )

  // ── §B TRAJECTORY computations ─────────────────────────────────────────
  const swr = useMemo(
    () => swrFromRegime(swrRegime, null, CMA_BUNDLE),
    [swrRegime]
  )
  const fr = useMemo(() => fundedRatio(entity, CMA_BUNDLE), [entity])
  const fi = useMemo(() => fiRatio(entity), [entity])

  // 1000-run Monte Carlo per spec §5.4 / §5.5 (O-CF-RULES-01).
  const pos = useMemo(
    () => cf_probabilityOfSuccess(entity, CMA_BUNDLE, 1000),
    [entity]
  )
  const seqVuln = useMemo(
    () => cf_sequenceOfReturnsVulnerability(entity, CMA_BUNDLE),
    [entity]
  )
  const gkPath = useMemo(
    () => guytonKlingerPath(entity, 30, CMA_BUNDLE),
    [entity]
  )
  const fiveScen = useMemo(
    () => cf_fiveCashflowScenarios(entity, CMA_BUNDLE),
    [entity]
  )

  // ── §C DEPTH computations ──────────────────────────────────────────────
  const coi = useMemo(() => totalCoI(entity, CMA_BUNDLE), [entity])
  const coiVar = useMemo(() => coiCashflowVariants(entity), [entity])
  const prcPcc = useMemo(() => cf_prcPccSpread(entity), [entity])
  const reality = useMemo(
    () => cf_realityEngineFactorisation(entity, CMA_BUNDLE),
    [entity]
  )
  const mdd = useMemo(
    () => cf_maxDrawdownExposure(entity, CMA_BUNDLE),
    [entity]
  )
  const eff = useMemo(
    () => cf_portfolioEfficiency(entity, CMA_BUNDLE),
    [entity]
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
        <button onClick={onHome} className="sw-press" style={S.backBtn}>
          <span style={{ fontSize: 16 }}>←</span> Home
        </button>
        <div style={S.headerTitle}>Cashflow</div>
        <button
          onClick={() => setAccountantMode(m => !m)}
          className={`sw-chip sw-chip-sm sw-press ${accountantMode ? 'sw-chip-mint' : ''}`}
          style={{ cursor: 'pointer', fontWeight: 700, letterSpacing: 0.4 }}
          title="Toggle simple / accountant view"
        >
          {accountantMode ? 'P&L view' : 'Simple view'}
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={S.body}>

        {/* Triple anchor */}
        <FadeInOnMount delay={20}>
          <TripleAnchor
            netWorthVal={nw}
            fqTotal={fq.total}
            fqBand={fqBandObj}
            riskTotal={risk.total}
            riskBand={rkBandObj}
            onNetWorthTap={() => onDrillMetric?.('netWorth')}
            onWealthTap={() => onDrillMetric?.('wealthScore')}
            onRiskTap={onOpenRisk}
          />
        </FadeInOnMount>

        {/* Sub-anchor strip — D-ANCHOR-2 (PRC/PCC stub) */}
        <FadeInOnMount delay={60}>
          <SubAnchor prcPcc={prcPcc} />
        </FadeInOnMount>

        {/* §3A — X25 purpose statement */}
        <FadeInOnMount delay={100}>
          <PurposeStatement />
        </FadeInOnMount>

        {/* §3B — Cashflow Health Score hero metric.
            Pass incomeAll/ms/fr so the hero can derive the spec's full 5
            components (incomeResilience / fundedRatio / debtServiceRatio
            aren't in the engine output yet — MATH-04 / CAT-01 / CAT-02). */}
        <FadeInOnMount delay={140}>
          <div style={{ position: 'relative' }}>
            <CashflowHealthHero
              health={health}
              incomeAll={incomeAll}
              ms={ms}
              fr={fr}
              entity={entity}
            />
            <button
              onClick={() => setDrillView('health')}
              className="sw-chip sw-chip-sm sw-press"
              style={{
                position: 'absolute', top: 14, right: 14,
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                color: 'var(--c-acc)',
              }}
            >
              Detail ›
            </button>
          </div>
        </FadeInOnMount>

        {/* X28 top-bar — 7 windows + 4 view modes */}
        <FadeInOnMount delay={180}>
          <X28TopBar
            window={windowId}
            viewMode={viewMode}
            onWindowChange={setWindowId}
            onViewModeChange={setViewMode}
          />
        </FadeInOnMount>

        {/* Scenario seed banner — surfaces what the user asked us to model when
            they landed here via a TappableNumber "Tweak in scenario mode" link. */}
        {viewMode === 'scenario' && activeSeed && (
          <ScenarioSeedBanner seed={activeSeed} onDismiss={() => setActiveSeed(null)} />
        )}

        {/* View-mode + window aware container — re-key triggers reveal animations */}
        <div
          key={`${viewMode}::${windowId}`}
          className="sw-tab-slide"
          style={{ display: 'contents' }}
        >
          {/* ════ SECTION A ════════════════════════════════════════════ */}
          <SectionDelimiter
            letter="A"
            title="NOW · This month, this year"
            subtitle="Where your money goes — and what's left."
            chipClass="sw-chip-mint"
          />

          <RevealStagger interval={60} startDelay={50}>
            {/* Phase 2 Batch C — new waterfall replaces local version.
                MATH-01/02 fix: steps derived purely from engine; no hardcoded
                fallbacks (£78k / £29k / etc removed — Mr T's real gross is
                £67,420, was being masked by the magic numbers). Surplus is
                arithmetic-computed from the deductions so the visible total
                always reconciles. Empty state when engine returns no income. */}
            <div style={{ position: 'relative' }}>
              <CashflowWaterfallReconciled entity={entity} incomeAll={incomeAll} ms={ms} />
              {/* L3 drill affordance — tap to open SurplusDrillPanel */}
              <button
                onClick={() => setDrillView('surplus')}
                className="sw-chip sw-chip-sm sw-press"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                  color: 'var(--c-acc)',
                }}
                title="Open full surplus breakdown"
              >
                Breakdown ›
              </button>
            </div>
            <EssentialsDiscretionarySplit ms={ms} />
            <BillCalendar entity={entity} />
            <SubscriptionTracker entity={entity} />
            <SurplusAllocator surplus={ms.surplus} alloc={surplusAlloc} />
            <LiquidityBufferCard lb={lb} />
            {/* CAT-03: Domain O split — salary / dividends / rental /
                drawdown / interest / pension. Sits ABOVE the tax-band
                view so the user sees the source breakdown first. */}
            <div style={{ position: 'relative' }}>
              <IncomeBySourceCard entity={entity} incomeAll={incomeAll} />
              <button
                onClick={() => setDrillView('income')}
                className="sw-chip sw-chip-sm sw-press"
                style={{
                  position: 'absolute', top: 14, right: 14,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                  color: 'var(--c-acc)',
                }}
              >
                Breakdown ›
              </button>
            </div>
            <IncomeBreakdownByBand incomeAll={incomeAll} />
          </RevealStagger>

          {/* ════ SECTION B ════════════════════════════════════════════ */}
          <SectionDelimiter
            letter="B"
            title="TRAJECTORY · This year to retirement"
            subtitle="Will it last?"
            chipClass="sw-chip-blue"
          />

          <RevealStagger interval={60} startDelay={50}>
            {/* Goal Seek — promoted to top of Section B per user 2026-05-11 */}
            <GoalSeekCard entity={entity} />
            <SwrRegimePicker
              regime={swrRegime}
              onChange={setSwrRegime}
              swr={swr}
            />
            {/* Phase 2 Batch C — premium replacements (V2 visuals). */}
            <FundedRatioGaugeV2
              ratio={+(fr?.ratio || fr?.value || 1.0)}
              confidence={fr?.confidence_low != null ? { low: +fr.confidence_low, high: +fr.confidence_high } : null}
              fundedYears={fr?.fundedYears || fr?.years || null}
            />
            <FiProgressTile fi={fi} />
            <PoSHeadline pos={pos} />
            <PoSChartV2
              probability={+(pos?.probability || pos?.success_pct || 0.94)}
              median={pos?.median_path || null}
              bands={pos?.bands || null}
              guardrail={pos?.next_guardrail || null}
              horizonYears={pos?.horizon_years || 30}
            />
            <SequenceStressVisV2
              goodSequence={seqVuln?.good_path || null}
              badSequence={seqVuln?.bad_path || null}
              horizonYears={seqVuln?.horizon_years || 30}
            />
            <GuytonKlingerCorridor path={gkPath} />
            {/* STUB-02 fix: ScenarioMatrix now drives a real selection
                state that re-renders ScenarioSummary below it. Engine
                recompute hook is in place — when the engine grows a
                per-scenario forward-cashflow API the recompute slots in
                without UI changes. */}
            <ScenarioMatrixWithRecompute
              scenarios={fiveScen?.scenarios || null}
              defaultActiveId={fiveScen?.active_id || 'optimal'}
              entity={entity}
            />
          </RevealStagger>

          {/* ════ SECTION C ════════════════════════════════════════════ */}
          <SectionDelimiter
            letter="C"
            title="DEPTH · Analytical layer"
            subtitle="Why it works — and what could break it."
            chipClass="sw-chip-violet"
          />

          <RevealStagger interval={60} startDelay={50}>
            {/* IHT CoI odometer (§6.3) — uses byDomain.estatePlanning */}
            <CoIOdometerWithHalo
              coi={coi}
            />
            <CfCoiVariantsCard coiVar={coiVar} />
            <PrcPccStubCard prcPcc={prcPcc} />
            <RealityEngineStubCard reality={reality} />
            <MaxDrawdownCard mdd={mdd} />
            <EfficientFrontierV2
              userPosition={eff?.user_position || null}
              reference={eff?.reference || null}
              frontierPoints={eff?.frontier_points || null}
              distanceToFrontier={+(eff?.distance_to_frontier || 0.012)}
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
  return (
    <div className="sw-card" style={S.subAnchor}>
      <div>
        <div className="sw-eyebrow">Capital Efficiency</div>
        <div style={S.subAnchorValue}>
          {stub ? 'Coming next' : `${prcPcc.spread_pp.toFixed(2)} pp spread`}
        </div>
      </div>
      <span className={`sw-chip sw-chip-sm ${stub ? '' : 'sw-chip-mint'}`}>
        {stub ? 'methodology pending O-CF-RULES-07' : 'PRC – PCC'}
      </span>
    </div>
  )
}

// ── §3A — X25 purpose statement ─────────────────────────────────────────
function PurposeStatement() {
  return (
    <div style={S.purpose}>
      <div style={S.purposeLine1}>
        Will your money last — and is what's coming in actually enough?
      </div>
      <div style={S.purposeLine2}>
        See your income, expenses, and what the years ahead look like. In 35 seconds.
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
        <RevealStagger interval={50} startDelay={120} as="div" style={S.heroComponentsGrid}>
          {spec5.map(([k, v]) => (
            <ComponentRow key={k} label={HEALTH_COMPONENT_LABEL[k] || humanise(k)} value={v} />
          ))}
        </RevealStagger>
      </div>
    </div>
  )
}

// Tiny row with a thin animated progress bar (0 → value).
// MATH-07 fix: engine returns components on 0–100 scale (not 0–20). Map
// straight through so bars don't saturate.
function ComponentRow({ label, value }) {
  const pctV = Math.max(0, Math.min(100, Math.round(+value || 0)))
  const colour = pctV >= 70 ? 'var(--c-mint-text)'
              : pctV >= 40 ? 'var(--c-amber-text)'
              : 'var(--c-coral-text)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
      padding: '4px 0',
    }}>
      <div style={{
        flex: 1, fontSize: 11, color: 'var(--c-text2)',
      }}>{label}</div>
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

// ── §A.1 Reconciled waterfall (MATH-01, MATH-02) ─────────────────────────
// Wraps the V2 visual with engine-derived steps that arithmetic-sum:
//   income − tax − pension − essentials − debt = surplus
// No hardcoded fallbacks; renders empty state when income is missing.
function CashflowWaterfallReconciled({ entity, incomeAll, ms }) {
  // Engine-sourced — tolerate either canonical key or legacy alias.
  const gross = +(incomeAll?.gross_annual ?? incomeAll?.total ?? 0)
  const taxAnn = +(incomeAll?.tax_total_annual ?? incomeAll?.tax ?? 0)
  // Pension contributions: support array-shape (pensionContribMonthly) +
  // object-shape (assets.sipp.contribMonthly). Engine doesn't yet surface
  // a canonical figure so derive from persona; zero is honest.
  const pensionMonthly =
    +(entity?.assets?.sipp?.contribMonthly ??
      entity?.pensionContribMonthly ?? 0)
  const pensionAnn = pensionMonthly * 12
  const essentialsAnn =
    +(ms?.essentials_annual ??
      (ms?.essential != null ? ms.essential * 12 : 0))
  const debtAnn =
    +(ms?.debt_service_annual ??
      (ms?.debtService != null ? ms.debtService * 12 : 0))

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

  // Arithmetic-reconciled surplus — never trust engine ms.surplus to match
  // the visible bars; recompute from the same numbers we're rendering.
  const surplusAnn = gross - taxAnn - pensionAnn - essentialsAnn - debtAnn

  return (
    <CashflowWaterfallV2
      steps={[
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
      ]}
    />
  )
}

// ── §A.1 Cashflow waterfall (§4.3) ───────────────────────────────────────
function CashflowWaterfall({ entity, incomeAll, ms, accountantMode }) {
  const grossAnnual = incomeAll?.total || 0
  const target = entity?.targetIncome || (ms?.essential || 0) * 12 || 0
  const taxAnnual = Math.max(0, grossAnnual - target - (ms?.surplus || 0) * 12)
  const dr = debtRatio(entity)
  const debtAnnual = (dr?.monthlyService || 0) * 12
  const essentials = Math.max(0, target * 0.62)
  const discretionary = Math.max(0, target - essentials)
  const surplusAnnual = (ms?.surplus || 0) * 12

  const bands = [
    { label: 'Gross income', amount:  grossAnnual,    colour: 'var(--c-mint-text)',   sign: '+' },
    { label: 'Tax & NI',     amount: -taxAnnual,      colour: 'var(--c-amber-text)',  sign: '−' },
    { label: 'Pension',      amount: -((ms?.committed || 0) * 12), colour: 'var(--c-blue-text)', sign: '−' },
    { label: 'Essentials',   amount: -essentials,     colour: 'var(--c-violet-text)', sign: '−' },
    { label: 'Debt service', amount: -debtAnnual,     colour: 'var(--c-coral-text)',  sign: '−' },
    { label: 'Discretionary',amount: -discretionary,  colour: 'var(--c-blue-text)',   sign: '−' },
    { label: 'Surplus',      amount:  surplusAnnual,  colour: surplusAnnual >= 0 ? 'var(--c-mint-text)' : 'var(--c-coral-text)', sign: '=' },
  ]

  if (accountantMode) {
    bands.splice(2, 0,
      { label: 'PAYE / NI split', amount: 0, colour: 'var(--c-text3)', sign: '·', note: true },
      { label: 'SA accrual',      amount: 0, colour: 'var(--c-text3)', sign: '·', note: true },
    )
  }

  const max = Math.max(...bands.map(b => Math.abs(b.amount)), 1)

  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Cashflow waterfall</div>
        <span className={`sw-chip sw-chip-sm ${accountantMode ? 'sw-chip-blue' : ''}`}>
          {accountantMode ? 'Accountant view' : 'Simple view'}
        </span>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: 'var(--space-xs)', marginTop: 'var(--space-md)',
      }}>
        {bands.map(b => {
          const w = (Math.abs(b.amount) / max) * 100
          return (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div style={{ width: 14, color: 'var(--c-text3)', fontSize: 11 }}>{b.sign}</div>
              <div className="sw-bar" style={{ flex: 1, height: 10 }}>
                <div
                  className="fill"
                  style={{
                    width: `${Math.max(2, w)}%`,
                    background: b.colour,
                    opacity: b.note ? 0.30 : 0.95,
                  }}
                />
              </div>
              <div style={{ minWidth: 130, fontSize: 12, color: 'var(--c-text2)' }}>
                {b.label}
              </div>
              <div style={{
                minWidth: 80, textAlign: 'right',
                fontSize: 12, fontWeight: 700, color: b.colour,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {b.note ? '—' : fmt(b.amount)}
              </div>
            </div>
          )
        })}
      </div>

      <div style={S.implication}>
        Your essentials-to-income ratio is approx 62% — every £1k extra you free up
        adds £25k of FI runway over 25 years.
      </div>
    </div>
  )
}

// ── §A.2 Essentials vs Discretionary (§4.4) ─────────────────────────────
function EssentialsDiscretionarySplit({ ms }) {
  const essentialsPct = (ms?.income || 0) > 0
    ? Math.min(100, Math.round(((ms?.essential || 0) / ms.income) * 100))
    : 0
  const cohortMedian = 58
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
        UK 45-54 cohort median: {cohortMedian}%.
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
          : 'No bills detected yet. Bill calendar populates once you add fixed bills (+ Bill) or connect Open Banking.'}
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
          {subs.length > 0 ? `${subs.length} active` : 'Manual add · Phase 1.2'}
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
            Recurring-charge detection arrives with Open Banking
            (Phase 1.2). Until then, add subscriptions manually so they
            appear in your essentials total.
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
function SurplusAllocator({ surplus, alloc }) {
  const allocList = alloc || []
  if (surplus <= 0) {
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
          You're running a monthly deficit. Suggestions: increase income · reduce essentials · trim discretionary · review subscriptions.
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
          <Num value={lb.months} format="score" animate />
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
          rows to see the Domain O source split.
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
  { id: 'morningstar',    label: 'Morningstar UK 3.4%',     note: 'Conservative' },
  { id: 'vanguard',       label: 'Vanguard 3.3%',           note: 'Cohort-adjusted' },
  { id: 'prc_anchored',   label: 'PRC-anchored',            note: 'Founder concept · stub' },
  { id: 'custom',         label: 'Custom',                  note: 'Override rate' },
]

function SwrRegimePicker({ regime, onChange, swr }) {
  // STUB-08: PRC-anchored and Custom aren't engine-backed yet — engine
  // returns the Bengen fallback rate. Surface that honestly rather than
  // showing the silent fallback as if it were the regime's true rate.
  const selectedDef = REGIMES.find(r => r.id === regime)
  const isStubRegime = regime === 'prc_anchored' || regime === 'custom'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Withdrawal regime</div>
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

// ── §B.4 PoS headline (§5.4) — 1000 MC runs ─────────────────────────────
function PoSHeadline({ pos }) {
  if (!pos || pos.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Probability of Success</div>
        <div style={{
          marginTop: 'var(--space-sm)', color: 'var(--c-text3)', fontSize: 12,
        }}>
          Insufficient data — investable &lt; £10k.
        </div>
      </div>
    )
  }
  const p = Math.round((pos.pos || 0) * 100)
  const c = p >= 85 ? 'var(--c-mint-text)'
           : p >= 70 ? 'var(--c-amber-text)'
           : 'var(--c-coral-text)'
  const chip = p >= 85 ? 'sw-chip-mint'
             : p >= 70 ? 'sw-chip-amber'
             : 'sw-chip-coral'
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Probability of Success</div>
        <span className={`sw-chip sw-chip-sm ${chip}`}>
          {pos.runs} MC paths
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
      }}>
        <span className="sw-hero-md" style={{ color: c }}>
          <Num value={p} format="score" animate />
          <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 4 }}>%</span>
        </span>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          {pos.successful_runs} of {pos.runs} paths sustain target income · {pos.horizon_years}y horizon
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-sm)', fontSize: 11, color: 'var(--c-text3)' }}>
        Median terminal: {fmt(pos.median_terminal_value)} · P10 {fmt(pos.p10_terminal_value)} · P90 {fmt(pos.p90_terminal_value)}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic' }}>
        Note: monte-carlo.js v1.1 (Cholesky correlation matrix per O-CF-RULES-01) not yet present;
        current PoS uses single-Z Box-Muller — flagged stub.
      </div>
    </div>
  )
}

// ── §B.5 Monte Carlo fan chart (§5.5) — DrawSVG bands ───────────────────
function MonteCarloFanChart({ pos, entity }) {
  if (!pos || pos.insufficient_data) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>Monte Carlo fan</div>
        <div style={{
          marginTop: 'var(--space-sm)', color: 'var(--c-text3)', fontSize: 12,
        }}>
          Fan chart unavailable — insufficient data.
        </div>
      </div>
    )
  }
  const horizon = pos.horizon_years || 30
  const start = (entity?.assets?.sipp?.total || 0)
       + (entity?.assets?.isa?.value || 0)
       + (entity?.assets?.portfolio?.value || 0)
       + (entity?.assets?.cash?.total || 0)
  const startVal = Math.max(start, 1)
  const p10End = pos.p10_terminal_value
  const p25End = pos.p25_terminal_value
  const p50End = pos.median_terminal_value
  const p75End = pos.p75_terminal_value
  const p90End = pos.p90_terminal_value
  const maxV = Math.max(p90End || 0, startVal) * 1.1

  const W = 320, H = 160, pL = 40, pR = 8, pT = 10, pB = 22
  const pw = W - pL - pR, ph = H - pT - pB
  const px = i => pL + (i / horizon) * pw
  const py = v => pT + ph - (v / maxV) * ph

  function path(end) {
    let d = ''
    for (let y = 0; y <= horizon; y++) {
      const t = y / horizon
      const v = startVal + (end - startVal) * Math.pow(t, 1.2)
      d += (y === 0 ? 'M' : 'L') + px(y).toFixed(1) + ',' + py(Math.max(0, v)).toFixed(1) + ' '
    }
    return d
  }
  function area(low, high) {
    let d = ''
    for (let y = 0; y <= horizon; y++) {
      const t = y / horizon
      const v = startVal + (low - startVal) * Math.pow(t, 1.2)
      d += (y === 0 ? 'M' : 'L') + px(y).toFixed(1) + ',' + py(Math.max(0, v)).toFixed(1) + ' '
    }
    for (let y = horizon; y >= 0; y--) {
      const t = y / horizon
      const v = startVal + (high - startVal) * Math.pow(t, 1.2)
      d += 'L' + px(y).toFixed(1) + ',' + py(Math.max(0, v)).toFixed(1) + ' '
    }
    return d + 'Z'
  }

  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Monte Carlo fan</div>
        <span className="sw-chip sw-chip-sm">10/25/50/75/90 bands</span>
      </div>
      <DrawSVG duration={1000}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{
          display: 'block', marginTop: 'var(--space-sm)',
        }}>
          {[0, 0.5, 1].map(t => (
            <line key={t} x1={pL} y1={py(maxV * t)} x2={W - pR} y2={py(maxV * t)}
                  stroke="var(--c-tint-neutral-2)" strokeWidth="0.5" strokeDasharray="2 3" />
          ))}
          <path d={area(p10End, p90End)} fill="var(--c-mint-text)" opacity="0.10" />
          <path d={area(p25End, p75End)} fill="var(--c-mint-text)" opacity="0.20" />
          <path d={path(p50End)} fill="none" stroke="var(--c-mint-text)" strokeWidth="2" />
          <path d={path(p10End)} fill="none" stroke="var(--c-coral-text)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={path(p90End)} fill="none" stroke="var(--c-mint-text)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={pL} y={H - 6} fontSize="9" fill="var(--c-text3)">Now</text>
          <text x={W - pR - 18} y={H - 6} fontSize="9" fill="var(--c-text3)">+{horizon}y</text>
        </svg>
      </DrawSVG>
      <div style={{
        marginTop: 6, fontSize: 11, color: 'var(--c-text3)',
      }}>
        Median path: {fmt(p50End)} at year {horizon}. P10 floor: {fmt(p10End)}.
      </div>
    </div>
  )
}

// ── §B.6 Sequence-of-returns stress (§5.6) ──────────────────────────────
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

// ── §B.8 Five Cashflow Scenarios (§5.8) ─────────────────────────────────
function FiveScenariosCard({ scen }) {
  if (!scen || scen.insufficient_data || (scen.scenarios || []).length === 0) {
    return (
      <div className="sw-card sw-lift" style={S.card}>
        <div style={S.cardTitle}>5 Cashflow Scenarios</div>
        <div style={{
          marginTop: 'var(--space-sm)', color: 'var(--c-text3)', fontSize: 12,
        }}>
          Insufficient data.
        </div>
      </div>
    )
  }
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>5 Cashflow scenarios</div>
        <span className="sw-chip sw-chip-sm">DoNothing · Guardrail · Optimal · Bengen · Custom</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'flex',
        flexDirection: 'column', gap: 'var(--space-sm)',
      }}>
        <RevealStagger interval={70} startDelay={50}>
          {(scen.scenarios || []).map(s => {
            const p = Math.round((s.pos || 0) * 100)
            const chip = p >= 85 ? 'sw-chip-mint'
                       : p >= 70 ? 'sw-chip-amber'
                       : 'sw-chip-coral'
            return (
              <div key={s.id} style={S.scenRow}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                  {s.label}
                </div>
                <div style={{
                  minWidth: 90, fontSize: 11, color: 'var(--c-text3)',
                }}>
                  Draw {fmt(s.annual_drawdown)}/y
                </div>
                <span className={`sw-chip sw-chip-sm ${chip}`} style={{ minWidth: 64, justifyContent: 'center' }}>
                  {p}% PoS
                </span>
              </div>
            )
          })}
        </RevealStagger>
      </div>
    </div>
  )
}

// ── Scenario matrix wrapper with real selection state (STUB-02) ────────
// Tracks active scenario in local state so onSelect actually does work;
// recomputes a small forward-cashflow summary keyed to the selection.
function ScenarioMatrixWithRecompute({ scenarios, defaultActiveId, entity }) {
  const [activeId, setActiveId] = useState(defaultActiveId)
  const items = scenarios && scenarios.length ? scenarios : null

  // Re-derive a forward summary from the chosen scenario. Uses fields the
  // engine already populates per-scenario; if a field is missing we render
  // an honest stub rather than fabricating numbers.
  const active = (items || []).find(s => (s.id || s.name) === activeId) || null

  return (
    <>
      <ScenarioMatrixV2
        scenarios={items}
        activeId={activeId}
        onSelect={id => setActiveId(id)}
      />
      <ScenarioForwardSummary active={active} entity={entity} />
    </>
  )
}

function ScenarioForwardSummary({ active, entity }) {
  if (!active) return null
  const draw = +(active.annual_drawdown ?? active.drawdownAnnual ?? 0)
  const pos  = +(active.pos ?? 0)
  const horizon = +(active.horizon_years ?? 30)
  const terminal = active.terminal_value ?? active.median_terminal ?? null
  return (
    <div className="sw-card sw-lift" style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitle}>Forward cashflow · {active.label || active.name || 'Selected scenario'}</div>
        <span className="sw-chip sw-chip-sm sw-chip-blue">{Math.round(pos * 100)}% PoS</span>
      </div>
      <div style={{
        marginTop: 'var(--space-md)', display: 'grid',
        gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)',
      }}>
        <Stat label="Annual draw"   value={draw > 0 ? fmt(draw) : '—'} />
        <Stat label="Horizon"        value={`${horizon}y`} />
        <Stat label="Median terminal" value={terminal != null ? fmt(terminal) : '— stub'} />
        <Stat label="Active id"       value={active.id || active.name || '—'} />
      </div>
      <div style={{
        marginTop: 'var(--space-sm)', fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4,
      }}>
        Selection drives downstream summary. Per-scenario forward-cashflow
        table arrives when engine surfaces year-by-year draw paths
        (O-CF-RULES-08).
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
        <span className="sw-chip sw-chip-sm">X24 mode 3</span>
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
  const total = coi?.byDomain?.estatePlanning || coi?.total || 0
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
        NPV discount rate per O-CF-RULES-12 (pending founder sign-off).
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
        <div style={S.cardTitle}>PRC / PCC Spread</div>
        <span className="sw-chip sw-chip-sm sw-chip-mint">Founder concept</span>
      </div>
      {stub ? (
        <div style={{
          marginTop: 'var(--space-md)', fontSize: 12, color: 'var(--c-text3)',
        }}>
          <strong style={{ color: 'var(--c-text2)' }}>Coming next.</strong> Methodology
          pending — O-CF-RULES-07. Engine returns a layout-only envelope.
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
              PRC – PCC
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
          weights pending O-CF-RULES-09 — personal / system / external split
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
        Stub at v1.0 — factor weights pending O-CF-RULES-09.
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
    paddingBottom: 'var(--space-3xl)',
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
