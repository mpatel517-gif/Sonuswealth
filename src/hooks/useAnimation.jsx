// ─────────────────────────────────────────────────────────────────────────────
// useAnimation.jsx — animation hooks + easing helpers
// Pairs with src/styles/animations.css.
//
// All hooks are SSR-safe — they guard `window` / `document` access.
//
// Exports (named):
//   easeOutCubic, easeOutExpo, easeInOutQuad           — easing helpers
//   useCounterAnimation(target, opts)   → string       — animates digits
//   useTicker(baseValue, ratePerSecond, opts) → number — live counter (1Hz)
//   usePrevious(value)                  → previous     — classic ref hook
//   useDeltaFlash(value)                → boolean      — true 1200ms on change
//   useCascadeTrigger(triggerKey)       → boolean      — true 800ms on change
//   useInView(ref, opts)                → boolean      — IntersectionObserver
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined'
const useIsoLayoutEffect = IS_BROWSER ? useLayoutEffect : useEffect

// ─────────────────────────────────────────────────────────────────────────────
// Easing helpers
// ─────────────────────────────────────────────────────────────────────────────
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}
export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

const identity = (n) => n

// ─────────────────────────────────────────────────────────────────────────────
// useCounterAnimation
// Animates from previous render value to `target` over `duration` ms via rAF.
// First mount eases in from `target * 0.85` (or 0 when target === 0) so the
// number doesn't slap into place but also isn't a jarring full-zero ramp on
// big values.
// Returns the current intermediate value already passed through `format`.
// ─────────────────────────────────────────────────────────────────────────────
export function useCounterAnimation(target, opts = {}) {
  const {
    duration = 800,
    easing = easeOutExpo,
    format = identity,
  } = opts

  const safeTarget = Number.isFinite(target) ? target : 0

  const fromRef     = useRef(safeTarget === 0 ? 0 : safeTarget * 0.85)
  const lastTargetRef = useRef(safeTarget)
  const rafRef      = useRef(null)
  const startRef    = useRef(0)
  const [output, setOutput] = useState(() => format(fromRef.current))

  useIsoLayoutEffect(() => {
    if (!IS_BROWSER) {
      setOutput(format(safeTarget))
      return
    }
    const from = fromRef.current
    const to   = safeTarget
    if (from === to) {
      setOutput(format(to))
      return
    }
    startRef.current = performance.now()

    const tick = (now) => {
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = easing(t)
      const value = from + (to - from) * eased
      setOutput(format(value))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    lastTargetRef.current = to

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      // Snapshot wherever we ended so the next change continues smoothly.
      fromRef.current = lastTargetRef.current
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget, duration])

  return output
}

// ─────────────────────────────────────────────────────────────────────────────
// useTicker
// Live counter — `baseValue + (now - mount) / 1000 * ratePerSecond`.
// Re-evaluates every 1000 ms via setInterval. Cleanup on unmount.
// `enabled: false` short-circuits and just returns baseValue.
// ─────────────────────────────────────────────────────────────────────────────
export function useTicker(baseValue, ratePerSecond, opts = {}) {
  const { enabled = true } = opts
  const mountRef = useRef(null)
  const [tick, setTick] = useState(0)

  // Reset baseline whenever baseValue / rate / enabled changes.
  useEffect(() => {
    if (!IS_BROWSER || !enabled) {
      mountRef.current = null
      return
    }
    mountRef.current = Date.now()
    setTick(0)
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [baseValue, ratePerSecond, enabled])

  if (!enabled || !IS_BROWSER || mountRef.current == null) {
    return baseValue
  }
  const elapsedSec = (Date.now() - mountRef.current) / 1000
  // `tick` participates in the calc only to force re-render — using the time
  // delta keeps the counter exact even if the interval drifts.
  void tick
  return baseValue + elapsedSec * ratePerSecond
}

// ─────────────────────────────────────────────────────────────────────────────
// usePrevious — classic ref-based previous-value hook
// ─────────────────────────────────────────────────────────────────────────────
export function usePrevious(value) {
  const ref = useRef(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current
}

// ─────────────────────────────────────────────────────────────────────────────
// useDeltaFlash — true for `duration` ms whenever value changes
// ─────────────────────────────────────────────────────────────────────────────
function useTransientFlag(value, duration) {
  const [active, setActive] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setActive(true)
    if (!IS_BROWSER) return
    const t = setTimeout(() => setActive(false), duration)
    return () => clearTimeout(t)
  }, [value, duration])
  return active
}

export function useDeltaFlash(value) {
  return useTransientFlag(value, 1200)
}

export function useCascadeTrigger(triggerKey) {
  return useTransientFlag(triggerKey, 800)
}

// ─────────────────────────────────────────────────────────────────────────────
// useInView — IntersectionObserver wrapper for scroll-triggered reveals
// `once: true` (default) disconnects the observer after the first intersection.
// Falls back to `true` (eagerly visible) when IO isn't available.
// ─────────────────────────────────────────────────────────────────────────────
export function useInView(ref, opts = {}) {
  const { rootMargin = '0px', once = true, threshold = 0.05 } = opts
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!IS_BROWSER) return
    const node = ref?.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) obs.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [ref, rootMargin, once, threshold])

  return inView
}

// Default export: namespace bundle for `import anim from ...` patterns.
const anim = {
  easeOutCubic, easeOutExpo, easeInOutQuad,
  useCounterAnimation, useTicker, usePrevious,
  useDeltaFlash, useCascadeTrigger, useInView,
}
export default anim
