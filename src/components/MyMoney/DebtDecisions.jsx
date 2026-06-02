// ─────────────────────────────────────────────────────────────────────────────
// DebtDecisions — researched decision modeller for debts / liabilities.
// Covers mortgages (residential + BTL), personal loans, credit cards, car finance.
//
// Decisions modelled (filtered by loan type):
//   · Overpay          — lump or extra monthly; amortise() shows interest saved +
//                        months shaved vs current schedule. Fixed-rate: 10%/yr ERC
//                        cap flagged (near-universal, UK April 2026;
//                        source: mortgagenotes.co.uk reviewed 18 Apr 2026;
//                        mortgageviz.uk 23 Jan 2026). SVR / variable = unlimited.
//   · Remortgage       — new indicative rate → new monthly payment + lifetime-
//                        interest delta. If fix end year visible, flags window.
//                        Rate ranges: 4.09–5.44% fixed (remortgagesaver.com April
//                        2026). Labelled INDICATIVE throughout.
//   · Switch rate-type — variable ↔ fixed certainty trade-off (no maths, framed
//                        as decision context; fire to Sonu for detail).
//   · Consolidate      — only for unsecured high-APR (cards, personal loans, car).
//                        Blended rate vs a single lower rate. Risk warning: securing
//                        against the home extends term + puts home at risk. Never a push.
//
// Tax applied correctly:
//   · BTL mortgage: S24 — 20% basic-rate tax credit only, NOT a deduction.
//     Enacted since 2020/21 (Finance (No.2) Act 2015, ITTOIA 2005 §272A–274C).
//     Source: thetaxlead.co.uk May 2026; salarytax.uk May 2026.
//   · Residential mortgage interest: not deductible (personal use).
//
// Rate data (UK April–May 2026; labelled indicative):
//   · Residential fix: 4.09–5.44% by LTV (remortgagesaver.com Apr 2026)
//   · Average SVR: 8.11% (remortgagesaver.com Apr 2026)
//   · Personal loans: 5.6–10% APR (bestmortgagesforyou.co.uk Mar 2026)
//   · Credit cards: avg 21.6% interest-charging effective rate (BoE Mar 2026)
//   · Overdrafts: avg 21.7% (BoE Mar 2026)
//
// COMPLIANCE: a MODEL of the user's own figures + named rules — nothing here
// changes records or constitutes personal advice (FCA boundary live).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { amortise, payoffLabel } from './debtMath.js'
import { BRAND } from '../../config/brand.js'
import { classifyLiability, DECISION_LABELS } from '../../engine/liability-taxonomy.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}

function pct(v, dp = 1) {
  return `${(+(v || 0) * 100).toFixed(dp)}%`
}

function yrs(months) {
  if (months == null) return null
  const y = months / 12
  if (y < 1) return `${Math.round(months)} mo`
  return `${y.toFixed(y < 10 ? 1 : 0)} yr`
}

function Row({ label, value, tone, strong }) {
  const fg =
    tone === 'good' ? 'var(--c-acc)'
    : tone === 'bad' ? 'var(--c-coral,#FF6F7D)'
    : tone === 'warn' ? '#FF9500'
    : 'var(--c-text)'
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 12, padding: '8px 0', borderBottom: '1px solid var(--c-sep)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{
        fontSize: strong ? 15 : 13, fontWeight: strong ? 850 : 700,
        color: fg, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
      }}>{value}</span>
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.45 }}>
      {children}
    </div>
  )
}

// ── Loan-type classifier ─────────────────────────────────────────────────────

function normType(t = '') { return t.toLowerCase().replace(/_/g, '-') }

