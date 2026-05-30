// ─────────────────────────────────────────────────────────────────────────────
// AssumptionsEditor — let the user play with the capital-market assumptions.
//
// Reads/writes the active-CMA layer (src/engine/cma.js) via useActiveCMA(). Every
// dial starts at the published baseline; a per-field "reset" and a global
// "reset everything" return to it. Edits flow into every projection in the app
// (drawdown success %, funded ratio, retirement pots) because all of them read
// getActiveCMA() now.
//
// Plain English throughout (CLAUDE.md §0.3 — no internal codes at the surface).
// The derived "blended growth" readout shows the user the EFFECT of their edits
// on the single number the engine uses, so the relationship is never hidden.
// ─────────────────────────────────────────────────────────────────────────────

import { useActiveCMA } from '../../state/useActiveCMA.js'

// Plain-English labels + one-line explainers for each asset class.
const CLASSES = [
  { key: 'uk_equity',     name: 'UK shares',                  hint: 'Companies listed in the UK' },
  { key: 'global_equity', name: 'Global shares',              hint: 'Companies listed worldwide' },
  { key: 'em_equity',     name: 'Emerging-market shares',     hint: 'Higher growth, higher swings' },
  { key: 'uk_gilts',      name: 'UK government bonds',         hint: 'Gilts — lower risk, lower return' },
  { key: 'corp_bonds',    name: 'Corporate bonds',            hint: 'Company debt' },
  { key: 'property',      name: 'Property',                   hint: 'Commercial & residential funds' },
  { key: 'cash',          name: 'Cash & savings',             hint: 'Deposits, money-market' },
  { key: 'alternatives',  name: 'Alternatives',               hint: 'Gold, infrastructure, etc.' },
]

const pct = (r) => `${(r * 100).toFixed(1)}%`

function Dial({ label, hint, value, base, min, max, onChange, onReset }) {
  const changed = Math.abs(value - base) > 1e-9
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-sep)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-body, 15px)', color: 'var(--c-text)', fontWeight: 600 }}>{label}</div>
          {hint && <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text3)' }}>{hint}</div>}
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 'var(--fs-body, 15px)', fontWeight: 700,
            color: changed ? 'var(--c-acc, #5ddbc2)' : 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
            {pct(value)}
          </span>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            {changed ? `baseline ${pct(base)}` : 'at baseline'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <input
          type="range" min={min} max={max} step={0.001} value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--c-acc, #5ddbc2)' }}
          aria-label={label}
        />
        <button
          type="button" onClick={onReset} disabled={!changed}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: changed ? 'pointer' : 'default',
            border: '1px solid var(--c-sep)', background: 'transparent',
            color: changed ? 'var(--c-text2)' : 'var(--c-text3)', opacity: changed ? 1 : 0.4 }}
        >
          reset
        </button>
      </div>
    </div>
  )
}

export function AssumptionsEditor() {
  const { cma, baseline, modified, patch, reset, resetField } = useActiveCMA()

  return (
    <div>
      {/* Intro */}
      <div style={{ padding: '12px 16px', fontSize: 'var(--fs-small, 13px)', color: 'var(--c-text2)', lineHeight: 1.5 }}>
        These are the market and inflation assumptions behind every projection —
        how much your savings might grow, and how fast prices rise. They start at
        a sensible baseline drawn from {baseline._meta?.sources?.length || 'several'} major
        forecasters. Move any dial to model a more optimistic or cautious future;
        everything recalculates. Nothing here is a prediction.
      </div>

      {/* Live effect: blended growth + inflation headline */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px' }}>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--c-surface)', border: '1px solid var(--c-sep)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--c-text3)' }}>Blended growth</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-acc, #5ddbc2)', fontVariantNumeric: 'tabular-nums' }}>{pct(cma.growth)}</div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>a year, after the table below</div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--c-surface)', border: '1px solid var(--c-sep)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--c-text3)' }}>Inflation</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{pct(cma.inflation)}</div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>a year, prices rising</div>
        </div>
      </div>

      {/* Inflation dial */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', padding: '8px 16px 4px' }}>
        Prices
      </div>
      <Dial
        label="Inflation" hint="How fast the cost of living rises"
        value={cma.inflation} base={baseline.inflation} min={0} max={0.10}
        onChange={(v) => patch({ inflation: v })}
        onReset={() => patch({ inflation: baseline.inflation })}
      />

      {/* Per-asset-class expected returns */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', padding: '14px 16px 4px' }}>
        Expected return by asset type
      </div>
      {CLASSES.map((c) => (
        <Dial
          key={c.key} label={c.name} hint={c.hint}
          value={cma.assetClasses[c.key]?.expectedReturn ?? 0}
          base={baseline.assetClasses[c.key]?.expectedReturn ?? 0}
          min={0} max={0.15}
          onChange={(v) => patch({ assetClasses: { [c.key]: { expectedReturn: v } } })}
          onReset={() => resetField(c.key, 'expectedReturn')}
        />
      ))}

      {/* Per-asset-class volatility (how bumpy) */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--c-text3)', padding: '14px 16px 4px' }}>
        How bumpy each asset type is (volatility)
      </div>
      <div style={{ fontSize: 'var(--fs-small, 12px)', color: 'var(--c-text3)', padding: '0 16px 6px', lineHeight: 1.4 }}>
        Higher means wider swings up and down — which makes the “worst 1 in 10” outcomes worse.
      </div>
      {CLASSES.map((c) => (
        <Dial
          key={c.key} label={c.name} hint={null}
          value={cma.assetClasses[c.key]?.volatility ?? 0}
          base={baseline.assetClasses[c.key]?.volatility ?? 0}
          min={0} max={0.40}
          onChange={(v) => patch({ assetClasses: { [c.key]: { volatility: v } } })}
          onReset={() => resetField(c.key, 'volatility')}
        />
      ))}

      {/* Global reset */}
      <div style={{ padding: '16px' }}>
        <button
          type="button" onClick={reset} disabled={!modified}
          style={{ width: '100%', padding: '11px', borderRadius: 10, fontWeight: 600, fontSize: 'var(--fs-body, 15px)',
            cursor: modified ? 'pointer' : 'default',
            border: `1px solid ${modified ? 'var(--c-acc, #5ddbc2)' : 'var(--c-sep)'}`,
            background: modified ? 'rgba(93,219,194,0.12)' : 'transparent',
            color: modified ? 'var(--c-acc, #5ddbc2)' : 'var(--c-text3)' }}
        >
          {modified ? 'Reset everything to baseline' : 'All assumptions at baseline'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          Baseline: {baseline._meta?.version || 'UK-CMA-2026.1'}
          {baseline._meta?.published ? ` · published ${baseline._meta.published}` : ''}.
          Your changes are saved on this device only.
        </div>
      </div>
    </div>
  )
}
