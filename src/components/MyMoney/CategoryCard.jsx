// ─────────────────────────────────────────────────────────────────────────────
// CategoryCard — one of the 10 grouped category cards per MyMoney v2.7 §3.4.
//
// Categories: Pensions / Savings & Investments / Property / Business Assets /
// Protection / Cash / Liabilities / Income / Alternatives / Obligations.
//
// Each category holds 1+ underlying domain rows (e.g. Savings & Investments
// holds C ISAs + D GIA + E venture + F bonds). The card shows:
//   · Category name + subtotal in header
//   · Top-line item summary (e.g. "3 ISAs · 2 GIAs · 1 EIS")
//   · "+ Add" pill that opens the bucket-style AddItemSheet
//   · Expand to show all underlying rows with wrapper badges
//
// Phase 2 follow-up — bringing my own visual opinion. Glass card, drop-shadow
// on subtotal, animation on expand.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v).toLocaleString()}`
}

const WRAPPER_TONE = {
  PENSION:  'var(--c-acc2, #7AA7FF)',
  ISA:      'var(--c-acc, #5DDBC2)',
  GIA:      'var(--c-violet, #BA8CFF)',
  EIS:      'var(--c-violet, #BA8CFF)',
  SEIS:     'var(--c-violet, #BA8CFF)',
  VCT:      'var(--c-violet, #BA8CFF)',
  BOND_ON:  'var(--c-gold, #FFB347)',
  BOND_OFF: 'var(--c-gold, #FFB347)',
  PROPERTY: '#FF9F0A',
  CASH:     '#34C759',
  TRUST:    'var(--c-violet, #BA8CFF)',
  STATE:    'var(--c-text3)',
}

export default function CategoryCard({
  id,
  label,
  domainCodes = '',           // e.g. "Domain C + D + E + F"
  rows = [],                  // array of { id, label, value, sub, wrapper }
  subtotal,
  liability = false,          // render in coral / liabilities styling
  onRowTap,
  onAdd,                      // opens AddItemSheet for this category
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const total = subtotal != null ? subtotal : rows.reduce((s, r) => s + (+r.value || 0), 0)
  const wrapperCounts = {}
  for (const r of rows) {
    const w = r.wrapper || 'OTHER'
    wrapperCounts[w] = (wrapperCounts[w] || 0) + 1
  }
  const summary = Object.entries(wrapperCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w, n]) => `${n} ${w.replace('_', ' ').toLowerCase()}`)
    .join(' · ')

  const accentColor = liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-acc)'
  const empty = rows.length === 0

  return (
    <div className="sw-card sw-card-elevated sw-cinema" style={{
      padding: 14,
      background: 'var(--card-bg2)',
      border: `1px solid ${open ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : 'var(--c-border)'}`,
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: open ? `0 16px 38px rgba(0,0,0,0.28), 0 0 0 1px color-mix(in srgb, ${accentColor} 15%, transparent)` : 'var(--sh)',
      marginBottom: 10,
      transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    }}>
      {/* Header row — click to expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, cursor: 'pointer',
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -0.1 }}>
              {label}
            </span>
            {/* domainCodes intentionally hidden — engineering taxonomy codes (Domain A/B/…)
                are not user-facing per the plain-English principle. Still passed as a
                prop so future filtering / analytics can use them internally. */}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.4 }}>
            {empty
              ? 'No items captured yet — tap Add to get started.'
              : `${rows.length} item${rows.length === 1 ? '' : 's'} · ${summary}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 880,
            color: empty ? 'var(--c-text3)' : (liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'),
            fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
          }}>
            {empty ? '—' : fmt(total)}
          </div>
          <span style={{
            fontSize: 14, color: 'var(--c-text3)',
            display: 'inline-block',
            transition: 'transform 0.25s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            marginTop: 4,
          }}>›</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid var(--c-sep)',
          animation: 'sw-fade-up 0.35s var(--ease-out-cubic) both',
        }}>
          {/* Item rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.length === 0 && (
              <div style={{
                fontSize: 12, color: 'var(--c-text3)', padding: '8px 4px',
                fontStyle: 'italic',
              }}>
                Nothing here yet. The Add button below walks you through what to capture.
              </div>
            )}
            {rows.map(r => {
              const wTone = WRAPPER_TONE[r.wrapper] || 'var(--c-text3)'
              return (
                <button
                  key={r.id}
                  onClick={(e) => { e.stopPropagation(); onRowTap?.(r) }}
                  className="sw-pressable"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-border)',
                    borderLeft: `3px solid ${wTone}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}>
                  {r.wrapper && (
                    <span className={`sw-chip sw-chip-sm`} style={{
                      fontSize: 9, fontWeight: 800,
                      background: `color-mix(in srgb, ${wTone} 14%, transparent)`,
                      color: wTone,
                      padding: '2px 7px', borderRadius: 100,
                      whiteSpace: 'nowrap',
                    }}>
                      {r.wrapper.replace('_', ' ')}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                    </div>
                    {r.sub && (
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.sub}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: liability ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1,
                  }}>
                    {fmt(+r.value || 0)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Add pill */}
          <button
            onClick={(e) => { e.stopPropagation(); onAdd?.(id) }}
            className="sw-pressable"
            style={{
              marginTop: 12, width: '100%',
              padding: '10px 14px',
              background: `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 12%, transparent), color-mix(in srgb, ${accentColor} 4%, transparent))`,
              border: `1px dashed color-mix(in srgb, ${accentColor} 40%, transparent)`,
              borderRadius: 100,
              color: accentColor,
              fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
              cursor: 'pointer',
            }}>
            + Add to {label.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  )
}
