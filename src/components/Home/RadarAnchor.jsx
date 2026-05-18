/* ═══════════════════════════════════════════════════════════════════════════
   RadarAnchor — Home anchor + score dimensions + journey-to-target

   2026-05-12 (post audit, Phase 1 redesign):
     · Three-layer polygon: TARGET (dashed gold) + CURRENT (filled mint) + GAPS
       (coral marks on spokes where current falls materially below target).
     · Centre cap drops Risk — keeps NW + Wealth Score + band (founder
       direction: Risk is a sibling, has its own radar on Risk tab).
     · Four viewMode behaviours with plain-English labels:
        Today    = current vs target, gap marks visible, tap spoke to drill
        Future   = projected polygon (per-dim momentum projection) vs target
        Plan     = plan target overlay vs current, gap marks coral
        What if  = drag any spoke → ghost polygon → causal-story slide-over
                   (§13.1 from dynamic-crunching-wall — engine-generated, not
                    LLM — narrates the cascade of consequences for the action).
     · §13.6 What-If Cinema: polygon morphs smoothly between modes; gap marks
       reposition with their dims; 600ms ease-out-quart.
   ═══════════════════════════════════════════════════════════════════════ */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  netWorth, fmt, planFor, goalSeek,
} from '../../engine/fq-calculator.js'
import { DIMENSIONS } from '../../config/dimensions.js'
import {
  getWealthTarget, gapDims, projectDimsForward,
} from '../../config/wealth-targets.js'
import Drillable from '../shared/Drillable.jsx'
import { DeltaChip, DiffPulse } from '../shared'

/* ─── geometry ─────────────────────────────────────────────────────────── */
const SIZE     = 338
const CX       = SIZE / 2
const CY       = SIZE / 2
const MAX_R    = 128
const NODE_R   = 148
const MIN_FRAC = 0.06
const RINGS    = [0.27, 0.53, 0.8, 1.0]
const GAP_THRESHOLD = 0.15

function toRad(deg) { return deg * Math.PI / 180 }
function safe(fn, fallback) { try { return fn() ?? fallback } catch { return fallback } }

function fmtNW(n) {
  if (!n) return '£0'
  if (n >= 1e6) return `£${(n / 1e6).toFixed(n >= 10e6 ? 0 : 2)}M`
  if (n >= 1e3) return `£${Math.round(n / 1e3)}k`
  return `£${Math.round(n)}`
}

function buildPoints(dimsMap) {
  return DIMENSIONS.map(d => {
    const score = dimsMap?.[d.key] ?? 0
    const frac  = Math.min(1, score / d.max)
    const r     = Math.max(MIN_FRAC, frac) * MAX_R
    const angle = toRad(d.angle)
    return {
      key: d.key,
      x: CX + r * Math.cos(angle),
      y: CY + r * Math.sin(angle),
      frac, pct: Math.round(frac * 100),
      score,
    }
  })
}

function pointsString(pts) {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

/* ─── prefers-reduced-motion ───────────────────────────────────────────── */
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = e => setReduced(e.matches)
    mq.addEventListener?.('change', fn)
    return () => mq.removeEventListener?.('change', fn)
  }, [])
  return reduced
}

/* ─── per-mode active dims ─────────────────────────────────────────────── */
function activeDimsFor(viewMode, currentDims, target, plan, horizonYears = 5) {
  if (viewMode === 'plan' && plan) return plan
  if (viewMode === 'forecast')      return projectDimsForward(currentDims, horizonYears)
  // 'scenario' (What if) and 'actual' (Today): polygon shows current.
  // For What-if the drag handler overrides locally via ghost polygon.
  return currentDims || {}
}

/* ─── drag tooltip helper ─────────────────────────────────────────────── */
function estimateScoreDelta(fqData, dimKey, newDimVal) {
  const dims    = fqData?.dims || {}
  const dim     = DIMENSIONS.find(d => d.key === dimKey)
  if (!dim) return 0
  const maxVal  = dim.max || 100
  // Approximate per-dim weight: each dim contributes proportionally to its max
  // relative to the total of all maxes (sum = 110 for the 7-dim set).
  const totalMax = DIMENSIONS.reduce((s, d) => s + d.max, 0)
  const w       = maxVal / totalMax
  const oldPct  = (dims[dimKey] ?? 0) / maxVal
  const newPct  = newDimVal           / maxVal
  // fqData.total is on a 0-100 scale
  return Math.round((newPct - oldPct) * w * 100)
}

