/* ═══════════════════════════════════════════════════════════════════════════
   SONUSWEALTH — HOME SCREEN  v2.0  (spec: 2-Product-home-v1_4.md)
   ─────────────────────────────────────────────────────────────────────────
   Authority chain : Foundation v1.11 · Skill v1.4 · Tracker v5.75
   Brand           : Sonuswealth (D-NAME-2). Score names per BRAND.
   Engine          : src/engine/fq-calculator.js  (canonical)
   Components      : src/components/shared/*       (X28, X29, Reveal, etc.)
   ─────────────────────────────────────────────────────────────────────────
   v2.0 6-card layout (prototype: app-prototype/01-sonuswealth.html):
     Card 1  — Masthead (greeting + name + date + mode pill)
     Card 2  — Anchor row (NW · Wealth Score · Risk)
     Card 3  — Radar card (RadarAnchor + plain-English brief)
     Card 4  — Priority Action (top-1 from calcAPQ)
     Card 5  — Plan progress (planFor 'wealth')
     Card 6  — Active Insights (actions 2–4 from calcAPQ)
     Footer  — FCA disclaimer line

   Zones cut from v1 (deprecated or moved to other tabs):
     Z0 Score Orientation · X25 statement · Z2 Daily Delta · Z3 CoIOdometer
     Z4 State Tiles · Z5 Score Journey · Z6 Reality Engine
     PlanStalenessBanner · Z9 What's New · Z10 Tax Deadline
     Z14 Drive-to-Update · Z15 Milestone Pin
   ═══════════════════════════════════════════════════════════════════════ */

import { useMemo } from 'react'
import {
  // Core
  calcFQ, calcRisk, calcAPQ, netWorth, fmt, daysLeft, TAX,
  // CoI canonical
  totalCoI, costOfInaction,
  // State tiles (canonical 0–100 fns)
  fiRatio, debtRatio, protectionScore, cashflowHealth,
  estateReadiness, taxEfficiency,
  // Trajectories + history
  scoreTrajectory, riskTrajectory, netWorthHistory,
  calcScoreHistory, calcRiskHistory,
  // Plans + staleness
  planFor, planStaleness,
  // Diffs (X29)
  diffSet,
  // Milestones (re-export of timeline-engine.calcMilestones)
  calcMilestones,
} from '../engine/fq-calculator.js'
import {
  X28TopBar,
  ExplainerChip,
  CoIOdometer,
  PlanStalenessBanner,
  RevealCard,
  DiffBadge, DeltaChip, CausalityStripe, DiffPulse,
  FadeInOnMount, RevealStagger, DrawSVG, Num,
} from '../components/shared'
import Drillable from '../components/shared/Drillable.jsx'
import { BRAND } from '../config/brand.js'
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

/* ─── Route override map (unchanged from v1 — engine mis-routes these)
   Engine's calcAPQ() returns each action with a `screen` field. Several are
   mis-routed (CGT → money but should be → tax; life-in-trust → money but is
   estate-tax; nominations → money but is estate). Override here at UI level
   so we don't have to touch the frozen engine. */
const ACTION_ROUTE_OVERRIDE = {
  'cgt-bedisa':                'tax',
  'life-in-trust':             'tax',
  'update-pension-nominations':'tax',
  'fallback-iht':              'tax',
}
function safeRoute(action) {
  if (!action) return null
  return ACTION_ROUTE_OVERRIDE[action.id] || action.screen || null
}

/** Rank justification eyebrow — preserved from v1 */
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

/* ═══════════════════════════════════════════════════════════════════════════
   §Z0 — Score Orientation Layer  (cut in v2.0 simplification)
   Preserved as a component definition for revival if founder asks.
   Not rendered in v2.0 — replaced by always-visible masthead + anchor row.
   ═══════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
function ScoreOrientation({ onDismiss }) {
  return null  // Cut in v2.0 — see commit: home: rebuild Home tab to 6-card v2.0 layout
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 1 — Masthead
   greeting · name · date · mode pill (top-right)
   ═══════════════════════════════════════════════════════════════════════ */

