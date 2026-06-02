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
import { useTemporalMode } from '../state/temporalMode.jsx'
import ScenarioIntake from '../components/Home/ScenarioIntake.jsx'
import PensionDrawdownPanel from '../components/Home/PensionDrawdownPanel.jsx'
import { MiniTrendLines } from '../components/MyMoney/L3/MiniTrendLines.jsx'
import { projectSeries, growthRateFor } from '../engine/projection.js'
import { getActiveCMA } from '../engine/cma.js'
import { classifyPot, potsNeedingReview } from '../engine/decumulation-plan.js'
// S1 selector migration (Phase 2): canonical readers come through the
// engine/selectors/ facade so screens can't drift back to inline raw-field
// readers (P0-2 class of bug). Direct engine imports in screens are forbidden
// for selector-covered metrics — see eslint.config.js no-restricted-imports.
import {
  liabilities as engineLiabilitiesTotal,
  netWorth, investable,
  fq as calcFQ,
  protection as protectionScore,
  concentrationRisk,
} from '../engine/selectors/index.js'
import {
  calcRisk, calcAPQ, fmt,
  // costOfInaction stays direct: fq-calculator's signature is (entity, actionDomain)
  // while tax-estate-engine's is (entity, bundle). Don't conflate via facade.
  planFor, diffSet, costOfInaction, totalCoI, ihtSippDelta,
  liquidityBuffer,
  debtRatio, estateReadiness, taxEfficiency,
  monthlySurplus,
  daysLeft as engineDaysLeft,
} from '../engine/fq-calculator.js'
import Drillable from '../components/shared/Drillable.jsx'
import RadarAnchor from '../components/Home/RadarAnchor.jsx'
import { DIMENSIONS } from '../config/dimensions.js'
import { getWealthTarget, gapDims as gapDimsVsTarget } from '../config/wealth-targets.js'

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
// P1-11 (2026-05-28): for "Mr T Core" / "Mr T · 35 · …" the previous
// pickFirstName returned just "T" — the first non-title token in
// `name` AND in `displayName` was a single letter. New helper applies
// the same title-preservation rule to both paths.
function _friendlyFromParts(parts) {
  let title = null
  const nonTitle = []
  for (const tok of parts) {
    const clean = tok.toLowerCase().replace(/\.$/, '')
    if (TITLES.has(clean)) {
      if (!title) title = tok
    } else {
      nonTitle.push(tok)
    }
  }
  if (nonTitle.length === 0) return parts[0] || null
  // Single-letter first token + title present → keep "Mr T" / "Dr T".
  if (nonTitle[0].length === 1 && title) {
    return `${title} ${nonTitle[0]}`
  }
  return nonTitle[0]
}

