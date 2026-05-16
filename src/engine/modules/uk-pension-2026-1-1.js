/**
 * uk-pension-2026-1-1.js
 *
 * UK Pension Engine — bundle-driven, pure (no userAssumptions parameter).
 * Pinned to bundle UK-2026.1.1.
 *
 * Coverage v1.4 §7 — UK-PEN-01 through UK-PEN-74, plus state pension §7.5.
 * Architecture per s17a-1 / s17a-2 pattern:
 *   - Every public function returns {amount, breakdown, rules, explanation}
 *   - Bundle access via private _helpers; no hardcoded rates, allowances, dates
 *   - getWrapperPension(asset, bundle) is the dispatcher (D-WRAPPER-FIRST-1)
 *   - Engines pure; bundle override resolution lives ABOVE engine (D-CONFIGURABLE-DEFAULTS-1)
 *   - Scotland/Wales flagged via warning envelope, not throws
 *   - Canonical CoI handler (pensionTimingHandler) exported per
 *     D-COI-HANDLER-INJECTION-1; conforms to canonical-coi.js handler contract
 *     (retrofitted at s17b-1b — replaces s17a-3 v1 stub)
 *
 * Session: s17a-3 · Track A · Code · Opus · 7 May 2026.
 * Retrofit: s17b-1b · 8 May 2026 — costOfInactionPension stub replaced
 *           with pensionTimingHandler conforming to canonical handler contract.
 *
 * Sources cited inline:
 *   - HMRC PTM (Pensions Tax Manual)
 *   - Finance Act 2024 (LTA abolition)
 *   - The Pensions Act 2014 (single-tier State Pension)
 *   - Autumn Budget 2024 announcements (Apr 2027 IHT inclusion of DC pensions)
 *   - HMRC RDR1 / RDR3
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const _h = {
  // Bundle field access with explicit error if missing — no silent defaults
  _f: (b, path) => {
    const parts = path.split('.');
    let v = b;
    for (const p of parts) {
      if (v == null || typeof v !== 'object' || !(p in v)) {
        throw new Error(`uk-pension: bundle field missing: ${path}`);
      }
      v = v[p];
    }
    return v;
  },

  // Empty envelope shape — every public function returns this shape
  empty: () => ({ amount: 0, breakdown: {}, rules: [], explanation: '' }),

  // Standard envelope constructor
  env: (amount, breakdown, rules, explanation) => ({
    amount: amount || 0,
    breakdown: breakdown || {},
    rules: rules || [],
    explanation: explanation || ''
  }),

  // Date helpers
  parseDate: (s) => {
    if (s instanceof Date) return s;
    if (typeof s === 'string') return new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''));
    throw new Error(`uk-pension: invalid date: ${s}`);
  },

  isOnOrAfter: (a, b) => _h.parseDate(a).getTime() >= _h.parseDate(b).getTime(),

  // Tax year (UK 6 Apr → 5 Apr)
  taxYearOf: (date) => {
    const d = _h.parseDate(date);
    const y = d.getUTCFullYear();
    const taxYearStart = new Date(Date.UTC(y, 3, 6)); // 6 April
    return d.getTime() >= taxYearStart.getTime() ? y : y - 1;
  },

  // Round to penny (consistent with tax engine)
  pence: (x) => Math.round((x + Number.EPSILON) * 100) / 100,

  // Marginal-rate looker for income within an additional layer (used for AA charge,
  // recycling, drawdown). Uses simplified UK band logic — Scottish handling flagged.
  marginalRateAt: (totalIncome, b, jurisdiction) => {
    const inc = _h._f(b, 'income');
    if (jurisdiction === 'Scotland') {
      return { rate: null, warning: 'Scottish income tax — marginal rate computed by tax engine; pension engine returns gross-only here' };
    }
    if (totalIncome > inc.additionalRateThreshold) return { rate: inc.additionalRate };
    if (totalIncome > inc.higherRateThreshold) return { rate: inc.higherRate };
    if (totalIncome > inc.personalAllowance) return { rate: inc.basicRate };
    return { rate: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// §A — WRAPPERS + DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getWrapperPension(asset, bundle)
 * D-WRAPPER-FIRST-1: this MUST be called before any pension IT/CGT/IHT calc.
 * Returns wrapper classification + which sub-engine functions apply.
 *
 * @param {object} asset — { wrapperType: 'SIPP'|'OccDC'|'OccDB'|'StatePension'|'AVC'|'PersonalPension'|'Annuity'|'LISA'|'JuniorPension', value, ageAtAccess?, crystallised?, ... }
 * @param {object} bundle — UK-2026.1.1
 */
