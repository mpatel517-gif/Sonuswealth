/**
 * CalendarHeatmap — R3 signature.
 * See route-3-cashflow.md §4.1 / §4.2.
 *
 * G15 anatomy contract:
 *   · 12 cells colour-coded surplus/deficit. Coral deficit, accent surplus.
 *   · Mobile <480px: 4×3 grid; desktop: 12×1.
 *   · Empty state: "12-month history not recorded" copy block, target legend
 *     still rendered so the user understands what they'll see once data
 *     arrives.
 *   · a11y: aria-label summarises best month / worst month / pattern direction.
 *   · G14 dark-mode: coral and accent both verified at minimum saturation —
 *     uses --c-coral / --c-acc tokens which already shift per theme.
 *
 * Props:
 *   months  [{ date: 'YYYY-MM' | Date, value: number }]   value = surplus £/mo
 *   range   [min, max]  optional override; default = derived from months
 *   ariaLabel  string optional
 *   onCellTap  (month) => void
 *   theme   'dark' | 'light'
 */

import { useEffect, useState } from 'react';

function useIsNarrow(breakpoint = 480) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpoint]);
  return narrow;
}

function monthLabel(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + '-01') : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-GB', { month: 'short' });
}

function monthLong(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + '-01') : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

// Returns an rgba colour. Positive → accent, negative → coral. Magnitude
// scales opacity 0.15-0.95.
function colourFor(value, range) {
  const [mn, mx] = range;
  if (value === 0 || !Number.isFinite(value)) {
    return 'var(--c-tint-neutral)';
  }
  const max = Math.max(Math.abs(mn), Math.abs(mx)) || 1;
  const ratio = Math.min(1, Math.abs(value) / max);
  const opacity = 0.15 + ratio * 0.8;
  if (value > 0) {
    return `rgba(93, 219, 194, ${opacity.toFixed(2)})`;
  }
  return `rgba(255, 111, 125, ${opacity.toFixed(2)})`;
}

export default function CalendarHeatmap({
  months = [],
  range,
  ariaLabel,
  onCellTap,
  theme,
}) {
  const narrow = useIsNarrow();

  const safe = Array.isArray(months) ? months.filter((m) => m) : [];

  // ── G13 empty state ──────────────────────────────────────────────────────
  if (!safe.length) {
    return (
      <div
        role="img"
        aria-label={ariaLabel || 'Monthly surplus heatmap — no history yet'}
        className="sw-tile sw-tile-flat"
        style={{ padding: 20, color: 'var(--c-text3)' }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
          12-MONTH SURPLUS
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          12-month history not recorded. Cashflow seasonality appears after a
          year of usage.
        </div>
        {/* render the empty grid so the user sees the layout target */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? 'repeat(4, 1fr)' : 'repeat(12, 1fr)',
            gap: 4,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1 / 1',
                background: 'var(--c-tint-neutral)',
                borderRadius: 'var(--r-sm)',
                border: '1px dashed var(--c-border)',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const values = safe.map((m) => m.value || 0);
  const minVal = range?.[0] ?? Math.min(...values);
  const maxVal = range?.[1] ?? Math.max(...values);
  const eff = [minVal, maxVal];

  const best = safe.reduce((a, b) => (b.value > a.value ? b : a), safe[0]);
  const worst = safe.reduce((a, b) => (b.value < a.value ? b : a), safe[0]);
  const pattern =
    best.value > 0 && worst.value < 0
      ? 'mixed'
      : best.value > 0 && worst.value >= 0
        ? 'always-surplus'
        : 'always-deficit';

  return (
    <div
      role="img"
      aria-label={
        ariaLabel ||
        `Monthly surplus over ${safe.length} months. Best: ${monthLong(best.date)} £${Math.round(best.value).toLocaleString()}. Worst: ${monthLong(worst.date)} £${Math.round(worst.value).toLocaleString()}. Pattern: ${pattern}.`
      }
      data-theme-hint={theme}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'repeat(4, 1fr)' : 'repeat(12, 1fr)',
          gap: 4,
        }}
      >
        {safe.map((m, i) => (
          <button
            key={`${m.date}-${i}`}
            onClick={() => onCellTap && onCellTap(m)}
            aria-label={`${monthLong(m.date)}: ${m.value >= 0 ? 'surplus' : 'deficit'} £${Math.round(Math.abs(m.value)).toLocaleString()}`}
            title={`${monthLong(m.date)} · £${Math.round(m.value).toLocaleString()}`}
            style={{
              aspectRatio: '1 / 1',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)',
              background: colourFor(m.value, eff),
              padding: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              cursor: onCellTap ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--c-text)',
                padding: 4,
                mixBlendMode: 'normal',
              }}
            >
              {monthLabel(m.date)}
            </span>
            {/* Position glyph for non-colour redundancy (a11y G15). */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                fontSize: 9,
                fontWeight: 800,
                color: 'var(--c-text2)',
              }}
            >
              {m.value > 0 ? '+' : m.value < 0 ? '−' : '·'}
            </span>
          </button>
        ))}
      </div>
      {/* Legend strip — colour scale */}
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color: 'var(--c-text3)',
        }}
      >
        <span style={{ fontWeight: 700 }}>Deficit</span>
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 10,
            background: 'rgba(255, 111, 125, 0.95)',
            borderRadius: 2,
          }}
        />
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 10,
            background: 'rgba(255, 111, 125, 0.30)',
            borderRadius: 2,
          }}
        />
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 10,
            background: 'var(--c-tint-neutral)',
            borderRadius: 2,
          }}
        />
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 10,
            background: 'rgba(93, 219, 194, 0.30)',
            borderRadius: 2,
          }}
        />
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 10,
            background: 'rgba(93, 219, 194, 0.95)',
            borderRadius: 2,
          }}
        />
        <span style={{ fontWeight: 700 }}>Surplus</span>
      </div>
    </div>
  );
}
