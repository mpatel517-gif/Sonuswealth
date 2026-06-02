// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — ENGINE BUNDLE INDIRECTION LAYER
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
    // Pension audit P2 (2026-05-26): MPAA + tapered-AA keys were missing
    // from the bundle, so the MyMoney pension drill's "Reduced cap" tile
    // always rendered "—" and `effectiveAA` fell back to literals.
    mpaa:          b.mpaa          ?? b.pension?.moneyPurchaseAnnualAllowance         ?? 10000,
    taperedAAAdj:  b.taperedAAAdj  ?? b.pension?.taperedAnnualAllowanceAdjustedIncome ?? 260000,
    taperedAAFloor:b.taperedAAFloor?? b.pension?.taperedAnnualAllowanceMinimum        ?? 10000,
    swr:           b.swr           ?? b.pension?.safeWithdrawalRate      ?? 0.04,
    deadline:      new Date(b.deadline ?? b.iht?.sippsEnterEstateDate    ?? b.inheritanceTax?.pensionIHTInclusionDate ?? '2027-04-06'),
    giftExemption: b.giftAnnualExemption ?? b.iht?.giftAnnualExemption   ?? b.inheritanceTax?.giftAnnualExemption ?? 3000,
    psaBasic:      b.income?.savingsAllowanceBasicRate                   ?? 1000,
    psaHigher:     b.income?.savingsAllowanceHigherRate                  ?? 500,
    psaAdditional: b.income?.savingsAllowanceAdditionalRate              ?? 0,
    hicbcTaperWidth: b.income?.hicbcTaperWidth                           ?? 20000,
    lsa:           b.lsa           ?? b.pension?.lumpSumAllowance ?? 268275,
    lsdba:         b.lsdba         ?? 1073100,
    spa:           b.pension?.statePensionAge                            ?? 66,
    ver:           b.version       ?? b._meta?.version                   ?? 'UK-2026.1',
    taxYear:       b._meta?.taxYear ?? '2026/27',
    statePensionFull:      b.pension?.statePensionFullAmount
                       ?? b.nationalInsurance?.stateNewPensionFullAmount ?? 12547.60,
    statePensionQualYears: b.pension?.statePensionQualifyingYears
                       ?? b.nationalInsurance?.statePensionQualifyingYears ?? 35,

    // ── v0.3 ROUTE-SPECS BUNDLE ADDITIONS (MASTER-SPEC §3.4) ─────────────────
    // 28 new TAX keys required BEFORE any v0.3 route component can build.
    // Cross-referenced against app-prototype/rules-uk.js where canonical.
    // Where rules-uk.js does not yet carry the figure, value taken from
    // Budget 2024 / Budget 2025 / Budget 2026 / Finance Act 2026 (cited inline).

    // Income tax / NIC -----------------------------------------------------
    adjustedNetIncomeCliff: b.income?.adjustedNetIncomeCliff   ?? 100000,        // ITA 2007 s35 — PA taper start
    nicClass1Main:          b.nationalInsurance?.class1MainRate ?? 0.08,         // Post-2024 NIC cut (10% → 8%)
    nicClass4Main:          b.nationalInsurance?.class4MainRate ?? 0.06,         // Post-2024 NIC cut (9% → 6%)
    employerNICRate:        b.nationalInsurance?.employerRate   ?? 0.15,         // Budget 2024 — effective April 2025
    employerNICThreshold:   b.nationalInsurance?.employerThreshold ?? 5000,      // Budget 2024 — effective April 2025
    employmentAllowance:    b.nationalInsurance?.employmentAllowance ?? 10500,   // April 2025 — employer NIC relief (was £5,000)
    hicbcFloor:             b.income?.hicbcFloor               ?? 60000,         // Spring Budget 2024
    hicbcCeiling:           b.income?.hicbcCeiling             ?? 80000,         // Spring Budget 2024 (taper width 20k)

    // Dividends — Budget 2025 (rates take effect from April 2026) -----------
    dividendAllowance:      b.income?.dividendAllowance        ?? 500,           // FA — dividend nil-rate allowance
    dividendBR:             b.income?.dividendBasicRate        ?? 0.1075,
    dividendHR:             b.income?.dividendHigherRate       ?? 0.3575,
    dividendAR:             b.income?.dividendAdditionalRate   ?? 0.3935,

    // Pension — names verified against existing bundle shape ----------------
    taperedAATIThreshold:   b.pension?.taperedAATIThreshold    ?? 200000,        // TI gate (FA 2020)
    // taperedAAAdj (260000) + taperedAAFloor (10000) + statePensionFull
    // already populated above — DO NOT duplicate.
    s455Rate:               b.corp?.s455Rate                   ?? 0.3375,        // CTA 2010 s455 — overdrawn DLA charge (from April 2022)

    // IHT / Estate -------------------------------------------------------
    bprCombinedCap:         b.iht?.bprCombinedCap              ?? 2500000,       // FA 2026 — combined BPR+APR cap per individual
    aimBPRRate:             b.iht?.aimBPRRate                  ?? 0.50,          // FA 2026 — AIM BPR rate
    petTaperByYear:         b.iht?.petTaperByYear              ?? [0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1.0], // IHTA 1984 s7 PET taper 0-7 yrs
    // Gift exemptions split — v0.3 BLOCK-3 fix (was fabricated `srsAllowance`)
    smallGiftsExemption:    b.iht?.smallGiftsExemption         ?? 250,           // IHTA 1984 s20
    weddingGiftToChild:     b.iht?.weddingGiftToChild          ?? 5000,          // IHTA 1984 s22
    weddingGiftToGrandchild:b.iht?.weddingGiftToGrandchild     ?? 2500,          // IHTA 1984 s22
    weddingGiftOther:       b.iht?.weddingGiftOther            ?? 1000,          // IHTA 1984 s22
    annualGiftExemption:    b.iht?.annualGiftExemption ?? b.iht?.giftAnnualExemption ?? b.inheritanceTax?.giftAnnualExemption ?? 3000, // IHTA 1984 s19
    normalExpenditureFromIncome: b.iht?.normalExpenditureFromIncome ?? true,     // IHTA 1984 s21 flag

    // CGT / Property / VCT -------------------------------------------------
    cgtBasic:               b.cgt?.basicRate                   ?? 0.18,          // Post-Autumn Budget 2024
    cgtHigher:              b.cgt?.higherRate                  ?? 0.24,          // Post-Autumn Budget 2024
    badrRate:               b.cgt?.badrRate                    ?? 0.18,          // FA 2026 — Business Asset Disposal Relief (was 14% pre-2026)
    sdltAdditionalProperty: b.sdlt?.additionalPropertySurcharge ?? 0.05,         // FA 2024 — from 31 Oct 2024 (+5%, was +3%)
    vctITRate:              b.vct?.incomeTaxReliefRate ?? b.taxEfficientInvestments?.vct?.incomeTaxRelief ?? 0.20,  // FA 2026 — VCT IT relief (was 30% pre-April 2026)
    eisITRate:              b.taxEfficientInvestments?.eis?.incomeTaxRelief  ?? 0.30,  // ITA 2007 — EIS IT relief (unchanged by FA 2026)
    seisITRate:             b.taxEfficientInvestments?.seis?.incomeTaxRelief ?? 0.50,  // ITA 2007 — SEIS IT relief
    corpMainRate:           b.corporationTax?.mainRate         ?? 0.25,          // FA 2021 — CT main rate (profits ≥ £250k)
    corpSmallRate:          b.corporationTax?.smallProfitsRate ?? 0.19,          // FA 2021 — CT small-profits rate (≤ £50k)
    // Normal Minimum Pension Age: 55 until 6 Apr 2028, then 57 (FA 2021). Date-aware
    // so the pension draw-order flag is correct without a per-call-site literal.
    nmpa:                   (new Date() < new Date('2028-04-06')
                              ? (b.pension?.nmpaCurrentTo2028 ?? 55)
                              : (b.pension?.nmpaFrom2028 ?? 57)),

    // Allowance freeze -----------------------------------------------------
    paFreezeUntil:          b.income?.paFreezeUntil ?? b._meta?.paFreezeUntil ?? '2031-04-05', // Autumn Budget 2025 — freeze to end of 2030/31 tax year
    // ── END v0.3 ROUTE-SPECS BUNDLE ADDITIONS ─────────────────────────────
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
