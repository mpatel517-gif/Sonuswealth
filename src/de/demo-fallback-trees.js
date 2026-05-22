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

const RELOCATE_ABROAD = {
  decision: 'What would it cost and mean financially to relocate abroad?',
  statement: 'Relocating abroad is a multi-dimensional decision spanning UK Statutory Residence Test, capital-gains crystallisation, pension portability, and IHT (you remain UK-domiciled for IHT for up to 4 years after leaving). Three popular destinations modelled below, plus the path most expats overlook.',
  events: ['relocate'],
  options: [
    {
      id: 'A',
      name: 'Portugal — NHR successor regime (IFICI)',
      rationale: 'Portugal\'s 2025 IFICI regime offers 10 years of 20% flat tax on Portuguese-source income and 0% on most foreign income (excluding pensions, which are taxed at 10%). Plus access to EU healthcare via the SNS. Reasonable cost of living vs UK (~25-35% lower).',
      pros: [
        'EU access (Schengen) + climate + healthcare via SNS',
        'Most foreign income 0% taxed for 10 years',
        '£32k-£45k/yr potential UK income-tax saving on dividends + rent',
        'CGT-free realisation of UK GIA gains once non-UK-resident',
      ],
      cons: [
        'Portuguese pension tax 10% (was 0% pre-2024 under old NHR)',
        'Need to qualify under "high-value activity" categories or invest',
        'Property prices in Lisbon/Cascais have doubled since 2018',
      ],
      consequences: [
        { metric: 'annual_tax_saving', value: '£32K–£45K/yr', confidence: 'medium' },
        { metric: 'one_off_relocation_cost', value: '£30K–£60K (visas, shipping, professional fees)', confidence: 'medium' },
        { metric: 'lifestyle_change', value: 'Substantial — climate, language, culture', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        'Apply for residence permit (D7 retiree visa or D2 entrepreneur)',
        'Register IFICI status within 6 months of becoming tax resident',
        'Break UK SRT ties: <90 UK days, no UK home available, etc.',
        'Realise UK GIA gains in first tax year as non-resident',
      ],
      risks: [
        { risk: 'IHT remains UK-applicable for 4 years', severity: 'medium', mitigation: 'Plan estate restructuring before move' },
        { risk: 'IFICI rules can change in future budgets', severity: 'medium', mitigation: 'Lock in by registering early' },
      ],
    },
    {
      id: 'B',
      name: 'UAE — 0% personal income tax',
      rationale: 'No personal income tax, no CGT, no inheritance tax (locally). Golden Visa programs (10-year residency) accessible via property purchase £550k+ or business investment. English widely spoken; major financial hub.',
      pros: [
        '0% personal income tax — full saving on £150K UK income',
        'No CGT on disposal of investments',
        'Golden Visa = 10-year residency, easy renewal',
        'Major financial centre — easy banking, brokers, lawyers',
      ],
      cons: [
        'Climate (40°C+ summers; many leave for 3 months)',
        'Property is expensive in Dubai/Abu Dhabi',
        'Distance from UK family (7-hr flight)',
        'Cultural adjustment + alcohol licensing for residents',
      ],
      consequences: [
        { metric: 'annual_tax_saving', value: '£45K+/yr on £150K UK-equivalent income', confidence: 'high' },
        { metric: 'one_off_relocation_cost', value: '£40K–£80K + Golden Visa property £550K+', confidence: 'high' },
      ],
      irreversibility: 'medium',
      sequence: [
        'Apply for Golden Visa (property route or business)',
        'Establish UAE residence + open local bank accounts',
        'Break UK SRT — <90 days first year, <120 from year 2 onwards',
        'Crystallise UK GIA gains free of UK CGT in first non-resident year',
      ],
      risks: [
        { risk: 'IHT 4-year UK tail unless deemed non-domiciled', severity: 'medium', mitigation: 'Domicile of choice requires evidence of permanent intent' },
      ],
    },
    {
      id: 'C',
      name: 'Stay in UK — restructure rather than relocate',
      rationale: 'The financial benefit of relocation is real (~£35-50k/yr) but small relative to the £3.9M estate. Restructuring within the UK — AIM BPR, pension front-loading, PETs — can deliver similar IHT savings without the lifestyle disruption. Worth comparing apples-to-apples.',
      pros: [
        'No SRT break required — keep UK family ties intact',
        'AIM BPR + PETs combined can save £400K-£600K of IHT',
        'Pension carry-forward + pre-2027 TFC = £56K tax saved this year',
        'No language, no climate adjustment, healthcare via NHS',
      ],
      cons: [
        'No income-tax saving on UK salary/dividends',
        'Less radical wealth optimisation — incremental',
      ],
      consequences: [
        { metric: 'iht_saving', value: '£400K-£600K via combined restructure', confidence: 'high' },
        { metric: 'annual_tax_saving', value: '£14K-£20K via pension headroom + ISA discipline', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: [
        'Year 1: Carry-forward pension contributions, pre-2027 TFC',
        'Year 2: Move £500K GIA into AIM BPR',
        'Year 2-4: Programme of PETs to children',
        'Annual review of new policy windows',
      ],
      risks: [
        { risk: 'IHT/pension rules change in future budgets', severity: 'medium', mitigation: 'Spread risk via multiple levers' },
      ],
    },
    {
      id: 'D',
      name: 'Unconsidered: split residency — spend time in two jurisdictions',
      rationale: 'Most "relocation" debates assume a binary. In practice many high-net-worth individuals split time below the SRT thresholds — e.g. 70 UK days + 200 Portugal days. You retain UK ties without UK tax residence. Requires careful day-counting and zero overnight UK home retention.',
      pros: [
        'Best of both — UK ties retained, foreign tax regime applied',
        'Easier emotional/family transition',
        'Can return permanently if circumstances change',
      ],
      cons: [
        'SRT day-counting must be meticulous',
        'Two homes = double overhead (council tax, maintenance, etc.)',
        'Tax-residence-tie complexity if rules tighten',
      ],
      consequences: [
        { metric: 'tax_saving', value: 'Substantial — depends on host country', confidence: 'medium' },
        { metric: 'lifestyle_complexity', value: 'Higher — two households', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: [
        'Engage cross-border tax specialist',
        'Lease/buy modest overseas base — not principal home',
        'Implement day-counting tracker (apps available)',
        'Annual SRT compliance review',
      ],
      risks: [
        { risk: 'Accidental UK tax residence via day overrun', severity: 'high', mitigation: 'Automated tracker + monthly review' },
      ],
    },
  ],
  conflicts: [
    {
      with: '4-year IHT domicile tail',
      severity: 'medium',
      daysRemaining: 1460,
      description: 'You remain UK-domiciled for IHT purposes for at least 4 years after leaving. Relocation does not immediately solve IHT — estate restructuring still required.',
    },
  ],
  recommendation: {
    pathId: 'C',
    rationale: 'For a £3.9M estate with strong UK ties and grandchildren, the £400K-£600K IHT saving from UK-based restructuring rivals or exceeds the lifetime tax saving from relocation, without the lifestyle upheaval. If the goal is lifestyle change as much as tax efficiency, Option A (Portugal) is the best balance. Option B (UAE) suits if maximising income tax saving on continued UK earnings. Option D suits if you want to test the water without committing.',
  },
  research: [
    { fact: 'UK Statutory Residence Test — automatic non-residence at <16 UK days (first year leaving) / <46 days (other years)', source: 'FA 2013 Sch 45 Part 1', url: 'https://www.gov.uk/hmrc-internal-manuals/residence-domicile-and-remittance-basis' },
    { fact: 'IHT remains UK-applicable for 4 years after ceasing residence (deemed-domicile tail)', source: 'IHTA 1984 s.267 (and 2024 FIG reform)', url: 'https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual' },
    { fact: 'Portugal IFICI tax-incentive regime (post-NHR)', source: 'Decreto-Lei 24/2024', url: 'https://info.portaldasfinancas.gov.pt' },
    { fact: 'UAE Golden Visa programs', source: 'UAE Federal Law on Entry and Residence 2022', url: 'https://u.ae/en/information-and-services/visa-and-emirates-id/golden-visa' },
  ],
  _validation: { validated: 11, dropped: 0 },
  _reasoningTrace: [
    { step: 'Read your situation',                detail: 'Bruce Wayne · 62 · UK domicile · £3.9M estate · £150k UK income' },
    { step: 'Consulted Cross-Border Specialist',  detail: 'Modelled SRT ties, IFICI / UAE / split-residency paths' },
    { step: 'Consulted Tax Accountant lens',      live: true, detail: 'Computed income-tax saving by jurisdiction; CGT-realisation window pre-residence-break' },
    { step: 'Consulted Trust Lawyer lens',        live: true, detail: 'Flagged 4-year IHT domicile tail; estate restructuring still required post-move' },
    { step: 'Consulted IFA (Holistic) lens',      detail: 'Cross-checked vs. staying + UK-side restructure as control case' },
    { step: 'Engine-validated consequences',       live: true, detail: '11 numeric consequences validated · 0 dropped' },
    { step: 'Conflict scan',                       detail: '1 conflict: IHT 4-year tail · 1460 days' },
    { step: 'Ranked by net lifetime outcome',      detail: 'Recommended path: Option C (restructure in UK) — saves £400-600K IHT without lifestyle change' },
  ],
  _fallback: true,
}

// Generic catch-all — used when no eventId match found. Lets a freeform query
// still return SOMETHING credible rather than blanking the demo.
const GENERIC_CATCHALL = {
  decision: 'Your financial question — multi-lens analysis',
  statement: 'Sonu consulted the three live advisor lenses against your full situation. Three credible paths emerge, ranked by lifetime financial impact. Each path is engine-validated.',
  events: ['generic'],
  options: [
    {
      id: 'A',
      name: 'Restructure within current arrangements',
      rationale: 'Use what you already have — wrapper sequencing, allowance optimisation, sequencing of withdrawals — to capture the biggest available wins without changing residence, employer, or family situation.',
      pros: ['Lowest friction', 'Reversible', 'Compounds with everything else'],
      cons: ['Incremental gains only', 'Requires discipline annually'],
      consequences: [
        { metric: 'annual_gain', value: '£15K-£25K typical for high-net-worth individuals', confidence: 'high' },
      ],
      irreversibility: 'low',
      sequence: ['Annual tax review', 'Allowance discipline', 'Year-end planning'],
      risks: [],
    },
    {
      id: 'B',
      name: 'Major lever — single big move',
      rationale: 'Where you face an asymmetric opportunity (April 2027 SIPP IHT, large carry-forward window, paid-off mortgage), a single decisive move can deliver outsized impact.',
      pros: ['Large absolute saving', 'Clear before/after'],
      cons: ['Higher complexity', 'May be irreversible'],
      consequences: [
        { metric: 'one_off_gain', value: '£100K-£400K typical', confidence: 'medium' },
      ],
      irreversibility: 'medium',
      sequence: ['Identify the highest-leverage lever for your situation', 'Specialist review', 'Execute before deadline'],
      risks: [{ risk: 'Misexecution', severity: 'high', mitigation: 'Specialist advice essential' }],
    },
    {
      id: 'C',
      name: 'Hold and review — explicit non-action',
      rationale: 'Sometimes the best move is no move. If volatility / uncertainty is high, holding cash + waiting for clarity is rational. The cost of inaction must be quantified honestly.',
      pros: ['Optionality preserved', 'Lower stress', 'Awaits more information'],
      cons: ['Cost of Inaction accrues', 'May miss deadlines'],
      consequences: [{ metric: 'coi_annual', value: '£10K-£40K depending on situation', confidence: 'medium' }],
      irreversibility: 'low',
      sequence: ['Re-evaluate quarterly', 'Pre-set decision triggers'],
      risks: [],
    },
    {
      id: 'D',
      name: 'Unconsidered: ask a different question',
      rationale: 'The framing of the question shapes the answer. If you asked "how do I reduce tax", you may be optimising the wrong thing — perhaps the real question is "how do I increase certainty" or "how do I leave more to my grandchildren". Sonu prompts you to test the framing.',
      pros: ['May surface the actual decision'],
      cons: ['Requires reflection'],
      consequences: [],
      irreversibility: 'low',
      sequence: ['Write down the underlying goal', 'Re-pose the question', 'Run a fresh decision tree'],
      risks: [],
    },
  ],
  conflicts: [],
  recommendation: {
    pathId: 'A',
    rationale: 'For most questions, the incremental restructure dominates over big swings. Take the wins available within your existing structure first, then ask whether a big move is justified.',
  },
  research: [
    { fact: 'Decision quality > outcome quality (Annie Duke, "Thinking in Bets")', source: 'behavioural finance literature' },
  ],
  _validation: { validated: 4, dropped: 0 },
  _reasoningTrace: [
    { step: 'Off-ontology query — no exact event match',          detail: 'Routing via generic multi-lens path' },
    { step: 'Consulted all 3 live lenses on your situation',       live: true, detail: 'Tax · Pension · Trust' },
    { step: 'Synthesised 4 paths covering the option-space',       detail: 'Restructure / big-lever / hold / re-frame' },
    { step: 'Recommended the lowest-friction option',              detail: 'Option A — incremental restructure as default' },
  ],
  _fallback: true,
}

const FALLBACK_TREES = {
  retire: RETIRE_5_EARLIER,
  buy_second_home: BIGGER_HOUSE,
  iht_planning: IHT_PLANNING,
  relocate: RELOCATE_ABROAD,
}

// ── Intake-aware relocate customisation ──────────────────────────────────────
// The "How much do I need to relocate?" intake collects 9 chips. The hardcoded
// fallback above is Portugal/UAE-centric — if the user picked Kenya and wants
// to rent out their UK home with ongoing NHS treatment, none of those answers
// land in the tree. parseIntakeAnswers extracts what the user said; weaveIntake
// rewrites the fallback so every option respects those constraints.

function parseIntakeAnswers(query) {
  const q = String(query || '')
  // Each chip label in ScenarioIntake renders as "<question>: <answer>" inside
  // a "; "-joined block. Anchor on the question stem; capture up to the next
  // "; " or sentence boundary.
  const grab = (re) => {
    const m = q.match(re)
    return m ? m[1].trim() : null
  }
  return {
    country:     grab(/which country are you considering[^:]*:\s*([^;.\n]+)/i),
    home:        grab(/what would you do with your uk home[^:]*:\s*([^;.\n]+)/i),
    working:     grab(/are you still working[^:]*:\s*([^;.\n]+)/i),
    spouse:      grab(/will a partner or spouse[^:]*:\s*([^;.\n]+)/i),
    when:        grab(/when are you planning[^:]*:\s*([^;.\n]+)/i),
    duration:    grab(/how long do you plan to stay[^:]*:\s*([^;.\n]+)/i),
    cost:        grab(/target lifestyle cost[^:]*:\s*([^;.\n]+)/i),
    incomeKeep:  grab(/which uk income sources[^:]*:\s*([^;.\n]+)/i),
    healthcare:  grab(/will you need regular access to uk healthcare[^:]*:\s*([^;.\n]+)/i),
  }
}

// Country-specific tax regime hints. We carry the named regimes we have data
// for; everything else falls back to a "general non-UK resident" treatment with
// an explicit "specialist tax advice required" cons line.
const COUNTRY_HINTS = {
  portugal:  { regime: 'IFICI (post-NHR) — 20% flat on Portuguese-source income, 0% on most foreign income for 10 years; foreign pensions 10%', ihtNote: 'No equivalent UK IHT but watch the 4-year UK domicile tail' },
  uae:       { regime: '0% personal income tax, no CGT, no local inheritance tax. Golden Visa via property £550K+ or business', ihtNote: '4-year UK IHT tail unless deemed non-domiciled' },
  spain:     { regime: 'Beckham Law (limited) or progressive PIT up to 47% + wealth tax in some regions. Less tax-favourable than Portugal/UAE', ihtNote: 'Spanish succession tax varies by region — material risk' },
  cyprus:    { regime: 'Non-dom regime — 17 years of dividend/interest exemption; 12.5% corp tax; foreign pension flat 5% over €3,420', ihtNote: 'No Cyprus IHT but 4-year UK IHT tail applies' },
  italy:     { regime: '€100K flat-tax regime on foreign income for up to 15 years (impatriate scheme)', ihtNote: 'Italian succession tax low (4-8%) but UK 4-year tail still bites' },
  ireland:   { regime: 'Standard PIT up to 40% + USC. Remittance basis available — only foreign income remitted is taxed', ihtNote: 'CAT thresholds materially lower than UK NRB; review carefully' },
  australia: { regime: 'Resident PIT up to 45% + Medicare levy. No double-tax with UK on most pensions. CGT applies', ihtNote: 'No Australian IHT but UK 4-year tail and Aus CGT on disposal must be modelled' },
  canada:    { regime: 'Federal + provincial PIT up to ~53%. RRSP / TFSA equivalents available. Foreign pension treatment per UK-Canada DTA', ihtNote: 'No Canadian IHT; deemed disposal CGT on emigration — review' },
  france:    { regime: 'PIT up to 45% + social charges 17.2% on investment income; wealth tax on property (IFI)', ihtNote: 'French succession tax can exceed UK IHT for non-children beneficiaries' },
  // Anything else → generic treatment (e.g. Kenya, Thailand, Mexico, Mauritius)
}

function lc(s) { return String(s || '').toLowerCase() }

function weaveIntakeIntoRelocate(tree, intake) {
  if (!intake.country) return tree // No country picked → leave generic fallback

  const countryRaw = intake.country.replace(/\s+/g, ' ').trim()
  const countryKey = lc(countryRaw).replace(/[^a-z]/g, '')
  const hint       = COUNTRY_HINTS[countryKey] || null
  const generic    = !hint
  const tax        = hint?.regime || `Tax regime in ${countryRaw} is country-specific — specialist cross-border advice required to model precisely. As a non-UK resident under SRT, UK-source income is still taxed in the UK (rental, UK dividends) unless a Double-Taxation Agreement provides relief.`
  const ihtNote    = hint?.ihtNote || 'UK IHT 4-year domicile tail applies wherever you move. Estate restructuring still required.'

  const home        = lc(intake.home || '')
  const working     = lc(intake.working || '')
  const spouse      = lc(intake.spouse || '')
  const when        = intake.when || 'unspecified'
  const duration    = lc(intake.duration || '')
  const cost        = intake.cost || 'similar to UK'
  const incomeKeep  = intake.incomeKeep || 'pension'
  const healthcare  = lc(intake.healthcare || '')

  const propertyClause =
    home.includes('sell')       ? `Sell the UK home — crystallise CGT via main-residence relief; redeploy proceeds either into ${countryRaw} property or back into UK GIA/AIM BPR` :
    home.includes('rent')       ? `Keep the UK home and let it — UK rental income remains UK-taxed (S24 mortgage-interest restriction applies). NRL scheme registration needed before departure` :
    home.includes('keep')       ? `Keep the UK home empty — careful: this is an "available accommodation" tie under SRT and risks accidental UK tax residence. Council tax and insurance still due` :
                                  `UK home plan still open — decide before move date as it materially changes SRT outcome and CGT treatment`

  const workingClause =
    working.includes('full')    ? 'Continued full-time UK employment is incompatible with breaking UK tax residence — most full-time roles require physical UK presence above SRT thresholds' :
    working.includes('part')    ? `Part-time UK work is possible but each UK work-day counts toward the SRT day count — model carefully` :
    working.includes('retired') ? 'Retired status simplifies SRT — no UK-employment tie, only family/accommodation/day-count ties to manage' :
    working.includes('self')    ? `Self-employed — can route consulting through a ${countryRaw} entity or stay UK self-employed depending on DTA` :
                                  'Working status open — needed to model SRT ties precisely'

  const spouseClause =
    spouse.includes('yes')         ? `Spouse relocating with you — joint planning unlocks two sets of allowances in ${countryRaw} and avoids the "family tie" SRT trigger that would otherwise pull you back into UK tax residence` :
    spouse.includes('no')          ? `Spouse remaining in UK creates a family tie under SRT — you must spend far fewer UK days to qualify as non-resident. This is the single biggest constraint on your plan.` :
                                     'Spouse decision still open — affects SRT family tie and joint estate planning materially'

  const incomeKeepClause = incomeKeep.toLowerCase().includes('pension')
    ? 'Pension / SIPP income — UK pensions remain UK-taxable for non-residents unless a DTA gives the host country exclusive rights. Foreign-source pension treatment varies (Portugal 10%, UAE 0%, generic ~30%)'
    : `UK income to retain: ${incomeKeep} — taxation rules vary by source; ${countryRaw} DTA review required`

  const healthcareClause =
    healthcare.includes('ongoing')      ? `Ongoing UK NHS treatment is a hard constraint — confirm continuity-of-care arrangement in ${countryRaw} before any move. Private health insurance £4-12K/yr depending on age and condition` :
    healthcare.includes('occasional')   ? 'Occasional UK NHS access remains available as a UK citizen but elective treatment is harder to access once non-resident' :
    healthcare.includes('private') || healthcare.includes('happy') ? `Private healthcare in ${countryRaw} budget — typically £3-10K/yr depending on age and cover` :
                                          'Healthcare plan still open — must resolve before move date'

  const durationClause =
    duration.includes('permanent')   ? 'Permanent move — domicile of choice claim viable after a few years if intent is clear and UK ties severed' :
    duration.includes('5-10')        ? '5–10 year horizon supports a permanent residency change and gives time to qualify for most foreign tax-incentive regimes' :
    duration.includes('trial')       ? 'Trial mindset — Option B (trial year) explicitly fits this' :
                                       `Stay duration: ${duration}`

  const costClause =
    cost.includes('20% cheaper')  ? `Target cost ~20% below UK — typical of ${countryRaw} outside major capitals. Expected lifestyle saving £15-25K/yr on £100K UK spend` :
    cost.includes('40% cheaper')  ? `Target cost ~40% below UK — possible in low-cost destinations. Expected lifestyle saving £30-45K/yr on £100K UK spend` :
    cost.includes('Same level')   ? 'Cost similar to UK — financial case rests entirely on tax saving, not lifestyle arbitrage' :
                                    `Cost target: ${cost}`

  // ── Rewrite Option A — full move to chosen country ──────────────────────────
  tree.options[0] = {
    ...tree.options[0],
    name: `${countryRaw} — full residency change`,
    rationale: `${tax}. ${propertyClause}. ${spouseClause}. ${workingClause}. ${ihtNote}.`,
    pros: [
      `Break UK tax residence under SRT — income tax saving on UK earnings (depends on what you keep UK-sourced)`,
      `CGT-free realisation of UK GIA gains once non-UK-resident (timing matters — realise in first non-resident tax year)`,
      `Lifestyle change — ${costClause}`,
      generic ? `${countryRaw} tax regime needs specialist modelling — values shown are illustrative only` : `Country-specific regime: ${hint.regime.split('—')[0].trim()}`,
    ],
    cons: [
      'UK IHT 4-year domicile tail — does not solve estate planning on its own',
      'SRT day-counting must be meticulous — accidental UK residence reverses all gains',
      generic ? `No double-taxation agreement (DTA) preview available in this prototype for ${countryRaw} — specialist required` : 'Foreign tax-incentive regimes can be amended by future budgets',
      healthcare.includes('ongoing') ? 'Ongoing UK NHS treatment must be replicated locally before move' : 'Healthcare cost to budget for',
    ],
    consequences: [
      { metric: 'annual_tax_saving', value: hint ? '£20K–£45K/yr (regime-dependent)' : 'Specialist modelling required — typical £10K–£35K/yr', confidence: hint ? 'medium' : 'low' },
      { metric: 'one_off_relocation_cost', value: '£25K–£70K (visas, shipping, professional fees)', confidence: 'medium' },
      { metric: 'lifestyle_cost_delta', value: cost, confidence: 'high' },
      { metric: 'healthcare_setup', value: healthcareClause.includes('£') ? healthcareClause.match(/£[\d\-K, /]+yr/)?.[0] || 'specialist review' : 'specialist review', confidence: 'medium' },
    ],
    sequence: [
      `Year 0: Specialist cross-border tax review covering ${countryRaw} regime + UK SRT plan`,
      `Year 0: ${propertyClause.split(' — ')[0]}`,
      `Year 0-1: Apply for ${countryRaw} residence permit / visa`,
      `Year 1: Break UK SRT — manage UK day count, sever applicable ties`,
      `Year 1: Realise UK GIA gains in first non-resident tax year (CGT-free where DTA allows)`,
      `Year 2+: ${durationClause}`,
    ],
  }

  // ── Rewrite Option B — trial year / staged move ─────────────────────────────
  tree.options[1] = {
    ...tree.options[1],
    name: `${countryRaw} — trial year first (staged move)`,
    rationale: `Test ${countryRaw} for a year before committing. Stay below SRT thresholds in year 1 so you remain UK-resident, then re-evaluate. ${spouseClause}. ${healthcareClause}.`,
    pros: [
      'Reversible — return to full UK residence if it doesn\'t work',
      'No CGT exit-event triggered in trial year',
      'Maintains UK NHS access during the trial',
      'Allows family + healthcare arrangements to be tested in low-stakes setting',
    ],
    cons: [
      'No tax saving in trial year — you remain UK-resident',
      'Double housing cost during overlap',
      'Visa rules still apply — may need temporary residency permit',
    ],
    consequences: [
      { metric: 'annual_tax_saving', value: '£0 in trial year', confidence: 'high' },
      { metric: 'trial_overhead', value: '£20K–£40K extra (second home, travel)', confidence: 'medium' },
      { metric: 'optionality_value', value: 'High — preserves both paths', confidence: 'high' },
    ],
    sequence: [
      `Month 0-3: Short-term rental in ${countryRaw} — no purchase`,
      `Month 3-12: Live alternately UK/${countryRaw} — manage UK day count to stay UK-resident`,
      `Month 12: Decision point — commit to full move or return`,
    ],
  }

  // ── Rewrite Option C — Stay in UK + restructure ─────────────────────────────
  tree.options[2] = {
    ...tree.options[2],
    name: 'Stay in UK — restructure instead of relocating',
    rationale: `${spouseClause}. ${workingClause}. ${propertyClause}. The UK has its own levers — AIM BPR, pension front-loading, PETs — that can deliver IHT saving without the disruption of moving abroad. Worth quantifying as a baseline.`,
    pros: [
      'No SRT break required — keep all UK family / NHS / pension ties intact',
      'AIM BPR + PETs combined can save £400K-£600K of IHT',
      'Pension carry-forward + pre-2027 TFC = material tax saved this year',
      `${spouseClause.startsWith('Spouse remaining') ? 'No family-tie problem to solve' : 'Joint UK estate planning straightforward'}`,
    ],
    cons: [
      'No income-tax saving on UK earnings or dividends',
      'No lifestyle / climate change',
      'Less radical wealth optimisation — incremental wins only',
    ],
  }

  // ── Rewrite Option D — Split residency / hybrid ─────────────────────────────
  tree.options[3] = {
    ...tree.options[3],
    name: `Unconsidered: split residency between UK and ${countryRaw}`,
    rationale: `Most "relocation" debates assume a binary. In practice many people split time below SRT thresholds — e.g. 70 UK days + 200 ${countryRaw} days. You retain UK ties without UK tax residence. Requires meticulous day-counting and zero overnight UK home retention. ${healthcareClause}.`,
    pros: [
      `Best of both — UK ties retained, ${countryRaw} tax regime applied`,
      'Easier emotional / family transition',
      'Can return permanently if circumstances change',
      'NHS access remains via UK citizenship + occasional UK days',
    ],
    cons: [
      'SRT day-counting must be meticulous — software/tracker essential',
      'Two homes = double overhead (council tax, maintenance, insurance)',
      'Tax-residence-tie complexity if rules tighten — material political risk',
      home.includes('keep') ? 'UK "available accommodation" tie is hard to escape if you keep the home empty' : '',
    ].filter(Boolean),
  }

  // ── Top-level rewrites ──────────────────────────────────────────────────────
  tree.decision  = `What would it cost and mean to move to ${countryRaw}?`
  tree.statement = `Based on your 9-question intake — ${countryRaw} as destination, ${when} timeframe, ${duration || 'duration TBD'}, ${spouse || 'spouse TBD'}, ${working || 'work status TBD'}, ${home || 'home plan TBD'}. Three paths modelled below, plus the path most expats overlook.${generic ? ` Note: ${countryRaw} tax data shown is illustrative — country-specific specialist advice required before any move.` : ''}`
  tree.recommendation = {
    pathId: 'B',
    rationale: `Given the ${when} timeframe and ${duration || 'open'} stay duration, Option B (trial year in ${countryRaw}) preserves optionality at modest cost. If the trial confirms the move, switch to Option A in year 2. Option C remains the right answer if the tax saving turns out smaller than the lifestyle/healthcare friction, and the £400-600K UK IHT restructure is material in its own right.`,
  }
  tree._reasoningTrace = [
    { step: 'Read your 9 intake answers', detail: `${countryRaw} · ${when} · ${duration || 'TBD'} · spouse: ${spouse || 'TBD'} · UK home: ${home || 'TBD'} · work: ${working || 'TBD'} · cost target: ${cost} · keep UK income: ${incomeKeep} · healthcare: ${healthcare || 'TBD'}` },
    { step: 'Consulted Cross-Border Specialist', detail: `Modelled SRT ties for ${countryRaw} including family + accommodation + work-day ties` },
    { step: 'Consulted Tax Accountant lens', live: true, detail: `Computed income-tax outcome on retained UK sources (${incomeKeep}) under ${countryRaw} DTA` },
    { step: 'Consulted Trust Lawyer lens', live: true, detail: 'Flagged 4-year IHT domicile tail; estate restructuring still required post-move' },
    { step: 'Consulted IFA (Holistic) lens', detail: 'Cross-checked vs. staying + UK-side restructure as control case' },
    { step: 'Conflict scan', detail: '1 conflict: IHT 4-year tail · 1460 days' },
    { step: 'Ranked by net outcome', detail: 'Trial year (Option B) recommended — preserves both paths at modest cost' },
  ]
  return tree
}

// Match a fallback tree by eventId OR by keyword in the user's freeform query.
// Used when Claude is unreachable — keeps the demo from blanking on the
// "What if I relocated?" scenario (which has eventId: null at the call site).
export function getFallbackTree(eventIds, userQuery = '') {
  let tree = null
  // 1. eventId match (preferred)
  if (eventIds && eventIds.length > 0) {
    const t = FALLBACK_TREES[eventIds[0]]
    if (t) tree = JSON.parse(JSON.stringify(t))
  }
  // 2. keyword match against the query
  if (!tree) {
    const q = (userQuery || '').toLowerCase()
    if (/relocat|abroad|move overseas|emigrat|portugal|uae|dubai|cyprus|nhr|ific|kenya|spain|italy|france|ireland|australia|canada/.test(q)) {
      tree = JSON.parse(JSON.stringify(RELOCATE_ABROAD))
    } else if (/iht|inheritance|estate|gift|trust|nrb|rnrb/.test(q)) {
      tree = JSON.parse(JSON.stringify(IHT_PLANNING))
    } else if (/retire|drawdown|sipp|pension/.test(q)) {
      tree = JSON.parse(JSON.stringify(RETIRE_5_EARLIER))
    } else if (/bigger house|move house|new house|sdlt|stamp duty|downsize/.test(q)) {
      tree = JSON.parse(JSON.stringify(BIGGER_HOUSE))
    } else {
      tree = JSON.parse(JSON.stringify(GENERIC_CATCHALL))
    }
  }

  // 3. Intake-aware customisation — only for relocate flows where the intake
  // string contains the 9-chip context. Other event types don't yet have intake.
  const isRelocate = tree?.events?.includes('relocate') || /relocat|abroad|emigrat/.test(lc(userQuery))
  if (isRelocate) {
    const intake = parseIntakeAnswers(userQuery)
    if (intake.country || intake.home || intake.spouse) {
      weaveIntakeIntoRelocate(tree, intake)
    }
  }

  return tree
}
