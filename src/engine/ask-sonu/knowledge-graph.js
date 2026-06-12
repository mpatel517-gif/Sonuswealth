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
import { maritalStatus } from '../persona-helpers.js'

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
    detail: 'If your spouse has unused personal allowance and basic-rate band, drawing some income through their pension — or moving income-producing assets into their name (transfers between spouses are exempt from capital gains tax) — uses both sets of allowances instead of one, roughly doubling the tax-free zone (£25,140) and the 20% band.',
    triggers: [CONCERNS.RETIREMENT, CONCERNS.TAX],
    weight:   { [CONCERNS.RETIREMENT]: 0.85, [CONCERNS.TAX]: 0.95 },
    prerequisites: { marital_status: ['married', 'civil_partnership'] },
    counter_indications: {},
    needs_fact: [FACTS.SPOUSE_PENSION, FACTS.MARITAL_STATUS],
    compute_impact: (p) => {
      const spousePot = num(p?.spouse?.pension) || num(p?.spouse_pension_capital) || 0
      const haveSpouse = maritalStatus(p).isCouple
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
    citation: 'ITA 2007 s.35 (personal allowance); independent taxation of spouses; TCGA 1992 s.58 (no gain/no loss on inter-spouse transfers)',
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
      const fullSp = 12547.60 // 2026/27 full new State Pension (was stale £11,502)
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
    triggers: [CONCERNS.TAX_TAPER, CONCERNS.TAX, CONCERNS.RETIREMENT],
    weight:   { [CONCERNS.TAX_TAPER]: 1.0, [CONCERNS.TAX]: 0.6, [CONCERNS.RETIREMENT]: 0.5 },
    prerequisites: {},
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
    triggers: [CONCERNS.TAX_BEDISA, CONCERNS.TAX, CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.TAX_BEDISA]: 1.0, [CONCERNS.TAX]: 0.6, [CONCERNS.IHT_LEGACY]: 0.4 },
    prerequisites: {},
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

  // ── Tax domain — new plays (W6) ─────────────────────────────────────────────
  {
    id: 'salary_sacrifice_pension',
    title: 'Salary sacrifice into your pension',
    one_liner: 'Swapping salary for an employer pension contribution saves income tax AND National Insurance — often a bigger boost than a personal contribution.',
    detail: 'With salary sacrifice you agree a lower salary and your employer pays the difference into your pension. Because the money never counts as your salary, you save both income tax and employee NI on it — and many employers add their NI saving too. It is usually more efficient than contributing from taxed pay. Watch that sacrificing below the National Minimum Wage isn\'t allowed, and that a lower salary can affect mortgage borrowing and some benefits.',
    triggers: [CONCERNS.TAX_SALSAC, CONCERNS.TAX, CONCERNS.RETIREMENT],
    weight: { [CONCERNS.TAX_SALSAC]: 1.0, [CONCERNS.TAX]: 0.6, [CONCERNS.RETIREMENT]: 0.4 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => {
      const income = num(p?.income?.annual) || num(p?.income) || 0
      const niRate = income > 50270 ? 0.02 : 0.08
      return { gbp_saved: 0, time_horizon: 'this tax year, recurring', certainty: 'high',
        why: `Salary sacrifice saves income tax at your marginal rate PLUS employee NI (about ${Math.round(niRate*100)}% on your band) — and often the employer's NI saving too. More efficient than contributing from taxed pay.` }
    },
    citation: 'ITEPA 2003 (salary sacrifice); NIC saving via SSCBA 1992',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'take-home now over relief', alt_play: 'taper_pension_relief' }],
    fca_boundary: FCA,
  },
  {
    id: 'carry_forward_aa',
    title: 'Carry forward unused pension allowance',
    one_liner: 'You can use up to three prior years\' unused annual allowance on top of this year\'s — useful for a one-off large contribution.',
    detail: 'If you haven\'t used your full pension annual allowance in the last three tax years, carry-forward lets you add the unused amounts to this year\'s allowance — handy after a bonus, business sale or inheritance. You must have been a pension scheme member in those years, and your contribution is still capped by your relievable earnings this year. The tapered allowance (for very high earners) and the MPAA (if you\'ve flexibly accessed a pension) can reduce or block it.',
    triggers: [CONCERNS.TAX_CARRYFWD, CONCERNS.TAX, CONCERNS.RETIREMENT],
    weight: { [CONCERNS.TAX_CARRYFWD]: 1.0, [CONCERNS.TAX]: 0.5, [CONCERNS.RETIREMENT]: 0.4 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'this tax year', certainty: 'depends',
      why: 'Carry-forward can add up to three years\' unused annual allowance to this year\'s — but you must have been a scheme member then, are still capped by this year\'s relievable earnings, and the taper/MPAA can limit it.' }),
    citation: 'FA 2004 s.228A (carry-forward of annual allowance)',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'spread over one-off', alt_play: 'salary_sacrifice_pension' }],
    fca_boundary: FCA,
  },
  {
    id: 'marriage_allowance',
    title: 'Marriage Allowance — transfer unused personal allowance',
    one_liner: 'If one spouse earns below the personal allowance and the other is a basic-rate taxpayer, transferring part of the allowance cuts the couple\'s tax.',
    detail: 'Marriage Allowance lets a non-taxpaying spouse transfer a fixed slice of their unused personal allowance to a basic-rate-taxpaying partner, reducing the couple\'s combined bill. Both must be married or in a civil partnership, the recipient must be a basic-rate taxpayer (it is not available if they pay higher rate), and you can backdate a claim up to four tax years. It is a small but free saving for eligible couples.',
    triggers: [CONCERNS.TAX_MARRIAGE, CONCERNS.TAX],
    weight: { [CONCERNS.TAX_MARRIAGE]: 1.0, [CONCERNS.TAX]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'per year + 4-yr backdate', certainty: 'depends',
      why: 'Marriage Allowance transfers part of a non-taxpayer\'s personal allowance to a basic-rate spouse — a free annual saving (backdatable four years) if you\'re married/civil partners and the recipient isn\'t a higher-rate taxpayer.' }),
    citation: 'ITA 2007 s.55A-55E (transferable tax allowance)',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'split income over allowance', alt_play: 'split_sipp_spouse' }],
    fca_boundary: FCA,
  },
  {
    id: 'cgt_realisation',
    title: 'Use your CGT annual exempt amount (and crystallise gains)',
    one_liner: 'Each tax year you can realise gains up to the annual exempt amount tax-free — "use it or lose it", and it can reset a holding\'s base cost.',
    detail: 'Everyone has a capital-gains annual exempt amount each year; gains within it are tax-free and the allowance can\'t be carried forward. Deliberately selling enough to realise gains up to the exemption ("crystallising") banks tax-free gains and resets your base cost higher, reducing future CGT — bed-and-ISA or bed-and-spouse repositions the holding afterwards. Beware the 30-day "bed and breakfast" rule if you simply re-buy the same asset personally.',
    triggers: [CONCERNS.TAX_CGT_REALISE, CONCERNS.TAX],
    weight: { [CONCERNS.TAX_CGT_REALISE]: 1.0, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'every tax year', certainty: 'high',
      why: 'The CGT annual exempt amount is use-it-or-lose-it. Realising gains up to it each year banks them tax-free and lifts your base cost, cutting future CGT — repositioning via ISA/spouse, and minding the 30-day re-purchase rule.' }),
    citation: 'TCGA 1992 s.1K (annual exempt amount), s.106A (30-day rule)',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'shelter over realise', alt_play: 'bed_and_isa' }],
    fca_boundary: FCA,
  },
  {
    id: 'eis_vct_relief',
    title: 'EIS / VCT — high-risk investing with tax relief',
    one_liner: 'EIS and VCTs offer income-tax relief (and other reliefs) for backing small companies — but they are high-risk and illiquid.',
    detail: 'Enterprise Investment Schemes and Venture Capital Trusts give income-tax relief on investments into small/early-stage companies, with further benefits (EIS: CGT deferral, loss relief, IHT relief after two years; VCT: tax-free dividends). The relief rates and limits have changed in recent Budgets, so check the current figures. Crucially, these are high-risk, illiquid investments with minimum holding periods — the tax relief should never be the only reason to invest, and they suit only those who can afford to lose the capital.',
    triggers: [CONCERNS.TAX_EIS_VCT, CONCERNS.TAX],
    weight: { [CONCERNS.TAX_EIS_VCT]: 1.0, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'min 3-5 year hold', certainty: 'depends',
      why: 'EIS/VCT give income-tax relief (rates/limits changed recently — check current) plus other reliefs, but are high-risk, illiquid and have minimum holding periods. The relief shouldn\'t be the sole reason — only for capital you can afford to lose.' }),
    citation: 'ITA 2007 Pt 5 (EIS), Pt 6 (VCT)',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'mainstream over high-risk', alt_play: 'portfolio_allocation_factors' }],
    fca_boundary: FCA,
  },
  {
    id: 'dividend_vs_salary_owner',
    title: 'Paying yourself: salary vs dividends from your company',
    one_liner: 'Most owner-directors take a small salary up to a NI/tax-efficient point, then dividends — but the gap has narrowed as dividend tax rose.',
    detail: 'The usual owner-director structure is a modest salary (enough to preserve State Pension qualifying years and use the personal allowance, around the NI thresholds) topped up with dividends, which carry no NI. The advantage has shrunk as dividend tax rates rose and the dividend allowance was cut, and dividends are paid from post-corporation-tax profit. The optimal split depends on current thresholds, your other income, and whether you also want pension contributions (employer pension is itself very tax-efficient). An accountant should set the exact figures each year.',
    triggers: [CONCERNS.TAX_DIV_SALARY, CONCERNS.TAX],
    weight: { [CONCERNS.TAX_DIV_SALARY]: 1.0, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'each tax year', certainty: 'depends',
      why: 'The classic mix is a small salary (around the NI thresholds, preserving State Pension years) plus dividends (no NI). The edge has narrowed as dividend tax rose; the optimal split depends on current thresholds and whether you also fund a pension — set it with an accountant yearly.' }),
    citation: 'ITTOIA 2005 (dividend taxation); SSCBA 1992 (NI); employer pension FA 2004',
    category: 'tax_pension',
    alternatives: [{ value_shift: 'pension over dividends', alt_play: 'salary_sacrifice_pension' }],
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

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYS — Cash deployment (state-aware)
  // These accept (persona, taxYearState) and adjust impact based on what's
  // ACTUALLY available, not a generic assumption.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'deploy_cash_isa_first',
    title: 'Move cash into your unused ISA allowance first',
    one_liner: 'Use this year\'s remaining ISA allowance before tax year end. Spouse\'s too if married.',
    detail: 'ISA wrapper shields growth from CGT and income tax forever. Each spouse has a £20k annual allowance — use it or lose it on 6 April. For larger cash positions, layer this with bed-and-ISA next year + a gilt ladder for the residual.',
    triggers: [CONCERNS.CASH_DEPLOY, CONCERNS.LIQUIDITY, CONCERNS.TAX, CONCERNS.IHT_LEGACY],
    weight:   { [CONCERNS.CASH_DEPLOY]: 1.0, [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.TAX]: 0.7, [CONCERNS.IHT_LEGACY]: 0.4 },
    prerequisites: { min_age: 18 },
    counter_indications: {},
    needs_fact: [FACTS.PURPOSE_OF_CASH, FACTS.ISA_USED_THIS_YEAR],
    compute_impact: (p, state) => {
      const isaRoom = state?.isa?.remaining || 20000
      const cash = (p?.assets?.cash || 0) + (p?.assets?.fixed_deposits || 0)
      const deployable = Math.min(isaRoom, cash)
      const lifetimeTaxSaved = deployable * 0.20  // ~20yr × 1% growth tax avoided
      return {
        gbp_saved: Math.round(lifetimeTaxSaved),
        time_horizon: state?.days_to_tax_year_end ? `${state.days_to_tax_year_end} days to tax year end` : 'this tax year',
        certainty: 'high',
        why: isaRoom > 0
          ? `You have £${isaRoom.toLocaleString()} of ISA allowance remaining this tax year. Of your £${cash.toLocaleString()} cash, the first £${deployable.toLocaleString()} should go into the ISA wrapper before 6 April — that's roughly £${Math.round(lifetimeTaxSaved).toLocaleString()} of lifetime tax avoided on growth.`
          : `Your ISA allowance for this year is fully used. First thing 6 April (new tax year), put £20,000 (each, if married) into a fresh ISA before deploying the rest.`,
      }
    },
    citation: 'ITTOIA 2005 Pt 6 Ch 3 (ISA wrapper); HMRC ISAM',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'liquidity over tax shielding', alt_play: 'emergency_fund_first' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'psa_optimisation',
    title: 'Check Personal Savings Allowance exposure on cash interest',
    one_liner: 'Above PSA (£1k basic / £500 higher / £0 additional), savings interest is taxable. Cash wrapper matters.',
    detail: 'Personal Savings Allowance covers the first £1,000 of savings interest (basic-rate), £500 (higher), £0 (additional). At 5% interest, basic-rate hits PSA at £20k cash; higher-rate at £10k. Above that, every £1 of interest is taxed at marginal rate. Wrapper migration (Cash ISA, gilts) becomes material.',
    triggers: [CONCERNS.CASH_PSA, CONCERNS.LIQUIDITY, CONCERNS.TAX],
    weight:   { [CONCERNS.CASH_PSA]: 1.0, [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.TAX]: 0.8 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.ISA_USED_THIS_YEAR],
    compute_impact: (p, state) => {
      const cash = (p?.assets?.cash || 0) + (p?.assets?.fixed_deposits || 0)
      const rate = 0.045  // assumed savings rate
      const interest = cash * rate
      const psaLimit = state?.psa?.remaining || 1000
      const taxable = Math.max(0, interest - psaLimit)
      const income = p?.income?.annual || 0
      const taxRate = income > 50270 ? 0.40 : 0.20
      const tax = taxable * taxRate
      return {
        gbp_saved: Math.round(tax),  // Save this if we migrate to wrappers
        time_horizon: 'this tax year, recurring',
        certainty: 'high',
        why: cash > 0
          ? `On £${cash.toLocaleString()} cash at ~4.5% interest, you'd earn ~£${Math.round(interest).toLocaleString()} of taxable interest. PSA covers £${psaLimit.toLocaleString()}; the remaining £${Math.round(taxable).toLocaleString()} is taxed at ${Math.round(taxRate*100)}% → ~£${Math.round(tax).toLocaleString()} tax. Migrating to Cash ISA / gilts wipes this out.`
          : 'No cash position to optimise.',
      }
    },
    citation: 'ITA 2007 s.12B (Personal Savings Allowance); HMRC SAIM',
    category: 'tax_pension',
    alternatives: [
      { value_shift: 'simplicity over optimisation', alt_play: 'deploy_cash_isa_first' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'emergency_fund_first',
    title: 'Hold 3-6 months of expenses liquid before deploying',
    one_liner: 'Money you might need in <6 months belongs in instant-access savings, not in markets or wrappers with redemption friction.',
    detail: 'Emergency fund = unanticipated essential expenses (job loss, boiler, car). Rule of thumb: 3 months expenses for dual-income employed; 6 months for single-income; 12 months for self-employed. Keep in an instant-access account paying competitive rate. Everything else can be deployed.',
    triggers: [CONCERNS.CASH_BUFFER, CONCERNS.LIQUIDITY, CONCERNS.INCOME_SECURITY, CONCERNS.PROTECTION],
    weight:   { [CONCERNS.CASH_BUFFER]: 1.0, [CONCERNS.LIQUIDITY]: 0.6, [CONCERNS.INCOME_SECURITY]: 0.6, [CONCERNS.PROTECTION]: 0.5 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.PURPOSE_OF_CASH, FACTS.WORK_STATUS],
    compute_impact: (p) => {
      const income = p?.income?.annual || 60000
      const monthlyExpenses = income * 0.6 / 12  // rough — 60% of gross goes to living
      const target = Math.round(monthlyExpenses * 6)
      const cash = (p?.assets?.cash || 0) + (p?.assets?.fixed_deposits || 0)
      const gap = Math.max(0, target - cash)
      return {
        gbp_saved: 0,
        time_horizon: 'before deploying any cash',
        certainty: 'high',
        why: `Target emergency fund: ~£${target.toLocaleString()} (6 months × estimated monthly expenses). You have £${cash.toLocaleString()} cash — ${gap > 0 ? `gap of £${gap.toLocaleString()}` : 'comfortably covered'}. Reserve this first, then deploy the surplus.`,
      }
    },
    citation: 'MAS (MoneyHelper) emergency fund guidance',
    category: 'protection',
    alternatives: [
      { value_shift: 'optimisation over caution', alt_play: 'deploy_cash_isa_first' },
    ],
    fca_boundary: FCA,
  },

  {
    id: 'gilt_ladder_for_dated_spend',
    title: 'Match a gilt ladder to known future spend',
    one_liner: 'For cash earmarked for a specific spend in 1-5 years, buy gilts maturing on/before that date. Tax-efficient + predictable.',
    detail: 'Direct gilts: coupons taxed at income rate, but capital gain on price appreciation is CGT-FREE (TCGA 1992 s.115). A short-dated low-coupon gilt held to maturity = predictable nominal return, mostly tax-free, with credit risk = HMG. Use the iShares UK Gilts 0-5y ETF for simplicity or buy specific maturities for date-matching.',
    triggers: [CONCERNS.CASH_GILTS, CONCERNS.LIQUIDITY, CONCERNS.TAX, CONCERNS.INCOME_SECURITY],
    weight:   { [CONCERNS.CASH_GILTS]: 1.0, [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.TAX]: 0.6, [CONCERNS.INCOME_SECURITY]: 0.6 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.PURPOSE_OF_CASH, FACTS.TIME_HORIZON_OF_CASH],
    compute_impact: (p) => {
      const cash = (p?.assets?.cash || 0) + (p?.assets?.fixed_deposits || 0)
      const income = p?.income?.annual || 0
      const taxRate = income > 50270 ? 0.40 : 0.20
      // CGT-free portion saved vs taxable deposit interest
      const yearsHeld = 3
      const annualSaving = cash * 0.035 * taxRate
      return {
        gbp_saved: Math.round(annualSaving * yearsHeld),
        time_horizon: '1-5 years (matched to spend date)',
        certainty: 'medium',
        why: cash > 0
          ? `On £${cash.toLocaleString()} held in dated gilts vs taxable deposits: ~£${Math.round(annualSaving).toLocaleString()}/yr saved on tax (gilt price gain is CGT-free under TCGA 1992 s.115). Over ${yearsHeld} years ≈ £${Math.round(annualSaving * yearsHeld).toLocaleString()}.`
          : 'No applicable cash position.',
      }
    },
    citation: 'TCGA 1992 s.115 (gilt CGT exemption); DMO UK gilt yields',
    category: 'investment',
    alternatives: [
      { value_shift: 'liquidity over yield', alt_play: 'emergency_fund_first' },
    ],
    fca_boundary: FCA,
  },

  // ── Lifestyle / time-freedom domain (W6) ────────────────────────────────────
  {
    id: 'sabbatical_funding',
    title: 'Funding a sabbatical or career break',
    one_liner: 'Bridge the income gap from accessible savings (cash, ISA, GIA) — not your pension — and mind the NI and pension-contribution pause.',
    detail: 'A planned break is a cashflow problem: cover the months without salary from instant-access cash and ISA/GIA, keeping enough emergency buffer on top. Leave the pension untouched (it is locked until 55/57 anyway and you want it compounding). Two quiet costs: a gap in National Insurance years (check your State Pension forecast — a voluntary Class 3 top-up may be worth it) and pausing employer pension contributions. Model the exact gap before you commit.',
    triggers: [CONCERNS.LIFE_SABBATICAL, CONCERNS.INCOME_SECURITY, CONCERNS.TIME_FREEDOM],
    weight: { [CONCERNS.LIFE_SABBATICAL]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.5, [CONCERNS.TIME_FREEDOM]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'the break period', certainty: 'depends',
      why: 'Fund the gap from accessible cash/ISA/GIA, keep an emergency buffer, and leave the pension compounding. Watch the NI-year gap (a voluntary top-up may help your State Pension) and the paused employer contributions.' }),
    citation: 'NI voluntary contributions (Class 3); pension access age (FA 2004)',
    category: 'lifestyle',
    alternatives: [{ value_shift: 'part-time over full break', alt_play: 'part_time_transition' }],
    fca_boundary: FCA,
  },
  {
    id: 'fire_planning',
    title: 'Planning for FIRE — and the 4% rule\'s limits',
    one_liner: 'The 4% rule is a useful starting point, but UK taxes, sequence risk, and the pre-57 pension-access gap mean it needs adapting.',
    detail: 'FIRE (financial independence, retire early) often anchors on the "4% rule" — roughly 25× your annual spend as a target pot. Treat it as a starting estimate, not a guarantee: it came from US data, ignores UK tax on withdrawals, and is vulnerable to a poor run of early returns (sequence risk). The UK-specific catch is access — pensions are locked until 55/57, so an early retiree needs an ISA/GIA "bridge" to live on until then. Build in flexibility to cut spending in bad years.',
    triggers: [CONCERNS.LIFE_FIRE, CONCERNS.TIME_FREEDOM, CONCERNS.RETIREMENT],
    weight: { [CONCERNS.LIFE_FIRE]: 1.0, [CONCERNS.TIME_FREEDOM]: 0.5, [CONCERNS.RETIREMENT]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [FACTS.TARGET_INCOME],
    compute_impact: (p) => {
      const target = num(p?.targetIncome) || num(p?.target_income) || 0
      const pot = target > 0 ? target * 25 : 0
      return { gbp_saved: 0, time_horizon: 'multi-decade', certainty: 'depends',
        why: target > 0
          ? `As a rough FIRE anchor, ~25× your ${fmt(target)} target spend ≈ ${fmt(pot)} — but adjust for UK tax, sequence risk, and the need for an ISA/GIA bridge before pension access at 55/57.`
          : 'The 4% rule (≈25× spend) is a starting estimate only — adjust for UK tax, sequence-of-returns risk, and the ISA/GIA bridge needed before pensions unlock at 55/57.' }
    },
    citation: 'Bengen / Trinity 4% studies (US-derived); pension access age FA 2004',
    category: 'lifestyle',
    alternatives: [{ value_shift: 'flexibility over fixed rule', alt_play: 'early_retirement_bridge' }],
    fca_boundary: FCA,
  },
  {
    id: 'part_time_transition',
    title: 'Going part-time — modelling the cashflow',
    one_liner: 'Dropping days lowers income but often your tax rate too; keep pension contributions going and check the net, not gross, drop.',
    detail: 'Reducing hours is a softer alternative to stopping work. The income drop is partly cushioned because losing your top slice of pay removes income taxed at your highest rate — so the net fall is smaller than the gross. Keep some pension contribution flowing (employer match especially), check the reduced salary still clears your essential outgoings plus a buffer, and consider topping up income from ISA/GIA if there is a short gap.',
    triggers: [CONCERNS.LIFE_PARTTIME, CONCERNS.INCOME_SECURITY, CONCERNS.TIME_FREEDOM],
    weight: { [CONCERNS.LIFE_PARTTIME]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.5, [CONCERNS.TIME_FREEDOM]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'ongoing', certainty: 'depends',
      why: 'The net income drop is smaller than the gross because you lose your most-highly-taxed slice first. Keep pension contributions (and the employer match) going, and check the reduced pay still covers essentials plus a buffer.' }),
    citation: 'Income tax band structure (ITA 2007); auto-enrolment (Pensions Act 2008)',
    category: 'lifestyle',
    alternatives: [{ value_shift: 'full break over part-time', alt_play: 'sabbatical_funding' }],
    fca_boundary: FCA,
  },
  {
    id: 'early_retirement_bridge',
    title: 'Retiring early — bridging the years before your pensions unlock',
    one_liner: 'The hard part of early retirement is funding the gap before pension access (55/57) and State Pension (≈67) from ISAs, GIA and cash.',
    detail: 'Retiring several years early is mainly a sequencing problem. Pensions are locked until normal minimum pension age (55, rising to 57 in 2028) and the State Pension starts around 67, so the bridge years must be funded from ISAs, a GIA, and cash. The plan: size the bridge (years × annual spend), hold it in accessible, lower-volatility assets so a market dip doesn\'t force selling at the worst time, then let pensions take over once they unlock. Test it against a poor-early-returns scenario.',
    triggers: [CONCERNS.LIFE_EARLY_RET, CONCERNS.RETIREMENT, CONCERNS.INCOME_SECURITY],
    weight: { [CONCERNS.LIFE_EARLY_RET]: 1.0, [CONCERNS.RETIREMENT]: 0.6, [CONCERNS.INCOME_SECURITY]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [FACTS.TARGET_INCOME],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'the bridge years', certainty: 'depends',
      why: 'Early retirement hinges on funding the years before pensions unlock (55/57) and State Pension (~67) from ISA/GIA/cash. Size the bridge (years × spend), hold it in accessible lower-volatility assets, then let pensions take over.' }),
    citation: 'Pension access age (FA 2004, NMPA 57 from 2028); State Pension age (Pensions Act 2014)',
    category: 'lifestyle',
    alternatives: [{ value_shift: 'work longer over bridge', alt_play: 'part_time_transition' }],
    fca_boundary: FCA,
  },

  // ── Property domain (W6) — UK property tax, rates kept qualitative ──────────
  {
    id: 'downsize_home',
    title: 'Downsizing your home — what it frees and what it costs',
    one_liner: 'Selling your main home for a smaller one is free of CGT and releases equity; a downsizing addition protects your residence IHT band.',
    detail: 'Your main residence is exempt from CGT (Private Residence Relief), so downsizing turns housing wealth into spendable/investable capital tax-free. If you later need the residence nil-rate band but no longer own a qualifying home, the "downsizing addition" can preserve it provided assets of equivalent value pass to direct descendants. Weigh the moving costs (SDLT on the new place, fees) and the lifestyle trade-offs against the freed equity.',
    triggers: [CONCERNS.PROP_DOWNSIZE, CONCERNS.IHT_LEGACY, CONCERNS.LIFESTYLE],
    weight: { [CONCERNS.PROP_DOWNSIZE]: 1.0, [CONCERNS.IHT_LEGACY]: 0.5, [CONCERNS.LIFESTYLE]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'on the move', certainty: 'depends',
      why: 'Selling your main home is CGT-free (PRR) and frees equity; the RNRB downsizing addition can preserve your residence IHT band if value passes to descendants. Net benefit depends on moving costs and the equity released.' }),
    citation: 'TCGA 1992 s.222-223 (PRR); IHTA 1984 s.8FA-8FE (RNRB downsizing addition)',
    category: 'property',
    alternatives: [{ value_shift: 'stay put over release', alt_play: 'equity_release_caution' }],
    fca_boundary: FCA,
  },
  {
    id: 'upsize_home',
    title: 'Buying a bigger home — affordability and the SDLT bill',
    one_liner: 'A bigger main home means a larger mortgage and a stamp-duty bill on the purchase, but the home itself stays CGT-free.',
    detail: 'Trading up is mainly an affordability and cashflow question: the larger mortgage and the SDLT due on the new purchase are the real costs. The upside — your main home remains exempt from CGT however much it grows — and more of your wealth sits in an unmortgaged asset over time. Stress-test the new payment against higher rates and your other goals (pension, emergency fund) before committing.',
    triggers: [CONCERNS.PROP_UPSIZE, CONCERNS.LIFESTYLE, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_UPSIZE]: 1.0, [CONCERNS.LIFESTYLE]: 0.5, [CONCERNS.TAX]: 0.4 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'on the move', certainty: 'depends',
      why: 'The costs are the larger mortgage and SDLT on the purchase; the upside is a CGT-free main home that grows tax-free. It comes down to affordability against your other goals — stress-test the payment at higher rates.' }),
    citation: 'SDLT — Finance Act 2003 Pt 4; TCGA 1992 s.222 (PRR)',
    category: 'property',
    alternatives: [{ value_shift: 'invest over upsize', alt_play: 'overpay_vs_invest' }],
    fca_boundary: FCA,
  },
  {
    id: 'btl_buy_considerations',
    title: 'Buying a buy-to-let — the numbers that decide it',
    one_liner: 'BTL returns now hinge on net yield after the SDLT surcharge, Section 24 interest restriction, and running costs — not headline rent.',
    detail: 'A new BTL purchase pays the additional-property SDLT surcharge up front. Ongoing, Section 24 restricts mortgage-interest relief to a basic-rate (20%) tax credit, so higher-rate landlords keep less of the rent than the gross yield suggests. Add voids, management, maintenance and eventual CGT on sale. The decision turns on the net-of-tax yield versus alternatives (e.g. a REIT or equities in a wrapper), plus your appetite for being a landlord.',
    triggers: [CONCERNS.PROP_BTL_BUY, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_BTL_BUY]: 1.0, [CONCERNS.TAX]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'long-term', certainty: 'depends',
      why: 'BTL maths is net-of-tax: the SDLT surcharge up front, S24 capping interest relief at 20%, plus voids and costs. Compare the net yield to wrapper-held alternatives and weigh the landlord workload.' }),
    citation: 'ITTOIA 2005 s.272A (S24 interest restriction); FA 2003 (SDLT surcharge)',
    category: 'property',
    alternatives: [{ value_shift: 'hands-off over hands-on', alt_play: 'portfolio_allocation_factors' }],
    fca_boundary: FCA,
  },
  {
    id: 'btl_after_s24',
    title: 'Is BTL still profitable after Section 24?',
    one_liner: 'Section 24 hits higher-rate, mortgaged landlords hardest — the question is personal-name vs limited-company ownership.',
    detail: 'Since Section 24 fully bit, mortgage interest on a personally-held BTL is no longer a deductible expense — just a 20% tax credit — which can push a higher-rate landlord\'s real return down sharply, occasionally to a loss after tax. Holding through a limited company restores interest as a deductible cost (profits taxed at corporation-tax rates) but adds running costs, and extracting profit is taxed again. Lightly-geared or basic-rate landlords are far less affected.',
    triggers: [CONCERNS.PROP_BTL_S24, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_BTL_S24]: 1.0, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'ongoing', certainty: 'depends',
      why: 'S24 squeezes higher-rate, mortgaged landlords most (interest is only a 20% credit). A company restores interest deductibility but adds cost and a second tax layer on extraction; lightly-geared/basic-rate landlords are barely affected.' }),
    citation: 'ITTOIA 2005 s.272A (S24); CTA 2009/2010 (company lettings)',
    category: 'property',
    alternatives: [{ value_shift: 'incorporate over hold', alt_play: 'btl_incorporation' }],
    fca_boundary: FCA,
  },
  {
    id: 'btl_incorporation',
    title: 'Incorporating a BTL portfolio — worth it?',
    one_liner: 'Moving rentals into a company can restore interest relief, but the transfer triggers CGT and SDLT unless reliefs apply — it pays off mainly at scale.',
    detail: 'Transferring personally-held property into a company is a disposal: CGT on the gain and SDLT on the market value, unless Incorporation Relief (s162 TCGA) defers the CGT — which generally needs the lettings to be run as a genuine business (substantial time/activity). Inside the company, interest is deductible again and profits are taxed at corporation-tax rates, but extracting cash is taxed a second time. The fixed costs mean it usually only stacks up for larger, geared portfolios; take specialist advice first.',
    triggers: [CONCERNS.PROP_BTL_INC, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_BTL_INC]: 1.0, [CONCERNS.TAX]: 0.7 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'one-off + ongoing', certainty: 'depends',
      why: 'Incorporation restores interest relief but the transfer triggers CGT and SDLT unless s162 Incorporation Relief applies (needs a genuine property business). Extraction is taxed again, so it usually only pays at scale — get specialist advice.' }),
    citation: 'TCGA 1992 s.162 (Incorporation Relief); FA 2003 (SDLT on transfer)',
    category: 'property',
    alternatives: [{ value_shift: 'hold over restructure', alt_play: 'btl_after_s24' }],
    fca_boundary: FCA,
  },
  {
    id: 'fhl_post_abolition',
    title: 'Furnished holiday lets after the regime\'s abolition',
    one_liner: 'From April 2025 the special FHL tax regime ended — holiday lets are now taxed like any other property business.',
    detail: 'The furnished-holiday-let regime was abolished from 6 April 2025. The perks it carried — full mortgage-interest deductibility, capital allowances on furnishings, CGT reliefs (e.g. BADR/rollover) and FHL profits counting as relevant earnings for pension contributions — no longer apply. Existing FHLs are now ordinary property businesses subject to Section 24. Review whether the property still earns its keep under the new treatment, or whether to sell or repurpose it.',
    triggers: [CONCERNS.PROP_FHL, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_FHL]: 1.0, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'from April 2025', certainty: 'high',
      why: 'The FHL regime ended on 6 April 2025: no more full interest relief, capital allowances, FHL CGT reliefs, or pension-relevant earnings. Holiday lets are now ordinary property businesses under S24 — re-test whether each still pays.' }),
    citation: 'FA 2024/2025 (abolition of the FHL regime, effective 6 April 2025)',
    category: 'property',
    alternatives: [{ value_shift: 'sell over hold', alt_play: 'btl_disposal' }],
    fca_boundary: FCA,
  },
  {
    id: 'ftb_sdlt_relief',
    title: 'First-time buyer SDLT relief — are you eligible?',
    one_liner: 'First-time buyers pay reduced or no stamp duty up to a price cap, provided no one buying has ever owned a home anywhere.',
    detail: 'First-time buyer relief charges no SDLT up to a threshold and a reduced rate on a band above it, but only up to a maximum purchase price — buy above the cap and the relief is lost entirely. Every purchaser must be a genuine first-time buyer (never having owned residential property anywhere in the world), and the home must be your only/main residence. The thresholds were last changed in April 2025, so check the current figures for your completion date.',
    triggers: [CONCERNS.PROP_FTB, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_FTB]: 1.0, [CONCERNS.TAX]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at purchase', certainty: 'depends',
      why: 'FTB relief gives nil/reduced SDLT up to a price cap, but only if every buyer has never owned a home anywhere and the cap isn\'t breached. Thresholds changed in April 2025 — check current figures for your completion date.' }),
    citation: 'Finance Act 2003 Sch 6ZA (first-time buyer SDLT relief)',
    category: 'property',
    alternatives: [{ value_shift: 'buy now over wait', alt_play: 'upsize_home' }],
    fca_boundary: FCA,
  },
  {
    id: 'second_home_sdlt',
    title: 'Buying a second home — the surcharge and the CGT tail',
    one_liner: 'A second home pays the additional-property SDLT surcharge up front and, unlike your main home, is exposed to CGT when you sell.',
    detail: 'Any additional residential property — a holiday home or pied-à-terre — attracts the higher-rate SDLT surcharge on top of standard rates. While you own it, only one property can be your CGT-exempt main residence, so the second home carries a CGT liability on its gain when sold (residential gains are taxed at higher CGT rates with 60-day reporting). Factor running costs and that exposure into the lifestyle decision.',
    triggers: [CONCERNS.PROP_SECOND, CONCERNS.TAX, CONCERNS.LIFESTYLE],
    weight: { [CONCERNS.PROP_SECOND]: 1.0, [CONCERNS.TAX]: 0.5, [CONCERNS.LIFESTYLE]: 0.4 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at purchase + on sale', certainty: 'depends',
      why: 'A second home pays the additional-property SDLT surcharge now and carries CGT on its gain later (only one home gets the CGT exemption). Weigh that and running costs against the lifestyle value.' }),
    citation: 'FA 2003 (additional-property SDLT surcharge); TCGA 1992 s.222 (one main residence)',
    category: 'property',
    alternatives: [{ value_shift: 'rent over buy', alt_play: 'btl_buy_considerations' }],
    fca_boundary: FCA,
  },
  {
    id: 'btl_disposal',
    title: 'Selling a buy-to-let — timing and the tax',
    one_liner: 'Selling crystallises CGT at residential rates with a 60-day report-and-pay deadline; timing the gain across tax years can soften it.',
    detail: 'If the landlord workload no longer justifies the return, selling is reasonable — but a BTL sale is a CGT event at the higher residential rates, payable within 60 days of completion. Levers to manage it: use your annual exempt amount (and a spouse\'s, via a CGT-free transfer of a share before sale), offset capital losses, and where possible straddle disposals across tax years. Weigh the freed capital and removed hassle against the tax and lost future rent.',
    triggers: [CONCERNS.PROP_BTL_SELL, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_BTL_SELL]: 1.0, [CONCERNS.TAX]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'depends',
      why: 'Selling a BTL triggers CGT at residential rates, due within 60 days. Use your (and a spouse\'s) annual exemption, any losses, and tax-year timing to soften it. Weigh freed capital and less hassle against the tax and lost rent.' }),
    citation: 'TCGA 1992 (CGT on residential property); FA 2019 (60-day reporting)',
    category: 'property',
    alternatives: [{ value_shift: 'hold over sell', alt_play: 'btl_after_s24' }],
    fca_boundary: FCA,
  },
  {
    id: 'btl_cgt_mechanics',
    title: 'How CGT works when you sell a buy-to-let',
    one_liner: 'Gain = proceeds − cost − allowable expenses − annual exemption, taxed at the higher residential CGT rates, reported within 60 days.',
    detail: 'On a BTL sale, the chargeable gain is the sale price less what you paid, less buying/selling costs and qualifying capital improvements, less your annual exempt amount. Residential-property gains are taxed at higher CGT rates than other assets, split across your basic- and higher-rate bands. You must report and pay within 60 days of completion via an HMRC property return. A pre-sale transfer of a share to a spouse (CGT-free) can bring a second annual exemption and band into play.',
    triggers: [CONCERNS.PROP_BTL_CGT, CONCERNS.TAX],
    weight: { [CONCERNS.PROP_BTL_CGT]: 1.0, [CONCERNS.TAX]: 0.7 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'high',
      why: 'Gain = proceeds − cost − buying/selling costs − improvements − annual exemption, taxed at the higher residential CGT rates and reported/paid within 60 days. A spouse transfer before sale adds a second exemption and band.' }),
    citation: 'TCGA 1992 (computation, residential rates, s.58 inter-spouse); FA 2019 (60-day return)',
    category: 'property',
    alternatives: [{ value_shift: 'defer over realise', alt_play: 'btl_disposal' }],
    fca_boundary: FCA,
  },

  // ── Business exit domain (W6) — tax-technical, rates kept qualitative ───────
  {
    id: 'sale_structure_asset_vs_share',
    title: 'Selling up: share sale vs asset sale',
    one_liner: 'Sellers usually prefer a share sale (one layer of tax, often with BADR); buyers prefer an asset sale — it shapes the price.',
    detail: 'In a share sale you sell the company shares: a single capital gain, often qualifying for Business Asset Disposal Relief, and the company\'s history transfers to the buyer. In an asset sale the company sells its trade/assets, is taxed inside the company, and you then extract the proceeds — potentially a second tax layer. Buyers favour asset deals (clean slate, step-up in base cost), so the structure is a negotiation that affects net proceeds. This is a deal-structuring and tax matter for your accountant/solicitor.',
    triggers: [CONCERNS.BUS_SALE, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_SALE]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.6, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'depends',
      why: 'A share sale is usually more tax-efficient for the seller (single CGT layer, often BADR); an asset sale suits the buyer. Which prevails — and the price effect — is negotiated deal by deal.' }),
    citation: 'TCGA 1992 (CGT on share disposals); CTA 2009/2010 (corporate gains)',
    category: 'business',
    alternatives: [{ value_shift: 'certainty over price', alt_play: 'badr_eligibility' }],
    fca_boundary: FCA,
  },
  {
    id: 'badr_eligibility',
    title: 'Business Asset Disposal Relief — do you qualify?',
    one_liner: 'BADR gives a reduced CGT rate on qualifying business sales, up to a £1m lifetime limit — but the conditions are strict.',
    detail: 'BADR (formerly Entrepreneurs\' Relief) charges a reduced rate of CGT on qualifying gains, capped at a £1m lifetime limit. To qualify you generally need, for at least two years before sale: a 5%+ shareholding AND voting rights, to be an officer or employee, and the company to be trading. The relief rate has been rising in recent Budgets, so check the current rate for your disposal date. Get an accountant to confirm eligibility well before exchange.',
    triggers: [CONCERNS.BUS_BADR, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_BADR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.6, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'depends',
      why: 'BADR applies a reduced CGT rate to the first £1m of qualifying lifetime gains, if you meet the 2-year tests (5%+ stake, officer/employee, trading company). The rate has been increasing, so confirm the figure for your sale date.' }),
    citation: 'TCGA 1992 s.169H-169S (BADR); s.169N (£1m lifetime limit)',
    category: 'business',
    alternatives: [{ value_shift: 'speed over relief', alt_play: 'sale_structure_asset_vs_share' }],
    fca_boundary: FCA,
  },
  {
    id: 'exit_sequencing',
    title: 'Exit gradually or all at once?',
    one_liner: 'A staged exit spreads gains across tax years and eases handover; a clean break is simpler and crystallises value now.',
    detail: 'Selling in stages can spread capital gains across tax years (using each year\'s exemption) and smooth the leadership transition, but you keep risk and involvement longer and the BADR £1m lifetime limit still caps total relief. A single sale crystallises value and risk-transfer immediately but bunches the gain into one year. The right path depends on buyer appetite, your need for the cash, and how clean a break you want.',
    triggers: [CONCERNS.BUS_EXIT_SEQ, CONCERNS.BUSINESS_EXIT],
    weight: { [CONCERNS.BUS_EXIT_SEQ]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'over the exit', certainty: 'depends',
      why: 'Staging spreads gains across tax-year exemptions and eases handover but prolongs your risk; a clean break is simpler but bunches the gain. BADR\'s lifetime limit applies either way.' }),
    citation: 'TCGA 1992 (annual exempt amount; BADR lifetime limit)',
    category: 'business',
    alternatives: [{ value_shift: 'clean break over phasing', alt_play: 'sale_structure_asset_vs_share' }],
    fca_boundary: FCA,
  },
  {
    id: 'earnout_structure',
    title: 'Earn-out vs lump sum — the tax difference',
    one_liner: 'Deferred earn-outs can change when (and how) you\'re taxed; the form of the right to future cash matters a lot.',
    detail: 'A lump sum is a clean capital gain at completion. An earn-out (extra consideration if the business hits targets) is more complex: an "ascertainable" earn-out is taxed up front on its value; an "unascertainable" one is treated as a separate chargeable asset (the Marren v Ingles rule) and taxed again as it pays out. Loan-note structures can defer the gain. These choices interact with BADR, so model them with your accountant before signing.',
    triggers: [CONCERNS.BUS_EARNOUT, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_EARNOUT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'across the earn-out period', certainty: 'depends',
      why: 'A lump sum is one capital gain at completion; an earn-out can be taxed up front (ascertainable) or as a separate asset that\'s taxed again on payout (unascertainable — Marren v Ingles). The structure affects timing and BADR — model it before signing.' }),
    citation: 'TCGA 1992 s.48 (deferred consideration); Marren v Ingles [1980]',
    category: 'business',
    alternatives: [{ value_shift: 'certainty over upside', alt_play: 'sale_structure_asset_vs_share' }],
    fca_boundary: FCA,
  },
  {
    id: 'eot_relief',
    title: 'Selling to an Employee Ownership Trust (EOT)',
    one_liner: 'A qualifying sale of a controlling stake to an EOT can be free of CGT — but the conditions and post-sale rules are strict.',
    detail: 'Since 2014, selling a controlling interest (more than 50%) to an Employee Ownership Trust that meets the conditions can attract full relief from CGT for the seller. Recent Finance Acts tightened the rules (e.g. trustee residence, former-owner control of the trust, a clawback window). It suits owners who want to reward staff and exit without a trade buyer, accepting that the price is funded out of future company profits rather than paid up front.',
    triggers: [CONCERNS.BUS_EOT, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_EOT]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.5 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'depends',
      why: 'A qualifying controlling-interest sale to an EOT can be fully CGT-free, but conditions are strict (and recently tightened), and the price is typically paid from future profits rather than up front.' }),
    citation: 'TCGA 1992 s.236H-236U (EOT relief); FA 2014; FA 2024 EOT reforms',
    category: 'business',
    alternatives: [{ value_shift: 'cash-now over legacy', alt_play: 'sale_structure_asset_vs_share' }],
    fca_boundary: FCA,
  },
  {
    id: 'mvl_capital_treatment',
    title: 'Winding down: capital treatment via an MVL',
    one_liner: 'A solvent company\'s reserves distributed in a Members\' Voluntary Liquidation are usually taxed as capital gains (often BADR), not as dividends.',
    detail: 'If a solvent company has retained reserves, a Members\' Voluntary Liquidation lets a liquidator distribute them as capital — taxed at CGT rates and often qualifying for BADR — rather than as dividends taxed at income rates. The TAAR anti-avoidance rule can re-characterise it as a dividend if you start a similar business within two years ("phoenixing"). An MVL has fixed liquidator costs, so it pays off mainly on larger reserve balances.',
    triggers: [CONCERNS.BUS_MVL, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_MVL]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at wind-down', certainty: 'depends',
      why: 'An MVL distributes reserves as capital (CGT, often BADR) instead of dividends (income tax) — usually a saving on larger balances, but the TAAR can undo it if you restart a similar trade within two years.' }),
    citation: 'CTA 2010 s.1030A (capital distributions); ITTOIA 2005 s.396B (TAAR)',
    category: 'business',
    alternatives: [{ value_shift: 'simplicity over saving', alt_play: 'dividend_vs_capital_extraction' }],
    fca_boundary: FCA,
  },
  {
    id: 'dividend_vs_capital_extraction',
    title: 'Take it as dividends or sell the shares?',
    one_liner: 'Ongoing dividends are taxed as income; selling shares is a capital gain (often BADR) — the gap depends on your rate and the amounts.',
    detail: 'Extracting profits as dividends is taxed at dividend income rates each year (after the small dividend allowance). Realising value by selling shares is a capital gain, often at a lower BADR rate up to the £1m lifetime limit. For a full exit, the capital route usually wins; for ongoing income from a company you keep running, dividends (blended with a small salary) are the normal route. It hinges on your marginal rates and whether you\'re exiting or continuing.',
    triggers: [CONCERNS.BUS_DIVCAP, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_DIVCAP]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.4, [CONCERNS.TAX]: 0.7 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'ongoing or at exit', certainty: 'depends',
      why: 'Dividends are income-taxed each year; a share sale is a capital gain (often BADR, to the £1m limit). The capital route usually wins on a full exit; dividends suit ongoing income. Depends on your rates and whether you\'re leaving.' }),
    citation: 'ITTOIA 2005 (dividend taxation); TCGA 1992 s.169H+ (BADR)',
    category: 'business',
    alternatives: [{ value_shift: 'income now over exit', alt_play: 'badr_eligibility' }],
    fca_boundary: FCA,
  },
  {
    id: 'investors_relief_eligibility',
    title: 'Investors\' Relief — am I eligible?',
    one_liner: 'A reduced CGT rate for outside investors in unlisted trading companies, with its own lifetime limit — separate from BADR.',
    detail: 'Investors\' Relief gives a reduced CGT rate on gains from newly-issued, fully-paid ordinary shares in an unlisted trading company, held at least three years, where you are NOT an employee or paid director (it targets external investors, unlike BADR). It has its own lifetime cap (recently reduced) and the rate has been aligned upward in recent Budgets. Confirm the current rate and limit for your disposal date with an accountant.',
    triggers: [CONCERNS.BUS_IR, CONCERNS.BUSINESS_EXIT, CONCERNS.TAX],
    weight: { [CONCERNS.BUS_IR]: 1.0, [CONCERNS.BUSINESS_EXIT]: 0.5, [CONCERNS.TAX]: 0.6 },
    prerequisites: {}, counter_indications: {}, needs_fact: [],
    compute_impact: (p) => ({ gbp_saved: 0, time_horizon: 'at sale', certainty: 'depends',
      why: 'Investors\' Relief is for external investors (not employees/directors) in unlisted trading companies, on newly-issued shares held 3+ years, with its own lifetime limit. Both the rate and the cap have changed recently — confirm for your disposal date.' }),
    citation: 'TCGA 1992 s.169VA-169VY (Investors\' Relief)',
    category: 'business',
    alternatives: [{ value_shift: 'BADR route over IR', alt_play: 'badr_eligibility' }],
    fca_boundary: FCA,
  },

  // ── Investment / portfolio domain (W6, educational — never a recommendation) ─
  {
    id: 'portfolio_allocation_factors',
    title: 'What shapes a sensible asset allocation',
    one_liner: 'Allocation follows your time horizon, your capacity for loss, and what the money is for — not a one-size-fits-all percentage.',
    detail: 'There is no universal "right" split. The factors that drive it are: how long until you need the money (longer horizons can ride out volatility), how much loss you could absorb without derailing your plan, your goals, and your emotional tolerance for swings. "Age-based" rules of thumb (e.g. bonds ≈ your age) are starting points, not answers. A regulated adviser can map a specific allocation to your circumstances.',
    triggers: [CONCERNS.INV_ALLOCATION, CONCERNS.INCOME_SECURITY],
    weight: { [CONCERNS.INV_ALLOCATION]: 1.0, [CONCERNS.INCOME_SECURITY]: 0.4 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.RISK_TOLERANCE, FACTS.TIME_HORIZON],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: 'long-term', certainty: 'depends',
      why: 'The appropriate allocation depends on your time horizon, capacity for loss and goals — not a fixed percentage. This is information to frame the decision; a personalised allocation is regulated advice.',
    }),
    citation: 'General investment principle; FCA COBS 9 (suitability) — not advice',
    category: 'investment',
    alternatives: [{ value_shift: 'simplicity over precision', alt_play: 'passive_vs_active' }],
    fca_boundary: FCA,
  },
  {
    id: 'fund_fee_review',
    title: 'Check what your funds cost (the TER drag)',
    one_liner: 'A fund\'s ongoing charge (TER/OCF) is a certain, compounding drag — small differences cost a lot over decades.',
    detail: 'The Total Expense Ratio (or Ongoing Charges Figure) is what a fund deducts each year regardless of performance. Broad index trackers commonly charge a fraction of a percent; active funds often charge multiples of that. Because fees compound, a 1%-a-year difference can cost a meaningful share of the pot over 20-30 years. Benchmark each holding\'s charge against a comparable tracker, and add any platform fee on top.',
    triggers: [CONCERNS.INV_FEES, CONCERNS.TAX],
    weight: { [CONCERNS.INV_FEES]: 1.0, [CONCERNS.TAX]: 0.2 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => {
      const invested = (num(p?.assets?.gia) + num(p?.assets?.isa) + num(p?.assets?.investments)) || 0
      const drag1pct = Math.round(invested * 0.01)
      return {
        gbp_saved: drag1pct, time_horizon: 'per year, compounding', certainty: 'high',
        why: invested > 0
          ? `On roughly £${invested.toLocaleString()} of investments, each 1% of annual charge is about £${drag1pct.toLocaleString()}/yr — and it compounds. Benchmark each fund's TER against a comparable tracker.`
          : 'Each 1% of annual fund charge is a certain, compounding drag — benchmark every holding against a comparable tracker.',
      }
    },
    citation: 'FCA COBS 6 (costs & charges disclosure)',
    category: 'investment',
    alternatives: [{ value_shift: 'cost over conviction', alt_play: 'passive_vs_active' }],
    fca_boundary: FCA,
  },
  {
    id: 'passive_vs_active',
    title: 'Passive vs active funds — the trade-off',
    one_liner: 'Passive funds track an index cheaply; active funds aim to beat it but cost more and most don\'t over the long run.',
    detail: 'Index (passive) funds buy the whole market at very low cost; active funds pay a manager to try to beat it. The long-run evidence (e.g. SPIVA studies) is that the majority of active funds underperform their benchmark after fees over 10+ years, though some persist. Many investors use low-cost passive as the core and active only where they have specific conviction. It is a cost-and-belief decision, not a guarantee either way.',
    triggers: [CONCERNS.INV_PASSIVE, CONCERNS.INV_FEES],
    weight: { [CONCERNS.INV_PASSIVE]: 1.0, [CONCERNS.INV_FEES]: 0.4 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: 'long-term', certainty: 'depends',
      why: 'Passive cuts cost to near-zero; active adds cost for the chance (not the promise) of beating the index — which most don\'t over the long run after fees. The choice turns on cost, your conviction, and the asset class.',
    }),
    citation: 'SPIVA / academic literature on active vs passive; FCA COBS 6 (costs)',
    category: 'investment',
    alternatives: [{ value_shift: 'conviction over cost', alt_play: 'fund_fee_review' }],
    fca_boundary: FCA,
  },
  {
    id: 'concentration_risk',
    title: 'Reducing concentration in a single holding',
    one_liner: 'A large single-stock position is uncompensated risk; trimming it gradually using your annual CGT exemption manages the tax.',
    detail: 'Holding a big share of your wealth in one stock (often inherited or from employer equity) adds risk you are not paid extra to take — if it falls, your whole plan moves with it. Diversifying reduces that risk. The friction is CGT on the gain when you sell; selling in tranches across tax years to use each year\'s annual exempt amount, and sheltering proceeds in an ISA/pension, spreads the tax. Inter-spouse transfers (CGT-free) can also double the exemptions used.',
    triggers: [CONCERNS.INV_CONCENTRATION, CONCERNS.TAX],
    weight: { [CONCERNS.INV_CONCENTRATION]: 1.0, [CONCERNS.TAX]: 0.5 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: 'phased over tax years', certainty: 'depends',
      why: 'Concentration is risk you aren\'t compensated for. Trimming in tranches across tax years uses each year\'s CGT annual exempt amount and (if married) a spouse\'s too, so diversifying need not trigger a single large tax bill.',
    }),
    citation: 'TCGA 1992 s.1K (annual exempt amount), s.58 (inter-spouse)',
    category: 'investment',
    alternatives: [{ value_shift: 'tax deferral over speed', alt_play: 'portfolio_allocation_factors' }],
    fca_boundary: FCA,
  },
  {
    id: 'rebalancing_discipline',
    title: 'Rebalancing — keeping your mix on track',
    one_liner: 'Rebalancing sells what has grown and tops up what has lagged, holding your risk level steady; do it on a threshold or a calendar.',
    detail: 'Over time, winners grow to dominate a portfolio, quietly raising its risk. Rebalancing restores the target mix — either on a calendar (e.g. annually) or when a holding drifts past a band (e.g. ±5%). Inside ISAs/pensions there is no tax cost to rebalancing; in a GIA, selling can trigger CGT, so prefer redirecting new money or using your annual exemption. It is risk control, not return chasing.',
    triggers: [CONCERNS.INV_REBALANCE],
    weight: { [CONCERNS.INV_REBALANCE]: 1.0 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: 'annual / on drift', certainty: 'medium',
      why: 'Rebalancing keeps your risk level where you intended rather than letting winners take over. Inside ISAs/pensions it is tax-free; in a GIA, use new contributions or your annual CGT exemption to avoid a tax hit.',
    }),
    citation: 'General portfolio-management principle; TCGA 1992 (CGT on GIA disposals)',
    category: 'investment',
    alternatives: [{ value_shift: 'leave-it over tinkering', alt_play: 'portfolio_allocation_factors' }],
    fca_boundary: FCA,
  },
  {
    id: 'emerging_markets_role',
    title: 'The role — and risk — of emerging markets',
    one_liner: 'Emerging markets add growth potential and diversification but with higher volatility and currency risk; size the position accordingly.',
    detail: 'Emerging-market equities can offer higher long-term growth and diversify away from developed markets, but they swing harder and carry currency and governance risk. Most global trackers already include a slice (often ~10%). Whether to hold more is a question of your risk capacity and horizon — a satellite position you can leave alone for a decade, not money you\'ll need soon.',
    triggers: [CONCERNS.INV_EM],
    weight: { [CONCERNS.INV_EM]: 1.0 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.RISK_TOLERANCE],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: '10+ years', certainty: 'depends',
      why: 'EM adds growth potential and diversification but higher volatility and currency risk. A global tracker already holds some; extra exposure suits a long horizon and spare risk capacity, not near-term money.',
    }),
    citation: 'General diversification principle — not advice',
    category: 'investment',
    alternatives: [{ value_shift: 'stability over growth', alt_play: 'portfolio_allocation_factors' }],
    fca_boundary: FCA,
  },
  {
    id: 'esg_investing',
    title: 'ESG / sustainable funds — what to weigh',
    one_liner: 'ESG funds screen on environmental, social and governance criteria; definitions vary widely, so check what a fund actually does and its cost.',
    detail: 'ESG (or sustainable/ethical) funds apply environmental, social and governance filters — but the label is not standardised, so two "ESG" funds can hold very different things. Check the fund\'s actual methodology and holdings (the FCA\'s anti-greenwashing labelling rules help), its charge versus a comparable mainstream fund, and accept that values-based screening may narrow diversification. There is no inherent performance penalty or premium — the evidence is mixed.',
    triggers: [CONCERNS.INV_ESG],
    weight: { [CONCERNS.INV_ESG]: 1.0 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0, time_horizon: 'long-term', certainty: 'depends',
      why: '"ESG" isn\'t standardised — check what the fund actually holds, its charge versus a mainstream equivalent, and that screening doesn\'t over-narrow diversification. Performance evidence is mixed, so treat it as a values choice, not a return strategy.',
    }),
    citation: 'FCA SDR & investment labels (anti-greenwashing); COBS 4 (fair, clear, not misleading)',
    category: 'investment',
    alternatives: [{ value_shift: 'returns-first over values-first', alt_play: 'passive_vs_active' }],
    fca_boundary: FCA,
  },

  // ── Cash domain — new plays (W6, closes CASH-03/06/07/08) ───────────────────
  {
    id: 'mmf_vs_cash_isa',
    title: 'Where to hold cash: money market fund vs cash ISA',
    one_liner: 'A cash ISA shelters interest from tax permanently; a money market fund (in a GIA) is taxable but flexible and uncapped.',
    detail: 'A cash ISA pays interest free of income tax for life and is instant-access, but is limited to your £20k annual allowance. A money market fund (held in a GIA) tracks short-term rates with low capital risk, has no contribution cap, and settles in a day or two — but its return is taxable as interest/dividends. For a higher-rate taxpayer whose Personal Savings Allowance is already used, the cash ISA usually wins on tax; for larger balances beyond the ISA cap, an MMF or gilts mop up the rest.',
    triggers: [CONCERNS.CASH_SHELTER, CONCERNS.LIQUIDITY, CONCERNS.TAX],
    weight: { [CONCERNS.CASH_SHELTER]: 1.0, [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.TAX]: 0.6 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.ISA_USED_THIS_YEAR],
    compute_impact: (p) => ({
      gbp_saved: 0,
      time_horizon: 'ongoing',
      certainty: 'depends',
      why: 'A cash ISA wins on tax (interest is sheltered for life) up to the £20k annual cap; a money market fund is uncapped and flexible but taxable. The right split depends on how much of your Personal Savings Allowance is already used and how much cash sits above the ISA limit.',
    }),
    citation: 'ITTOIA 2005 (ISA interest exemption); ITA 2007 s.12B (PSA)',
    category: 'cash',
    alternatives: [
      { value_shift: 'tax shelter over flexibility', alt_play: 'deploy_cash_isa_first' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'isa_full_next_steps',
    title: 'Your ISA is full — where the next pound goes',
    one_liner: 'Once this year\'s ISA is used, the usual next homes are a pension (tax relief), a spouse\'s ISA, then a GIA using your CGT/dividend allowances.',
    detail: 'With the £20k ISA used, the next most tax-efficient homes are typically: a pension contribution (income-tax relief at your marginal rate, within the annual allowance), your spouse\'s £20k ISA if married, then a General Investment Account where you use your annual CGT exemption and dividend allowance each year. Bed-and-ISA next 6 April rotates GIA holdings back into the wrapper.',
    triggers: [CONCERNS.CASH_BEYOND_ISA, CONCERNS.TAX, CONCERNS.LIQUIDITY],
    weight: { [CONCERNS.CASH_BEYOND_ISA]: 1.0, [CONCERNS.TAX]: 0.7, [CONCERNS.LIQUIDITY]: 0.4 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.MARITAL_STATUS],
    compute_impact: (p) => ({
      gbp_saved: 0,
      time_horizon: 'this and next tax year',
      certainty: 'depends',
      why: 'After the ISA, a pension adds tax relief at your marginal rate; a spouse\'s ISA doubles the sheltered amount; a GIA lets you use your annual CGT and dividend allowances. Which comes first depends on your income, age and when you\'ll need the money.',
    }),
    citation: 'Pension tax relief (FA 2004); ITTOIA 2005 (ISA); TCGA 1992 (CGT AEA)',
    category: 'cash',
    alternatives: [
      { value_shift: 'access over relief', alt_play: 'deploy_cash_isa_first' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'bed_and_sipp',
    title: 'Bed-and-SIPP: move cash or GIA holdings into a pension for relief',
    one_liner: 'Contributing cash into a pension claims income-tax relief at your marginal rate — powerful, but the money is then locked until 55/57.',
    detail: 'Selling a GIA holding (or using spare cash) and contributing it to a SIPP grosses it up with basic-rate relief at source, with higher/additional-rate relief reclaimed via your tax return — within your annual allowance and relievable earnings. The trade-off is access: pension money is locked until normal minimum pension age (55, rising to 57 in 2028). Watch the MPAA if you have already flexibly accessed a pension.',
    triggers: [CONCERNS.CASH_BEDSIPP, CONCERNS.TAX, CONCERNS.LIQUIDITY],
    weight: { [CONCERNS.CASH_BEDSIPP]: 1.0, [CONCERNS.TAX]: 0.7, [CONCERNS.LIQUIDITY]: 0.3 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.WORK_STATUS],
    compute_impact: (p) => {
      const income = num(p?.income?.annual) || num(p?.income) || 0
      const marg = income > 125140 ? 0.45 : income > 50270 ? 0.40 : 0.20
      return {
        gbp_saved: 0,
        time_horizon: 'this tax year',
        certainty: 'depends',
        why: `Contributing into a pension claims relief at your marginal rate (about ${Math.round(marg * 100)}% on current income) — but locks the money until 55/57 and is capped by your annual allowance and relievable earnings. Worthwhile when you don't need that cash before retirement.`,
      }
    },
    citation: 'FA 2004 (pension tax relief); FA 2017 (MPAA); relievable earnings FA 2004 s.189',
    category: 'cash',
    alternatives: [
      { value_shift: 'access over relief', alt_play: 'deploy_cash_isa_first' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'cash_yield_drop',
    title: 'Savings rates have dropped — review where your cash sits',
    one_liner: 'Falling rates make tax efficiency and term matter more: check your rate, your tax exposure, and whether some cash should move to gilts or longer fixes.',
    detail: 'When headline savings rates fall, the gap between a top easy-access account and a stale one widens — so check you are not sitting on a legacy rate. For cash beyond your emergency fund and Personal Savings Allowance, locking a fixed term, laddering gilts (price gain CGT-free), or sheltering in a cash ISA can preserve more of a smaller return. Keep enough liquid; reach for yield only with money you won\'t need soon.',
    triggers: [CONCERNS.CASH_RATEDROP, CONCERNS.LIQUIDITY, CONCERNS.INCOME_SECURITY],
    weight: { [CONCERNS.CASH_RATEDROP]: 1.0, [CONCERNS.LIQUIDITY]: 0.5, [CONCERNS.INCOME_SECURITY]: 0.4 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [FACTS.PURPOSE_OF_CASH],
    compute_impact: (p) => ({
      gbp_saved: 0,
      time_horizon: 'now / at each rate move',
      certainty: 'depends',
      why: 'As rates fall, the biggest wins are leaving stale accounts, sheltering taxable interest (cash ISA / gilts), and matching term to when you need the money. The right mix depends on your tax band and how soon you\'ll spend the cash.',
    }),
    citation: 'ITA 2007 s.12B (PSA); TCGA 1992 s.115 (gilt CGT exemption)',
    category: 'cash',
    alternatives: [
      { value_shift: 'certainty over yield', alt_play: 'gilt_ladder_for_dated_spend' },
    ],
    fca_boundary: FCA,
  },

  // ── Mortgage / debt domain (W6 — closes the 0%-coverage MORT scenarios) ─────
  {
    id: 'overpay_vs_invest',
    title: 'Weigh overpaying the mortgage against investing the surplus',
    one_liner: 'Overpaying is a guaranteed, tax-free return equal to your mortgage rate; investing might beat it but carries risk.',
    detail: 'A mortgage overpayment "earns" you your mortgage interest rate, guaranteed and tax-free. Investing the same money (e.g. into a pension or ISA) might return more over the long run, but it is not guaranteed and the timing matters. The comparison turns on your mortgage rate versus a realistic after-tax expected return, your appetite for risk, and whether pension tax relief tips the balance. Many people split the surplus across both rather than choosing one.',
    triggers: [CONCERNS.DEBT_OVERPAY, CONCERNS.DEBT, CONCERNS.LIQUIDITY],
    weight: { [CONCERNS.DEBT_OVERPAY]: 1.0, [CONCERNS.DEBT]: 0.5, [CONCERNS.LIQUIDITY]: 0.4 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => {
      const cash = num(p?.assets?.cash) || 0
      return {
        gbp_saved: 0,
        time_horizon: 'ongoing',
        certainty: 'depends',
        why: 'There is no single right answer — overpaying gives a guaranteed return equal to your mortgage rate, while investing trades that certainty for the chance of a higher (or lower) return. Pension contributions add tax relief to the investing side. Compare your mortgage rate against a realistic after-tax return for your risk level.',
      }
    },
    citation: 'FCA MCOB 7 (overpayment terms); general financial-planning principle (no specific statute)',
    category: 'mortgage',
    alternatives: [
      { value_shift: 'guaranteed return over upside', alt_play: 'remortgage_review' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'remortgage_review',
    title: 'Review your mortgage before the fixed rate ends',
    one_liner: 'Shop the whole market a few months before your fix expires so you never roll onto the lender\'s standard variable rate by default.',
    detail: 'When a fixed rate ends you usually move to the lender\'s standard variable rate (SVR), which is typically much higher. Reviewing 3-6 months ahead lets you secure a new deal — fixed for rate certainty, or a tracker if you expect rates to fall and can absorb rises. The repayment-vs-interest-only choice is separate: interest-only keeps payments low but the capital still has to be repaid. A whole-of-market mortgage broker can compare deals you cannot see directly.',
    triggers: [CONCERNS.DEBT_RATE, CONCERNS.DEBT],
    weight: { [CONCERNS.DEBT_RATE]: 1.0, [CONCERNS.DEBT]: 0.5 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0,
      time_horizon: 'at each rate review',
      certainty: 'depends',
      why: 'Rolling onto an SVR by default is usually the most expensive outcome. The saving from switching depends on your balance and the gap between the SVR and the best available deal — often meaningful on a sizeable balance. Fixed vs tracker is a question of how much rate certainty you want.',
    }),
    citation: 'FCA MCOB 11 (responsible lending); FCA Mortgage Charter',
    category: 'mortgage',
    alternatives: [
      { value_shift: 'rate certainty over flexibility', alt_play: 'offset_mortgage' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'offset_mortgage',
    title: 'Consider an offset mortgage against your savings',
    one_liner: 'An offset sets your cash savings against the mortgage balance, so you pay interest only on the difference — useful when you hold meaningful cash.',
    detail: 'With an offset, savings held alongside the mortgage reduce the balance you pay interest on, without you spending the cash — it stays accessible. The "return" on that cash equals your mortgage rate, tax-free (unlike taxable savings interest), which can beat a normal savings account for a higher-rate taxpayer. The trade-off is that offset deals sometimes carry a slightly higher headline rate, so it pays most when your offset cash is a large share of the balance.',
    triggers: [CONCERNS.DEBT_OFFSET, CONCERNS.DEBT, CONCERNS.LIQUIDITY],
    weight: { [CONCERNS.DEBT_OFFSET]: 1.0, [CONCERNS.DEBT]: 0.5, [CONCERNS.LIQUIDITY]: 0.5 },
    prerequisites: {},
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => {
      const cash = num(p?.assets?.cash) || 0
      return {
        gbp_saved: 0,
        time_horizon: 'ongoing',
        certainty: 'depends',
        why: cash > 0
          ? `Offsetting cash against the mortgage earns your mortgage rate tax-free on that cash, instead of taxable savings interest. With around £${cash.toLocaleString()} in cash that can be a worthwhile, low-risk use of it — provided the offset deal's rate is competitive.`
          : 'An offset earns your mortgage rate, tax-free, on whatever cash you hold against it — most worthwhile when that cash is a large share of the balance.',
      }
    },
    citation: 'FCA MCOB (mortgage conduct); savings interest taxed under ITTOIA 2005',
    category: 'mortgage',
    alternatives: [
      { value_shift: 'flexibility over lowest rate', alt_play: 'overpay_vs_invest' },
    ],
    fca_boundary: FCA,
  },
  {
    id: 'equity_release_caution',
    title: 'Equity release — understand the trade-offs before committing',
    one_liner: 'A lifetime mortgage frees cash from your home without moving, but interest rolls up and compounds, reducing what your family inherits.',
    detail: 'Equity release (usually a lifetime mortgage) lets you take tax-free cash from your home with no required monthly payments — but the interest is added to the loan and compounds, so the debt can grow quickly and erode the estate. Modern plans carry a "no-negative-equity" guarantee and many now allow voluntary interest payments to slow the roll-up. It is a regulated advice area: alternatives — downsizing, a retirement-interest-only mortgage, or using other assets — should be weighed first.',
    triggers: [CONCERNS.DEBT_EQUITY, CONCERNS.DEBT, CONCERNS.IHT_LEGACY],
    weight: { [CONCERNS.DEBT_EQUITY]: 1.0, [CONCERNS.DEBT]: 0.5, [CONCERNS.IHT_LEGACY]: 0.4 },
    prerequisites: { min_age: 55 },
    counter_indications: {},
    needs_fact: [],
    compute_impact: (p) => ({
      gbp_saved: 0,
      time_horizon: 'lifetime',
      certainty: 'depends',
      why: 'Equity release solves a cash-access need but the compounding interest is a real long-term cost to your estate. Whether it is right depends on the alternatives available to you (downsizing, other assets) and how much leaving an inheritance matters. It requires regulated advice.',
    }),
    citation: 'FCA MCOB 8/9 (equity release); Equity Release Council no-negative-equity standard',
    category: 'mortgage',
    alternatives: [
      { value_shift: 'stay put over downsize', alt_play: 'overpay_vs_invest' },
    ],
    fca_boundary: FCA,
  },
]

export { PLAYS }

export function getAllPlays() {
  return PLAYS
}

export function getPlayById(id) {
  return PLAYS.find(p => p.id === id)
}
