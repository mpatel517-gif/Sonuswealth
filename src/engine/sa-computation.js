// ─────────────────────────────────────────────────────────────────────────────
// SA-COMPUTATION — UK Self-Assessment filing-format tax engine  (M1·1C)
//
// Produces an SA100/SA110-shaped computation a user can take to their accountant
// to VERIFY — an estimate, not a return we file. It ORCHESTRATES the existing
// canonical engine (it does not re-derive tax): calcIncomeTax (the single source
// of the income-tax base, which reconciles the two competing income shapes),
// te_nicsDetail, te_cgtDetail, te_dividendTaxDetail. Every line carries a
// plain-English formula, a real statutory citation, a data source and a
// confidence so the drill surface (L4NumberPanel) can show "how this was
// calculated / where it came from".
//
// Path-dependence is honoured via the carry-forward ledger: capital losses c/f
// reduce the chargeable gain; payments-on-account derive from prior-year
// liability. Where prior-year state is unknown, lines are flagged `provisional`
// with an assumption string (honest-absence — never silent zero).
//
// OUT OF SCOPE here: IHT is NOT on the SA return (it feeds Timeline/Estate only);
// submission to HMRC (we are not a tax agent). See plan M1·1C / founder 2026-06-08.
//
// Page-extensible: SA_PAGES is a registry keyed by SA page. M4 adds SA104/106/
// 107/109 as new builders + registry entries — no rearchitecting.
// ─────────────────────────────────────────────────────────────────────────────

import {
  calcIncomeTax,
  calcPersonalAllowance,
  allowanceTracker,
  te_nicsDetail,
  te_cgtDetail,
  te_dividendTaxDetail,
  te_taxThisYear,
  TAX,
} from './fq-calculator.js'
import { buildCarryForwardLedger } from './carry-forward-state.js'

// Real statutory / HMRC-manual citations — accountant-meaningful, and (unlike the
// internal UK-IT-* bundle ids) not "figures", so they read as verification refs.
const RULE = {
  income_tax:        'Income Tax Act 2007',
  personal_allowance:'ITA 2007 s35',
  pa_taper:          'ITA 2007 s35(2) (PA taper £100k–£125,140)',
  dividends:         'ITTOIA 2005 Pt 4 Ch 3',
  savings:           'ITTOIA 2005 Pt 4 Ch 2; PSA ITA 2007 s12B',
  employment:        'ITEPA 2003',
  self_employment:   'ITTOIA 2005 Pt 2',
  property:          'ITTOIA 2005 Pt 3',
  cgt:               'TCGA 1992',
  cgt_aea:           'TCGA 1992 s1K (annual exempt amount)',
  cgt_losses:        'TCGA 1992 s2A/s3 (losses carried forward)',
  nic_class1:        'SSCBA 1992 s6 (Class 1)',
  nic_class2:        'SSCBA 1992 s11 (Class 2)',
  nic_class4:        'SSCBA 1992 s15 (Class 4)',
  poa:               'TMA 1970 s59A (payments on account)',
  balancing:         'TMA 1970 s59B (balancing payment)',
}

const DISCLAIMER =
  'Estimate to help you and your accountant verify your position. This is not a ' +
  'tax return and Sonuswealth does not file or submit it to HMRC. Figures marked ' +
  '“provisional” assume no prior-year data — add your last return to firm them up.'

function _round(n) { return Math.round(+n || 0) }
function _gbp(n) { return `£${_round(n).toLocaleString('en-GB')}` }

// Mirror calcAllIncome's salary-alias MAX so NIC (te_nicsDetail reads income.salary
// RAW — the income-shape trap) is correct for director/Add-flow personas, whose
// salary lives in directorSalary / employment, not salary.
function _canonicalSalary(entity) {
  const inc = entity?.income || {}
  const ind = entity?.individual || {}
  return Math.max(
    +(ind.gross_salary || 0),
    +(inc.salary || 0),
    +(inc.employment || 0),
    +(inc.directorSalary || 0),
  )
}
function _canonicalSelfEmp(entity) {
  const inc = entity?.income || {}
  return Math.max(+(inc.selfEmployed || 0), +(inc.selfEmploymentNet || 0))
}

// A line on a section/page.
function _line(label, amount, { sa_box, rule, formula, source, confidence = 'high', provisional = false } = {}) {
  return { sa_box, label, amount: _round(amount), rule: rule ? [rule] : [], formula, source, confidence, provisional }
}

