// ─────────────────────────────────────────────────────────────────────────────
// BTLPortfolioPanel — Tier-A L3 panel for buy-to-let property portfolios.
//
// Domain config:
//   · hero          = total BTL value + property count + gross yield
//   · taxTreatment  = rental profit IT / residential CGT / full IHT estate
//   · middle[]      = per-property rows (value drillable via propertyL5) +
//                     portfolio summary (gross rent, net rent, yield, concentration)
//   · estate        = (EstatePositionSection from cross-tab ripple)
//   · confidence    = heuristic from property count
//
// Per CLAUDE.md §0.3 banned-list: no S24 codes, no SDLT codes in user-facing
// strings beyond plain-English explanations.  S24 is surfaced as plain English
// ("mortgage interest gets a 20% tax credit only").
//
// Schema-agnostic: handles both FLAT persona-a..g shape (isRental +
// rentalGrossAnnual) and NESTED mrT-landlord shape ($ref resolution in data.js).
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }            from '../L3Panel.jsx'
import { DrillableNumber }    from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt }                from '../../../../engine/fq-calculator.js'
import { buildBTLRows }       from './BTLPortfolioPanel.data.js'
import { propertyL5 }         from './TierA-DrillPayloads.js'
import {
  btlTotalPayload,
  btlGrossRentPayload,
  btlNetRentPayload,
  btlYieldPayload,
  btlConcentrationPayload,
} from './BTLPortfolioPayloads.js'

// ── Row styles ────────────────────────────────────────────────────────────────
const rowStyle = {
  display:               'grid',
  gridTemplateColumns:   '1fr auto',
  alignItems:            'center',
  gap:                   10,
  padding:               '7px 0',
  borderBottom:          '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
}
const labelStyle = {
  fontSize:     'var(--fs-small, 13px)',
  color:        'var(--c-text2, rgba(255,255,255,0.65))',
  lineHeight:   1.3,
}
const valueStyle = {
  fontSize:             'var(--fs-body, 14px)',
  fontWeight:           600,
  color:                'var(--c-text)',
  fontVariantNumeric:   'tabular-nums',
  textAlign:            'right',
  minWidth:             80,
}
const groupHeadStyle = {
  fontSize:        8,
  opacity:         0.6,
  letterSpacing:   '0.08em',
  textTransform:   'uppercase',
  marginBottom:    6,
  marginTop:       10,
}

