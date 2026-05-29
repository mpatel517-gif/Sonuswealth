// ─────────────────────────────────────────────────────────────────────────────
// IncomeSourcesPanel — first real consumer of the L3Panel primitive.
//
// Plan reference: ~/.claude/plans/why-do-you-have-async-balloon.md §L3-2,
// LANE3-OUTSTANDING.md §1 Tier A #1.
//
// Why this is the pilot:
//   The L3Panel primitive (src/components/MyMoney/L3/L3Panel.jsx) was
//   designed to host all 19 spec-mandated domain panels but has not had
//   a consumer until now. Income-sources is the right first mover:
//     · founder-visible (every persona has income; first-class on MyMoney
//       and Cashflow)
//     · grounded in a canonical engine reader (annualIncome from _helpers.js
//       handles dual-schema correctly per F1 root-cause fix)
//     · clean spec contract — sources, amounts, tax bands, no cross-screen
//       writeback
//
// Domain config:
//   · hero          = total annual income + "Last 12 months" sublabel
//   · taxTreatment  = income-tax marginal-rate headline + NI detail
//   · middle[]      = per-source breakdown (employment, dividends, rental,
//                     overseas, self-employed, drawdown, state pension)
//   · estate        = empty (income doesn't directly affect IHT; the wealth
//                     it generates does — that's covered by IHTPanel/EstatePanel)
//   · confidence    = data-completeness from sources reported
//
// L3-6 plain-English: labels use "Employment" not "PAYE", "Self-employment"
// not "Schedule D", "Pension drawdown" not "FAD". Acronyms wrapped in
// <Jargon> primitive when introduced.
//
// Per CLAUDE.md §6 bullet 8: no inline financial calculations. Every number
// flows through an engine selector. Per §6 bullet 2: zero hardcoded tax rates.
// ─────────────────────────────────────────────────────────────────────────────

import { L3Panel } from '../L3Panel.jsx'
import { DrillableNumber } from '../DrillableNumber.jsx'
import { useDrillStackContext } from '../DrillStack.jsx'
import { fmt } from '../../../../engine/fq-calculator.js'
import { annualIncome } from '../../../../engine/_helpers.js'
import { buildSourceRows } from './IncomeSourcesPanel.data.js'
import { incomePayload, incomeTotalPayload } from './TierA-DrillPayloads.js'

function IncomeSourceRow({ row, entity, pushNumber }) {
  const payload = incomePayload(entity, row.key, row.value)
  return (
    <div
      data-source-key={row.key}
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
        style={{ width: 10, height: 10, borderRadius: 2, background: row.colour }}
      />
      <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text)' }}>
        {row.label}
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
        {(row.share * 100).toFixed(0)}%
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
          metric={`Income · ${row.label}`}
          value={fmt(row.value)}
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

function IncomeMiddle({ entity }) {
  const { rows, total, sourceCount } = buildSourceRows(entity)
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
        No income sources recorded yet.
      </div>
    )
  }
  return (
    <div data-section-label="By source" style={{ padding: '4px 6px' }}>
      <div
        style={{
          fontSize: 8,
          opacity: 0.6,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        By source ({sourceCount})
      </div>
      {rows.map(row => <IncomeSourceRow key={row.key} row={row} entity={entity} pushNumber={pushNumber} />)}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
/**
 * Income-sources L3 panel. Drop-in for any drill route that wants the income
 * surface (Cashflow row drill, MyMoney income tile, Home income teaser).
 *
 * @param {{ entity: object, ripple?: object }} props
 */
export function IncomeSourcesPanel({ entity, ripple }) {
  const total = annualIncome(entity)
  const { rows, sourceCount } = buildSourceRows(entity)
  const { pushNumber } = useDrillStackContext()
  const heroPayload = incomeTotalPayload(entity, total, sourceCount)

  // Hero — total annual income with source count sublabel. The metric itself
  // is wrapped in DrillableNumber so the user can drill into the headline
  // "where did this come from" view directly without having to find a row.
  const hero = {
    metric: (
      <DrillableNumber
        metric="Income · Total annual"
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
    label: 'Total annual income',
    sublabel: sourceCount === 0
      ? 'No sources recorded'
      : `${sourceCount} source${sourceCount === 1 ? '' : 's'} · last 12 months · tap any value to drill`,
  }

  // Tax treatment — plain-English headline, no inline rate computation
  // (the IncomeTax detail is a sibling concern handled by a TaxPanel that
  // reads the same engine selectors). For now we surface a single-line
  // marginal-rate observation when we can confidently compute it.
  const taxTreatment = {
    incomeTax: total > 0
      ? { headline: 'Taxed at your marginal rate', detail: 'See tax panel for band breakdown' }
      : { headline: '—', detail: 'Add an income source to see tax position' },
    capitalGains: { headline: 'n/a', detail: 'Income → not subject to CGT' },
    inheritance: {
      headline: 'Indirect impact',
      detail: 'Income grows wealth that is in scope for IHT — see Estate panel',
    },
  }

  // Middle — domain-specific per-source breakdown.
  const middle = [
    { key: 'by-source', render: ({ entity: e }) => <IncomeMiddle entity={e} /> },
  ]

  // Data confidence — proportional to how many distinct sources are reported.
  // Heuristic only; verification flags would be a separate L3-6 wiring.
  const confidence = {
    level: sourceCount === 0 ? 'low'
         : sourceCount >= 3 ? 'high'
         : 'medium',
    totalFields: 8,
    verifiedFields: sourceCount,
  }

  return (
    <L3Panel
      entity={entity}
      ripple={ripple}
      domainKey="income-sources"
      hero={hero}
      taxTreatment={taxTreatment}
      middle={middle}
      estate={{}}
      confidence={confidence}
    />
  )
}

