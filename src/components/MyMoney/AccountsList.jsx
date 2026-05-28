// ─────────────────────────────────────────────────────────────────────────────
// AccountsList — Voyant-style consolidated scroll list of every account in the
// persona. Mirrors Voyant's sticky right-rail list (Income / Savings &
// Investments / Pensions / Property / Business / Alternatives / Liabilities /
// Protection). Each row: category icon · name · annualised £ or balance.
//
// Clicking any row fires `sonus:ask` with `{ accountId, category }` so the
// user can ask Sonnu about that account without leaving the page.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from '../../engine/fq-calculator.js'

// Compact category glyphs — reuses emoji for now so this doesn't require new
// SVG sprites. Replace with proper icons later if the design system grows.
const GLYPH = {
  income:        '💼',
  savings:       '💰',
  pensions:      '🏛️',
  property:      '🏠',
  business:      '🏢',
  alternatives:  '🎨',
  liabilities:   '🧾',
  protection:    '🛡️',
}

function ask(seed) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sonus:ask', { detail: seed }))
}

function Row({ glyph, name, sub, right, accountId, category }) {
  return (
    <button
      type="button"
      onClick={() => ask({ accountId, category })}
      className="sw-pressable"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left',
        padding: '10px 12px',
        background: 'var(--c-surface2)',
        border: '1px solid var(--c-border)',
        borderRadius: 10,
        cursor: 'pointer',
        marginBottom: 6,
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1, width: 24, textAlign: 'center' }}>{glyph}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        {sub && (
          <span style={{ display: 'block', fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{sub}</span>
        )}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 800, color: 'var(--c-text)',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{right}</span>
    </button>
  )
}

function Group({ title, count, children }) {
  if (!count) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 800,
        color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase',
        marginBottom: 6,
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        <span>{title}</span>
        <span style={{ color: 'var(--c-text3)', opacity: 0.7 }}>· {count}</span>
      </div>
      {children}
    </div>
  )
}

