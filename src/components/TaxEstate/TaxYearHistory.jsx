// ─────────────────────────────────────────────────────────────────────────────
// TaxYearHistory — your last 5 tax years, by year, for taxation purposes.
//
// Founder requirement (stated repeatedly): a per-year record of financial data
// for tax — not a projection, not a net-worth trend. This is the visible
// surface over the data model that already exists:
//   • current year (2026/27) is seeded LIVE from the same saComputation() the
//     SA estimate above uses, so the headline ties out exactly (§9.5 Gate 2);
//   • the 4 prior years read the durable tax-history store (localStorage
//     `sonuswealth.taxhistory`), the same store that feeds carry-forward (losses,
//     pension AA) and payments-on-account. Years with no record show an honest
//     "Not added yet — add" affordance, never a fabricated zero.
//
// Layout follows the drawer doctrine (founder issue 5/13): collapsed by default,
// a 5-bar at-a-glance trend on open, then one expandable row per year. Each row
// drills to its detail (issue 6). "Why each year matters" footer ties the record
// back to a decision (issue 9/10) — these years are not a museum, they change
// this year's allowance headroom and payments on account.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { saComputation } from '../../engine/sa-computation.js'
import { readTaxHistory, deriveCarryForwardFromHistory, upsertPriorYear, removePriorYear } from '../../state/tax-history.js'
import PriorYearSAForm from './PriorYearSAForm.jsx'

// Last 5 tax years = the current (in-progress) year + the 4 completed years
// before it. RULE_YEARS goes back to 2021/22, so all five resolve to a real
// rule year the capture form can target.
const YEARS = ['2026/27', '2025/26', '2024/25', '2023/24', '2022/23']
const CURRENT = '2026/27'

// Precise GBP — a tax record needs exact figures, not the app's compact "£9k".
function money(n) {
  const v = Math.round(+n || 0)
  const s = `£${Math.abs(v).toLocaleString('en-GB')}`
  return v < 0 ? `−${s}` : s
}
// Compact, for the small trend bars where space is tight.
function compact(n) {
  const v = Math.round(+n || 0)
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `£${v}`
}

const SOURCE_BADGE = {
  estimate: { label: 'This year · estimate', colour: 'var(--c-warning)' },
  manual:   { label: 'Filed',                colour: 'var(--c-success)' },
  upload:   { label: 'From document',        colour: 'var(--c-success)' },
  hmrc:     { label: 'From HMRC',            colour: 'var(--c-success)' },
  empty:    { label: 'Not added yet',        colour: 'var(--c-text3)' },
}

function Badge({ kind }) {
  const b = SOURCE_BADGE[kind] || SOURCE_BADGE.empty
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: b.colour,
      border: `1px solid ${b.colour}`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap',
    }}>
      {b.label}
    </span>
  )
}

// One detail fact row inside an expanded year.
function Fact({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--c-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{sub}</div>}
      </div>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', color: 'var(--c-text)' }}>{value}</div>
    </div>
  )
}

