// ─────────────────────────────────────────────────────────────────────────────
// TaxEstate.jsx — Tax & Estate tab (full rebuild, spec v1.6)
// Spec: 2-Product/2-Product-tax-estate-v1_6.md
//
// Sub-tabs: Tax | Estate (segmented control, §2.5).
// Persisted: localStorage `sonuswealth.te.subTab`.
//
// Engine: canonical facade in `../engine/fq-calculator.js`. Tax-estate-engine
// re-exports under `te_*` aliases for any name clashes.
//
// Author: refactor 2026-05-10. Replaces 579-line legacy file.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useRef } from 'react'
import DecisionDrawers from '../components/Decisions/DecisionDrawers.jsx'
// S1 selector migration (Phase 2)
import {
  netWorth,
  fq as calcFQ,
  ani as calcANI,
} from '../engine/selectors/index.js'
import {
  // basics
  fmt, daysLeft, calcAge, lifeStageFor, TAX, guardrail,
  calcRisk, fqBand, riskBand,
  // legacy IHT (still used as a robust fallback for ihtDynamic-shape data)
  ihtDynamic,
  // tax sub-tab (calcANI migrated above)
  calcAllIncome, calcDividendTax, calcPersonalAllowance,
  welshIncomeTax, scottishIncomeTax,
  allowanceTracker, drawdownMatrix,
  figStatus, trfStatus,
  // tax-estate-engine via canonical facade (te_ aliased)
  te_taxThisYear, te_incomeTaxDetail, te_nicsDetail, te_cgtDetail,
  te_dividendTaxDetail, te_ihtExposure, te_selfAssessment,
  // estate sub-tab
  ihtWaterfall, giftClockProjection,
  trustPeriodicCharge, willLpaStatus, intestacyDistribution, noWillCoI,
  rnrbTaper, rnrbEligibility,
  bprQualifyingValue, bprAprAllowance, aprQualification,
  nominationStatus,
  // plan / staleness / coi
  planFor, planStaleness, totalCoI,
} from '../engine/fq-calculator.js'

import { BRAND } from '../config/brand.js'
import {
  TripleAnchor, X28TopBar,
  RevealCard, CoIOdometer, ProvenanceChip, PlanStalenessBanner,
  ExplainerChip, DiffBadge, DeltaChip,
  BeneficiarySankey,
  Num, FadeInOnMount, RevealStagger, DrawSVG,
} from '../components/shared/index.js'
import { useCascadeTrigger, useCounterAnimation, useInView } from '../hooks/useAnimation.jsx'
import InheritanceStory from '../components/TaxEstate/InheritanceStory.jsx'
// S1 selector migration: canonical IHT projection via facade.
import { ihtProjection } from '../engine/selectors/index.js'

// ── v0.3 Phase 5 R4 imports ─────────────────────────────────────────────────
// Spec: 0-Active/route-specs/route-4-tax-estate.md §3 — signature is the
// IHT pre/post-April-2027 delta card at position 2 (above all allowance bars).
import IHTDeltaCard from '../components/charts/IHTDeltaCard.jsx'
import {
  TaperedAATile,
  CohabIHTCliffTile,
  TransferableNRBTile,
  LandlordS24Tile,
  DrawdownMethodsTeaser,
  RentARoomTile,
  EISVCTClockTile,
  NormalExpenditureTile,
  AnnualGiftExemptionTile,
  SmallGiftsTile,
  WeddingGiftsTile,
  RNRBTaperTile,
  BPRCapTile,
} from '../components/MyMoney/PersonaGapTiles.jsx'
import {
  effectiveAA,
  carryForwardByYear,
  holdingClock,
} from '../engine/persona-helpers.js'
// S1 selector migration: canonical IHT delta source for R4 signature card.
import { ihtDeltaPrePost2027 } from '../engine/selectors/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const SUBTAB_KEY = 'sonuswealth.te.subTab'

const PENSION_IHT_DATE = new Date('2027-04-06')

function safe(fn, fallback = null) {
  try { return fn() } catch { return fallback }
}

