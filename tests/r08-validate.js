#!/usr/bin/env node
/**
 * R08 — Mr T Fixture Suite Validator
 *
 * Phases:
 *   1  Fixture set completeness — all 13 files present
 *   2  Schema conformance — shared schema v1 per fixture spec §4
 *   3  Archetype coverage — all 52 archetypes covered exactly once (cross-cuts allowed)
 *   4  Null coverage quality — every fixture documents FP-4 or FP-5 data gaps
 *   5  Output envelope ranges — min ≤ max, confidence present
 *   6  Engine function tests — ACTIVE where function is built; STUB otherwise
 *
 * Usage:
 *   node tests/r08-validate.js
 *   node tests/r08-validate.js --fixtures-dir "path/to/fixtures"
 *
 * Exit: 0 = all active checks pass, 1 = any FAIL
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import {
  calcAge, calcStateP, calcNetWorth, calcInvestable, calcGuardrail,
  lifeStageFor, incomeTax, fundedRatio, fmt,
} from '../src/engine/fq-calculator.js';

// ── PATHS ────────────────────────────────────────────────────────────────────

const DEFAULT_FIXTURES_DIR =
  'C:/Users/Mihir Patel.Mihir/My Drive/All Work/6.Finio/1-Clusters/3-Engine';

// ── EXPECTED STATE ───────────────────────────────────────────────────────────

const EXPECTED_FIXTURE_IDS = [
  'mrT-core', 'mrT-couple', 'mrT-family', 'mrT-aged-out',
  'mrT-divorced', 'mrT-cohab-sep', 'mrT-sole-trader', 'mrT-ltd-director',
  'mrT-landlord', 'mrT-beneficiary', 'mrT-uk-in', 'mrT-uk-th',
  'mrT-decum-complex',
];

// mrT-decum-complex is a specialty cross-cut fixture — allowed to overlap
const CROSS_CUT_FIXTURE = 'mrT-decum-complex';

// Canonical archetype list: '01' → '52'
const ALL_ARCHETYPES = Array.from({ length: 52 }, (_, i) =>
  String(i + 1).padStart(2, '0')
);

// ── SCHEMA RULES (fixture spec §4) ──────────────────────────────────────────

const REQUIRED_TOP_LEVEL = [
  'fixture_id', 'fixture_version', 'fixture_anchor_archetype',
  'archetypes_exercised', 'jurisdiction', 'individual', 'relationships',
  'assets', 'liabilities', 'protection', 'gifts_and_trusts', 'events',
  'null_coverage', 'archetype_specific', 'expected_output_envelope',
];

const REQUIRED_JURISDICTION = ['primary', 'tax_bundle'];
const REQUIRED_INDIVIDUAL   = ['id', 'name', 'dob', 'life_stage'];
const REQUIRED_ENVELOPE     = ['finio_score', 'net_worth', 'apq_items_expected'];

// ── TERMINAL COLOURS ─────────────────────────────────────────────────────────

const C = {
  red:    '\x1b[31m', green:  '\x1b[32m', yellow: '\x1b[33m',
  cyan:   '\x1b[36m', bold:   '\x1b[1m',  reset:  '\x1b[0m',
};

// ── RESULT COLLECTOR ─────────────────────────────────────────────────────────

let failCount = 0;

function result(status, label, detail = '') {
  const icon  = status === 'PASS' ? `${C.green}✅ PASS${C.reset}` :
                status === 'FAIL' ? `${C.red}❌ FAIL${C.reset}` :
                                    `${C.yellow}⏭  SKIP${C.reset}`;
  const extra = detail ? `  ${C.yellow}↳ ${detail}${C.reset}` : '';
  console.log(`  ${icon}  ${label}${extra}`);
  if (status === 'FAIL') failCount++;
}

function section(title) {
  const bar = '─'.repeat(Math.max(0, 62 - title.length));
  console.log(`\n${C.bold}${C.cyan}── ${title} ${bar}${C.reset}`);
}

// ── SCHEMA VALIDATOR ─────────────────────────────────────────────────────────

function validateSchema(fx, fileId) {
  const errors = [];

  // Required top-level keys
  for (const f of REQUIRED_TOP_LEVEL) {
    if (!(f in fx)) errors.push(`missing "${f}"`);
  }

  // fixture_id must match filename
  if (fx.fixture_id && fx.fixture_id !== fileId) {
    errors.push(`fixture_id "${fx.fixture_id}" ≠ filename "${fileId}"`);
  }

  // archetypes_exercised is an array
  if (!Array.isArray(fx.archetypes_exercised)) {
    errors.push('"archetypes_exercised" must be array');
  }

  // jurisdiction sub-fields
  // cross-border fixtures use tax_bundle_primary + tax_bundle_secondary instead of tax_bundle
  if (fx.jurisdiction) {
    if (!fx.jurisdiction.primary) errors.push('jurisdiction."primary" missing');
    const hasTaxBundle = fx.jurisdiction.tax_bundle || fx.jurisdiction.tax_bundle_primary;
    if (!hasTaxBundle) errors.push('jurisdiction."tax_bundle" (or "tax_bundle_primary") missing');
  }

  // individual sub-fields
  if (fx.individual) {
    for (const f of REQUIRED_INDIVIDUAL) {
      if (!fx.individual[f]) errors.push(`individual."${f}" missing`);
    }
    if (fx.individual.dob && isNaN(Date.parse(fx.individual.dob))) {
      errors.push(`individual.dob "${fx.individual.dob}" not a valid ISO date`);
    }
  }

  // assets.pensions must be array
  if (fx.assets && !Array.isArray(fx.assets.pensions)) {
    errors.push('"assets.pensions" must be array');
  }

  // null_coverage.fp4 and fp5 must be arrays
  if (fx.null_coverage) {
    for (const f of ['fp4', 'fp5']) {
      if (!Array.isArray(fx.null_coverage[f])) {
        errors.push(`null_coverage."${f}" must be array`);
      }
    }
  }

  // expected_output_envelope required sub-fields
  if (fx.expected_output_envelope) {
    for (const f of REQUIRED_ENVELOPE) {
      if (!(f in fx.expected_output_envelope)) {
        errors.push(`expected_output_envelope."${f}" missing`);
      }
    }
    // finio_score needs value_range as [min, max] array
    const fs = fx.expected_output_envelope.finio_score;
    if (fs?.value_range !== undefined) {
      if (!Array.isArray(fs.value_range) || fs.value_range.length !== 2) {
        errors.push('finio_score.value_range must be [min, max] array');
      }
    }
    // net_worth needs value_range as [min, max] array
    const nw = fx.expected_output_envelope.net_worth;
    if (nw?.value_range !== undefined) {
      if (!Array.isArray(nw.value_range) || nw.value_range.length !== 2) {
        errors.push('net_worth.value_range must be [min, max] array');
      }
    }
    // apq_items_expected must be array
    if (!Array.isArray(fx.expected_output_envelope.apq_items_expected)) {
      errors.push('"apq_items_expected" must be array');
    }
  }

  // events must be array
  if (!Array.isArray(fx.events)) {
    errors.push('"events" must be array');
  }

  return errors;
}

// ── FIXTURE → ENTITY ADAPTER ─────────────────────────────────────────────────
// Converts fixture-format (arrays) to the old entity format expected by
// fundedRatio() and legacy engine helpers.

function fixtureToEntity(fx) {
  const a   = fx.assets    || {};
  const ind = fx.individual || {};

  const sippTotal = (a.pensions || [])
    .filter(p => !(p.type === 'occupational-DB' && p.cetv == null))
    .reduce((s, p) => s + (p.balance ?? 0), 0);

  const isaTotal = (a.investments || [])
    .filter(i => i.type?.includes('ISA') && i.verified_by_user !== false)
    .reduce((s, i) => s + (i.balance ?? 0), 0);

  const investTotal = (a.investments || [])
    .filter(i => !i.type?.includes('ISA'))
    .reduce((s, i) => s + (i.balance_gbp ?? i.balance ?? 0), 0);

  return {
    age:           calcAge(ind.dob ?? '1970-01-01'),
    retirementAge: ind.state_pension_start_age ?? 67,
    targetIncome:  fx.archetype_specific?.target_annual_retirement_income ?? 0,
    growth:        0.05,
    assets: {
      sipp:        { total: sippTotal },
      isa:         { total: isaTotal },
      investments: { total: investTotal },
    },
  };
}

// ── ENGINE FUNCTION REGISTRY ─────────────────────────────────────────────────
// status: 'ACTIVE' → runs test; 'STUB' → skips with note.
// Activate a function: change status to 'ACTIVE', add a run() that returns
// { pass: boolean, detail: string } given the fixture and its entity adapter.

const ENGINE_FUNCTIONS = [
  // ── Foundational ─────────────────────────────────────────────────────────
  {
    name: 'fundedRatio()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const e = fixtureToEntity(fx);
      const r = fundedRatio(e);
      const pass = r !== null && typeof r.confidence === 'string' && typeof r.horizon_years === 'number';
      return { pass, detail: `ratio=${r.ratio ?? 'null'} conf=${r.confidence} horizon=${r.horizon_years}yr` };
    },
  },
  {
    name: 'calcNetWorth()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const r = calcNetWorth(fx);
      const env = fx.expected_output_envelope?.net_worth;
      if (!env?.value_range) return { pass: r.net >= 0, detail: `net=${fmt(r.net)} (no envelope)` };
      const [lo, hi] = env.value_range;
      const tol  = Math.max(50000, ((lo + hi) / 2) * 0.20);
      const pass = r.net >= (lo - tol) && r.net <= (hi + tol);
      return { pass, detail: `net=${fmt(r.net)} range=[${fmt(lo)},${fmt(hi)}] conf=${r.confidence} excl=[${r.excluded_assets.join(',') || 'none'}]` };
    },
  },
  {
    name: 'calcInvestable()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const r    = calcInvestable(fx);
      const pass = r.value >= 0 && typeof r.confidence === 'string';
      return { pass, detail: `investable=${fmt(r.value)} conf=${r.confidence}` };
    },
  },
  {
    name: 'calcGuardrail()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const r    = calcGuardrail(fx);
      const pass = r.guardrail > 0 && r.swr === 0.04;
      return { pass, detail: `guardrail=${fmt(r.guardrail)} swr=${r.swr} conf=${r.confidence}` };
    },
  },
  {
    name: 'calcAge()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const dob = fx.individual?.dob;
      if (!dob) return { pass: false, detail: 'individual.dob missing' };
      const age  = calcAge(dob);
      const pass = age > 0 && age < 130;
      return { pass, detail: `age=${age} dob=${dob}` };
    },
  },
  {
    name: 'lifeStageFor()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const dob = fx.individual?.dob;
      if (!dob) return { pass: false, detail: 'individual.dob missing' };
      const age     = calcAge(dob);
      const stage   = lifeStageFor(age);
      const expected = (fx.individual?.life_stage ?? '').toLowerCase();
      const pass     = stage.stage >= 1 && stage.stage <= 7 && typeof stage.name === 'string';
      return { pass, detail: `stage=${stage.name}(${stage.stage}) age=${age} expected=${expected || 'n/a'}` };
    },
  },
  {
    name: 'calcStateP()', status: 'ACTIVE', group: 'foundational',
    run(fx) {
      const r    = calcStateP(fx);
      const pass = r.annual_at_retirement === null
                || (r.annual_at_retirement > 0 && r.annual_at_retirement <= 11502);
      return { pass, detail: `stateP=${r.annual_at_retirement} accrued=${r.accrued_years} conf=${r.confidence}` };
    },
  },
  {
    name: 'incomeTax()', status: 'ACTIVE', group: 'foundational',
    run(_fx) {
      const tax  = incomeTax(30000, 11502);
      const pass = tax > 0 && tax < 30000;
      return { pass, detail: `incomeTax(30000, 11502)=${fmt(tax)}` };
    },
  },
  // ── Cashflow suite (10) ───────────────────────────────────────────────────
  { name: 'monthlyCashflow()',    status: 'STUB', group: 'cashflow' },
  { name: 'calcSurplus()',        status: 'STUB', group: 'cashflow' },
  { name: 'calcCommitments()',    status: 'STUB', group: 'cashflow' },
  { name: 'calcAllocation()',     status: 'STUB', group: 'cashflow' },
  { name: 'calcDebtService()',    status: 'STUB', group: 'cashflow' },
  { name: 'calcSavingsRate()',    status: 'STUB', group: 'cashflow' },
  { name: 'calcRunway()',         status: 'STUB', group: 'cashflow' },
  { name: 'calcDrawdownPath()',   status: 'STUB', group: 'cashflow' },
  { name: 'calcCFScore()',        status: 'STUB', group: 'cashflow' },
  { name: 'costOfInaction()',     status: 'STUB', group: 'cashflow' },
  // ── Tax & Estate suite (18) ───────────────────────────────────────────────
  { name: 'calcIHT()',            status: 'STUB', group: 'tax-estate' },
  { name: 'calcNRB()',            status: 'STUB', group: 'tax-estate' },
  { name: 'calcRNRB()',           status: 'STUB', group: 'tax-estate' },
  { name: 'calcTNRB()',           status: 'STUB', group: 'tax-estate' },
  { name: 'calcBPR()',            status: 'STUB', group: 'tax-estate' },
  { name: 'calcBADR()',           status: 'STUB', group: 'tax-estate' },
  { name: 'calcSection24()',      status: 'STUB', group: 'tax-estate' },
  { name: 'calcTaperAA()',        status: 'STUB', group: 'tax-estate' },
  { name: 'calcMPAA()',           status: 'STUB', group: 'tax-estate' },
  { name: 'lsaHeadroom()',        status: 'STUB', group: 'tax-estate' },
  { name: 'calcTrustIHT()',       status: 'STUB', group: 'tax-estate' },
  { name: 'calcPSO()',            status: 'STUB', group: 'tax-estate' },
  { name: 'calcTOLATA()',         status: 'STUB', group: 'tax-estate' },
  { name: 'calcDTA()',            status: 'STUB', group: 'tax-estate' },
  { name: 'calcLTRVisa()',        status: 'STUB', group: 'tax-estate' },
  { name: 'calcFA2026Pension()',  status: 'STUB', group: 'tax-estate' },
  { name: 'calcHICBC()',          status: 'STUB', group: 'tax-estate' },
  { name: 'calcNIClass4()',       status: 'STUB', group: 'tax-estate' },
  // ── Risk ─────────────────────────────────────────────────────────────────
  { name: 'calcRisk()',           status: 'STUB', group: 'risk' },
  { name: 'projectBTR()',         status: 'STUB', group: 'risk' },
  { name: 'runCombinedShock()',   status: 'STUB', group: 'risk' },
  // ── Scoring ───────────────────────────────────────────────────────────────
  { name: 'calcFQCalibrated()',   status: 'STUB', group: 'scoring' },
  { name: 'financialProfile()',   status: 'STUB', group: 'scoring' },
];

// ── MAIN ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--fixtures-dir');
  const fixturesDir = dirIdx !== -1
    ? resolve(args[dirIdx + 1])
    : DEFAULT_FIXTURES_DIR;

  console.log(`\n${C.bold}R08 — Mr T Fixture Suite Validator${C.reset}`);
  console.log(`Fixtures : ${fixturesDir}`);
  console.log(`Run      : ${new Date().toISOString()}`);

  // ── Load fixtures ────────────────────────────────────────────────────────
  let files;
  try {
    files = readdirSync(fixturesDir).filter(
      f => f.startsWith('mrT-') && f.endsWith('.json')
    );
  } catch (e) {
    // Fixtures live outside the repo (local engine fixture suite). When the
    // default dir is absent and no explicit --fixtures-dir was passed (e.g.
    // CI runners), skip cleanly rather than fail — the suite still runs in
    // full on a machine that has the fixtures, or when pointed at them via
    // --fixtures-dir "path/to/fixtures".
    if (e.code === 'ENOENT' && dirIdx === -1) {
      console.log(
        `\n${C.yellow}SKIP: fixtures dir not present — r08 needs the local Mr T fixture suite. ` +
        `Pass --fixtures-dir "path/to/fixtures" to run.${C.reset}`
      );
      process.exit(0);
    }
    console.error(`\n${C.red}FATAL: Cannot read fixtures dir${C.reset}`);
    console.error(e.message);
    process.exit(1);
  }

  const fixtures = {};
  for (const file of files) {
    const id = file.replace('.json', '');
    try {
      fixtures[id] = JSON.parse(readFileSync(join(fixturesDir, file), 'utf-8'));
    } catch (e) {
      result('FAIL', `${id}: JSON parse error`, e.message);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 1 — Fixture set completeness
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 1 — FIXTURE SET COMPLETENESS (expect 13 files)');

  for (const id of EXPECTED_FIXTURE_IDS) {
    if (fixtures[id]) {
      result('PASS', `${id} present`);
    } else {
      result('FAIL', `${id} MISSING — file not found in fixtures dir`);
    }
  }

  const unexpected = Object.keys(fixtures).filter(
    id => !EXPECTED_FIXTURE_IDS.includes(id)
  );
  for (const id of unexpected) {
    console.log(`  ${C.yellow}NOTE${C.reset}  ${id} found but not in expected set`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 2 — Schema conformance
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 2 — SCHEMA CONFORMANCE (shared schema v1, fixture spec §4)');

  for (const id of EXPECTED_FIXTURE_IDS) {
    const fx = fixtures[id];
    if (!fx) { result('FAIL', `${id}: not loaded — cannot validate`); continue; }

    const errors = validateSchema(fx, id);
    if (errors.length === 0) {
      result('PASS', `${id}  v${fx.fixture_version ?? '?'}`);
    } else {
      result('FAIL', `${id}  ${errors.length} schema error(s)`, errors.join(' | '));
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 3 — Archetype coverage
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 3 — ARCHETYPE COVERAGE (01–52 must all appear)');

  const covered   = new Set();
  const overlaps  = [];

  for (const id of EXPECTED_FIXTURE_IDS) {
    const fx = fixtures[id];
    if (!fx) continue;
    for (const raw of fx.archetypes_exercised ?? []) {
      const a = String(raw).padStart(2, '0');
      if (covered.has(a) && id !== CROSS_CUT_FIXTURE) {
        overlaps.push(`${a} in ${id}`);
      }
      covered.add(a);
    }
  }

  const missing = ALL_ARCHETYPES.filter(a => !covered.has(a));

  if (missing.length === 0) {
    result('PASS', `All 52 archetypes covered  (${covered.size}/52)`);
  } else {
    result('FAIL', `Missing archetypes`, missing.join(', '));
  }

  if (overlaps.length > 0) {
    console.log(
      `  ${C.yellow}NOTE${C.reset}  Non-specialty overlaps (investigate): ${overlaps.join(' | ')}`
    );
  } else {
    result('PASS', 'No unexpected archetype duplicates');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 4 — Null coverage quality
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 4 — NULL COVERAGE QUALITY (every fixture must document data gaps)');

  for (const id of EXPECTED_FIXTURE_IDS) {
    const fx = fixtures[id];
    if (!fx) { result('FAIL', `${id}: not loaded`); continue; }

    const fp4 = fx.null_coverage?.fp4 ?? [];
    const fp5 = fx.null_coverage?.fp5 ?? [];

    if (fp4.length === 0 && fp5.length === 0) {
      result('FAIL', `${id}: both fp4 and fp5 are empty`, 'engine needs at least one data-gap declaration');
    } else {
      result('PASS', `${id}  fp4=${fp4.length}  fp5=${fp5.length}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 5 — Output envelope ranges
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 5 — OUTPUT ENVELOPE RANGES (min ≤ max, confidence declared)');

  for (const id of EXPECTED_FIXTURE_IDS) {
    const fx = fixtures[id];
    if (!fx) { result('FAIL', `${id}: not loaded`); continue; }

    const env    = fx.expected_output_envelope ?? {};
    const errors = [];

    for (const [key, val] of Object.entries(env)) {
      if (!val || typeof val !== 'object') continue;
      const r = val.value_range;
      if (!r) continue;
      if (Array.isArray(r) && r.length === 2 && r[0] > r[1]) {
        errors.push(`${key}: value_range[0](${r[0]}) > value_range[1](${r[1]})`);
      } else if (!Array.isArray(r)) {
        errors.push(`${key}: value_range must be array`);
      }
    }

    const fScore = env.finio_score;
    if (fScore && !fScore.confidence) {
      errors.push('finio_score.confidence missing');
    }

    if (errors.length > 0) {
      result('FAIL', `${id}  range errors`, errors.join(' | '));
    } else {
      result('PASS', `${id}  ranges valid`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 6 — Engine function tests
  // ────────────────────────────────────────────────────────────────────────────
  section('PHASE 6 — ENGINE FUNCTION TESTS');

  const active = ENGINE_FUNCTIONS.filter(f => f.status === 'ACTIVE');
  const stubs  = ENGINE_FUNCTIONS.filter(f => f.status === 'STUB');

  console.log(
    `  Built: ${active.length}/${ENGINE_FUNCTIONS.length} functions  ` +
    `(${stubs.length} stubs pending)\n`
  );

  // Group stubs by group for compact output
  const groups = {};
  for (const fn of stubs) {
    (groups[fn.group] ??= []).push(fn.name);
  }
  for (const [grp, names] of Object.entries(groups)) {
    result('SKIP', `[${grp}]  ${names.join('  ')}`, 'not yet built');
  }

  // Run active functions
  for (const fn of active) {
    for (const id of EXPECTED_FIXTURE_IDS) {
      const fx = fixtures[id];
      if (!fx) continue;
      try {
        const { pass, detail } = fn.run(fx);
        result(pass ? 'PASS' : 'FAIL', `${fn.name}  ${id}`, detail);
      } catch (e) {
        result('FAIL', `${fn.name}  ${id}  threw`, e.message);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────────────────
  const divider = '─'.repeat(62);
  console.log(`\n${C.bold}${divider}${C.reset}`);
  console.log(`${C.bold}R08 RESULT${C.reset}`);

  if (failCount === 0) {
    console.log(
      `\n  ${C.bold}${C.green}✅  PASS — all active checks passed${C.reset}` +
      `  (${stubs.length} stubs pending engine build)`
    );
  } else {
    console.log(
      `\n  ${C.bold}${C.red}❌  FAIL — ${failCount} failure(s)` +
      ` — fix before engine work proceeds${C.reset}`
    );
  }
  console.log(`${C.bold}${divider}${C.reset}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main();
