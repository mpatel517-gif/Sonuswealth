#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// diff-audit-vs-baseline.mjs — Phase B2
//
// Compare two audit reports (latest hybrid run vs 2026-05-21 baseline) and
// produce a per-persona PASS↔WARN↔FAIL delta with root-cause notes.
//
// Usage:
//   node scripts/diff-audit-vs-baseline.mjs <newReport.md> [baselineReport.md]
// Default baseline: tests/reports/audit-4469c39d-1779389389388.md
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const newPath = args[0] || (() => {
  // Pick the latest audit-*.md
  const dir = path.resolve('tests/reports');
  const files = fs.readdirSync(dir).filter(f => /^audit-[a-f0-9]+-\d+\.md$/.test(f));
  files.sort((a, b) => {
    const ta = parseInt(a.match(/-(\d+)\.md$/)[1]);
    const tb = parseInt(b.match(/-(\d+)\.md$/)[1]);
    return tb - ta;
  });
  return path.join(dir, files[0]);
})();
const baselinePath = args[1] || 'tests/reports/audit-4469c39d-1779389389388.md';

if (!fs.existsSync(newPath)) {
  console.error(`new report not found: ${newPath}`); process.exit(1);
}
if (!fs.existsSync(baselinePath)) {
  console.error(`baseline not found: ${baselinePath}`); process.exit(1);
}

function parseAudit(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // The audit reports have rows like:
  // | persona-a | 2025/26 | PASS | ... |
  // Walk per-line, extract rows.
  const rows = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*([\w\-]+)\s*\|\s*(\d{4}\/\d{2})\s*\|\s*(PASS|WARN|FAIL|SNAPSHOT_OK|ERROR)\s*\|/);
    if (m) {
      rows.push({ persona: m[1], year: m[2], status: m[3] });
    }
  }
  return rows;
}

const baseline = parseAudit(baselinePath);
const fresh = parseAudit(newPath);

const baseMap = new Map(baseline.map(r => [`${r.persona}|${r.year}`, r.status]));
const freshMap = new Map(fresh.map(r => [`${r.persona}|${r.year}`, r.status]));

const allKeys = new Set([...baseMap.keys(), ...freshMap.keys()]);
const transitions = { 'PASS→PASS': 0, 'PASS→WARN': 0, 'PASS→FAIL': 0,
                      'WARN→PASS': 0, 'WARN→WARN': 0, 'WARN→FAIL': 0,
                      'FAIL→PASS': 0, 'FAIL→WARN': 0, 'FAIL→FAIL': 0,
                      'NEW→PASS': 0, 'NEW→WARN': 0, 'NEW→FAIL': 0,
                      'REMOVED': 0 };
const interesting = []; // FAIL→PASS or PASS→FAIL or any FAIL/WARN

for (const key of allKeys) {
  const b = baseMap.get(key);
  const f = freshMap.get(key);
  const [persona, year] = key.split('|');
  if (!b && f) {
    transitions[`NEW→${f}`] = (transitions[`NEW→${f}`] || 0) + 1;
    if (f !== 'PASS') interesting.push({ persona, year, from: 'NEW', to: f });
  } else if (b && !f) {
    transitions.REMOVED++;
    interesting.push({ persona, year, from: b, to: 'REMOVED' });
  } else if (b === f) {
    transitions[`${b}→${f}`] = (transitions[`${b}→${f}`] || 0) + 1;
    if (b !== 'PASS') interesting.push({ persona, year, from: b, to: f });
  } else {
    transitions[`${b}→${f}`] = (transitions[`${b}→${f}`] || 0) + 1;
    interesting.push({ persona, year, from: b, to: f });
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  AUDIT DIFF — baseline → new');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Baseline: ${baselinePath} (${baseline.length} rows)`);
console.log(`  New:      ${newPath} (${fresh.length} rows)`);
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Status transitions:');
for (const [k, v] of Object.entries(transitions)) if (v > 0) console.log(`  ${k.padEnd(15)} ${v}`);
console.log('');

if (interesting.length) {
  console.log(`Interesting deltas (${interesting.length}):`);
  for (const r of interesting.slice(0, 100)) {
    console.log(`  ${r.persona.padEnd(20)} ${r.year}  ${r.from} → ${r.to}`);
  }
  if (interesting.length > 100) console.log(`  ... (${interesting.length - 100} more)`);
}

// Write structured output too
const outPath = `tests/reports/audit-diff-${Date.now()}.json`;
fs.writeFileSync(outPath, JSON.stringify({ baselinePath, newPath, transitions, interesting }, null, 2));
console.log(`\n  Structured output: ${outPath}`);
