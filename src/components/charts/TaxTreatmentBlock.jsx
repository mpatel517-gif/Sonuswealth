/**
 * TaxTreatmentBlock (shared) — R8 standardised. Used by every drill.
 * See route-8-drilldowns.md §1 ("Tax-treatment block STANDARDISED").
 *
 * Why a second file?
 *   The original `src/components/MyMoney/TaxTreatmentBlock.jsx` takes an
 *   `asset` and resolves the wrapper from it via engine helpers. The route
 *   specs (R8 §1) want a simpler prop API: pass a wrapper name string,
 *   optionally override IT/CGT/IHT lines, and render the standardised three
 *   rows. This file is the route-spec entry point; it delegates to the
 *   engine helper `getTaxTreatmentSummary` for the default copy so the
 *   verbatim per-wrapper text stays sourced from one place.
 *
 * G15 anatomy contract:
 *   · 3 rows verbatim per wrapper: Income tax · Capital gains · Inheritance.
 *   · Empty state: unknown wrapper renders a dashed-border "needs wrapper"
 *     card per existing pattern.
 *   · a11y: aria-label summarises the wrapper code; each row is screen-reader
 *     focusable text (no purely visual encoding).
 *   · G14 dark-mode: inherits tokens. No coral / accent intrinsic colour —
 *     this is a typographic component.
 *
 * Props:
 *   wrapper    'ISA' | 'GIA' | 'SIPP' | 'EIS' | 'SEIS' | 'VCT' | 'Bond'
 *              | 'Cash' | 'Property' | 'Business' | 'Pension' | ...
 *   overrides  { it?: string, cgt?: string, iht?: string } — optional, used
 *              when a drill needs a hand-tuned mechanic line.
 *   bundle     rules-uk TAX bundle (passed in by host; defaults applied if
 *              missing).
 *   compact    boolean — drop the outer card + eyebrow when sitting inside a
 *              section that already has framing.
 */

import { getTaxTreatmentSummary } from '../../engine/tax-treatment.js';

const WRAPPER_LABELS = {
  ISA: 'ISA',
  GIA: 'GIA',
  SIPP: 'SIPP / Pension',
  PENSION: 'SIPP / Pension',
  EIS: 'EIS',
  SEIS: 'SEIS',
  VCT: 'VCT',
  BOND: 'Onshore bond',
  CASH: 'Cash',
  PROPERTY: 'Property',
  BUSINESS: 'Business',
  AIM: 'AIM (BPR-qualifying)',
};

const ROW_META = {
  it: { label: 'Income tax', icon: '£' },
  cgt: { label: 'Capital gains', icon: '↗' },
  iht: { label: 'Inheritance', icon: '↰' },
};

function Row({ rowKey, line }) {
  const meta = ROW_META[rowKey];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 92px 1fr',
        gap: 10,
        alignItems: 'flex-start',
        padding: '8px 0',
        borderBottom: '1px solid var(--c-border)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'var(--c-surface2)',
          color: 'var(--c-text3)',
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        {meta.icon}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--c-text3)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: 700,
          paddingTop: 4,
        }}
      >
        {meta.label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--c-text)',
          lineHeight: 1.5,
        }}
      >
        {line}
      </div>
    </div>
  );
}

export default function TaxTreatmentBlock({
  wrapper,
  overrides = {},
  bundle,
  compact = false,
  ariaLabel,
}) {
  const code = String(wrapper || '').toUpperCase();
  const label = WRAPPER_LABELS[code] || (code ? code : 'Unresolved wrapper');
  const unresolved = !code || !WRAPPER_LABELS[code];

  // Default copy comes from the engine helper. Override prop wins if present.
  const stub = { type: code.toLowerCase() };
  const summary = unresolved
    ? {
        it: 'Wrapper not set — add a wrapper to see income-tax treatment.',
        cgt: 'Wrapper not set — add a wrapper to see capital-gains treatment.',
        iht: 'Wrapper not set — add a wrapper to see inheritance treatment.',
      }
    : getTaxTreatmentSummary(stub, code, bundle);

  const it = overrides.it ?? summary.it;
  const cgt = overrides.cgt ?? summary.cgt;
  const iht = overrides.iht ?? summary.iht;

  const a11y = ariaLabel || `Tax treatment for ${label}.`;

  const content = (
    <div
      role="region"
      aria-label={a11y}
      style={{ padding: compact ? 0 : 12 }}
    >
      {!compact && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--c-text3)',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>Tax treatment · {label}</span>
          {unresolved && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--c-text2)',
                border: '1px dashed var(--c-text3)',
                borderRadius: 999,
                padding: '2px 7px',
                letterSpacing: 0.4,
              }}
            >
              NEEDS WRAPPER
            </span>
          )}
        </div>
      )}
      <Row rowKey="it" line={it} />
      <Row rowKey="cgt" line={cgt} />
      <Row rowKey="iht" line={iht} />
    </div>
  );

  if (compact) return content;
  return (
    <div
      className="sw-card"
      style={{
        background: 'var(--card-bg2, var(--c-surface))',
        border: unresolved
          ? '1px dashed var(--c-text3)'
          : '1px solid var(--c-border)',
        borderRadius: 14,
        marginTop: 8,
      }}
    >
      {content}
    </div>
  );
}
