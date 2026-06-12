// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — CLASSIFIER
//
// Maps free-text user query → weighted concerns + resources at stake +
// active constraints. Two-pass:
//   1. Deterministic keyword/regex pass — fast, predictable, always tried.
//   2. (Future) LLM fallback for novel queries.
//
// For the IFA demo we ship pass 1 only — deterministic on known queries,
// graceful generic-match on unknown. Adding LLM pass later does not break
// any existing behaviour because it is fallback-only.
// ─────────────────────────────────────────────────────────────────────────────

import { CONCERNS, RESOURCES } from './ontology.js'

// Each entry: { match: regex, concerns: { id: weight }, resources_at_stake: [], constraints: [] }
const RULES = [
  // ── Retirement & drawdown ────────────────────────────────────────────────
  {
    match: /retir|drawdown|stop work|step back|stop working/i,
    concerns: { [CONCERNS.RETIREMENT]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.8, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /withdraw|take out|\bdraw[\s-]?down\b|\bdraw \d|\bdraw £?\d|live off|live on|extract.{0,15}(?:income|cash|money)|access.{0,15}(?:pension|sipp|isa)/i,
    concerns: { [CONCERNS.RETIREMENT]: 0.8, [CONCERNS.TAX]: 0.7, [CONCERNS.INCOME_SECURITY]: 0.7 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /tax-free cash|tfc|25%|pension lump sum|crystallise|crystallize/i,
    concerns: { [CONCERNS.TAX]: 0.9, [CONCERNS.RETIREMENT]: 0.8 },
    resources: [RESOURCES.PENSION],
  },

  // ── IHT & estate ─────────────────────────────────────────────────────────
  {
    match: /iht|inherit|estate tax|death tax|pass(?:ing)? on|legacy|kids inherit|grandchildren/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.PROPERTY, RESOURCES.GIA],
  },
  {
    match: /gift|gifting|give\b.{0,30}(?:children|kids|grandchildren|charity|family|son|daughter|niece|nephew)|pass(?:ing)? (?:on |wealth|money|down)/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 0.95, [CONCERNS.FAMILY_CHANGE]: 0.3 },
    resources: [RESOURCES.CASH, RESOURCES.GIA, RESOURCES.ISA],
  },
  // Pre-2027 PRESERVATION signal — requires intent words alongside the date
  {
    match: /(?:before|prior to|ahead of|by) (?:april )?2027|protect.{0,20}(?:sipp|pension|estate)|preserve.{0,20}(?:sipp|pension|estate)|sipp.*iht|finance act 2026|pension.*estate.*before/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 1.0, [CONCERNS.REGULATORY]: 1.0 },
    resources: [RESOURCES.PENSION],
  },

  // ── Relocation ───────────────────────────────────────────────────────────
  {
    match: /relocat|emigrat|move (?:abroad|overseas)|moving (?:abroad|overseas)|leaving uk|leave (?:the )?uk|portugal|dubai|uae|spain|kenya|australia|nhr|ific|fig/i,
    concerns: {
      [CONCERNS.RELOCATION]: 1.0,
      [CONCERNS.TAX]: 0.5,
      [CONCERNS.LIFESTYLE]: 0.8,
      [CONCERNS.HEALTHCARE]: 0.6,
      [CONCERNS.CURRENCY]: 0.5,
    },
    resources: [RESOURCES.PROPERTY, RESOURCES.PENSION, RESOURCES.ISA],
  },

  // ── Family change ────────────────────────────────────────────────────────
  {
    match: /divor|separat|split (?:from|with)|break.*up|breakup/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.7, [CONCERNS.IHT_LEGACY]: 0.4 },
    resources: [RESOURCES.PENSION, RESOURCES.PROPERTY, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /marry|getting married|cohabit|living together|not married|unmarried|partner.{0,30}(?:not married|unmarried)|engaged/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.PROTECTION]: 0.5 },
    resources: [],
  },
  {
    match: /baby|child|expecting|new(?:born)? kid|having a kid/i,
    concerns: { [CONCERNS.FAMILY_CHANGE]: 0.9, [CONCERNS.EDUCATION]: 0.6, [CONCERNS.PROTECTION]: 0.7 },
    resources: [],
  },

  // ── Business ─────────────────────────────────────────────────────────────
  {
    match: /sell (?:my |the )?business|exit (?:my )?business|business sale|company sale|bade?r|investors? relief/i,
    concerns: { [CONCERNS.BUSINESS_EXIT]: 1.0, [CONCERNS.TAX]: 0.9, [CONCERNS.RETIREMENT]: 0.5 },
    resources: [RESOURCES.BUSINESS],
  },

  // ── Protection ───────────────────────────────────────────────────────────
  {
    match: /life cover|life insurance|critical illness|income protection|protect (?:my )?family/i,
    concerns: { [CONCERNS.PROTECTION]: 1.0, [CONCERNS.FAMILY_CHANGE]: 0.5 },
    resources: [],
  },

  // ── Cash / deposits / savings (sub-intent routed) ─────────────────────────
  {
    match: /bed.?and.?sipp|bed.?&.?sipp|sipp.{0,10}my cash|move cash.{0,15}sipp/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_BEDSIPP]: 1.0, [CONCERNS.TAX]: 0.5 },
    resources: [RESOURCES.CASH, RESOURCES.PENSION],
  },
  {
    match: /isa.{0,10}(?:is )?full|full.{0,10}isa|used.{0,10}(?:my )?isa.{0,10}(?:allowance|this year)|isa.{0,10}allowance.{0,10}(?:used|full)|maxed.{0,10}isa/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_BEYOND_ISA]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.GIA, RESOURCES.PENSION, RESOURCES.ISA],
  },
  {
    match: /psa|personal savings allowance|interest.{0,10}tax(?:ed|able)?|tax.{0,10}on.{0,10}(?:savings|interest)/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_PSA]: 1.0, [CONCERNS.TAX]: 0.8 },
    resources: [RESOURCES.CASH, RESOURCES.ISA],
  },
  {
    match: /gilt|treasury (?:bond|stock)|government bond/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_GILTS]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /money market|mmf|cash isa|where (?:should|to) (?:i )?(?:hold|keep|put).{0,15}cash|best.{0,10}(?:home|place).{0,10}(?:for )?cash/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_SHELTER]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.ISA, RESOURCES.GIA],
  },
  {
    match: /rates?.{0,15}(?:drop|fall|fell|fallen|cut|lower)|savings? rate.{0,15}(?:drop|fall|down|lower)|cash.{0,15}(?:yield|return).{0,10}(?:drop|fall|low)/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.CASH_RATEDROP]: 1.0, [CONCERNS.TAX]: 0.3 },
    resources: [RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /how much cash|cash.{0,10}(?:should|do) i (?:keep|hold)|emergency fund|rainy day|keep.{0,10}liquid|how.{0,10}liquid/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.CASH_BUFFER]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.5 },
    resources: [RESOURCES.CASH],
  },
  {
    match: /fixed deposit|fd.{0,5}matur|term deposit|cash account|savings account|cash.{0,15}(?:matur|reinvest|deploy|sitting)|maturing.{0,15}(?:deposit|cash|account)|deposits? matur|what.{0,10}do with.{0,15}(?:cash|deposit)|deploy.{0,15}cash/i,
    concerns: { [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.CASH_DEPLOY]: 1.0, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.CASH, RESOURCES.ISA, RESOURCES.GIA],
  },

  // ── Tax (generic) ────────────────────────────────────────────────────────
  {
    match: /reduce (?:my )?tax|tax bill|tax planning|save tax|tax-efficient|isa|pension contribution|carry forward|annual allowance/i,
    concerns: { [CONCERNS.TAX]: 1.0 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA],
  },
  {
    match: /taper|tapered|losing (?:my )?personal allowance|60% marginal|(?:earn|income|salary).{0,20}(?:£?100k|£?100,000)/i,
    concerns: { [CONCERNS.TAX]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.4 },
    resources: [RESOURCES.PENSION, RESOURCES.EARNED_INCOME],
  },

  // ── Healthcare / care ────────────────────────────────────────────────────
  {
    match: /care home|nursing home|care fees|long-term care|dementia|care cost/i,
    concerns: { [CONCERNS.HEALTHCARE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.LIQUIDITY]: 0.6 },
    resources: [RESOURCES.PROPERTY, RESOURCES.PENSION, RESOURCES.CASH],
  },

  // ── Property ─────────────────────────────────────────────────────────────
  {
    match: /buy (?:a )?(?:second |another |bigger )?(?:house|home|property|flat)|downsiz|second home|btl|buy.to.let/i,
    concerns: { [CONCERNS.IHT_LEGACY]: 0.4, [CONCERNS.TAX]: 0.5, [CONCERNS.LIFESTYLE]: 0.7 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH, RESOURCES.GIA],
  },

  // ── Mortgage / debt (sub-intent routed so each query lands on the right play) ─
  {
    // Equity release FIRST — most specific (else "release equity" hits 'borrow')
    match: /equity release|lifetime mortgage|release equity|release.{0,10}cash.{0,10}home/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_EQUITY]: 1.0, [CONCERNS.IHT_LEGACY]: 0.3 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /offset mortgage|offset.{0,15}(?:savings|cash|account)|\boffset\b/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_OFFSET]: 1.0, [CONCERNS.LIQUIDITY]: 0.4 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },
  {
    match: /overpay|pay off.{0,20}(?:mortgage|loan|debt)|clear.{0,15}(?:mortgage|debt)|mortgage.{0,10}or invest|invest.{0,10}(?:or|vs).{0,15}mortgage/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_OVERPAY]: 1.0, [CONCERNS.LIQUIDITY]: 0.3 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH, RESOURCES.GIA],
  },
  {
    match: /remortgage|re-mortgage|fixed rate|fixed or tracker|tracker|interest.only|repayment|how much can i borrow|borrow.{0,15}(?:with|on|income)|rate.{0,10}(?:ending|ends|expir)/i,
    concerns: { [CONCERNS.DEBT]: 0.6, [CONCERNS.DEBT_RATE]: 1.0 },
    resources: [RESOURCES.PROPERTY, RESOURCES.CASH],
  },

  // ── Business exit (sub-intent routed; specific terms before generic sale) ──
  {
    match: /investors?.?relief\b|investor's relief/i,
    concerns: { [CONCERNS.BUS_IR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /\beot\b|employee ownership|sell to (?:my )?(?:employees|staff|team)/i,
    concerns: { [CONCERNS.BUS_EOT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.5 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /wind(?:ing)? (?:down|up)|members.{0,5}voluntary liquidation|\bmvl\b|close (?:my |the )?company|strike off|dissolv/i,
    concerns: { [CONCERNS.BUS_MVL]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /earn.?out|deferred consideration|loan note/i,
    concerns: { [CONCERNS.BUS_EARNOUT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /\bbadr\b|business asset disposal|entrepreneurs.?relief/i,
    concerns: { [CONCERNS.BUS_BADR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /(?:extract|take).{0,15}(?:dividend|cash).{0,15}(?:or|vs).{0,15}(?:share|sell|capital)|dividend.{0,10}(?:or|vs).{0,10}(?:share|sell|capital)|dividends? or (?:sell |selling )?shares/i,
    concerns: { [CONCERNS.BUS_DIVCAP]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.4, [CONCERNS.TAX]: 0.7 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /exit.{0,15}(?:gradual|gradually|stage|phase|all at once|one go)|gradually or all|sell.{0,15}(?:gradual|stage|phase)/i,
    concerns: { [CONCERNS.BUS_EXIT_SEQ]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.6, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.BUSINESS],
  },
  {
    match: /sell (?:my |the )?business|exit (?:my )?business|business sale|company sale|sell.{0,10}(?:my )?(?:company|shares).{0,10}(?:structure|best)|best structure/i,
    concerns: { [CONCERNS.BUS_SALE]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.7, [CONCERNS.TAX]: 0.6 },
    resources: [RESOURCES.BUSINESS],
  },

  // ── Investment / portfolio (educational framing — never a recommendation) ──
  {
    match: /esg|ethical (?:fund|invest)|sustainab|responsible invest|impact invest/i,
    concerns: { [CONCERNS.INV_ESG]: 1.0, [CONCERNS.TAX]: 0.2 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /emerging market|developing market|\bem\b.{0,12}(?:alloc|risk|expos|worth)/i,
    concerns: { [CONCERNS.INV_EM]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /\bter\b|fund (?:fee|cost|charge)|paying too much|fees? (?:on|too)|ongoing charge|ocf/i,
    concerns: { [CONCERNS.INV_FEES]: 1.0, [CONCERNS.TAX]: 0.2 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /passive|index fund|active fund|actively managed|active manage|move to passive/i,
    concerns: { [CONCERNS.INV_PASSIVE]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /concentrat|single stock|one stock|too much in one|all in one|overweight.{0,10}(?:stock|share)/i,
    concerns: { [CONCERNS.INV_CONCENTRATION]: 1.0, [CONCERNS.TAX]: 0.4 },
    resources: [RESOURCES.GIA, RESOURCES.ISA],
  },
  {
    match: /rebalanc|out of balance|drifted|portfolio.{0,10}drift/i,
    concerns: { [CONCERNS.INV_REBALANCE]: 1.0 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },
  {
    match: /allocat|asset mix|asset.?allocation|how (?:should|do) i (?:invest|split).{0,20}(?:portfolio|£|money)|portfolio.{0,10}(?:mix|split)|invest (?:my )?£?\d/i,
    concerns: { [CONCERNS.INV_ALLOCATION]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.3 },
    resources: [RESOURCES.GIA, RESOURCES.ISA, RESOURCES.PENSION],
  },

  // ── Time freedom / FIRE ──────────────────────────────────────────────────
  {
    match: /sabbatical|career break|fire(?:\s|$)|financial independence|part.time|four.day|stop working early/i,
    concerns: { [CONCERNS.TIME_FREEDOM]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.8, [CONCERNS.RETIREMENT]: 0.4 },
    resources: [RESOURCES.PENSION, RESOURCES.ISA, RESOURCES.GIA, RESOURCES.CASH],
  },
]

// Query-implied facts: when the user states a life situation directly, we
// can derive a fact override that the matcher should treat as fresher than
// the static persona profile. E.g. "I'm getting divorced" implies
// marital_status='divorcing' even if profile says 'married'.
const IMPLIED_FACTS = [
  { match: /divor|separat|split (?:from|with)|break(?:ing)? up/i,            fact: 'marital_status',     value: 'divorcing' },
  { match: /getting married|engaged to|wedding/i,                            fact: 'marital_status',     value: 'getting_married' },
  { match: /cohabit|living together|not married|unmarried|partner.{0,30}(?:not married|unmarried)/i, fact: 'marital_status', value: 'cohabiting' },
  { match: /relocat|emigrat|move abroad|move overseas|leaving the uk/i,       fact: 'relocation_planned', value: true },
  { match: /just (?:arrived|moved) to (?:the )?uk|new to (?:the )?uk/i,       fact: 'recent_arrival_uk',  value: true },
  { match: /with (?:my )?kids|with (?:my )?children|kids? coming|kids? mov/i, fact: 'kids_moving',        value: true },
  { match: /relying on nhs|on chemo|ongoing treatment|chronic/i,             fact: 'healthcare_reliance',value: true },
]

export function deriveImpliedFacts(query) {
  const q = query || ''
  const out = {}
  for (const rule of IMPLIED_FACTS) {
    if (rule.match.test(q)) out[rule.fact] = rule.value
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT — what is the user trying to DO?
// Drives the self-critique guard in the synthesizer. Mutually exclusive plays
// (preserve_pension vs draw_pension) must not collide on the same intent.
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_RULES = [
  { id: 'draw',        match: /\bdraw[\s-]?down\b|\bdraw \d|\bdraw £?\d|withdraw|take.{0,15}(?:out|from|cash|income)|live (?:on|off)|income from|spend (?:my )?(?:pension|sipp|isa)|need.{0,15}(?:income|cash)|how.{0,15}(?:do|can|to).{0,20}(?:get|extract|access).{0,15}(?:income|cash|money)|\bfrom april|extract.{0,15}(?:income|cash|money)/i },
  { id: 'preserve',    match: /preserve|protect|shield|shelter|keep.{0,15}(?:out of|away from)|reduce.{0,15}(?:iht|tax|estate)|legacy|pass.{0,15}(?:on|down|to)|leave.{0,15}(?:to|behind|for)|before (?:april )?2027/i },
  { id: 'restructure', match: /restructur|rebalanc|switch|move.{0,15}(?:into|to|across)|sell.{0,15}(?:and|then)|change my (?:mix|allocation|portfolio)|simpler|consolidat/i },
  { id: 'plan',        match: /plan|prepare|think about|considering|might|maybe|should i|what if|exploring/i },
]

export function deriveIntent(query) {
  const q = query || ''
  for (const rule of INTENT_RULES) {
    if (rule.match.test(q)) return rule.id
  }
  return 'plan'  // default — exploratory
}

// Per-play "intent type" — which intents this play is appropriate for.
// Used by synthesizer self-critique. If query intent = 'draw' but lead's
// intent_type = 'preserve', the lead is wrong and must be demoted.
export const PLAY_INTENT = {
  // Drawdown plays
  phase_tfc:                     ['draw'],
  split_sipp_spouse:             ['draw'],
  isa_topup_during_drawdown:     ['draw'],
  defer_state_pension:           ['draw', 'plan'],
  mpaa_avoidance:                ['draw', 'plan'],
  // Preservation plays — must NOT fire for 'draw' intent
  preserve_pension_pre_2027:     ['preserve'],
  // IHT plays
  surplus_income_gifting:        ['preserve', 'plan'],
  aim_bpr:                       ['preserve', 'restructure'],
  charity_10pct_iht:             ['preserve', 'plan'],
  lasting_poa:                   ['plan'],
  // Relocation
  srt_day_count_discipline:      ['plan', 'restructure'],
  fig_window_utilise:            ['restructure', 'draw'],
  destination_cost_reality_check:['plan'],
  healthcare_continuity_plan:    ['plan'],
  schooling_continuity_plan:     ['plan'],
  iht_tail_post_departure:       ['plan', 'preserve'],
  // Family
  cohab_ip_gap:                  ['preserve', 'plan'],
  will_revocation_on_marriage:   ['plan'],
  pension_sharing_divorce:       ['plan', 'restructure'],
  // Tax
  taper_pension_relief:          ['restructure', 'plan'],
  bed_and_isa:                   ['restructure', 'preserve'],
  // Healthcare / protection
  care_fee_buffer:               ['plan', 'preserve'],
  income_protection_gap:         ['plan'],
  // W6 — mortgage / cash / investment plays (valid across the action intents so
  // "switch to passive", "move into an offset" etc. aren't filtered out)
  overpay_vs_invest:             ['plan', 'restructure'],
  remortgage_review:             ['plan', 'restructure'],
  offset_mortgage:               ['plan', 'restructure'],
  equity_release_caution:        ['plan', 'restructure'],
  mmf_vs_cash_isa:               ['plan', 'restructure'],
  isa_full_next_steps:           ['plan', 'restructure'],
  bed_and_sipp:                  ['plan', 'restructure', 'preserve'],
  cash_yield_drop:               ['plan', 'restructure'],
  portfolio_allocation_factors:  ['plan', 'restructure'],
  fund_fee_review:               ['plan', 'restructure'],
  passive_vs_active:             ['plan', 'restructure'],
  concentration_risk:            ['plan', 'restructure', 'preserve'],
  rebalancing_discipline:        ['plan', 'restructure'],
  emerging_markets_role:         ['plan', 'restructure'],
  esg_investing:                 ['plan', 'restructure'],
}

/**
 * Classify a free-text query into structured concerns + resources.
 *
 * @param {string} query   User's natural-language question
 * @returns {{
 *   concerns: Record<string, number>,
 *   resources_at_stake: string[],
 *   raw_matches: string[],
 *   off_ontology: boolean,
 *   implied_facts: Record<string, any>,
 * }}
 */
export function classify(query) {
  const q = (query || '').trim()
  if (!q) return { concerns: {}, resources_at_stake: [], raw_matches: [], off_ontology: true }

  const concerns = {}
  const resources = new Set()
  const matches = []

  for (const rule of RULES) {
    if (rule.match.test(q)) {
      matches.push(rule.match.source)
      for (const [concern, weight] of Object.entries(rule.concerns)) {
        concerns[concern] = Math.max(concerns[concern] || 0, weight)
      }
      for (const r of rule.resources) resources.add(r)
    }
  }

  // If nothing matched, mark off-ontology — synthesizer can offer generic + advise
  const offOntology = Object.keys(concerns).length === 0

  // Normalise concerns to [0, 1]
  // (already are — we use max not sum — but explicit)

  return {
    concerns,
    resources_at_stake: Array.from(resources),
    raw_matches: matches,
    off_ontology: offOntology,
    implied_facts: deriveImpliedFacts(q),
    intent: deriveIntent(q),
  }
}

/**
 * Helper — top N concerns by weight.
 */
export function topConcerns(classification, n = 3) {
  return Object.entries(classification.concerns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, w]) => ({ id, weight: w }))
}
