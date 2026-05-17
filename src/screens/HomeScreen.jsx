/* ═══════════════════════════════════════════════════════════════════════════
   SONUSWEALTH — HOME SCREEN  v2.1  (spec: 2-Product-home-v1_4.md)
   ─────────────────────────────────────────────────────────────────────────
   Authority chain : Foundation v1.11 · Skill v1.4 · Tracker v5.75
   Brand           : Sonuswealth (D-NAME-2). Score names per BRAND.
   Engine          : src/engine/fq-calculator.js  (canonical)
   Components      : src/components/shared/*       (X28, X29, Reveal, etc.)
   ─────────────────────────────────────────────────────────────────────────
   v2.1 audit fixes (FIX-7 / audit-2026-05-15/home.md):
     · Anchor row Drillables wired (CRIT S2): NW → onDrillMetric('netWorth'),
       Score → onOpenBreakdown(), Risk → onDrillMetric('riskScore').
     · Radar onDrillMetric has a local stub if upstream missing (CRIT S1).
     · Plan card explicitly requests 'retirement' (was 'wealth' — relied on
       engine alias; explicit is safer).
     · Brief enumerates real asset classes (CRIT C1) — no hardcoded list.
     · Brief false-alarm fix (CRIT N1): lowestDim picker now respects
       persona narrative; estate well-positioned ⇒ skip; no "5-7 points"
       fabrication.
     · Greeting strips title tokens (Mr/Mrs/Ms/Dr…) or uses displayName.
     · Risk band colour uses engine band.colour (HIGH R10).
     · Active Insights override map key fixed: 'nominations' (HIGH S5).
     · Z3 CoI strip restored (mandatory per spec).
     · Z10 SIPP-IHT countdown restored (regulatory: April 2027 enacted).

   v2.0 6-card layout (prototype: app-prototype/01-sonuswealth.html):
     Card 1  — Masthead (greeting + name + date + mode pill)
     Card 2  — Anchor row (NW · Wealth Score · Risk)
     Z3      — Cost of Inaction strip (RESTORED v2.1)
     Z10     — SIPP-IHT countdown (RESTORED v2.1)
     Card 3  — Radar card (RadarAnchor + plain-English brief)
     Card 4  — Priority Action (top-1 from calcAPQ)
     Card 5  — Plan progress (planFor 'retirement')
     Card 6  — Active Insights (actions 2–4 from calcAPQ)
     Footer  — FCA disclaimer line
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react'
import ScenarioIntake from '../components/Home/ScenarioIntake.jsx'
import PensionDrawdownPanel from '../components/Home/PensionDrawdownPanel.jsx'
import {
  calcFQ, calcRisk, calcAPQ, netWorth, fmt,
  planFor, diffSet, costOfInaction, totalCoI,
  investable, liquidityBuffer,
  fiRatio, debtRatio, protectionScore, cashflowHealth, estateReadiness, taxEfficiency,
} from '../engine/fq-calculator.js'
import Drillable from '../components/shared/Drillable.jsx'
import RadarAnchor from '../components/Home/RadarAnchor.jsx'
import { DIMENSIONS } from '../config/dimensions.js'

/* ─── helpers ───────────────────────────────────────────────────────────── */

function safe(fn, fallback) {
  try { return fn() ?? fallback } catch { return fallback }
}

function fmtDate(d) {
  if (!d) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  try {
    const dt = new Date(d)
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  } catch { /* fall through */ }
  return d
}

/** "Mon 13 May" */
function fmtHomeDate() {
  const now = new Date()
  return now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Time-of-day greeting */
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** FIX N6: Pull a useful first name out of "Mr T Core" / "Dr Jane Smith".
   Strips honorifics; prefers entity.displayName first token where present. */
const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'lady', 'dame', 'lord',
])
function pickFirstName(entity) {
  // Prefer displayName if present; it's curated.
  const dn = entity?.displayName
  if (typeof dn === 'string' && dn.trim()) {
    const parts = dn.split(/[\s·]+/).filter(Boolean)
    for (const tok of parts) {
      if (!TITLES.has(tok.toLowerCase())) return tok
    }
  }
  const rawName = entity?.individual?.name || entity?.name || ''
  const parts = rawName.split(/\s+/).filter(Boolean)
  for (const tok of parts) {
    if (!TITLES.has(tok.toLowerCase().replace(/\.$/, ''))) return tok
  }
  return parts[0] || 'there'
}

/* ─── Route override map (unchanged from v1 — engine mis-routes these)
   Engine's calcAPQ() returns each action with a `screen` field. Several are
   mis-routed (CGT → money but should be → tax; life-in-trust → money but is
   estate-tax; nominations → money but is estate). Override here at UI level
   so we don't have to touch the frozen engine.

   FIX S5: key map keys must match engine action ids exactly. Engine emits
   id: 'nominations' (see fq-calculator.js L1211); the legacy mapping used
   'update-pension-nominations' which never matched. Fixed. */
const ACTION_ROUTE_OVERRIDE = {
  'cgt-bedisa':            'tax',
  'life-in-trust':         'tax',
  'nominations':           'tax',
  'fallback-iht':          'tax',
  'pension-drawdown':      'tax',
  'pension-contributions': 'money',
  'income-protection':     'risk',
  'will-update':           'tax',
  'sipp-nominations':      'tax',
  'wrapper-sequencing':    'tax',
  'debt-clearance':        'money',
  'isa-allowance':         'money',
}
function safeRoute(action) {
  if (!action) return null
  return ACTION_ROUTE_OVERRIDE[action.id] || action.screen || null
}

/** Rank justification eyebrow — engine-derived score deltas only. */
function rankReasonFor(action, rank) {
  if (!action) return null
  const bits = []
  if (rank === 1) {
    if (action.priority === 1) bits.push('Highest priority')
    else                       bits.push('Top action today')
  } else if (rank === 2) bits.push('Next priority')
  else if (rank === 3) bits.push('Worth doing')
  else                  bits.push('Standard')

  const fqMove = action?.impact?.finioScore || 0
  if (fqMove > 0) bits.push(`+${fqMove} Wealth Score`)

  const dl = action?.impact?.deadline
  if (dl) {
    try {
      const d = new Date(dl)
      if (!isNaN(d.getTime())) {
        const days = Math.max(0, Math.round((d.getTime() - Date.now()) / 86400000))
        if (days <= 60)   bits.push(`${days} days to act`)
        else if (days <= 180) bits.push(`${days} days left`)
      }
    } catch { /* ignore bad deadline */ }
  }

  return bits.join(' · ')
}

/* ─── card shell ────────────────────────────────────────────────────────── */
const card = (extra = {}) => ({
  margin: '0 16px 12px',
  background: 'var(--c-surface)',
  border: '1px solid var(--c-sep)',
  borderRadius: 20,
  padding: '16px 18px',
  ...extra,
})

/* ─── mode pill label map ───────────────────────────────────────────────── */
const MODE_LABEL = {
  actual:   'Today',
  forecast: 'Future',
  plan:     'Plan',
  scenario: 'What-if',
}

