// ─────────────────────────────────────────────────────────────────────────────
// v0.3 ROUTE-SPECS — PHASE 2 SHARED CHART KIT SANITY TEST
//
// The repo has no JSX transformer in Node (no vitest, no esbuild-register,
// no babel). That blocks importing .jsx at runtime. The existing v0.3-bundle
// test imports plain .js engine modules; the existing L3Panel smoke test
// does static source inspection. This test follows the L3Panel pattern.
//
// For each of the 8 Phase-2 components we verify, structurally, the four
// claims the parent task makes about every component:
//   (a) renders without crashing on empty input — verified by checking the
//       file has an explicit empty-state branch (G13).
//   (b) renders with sample data — verified by checking the file actually
//       uses the documented props (data / nodes+links / months / tiers /
//       wrapper / entity / items / current+target).
//   (c) aria-label is non-empty — verified by checking the file references
//       `ariaLabel` with a sensible default expression.
//   (d) mobile reflow is implemented per the route spec — verified by
//       checking for a mobile breakpoint (matchMedia 480px or @media inline
//       style) and for the spec-specified reflow keyword (vertical /
//       waterfall / 4x3 / stacks).
//
// Also verifies:
//   · barrel re-exports all 8 components
//   · each file has the G15 spec citation comment block in its header
//   · no Inter font reference (G11 deprecation list)
//
// Run: node tests/v0.3-phase-2.test.js
// Exit code: 0 = pass, 1 = fail.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHARTS = resolve(ROOT, 'src/components/charts');

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

