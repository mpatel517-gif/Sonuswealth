// ─────────────────────────────────────────────────────────────────────────────
// SAComputationView — Self-Assessment filing-format estimate for the user's
// accountant (M1·1D). Renders src/engine/sa-computation.js output as SA100/SA110-
// shaped sections + a tax computation, with tap-to-expand "how this was
// calculated / where it came from / which rule" per line (depth on tap, macOS
// principle) and a print/export affordance.
//
// Framing (founder 2026-06-08): this is an ESTIMATE to verify — NOT a return we
// file. The disclaimer is always visible. Submission to HMRC is out of scope.
//
// Imports saComputation DIRECTLY (not via fq-calculator) to avoid a circular
// import — sa-computation.js already imports from fq-calculator.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react'
import { saComputation } from '../../engine/sa-computation.js'
import { DrillableNumber } from '../MyMoney/L3/DrillableNumber.jsx'
import PriorYearSAForm from './PriorYearSAForm.jsx'
import { deriveCarryForwardFromHistory, upsertPriorYear, readTaxHistory } from '../../state/tax-history.js'

const CONF = {
  high: { label: 'High confidence', colour: 'var(--c-success)' },
  med:  { label: 'Estimate',        colour: 'var(--c-warning)' },
  low:  { label: 'Provisional',     colour: 'var(--c-danger)' },
}

// Precise GBP — an accountant-facing document needs exact figures, NOT the
// app's compact "£9k" display formatter.
function money(n) {
  const v = Math.round(+n || 0)
  const s = `£${Math.abs(v).toLocaleString('en-GB')}`
  return v < 0 ? `−${s}` : s
}

function ConfBadge({ confidence }) {
  const c = CONF[confidence] || CONF.med
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: c.colour,
      border: `1px solid ${c.colour}`, borderRadius: 999, padding: '1px 7px',
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

// Collapsible SA section — keeps the filing-format detail from rendering as one
// wall (founder #13). Header shows the section + line count; body opens on tap.
function SectionDrawer({ title, page, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--c-sep)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '10px 2px', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text2)' }}>
          {title}{page ? <span style={{ fontWeight: 500, color: 'var(--c-text3)' }}> ({page})</span> : null}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {count != null && <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>{count} {count === 1 ? 'line' : 'lines'}</span>}
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && <div style={{ paddingBottom: 10 }}>{children}</div>}
    </div>
  )
}

// One SA line: label (+ box) on the left, drillable amount on the right; tapping
// the amount toggles an inline detail block (formula / rule / source / confidence).
function LineRow({ line, lineKey, openKey, setOpenKey }) {
  const open = openKey === lineKey
  const onDrill = () => setOpenKey(open ? null : lineKey)
  return (
    <div style={{ borderBottom: '1px solid var(--c-sep)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '8px 2px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--c-text)' }}>
            {line.label}
            {line.provisional && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--c-danger)' }}>provisional</span>
            )}
          </div>
          {line.sa_box && (
            <div style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: 0.3 }}>{line.sa_box}</div>
          )}
        </div>
        <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
          <DrillableNumber
            metric={line.label}
            value={money(line.amount)}
            confidence={line.confidence}
            onDrill={onDrill}
          />
        </div>
      </div>
      {open && (
        <div style={{
          background: 'var(--c-surface2)', borderRadius: 10, padding: '10px 12px', margin: '0 2px 10px',
          display: 'grid', gap: 8,
        }}>
          <Fact label="How this is calculated" value={line.formula} />
          {line.rule?.length > 0 && <Fact label="Rule" value={line.rule.join(' · ')} mono />}
          <Fact label="Where the data came from" value={line.source} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--c-text3)', textTransform: 'uppercase' }}>Confidence</span>
            <ConfBadge confidence={line.confidence} />
          </div>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, mono }) {
  if (!value) return null
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--c-text3)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', fontFamily: mono ? 'var(--font-mono, monospace)' : 'inherit' }}>{value}</div>
    </div>
  )
}

