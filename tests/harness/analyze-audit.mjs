// ─────────────────────────────────────────────────────────────────────────────
// analyze-audit.mjs — parse the latest audit markdown report and produce
// a consolidated FAIL/WARN pattern summary suitable for fix prioritization.
// Usage: node tests/harness/analyze-audit.mjs [report-file]
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, '../reports');

function latestReport() {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('audit-') && f.endsWith('.md'))
    .map(f => ({ f, mtime: fs.statSync(path.join(REPORTS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? path.join(REPORTS_DIR, files[0].f) : null;
}

const file = process.argv[2] || latestReport();
if (!file) {
  console.error('No report found.');
  process.exit(1);
}

console.log('Analyzing:', path.basename(file));
const content = fs.readFileSync(file, 'utf8');

// Parse matrix rows: | persona | year | status | score | NW | FQ | Risk | headline |
const rows = [];
const rowPattern = /\|\s*([^|]+?)\s*\|\s*([0-9]{4}\/[0-9]{2})\s*\|\s*(PASS|WARN|FAIL|ERROR|VALIDATE_ERROR|UNKNOWN)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
let m;
while ((m = rowPattern.exec(content)) !== null) {
  rows.push({
    persona: m[1].trim(),
    year: m[2],
    status: m[3],
    score: m[4].trim(),
    nw: m[5].trim(),
    fq: m[6].trim(),
    risk: m[7].trim(),
    headline: m[8].trim(),
  });
}

const real = rows.filter(r => r.persona && !r.persona.includes('Persona') && r.persona.length < 50);
console.log(`Total rows parsed: ${real.length}`);

const byStatus = {};
real.forEach(r => byStatus[r.status] = (byStatus[r.status] || 0) + 1);
console.log('\nStatus breakdown:');
for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}

const issues = real.filter(r => ['FAIL', 'WARN'].includes(r.status));
const patterns = {};
const keywords = [
  ['income tax', 'income_tax_issue'],
  ['NI ', 'ni_issue'],
  ['cashflow', 'cashflow_issue'],
  ['surplus', 'cashflow_issue'],
  ['IHT', 'iht_issue'],
  ['estate', 'iht_issue'],
  ['protection', 'protection_issue'],
  ['risk', 'risk_issue'],
  ['ISA', 'isa_issue'],
  ['SIPP', 'sipp_issue'],
  ['missing', 'missing_data'],
  ['incomplete', 'missing_data'],
  ['implausible', 'implausible_value'],
  ['zero income', 'zero_income'],
  ['negative', 'negative_value'],
  ['spousal', 'spousal_transfer'],
  ['couple', 'spousal_transfer'],
];

for (const r of issues) {
  const found = new Set();
  for (const [kw, tag] of keywords) {
    if (r.headline.toLowerCase().includes(kw.toLowerCase())) found.add(tag);
  }
  if (found.size === 0) found.add('other');
  for (const tag of found) {
    if (!patterns[tag]) patterns[tag] = [];
    patterns[tag].push(r);
  }
}

console.log('\nIssue patterns (' + issues.length + ' total):');
const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1].length - a[1].length);
for (const [pattern, list] of sortedPatterns) {
  const personas = new Set(list.map(r => r.persona));
  const years = new Set(list.map(r => r.year));
  console.log(`  ${pattern}: ${list.length} hits across ${personas.size} personas × ${years.size} years`);
}

console.log('\nTop personas with issues:');
const byPersona = {};
issues.forEach(r => {
  if (!byPersona[r.persona]) byPersona[r.persona] = { fails: 0, warns: 0 };
  if (r.status === 'FAIL') byPersona[r.persona].fails++;
  else byPersona[r.persona].warns++;
});
const sorted = Object.entries(byPersona)
  .sort((a, b) => (b[1].fails * 2 + b[1].warns) - (a[1].fails * 2 + a[1].warns))
  .slice(0, 10);
for (const [p, c] of sorted) console.log(`  ${p}: ${c.fails} FAIL, ${c.warns} WARN`);

const summaryFile = file.replace('.md', '-ANALYSIS.md');
let summary = `# Findings Analysis — ${path.basename(file)}\n\n`;
summary += `**Source report:** ${path.basename(file)}\n`;
summary += `**Total rows:** ${real.length}\n\n`;
summary += `## Status breakdown\n\n`;
for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) summary += `- **${s}**: ${n}\n`;
summary += `\n## Issue patterns\n\n| Pattern | Hits | Personas | Years |\n|---|---|---|---|\n`;
for (const [pattern, list] of sortedPatterns) {
  const personas = new Set(list.map(r => r.persona));
  const years = new Set(list.map(r => r.year));
  summary += `| ${pattern} | ${list.length} | ${personas.size} | ${years.size} |\n`;
}
summary += `\n## Top personas with issues\n\n| Persona | FAIL | WARN | Impact |\n|---|---|---|---|\n`;
for (const [p, c] of sorted) summary += `| ${p} | ${c.fails} | ${c.warns} | ${c.fails * 2 + c.warns} |\n`;
summary += `\n## All FAILs\n\n`;
const fails = real.filter(r => r.status === 'FAIL');
if (fails.length === 0) summary += `*None.*\n`;
else {
  summary += `| Persona | Year | Score | Headline |\n|---|---|---|---|\n`;
  for (const r of fails) summary += `| ${r.persona} | ${r.year} | ${r.score} | ${r.headline.replace(/\|/g, '\\|')} |\n`;
}
fs.writeFileSync(summaryFile, summary);
console.log('\nAnalysis written to:', summaryFile);
