// ─────────────────────────────────────────────────────────────────────────────
// Sonuswealth regression harness — runner
// Usage:
//   node tests/harness/runner.mjs --smoke
//   node tests/harness/runner.mjs --persona persona-a --year 2025/26
//   node tests/harness/runner.mjs --personas persona-a,persona-b --years all
//   node tests/harness/runner.mjs --full
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

import { generateSnapshot } from './snapshot.mjs';
import { validateSnapshot } from './validator.mjs';
import { ruleValidate } from './rule-validator.mjs';
import { getUsage } from './deepseek-client.mjs';
import { listPersonas, logAudit, loadPersona } from '../../src/lib/data-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, '../reports');

const ALL_YEARS = ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27'];

// ─── CLI parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { personas: [], years: [], smoke: false, full: false, family: null,
                 max: Infinity, dryRun: false, validate: true,
                 provider: 'rules' /* rules | deepseek | hybrid */ };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--smoke') args.smoke = true;
    else if (a === '--full') args.full = true;
    else if (a === '--persona') args.personas = [argv[++i]];
    else if (a === '--personas') args.personas = argv[++i].split(',');
    else if (a === '--year') args.years = [argv[++i]];
    else if (a === '--years') {
      const v = argv[++i];
      args.years = v === 'all' ? [...ALL_YEARS] : v.split(',');
    }
    else if (a === '--family') args.family = argv[++i];
    else if (a === '--max') args.max = parseInt(argv[++i]);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-validate') args.validate = false;
    else if (a === '--provider') args.provider = argv[++i];
    else if (a === '--deepseek') args.provider = 'deepseek';
    else if (a === '--rules-only') args.provider = 'rules';
    else if (a === '--hybrid') args.provider = 'hybrid';
    else if (a === '--matrix') args.matrix = true;
    else if (a === '--all-personas') args.allPersonas = true;
  }
  return args;
}

const args = parseArgs(process.argv);

// Resolve work set
let workPersonas = args.personas;
let workYears = args.years;

if (args.smoke) {
  workPersonas = ['persona-a'];
  workYears = ['2025/26'];
}
if (args.full) {
  // 7 main personas × all years = 42 runs
  workPersonas = ['persona-a','persona-b','persona-c','persona-d','persona-e','persona-f','persona-g'];
  workYears = [...ALL_YEARS];
}
if (args.matrix) {
  // All 85 matrix personas
  const matrixList = await listPersonas('matrix');
  const matrixIds = matrixList.map(p => p.persona_id);
  workPersonas = [...new Set([...workPersonas, ...matrixIds])];
  if (workYears.length === 0) workYears = [...ALL_YEARS];
}
// Phase A4: --family=mrT loads the 13 engine-test fixtures (mrT-core,
// mrT-couple, mrT-divorced, ...) that previously sat unused on disk.
if (args.family) {
  const familyList = await listPersonas(args.family);
  const familyIds = familyList.map(p => p.persona_id);
  workPersonas = [...new Set([...workPersonas, ...familyIds])];
  if (workYears.length === 0) workYears = [...ALL_YEARS];
}
if (args.allPersonas) {
  // Phase A4: was 7 main + 85 matrix = 92. Now includes mrT family (13) and
  // historical series (7) — so coverage manifest cells line up.
  const main = ['persona-a','persona-b','persona-c','persona-d','persona-e','persona-f','persona-g'];
  const [matrixList, mrTList, historicalList] = await Promise.all([
    listPersonas('matrix'),
    listPersonas('mrT'),
    listPersonas('historical'),
  ]);
  workPersonas = [
    ...main,
    ...matrixList.map(p => p.persona_id),
    ...mrTList.map(p => p.persona_id),
    ...historicalList.map(p => p.persona_id),
  ];
  // Dedup in case any family overlaps
  workPersonas = [...new Set(workPersonas)];
  if (workYears.length === 0) workYears = [...ALL_YEARS];
}
if (workPersonas.length === 0) {
  // Default to main 7
  workPersonas = ['persona-a','persona-b','persona-c','persona-d','persona-e','persona-f','persona-g'];
}
if (workYears.length === 0) {
  workYears = ['2025/26'];
}

const RUN_ID = randomUUID();
const totalWork = Math.min(workPersonas.length * workYears.length, args.max);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  SONUSWEALTH REGRESSION HARNESS');
console.log('  Run ID:', RUN_ID);
console.log('  Personas:', workPersonas.length, '(' + workPersonas.slice(0,5).join(',') + (workPersonas.length>5?'...':'') + ')');
console.log('  Years:', workYears.join(','));
console.log('  Total work:', totalWork, 'snapshots');
console.log('  Validate:', args.validate ? 'YES — provider: ' + args.provider : 'NO');
console.log('  Dry run:', args.dryRun ? 'YES' : 'NO');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = [];
let done = 0;
const startTime = Date.now();