function loanMeta(asset) {
  const t = normType(asset.type || '')
  const isBTL         = t.includes('buy-to-let') || t.includes('btl')
  const isResidential = !isBTL && (t.includes('residential') || t.includes('mortgage'))
  const isMortgage    = isBTL || isResidential
  const isCard        = t.includes('credit-card') || t.includes('card')
  const isCar         = t.includes('car') || t.includes('pcp') || t.includes('hp') || t.includes('lease')
  const isPersonal    = t.includes('personal') || t.includes('unsecured')
  const isOverdraft   = t.includes('overdraft')
  const isHMRC        = t.includes('hmrc') || t.includes('self-assessment') || (t.includes('tax') && !t.includes('after-tax'))
  const isBNPL        = t.includes('bnpl') || t.includes('buy-now') || t.includes('pay-later')
  // Unsecured = can consolidate (potentially secured against home — warn).
  // HMRC (use Time to Pay) and BNPL (just clear it) are NOT consolidation candidates.
  const isUnsecured   = isCard || isCar || isPersonal || isOverdraft
  // Fixed-rate check: rate_type / rateType string contains 'fix' or a year
  const rateType = asset.rate_type || asset.rateType || ''
  const isFixed       = /fix/i.test(rateType) || /20\d{2}/.test(rateType)
  const fixYear       = (/(\d{4})/.exec(rateType) || [])[1]
  return { isBTL, isResidential, isMortgage, isCard, isCar, isPersonal, isOverdraft, isHMRC, isBNPL, isUnsecured, isFixed, fixYear, rateType }
}

// ── Decision set per loan type ───────────────────────────────────────────────

// Verbs with a bespoke, maths-backed body below. Every OTHER verb in the
// taxonomy's decision set renders the generic info body (taxNote + risk flags +
// a one-line decision intro) — honest info/guidance, no fake maths, no dead chip.
const RICH_VERBS = new Set(['overpay', 'remortgage', 'switch-rate', 'consolidate', 'time-to-pay'])

// The applicable decision set now comes from the canonical taxonomy, so a PCP
// shows 'voluntary-termination', a student loan shows 'leave it (written off)',
// equity release shows 'review the release' — not a generic overpay/consolidate
// pair (founder 2026-06-02, full-spectrum). Falls back to the meta heuristics
// only when the type matches nothing in the taxonomy.
function decisionsFor(meta, asset) {
  const fromTaxonomy = classifyLiability(asset?.type).decisions
  if (fromTaxonomy && fromTaxonomy.length) return fromTaxonomy
  if (meta.isHMRC) return ['time-to-pay', 'overpay']
  if (meta.isBNPL) return ['clear-before-fees']
  const d = ['overpay']
  if (meta.isMortgage) { d.push('remortgage'); d.push('switch-rate') }
  if (meta.isUnsecured) d.push('consolidate')
  return d
}

// One-line, FCA-safe framing of each info-only decision (general principle, not
// a personal recommendation). Used by the generic body.
const VERB_INTRO = {
  'clear-before-fees':      'Clearing this balance removes the running cost and any late-fee or default risk. There is usually no penalty for settling a small balance early.',
  'voluntary-termination':  'On a regulated HP or PCP agreement you have a statutory right (CCA s.99) to hand the car back once you have paid 50% of the total amount payable — capping what you owe.',
  'do-nothing-written-off': 'For this debt, doing nothing can be rational — it is written off in defined circumstances (e.g. on death), so overpaying may simply waste money. Model it before overpaying.',
  'equity-release-review':  'Equity release compounds — the balance grows over time. The live decision is reviewing the rate, any drawdown facility and the impact on your estate.',
  'staircase':              'Staircasing means buying a larger share (shared ownership) or redeeming the equity loan (Help-to-Buy) — it changes what you own outright versus what you owe.',
  's455-repay':             "Repaying an overdrawn director's loan within 9 months and 1 day of the company year-end avoids the S455 charge (reclaimable, but it ties up cash until repaid).",
  'seek-debt-advice':       'Free, regulated debt advice (StepChange, National Debtline, Citizens Advice) can structure priority debts and pause enforcement — at no cost.',
  'balance-transfer':       'Moving a card balance to a 0% balance-transfer deal pauses interest for the promo period (usually for a one-off fee). Clear it before the promo ends or the full APR returns.',
  'formalise':              "Documenting a family or informal loan (amount, terms, signatures) is what makes it a genuine, estate-deductible debt rather than a gift in HMRC's eyes.",
  'reduce-poa':             'If your income has fallen you can ask HMRC to reduce your payments on account — but reduce them too far and interest is charged on the shortfall.',
  'port':                   'Porting moves your existing mortgage deal to a new property, keeping the rate and avoiding early-repayment charges — subject to a fresh affordability check.',
}

