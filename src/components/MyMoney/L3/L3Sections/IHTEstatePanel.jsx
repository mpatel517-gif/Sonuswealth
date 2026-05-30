// ─────────────────────────────────────────────────────────────────────────────
// IHTEstatePanel — Tier-A IHT estate L3 panel.
//
// Plan reference: L3 Tier-A IHT Estate panel.
//
// Why this is Tier-A:
//   IHT is one of the top financial planning concerns for UK high-net-worth
//   individuals. The estate / tax-free band / relief waterfall is opaque
//   without a dedicated drill panel. Founder spec: every £ value drillable.
//
// Domain config:
//   · hero          = IHT due (DrillableNumber → ihtTotalPayload)
//   · taxTreatment  = IHT-specific: no income tax, CGT uplift at death, IHT narrative
//   · middle[]      = estate waterfall breakdown (6 rows, all read-only DrillableNumbers)
//   · estate        = {} — EstatePositionSection handles its own cross-tab read
//   · confidence    = from ihtExposure.confidence
//
// Per CLAUDE.md §0.3 banned-list: no bare "NRB" / "RNRB" / "APR" / "BPR" in
// headlines. Acronyms are allowed in detail lines, prefixed with their meaning
// on first use ("nil-rate band (NRB)").
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }             from '../L3Panel.jsx'
import { DrillableNumber }     from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt }                 from '../../../../engine/fq-calculator.js'
import { buildEstateRows }     from './IHTEstatePanel.data.js'
import { ihtTotalPayload }     from './IHTEstatePayloads.js'

// ── Estate waterfall row ──────────────────────────────────────────────────────

function EstateRow({ row, pushNumber, accent }) {
  return (
    <div
      data-estate-key={row.key}
      style={{
        display:        'grid',
        gridTemplateColumns: '1fr auto',
        alignItems:     'center',
        gap:            10,
        padding:        '8px 0',
        borderBottom:   '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <div
        style={{
          fontSize: 'var(--fs-small, 12px)',
          color: accent ? 'var(--c-text)' : 'var(--c-text2)',
          fontWeight: accent ? 600 : 400,
        }}
      >
        {row.label}
      </div>
      <div
        style={{
          fontSize:           accent ? 'var(--fs-body, 14px)' : 'var(--fs-small, 12px)',
          fontWeight:         accent ? 700 : 500,
          color:              accent ? 'var(--c-text)' : 'var(--c-text2)',
          fontVariantNumeric: 'tabular-nums',
          textAlign:          'right',
          minWidth:           80,
        }}
      >
        <DrillableNumber
          metric={`IHT estate · ${row.label}`}
          value={row.displayValue}
          formula={row.drill?.formula}
          source={row.drill?.source}
          confidence={row.drill?.confidence}
          breakdown={row.drill?.breakdown}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

// ── Estate breakdown section ──────────────────────────────────────────────────

function EstateBreakdownSection({ entity }) {
  const { rows, ihtDue } = buildEstateRows(entity)
  const { pushNumber } = useDrillStackContext()

  if (!rows || rows.length === 0) {
    return (
      <div
        style={{
          padding:   12,
          textAlign: 'center',
          fontSize:  'var(--fs-small)',
          color:     'var(--c-text3)',
        }}
      >
        No estate data recorded yet.
      </div>
    )
  }

  // Accent rows: taxable-estate, iht-due, to-your-family
  const accentKeys = new Set(['taxable-estate', 'iht-due', 'to-your-family'])

  return (
    <div data-section-label="Estate breakdown" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize:      8,
          opacity:       0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom:  6,
        }}
      >
        Estate breakdown ({rows.length} rows)
      </div>
      {rows.map(row => (
        <EstateRow
          key={row.key}
          row={row}
          pushNumber={pushNumber}
          accent={accentKeys.has(row.key)}
        />
      ))}
      {ihtDue === 0 && (
        <div
          style={{
            marginTop:  8,
            padding:    '6px 8px',
            background: 'rgba(93,219,194,0.06)',
            borderRadius: 4,
            fontSize:   'var(--fs-xsmall, 10px)',
            color:      'var(--c-text3)',
          }}
        >
          Your estate is within your tax-free bands — no inheritance tax is due at current values.
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

/**
 * IHT estate L3 panel — estate waterfall + per-row drill.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function IHTEstatePanel({ entity, ripple }) {
  const { pushNumber } = useDrillStackContext()
  const { ihtDue, beneficiaryValue, exposure } = buildEstateRows(entity)
  const effectivePct = Math.round((exposure.effective_iht_rate || 0) * 100)
  const heroPayload  = ihtTotalPayload(exposure)

  const hero = {
    metric: (
      <DrillableNumber
        metric="IHT estate · tax due"
        value={fmt(ihtDue)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      >
        {fmt(ihtDue)}
      </DrillableNumber>
    ),
    label: 'Inheritance tax on your estate',
    sublabel: ihtDue === 0
      ? `No inheritance tax due · your family keeps ${fmt(beneficiaryValue)} · tap any value to drill`
      : `${effectivePct}% effective · what your family keeps: ${fmt(beneficiaryValue)} · tap any value to drill`,
  }

  // Tax treatment — IHT-specific narrative, plain-English headlines
  const taxTreatment = {
    incomeTax: {
      headline: 'Not an income tax — IHT is charged on your estate at death',
      detail:   'IHT is paid by your estate before assets are distributed. Income tax and IHT are separate obligations.',
    },
    capitalGains: {
      headline: 'Capital gains are wiped at death — heirs inherit at probate value',
      detail:   'Beneficiaries get a CGT "uplift" to the date-of-death value, resetting any accrued gain. No CGT on death.',
    },
    inheritance: {
      headline: ihtDue > 0
        ? 'Part of your estate above your tax-free bands is taxed at 40%'
        : 'Your estate is within your tax-free bands — no inheritance tax currently due',
      detail: 'Tax-free bands (nil-rate band + residence nil-rate band) shelter the first portion. Business and agricultural property may qualify for additional relief. Pension pots come into your estate from April 2027 under Finance Act 2026.',
    },
  }

  const conf = exposure.confidence || 'medium'
  const hasEstate = (exposure.gross_estate || 0) > 0

  const confidence = {
    level:          conf === 'high' ? 'high' : hasEstate ? 'medium' : 'low',
    totalFields:    4,
    verifiedFields: hasEstate ? (conf === 'high' ? 4 : 2) : 0,
  }

  const middle = [
    {
      key:    'estate-breakdown',
      render: ({ entity: e }) => <EstateBreakdownSection entity={e} />,
    },
  ]

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="iht-estate"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
