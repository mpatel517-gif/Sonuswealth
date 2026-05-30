// ─────────────────────────────────────────────────────────────────────────────
// DecumulationPanel — "Will my money last?" retirement sustainability L3 panel.
//
// Plan reference: L3 build — Decumulation domain ("will my money last").
//
// Domain config:
//   · hero          = funded-ratio % (or years-of-runway if INSUFFICIENT)
//   · taxTreatment  = drawdown + state pension taxed; 25% TFC; CGT on GIA sales;
//                     unspent wealth in estate (pension IHT April 2027)
//   · middle[]      = Sustainability section — 5 DrillableNumber rows
//   · estate        = (not computed here — falls through to EstatePositionSection)
//   · confidence    = medium for most personas; low if no investable / no target
//
// Per CLAUDE.md §0.3: no internal codes in user strings.
// Per memory `feedback_finio_info_not_sales.md`: info/guidance only, no product
//   surfacing, no broker links.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }               from '../L3Panel.jsx'
import { DrillableNumber }        from '../DrillableNumber.jsx'
import { useDrillStackContext }    from '../DrillStack.jsx'
import { fmt }                    from '../../../../engine/fq-calculator.js'
import { buildDecumulationSnapshot } from './DecumulationPanel.data.js'
import {
  decumulationHeroPayload,
  targetIncomePayload,
  investablePayload,
  fundedRatioPayload,
  sustainableIncomePayload,
  runwayYearsPayload,
} from './DecumulationPayloads.js'

// ── Sub-component: Sustainability section ─────────────────────────────────────

function SustainabilitySection({ snap, pushNumber }) {
  const rows = [
    {
      key:     'targetIncome',
      label:   'Target annual income',
      display: fmt(snap.targetIncome) + '/yr',
      payload: targetIncomePayload(snap),
    },
    {
      key:     'investable',
      label:   'Investable assets',
      display: fmt(snap.investableAssets),
      payload: investablePayload(snap),
    },
    {
      key:     'fundedRatio',
      label:   'Funded ratio',
      display: snap.frInsufficient ? '—' : `${snap.fundedRatioPct}%`,
      payload: fundedRatioPayload(snap),
    },
    {
      key:     'sustainableIncome',
      label:   `Sustainable income (${snap.swrLabel})`,
      display: fmt(snap.sustainableIncome) + '/yr',
      payload: sustainableIncomePayload(snap),
    },
    {
      key:     'runway',
      label:   'Years of cover (zero-growth floor)',
      display: snap.runwayYears > 0 ? `${snap.runwayYears} yrs` : '—',
      payload: runwayYearsPayload(snap),
    },
  ]

  return (
    <div data-section-label="Sustainability" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Sustainability
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.05))',
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-small, 12px)',
              color: 'var(--c-text2)',
              flex: 1,
            }}
          >
            {row.label}
          </span>
          <span
            style={{
              fontSize: 'var(--fs-small, 12px)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--c-text)',
            }}
          >
            <DrillableNumber
              metric={`Decumulation · ${row.label}`}
              value={row.display}
              formula={row.payload.formula}
              source={row.payload.source}
              confidence={row.payload.confidence}
              breakdown={row.payload.breakdown}
              editable={row.payload.editable}
              onDrill={pushNumber}
            >
              {row.display}
            </DrillableNumber>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Panel verdict strip ───────────────────────────────────────────────────────

function VerdictStrip({ snap }) {
  const ok = snap.onTrack
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 6,
        background: ok
          ? 'var(--c-good-bg, rgba(93,219,170,0.08))'
          : 'var(--c-warn-bg, rgba(255,160,90,0.08))',
        borderLeft: `3px solid ${ok ? 'var(--c-good, #5DDBA8)' : 'var(--c-warn, #FFA05A)'}`,
        fontSize: 'var(--fs-small, 12px)',
        color: 'var(--c-text)',
        lineHeight: 1.5,
      }}
    >
      {ok ? (
        <>
          <strong style={{ color: 'var(--c-good, #5DDBA8)' }}>On track.</strong>
          {' '}Your investable assets can sustain {fmt(snap.sustainableIncome)}/yr — above your target of {fmt(snap.targetIncome)}/yr.
        </>
      ) : (
        <>
          <strong style={{ color: 'var(--c-warn, #FFA05A)' }}>Review needed.</strong>
          {' '}At {snap.swrLabel}, your pot sustains {fmt(snap.sustainableIncome)}/yr against a target of {fmt(snap.targetIncome)}/yr.
          {' '}Consider reducing spending, extending working years, or increasing contributions.
        </>
      )}
    </div>
  )
}

// ── Main panel export ─────────────────────────────────────────────────────────

/**
 * Decumulation L3 panel — retirement sustainability + will-money-last verdict.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function DecumulationPanel({ entity, ripple }) {
  const snap         = buildDecumulationSnapshot(entity)
  const { pushNumber } = useDrillStackContext()
  const heroPayload  = decumulationHeroPayload(snap)

  // Hero metric: funded-ratio % when available; else years-of-runway
  const heroValue = !snap.frInsufficient && snap.fundedRatioPct != null
    ? `${snap.fundedRatioPct}%`
    : snap.runwayYears > 0
      ? `${snap.runwayYears} yrs`
      : '—'

  const heroSublabel = !snap.frInsufficient && snap.fundedRatioPct != null
    ? (snap.fundedRatioPct >= 100
        ? 'Fully funded — projected pot covers target income · tap to drill'
        : `${snap.fundedRatioPct}% funded — gap to target at retirement · tap to drill`)
    : snap.onTrack
      ? `On track — sustainable income covers target · tap to drill`
      : `Shortfall — review spending or drawdown · tap to drill`

  const hero = {
    metric: (
      <DrillableNumber
        metric="Decumulation · Will your money last?"
        value={heroValue}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      >
        {heroValue}
      </DrillableNumber>
    ),
    label:    'Will your money last?',
    sublabel: heroSublabel,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Drawdown + state pension taxed at your marginal rate',
      detail:   'Pension drawdown counts as income in the year you take it — added to state pension and any other income above the personal allowance (£12,570). Up to 25% of your pension pot can be taken tax-free (tax-free cash).',
    },
    capitalGains: {
      headline: 'Selling investments may trigger CGT outside wrappers',
      detail:   'Drawdown from an ISA is tax-free. Selling GIA holdings to fund spending realises a capital gain — taxed after the £3,000 annual CGT allowance. Bed-and-ISA annual transfers can shelter future gains.',
    },
    inheritance: {
      headline: 'Unspent wealth sits in your estate (pension joins it April 2027)',
      detail:   'Currently, pension pots fall outside your estate for IHT purposes. From April 2027, unspent defined-contribution pensions will be included in your taxable estate at the standard 40% rate. Review nomination forms and estate planning now.',
    },
  }

  const middle = [
    {
      key:    'verdict',
      render: () => <VerdictStrip snap={snap} />,
    },
    {
      key:    'sustainability',
      render: () => <SustainabilitySection snap={snap} pushNumber={pushNumber} />,
    },
  ]

  const confidence = {
    level: snap.investableAssets === 0 ? 'low'
         : snap.frInsufficient       ? 'low'
         : snap.frConfidence === 'HIGH' ? 'high'
         : 'medium',
    totalFields:    4, // investable, targetIncome, retirementAge, swrRegime
    verifiedFields: [
      snap.investableAssets > 0,
      snap.targetIncome > 0,
      !snap.frInsufficient,
    ].filter(Boolean).length,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="decumulation"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
