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

import { evaluate as evaluateEligibility } from '../../src/engine/eligibility.js';

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
  const ruled = await loadBundle('UK-2026.1.1');

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
  // Effective drawdown: actual drawdown OR (targetIncome minus other income for retiring personas)
  const effectiveDrawdown = drawdown > 0
    ? drawdown
    : (targetIncome > 0 && (adjustedPersona.lifeStage >= 5 || adjustedPersona.lifeStageName?.toLowerCase().includes('decumulation') || adjustedPersona.lifeStageName?.toLowerCase().includes('legacy'))
        ? Math.max(0, targetIncome - employmentInc)
        : 0);
  const grossIncome = effectiveDrawdown + employmentInc;

  // State pension by age (UK: 66 currently, 67 from 2028)
  const personaAge = adjustedPersona.age ?? 65;
  const spa = adjustedPersona.individual?.state_pension_start_age ?? 66;
  const statePension = personaAge >= spa
    ? (adjustedPersona.income?.state_pension ?? adjustedPersona.statePensionAmount ?? 12548)
    : 0;

  try {
    if (effectiveDrawdown > 0) {
      // Pre-SPA personas have no state pension — pass 0 explicitly
      incTax = incomeTax(effectiveDrawdown, statePension, null);
    } else if (employmentInc > 0) {
      // Employment income — no state pension overlay (working age)
      incTax = incomeTax(employmentInc, 0, null);
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
    balance_sheet: {
      cash: adjustedPersona.assets?.cash?.total ?? 0,
      isa: adjustedPersona.assets?.isa?.value ?? 0,
      sipp: adjustedPersona.assets?.sipp?.total ?? 0,
      property: adjustedPersona.assets?.residence?.value ?? 0,
      portfolio: adjustedPersona.assets?.portfolio?.value ?? 0,
      mortgage: adjustedPersona.liabilities?.mortgage?.outstanding ?? 0,
      net_worth_alias: Math.round(nw),
      guardrail: Math.round(gr),
      investable: Math.round(inv),
    },
    pl: {
      gross_income: Math.round(grossIncome + statePension),
      drawdown: Math.round(drawdown),
      effective_drawdown: Math.round(effectiveDrawdown),
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
    },
    estate: {
      iht_exposure: Math.round(iht?.iht ?? 0),
      cost_of_inaction: Math.round(coi || 0),
    },
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
    errors: errors.length ? errors : undefined,
    computed_at: new Date().toISOString(),
  };
}
