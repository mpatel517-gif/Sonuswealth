// ─────────────────────────────────────────────────────────────────────────────
// plain-english — PP-9 alias map
//
// Single source of truth for plain-English labels. Every screen imports from
// here. Internal codes (X25, X28, FQ, CoI, APQ, PRC/PCC, ANI, RNRB, BPR, LPA,
// Bengen, Guyton, Bucket, Floor-Upside, SWR) must NEVER render at top layer.
//
// Rendering rules:
//   · Plain-English primary in UI (caption, hero label, drill title)
//   · Statutory term shown in parens where canonical ("Residence allowance (RNRB)")
//   · Internal codes only in code comments and engine internals
// ─────────────────────────────────────────────────────────────────────────────

export const ALIAS = {
  // Wealth Score family
  FQ:                 'Wealth Score',
  fq:                 'Wealth Score',
  wealthScore:        'Wealth Score',
  fqTotal:            'Wealth Score',

  // Risk Score family
  X25:                'Plain summary',
  riskScore:          'Risk Score',
  riskTotal:          'Risk Score',

  // X28 temporal view
  X28:                'Time window',
  X29:                "What's changed",
  X22:                'Where you came from',
  X24:                'What if',
  X26:                'Pride moments',
  X27:                'Estate documents',

  // Net Worth + drivers
  netWorth:           'Net Worth',
  nw:                 'Net Worth',
  assets:             'What you own',
  liabilities:        'What you owe',

  // Cost of waiting (was CoI)
  CoI:                'Cost of waiting',
  coi:                'Cost of waiting',
  costOfInaction:     'Cost of waiting',
  totalCoI:           'Total cost of waiting',

  // Priority Actions (was APQ)
  APQ:                'Priority actions',
  apq:                'Priority actions',
  priorityActions:    'Priority actions',

  // PRC/PCC family — currently a stub (G1 pending founder)
  PRC:                'Real return',
  PCC:                'Real cost',
  prcPccSpread:       'Capital Efficiency',
  capitalEfficiency:  'Capital Efficiency',

  // Income family
  ANI:                'Take-home income',
  ani:                'Take-home income',
  annualNetIncome:    'Take-home income',
  marginalRate:       'Top tax band rate',

  // Surplus + flow
  monthlySurplus:     'Monthly surplus',
  surplus:            'Surplus',
  liquidity:          'Cash buffer',

  // Tax + Estate statutory terms (plain primary, statutory in parens)
  RNRB:               'Residence allowance (RNRB)',
  BPR:                'Business relief (BPR)',
  LPA:                'Power of attorney (LPA)',
  NRB:                'Tax-free band (NRB)',
  CGT:                'Capital gains tax',
  IHT:                'Inheritance tax',
  SA:                 'Self assessment',
  bequest:            'Estate intent',
  bequestMotive:      'Estate intent',
  ihtExposure:        'Estate at risk',
  will:               'Will & LPA',
  lpa:                'Power of attorney',
  ihtWaterfall:       'How estate is taxed',
  giftClock:          'Gift timeline',
  rnrbTaper:          'Residence allowance taper',
  bprQualifying:      'Business relief qualifying value',
  willLpaStatus:      'Will & power of attorney status',

  // Cashflow methods — plain-English mapping
  Bengen:             'Classic 4% rule',
  bengen:             'Classic 4% rule',
  'Guyton-Klinger':   'Dynamic guardrails',
  guyton:             'Dynamic guardrails',
  guytonKlinger:      'Dynamic guardrails',
  Bucket:             'Time-horizon buckets',
  bucket:             'Time-horizon buckets',
  'Floor-Upside':     'Floor + discretionary',
  floorUpside:        'Floor + discretionary',
  SWR:                'Sustainable spend rate',
  swr:                'Sustainable spend rate',
  swrFromRegime:      'Sustainable spend rate',
  fundedRatio:        'Plan coverage',
  monteCarlo:         'What could happen',
  maxDrawdown:        'Worst-case dip',

  // Sequence + behaviour terms
  sequenceRisk:       'Bad-timing risk',
  sequenceOfReturns:  'Bad-timing risk',
  behaviouralTrack:   'Behaviour discipline',
  BTR:                'Behaviour discipline',

  // Risk dimensions (Risk Layer v1.6)
  incomeRes:          'Income resilience',
  protCov:            'Protection cover',
  debtVuln:           'Debt vulnerability',
  concRisk:           'Concentration risk',
  depExp:             'Dependency exposure',

  // Plans + scenarios
  planCommitment:     'Plan',
  scenarioObject:     'Scenario',
  forecastSnapshot:   'Forecast',

  // Confidence + provenance
  confidence:         'Data confidence',
  provenance:         'Where this came from',

  // Wrappers (X19 family)
  SIPP:               'Pension (SIPP)',
  ISA:                'ISA',
  GIA:                'General investment account (GIA)',
  EIS:                'Enterprise investment scheme (EIS)',
  VCT:                'Venture capital trust (VCT)',
  BTL:                'Buy-to-let',

  // Pension contribution + access
  AA:                 'Pension contribution limit (annual allowance)',
  aa:                 'Pension contribution limit',
  annualAllowance:    'Pension contribution limit',
  taperedAA:          'Reduced contribution limit',
  carryForward:       'Unused allowance from earlier years',
  MPAA:               'Reduced pension limit (after first withdrawal)',
  mpaa:               'Reduced pension limit',
  LSA:                'Tax-free cash limit',
  lsa:                'Tax-free cash limit',
  PCLS:               'Tax-free cash',
  pcls:               'Tax-free cash',
  FAD:                'Pension drawdown',
  fad:                'Pension drawdown',
  UFPLS:              'Lump sum from pension',
  ufpls:              'Lump sum from pension',

  // Investment costs
  OCF:                'Fund charges',
  ocf:                'Fund charges',
  ongoingCharge:      'Fund charges',

  // Property + business reliefs
  S24:                'Mortgage interest restriction (S24)',
  s24:                'Mortgage interest restriction',
  BADR:               'Business sale relief (BADR)',
  badr:               'Business sale relief',

  // Time-view (X28 4-mode)
  scenario:           'What-if',
  Scenario:           'What-if',
  actual:             'Today',
  Actual:             'Today',
  forecast:           'Forecast',
  Forecast:           'Forecast',
  plan:               'Plan',
  Plan:               'Plan',
}

/**
 * Resolve any internal code to its plain-English label.
 * Falls back to a prettified version of the input if no alias exists.
 */
export function plain(key) {
  if (!key) return ''
  if (ALIAS[key]) return ALIAS[key]
  // Fallback — camelCase / snake_case → "Title Case"
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

/** Resolve and append a parenthetical for statutory terms */
export function plainWithStatutory(key) {
  const text = plain(key)
  // If the alias already contains a paren (statutory form), use as-is
  return text
}

/**
 * Resolve a statutory code or internal symbol to its plain-English label.
 * Returns the input unchanged if no alias exists (graceful fallback).
 *
 * Used by every UI component that renders a statutory term. Per PP-9, raw
 * statutory codes (AA, LSA, CGT, IHT, etc.) must never reach the screen —
 * always pipe through plainOf() or use the ALIAS map directly.
 *
 * @example
 *   plainOf('AA')          → 'Pension contribution limit (annual allowance)'
 *   plainOf('netWorth')    → 'Net Worth'
 *   plainOf('unknownTerm') → 'unknownTerm'   (graceful fallback)
 */
export function plainOf(key) {
  if (typeof key !== 'string') return key
  return ALIAS[key] ?? key
}
