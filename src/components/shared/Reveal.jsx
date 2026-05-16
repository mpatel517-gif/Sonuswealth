// ─────────────────────────────────────────────────────────────────────────────
// Reveal.jsx — entry-animation primitives
// Pairs with src/styles/animations.css and src/hooks/useAnimation.jsx.
//
// Exports (named + default namespace):
//   <FadeInOnMount delay={0}>             — single-element .sw-fade-in-up
//   <RevealStagger interval={60}>         — list, each child staggered
//   <DrawSVG duration={800}>{<svg path/>} — animates stroke-dasharray
//   <Skeleton width height />             — shimmering placeholder
// ─────────────────────────────────────────────────────────────────────────────

import { Children, cloneElement, isValidElement, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// FadeInOnMount
// ─────────────────────────────────────────────────────────────────────────────
export function FadeInOnMount({
  delay = 0,
  duration,
  as: Tag = 'div',
  className = '',
  style,
  children,
  ...rest
}) {
  const composedClass = ['sw-fade-in-up', className].filter(Boolean).join(' ')
  const composedStyle = {
    animationDelay: delay ? `${delay}ms` : undefined,
    animationDuration: duration ? `${duration}ms` : undefined,
    ...style,
  }
  return (
    <Tag className={composedClass} style={composedStyle} {...rest}>
      {children}
    </Tag>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RevealStagger
// Wraps children so each one fades-up with `index * interval` delay.
// Children may be elements OR primitives — primitives get wrapped in <div>.
// ─────────────────────────────────────────────────────────────────────────────
export function RevealStagger({
  interval = 60,
  startDelay = 0,
  className = '',
  style,
  as: Tag = 'div',
  children,
  ...rest
}) {
  const items = Children.toArray(children)
  return (
    <Tag className={className} style={style} {...rest}>
      {items.map((child, i) => {
        const delay = startDelay + i * interval
        const animStyle = { animationDelay: `${delay}ms` }
        if (isValidElement(child)) {
          const childClass = [child.props.className, 'sw-fade-in-up'].filter(Boolean).join(' ')
          return cloneElement(child, {
            key: child.key ?? i,
            className: childClass,
            style: { ...animStyle, ...(child.props.style || {}) },
          })
        }
        return (
          <div key={i} className="sw-fade-in-up" style={animStyle}>
            {child}
          </div>
        )
      })}
    </Tag>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DrawSVG
// Wraps an <svg> (or any element containing path/line/polyline/circle nodes)
// and animates stroke-dasharray on mount so paths "draw" themselves in.
// Detects pathLength via getTotalLength() per node.
// ─────────────────────────────────────────────────────────────────────────────
export function DrawSVG({ duration = 800, easing = 'cubic-bezier(0.16, 1, 0.3, 1)', children }) {
  const ref = useRef(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = ref.current
    if (!root) return
    const drawables = root.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse')
    drawables.forEach((node) => {
      let length = 0
      try {
        if (typeof node.getTotalLength === 'function') length = node.getTotalLength()
      } catch { /* some nodes (rect/circle) without length — skip */ }
      if (!length || !Number.isFinite(length)) return
      // Snapshot styles so reruns don't compound.
      node.style.strokeDasharray = `${length}`
      node.style.strokeDashoffset = `${length}`
      node.style.transition = 'none'
      // Force reflow so the new dashoffset starts from `length` rather than
      // batching with the immediately-applied `0` below.
      void node.getBoundingClientRect()
      node.style.transition = `stroke-dashoffset ${duration}ms ${easing}`
      node.style.strokeDashoffset = '0'
    })
  }, [duration, easing, children])

  return (
    <span ref={ref} style={{ display: 'contents' }}>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — shimmering placeholder block
// ─────────────────────────────────────────────────────────────────────────────
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
  className = '',
  ...rest
}) {
  const composedClass = ['sw-skeleton', className].filter(Boolean).join(' ')
  return (
    <div
      aria-hidden="true"
      className={composedClass}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      {...rest}
    />
  )
}

const Reveal = { FadeInOnMount, RevealStagger, DrawSVG, Skeleton }
export default Reveal
