// ─────────────────────────────────────────────────────────────────────────────
// ProvenanceChip — tiny pill listing the data sources behind a metric
// Spec: every metric needs source disclosure.
//
// Tap → bottom sheet listing the exact source lines (full strings, not just
// the chip's compact summary).
//
// Props:
//   sources  string[]  — e.g. ['Your data', 'UK-2026.1', 'CMA-2026.1', 'Your Vault']
//   onTap    fn?       — optional override; if not provided, tapping opens
//                        the local bottom sheet
//   size     'small' | 'large'  (default 'small')
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

const SOURCE_DETAIL = {
  'Your data':         'Live values from your linked accounts and on-screen entries.',
  'UK-2026.1':         'Sonuswealth UK rules pack — tax bands, allowances, thresholds for the 2026/27 tax year.',
  'CMA-2026.1':        'Sonuswealth Capital Market Assumptions — long-run return / volatility / inflation inputs (April 2026).',
  'Your Vault':        'Files and statements you have uploaded to your encrypted document vault.',
  'General guidance':  'Educational context derived from public guidance — never personalised regulated advice.',
}

export default function ProvenanceChip({ sources = [], onTap, size = 'small' }) {
  const [open, setOpen] = useState(false)
  if (!sources || !sources.length) return null

  const compactList = sources.length <= 2
    ? sources.join(' · ')
    : `${sources[0]} · +${sources.length - 1}`

  function handleTap() {
    if (onTap) onTap()
    else setOpen(true)
  }

  // Refined: subtle mint-outlined chip, lighter visual weight.
  const sizeCls = size === 'large' ? '' : 'sw-chip-sm'

  return (
    <>
      <button
        onClick={handleTap}
        aria-label={`Sources: ${sources.join(', ')}`}
        className={`sw-chip ${sizeCls} sw-chip-mint sw-chip-outline`}
        style={{
          cursor: 'pointer',
          opacity: 0.85,
        }}
      >
        <span style={{ fontSize: size === 'large' ? 10 : 8, opacity: 0.7 }}>◆</span>
        <span>{compactList}</span>
      </button>

      {open && (
        <ProvenanceSheet sources={sources} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function ProvenanceSheet({ sources, onClose }) {
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          background: 'var(--c-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 28px',
          maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{
          width: 36, height: 5, borderRadius: 3,
          background: 'var(--c-sep)', margin: '0 auto 16px',
        }} />
        <div style={{
          fontSize: 'var(--fs-title)', fontWeight: 800,
          color: 'var(--c-text)', marginBottom: 12,
        }}>
          Sources
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {sources.map((s, i) => (
            <div key={s} style={{
              padding: '12px 0',
              borderBottom: i === sources.length - 1 ? 'none' : '1px solid var(--c-sep)',
            }}>
              <div style={{
                fontSize: 'var(--fs-body)', fontWeight: 700,
                color: 'var(--c-text)', marginBottom: 3,
              }}>
                {s}
              </div>
              <div style={{
                fontSize: 'var(--fs-small)', color: 'var(--c-text3)',
                lineHeight: 1.5,
              }}>
                {SOURCE_DETAIL[s] || 'Source detail not registered.'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { ProvenanceChip }
