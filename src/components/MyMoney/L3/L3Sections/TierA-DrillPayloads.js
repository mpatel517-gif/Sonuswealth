// TierA-DrillPayloads.js — pure data builders that turn a single row of a
// Tier-A panel into a DrillableNumber → L4NumberPanel payload.
//
// Plan reference: founder feedback 2026-05-29 — "I could not see a drill
// down on any of the values. I want this option on all drill downs."
//
// Each builder returns the four fields L4NumberPanel consumes:
//   { formula, source, confidence, breakdown }
//
// `formula` — plain-English calculation ("Sum of all property rents…")
// `source`  — which engine selector / entity path produced it
// `confidence` — 'high' | 'medium' | 'low' based on data signals present
// `breakdown` — array of { label, value } for the L4 visual breakdown list
//
// All builders are schema-agnostic: they walk both FLAT (persona-a..g) and
// NESTED (mrT-*) shapes, mirroring _helpers.js conventions. fmt() lives at
// the JSX side; this module returns raw numbers + strings ready for display.

import { fmt } from '../../../../engine/fq-calculator.js'

const placeholder = (label) => [{ label, value: 'No detail recorded yet' }]

// ── INCOME PAYLOADS ─────────────────────────────────────────────────────────

export function incomePayload(entity, sourceKey, total) {
  const ind = entity?.individual || {}
  const inc = entity?.income || {}
  const a   = entity?.assets   || {}

  switch (sourceKey) {
    case 'employment': {
      const fromGross  = +ind.gross_salary || 0
      const fromEmpl   = +inc.employment   || 0
      const fromSalary = +inc.salary       || 0
      const sources = [
        fromGross  > 0 && { label: 'individual.gross_salary', value: fmt(fromGross) },
        fromEmpl   > 0 && { label: 'income.employment',       value: fmt(fromEmpl) },
        fromSalary > 0 && { label: 'income.salary',           value: fmt(fromSalary) },
      ].filter(Boolean)
      return {
        formula: 'MAX of equivalent salary fields across schemas (not SUM — they describe the same underlying figure).',
        source: 'Salary read from any of: individual.gross_salary, income.employment, income.salary',
        confidence: sources.length > 0 ? 'high' : 'low',
        breakdown: sources.length > 0 ? sources : placeholder('Employment income'),
      }
    }

    case 'selfEmployed': {
      const v = +inc.selfEmployed || 0
      return {
        formula: 'Self-employment net profit before income tax + Class 4 NI.',
        source: 'income.selfEmployed (annual)',
        confidence: v > 0 ? 'high' : 'low',
        breakdown: v > 0
          ? [{ label: 'Annual net profit', value: fmt(v) }]
          : placeholder('Self-employed profit'),
      }
    }

    case 'dividends': {
      const v = +inc.dividends || 0
      const fromInv = Array.isArray(a.investments)
        ? a.investments
            .filter((x) => x?.annual_dividend > 0)
            .map((x) => ({
              label: x.name || x.type || 'Holding',
              value: fmt(+x.annual_dividend || 0),
            }))
        : []
      return {
        formula: 'Sum of dividend distributions across all holdings (UK + international).',
        source: fromInv.length > 0
          ? 'Per-holding annual_dividend on assets.investments[] (preferred) + income.dividends fallback'
          : 'income.dividends (annualised total)',
        confidence: fromInv.length > 0 ? 'high' : (v > 0 ? 'medium' : 'low'),
        breakdown: fromInv.length > 0
          ? fromInv
          : (v > 0
              ? [{ label: 'Annual dividends', value: fmt(v) }]
              : placeholder('Dividend income')),
      }
    }

    case 'rental': {
      // Rental: aliases — show the source path that was non-zero
      const rA = +inc.rental || 0
      const rB = +inc.rentalIncome || 0
      const fromProperties = Array.isArray(a.property)
        ? a.property
            .filter((p) => p?.rental_income > 0 || p?.rentalIncome > 0)
            .map((p) => ({
              label: p.address || p.name || 'Let property',
              value: fmt(+(p.rental_income ?? p.rentalIncome ?? 0)),
            }))
        : []
      return {
        formula: 'Sum of gross rental income across all let properties, before allowable expenses (S24 mortgage-interest restriction applied separately).',
        source: fromProperties.length > 0
          ? 'Per-property rental_income on assets.property[]'
          : `income.${rA >= rB ? 'rental' : 'rentalIncome'} (alias-deduped via MAX)`,
        confidence: fromProperties.length > 0 ? 'high' : (total > 0 ? 'medium' : 'low'),
        breakdown: fromProperties.length > 0
          ? fromProperties
          : (total > 0
              ? [{ label: 'Annual rental income', value: fmt(total) }]
              : placeholder('Rental income')),
      }
    }

    case 'overseasIncome': {
      const v = +inc.overseasIncome || 0
      return {
        formula: 'Sum of overseas employment + investment income, pre-remittance.',
        source: 'income.overseasIncome',
        confidence: v > 0 ? 'medium' : 'low',
        breakdown: v > 0
          ? [{ label: 'Overseas total', value: fmt(v) }]
          : placeholder('Overseas income'),
      }
    }

    case 'statePension': {
      return {
        formula: 'Computed via the State-pension panel — accrued years × full amount / qualifying years.',
        source: 'income.statePension.annual OR derived from individual.state_pension_accrued_years',
        confidence: 'high',
        breakdown: [
          { label: 'Annual entitlement', value: fmt(total) },
          { label: 'Detail', value: 'See State-pension panel for derivation' },
        ],
      }
    }

    case 'drawdown': {
      const v = +entity?.drawdown || 0
      return {
        formula: 'Annualised pension drawdown across all in-flight schedules.',
        source: 'entity.drawdown (current-year schedule)',
        confidence: v > 0 ? 'high' : 'low',
        breakdown: v > 0
          ? [{ label: 'Annual drawdown', value: fmt(v) }]
          : placeholder('Drawdown'),
      }
    }

    case 'other': {
      const v = +inc.other || 0
      return {
        formula: 'Catch-all bucket — trust distributions, occasional income, unclassified.',
        source: 'income.other',
        confidence: 'low',
        breakdown: v > 0
          ? [{ label: 'Other income', value: fmt(v) }]
          : placeholder('Other income'),
      }
    }

    default:
      return {
        formula: 'Source-specific formula not yet wired for this category.',
        source: `income.${sourceKey}`,
        confidence: 'low',
        breakdown: placeholder(sourceKey),
      }
  }
}