// ── Page builders ─────────────────────────────────────────────────────────────
// Each: (entity, ctx) => Line[].  ctx = { cit, nics, cgt, divd, allow, ledger, bundle }.
// A page also declares `applies(entity, ctx)`.

const sa102Employment = {
  page: 'SA102',
  title: 'Employment',
  applies: (e) => _canonicalSalary(e) > 0,
  lines: (e) => {
    const salary = _canonicalSalary(e)
    const payeTax = +(e?.income?.payeTaxPaid ?? e?.tax?.payeTaxPaid ?? 0)
    const payeKnown = e?.income?.payeTaxPaid != null || e?.tax?.payeTaxPaid != null
    return [
      _line('Pay from this employment', salary, {
        sa_box: 'SA102 box 1', rule: RULE.employment,
        formula: 'Gross employment / director salary (max of salary aliases)',
        source: 'income.salary / employment / directorSalary',
      }),
      _line('UK tax taken off pay (PAYE)', payeTax, {
        sa_box: 'SA102 box 2', rule: RULE.employment,
        formula: payeKnown ? 'Tax deducted at source via PAYE' : 'Estimate — no PAYE figure captured; assumed £0',
        source: payeKnown ? 'income.payeTaxPaid' : 'default',
        confidence: payeKnown ? 'high' : 'low', provisional: !payeKnown,
      }),
    ]
  },
}

const sa103SelfEmployment = {
  page: 'SA103',
  title: 'Self-employment',
  applies: (e) => _canonicalSelfEmp(e) > 0,
  lines: (e) => {
    const net = _canonicalSelfEmp(e)
    return [
      _line('Net profit from self-employment', net, {
        sa_box: 'SA103 net profit', rule: RULE.self_employment,
        formula: 'Self-employment net profit (turnover less allowable expenses)',
        source: 'income.selfEmploymentNet',
        // Net-only: no SA103 turnover/expense breakdown captured.
        confidence: e?.income?.selfEmploymentExpenses != null ? 'high' : 'med',
      }),
    ]
  },
}

const sa105Property = {
  page: 'SA105',
  title: 'UK property',
  applies: (e) => (+(e?.income?.rentalIncomeNet || e?.income?.rental || e?.income?.rentalIncome || 0)) > 0,
  lines: (e, ctx) => {
    const net = +(e?.income?.rentalIncomeNet || e?.income?.rental || e?.income?.rentalIncome || 0)
    const rentalLossCf = ctx.ledger.fields.losses.rental_cf
    const lossProv = ctx.ledger.provenance.losses.provisional
    const out = [
      _line('UK property — taxable profit', net, {
        sa_box: 'SA105 taxable profit', rule: RULE.property,
        formula: 'Net rental profit (rents received less allowable expenses; finance costs restricted to 20% credit s24)',
        source: 'income.rentalIncomeNet',
        confidence: e?.income?.rentalExpenses != null ? 'high' : 'med',
      }),
    ]
    if (rentalLossCf > 0 || lossProv) {
      out.push(_line('Less: property losses brought forward', -Math.min(rentalLossCf, net), {
        sa_box: 'SA105 loss b/f', rule: RULE.property,
        formula: lossProv ? 'Estimate — assumes no property losses carried forward' : 'Prior-year property losses set against this year’s profit',
        source: lossProv ? 'default' : 'carry-forward ledger',
        confidence: lossProv ? 'low' : 'med', provisional: lossProv,
      }))
    }
    return out
  },
}

const sa108CapitalGains = {
  page: 'SA108',
  title: 'Capital gains',
  applies: (e, ctx) => (ctx.cgt.total_gain || 0) > 0,
  lines: (e, ctx) => {
    const { cgt, ledger } = ctx
    const lossCf = ledger.fields.losses.capital_cf
    const lossProv = ledger.provenance.losses.provisional
    const gainAfterAea = cgt.taxable_gain // already net of AEA
    const lossUsed = Math.min(lossCf, gainAfterAea)
    const out = [
      _line('Total gains in the year', cgt.total_gain, {
        sa_box: 'SA108 total gains', rule: RULE.cgt,
        formula: 'Sum of chargeable gains realised this year',
        source: 'assets.cgt.realisedThisYear',
      }),
      _line('Less: annual exempt amount', -cgt.annual_exemption.used, {
        sa_box: 'SA108 AEA', rule: RULE.cgt_aea,
        formula: `Capital gains tax-free allowance (${_gbp(cgt.annual_exemption.total)})`,
        source: 'rules bundle (CGT AEA)',
      }),
    ]
    if (lossCf > 0 || lossProv) {
      out.push(_line('Less: capital losses brought forward', -lossUsed, {
        sa_box: 'SA108 losses b/f', rule: RULE.cgt_losses,
        formula: lossProv
          ? 'Estimate — assumes no capital losses carried forward'
          : 'Prior-year capital losses set against gains after the annual exempt amount',
        source: lossProv ? 'default' : 'carry-forward ledger',
        confidence: lossProv ? 'low' : 'med', provisional: lossProv,
      }))
    }
    return out
  },
}

