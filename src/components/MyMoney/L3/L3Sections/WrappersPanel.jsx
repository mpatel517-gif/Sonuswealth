// ─────────────────────────────────────────────────────────────────────────────
// WrappersPanel — Tier-A #2 consumer of the L3Panel primitive.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A #2.
//
// Why this is Tier-A:
//   Wrappers (ISA / Pension / GIA / EIS+SEIS+VCT+Bonds) cross-cut every
//   investment row. Founder repeatedly flagged "drilldowns stay at one
//   level" — this panel surfaces wrapper composition + tax stance per
//   bucket at the L3 depth that was previously missing.
//
// Domain config:
//   · hero          = total wrapped wealth + bucket count
//   · taxTreatment  = ISA tax-free / GIA taxable / Pension IHT-from-2027
//   · middle[]      = per-bucket breakdown with plain-English tax stance
//   · estate        = (left to EstatePositionSection — wrapper IHT impact
//                     lives on the IHTPanel, not duplicated here)
//   · confidence    = heuristic from bucket count + total
//
// Per CLAUDE.md §0.3 banned-list: no MPAA / AA / RNRB / s24 / FAD codes in
// user-facing strings. Tax stance is plain English; engineering tags wrap
// in <Jargon> primitive when introduced (none introduced in this panel).
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel } from '../L3Panel.jsx'
import { fmt } from '../../../../engine/fq-calculator.js'
import { buildWrapperBuckets } from './WrappersPanel.data.js'

function WrapperRow({ bucket }) {
  return (
    <div
      data-bucket-key={bucket.key}
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 1fr auto auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <div
        aria-hidden="true"
        style={{ width: 10, height: 10, borderRadius: 2, background: bucket.colour }}
      />
      <div>
        <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text)' }}>
          {bucket.label}
        </div>
        <div
          style={{
            fontSize: 'var(--fs-xsmall, 10px)',
            color: 'var(--c-text3)',
            marginTop: 2,
            maxWidth: 280,
          }}
        >
          {bucket.taxStance}
        </div>
      </div>
      <div
        style={{
          fontSize: 'var(--fs-small, 12px)',
          color: 'var(--c-text2)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          minWidth: 56,
        }}
      >
        {(bucket.share * 100).toFixed(0)}%
      </div>
      <div
        style={{
          fontSize: 'var(--fs-body, 14px)',
          fontWeight: 600,
          color: 'var(--c-text)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          minWidth: 80,
        }}
      >
        {fmt(bucket.value)}
      </div>
    </div>
  )
}

function WrappersMiddle({ entity }) {
  const { buckets, total, bucketCount } = buildWrapperBuckets(entity)
  if (total === 0) {
    return (
      <div
        style={{
          padding: 12,
          textAlign: 'center',
          fontSize: 'var(--fs-small)',
          color: 'var(--c-text3)',
        }}
      >
        No wrapped investments recorded yet.
      </div>
    )
  }
  return (
    <div data-section-label="By wrapper" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        By wrapper ({bucketCount})
      </div>
      {buckets.map(bucket => <WrapperRow key={bucket.key} bucket={bucket} />)}
    </div>
  )
}

/**
 * Wrappers L3 panel — total wrapped wealth + per-bucket breakdown.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function WrappersPanel({ entity, ripple }) {
  const { total, bucketCount, buckets } = buildWrapperBuckets(entity)

  const isaShare     = buckets.find(b => b.key === 'isa')?.share || 0
  const pensionShare = buckets.find(b => b.key === 'pension')?.share || 0
  const giaShare     = buckets.find(b => b.key === 'gia')?.share || 0

  const hero = {
    metric: fmt(total),
    label: 'Wealth held in wrappers',
    sublabel: bucketCount === 0
      ? 'No wrappers in use'
      : `${bucketCount} wrapper type${bucketCount === 1 ? '' : 's'}`,
  }

  // Tax treatment — derived from bucket weight, not hardcoded narrative.
  // Headlines stay plain-English; details introduce one canonical term at
  // a time so a first-time user can map their position.
  const taxTreatment = {
    incomeTax: pensionShare > 0
      ? { headline: 'Pension withdrawals taxed at marginal rate', detail: 'Tax-free lump sum up to 25% of pot, capped at the lump-sum allowance.' }
      : { headline: 'Mostly outside income tax', detail: 'ISAs grow tax-free; GIA dividends and interest are taxable.' },
    capitalGains: giaShare > 0.10
      ? { headline: 'Gains in your GIA bucket are subject to CGT', detail: 'ISAs and pensions are exempt.' }
      : { headline: 'Minimal CGT exposure', detail: 'Most wealth is held in CGT-exempt wrappers.' },
    inheritance: pensionShare > 0
      ? { headline: 'Pension in scope for IHT from April 2027', detail: 'Finance Act 2026 (Royal Assent 18 March 2026) brought pensions into IHT estate.' }
      : isaShare > 0
        ? { headline: 'ISAs sit inside your taxable estate at death', detail: 'AIM-on-ISA holdings may qualify for Business Property Relief.' }
        : { headline: '—', detail: 'Add wrappers to see inheritance position.' },
  }

  const middle = [
    { key: 'by-wrapper', render: ({ entity: e }) => <WrappersMiddle entity={e} /> },
  ]

  const confidence = {
    level: bucketCount === 0 ? 'low' : bucketCount >= 2 ? 'high' : 'medium',
    totalFields: 4,
    verifiedFields: bucketCount,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="wrappers"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
