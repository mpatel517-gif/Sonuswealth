// ─────────────────────────────────────────────────────────────────────────────
// CAELIXA / FINIO — ENGINE BUNDLE INDIRECTION LAYER
//
// Single point where the engine reads its UK rules bundle and macro variables.
// Other engine modules import from here instead of from the JSON file directly,
// so we can swap bundle/macro at runtime (boot hook from data-source.js, or
// per-call override in the test harness for historical back-tests) without
// touching call sites in the rest of the codebase.
//
// CONTRACT
//   - `getBundle()` always returns the active bundle object (never null).
//   - `TAX` is a stable object reference whose properties are re-populated on
//     setBundle(). ESM live bindings + stable ref means existing consumers
//     (`import { TAX } from '.../fq-calculator.js'`) keep working.
//   - `getMacro()` returns the live macro variables or null when not loaded.
//   - Default state at module load: bundled UK-2026.1.1 JSON, no macro.
//
// CALLERS
//   - src/engine/_helpers.js
//   - src/engine/fq-calculator.js
//   - src/engine/tax-estate-engine.js
//   - src/engine/modules/uk-tax-2026-1-1.js
//   - src/engine/modules/uk-tax.js (legacy duplicate — will be aliased)
//   - tests/harness/snapshot.mjs (setBundle override for historical years)
//   - src/App.jsx (boot hook from data-source.js)
// ─────────────────────────────────────────────────────────────────────────────

import DEFAULT_BUNDLE from '../rules/UK-2026.1.1.json' with { type: 'json' };

// ── mutable refs ───────────────────────────────────────────────────────────
let _bundle = DEFAULT_BUNDLE;
let _macro = null;
let _bundleVersion = 0; // increments on setBundle — UI hooks can subscribe
const _subscribers = new Set(); // refresh callbacks fired on setBundle

// ── stable TAX object (mutated in place; preserves import reference) ───────
export const TAX = {};

function _buildTAX(b) {
  // Mirror fq-calculator's prior TAX shape exactly so existing consumers see
  // identical values. Read both the new (nested) and legacy (flat) keys.
  const next = {
    pa:            b.pa            ?? b.income?.personalAllowance        ?? 12570,
    brl:           b.brl           ?? b.income?.basicRateLimit           ?? b.income?.basicRateBand ?? 37700,
    brt:           b.brt           ?? b.income?.basicRateThreshold       ?? 50270,
    br:            b.br            ?? b.income?.basicRate                ?? 0.20,
    hr:            b.hr            ?? b.income?.higherRate               ?? 0.40,
    ar:            b.ar            ?? b.income?.additionalRate           ?? 0.45,
    art:           b.art           ?? b.income?.additionalRateThreshold  ?? 125140,
    nrb:           b.nrb           ?? b.iht?.nilRateBand                 ?? b.inheritanceTax?.nilRateBand ?? 325000,
    rnrb:          b.rnrb          ?? b.iht?.residenceNilRateBand        ?? b.inheritanceTax?.residenceNilRateBand ?? 175000,
    rnrbTaper:     b.rnrbTaper     ?? b.iht?.rnrbTaperThreshold          ?? b.inheritanceTax?.residenceNilRateBandTaperStart ?? 2000000,
    ihtRate:       b.ihtRate       ?? b.iht?.rate                        ?? b.inheritanceTax?.ihtRate ?? 0.40,
    cgaAllowance:  b.cgaAllowance  ?? b.cgt?.annualExemption             ?? b.capitalGains?.annualExemptAmount ?? 3000,
    isaAllowance:  b.isaAllowance  ?? b.pension?.isaAllowance            ?? b.isa?.annualAllowance ?? 20000,
    pensionAA:     b.pensionAA     ?? b.pension?.annualAllowance         ?? 60000,
    swr:           b.swr           ?? b.pension?.safeWithdrawalRate      ?? 0.04,
    deadline:      new Date(b.deadline ?? b.iht?.sippsEnterEstateDate    ?? b.inheritanceTax?.pensionIHTInclusionDate ?? '2027-04-06'),
    giftExemption: b.giftAnnualExemption ?? b.iht?.giftAnnualExemption   ?? b.inheritanceTax?.giftAnnualExemption ?? 3000,
    psaBasic:      b.income?.savingsAllowanceBasicRate                   ?? 1000,
    psaHigher:     b.income?.savingsAllowanceHigherRate                  ?? 500,
    psaAdditional: b.income?.savingsAllowanceAdditionalRate              ?? 0,
    hicbcTaperWidth: b.income?.hicbcTaperWidth                           ?? 20000,
    lsa:           b.lsa           ?? 268275,
    lsdba:         b.lsdba         ?? 1073100,
    spa:           b.pension?.statePensionAge                            ?? 66,
    ver:           b.version       ?? b._meta?.version                   ?? 'UK-2026.1',
    taxYear:       b._meta?.taxYear ?? '2026/27',
    statePensionFull:      b.pension?.statePensionFullAmount
                       ?? b.nationalInsurance?.stateNewPensionFullAmount ?? 11502,
    statePensionQualYears: b.pension?.statePensionQualifyingYears
                       ?? b.nationalInsurance?.statePensionQualifyingYears ?? 35,
    scottishBands: [
      { name: 'Starter',      from: b.income?.scottishStarterBandFrom      ?? 12570,  to: b.income?.scottishStarterBandTo        ?? 14876,  rate: b.income?.scottishStarterRate      ?? 0.19 },
      { name: 'Basic',        from: b.income?.scottishBasicBandFrom        ?? 14876,  to: b.income?.scottishBasicBandTo          ?? 26561,  rate: b.income?.scottishBasicRate        ?? 0.20 },
      { name: 'Intermediate', from: b.income?.scottishIntermediateBandFrom ?? 26561,  to: b.income?.scottishIntermediateBandTo   ?? 43662,  rate: b.income?.scottishIntermediateRate ?? 0.21 },
      { name: 'Higher',       from: b.income?.scottishHigherBandFrom       ?? 43662,  to: b.income?.scottishHigherBandTo         ?? 75000,  rate: b.income?.scottishHigherRate       ?? 0.42 },
      { name: 'Advanced',     from: b.income?.scottishAdvancedBandFrom     ?? 75000,  to: b.income?.scottishAdvancedBandTo       ?? 125140, rate: b.income?.scottishAdvancedRate     ?? 0.45 },
      { name: 'Top',          from: b.income?.scottishTopBandFrom          ?? 125140, to: null,                                              rate: b.income?.scottishTopRate          ?? 0.48 },
    ],
  };

  // Replace TAX's contents in place — preserves the exported reference
  for (const k of Object.keys(TAX)) delete TAX[k];
  Object.assign(TAX, next);
}