/* ─── main component ───────────────────────────────────────────────────── */

export default function RadarAnchor({
  entity, fqData, viewMode = 'actual',
  diffs = [], onDrillMetric,
}) {
  const reducedMotion = useReducedMotion()
  const svgRef = useRef(null)

  /* ── target resolution (priority: plan → life-stage → algorithmic) ──── */
  const targetInfo = useMemo(() => getWealthTarget(entity), [entity])
  const targetDims = targetInfo.dims

  /* ── plan dims (separate from target — plan is for the Plan viewMode) ── */
  const planWealth = useMemo(() => safe(() => planFor(entity, 'retirement'), null), [entity])
  const planDims   = planWealth?.target?.dims || planWealth?.targetValue?.dims || null

  /* ── current dims ──────────────────────────────────────────────────────── */
  const currentDims = fqData?.dims || {}

  /* ── polygon points per layer ─────────────────────────────────────────── */
  const activeDims = useMemo(
    () => activeDimsFor(viewMode, currentDims, targetDims, planDims),
    [viewMode, currentDims, targetDims, planDims],
  )
  const activePoints = useMemo(() => buildPoints(activeDims), [activeDims])
  const targetPoints = useMemo(() => buildPoints(targetDims), [targetDims])
  const currentPoints = useMemo(() => buildPoints(currentDims), [currentDims])

  const activeStr  = pointsString(activePoints)
  const targetStr  = pointsString(targetPoints)
  const currentStr = pointsString(currentPoints)

  /* ── gap dims (shown in Today + Plan modes; suppressed in Future) ────── */
  const gaps = useMemo(() => {
    if (viewMode === 'forecast') return []
    const compareAgainst = viewMode === 'plan' ? (planDims || targetDims) : targetDims
    return gapDims(currentDims, compareAgainst, GAP_THRESHOLD)
  }, [viewMode, currentDims, planDims, targetDims])

  /* ── long-press to overlay target (used in What-if mode for reference) ─ */
  const [planOverlay, setPlanOverlay] = useState(false)
  const longPressTimer = useRef(null)
  const startLongPress = useCallback(() => {
    longPressTimer.current = setTimeout(() => setPlanOverlay(true), 320)
  }, [])
  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
    setPlanOverlay(false)
  }, [])

  /* ── drag-node what-if ────────────────────────────────────────────────── */
  const [dragKey, setDragKey]     = useState(null)
  const [dragFrac, setDragFrac]   = useState(0)
  const [story, setStory]         = useState(null)  // §13.1 causal story payload
  const [dragTooltip, setDragTooltip] = useState(null)
  // dragTooltip: { dimKey, label, oldVal, newVal, scoreDelta, x, y } | null
  const dragStartedAt = useRef(0)

  const handleNodeDown = (e, dimKey) => {
    e.stopPropagation()
    e.preventDefault()
    startLongPress()
    dragStartedAt.current = Date.now()
    setDragKey(dimKey)
    const curFrac = activePoints.find(p => p.key === dimKey)?.frac ?? 0
    setDragFrac(curFrac)
  }

  const getSvgPoint = useCallback(e => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    const t = e.touches?.[0] || e
    pt.x = t.clientX
    pt.y = t.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return pt.matrixTransform(ctm.inverse())
  }, [])

  const handleMove = useCallback(e => {
    if (!dragKey) return
    const p = getSvgPoint(e)
    if (!p) return
    if (Date.now() - dragStartedAt.current > 30) {
      clearTimeout(longPressTimer.current)
      setPlanOverlay(false)
    }
    const dx = p.x - CX
    const dy = p.y - CY
    const dist = Math.hypot(dx, dy)
    const newFrac = Math.max(0, Math.min(1, dist / MAX_R))
    setDragFrac(newFrac)

    // Tooltip: show live dim value + estimated score delta
    const dim = DIMENSIONS.find(d => d.key === dragKey)
    if (dim) {
      const newDimVal = newFrac * dim.max
      const delta = estimateScoreDelta(fqData, dragKey, newDimVal)
      const svg = svgRef.current
      const rect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 }
      const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
      setDragTooltip({
        dimKey,
        label:      dim.label,
        oldVal:     Math.round(fqData?.dims?.[dragKey] ?? 0),
        newVal:     Math.round(newDimVal),
        scoreDelta: delta,
        x:          clientX - rect.left + 12,
        y:          clientY - rect.top  - 40,
      })
    }
  }, [dragKey, getSvgPoint, fqData, svgRef])

  const handleUp = useCallback(() => {
    cancelLongPress()
    if (!dragKey) return
    const dim = DIMENSIONS.find(d => d.key === dragKey)
    if (!dim) { setDragKey(null); return }

    const targetValue = Math.round(dragFrac * dim.max * 10) / 10
    const currentValue = currentDims[dragKey] ?? 0

    if (Math.abs(targetValue - currentValue) / dim.max > 0.05) {
      const ranked = safe(
        () => goalSeek(entity, `wealth.${dragKey}`, targetValue, null, null),
        [],
      )
      setStory(buildCausalStory({
        entity, dim, currentValue, targetValue,
        currentDims, ranked: Array.isArray(ranked) ? ranked.slice(0, 3) : [],
      }))
    }
    setDragKey(null)
    setDragTooltip(null)
  }, [dragKey, dragFrac, entity, currentDims, cancelLongPress])

  useEffect(() => {
    if (!dragKey) return
    const opts = { passive: false }
    window.addEventListener('mousemove', handleMove, opts)
    window.addEventListener('touchmove', handleMove, opts)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove, opts)
      window.removeEventListener('touchmove', handleMove, opts)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [dragKey, handleMove, handleUp])

  /* ── ghost polygon during drag ────────────────────────────────────────── */
  const ghostStr = useMemo(() => {
    if (!dragKey) return null
    const ghost = activePoints.map(p => {
      if (p.key !== dragKey) return p
      const dim = DIMENSIONS.find(d => d.key === dragKey)
      const angle = toRad(dim.angle)
      const r = Math.max(MIN_FRAC, dragFrac) * MAX_R
      return { ...p, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
    })
    return pointsString(ghost)
  }, [dragKey, dragFrac, activePoints])

  const handleSpokeKey = (e, dimKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onDrillMetric?.(`wealth.${dimKey}`)
    }
  }

  const polyTransition = reducedMotion
    ? 'none'
    : 'all 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'

  /* ── current-mode helpers ─────────────────────────────────────────────── */
  const isWhatIf  = viewMode === 'scenario'
  const isPlan    = viewMode === 'plan'
  const isFuture  = viewMode === 'forecast'
  const isToday   = viewMode === 'actual'

  const showTargetLayer = isToday || isPlan || isFuture  // What-if hides target during drag for clarity
  const targetLabel = isPlan ? 'Plan target' : isFuture ? 'Resilient target' : 'Target'
  const modeMeta = MODE_META[viewMode] || MODE_META.actual

  return (
    <div style={{
      margin: '0 var(--space-lg) var(--space-md)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 'clamp(220px, 65vw, 380px)',
        margin: '0 auto',
        aspectRatio: '1/1',
        position: 'relative',
        overflow: 'visible',
        userSelect: 'none',
        touchAction: dragKey ? 'none' : 'manipulation',
      }}>
        {/* Scan sweep */}
        {!reducedMotion && (
          <div aria-hidden="true" style={{
            position: 'absolute', inset: '8%', borderRadius: '50%',
            pointerEvents: 'none', zIndex: 1,
            background: 'conic-gradient(from -50deg, transparent 0deg, var(--c-radar-glow) 24deg, transparent 58deg)',
            animation: 'caelixaScan 6.5s linear infinite',
          }}/>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            overflow: 'visible', display: 'block',
          }}
          role="img"
          aria-label={`Wealth Score dimensions, mode ${modeMeta.label}. Total ${fqData?.total ?? 0}.`}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
        >
          {/* Rings */}
          {RINGS.map((r, i) => (
            <circle key={`ring-${i}`}
              cx={CX} cy={CY} r={r * MAX_R}
              fill="none" stroke="var(--c-radar-ring)" strokeWidth={1}
            />
          ))}

          {/* Axes */}
          {DIMENSIONS.map((d, i) => {
            const angle = toRad(d.angle)
            return (
              <line key={`axis-${i}`}
                x1={CX} y1={CY}
                x2={(CX + MAX_R * Math.cos(angle)).toFixed(1)}
                y2={(CY + MAX_R * Math.sin(angle)).toFixed(1)}
                stroke="var(--c-radar-axis)" strokeWidth={1}
              />
            )
          })}

          {/* LAYER 1 — Target polygon (dashed gold, behind current). Always
              visible in Today / Plan / Future so user sees the aspiration. */}
          {showTargetLayer && (
            <polygon
              points={targetStr}
              fill="none"
              stroke="var(--c-gold)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              opacity={0.65}
              style={{
                // Theme-aware glow via token reference — was hardcoded rgba
                // that only worked against dark backgrounds. var(--c-gold)
                // resolves to bright #d97700 in light and #ffbd59 in dark.
                filter: 'drop-shadow(0 0 6px var(--c-gold-bg))',
                transition: polyTransition,
              }}
            />
          )}

          {/* LAYER 2 — Active polygon (current or projected, depending on mode) */}
          <polygon
            points={activeStr}
            fill="var(--c-radar-fill)"
            stroke="var(--c-radar-stroke)"
            strokeWidth={2.2}
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 12px var(--c-radar-glow))',
              transition: polyTransition,
              opacity: planOverlay && !isWhatIf ? 0.35 : 1,
            }}
          />

          {/* LAYER 3 — Gap indicators on spokes that are materially below target.
              Coral hash mark at the midpoint of the gap segment. Tappable for
              "this is what's missing" drill. */}
          {gaps.map(key => {
            const dim = DIMENSIONS.find(d => d.key === key)
            const cur = currentPoints.find(p => p.key === key)
            const tgt = targetPoints.find(p => p.key === key)
            if (!dim || !cur || !tgt) return null
            const midX = (cur.x + tgt.x) / 2
            const midY = (cur.y + tgt.y) / 2
            const angle = toRad(dim.angle)
            // perpendicular tick (short hash mark)
            const px = -Math.sin(angle) * 4
            const py =  Math.cos(angle) * 4
            return (
              <g key={`gap-${key}`} style={{ cursor: 'pointer' }}>
                <line
                  x1={midX - px} y1={midY - py}
                  x2={midX + px} y2={midY + py}
                  stroke="var(--c-acc3)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 4px var(--c-acc3-bg))' }}
                />
                <circle
                  cx={midX} cy={midY} r={24}
                  fill="transparent"
                  onClick={() => onDrillMetric?.(`wealth.${key}`)}
                  aria-label={`Gap on ${dim.label}. Tap to see what's missing.`}
                  role="button"
                  tabIndex={0}
                />
              </g>
            )
          })}

          {/* GHOST polygon during drag (What-if mode) */}
          {ghostStr && (
            <polygon
              points={ghostStr}
              fill="none"
              stroke="var(--c-radar-stroke)"
              strokeWidth={1.6}
              strokeDasharray="4 4"
              opacity={0.6}
            />
          )}
        </svg>

        {/* Spoke nodes (HTML positioned, drillable + draggable) */}
        {activePoints.map((p, i) => {
          const dim = DIMENSIONS[i]
          const isDanger = p.pct < 20
          const isGap    = gaps.includes(dim.key)
          const leftPct  = (CX + NODE_R * Math.cos(toRad(dim.angle))) / SIZE * 100
          const topPct   = (CY + NODE_R * Math.sin(toRad(dim.angle))) / SIZE * 100
          const labelWords = dim.label.split(' ')
          const labelLine1 = labelWords.slice(0, Math.ceil(labelWords.length / 2)).join(' ')
          const labelLine2 = labelWords.slice(Math.ceil(labelWords.length / 2)).join(' ')
          const isDragging = dragKey === dim.key
          // Show target pct as a small chip when there's a gap
          const tgtPct = Math.round(((targetDims[dim.key] ?? 0) / dim.max) * 100)
          return (
            <div
              key={dim.key}
              role="button"
              tabIndex={0}
              aria-label={`${dim.label}: ${p.pct}, target ${tgtPct}. Tap to drill, drag for what-if.`}
              onMouseDown={(e) => handleNodeDown(e, dim.key)}
              onTouchStart={(e) => handleNodeDown(e, dim.key)}
              onClick={() => {
                if (!dragKey) onDrillMetric?.(`wealth.${dim.key}`)
              }}
              onKeyDown={(e) => handleSpokeKey(e, dim.key)}
              style={{
                position: 'absolute',
                left: `${leftPct}%`, top: `${topPct}%`,
                transform: 'translate(-50%, -50%)',
                width: 64,
                padding: '6px 4px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 1,
                textAlign: 'center',
                borderRadius: 14,
                border: `1px solid ${isGap ? 'var(--c-acc3)' : isDanger ? 'var(--c-acc3)' : 'var(--c-border)'}`,
                background: 'var(--c-radar-node-bg)',
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: isDragging
                  ? '0 0 24px var(--c-radar-glow), 0 4px 14px rgba(0,0,0,.30)'
                  : (isGap || isDanger)
                    ? '0 6px 18px rgba(0,0,0,.18), 0 0 12px var(--c-acc3-bg)'
                    : '0 6px 18px rgba(0,0,0,.14)',
                color: 'var(--c-text)',
                userSelect: 'none',
                transition: polyTransition,
                touchAction: 'none',
              }}
            >
              <div style={{
                fontSize: 16, fontWeight: 800, lineHeight: 1,
                color: dim.colour,
                letterSpacing: -0.3,
              }}>{p.pct}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, lineHeight: 1.15,
                color: 'var(--c-text2)',
                letterSpacing: 0.2,
              }}>
                {labelLine1}
                {labelLine2 && <><br/>{labelLine2}</>}
              </div>
              {/* Gap badge: shows when the dim has a material gap to target */}
              {isGap && (
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--c-acc3)',
                  border: '2px solid var(--c-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                  color: 'var(--c-bg)',
                }}>!</div>
              )}
            </div>
          )
        })}

        {/* Centre cap — NW + Wealth Score (no Risk) */}
        <CenterCap
          entity={entity}
          fqData={fqData}
          diffs={diffs}
          onDrillMetric={onDrillMetric}
          targetSource={targetInfo.source}
        />

        {/* Drag tooltip — live dim value + score delta */}
        {dragTooltip && (
          <div style={{
            position: 'absolute',
            left: dragTooltip.x, top: dragTooltip.y,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-sep)',
            borderRadius: 10, padding: '8px 12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            fontSize: 12, color: 'var(--c-text2)',
            pointerEvents: 'none', zIndex: 20,
            minWidth: 140,
          }}>
            <div style={{ fontWeight: 800, color: 'var(--c-text)', marginBottom: 3 }}>{dragTooltip.label}</div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              {dragTooltip.oldVal} → <strong style={{ color: dragTooltip.newVal > dragTooltip.oldVal ? 'var(--c-acc)' : 'var(--c-acc3)' }}>{dragTooltip.newVal}</strong>
            </div>
            <div style={{ marginTop: 4, fontWeight: 700, color: dragTooltip.scoreDelta >= 0 ? 'var(--c-acc)' : 'var(--c-acc3)', fontSize: 11 }}>
              Score: {dragTooltip.scoreDelta >= 0 ? '+' : ''}{dragTooltip.scoreDelta} pts
            </div>
          </div>
        )}
      </div>

      {/* Mode header strip — readable label + a one-line interaction hint.
         Replaces the cryptic mode pill with something a non-power-user can
         actually use. */}
      <div style={{
        margin: 'var(--space-sm) 0 0',
        display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          textTransform: 'uppercase', color: modeMeta.colour,
        }}>
          {modeMeta.label}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4,
          maxWidth: 480, textAlign: 'center',
        }}>
          {modeMeta.hint(gaps.length, isPlan && !planDims, isFuture)}
        </div>
      </div>

      {/* Legend strip — dashed gold = target, filled mint = current, coral = gap */}
      {showTargetLayer && (
        <div style={{
          marginTop: 'var(--space-sm)',
          display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
          fontSize: 10, color: 'var(--c-text3)', letterSpacing: 0.3,
        }}>
          <LegendChip colour="var(--c-gold)" dashed label={targetLabel} />
          <LegendChip colour="var(--c-acc)" label={isFuture ? 'Projected' : 'Where you are'} />
          {gaps.length > 0 && (
            <LegendChip colour="var(--c-acc3)" label={`${gaps.length} gap${gaps.length > 1 ? 's' : ''}`} />
          )}
        </div>
      )}

      {/* Causal-story slide-over (What-if drag result) */}
      {story && (
        <CausalStoryPanel story={story} onDismiss={() => setStory(null)} onDrillMetric={onDrillMetric} />
      )}
    </div>
  )
}

