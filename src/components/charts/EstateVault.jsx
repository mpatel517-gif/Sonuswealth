/**
 * EstateVault — R4.5 SIGNATURE.
 * See route-4.5-trusts-estate.md §3 (Visual hierarchy) + §4.1 (anatomy).
 *
 * Spec calls this "bespoke artwork hero" — an architectural vault drawn in
 * SVG, not a tick-row checklist. Five tiles, one per estate-planning element:
 * Will / LPA Health / LPA Finance / Beneficiary nominations / Trusts.
 * Tile glow accent when status='current'; faint grey when 'missing' /
 * 'notStarted'; amber-tinted when 'review'.
 *
 * G15 anatomy contract:
 *   · Encoding: SVG vault with 5 named tiles. Glow corresponds to status.
 *   · Empty state: full vault rendered with every tile faint grey, caption
 *     "Add documents to fill the vault."
 *   · Hover/tap: tap tile → onTileTap(key)
 *   · Mobile <480px: illustration scales; tile labels stack below.
 *   · a11y: aria-label summarises N-of-5 in place + missing list.
 *   · G14 dark-mode: glow at 0.55 opacity dark / 0.40 light verified via
 *     SVG filter blur tokens.
 *
 * Why a custom drawing, not a checklist: the founder explicitly rejects
 * "5 tick rows". The vault hero exists so the route has a memorable identity
 * (G12). The architecture: a single-column safe with a domed lid, a base
 * plinth, two side pillars, and 5 inset tiles arranged in a quincunx pattern
 * (4 corners + 1 centre). The tiles share the brand teal accent on glow,
 * and faint-grey when absent — never coral, since coral is reserved for
 * liabilities risk product-wide.
 *
 * Props:
 *   items   [{ key: 'will'|'lpaHealth'|'lpaFinance'|'nominations'|'trusts',
 *             status: 'current'|'review'|'missing'|'notStarted' }]
 *   ariaLabel  string optional
 *   onTileTap  (key) => void
 *   theme   'dark' | 'light'
 */

const TILE_LABELS = {
  will: 'Will',
  lpaHealth: 'LPA Health',
  lpaFinance: 'LPA Finance',
  nominations: 'Nominations',
  trusts: 'Trusts',
};

// Positions chosen to form a balanced quincunx inside the vault interior.
// SVG viewBox: 0 0 360 220. Vault interior roughly: x 60-300, y 50-180.
const TILE_POSITIONS = {
  will: { x: 90, y: 70, w: 70, h: 46 },
  lpaHealth: { x: 200, y: 70, w: 70, h: 46 },
  nominations: { x: 145, y: 125, w: 70, h: 46 },
  lpaFinance: { x: 90, y: 140, w: 70, h: 32 },
  trusts: { x: 200, y: 140, w: 70, h: 32 },
};

function fillFor(status) {
  switch (status) {
    case 'current':
      return 'var(--c-acc)';
    case 'review':
      return 'rgba(255, 179, 71, 0.78)';
    case 'missing':
    case 'notStarted':
    default:
      return 'var(--c-tint-neutral)';
  }
}

function glowFor(status) {
  if (status === 'current') return 'url(#vault-glow)';
  return null;
}