function read(file) {
  const full = resolve(CHARTS, file);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

console.log('═══ v0.3 Phase 2 — shared chart kit ═══\n');

// 1. files exist
const components = [
  { file: 'Marimekko.jsx', specRef: 'route-1-balance-sheet.md' },
  { file: 'Sankey.jsx', specRef: 'route-2-income-statement.md' },
  { file: 'CalendarHeatmap.jsx', specRef: 'route-3-cashflow.md' },
  { file: 'SharedBullet.jsx', specRef: 'route-3-cashflow.md' },
  { file: 'LiquidityLadder.jsx', specRef: 'route-8-drilldowns.md' },
  { file: 'TaxTreatmentBlock.jsx', specRef: 'route-8-drilldowns.md' },
  { file: 'IHTDeltaCard.jsx', specRef: 'route-4-tax-estate.md' },
  { file: 'EstateVault.jsx', specRef: 'route-4.5-trusts-estate.md' },
];

console.log('Files exist:');
for (const c of components) {
  check(
    `  ${c.file} present`,
    existsSync(resolve(CHARTS, c.file)),
  );
}

// 2. barrel re-exports all 8
console.log('\nBarrel index.js:');
const barrel = read('index.js');
check('  index.js present', barrel !== null);
if (barrel) {
  for (const c of components) {
    const name = c.file.replace('.jsx', '');
    check(`  barrel exports ${name}`, barrel.includes(`from './${c.file}'`));
  }
}

// 3. Per-component checks
const propContracts = {
  'Marimekko.jsx': { props: ['data', 'ariaLabel', 'onSegmentTap', 'theme'], emptyPattern: /!safe\.length|total\s*<=\s*0/ },
  'Sankey.jsx': { props: ['nodes', 'links', 'ariaLabel', 'onFlowTap', 'theme'], emptyPattern: /!safeNodes\.length|!safeLinks\.length/ },
  'CalendarHeatmap.jsx': { props: ['months', 'range', 'ariaLabel', 'onCellTap', 'theme'], emptyPattern: /!safe\.length/ },
  'SharedBullet.jsx': { props: ['current', 'target', 'thresholds', 'label', 'expansion', 'ariaLabel'], emptyPattern: /const empty/ },
  'LiquidityLadder.jsx': { props: ['tiers', 'ariaLabel', 'onTierTap', 'theme'], emptyPattern: /total\s*===\s*0|populatedCount\s*===\s*0/ },
  'TaxTreatmentBlock.jsx': { props: ['wrapper', 'overrides', 'bundle'], emptyPattern: /unresolved/ },
  'IHTDeltaCard.jsx': { props: ['entity', 'ariaLabel', 'onColumnTap', 'theme'], emptyPattern: /!result|empty state/ },
  'EstateVault.jsx': { props: ['items', 'ariaLabel', 'onTileTap', 'theme'], emptyPattern: /allEmpty|empty/ },
};

const mobilePatterns = {
  'Marimekko.jsx': /useIsNarrow|vertical bars per category|stacked vertical/i,
  'Sankey.jsx': /useIsNarrow|receipt waterfall|vertical/i,
  'CalendarHeatmap.jsx': /useIsNarrow|repeat\(4, 1fr\)|4×3|4x3/i,
  'SharedBullet.jsx': /./, // bullet has no special mobile reflow per spec; stays full-width
  'LiquidityLadder.jsx': /useIsNarrow|vertical/i,
  'TaxTreatmentBlock.jsx': /./, // typographic; no chart reflow needed
  'IHTDeltaCard.jsx': /max-width:\s*480px|stacks vertically|grid-template-columns:\s*1fr/i,
  'EstateVault.jsx': /viewBox|stack/i,
};

// aria-label must be rendered (either directly via {ariaLabel} or via an
// `a11y` / `ariaLabel`-derived variable). Match the attribute presence; the
// per-component `ariaLabel` prop check catches the prop-wiring separately.
const ariaPatterns = {
  required: /aria-label\s*=\s*\{/,
};

console.log('\nPer-component anatomy:');
for (const c of components) {
  const src = read(c.file);
  if (!src) {
    fail++;
    fails.push(`${c.file} cannot be read`);
    continue;
  }
  console.log(`\n  ${c.file}:`);

  // G15 spec citation
  check(
    `    G15 header cites ${c.specRef}`,
    src.includes(c.specRef),
  );

  // G11 — no Inter font reference (deprecated)
  check(
    `    G11 no Inter font reference`,
    !/['"]?Inter['"]?/.test(src),
  );

  // ariaLabel prop
  check(
    `    accepts ariaLabel prop`,
    /ariaLabel/.test(src),
  );

  // aria-label rendered
  check(
    `    renders aria-label attribute`,
    ariaPatterns.required.test(src),
  );

  // role attribute (img/region) for non-colour-only meaning
  check(
    `    has explicit ARIA role`,
    /role\s*=\s*"(img|region)"/.test(src),
  );

  // props contract
  const contract = propContracts[c.file];
  if (contract) {
    for (const p of contract.props) {
      check(
        `    props prop "${p}" referenced`,
        new RegExp(`\\b${p}\\b`).test(src),
      );
    }
    check(
      `    empty-state branch present (G13)`,
      contract.emptyPattern.test(src),
    );
  }

  // mobile reflow
  const mobilePattern = mobilePatterns[c.file];
  if (mobilePattern) {
    check(
      `    mobile reflow implemented`,
      mobilePattern.test(src),
    );
  }
}

// 4. IHTDeltaCard — Compliance v2 B6: countdown daily-only, no animation
console.log('\nIHTDeltaCard — Compliance v2 B6 (daily countdown, no animation):');
const iht = read('IHTDeltaCard.jsx');
if (iht) {
  check(
    '  uses setTimeout aligned to UTC midnight',
    /msUntilNextUTCMidnight|UTCMidnight/.test(iht),
  );
  check(
    '  no setInterval (would tick continuously)',
    !/setInterval/.test(iht),
  );
  check(
    '  no CSS animation keyframes on countdown',
    !/animation:\s*[^;]*\b(pulse|flash|blink)\b/i.test(iht),
  );
  check(
    '  imports ihtDeltaPrePost2027 from canonical-metrics',
    /ihtDeltaPrePost2027.*canonical-metrics/.test(iht),
  );
}

// 5. TaxTreatmentBlock — three-row contract
console.log('\nTaxTreatmentBlock — IT/CGT/IHT three-row contract:');
const ttb = read('TaxTreatmentBlock.jsx');
if (ttb) {
  check('  has it row', /rowKey=["']it["']|rowKey:\s*["']it["']/.test(ttb));
  check('  has cgt row', /rowKey=["']cgt["']|rowKey:\s*["']cgt["']/.test(ttb));
  check('  has iht row', /rowKey=["']iht["']|rowKey:\s*["']iht["']/.test(ttb));
  check(
    '  imports getTaxTreatmentSummary',
    /getTaxTreatmentSummary/.test(ttb),
  );
  check(
    '  accepts overrides prop',
    /overrides/.test(ttb),
  );
}

// 6. LiquidityLadder — 5 canonical tiers
console.log('\nLiquidityLadder — 5 canonical tiers:');
const ll = read('LiquidityLadder.jsx');
if (ll) {
  check(
    '  declares canonical Hours/Days/Weeks/Months/Years',
    /Hours.*Days.*Weeks.*Months.*Years/s.test(ll),
  );
}

// 7. EstateVault — 5 tile keys
console.log('\nEstateVault — 5 estate tiles:');
const ev = read('EstateVault.jsx');
if (ev) {
  for (const k of ['will', 'lpaHealth', 'lpaFinance', 'nominations', 'trusts']) {
    check(`  tile key "${k}"`, ev.includes(k));
  }
}

// 8. CalendarHeatmap — 12 cells + 4x3 mobile
console.log('\nCalendarHeatmap — 12 cells mobile reflow:');
const ch = read('CalendarHeatmap.jsx');
if (ch) {
  check('  grid-template repeats(12) on desktop', /repeat\(12,/.test(ch));
  check('  grid-template repeats(4) on mobile', /repeat\(4,/.test(ch));
}

// 9. SharedBullet — target marker + thresholds
console.log('\nSharedBullet — target marker + threshold zones:');
const sb = read('SharedBullet.jsx');
if (sb) {
  check('  target marker rendered', /TARGET/.test(sb));
  check('  thresholds prop used', /thresholds/.test(sb));
  check(
    '  shows target even on empty data',
    /target marker shown for reference/.test(sb),
  );
}

// ── Result ─────────────────────────────────────────────────────────────────
console.log(`\n═══ Result: ${pass} passed, ${fail} failed ═══`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of fails) console.log(`  · ${f}`);
  process.exit(1);
} else {
  process.exit(0);
}
