/**
 * src/de/ontology.js — Sonuswealth Decision Engine life-event ontology
 *
 * 60 bounded life events in 8 categories.
 * Add a new event = one entry here. Engine reads it; nothing else changes.
 * Never add event-specific logic outside this file.
 */

export const ONTOLOGY_VERSION = '1.0.0';

// ── Deadline IDs ─────────────────────────────────────────────────────────────
// Resolved to real dates by composer against rules-uk.js / daysLeft()
export const DEADLINES = {
  TAX_YEAR_END:   'tax_year_end',      // 5 April each year
  SIPP_IHT_2027:  'sipp_iht_2027',     // 6 April 2027 (Finance Act 2026 — ENACTED)
  GIFT_7YR:       'gift_7yr',          // rolling 7-year taper clock from gift date
  PENSION_AA:     'pension_aa',        // annual allowance resets 5 April
  CGT_ANNUAL:     'cgt_annual',        // CGT annual exempt amount resets 5 April
  ISA_ANNUAL:     'isa_annual',        // ISA allowance resets 6 April
  NMPA_2028:      'nmpa_2028',         // Normal Min Pension Age rises 55→57: 6 Apr 2028
  ISA_CASH_SUB:   'isa_cash_sublimit', // £12K Cash ISA sub-limit for under-65: 6 Apr 2027
};

// ── Engine IDs ────────────────────────────────────────────────────────────────
// Matched to ENGINE_REGISTRY keys in validator.js
export const ENGINES = {
  FQ:        'fq',        // fq-calculator.js
  CASHFLOW:  'cashflow',  // cashflow-engine.js
  TAX:       'tax',       // tax-estate-engine.js
  TIMELINE:  'timeline',  // timeline-engine.js
  RISK:      'risk',      // risk-engine.js
  SIMULATOR: 'simulator', // simulator.js
  FLOW:      'flow',      // monthly-flow-engine.js
};

const D = DEADLINES;
const E = ENGINES;

/**
 * Life event registry — 60 events.
 *
 * Each entry fields:
 *   id                    machine key matching object key
 *   category              display grouping (Career | Family | Property | Wealth |
 *                         Geographic | Health | Tax/Estate | Protection)
 *   label                 human-readable event name
 *   triggerPhrases[]      natural-language phrases that map to this event
 *   requiredContext[]     engine IDs whose data must appear in the prompt
 *   chartHints[]          preferred consequence metric names for this event
 *   fcaJurisdiction       'UK' | 'IN' | 'TH' | 'CA' | 'IE' | 'AU'
 *   irreversibilityBaseline  'low' | 'medium' | 'high' (per-path default)
 *   defaultDeadlines[]    deadline IDs always surfaced for this event
 */