function MastheadCard({ entity, viewMode }) {
  const firstName = entity?.individual?.name?.split(' ')[0]
    || entity?.name?.split(' ')[0]
    || 'there'
  const modeLabel = MODE_LABEL[viewMode] || 'Today'

  return (
    <div style={card()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{
            fontSize: 13, color: 'var(--c-text3)', marginBottom: 2,
          }}>
            {greeting()},
          </div>
          <div style={{
            fontSize: 20, fontWeight: 700, color: 'var(--c-text)',
            letterSpacing: -0.4, lineHeight: 1.2,
          }}>
            {firstName} · {fmtHomeDate()}
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          padding: '4px 12px',
          borderRadius: 100,
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7,
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-sep)',
          color: 'var(--c-acc)',
        }}>
          {modeLabel}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 2 — Anchor row
   Net worth · Wealth Score · Risk  (3-up responsive row)
   ═══════════════════════════════════════════════════════════════════════ */

function AnchorRow({ nw, fqData, riskData, diffs }) {
  const score = fqData?.total ?? fqData?.score ?? 0

  // Risk: calcRisk returns { total: 0–100, band: { name, colour } }
  const riskScore = riskData?.total ?? 0
  const riskBandName = riskData?.band?.name || riskData?.band || '—'
  // Colour by band name: Exposed/Vulnerable → coral, Managed → gold, Protected/Resilient → accent
  const riskColor = ['Exposed', 'Vulnerable'].includes(riskBandName)
    ? 'var(--c-acc3)'
    : riskBandName === 'Managed'
    ? 'var(--c-gold)'
    : 'var(--c-acc)'

  // NW weekly delta from diffs
  const nwDiff = (diffs || []).find(d => d?.key === 'netWorth' || d?.dim === 'netWorth')
  const nwDelta = nwDiff?.delta ?? null

  return (
    <div style={card({ padding: '14px 18px' })}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 0,
      }}>
        {/* Net worth */}
        <div style={{ borderRight: '1px solid var(--c-sep)', paddingRight: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4,
          }}>Net worth</div>
          <Drillable metric="netWorth" onOpen={() => {}} inline>
            <span style={{
              fontSize: 18, fontWeight: 700, color: 'var(--c-text)',
              letterSpacing: -0.3,
            }}>
              {fmt(nw)}
            </span>
          </Drillable>
          {nwDelta !== null && (
            <div style={{
              fontSize: 11, color: nwDelta >= 0 ? 'var(--c-gold)' : 'var(--c-acc3)',
              marginTop: 2,
            }}>
              {nwDelta >= 0 ? '↑' : '↓'} {fmt(Math.abs(nwDelta))} · 7d
            </div>
          )}
        </div>

        {/* Wealth Score */}
        <div style={{ borderRight: '1px solid var(--c-sep)', padding: '0 14px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4,
          }}>Score</div>
          <Drillable metric="wealthScore" onOpen={() => {}} inline>
            <span style={{
              fontSize: 18, fontWeight: 700, color: 'var(--c-acc)',
              letterSpacing: -0.3,
            }}>
              {score}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>/100</span>
            </span>
          </Drillable>
        </div>

        {/* Risk */}
        <div style={{ paddingLeft: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 4,
          }}>Risk</div>
          <Drillable metric="risk" onOpen={() => {}} inline>
            <span style={{
              fontSize: 18, fontWeight: 700, color: riskColor,
              letterSpacing: -0.3,
            }}>
              {riskScore}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>/100</span>
            </span>
          </Drillable>
          <div style={{
            fontSize: 10, color: riskColor, marginTop: 2,
            fontWeight: 600, letterSpacing: 0.2,
          }}>
            {riskBandName}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 3 — Radar card
   Wraps RadarAnchor unchanged + a plain-English brief below
   ═══════════════════════════════════════════════════════════════════════ */