// Total-income hero payload — describes the headline number itself.
export function incomeTotalPayload(entity, total, sourceCount) {
  return {
    formula: 'Sum of all reported income sources for the last 12 months (employment + self-employment + dividends + rental + overseas + state pension + drawdown + other).',
    source: 'engine.annualIncome(entity) — handles FLAT and NESTED schemas via MAX-of-aliases for salary and rental to avoid the F1 double-count.',
    confidence: sourceCount >= 3 ? 'high' : sourceCount >= 1 ? 'medium' : 'low',
    breakdown: [
      { label: 'Number of sources',    value: String(sourceCount) },
      { label: 'Annual total',         value: fmt(total) },
      { label: 'Note',                 value: 'Tap any row below to see per-source detail.' },
    ],
  }
}

// ── WRAPPERS PAYLOADS ───────────────────────────────────────────────────────

export function wrapperPayload(entity, bucketKey, total) {
  const a = entity?.assets || {}

  switch (bucketKey) {
    case 'isa': {
      const fromFlat   = +(a.isa?.value || 0)
      const fromNested = Array.isArray(a.investments)
        ? a.investments.filter((x) => /isa/i.test(x?.type || ''))
        : []
      const breakdown = []
      if (fromFlat > 0) breakdown.push({ label: 'Legacy assets.isa.value', value: fmt(fromFlat) })
      for (const inv of fromNested) {
        breakdown.push({
          label: inv.name || inv.provider || (inv.type || 'ISA holding'),
          value: fmt(+(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)),
        })
      }
      return {
        formula: 'Sum of all ISA-typed holdings on assets.investments[] plus legacy assets.isa.value.',
        source: 'engine.isaTotal(entity) — preferred reader; walks both schemas.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('ISA detail'),
      }
    }

    case 'pension': {
      const sippFromArray = Array.isArray(a.sipp?.pensions)
        ? a.sipp.pensions
        : []
      const standalone = Array.isArray(a.pensions) ? a.pensions : []
      const breakdown = []
      for (const p of sippFromArray) {
        // Skip DB with zero value (CETV-informational only)
        if ((p.type === 'occupational-DB' || p.type === 'Occupational DB') && (p.value == null || +p.value === 0)) continue
        breakdown.push({
          label: p.name || p.provider || (p.type || 'SIPP holding'),
          value: fmt(+(p.value ?? p.balance_gbp ?? p.balance ?? 0)),
        })
      }
      for (const p of standalone) {
        if (p.type === 'occupational-DB' && p.cetv == null) continue
        breakdown.push({
          label: p.name || p.provider || (p.type || 'Pension'),
          value: fmt(+(p.cetv ?? p.balance_gbp ?? p.balance ?? p.value ?? 0)),
        })
      }
      // Legacy flat: only show if we found nothing nested
      if (breakdown.length === 0 && a.sipp?.total > 0) {
        breakdown.push({ label: 'Legacy assets.sipp.total', value: fmt(+a.sipp.total) })
      }
      return {
        formula: 'SIPP balance per holding + DB pension CETVs + standalone pensions. Occupational-DB rows with no CETV are skipped (FP-4 rule).',
        source: 'engine.pensionTotal(entity) — walks sipp.pensions[] + pensions[] + falls back to flat sipp.total when nothing nested.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('Pension detail'),
      }
    }

    case 'gia': {
      const fromFlat   = +(a.portfolio?.value || 0)
      const fromNested = Array.isArray(a.investments)
        ? a.investments.filter((x) => {
            const t = String(x?.type || '').toLowerCase()
            return t === 'gia' || t.includes('general-investment')
          })
        : []
      const breakdown = []
      if (fromFlat > 0 && fromNested.length === 0) {
        breakdown.push({ label: 'Legacy assets.portfolio.value', value: fmt(fromFlat) })
      }
      for (const inv of fromNested) {
        breakdown.push({
          label: inv.name || inv.provider || 'GIA holding',
          value: fmt(+(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)),
        })
      }
      return {
        formula: 'Sum of GIA-typed holdings on assets.investments[] plus legacy assets.portfolio.value (only used when no nested array present).',
        source: 'engine.giaTotal(entity) preferred; per-row breakdown when investments[] available.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('GIA detail'),
      }
    }

    case 'taxAdvAlt': {
      const matched = Array.isArray(a.investments)
        ? a.investments.filter((x) => {
            const t = String(x?.type || '').toLowerCase()
            return t === 'eis' || t === 'seis' || t === 'vct' || t.includes('bond-')
          })
        : []
      const breakdown = matched.map((inv) => ({
        label: `${inv.type || 'Holding'} — ${inv.name || inv.provider || 'Unnamed'}`,
        value: fmt(+(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0)),
      }))
      return {
        formula: 'Sum of EIS + SEIS + VCT + onshore/offshore bond holdings on assets.investments[].',
        source: 'Per-holding walk on assets.investments[] keyed by type.',
        confidence: breakdown.length > 0 ? 'high' : 'low',
        breakdown: breakdown.length > 0 ? breakdown : placeholder('Tax-advantaged alternatives'),
      }
    }

    default:
      return {
        formula: 'Bucket-specific formula not yet wired.',
        source: `bucket key: ${bucketKey}`,
        confidence: 'low',
        breakdown: placeholder(bucketKey),
      }
  }
}

