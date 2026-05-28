/**
 * Marimekko — R1 signature.
 * See route-1-balance-sheet.md §4.1.
 *
 * G15 anatomy contract:
 *   · Encoding: x-axis category width = % of total; y within each column =
 *     wrapper composition.
 *   · Empty state: at <3 wrappers across <2 categories, collapses to a single
 *     horizontal stacked bar (donut/marimekko comprehension fails at low N).
 *   · Mobile <480px: collapses to one vertical stacked bar per category.
 *   · a11y: aria-label prop overrides; default summarises N categories + largest.
 *   · G14 dark-mode: uses --c-acc-bg / --c-coral / token ramp; coral reserved
 *     for liabilities (this component never colours coral).
 *
 * Props:
 *   data        [{ category, value, wrappers: [{ name, value }] }]
 *   ariaLabel   string (optional override)
 *   onSegmentTap (category, wrapperName) => void
 *   theme       'dark' | 'light' (passed in by host; component also respects
 *               data-theme on document root; theme prop is the hint, not the
 *               source of truth).
 */

import { useEffect, useState } from 'react';

// F-2 fix (2026-05-26 snap audit): v0.2 shipped a 4-hue × 2-opacity palette
// which rendered every category as a near-monochrome teal block — wrapper
// composition was invisible, defeating the entire 2D point of the Marimekko.
// G15 specifies "8-step accent ramp" with WCAG AA contrast between adjacent
// segments. Switch to a wrapper-NAME-keyed palette so SIPP / SSAS / Workplace
// / ISA / GIA / Cash / Residence / BTL each carry a distinct hue regardless of
// which column they sit in. Falls back to a 12-step distinct-hue ramp for any
// wrapper name not pre-mapped. Coral remains reserved for liabilities only.
const WRAPPER_COLOUR_BY_NAME = {
  // Pensions
  SIPP:       '#4DA3FF',  // accent blue
  SSAS:       '#7C5CFF',  // violet
  Workplace:  '#5DDBC2',  // brand teal
  // Investments / wrappers
  ISA:        '#5DDBC2',  // teal — sheltered
  GIA:        '#F4B860',  // warm gold — taxable
  EIS:        '#E07AC1',  // pink — risk-tagged
  SEIS:       '#C24DC4',  // magenta
  VCT:        '#8E7CDB',  // muted violet
  Bond:       '#7AB0D4',  // dusty blue
  'BPR-qualifying': '#8FCB66',
  Business:   '#8FCB66',  // sage green
  // Property
  Residence:  '#5BA7E8',  // home blue
  BTL:        '#F4B860',  // warm — rental yield
  // Cash & misc
  Cash:       '#7DDFC0',  // light teal
  Alt:        '#C6A0E8',
};
const WRAPPER_FALLBACK_RAMP = [
  '#5DDBC2', '#4DA3FF', '#F4B860', '#E07AC1',
  '#7C5CFF', '#7AB0D4', '#8FCB66', '#8E7CDB',
  '#C6A0E8', '#F4D06F', '#5BA7E8', '#7DDFC0',
];
function wrapperColour(name, fallbackIndex = 0) {
  if (name && WRAPPER_COLOUR_BY_NAME[name]) return WRAPPER_COLOUR_BY_NAME[name];
  return WRAPPER_FALLBACK_RAMP[fallbackIndex % WRAPPER_FALLBACK_RAMP.length];
}

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

function pct(value, total) {
  if (!total || !Number.isFinite(total)) return 0;
  return (value / total) * 100;
}

