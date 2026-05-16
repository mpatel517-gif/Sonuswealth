/**
 * uk-residency-2026-1-1.js
 *
 * UK Residency, Domicile, FIG and TRF Engine — bundle-driven, pure.
 * Pinned to bundle UK-2026.1.1 (filename: UK-master-2026.1.1.json per D-BUNDLE-FILENAME-1).
 *
 * Coverage v1.4 §10 — UK-RES-01 through UK-RES-30, plus §10.1 FIG and §10.2 TRF.
 * Architecture per s17a-1 / s17a-2 / s17a-3 pattern:
 *   - Every public function returns {amount, breakdown, rules, explanation}
 *     (where 'amount' may be 0 / boolean / classification depending on fn — see each)
 *   - Bundle access via private _helpers; no hardcoded thresholds
 *   - Engines pure; bundle override resolution above engine layer
 *   - Long-term resident IHT test (UK-RES-11) exposes longTermResidentStatus(years, bundle)
 *     as required by handover §A.4 — used downstream by uk-estate ihtDynamic
 *
 * Session: s17a-3 · Track A · Code · Opus · 7 May 2026.
 *
 * Sources cited inline:
 *   - HMRC RDR1 (Domicile and remittance basis manual)
 *   - HMRC RDR3 (Statutory Residence Test guidance)
 *   - Schedule 45 Finance Act 2013 (SRT and split-year statutory framework)
 *   - Finance Act 2024 / Spring Budget 2024 announcements (FIG, TRF, long-term resident replacing deemed domicile)
 *   - HMRC IHTM (Inheritance Tax Manual) on long-term resident test from 6 Apr 2025
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const _h = {
  _f: (b, path) => {
    const parts = path.split('.');
    let v = b;
    for (const p of parts) {
      if (v == null || typeof v !== 'object' || !(p in v)) {
        throw new Error(`uk-residency: bundle field missing: ${path}`);
      }
      v = v[p];
    }
    return v;
  },
  env: (amount, breakdown, rules, explanation) => ({
    amount: amount,
    breakdown: breakdown || {},
    rules: rules || [],
    explanation: explanation || ''
  }),
  parseDate: (s) => {
    if (s instanceof Date) return s;
    if (typeof s === 'string') return new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''));
    throw new Error(`uk-residency: invalid date: ${s}`);
  },
  isOnOrAfter: (a, b) => _h.parseDate(a).getTime() >= _h.parseDate(b).getTime(),
  taxYearOf: (date) => {
    const d = _h.parseDate(date);
    const y = d.getUTCFullYear();
    const taxYearStart = new Date(Date.UTC(y, 3, 6));
    return d.getTime() >= taxYearStart.getTime() ? y : y - 1;
  },
  // Returns 'leaver' if UK resident in any of last 3 tax years; else 'arriver'
  classifyMover: (priorYearsResident) => {
    if (!Array.isArray(priorYearsResident)) return 'unknown';
    return priorYearsResident.slice(-3).some(Boolean) ? 'leaver' : 'arriver';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// §B — SRT INDIVIDUAL TESTS (UK-RES-03, 04)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * automaticOverseasTest1(person, bundle) — UK-RES-04 test 1.
 * Previously UK resident: < 16 UK days → automatic non-resident.
 */
function automaticOverseasTest1(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticOverseasTests.test1_previouslyResidentLowDays');
  const ukDays = person.ukDays || 0;
  const priorYears = person.priorYearsResident || [];
  const wasResidentLast3 = _h.classifyMover(priorYears) === 'leaver';
  const passes = wasResidentLast3 && ukDays <= cfg.ukDaysCeiling;

  return _h.env(passes, {
    test: 'automaticOverseasTest1', applies: wasResidentLast3, passes,
    ukDays, ceiling: cfg.ukDaysCeiling, wasResidentLast3
  }, ['UK-RES-04'],
    `Auto overseas test 1: ${wasResidentLast3 ? 'applies (was UK resident in last 3 yrs)' : 'does not apply (no UK residence in last 3 yrs — see test 2)'}. ` +
    `UK days ${ukDays} ${ukDays <= cfg.ukDaysCeiling ? '≤' : '>'} ${cfg.ukDaysCeiling} → ${passes ? 'PASSES (auto non-resident)' : 'fails'}.`);
}

/**
 * automaticOverseasTest2(person, bundle) — UK-RES-04 test 2.
 * Not previously UK resident: < 46 UK days → automatic non-resident.
 */
function automaticOverseasTest2(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticOverseasTests.test2_notPreviouslyResidentLowDays');
  const ukDays = person.ukDays || 0;
  const priorYears = person.priorYearsResident || [];
  const wasNotResidentLast3 = _h.classifyMover(priorYears) === 'arriver';
  const passes = wasNotResidentLast3 && ukDays <= cfg.ukDaysCeiling;

  return _h.env(passes, {
    test: 'automaticOverseasTest2', applies: wasNotResidentLast3, passes,
    ukDays, ceiling: cfg.ukDaysCeiling
  }, ['UK-RES-04'],
    `Auto overseas test 2: ${wasNotResidentLast3 ? 'applies (no UK residence in last 3 yrs)' : 'does not apply'}. ` +
    `UK days ${ukDays} ${ukDays <= cfg.ukDaysCeiling ? '≤' : '>'} ${cfg.ukDaysCeiling} → ${passes ? 'PASSES (auto non-resident)' : 'fails'}.`);
}

/**
 * automaticOverseasTest3(person, bundle) — UK-RES-04 test 3.
 * Full-time work overseas: avg 35+ hrs/week overseas, < 91 UK days, < 31 UK workdays.
 */