export function wrapperTotalPayload(entity, total, bucketCount) {
  return {
    formula: 'Sum of all wrapper buckets: ISA family + Pension (SIPP/SSAS) + General investment + Tax-advantaged alt.',
    source: 'engine.isaTotal + pensionTotal + giaTotal + walked investments[] for EIS/SEIS/VCT/Bonds.',
    confidence: bucketCount >= 2 ? 'high' : bucketCount >= 1 ? 'medium' : 'low',
    breakdown: [
      { label: 'Buckets in use', value: String(bucketCount) },
      { label: 'Total wrapped', value: fmt(total) },
      { label: 'Note', value: 'Tap any wrapper below to see per-holding detail.' },
    ],
  }
}

// ── STATE-PENSION PAYLOADS ──────────────────────────────────────────────────

export function statePensionEntitlementPayload(snap) {
  // snap = result of buildStatePensionSnapshot
  const accrual = snap.accruedYears
  const needed  = snap.qualifyingYearsNeeded
  const full    = snap.fullEntitlement

  return {
    formula: needed > 0
      ? `(accrued years ÷ qualifying years needed) × full amount = (${accrual} ÷ ${needed}) × ${fmt(full)}`
      : 'accrued years × proportion of full amount',
    source: 'income.statePension.annual when explicitly set; otherwise derived from individual.state_pension_accrued_years + TAX bundle (UK-2026.1).',
    confidence: snap.accruedYears > 0 ? 'high' : (snap.entitlementNow > 0 ? 'medium' : 'low'),
    breakdown: [
      { label: 'Accrued qualifying years', value: String(accrual) },
      { label: 'Needed for full amount',    value: String(needed) },
      { label: 'Full new State Pension',    value: fmt(full) },
      { label: 'Current entitlement',       value: fmt(snap.entitlementNow) },
      { label: 'State Pension age',         value: String(snap.spa) },
      { label: 'Years to SPA',              value: String(snap.yearsToSpa) },
    ],
  }
}

export function statePensionGapPayload(snap) {
  return {
    formula: `Gap = full amount − current entitlement = ${fmt(snap.fullEntitlement)} − ${fmt(snap.entitlementNow)}. Years missing = qualifying needed − accrued = ${snap.qualifyingYearsNeeded} − ${snap.accruedYears}, capped at years remaining to SPA (${snap.yearsToSpa}).`,
    source: 'TAX.statePensionFull − statePensionAnnual(entity); years from TAX.statePensionQualYears − accrued.',
    confidence: 'high',
    breakdown: [
      { label: 'Gap per year',          value: fmt(snap.gapToFull) },
      { label: 'Missing years (total)', value: String(snap.missingYears) },
      { label: 'Fillable by SPA',       value: String(snap.gapFillableBySpa) },
      { label: 'On-track for full?',    value: snap.onTrackForFull ? 'Yes' : 'No' },
    ],
  }
}
