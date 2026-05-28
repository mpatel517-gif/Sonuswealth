/**
 * src/components/shared/Heading.jsx
 *
 * Phase 8 — S4 DS primitive (2026-05-28)
 *
 * Single source for app-wide heading typography. Wraps an h1/h2/h3 with
 * the design system's font scale so every screen's "section title" looks
 * the same. Resolves the ad-hoc heading styles audit caught across 47+
 * call sites (frontend critique).
 *
 * Levels:
 *   - 'hero'    → 28px / 800 / -1px letter-spacing  (1 per route max)
 *   - 'page'    → 22px / 800 / -0.5px               (route h1)
 *   - 'section' → 18px / 820                        (section group)
 *   - 'card'    → 15px / 700                        (card title)
 *   - 'eyebrow' → 10px / 700 / 0.9em letter-spacing / uppercase (over-tag)
 *
 * Use:
 *   <Heading level="page" as="h1">Cashflow</Heading>
 *   <Heading level="eyebrow">Route 3</Heading>
 */

const STYLES = {
  hero: {
    fontSize: 28, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1,
    color: 'var(--c-text)',
  },
  page: {
    fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2,
    color: 'var(--c-text)',
  },
  section: {
    fontSize: 18, fontWeight: 820, lineHeight: 1.3,
    color: 'var(--c-text)',
  },
  card: {
    fontSize: 15, fontWeight: 700, lineHeight: 1.3,
    color: 'var(--c-text)',
  },
  eyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'var(--c-text3)',
  },
}

export default function Heading({
  level = 'section',
  as,
  children,
  style = {},
  ...rest
}) {
  const Tag = as || (
    level === 'hero' ? 'h1'
    : level === 'page' ? 'h1'
    : level === 'section' ? 'h2'
    : level === 'card' ? 'h3'
    : 'div'
  )
  const base = STYLES[level] || STYLES.section
  return (
    <Tag style={{ margin: 0, ...base, ...style }} {...rest}>
      {children}
    </Tag>
  )
}
