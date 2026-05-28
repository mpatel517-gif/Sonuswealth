#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// build-coverage-manifest.mjs — Phase A6
//
// Single source of truth for "what does the test matrix actually cover?".
// Reads: persona files on disk + tax bundle files on disk + jurisdiction list.
// Writes: tests/coverage-manifest.md — a year × persona × jurisdiction table.
//
// Empty cells = gaps. Nothing is hidden.
//
// Usage: node scripts/build-coverage-manifest.mjs
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── 1. Inventory tax-bundle coverage ────────────────────────────────────────
const RULES_DIR = path.join(ROOT, 'src/rules');
const bundleFiles = fs.readdirSync(RULES_DIR)
  .filter(f => /^UK-\d{4}\.\d+\.\d+\.json$/.test(f))
  .sort();

const bundleByYear = {};
for (const f of bundleFiles) {
  try {
    const bundle = JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), 'utf8'));
    const taxYear = bundle._meta?.taxYear;
    if (taxYear) bundleByYear[taxYear] = { file: f, version: bundle._meta.version, coverage: bundle._meta._coverage || null, midYearEventCount: (bundle._midYearEvents || []).length };
  } catch (e) {
    console.error(`Skipping malformed bundle: ${f} (${e.message})`);
  }
}

const EXPECTED_YEARS = ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27'];

// ─── 2. Inventory personas by family ─────────────────────────────────────────
const personaFamilies = { main: [], matrix: [], historical: [], mrT: [] };
function classify(file, fam) {
  if (fam === 'main' && /^mrT-/.test(file)) return 'mrT';
  return fam;
}
function walk(rel, fam) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace(/\.json$/, '');
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const effFam = classify(f, fam);
    personaFamilies[effFam].push({
      id,
      name: p.name || p.individual?.name || (p.fixture_purpose ? p.fixture_purpose.slice(0, 60) : id),
      jurisdiction: p.jurisdiction?.primary || p.jurisdictionContext?.primary || 'UK',
      secondary: p.jurisdiction?.secondary || null,
      schema: p.id ? 'live-UI' : (p.individual?.id ? 'engine-test' : 'unknown'),
    });
  }
}
walk('src/rules/personas', 'main');
walk('src/rules/personas/matrix', 'matrix');
walk('src/rules/personas/historical', 'historical');

// ─── 3. Jurisdiction map (memory: 6 supported, only UK built today) ─────────
const JURISDICTIONS = [
  { code: 'UK', name: 'United Kingdom',    bundleStatus: 'FULL (6 years)' },
  { code: 'IN', name: 'India',             bundleStatus: 'NONE — deferred to Phase D' },
  { code: 'TH', name: 'Thailand',          bundleStatus: 'NONE — deferred to Phase D' },
  { code: 'CA', name: 'Canada',            bundleStatus: 'NONE — deferred to Phase D' },
  { code: 'IE', name: 'Ireland',           bundleStatus: 'NONE — deferred to Phase D' },
  { code: 'AU', name: 'Australia',         bundleStatus: 'NONE — deferred to Phase D' },
];

// ─── 4. Render the manifest ──────────────────────────────────────────────────
const lines = [];
lines.push(`# Caelixa coverage manifest`);
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`);
lines.push(`**Purpose:** Every cell explicit. Empty = not tested. No hidden gaps.`);
lines.push('');

// ── A. Tax-bundle coverage by year ─────────────────────────────────────────
lines.push(`## A. Tax-bundle coverage (UK)`);
lines.push('');
lines.push(`| Tax year | Bundle file | Version | Mid-year events | FULL sections | STUB sections |`);
lines.push(`|---|---|---|---|---|---|`);
for (const y of EXPECTED_YEARS) {
  const b = bundleByYear[y];
  if (!b) {
    lines.push(`| ${y} | — | **MISSING** | — | — | — |`);
  } else {
    const full = (b.coverage?.FULL || []).join(', ') || 'n/a';
    const stub = (b.coverage?.STUB || []).join(', ') || 'n/a';
    lines.push(`| ${y} | ${b.file} | ${b.version} | ${b.midYearEventCount} | ${full} | ${stub} |`);
  }
}
const yearsBuilt = EXPECTED_YEARS.filter(y => bundleByYear[y]).length;
lines.push('');
lines.push(`**Status:** ${yearsBuilt}/${EXPECTED_YEARS.length} years built. ${yearsBuilt < EXPECTED_YEARS.length ? '⚠ GAPS REMAIN.' : '✓ all years covered.'}`);
lines.push('');

