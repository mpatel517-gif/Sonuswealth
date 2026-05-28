// ─────────────────────────────────────────────────────────────────────────────
// v0.3 ROUTE-SPECS — PHASE 5 / ROUTE 2 (Income Statement) SANITY TEST
//
// Static-inspection style. Verifies Phase 5 R2 contracts:
//   A1.  Hero Sankey imported from shared chart kit + rendered as JSX.
//   A2.  Net take-home headline = calcANI driven (single source of truth).
//   A4.  ANI cliff progress bar with markers at TAX.adjustedNetIncomeCliff
//        AND a computed end (cliffStart + 2 × PA = £125,140 with current bundle).
//   A5.  HICBC chip imported and rendered (visibility gated inside the chip
//        via TAX.hicbcFloor / hicbcCeiling).
//   A6.  Director-extraction card + EmployerNIC chip rendered behind director gate.
//   A7.  Sole-trader NIC card renders Class 4 main rate from TAX.nicClass4Main.
//   A10. Band-order arithmetic test — Mr T employment £45k + savings £1k +
//        dividends £2k → all three stay in BR via calcIncomeTax.
//   A11. NIC SEPARATE from income tax in receipt — no co-mingling.
//   A12. No hardcoded thresholds in MoneyIncome.jsx (12570 / 50270 / 60000 /
//        80000 / 100000 / 125140 / 200000 / 260000, plus 0.08 / 0.06 / 0.1075 /
//        0.3575 / 0.3935 / 0.15 / 5000). Inline literals inside string
//        templates that reflect canonical figures are allowed only as labels.
//   A15. G7 verb-grep clean — zero matches for forbidden verbs.
//   A16. G7.5 structural — ANI cliff does NOT have a "Reduce ANI" CTA; HICBC
//        chip uses verbatim "Child Benefit tapers between..." copy.
//   A18. G16 verbatim copy — HICBC + Employer NIC + disclaimer strings.
//
// Run: node tests/v0.3-phase-5-r2.test.js
// Exit code: 0 = pass, 1 = fail.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const fails = [];

function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    fails.push(label);
    console.log(`  ✗ ${label}`);
  }
}

