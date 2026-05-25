#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Seed Supabase data layer from JSON sources.
//
// Bulk-loads:
//   finio_rules_bundles      ← src/rules/UK-2026.1.1.json + UK-2021.1 (if present)
//   finio_macro_history      ← 6 UK tax years 2021/22 → 2026/27
//   finio_macro_variables    ← current (2026/27) values
//   finio_personas           ← all JSON in src/rules/personas/{,matrix,historical}/
//
// Idempotent: uses UPSERT on the natural keys defined in migration 011.
// Re-running over existing rows refreshes content; no duplicates.
//
// Required env vars:
//   SUPABASE_URL (or VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node scripts/seed-supabase-data-layer.mjs              # full seed
//   node scripts/seed-supabase-data-layer.mjs --rules-only # only rules bundle
//   node scripts/seed-supabase-data-layer.mjs --personas-only
//   node scripts/seed-supabase-data-layer.mjs --macro-only
//   node scripts/seed-supabase-data-layer.mjs --dry-run    # read JSON, no DB writes
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// Auto-load .env.local if present (Node 20.6+ native API)
const envFile = path.join(REPO_ROOT, '.env.local');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envFile); } catch { /* ignore */ }
}

// ─── Args ────────────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const RULES_ONLY = args.has('--rules-only');
const PERSONAS_ONLY = args.has('--personas-only');
const MACRO_ONLY = args.has('--macro-only');
const ALL = !RULES_ONLY && !PERSONAS_ONLY && !MACRO_ONLY;

// ─── Supabase client ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_ROLE_KEY)) {
  console.error('❌ Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  console.error('   Set them via .env.local or shell env, or use --dry-run to test JSON parsing only.');
  process.exit(1);
}

