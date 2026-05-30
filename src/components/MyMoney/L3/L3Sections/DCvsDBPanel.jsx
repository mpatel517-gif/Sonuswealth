// ─────────────────────────────────────────────────────────────────────────────
// DCvsDBPanel — DC vs DB pension L3 panel.
//
// Two buckets:
//   "Flexible pot (DC)"  — SIPP / workplace DC pots, each row drillable + editable
//   "Guaranteed income (DB)" — occupational-DB schemes showing income + CETV
//
// Capital equivalence: DB annual income converted to lump-sum via pvAnnuity at
// 3% real / 25-year horizon (illustrative; documented in copy, not hidden).
//
// Per CLAUDE.md §0.3: no bare acronyms in headlines. "DC" / "DB" always paired
// with plain-English descriptor in first use per section.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel } from '../L3Panel.jsx'
import { DrillableNumber } from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt } from '../../../../engine/fq-calculator.js'
import { buildPensionMix, ILLUSTRATIVE_RATE, ILLUSTRATIVE_YEARS } from './DCvsDBPanel.data.js'
import { pensionMixHeroPayload, dcSchemePayload, dbSchemePayload, dcVsDbComparisonPayload } from './DCvsDBPayloads.js'

const pct = (r) => `${(r * 100).toFixed(0)}%`

// ── DC section ────────────────────────────────────────────────────────────────

