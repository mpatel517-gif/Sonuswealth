/**
 * IHTDeltaCard — R4 SIGNATURE.
 * See route-4-tax-estate.md §4.1.
 *
 * G15 anatomy contract:
 *   · Two-column big-number comparison: Today (2026/27) | From 6 April 2027.
 *     Centre delta + countdown.
 *   · Below: post-2027 composition rendered as HORIZONTAL STACKED BAR
 *     (NRB / RNRB / Taxable). Donut is NOT used — product-wide cap of 2
 *     already reached by R2 classification + R3 expense donuts.
 *   · Mobile: stacks vertically — Today / centre delta / From April 2027.
 *   · a11y: aria-label summarises both columns + delta + days remaining.
 *   · G14 dark-mode: Today column neutral; April 2027 column subtle coral
 *     wash; delta accent. Coral tint at <=22% opacity in dark, <=15% light.
 *
 * Animation constraint (Compliance v2 B6 — route-4 §4.1):
 *   The countdown digit changes ONCE PER DAY at 00:00 UTC. No pulse, no
 *   flash, no colour shift, no continuous animation. Implementation: compute
 *   `daysToApril2027()` on mount, then setTimeout aligned to the next UTC
 *   midnight to re-compute. setTimeout chains itself so the value updates
 *   exactly once per day.
 *
 * Props:
 *   entity   the persona entity object — component calls
 *            `ihtDeltaPrePost2027(entity)` from canonical-metrics itself.
 *   ariaLabel  optional override
 *   onColumnTap  ('today' | 'post-2027') => void — for reveal/Ask Sumi
 *   theme  'dark' | 'light'
 *   forceKey   bump to force recompute (e.g. on SCENARIO_SAVED back_flow:'iht').
 *
 * Engine contract — ihtDeltaPrePost2027 returns either shape:
 *   shape A (canonical-metrics current):
 *     { today: number, post2027: number, delta: number,
 *       daysUntilApril2027: number,
 *       todayDetail: { ihtDue, nrb, rnrb, taxable, gross, ... },
 *       post2027Detail: { ihtDue, nrb, rnrb, taxable, gross, ... } }
 *   shape B (older docs / alt providers):
 *     { today: { iht, nrb, rnrb, taxable, estate }, post2027: {...}, delta }
 * Component normalises both before render.
 * If the helper returns null / falsy the empty-state branch renders.
 */

import { useEffect, useState } from 'react';
import { ihtDeltaPrePost2027 } from '../../engine/canonical-metrics.js';
// P2 reconciliation (2026-06-07): single canonical countdown source shared with
// TaxEstate (banner + sub-anchor tile) so two visuals of one quantity always
// agree. Was a local floor() here (302) vs a ceil() in TaxEstate (303).
import { sippIhtCountdownDays } from '../../engine/fq-calculator.js';

function daysToApril2027(nowMs = Date.now()) {
  return sippIhtCountdownDays(nowMs);
}

function msUntilNextUTCMidnight(nowMs = Date.now()) {
  const now = new Date(nowMs);
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return Math.max(1000, next.getTime() - nowMs);
}

function useDaysRemaining() {
  const [days, setDays] = useState(() => daysToApril2027());
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;
    let timeoutId = null;
    const tick = () => {
      if (cancelled) return;
      setDays(daysToApril2027());
      // Schedule the next update at the next UTC midnight — no pulsing,
      // no per-second timers. Compliance v2 B6.
      timeoutId = window.setTimeout(tick, msUntilNextUTCMidnight());
    };
    // First scheduled tick at next midnight; initial render already used the
    // synchronous daysToApril2027() value above.
    timeoutId = window.setTimeout(tick, msUntilNextUTCMidnight());
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);
  return days;
}

function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  return `£${Math.round(n).toLocaleString()}`;
}

