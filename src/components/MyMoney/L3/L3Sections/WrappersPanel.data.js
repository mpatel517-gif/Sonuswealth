// WrappersPanel.data.js — pure data builder for the Wrappers L3 panel.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A #2.
// Pure JS so node ESM tests import without JSX loader.

import { isaTotal, giaTotal, pensionTotal } from '../../../../engine/_helpers.js'

// Bucket-key → plain-English label + estate / tax stance.
// Buckets simplify the 13-entry taxonomy into the 4 user-relevant groups
// that match the spec's Wrappers panel inventory.
export const BUCKET_LABELS = {
  isa:        'ISA family',
  pension:    'Pension (SIPP / SSAS)',
  gia:        'General investment',
  taxAdvAlt:  'Tax-advantaged alt.',
  none:       'Other unwrapped',
}

export const BUCKET_COLOURS = {
  isa:       'var(--c-mint)',
  pension:   'var(--c-acc2)',
  gia:       'var(--c-text2)',
  taxAdvAlt: 'var(--c-violet)',
  none:      'var(--c-text3)',
}

// Plain-English tax stance per bucket. Short — full detail is in tooltips
// / supplementary panels. No engineering codes.
export const BUCKET_TAX_STANCE = {
  isa:       'Tax-free growth and income. Outside IHT only inside the death-3-year window.',
  pension:   'Tax-relief on contributions, taxable on withdrawal. In scope for IHT from April 2027 (Finance Act 2026).',
  gia:       'Subject to CGT on gains and income tax on dividends and interest.',
  taxAdvAlt: 'Includes EIS / SEIS / VCT / onshore + offshore bonds. Mix of CGT defer, BPR relief, chargeable-event rules.',
  none:      'No wrapper. Assets held in own name; full tax exposure.',
}

// Classify a single investments[] entry into a bucket.
// Defensive — unknown types route to 'none' rather than disappearing.
function bucketForType(type) {
  if (!type) return 'gia'
  const t = String(type).toLowerCase()
  if (t.includes('isa') || t === 'lisa' || t === 'jisa') return 'isa'
  if (t === 'sipp' || t === 'ssas' || t.includes('pension')) return 'pension'
  if (t === 'gia' || t.includes('general-investment') || t === 'unwrapped') return 'gia'
  if (t === 'eis' || t === 'seis' || t === 'vct' || t.includes('bond-')) return 'taxAdvAlt'
  return 'gia' // unknown → tax-vulnerable bucket (conservative)
}

/**
 * Build the wrapper buckets for a persona.
 *
 * Strategy:
 *   · ISA bucket: use canonical isaTotal() — handles dual-schema correctly
 *   · Pension bucket: pensionTotal() — also dual-schema correct
 *   · GIA bucket: giaTotal() — but only the FLAT side; nested investments[]
 *     get re-walked here so each item lands in the right bucket once
 *   · taxAdvAlt bucket: walk investments[] for EIS/SEIS/VCT/Bonds
 *
 * Important: we DO NOT call investmentsTotal because that combines ISA + GIA
 * + everything wrapper-type-blind. We re-walk per-bucket to avoid double-
 * counting AND to keep buckets reconciled with the engine canonical readers.
 *
 * @param {object} entity
 * @returns {{
 *   buckets: Array<{ key:string, value:number, label:string, colour:string, share:number, taxStance:string }>,
 *   total: number,
 *   bucketCount: number,
 * }}
 */
export function buildWrapperBuckets(entity) {
  const a = entity?.assets || {}

  const isa = isaTotal(entity)
  const pension = pensionTotal(entity)

  // GIA + taxAdvAlt — walk investments[] for type-specific buckets,
  // then fall back to legacy giaTotal for FLAT-only personas.
  let giaFromArray = 0
  let taxAdvAlt = 0
  if (Array.isArray(a.investments)) {
    for (const inv of a.investments) {
      const bucket = bucketForType(inv.type)
      const v = +(inv.balance_gbp ?? inv.balance ?? inv.value ?? 0) || 0
      if (bucket === 'gia')        giaFromArray += v
      else if (bucket === 'taxAdvAlt') taxAdvAlt += v
      // isa + pension already in their canonical totals
    }
  }
  // Combine: nested array walk PLUS the FLAT portfolio.value field (only
  // present in legacy persona-a..g shapes — no double-count because if
  // nested arrays exist, _helpers.giaTotal already prefers them).
  // We add the FLAT portion to nested portion only when no nested investments.
  const gia = Array.isArray(a.investments) && a.investments.length > 0
    ? giaFromArray + 0 // nested walked above
    : giaTotal(entity) // FLAT-only — use canonical reader

  const rawBuckets = [
    { key: 'isa',       value: isa },
    { key: 'pension',   value: pension },
    { key: 'gia',       value: gia },
    { key: 'taxAdvAlt', value: taxAdvAlt },
  ]
  const present = rawBuckets.filter(b => b.value > 0)
  const total = present.reduce((s, b) => s + b.value, 0)

  return {
    buckets: present
      .map(b => ({
        ...b,
        label: BUCKET_LABELS[b.key],
        colour: BUCKET_COLOURS[b.key],
        share: total > 0 ? b.value / total : 0,
        taxStance: BUCKET_TAX_STANCE[b.key],
      }))
      .sort((a, b) => b.value - a.value),
    total,
    bucketCount: present.length,
  }
}
