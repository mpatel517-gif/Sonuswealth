/**
 * SharedBullet — consolidated bullet chart used by R3 runway, R6 DLA, R8 Cash.
 * See route-3-cashflow.md §4.3 (runway), route-8-drilldowns.md §5 (cash).
 *
 * G15 anatomy contract:
 *   · Horizontal bar with target marker; threshold zones coloured behind;
 *     fill = current.
 *   · Empty state: target marker still visible with "no data" label.
 *   · a11y: aria-label summarises current vs target.
 *   · G14 dark-mode: uses --c-acc / --c-coral / amber; threshold zones use
 *     opacity-tinted variants so they read at WCAG AA on both themes.
 *
 * Props:
 *   current     number (months / months-equivalent / £ — caller decides)
 *   target      number — the goal marker (e.g. 6 months runway)
 *   thresholds  [{ value, colour }] — zones up to that value. Default:
 *               coral <3, amber 3-6, accent >=6 (months semantics). Caller
 *               may override for £-denominated bullets.
 *   label       string — eyebrow / heading
 *   expansion   ReactNode — optional inline computation reveal (tap toggles)
 *   ariaLabel   string optional
 *   suffix      string — units appended to numbers in default a11y label
 *               (default 'months').
 */

import { useState } from 'react';

const DEFAULT_THRESHOLDS = [
  { value: 3, colour: 'rgba(255, 111, 125, 0.22)' },
  { value: 6, colour: 'rgba(255, 179, 71, 0.22)' },
  { value: Infinity, colour: 'rgba(93, 219, 194, 0.22)' },
];

export default function SharedBullet({
  current,
  target,
  thresholds = DEFAULT_THRESHOLDS,
  label = 'Runway',
  expansion,
  ariaLabel,
  suffix = 'months',
}) {
  const [open, setOpen] = useState(false);

  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  // visible scale: 1.4× target so the target marker sits at ~71%
  const scaleMax = Math.max(safeTarget * 1.4, safeCurrent * 1.1, 1);

  const empty = !Number.isFinite(current) || current === 0;
  const fillPct = Math.max(0, Math.min(100, (safeCurrent / scaleMax) * 100));
  const targetPct = Math.max(0, Math.min(100, (safeTarget / scaleMax) * 100));

  // Determine the active threshold band for the bar fill colour.
  const activeBand =
    thresholds.find((t) => safeCurrent < t.value) ||
    thresholds[thresholds.length - 1];

  const a11y =
    ariaLabel ||
    (empty
      ? `${label}: no data yet. Target: ${safeTarget} ${suffix}.`
      : `${label}: ${safeCurrent.toFixed(1)} ${suffix} of ${suffix} covered. Target: ${safeTarget} ${suffix}.`);

  return (
    <div
      role="img"
      aria-label={a11y}
      className="sw-tile"
      style={{ padding: 16 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <span className="sw-eyebrow">{label}</span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: empty ? 'var(--c-text3)' : 'var(--c-text)',
            fontFeatureSettings: '"tnum" 1',
            letterSpacing: -0.5,
          }}
        >
          {empty
            ? '— '
            : Number(safeCurrent).toFixed(safeCurrent >= 10 ? 0 : 1)}
          <span
            style={{
              fontSize: 11,
              color: 'var(--c-text3)',
              marginLeft: 4,
              fontWeight: 600,
              letterSpacing: 0,
            }}
          >
            {suffix}
          </span>
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          height: 22,
          borderRadius: 'var(--r-pill)',
          overflow: 'hidden',
          background: 'var(--c-surface3)',
          border: '1px solid var(--c-border)',
        }}
      >
        {/* threshold zones behind the fill */}
        {thresholds.map((t, i) => {
          const prev = i === 0 ? 0 : thresholds[i - 1].value;
          const startPct = Math.max(0, Math.min(100, (prev / scaleMax) * 100));
          const endPct = Math.max(
            0,
            Math.min(100, (t.value / scaleMax) * 100),
          );
          if (endPct <= startPct) return null;
          return (
            <div
              key={`zone-${i}`}
              style={{
                position: 'absolute',
                left: `${startPct}%`,
                width: `${endPct - startPct}%`,
                top: 0,
                bottom: 0,
                background: t.colour,
              }}
            />
          );
        })}
        {/* fill */}
        {!empty && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fillPct}%`,
              background:
                activeBand?.value === Infinity
                  ? 'var(--c-acc)'
                  : activeBand?.value === 3
                    ? 'var(--c-coral)'
                    : 'rgba(255, 179, 71, 0.92)',
              borderRadius: 'var(--r-pill)',
              transition: 'width var(--dur-normal, 350ms)',
            }}
          />
        )}
        {/* target marker — also a non-colour cue via the vertical line */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${targetPct}%`,
            top: -2,
            bottom: -2,
            width: 2,
            background: 'var(--c-text)',
            opacity: 0.8,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: `${targetPct}%`,
            top: -10,
            transform: 'translateX(-50%)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--c-text3)',
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
          }}
        >
          TARGET
        </div>
      </div>

      {empty && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--c-text3)',
          }}
        >
          No data — target marker shown for reference.
        </div>
      )}

      {expansion && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              marginTop: 10,
              fontSize: 11,
              color: 'var(--c-acc)',
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            aria-expanded={open}
          >
            {open ? 'Hide computation' : 'Show computation'}
          </button>
          {open && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--c-tint-neutral)',
                borderRadius: 'var(--r-md)',
                fontSize: 12,
                color: 'var(--c-text2)',
                lineHeight: 1.5,
              }}
            >
              {expansion}
            </div>
          )}
        </>
      )}
    </div>
  );
}