// SA100 core — savings + dividends summary (employment/SE/property sit on their
// own supplementary pages above). The tax computation tail is built separately.
const sa100Core = {
  page: 'SA100',
  title: 'Income (SA100 main return)',
  applies: () => true,
  lines: (e, ctx) => {
    const { cit, divd } = ctx
    const out = []
    if (cit.base.savings > 0) {
      out.push(_line('Taxed UK interest and savings income', cit.base.savings, {
        sa_box: 'SA100 TR3', rule: RULE.savings,
        formula: 'Interest received (Personal Savings Allowance applied in the tax computation)',
        source: 'income.interest / savingsInterest',
      }))
    }
    if ((divd.total_dividend || 0) > 0) {
      out.push(_line('Dividends from UK companies', divd.gia_exposed, {
        sa_box: 'SA100 TR3', rule: RULE.dividends,
        formula: 'Dividends outside ISAs (£500 dividend allowance applied in the computation)',
        source: 'income.dividends / directorDividends (net of ISA shielding)',
      }))
    }
    return out
  },
}

// ── M4 — comprehensive supplementary pages ────────────────────────────────────
// These complete the SA page set. Persona source-data for them is sparse today
// (no SA104 partnership detail, no SA106 foreign breakdown, residence is a bare
// enum), so each only renders when its trigger field is present, and emits a
// provisional line when the detail behind it wasn't captured. Adding a page is a
// new builder + a registry entry — no rearchitecting.

const sa104Partnership = {
  page: 'SA104',
  title: 'Partnership',
  applies: (e) => (+(e?.income?.partnership || e?.income?.partnershipProfit || 0)) > 0,
  lines: (e) => [
    _line('Share of partnership profit', +(e?.income?.partnership || e?.income?.partnershipProfit || 0), {
      sa_box: 'SA104 profit share', rule: RULE.self_employment,
      formula: 'Your share of the partnership’s taxable profit',
      source: 'income.partnership',
      confidence: e?.income?.partnershipDetail != null ? 'high' : 'med',
    }),
  ],
}

const sa106Foreign = {
  page: 'SA106',
  title: 'Foreign income',
  applies: (e) => (+(e?.income?.overseasIncome || e?.income?.foreignIncome || e?.income?.foreignDividends || 0)) > 0,
  lines: (e) => {
    const foreign = +(e?.income?.overseasIncome || e?.income?.foreignIncome || 0)
    const foreignDiv = +(e?.income?.foreignDividends || 0)
    const ftcr = +(e?.income?.foreignTaxPaid || 0)
    const ftcrKnown = e?.income?.foreignTaxPaid != null
    const out = []
    if (foreign > 0) out.push(_line('Overseas income', foreign, {
      sa_box: 'SA106 foreign income', rule: 'ITTOIA 2005 (foreign income)',
      formula: 'Income arising outside the UK (arising basis assumed)', source: 'income.overseasIncome',
    }))
    if (foreignDiv > 0) out.push(_line('Foreign dividends', foreignDiv, {
      sa_box: 'SA106 foreign dividends', rule: RULE.dividends,
      formula: 'Dividends from non-UK companies', source: 'income.foreignDividends',
    }))
    out.push(_line('Foreign tax credit relief', -ftcr, {
      sa_box: 'SA106 FTCR', rule: 'TIOPA 2010 (double-taxation relief)',
      formula: ftcrKnown ? 'Relief for overseas tax already paid' : 'Estimate — no foreign tax paid captured; assumed £0',
      source: ftcrKnown ? 'income.foreignTaxPaid' : 'default',
      confidence: ftcrKnown ? 'high' : 'low', provisional: !ftcrKnown,
    }))
    return out
  },
}