/* ─── mode metadata ──────────────────────────────────────────────────── */

const MODE_META = {
  actual: {
    label: 'Today',
    colour: 'var(--c-acc)',
    hint: (nGaps) => nGaps > 0
      ? `${nGaps} dimension${nGaps > 1 ? 's' : ''} below target. Tap a coral mark or weak node to see what's missing.`
      : 'On or near target across all dimensions. Tap a node for the breakdown.',
  },
  forecast: {
    label: 'Future (5-year projection)',
    colour: 'var(--c-acc2, #4D8EFF)',
    hint: () => 'Where each dimension is heading if you stay on the current path. Tap a node for what\'s driving the projection.',
  },
  plan: {
    label: 'Plan',
    colour: 'var(--c-gold)',
    hint: (nGaps, noPlanDims) => noPlanDims
      ? 'No per-dimension wealth plan set. Showing your life-stage target shape. Set a plan to see your committed targets here.'
      : `${nGaps} gap${nGaps !== 1 ? 's' : ''} between today and your committed plan. Tap a gap to see how to close it.`,
  },
  scenario: {
    label: 'What if',
    colour: 'var(--c-violet, #BA8CFF)',
    hint: () => 'Drag any dimension node to set a what-if target. Release to see what would change.',
  },
}

/* ─── legend chip ─────────────────────────────────────────────────────── */
function LegendChip({ colour, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        display: 'inline-block', width: 14, height: dashed ? 0 : 3,
        borderTop: dashed ? `2px dashed ${colour}` : 'none',
        background: dashed ? 'transparent' : colour,
        borderRadius: 100,
      }} />
      <span>{label}</span>
    </div>
  )
}

