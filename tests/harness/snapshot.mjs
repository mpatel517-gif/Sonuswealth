// ─────────────────────────────────────────────────────────────────────────────
// Snapshot generator — runs the production engine for (persona, taxYear)
// and produces a normalized engine_output object for validation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  netWorth, calcNetWorth, calcFQ, calcRisk, calcAPQ,
  financialProfile, costOfInaction, ihtDynamic,
  guardrail, investable, calcAge, incomeTax,
  monthlySurplus, fundedRatio,
} from '../../src/engine/fq-calculator.js';

import {
  loadBundle, loadMacroVariablesForYear, loadPersona,
} from '../../src/lib/data-source.js';

import { setBundle, resetBundle } from '../../src/engine/_bundle.js';
import { rippleEffect } from '../../src/engine/ripple.js';

import { evaluate as evaluateEligibility } from '../../src/engine/eligibility.js';

// Map a tax year ("2025/26") to the canonical bundle ID we'd expect in
// Supabase. If a year-matched bundle is not seeded yet, loadBundle() returns
// the canonical UK-2026.1.1 — so back-tests still run, just with current-year
// rates against historical personas (the existing behaviour). Once historical
// bundles (UK-2024.1, UK-2025.1, etc.) are seeded, this map automatically
// resolves to them.
function bundleIdFor(taxYear) {
  const start = parseInt(taxYear.split('/')[0], 10);
  if (start === 2026) return 'UK-2026.1.1';
  return `UK-${start}.1`;
}

// ─── Balance-sheet summariser ────────────────────────────────────────────────
// Mirrors fq-calculator.js netWorth() walking logic: handles both flat schema
// (assets.cash.total, assets.residence.value, ...) AND nested array schema
// (assets.property[], assets.pensions[], assets.investments[], assets.bank[]).
// Returns a per-category breakdown that sums to the engine's NW within rounding.
function summariseBalanceSheet(entity, { nw, gr, inv }) {
  const a = entity?.assets || {};
  const l = entity?.liabilities || {};

  const sumArr = (arr, key = 'value') =>
    Array.isArray(arr)
      ? arr.reduce((s, x) => s + (Number(x?.[key]) || Number(x?.amount) || Number(x?.total) || 0), 0)
      : 0;

  // Per-category flat OR nested resolution. Mirror engine helpers
  // (_propertyTotal etc) which SUM flat + nested for each category, not
  // all-or-nothing. Previously an array on any one category (e.g. a.property[])
  // wiped out flat SIPP/ISA/cash values for personas with mixed schemas (e.g.
  // Bruce Wayne — flat SIPP £850k + BTL array). See triage BUG-3.
  const flatCash      = Number(a.cash?.total)      || 0;
  const flatIsa       = Number(a.isa?.value)       || 0;
  const flatSipp      = Number(a.sipp?.total)      || 0;
  const flatResidence = Number(a.residence?.value) || 0;
  const flatPortfolio = Number(a.portfolio?.value) || 0;

  const nestedCash        = sumArr(a.bank, 'balance') + sumArr(a.bank, 'value');
  const nestedSipp        = sumArr(a.pensions, 'value') + sumArr(a.pensions, 'balance') + sumArr(a.pensions, 'cetv');
  const nestedProperty    = sumArr(a.property, 'value');
  const nestedInvestments = sumArr(a.investments, 'value');
  const nestedIsa = sumArr(
    (a.investments || []).filter(x => /isa/i.test(x?.wrapper || x?.type || '')),
    'value'
  );

  // Each category: flat + nested (canonical helper pattern). Engine's
  // _propertyTotal walks both; ihtDynamic now does too after the BUG-1 fix.
  const cash      = flatCash      + nestedCash;
  const sipp      = flatSipp      + nestedSipp;
  const property  = flatResidence + nestedProperty;
  const portfolio = flatPortfolio + nestedInvestments;
  const isa       = flatIsa       + nestedIsa;

  // Other asset classes not in core NW but worth surfacing for the validator
  const business    = Number(a.business?.value) || Number(entity?.company?.companyValue) || 0;
  const alternatives = sumArr(a.alternatives, 'value') + sumArr(a.collectibles, 'value');
  const gia = (Number(a.gia?.value) || 0)
            + sumArr((a.investments || []).filter(x => {
                const t = String(x?.wrapper || x?.type || '').toLowerCase();
                return t === 'gia' || t.includes('general-investment');
              }), 'value');
  const protection  = Number(a.protection?.cash_value) || 0;

  // Liabilities
  const mortgageOutstanding =
      Number(l.mortgage?.outstanding) || sumArr(l.mortgages, 'outstanding') || 0;
  const loans       = Number(l.loans?.total)    || sumArr(l.loans, 'outstanding') || 0;
  const credit_cards = Number(l.credit_cards?.balance) || 0;
  const other_debt  = Number(l.other?.total)    || 0;

  return {
    cash, isa, sipp, property, portfolio,
    business, alternatives, gia, protection,
    mortgage: mortgageOutstanding,
    loans, credit_cards, other_debt,
    net_worth_alias: Math.round(nw),
    guardrail: Math.round(gr),
    investable: Math.round(inv),
  };
}

