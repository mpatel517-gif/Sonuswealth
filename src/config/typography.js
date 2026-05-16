// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA — TYPOGRAPHY TOKENS
// JS-accessible type scale. Matches CSS custom properties in index.css.
// Use these in component styles instead of arbitrary values.
//
// Weight ladder: 400 (read) → 600 (emphasis) → 700 (strong) → 800 (hero)
// No weight 500 — use 600 for any "medium" need.
// No weights above 800 — hero numbers max at 800.
//
// Created: 1 May 2026 (P3.2 Typography tokens)
// ─────────────────────────────────────────────────────────────────────────────

// ── SIZE SCALE ──────────────────────────────────────────────────────────────
// Matches CSS --fs-* tokens. Use these for consistency across components.
export const SIZE = {
  heroLg:  36,   // Standalone big numbers — score dials, FQ breakdown
  hero:    28,   // Triple-anchor tile numbers, primary score surfaces
  titleLg: 20,   // Section headers, prominent card titles
  title:   17,   // Card titles, screen headers, top-bar brand
  body:    14,   // PRIMARY BODY — minimum for readable paragraphs
  small:   13,   // ABSOLUTE FLOOR — secondary/metadata text
  label:   11,   // ONLY for uppercase tracked labels
  micro:   10,   // Legal disclaimers, absolute minimum
}

// ── WEIGHT LADDER ───────────────────────────────────────────────────────────
// Clean ladder: 400 → 600 → 700 → 800. No arbitrary 780/820/850/880.
export const WEIGHT = {
  regular:  400,  // Body text, paragraphs, descriptions
  medium:   600,  // Emphasis, navigation, labels — replaces 500/510
  semibold: 700,  // Strong emphasis, card titles, section headers
  bold:     800,  // Hero numbers, scores, primary metrics
}

// ── LETTER SPACING ──────────────────────────────────────────────────────────
// Negative at display sizes, tracked at label sizes.
export const TRACKING = {
  tight:    -0.5,   // Hero/display numbers
  normal:   0,      // Body text
  wide:     0.8,    // Uppercase labels (px, not em)
  wider:    1.2,    // Extra-tracked uppercase headers
}

// ── LINE HEIGHT ─────────────────────────────────────────────────────────────
export const LEADING = {
  none:     1.0,    // Hero numbers, single-line metrics
  tight:    1.15,   // Titles, headings
  normal:   1.45,   // Body text
  relaxed:  1.6,    // Long-form content, descriptions
}

// ── PRESET STYLES ───────────────────────────────────────────────────────────
// Ready-to-spread style objects for common patterns.
// Usage: <div style={{ ...TYPE.heroNumber, color: 'var(--c-acc)' }}>59</div>

export const TYPE = {
  // Hero numbers — scores, net worth, primary metrics
  heroNumber: {
    fontSize: SIZE.heroLg,
    fontWeight: WEIGHT.bold,
    lineHeight: LEADING.none,
    letterSpacing: TRACKING.tight,
  },

  // Tile numbers — triple-anchor, card primary values
  tileNumber: {
    fontSize: SIZE.hero,
    fontWeight: WEIGHT.bold,
    lineHeight: LEADING.none,
    letterSpacing: TRACKING.tight,
  },

  // Section titles — card headers, panel titles
  sectionTitle: {
    fontSize: SIZE.title,
    fontWeight: WEIGHT.semibold,
    lineHeight: LEADING.tight,
    letterSpacing: TRACKING.normal,
  },

  // Body text — descriptions, paragraphs
  body: {
    fontSize: SIZE.body,
    fontWeight: WEIGHT.regular,
    lineHeight: LEADING.normal,
  },

  // Small body — secondary text, metadata
  bodySmall: {
    fontSize: SIZE.small,
    fontWeight: WEIGHT.regular,
    lineHeight: LEADING.normal,
  },

  // Uppercase label — section headers, badges
  label: {
    fontSize: SIZE.label,
    fontWeight: WEIGHT.semibold,
    lineHeight: LEADING.none,
    letterSpacing: TRACKING.wide,
    textTransform: 'uppercase',
  },

  // Emphasis body — inline strong, key phrases
  bodyStrong: {
    fontSize: SIZE.body,
    fontWeight: WEIGHT.medium,
    lineHeight: LEADING.normal,
  },

  // Card title — prominent tile headers
  cardTitle: {
    fontSize: SIZE.titleLg,
    fontWeight: WEIGHT.semibold,
    lineHeight: LEADING.tight,
    letterSpacing: TRACKING.normal,
  },

  // Metric value — secondary numbers in tiles
  metricValue: {
    fontSize: SIZE.title,
    fontWeight: WEIGHT.bold,
    lineHeight: LEADING.none,
  },

  // Legal/disclaimer
  legal: {
    fontSize: SIZE.micro,
    fontWeight: WEIGHT.regular,
    lineHeight: LEADING.relaxed,
  },
}

// ── CSS VARIABLE REFS ───────────────────────────────────────────────────────
// For components that need CSS var() strings instead of px values.
export const CSS_VARS = {
  heroLg: 'var(--fs-hero-lg)',
  hero:   'var(--fs-hero)',
  title:  'var(--fs-title)',
  body:   'var(--fs-body)',
  small:  'var(--fs-small)',
  label:  'var(--fs-label)',
}