/* ─── MODES array (for pill buttons in MastheadCard) ───────────────────── */
const MODES = [
  { id: 'actual',   label: 'Today' },
  { id: 'forecast', label: 'Future' },
  { id: 'plan',     label: 'Plan' },
  { id: 'scenario', label: 'What If' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Card 1 — Masthead
   ═══════════════════════════════════════════════════════════════════════ */

function MastheadCard({ entity, viewMode, onModeChange }) {
  const firstName = pickFirstName(entity)
  const initials = firstName.slice(0, 2).toUpperCase()
  return (
    <div style={{
      margin: '0 16px 14px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--c-gold), #b87f30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#0B1F3A',
          boxShadow: '0 4px 14px rgba(255,189,89,0.25)',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--c-text3)' }}>{greeting()},</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.4, marginTop: 2, lineHeight: 1.2 }}>
            {firstName} · {fmtHomeDate()}
          </div>
        </div>
      </div>
      {/* Mode pill */}
      <div style={{
        display: 'flex', gap: 3, padding: 4,
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 999,
        flexShrink: 0,
      }}>
        {MODES.map(({ id, label }) => (
          <button key={id} onClick={() => onModeChange?.(id)} style={{
            padding: '6px 12px', borderRadius: 999, border: 'none', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
            background: viewMode === id ? 'var(--c-acc)' : 'transparent',
            color: viewMode === id ? '#0B1F3A' : 'var(--c-text3)',
            cursor: 'pointer', transition: 'background 150ms ease',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 2 — Anchor row
   Net worth · Wealth Score · Risk  (3-up responsive row)
   FIX S2 + R10: Drillables wired; risk colour derived from engine band.
   ═══════════════════════════════════════════════════════════════════════ */

function nwComposition(entity) {
  const a = entity?.assets || {}
  const num = v => {
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
    return +v?.total || +v?.value || 0
  }
  const pensions  = num(a.sipp) + num(a.pension) + num(a.pensions)
  const isa       = num(a.isa) + num(a.lisa)
  const home      = safe(() => (a.property || []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0), 0)
              + num(a.residence) + num(a.home)
  const cash      = num(a.cash) + num(a.bank) + num(a.savings)
  const business  = safe(() => (a.business_assets || []).reduce((s, b) => s + (+b.currentValue || +b.value || 0), 0), 0)
  const other     = num(a.investments) + num(a.alternatives)
  const total     = pensions + isa + home + cash + business + other || 1
  return [
    { label: 'Pensions', pct: pensions / total, color: 'var(--c-acc2)' },
    { label: 'ISA',      pct: isa      / total, color: 'var(--c-acc)'  },
    { label: 'Home',     pct: home     / total, color: 'var(--c-gold)' },
    { label: 'Cash',     pct: cash     / total, color: 'var(--c-text3)' },
    { label: 'Business', pct: business / total, color: '#ba8cff' },
    { label: 'Other',    pct: other    / total, color: 'var(--c-acc3)' },
  ].filter(s => s.pct > 0.005)
}

function gapDims(fqData) {
  const dims = fqData?.dims || {}
  // Real dim keys + max values from src/config/dimensions.js (50% of max = gap threshold)
  // behaviour=20, capital=18, tax=18, protection=16, cashflow=16, debt=14, estate=28
  const GAP_THRESH = {
    behaviour:  10,
    capital:     9,
    tax:         9,
    protection:  8,
    cashflow:    8,
    debt:        7,
    estate:     14,
  }
  return Object.entries(GAP_THRESH).filter(([key, thresh]) => (dims[key] ?? 0) < thresh).length
}

function AnchorRow({ nw, fqData, riskData, entity, onDrillMetric, onOpenBreakdown }) {
  const score      = fqData?.total ?? 0
  const riskScore  = riskData?.total ?? 0
  const riskColor  = riskData?.band?.colour || 'var(--c-gold)'
  const riskBand   = riskData?.band?.name || '—'
  const segments   = nwComposition(entity)
  const gapCount   = gapDims(fqData)

  const coiTotal = safe(() => { const c = costOfInaction(entity); return typeof c === 'number' ? c : (c?.total || 0) }, 0)
  const dueDate  = new Date('2027-04-06')
  const now      = new Date()
  const days     = Math.max(0, Math.ceil((dueDate - now) / 86_400_000))
  const enacted  = new Date('2026-03-18')
  const totalSpan = (dueDate - enacted) / 86_400_000
  const elapsed   = (now - enacted) / 86_400_000
  const pct       = Math.min(100, Math.max(0, (elapsed / totalSpan) * 100))

  // SVG donut for Score
  const r = 16, C = 2 * Math.PI * r
  const filled       = (score / 100) * C
  const targetFilled = (68   / 100) * C

  return (
    <div style={card({ padding: '14px 18px', margin: '0 16px 12px' })}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 0, overflow: 'hidden' }}>

        {/* NW + composition bar */}
        <div style={{ borderRight: '1px solid var(--c-sep)', paddingRight: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Net Worth</div>
          <Drillable metric="netWorth" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -1 }}>{fmt(nw)}</span>
          </Drillable>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--c-surface2)', marginTop: 8 }}>
            {segments.map(s => <div key={s.label} style={{ width: `${s.pct * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {segments.map(s => (
              <span key={s.label} style={{ fontSize: 9.5, color: 'var(--c-text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <i style={{ width: 6, height: 6, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.label} {Math.round(s.pct * 100)}%
              </span>
            ))}
          </div>
        </div>

        {/* Score + donut + gaps badge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Wealth Score</div>
          <button onClick={() => onOpenBreakdown?.()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="40" height="40" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-surface2)" strokeWidth="5" />
              <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,189,89,0.25)" strokeWidth="5"
                strokeDasharray={`${targetFilled.toFixed(1)} ${(C - targetFilled).toFixed(1)}`} />
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-acc)" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${filled.toFixed(1)} ${(C - filled).toFixed(1)}`} />
            </svg>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
                {score}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {fqData?.band?.name || '—'}
              </div>
            </div>
          </button>
          {gapCount > 0 && (
            <button onClick={() => onDrillMetric?.('gaps')} style={{
              marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%', background: 'var(--c-acc3)',
                fontSize: 9, fontWeight: 800, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>!</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)' }}>
                {gapCount} gaps in radar →
              </span>
            </button>
          )}
        </div>

        {/* Risk + gradient gauge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Risk</div>
          <Drillable metric="riskScore" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 20, fontWeight: 800, color: riskColor, letterSpacing: -0.5 }}>
              {riskScore}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
            </span>
          </Drillable>
          <div style={{ position: 'relative', height: 8, borderRadius: 4, marginTop: 8, overflow: 'visible',
            background: 'linear-gradient(90deg, #34c759 0%, #34c759 33%, #ffb347 33%, #ffb347 66%, #ff6b6b 66%, #ff6b6b 100%)' }}>
            <div style={{
              position: 'absolute', top: -5, left: `calc(${riskScore}% - 9px)`,
              width: 18, height: 18, borderRadius: '50%',
              background: riskColor, border: '2px solid var(--c-bg)',
              boxShadow: `0 0 8px ${riskColor}88`,
            }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: riskColor, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{riskBand}</div>
        </div>

        {/* CoI + countdown bar */}
        <div style={{ paddingLeft: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Cost of Inaction</div>
          <Drillable metric="coi" onOpen={onDrillMetric} inline affordance="none">
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc3)', letterSpacing: -0.5 }}>{coiTotal > 0 ? fmt(coiTotal) : '—'}</span>
          </Drillable>
          {coiTotal > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)', marginTop: 4 }}>{days} days to act</div>}
          <div style={{ height: 4, background: 'var(--c-surface2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--c-gold), var(--c-acc3))', borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.4 }}>
            SIPP IHT · 6 Apr 2027 · enacted
          </div>
        </div>

      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   §Z10 — SIPP-IHT Countdown (RESTORED v2.1)
   Regulatory relevance: Finance Act 2026 (Royal Assent 18 Mar 2026) brings
   DC pensions into the IHT estate from 6 April 2027. Surface the days-left
   countdown for any entity with SIPP / personal pension value at risk.
   ═══════════════════════════════════════════════════════════════════════ */

function SippIhtCountdown({ entity, onNav }) {
  // Only render once the rule is in scope (it's enacted, so always now true
  // until 6 April 2027; isRuleActive returns true on/after the date so we
  // also gate on "date is in the future" for the countdown to make sense).
  const dueDate = new Date('2027-04-06')
  const now = new Date()
  if (now >= dueDate) return null  // After the deadline, no countdown needed
  const days = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86400000))

  // Suppress if no exposed SIPP/pension value (handles flat number, object, or array-of-pots)
  const sippVal = safe(() => {
    const a = entity?.assets || {}
    const num = v => {
      if (typeof v === 'number') return v
      if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
      return +v?.total || +v?.value || 0
    }
    return num(a.sipp) + num(a.pensions)
  }, 0)
  if (sippVal <= 0) return null

  // Honest figure: cost of inaction for the SIPP-IHT domain (engine-derived)
  const sippCoi = safe(() => costOfInaction(entity, 'sipp_iht'), 0) || 0

  return (
    <div
      onClick={() => onNav?.('tax')}
      role={onNav ? 'button' : undefined}
      tabIndex={onNav ? 0 : undefined}
      onKeyDown={e => {
        if (onNav && (e.key === 'Enter' || e.key === ' ')) onNav('tax')
      }}
      style={{
        margin: '0 16px 12px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-gold)',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: onNav ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden>⚖</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-label)', fontWeight: 700,
          color: 'var(--c-gold)',
          textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          SIPP joins IHT estate
        </div>
        <div style={{
          fontSize: 'var(--fs-body)', color: 'var(--c-text)',
          fontWeight: 600, marginTop: 2, lineHeight: 1.4,
        }}>
          <strong style={{ color: 'var(--c-gold)' }}>{days} days</strong>{' '}
          until 6 April 2027
          {sippCoi > 0 && (
            <span style={{ color: 'var(--c-text3)' }}>
              {' · '}exposure {fmt(sippCoi)}
            </span>
          )}
        </div>
      </div>
      {onNav && (
        <span style={{ color: 'var(--c-text3)', fontSize: 'var(--fs-title)' }}>›</span>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 3 — Radar card
   Wraps RadarAnchor + a plain-English brief below
   FIX C1 + N1: brief enumerates real categories; lowest-dim picker respects
   narrative; no "5-7 points" fabrication.
   ═══════════════════════════════════════════════════════════════════════ */

// Probes the entity for non-zero asset categories and returns plain-English
// labels for what the user actually holds. Order: highest-value first, up to
// `max` items. Schema-agnostic (handles flat numbers, {value}, arrays).
function listAssetClasses(entity, max = 3) {
  const a = entity?.assets || {}
  const num = v => {
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x?.value || +x?.balance || +x?.balance_gbp || 0), 0)
    if (v && typeof v === 'object') return +v.total || +v.value || +v.balance || 0
    return 0
  }
  // Category map: probe key → label (and aggregation key)
  const probes = [
    { key: 'sipp',         label: 'pensions',        v: num(a.sipp) },
    { key: 'pension',      label: 'pensions',        v: num(a.pension) },
    { key: 'db',           label: 'pensions',        v: num(a.db) },
    { key: 'isa',          label: 'ISAs',            v: num(a.isa) },
    { key: 'lisa',         label: 'ISAs',            v: num(a.lisa) },
    { key: 'investments',  label: 'investments',     v: num(a.investments) },
    { key: 'portfolio',    label: 'investments',     v: num(a.portfolio) },
    { key: 'gia',          label: 'investments',     v: num(a.gia) },
    { key: 'residence',    label: 'home',            v: num(a.residence) },
    { key: 'home',         label: 'home',            v: num(a.home) },
    { key: 'property',     label: 'property',        v: num(a.property) },
    { key: 'btl',          label: 'property',        v: num(a.btl) },
    { key: 'cash',         label: 'cash',            v: num(a.cash) },
    { key: 'bank',         label: 'cash',            v: num(a.bank) },
    { key: 'savings',      label: 'cash',            v: num(a.savings) },
    { key: 'business',     label: 'business assets', v: num(a.business) || num(a.business_assets) },
    { key: 'companies',    label: 'business assets', v: num(a.companies) },
  ]
  // Aggregate by label so 'sipp' + 'pension' both count as "pensions" once
  const byLabel = new Map()
  for (const p of probes) {
    if (p.v <= 0) continue
    const cur = byLabel.get(p.label) || 0
    byLabel.set(p.label, cur + p.v)
  }
  // Sort by aggregated value desc and take top N labels
  const sorted = [...byLabel.entries()].sort((a, b) => b[1] - a[1])
  return sorted.slice(0, max).map(([label]) => label)
}

// Compose 'pensions, ISAs and the home' style list (Oxford-free)
function joinList(items) {
  if (!items.length) return 'a mix of assets'
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// FIX N1: well-positioned narratives (estate, etc.) shouldn't be tagged as
// "needs attention" just because the score happens to be low relative to max.
// A dim is "well-positioned" when persona narrative explicitly says so, OR
// when its fraction-of-max ≥ 0.7 (de-facto on track).
function pickLowestDim(entity, dims) {
  const narratives = entity?.dimensionNarrative || {}
  let low = null
  let lowFrac = Infinity
  for (const d of DIMENSIONS) {
    const score = dims[d.key] ?? 0
    const frac = score / d.max
    // Skip if persona explicitly marks well-positioned
    const n = narratives[d.key]
    const narrativeText = [n?.risk, n?.future, n?.headline].filter(Boolean).join(' ').toLowerCase()
    const wellPositioned =
      /well[- ]?positioned|on track|robust|strong position|best in class/.test(narrativeText)
    if (wellPositioned) continue
    // Skip if dim is comfortably above 70% of max
    if (frac >= 0.7) continue
    if (frac < lowFrac) { lowFrac = frac; low = d }
  }
  // If nothing qualified (everything strong / well-positioned), fall back to
  // the literal lowest dim — but flag it as "best to keep an eye on" in copy.
  if (!low) {
    for (const d of DIMENSIONS) {
      const score = dims[d.key] ?? 0
      const frac = score / d.max
      if (frac < lowFrac) { lowFrac = frac; low = d }
    }
  }
  return low
}

const MODE_BRIEF = {
  actual:   (nw, assetList, taxShelter, lowestDim) =>
    `You hold ${fmt(nw)} across ${assetList}. ${taxShelter}% is in tax shelters. ${lowestDim?.label || 'One dimension'} is the area that would most benefit from a closer look.`,
  forecast: () =>
    `On your current trajectory, your wealth shape shifts over 5 years. The gold dashed ring shows where you are aiming — gaps between today (mint) and target (gold) are the priority actions.`,
  plan:     (nw, assetList, taxShelter, lowestDim) =>
    `Your plan target (gold dashed ring) vs today (mint). Close the gap by addressing the dimensions below target — ${lowestDim?.label || 'Legacy'} is furthest from your plan.`,
  scenario: () =>
    `Drag any radar point to explore what-if. Moving a dimension outward = better. Inward = worse. Watch the score in the centre update live.`,
}

function RadarCard({ entity, fqData, nw, viewMode, diffs, onDrillMetric }) {
  const dims       = fqData?.dims || {}
  const lowestDim  = useMemo(() => pickLowestDim(entity, dims), [entity, dims])
  const taxShelter = useMemo(() => {
    const a = entity?.assets || {}
    const num = v => {
      if (typeof v === 'number') return v
      if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
      return +v?.total || +v?.value || 0
    }
    const sheltered = num(a.isa) + num(a.lisa) + num(a.sipp) + num(a.pension) + num(a.pensions)
    return nw > 0 ? Math.round((sheltered / nw) * 100) : 0
  }, [entity, nw])
  const assetList = useMemo(() => joinList(listAssetClasses(entity, 3)), [entity])

  const briefFn = MODE_BRIEF[viewMode] || MODE_BRIEF.actual
  const brief = briefFn(nw, assetList, taxShelter, lowestDim)

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 20,
      padding: '16px 18px 14px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 2 }}>Your wealth shape</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            7 dimensions · {viewMode === 'scenario' ? 'drag to test what-if' : 'today vs target'}
          </div>
        </div>
        <button onClick={() => onDrillMetric?.('gaps')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text3)', fontSize: 18, padding: 0 }}>›</button>
      </div>

      <RadarAnchor
        entity={entity}
        fqData={fqData}
        viewMode={viewMode}
        diffs={diffs}
        onDrillMetric={onDrillMetric}
      />

      <p style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55, marginTop: 12, marginBottom: 0 }}>
        {brief}
      </p>

      {viewMode === 'scenario' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--c-text3)' }}>
          <span style={{ border: '1px dashed var(--c-text3)', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>⋮</span>
          Drag any point to test what-if
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 5 — Plan progress
   planFor(entity, 'retirement') · progress bar · On course / Behind plan
   FIX: previously called planFor(entity, 'wealth') — relied on engine
   PLAN_TYPE_ALIASES.wealth='retirement' (added in Batch 1). Use the canonical
   string directly so the call doesn't silently break if the alias is removed.
   ═══════════════════════════════════════════════════════════════════════ */

function PlanProgressStrip({ entity, onNav }) {
  const plan = useMemo(() => safe(() => planFor(entity, 'retirement'), null), [entity])

  if (!plan) return (
    <div
      onClick={() => onNav?.('timeline')}
      style={{
        margin: '14px 16px 0', padding: '14px 18px',
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', flexShrink: 0 }}>Plan progress</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text2)' }}>No active plan — set one in the <strong style={{ color: 'var(--c-text)' }}>Plan tab</strong> to see your trajectory and milestones.</div>
      <span style={{ color: 'var(--c-acc)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Set plan →</span>
    </div>
  )

  const target   = typeof plan.target === 'number' ? plan.target : (plan.target?.netWorth || plan.target?.value || plan.targetValue || 0)
  const current  = plan.progress?.current ?? plan.current ?? 0
  const pct      = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const onTrack  = plan.progress?.onTrack ?? plan.onTrack ?? true
  const horizon  = plan.horizonDate || plan.target?.date || null
  const planName = plan.name || plan.goal || 'Retirement plan'

  return (
    <div style={{ margin: '14px 16px 0', padding: '14px 18px', background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', marginBottom: 2 }}>Plan progress</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {planName}{target > 0 && ` · ${fmt(target)} target`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {horizon && <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{new Date(horizon).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: onTrack ? 'var(--c-acc)' : 'var(--c-acc3)' }}>
            {onTrack ? 'On course' : 'Behind plan'}
          </span>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--c-surface2)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--c-acc)', borderRadius: 100, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 6 }}>
        <strong style={{ color: 'var(--c-text)' }}>{pct}%</strong>
        {target > 0 && <span> · {fmt(current)} of {fmt(target)}</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dim explainer stub overlay (FIX S1)
   When `onDrillMetric` is not threaded from the host (e.g. preview / lab),
   the radar dim click would otherwise be silent. This local stub keeps the
   contract honest: shows a small overlay naming the dim and stating that
   the X23 explainer view is coming next.
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   Zone 4 — State Tiles  (spec §Z4 + §Q3.1)
   6 tiles: FI · Debt · Protection · Cashflow · Estate · Tax Efficiency
   All engine-backed. Each drillable to its canonical tab.
   ═══════════════════════════════════════════════════════════════════════ */

function StateTilesCard({ entity, onNav }) {
  const fi   = useMemo(() => safe(() => fiRatio(entity),         { ratio: 0, state: 'Building',   fiAge: null }), [entity])
  const debt = useMemo(() => safe(() => debtRatio(entity),       { state: 'Manageable' }),                        [entity])
  const prot = useMemo(() => safe(() => protectionScore(entity), { score: 0, state: 'Gaps' }),                    [entity])
  const cf   = useMemo(() => safe(() => cashflowHealth(entity),  { state: 'Monitor', surplus: 0 }),               [entity])
  const est  = useMemo(() => safe(() => estateReadiness(entity), { score: 0, outOf: 7, state: 'Incomplete' }),    [entity])
  const tax  = useMemo(() => safe(() => taxEfficiency(entity),   { score: 0, state: 'Review' }),                  [entity])

  const stateColor = s => {
    const g = ['Achieved', 'Debt-Free', 'Covered', 'On Track', 'Optimised', 'Complete', 'Financially Independent']
    const r = ['Attention', 'Shortfall', 'Critical Gap', 'Action Required', 'Building']
    if (g.some(x => (s || '').includes(x))) return 'var(--c-acc)'
    if (r.some(x => (s || '').includes(x))) return 'var(--c-acc3)'
    return 'var(--c-gold)'
  }

  const fiPct = Math.round((fi.ratio || 0) * 100)
  const tiles = [
    {
      label: 'FI Ratio', value: `${fiPct}%`, state: fi.state || 'Building',
      route: 'money',
      sub: fi.state === 'Achieved' ? 'Financially independent' : fi.fiAge ? `FI by age ${fi.fiAge}` : 'Building towards FI',
    },
    {
      label: 'Debt', value: debt.state || '—', state: debt.state || 'Manageable',
      route: 'money',
      sub: (debt.state || '').includes('Free') ? 'No high-cost debt' : 'High-rate debt reducing returns',
    },
    {
      label: 'Protection', value: `${Math.round(prot.score || 0)}/100`, state: prot.state || 'Gaps',
      route: 'risk',
      sub: prot.state === 'Covered' ? 'Protection complete' : 'Gaps found — review cover',
    },
    {
      label: 'Cashflow',
      value: (cf.surplus != null && cf.surplus !== 0) ? ((cf.surplus > 0 ? '+' : '') + fmt(Math.abs(cf.surplus || 0))) : '—',
      state: cf.state || 'Monitor',
      route: 'flow',
      sub: (cf.surplus || 0) >= 0 ? 'Monthly surplus' : 'Monthly shortfall',
    },
    {
      label: 'Estate', value: `${est.score || 0}/${est.outOf || 7}`, state: est.state || 'Incomplete',
      route: 'tax',
      sub: (est.score || 0) >= (est.outOf || 7) ? 'Estate plan complete' : `${(est.outOf || 7) - (est.score || 0)} items outstanding`,
    },
    {
      label: 'Tax Efficiency', value: `${Math.round(tax.score || 0)}/100`, state: tax.state || 'Review',
      route: 'tax',
      sub: tax.state === 'Optimised' ? 'Tax-efficient' : 'Allowances not fully used',
    },
  ]

  return (
    <div style={{ margin: '0 16px 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', gap: 8, paddingBottom: 2, minWidth: 'max-content' }}>
        {tiles.map(tile => {
          const colour = stateColor(tile.state)
          return (
            <div
              key={tile.label}
              onClick={() => onNav?.(tile.route)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onNav?.(tile.route) }}
              style={{
                background: 'var(--c-surface)',
                border: `1px solid var(--c-sep)`,
                borderTop: `2.5px solid ${colour}`,
                borderRadius: 14,
                padding: '10px 14px',
                cursor: 'pointer',
                minWidth: 120, flex: '0 0 auto',
                transition: 'background 120ms',
              }}
            >
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>{tile.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: colour, letterSpacing: -0.3, marginBottom: 2 }}>{tile.value}</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.3 }}>{tile.sub}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const DIM_EXPLAINERS = {
  behaviour:  { what: 'How consistently your financial actions match your goals — contributions, reviews, rebalancing.', lift: 'Set up automatic contributions and review your plan quarterly.', route: 'money' },
  capital:    { what: 'How hard your capital is working — return vs risk vs wrapper efficiency.', lift: 'Maximise ISA and pension allowances before investing in a GIA.', route: 'money' },
  tax:        { what: 'How much of your return you keep after tax — allowances, shelters, sequencing.', lift: 'Use annual CGT and dividend allowances. Review ISA/SIPP/GIA sequencing.', route: 'tax' },
  protection: { what: 'Whether a shock — illness, death, or liability — would derail your financial plan.', lift: 'Review life cover, income protection, and lasting power of attorney.', route: 'risk' },
  cashflow:   { what: 'Whether your monthly surplus gives you flexibility and a resilience buffer.', lift: 'Build 3–6 months of expenses in liquid, accessible savings.', route: 'flow' },
  debt:       { what: 'Whether your debt is costing more than your investments earn after tax.', lift: 'Clear high-rate debt before increasing investment contributions.', route: 'money' },
  estate:     { what: 'Whether your wealth transfers efficiently — IHT exposure, nominations, and Will.', lift: 'Review beneficiary nominations, update your Will, and consider trust structures.', route: 'tax' },
}

const TAB_LABELS = { money: 'MyMoney', tax: 'Tax & Estate', risk: 'Risk', flow: 'Cashflow', timeline: 'Timeline' }

function DimExplainerStub({ metric, fqData, onClose, onNav }) {
  const dimKey = (metric || '').replace(/^wealth\./, '')
  const dim    = DIMENSIONS.find(d => d.key === dimKey)
  const label  = dim?.label || dimKey || metric
  const exp    = DIM_EXPLAINERS[dimKey] || {}
  const score  = fqData?.dims?.[dimKey]
  const route  = exp.route || null
  return (
    <div
      role="dialog"
      aria-label={`Explainer · ${label}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-sep)',
          borderRadius: 20, padding: '20px 22px',
          maxWidth: 400, width: '100%',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4 }}>
          Sonuswealth Wealth Score — {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)' }}>{label}</div>
          {score != null && (
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
              {Math.round(score)}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text3)' }}>pts</span>
            </div>
          )}
        </div>

        {exp.what && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--c-text3)', marginBottom: 4 }}>What this measures</div>
            <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 14px' }}>{exp.what}</p>
          </>
        )}

        {exp.lift && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--c-gold)', marginBottom: 4 }}>What would lift this score</div>
            <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 16px' }}>{exp.lift}</p>
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {route && onNav && (
            <button onClick={() => { onClose(); onNav(route) }} className="sw-press" style={{ flex: 1, padding: '9px 14px', borderRadius: 100, background: 'var(--c-acc)', border: 'none', color: '#0B1F3A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Go to {TAB_LABELS[route] || route} →
            </button>
          )}
          <button onClick={onClose} className="sw-press" style={{ padding: '9px 14px', borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-sep)', color: 'var(--c-text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   L3 — CoI Drill Panel
   ═══════════════════════════════════════════════════════════════════════ */

const COI_DOMAIN_META = {
  drawdown:           { label: 'SIPP estate exposure',             screen: 'tax'   },
  wrapperSequencing:  { label: 'Wrapper sequencing (ISA/SIPP)',   screen: 'tax'   },
  contributions:      { label: 'Pension contributions',           screen: 'money' },
  taxAllowances:      { label: 'Unused tax allowances',           screen: 'tax'   },
  estatePlanning:     { label: 'Estate planning gap',             screen: 'tax'   },
  protection:         { label: 'Protection coverage gap',         screen: 'risk'  },
  debt:               { label: 'High-cost debt',                  screen: 'money' },
  gifting:            { label: 'Gifting opportunity',             screen: 'tax'   },
  propertyDecisions:  { label: 'Property decisions',              screen: 'money' },
  investmentStrategy: { label: 'Investment strategy',             screen: 'money' },
}

function CoIDrillPanel({ entity, onClose, onNav }) {
  const coiObj   = useMemo(() => safe(() => totalCoI(entity), { total: 0, byDomain: {} }), [entity])
  const total    = coiObj.total || 0
  const byDomain = coiObj.byDomain || {}

  const rows = Object.entries(COI_DOMAIN_META)
    .map(([key, meta]) => ({ key, ...meta, value: Math.round(byDomain[key] || 0) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'nw-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
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
          Cost of inaction
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Total annual cost of inaction</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: 'var(--c-danger)' }}>
            {fmt(total)}/yr
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            Across all financial planning areas — the cost of staying on your current path
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 18, padding: '14px 18px', marginBottom: 12 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 12 }}>By planning area</div>
            {rows.map((row, i) => (
              <div
                key={row.key}
                onClick={() => { onNav?.(row.screen); onClose() }}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onNav?.(row.screen); onClose() } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 13, color: 'var(--c-text2)', flex: 1, marginRight: 8 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmt(row.value)}/yr
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--c-sep)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text3)' }}>Total</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-danger)' }}>{fmt(total)}/yr</span>
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--c-surface)', border: '1px solid rgba(255,189,89,0.35)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
        }}>
          Every month without acting this accumulates. The figures above are estimates from your data — actual impact depends on your specific circumstances.
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Estimated from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   L3 — APQ Drill Panel
   ═══════════════════════════════════════════════════════════════════════ */

function APQDrillPanel({ entity, onClose }) {
  const apq = safe(() => calcAPQ(entity), [])
  const items = Array.isArray(apq) ? apq : []

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'nw-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
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
          Your top priorities
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Your top priorities</div>
          {items.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              No priority actions found.
            </div>
          )}
          {items.map((action, i) => {
            const impact = action?.impact?.finioScore || action?.impact?.score || 0
            return (
              <div
                key={action.id || i}
                className="sw-press"
                style={{
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                  cursor: 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
                    fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>
                      {action.title || action.headline || '—'}
                    </div>
                    {(action.context || action.detail || action.why) && (
                      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 4 }}>
                        {action.context || action.detail || action.why}
                      </div>
                    )}
                    {impact > 0 && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px', borderRadius: 100,
                        background: 'rgba(93,219,194,0.12)', border: '1px solid rgba(93,219,194,0.25)',
                        fontSize: 10, fontWeight: 700, color: 'var(--c-acc)',
                      }}>
                        +{impact} Wealth Score
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Prioritised from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   L3 — Net Worth Drill Panel
   Shown as an overlay when the NW tile is tapped on Home.
   Assets waterfall: pensions → investments → property → business → cash →
   alternatives → MINUS liabilities.
   ═══════════════════════════════════════════════════════════════════════ */

function NetWorthDrillPanel({ entity, onClose }) {
  const nw     = safe(() => netWorth(entity), 0)
  const inv    = safe(() => investable(entity), 0)
  const lb     = safe(() => liquidityBuffer(entity), null)
  const a      = entity?.assets || {}

  // Derive asset buckets from entity shape (canonical — no hardcoding)
  // Pensions: sum all three possible shapes (sipp flat/object, pension flat/object, pensions array)
  const _numAsset = v => {
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
    return +v?.total || +v?.value || 0
  }
  const pensions   = safe(() => _numAsset(a.sipp) + _numAsset(a.pension) + _numAsset(a.pensions), 0)
  const property   = safe(() => (a.property  || []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0), 0)
  const business   = safe(() => (a.business_assets || []).reduce((s, b) => s + (+b.currentValue || +b.value || 0), 0), 0)
  const cash       = safe(() => (+a.cash || +a.savings || +a.cashSavings || 0), 0)
  const portfolio  = safe(() => {
    const h = a.portfolio?.holdings || a.holdings || []
    return h.reduce((s, h) => s + (+h.currentValue || +h.value || 0), 0)
  }, 0)
  const altAssets  = safe(() => (a.alternatives || []).reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0), 0)
  const liabilities = safe(() => {
    const l = entity?.liabilities || a.liabilities || {}
    if (Array.isArray(l)) return l.reduce((s, x) => s + (+x.outstanding || +x.balance || 0), 0)
    return (+l.mortgage || 0) + (+l.loans || 0) + (+l.creditCards || 0) + (+l.otherDebt || 0)
  }, 0)

  const totalAssets = pensions + property + business + cash + portfolio + altAssets

  const rows = [
    { label: 'Pensions',     value: pensions,    colour: 'var(--c-acc)' },
    { label: 'Property',     value: property,    colour: 'var(--c-gold)' },
    { label: 'Investments',  value: portfolio,   colour: 'var(--c-success)' },
    { label: 'Business',     value: business,    colour: 'var(--c-warning)' },
    { label: 'Cash & savings', value: cash,      colour: 'var(--c-text2)' },
    { label: 'Alternatives', value: altAssets,   colour: 'var(--c-text3)' },
  ].filter(r => r.value > 0)

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto',
        background: 'var(--c-bg)',
        animation: 'nw-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        padding: '0 0 120px',
      }}
    >
      <style>{`
        @keyframes nw-slide-up {
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
          Net Worth breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Total net worth</div>
          <div style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: nw >= 0 ? 'var(--c-text)' : 'var(--c-danger)',
          }}>
            {fmt(nw)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>
            Assets {fmt(totalAssets)} · Liabilities {fmt(liabilities)}
          </div>
          <span className="sw-chip sw-chip-sm" style={{ marginTop: 8, display: 'inline-block' }}>
            From your data
          </span>
        </div>

        {/* Asset waterfall bars */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 18, padding: '14px 18px', marginBottom: 12,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Assets</div>
          {rows.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              No asset data yet — add assets to see breakdown.
            </div>
          )}
          {rows.map(({ label, value, colour }) => {
            const pctOfAssets = totalAssets > 0 ? (value / totalAssets) * 100 : 0
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(value)}
                  </span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${Math.max(0, Math.min(100, pctOfAssets))}%`,
                    background: colour,
                    transition: 'width 900ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                  {pctOfAssets.toFixed(0)}% of assets
                </div>
              </div>
            )
          })}
        </div>

        {/* Liabilities */}
        {liabilities > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Liabilities</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Total debt</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums' }}>
                −{fmt(liabilities)}
              </span>
            </div>
            {lb?.months != null && (
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
                Liquidity covers {lb.months.toFixed(1)} months of essentials
              </div>
            )}
          </div>
        )}

        {/* Investable vs illiquid */}
        {inv > 0 && (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '14px 18px', marginBottom: 12,
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Liquidity split</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Investable / liquid</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(inv)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>Illiquid (property + business)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(Math.max(0, totalAssets - inv))}
              </span>
            </div>
          </div>
        )}

        {/* FCA footer */}
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 12px' }}>
          Information only · Values from your data · Not regulated advice
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════════ */

export default function HomeScreen({
  entity,
  viewMode: _viewModeProp,  // eslint-disable-line no-unused-vars — ignored; local state owns this
  personaId,                // eslint-disable-line no-unused-vars
  onNav,
  onCommit,                 // eslint-disable-line no-unused-vars
  onAskAI,                  // eslint-disable-line no-unused-vars
  onOpenBreakdown,          // FQBreakdown overlay (used by Score Drillable)
  onDrillMetric,            // PP-3 — push detail frame onto Dashboard's stack
}) {
  // ── viewMode lives here as LOCAL state (Task 2) ────────────────────────
  const [viewMode, setViewMode] = useState('actual')

  // ── Core engine values ─────────────────────────────────────────────────
  const nw   = useMemo(() => safe(() => netWorth(entity), 0), [entity])
  const fq   = useMemo(() => safe(() => calcFQ(entity),
    { total: 0, score: 0, band: { name: 'Building', colour: 'var(--c-text3)' }, dims: {} }), [entity])
  const risk = useMemo(() => safe(() => calcRisk(entity),
    { total: 0, band: { name: 'Building', colour: 'var(--c-text3)' } }), [entity])

  // ── X29 diffs ──────────────────────────────────────────────────────────
  const diffs = useMemo(() => safe(() => diffSet(entity, null), []), [entity])

  // FIX S1 — local stub overlay state (used only when onDrillMetric upstream
  // doesn't exist). Keeps the radar dim-tap from being silent in any host.
  const [stubMetric, setStubMetric] = useState(null)

  // L3 drill panel state — 'networth' opens the local NetWorthDrillPanel.
  // Other metrics (wealthScore, riskScore) are handled by Dashboard's pushDetail.
  const [localDrill, setLocalDrill] = useState(null)

  const drillFn = (metric) => {
    if (metric === 'netWorth' || metric === 'networth') { setLocalDrill('networth'); return }
    if (metric === 'coi')                               { setLocalDrill('coi');      return }
    if (metric === 'apq' || metric === 'gaps')          { setLocalDrill('apq');      return }
    if (metric === 'pension-drawdown')                  { setLocalDrill('pension-drawdown'); return }
    // Dim keys — strip prefix if present ('wealth.behaviour' → 'behaviour')
    const dimKey = typeof metric === 'string' ? metric.replace(/^wealth\./, '') : metric
    const DIM_KEYS = ['behaviour', 'capital', 'tax', 'protection', 'cashflow', 'debt', 'estate']
    if (DIM_KEYS.includes(dimKey)) {
      // Show DimExplainerStub locally; if host provided onDrillMetric, also call it
      setStubMetric(dimKey)
      return
    }
    // Everything else (riskScore, wealthScore, etc.) — push to host or stub
    if (onDrillMetric) onDrillMetric(metric)
    else setStubMetric(metric)
  }

  return (
    <>
      {/* Drill panels — float above everything (replaces early returns) */}
      {localDrill === 'networth' && <NetWorthDrillPanel entity={entity} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'coi'     && <CoIDrillPanel       entity={entity} onNav={onNav} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'apq'     && <APQDrillPanel        entity={entity} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'pension-drawdown' && (
        <PensionDrawdownPanel entity={entity} onClose={() => setLocalDrill(null)} onNav={onNav} />
      )}
      {stubMetric && <DimExplainerStub metric={stubMetric} fqData={fq} onNav={onNav} onClose={() => setStubMetric(null)} />}

      {/* ── Masthead (Task 2: avatar + mode pill) ─────────────────────── */}
      <MastheadCard entity={entity} viewMode={viewMode} onModeChange={setViewMode} />

      {/* ── Anchor row (inline AnchorRow component defined above) ─────── */}
      <AnchorRow
        nw={nw}
        fqData={fq}
        riskData={risk}
        entity={entity}
        onDrillMetric={drillFn}
        onOpenBreakdown={onOpenBreakdown}
      />

      {/* ── Zone 4: State Tiles (spec §Z4) ────────────────────────────── */}
      <StateTilesCard entity={entity} onNav={onNav} />

      {/* ── 2-column content grid (Task 2 scaffold) ───────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 14, margin: '0 16px',
      }}>
        {/* LEFT: Radar card */}
        <RadarCard
          entity={entity}
          fqData={fq}
          nw={nw}
          viewMode={viewMode}
          diffs={diffs}
          onDrillMetric={drillFn}
        />
        {/* RIGHT: Actions card (Task 4) */}
        <ActionsCard entity={entity} viewMode={viewMode} onNav={onNav} onDrillMetric={drillFn} />
      </div>

      {/* CoI + SIPP-IHT countdown now embedded in AnchorRow (4-column layout) */}

      {/* ── Card 5: Plan progress strip ───────────────────────────────── */}
      <PlanProgressStrip entity={entity} onNav={onNav} />

      {/* ── FCA footer ────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--c-text3)',
        padding: '14px 24px 8px', lineHeight: 1.6,
      }}>
        Information &amp; guidance only · Not regulated financial advice · FCA boundary applies
      </div>

      {/* Nav spacer */}
      <div style={{ height: 78 }} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   WhatIfSection — 5 scenario rows + freeform input
   Used inside ActionsCard at the bottom of the right column.
   ═══════════════════════════════════════════════════════════════════════ */

function WhatIfSection({ viewMode, onSelectScenario, onFreeform }) {
  const [freeform, setFreeform] = useState('')
  const [showAll, setShowAll]   = useState(false)
  const isActive = viewMode === 'scenario'
  const visible  = showAll ? DE_SCENARIOS : DE_SCENARIOS.slice(0, 5)

  return (
    <div style={{
      borderTop: '1px solid var(--c-sep)',
      padding: '12px 16px 14px',
      background: isActive ? 'rgba(186,140,255,0.04)' : 'transparent',
      transition: 'background 300ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ba8cff', display: 'flex', alignItems: 'center', gap: 6 }}>
          ✦ What if?
        </span>
        <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>Explore · not advice</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((s, i) => (
          <button
            key={s.key}
            onClick={() => onSelectScenario(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', background: 'none', border: 'none',
              borderBottom: i < visible.length - 1 ? '1px solid var(--c-sep)' : 'none',
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 1 }}>{s.sub}</div>
            </div>
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              padding: '2px 5px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
              ...(s.engine
                ? { background: 'rgba(93,219,194,0.12)', color: 'var(--c-acc)', border: '1px solid rgba(93,219,194,0.3)' }
                : { background: 'rgba(186,140,255,0.12)', color: '#ba8cff', border: '1px solid rgba(186,140,255,0.3)' }
              ),
            }}>{s.tag}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowAll(s => !s)}
        style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ba8cff', fontSize: 11, fontWeight: 700, padding: '4px 0', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}
      >
        {showAll ? '← See fewer scenarios' : `See all ${DE_SCENARIOS.length} scenarios →`}
      </button>

      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'rgba(186,140,255,0.07)',
        border: '1px dashed rgba(186,140,255,0.30)',
        borderRadius: 12,
      }}>
        <input
          value={freeform}
          onChange={e => setFreeform(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && freeform.trim()) { onFreeform(freeform.trim()); setFreeform('') } }}
          placeholder="Ask your own what-if…"
          style={{ flex: 1, fontFamily: 'inherit', fontSize: 12, color: 'var(--c-text2)', background: 'transparent', border: 'none', outline: 'none' }}
        />
        <button
          onClick={() => { if (freeform.trim()) { onFreeform(freeform.trim()); setFreeform('') } }}
          style={{ fontSize: 10, fontWeight: 700, color: '#ba8cff', background: 'rgba(186,140,255,0.15)', border: 'none', borderRadius: 999, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Ask Sonu →
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ActionsCard — expandable actions list + WhatIfSection
   Replaces PriorityActionCard + ActiveInsightsCard + DecisionEngineEntryCard
   in the right column of the 2-column grid.
   ═══════════════════════════════════════════════════════════════════════ */

function severityBadge(action) {
  const p = action?.priority
  if (p === 1) return { label: 'CRIT', bg: 'rgba(255,89,89,0.18)',    color: '#ff5959' }
  if (p === 2) return { label: 'HIGH', bg: 'rgba(255,189,89,0.18)',   color: 'var(--c-gold)' }
  if (p === 3) return { label: 'MED',  bg: 'rgba(93,219,194,0.15)',   color: 'var(--c-acc)' }
  return             { label: 'LOW',  bg: 'rgba(255,255,255,0.06)',   color: 'var(--c-text3)' }
}

function ActionsCard({ entity, viewMode, onNav, onDrillMetric }) {
  const apq = useMemo(() => safe(() => calcAPQ(entity), []), [entity])
  const actions = Array.isArray(apq) ? apq : []
  const [expandedId, setExpandedId] = useState(null)
  const [intakeScenario, setIntakeScenario] = useState(null)

  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 20,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {intakeScenario ? (
        <ScenarioIntake
          scenario={intakeScenario}
          entity={entity}
          onBack={() => setIntakeScenario(null)}
          onSubmit={({ query, eventId }) => {
            setIntakeScenario(null)
            onNav?.('de', { query, eventId })
          }}
        />
      ) : (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)' }}>
              What to do next
            </span>
            {actions.length > 0 && (
              <button onClick={() => onDrillMetric?.('apq')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--c-acc)', fontWeight: 700, padding: 0,
              }}>
                See all {actions.length} →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {actions.slice(0, 6).map((action, i) => {
              const badge  = severityBadge(action)
              const route  = safeRoute(action)
              const isOpen = expandedId === (action.id || i)
              const impact = action?.impact?.finioScore || 0
              return (
                <div key={action.id || i}>
                  <div
                    onClick={() => setExpandedId(isOpen ? null : (action.id || i))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px',
                      borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                      cursor: 'pointer',
                      background: isOpen ? 'linear-gradient(180deg, rgba(255,189,89,0.06), transparent)' : 'transparent',
                    }}
                  >
                    <span style={{
                      flexShrink: 0, padding: '3px 7px', borderRadius: 6,
                      background: badge.bg, fontSize: 9.5, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: 0.5, color: badge.color,
                      minWidth: 38, textAlign: 'center',
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3, minWidth: 0 }}>
                      {action.title || action.headline || '—'}
                    </span>
                    {impact > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc)', flexShrink: 0 }}>+{impact}</span>
                    )}
                    <span style={{ color: 'var(--c-text3)', fontSize: 16, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>›</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '4px 16px 14px' }}>
                      <p style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 10px' }}>
                        {action.context || action.detail || action.why || ''}
                      </p>
                      {route && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (action.id === 'pension-drawdown') {
                              onDrillMetric?.('pension-drawdown')
                            } else {
                              onNav?.(route)
                            }
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: 999, background: 'var(--c-acc)',
                            border: 'none', color: '#0B1F3A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Show me how →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <WhatIfSection
            viewMode={viewMode}
            onSelectScenario={setIntakeScenario}
            onFreeform={q => onNav?.('de', { query: q })}
          />
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Decision Engine Entry Card
   Replaces 5 hardcoded What-if cinema scenarios with a single dynamic entry.
   Tapping a chip calls onNav('de', { query, eventId }) — parent routes to
   DecisionEngineV2 with the pre-matched event, skipping ontology matching.
   Spec: plan §Phase 4 — "replace 5 hardcoded What-if scenarios".
   ═══════════════════════════════════════════════════════════════════════ */

const DE_SCENARIOS = [
  { key: 'relocate',     icon: '✈️', label: 'How much do I need to relocate?',             sub: 'Kenya · Portugal · UAE — cost, tax, residency',  tag: 'Ask Sonu', engine: false, query: 'What would it cost and mean financially to relocate abroad?', eventId: null },
  { key: 'house',        icon: '🏡', label: 'What if I moved to a bigger house?',           sub: 'Stamp duty, mortgage impact, equity',              tag: 'Ask Sonu', engine: false, query: 'What if I moved to a bigger house? Cover SDLT, funding options, and cashflow impact.', eventId: 'buy_second_home' },
  { key: 'retire',       icon: '⏱️', label: 'What if I retired 5 years earlier?',          sub: 'Pension drawdown — cashflow, Score, IHT',          tag: 'Instant',  engine: true,  query: 'What if I retired 5 years earlier?', eventId: 'retire' },
  { key: 'part_time',    icon: '🌴', label: 'What if I went part-time or took a break?',   sub: 'Runway, monthly shortfall, when to return',        tag: 'Instant',  engine: true,  query: 'What if I went part-time or took a career break?', eventId: 'part_time' },
  { key: 'children',     icon: '🏠', label: 'What if I helped my children get started?',   sub: 'Gifting, trust, mortgage — IHT impact',            tag: 'Ask Sonu', engine: false, query: 'What if I helped my children financially — gifting, trust, or joint mortgage?', eventId: 'setup_trust' },
  { key: 'downsize',     icon: '🔑', label: 'What if I downsized my home?',                sub: 'Equity release, SDLT saving, cashflow impact',     tag: 'Instant',  engine: true,  query: 'What if I downsized my home? Show the equity I would release, any SDLT saving, and how it changes my cashflow and estate.', eventId: 'sell_property' },
  { key: 'lump_pension', icon: '💰', label: 'What if I made a large pension top-up?',      sub: 'Tax relief, carry-forward, IHT benefit',           tag: 'Instant',  engine: true,  query: 'What if I made a large one-off pension contribution? Cover tax relief available, annual allowance, carry-forward rules, and the IHT benefit of a larger SIPP.', eventId: 'pension_contribution' },
  { key: 'inheritance',  icon: '📜', label: 'What if I received an inheritance?',           sub: 'IHT position, investment options, trust',          tag: 'Ask Sonu', engine: false, query: 'What if I received a significant inheritance? How should I invest it, what are the IHT implications, and should I consider a trust?', eventId: null },
  { key: 'care',         icon: '🏥', label: 'What if I needed long-term care?',             sub: 'Care costs, estate depletion, LPA urgency',        tag: 'Ask Sonu', engine: false, query: 'What if I or my partner needed long-term care? Cover likely costs, the impact on my estate, and why a lasting power of attorney matters now.', eventId: null },
  { key: 'market_drop',  icon: '📉', label: 'What if markets fell 20%?',                   sub: 'Drawdown impact, Score, recovery timeline',        tag: 'Instant',  engine: true,  query: 'What if my investment portfolio dropped 20%? Show the impact on my drawdown sustainability, Wealth Score, and estimated recovery timeline.', eventId: 'market_shock' },
  { key: 'business',     icon: '🏢', label: 'What if I sold my business?',                  sub: 'CGT, BADR, reinvestment, retirement timing',       tag: 'Ask Sonu', engine: false, query: 'What if I sold my business? Cover CGT, Business Asset Disposal Relief, reinvestment options, and how the timing interacts with my retirement plan.', eventId: 'business_sale' },
  { key: 'gift',         icon: '🎁', label: 'What if I gifted to family this tax year?',    sub: '7-year rule, PETs, IHT saving',                    tag: 'Instant',  engine: true,  query: 'What if I made significant gifts to family now? Cover the 7-year rule, potentially exempt transfers, and how much IHT this would save from my estate.', eventId: 'gift_to_family' },
]



