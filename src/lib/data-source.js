/**
 * Caelixa Data Source — Unified read/write layer
 *
 * Resolves data from Supabase (primary) with JSON fallback (dev offline).
 *
 * Phase 2 contract: engine code reads through this module instead of
 * importing JSON files directly. This lets us migrate to Supabase
 * incrementally without touching every engine call site.
 *
 * Functions:
 *   loadBundle(bundleId, opts)             → UK rules bundle JSON
 *   loadMacroVariables(opts)               → current macro values (k/v map)
 *   loadMacroVariablesForYear(taxYear)     → historical macro for back-test
 *   loadPersona(personaId, opts)           → persona profile JSON
 *   listPersonas(family, opts)             → array of persona summaries
 *   saveSnapshot(snapshot)                 → write engine output (Supabase only)
 *   logAudit(entry)                        → write test audit row (Supabase only)
 *
 * Mode resolution (priority):
 *   1. opts.source explicit override ('supabase' | 'json')
 *   2. process.env.DATA_SOURCE env var
 *   3. 'supabase' when keys present + reachable
 *   4. 'json' fallback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// ─── Supabase client (lazy, server-side only — uses service_role) ───────────
let _adminClient = null;
function adminClient() {
  if (_adminClient) return _adminClient;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _adminClient = createClient(url, key, { auth: { persistSession: false } });
  return _adminClient;
}

// ─── Mode detection ──────────────────────────────────────────────────────────
let _modeCache = null;
async function resolveMode(opts = {}) {
  if (opts.source) return opts.source;
  if (process.env.DATA_SOURCE) return process.env.DATA_SOURCE;
  if (_modeCache) return _modeCache;

  const c = adminClient();
  if (!c) return (_modeCache = 'json');

  // Probe: is at least one of our new tables reachable?
  try {
    const { error } = await c.from('finio_rules_bundles').select('id').limit(1);
    if (!error) return (_modeCache = 'supabase');
  } catch { /* fall through */ }
  return (_modeCache = 'json');
}

// ─── JSON loaders ────────────────────────────────────────────────────────────
function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function jsonBundle(bundleId) {
  // Map 'UK-2026.1.1' → 'src/rules/UK-2026.1.1.json'
  // Anything else: try same convention
  const file = `src/rules/${bundleId}.json`;
  if (fs.existsSync(path.join(REPO_ROOT, file))) return readJSON(file);
  // Fallback to canonical 2026 if specific year not seeded
  return readJSON('src/rules/UK-2026.1.1.json');
}

function jsonMacroBaseline() {
  // Default macro baseline (UK 2025-26). Mirrors the seed in macro_variables.
  return {
    cpi_inflation: 0.032,
    boe_base_rate: 0.0425,
    average_mortgage_rate: 0.048,
    average_loan_rate: 0.08,
    gdp_growth: 0.008,
    wage_growth: 0.057,
    house_price_growth: 0.035,
    equity_market_return: 0.072,
    gilt_yield_10yr: 0.045,
    annuity_rate_65: 0.062,
    swr_default: 0.04,
    life_expectancy_m: 85,
    life_expectancy_f: 87,
  };
}

const UK_MACRO_HISTORY_JSON = {
  '2021/22': { cpi_inflation: 0.031, boe_base_rate: 0.001, gdp_growth: 0.076,
               wage_growth: 0.055, house_price_growth: 0.098,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 40000 },
  '2022/23': { cpi_inflation: 0.091, boe_base_rate: 0.035, gdp_growth: 0.041,
               wage_growth: 0.065, house_price_growth: 0.055,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 40000 },
  '2023/24': { cpi_inflation: 0.068, boe_base_rate: 0.0525, gdp_growth: 0.001,
               wage_growth: 0.079, house_price_growth: -0.014,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000 },
  '2024/25': { cpi_inflation: 0.034, boe_base_rate: 0.05, gdp_growth: 0.008,
               wage_growth: 0.058, house_price_growth: 0.031,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000 },
  '2025/26': { cpi_inflation: 0.032, boe_base_rate: 0.0425, gdp_growth: 0.008,
               wage_growth: 0.057, house_price_growth: 0.035,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000 },
  '2026/27': { cpi_inflation: 0.025, boe_base_rate: 0.04, gdp_growth: 0.012,
               wage_growth: 0.045, house_price_growth: 0.03,
               personal_allowance: 12570, isa_limit: 20000, pension_aa: 60000 },
};

