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
import { parseDocument } from '../services/parser.js'
import { cgtChargeableHoldings } from '../engine/_helpers.js'
import { situationalTaxes } from '../engine/situational-taxes.js'
import { applyLevers } from '../engine/scenario-engine.js'
// S1 selector migration (Phase 2)
import {
  netWorth,
  fq as calcFQ,
  ani as calcANI,
} from '../engine/selectors/index.js'
import {
  // basics
  fmt, daysLeft, sippIhtCountdownDays, costOfInaction, calcAge, lifeStageFor, TAX, guardrail,
  calcRisk, fqBand, riskBand,
  // IHT on this screen now flows exclusively through te_ihtExposure (the
  // liability-deducting tax-estate engine); the legacy fq-calculator ihtDynamic
  // is no longer imported here so the whole tab reports ONE IHT figure.
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
  // §8.20 year-by-year IHT series (tax-estate-engine — returns an ARRAY of
  // {year, estateValue, ihtDue, pensionIncluded}). Aliased te_ to avoid the
  // clash with the single-snapshot ihtProjection on the selector facade, which
  // is what IHTYearByYear was wrongly calling (returned one object → no .length
  // → card silently unmounted). Fixed 2026-06-07.
  ihtProjection as te_ihtProjectionSeries,
} from '../engine/fq-calculator.js'
// Pension Annual Allowance + 3-year carry-forward is NOT in the fq-calculator
// allowanceTracker (which returns isa/psa/cgt/dividend/pa only). The estate-engine
// tracker carries the correctly-shaped pension_aa.{current_year, carry_forward};
// buildCarryForwardLedger adds honest-absence (provisional vs genuine-zero) so the
// "what you haven't used yet" surface never asserts a silent zero. (Founder T-j +
// TE-DOMAIN-RESEARCH §3 headline: surface the carry-forward headroom.)
import { allowanceTracker as teAllowanceTracker } from '../engine/tax-estate-engine.js'
import { buildCarryForwardLedger } from '../engine/carry-forward-state.js'

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
import SAComputationView from '../components/TaxEstate/SAComputationView.jsx'
import TaxYearHistory from '../components/TaxEstate/TaxYearHistory.jsx'
import { saComputation } from '../engine/sa-computation.js'
import { deriveCarryForwardFromHistory, upsertPriorYear } from '../state/tax-history.js'
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
  // business_assets live at the TOP LEVEL on rich personas (mrT-core), not under
  // assets — plus the trading companies and any AIM/EIS/SEIS/VCT in investments[].
  const ba = [
    ...(Array.isArray(a.business_assets) ? a.business_assets : []),
    ...(Array.isArray(entity.business_assets) ? entity.business_assets : []),
  ]
  if (ba.some(b => (b?.value_gbp || b?.value || b?.estimated_value || 0) > 0)) return true
  const companies = Array.isArray(entity.companies) ? entity.companies : (entity.companies ? [entity.companies] : [])
  if (companies.some(c => (c?.share_value_gbp || c?.value || 0) > 0 && /trading/i.test(String(c?.trading_status || '')))) return true
  const invs = Array.isArray(a.investments) ? a.investments : []
  if (invs.some(i => (i?.value || i?.balance || 0) > 0 && (i?.bpr_qualifying === true || /^(eis|seis|vct|aim)/i.test(String(i?.type || ''))))) return true
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