// A computation-tail row (the SA110 working). `strong` for subtotals.
function CompRow({ label, amount, strong, note, danger }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 2px',
      borderTop: strong ? '1px solid var(--c-border)' : 'none',
    }}>
      <span style={{ fontSize: strong ? 13 : 12, fontWeight: strong ? 700 : 500, color: 'var(--c-text2)' }}>
        {label}
        {note && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--c-text3)' }}>{note}</span>}
      </span>
      <span style={{
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        fontSize: strong ? 14 : 12, fontWeight: strong ? 800 : 600,
        color: danger ? 'var(--c-danger)' : 'var(--c-text)',
      }}>
        {money(amount)}
      </span>
    </div>
  )
}

export default function SAComputationView({ entity, personaId, onCommit }) {
  const [expanded, setExpanded] = useState(true)
  const [openKey, setOpenKey] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [historyTick, setHistoryTick] = useState(0)

  // Re-derive when a prior-year record is added (or changed in another tab).
  useEffect(() => {
    const bump = () => setHistoryTick((n) => n + 1)
    if (typeof window === 'undefined') return undefined
    window.addEventListener('sonus:taxhistory', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('sonus:taxhistory', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  // Prior-year store → drives losses c/f + payments-on-account (firm vs provisional).
  const priorYearStore = useMemo(
    () => (personaId ? deriveCarryForwardFromHistory(personaId, '2026/27') : null),
    [personaId, historyTick],
  )
  const priorYearCount = useMemo(
    () => (personaId ? Object.keys(readTaxHistory(personaId)).length : 0),
    [personaId, historyTick],
  )

  const sa = useMemo(
    () => (entity ? saComputation(entity, 'tax-2026-27', 'UK-2026.1', {
      priorYearStore,
      priorYearLiability: priorYearStore?._priorYearLiability,
    }) : null),
    [entity, priorYearStore],
  )
  if (!sa) return null

  function handleSavePriorYear(record) {
    upsertPriorYear(personaId, record)
    // Commit the audit event so entity.carryForward propagates app-wide (Ask
    // Sonu / tax-year-state). The durable copy is the localStorage store; this
    // is the in-session fold.
    const derived = deriveCarryForwardFromHistory(personaId, '2026/27')
    if (derived && onCommit && personaId) {
      const { _priorYearLiability, ...cf } = derived
      onCommit(personaId, { type: 'PRIOR_YEAR_SA_CAPTURED', payload: { taxYear: record.taxYear, carryForward: cf } })
    }
    setShowForm(false)
    setHistoryTick((n) => n + 1)
  }

  const c = sa.computation
  // 'tax-2026-27' → '2026/27'
  const yearLabel = String(sa.year).replace(/^tax-/, '').replace('-', '/')

  return (
    <section
      data-sa-computation
      className="sw-printable"
      style={{
        marginTop: 14, border: '1px solid var(--c-border)', borderRadius: 16,
        background: 'var(--c-surface)', overflow: 'hidden',
      }}
    >
      {/* Header — always visible */}
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
            Self-Assessment estimate <span style={{ color: 'var(--c-text3)', fontWeight: 500 }}>· for your accountant</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            {yearLabel} · estimated tax due before payments on account {money(c.tax_due_before_poa)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ConfBadge confidence={sa.confidence} />
          <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 16px' }}>
          {/* Disclaimer — always shown when open (founder #1, FCA boundary) */}
          <div style={{
            fontSize: 11, lineHeight: 1.5, color: 'var(--c-text3)',
            background: 'var(--c-surface2)', borderRadius: 10, padding: '8px 10px', marginBottom: 14,
          }}>
            {sa.disclaimer}
          </div>

          {/* Actions — add prior-year data (firms up provisional figures) + export */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="sw-chip"
              style={{ fontSize: 12, cursor: 'pointer', padding: '5px 12px' }}
            >
              {priorYearCount > 0
                ? `＋ Add another year (${priorYearCount} on file)`
                : '＋ Add last year’s return to improve this estimate'}
            </button>
            <button
              onClick={() => window.print()}
              className="sw-chip"
              style={{ fontSize: 12, cursor: 'pointer', padding: '5px 12px' }}
            >
              ⎙ Print / export for accountant
            </button>
          </div>

          {showForm && (
            <PriorYearSAForm
              currentYear="2026/27"
              onSave={handleSavePriorYear}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Headline summary — the two numbers that matter, always visible so
              the filing detail below can stay collapsed (founder #13). */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 140, background: 'var(--c-surface2)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text3)' }}>Tax due for the year</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{money(c.tax_due_before_poa)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: 'var(--c-surface2)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--c-text3)' }}>Balancing payment · 31 Jan</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-coral-text, var(--c-danger))', fontVariantNumeric: 'tabular-nums' }}>{money(c.balancing_payment)}</div>
            </div>
          </div>

          {/* Filing-format detail — one collapsible drawer per SA page (was a
              single wall of every line at once). */}
          {sa.sections.map((section) => (
            <SectionDrawer key={section.page} title={section.title} page={section.page} count={section.lines.length} defaultOpen={false}>
              {section.lines.map((line, i) => (
                <LineRow
                  key={`${section.page}-${i}`}
                  line={line}
                  lineKey={`${section.page}-${i}`}
                  openKey={openKey}
                  setOpenKey={setOpenKey}
                />
              ))}
            </SectionDrawer>
          ))}

          {/* Tax computation (SA110 working) — collapsible */}
          <SectionDrawer title="Tax computation" page="SA110" defaultOpen={false}>
            <CompRow label="Total income" amount={c.total_income} />
            {c.reliefs > 0 && <CompRow label="Less: reliefs" amount={-c.reliefs} />}
            <CompRow label="Personal allowance" amount={-c.personal_allowance} />
            <CompRow label="Taxable income" amount={c.taxable_income} strong />
            {/* Non-dividend bands only — dividend bands roll into the separate
                "Dividend tax" line below, so these rows sum to income tax due. */}
            {c.tax_by_band.filter((b) => !String(b.band).startsWith('div')).map((b, i) => (
              <CompRow key={i} label={`Tax @ ${Math.round(b.rate * 100)}%`} amount={Math.round(b.amount * b.rate)} note={`on ${money(b.amount)}`} />
            ))}
            <CompRow label="Income tax due" amount={c.income_tax_due} strong />
            {c.dividend_tax > 0 && <CompRow label="Dividend tax" amount={c.dividend_tax} />}
            {(c.nic.class2 > 0 || c.nic.class4 > 0) && (
              <CompRow label="National Insurance (Class 2 + 4)" amount={c.nic.class2 + c.nic.class4} />
            )}
            {c.cgt_due > 0 && <CompRow label="Capital gains tax" amount={c.cgt_due} />}
            <CompRow label="Tax due for the year" amount={c.tax_due_before_poa} strong />
            {c.tax_at_source.paye > 0 && <CompRow label="Less: tax already paid (PAYE)" amount={-c.tax_at_source.paye} />}
            {c.payments_on_account_made > 0 && <CompRow label="Less: payments on account made" amount={-c.payments_on_account_made} />}
            <CompRow label="Balancing payment due 31 Jan" amount={c.balancing_payment} strong danger />
            {c.poa_next_year.length > 0 && c.poa_next_year.map((p, i) => (
              <CompRow
                key={`poa-${i}`}
                label={`Payment on account due ${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                amount={p.amount}
                note={p.provisional ? 'provisional' : undefined}
              />
            ))}
          </SectionDrawer>

          {/* Provisional summary — full-border note (no side-stripe, DESIGN.md) */}
          {sa.provisionalFlags.length > 0 && (
            <div style={{
              marginTop: 12, fontSize: 11, lineHeight: 1.5, color: 'var(--c-text3)',
              border: '1px solid var(--c-warning)', borderRadius: 10, padding: '8px 10px',
              background: 'var(--c-surface2)',
            }}>
              <strong style={{ color: 'var(--c-warning)' }}>Why some figures are provisional:</strong>{' '}
              {sa.provisionalFlags.join('; ')}. Add last year's return to firm these up.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