export default function TaxYearHistory({ entity, personaId, onCommit }) {
  const [expanded, setExpanded] = useState(false)
  const [openYear, setOpenYear] = useState(null)
  const [addYear, setAddYear] = useState(null)
  const [tick, setTick] = useState(0)

  const history = useMemo(
    () => (personaId ? readTaxHistory(personaId) : {}),
    [personaId, tick],
  )
  const priorYearStore = useMemo(
    () => (personaId ? deriveCarryForwardFromHistory(personaId, CURRENT) : null),
    [personaId, tick],
  )
  // Current-year row reads the SAME computation as the SA estimate above → ties out.
  const sa = useMemo(() => {
    if (!entity) return null
    try {
      return saComputation(entity, 'tax-2026-27', 'UK-2026.1', {
        priorYearStore,
        priorYearLiability: priorYearStore?._priorYearLiability,
      })
    } catch { return null }
  }, [entity, priorYearStore])

  const rows = useMemo(() => YEARS.map((year) => {
    if (year === CURRENT && sa) {
      const c = sa.computation
      const nic = (+c.nic?.class2 || 0) + (+c.nic?.class4 || 0)
      return {
        year, kind: 'estimate',
        totalIncome: c.total_income,
        incomeTax: c.income_tax_due,
        dividendTax: c.dividend_tax,
        nic, cgt: c.cgt_due,
        totalTax: c.tax_due_before_poa,
        paye: c.tax_at_source?.paye || 0,
        poa: c.payments_on_account_made || 0,
        balancing: c.balancing_payment,
      }
    }
    const rec = history[year]
    if (rec && rec.figures) {
      const f = rec.figures
      return {
        year, kind: rec.source || 'manual',
        totalIncome: f.totalIncome || 0,
        incomeTaxPlusClass4: f.incomeTaxPlusClass4 || 0,
        paye: f.payeTaxPaid || 0,
        totalTax: f.incomeTaxPlusClass4 || 0,
        poa: f.paymentsOnAccountMade || 0,
        pensionAaUnused: f.pensionAaUnused || 0,
        losses: f.lossesCarried || null,
        gifts: Array.isArray(f.gifts) ? f.gifts : [],
      }
    }
    return { year, kind: 'empty' }
  }), [sa, history])

  const captured = rows.filter((r) => r.kind !== 'empty' && r.kind !== 'estimate').length
  const maxTax = Math.max(1, ...rows.map((r) => +r.totalTax || 0))

  function handleSave(record) {
    upsertPriorYear(personaId, record)
    const derived = deriveCarryForwardFromHistory(personaId, CURRENT)
    if (derived && onCommit && personaId) {
      const { _priorYearLiability, ...cf } = derived // eslint-disable-line no-unused-vars
      onCommit(personaId, { type: 'PRIOR_YEAR_SA_CAPTURED', payload: { taxYear: record.taxYear, carryForward: cf } })
    }
    setAddYear(null)
    setOpenYear(record.taxYear)
    setTick((n) => n + 1)
  }

  function handleRemove(year) {
    removePriorYear(personaId, year)
    setOpenYear(null)
    setTick((n) => n + 1)
  }

  return (
    <section
      data-tax-year-history
      style={{
        marginTop: 12, border: '1px solid var(--c-border)', borderRadius: 16,
        background: 'var(--c-surface)', overflow: 'hidden',
      }}
    >
      {/* Header — always visible, collapsed by default (drawer doctrine) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
            Tax record · last 5 years
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            {captured > 0
              ? `${captured} of 4 prior years on file · feeds carry-forward & payments on account`
              : 'Your figures year by year · feeds carry-forward & payments on account'}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 16px' }}>
          {/* At-a-glance 5-year trend — the value of "by year" is the comparison. */}
          <div
            role="img"
            aria-label="Tax for the year, last 5 years"
            style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 84, padding: '4px 2px 0', marginBottom: 6 }}
          >
            {rows.slice().reverse().map((r) => {
              const v = +r.totalTax || 0
              const h = r.kind === 'empty' ? 6 : Math.max(6, Math.round((v / maxTax) * 64))
              const isCur = r.year === CURRENT
              return (
                <div key={r.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: r.kind === 'empty' ? 'var(--c-text3)' : 'var(--c-text2)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.kind === 'empty' ? '—' : compact(v)}
                  </div>
                  <div
                    title={r.kind === 'empty' ? `${r.year} — not added` : `${r.year} — ${money(v)}`}
                    style={{
                      width: '70%', height: h, borderRadius: '4px 4px 0 0',
                      background: r.kind === 'empty'
                        ? 'var(--c-sep)'
                        : (isCur ? 'var(--c-warning)' : 'var(--c-acc)'),
                      opacity: r.kind === 'empty' ? 0.6 : 1,
                    }}
                  />
                  <div style={{ fontSize: 9, color: isCur ? 'var(--c-text)' : 'var(--c-text3)', fontWeight: isCur ? 700 : 500, letterSpacing: 0.2 }}>
                    {r.year.replace('/', '/')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Per-year rows — current first, then most-recent prior down to -4 */}
          <div style={{ display: 'grid', gap: 0 }}>
            {rows.map((r) => {
              const isOpen = openYear === r.year
              const isEmpty = r.kind === 'empty'
              return (
                <div key={r.year} style={{ borderTop: '1px solid var(--c-sep)' }}>
                  <button
                    onClick={() => { if (isEmpty) { setAddYear(r.year); setOpenYear(null) } else setOpenYear(isOpen ? null : r.year) }}
                    aria-expanded={!isEmpty && isOpen}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, padding: '11px 2px', background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', minWidth: 56 }}>
                        {r.year}
                      </span>
                      <Badge kind={r.kind} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isEmpty
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-acc)' }}>＋ Add</span>
                        : <>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}
                              data-tieout={r.year === CURRENT ? 'tax-history.current-total' : undefined}>
                              {money(r.totalTax)}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{isOpen ? '▲' : '▼'}</span>
                          </>}
                    </div>
                  </button>

                  {!isEmpty && isOpen && (
                    <div style={{ background: 'var(--c-surface2)', borderRadius: 10, padding: '8px 12px', margin: '0 2px 10px' }}>
                      <Fact label="Total income" value={money(r.totalIncome)} />
                      {r.kind === 'estimate' ? (
                        <>
                          <Fact label="Income tax" value={money(r.incomeTax)} />
                          {r.dividendTax > 0 && <Fact label="Dividend tax" value={money(r.dividendTax)} />}
                          {r.nic > 0 && <Fact label="National Insurance" value={money(r.nic)} sub="Class 2 + 4" />}
                          {r.cgt > 0 && <Fact label="Capital gains tax" value={money(r.cgt)} />}
                          <Fact label="Tax due for the year" value={money(r.totalTax)} />
                          {r.paye > 0 && <Fact label="Already paid (PAYE)" value={money(r.paye)} />}
                          <Fact label="Balancing payment 31 Jan" value={money(r.balancing)} />
                        </>
                      ) : (
                        <>
                          <Fact label="Income tax + Class 4 NIC" value={money(r.incomeTaxPlusClass4)} sub="Payments-on-account base for the next year" />
                          {r.paye > 0 && <Fact label="Tax already paid (PAYE)" value={money(r.paye)} />}
                          {r.poa > 0 && <Fact label="Payments on account made" value={money(r.poa)} />}
                          {r.pensionAaUnused > 0 && <Fact label="Unused pension allowance" value={money(r.pensionAaUnused)} sub="Carries forward up to 3 years" />}
                          {r.losses && (r.losses.capital > 0 || r.losses.rental > 0 || r.losses.trading > 0) && (
                            <Fact
                              label="Losses carried forward"
                              value={money((r.losses.capital || 0) + (r.losses.rental || 0) + (r.losses.trading || 0))}
                              sub={[r.losses.capital > 0 && 'capital', r.losses.rental > 0 && 'rental', r.losses.trading > 0 && 'trading'].filter(Boolean).join(' · ')}
                            />
                          )}
                          {r.gifts.length > 0 && (
                            <Fact label="Gifts logged" value={money(r.gifts.reduce((s, g) => s + (+g.amount || 0), 0))} sub={`${r.gifts.length} · 7-year IHT clock`} />
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button onClick={() => setAddYear(r.year)} className="sw-chip" style={{ fontSize: 11, cursor: 'pointer', padding: '4px 10px' }}>Edit</button>
                            <button onClick={() => handleRemove(r.year)} className="sw-chip" style={{ fontSize: 11, cursor: 'pointer', padding: '4px 10px', color: 'var(--c-danger)' }}>Remove</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Capture / edit form for this specific year */}
                  {addYear === r.year && (
                    <div style={{ margin: '0 2px 12px' }}>
                      <PriorYearSAForm
                        currentYear={CURRENT}
                        initialYear={r.year}
                        onSave={handleSave}
                        onCancel={() => setAddYear(null)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Why each year matters — the record is not a museum (issue 9/10). */}
          <div style={{
            fontSize: 11, lineHeight: 1.5, color: 'var(--c-text3)',
            background: 'var(--c-surface2)', borderRadius: 10, padding: '9px 11px', marginTop: 12,
          }}>
            These years aren't history for its own sake. Your last 3 years of unused pension
            allowance can still be paid in; capital losses carry forward against future gains;
            and last year's tax sets this year's payments on account. Adding a year firms up
            those numbers above.
          </div>
        </div>
      )}
    </section>
  )
}