function read(rel) {
  const full = resolve(ROOT, rel);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

console.log('=== v0.3 Phase 5 / R2 (Income Statement) ===\n');

const r2 = read('src/screens/MoneyIncome.jsx');
check('MoneyIncome.jsx exists', r2 !== null);

// ── A1: Sankey wiring ────────────────────────────────────────────────────────
console.log('\nA1. Sankey hero wiring:');
check('  Sankey imported from charts barrel',
  /import\s*\{[^}]*Sankey[^}]*\}\s*from\s*['"]\.\.\/components\/charts(?:\/index\.js)?['"]/.test(r2));
check('  Sankey rendered as JSX', /<Sankey\b/.test(r2));
check('  buildSankeyModel produces nodes + links', /function buildSankeyModel/.test(r2)
  && /nodes\s*=\s*\[\]/.test(r2) && /links\s*=\s*\[\]/.test(r2));
check('  source / stage / sink node types used',
  /type:\s*['"]source['"]/.test(r2) && /type:\s*['"]stage['"]/.test(r2) && /type:\s*['"]sink['"]/.test(r2));

// ── A2: net take-home consistency ────────────────────────────────────────────
console.log('\nA2. Net take-home consistency:');
check('  calcANI imported from fq-calculator',
  /import\s*\{[^}]*calcANI[^}]*\}\s*from\s*['"]\.\.\/engine\/fq-calculator(?:\.js)?['"]/.test(r2));
check('  calcAllIncome imported', /calcAllIncome/.test(r2));
check('  calcIncomeTax imported', /calcIncomeTax/.test(r2));
// ANI rendered once in the ANI cliff section
const aniRenderMatches = r2.match(/£\$\{[^}]*Math\.round\(ani\)/g) || [];
check('  ANI rendered as derived value', aniRenderMatches.length >= 1);
// Net take-home derived from gross - tax - NIC
check('  netIncome = gross - incomeTaxTotal - totalNI',
  /netIncome\s*=\s*Math\.max\(0,\s*gross\s*-\s*incomeTaxTotal\s*-\s*totalNI\)/.test(r2));

// ── A4: ANI cliff bar uses TAX.adjustedNetIncomeCliff ────────────────────────
console.log('\nA4. ANI cliff bar:');
check('  TAX.adjustedNetIncomeCliff referenced', /TAX\.adjustedNetIncomeCliff/.test(r2));
check('  taper-end computed (not hardcoded 125140)',
  /cliffStart\s*\+\s*2\s*\*\s*TAX\.pa/.test(r2));

// ── A5: HICBC chip wired ─────────────────────────────────────────────────────
console.log('\nA5. HICBC chip:');
check('  HICBCTile imported from PersonaGapTiles',
  /import\s*\{[^}]*HICBCTile[^}]*\}\s*from\s*['"]\.\.\/components\/MyMoney\/PersonaGapTiles(?:\.jsx)?['"]/.test(r2));
check('  HICBCTile rendered as JSX', /<HICBCTile\b/.test(r2));
// Verbatim copy lives inside the chip itself — verify in PersonaGapTiles
const pgt = read('src/components/MyMoney/PersonaGapTiles.jsx');
check('  HICBC verbatim copy preserved in PersonaGapTiles',
  /Child Benefit tapers between £60k and £80k of ANI\./.test(pgt));

// ── A6: Director extraction + EmployerNIC ────────────────────────────────────
console.log('\nA6. Director extraction + EmployerNIC:');
check('  EmployerNICTile imported', /EmployerNICTile/.test(r2));
check('  EmployerNICTile rendered behind director gate',
  /director\s*&&[\s\S]{0,800}<EmployerNICTile/.test(r2));
check('  Director extraction copy verbatim',
  /Salary, dividends, and employer pension are taxed under different regimes\./.test(r2));
check('  Employer NIC verbatim copy preserved in PersonaGapTiles',
  /Employer NIC · 15% on salary above £5,000 threshold \(from April 2025\)\. Annual liability: £/.test(pgt));

// ── A7: Sole-trader Class 4 ──────────────────────────────────────────────────
console.log('\nA7. Sole-trader Class 4:');
check('  Class 4 NIC main rate via TAX.nicClass4Main',
  /TAX\.nicClass4Main/.test(r2));
check('  isSoleTrader detection function exists', /function isSoleTrader/.test(r2));

// ── A10: band-order arithmetic — synthetic Mr T fixture ──────────────────────
console.log('\nA10. Band-order arithmetic (synthetic Mr T fixture):');
// Mr T: employment £45,000, savings £1,000, dividends £2,000
// PA: £12,570 → employment − PA = £32,430 non-savings taxable, all in BR
// Savings £1,000 covered by PSA £1,000 → £0 tax
// Dividends £2,000: divAllowance £500, then £1,500 in BR @ 10.75% = £161.25
// Total: £32,430 × 20% + £161.25 = £6,486 + £161.25 ≈ £6,647.25
// All three income types stay in BR (no HR hit).

async function checkA10() {
  let calcIncomeTax, TAX;
  try {
    ({ calcIncomeTax } = await import(resolve(ROOT, 'src/engine/fq-calculator.js')));
    ({ TAX } = await import(resolve(ROOT, 'src/engine/_bundle.js')));
  } catch (e) {
    check('  fq-calculator loadable', false);
    console.log('     err:', e.message);
    return;
  }
  const mrT = {
    income: {
      employment: 45000,
      savingsInterest: 1000,
      dividends: 2000,
    },
  };
  const tax = calcIncomeTax(mrT);
  const byBand = tax.byBand || [];
  const find = (t) => byBand.find(b => b.type === t)?.amount || 0;
  // Non-savings basic should be ~£32,430
  check('  non_savings_basic = £45k − PA (≈ £32,430)',
    Math.abs(find('non_savings_basic') - (45000 - TAX.pa)) < 1);
  // Non-savings higher should be zero
  check('  non_savings_higher = £0 (stays in BR)', find('non_savings_higher') === 0);
  // Savings basic: PSA covers £1k → 0
  check('  savings_basic = £0 (PSA covered)', find('savings_basic') === 0);
  check('  savings_higher = £0', find('savings_higher') === 0);
  // Dividends: divAllowance £500, taxable £1,500 in BR
  const dvBasicExpected = 1500;
  check('  div_basic ≈ £1,500 (BR-band dividends)',
    Math.abs(find('div_basic') - dvBasicExpected) < 1);
  check('  div_higher = £0', find('div_higher') === 0);
  check('  marginalRate = TAX.br (BR)', tax.marginalRate === TAX.br);
}
await checkA10();

// ── A11: NIC separate from income tax ────────────────────────────────────────
console.log('\nA11. NIC separate from income tax:');
check('  ReceiptWaterfall has separate NIC subtotal block',
  /NIC subtotal/.test(r2));
check('  ReceiptWaterfall has separate Income tax subtotal',
  /Income tax subtotal/.test(r2));
check('  calcClass1NI + calcClass4NI exist (not folded into byBand)',
  /function calcClass1NI/.test(r2) && /function calcClass4NI/.test(r2));

// ── A12: no hardcoded thresholds ─────────────────────────────────────────────
console.log('\nA12. No hardcoded thresholds:');
// Strip block comments and strings that are clearly labels for forbidden-literal scan
// Inline forbidden literals we look for (as code, not in label strings):
const forbidden = [
  /\b12570\b/, /\b50270\b/, /\b60000\b/, /\b80000\b/,
  /\b100000\b/, /\b125140\b/, /\b200000\b/, /\b260000\b/,
  /\b5000\b/, /\b0\.08\b/, /\b0\.06\b/, /\b0\.1075\b/, /\b0\.3575\b/,
  /\b0\.3935\b/, /\b0\.15\b/,
];
// Allow these inside template literal labels that mirror canonical figures.
// We scan code lines that are NOT inside template label strings — simple heuristic:
// strip /`[^`]*`/g first.
const r2NoTemplates = r2
  .replace(/`[^`]*`/g, '``')
  .replace(/\/\/[^\n]*/g, '')   // strip line comments
  .replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
let literalHits = 0;
const hits = [];
for (const pat of forbidden) {
  const m = r2NoTemplates.match(new RegExp(pat.source, 'g'));
  if (m) {
    literalHits += m.length;
    hits.push(`${pat.source} × ${m.length}`);
  }
}
check(`  no hardcoded UK thresholds in code (found: ${hits.join(', ') || 'none'})`, literalHits === 0);

// ── A15: G7 verb-grep clean ─────────────────────────────────────────────────
console.log('\nA15. G7 verb-grep clean:');
const forbiddenVerbs = [
  /\byou should\b/i,
  /\bconsider\b/i,
  /\brecommended\b/i,
  /\bmaximise\b/i,
  /\bbest to\b/i,
  /\bought to\b/i,
  /\bhighest-return\b/i,
  /\boptimal\s/i,
];
const verbHits = [];
for (const v of forbiddenVerbs) {
  const m = r2.match(v);
  if (m) verbHits.push(`${v.source}: "${m[0]}"`);
}
check(`  zero prescriptive verbs (${verbHits.length ? verbHits.join('; ') : 'clean'})`, verbHits.length === 0);

// ── A16: G7.5 structural — ANI cliff descriptive, no "Reduce ANI" ───────────
console.log('\nA16. G7.5 structural:');
check('  ANI cliff has NO "Reduce ANI" / "Top up pension" CTA', !/Reduce ANI|Top up pension to/i.test(r2));
check('  HICBC chip not followed by ISA/pension CTA on the same screen',
  !/HICBC[\s\S]{0,200}(top up|sacrifice|reduce)/i.test(r2));

// ── A18: G16 verbatim disclaimer ────────────────────────────────────────────
console.log('\nA18. G16 verbatim copy:');
check('  Statutory disclaimer verbatim',
  /Information based on UK 2026\/27 rules\. Not personal advice\./.test(r2));
check('  Sankey tax-stage labels verbatim subset present',
  /Personal Allowance/.test(r2) && /Basic rate 20%/.test(r2) && /Higher rate 40%/.test(r2)
  && /Additional rate 45%/.test(r2) && /NIC Class 1 \(8% main\)/.test(r2)
  && /NIC Class 4 \(6% main\)/.test(r2));
check('  PA freeze chip uses "Frozen to end of 2030/31 tax year"',
  /Frozen to end of 2030\/31 tax year/.test(r2));

// ── R6: no dead components / Dashboard wiring untouched ─────────────────────
console.log('\nDashboard wiring:');
const dash = read('src/screens/Dashboard.jsx');
check('  Dashboard imports MoneyIncome', /import\s+MoneyIncome\s+from\s+['"]\.\/MoneyIncome\.jsx['"]/.test(dash));
check('  Dashboard renders MoneyIncome on tab money/income', /tab === 'money\/income'/.test(dash));

// ── G3: signature visualisations present ────────────────────────────────────
console.log('\nG3. Signature visualisations:');
check('  Hero Sankey rendered', /<Sankey\b/.test(r2));
check('  Classification donut rendered', /<ClassificationDonut\b/.test(r2));
check('  ANI cliff bar rendered', /<ANICliffBar\b/.test(r2));
check('  Receipt waterfall in RevealCard', /<ReceiptWaterfall\b/.test(r2) && /<RevealCard\b/.test(r2));
check('  Income-by-source bar rendered', /<IncomeBySourceBar\b/.test(r2));

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══ Result: ${pass} passed, ${fail} failed ═══`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
