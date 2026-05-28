// ─────────────────────────────────────────────────────────────────────────────
// v0.3 ROUTE-SPECS — PHASE 3 CROSS-ROUTE WIRING SANITY TEST
//
// Static-inspection style (matches v0.3-phase-2.test.js + L3Panel smoke).
// The repo has no JSX runtime in Node, so we verify Phase 3 contracts by
// reading the source files and asserting:
//
//   A. Dashboard.jsx
//      · adds money/trusts to VALID_TABS
//      · imports MoneyTrusts
//      · setTabSafe handles `/tax#iht-delta` and `/decisions#scenario` hashes
//      · listens for SCENARIO_SAVED { back_flow:'iht' } and bumps ihtForceKey
//      · trusts chip routes to /money/trusts (NOT /tax)
//
//   B. PersonaGapTiles.jsx
//      · exports the v0.3 chip names (Tapered AA, CohabIHT, NormalExpenditure,
//        Annual/Small/Wedding Gifts, HICBC, EmployerNIC, RNRBTaper, BPRCap,
//        NRI, Avalanche, plus the existing TransferableNRB / EISVCT /
//        LandlordS24 / RentARoom / DrawdownMethodsTeaser updates)
//      · verbatim copy snippets appear in source (literal string match — the
//        founder grep that v0.2's G16 gate would have run)
//
//   C. AddItemSheet.jsx
//      · CAT_TAXONOMY includes a `gifts` category with 8 items (PET, CLT,
//        plus the 5 new IHTA-statutory exemptions + wedding splits)
//      · submit() emits GIFT_RECORDED with type discriminator
//
//   D. MoneyTrusts.jsx exists as the /money/trusts target
//
// Run: node tests/v0.3-phase-3.test.js
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

console.log('═══ v0.3 Phase 3 — cross-route wiring ═══\n');

