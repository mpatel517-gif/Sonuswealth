// ─────────────────────────────────────────────────────────────────────────────
// DebtLeaf — the per-debt detail screen. Founder 2026-06-01 (FK-1, option B):
// "keep 4 debt tiles, each drills to ITS OWN debt leaf, not the shared screen."
//
// One debt, answered fully and cleanly (the antithesis of the "What you owe"
// shambles): a labelled paydown chart (years axis, today→clear, interest-only
// honest-flat), the facts that drive a paydown decision each drillable to
// source (R13), and the debt-type context (LTV / S24 / written-off-on-death).
// All debt maths come from the single `amortise()` helper so the 470-year
// interest-only bug can't live here.
// ─────────────────────────────────────────────────────────────────────────────
import OverlayShell from '../shared/OverlayShell.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import { BRAND } from '../../config/brand.js'
import { amortise, payoffLabel, clearsYear } from './debtMath.js'
import DebtDecisions from './DebtDecisions.jsx'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString('en-GB')}`
}
// Precise figures (payments, interest) — full pounds, no £k rounding, no pennies.
function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}

function Chip({ children, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500' : tone === 'bad' ? 'var(--c-coral, #FF6F7D)' : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
      borderRadius: 100, background: `color-mix(in srgb, ${fg} 14%, transparent)`,
      color: fg, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

// Paydown chart — balance over time, labelled both axes, today divider.
// Amortising: declining curve to £0. Interest-only/no-payment: honest flat
// line with the reason. Charting standard: axes carry units, not bare lines.
function PaydownChart({ am, balance, currentYear }) {
  const W = 320, H = 130, padL = 8, padR = 8, padT = 10, padB = 18
  const flat = am.status !== 'amortising'
  // Horizon: to payoff (cap 30y) for amortising; 10y window for flat.
  const horizonMonths = flat ? 120 : Math.min(am.payoffMonths || 120, 360)
  const series = am.forward(horizonMonths + 1)
  const maxV = Math.max(balance, ...series, 1)
  const x = (i) => padL + (i / Math.max(1, series.length - 1)) * (W - padL - padR)
  const y = (v) => padT + (1 - v / maxV) * (H - padT - padB)
  const path = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const years = Math.round(horizonMonths / 12)
  // X ticks every ~quarter of the horizon
  const tickYears = [0, Math.round(years / 3), Math.round((2 * years) / 3), years].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Balance over time — ${payoffLabel(am)}`} style={{ display: 'block' }}>
        {/* y top label */}
        <text x={padL} y={padT - 1} fontSize="8" fill="var(--c-text3)">{fmt(maxV)}</text>
        {/* zero baseline */}
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="var(--c-sep)" strokeWidth="0.5" />
        <text x={padL} y={y(0) + 9} fontSize="8" fill="var(--c-text3)">£0</text>
        {/* area + line */}
        <path d={`${path} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
          fill="color-mix(in srgb, var(--c-coral, #FF6F7D) 12%, transparent)" stroke="none" />
        <path d={path} fill="none" stroke="var(--c-coral, #FF6F7D)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* x ticks (years) */}
        {tickYears.map((ty) => {
          const xi = x((ty / years) * (series.length - 1))
          return (
            <g key={ty}>
              <line x1={xi} y1={y(0)} x2={xi} y2={y(0) + 3} stroke="var(--c-text3)" strokeWidth="0.5" />
              <text x={xi} y={H - 4} fontSize="8" fill="var(--c-text3)" textAnchor="middle">
                {ty === 0 ? 'now' : `${ty}y`}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2, fontStyle: 'italic' }}>
        {flat
          ? (am.status === 'interest-only'
              ? 'Interest-only — the balance is not reducing on the current payment.'
              : 'No payment captured — add one to project when this clears.')
          : `Estimated at the current payment${currentYear ? ` · clears ~${clearsYear(am, currentYear)}` : ''}. Balance only — not adjusted for inflation.`}
      </div>
    </div>
  )
}

function FactRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{children}</span>
    </div>
  )
}

export default function DebtLeaf(props) {
  return (
    <DrillStackProvider onEdit={props._onEdit}>
      <DebtLeafInner {...props} />
    </DrillStackProvider>
  )
}

function DebtLeafInner({ debt, ltvContext, currentYear, onBack, onHome, onAddToPlan }) {
  const { pushNumber } = useDrillStackContext()
  const am = amortise(debt.balance, debt.apr, debt.monthly)

  // Adapter: DebtLeaf's `debt` shape → the `asset` shape DebtDecisions expects.
  // debt.apr is a PERCENT (24.70); DebtDecisions wants interest_rate as a DECIMAL.
  const debtAsset = {
    ...debt,
    name: debt.label,
    outstanding: debt.balance,
    interest_rate: debt.apr != null ? debt.apr / 100 : 0,
    monthly_payment: debt.monthly,
    rate_type: debt.rateType,
  }
  // Normalise underscores/hyphens before matching — fixture types are
  // 'buy_to_let_mortgage', 'student_loan_plan2' etc., so a hyphen-only regex
  // mis-classifies them (a BTL was rendering as a residential mortgage with a
  // home LTV). Founder 2026-06-01.
  const _t = `${debt.type || ''} ${debt.label || ''}`.toLowerCase().replace(/[_-]+/g, ' ')
  const isStudent = /student/.test(_t)
  const isBTL = /\bbtl\b|buy to let/.test(_t)
  const isMortgage = /mortgage/.test(_t) && !isBTL

  // ── What you can do (FCA-safe: general principles + money math, never "you
  // should [regulated action]"). The pay-down decision stays the user's. ──
  const fixYear = debt.rateType && /(\d{4})/.exec(debt.rateType)?.[1]
  const fixEndingSoon = fixYear && currentYear && (+fixYear - currentYear) <= 2 && (+fixYear - currentYear) >= 0
  // Concrete overpayment scenario — money math, not advice.
  const overpay = (() => {
    if (am.status !== 'amortising' || !(debt.monthly > 0) || am.payoffMonths == null) return null
    const extra = Math.max(50, Math.round((debt.monthly * 0.2) / 10) * 10)
    const am2 = amortise(debt.balance, debt.apr, debt.monthly + extra)
    if (am2.status !== 'amortising' || am2.payoffMonths == null) return null
    const intOld = am.payoffMonths * debt.monthly - debt.balance
    const intNew = am2.payoffMonths * (debt.monthly + extra) - debt.balance
    const yrsSooner = (am.payoffMonths - am2.payoffMonths) / 12
    if (yrsSooner < 0.25) return null
    return { extra, yrsSooner, saved: Math.max(0, intOld - intNew) }
  })()
  const options = []
  if (debt.apr != null && debt.apr >= 15) {
    options.push(`At ${debt.apr.toFixed(1)}% this is among your most expensive debt per £ owed — clearing it before lower-rate debt saves the most interest. That's money math, not a recommendation.`)
  }
  if (am.status === 'interest-only') {
    options.push('The balance isn’t reducing on the current payment. Moving to a repayment basis, or overpaying, is what starts clearing the capital — worth discussing with your lender.')
  }
  if (fixEndingSoon) {
    options.push(`Your fixed rate ends ${fixYear}. Reviewing a remortgage before it reverts to the lender’s standard variable rate is the usual way to avoid a payment jump.`)
  }
  // (Overpay is no longer a static bullet — the DebtDecisions modeller below
  // lets the user model it interactively with the £ saved + months shaved.)
  if (isStudent) {
    options.push('Because UK student loans are written off after the plan term (and on death), overpaying only pays off if you’d clear it well before then — many never do.')
  }
  const fireWhatIf = () => window.dispatchEvent(new CustomEvent('sonus:ask', {
    detail: { question: `What if I paid down my ${(debt.label || 'this debt').toLowerCase()} faster?`, context: { metric: 'liabilityWhatIf', type: debt.type, label: debt.label, balance: debt.balance, apr: debt.apr, monthly: debt.monthly, scope: 'mymoney' } },
  }))

  const balanceDrill = {
    metric: debt.label, value: `−${fmt(debt.balance)}`,
    formula: `The outstanding balance you owe on this ${(debt.label || 'debt').toLowerCase()}.`,
    source: `${debt.lender || 'Your records'} — captured balance.${debt.sourcePath ? '' : ''}`,
    confidence: 'high',
    ...(debt.sourcePath ? { editable: { path: debt.sourcePath, label: `${debt.label} balance`, currentValue: debt.balance, isCurrency: true } } : {}),
  }
  const aprDrill = {
    metric: `${debt.label} — interest rate`, value: debt.apr != null ? `${debt.apr.toFixed(2)}%` : '—',
    formula: debt.apr != null ? `The annual interest rate on this debt: ${debt.apr.toFixed(2)}%.` : 'No rate captured.',
    source: debt.rateType ? `Rate type: ${debt.rateType}.` : 'Your records.', confidence: 'high',
  }

  return (
    <OverlayShell
      title={debt.label}
      subtitle="What it costs · when it clears"
      onBack={onBack}
      onHome={onHome}
    >
      <div style={{ padding: '16px 16px 40px', maxWidth: 640, marginInline: 'auto' }}>
        {/* Hero balance + status chips */}
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <DrillableNumber {...balanceDrill} onDrill={pushNumber}>
            <span style={{ fontSize: 30, fontWeight: 850, color: 'var(--c-coral, #FF6F7D)', letterSpacing: -0.5 }}>−{fmt(debt.balance)}</span>
          </DrillableNumber>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {debt.apr != null && <Chip tone={debt.apr >= 15 ? 'bad' : 'neutral'}>{debt.apr.toFixed(2)}% APR</Chip>}
          {debt.rateType && <Chip tone="neutral">{debt.rateType}</Chip>}
          {am.status === 'interest-only' && <Chip tone="warn">Interest-only</Chip>}
          {isStudent ? <Chip tone="warn">Written off on death — not in estate</Chip> : <Chip tone="good">Estate-deductible</Chip>}
          {isBTL && <Chip tone="warn">S24 · 20% credit only</Chip>}
        </div>

        {/* Paydown chart */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            Where this is heading
          </div>
          <PaydownChart am={am} balance={debt.balance} currentYear={currentYear} />
        </div>

        {/* Facts — each drillable to source */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
          The detail
        </div>
        <div style={{ marginBottom: 18 }}>
          <FactRow label="Balance">
            <DrillableNumber {...balanceDrill} onDrill={pushNumber}>−{fmt(debt.balance)}</DrillableNumber>
          </FactRow>
          <FactRow label="Interest rate">
            <DrillableNumber {...aprDrill} onDrill={pushNumber}>{debt.apr != null ? `${debt.apr.toFixed(2)}%` : '—'}</DrillableNumber>
          </FactRow>
          <FactRow label="Monthly payment">{debt.monthly > 0 ? `${gbp(debt.monthly)}/mo` : 'Not recorded'}</FactRow>
          <FactRow label="Interest this year">{gbp(am.interestYear1)}</FactRow>
          <FactRow label="Payoff">{payoffLabel(am)}</FactRow>
          {ltvContext && (
            <FactRow label="Loan-to-value">{(ltvContext.ltv * 100).toFixed(1)}% of {fmt(ltvContext.propertyValue)}</FactRow>
          )}
        </div>

        {/* Type context — one honest sentence, no redundant tiles */}
        <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5, marginBottom: 16 }}>
          {isStudent && 'UK student loans are written off on death, so this debt does not reduce your estate for inheritance tax. Repayment is income-contingent, not a fixed term.'}
          {isBTL && 'On a buy-to-let, mortgage interest no longer offsets rental income fully — you get a 20% tax credit instead (Section 24). Interest-only is common, so the balance may not fall until you sell or remortgage.'}
          {isMortgage && 'A residential mortgage is a real debt that reduces your estate. A fix ending within ~24 months is the trigger to start remortgage planning.'}
          {!isStudent && !isBTL && !isMortgage && 'This is a real debt that reduces your estate for inheritance tax.'}
        </div>

        {/* Good to know — FCA-safe context the modeller doesn't compute
            (priority of high-APR debt, interest-only, fix window, student-loan
            write-off). The interactive decisions live below. */}
        {options.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
              Good to know
            </div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((o, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--c-acc)', flexShrink: 0 }}>→</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Interactive decision modeller — overpay (with £ saved + months
            shaved), remortgage, switch rate-type, consolidate. Each fires
            Explore-with-Sonu + Add-to-plan. Founder 2026-06-01: buttons must DO
            something. */}
        {/* DebtDecisions renders its own FCA disclaimer — no second one here. */}
        <DebtDecisions asset={debtAsset} onAddToPlan={onAddToPlan} />
      </div>
    </OverlayShell>
  )
}