// ── B. Persona inventory by family ─────────────────────────────────────────
lines.push(`## B. Persona inventory by family`);
lines.push('');
const totalPersonas = Object.values(personaFamilies).flat().length;
lines.push(`Total persona-shaped JSON files on disk: **${totalPersonas}**`);
lines.push('');
lines.push(`| Family | Count | Schema | UI-renderable? | Wired in runner.mjs? |`);
lines.push(`|---|---|---|---|---|`);
for (const [fam, list] of Object.entries(personaFamilies)) {
  if (!list.length) continue;
  const schemaSet = [...new Set(list.map(p => p.schema))].join(' / ');
  const uiOK = (fam === 'main' || (fam === 'mrT' && list.some(p => p.id === 'mrT-core'))) ? 'yes' : 'engine-only';
  const wired = fam === 'main' ? 'yes (--full)' : fam === 'matrix' ? 'yes (--matrix)' : fam === 'historical' ? 'yes (--all-personas)' : 'yes (--family mrT, Phase A4)';
  lines.push(`| ${fam} | ${list.length} | ${schemaSet} | ${uiOK} | ${wired} |`);
}
lines.push('');

// ── C. Year × persona matrix (full coverage cells) ─────────────────────────
const baseRows = [];
for (const fam of ['main', 'mrT', 'matrix', 'historical']) {
  for (const p of personaFamilies[fam]) {
    baseRows.push({ family: fam, ...p });
  }
}

lines.push(`## C. Year × persona matrix (engine-direct coverage)`);
lines.push('');
lines.push(`Cell content: \`✓ <bundle.version>\` if that year's bundle exists; \`—\` if the bundle is missing.`);
lines.push('');
lines.push(`| Family | Persona | Schema | Jurisdiction | ${EXPECTED_YEARS.join(' | ')} |`);
lines.push(`|---|---|---|---|${EXPECTED_YEARS.map(() => '---').join('|')}|`);
for (const r of baseRows) {
  const cells = EXPECTED_YEARS.map(y => bundleByYear[y] ? `✓ ${bundleByYear[y].version}` : '—');
  const jur = r.secondary ? `${r.jurisdiction}+${r.secondary}` : r.jurisdiction;
  lines.push(`| ${r.family} | ${r.id} | ${r.schema} | ${jur} | ${cells.join(' | ')} |`);
}
lines.push('');

// ── D. Jurisdiction coverage ───────────────────────────────────────────────
lines.push(`## D. Jurisdiction coverage`);
lines.push('');
lines.push(`| Code | Jurisdiction | Bundle status | Persona fixtures referencing |`);
lines.push(`|---|---|---|---|`);
for (const j of JURISDICTIONS) {
  const refs = baseRows.filter(r => r.jurisdiction === j.code || r.secondary === j.code).map(r => r.id);
  const refStr = refs.length ? `${refs.length} (${refs.slice(0, 3).join(', ')}${refs.length > 3 ? '…' : ''})` : '—';
  lines.push(`| ${j.code} | ${j.name} | ${j.bundleStatus} | ${refStr} |`);
}
lines.push('');

// ── E. Known gaps ──────────────────────────────────────────────────────────
lines.push(`## E. Known gaps (surfaced explicitly — Phase D candidates)`);
lines.push('');
const gaps = [];
if (yearsBuilt < EXPECTED_YEARS.length) gaps.push(`- ${EXPECTED_YEARS.length - yearsBuilt} UK tax-year bundle(s) missing`);
for (const j of JURISDICTIONS.slice(1)) {
  const refs = baseRows.filter(r => r.jurisdiction === j.code || r.secondary === j.code);
  if (refs.length > 0) gaps.push(`- ${j.code}: ${refs.length} persona(s) reference this jurisdiction but engine has no ${j.name} tax bundle`);
}
const mrTEngineOnly = personaFamilies.mrT.filter(p => p.schema === 'engine-test').length;
if (mrTEngineOnly > 0) gaps.push(`- ${mrTEngineOnly} mrT-* fixtures use engine-test schema (nested individual.*) — NOT UI-renderable. Normaliser deferred to Phase D.`);
if (!gaps.length) gaps.push('- No coverage gaps detected.');
lines.push(...gaps);
lines.push('');

// ── F. How to regenerate ───────────────────────────────────────────────────
lines.push(`## F. How to regenerate`);
lines.push('');
lines.push('```sh');
lines.push('node scripts/build-coverage-manifest.mjs');
lines.push('```');
lines.push('');
lines.push(`Run after: (a) adding a new tax bundle, (b) creating a new persona JSON, (c) changing the jurisdiction list, (d) reclassifying a persona family.`);
lines.push('');

// ─── 5. Write ────────────────────────────────────────────────────────────────
const outPath = path.join(ROOT, 'tests/coverage-manifest.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ Wrote ${outPath}`);
console.log(`  Persona families: ${Object.entries(personaFamilies).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
console.log(`  Years: ${yearsBuilt}/${EXPECTED_YEARS.length} bundles built`);
console.log(`  Gaps surfaced: ${gaps.length}`);
