// ─────────────────────────────────────────────────────────────────────────────
// TimeWindowSelector — X28 time-window picker
// Seven windows. Top-bar control on Home / Cashflow / Tax & Estate.
// Risk overlay does NOT use this — Risk is always point-in-time.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

const WINDOWS = [
  { id: 'current-tax-year', label: 'Tax Year',  full: 'Current Tax Year (2026/27)' },
  { id: 'last-tax-year',    label: 'Last TY',   full: 'Last Tax Year (2025/26)'    },
  { id: 'ytd',              label: 'YTD',       full: 'Year to Date'               },
  { id: 'last-12-months',   label: '12mo',      full: 'Last 12 Months'             },
  { id: 'last-3-months',    label: '3mo',       full: 'Last 3 Months'              },
  { id: 'this-month',       label: 'Month',     full: 'This Month'                 },
  { id: 'lifetime',         label: 'Lifetime',  full: 'Lifetime'                   },
]

export default function TimeWindowSelector({ value = 'current-tax-year', onChange }) {
  const [open, setOpen] = useState(false)
  const current = WINDOWS.find(w => w.id === value) || WINDOWS[0]

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 100,
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text2)',
          fontSize: 'var(--fs-small)', fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12 }}>◷</span>
        {current.label}
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div
            role="listbox"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              minWidth: 220, zIndex: 100,
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 14,
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {WINDOWS.map((w, i) => {
              const active = w.id === value
              return (
                <button
                  key={w.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange?.(w); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '10px 14px',
                    background: active ? 'var(--c-acc-bg)' : 'transparent',
                    border: 'none',
                    borderBottom: i === WINDOWS.length - 1 ? 'none' : '1px solid var(--c-sep)',
                    color: active ? 'var(--c-acc)' : 'var(--c-text)',
                    fontSize: 'var(--fs-body)', fontWeight: active ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span>{w.full}</span>
                  {active && <span style={{ fontSize: 14 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export { WINDOWS as TIME_WINDOWS }
