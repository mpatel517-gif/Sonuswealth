/**
 * LiquidityLadder — R8 SIGNATURE. Reused across all 8 drills.
 * See route-8-drilldowns.md §1, §2.1 (Pensions), §3.1 (Investments), §5.1 (Cash),
 * §6.1 (Alternatives), §7.1 (Liabilities) — same component everywhere.
 *
 * G15 anatomy contract:
 *   · 5 tiers: Hours / Days / Weeks / Months / Years.
 *   · Persona-dependent population — Pension drill puts items in "Years",
 *     Cash drill in "Hours/Days", Alternatives spread across all 5.
 *   · Mobile <480px: vertical with collapsible tiers (collapsed by default
 *     when the tier has no items).
 *   · Empty state: "Nothing in this domain" placeholder, all 5 tier labels
 *     still visible so the ladder identity is preserved.
 *   · a11y: aria-label summarises populated tier count + total value.
 *   · G14 dark-mode: five-step accent ramp from low-saturation (Hours) to
 *     full accent (Years). Coral never used here — coral is reserved for
 *     liabilities risk signal product-wide.
 *
 * Props:
 *   tiers      [{ label: 'Hours' | 'Days' | 'Weeks' | 'Months' | 'Years',
 *               items: [{ name, value }] }]
 *              Caller may pass fewer than 5; missing tiers render as empty.
 *   ariaLabel  string optional
 *   onTierTap  (tier) => void
 *   theme      'dark' | 'light'
 */

import { useEffect, useState } from 'react';

const CANONICAL_TIERS = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];

const TIER_ACCENT = {
  Hours: 'rgba(93, 219, 194, 0.22)',
  Days: 'rgba(93, 219, 194, 0.36)',
  Weeks: 'rgba(93, 219, 194, 0.55)',
  Months: 'rgba(93, 219, 194, 0.75)',
  Years: 'var(--c-acc)',
};

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

function tierTotal(tier) {
  if (!tier || !Array.isArray(tier.items)) return 0;
  return tier.items.reduce((a, i) => a + (i.value || 0), 0);
}

export default function LiquidityLadder({
  tiers = [],
  ariaLabel,
  onTierTap,
  theme,
}) {
  const narrow = useIsNarrow();
  const [openTiers, setOpenTiers] = useState(() => new Set());

  // Normalise: ensure every canonical tier exists.
  const normalised = CANONICAL_TIERS.map((label) => {
    const found = tiers.find((t) => t && t.label === label);
    return found || { label, items: [] };
  });

  const populatedCount = normalised.filter((t) => (t.items || []).length > 0)
    .length;
  const total = normalised.reduce((a, t) => a + tierTotal(t), 0);

  // ── G13 empty state ──────────────────────────────────────────────────────
  if (total === 0 && populatedCount === 0) {
    return (
      <div
        role="img"
        aria-label={
          ariaLabel ||
          'Liquidity ladder — nothing recorded in this domain yet.'
        }
        data-theme-hint={theme}
        className="sw-tile sw-tile-flat"
        style={{ padding: 16 }}
      >
        <div className="sw-eyebrow" style={{ marginBottom: 10 }}>
          LIQUIDITY LADDER
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            gap: 4,
          }}
        >
          {CANONICAL_TIERS.map((label) => (
            <div
              key={label}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--c-tint-neutral)',
                border: '1px dashed var(--c-border)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: 'var(--c-text3)',
                textAlign: 'center',
                minHeight: 56,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--c-text3)',
            textAlign: 'center',
          }}
        >
          Nothing recorded in this domain.
        </div>
      </div>
    );
  }

  // ── Vertical layout (mobile) ─────────────────────────────────────────────
  if (narrow) {
    return (
      <div
        role="img"
        aria-label={
          ariaLabel ||
          `Liquidity ladder: ${populatedCount} of 5 tiers populated. Total £${Math.round(total).toLocaleString()}.`
        }
        data-theme-hint={theme}
      >
        {normalised.map((tier) => {
          const subtotal = tierTotal(tier);
          const isOpen = openTiers.has(tier.label) || (tier.items || []).length;
          return (
            <div
              key={tier.label}
              style={{
                marginBottom: 6,
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--c-border)',
                background:
                  subtotal > 0
                    ? TIER_ACCENT[tier.label]
                    : 'var(--c-tint-neutral)',
              }}
            >
              <button
                onClick={() => {
                  onTierTap && onTierTap(tier);
                  setOpenTiers((s) => {
                    const next = new Set(s);
                    if (next.has(tier.label)) next.delete(tier.label);
                    else next.add(tier.label);
                    return next;
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: 'var(--c-text)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {tier.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFeatureSettings: '"tnum" 1',
                  }}
                >
                  {subtotal > 0
                    ? `£${Math.round(subtotal).toLocaleString()}`
                    : '—'}
                </span>
              </button>
              {isOpen && (tier.items || []).length > 0 && (
                <div
                  style={{
                    padding: '0 12px 10px',
                    fontSize: 12,
                    color: 'var(--c-text2)',
                  }}
                >
                  {tier.items.map((item, i) => (
                    <div
                      key={`${tier.label}-${item.name}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                      }}
                    >
                      <span>{item.name}</span>
                      <span style={{ fontFeatureSettings: '"tnum" 1' }}>
                        £{Math.round(item.value).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Horizontal ladder (desktop) ──────────────────────────────────────────
  return (
    <div
      role="img"
      aria-label={
        ariaLabel ||
        `Liquidity ladder: ${populatedCount} of 5 tiers populated. Total £${Math.round(total).toLocaleString()}.`
      }
      data-theme-hint={theme}
    >
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
        LIQUIDITY LADDER
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {normalised.map((tier) => {
          const subtotal = tierTotal(tier);
          const populated = subtotal > 0;
          return (
            <button
              key={tier.label}
              onClick={() => onTierTap && onTierTap(tier)}
              aria-label={`${tier.label} tier: ${populated ? `£${Math.round(subtotal).toLocaleString()} across ${tier.items.length} item${tier.items.length === 1 ? '' : 's'}` : 'empty'}`}
              style={{
                flex: 1,
                padding: '12px 10px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--c-border)',
                background: populated
                  ? TIER_ACCENT[tier.label]
                  : 'var(--c-tint-neutral)',
                cursor: onTierTap ? 'pointer' : 'default',
                textAlign: 'left',
                minHeight: 96,
                color: 'var(--c-text)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: populated ? 'var(--c-text)' : 'var(--c-text3)',
                }}
              >
                {tier.label}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    fontFeatureSettings: '"tnum" 1',
                    letterSpacing: -0.3,
                    color: populated ? 'var(--c-text)' : 'var(--c-text3)',
                  }}
                >
                  {populated
                    ? `£${Math.round(subtotal).toLocaleString()}`
                    : '—'}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--c-text3)',
                    marginTop: 2,
                  }}
                >
                  {populated
                    ? `${tier.items.length} item${tier.items.length === 1 ? '' : 's'}`
                    : 'empty'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