function CompositionBar({ today, post2027 }) {
  // Use the post-2027 composition since that's the column with the new rule.
  const nrb = post2027?.nrb ?? 325000;
  const rnrb = post2027?.rnrb ?? 0;
  const taxable = post2027?.taxable ?? 0;
  const total = nrb + rnrb + taxable || 1;
  const seg = (v) => Math.max(0, (v / total) * 100);

  if (total <= 0 || (post2027?.estate > 0 && nrb + rnrb >= post2027.estate && taxable === 0)) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 'var(--r-md)',
          background: 'var(--c-tint-neutral)',
          fontSize: 12,
          color: 'var(--c-text2)',
        }}
      >
        Estate within £325k NRB — no IHT due under either rule set.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        className="sw-eyebrow"
        style={{ marginBottom: 6 }}
      >
        Post-2027 composition
      </div>
      <div
        role="img"
        aria-label={`Estate composition post-2027: NRB ${fmt(nrb)}, RNRB ${fmt(rnrb)}, Taxable ${fmt(taxable)}.`}
        style={{
          display: 'flex',
          width: '100%',
          height: 24,
          borderRadius: 'var(--r-pill)',
          overflow: 'hidden',
          border: '1px solid var(--c-border)',
        }}
      >
        <div
          style={{
            flex: seg(nrb),
            background: 'var(--c-acc)',
            opacity: 0.85,
          }}
          title={`NRB ${fmt(nrb)}`}
        />
        <div
          style={{
            flex: seg(rnrb),
            background: 'var(--c-acc2)',
            opacity: 0.85,
          }}
          title={`RNRB ${fmt(rnrb)}`}
        />
        <div
          style={{
            flex: seg(taxable),
            background: 'var(--c-coral)',
            opacity: 0.92,
          }}
          title={`Taxable ${fmt(taxable)}`}
        />
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 6,
          fontSize: 10,
          color: 'var(--c-text3)',
          gap: 12,
        }}
      >
        <span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: 'var(--c-acc)',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Nil-rate band (NRB) {fmt(nrb)}
        </span>
        <span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: 'var(--c-acc2)',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Residence band (RNRB) {fmt(rnrb)}
        </span>
        <span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: 'var(--c-coral)',
              borderRadius: 2,
              marginRight: 4,
            }}
          />
          Taxable {fmt(taxable)}
        </span>
      </div>
    </div>
  );
}

// Normalise shape A (numbers + detail) → shape B ({iht, nrb, rnrb, taxable, estate}).
function normaliseSide(side, detail) {
  if (side && typeof side === 'object' && !Array.isArray(side)) {
    return {
      iht: +side.iht || +side.ihtDue || 0,
      nrb: +side.nrb || 0,
      rnrb: +side.rnrb || 0,
      taxable: +side.taxable || 0,
      estate: +side.estate || +side.gross || 0,
    };
  }
  // side is a number (engine current) — pull structure from detail.
  if (detail && typeof detail === 'object') {
    return {
      iht: +side || +detail.ihtDue || 0,
      nrb: +detail.nrb || 0,
      rnrb: +detail.rnrb || 0,
      taxable: +detail.taxable || 0,
      estate: +detail.estate || +detail.gross || 0,
    };
  }
  return { iht: +side || 0, nrb: 0, rnrb: 0, taxable: 0, estate: 0 };
}