// ── Asset-allocation totalisers (rough, schema-tolerant) ─────────────────────
// For DeepSeek visibility only. Approximations: split each invested wrapper into
// equity vs bond using the persona's equityPct/bondPct fields when present,
// otherwise assume 60/40 for SIPP/ISA/GIA. Property is its own bucket.
function _cashTotalQuick(e) {
  const a = e?.assets || {};
  const flat = Number(a.cash?.total) || Number(a.cash?.own) || 0;
  const nested = Array.isArray(a.bank)
    ? a.bank.reduce((s, b) => s + (Number(b.balance_gbp ?? b.balance) || 0), 0) : 0;
  return flat + nested;
}
function _propertyTotalQuick(e) {
  const a = e?.assets || {};
  const flat = (Number(a.residence?.value) || 0) * (Number(a.residence?.ownershipShare) || 1);
  const nested = Array.isArray(a.property)
    ? a.property.reduce((s, p) =>
        s + (Number(p.value_gbp ?? p.value) || 0) * (Number(p.beneficial_interest_this_individual ?? 1) || 1), 0)
    : 0;
  return flat + nested;
}
function _splitInvested(e) {
  const a = e?.assets || {};
  // Per-wrapper totals (flat + nested matching the engine helpers).
  const sippFlat   = Number(a.sipp?.total) || 0;
  const sippNested = Array.isArray(a.pensions)
    ? a.pensions.reduce((s, p) => s + (Number(p.value ?? p.balance ?? p.cetv) || 0), 0) : 0;
  const sipp = sippFlat + sippNested;

  const isaFlat = Number(a.isa?.value) || 0;
  const isaNested = Array.isArray(a.investments)
    ? a.investments.filter(i => /isa/i.test(i?.wrapper || i?.type || ''))
                   .reduce((s, i) => s + (Number(i.value ?? i.balance) || 0), 0) : 0;
  const isa = isaFlat + isaNested;

  const giaFlat = a.portfolio?.bpr ? 0 : (Number(a.portfolio?.value) || 0);
  const giaNested = Array.isArray(a.investments)
    ? a.investments.filter(i => {
        const t = String(i?.wrapper || i?.type || '').toLowerCase();
        return t === 'gia' || t.includes('general-investment');
      }).reduce((s, i) => s + (Number(i.value ?? i.balance) || 0), 0) : 0;
  const gia = giaFlat + giaNested;

  const totalInvested = sipp + isa + gia;
  // Equity/bond split: use persona's stated equityPct on sipp, else assume 60/40.
  const eqPct = Number(a.sipp?.equityPct ?? a.isa?.equityPct ?? a.portfolio?.equityPct) || 0.6;
  return {
    equity: Math.round(totalInvested * eqPct),
    bond:   Math.round(totalInvested * (1 - eqPct)),
  };
}
function _equityTotalQuick(e) { return _splitInvested(e).equity; }
function _bondTotalQuick(e)   { return _splitInvested(e).bond; }

