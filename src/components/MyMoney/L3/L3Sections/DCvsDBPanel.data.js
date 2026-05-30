// DCvsDBPanel.data.js — pure data builder for the DC vs DB pension L3 panel.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A (DC vs DB pension split).
// Pure JS — node ESM tests import without JSX loader.
//
// DC sources:
//   entity.assets.sipp.pensions[] where type does NOT match /occupational.?db/i
//   entity.assets.pensions[]      where type does NOT match /db/i
//
// DB sources:
//   entity.assets.pensions[] where type matches /occupational.?db/i OR /\bdb\b/i
//   Key fields: cetv, projected_annual_pension / annual_pension_gross, name / scheme
//
// Capital-equivalent of DB:
//   When cetv is present → use it directly.
//   When cetv is absent  → estimate via pvAnnuity(annual, 0.03, 25) with 3% real
//   discount rate and 25-year horizon (illustrative only — labelled as such).
//   ILLUSTRATIVE_RATE and ILLUSTRATIVE_YEARS are exported constants so the panel
//   copy can cite them rather than burying magic numbers.

import { pvAnnuity } from '../../../../engine/modules/financial-math.js'

export const ILLUSTRATIVE_RATE  = 0.03  // 3% real discount rate (documented in copy)
export const ILLUSTRATIVE_YEARS = 25    // 25-year assumed payment horizon

/** @param {string|undefined} t */
function isDB(t) {
  if (!t) return false
  const s = String(t).toLowerCase()
  return /occupational.?db/i.test(s) || /\bdb\b/.test(s)
}

/**
 * Build pension mix for a persona.
 *
 * @param {object} entity
 * @returns {{
 *   dcSchemes: Array<{ idx:number, source:'sipp'|'pensions', name:string, value:number }>,
 *   dbSchemes: Array<{ idx:number, name:string, annual:number, cetv:number|null, capitalEquiv:number, cetvIsEstimate:boolean }>,
 *   dcTotal:   number,
 *   dbAnnual:  number,
 *   dbCapitalEquiv: number,
 *   total:     number,
 * }}
 */
export function buildPensionMix(entity) {
  const a = entity?.assets || {}

  // ── DC: sipp.pensions[] ───────────────────────────────────────────────────
  const dcFromSipp = []
  if (Array.isArray(a.sipp?.pensions)) {
    a.sipp.pensions.forEach((p, idx) => {
      if (isDB(p.type)) return
      const value = +(p.value ?? p.balance_gbp ?? p.balance ?? 0) || 0
      if (value <= 0) return
      dcFromSipp.push({
        idx,
        source: 'sipp',
        name:  p.name || p.provider || `DC pension ${idx + 1}`,
        value,
      })
    })
  }

  // ── DC + DB: assets.pensions[] ────────────────────────────────────────────
  const dcFromPensions = []
  const dbSchemes = []

  if (Array.isArray(a.pensions)) {
    a.pensions.forEach((p, idx) => {
      if (isDB(p.type)) {
        // DB scheme
        const annual = +(p.projected_annual_pension ?? p.annual_pension_gross ?? 0) || 0
        const cetvRaw = p.cetv != null ? +(p.cetv) || 0 : null
        const cetvIsEstimate = cetvRaw == null
        const capitalEquiv = cetvIsEstimate
          ? pvAnnuity(annual, ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS)
          : cetvRaw
        dbSchemes.push({
          idx,
          name: p.name || p.scheme || p.scheme_name || `DB pension ${idx + 1}`,
          annual,
          cetv: cetvRaw,
          capitalEquiv,
          cetvIsEstimate,
        })
      } else {
        // DC entry inside assets.pensions[]
        const value = +(p.value ?? p.balance_gbp ?? p.balance ?? 0) || 0
        if (value <= 0) return
        dcFromPensions.push({
          idx,
          source: 'pensions',
          name:  p.name || p.provider || `DC pension ${idx + 1}`,
          value,
        })
      }
    })
  }

  const dcSchemes = [...dcFromSipp, ...dcFromPensions]
  const dcTotal   = dcSchemes.reduce((s, p) => s + p.value, 0)
  const dbAnnual  = dbSchemes.reduce((s, p) => s + p.annual, 0)
  const dbCapitalEquiv = dbSchemes.reduce((s, p) => s + p.capitalEquiv, 0)

  // total = DC pots + DB CETVs (engine-consistent: DB with no cetv contributes
  // its pvAnnuity estimate so panel total is conservative but non-zero)
  const total = dcTotal + dbSchemes.reduce((s, p) => s + (p.cetv ?? p.capitalEquiv), 0)

  return { dcSchemes, dbSchemes, dcTotal, dbAnnual, dbCapitalEquiv, total }
}