function pickFirstName(entity) {
  // Prefer displayName if present; it's curated.
  const dn = entity?.displayName
  if (typeof dn === 'string' && dn.trim()) {
    const parts = dn.split(/[\s·]+/).filter(Boolean)
    const friendly = _friendlyFromParts(parts)
    if (friendly) return friendly
  }
  const rawName = entity?.individual?.name || entity?.name || ''
  const parts = rawName.split(/\s+/).filter(Boolean)
  const friendly = _friendlyFromParts(parts)
  return friendly || 'there'
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
  'pension-drawdown':      'money',
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
  // Founder feedback 2026-05-28: persona avatar + name was duplicated here AND
  // in the Dashboard top-right persona switcher. Removed the avatar row; the
  // greeting line is preserved as a thin date strip (text only, no avatar) so
  // there's still a "Good afternoon · Thu 28 May" temporal anchor without
  // re-rendering the persona identity. The full firstName has moved out — the
  // top-right BW/MR avatar IS the persona indicator now.
  const _firstName = pickFirstName(entity)  // kept for potential future reintroduction
  void _firstName  // keep linter quiet — symbol may be unused
  return (
    <div style={{ margin: '0 16px 14px' }}>
      {/* Thin temporal strip — date only (greeting + day-of-week).
          Persona identity lives in the Dashboard top-right avatar (V-2 fix). */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
        fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.2,
      }}>
        <span>{greeting()} · {fmtHomeDate()}</span>
        <span style={{ fontSize: 9, opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>{BUILD}</span>
      </div>
      {/* Mode tabs, scrollable so all 4 always visible */}
      <div style={{
        display: 'flex', gap: 3, padding: 4, marginTop: 12,
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 999,
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {MODES.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => onModeChange?.(id)} aria-pressed={viewMode === id} style={{
            padding: '12px 16px', minHeight: 44, borderRadius: 999, border: 'none', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            background: viewMode === id ? 'var(--c-acc)' : 'transparent',
            color: viewMode === id ? 'var(--c-on-accent, #0B1F3A)' : 'var(--c-text3)',
            cursor: 'pointer', transition: 'background 150ms ease',
            whiteSpace: 'nowrap', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center',
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
    if (!v && v !== 0) return 0
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
    return +v?.total || +v?.value || 0
  }
  const pensions  = num(a.sipp) + num(a.pension) + num(a.pensions)
  const isa       = num(a.isa) + num(a.lisa)
  const home      = safe(() => (Array.isArray(a.property) ? a.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0), 0)
              + num(a.residence) + num(a.home)
  const cash      = num(a.cash) + num(a.bank) + num(a.savings)
  const business  = safe(() => (Array.isArray(a.business_assets) ? a.business_assets : []).reduce((s, b) => s + (+b.currentValue || +b.value || 0), 0), 0)
  // Portfolio: check holdings OR direct value
  const portfolio = safe(() => {
    const h = a.portfolio?.holdings || a.holdings || []
    const fromHoldings = h.reduce((s, hh) => s + (+hh.currentValue || +hh.value || 0), 0)
    return fromHoldings > 0 ? fromHoldings : num(a.portfolio)
  }, 0) + num(a.investments) + num(a.alternatives)
  const total = pensions + isa + home + cash + business + portfolio || 1
  const segments = [
    { label: 'Pensions',    key: 'pensions',  pct: pensions   / total, color: 'var(--c-acc2)' },
    { label: 'ISA',         key: 'isa',       pct: isa        / total, color: 'var(--c-acc)'  },
    { label: 'Home',        key: 'property',  pct: home       / total, color: 'var(--c-gold)' },
    { label: 'Cash',        key: 'cash',      pct: cash       / total, color: 'var(--c-text3)' },
    { label: 'Business',    key: 'business',  pct: business   / total, color: '#ba8cff' },
    { label: 'Investments', key: 'portfolio', pct: portfolio  / total, color: 'var(--c-success)' },
  ].filter(s => s.pct > 0.005)
  // V-2 fix (2026-05-28): displayPct uses Hamilton (largest-remainder) so the
  // printed integers always sum to exactly 100. Earlier each segment was
  // Math.round(pct*100) independently — produced 21+10+55+4 = 90 on Bruce
  // because the rounding sliced too aggressively. pct (raw fraction) is kept
  // for bar widths.
  const raw = segments.map(s => s.pct * 100)
  const floors = raw.map(r => Math.floor(r))
  const remainders = raw.map((r, i) => ({ i, frac: r - floors[i] }))
  const leftover = 100 - floors.reduce((s, n) => s + n, 0)
  remainders.sort((a, b) => b.frac - a.frac)
  const display = floors.slice()
  for (let k = 0; k < leftover && k < remainders.length; k++) display[remainders[k].i] += 1
  return segments.map((s, i) => ({ ...s, displayPct: display[i] }))
}


function AnchorRow({ nw, fqData, riskData, entity, onDrillMetric, onOpenBreakdown }) {
  const [anchorTrend, setAnchorTrend] = useState(null)
  const score      = fqData?.total ?? 0
  const riskScore  = riskData?.total ?? 0
  const riskColor  = riskData?.band?.colour || 'var(--c-gold)'
  const riskBand   = riskData?.band?.name || '—'
  const segments   = nwComposition(entity)
  const targetDims = useMemo(() => getWealthTarget(entity)?.dims || {}, [entity])
  const gapCount   = gapDimsVsTarget(fqData?.dims || {}, targetDims, 0.15).length

  // History sparklines from persona trajectories
  const traj = entity?.trajectories || {}
  const nwSpark    = (traj.netWorthHistory || []).map(p => p.value ?? p)
  const scoreSpark = (traj.scoreHistory    || []).map(p => p.score ?? p)
  const riskSpark  = (traj.riskHistory     || []).map(p => p.score ?? p)
  const coiSpark   = (traj.coiHistory || []).map(p => (typeof p === 'object' && p !== null) ? (p.value ?? p.total ?? 0) : p)

  const coiTotal   = safe(() => totalCoI(entity).total ?? 0, 0)
  const sippDelta  = safe(() => ihtSippDelta(entity) ?? 0, 0)
  const dueDate  = new Date('2027-04-06')
  const now      = new Date()
  const days     = engineDaysLeft()
  const enacted  = new Date('2026-03-18')
  const totalSpan = (dueDate - enacted) / 86_400_000
  const elapsed   = (now - enacted) / 86_400_000
  const pct       = Math.min(100, Math.max(0, (elapsed / totalSpan) * 100))

  // SVG donut for Score
  const r = 16, C = 2 * Math.PI * r
  const filled       = (score / 100) * C
  const targetFilled = (68   / 100) * C

  return (
    <>
    <div style={card({ padding: '14px 18px', margin: '0 16px 12px' })}>
      <div className="sw-anchor-row">

        {/* NW + composition bar — whole column is drillable */}
        <div
          onClick={() => onDrillMetric?.('netWorth')}
          style={{ borderRight: '1px solid var(--c-sep)', paddingRight: 16, cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)' }}>Net Worth ›</div>
            {nwSpark.length > 1 && (
              <div onClick={e => { e.stopPropagation(); setAnchorTrend({ label: 'Net Worth', value: fmt(nw), spark: nwSpark, what: 'The total value of everything you own minus what you owe. Your primary measure of financial progress.', colour: 'var(--c-text2)' }) }}>
                <Sparkline values={nwSpark} color="var(--c-text2)" width={40} height={18} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span data-tieout="home.nw" data-tieout-raw={String(nw)} style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -1 }}>{fmt(nw)}</span>
          </div>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--c-surface2)', marginTop: 8 }}>
            {segments.map(s => <div key={s.label} style={{ width: `${s.pct * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
            {segments.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => onDrillMetric?.(`netWorth:${s.key}`)}
                aria-label={`Drill into ${s.label} composition (${s.displayPct}%)`}
                className="sw-tap"
                style={{ background: 'none', border: 'none', padding: '6px 2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
              >
                <i style={{ width: 6, height: 6, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: 'var(--c-text3)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}>{s.label.replace('Investments','Inv.')} {s.displayPct}%</span>
              </button>
            ))}
          </div>
          {/* P13-1 (2026-05-28, IFA must-fix #1): concentration risk chip.
              Surfaces single-asset-class %  when > 50%. Renders nothing for
              well-diversified portfolios. Amber at 50–65%, coral at 65%+. */}
          {(() => {
            const cr = (() => { try { return concentrationRisk(entity) } catch { return null } })()
            if (!cr || cr.status === 'ok') return null
            const label = cr.topClass.charAt(0).toUpperCase() + cr.topClass.slice(1)
            const pct = Math.round(cr.topPct * 100)
            const colour =
              cr.status === 'severe'      ? 'var(--c-coral-text)' :
              cr.status === 'concentrated'? 'var(--c-amber-text)' :
                                            'var(--c-amber-text)'
            const bg =
              cr.status === 'severe'      ? 'var(--c-tint-coral)' :
                                            'var(--c-tint-amber)'
            return (
              <div title={`${label} accounts for ${pct}% of your wealth — most IFAs would discuss diversification at this level.`} style={{
                marginTop: 6, padding: '4px 8px',
                background: bg, color: colour,
                borderRadius: 6, fontSize: 10, fontWeight: 700,
                display: 'inline-block', lineHeight: 1.3,
              }}>
                Concentration · {label} {pct}%
              </div>
            )
          })()}
        </div>

        {/* Score + donut + gaps badge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Wealth Score</div>
          <button onClick={() => onOpenBreakdown?.()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <svg width="40" height="40" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-surface2)" strokeWidth="5" />
              <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,189,89,0.25)" strokeWidth="5"
                strokeDasharray={`${targetFilled.toFixed(1)} ${(C - targetFilled).toFixed(1)}`} />
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--c-acc)" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${filled.toFixed(1)} ${(C - filled).toFixed(1)}`} />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
                {score}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {gapCount > 0 && fqData?.band?.name === 'Optimised' ? 'On Track' : (fqData?.band?.name || '—')}
              </div>
            </div>
            {scoreSpark.length > 1 && (
              <div onClick={e => { e.stopPropagation(); setAnchorTrend({ label: 'Wealth Score', value: `${score}/100`, spark: scoreSpark, what: 'Your overall financial health — combining money habits, capital, tax, protection, cashflow, debt and estate planning.', colour: 'var(--c-acc)' }) }}>
                <Sparkline values={scoreSpark} color="var(--c-acc)" width={40} height={18} />
              </div>
            )}
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
                {gapCount} {gapCount === 1 ? 'gap' : 'gaps'} in radar →
              </span>
            </button>
          )}
        </div>

        {/* Risk + gradient gauge */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Risk Score</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Drillable metric="riskScore" onOpen={onDrillMetric} inline affordance="none">
              <span style={{ fontSize: 20, fontWeight: 800, color: riskColor, letterSpacing: -0.5 }}>
                {riskScore}<span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>/100</span>
              </span>
            </Drillable>
            {riskSpark.length > 1 && (
              <div onClick={() => setAnchorTrend({ label: 'Risk Score', value: `${riskScore}/100`, spark: riskSpark, what: 'How much financial risk you carry — investment volatility, debt, concentration, and liquidity gaps.', colour: riskColor })}>
                <Sparkline values={riskSpark} color={riskColor} width={40} height={18} />
              </div>
            )}
          </div>
          <div style={{ position: 'relative', height: 8, borderRadius: 4, marginTop: 8, overflow: 'hidden',
            background: 'linear-gradient(90deg, #34c759 0%, #34c759 33%, #ffb347 33%, #ffb347 66%, #ff6b6b 66%, #ff6b6b 100%)' }}>
            <div style={{
              position: 'absolute', top: -5, left: `calc(${riskScore}% - 9px)`,
              width: 18, height: 18, borderRadius: '50%',
              background: riskColor, border: '2px solid var(--c-bg)',
              boxShadow: `0 0 8px ${riskColor}88`,
            }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: riskColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{riskBand}</div>
          </div>
        </div>

        {/* CoI + countdown bar */}
        <div style={{ paddingLeft: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: 'var(--c-text3)', marginBottom: 4 }}>Cost of Inaction</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Drillable metric="coi" onOpen={onDrillMetric} inline affordance="none">
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc3)', letterSpacing: -0.5 }}>{coiTotal > 0 ? fmt(coiTotal) : '—'}</span>
            </Drillable>
            {coiSpark.length > 1 && (
              <div
                onClick={() => setAnchorTrend({ label: 'Cost of Inaction', value: fmt(coiTotal), spark: coiSpark.map(p => p.value ?? p), what: 'The annual financial cost of staying on your current path without taking recommended actions.', colour: 'var(--c-acc3)' })}
                title="Tap to see trend"
                style={{ cursor: 'zoom-in', borderRadius: 4 }}
              >
                <Sparkline values={coiSpark} color="var(--c-acc3)" width={40} height={18} lowerIsBetter />
              </div>
            )}
          </div>
          {coiTotal > 0 && (
            <div style={{ marginTop: 2 }}>
              {sippDelta > 0
                ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)', whiteSpace: 'nowrap' }}>{fmt(sippDelta)} SIPP · {days} days</span>
                : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-acc3)' }}>{days} days to act</span>
              }
            </div>
          )}
          <div style={{ position: 'relative', height: 4, background: 'var(--c-surface2)', borderRadius: 2, marginTop: 5, overflow: 'visible' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--c-gold), var(--c-acc3))', borderRadius: 2 }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--c-acc3)', border: '2px solid var(--c-bg)',
              boxShadow: '0 0 6px var(--c-acc3)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <div style={{ fontSize: 9, color: 'var(--c-text3)', lineHeight: 1.4 }}>Mar 2026</div>
            <div style={{ fontSize: 9, color: 'var(--c-acc3)', lineHeight: 1.4, fontWeight: 700 }}>6 Apr 2027</div>
          </div>
        </div>

      </div>
    </div>
    {anchorTrend && (
      <TrendModal
        tile={anchorTrend}
        colour={anchorTrend.colour}
        onClose={() => setAnchorTrend(null)}
      />
    )}
    </>
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
  const days = engineDaysLeft()  // uses TAX.deadline — same source as Timeline

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
      <div style={{ flex: 1, fontSize: 13, color: 'var(--c-text2)' }}>
        No active plan — set one in the <strong style={{ color: 'var(--c-text)' }}>Timeline</strong> tab.
      </div>
      <span style={{ color: 'var(--c-acc)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Set plan →</span>
    </div>
  )

  const targetDate    = plan.target?.date || plan.horizonDate || null
  const targetValue   = typeof plan.target === 'number'
    ? plan.target
    : (plan.target?.netWorth || plan.target?.value || plan.targetValue || 0)
  const monthlyTarget = plan.target?.monthlyDrawdown || 0
  const drawdownStarted = (entity?.drawdown || 0) > 0
  const planName = plan.name || plan.label || plan.goal || 'Retirement plan'

  let pct = 0
  let statusLabel = 'Not started'
  let statusColor = 'var(--c-text3)'
  let progressKind = 'none'   // 'money' | 'time'

  // Prefer MONEY progress (how far toward your £ number). Calendar-time-elapsed
  // is a weak proxy and was shown FIRST under a "Plan progress" header, so a
  // user read e.g. "47%" as "47% of the way to my number" when it actually
  // meant "47% of the timeline has passed" (audit 2026-06-02). Money wins;
  // time-elapsed is only a fallback and is now labelled as such.
  const planCurrent = plan.progress?.current ?? plan.current ?? safe(() => netWorth(entity), 0)
  if (targetValue > 0) {
    pct = Math.min(100, Math.max(0, Math.round((planCurrent / targetValue) * 100)))
    const onTrack = plan.progress?.onTrack ?? plan.onTrack ?? null
    progressKind = 'money'
    statusLabel = drawdownStarted ? 'In progress' : onTrack === false ? 'Behind plan' : onTrack ? 'On course' : 'Saving'
    statusColor = onTrack === false ? 'var(--c-acc3)' : 'var(--c-acc)'
  } else if (targetDate) {
    const deadline  = new Date(targetDate)
    const created   = plan.createdAt ? new Date(plan.createdAt) : new Date(Date.now() - 86_400_000 * 365)
    const totalSpan = deadline - created
    const elapsed   = Date.now() - created
    pct = totalSpan > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100))) : 0
    progressKind = 'time'
    statusLabel = drawdownStarted ? 'In progress' : 'Timeline'
    statusColor = 'var(--c-text3)'
  }

  const daysLeft = targetDate
    ? Math.max(0, Math.ceil((new Date(targetDate) - new Date()) / 86_400_000))
    : null

  const barColor = progressKind === 'time' ? 'var(--c-text3)'
    : statusLabel === 'Behind plan' ? 'var(--c-acc3)'
    : 'var(--c-acc)'

  return (
    <div style={{ margin: '14px 16px 0', padding: '14px 18px', background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--c-text3)', marginBottom: 2 }}>Plan progress</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {planName}
            {monthlyTarget > 0 && ` · ${fmt(monthlyTarget)}/month target`}
            {!monthlyTarget && targetValue > 0 && ` · ${fmt(targetValue)} target`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {daysLeft !== null && (
            <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{daysLeft} days</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--c-surface2)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 100, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 6 }}>
        {progressKind === 'money'
          ? <><strong style={{ color: 'var(--c-text)' }}>{pct}%</strong> · {fmt(planCurrent)} of {fmt(targetValue)}{daysLeft != null ? ` · ${daysLeft} days left` : ''}</>
          : progressKind === 'time'
            ? <><strong style={{ color: 'var(--c-text)' }}>{pct}%</strong> of your timeline elapsed{daysLeft != null ? ` · ${daysLeft} days to deadline` : ''} · set a target amount to track savings</>
            : null
        }
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

/* ═══════════════════════════════════════════════════════════════════════════
   Trend Modal — full chart overlay, opened when a sparkline is tapped
   ═══════════════════════════════════════════════════════════════════════ */
function TrendModal({ tile, colour, onClose, onNav, onDrillDim }) {
  const values = tile?.spark || []
  if (!values.length) return null

  const W = 320, H = 170
  const PAD = { top: 16, right: 14, bottom: 32, left: 42 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const min  = Math.min(...values)
  const max  = Math.max(...values)
  const rng  = max - min || 1
  const toX  = i => PAD.left + (i / Math.max(values.length - 1, 1)) * cW
  const toY  = v => PAD.top + cH - ((v - min) / rng) * cH

  const pts  = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const bot  = (PAD.top + cH).toFixed(1)
  const areaPath = [
    `M${toX(0).toFixed(1)},${toY(values[0]).toFixed(1)}`,
    ...values.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    `L${toX(values.length - 1).toFixed(1)},${bot}`,
    `L${toX(0).toFixed(1)},${bot} Z`,
  ].join(' ')

  const current = values[values.length - 1]
  const first   = values[0]
  const change  = current - first
  const up      = change >= 0

  // Y-axis: 4 evenly-spaced gridlines
  const yTicks = [0, 1, 2, 3].map(k => {
    const v = min + (k / 3) * rng
    return { v, y: toY(v) }
  })

  // X-axis labels every 6 months + "Now" at the end
  const n   = values.length
  const now = new Date()
  const xLabels = []
  for (let i = 0; i < n; i++) {
    if (i === 0 || i % 6 === 0 || i === n - 1) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - (n - 1 - i))
      xLabels.push({
        i,
        label: i === n - 1 ? 'Now' : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      })
    }
  }

  const col   = colour || 'var(--c-acc)'
  const gradId = `tg-${tile.dimKey || tile.key || 'dim'}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes tm-slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-bg)',
          borderRadius: '22px 22px 0 0',
          padding: '20px 20px 44px',
          width: '100%',
          maxWidth: 480,
          animation: 'tm-slide-up .28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 2 }}>
              {n}-month trend
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.3 }}>{tile.label}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: col, letterSpacing: -0.5 }}>{tile.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: up ? 'var(--c-success, #34c759)' : 'var(--c-danger, #ff6b6b)' }}>
              {up ? '↑' : '↓'} {Math.abs(change).toFixed(0)} over {n} months
            </div>
          </div>
        </div>

        {/* Full chart */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 16, padding: '12px 8px 4px', marginBottom: 14, overflow: 'hidden' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={col} stopOpacity="0.28" />
                <stop offset="100%" stopColor={col} stopOpacity="0"    />
              </linearGradient>
            </defs>
            {/* Y gridlines + labels */}
            {yTicks.map(({ v, y }, k) => (
              <g key={k}>
                <line x1={PAD.left} y1={y} x2={PAD.left + cW} y2={y}
                  stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" />
                <text x={PAD.left - 5} y={y + 3.5} fontSize="8" textAnchor="end"
                  fill="rgba(255,255,255,0.38)" fontFamily="system-ui,sans-serif">
                  {Number.isFinite(v) ? Math.round(v) : ''}
                </text>
              </g>
            ))}
            {/* X-axis labels */}
            {xLabels.map(({ i, label }) => (
              <text key={i} x={toX(i)} y={H - 10} fontSize="8" textAnchor="middle"
                fill="rgba(255,255,255,0.38)" fontFamily="system-ui,sans-serif">
                {label}
              </text>
            ))}
            {/* Area fill */}
            <path d={areaPath} fill={`url(#${gradId})`} />
            {/* Line */}
            <polyline points={pts} fill="none" stroke={col} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
            {/* End dot with halo */}
            <circle cx={toX(values.length - 1)} cy={toY(current)} r="9" fill={col} fillOpacity="0.18" />
            <circle cx={toX(values.length - 1)} cy={toY(current)} r="4.5" fill={col} />
          </svg>
        </div>

        {/* Legend row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'block' }} />
            <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{tile.label}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            Low: {Math.round(min)} · High: {Math.round(max)} · Now: {Math.round(current)}
          </div>
        </div>

        {/* What this measures */}
        {tile.what && (
          <p style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, margin: '0 0 16px' }}>
            {tile.what}
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(tile.dimKey || tile.route) && (onDrillDim || onNav) && (
            <button
              onClick={() => { onClose(); tile.dimKey && onDrillDim ? onDrillDim(tile.dimKey) : onNav?.(tile.route) }}
              style={{ flex: 1, padding: '11px 16px', borderRadius: 100, background: col, border: 'none', color: '#0B1F3A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              See full details →
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '11px 16px', borderRadius: 100, background: 'var(--c-surface2)', border: '1px solid var(--c-sep)', color: 'var(--c-text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* Tiny inline SVG sparkline. `values` = number array, latest last. */
function Sparkline({ values = [], color = 'var(--c-acc)', width = 56, height = 20, onClick, lowerIsBetter = false }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const direction = last > prev ? 'up' : last < prev ? 'down' : 'flat'
  // P1-24 (2026-05-28): semantic colour — for "lower is better" series
  // (CoI accruing, debt, expenses) rising is BAD. Previous code always
  // green-on-up which mis-signalled rising CoI as positive.
  const trend = (lowerIsBetter && direction === 'up') ? 'down'
              : (lowerIsBetter && direction === 'down') ? 'up'
              : direction
  const trendColor = trend === 'up' ? 'var(--c-success, #34c759)' : trend === 'down' ? 'var(--c-danger, #ff6b6b)' : color
  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      onClick={onClick}
      style={{ display: 'block', overflow: 'visible', cursor: onClick ? 'zoom-in' : 'default' }}
      role="img"
      aria-label={`Trend ${trend === 'up' ? 'rising' : trend === 'down' ? 'falling' : 'flat'} — latest ${last.toLocaleString()}, ${values.length} data points`}
    >
      <polyline points={pts} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      {/* End dot */}
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - ((last - min) / range) * (height - 2) - 1}
        r="2.5" fill={trendColor}
      />
    </svg>
  )
}

function StateTilesCard({ entity, onNav, onDrillDim }) {
  // Engine values for sub-labels only — scores come from calcFQ().dims
  const fq   = useMemo(() => safe(() => calcFQ(entity),            { dims: {} }),                      [entity])
  const ms   = useMemo(() => safe(() => monthlySurplus(entity),    { surplus: 0, deficit: 0, income: 0 }), [entity])
  const debt = useMemo(() => safe(() => debtRatio(entity),         { ratio: 0, monthlyService: 0, band: 'none' }), [entity])
  const prot = useMemo(() => safe(() => protectionScore(entity),   { total: 0, band: 'critical' }),     [entity])
  const est  = useMemo(() => safe(() => estateReadiness(entity),   { total: 0, components: {}, band: 'gaps' }), [entity])
  const tax  = useMemo(() => safe(() => taxEfficiency(entity),     { total: 0, components: {} }),       [entity])

  const dims      = fq.dims || {}
  const traj      = entity?.trajectories || {}
  const cfMonthly = ms.surplus > 0 ? ms.surplus : ms.deficit > 0 ? -ms.deficit : 0

  // Dim score as % of its max (per dimensions.js)
  const dimPct = key => {
    const dim = DIMENSIONS.find(d => d.key === key)
    const raw = dims[key] || 0
    return dim && dim.max > 0 ? Math.min(100, Math.round((raw / dim.max) * 100)) : 0
  }

  // State label from pct
  const stateOf = pct => pct >= 80 ? 'Optimised' : pct >= 65 ? 'On Track' : pct >= 45 ? 'Building' : 'Review'

  // Value-colour: green = good, amber = building, red = needs attention
  const valueColor = s => s === 'Optimised' || s === 'On Track' ? 'var(--c-acc)'
    : s === 'Building' ? 'var(--c-gold)'
    : 'var(--c-acc3)'

  // Trend arrow from last 3 sparkline points
  const trendOf = spark => {
    if (!spark?.length || spark.length < 3) return ''
    const last = spark[spark.length - 1]
    const prev = spark[spark.length - 3]
    if (last > prev * 1.01) return ' ↑'
    if (last < prev * 0.99) return ' ↓'
    return ''
  }

  // Sparklines — best available proxy per dimension (upward = improving)
  // debtHistory is £ amounts; negate so sparkline rises as debt reduces
  const sparks = {
    behaviour:  (traj.behaviourHistory  || (traj.scoreHistory || []).map(p => typeof p === 'object' ? p.score : p)).slice(-24),
    capital:    (traj.capitalHistory    || (traj.netWorthHistory || []).map(p => Math.round((typeof p === 'object' ? p.value : p) / 100000))).slice(-24),
    tax:        (traj.taxEfficiencyHistory || []).slice(-24),
    protection: (traj.protectionHistory    || []).slice(-24),
    cashflow:   (traj.cashflowHistory      || []).slice(-24),
    debt:       (traj.debtHistory          || []).map(v => -v).slice(-24),
    estate:     (traj.estateHistory        || []).slice(-24),
  }

  // Plain-English sub-label per dimension
  const subFor = key => {
    const pct = dimPct(key)
    switch (key) {
      case 'behaviour': return pct >= 80 ? 'You review and act on your finances regularly'
        : pct >= 60 ? 'Good habits in place — keep your quarterly reviews up'
        : 'Set up regular reviews and automated contributions to improve this'
      case 'capital': return pct >= 80 ? 'Your savings and investments are on track for retirement'
        : pct >= 60 ? 'Building well — closing in on your retirement target'
        : 'Gap between what you have saved and what you will need at retirement'
      case 'tax': return (tax.total || 0) >= 70 ? 'Tax allowances well used this year'
        : (tax.total || 0) >= 50 ? 'Check your £20k ISA each April'
        : '£20k ISA and pension gap — use before 5 Apr 2027'
      case 'protection':
        if (prot.band === 'good' || prot.band === 'excellent') return 'Life insurance and illness cover in place'
        if (prot.band === 'partial') return 'Life cover done · no power of attorney'
        return 'No life insurance — your family is financially exposed'
      case 'cashflow':
        if (cfMonthly > 0) return `${fmt(cfMonthly)}/mo surplus — adding to wealth`
        if (cfMonthly < 0) return `${fmt(Math.abs(cfMonthly))}/mo planned drawdown — on track`
        return 'Income covers spending — in balance'
      case 'debt':
        if (debt.band === 'none') return 'No debt — all your income is yours to keep'
        if (pct >= 65) return `${fmt(debt.monthlyService)}/mo debt service — well managed`
        if (pct >= 45) return `${fmt(debt.monthlyService)}/mo debt service — manageable`
        return `${Math.round((debt.ratio || 0) * 100)}p in every £1 goes on debt — worth reviewing`
      case 'estate':
        if (est.band === 'excellent') return 'Estate well planned — wealth passes efficiently'
        if (est.band === 'good') return 'Nearly done — a couple of small gaps to close'
        return `Missing: ${[!est.components?.lpa && 'power of attorney', !est.components?.will && 'up-to-date Will'].filter(Boolean).join(' and ') || 'review estate checklist'}`
      default: return ''
    }
  }

  // Build one tile per dimension, sorted worst-first so most urgent is always visible
  const tiles = DIMENSIONS.map(dim => {
    const pct   = dimPct(dim.key)
    const state = stateOf(pct)
    const spark = sparks[dim.key] || []
    // Only show trend arrow when not Optimised — avoids confusing "88% ↓ OPTIMISED"
    const arrow = state !== 'Optimised' ? trendOf(spark) : ''
    return {
      label:  dim.label,
      dimKey: dim.key,
      colour: dim.colour,
      value:  `${pct}%${arrow}`,
      state,
      spark,
      what:   dim.definition,
      sub:    subFor(dim.key),
      _pct:   pct,
    }
  }).sort((a, b) => a._pct - b._pct)

  const [expandedTile, setExpandedTile] = useState(null)
  const [trendTile,    setTrendTile]    = useState(null)

  return (
    <>
    <div style={{ margin: '0 16px 4px' }}>
      <div className="sw-state-tiles" style={{ paddingBottom: 2 }}>
        {tiles.map(tile => {
          const valColor   = valueColor(tile.state)
          const isExpanded = expandedTile === tile.label
          return (
            <div
              key={tile.label}
              onClick={() => setExpandedTile(isExpanded ? null : tile.label)}
              role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedTile(isExpanded ? null : tile.label) }}
              style={{
                background: 'var(--c-surface)',
                border: `1px solid ${isExpanded ? tile.colour : 'var(--c-sep)'}`,
                borderTop: `3px solid ${tile.colour}`,
                borderRadius: 14,
                padding: '12px 10px',
                cursor: 'pointer',
                flex: '1 1 104px', minWidth: 104,
                height: isExpanded ? 'auto' : 116,
                overflow: isExpanded ? 'visible' : 'hidden',
                transition: 'border-color 120ms',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Label — full width, no sparkline competing */}
              <div title={tile.label} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--c-text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{tile.label}</div>
              {/* Value + sparkline on same row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, marginBottom: 2 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: valColor, letterSpacing: -0.5 }}>{tile.value}</div>
                {tile.spark?.length > 1 && (
                  <div
                    onClick={e => { e.stopPropagation(); setTrendTile({ ...tile }) }}
                    title="Tap to see full trend"
                    style={{ cursor: 'zoom-in', borderRadius: 4, flexShrink: 0 }}
                  >
                    <Sparkline values={tile.spark} color={tile.colour} width={36} height={14} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: tile.colour, opacity: 0.85, marginBottom: 4 }}>{tile.state}</div>
              <div style={{ fontSize: 10, color: 'var(--c-text2)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tile.sub}</div>
              {isExpanded && (
                <div style={{
                  marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--c-sep)',
                  fontSize: 10, color: 'var(--c-text2)', lineHeight: 1.5,
                }}>
                  {tile.what}
                  {onDrillDim && (
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedTile(null); onDrillDim(tile.dimKey) }}
                      style={{ display: 'block', marginTop: 6, fontSize: 10, fontWeight: 700, color: tile.colour, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      See full details →
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
    {trendTile && (
      <TrendModal
        tile={trendTile}
        colour={trendTile.colour}
        onClose={() => setTrendTile(null)}
        onDrillDim={onDrillDim}
      />
    )}
    </>
  )
}

const DIM_EXPLAINERS = {
  behaviour:  { what: 'How consistently your financial actions match your goals — contributions, reviews, rebalancing.', lift: 'Automatic contributions and regular plan reviews tend to keep actions aligned with goals.', route: 'money' },
  capital:    { what: 'How hard your capital is working — return vs risk vs wrapper efficiency.', lift: 'Tax-free ISA and pension allowances are commonly used before a taxable general account (GIA).', route: 'money' },
  tax:        { what: 'How much of your return you keep after tax — allowances, shelters, sequencing.', lift: 'Annual CGT and dividend allowances reset each year; wrapper sequencing (ISA / pension / GIA) affects how much tax you keep.', route: 'tax' },
  protection: { what: 'Whether a shock — illness, death, or liability — would derail your financial plan.', lift: 'Life cover, income protection and a lasting power of attorney are the usual protection building blocks to review.', route: 'risk' },
  cashflow:   { what: 'Whether your monthly surplus gives you flexibility and a resilience buffer.', lift: 'Many advisers suggest 3–6 months of expenses in liquid, accessible savings as a resilience buffer.', route: 'flow' },
  debt:       { what: 'Whether your debt is costing more than your investments earn after tax.', lift: 'When debt interest exceeds expected after-tax investment returns, paying it down first is a common approach.', route: 'money' },
  estate:     { what: 'Whether your wealth transfers efficiently — IHT exposure, nominations, and Will.', lift: 'Up-to-date beneficiary nominations and a current Will are estate-planning basics; trust structures are one option some people consider.', route: 'tax' },
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
            <button onClick={() => { onClose(); onNav(route) }} className="sw-press" style={{ flex: 1, padding: '9px 14px', borderRadius: 100, background: 'var(--c-acc)', border: 'none', color: 'var(--c-on-accent, #0B1F3A)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
  drawdown:           { label: 'SIPP estate exposure',           screen: 'tax',   action: 'From April 2027 pensions count toward the estate, so an up-to-date expression of wishes and beneficiary nominations matter — the choices made before then affect the IHT position while gifting windows remain open.' },
  wrapperSequencing:  { label: 'Wrapper sequencing (ISA/SIPP)', screen: 'tax',   action: 'Drawing ISA before pension is a common retirement sequence — it preserves pension growth and keeps the pot outside the estate for longer.' },
  contributions:      { label: 'Pension contributions',         screen: 'money', action: 'Pension contributions reduce income tax now and grow the pot tax-free.' },
  taxAllowances:      { label: 'Unused tax allowances',         screen: 'tax',   action: 'ISA, CGT and dividend allowances reset on 5 April each year — unused, they are lost.' },
  estatePlanning:     { label: 'Estate planning gap',           screen: 'tax',   action: 'A current Will, lasting power of attorney and beneficiary nominations are estate-planning basics; IHT exposure and gifting allowances are the usual things to review.' },
  protection:         { label: 'Protection coverage gap',       screen: 'risk',  action: 'Life cover, income protection and critical illness are typically weighed against current income and dependant obligations.' },
  debt:               { label: 'High-cost debt',                screen: 'money', action: 'Debt costing more than your expected after-tax investment return is, in effect, a guaranteed risk-free return when paid down.' },
  gifting:            { label: 'Gifting opportunity',           screen: 'tax',   action: 'The annual gift exemption is £3,000/yr free of IHT (one prior year can be carried forward); it does not accumulate beyond that.' },
  propertyDecisions:  { label: 'Property decisions',            screen: 'money', action: 'Rental yield, CGT on disposal and how property fits the wider plan are the usual factors weighed here.' },
  investmentStrategy: { label: 'Investment strategy',           screen: 'money', action: 'Asset allocation, wrapper efficiency and rebalancing are typically reviewed against risk profile and timeline.' },
}

const COI_SCREEN_LABELS = { tax: 'Tax & Estate', money: 'MyMoney', risk: 'Risk' }

function CoIDrillPanel({ entity, onClose, onNav }) {
  const coiObj   = useMemo(() => safe(() => totalCoI(entity), { total: 0, byDomain: {} }), [entity])
  const total    = coiObj.total || 0
  const byDomain = coiObj.byDomain || {}
  const [openRow, setOpenRow] = useState(null)

  const rows = Object.entries(COI_DOMAIN_META)
    .map(([key, meta]) => ({ key, ...meta, value: Math.round(byDomain[key] || 0) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, overflowY: 'auto',
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
            {rows.map((row, i) => {
              const isOpen = openRow === row.key
              return (
                <div key={row.key} style={{ borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none' }}>
                  <div
                    onClick={() => setOpenRow(isOpen ? null : row.key)}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpenRow(isOpen ? null : row.key) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--c-text2)', flex: 1, marginRight: 8 }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-danger)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginRight: 8 }}>
                      {fmt(row.value)}/yr
                    </span>
                    <span style={{ color: 'var(--c-text3)', fontSize: 13, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>›</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 0 12px', marginTop: -4 }}>
                      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 10 }}>
                        {row.action}
                      </div>
                      <button
                        onClick={() => { onNav?.(row.screen); onClose() }}
                        style={{
                          fontSize: 12, fontWeight: 700, padding: '7px 14px',
                          borderRadius: 100, border: 'none', cursor: 'pointer',
                          background: 'var(--c-acc)', color: 'var(--c-bg)',
                          fontFamily: 'inherit',
                        }}
                      >
                        Go to {COI_SCREEN_LABELS[row.screen] || row.screen} →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
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

function APQDrillPanel({ entity, onNav, onClose }) {
  const apq = safe(() => calcAPQ(entity), [])
  const items = Array.isArray(apq) ? apq : []

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, overflowY: 'auto',
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
            const route  = ACTION_ROUTE_OVERRIDE[action.id] || action.screen || null
            const impact = action?.impact?.finioScore || action?.impact?.score || 0
            const canNav = route || action.id === 'pension-drawdown'
            return (
              <div
                key={action.id || i}
                onClick={() => {
                  if (!canNav) return
                  if (action.id === 'pension-drawdown') { onClose(); onNav?.('money'); return }
                  onClose(); onNav?.(route)
                }}
                style={{
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                  cursor: canNav ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}
              >
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
                      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(93,219,194,0.12)', border: '1px solid rgba(93,219,194,0.25)',
                      fontSize: 10, fontWeight: 700, color: 'var(--c-acc)',
                    }}>
                      +{impact} Wealth Score
                    </span>
                  )}
                </div>
                {canNav && (
                  <span style={{ color: 'var(--c-text3)', fontSize: 18, flexShrink: 0, alignSelf: 'center' }}>›</span>
                )}
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

function NetWorthDrillPanel({ entity, onClose, focusAsset }) {
  const nw     = safe(() => netWorth(entity), 0)
  const inv    = safe(() => investable(entity), 0)
  const lb     = safe(() => liquidityBuffer(entity), null)
  const a      = entity?.assets || {}
  const [expandedRow, setExpandedRow] = useState(focusAsset || null)

  // Universal numeric extractor — handles flat number, object.total, object.value, array-of-pots
  const _num = v => {
    if (!v && v !== 0) return 0
    if (typeof v === 'number') return v
    if (Array.isArray(v)) return v.reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0)
    return +v?.total || +v?.value || 0
  }

  const pensions  = safe(() => _num(a.sipp) + _num(a.pension) + _num(a.pensions), 0)
  const isa       = safe(() => _num(a.isa) + _num(a.lisa), 0)
  // Property: check all known field names (property[], residence, home)
  const property  = safe(() => {
    const arr = (Array.isArray(a.property) ? a.property : []).reduce((s, p) => s + (+p.estimatedValue || +p.value || 0), 0)
    return arr + _num(a.residence) + _num(a.home)
  }, 0)
  // Portfolio: check holdings array OR direct .value
  const portfolio = safe(() => {
    const h = a.portfolio?.holdings || a.holdings || []
    const fromHoldings = h.reduce((s, hh) => s + (+hh.currentValue || +hh.value || 0), 0)
    return fromHoldings > 0 ? fromHoldings : (_num(a.portfolio) + _num(a.investments) + _num(a.gias))
  }, 0)
  const business  = safe(() => (Array.isArray(a.business_assets) ? a.business_assets : []).reduce((s, b) => s + (+b.currentValue || +b.value || 0), 0), 0)
  // Cash: must use _num, not +a.cash (would NaN on an object)
  const cash      = safe(() => _num(a.cash) + _num(a.savings) + _num(a.cashSavings) + _num(a.bank), 0)
  const altAssets = safe(() => (Array.isArray(a.alternatives) ? a.alternatives : []).reduce((s, x) => s + (+x.currentValue || +x.value || 0), 0), 0)

  // P0-2: delegate to the engine's canonical liabilitiesTotal walker so
  // every screen agrees on the same number. The inline reader that lived
  // here only knew `l.mortgage` / `l.loans` keys and silently dropped
  // Bruce's £180k BTL mortgage (stored under `l.otherLoans[]`).
  const liabilities = safe(() => engineLiabilitiesTotal(entity), 0)

  const totalAssets = pensions + isa + property + portfolio + business + cash + altAssets

  // Individual pension pots (for drill-down)
  const pensionPots = safe(() => {
    const pots = a.sipp?.pensions || a.pensions || a.pension?.pots || []
    if (Array.isArray(pots)) return pots
    return []
  }, [])

  // Per-pot projected trend-lines + review count — reveals that the pension
  // aggregate is N pots, not one. 20y illustrative horizon (projected, not
  // past performance). Spec 2026-05-31 §3 L1.
  const _pensionCma = safe(() => getActiveCMA(), {})
  const pensionSeries = safe(() => pensionPots.map(p =>
    projectSeries(+p.value || 0, growthRateFor(classifyPot(p) === 'self-invested' ? 'pension-sipp' : 'pension-occupational-dc', _pensionCma), 20)), [])
  const pensionsNeedReview = safe(() => potsNeedingReview(pensionPots).length, 0)

  // Property details (for drill-down)
  const propertyList = safe(() => {
    const arr = Array.isArray(a.property) ? a.property : []
    const res = a.residence ? [{ name: a.residence.address || 'Primary residence', value: _num(a.residence), type: 'Residential' }] : []
    return [...arr.map(p => ({ name: p.address || p.name || 'Property', value: +p.estimatedValue || +p.value || 0, type: p.type || 'Property' })), ...res]
  }, [])

  const rows = [
    { label: 'Pensions', key: 'pensions', value: pensions, colour: 'var(--c-acc2)', detail: pensionPots.map(p => ({ name: p.name, value: p.value, sub: `${p.provider || ''}${p.type ? ' · ' + p.type : ''}`, meta: p.nominationDate ? `Nomination: ${p.nominationDate}` : null, charge: p.charge ? `${(p.charge * 100).toFixed(2)}% p.a. charges` : null })) },
    { label: 'ISA', key: 'isa', value: isa, colour: 'var(--c-acc)', detail: a.isa ? [{ name: 'Stocks & Shares ISA', value: _num(a.isa), sub: a.isa.provider || 'ISA wrapper', meta: null }] : [] },
    { label: 'Property', key: 'property', value: property, colour: 'var(--c-gold)', detail: propertyList },
    { label: 'Investments', key: 'portfolio', value: portfolio, colour: 'var(--c-success)', detail: a.portfolio ? [{ name: 'Investment portfolio', value: _num(a.portfolio), sub: `${((a.portfolio.ret || 0) * 100).toFixed(1)}% historical return`, meta: null }] : [] },
    { label: 'Business', key: 'business', value: business, colour: 'var(--c-warning)', detail: [] },
    { label: 'Cash & savings', key: 'cash', value: cash, colour: 'var(--c-text2)', detail: a.cash ? [{ name: 'Cash & savings', value: _num(a.cash), sub: a.cash.rate ? `${((a.cash.rate || 0) * 100).toFixed(1)}% interest rate` : 'Cash', meta: null }] : [] },
    { label: 'Alternatives', key: 'alternatives', value: altAssets, colour: 'var(--c-text3)', detail: [] },
  ].filter(r => r.value > 0)

  return (
    <div
      className="screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, overflowY: 'auto',
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
        <button onClick={onClose} className="sw-press" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-acc)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          Net Worth breakdown
        </div>
        <div style={{ width: 56 }} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 18, padding: '14px 18px', marginBottom: 12 }}>
          <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Total net worth</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: nw >= 0 ? 'var(--c-text)' : 'var(--c-danger)' }}>{fmt(nw)}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text3)', marginTop: 4 }}>Assets {fmt(totalAssets)} · Liabilities {fmt(liabilities)}</div>
          <span className="sw-chip sw-chip-sm" style={{ marginTop: 8, display: 'inline-block' }}>From your data</span>
        </div>

        {/* Asset rows — each expandable to show individual holdings */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 18, padding: '14px 18px', marginBottom: 12 }}>
          <div className="sw-eyebrow" style={{ marginBottom: 12 }}>Assets — tap any row for details</div>
          {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--c-text3)', fontStyle: 'italic' }}>No asset data yet.</div>}
          {rows.map(({ label, key, value, colour, detail }) => {
            const pctOfAssets = totalAssets > 0 ? (value / totalAssets) * 100 : 0
            const isOpen = expandedRow === key
            const hasDetail = detail && detail.length > 0
            return (
              <div key={label} style={{ borderTop: rows.indexOf(rows.find(r => r.key === key)) > 0 ? '1px solid var(--c-sep)' : 'none', paddingTop: rows.indexOf(rows.find(r => r.key === key)) > 0 ? 10 : 0, marginBottom: 10 }}>
                <div
                  onClick={() => hasDetail && setExpandedRow(isOpen ? null : key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, cursor: hasDetail ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: colour, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--c-text2)', fontWeight: 600 }}>{label}</span>
                    {hasDetail && <span style={{ fontSize: 10, color: 'var(--c-text3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'inline-block' }}>›</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 2 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${Math.max(0, Math.min(100, pctOfAssets))}%`, background: colour, transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
                    {pctOfAssets.toFixed(0)}% of assets
                    {key === 'pensions' && pensionPots.length > 0 && (
                      <span> · across {pensionPots.length} pension{pensionPots.length !== 1 ? 's' : ''}{pensionsNeedReview ? ` · ${pensionsNeedReview} need review` : ''}</span>
                    )}
                  </div>
                  {key === 'pensions' && pensionSeries.length > 0 && (
                    <MiniTrendLines series={pensionSeries} width={72} height={20} />
                  )}
                </div>
                {isOpen && hasDetail && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-sep)' }}>
                    {detail.map((item, di) => (
                      <div key={di} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderTop: di > 0 ? '1px solid var(--c-sep)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{item.name}</div>
                          {item.sub && <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>{item.sub}</div>}
                          {item.meta && <div style={{ fontSize: 10, color: 'var(--c-acc)', marginTop: 2 }}>{item.meta}</div>}
                          {item.charge && <div style={{ fontSize: 10, color: 'var(--c-warning)', marginTop: 2 }}>{item.charge}</div>}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: colour, fontVariantNumeric: 'tabular-nums', marginLeft: 12, flexShrink: 0 }}>{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* How quickly can I access my money? */}
        {inv > 0 && (
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-sep)', borderRadius: 18, padding: '14px 18px', marginBottom: 12 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>How quickly can I access my money?</div>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 12 }}>
              Liquid wealth = cash, ISA, and other accessible funds you could use within days. Illiquid = property and business assets that can take months or years to sell.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--c-text2)', fontWeight: 600 }}>Accessible now</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>Cash, ISA, liquid investments</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(inv)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: lb?.months ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--c-text2)', fontWeight: 600 }}>Tied up</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>Property, business — takes time to sell</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.max(0, totalAssets - inv))}</span>
            </div>
            {lb?.months != null && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(93,219,194,0.08)', borderRadius: 10, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                Your accessible cash covers <strong style={{ color: 'var(--c-acc)' }}>{lb.months.toFixed(1)} months</strong> of essential living costs — aim for 3–6 months minimum.
              </div>
            )}
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

// Build stamp — updates on every HMR reload so both dev + founder can
// verify which version is live without guessing.
const BUILD = (() => {
  const d = new Date()
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
})()

// ─────────────────────────────────────────────────────────────────────────────
// P13-2 (2026-05-28, IFA must-fix #2): DeficitBanner
// Renders only when monthlySurplus(entity) is negative. Leads with the £/mo
// shortfall, the £/yr cost, and two prominent CTAs (cashflow drill + income).
// For Mr T at -£552/mo this is the most important number on the dashboard
// and was previously buried inside the Cashflow tab.
// ─────────────────────────────────────────────────────────────────────────────
function DeficitBanner({ entity, onNav }) {
  const ms = (() => {
    try { return monthlySurplus(entity) } catch { return null }
  })()
  if (!ms) return null
  const surplus = +ms.surplus || 0
  const deficit = +ms.deficit || 0
  const monthly = surplus < 0 ? -surplus : (deficit > 0 ? deficit : 0)
  if (monthly <= 0) return null  // not in deficit — render nothing
  const annual = monthly * 12
  return (
    <div role="region" aria-label="Cashflow deficit alert" style={{
      margin: '0 16px 14px',
      padding: '14px 16px',
      background: 'var(--c-tint-coral)',
      border: '1px solid var(--c-coral-text)',
      borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--c-coral-text)', marginBottom: 4 }}>
            Monthly shortfall
          </div>
          <div data-tieout="home.monthly-deficit" data-tieout-raw={String(monthly)} style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-coral-text)', letterSpacing: -0.6, lineHeight: 1 }}>
            −{fmt(monthly)}/mo
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.4 }}>
            That's <strong>{fmt(annual)}/year</strong> coming out of savings or going onto credit.
            Fixing this is priority one — the other scores wait.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onNav?.('flow')}
          aria-label="Open Cashflow to investigate the shortfall"
          style={{
            padding: '12px 16px', minHeight: 44, borderRadius: 100,
            background: 'var(--c-coral-text)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center',
          }}
        >See where it's going →</button>
        <button
          type="button"
          onClick={() => onNav?.('money/income')}
          aria-label="Open Income statement"
          style={{
            padding: '12px 16px', minHeight: 44, borderRadius: 100,
            background: 'transparent', color: 'var(--c-coral-text)',
            border: '1px solid var(--c-coral-text)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center',
          }}
        >Income statement →</button>
      </div>
    </div>
  )
}

export default function HomeScreen({
  entity,
  viewMode: _viewModeProp,  // eslint-disable-line no-unused-vars — ignored; local state owns this
  personaId,                // eslint-disable-line no-unused-vars
  onNav,
  onCommit,                 // eslint-disable-line no-unused-vars
  onAskAI,                  // eslint-disable-line no-unused-vars
  onOpenBreakdown,          // FQBreakdown overlay (used by Score Drillable)
  onDrillMetric,            // PP-3 — push detail frame onto Dashboard's stack
  onShowMagic,              // Demo-day WOW showcase overlay
}) {
  // ── viewMode now reads the SHARED temporal mode (#18) so Today/Future/Plan/
  // What-if is consistent across every tab, not just this screen. ──────────
  const { mode: viewMode, setMode: setViewMode } = useTemporalMode()

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
    if (typeof metric === 'string' && metric.startsWith('nav:')) { onNav?.(metric.slice(4)); return }
    if (metric === 'netWorth' || metric === 'networth') { setLocalDrill('networth:'); return }
    if (typeof metric === 'string' && metric.startsWith('netWorth:')) { setLocalDrill('networth:' + metric.split(':')[1]); return }
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
      {localDrill?.startsWith('networth') && <NetWorthDrillPanel entity={entity} focusAsset={localDrill.split(':')[1] || null} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'coi'     && <CoIDrillPanel       entity={entity} onNav={onNav} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'apq'     && <APQDrillPanel entity={entity} onNav={onNav} onClose={() => setLocalDrill(null)} />}
      {localDrill === 'pension-drawdown' && (
        <PensionDrawdownPanel entity={entity} onClose={() => setLocalDrill(null)} onNav={onNav} />
      )}
      {stubMetric && <DimExplainerStub metric={stubMetric} fqData={fq} onNav={onNav} onClose={() => setStubMetric(null)} />}

      {/* ── Ask Sonu — primary entry point, top of page ────────────────── */}
      {onShowMagic && (
        <div style={{ padding: '12px 16px 4px' }} data-testid="ask-sonu-cta">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShowMagic() }}
            style={{
              width: '100%',
              padding: '18px 18px', borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(93,219,194,0.22) 0%, rgba(175,82,222,0.18) 100%)',
              border: '1.5px solid var(--c-acc)',
              color: 'var(--c-text)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 4px 16px rgba(93,219,194,0.18)',
              transition: 'transform .15s ease, box-shadow .15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(93,219,194,0.28)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = '0 4px 16px rgba(93,219,194,0.18)' }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>✨</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.2, marginBottom: 3 }}>
                Ask Sonu anything
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.4 }}>
                One clear answer + the path to get there · powered by 11 specialist lenses
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--c-acc)', fontWeight: 700 }}>›</span>
          </button>
        </div>
      )}

      {/* ── Masthead (Task 2: avatar + mode pill) ─────────────────────── */}
      <MastheadCard entity={entity} viewMode={viewMode} onModeChange={setViewMode} />

      {/* P13-2 (2026-05-28, IFA must-fix #2): deficit-led hero.
          When monthlySurplus is negative, the dashboard now leads with
          the deficit headline instead of letting FQ-score lull a user
          who's losing money each month. Renders nothing when surplus ≥ 0. */}
      <DeficitBanner entity={entity} onNav={onNav} />

      {/* ── Anchor row (inline AnchorRow component defined above) ─────── */}
      <AnchorRow
        nw={nw}
        fqData={fq}
        riskData={risk}
        entity={entity}
        onDrillMetric={drillFn}
        onOpenBreakdown={onOpenBreakdown}
      />

      {/* ── §Z10 SIPP-IHT countdown (regulatory: Finance Act 2026) ──── */}
      <SippIhtCountdown entity={entity} onNav={onNav} />

      {/* ── 2-column content grid — radar first on mobile, tiles follow ── */}
      <div className="sw-content-grid">
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

      {/* ── Zone 4: State Tiles — after radar on mobile, before on desktop via CSS ── */}
      <div className="sw-tiles-section">
        <StateTilesCard entity={entity} onNav={onNav} onDrillDim={drillFn} />
      </div>

      {/* ── FUTURE / PLAN placeholder banner ────────────────────────── */}
      {(viewMode === 'forecast' || viewMode === 'plan') && (
        <div style={{
          margin: '4px 16px 0', padding: '12px 16px',
          background: 'var(--c-surface)', border: '1px dashed var(--c-sep)', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text2)' }}>
              Headline figures still show today
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              {viewMode === 'forecast'
                ? 'The radar shows your projected shape; full figure projection is coming — see Timeline.'
                : 'Plan detail is coming — see Timeline for projections available now.'}
            </div>
          </div>
          <button
            onClick={() => onNav?.('timeline')}
            style={{ background: 'none', border: '1px solid var(--c-acc)', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--c-acc)', padding: '5px 10px', borderRadius: 8, fontFamily: 'inherit', flexShrink: 0 }}
          >
            Timeline →
          </button>
        </div>
      )}

      {/* ── Card 5: Plan progress strip ───────────────────────────────── */}
      <PlanProgressStrip entity={entity} onNav={onNav} />

      {/* ── FCA footer ────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--c-text3)',
        padding: '14px 24px 8px', lineHeight: 1.6,
      }}>
        Information and guidance only · Not personal advice · FCA boundary applies
      </div>

      {/* Nav spacer — 78px bottom nav + 52px AskPill + 8px gap + 12px breathing room */}
      <div style={{ height: 150 }} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   WhatIfSection — 5 scenario rows + freeform input
   Used inside ActionsCard at the bottom of the right column.
   ═══════════════════════════════════════════════════════════════════════ */

function WhatIfSection({ viewMode, onSelectScenario, onFreeform, entity }) {
  const [freeform, setFreeform] = useState('')
  const [showAll, setShowAll]   = useState(false)
  const isActive = viewMode === 'scenario'
  // P1-22 (2026-05-28): prefer user's saved scenarios over canned list.
  // Each live persona has 3-4 scenarios in entity.scenarios — show those
  // first, fall back to DE_SCENARIOS canned list when none exist.
  const userScenarios = Array.isArray(entity?.scenarios) ? entity.scenarios : []
  const scenarios = userScenarios.length > 0
    ? [
        ...userScenarios.map(s => ({
          key: s.id || s.key || s.name,
          label: s.name || s.label || 'Scenario',
          sub: s.summary || s.description || s.note || 'Your saved scenario',
          icon: s.icon || '⚙',
          tag: 'YOURS',
          engine: !!s.engine_backed,
        })),
        ...DE_SCENARIOS,
      ]
    : DE_SCENARIOS
  const visible  = showAll ? scenarios : scenarios.slice(0, 5)

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
                            border: 'none', color: 'var(--c-on-accent, #0B1F3A)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
            entity={entity}
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



