// ─────────────────────────────────────────────────────────────────────────────
// FlexiDrawdownPanel — Tier-A L3 panel: pension drawdown sustainability.
//
// Plan reference: MyMoney L3 Tier-A — flexi-drawdown.
//
// Domain config:
//   · hero         = POS% (monteCarloPOS probability) — chance pot lasts to 95
//   · taxTreatment = pension drawdown tax rules (plain English)
//   · middle[]     = Sustainability section: pot, drawdown (editable), POS,
//                    percentile bands at terminal age
//   · confidence   = high when pot > 0 (real MC result)
//
// Per CLAUDE.md §0.3 (banned codes): plain English only. No "SWR" in user copy.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }             from '../L3Panel.jsx'
import { DrillableNumber }     from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt }                  from '../../../../engine/fq-calculator.js'
import { buildDrawdownSnapshot } from './FlexiDrawdownPanel.data.js'
import {
  posPayload,
  potPayload,
  annualDrawPayload,
  medianPotPayload,
  p10Payload,
  p90Payload,
} from './FlexiDrawdownPayloads.js'

function SustainabilitySection({ snap, pushNumber }) {
  const rows = [
    {
      key: 'pot',
      label: 'Current pension pot',
      value: fmt(snap.pot),
      payload: potPayload(snap),
      readOnly: true,
    },
    {
      key: 'draw',
      label: snap.drawIsCustom ? 'Annual drawdown' : 'Annual drawdown (illustrative 4%)',
      value: fmt(snap.annualDraw),
      payload: annualDrawPayload(snap),
      readOnly: false,
    },
    {
      key: 'pos',
      label: `Probability of lasting to age ${snap.terminalAge}`,
      value: `${snap.pos}%`,
      payload: posPayload(snap),
      readOnly: true,
    },
    {
      key: 'p50',
      label: `Median pot at age ${snap.terminalAge}`,
      value: fmt(snap.p50),
      payload: medianPotPayload(snap),
      readOnly: true,
    },
    {
      key: 'p10',
      label: `Pessimistic outcome (p10) at age ${snap.terminalAge}`,
      value: fmt(snap.p10),
      payload: p10Payload(snap),
      readOnly: true,
    },
    {
      key: 'p90',
      label: `Optimistic outcome (p90) at age ${snap.terminalAge}`,
      value: fmt(snap.p90),
      payload: p90Payload(snap),
      readOnly: true,
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
          marginBottom: 8,
        }}
      >
        Drawdown sustainability
      </div>
      {rows.map(row => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '5px 0',
            borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-small, 12px)',
              color: 'var(--c-text2)',
              flex: 1,
              paddingRight: 8,
            }}
          >
            {row.label}
          </span>
          <DrillableNumber
            metric={`Flexi-drawdown · ${row.label}`}
            value={row.value}
            formula={row.payload.formula}
            source={row.payload.source}
            confidence={row.payload.confidence}
            breakdown={row.payload.breakdown}
            editable={row.payload.editable}
            onDrill={pushNumber}
          >
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'var(--fs-small, 12px)',
                color: row.key === 'pos'
                  ? (snap.pos >= 75 ? 'var(--c-good, var(--c-acc))' : snap.pos >= 50 ? 'var(--c-warn, #F5A623)' : 'var(--c-bad, #E05252)')
                  : 'var(--c-text)',
              }}
            >
              {row.value}
            </span>
          </DrillableNumber>
        </div>
      ))}
      {!snap.drawIsCustom && (
        <div
          style={{
            marginTop: 8,
            fontSize: 'var(--fs-xsmall, 10px)',
            color: 'var(--c-text3)',
            fontStyle: 'italic',
          }}
        >
          No drawdown schedule set — using 4% of pot as an illustrative figure. Tap Annual drawdown to update.
        </div>
      )}
    </div>
  )
}

/**
 * Flexi-drawdown L3 panel — sustainability + percentile bands.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function FlexiDrawdownPanel({ entity, ripple }) {
  const snap = buildDrawdownSnapshot(entity)
  const { pushNumber } = useDrillStackContext()
  const heroPay = posPayload(snap)

  const hero = {
    metric: (
      <DrillableNumber
        metric="Flexi-drawdown · Probability of survival"
        value={`${snap.pos}%`}
        formula={heroPay.formula}
        source={heroPay.source}
        confidence={heroPay.confidence}
        breakdown={heroPay.breakdown}
        onDrill={pushNumber}
      >
        {`${snap.pos}%`}
      </DrillableNumber>
    ),
    label: 'Chance your pension pot lasts',
    sublabel: snap.pot === 0
      ? 'No pension pot recorded'
      : `Pot ${fmt(snap.pot)} · drawing ${fmt(snap.annualDraw)}/yr to age ${snap.terminalAge} · tap to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Withdrawals taxed at your marginal rate; 25% tax-free cash',
      detail: 'Each flexi-drawdown withdrawal is split: up to 25% of the uncrystallised pot can be taken tax-free (your Pension Commencement Lump Sum entitlement). The remaining 75% is added to your taxable income for the year and taxed at your marginal rate — so large withdrawals can push you into a higher band.',
    },
    capitalGains: {
      headline: 'n/a — inside a pension',
      detail: 'Growth inside a registered pension is sheltered from capital gains tax. CGT only applies once assets leave the pension wrapper.',
    },
    inheritance: {
      headline: 'Outside your estate until April 2027, then within it',
      detail: 'Under Finance Act 2026 (Royal Assent March 2026, effective April 2027), unused pension pots will fall inside your estate for IHT purposes. Until then, nominated beneficiaries inherit the pot free of IHT — check your nomination is up to date.',
    },
  }

  const middle = [
    {
      key: 'sustainability',
      render: () => <SustainabilitySection snap={snap} pushNumber={pushNumber} />,
    },
  ]

  const confidence = {
    level: snap.pot === 0 ? 'low' : 'high',
    totalFields: 3, // pot, drawdown, age
    verifiedFields: snap.pot > 0 ? (snap.drawIsCustom ? 3 : 2) : 0,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="flexi-drawdown"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
