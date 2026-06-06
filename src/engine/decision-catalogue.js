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

// Titles are plain English (founder 2026-06-06: "not plain English … correct on
// all screens"). Key technical terms kept in parentheses only where they aid
// recognition (macOS principle). The DE-XX code remains the canonical identifier
// used in commit events / audit trail.
export const DECISION_TYPES_ALL = [
  { id: 'DE-01', title: 'Taking your pension: all at once or bit by bit', status: 'live' },
  { id: 'DE-02', title: 'Buy a guaranteed income now, or wait?', status: 'live' },
  { id: 'DE-03', title: 'How much to pay into your pension', status: 'live' },
  { id: 'DE-04', title: 'Where to put your pension contributions', status: 'live' },
  { id: 'DE-05', title: 'Swap some salary for pension contributions?', status: 'live' },
  { id: 'DE-06', title: 'Which ISA to use for your savings', status: 'live' },
  { id: 'DE-07', title: 'Move investments into a tax-free ISA', status: 'live' },
  { id: 'DE-08', title: 'Spare money: overpay the mortgage or invest?', status: 'live' },
  { id: 'DE-09', title: 'What to do with a property: keep, rent, or sell', status: 'live' },
  { id: 'DE-10', title: 'Choosing your next mortgage deal', status: 'live' },
  { id: 'DE-11', title: 'Your rental property and the landlord tax rules', status: 'live' },
  { id: 'DE-12', title: 'Releasing cash from your home (equity release)', status: 'live' },
  { id: 'DE-13', title: 'Your emergency fund: how much and where', status: 'live' },
  { id: 'DE-14', title: 'A better return on spare cash', status: 'live' },
  { id: 'DE-15', title: 'Giving money to family tax-efficiently', status: 'live' },
  { id: 'DE-16', title: 'Choosing the right type of trust', status: 'live' },
  { id: 'DE-17', title: 'Choosing the right type of will', status: 'live' },
  { id: 'DE-18', title: 'Power of attorney — planning ahead', status: 'live' },
  { id: 'DE-19', title: 'Choosing the right life cover', status: 'live' },
  { id: 'DE-20', title: 'Critical illness cover: add or top up', status: 'live' },
  { id: 'DE-21', title: 'Income protection: which type to choose', status: 'live' },
  { id: 'DE-22', title: 'Using your tax-free capital gains allowance', status: 'live' },
  { id: 'DE-23', title: 'Using investment losses to cut tax', status: 'live' },
  { id: 'DE-24', title: 'Sharing assets with your spouse to cut tax', status: 'live' },
  { id: 'DE-25', title: 'Paying yourself: salary vs dividends (company director)', status: 'live' },
  { id: 'DE-26', title: 'High-risk start-up investing for tax relief (EIS/SEIS)', status: 'live' },
  { id: 'DE-27', title: 'Venture capital trusts for tax relief (VCT)', status: 'live' },
  { id: 'DE-28', title: 'Business-relief investing to cut inheritance tax (BPR)', status: 'live' },
  { id: 'DE-29', title: 'Giving to charity tax-efficiently', status: 'live' },
  { id: 'DE-30', title: 'Paying for school or university', status: 'live' },
  { id: 'DE-31', title: 'Can you afford a career break?', status: 'live' },
  { id: 'DE-32', title: 'What to do with a redundancy payout', status: 'live' },
  { id: 'DE-33', title: 'What to do with an inheritance', status: 'live' },
  { id: 'DE-34', title: 'Structuring a divorce settlement', status: 'live' },
  { id: 'DE-35', title: 'Selling your business tax-efficiently', status: 'live' },
  { id: 'DE-36', title: 'Repaying or clearing a director loan', status: 'live' },
  { id: 'DE-37', title: 'Should you transfer a final-salary pension?', status: 'live' },
  { id: 'DE-38', title: 'Adding a guaranteed income later in retirement', status: 'live' },
  { id: 'DE-39', title: 'Leaving the UK: tax residency planning', status: 'live' },
  { id: 'DE-40', title: 'Paying for long-term care', status: 'live' },
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
