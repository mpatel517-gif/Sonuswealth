// ─────────────────────────────────────────────────────────────────────────────
// YearStepper — global rule-year control (founder 2026-06-08)
//
// A compact ◀ 2025/26 ▸ stepper that picks WHICH tax year's rules are in force.
// Lives in the app chrome (Dashboard), so it appears on every screen. Distinct
// from the horizon dropdown (GlobalTaxYearChip), which owns the projection
// horizon only — this owns the rule bundle.
//
// It writes `ruleYear` into localStorage.sonuswealth.temporal and dispatches the
// shared `sonus:taxyear` event. bundle-wiring.installBundleAutoSync() then calls
// setBundle() with the matching UK-<year> bundle, and every engine consumer
// (PA, NRB, dividend rates, NIC bands…) live-updates via onBundleChange. So all
// screens re-render for the chosen year with no per-screen plumbing.
//
// Prior-year USER data (CGT losses c/f, gift clock, ANI history) is Phase 2 —
// today the stepper swaps RULES only; user figures stay constant across years.
// ─────────────────────────────────────────────────────────────────────────────

import useTaxYear, { RULE_YEARS } from '../../hooks/useTaxYear.jsx'

const STORE_KEY = 'sonuswealth.temporal'

function setRuleYear(ruleYear) {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const prev = raw ? JSON.parse(raw) : {}
    const next = { ...prev, ruleYear, ts: Date.now() }
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('sonus:taxyear'))
  } catch (_e) { /* localStorage unavailable — silent */ }
}

export default function YearStepper() {
  const ty = useTaxYear()
  const current = ty.ruleYear || RULE_YEARS[RULE_YEARS.length - 1]
  const idx = Math.max(0, RULE_YEARS.indexOf(current))
  const atStart = idx <= 0
  const atEnd = idx >= RULE_YEARS.length - 1
  const isCurrentLaw = idx === RULE_YEARS.length - 1

  // Demote-into-scenario (founder 2026-06-08): the rule year is only a
  // steppable control in the what-if context (Scenario / Plan). In Today /
  // Future it's a read-only indicator of which year's law is computing the
  // figures — so it stops reading as a second time-axis that fights HORIZON.
  // A non-current rule year always keeps a "Today" reset so the user is never
  // stranded on a back-dated bundle after leaving scenario mode.
  const steppable = ty.viewMode === 'scenario' || ty.viewMode === 'plan'

  const step = (delta) => {
    const ni = Math.min(RULE_YEARS.length - 1, Math.max(0, idx + delta))
    if (ni !== idx) setRuleYear(RULE_YEARS[ni])
  }

  const btn = (disabled) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 24, height: 24, borderRadius: 7,
    border: '1px solid var(--c-border)',
    background: disabled ? 'transparent' : 'var(--c-surface2)',
    color: disabled ? 'var(--c-text3)' : 'var(--c-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 13, lineHeight: 1, fontFamily: 'inherit', padding: 0,
  })

  const tooltip = steppable
    ? `RULES — which tax year's law computes your figures. Step it to model a different year's rules. Currently ${current}${isCurrentLaw ? ' (current law)' : ''}. Independent of the horizon you're viewing.`
    : `RULES — which tax year's law is computing your figures: ${current}${isCurrentLaw ? ' (current law)' : ''}. Independent of the horizon you're viewing. Switch to “What if” to model a different year's rules.`

  const yearSpan = (
    <span style={{
      minWidth: 52, textAlign: 'center', fontSize: 12, fontWeight: 700,
      color: steppable ? 'var(--c-text)' : 'var(--c-text2)',
      fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3,
    }}>
      {current}
    </span>
  )

  const todayReset = !isCurrentLaw && (
    <button
      type="button"
      onClick={() => setRuleYear(RULE_YEARS[RULE_YEARS.length - 1])}
      style={{
        fontSize: 10, fontWeight: 600, color: 'var(--c-acc)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '2px 4px', fontFamily: 'inherit', textDecoration: 'underline',
      }}
    >
      Today
    </button>
  )

  return (
    <div
      role="group"
      aria-label="Tax-year rules"
      title={tooltip}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span className="sw-eyebrow" style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--c-text3)' }}>
        Rules
      </span>
      {steppable ? (
        <>
          <button type="button" aria-label="Earlier tax year" onClick={() => step(-1)} disabled={atStart} style={btn(atStart)}>◀</button>
          {yearSpan}
          <button type="button" aria-label="Later tax year" onClick={() => step(1)} disabled={atEnd} style={btn(atEnd)}>▶</button>
          {todayReset}
        </>
      ) : (
        <>
          {yearSpan}
          {todayReset}
        </>
      )}
    </div>
  )
}
