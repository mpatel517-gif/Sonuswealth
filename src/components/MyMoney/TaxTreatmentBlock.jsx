// ─────────────────────────────────────────────────────────────────────────────
// TaxTreatmentBlock — L3 spec §2.3 "Wrapper × tax treatment fast path"
//
// Three rows (Income · Capital gains · Inheritance) of plain-English copy
// generated from getTaxTreatmentSummary(asset, wrapper, bundle). Renders one
// per (wrapper, optional asset) so the drilldown can stack one block per
// wrapper bucket it covers.
//
// Props:
//   asset        Optional specific asset row to summarise. If omitted, the
//                block falls back to a wrapper-template summary using a
//                synthetic { type: wrapperLowercased } stub.
//   wrapper      Pre-resolved wrapper code (PENSION/ISA/GIA/...). If omitted,
//                derived from asset via getWrapper.
//   label        Optional override for the block heading.
//   compact      When true, removes the eyebrow + outer card chrome (used
//                inside parent sections with their own header).
//
// Each line carries inline ⓘ chips for jargon terms via ExplainerChip.
// ─────────────────────────────────────────────────────────────────────────────

import { getTaxTreatmentSummary } from '../../engine/tax-treatment.js'
import { getWrapper } from '../../engine/_helpers.js'
import ExplainerChip from '../shared/Explainer.jsx'

const ROW_META = {
  it:  { label: 'Income tax',     icon: '₤' },
  cgt: { label: 'Capital gains',  icon: '↗' },
  iht: { label: 'Inheritance',    icon: '↰' },
}

function injectHints(line, hints) {
  if (!hints || hints.length === 0) return [line]
  // For each hint term we find the first match and split around it; subsequent
  // hints apply to the still-string tail. Keeps the chip rendering linear.
  let segments = [line]
  for (const { term, explainerId } of hints) {
    const next = []
    for (const seg of segments) {
      if (typeof seg !== 'string') { next.push(seg); continue }
      const idx = seg.toLowerCase().indexOf(term.toLowerCase())
      if (idx < 0) { next.push(seg); continue }
      const before = seg.slice(0, idx)
      const match = seg.slice(idx, idx + term.length)
      const after = seg.slice(idx + term.length)
      if (before) next.push(before)
      next.push(
        <span key={`hint-${explainerId}`} style={{ whiteSpace: 'nowrap' }}>
          <span style={{
            borderBottom: '1px dashed var(--c-text3)',
            paddingBottom: 1,
          }}>{match}</span>
          <span style={{ display: 'inline-block', marginLeft: 4, verticalAlign: 'baseline' }}>
            <ExplainerChip id={explainerId} size={14} />
          </span>
        </span>
      )
      if (after) next.push(after)
    }
    segments = next
  }
  return segments
}

function Row({ rowKey, line, hints }) {
  const meta = ROW_META[rowKey]
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '24px 92px 1fr',
      gap: 10,
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid var(--c-sep)',
    }}>
      <div aria-hidden="true" style={{
        width: 24, height: 24, borderRadius: 6,
        background: 'var(--c-surface2)',
        color: 'var(--c-text3)',
        fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>{meta.icon}</div>
      <div style={{
        fontSize: 11, color: 'var(--c-text3)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        fontWeight: 700, paddingTop: 4,
      }}>{meta.label}</div>
      <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.5 }}>
        {injectHints(line, hints)}
      </div>
    </div>
  )
}

export default function TaxTreatmentBlock({ asset, wrapper, bundle, label, compact = false }) {
  const w = wrapper || getWrapper(asset || {})
  const stub = asset || { type: w === 'UNKNOWN' ? '' : w.toLowerCase() }
  const summary = getTaxTreatmentSummary(stub, w, bundle)
  const heading = label || `Tax treatment · ${w === 'UNKNOWN' ? 'wrapper unresolved' : w}`
  const unresolved = w === 'UNKNOWN' || summary.confidence === 0

  const content = (
    <div style={{ padding: compact ? 0 : 12 }}>
      {!compact && (
        <div style={{
          fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
          letterSpacing: 0.6, textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{heading}</span>
          {unresolved && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'var(--c-text2)',
              border: '1px dashed var(--c-text3)', borderRadius: 999,
              padding: '2px 7px', letterSpacing: 0.4,
            }}>
              NEEDS WRAPPER
            </span>
          )}
        </div>
      )}
      <Row rowKey="it"  line={summary.it}  hints={summary.hints?.filter(h => /income|salary|allowance|psa|pa/i.test(h.term))} />
      <Row rowKey="cgt" line={summary.cgt} hints={summary.hints?.filter(h => /aea|exempt|residence|ppr/i.test(h.term))} />
      <Row rowKey="iht" line={summary.iht} hints={summary.hints?.filter(h => /relief|nil-rate|rnrb|aps|business/i.test(h.term))} />
    </div>
  )

  if (compact) return content
  return (
    <div className="sw-card" style={{
      background: 'var(--card-bg2)',
      border: unresolved ? '1px dashed var(--c-text3)' : '1px solid var(--c-border)',
      borderRadius: 14,
      marginTop: 8,
    }}>
      {content}
    </div>
  )
}