// ── Indicative rate helper ────────────────────────────────────────────────────
// Residential fix April 2026: 4.09–5.44% by LTV (remortgagesaver.com Apr 2026)
// BTL fix premium: typically +0.5–1% over residential
function indicativeRemortgageRate(meta, currentRate) {
  if (meta.isBTL) return 0.049   // BTL ~4.9% indicative mid April 2026
  return 0.044                   // residential ~4.4% indicative mid April 2026
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DebtDecisions({ asset = {}, marginalRate = 0.4, surplusCash = 0, onAddToPlan }) {
  // ── Normalise the loan shape (multiple field conventions in the fixture personas) ──
  const balance   = +(asset.outstanding ?? asset.outstanding_balance ?? 0)
  // interest_rate stored as DECIMAL (0.054) in fixtures; amortise() takes PERCENT
  const rateDecimal = +(asset.interest_rate ?? asset.apr ?? asset.rate ?? 0)
  const ratePct     = rateDecimal * 100          // e.g. 5.4 — fed to amortise()
  const monthly     = +(asset.monthly_payment ?? asset.monthlyPayment ?? 0)
  const name        = asset.name || asset.label || 'this loan'

  const meta = loanMeta(asset)
  const decisions = decisionsFor(meta, asset)

  const [pick, setPick]   = useState(decisions[0])
  const [saved, setSaved] = useState(null)

  // Overpay state — slider for lump sum amount
  const maxLump   = Math.min(balance, surplusCash > 0 ? surplusCash : balance * 0.25)
  const [lump, setLump]           = useState(Math.round(maxLump * 0.5))
  const [extraMonthly, setExtra]  = useState(0)

  // Remortgage state — new indicative rate slider
  const indicativeRate = indicativeRemortgageRate(meta, rateDecimal)
  const [newRatePct, setNewRatePct] = useState(+(indicativeRate * 100).toFixed(2))

  const active = decisions.includes(pick) ? pick : decisions[0]

  // ── Shared computed: current amortisation ────────────────────────────────
  const amCurrent = amortise(balance, ratePct, monthly)

  // ── Event dispatchers ────────────────────────────────────────────────────
  const fireAsk = (question, decision) =>
    window.dispatchEvent(new CustomEvent('sonus:ask', {
      detail: {
        question,
        context: { metric: 'debtDecision', decision, name, scope: 'mymoney' },
      },
    }))

  const addPlan = (label, summary, deltas) => {
    onAddToPlan?.({
      kind: 'debt-decision', decision: active, label, summary,
      asset: name, deltas,
    })
    setSaved(active)
  }

  // ── Per-decision body ────────────────────────────────────────────────────
  let body = null, askQ = '', planLabel = '', planSummary = '', planDeltas = []

  // ── 1. OVERPAY ────────────────────────────────────────────────────────────
  if (active === 'overpay') {
    // Lump-sum path
    const useLump    = lump > 0
    const newBalance = Math.max(0, balance - (useLump ? lump : 0))
    const newMonthly = monthly + (extraMonthly > 0 ? extraMonthly : 0)
    const amNew      = amortise(newBalance, ratePct, useLump ? monthly : newMonthly)

    // Interest saved = (total interest current) − (total interest new)
    // Total interest = total payments − principal
    const currentPayoffM = amCurrent.payoffMonths
    const newPayoffM     = amNew.payoffMonths
    const totalInterestCurrent = currentPayoffM != null ? (monthly * currentPayoffM - balance) : null
    const totalInterestNew     = newPayoffM     != null
      ? ((useLump ? monthly : newMonthly) * newPayoffM - newBalance)
      : null
    // interestSaved: pure interest comparison — lump is principal, already
    // reflected in newBalance (hence newPayoffM). Do NOT subtract lump again.
    const interestSaved = (totalInterestCurrent != null && totalInterestNew != null)
      ? Math.max(0, totalInterestCurrent - totalInterestNew)
      : null

    // ERC cap check for fixed-rate mortgages
    // Near-universal 10%/yr on fixed-rate UK mortgages (mortgagenotes.co.uk Apr 2026)
    const ercCap        = balance * 0.10
    const ercBreached   = meta.isFixed && lump > ercCap

    const monthsSaved = (currentPayoffM != null && newPayoffM != null)
      ? Math.max(0, currentPayoffM - newPayoffM)
      : null

    askQ = `If I overpay ${gbp(lump)} on ${name}, how much interest would I save and how many years shorter would the term be? Also flag if Section 24 applies.`
    planLabel = `Overpay ${gbp(lump)} on ${name}`
    planSummary = monthsSaved != null
      ? `Shave ~${yrs(monthsSaved)} off the term; interest saved ~${interestSaved != null ? gbp(interestSaved) : '?'}`
      : 'Overpayment modelled'
    // Delta: cash goes down by lump paid; debt reduction is shown in body, not as a plan delta
    // (no 'liability' asset-category in the plan tiles — only cash moves are honest)
    planDeltas = lump > 0 && surplusCash > 0
      ? [{ category: 'cash', deltaNow: -lump }]
      : []

    body = (<>
      {/* Lump sum slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text2)', marginBottom: 4 }}>
          <span>Lump sum overpayment</span>
          <span style={{ fontWeight: 800, color: 'var(--c-text)' }}>{gbp(lump)}</span>
        </div>
        <input
          type="range" min={0} max={Math.max(1, Math.round(maxLump))} step={Math.max(100, Math.round(maxLump / 100))}
          value={lump}
          onChange={e => { setLump(+e.target.value); setSaved(null) }}
          style={{ width: '100%', accentColor: 'var(--c-acc)', marginBottom: 6 }}
        />
        {surplusCash > 0 && (
          <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
            Surplus cash available: {gbp(surplusCash)} · slider capped at {gbp(maxLump)}
          </div>
        )}
      </div>

      <Row label="Outstanding balance" value={gbp(balance)} />
      <Row label="Balance after overpayment" value={gbp(newBalance)} tone="good" />
      <Row label="Current payoff" value={payoffLabel(amCurrent)} />
      <Row label="New payoff (after lump)" value={payoffLabel(amNew)} tone={monthsSaved != null && monthsSaved > 0 ? 'good' : 'neutral'} />
      {monthsSaved != null && monthsSaved > 0 && (
        <Row label="Time shaved off" value={`~${yrs(monthsSaved)}`} tone="good" strong />
      )}
      {interestSaved != null && interestSaved > 0 && (
        <Row label="Lifetime interest saved" value={`~${gbp(interestSaved)}`} tone="good" strong />
      )}

      {ercBreached && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 10,
          background: 'color-mix(in srgb, #FF9500 12%, transparent)',
          border: '1px solid color-mix(in srgb, #FF9500 30%, transparent)',
          fontSize: 11, color: '#FF9500', lineHeight: 1.45,
        }}>
          ⚠ Fixed-rate ERC cap: most UK lenders allow only 10% of outstanding balance
          ({gbp(ercCap)}) per year without an Early Repayment Charge (ERC).{' '}
          {gbp(lump)} exceeds this by {gbp(lump - ercCap)}. Split across two
          calendar years to avoid the ERC — or check your mortgage offer for your
          lender's exact allowance (typically 1–5% penalty on excess).
          {'\n'}Source: mortgagenotes.co.uk reviewed 18 Apr 2026 · mortgageviz.uk 23 Jan 2026.
        </div>
      )}

      {meta.isFixed && !ercBreached && lump > 0 && (
        <Note>Fixed-rate cap: most UK lenders allow up to 10% of the outstanding balance ({gbp(ercCap)}) per year without an Early Repayment Charge. Your lump sum is within that limit. On SVR/tracker, unlimited overpayments are usually allowed. Source: mortgagenotes.co.uk Apr 2026.</Note>
      )}

      {meta.isBTL && (
        <Note>BTL context: overpaying reduces the balance on which you pay interest — and under Section 24 (ENACTED 2020/21, ITTOIA 2005 §272A–274C), higher-rate landlords get only a 20% tax credit, not a full deduction. Lower interest = less tax relief lost. Source: thetaxlead.co.uk May 2026.</Note>
      )}
      {!meta.isBTL && !meta.isFixed && amCurrent.status === 'amortising' && (
        <Note>Estimates from your recorded balance, rate and payment — label as your own model, not a lender projection. Actual interest saved depends on the day payments are applied.</Note>
      )}
      {amCurrent.status === 'interest-only' && (
        <Note>This loan is set to interest-only — the balance isn't currently reducing. An overpayment goes directly against principal and will start cutting the balance.</Note>
      )}
      {meta.isBNPL && (
        <Note>Buy-now-pay-later is interest-free only while you stay on schedule — a missed instalment can trigger late fees and, since the FCA brought BNPL into regulation in 2026, it can now affect your credit file. Clearing the small remaining balance removes that risk entirely. There is no early-settlement penalty.</Note>
      )}
      {meta.isCar && (
        <Note>On a PCP or HP agreement the car is the lender's security until the final payment. You have a statutory right to voluntary termination once you have paid 50% of the total amount payable (including the balloon) — handing the car back with nothing more to pay. Overpaying or settling early can be worthwhile, but check for an early-settlement figure first.</Note>
      )}
      {meta.isOverdraft && (
        <Note>Arranged overdrafts now carry a single high APR (often ~40% representative since the 2020 FCA reforms) — usually the most expensive borrowing after only some cards. Clearing it, or moving the balance to a 0% money-transfer card or a lower-rate loan, almost always saves money.</Note>
      )}
    </>)
  }

  // ── 2. REMORTGAGE / SWITCH RATE ───────────────────────────────────────────
  if (active === 'remortgage') {
    const newRateDecimal = newRatePct / 100
    // Remaining term: from asset or fall back to current amortise payoffYears
    const remainingYears = +(asset.remainingYears ?? (amCurrent.payoffYears ?? 20))
    const remainingMonths = Math.round(remainingYears * 12)

    // New payment on new rate, same remaining term
    const r = newRateDecimal / 12
    const newMonthlyCalc = r > 0
      ? Math.round((balance * r) / (1 - Math.pow(1 + r, -remainingMonths)))
      : Math.round(balance / remainingMonths)

    const amNew = amortise(balance, newRatePct, newMonthlyCalc)

    // Lifetime interest comparison (current vs new rate, same term)
    const rCurr = rateDecimal / 12
    const currMonthlyFullTerm = (rCurr > 0 && remainingMonths > 0)
      ? Math.round((balance * rCurr) / (1 - Math.pow(1 + rCurr, -remainingMonths)))
      : monthly
    const totalIntCurrent = currMonthlyFullTerm * remainingMonths - balance
    const totalIntNew     = newMonthlyCalc * remainingMonths - balance
    const lifetimeSaving  = Math.round(totalIntCurrent - totalIntNew)

    // Monthly saving (positive = cheaper)
    const monthlySaving   = Math.round(currMonthlyFullTerm - newMonthlyCalc)

    // Fix expiry flag
    const fixYear = meta.fixYear ? +meta.fixYear : null
    const currentYear = 2026
    const monthsToFix = fixYear ? (fixYear - currentYear) * 12 : null
    const nearWindow  = monthsToFix != null && monthsToFix <= 24

    askQ = `If I remortgaged ${name} from ${pct(rateDecimal)} to ${pct(newRateDecimal)} (indicative), what would my new monthly payment be, and is now the right window?`
    planLabel = `Remortgage ${name} at ~${pct(newRateDecimal)}`
    planSummary = `~${gbp(monthlySaving)}/mo${monthlySaving > 0 ? ' cheaper' : ' dearer'}; saves ~${gbp(lifetimeSaving)} over remaining term`
    planDeltas = []   // remortgage doesn't move cash now; it changes the rate going forward

    body = (<>
      {nearWindow && (
        <div style={{
          marginBottom: 10, padding: '8px 10px', borderRadius: 10,
          background: 'color-mix(in srgb, var(--c-acc) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-acc) 30%, transparent)',
          fontSize: 11, color: 'var(--c-acc)', lineHeight: 1.45,
        }}>
          Your fix ends {meta.rateType || `around ${fixYear}`} — within the 24-month window where starting a remortgage search now makes sense. Most offers are valid 3–6 months.
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-text2)', marginBottom: 4 }}>
          <span>New indicative rate</span>
          <span style={{ fontWeight: 800, color: 'var(--c-text)' }}>{newRatePct.toFixed(2)}%</span>
        </div>
        <input
          type="range" min={2.0} max={10.0} step={0.05}
          value={newRatePct}
          onChange={e => { setNewRatePct(+e.target.value); setSaved(null) }}
          style={{ width: '100%', accentColor: 'var(--c-acc)', marginBottom: 2 }}
        />
        <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
          UK residential fix range Apr 2026: 4.1–5.4% · BTL higher · SVR avg 8.1%
          (source: remortgagesaver.com Apr 2026) — indicative only; a broker quotes your deal
        </div>
      </div>

      <Row label={`Current rate (${pct(rateDecimal)})`} value={`${gbp(currMonthlyFullTerm)}/mo`} />
      <Row label={`New rate (~${pct(newRateDecimal)}) · same term`} value={`${gbp(newMonthlyCalc)}/mo`} tone={monthlySaving >= 0 ? 'good' : 'bad'} />
      <Row label="Monthly saving" value={`${monthlySaving >= 0 ? '' : '−'}${gbp(Math.abs(monthlySaving))}/mo`} tone={monthlySaving >= 0 ? 'good' : 'bad'} strong />
      <Row label="Lifetime interest saving" value={`~${gbp(lifetimeSaving)}`} tone={lifetimeSaving >= 0 ? 'good' : 'bad'} />
      <Row label="Remaining term" value={`${remainingYears.toFixed(1)} yr`} />

      {meta.isBTL && (
        <Note>BTL S24 note: remortgaging changes your monthly interest — under Section 24 (ENACTED 2020/21), higher-rate landlords get only a 20% basic-rate tax credit on finance costs. A lower rate reduces interest paid, which reduces the credit too — but net tax position improves if income stays fixed. Source: salarytax.uk May 2026.</Note>
      )}
      {!meta.isBTL && (
        <Note>Residential mortgage interest is not deductible for personal use. The saving here is purely the cash-flow and lifetime cost difference. Remortgaging isn't a disposal — no CGT applies.</Note>
      )}
    </>)
  }

  // ── 3. SWITCH RATE-TYPE ───────────────────────────────────────────────────
  if (active === 'switch-rate') {
    const currentlyFixed    = meta.isFixed
    const indicativeFixRate = indicativeRemortgageRate(meta, rateDecimal)
    const indicativeSVR     = 0.0811  // avg SVR Apr 2026 (remortgagesaver.com)

    askQ = `Should I switch ${name} from ${currentlyFixed ? 'fixed' : 'variable'} to ${currentlyFixed ? 'variable / tracker' : 'a fixed rate'}? What are the certainty vs cost trade-offs?`
    planLabel   = `Switch ${name} to ${currentlyFixed ? 'variable/tracker' : 'fixed'}`
    planSummary = 'Rate-type switch modelled — no immediate cash change'
    planDeltas  = []

    body = (<>
      <Row label="Your current rate" value={`${pct(rateDecimal)} (${currentlyFixed ? 'fixed' : 'variable/SVR'})`} />
      {currentlyFixed ? (<>
        <Row label="If switched to tracker" value={`BoE base + spread · ~${(4.50 + 0.74).toFixed(2)}% today (70% LTV ex.)`} tone="warn" />
        <Row label="SVR average (Apr 2026)" value="~8.1% — worst case if not re-fixing" tone="bad" />
        <Note>Fixed gives payment certainty for the term — useful if rates rise. Switching to a tracker or SVR lowers cost today if rates fall, but your payment moves with the base rate. Your fix ends {meta.fixYear || 'at a specified date'}: after that, you revert to SVR (~8.1%) unless you remortgage. Source: remortgagesaver.com Apr 2026.</Note>
      </>) : (<>
        <Row label="If switched to 5-yr fix (~)" value={`~${pct(indicativeFixRate)} indicative`} tone="good" />
        <Row label="Certainty gained" value="Payment locked for 5 years" tone="good" />
        <Note>Moving from variable to a fix locks your payment — useful protection if rates rise. The cost is losing benefit if rates fall. Typical 5-year fixes at 75% LTV run ~4.2–4.5% today; best-buy 60% LTV from 4.09% (remortgagesaver.com Apr 2026). A fee-vs-rate trade-off is worth modelling with a broker.</Note>
      </>)}
      <Note>No cash changes hands on a rate-type switch — this is a structural decision. Explore the numbers with Sonu or a whole-of-market broker before acting.</Note>
    </>)
  }

  // ── 4. CONSOLIDATE (unsecured only) ───────────────────────────────────────
  if (active === 'consolidate') {
    // Blended rate: this loan vs a hypothetical lower personal-loan rate
    // Personal loan best-buy Apr 2026: ~5.6% for £7.5–25k (bestmortgagesforyou.co.uk Mar 2026)
    const consolidationRate  = 0.064  // conservative mid-market personal loan rate Apr 2026
    const annualInterestNow  = balance * rateDecimal
    const annualInterestNew  = balance * consolidationRate
    const annualSaving       = Math.round(annualInterestNow - annualInterestNew)
    const isHighAPR          = rateDecimal >= 0.15   // card/overdraft territory

    // Secured-on-home consolidation warning
    const couldSecure = true   // always possible to ask; show the risk regardless

    askQ = `If I consolidated ${name} (${pct(rateDecimal)}) into a lower-rate loan, how much interest would I save — and what are the risks if it's secured against my home?`
    planLabel   = `Consolidate ${name}`
    planSummary = `~${gbp(annualSaving)}/yr saving if rate falls to ~${pct(consolidationRate)}`
    planDeltas  = []  // consolidation switches one debt for another; no net cash move now

    body = (<>
      <Row label="Current rate" value={pct(rateDecimal)} tone={isHighAPR ? 'bad' : 'warn'} />
      <Row label="Indicative personal-loan rate (~)" value={`~${pct(consolidationRate)}`} />
      <Row label="Balance to consolidate" value={gbp(balance)} />
      <Row label="Annual interest now" value={gbp(annualInterestNow)} tone="bad" />
      <Row label="Annual interest at new rate" value={gbp(annualInterestNew)} tone="good" />
      <Row label="Annual saving" value={`~${gbp(annualSaving)}`} tone="good" strong />

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10,
        background: 'color-mix(in srgb, var(--c-coral,#FF6F7D) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--c-coral,#FF6F7D) 30%, transparent)',
        fontSize: 11, color: 'var(--c-coral,#FF6F7D)', lineHeight: 1.5,
      }}>
        ⚠ Risk: if a consolidation loan is secured against your home (e.g. a further
        advance on a mortgage), you are converting unsecured debt into a debt backed
        by your property. Miss payments → your home is at risk. The term may also
        extend significantly, meaning you pay less per month but more total interest
        over time. This is a trade-off, not a recommendation.
      </div>

      <Note>
        Rate comparison: UK credit cards avg ~21.6% effective interest rate (Bank of England Mar 2026);
        personal loans from ~5.6% for £7.5k+ (bestmortgagesforyou.co.uk Mar 2026).
        Consolidation into a personal loan (unsecured) does NOT put your home at risk;
        a further advance on a mortgage does. Check which product applies before acting.
        Indicative rate only — your actual rate depends on credit profile.
      </Note>
    </>)
  }

  // ── 5. TIME TO PAY (HMRC only) ─────────────────────────────────────────────
  if (active === 'time-to-pay') {
    const months = 12
    const principalPerMonth = Math.round(balance / months)
    // Interest accrues on the declining balance — approx with the average balance.
    const interestOverPlan = Math.round((balance / 2) * rateDecimal)
    const monthlyApprox = principalPerMonth + Math.round(interestOverPlan / months)

    askQ = `If I set up an HMRC Time to Pay arrangement on my ${gbp(balance)} Self Assessment bill over ${months} months, what would the monthly instalment and total interest be?`
    planLabel = `HMRC Time to Pay — ${gbp(balance)} over ${months} mo`
    planSummary = `~${gbp(monthlyApprox)}/mo; ~${gbp(interestOverPlan)} interest over the plan`
    planDeltas = []

    body = (<>
      <Row label="Outstanding to HMRC" value={gbp(balance)} tone="bad" />
      <Row label="Late-payment interest rate" value={pct(rateDecimal)} tone="warn" />
      <Row label={`Instalment (~${months} mo)`} value={`~${gbp(monthlyApprox)}/mo`} strong />
      <Row label="Approx interest over the plan" value={`~${gbp(interestOverPlan)}`} tone="warn" />
      <Note>HMRC charges late-payment interest at the Bank of England base rate + 4 percentage points (raised from base + 2.5% in April 2025) — it accrues on the outstanding balance until cleared. A Time to Pay arrangement spreads a Self Assessment bill, typically over up to 12 months, and can be set up online if you owe under £30,000 and your returns are filed. Interest still applies, so clearing sooner costs less. General information — arrange directly with HMRC.</Note>
    </>)
  }

  // ── GENERIC INFO BODY — any taxonomy verb without a bespoke maths body ────
  // (clear-before-fees, voluntary-termination, do-nothing-written-off,
  //  equity-release-review, staircase, s455-repay, seek-debt-advice,
  //  balance-transfer, formalise, reduce-poa, port). Info/guidance only.
  if (!RICH_VERBS.has(active)) {
    const entry = classifyLiability(asset.type)
    const intro = VERB_INTRO[active] || 'General information about this option.'
    askQ = `Tell me more about the "${DECISION_LABELS[active] || active}" option for ${name}.`
    planLabel = `${DECISION_LABELS[active] || active} — ${name}`
    planSummary = intro.length > 90 ? intro.slice(0, 88) + '…' : intro
    planDeltas = (active === 'clear-before-fees' && balance > 0 && surplusCash >= balance)
      ? [{ category: 'cash', deltaNow: -balance }]
      : []

    body = (<>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 10 }}>
        {intro}
      </div>
      {balance > 0 && <Row label="Outstanding balance" value={gbp(balance)} tone={meta.isHMRC || rateDecimal >= 0.15 ? 'bad' : 'neutral'} />}
      {rateDecimal > 0 && <Row label="Interest rate" value={pct(rateDecimal)} tone={rateDecimal >= 0.15 ? 'bad' : 'warn'} />}
      {monthly > 0 && <Row label="Current payment" value={`${gbp(monthly)}/mo`} />}
      {entry.taxNote && (
        <Note>{entry.taxNote}</Note>
      )}
      {entry.riskFlags?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Watch for
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {entry.riskFlags.map((f, i) => (
              <li key={i} style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 3 }}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </>)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Eyebrow */}
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
        Model a decision
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        A model of your own figures and named rules — see the numbers before you act.
        Nothing here changes your records.
      </div>

      {/* Chip selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {decisions.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => { setPick(d); setSaved(null) }}
            className="sw-press"
            style={{
              padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              border: `1px solid ${active === d
                ? 'color-mix(in srgb, var(--c-acc) 45%, transparent)'
                : 'var(--c-border)'}`,
              background: active === d
                ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)'
                : 'var(--c-surface2)',
              color: active === d ? 'var(--c-acc)' : 'var(--c-text2)',
            }}
          >{DECISION_LABELS[d] || d}</button>
        ))}
      </div>

      {/* Body card */}
      <div style={{
        background: 'var(--card-bg2)', border: '1px solid var(--c-border)',
        borderRadius: 14, padding: '4px 14px 14px',
      }}>
        {body}

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fireAsk(askQ, active)}
            className="sw-press"
            style={{
              background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
              color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >⚡ Explore this with Sonu</button>

          <button
            type="button"
            onClick={() => addPlan(planLabel, planSummary, planDeltas)}
            className="sw-press"
            style={{
              background: saved === active
                ? 'color-mix(in srgb, var(--c-acc) 18%, transparent)'
                : 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: saved === active ? 'var(--c-acc)' : 'var(--c-text2)',
              borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >{saved === active ? '✓ Added to your Plan' : '+ Add to plan'}</button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>
        {BRAND.disclaimer}
      </p>
    </div>
  )
}