// Year delta from 2026/27 baseline (the year personas are profiled for)
const BASELINE_YEAR = 2026;
function yearOffset(taxYear) {
  // '2021/22' → -5, '2026/27' → 0
  const start = parseInt(taxYear.split('/')[0]);
  return start - BASELINE_YEAR;
}

// Mutate persona profile to represent prior year (age backwards, deflate balances)
function ageBackwards(persona, taxYear, macroVars) {
  const offset = yearOffset(taxYear);
  if (offset === 0) return persona; // current year — use as-is

  const cloned = structuredClone(persona);

  // Age backwards
  if (cloned.dob) {
    // DOB stays the same; functions like calcAge use it. We override taxYearAsOf if present.
    cloned._taxYearAsOf = taxYear;
  } else if (typeof cloned.age === 'number') {
    cloned.age = Math.max(18, cloned.age + offset); // negative offset reduces age
  }

  // Approximate balance rollback using compounded growth
  // For each year backwards, deflate by (1 + growth) — using house prices for property,
  // CPI for cash, equity return for ISA/SIPP/portfolio
  const yearsBack = Math.abs(offset);
  const cpiFactor = Math.pow(1 + (macroVars.cpi_inflation || 0.03), yearsBack);
  const eqFactor  = Math.pow(1 + (macroVars.equity_market_return || 0.07), yearsBack);
  const houseF    = Math.pow(1 + (macroVars.house_price_growth || 0.03), yearsBack);

  if (cloned.assets) {
    if (cloned.assets.cash?.total) cloned.assets.cash.total /= cpiFactor;
    if (cloned.assets.cash?.own)   cloned.assets.cash.own   /= cpiFactor;
    if (cloned.assets.isa?.value)  cloned.assets.isa.value  /= eqFactor;
    if (cloned.assets.sipp?.total) cloned.assets.sipp.total /= eqFactor;
    if (cloned.assets.portfolio?.value) cloned.assets.portfolio.value /= eqFactor;
    if (cloned.assets.residence?.value) cloned.assets.residence.value /= houseF;
  }
  if (cloned.liabilities?.mortgage?.outstanding) {
    // Mortgage was bigger in earlier years (less paid off) — inflate slightly
    cloned.liabilities.mortgage.outstanding *= Math.pow(1.02, yearsBack);
  }

  return cloned;
}