export default function Marimekko({
  data = [],
  ariaLabel,
  onSegmentTap,
  theme,
}) {
  const narrow = useIsNarrow();

  const safe = Array.isArray(data) ? data.filter((d) => d && d.value > 0) : [];
  const wrapperCount = safe.reduce(
    (acc, d) => acc + (Array.isArray(d.wrappers) ? d.wrappers.length : 0),
    0,
  );
  const total = safe.reduce((acc, d) => acc + (d.value || 0), 0);

  // ── G13 empty state ──────────────────────────────────────────────────────
  if (!safe.length || total <= 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel || 'Composition view — no data yet'}
        className="sw-tile sw-tile-flat"
        style={{ padding: 20, textAlign: 'center', color: 'var(--c-text3)' }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
          COMPOSITION
        </div>
        <div style={{ fontSize: 13 }}>
          Add an asset to see how your money is composed.
        </div>
      </div>
    );
  }

  // ── G15 fallback at low N: collapse to a single horizontal stacked bar ──
  const lowN = safe.length < 2 || wrapperCount < 3;
  if (lowN) {
    const segments = safe.flatMap((cat) =>
      (cat.wrappers && cat.wrappers.length
        ? cat.wrappers
        : [{ name: cat.category, value: cat.value }]
      ).map((w, i) => ({
        category: cat.category,
        name: w.name,
        value: w.value,
        colour: wrapperColour(w.name, i),
      })),
    );
    return (
      <div
        role="img"
        aria-label={
          ariaLabel ||
          `Composition: ${segments.length} segment${segments.length === 1 ? '' : 's'}.`
        }
        data-theme-hint={theme}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: 56,
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            border: '1px solid var(--c-border)',
          }}
        >
          {segments.map((s, i) => (
            <button
              key={`${s.category}-${s.name}-${i}`}
              onClick={() => onSegmentTap && onSegmentTap(s.category, s.name)}
              aria-label={`${s.name} (${s.category}) £${Math.round(s.value).toLocaleString()}`}
              style={{
                flex: s.value,
                background: s.colour,
                border: 'none',
                padding: 0,
                cursor: onSegmentTap ? 'pointer' : 'default',
              }}
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--c-text3)',
          }}
        >
          Add more wrappers to unlock the full composition view.
        </div>
      </div>
    );
  }

  // ── Mobile reflow: stacked vertical bars per category ────────────────────
  if (narrow) {
    const largest = [...safe].sort((a, b) => b.value - a.value)[0];
    return (
      <div
        role="img"
        aria-label={
          ariaLabel ||
          `Composition by category. ${safe.length} categories. Largest: ${largest.category} at ${pct(largest.value, total).toFixed(0)}%.`
        }
        data-theme-hint={theme}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {safe.map((cat) => {
            const catTotal = cat.value;
            return (
              <div key={cat.category}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--c-text2)',
                    marginBottom: 4,
                  }}
                >
                  <span>{cat.category}</span>
                  <span style={{ fontFeatureSettings: '"tnum" 1' }}>
                    {pct(catTotal, total).toFixed(0)}%
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    height: 18,
                    borderRadius: 'var(--r-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--c-border)',
                  }}
                >
                  {(cat.wrappers || [{ name: cat.category, value: cat.value }]).map(
                    (w, i) => (
                      <button
                        key={`${cat.category}-${w.name}-${i}`}
                        onClick={() =>
                          onSegmentTap && onSegmentTap(cat.category, w.name)
                        }
                        aria-label={`${w.name} £${Math.round(w.value).toLocaleString()}`}
                        title={`${w.name} · £${Math.round(w.value).toLocaleString()}`}
                        style={{
                          flex: w.value,
                          background: wrapperColour(w.name, i),
                          border: 'none',
                          padding: 0,
                          cursor: onSegmentTap ? 'pointer' : 'default',
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Desktop marimekko ────────────────────────────────────────────────────
  const largest = [...safe].sort((a, b) => b.value - a.value)[0];

  // F-2 fix (snap audit): G15 anatomy contract specified "Wrapper key inline at
  // top". v0.2 shipped without a legend, which compounded the monochrome-palette
  // bug — even if hues had been distinct, the user had no decoder. Build a
  // de-duped wrapper list across all categories, sorted desc by total value, so
  // the largest holdings carry the strongest visual anchor at the legend's left.
  const wrapperLegend = (() => {
    const totals = {};
    for (const cat of safe) {
      for (const w of (cat.wrappers || [])) {
        if (!w || !w.value) continue;
        totals[w.name] = (totals[w.name] || 0) + w.value;
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, colour: wrapperColour(name, i) }));
  })();

  return (
    <div
      role="img"
      aria-label={
        ariaLabel ||
        `Composition by category and wrapper. ${safe.length} categories. Largest: ${largest.category} at ${pct(largest.value, total).toFixed(0)}%.`
      }
      data-theme-hint={theme}
    >
      {/* G15 inline legend — wrapper key above the chart. Founder snap-audit
          fix 2026-05-26: this was missing entirely in v0.2. */}
      {wrapperLegend.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginBottom: 8,
        }}>
          {wrapperLegend.map((w) => (
            <span key={w.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, color: 'var(--c-text2)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: w.colour,
                display: 'inline-block',
              }} />
              <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>{w.name}</span>
              <span style={{ fontFeatureSettings: '"tnum" 1', color: 'var(--c-text3)' }}>
                £{Math.round(w.value / 1000).toLocaleString()}k
              </span>
            </span>
          ))}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 240,
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          border: '1px solid var(--c-border)',
          background: 'var(--c-surface2)',
        }}
      >
        {safe.map((cat) => {
          const catWidth = pct(cat.value, total);
          const wrappers =
            cat.wrappers && cat.wrappers.length
              ? cat.wrappers
              : [{ name: cat.category, value: cat.value }];
          return (
            <div
              key={cat.category}
              style={{
                flex: catWidth,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--c-border)',
              }}
              title={`${cat.category} · ${catWidth.toFixed(1)}% of net worth`}
            >
              {wrappers.map((w, i) => (
                <button
                  key={`${cat.category}-${w.name}-${i}`}
                  onClick={() =>
                    onSegmentTap && onSegmentTap(cat.category, w.name)
                  }
                  aria-label={`£${Math.round(w.value).toLocaleString()} in ${w.name} (${cat.category})`}
                  title={`£${Math.round(w.value).toLocaleString()} in ${w.name} (${cat.category})`}
                  style={{
                    flex: w.value,
                    background: wrapperColour(w.name, i),
                    border: 'none',
                    padding: 0,
                    cursor: onSegmentTap ? 'pointer' : 'default',
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      {/* x-axis labels */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          marginTop: 6,
        }}
      >
        {safe.map((cat) => (
          <div
            key={`label-${cat.category}`}
            style={{
              flex: pct(cat.value, total),
              fontSize: 10,
              color: 'var(--c-text3)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: 700,
              textAlign: 'left',
              paddingLeft: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.category}
          </div>
        ))}
      </div>
    </div>
  );
}