function RadarCard({ entity, fqData, nw, viewMode, diffs, onDrillMetric }) {
  // Find lowest dim by frac-of-max
  const dims = fqData?.dims || {}
  const lowestDim = useMemo(() => {
    let low = null
    let lowFrac = Infinity
    for (const d of DIMENSIONS) {
      const score = dims[d.key] ?? 0
      const frac = score / d.max
      if (frac < lowFrac) { lowFrac = frac; low = d }
    }
    return low
  }, [dims])

  // Tax shelter percentage: ISA + SIPP/pension as % of NW
  // Handles both flat (number) and object ({value}) asset shapes
  const taxShelter = useMemo(() => {
    const assets = entity?.assets || {}
    const num = v => (typeof v === 'number' ? v : (v?.value ?? v?.total ?? 0))
    const sheltered = num(assets.isa) + num(assets.lisa) + num(assets.sipp) + num(assets.pension)
    return nw > 0 ? Math.round((sheltered / nw) * 100) : 0
  }, [entity, nw])

  const brief = useMemo(() => {
    const nwStr = fmt(nw)
    const dimName = lowestDim?.label || 'one dimension'
    return `You hold ${nwStr} across pensions, ISAs, and the home. ${taxShelter}% of that is in tax shelters. ${dimName} is the chart point that wants attention — one review would lift it 5–7 points.`
  }, [nw, lowestDim, taxShelter])

  return (
    <Drillable metric="radar" onOpen={onDrillMetric} inline={false}>
      <div style={card({ padding: '16px 18px 14px' })}>
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 2,
            }}>Your wealth shape</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
              7 dimensions · drag to test what-if
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--c-text3)' }}>›</span>
        </div>

        {/* Radar polygon — untouched, props passed through */}
        <RadarAnchor
          entity={entity}
          fqData={fqData}
          viewMode={viewMode}
          diffs={diffs}
          onDrillMetric={onDrillMetric}
        />

        {/* Plain-English brief */}
        <p style={{
          fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
          marginTop: 14, marginBottom: 0,
        }}>
          {brief}
        </p>
      </div>
    </Drillable>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 4 — Priority Action
   Top-1 action from calcAPQ · gold pre-pill · CTA
   ═══════════════════════════════════════════════════════════════════════ */