const sa107Trusts = {
  page: 'SA107',
  title: 'Trusts & estates',
  applies: (e) => (+(e?.income?.trustIncome || 0)) > 0,
  lines: (e) => [
    _line('Income from trusts or settlements', +(e?.income?.trustIncome || 0), {
      sa_box: 'SA107 trust income', rule: 'ITTOIA 2005 Pt 5 Ch 6',
      formula: 'Income received as a beneficiary of a trust or estate (tax credit may apply)',
      source: 'income.trustIncome',
      confidence: e?.income?.trustTaxCredit != null ? 'high' : 'med',
    }),
  ],
}

const sa109Residence = {
  page: 'SA109',
  title: 'Residence & domicile',
  // Only relevant for non-UK-resident / split-year / remittance-basis filers —
  // NOT the Scottish/Welsh income-tax variants (those don't need SA109).
  applies: (e) => !!e?.nonUKResident || e?.residencyStatus === 'non-resident' || !!e?.remittanceBasis || !!e?.splitYear,
  lines: (e) => [
    _line('Residence / domicile status', 0, {
      sa_box: 'SA109', rule: 'FA 2013 (Statutory Residence Test)',
      formula: `Declared status: ${e?.residencyStatus || (e?.nonUKResident ? 'non-UK-resident' : 'see SRT')}${e?.remittanceBasis ? ' · remittance basis' : ''}${e?.splitYear ? ' · split year' : ''}`,
      source: 'residencyStatus / nonUKResident',
      confidence: 'med', provisional: true,
    }),
  ],
}

const SA_PAGES = [
  sa100Core, sa102Employment, sa103SelfEmployment, sa105Property, sa108CapitalGains,
  sa104Partnership, sa106Foreign, sa107Trusts, sa109Residence,
]

// ── Payments on account (TMA 1970 s59A) ───────────────────────────────────────
// POA for NEXT year = 50% each of THIS year's (income tax + Class 4 NIC),
// EXCLUDING CGT and Class 2. Not due if the relevant liability is below the POA
// threshold OR ≥80% of tax was collected at source. Due 31 Jan & 31 Jul.
function paymentsOnAccount(incomeTaxPlusClass4, taxAtSource, totalDue) {
  const t = TAX.poaThreshold      // £1,000 de-minimis, sourced from the rules bundle
  const pct = TAX.poaPercentage   // 50% each, from the bundle
  // s59A(1)(b): not due if ≥80% of the year's tax was met by deduction at source.
  const taxedAtSourcePct = totalDue > 0 ? taxAtSource / (taxAtSource + totalDue) : 0
  const required = incomeTaxPlusClass4 >= t && taxedAtSourcePct < 0.8
  const each = required ? Math.round(incomeTaxPlusClass4 * pct) : 0
  return { required, each, threshold: t }
}

function _startYear(year) {
  const m = String(year).match(/(\d{4})/)
  return m ? +m[1] : new Date().getFullYear()
}

/**
 * Build the SA filing-format computation for an entity.
 *
 * @param {object} entity
 * @param {string} [year='tax-2026-27']
 * @param {string} [bundle='UK-2026.1']
 * @param {object} [opts]
 * @param {object} [opts.priorYearStore] — partial carry-forward ledger derived
 *        from a prior-year SA store (M2). Drives losses c/f + payments on account.
 * @param {number} [opts.priorYearLiability] — prior-year (income tax + Class 4)
 *        used as the payments-on-account ALREADY MADE toward this year. Absent ⇒
 *        provisional 0.
 * @returns {object} { year, bundle, sections, computation, disclaimer, confidence, provenance }
 */
