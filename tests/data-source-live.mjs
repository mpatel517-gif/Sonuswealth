#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 verification harness.
//
// Exercises every public read in src/lib/data-source.js against:
//   - Supabase (if env vars are present + tables reachable)
//   - JSON fallback (always)
//
// Pass criterion per master-schedule.md §5:
//   "live rules + macro + persona fetched with timestamps"
//
// Exits non-zero on any required read failure.
//
// Usage:
//   node tests/data-source-live.mjs                 # auto-detect mode
//   node tests/data-source-live.mjs --json          # force json fallback
//   node tests/data-source-live.mjs --supabase      # force supabase, fail if absent
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Auto-load .env.local if present (Node 20.6+ native API)
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const envFile = path.join(REPO_ROOT, '.env.local');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envFile); } catch { /* ignore */ }
}

const {
  loadBundle,
  loadMacroVariables,
  loadMacroVariablesForYear,
  loadPersona,
  listPersonas,
  diagnose,
} = await import('../src/lib/data-source.js');

const args = new Set(process.argv.slice(2));
const FORCE_JSON = args.has('--json');
const FORCE_SUPABASE = args.has('--supabase');
const SOURCE_OPT = FORCE_JSON ? { source: 'json' } : FORCE_SUPABASE ? { source: 'supabase' } : {};

let failures = 0;
const t0 = Date.now();

function check(name, ok, detail = '') {
  const tag = ok ? '✓' : '✗';
  console.log(`  ${tag} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

function header(s) {
  console.log('\n━━━ ' + s + ' ━━━');
}

async function timed(fn) {
  const t = Date.now();
  const v = await fn();
  return { value: v, ms: Date.now() - t };
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  header('Diagnose');
  const d = await diagnose();
  console.log('  ' + JSON.stringify(d, null, 2).split('\n').join('\n  '));
  if (FORCE_SUPABASE && d.mode !== 'supabase') {
    check('--supabase flag honoured', false, 'mode resolved to ' + d.mode);
    process.exit(1);
  }

  // ─── Rules bundle ──────────────────────────────────────────────────────────
  header('Rules bundle: UK-2026.1.1');
  const r = await timed(() => loadBundle('UK-2026.1.1', SOURCE_OPT));
  check('loadBundle returned object', r.value && typeof r.value === 'object', `${r.ms}ms`);
  check('bundle has tax data', !!(r.value?.income || r.value?.incomeTax || r.value?.capitalGains || r.value?.inheritanceTax),
        Object.keys(r.value || {}).slice(0, 6).join(', '));
  console.log('    timestamp:', new Date().toISOString());

  // ─── Macro variables (current) ─────────────────────────────────────────────
  header('Macro variables (current)');
  const m = await timed(() => loadMacroVariables(SOURCE_OPT));
  check('loadMacroVariables returned k/v map', m.value && typeof m.value === 'object', `${m.ms}ms`);
  check('cpi_inflation present', 'cpi_inflation' in m.value, `value=${m.value?.cpi_inflation}`);
  check('boe_base_rate present', 'boe_base_rate' in m.value, `value=${m.value?.boe_base_rate}`);
  console.log('    timestamp:', new Date().toISOString());
  console.log('    keys:', Object.keys(m.value || {}).length);

  // ─── Macro variables (historical) ──────────────────────────────────────────
  header('Macro variables (2021/22 historical)');
  const mh = await timed(() => loadMacroVariablesForYear('2021/22', SOURCE_OPT));
  check('loadMacroVariablesForYear returned data', mh.value && Object.keys(mh.value).length > 0, `${mh.ms}ms`);
  check('historical cpi differs from current', mh.value?.cpi_inflation !== m.value?.cpi_inflation,
        `2021=${mh.value?.cpi_inflation} vs 2026=${m.value?.cpi_inflation}`);

  // ─── Persona ──────────────────────────────────────────────────────────────
  header('Persona: persona-a (Bruce Wayne)');
  const p = await timed(() => loadPersona('persona-a', SOURCE_OPT));
  check('loadPersona returned object', p.value && typeof p.value === 'object', `${p.ms}ms`);
  check('persona has name', !!(p.value?.name || p.value?.displayName), p.value?.name || p.value?.displayName);
  check('persona has age', typeof p.value?.age === 'number', `age=${p.value?.age}`);

  // ─── Persona list ──────────────────────────────────────────────────────────
  header('Persona list (all families)');
  const l = await timed(() => listPersonas(null, SOURCE_OPT));
  check('listPersonas returned array', Array.isArray(l.value), `${l.value?.length} entries, ${l.ms}ms`);
  const byFamily = (l.value || []).reduce((acc, x) => {
    acc[x.family] = (acc[x.family] || 0) + 1;
    return acc;
  }, {});
  console.log('    by family:', JSON.stringify(byFamily));
  check('at least 7 main personas', (byFamily.main || 0) >= 7, `main=${byFamily.main}`);

  // ─── Matrix persona ───────────────────────────────────────────────────────
  header('Matrix persona: single-decumulation');
  try {
    const pm = await timed(() => loadPersona('single-decumulation', SOURCE_OPT));
    check('matrix persona loaded', pm.value && typeof pm.value === 'object', `${pm.ms}ms`);
  } catch (e) {
    check('matrix persona loaded', false, e.message);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log('');
  console.log('━━━ Verification complete in ' + dt + 's ━━━');
  if (failures > 0) {
    console.log('✗ ' + failures + ' check(s) failed');
    process.exit(1);
  } else {
    console.log('✓ all checks passed (mode=' + d.mode + ')');
  }
}

run().catch(e => {
  console.error('\nFATAL:', e.message);
  console.error(e.stack);
  process.exit(2);
});