// ─────────────────────────────────────────────────────────────────────────────
// ScrubTrack — shared-input scrub control (FLEXIBILITY 2026-06-07).
// Pattern lifted from DecisionCharts PathComparisonChart/startScrub/BarGrip:
// the FILLED bar is the grabbable control (relative drag, no jump-to-cursor),
// and a keyboard-accessible <input type=range> mirrors it. Dragging or keying
// either one drives the same `value`, so every dependent figure rescales live.
// Use for shared-input OUTCOMES (a single driver feeding many numbers), never
// for a per-row outcome.
// ─────────────────────────────────────────────────────────────────────────────
function ScrubTrack({ value, min = 0, max, step = 1, onChange, colour = 'var(--c-acc)', ariaLabel, valueText, height = 22 }) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0
  const startScrub = (e) => {
    e.preventDefault()
    const el = e.currentTarget
    const trackW = el.getBoundingClientRect().width || 1
    const x0 = e.clientX, v0 = Number(value)
    try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const move = (ev) => {
      const dx = (ev.clientX ?? x0) - x0
      let v = v0 + (dx / trackW) * (max - min)
      v = Math.round(v / step) * step
      onChange(Math.max(min, Math.min(max, v)))
    }
    const end = () => {
      try { el.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }
  return (
    <div>
      <div
        onPointerDown={startScrub}
        title="Drag to change the amount — every figure below updates together"
        style={{
          position: 'relative', height, borderRadius: 7,
          background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
          overflow: 'hidden', cursor: 'ew-resize', touchAction: 'none',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: colour, minWidth: pct > 0 ? 4 : 0, transition: 'width .08s linear' }} />
        <div aria-hidden style={{ position: 'absolute', right: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'none', opacity: 0.55 }}>
          <span style={{ width: 2, height: 10, borderRadius: 2, background: 'var(--c-text3)' }} />
          <span style={{ width: 2, height: 10, borderRadius: 2, background: 'var(--c-text3)' }} />
        </div>
      </div>
      {/* Keyboard-accessible mirror of the drag control */}
      <input
        type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        style={{ width: '100%', accentColor: colour, marginTop: 6 }}
      />
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

function SubTabSelector({ value, onChange, taxBadge, estateBadge, inline = false }) {
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
      margin: inline ? 0 : '4px 16px 12px',
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

// Plain tax-year label derived from the active rules bundle (no internal
// version code shown to users). 'UK-2026.1' → '2026/27'.
function taxYearLabelFromBundle() {
  const m = /(\d{4})/.exec(BRAND.rulesVersion || '')
  const y = m ? +m[1] : 2026
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 1B categorisation (founder issue 2/5, 2026-06-08): the Tax sub-tab was a flat
// wall of ~10 cards. It is now a grid of category TILES; tapping a tile opens a
// full-screen DRAWER that re-houses the existing cards. Drawer chrome mirrors the
// existing L3 drill panels (fixed · te-slide-up · sticky ← Back) for consistency.
// ─────────────────────────────────────────────────────────────────────────────
function CategoryDrawer({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && typeof onClose === 'function') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="screen" style={{
      position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
      background: 'var(--c-bg)',
      animation: 'te-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
      padding: '0 0 120px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 8px', borderBottom: '1px solid var(--c-sep)',
        position: 'sticky', top: 0, background: 'var(--c-bg)', zIndex: 10,
      }}>
        <button onClick={onClose} className="sw-press" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        <div style={{ width: 56 }} />
      </div>
      <div style={{ padding: '12px 16px 0' }}>{children}</div>
    </div>
  )
}

// Category tile — compact entry point: title · headline · sub · chevron.
// Compact per-matter mini-chart for a tile face (founder 2026-06-08: "charts to
// explain each taxation matter"). A single proportional bar — segments render
// left-to-right with their colour; a tiny legend names each. Used for tax-band
// composition, you-keep-vs-HMRC, gains-vs-exempt, estate-vs-IHT. The full chart
// lives in the drawer; this is the at-a-glance version.
function MiniProportionBar({ segments, height = 9 }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value || 0), 0)
  if (total <= 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
      <div style={{ display: 'flex', width: '100%', height, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {segments.map((s, i) => {
          const w = Math.max(0, s.value || 0) / total * 100
          return w > 0 ? (
            <div key={i} title={`${s.label}: ${Math.round(w)}%`} style={{ width: `${w}%`, background: s.colour, height: '100%' }} />
          ) : null
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
        {segments.filter(s => (s.value || 0) > 0).map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--c-text3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: s.colour, flexShrink: 0 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CatTile({ title, value, sub, tone = 'neutral', onClick, chart }) {
  const valColour = tone === 'danger' ? 'var(--c-danger)'
    : tone === 'warning' ? 'var(--c-warning)'
    : tone === 'success' ? 'var(--c-success)' : 'var(--c-text)'
  return (
    <button onClick={onClick} className="sw-press" style={{
      textAlign: 'left', cursor: 'pointer', width: '100%',
      background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="sw-eyebrow">{title}</span>
        <span style={{ color: 'var(--c-acc)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>›</span>
      </div>
      {value != null && (
        <div style={{ fontSize: 22, fontWeight: 700, color: valColour, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      )}
      {chart}
      {sub && <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.4 }}>{sub}</div>}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// "You vs the taxman" — the SIGNATURE visual, bespoke to Tax & Estate (founder
// 2026-06-08, replacing the borrowed radar). Answers the tab's own question:
// what goes to HMRC (now + at death) vs what you keep / pass on. Each segment
// drills to its tile. Figures PROVISIONAL, pending the independent calc audit.
// ─────────────────────────────────────────────────────────────────────────────
// One ring = one "you keep vs the taxman takes" split. Two arcs on a part-to-whole
// donut (same SVG-arc technique as FundDonut), positive % kept as the centre hero,
// the £ split below as two tappable legend rows that drill to the underlying tile.
function VsDonut({ title, centreSub, keepLabel, keepVal, takeLabel, takeVal, keepColour, onKeep, onTake, footer }) {
  const keep = Math.max(0, keepVal)
  const take = Math.max(0, takeVal)
  const total = keep + take
  const keepPct = total > 0 ? Math.round((keep / total) * 100) : 0
  const takePct = total > 0 ? 100 - keepPct : 0

  const size = 132, thickness = 15
  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const keepFrac = total > 0 ? keep / total : 0
  const keepDash = keepFrac * circ
  const takeDash = circ - keepDash

  const legendRow = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    width: '100%', padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid var(--c-sep)', background: 'var(--c-surface2, transparent)',
  }
  const dot = (c) => ({ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 })

  return (
    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="sw-eyebrow" style={{ alignSelf: 'flex-start' }}>{title}</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`${keepLabel} ${keepPct} percent versus ${takeLabel} ${takePct} percent`} style={{ display: 'block' }}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-sep)" strokeWidth={thickness} opacity="0.3" />
          {total > 0 && (
            <>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-danger)" strokeWidth={thickness}
                strokeDasharray={`${takeDash.toFixed(2)} ${(circ - takeDash).toFixed(2)}`} strokeDashoffset={(-keepDash).toFixed(2)} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={keepColour} strokeWidth={thickness}
                strokeDasharray={`${keepDash.toFixed(2)} ${(circ - keepDash).toFixed(2)}`} strokeDashoffset="0" />
            </>
          )}
        </g>
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--c-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>{keepPct}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9.5" fill="var(--c-text3)">{centreSub}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <button onClick={onKeep} className="sw-press" style={legendRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={dot(keepColour)} />
            <span style={{ fontSize: 11, color: 'var(--c-text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{keepLabel}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(keep)}</span>
        </button>
        <button onClick={onTake} className="sw-press" style={legendRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={dot('var(--c-danger)')} />
            <span style={{ fontSize: 11, color: 'var(--c-text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{takeLabel} · {takePct}%</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmt(take)}</span>
        </button>
      </div>
      {footer}
    </div>
  )
}
// The breakdown of the annual "To HMRC" slice — so the user sees the single red
// figure is actually FIVE taxes stacked, including the ones that are genuinely
// nil this year (shown greyed, not hidden — "covered, currently £0").
function HMRCComposition({ components = [], onOpen }) {
  const shown = components.filter(c => c && c.label)
  if (!shown.length) return null
  return (
    <button onClick={onOpen} className="sw-press" style={{
      marginTop: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
      border: '1px dashed var(--c-sep)', borderRadius: 10, background: 'transparent',
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <span style={{ fontSize: 9.5, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        That HMRC slice is five taxes ›
      </span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {shown.map((c, i) => {
          const nil = !(c.value > 0)
          return (
            <span key={i} style={{
              fontSize: 10.5, padding: '2px 7px', borderRadius: 99,
              background: nil ? 'transparent' : 'var(--c-danger-bg, rgba(255,59,48,.10))',
              border: `1px solid ${nil ? 'var(--c-sep)' : 'transparent'}`,
              color: nil ? 'var(--c-text3)' : 'var(--c-text)', whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {c.label} {nil ? '£0' : fmt(c.value)}
            </span>
          )
        })}
      </span>
    </button>
  )
}
// Projection banner shown when a non-"Today" viewmode is active (#23). For Future
// it states the real, dated post-2027 estate change; for Plan / What-if it is
// honest that those projection layers are the next build slice (no dead read).
function ProjectionBanner({ viewMode, ihtToday, ihtForecast }) {
  let tone = 'rgba(94,219,194,.12)', border = 'rgba(94,219,194,.30)', text
  if (viewMode === 'forecast') {
    const delta = Math.max(0, (ihtForecast || 0) - (ihtToday || 0))
    text = <>
      <strong>Future — projected to April 2027 rules.</strong> Your pension enters the estate, so inheritance
      tax rises from {fmt(ihtToday)} to {fmt(ihtForecast)} ({delta > 0 ? `+${fmt(delta)}` : 'no change'}).
      Income tax is unchanged: thresholds are frozen to 2028, so at today’s income your bill is the same —
      fiscal drag only bites as your income rises.
    </>
  } else {
    tone = 'rgba(255,179,71,.12)'; border = 'rgba(255,179,71,.32)'
    const which = viewMode === 'plan' ? 'Plan' : 'What-if'
    const what = viewMode === 'plan'
      ? 'applying your saved plans to project the post-plan position'
      : 'Budget what-if toggles that override individual rules'
    text = <><strong>{which} view.</strong> Showing today’s position — {what} is the next build slice, not yet wired.</>
  }
  return (
    <div style={{
      marginBottom: 12, padding: '9px 12px', borderRadius: 10,
      background: tone, border: `1px solid ${border}`,
      fontSize: 11.5, color: 'var(--c-text2)', lineHeight: 1.5,
    }}>{text}</div>
  )
}
// What-if lever strip (#23 slice 3). Self-contained — does NOT depend on
// Cashflow's SolverSlider (which was never actually extracted to shared). Only
// levers that genuinely move the donut: pay change (income) + sell home (estate,
// engine-flagged estimate). The donut above recomputes live against each.
function WhatIfLevers({ pay, setPay, sellHome, setSellHome }) {
  return (
    <div style={{
      marginBottom: 12, padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,179,71,.10)', border: '1px solid rgba(255,179,71,.30)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 11, color: 'var(--c-text2)' }}>
        <strong>What-if.</strong> Drag or toggle to see your tax & estate move live — illustrative, not advice.
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: 'var(--c-text3)' }}>Pay change</span>
          <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {pay > 0 ? '+' : ''}{pay}%
          </span>
        </div>
        <input type="range" min={-50} max={50} step={1} value={pay}
          onChange={(e) => setPay(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: 'var(--c-acc)' }}
          aria-label="Pay change percent" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--c-text2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={sellHome} onChange={(e) => setSellHome(e.target.checked)} style={{ accentColor: 'var(--c-acc)' }} />
        Sell my main home <span style={{ color: 'var(--c-text3)', fontSize: 10 }}>(estate — simplified estimate)</span>
      </label>
    </div>
  )
}
// Plan view (#23 slice 2). Mr T's "plans" are GOAL TARGETS (zero IHT in 5 years
// via BPR positioning; retire at 60 / £2.5m), whose ACTIONS (gifts, BPR, pension
// relief) are not snapshot levers — so Plan honestly shows where the plans AIM
// versus today + the gap to close, routing the "how" to Choices, rather than
// fabricating a donut recompute the available levers can't produce.
function PlanBanner({ plans = [], ihtToday }) {
  const active = (plans || []).filter(p => p?.status !== 'archived')
  const estate = active.find(p => p?.type === 'estate')
  const retire = active.find(p => p?.type === 'retirement')
  if (!active.length) return null
  const ihtTarget = estate?.target?.ihtCap
  const gap = (ihtTarget != null) ? Math.max(0, (ihtToday || 0) - ihtTarget) : null
  return (
    <div style={{
      marginBottom: 12, padding: '9px 12px', borderRadius: 10,
      background: 'rgba(94,219,194,.12)', border: '1px solid rgba(94,219,194,.30)',
      fontSize: 11.5, color: 'var(--c-text2)', lineHeight: 1.55,
    }}>
      <strong>Plan view — where your plans aim.</strong>
      {estate && ihtTarget != null && (
        <div style={{ marginTop: 3 }}>
          • <em>{estate.label}</em>: target IHT {fmt(ihtTarget)} · today {fmt(ihtToday)}
          {gap > 0 ? <> · <strong>{fmt(gap)}</strong> to close</> : <> · <strong>on target</strong></>}.
        </div>
      )}
      {retire?.target?.netWorth != null && (
        <div style={{ marginTop: 3 }}>
          • <em>{retire.label}</em>: target {fmt(retire.target.netWorth)} net worth{retire.target.age ? ` by age ${retire.target.age}` : ''}.
        </div>
      )}
      <div style={{ marginTop: 4, color: 'var(--c-text3)', fontSize: 10.5 }}>
        The actions to get there (gifts, BPR positioning, pension relief) live in Choices.
      </div>
    </div>
  )
}
function TaxVsHMRC({ incomeGross, incomeTax, incomeComponents, estateGross, iht, family, banner, onDrill }) {
  const incKeep = Math.max(0, incomeGross - incomeTax)
  return (
    <div className="card sw-card-elevated">
      {banner}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div className="sw-eyebrow">You vs the taxman</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>tap a figure to see how</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <VsDonut
          title="Your income this year"
          centreSub="you keep"
          keepLabel="You keep" keepVal={incKeep} keepColour="var(--c-success)"
          takeLabel="To HMRC" takeVal={incomeTax}
          onKeep={() => onDrill('income')} onTake={() => onDrill('income')}
          footer={<HMRCComposition components={incomeComponents} onOpen={() => onDrill('income')} />}
        />
        <VsDonut
          title="Your estate when you die"
          centreSub="to family"
          keepLabel="Family receives" keepVal={family} keepColour="var(--c-acc)"
          takeLabel="Inheritance tax" takeVal={iht}
          onKeep={() => onDrill('est-iht')} onTake={() => onDrill('est-iht')}
        />
      </div>
      <p style={{ fontSize: 10, color: 'var(--c-text3)', margin: '12px 2px 0' }}>
        Figures are provisional, pending review.
      </p>
    </div>
  )
}

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
        sub={`Gross ${fmt(grossInc)} · adjusted net income ${fmt(ani.ani)} · Effective rate ${fmtPct(effRate)}`}
        accessory={<ProvenanceChip sources={[`HMRC ${taxYearLabelFromBundle()} rates`, 'your income', 'your investments']} />}
      />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}>
        <StatTile
          label="Income tax (this year)"
          value={fmt(components.income_tax || 0)}
          colour="var(--c-warning)"
        />
        <StatTile
          label="Dividend tax"
          value={fmt(components.dividend_tax || 0)}
          colour="var(--c-warning)"
        />
        <StatTile
          label="Capital gains tax"
          value={fmt(components.cgt || 0)}
          colour="var(--c-danger)"
        />
        <StatTile
          label="National Insurance"
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
  // Issue 4 (founder 2026-06-08): the card rendered as a near-blank tile when no
  // income tax was due — empty chart + a single £0 row. Graceful empty state.
  const totalBandTax = displayBands.reduce((s, b) => s + (b.tax ?? b.amount ?? 0), 0)

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Income tax detail"
        sub={`Marginal ${fmtPct(itd.marginal_rate)} · ${
          sco.applies ? 'Scottish rates' : wel.applies ? 'Welsh rates' : 'UK rates (excluding Scotland)'
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
          <strong>60% effective rate band</strong> · adjusted net income is in the £{TAX.adjustedNetIncomeCliff.toLocaleString()}–£{TAX.art.toLocaleString()} personal-allowance taper.
          Each £1 of income loses 50p of personal allowance — effective marginal 60%.
        </FadeInOnMount>
      )}

      {totalBandTax <= 0 ? (
        <div style={{
          padding: 'var(--space-md)',
          fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
        }}>
          <strong style={{ color: 'var(--c-success)' }}>No income tax is showing for this year.</strong>{' '}
          Your taxable income currently sits within your tax-free allowances and the basic-rate band.
          As your income rises, this chart fills in to show exactly which slice of it is taxed at each rate —
          basic (20%), higher (40%) and additional (45%).
        </div>
      ) : (
        <>
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
        </>
      )}
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
        title="Adjusted net income"
        sub="The income figure HMRC uses to decide your £100k allowance taper — worked out step by step"
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
  // Read the real taxonomy (investments[]: GIA / crypto / PE with cost_base),
  // not the empty assets.portfolio summary blob. (#18)
  const holdings = cgtChargeableHoldings(entity)
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
        {badrFlagged && <Chip tone="warn">Business sale relief (BADR) 14% → {Math.round((TAX?.badrRate ?? 0.18) * 100)}% in 2026/27</Chip>}
        {(cgt.pending || []).some(p => p.bed_and_isa_opportunity) && (
          <Chip tone="info">Bed-and-ISA opportunity (sell then re-buy inside an ISA)</Chip>
        )}
        {cgt.spousal_transfer_opportunity && (
          <Chip tone="info">Spousal transfer headroom</Chip>
        )}
      </div>
    </div>
  )
}

// "Other taxes in your situation" — taxes that apply because of WHO you are
// (landlord, company director, multi-property owner), not your annual income or
// your estate. Renders only the rows that genuinely apply. (#20 s24 · #21 SDLT
// · #22 corporation tax). Figures from situational-taxes.js; estimates labelled.
function SituationalTaxes({ entity }) {
  const rows = safe(() => situationalTaxes(entity), []) || []
  const [open, setOpen] = useState(null)
  if (!rows.length) return null

  const rowHead = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid var(--c-sep)', background: 'var(--c-surface2, transparent)',
  }
  const sub = { fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }

  const render = (r) => {
    if (r.kind === 's24') {
      return {
        head: 'Landlord tax — Section 24', icon: '🏠',
        headline: `${fmt(r.grossRent)} → ${fmt(r.netAfterS24)} taxable`,
        body: (
          <div style={{ padding: '4px 2px 2px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={sub}>{r.note}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip tone="neutral">Gross rent {fmt(r.grossRent)}</Chip>
              <Chip tone="warn">Taxable after s24 {fmt(r.netAfterS24)}</Chip>
              {r.basicRateCredit != null
                ? <Chip tone="info">20% interest credit {fmt(r.basicRateCredit)}</Chip>
                : <Chip tone="neutral">Mortgage-interest figure pending</Chip>}
            </div>
          </div>
        ),
      }
    }
    if (r.kind === 'sdlt') {
      return {
        head: 'Stamp duty on your property portfolio', icon: '📜',
        headline: `${fmt(r.total)} · estimated`,
        body: (
          <div style={{ padding: '4px 2px 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {r.rows.map((p, k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--c-text2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.label} <span style={{ color: 'var(--c-text3)' }}>· {p.use}{p.date ? ` · ${String(p.date).slice(0, 4)}` : ''}</span>
                </span>
                <span style={{ fontWeight: 700, color: p.sdlt > 0 ? 'var(--c-text)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.sdlt > 0 ? fmt(p.sdlt) : '£0'}
                </span>
              </div>
            ))}
            <p style={{ ...sub, color: 'var(--c-text3)', marginTop: 2 }}>{r.assumptions}</p>
          </div>
        ),
      }
    }
    // corp
    return {
      head: 'Corporation tax behind your dividends', icon: '🏢',
      headline: `${fmt(r.totalCT)} · est. (company-level)`,
      body: (
        <div style={{ padding: '4px 2px 2px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.rows.map((c, k) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--c-text)', fontWeight: 700 }}>{c.name}</span>
                <span style={{ color: 'var(--c-text2)' }}>CT ~{fmt(c.ct)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip tone="neutral">Turnover {fmt(c.turnover)}</Chip>
                <Chip tone="neutral">Profit after tax {fmt(c.profitAfterTax)}</Chip>
                <Chip tone="neutral">≈ pre-tax {fmt(c.preTax)}</Chip>
                {c.vatRegistered && <Chip tone="info">VAT-registered (turnover &gt; £90k)</Chip>}
              </div>
              {c.ctBand && <span style={{ ...sub, color: 'var(--c-text3)' }}>{c.ctBand}</span>}
            </div>
          ))}
          {r.doubleTaxNote && (
            <p style={{ ...sub, padding: '8px 10px', background: 'var(--c-tint-amber, rgba(255,179,71,.12))', borderRadius: 8 }}>
              ⚠ {r.doubleTaxNote}
            </p>
          )}
          <p style={{ ...sub, color: 'var(--c-text3)' }}>
            Corporation-tax filing sits with the company; we model its personal impact only. Figure estimated by grossing profit-after-tax up under 2026/27 rates.
          </p>
        </div>
      ),
    }
  }

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Other taxes in your situation"
        sub="Taxes that apply because of what you own and do — landlord, director, property owner"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => {
          const v = render(r)
          const isOpen = open === i
          return (
            <div key={i}>
              <button onClick={() => setOpen(isOpen ? null : i)} className="sw-press" style={rowHead}
                aria-expanded={isOpen}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span aria-hidden>{v.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.head}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{v.headline}</span>
                  <span style={{ color: 'var(--c-acc)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                </span>
              </button>
              {isOpen && v.body}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 10, color: 'var(--c-text3)', margin: '10px 2px 0' }}>
        Figures marked “estimated” are illustrative, pending review.
      </p>
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
      <SectionHead title="Dividend tax" sub={`Effective rate ${fmtPct(div.effective_rate || 0)} on £${(div.gia_exposed || 0).toLocaleString()} held in a general investment account (GIA)`} />
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
          Held in an ISA (Individual Savings Account — tax-free), the dividend tax on this amount — about {fmt(div.move_to_isa_opportunity.tax_saving_annual)}/year —
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
  // Pension Annual Allowance + 3-year carry-forward — the biggest carry-forward
  // lever, and the one most users miss (TE-DOMAIN-RESEARCH §3 headline · founder
  // T-j "what about what I haven't used yet"). Estate-engine tracker carries the
  // correct pension_aa shape; the M1 ledger flags provisional so an unknown prior
  // year reads "estimated", never a silent £0.
  const pen = safe(() => teAllowanceTracker(entity).pension_aa, null)
  const cfLedger = safe(() => buildCarryForwardLedger(entity), null)
  const cfArr = cfLedger?.fields?.pension_aa_unused || []
  const cfTotal = cfArr.reduce((s, v) => s + Math.max(0, v || 0), 0)
  const cfProvisional = !!cfLedger?.provenance?.pension_aa_unused?.provisional
  const cyTotal = pen?.current_year?.total || 0
  const cyUsed = Math.min(pen?.current_year?.used || 0, cyTotal)
  const cyRemaining = pen?.current_year?.remaining ?? Math.max(0, cyTotal - cyUsed)
  const penTotalAvail = cyRemaining + cfTotal
  // Honest-absence: current-year contributions are read from a canonical field
  // (entity.pensionContributions / .contributionsThisYear). Many personas don't
  // populate it (they model per-pot monthlyContribution instead), so a £0 here is
  // a silent-zero, not a confirmed zero — present it as provisional rather than
  // asserting "£60k available". See the pension-contribution plumbing note.
  const cyProvisional = cyUsed === 0
  const penProvisional = cyProvisional || cfProvisional
  const items = [
    { id: 'isa',       label: 'ISA (tax-free savings)',          d: at.isa },
    { id: 'psa',       label: 'Personal savings allowance (PSA)', d: at.psa },
    { id: 'cgt',       label: 'Capital gains tax-free amount',    d: at.cgt },
    { id: 'dividend',  label: 'Dividend allowance',              d: at.dividend },
    { id: 'pa',        label: 'Personal allowance',              d: at.pa },
  ].filter(x => x.d)
  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Allowances — what's left to use" sub={`${100 - (at.utilization || 0)}% of your allowances still available`} />
      {/* Pension AA carry-forward — the headline "what you haven't used" insight,
          surfaced first because it's the only large allowance that carries forward. */}
      {pen && cyTotal > 0 && (
        <div style={{
          marginBottom: 12, padding: '11px 13px',
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-mint-text)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Pension annual allowance</span>
            <span className="sw-chip sw-chip-sm sw-chip-mint sw-chip-outline" style={{ whiteSpace: 'nowrap' }}>Carries forward 3 yrs</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 5, lineHeight: 1.5 }}>
            {cyProvisional
              ? <>This year: we don&rsquo;t have your pension contributions yet — your full <strong>{fmt(cyTotal)}</strong> allowance may be available.</>
              : <>This year: {fmt(cyUsed)} used of {fmt(cyTotal)} · <strong>{fmt(cyRemaining)}</strong> still available.</>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 2, lineHeight: 1.5 }}>
            {cfProvisional
              ? <>Carried forward (last 3 years): not yet known — add your last three years&rsquo; pension contributions to see what you can still use.</>
              : <>Carried forward (last 3 years): <strong style={{ color: 'var(--c-mint-text)' }}>{fmt(cfTotal)}</strong> still usable.</>}
          </div>
          {!penProvisional && (
            <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 7 }}>
              Up to {fmt(penTotalAvail)} you could still pay in with full tax relief.
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--c-text3)', marginTop: 5, lineHeight: 1.45 }}>
            Unlike your ISA, dividend and capital-gains allowances — which reset and are lost each 5 April — unused pension allowance carries forward three tax years.{penProvisional ? ' Add your pension details to turn this estimate into your real figures.' : ''}
          </div>
        </div>
      )}
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
                    ? `${fmt(Math.min(d.used || 0, d.limit || 0))} / ${fmt(d.limit || 0)}`
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
        <strong>Cash-ISA £12k cap (announced)</strong> · From 6 Apr 2027 the amount you can hold in a
        cash ISA is set to fall to £12,000 for under-65s; the remaining £8,000 of your £20,000 ISA
        allowance would need to go into a stocks-and-shares ISA, an innovative-finance ISA, or a
        Lifetime ISA instead.
      </div>
    </div>
  )
}

// §5.10 — Self Assessment. Single source of truth = the SA computation card at
// the top of the Tax sub-tab (saComputation). This drawer used to derive its OWN
// "balance via SA" (dividend+savings+CGT) which contradicted the card's balancing
// payment (T1 audit fix, 2026-06-09). It now reads the SAME canonical computation
// (with the same prior-year store the card uses) so the two surfaces always agree,
// and points the user to the full estimate rather than duplicating it.
function SelfAssessment({ entity, personaId, onSeeFull }) {
  const sa = safe(() => te_selfAssessment(entity), null)
  if (!sa) return null
  const required = sa.needs_sa ?? sa.required ?? false
  const src = sa.income_sources || []
  const reason = !required ? 'Tax settled at source — no return needed'
    : src.some(s => /divid/i.test(s)) ? 'Dividends / rental / untaxed income above SA thresholds'
    : 'Income above a Self-Assessment threshold'

  // Canonical balance + deadline from the SA computation (same prior-year store
  // as the card → ties out exactly, including after a prior year is captured).
  const store = personaId ? safe(() => deriveCarryForwardFromHistory(personaId, '2026/27'), null) : null
  const saC = safe(() => saComputation(entity, 'tax-2026-27', 'UK-2026.1', {
    priorYearStore: store, priorYearLiability: store?._priorYearLiability,
  }), null)
  const balancing = saC?.computation?.balancing_payment ?? 0
  const provisional = saC?.confidence === 'low'
  // Next 31 Jan filing deadline (UTC-stable), consistent with the Timeline.
  const now = new Date()
  const jan31 = new Date(Date.UTC(now.getUTCFullYear(), 0, 31))
  if (jan31 <= now) jan31.setUTCFullYear(now.getUTCFullYear() + 1)
  const deadline = jan31.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Self Assessment" sub={`Next deadline: ${deadline}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatTile
          label="Estimated balance due"
          value={`${fmt(balancing)}${provisional ? ' (est.)' : ''}`}
          colour={balancing > 0 ? 'var(--c-danger)' : 'var(--c-text)'}
        />
        <StatTile label="Filing required?" value={required ? 'Yes' : 'No'} sub={reason} />
      </div>
      <button
        onClick={() => { onSeeFull?.(); requestAnimationFrame(() => document.querySelector('[data-sa-computation]')?.scrollIntoView({ block: 'start', behavior: 'smooth' })) }}
        className="sw-chip"
        style={{ marginTop: 10, cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}
      >
        See your full Self-Assessment estimate ↑
      </button>
    </div>
  )
}

// Document home (founder review #7: "Self-assessment does nothing"). Upload or
// scan a tax document → the parser service extracts the figures → an FP-5 verify
// list shows each field with its confidence so the user confirms before anything
// is used. Runs against the mock parser today (values are invented + clearly
// flagged); swapping in real OCR is one provider change in services/parser.js.
function SelfAssessmentDocs({ entity, personaId, onCommit, onClose }) {
  const [status, setStatus] = useState('idle')   // idle | parsing | done | error
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)

  // T4 (2026-06-09): the parsed figures now SAVE to the prior-year SA store, so an
  // uploaded SA302 firms up the Self-Assessment estimate (was a dead "pre-fill"
  // promise). Heuristic field→record mapping (mock parser; clearly flagged).
  const saveToHistory = () => {
    const fields = result?.fields || []
    const pick = (re) => { const f = fields.find(x => re.test(`${x.label} ${x.id}`)); return f ? Math.round(+f.value || 0) : undefined }
    const taxYear = (() => {
      const yf = fields.find(x => /tax year|year/i.test(`${x.label} ${x.id}`))
      const m = yf && String(yf.value).match(/(20\d{2})/)
      if (m) { const y = +m[1]; return `${y}/${String(y + 1).slice(-2)}` }
      const now = new Date(); const py = now.getUTCFullYear() - 1
      return `${py}/${String(py + 1).slice(-2)}`
    })()
    const record = {
      taxYear, source: 'upload', filed: true,
      confidence: Math.min(...fields.map(f => f.confidence ?? 1), 1),
      figures: {
        totalIncome: pick(/total income|income received/i) ?? 0,
        payeTaxPaid: pick(/paye|tax (deducted|taken)/i) ?? 0,
        incomeTaxPlusClass4: pick(/income tax.*class 4|total tax due|tax due/i) ?? (pick(/income tax/i) ?? 0),
        pensionAaUnused: pick(/unused|carry.?forward|annual allowance/i) ?? 0,
        lossesCarried: { capital: pick(/capital loss/i) ?? 0, rental: 0, trading: pick(/trading loss/i) ?? 0 },
        gifts: [],
      },
      provenance: { channel: 'upload', documentRef: fileName },
    }
    upsertPriorYear(personaId, record)
    const derived = safe(() => deriveCarryForwardFromHistory(personaId, '2026/27'), null)
    if (derived && onCommit && personaId) {
      const { _priorYearLiability, ...cf } = derived
      onCommit(personaId, { type: 'PRIOR_YEAR_SA_CAPTURED', payload: { taxYear: record.taxYear, carryForward: cf } })
    }
    setSaved(true)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setStatus('parsing'); setErr(''); setResult(null)
    try {
      const r = await parseDocument(file, { docTypeHint: 'self-assessment' })
      setResult(r); setStatus('done')
    } catch (ex) { setErr(ex?.message || 'Could not read this document'); setStatus('error') }
  }

  const fmtField = (f) => f.unit === 'gbp' ? fmt(f.value)
    : f.unit === 'pct' ? `${(f.value * 100).toFixed(2)}%`
    : String(f.value)

  const confident = (result?.fields || []).filter(f => f.confidence >= 0.75)
  const needsReview = (result?.fields || []).filter(f => f.confidence < 0.75)

  return (
    <div className="card sw-card-elevated">
      <SectionHead title="Documents — upload & pre-fill" sub="SA302 · P60 · P11D · SIPP / ISA statements" />

      <label className="sw-press" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        border: '1.5px dashed var(--c-border)', borderRadius: 14, padding: '20px 16px',
        cursor: 'pointer', textAlign: 'center', background: 'var(--c-surface2)',
      }}>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onFile} style={{ display: 'none' }} />
        <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">⬆</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>Upload or scan a document</span>
        <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>PDF or photo — we read the figures and pre-fill your return</span>
      </label>

      {status === 'parsing' && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--c-text2)' }}>
          Reading <strong>{fileName}</strong>…
        </div>
      )}
      {status === 'error' && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--c-danger)' }}>{err}</div>
      )}

      {status === 'done' && result && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.warnings?.length > 0 && (
            <div style={{
              fontSize: 11, color: 'var(--c-warning)', background: 'rgba(255,180,71,0.10)',
              border: '1px solid rgba(255,180,71,0.3)', borderRadius: 10, padding: '8px 10px',
            }}>
              ⚠ {result.warnings[0]}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            Detected <strong style={{ color: 'var(--c-text2)' }}>{result.docType}</strong> · {confident.length} field{confident.length === 1 ? '' : 's'} ready to pre-fill · {needsReview.length} need{needsReview.length === 1 ? 's' : ''} your review
          </div>

          {result.fields.map(f => {
            const low = f.confidence < 0.75
            return (
              <div key={f.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                borderTop: '1px solid var(--c-sep)', paddingTop: 8,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--c-text)', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{f.source}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmtField(f)}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                    color: low ? 'var(--c-warning)' : 'var(--c-success)',
                  }}>
                    {low ? `Review · ${Math.round(f.confidence * 100)}%` : `Confident · ${Math.round(f.confidence * 100)}%`}
                  </span>
                </div>
              </div>
            )
          })}

          {saved ? (
            <div style={{ fontSize: 12, color: 'var(--c-success)', fontWeight: 600, marginTop: 2 }}>
              ✓ Saved to your tax history — your Self-Assessment estimate is updated.{' '}
              {onClose && <button onClick={onClose} className="sw-chip" style={{ marginLeft: 6, cursor: 'pointer', fontSize: 11, padding: '3px 10px' }}>View estimate ↑</button>}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                Check the figures above, then save them to your tax history — they firm up your Self-Assessment estimate. Nothing is saved until you tap Save.
              </div>
              <button
                onClick={saveToHistory}
                className="sw-chip sw-chip-mint"
                style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '7px 14px', alignSelf: 'flex-start' }}
              >
                Save these figures to my tax history
              </button>
            </>
          )}
        </div>
      )}
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

  // FLEXIBILITY (2026-06-07): drawdown rate is the shared driver. Drag the bar
  // (or key the slider) and the tax / net / IHT-saved at that drawdown all
  // rescale live, interpolated off the engine matrix rows (no re-typed maths).
  const sortedRows = [...ddm.rows].sort((a, b) => a.drawdown - b.drawdown)
  const ddMin = sortedRows[0].drawdown
  const ddMax = sortedRows[sortedRows.length - 1].drawdown
  const ddStep = sortedRows.length > 1 ? Math.max(1000, Math.round((sortedRows[1].drawdown - sortedRows[0].drawdown))) : 5000
  const [selectedDraw, setSelectedDraw] = useState(() => {
    const seed = currentDD || ddm.recommended || sortedRows[0].drawdown
    return Math.max(ddMin, Math.min(ddMax, seed))
  })
  // Linear-interpolate a metric at the selected drawdown between bracketing rows.
  const interp = (key) => {
    if (selectedDraw <= ddMin) return sortedRows[0][key] || 0
    if (selectedDraw >= ddMax) return sortedRows[sortedRows.length - 1][key] || 0
    let lo = sortedRows[0], hi = sortedRows[sortedRows.length - 1]
    for (let i = 0; i < sortedRows.length - 1; i++) {
      if (sortedRows[i].drawdown <= selectedDraw && sortedRows[i + 1].drawdown >= selectedDraw) {
        lo = sortedRows[i]; hi = sortedRows[i + 1]; break
      }
    }
    const span = (hi.drawdown - lo.drawdown) || 1
    const t = (selectedDraw - lo.drawdown) / span
    return Math.round((lo[key] || 0) + ((hi[key] || 0) - (lo[key] || 0)) * t)
  }
  const liveTax = interp('tax')
  const liveNet = interp('net')
  const liveIhtSaved = interp('ihtSaved')
  const inDepthLive = selectedDraw >= TAX.adjustedNetIncomeCliff && selectedDraw <= TAX.art

  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Drawdown matrix"
        sub={`Recommended ${fmt(ddm.recommended || 0)}/yr${guard ? ` · Guardrail ${fmt(guard)}` : ''}`}
      />

      {/* Shared-input driver — drag to pick a drawdown; figures below rescale */}
      <div style={{ marginBottom: 14, padding: 12, background: 'var(--c-surface2)', borderRadius: 'var(--r-md)', border: '1px solid var(--c-sep)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>Model a drawdown</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }} data-tieout="drawdown.selected">{fmt(selectedDraw)}/yr</span>
        </div>
        <ScrubTrack
          value={selectedDraw}
          min={ddMin}
          max={ddMax}
          step={ddStep}
          onChange={setSelectedDraw}
          colour={inDepthLive ? 'var(--c-danger)' : 'var(--c-accent)'}
          ariaLabel={`Annual drawdown — currently ${fmt(selectedDraw)} per year. Drag to model a different drawdown; the tax, net income and IHT saved update live.`}
          valueText={`${fmt(selectedDraw)} per year`}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          <StatTile label="Tax" value={fmt(liveTax)} />
          <StatTile label="Net" value={fmt(liveNet)} />
          <StatTile label="IHT saved" value={fmt(liveIhtSaved)} />
        </div>
        {inDepthLive && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-danger)' }}>
            <strong>60% effective rate band</strong> — this drawdown pushes your adjusted net income into the £{TAX.adjustedNetIncomeCliff.toLocaleString()}–£{TAX.art.toLocaleString()} taper.
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--c-text3)' }}>
          Interpolated from the engine matrix below · provisional, pending professional sign-off.
        </div>
      </div>
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
            // Selected-via-scrub row — highlight whichever matrix row the driver
            // is closest to, so the table tracks the control above.
            const isSelected = Math.abs(r.drawdown - selectedDraw) <= ddStep / 2
            const inDepth = r.drawdown >= TAX.adjustedNetIncomeCliff && r.drawdown <= TAX.art
            const isRecommended = r.drawdown === ddm.recommended
            const netPct = Math.round(((r.net || 0) / maxNet) * 100)
            const rowCls = isCurrent || isSelected ? 'sw-pulse-glow' : ''
            return (
              <div key={i} className={rowCls} style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 1fr 1fr',
                gap: 6, alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 'var(--r-md)',
                border: isSelected ? '1px solid var(--c-accent)' : isCurrent ? '1px solid var(--c-warning)' : '1px solid transparent',
                background: isSelected
                  ? 'var(--c-tint-blue)'
                  : isRecommended
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

      <SliderRow label="Pension (SIPP) drawdown — annual" value={deltas.sippDraw} max={120000} step={5000}
        onChange={v => setDeltas(d => ({ ...d, sippDraw: v }))}
        note="Modelled over 20 years — reduces estate by drawing down pension before death" />
      <SliderRow label="Gifts (potentially exempt transfers / PETs)" value={deltas.gift} max={Math.max(500000, declaredGift)} step={5000}
        onChange={v => setDeltas(d => ({ ...d, gift: v }))}
        note={declaredGift > 0
          ? `Seeded from your declared £${(declaredGift/1000).toFixed(0)}k trust gift. A gift leaves your estate fully after 7 years; tax tapers between years 3 and 7.`
          : "One-off gift. A gift leaves your estate fully after 7 years; tax tapers between years 3 and 7."} />
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
        aria-label={`${label} — currently ${fmt(value)}. Drag to model a different amount; the estate figures update live.`}
        aria-valuetext={fmt(value)}
        style={{ width: '100%', accentColor: 'var(--c-acc)' }} />
      {note && <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

// §8.20 — Year-by-year IHT projection table
// FLEXIBILITY (2026-06-07): growth rate + projection horizon are the two hidden
// drivers behind every figure in this table. The footnote used to STATE the
// growth assumption ("4.0% p.a.") with no way to change it — a hard-coded
// number whose driver was invisible. Now both are visible, grabbable sliders;
// dragging either re-drives the engine series live. We do NOT re-derive the
// projection inline — we feed a user-set assumption (expectedReturn) into the
// canonical te_ihtProjectionSeries engine fn, which already reads it.
function IHTYearByYear({ entity }) {
  const entityGrowth = Number.isFinite(+entity?.expectedReturn) ? +entity.expectedReturn : 0.04
  const [growth, setGrowth] = useState(entityGrowth)
  const [horizon, setHorizon] = useState(5)

  // Override growth by shallow-cloning the entity with the user's chosen rate —
  // the engine series fn reads entity.expectedReturn, so this is supplying an
  // input, not re-implementing the maths.
  const projEntity = useMemo(
    () => (growth === entityGrowth ? entity : { ...(entity || {}), expectedReturn: growth }),
    [entity, growth, entityGrowth],
  )

  const rows = useMemo(() => {
    try {
      const r = te_ihtProjectionSeries(projEntity, horizon)
      return Array.isArray(r) ? r : []
    } catch { return [] }
  }, [projEntity, horizon])

  if (!rows.length) return null

  const baseIHT = rows[0]?.ihtDue ?? 0
  const resetGrowth = () => setGrowth(entityGrowth)

  return (
    <RevealCard
      cardId="te-iht-projection"
      title="Year-by-year IHT projection"
      entity={entity}
      defaultOpen={false}
      headerAccessory={<Chip tone="neutral" size="sm">est · not advice</Chip>}
    >
      <div style={{ padding: '0 0 12px' }}>
        {/* Grabbable drivers — growth rate + projection horizon */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          padding: '4px 0 12px',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--c-text3)' }}>Growth rate</span>
              <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {(growth * 100).toFixed(1)}%
                {growth !== entityGrowth && (
                  <button onClick={resetGrowth} className="sw-press" style={{
                    marginLeft: 6, fontSize: 10, color: 'var(--c-acc)', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 600,
                  }}>reset</button>
                )}
              </span>
            </div>
            <input
              type="range" min={0} max={0.08} step={0.005}
              value={growth}
              aria-label="Assumed annual growth rate for the IHT projection"
              onChange={e => setGrowth(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-acc)' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--c-text3)' }}>Project forward</span>
              <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {horizon} year{horizon === 1 ? '' : 's'}
              </span>
            </div>
            <input
              type="range" min={2} max={15} step={1}
              value={horizon}
              aria-label="Number of years to project the estate forward"
              onChange={e => setHorizon(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--c-acc)' }}
            />
          </div>
        </div>

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
                      {fmt(row.estateValue)}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: row.ihtDue > 0 ? 'var(--c-bad, #ef4444)' : 'var(--c-good, #22c55e)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {row.ihtDue > 0 ? fmt(row.ihtDue) : '—'}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: delta > 0 ? 'var(--c-bad, #ef4444)' : delta < 0 ? 'var(--c-good, #22c55e)' : 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
                      {i === 0 ? '—' : delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${fmt(Math.abs(delta))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 8, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--c-text2)' }}>How we worked this out:</strong>{' '}
          Each year your non-pension estate and pension pot grow at {(growth * 100).toFixed(1)}% p.a.
          (the slider above — {growth === entityGrowth ? 'your assumption' : 'your override'}). We freeze the
          nil-rate band (£{(TAX.nrb ?? 325000).toLocaleString('en-GB')}) and residence band per current policy,
          deduct the £{(TAX.annualGiftExemption ?? 3000).toLocaleString('en-GB')}/yr gift exemption, and from
          6 Apr 2027 add your unused pension into the estate (Finance Act 2026, enacted). IHT is charged at 40%
          on the taxable balance. Illustrative under your assumptions — not advice.
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
                  {g.kind && (
                    <Chip tone="neutral" title={g.kind === 'CLT'
                      ? 'Chargeable Lifetime Transfer — a gift into trust'
                      : 'Potentially Exempt Transfer — a gift to an individual'}>
                      {g.kind}
                    </Chip>
                  )}
                  <Chip tone={pct >= 100 ? 'good' : 'warn'}>
                    {pct >= 100 ? 'IHT-free' : `${fmtPct(g.taperPct || 0, 0)} taper`}
                  </Chip>
                  {pct < 100 && g.withinNRB && (
                    <Chip tone="good" title="The gift is covered by the £325,000 nil-rate band (after the £3,000 annual exemption), so no IHT is due even within 7 years.">
                      Within nil-rate band · £0 IHT
                    </Chip>
                  )}
                  {pct < 100 && !g.withinNRB && (
                    <Chip tone="neutral" title="IHT if you died today — charged only on the part above the nil-rate band, reduced by taper relief.">
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

// §6.11 — RNRB taper gauge — INTERACTIVE (FLEXIBILITY 2026-06-07).
// Gross estate is the shared driver: drag the bar (or key the slider) to vary it
// and the effective RNRB / lost-to-taper / IHT-on-the-lost-band all rescale live
// off rnrbTaper(grossEstate). Taper threshold + RNRB read from TAX, never typed.
function RNRBPlanning({ entity }) {
  const baseTaper = safe(() => rnrbTaper(entity), null)
  const elig  = safe(() => rnrbEligibility(entity), null)
  // RNRB taper is tested on the NET estate (value after liabilities, before
  // reliefs) — HMRC reduces RNRB by £1 per £2 the *net* estate exceeds £2m. This
  // previously read ihtDynamic(...).gross (gross ASSETS, pre-liability), which
  // would falsely trip the taper for a mortgaged estate whose net value is under
  // £2m. Now reads the screen's canonical te_ihtExposure.net_estate, so the gauge
  // and the IHT engine agree and the cliff sits in the right place.
  const estate = safe(() => te_ihtExposure(entity), { net_estate: 0 })
  const baseGross = estate.net_estate || 0
  const taperStart = TAX.rnrbTaper                 // £2,000,000 taper threshold
  const rnrbCap = TAX.rnrb
  const taperEnd = taperStart + 2 * rnrbCap        // RNRB fully tapered £1 per £2 over the threshold
  // Scrub range: from £0 up to a little past full taper-out so the user can drag
  // the estate across the cliff and watch the RNRB collapse.
  const scrubMax = Math.max(taperEnd + 500000, Math.ceil(baseGross / 100000) * 100000 + 500000)

  const [override, setOverride] = useState(null)
  const grossEstate = override == null ? baseGross : override
  const taper = useMemo(
    () => safe(() => rnrbTaper(grossEstate), baseTaper),
    [grossEstate, baseTaper],
  )
  if (!baseTaper) return null
  const eligible = elig?.eligible !== false
  const effectiveRnrb = eligible ? (taper?.rnrb || 0) : 0
  const lost = taper?.lost || 0
  const ihtOnLost = Math.round(lost * (TAX.ihtRate || 0.40))   // 40% relief lost on the tapered band
  const inTaper = grossEstate >= taperStart
  const dirty = override != null && Math.abs(override - baseGross) >= 1
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Residence nil-rate band (RNRB) planning"
        sub={`£${(effectiveRnrb || 0).toLocaleString()} effective · £${(lost || 0).toLocaleString()} lost to taper`}
        accessory={eligible ? <Chip tone="good">Eligible</Chip> : <Chip tone="bad">{elig?.reason || 'Not eligible'}</Chip>}
      />
      {inTaper && (
        <div style={{
          marginBottom: 10, padding: '8px 10px',
          background: 'rgba(255,179,71,.07)',
          border: '1px solid rgba(255,179,71,.30)',
          borderRadius: 10,
          fontSize: 12, color: 'var(--c-warning)',
        }}>
          <strong>£{(taperStart / 1e6).toFixed(0)}m taper</strong> · For each £2 your net estate exceeds £{taperStart.toLocaleString()},
          RNRB falls by £1. Lost in full at £{(taperEnd).toLocaleString()}.
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--c-text3)' }}>
            Net estate{dirty && <span style={{ color: 'var(--c-acc)', fontWeight: 700 }}> · modelled</span>}
          </span>
          <span style={{ color: 'var(--c-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} data-tieout="rnrb.gross-estate">{fmt(grossEstate)}</span>
        </div>
        <ScrubTrack
          value={Math.round(grossEstate)}
          min={0}
          max={scrubMax}
          step={25000}
          onChange={(v) => setOverride(v)}
          colour={inTaper ? 'var(--c-warning)' : 'var(--c-success)'}
          ariaLabel={`Net estate value — currently ${fmt(grossEstate)}. Drag to model a different estate; the residence nil-rate band and the tax lost to the £${taperStart.toLocaleString()} taper update live.`}
          valueText={fmt(grossEstate)}
        />
        {dirty && (
          <button
            onClick={() => setOverride(null)}
            className="sw-chip sw-chip-sm"
            style={{ marginTop: 8, cursor: 'pointer', background: 'var(--c-surface2)', border: '1px solid var(--c-sep)', color: 'var(--c-text2)' }}
          >
            Reset to your estate ({fmt(baseGross)})
          </button>
        )}
      </div>
      {/* Live dependent figures — rescale with the driver above */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: taper?.downsizingCredit > 0 ? 10 : 0 }}>
        <StatTile label="Effective RNRB" value={fmt(effectiveRnrb)} />
        <StatTile label="Lost to taper" value={fmt(lost)} />
        <StatTile label="IHT on lost band" value={fmt(ihtOnLost)} />
      </div>
      {taper?.downsizingCredit > 0 && (
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
  // Engine returns allowance_used / tier1_100pct / tier2_50pct_aim_or_not_listed;
  // the component previously read used / tier1Full / tier2Aim (all undefined → £0
  // despite £145k qualifying). Read the canonical names. (tax-tab audit fix #7.)
  const bprUsed = bpr.allowance_used ?? bpr.used ?? 0
  const tier1Full = bpr.tier1_100pct ?? bpr.tier1Full ?? 0
  const tier2Aim = bpr.tier2_50pct_aim_or_not_listed ?? bpr.tier2Aim ?? 0
  const cap = (entity?.isCouple ? (allow?.couple || 2 * TAX.bprCombinedCap) : (allow?.individual || TAX.bprCombinedCap))
  const usedPct = cap > 0 ? Math.round((bprUsed / cap) * 100) : 0
  return (
    <div className="card sw-card-elevated">
      <SectionHead
        title="Business & agricultural relief (BPR / APR)"
        sub={`${entity?.isCouple ? 'Couples £5m pool' : 'Single £2.5m allowance'} · used ${fmt(bprUsed)}`}
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
        <StatTile label="Tier 1 (full 100%)" value={fmt(tier1Full)} />
        <StatTile label="AIM (Tier 2 50%)"   value={fmt(tier2Aim)} />
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
  // Founder ruling 2026-06-07: the ESTATE odometer renders the estate-planning
  // SLICE, not the all-domains total. The all-domains figure stays on Home's
  // CoI anchor (unchanged). These are intentionally different quantities — the
  // explicit scope label is what stops the user conflating them.
  // Spec §Q1.2 canonical: costOfInaction(entity,'estatePlanning') → numeric
  // estate slice (= totalCoI().byDomain.estatePlanning, ~£70k for Bruce).
  // NOTE FOR CALC REVIEWER: the prompt named coiForDomain(entity,'estatePlanning')
  // but the canonical-metrics coiForDomain has NO 'estatePlanning' case and
  // returns null (string-builder for pensions/investments/property/etc.). The
  // numeric estate slice is costOfInaction(...,'estatePlanning'). Flagged.
  const coi = safe(() => totalCoI(entity), { total: 0, byDomain: {}, confidence: 'MED' })
  const estCoI = safe(() => costOfInaction(entity, 'estatePlanning'), 0) || 0
  const days = daysLeft() || 365
  const dailyRate = estCoI > 0 ? estCoI / Math.max(1, days) : 0
  // byAction sheet shows only the estate-relevant domains that feed this slice.
  const ESTATE_DOMAINS = new Set(['estatePlanning', 'gifting', 'protection'])
  const byAction = Object.entries(coi.byDomain || {})
    .filter(([k, v]) => v > 0 && ESTATE_DOMAINS.has(k))
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
        label="Cost of inaction · estate"
        scopeSub="Estate-planning actions only — see Home for the all-domains figure."
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
          border: '1px solid color-mix(in srgb, var(--c-gold) 55%, var(--c-border))',
          borderRadius: '12px',
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
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Capital gains tax at {Math.round((TAX?.cgtBasic ?? 0.18) * 100)}% (basic rate)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums' }}>{fmt(taxBasic)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Capital gains tax at {Math.round((TAX?.cgtHigher ?? 0.24) * 100)}% (higher rate)</span>
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
    { label: `IHT @ ${Math.round(TAX.ihtRate * 100)}%`, value: -ihtDue, colour: 'var(--c-danger)',  sign: '−' },
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: colour, fontVariantNumeric: 'tabular-nums' }}>
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
    { id: 'isa',       label: 'ISA (Individual Savings Account)', limit: TAX.isaAllowance ?? 20000,  d: at.isa,      colour: 'var(--c-acc)',     desc: `Annual ISA limit: ${fmt(TAX.isaAllowance ?? 20000)}. Contributions don't reduce your adjusted net income (ANI).` },
    { id: 'psa',       label: 'Personal savings allowance (PSA)',   limit: null,                    d: at.psa,      colour: 'var(--c-success)', desc: `Tax-free interest each year: ${fmt(TAX.psaBasic ?? 1000)} basic rate · ${fmt(TAX.psaHigher ?? 500)} higher rate · ${fmt(TAX.psaAdditional ?? 0)} additional rate.` },
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
          Based on UK {TAX.taxYear} thresholds · Not regulated advice
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
  // P2 reconciliation (2026-06-07): single canonical countdown source so this
  // banner, the sub-anchor tile and IHTDeltaCard all show the same day number.
  const daysLeft = sippIhtCountdownDays()
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
            ? 'From 6 April 2027, unused pensions are inside your estate for Inheritance Tax — IHT (Finance Act 2026).'
            : `From 6 April 2027 — in ~${monthsLeft} months — unused pensions enter your estate for Inheritance Tax (IHT). Planning options collapse after this date.`}
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

import useBundleVersion from '../hooks/useBundleVersion.jsx'

export default function TaxEstate({ entity, personaId, onCommit, onHome, onBack, onNav, onOpenRisk, onDrillMetric, hash, seed, ihtForceKey, onOpenDecision }) {
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

  // Pension-IHT chip / "See impact" now OPEN the IHT drawer (the dual-number
  // moved into a tile drawer in the 2026-06-08 Estate restructure, so the old
  // scroll-to-ref no longer has an on-page target).
  const ihtDualRef = useRef(null)
  const scrollToIHTDual = () => { setSubTab('estate'); setOpenTile('est-iht') }

  // ── L3 drill panel state ─────────────────────────────────────────────────
  // 'iht' → IHTDrillPanel  |  'allowances' → AllowanceDrillPanel  |  'bpr' → BPRDrillPanel  |  'cgt' → CGTDrillPanel
  const [drillView, setDrillView] = useState(null)

  // ── 1B category-drawer state (founder issue 2/5) — which Tax tile is open ──
  const [openTile, setOpenTile] = useState(null)
  // ── Choices tab (founder finding #1, 2026-06-08): the "Choices" levers live
  //    as a tab next to What-if in X28TopBar, matching Cashflow, not a block. ──
  const [showChoices, setShowChoices] = useState(false)

  // ── X28 top-bar state (window + view mode) ───────────────────────────────
  const [x28Window, setX28Window] = useState('current-tax-year')
  const [viewMode, setViewMode] = useState('actual')
  // What-if (scenario) levers — #23 slice 3. Only levers that genuinely move the
  // donut are exposed: pay change (income, robust) + sell home (estate, engine
  // flags it an estimate). max_pension is excluded — its relief lives in the
  // solver, not the snapshot, so it would be a dead lever here.
  const [wiPay, setWiPay] = useState(0)        // % pay change, -50..+50
  const [wiSellHome, setWiSellHome] = useState(false)
  // reset levers whenever What-if is exited so re-entry starts clean
  useEffect(() => { if (viewMode !== 'scenario') { setWiPay(0); setWiSellHome(false) } }, [viewMode])

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
  // Phase-2 viewmode projection (#23). 'forecast' (Future) recomputes the estate
  // against post-April-2027 rules (SIPP enters the estate) — a real, dated change
  // reusing the verified te_ihtExposure scenario path, no fabricated assumptions.
  // Income fiscal drag (frozen thresholds) is correctly nil at constant income,
  // so the Future banner explains it rather than inventing income growth.
  const forecast = viewMode === 'forecast'
  const exposureForMode = useMemo(
    () => forecast ? safe(() => te_ihtExposure(entity, undefined, { postPension: true }), exposureToday) : exposureToday,
    [forecast, entity, bv, exposureToday],
  )
  // What-if (scenario): fold the active levers onto a CLONED entity and recompute
  // the donut against the canonical engines, so every lever shown genuinely moves
  // a number (pay change → income tax; sell home → IHT). No dead levers.
  const scenario = viewMode === 'scenario'
  const whatIf = useMemo(() => {
    if (!scenario) return null
    const pins = []
    if (wiPay !== 0) pins.push({ id: 'pay_change', value: wiPay })
    if (wiSellHome) pins.push({ id: 'sell_home' })
    const ent = pins.length ? safe(() => applyLevers(entity, pins).entity, entity) : entity
    const tax = safe(() => te_taxThisYear(ent), null)
    return {
      active: pins.length > 0,
      incomeGross: tax?.gross || safe(() => calcAllIncome(ent)?.total, 0) || 0,
      incomeTax: tax?.total_tax || 0,
      components: tax?.components || null,
      exp: safe(() => te_ihtExposure(ent), exposureToday),
    }
  }, [scenario, wiPay, wiSellHome, entity, bv, exposureToday])
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

  // ── 1B Tax category-tile headlines (founder issue 2/5) ────────────────────
  const taxTiles = useMemo(() => {
    const txY  = safe(() => te_taxThisYear(entity), null) || {}
    const comp = txY.components || {}
    const allow = safe(() => allowanceTracker(entity), null)
    // Same gross fallback TaxSummary uses — te_taxThisYear may omit `gross`.
    const gross = txY.gross || safe(() => calcAllIncome(entity)?.total, 0) || 0
    // Embedded gains from the REAL chargeable holdings (investments[] with
    // cost_base) — not the stale assets.investments.unrealisedGain (investments
    // is an array, so that property is always undefined). Mirrors #18.
    const embeddedGain = safe(() => cgtChargeableHoldings(entity), [])
      .reduce((s, h) => s + Math.max(0, (h.currentValue || 0) - (h.baseCost || 0)), 0)
    const divDetail = safe(() => te_dividendTaxDetail(entity, entity.assets?.portfolio?.holdings || []), null)
    return {
      totalTax: txY.total_tax || 0,
      gross,
      effRate: txY.effective_rate || 0,
      allowLeft: 100 - (allow?.utilization || 0),
      // Tax composition (for the Income tile mini-chart): where the total tax goes.
      incomeTax: comp.income_tax || 0,
      nics: comp.nics || 0,
      savingsTax: comp.savings_tax || 0,
      dividendTax: comp.dividend_tax || 0,
      cgt: comp.cgt || 0,
      // Dividend split (for the Dividends tile): kept vs taxed on exposed dividends.
      dividendGross: divDetail?.gia_exposed || 0,
      // Allowance headroom (for the Allowances gauge).
      allowUsedPct: allow?.utilization || 0,
      hasDividend: (comp.dividend_tax || 0) > 0 || (allow?.dividend && (allow.dividend.used || 0) > 0),
      hasCGT: embeddedGain > 0 || (comp.cgt || 0) > 0,
      embeddedGain,
    }
  }, [entity, bv])

  // Situational taxes (landlord s24 / SDLT / corporation tax) — only the rows
  // that apply to THIS entity. Drives the "Other taxes in your situation" tile.
  const situational = useMemo(() => safe(() => situationalTaxes(entity), []) || [], [entity, bv])

  // Donut inputs, mode-aware. Today/Plan = actual; Future = post-2027 estate;
  // What-if = recompute against the levered entity. One place so the donut and
  // the numbers can never disagree across modes.
  const donut = useMemo(() => {
    const wi = scenario && whatIf?.active ? whatIf : null
    const exp = scenario ? (whatIf?.exp || exposureToday) : exposureForMode
    const comp = wi?.components || null
    return {
      incomeGross: wi ? wi.incomeGross : taxTiles.gross,
      incomeTax:   wi ? wi.incomeTax : taxTiles.totalTax,
      components: comp ? [
        { label: 'Income tax', value: comp.income_tax || 0 },
        { label: 'Dividend tax', value: comp.dividend_tax || 0 },
        { label: 'Savings tax', value: comp.savings_tax || 0 },
        { label: 'National Insurance', value: comp.nics || 0 },
        { label: 'Capital gains', value: comp.cgt || 0 },
      ] : [
        { label: 'Income tax', value: taxTiles.incomeTax },
        { label: 'Dividend tax', value: taxTiles.dividendTax },
        { label: 'Savings tax', value: taxTiles.savingsTax },
        { label: 'National Insurance', value: taxTiles.nics },
        { label: 'Capital gains', value: taxTiles.cgt },
      ],
      estateGross: exp?.gross_estate || 0,
      iht: exp?.iht_due || 0,
      family: exp?.beneficiary_value || 0,
    }
  }, [scenario, whatIf, exposureForMode, exposureToday, taxTiles, entity, bv])

  // ── Sub-anchor strip — different for tax vs estate ────────────────────────
  const subAnchorTax = useMemo(() => {
    const ani = safe(() => calcANI(entity).ani, 0)
    const allow = safe(() => allowanceTracker(entity), null)
    return {
      // Founder finding #2 (2026-06-08): each pill must drill to source + plain
      // English. Tapping opens the matching drawer (the breakdown + the ANI
      // 6-step worked example + the allowance detail all live there).
      a: { label: 'Tax this year', value: fmt(totalTaxNow || 0), colour: 'var(--c-danger)',
           eyebrowAccessory: <span style={{ color: 'var(--c-acc)', fontSize: 13 }}>›</span>,
           sub: 'tap for the breakdown', onTap: () => setOpenTile('income') },
      b: { label: 'Income HMRC counts', value: fmt(ani || 0),
           eyebrowAccessory: <span style={{ color: 'var(--c-acc)', fontSize: 13 }}>›</span>,
           sub: ani >= TAX.adjustedNetIncomeCliff && ani <= TAX.art ? '⚠ 60% taper band · tap to see why' : 'sets your £100k allowance taper · tap',
           onTap: () => setOpenTile('income') },
      c: { label: 'Allowances left', value: `${100 - (allow?.utilization || 0)}%`,
           eyebrowAccessory: <span style={{ color: 'var(--c-acc)', fontSize: 13 }}>›</span>,
           sub: 'tap to see what’s free', onTap: () => setOpenTile('allowances') },
    }
  }, [entity, totalTaxNow, taxSince])

  const subAnchorEstate = useMemo(() => {
    const ihtNow = exposureToday?.iht_due || 0
    const beneficiaryNet = exposureToday?.beneficiary_value || 0
    // Pension-IHT countdown: live days-until 6 Apr 2027.
    // P2 reconciliation (2026-06-07): single canonical source so this tile and
    // IHTDeltaCard never disagree (was ceil→303 vs floor→302). Both now read
    // sippIhtCountdownDays() (floor, UTC pivot).
    const daysToPensionIHT = sippIhtCountdownDays()
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
      // Founder finding #2 (2026-06-08): pills drill to source. a + b open the
      // IHT drawer (full breakdown + plain-English story live there).
      a: { label: 'IHT today', value: fmt(ihtNow), colour: 'var(--c-danger)', tieout: 'tax.iht-today', tieoutRaw: ihtNow,
           eyebrowAccessory: <span style={{ color: 'var(--c-acc)', fontSize: 13 }}>›</span>,
           sub: 'tap for the breakdown', onTap: () => setOpenTile('est-iht') },
      b: { label: 'Family receives', value: fmt(beneficiaryNet), colour: 'var(--c-success)', tieout: 'tax.beneficiary-net', tieoutRaw: beneficiaryNet,
           eyebrowAccessory: <span style={{ color: 'var(--c-acc)', fontSize: 13 }}>›</span>,
           sub: 'after IHT & deductions · tap to see', onTap: () => setOpenTile('est-iht') },
      c: {
        label: 'Pension-IHT',
        value: `${daysToPensionIHT} days`,
        sub: 'Until 6 Apr 2027 · tap for impact',
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

  // ── Category drawers render here as TOP-LEVEL early-returns (founder finding
  //    #5, 2026-06-08). Rendering them inside the sub-tab body broke because
  //    `.sw-tab-slide` has a CSS transform, which makes `position:fixed` resolve
  //    against that container (not the viewport) — the drawer landed below the
  //    fold and its content was unreadable. As a top-level return it covers the
  //    viewport like the L3 drill panels above. ─────────────────────────────
  if (openTile) {
    const closeTile = () => setOpenTile(null)
    const detailBtn = (view, label) => (
      <button
        onClick={() => setDrillView(view)}
        className="sw-chip sw-chip-sm sw-press"
        style={{
          position: 'absolute', top: 14, right: 14, cursor: 'pointer',
          fontSize: 11, fontWeight: 700, background: 'var(--c-surface2)',
          border: '1px solid var(--c-sep)', color: 'var(--c-acc)',
        }}
      >{label}</button>
    )
    switch (openTile) {
      // ── Tax drawers ──
      case 'income':
        return <CategoryDrawer title="Income & tax this year" onClose={closeTile}>
          <TaxSummary entity={entity} /><IncomeTaxDetail entity={entity} /><ANIStepwise entity={entity} />
        </CategoryDrawer>
      case 'allowances':
        return <CategoryDrawer title="Allowances — what's left to use" onClose={closeTile}>
          <div style={{ position: 'relative' }}><AllowancesStrip entity={entity} />{detailBtn('allowances', 'Detail ›')}</div>
        </CategoryDrawer>
      case 'pension':
        return <CategoryDrawer title="Pension relief & drawdown" onClose={closeTile}>
          <SalarySacrifice entity={entity} /><DrawdownMatrix entity={entity} />
        </CategoryDrawer>
      case 'dividends':
        return <CategoryDrawer title="Dividends & savings" onClose={closeTile}>
          <DividendDetail entity={entity} />
        </CategoryDrawer>
      case 'cgt-cat':
        return <CategoryDrawer title="Capital gains" onClose={closeTile}>
          <div style={{ position: 'relative' }}><CGTDetail entity={entity} />{detailBtn('cgt', 'Detail ›')}</div>
        </CategoryDrawer>
      case 'selfassessment':
        return <CategoryDrawer title="Self-assessment & residency" onClose={closeTile}>
          <SelfAssessment entity={entity} personaId={personaId} onSeeFull={closeTile} />
          <SelfAssessmentDocs entity={entity} personaId={personaId} onCommit={onCommit} onClose={closeTile} />
          <NonDomCard entity={entity} />
        </CategoryDrawer>
      case 'situational':
        return <CategoryDrawer title="Other taxes in your situation" onClose={closeTile}>
          <SituationalTaxes entity={entity} />
        </CategoryDrawer>
      // ── Estate drawers ──
      case 'est-iht':
        return <CategoryDrawer title="Inheritance tax — today & April 2027" onClose={closeTile}>
          <IHTDeltaCard entity={entity} />
          <div style={{ position: 'relative' }}><IHTDualNumber entity={entity} />{detailBtn('iht', 'Breakdown ›')}</div>
          <IHTWaterfall entity={entity} /><IHTYearByYear entity={entity} />
        </CategoryDrawer>
      case 'est-story':
        return <CategoryDrawer title="Your inheritance story" onClose={closeTile}>
          <InheritanceStory entity={entity} onDrillMetric={onDrillMetric} />
        </CategoryDrawer>
      case 'est-coi':
        return <CategoryDrawer title="Cost of inaction & your estate plan" onClose={closeTile}>
          <EstateCoIOdometer entity={entity} /><EstatePlanBadge entity={entity} />
          {plans.length > 0 && <PlanStalenessAccordion plans={plans} onReview={(p) => onDrillMetric?.(`plan:${p.type}`)} />}
        </CategoryDrawer>
      case 'est-gifts':
        return <CategoryDrawer title="Gifts & the 7-year clock" onClose={closeTile}>
          <GiftClock entity={entity} />
        </CategoryDrawer>
      case 'est-bpr':
        return <CategoryDrawer title="Business & agricultural relief (BPR / APR)" onClose={closeTile}>
          <div style={{ position: 'relative' }}><BPRAPRMechanics entity={entity} />{detailBtn('bpr', 'Asset detail ›')}</div>
        </CategoryDrawer>
      case 'est-rnrb':
        return <CategoryDrawer title="Your home & the residence band" onClose={closeTile}>
          <RNRBPlanning entity={entity} />
        </CategoryDrawer>
      case 'est-wills':
        return <CategoryDrawer title="Wills, power of attorney & who inherits" onClose={closeTile}>
          <WillLPACard entity={entity} onDrillMetric={onDrillMetric} /><NominationsManager entity={entity} /><BeneficiaryChain entity={entity} />
        </CategoryDrawer>
      case 'est-trust':
        return <CategoryDrawer title="Trusts" onClose={closeTile}>
          <TrustSimulator entity={entity} />
        </CategoryDrawer>
      default:
        break
    }
  }

  // Plain tax-year label (issue 1, founder 2026-06-08): "Live · UK-2026.1" +
  // money sub-nav are not appropriate on Tax. Derived from the active bundle.
  const taxYearLabel = taxYearLabelFromBundle()

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="screen">
      {/* ── Header ────────────────────────────────────────────────────────
            Founder finding #4 (2026-06-08): the per-tab tax-year pill duplicated
            the GLOBAL header tax-year chip — removed. Just the Back affordance. */}
      {/* Consolidated header row (founder 2026-06-08, review #1+#2): the Tax|Estate
          selector sits beside the year control (X28 below) instead of in a
          separate row lower down, and shares the Back affordance's row so the
          old Back-only bar no longer wastes a strip of vertical space. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 16px 4px',
      }}>
        <button
          onClick={goBackOrHome}
          aria-label={onBack ? 'Back to previous screen' : 'Back to home'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--c-acc)', fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <SubTabSelector
          value={subTab}
          onChange={(v) => { setSubTab(v); setOpenTile(null) }}
          taxBadge={taxBadge}
          estateBadge={estateBadge}
          inline
        />
      </div>

      {/* ── X28 top-bar (per §X28-PATCH-1 / D-X28-OPTION-D) ─────────────── */}
      <X28TopBar
        window={x28Window}
        viewMode={viewMode}
        onWindowChange={setX28Window}
        onViewModeChange={setViewMode}
        rulesVersion={BRAND.rulesVersion}
        dataDate={BRAND.dataDate}
        showWindowRow={false}
        showDecisions={true}
        decisionsActive={showChoices}
        onDecisions={() => setShowChoices(s => !s)}
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

      {/* ── Signature visual — "You vs the taxman" (founder 2026-06-08). The
            tab's own question made visual: what goes to HMRC now + at death vs
            what you keep / pass on. Hidden when Choices is active. ─────────── */}
      {!showChoices && (
        <TaxVsHMRC
          incomeGross={donut.incomeGross}
          incomeTax={donut.incomeTax}
          incomeComponents={donut.components}
          estateGross={donut.estateGross}
          iht={donut.iht}
          family={donut.family}
          banner={
            viewMode === 'actual' ? null
            : scenario ? <WhatIfLevers pay={wiPay} setPay={setWiPay} sellHome={wiSellHome} setSellHome={setWiSellHome} />
            : viewMode === 'plan' ? <PlanBanner plans={entity?.plans} ihtToday={exposureToday?.iht_due || 0} />
            : <ProjectionBanner viewMode={viewMode}
                ihtToday={exposureToday?.iht_due || 0} ihtForecast={exposureForMode?.iht_due || 0} />}
          onDrill={(target) => { setSubTab(target.startsWith('est') ? 'estate' : 'tax'); setOpenTile(target) }}
        />
      )}

      {/* Sub-tab selector relocated to the consolidated header row above
          (founder review #1) — no longer rendered here. */}

      {/* ── D-ANCHOR-2 sub-anchor strip (hidden when Choices is active) ─────── */}
      {!showChoices && <SubAnchorStrip {...(subTab === 'tax' ? subAnchorTax : subAnchorEstate)} />}

      {/* ── NRI notice ────────────────────────────────────────────────────── */}
      {nri && <NRINotice />}

      {/* ── Choices — driven by the X28TopBar "Choices" tab (next to What-if),
            matching other screens (founder finding #1, 2026-06-08). Renders the
            decision chips only when the tab is toggled on. ─────────────────── */}
      {showChoices && (
        <DecisionDrawers
          screen="tax"
          variant="chips"
          onOpen={onOpenDecision}
          heading="Choices you can make here"
        />
      )}

      {/* ── TAX SUB-TAB — 1B category tiles → drawers (founder issue 2/5) ───── */}
      {!showChoices && subTab === 'tax' && (
        <div key="tax" className="sw-tab-slide">
          {/* Self-Assessment filing-format estimate (M1·1D) — the headline tax
              capability, so it sits ABOVE the category tiles (was buried below
              the grid, 2+ screens down — founder couldn't see it 2026-06-09).
              Full computation + accountant-verifiable explanation per line +
              prior-year capture (M2) + print export. */}
          <SAComputationView entity={entity} personaId={personaId} onCommit={onCommit} />
          {/* Last 5 years, by year — the tax record the founder asked for. Reads
              the durable tax-history store + seeds the current year from the same
              SA computation above so the headline ties out. */}
          <TaxYearHistory entity={entity} personaId={personaId} onCommit={onCommit} />
          <p style={{ fontSize: 12, color: 'var(--c-text3)', margin: '16px 2px 10px' }}>
            Or tap a card below for a focused view.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <CatTile
              title="Income & tax this year"
              value={fmt(taxTiles.totalTax)}
              sub={`Effective rate ${fmtPct(taxTiles.effRate)} · gross ${fmt(taxTiles.gross)}`}
              tone="warning"
              onClick={() => setOpenTile('income')}
              chart={<MiniProportionBar segments={[
                { label: 'Income tax', value: taxTiles.incomeTax, colour: 'var(--c-danger)' },
                { label: 'National Insurance', value: taxTiles.nics, colour: 'var(--c-warning)' },
                { label: 'Dividend', value: taxTiles.dividendTax, colour: 'var(--c-acc)' },
                { label: 'Capital gains', value: taxTiles.cgt, colour: 'var(--c-acc3)' },
              ]} />}
            />
            <CatTile
              title="Allowances — what's left"
              value={`${taxTiles.allowLeft}% free`}
              sub="ISA, dividend, capital-gains, savings & personal allowance"
              tone="success"
              onClick={() => setOpenTile('allowances')}
              chart={<MiniProportionBar segments={[
                { label: 'Used', value: taxTiles.allowUsedPct, colour: 'var(--c-warning)' },
                { label: 'Still free', value: taxTiles.allowLeft, colour: 'var(--c-success)' },
              ]} />}
            />
            <CatTile
              title="Pension relief & drawdown"
              sub="Model take-home vs pension vs NI saving, and your drawdown"
              onClick={() => setOpenTile('pension')}
            />
            {taxTiles.hasDividend && (
              <CatTile
                title="Dividends & savings"
                value={fmt(taxTiles.dividendTax)}
                sub="Dividend allowance, rates and the ISA shelter"
                tone="warning"
                onClick={() => setOpenTile('dividends')}
                chart={<MiniProportionBar segments={[
                  { label: 'You keep', value: Math.max(0, taxTiles.dividendGross - taxTiles.dividendTax), colour: 'var(--c-success)' },
                  { label: 'Tax', value: taxTiles.dividendTax, colour: 'var(--c-danger)' },
                ]} />}
              />
            )}
            {taxTiles.hasCGT && (
              <CatTile
                title="Capital gains"
                value={taxTiles.cgt > 0 ? fmt(taxTiles.cgt) : (taxTiles.embeddedGain > 0 ? `${fmt(taxTiles.embeddedGain)} held` : '£0')}
                sub={taxTiles.cgt > 0
                  ? 'Tax due on realised gains this year'
                  : taxTiles.embeddedGain > 0
                    ? 'Unrealised gains in taxable wrappers · nothing sold yet'
                    : 'Realised gains vs your tax-free amount'}
                tone={taxTiles.cgt > 0 ? 'danger' : 'warning'}
                onClick={() => setOpenTile('cgt-cat')}
              />
            )}
            <CatTile
              title="Self-assessment & residency"
              sub="Filing deadline, balance due and non-domicile status"
              onClick={() => setOpenTile('selfassessment')}
            />
            {situational.length > 0 && (
              <CatTile
                title="Other taxes in your situation"
                value={`${situational.length} apply`}
                sub={situational.map(s => s.kind === 's24' ? 'landlord (s24)' : s.kind === 'sdlt' ? 'stamp duty' : 'corporation tax').join(' · ')}
                tone="warning"
                onClick={() => setOpenTile('situational')}
              />
            )}
          </div>
        </div>
      )}

      {/* ── ESTATE SUB-TAB — compact tiles, not a long hero (founder finding
            #3, 2026-06-08). The always-visible read is the 3 sub-anchor pills
            above (IHT today · family receives · pension-IHT countdown); every
            former hero card (signature delta, inheritance story, CoI, dual
            number) is now a tile → drawer, matching the Tax sub-tab. ───────── */}
      {!showChoices && subTab === 'estate' && (
        <div key="estate" className="sw-tab-slide">
          <p style={{ fontSize: 12, color: 'var(--c-text3)', margin: '2px 2px 10px' }}>
            Tap a card to open its detail.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <CatTile
              title="Inheritance tax — today & April 2027"
              value={fmt(exposureToday?.iht_due || 0)}
              sub="Today vs the April-2027 change, the waterfall & year-by-year"
              tone="danger"
              onClick={() => setOpenTile('est-iht')}
              chart={<MiniProportionBar segments={[
                { label: 'To family', value: exposureToday?.beneficiary_value || 0, colour: 'var(--c-success)' },
                { label: 'To HMRC', value: exposureToday?.iht_due || 0, colour: 'var(--c-danger)' },
              ]} />}
            />
            <CatTile
              title="Your inheritance story"
              sub="Plain English: what happens to your estate if you died today"
              onClick={() => setOpenTile('est-story')}
            />
            <CatTile
              title="Cost of inaction & estate plan"
              sub="What waiting costs, and whether your plan needs a review"
              onClick={() => setOpenTile('est-coi')}
            />
            <CatTile
              title="Gifts & the 7-year clock"
              sub="What you've given, and when each gift falls outside your estate"
              onClick={() => setOpenTile('est-gifts')}
            />
            {(hasBPREligibleHoldings(entity) || ['consolidation', 'preretirement', 'decumulation', 'preservation', 'legacy'].includes(lifeStage)) && (
              <CatTile
                title="Business & agricultural relief"
                sub="BPR / APR — what qualifies, and the 2-year clock"
                onClick={() => setOpenTile('est-bpr')}
              />
            )}
            <CatTile
              title="Your home & the residence band"
              sub="Residence nil-rate band (RNRB) and downsizing rules"
              onClick={() => setOpenTile('est-rnrb')}
            />
            {(() => {
              const willCurrent = safe(() => willLpaStatus(entity)?.will?.current, false)
              return (
                <CatTile
                  title="Wills, power of attorney & who inherits"
                  value={willCurrent ? 'Will current' : 'Check your will'}
                  sub="Will, power of attorney, nominations and the beneficiary chain"
                  tone={willCurrent ? 'success' : 'warning'}
                  onClick={() => setOpenTile('est-wills')}
                />
              )
            })()}
            {(['preretirement', 'decumulation', 'preservation', 'legacy'].includes(lifeStage)
              || !!entity?.hasTrust || (entity?.assets?.trustGifts?.total || 0) > 0) && (
              <CatTile
                title="Trusts"
                sub="10-year periodic charge and exit charges"
                onClick={() => setOpenTile('est-trust')}
              />
            )}
          </div>

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

      <p className="disclaimer">
        {BRAND.disclaimer}<br />
        {taxYearLabel} tax year · rules current as at {BRAND.dataDate}
      </p>
    </div>
  )
}
