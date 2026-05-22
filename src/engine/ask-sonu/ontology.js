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
