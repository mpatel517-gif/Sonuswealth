/**
 * Caelixa · src/lib/boot-rules.js
 *
 * Browser-side boot hook: fetches the active UK rules bundle + live macro
 * variables from Supabase and injects them into the engine via _bundle.js.
 *
 * Flow:
 *   App.jsx mounts → useEffect → bootRules() → loadBundle + loadMacro →
 *   setBundle(b) + setMacro(m) → engine TAX object re-derives in place →
 *   subscribed engine modules (tax-estate-engine, fq-calculator, uk-tax-*)
 *   refresh their module-level constants → subsequent calcs use live data.
 *
 * Failure mode: if Supabase is unreachable or env vars are missing, the
 * engine keeps using the bundled UK-2026.1.1 JSON. No crashes, no flashes.
 *
 * Counterpart on the Node side: src/lib/data-source.js (test harness).
 * This file deliberately does NOT use data-source.js because that module
 * imports `fs` which doesn't exist in the browser.
 */

import { supabase, TABLES } from './supabase.js';
import { setBundle, setMacro, getBundleVersion } from '../engine/_bundle.js';

const DEFAULT_BUNDLE_ID = 'UK-2026.1.1';
const DEFAULT_JURISDICTION = 'UK';

/**
 * Fetch the active rules bundle for the given bundleId.
 * Returns the bundle content or null if Supabase is unreachable / no row.
 */
async function fetchBundle(bundleId = DEFAULT_BUNDLE_ID) {
  try {
    const { data, error } = await supabase
      .from(TABLES.RULES_BUNDLES)
      .select('content, _meta:content->_meta')
      .eq('bundle_id', bundleId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[boot-rules] bundle fetch error:', error.message);
      return null;
    }
    return data?.content || null;
  } catch (e) {
    console.warn('[boot-rules] bundle fetch threw:', e.message);
    return null;
  }
}

/**
 * Fetch live macro variables (CPIH, BoE Bank Rate, etc.) for the jurisdiction.
 * Returns a {key: value} map or null.
 */
async function fetchMacro(jurisdiction = DEFAULT_JURISDICTION) {
  try {
    const { data, error } = await supabase
      .from(TABLES.MACRO_VARIABLES)
      .select('variable_key, value')
      .eq('jurisdiction', jurisdiction);
    if (error) {
      console.warn('[boot-rules] macro fetch error:', error.message);
      return null;
    }
    if (!data || data.length === 0) return null;
    const map = {};
    for (const row of data) map[row.variable_key] = Number(row.value);
    return map;
  } catch (e) {
    console.warn('[boot-rules] macro fetch threw:', e.message);
    return null;
  }
}

/**
 * Boot the engine: fetch the active bundle + macro from Supabase and inject
 * into _bundle.js. Idempotent (safe to call multiple times) and silent on
 * failure (engine keeps using bundled JSON).
 *
 * @param {object} [opts]
 * @param {string} [opts.bundleId='UK-2026.1.1'] — which bundle to activate
 * @param {string} [opts.jurisdiction='UK'] — macro jurisdiction filter
 * @returns {Promise<{bundleLoaded: boolean, macroLoaded: boolean, version: number}>}
 */
export async function bootRules(opts = {}) {
  const bundleId = opts.bundleId || DEFAULT_BUNDLE_ID;
  const jurisdiction = opts.jurisdiction || DEFAULT_JURISDICTION;

  const [bundle, macro] = await Promise.all([
    fetchBundle(bundleId),
    fetchMacro(jurisdiction),
  ]);

  let bundleLoaded = false;
  if (bundle && typeof bundle === 'object') {
    setBundle(bundle);
    bundleLoaded = true;
  }

  let macroLoaded = false;
  if (macro && Object.keys(macro).length > 0) {
    setMacro(macro);
    macroLoaded = true;
  }

  return { bundleLoaded, macroLoaded, version: getBundleVersion() };
}
