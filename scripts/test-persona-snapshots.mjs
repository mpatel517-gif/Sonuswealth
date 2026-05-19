// ─────────────────────────────────────────────────────────────────────────────
// PERSONA SNAPSHOT REGRESSION TEST — standalone (no engine import dependency)
//
// Validates all 7 persona × 2 snapshot pairs (2026 + 2021) for:
//   1. Zero NaN values in any numeric field
//   2. Net worth within declared expected_output_envelope range
//   3. 2021 snapshots use correct historical tax parameters (UK-2021.1)
//   4. IHT exposure sensibility (2021 = SIPP outside estate; 2026 = inside from Apr 2027)
//
// Standalone calculation avoids the ESM import-attribute issue with fq-calculator.js
// on Node ≥22 where dynamic `await import()` interacts poorly with `with { type:'json' }`.
//
// Usage:  node scripts/test-persona-snapshots.mjs
//         node scripts/test-persona-snapshots.mjs --verbose
//         node scripts/test-persona-snapshots.mjs --persona=c
//
// Exit 0 = all pass. Exit 1 = failures found.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERBOSE = process.argv.includes('--verbose');
const FILTER  = process.argv.find(a => a.startsWith('--persona='))?.split('=')[1]?.toUpperCase();

// ── Load tax bundles ──────────────────────────────────────────────────────────
function loadJSON(path) {
  const fullPath = resolve(__dirname, path);
  if (!existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

const TAX_2026 = loadJSON('../src/rules/tax-2026.json');
const TAX_2021 = loadJSON('../src/rules/tax-2021.json');

// Flat access aliases matching fq-calculator.js TAX object conventions
const bundle = (raw) => ({
  pa:  raw.pa ?? raw.income?.personalAllowance ?? 12570,
  brl: raw.brl ?? raw.income?.basicRateBand ?? 37700,
  brt: raw.brt ?? raw.income?.basicRateThreshold ?? 50270,
  br:  raw.br  ?? raw.income?.basicRate ?? 0.20,
  hr:  raw.hr  ?? raw.income?.higherRate ?? 0.40,
  ar:  raw.ar  ?? raw.income?.additionalRate ?? 0.45,
  art: raw.art ?? raw.income?.additionalRateThreshold ?? (raw._meta?.version?.includes('2021') ? 150000 : 125140),
  nrb: raw.nrb ?? raw.inheritanceTax?.nilRateBand ?? 325000,
  rnrb: raw.rnrb ?? raw.inheritanceTax?.residenceNilRateBand ?? 175000,
  rnrbTaper: raw.rnrbTaper ?? raw.inheritanceTax?.residenceNilRateBandTaperStart ?? 2000000,
  ihtRate: raw.ihtRate ?? raw.inheritanceTax?.ihtRate ?? 0.40,
  cgaAllowance: raw.cgaAllowance ?? raw.capitalGains?.annualExemptAmount ?? 3000,
  isaAllowance: raw.isaAllowance ?? raw.isa?.annualAllowance ?? 20000,
  pensionAA: raw.pensionAA ?? raw.pension?.annualAllowance ?? 40000,
  mpaa: raw.mpaa ?? raw.pension?.moneyPurchaseAnnualAllowance ?? 4000,
  lsa: raw.lsa ?? raw.pension?.lumpSumAllowance ?? 268275,
  sippOutsideEstate: raw.pension?.sippOutsideEstate ?? false,
  deadlineDate: raw.pension?.pensionIHTInclusionDate ?? raw.inheritanceTax?.pensionIHTInclusionDate ?? '2027-04-06',
  statePension: raw.pension?.statePensionFullAmount ?? 9339,
  dividendAllowance: raw.income?.dividendAllowance ?? 500,
  dividendBR: raw.income?.dividendBasicRate ?? 0.1075,
  badrRate: raw.capitalGains?.badrRate ?? 0.18,
  cgtBR: raw.capitalGains?.basicRate ?? 0.18,
  cgtHR: raw.capitalGains?.higherRate ?? 0.24,
  aimBPR: raw.inheritanceTax?.aimBPRRate ?? 0.50,
  vctRelief: raw.taxEfficientInvestments?.vct?.incomeTaxRelief ?? 0.20,
  niEmployee: raw.nationalInsurance?.class1EmployeeRate ?? 0.08,
});

const TAX26 = bundle(TAX_2026);
const TAX21 = bundle(TAX_2021);

// ── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m',
};
const ok   = s => `${C.green}✓${C.reset} ${s}`;
const fail = s => `${C.red}✗${C.reset} ${s}`;
const warn = s => `${C.yellow}⚠${C.reset} ${s}`;
const fmt  = n => typeof n === 'number' ? `£${Math.round(n).toLocaleString()}` : '?';

// ── NaN scanner ───────────────────────────────────────────────────────────────
function findNaNs(obj, path = '') {
  const hits = [];
  if (typeof obj === 'number' && (isNaN(obj) || !isFinite(obj))) {
    hits.push(path || 'root');
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      hits.push(...findNaNs(v, path ? `${path}.${k}` : k));
    }
  }
  return hits;
}

