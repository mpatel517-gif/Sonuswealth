// ─────────────────────────────────────────────────────────────────────────────
// Decision catalogue — the 40 deterministic decisions (DE-01..DE-40) + their
// topic grouping and which screen owns each topic.
//
// Founder 2026-06-06: no standalone Decisions tab; decisions surface as
// categorised "Decisions you can make here" drawers on the screen that owns the
// topic. Pensions are SPLIT — saving on My Money, drawdown/annuity on Cashflow
// (memory: "drawdown belongs on Cashflow, not My Money").
//
// Single source of truth for titles + grouping, imported by both the full
// catalogue (DecisionEngine.jsx) and the per-screen DecisionDrawers component.
// ─────────────────────────────────────────────────────────────────────────────

export const DECISION_TYPES_ALL = [
  { id: 'DE-01', title: 'Drawdown: lump sum vs phased', status: 'live' },
  { id: 'DE-02', title: 'Annuity: buy or defer?', status: 'live' },
  { id: 'DE-03', title: 'Pension contribution: top up vs MPAA risk', status: 'live' },
  { id: 'DE-04', title: 'SIPP vs workplace pension routing', status: 'live' },
  { id: 'DE-05', title: 'Salary sacrifice: increase / decrease', status: 'live' },
  { id: 'DE-06', title: 'ISA: stocks & shares vs cash vs LISA split', status: 'live' },
  { id: 'DE-07', title: 'GIA → ISA bed-and-ISA execution', status: 'live' },
  { id: 'DE-08', title: 'Mortgage: overpay, offset, or invest?', status: 'live' },
  { id: 'DE-09', title: 'Property: keep, sell, or let?', status: 'live' },
  { id: 'DE-10', title: 'Remortgage: fix vs tracker vs offset', status: 'live' },
  { id: 'DE-11', title: 'BTL: §24 exposure review', status: 'live' },
  { id: 'DE-12', title: 'Equity release: lifetime mortgage assessment', status: 'live' },
  { id: 'DE-13', title: 'Emergency fund: size and location', status: 'live' },
  { id: 'DE-14', title: 'Cash ladder: build a 12-month bond ladder', status: 'live' },
  { id: 'DE-15', title: 'Gifting: structure £X to children (7-year PET)', status: 'live' },
  { id: 'DE-16', title: 'Trust: bare, discretionary, or interest-in-possession', status: 'live' },
  { id: 'DE-17', title: 'Will: simple, mirror, or life-interest', status: 'live' },
  { id: 'DE-18', title: 'LPA: financial and health setup', status: 'live' },
  { id: 'DE-19', title: 'Life cover: term, FIB, or whole-of-life in trust', status: 'live' },
  { id: 'DE-20', title: 'Critical illness: add or top up', status: 'live' },
  { id: 'DE-21', title: 'Income protection: own-occ vs any-occ', status: 'live' },
  { id: 'DE-22', title: 'CGT crystallisation: harvest allowance now', status: 'live' },
  { id: 'DE-23', title: 'Loss harvesting: realise losses against gains', status: 'live' },
  { id: 'DE-24', title: 'Spousal transfer: equalise allowances', status: 'live' },
  { id: 'DE-25', title: 'Dividend vs salary mix (Ltd Co director)', status: 'live' },
  { id: 'DE-26', title: 'EIS / SEIS: invest for relief', status: 'live' },
  { id: 'DE-27', title: 'VCT: build a tax-relief ladder', status: 'live' },
  { id: 'DE-28', title: 'BPR portfolio: 2-year IHT planning', status: 'live' },
  { id: 'DE-29', title: 'Charitable giving: payroll, gift aid, legacy', status: 'live' },
  { id: 'DE-30', title: 'School fees / education funding plan', status: 'live' },
  { id: 'DE-31', title: 'Career break / sabbatical affordability', status: 'live' },
  { id: 'DE-32', title: 'Redundancy: lump-sum deployment', status: 'live' },
  { id: 'DE-33', title: 'Inheritance receipt: deploy £X received', status: 'live' },
  { id: 'DE-34', title: 'Divorce: financial settlement structuring', status: 'live' },
  { id: 'DE-35', title: 'Business sale: exit + BADR planning', status: 'live' },
  { id: 'DE-36', title: 'Director loan: extract or repay', status: 'live' },
  { id: 'DE-37', title: 'Pension transfer: DB → DC suitability', status: 'live' },
  { id: 'DE-38', title: 'Annuity reshape after partial drawdown', status: 'live' },
  { id: 'DE-39', title: 'Emigration: UK tax residency exit planning', status: 'live' },
  { id: 'DE-40', title: 'Long-term care funding: self-fund vs deferred payment', status: 'live' },
]

// Topic drawers. `home` = the screen that owns the topic (tab id used by
// Dashboard: money | flow | tax | risk). Pensions are split into saving (money)
// and income (flow) per the founder's confirmed placement (2026-06-06).
export const DECISION_CATEGORIES = [
  { id: 'pension-saving',    label: 'Pension saving',          icon: '◷', home: 'money', ids: ['DE-03', 'DE-04', 'DE-05', 'DE-37'] },
  { id: 'retirement-income', label: 'Retirement income',       icon: '◷', home: 'flow', ids: ['DE-01', 'DE-02', 'DE-38'] },
  { id: 'investing',         label: 'Investing & tax wrappers', icon: '≋', home: 'money', ids: ['DE-06', 'DE-07', 'DE-22', 'DE-23', 'DE-24', 'DE-26', 'DE-27', 'DE-28'] },
  { id: 'property',          label: 'Property & mortgage',     icon: '⌂', home: 'money', ids: ['DE-08', 'DE-09', 'DE-10', 'DE-11', 'DE-12'] },
  { id: 'business',          label: 'Business & director',     icon: '◆', home: 'money', ids: ['DE-25', 'DE-35', 'DE-36'] },
  { id: 'cash',              label: 'Cash & emergency fund',   icon: '£', home: 'flow', ids: ['DE-13', 'DE-14'] },
  { id: 'life',              label: 'Income & life events',    icon: '✦', home: 'flow', ids: ['DE-30', 'DE-31', 'DE-32', 'DE-33', 'DE-34', 'DE-39', 'DE-40'] },
  { id: 'estate',            label: 'Estate, gifts & IHT',     icon: '⚖', home: 'tax', ids: ['DE-15', 'DE-16', 'DE-17', 'DE-18', 'DE-29'] },
  { id: 'protection',        label: 'Protection',              icon: '◉', home: 'risk', ids: ['DE-19', 'DE-20', 'DE-21'] },
]

const _byId = Object.fromEntries(DECISION_TYPES_ALL.map(d => [d.id, d]))

export function titleOf(id) {
  return (_byId[id] || {}).title || id
}

// Topic drawers owned by a given screen (tab id), each with its live decisions.
export function categoriesForScreen(screen) {
  return DECISION_CATEGORIES
    .filter(c => c.home === screen)
    .map(c => ({ ...c, ids: c.ids.filter(id => (_byId[id] || {}).status === 'live') }))
    .filter(c => c.ids.length > 0)
}
