// IHTEstatePanel.data.js — pure data builder for the IHT-estate L3 panel.
//
// Plan reference: L3 Tier-A IHT Estate panel.
// Pure JS so node ESM tests import without JSX loader.
//
// Exports:
//   buildEstateRows(entity) → { rows, ihtDue, beneficiaryValue, exposure }
//
// NO hardcoded IHT rates / NRB / RNRB — all values come from ihtExposure().
// SIPP-in-estate date logic lives in ihtExposure; we do NOT replicate it here.

import { ihtExposure } from '../../../../engine/tax-estate-engine.js'
import { fmt } from '../../../../engine/fq-calculator.js'
import {
  ihtTotalPayload,
  grossEstatePayload,
  bandsPayload,
  reliefsPayload,
  beneficiaryPayload,
} from './IHTEstatePayloads.js'

/**
 * Build the estate rows for a persona.
 *
 * @param {object} entity
 * @returns {{
 *   rows: Array<{ key: string, label: string, value: number, displayValue: string, drill: object }>,
 *   ihtDue: number,
 *   beneficiaryValue: number,
 *   exposure: object,
 * }}
 */
export function buildEstateRows(entity) {
  const exp = ihtExposure(entity)

  const totalTaxFreeBands = (exp.nrb?.available || 0) + (exp.rnrb?.available || 0)

  const totalReliefs =
    (exp.reliefs?.apr_bpr?.tier1_100pct || 0) +
    (exp.reliefs?.apr_bpr?.tier2_50pct_above_allowance || 0) +
    (exp.reliefs?.apr_bpr?.tier2_50pct_aim_or_not_listed || 0) +
    (exp.reliefs?.charity?.pre_2027_estate_assets || 0) +
    (exp.reliefs?.charity?.post_2027_pension_assets || 0)

  const rows = [
    {
      key: 'gross-estate',
      label: 'Gross estate',
      value: exp.gross_estate,
      displayValue: fmt(exp.gross_estate),
      drill: grossEstatePayload(exp),
    },
    {
      key: 'tax-free-bands',
      label: 'Tax-free bands',
      value: totalTaxFreeBands,
      displayValue: fmt(totalTaxFreeBands),
      drill: bandsPayload(exp),
    },
    {
      key: 'reliefs',
      label: 'Reliefs (business & charity)',
      value: totalReliefs,
      displayValue: fmt(totalReliefs),
      drill: reliefsPayload(exp),
    },
    {
      key: 'taxable-estate',
      label: 'Taxable estate',
      value: exp.taxable_estate,
      displayValue: fmt(exp.taxable_estate),
      drill: ihtTotalPayload(exp),
    },
    {
      key: 'iht-due',
      label: 'Inheritance tax due',
      value: exp.iht_due,
      displayValue: fmt(exp.iht_due),
      drill: ihtTotalPayload(exp),
    },
    {
      key: 'to-your-family',
      label: 'To your family',
      value: exp.beneficiary_value,
      displayValue: fmt(exp.beneficiary_value),
      drill: beneficiaryPayload(exp),
    },
  ]

  return {
    rows,
    ihtDue: exp.iht_due,
    beneficiaryValue: exp.beneficiary_value,
    exposure: exp,
  }
}