outer: for (const personaId of workPersonas) {
  for (const taxYear of workYears) {
    if (done >= args.max) break outer;
    done += 1;
    const tag = `[${done}/${totalWork}] ${personaId} ${taxYear}`;

    let snapshot, validation;
    try {
      snapshot = await generateSnapshot(personaId, taxYear);
    } catch (e) {
      console.log(`${tag} ✗ snapshot failed: ${e.message}`);
      results.push({ personaId, taxYear, snapshot: null, validation: null,
                     status: 'ERROR', error: e.message });
      continue;
    }

    if (args.dryRun || !args.validate) {
      console.log(`${tag} ✓ snapshot (NW £${snapshot.net_worth?.toLocaleString()}, FQ ${snapshot.fq_score}, Risk ${snapshot.risk_score})`);
      results.push({ personaId, taxYear, snapshot, validation: null, status: 'SNAPSHOT_OK' });
      continue;
    }

    // Validation: rules-based, deepseek, or hybrid
    let rulesResult = null, deepseekResult = null;
    const personaProfile = await loadPersona(personaId).catch(() => ({}));

    // Always run rules-based validation (free, fast, offline)
    try {
      rulesResult = ruleValidate(snapshot, personaProfile);
    } catch (e) {
      rulesResult = { overall: 'FAIL', score: 0, headline: 'rule-validator threw: ' + e.message, results: [] };
    }

    if (args.provider === 'deepseek' || args.provider === 'hybrid') {
      try {
        const v = await validateSnapshot(personaProfile, taxYear, snapshot.macro_used, snapshot);
        deepseekResult = v;
      } catch (e) {
        deepseekResult = { success: false, error: e.message };
      }
    }

    // Combine: rules drives the verdict; deepseek annotates
    const verdict = (deepseekResult?.verdict) || rulesResult;
    validation = { verdict, rules: rulesResult, deepseek: deepseekResult };
    const overall = verdict?.overall || 'UNKNOWN';
    const score = verdict?.score ?? '?';
    const headline = verdict?.headline || deepseekResult?.error || 'no headline';
    const colour = overall === 'PASS' ? '✓' : overall === 'WARN' ? '⚠' : '✗';
    console.log(`${tag} ${colour} ${overall} ${score}/100 — ${headline.slice(0, 80)}`);

    results.push({ personaId, taxYear, snapshot, validation, status: overall });

    // Write audit row (no-op when Supabase tables not ready)
    try {
      await logAudit({
        run_id: RUN_ID,
        persona_id: personaId,
        tax_year: taxYear,
        test_category: 'overall',
        status: overall === 'UNKNOWN' ? 'SKIP' : overall,
        score: typeof score === 'number' ? score : null,
        validator_provider: 'deepseek',
        validator_model: 'deepseek-chat',
        verdict: headline,
        engine_output: snapshot,
        tokens_used: validation.tokens || 0,
      });
    } catch { /* DB not ready — skip */ }
  }
}

const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
const usage = getUsage();

// ─── Summary ─────────────────────────────────────────────────────────────────
const counts = results.reduce((a, r) => {
  a[r.status] = (a[r.status] || 0) + 1;
  return a;
}, {});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  Elapsed:', elapsedMin, 'min');
console.log('  DeepSeek calls:', usage.calls);
console.log('  DeepSeek tokens:', usage.tokens);
console.log('  Approx cost: $' + usage.approxCostUSD);
console.log('  Status breakdown:');
for (const [s, n] of Object.entries(counts)) {
  console.log(`    ${s}: ${n}`);
}

// ─── Write markdown report ───────────────────────────────────────────────────
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
const reportFile = path.join(REPORTS_DIR, `audit-${RUN_ID.slice(0,8)}-${Date.now()}.md`);

let md = `# Regression Audit — Run ${RUN_ID}\n\n`;
md += `**Date:** ${new Date().toISOString()}\n`;
md += `**Elapsed:** ${elapsedMin} min\n`;
md += `**DeepSeek calls:** ${usage.calls} / tokens: ${usage.tokens} / approx cost: $${usage.approxCostUSD}\n\n`;
md += `## Summary\n\n`;
md += `| Status | Count |\n|---|---|\n`;
for (const [s, n] of Object.entries(counts)) md += `| ${s} | ${n} |\n`;
md += `\n## Persona × Year matrix\n\n`;
md += `| Persona | Year | Status | Score | NW | FQ | Risk | Headline |\n|---|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const s = r.snapshot;
  const v = r.validation?.verdict;
  md += `| ${r.personaId} | ${r.taxYear} | ${r.status} | ${v?.score ?? '—'} | `;
  md += `${s ? '£' + (s.net_worth ?? 0).toLocaleString() : '—'} | `;
  md += `${s?.fq_score ?? '—'} | ${s?.risk_score ?? '—'} | `;
  md += `${(v?.headline || r.error || '').slice(0, 80).replace(/\|/g, '\\|')} |\n`;
}
md += `\n## FAILs and WARNs (drill-down)\n\n`;
const issues = results.filter(r => ['FAIL', 'WARN', 'ERROR', 'VALIDATE_ERROR'].includes(r.status));
if (issues.length === 0) {
  md += `*None — all runs PASS.*\n`;
} else {
  for (const r of issues) {
    md += `### ${r.personaId} / ${r.taxYear} — ${r.status}\n\n`;
    if (r.validation?.verdict?.results) {
      for (const cat of r.validation.verdict.results) {
        md += `- **${cat.category}** [${cat.status}]: ${cat.comment}\n`;
      }
    }
    if (r.error) md += `\n_Error: ${r.error}_\n`;
    md += `\n`;
  }
}

fs.writeFileSync(reportFile, md);
console.log('\n  Report:', reportFile);
console.log('═══════════════════════════════════════════════════════════════');

// Exit code: 1 if any FAIL or ERROR, 0 otherwise
const hasFailures = results.some(r => ['FAIL', 'ERROR', 'VALIDATE_ERROR'].includes(r.status));
process.exit(hasFailures ? 1 : 0);