function PriorityActionCard({ entity, onNav }) {
  const apq = useMemo(() => safe(() => calcAPQ(entity), []), [entity])
  const top = Array.isArray(apq) ? apq[0] : null
  if (!top) return null

  const route  = safeRoute(top)
  const reason = rankReasonFor(top, 1)

  return (
    <div
      style={card({
        background: 'linear-gradient(180deg, rgba(255,189,89,0.08), var(--c-surface))',
        borderColor: 'rgba(255,189,89,0.25)',
        cursor: route ? 'pointer' : 'default',
      })}
      onClick={() => route && onNav?.(route)}
      role={route ? 'button' : undefined}
      tabIndex={route ? 0 : undefined}
      onKeyDown={e => { if (route && (e.key === 'Enter' || e.key === ' ')) onNav?.(route) }}
    >
      {/* Gold pre-pill */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: 100,
          background: 'rgba(255,189,89,0.18)',
          border: '1px solid rgba(255,189,89,0.35)',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 0.7, color: 'var(--c-gold)',
        }}>
          {reason || 'This month · 1 thing'}
        </span>
      </div>

      {/* Headline */}
      <div style={{
        fontSize: 16, fontWeight: 700, color: 'var(--c-text)',
        letterSpacing: -0.2, lineHeight: 1.3, marginBottom: 8,
      }}>
        {top.title || top.headline || '—'}
      </div>

      {/* Why paragraph */}
      <p style={{
        fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55,
        margin: '0 0 14px',
      }}>
        {top.context || top.detail || top.why || 'Review this action for your situation.'}
      </p>

      {/* CTA */}
      <button
        className="sw-press"
        onClick={e => { e.stopPropagation(); route && onNav?.(route) }}
        style={{
          padding: '10px 20px',
          borderRadius: 100,
          background: 'var(--c-acc)',
          border: 'none',
          color: 'var(--c-bg)',
          fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: 0.2,
        }}
      >
        {top.cta || 'Show me how →'}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 5 — Plan progress
   planFor(entity, 'wealth') · progress bar · On course / Behind plan
   ═══════════════════════════════════════════════════════════════════════ */

function PlanProgressCard({ entity, onNav }) {
  const plan = useMemo(() => safe(() => planFor(entity, 'wealth'), null), [entity])

  if (!plan) {
    return (
      <div
        style={card({ cursor: 'pointer' })}
        onClick={() => onNav?.('plan')}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onNav?.('plan') }}
      >
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 6,
        }}>Plan progress</div>
        <div style={{
          fontSize: 14, color: 'var(--c-text2)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>No active plan — set one in Plan tab →</span>
          <span style={{ color: 'var(--c-text3)', fontSize: 16 }}>›</span>
        </div>
      </div>
    )
  }

  // Extract values — handle both legacy (bare numbers) and new (object) shapes
  const target   = typeof plan.target === 'number' ? plan.target
    : plan.target?.netWorth || plan.target?.value || plan.targetValue || 0
  const current  = plan.progress?.current ?? plan.current ?? 0
  const pct      = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  const onTrack  = plan.progress?.onTrack ?? plan.onTrack ?? true
  const horizon  = plan.horizonDate || plan.target?.date || plan.progress?.horizonDate || null
  const planName = plan.name || plan.goal || 'Wealth plan'

  const trackColor = onTrack ? 'var(--c-acc)' : 'var(--c-acc3)'
  const trackLabel = onTrack ? 'On course' : 'Behind plan'

  return (
    <div style={card()}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 0.8, color: 'var(--c-text3)', marginBottom: 3,
          }}>Plan progress</div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.2,
          }}>
            {planName}
            {target > 0 && ` · ${fmt(target)} target`}
          </div>
        </div>
        {horizon && (
          <span style={{
            fontSize: 12, color: 'var(--c-text3)', flexShrink: 0, marginTop: 2,
          }}>
            {fmtDate(horizon)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, background: 'var(--c-surface2)',
        borderRadius: 100, marginBottom: 10, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'var(--c-acc)', borderRadius: 100,
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Meta row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: 'var(--c-text2)' }}>
          <strong style={{ color: 'var(--c-text)' }}>{pct}%</strong>
          {target > 0 && (
            <span style={{ color: 'var(--c-text3)', marginLeft: 4 }}>
              · {fmt(current)} of {fmt(target)}
            </span>
          )}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: trackColor,
        }}>
          {trackLabel}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card 6 — Active Insights
   Actions ranked 2–4 from calcAPQ · badge severity · See all link
   ═══════════════════════════════════════════════════════════════════════ */

// Badge severity mapping: critical → High, high → Med, info/low → Watch
function severityBadge(action) {
  const p = action?.priority ?? 3
  if (p === 1) return { label: 'High', bg: 'rgba(255,111,125,0.15)', color: 'var(--c-acc3)' }
  if (p === 2) return { label: 'Med',  bg: 'rgba(255,189,89,0.15)',  color: 'var(--c-gold)' }
  return               { label: 'Watch', bg: 'rgba(93,219,194,0.12)', color: 'var(--c-acc)' }
}

