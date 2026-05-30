// ─────────────────────────────────────────────────────────────────────────────
// TaxObligationsPanel — L3 panel for the Tax Obligations domain.
//
// Shows the user's total tax and NI liability for the current tax year, broken
// down by type (income tax, National Insurance, dividend tax). Every value is
// drillable to a band-by-band or contribution-class breakdown. Editable
// descriptors are wired to salary so corrections flow back through the engine.
//
// Domain config:
//   · hero         = total tax + NI wrapped in DrillableNumber
//   · taxTreatment = plain-English marginal-rate + CGT/IHT context lines
//   · middle[]     = "By tax type" section with three drillable rows
//   · confidence   = derived from incomeTaxDetail.confidence + active types
//
// Per CLAUDE.md §6: no hardcoded rates — all figures from engine selectors.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }             from '../L3Panel.jsx'
import { DrillableNumber }     from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt }                 from '../../../../engine/fq-calculator.js'
import { incomeTaxDetail, nicsDetail, dividendTaxDetail } from '../../../../engine/tax-estate-engine.js'
import { buildTaxRows }        from './TaxObligationsPanel.data.js'
import {
  taxTotalPayload,
  incomeTaxPayload,
  nicsPayload,
  dividendTaxPayload,
} from './TaxObligationsPayloads.js'

// ── Tax row component ─────────────────────────────────────────────────────────

function TaxTypeRow({ row, payload, entity, pushNumber }) {
  return (
    <div
      data-tax-key={row.key}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text)' }}>
        {row.label}
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
          metric={`Tax · ${row.label}`}
          value={row.fmtValue}
          formula={payload.formula}
          source={payload.source}
          confidence={payload.confidence}
          breakdown={payload.breakdown}
          editable={payload.editable}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

// ── Middle section ─────────────────────────────────────────────────────────────

function TaxTypeSection({ entity }) {
  const { pushNumber } = useDrillStackContext()
  const { rows, total, typeCount } = buildTaxRows(entity)

  const detail = incomeTaxDetail(entity)
  const nics   = nicsDetail(entity)
  const divd   = dividendTaxDetail(entity)

  const payloadMap = {
    incomeTax:   incomeTaxPayload(entity, detail),
    nic:         nicsPayload(entity, nics),
    dividendTax: dividendTaxPayload(entity, divd),
  }

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
        No tax liability calculated yet — add income sources to see your position.
      </div>
    )
  }

  return (
    <div data-section-label="By tax type" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        By tax type ({typeCount})
      </div>
      {rows
        .filter(row => row.value > 0)
        .map(row => (
          <TaxTypeRow
            key={row.key}
            row={row}
            payload={payloadMap[row.key]}
            entity={entity}
            pushNumber={pushNumber}
          />
        ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Tax-obligations L3 panel.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function TaxObligationsPanel({ entity, ripple }) {
  const detail = incomeTaxDetail(entity)
  const nics   = nicsDetail(entity)
  const divd   = dividendTaxDetail(entity)

  const { rows, total, typeCount } = buildTaxRows(entity)
  const { pushNumber } = useDrillStackContext()

  const heroPayload = taxTotalPayload(entity, detail, nics, divd)

  // Effective rate for hero sublabel (from incomeTaxDetail)
  const effectiveRatePct = detail?.effective_rate != null
    ? ` · ${(detail.effective_rate * 100).toFixed(1)}% effective rate`
    : ''

  // Marginal rate plain-English for tax treatment section
  const marginalRate = detail?.marginal_rate
  let marginalLine = '—'
  if (marginalRate != null) {
    const pctStr = `${(marginalRate * 100).toFixed(0)}%`
    if (marginalRate <= 0.2)       marginalLine = `Basic rate taxpayer — ${pctStr} on next £1 of income`
    else if (marginalRate <= 0.4)  marginalLine = `Higher rate taxpayer — ${pctStr} on next £1 of income`
    else                            marginalLine = `Additional rate taxpayer — ${pctStr} on next £1 of income`
  }

  const hero = {
    metric: (
      <DrillableNumber
        metric="Tax · Total tax and NI"
        value={fmt(total)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        editable={heroPayload.editable}
        onDrill={pushNumber}
      >
        {fmt(total)}
      </DrillableNumber>
    ),
    label: 'Total tax & NI this year',
    sublabel: typeCount === 0
      ? 'No income recorded'
      : `${typeCount} type${typeCount === 1 ? '' : 's'}${effectiveRatePct} · tap any value to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: marginalLine,
      detail: 'Income tax is calculated band by band after your personal allowance — tap the income tax row below to see each band.',
    },
    capitalGains: {
      headline: 'Separate from income tax — see investments',
      detail: 'Capital gains tax applies when you sell assets at a profit and is not part of this income tax calculation.',
    },
    inheritance: {
      headline: 'Income builds wealth in scope for IHT — see Estate panel',
      detail: 'Income itself is not directly subject to inheritance tax; the assets your income builds up are.',
    },
  }

  const middle = [
    { key: 'by-tax-type', render: ({ entity: e }) => <TaxTypeSection entity={e} /> },
  ]

  const verifiedFields = typeCount
  const confidence = {
    level: detail?.confidence
      ? detail.confidence.toLowerCase()
      : (verifiedFields >= 2 ? 'high' : verifiedFields >= 1 ? 'medium' : 'low'),
    totalFields: 3,
    verifiedFields,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="tax-obligations"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
