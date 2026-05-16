// ─────────────────────────────────────────────────────────────────────────────
// Explainer.jsx — ⓘ chip registry (X23)
// Spec: §Q5 X23 Registry across all tabs (home §Q5 holds canonical copy).
//
// Single source of truth for every "what is …" explainer surfaced via a small
// ⓘ chip. Tapping the chip opens a bottom sheet with the registry entry.
//
// Exports:
//   ExplainerChip   default-named export — <ExplainerChip id="HOME-1" />
//   EXPLAINERS      registry object (id → entry)
//
// Each registry entry: { title, body, ctaLabel?, ctaTarget? }
// ctaTarget is opaque — consumer wires it to navigation.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { BRAND } from '../../config/brand.js'

export const EXPLAINERS = {
  // ── Home ────────────────────────────────────────────────────────────────
  'HOME-1': {
    title: `What is the ${BRAND.scoreShort}?`,
    body: `Your ${BRAND.scoreFull} (0–100) reflects 8 dimensions of financial health, weighted to your life stage. It updates every time your data does. Higher = stronger structural footing. The score is descriptive, not prescriptive — we surface the gaps; you decide what to act on.`,
    ctaLabel: 'See breakdown',
    ctaTarget: 'fq-breakdown',
  },
  'HOME-2': {
    title: `What is the ${BRAND.riskScoreShort}?`,
    body: `Your ${BRAND.riskScore} (0–100) measures how resilient your finances are to shocks — illness, job loss, market crashes, family events. It blends 7 risk dimensions with your observed behaviour. Higher = more protected.`,
    ctaLabel: 'See risk dimensions',
    ctaTarget: 'risk-overlay',
  },
  'HOME-3': {
    title: 'What is Cost of Inaction?',
    body: 'Cost of Inaction (CoI) is the cumulative drag from decisions you have not yet made — uncrystallised allowances, sub-optimal wrappers, gaps in cover. We surface the running total so the cost of waiting is visible. CoI ticks up daily until you act.',
    ctaLabel: 'Open CoI breakdown',
    ctaTarget: 'coi-detail',
  },
  'HOME-SJ-1': {
    title: 'About Score Journey',
    body: 'Score Journey shows your Wealth Score over time, with milestones and intervention points marked. Plan-mode overlays your target trajectory; Forecast-mode overlays a no-action projection. Useful for one-glance answer to "am I trending up or down".',
  },

  // ── MyMoney ─────────────────────────────────────────────────────────────
  'MM-1': {
    title: `What is ${BRAND.netWorth}?`,
    body: 'Net Worth is everything you own minus everything you owe. We compute it from your linked accounts, manually-entered assets, and liabilities. Wrappers (ISA / SIPP / GIA) are summed at gross value; mortgage and other debts are subtracted at outstanding balance.',
  },
  'MM-2': {
    title: 'Wrappers explained',
    body: 'A wrapper is the tax-efficient envelope your money sits inside. ISA: tax-free growth and withdrawal, £20k annual allowance. SIPP: tax-relieved contributions, taxed on the way out, age-55 access. GIA: no shelter, but no contribution cap. We optimise placement so your highest-growth assets sit inside the most tax-efficient wrappers.',
  },
  'MM-PPR': {
    title: 'No capital gains tax on selling your main home',
    body: 'When you sell your main home (the one you actually lived in), the profit is tax-free. If you were away from it for periods, you get partial relief. The last 9 months of ownership always count as "lived in". Important: you can only have one home count as your main residence at a time — if you own more than one, you choose which gets this relief. (Technical name: Principal Private Residence relief.)',
  },
  'MM-BPR': {
    title: 'Inheritance-tax shelter for trading businesses',
    body: 'Shares in a trading company you own (and similar trading assets) can pass to your heirs free of inheritance tax. From April 2026: 100% relief on the first £1m of combined business + farming assets, 50% above that. AIM shares now only get 50% relief (used to be 100%). You need to have held the asset for 2 years before death for the relief to apply. (Technical name: Business Property Relief.)',
  },
  'MM-ANI': {
    title: 'The income figure HMRC actually uses to tax you',
    body: 'Your total earnings minus pension contributions and Gift Aid donations. This is the number HMRC uses to decide: whether your tax-free slice of income starts to shrink (over £100,000), whether some of your child benefit is clawed back (over £60,000), whether you qualify for the marriage allowance, and which student-loan repayment band you sit in. Paying more into your pension reduces this figure £-for-£ and can be one of the most powerful tax moves available. (Technical name: Adjusted Net Income.)',
  },
  'MM-SIPP': {
    title: 'A personal pension where you choose the investments',
    body: 'A flexible pension you set up yourself, with broad investment choice (shares, funds, bonds, commercial property, cash). Money you pay in gets tax back at your normal rate. You can access it from age 55 (rising to 57 from April 2028). When you start drawing, the first 25% is tax-free. The rest is taxed as income. From April 2027, any pension pot you haven\'t used falls into your estate for inheritance tax. (Technical name: Self-Invested Personal Pension.)',
  },
  'MM-S24': {
    title: 'Why mortgage interest barely counts against rental income now',
    body: 'Since April 2020, landlords of residential property cannot deduct mortgage interest fully from rental income. Instead you get a small fixed rebate (20% of interest paid) back at tax-return time. The result: higher-rate (40%) and additional-rate (45%) landlords pay a lot more income tax than they used to. Does not apply to commercial property. The single biggest reason buy-to-let yields look worse than before. (Technical name: Section 24.)',
  },
  'MM-RNRB': {
    title: 'Extra inheritance allowance when you pass your home to children',
    body: 'An extra slice of your estate (up to £175,000) that is free of inheritance tax — but only when your main home passes to direct descendants (children, grandchildren, step- and adopted included). On top of the normal £325,000 allowance, a married couple can pass up to £1m before any inheritance tax. Reduces by £1 for every £2 your estate is over £2m. Unused portion transfers to a surviving spouse. (Technical name: Residence Nil-Rate Band.)',
  },
  'MM-AA': {
    title: 'How much you can pay into pensions each tax year',
    body: 'You can pay in up to £60,000 a year (or 100% of your earnings, whichever is lower) and still get tax back. The cap reduces if your total income goes above £260,000, dropping to a floor of £10,000 at £360,000+. If you have not used the full amount in any of the last three years, the unused portion carries forward. Once you start taking taxable income from a personal pension, the cap drops permanently to £10,000 — see "The reduced pay-in cap". (Technical name: Annual Allowance.)',
  },
  'MM-BADR': {
    title: 'Lower capital gains tax when you sell a business',
    body: 'A reduced CGT rate when you sell a business you ran. From April 2026: 18% instead of the usual 24% (up from 14% in 2025/26). Lifetime cap of £1m of gains. You qualify if: you own 5%+ of the company\'s ordinary shares and voting rights, you are an officer or employee, and you have held it for 2+ years. The 5% test is strict — preference shares and some growth shares can fail it. (Technical name: Business Asset Disposal Relief. Used to be called Entrepreneurs\' Relief.)',
  },
  'MM-PA': {
    title: 'The slice of your income that is tax-free',
    body: 'The first £12,570 you earn each tax year is free of income tax. It shrinks by £1 for every £2 you earn above £100,000 and disappears entirely at £125,140. Paying into a pension (or Gift Aid) reduces your taxable income £-for-£ and can restore the allowance if you sit in that range — which means a 60% effective rate of tax back in that band. (Technical name: Personal Allowance.)',
  },
  'MM-AEA': {
    title: 'The capital gains you can take each year tax-free',
    body: 'You can realise £3,000 of gains each tax year before any capital gains tax applies. Down from £6,000 the year before, and £12,300 before that. Above this, gains are taxed at 18% (in the basic-rate band) or 24% (higher / additional). It does not carry forward — use it or lose it. The classic moves: selling and immediately re-buying inside an ISA ("bed-and-ISA"), or gifting between spouses to use both allowances. (Technical name: Annual Exempt Amount.)',
  },
  'MM-PSA': {
    title: 'Tax-free interest each year',
    body: 'You can earn some interest on savings tax-free each year: £1,000 if you pay basic-rate tax, £500 if you pay higher-rate, £0 if you pay additional-rate. There is also a separate £5,000 "starting rate" band at 0% if your other income is low. Applies to interest from banks, building societies, peer-to-peer lending, and most bonds. Doesn\'t apply inside an ISA because that is already tax-free. (Technical name: Personal Savings Allowance.)',
  },
  'MM-APS': {
    title: 'A surviving spouse can inherit the deceased spouse\'s ISA allowance',
    body: 'A one-off boost to a surviving spouse\'s ISA allowance, equal to the value of the deceased spouse\'s ISA at death (or at closure, if higher). On top of the normal £20,000 cap. Available whether or not the spouse actually inherits the ISA assets. Time-limited: three years from death (or 180 days from administration completion, whichever is longer). The mechanism that keeps an ISA tax shelter intact through a death. (Technical name: Additional Permitted Subscription.)',
  },
  'MM-MPAA': {
    title: 'The reduced pay-in cap (after drawdown)',
    body: 'Once you start taking taxable income from a personal pension, the most you can pay into pensions each year drops permanently from £60,000 to £10,000. Important: it cannot be reversed. The drop only happens if you take taxable income — taking just the 25% tax-free cash on its own does not trigger it. If you are still working and contributing, model this carefully before any first withdrawal. (Technical name: Money Purchase Annual Allowance, or MPAA.)',
  },
  'MM-LSA': {
    title: 'How much tax-free cash you can take in your lifetime',
    body: 'Across all your pensions combined, you can take £268,275 of tax-free cash over your lifetime. Once you have used that up, any further "tax-free" portion of a withdrawal is taxed at your normal income tax rate. Separate from how much you can pay in. (Technical name: Lump Sum Allowance, or LSA.)',
  },
  'MM-LSDBA': {
    title: 'How much tax-free cash you AND your family can take in total',
    body: 'A bigger £1,073,100 cap that adds together: the tax-free cash you took while alive, plus any tax-free lump sums paid to your family when you die. Once breached, the excess is taxed at the recipient\'s normal income tax rate. (Technical name: Lump Sum & Death Benefit Allowance, or LSDBA.)',
  },
  'MM-PCLS': {
    title: 'The 25% tax-free cash you can take when you first access a pension',
    body: 'When you first start drawing from a personal pension, you can normally take up to 25% of the pot tax-free. Capped at the lifetime tax-free cash limit (£268,275). Can be taken all at once or in slices alongside taxable income. (Technical name: Pension Commencement Lump Sum, or PCLS.)',
  },
  'MM-CARRY-FWD': {
    title: 'Unused pension room rolled over from prior years',
    body: 'If you have not used your full pay-in cap in any of the last three tax years, the unused amount carries forward and adds to this year\'s £60,000. Only available if you were already a pension member in those years (even with zero contributions). You also can\'t pay in more than what you actually earned this year. The biggest single lever for high earners catching up.',
  },
  'MM-DB': {
    title: 'A pension that pays a fixed income for life (final-salary)',
    body: 'A pension your employer set up that promises you a specific income at retirement — calculated from your salary and years of service. It is not a pot you draw down; it is an income for life that the scheme pays you. Income is taxed as earnings. On death, a spouse pension is usually paid (typically untaxed in many schemes). You can transfer out, but the scheme has to give you a cash value, and regulated advice is required if that value is above £30,000.',
  },
  'MM-WORKPLACE-DC': {
    title: 'A pension your employer set up that builds a pot',
    body: 'A scheme set up by your employer where you and the employer pay in. The money is invested and the size of the pot at retirement depends on contributions plus growth. Tax relief on contributions works the same as a personal pension. Same rules apply for taking 25% tax-free, and for taking income. Usually a more limited fund choice than a personal pension, but lower charges.',
  },
  'MM-NOMINATION': {
    title: 'Who inherits your pension if you die',
    body: 'A formal instruction telling your pension scheme who should receive the pot if you die. The trustees do not have to follow it, but almost always do. Without a current instruction, the trustees decide — and the pot is more likely to end up in your estate and be taxed for inheritance tax (especially from April 2027 onwards). Review whenever something big changes — marriage, divorce, a new child — or every three years as a routine check.',
  },
  'MM-DRAWDOWN': {
    title: 'Leaving the pension invested and taking income as you need it',
    body: 'Instead of buying a guaranteed income (annuity), you keep the pot invested and withdraw income each year. More flexible, but you carry the risk of the pot running out if you live longer than expected. The first taxable withdrawal triggers the reduced pay-in cap permanently — see "The reduced pay-in cap (after drawdown)".',
  },
  'MM-GLIDE-PATH': {
    title: 'A pension fund that gets safer as you approach retirement',
    body: 'A default investment strategy that automatically moves your money from higher-risk investments (shares) to safer ones (bonds, cash) as you get closer to a target retirement date. Designed so you do not have to manage it. Trade-off: it protects you from a big stock-market fall right before retirement, but it gives up some growth in exchange. Many of these still assume you will buy an annuity at age 65 — worth checking yours if you plan to keep investing in retirement. (Technical name: lifestyle or glide-path investing.)',
  },
  'MM-GUYTON-KLINGER': {
    title: 'Taking a flexible income that adjusts with markets',
    body: 'A way to withdraw from your pension where the amount you take adjusts each year based on how investments are doing. Start at around 5% of the pot. In years markets do well, you take a small increase. In years markets fall, you take a small cut (often around 10% less). Why it matters: your pot is more likely to last 10–20 years longer than taking a fixed amount each year — but in some years your income will drop. Suits people who can absorb a temporary income cut without it derailing their life. (Technical name: Guyton-Klinger guardrails.)',
  },

  // ── Cashflow ────────────────────────────────────────────────────────────
  'CF-1': {
    title: 'Cashflow Health Score',
    body: 'A 0–100 score blending three signals: surplus volatility (how steady is your monthly surplus), savings rate (% of income saved), and runway (months of cash buffer). Higher = more stable cashflow.',
  },
  'CF-2': {
    title: 'Funded Ratio',
    body: 'Funded Ratio is your investable assets divided by your retirement target × 25 (the 4% rule horizon). 100% = on track for full financial independence at your target retirement age. We project this forward using your current contribution rate.',
  },

  // ── Tax & Estate ────────────────────────────────────────────────────────
  'TE-1': {
    title: 'About IHT today vs after 2027',
    body: 'Inheritance Tax rules change on 6 April 2027 — pension wrappers become IHT-eligible (Finance Act 2026, Royal Assent 18 March 2026). We show your IHT liability under both regimes so the cost of inaction across the rule change is visible. Estate planning gets harder after 2027 — early action compounds.',
  },
  'TE-2': {
    title: 'Gift clock and 7-year rule',
    body: 'Gifts to individuals fall outside your estate for IHT purposes if you survive 7 years from the gift date. Between years 3 and 7, the IHT charge tapers. We track each gift\'s clock and surface the accumulating shield as years pass.',
  },

  // ── Risk ────────────────────────────────────────────────────────────────
  'RISK-1': {
    title: 'Risk Score components',
    body: 'Seven dimensions: Income Protection, Life Cover, Critical Illness, Emergency Fund, Disability cover, Concentration Risk, and Behavioural Track Record. Each is scored 0–100; the headline blends them weighted by your dependents and lifestyle.',
  },
  'RISK-2': {
    title: 'Financial Profile cross-map',
    body: 'A 5×5 grid plotting your Wealth Score band against your Risk Score band. 25 cells, each with a name and an implication. Top-right = exceptional + resilient (the ideal). The grid makes structural × resilience trade-offs visible at a glance.',
  },

  // ── Timeline ────────────────────────────────────────────────────────────
  'TL-1': {
    title: 'Score Journey explained',
    body: 'Your Wealth and Risk Scores plotted over time, with key events marked: contributions, withdrawals, plan changes, life events. Tap any point to see the score breakdown on that date.',
  },

  // ── Ask (AI layer) ──────────────────────────────────────────────────────
  'ASK-1': {
    title: `What ${BRAND.name} can and can't do`,
    body: `${BRAND.name} surfaces facts about your money: balances, projections, gaps, the cost of waiting. It does not give regulated financial advice. For decisions that touch tax, pensions, or estate, verify with a qualified UK adviser. We will tell you what is true; you decide what to do.`,
  },
}