function jsonPersona(personaId) {
  const candidates = [
    `src/rules/personas/${personaId}.json`,
    `src/rules/personas/matrix/${personaId}.json`,
    `src/rules/personas/historical/${personaId}.json`,
  ];
  for (const f of candidates) {
    if (fs.existsSync(path.join(REPO_ROOT, f))) return readJSON(f);
  }
  throw new Error(`Persona not found: ${personaId}`);
}

function jsonListPersonas(family) {
  const folders = {
    main: 'src/rules/personas',
    matrix: 'src/rules/personas/matrix',
    historical: 'src/rules/personas/historical',
  };
  const out = [];
  for (const [fam, rel] of Object.entries(folders)) {
    if (family && family !== fam) continue;
    const dir = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const id = f.replace(/\.json$/, '');
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        out.push({ persona_id: id, family: fam, name: p.name || id,
                   archetype: p.archetype, life_stage: p.life_stage });
      } catch { /* skip malformed */ }
    }
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function loadBundle(bundleId = 'UK-2026.1.1', opts = {}) {
  const mode = await resolveMode(opts);
  if (mode === 'supabase') {
    const { data, error } = await adminClient()
      .from('finio_rules_bundles')
      .select('content')
      .eq('bundle_id', bundleId)
      .eq('status', 'active')
      .limit(1)
      .single();
    if (!error && data) return data.content;
  }
  return jsonBundle(bundleId);
}

export async function loadMacroVariables(opts = {}) {
  const mode = await resolveMode(opts);
  if (mode === 'supabase') {
    const { data, error } = await adminClient()
      .from('finio_macro_variables')
      .select('variable_key, value')
      .eq('jurisdiction', 'UK');
    if (!error && data?.length) {
      return Object.fromEntries(data.map(r => [r.variable_key, Number(r.value)]));
    }
  }
  return jsonMacroBaseline();
}

export async function loadMacroVariablesForYear(taxYear, opts = {}) {
  const mode = await resolveMode(opts);
  if (mode === 'supabase') {
    const { data, error } = await adminClient()
      .from('finio_macro_history')
      .select('variable_key, value')
      .eq('jurisdiction', 'UK')
      .eq('tax_year', taxYear);
    if (!error && data?.length) {
      return Object.fromEntries(data.map(r => [r.variable_key, Number(r.value)]));
    }
  }
  return UK_MACRO_HISTORY_JSON[taxYear] || jsonMacroBaseline();
}

export async function loadPersona(personaId, opts = {}) {
  const mode = await resolveMode(opts);
  if (mode === 'supabase') {
    const { data, error } = await adminClient()
      .from('finio_personas')
      .select('profile')
      .eq('persona_id', personaId)
      .limit(1)
      .single();
    if (!error && data) return data.profile;
  }
  return jsonPersona(personaId);
}

export async function listPersonas(family = null, opts = {}) {
  const mode = await resolveMode(opts);
  if (mode === 'supabase') {
    const q = adminClient().from('finio_personas')
      .select('persona_id, family, name, archetype, life_stage');
    const { data, error } = family ? await q.eq('family', family) : await q;
    if (!error && data?.length) return data;
  }
  return jsonListPersonas(family);
}

export async function saveSnapshot(snapshot) {
  const c = adminClient();
  if (!c) return { error: 'no Supabase client (running in JSON-only mode)' };
  return c.from('finio_persona_snapshots').insert(snapshot).select().single();
}

export async function logAudit(entry) {
  const c = adminClient();
  if (!c) return { error: 'no Supabase client (running in JSON-only mode)' };
  return c.from('finio_test_audit_log').insert(entry).select().single();
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────
export async function diagnose() {
  const mode = await resolveMode();
  const c = adminClient();
  return {
    mode,
    supabaseClientPresent: !!c,
    repoRoot: REPO_ROOT,
    canonicalBundleFile: 'src/rules/UK-2026.1.1.json',
    jsonMacroHistoryYears: Object.keys(UK_MACRO_HISTORY_JSON),
  };
}