function automaticOverseasTest3(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticOverseasTests.test3_fullTimeWorkOverseas');
  const hours = person.avgHoursPerWeekOverseas || 0;
  const ukDays = person.ukDays || 0;
  const ukWorkdays = person.ukWorkdays || 0;
  const noBreaks = !person.significantBreaksFromOverseasWork;
  const passes = hours >= cfg.averageHoursPerWeekMinimum &&
    ukDays <= cfg.ukDaysCeiling && ukWorkdays <= cfg.ukWorkdaysCeiling && noBreaks;

  return _h.env(passes, {
    test: 'automaticOverseasTest3', passes,
    hoursPerWeek: hours, hoursMinimum: cfg.averageHoursPerWeekMinimum,
    ukDays, ukDaysCeiling: cfg.ukDaysCeiling,
    ukWorkdays, ukWorkdaysCeiling: cfg.ukWorkdaysCeiling,
    noSignificantBreaks: noBreaks
  }, ['UK-RES-04'],
    `Auto overseas test 3 (full-time work overseas): ` +
    `${hours}hrs/wk (≥${cfg.averageHoursPerWeekMinimum})·${ukDays} UK days (<${cfg.ukDaysCeiling + 1})·${ukWorkdays} UK workdays (<${cfg.ukWorkdaysCeiling + 1})·breaks=${person.significantBreaksFromOverseasWork ? 'yes' : 'no'} → ${passes ? 'PASSES (auto non-resident)' : 'fails'}.`);
}

/**
 * automaticUKTest1(person, bundle) — UK-RES-03 test 1. 183+ UK days.
 */
function automaticUKTest1(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticUKTests.test1_183Days');
  const ukDays = person.ukDays || 0;
  const passes = ukDays >= cfg.ukDaysFloor;
  return _h.env(passes, {
    test: 'automaticUKTest1', passes, ukDays, floor: cfg.ukDaysFloor
  }, ['UK-RES-03'],
    `Auto UK test 1: UK days ${ukDays} ${ukDays >= cfg.ukDaysFloor ? '≥' : '<'} ${cfg.ukDaysFloor} → ${passes ? 'PASSES (auto UK resident)' : 'fails'}.`);
}

/**
 * automaticUKTest2(person, bundle) — UK-RES-03 test 2. UK-only home.
 */
function automaticUKTest2(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticUKTests.test2_onlyUKHome');
  const consecDays = person.ukHomeConsecutiveDays || 0;
  const inPeriodDays = person.daysInUKHomeInTaxYear || 0;
  const noOverseasHome = !person.hasOverseasHome || (person.daysInOverseasHome || 0) < 30;
  const passes = consecDays >= cfg.homeAvailableConsecutiveDays &&
    inPeriodDays >= cfg.minimumDaysInPeriod && noOverseasHome;

  return _h.env(passes, {
    test: 'automaticUKTest2', passes,
    ukHomeConsecutiveDays: consecDays, consecMinimum: cfg.homeAvailableConsecutiveDays,
    daysInUKHomeInTaxYear: inPeriodDays, daysMinimum: cfg.minimumDaysInPeriod,
    noOverseasHome
  }, ['UK-RES-03'],
    `Auto UK test 2 (only UK home): UK home ${consecDays} consec days (≥${cfg.homeAvailableConsecutiveDays}) · ${inPeriodDays} days in period (≥${cfg.minimumDaysInPeriod}) · ${noOverseasHome ? 'no overseas home' : 'overseas home with significant use'} → ${passes ? 'PASSES (auto UK resident)' : 'fails'}.`);
}

/**
 * automaticUKTest3(person, bundle) — UK-RES-03 test 3. Full-time UK work.
 */
function automaticUKTest3(person, bundle) {
  const cfg = _h._f(bundle, 'overseas.statutoryResidenceTest.automaticUKTests.test3_fullTimeUKWork');
  const hours = person.avgHoursPerWeekUK || 0;
  const ukWorkPct = person.ukWorkPercentOver365 || 0;
  const passes = hours >= cfg.averageHoursPerWeekMinimum && ukWorkPct >= cfg.ukWorkPercentMinimum;
  return _h.env(passes, {
    test: 'automaticUKTest3', passes,
    hoursPerWeekUK: hours, hoursMinimum: cfg.averageHoursPerWeekMinimum,
    ukWorkPct, ukWorkPctMinimum: cfg.ukWorkPercentMinimum
  }, ['UK-RES-03'],
    `Auto UK test 3 (full-time UK work): ${hours}hrs/wk UK (≥${cfg.averageHoursPerWeekMinimum}) · ${(ukWorkPct * 100).toFixed(0)}% UK work over 365 days (≥${(cfg.ukWorkPercentMinimum * 100).toFixed(0)}%) → ${passes ? 'PASSES (auto UK resident)' : 'fails'}.`);
}

/**
 * countTies(person, classification, bundle) — UK-RES-05.
 * Counts how many ties an individual has. Returns count + list.
 */
function countTies(person, classification, bundle) {
  const ties = [];
  if (person.familyTie) ties.push('family');
  if (person.accommodationTie) ties.push('accommodation');
  if (person.workTie) ties.push('work');
  if (person.ninetyDayTie) ties.push('ninetyDay');
  if (classification === 'leaver' && person.countryTie) ties.push('country');

  const available = classification === 'leaver'
    ? _h._f(bundle, 'overseas.statutoryResidenceTest.sufficientTiesTest.tiesAvailableForLeavers')
    : _h._f(bundle, 'overseas.statutoryResidenceTest.sufficientTiesTest.tiesAvailableForArrivers');

  return _h.env(ties.length, {
    classification, ties, count: ties.length, availableTies: available
  }, ['UK-RES-05'],
    `${classification === 'leaver' ? 'Leaver (5 ties available)' : 'Arriver (4 ties available)'}: ${ties.length} ties — ${ties.join(', ') || 'none'}.`);
}

/**
 * sufficientTiesResult(ukDays, tiesCount, classification, bundle) — UK-RES-05.
 * Looks up matrix to determine residency.
 */
