// ─────────────────────────────────────────────────────────────────────────────
// DECUMULATION — PER-HOLDING NORMALISER  (engine P1)
//
// Reads an entity's assets/income (the persona shapes that drift across fixtures)
// into the §3 per-holding data model the new solver evaluates. Graceful: where a
// rich field (gar, protectedTfcPct, embeddedGainPct, amc) is absent it is left
// undefined and the classifier falls back to the taxonomy base class.
//
// Founder decision (2026-06-03): full §3 model is the target. P1 reads whatever
// the fixture carries today; P2 migrates fixtures (Bruce full, Mr T stress) to the
// full attribute set. Output of this module is a flat holdings[] array.
//
// Spec: 2026-06-03-decumulation-engine-redesign-SPEC.md §3.
// ─────────────────────────────────────────────────────────────────────────────

import { TAXONOMY_DRAW_CLASS } from './decumulation-classify.js'

const num = (...xs) => { for (const x of xs) { const n = +x; if (Number.isFinite(n) && n !== 0) return n } return 0 }
const firstDefined = (...xs) => xs.find(x => x != null)

// DB / safeguarded detector — same family as the legacy solver's isDB.
const DB_RE = /\b(db|defined[\s-]?benefit|final[\s-]?salary|career[\s-]?average|safeguarded)\b/i

/** Map a persona `type` string to a taxonomy ID, defaulting sensibly per category. */
function toTaxonomyId(typeStr, category) {
  const raw = String(typeStr || '').trim()
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_')
  if (TAXONOMY_DRAW_CLASS[upper]) return upper
  if (category === 'pensions' && DB_RE.test(raw)) return 'DB'
  const fallback = { pensions: 'SIPP', investments: 'GIA', cash: 'SAVINGS', property: 'RESIDENCE', business: 'LTD_INVESTMENT', alternatives: 'PE' }
  return fallback[category] || 'SIPP'
}

let _uid = 0
const mkId = (prefix) => `${prefix}-${++_uid}`

/** Pensions → PensionScheme holdings (DC pots + DB/annuity income floors). */
function pensionHoldings(a, inc) {
  const out = []
  const sipp = a.sipp || {}
  const list = Array.isArray(sipp.pensions) ? sipp.pensions : []
  if (list.length) {
    for (const p of list) {
      const taxonomyId = toTaxonomyId(p.type, 'pensions')
      const isDB = taxonomyId === 'DB' || DB_RE.test(String(p.type || '')) || p.isPot === false
      out.push({
        id: p.id || mkId('pen'), taxonomyId, category: 'pensions', provider: p.provider,
        currentValue: isDB ? null : num(p.value, p.total),
        isPot: !isDB,
        guaranteedAnnual: isDB ? num(p.annualIncome, p.income, p.guaranteedAnnual) : undefined,
        cetv: firstDefined(p.cetv, p.transferValue),
        amc: firstDefined(p.charge, p.amc), ocf: p.ocf,
        gar: p.gar, garRate: p.garRate,
        protectedTfcPct: p.protectedTfcPct,
        isSafeguarded: isDB || p.gar || p.gmp || p.isSafeguarded,
        gmp: p.gmp, withProfits: p.withProfits, mvrApplies: p.mvrApplies,
        crystallised: !!p.crystallised, smallPotEligible: num(p.value) > 0 && num(p.value) <= 10000,
        growthRate: firstDefined(p.growth_rate_assumption, p.growthRate, sipp.growth),
        estateTreatment: 'from-2027',
        funds: Array.isArray(p.funds) ? p.funds : undefined,
        inflationLinked: p.inflationLinked || p.escalation,
      })
    }
  } else if (num(sipp.total) > 0) {
    out.push({ id: mkId('pen'), taxonomyId: 'SIPP', category: 'pensions',
      currentValue: num(sipp.total), isPot: true, amc: sipp.charge,
      growthRate: sipp.growth, estateTreatment: 'from-2027',
      crystallised: !!sipp.crystalised, pclsTakenSoFar: num(sipp.tfcTaken) })
  }

  // DB / annuity income carried on the income or top-level asset record.
  const dbAnnual = num(a.dbPension?.annualIncome, a.dbPension?.income, inc.dbPension)
  if (dbAnnual > 0) out.push({ id: mkId('db'), taxonomyId: 'DB', category: 'pensions',
    currentValue: null, isPot: false, isSafeguarded: true,
    guaranteedAnnual: dbAnnual, cetv: num(a.dbPension?.cetv), estateTreatment: 'outside',
    inflationLinked: a.dbPension?.inflationLinked })
  const annuity = num(a.annuity?.annualIncome, inc.annuity)
  if (annuity > 0) out.push({ id: mkId('ann'), taxonomyId: 'ANNUITY', category: 'pensions',
    currentValue: null, isPot: false, guaranteedAnnual: annuity, estateTreatment: 'outside' })

  // State Pension — guaranteed lifetime income, defines the pre-STP bridge.
  const sp = inc.statePension
  const spAnnual = num(sp?.annual, typeof sp === 'number' ? sp : 0)
  if (spAnnual > 0) out.push({ id: mkId('state'), taxonomyId: 'STATE', category: 'pensions',
    currentValue: null, isPot: false, guaranteedAnnual: spAnnual,
    startAge: num(sp?.startAge) || undefined, escalation: 'tripleLock', estateTreatment: 'outside' })

  return out
}

