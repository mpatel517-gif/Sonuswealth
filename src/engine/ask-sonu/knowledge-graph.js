// ─────────────────────────────────────────────────────────────────────────────
// ASK SONU — KNOWLEDGE GRAPH
//
// Expert-authored plays. Each play is a finite, citable recommendation
// pattern. The system composes them per-query — it does NOT invent them.
//
// Structure:
//   id              unique stable ID
//   title           plain English, headline
//   one_liner       what Sonu would actually say (the lead, distilled)
//   detail          fuller explanation, 2-3 sentences
//   triggers        which concerns this play addresses
//   weight          per-concern relevance (0-1)
//   prerequisites   facts about user that must be true (or unknown) for play to apply
//   counter_indications  facts that disqualify
//   needs_fact      facts that would discriminate this play vs alternatives
//   compute_impact  (persona) => { gbp_saved, time_horizon, certainty, why }
//   citation        legal / regulatory reference
//   category        tax_pension | iht | investment | protection | relocation | family | healthcare | lifestyle
//   alternatives    [{ value_shift, alt_play }] — for "challenge me" panel
//   fca_boundary    standard FCA-info-not-advice line (rendered with every play)
// ─────────────────────────────────────────────────────────────────────────────

import { CONCERNS, RESOURCES, FACTS } from './ontology.js'

const FCA = 'Information not advice. Personal circumstances vary — confirm with a regulated adviser before acting.'