export default function AccountsList({ entity }) {
  if (!entity) return null

  // ── Income streams ────────────────────────────────────────────────────────
  const inc = entity.income || {}
  const incomeRows = []
  if ((+inc.employment || 0) > 0) {
    incomeRows.push({ id: 'inc-employment', glyph: GLYPH.income, name: 'Employment', sub: inc.employer || 'PAYE salary',
      right: `${fmt(+inc.employment)} / yr`, category: 'income' })
  }
  if ((+inc.directorSalary || 0) > 0) {
    incomeRows.push({ id: 'inc-dir-salary', glyph: GLYPH.income, name: 'Director salary', sub: inc.company || null,
      right: `${fmt(+inc.directorSalary)} / yr`, category: 'income' })
  }
  if ((+inc.directorDividends || 0) > 0) {
    incomeRows.push({ id: 'inc-dir-divs', glyph: GLYPH.income, name: 'Director dividends', sub: inc.company || null,
      right: `${fmt(+inc.directorDividends)} / yr`, category: 'income' })
  }
  if ((+inc.dividends || 0) > 0) {
    incomeRows.push({ id: 'inc-divs', glyph: GLYPH.income, name: 'Investment dividends', sub: 'Listed holdings',
      right: `${fmt(+inc.dividends)} / yr`, category: 'income' })
  }
  if ((+inc.rentalIncomeNet || +inc.rentalIncome || 0) > 0) {
    const rent = +inc.rentalIncomeNet || +inc.rentalIncome
    incomeRows.push({ id: 'inc-rent', glyph: GLYPH.income, name: 'Rental income', sub: 'Net after costs',
      right: `${fmt(rent)} / yr`, category: 'income' })
  }
  if ((+inc.interest || 0) > 0) {
    incomeRows.push({ id: 'inc-int', glyph: GLYPH.income, name: 'Interest', sub: 'Savings & deposits',
      right: `${fmt(+inc.interest)} / yr`, category: 'income' })
  }
  if (inc.statePension && (+inc.statePension.annual || 0) > 0) {
    incomeRows.push({ id: 'inc-state', glyph: GLYPH.income, name: 'State pension', sub: 'Forecast / in pay',
      right: `${fmt(+inc.statePension.annual)} / yr`, category: 'income' })
  }

  // ── Savings & investments (cash + investments[]) ──────────────────────────
  const a = entity.assets || {}
  const savRows = []
  // Cash accounts
  if (Array.isArray(a.cash)) {
    for (const c of a.cash) {
      savRows.push({ id: c.id || `cash-${c.bank || c.name}`, glyph: GLYPH.savings,
        name: c.bank || c.name || 'Cash account', sub: c.type || 'Cash',
        right: fmt(+c.balance || +c.value || 0), category: 'cash' })
    }
  } else if (a.cash?.accounts) {
    for (const c of a.cash.accounts) {
      savRows.push({ id: c.id || `cash-${c.bank || c.name}`, glyph: GLYPH.savings,
        name: c.bank || c.name || 'Cash account', sub: c.type || 'Cash',
        right: fmt(+c.balance || +c.value || 0), category: 'cash' })
    }
  } else if ((+a.cash?.total || 0) > 0) {
    savRows.push({ id: 'cash-total', glyph: GLYPH.savings, name: 'Cash', sub: 'Total across accounts',
      right: fmt(+a.cash.total), category: 'cash' })
  }
  for (const inv of (a.investments || [])) {
    savRows.push({
      id: inv.id || `inv-${inv.provider || inv.type}`, glyph: GLYPH.savings,
      name: inv.provider || inv.name || inv.type || 'Investment',
      sub: (inv.wrapper || inv.type || '').toString().toUpperCase(),
      right: fmt(+inv.value || +inv.balance || +inv.balance_gbp || 0),
      category: 'investments',
    })
  }

  // ── Pensions ──────────────────────────────────────────────────────────────
  const pensionRows = (a.pensions || []).map(p => ({
    id: p.id || `pen-${p.provider || p.type}`, glyph: GLYPH.pensions,
    name: p.provider || p.name || p.scheme || 'Pension',
    sub: (p.type || 'Pension').toString().toUpperCase(),
    right: fmt(+p.balance_gbp || +p.value || +p.total || +p.cetv || 0),
    category: 'pensions',
  }))

  // ── Property ──────────────────────────────────────────────────────────────
  const propertyRows = (a.property || []).map(p => ({
    id: p.id || `prop-${p.address || p.label}`, glyph: GLYPH.property,
    name: p.label || p.address || 'Property',
    sub: p.use || p.type || 'Residence',
    right: fmt(+p.value || 0),
    category: 'property',
  }))

  // ── Business assets ───────────────────────────────────────────────────────
  const bizSource = a.business_assets || a.businessAssets || a.business || []
  const businessRows = bizSource.map(b => ({
    id: b.id || `biz-${b.companyName || b.name}`, glyph: GLYPH.business,
    name: b.companyName || b.name || 'Business asset',
    sub: b.type || (b.sharePct ? `${b.sharePct}% holding` : 'Equity'),
    right: fmt(+b.estimatedValue || +b.value || 0),
    category: 'business',
  }))

  // ── Alternatives ──────────────────────────────────────────────────────────
  const altRows = (a.alternatives || []).map(alt => ({
    id: alt.id || `alt-${alt.type || alt.asset}`, glyph: GLYPH.alternatives,
    name: alt.description || alt.asset || alt.type || 'Alternative',
    sub: alt.platform || alt.type || null,
    right: fmt(+alt.gbpValue || +alt.estimatedValue || +alt.value || 0),
    category: 'alternatives',
  }))

  // ── Liabilities ───────────────────────────────────────────────────────────
  const liab = entity.liabilities || {}
  const liabRows = []
  if (liab.mortgage && (+liab.mortgage.outstanding || 0) > 0) {
    liabRows.push({
      id: liab.mortgage.id || 'liab-mortgage', glyph: GLYPH.liabilities,
      name: liab.mortgage.lender || 'Mortgage',
      sub: liab.mortgage.rateType ? `${liab.mortgage.rateType} · ${liab.mortgage.rate ? (+liab.mortgage.rate * 100).toFixed(2) + '%' : ''}` : 'Mortgage',
      right: fmt(+liab.mortgage.outstanding),
      category: 'liabilities',
    })
  }
  for (const l of (liab.otherLoans || [])) {
    liabRows.push({
      id: l.id || `liab-${l.type || l.lender}`, glyph: GLYPH.liabilities,
      name: l.lender || l.type || 'Loan',
      sub: l.type || 'Loan',
      right: fmt(+l.outstanding || +l.balance || 0),
      category: 'liabilities',
    })
  }
  if ((+liab.creditCards || 0) > 0) {
    liabRows.push({ id: 'liab-cc', glyph: GLYPH.liabilities, name: 'Credit cards', sub: 'Revolving',
      right: fmt(+liab.creditCards), category: 'liabilities' })
  }

  // ── Protection ────────────────────────────────────────────────────────────
  const prot = a.protection || {}
  const protectionRows = []
  for (const [k, v] of Object.entries(prot)) {
    if (!v) continue
    if (Array.isArray(v)) {
      for (const p of v) {
        protectionRows.push({
          id: p.id || `prot-${k}-${p.provider}`, glyph: GLYPH.protection,
          name: p.provider || p.name || k,
          sub: k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
          right: fmt(+p.coverAmount || +p.cover || 0),
          category: 'protection',
        })
      }
    } else if (typeof v === 'object') {
      protectionRows.push({
        id: v.id || `prot-${k}`, glyph: GLYPH.protection,
        name: v.provider || v.name || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
        sub: k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
        right: fmt(+v.coverAmount || +v.cover || +v.value || 0),
        category: 'protection',
      })
    }
  }

  const total =
      incomeRows.length + savRows.length + pensionRows.length
    + propertyRows.length + businessRows.length + altRows.length
    + liabRows.length + protectionRows.length

  if (total === 0) {
    return (
      <div style={{
        padding: 16, textAlign: 'center',
        color: 'var(--c-text3)', fontSize: 12,
        border: '1px dashed var(--c-border)', borderRadius: 12,
      }}>
        No accounts yet. Add your first one from the Finances card above.
      </div>
    )
  }

  return (
    <div>
      <Group title="Income"                  count={incomeRows.length}>
        {incomeRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Savings & investments"   count={savRows.length}>
        {savRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Pensions"                count={pensionRows.length}>
        {pensionRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Property"                count={propertyRows.length}>
        {propertyRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Business assets"         count={businessRows.length}>
        {businessRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Alternatives"            count={altRows.length}>
        {altRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Liabilities"             count={liabRows.length}>
        {liabRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
      <Group title="Protection"              count={protectionRows.length}>
        {protectionRows.map(r => <Row key={r.id} {...r} accountId={r.id} />)}
      </Group>
    </div>
  )
}

// Export the total-count helper too so callers can label the RevealCard
// title with the total without re-deriving it.
export function accountsTotalCount(entity) {
  if (!entity) return 0
  // Mirrors the derivation above but only returns the count. Cheap & reused.
  const a = entity.assets || {}
  const inc = entity.income || {}
  const liab = entity.liabilities || {}
  let n = 0
  if ((+inc.employment || 0) > 0) n++
  if ((+inc.directorSalary || 0) > 0) n++
  if ((+inc.directorDividends || 0) > 0) n++
  if ((+inc.dividends || 0) > 0) n++
  if ((+inc.rentalIncomeNet || +inc.rentalIncome || 0) > 0) n++
  if ((+inc.interest || 0) > 0) n++
  if (inc.statePension && (+inc.statePension.annual || 0) > 0) n++
  if (Array.isArray(a.cash)) n += a.cash.length
  else if (a.cash?.accounts) n += a.cash.accounts.length
  else if ((+a.cash?.total || 0) > 0) n += 1
  n += (a.investments || []).length
  n += (a.pensions || []).length
  n += (a.property || []).length
  n += (a.business_assets || a.businessAssets || a.business || []).length
  n += (a.alternatives || []).length
  if (liab.mortgage && (+liab.mortgage.outstanding || 0) > 0) n++
  n += (liab.otherLoans || []).length
  if ((+liab.creditCards || 0) > 0) n++
  const prot = a.protection || {}
  for (const v of Object.values(prot)) {
    if (Array.isArray(v)) n += v.length
    else if (v && typeof v === 'object') n += 1
  }
  return n
}