/* ─── CenterCap — NW + Wealth Score + band (no Risk) ─────────────────── */

function CenterCap({ entity, fqData, diffs, onDrillMetric, targetSource }) {
  const nw = safe(() => netWorth(entity), 0)

  const anchorDiff = (key) => {
    const hit = diffs.find(d => (d?.key || d?.dim || d) === key)
    return hit?.delta ?? 0
  }

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '36%', height: '36%',
      minWidth: 116, minHeight: 116,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 4,
      borderRadius: '50%',
      border: '1px solid var(--c-border2)',
      background: 'radial-gradient(circle at 50% 35%, var(--c-acc-bg), transparent 36%), var(--c-surface)',
      boxShadow: '0 0 38px var(--c-radar-glow), 0 4px 18px rgba(0,0,0,.20)',
      textAlign: 'center',
      zIndex: 4,
      padding: '10px 6px',
    }}>
      {/* Net Worth — top */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          textTransform: 'uppercase', color: 'var(--c-text3)',
          marginBottom: 1,
        }}>Net Worth</div>
        <Drillable metric="netWorth" onOpen={onDrillMetric} affordance="underline">
          <span style={{
            fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
            lineHeight: 1,
          }}>{fmtNW(nw)}</span>
        </Drillable>
        {anchorDiff('netWorth') !== 0 && (
          <div style={{ marginTop: 2, display: 'flex', justifyContent: 'center' }}>
            <DeltaChip delta={anchorDiff('netWorth')} format="currency" />
          </div>
        )}
      </div>

      {/* Wealth Score — middle (hero) */}
      <div style={{ margin: '2px 0' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          textTransform: 'uppercase', color: 'var(--c-text3)',
          marginBottom: 1,
        }}>Wealth Score</div>
        <DiffPulse trigger={anchorDiff('wealthScore')}>
          <Drillable metric="wealthScore" onOpen={onDrillMetric} affordance="underline">
            <div style={{
              fontSize: 30, fontWeight: 800,
              color: fqData?.band?.colour || 'var(--c-acc)',
              lineHeight: 1, letterSpacing: -0.5,
            }}>{fqData?.total ?? 0}</div>
          </Drillable>
        </DiffPulse>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          textTransform: 'uppercase', marginTop: 2,
          color: fqData?.band?.colour || 'var(--c-text3)',
          opacity: 0.85,
        }}>
          {fqData?.band?.name || ''}
        </div>
      </div>

      {/* Target source caption (small, optional — explains where the gold
         dashed polygon comes from). */}
      {targetSource && (
        <div style={{
          fontSize: 8, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: 'var(--c-text3)',
          opacity: 0.6, marginTop: 2,
        }}>
          target: {targetSource === 'plan' ? 'your plan' : targetSource === 'life-stage' ? 'life stage' : 'auto'}
        </div>
      )}
    </div>
  )
}