function DCSection({ entity, dcSchemes }) {
  const { pushNumber } = useDrillStackContext()
  const rawSippPensions    = entity?.assets?.sipp?.pensions || []
  const rawAssetsPensions  = entity?.assets?.pensions || []

  if (dcSchemes.length === 0) {
    return (
      <div style={{ padding: '8px 0', fontSize: 'var(--fs-small)', color: 'var(--c-text3)' }}>
        No flexible DC pots recorded.
      </div>
    )
  }

  return (
    <div>
      {dcSchemes.map((scheme) => {
        const raw = scheme.source === 'sipp'
          ? rawSippPensions[scheme.idx]
          : rawAssetsPensions[scheme.idx]
        const payload = dcSchemePayload(scheme, raw || {})
        return (
          <div
            key={`dc-${scheme.source}-${scheme.idx}`}
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
                {scheme.name}
              </div>
              {raw?.type && (
                <div style={{ fontSize: 'var(--fs-xsmall, 10px)', color: 'var(--c-text3)', marginTop: 2 }}>
                  {raw.type}
                </div>
              )}
            </div>
            <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              <DrillableNumber
                metric={`DC · ${scheme.name}`}
                value={fmt(scheme.value)}
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
      })}
    </div>
  )
}

// ── DB section ────────────────────────────────────────────────────────────────

function DBSection({ entity, dbSchemes }) {
  const { pushNumber } = useDrillStackContext()
  const rawAssetsPensions = entity?.assets?.pensions || []

  if (dbSchemes.length === 0) {
    return (
      <div style={{ padding: '8px 0', fontSize: 'var(--fs-small)', color: 'var(--c-text3)' }}>
        No defined-benefit (guaranteed) pensions recorded.
      </div>
    )
  }

  return (
    <div>
      {dbSchemes.map((scheme) => {
        const raw = rawAssetsPensions[scheme.idx] || {}
        const payload = dbSchemePayload(scheme, raw)
        return (
          <div
            key={`db-${scheme.idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text)' }}>
                {scheme.name}
              </div>
              <div style={{ fontSize: 'var(--fs-xsmall, 10px)', color: 'var(--c-text3)', marginTop: 2 }}>
                {scheme.cetvIsEstimate
                  ? `CETV not provided — estimated capital equiv.`
                  : 'CETV confirmed'}
              </div>
            </div>
            <div
              style={{
                fontSize: 'var(--fs-small, 12px)',
                color: 'var(--c-text2)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                minWidth: 72,
              }}
            >
              <DrillableNumber
                metric={`DB income · ${scheme.name}`}
                value={`${fmt(scheme.annual)}/yr`}
                formula={payload.formula}
                source={payload.source}
                confidence={payload.confidence}
                breakdown={payload.breakdown}
                editable={payload.editable}
                onDrill={pushNumber}
              />
            </div>
            <div
              style={{
                fontSize: 'var(--fs-small, 12px)',
                color: 'var(--c-text2)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                minWidth: 80,
              }}
            >
              <DrillableNumber
                metric={`DB capital equiv · ${scheme.name}`}
                value={`~${fmt(scheme.capitalEquiv)}`}
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
      })}
    </div>
  )
}

// ── Comparison row ────────────────────────────────────────────────────────────

function ComparisonRow({ dcTotal, dbCapitalEquiv, dbAnnual }) {
  const { pushNumber } = useDrillStackContext()
  if (dcTotal === 0 && dbCapitalEquiv === 0) return null
  const payload = dcVsDbComparisonPayload({ dcTotal, dbCapitalEquiv, dbAnnual })
  return (
    <div
      style={{
        marginTop: 10,
        padding: '8px 10px',
        background: 'var(--c-surface2, rgba(255,255,255,0.04))',
        borderRadius: 6,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 'var(--fs-xsmall, 10px)', color: 'var(--c-text2)' }}>
        DB income expressed as capital
        <br />
        <span style={{ opacity: 0.6 }}>
          At {pct(ILLUSTRATIVE_RATE)} real / {ILLUSTRATIVE_YEARS} yr — illustrative
        </span>
      </div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        <DrillableNumber
          metric="DC vs DB — capital comparison"
          value={`${fmt(dcTotal)} flex · ${fmt(dbCapitalEquiv)} guaranteed equiv`}
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

// ── Middle composite ──────────────────────────────────────────────────────────

function PensionMixMiddle({ entity }) {
  const mix = buildPensionMix(entity)
  return (
    <div style={{ padding: '4px 6px' }}>
      {/* DC section */}
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        Flexible pot (DC)
      </div>
      <DCSection entity={entity} dcSchemes={mix.dcSchemes} />

      {/* DB section */}
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginTop: 14,
          marginBottom: 4,
        }}
      >
        Guaranteed income (DB)
      </div>
      <DBSection entity={entity} dbSchemes={mix.dbSchemes} />

      {/* Comparison */}
      <ComparisonRow
        dcTotal={mix.dcTotal}
        dbCapitalEquiv={mix.dbCapitalEquiv}
        dbAnnual={mix.dbAnnual}
      />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * DC vs DB pension L3 panel.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function DCvsDBPanel({ entity, ripple }) {
  const { pushNumber } = useDrillStackContext()
  const mix = buildPensionMix(entity)
  const heroPayload = pensionMixHeroPayload(mix)

  const hero = {
    metric: (
      <DrillableNumber
        metric="Your pension mix"
        value={fmt(mix.total)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      >
        {fmt(mix.total)}
      </DrillableNumber>
    ),
    label: 'Your pension mix',
    sublabel: mix.dcSchemes.length === 0 && mix.dbSchemes.length === 0
      ? 'No pension records found'
      : `${fmt(mix.dcTotal)} flexible pot · ${fmt(mix.dbAnnual)}/yr guaranteed · tap to drill`,
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'All pension income taxed at your marginal rate',
      detail: 'Flexible pot (DC): 25% tax-free cash available (subject to your lump-sum allowance). Guaranteed income (DB): fully taxable as earned income.',
    },
    capitalGains: {
      headline: 'Not applicable inside a pension',
      detail: 'Pensions are CGT-exempt. Gains accumulate free of capital gains tax within the wrapper.',
    },
    inheritance: {
      headline: mix.dbSchemes.length > 0
        ? 'DC passes to heirs from April 2027; most DB stops or reduces at death'
        : 'DC pensions pass to nominated heirs (in IHT estate from April 2027)',
      detail: mix.dbSchemes.length > 0
        ? 'Finance Act 2026 brings DC/SIPP pots into your IHT estate from 6 April 2027. Defined-benefit pensions typically cease on death, or pay a reduced spouse pension — they do not pass as capital.'
        : 'Finance Act 2026 (Royal Assent 18 March 2026) brings defined-contribution pensions into your IHT estate from 6 April 2027. Review your nomination to ensure beneficiaries are up to date.',
    },
  }

  const middle = [
    { key: 'pension-mix', render: ({ entity: e }) => <PensionMixMiddle entity={e} /> },
  ]

  const totalSchemes = mix.dcSchemes.length + mix.dbSchemes.length
  const confidence = {
    level: totalSchemes === 0 ? 'low' : totalSchemes >= 2 ? 'high' : 'medium',
    totalFields: totalSchemes || 1,
    verifiedFields: totalSchemes,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="dc-vs-db"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}
