// ─────────────────────────────────────────────────────────────────────────────
// tieout-expected.mjs — Build expected-values JSON for UI tie-out diff.
//
// For each persona × tieout-key, calls the canonical engine selector and
// emits ./tests/reports/tieout-expected.json shaped as:
//   { "<persona-id>": { "<tieout-key>": number, ... }, ... }
//
// Paired with `tieout-scraped.mjs` (B3) and `tieout-diff.mjs` (B4).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

import { netWorth, monthlySurplus } from '../src/engine/fq-calculator.js';
import { ihtExposure } from '../src/engine/tax-estate-engine.js';
import {
  pensionTotal, investmentsTotal, propertyTotal, cashTotal, alternativesTotal,
} from '../src/engine/_helpers.js';

const PERSONA_DIR = resolve('./src/rules/personas');
const OUT_FILE    = resolve('./tests/reports/tieout-expected.json');

// ── Persona discovery ──────────────────────────────────────────────────────
// Tier-1: flat persona-*.json + mrT-*.json at top level.
// Tier-2 (deferred): historical/ and matrix/ subdirs.
function listPersonas() {
  const top = readdirSync(PERSONA_DIR, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.json'))
    .map(d => d.name);
  return top.map(name => ({
    id: basename(name, '.json'),
    path: join(PERSONA_DIR, name),
  }));
}

function loadEntity(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  // Persona JSONs are stored as { entity: {...} } in some shapes, flat in others.
  // Match the same resolution used by the app loader.
  return raw.entity || raw;
}

// ── heroTotalAssets / heroTotalLiabilities mirror ──────────────────────────
// Inline walkers from MyMoney.jsx:3184-3214 — replicate exactly so tie-out
// matches the displayed value, NOT the engine selectors. Display vs engine
// drift between these two and engine pensionTotal+investmentsTotal+... is
// itself a known divergence pattern; we test display matches display logic.
function heroTotalAssets(entity) {
  const a = entity?.assets || {};
  let t = 0;
  t += +(a.sipp?.total || 0);
  t += (a.pensions || []).reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0);
  t += (a.investments || []).reduce((s, x) => s + +(x.value || x.balance_gbp || x.balance || 0), 0);
  t += +(a.isa?.total || a.isa?.value || 0);
  t += +(a.portfolio?.total || a.portfolio?.value || 0);
  t += (a.property || []).reduce((s, p) => s + +(p.value_gbp || p.value || p.market_value || 0), 0);
  t += +(a.residence?.value_gbp || a.residence?.value || a.residence?.market_value || 0);
  t += (a.business_assets || a.businessAssets || a.business || []).reduce((s, b) => s + +(b.value_gbp || b.value || 0), 0);
  t += (a.alternatives || []).reduce((s, x) => s + +(x.value_gbp || x.value || 0), 0);
  if (Array.isArray(a.cash)) t += a.cash.reduce((s, c) => s + +(c.balance || c.value || 0), 0);
  else if (a.cash?.bank?.length) t += a.cash.bank.reduce((s, c) => s + +(c.balance || c.value || 0), 0);
  else if (a.cash?.accounts) t += a.cash.accounts.reduce((s, c) => s + +(c.balance || c.value || 0), 0);
  else if (a.cash?.total) t += +a.cash.total;
  return t;
}

function heroTotalLiabilities(entity) {
  const l = entity?.liabilities || {};
  let t = 0;
  if (l.mortgage) t += +(l.mortgage.outstanding || 0);
  t += (l.otherLoans || []).reduce((s, x) => s + +(x.outstanding || x.outstanding_balance || x.balance || 0), 0);
  if (l.creditCards) t += +l.creditCards;
  return t;
}

function homeMonthlyDeficit(entity) {
  let ms;
  try { ms = monthlySurplus(entity); } catch { return 0; }
  if (!ms) return 0;
  const surplus = +ms.surplus || 0;
  const deficit = +ms.deficit || 0;
  return surplus < 0 ? -surplus : (deficit > 0 ? deficit : 0);
}

// ── Tieout key → expected value resolver ──────────────────────────────────
const RESOLVERS = {
  'home.nw':              entity => safe(() => netWorth(entity), 0),
  'home.monthly-deficit': entity => safe(() => homeMonthlyDeficit(entity), 0),
  'risk.nw':              entity => safe(() => netWorth(entity), 0),
  'timeline.nw':          entity => safe(() => netWorth(entity), 0),
  'tax.iht-today':        entity => safe(() => ihtExposure(entity)?.iht_due || 0, 0),
  'tax.beneficiary-net':  entity => safe(() => ihtExposure(entity)?.beneficiary_value || 0, 0),
  'money.nw':             entity => safe(() => netWorth(entity), 0),
  'money.assets':         entity => safe(() => heroTotalAssets(entity), 0),
  'money.liabilities':    entity => safe(() => heroTotalLiabilities(entity), 0),
  // Category subtotals — engine canonical selectors. Diff against the
  // CategoryTile displayed total catches divergence between engine readers
  // and the MyMoney driver-engine `dRows` pipeline.
  'money.cat.pensions':     entity => safe(() => pensionTotal(entity), 0),
  'money.cat.investments':  entity => safe(() => investmentsTotal(entity), 0),
  'money.cat.property':     entity => safe(() => propertyTotal(entity), 0),
  'money.cat.cash':         entity => safe(() => cashTotal(entity), 0),
  'money.cat.alternatives': entity => safe(() => alternativesTotal(entity), 0),
};

function safe(fn, fallback) {
  try { const v = fn(); return v == null ? fallback : v; }
  catch { return fallback; }
}

// ── Main ───────────────────────────────────────────────────────────────────
const personas = listPersonas();
const expected = {};

function computeRow(entity) {
  const row = {};
  for (const [key, fn] of Object.entries(RESOLVERS)) {
    row[key] = Math.round(fn(entity));
  }
  return row;
}

for (const p of personas) {
  const entity = loadEntity(p.path);
  expected[p.id] = computeRow(entity);

  // Anna Finch life-arc: persona-f has snapshots[] — emit one row per snapshot
  // keyed under the URL ID (f-22, f-32, ...) so the diff layer can pair them
  // with scrape results.
  if (Array.isArray(entity.snapshots)) {
    for (const snap of entity.snapshots) {
      if (snap?.id) expected[snap.id] = computeRow(snap);
    }
  }
}

writeFileSync(OUT_FILE, JSON.stringify(expected, null, 2));
console.log(`✓ Wrote ${Object.keys(expected).length} personas × ${Object.keys(RESOLVERS).length} tieouts → ${OUT_FILE}`);