export async function generateSnapshot(personaId, taxYear, opts = {}) {
  const persona = await loadPersona(personaId);
  const macroVars = await loadMacroVariablesForYear(taxYear);
  const bundleId = bundleIdFor(taxYear);
  const ruled = await loadBundle(bundleId);

  // Inject the year-matched bundle into the engine. Subscribed engine modules
  // (fq-calculator, tax-estate-engine, uk-tax-2026-1-1) refresh their module-
  // level constants synchronously. resetBundle() at the end restores the
  // canonical bundle so other tests / sessions aren't poisoned.
  setBundle(ruled);

  try {
  // Time-travel the persona
  const adjustedPersona = ageBackwards(persona, taxYear, macroVars);

  // Run the engine — use simple netWorth(e) which returns a number,
  // not calcNetWorth(entity) which returns an object with staleness flags
  let nw, fqResult, riskResult, apqResult, profile, coi, iht, gr, inv;
  const errors = [];

  try { nw         = netWorth(adjustedPersona); } catch (e) { errors.push(`netWorth: ${e.message}`); nw = 0; }
  try { fqResult   = calcFQ(adjustedPersona); } catch (e) { errors.push(`calcFQ: ${e.message}`); fqResult = { score: null }; }
  try { riskResult = calcRisk(adjustedPersona); } catch (e) { errors.push(`calcRisk: ${e.message}`); riskResult = { score: null }; }
  try { apqResult  = calcAPQ(adjustedPersona); } catch (e) { errors.push(`calcAPQ: ${e.message}`); apqResult = []; }
  try { profile    = financialProfile(adjustedPersona); } catch (e) { errors.push(`profile: ${e.message}`); profile = null; }
  try { coi        = costOfInaction(adjustedPersona, 'IHT'); } catch (e) { errors.push(`coi: ${e.message}`); coi = 0; }
  // SIPP enters UK estate from 2027-04-06 only. Tax years ending before that
  // date must compute IHT WITHOUT SIPP. 2026/27 includes the transition date.
  const yearStart = parseInt(taxYear.split('/')[0]);
  const includeSipp = yearStart >= 2027;
  try { iht        = ihtDynamic(adjustedPersona, includeSipp); } catch (e) { errors.push(`iht: ${e.message}`); iht = 0; }
  try { gr         = guardrail(adjustedPersona); } catch (e) { errors.push(`guardrail: ${e.message}`); gr = 0; }
  try { inv        = investable(adjustedPersona); } catch (e) { errors.push(`investable: ${e.message}`); inv = 0; }

  // Income tax + NI + cashflow computation — age-aware state pension
  let incTax = null, niEst = null, surplus = null, funded = null;
  const drawdown = adjustedPersona.drawdown
                || adjustedPersona.drawdownPlan?.targetAnnual
                || adjustedPersona.income?.drawdown
                || 0;
  const targetIncome = adjustedPersona.targetIncome ?? 0;
  const employmentInc = adjustedPersona.income?.salary || adjustedPersona.income?.employment || 0;

  // Effective drawdown resolution (founder direction 2026-05-25 — option 1 with source tag):
  //   1. Explicit drawdown number → use it
  //   2. Else, if targetIncome > employmentInc, the gap is drawn from invested assets.
  //      Applies to all life stages (was previously gated to decumulation/legacy only),
  //      because transition-stage personas can also be drawing from SIPP/ISA to top up.
  //   3. If neither, zero drawdown.
  // See triage BUG-2 + master plan §2.2.
  let effectiveDrawdown = 0;
  let drawdownSource = 'none';
  if (drawdown > 0) {
    effectiveDrawdown = drawdown;
    drawdownSource = 'explicit';
  } else if (targetIncome > employmentInc) {
    effectiveDrawdown = Math.max(0, targetIncome - employmentInc);
    drawdownSource = employmentInc > 0 ? 'topup' : 'inferred_from_target';
  }
  const grossIncome = effectiveDrawdown + employmentInc;

  // State pension by age (UK: 66 currently, 67 from 2028)
  const personaAge = adjustedPersona.age ?? 65;
  const spa = adjustedPersona.individual?.state_pension_start_age ?? 66;
  const statePension = personaAge >= spa
    ? (adjustedPersona.income?.state_pension ?? adjustedPersona.statePensionAmount ?? 12548)
    : 0;

  // Income tax must be computed on the COMBINED gross — previously this passed
  // only drawdown OR only employment, so personas with BOTH (e.g. Tony Stark:
  // £50k salary + £45k drawdown topup) had tax dramatically under-reported.
  // See triage BUG-4 (post-2026-05-25 re-run).
  try {
    const taxableEarnings = effectiveDrawdown + employmentInc;
    if (taxableEarnings > 0) {
      incTax = incomeTax(taxableEarnings, statePension, null);
    }
  } catch (e) { errors.push(`incomeTax: ${e.message}`); }

  // NI: applies to employment income only (no NI on pension), no NI past SPA
  if (employmentInc > 0 && personaAge < spa) {
    const niBase = Math.max(0, Math.min(employmentInc, 50270) - 12570);
    const niUpper = Math.max(0, employmentInc - 50270);
    niEst = Math.round(niBase * 0.08 + niUpper * 0.02);
  } else {
    niEst = 0;
  }

  try { const ms = monthlySurplus(adjustedPersona); surplus = ms != null ? Math.round(ms * 12) : null; } catch (e) { /* skip */ }
  try { const fr = fundedRatio(adjustedPersona); funded = typeof fr === 'object' ? fr.ratio ?? fr.value : fr; } catch (e) { /* skip */ }

  return {
    persona_id: personaId,
    tax_year: taxYear,
    engine_version: 'Sonuswealth-1.0',
    rules_version: ruled._meta?.version || 'UK-2026.1.1',
    snapshot_type: yearOffset(taxYear) === 0 ? 'current' : 'historical',
    net_worth: Math.round(nw),
    fq_score: fqResult?.total ?? fqResult?.score ?? null,
    fq_band: fqResult?.band?.name ?? null,
    fq_dims: fqResult?.dims ?? null,
    risk_score: riskResult?.total ?? riskResult?.score ?? null,
    risk_band: riskResult?.band?.name ?? null,
    risk_dims: riskResult?.dims ?? null,
    iht_exposure: Math.round(iht?.iht ?? 0),
    iht_breakdown: iht && typeof iht === 'object'
      ? { gross: iht.gross, nrb: iht.nrb, rnrb: iht.rnrb, taxable: iht.taxable,
          beneficiary_rate: iht.beneficiaryRate, sipp_contribution: iht.sippContribution }
      : null,
    cost_of_inaction: Math.round(coi || 0),
    balance_sheet: summariseBalanceSheet(adjustedPersona, { nw, gr, inv }),
    pl: {
      gross_income: Math.round(grossIncome + statePension),
      drawdown: Math.round(drawdown),
      effective_drawdown: Math.round(effectiveDrawdown),
      drawdown_source: drawdownSource,
      employment_income: Math.round(employmentInc),
      state_pension: Math.round(statePension),
      target_income: Math.round(targetIncome),
      income_tax: incTax != null ? Math.round(incTax) : null,
      ni: niEst,
      net_income: incTax != null ? Math.round(effectiveDrawdown + employmentInc + statePension - incTax - niEst) : null,
      pension_contributions: adjustedPersona.income?.pension_contributions
                          ?? adjustedPersona.pension?.annual_contribution
                          ?? null,
      monthly_expenditure: adjustedPersona.monthlyExpenditure ?? null,
      effective_tax_rate: (incTax != null && grossIncome > 0)
        ? +((incTax / (grossIncome + statePension)) * 100).toFixed(1)
        : null,
    },
    cashflow: {
      annual_surplus: surplus,
      surplus,
      funded_ratio: funded,
      annual_expenditure: (adjustedPersona.monthlyExpenditure != null)
        ? Math.round(adjustedPersona.monthlyExpenditure * 12)
        : null,
      sources: {
        drawdown: Math.round(effectiveDrawdown),
        employment: Math.round(employmentInc),
        state_pension: Math.round(statePension),
      },
    },
    estate: {
      iht_exposure: Math.round(iht?.iht ?? 0),
      cost_of_inaction: Math.round(coi || 0),
    },
    protection: (() => {
      const p = adjustedPersona.assets?.protection || {};
      const life = p.lifeInsurance || {};
      const ci   = p.criticalIllness || {};
      const ip   = p.incomeProtection || {};
      return {
        life_cover: Number(life.amount) || 0,
        life_in_trust: !!life.inTrust,
        critical_illness: Number(ci.amount) || 0,
        income_protection_monthly: Number(ip.monthlyBenefit) || 0,
        has_any: !!(life.exists || ci.exists || ip.exists),
      };
    })(),
    asset_allocation: (() => {
      const eq = (Number(adjustedPersona.assets?.sipp?.equityPct) || 0) +
                 (Number(adjustedPersona.assets?.isa?.equityPct) || 0);
      const cash    = _cashTotalQuick(adjustedPersona);
      const eqVal   = _equityTotalQuick(adjustedPersona);
      const bondVal = _bondTotalQuick(adjustedPersona);
      const propVal = _propertyTotalQuick(adjustedPersona);
      const total   = cash + eqVal + bondVal + propVal;
      if (total === 0) return null;
      return {
        cash_pct:     +(cash / total * 100).toFixed(1),
        equity_pct:   +(eqVal / total * 100).toFixed(1),
        bond_pct:     +(bondVal / total * 100).toFixed(1),
        property_pct: +(propVal / total * 100).toFixed(1),
        total_classified: Math.round(total),
      };
    })(),
    risk: { total: riskResult?.total, dims: riskResult?.dims, band: riskResult?.band?.name },
    fq:   { total: fqResult?.total, dims: fqResult?.dims, band: fqResult?.band?.name },
    // Couple context for spousal exemption modeling
    is_couple: !!adjustedPersona.isCouple,
    spousal_nrb_available: !!adjustedPersona.isCouple,
    effective_nrb: adjustedPersona.isCouple ? 650000 : 325000,
    effective_rnrb: adjustedPersona.isCouple ? 350000 : 175000,
    // Eligibility verdicts (Phase 8A — 15 rules)
    eligibility: (() => {
      try {
        const asOf = new Date(`${parseInt(taxYear.split('/')[0]) + 1}-04-05`);
        const verdicts = evaluateEligibility(adjustedPersona, asOf);
        return verdicts
          .filter(v => v.qualifies && v.qualifies !== 'NA')
          .map(v => ({
            rule: v.id,
            title: v.title,
            status: v.qualifies,
            grade: v.grade,
            amount: v.applicableAmount,
            reason: v.reason,
            fix: v.fixHint,
          }));
      } catch (e) { errors.push(`eligibility: ${e.message}`); return []; }
    })(),
    profile,
    apq_count: Array.isArray(apqResult) ? apqResult.length : null,
    macro_used: macroVars,
    bundle_used: bundleId,
    // Phase 2c — exercise the single ripple path on every regression run.
    // Stored as a summary (not the full block) so DeepSeek prompts don't
    // bloat. If rippleEffect crashes on any persona × year, the regression
    // catches it before the change lands in a screen.
    _ripple: (() => {
      try {
        const r = rippleEffect(adjustedPersona, null, ['all']);
        return {
          ok: r._meta?.ok === true,
          scopes: r._meta?.scopes || [],
          netWorth:        r.balance_sheet?.netWorth ?? null,
          fqScore:         r.scores?.fq?.score ?? null,
          riskScore:       r.scores?.risk?.score ?? null,
          ihtExposure:     r.iht?.iht?.iht ?? r.iht?.iht ?? null,
          monthlySurplus:  r.cashflow?.monthlySurplus ?? null,
          fundedRatio:     r.cashflow?.fundedRatio ?? null,
          incomeTax:       r.tax?.incomeTax ?? null,
          effectiveTaxRate: r.tax?.effectiveTaxRate ?? null,
          lifeGap:         r.protection?.lifeGap ?? null,
          bundleVersion:   r._meta?.bundleVersion,
          elapsedMs:       r._meta?.elapsedMs,
        };
      } catch (e) {
        errors.push(`ripple: ${e.message}`);
        return { ok: false, error: e.message };
      }
    })(),
    errors: errors.length ? errors : undefined,
    computed_at: new Date().toISOString(),
  };
  } finally {
    // Restore canonical bundle so subsequent harness runs / other consumers
    // aren't poisoned by a historical bundle swap.
    resetBundle();
  }
}