// ────────────────────────────────────────────────────────────────────────────
// A. Dashboard.jsx
// ────────────────────────────────────────────────────────────────────────────
console.log('A. Dashboard.jsx routing:');
const dash = read('src/screens/Dashboard.jsx');
check('  Dashboard.jsx exists', dash !== null);
if (dash) {
  check('  imports MoneyTrusts', /import\s+MoneyTrusts\s+from\s+['"]\.\/MoneyTrusts\.jsx['"]/.test(dash));
  check("  VALID_TABS includes 'money/trusts'", /['"]money\/trusts['"]/.test(dash));
  check('  setTabSafe handles iht-delta hash', /hash\s*===\s*['"]iht-delta['"]/.test(dash));
  check('  setTabSafe handles scenario hash', /hash\s*===\s*['"]scenario['"]/.test(dash));
  check('  trusts route lands on money/trusts (not /tax)', /id\s*===\s*['"]estate['"]\s*\|\|\s*id\s*===\s*['"]trusts['"]/.test(dash));
  check('  SCENARIO_SAVED back_flow:iht listener present', /SCENARIO_SAVED[\s\S]{0,200}back_flow\s*===\s*['"]iht['"]/.test(dash));
  check('  ihtForceKey state defined', /ihtForceKey/.test(dash) && /setIHTForceKey/.test(dash));
  check('  TaxEstate receives hash + seed + ihtForceKey props', /hash=\{tabHash\}[\s\S]*seed=\{tabSeed\}[\s\S]*ihtForceKey=\{ihtForceKey\}/.test(dash));
  check('  MoneyTrusts rendered for money/trusts tab', /tab\s*===\s*['"]money\/trusts['"][\s\S]{0,400}<MoneyTrusts/.test(dash));
}

// ────────────────────────────────────────────────────────────────────────────
// B. PersonaGapTiles.jsx — chip exports + verbatim copy
// ────────────────────────────────────────────────────────────────────────────
console.log('\nB. PersonaGapTiles.jsx chip exports:');
const tiles = read('src/components/MyMoney/PersonaGapTiles.jsx');
check('  PersonaGapTiles.jsx exists', tiles !== null);
if (tiles) {
  // Existing chips (updated copy)
  check('  exports TaperedAATile',          /export\s+function\s+TaperedAATile/.test(tiles));
  check('  exports CohabIHTCliffTile',      /export\s+function\s+CohabIHTCliffTile/.test(tiles));
  check('  exports TransferableNRBTile',    /export\s+function\s+TransferableNRBTile/.test(tiles));
  check('  exports EISVCTClockTile',        /export\s+function\s+EISVCTClockTile/.test(tiles));
  check('  exports LandlordS24Tile',        /export\s+function\s+LandlordS24Tile/.test(tiles));
  check('  exports RentARoomTile',          /export\s+function\s+RentARoomTile/.test(tiles));
  check('  exports DrawdownMethodsTeaser',  /export\s+function\s+DrawdownMethodsTeaser/.test(tiles));
  // v0.3 Phase 3 new chips
  check('  exports NRIIndianAssetsTile',    /export\s+function\s+NRIIndianAssetsTile/.test(tiles));
  check('  exports AvalanchePriorityTile',  /export\s+function\s+AvalanchePriorityTile/.test(tiles));
  check('  exports HICBCTile',              /export\s+function\s+HICBCTile/.test(tiles));
  check('  exports EmployerNICTile',        /export\s+function\s+EmployerNICTile/.test(tiles));
  check('  exports NormalExpenditureTile',  /export\s+function\s+NormalExpenditureTile/.test(tiles));
  check('  exports AnnualGiftExemptionTile',/export\s+function\s+AnnualGiftExemptionTile/.test(tiles));
  check('  exports SmallGiftsTile',         /export\s+function\s+SmallGiftsTile/.test(tiles));
  check('  exports WeddingGiftsTile',       /export\s+function\s+WeddingGiftsTile/.test(tiles));
  check('  exports RNRBTaperTile',          /export\s+function\s+RNRBTaperTile/.test(tiles));
  check('  exports BPRCapTile',             /export\s+function\s+BPRCapTile/.test(tiles));

  console.log('\nB. PersonaGapTiles.jsx verbatim copy (G16 founder-grep):');
  // Each entry is the EXACT string from route-1 §8 / route-2 §8 / route-4 §8.
  const verbatim = [
    'Adjusted income above £260k and taxable income above £200k tapers your Annual Allowance.',
    'Unmarried partners do not share Inheritance Tax allowances. NRB £325k plus RNRB £175k applies once.',
    'Rental finance costs are restricted to a 20% basic-rate credit (ITA 2007 s274A).',
    'Spousal transfer can combine NRB to £650k and RNRB to £350k on second death.',
    'EIS/SEIS three-year hold required for CGT freedom. VCT five-year hold required for 20% IT relief.',
    'Indian-domiciled assets — DTAA treatment for cross-border tax.',
    'Highest APR in your debt mix',
    'Habitual gifts from surplus income — IHTA 1984 s21. No 7-year clock.',
    'Small gifts up to £',
    'per donee per tax year (IHTA 1984 s20). Outside the 7-year clock.',
    'Wedding/civil-partnership gifts: parent→child £',
    'grandparent→grandchild £',
    'Per donor, per marriage.',
    'RNRB tapers by £1 for every £2 of estate above £2m, fully withdrawn at £2.35m (£2.7m for couples).',
    'BPR + APR combined cap: £2.5m per individual (FA 2026). AIM holdings qualify at 50%.',
    'Drawdown methods — UFPLS, FAD, Annuity — what each does. See Cashflow → Drawdown teaser.',
    'Rent-a-room relief: first £7,500 of rent from a furnished room in your main residence is tax-free.',
    'Child Benefit tapers between £60k and £80k of ANI.',
    'Employer NIC · 15% on salary above £5,000 threshold (from April 2025). Annual liability: £',
    'Annual gift exemption £',
    'per tax year (IHTA 1984 s19). Unused carries forward one year.',
  ];
  for (const snippet of verbatim) {
    check(`  contains verbatim: "${snippet.slice(0, 70)}${snippet.length > 70 ? '…' : ''}"`, tiles.includes(snippet));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// C. AddItemSheet.jsx — gifts category + GIFT_RECORDED event
// ────────────────────────────────────────────────────────────────────────────
console.log('\nC. AddItemSheet.jsx gift wiring:');
const ais = read('src/components/MyMoney/AddItemSheet.jsx');
check('  AddItemSheet.jsx exists', ais !== null);
if (ais) {
  check('  CAT_TAXONOMY has gifts category', /gifts:\s*{\s*label:\s*['"]Gifts['"]/.test(ais));
  check('  CAT_ORDER includes gifts',         /CAT_ORDER\s*=\s*\[[^\]]*['"]gifts['"]/.test(ais));
  check('  gift type PET present',                  /giftType:\s*['"]PET['"]/.test(ais));
  check('  gift type CLT present',                  /giftType:\s*['"]CLT['"]/.test(ais));
  check('  gift type normal_expenditure present',   /giftType:\s*['"]normal_expenditure['"]/.test(ais));
  check('  gift type annual_exemption present',     /giftType:\s*['"]annual_exemption['"]/.test(ais));
  check('  gift type small_gifts present',          /giftType:\s*['"]small_gifts['"]/.test(ais));
  check('  gift type wedding_parent present',       /giftType:\s*['"]wedding_parent['"]/.test(ais));
  check('  gift type wedding_grandparent present',  /giftType:\s*['"]wedding_grandparent['"]/.test(ais));
  check('  gift type wedding_other present',        /giftType:\s*['"]wedding_other['"]/.test(ais));
  check('  submit emits GIFT_RECORDED for gifts category',
    /cat\s*===\s*['"]gifts['"][\s\S]{0,400}type:\s*['"]GIFT_RECORDED['"]/.test(ais));
  check('  GIFT_RECORDED payload has to/amount/date/type',
    /GIFT_RECORDED[\s\S]{0,600}to:[\s\S]{0,400}amount:[\s\S]{0,400}date:[\s\S]{0,400}type:/.test(ais));
  // verbatim labels surfaced in the type-picker UI
  check('  surfaces "PET (Potentially Exempt Transfer)" label', ais.includes('PET (Potentially Exempt Transfer)'));
  check('  surfaces "Normal expenditure from income (IHTA 1984 s21)" label', ais.includes('Normal expenditure from income (IHTA 1984 s21)'));
  check('  surfaces "Annual exemption £3k (IHTA 1984 s19)" label', ais.includes('Annual exemption £3k (IHTA 1984 s19)'));
  check('  surfaces "Small gifts £250 per donee (IHTA 1984 s20)" label', ais.includes('Small gifts £250 per donee (IHTA 1984 s20)'));
  check('  surfaces "Wedding gift — parent→child (IHTA 1984 s22)" label', ais.includes('Wedding gift — parent→child (IHTA 1984 s22)'));
  check('  surfaces "Wedding gift — grandparent→grandchild" label', ais.includes('Wedding gift — grandparent→grandchild'));
  check('  surfaces "Wedding gift — other" label', ais.includes('Wedding gift — other'));
}

// ────────────────────────────────────────────────────────────────────────────
// D. MoneyTrusts.jsx placeholder route exists
// ────────────────────────────────────────────────────────────────────────────
console.log('\nD. MoneyTrusts.jsx placeholder:');
const trusts = read('src/screens/MoneyTrusts.jsx');
check('  MoneyTrusts.jsx exists', trusts !== null);
if (trusts) {
  check('  default exports a component', /export\s+default\s+function\s+MoneyTrusts/.test(trusts));
  check('  uses EstateVault from shared kit', /from\s+['"]\.\.\/components\/charts/.test(trusts) && /EstateVault/.test(trusts));
}

// ────────────────────────────────────────────────────────────────────────────
// E. SCENARIO_SAVED shape includes back_flow
// ────────────────────────────────────────────────────────────────────────────
console.log('\nE. SCENARIO_SAVED shape (route-9 §4 v0.2):');
// The shape is consumer-side (Dashboard.jsx) — emitters (Route 7 DE) carry the
// field. We verify Dashboard.jsx reads payload.back_flow, which is the binding
// contract for Phase 3.
if (dash) {
  check('  Dashboard.jsx reads event.payload.back_flow',
    /payload\?\.back_flow\s*===\s*['"]iht['"]/.test(dash));
}

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n═══ Result: ${pass} passed, ${fail} failed ═══`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  · ${f}`);
  process.exit(1);
}
process.exit(0);
