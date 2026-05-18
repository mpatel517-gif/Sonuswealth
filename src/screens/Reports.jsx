// ─────────────────────────────────────────────────────────────────────────────
// Reports — Phase 3 module (Phase-2-stub pass, FIX-14 wave 2026-05-15).
//
// DECISION (FIX-14): CTA-honest stub. Buttons disabled + labelled
//   "Coming next — Phase 2". Templates locked + previewed; generation engine
//   wiring deferred. Honours §9 CTA-honesty rule + pre-launch waitlist stance.
//
// When Phase 2 lands, the contract is:
//   - onGenerate?.(reportId, mode)  where mode = 'now' | 'schedule'
//   - period selector (Tax year · Calendar year · Custom)
//   - PDF + CSV export via D-RPT-EXPORT-1
//   - engine reads: netWorth · ihtDynamic · costOfInaction · incomeTax ·
//                   cashflowHealth · trajectoryData · calcFQ · calcRisk
//
// Spec: 2-Product-reports-v1_1.md
// 5 report types · on-demand + weekly/monthly scheduling. AI narrative as
// commentary, never source of truth. Materiality threshold £500 or 0.5% NW.
// ─────────────────────────────────────────────────────────────────────────────

import { BRAND } from '../config/brand.js'

// Imports for Phase 2 implementation. Currently unused — uncomment when generation wires.
// import { netWorth, ihtDynamic, costOfInaction, incomeTax, cashflowHealth, trajectoryData, calcFQ, calcRisk } from '../engine/fq-calculator.js'

const REPORT_TYPES = [
  {
    id: 'estate',
    title: 'Estate plan',
    body: 'A snapshot of your IHT exposure, gifts, nominations, will and LPA status — written in plain English with the technical detail in an appendix. SIPP enters estate from April 2027 (enacted), so the projection updates accordingly.',
    pages: '6–8 pages',
  },
  {
    id: 'tax',
    title: 'Tax summary',
    body: 'Income tax, allowances, dividends, CGT, and pension contribution headroom for the current tax year. Use it for your SA filing or hand to your accountant.',
    pages: '4–6 pages',
  },
  {
    id: 'cashflow',
    title: 'Cashflow projection',
    body: '12-month forward cashflow under your current plan, plus stress scenarios. Includes the funded-ratio and sustainable spend rate.',
    pages: '5–7 pages',
  },
  {
    id: 'nw',
    title: 'Net Worth snapshot',
    body: 'Everything you own and owe, grouped by wrapper, with trend data over the selected window. Good for personal records and family conversations.',
    pages: '3–5 pages',
  },
  {
    id: 'custom',
    title: 'Custom report',
    body: 'Pick sections from any of the above. Save the template for recurring use.',
    pages: 'variable',
  },
]

const PERIOD_OPTIONS = [
  { id: 'tax',      label: 'Tax year',      sub: '6 Apr – 5 Apr' },
  { id: 'calendar', label: 'Calendar year', sub: '1 Jan – 31 Dec' },
  { id: 'custom',   label: 'Custom range',  sub: 'Pick your own dates' },
]

export default function Reports({ onBack, onGenerate }) {
  // onGenerate is passed by Dashboard but intentionally not invoked in this
  // stub pass — buttons are disabled. Reference kept so the Phase 2 wire is
  // a one-line flip (remove disabled + uncomment onClick).
  void onGenerate

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">Reports</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            On-demand or scheduled
          </div>
        </div>
      </div>

      {/* Phase 2 honesty banner — replaces the previous "tap to generate" lie. */}
      <div
        role="status"
        style={{
          padding: '12px 14px', marginBottom: 16, borderRadius: 12,
          background: 'var(--c-tint-amber, rgba(255,179,71,.10))',
          border: '1px solid var(--c-border)',
          fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--c-text)' }}>Reports are in build.</strong>{' '}
        Templates locked; generation engine wiring in next sprint. The five reports
        below are previews of what will be produced — you can review the scope,
        but generation is disabled until Phase 2.
      </div>

      <div style={{ fontSize: 12, color: 'var(--c-text2)', marginBottom: 16, lineHeight: 1.55 }}>
        Each report will be generated from your current data + the rules bundle active
        that day. You'll be able to share with your adviser, accountant, or family.
      </div>

      {/* Period selector — stub. Disabled until Phase 2 wires Generate. */}
      <fieldset
        disabled
        aria-label="Reporting period"
        style={{
          margin: '0 0 16px', padding: '12px 14px',
          border: '1px solid var(--c-border)', borderRadius: 12,
          background: 'var(--c-surface2)', opacity: 0.7,
        }}
      >
        <legend style={{
          padding: '0 6px', fontSize: 11, color: 'var(--c-text3)',
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>
          Period · Selection coming with Generate Phase 2
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PERIOD_OPTIONS.map((p, i) => (
            <label key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, color: 'var(--c-text2)', cursor: 'not-allowed',
            }}>
              <input
                type="radio"
                name="report-period"
                value={p.id}
                defaultChecked={i === 0}
                disabled
                style={{ accentColor: 'var(--c-acc)' }}
              />
              <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{p.label}</span>
              <span style={{ color: 'var(--c-text3)' }}>· {p.sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REPORT_TYPES.map(r => (
          <div key={r.id} className="sw-tile">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>{r.title}</div>
              <span className="sw-chip sw-chip-sm">{r.pages}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 10 }}>
              {r.body}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-label={`Generate ${r.title} — coming in Phase 2`}
                title="Coming next — Phase 2"
                style={{
                  flex: 1, padding: '8px 14px', borderRadius: 10,
                  background: 'var(--c-surface2)', color: 'var(--c-text3)',
                  border: '1px solid var(--c-border)',
                  fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65,
                }}
              >
                Coming next — Phase 2
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                aria-label={`Schedule ${r.title} — coming in Phase 2`}
                title="Coming next — Phase 2"
                style={{
                  flex: 1, padding: '8px 14px', borderRadius: 10,
                  background: 'transparent', color: 'var(--c-text3)',
                  border: '1px solid var(--c-border)',
                  fontSize: 12, fontWeight: 700, cursor: 'not-allowed', opacity: 0.65,
                }}
              >
                Schedule — Phase 2
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 18, paddingTop: 12,
        borderTop: '1px solid var(--c-sep)',
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.55,
      }}>
        PDF/CSV export coming in Phase 2.
      </div>

      <p className="text-xs text-gray-400 text-center px-4 pb-4" style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', padding: '12px 16px 4px', lineHeight: 1.55 }}>
        {BRAND.disclaimer}
      </p>
      <p style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', padding: '0 16px 16px', lineHeight: 1.55 }}>
        {BRAND.rulesLabel()}
      </p>
    </div>
  )
}
