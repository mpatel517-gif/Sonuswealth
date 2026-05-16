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
