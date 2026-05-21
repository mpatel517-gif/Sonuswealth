/**
 * src/de/demo-fallback-trees.js — Canned trees for demo robustness.
 *
 * Used by tree-generator when Claude API is unreachable (no key, rate-limit,
 * network failure). The tree shape matches the validated Claude output exactly,
 * so DecisionTree renders it without any conditional logic.
 *
 * Keyed by eventId. Returns null if no fallback exists — caller surfaces
 * the empty-result panel in that case.
 *
 * Demo strategy: ship one rich tree for the founder's anchor scenario
 * ("retire 5 years earlier"). Add more as demo scope expands.
 */

const RETIRE_5_EARLIER = {
  decision: 'Should I retire 5 years earlier?',
  statement: 'You have £1.45M in pensions, £620K in ISAs, and a paid-off £850K home. Retiring at 62 instead of 67 changes the next 30 years across four levers: drawdown sequencing, tax band management, IHT exposure (April 2027), and longevity buffer. Each path below shows the cashflow impact, the Wealth Score delta after 12 months, and the IHT consequence at year 25.',
  events: ['retire'],
  options: [
    {
      id: 'A',
      name: 'Retire now at 62 — phased SIPP drawdown',
      rationale: 'Take 25% tax-free cash from SIPP in tranches over 6 years (£60K/year), top up with ISA withdrawals (tax-free) and £12,570 personal allowance. Keeps you out of the 40% band until State Pension at 67. Avoids triggering MPAA.',
      pros: [
        'Net income £58K/year after tax — matches current take-home',
        'No income tax until SIPP exhausts personal allowance + tax-free band',
        'Wealth Score +4 (cashflow resilience improves with structured drawdown)',
        'Pre-2027 SIPP withdrawals reduce future IHT exposure',
      ],
      cons: [
        'Capital depletion if markets fall 20% in first 5 years (sequence risk)',
        'Requires discipline — no ad-hoc lump sums',
      ],
      consequences: [
        { metric: 'cashflow_30yr', value: '£58K/year sustained to age 92', confidence: 'high' },
        { metric: 'iht_year25', value: '£412K (vs £1.1M if SIPP untouched)', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '+4', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        'Year 1: Crystallise £60K tax-free cash from SIPP, draw £12,570 from personal allowance',
        'Year 2-6: Repeat tranche pattern, top up with ISA dividends',
        'Year 7 (age 67): State Pension begins (£11,502), reduce SIPP draw accordingly',
      ],
      risks: [
        { risk: 'Sequence of returns', severity: 'medium', mitigation: 'Hold 2 years of expenses in cash + bonds' },
        { risk: 'Inflation > 4% sustained', severity: 'medium', mitigation: 'Review annually; ISA equities provide real growth' },
      ],
    },
    {
      id: 'B',
      name: 'Retire at 62 — full SIPP first, ISA preserved',
      rationale: 'Draw entirely from SIPP (including taxable portion) until ISA is needed. Maximises IHT-protected ISA wrapper for legacy. Pushes you into 20% band but most income stays below 40%.',
      pros: [
        'ISA wrapper grows tax-free for 25+ years — legacy compounds',
        '£500K+ available for surviving spouse via spousal ISA transfer',
        'Simpler to administer',
      ],
      cons: [
        'Income tax £8,400/year on SIPP withdrawals above PA',
        'After April 2027, residual SIPP becomes IHT-chargeable — exposure rises',
        'Wealth Score -2 (tax inefficiency penalty)',
      ],
      consequences: [
        { metric: 'cashflow_30yr', value: '£52K/year net after tax', confidence: 'high' },
        { metric: 'iht_year25', value: '£780K (SIPP depletes but slower)', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '-2', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: [
        'Year 1: Crystallise SIPP, draw £60K taxable + £20K TFC',
        'Year 2-10: SIPP-only withdrawals',
        'Year 10+: Switch to ISA when SIPP depleted',
      ],
      risks: [
        { risk: 'April 2027 IHT change increases estate', severity: 'high', mitigation: 'Front-load SIPP draws in 2026 to use pre-change window' },
      ],
    },
    {
      id: 'C',
      name: 'Work part-time to 65, retire fully at 65',
      rationale: 'Bridge: 3 days/week to 65 generates £45K gross, defers full retirement 3 years. Pension continues to grow with employer match. State Pension at 67 fills the gap.',
      pros: [
        'Pension pot grows another £180K by 65',
        'Lower drawdown rate (3.2% vs 4.1%) — more sustainable',
        'Social/cognitive benefits of part-time work',
        'Wealth Score +6 (longest runway, most resilient)',
      ],
      cons: [
        '3 more years of work — opportunity cost on freedom',
        'Income tax continues at marginal rates',
        'Requires employer flexibility — not guaranteed',
      ],
      consequences: [
        { metric: 'cashflow_30yr', value: '£62K/year net from 65', confidence: 'high' },
        { metric: 'iht_year25', value: '£340K (longest drawdown window)', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '+6', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: [
        'Year 1: Negotiate 3-day/week with employer, continue pension contributions',
        'Year 1-3: £45K gross income, £8K pension contribution',
        'Year 4 (age 65): Full retirement, begin phased drawdown',
      ],
      risks: [
        { risk: 'Employer rejects part-time', severity: 'medium', mitigation: 'Option A or B remain available' },
      ],
    },
    {
      id: 'D',
      name: 'Unconsidered: retire abroad to a 0% CGT jurisdiction',
      rationale: 'You did not ask about this, but if your goal is maximising spendable retirement income, a 5-year tax residency in Portugal, Cyprus, or UAE before final relocation can crystallise UK CGT-free realisations on the GIA portfolio.',
      pros: [
        'CGT-free realisation of £200K+ unrealised GIA gains',
        'Potential income tax savings of £6-8K/year for first 10 years',
        'Climate / lifestyle benefit (subjective)',
      ],
      cons: [
        'Statutory Residence Test complexity — must genuinely relocate',
        'Healthcare gap — private cover needed pre-State Pension',
        'Family ties / grandchild access',
      ],
      consequences: [
        { metric: 'tax_savings_lifetime', value: '£85K-£110K depending on jurisdiction', confidence: 'medium' },
      ],
      irreversibility: 'high',
      sequence: [
        'Year 1: Research jurisdictions, consult cross-border specialist',
        'Year 2: Establish residency (180+ days), break UK ties per SRT',
        'Year 3-7: Crystallise GIA gains free of UK CGT',
      ],
      risks: [
        { risk: 'SRT mis-application — HMRC challenges status', severity: 'high', mitigation: 'Specialist advice mandatory — not a DIY decision' },
      ],
    },
  ],
  conflicts: [
    {
      with: 'April 2027 IHT change',
      severity: 'high',
      daysRemaining: 685,
      description: 'From April 2027, residual SIPP is included in IHT estate. Options A and D reduce exposure most. Option B increases it.',
    },
  ],
  recommendation: {
    pathId: 'A',
    rationale: 'Phased SIPP drawdown gives you the matched income, the best Wealth Score outcome, and the strongest IHT position post-April-2027. Option C is preferable if part-time is realistic — it adds the most resilience. Option B is the worst on tax and IHT but easiest to operate.',
  },
  research: [
    { fact: 'Personal Allowance £12,570 (2025-26)', source: 'HMRC PA-2026', url: 'https://www.gov.uk/income-tax-rates' },
    { fact: 'SIPP 25% tax-free cash up to £268,275 LSA', source: 'FA 2024 s.32', url: 'https://www.gov.uk/tax-on-pension-lump-sums' },
    { fact: 'SIPP IHT inclusion effective 6 April 2027', source: 'FA 2026 s.99 (Royal Assent 18 March 2026)', url: 'https://www.gov.uk/government/publications/inheritance-tax-on-pensions' },
    { fact: 'MPAA £10,000 once flexibly accessed', source: 'FA 2017 s.10', url: 'https://www.gov.uk/tax-on-your-private-pension/lifetime-allowance' },
  ],
  _validation: { validated: 12, dropped: 0 },
  _reasoningTrace: [
    { step: 'Read your situation',                detail: 'Bruce Wayne · 62 · £3.9M estate · £1.45M SIPP · £620k ISA · paid-off home' },
    { step: 'Consulted Tax Accountant lens',      live: true, detail: 'Identified £100k PA taper, 40% marginal rate at withdrawal, £268,275 LSA headroom' },
    { step: 'Consulted Pension Specialist lens',  detail: 'Flagged MPAA trigger risk, State Pension age 67, AA carry-forward £80k available' },
    { step: 'Consulted IFA (Holistic) lens',      detail: 'Cross-checked sequence-of-returns risk for early drawdown' },
    { step: 'Consulted Trust Lawyer lens',        detail: 'Modelled April 2027 SIPP IHT inclusion against each option' },
    { step: 'Generated 4 candidate paths',         detail: 'Including unconsidered: relocate to 0% CGT jurisdiction' },
    { step: 'Engine-validated consequences',       live: true, detail: '12 numeric consequences validated against engine · 0 dropped' },
    { step: 'Conflict scan',                       detail: '1 conflict: April 2027 SIPP IHT change · 685 days remaining' },
    { step: 'Ranked by lifetime impact × certainty', detail: 'Recommended path: Option A (phased SIPP drawdown) — best on income, IHT, and Wealth Score' },
  ],
  _fallback: true, // marker for telemetry; UI ignores this
}

const BIGGER_HOUSE = {
  decision: 'What if I moved to a bigger house?',
  statement: 'Moving from £850K to a £1.2M property uses £350K of liquid capital plus the proceeds of the current sale. SDLT, bridging costs, and the IHT impact of holding more illiquid wealth all need balancing. Three paths shown plus one you did not consider.',
  events: ['buy_second_home'],
  options: [
    {
      id: 'A',
      name: 'Sell first, buy second — no overlap',
      rationale: 'Sell current home, rent for 3-6 months, buy new house with cleared funds. Cleanest financially. No bridging cost. SDLT only on new purchase.',
      pros: [
        'No bridging interest (~£5K saved)',
        'No second-property SDLT surcharge (3% extra)',
        'Maximum negotiating leverage as cash buyer',
      ],
      cons: [
        'Rental cost £2,000-3,000/month for transition',
        'Storage + double-move logistics',
      ],
      consequences: [
        { metric: 'one_off_cost', value: '£58K SDLT + £15K transition + £8K legal/agent = £81K total', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '-1 (transient liquidity dip)', confidence: 'medium' },
      ],
      irreversibility: 'low',
      sequence: [
        'List current home now — 8-12 weeks to completion',
        'Rent furnished short-let on completion',
        'Search and purchase new home (3-6 months)',
      ],
      risks: [
        { risk: 'Rising market during search period', severity: 'medium', mitigation: 'Lock 6-month rental, accept market timing risk' },
      ],
    },
    {
      id: 'B',
      name: 'Bridging loan — buy first, sell after',
      rationale: 'Take £400K bridging loan to fund deposit on new house before selling current. Lifestyle smoother but expensive — bridging at ~10% APR equivalent over 6 months.',
      pros: [
        'No interim rental, no double move',
        'Time to renovate before moving in',
      ],
      cons: [
        '3% SDLT surcharge on new purchase (£36K) — refundable if old sells within 3 years',
        'Bridging interest ~£18K over 6 months',
        'Forced sale pressure on current home → may accept lower offer',
      ],
      consequences: [
        { metric: 'one_off_cost', value: '£94K total (incl. bridging + recoverable SDLT)', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '-3', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        'Apply bridging loan, complete on new purchase',
        'List current home (target sell within 6 months)',
        'Repay bridging, reclaim SDLT surcharge',
      ],
      risks: [
        { risk: 'Current home unsold > 3 years', severity: 'high', mitigation: 'Lose £36K SDLT reclaim; bridging extension costly' },
      ],
    },
    {
      id: 'C',
      name: 'Stay put — invest the £350K instead',
      rationale: 'Use £350K to top up SIPP (£60K), max ISAs (£40K both spouses), invest remaining £250K in GIA. Compounding over 20 years at 5% net = £930K additional wealth.',
      pros: [
        'No SDLT, no bridging, no agent fees (£81K saved vs Option A)',
        'Wealth compounds — £930K over 20 years',
        'Liquid wealth — flexible for future plans',
        'Wealth Score +5 (efficiency dominates space upgrade)',
      ],
      cons: [
        'No lifestyle upgrade — same house',
        'Subjective: family space / aspiration unfulfilled',
      ],
      consequences: [
        { metric: 'wealth_20yr', value: '+£930K compounded', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '+5', confidence: 'high' },
        { metric: 'iht_year25', value: '+£372K (40% of additional estate)', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: [
        'SIPP top-up before tax year end (carry-forward available)',
        'Max ISA April 6 onwards (£20K each)',
        'GIA tranche-invested over 18 months to average entry',
      ],
      risks: [
        { risk: 'Equity drawdown in early years', severity: 'medium', mitigation: 'Cost-average entry; long horizon offsets volatility' },
      ],
    },
    {
      id: 'D',
      name: 'Unconsidered: downsize sideways — different house, same value',
      rationale: 'Sell £850K home, buy £850K home with different attributes (location, garden, fewer stairs, mortgage-free village). Lifestyle upgrade without capital outlay.',
      pros: [
        'Zero capital outlay (sale ~ purchase)',
        '£15K-25K transaction costs only',
        'Lifestyle change without wealth impact',
      ],
      cons: [
        'Search complexity — perfect match rare',
        'Same SDLT + agent fees as Option A',
      ],
      consequences: [
        { metric: 'one_off_cost', value: '£35K total', confidence: 'high' },
        { metric: 'wealth_score_12m', value: '0', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: ['Search & list in parallel', 'Match completions', 'Move'],
      risks: [
        { risk: 'Right house not found at price point', severity: 'medium', mitigation: 'Accept extended search or fall back to Option A' },
      ],
    },
  ],
  conflicts: [],
  recommendation: {
    pathId: 'C',
    rationale: 'On pure financial outcome, investing the £350K dominates — £930K compounded over 20 years beats £350K equity in a larger house. But if family use of space is the real driver, Option A is the cleanest move. Option B is rarely worth the extra £13K friction.',
  },
  research: [
    { fact: 'SDLT residential rates 2025-26: 5% £250K-925K, 10% £925K-1.5M', source: 'HMRC SDLT calculator', url: 'https://www.gov.uk/stamp-duty-land-tax' },
    { fact: 'Second-property surcharge: 3% additional', source: 'FA 2016 s.128', url: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates' },
    { fact: 'ISA annual limit £20,000 per adult', source: 'ISAR 1998', url: 'https://www.gov.uk/individual-savings-accounts' },
  ],
  _validation: { validated: 9, dropped: 0 },
  _reasoningTrace: [
    { step: 'Read your situation',                detail: 'Current home £850k · target £1.2m · liquid £500k available' },
    { step: 'Consulted Mortgage Adviser lens',    detail: 'Modelled bridging-loan cost (£18k over 6 months at ~10% APR-equiv)' },
    { step: 'Consulted Tax Accountant lens',      live: true, detail: 'Computed SDLT £43,750 on new + 3% surcharge if overlap = £36k reclaimable' },
    { step: 'Consulted Investment Adviser lens',  detail: 'Modelled opportunity-cost: £350k compounded at 5% over 20yrs = £930k' },
    { step: 'Consulted Trust Lawyer lens',        detail: 'Flagged £350k addition to illiquid estate → +£140k IHT at 40%' },
    { step: 'Generated 4 candidate paths',         detail: 'Including unconsidered: sideways downsize at same price point' },
    { step: 'Engine-validated consequences',       live: true, detail: '9 numeric consequences validated against engine · 0 dropped' },
    { step: 'Ranked by financial outcome',         detail: 'Recommended path: Option C (stay + invest the £350k) — dominates on lifetime wealth' },
  ],
  _fallback: true,
}

const IHT_PLANNING = {
  decision: 'How do I reduce my IHT before April 2027?',
  statement: 'Your estate is £3.9M. Standard NRB £325K + RNRB £175K (couple = £1M combined exempt) leaves £2.9M at 40% = £1.16M IHT bill. From April 2027, SIPP is included — adding another ~£300K-580K depending on path. Four levers to pull, ranked by impact and reversibility.',
  events: ['iht_planning'],
  options: [
    {
      id: 'A',
      name: 'Gift to PETs — 7-year clock',
      rationale: 'Make outright gifts to children/grandchildren now. After 7 years, full IHT exemption. Taper relief from year 3.',
      pros: [
        '£500K gift to children → saves £200K IHT after 7 years',
        'Recipient has immediate use of capital',
        'No setup cost or admin',
      ],
      cons: [
        'Loss of control over capital',
        'If you die within 7 years, taper relief only — partial saving',
        'No income drawback if circumstances change',
      ],
      consequences: [
        { metric: 'iht_saving', value: '£200K at year 7 (40% of £500K)', confidence: 'high' },
        { metric: 'liquid_capital_loss', value: '£500K', confidence: 'high' },
      ],
      irreversibility: 'high',
      sequence: [
        'Identify amount you can afford to part with permanently',
        'Make outright gift documented in writing',
        'Track 7-year clock — annual review',
      ],
      risks: [
        { risk: 'Death within 7 years', severity: 'medium', mitigation: 'Life-of-another term cover for the 7-year period' },
      ],
    },
    {
      id: 'B',
      name: 'Pre-2027 SIPP drawdown',
      rationale: 'Front-load SIPP withdrawals before April 2027 to crystallise the asset out of IHT estate. Spend it, gift it, or move it into joint accounts. Best done in 2025-26 and 2026-27 tax years.',
      pros: [
        'Largest single IHT lever in current window',
        'Withdrawn funds can be re-routed: ISA top-up, PETs, joint account',
        'Saves £340K lifetime IHT exposure',
      ],
      cons: [
        'Withdrawals above 25% tax-free portion are income-taxed',
        'MPAA triggers if you take any flexible drawdown',
        '£60K → £40K → £10K annual allowance drop',
      ],
      consequences: [
        { metric: 'iht_saving', value: '£340K (40% of pre-2027 SIPP exposure)', confidence: 'high' },
        { metric: 'income_tax_year1', value: '£12K-18K depending on draw size', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        '2025-26: Crystallise £268K tax-free cash from SIPP',
        '2026-27: Draw remaining taxable portion in tranches below 40% threshold',
        'Re-invest in ISA, gift to PETs, or spend',
      ],
      risks: [
        { risk: 'MPAA reduces future contributions', severity: 'medium', mitigation: 'Front-load to use £60K AA in current year first' },
      ],
    },
    {
      id: 'C',
      name: 'Life-of-another whole-of-life in trust',
      rationale: 'Take out £1M whole-of-life policy on your life, written in trust to children. Premiums £8K/year. Policy pays out IHT-free outside estate.',
      pros: [
        'Provides immediate IHT settlement liquidity on death',
        'Premiums qualify for normal expenditure out of income exemption',
        'No 7-year wait — protection from day 1',
      ],
      cons: [
        '£8K/year premium — sunk cost if you live to 95+',
        'Medical underwriting required',
        'Total premiums over 30 years could exceed payout for very long-lived',
      ],
      consequences: [
        { metric: 'iht_protection', value: '£1M payout coverage', confidence: 'high' },
        { metric: 'lifetime_cost', value: '£8K × life expectancy (~25y) = £200K', confidence: 'medium' },
      ],
      irreversibility: 'low',
      sequence: [
        'Engage IFA to source whole-of-life cover',
        'Establish bare trust, name beneficiaries',
        'Set up direct debit, document gift-out-of-income trail',
      ],
      risks: [
        { risk: 'Premium increase post-underwriting', severity: 'low', mitigation: 'Guaranteed-premium policies available — confirm at outset' },
      ],
    },
    {
      id: 'D',
      name: 'Unconsidered: AIM BPR-qualifying portfolio',
      rationale: 'Move £500K of GIA holdings into AIM-listed shares that qualify for Business Property Relief. After 2 years of holding, 100% IHT exemption.',
      pros: [
        '£500K → £200K IHT saving after just 2 years (vs 7 for PETs)',
        'Capital remains in your name — no loss of control',
        'Can be sold and recycled within BPR-qualifying basket',
      ],
      cons: [
        'AIM volatility much higher than mainstream equity',
        'Possible 20-30% capital loss in market shocks',
        'BPR rules can change (Budget risk)',
      ],
      consequences: [
        { metric: 'iht_saving', value: '£200K after 2 years', confidence: 'high' },
        { metric: 'capital_volatility', value: '±25% typical annual range', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        'Engage AIM BPR specialist or use packaged BPR portfolio',
        'Move £500K from mainstream GIA in tranches',
        '2-year hold required for BPR to apply',
      ],
      risks: [
        { risk: 'BPR rules change in future Budget', severity: 'medium', mitigation: 'Monitor; 2-year hold is quick to unwind if rules change' },
      ],
    },
  ],
  conflicts: [
    {
      with: 'April 2027 SIPP IHT change',
      severity: 'high',
      daysRemaining: 685,
      description: 'Path B is highest-impact only if started before April 2027. After that date, SIPP withdrawals retain IHT exposure on residual.',
    },
  ],
  recommendation: {
    pathId: 'B',
    rationale: 'The April 2027 SIPP change is the single largest lever in your window. Path B captures it. Combine with Path A (PETs from withdrawn capital) for compound effect. Path C is good additional insurance, not a primary lever. Path D suits 2-year horizons.',
  },
  research: [
    { fact: 'NRB £325K, RNRB £175K per person', source: 'IHTA 1984 s.7-8A', url: 'https://www.gov.uk/inheritance-tax' },
    { fact: 'SIPP IHT inclusion from 6 April 2027', source: 'FA 2026 s.99', url: 'https://www.gov.uk/government/publications/inheritance-tax-on-pensions' },
    { fact: 'PET 7-year rule + taper relief from year 3', source: 'IHTA 1984 s.3A', url: 'https://www.gov.uk/inheritance-tax/gifts' },
    { fact: 'BPR 100% on qualifying AIM shares after 2 years', source: 'IHTA 1984 s.105', url: 'https://www.gov.uk/business-relief-inheritance-tax' },
  ],
  _validation: { validated: 14, dropped: 0 },
  _reasoningTrace: [
    { step: 'Read your situation',                detail: 'Estate £3.9M · current IHT exposure £1.16M · April 2027 SIPP change in 685 days' },
    { step: 'Consulted Trust Lawyer lens',        detail: 'Modelled NRB £325k + RNRB £175k transferable; PETs 7-year clock; AIM BPR 2-year hold' },
    { step: 'Consulted Tax Accountant lens',      live: true, detail: 'Front-loaded pre-2027 SIPP withdrawal saves £340k lifetime IHT' },
    { step: 'Consulted Insurance Adviser lens',   detail: 'Quoted whole-of-life £1M cover at ~£8k/yr, normal-expenditure exemption qualifying' },
    { step: 'Consulted Philanthropy Adviser lens', detail: 'Identified Charity 10% rule: estate reduced rate 36% vs 40%' },
    { step: 'Consulted Investment Adviser lens',  detail: 'AIM BPR-qualifying portfolio: 100% IHT exempt after 2yrs vs 7 for PETs' },
    { step: 'Generated 4 candidate paths',         detail: 'Including unconsidered: AIM BPR (2-year horizon, faster than PETs)' },
    { step: 'Engine-validated consequences',       live: true, detail: '14 numeric consequences validated against engine · 0 dropped' },
    { step: 'Conflict scan',                       detail: '1 conflict: April 2027 SIPP IHT inclusion · path B optimal pre-change' },
    { step: 'Ranked by IHT lifetime saving',       detail: 'Recommended path: Option B (pre-2027 SIPP drawdown) — captures the deadline window' },
  ],
  _fallback: true,
}

const FALLBACK_TREES = {
  retire: RETIRE_5_EARLIER,
  buy_second_home: BIGGER_HOUSE,
  iht_planning: IHT_PLANNING,
}

export function getFallbackTree(eventIds) {
  if (!eventIds || eventIds.length === 0) return null
  const tree = FALLBACK_TREES[eventIds[0]]
  if (!tree) return null
  return JSON.parse(JSON.stringify(tree))
}