function sufficientTiesResult(ukDays, tiesCount, classification, bundle) {
  const matrix = _h._f(bundle, 'overseas.statutoryResidenceTest.sufficientTiesTest.matrix._rows');
  let band = null;
  for (const row of matrix) {
    const [lo, hi] = row.ukDays.split('-').map(Number);
    if (ukDays >= lo && ukDays <= hi) { band = row; break; }
  }

  if (!band) {
    return _h.env(null, {
      classification, ukDays, tiesCount,
      note: ukDays < 16 ? 'Below 16 days — handled by automatic overseas test' :
            ukDays >= 183 ? 'At or above 183 days — handled by automatic UK test' :
            'No band match'
    }, ['UK-RES-05'],
      `Sufficient ties: UK days ${ukDays} not in matrix range. Use automatic tests instead.`);
  }

  const required = classification === 'leaver' ? band.leaverTiesRequired : band.arriverTiesRequired;
  if (required == null) {
    return _h.env(false, {
      classification, ukDays, tiesCount, band: band.ukDays, required: 'N/A',
      note: band.arriverNote || ''
    }, ['UK-RES-05'],
      `Sufficient ties: arriver in band ${band.ukDays} → always non-resident. ${band.arriverNote || ''}`);
  }

  const isResident = tiesCount >= required;
  return _h.env(isResident, {
    classification, ukDays, tiesCount, required, band: band.ukDays, isResident
  }, ['UK-RES-05'],
    `Sufficient ties: ${classification} in band ${band.ukDays} requires ${required} ties; has ${tiesCount} → ${isResident ? 'UK RESIDENT' : 'non-resident'}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §B (cont.) — STATUTORY RESIDENCE TEST AGGREGATE (UK-RES-01)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * statutoryResidenceTest(person, bundle) — UK-RES-01.
 * Full SRT decision tree:
 *   1. Try automatic overseas tests — if any passes, non-resident
 *   2. Try automatic UK tests — if any passes, UK resident
 *   3. Apply sufficient ties test
 *
 * person:
 *   ukDays, ukWorkdays
 *   priorYearsResident: [boolean, boolean, boolean] for last 3 years (oldest first)
 *   avgHoursPerWeekOverseas, avgHoursPerWeekUK, ukWorkPercentOver365
 *   significantBreaksFromOverseasWork
 *   ukHomeConsecutiveDays, daysInUKHomeInTaxYear
 *   hasOverseasHome, daysInOverseasHome
 *   familyTie, accommodationTie, workTie, ninetyDayTie, countryTie
 */
function statutoryResidenceTest(person, bundle) {
  const classification = _h.classifyMover(person.priorYearsResident);

  // Step 1 — automatic overseas
  const ao1 = automaticOverseasTest1(person, bundle);
  if (ao1.amount === true) {
    return _h.env('non-resident', {
      stage: 'automaticOverseas', triggeredBy: 'test1', classification, autoOverseas1: ao1.breakdown
    }, ['UK-RES-01', 'UK-RES-04'],
      `SRT: Automatic non-resident via overseas test 1. ${ao1.explanation}`);
  }
  const ao2 = automaticOverseasTest2(person, bundle);
  if (ao2.amount === true) {
    return _h.env('non-resident', {
      stage: 'automaticOverseas', triggeredBy: 'test2', classification, autoOverseas2: ao2.breakdown
    }, ['UK-RES-01', 'UK-RES-04'],
      `SRT: Automatic non-resident via overseas test 2. ${ao2.explanation}`);
  }
  const ao3 = automaticOverseasTest3(person, bundle);
  if (ao3.amount === true) {
    return _h.env('non-resident', {
      stage: 'automaticOverseas', triggeredBy: 'test3', classification, autoOverseas3: ao3.breakdown
    }, ['UK-RES-01', 'UK-RES-04'],
      `SRT: Automatic non-resident via overseas test 3 (full-time overseas work). ${ao3.explanation}`);
  }

  // Step 2 — automatic UK
  const au1 = automaticUKTest1(person, bundle);
  if (au1.amount === true) {
    return _h.env('uk-resident', {
      stage: 'automaticUK', triggeredBy: 'test1', classification, autoUK1: au1.breakdown
    }, ['UK-RES-01', 'UK-RES-03'],
      `SRT: Automatic UK resident via test 1 (183+ days). ${au1.explanation}`);
  }
  const au2 = automaticUKTest2(person, bundle);
  if (au2.amount === true) {
    return _h.env('uk-resident', {
      stage: 'automaticUK', triggeredBy: 'test2', classification, autoUK2: au2.breakdown
    }, ['UK-RES-01', 'UK-RES-03'],
      `SRT: Automatic UK resident via test 2 (UK-only home). ${au2.explanation}`);
  }
  const au3 = automaticUKTest3(person, bundle);
  if (au3.amount === true) {
    return _h.env('uk-resident', {
      stage: 'automaticUK', triggeredBy: 'test3', classification, autoUK3: au3.breakdown
    }, ['UK-RES-01', 'UK-RES-03'],
      `SRT: Automatic UK resident via test 3 (full-time UK work). ${au3.explanation}`);
  }

  // Step 3 — sufficient ties
  const ties = countTies(person, classification, bundle);
  const result = sufficientTiesResult(person.ukDays || 0, ties.amount, classification, bundle);
  return _h.env(result.amount === true ? 'uk-resident' : 'non-resident', {
    stage: 'sufficientTies', classification, tiesCount: ties.amount,
    tiesList: ties.breakdown.ties, ukDays: person.ukDays,
    sufficientTiesResult: result.breakdown
  }, ['UK-RES-01', 'UK-RES-05'],
    `SRT: ${result.amount === true ? 'UK resident' : 'non-resident'} via sufficient ties test (${classification}, ${ties.amount} ties, ${person.ukDays} UK days).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §C — DAY COUNTING (UK-RES-06)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * countUKDays(rawDays, exceptionalCircumstancesDays, bundle) — UK-RES-06.
 * Midnight rule. Up to 60 days exceptional circumstances disregarded.
 */
function countUKDays(rawDays, exceptionalCircumstancesDays, bundle) {
  const EXCEPTIONAL_CAP = 60;
  const ec = Math.min(exceptionalCircumstancesDays || 0, EXCEPTIONAL_CAP);
  const counted = Math.max(0, rawDays - ec);
  const ecCapped = (exceptionalCircumstancesDays || 0) > EXCEPTIONAL_CAP;
  return _h.env(counted, {
    rawDays, exceptionalClaimed: exceptionalCircumstancesDays || 0, exceptionalAllowed: ec,
    exceptionalCap: EXCEPTIONAL_CAP, exceptionalCapped: ecCapped, counted
  }, ['UK-RES-06'],
    `Day count (midnight rule): raw ${rawDays} − exceptional ${ec} (cap ${EXCEPTIONAL_CAP}) = ${counted} UK days. ` +
    (ecCapped ? `Exceptional claim £${exceptionalCircumstancesDays} > ${EXCEPTIONAL_CAP} day cap.` : ''));
}

// ─────────────────────────────────────────────────────────────────────────────
// §D — SPLIT YEAR (UK-RES-02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * splitYearLeaver(person, bundle) — UK-RES-02 leaver Cases 1-3.
 * Returns earliest matching case.
 */
function splitYearLeaver(person, bundle) {
  const cases = _h._f(bundle, 'overseas.splitYearTreatment.leaverCases');

  // Case 1
  if (person.startedFTOverseasWork && person.notUKResNextYear &&
      person.ftOverseasWorkContinuesToYearEnd && person.meetsAutoOverseas3NextYear) {
    return _h.env('case1', {
      case: 1, splitDate: person.firstDayOfOverseasWork, conditions: cases.case1_startingFullTimeWorkOverseas.conditions
    }, ['UK-RES-02'],
      `Split-year Case 1: Starting full-time work overseas. Split date ${person.firstDayOfOverseasWork}.`);
  }
  // Case 2
  if (person.partnerHasCase1Treatment && person.notUKResNextYear && person.joinedPartnerOverseas) {
    return _h.env('case2', {
      case: 2, splitDate: person.dateJoinedPartnerOverseas
    }, ['UK-RES-02'],
      `Split-year Case 2: Partner of Case 1. Split date ${person.dateJoinedPartnerOverseas}.`);
  }
  // Case 3
  if (person.ceasedUKHome && person.notUKResNextYear &&
      person.hadUKHomeAtYearStart && (person.ukDaysFromCessation || Infinity) < 16) {
    return _h.env('case3', {
      case: 3, splitDate: person.dayAfterUKHomeCessation
    }, ['UK-RES-02'],
      `Split-year Case 3: Ceasing to have UK home. Split date ${person.dayAfterUKHomeCessation}.`);
  }
  return _h.env(null, { case: null }, ['UK-RES-02'],
    'No leaver split-year case applies.');
}

/**
 * splitYearArriver(person, bundle) — UK-RES-02 arriver Cases 4-8.
 * Returns latest matching case (per tie-break rule for arrivers).
 */
function splitYearArriver(person, bundle) {
  const matches = [];

  if (person.startedUKHomeOnly && person.notUKResPriorYear && person.ukResThisYear) {
    matches.push({ case: 4, splitDate: person.dateUKHomeEstablished });
  }
  if (person.startedFTUKWork && person.notUKResPriorYear && person.ukResThisYear &&
      person.ftUKWorkContinues365Plus) {
    matches.push({ case: 5, splitDate: person.firstDayUKFTWork });
  }
  if (person.ceasedFTOverseasWork && person.wasNonUKPriorYear && person.ukResThisYear &&
      person.ukResNextYear) {
    matches.push({ case: 6, splitDate: person.dayAfterCeasingOverseasFTWork });
  }
  if (person.partnerHasCase6 && person.notUKResPriorYear && person.ukResThisYear &&
      person.joinedPartnerInUK) {
    matches.push({ case: 7, splitDate: person.dateJoinedPartnerInUK });
  }
  if (person.startedUKHomeFromArrival && person.notUKResPriorYear && person.ukResThisYear &&
      person.ukResNextYear && !person.hadUKHomeAtYearStart) {
    matches.push({ case: 8, splitDate: person.dateUKHomeEstablishedFromArrival });
  }

  if (matches.length === 0) {
    return _h.env(null, { case: null }, ['UK-RES-02'],
      'No arriver split-year case applies.');
  }

  // Tie-break: latest UK-part start wins for arrivers
  matches.sort((a, b) => (a.splitDate || '').localeCompare(b.splitDate || ''));
  const winner = matches[matches.length - 1];

  return _h.env(`case${winner.case}`, {
    case: winner.case, splitDate: winner.splitDate,
    allMatches: matches, tieBreakUsed: matches.length > 1
  }, ['UK-RES-02'],
    `Split-year Case ${winner.case}: arriver, split date ${winner.splitDate}. ` +
    (matches.length > 1 ? `Multiple cases matched (${matches.map(m => m.case).join(', ')}); latest UK-part start wins.` : ''));
}

/**
 * determineSplitYear(person, bundle) — UK-RES-02 entry point.
 */
function determineSplitYear(person, bundle) {
  const isLeaver = person.movementDirection === 'leaving';
  const isArriver = person.movementDirection === 'arriving';
  if (!isLeaver && !isArriver) {
    return _h.env(null, { applicable: false }, ['UK-RES-02'],
      'Split-year not applicable: no UK-arriving or UK-leaving movement specified.');
  }
  const result = isLeaver ? splitYearLeaver(person, bundle) : splitYearArriver(person, bundle);
  return _h.env(result.amount, {
    movement: person.movementDirection, applicable: result.amount != null,
    case: result.breakdown.case, splitDate: result.breakdown.splitDate
  }, ['UK-RES-02'],
    result.amount ? `Split-year applies: ${result.amount}, split date ${result.breakdown.splitDate}.` : 'No split-year case applies.');
}

// ─────────────────────────────────────────────────────────────────────────────
// §E — DOMICILE (UK-RES-07, 08, 09, 10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * domicileOfOrigin(person, bundle) — UK-RES-07.
 * Inherited from father (or mother if illegitimate at birth or father deceased pre-birth).
 */
function domicileOfOrigin(person, bundle) {
  const fatherDom = person.fatherDomicileAtBirth;
  const motherDom = person.motherDomicileAtBirth;
  const wasLegitimate = person.legitimateAtBirth !== false;
  const fatherDeceased = !!person.fatherDeceasedAtOrBeforeBirth;

  let dom, basis;
  if (wasLegitimate && !fatherDeceased) {
    dom = fatherDom; basis = "father at birth";
  } else if (!wasLegitimate || fatherDeceased) {
    dom = motherDom; basis = wasLegitimate ? "mother (father deceased pre-birth)" : "mother (illegitimate at birth)";
  }

  return _h.env(dom || null, {
    domicileOfOrigin: dom, basis, fatherDom, motherDom, wasLegitimate, fatherDeceased
  }, ['UK-RES-07'],
    dom ? `Domicile of origin: ${dom} (from ${basis}). DoO is sticky — endures unless replaced by domicile of choice.`
        : `Domicile of origin cannot be determined — required parental data missing.`);
}

/**
 * domicileOfChoice(person, bundle) — UK-RES-08.
 * Acquired by physical residence + intention to remain indefinitely.
 */
function domicileOfChoice(person, bundle) {
  const residing = !!person.residingInJurisdictionOfChoice;
  const intentionToRemain = !!person.intentionToRemainIndefinitely;
  const evidenceWeight = person.evidenceWeight || 'unspecified';
  const acquired = residing && intentionToRemain;

  return _h.env(acquired ? person.jurisdictionOfChoice : null, {
    acquired, jurisdictionOfChoice: person.jurisdictionOfChoice,
    residing, intentionToRemain, evidenceWeight,
    domicileOfChoiceTest: 'Both physical residence AND fixed intention to remain indefinitely required.'
  }, ['UK-RES-08'],
    acquired
      ? `Domicile of choice acquired in ${person.jurisdictionOfChoice}: residing AND intent to remain. Evidence weight: ${evidenceWeight}. HMRC scrutinises evidence — burden on individual.`
      : `Domicile of choice NOT acquired: ${!residing ? 'not residing in chosen jurisdiction' : 'no firm intention to remain indefinitely'}.`);
}

/**
 * domicileOfDependence(person, bundle) — UK-RES-09.
 * Children under 16 take parent's domicile; married women pre-1974.
 */
function domicileOfDependence(person, bundle) {
  const age = person.age;
  const parentDomicile = person.relevantParentDomicile;

  if (age == null) {
    return _h.env(null, { age, applicable: 'unknown' }, ['UK-RES-09'],
      'Domicile of dependence cannot be determined — age missing.');
  }
  if (age >= 16) {
    return _h.env(null, { age, applicable: false }, ['UK-RES-09'],
      `Age ${age} ≥ 16 — domicile of dependence does not apply. Adult capacity to acquire domicile of choice.`);
  }
  return _h.env(parentDomicile || null, {
    age, applicable: true, parentDomicile
  }, ['UK-RES-09'],
    `Age ${age} < 16: takes parental domicile (${parentDomicile || 'unknown'}). On reaching 16, domicile of dependence converts to domicile of choice (rebuttable).`);
}

/**
 * deemedDomicileTransitional(person, bundle) — UK-RES-10.
 * Pre-Apr-2025 deemed domicile (15-of-20) — largely replaced by long-term resident IHT rule.
 * Engine returns whether transitional rules apply.
 */
function deemedDomicileTransitional(person, bundle) {
  const yearsThreshold = _h._f(bundle, 'overseas.nonDom.oldDeemedDomicileYears'); // 17 in bundle
  const eventDate = person.eventDate;
  const transitionDate = '2025-04-06';
  const inTransitional = eventDate && _h.isOnOrAfter(eventDate, transitionDate) === false;
  const yearsResident = person.ukResidentYears || 0;
  const deemed = inTransitional && yearsResident >= yearsThreshold;

  return _h.env(deemed, {
    eventDate, transitionDate, inTransitional, yearsResident, yearsThreshold,
    deemed, supersededBy: 'UK-RES-11 (long-term resident, post-Apr-2025)'
  }, ['UK-RES-10'],
    inTransitional
      ? (deemed ? `Pre-Apr-2025: deemed UK-domiciled (${yearsResident} years ≥ ${yearsThreshold}).` : `Pre-Apr-2025: not deemed (${yearsResident} years < ${yearsThreshold}).`)
      : `Post-Apr-2025: deemed domicile rules superseded by long-term resident IHT test (UK-RES-11).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §F — LONG-TERM RESIDENT IHT TEST (UK-RES-11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * longTermResidentStatus(person, bundle) — UK-RES-11.
 * REQUIRED BY HANDOVER §A.4: must expose boolean.
 * 10+ years UK resident in last 20 → worldwide assets in IHT scope.
 *
 * Used downstream by uk-estate ihtDynamic for excluded-property check
 * (open item O-EXCLUDED-PROPERTY-POSTAPR2025-1).
 */
function longTermResidentStatus(person, bundle) {
  const threshold = _h._f(bundle, 'overseas.nonDom.ihtResidenceYears'); // 10
  const lookback = 20;
  const yearsInLookback = person.yearsUKResidentInLast20 || 0;
  const isLTR = yearsInLookback >= threshold;
  const ihtScope = isLTR ? 'worldwide' : 'UK-situs only';

  return _h.env(isLTR, {
    yearsUKResidentInLast20: yearsInLookback, threshold, lookback,
    isLongTermResident: isLTR, ihtScope, effectiveFrom: '2025-04-06',
    forIHTOnly: true,
    note: 'Long-term resident IHT test replaces pre-Apr-2025 deemed domicile (UK-RES-10) for IHT purposes only. Income tax / CGT residency unaffected.'
  }, ['UK-RES-11'],
    `Long-term resident: ${yearsInLookback} of last ${lookback} UK-resident years ${isLTR ? '≥' : '<'} ${threshold}. ` +
    `IHT scope: ${ihtScope}. ${isLTR ? 'Worldwide assets in IHT estate.' : 'Only UK-situs assets in IHT estate.'} (Effective 6 Apr 2025; replaces deemed domicile.)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §G — FIG REGIME (UK-RES-13, 24, 25, 26, 27)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * figEligibility(person, bundle) — UK-RES-24.
 * (a) UK resident in current year; (b) NOT UK resident in ALL of 10 immediately preceding years.
 */
function figEligibility(person, bundle) {
  const fig = _h._f(bundle, 'overseas.figRegime');
  const reqPriorNonRes = fig.priorNonResidenceYears; // 10
  const ukResCurrent = !!person.ukResidentCurrentYear;
  const priorNonResYears = (person.priorYearsResident || []).slice(-reqPriorNonRes);
  const allPriorNonRes = priorNonResYears.length === reqPriorNonRes && priorNonResYears.every(y => y === false);
  const eligible = ukResCurrent && allPriorNonRes;
  const yearsResidentSoFar = person.yearsUKResidentSoFar || 0;
  const remainingFigYears = Math.max(0, fig.eligibilityYears - yearsResidentSoFar);

  return _h.env(eligible, {
    eligible, ukResidentCurrentYear: ukResCurrent,
    requiredPriorNonResidenceYears: reqPriorNonRes,
    priorYearsCheckedNonResident: allPriorNonRes,
    eligibilityYears: fig.eligibilityYears, yearsResidentSoFar, remainingFigYears,
    yearFiveCliff: fig.yearFiveCliff
  }, ['UK-RES-13', 'UK-RES-24'],
    eligible
      ? `FIG eligible: UK resident current year, non-UK resident all ${reqPriorNonRes} prior years. Election available for ${remainingFigYears} more year${remainingFigYears === 1 ? '' : 's'} of UK residence (4 total).`
      : `FIG not eligible: ${!ukResCurrent ? 'not UK resident this year' : `not non-UK resident in all of last ${reqPriorNonRes} years`}.`);
}

/**
 * figElect(person, bundle) — UK-RES-25, 26.
 * Per-year positive election. Once made, irreversible. Excludes foreign income/gains from UK tax.
 */
function figElect(person, bundle) {
  const fig = _h._f(bundle, 'overseas.figRegime');
  const eligibility = figEligibility(person, bundle);
  if (!eligibility.amount) {
    return _h.env(null, {
      elected: false, eligible: false, eligibility: eligibility.breakdown
    }, ['UK-RES-25', 'UK-RES-26'],
      `FIG election unavailable: ${eligibility.explanation}`);
  }
  const elect = !!person.electFIG;
  if (!elect) {
    return _h.env(null, {
      elected: false, eligible: true,
      consequence: 'Foreign income and gains taxed normally on worldwide basis this year.'
    }, ['UK-RES-26'],
      `FIG election NOT made for this year. Foreign income/gains taxed on worldwide arising basis.`);
  }
  return _h.env(true, {
    elected: true, eligible: true,
    foreignIncomeExempt: true, foreignGainsExempt: true,
    ukSourceUnaffected: true,
    foreignLossesUsable: false,
    irreversibleForYear: true,
    annualElectionRequired: fig.annualElectionRequired
  }, ['UK-RES-25', 'UK-RES-26'],
    `FIG election made for current year. Foreign income/gains EXEMPT from UK IT/CGT. UK-source income/gains taxed normally. Foreign losses NOT usable against UK income/gains this year. Election is per-year and irreversible once made.`);
}

/**
 * figYearFiveAlert(person, bundle) — UK-RES-27.
 * Engine alert: from year 5, FIG ends entirely, no taper.
 */
function figYearFiveAlert(person, bundle) {
  const fig = _h._f(bundle, 'overseas.figRegime');
  const yearsSoFar = person.yearsUKResidentSoFar || 0;
  const cliffYear = fig.eligibilityYears + 1; // year 5
  const yearsToCliff = cliffYear - yearsSoFar;
  const inCliff = yearsSoFar >= cliffYear;
  const inFinalYear = yearsSoFar === fig.eligibilityYears;
  const inWarningZone = yearsToCliff <= 1 && yearsToCliff > 0;

  return _h.env(yearsToCliff, {
    yearsResidentSoFar: yearsSoFar, eligibilityYears: fig.eligibilityYears, cliffYear,
    yearsToCliff, inCliff, inFinalYear, inWarningZone,
    note: fig.engineNote || 'Engine must alert at approach to year 5.'
  }, ['UK-RES-27'],
    inCliff
      ? `FIG window CLOSED: in year ${yearsSoFar} of UK residence (≥ year ${cliffYear}). Worldwide income/gains taxable.`
      : inFinalYear
        ? `FIG FINAL YEAR (year ${yearsSoFar}): election possible this year, then cliff-edge to worldwide regime. Plan disposals/realisations BEFORE year ${cliffYear} ahead of cliff.`
        : inWarningZone
          ? `FIG warning: ${yearsToCliff} year(s) to cliff-edge. Begin planning realisations / structure changes now.`
          : `FIG window: ${yearsToCliff} year(s) before cliff-edge at year ${cliffYear}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §H — TRF (UK-RES-28, 29, 30)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * trfRate(taxYear, bundle) — UK-RES-29.
 * Returns flat TRF rate for the tax year.
 */
function trfRate(taxYear, bundle) {
  const trf = _h._f(bundle, 'overseas.trfFacility');
  const tyKey = `${taxYear}/${(taxYear + 1).toString().slice(-2)}`;
  const map = {
    '2025/26': trf.trfRate2526,
    '2026/27': trf.trfRate2627,
    '2027/28': trf.trfRate2728
  };
  const rate = map[tyKey];
  if (rate == null) {
    return _h.env(null, {
      taxYear, tyKey, available: false, availableYears: trf.availableYears
    }, ['UK-RES-29'],
      `TRF rate for ${tyKey}: NOT AVAILABLE. TRF window: ${trf.availableYears.join(', ')}.`);
  }
  return _h.env(rate, {
    taxYear, tyKey, rate, available: true,
    closesAfter: trf.closesAfter
  }, ['UK-RES-29'],
    `TRF rate for ${tyKey}: ${(rate * 100).toFixed(0)}%. Below marginal IT (45%) and CGT (24%) rates. Window closes after ${trf.closesAfter}.`);
}

/**
 * trfDesignate(amount, taxYear, person, bundle) — UK-RES-29.
 * Designate pre-Apr-2025 unremitted FIG at flat TRF rate.
 */
function trfDesignate(amount, taxYear, person, bundle) {
  const eligibilityNote = _h._f(bundle, 'overseas.trfFacility.eligibility');
  const wasFormerRBUser = !!person.formerRemittanceBasisUser;
  const hasPreApr2025FIG = !!person.hasPreApr2025UnremittedFIG;
  const eligible = wasFormerRBUser && hasPreApr2025FIG;

  if (!eligible) {
    return _h.env(0, {
      amount, taxYear, eligible: false, wasFormerRBUser, hasPreApr2025FIG
    }, ['UK-RES-28', 'UK-RES-29'],
      `TRF designation NOT eligible: ${!wasFormerRBUser ? 'not former remittance-basis user' : 'no pre-Apr-2025 unremitted FIG'}. Eligibility: ${eligibilityNote}`);
  }

  const rateRes = trfRate(taxYear, bundle);
  if (rateRes.amount == null) {
    return _h.env(0, {
      amount, taxYear, eligible: true, rateAvailable: false, message: rateRes.explanation
    }, ['UK-RES-29'],
      `TRF designation: rate not available for tax year ${taxYear}. ${rateRes.explanation}`);
  }
  const tax = amount * rateRes.amount;
  return _h.env(tax, {
    amount, taxYear, rate: rateRes.amount, tax, eligible: true,
    netRetained: amount - tax,
    note: 'No PA, no AEA, no UK reliefs offsettable. Mixed-fund priority: post-6-Apr-2008 income takes priority.'
  }, ['UK-RES-29'],
    `TRF designation £${amount.toLocaleString('en-GB')} at ${(rateRes.amount * 100).toFixed(0)}% = £${tax.toLocaleString('en-GB')} tax. Net retained: £${(amount - tax).toLocaleString('en-GB')}. No personal allowance / AEA / UK reliefs.`);
}

/**
 * trfMixedFundPriority(designations, bundle) — UK-RES-29.
 * Mixed fund rules: post-6-Apr-2008 income takes priority — beneficial as it clears highest-risk layer first.
 */
function trfMixedFundPriority(designations, bundle) {
  const sorted = (designations || []).slice().sort((a, b) => {
    const order = { 'post2008Income': 1, 'pre2008Income': 2, 'gains': 3, 'cleanCapital': 4 };
    return (order[a.type] || 99) - (order[b.type] || 99);
  });
  return _h.env(sorted, {
    sortedOrder: sorted, count: sorted.length,
    rule: 'Post-6-Apr-2008 income → pre-2008 income → gains → clean capital'
  }, ['UK-RES-29'],
    `Mixed fund priority for TRF designation: post-6-Apr-2008 income first (clears highest-risk layer), then earlier income, then gains, then clean capital. ${sorted.length} layer(s) to designate.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §I — TEMPORARY NON-RESIDENCE + DTAA (UK-RES-14, 15, 17, 18, 21, 23)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * temporaryNonResidence(person, bundle) — UK-RES-14.
 * Returners within 5 years can be retrospectively taxed on certain gains/income.
 */
function temporaryNonResidence(person, bundle) {
  const yearsAway = person.yearsAwayFromUK || 0;
  const wasUKResImmediatelyBefore = !!person.wasUKResidentBeforeLeaving;
  const hasReturned = !!person.hasReturnedToUK;
  const RETURN_PERIOD = 5;
  const isTNR = wasUKResImmediatelyBefore && hasReturned && yearsAway < RETURN_PERIOD;

  return _h.env(isTNR, {
    yearsAway, wasUKResImmediatelyBefore, hasReturned, returnPeriod: RETURN_PERIOD,
    isTemporaryNonResident: isTNR,
    consequencesIfTNR: [
      'Certain capital gains realised while non-resident may be taxed on return',
      'Certain pension lump sums may be taxed on return',
      'Distributions from close companies may be taxed on return',
      'Specific lookback rules apply per asset type'
    ]
  }, ['UK-RES-14'],
    isTNR
      ? `Temporary non-residence applies: returned within ${RETURN_PERIOD} years (${yearsAway} away). Certain gains, pension lump sums, and close-company distributions realised while non-resident may be taxed on return.`
      : `Not temporarily non-resident: ${!wasUKResImmediatelyBefore ? 'was not UK resident before leaving' : !hasReturned ? 'has not returned to UK' : `${yearsAway} years away ≥ ${RETURN_PERIOD}`}.`);
}

/**
 * treatyResidenceTieBreaker(person, treatyType, bundle) — UK-RES-15, 18.
 * Where dual residence under both jurisdictions' rules, treaty Article 4 tie-breaker:
 *   1. Permanent home test
 *   2. Centre of vital interests
 *   3. Habitual abode
 *   4. Nationality
 *   5. Mutual agreement
 */
function treatyResidenceTieBreaker(person, bundle) {
  const facts = person.facts || {};
  let result = null, basis = null;

  // Step 1 — permanent home
  if (facts.permanentHomeUK && !facts.permanentHomeOther) { result = 'UK'; basis = 'permanent home — UK only'; }
  else if (!facts.permanentHomeUK && facts.permanentHomeOther) { result = 'Other'; basis = 'permanent home — other only'; }

  // Step 2 — centre of vital interests
  if (!result && facts.centreOfVitalInterests) {
    result = facts.centreOfVitalInterests;
    basis = `centre of vital interests — ${result}`;
  }
  // Step 3 — habitual abode
  if (!result && facts.habitualAbode) {
    result = facts.habitualAbode;
    basis = `habitual abode — ${result}`;
  }
  // Step 4 — nationality
  if (!result && facts.nationality) {
    result = facts.nationality;
    basis = `nationality — ${result}`;
  }
  // Step 5 — mutual agreement procedure
  if (!result) basis = 'no test resolved — mutual agreement procedure between competent authorities';

  return _h.env(result, {
    facts, treatyResidence: result, basisStep: basis,
    steps: ['permanentHome', 'centreOfVitalInterests', 'habitualAbode', 'nationality', 'mutualAgreement']
  }, ['UK-RES-15', 'UK-RES-18'],
    result
      ? `Treaty residence tie-break: ${result} (resolved at: ${basis}).`
      : `Treaty tie-break: not resolved — refer to competent authority mutual agreement.`);
}

/**
 * foreignTaxCredit(ukLiability, foreignTaxPaid, bundle) — UK-RES-23.
 * UK gives credit for foreign tax limited to UK tax on the same income.
 */
function foreignTaxCredit(ukLiability, foreignTaxPaid, bundle) {
  const credit = Math.min(ukLiability, foreignTaxPaid);
  const ukTaxAfterCredit = Math.max(0, ukLiability - credit);
  const unrelievedForeignTax = foreignTaxPaid - credit;

  return _h.env(credit, {
    ukLiability, foreignTaxPaid, credit, ukTaxAfterCredit, unrelievedForeignTax,
    rule: 'Credit limited to UK tax on the same income/gain'
  }, ['UK-RES-23'],
    `Foreign Tax Credit: UK liability £${ukLiability.toLocaleString('en-GB')}, foreign tax £${foreignTaxPaid.toLocaleString('en-GB')}. ` +
    `Credit £${credit.toLocaleString('en-GB')} (lower of two). UK tax after credit: £${ukTaxAfterCredit.toLocaleString('en-GB')}. ` +
    (unrelievedForeignTax > 0 ? `Unrelieved foreign tax £${unrelievedForeignTax.toLocaleString('en-GB')} (no relief).` : 'All foreign tax relieved.'));
}

// ─────────────────────────────────────────────────────────────────────────────
// §J — AGGREGATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getResidencyStatus(person, bundle)
 * One-call summary: SRT + split year + LTR + FIG + domicile.
 */
function getResidencyStatus(person, bundle) {
  const srt = statutoryResidenceTest(person, bundle);
  let splitYear = null;
  if (person.movementDirection) splitYear = determineSplitYear(person, bundle);

  let figStatus = null;
  if (person.checkFIG) figStatus = figEligibility(person, bundle);

  let ltr = null;
  if (person.yearsUKResidentInLast20 != null) ltr = longTermResidentStatus(person, bundle);

  let dom = null;
  if (person.fatherDomicileAtBirth || person.motherDomicileAtBirth) dom = domicileOfOrigin(person, bundle);

  return _h.env(srt.amount, {
    srtResult: srt.amount, srtStage: srt.breakdown.stage,
    splitYear: splitYear ? splitYear.amount : null,
    longTermResident: ltr ? ltr.amount : null,
    longTermResidentDetail: ltr ? ltr.breakdown : null,
    figEligible: figStatus ? figStatus.amount : null,
    domicileOfOrigin: dom ? dom.amount : null
  }, ['UK-RES-01', 'UK-RES-02', 'UK-RES-07', 'UK-RES-11', 'UK-RES-13'],
    `Residency: ${srt.amount} (via ${srt.breakdown.stage}). ` +
    (splitYear ? `Split-year: ${splitYear.amount || 'n/a'}. ` : '') +
    (ltr ? `Long-term resident: ${ltr.amount}. ` : '') +
    (figStatus ? `FIG eligible: ${figStatus.amount}. ` : ''));
}

/**
 * taxScope(residencyStatus, longTermResident, bundle)
 * Returns scope for IT/CGT vs IHT.
 */
function taxScope(residencyStatus, longTermResident, bundle) {
  const itCgtScope = residencyStatus === 'uk-resident' ? 'worldwide (subject to FIG election)' : 'UK-source only';
  const ihtScope = longTermResident === true ? 'worldwide' : 'UK-situs only';
  return _h.env(null, {
    residencyStatus, longTermResident,
    itCgtScope, ihtScope,
    figMayChangeScope: residencyStatus === 'uk-resident',
    note: 'IHT scope diverges from IT/CGT scope from 6 Apr 2025 — IHT uses long-term resident test, IT/CGT uses SRT residency.'
  }, ['UK-RES-11', 'UK-RES-17'],
    `Tax scope: IT/CGT ${itCgtScope}; IHT ${ihtScope}. ` +
    (residencyStatus === 'uk-resident' ? 'FIG election may exempt foreign IT/CGT in years 1–4. ' : '') +
    `Note: IHT and IT/CGT use different tests post-Apr-2025.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // SRT individual tests
  automaticOverseasTest1, automaticOverseasTest2, automaticOverseasTest3,
  automaticUKTest1, automaticUKTest2, automaticUKTest3,
  countTies, sufficientTiesResult,
  // SRT aggregate
  statutoryResidenceTest,
  // Day count
  countUKDays,
  // Split year
  splitYearLeaver, splitYearArriver, determineSplitYear,
  // Domicile
  domicileOfOrigin, domicileOfChoice, domicileOfDependence, deemedDomicileTransitional,
  // Long-term resident IHT
  longTermResidentStatus,
  // FIG
  figEligibility, figElect, figYearFiveAlert,
  // TRF
  trfRate, trfDesignate, trfMixedFundPriority,
  // Other
  temporaryNonResidence, treatyResidenceTieBreaker, foreignTaxCredit,
  // Aggregates
  getResidencyStatus, taxScope
};
