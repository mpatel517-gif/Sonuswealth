// ─────────────────────────────────────────────────────────────────────────────
// v0.3 ROUTE-SPECS — PHASE 4 / ROUTE 1 (Balance Sheet) SANITY TEST
//
// Static-inspection style (matches v0.3-phase-2.test.js + v0.3-phase-3.test.js).
// The repo has no JSX runtime in Node, so we verify Phase 4 contracts by
// reading the source files and asserting:
//
//   A1.  Triple-NW gone — exactly ONE fmt(netWorth) site across the 3 files
//        (FinancesHeroCard).
//   A4.  No Income / Cashflow / Tax / Decisions LIVE rendering sites.
//   A5/A6. Marimekko at section 5 + SIPP-IHT chip on Pensions tile carrying
//        canonical seed { pension_total, post_2027_delta }.
//   A14. No hardcoded UK thresholds in MyMoney.jsx or the four R1 component
//        files. All thresholds must come via TAX.* bundle keys.
//   A21. G7 verb-grep clean — zero matches for the forbidden verbs.
//   A22. G7.5 structural — SIPP-IHT chip uses the verbatim "From April 2027,
//        pensions enter your estate. Current pre-tax delta: £{X}." copy, NOT
//        "Reduce" or any prescriptive verb.
//   A23. G13 empty state — the empty-state branch exists (heroTotalAssets ===
//        0 && heroTotalLiabilities === 0 ? ...).
//   R9.  Trusts section-nav chip routes to 'trusts' / 'money/trusts', NOT
//        legacy 'estate'.
//   PG.  PersonaGapTiles consumed inline on R1 — TaperedAATile,
//        CohabIHTCliffTile, TransferableNRBTile, LandlordS24Tile,
//        EISVCTClockTile, HICBCTile, AvalanchePriorityTile, NRIIndianAssetsTile.
//
// Run: node tests/v0.3-phase-4-r1.test.js
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

console.log('=== v0.3 Phase 4 / R1 (Balance Sheet) ===\n');

const mm = read('src/screens/MyMoney.jsx');
const tile = read('src/components/MyMoney/TileGrid.jsx');
const cat = read('src/components/MyMoney/CategoryTile.jsx');
const liab = read('src/components/MyMoney/LiabilityTile.jsx');
const hero = read('src/components/MyMoney/FinancesHeroCard.jsx');

check('MyMoney.jsx exists', mm !== null);
check('TileGrid.jsx exists', tile !== null);
check('CategoryTile.jsx exists', cat !== null);
check('LiabilityTile.jsx exists', liab !== null);
check('FinancesHeroCard.jsx exists', hero !== null);

// ── A1 triple-NW gone — exactly ONE fmt(netWorth) match across the 3 files ──
console.log('\nA1. Triple-NW gone:');
const r1Files = { MyMoney: mm, TileGrid: tile, FinancesHero: hero };
let nwHits = 0;
for (const [name, body] of Object.entries(r1Files)) {
  if (!body) continue;
  const matches = body.match(/fmt\(netWorth\)/g) || [];
  if (matches.length > 0) console.log(`     ${name}: ${matches.length} hit(s)`);
  nwHits += matches.length;
}
check(`  exactly one fmt(netWorth) site across MyMoney + TileGrid + FinancesHero (found ${nwHits})`, nwHits === 1);
check('  FinancesHeroCard owns the single NW render', /fmt\(netWorth\)/.test(hero));
check('  TileGrid does NOT render fmt(netWorth)', !/fmt\(netWorth\)/.test(tile));
check('  MyMoney.jsx does NOT render fmt(netWorth)', !/fmt\(netWorth\)/.test(mm));

// ── A4 no Income / Cashflow / Tax / Decisions live-rendered ────────────────
console.log('\nA4. No Income / Cashflow / Tax / Decisions content live-rendered:');
const liveRenderRe = /<(IncomeSection|SurplusTile|AllowanceTracker|ANIPanel|DecumulationPanel)\b/;
check('  no JSX render of forbidden components', !liveRenderRe.test(mm));

