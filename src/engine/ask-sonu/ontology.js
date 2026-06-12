// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — ONTOLOGY
//
// 15 concerns, 10 resources, ~12 constraints. Finite, curated. Every life
// question maps to a weighted combination of these. New scenarios don't need
// new code — they need plays in the KG that trigger off the right concerns.
//
// This is the schema that lets the system be dynamic without enumerating
// scenarios. Scenarios are infinite, concerns are not.
// ─────────────────────────────────────────────────────────────────────────────

export const CONCERNS = {
  RETIREMENT:     'retirement',          // Stopping work, drawdown, sequencing
  TAX:            'tax_optimisation',    // Reducing income / capital tax burden
  IHT_LEGACY:     'iht_legacy',          // Passing wealth on, estate planning
  INCOME_SECURITY:'income_security',     // Sustainable income, sequence risk
  PROTECTION:     'protection',          // Death / illness / income loss cover
  RELOCATION:     'relocation',          // Moving countries / jurisdictions
  FAMILY_CHANGE:  'family_change',       // Marriage, divorce, kids, cohabitation
  BUSINESS_EXIT:  'business_exit',       // Selling a business, succession
  HEALTHCARE:     'healthcare',          // Access, cost, continuity
  EDUCATION:      'education',           // School / uni fees for children
  LIQUIDITY:      'liquidity',           // Cash access, emergency fund
  REGULATORY:     'regulatory_risk',     // Rule changes, deadlines (e.g. 2027 SIPP IHT)
  CURRENCY:       'currency_risk',       // FX, multi-currency exposure
  TIME_FREEDOM:   'time_freedom',        // Working less, sabbatical, FIRE
  LIFESTYLE:      'lifestyle',           // Quality of life, location, climate
  DEBT:           'debt_mortgage',       // Umbrella: any mortgage/debt question
  DEBT_OVERPAY:   'debt_overpay',        // Overpay mortgage vs invest / clear with a windfall
  DEBT_RATE:      'debt_rate_switch',    // Remortgage, fixed vs tracker, interest-only, borrowing
  DEBT_OFFSET:    'debt_offset',         // Offset mortgage against savings
  DEBT_EQUITY:    'debt_equity_release', // Equity release / lifetime mortgage
  CASH_BUFFER:    'cash_buffer',         // Emergency fund / how much to hold liquid
  CASH_DEPLOY:    'cash_deploy',         // Maturing deposits / what to do with sitting cash
  CASH_SHELTER:   'cash_shelter',        // MMF vs cash ISA / where to hold cash
  CASH_GILTS:     'cash_gilts',          // Buying gilts directly
  CASH_PSA:       'cash_psa',            // Personal Savings Allowance / interest tax
  CASH_BEYOND_ISA:'cash_beyond_isa',     // ISA full this year — what next
  CASH_BEDSIPP:   'cash_bed_sipp',       // Bed-and-SIPP a cash holding
  CASH_RATEDROP:  'cash_rate_drop',      // Savings rates have fallen — response
  INV_ALLOCATION: 'inv_allocation',      // How to think about an asset allocation
  INV_FEES:       'inv_fees',            // Fund fees / TER benchmarking
  INV_PASSIVE:    'inv_passive_active',  // Passive vs active funds
  INV_CONCENTRATION:'inv_concentration', // Single-stock / concentration risk
  INV_REBALANCE:  'inv_rebalance',       // Rebalancing discipline
  INV_EM:         'inv_emerging_markets',// Emerging-markets exposure
  INV_ESG:        'inv_esg',             // ESG / ethical / sustainable funds
}

export const RESOURCES = {
  PENSION:        'pension_capital',
  ISA:            'isa_capital',
  GIA:            'gia_capital',
  PROPERTY:       'property_equity',
  BUSINESS:       'business_equity',
  EARNED_INCOME:  'earned_income',
  SPOUSE_INCOME:  'spouse_income',
  INHERITANCE:    'inheritance_expected',
  TRUST:          'trust_capital',
  CASH:           'liquid_cash',
}