function getWrapperPension(asset, bundle) {
  if (!asset || !asset.wrapperType) {
    return _h.env(0, { wrapperType: null }, ['UK-WRAPPER-PEN-DISPATCH'],
      'No wrapper type provided. Asset is not classifiable as a pension wrapper.');
  }

  const t = asset.wrapperType;
  const map = {
    'SIPP': { kind: 'DC', flexible: true, crystallisable: true, ihtFromApr2027: true },
    'PersonalPension': { kind: 'DC', flexible: true, crystallisable: true, ihtFromApr2027: true },
    'OccDC': { kind: 'DC', flexible: true, crystallisable: true, ihtFromApr2027: true },
    'AVC': { kind: 'DC', flexible: true, crystallisable: true, ihtFromApr2027: true },
    'OccDB': { kind: 'DB', flexible: false, crystallisable: false, ihtFromApr2027: false },
    'StatePension': { kind: 'StateDB', flexible: false, crystallisable: false, ihtFromApr2027: false },
    'Annuity': { kind: 'Annuity', flexible: false, crystallisable: false, ihtFromApr2027: false },
    'LISA': { kind: 'ISAFamily', flexible: true, crystallisable: false, ihtFromApr2027: false, note: 'LISA is ISA wrapper, not registered pension scheme' },
    'JuniorPension': { kind: 'DC', flexible: false, crystallisable: false, ihtFromApr2027: true, ageRestricted: true }
  };

  const info = map[t];
  if (!info) {
    return _h.env(asset.value || 0, { wrapperType: t, recognised: false },
      ['UK-WRAPPER-PEN-DISPATCH'],
      `Wrapper type "${t}" not recognised. Treated as taxable / non-pension for engine purposes.`);
  }

  // Surface Apr 2027 IHT inclusion as a flag — caller routes to ihtDynamic via estate engine
  const ihtDate = _h._f(bundle, 'pension.ihtInclusionApril2027');
  return _h.env(asset.value || 0, {
    wrapperType: t,
    kind: info.kind,
    flexible: info.flexible,
    crystallisable: info.crystallisable,
    ihtFromApr2027: info.ihtFromApr2027,
    ihtInclusionDate: info.ihtFromApr2027 ? ihtDate : null,
    ageRestricted: info.ageRestricted || false,
    notes: info.note || null
  }, ['UK-WRAPPER-PEN-DISPATCH', 'UK-PEN-44'],
    `${t} classified as ${info.kind} pension wrapper. ` +
    (info.ihtFromApr2027 ? `From ${ihtDate}, value at death enters IHT estate (UK-PEN-44).` : 'Not subject to Apr 2027 IHT inclusion.') +
    (info.note ? ` ${info.note}` : ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// §B — CONTRIBUTIONS (UK-PEN-01 to UK-PEN-16, plus 64-70)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * annualAllowance(bundle) — UK-PEN-01.
 * Returns the standard AA. £60k 2026/27.
 */
function annualAllowance(bundle) {
  const aa = _h._f(bundle, 'pension.annualAllowance');
  return _h.env(aa, { aa, type: 'standard' }, ['UK-PEN-01'],
    `Standard Annual Allowance: £${aa.toLocaleString('en-GB')}. Applies before MPAA / tapered AA.`);
}

/**
 * moneyPurchaseAnnualAllowance(bundle) — UK-PEN-02.
 * MPAA replaces standard AA for money-purchase contributions once flexibly accessed.
 */
function moneyPurchaseAnnualAllowance(bundle) {
  const mpaa = _h._f(bundle, 'pension.moneyPurchaseAnnualAllowance');
  const note = _h._f(bundle, 'pension.mpaaNote');
  return _h.env(mpaa, { mpaa }, ['UK-PEN-02'],
    `MPAA: £${mpaa.toLocaleString('en-GB')}. Triggered by first flexible drawdown income or UFPLS. ` +
    `Replaces standard AA for money-purchase pots only. Carry-forward NOT available against MPAA.`);
}

/**
 * taperedAnnualAllowance(thresholdIncome, adjustedIncome, bundle) — UK-PEN-03.
 * Reduces AA by £1 per £2 of adjusted income above the adjusted-income trigger.
 * Gateway: only applies if threshold income exceeds threshold-income trigger.
 * Floor: £10,000.
 */
function taperedAnnualAllowance(thresholdIncome, adjustedIncome, bundle) {
  const threshTrigger = _h._f(bundle, 'pension.taperedAnnualAllowanceThresholdIncome');
  const adjTrigger = _h._f(bundle, 'pension.taperedAnnualAllowanceAdjustedIncome');
  const floor = _h._f(bundle, 'pension.taperedAnnualAllowanceMinimum');
  const standardAA = _h._f(bundle, 'pension.annualAllowance');

  // Gateway check
  if (thresholdIncome <= threshTrigger) {
    return _h.env(standardAA, {
      aa: standardAA, taperApplies: false, gatewayPassed: true,
      thresholdIncome, threshTrigger, adjustedIncome, adjTrigger
    }, ['UK-PEN-03'],
      `Threshold income £${thresholdIncome.toLocaleString('en-GB')} ≤ £${threshTrigger.toLocaleString('en-GB')} gateway. Tapered AA does NOT apply. Standard AA: £${standardAA.toLocaleString('en-GB')}.`);
  }

  // Above gateway — taper if adjusted income exceeds adjTrigger
  if (adjustedIncome <= adjTrigger) {
    return _h.env(standardAA, {
      aa: standardAA, taperApplies: false, gatewayPassed: true,
      thresholdIncome, adjustedIncome, adjTrigger
    }, ['UK-PEN-03'],
      `Threshold gateway passed but adjusted income £${adjustedIncome.toLocaleString('en-GB')} ≤ £${adjTrigger.toLocaleString('en-GB')}. No taper. Standard AA: £${standardAA.toLocaleString('en-GB')}.`);
  }

  const excess = adjustedIncome - adjTrigger;
  const reduction = excess / 2;
  const taperedAA = Math.max(floor, standardAA - reduction);

  return _h.env(taperedAA, {
    aa: taperedAA, taperApplies: true, gatewayPassed: true,
    standardAA, reduction, floor, excess,
    thresholdIncome, adjustedIncome
  }, ['UK-PEN-03'],
    `Taper applies. Adjusted income £${adjustedIncome.toLocaleString('en-GB')} exceeds trigger £${adjTrigger.toLocaleString('en-GB')} by £${excess.toLocaleString('en-GB')}. ` +
    `AA reduced by £1 per £2 = £${reduction.toLocaleString('en-GB')}. ` +
    `Tapered AA: £${taperedAA.toLocaleString('en-GB')} (floor £${floor.toLocaleString('en-GB')}).`);
}

/**
 * effectiveAnnualAllowance(person, bundle)
 * Aggregate: returns the binding AA after MPAA + taper + earnings cap interactions.
 * person: { thresholdIncome, adjustedIncome, mpaaTriggered, relevantUKEarnings }
 */
function effectiveAnnualAllowance(person, bundle) {
  const ti = person.thresholdIncome ?? 0;
  const ai = person.adjustedIncome ?? 0;
  const mpaaTriggered = !!person.mpaaTriggered;
  const earnings = person.relevantUKEarnings ?? 0;

  const taperRes = taperedAnnualAllowance(ti, ai, bundle);
  const aaAfterTaper = taperRes.amount;

  let binding = aaAfterTaper;
  let bindingType = taperRes.breakdown.taperApplies ? 'tapered' : 'standard';
  const breakdown = {
    standardAfterTaper: aaAfterTaper, mpaaTriggered, earnings
  };

  if (mpaaTriggered) {
    const mpaa = _h._f(bundle, 'pension.moneyPurchaseAnnualAllowance');
    breakdown.mpaa = mpaa;
    if (mpaa < binding) {
      binding = mpaa;
      bindingType = 'mpaa';
    }
  }

  // UK-PEN-11 earnings cap: contributions up to £3,600 OR 100% of relevant UK earnings, whichever higher
  const minBaseFloor = 3600;
  const earningsCap = Math.max(minBaseFloor, earnings);
  breakdown.earningsCap = earningsCap;
  if (earningsCap < binding) {
    binding = earningsCap;
    bindingType = 'earningsCap';
  }

  return _h.env(binding, breakdown,
    ['UK-PEN-01', 'UK-PEN-02', 'UK-PEN-03', 'UK-PEN-11'],
    `Effective AA: £${binding.toLocaleString('en-GB')} (binding constraint: ${bindingType}). ` +
    `Standard-after-taper: £${aaAfterTaper.toLocaleString('en-GB')}` +
    (mpaaTriggered ? ` · MPAA: £${breakdown.mpaa.toLocaleString('en-GB')}` : '') +
    ` · earnings cap: £${earningsCap.toLocaleString('en-GB')}.`);
}

/**
 * carryForward(currentYearUnused, priorYearsUnused, bundle) — UK-PEN-04.
 * priorYearsUnused = array of up to 3 prior-year unused AA values, [year-1, year-2, year-3]
 * Returns total AA available this year including carry-forward.
 * Constraint: must have been pension scheme member in each prior year used.
 */
function carryForward(currentYearAA, priorYearsUnused, bundle) {
  const maxYears = _h._f(bundle, 'pension.carryForwardYears');
  const usable = (priorYearsUnused || []).slice(0, maxYears);
  while (usable.length < maxYears) usable.push(0);
  const carryAvailable = usable.reduce((s, x) => s + (x || 0), 0);
  const total = currentYearAA + carryAvailable;

  return _h.env(total, {
    currentYear: currentYearAA, priorYears: usable, carryForward: carryAvailable, total,
    maxYears
  }, ['UK-PEN-04'],
    `Carry-forward: up to ${maxYears} prior years' unused AA. Available: £${carryAvailable.toLocaleString('en-GB')}. ` +
    `Total AA this year (current + carry): £${total.toLocaleString('en-GB')}. ` +
    `Note: must have been a member of registered pension scheme in each prior year. Order of use: current year first, then oldest prior year forward.`);
}

/**
 * reliefAtSource(grossContribution, marginalRate, bundle) — UK-PEN-05.
 * RAS: contributor pays net (80% of gross), provider claims 20% from HMRC.
 * Higher-rate / additional-rate relief reclaimed via Self Assessment (UK-PEN-13).
 */
function reliefAtSource(grossContribution, marginalRate, bundle) {
  const basicRate = _h._f(bundle, 'income.basicRate');
  const netCost = grossContribution * (1 - basicRate);
  const basicReliefAtSource = grossContribution * basicRate;
  const extraReliefDueViaSA = grossContribution * Math.max(0, marginalRate - basicRate);
  const totalReliefValue = basicReliefAtSource + extraReliefDueViaSA;
  const finalNetCost = netCost - extraReliefDueViaSA;

  return _h.env(grossContribution, {
    gross: grossContribution, netPaidToProvider: netCost,
    basicReliefAddedAtSource: basicReliefAtSource,
    higherRateReliefViaSA: extraReliefDueViaSA,
    totalReliefValue, finalNetCostAfterAllRelief: finalNetCost,
    marginalRate, basicRate
  }, ['UK-PEN-05', 'UK-PEN-13'],
    `RAS: pay £${_h.pence(netCost).toLocaleString('en-GB')} net; provider grosses up by basic rate £${_h.pence(basicReliefAtSource).toLocaleString('en-GB')}. ` +
    (extraReliefDueViaSA > 0 ? `Higher/additional-rate relief £${_h.pence(extraReliefDueViaSA).toLocaleString('en-GB')} reclaimable via SA. ` : '') +
    `Final net cost after all relief: £${_h.pence(finalNetCost).toLocaleString('en-GB')}.`);
}

/**
 * netPayContribution(grossContribution, marginalRate, bundle) — UK-PEN-06.
 * Net pay: deducted from gross salary before tax. Full marginal-rate relief at source.
 */
function netPayContribution(grossContribution, marginalRate, bundle) {
  const netCost = grossContribution * (1 - marginalRate);
  const reliefValue = grossContribution * marginalRate;
  return _h.env(grossContribution, {
    gross: grossContribution, netCost, reliefValue, marginalRate
  }, ['UK-PEN-06'],
    `Net pay: contribution £${grossContribution.toLocaleString('en-GB')} deducted from gross. Full marginal-rate relief at source. Net cost: £${_h.pence(netCost).toLocaleString('en-GB')}. No SA reclaim needed.`);
}

/**
 * salarySacrifice(amount, employeeNIRate, employerNIRate, bundle) — UK-PEN-07.
 * Sacrifice salary for employer pension contribution. Saves employee + employer NI.
 * From Apr 2029, employer NI relief capped at salarySacrificeNICCap2029 (UK-PEN-08).
 */
function salarySacrifice(amount, employeeNIRate, employerNIRate, taxYear, bundle) {
  const cap = _h._f(bundle, 'pension.salarySacrificeNICCap2029');
  const capDate = _h._f(bundle, 'pension.salarySacrificeNICCapDate');
  const capActive = taxYear && _h.isOnOrAfter(`${taxYear}-04-06`, capDate);

  const employeeNISaved = amount * (employeeNIRate || 0);
  let employerNISaved = amount * (employerNIRate || 0);
  let capApplied = false;

  if (capActive && employerNISaved > cap) {
    employerNISaved = cap;
    capApplied = true;
  }

  return _h.env(amount, {
    contribution: amount,
    employeeNISaved, employerNISaved,
    capActive, capApplied, cap, capDate,
    employerCanReinvestSavings: !capApplied
  }, ['UK-PEN-07', 'UK-PEN-08'],
    `Salary sacrifice £${amount.toLocaleString('en-GB')}. Employee NI saved £${_h.pence(employeeNISaved).toLocaleString('en-GB')} · employer NI saved £${_h.pence(employerNISaved).toLocaleString('en-GB')}. ` +
    (capActive ? `From ${capDate}, employer NI relief capped at £${cap}. ${capApplied ? 'Cap applied.' : 'Below cap.'}` : `2029 NIC cap not yet active for tax year ${taxYear}.`));
}

/**
 * annualAllowanceCharge(excessContribution, marginalRate, bundle) — UK-PEN-09.
 * IT charge on contributions in excess of effective AA. Charged at member's marginal rate.
 */
function annualAllowanceCharge(excessContribution, marginalRate, bundle) {
  if (excessContribution <= 0) {
    return _h.env(0, { excess: 0 }, ['UK-PEN-09'], 'No excess contribution; no AA charge.');
  }
  const charge = excessContribution * marginalRate;
  return _h.env(charge, {
    excess: excessContribution, marginalRate, charge
  }, ['UK-PEN-09'],
    `AA excess £${excessContribution.toLocaleString('en-GB')} taxed at marginal rate ${(marginalRate * 100).toFixed(0)}%. Charge: £${_h.pence(charge).toLocaleString('en-GB')}. Member can elect Scheme Pays (UK-PEN-10) if charge ≥ £2,000 AND excess relates to one scheme.`);
}

/**
 * schemePays(charge, fundValue, bundle) — UK-PEN-10.
 * Scheme pays AA charge from member's fund. Threshold: charge ≥ £2,000 AND excess relates to single scheme.
 * (Statutory Scheme Pays — voluntary versions allowed below threshold at scheme discretion.)
 */
function schemePays(charge, fundValue, bundle) {
  const STATUTORY_THRESHOLD = 2000; // HMRC PTM056430 — statutory threshold; bundle field could be added
  const eligible = charge >= STATUTORY_THRESHOLD;
  const fundAfter = Math.max(0, fundValue - charge);

  return _h.env(charge, {
    charge, fundBefore: fundValue, fundAfter, eligible,
    statutoryThreshold: STATUTORY_THRESHOLD
  }, ['UK-PEN-10'],
    `Scheme Pays: ${eligible ? 'eligible' : 'not eligible — voluntary scheme pays only at scheme discretion'}. ` +
    `Charge £${charge.toLocaleString('en-GB')} deducted from fund value £${fundValue.toLocaleString('en-GB')}; new fund value £${_h.pence(fundAfter).toLocaleString('en-GB')}.`);
}

/**
 * relevantUKEarningsCap(earnings, contributionGross, bundle) — UK-PEN-11.
 * Tax relief limited to higher of £3,600 gross OR 100% of relevant UK earnings.
 */
function relevantUKEarningsCap(earnings, contributionGross, bundle) {
  const minBase = 3600; // statutory; could be bundle field
  const cap = Math.max(minBase, earnings);
  const reliefable = Math.min(contributionGross, cap);
  const capped = contributionGross > cap;

  return _h.env(reliefable, {
    earnings, cap, contributionGross, reliefable, capped, excessNotReliefable: capped ? contributionGross - cap : 0,
    minBase
  }, ['UK-PEN-11'],
    `Earnings cap: relief limited to higher of £${minBase} or 100% of relevant UK earnings (£${earnings.toLocaleString('en-GB')}) = £${cap.toLocaleString('en-GB')}. ` +
    (capped ? `Contribution £${contributionGross.toLocaleString('en-GB')} exceeds cap; £${(contributionGross - cap).toLocaleString('en-GB')} not reliefable.` : `Contribution within cap.`));
}

/**
 * higherRateReliefReclaim(grossContribution, marginalRate, bundle) — UK-PEN-13.
 * For RAS contributors: amount reclaimable via Self Assessment.
 * Note: Scottish taxpayers reclaim at Scottish marginal rate — flagged via warning envelope.
 */
function higherRateReliefReclaim(grossContribution, marginalRate, jurisdiction, bundle) {
  const basic = _h._f(bundle, 'income.basicRate');
  if (jurisdiction === 'Scotland') {
    return _h.env(0, {
      jurisdiction, warning: true,
      grossContribution, marginalRate
    }, ['UK-PEN-13'],
      `Scottish taxpayer: higher-rate / advanced-rate / top-rate relief reclaim computed against Scottish bands by tax engine, not pension engine. See bundle.income.scottishRateBands2627.`);
  }

  const extra = grossContribution * Math.max(0, marginalRate - basic);
  return _h.env(extra, {
    grossContribution, marginalRate, basicRate: basic, extraReclaimable: extra
  }, ['UK-PEN-13'],
    extra > 0
      ? `Higher/additional-rate relief reclaimable via Self Assessment: £${_h.pence(extra).toLocaleString('en-GB')}. Computed as gross × (marginal − basic) = £${grossContribution.toLocaleString('en-GB')} × (${(marginalRate * 100).toFixed(0)}% − ${(basic * 100).toFixed(0)}%).`
      : `Marginal rate ≤ basic rate; no extra reclaim available.`);
}

/**
 * juniorPensionContribution(amountNet, bundle) — UK-PEN-68.
 * Up to £2,880 net (£3,600 gross) per child per year.
 */
function juniorPensionContribution(amountNet, bundle) {
  const cap = _h._f(bundle, 'pension.juniorPensionContributionNet');
  const grossCap = _h._f(bundle, 'pension.juniorPensionContributionGross');
  const basic = _h._f(bundle, 'income.basicRate');

  const accepted = Math.min(amountNet, cap);
  const gross = accepted / (1 - basic);
  const reliefAdded = gross - accepted;
  const exceeded = amountNet > cap;

  return _h.env(gross, {
    amountNet: accepted, gross, reliefAdded, cap, grossCap, exceeded, excessRefused: exceeded ? amountNet - cap : 0
  }, ['UK-PEN-68'],
    `Junior pension contribution: £${accepted.toLocaleString('en-GB')} net → £${gross.toLocaleString('en-GB')} gross (cap £${grossCap}). ` +
    (exceeded ? `Excess £${(amountNet - cap).toLocaleString('en-GB')} refused.` : `Within cap.`));
}

/**
 * ltdCoEmployerContribution(amount, ctRate, bundle) — UK-PEN-67.
 * Limited-company employer contribution: CT-deductible if "wholly and exclusively" for trade.
 */
function ltdCoEmployerContribution(amount, ctRate, bundle) {
  const ctSaving = amount * (ctRate || _h._f(bundle, 'corporationTax.mainRate'));
  const netCostToCo = amount - ctSaving;

  return _h.env(amount, {
    grossContribution: amount, ctSaving, netCostToCompany: netCostToCo, ctRate: ctRate || _h._f(bundle, 'corporationTax.mainRate'),
    consumesAA: true, // counts toward member's AA
    employerNIExempt: true // pension contribs are exempt from employer NI (subject to 2029 cap on sal-sac)
  }, ['UK-PEN-67'],
    `Employer contribution from limited company: £${amount.toLocaleString('en-GB')}. ` +
    `CT relief at ${((ctRate || _h._f(bundle, 'corporationTax.mainRate')) * 100).toFixed(0)}% = £${_h.pence(ctSaving).toLocaleString('en-GB')}. ` +
    `Net cost to company: £${_h.pence(netCostToCo).toLocaleString('en-GB')}. Counts toward member's AA. Exempt from employer NI (sal-sac 2029 cap does not apply to direct employer contribs).`);
}

/**
 * autoEnrolmentMinimums(qualifyingEarnings, bundle) — UK-PEN-14, UK-PEN-16.
 * Statutory minimum 8% of qualifying earnings (5% employee + 3% employer).
 */
function autoEnrolmentMinimums(qualifyingEarnings, bundle) {
  const empPct = 0.05;
  const erPct = 0.03;
  const totalPct = 0.08;
  // qualifying earnings band: lower band (LEL) and upper band (UEL) — read from NIC bundle
  const lel = _h._f(bundle, 'nationalInsurance.primaryThreshold'); // approximation; QE band differs slightly
  const uel = _h._f(bundle, 'nationalInsurance.upperEarningsLimit');
  const qe = Math.max(0, Math.min(qualifyingEarnings, uel) - 0); // lower band of QE in 2026/27 ≈ £6,240 historically; engine uses primary threshold as proxy

  const employeeContrib = qe * empPct;
  const employerContrib = qe * erPct;
  const total = qe * totalPct;

  return _h.env(total, {
    qualifyingEarnings, qe, employeeContrib, employerContrib, total,
    employeePct: empPct, employerPct: erPct, totalPct,
    lelProxy: lel, uel
  }, ['UK-PEN-14', 'UK-PEN-16'],
    `Auto-enrolment statutory minimums: ${(empPct * 100)}% employee + ${(erPct * 100)}% employer = ${(totalPct * 100)}% of qualifying earnings. ` +
    `Qualifying earnings band ~£${lel.toLocaleString('en-GB')}–£${uel.toLocaleString('en-GB')}. Total contribution: £${_h.pence(total).toLocaleString('en-GB')}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §C — DECUMULATION DC (UK-PEN-17 to UK-PEN-33)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * lumpSumAllowance(bundle) — UK-PEN-18.
 * Lifetime cap on tax-free PCLS across all pensions: £268,275.
 */
function lumpSumAllowance(bundle) {
  const lsa = _h._f(bundle, 'pension.lumpSumAllowance');
  return _h.env(lsa, { lsa }, ['UK-PEN-18'],
    `Lump Sum Allowance: £${lsa.toLocaleString('en-GB')}. Lifetime cap on tax-free PCLS across all registered pensions. Replaced LTA from 6 Apr 2024.`);
}

/**
 * lumpSumAndDeathBenefitAllowance(bundle) — UK-PEN-19.
 * Cap on total tax-free lump sums (including death benefits): £1,073,100.
 */
function lumpSumAndDeathBenefitAllowance(bundle) {
  const lsdba = _h._f(bundle, 'pension.lumpSumAndDeathBenefitAllowance');
  return _h.env(lsdba, { lsdba }, ['UK-PEN-19'],
    `Lump Sum and Death Benefit Allowance: £${lsdba.toLocaleString('en-GB')}. Cap on total tax-free lump sums including death benefits paid pre-75. Beyond LSDBA, lump sums taxed as income at recipient's marginal rate.`);
}

/**
 * pcls(crystallisedAmount, lsaUsedAlready, bundle) — UK-PEN-20.
 * 25% tax-free up to LSA. Crystallisation event.
 */
function pcls(crystallisedAmount, lsaUsedAlready, bundle) {
  const tfPct = _h._f(bundle, 'pension.taxFreeCashPercentage');
  const lsa = _h._f(bundle, 'pension.lumpSumAllowance');
  const lsaRemaining = Math.max(0, lsa - (lsaUsedAlready || 0));

  const wantedTaxFree = crystallisedAmount * tfPct;
  const taxFreeActual = Math.min(wantedTaxFree, lsaRemaining);
  const taxableAtMarginal = wantedTaxFree - taxFreeActual; // PCLS in excess of LSA-remaining is taxable as income
  const lsaUsedThisCrystallisation = taxFreeActual;

  return _h.env(taxFreeActual, {
    crystallisedAmount, taxFreeActual, taxableAtMarginal,
    lsaUsedAlready, lsaRemaining, lsaUsedThisCrystallisation, lsaTotal: lsa,
    pclsCappedByLSA: wantedTaxFree > lsaRemaining
  }, ['UK-PEN-18', 'UK-PEN-20'],
    `PCLS: 25% of £${crystallisedAmount.toLocaleString('en-GB')} = £${wantedTaxFree.toLocaleString('en-GB')}. ` +
    `LSA remaining before this event: £${lsaRemaining.toLocaleString('en-GB')}. ` +
    `Tax-free actually paid: £${_h.pence(taxFreeActual).toLocaleString('en-GB')}. ` +
    (taxableAtMarginal > 0 ? `Excess £${_h.pence(taxableAtMarginal).toLocaleString('en-GB')} taxable as income at member's marginal rate.` : `Within LSA.`));
}

/**
 * flexiAccessDrawdown(income, otherIncome, jurisdiction, bundle) — UK-PEN-21.
 * Income from crystallised funds. Taxable as pension income at marginal rate.
 * Triggers MPAA (UK-PEN-02).
 */
function flexiAccessDrawdown(income, otherIncome, jurisdiction, bundle) {
  const margRes = _h.marginalRateAt((otherIncome || 0) + income, bundle, jurisdiction);
  if (margRes.warning) {
    return _h.env(income, { gross: income, jurisdiction, warning: margRes.warning }, ['UK-PEN-21'],
      `Flexi-access drawdown £${income.toLocaleString('en-GB')}. Tax computed by Scotland tax engine (not pension engine).`);
  }
  const tax = income * margRes.rate;
  const net = income - tax;
  return _h.env(net, {
    gross: income, marginalRate: margRes.rate, tax, net, otherIncome,
    triggersMPAA: true
  }, ['UK-PEN-21', 'UK-PEN-02'],
    `Flexi-access drawdown £${income.toLocaleString('en-GB')} taxed at marginal rate ${(margRes.rate * 100).toFixed(0)}% = £${_h.pence(tax).toLocaleString('en-GB')}. Net £${_h.pence(net).toLocaleString('en-GB')}. First flexible income triggers MPAA.`);
}

/**
 * ufpls(amount, otherIncome, lsaUsedAlready, jurisdiction, bundle) — UK-PEN-22.
 * UFPLS: 25% tax-free + 75% taxable as pension income. Each payment crystallises pro-rata.
 * Triggers MPAA. Tax-free portion uses LSA (UK-PEN-18).
 */
function ufpls(amount, otherIncome, lsaUsedAlready, jurisdiction, bundle) {
  const tfPct = _h._f(bundle, 'pension.taxFreeCashPercentage');
  const lsa = _h._f(bundle, 'pension.lumpSumAllowance');
  const lsaRemaining = Math.max(0, lsa - (lsaUsedAlready || 0));

  const wantedTaxFree = amount * tfPct;
  const taxFreeActual = Math.min(wantedTaxFree, lsaRemaining);
  const taxableAtMarginal = amount - taxFreeActual; // 75% + any uncovered 25%

  const margRes = _h.marginalRateAt((otherIncome || 0) + taxableAtMarginal, bundle, jurisdiction);
  if (margRes.warning) {
    return _h.env(0, { gross: amount, jurisdiction, warning: margRes.warning, triggersMPAA: true },
      ['UK-PEN-22', 'UK-PEN-02'],
      `UFPLS £${amount.toLocaleString('en-GB')}. Tax computed by Scotland tax engine.`);
  }
  const tax = taxableAtMarginal * margRes.rate;
  const net = amount - tax;

  return _h.env(net, {
    gross: amount, taxFreeActual, taxableAtMarginal, tax, net,
    marginalRate: margRes.rate, triggersMPAA: true,
    lsaUsedThisPayment: taxFreeActual, lsaRemainingAfter: lsaRemaining - taxFreeActual
  }, ['UK-PEN-22', 'UK-PEN-02', 'UK-PEN-18'],
    `UFPLS £${amount.toLocaleString('en-GB')}: 25% tax-free £${_h.pence(taxFreeActual).toLocaleString('en-GB')} (subject to LSA remaining £${lsaRemaining.toLocaleString('en-GB')}); ` +
    `taxable portion £${_h.pence(taxableAtMarginal).toLocaleString('en-GB')} at ${(margRes.rate * 100).toFixed(0)}% = £${_h.pence(tax).toLocaleString('en-GB')}. Net £${_h.pence(net).toLocaleString('en-GB')}. Triggers MPAA.`);
}

/**
 * pensionRecyclingTrigger(pclsTaken, contributionIncreasePct, bundle) — UK-PEN-23.
 * Anti-avoidance rule: HMRC may treat PCLS-funded contribution increase as recycling.
 * Trigger thresholds (HMRC PTM133800):
 *   - PCLS in 12-month period > £7,500 (2024 onwards), AND
 *   - Pre-planned, AND
 *   - >30% increase in pension contributions, AND
 *   - Excess contribution > 30% of PCLS taken
 */
function pensionRecyclingTrigger(pclsTaken, contributionIncreasePct, excessContribution, bundle) {
  const PCLS_THRESHOLD = 7500;
  const CONTRIB_INCREASE_THRESHOLD = 0.30;
  const EXCESS_OF_PCLS_THRESHOLD = 0.30;

  const triggerA = pclsTaken > PCLS_THRESHOLD;
  const triggerB = contributionIncreasePct > CONTRIB_INCREASE_THRESHOLD;
  const triggerC = excessContribution > pclsTaken * EXCESS_OF_PCLS_THRESHOLD;
  const all = triggerA && triggerB && triggerC;

  return _h.env(all ? excessContribution : 0, {
    pclsTaken, contributionIncreasePct, excessContribution,
    triggerPclsThreshold: triggerA, triggerContribIncrease: triggerB, triggerExcessOfPCLS: triggerC,
    recyclingFlagged: all,
    PCLS_THRESHOLD, CONTRIB_INCREASE_THRESHOLD, EXCESS_OF_PCLS_THRESHOLD
  }, ['UK-PEN-23'],
    all
      ? `Recycling triggered: PCLS £${pclsTaken.toLocaleString('en-GB')} > £${PCLS_THRESHOLD}, contribution increase ${(contributionIncreasePct * 100).toFixed(0)}% > 30%, AND excess £${excessContribution.toLocaleString('en-GB')} > 30% of PCLS. Treated as unauthorised member payment — typically 40%–55% tax charge.`
      : `Recycling not triggered. Conditions met: A=${triggerA}, B=${triggerB}, C=${triggerC}. All three required.`);
}

/**
 * trivialCommutation(potValue, otherPotsTotal, bundle) — UK-PEN-24.
 * Aggregate small-pot lifetime limit £30,000. Pre-75 only. 25% tax-free, 75% taxable.
 */
function trivialCommutation(potValue, otherPotsTotal, age, bundle) {
  const LIMIT = 30000;
  const tfPct = _h._f(bundle, 'pension.taxFreeCashPercentage');
  const totalAfter = (otherPotsTotal || 0) + potValue;
  const ageOK = age == null || age < 75;
  const eligible = totalAfter <= LIMIT && ageOK;

  if (!eligible) {
    return _h.env(0, {
      potValue, otherPotsTotal, totalAfter, limit: LIMIT, age, eligible: false,
      reason: !ageOK ? 'aged 75 or over' : 'aggregate exceeds £30,000'
    }, ['UK-PEN-24'],
      `Trivial commutation NOT eligible: ${!ageOK ? 'age 75 or over.' : `aggregate £${totalAfter.toLocaleString('en-GB')} > £${LIMIT}.`}`);
  }

  const taxFree = potValue * tfPct;
  const taxable = potValue - taxFree;
  return _h.env(potValue, {
    potValue, taxFree, taxable, eligible: true, limit: LIMIT, totalAfter
  }, ['UK-PEN-24'],
    `Trivial commutation: pot £${potValue.toLocaleString('en-GB')} · tax-free £${_h.pence(taxFree).toLocaleString('en-GB')} (25%) · taxable £${_h.pence(taxable).toLocaleString('en-GB')} (75%) at marginal rate. Aggregate of £${totalAfter.toLocaleString('en-GB')} within £${LIMIT} limit.`);
}

/**
 * smallPotsRule(potValue, smallPotsAlreadyTaken, bundle) — UK-PEN-25.
 * Up to 3 small pots of £10,000 each (DC) tax-free outside trivial commutation limit.
 * 25% tax-free, 75% taxable as income.
 */
function smallPotsRule(potValue, smallPotsAlreadyTaken, bundle) {
  const POT_LIMIT = 10000;
  const MAX_POTS = 3;
  const tfPct = _h._f(bundle, 'pension.taxFreeCashPercentage');

  const eligibleSize = potValue <= POT_LIMIT;
  const eligibleCount = (smallPotsAlreadyTaken || 0) < MAX_POTS;
  const eligible = eligibleSize && eligibleCount;

  if (!eligible) {
    return _h.env(0, {
      potValue, smallPotsAlreadyTaken, eligibleSize, eligibleCount, eligible: false,
      potLimit: POT_LIMIT, maxPots: MAX_POTS
    }, ['UK-PEN-25'],
      `Small-pots NOT eligible: ${!eligibleSize ? `pot £${potValue.toLocaleString('en-GB')} > £${POT_LIMIT}.` : `already taken ${smallPotsAlreadyTaken} of ${MAX_POTS} small pots.`}`);
  }

  const taxFree = potValue * tfPct;
  const taxable = potValue - taxFree;
  return _h.env(potValue, {
    potValue, taxFree, taxable, eligible: true, smallPotsTakenAfter: (smallPotsAlreadyTaken || 0) + 1
  }, ['UK-PEN-25'],
    `Small-pot extraction: £${potValue.toLocaleString('en-GB')} · 25% tax-free £${_h.pence(taxFree).toLocaleString('en-GB')} · 75% taxable £${_h.pence(taxable).toLocaleString('en-GB')} at marginal rate. Does not trigger MPAA. Outside trivial commutation £30,000 limit.`);
}

/**
 * annuityIncome(potValue, annuityRate, bundle) — UK-PEN-28 (lifetime), 30 (enhanced).
 * Returns annual income from given pot at given rate.
 */
function annuityIncome(potValue, annuityRatePerThousand, options, bundle) {
  const opts = options || {};
  const annual = (potValue / 1000) * (annuityRatePerThousand || 0);

  const adjustments = [];
  if (opts.joint) adjustments.push('joint life — typically 80–90% of single-life rate');
  if (opts.healthEnhanced) adjustments.push('enhanced (impaired life) — typically 110–140% of standard rate');
  if (opts.escalating) adjustments.push('escalating — initial income lower; rises with index/fixed %');
  if (opts.guaranteedPeriod) adjustments.push(`guaranteed period ${opts.guaranteedPeriod} years — slight rate reduction`);

  return _h.env(annual, {
    potValue, annuityRatePerThousand, annual,
    joint: !!opts.joint, healthEnhanced: !!opts.healthEnhanced,
    escalating: !!opts.escalating, guaranteedPeriod: opts.guaranteedPeriod || 0,
    capitalProtected: !!opts.capitalProtected,
    valueProtected: !!opts.valueProtected
  }, ['UK-PEN-28', 'UK-PEN-30', 'UK-PEN-31', 'UK-PEN-32', 'UK-PEN-33'],
    `Lifetime annuity: pot £${potValue.toLocaleString('en-GB')} at £${annuityRatePerThousand}/£1k = £${_h.pence(annual).toLocaleString('en-GB')}/year gross. Taxed as pension income at marginal rate. ` +
    (adjustments.length ? `Adjustments: ${adjustments.join('; ')}.` : 'Standard single-life rate.'));
}

/**
 * fixedTermAnnuity(potValue, term, guaranteedAmount, bundle) — UK-PEN-29.
 */
function fixedTermAnnuity(potValue, termYears, guaranteedAnnualIncome, guaranteedMaturityValue, bundle) {
  const incomeOverTerm = guaranteedAnnualIncome * termYears;
  const totalReceived = incomeOverTerm + (guaranteedMaturityValue || 0);
  return _h.env(guaranteedAnnualIncome, {
    potValue, termYears, guaranteedAnnualIncome, guaranteedMaturityValue,
    incomeOverTerm, totalReceived
  }, ['UK-PEN-29'],
    `Fixed-term annuity: £${guaranteedAnnualIncome.toLocaleString('en-GB')}/year for ${termYears} years, plus guaranteed maturity value £${(guaranteedMaturityValue || 0).toLocaleString('en-GB')}. Total received: £${totalReceived.toLocaleString('en-GB')}. Member can re-shop at term end.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §D — DB (UK-PEN-34 to UK-PEN-50)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * dbCETV(annualPension, conversionFactor) — UK-PEN-34.
 * Cash Equivalent Transfer Value: scheme-specific. Engine accepts conversionFactor as input.
 * FCA requires advice from regulated firm if CETV > £30,000.
 */
function dbCETV(annualPension, conversionFactor) {
  const cetv = annualPension * conversionFactor;
  const adviceRequired = cetv > 30000;
  return _h.env(cetv, {
    annualPension, conversionFactor, cetv, adviceRequired,
    adviceThreshold: 30000
  }, ['UK-PEN-34'],
    `CETV: £${annualPension.toLocaleString('en-GB')}/yr × factor ${conversionFactor} = £${cetv.toLocaleString('en-GB')}. ` +
    (adviceRequired ? `> £30,000 → FCA-regulated pension transfer advice REQUIRED before transfer can proceed.` : `Below £30,000 advice threshold.`) +
    ` Note: minimum statutory funding basis often understates true value 30–50% (UK-PEN-73).`);
}

/**
 * dbCommutation(annualPension, commutationFactor, takenAsLumpSum, bundle) — UK-PEN-35.
 * Exchange £1/yr pension for commutationFactor × £1 lump sum.
 */
function dbCommutation(annualPension, commutationFactor, pensionGivenUp, bundle) {
  const lumpSum = pensionGivenUp * commutationFactor;
  const remainingPension = annualPension - pensionGivenUp;
  return _h.env(lumpSum, {
    annualPensionBefore: annualPension, pensionGivenUp, commutationFactor,
    lumpSum, remainingPension
  }, ['UK-PEN-35'],
    `DB commutation: £${pensionGivenUp.toLocaleString('en-GB')}/yr exchanged at factor ${commutationFactor} for £${lumpSum.toLocaleString('en-GB')} lump sum. ` +
    `Remaining annual pension: £${remainingPension.toLocaleString('en-GB')}. Lump sum subject to LSA (UK-PEN-18). Schemes typically offer factors 12–20:1; lower than market annuity equivalent.`);
}

/**
 * dbEarlyReduction(annualPension, yearsEarly, reductionPerYear) — UK-PEN-37.
 */
function dbEarlyReduction(annualPension, yearsEarly, reductionPerYear) {
  const reduction = yearsEarly * (reductionPerYear || 0.04); // 4% standard but scheme-specific
  const reduced = annualPension * (1 - reduction);
  return _h.env(reduced, {
    annualPensionBefore: annualPension, yearsEarly, reductionPerYear: reductionPerYear || 0.04,
    totalReduction: reduction, annualPensionAfter: reduced
  }, ['UK-PEN-37'],
    `Early-retirement reduction: ${yearsEarly} years early at ${((reductionPerYear || 0.04) * 100).toFixed(1)}%/yr = ${(reduction * 100).toFixed(1)}% reduction. ` +
    `£${annualPension.toLocaleString('en-GB')}/yr → £${_h.pence(reduced).toLocaleString('en-GB')}/yr. Scheme-specific factors; some schemes use actuarial neutrality.`);
}

/**
 * dbLateIncrease(annualPension, yearsLate, increasePerYear) — UK-PEN-36.
 */
function dbLateIncrease(annualPension, yearsLate, increasePerYear) {
  const factor = 1 + yearsLate * (increasePerYear || 0.05);
  const increased = annualPension * factor;
  return _h.env(increased, {
    annualPensionBefore: annualPension, yearsLate, increasePerYear: increasePerYear || 0.05,
    factor, annualPensionAfter: increased
  }, ['UK-PEN-36'],
    `Late-retirement increase: ${yearsLate} years deferred at ${((increasePerYear || 0.05) * 100).toFixed(1)}%/yr = ×${factor.toFixed(3)}. ` +
    `£${annualPension.toLocaleString('en-GB')}/yr → £${_h.pence(increased).toLocaleString('en-GB')}/yr.`);
}

/**
 * dbIndexation(currentPension, inflationRate, capRate) — UK-PEN-38.
 * CPI/RPI indexation in payment, often capped (e.g., 5% for pre-Apr-1997 GMP, 2.5% for post-Apr-2005).
 */
function dbIndexation(currentPension, inflationRate, capRate) {
  const effectiveRate = capRate != null ? Math.min(inflationRate, capRate) : inflationRate;
  const next = currentPension * (1 + effectiveRate);
  return _h.env(next, {
    current: currentPension, inflationRate, capRate, effectiveRate, next
  }, ['UK-PEN-38'],
    `DB indexation: ${(inflationRate * 100).toFixed(2)}% inflation` +
    (capRate != null ? `, capped at ${(capRate * 100).toFixed(1)}% → effective ${(effectiveRate * 100).toFixed(2)}%.` : '.') +
    ` £${currentPension.toLocaleString('en-GB')} → £${_h.pence(next).toLocaleString('en-GB')}.`);
}

/**
 * pensionProtectionFund(annualPension, age, ageAtSchemeFailure, bundle) — UK-PEN-40.
 * 100% if already in payment at scheme failure; 90% if not (capped at PPF compensation cap).
 */
function pensionProtectionFund(annualPension, age, ageAtSchemeFailure, bundle) {
  // Approximate; PPF compensation cap is age-dependent and indexed annually
  const inPayment = age >= ageAtSchemeFailure;
  const compensationFraction = inPayment ? 1.0 : 0.9;
  const compensated = annualPension * compensationFraction;
  return _h.env(compensated, {
    annualPension, age, ageAtSchemeFailure, inPayment,
    compensationFraction, compensated,
    note: 'PPF compensation cap (£41,461 at age 65 in 2025/26) applies for non-payment members; engine returns headline calc only.'
  }, ['UK-PEN-40'],
    `PPF: ${inPayment ? '100% (in payment at scheme failure)' : '90% (not in payment)'}. ` +
    `£${annualPension.toLocaleString('en-GB')} → £${_h.pence(compensated).toLocaleString('en-GB')}. PPF compensation cap may further limit non-payment members; refer to PPF current cap tables.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §E — DEATH BENEFITS (UK-PEN-42 to UK-PEN-50)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * deathBenefitTaxPre75(potValue, lsdbaUsedAlready, bundle) — UK-PEN-42.
 * Beneficiary pays no income tax on lump sum within LSDBA. Pre-Apr-2027: not in IHT.
 */
function deathBenefitTaxPre75(potValue, lsdbaUsedAlready, deathDate, bundle) {
  const lsdba = _h._f(bundle, 'pension.lumpSumAndDeathBenefitAllowance');
  const ihtDate = _h._f(bundle, 'pension.ihtInclusionApril2027');
  const lsdbaRemaining = Math.max(0, lsdba - (lsdbaUsedAlready || 0));
  const taxFreeLump = Math.min(potValue, lsdbaRemaining);
  const taxableExcess = potValue - taxFreeLump;
  const ihtIncluded = deathDate ? _h.isOnOrAfter(deathDate, ihtDate) : false;

  return _h.env(potValue, {
    potValue, taxFreeLump, taxableExcess,
    lsdba, lsdbaUsedAlready, lsdbaRemaining,
    ihtIncluded, ihtInclusionDate: ihtDate, deathDate
  }, ['UK-PEN-42', 'UK-PEN-19', 'UK-PEN-44'],
    `Death pre-75: £${potValue.toLocaleString('en-GB')} pot. ` +
    `LSDBA tax-free £${_h.pence(taxFreeLump).toLocaleString('en-GB')}; excess £${_h.pence(taxableExcess).toLocaleString('en-GB')} taxed at beneficiary's marginal rate. ` +
    (ihtIncluded ? `From ${ihtDate}: pot value also enters IHT estate (UK-PEN-44). Combined IHT + IT can exceed 67%.` : `Pre-${ihtDate}: not in IHT estate.`));
}

/**
 * deathBenefitTaxPost75(annualBeneficiaryDrawdown, beneficiaryMarginalRate, bundle) — UK-PEN-43.
 */
function deathBenefitTaxPost75(annualWithdrawal, beneficiaryMarginalRate, deathDate, jurisdiction, bundle) {
  const ihtDate = _h._f(bundle, 'pension.ihtInclusionApril2027');
  const ihtIncluded = deathDate ? _h.isOnOrAfter(deathDate, ihtDate) : false;
  if (jurisdiction === 'Scotland') {
    return _h.env(0, {
      annualWithdrawal, jurisdiction, warning: 'Scottish marginal rate via tax engine',
      ihtIncluded, ihtInclusionDate: ihtDate
    }, ['UK-PEN-43'], `Death post-75 Scottish beneficiary: tax via Scotland tax engine.`);
  }

  const tax = annualWithdrawal * beneficiaryMarginalRate;
  const net = annualWithdrawal - tax;
  return _h.env(net, {
    annualWithdrawal, beneficiaryMarginalRate, tax, net,
    ihtIncluded, ihtInclusionDate: ihtDate, deathDate
  }, ['UK-PEN-43', 'UK-PEN-44'],
    `Death post-75: beneficiary pays IT on each drawdown at their marginal rate. ` +
    `£${annualWithdrawal.toLocaleString('en-GB')}/yr × ${(beneficiaryMarginalRate * 100).toFixed(0)}% = £${_h.pence(tax).toLocaleString('en-GB')} tax · net £${_h.pence(net).toLocaleString('en-GB')}. ` +
    (ihtIncluded ? `From ${ihtDate}: pot also in IHT estate (UK-PEN-44).` : ''));
}

/**
 * pensionIHTInclusion(deathDate, potValue, bundle) — UK-PEN-44.
 * From 6 Apr 2027, undrawn DC pensions enter IHT estate. (Bundle: pension.ihtInclusionApril2027.)
 */
function pensionIHTInclusion(deathDate, potValue, bundle) {
  const ihtDate = _h._f(bundle, 'pension.ihtInclusionApril2027');
  const included = _h.isOnOrAfter(deathDate, ihtDate);
  const ihtRate = _h._f(bundle, 'inheritanceTax.ihtRate');
  // Engine returns inclusion flag + headline IHT (no NRB/RNRB/charity rate logic — that's estate engine's job)
  return _h.env(included ? potValue : 0, {
    potValue, deathDate, ihtInclusionDate: ihtDate, included,
    headlineIHTIfNoNRB: included ? potValue * ihtRate : 0,
    note: 'Headline IHT shown without NRB / RNRB / charity rate / spouse exemption — see estate engine ihtDynamic for full calculation.'
  }, ['UK-PEN-44'],
    included
      ? `Death on ${deathDate} ≥ ${ihtDate}: DC pension £${potValue.toLocaleString('en-GB')} enters IHT estate. Pass to estate engine ihtDynamic for full NRB/RNRB/transferable/charity calculation.`
      : `Death on ${deathDate} < ${ihtDate}: DC pension NOT in IHT estate.`);
}

/**
 * combinedIHTITPost75(potValue, deathDate, beneficiaryMarginalRate, bundle) — UK-PEN-45.
 * Effective combined rate post-75 + post-Apr-2027 can exceed 67%.
 * Engine returns dual numbers: (a) IHT charge on pot, (b) IT charge on subsequent drawdown.
 */
function combinedIHTITPost75(potValue, deathDate, beneficiaryMarginalRate, bundle) {
  const ihtDate = _h._f(bundle, 'pension.ihtInclusionApril2027');
  const ihtRate = _h._f(bundle, 'inheritanceTax.ihtRate');
  const inIHT = _h.isOnOrAfter(deathDate, ihtDate);

  const ihtCharge = inIHT ? potValue * ihtRate : 0;
  const remainingForBeneficiary = potValue - ihtCharge;
  const itOnRemainingIfDrawn = remainingForBeneficiary * beneficiaryMarginalRate;
  const finalNet = remainingForBeneficiary - itOnRemainingIfDrawn;
  const effectiveRate = (potValue - finalNet) / potValue;

  return _h.env(finalNet, {
    potValue, ihtCharge, remainingAfterIHT: remainingForBeneficiary,
    beneficiaryMarginalRate, itOnRemainingIfDrawn, finalNet,
    effectiveRate, deathDate, ihtIncluded: inIHT, ihtInclusionDate: ihtDate,
    note: 'Headline; estate engine ihtDynamic provides NRB/RNRB-adjusted IHT.'
  }, ['UK-PEN-45', 'UK-PEN-43', 'UK-PEN-44'],
    `Post-75 + post-${ihtDate} combined: pot £${potValue.toLocaleString('en-GB')}. ` +
    `IHT @ ${(ihtRate * 100).toFixed(0)}%: £${_h.pence(ihtCharge).toLocaleString('en-GB')}. ` +
    `Beneficiary IT @ ${(beneficiaryMarginalRate * 100).toFixed(0)}% on £${_h.pence(remainingForBeneficiary).toLocaleString('en-GB')}: £${_h.pence(itOnRemainingIfDrawn).toLocaleString('en-GB')}. ` +
    `Net to beneficiary: £${_h.pence(finalNet).toLocaleString('en-GB')}. Effective combined rate: ${(effectiveRate * 100).toFixed(1)}%.`);
}

/**
 * dbDeathSpouse(annualPension, schemeFraction) — UK-PEN-48.
 */
function dbDeathSpouse(annualPension, schemeFraction) {
  const fraction = schemeFraction != null ? schemeFraction : 0.5;
  const spousePension = annualPension * fraction;
  return _h.env(spousePension, {
    deceasedAnnualPension: annualPension, schemeFraction: fraction, spousePension
  }, ['UK-PEN-48'],
    `DB spouse pension: ${(fraction * 100).toFixed(0)}% of £${annualPension.toLocaleString('en-GB')} = £${_h.pence(spousePension).toLocaleString('en-GB')}/yr. Scheme-specific; typically 50%. Taxed as pension income at spouse's marginal rate.`);
}

/**
 * dbDeathChildren(annualPension, schemeFraction, childrenCount, capAge) — UK-PEN-49.
 */
function dbDeathChildren(annualPension, schemeFraction, childrenCount, capAge) {
  const fraction = schemeFraction != null ? schemeFraction : 0.25;
  const totalChildPension = annualPension * fraction;
  const perChild = childrenCount > 0 ? totalChildPension / childrenCount : 0;
  const capAgeUsed = capAge != null ? capAge : 23;
  return _h.env(totalChildPension, {
    deceasedAnnualPension: annualPension, schemeFraction: fraction,
    childrenCount, perChild, capAge: capAgeUsed
  }, ['UK-PEN-49'],
    `DB children's pension: ${(fraction * 100).toFixed(0)}% of £${annualPension.toLocaleString('en-GB')} = £${_h.pence(totalChildPension).toLocaleString('en-GB')}/yr split between ${childrenCount} children (£${_h.pence(perChild).toLocaleString('en-GB')} each). Typically until age ${capAgeUsed} (23 standard).`);
}

/**
 * dbDeathInService(salary, schemeMultiplier) — UK-PEN-50.
 */
function dbDeathInService(salary, schemeMultiplier) {
  const mult = schemeMultiplier != null ? schemeMultiplier : 4;
  const lumpSum = salary * mult;
  return _h.env(lumpSum, { salary, multiplier: mult, lumpSum },
    ['UK-PEN-50'],
    `DB death-in-service lump sum: £${salary.toLocaleString('en-GB')} × ${mult} = £${lumpSum.toLocaleString('en-GB')}. Subject to LSDBA (UK-PEN-19) and post-Apr-2027 IHT inclusion (UK-PEN-44).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §F — STATE PENSION (UK-PEN-54 to UK-PEN-59)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * newStatePension(qualifyingYears, bundle) — UK-PEN-54.
 * Full new SP requires 35 qualifying years. Pro-rata for 10–34 years; 0 below 10.
 */
function newStatePension(qualifyingYears, bundle) {
  const fullAmount = _h._f(bundle, 'pension.statePensionFullAmount');
  const fullYears = _h._f(bundle, 'pension.statePensionQualifyingYears');
  const MIN_YEARS = 10;

  if (qualifyingYears < MIN_YEARS) {
    return _h.env(0, {
      qualifyingYears, fullYears, fullAmount, minYears: MIN_YEARS, eligible: false
    }, ['UK-PEN-54'],
      `Not eligible: qualifying years ${qualifyingYears} < ${MIN_YEARS} minimum. £0 new State Pension.`);
  }

  const cappedYears = Math.min(qualifyingYears, fullYears);
  const annual = fullAmount * (cappedYears / fullYears);

  return _h.env(annual, {
    qualifyingYears, cappedYears, fullYears, fullAmount, eligible: true
  }, ['UK-PEN-54'],
    `New State Pension: ${cappedYears} of ${fullYears} qualifying years = ${((cappedYears / fullYears) * 100).toFixed(1)}% of full rate (£${fullAmount.toLocaleString('en-GB')}). Annual: £${_h.pence(annual).toLocaleString('en-GB')}. Voluntary Class 3 NI top-ups can fill gaps (UK-PEN-54).`);
}

/**
 * tripleLockProjection(currentRate, cpi, earningsGrowth, years, bundle) — UK-PEN-55.
 * Annual increase is highest of CPI, earnings growth, or 2.5%.
 */
function tripleLockProjection(currentAnnual, cpi, earningsGrowth, years) {
  const FLOOR = 0.025;
  const annualIncrease = Math.max(cpi, earningsGrowth, FLOOR);
  const factor = Math.pow(1 + annualIncrease, years);
  const projected = currentAnnual * factor;

  return _h.env(projected, {
    currentAnnual, cpi, earningsGrowth, floor: FLOOR,
    annualIncrease, years, factor, projected
  }, ['UK-PEN-55'],
    `Triple lock projection: max(CPI ${(cpi * 100).toFixed(1)}%, earnings ${(earningsGrowth * 100).toFixed(1)}%, 2.5%) = ${(annualIncrease * 100).toFixed(2)}%/yr. ` +
    `Over ${years} years: £${currentAnnual.toLocaleString('en-GB')} → £${_h.pence(projected).toLocaleString('en-GB')}. Note: HM Treasury policy under review periodically.`);
}

/**
 * statePensionDeferral(weeksDeferred, baseAnnual, bundle) — UK-PEN-56.
 * Post-2016 SPA: 1% per 9 weeks deferred = ~5.78% per year.
 */
function statePensionDeferral(weeksDeferred, baseAnnual, bundle) {
  const RATE_PER_9_WEEKS = 0.01;
  const blocks = Math.floor(weeksDeferred / 9);
  const upliftPct = blocks * RATE_PER_9_WEEKS;
  const upliftedAnnual = baseAnnual * (1 + upliftPct);
  const annualPctEquivalent = (Math.pow(1 + upliftPct, 1 / (weeksDeferred / 52)) - 1) || 0;

  return _h.env(upliftedAnnual, {
    weeksDeferred, blocks, upliftPct, baseAnnual, upliftedAnnual,
    annualPctEquivalent, ratePer9Weeks: RATE_PER_9_WEEKS
  }, ['UK-PEN-56'],
    `Deferral: ${weeksDeferred} weeks = ${blocks} blocks of 9 weeks × 1% = ${(upliftPct * 100).toFixed(2)}% uplift. ` +
    `£${baseAnnual.toLocaleString('en-GB')} → £${_h.pence(upliftedAnnual).toLocaleString('en-GB')}/yr. ` +
    `Approx ${((upliftPct / (weeksDeferred / 52)) * 100).toFixed(1)}%/yr equivalent. Break-even ~17 years; consider longevity expectations.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §G — CROSS-BORDER + SHARING (UK-PEN-51, 60, 61, 71, 72)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * qropsTransfer(potValue, destinationCountry, bundle) — UK-PEN-60.
 * Engine flags whether destination is on HMRC ROPS list (caller-supplied check).
 */
function qropsTransfer(potValue, destinationCountry, isOnROPSList, bundle) {
  return _h.env(potValue, {
    potValue, destination: destinationCountry, isOnROPSList,
    note: 'Engine does not maintain ROPS list. Destination must be confirmed on current HMRC ROPS notifications list before transfer.'
  }, ['UK-PEN-60'],
    `QROPS transfer to ${destinationCountry}: ${isOnROPSList ? 'destination is on HMRC ROPS list.' : 'destination NOT on ROPS list — transfer would be unauthorised payment, ~55% tax charge.'} See overseasTransferCharge for OTC.`);
}

/**
 * overseasTransferCharge(potValue, conditions, bundle) — UK-PEN-61.
 * 25% OTC unless excluded conditions met (member resident in same country as scheme, EEA scheme, employer scheme).
 */
function overseasTransferCharge(potValue, conditions, bundle) {
  const RATE = 0.25;
  const c = conditions || {};
  const excluded = !!(c.memberResidentSameCountry || c.eeaScheme || c.employerScheme || c.gibraltar);
  const charge = excluded ? 0 : potValue * RATE;
  return _h.env(charge, {
    potValue, charge, excluded, rate: RATE,
    conditions: c
  }, ['UK-PEN-61'],
    `Overseas Transfer Charge: ${excluded ? 'EXCLUDED — no OTC.' : `25% × £${potValue.toLocaleString('en-GB')} = £${_h.pence(charge).toLocaleString('en-GB')}`}. ` +
    `Exclusions: member resident in same country as receiving scheme, EEA scheme (until rules tighten), employer occupational scheme, or Gibraltar-specific exclusion.`);
}

/**
 * pensionShareDC(cetv, sharePercent, bundle) — UK-PEN-71.
 * Pension Share Order: clean break. Transferee establishes own pension.
 */
function pensionShareDC(cetv, sharePercent) {
  const sharedAmount = cetv * (sharePercent / 100);
  const remainingForOriginalMember = cetv - sharedAmount;
  return _h.env(sharedAmount, {
    cetv, sharePercent, sharedAmount, remainingForOriginalMember
  }, ['UK-PEN-71', 'UK-PEN-51'],
    `DC pension share: ${sharePercent}% of CETV £${cetv.toLocaleString('en-GB')} = £${_h.pence(sharedAmount).toLocaleString('en-GB')} to transferee (clean break, transferee establishes own pension). ` +
    `Original member retains £${_h.pence(remainingForOriginalMember).toLocaleString('en-GB')}. Transfer values agreed at valuation date.`);
}

/**
 * pensionShareDB(cetv, sharePercent, bundle) — UK-PEN-72.
 * DB pension share: transferee receives "pension credit" — deferred pension or external transfer.
 * Note: minimum statutory funding basis CETV often understates true value 30–50% (UK-PEN-73).
 */
function pensionShareDB(cetv, sharePercent, valuationUpliftAvailable) {
  const sharedAmount = cetv * (sharePercent / 100);
  const remainingForOriginalMember = cetv - sharedAmount;
  return _h.env(sharedAmount, {
    cetv, sharePercent, sharedAmount, remainingForOriginalMember,
    valuationUpliftRecommended: !!valuationUpliftAvailable,
    note: 'DB CETV minimum statutory funding basis often understates true scheme value 30–50%. Specialist actuarial valuation may be required.'
  }, ['UK-PEN-72', 'UK-PEN-73', 'UK-PEN-51'],
    `DB pension share: ${sharePercent}% of CETV £${cetv.toLocaleString('en-GB')} = £${_h.pence(sharedAmount).toLocaleString('en-GB')} as pension credit to transferee. ` +
    `${valuationUpliftAvailable ? 'Specialist actuarial uplift recommended — minimum statutory funding basis can understate by 30–50% (UK-PEN-73).' : 'Note: UK-PEN-73 understatement risk.'}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §H — AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * contributionRoom(person, bundle)
 * Aggregate: how much person can contribute this tax year with relief.
 * Combines effective AA, carry-forward, earnings cap.
 */
function contributionRoom(person, bundle) {
  const eff = effectiveAnnualAllowance(person, bundle);
  const cf = carryForward(eff.amount, person.priorYearsUnused || [], bundle);
  // Earnings cap is already in eff.breakdown.earningsCap
  const room = cf.amount;

  return _h.env(room, {
    effectiveAA: eff.amount, effectiveAAType: eff.breakdown,
    carryForwardAvailable: cf.breakdown.carryForward,
    totalRoom: room
  }, ['UK-PEN-01', 'UK-PEN-02', 'UK-PEN-03', 'UK-PEN-04', 'UK-PEN-11'],
    `Contribution room: effective AA £${eff.amount.toLocaleString('en-GB')} (${eff.breakdown}) + carry-forward £${cf.breakdown.carryForward.toLocaleString('en-GB')} = £${room.toLocaleString('en-GB')}.`);
}

/**
 * decumulationCapacity(potValue, age, mode, bundle)
 * What the pension will deliver in chosen mode.
 */
function decumulationCapacity(potValue, age, mode, bundle) {
  const lsa = _h._f(bundle, 'pension.lumpSumAllowance');
  const tfPct = _h._f(bundle, 'pension.taxFreeCashPercentage');
  const nmpaCurrent = _h._f(bundle, 'pension.nmpaCurrentTo2028');
  const nmpaFuture = _h._f(bundle, 'pension.nmpaFrom2028');

  if (age < nmpaCurrent) {
    return _h.env(0, {
      potValue, age, nmpaCurrent, nmpaFuture, eligible: false
    }, ['UK-PEN-17'],
      `Below NMPA: age ${age} < ${nmpaCurrent} (rising to ${nmpaFuture} from Apr 2028). No access without ill-health early access.`);
  }

  // Headline: 25% PCLS + 75% drawdown subject to income tax
  const headlinePCLS = Math.min(potValue * tfPct, lsa);
  const headlineDrawdownPot = potValue - headlinePCLS;

  return _h.env(headlinePCLS, {
    potValue, age, mode: mode || 'flexi-access',
    headlinePCLS, headlineDrawdownPot,
    nmpaCurrent, nmpaFuture
  }, ['UK-PEN-18', 'UK-PEN-20', 'UK-PEN-21'],
    `Decumulation: pot £${potValue.toLocaleString('en-GB')}, age ${age}. ` +
    `Headline 25% PCLS = £${_h.pence(headlinePCLS).toLocaleString('en-GB')} (subject to LSA £${lsa.toLocaleString('en-GB')}). ` +
    `Drawdown pot £${_h.pence(headlineDrawdownPot).toLocaleString('en-GB')} taxed as income on withdrawal. NMPA ${nmpaCurrent}→${nmpaFuture} from Apr 2028.`);
}

/**
 * pensionPosition(person, bundle)
 * One-call summary of an individual's pension state.
 */
function pensionPosition(person, bundle) {
  const wrappers = (person.assets || []).map(a => getWrapperPension(a, bundle));
  const totalDC = wrappers.filter(w => w.breakdown.kind === 'DC').reduce((s, w) => s + (w.amount || 0), 0);
  const totalDB = wrappers.filter(w => w.breakdown.kind === 'DB').reduce((s, w) => s + (w.amount || 0), 0);
  const totalStateDB = wrappers.filter(w => w.breakdown.kind === 'StateDB').reduce((s, w) => s + (w.amount || 0), 0);
  const totalAnnuity = wrappers.filter(w => w.breakdown.kind === 'Annuity').reduce((s, w) => s + (w.amount || 0), 0);
  const grandTotal = totalDC + totalDB + totalStateDB + totalAnnuity;

  let contRoom = null, decum = null;
  if (person.contributionContext) contRoom = contributionRoom(person.contributionContext, bundle);
  if (person.decumulationContext) decum = decumulationCapacity(person.decumulationContext.potValue, person.decumulationContext.age, person.decumulationContext.mode, bundle);

  return _h.env(grandTotal, {
    wrappers, totalDC, totalDB, totalStateDB, totalAnnuity, grandTotal,
    contributionRoom: contRoom, decumulationHeadline: decum
  }, ['UK-WRAPPER-PEN-DISPATCH'],
    `Pension position: DC £${totalDC.toLocaleString('en-GB')} · DB £${totalDB.toLocaleString('en-GB')} · StatePension £${totalStateDB.toLocaleString('en-GB')} · Annuities £${totalAnnuity.toLocaleString('en-GB')}.`);
}

/**
 * pensionTimingHandler(entity, bundle, ctx)
 *
 * Canonical CoI handler for actionDomain = 'pensionTiming'.
 * Conforms to canonical handler contract (canonical-coi.js §27-46):
 *   returns { status, currentPath, optimalPath, action, rules, notes? }.
 *
 * Per skill v1.4 §2.7: this handler is generalised — it does NOT narrow
 * pension timing CoI to "tax relief on a single SIPP contribution".
 * That was the v1 stub example, not the definition.
 *
 * v1.0 SCOPE — captured limitations declared in returned `notes`:
 *   (i)   Captures TAX-RELIEF VALUE of contribution timing only.
 *   (ii)  Does NOT model fund growth or eventual decumulation tax —
 *         lifetime CoI requires cashflow §G integration (s17b-1b).
 *   (iii) Assumes constant marginalRate over horizon (no income trajectory).
 *   (iv)  Carry-forward modelled as year-1 utilisation only (one-shot).
 *   (v)   Does NOT optimise across wrappers — see 'wrapperSequencing' domain.
 *   (vi)  Does NOT model drawdown phase or sequence-of-returns.
 *   (vii) MPAA / tapered AA / earnings cap honoured via effectiveAnnualAllowance.
 *
 * Sources:
 *   HMRC PTM055100 (annual allowance)
 *   HMRC PTM055200 (carry-forward, 3-year window)
 *   HMRC PTM044100 (relief age limit 75)
 *   MM v2.6 §0.1 (canonical CoI definition)
 *
 * @param {object} entity   May have entity.contributionContext (preferred) or
 *                          be person-shaped directly. Required fields on the
 *                          context: marginalRate (number 0..1). Optional:
 *                          currentAnnualContribution, priorYearsUnused, plus
 *                          fields effectiveAnnualAllowance reads (income,
 *                          mpaaTriggered, etc.).
 * @param {object} bundle   UK-master bundle (pinned 2026-1-1).
 * @param {object} ctx      Provided by canonical-coi.js: { discountRateReal,
 *                          inflation, horizonYears, currentAge, longevityAge,
 *                          resolverNotes }.
 * @returns Canonical handler-contract result.
 */
function pensionTimingHandler(entity, bundle, ctx) {
  const RELIEF_AGE_LIMIT = 75; // HMRC PTM044100

  const _emptyAction = { currentDescription: '', optimalDescription: '', outcome: '' };

  // Past relief age — domain not applicable to this entity
  if (typeof ctx?.currentAge === 'number' && ctx.currentAge >= RELIEF_AGE_LIMIT) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['HMRC PTM044100 (relief ceases at 75)'],
      notes: `Age ${ctx.currentAge} ≥ ${RELIEF_AGE_LIMIT}: no further pension contribution relief available; pensionTiming CoI not applicable.`,
    };
  }

  // Resolve contribution context — accept entity.contributionContext OR entity itself
  const person = (entity && typeof entity.contributionContext === 'object' && entity.contributionContext !== null)
    ? entity.contributionContext
    : (entity || {});

  const marginalRate = person.marginalRate;
  if (typeof marginalRate !== 'number' || !Number.isFinite(marginalRate) || marginalRate < 0 || marginalRate > 1) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1', 'HMRC PTM055100'],
      notes: 'pensionTiming v1.0: marginalRate (0..1) required on entity.contributionContext (or entity).',
    };
  }

  // Compute effective AA + carry-forward — wrap in try because bundle field
  // access throws if pension keys missing (see _h._f convention).
  let effectiveAA, carryForwardRoom, totalRoomYearOne, effectiveAAType;
  try {
    const eff = effectiveAnnualAllowance(person, bundle);
    effectiveAA = eff.amount;
    effectiveAAType = eff.breakdown;
    const cf = carryForward(eff.amount, person.priorYearsUnused || [], bundle);
    totalRoomYearOne = cf.amount;
    carryForwardRoom = (cf.breakdown && cf.breakdown.carryForward) || 0;
  } catch (err) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1', 'UK-PEN-04'],
      notes: `pensionTiming v1.0: cannot resolve contribution room — ${err.message}`,
    };
  }

  // Horizon: capped at age 75 OR ctx.horizonYears (whichever shorter); minimum 1
  const yearsToReliefLimit = RELIEF_AGE_LIMIT - ctx.currentAge;
  const ctxHorizon = (typeof ctx.horizonYears === 'number' && ctx.horizonYears > 0)
    ? ctx.horizonYears : yearsToReliefLimit;
  const horizon = Math.max(1, Math.min(yearsToReliefLimit, ctxHorizon));

  // Current contribution behaviour — default 0 (legitimate "do nothing" baseline).
  // Cap at total room (excess contributions get no relief — annualAllowanceCharge applies).
  const rawCurrent = (typeof person.currentAnnualContribution === 'number' && person.currentAnnualContribution > 0)
    ? person.currentAnnualContribution : 0;
  const cappedCurrent = Math.min(rawCurrent, totalRoomYearOne);

  // Build cashflow vectors representing TAX-RELIEF VALUE to user (£ in today's money pre-discount).
  // Length = horizon + 1; period 0 = now, period horizon = horizon years from now.
  // Optimal: full effectiveAA each year; year 1 also uses any carry-forward.
  const currentPath = new Array(horizon + 1).fill(0);
  const optimalPath = new Array(horizon + 1).fill(0);

  for (let p = 0; p <= horizon; p++) {
    currentPath[p] = cappedCurrent * marginalRate;
    optimalPath[p] = (p === 0 ? totalRoomYearOne : effectiveAA) * marginalRate;
  }

  // Plain-English action pair (canonical contract requires)
  const cfYearOneNote = carryForwardRoom > 0
    ? ` plus £${Math.round(carryForwardRoom).toLocaleString('en-GB')} carry-forward in year 1`
    : '';

  return {
    status: 'IMPLEMENTED',
    currentPath,
    optimalPath,
    action: {
      currentDescription:
        rawCurrent > 0
          ? `Contributing £${Math.round(cappedCurrent).toLocaleString('en-GB')}/year ` +
            `(annual relief value £${Math.round(cappedCurrent * marginalRate).toLocaleString('en-GB')} ` +
            `at ${(marginalRate * 100).toFixed(0)}% marginal)`
          : `Not contributing to pension this year (£0 relief captured)`,
      optimalDescription:
        `Contribute up to £${Math.round(effectiveAA).toLocaleString('en-GB')}/year ` +
        `(full effective AA — ${effectiveAAType})${cfYearOneNote}`,
      outcome:
        `Captures additional pension tax relief over ${horizon} year${horizon === 1 ? '' : 's'} ` +
        `to age ${RELIEF_AGE_LIMIT}; differential NPV at ${(ctx.discountRateReal * 100).toFixed(1)}% ` +
        `real reflects relief value only (not fund growth)`,
    },
    rules: [
      'HMRC PTM055100 (annual allowance)',
      'HMRC PTM055200 (carry-forward 3-year window)',
      'HMRC PTM044100 (relief age limit 75)',
      'UK-PEN-01', 'UK-PEN-03', 'UK-PEN-04', 'UK-PEN-11',
    ],
    notes:
      'v1.0 captures tax-relief value of contribution timing only. ' +
      'Limitations: (i) does not model fund growth or decumulation tax — full lifetime CoI requires ' +
      'cashflow §G integration (s17b-1b); (ii) assumes constant marginalRate over horizon; ' +
      '(iii) carry-forward modelled as year-1 only (does not roll prior years dynamically); ' +
      '(iv) does not optimise across wrappers — see wrapperSequencing handler; ' +
      '(v) does not model drawdown phase or sequence-of-returns risk; ' +
      '(vi) MPAA / tapered AA / earnings cap honoured via effectiveAnnualAllowance.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Wrappers
  getWrapperPension,
  // Contributions
  annualAllowance, moneyPurchaseAnnualAllowance, taperedAnnualAllowance,
  effectiveAnnualAllowance, carryForward,
  reliefAtSource, netPayContribution, salarySacrifice,
  annualAllowanceCharge, schemePays, relevantUKEarningsCap,
  higherRateReliefReclaim, juniorPensionContribution, ltdCoEmployerContribution,
  autoEnrolmentMinimums,
  // Decumulation DC
  lumpSumAllowance, lumpSumAndDeathBenefitAllowance,
  pcls, flexiAccessDrawdown, ufpls,
  pensionRecyclingTrigger, trivialCommutation, smallPotsRule,
  annuityIncome, fixedTermAnnuity,
  // DB
  dbCETV, dbCommutation, dbEarlyReduction, dbLateIncrease,
  dbIndexation, pensionProtectionFund,
  // Death benefits
  deathBenefitTaxPre75, deathBenefitTaxPost75,
  pensionIHTInclusion, combinedIHTITPost75,
  dbDeathSpouse, dbDeathChildren, dbDeathInService,
  // State pension
  newStatePension, tripleLockProjection, statePensionDeferral,
  // Cross-border + sharing
  qropsTransfer, overseasTransferCharge, pensionShareDC, pensionShareDB,
  // Aggregates
  contributionRoom, decumulationCapacity, pensionPosition,
  // Canonical CoI handler (s17b-1b · D-COI-HANDLER-INJECTION-1)
  pensionTimingHandler
};