function pct(n, d = 0) {
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(d)}%`
}

function fmtPct(n, digits = 1) {
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}

function isNRI(entity) { return entity?.type === 'nri' }

// F-CAT-02: BPR/APR card eligibility — detect non-zero EIS/SEIS/VCT/business
// holdings so the card surfaces from day 1 (the 2-year BPR clock starts on
// purchase, not at decumulation).
function hasBPREligibleHoldings(entity) {
  if (!entity) return false
  const a = entity.assets || {}
  const ba = Array.isArray(a.business_assets) ? a.business_assets : []
  if (ba.some(b => (b?.value || 0) > 0)) return true
  const holdings = a.portfolio?.holdings || []
  if (Array.isArray(holdings) && holdings.some(h => {
    const id = String(h?.id || h?.code || h?.scheme || '').toLowerCase()
    const tag = String(h?.type || h?.wrapper || '').toLowerCase()
    if ((h?.value || 0) <= 0) return false
    return id.startsWith('eis-') || id.startsWith('seis-') || id.startsWith('vct-')
        || tag === 'eis' || tag === 'seis' || tag === 'vct'
  })) return true
  // Also detect named EIS/SEIS/VCT wrappers at assets root
  for (const k of ['eis', 'seis', 'vct']) {
    const v = a[k]
    if (Array.isArray(v) && v.some(x => (x?.value || 0) > 0)) return true
    if (v && typeof v === 'object' && (v.value || v.total || 0) > 0) return true
  }
  return false
}

// Map numeric/textual lifeStage onto the string keys the spec uses.
function lifeStageString(entity) {
  // explicit string takes precedence
  if (typeof entity?.lifeStage === 'string') return entity.lifeStage
  const stage = (typeof entity?.lifeStage === 'number')
    ? entity.lifeStage
    : (() => { const a = calcAge(entity?.dob); return Number.isFinite(a) ? lifeStageFor(a).stage : 1 })()
  if (stage <= 1) return 'foundation'
  if (stage === 2) return 'accumulation'
  if (stage === 3) return 'consolidation'
  if (stage === 4) return 'preretirement'   // Transition (55–65)
  if (stage === 5) return 'decumulation'
  if (stage === 6) return 'preservation'
  return 'legacy'
}

// Derive entity persisted previous-snapshot for X29 diff layer.
// We persist last-seen totals to localStorage so a user revisiting sees
// DiffBadge / DeltaChip on changed numbers.
function readSnapshot(entityId) {
  try { return JSON.parse(localStorage.getItem(`sonuswealth.te.snapshot.${entityId || 'anon'}`) || 'null') } catch { return null }
}
function writeSnapshot(entityId, snap) {
  try { localStorage.setItem(`sonuswealth.te.snapshot.${entityId || 'anon'}`, JSON.stringify({ ...snap, ts: Date.now() })) } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ children, tone = 'neutral', title, size = 'sm', pulse = false, outline = false }) {
  // Map tone → sw-chip palette class
  const toneClass = {
    neutral: '',
    good:    'sw-chip-mint',
    warn:    'sw-chip-amber',
    bad:     'sw-chip-coral',
    info:    'sw-chip-blue',
    gold:    'sw-chip-amber',
  }[tone] || ''
  const sizeClass = size === 'sm' ? 'sw-chip-sm' : size === 'lg' ? 'sw-chip-lg' : ''
  const cls = [
    'sw-chip', toneClass, sizeClass,
    outline && 'sw-chip-outline',
    pulse && 'sw-pulse-glow',
  ].filter(Boolean).join(' ')
  return (
    <span title={title} className={cls}>{children}</span>
  )
}

function StatTile({ label, value, sub, colour, accessory }) {
  return (
    <div style={{
      background: 'var(--c-surface2)',
      borderRadius: 'var(--r-md)',
      padding: 'var(--space-md)',
    }}>
      <div className="sw-eyebrow" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4,
      }}>
        <span>{label}</span>
        {accessory}
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700,
        color: colour || 'var(--c-text)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: -0.2,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function GaugeBar({ pct, colour = 'var(--c-acc)', height = 8, bg = 'rgba(255,255,255,0.07)', delay = 0 }) {
  const safe = Math.max(0, Math.min(100, +pct || 0))
  // Animate from 0 → safe on mount via internal state
  const ref = useRef(null)
  const inView = useInView(ref, { rootMargin: '0px 0px -10% 0px' })
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!inView) return
    const id = setTimeout(() => setW(safe), 50 + delay)
    return () => clearTimeout(id)
  }, [inView, safe, delay])
  return (
    <div ref={ref} className="sw-bar" style={{ height, background: bg }}>
      <div className="fill" style={{
        width: `${w}%`,
        background: colour,
        transition: 'width var(--dur-slow, 600ms) var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
      }} />
    </div>
  )
}

function SectionHead({ title, sub, accessory }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 8, marginBottom: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {accessory}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab segmented control (§2.5)
// ─────────────────────────────────────────────────────────────────────────────

function SubTabSelector({ value, onChange, taxBadge, estateBadge }) {
  const tabs = [
    { id: 'tax',    label: 'Tax',    badge: taxBadge },
    { id: 'estate', label: 'Estate', badge: estateBadge },
  ]
  const activeIdx = Math.max(0, tabs.findIndex(t => t.id === value))
  return (
    <div role="tablist" style={{
      position: 'relative',
      display: 'inline-flex',
      background: 'var(--c-surface2)',
      borderRadius: 'var(--r-pill)',
      border: '1px solid var(--c-border)',
      padding: 3,
      gap: 0,
      margin: '4px 16px 12px',
    }}>
      {/* Sliding indicator */}
      <span aria-hidden="true" style={{
        position: 'absolute',
        top: 3,
        bottom: 3,
        left: `calc(3px + ${activeIdx} * 50%)`,
        width: 'calc(50% - 3px)',
        background: 'var(--c-acc)',
        borderRadius: 'var(--r-pill)',
        transition: 'left var(--dur-normal, 350ms) var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
        boxShadow: '0 2px 8px rgba(0,229,168,0.25)',
        zIndex: 0,
      }} />
      {tabs.map(t => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="sw-press"
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '7px 22px',
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--c-bg)' : 'var(--c-text2)',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'color var(--dur-normal, 350ms) var(--ease-out-cubic, cubic-bezier(0.33,1,0.68,1))',
              minWidth: 96,
              justifyContent: 'center',
            }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: active ? 'rgba(0,0,0,.18)' : 'var(--c-tint-mint-2)',
                color: active ? 'var(--c-bg)' : 'var(--c-mint-text)',
                borderRadius: 'var(--r-pill)', padding: '1px 6px',
                minWidth: 18, textAlign: 'center',
                transition: 'background var(--dur-fast,200ms), color var(--dur-fast,200ms)',
              }}>{t.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// D-ANCHOR-2 sub-anchor strip (§2.8) — three quick read-outs below TripleAnchor
// ─────────────────────────────────────────────────────────────────────────────

function SubAnchorStrip({ a, b, c }) {
  const cell = (cell, i) => {
    const interactive = typeof cell.onTap === 'function'
    const Wrap = interactive ? 'button' : 'div'
    const wrapProps = interactive
      ? {
          type: 'button',
          onClick: cell.onTap,
          'aria-label': `${cell.label} ${cell.value}`,
        }
      : {}
    return (
      <Wrap
        key={cell.label}
        className={`sw-lift${interactive ? ' sw-press' : ''}`}
        {...wrapProps}
        style={{
          flex: 1, background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-lg)', padding: 'var(--space-md)',
          animationDelay: `${i * 60}ms`,
          cursor: interactive ? 'pointer' : 'default',
          textAlign: 'left', font: 'inherit', color: 'inherit',
          width: interactive ? '100%' : undefined,
        }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{cell.label}</span>
          {cell.eyebrowAccessory}
        </div>
        <div
          data-tieout={cell.tieout || undefined}
          data-tieout-raw={cell.tieoutRaw != null ? String(cell.tieoutRaw) : undefined}
          style={{
          fontSize: 16, fontWeight: 700,
          color: cell.colour || 'var(--c-text)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
        }}>
          {cell.value}
        </div>
        {cell.sub && (
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{cell.sub}</div>
        )}
        {cell.statusChip && (
          <div style={{ marginTop: 4 }}>{cell.statusChip}</div>
        )}
      </Wrap>
    )
  }
  return (
    <RevealStagger interval={60} style={{
      display: 'flex', gap: 'var(--space-sm)',
      padding: '0 16px',
      marginBottom: 10,
    }}>
      {[a, b, c].filter(Boolean).map(cell)}
    </RevealStagger>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NRI notice
// ─────────────────────────────────────────────────────────────────────────────

function NRINotice() {
  return (
    <div style={{
      margin: '0 16px 12px',
      background: 'rgba(77,142,255,.07)',
      border: '1px solid rgba(77,142,255,.25)',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--c-accent)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
      }}>NRI / Cross-border view</div>
      <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.6 }}>
        Showing UK calculations for your UK-resident position. Indian-specific
        features (NPS, LTCG, NRE/NRO, DTAA optimisation) come in the India bundle.
        Your SIPP and UK estate are calculated correctly below.
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAX SUB-TAB
// ═════════════════════════════════════════════════════════════════════════════

// §5.3 + §5.4 — tax summary tile + this-year breakdown
function TaxSummary({ entity }) {
  const txY = safe(() => te_taxThisYear(entity), null)
  const ani = safe(() => calcANI(entity), { ani: 0 })
  const allInc = safe(() => calcAllIncome(entity), { total: 0, byType: {} })
  const grossInc = txY?.gross || allInc?.total || 0
  const totalTax = txY?.total_tax || 0
  const components = txY?.components || {}
  const effRate = txY?.effective_rate || 0

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="This year — tax position"
        sub={`Gross ${fmt(grossInc)} · ANI ${fmt(ani.ani)} · Effective rate ${fmtPct(effRate)}`}
        accessory={<ProvenanceChip sources={['HMRC bands UK-2026.1', 'entity.income', 'entity.assets.portfolio']} />}
      />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        <StatTile
          label="Income tax (YTD)"
          value={fmt(components.income_tax || 0)}
          colour="var(--c-warning)"
        />
        <StatTile
          label="Dividend tax"
          value={fmt(components.dividend_tax || 0)}
          colour="var(--c-warning)"
        />
        <StatTile
          label="CGT"
          value={fmt(components.cgt || 0)}
          colour="var(--c-danger)"
        />
        <StatTile
          label="NIC"
          value={fmt(components.nics || 0)}
          colour="var(--c-accent)"
        />
      </div>
      <div style={{
        marginTop: 10,
        padding: '8px 12px',
        background: 'rgba(255,59,48,.06)',
        border: '1px solid rgba(255,59,48,.20)',
        borderRadius: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>Total tax this year</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-danger)' }}>{fmt(totalTax)}</span>
      </div>
    </div>
  )
}

// §5.5 — Income tax detail w/ stepped marginal-rate chart + 60% taper flag (§5.5.2)
function IncomeTaxDetail({ entity }) {
  const itd = safe(() => te_incomeTaxDetail(entity), null)
  if (!itd) return null
  const ani = safe(() => calcANI(entity).ani, 0)
  const sco = safe(() => scottishIncomeTax(entity), { applies: false, bands: [] })
  const wel = safe(() => welshIncomeTax(entity), { applies: false })

  // 60% taper window — thresholds hardcoded as TAX does not export paTaperStart/paTaperEnd.
  // Resolved 2026-06-02 (P2): PA taper band now reads TAX.adjustedNetIncomeCliff (start) and TAX.art (end).
  const inTaper = ani >= TAX.adjustedNetIncomeCliff && ani <= TAX.art

  // Build a simple rate-chart from bands
  const bands = itd.bands || []
  const maxTax = bands.reduce((m, b) => Math.max(m, b.tax || 0), 1)

  const displayBands = (sco.applies ? sco.bands : bands)

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Income tax detail"
        sub={`Marginal ${fmtPct(itd.marginal_rate)} · ${
          sco.applies ? 'Scottish bands' : wel.applies ? 'Welsh (rUK rates)' : 'rest-of-UK bands'
        }`}
        accessory={<ExplainerChip id="TE-1" />}
      />

      {inTaper && (
        <FadeInOnMount style={{
          margin: '0 0 var(--space-md)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'var(--c-tint-amber)',
          border: '1px solid rgba(255,179,71,.35)',
          borderRadius: 'var(--r-md)',
          fontSize: 12, color: 'var(--c-amber-text)', lineHeight: 1.4,
        }}>
          <strong>60% effective rate band</strong> · ANI is in the £100k–£125,140 PA taper.
          Each £1 of income loses 50p of personal allowance — effective marginal 60%.
        </FadeInOnMount>
      )}

      {/* Stepped vertical-bar chart */}
      <SteppedBandsChart bands={displayBands} maxTax={maxTax} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-md)' }}>
        {displayBands.map((b, i) => {
          const rate = b.rate ?? 0
          const amount = b.tax ?? b.amount ?? 0
          const w = Math.round((amount / maxTax) * 100)
          const label = b.name || b.type || `Band ${i + 1}`
          return (
            <div key={i} style={{ fontSize: 12 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: 3,
              }}>
                <span style={{ color: 'var(--c-text2)' }}>
                  {String(label).replace(/_/g, ' ')} · {fmtPct(rate)}
                </span>
                <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(amount)}
                </span>
              </div>
              <GaugeBar pct={w} colour={'linear-gradient(90deg, var(--c-accent), var(--c-success))'} height={5} delay={i * 60} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Stepped marginal-rate vertical bars — animate from 0 → height via scaleY
function SteppedBandsChart({ bands, maxTax }) {
  const ref = useRef(null)
  const inView = useInView(ref, { rootMargin: '0px 0px -10% 0px' })
  if (!bands?.length) return null
  return (
    <div ref={ref} style={{
      display: 'flex', alignItems: 'flex-end', gap: 6,
      height: 90, padding: '6px 0',
      borderBottom: '1px solid var(--c-sep)',
    }}>
      {bands.map((b, i) => {
        const amount = b.tax ?? b.amount ?? 0
        const h = Math.max(2, Math.round((amount / maxTax) * 80))
        const rate = b.rate ?? 0
        const colour = rate >= 0.45 ? 'var(--c-danger)' : rate >= 0.40 ? 'var(--c-warning)' : rate >= 0.20 ? 'var(--c-accent)' : 'var(--c-success)'
        return (
          <div key={i} style={{
            flex: 1,
            height: h,
            background: colour,
            borderRadius: '4px 4px 0 0',
            transformOrigin: 'bottom',
            transform: inView ? 'scaleY(1)' : 'scaleY(0)',
            transition: `transform 600ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1)) ${i * 70}ms`,
            opacity: inView ? 1 : 0,
          }} title={`${fmtPct(rate)} · ${fmt(amount)}`} />
        )
      })}
    </div>
  )
}

// §5.5.3 — ANI 6-step computation (UK-IT-19)
function ANIStepwise({ entity }) {
  const aniRes = safe(() => calcANI(entity), null)
  if (!aniRes) return null
  const s = aniRes.steps || {}
  const rows = [
    { n: 1, label: 'Total taxable income', value: fmt(s.total || 0) },
    { n: 2, label: 'Add: grossed-up gift aid (×1.25)', value: fmt(s.grossedUpGiftAid || 0) },
    { n: 3, label: 'Less: pension contributions', value: `−${fmt(s.pensionContribs || 0)}` },
    { n: 4, label: 'Less: trade losses', value: `−${fmt(s.tradeLosses || 0)}` },
    { n: 5, label: 'Less: qualifying interest paid', value: `−${fmt(s.interestPaid || 0)}` },
    { n: 6, label: 'Adjusted Net Income', value: fmt(aniRes.ani || 0), bold: true },
  ]
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Adjusted Net Income (ANI)"
        sub="6-step stepwise computation — UK-IT-19"
      />
      <RevealStagger interval={50} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.n} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: r.bold ? 'var(--c-tint-mint)' : 'var(--c-surface2)',
            border: r.bold ? '1px solid rgba(0,229,168,.30)' : '1px solid transparent',
            borderRadius: 'var(--r-md)',
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--c-surface)',
              fontSize: 11, fontWeight: 800, color: 'var(--c-text2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>{r.n}</span>
            <span style={{
              flex: 1, fontSize: 12, color: 'var(--c-text2)',
            }}>{r.label}</span>
            <span style={{
              fontSize: r.bold ? 15 : 13, fontWeight: r.bold ? 800 : 700,
              color: r.bold ? 'var(--c-mint-text)' : 'var(--c-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{r.value}</span>
          </div>
        ))}
      </RevealStagger>
    </div>
  )
}

// §5.6 — Salary sacrifice optimiser + 2029 NIC cap horizon
function SalarySacrifice({ entity }) {
  const baseSalary = entity?.income?.salary || 0
  const [sac, setSac] = useState(0)
  const nic = safe(() => te_nicsDetail(entity, sac), null)
  if (!baseSalary || !nic) return null
  const horizon = nic.salary_sacrifice_cap_horizon || {}
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Salary sacrifice optimiser"
        sub={`NIC saving today: ${fmt(nic.salary_sacrifice_saving_nic || 0)} / year`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>Sacrifice amount</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{fmt(sac)}</span>
      </div>
      <input
        type="range" min={0} max={Math.min(60000, baseSalary)} step={500}
        value={sac}
        onChange={e => setSac(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--c-acc)' }}
      />
      {horizon.show_horizon_warning && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          background: 'rgba(255,179,71,.08)',
          border: '1px solid rgba(255,179,71,.30)',
          borderRadius: 10,
          fontSize: 12, color: 'var(--c-warning)', lineHeight: 1.5,
        }}>
          <strong>2029 NIC cap horizon</strong> · From {horizon.effective_date} the NIC saving
          on salary sacrifice will be capped at {fmt(horizon.cap_amount_per_year)}/yr.
          Contributions made before the cap takes effect keep today's NIC treatment.
        </div>
      )}
    </div>
  )
}

// §5.7 — CGT detail + BADR + Bed-and-ISA
function CGTDetail({ entity }) {
  const holdings = entity?.assets?.portfolio?.holdings || []
  const cgt = safe(() => te_cgtDetail(entity, holdings), null)
  if (!cgt) return null
  const exempt = cgt.annual_exemption || { total: 0, used: 0, remaining: 0 }
  const exemptPct = exempt.total > 0 ? Math.round((exempt.used / exempt.total) * 100) : 0
  const badrFlagged = (cgt.realised || []).some(r => /badr/i.test(JSON.stringify(r)))
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Capital Gains Tax" sub={`Realised ${fmt(cgt.total_gain || 0)} this year`} />
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text3)' }}>Annual exemption</span>
          <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
            {fmt(exempt.used)} / {fmt(exempt.total)}
          </span>
        </div>
        <GaugeBar pct={exemptPct} colour="var(--c-warning)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Tax due" value={fmt(cgt.tax_due || 0)} colour="var(--c-danger)" />
        <StatTile label="Carry-forward losses" value={fmt(cgt.carry_forward_losses || 0)} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {badrFlagged && <Chip tone="warn">BADR 14% → 18% in 2026/27</Chip>}
        {(cgt.pending || []).some(p => p.bed_and_isa_opportunity) && (
          <Chip tone="info">Bed-and-ISA opportunity</Chip>
        )}
        {cgt.spousal_transfer_opportunity && (
          <Chip tone="info">Spousal transfer headroom</Chip>
        )}
      </div>
    </div>
  )
}

// §5.8 — Dividend detail
function DividendDetail({ entity }) {
  const holdings = entity?.assets?.portfolio?.holdings || []
  const div = safe(() => te_dividendTaxDetail(entity, holdings), null)
  if (!div) return null
  const allowance = div.allowance || { total: 500, used: 0, remaining: 500 }
  const aPct = allowance.total > 0 ? Math.round((allowance.used / allowance.total) * 100) : 0
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Dividend tax" sub={`Effective rate ${fmtPct(div.effective_rate || 0)} on £${(div.gia_exposed || 0).toLocaleString()} GIA`} />
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text3)' }}>Dividend allowance</span>
          <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
            {fmt(allowance.used)} / {fmt(allowance.total)}
          </span>
        </div>
        <GaugeBar pct={aPct} colour="var(--c-warning)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, fontSize: 12 }}>
        <Chip tone="neutral">Basic {+(TAX.dividendBR * 100).toFixed(2)}%</Chip>
        <Chip tone="warn">Higher {+(TAX.dividendHR * 100).toFixed(2)}%</Chip>
        <Chip tone="bad">Add'l {+(TAX.dividendAR * 100).toFixed(2)}%</Chip>
      </div>
      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between',
        padding: '8px 10px', borderRadius: 10, background: 'var(--c-surface2)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>Tax paid</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-danger)' }}>{fmt(div.tax_paid || 0)}</span>
      </div>
      {div.move_to_isa_opportunity?.tax_saving_annual > 0 && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(0,229,168,.06)',
          border: '1px solid rgba(0,229,168,.25)',
          borderRadius: 10, fontSize: 12, color: 'var(--c-success)',
        }}>
          Held in an ISA, the dividend tax on this amount — about {fmt(div.move_to_isa_opportunity.tax_saving_annual)}/year —
          would not apply (ISA headroom {fmt(div.move_to_isa_opportunity.isa_headroom)}).
        </div>
      )}
    </div>
  )
}

// §5.9 — Allowances strip
function AllowancesStrip({ entity }) {
  const at = safe(() => allowanceTracker(entity), null)
  if (!at) return null
  const items = [
    { id: 'isa',       label: 'ISA',       d: at.isa },
    { id: 'psa',       label: 'PSA',       d: at.psa },
    { id: 'cgt',       label: 'CGT',       d: at.cgt },
    { id: 'dividend',  label: 'Dividend',  d: at.dividend },
    { id: 'pa',        label: 'Pers. Allow', d: at.pa },
  ].filter(x => x.d)
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Allowance utilisation" sub={`Composite ${at.utilization || 0}%`} />
      <RevealStagger interval={50} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {items.map(({ id, label, d }, i) => {
          const pctv = d.pctUsed ?? (d.limit ? Math.round((d.used || 0) / d.limit * 100) : 0)
          // Semantic colour: under-utilised (mint) is "good", high (amber/coral) is approaching cap
          const barColour = pctv >= 95 ? 'var(--c-danger)' : pctv >= 75 ? 'var(--c-warning)' : 'var(--c-success)'
          return (
            <div key={id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--c-text3)' }}>{label}</span>
                <span style={{ color: 'var(--c-text2)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {d.limit != null
                    ? `${fmt(d.used || 0)} / ${fmt(d.limit || 0)}`
                    : `${pctv}%`}
                </span>
              </div>
              <GaugeBar pct={pctv} colour={barColour} delay={i * 50} />
            </div>
          )
        })}
      </RevealStagger>
      {/* Cash-ISA £12k cap horizon */}
      <div style={{
        marginTop: 10, padding: '8px 10px',
        background: 'rgba(255,179,71,.07)',
        border: '1px solid rgba(255,179,71,.30)',
        borderRadius: 10,
        fontSize: 12, color: 'var(--c-warning)', lineHeight: 1.5,
      }}>
        <strong>Cash-ISA £12k cap horizon</strong> · From 6 Apr 2027 the cash-ISA
        sub-allowance falls to £12,000 for under-65s; the residual £8,000 must go to
        S&S, IFISA, or LISA.
      </div>
    </div>
  )
}

// §5.10 — Self Assessment + SA100 deadline
function SelfAssessment({ entity }) {
  const sa = safe(() => te_selfAssessment(entity), null)
  if (!sa) return null
  const deadline = sa.online_filing_deadline || sa.deadline || '2027-01-31'
  const due = sa.balance_due || sa.amount_due || 0
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Self Assessment" sub={`SA100 deadline: ${deadline}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatTile label="Balance due" value={fmt(due)} colour={due > 0 ? 'var(--c-danger)' : 'var(--c-text)'} />
        <StatTile label="Filing required?" value={sa.required ? 'Yes' : 'No'} sub={sa.reason || ''} />
      </div>
    </div>
  )
}