/** ISA + GIA + other wrapped/unwrapped investments. */
function investmentHoldings(a) {
  const out = []
  const isa = a.isa || {}
  const isaCash = num(isa.cash, isa.cashValue)
  const isaSS = num(isa.value, isa.stocks, isa.total) - (isaCash && (isa.cash != null) ? 0 : 0)
  if (num(isa.value, isa.total, isa.stocks) > 0) out.push({ id: mkId('isa'), taxonomyId: 'ISA_SS',
    category: 'investments', wrapperClass: 'ISA_FAMILY', currentValue: num(isa.value, isa.total, isa.stocks),
    isPot: true, dividendYield: isa.yield, estateTreatment: 'in' })
  if (isaCash > 0) out.push({ id: mkId('isac'), taxonomyId: 'ISA_CASH', category: 'investments',
    wrapperClass: 'ISA_FAMILY', currentValue: isaCash, isPot: true, estateTreatment: 'in' })

  const gia = a.portfolio || a.gia || a.investments
  if (gia && num(gia.value) > 0) {
    const book = num(gia.bookCost, gia.cost, gia.purchasePrice)
    const val = num(gia.value)
    out.push({ id: mkId('gia'), taxonomyId: 'GIA', category: 'investments', wrapperClass: 'UNWRAPPED',
      currentValue: val, isPot: true, bookCost: book || undefined,
      embeddedGainPct: gia.embeddedGainPct != null ? +gia.embeddedGainPct : (book > 0 ? Math.max(0, (val - book) / val) : undefined),
      holdsAimBpr: !!gia.bpr, dividendYield: gia.yield, estateTreatment: 'in' })
  }
  // Explicit venture reliefs if the fixture carries them.
  for (const [key, tax] of [['eis', 'EIS'], ['seis', 'SEIS'], ['vct', 'VCT']]) {
    const v = a[key]
    if (v && num(v.value) > 0) out.push({ id: mkId(key), taxonomyId: tax, category: 'investments',
      wrapperClass: 'VENTURE_RELIEF', currentValue: num(v.value), isPot: true,
      reliefHoldingEndDate: v.reliefHoldingEndDate || v.holdingEndDate,
      incomeReliefClaimed: v.incomeReliefClaimed, estateTreatment: 'outside' })
  }
  return out
}

/** Cash & secure deposits — per-account where the fixture lists them, else one blob. */
function cashHoldings(a) {
  const out = []
  const cash = a.cash || {}
  const accounts = Array.isArray(cash.accounts) ? cash.accounts : null
  if (accounts) {
    for (const acc of accounts) {
      const taxonomyId = toTaxonomyId(acc.type, 'cash')
      out.push({ id: acc.id || mkId('cash'), taxonomyId, category: 'cash', provider: acc.bank || acc.provider,
        currentValue: num(acc.balance, acc.value), balance: num(acc.balance, acc.value), isPot: true,
        rate: acc.rate, estateTreatment: 'in' })
    }
  } else if (num(cash.total, cash.own, cash.value) > 0) {
    out.push({ id: mkId('cash'), taxonomyId: 'SAVINGS', category: 'cash',
      currentValue: num(cash.total, cash.own, cash.value), balance: num(cash.total, cash.own, cash.value),
      isPot: true, rate: cash.rate, estateTreatment: 'in' })
  }
  return out
}

