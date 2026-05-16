// ─────────────────────────────────────────────────────────────────────────────
// forgotten-money-engine — §13.4 magic
//
// `findForgottenMoney(entity, jurisdiction)` — cross-references entity wrappers
// against UK statutory allowances + dormant-account candidates. Returns a
// ranked list of unused/expiring/dormant items.
//
// Pattern: anti-leakage, not asset growth. Surfaces money the user already
// has rights to but hasn't claimed/used.
//
// Wave 1 scope: UK ISA + gift + pension annual allowance + dormant patterns.
// Wave 2 will add: NRI bilateral checks, employer matching headroom, lapsed
// tax reliefs (EIS carry-back, etc.).
// ─────────────────────────────────────────────────────────────────────────────

const UK_2026_ISA_LIMIT    = 20000
const UK_2026_GIFT_LIMIT   = 3000
const UK_2026_PENSION_ANN  = 60000

function safe(fn, fallback) { try { return fn() } catch { return fallback } }

/**
 * Compute days until 6 April (UK tax year end).
 */
function daysUntilTaxYearEnd(now = new Date()) {
  const year = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)
    ? now.getFullYear()
    : now.getFullYear() + 1
  const end = new Date(year, 3, 5) // Apr 5 (month 3 = April)
  return Math.max(0, Math.round((end - now) / 86400000))
}

export function findForgottenMoney(entity, jurisdiction = 'UK') {
  if (!entity) return []
  const items = []
  const daysLeft = daysUntilTaxYearEnd()

  // ── ISA allowance ──────────────────────────────────────────────────────
  const isaContrib = safe(() => entity?.contributions?.isa || 0, 0)
  const isaUnused = Math.max(0, UK_2026_ISA_LIMIT - isaContrib)
  if (isaUnused > 1000) {
    items.push({
      id: 'isa-allowance',
      kind: 'expiring-allowance',
      label: 'ISA allowance',
      amount: isaUnused,
      detail: `£${isaUnused.toLocaleString()} ISA allowance expires in ${daysLeft} days. Wraps gains tax-free for life.`,
      whyHere: 'You can shelter up to £20,000/year of taxable cash or investments in an ISA. Anything sitting in a taxable account is paying CGT or income tax on gains it doesn\'t need to.',
      ifMissed: `Lose £${isaUnused.toLocaleString()} of this year's allowance permanently — ISA allowances don't carry forward. Past 5 April it's gone.`,
      daysUntilDeadline: daysLeft,
      urgency: daysLeft < 60 ? 'high' : daysLeft < 120 ? 'medium' : 'low',
      action: 'Top up before 5 April',
      destination: 'money',
    })
  }

  // ── Annual gift allowance ──────────────────────────────────────────────
  const giftUsed = safe(() => entity?.gifts?.thisYear || 0, 0)
  const giftUnused = Math.max(0, UK_2026_GIFT_LIMIT - giftUsed)
  if (giftUnused > 500) {
    items.push({
      id: 'gift-allowance',
      kind: 'expiring-allowance',
      label: 'Annual gift allowance',
      amount: giftUnused,
      detail: `£${giftUnused.toLocaleString()} gift allowance unused this tax year. Reduces estate immediately — no 7-year clock.`,
      whyHere: 'HMRC lets you gift up to £3,000/year out of your estate with zero IHT implications and no waiting period. Unlike larger gifts, this one is free of the 7-year clock.',
      ifMissed: `Lose £${giftUnused.toLocaleString()} of immediate estate reduction. Next year's allowance does NOT carry forward beyond one tax year.`,
      daysUntilDeadline: daysLeft,
      urgency: daysLeft < 60 ? 'high' : 'medium',
      action: 'Make a gift before 5 April',
      destination: 'tax',
    })
  }

  // ── Pension annual allowance headroom ──────────────────────────────────
  const pensionContrib = safe(() => entity?.contributions?.pension || 0, 0)
  const pensionUnused = Math.max(0, UK_2026_PENSION_ANN - pensionContrib)
  if (pensionUnused > 5000) {
    items.push({
      id: 'pension-allowance',
      kind: 'expiring-allowance',
      label: 'Pension annual allowance',
      amount: pensionUnused,
      detail: `£${pensionUnused.toLocaleString()} pension allowance unused. Tax relief at your top rate; carry-forward available.`,
      whyHere: 'Pension contributions get tax relief at your marginal rate. At a 40% top band, every £1,000 contributed costs you £600 net. The allowance is £60,000/year (tapered for high earners).',
      ifMissed: 'You can carry forward up to 3 years of unused allowance — but only if you\'ve been a UK pension scheme member those years. Lose the carry-forward window and the relief is gone.',
      daysUntilDeadline: daysLeft,
      urgency: daysLeft < 90 ? 'medium' : 'low',
      action: 'Review with adviser',
      destination: 'money',
    })
  }

  // ── Dormant pension candidates ─────────────────────────────────────────
  const age = entity?.age || 0
  if (age > 40 && !entity?.dormantPensionsChecked) {
    items.push({
      id: 'dormant-pensions',
      kind: 'dormant-candidate',
      label: 'Possible dormant pensions',
      amount: null,
      detail: 'Pre-2012 employments may have lapsed pension pots you\'ve forgotten. HMRC\'s Pension Tracing Service can find them.',
      whyHere: 'Auto-enrolment only began in 2012. If you worked at multiple employers before then, you may have small pots (£500–£20,000+) that nobody contacted you about when you moved jobs.',
      ifMissed: 'Pots stay invested but with old high-fee schemes. Cumulative drag over 20–30 years can wipe out 30%+ of the value. Worth 30 minutes to trace.',
      daysUntilDeadline: null,
      urgency: 'low',
      action: 'Run a pension trace',
      destination: 'capture',
    })
  }

  // Sort by urgency, then amount
  const urgencyRank = { high: 0, medium: 1, low: 2 }
  return items.sort((a, b) => {
    const u = urgencyRank[a.urgency] - urgencyRank[b.urgency]
    if (u !== 0) return u
    return (b.amount || 0) - (a.amount || 0)
  })
}

export function totalForgotten(items) {
  return items.reduce((s, i) => s + (i.amount || 0), 0)
}
