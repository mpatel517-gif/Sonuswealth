// ─────────────────────────────────────────────────────────────────────────────
// FINIO — DIMENSION CONFIG
// Single source of truth. Previously duplicated in HomeScreen, HomeScreenJit
// and FQBreakdown. Do not re-declare dimension labels or colours anywhere else.
//
// Ordering: radar order (matches engine dim order in calcFQ()).
// Colours: fixed identity per dimension — never varied by score or theme.
// Labels:  plain English (user-facing) per 21 April decision.
//          formalLabel retained for any analytical surface that needs it.
// Angles:  radar position, -90° = top, clockwise.
// Max:     per-dimension maximum score used for radar % fill calculation.
// ─────────────────────────────────────────────────────────────────────────────

export const DIMENSIONS = [
  {
    key:         'behaviour',
    label:       'Money habits',
    formalLabel: 'Behaviour',
    max:         20,
    angle:       -90,
    colour:      '#4D8EFF',
    icon:        '◈',
    definition:  'How well you manage money day to day — paying bills on time, spending within your means, staying on top of your finances.',
  },
  {
    key:         'capital',
    label:       'What you own',
    formalLabel: 'Capital',
    max:         18,
    angle:       -90 + 360/7,
    colour:      '#00E5A8',
    icon:        '◉',
    definition:  'Whether the wealth you have built up is on track for the retirement income you want.',
  },
  {
    key:         'tax',
    label:       'Tax position',
    formalLabel: 'Tax',
    max:         18,
    angle:       -90 + 2 * 360/7,
    colour:      '#FFB347',
    icon:        '⚖',
    definition:  'How much of your money is sheltered from tax — pensions, ISAs, and allowances you are entitled to use each year.',
  },
  {
    key:         'protection',
    label:       'Safety net',
    formalLabel: 'Protection',
    max:         16,
    angle:       -90 + 3 * 360/7,
    colour:      '#FF6B6B',
    icon:        '🛡',
    definition:  'Whether you and your family are financially protected if something goes wrong — illness, death, or loss of income.',
  },
  {
    key:         'cashflow',
    label:       'C-Flow',
    formalLabel: 'Cashflow',
    max:         16,
    angle:       -90 + 4 * 360/7,
    colour:      '#34C759',
    icon:        '◈',
    definition:  'Whether your monthly income comfortably covers your spending and leaves something over.',
  },
  {
    key:         'debt',
    label:       'What you owe',
    formalLabel: 'Debt',
    max:         14,
    angle:       -90 + 5 * 360/7,
    colour:      '#AF52DE',
    icon:        '◎',
    definition:  'Whether any debts you have are manageable and working in your favour rather than against you.',
  },
  {
    key:         'estate',
    label:       'Your legacy',
    formalLabel: 'Estate',
    max:         28,
    angle:       -90 + 6 * 360/7,
    colour:      '#FF9500',
    icon:        '◷',
    definition:  'Whether your wealth will pass to your family as efficiently as possible — inheritance tax, your will, pension nominations.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const DIM_BY_KEY = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]))

export function dimByKey(key) {
  return DIM_BY_KEY[key]
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK NARRATIVE
// If a persona JSON does not yet have dimensionNarrative for a dimension, this
// generic fallback renders instead. Per FP-4: honest about what's missing,
// never a confident fabrication.
// ─────────────────────────────────────────────────────────────────────────────

export const FALLBACK_NARRATIVE = {
  risk:   'Detailed analysis for this dimension is still being prepared for your profile.',
  action: 'Review this area with your adviser or explore the simulator below.',
  future: 'Improvements here compound over your remaining planning horizon.',
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATIVE RESOLVER
// Centralises the "get the right narrative for this persona + this dimension"
// logic so screens don't each reimplement it.
//
// Usage:
//   const n = narrativeFor(entity, 'estate')
//   // n.risk, n.action, n.future
// ─────────────────────────────────────────────────────────────────────────────

export function narrativeFor(entity, dimKey) {
  const persona = entity?.dimensionNarrative?.[dimKey]
  if (!persona) return FALLBACK_NARRATIVE
  return {
    risk:   persona.risk   || FALLBACK_NARRATIVE.risk,
    action: persona.action || FALLBACK_NARRATIVE.action,
    future: persona.future || FALLBACK_NARRATIVE.future,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE-REACTIVE COLOUR
// Shared between radar spike fills and other surfaces that want the same rule.
// Identity colour when score is strong, amber-ish when mid, red-ish when low.
// ─────────────────────────────────────────────────────────────────────────────

export function scoreReactiveFill(colour, frac) {
  if (frac >= 0.70) return colour + 'BB'
  if (frac >= 0.40) return '#FFB347' + '77'
  return '#FF6B6B' + '66'
}

export function scoreReactiveStroke(colour, frac) {
  if (frac >= 0.70) return colour
  if (frac >= 0.40) return '#FFB347'
  return '#FF6B6B'
}
