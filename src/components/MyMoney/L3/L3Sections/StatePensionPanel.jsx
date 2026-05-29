// ─────────────────────────────────────────────────────────────────────────────
// StatePensionPanel — Tier-A #3 consumer of the L3Panel primitive.
//
// Plan reference: LANE3-OUTSTANDING.md §1 Tier A #3.
//
// Why this is Tier-A:
//   State pension is the simplest spec-mandated L3 panel: a single annual
//   number, a single accrual fraction, a single "fillable" gap. Highest
//   payoff vs build cost — every persona over ~22yo carries a partial state
//   pension entitlement; surfacing it accurately is high-traffic.
//
// Domain config:
//   · hero          = current annual entitlement
//   · taxTreatment  = state pension is taxable income; sits in marginal-rate
//                     band at SPA
//   · middle[]      = accrual progress (qualifying years bar) + gap-fillable
//                     summary
//   · estate        = (n/a — income flow, not estate asset)
//   · confidence    = high if accruedYears > 0, low otherwise
//
// Per CLAUDE.md §0.3 (banned codes): no NI / Cl3 / DWP / Cat-A in user
// strings — only plain-English. Acronyms wrap in <Jargon> when introduced
// (none introduced in this panel).
//
// Per memory `feedback_always_check_rules_uk.md`: full amount + qualifying
// years come from TAX bundle (never hardcoded). Bundle is UK-2026.1.1.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel } from '../L3Panel.jsx'
import { fmt } from '../../../../engine/fq-calculator.js'
import { buildStatePensionSnapshot } from './StatePensionPanel.data.js'

function AccrualBar({ snap }) {
  const pct = Math.round(snap.pensionFraction * 100)
  return (
    <div data-section-label="Accrual" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Qualifying years
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            background: 'var(--c-border-subtle, rgba(255,255,255,0.06))',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              background: 'var(--c-acc, #5DDB)',
            }}
            aria-hidden="true"
          />
        </div>
        <div
          style={{
            fontSize: 'var(--fs-small, 12px)',
            color: 'var(--c-text2)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {snap.accruedYears} / {snap.qualifyingYearsNeeded}
        </div>
      </div>
      <div
        style={{
          fontSize: 'var(--fs-xsmall, 10px)',
          color: 'var(--c-text3)',
        }}
      >
        {snap.accruedYears} qualifying years recorded out of {snap.qualifyingYearsNeeded} needed for the full new State Pension.
      </div>
    </div>
  )
}

function GapSummary({ snap }) {
  if (snap.entitlementNow === 0 && snap.accruedYears === 0) {
    return (
      <div
        style={{
          padding: 12,
          textAlign: 'center',
          fontSize: 'var(--fs-small)',
          color: 'var(--c-text3)',
        }}
      >
        No National Insurance record on file. Add qualifying years to see your projection.
      </div>
    )
  }

  if (snap.onTrackForFull) {
    return (
      <div data-section-label="Gap" style={{ padding: '6px 6px' }}>
        <div
          style={{
            fontSize: 'var(--fs-small, 12px)',
            color: 'var(--c-text)',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: 'var(--c-good, var(--c-acc))' }}>On track for the full amount.</strong>
          {' '}
          With {snap.yearsToSpa} year{snap.yearsToSpa === 1 ? '' : 's'} until State Pension age,
          you should reach the maximum entitlement of {fmt(snap.fullEntitlement)}/yr.
        </div>
      </div>
    )
  }

  return (
    <div data-section-label="Gap" style={{ padding: '6px 6px' }}>
      <div
        style={{
          fontSize: 'var(--fs-small, 12px)',
          color: 'var(--c-text)',
          lineHeight: 1.4,
        }}
      >
        Gap to the full amount:{' '}
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmt(snap.gapToFull)}/yr
        </strong>
        {' '}({snap.missingYears} missing qualifying year{snap.missingYears === 1 ? '' : 's'}).
        {snap.gapFillableBySpa > 0 ? (
          <>
            {' '}
            You have {snap.yearsToSpa} year{snap.yearsToSpa === 1 ? '' : 's'} until State Pension age — enough time
            to accrue {snap.gapFillableBySpa} more year{snap.gapFillableBySpa === 1 ? '' : 's'} through work or voluntary contributions.
          </>
        ) : (
          <> You are past the working window — voluntary contributions may still apply for some years.</>
        )}
      </div>
    </div>
  )
}

/**
 * State-pension L3 panel — accrual + projection + gap.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function StatePensionPanel({ entity, ripple }) {
  const snap = buildStatePensionSnapshot(entity)

  const hero = {
    metric: fmt(snap.entitlementNow),
    label: 'State pension at current accrual',
    sublabel: snap.entitlementNow === 0
      ? 'No accrual recorded'
      : snap.onTrackForFull
        ? `Projected full ${fmt(snap.fullEntitlement)}/yr by age ${snap.spa}`
        : `Currently ${Math.round(snap.pensionFraction * 100)}% of full amount`,
  }

  const taxTreatment = {
    incomeTax: { headline: 'Taxed at your marginal rate', detail: 'State pension counts as earned income — taxed alongside any other income above the personal allowance.' },
    capitalGains: { headline: 'n/a', detail: 'State pension is income flow, not an asset.' },
    inheritance: { headline: 'n/a', detail: 'State pension stops at death; no IHT impact.' },
  }

  const middle = [
    { key: 'accrual', render: () => <AccrualBar snap={snap} /> },
    { key: 'gap',     render: () => <GapSummary snap={snap} /> },
  ]

  const confidence = {
    level: snap.accruedYears === 0 ? 'low'
         : snap.accruedYears >= 20 ? 'high'
         : 'medium',
    totalFields: 3, // accruedYears, dob, full-amount basis
    verifiedFields: snap.accruedYears > 0 ? 2 : 0,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="state-pension"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