export const FACTS = {
  AGE:            'age',
  SPOUSE_AGE:     'spouse_age',
  KIDS_AGES:      'kids_ages',
  DEPENDENTS:     'dependents',
  JURISDICTION:   'jurisdiction',
  DOMICILE:       'domicile',
  WORK_STATUS:    'work_status',          // employed | self-employed | retired | part_time
  MARITAL_STATUS: 'marital_status',       // single | married | cohabiting | divorced | widowed
  HEALTH_STATUS:  'health_status',
  MORTGAGE_LEFT:  'mortgage_remaining',
  TARGET_INCOME:  'target_income',
  TIME_HORIZON:   'time_horizon',
  RISK_TOLERANCE: 'risk_tolerance',
  SPOUSE_PENSION: 'spouse_pension_capital',
  SPENDING_PATTERN:'spending_pattern',     // steady | front_loaded | back_loaded
  RELOCATION_DEST:'relocation_destination',
  KIDS_MOVING:    'kids_moving',
  HEALTHCARE_RELIANCE:'healthcare_reliance',
  GIFT_AMOUNT:    'gift_amount',
  GIFT_RECIPIENT: 'gift_recipient',

  // ── State-aware facts (tax-year position) ─────────────────────────
  ISA_USED_THIS_YEAR:        'isa_used_this_year',
  PENSION_CONTRIB_THIS_YEAR: 'pension_contrib_this_year',
  CGT_REALISED_THIS_YEAR:    'cgt_realised_this_year',
  LAST_GIFT_AMOUNT_DATE:     'last_gift_amount_date',
  PURPOSE_OF_CASH:           'purpose_of_cash',          // emergency | income | growth | dated_spend
  TIME_HORIZON_OF_CASH:      'time_horizon_of_cash',     // < 1yr | 1-3yr | 3-5yr | 5yr+
  MPAA_STATUS:               'mpaa_status',              // triggered | not_triggered | unsure
}

// Values a question planner may use to discriminate.
// Each fact also declares its question form (for the UI).
export const FACT_QUESTIONS = {
  spouse_pension_capital: 'Roughly what is your spouse\'s pension pot worth?',
  spending_pattern:       'In retirement, do you expect spending to be steady, front-loaded (more in early years), or back-loaded (more in later years)?',
  target_income:          'What level of after-tax income do you need each year?',
  time_horizon:           'When do you want this to happen — within 1 year, 1-3 years, 3-5 years, or just exploring?',
  relocation_destination: 'Which country are you considering?',
  kids_moving:            'Are dependent children moving with you?',
  healthcare_reliance:    'Do you or anyone in your household rely on ongoing UK healthcare?',
  gift_amount:            'Roughly how much do you want to give?',
  gift_recipient:         'Who would receive it — children, grandchildren, a charity, someone else?',
  risk_tolerance:         'When markets fall 20%, do you panic-sell, sit tight, or buy more?',
  marital_status:         'Are you married, cohabiting, single, or divorced?',

  // ── State-aware questions ────────────────────────────────────────
  isa_used_this_year:        'How much of your £20,000 ISA allowance have you used this tax year?',
  pension_contrib_this_year: 'Roughly how much have you contributed to pensions this tax year?',
  cgt_realised_this_year:    'Have you realised any capital gains this tax year?',
  purpose_of_cash:           'What is this cash earmarked for?',
  time_horizon_of_cash:      'When will you need this money?',
  mpaa_status:                'Have you ever taken any taxable income from a flexi-access pension? (this triggers MPAA)',
}

// Map fact answers (free text or chip) to belief-state updates.
// Used by classifier to convert user answers into structured belief.
export function normaliseFact(fact, rawValue) {
  if (rawValue == null) return null
  const v = String(rawValue).trim().toLowerCase()

  switch (fact) {
    case 'spending_pattern':
      if (/front|early/.test(v)) return 'front_loaded'
      if (/back|later/.test(v))  return 'back_loaded'
      return 'steady'
    case 'kids_moving':
    case 'healthcare_reliance':
      if (/^(yes|y|true)$/.test(v)) return true
      if (/^(no|n|false)$/.test(v)) return false
      return v
    case 'spouse_pension_capital':
    case 'target_income':
    case 'gift_amount': {
      // Parse "£250k", "250,000", "250000"
      const num = parseFloat(v.replace(/[£,$,\s]/g, '').replace(/k$/, '000').replace(/m$/, '000000'))
      return Number.isFinite(num) ? num : null
    }
    default:
      return rawValue
  }
}
