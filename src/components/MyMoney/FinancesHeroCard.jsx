// ─────────────────────────────────────────────────────────────────────────────
// FinancesHeroCard — slim command-bar variant (founder UX pass 2026-05-26).
//
// Original Voyant-mirror was a 4-row card that ate ~280px of vertical space
// at the top of MyMoney and reported "Assets £0 · Liabilities £0" because the
// parent passed `ripple.balance_sheet.totalAssets` which doesn't exist on the
// ripple shape. This rewrite is a single ~52px horizontal strip mounted
// ABOVE the section-nav chips. Same affordance — discoverable doorway to
// AddItemSheet — at a fraction of the real estate.
//
// Layout (left → right):
//   [⌬ icon]   ACCOUNTS · N        NW £698k · ASSETS £860k · LIAB £162k        [Add or edit →]
// On narrow viewports the stats wrap; the CTA stays right-aligned.
//
// Information only — no advice copy, no claims. The strip is a navigation
// affordance, not analysis.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

function countAccounts(entity) {
  if (!entity) return 0
  let n = 0
  const a = entity.assets || {}
  n += (a.pensions || []).length
  n += (a.investments || []).length
  n += (a.property || []).length
  n += (a.business_assets || a.businessAssets || a.business || []).length
  n += (a.alternatives || []).length
  if (Array.isArray(a.cash)) n += a.cash.length
  else if (a.cash?.accounts) n += a.cash.accounts.length
  else if (a.cash?.bank?.length) n += a.cash.bank.length
  else if (a.cash?.total) n += 1
  const prot = a.protection || {}
  for (const k of Object.keys(prot)) {
    const v = prot[k]
    if (Array.isArray(v)) n += v.length
    else if (v && typeof v === 'object') n += 1
  }
  const liab = entity.liabilities || {}
  if (liab.mortgage && (+liab.mortgage.outstanding || 0) > 0) n += 1
  n += (liab.otherLoans || []).length
  if ((+liab.creditCards || 0) > 0) n += 1
  const inc = entity.income || {}
  if ((+inc.employment || 0) > 0) n += 1
  if ((+inc.directorSalary || 0) > 0) n += 1
  if ((+inc.dividends || +inc.directorDividends || 0) > 0) n += 1
  if (inc.statePension && (+inc.statePension.annual || 0) > 0) n += 1
  return n
}

// ── Stat — a single label/value pair in the strip ────────────────────────────
function Stat({ label, value, tone, tieout, tieoutRaw }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{
        fontSize: 9, fontWeight: 800,
        letterSpacing: 0.8, textTransform: 'uppercase',
        color: 'var(--c-text3)',
      }}>{label}</span>
      <span
        data-tieout={tieout || undefined}
        data-tieout-raw={tieoutRaw != null ? String(tieoutRaw) : undefined}
        style={{
        fontSize: 14, fontWeight: 800,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
        color: tone === 'good' ? 'var(--c-acc)'
              : tone === 'bad' ? 'var(--c-coral, #FF6F7D)'
              : 'var(--c-text)',
      }}>{value}</span>
    </div>
  )
}

// ── Dot separator — sharper than · for editorial rhythm ──────────────────────
function Sep() {
  return (
    <span aria-hidden style={{
      width: 3, height: 3, borderRadius: '50%',
      background: 'color-mix(in srgb, var(--c-text3) 60%, transparent)',
      display: 'inline-block', margin: '0 8px', verticalAlign: 'middle',
    }} />
  )
}

export default function FinancesHeroCard({
  entity,
  totalAssets = 0,
  totalLiabilities = 0,
  netWorth = 0,
  windowLabel,        // e.g. "Last year", "5 years", "Lifetime"
  windowYears,        // numeric; <0 historical, 0 now, >0 forward
  viewMode,           // 'actual' | 'forecast' | 'plan' | 'scenario'
  historyMissing,     // true if past-window selected but no trajectory data
  onAddOrEdit,
}) {
  const accounts = countAccounts(entity)
  if (accounts === 0 && totalAssets === 0 && totalLiabilities === 0) return null

  // Window context strap — surfaces the time dimension so the X28 selector
  // visibly drives the strip. "Net worth · as at Last year" / "projected to
  // 5 years" / "today (now)". Founder fix 2026-05-26 — previously the strip
  // never reflected the window choice, so the selector felt dead.
  const windowContext = (() => {
    if (!windowLabel || windowYears === 0 || windowYears == null) return null
    if (windowYears < 0) return historyMissing
      ? `${windowLabel} · history not recorded`
      : `as at ${windowLabel}`
    return `projected to ${windowLabel}${viewMode && viewMode !== 'actual' ? ` · ${viewMode}` : ''}`
  })()

  return (
    <div
      role="region"
      aria-label="Finances summary"
      style={{
        margin: '0 -16px 4px',
        padding: '8px 16px',
        background: 'color-mix(in srgb, var(--c-acc) 4%, var(--c-bg, transparent))',
        borderTop: '1px solid color-mix(in srgb, var(--c-acc) 18%, var(--c-border))',
        borderBottom: '1px solid color-mix(in srgb, var(--c-acc) 18%, var(--c-border))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}
    >
      {/* Left cluster — wallet icon + accounts count */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span aria-hidden style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'color-mix(in srgb, var(--c-acc) 18%, transparent)',
          color: 'var(--c-acc)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M3 10h18" />
            <circle cx="17" cy="14" r="1.2" fill="currentColor" />
          </svg>
        </span>
        <Stat label="Accounts" value={accounts} />
      </div>

      {/* Middle cluster — Net worth · Assets · Liabilities + optional window context */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0 }}>
          <Stat label="Net worth"   value={fmt(netWorth)}        tone="good" tieout="money.nw" tieoutRaw={netWorth} />
          <Sep />
          <Stat label="Assets"      value={fmt(totalAssets)} tieout="money.assets" tieoutRaw={totalAssets} />
          <Sep />
          <Stat label="Liabilities" value={fmt(totalLiabilities)} tone={totalLiabilities > 0 ? 'bad' : undefined} tieout="money.liabilities" tieoutRaw={totalLiabilities} />
        </div>
        {windowContext && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: historyMissing ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text3)',
          }}>
            {windowContext}
          </span>
        )}
      </div>

      {/* Right CTA — slim pill to AddItemSheet */}
      <button
        type="button"
        onClick={() => onAddOrEdit?.()}
        className="sw-press"
        style={{
          padding: '6px 14px',
          fontSize: 12, fontWeight: 700,
          background: 'var(--c-acc)',
          color: 'var(--c-bg, #0B1F3A)',
          border: 'none', borderRadius: 100, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          boxShadow: '0 2px 10px color-mix(in srgb, var(--c-acc) 26%, transparent)',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        Add or edit <span aria-hidden style={{ fontSize: 13 }}>→</span>
      </button>
    </div>
  )
}
