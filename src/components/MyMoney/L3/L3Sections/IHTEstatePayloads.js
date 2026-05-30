// IHTEstatePayloads.js — pure payload builders for the IHT-estate L3 panel.
//
// Plan reference: L3 Tier-A IHT Estate panel.
// Pure JS — no React, no JSX. Node-importable.
//
// Each builder accepts the ihtExposure(entity) output and returns:
//   { formula, source, confidence, breakdown }
//
// These are EXPLAINER-ONLY payloads — no `editable` fields, because IHT is
// computed from asset inputs that live on their own panels. Correcting the
// underlying assets there will ripple into this panel automatically.
//
// source always cites engine.ihtExposure(entity) so provenance is traceable.

import { fmt } from '../../../../engine/fq-calculator.js'

const placeholder = (label) => [{ label, value: 'No detail recorded yet' }]

/**
 * Payload for the IHT total — used for the hero drillable and taxable-estate row.
 * @param {object} exp  — ihtExposure(entity) output
 */
export function ihtTotalPayload(exp) {
  const rate = exp.effective_iht_rate != null
    ? `${Math.round(exp.effective_iht_rate * 100)}% effective rate`
    : 'rate unknown'

  return {
    formula: 'Taxable estate × 40% (or 36% where ≥10% left to charity). Taxable estate = net estate minus your tax-free bands and any qualifying reliefs.',
    source: 'engine.ihtExposure(entity) → iht_due, taxable_estate, effective_iht_rate',
    confidence: exp.confidence || 'medium',
    breakdown: [
      { label: 'Gross estate',         value: fmt(exp.gross_estate || 0) },
      { label: 'Less: debts',          value: fmt(exp.deductions?.debts || 0) },
      { label: 'Less: funeral costs',  value: fmt(exp.deductions?.funeral || 0) },
      { label: 'Net estate',           value: fmt(exp.net_estate || 0) },
      { label: 'Less: tax-free bands', value: fmt((exp.nrb?.available || 0) + (exp.rnrb?.available || 0)) },
      { label: 'Less: reliefs',        value: fmt(
          (exp.reliefs?.apr_bpr?.tier1_100pct || 0) +
          (exp.reliefs?.apr_bpr?.tier2_50pct_above_allowance || 0) +
          (exp.reliefs?.apr_bpr?.tier2_50pct_aim_or_not_listed || 0) +
          (exp.reliefs?.charity?.pre_2027_estate_assets || 0) +
          (exp.reliefs?.charity?.post_2027_pension_assets || 0)
        )
      },
      { label: 'Taxable estate',       value: fmt(exp.taxable_estate || 0) },
      { label: 'IHT due',              value: fmt(exp.iht_due || 0) },
      { label: 'Effective rate',       value: rate },
    ],
  }
}

/**
 * Payload for the gross estate row.
 * @param {object} exp  — ihtExposure(entity) output
 */
export function grossEstatePayload(exp) {
  const breakdown = []
  const gross = exp.gross_estate || 0
  if (gross === 0) return {
    formula: 'Sum of all estate assets at death — property, investments, cash, and pension (from April 2027).',
    source: 'engine.ihtExposure(entity) → gross_estate',
    confidence: 'low',
    breakdown: placeholder('No estate assets recorded'),
  }

  breakdown.push({ label: 'Total gross estate', value: fmt(gross) })
  if (exp.deductions?.debts != null) {
    breakdown.push({ label: 'Outstanding debts', value: fmt(exp.deductions.debts) })
  }
  if (exp.deductions?.funeral != null) {
    breakdown.push({ label: 'Funeral expenses', value: fmt(exp.deductions.funeral) })
  }
  breakdown.push({ label: 'Net estate (after deductions)', value: fmt(exp.net_estate || 0) })

  return {
    formula: 'All assets owned at death: property, ISAs, general investments, cash, and pension pots (in scope from April 2027 under Finance Act 2026). Life insurance is included unless written into a trust.',
    source: 'engine.ihtExposure(entity) → gross_estate, deductions, net_estate',
    confidence: exp.confidence || 'medium',
    breakdown,
  }
}

/**
 * Payload for the tax-free bands row — NRB + RNRB, used and available.
 * @param {object} exp  — ihtExposure(entity) output
 */
export function bandsPayload(exp) {
  const nrb  = exp.nrb  || {}
  const rnrb = exp.rnrb || {}

  const transferableNRB  = nrb.transferable_from_spouse || 0
  const transferableRNRB = rnrb.transferable_from_spouse || 0

  const breakdown = [
    { label: 'Standard nil-rate band (NRB) available',     value: fmt(nrb.available  || 0) },
    { label: 'NRB used against net estate',                value: fmt(nrb.used       || 0) },
  ]
  if (transferableNRB > 0) {
    breakdown.push({ label: 'Transferred nil-rate band from spouse', value: fmt(transferableNRB) })
  }
  breakdown.push(
    { label: 'Residence nil-rate band (RNRB) available',  value: fmt(rnrb.available || 0) },
    { label: 'RNRB used against net estate',              value: fmt(rnrb.used      || 0) },
  )
  if (transferableRNRB > 0) {
    breakdown.push({ label: 'Transferred RNRB from spouse', value: fmt(transferableRNRB) })
  }
  breakdown.push({
    label: 'Total tax-free bands',
    value: fmt((nrb.available || 0) + (rnrb.available || 0)),
  })

  const hasRNRB = (rnrb.available || 0) > 0
  const hasTransfer = transferableNRB > 0 || transferableRNRB > 0

  return {
    formula: 'Every estate gets a standard nil-rate band (NRB). If you pass a home to direct descendants you also get a residence nil-rate band (RNRB). Married couples and civil partners can transfer any unused band from a deceased spouse, effectively doubling the allowances.',
    source: 'engine.ihtExposure(entity) → nrb.available, nrb.used, rnrb.available, rnrb.used, transferable_from_spouse',
    confidence: hasRNRB ? 'high' : (hasTransfer ? 'medium' : 'high'),
    breakdown,
  }
}