export default function IHTDeltaCard({
  entity,
  ariaLabel,
  onColumnTap,
  theme,
  forceKey,
}) {
  const days = useDaysRemaining();

  // Engine call — defensive: helper may return null for some entities.
  // forceKey is read so the closure changes when scenario back-flow bumps it.
  let result = null;
  try {
    // eslint-disable-next-line no-unused-vars
    const _refresh = forceKey;
    result = entity ? ihtDeltaPrePost2027(entity) : null;
  } catch {
    result = null;
  }

  // Normalise to {iht, nrb, rnrb, taxable, estate} per side so downstream
  // composition bar + numeric reads work regardless of engine shape.
  const todayN = result ? normaliseSide(result.today, result.todayDetail) : null;
  const post2027N = result ? normaliseSide(result.post2027, result.post2027Detail) : null;

  // ── G13 empty state ──────────────────────────────────────────────────────
  if (!result || (!todayN?.iht && !post2027N?.iht && !todayN?.estate && !post2027N?.estate)) {
    return (
      <div
        role="region"
        aria-label={ariaLabel || 'IHT pre/post-April-2027 delta — no estate data yet'}
        className="sw-tile"
        style={{ padding: 20 }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
          IHT · TODAY vs APRIL 2027
        </div>
        <div style={{ fontSize: 14, color: 'var(--c-text2)' }}>
          Add an estate to see the pre/post-April-2027 delta.
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: 'var(--c-text3)',
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {days} days until rule change.
        </div>
      </div>
    );
  }

  const today = todayN || {};
  const post2027 = post2027N || {};
  const delta = Number.isFinite(result.delta)
    ? result.delta
    : (post2027.iht || 0) - (today.iht || 0);

  const a11y =
    ariaLabel ||
    `IHT today ${fmt(today.iht)}. From April 2027 ${fmt(post2027.iht)}. Delta ${delta >= 0 ? '+' : ''}${fmt(delta)}. ${days} days until rule change.`;

  return (
    <div
      role="region"
      aria-label={a11y}
      data-theme-hint={theme}
      className="sw-tile sw-tile-hero"
      style={{ padding: 20 }}
    >
      <div className="sw-eyebrow" style={{ marginBottom: 12 }}>
        IHT · TODAY vs FROM 6 APRIL 2027
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 16,
          alignItems: 'center',
        }}
        className="iht-delta-grid"
      >
        {/* Today column */}
        <button
          onClick={() => onColumnTap && onColumnTap('today')}
          aria-label={`Today's IHT under 2026/27 rules: ${fmt(today.iht)}. Pensions outside estate.`}
          style={{
            background: 'var(--c-tint-neutral)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            padding: 14,
            textAlign: 'left',
            cursor: onColumnTap ? 'pointer' : 'default',
            color: 'var(--c-text)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-text3)',
            }}
          >
            Today (2026/27 rules)
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.6,
              marginTop: 4,
              fontFeatureSettings: '"tnum" 1',
              color: 'var(--c-text)',
            }}
          >
            {fmt(today.iht)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--c-text3)',
              marginTop: 4,
            }}
          >
            Pensions outside estate.
          </div>
        </button>

        {/* Centre delta + countdown */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-text3)',
            }}
          >
            Delta
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              fontFeatureSettings: '"tnum" 1',
              color: delta > 0 ? 'var(--c-acc)' : 'var(--c-text)',
              letterSpacing: -0.4,
              marginTop: 4,
            }}
          >
            {delta >= 0 ? '+' : ''}
            {fmt(delta)}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: 'var(--c-text2)',
              fontFeatureSettings: '"tnum" 1',
              textAlign: 'center',
            }}
            // Per Compliance v2 B6: no animation, no pulse, no colour shift.
            // The number is a date arithmetic result; it updates once per
            // UTC day via the scheduled timeout above.
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--c-text)',
                letterSpacing: -0.4,
                lineHeight: 1,
              }}
            >
              {days}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: 'var(--c-text3)',
                marginTop: 2,
              }}
            >
              days until rule change
            </div>
          </div>
        </div>

        {/* From April 2027 column */}
        <button
          onClick={() => onColumnTap && onColumnTap('post-2027')}
          aria-label={`From 6 April 2027 IHT: ${fmt(post2027.iht)}. Pensions inside estate.`}
          style={{
            background: 'rgba(255, 111, 125, 0.10)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            padding: 14,
            textAlign: 'left',
            cursor: onColumnTap ? 'pointer' : 'default',
            color: 'var(--c-text)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-text3)',
            }}
          >
            From 6 April 2027
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.6,
              marginTop: 4,
              fontFeatureSettings: '"tnum" 1',
              color: 'var(--c-text)',
            }}
          >
            {fmt(post2027.iht)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--c-text3)',
              marginTop: 4,
            }}
          >
            Pensions inside estate.
          </div>
        </button>
      </div>

      <CompositionBar today={today} post2027={post2027} />

      {/* Mobile reflow: stacked layout via inline media query. Use a style
         element so the grid template responds without external CSS. */}
      <style>{`
        @media (max-width: 480px) {
          .iht-delta-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