export const EVENTS = {

  // ── CAREER (8) ─────────────────────────────────────────────────────────────

  job_change: {
    id: 'job_change', category: 'Career', label: 'Job change',
    triggerPhrases: ['new job', 'switching jobs', 'changing employer', 'job offer', 'career move', 'change role', 'leaving my job'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['monthlySurplus', 'incomeTaxDelta', 'pensionContinuity'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA],
  },

  promotion: {
    id: 'promotion', category: 'Career', label: 'Promotion / pay rise',
    triggerPhrases: ['promotion', 'pay rise', 'salary increase', 'bonus', 'higher salary', 'raise'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['incomeTaxDelta', 'monthlySurplus', 'pensionAAUsed'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA],
  },

  redundancy: {
    id: 'redundancy', category: 'Career', label: 'Redundancy',
    triggerPhrases: ['made redundant', 'redundancy', 'layoff', 'losing my job', 'job loss', 'severance', 'TUPE'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['cashflowRunway', 'emergencyFundMonths', 'incomeTaxDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA, D.ISA_ANNUAL],
  },

  career_break: {
    id: 'career_break', category: 'Career', label: 'Career break / sabbatical',
    triggerPhrases: ['career break', 'sabbatical', 'taking time off', 'gap year', 'pause work', 'unpaid leave'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['cashflowRunway', 'monthlySurplus', 'pensionGap'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA],
  },

  part_time: {
    id: 'part_time', category: 'Career', label: 'Go part-time',
    triggerPhrases: ['go part time', 'reduce hours', 'work less', 'flexible working', 'part-time', '3 days a week', '4 days', 'half time'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['monthlySurplus', 'incomeTaxDelta', 'mpaaRisk', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA, D.SIPP_IHT_2027],
  },

  start_business: {
    id: 'start_business', category: 'Career', label: 'Start a business',
    triggerPhrases: ['start a business', 'go self-employed', 'start a company', 'entrepreneur', 'found a startup', 'set up a ltd company', 'sole trader'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['cashflowRunway', 'incomeTaxDelta', 'emergencyFundMonths'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END, D.PENSION_AA],
  },

  sell_business: {
    id: 'sell_business', category: 'Career', label: 'Sell a business',
    triggerPhrases: ['sell my business', 'exit the business', 'business sale', 'trade sale', 'BADR', 'business asset disposal relief', 'exit strategy'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['cgtExposure', 'ihtDelta', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.TAX_YEAR_END, D.CGT_ANNUAL, D.SIPP_IHT_2027],
  },

  retire: {
    id: 'retire', category: 'Career', label: 'Retirement (full or phased)',
    triggerPhrases: ['retire', 'retiring', 'retirement', 'stop working', 'retire early', 'retiring early', 'can i retire', 'afford to retire', 'afford retirement', 'FIRE', 'financial independence', 'semi-retire', 'leave work', 'give up work', 'retire at'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.TIMELINE, E.RISK],
    chartHints: ['probabilityOfSuccess', 'swrSafe', 'drawdownMatrix', 'ihtExposure'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.SIPP_IHT_2027, D.TAX_YEAR_END, D.PENSION_AA, D.NMPA_2028],
  },

  // ── FAMILY (10) ────────────────────────────────────────────────────────────

  marry: {
    id: 'marry', category: 'Family', label: 'Marriage / civil partnership',
    triggerPhrases: ['getting married', 'marriage', 'civil partnership', 'engaged', 'wedding', 'tying the knot'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['ihtDelta', 'allowanceTracker', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END, D.GIFT_7YR],
  },

  divorce: {
    id: 'divorce', category: 'Family', label: 'Divorce / separation',
    triggerPhrases: ['divorce', 'separation', 'separating', 'splitting up', 'financial settlement', 'consent order'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.RISK],
    chartHints: ['netWorthDelta', 'ihtDelta', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.TAX_YEAR_END, D.CGT_ANNUAL],
  },

  child_born: {
    id: 'child_born', category: 'Family', label: 'Child born / adopted',
    triggerPhrases: ['having a baby', 'new baby', 'child born', 'adopting', 'pregnant', 'maternity', 'paternity', 'expecting'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK, E.TAX],
    chartHints: ['cashflowDelta', 'emergencyFundMonths', 'ihtPlanning'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.TAX_YEAR_END, D.ISA_ANNUAL, D.GIFT_7YR],
  },

  child_education: {
    id: 'child_education', category: 'Family', label: 'Funding child education',
    triggerPhrases: ['school fees', 'private school', 'university', 'tuition', 'education fund', 'junior ISA', 'child education', 'student loan'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['cashflowProjection', 'isaAllowance', 'monthlySurplus'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.ISA_ANNUAL, D.TAX_YEAR_END],
  },

  help_child_home: {
    id: 'help_child_home', category: 'Family', label: 'Help child buy a home',
    triggerPhrases: ['help my child buy', 'gifting house deposit', 'bank of mum and dad', 'family offset mortgage', 'gift to child for property', 'help son buy', 'help daughter buy'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['giftClock', 'ihtDelta', 'liquidityDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.GIFT_7YR, D.SIPP_IHT_2027, D.TAX_YEAR_END],
  },

  help_child_marry: {
    id: 'help_child_marry', category: 'Family', label: 'Gift on child\'s marriage',
    triggerPhrases: ['child getting married', 'wedding gift', 'gift on marriage', 'son getting married', 'daughter getting married', 'marriage gift exemption'],
    requiredContext: [E.FQ, E.TAX],
    chartHints: ['giftClock', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.GIFT_7YR],
  },

  care_for_parent: {
    id: 'care_for_parent', category: 'Family', label: 'Care for ageing parent',
    triggerPhrases: ['care for parent', 'ageing parent', 'parent needs care', 'power of attorney for parent', 'parent going into care', 'parent moving in', 'elderly parent'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['cashflowDelta', 'emergencyFundMonths'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END],
  },

  bereavement: {
    id: 'bereavement', category: 'Family', label: 'Bereavement / estate administration',
    triggerPhrases: ['someone died', 'bereavement', 'estate administration', 'probate', 'spouse died', 'parent died', 'dealing with an estate'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['ihtExposure', 'giftClock', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.GIFT_7YR, D.TAX_YEAR_END],
  },

  step_family: {
    id: 'step_family', category: 'Family', label: 'Blended / step-family restructure',
    triggerPhrases: ['step children', 'blended family', 'remarrying', 'step family', 'children from previous relationship', 'second marriage finances'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['ihtDelta', 'willStatus', 'beneficiaryChain'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.GIFT_7YR, D.TAX_YEAR_END],
  },

  child_school_start: {
    id: 'child_school_start', category: 'Family', label: 'Child starting school / nursery',
    triggerPhrases: ['child starting school', 'nursery fees', 'childcare costs', 'free childcare hours', 'term time starts'],
    requiredContext: [E.FQ, E.CASHFLOW],
    chartHints: ['cashflowDelta', 'monthlySurplus'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END],
  },

  // ── PROPERTY (10) ──────────────────────────────────────────────────────────

  buy_first_home: {
    id: 'buy_first_home', category: 'Property', label: 'Buy first home',
    triggerPhrases: ['first time buyer', 'buy my first home', 'first property', 'getting on the ladder', 'first home', 'FTB'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['cashflowDelta', 'ltv', 'monthlySurplus'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.ISA_ANNUAL],
  },

  upsize: {
    id: 'upsize', category: 'Property', label: 'Upsize / move to larger home',
    triggerPhrases: ['upsize', 'bigger house', 'moving to a larger home', 'need more space', 'growing family home', 'upsizing'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['cashflowDelta', 'sdltCost', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.TAX_YEAR_END],
  },

  downsize: {
    id: 'downsize', category: 'Property', label: 'Downsize home',
    triggerPhrases: ['downsize', 'smaller house', 'sell and buy smaller', 'release equity from home', 'moving to smaller property', 'downsizing'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.TIMELINE],
    chartHints: ['equityReleased', 'ihtDelta', 'cashflowDelta', 'rnrbEligibility'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.CGT_ANNUAL],
  },

  sell_home_no_buy: {
    id: 'sell_home_no_buy', category: 'Property', label: 'Sell home (rent or move abroad)',
    triggerPhrases: ['sell my house and rent', 'sell property without buying', 'selling up and renting', 'cashing out of property'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['cgtExposure', 'cashflowDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.CGT_ANNUAL, D.SIPP_IHT_2027],
  },

  buy_second_home: {
    id: 'buy_second_home', category: 'Property', label: 'Buy a second home',
    triggerPhrases: ['second home', 'holiday home', 'second property', 'buy another property', 'investment property', 'Birmingham property', 'buy in Leeds', 'buy in Manchester'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['sdltSurcharge', 'cgtExposure', 'ihtDelta', 'cashflowDelta', 'rentalYield'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.CGT_ANNUAL, D.TAX_YEAR_END],
  },

  buy_property_abroad: {
    id: 'buy_property_abroad', category: 'Property', label: 'Buy property abroad (investment)',
    triggerPhrases: ['buy property abroad', 'overseas property', 'foreign property', 'buy in Spain', 'buy in France', 'holiday home abroad', 'buy in Portugal'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['currencyRisk', 'ihtDelta', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.CGT_ANNUAL, D.SIPP_IHT_2027],
  },

  buy_btl: {
    id: 'buy_btl', category: 'Property', label: 'Buy a buy-to-let',
    triggerPhrases: ['buy to let', 'BTL', 'rental property', 'become a landlord', 'invest in property to rent out', 'let a property'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['rentalYield', 'sdltSurcharge', 'cgtExposure', 'ihtDelta', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.CGT_ANNUAL, D.TAX_YEAR_END],
  },

  sell_btl: {
    id: 'sell_btl', category: 'Property', label: 'Sell a buy-to-let',
    triggerPhrases: ['sell my rental property', 'sell BTL', 'exit property investment', 'sell investment property', 'selling my let'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['cgtExposure', 'netWorthDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.CGT_ANNUAL, D.TAX_YEAR_END, D.SIPP_IHT_2027],
  },

  remortgage: {
    id: 'remortgage', category: 'Property', label: 'Remortgage',
    triggerPhrases: ['remortgage', 'remortgaging', 'switch mortgage', 'fixed rate ending', 'mortgage renewal', 'mortgage deal ending'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['cashflowDelta', 'monthlySurplus', 'stressTest'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END],
  },

  equity_release: {
    id: 'equity_release', category: 'Property', label: 'Equity release',
    triggerPhrases: ['equity release', 'lifetime mortgage', 'release equity from home', 'home reversion', 'unlock house value'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.RISK],
    chartHints: ['ihtDelta', 'rnrbEligibility', 'cashflowDelta', 'equityReleased'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.GIFT_7YR],
  },

  // ── WEALTH (8) ─────────────────────────────────────────────────────────────

  inheritance_received: {
    id: 'inheritance_received', category: 'Wealth', label: 'Receive an inheritance',
    triggerPhrases: ['received inheritance', 'inheritance', 'inherited money', 'windfall from estate', 'left money in will', 'came into money'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['netWorthDelta', 'ihtDelta', 'allowanceTracker'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.SIPP_IHT_2027, D.ISA_ANNUAL, D.PENSION_AA, D.TAX_YEAR_END],
  },

  gift_received: {
    id: 'gift_received', category: 'Wealth', label: 'Receive a significant gift',
    triggerPhrases: ['received a gift', 'given money', 'parent gifting money', 'large gift', 'money from parents'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['giftClock', 'ihtDelta', 'allowanceTracker'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.GIFT_7YR, D.ISA_ANNUAL, D.PENSION_AA],
  },

  rsu_vesting: {
    id: 'rsu_vesting', category: 'Wealth', label: 'RSU / share option vesting',
    triggerPhrases: ['RSU vesting', 'share options', 'EMI options', 'SAYE', 'CSOP', 'equity vesting', 'stock vesting', 'options exercising'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['incomeTaxDelta', 'cgtExposure', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.CGT_ANNUAL, D.ISA_ANNUAL, D.TAX_YEAR_END],
  },

  windfall: {
    id: 'windfall', category: 'Wealth', label: 'Windfall (lottery, premium bond, legal settlement)',
    triggerPhrases: ['windfall', 'lottery win', 'premium bond win', 'legal settlement', 'unexpected money', 'sudden wealth'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['netWorthDelta', 'ihtDelta', 'allowanceTracker'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.SIPP_IHT_2027, D.ISA_ANNUAL, D.PENSION_AA, D.TAX_YEAR_END],
  },

  pension_lump_sum: {
    id: 'pension_lump_sum', category: 'Wealth', label: 'Pension lump sum / drawdown decision',
    triggerPhrases: ['pension lump sum', 'take pension cash', 'crystallise pension', 'UFPLS', 'flexi-access drawdown', 'pension drawdown', 'access my pension'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK, E.TIMELINE],
    chartHints: ['incomeTaxDelta', 'mpaaRisk', 'probabilityOfSuccess', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.NMPA_2028, D.TAX_YEAR_END],
  },

  large_investment: {
    id: 'large_investment', category: 'Wealth', label: 'Deploy a large lump sum',
    triggerPhrases: ['invest a lump sum', 'deploy cash', 'invest savings', 'large investment', 'invest in stocks', 'GIA vs ISA vs pension', 'where to invest'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['wrapperEfficiency', 'netWorthDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.ISA_ANNUAL, D.PENSION_AA, D.CGT_ANNUAL, D.SIPP_IHT_2027],
  },

  crypto_decision: {
    id: 'crypto_decision', category: 'Wealth', label: 'Crypto / digital asset decision',
    triggerPhrases: ['cryptocurrency', 'bitcoin', 'crypto', 'digital assets', 'NFT', 'DeFi', 'sell crypto', 'buy crypto'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['cgtExposure', 'netWorthDelta', 'volatilityRisk'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.CGT_ANNUAL, D.TAX_YEAR_END],
  },

  insurance_payout: {
    id: 'insurance_payout', category: 'Wealth', label: 'Insurance / protection payout received',
    triggerPhrases: ['insurance payout', 'life insurance claim', 'critical illness payout', 'income protection claim', 'received insurance money'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['cashflowDelta', 'netWorthDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.GIFT_7YR, D.ISA_ANNUAL],
  },

  // ── GEOGRAPHIC (6) ─────────────────────────────────────────────────────────

  relocate_abroad_work: {
    id: 'relocate_abroad_work', category: 'Geographic', label: 'Relocate abroad for work',
    triggerPhrases: ['moving abroad for work', 'expat', 'working overseas', 'secondment abroad', 'relocating internationally', 'working in another country'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['taxResidencyImpact', 'pensionContinuity', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END, D.SIPP_IHT_2027],
  },

  relocate_abroad_retire: {
    id: 'relocate_abroad_retire', category: 'Geographic', label: 'Retire abroad',
    triggerPhrases: ['retire abroad', 'retire overseas', 'retiring to Spain', 'retiring to Portugal', 'retire to France', 'QROPS', 'retire to Thailand'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK, E.TIMELINE],
    chartHints: ['probabilityOfSuccess', 'taxResidencyImpact', 'ihtDelta', 'drawdownMatrix'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.NMPA_2028, D.TAX_YEAR_END],
  },

  return_uk: {
    id: 'return_uk', category: 'Geographic', label: 'Return to UK from abroad',
    triggerPhrases: ['returning to UK', 'moving back to UK', 'coming back to England', 'repatriating', 'back to Britain'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['taxResidencyImpact', 'allowanceTracker', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END, D.ISA_ANNUAL],
  },

  dual_residence: {
    id: 'dual_residence', category: 'Geographic', label: 'Dual residence / split year',
    triggerPhrases: ['dual residence', 'split year', 'statutory residence test', 'non-dom', 'two countries', 'part year UK', 'split year treatment'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['taxResidencyImpact', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END],
  },

  buy_home_abroad: {
    id: 'buy_home_abroad', category: 'Geographic', label: 'Buy a home abroad (to live in)',
    triggerPhrases: ['buy a home abroad to live in', 'emigrate and buy', 'moving abroad and buying property', 'permanent move abroad'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX],
    chartHints: ['currencyRisk', 'cashflowDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.CGT_ANNUAL, D.SIPP_IHT_2027],
  },

  domicile_change: {
    id: 'domicile_change', category: 'Geographic', label: 'Change of domicile',
    triggerPhrases: ['change domicile', 'domicile of choice', 'non-dom status', 'acquire UK domicile', 'lose UK domicile', 'domicile planning'],
    requiredContext: [E.FQ, E.TAX],
    chartHints: ['ihtDelta', 'taxResidencyImpact'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.TAX_YEAR_END, D.SIPP_IHT_2027],
  },

  // ── HEALTH (5) ─────────────────────────────────────────────────────────────

  long_illness: {
    id: 'long_illness', category: 'Health', label: 'Long-term illness',
    triggerPhrases: ['long-term illness', 'serious illness', 'sick leave', 'health condition affecting work', 'chronic illness', 'ill health'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['cashflowRunway', 'protectionAdequacy', 'emergencyFundMonths'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.TAX_YEAR_END],
  },

  disability: {
    id: 'disability', category: 'Health', label: 'New disability',
    triggerPhrases: ['disability', 'disabled', 'permanent disability', 'becoming disabled', 'disability benefit'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['protectionAdequacy', 'cashflowRunway', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.TAX_YEAR_END, D.SIPP_IHT_2027],
  },

  capacity_loss: {
    id: 'capacity_loss', category: 'Health', label: 'Mental capacity concern / LPA',
    triggerPhrases: ['mental capacity', 'dementia concern', 'lasting power of attorney', 'LPA', 'losing capacity', 'power of attorney'],
    requiredContext: [E.FQ, E.TAX],
    chartHints: ['willStatus', 'lpaStatus', 'beneficiaryChain'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.SIPP_IHT_2027],
  },

  terminal_diagnosis: {
    id: 'terminal_diagnosis', category: 'Health', label: 'Terminal diagnosis',
    triggerPhrases: ['terminal illness', 'terminal diagnosis', 'life-limiting illness', 'end of life planning', 'not much time'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['ihtExposure', 'giftClock', 'beneficiaryChain', 'liquidityDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.GIFT_7YR, D.TAX_YEAR_END],
  },

  care_home_move: {
    id: 'care_home_move', category: 'Health', label: 'Move to care home',
    triggerPhrases: ['care home', 'residential care', 'moving to a care home', 'care fees', 'nursing home', 'social care funding'],
    requiredContext: [E.FQ, E.CASHFLOW, E.TAX, E.RISK],
    chartHints: ['careFeesProjection', 'ihtDelta', 'cashflowRunway', 'equityReleased'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.SIPP_IHT_2027, D.GIFT_7YR],
  },

  // ── TAX/ESTATE (8) ─────────────────────────────────────────────────────────

  budget_response: {
    id: 'budget_response', category: 'Tax/Estate', label: 'Respond to Budget / tax change',
    triggerPhrases: ['budget response', 'respond to the budget', 'tax change planning', 'new rules', 'Finance Act', 'autumn statement'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['incomeTaxDelta', 'ihtDelta', 'allowanceTracker'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.TAX_YEAR_END, D.SIPP_IHT_2027, D.PENSION_AA],
  },

  isa_use: {
    id: 'isa_use', category: 'Tax/Estate', label: 'Use ISA allowance strategically',
    triggerPhrases: ['ISA allowance', 'use my ISA', 'ISA strategy', 'stocks and shares ISA', 'cash ISA', 'max my ISA'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['isaAllowance', 'taxDrag', 'netWorthDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.ISA_ANNUAL, D.ISA_CASH_SUB, D.TAX_YEAR_END],
  },

  pension_aa_use: {
    id: 'pension_aa_use', category: 'Tax/Estate', label: 'Maximise pension annual allowance',
    triggerPhrases: ['pension annual allowance', 'maximise pension', 'pension contribution', 'carry forward pension', 'salary sacrifice', 'pension top-up'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['pensionAAUsed', 'incomeTaxDelta', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.PENSION_AA, D.TAX_YEAR_END, D.SIPP_IHT_2027],
  },

  cgt_crystallise: {
    id: 'cgt_crystallise', category: 'Tax/Estate', label: 'Crystallise / defer capital gains',
    triggerPhrases: ['crystallise gains', 'CGT planning', 'capital gains', 'bed and ISA', 'bed and SIPP', 'realise gains', 'harvest losses'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['cgtExposure', 'netWorthDelta', 'taxDrag'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.CGT_ANNUAL, D.TAX_YEAR_END],
  },

  iht_planning: {
    id: 'iht_planning', category: 'Tax/Estate', label: 'IHT planning',
    triggerPhrases: ['inheritance tax', 'IHT planning', 'reduce inheritance tax', 'estate planning', 'gifting strategy', 'IHT exposure', 'reduce estate'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW, E.TIMELINE],
    chartHints: ['ihtExposure', 'giftClock', 'ihtWaterfall', 'costOfInaction'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'medium',
    defaultDeadlines: [D.SIPP_IHT_2027, D.GIFT_7YR, D.TAX_YEAR_END],
  },

  write_will: {
    id: 'write_will', category: 'Tax/Estate', label: 'Write or update a Will',
    triggerPhrases: ['write a will', 'update will', 'make a will', 'no will', 'intestacy', 'update my will', 'who gets my money'],
    requiredContext: [E.FQ, E.TAX],
    chartHints: ['willStatus', 'beneficiaryChain', 'intestacyDistribution', 'ihtDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [D.SIPP_IHT_2027],
  },

  setup_lpa: {
    id: 'setup_lpa', category: 'Tax/Estate', label: 'Set up Lasting Power of Attorney',
    triggerPhrases: ['power of attorney', 'LPA', 'lasting power of attorney', 'attorney for finances', 'attorney for health', 'set up LPA'],
    requiredContext: [E.FQ, E.TAX],
    chartHints: ['lpaStatus', 'willStatus'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },

  setup_trust: {
    id: 'setup_trust', category: 'Tax/Estate', label: 'Set up a trust',
    triggerPhrases: ['set up a trust', 'discretionary trust', 'bare trust', 'trust for children', 'family trust', 'create a trust'],
    requiredContext: [E.FQ, E.TAX, E.CASHFLOW],
    chartHints: ['ihtDelta', 'trustPeriodicCharge', 'giftClock'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'high',
    defaultDeadlines: [D.GIFT_7YR, D.SIPP_IHT_2027, D.TAX_YEAR_END],
  },

  // ── PROTECTION (5) ─────────────────────────────────────────────────────────

  buy_life: {
    id: 'buy_life', category: 'Protection', label: 'Buy life insurance',
    triggerPhrases: ['life insurance', 'life cover', 'term assurance', 'whole of life', 'death in service', 'protect my family'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['protectionAdequacy', 'ihtDelta', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },

  buy_ci: {
    id: 'buy_ci', category: 'Protection', label: 'Buy critical illness cover',
    triggerPhrases: ['critical illness', 'CI cover', 'critical illness insurance', 'serious illness cover'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['protectionAdequacy', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },

  buy_ip: {
    id: 'buy_ip', category: 'Protection', label: 'Buy income protection',
    triggerPhrases: ['income protection', 'IP insurance', 'income protection insurance', 'protect my salary', 'PHI'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['protectionAdequacy', 'cashflowRunway'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },

  buy_pmi: {
    id: 'buy_pmi', category: 'Protection', label: 'Buy private medical insurance',
    triggerPhrases: ['private medical insurance', 'PMI', 'health insurance', 'BUPA', 'private health cover', 'Vitality'],
    requiredContext: [E.FQ, E.CASHFLOW],
    chartHints: ['cashflowDelta', 'monthlySurplus'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },

  review_cover: {
    id: 'review_cover', category: 'Protection', label: 'Review existing protection cover',
    triggerPhrases: ['review my insurance', 'review protection', 'am I over-insured', 'am I under-insured', 'protection review', 'check my cover'],
    requiredContext: [E.FQ, E.CASHFLOW, E.RISK],
    chartHints: ['protectionAdequacy', 'cashflowDelta'],
    fcaJurisdiction: 'UK', irreversibilityBaseline: 'low',
    defaultDeadlines: [],
  },
};
// Total: 60 events (8+10+10+8+6+5+8+5 = 60) ✓

/**
 * Match a free-text query to the closest ontology event(s).
 * Pure function — no LLM, no async.
 * Returns [{event, score, confidence, offOntology}] sorted by score descending.
 */
export function matchEvent(query, topN = 3) {
  const q = query.toLowerCase();
  const scores = Object.values(EVENTS).map(event => {
    let score = 0;

    // id match (underscore → space)
    if (q.includes(event.id.replace(/_/g, ' '))) score += 100;
    // label match
    if (q.includes(event.label.toLowerCase())) score += 80;
    // trigger phrase matches
    for (const phrase of event.triggerPhrases) {
      const p = phrase.toLowerCase();
      if (q.includes(p)) score += 50;
      else {
        // partial word overlap
        const words = p.split(' ').filter(w => w.length > 3);
        const matched = words.filter(w => q.includes(w));
        score += matched.length * 10;
      }
    }
    // category keyword match
    if (q.includes(event.category.toLowerCase())) score += 20;

    return { event, score };
  });

  const positive = scores.filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (positive.length === 0) {
    const fallback = [...scores].sort((a, b) => b.score - a.score)[0];
    return [{
      event: fallback?.event ?? Object.values(EVENTS)[0],
      score: 0, confidence: 'LOW', offOntology: true,
    }];
  }

  const maxScore = positive[0].score;
  return positive.map(({ event, score }) => ({
    event, score,
    confidence: score >= 80 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    offOntology: false,
  }));
}

/**
 * Union requiredContext + defaultDeadlines + chartHints from N events.
 * Used by multi-event compound mode.
 */
export function mergeEventContexts(eventIds) {
  const events = eventIds.map(id => EVENTS[id]).filter(Boolean);
  if (events.length === 0) return { requiredContext: [], defaultDeadlines: [], chartHints: [], irreversibilityBaseline: 'low' };

  const irrOrder = { low: 0, medium: 1, high: 2 };
  return {
    requiredContext:       [...new Set(events.flatMap(e => e.requiredContext))],
    defaultDeadlines:     [...new Set(events.flatMap(e => e.defaultDeadlines))],
    chartHints:           [...new Set(events.flatMap(e => e.chartHints))],
    irreversibilityBaseline: events.reduce(
      (max, e) => irrOrder[e.irreversibilityBaseline] > irrOrder[max] ? e.irreversibilityBaseline : max,
      'low'
    ),
  };
}

/** Returns all event IDs grouped by category. */
export function eventsByCategory() {
  return Object.values(EVENTS).reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e.id);
    return acc;
  }, {});
}