/**
 * Payload for the reliefs row — business/agricultural property relief + charity.
 * @param {object} exp  — ihtExposure(entity) output
 */
export function reliefsPayload(exp) {
  const bpr     = exp.reliefs?.apr_bpr    || {}
  const charity = exp.reliefs?.charity    || {}

  const tier1       = bpr.tier1_100pct                   || 0
  const tier2Above  = bpr.tier2_50pct_above_allowance    || 0
  const tier2AIM    = bpr.tier2_50pct_aim_or_not_listed  || 0
  const charityVal  = (charity.pre_2027_estate_assets || 0) + (charity.post_2027_pension_assets || 0)
  const totalReliefs = tier1 + tier2Above + tier2AIM + charityVal

  if (totalReliefs === 0) {
    return {
      formula: 'Business property relief (BPR), agricultural property relief (APR), and charitable gifts can reduce your taxable estate — sometimes to zero.',
      source: 'engine.ihtExposure(entity) → reliefs.apr_bpr, reliefs.charity',
      confidence: 'medium',
      breakdown: [{ label: 'No qualifying reliefs recorded', value: '—' }],
    }
  }

  const breakdown = []
  if (tier1 > 0) {
    breakdown.push({ label: 'Business/agricultural assets exempt at 100%', value: fmt(tier1) })
  }
  if (tier2Above > 0) {
    breakdown.push({ label: 'Business assets above allowance (50% relief applied)', value: fmt(tier2Above) })
  }
  if (tier2AIM > 0) {
    breakdown.push({ label: 'AIM / unlisted shares (50% relief applied)',            value: fmt(tier2AIM) })
  }
  if (bpr.allowance_used != null) {
    breakdown.push({ label: '£1m BPR allowance used (post-2026 rules)',              value: fmt(bpr.allowance_used) })
  }
  if (bpr.allowance_remaining != null) {
    breakdown.push({ label: '£1m BPR allowance remaining',                           value: fmt(bpr.allowance_remaining) })
  }
  if (charityVal > 0) {
    breakdown.push({ label: 'Charitable gifts deducted from estate',                 value: fmt(charityVal) })
    if (charity.ten_pct_test_passed) {
      breakdown.push({ label: 'Charity ≥10% — reduced 36% rate applied', value: 'Yes' })
    }
  }
  breakdown.push({ label: 'Total reliefs', value: fmt(totalReliefs) })

  return {
    formula: 'Business and agricultural assets that meet HMRC qualifying conditions reduce your estate by 100% (full exemption) or 50% (partial relief). Charitable legacies of ≥10% of net estate reduce the IHT rate from 40% to 36%.',
    source: 'engine.ihtExposure(entity) → reliefs.apr_bpr (tier1, tier2, allowance), reliefs.charity',
    confidence: totalReliefs > 0 ? 'high' : 'low',
    breakdown,
  }
}

/**
 * Payload for the "to your family" (beneficiary value) row.
 * @param {object} exp  — ihtExposure(entity) output
 */
export function beneficiaryPayload(exp) {
  const ihtDue = exp.iht_due || 0
  const net    = exp.net_estate || 0
  const bv     = exp.beneficiary_value

  const breakdown = [
    { label: 'Net estate',             value: fmt(net) },
    { label: 'Less: inheritance tax',  value: fmt(ihtDue) },
    { label: 'What your family keeps', value: fmt(bv) },
  ]

  if (exp.pr_liability?.pension_iht_payable_by_pr > 0) {
    breakdown.push({
      label: 'Pension IHT payable by personal representative (from April 2027)',
      value: fmt(exp.pr_liability.pension_iht_payable_by_pr),
    })
  }

  if (exp.post_75_double_tax) {
    const dt = exp.post_75_double_tax
    breakdown.push({
      label: 'Post-75 combined IHT + income tax on pension (sensitivity)',
      value: `${Math.round((dt.combined_effective_rate || 0) * 100)}% combined`,
    })
  }

  return {
    formula: 'Net estate minus inheritance tax due. If no IHT is payable (estate within your tax-free bands and reliefs) your family keeps the entire net estate.',
    source: 'engine.ihtExposure(entity) → beneficiary_value, net_estate, iht_due, pr_liability',
    confidence: exp.confidence || 'medium',
    breakdown,
  }
}