/** Property — residence (not income) + rentals (income floor, capital kept). */
function propertyHoldings(a, inc) {
  const out = []
  const list = Array.isArray(a.property) ? a.property : []
  let anyRental = false
  for (const p of list) {
    const isRental = !!(p.isRental || p.rentalGrossAnnual || p.rentalNetAnnual)
    const taxonomyId = toTaxonomyId(p.type, 'property') === 'RESIDENCE' && isRental ? 'BTL' : toTaxonomyId(p.type, 'property')
    if (isRental) anyRental = true
    out.push({ id: p.id || mkId('prop'), taxonomyId: isRental && taxonomyId === 'RESIDENCE' ? 'BTL' : taxonomyId,
      category: 'property', currentValue: num(p.value, p.value_gbp), isPot: isRental ? false : false,
      isMainResidence: !!p.isMainResidence, rentalGrossAnnual: num(p.rentalGrossAnnual),
      rentalNetAnnual: num(p.rentalNetAnnual, p.isRental ? p.rentalGrossAnnual : 0),
      acquisitionValue: num(p.purchasePrice, p.acquisitionValue), estateTreatment: 'in' })
  }
  if (num(a.residence?.value) > 0) out.push({ id: mkId('res'), taxonomyId: 'RESIDENCE', category: 'property',
    currentValue: num(a.residence.value), isPot: false, isMainResidence: true, estateTreatment: 'in' })
  for (const [key] of [['btl'], ['buyToLet']]) {
    if (num(a[key]?.value) > 0) { anyRental = true; out.push({ id: mkId('btl'), taxonomyId: 'BTL', category: 'property',
      currentValue: num(a[key].value), isPot: false, rentalNetAnnual: num(a[key].rentalNetAnnual), estateTreatment: 'in' }) }
  }
  // Rental income stated only at the income level (no property record carrying it).
  const incRental = num(inc.rentalIncome, inc.rental, inc.rent)
  if (!anyRental && incRental > 0) out.push({ id: mkId('rent'), taxonomyId: 'BTL', category: 'property',
    currentValue: null, isPot: false, rentalNetAnnual: incRental, estateTreatment: 'in' })
  return out
}

/** Business + alternatives — carried through so the classifier can exclude/flag. */
function otherHoldings(a) {
  const out = []
  const pushList = (list, category) => {
    if (!Array.isArray(list)) return
    for (const v of list) out.push({ id: v.id || mkId(category), taxonomyId: toTaxonomyId(v.type, category),
      category, currentValue: num(v.value, v.value_gbp), isPot: true,
      bprQualifying: !!v.bprQualifying, royaltyAnnualIncome: num(v.royaltyAnnualIncome),
      reliefHoldingEndDate: v.reliefHoldingEndDate, estateTreatment: v.estate || 'in' })
  }
  pushList(a.business, 'business'); pushList(a.businesses, 'business')
  pushList(a.alternatives, 'alternatives'); pushList(a.alts, 'alternatives')
  if (num(a.crypto?.value) > 0) out.push({ id: mkId('crypto'), taxonomyId: 'CRYPTO', category: 'alternatives',
    currentValue: num(a.crypto.value), isPot: true, estateTreatment: 'in' })
  return out
}

/**
 * Build the flat §3 holdings[] for an entity. Pure read — never mutates the entity.
 * @param {object} entity persona / live entity
 * @returns {object[]} holdings
 */
export function normaliseHoldings(entity = {}) {
  _uid = 0
  const a = entity.assets || {}
  const inc = entity.income || {}
  return [
    ...pensionHoldings(a, inc),
    ...investmentHoldings(a),
    ...cashHoldings(a),
    ...propertyHoldings(a, inc),
    ...otherHoldings(a),
  ].filter(h => h.currentValue == null ? (num(h.guaranteedAnnual, h.rentalNetAnnual, h.royaltyAnnualIncome) > 0) : num(h.currentValue) !== 0)
}