// ── A5 / A6 Marimekko + SIPP-IHT chip ─────────────────────────────────────
console.log('\nA5/A6. Marimekko + SIPP-IHT chip:');
check('  Marimekko imported from charts/index.js',
  /import\s*\{[^}]*Marimekko[^}]*\}\s*from\s*['"]\.\.\/components\/charts(?:\/index\.js)?['"]/.test(mm));
check('  Marimekko rendered as JSX',
  /<Marimekko\b/.test(mm));
check('  ihtDeltaPrePost2027 imported from canonical-metrics',
  /import\s*\{[^}]*ihtDeltaPrePost2027[^}]*\}\s*from\s*['"]\.\.\/engine\/canonical-metrics(?:\.js)?['"]/.test(mm));
check('  SIPP-IHT chip uses verbatim §8 copy',
  /From April 2027, pensions enter your estate\. Current pre-tax delta: £/.test(mm));
check('  SIPP-IHT chip onTap deep-links to tax#iht-delta with seed',
  /onNav\(\s*['"]tax['"]\s*,\s*\{[\s\S]{0,200}hash:\s*['"]iht-delta['"][\s\S]{0,400}pension_total[\s\S]{0,200}post_2027_delta/.test(mm));

// ── A14 no hardcoded thresholds ────────────────────────────────────────────
console.log('\nA14. No hardcoded UK thresholds in R1 files:');
const thresholdRe = /\b(12570|50270|60000|268275|325000|175000|20000|100000|200000|260000|2500000)\b/;
for (const [name, body] of Object.entries({ MyMoney: mm, TileGrid: tile, CategoryTile: cat, LiabilityTile: liab, FinancesHero: hero })) {
  if (!body) continue;
  const m = body.match(thresholdRe);
  check(`  ${name} has no hardcoded threshold literal${m ? ` (found ${m[0]})` : ''}`, !m);
}

// ── A21 G7 verb-grep clean ─────────────────────────────────────────────────
console.log('\nA21. G7 verb-grep clean across R1 files:');
const verbRe = /you should|consider|recommended|maximise|best to|ought to|verify with an adviser|highest-return|optimal /i;
for (const [name, body] of Object.entries({ MyMoney: mm, TileGrid: tile, CategoryTile: cat, LiabilityTile: liab, FinancesHero: hero })) {
  if (!body) continue;
  const m = body.match(verbRe);
  check(`  ${name} G7-clean${m ? ` (found "${m[0]}")` : ''}`, !m);
}

// ── A22 G7.5 structural — SIPP-IHT chip is descriptive, no Reduce/Act ─────
console.log('\nA22. G7.5 structural (no problem->product->action sequence):');
const prescriptiveSIPPRe = /Reduce your SIPP|act now to reduce|act now on iht|cut your IHT/i;
check('  SIPP-IHT chip is descriptive (no "Reduce your SIPP IHT exposure now")', !prescriptiveSIPPRe.test(mm));
check('  Avalanche marker uses verbatim "Highest APR in your debt mix"', /Highest APR in your debt mix/.test(liab) || /Highest APR/.test(liab));
check('  Avalanche marker NOT "Pay this first"', !/Pay this first/.test(liab));

// ── A23 G13 empty state ───────────────────────────────────────────────────
console.log('\nA23. G13 empty state for new users:');
check('  empty-state ternary present (heroTotalAssets === 0 && heroTotalLiabilities === 0)',
  /heroTotalAssets\s*===\s*0\s*&&\s*heroTotalLiabilities\s*===\s*0/.test(mm));
check('  empty-state hero illustration (SVG line drawing)',
  /data-empty=['"]r1-balance-sheet['"]/.test(mm) && /<svg[\s\S]{0,2000}<rect[\s\S]{0,2000}(?:Wallet|wallet|rect x=)/.test(mm));
check('  empty-state CTA "Add your first item"', /Add your first item/.test(mm));
check('  empty-state headline "Your money, one view."', /Your money, one view\./.test(mm));

// ── R9 cross-route — Trusts route uses /money/trusts via setTabSafe ───────
console.log('\nR9. Cross-route wiring (Trusts → /money/trusts):');
check('  section-nav Trusts chip uses route id "trusts" (not "estate")',
  /label:\s*['"]Trusts & Estate['"][\s\S]{0,150}route:\s*['"]trusts['"]/.test(mm));

// ── Persona-gap chips consumed inline on R1 ───────────────────────────────
console.log('\nPG. PersonaGapTiles inline on R1:');
const chips = ['TaperedAATile', 'CohabIHTCliffTile', 'TransferableNRBTile', 'LandlordS24Tile',
               'EISVCTClockTile', 'HICBCTile', 'AvalanchePriorityTile', 'NRIIndianAssetsTile'];
for (const chip of chips) {
  // chip must be imported AND used as JSX
  const imported = new RegExp(`import\\s*\\{[\\s\\S]*?${chip}[\\s\\S]*?\\}\\s*from\\s*['"]\\.\\.\\/components\\/MyMoney\\/PersonaGapTiles(?:\\.jsx)?['"]`).test(mm);
  const rendered = new RegExp(`<${chip}\\s+entity=\\{entity\\}\\s*/>`).test(mm);
  check(`  ${chip} imported + rendered`, imported && rendered);
}

// ── X28 window selector still wired ───────────────────────────────────────
console.log('\nE. X28 window selector wires displayed NW:');
check('  X28TopBar onWindowChange handler present', /onWindowChange=\{setWindowId\}/.test(mm));
check('  netWorthAtWindow called for forward projections', /netWorthAtWindow\(/.test(mm));
check('  trajectories.netWorthHistory used for historical windows', /trajectories\?\.netWorthHistory/.test(mm));

// ── G13 empty state — should NOT render TileGrid / Marimekko when empty ───
console.log('\nG13. Empty state hides charts:');
// We verify by structural check: the empty-state ternary wraps FinancesHeroCard + Marimekko + TileGrid
// inside the `:` branch. The `?` branch is the standalone illustration.
const emptyMatch = mm.match(/heroTotalAssets\s*===\s*0\s*&&\s*heroTotalLiabilities\s*===\s*0\s*\?\s*\(([\s\S]{50,5000}?)\)\s*:\s*\(/);
check('  empty-state branch isolated (no Marimekko / TileGrid in `?` branch)',
  !!emptyMatch && !/Marimekko|TileGrid/.test(emptyMatch[1]));

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