/* ─── CausalStoryPanel — §13.1 causal stories rendered after What-if drag.
   Narrates the cascade: "Topping up your ISA closes the Tax gap by 3 points.
   It also reduces projected IHT by £840 and pulls your FI date 4 months
   forward." Engine-generated, not LLM. Bridges goal-seek output into a
   plain-English ripple narrative. ─────────────────────────────────────── */

const DIM_ROUTE = {
  behaviour: 'money', capital: 'money', tax: 'tax',
  protection: 'risk', cashflow: 'flow', debt: 'money', estate: 'tax',
}

function CausalStoryPanel({ story, onDismiss, onDrillMetric }) {
  const { dim, currentValue, targetValue, ranked, narratives } = story
  const dir = targetValue > currentValue ? 'increase' : 'lower'
  const dimPct = Math.round((currentValue / dim.max) * 100)
  const tgtPct = Math.round((targetValue / dim.max) * 100)

  return (
    <div
      role="region"
      aria-label="What-if cascade"
      style={{
        margin: 'var(--space-md) 0 0',
        padding: 'var(--space-md) var(--space-lg)',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
        position: 'relative',
        animation: 'caelixaFadeUp .35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
      }}
    >
      <button
        onClick={onDismiss}
        aria-label="Dismiss what-if"
        style={{
          position: 'absolute', top: 8, right: 10,
          background: 'none', border: 'none',
          fontSize: 16, color: 'var(--c-text3)', cursor: 'pointer',
        }}
      >×</button>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: 'var(--c-violet, #BA8CFF)',
        marginBottom: 6,
      }}>
        What if · {dim.label} · {dimPct}% → {tgtPct}%
      </div>
      <div style={{
        fontSize: 13, color: 'var(--c-text)', lineHeight: 1.55, marginBottom: 'var(--space-md)',
      }}>
        {narratives.lead}
      </div>
      {narratives.cascade.length > 0 && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div className="sw-eyebrow" style={{
            fontSize: 10, color: 'var(--c-acc)', marginBottom: 6, letterSpacing: 0.6,
          }}>
            What else changes
          </div>
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {narratives.cascade.map((c, i) => (
              <li key={i} style={{
                fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
                paddingLeft: 12, position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', left: 0, top: 6,
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--c-acc)',
                }} />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ranked.length > 0 && (
        <>
          <div className="sw-eyebrow" style={{
            fontSize: 10, color: 'var(--c-gold)', marginBottom: 6, letterSpacing: 0.6,
          }}>
            How to get there
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {ranked.map((p, i) => (
              <div
                key={p.id || i}
                role="button"
                tabIndex={0}
                onClick={() => onDrillMetric?.(`nav:${DIM_ROUTE[dim?.key] || 'money'}`)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onDrillMetric?.(`nav:${DIM_ROUTE[dim?.key] || 'money'}`) }}
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-sep)',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', marginBottom: 2 }}>
                  {p.label || p.title || `Option ${i + 1}`}
                </div>
                {p.detail && (
                  <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                    {p.detail}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--c-acc)', marginTop: 4 }}>
                  Go to {p.screen || dim?.formalLabel || 'detail'} →
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {ranked.length === 0 && (
        <div style={{
          fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic',
          padding: 'var(--space-sm) 0',
        }}>
          The engine doesn't yet route per-dimension paths for {dim.label.toLowerCase()}.
          Per-dim goal-seek extends as the engine surface per-dimension wealth solvers.
        </div>
      )}
    </div>
  )
}

/* ─── buildCausalStory — engine-generated narrative for What-if drag.
   §13.1 from dynamic-crunching-wall: rippleEffect output rendered as a
   sentence. NOT an LLM call — deterministic, derived from the dim, the
   target delta, and downstream impacts on related metrics (estate, FI date,
   etc). Currently lean — the engine's per-dim ripple solver is still
   surfacing; this builds the best narrative possible from what's available. */

function buildCausalStory({ entity, dim, currentValue, targetValue, currentDims, ranked }) {
  const delta = targetValue - currentValue
  const dimPctNow = Math.round((currentValue / dim.max) * 100)
  const dimPctTgt = Math.round((targetValue / dim.max) * 100)

  // Lead: state the change
  const direction = delta > 0 ? 'improving' : 'lowering'
  const lead = `${direction === 'improving' ? 'Improving' : 'Lowering'} ${dim.label.toLowerCase()} from ${dimPctNow}% to ${dimPctTgt}% would move that dimension ${delta > 0 ? 'closer to' : 'further from'} target by ${Math.abs(Math.round((delta / dim.max) * 100))} points.`

  // Cascade: what else would change?
  // For now we use heuristics tied to specific dims. As engine extends with
  // a real rippleEffect(entity, change, ['all']) call, this becomes
  // engine-driven not heuristic.
  const cascade = []
  if (dim.key === 'tax' && delta > 0) {
    cascade.push('Reduces taxable cash sitting outside ISA/pension wrappers — closes future CGT exposure.')
    cascade.push('Likely improves projected IHT position via wrapper-based estate efficiency.')
  }
  if (dim.key === 'protection' && delta > 0) {
    cascade.push('Lowers Risk Score exposure on the Income Resilience axis (Risk tab).')
    cascade.push('Closes a Critical Gap that currently surfaces on Home as a state tile alert.')
  }
  if (dim.key === 'estate' && delta > 0) {
    cascade.push('Reduces projected IHT exposure — directly impacts Cost of Waiting on Tax & Estate tab.')
    cascade.push('Likely pulls one or more plan-staleness banners off Home.')
  }
  if (dim.key === 'capital' && delta > 0) {
    cascade.push('Brings Financial Independence ratio closer to 100% — Home state tile shifts toward Approaching/Achieved.')
    cascade.push('Pulls projected retirement date earlier on the Timeline tab.')
  }
  if (dim.key === 'debt' && delta > 0) {
    cascade.push('Reduces monthly debt service — frees surplus for ISA/pension contributions.')
    cascade.push('Improves Cashflow Health dimension as a knock-on.')
  }
  if (dim.key === 'cashflow' && delta > 0) {
    cascade.push('More surplus available for monthly investment contributions.')
    cascade.push('Improves resilience to income shocks (Risk tab Income Resilience dimension).')
  }
  if (dim.key === 'behaviour' && delta > 0) {
    cascade.push('Reflects in consistent Wealth Score gains over 6-month rolling window.')
    cascade.push('Improves Bad-timing risk score on Cashflow tab.')
  }

  // If we have ranked paths from goalSeek, ranked also feeds the panel.
  return {
    dim, currentValue, targetValue,
    ranked,
    narratives: { lead, cascade },
  }
}