// §5.11 — Drawdown matrix (Q2.2)
function DrawdownMatrix({ entity }) {
  const ddm = safe(() => drawdownMatrix(entity), null)
  if (!ddm || !Array.isArray(ddm.rows) || ddm.rows.length === 0) return null
  const guard = safe(() => Math.round(guardrail(entity) || 0), 0)
  // Determine current drawdown row
  const currentDD = entity?.drawdown || 0
  // Max net for visual bar comparison
  const maxNet = Math.max(1, ...ddm.rows.map(r => r.net || 0))
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Drawdown matrix"
        sub={`Recommended ${fmt(ddm.recommended || 0)}/yr${guard ? ` · Guardrail ${fmt(guard)}` : ''}`}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr',
          gap: 6, padding: '6px 8px',
          position: 'sticky', top: 0, background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-sep)',
          zIndex: 1,
        }} className="sw-eyebrow">
          <span>Drawdown</span>
          <span>Tax</span>
          <span>Net</span>
          <span>IHT saved</span>
        </div>
        <RevealStagger interval={40} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ddm.rows.map((r, i) => {
            const isCurrent = currentDD && Math.abs(r.drawdown - currentDD) < 2500
            const inDepth = r.drawdown >= TAX.adjustedNetIncomeCliff && r.drawdown <= TAX.art
            const isRecommended = r.drawdown === ddm.recommended
            const netPct = Math.round(((r.net || 0) / maxNet) * 100)
            const rowCls = isCurrent ? 'sw-pulse-glow' : ''
            return (
              <div key={i} className={rowCls} style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 1fr 1fr',
                gap: 6, alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 'var(--r-md)',
                border: isCurrent ? '1px solid var(--c-warning)' : '1px solid transparent',
                background: isRecommended
                  ? 'var(--c-tint-mint)'
                  : inDepth
                    ? 'var(--c-tint-coral)'
                    : isCurrent
                      ? 'rgba(255,210,122,.06)'
                      : 'transparent',
                fontSize: 12,
                transition: 'background var(--dur-normal,350ms)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.drawdown)}
                </span>
                <span style={{ color: 'var(--c-text2)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.tax)}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--c-success)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.net)}</span>
                  <span className="sw-bar" style={{ height: 3 }}>
                    <span className="fill" style={{ width: `${netPct}%`, background: 'var(--c-success)' }} />
                  </span>
                </span>
                <span style={{ color: 'var(--c-accent)', display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r.ihtSaved || 0)}
                  {inDepth && <Chip tone="bad" pulse title="60% effective rate band">60%</Chip>}
                </span>
              </div>
            )
          })}
        </RevealStagger>
      </div>
    </div>
  )
}
// §5.12 — Non-Dom (FIG/TRF) card
function NonDomCard({ entity }) {
  const fig = safe(() => figStatus(entity), null)
  const trf = safe(() => trfStatus(entity), null)
  if (!fig && !trf) return null
  const showFig = fig && fig.eligible
  const showTrf = trf && trf.eligible
  if (!showFig && !showTrf) return null
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Non-Dom regime (FIG / TRF)" sub="2025 reform — 4-year FIG window + TRF rate ladder" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {showFig && (
          <div style={{ padding: '10px 12px', background: 'var(--c-surface2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              FIG (Foreign Income & Gains)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{fig.status}</div>
            {fig.yearsRemaining != null && (
              <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>
                {fig.yearsRemaining} year(s) remaining in FIG window
              </div>
            )}
          </div>
        )}
        {showTrf && (
          <div style={{ padding: '10px 12px', background: 'var(--c-surface2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              TRF (Temporary Repatriation Facility)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
              Rate {fmtPct(trf.currentRate)} · deadline {trf.deadline}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ESTATE SUB-TAB
// ═════════════════════════════════════════════════════════════════════════════

// §6.4 — Dual-number IHT exposure (Today vs After 6 Apr 2027)
function IHTDualNumber({ entity }) {
  // Use canonical te_ihtExposure (signature: entity, bundle, scenario).
  // To produce "Today" vs "After 6 Apr 2027" we model the post-pension regime
  // by toggling assets.protection (no-op) and using ihtDynamic for the
  // pre-2027 view (sipp not in estate) plus ihtExposure (post-2027 already in).
  const today = new Date()
  const isPostPension = today >= PENSION_IHT_DATE

  // Today = current rules (pension may or may not be in estate based on 'today')
  const exposureToday = safe(() => te_ihtExposure(entity), null)

  // After 2027: force isPostPension by modelling. te_ihtExposure already
  // computes against today's date; if today < 6-Apr-2027 we approximate the
  // 2027 view by using ihtDynamic with includeSipp=true (pension in estate).
  // After 2027: use the same te_ihtExposure code path as IHTDrillPanel so both
  // tiles always agree. scenario.postPension=true forces SIPP into the estate
  // regardless of today's date (engine patch in tax-estate-engine.js §8.9).
  const after2027 = isPostPension
    ? exposureToday
    : safe(() => te_ihtExposure(entity, 'UK-2026.1', { postPension: true }), null)

  if (!exposureToday || !after2027) return null

  const todayConfirmed = exposureToday.reliefs?.apr_bpr?.allowance_used > 0
  const afterConfirmed = after2027.reliefs?.apr_bpr?.allowance_used > 0

  const rows = [
    { key: 'today', label: 'Today', exp: exposureToday, confirmed: todayConfirmed, note: isPostPension ? 'Post-2027 rules apply' : 'Pre-2027 (pension outside estate)' },
    { key: 'after', label: 'After 6 Apr 2027', exp: after2027, confirmed: afterConfirmed, note: 'Pension in estate' },
  ]

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="IHT exposure — dual view"
        sub="Side-by-side: today vs after 6 April 2027 rule change"
        accessory={<ExplainerChip id="TE-1" />}
      />
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)',
      }}>
        {rows.map((r, i) => (
          <FadeInOnMount
            key={r.key}
            delay={i * 80}
            className={`sw-lift ${r.key === 'after' ? 'sw-pulse-glow' : ''}`}
            style={{
              background: r.key === 'after' ? 'var(--c-tint-coral)' : 'var(--c-surface2)',
              border: r.key === 'after' ? '1px solid rgba(255,59,48,.30)' : '1px solid var(--c-border)',
              borderRadius: 'var(--r-lg)',
              padding: 'var(--space-lg)',
              boxShadow: r.key === 'after' ? 'var(--shadow-card-md)' : 'var(--shadow-card-sm)',
            }}
          >
            <div className="sw-eyebrow" style={{
              color: r.key === 'after' ? 'var(--c-coral-text)' : 'var(--c-text3)',
              marginBottom: 6,
            }}>{r.label}</div>
            <Num
              value={r.exp.iht_due || 0}
              format="currency"
              animate
              style={{
                fontSize: 30, fontWeight: 900,
                color: r.key === 'after' ? 'var(--c-danger)' : 'var(--c-text)',
                letterSpacing: -1, lineHeight: 1.05,
                display: 'block',
              }}
            />
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
              Effective {fmtPct(r.exp.effective_iht_rate || 0)} · Family receives {fmt(r.exp.beneficiary_value || 0)}
            </div>
            {r.confirmed && (
              <div style={{ marginTop: 6 }}>
                <Chip tone="good">Confirmed reliefs ✓</Chip>
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, fontStyle: 'italic' }}>
              {r.note}
            </div>
          </FadeInOnMount>
        ))}
      </div>

      {/* Estate-vs-thresholds gauge */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text3)' }}>
            Net estate vs NRB+RNRB ({fmt((exposureToday.nrb?.available || 0) + (exposureToday.rnrb?.available || 0))})
          </span>
          <span style={{ color: 'var(--c-text2)', fontWeight: 600 }}>
            {fmt(exposureToday.net_estate || 0)}
          </span>
        </div>
        <GaugeBar
          pct={Math.min(100, ((exposureToday.net_estate || 0) /
                              Math.max(1, (exposureToday.nrb?.available || 0) + (exposureToday.rnrb?.available || 0))) * 100)}
          colour="linear-gradient(90deg, var(--c-success), var(--c-warning), var(--c-danger))"
          height={10}
        />
      </div>
    </div>
  )
}

// §6.5 — IHT waterfall + multi-slider
// Sliders map to engine delta keys:
//   sippDraw  → drawdown_per_year  (annual SIPP drawdown; engine multiplies ×20)
//   gift      → gift_amount        (one-off gift / PET)
//   bpr       → apr_bpr_allowance_claimed (BPR/APR relief claimed)
function IHTWaterfall({ entity }) {
  // P0-4 (2026-05-27): seed gift slider from entity's actual declared PETs.
  // Before this fix, the slider always opened at £0 and a user with £500k in
  // trust gifts saw no surface for them — the engine knew, the UI hid it.
  const declaredGift = (() => {
    const tg = entity?.assets?.trustGifts || entity?.trustGifts
    if (!tg) return 0
    const v = tg.total ?? tg.amount ?? tg.value ?? 0
    return Number.isFinite(+v) ? +v : 0
  })()
  const [deltas, setDeltas] = useState({ sippDraw: 0, gift: declaredGift, bpr: 0 })

  // Map component slider keys → engine delta keys
  const engineDeltas = {
    drawdown_per_year:         deltas.sippDraw,
    gift_amount:               deltas.gift,
    apr_bpr_allowance_claimed: deltas.bpr,
  }

  const wf = safe(() => ihtWaterfall(entity, engineDeltas), null)

  // delta_vs_baseline is negative when sliders reduce IHT (savings = positive)
  const savings = wf ? Math.max(0, -(wf.delta_vs_baseline || 0)) : 0
  const animatedSavings = useCounterAnimation(savings, {
    duration: 600, format: (n) => fmt(Math.round(n)),
  })

  if (!wf) return null
  const couples = !!entity?.isCouple
  const ihtDue  = wf.iht_due ?? 0

  // Engine returns waterfall_components: [{ stage, value }]
  // Map stage keys to human labels and filter to display-worthy rows
  const STAGE_LABELS = {
    gross_estate:            'Gross estate',
    minus_drawdown_consumed: 'Less: SIPP drawdown',
    minus_gift_PET:          'Less: gifts (PETs)',
    minus_property_downsize: 'Less: downsizing',
    minus_life_in_trust:     'Less: assets in trust',
    subtotal:                'Net estate',
    minus_NRB:               'Less: nil-rate band',
    minus_RNRB:              'Less: residence NRB',
    minus_BPR_APR:           'Less: BPR / APR relief',
    minus_charity:           'Less: charitable gifts',
    taxable:                 'Taxable estate',
    iht_due:                 'IHT due',
  }
  // Show gross, deductions with non-zero values, taxable, and iht_due
  const components = wf.waterfall_components || []
  const stages = components
    .filter(c => {
      if (!STAGE_LABELS[c.stage]) return false
      // Always show anchor rows; hide zero-value deduction rows
      if (c.stage === 'gross_estate' || c.stage === 'subtotal' || c.stage === 'taxable' || c.stage === 'iht_due') return true
      return (c.value || 0) !== 0
    })
    .map(c => ({ label: STAGE_LABELS[c.stage] || c.stage, value: c.value || 0, stage: c.stage }))

  const absMax = Math.max(1, ...stages.map(s => Math.abs(s.value)))

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="IHT waterfall — what reduces the bill?"
        sub={savings > 0 ? `Projected saving: ${animatedSavings}` : 'Adjust sliders to model IHT-reducing moves'}
        accessory={couples ? <Chip tone="info">Couples £5m business + agricultural relief pool</Chip> : null}
      />

      {/* IHT result summary — updates with sliders */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', marginBottom: 'var(--space-sm)',
        background: ihtDue > 0 ? 'var(--c-tint-coral)' : 'var(--c-tint-mint)',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${ihtDue > 0 ? 'rgba(255,59,48,.25)' : 'rgba(52,199,89,.25)'}`,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 2 }}>IHT after moves</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: ihtDue > 0 ? 'var(--c-danger)' : 'var(--c-success)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
            {fmt(ihtDue)}
          </div>
        </div>
        {(wf.delta_vs_baseline || 0) !== 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 2 }}>vs. no action</div>
            <div style={{ fontSize: 14, fontWeight: 700,
              color: savings > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {savings > 0 ? `−${fmt(savings)}` : `+${fmt(Math.abs(wf.delta_vs_baseline))}`}
            </div>
          </div>
        )}
      </div>

      <RevealStagger interval={60} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-md)' }}>
        {stages.map((s, i) => {
          const isDeduction  = s.value < 0
          const isResult     = s.stage === 'iht_due'
          const isGross      = s.stage === 'gross_estate'
          const pct          = Math.round((Math.abs(s.value) / absMax) * 100)
          const colour       = isResult ? 'var(--c-danger)' : isDeduction ? 'var(--c-success)' : isGross ? 'var(--c-text3)' : 'var(--c-warning)'
          return (
            <div key={s.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--c-text2)' }}>{s.label}</span>
                <span style={{ color: 'var(--c-text)', fontWeight: isResult ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>
                  {isDeduction ? `−${fmt(Math.abs(s.value))}` : fmt(s.value)}
                </span>
              </div>
              <GaugeBar pct={pct} colour={colour} height={isResult ? 8 : 5} delay={i * 60} />
            </div>
          )
        })}
      </RevealStagger>

      <SliderRow label="SIPP drawdown (annual)" value={deltas.sippDraw} max={120000} step={5000}
        onChange={v => setDeltas(d => ({ ...d, sippDraw: v }))}
        note="Modelled over 20 years — reduces estate by drawing down pension before death" />
      <SliderRow label="Gifts / PETs" value={deltas.gift} max={Math.max(500000, declaredGift)} step={5000}
        onChange={v => setDeltas(d => ({ ...d, gift: v }))}
        note={declaredGift > 0
          ? `Seeded from your declared £${(declaredGift/1000).toFixed(0)}k trust gift. IHT taper applies if death within 7 years.`
          : "One-off gift. IHT taper applies if death within 7 years."} />
      <SliderRow label="Business relief positioning (BPR)" value={deltas.bpr} max={500000} step={5000}
        onChange={v => setDeltas(d => ({ ...d, bpr: v }))}
        note="Business + agricultural relief transitional rules apply — pre vs post 30-Oct-2024" />
    </div>
  )
}

function SliderRow({ label, value, max, step, onChange, note }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--c-text3)' }}>{label}</span>
        <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{fmt(value)}</span>
      </div>
      <input type="range" min={0} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--c-acc)' }} />
      {note && <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

// §8.20 — Year-by-year IHT projection table
function IHTYearByYear({ entity }) {
  const rows = useMemo(() => {
    try { return ihtProjection(entity, 5) } catch { return [] }
  }, [entity])

  if (!rows.length) return null

  const baseIHT = rows[0]?.ihtDue ?? 0

  return (
    <RevealCard
      cardId="te-iht-projection"
      title="Year-by-year IHT projection"
      entity={entity}
      defaultOpen={false}
      headerAccessory={<Chip tone="neutral" size="sm">est · not advice</Chip>}
    >
      <div style={{ padding: '0 0 12px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                {['Year', 'Est. estate', 'IHT due', 'vs today'].map(h => (
                  <th key={h} style={{
                    padding: '6px 8px',
                    textAlign: h === 'Year' ? 'left' : 'right',
                    color: 'var(--c-text3)',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isPensionYear = row.pensionIncluded && (i === 0 || !rows[i - 1].pensionIncluded)
                const delta = row.ihtDue - baseIHT
                return (
                  <tr key={row.year} style={{
                    borderBottom: '1px solid var(--c-border-subtle, color-mix(in srgb, var(--c-border) 40%, transparent))',
                    background: isPensionYear ? 'color-mix(in srgb, var(--c-warn, #f59e0b) 8%, transparent)' : 'transparent',
                  }}>
                    <td style={{ padding: '7px 8px', color: 'var(--c-text)', fontWeight: i === 0 ? 700 : 400 }}>
                      {row.year}
                      {isPensionYear && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: 'var(--c-warn, #f59e0b)',
                          fontWeight: 600,
                        }}>Pension enters estate</span>
                      )}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      £{fmt(row.estateValue)}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: row.ihtDue > 0 ? 'var(--c-bad, #ef4444)' : 'var(--c-good, #22c55e)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {row.ihtDue > 0 ? `£${fmt(row.ihtDue)}` : '—'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: delta > 0 ? 'var(--c-bad, #ef4444)' : delta < 0 ? 'var(--c-good, #22c55e)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
                      {i === 0 ? '—' : delta === 0 ? '=' : `${delta > 0 ? '+' : ''}£${fmt(Math.abs(delta))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
          Growth assumed at {entity?.expectedReturn != null ? `${((entity.expectedReturn) * 100).toFixed(1)}%` : '4.0%'} p.a. · NRB/RNRB thresholds frozen · Annual gift exemption £3,000/yr deducted · Pension IHT inclusion from Apr 2027.
        </div>
      </div>
    </RevealCard>
  )
}

// §6.6 — Gift clock ring chart
function GiftClock({ entity }) {
  const gifts = safe(() => giftClockProjection(entity), [])
  if (!gifts || gifts.length === 0) {
    // Single legacy gift fallback
    const tg = entity?.assets?.trustGifts
    if (!tg?.date) return null
    gifts.push({
      date: tg.date,
      amount: tg.total,
      recipient: tg.recipient || 'Trust',
      yrs: 0,
      taperPct: 0.4,
      ihtIfDieToday: Math.round((tg.total || 0) * 0.4),
      ihtFreeIn: 7,
    })
  }
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Gift clock — 7-year rule"
        sub={`${gifts.length} active gift${gifts.length === 1 ? '' : 's'}`}
        accessory={<ExplainerChip id="TE-2" />}
      />
      <RevealStagger interval={200} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gifts.map((g, i) => {
          const yrs = g.yrs || 0
          const pct = Math.min(100, (yrs / 7) * 100)
          return (
            <div key={i} className="sw-lift" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 'var(--space-md)',
              background: 'var(--c-surface2)', borderRadius: 'var(--r-md)',
            }}>
              <RingChart pct={pct} size={56} colour={pct >= 100 ? 'var(--c-success)' : 'var(--c-warning)'} delay={i * 200} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  {fmt(g.amount || 0)} to {g.recipient || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                  Gifted {g.date} · {yrs.toFixed?.(1) ?? yrs}/7 years elapsed
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Chip tone={pct >= 100 ? 'good' : 'warn'}>
                    {pct >= 100 ? 'IHT-free' : `${fmtPct(g.taperPct || 0, 0)} taper`}
                  </Chip>
                  {pct < 100 && (
                    <Chip tone="neutral" title="If you died today">
                      Today: {fmt(g.ihtIfDieToday || 0)} IHT
                    </Chip>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </RevealStagger>
    </div>
  )
}

function RingChart({ pct, size = 60, colour = 'var(--c-warning)', strokeBg = 'rgba(255,255,255,0.07)', delay = 0 }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const target = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  const [offset, setOffset] = useState(c) // start fully empty
  useEffect(() => {
    const id = setTimeout(() => setOffset(target), 80 + delay)
    return () => clearTimeout(id)
  }, [target, delay])
  return (
    <svg width={size} height={size} style={{ flexShrink: 0, overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={r}
        stroke={strokeBg} strokeWidth={5} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r}
        stroke={colour} strokeWidth={5} fill="none"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))' }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        style={{ fontSize: 11, fontWeight: 700, fill: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// §6.12 — Half-circle gauge for BPR/APR usage
function HalfCircleGauge({ pct, colour = 'var(--c-success)', size = 96 }) {
  const safe = Math.max(0, Math.min(100, +pct || 0))
  const r = size / 2 - 8
  const c = Math.PI * r // half-circumference
  const target = c * (1 - safe / 100)
  const [offset, setOffset] = useState(c)
  useEffect(() => {
    const id = setTimeout(() => setOffset(target), 80)
    return () => clearTimeout(id)
  }, [target])
  const cx = size / 2, cy = size / 2 + 4
  return (
    <svg width={size} height={size / 2 + 12} style={{ flexShrink: 0, overflow: 'visible' }}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="rgba(255,255,255,0.07)" strokeWidth={9} fill="none" strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={colour} strokeWidth={9} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))' }}
      />
      <text x="50%" y={cy - 6} textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 800, fill: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(safe)}%
      </text>
    </svg>
  )
}

// §6.7 — Trust simulator + 10-yr periodic-charge timeline
function TrustSimulator({ entity }) {
  const trusts = entity?.assets?.trusts || (entity?.assets?.trustGifts ? [entity.assets.trustGifts] : [])
  if (!trusts.length) return null
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Trust 10-year periodic charge" sub="Discretionary trust — entry, periodic, and exit charges" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trusts.map((t, i) => {
          const c = safe(() => trustPeriodicCharge(t), null)
          if (!c) return null
          const lowConfidence = !t.deedRef && !t.deedInVault
          return (
            <div key={i} style={{
              padding: '10px 12px', background: 'var(--c-surface2)', borderRadius: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                  Trust {i + 1}
                </span>
                {lowConfidence && <Chip tone="warn">LOW · deed not in Vault</Chip>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                <div><span style={{ color: 'var(--c-text3)' }}>Next charge: </span>
                  <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>{c.nextChargeDate || '—'}</span></div>
                <div><span style={{ color: 'var(--c-text3)' }}>Years to: </span>
                  <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>{c.yearsToCharge ?? '—'}</span></div>
                <div><span style={{ color: 'var(--c-text3)' }}>Rate: </span>
                  <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>{fmtPct(c.rate || 0.06)}</span></div>
                <div><span style={{ color: 'var(--c-text3)' }}>Estimated charge: </span>
                  <span style={{ fontWeight: 700, color: 'var(--c-danger)' }}>{fmt(c.estimatedCharge || 0)}</span></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// §6.8 — Nominations manager
function NominationsManager({ entity }) {
  const ns = safe(() => nominationStatus(entity), null)
  if (!ns) return null
  const list = Array.isArray(ns.pensions) ? ns.pensions
             : Array.isArray(ns)         ? ns
             : []
  if (!list.length) return null
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Pension nominations" sub={`${list.length} pension${list.length === 1 ? '' : 's'} on record`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((p, i) => {
          const stale = p.stale || p.staleness?.stale
          const has = !!(p.nominee || p.beneficiary || p.has_nomination)
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', background: 'var(--c-surface2)', borderRadius: 10,
            }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--c-text)' }}>
                {p.provider || p.name || `Pension ${i + 1}`}
              </span>
              {has ? <Chip tone="good">Nominee set</Chip> : <Chip tone="bad">No nominee</Chip>}
              {stale && <Chip tone="warn">Stale</Chip>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// §6.9 — Will & LPA (X27 primary canonical home)
function WillLPACard({ entity, onDrillMetric }) {
  const wl = safe(() => willLpaStatus(entity), null)
  const intst = safe(() => intestacyDistribution(entity), null)
  const nwc = safe(() => noWillCoI(entity), null)
  if (!wl) return null
  const flags = wl.flags || []
  const cohabRed = flags.includes('RED_COHABITING_NO_WILL')
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Will & power of attorney (LPA)"
        sub="Discovery + intestacy implications + cohabiting RED flag"
        accessory={
          wl.will?.current ? <Chip tone="good">Will current</Chip>
                           : <Chip tone="bad">No current will</Chip>
        }
      />
      {cohabRed && (
        <div
          className="sw-pulse-glow sw-press"
          role="button"
          tabIndex={0}
          onClick={() => onDrillMetric?.('will')}
          onKeyDown={(e) => e.key === 'Enter' && onDrillMetric?.('will')}
          style={{
            marginBottom: 'var(--space-md)', padding: 'var(--space-md)',
            background: 'var(--c-tint-coral)',
            border: '1px solid rgba(255,59,48,.40)',
            borderRadius: 'var(--r-md)',
            fontSize: 13, color: 'var(--c-coral-text)', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ⚠ RED — Cohabiting partner with no current will. Intestacy gives them
          NOTHING under English/Welsh law. This is the single highest-risk gap.
          <span style={{ display: 'block', marginTop: 6, fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
            Tap to review will &amp; estate planning →
          </span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <StatTile
          label="Will status"
          value={wl.will?.current ? 'Current' : (wl.will?.status || 'unknown')}
          colour={wl.will?.current ? 'var(--c-success)' : 'var(--c-danger)'}
        />
        <StatTile
          label="Power of attorney (LPA)"
          value={wl.lpa?.status || 'none'}
          sub={`Property + finance: ${wl.lpa?.propertyFinance ? '✓' : '—'} · Health + welfare: ${wl.lpa?.healthWelfare ? '✓' : '—'}`}
          colour={wl.lpa?.status === 'none' ? 'var(--c-danger)' : 'var(--c-success)'}
        />
      </div>
      {nwc && nwc.total > 0 && (
        <div style={{
          padding: '8px 10px', background: 'rgba(255,59,48,.06)',
          border: '1px solid rgba(255,59,48,.20)', borderRadius: 10,
          fontSize: 12, color: 'var(--c-danger)', marginBottom: 8,
        }}>
          Cost of dying intestate: <strong>{fmt(nwc.total)}</strong>
          {nwc.breakdown && (
            <span style={{ color: 'var(--c-text3)', fontWeight: 400 }}>
              {' '}· delay {fmt(nwc.breakdown.delay || 0)} · IHT inefficiency {fmt(nwc.breakdown.ihtPenalty || 0)} · dispute {fmt(nwc.breakdown.dispute || 0)}
            </span>
          )}
        </div>
      )}
      {intst?.beneficiaries?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Intestacy distribution (illustrative)
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 6, fontStyle: 'italic' }}>
            {intst.rules}
          </div>
          {intst.beneficiaries.map((b, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, padding: '6px 10px',
              background: 'var(--c-surface2)', borderRadius: 8, marginBottom: 4,
            }}>
              <span style={{ color: 'var(--c-text2)' }}>{b.name}</span>
              <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>
                {fmt(b.share)} ({b.pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// §6.10 — Beneficiary chain Sankey
function BeneficiaryChain({ entity }) {
  const exposure = safe(() => te_ihtExposure(entity), null)
  const list = entity?.beneficiaries || []
  if (!exposure || list.length === 0) return null
  const totalShare = list.reduce((s, b) => s + (+b.share || 1), 0) || 1
  const benList = list.map(b => ({
    name: b.name || 'Beneficiary',
    share: (+b.share || 1) / totalShare,
    isContingent: !!b.isContingent,
  }))
  const apsEdge = entity?.spouse?.unusedNRB > 0 ? {
    amount: entity.spouse.unusedNRB,
    label: 'APS (transferable NRB)',
  } : null
  const estate = {
    gross: exposure.gross_estate || 0,
    deductions: [
      { label: 'Debts',   amount: exposure.deductions?.debts || 0 },
      { label: 'Funeral', amount: exposure.deductions?.funeral || 0 },
      { label: 'IHT',     amount: exposure.iht_due || 0 },
    ].filter(d => d.amount > 0),
    iht: exposure.iht_due || 0,
    net: exposure.beneficiary_value || 0,
  }
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Beneficiary chain" sub="Estate → deductions → IHT → net to beneficiaries" />
      <div style={{ overflowX: 'auto' }}>
        <DrawSVG duration={1000}>
          <BeneficiarySankey
            estate={estate}
            beneficiaries={benList}
            apsEdge={apsEdge}
          />
        </DrawSVG>
      </div>
    </div>
  )
}

// §6.11 — RNRB taper gauge
function RNRBPlanning({ entity }) {
  const taper = safe(() => rnrbTaper(entity), null)
  const elig  = safe(() => rnrbEligibility(entity), null)
  if (!taper) return null
  const grossIht = safe(() => ihtDynamic(entity, true), { gross: 0 })
  const grossEstate = grossIht.gross || 0
  const taperStart = TAX.rnrbTaper
  const taperEnd = TAX.rnrbTaper + 2 * TAX.rnrb   // RNRB fully tapered £1 per £2 over the threshold
  const inTaper = grossEstate >= taperStart
  const pctv = Math.min(100, ((grossEstate - taperStart) / (taperEnd - taperStart)) * 100)
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="RNRB planning"
        sub={`£${(taper.rnrb || 0).toLocaleString()} effective · £${(taper.lost || 0).toLocaleString()} lost to taper`}
        accessory={elig?.eligible ? <Chip tone="good">Eligible</Chip> : <Chip tone="bad">{elig?.reason || 'Not eligible'}</Chip>}
      />
      {inTaper && (
        <div style={{
          marginBottom: 10, padding: '8px 10px',
          background: 'rgba(255,179,71,.07)',
          border: '1px solid rgba(255,179,71,.30)',
          borderRadius: 10,
          fontSize: 12, color: 'var(--c-warning)',
        }}>
          <strong>£2m taper</strong> · For each £2 gross estate exceeds £2,000,000,
          RNRB falls by £1. Lost in full at £{(taperEnd).toLocaleString()}.
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text3)' }}>Gross estate</span>
          <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{fmt(grossEstate)}</span>
        </div>
        <GaugeBar
          pct={Math.min(100, (grossEstate / taperEnd) * 100)}
          colour={inTaper ? 'var(--c-warning)' : 'var(--c-success)'}
          height={10}
        />
      </div>
      {taper.downsizingCredit > 0 && (
        <div style={{ fontSize: 12, color: 'var(--c-text2)' }}>
          Downsizing credit: <strong>{fmt(taper.downsizingCredit)}</strong>
        </div>
      )}
    </div>
  )
}

// §6.12 — BPR & APR full mechanics
function BPRAPRMechanics({ entity }) {
  const bpr = safe(() => bprQualifyingValue(entity), null)
  const allow = safe(() => bprAprAllowance(entity), null)
  const apr = safe(() => aprQualification(entity), null)
  if (!bpr) return null
  const cap = (entity?.isCouple ? (allow?.couple || 2 * TAX.bprCombinedCap) : (allow?.individual || TAX.bprCombinedCap))
  const usedPct = cap > 0 ? Math.round(((bpr.used || 0) / cap) * 100) : 0
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="BPR & APR"
        sub={`${entity?.isCouple ? 'Couples £5m pool' : 'Single £2.5m allowance'} · used ${fmt(bpr.used || 0)}`}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
        <HalfCircleGauge pct={usedPct} colour={usedPct >= 100 ? 'var(--c-danger)' : usedPct >= 80 ? 'var(--c-warning)' : 'var(--c-success)'} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--c-text3)' }}>BPR/APR allowance</span>
            <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(bpr.used || 0)} / {fmt(cap)}
            </span>
          </div>
          <GaugeBar pct={usedPct} colour={usedPct >= 100 ? 'var(--c-danger)' : usedPct >= 80 ? 'var(--c-warning)' : 'var(--c-success)'} height={8} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <StatTile label="Tier 1 (full 100%)" value={fmt(bpr.tier1Full || 0)} />
        <StatTile label="AIM (Tier 2 50%)"   value={fmt(bpr.tier2Aim || 0)} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip tone="info">Pre-30-Oct-2024 trusts: 100% relief</Chip>
        <Chip tone="warn">Post-30-Oct-2024 trusts: {+(TAX.aimBPRRate * 100).toFixed(0)}% above {fmt(allow?.individual || TAX.bprCombinedCap)}</Chip>
        <Chip tone="info">7-yr refresh applies</Chip>
        <Chip tone="neutral">Instalment option available</Chip>
        <Chip tone="neutral">CPI indexation (post-2030)</Chip>
      </div>
      {apr && (
        <div style={{
          padding: '8px 10px', background: 'var(--c-surface2)', borderRadius: 10, fontSize: 12,
        }}>
          <strong style={{ color: 'var(--c-text)' }}>APR: </strong>
          <span style={{ color: apr.qualifies ? 'var(--c-success)' : 'var(--c-text3)' }}>
            {apr.reason}
          </span>
          {apr.value > 0 && (
            <span style={{ color: 'var(--c-text2)' }}> · value {fmt(apr.value)}</span>
          )}
        </div>
      )}
    </div>
  )
}

// §6.3 — CoI odometer (Estate planning domain) w/ cascade halo on change
function EstateCoIOdometer({ entity }) {
  const coi = safe(() => totalCoI(entity), { total: 0, byDomain: {}, confidence: 'MED' })
  // Fix 4: show total CoI (all domains), not just the estatePlanning domain slice.
  const estCoI = coi?.total || 0
  const days = daysLeft() || 365
  const dailyRate = estCoI > 0 ? estCoI / Math.max(1, days) : 0
  const byAction = Object.entries(coi.byDomain || {})
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1'), amount: v }))
  // Round to nearest 1k so floating-point drift doesn't constantly trigger halo
  const cascadeKey = Math.round(estCoI / 1000)
  const cascading = useCascadeTrigger(cascadeKey)
  return (
    <div className={cascading ? 'sw-cascade-halo' : ''} style={{ borderRadius: 'var(--r-lg)' }}>
      <CoIOdometer
        totalCoI={estCoI}
        dailyRate={dailyRate}
        deadline={null}
        confidence={coi?.confidence?.toLowerCase?.() || 'medium'}
        provenance={['Estate planning shortfall', 'RNRB taper loss', 'Will/LPA gaps']}
        byAction={byAction}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanStalenessAccordion — D-TE-PLAN-ANTI-NAGGER-1 collapse rule
// When ≥2 plan banners would render, collapse into one accordion to reclaim
// viewport. Single plan renders inline as a normal banner.
// Each "Review" pill routes via onReview(plan) — wired by parent to onDrillMetric.
// ─────────────────────────────────────────────────────────────────────────────
function PlanStalenessAccordion({ plans = [], onReview }) {
  const [open, setOpen] = useState(false)
  if (!plans || plans.length === 0) return null
  if (plans.length === 1) {
    // Single banner — render inline via shared PlanStalenessBanner
    return <PlanStalenessBanner plans={plans} onReview={onReview} />
  }
  return (
    <div style={{ padding: '0 16px', marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="sw-press"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: 'var(--c-surface)',
          border: '1px solid color-mix(in srgb, var(--c-gold) 30%, transparent)',
          borderLeft: '4px solid var(--c-gold)',
          borderRadius: '0 12px 12px 0',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⚠</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--c-text)',
          }}>
            {plans.length} plan review{plans.length === 1 ? '' : 's'} due
          </div>
          <div style={{
            fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
            marginTop: 2, lineHeight: 1.4,
          }}>
            {plans.map(p => p.label || p.type).join(' · ')}
          </div>
        </div>
        <span style={{
          color: 'var(--c-text3)', fontSize: 14, flexShrink: 0,
          transition: 'transform 200ms ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, marginLeft: 0 }}>
          <PlanStalenessBanner plans={plans} onReview={onReview} />
        </div>
      )}
    </div>
  )
}

// §6.2 — Estate plan target + staleness pill
function EstatePlanBadge({ entity }) {
  const plan = safe(() => planFor(entity, 'estate'), null)
  const stale = safe(() => planStaleness(entity, 'estate'), null)
  if (!plan && !stale) return null
  return (
    <FadeInOnMount style={{
      margin: '0 16px var(--space-md)',
      padding: 'var(--space-md) var(--space-lg)',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-card-sm)',
      display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
    }}>
      <span className="sw-eyebrow">Estate plan</span>
      {plan?.target != null && Number.isFinite(plan.target) && (
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
          target {fmt(plan.target)}
        </span>
      )}
      {stale?.stale && (
        <Chip tone={stale.severity === 'high' ? 'bad' : stale.severity === 'med' ? 'warn' : 'neutral'}>
          {stale.monthsSinceReview != null ? `${stale.monthsSinceReview}mo since review` : 'Not reviewed'}
        </Chip>
      )}
      {!plan && <Chip tone="warn" outline>No plan yet</Chip>}
    </FadeInOnMount>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// L3 — BPR Drill Panel
// ═════════════════════════════════════════════════════════════════════════════

function BPRDrillPanel({ entity, onClose }) {
  const bizAssets = entity?.assets?.business_assets || []

  const rows = bizAssets.map(b => {
    const value = +(b.currentValue || b.value || 0)
    // 100% for qualifying trading businesses, 50% for mixed/investment
    const isMixed = /mixed|investment|property/i.test(b.type || b.assetType || '')
    const rate = isMixed ? TAX.aimBPRRate : 1.0
    const relief = Math.round(value * rate)
    return { name: b.name || b.description || 'Business asset', value, rate, relief }
  }).filter(r => r.value > 0)

  const totalRelief = rows.reduce((s, r) => s + r.relief, 0)

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'te-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <style>{`@keyframes te-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
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
          Business Property Relief
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {rows.length === 0 ? (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
            fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic',
          }}>
            No BPR-eligible assets detected.
          </div>
        ) : (
          <>
            <div style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              borderRadius: 18, padding: '14px 18px', marginBottom: 12,
            }}>
              <div className="sw-eyebrow" style={{ marginBottom: 12 }}>BPR-eligible assets</div>
              {rows.map((r, i) => (
                <div key={r.name + i} style={{
                  padding: '10px 0',
                  borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{r.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text3)' }}>
                    <span>BPR rate: {(r.rate * 100).toFixed(0)}% ({r.rate === 1 ? 'trading business' : 'mixed/investment'})</span>
                    <span style={{ color: 'var(--c-success)', fontWeight: 700 }}>Relief: {fmt(r.relief)}</span>
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-sep)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Total BPR relief</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalRelief)}</span>
              </div>
            </div>

            <div style={{
              background: 'var(--c-surface)', border: '1px solid rgba(255,189,89,0.35)',
              borderRadius: 18, padding: '14px 18px', marginBottom: 12,
              fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
            }}>
              BPR must be held ≥2 years to qualify. Relief rates may change following Budget announcements.
            </div>

            {/* P13-7 (2026-05-28, IFA hardening): BPR refresh clock.
                Finance Act 2026 introduces a £2.5m combined APR/BPR allowance per
                individual (transferable to spouse). Inside allowance = 100% relief.
                Above = 50%. Plus a 7-year refresh window for individual gifts and
                a 10-year window for trust-settled assets. The clock surfaces both
                the allowance position AND the earliest refresh date — figures an
                IFA would lead with for any client with private company shares. */}
            {(() => {
              const ALLOWANCE = TAX.bprCombinedCap
              const totalBprValue = rows.reduce((s, r) => s + r.value, 0)
              const allowanceUsed = Math.min(totalBprValue, ALLOWANCE)
              const allowanceLeft = Math.max(0, ALLOWANCE - allowanceUsed)
              const above = Math.max(0, totalBprValue - ALLOWANCE)
              const pctUsed = Math.round((allowanceUsed / ALLOWANCE) * 100)

              // Find the oldest qualifying-tagged holding to project the next 7yr refresh
              const holdings = (entity?.assets?.portfolio?.holdings || [])
                .filter(h => h?.bprTagged && h?.acquisitionDate)
                .sort((a, b) => new Date(a.acquisitionDate) - new Date(b.acquisitionDate))
              const oldest = holdings[0]
              const refresh7 = oldest
                ? new Date(new Date(oldest.acquisitionDate).setFullYear(new Date(oldest.acquisitionDate).getFullYear() + 7))
                : null
              const refreshFmt = (d) => d ? d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

              return (
                <div style={{
                  background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                  borderRadius: 18, padding: '14px 18px', marginBottom: 12,
                }}>
                  <div className="sw-eyebrow" style={{ marginBottom: 12 }}>BPR allowance + refresh clock</div>

                  {/* Allowance bar */}
                  <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 6 }}>
                    £{Math.round(allowanceUsed).toLocaleString('en-GB')} of £2,500,000 used ({pctUsed}%)
                    {above > 0 && (
                      <span style={{ color: 'var(--c-amber-text)', fontWeight: 700 }}>
                        {' '}· £{Math.round(above).toLocaleString('en-GB')} above allowance (50% relief, effective 20% IHT)
                      </span>
                    )}
                  </div>
                  <div style={{
                    height: 8, borderRadius: 100,
                    background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 12,
                  }}>
                    <div style={{
                      width: `${pctUsed}%`, height: '100%',
                      background: pctUsed > 100 ? 'var(--c-coral-text)' : pctUsed > 80 ? 'var(--c-amber-text)' : 'var(--c-acc)',
                    }} />
                  </div>

                  {/* Refresh windows */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      padding: 10, background: 'var(--c-tint-neutral)',
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--c-text3)' }}>
                        Individual refresh · 7 years
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginTop: 4 }}>
                        {oldest ? refreshFmt(refresh7) : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                        {oldest
                          ? `Oldest tagged: ${refreshFmt(new Date(oldest.acquisitionDate))}`
                          : 'No tagged BPR holdings on file'}
                      </div>
                    </div>
                    <div style={{
                      padding: 10, background: 'var(--c-tint-neutral)',
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--c-text3)' }}>
                        Trust refresh · 10 years
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginTop: 4 }}>
                        Per-trust
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                        Each settlor-related trust has its own £2.5m allowance refresh (post-30 Oct 2024 trusts share one).
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    Finance Act 2026 (s65 sch12). £2.5m allowance frozen until 6 April 2031, then CPI-indexed. AIM and unrecognised-exchange shares get 50% BPR in all cases from April 2026 (was 100%).
                  </div>
                </div>
              )
            })()}
          </>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Not regulated advice · Verify with a qualified adviser
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// L3 — CGT Drill Panel
// ═════════════════════════════════════════════════════════════════════════════

function CGTDrillPanel({ entity, onClose }) {
  const invGain = +(entity?.assets?.investments?.unrealisedGain || 0)
  const giaGain = +(entity?.assets?.gia?.unrealisedGain || 0)
  const totalGains = invGain + giaGain
  const exempt = +(TAX?.cgaAllowance ?? 3000)
  const taxable = Math.max(0, totalGains - exempt)
  const taxBasic  = Math.round(taxable * (TAX?.cgtBasic ?? 0.18))
  const taxHigher = Math.round(taxable * (TAX?.cgtHigher ?? 0.24))

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'te-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
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
          Capital Gains Tax
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Unrealised gains</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invGain > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Investments (GIA/portfolio)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(invGain)}</span>
              </div>
            )}
            {giaGain > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>GIA</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(giaGain)}</span>
              </div>
            )}
            {totalGains === 0 && (
              <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>No unrealised gains detected.</div>
            )}
          </div>
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-sep)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Total unrealised gains</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalGains)}</span>
          </div>
        </div>

        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>If crystallised this year</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Annual exempt amount</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(exempt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Taxable gain</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: taxable > 0 ? 'var(--c-danger)' : 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(taxable)}</span>
            </div>
            {taxable > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>CGT at 18% (basic rate)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmt(taxBasic)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>CGT at 24% (higher rate)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmt(taxHigher)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {totalGains > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid rgba(93,219,194,0.3)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
            fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
          }}>
            Your annual CGT exempt amount lets up to {fmt(exempt)} of gains be realised tax-free each tax year; unused, it doesn't carry forward.
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Not regulated advice · Rates per UK-2026.1
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// L3 — IHT Exposure Drill Panel
// Full-screen overlay: estate → exemptions → chargeable → IHT due waterfall.
// Opened by tapping the IHT summary chip on the Estate sub-tab.
// ═════════════════════════════════════════════════════════════════════════════

function IHTDrillPanel({ entity, onClose }) {
  const expo   = safe(() => te_ihtExposure(entity), null)
  const wfall  = safe(() => ihtWaterfall(entity), null)

  const gross      = expo?.gross_estate ?? 0
  const nilRate    = expo?.nil_rate_band ?? expo?.nil_band ?? 325000
  const rnrb       = expo?.rnrb ?? expo?.residence_nil_rate_band ?? 0
  const totalExempt = (nilRate + rnrb)
  const taxable    = expo?.taxable_estate ?? Math.max(0, gross - totalExempt)
  const ihtDue     = expo?.iht_due ?? 0
  const effRate    = expo?.effective_iht_rate ?? (gross > 0 ? ihtDue / gross : 0)
  const beneficiary = expo?.beneficiary_value ?? Math.max(0, gross - ihtDue)

  // Waterfall steps
  const steps = [
    { label: 'Gross estate',      value: gross,        colour: 'var(--c-text)',    sign: '' },
    { label: 'Nil-rate band',     value: -nilRate,      colour: 'var(--c-success)', sign: '−' },
    { label: 'Residence NRB',     value: -rnrb,         colour: 'var(--c-success)', sign: '−', hide: rnrb === 0 },
    { label: 'Taxable estate',    value: taxable,       colour: 'var(--c-warning)', sign: '=' },
    { label: 'IHT @ 40%',        value: -ihtDue,       colour: 'var(--c-danger)',  sign: '−' },
    { label: 'Family receives',   value: beneficiary,   colour: 'var(--c-acc)',     sign: '=' },
  ].filter(s => !s.hide && Math.abs(s.value) > 0)

  const maxAbs = Math.max(...steps.map(s => Math.abs(s.value)), 1)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
      background: 'var(--c-bg)',
      animation: 'iht-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
      padding: '0 0 120px',
    }}>
      <style>{`
        @keyframes iht-slide-up {
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
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          IHT exposure breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>IHT due today</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: 'var(--c-danger)' }}>
            {fmt(ihtDue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            {fmtPct(effRate)} effective rate · Family receives {fmt(beneficiary)}
          </div>
          <span className="sw-chip sw-chip-sm" style={{ marginTop: 8, display: 'inline-block' }}>From your data</span>
        </div>

        {/* Waterfall */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Estate → exemptions → IHT</div>
          {steps.map(({ label, value, colour, sign }) => {
            const w = (Math.abs(value) / maxAbs) * 100
            return (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{sign} {label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(Math.abs(value))}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.max(2, w)}%`, background: colour,
                    transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* IHT waterfall items if available */}
        {wfall?.steps?.length > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Estate composition</div>
            {wfall.steps.map((st, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: i < wfall.steps.length - 1 ? '1px solid var(--c-sep)' : 'none' }}>
                <span style={{ fontSize: 12, color: 'var(--c-text2)' }}>{st.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(st.value ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action chip */}
        <div style={{
          background: 'color-mix(in srgb, var(--c-success) 8%, var(--c-surface))',
          border: '1px solid color-mix(in srgb, var(--c-success) 25%, transparent)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 12, fontSize: 12,
          color: 'var(--c-success)', lineHeight: 1.5,
        }}>
          Gifts, trusts, and pension nominations can reduce this figure — see Estate tab for options.
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Based on UK IHT rules · Finance Act 2026 · Not regulated advice
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// L3 — Allowance Tracker Drill Panel
// Full-screen overlay: ISA / pension AA / CGT / dividend / PSA breakdowns.
// Opened by tapping the Allowances strip on the Tax sub-tab.
// ═════════════════════════════════════════════════════════════════════════════

function AllowanceDrillPanel({ entity, onClose }) {
  const at = safe(() => allowanceTracker(entity), null)

  const items = at ? [
    { id: 'isa',       label: 'ISA',                limit: TAX.isaAllowance ?? 20000,  d: at.isa,      colour: 'var(--c-acc)',     desc: `Annual ISA limit: ${fmt(TAX.isaAllowance ?? 20000)}. Contributions don't reduce ANI.` },
    { id: 'psa',       label: 'Personal Savings',   limit: null,                    d: at.psa,      colour: 'var(--c-success)', desc: 'PSA: £1,000 basic rate · £500 higher rate · £0 additional. Interest below threshold is tax-free.' },
    { id: 'cgt',       label: 'CGT exemption',      limit: TAX.cgaAllowance ?? 3000, d: at.cgt,    colour: 'var(--c-warning)', desc: `Annual CGT exemption: ${fmt(TAX.cgaAllowance ?? 3000)}. Unused allowance cannot carry forward.` },
    { id: 'dividend',  label: 'Dividend allowance', limit: TAX.dividendAllowance ?? 500, d: at.dividend, colour: 'var(--c-gold)', desc: `Dividend allowance: ${fmt(TAX.dividendAllowance ?? 500)}/yr. Fully used = higher tax next threshold.` },
    { id: 'pa',        label: 'Personal Allowance', limit: TAX.pa ?? 12570, d: at.pa, colour: 'var(--c-text2)', desc: `Reduces by £1 for every £2 over ${fmt(TAX.adjustedNetIncomeCliff)} ANI. Fully lost at ${fmt(TAX.art)}.` },
  ].filter(x => x.d) : []

  const composite = at?.utilization ?? 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
      background: 'var(--c-bg)',
      animation: 'al-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
      padding: '0 0 120px',
    }}>
      <style>{`
        @keyframes al-slide-up {
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
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Allowance tracker
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Composite allowance usage</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: composite >= 90 ? 'var(--c-danger)' : composite >= 70 ? 'var(--c-warning)' : 'var(--c-acc)' }}>
            {composite}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            Across ISA, pension, CGT, dividend, and personal allowance
          </div>
          <span className="sw-chip sw-chip-sm" style={{ marginTop: 8, display: 'inline-block' }}>From your data</span>
        </div>

        {/* Per-allowance rows */}
        {items.map(({ id, label, d, colour, desc }) => {
          const pctv = d.pctUsed ?? (d.limit ? Math.round((d.used || 0) / d.limit * 100) : 0)
          const barColour = pctv >= 95 ? 'var(--c-danger)' : pctv >= 75 ? 'var(--c-warning)' : colour
          const remaining = d.remaining ?? (d.limit ? Math.max(0, d.limit - (d.used || 0)) : null)
          return (
            <div key={id} style={{
              background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
              borderRadius: 18, padding: '14px 18px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{label}</div>
                  {d.limit != null && (
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>
                      {fmt(d.used || 0)} used of {fmt(d.limit)}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: barColour,
                  fontVariantNumeric: 'tabular-nums',
                }}>{pctv}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.max(2, Math.min(100, pctv))}%`,
                  background: barColour,
                  transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                }} />
              </div>
              {remaining != null && remaining > 0 && (
                <div style={{ fontSize: 12, color: 'var(--c-success)', marginBottom: 6 }}>
                  {fmt(remaining)} remaining this tax year
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '20px 18px', marginBottom: 12,
            fontSize: 13, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic',
          }}>
            No allowance data available for this entity yet.
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Based on UK 2026/27 thresholds · Not regulated advice
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// P13-6 (2026-05-28, IFA hardening): SippIhtCountdownBanner
// Daily-refreshing countdown to 6 April 2027 — the date SIPPs enter the estate
// for IHT under the 2024 Budget change. Pre-event: shows months remaining +
// scroll-to-IHT CTA. Post-event: shows a neutral "in effect" chip. Hidden if
// the entity has no pension assets.
// ─────────────────────────────────────────────────────────────────────────────
function SippIhtCountdownBanner({ entity, onScrollToIHT }) {
  const pensionPot = (() => {
    try {
      const a = entity?.assets || {}
      return (+(a?.sipp?.total)   || 0) +
             (+(a?.sipp?.value)   || 0) +
             (+(a?.pension?.total)|| 0) +
             (Array.isArray(a?.pensions) ? a.pensions.reduce((s, p) => s + (+p?.value || +p?.balance || 0), 0) : 0) +
             (Array.isArray(a?.sipp?.pensions) ? a.sipp.pensions.reduce((s, p) => s + (+p?.value || +p?.balance || 0), 0) : 0)
    } catch { return 0 }
  })()
  if (pensionPot <= 0) return null  // banner irrelevant — no pension exposure
  const today = new Date()
  const deadline = new Date('2027-04-06')
  const msDelta = deadline - today
  const daysLeft = Math.round(msDelta / 86400000)
  const past = daysLeft <= 0
  const monthsLeft = Math.max(0, Math.round(daysLeft / 30.44))
  const colour =
    past             ? 'var(--c-text2)' :
    daysLeft <= 60   ? 'var(--c-coral-text)' :
    daysLeft <= 180  ? 'var(--c-amber-text)' :
                       'var(--c-acc)'
  const bg =
    past             ? 'var(--c-tint-neutral)' :
    daysLeft <= 60   ? 'var(--c-tint-coral)'   :
    daysLeft <= 180  ? 'var(--c-tint-amber)'   :
                       'var(--c-tint-blue)'
  return (
    <div role="region" aria-label="SIPP-IHT planning window" style={{
      margin: '4px 16px 12px', padding: '12px 14px',
      background: bg,
      border: `1px solid ${colour}`,
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colour, marginBottom: 2 }}>
          SIPP-IHT window {past ? '· in effect' : `· ${monthsLeft} month${monthsLeft === 1 ? '' : 's'} left`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>
          {past
            ? 'From 6 April 2027, unused pensions are inside your estate for IHT (Finance Act 2024).'
            : `From 6 April 2027 — in ~${monthsLeft} months — unused pensions enter your estate for IHT. Planning options collapse after this date.`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.4 }}>
          Your current pension exposure: <strong style={{ color: 'var(--c-text)' }}>£{Math.round(pensionPot).toLocaleString('en-GB')}</strong>
          {!past && daysLeft <= 365 && ' · this is the planning window.'}
        </div>
      </div>
      {!past && (
        <button
          type="button"
          onClick={onScrollToIHT}
          aria-label="Jump to IHT projection card"
          style={{
            padding: '8px 12px', borderRadius: 100,
            background: colour, color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}
        >See impact ›</button>
      )}
    </div>
  )
}

import MoneyXDrawer from '../components/shared/MoneyXDrawer.jsx'
import useBundleVersion from '../hooks/useBundleVersion.jsx'

export default function TaxEstate({ entity, onHome, onBack, onNav, onOpenRisk, onDrillMetric, hash, seed, ihtForceKey, onOpenDecision }) {
  // Back-routing (2026-05-28): respect previous screen rather than jumping home.
  const goBackOrHome = onBack || onHome
  // ── Viewport detection (for mobile reordering — F-CAT-03 / F-VIS-01) ──────
  const [isMobile, setIsMobile] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia('(max-width: 599px)').matches } catch { return false }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 599px)')
    const handler = (e) => setIsMobile(!!e.matches)
    try { mql.addEventListener('change', handler) } catch { mql.addListener(handler) }
    return () => { try { mql.removeEventListener('change', handler) } catch { mql.removeListener(handler) } }
  }, [])

  // ── Smart sub-tab default (F-CAT-03 visibility / spec §2.7) ───────────────
  // Adults pre-decumulation with zero IHT today are better served by Tax
  // sub-tab on first load; users who have explicitly chosen otherwise keep
  // their preference. Persisted choice always wins.
  const [subTab, setSubTab] = useState(() => {
    try {
      const stored = localStorage.getItem(SUBTAB_KEY)
      if (stored === 'tax' || stored === 'estate') return stored
    } catch { /* silent */ }
    try {
      const expo = te_ihtExposure(entity)
      const age  = calcAge(entity?.dob)
      const preDecum = Number.isFinite(age) && age < 55
      if (preDecum && (expo?.iht_due || 0) === 0) return 'tax'
    } catch { /* silent */ }
    return 'estate'
  })
  useEffect(() => { try { localStorage.setItem(SUBTAB_KEY, subTab) } catch { /* silent */ } }, [subTab])

  // Ref to IHTDualNumber card so the Pension-IHT chip can scroll to it (F-STUB-02)
  const ihtDualRef = useRef(null)
  const scrollToIHTDual = () => {
    try { ihtDualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch { /* silent */ }
  }

  // ── L3 drill panel state ─────────────────────────────────────────────────
  // 'iht' → IHTDrillPanel  |  'allowances' → AllowanceDrillPanel  |  'bpr' → BPRDrillPanel  |  'cgt' → CGTDrillPanel
  const [drillView, setDrillView] = useState(null)

  // ── X28 top-bar state (window + view mode) ───────────────────────────────
  const [x28Window, setX28Window] = useState('current-tax-year')
  const [viewMode, setViewMode] = useState('actual')

  // A4 last-mile (2026-05-28): bv invalidates every engine memo below when
  // the user flips the TY chip. Tax-Estate is the most rate-sensitive
  // screen — IHT NRB/RNRB, dividend bands, additional-rate threshold all
  // shift between bundles.
  const bv = useBundleVersion()

  // ── Derive top-line numbers ──────────────────────────────────────────────
  // calcFQ is canonical per Home v1.4 §Q1.2; calcFQCalibrated drifted from Home's number.
  const fq    = useMemo(() => safe(() => calcFQ(entity), { total: 0 }), [entity, bv])
  const risk  = useMemo(() => safe(() => calcRisk(entity), { total: 0 }), [entity, bv])
  const nw    = useMemo(() => safe(() => netWorth(entity), 0), [entity, bv])
  const fqBd  = useMemo(() => safe(() => fqBand(fq.total)), [fq])
  const rkBd  = useMemo(() => safe(() => riskBand(risk.total)), [risk])

  // ── Badge counts (open actions per sub-tab) ───────────────────────────────
  const taxBadge = useMemo(() => {
    const at = safe(() => allowanceTracker(entity), null)
    let n = 0
    if (at) {
      if ((at.isa?.remaining || 0) > 100)      n++
      if ((at.cgt?.remaining || 0) > 100)      n++
      if ((at.dividend?.remaining || 0) === 0) n++   // div allowance fully used
    }
    const ani = safe(() => calcANI(entity).ani, 0)
    if (ani >= TAX.adjustedNetIncomeCliff && ani <= TAX.art) n++  // 60% taper
    return n
  }, [entity, bv])

  const estateBadge = useMemo(() => {
    let n = 0
    const wl = safe(() => willLpaStatus(entity), null)
    if (wl) {
      if (!wl.will?.current) n++
      if (wl.lpa?.status === 'none') n++
      if ((wl.flags || []).includes('RED_COHABITING_NO_WILL')) n++
    }
    const ns = safe(() => nominationStatus(entity), null)
    const nsList = Array.isArray(ns?.pensions) ? ns.pensions : Array.isArray(ns) ? ns : []
    if (nsList.some(p => !(p.nominee || p.beneficiary || p.has_nomination))) n++
    return n
  }, [entity, bv])

  // ── X29 diff layer — last-seen totals ────────────────────────────────────
  const snap = useMemo(() => readSnapshot(entity?.id), [entity?.id])
  const exposureToday = useMemo(() => safe(() => te_ihtExposure(entity), null), [entity, bv])
  const totalTaxNow   = useMemo(() => safe(() => te_taxThisYear(entity)?.total_tax, 0), [entity, bv])
  useEffect(() => {
    writeSnapshot(entity?.id, {
      iht: exposureToday?.iht_due || 0,
      tax: totalTaxNow || 0,
      fq:  fq.total,
    })
  }, [entity?.id, exposureToday?.iht_due, totalTaxNow, fq.total])

  const ihtSince = snap?.iht
  const taxSince = snap?.tax
  const fqSince  = snap?.fq

  // ── Plan staleness banner — 3 plan anchors (estate / gift / tax) ─────────
  const plans = useMemo(() => {
    const types = ['estate', 'gift', 'tax']
    return types.map(t => {
      const stl = safe(() => planStaleness(entity, t), null) || {}
      return {
        type: t,
        label: t === 'gift' ? 'Gifting' : t === 'tax' ? 'Tax' : 'Estate',
        monthsSinceReview: stl.monthsSinceReview ?? 0,
        isStale: !!stl.stale,
        // Anti-nagger: PlanStalenessBanner only renders isCritical-flagged plans.
        // Promote any stale-or-critical plan to isCritical so the shared
        // banner renders it once the accordion is expanded.
        isCritical: !!stl.stale || stl.severity === 'high',
      }
    }).filter(p => p.isCritical || p.isStale)
  }, [entity])

  const lifeStage = lifeStageString(entity)
  const nri = isNRI(entity)

  // ── Sub-anchor strip — different for tax vs estate ────────────────────────
  const subAnchorTax = useMemo(() => {
    const ani = safe(() => calcANI(entity).ani, 0)
    const allow = safe(() => allowanceTracker(entity), null)
    return {
      a: { label: 'YTD tax', value: fmt(totalTaxNow || 0), colour: 'var(--c-danger)',
           accessory: taxSince != null && taxSince !== totalTaxNow
             ? <DiffBadge value={(totalTaxNow || 0) - taxSince} since={null} format="currency" />
             : null },
      b: { label: 'ANI', value: fmt(ani || 0),
           sub: ani >= TAX.adjustedNetIncomeCliff && ani <= TAX.art ? '⚠ 60% taper band' : '' },
      c: { label: 'Allowances', value: `${allow?.utilization || 0}%`,
           sub: 'composite usage' },
    }
  }, [entity, totalTaxNow, taxSince])

  const subAnchorEstate = useMemo(() => {
    const ihtNow = exposureToday?.iht_due || 0
    const beneficiaryNet = exposureToday?.beneficiary_value || 0
    // Pension-IHT countdown: live days-until 6 Apr 2027
    const today = new Date()
    const msPerDay = 86_400_000
    const daysToPensionIHT = Math.max(0, Math.ceil((PENSION_IHT_DATE - today) / msPerDay))
    const countdownColour = daysToPensionIHT < 30 ? 'var(--c-danger)' : 'var(--c-warning)'
    // F-CAT-01: surface ENACTED status next to the countdown so the user can
    // distinguish enacted law from proposal. Sourced from Explainer TE-1 wording.
    const enactedChip = (
      <span
        title="Royal Assent 18 Mar 2026 — effective 6 Apr 2027"
        className="sw-chip sw-chip-sm sw-chip-mint sw-chip-outline"
      >
        Enacted · FA 2026
      </span>
    )
    return {
      a: { label: 'IHT today', value: fmt(ihtNow), colour: 'var(--c-danger)', tieout: 'tax.iht-today', tieoutRaw: ihtNow },
      b: { label: 'Family receives', value: fmt(beneficiaryNet), colour: 'var(--c-success)', tieout: 'tax.beneficiary-net', tieoutRaw: beneficiaryNet },
      c: {
        label: 'Pension-IHT',
        value: `${daysToPensionIHT} days`,
        sub: 'Until 6 Apr 2027 · Finance Act 2026',
        colour: countdownColour,
        statusChip: enactedChip,
        onTap: scrollToIHTDual,
      },
    }
  // scrollToIHTDual is stable across renders (defined per-render but reads ref)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposureToday])

  // ── L3 drill panel gate — renders before the normal screen ─────────────
  if (drillView === 'iht') {
    return <IHTDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }
  if (drillView === 'allowances') {
    return <AllowanceDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }
  if (drillView === 'bpr') {
    return <BPRDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }
  if (drillView === 'cgt') {
    return <CGTDrillPanel entity={entity} onClose={() => setDrillView(null)} />
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="screen">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 4px',
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
        <span className="sw-chip sw-chip-sm sw-chip-mint sw-chip-outline" title={`${BRAND.rulesVersion} · ${BRAND.dataDate}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          Live · {BRAND.rulesVersion}
        </span>
      </div>

      {/* MoneyX 8-chip drawer — every screen the same (2026-05-28). */}
      <MoneyXDrawer entity={entity} activeRoute="tax" onNav={onNav} />

      {/* ── X28 top-bar (per §X28-PATCH-1 / D-X28-OPTION-D) ─────────────── */}
      <X28TopBar
        window={x28Window}
        viewMode={viewMode}
        onWindowChange={setX28Window}
        onViewModeChange={setViewMode}
        rulesVersion={BRAND.rulesVersion}
        dataDate={BRAND.dataDate}
      />

      {/* P13-6 (2026-05-28, IFA hardening): SIPP-IHT April 2027 countdown banner.
          Shows remaining window in months/days until SIPPs enter the estate. After
          6 April 2027 the banner switches to a post-event explainer. Suppressed
          once the entity has zero pension assets (banner irrelevant). */}
      <SippIhtCountdownBanner entity={entity} onScrollToIHT={scrollToIHTDual} />

      {/* ── Triple anchor — every primary screen ──────────────────────────
          Founder 2026-05-25 round 6: hideNetWorth across all primary screens — NW lives in global header chip */}
      <div style={{ margin: '4px 0 12px' }}>
        <TripleAnchor
          hideNetWorth={true}
          hideWealth={true}
          hideRisk={true}
          netWorthVal={nw}
          fqTotal={fq.total}
          fqBand={fqBd}
          riskTotal={risk.total}
          riskBand={rkBd}
          deltaFQ={fqSince != null ? (fq.total - fqSince) : 0}
          onNetWorthTap={() => onDrillMetric?.('netWorth')}
          onWealthTap={() => onDrillMetric?.('wealthScore')}
          onRiskTap={onOpenRisk}
        />
      </div>

      {/* ── Plan staleness — desktop: above sub-tab. Mobile: below dual-number
            so the substance stays above the fold (F-CAT-03/F-VIS-01). ───────── */}
      {plans.length > 0 && !isMobile && (
        <PlanStalenessAccordion
          plans={plans}
          onReview={(p) => onDrillMetric?.(`plan:${p.type}`)}
        />
      )}

      {/* ── Sub-tab segmented control (§2.5) ──────────────────────────────── */}
      <SubTabSelector
        value={subTab}
        onChange={setSubTab}
        taxBadge={taxBadge}
        estateBadge={estateBadge}
      />

      {/* ── D-ANCHOR-2 sub-anchor strip ───────────────────────────────────── */}
      <SubAnchorStrip {...(subTab === 'tax' ? subAnchorTax : subAnchorEstate)} />

      {/* ── NRI notice ────────────────────────────────────────────────────── */}
      {nri && <NRINotice />}

      {/* ── TAX SUB-TAB ───────────────────────────────────────────────────── */}
      {subTab === 'tax' && (
        <div key="tax" className="sw-tab-slide">
          <TaxSummary entity={entity} />
          <IncomeTaxDetail entity={entity} />
          <ANIStepwise entity={entity} />
          <SalarySacrifice entity={entity} />
          <div style={{ position: 'relative' }}>
            <CGTDetail entity={entity} />
            {/* L3 drill affordance — opens CGTDrillPanel */}
            <button
              onClick={() => setDrillView('cgt')}
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
          <DividendDetail entity={entity} />
          <div style={{ position: 'relative' }}>
            <AllowancesStrip entity={entity} />
            {/* L3 drill affordance — opens AllowanceDrillPanel */}
            <button
              onClick={() => setDrillView('allowances')}
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
          <SelfAssessment entity={entity} />
          <DrawdownMatrix entity={entity} />
          <NonDomCard entity={entity} />
        </div>
      )}

      {/* ── ESTATE SUB-TAB ────────────────────────────────────────────────── */}
      {subTab === 'estate' && (
        <div key="estate" className="sw-tab-slide">
          {/* v0.3 R4 §3 SIGNATURE — IHT pre/post-April-2027 delta card.
              Lands at position 2 (above the legacy InheritanceStory + plan
              cards) per route-4-tax-estate.md §3. The card uses the canonical
              `ihtDeltaPrePost2027(entity)` helper from canonical-metrics, so
              `Today` and `From April 2027` numbers are consistent with every
              other R4 surface. Countdown ticks once per UTC day (no pulse) per
              compliance B6. */}
          <IHTDeltaCard entity={entity} />
          {/* §13.9 magic — Inheritance Story leads the Estate sub-tab.
              Replaces IHT waterfall as primary. Waterfall available on scroll. */}
          <InheritanceStory entity={entity} onDrillMetric={onDrillMetric} />
          <EstatePlanBadge entity={entity} />
          <EstateCoIOdometer entity={entity} />
          <div ref={ihtDualRef} style={{ position: 'relative' }}>
            <IHTDualNumber entity={entity} />
            {/* L3 drill affordance — opens IHTDrillPanel */}
            <button
              onClick={() => setDrillView('iht')}
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

          {/* Mobile: render the staleness accordion AFTER the dual-number so
              the substance the spec promises stays above the fold. Desktop
              renders the same accordion above the sub-tab selector. */}
          {isMobile && plans.length > 0 && (
            <PlanStalenessAccordion
              plans={plans}
              onReview={(p) => onDrillMetric?.(`plan:${p.type}`)}
            />
          )}

          {/* Will & LPA — primary canonical home (X27) */}
          <WillLPACard entity={entity} onDrillMetric={onDrillMetric} />

          <IHTWaterfall entity={entity} />

          {/* Year-by-year IHT projection — §8.20 */}
          <IHTYearByYear entity={entity} />

          <GiftClock entity={entity} />

          {/* Life-stage gated sections (D-CARD-REVEAL-1) */}
          <RevealCard
            cardId="te-trust-sim"
            title="Trust simulator"
            entity={{ ...(entity || {}), lifeStage }}
            lifeStageGate={['preretirement', 'decumulation', 'preservation', 'legacy']}
            defaultOpen={false}
            headerAccessory={<Chip tone="info">10-year periodic charge</Chip>}
          >
            <div style={{ padding: '0 0 12px' }}>
              <TrustSimulator entity={entity} />
            </div>
          </RevealCard>

          <div style={{ position: 'relative' }}>
            <RevealCard
              cardId="te-bpr-apr"
              title="BPR & APR mechanics"
              entity={{ ...(entity || {}), lifeStage }}
              // F-CAT-02: BPR clock starts the day the holding is bought —
              // surface the card whenever the user has EIS/SEIS/VCT/business
              // assets, even in accumulation, so the 2-year qualification
              // window is visible from day 1 (spec §6.12.1 discovery prompt).
              lifeStageGate={hasBPREligibleHoldings(entity)
                ? ['foundation', 'accumulation', 'consolidation', 'preretirement', 'decumulation', 'preservation', 'legacy']
                : ['consolidation', 'preretirement', 'decumulation', 'preservation', 'legacy']}
              defaultOpen={false}
            >
              <div style={{ padding: '0 0 12px' }}>
                <BPRAPRMechanics entity={entity} />
              </div>
            </RevealCard>
            {/* L3 drill affordance — opens BPRDrillPanel */}
            <button
              onClick={() => setDrillView('bpr')}
              className="sw-chip sw-chip-sm sw-press"
              style={{
                position: 'absolute', top: 14, right: 14,
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                color: 'var(--c-acc)',
              }}
            >
              Asset detail ›
            </button>
          </div>

          <NominationsManager entity={entity} />
          <BeneficiaryChain entity={entity} />
          <RNRBPlanning entity={entity} />

          {/* Diff badge: IHT today vs last visit */}
          {ihtSince != null && exposureToday && Math.abs((exposureToday.iht_due || 0) - ihtSince) > 100 && (
            <div style={{
              margin: '0 0 12px', padding: '8px 12px',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>
                IHT exposure since last visit:
              </span>
              <DeltaChip
                delta={(exposureToday.iht_due || 0) - ihtSince}
                format="currency"
              />
            </div>
          )}
        </div>
      )}

      <DecisionDrawers screen="tax" onOpen={onOpenDecision} />

      <p className="disclaimer">
        {BRAND.disclaimer}<br />
        {BRAND.rulesVersion} · {BRAND.dataDate}
      </p>
    </div>
  )
}