// ──────────────────────────────────────────────────────────────────────────────
// ExplainerChip — small ⓘ button that opens a bottom sheet with the entry
// ──────────────────────────────────────────────────────────────────────────────
export default function ExplainerChip({ id, size = 16, onCta }) {
  const [open, setOpen] = useState(false)
  const entry = EXPLAINERS[id]
  if (!entry) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={entry.title}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text3)',
          fontSize: Math.max(9, size - 6),
          fontWeight: 700,
          fontFamily: 'serif',
          fontStyle: 'italic',
          cursor: 'pointer',
          padding: 0, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          verticalAlign: 'middle',
        }}
      >
        i
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <div style={{
            fontSize: 'var(--fs-title)', fontWeight: 800,
            color: 'var(--c-text)', marginBottom: 10, lineHeight: 1.25,
          }}>
            {entry.title}
          </div>
          <div style={{
            fontSize: 'var(--fs-body)', color: 'var(--c-text2)',
            lineHeight: 1.55, marginBottom: 18,
          }}>
            {entry.body}
          </div>
          {entry.ctaLabel && (
            <button
              onClick={() => { onCta?.(entry.ctaTarget); setOpen(false) }}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--c-acc)',
                color: 'var(--c-on-accent, #0B1F3A)',
                border: 'none', borderRadius: 12,
                fontSize: 'var(--fs-body)', fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              {entry.ctaLabel}
            </button>
          )}
          <div style={{
            fontSize: 'var(--fs-label)', color: 'var(--c-text3)',
            lineHeight: 1.55, textAlign: 'center', paddingTop: 10,
            borderTop: '1px solid var(--c-sep)',
          }}>
            {BRAND.disclaimer}
          </div>
        </Sheet>
      )}
    </>
  )
}

// Local lightweight bottom-sheet — same visual contract as `.sheet-panel`
// in index.css but self-contained so the registry has zero coupling outside
// of brand strings.
function Sheet({ children, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680,
          background: 'var(--c-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 28px',
          maxHeight: '78vh', overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{
          width: 36, height: 5, borderRadius: 3,
          background: 'var(--c-sep)', margin: '0 auto 16px',
        }} />
        {children}
      </div>
    </div>
  )
}

export { ExplainerChip }