// initial build at module load
_buildTAX(DEFAULT_BUNDLE);

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Replace the active rules bundle. Pass null/undefined to reset to default.
 * Rebuilds the exported TAX object in place.
 * @param {object|null} b
 */
export function setBundle(b) {
  _bundle = b && typeof b === 'object' ? b : DEFAULT_BUNDLE;
  _bundleVersion++;
  _buildTAX(_bundle);
  // Notify registered engine modules so they can re-derive their module-level
  // constants (PA, NRB, RNRB, etc.) against the new bundle.
  for (const fn of _subscribers) {
    try { fn(_bundle); } catch (e) { /* swallow per-subscriber errors */ }
  }
}

/**
 * Subscribe to bundle changes. The callback fires immediately with the
 * current bundle (so first-time modules don't need an extra init call),
 * and again on every subsequent setBundle().
 *
 * @param {(bundle: object) => void} fn
 * @returns {() => void} unsubscribe handle
 */
export function onBundleChange(fn) {
  if (typeof fn !== 'function') return () => {};
  _subscribers.add(fn);
  try { fn(_bundle); } catch (e) { /* swallow */ }
  return () => { _subscribers.delete(fn); };
}

/**
 * Reset to the bundled default (UK-2026.1.1). Test isolation helper.
 */
export function resetBundle() {
  setBundle(DEFAULT_BUNDLE);
}

/**
 * Active bundle object.
 * @returns {object}
 */
export function getBundle() {
  return _bundle;
}

/**
 * Live macro variables (CPIH, BoE base rate, wage growth, etc.) or null.
 * Loaded by App.jsx boot hook from data-source.loadMacroVariables().
 * @returns {object|null}
 */
export function getMacro() {
  return _macro;
}

/**
 * Replace the active macro variables. Pass null to clear.
 * @param {object|null} m
 */
export function setMacro(m) {
  _macro = m && typeof m === 'object' ? m : null;
}

/**
 * Monotonic counter that increments on each setBundle() call.
 * UI code can use this to invalidate memoised engine output without subscribing.
 * @returns {number}
 */
export function getBundleVersion() {
  return _bundleVersion;
}

/**
 * Diagnostic snapshot — handy for harness logging.
 */
export function diagnose() {
  return {
    bundleVersion: _bundleVersion,
    bundleMetaVersion: _bundle?._meta?.version ?? _bundle?.version ?? '(unknown)',
    bundleTaxYear: _bundle?._meta?.taxYear ?? TAX.taxYear,
    macroLoaded: _macro !== null,
    macroKeys: _macro ? Object.keys(_macro) : [],
  };
}
