/**
 * Sonuswealth Data Source — Unified read/write layer
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
  // PHASE A3: silent fallback to UK-2026.1.1 removed. The previous behaviour
  // applied 2026/27 rules to every year that lacked a bundle, hiding the fact
  // that 2021-2025 had no real coverage. Now this errors loudly so callers
  // either (a) request a year that exists, or (b) handle the gap explicitly.
  throw new Error(`[data-source.jsonBundle] No JSON bundle on disk for "${bundleId}". Expected at ${file}. See selectRuleBundle() for tax-year → bundle resolution.`);
}

// ─── Tax-year → bundle id resolution (Phase A3) ─────────────────────────────
// One row per UK tax year; bundleId points to the canonical rule file. Add
// new years here when the next Budget cycle's bundle lands. NOT YET a multi-
// jurisdiction map — Phase D adds India/Thailand/etc.
const UK_BUNDLE_BY_TAX_YEAR = {
  '2021/22': 'UK-2021.1.1',
  '2022/23': 'UK-2022.1.1',
  '2023/24': 'UK-2023.1.1',
  '2024/25': 'UK-2024.1.1',
  '2025/26': 'UK-2025.1.1',
  '2026/27': 'UK-2026.1.1',
};

/**
 * Resolve a tax year to its rule bundle, then optionally fold in any mid-year
 * legislation events whose effectiveFrom is <= asOfDate. Use this from the
 * engine instead of loadBundle() directly so date-sensitive rates resolve
 * correctly (e.g. CGT 10/20 vs 18/24 around 30 Oct 2024).
 *
 * Returns the (possibly mutated) bundle. Mutations are non-destructive: a
 * shallow clone is made before applying any event.
 *
 * @param {string} taxYear  e.g. '2024/25'
 * @param {Date|string} [asOfDate]  optional — defaults to end of tax year
 * @param {{jurisdiction?: string, source?: string}} [opts]
 */
export async function selectRuleBundle(taxYear, asOfDate = null, opts = {}) {
  const jurisdiction = opts.jurisdiction || 'UK';
  if (jurisdiction !== 'UK') {
    throw new Error(`[selectRuleBundle] jurisdiction "${jurisdiction}" not yet implemented. Phase D will add India/Thailand/Canada/Ireland/Australia.`);
  }
  const bundleId = UK_BUNDLE_BY_TAX_YEAR[taxYear];
  if (!bundleId) {
    throw new Error(`[selectRuleBundle] No bundle registered for tax year "${taxYear}". Known years: ${Object.keys(UK_BUNDLE_BY_TAX_YEAR).join(', ')}.`);
  }
  const raw = await loadBundle(bundleId, opts);
  if (!asOfDate) return raw;
  return applyMidYearEvents(raw, asOfDate);
}

/**
 * Fold any mid-year events with effectiveFrom <= asOfDate into the bundle's
 * canonical fields. Returns a NEW shallow-cloned bundle (input untouched).
 *
 * Supported event types:
 *   - rate-change      sets bundle[scope] = event.to     (or applies delta)
 *   - threshold-change sets bundle[scope] = event.to
 *
 * Path syntax: dot-separated, e.g. "capitalGains.higherRate".
 */
export function applyMidYearEvents(bundle, asOfDate) {
  const events = bundle?._midYearEvents || [];
  if (!events.length) return bundle;
  const cutoff = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`[applyMidYearEvents] asOfDate is invalid: ${asOfDate}`);
  }
  // Filter to events that have ALREADY happened by asOfDate
  const due = events.filter(e => new Date(e.effectiveFrom) <= cutoff);
  if (!due.length) return bundle;
  // Shallow clone (deep enough for the paths we touch)
  const out = JSON.parse(JSON.stringify(bundle));
  out._appliedMidYearEvents = [];
  for (const ev of due) {
    const targets = String(ev.scope || '').split('+').map(s => s.trim()).filter(Boolean);
    for (const target of targets) {
      // Resolve a dotted path to {parent, key}, supporting array-index segments
      // like `residentialRates[0]` (so events can target an array element).
      const t = resolveTargetPath(out, target);
      if (!t) continue;
      const { parent, key } = t;
      if (ev.to !== undefined) {
        if (Array.isArray(ev.to)) {
          parent[key] = ev.to;                         // full array replacement
        } else if (typeof ev.to === 'object' && ev.to !== null) {
          // Object merge — caller spells out the exact subkeys to overwrite.
          const cur = parent[key];
          parent[key] = { ...(cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}), ...ev.to };
        } else {
          parent[key] = ev.to;                         // scalar set
        }
      } else if (ev.delta !== undefined) {
        const delta = typeof ev.delta === 'string' ? parseFloat(ev.delta) : ev.delta;
        if (typeof parent[key] === 'number' && Number.isFinite(delta)) {
          parent[key] = parent[key] + delta;
        }
      }
    }
    out._appliedMidYearEvents.push({ id: ev.id, effectiveFrom: ev.effectiveFrom, scope: ev.scope });
  }
  return out;
}

/**
 * Resolve a dotted path (e.g. "property.sdlt.residentialRates[0].upTo") to the
 * {parent, key} of its final segment, creating intermediate objects/arrays as
 * needed. `name[idx]` segments expand to an array key + numeric index, so events
 * can target array elements as well as object properties.
 */
function resolveTargetPath(root, target) {
  const tokens = [];
  for (const seg of String(target).split('.')) {
    const m = seg.match(/^(.+?)\[(\d+)\]$/);
    if (m) { tokens.push(m[1]); tokens.push(Number(m[2])); }
    else tokens.push(seg);
  }
  if (!tokens.length) return null;
  let node = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const k = tokens[i];
    if (node[k] == null) node[k] = typeof tokens[i + 1] === 'number' ? [] : {};
    node = node[k];
  }
  return { parent: node, key: tokens[tokens.length - 1] };
}

// Expose the mapping so callers (manifest builder, harness) can iterate.
export function listTaxYears(jurisdiction = 'UK') {
  if (jurisdiction !== 'UK') return [];
  return Object.keys(UK_BUNDLE_BY_TAX_YEAR);
}

export function bundleIdForTaxYear(taxYear, jurisdiction = 'UK') {
  if (jurisdiction !== 'UK') return null;
  return UK_BUNDLE_BY_TAX_YEAR[taxYear] || null;
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
  // Phase A4: 13 mrT-*.json fixtures live at the top of personas/ but are a
  // distinct test population from persona-a..g. Split them out as their own
  // family so --family=mrT works in the runner without conflating with main.
  const folders = {
    main: 'src/rules/personas',
    matrix: 'src/rules/personas/matrix',
    historical: 'src/rules/personas/historical',
  };
  const isMrT = (filename) => /^mrT-/.test(filename);
  const out = [];
  for (const [fam, rel] of Object.entries(folders)) {
    const dir = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const id = f.replace(/\.json$/, '');
      // main/ folder contains BOTH persona-a..g AND mrT-*; split by filename
      const effectiveFam = (fam === 'main' && isMrT(f)) ? 'mrT' : fam;
      if (family && family !== effectiveFam) continue;
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        // mrT fixtures store name at p.name OR p.individual.name (engine-test shape)
        const name = p.name || p.individual?.name || p.fixture_purpose?.slice(0, 80) || id;
        out.push({
          persona_id: id, family: effectiveFam, name,
          archetype: p.archetype || p.fixture_anchor_archetype,
          life_stage: p.life_stage || p.lifeStageName,
        });
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