const supabase = DRY_RUN
  ? null
  : createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readJSON(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function log(level, msg) {
  const tag = { ok: '✓', warn: '⚠', err: '✗', info: '·' }[level] || '·';
  console.log(`${tag} ${msg}`);
}

async function upsert(table, rows, onConflict) {
  if (DRY_RUN) {
    log('info', `[DRY] would upsert ${rows.length} rows to ${table}`);
    return { count: rows.length };
  }
  const { error, count } = await supabase
    .from(table)
    .upsert(rows, { onConflict, count: 'exact' });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  return { count: count ?? rows.length };
}

// ─── 1. Rules bundles ────────────────────────────────────────────────────────
async function seedRulesBundles() {
  log('info', 'Seeding finio_rules_bundles ...');
  const bundles = [];

  // UK-2026.1.1 (current canonical)
  const uk2026 = readJSON('src/rules/UK-2026.1.1.json');
  if (uk2026) {
    bundles.push({
      bundle_id: 'UK-2026.1.1',
      jurisdiction: 'UK',
      tax_year: '2026/27',
      effective_from: '2026-04-06',
      effective_to: null,
      status: 'active',
      content: uk2026,
      source_url: 'https://www.gov.uk/government/publications/finance-bill-2026-27',
      source_doc: 'Finance Act 2026',
      activated_at: new Date().toISOString(),
    });
  } else {
    log('warn', 'src/rules/UK-2026.1.1.json not found — skipping');
  }

  // UK-2021.1 (historical, for back-test)
  const uk2021 = readJSON('src/rules/tax-2021.json');
  if (uk2021) {
    bundles.push({
      bundle_id: 'UK-2021.1',
      jurisdiction: 'UK',
      tax_year: '2021/22',
      effective_from: '2021-04-06',
      effective_to: '2022-04-05',
      status: 'archived',
      content: uk2021,
      source_url: 'https://www.gov.uk/government/publications/finance-bill-2021',
      source_doc: 'Finance Act 2021',
    });
  }

  if (!bundles.length) {
    log('warn', 'No rule bundles to seed');
    return;
  }

  const { count } = await upsert('finio_rules_bundles', bundles, 'bundle_id,jurisdiction');
  log('ok', `rules_bundles: ${count} rows`);
}

// ─── 2. Macro history (6 years) ──────────────────────────────────────────────
const UK_MACRO_HISTORY = {
  '2021/22': { cpi_inflation: 0.031, boe_base_rate: 0.001, gdp_growth: 0.076,
               wage_growth: 0.055, house_price_growth: 0.098,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 40000,
               equity_market_return: 0.184, gilt_yield_10yr: 0.012,
               annuity_rate_65: 0.038, life_expectancy_m: 79, life_expectancy_f: 83,
               effective_date: '2022-04-05' },
  '2022/23': { cpi_inflation: 0.091, boe_base_rate: 0.035, gdp_growth: 0.041,
               wage_growth: 0.065, house_price_growth: 0.055,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 40000,
               equity_market_return: -0.026, gilt_yield_10yr: 0.038,
               annuity_rate_65: 0.061, life_expectancy_m: 79, life_expectancy_f: 83,
               effective_date: '2023-04-05' },
  '2023/24': { cpi_inflation: 0.068, boe_base_rate: 0.0525, gdp_growth: 0.001,
               wage_growth: 0.079, house_price_growth: -0.014,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000,
               equity_market_return: 0.082, gilt_yield_10yr: 0.043,
               annuity_rate_65: 0.072, life_expectancy_m: 79, life_expectancy_f: 83,
               effective_date: '2024-04-05' },
  '2024/25': { cpi_inflation: 0.034, boe_base_rate: 0.05, gdp_growth: 0.008,
               wage_growth: 0.058, house_price_growth: 0.031,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000,
               equity_market_return: 0.092, gilt_yield_10yr: 0.041,
               annuity_rate_65: 0.067, life_expectancy_m: 80, life_expectancy_f: 84,
               effective_date: '2025-04-05' },
  '2025/26': { cpi_inflation: 0.032, boe_base_rate: 0.0425, gdp_growth: 0.008,
               wage_growth: 0.057, house_price_growth: 0.035,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000,
               equity_market_return: 0.072, gilt_yield_10yr: 0.045,
               annuity_rate_65: 0.062, life_expectancy_m: 80, life_expectancy_f: 84,
               effective_date: '2026-04-05' },
  '2026/27': { cpi_inflation: 0.025, boe_base_rate: 0.04, gdp_growth: 0.012,
               wage_growth: 0.045, house_price_growth: 0.03,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000,
               equity_market_return: 0.068, gilt_yield_10yr: 0.042,
               annuity_rate_65: 0.058, life_expectancy_m: 80, life_expectancy_f: 84,
               effective_date: '2027-04-05' },
};

const MACRO_LABELS = {
  cpi_inflation: { label: 'UK CPI Inflation', unit: 'percent', source: 'ONS' },
  boe_base_rate: { label: 'Bank of England Base Rate', unit: 'percent', source: 'BoE' },
  gdp_growth: { label: 'UK GDP Growth', unit: 'percent', source: 'ONS' },
  wage_growth: { label: 'Average Wage Growth', unit: 'percent', source: 'ONS' },
  house_price_growth: { label: 'UK House Price Index', unit: 'percent', source: 'ONS' },
  personal_allowance: { label: 'Income Tax Personal Allowance', unit: 'gbp', source: 'HMRC' },
  isa_limit: { label: 'Annual ISA Allowance', unit: 'gbp', source: 'HMRC' },
  pension_aa: { label: 'Pension Annual Allowance', unit: 'gbp', source: 'HMRC' },
  equity_market_return: { label: 'FTSE All-Share Total Return', unit: 'percent', source: 'FTSE' },
  gilt_yield_10yr: { label: 'UK 10-Year Gilt Yield', unit: 'percent', source: 'BoE' },
  annuity_rate_65: { label: 'Best annuity rate (single life, 65)', unit: 'percent', source: 'Hargreaves Lansdown' },
  life_expectancy_m: { label: 'Life Expectancy at 65 (Male)', unit: 'years', source: 'ONS' },
  life_expectancy_f: { label: 'Life Expectancy at 65 (Female)', unit: 'years', source: 'ONS' },
};

async function seedMacro() {
  log('info', 'Seeding finio_macro_history ...');
  const historyRows = [];
  for (const [taxYear, vars] of Object.entries(UK_MACRO_HISTORY)) {
    const effDate = vars.effective_date;
    for (const [key, value] of Object.entries(vars)) {
      if (key === 'effective_date') continue;
      const meta = MACRO_LABELS[key] || { source: 'unknown', unit: 'percent' };
      historyRows.push({
        jurisdiction: 'UK',
        tax_year: taxYear,
        variable_key: key,
        value: Number(value),
        effective_date: effDate,
        source: meta.source,
        source_url: null,
      });
    }
  }

  const histRes = await upsert('finio_macro_history', historyRows, 'jurisdiction,tax_year,variable_key');
  log('ok', `macro_history: ${histRes.count} rows`);

  // Current macro variables (snapshot of 2026/27)
  log('info', 'Seeding finio_macro_variables (current = 2026/27) ...');
  const currentVars = UK_MACRO_HISTORY['2026/27'];
  const varRows = Object.entries(currentVars)
    .filter(([k]) => k !== 'effective_date')
    .map(([key, value]) => {
      const meta = MACRO_LABELS[key] || { label: key, unit: 'percent', source: 'unknown' };
      return {
        jurisdiction: 'UK',
        variable_key: key,
        label: meta.label,
        value: Number(value),
        unit: meta.unit,
        source: meta.source,
        source_url: null,
        effective_date: currentVars.effective_date,
        pulled_at: new Date().toISOString(),
      };
    });

  const varRes = await upsert('finio_macro_variables', varRows, 'jurisdiction,variable_key');
  log('ok', `macro_variables: ${varRes.count} rows`);
}

// ─── 3. Personas ─────────────────────────────────────────────────────────────
async function seedPersonas() {
  log('info', 'Seeding finio_personas ...');
  const folders = [
    { family: 'main',       rel: 'src/rules/personas' },
    { family: 'matrix',     rel: 'src/rules/personas/matrix' },
    { family: 'historical', rel: 'src/rules/personas/historical' },
  ];

  const rows = [];
  for (const { family, rel } of folders) {
    const dir = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) continue;
      let profile;
      try {
        profile = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (e) {
        log('warn', `${rel}/${file} — JSON parse failed, skipping`);
        continue;
      }

      const personaId = file.replace(/\.json$/, '');
      // CASE-001..027 sit in matrix/ but are classified separately
      const computedFamily = /^CASE-\d+/.test(personaId) ? 'case' : family;

      rows.push({
        persona_id: personaId,
        family: computedFamily,
        name: profile.name || profile.displayName || personaId,
        archetype: profile.archetype || profile.type || null,
        life_stage: normaliseLifeStage(profile.lifeStageName || profile.life_stage),
        jurisdiction: profile.jurisdiction || 'UK',
        baseline_year: profile.baselineYear || profile.baseline_year || '2026/27',
        profile,
        source_file: `${rel}/${file}`,
      });
    }
  }

  // Batch in chunks of 50 to keep payloads reasonable
  const CHUNK = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { count } = await upsert('finio_personas', slice, 'persona_id');
    total += count;
  }
  log('ok', `personas: ${total} rows (across ${Math.ceil(rows.length / CHUNK)} batches)`);
}

function normaliseLifeStage(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  const map = {
    'foundation': 'foundation', 'accumulation': 'accumulation',
    'consolidation': 'consolidation', 'transition': 'transition',
    'preservation': 'preservation', 'decumulation': 'decumulation',
    'legacy': 'legacy', 'aged-out': 'aged-out', 'aged out': 'aged-out',
  };
  return map[s] || null;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━ Sonuswealth data-layer seed ━━━');
  console.log(`mode: ${DRY_RUN ? 'DRY-RUN (no DB writes)' : 'LIVE'}`);
  console.log(`scope: ${RULES_ONLY ? 'rules-only' : PERSONAS_ONLY ? 'personas-only' : MACRO_ONLY ? 'macro-only' : 'all'}`);
  console.log('');

  const t0 = Date.now();
  try {
    if (RULES_ONLY || ALL)    await seedRulesBundles();
    if (MACRO_ONLY || ALL)    await seedMacro();
    if (PERSONAS_ONLY || ALL) await seedPersonas();
  } catch (e) {
    log('err', e.message);
    process.exit(1);
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(`━━━ Seed complete in ${dt}s ━━━`);
}

main();