export function saComputation(entity, year = 'tax-2026-27', bundle = 'UK-2026.1', opts = {}) {
  if (!entity) return null
  const ledger = buildCarryForwardLedger(entity, opts.priorYearStore || null)

  // Canonical orchestration — reuse, never recompute.
  const cit = calcIncomeTax(entity)
  // NIC needs canonical salary (te_nicsDetail reads income.salary raw).
  const nicEntity = {
    ...entity,
    income: { ...(entity.income || {}), salary: _canonicalSalary(entity), selfEmployed: _canonicalSelfEmp(entity) },
  }
  const nics = te_nicsDetail(nicEntity, 0, bundle)
  const cgt  = te_cgtDetail(entity, [], bundle)
  const divd = te_dividendTaxDetail(entity, [], bundle)
  const allow = allowanceTracker(entity)

  const ctx = { cit, nics, cgt, divd, allow, ledger, bundle }

  // Sections (only pages that apply).
  const sections = SA_PAGES
    .filter((p) => p.applies(entity, ctx))
    .map((p) => ({ page: p.page, title: p.title, lines: p.lines(entity, ctx) }))

  // ── Computation tail (SA110-shaped) ──
  const pa = calcPersonalAllowance(cit.base.ani, bundle)
  const incomeTaxDue = cit.nsndTax + cit.savingsTax // non-dividend income tax
  const dividendTax = cit.dividendTax
  const class2 = +(TAX.nicClass2Annual ?? 0) // Class 2 largely voluntary from 2024/25
  const class4 = nics.class4

  // CGT after carry-forward losses (cgtDetail reports losses but doesn't apply them).
  const lossCf = ledger.fields.losses.capital_cf
  const lossProv = ledger.provenance.losses.provisional
  const taxableGainAfterLosses = Math.max(0, cgt.taxable_gain - lossCf)
  const cgtDue = cgt.taxable_gain > 0
    ? Math.round(taxableGainAfterLosses * (cgt.tax_due / Math.max(1, cgt.taxable_gain)))
    : 0

  // Tax already paid at source (PAYE) — if captured.
  const payeTax = +(entity?.income?.payeTaxPaid ?? entity?.tax?.payeTaxPaid ?? 0)
  const payeKnown = entity?.income?.payeTaxPaid != null || entity?.tax?.payeTaxPaid != null

  const taxDueBeforePoa = incomeTaxDue + dividendTax + class2 + class4 + cgtDue
  const incomeTaxPlusClass4 = incomeTaxDue + dividendTax + class4 // POA base (excludes CGT, Class 2)

  // Payments already on account toward THIS year (from prior-year liability).
  const poaMade = +(opts.priorYearLiability) > 0 ? Math.round(+opts.priorYearLiability) : 0
  const poaMadeKnown = +(opts.priorYearLiability) > 0
  const balancingPayment = Math.max(0, taxDueBeforePoa - payeTax - poaMade)

  // Payments on account for NEXT year.
  const poa = paymentsOnAccount(incomeTaxPlusClass4, payeTax, taxDueBeforePoa)
  const sy = _startYear(year)
  const dueY = sy + 2 // 2026-27 return → due 31 Jan 2028 / 31 Jul 2028
  // Provisional only while PAYE-at-source is unknown (the ≥80% test can't be
  // evaluated), not because of the threshold (now sourced from the bundle).
  const poaNextYear = poa.required
    ? [
        { date: `${dueY}-01-31`, amount: poa.each, provisional: !payeKnown },
        { date: `${dueY}-07-31`, amount: poa.each, provisional: !payeKnown },
      ]
    : []

  const computation = {
    total_income: cit.base.total,
    reliefs: 0, // pension/gift-aid reliefs are netted into ANI upstream; surfaced in M2
    personal_allowance: pa,
    taxable_income: Math.max(0, cit.base.total - pa),
    tax_by_band: cit.byBand.map((b) => ({ band: b.type, rate: b.rate, amount: b.amount })),
    tax_at_source: { paye: payeTax, cis: 0 },
    income_tax_due: incomeTaxDue,
    dividend_tax: dividendTax,
    nic: { class2, class4 },
    cgt_due: cgtDue,
    tax_due_before_poa: taxDueBeforePoa,
    payments_on_account_made: poaMade,
    balancing_payment: balancingPayment,
    poa_next_year: poaNextYear,
  }

  // Provenance / confidence rollup.
  const provisionalFlags = []
  if (!payeKnown) provisionalFlags.push('PAYE tax at source assumed £0')
  if (!poaMadeKnown) provisionalFlags.push('no payments on account assumed already made')
  if (lossProv && cgt.taxable_gain > 0) provisionalFlags.push('no capital losses carried forward assumed')

  const confidence = provisionalFlags.length === 0 ? 'high' : provisionalFlags.length <= 1 ? 'med' : 'low'

  return {
    year,
    bundle,
    sections,
    computation,
    disclaimer: DISCLAIMER,
    confidence,
    provisionalFlags,
    provenance: {
      orchestration: 'calcIncomeTax (base) + te_nicsDetail + te_cgtDetail + te_dividendTaxDetail',
      carry_forward: ledger.provenance,
      cgt_losses_applied: lossProv ? 'none (provisional)' : `${_gbp(Math.min(lossCf, cgt.taxable_gain))} set against gains`,
    },
  }
}

export { paymentsOnAccount, DISCLAIMER as SA_DISCLAIMER }