// Helper getters with defensive fallbacks
const num = (v) => {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.reduce((s, x) => s + num(x?.value ?? x?.currentValue ?? x), 0)
  if (typeof v === 'object') return num(v.value ?? v.currentValue ?? v.total ?? 0)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const ageOf = (p) => {
  const dob = p?.dob || p?.birthYear
  if (!dob) return p?.age || 50
  if (typeof dob === 'number') return new Date().getFullYear() - dob
  return new Date().getFullYear() - new Date(dob).getFullYear()
}
const pensionPot   = (p) => num(p?.assets?.sipp) + num(p?.assets?.pensions) + num(p?.assets?.pension)
const isaPot       = (p) => num(p?.assets?.isa)
const giaPot       = (p) => num(p?.assets?.gia) + num(p?.assets?.investments)
const propertyVal  = (p) => num(p?.assets?.property) + num(p?.assets?.home)
const grossEstate  = (p) => pensionPot(p) + isaPot(p) + giaPot(p) + propertyVal(p) + num(p?.assets?.cash)
const fmt          = (n) => '£' + Math.round(n).toLocaleString('en-GB')

// ─────────────────────────────────────────────────────────────────────────────
// PLAYS — Retirement / Drawdown
// ─────────────────────────────────────────────────────────────────────────────

const PLAYS = [
  {
    id: 'phase_tfc',
    title: 'Phase your tax-free cash over 4 years',
    one_liner: 'Don\'t take all 25% upfront. Crystallise in tranches to keep your income below higher-rate bands.',
    detail: 'Phased crystallisation lets you draw the 25% tax-free cash gradually while the rest stays invested. Combined with personal allowance and ISA top-ups, this typically holds you in the 20% band for years.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.TAX, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.RETIREMENT]: 0.95, [CONCERNS.TAX]: 0.85, [CONCERNS.INCOME_SECURITY]: 0.7 },
    prerequisites: { min_age: 55, min_pension: 100000 },
    counter_indications: {},
    needs_fact: [FACTS.TARGET_INCOME, FACTS.SPOUSE_PENSION, FACTS.SPENDING_PATTERN],
    compute_impact: (p) => {
      const pot = pensionPot(p)
      const tfc = Math.min(pot * 0.25, 268275)
      const annualTfc = tfc / 4
      const taxSaved = annualTfc * 0.20  // Rough: keeps you out of 40% on the bridged years
      return {
        gbp_saved: Math.round(taxSaved * 4),
        time_horizon: '4 years',
        certainty: 'high',
        why: `Your pension pot is ${fmt(pot)}. Phasing the ${fmt(tfc)} TFC across 4 years (${fmt(annualTfc)}/yr) keeps your marginal rate in the 20% band — likely saving around ${fmt(taxSaved * 4)} in tax vs taking the full 25% upfront.`,
      }
    },
    citation: 'FA 2004 s.166; PTM063210 (UFPLS / FAD)',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'simplicity over optimisation', alt_play: 'lump_sum_tfc' },
      { value_shift: 'legacy over income', alt_play: 'preserve_pension_pre_2027' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'split_sipp_spouse',
    title: 'Split drawdown with your spouse',
    one_liner: 'Use both your personal allowances and basic-rate bands instead of one — typically saves £6-12k a year.',
    detail: 'If your spouse has unused personal allowance and basic-rate band, drawing some income through their pension or via spousal ISA transfers doubles the tax-free zone (£25,140) and the 20% band.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.TAX],
    weight:   { [CONCERNS.RETIREMENT]: 0.85, [CONCERNS.TAX]: 0.95 },
    prerequisites: { marital_status: ['married', 'civil_partnership'] },
    counter_indications: {},
    needs_fact: [FACTS.SPOUSE_PENSION, FACTS.MARITAL_STATUS],
    compute_impact: (p) => {
      const spousePot = num(p?.spouse?.pension) || num(p?.spouse_pension_capital) || 0
      const haveSpouse = (p?.maritalStatus || p?.marital_status || '').toLowerCase().match(/married|partner/)
      if (!haveSpouse) {
        return { gbp_saved: 0, certainty: 'n/a', why: 'No spouse on file — this play does not apply.' }
      }
      const annualSaving = 25140 * 0.20  // PA + basic-rate fill from spouse
      return {
        gbp_saved: Math.round(annualSaving),
        time_horizon: 'annual, ongoing',
        certainty: 'high',
        why: `Splitting income across both allowances uses ${fmt(25140)} of tax-free + basic-rate band that would otherwise be wasted. About ${fmt(annualSaving)} a year saved.`,
      }
    },
    citation: 'ITA 2007 s.35-36 (personal allowance); FA 1996 s.156 (spousal ISA transfer)',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'control over splitting', alt_play: 'solo_drawdown_with_carry' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'isa_topup_during_drawdown',
    title: 'Top up your ISA from pension drawdown',
    one_liner: 'Move taxed pension income into ISA wrapper — future withdrawals are then fully tax-free.',
    detail: 'Once you\'ve drawn taxable pension income, recycling up to £20k a year into an ISA puts it back inside a tax-free wrapper. Within 5 years you have a meaningful tax-free income stream.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.TAX, CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.RETIREMENT]: 0.7, [CONCERNS.TAX]: 0.8, [CONCERNS.IHT_LEGACY]: 0.5 },
    prerequisites: { min_age: 55 },
    counter_indications: {},
    needs_fact: [FACTS.SPENDING_PATTERN],
    compute_impact: (p) => {
      const isaContrib = 20000
      const lifetimeGrowthTaxAvoided = isaContrib * 5 * 0.20  // 5yrs of CGT/income avoided on growth
      return {
        gbp_saved: Math.round(lifetimeGrowthTaxAvoided),
        time_horizon: '5+ years',
        certainty: 'medium',
        why: `Recycling ${fmt(20000)}/yr into ISA over 5 years shields growth from CGT/income tax forever. Indicative lifetime tax saved: ~${fmt(lifetimeGrowthTaxAvoided)}.`,
      }
    },
    citation: 'ITTOIA 2005 Pt 6 Ch 3 (ISA wrapper); HMRC ISAM',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'spend now over compound later', alt_play: 'spend_drawdown_in_full' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'defer_state_pension',
    title: 'Defer State Pension for 5.8% uplift',
    one_liner: 'Each year deferred adds 5.8% inflation-linked income for life — beats most annuity rates.',
    detail: 'Deferring State Pension past SPA (currently 66) gives a permanent 5.8% increase per year of deferral. Only worth it if you have other income to live on AND expect average longevity.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.RETIREMENT]: 0.7, [CONCERNS.INCOME_SECURITY]: 0.85 },
    prerequisites: { min_age: 60, max_age: 70 },
    counter_indications: { health_status: ['poor', 'serious'] },
    needs_fact: [FACTS.HEALTH_STATUS, FACTS.TARGET_INCOME],
    compute_impact: () => {
      const fullSp = 11502
      const upliftPerYear = fullSp * 0.058
      return {
        gbp_saved: Math.round(upliftPerYear * 20),  // 20 yrs of higher income
        time_horizon: 'lifetime',
        certainty: 'medium',
        why: `Full State Pension is ${fmt(fullSp)}/yr. Deferring 1 year adds ${fmt(upliftPerYear)}/yr for life — ~${fmt(upliftPerYear * 20)} over 20 years post-deferral.`,
      }
    },
    citation: 'Pensions Act 2014 s.17 (deferment uplift)',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'cash now over income later', alt_play: 'take_state_pension_immediately' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'preserve_pension_pre_2027',
    title: 'Preserve SIPP for legacy — until April 2027',
    one_liner: 'Pension is currently outside your IHT estate. From April 2027 it joins. Time-limited window.',
    detail: 'Today, a SIPP passes to beneficiaries free of IHT (income tax if you die after 75). From April 2027 (Finance Act 2026), SIPPs enter the IHT estate. Draw from ISA/GIA first to preserve the pre-2027 advantage.',
    triggers: [CONCERNS.IHT_LEGACY, CONCERNS.REGULATORY, CONCERNS.RETIREMENT],
    weight:   { [CONCERNS.IHT_LEGACY]: 0.95, [CONCERNS.REGULATORY]: 1.0, [CONCERNS.RETIREMENT]: 0.6 },
    prerequisites: { min_pension: 200000 },
    counter_indications: {},
    needs_fact: [FACTS.AGE, FACTS.TARGET_INCOME],
    compute_impact: (p) => {
      const pot = pensionPot(p)
      const ihtPotential = pot * 0.40
      return {
        gbp_saved: Math.round(ihtPotential),
        time_horizon: 'until April 2027',
        certainty: 'high',
        why: `Your pension is ${fmt(pot)}. Until April 2027 it's IHT-free; post-2027 a 40% charge applies to amounts above your nil-rate band. Preserving it now and drawing from ISA/GIA first protects up to ${fmt(ihtPotential)} from IHT.`,
      }
    },
    citation: 'FA 2026 s.99 (SIPP IHT inclusion from April 2027)',
    category: 'iht',
    alternatives: [
      { value_shift: 'income now over legacy later', alt_play: 'spend_pension_first' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'mpaa_avoidance',
    title: 'Avoid triggering MPAA if you still contribute',
    one_liner: 'Drawing flexibly cuts your annual allowance from £60k to £10k. Use UFPLS-only or PCLS-only to preserve.',
    detail: 'Once you take taxable income via flexi-access drawdown, your annual allowance for future contributions drops permanently to £10k (MPAA). If you\'re still earning or want to top up, draw only the tax-free element or use small-pot rules.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.TAX],
    weight:   { [CONCERNS.RETIREMENT]: 0.6, [CONCERNS.TAX]: 0.8 },
    prerequisites: { min_age: 55, work_status: ['employed', 'self_employed', 'part_time'] },
    counter_indications: { work_status: ['retired'] },
    needs_fact: [FACTS.WORK_STATUS],
    compute_impact: (p) => {
      const allowance_lost = 50000  // £60k - £10k
      const taxSaved = allowance_lost * 0.40  // assume HR
      return {
        gbp_saved: Math.round(taxSaved),
        time_horizon: 'per year of continued earning',
        certainty: 'high',
        why: `If you trigger MPAA you lose ${fmt(50000)} of annual allowance — worth ~${fmt(taxSaved)} of tax relief per year while you're still contributing.`,
      }
    },
    citation: 'FA 2017 s.7 (MPAA reduction); PTM056510',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'flexibility over allowance', alt_play: 'accept_mpaa_trigger' },
    ],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — IHT / Legacy
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'surplus_income_gifting',
    title: 'Use the surplus-income gift exemption',
    one_liner: 'Regular gifts from surplus income leave your estate immediately — no 7-year wait.',
    detail: 'IHTA 1984 s.21: gifts made out of regular surplus income (not capital) are exempt from IHT from day one, provided they\'re habitual, from income, and don\'t affect your standard of living. The cleanest legacy tool there is.',
    triggers: [CONCERNS.IHT_LEGACY, CONCERNS.FAMILY_CHANGE],
    weight:   { [CONCERNS.IHT_LEGACY]: 0.95, [CONCERNS.FAMILY_CHANGE]: 0.5 },
    prerequisites: { min_age: 45 },
    counter_indications: {},
    needs_fact: [FACTS.TARGET_INCOME, FACTS.GIFT_AMOUNT, FACTS.GIFT_RECIPIENT],
    compute_impact: (p) => {
      const estate = grossEstate(p)
      const nrb = 325000 + (p?.has_main_residence ? 175000 : 0)
      const taxableEstate = Math.max(0, estate - nrb)
      const sample = Math.min(taxableEstate, 12000 * 10) // 10yrs of £1k/mo
      return {
        gbp_saved: Math.round(sample * 0.40),
        time_horizon: 'immediate and ongoing',
        certainty: 'high',
        why: `Your taxable estate is around ${fmt(taxableEstate)}. £1,000/month of habitual gifting from surplus income leaves your estate immediately — a 10-year programme saves ~${fmt(sample * 0.40)} in IHT.`,
      }
    },
    citation: 'IHTA 1984 s.21 (normal expenditure out of income)',
    category: 'iht',
    alternatives: [
      { value_shift: 'lump-sum gift now', alt_play: 'pet_7yr_gift' },
      { value_shift: 'keep control', alt_play: 'discretionary_trust' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'aim_bpr',
    title: 'AIM portfolio with Business Property Relief',
    one_liner: 'AIM shares held 2+ years are 100% IHT-free. Higher risk but the IHT shield is real.',
    detail: 'Qualifying AIM shares held for 2 years receive 100% BPR — they pass IHT-free regardless of size. Volatility is much higher than mainstream equities; treat as a portion of the equity allocation, not core.',
    triggers: [CONCERNS.IHT_LEGACY, CONCERNS.TAX],
    weight:   { [CONCERNS.IHT_LEGACY]: 0.9, [CONCERNS.TAX]: 0.5 },
    prerequisites: { min_estate: 600000, min_age: 50 },
    counter_indications: { risk_tolerance: ['low'] },
    needs_fact: [FACTS.RISK_TOLERANCE, FACTS.TIME_HORIZON],
    compute_impact: (p) => {
      const estate = grossEstate(p)
      const allocation = Math.min(estate * 0.10, 300000)  // 10% suggestion, cap £300k
      const ihtSaved = allocation * 0.40
      return {
        gbp_saved: Math.round(ihtSaved),
        time_horizon: '2 years to qualify, then immediate IHT shield',
        certainty: 'medium',
        why: `Allocating ${fmt(allocation)} (about 10% of estate) to qualifying AIM after 2-year hold removes ${fmt(ihtSaved)} from IHT exposure. Volatility risk is real — sized as satellite, not core.`,
      }
    },
    citation: 'IHTA 1984 s.105 (Business Property Relief)',
    category: 'iht',
    alternatives: [
      { value_shift: 'avoid AIM volatility', alt_play: 'discretionary_trust' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'charity_10pct_iht',
    title: 'Charity 10% rule — drop IHT rate from 40% to 36%',
    one_liner: 'Leave 10%+ of your net estate to charity, the rest is taxed at 36% not 40%.',
    detail: 'IHTA 1984 Sch 1A: if 10% or more of the net estate above the nil-rate bands goes to charity, the remaining estate IHT rate drops to 36%. Often the heirs receive MORE because of the rate cut.',
    triggers: [CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.IHT_LEGACY]: 0.85 },
    prerequisites: { min_estate: 500000 },
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => {
      const estate = grossEstate(p)
      const nrb = 325000 + (p?.has_main_residence ? 175000 : 0)
      const taxable = Math.max(0, estate - nrb)
      const ihtAt40 = taxable * 0.40
      const charityGift = taxable * 0.10
      const ihtAt36 = (taxable - charityGift) * 0.36
      const netSaving = ihtAt40 - (ihtAt36 + charityGift)
      return {
        gbp_saved: Math.round(Math.max(0, netSaving)),
        time_horizon: 'on death',
        certainty: 'high',
        why: `On a taxable estate of ${fmt(taxable)}: full-rate IHT is ${fmt(ihtAt40)}. With 10% (${fmt(charityGift)}) to charity, IHT becomes ${fmt(ihtAt36)} — net to heirs broadly unchanged but a meaningful charitable gift made.`,
      }
    },
    citation: 'IHTA 1984 Sch 1A (reduced rate)',
    category: 'iht',
    alternatives: [
      { value_shift: 'keep all wealth in family', alt_play: 'standard_will' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'lasting_poa',
    title: 'Lasting Power of Attorney — both types',
    one_liner: 'Without an LPA, if you lose capacity your family needs a court order to access your money. Costs ~£82 each.',
    detail: 'Two LPAs needed: Property & Financial Affairs + Health & Welfare. Set up while you have capacity. Without them, the Court of Protection process costs £4,000+ and takes 6-12 months.',
    triggers: [CONCERNS.IHT_LEGACY, CONCERNS.FAMILY_CHANGE, CONCERNS.HEALTHCARE],
    weight:   { [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.FAMILY_CHANGE]: 0.7, [CONCERNS.HEALTHCARE]: 0.8 },
    prerequisites: { min_age: 50 },
    counter_indications: {},
    needs_fact: [],
    compute_impact: () => ({
      gbp_saved: 4000,
      time_horizon: 'one-off; protection lasts lifetime',
      certainty: 'high',
      why: 'Cost: 2 × £82 = £164. Avoids Court of Protection deputyship costs of £4,000+ if capacity is lost. Equally important: your spouse can manage your accounts immediately, not after a 6-month process.',
    }),
    citation: 'Mental Capacity Act 2005 s.9-14',
    category: 'iht',
    alternatives: [],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Relocation (non-financial too)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'srt_day_count_discipline',
    title: 'Lock down Statutory Residence Test day-counting',
    one_liner: 'UK tax residence is mechanical — count days, count ties. Track from day one.',
    detail: 'FA 2013 Sch 45. As a leaver, >16 UK days breaks automatic non-residence. Use a tracking app, log every UK day (midnight rule), record family/accommodation/work ties. Monthly review.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.TAX, CONCERNS.REGULATORY],
    weight:   { [CONCERNS.RELOCATION]: 0.95, [CONCERNS.TAX]: 0.7, [CONCERNS.REGULATORY]: 0.8 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.RELOCATION_DEST, FACTS.TIME_HORIZON],
    compute_impact: () => ({
      gbp_saved: 50000,
      time_horizon: 'ongoing',
      certainty: 'high',
      why: 'Accidental UK residence triggers worldwide income/gains tax — easily £30-100k of avoidable tax for an HNW individual leaving with foreign income. Tracking has no downside, only upside.',
    }),
    citation: 'FA 2013 Sch 45; HMRC RDR3',
    category: 'relocation',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'fig_window_utilise',
    title: 'Use the 4-year FIG window if you\'re new to the UK',
    one_liner: 'Foreign income & gains arising in years 1-4 of UK residence stay UK-tax-free if not remitted.',
    detail: 'FA 2025 replaced the remittance basis with the Foreign Income & Gains regime. Years 1-4 of UK residence, foreign income and gains kept offshore are UK-tax-free. Sequence foreign realisations inside the window.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.TAX, CONCERNS.REGULATORY],
    weight:   { [CONCERNS.RELOCATION]: 0.95, [CONCERNS.TAX]: 0.95 },
    prerequisites: { recent_arrival_uk: true },
    counter_indications: {},
    needs_fact: [FACTS.JURISDICTION],
    compute_impact: () => ({
      gbp_saved: 60000,
      time_horizon: '4-year window from arrival',
      certainty: 'high',
      why: 'For a new UK arrival with £500k of foreign unrealised gains, FIG window can save the full ~£100k CGT charge if structured correctly.',
    }),
    citation: 'FA 2025 (FIG regime)',
    category: 'relocation',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'destination_cost_reality_check',
    title: 'PPP-adjusted cost of living — reality check vs your target',
    one_liner: 'Headline "20% cheaper" rarely means 20% cheaper for your lifestyle. Check your actual basket.',
    detail: 'Country averages mislead — your basket (international schools, imported food, healthcare, housing in expat-friendly suburbs) often runs at 1.3-1.8× the national average. Build a real budget from comparable cities, not country averages.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.LIFESTYLE, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.RELOCATION]: 0.85, [CONCERNS.LIFESTYLE]: 0.95, [CONCERNS.INCOME_SECURITY]: 0.7 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.RELOCATION_DEST, FACTS.KIDS_MOVING, FACTS.TARGET_INCOME],
    compute_impact: (p) => {
      const income = num(p?.income?.annual) || p?.target_income || 60000
      const expatPremium = 1.5
      const realityGap = income * 0.30
      return {
        gbp_saved: Math.round(realityGap),
        time_horizon: 'annual',
        certainty: 'medium',
        why: `Country-average cost data typically understates expat lifestyle cost by 30-50%. For your income target of ${fmt(income)}, build the budget bottom-up from your actual basket — schools, healthcare, housing, transport — not the headline index.`,
      }
    },
    citation: 'Numbeo / Mercer COL methodology; OECD PPP guidance',
    category: 'relocation_lifestyle',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'healthcare_continuity_plan',
    title: 'Map healthcare continuity before you move',
    one_liner: 'If anyone in the household relies on NHS care, plan the bridge before booking flights.',
    detail: 'Reciprocal arrangements have shrunk post-Brexit. For destinations outside the EHIC/GHIC network, private insurance for pre-existing conditions can be unaffordable or unavailable. Confirm continuity for every household member, not just yourself.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.HEALTHCARE, CONCERNS.PROTECTION],
    weight:   { [CONCERNS.RELOCATION]: 0.85, [CONCERNS.HEALTHCARE]: 0.95, [CONCERNS.PROTECTION]: 0.7 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.HEALTHCARE_RELIANCE, FACTS.RELOCATION_DEST],
    compute_impact: () => ({
      gbp_saved: 25000,
      time_horizon: 'one-off planning, lifetime impact',
      certainty: 'high',
      why: 'Unmanaged healthcare gap is the single most common reason expats return early. A continuity plan (insurer pre-quoted, treatment provider identified, prescriptions sourceable) typically costs £500 to assemble and avoids £10k-£50k of bridge costs.',
    }),
    citation: 'NHS overseas treatment guidance; GHIC/EHIC reciprocal lists',
    category: 'relocation_lifestyle',
    alternatives: [],
    fca_boundary: 'Information not advice. Confirm cover specifics with a regulated medical insurance broker.',
  },

  {
    id: 'schooling_continuity_plan',
    title: 'School-fit before location-fit',
    one_liner: 'For dependent kids, school availability decides which suburb works — not the other way round.',
    detail: 'International school waiting lists in Lisbon, Dubai, Singapore can run 12-18 months. Curriculum continuity (IB / GCSE / A-level) matters for university transfer. Decide schools first, then location.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.EDUCATION, CONCERNS.FAMILY_CHANGE],
    weight:   { [CONCERNS.RELOCATION]: 0.85, [CONCERNS.EDUCATION]: 1.0, [CONCERNS.FAMILY_CHANGE]: 0.7 },
    prerequisites: { kids_moving: true },
    counter_indications: { kids_moving: false },
    needs_fact: [FACTS.KIDS_MOVING, FACTS.KIDS_AGES],
    compute_impact: () => ({
      gbp_saved: 0,
      time_horizon: 'critical path: 12-18 months ahead',
      certainty: 'high',
      why: 'School availability is the single biggest constraint on expat suburb choice. Apply early — waiting lists for top international schools commonly exceed 12 months.',
    }),
    citation: 'COBIS / IB / Cambridge international school directories',
    category: 'relocation_lifestyle',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'iht_tail_post_departure',
    title: 'IHT applies to you for 10 years after you leave the UK',
    one_liner: 'The Finance Act 2025 extended the IHT departure tail from 3 to 10 years. Your worldwide estate stays UK-IHT-exposed.',
    detail: 'Until 10 years of continuous non-residence have elapsed, your worldwide estate remains liable to UK IHT at 40%. Plan as if you\'re still UK-resident for IHT purposes for a decade.',
    triggers: [CONCERNS.RELOCATION, CONCERNS.IHT_LEGACY, CONCERNS.REGULATORY],
    weight:   { [CONCERNS.RELOCATION]: 0.8, [CONCERNS.IHT_LEGACY]: 0.95, [CONCERNS.REGULATORY]: 0.9 },
    prerequisites: { relocation_planned: true },
    counter_indications: {},
    needs_fact: [FACTS.RELOCATION_DEST, FACTS.TIME_HORIZON],
    compute_impact: (p) => {
      const estate = grossEstate(p)
      const exposure = estate * 0.40
      return {
        gbp_saved: 0,
        time_horizon: '10 years from departure',
        certainty: 'high',
        why: `Your estate of ${fmt(estate)} retains UK IHT exposure of up to ${fmt(exposure)} for 10 years after leaving. Estate restructuring (gifting, trusts, AIM BPR) before departure is more effective than after.`,
      }
    },
    citation: 'FA 2025 (10-year IHT tail)',
    category: 'relocation',
    alternatives: [],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Family change
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cohab_ip_gap',
    title: 'Cohabiting couples have no spousal IHT exemption',
    one_liner: 'If you\'re not married, on first death the survivor pays 40% IHT above £325k. Marriage or trust planning closes the gap.',
    detail: 'Unmarried cohabitants do not benefit from IHTA 1984 s.18 spousal exemption. A £1m estate passing to a cohabiting partner generates ~£270k IHT. Three options: marry, use life insurance written in trust, or restructure ownership.',
    triggers: [CONCERNS.FAMILY_CHANGE, CONCERNS.IHT_LEGACY, CONCERNS.PROTECTION],
    weight:   { [CONCERNS.FAMILY_CHANGE]: 0.95, [CONCERNS.IHT_LEGACY]: 1.0, [CONCERNS.PROTECTION]: 0.7 },
    prerequisites: { marital_status: ['cohabiting', 'partner'] },
    counter_indications: { marital_status: ['married', 'civil_partnership'] },
    needs_fact: [FACTS.MARITAL_STATUS],
    compute_impact: (p) => {
      const estate = grossEstate(p)
      const exposure = Math.max(0, estate - 325000) * 0.40
      return {
        gbp_saved: Math.round(exposure),
        time_horizon: 'on first death',
        certainty: 'high',
        why: `Your estate is ${fmt(estate)}. Without the spousal exemption, the survivor faces up to ${fmt(exposure)} of IHT. Marriage closes this with one signature.`,
      }
    },
    citation: 'IHTA 1984 s.18 (transfers between spouses); contrast with s.18(2) exclusion',
    category: 'family',
    alternatives: [
      { value_shift: 'keep relationship informal', alt_play: 'life_cover_in_trust' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'will_revocation_on_marriage',
    title: 'Marriage revokes your existing will',
    one_liner: 'Unless your will expressly contemplates the marriage, it\'s void from the wedding day.',
    detail: 'Wills Act 1837 s.18: marriage automatically revokes a prior will (unless expressly made in contemplation). Update before or immediately after the ceremony or you die intestate.',
    triggers: [CONCERNS.FAMILY_CHANGE, CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.FAMILY_CHANGE]: 0.95, [CONCERNS.IHT_LEGACY]: 0.7 },
    prerequisites: { marital_status: ['engaged', 'getting_married'] },
    counter_indications: {},
    needs_fact: [],
    compute_impact: () => ({
      gbp_saved: 0,
      time_horizon: 'critical before ceremony',
      certainty: 'high',
      why: 'A revoked will means intestacy rules apply — your spouse takes the first £322k + half the residue, the rest goes to children. Often not what you intended.',
    }),
    citation: 'Wills Act 1837 s.18',
    category: 'family',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'pension_sharing_divorce',
    title: 'Pension Sharing Orders are often the most valuable asset',
    one_liner: 'In long marriages, the pension is frequently worth more than the house. Don\'t accept offsetting without valuing it properly.',
    detail: 'A CETV captures only the actuarial transfer value, not the underlying benefit (especially DB schemes). Insist on a Pension on Divorce Expert (PODE) report. Offset deals favour the keeper of the pension.',
    triggers: [CONCERNS.FAMILY_CHANGE, CONCERNS.RETIREMENT, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.FAMILY_CHANGE]: 1.0, [CONCERNS.RETIREMENT]: 0.85, [CONCERNS.INCOME_SECURITY]: 0.8 },
    prerequisites: { marital_status: ['divorcing', 'separating'] },
    counter_indications: {},
    needs_fact: [FACTS.MARITAL_STATUS],
    compute_impact: () => ({
      gbp_saved: 80000,
      time_horizon: 'one-off (financial order)',
      certainty: 'medium',
      why: 'PODE valuations typically uplift CETV-only valuations by 20-40% for DB schemes — material for the financially weaker spouse.',
    }),
    citation: 'WRPA 1999 s.27-51 (pension sharing); Matrimonial Causes Act 1973 s.21A',
    category: 'family',
    alternatives: [],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Tax (general)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'taper_pension_relief',
    title: 'Bonus → pension to dodge the £100k taper',
    one_liner: 'Between £100k and £125,140 your effective marginal rate is 60%. Salary-sacrifice into pension reverses it.',
    detail: 'Personal allowance withdrawal at £1 per £2 over £100k creates a 60% marginal rate band. Pension contribution from gross salary (salary sacrifice) restores the allowance pound-for-pound.',
    triggers: [CONCERNS.TAX, CONCERNS.RETIREMENT],
    weight:   { [CONCERNS.TAX]: 1.0, [CONCERNS.RETIREMENT]: 0.5 },
    prerequisites: { income_band: 'taper_zone' },
    counter_indications: { age: { min: 75 } },
    needs_fact: [],
    compute_impact: () => ({
      gbp_saved: 7556,  // ~60% of £12,570 PA
      time_horizon: 'this tax year',
      certainty: 'high',
      why: '£12,570 personal allowance saved at 60% effective rate = ~£7,556 of tax. Plus full higher-rate relief on the contribution itself.',
    }),
    citation: 'ITA 2007 s.35; FA 2009 s.4 (taper)',
    category: 'tax_pension',
    alternatives: [],
    fca_boundary: FCA,
  },

  {
    id: 'bed_and_isa',
    title: 'Bed-and-ISA your GIA holdings',
    one_liner: 'Sell £20k from GIA, re-buy inside ISA. Future growth is tax-free.',
    detail: 'Use the annual CGT allowance (£3k) and ISA subscription (£20k) together. Over 5 years, £100k of GIA can migrate into ISA — and stay there.',
    triggers: [CONCERNS.TAX, CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.TAX]: 0.85, [CONCERNS.IHT_LEGACY]: 0.4 },
    prerequisites: { min_gia: 20000 },
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => {
      const gia = giaPot(p)
      const migrate = Math.min(gia, 20000)
      const lifetime = migrate * 0.20  // 20yrs * 1% growth tax avoided
      return {
        gbp_saved: Math.round(lifetime),
        time_horizon: 'annual + compounding',
        certainty: 'medium',
        why: `You have ${fmt(gia)} in GIA. Migrating ${fmt(migrate)} this year (and next) shifts taxable growth to tax-free — ~${fmt(lifetime)} of lifetime tax avoided per tranche.`,
      }
    },
    citation: 'TCGA 1992 s.2 (annual exempt amount); ITTOIA 2005 ISA wrapper',
    category: 'tax_pension',
    alternatives: [],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Healthcare / care
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'care_fee_buffer',
    title: 'Set up a care-fee buffer outside your home equity',
    one_liner: 'Local Authority threshold is £23,250. Below that, the state pays. Above, all your assets including your home (if no partner) are in scope.',
    detail: 'Residential care costs £45-60k/year. Nursing care £55-75k. Planning the funding source before the need arises avoids forced asset sales and preserves spouse position.',
    triggers: [CONCERNS.HEALTHCARE, CONCERNS.IHT_LEGACY, CONCERNS.LIQUIDITY],
    weight:   { [CONCERNS.HEALTHCARE]: 0.9, [CONCERNS.IHT_LEGACY]: 0.6, [CONCERNS.LIQUIDITY]: 0.7 },
    prerequisites: { min_age: 60 },
    counter_indications: {},
    needs_fact: [FACTS.HEALTH_STATUS, FACTS.MARITAL_STATUS],
    compute_impact: () => ({
      gbp_saved: 180000,
      time_horizon: '3-year average residential stay',
      certainty: 'medium',
      why: 'Average residential care cost £45k × 3 years = £135k. Nursing care can reach £180k. Cap on personal contributions of £86k from October 2025 reform — partial protection, not full.',
    }),
    citation: 'Care Act 2014 (means testing); 2014 reform cap',
    category: 'healthcare',
    alternatives: [],
    fca_boundary: FCA,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Protection
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'income_protection_gap',
    title: 'Income protection — the cover most people skip',
    one_liner: 'You\'re 4x more likely to be unable to work than to die before 65. Yet most have life cover, not IP.',
    detail: 'IP replaces 60-70% of gross income if illness/injury stops you working. Costs ~£30-60/month for £3-5k monthly benefit. Far more financially material than life cover for working-age earners with no dependents.',
    triggers: [CONCERNS.PROTECTION, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.PROTECTION]: 0.95, [CONCERNS.INCOME_SECURITY]: 0.8 },
    prerequisites: { work_status: ['employed', 'self_employed'], min_age: 25, max_age: 60 },
    counter_indications: {},
    needs_fact: [FACTS.WORK_STATUS, FACTS.DEPENDENTS],
    compute_impact: (p) => {
      const income = num(p?.income?.annual) || 50000
      const benefit = income * 0.65
      const annualCost = 600
      return {
        gbp_saved: Math.round(benefit * 5),
        time_horizon: 'up to retirement',
        certainty: 'high',
        why: `For ${fmt(income)} income, target IP benefit is ${fmt(benefit)} a year. Premium ~${fmt(annualCost)}/yr. If you can't work for 5 years, the cover is worth ~${fmt(benefit * 5)}.`,
      }
    },
    citation: 'FCA ICOBS; ABI IP statistics',
    category: 'protection',
    alternatives: [],
    fca_boundary: 'Information not advice. Compare cover terms via a regulated IP broker.',
  },
]

export { PLAYS }

export function getAllPlays() {
  return PLAYS
}

export function getPlayById(id) {
  return PLAYS.find(p => p.id === id)
}