// ── PropertyRow ───────────────────────────────────────────────────────────────
function PropertyRow({ row, pushNumber }) {
  const drill = propertyL5(
    row.prop,
    'assets.property[]',
    'BTL property',
    row.editableValue,
  )

  return (
    <div data-btl-prop-idx={row.idx} style={rowStyle}>
      <div style={labelStyle}>{row.name}</div>
      <div style={valueStyle}>
        <DrillableNumber
          metric={`BTL portfolio · ${row.name}`}
          value={fmt(row.value)}
          formula={drill?.formula}
          source={drill?.source}
          confidence={drill?.confidence || 'high'}
          breakdown={drill?.breakdown}
          editable={row.editableValue}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

// ── SummaryRow ────────────────────────────────────────────────────────────────
function SummaryRow({ label, displayValue, payload, metric, pushNumber }) {
  return (
    <div style={rowStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>
        <DrillableNumber
          metric={`BTL portfolio · ${metric}`}
          value={displayValue}
          formula={payload.formula}
          source={payload.source}
          confidence={payload.confidence}
          breakdown={payload.breakdown}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

// ── BTLMiddle ─────────────────────────────────────────────────────────────────
function BTLMiddle({ entity }) {
  const { pushNumber } = useDrillStackContext()
  const { properties, totalValue, totalGrossRent, totalNetRent, grossYield, concentration } =
    buildBTLRows(entity)

  if (properties.length === 0) {
    return (
      <div
        style={{
          padding:    12,
          textAlign:  'center',
          fontSize:   'var(--fs-small)',
          color:      'var(--c-text3)',
        }}
      >
        No buy-to-let properties recorded
      </div>
    )
  }

  const grossRentPayload = btlGrossRentPayload(properties, totalGrossRent)
  const netRentPayload   = btlNetRentPayload(properties, totalNetRent)
  const yieldPayload     = btlYieldPayload(grossYield, totalGrossRent, totalValue)
  const concPayload      = btlConcentrationPayload(concentration, totalValue)

  return (
    <div>
      {/* Properties section */}
      <div style={groupHeadStyle}>Properties ({properties.length})</div>
      {properties.map(row => (
        <PropertyRow key={row.idx} row={row} pushNumber={pushNumber} />
      ))}

      {/* Portfolio summary */}
      <div style={{ ...groupHeadStyle, marginTop: 16 }}>Portfolio summary</div>

      <SummaryRow
        label="Total gross rent (yr)"
        displayValue={fmt(totalGrossRent)}
        payload={grossRentPayload}
        metric="gross rent"
        pushNumber={pushNumber}
      />
      {totalNetRent > 0 && (
        <SummaryRow
          label="Total net rent (yr)"
          displayValue={fmt(totalNetRent)}
          payload={netRentPayload}
          metric="net rent"
          pushNumber={pushNumber}
        />
      )}
      <SummaryRow
        label="Gross yield"
        displayValue={`${(grossYield * 100).toFixed(2)}%`}
        payload={yieldPayload}
        metric="gross yield"
        pushNumber={pushNumber}
      />
      <SummaryRow
        label="Property concentration"
        displayValue={`${(concentration * 100).toFixed(1)}% of net worth`}
        payload={concPayload}
        metric="concentration"
        pushNumber={pushNumber}
      />
    </div>
  )
}

// ── BTLPortfolioPanel ─────────────────────────────────────────────────────────
/**
 * Buy-to-let portfolio L3 panel.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function BTLPortfolioPanel({ entity, ripple }) {
  const { pushNumber }                                           = useDrillStackContext()
  const { properties, totalValue, totalGrossRent, grossYield }  = buildBTLRows(entity)
  const n                                                        = properties.length

  const heroPayload = btlTotalPayload(properties, totalValue)

  const hero = {
    metric: (
      <DrillableNumber
        metric="BTL portfolio · Total value"
        value={fmt(totalValue)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      >
        {fmt(totalValue)}
      </DrillableNumber>
    ),
    label:    'Buy-to-let portfolio',
    sublabel: n === 0
      ? 'No buy-to-let properties recorded'
      : `${n} propert${n === 1 ? 'y' : 'ies'} · gross yield ${(grossYield * 100).toFixed(2)}% · tap any value to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Rental profit taxed at your marginal rate; mortgage interest gets a 20% tax credit only',
      detail:   'S24 restricts full deduction of mortgage interest — you can only claim a basic-rate (20%) tax credit on finance costs. This increases taxable income for higher-rate taxpayers.',
    },
    capitalGains: {
      headline: 'CGT on sale of let property at residential rates (18%/24%)',
      detail:   'Let property does not qualify for main residence relief. The gain net of your annual exempt amount is taxed at 18% (basic rate) or 24% (higher rate). PPR relief may apply if the property was previously your main home.',
    },
    inheritance: {
      headline: 'Let property sits in your taxable estate at full value',
      detail:   'Residential property let to unconnected tenants does not qualify for Business Property Relief. The full market value falls into your IHT estate.',
    },
  }

  const middle = [
    { key: 'btl-properties', render: ({ entity: e }) => <BTLMiddle entity={e} /> },
  ]

  const confidence = {
    level:          n === 0 ? 'low' : n >= 3 ? 'high' : 'medium',
    totalFields:    n * 3,
    verifiedFields: n,
    domainKey:      'btl-portfolio',
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="btl-portfolio"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
