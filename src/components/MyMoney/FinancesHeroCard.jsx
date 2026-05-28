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

// Variant config (2026-05-28). Founder complaint: "accounts 28 this should
// also be on the income statement tab and where else it needs to be and the
// data in the middle should be appropriate for that tab". The strip's left
// cluster (count + icon) keeps the same affordance per screen but with a
// screen-appropriate label; the middle cluster swaps the stat triplet so
// Income Statement shows Gross/Tax/Net rather than NW/Assets/Liab.
//
// Add a new screen by adding a key here and rendering the card with the
// matching `variant` prop + the data props it expects.
const VARIANTS = {
  balance: {
    leftLabel: 'Accounts',
    stats: (p) => [
      { label: 'Net worth',   value: p.netWorth,         tone: 'good', tieout: 'money.nw',          tieoutRaw: p.netWorth },
      { label: 'Assets',      value: p.totalAssets,                    tieout: 'money.assets',      tieoutRaw: p.totalAssets },
      { label: 'Liabilities', value: p.totalLiabilities, tone: p.totalLiabilities > 0 ? 'bad' : undefined, tieout: 'money.liabilities', tieoutRaw: p.totalLiabilities },
    ],
    ctaLabel: 'Add or edit',
  },
  income: {
    leftLabel: 'Sources',
    stats: (p) => [
      { label: 'Gross', value: p.gross,    tieout: 'income.gross',    tieoutRaw: p.gross },
      { label: 'Tax',   value: p.taxTotal, tone: p.taxTotal > 0 ? 'bad' : undefined, tieout: 'income.tax', tieoutRaw: p.taxTotal },
      { label: 'Net',   value: p.net,      tone: 'good', tieout: 'income.net', tieoutRaw: p.net },
    ],
    ctaLabel: 'Update income',
  },
  protection: {
    leftLabel: 'Policies',
    stats: (p) => [
      { label: 'Cover',      value: p.cover,    tone: 'good',                                       tieout: 'protection.cover',    tieoutRaw: p.cover },
      { label: 'Premiums',   value: p.premiums,                                                     tieout: 'protection.premiums', tieoutRaw: p.premiums },
      { label: 'Gap',        value: p.gap,      tone: (+(p.gapRaw || 0) > 0) ? 'bad' : undefined,   tieout: 'protection.gap',      tieoutRaw: p.gapRaw },
    ],
    ctaLabel: 'Update cover',
  },
  business: {
    leftLabel: 'Holdings',
    stats: (p) => [
      { label: 'Value',         value: p.businessValue,                  tieout: 'business.value',         tieoutRaw: p.businessValueRaw },
      { label: 'Distributions', value: p.distributions, tone: 'good',    tieout: 'business.distributions', tieoutRaw: p.distributionsRaw },
      { label: 'Director pay',  value: p.directorPay,                    tieout: 'business.directorPay',   tieoutRaw: p.directorPayRaw },
    ],
    ctaLabel: 'Update business',
  },
  trusts: {
    leftLabel: 'Vehicles',
    stats: (p) => [
      { label: 'Estate',  value: p.estate,                                             tieout: 'trusts.estate', tieoutRaw: p.estateRaw },
      { label: 'Reliefs', value: p.reliefs, tone: 'good',                              tieout: 'trusts.reliefs', tieoutRaw: p.reliefsRaw },
      { label: 'IHT',     value: p.iht,     tone: (+(p.ihtRaw || 0) > 0) ? 'bad' : undefined, tieout: 'trusts.iht', tieoutRaw: p.ihtRaw },
    ],
    ctaLabel: 'Update estate',
  },
}

export default function FinancesHeroCard({
  entity,
  variant = 'balance',
  // count override — when omitted, count is derived from countAccounts(entity)
  count,
  // balance-sheet variant props (defaults)
  totalAssets = 0,
  totalLiabilities = 0,
  netWorth = 0,
  // income variant props
  gross,
  taxTotal,
  net,
  // protection / business / trusts (pass strings, mostly fmt(...) at caller)
  cover, premiums, gap, gapRaw,
  businessValue, businessValueRaw, distributions, distributionsRaw, directorPay, directorPayRaw,
  estate, estateRaw, reliefs, reliefsRaw, iht, ihtRaw,
  // window context
  windowLabel,
  windowYears,
  viewMode,
  historyMissing,
  onAddOrEdit,
}) {
  const cfg = VARIANTS[variant] || VARIANTS.balance
  const accounts = count != null ? count : countAccounts(entity)

  // Hide rule kept tight on balance variant only (legacy behaviour). Other
  // variants render even when empty — the empty state is itself useful info.
  if (variant === 'balance' && accounts === 0 && totalAssets === 0 && totalLiabilities === 0) return null

  const stats = cfg.stats({
    netWorth, totalAssets, totalLiabilities,
    gross, taxTotal, net,
    cover, premiums, gap, gapRaw,
    businessValue, businessValueRaw, distributions, distributionsRaw, directorPay, directorPayRaw,
    estate, estateRaw, reliefs, reliefsRaw, iht, ihtRaw,
  })

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
        <Stat label={cfg.leftLabel} value={accounts} />
      </div>

      {/* Middle cluster — variant-driven stat triplet + optional window context.
          Default `balance`: NW / Assets / Liabilities. `income`: Gross / Tax / Net.
          Each Stat already handles fmt() at the call-site (callers may pass
          pre-formatted strings or raw numbers; we format numbers, leave strings
          alone). */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0 }}>
          {stats.map((s, i) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              {i > 0 && <Sep />}
              <Stat
                label={s.label}
                value={typeof s.value === 'number' ? fmt(s.value) : (s.value ?? '—')}
                tone={s.tone}
                tieout={s.tieout}
                tieoutRaw={s.tieoutRaw}
              />
            </span>
          ))}
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
        {cfg.ctaLabel} <span aria-hidden style={{ fontSize: 13 }}>→</span>
      </button>
    </div>
  )
}
