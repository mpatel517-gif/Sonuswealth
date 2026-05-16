// ─────────────────────────────────────────────────────────────────────────────
// Diff.jsx — X29 diff layer primitives
// Spec: home §X29-HOME · referenced from every tab.
//
// Exports (named):
//   DiffBadge        — tinted background + arrow; shows a magnitude-of-change
//   DeltaChip        — small pill chip for a single delta value
//   CausalityStripe  — bottom-of-card stripe with provenance source list
//   DiffPulse        — wrapper; pulses children when `trigger` value changes
//   HotspotIndicator — small dot when a surface has X29 changes since last visit
//
// Auto-decay (X29.6): visual diff fades to neutral after 14 days. We compute
// the age from `since` and lerp the saturation toward neutral.
//
// Uses engine.diffSet(entity, sinceTimestamp) to detect changes for hotspots.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { diffSet } from '../../engine/fq-calculator.js'

const DECAY_DAYS = 14
const DAY_MS = 86_400_000

// Compute decay factor 1 → 0 over DECAY_DAYS.
function decayFactor(sinceTs) {
  if (!sinceTs) return 1
  const ageDays = Math.max(0, (Date.now() - new Date(sinceTs).getTime()) / DAY_MS)
  if (ageDays >= DECAY_DAYS) return 0
  return 1 - (ageDays / DECAY_DAYS)
}

// Emerald (positive) / coral (negative) / text3 (zero or decayed)
function tone(value, sinceTs) {
  const decay = decayFactor(sinceTs)
  const num = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^\-0-9.]/g, ''))
  if (decay === 0 || !Number.isFinite(num) || num === 0) {
    return { fg: 'var(--c-text3)', bg: 'transparent', arrow: '·', decay }
  }
  if (num > 0) {
    return {
      fg: 'var(--c-acc)',
      bg: `color-mix(in srgb, var(--c-acc) ${Math.round(10 * decay)}%, transparent)`,
      arrow: '▲', decay,
    }
  }
  return {
    fg: 'var(--c-acc3)',
    bg: `color-mix(in srgb, var(--c-acc3) ${Math.round(10 * decay)}%, transparent)`,
    arrow: '▼', decay,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DiffBadge — value with tinted background + arrow (decay-aware)
// ──────────────────────────────────────────────────────────────────────────────
export function DiffBadge({ value, since, format }) {
  const t = tone(value, since)
  const display = format === 'currency' && typeof value === 'number'
    ? `${value >= 0 ? '+' : '−'}£${Math.abs(value).toLocaleString('en-GB')}`
    : format === 'percent'  && typeof value === 'number'
      ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
      : (typeof value === 'number'
        ? `${value >= 0 ? '+' : ''}${value}`
        : value)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 100,
      fontSize: 'var(--fs-small)', fontWeight: 700,
      color: t.fg, background: t.bg,
      transition: 'background .4s, color .4s',
    }}>
      <span style={{ fontSize: 9 }}>{t.arrow}</span>
      <span>{display}</span>
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DeltaChip — minimal pill for a delta only
// ──────────────────────────────────────────────────────────────────────────────
export function DeltaChip({ delta = 0, format = 'score', since }) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  const abs  = Math.abs(delta)
  const body = format === 'currency' ? `£${abs.toLocaleString('en-GB')}`
              : format === 'percent'  ? `${abs.toFixed(1)}%`
              : `${abs}`
  // Decay-aware: when `since` makes the diff old, fade to neutral.
  const decay = decayFactor(since)
  const cls = decay === 0 || delta === 0
    ? 'sw-chip sw-chip-sm'
    : delta > 0
      ? 'sw-chip sw-chip-sm sw-chip-mint'
      : 'sw-chip sw-chip-sm sw-chip-coral'
  return (
    <span className={cls} style={{ opacity: 0.6 + 0.4 * decay }}>
      {sign}{body}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CausalityStripe — provenance list rendered as a thin stripe (tap → reveal)
// ──────────────────────────────────────────────────────────────────────────────
export function CausalityStripe({ sources = [], onTap }) {
  if (!sources.length) return null
  return (
    <button
      onClick={typeof onTap === 'function' ? onTap : undefined}
      aria-label="View causality and sources"
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: 'var(--c-surface2)',
        border: 'none',
        borderTop: '1px solid var(--c-sep)',
        borderRadius: '0 0 14px 14px',
        color: 'var(--c-text3)',
        fontSize: 'var(--fs-label)',
        fontWeight: 600,
        letterSpacing: 0.4,
        cursor: onTap ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ color: 'var(--c-acc2)' }}>↳</span>
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {sources.join(' · ')}
      </span>
      {onTap && <span style={{ fontSize: 10 }}>›</span>}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DiffPulse — pulses the children when `trigger` changes
//
// In addition to the inline glow/scale used historically, the wrapper applies
// the `.sw-cascade-halo` class for 800ms whenever `trigger` changes. The halo
// is a one-shot ring-pulse keyframed in src/styles/animations.css and is what
// the X21 cascade language uses across the app.  Both effects fire together —
// the inline glow gives the immediate feedback, the halo carries the X21
// signal outward.
// ──────────────────────────────────────────────────────────────────────────────
export function DiffPulse({ trigger, duration = 2000, children }) {
  const [pulsing, setPulsing] = useState(false)
  const [halo, setHalo]       = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPulsing(true)
    setHalo(true)
    const tPulse = setTimeout(() => setPulsing(false), duration)
    const tHalo  = setTimeout(() => setHalo(false), 800)
    return () => { clearTimeout(tPulse); clearTimeout(tHalo) }
  }, [trigger, duration])

  return (
    <span
      className={halo ? 'sw-cascade-halo' : undefined}
      style={{
        display: 'inline-block',
        transition: `box-shadow ${duration}ms ease-out, transform ${duration / 4}ms ease-out`,
        boxShadow: pulsing
          ? '0 0 0 4px color-mix(in srgb, var(--c-acc) 18%, transparent), 0 0 18px color-mix(in srgb, var(--c-acc) 32%, transparent)'
          : '0 0 0 0 transparent',
        transform: pulsing ? 'scale(1.02)' : 'scale(1)',
        borderRadius: 8,
      }}
    >
      {children}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// HotspotIndicator — small dot when X29 reports a diff for the given dim/key
// Reads engine.diffSet(entity, since); uses `dimKey` to filter.
// Falls back to "no dot" if engine returns nothing (graceful — FP-4).
// ──────────────────────────────────────────────────────────────────────────────
export function HotspotIndicator({ dimKey, entity = null, since = null, size = 8 }) {
  let active = false
  try {
    const set = diffSet(entity, since) || []
    active = Array.isArray(set) && set.some(d =>
      d?.dim === dimKey || d?.key === dimKey || d === dimKey
    )
  } catch { active = false }

  if (!active) return null
  return (
    <span
      aria-label="Has changes since last visit"
      style={{
        display: 'inline-block',
        width: size, height: size,
        borderRadius: '50%',
        background: 'var(--c-acc)',
        boxShadow: '0 0 6px color-mix(in srgb, var(--c-acc) 55%, transparent)',
        verticalAlign: 'middle',
      }}
    />
  )
}

// Default export: namespace map (so consumers can do `import Diff from '...'`
// and access Diff.Badge, Diff.Pulse etc.)
const Diff = { DiffBadge, DeltaChip, CausalityStripe, DiffPulse, HotspotIndicator }
export default Diff
