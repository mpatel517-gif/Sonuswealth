// ─────────────────────────────────────────────────────────────────────────────
// TrustsPanel — Tier-A consumer of the L3Panel primitive.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A (Trusts).
//
// Domain config:
//   · hero         = total trust fund value + count
//   · taxTreatment = income tax on trust distributions / CGT on trust disposals
//                    / IHT relevant-property regime plain-English
//   · middle[]     = per-trust row with fund value + drill to L5 detail
//   · estate       = {} (IHT detail lives on IHTPanel — not duplicated)
//   · confidence   = high when trusts present, low otherwise
//
// Data source: entity.trusts[] (top-level).
// Per CLAUDE.md §0.3: no RPT / CLT / GWR codes in user-facing headlines.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel } from '../L3Panel.jsx'
import { DrillableNumber } from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt } from '../../../../engine/fq-calculator.js'
import { buildTrustRows } from './TrustsPanel.data.js'
import { trustsTotalPayload, trustL5 } from './TrustsPayloads.js'

function TrustRow({ row, entity, pushNumber }) {
  const payload = trustL5(entity.trusts?.[row.idx], row.idx, 'entity.trusts')
  return (
    <div
      data-trust-id={row.key}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <div>
        <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text)' }}>
          {row.label}
        </div>
        {row.sublabel && (
          <div
            style={{
              fontSize: 'var(--fs-xsmall, 10px)',
              color: 'var(--c-text3)',
              marginTop: 2,
            }}
          >
            {row.sublabel}
          </div>
        )}
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
        <DrillableNumber
          metric={`Trusts · ${row.label}`}
          value={fmt(row.value)}
          formula={payload?.formula}
          source={payload?.source}
          confidence={payload?.confidence}
          breakdown={payload?.breakdown}
          editable={payload?.editable}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

function TrustsMiddle({ entity }) {
  const { rows, total, trustCount } = buildTrustRows(entity)
  const { pushNumber } = useDrillStackContext()

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
        No trusts recorded yet.
      </div>
    )
  }

  return (
    <div data-section-label="Trusts" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Trusts ({trustCount})
      </div>
      {rows.map(row => (
        <TrustRow key={row.key} row={row} entity={entity} pushNumber={pushNumber} />
      ))}
    </div>
  )
}

/**
 * Trusts L3 panel — total wealth held in trust + per-trust breakdown.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function TrustsPanel({ entity, ripple }) {
  const { rows, total, trustCount } = buildTrustRows(entity)
  const { pushNumber } = useDrillStackContext()
  const heroPayload = trustsTotalPayload(entity, total, trustCount)

  const hero = {
    metric: (
      <DrillableNumber
        metric="Trusts · Total fund value"
        value={fmt(total)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      >
        {fmt(total)}
      </DrillableNumber>
    ),
    label:    'Wealth held in trust',
    sublabel: trustCount === 0
      ? 'No trusts recorded'
      : `${trustCount} trust${trustCount === 1 ? '' : 's'} · tap any value to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Trust income taxed at special trust rates',
      detail:   'Discretionary trusts pay 45% on most income (39.35% on dividends). Trustees can distribute income to beneficiaries who reclaim tax paid to match their own rate.',
    },
    capitalGains: {
      headline: 'Gains in trust subject to CGT at trust rates',
      detail:   'Trusts receive a reduced annual exemption (half the individual amount). Trustees can hold over gains on certain qualifying disposals.',
    },
    inheritance: {
      headline: 'Assets in trust sit outside your estate but may face their own 10-yearly charge',
      detail:   'Discretionary trusts are subject to a periodic charge every 10 years (up to 6% of fund value above the nil-rate band) and an exit charge on distributions. Assets are excluded from the settlor\'s estate after 7 years.',
    },
  }

  const middle = [
    { key: 'trusts', render: ({ entity: e }) => <TrustsMiddle entity={e} /> },
  ]

  const confidence = {
    level:          trustCount === 0 ? 'low' : 'high',
    totalFields:    trustCount,
    verifiedFields: trustCount,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="trusts"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