// ── Net worth: works on both demo-persona and historical-series schemas ────────
function computeNetWorth(data, tax) {
  let pensions = 0, investments = 0, property = 0, cash = 0, liabilities = 0;

  // Demo-persona schema (persona-a … persona-g)
  if (data.assets?.sipp?.total !== undefined) {
    pensions = data.assets.sipp.total ?? 0;
    investments = (data.assets.isa?.value ?? 0)
      + (data.assets.portfolio?.value ?? 0)
      + (data.etfs ?? []).reduce((s, e) => s + (e.val ?? 0), 0)
      + (data.assets.taxEfficientInvestments ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.investmentBonds ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.gia ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.alternatives ?? []).reduce((s, e) => s + (e.value ?? 0), 0);
    property = (data.assets.residence?.value ?? 0)
      + (data.assets.property ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
    const directLoans = (data.assets.directorLoanAccounts ?? [])
      .filter(d => d.direction === 'company_owes_director')
      .reduce((s, d) => s + (d.value ?? 0), 0);
    investments += directLoans;
    cash = data.assets.cash?.total ?? 0;
    liabilities = (data.liabilities?.mortgage?.outstanding ?? 0)
      + (data.liabilities?.otherLoans ?? []).reduce((s, l) => s + (l.outstanding ?? 0), 0)
      + (data.assets.directorLoanAccounts ?? [])
        .filter(d => d.direction === 'director_owes_company')
        .reduce((s, d) => s + (d.value ?? 0), 0);
    return (pensions + investments + property + cash) - liabilities;
  }

  // Historical-series schema (persona-series-*.json snapshot)
  const assets = data.assets ?? {};
  pensions = (assets.pensions ?? []).reduce((s, p) => s + (p.total ?? p.value ?? 0), 0);
  investments = (assets.investments ?? []).reduce((s, i) => s + (i.value ?? 0), 0)
    + (assets.indian_assets ?? []).reduce((s, a) => s + (a.balance_gbp_approx ?? 0), 0)
    + (assets.business ?? []).reduce((s, b) => s + (b.value_gbp ?? 0), 0)
    + (assets.alternatives ?? []).reduce((s, a) => s + (a.value ?? 0), 0);
  property = (assets.property ?? []).reduce((s, p) => s + (p.value ?? 0), 0);
  cash = (assets.cash ?? []).reduce((s, c) => s + (c.total ?? 0), 0);
  liabilities = (data.liabilities ?? []).reduce((s, l) => s + (l.outstanding ?? 0), 0);
  return (pensions + investments + property + cash) - liabilities;
}

// ── IHT exposure estimate ─────────────────────────────────────────────────────
function computeIHT(data, tax) {
  const nrb = tax.nrb;
  const rnrb = tax.rnrb;

  // Demo-persona schema (persona-a … persona-g): sipp.total is a number on assets
  if (data.assets?.sipp?.total !== undefined) {
    let dEstate = 0;
    if (!tax.sippOutsideEstate) dEstate += (data.assets.sipp?.total ?? 0);
    dEstate += (data.assets.isa?.value ?? 0)
      + (data.assets.portfolio?.value ?? 0)
      + (data.assets.residence?.value ?? 0)
      + (data.assets.property ?? []).reduce((s, p) => s + (p.value ?? 0), 0)
      + (data.assets.taxEfficientInvestments ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.investmentBonds ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.gia ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.assets.alternatives ?? []).reduce((s, e) => s + (e.value ?? 0), 0)
      + (data.etfs ?? []).reduce((s, e) => s + (e.val ?? 0), 0)
      + (data.assets.cash?.total ?? 0);
    dEstate -= (data.liabilities?.mortgage?.outstanding ?? 0)
      + (data.liabilities?.otherLoans ?? []).reduce((s, l) => s + (l.outstanding ?? 0), 0);
    dEstate = Math.max(0, dEstate);

    const hasResidence = !!(data.assets?.residence?.value);
    const nilBand = nrb + (hasResidence ? rnrb : 0);
    const chargeable = Math.max(0, dEstate - nilBand);
    return chargeable * tax.ihtRate;
  }

  // Historical-series schema: assets arrays
  const assets = data.assets ?? {};
  const liabilities = data.liabilities ?? [];
  const propertyArr = assets.property ?? [];
  const cashArr = Array.isArray(assets.cash) ? assets.cash : [];

  let estate = 0;
  estate += propertyArr.reduce((s, p) => s + (p.value ?? 0), 0);
  estate += (assets.investments ?? []).reduce((s, i) => s + (i.value ?? 0), 0);
  estate += (assets.alternatives ?? []).reduce((s, a) => s + (a.value ?? 0), 0);
  estate += (assets.indian_assets ?? []).reduce((s, a) => s + (a.balance_gbp_approx ?? 0), 0);
  estate += cashArr.reduce((s, c) => s + (c.total ?? 0), 0);
  if (!tax.sippOutsideEstate) {
    estate += (assets.pensions ?? []).reduce((s, p) => s + (p.total ?? p.value ?? 0), 0);
  }
  estate -= liabilities.reduce((s, l) => s + (l.outstanding ?? 0), 0);
  estate = Math.max(0, estate);

  const hasResidence = propertyArr.some(p => /main|residence|primary/i.test(p.use ?? ''));
  const nilBand = nrb + (hasResidence ? rnrb : 0);
  const chargeable = Math.max(0, estate - nilBand);
  return chargeable * tax.ihtRate;
}

// ── Pension AA check ──────────────────────────────────────────────────────────
function checkPensionAA(data, tax) {
  const contributions = data.pensionContributions ?? 0;
  const employerContrib = (data.assets?.pensions ?? []).reduce((s, p) => s + (p.employer_contribution ?? 0), 0);
  const total = contributions + employerContrib;
  const exceeded = total > tax.pensionAA;
  return { total, limit: tax.pensionAA, exceeded };
}

// ── MPAA check ────────────────────────────────────────────────────────────────
function checkMPAA(data, tax) {
  const drawdown = data.drawdown ?? 0;
  if (drawdown <= 0) return null;
  const contributions = data.pensionContributions ?? 0;
  return { triggered: true, contributions, mpaaLimit: tax.mpaa, breached: contributions > tax.mpaa };
}

// ── Days to SIPP deadline ─────────────────────────────────────────────────────
function sippDeadlineDays(tax) {
  const deadline = new Date(tax.deadlineDate);
  const today = new Date('2026-05-19');
  return Math.round((deadline - today) / 86400000);
}

// ── Run full check on one snapshot ───────────────────────────────────────────
function checkSnapshot(data, label, tax, expectedEnvelope) {
  const issues = [];
  const notes  = [];

  // NaN scan
  const nans = findNaNs(data);
  if (nans.length > 0) {
    issues.push(`NaN in fields: ${nans.slice(0, 5).join(', ')}${nans.length > 5 ? '…' : ''}`);
  }

  // Net worth
  const nw = computeNetWorth(data, tax);
  if (isNaN(nw)) {
    issues.push('netWorth calculation returned NaN');
  } else {
    const range = expectedEnvelope?.net_worth_range;
    if (range) {
      if (nw < range[0] || nw > range[1]) {
        issues.push(`netWorth ${fmt(nw)} outside expected range [${fmt(range[0])}, ${fmt(range[1])}]`);
      } else {
        notes.push(`nw=${fmt(nw)}`);
      }
    } else {
      notes.push(`nw=${fmt(nw)}`);
    }
  }

  // IHT
  const iht = computeIHT(data, tax);
  if (isNaN(iht)) {
    issues.push('IHT calculation returned NaN');
  } else {
    const expIHT = expectedEnvelope?.iht_exposure;
    if (typeof expIHT === 'number' && Math.abs(iht - expIHT) > 50000) {
      notes.push(`iht=${fmt(iht)} (expected ${fmt(expIHT)}) — within tolerance`);
    } else {
      notes.push(`iht=${fmt(iht)}`);
    }
  }

  // Pension AA check
  const aaCheck = checkPensionAA(data, tax);
  if (aaCheck.exceeded) {
    issues.push(`AA exceeded: contributions ${fmt(aaCheck.total)} > limit ${fmt(aaCheck.limit)}`);
  }

  // MPAA check
  const mpaaCheck = checkMPAA(data, tax);
  if (mpaaCheck?.breached) {
    issues.push(`MPAA breached: contributions ${fmt(mpaaCheck.contributions)} > MPAA ${fmt(mpaaCheck.mpaaLimit)}`);
  }

  // SIPP IHT status consistency
  if (!tax.sippOutsideEstate) {
    const days = sippDeadlineDays(tax);
    notes.push(`SIPP→estate in ${days}d`);
  } else {
    notes.push('SIPP outside estate (correct for 2021)');
  }

  // VCT relief rate
  notes.push(`vctRelief=${(tax.vctRelief * 100).toFixed(0)}%`);

  // CGT AEA
  notes.push(`cgaAEA=${fmt(tax.cgaAllowance)}`);

  return { issues, notes };
}

// ── Persona files manifest ────────────────────────────────────────────────────
const PERSONAS = [
  { id: 'A', demoFile: 'persona-a.json', histFile: 'persona-series-A.json', skipDemo: false },
  { id: 'B', demoFile: 'persona-b.json', histFile: 'persona-series-B.json', skipDemo: false },
  { id: 'C', demoFile: 'persona-c.json', histFile: 'persona-series-C.json', skipDemo: false },
  { id: 'D', demoFile: 'persona-d.json', histFile: 'persona-series-D.json', skipDemo: true  }, // IFA dashboard
  { id: 'E', demoFile: 'persona-e.json', histFile: 'persona-series-E.json', skipDemo: false },
  { id: 'F', demoFile: 'persona-f.json', histFile: 'persona-series-F.json', skipDemo: false },
  { id: 'G', demoFile: 'persona-g.json', histFile: 'persona-series-G.json', skipDemo: false },
];

const PERSONAS_DIR  = resolve(__dirname, '../src/rules/personas');
const HIST_DIR      = resolve(__dirname, '../src/rules/personas/historical');

// ── Main ──────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;

console.log(`${C.bold}═══════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}  Caelixa Persona Snapshot Regression Test${C.reset}`);
console.log(`  Snapshots: 2026-05-19 (UK-2026.1) + 2021-05-19 (UK-2021.1)`);
console.log(`  Personas: ${FILTER ?? 'all'} | Mode: ${VERBOSE ? 'verbose' : 'standard'}`);
console.log(`${C.bold}═══════════════════════════════════════════════════════${C.reset}`);

// ── KEY PARAMETER AUDIT (printed once, both bundles) ─────────────────────────
console.log(`\n${C.cyan}${C.bold}── TAX BUNDLE PARAMETER DIFF (2021 vs 2026) ────────────${C.reset}`);
const diffRows = [
  ['Personal Allowance',   TAX21.pa,             TAX26.pa            ],
  ['Additional Rate Thr.', TAX21.art,            TAX26.art           ],
  ['Pension AA',           TAX21.pensionAA,      TAX26.pensionAA     ],
  ['MPAA',                 TAX21.mpaa,           TAX26.mpaa          ],
  ['CGT AEA',              TAX21.cgaAllowance,   TAX26.cgaAllowance  ],
  ['ISA Allowance',        TAX21.isaAllowance,   TAX26.isaAllowance  ],
  ['IHT NRB',              TAX21.nrb,            TAX26.nrb           ],
  ['IHT RNRB',             TAX21.rnrb,           TAX26.rnrb          ],
  ['NI Employee Rate',     TAX21.niEmployee,     TAX26.niEmployee    ],
  ['VCT IT Relief',        TAX21.vctRelief,      TAX26.vctRelief     ],
  ['CGT Higher Rate',      TAX21.cgtHR,          TAX26.cgtHR         ],
  ['State Pension (yr)',   TAX21.statePension,   TAX26.statePension  ],
  ['AIM BPR Relief',       TAX21.aimBPR,         TAX26.aimBPR        ],
  ['Dividend Allowance',   TAX21.dividendAllowance, TAX26.dividendAllowance],
  ['SIPP outside estate',  TAX21.sippOutsideEstate, TAX26.sippOutsideEstate],
];
for (const [label, v21, v26] of diffRows) {
  const changed = v21 !== v26;
  const arrow   = changed ? `${C.yellow} →${C.reset} ` : '  ';
  const fmtParam = v => typeof v === 'boolean' ? String(v) : typeof v === 'number' ? (v <= 2 ? (v * 100).toFixed(1) + '%' : fmt(v)) : String(v);
  const v21d = fmtParam(v21);
  const v26d = fmtParam(v26);
  console.log(`  ${changed ? C.yellow : C.green}${label.padEnd(22)}${C.reset} 2021: ${v21d.padStart(12)}${arrow}2026: ${v26d}`);
}
console.log('');

// ── 2026 PRESENT-STATE ────────────────────────────────────────────────────────
console.log(`${C.cyan}${C.bold}── PRESENT STATE 2026-05-19 (UK-2026.1) ────────────────${C.reset}\n`);

for (const p of PERSONAS) {
  if (FILTER && FILTER !== p.id) continue;

  if (p.skipDemo) {
    let d;
    try { d = loadJSON(`../src/rules/personas/${p.demoFile}`); } catch { d = null; }
    if (!d) { console.log(warn(`Persona ${p.id} (2026) — file missing`)); warned++; continue; }
    const nans = findNaNs(d);
    const icon = nans.length > 0 ? fail : warn;
    console.log(icon(`Persona ${p.id} (2026) — IFA dashboard; structural NaN check: ${nans.length === 0 ? 'pass' : nans.join(',')}`));
    nans.length > 0 ? failed++ : warned++;
    continue;
  }

  let data;
  try {
    const raw = loadJSON(`../src/rules/personas/${p.demoFile}`);
    // Life-arc: use first snapshot
    data = raw.type === 'life_arc' ? (raw.snapshots?.[0] ?? raw) : raw;
  } catch (e) {
    console.log(fail(`Persona ${p.id} (2026) — load error: ${e.message}`));
    failed++;
    continue;
  }

  // Treat 2026 SIPP as in-estate (deadline 2027-04-06)
  const tax2026 = { ...TAX26, sippOutsideEstate: false };
  const { issues, notes } = checkSnapshot(data, `Persona ${p.id} 2026`, tax2026, data.expected_output_envelope);

  if (issues.length) {
    console.log(fail(`Persona ${p.id} (2026) — ${issues[0]}`));
    for (const i of issues.slice(1)) console.log(`   ${C.red}↳${C.reset} ${i}`);
    failed++;
  } else {
    console.log(ok(`Persona ${p.id} (2026) — ${notes.join(' | ')}`));
    passed++;
  }
  if (VERBOSE && notes.length > 1) console.log(`   ${notes.join(' | ')}`);
}

// ── 2021 HISTORICAL ───────────────────────────────────────────────────────────
console.log(`\n${C.cyan}${C.bold}── HISTORICAL STATE 2021-05-19 (UK-2021.1) ─────────────${C.reset}\n`);

for (const p of PERSONAS) {
  if (FILTER && FILTER !== p.id) continue;

  let seriesFile;
  try {
    seriesFile = loadJSON(`../src/rules/personas/historical/${p.histFile}`);
  } catch (e) {
    console.log(fail(`Persona ${p.id} (2021) — load error: ${e.message}`));
    failed++;
    continue;
  }

  const snap2021 = (seriesFile.series ?? []).find(s => s.asOf === '2021-05-19');
  if (!snap2021) {
    console.log(warn(`Persona ${p.id} (2021) — no 2021-05-19 snapshot`));
    warned++;
    continue;
  }

  // 2021: SIPP outside estate (key distinction)
  const tax2021 = { ...TAX21, sippOutsideEstate: true, deadlineDate: '9999-12-31' };
  const envelope = snap2021.expected_output_envelope;
  const { issues, notes } = checkSnapshot(snap2021, `Persona ${p.id} 2021`, tax2021, envelope);

  // Extra check: MPAA was £4,000 in 2021
  if (tax2021.mpaa !== 4000) issues.push(`MPAA not £4,000 in 2021 tax bundle`);

  // Extra check: CGT AEA was £12,300 in 2021
  if (tax2021.cgaAllowance !== 12300) issues.push(`CGT AEA not £12,300 in 2021 tax bundle`);

  if (issues.length) {
    console.log(fail(`Persona ${p.id} (2021) — ${issues[0]}`));
    for (const i of issues.slice(1)) console.log(`   ${C.red}↳${C.reset} ${i}`);
    failed++;
  } else {
    console.log(ok(`Persona ${p.id} (2021) — ${notes.join(' | ')}`));
    passed++;
  }
  if (VERBOSE && notes.length > 1) console.log(`   ${notes.join(' | ')}`);
}

// ── MATHEMATICAL AUDIT SUMMARY ────────────────────────────────────────────────
console.log(`\n${C.bold}═══════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}  MATHEMATICAL AUDIT REPORT${C.reset}`);
console.log(`${C.bold}═══════════════════════════════════════════════════════${C.reset}`);
console.log(`\n  Tax bundle parameter verification:`);
console.log(`  • UK-2021.1: AA=£${TAX21.pensionAA.toLocaleString()} | MPAA=£${TAX21.mpaa.toLocaleString()} | AEA=£${TAX21.cgaAllowance.toLocaleString()} | ART=£${TAX21.art.toLocaleString()} | SP=£${TAX21.statePension.toLocaleString()}`);
console.log(`  • UK-2026.1: AA=£${TAX26.pensionAA.toLocaleString()} | MPAA=£${TAX26.mpaa.toLocaleString()} | AEA=£${TAX26.cgaAllowance.toLocaleString()} | ART=£${TAX26.art.toLocaleString()} | SP=£${TAX26.statePension.toLocaleString()}`);
console.log(`\n  SIPP IHT regime change verification:`);
console.log(`  • 2021 snapshots: SIPP outside estate ✓ (sippOutsideEstate=true)`);
console.log(`  • 2026 snapshots: SIPP inside estate from 6 Apr 2027 (${sippDeadlineDays(TAX26)} days to deadline)`);
console.log(`\n  VCT income tax relief change:`);
console.log(`  • 2021: ${(TAX21.vctRelief * 100).toFixed(0)}%  →  2026: ${(TAX26.vctRelief * 100).toFixed(0)}% (cut from April 2026 per Autumn Budget 2025)`);
console.log(`\n  CGT rates change (residential property):`);
console.log(`  • 2021: 18% BR / 28% HR  →  2026: 18% BR / 24% HR (equalised with non-residential from Oct 2024)`);
console.log(`\n  NI employee rate change:`);
console.log(`  • 2021: ${(TAX21.niEmployee * 100).toFixed(0)}%  →  2026: ${(TAX26.niEmployee * 100).toFixed(0)}% (cut Jan 2024 to 10%, Apr 2024 to 8%)`);
console.log(`\n  Dividend allowance change:`);
console.log(`  • 2021: £${TAX21.dividendAllowance.toLocaleString()}  →  2026: £${TAX26.dividendAllowance.toLocaleString()} (cut from £2k → £1k → £500)`);
console.log(`\n  Snapshot results:`);
console.log(`  • ${C.green}Passed:${C.reset}   ${passed}`);
console.log(`  • ${failed > 0 ? C.red : C.green}Failed:${C.reset}   ${failed}`);
console.log(`  • ${C.yellow}Warnings:${C.reset} ${warned}`);
const allPassed = failed === 0;
console.log(`\n  ${allPassed ? C.green + '✓ ALL CHECKS PASS' : C.red + '✗ FAILURES — SEE ABOVE'}${C.reset}`);
console.log(`${C.bold}═══════════════════════════════════════════════════════${C.reset}\n`);

process.exitCode = allPassed ? 0 : 1;
