// ─────────────────────────────────────────────────────────────────────────────
// PriorYearSAForm — capture a prior-year Self-Assessment record (M2).
//
// Manual entry of the ~6 key figures from last year's SA302 / tax return that
// the current/future computation needs: the POA base (income tax + Class 4 NIC),
// PAYE tax at source, pension AA unused (carry-forward), capital losses c/f, and
// any gifts (7-yr IHT clock). Collects into a PriorYearRecord and hands it to
// onSave; the parent persists it (tax-history store) + commits the event.
//
// Upload/parse (SA302 PDF → FP-5 verify) reuses the same onSave contract — the
// parsed fields just pre-fill this form before the user confirms.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { RULE_YEARS } from '../../hooks/useTaxYear.jsx'

const FIELDS = [
  { key: 'incomeTaxPlusClass4', label: 'Income tax + Class 4 NIC that year', hint: 'The base for payments on account', prefix: '£' },
  { key: 'totalIncome',         label: 'Total income',                       hint: 'Box on your SA302',            prefix: '£' },
  { key: 'payeTaxPaid',         label: 'Tax already paid (PAYE)',            hint: 'Tax deducted at source',       prefix: '£' },
  { key: 'pensionAaUnused',     label: 'Unused pension allowance',          hint: 'Carries forward up to 3 years', prefix: '£' },
  { key: 'capitalLosses',       label: 'Capital losses carried forward',    hint: 'Set against future gains',     prefix: '£' },
]

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: 'var(--c-surface2)',
  border: '1px solid var(--c-border)', color: 'var(--c-text)', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
}

export default function PriorYearSAForm({ currentYear = '2026/27', initialYear, initialValues, parsedSource, onSave, onCancel }) {
  // Default to the year immediately before the current one.
  const priorYears = RULE_YEARS.filter((y) => y !== currentYear)
  // When the caller targets a specific year (e.g. a row in the 5-year ledger),
  // seed that year; otherwise default to the most recent prior year.
  const [taxYear, setTaxYear] = useState(
    (initialYear && priorYears.includes(initialYear))
      ? initialYear
      : (priorYears[priorYears.length - 1] || RULE_YEARS[0])
  )
  // initialValues lets an upload pre-fill the form (FP-5: parse → user verifies
  // → commit). Keys match FIELDS ids. Empty object = blank manual entry.
  const [vals, setVals] = useState(() => {
    const seed = {}
    if (initialValues && typeof initialValues === 'object') {
      for (const k of Object.keys(initialValues)) {
        if (initialValues[k] != null && initialValues[k] !== '') seed[k] = String(initialValues[k])
      }
    }
    return seed
  })
  const [giftAmount, setGiftAmount] = useState('')
  const [giftDate, setGiftDate] = useState('')

  const set = (k) => (e) => setVals((v) => ({ ...v, [k]: e.target.value }))
  const num = (k) => Math.round(+vals[k] || 0)

  function submit(e) {
    e.preventDefault()
    const gifts = (+giftAmount > 0 && giftDate) ? [{ date: giftDate, amount: Math.round(+giftAmount) }] : []
    const record = {
      taxYear,
      source: 'manual',
      filed: true,
      confidence: 1.0,
      figures: {
        totalIncome: num('totalIncome'),
        payeTaxPaid: num('payeTaxPaid'),
        incomeTaxPlusClass4: num('incomeTaxPlusClass4'),
        pensionAaUnused: num('pensionAaUnused'),
        lossesCarried: { capital: num('capitalLosses'), rental: 0, trading: 0 },
        gifts,
      },
    }
    onSave?.(record)
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
        borderRadius: 12, padding: 14, marginBottom: 14, display: 'grid', gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
        Add a prior year’s return
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--c-text3)', marginTop: 2 }}>
          From your SA302 / tax calculation. Firms up this year’s payments-on-account and carry-forward figures. Leave blank what you don’t have.
        </div>
      </div>

      {parsedSource && (
        <div style={{
          fontSize: 11, lineHeight: 1.5, color: 'var(--c-text)',
          background: 'var(--c-tint-warning, var(--c-surface))', border: '1px solid var(--c-warning)',
          borderRadius: 10, padding: '8px 10px',
        }}>
          <strong>Read from your document.</strong> {parsedSource} Check each figure against the
          paper and correct anything that’s off before saving — nothing is stored until you confirm.
        </div>
      )}

      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--c-text3)', letterSpacing: 0.3 }}>Tax year</span>
        <select value={taxYear} onChange={(e) => setTaxYear(e.target.value)} style={inputStyle}>
          {priorYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>

      {FIELDS.map((f) => (
        <label key={f.key} style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text3)', letterSpacing: 0.3 }}>
            {f.label} <span style={{ color: 'var(--c-text3)', opacity: 0.7 }}>· {f.hint}</span>
          </span>
          <input
            type="number" inputMode="numeric" min="0" placeholder="0"
            value={vals[f.key] ?? ''} onChange={set(f.key)} style={inputStyle}
          />
        </label>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>Gift made (optional)</span>
          <input type="number" min="0" placeholder="£ amount" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>Gift date</span>
          <input type="date" value={giftDate} onChange={(e) => setGiftDate(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="sw-chip" style={{ cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}>Cancel</button>
        <button type="submit" className="sw-chip sw-chip-mint" style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 14px' }}>Save return</button>
      </div>
    </form>
  )
}
