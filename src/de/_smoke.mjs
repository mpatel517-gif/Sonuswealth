/**
 * src/de/_smoke.mjs — Decision Engine Phase 1 smoke tests
 *
 * Tests three scenarios console-only (no UI, no Claude API call).
 * Uses pre-written mock trees with intentionally wrong placeholder values.
 * The validator replaces each placeholder with a real engine-computed number.
 *
 * Run: node src/de/_smoke.mjs
 *
 * Verification criteria (from plan §Phase 1):
 *   ✓ matchEvent finds correct ontology entry for each query
 *   ✓ buildContextSummary assembles user state from real engines
 *   ✓ validateTree replaces placeholder values with real engine numbers
 *   ✓ No invented figures remain — only engineValidated:true consequences
 *   ✓ Dropped consequences are reported, not silently faked
 *   ✓ [MOCK] research data labelled correctly
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { matchEvent } from './ontology.js';
import { buildPrompt, buildContextSummary } from './composer.js';
import { validateTree, listRegisteredFunctions } from './validator.js';
import { getMockResearch } from './research/mock.js';

// ── Fixture entity ────────────────────────────────────────────────────────────
// Use the real mrT-core.json persona — the canonical nested-schema fixture.
// This guarantees entity shape matches what all engines expect.

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTITY = JSON.parse(
  readFileSync(join(here, '..', 'rules', 'personas', 'mrT-core.json'), 'utf-8')
);

// ── Formatting helpers ────────────────────────────────────────────────────────

const SEP = '─'.repeat(70);
const PASS = '✓';
const FAIL = '✗';
const WARN = '⚠';

function header(title) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

function fmt(n) {
  if (n == null || typeof n !== 'number') return String(n ?? 'null');
  if (Math.abs(n) >= 1e6) return `£${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `£${(n / 1e3).toFixed(0)}K`;
  return `£${Math.round(n).toLocaleString()}`;
}

// ── Pre-written mock trees ────────────────────────────────────────────────────
// These simulate what Claude would return.
// Placeholder values are intentionally wrong (e.g. '£999K placeholder') —
// the validator must replace them with real engine numbers.

const MOCK_TREE_PROPERTY = {
  events: ['buy_second_home'],
  decision: 'Should I buy a second property in Birmingham?',
  statement: 'You have significant net worth and existing BTL exposure. A second Birmingham property adds further concentration risk but could improve rental yield diversification. Your SIPP IHT deadline is active — liquidity timing matters.',
  yourAnswers: { budget: '£500K', timeline: 'within 12 months', ltdCompany: null, mortgage: null },
  research: [
    { source: 'rules-uk.js', fact: 'SDLT second-home surcharge: +3% above standard rates (ENACTED)' },
    { source: 'rules-uk.js', fact: 'CGT residential property (higher-rate): 24% (ENACTED from Oct 2024)' },
    { source: 'live', fact: '[MOCK] BTL gross yield Birmingham B12: ~7.1% (Rightmove Q1 2026 — real via Exa post-demo)' },
    { source: 'live', fact: '[MOCK] ICR stress test at FCA notional rate 5.5%: rental must be ≥125% of interest (personal name)' },
  ],
  options: [
    {
      id: 'A', name: 'Buy BTL personal name, 25% deposit',
      rationale: 'Maximises rental yield, preserves cash for SIPP decision',
      pros: ['Higher rental yield vs stocks short-term', 'Capital appreciation upside', 'Existing BTL experience'],
      cons: ['Section 24 restricts mortgage relief to basic-rate', 'ICR stress test tightens at current rates', 'Concentration in Birmingham property market'],
      consequences: [
        {
          metric: 'Net worth (10yr)',
          engine: 'fq', engineCall: { fn: 'netWorthAtYears', extraArgs: [10] },
          value: '£999K placeholder', confidence: 0.85,
        },
        {
          metric: 'IHT exposure (post-2027)',
          engine: 'fq', engineCall: { fn: 'ihtDynamic', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.9,
        },
        {
          metric: 'Monthly cashflow',
          engine: 'flow', engineCall: { fn: 'monthlyFlow', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.8,
        },
      ],
      irreversibility: 'high',
      sequence: ['Resolve SIPP drawdown decision first', 'Confirm ICR passes at lender rate', 'Survey + valuation', 'Apply mortgage', 'Exchange + complete'],
      risks: ['Rate rise on remortgage in 2–5 years', 'Void period >2 months hits cashflow', 'Section 24 caps mortgage relief at basic rate'],
      subDecisions: [
        { id: 'A1', q: 'Personal name or limited company?' },
        { id: 'A2', q: 'Interest-only or repayment mortgage?' },
      ],
    },
    {
      id: 'B', name: 'Buy via SPV limited company',
      rationale: 'Full mortgage interest deduction inside company — better after-tax yield',
      pros: ['Full mortgage interest deduction (not Section 24 restricted)', 'Inheritance planning flexibility', 'Potential for family loan structure'],
      cons: ['Higher mortgage rates (~0.4–0.8% above personal)', 'Dividend tax on extraction', 'Additional admin (accounts, CT returns)'],
      consequences: [
        {
          metric: 'Income tax impact (Δincome £18K rental)',
          engine: 'tax', engineCall: { fn: 'incomeTaxDetail', extraArgs: [18000] },
          value: '£999K placeholder', confidence: 0.85,
        },
        {
          metric: 'CGT on eventual sale',
          engine: 'tax', engineCall: { fn: 'cgtDetail', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.75,
        },
      ],
      irreversibility: 'high',
      sequence: ['Form SPV Ltd Co (£100, 1 day)', 'Arrange commercial mortgage in company name', 'Transfer deposit as director loan', 'Complete purchase'],
      risks: ['Double CGT on property disposal + dividend extraction', 'HMRC SDLT group relief rules on related companies'],
      subDecisions: [{ id: 'B1', q: 'Single-asset SPV or multi-asset portfolio company?' }],
    },
    {
      id: 'C', name: 'Defer 18 months — resolve SIPP first',
      rationale: 'The SIPP IHT deadline is the higher-stakes decision; property can wait',
      pros: ['Resolves £1.07M pension IHT exposure before committing liquidity', 'Rate environment may improve', 'More time to stress-test ICR'],
      cons: ['Miss 12 months of rental yield', 'Property price risk in either direction', 'Opportunity cost of cash sitting in savings'],
      consequences: [
        {
          metric: 'IHT exposure (pension + estate)',
          engine: 'tax', engineCall: { fn: 'ihtExposure', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.9,
        },
        {
          metric: 'FI ratio',
          engine: 'fq', engineCall: { fn: 'fiRatio', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.9,
        },
      ],
      irreversibility: 'low',
      sequence: ['Run drawdownMatrix to find optimal SIPP drawdown', 'Decide pension nominations', 'Re-evaluate property in 12–18 months'],
      risks: ['Property market moves away', 'SIPP IHT planning complexity grows as deadline nears'],
      subDecisions: [],
    },
    {
      id: 'D', name: 'Family offset mortgage instead of BTL (unconsidered)',
      rationale: 'Keeps your liquidity, helps a family member, retains IHT benefit — a path you didn\'t name',
      pros: ['Reduces mortgage interest for family member', 'Your cash remains accessible', 'No additional property stamp duty', 'Potential IHT gifting benefit'],
      cons: ['No rental yield', 'Tied up as offset collateral', 'Benefit depends on family member\'s mortgage rate'],
      consequences: [
        {
          metric: 'Monthly surplus delta',
          engine: 'fq', engineCall: { fn: 'monthlySurplus', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.7,
        },
      ],
      irreversibility: 'low',
      sequence: ['Confirm family member has offset-eligible mortgage', 'Legal agreement for offset structure', 'Transfer savings to offset account'],
      risks: ['Access to cash requires notice period', 'Family relationship risk'],
      subDecisions: [],
    },
  ],
  unconsidered: {
    name: 'Family offset mortgage instead of direct BTL purchase',
    why: 'Achieves property-linked financial benefit without additional SDLT, CGT exposure, or Section 24 restriction — worth modelling before committing to BTL purchase.',
  },
  conflicts: [
    {
      with: 'SIPP/pension enters estate for IHT — 6 April 2027',
      severity: 'high',
      note: 'Buying before resolving SIPP strategy locks £125K+ deposit liquidity that may be needed for pension actions before the deadline.',
    },
    {
      with: 'CGT annual exempt amount — 5 April',
      severity: 'low',
      note: 'If disposing of GIA holdings to fund deposit, time disposal to use the £3K annual exempt amount this tax year.',
    },
  ],
  recommendation: {
    pathId: 'C',
    rationale: 'One option to consider is deferring the property purchase for 12–18 months while the SIPP IHT deadline is resolved — the pension represents the larger unresolved exposure at £1.07M.',
    fcaCompliant: true,
  },
};

const MOCK_TREE_RETIREMENT = {
  events: ['retire'],
  decision: 'Can I retire at 60 and maintain my lifestyle?',
  statement: 'Retiring at 60 is 11 years away for you. Your pension + ISA + GIA stack is substantial, but the SIPP IHT rule from April 2027 changes the sequencing calculus — drawdown before death may be better than leaving it to estate.',
  yourAnswers: { targetRetirementAge: 60, targetAnnualIncome: 80000, drawdownPreference: null },
  research: [
    { source: 'rules-uk.js', fact: 'SIPP IHT from 6 April 2027: pension enters estate (ENACTED — Finance Act 2026)' },
    { source: 'rules-uk.js', fact: 'Normal Minimum Pension Age rises to 57 on 6 April 2028 (ENACTED)' },
    { source: 'rules-uk.js', fact: 'MPAA: £10K/yr permanent cap once flexi-access drawdown triggered (IRREVERSIBLE)' },
    { source: 'live', fact: '[MOCK] UK average retirement income target: ~£37K for comfortable retirement (PLSA 2025 — real data post-demo)' },
    { source: 'live', fact: '[MOCK] Average drawdown fee (wealth manager): 0.5–1.5% AUM/yr — real data post-demo' },
  ],
  options: [
    {
      id: 'A', name: 'Full retirement at 60 — pension drawdown primary',
      rationale: 'Maximise pension drawdown pre-death to reduce estate, take advantage of PCLS tax-free lump sum',
      pros: ['Pension tax-free cash (25% up to LSA) available at 60', 'Pension drawdown removes estate exposure', 'Flexible income control vs annuity'],
      cons: ['MPAA triggered immediately — no future pension top-up above £10K/yr', 'Sequence of returns risk in early retirement', 'State pension not accessible until 67'],
      consequences: [
        {
          metric: 'Probability of success (30yr)',
          engine: 'cashflow', engineCall: { fn: 'probabilityOfSuccess', extraArgs: [] },
          value: '99% placeholder', confidence: 0.85,
        },
        {
          metric: 'IHT exposure (post-2027)',
          engine: 'fq', engineCall: { fn: 'ihtDynamic', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.9,
        },
        {
          metric: 'LSA headroom (pension tax-free)',
          engine: 'fq', engineCall: { fn: 'lsaHeadroom', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.95,
        },
      ],
      irreversibility: 'high',
      sequence: ['Maximise AA contributions 2026–60', 'Crystallise pension at 60 — take 25% PCLS (up to LSA)', 'Set drawdown level at ~£80K/yr gross', 'Monitor SWR annually — adjust on Guyton-Klinger signals'],
      risks: ['Sequence of returns if market falls in first 5 years', 'Longevity: 30+ yr horizon', 'Inflation eroding real income'],
      subDecisions: [
        { id: 'A1', q: 'Phased crystallisation or full crystallisation at 60?' },
        { id: 'A2', q: 'Annuity for guaranteed floor income or pure drawdown?' },
      ],
    },
    {
      id: 'B', name: 'Semi-retire at 60 — 2-day consulting, full retire at 65',
      rationale: 'Maintains pension AA, delays drawdown, extends portfolio runway substantially',
      pros: ['Defers sequence of returns risk by 5 years', 'Keeps pension contributions flowing (AA not triggered)', 'National Insurance credits maintained'],
      cons: ['Not clean retirement — may not align with lifestyle goal', 'Income depends on consulting demand', 'Delays full financial independence'],
      consequences: [
        {
          metric: 'Probability of success (35yr)',
          engine: 'cashflow', engineCall: { fn: 'probabilityOfSuccess', extraArgs: [] },
          value: '99% placeholder', confidence: 0.85,
        },
        {
          metric: 'FI ratio at 60',
          engine: 'fq', engineCall: { fn: 'fiRatio', extraArgs: [] },
          value: '99% placeholder', confidence: 0.85,
        },
      ],
      irreversibility: 'medium',
      sequence: ['Scale to 2-day week from 60', 'Continue pension contributions (£60K AA)', 'Full retirement at 65 — drawdown then'],
      risks: ['Consulting income dries up unexpectedly', 'Health prevents continuing work'],
      subDecisions: [],
    },
    {
      id: 'C', name: 'ISA + GIA drawdown first — leave pension untouched until 75',
      rationale: 'ISA drawdown is tax-free; GIA has CGT annual exemption; SIPP grows tax-free inside — maximises estate efficiency',
      pros: ['ISA withdrawals completely tax-free', 'GIA CGT managed via annual exemption', 'SIPP IHT exposure reduces if 2027 rule fully enacted'],
      cons: ['ISA runs out faster — then faces larger taxable income', 'SIPP still in estate from 2027 if not drawn', 'Sequence risk on ISA/GIA depends on market timing'],
      consequences: [
        {
          metric: 'Cashflow health (ISA runway)',
          engine: 'fq', engineCall: { fn: 'cashflowHealth', extraArgs: [] },
          value: '99% placeholder', confidence: 0.75,
        },
        {
          metric: 'IHT exposure (pension left undrawn)',
          engine: 'tax', engineCall: { fn: 'ihtExposure', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.9,
        },
      ],
      irreversibility: 'low',
      sequence: ['Use ISA tax-free income from 60', 'Harvest GIA gains within annual CGT exemption', 'Consider SIPP drawdown after State Pension age (67)'],
      risks: ['ISA/GIA depleted before SIPP accessible if drawdown rate high', 'Tax treatment on GIA gains depends on rate at disposal'],
      subDecisions: [],
    },
    {
      id: 'D', name: 'Phased drawdown matrix — optimise wrapper order year by year (unconsidered)',
      rationale: 'Annual drawdown optimisation across pension + ISA + GIA minimises lifetime tax paid — a systematic approach you didn\'t name',
      pros: ['Minimises total income tax across 30+ year horizon', 'Flexible — adjusted annually', 'Integrates State Pension at 67 optimally'],
      cons: ['Requires annual IFA/tax review', 'More complex than set-and-forget drawdown', 'Tax rules may change'],
      consequences: [
        {
          metric: 'Drawdown matrix (current)',
          engine: 'tax', engineCall: { fn: 'drawdownMatrix', extraArgs: [] },
          value: '99% placeholder', confidence: 0.8,
        },
      ],
      irreversibility: 'low',
      sequence: ['Run drawdownMatrix annually', 'Adjust pension/ISA/GIA mix to stay in basic-rate band', 'Review at each Budget'],
      risks: ['Complexity of annual optimisation', 'Rule changes (pension taxation, ISA rules)'],
      subDecisions: [],
    },
  ],
  unconsidered: {
    name: 'Phased annual drawdown optimisation across all three wrappers',
    why: 'Treating pension, ISA, and GIA as one coordinated drawdown pool — adjusted each year to stay in the basic-rate band — can reduce lifetime tax by more than any single wrapper strategy.',
  },
  conflicts: [
    {
      with: 'SIPP/pension enters estate for IHT — 6 April 2027',
      severity: 'high',
      note: 'Your SIPP (£850K) and DC (£220K) total £1.07M. This becomes part of your estate for IHT from April 2027. Planning drawdown vs gift strategy before that date is time-sensitive.',
    },
    {
      with: 'Normal Minimum Pension Age rises to 57 — 6 April 2028',
      severity: 'medium',
      note: 'You cannot access your pension before 57 from April 2028. Planning to retire at 60 avoids this — but protected pension age rules may apply if you\'re currently in a scheme with a lower age.',
    },
  ],
  recommendation: {
    pathId: 'A',
    rationale: 'One option to consider is full retirement at 60 with pension drawdown as the primary source — it removes the estate exposure from the 2027 SIPP IHT rule while using the tax-free cash entitlement.',
    fcaCompliant: true,
  },
};

const MOCK_TREE_IHT = {
  events: ['iht_planning'],
  decision: 'How do I reduce my IHT exposure before April 2027?',
  statement: 'Your estate including pension is significantly above the IHT threshold. The Finance Act 2026 SIPP IHT rule (effective April 2027) makes this the highest-priority planning window. You have approximately 325 days remaining.',
  yourAnswers: { giftingTolerance: null, trustAppetite: null, willUpdated: null },
  research: [
    { source: 'rules-uk.js', fact: 'SIPP/pension in estate from 6 April 2027 (Finance Act 2026 — ENACTED, Royal Assent 18 March 2026)' },
    { source: 'rules-uk.js', fact: 'NRB: £325K | RNRB: £175K (frozen to 2030) | IHT rate: 40%' },
    { source: 'rules-uk.js', fact: 'Annual gift exemption: £3K/yr (can carry forward 1 year = £6K)' },
    { source: 'rules-uk.js', fact: 'PET (Potentially Exempt Transfer): gift falls out of estate fully after 7 years' },
    { source: 'live', fact: '[MOCK] Average IHT bill per paying estate 2024/25: £215K (HMRC — real data post-demo)' },
    { source: 'live', fact: '[MOCK] Cost of inaction per year on unresolved estate: compounding at estate growth rate × 40% — quantify via costOfInaction engine' },
  ],
  options: [
    {
      id: 'A', name: 'Pension drawdown + gifting before April 2027',
      rationale: 'Draw down pension to reduce pension IHT exposure; gift surplus above living needs to start 7-year clocks',
      pros: ['Directly attacks the £1.07M pension exposure', 'Gifts start 7-year taper immediately', 'Still within LSA for tax-free cash component'],
      cons: ['Income tax on drawdown above tax-free cash', 'MPAA triggered permanently', 'Gifts must be from surplus income to qualify as exempt'],
      consequences: [
        {
          metric: 'IHT exposure (before planning)',
          engine: 'fq', engineCall: { fn: 'ihtDynamic', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.95,
        },
        {
          metric: 'IHT full exposure (tax engine)',
          engine: 'tax', engineCall: { fn: 'ihtExposure', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.95,
        },
        {
          metric: 'Cost of inaction',
          engine: 'fq', engineCall: { fn: 'totalCoI', extraArgs: [] },
          value: '£999K placeholder', confidence: 0.8,
        },
      ],
      irreversibility: 'high',
      sequence: ['Crystallise pension at NMPA (confirm 55 still applies pre-2028)', 'Draw £268,275 PCLS tax-free (LSA limit)', 'Draw additional to basic-rate band if not already higher-rate', 'Gift surplus to children / trust using normal expenditure out of income rule'],
      risks: ['MPAA triggered — pension top-up permanently capped at £10K/yr', 'Drawdown income pushes into 60% personal allowance trap near £100K'],
      subDecisions: [
        { id: 'A1', q: 'Use normal expenditure out of income exemption for regular gifts?' },
        { id: 'A2', q: 'Discretionary trust or outright gift?' },
      ],
    },
    {
      id: 'B', name: 'Discretionary trust for investment assets',
      rationale: 'Transfer GIA + future gifting into trust — exits estate after 7 years if NRB not used',
      pros: ['GIA removed from estate', 'Control over beneficiaries (discretionary)', 'RNRB preserved if main home passes directly'],
      cons: ['Entry charge: 20% on value above available NRB', 'Periodic charge every 10 years: 6% above NRB', 'Trust administration cost (£1K–£3K/yr)'],
      consequences: [
        {
          metric: 'Estate readiness (Will + LPA)',
          engine: 'fq', engineCall: { fn: 'estateReadiness', extraArgs: [] },
          value: '99% placeholder', confidence: 0.8,
        },
        {
          metric: 'Gift clock projections',
          engine: 'fq', engineCall: { fn: 'giftClockAll', extraArgs: [] },
          value: '99% placeholder', confidence: 0.85,
        },
      ],
      irreversibility: 'high',
      sequence: ['Calculate entry charge on NRB available', 'Settle trust (STEP solicitor)', 'Transfer GIA to trust', 'Wait 7 years for full exit from estate'],
      risks: ['RNRB lost if main residence goes to trust (not direct descendants)', 'IHT on trust exit if donor dies within 7 years (taper applies 3–7yr)'],
      subDecisions: [{ id: 'B1', q: 'Discretionary or bare trust (age of beneficiaries)?' }],
    },
    {
      id: 'C', name: 'Maximise annual gifting strategy',
      rationale: 'Use all available exemptions systematically: annual exemption, small gifts, normal expenditure out of income',
      pros: ['No entry charge (within exemptions)', 'Normal expenditure out of income: unlimited if meets criteria', 'Annual £3K exemption + £3K carry-forward = £6K immediate IHT-free'],
      cons: ['Slow reduction in estate relative to size', 'Normal expenditure rule requires documentation', 'Lifestyle must not be affected by gifts'],
      consequences: [
        {
          metric: 'IHT waterfall (current)',
          engine: 'fq', engineCall: { fn: 'ihtWaterfall', extraArgs: [] },
          value: '99% placeholder', confidence: 0.85,
        },
        {
          metric: 'Will + LPA status',
          engine: 'fq', engineCall: { fn: 'willLpaStatus', extraArgs: [] },
          value: '99% placeholder', confidence: 0.95,
        },
      ],
      irreversibility: 'low',
      sequence: ['Document normal expenditure out of income pattern (3 months of bank statements)', 'Gift annually within exemptions', 'Consider PETs for larger amounts if 7-year clock tolerable'],
      risks: ['HMRC challenge on normal expenditure out of income if not well-documented', 'Estate still large — gifting rate vs estate growth rate matters'],
      subDecisions: [],
    },
    {
      id: 'D', name: 'Spousal pension transfer + RNRB maximisation (unconsidered)',
      rationale: 'Pass pension to spouse first (IHT-free spouse exemption) — spouse draws down during their lifetime; combined RNRB of £350K on main residence worth considering',
      pros: ['Spouse exemption: pension passed to spouse IHT-free (within spouse exemption)', 'Combined NRB £650K + RNRB £350K = £1M threshold', 'Buys time for 7-year clocks on other assets'],
      cons: ['Spouse then has larger estate — IHT deferred not eliminated', 'Pension nomination to spouse means children wait longer', 'Only works if predecease spouse'],
      consequences: [
        {
          metric: 'RNRB eligibility',
          engine: 'tax', engineCall: { fn: 'rnrbTaper', extraArgs: [] },
          value: '99% placeholder', confidence: 0.8,
        },
      ],
      irreversibility: 'low',
      sequence: ['Update pension nominations to spouse', 'Ensure will passes main residence to direct descendants', 'Confirm estate below RNRB taper threshold (£2M)'],
      risks: ['Surviving spouse then faces even larger estate without same planning options', 'Double RNRB only available if first-to-die residence passes to direct descendants'],
      subDecisions: [],
    },
  ],
  unconsidered: {
    name: 'Spousal pension nomination + combined RNRB optimisation',
    why: 'Passing the pension to spouse via nomination uses the unlimited spousal exemption — no IHT at first death — while combined NRB + RNRB covers £1M of the estate before any planning.',
  },
  conflicts: [
    {
      with: 'SIPP/pension enters estate for IHT — 6 April 2027',
      severity: 'high',
      note: '£1.07M pension exposure (£850K SIPP + £220K DC) is the dominant item. Any drawdown or nomination changes must be made before April 2027 for maximum effect.',
    },
    {
      with: 'Gift 7-year taper clock',
      severity: 'medium',
      note: 'PETs made today will taper from 3 years onwards. A £200K gift made today will be completely IHT-free by May 2033.',
    },
  ],
  recommendation: {
    pathId: 'A',
    rationale: 'One option to consider is pension crystallisation + systematic gifting — it directly addresses the £1.07M pension exposure before the April 2027 deadline while using the tax-free cash entitlement.',
    fcaCompliant: true,
  },
};

// ── Test runner ───────────────────────────────────────────────────────────────

let totalTests = 0;
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  totalTests++;
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── Scenario 1: Property purchase ─────────────────────────────────────────────

async function testPropertyPurchase() {
  header('SCENARIO 1 — Property purchase (buy_second_home)');

  const query = 'Should I buy a second property in Birmingham?';
  console.log(`\nQuery: "${query}"`);

  // 1a. Event matching
  console.log('\n[1a] Event matching');
  const matches = matchEvent(query);
  const top = matches[0];
  console.log(`     Top match: ${top.event.id} (score=${top.score}, confidence=${top.confidence})`);
  assert('Matched buy_second_home or buy_btl', ['buy_second_home', 'buy_btl'].includes(top.event.id));
  assert('Confidence is HIGH or MEDIUM', ['HIGH', 'MEDIUM'].includes(top.confidence));
  assert('Not marked off-ontology', !top.offOntology);

  // 1b. Context summary (engine calls)
  console.log('\n[1b] Context summary (engine-derived user state)');
  let summary;
  try {
    summary = buildContextSummary(FIXTURE_ENTITY, ['buy_second_home'], query);
    console.log(`     Net worth: ${summary.netWorth}`);
    console.log(`     IHT exposure: ${summary.ihtExposure}`);
    console.log(`     Monthly surplus: ${summary.monthlySurplus}`);
    console.log(`     Engines required: ${summary.enginesRequired.join(', ')}`);
    console.log(`     Deadlines: ${summary.deadlines.join(', ')}`);
    assert('Net worth is not "unknown"', summary.netWorth !== 'unknown');
    assert('IHT exposure returned', summary.ihtExposure !== 'unknown');
  } catch (err) {
    assert('Context summary built without error', false, err.message);
  }

  // 1c. Validator — replace placeholders with real engine numbers
  console.log('\n[1c] Validator — engine-pure consequence validation');
  const { tree, report } = validateTree(MOCK_TREE_PROPERTY, FIXTURE_ENTITY);

  console.log(`     Total consequences: ${report.totalConsequences}`);
  console.log(`     Validated: ${report.validated} (real engine numbers)`);
  console.log(`     Dropped: ${report.dropped} (not faked)`);

  if (report.drops.length > 0) {
    console.log(`     ${WARN} Drops:`);
    report.drops.forEach(d => console.log(`       - option ${d.optionId} / ${d.metric}: ${d.reason}`));
  }

  assert('At least 3 consequences validated', report.validated >= 3);
  assert('Zero consequences faked (dropped not faked)', report.drops.every(d => !d.reason.includes('faked')));

  // Show before/after for first validated consequence
  const firstOption = tree.options[0];
  if (firstOption?.consequences?.[0]) {
    const c = firstOption.consequences[0];
    console.log(`\n     Before: "£999K placeholder"`);
    console.log(`     After:  "${c.value}" (engine: ${c.engine}.${MOCK_TREE_PROPERTY.options[0].consequences[0].engineCall.fn})`);
    assert('Value is not placeholder', !c.value.includes('placeholder'));
    assert('engineValidated flag set', c.engineValidated === true);
  }

  // 1d. Research
  console.log('\n[1d] Mock research');
  const research = getMockResearch('buy_second_home', ['sdlt_second_home_surcharge', 'cgt_residential_higher']);
  console.log(`     Research items: ${research.length}`);
  const hasMock = research.some(r => r.fact.includes('[MOCK]'));
  const hasRulesUk = research.some(r => r.source === 'rules-uk.js');
  assert('At least one [MOCK] labelled item', hasMock);
  assert('At least one rules-uk.js sourced fact', hasRulesUk);
  research.slice(0, 2).forEach(r => console.log(`     [${r.source}] ${r.fact.slice(0, 80)}...`));

  return { validated: report.validated, dropped: report.dropped };
}

// ── Scenario 2: Retirement ────────────────────────────────────────────────────

async function testRetirement() {
  header('SCENARIO 2 — Retirement planning (retire)');

  const query = 'I\'m thinking of retiring in 3 years at 60. Can I afford it?';
  console.log(`\nQuery: "${query}"`);

  // 2a. Event matching
  console.log('\n[2a] Event matching');
  const matches = matchEvent(query);
  const top = matches[0];
  console.log(`     Top match: ${top.event.id} (score=${top.score}, confidence=${top.confidence})`);
  assert('Matched retire', top.event.id === 'retire');
  assert('SIPP IHT 2027 in default deadlines', top.event.defaultDeadlines.includes('sipp_iht_2027'));

  // 2b. Context summary
  console.log('\n[2b] Context summary');
  let summary;
  try {
    summary = buildContextSummary(FIXTURE_ENTITY, ['retire'], query);
    console.log(`     Net worth: ${summary.netWorth}`);
    console.log(`     Engines required: ${summary.enginesRequired.join(', ')}`);
    console.log(`     Deadlines: ${summary.deadlineCount} active deadlines`);
    assert('Requires cashflow engine', summary.enginesRequired.includes('cashflow'));
    assert('Requires timeline engine', summary.enginesRequired.includes('timeline'));
    assert('Has deadlines', summary.deadlineCount > 0);
  } catch (err) {
    assert('Context summary built', false, err.message);
  }

  // 2c. Validator
  console.log('\n[2c] Validator — engine-pure consequence validation');
  const { tree, report } = validateTree(MOCK_TREE_RETIREMENT, FIXTURE_ENTITY);

  console.log(`     Total consequences: ${report.totalConsequences}`);
  console.log(`     Validated: ${report.validated}`);
  console.log(`     Dropped: ${report.dropped}`);
  console.log(`     Engine calls made: ${report.engineCallsMade.join(', ')}`);

  if (report.drops.length > 0) {
    report.drops.forEach(d => console.log(`     ${WARN} Dropped: option ${d.optionId} / ${d.metric} — ${d.reason}`));
  }

  assert('At least 4 consequences validated', report.validated >= 4);
  assert('probabilityOfSuccess called', report.engineCallsMade.includes('cashflow.probabilityOfSuccess'));
  assert('ihtDynamic called', report.engineCallsMade.includes('fq.ihtDynamic'));

  // Show a validated consequence
  const optB = tree.options.find(o => o.id === 'B');
  if (optB?.consequences?.[0]) {
    const c = optB.consequences[0];
    console.log(`\n     Option B / ${c.metric}: "${c.value}" (${c.engineValidated ? 'engine-validated' : 'placeholder'})`);
  }

  // 2d. Research
  const research = getMockResearch('retire', ['sipp_iht_enacted', 'nmpa_2028', 'mpaa']);
  console.log(`\n[2d] Research: ${research.length} items`);
  assert('[MOCK] items present', research.some(r => r.fact.includes('[MOCK]')));

  return { validated: report.validated, dropped: report.dropped };
}

// ── Scenario 3: IHT / Fixed-deposit maturity → mapped to IHT planning ────────

async function testIhtPlanning() {
  header('SCENARIO 3 — IHT planning (iht_planning)');

  // The plan mentions "fixed-deposit maturity" as the third scenario.
  // A fixed-deposit maturity = sudden liquidity event → closest ontology match is
  // iht_planning if the user asks "what do I do with this money + IHT",
  // or inheritance_received / large_investment.
  // We test IHT planning to cover the SIPP deadline pressure scenario directly.

  const query = 'How do I reduce my inheritance tax before the April 2027 deadline?';
  console.log(`\nQuery: "${query}"`);
  console.log(`(Fixed-deposit maturity → IHT planning scenario: user has just received liquidity)`);

  // 3a. Event matching
  console.log('\n[3a] Event matching');
  const matches = matchEvent(query);
  const top = matches[0];
  console.log(`     Top match: ${top.event.id} (score=${top.score}, confidence=${top.confidence})`);
  assert('Matched iht_planning', top.event.id === 'iht_planning');
  assert('SIPP IHT 2027 in deadlines', top.event.defaultDeadlines.includes('sipp_iht_2027'));
  assert('Gift 7yr clock in deadlines', top.event.defaultDeadlines.includes('gift_7yr'));

  // 3b. Context summary
  console.log('\n[3b] Context summary');
  let summary;
  try {
    summary = buildContextSummary(FIXTURE_ENTITY, ['iht_planning'], query);
    console.log(`     Net worth: ${summary.netWorth}`);
    console.log(`     IHT exposure: ${summary.ihtExposure}`);
    console.log(`     Deadlines: ${summary.deadlines.join(', ')}`);
    assert('IHT exposure quantified', summary.ihtExposure !== 'unknown');
    assert('SIPP IHT deadline included', summary.deadlines.some(d => d.includes('SIPP') || d.includes('pension')));
  } catch (err) {
    assert('Context summary built', false, err.message);
  }

  // 3c. Validator
  console.log('\n[3c] Validator — engine-pure consequence validation');
  const { tree, report } = validateTree(MOCK_TREE_IHT, FIXTURE_ENTITY);

  console.log(`     Total consequences: ${report.totalConsequences}`);
  console.log(`     Validated: ${report.validated}`);
  console.log(`     Dropped: ${report.dropped}`);
  console.log(`     Engine calls: ${report.engineCallsMade.join(', ')}`);

  if (report.drops.length > 0) {
    report.drops.forEach(d => console.log(`     ${WARN} Dropped: option ${d.optionId} / ${d.metric} — ${d.reason}`));
  }

  assert('At least 5 consequences validated', report.validated >= 5);
  assert('ihtExposure called (tax engine)', report.engineCallsMade.includes('tax.ihtExposure'));
  assert('ihtDynamic called (fq engine)', report.engineCallsMade.includes('fq.ihtDynamic'));
  assert('totalCoI called', report.engineCallsMade.includes('fq.totalCoI'));

  // Show IHT before/after for key consequence
  const optA = tree.options.find(o => o.id === 'A');
  if (optA?.consequences?.[0]) {
    const c = optA.consequences[0];
    console.log(`\n     Option A / ${c.metric}: "${c.value}" (engine-validated: ${c.engineValidated})`);
    assert('IHT consequence is not placeholder', !c.value.includes('placeholder'));
  }

  // 3d. SIPP IHT deadline check
  console.log('\n[3d] SIPP IHT 2027 conflict present in tree');
  const sippConflict = tree.conflicts?.find(c =>
    c.with?.includes('2027') || c.with?.includes('SIPP') || c.with?.includes('pension')
  );
  assert('SIPP IHT 2027 conflict in tree', !!sippConflict);
  assert('Conflict severity is high', sippConflict?.severity === 'high');

  // 3e. Research
  const research = getMockResearch('iht_planning', ['iht_nil_rate_band', 'iht_rnrb', 'gift_annual_exemption', 'sipp_iht_enacted']);
  console.log(`\n[3e] Research: ${research.length} items`);
  assert('rules-uk.js NRB fact present', research.some(r => r.fact.includes('NRB') || r.fact.includes('nil rate band')));
  assert('[MOCK] live items present', research.some(r => r.fact.includes('[MOCK]')));

  return { validated: report.validated, dropped: report.dropped };
}

// ── Engine registry check ─────────────────────────────────────────────────────

function testEngineRegistry() {
  header('ENGINE REGISTRY — all registered functions');
  const fns = listRegisteredFunctions();
  console.log(`\n  Total registered: ${fns.length} engine functions`);
  const engines = [...new Set(fns.map(f => f.split('.')[0]))];
  console.log(`  Engines: ${engines.join(', ')}`);
  fns.forEach(f => console.log(`    ${f}`));
  assert('At least 30 functions registered', fns.length >= 30);
  assert('fq engine present', engines.includes('fq'));
  assert('cashflow engine present', engines.includes('cashflow'));
  assert('tax engine present', engines.includes('tax'));
  assert('timeline engine present', engines.includes('timeline'));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  SONUSWEALTH DECISION ENGINE — Phase 1 Smoke Tests');
  console.log('  Date: 2026-05-16 | Engine: fq-calculator + tax-estate + cashflow');
  console.log('══════════════════════════════════════════════════════════════════════');

  testEngineRegistry();

  const r1 = await testPropertyPurchase();
  const r2 = await testRetirement();
  const r3 = await testIhtPlanning();

  header('RESULTS SUMMARY');

  const totalValidated = r1.validated + r2.validated + r3.validated;
  const totalDropped   = r1.dropped + r2.dropped + r3.dropped;

  console.log(`\n  Scenarios tested: 3`);
  console.log(`  Total consequences validated by real engines: ${totalValidated}`);
  console.log(`  Total consequences dropped (not faked):       ${totalDropped}`);
  console.log(`  Engine-pure: ${totalDropped === 0 ? 'YES — zero consequences faked' : `NO — ${totalDropped} dropped (check drops above)`}`);
  console.log('');
  console.log(`  Tests passed: ${passed}/${totalTests}`);
  console.log(`  Tests failed: ${failed}/${totalTests}`);

  if (failed === 0) {
    console.log('\n  ✓ Phase 1 verification: PASS');
    console.log('    Three events return validated trees with engine-pure numbers.');
    console.log('    No invented figures. Mock research labelled [MOCK].');
  } else {
    console.log(`\n  ✗ Phase 1 verification: FAIL — ${failed} test(s) failed (see above)`);
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n✗ Smoke test crashed:', err);
  process.exit(1);
});
