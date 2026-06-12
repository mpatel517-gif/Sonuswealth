// ─────────────────────────────────────────────────────────────────────────────
// PLAY ACTIONS + ADVISOR ATTRIBUTION
//
// Two registries keyed by play.id:
//   ACTION_STEPS[id] — 3 concrete steps the user can do
//   ADVISORS_BY_CATEGORY — which of the 11 lenses informed this category
//
// Kept separate from knowledge-graph.js so a 25-play update is one file
// touch, not 25 edits.
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_STEPS = {
  phase_tfc: [
    'In April, instruct your SIPP provider to crystallise the first tranche only (≈25% of one quarter of the pot)',
    'Drawdown taxable income up to your personal allowance (£12,570); top up to target with ISA withdrawals',
    'Repeat the same pattern each tax year for 4 years',
  ],
  split_sipp_spouse: [
    'Confirm your spouse\'s pension pot and unused personal allowance',
    'Open a SIPP for them if they don\'t already have one; carry-forward up to 3 years of unused annual allowance',
    'Route part of your annual drawdown through their pension, or move income-producing assets into their name (inter-spouse transfers are CGT-exempt), to use both bands',
  ],
  isa_topup_during_drawdown: [
    'After each year\'s pension drawdown, subscribe up to £20,000 of net proceeds into your ISA',
    'Hold growth-oriented assets in the ISA (no future CGT or income tax on growth)',
    'Set the recycling pattern as a standing instruction so you don\'t forget mid-year',
  ],
  defer_state_pension: [
    'Check your State Pension forecast at gov.uk/check-state-pension',
    'Decide deferment duration (each year delayed = +5.8% income for life)',
    'Notify DWP at least 5 weeks before your State Pension Age',
  ],
  preserve_pension_pre_2027: [
    'Inventory all pensions (DB schemes, SIPP, workplace) with current value + crystallised status',
    'Draw your income for 2025-26 and 2026-27 from ISA/GIA first, leaving SIPP untouched',
    'Set a calendar reminder for January 2027 to review pension drawdown sequencing pre-deadline',
  ],
  mpaa_avoidance: [
    'Confirm whether you\'ve already triggered MPAA (any flexi-access taxable drawdown counts)',
    'For tax-free element only, use PCLS (pension commencement lump sum) — does NOT trigger MPAA',
    'If still earning, restrict pension touches to small-pot rules (3 pots under £10k, no MPAA trigger)',
  ],
  surplus_income_gifting: [
    'Build a written record showing: (a) regular income, (b) regular expenditure, (c) the surplus you gift',
    'Set up the gift as a standing order (monthly/quarterly) — habituality is the key test',
    'Keep the IHT403 form template ready for executors — surplus-income claims are checked on death',
  ],
  aim_bpr: [
    'Confirm your risk tolerance — AIM is materially more volatile than mainstream equities',
    'Consider a managed AIM BPR portfolio for part of the estate (typically 5–15%)',
    'Hold for minimum 2 years for BPR to apply; review annually',
  ],
  charity_10pct_iht: [
    'Calculate the net estate above nil-rate bands (NRB + RNRB if home left to lineal descendants)',
    'Update your will to leave 10%+ of the net estate to a registered UK charity',
    'Document the calculation with your solicitor — executor needs it for IHT400',
  ],
  lasting_poa: [
    'Download both LPA forms (Property & Financial; Health & Welfare) from gov.uk/power-of-attorney',
    'Choose 1-2 attorneys + replacement(s); have them sign in the right order',
    'Register both with the Office of the Public Guardian (£82 each; ~10 week turnaround)',
  ],
  srt_day_count_discipline: [
    'Install an SRT tracking app (TaxScouts, Smarttax, or a HMRC RDR3-compliant spreadsheet)',
    'Log every UK day with arrival/departure times (midnight rule applies)',
    'Monthly review of day count + ties; aim well below your threshold to allow buffer',
  ],
  fig_window_utilise: [
    'List foreign assets with unrealised gains as at your UK arrival date',
    'Sequence realisations within the 4-year FIG window; keep proceeds offshore',
    'Engage a cross-border tax adviser BEFORE each realisation — remittance rules are strict',
  ],
  destination_cost_reality_check: [
    'Build a bottom-up monthly budget for your target city using actual basket items (rent, schools, healthcare, transport, groceries)',
    'Cross-check against Mercer / Numbeo for the *expat suburb*, not country averages',
    'Stress-test at +30% (currency move + expat premium) before committing',
  ],
  healthcare_continuity_plan: [
    'List every household member\'s ongoing prescriptions and medical conditions',
    'Get pre-quotes from international health insurers for the target jurisdiction',
    'Identify in-country specialists for any chronic conditions BEFORE the move',
  ],
  schooling_continuity_plan: [
    'Shortlist 3-5 international schools matching curriculum (IB / GCSE / A-level continuity)',
    'Apply 12-18 months ahead — top schools have waiting lists',
    'Visit before committing to a suburb — school location often determines housing choice',
  ],
  iht_tail_post_departure: [
    'Restructure your UK estate BEFORE departure (PETs, AIM BPR, trust gifting)',
    'Track the 10-year clock — IHT exposure persists until 10 years of continuous non-residence',
    'Build a will valid in both jurisdictions (UK + new home) — common pitfall',
  ],
  cohab_ip_gap: [
    'Get a joint estate review with a STEP-qualified solicitor',
    'Most direct fix: marry / register civil partnership — restores spousal exemption immediately',
    'If you don\'t want that: arrange life cover written in trust + restructure home ownership',
  ],
  will_revocation_on_marriage: [
    'Before the ceremony, instruct a solicitor to draft a will "in contemplation of marriage to [name]"',
    'If already married without doing this — make a new will now (current one is void)',
    'Update beneficiary nominations on pensions + life cover at the same time',
  ],
  pension_sharing_divorce: [
    'Insist on a Pension on Divorce Expert (PODE) report — never accept CETV-only valuation for DB schemes',
    'Compare three options: pension sharing order, offsetting, earmarking — pick on tax-adjusted basis',
    'Update your own will + nominations on the day the order is approved',
  ],
  taper_pension_relief: [
    'Calculate your earnings forecast for the tax year — if between £100k-£125,140, taper applies',
    'Salary-sacrifice the amount above £100k into pension via your employer',
    'Check carry-forward availability if you want to push further than the £60k annual allowance',
  ],
  bed_and_isa: [
    'Identify GIA holdings with the smallest unrealised gains (use the CGT allowance, £3k)',
    'Sell the lot, immediately re-buy inside ISA using your £20k annual allowance',
    'Repeat every tax year — over 5 years, £100k can migrate from GIA to ISA',
  ],
  care_fee_buffer: [
    'Estimate care-cost exposure (£45-75k/yr × likely duration based on age + health)',
    'Earmark a liquid asset bucket (cash/short-term bonds) outside the home for care funding',
    'Consider an immediate-needs annuity quote if/when care begins — caps your cost certainty',
  ],
  income_protection_gap: [
    'Get income-protection quotes via a regulated protection adviser — target 65% of gross income to retirement age',
    'Pick own-occupation cover (most generous definition of "unable to work")',
    'Set the deferred period as long as your savings can sustain (longer = cheaper premium)',
  ],

  // ── Cash deployment plays ──────────────────────────────────────────
  deploy_cash_isa_first: [
    'Check exactly how much of your £20,000 ISA allowance you\'ve used this tax year',
    'Subscribe the unused balance into a Stocks & Shares (or Cash) ISA before 6 April — same for your spouse',
    'Plan to subscribe £20k each next 6 April; layer with bed-and-ISA for the residual',
  ],
  psa_optimisation: [
    'Estimate annual interest on your cash (cash × ~4.5%); compare against your PSA (£1k basic / £500 higher / £0 additional)',
    'For interest above PSA, move that portion into Cash ISA or direct gilts (CGT-free capital gain)',
    'Keep enough in instant-access for 3-6 months expenses; wrapper the rest',
  ],
  emergency_fund_first: [
    'Estimate 6 months of household expenses (rent/mortgage + bills + food + travel + insurance)',
    'Park that amount in an instant-access savings account paying a competitive rate (FSCS-protected providers; compare via MoneySavingExpert or Which?)',
    'Treat this as untouchable; deploy ONLY the surplus into wrappers / investments / dated gilts',
  ],
  gilt_ladder_for_dated_spend: [
    'Identify the spend date(s) — e.g. school fees in 2027, deposit on a house in 2028',
    'Hold short-dated gilts maturing on/before each spend date (your platform may list individual gilts, or a short-gilt ETF for simplicity) — a regulated adviser can confirm suitability',
    'Hold to maturity — coupons taxed at income rate, but capital appreciation is CGT-free',
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR ATTRIBUTION — restores the "11 specialists" framing
// Each category surfaces the lens(es) that informed it.
// ─────────────────────────────────────────────────────────────────────────────
export const ADVISORS_BY_CATEGORY = {
  tax_pension:          ['Pension Specialist', 'Tax Accountant'],
  iht:                  ['Trust Lawyer', 'Tax Accountant'],
  relocation:           ['Cross-Border Specialist'],
  relocation_lifestyle: ['Cross-Border Specialist', 'Later Life Adviser'],
  family:               ['Family Law Specialist'],
  healthcare:           ['Later Life Adviser', 'Insurance Adviser'],
  protection:           ['Insurance Adviser'],
  investment:           ['Investment Adviser', 'IFA'],
  lifestyle:            ['IFA'],
}

export function getActionSteps(playId) {
  return ACTION_STEPS[playId] || []
}

export function getAdvisors(category) {
  return ADVISORS_BY_CATEGORY[category] || ['Holistic IFA']
}
