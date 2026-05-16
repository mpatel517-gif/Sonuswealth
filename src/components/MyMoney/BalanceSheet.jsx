// ─────────────────────────────────────────────────────────────────────────────
// BalanceSheet — proper accounting view above the 10 category cards.
//
// Spec source: MyMoney v2.7 §3.4 (domain category list) + §3.5 (net worth
// calculation) + 3-Engine-mm-asset-taxonomy-v1_0.md (canonical domain tree).
//
// Founder direction 2026-05-12: "There was a tree defined for all domains.
// Not only Income Statement, BS, Insurance, Bonds — everything. It was specced."
// This component delivers the Balance Sheet pivot — the 7 asset categories
// stacked, then 1 liability category, then NET WORTH = Σ Assets − Σ Liabilities.
//
// Visual design (Phase 2 follow-up — bringing my own opinion):
//   · Vertical accounting layout — ASSETS section then LIABILITIES then NET WORTH
//   · Each row: category name + subtotal + tiny share-of-NW bar
//   · NET WORTH row is the hero — large number with subtle accent glow
//   · Mobile-first; laptop benefits from the wider column
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`
  if (Math.abs(v) >= 1_000)     return `£${(v / 1_000).toFixed(0)}k`
  return `£${Math.round(v).toLocaleString()}`
}

// Per spec §3.4 + §3.5: 10 grouped categories.
// Assets side = 1-6 + 9 (Pensions, S&I, Property, Business, Protection, Cash, Alternatives).
// Liabilities side = 7 (Domain N).
// Income (8) + Obligations (10) are flows — not balance-sheet line items
// (they live in Income Statement / Cashflow). We render them as a separate
// "Flow context" line below the balance sheet for completeness.
const ASSET_CATS = [
  { id: 'pensions',  label: 'Pensions',           note: 'Personal, workplace and state' },
  { id: 'investments', label: 'Savings & Investments', note: 'ISAs, taxable accounts, EIS / SEIS / VCT, bonds' },
  { id: 'property',  label: 'Property',           note: 'Your home + any let property' },
  { id: 'business',  label: 'Business Assets',    note: 'Company shares, share schemes, director loans' },
  { id: 'protection-sv', label: 'Protection surrender', note: 'Cash-in value of policies' },
  { id: 'cash',      label: 'Cash',               note: 'Bank, savings, current accounts' },
  { id: 'alternatives', label: 'Alternatives',    note: 'Crypto, private equity, commodities' },
]
const LIABILITY_CATS = [
  { id: 'liabilities', label: 'Liabilities',      note: 'Mortgage, loans, credit cards' },
]
const FLOW_CATS = [
  { id: 'income',      label: 'Income (annual)',  note: 'Money coming in — not part of net worth' },
  { id: 'obligations', label: 'Obligations',      note: 'Annual cost of family support, alimony, etc.' },
]

export default function BalanceSheet({ subtotals = {}, netWorth = 0 }) {
  const totalAssets      = ASSET_CATS.reduce((s, c) => s + (subtotals[c.id] || 0), 0)
  const totalLiabilities = LIABILITY_CATS.reduce((s, c) => s + (subtotals[c.id] || 0), 0)
  const nw = subtotals.netWorth != null ? subtotals.netWorth : (totalAssets - totalLiabilities) || netWorth

  const maxAsset = Math.max(1, ...ASSET_CATS.map(c => Math.abs(subtotals[c.id] || 0)))

  return (
    <div className="sw-card sw-card-elevated sw-cinema" style={{
      padding: 18,
      background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)',
      borderRadius: 'var(--r-lg, 20px)',
      boxShadow: 'var(--sh2)',
      marginBottom: 16,
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 12, letterSpacing: 0.9 }}>
        Balance sheet
      </div>

      {/* Assets section */}
      <SectionHeader label="Assets" total={totalAssets} tone="text" />
      <CategoryRows cats={ASSET_CATS} subtotals={subtotals} max={maxAsset} barColor="var(--c-acc)" />

      {/* Liabilities section */}
      <SectionHeader label="Liabilities" total={totalLiabilities} tone="coral" topMargin={18} />
      <CategoryRows cats={LIABILITY_CATS} subtotals={subtotals} max={Math.max(1, totalLiabilities)} barColor="var(--c-coral, #FF6F7D)" />

      {/* Net Worth hero row */}
      <div style={{
        marginTop: 18,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--c-acc) 14%, transparent), color-mix(in srgb, var(--c-acc) 4%, transparent))',
        border: '1px solid color-mix(in srgb, var(--c-acc) 30%, transparent)',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'var(--c-acc)',
            letterSpacing: 0.9, textTransform: 'uppercase',
          }}>
            Net worth
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3 }}>
            Σ Assets − Σ Liabilities
          </div>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 880, color: 'var(--c-text)',
          letterSpacing: -0.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 14px var(--c-radar-glow)',
        }}>
          {fmt(nw)}
        </div>
      </div>

      {/* Flow context (not on balance sheet but useful) */}
      {(subtotals.income || subtotals.obligations) ? (
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid var(--c-sep)',
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>
            Flow context · annual (not on balance sheet)
          </div>
          {FLOW_CATS.map(c => {
            const v = subtotals[c.id] || 0
            if (!v) return null
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                fontSize: 12, padding: '4px 0',
              }}>
                <span style={{ color: 'var(--c-text2)' }}>{c.label}</span>
                <span style={{ color: 'var(--c-text)', fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(v)}<span style={{ color: 'var(--c-text3)', fontSize: 10 }}>/yr</span>
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function SectionHeader({ label, total, tone, topMargin = 0 }) {
  const color = tone === 'coral' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text)'
  return (
    <div style={{
      marginTop: topMargin,
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      paddingBottom: 6, borderBottom: '1px solid var(--c-border)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 800, color, letterSpacing: 0.9,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 800, color,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
      }}>
        {fmt(total)}
      </span>
    </div>
  )
}

function CategoryRows({ cats, subtotals, max, barColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
      {cats.map(c => {
        const v = subtotals[c.id] || 0
        if (!v) return null
        const pct = Math.max(2, Math.min(100, (v / max) * 100))
        return (
          <div key={c.id} style={{
            padding: '8px 0',
            display: 'grid',
            gridTemplateColumns: '1fr 90px',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px dashed var(--c-sep)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>
                {c.label}
              </div>
              <div style={{
                marginTop: 6, height: 4, borderRadius: 100,
                background: 'var(--c-surface2)', overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.10)',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 'inherit',
                  background: barColor,
                  boxShadow: `0 0 8px ${barColor}55`,
                  transformOrigin: 'left center',
                  animation: 'sw-bar-grow 0.9s var(--ease-out-expo) both',
                }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
                {c.note}
              </div>
            </div>
            <div style={{
              textAlign: 'right',
              fontSize: 14, fontWeight: 800, color: 'var(--c-text)',
              letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(v)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