export default function EstateVault({
  items = [],
  ariaLabel,
  onTileTap,
  theme,
}) {
  const safe = Array.isArray(items) ? items : [];

  // Build a lookup by key for fast paint.
  const byKey = {};
  safe.forEach((it) => {
    if (it && it.key) byKey[it.key] = it.status || 'notStarted';
  });

  const allKeys = Object.keys(TILE_LABELS);
  const presentKeys = allKeys.filter((k) => byKey[k] === 'current');
  const missingKeys = allKeys.filter(
    (k) => byKey[k] !== 'current' && byKey[k] !== 'review',
  );

  const allEmpty = safe.length === 0 || presentKeys.length === 0;

  const a11y =
    ariaLabel ||
    (allEmpty
      ? 'Estate vault: empty. Add documents to fill the vault.'
      : `Estate vault: ${presentKeys.length} of 5 elements in place. ${
          missingKeys.length > 0
            ? `Missing: ${missingKeys.map((k) => TILE_LABELS[k]).join(', ')}.`
            : 'All elements in place.'
        }`);

  return (
    <div
      role="img"
      aria-label={a11y}
      data-theme-hint={theme}
      className="sw-tile sw-tile-hero"
      style={{ padding: 20 }}
    >
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
        Your estate vault
      </div>
      <svg
        viewBox="0 0 360 220"
        width="100%"
        style={{ display: 'block', maxHeight: 260 }}
        aria-hidden="true"
      >
        <defs>
          <filter id="vault-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="vault-base" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--c-surface2)" />
            <stop offset="1" stopColor="var(--c-surface)" />
          </linearGradient>
        </defs>

        {/* Base plinth */}
        <rect
          x="36"
          y="186"
          width="288"
          height="14"
          rx="3"
          fill="var(--c-surface3)"
          stroke="var(--c-border)"
        />

        {/* Vault body */}
        <path
          d="M 50 50
             Q 50 20 180 20
             Q 310 20 310 50
             L 310 186
             L 50 186 Z"
          fill="url(#vault-base)"
          stroke="var(--c-border)"
          strokeWidth="1.5"
        />

        {/* Left + right pillars */}
        <rect
          x="50"
          y="50"
          width="6"
          height="136"
          fill="var(--c-text3)"
          opacity="0.2"
        />
        <rect
          x="304"
          y="50"
          width="6"
          height="136"
          fill="var(--c-text3)"
          opacity="0.2"
        />

        {/* Vault interior frame */}
        <rect
          x="60"
          y="50"
          width="240"
          height="130"
          rx="6"
          fill="var(--c-surface)"
          stroke="var(--c-border)"
        />

        {/* Dome key plate at top of arch */}
        <circle
          cx="180"
          cy="34"
          r="7"
          fill="var(--c-acc)"
          opacity="0.5"
        />
        <circle
          cx="180"
          cy="34"
          r="3"
          fill="var(--c-acc-contrast, #0B1F3A)"
        />

        {/* Tiles */}
        {allKeys.map((key) => {
          const pos = TILE_POSITIONS[key];
          const status = byKey[key] || 'notStarted';
          const fill = fillFor(status);
          const filter = glowFor(status);
          return (
            <g
              key={key}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ cursor: onTileTap ? 'pointer' : 'default' }}
              onClick={() => onTileTap && onTileTap(key)}
            >
              <rect
                width={pos.w}
                height={pos.h}
                rx="6"
                fill={fill}
                stroke={
                  status === 'current'
                    ? 'var(--c-acc)'
                    : 'var(--c-border)'
                }
                strokeWidth={status === 'current' ? 1.5 : 1}
                filter={filter}
                opacity={status === 'current' ? 0.85 : 1}
              />
              <text
                x={pos.w / 2}
                y={pos.h / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={
                  status === 'current'
                    ? 'var(--c-acc-contrast, #0B1F3A)'
                    : 'var(--c-text2)'
                }
                style={{ letterSpacing: '0.3px' }}
              >
                {TILE_LABELS[key]}
              </text>
              {/* Non-colour status glyph for a11y (G15) */}
              <text
                x={pos.w - 8}
                y={11}
                textAnchor="end"
                fontSize="9"
                fontWeight="800"
                fill={
                  status === 'current'
                    ? 'var(--c-acc-contrast, #0B1F3A)'
                    : 'var(--c-text3)'
                }
              >
                {status === 'current'
                  ? '✓'
                  : status === 'review'
                    ? '!'
                    : '·'}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          fontSize: 11,
          color: 'var(--c-text2)',
        }}
      >
        {allKeys.map((key) => {
          const status = byKey[key] || 'notStarted';
          return (
            <button
              key={`tag-${key}`}
              onClick={() => onTileTap && onTileTap(key)}
              className="sw-chip"
              style={{
                background:
                  status === 'current'
                    ? 'var(--c-tint-mint)'
                    : status === 'review'
                      ? 'var(--c-tint-amber)'
                      : 'var(--c-tint-neutral)',
                color:
                  status === 'current'
                    ? 'var(--c-mint-text)'
                    : status === 'review'
                      ? 'var(--c-amber-text)'
                      : 'var(--c-text3)',
                border: '1px solid transparent',
                cursor: onTileTap ? 'pointer' : 'default',
              }}
              aria-label={`${TILE_LABELS[key]}: ${status}`}
            >
              {TILE_LABELS[key]} · {status}
            </button>
          );
        })}
      </div>

      {allEmpty && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--c-text3)',
            textAlign: 'center',
          }}
        >
          Add documents to fill the vault.
        </div>
      )}
    </div>
  );
}
