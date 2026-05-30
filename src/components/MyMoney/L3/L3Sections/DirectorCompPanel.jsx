// ─────────────────────────────────────────────────────────────────────────────
// DirectorCompPanel — Tier-A director remuneration L3 panel.
//
// Plan reference: Tier-A director-comp panel.
//
// Why Tier-A:
//   Owner-operated Ltd directors (archetype 33) optimise salary/dividend split
//   every year. The interplay between salary, dividends, dividend-tax, and
//   company equity is invisible without a dedicated drill layer. Founder spec:
//   every £ value drillable; editable rows allow in-context corrections.
//
// Domain config:
//   · hero        = total remuneration (DrillableNumber)
//   · taxTreatment = income tax on salary + dividend rates; CGT/BADR on shares;
//                    BPR on trading-company shares
//   · middle[]    = Remuneration breakdown section (salary, dividends,
//                   dividend-tax, per-company equity)
//   · estate      = {} — EstatePositionSection reads T&E cross-tab
//   · confidence  = heuristic based on data presence
//
// Per CLAUDE.md §0.3: no bare acronyms (PSC / DLA / BADR / BPR) in headlines.
// Acronyms allowed in detail lines, meaning given on first use.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel }             from '../L3Panel.jsx'
import { DrillableNumber }     from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt }                 from '../../../../engine/fq-calculator.js'
import { buildRemunerationRows } from './DirectorCompPanel.data.js'

// ─── Remuneration row ─────────────────────────────────────────────────────────

function RemunerationRow({ row, pushNumber, accent }) {
  return (
    <div
      data-remuneration-key={row.key}
      style={{
        display:             'grid',
        gridTemplateColumns: '1fr auto',
        alignItems:          'center',
        gap:                 10,
        padding:             '8px 0',
        borderBottom:        '1px solid var(--c-border-subtle, rgba(255,255,255,0.06))',
      }}
    >
      <div
        style={{
          fontSize:   'var(--fs-small, 12px)',
          color:      accent ? 'var(--c-text)' : 'var(--c-text2)',
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
          metric={`Director comp — ${row.label}`}
          value={fmt(row.value)}
          formula={row.drill?.formula}
          source={row.drill?.source}
          confidence={row.drill?.confidence}
          breakdown={row.drill?.breakdown}
          editable={row.drill?.editable}
          onDrill={pushNumber}
        />
      </div>
    </div>
  )
}

// ─── Remuneration breakdown section ──────────────────────────────────────────

function RemunerationSection({ entity }) {
  const { pushNumber } = useDrillStackContext()
  const { rows, salary, dividends } = buildRemunerationRows(entity)

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding:   12,
          textAlign: 'center',
          fontSize:  'var(--fs-small)',
          color:     'var(--c-text3)',
        }}
      >
        No director remuneration data recorded yet.
      </div>
    )
  }

  return (
    <div data-section-label="Remuneration breakdown" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize:        8,
          opacity:         0.6,
          letterSpacing:   '0.08em',
          textTransform:   'uppercase',
          marginBottom:    6,
        }}
      >
        Remuneration breakdown
      </div>
      {rows.map(row => (
        <RemunerationRow
          key={row.key}
          row={row}
          pushNumber={pushNumber}
          accent={row.key === 'salary' || row.key === 'dividends'}
        />
      ))}
    </div>
  )
}

// ─── Panel export ─────────────────────────────────────────────────────────────

/**
 * Director remuneration L3 panel.
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function DirectorCompPanel({ entity, ripple }) {
  const { pushNumber } = useDrillStackContext()
  const { rows, salary, dividends, total } = buildRemunerationRows(entity)

  const hasData = total > 0

  // Hero payload — total remuneration
  const heroPayload = {
    formula:    `Director salary (${fmt(salary)}) + dividends from company (${fmt(dividends)}) = total remuneration before tax.`,
    source:     'entity.individual.gross_salary + entity.individual.dividend_income_annual',
    confidence: hasData ? 'high' : 'low',
    breakdown:  [
      { label: 'Director salary',       value: fmt(salary) },
      { label: 'Dividends from company', value: fmt(dividends) },
      { label: 'Total',                  value: fmt(total) },
    ],
  }

  const hero = {
    metric: (
      <DrillableNumber
        metric="Director comp — total remuneration"
        value={fmt(total)}
        formula={heroPayload.formula}
        source={heroPayload.source}
        confidence={heroPayload.confidence}
        breakdown={heroPayload.breakdown}
        onDrill={pushNumber}
      />
    ),
    label:    'Director remuneration this year',
    sublabel: hasData
      ? `Salary ${fmt(salary)} · dividends ${fmt(dividends)} · tap any value to drill`
      : 'No remuneration data recorded — add your salary and dividends to unlock',
  }

  const taxTreatment = {
    incomeTax: {
      headline: 'Salary taxed at your marginal rate; dividends taxed at lower dividend rates',
      detail:   'Director salary is taxed as employment income (PAYE) at your marginal income-tax rate with Class 1 National Insurance. Dividends are taxed at dividend rates: 8.75% (basic), 33.75% (higher), 39.35% (additional) on amounts above the £500 annual dividend allowance.',
    },
    capitalGains: {
      headline: 'Company shares are subject to Capital Gains Tax on disposal — Business Asset Disposal Relief may apply',
      detail:   'Gains on disposal of company shares are subject to CGT at standard rates (18% / 24%). If you qualify for Business Asset Disposal Relief (BADR — formerly Entrepreneurs Relief), the effective CGT rate is 14% up to a £1m lifetime limit, rising to 18% from April 2025.',
    },
    inheritance: {
      headline: 'Trading company shares may qualify for 100% relief from Inheritance Tax',
      detail:   'Shares in a qualifying trading company held for 2+ years may attract 100% Business Property Relief (BPR), potentially removing their full value from your taxable estate. The company must pass HMRC\'s "wholly or mainly trading" test annually. Subject to legislative change.',
    },
  }

  // Confidence heuristic
  const companyCount = (entity?.companies || []).length
  const confidence = {
    level:          hasData ? (companyCount > 0 ? 'medium' : 'high') : 'low',
    totalFields:    3 + companyCount,
    verifiedFields: hasData ? 2 + (companyCount > 0 ? 0 : 0) : 0,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      hero={hero}
      taxTreatment={taxTreatment}
      middle={[{
        key:    'remuneration-breakdown',
        render: ({ entity: e }) => <RemunerationSection entity={e} />,
      }]}
      estate={{}}
      confidence={confidence}
      domainKey="director-comp"
    />
  )
}