function ActiveInsightsCard({ entity, onNav }) {
  const apq = useMemo(() => safe(() => calcAPQ(entity), []), [entity])
  // Insights are actions 2–4 (index 1–3), skipping top-1 which lives in Card 4
  const insights = Array.isArray(apq) ? apq.slice(1, 4) : []
  if (!insights.length) return null

  return (
    <div style={card({ padding: '14px 18px' })}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--c-text2)',
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>
          Active insights
        </span>
        <button
          className="sw-press"
          onClick={() => onNav?.('plan')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--c-acc)', fontWeight: 700, padding: 0,
          }}
        >
          See all {Array.isArray(apq) ? apq.length : 5} →
        </button>
      </div>

      {/* Insight rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {insights.map((action, i) => {
          const badge = severityBadge(action)
          const route = safeRoute(action)
          return (
            <div
              key={action.id || i}
              onClick={() => route && onNav?.(route)}
              role={route ? 'button' : undefined}
              tabIndex={route ? 0 : undefined}
              onKeyDown={e => { if (route && (e.key === 'Enter' || e.key === ' ')) onNav?.(route) }}
              className={route ? 'sw-press' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                cursor: route ? 'pointer' : 'default',
              }}
            >
              {/* Badge */}
              <span style={{
                flexShrink: 0,
                padding: '3px 8px',
                borderRadius: 6,
                background: badge.bg,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.5, color: badge.color,
                minWidth: 42, textAlign: 'center',
              }}>
                {badge.label}
              </span>

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--c-text)',
                  lineHeight: 1.3, marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {action.title || action.headline || '—'}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {action.detail || action.context || ''}
                </div>
              </div>

              {/* Chev */}
              {route && (
                <span style={{ fontSize: 16, color: 'var(--c-text3)', flexShrink: 0 }}>›</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════════ */

export default function HomeScreen({
  entity,
  viewMode = 'actual',
  personaId,            // eslint-disable-line no-unused-vars
  onNav,
  onCommit,             // eslint-disable-line no-unused-vars
  onAskAI,              // eslint-disable-line no-unused-vars
  onOpenBreakdown,      // eslint-disable-line no-unused-vars
  onDrillMetric,        // PP-3 — push detail frame onto Dashboard's stack
}) {
  // ── Core engine values ─────────────────────────────────────────────────
  const nw   = useMemo(() => safe(() => netWorth(entity), 0), [entity])
  const fq   = useMemo(() => safe(() => calcFQ(entity),
    { total: 0, score: 0, band: { name: 'Building', colour: 'var(--c-text3)' }, dims: {} }), [entity])
  const risk = useMemo(() => safe(() => calcRisk(entity),
    { total: 0, band: { name: 'Building', colour: 'var(--c-text3)' } }), [entity])

  // ── X29 diffs ──────────────────────────────────────────────────────────
  const diffs = useMemo(() => safe(() => diffSet(entity, null), []), [entity])

  return (
    <>
      {/* ── Card 1: Masthead ──────────────────────────────────────────── */}
      <MastheadCard entity={entity} viewMode={viewMode} />

      {/* ── Card 2: Anchor row ────────────────────────────────────────── */}
      <AnchorRow nw={nw} fqData={fq} riskData={risk} diffs={diffs} />

      {/* ── Card 3: Radar card ────────────────────────────────────────── */}
      <RadarCard
        entity={entity}
        fqData={fq}
        nw={nw}
        viewMode={viewMode}
        diffs={diffs}
        onDrillMetric={onDrillMetric}
      />

      {/* ── Card 4: Priority Action ───────────────────────────────────── */}
      <PriorityActionCard entity={entity} onNav={onNav} />

      {/* ── Card 5: Plan progress ─────────────────────────────────────── */}
      <PlanProgressCard entity={entity} onNav={onNav} />

      {/* ── Card 6: Active Insights ───────────────────────────────────── */}
      <ActiveInsightsCard entity={entity} onNav={onNav} />

      {/* ── FCA footer ────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--c-text3)',
        padding: '14px 24px 8px', lineHeight: 1.6,
      }}>
        Information &amp; guidance only · Not regulated financial advice · FCA boundary applies on every Ask response
      </div>

      {/* Nav spacer */}
      <div style={{ height: 78 }} />
    </>
  )
}

// Preserve for ESM consumers / unused-export lint suppression
export { ScoreOrientation }
