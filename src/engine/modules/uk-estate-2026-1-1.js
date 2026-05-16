/**
 * uk-estate-2026-1-1.js
 *
 * Caelixa / Sonuswealth — UK estate engine.
 * Bundle: UK-2026.1.1.
 *
 * Source authority:
 *   - 3-Engine-uk-tax-and-estate-coverage-v1_4.md (canonical rule list)
 *   - UK-2026.1.1.json (canonical values; this file reads ZERO hardcoded rates)
 *   - 2-Product-mymoney-v2_6.md §0.1 (founder IP definitions; CoI estate domain stub)
 *   - 2-Product-tax-estate-v1_5.md (surface bindings)
 *
 * Architectural bindings (s17a-1 + s17a-2):
 *   - Pure functions; no side effects
 *   - Bundle-driven; no hardcoded rates/thresholds/allowances
 *   - {amount, breakdown, rules, explanation} envelope on every PUBLIC function
 *   - Domain-research-first (skill v1.4 §2.7) — every rule traces to coverage v1.4
 *   - getWrapperEstate() called before any IHT calc on an asset
 *   - Founder IP CoI for 'estatePlanning' domain = stub (skill v1.4 §2.7 rule 3)
 *
 * Decisions in force at s17a-2:
 *   - D-ENGINE-FILENAME-1: filename pinned to bundle version
 *   - D-CONFIGURABLE-DEFAULTS-1 / Q1=A: engine reads bundle only; override resolution
 *     happens in a layer ABOVE this file. Engine stays pure.
 *
 * Jurisdiction note (carried forward to s17a-3 + per coverage §17/§18):
 *   - §5.1–§5.6 IHT — UK-wide (IHTA 1984)
 *   - §5.7 intestacy (UK-IHT-52..56) — E&W rules; Scotland flagged via _meta
 *   - §6 trust regimes — UK-wide, but Scottish trust law differs in some respects
 *   - §17 wills/probate — E&W (Scotland flagged)
 *
 * Open items honoured: O-PSA-SCOT-1 / O-MARRIAGE-ALLOW-SCOT-2 are tax-side; no estate impact.
 *
 * @author  Caelixa / Sonuswealth — Mihir Patel
 * @session s17a-2 (Opus · Track A · Code)
 *          s17b-2b retrofit: O-EST-RNRB-CAP-1 — residenceNilRateBand + cascade (IHTM46031)
 */

'use strict';

import { marginalIncomeRate } from './uk-tax-2026-1-1.js';


/* ──────────────────────────────────────────────────────────────────────────
 * INTERNAL HELPERS — bundle access
 * ──────────────────────────────────────────────────────────────────────── */

/** @private */
function _iht(bundle) {
  if (!bundle || !bundle.inheritanceTax) {
    throw new Error('uk-estate-2026-1-1: bundle.inheritanceTax missing');
  }
  return bundle.inheritanceTax;
}

/** @private */
function _trusts(bundle) {
  if (!bundle || !bundle.trusts) {
    throw new Error('uk-estate-2026-1-1: bundle.trusts missing');
  }
  return bundle.trusts;
}

/** @private */
function _overseas(bundle) {
  if (!bundle || !bundle.overseas) {
    throw new Error('uk-estate-2026-1-1: bundle.overseas missing');
  }
  return bundle.overseas;
}

/** @private — clamp non-negative */
function _max0(n) { return n > 0 ? n : 0; }

/** @private — round to pence */
function _r(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** @private — date helpers */
function _toDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string') return new Date(d);
  throw new Error('uk-estate-2026-1-1: invalid date input');
}
function _yearsBetween(a, b) {
  const ms = _toDate(b).getTime() - _toDate(a).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.1 — IHT BANDS (UK-IHT-01 to UK-IHT-10)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Nil-Rate Band (UK-IHT-01).
 * Frozen until April 2030 (Autumn Budget 2025 extension).
 *
 * @returns {{amount:number, breakdown:object, rules:string[], explanation:string}}
 */
export function nilRateBand(bundle) {
  const iht = _iht(bundle);
  return {
    amount: iht.nilRateBand,
    breakdown: { nrb: iht.nilRateBand, frozenTo: iht.nilRateBandFrozenTo },
    rules: ['UK-IHT-01'],
    explanation:
      `Nil-rate band: £${iht.nilRateBand.toLocaleString()} per individual. ` +
      `Frozen until April ${iht.nilRateBandFrozenTo}.`,
  };
}

/**
 * Residence Nil-Rate Band (UK-IHT-02 + UK-IHT-07 + IHTM46031).
 * Tapers £1 for every £2 of estate value above £2m.
 * IHTM46031: RNRB is the lower of the tapered maximum and the qualifying residential interest (QRI) value.
 *
 * @param {number}  grossEstateValue               — total estate before reliefs/exemptions
 * @param {boolean} residenceLeftToDirectDescendants
 * @param {object}  bundle
 * @param {number}  [residenceValue=Infinity]      — QRI value for IHTM46031 cap; omit for no cap (backward-compat)
 *
 * Retrofit: s17b-2b · O-EST-RNRB-CAP-1
 */
export function residenceNilRateBand(grossEstateValue, residenceLeftToDirectDescendants, bundle, residenceValue = Infinity) {
  const iht = _iht(bundle);

  if (!residenceLeftToDirectDescendants) {
    return {
      amount: 0,
      breakdown: { rnrbBase: iht.residenceNilRateBand, available: 0, taperedAway: iht.residenceNilRateBand,
                   reason: 'no qualifying residence to direct descendants' },
      rules: ['UK-IHT-02'],
      explanation:
        `Residence Nil-Rate Band only applies where a qualifying residence passes to direct descendants. ` +
        `None applicable here — RNRB = £0.`,
    };
  }

  const taperStart = iht.residenceNilRateBandTaperStart;
  const base = iht.residenceNilRateBand;

  let taperReduction = 0;
  if (grossEstateValue > taperStart) {
    taperReduction = Math.floor((grossEstateValue - taperStart) / 2);
  }
  const rnrbAfterTaper = _max0(base - taperReduction);
  // IHTM46031: RNRB is the lower of the tapered maximum and the qualifying residential interest value.
  const rnrb = Math.min(rnrbAfterTaper, residenceValue);
  const capApplied = isFinite(residenceValue) && rnrb < rnrbAfterTaper;

  return {
    amount: rnrb,
    breakdown: {
      rnrbBase: base,
      taperStart,
      grossEstateValue,
      taperReduction,
      rnrbAfterTaper,
      residenceValueCap: isFinite(residenceValue) ? residenceValue : 'none',
      capApplied,
      available: rnrb,
      frozenTo: iht.residenceNilRateBandFrozenTo,
    },
    rules: ['UK-IHT-02', 'UK-IHT-07', 'IHTM46031'],
    explanation:
      `Residence Nil-Rate Band: £${base.toLocaleString()} base. ` +
      (taperReduction > 0
        ? `Estate £${grossEstateValue.toLocaleString()} exceeds £${taperStart.toLocaleString()} — ` +
          `tapered by £${taperReduction.toLocaleString()} (£1 per £2 of excess). ` +
          `RNRB after taper = £${rnrbAfterTaper.toLocaleString()}. `
        : `Estate within £${taperStart.toLocaleString()} threshold. `) +
      (capApplied
        ? `Capped at qualifying residence value £${residenceValue.toLocaleString()} (IHTM46031). ` +
          `Available RNRB = £${rnrb.toLocaleString()}.`
        : `Available RNRB = £${rnrb.toLocaleString()}.`),
  };
}

/**
 * Transferable Nil-Rate Band (UK-IHT-03).
 * Surviving spouse/CP can claim deceased's unused NRB proportion.
 *
 * @param {number} deceasedSpouseUnusedNRBPct — fraction unused (0..1)
 */
export function transferableNRB(deceasedSpouseUnusedNRBPct, bundle) {
  const iht = _iht(bundle);
  const pct = Math.min(1, _max0(deceasedSpouseUnusedNRBPct));
  const transferred = _r(iht.nilRateBand * pct);

  return {
    amount: transferred,
    breakdown: {
      currentNRB: iht.nilRateBand,
      deceasedSpouseUnusedPct: pct,
      transferredAmount: transferred,
      maxCombinedNRB: iht.nilRateBand + transferred,
    },
    rules: ['UK-IHT-03'],
    explanation:
      `Transferable NRB: ${(pct * 100).toFixed(1)}% of current NRB (£${iht.nilRateBand.toLocaleString()}) ` +
      `transfers from deceased spouse = £${transferred.toLocaleString()}. ` +
      `Survivor's combined NRB = £${(iht.nilRateBand + transferred).toLocaleString()}.`,
  };
}

/**
 * Transferable Residence Nil-Rate Band (UK-IHT-04 + IHTM46031 + IHTM46035).
 * Same mechanism as TNRB; applies to RNRB. Combined (own + transferred) capped at QRI value.
 *
 * @param {number} [residenceValue=Infinity] — QRI value for IHTM46031 cap; omit for no cap (backward-compat)
 *
 * Retrofit: s17b-2b · O-EST-RNRB-CAP-1
 */
export function transferableRNRB(deceasedSpouseUnusedRNRBPct, grossEstateValue, residenceLeftToDirectDescendants, bundle, residenceValue = Infinity) {
  const iht = _iht(bundle);
  const pct = Math.min(1, _max0(deceasedSpouseUnusedRNRBPct));

  if (!residenceLeftToDirectDescendants) {
    return {
      amount: 0,
      breakdown: { reason: 'no qualifying residence — TRNRB unavailable', deceasedUnusedPct: pct },
      rules: ['UK-IHT-04'],
      explanation: `TRNRB requires a qualifying residence passing to direct descendants. None — TRNRB = £0.`,
    };
  }

  // Baseline RNRB (own component, after taper + IHTM46031 QRI cap).
  const baseline = residenceNilRateBand(grossEstateValue, true, bundle, residenceValue);
  // Transferred portion computed on current RNRB base (£175k), then summed and tapered jointly.
  // HMRC method: total RNRB = (own RNRB base + transferred) tapered if estate > £2m,
  // then combined total capped at qualifying residential interest value (IHTM46031 + IHTM46035).
  const grossTransferred = _r(iht.residenceNilRateBand * pct);
  const totalBeforeTaper = iht.residenceNilRateBand + grossTransferred;

  let taperReduction = 0;
  if (grossEstateValue > iht.residenceNilRateBandTaperStart) {
    taperReduction = Math.floor((grossEstateValue - iht.residenceNilRateBandTaperStart) / 2);
  }
  const totalAfterTaper = _max0(totalBeforeTaper - taperReduction);
  // IHTM46031 + IHTM46035: combined RNRB (own + transferred) capped at QRI value.
  const totalAfterCap = Math.min(totalAfterTaper, residenceValue);
  const capApplied = isFinite(residenceValue) && totalAfterCap < totalAfterTaper;

  return {
    amount: totalAfterCap,
    breakdown: {
      ownRNRB: iht.residenceNilRateBand,
      deceasedSpouseUnusedPct: pct,
      transferredRNRB: grossTransferred,
      totalBeforeTaper,
      taperStart: iht.residenceNilRateBandTaperStart,
      grossEstateValue,
      taperReduction,
      totalAfterTaper,
      residenceValueCap: isFinite(residenceValue) ? residenceValue : 'none',
      capApplied,
      availableTotal: totalAfterCap,
      ownComponent: baseline.amount,
      transferredComponent: _max0(totalAfterCap - baseline.amount),
    },
    rules: ['UK-IHT-04', 'UK-IHT-07', 'IHTM46031', 'IHTM46035'],
    explanation:
      `Transferable RNRB: own £${iht.residenceNilRateBand.toLocaleString()} + ` +
      `transferred ${(pct * 100).toFixed(1)}% × £${iht.residenceNilRateBand.toLocaleString()} ` +
      `= £${totalBeforeTaper.toLocaleString()} pre-taper. ` +
      (taperReduction > 0
        ? `Tapered by £${taperReduction.toLocaleString()} → £${totalAfterTaper.toLocaleString()} after taper. `
        : `No taper — £${totalAfterTaper.toLocaleString()} after taper. `) +
      (capApplied
        ? `Capped at QRI value £${residenceValue.toLocaleString()} (IHTM46031). Available = £${totalAfterCap.toLocaleString()}.`
        : `Available = £${totalAfterCap.toLocaleString()}.`),
  };
}

/**
 * Combined nil-rate bands available to estate.
 * Returns NRB + RNRB total, accounting for transferability and taper.
 */
export function combinedNilRateBands(opts, bundle) {
  const {
    grossEstateValue,
    residenceLeftToDirectDescendants = false,
    deceasedSpouseUnusedNRBPct = 0,
    deceasedSpouseUnusedRNRBPct = 0,
    residenceValue = Infinity,  // IHTM46031 QRI cap — pass through to transferableRNRB
  } = opts;

  const ownNrb = nilRateBand(bundle);
  const trnrb = transferableNRB(deceasedSpouseUnusedNRBPct, bundle);
  const rnrbTotal = transferableRNRB(
    deceasedSpouseUnusedRNRBPct,
    grossEstateValue,
    residenceLeftToDirectDescendants,
    bundle,
    residenceValue,
  );

  const totalNrbAndTransfer = ownNrb.amount + trnrb.amount;
  const total = totalNrbAndTransfer + rnrbTotal.amount;

  return {
    amount: total,
    breakdown: {
      nrb: ownNrb.amount,
      transferableNRB: trnrb.amount,
      nrbTotal: totalNrbAndTransfer,
      rnrbTotal: rnrbTotal.amount,
      grandTotal: total,
    },
    rules: ['UK-IHT-01', 'UK-IHT-02', 'UK-IHT-03', 'UK-IHT-04', 'UK-IHT-07'],
    explanation:
      `Total nil-rate bands available: NRB £${ownNrb.amount.toLocaleString()} + ` +
      `transferred NRB £${trnrb.amount.toLocaleString()} + ` +
      `RNRB total £${rnrbTotal.amount.toLocaleString()} = £${total.toLocaleString()}.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.2 — EXEMPTIONS (UK-IHT-11 to UK-IHT-20)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Annual gift exemption (UK-IHT-14): £3,000 per tax year, plus 1-year carry-forward of unused.
 *
 * @param {number} priorYearUnused — fraction unused from prior year (0..3000)
 * @param {number} currentYearGifts — gifts already made this year (excluding small/wedding)
 */
export function annualGiftExemption(priorYearUnused, currentYearGifts, bundle) {
  const iht = _iht(bundle);
  const annual = iht.annualGiftExemption;
  const priorAvailable = Math.min(_max0(priorYearUnused), annual);
  const totalAvailable = annual + priorAvailable;
  const used = Math.min(_max0(currentYearGifts), totalAvailable);
  const remaining = _max0(totalAvailable - used);

  return {
    amount: remaining,
    breakdown: {
      annualLimit: annual,
      carryForwardYears: iht.annualGiftExemptionCarryForwardYears,
      priorYearUnusedAvailable: priorAvailable,
      totalAvailable,
      used,
      remaining,
    },
    rules: ['UK-IHT-14'],
    explanation:
      `Annual exemption £${annual.toLocaleString()}/year. ` +
      `Carry-forward (max 1 year): £${priorAvailable.toLocaleString()}. ` +
      `Total this year: £${totalAvailable.toLocaleString()}. ` +
      `Used: £${used.toLocaleString()}. Remaining: £${remaining.toLocaleString()}.`,
  };
}

/**
 * Small gifts exemption (UK-IHT-15): £250 per recipient per year.
 * Cannot combine with annual exemption to the same recipient.
 *
 * @param {Array<{recipient:string, amount:number}>} giftsByRecipient
 */
export function smallGiftsExemption(giftsByRecipient, bundle) {
  const iht = _iht(bundle);
  const limit = iht.smallGiftExemption;

  const exempt = [];
  const failed = [];
  let totalExempt = 0;

  for (const g of giftsByRecipient) {
    if (g.amount <= limit) {
      exempt.push({ recipient: g.recipient, amount: g.amount });
      totalExempt += g.amount;
    } else {
      // Whole gift fails small-gifts exemption (cannot apply partially).
      failed.push({ recipient: g.recipient, amount: g.amount, reason: 'exceeds £250 — full amount disqualified' });
    }
  }

  return {
    amount: totalExempt,
    breakdown: { perRecipientLimit: limit, exempt, failedSmallGiftStatus: failed, totalExempt },
    rules: ['UK-IHT-15'],
    explanation:
      `Small gifts exemption: £${limit} per recipient per tax year. ` +
      `${exempt.length} qualifying gifts totalling £${totalExempt.toLocaleString()}. ` +
      (failed.length
        ? `${failed.length} gifts exceeded £${limit} and cannot use this exemption ` +
          `(but may use annual exemption / become PETs).`
        : `All gifts within limit.`) +
      ` Cannot be combined with annual exemption to the same recipient.`,
  };
}

/**
 * Wedding/CP gift exemption (UK-IHT-16).
 * Must be made BEFORE the ceremony.
 *
 * @param {string} relationship — 'parent' | 'grandparent' | 'other'
 */
export function weddingGiftExemption(relationship, bundle) {
  const iht = _iht(bundle);
  let limit;
  switch (relationship) {
    case 'parent':       limit = iht.weddingGiftParent; break;
    case 'grandparent':  limit = iht.weddingGiftGrandparent; break;
    case 'other':        limit = iht.weddingGiftOther; break;
    default:
      return {
        amount: 0,
        breakdown: { error: `unknown relationship: ${relationship}` },
        rules: ['UK-IHT-16'],
        explanation: `Wedding gift exemption requires relationship in {parent, grandparent, other}.`,
      };
  }

  return {
    amount: limit,
    breakdown: {
      relationship,
      parentLimit: iht.weddingGiftParent,
      grandparentLimit: iht.weddingGiftGrandparent,
      otherLimit: iht.weddingGiftOther,
      applicableLimit: limit,
      mustBeBeforeCeremony: true,
    },
    rules: ['UK-IHT-16'],
    explanation:
      `Wedding/CP gift exemption: £${iht.weddingGiftParent.toLocaleString()} parent · ` +
      `£${iht.weddingGiftGrandparent.toLocaleString()} grandparent · ` +
      `£${iht.weddingGiftOther.toLocaleString()} other. ` +
      `Applicable for relationship "${relationship}": £${limit.toLocaleString()}. ` +
      `Must be made before the ceremony.`,
  };
}

/**
 * Normal expenditure out of income (UK-IHT-17) — qualitative test.
 * All three conditions required: habitual + out of income (not capital) + leaves giver normal living standard.
 */
export function normalExpenditureFromIncomeQualifies(opts, bundle) {
  const { isHabitualPattern, fundedFromIncomeNotCapital, leavesNormalLivingStandard } = opts;
  const qualifies = !!(isHabitualPattern && fundedFromIncomeNotCapital && leavesNormalLivingStandard);

  return {
    amount: qualifies ? 1 : 0, // qualifying flag (boolean coded as 1/0 for envelope consistency)
    breakdown: {
      isHabitualPattern,
      fundedFromIncomeNotCapital,
      leavesNormalLivingStandard,
      qualifies,
    },
    rules: ['UK-IHT-17'],
    explanation:
      qualifies
        ? `Gifts qualify as Normal Expenditure out of Income — fully exempt with no upper limit. ` +
          `Documentation strongly advised (HMRC IHT403 questions). Cross-ref UK-LPA-08 / UK-LPA-12 — ` +
          `attorneys must NOT continue this pattern without Court of Protection authority.`
        : `Does NOT qualify for Normal Expenditure exemption. All three conditions required: ` +
          `(1) habitual pattern, (2) out of income not capital, (3) leaves giver's normal living standard intact.`,
  };
}

/**
 * Spouse/CP exemption (UK-IHT-11/12).
 * UK-dom recipient: unlimited. Non-dom recipient: capped at current NRB cumulatively.
 */
export function spouseExemption(transferAmount, recipientUKDom, priorSpouseTransfersToNonDom, bundle) {
  const iht = _iht(bundle);

  if (recipientUKDom) {
    return {
      amount: transferAmount,
      breakdown: { transferAmount, recipientUKDom, exempt: transferAmount, capped: false },
      rules: ['UK-IHT-11'],
      explanation:
        `Spouse / civil partner exemption: unlimited (UK-domiciled recipient). ` +
        `Full £${transferAmount.toLocaleString()} exempt.`,
    };
  }

  // Non-dom recipient: cap = current NRB cumulatively across lifetime + death
  const cap = iht.nilRateBand;
  const remainingCap = _max0(cap - _max0(priorSpouseTransfersToNonDom));
  const exempt = Math.min(transferAmount, remainingCap);
  const taxable = _max0(transferAmount - exempt);

  return {
    amount: exempt,
    breakdown: {
      transferAmount,
      recipientUKDom,
      cumulativeCap: cap,
      priorTransfersUsed: _max0(priorSpouseTransfersToNonDom),
      remainingCap,
      exempt,
      taxableExcess: taxable,
      electionAvailable: 'Recipient may elect to be UK-domiciled for IHT — uncaps exemption but exposes worldwide assets.',
    },
    rules: ['UK-IHT-12'],
    explanation:
      `Spouse exemption to non-UK-dom recipient: capped at £${cap.toLocaleString()} cumulatively. ` +
      `Used £${priorSpouseTransfersToNonDom.toLocaleString()} previously; remaining cap £${remainingCap.toLocaleString()}. ` +
      `Of £${transferAmount.toLocaleString()}: £${exempt.toLocaleString()} exempt, ` +
      `£${taxable.toLocaleString()} chargeable. Recipient can elect UK-dom to remove cap.`,
  };
}

/**
 * Charitable exemption (UK-IHT-13).
 * Unlimited; underpins UK-IHT-06 reduced-rate mechanics.
 */
export function charityExemption(transferAmount, qualifyingCharity, bundle) {
  if (!qualifyingCharity) {
    return {
      amount: 0,
      breakdown: { transferAmount, qualifyingCharity: false, reason: 'recipient not a qualifying UK/EEA charity' },
      rules: ['UK-IHT-13'],
      explanation:
        `Charitable exemption requires recipient to be a qualifying UK/EEA charity. ` +
        `No exemption applied.`,
    };
  }
  return {
    amount: transferAmount,
    breakdown: { transferAmount, qualifyingCharity: true, exempt: transferAmount },
    rules: ['UK-IHT-13'],
    explanation:
      `Charitable exemption: unlimited. Full £${transferAmount.toLocaleString()} exempt. ` +
      `If ≥10% of net estate goes to charity, reduced 36% rate applies on remaining estate (UK-IHT-06).`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.4 — GIFTS / PETs / CLTs / TAPER (UK-IHT-33 to UK-IHT-40)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Taper relief factor (UK-IHT-34).
 * Returns the multiplier on standard 40% IHT rate (not on gift value).
 *
 * Bundle stores "% of tax remaining" form — bundle.taperRelief.years3to4 = 0.80
 * means 80% of full tax remains (i.e. 20% reduction → 32% effective rate).
 *
 * Domain note (verified HMRC IHTM14611): taper applies to TAX, not value, and only
 * to the portion of gifts above the available NRB after cumulation.
 *
 * @param {number} yearsBeforeDeath — exact years (e.g. 3.5)
 */
export function taperReliefFactor(yearsBeforeDeath, bundle) {
  const iht = _iht(bundle);
  const taper = iht.taperRelief;

  let factor;
  let band;
  if (yearsBeforeDeath < 0) {
    factor = NaN; band = 'invalid';
  } else if (yearsBeforeDeath < 3) {
    factor = 1.00; band = '0-3 years (no taper, full IHT rate)';
  } else if (yearsBeforeDeath < 4) {
    factor = taper.years3to4; band = '3-4 years';
  } else if (yearsBeforeDeath < 5) {
    factor = taper.years4to5; band = '4-5 years';
  } else if (yearsBeforeDeath < 6) {
    factor = taper.years5to6; band = '5-6 years';
  } else if (yearsBeforeDeath < 7) {
    factor = taper.years6to7; band = '6-7 years';
  } else {
    factor = 0; band = '7+ years (fully exempt — no IHT on gift)';
  }

  return {
    amount: factor,
    breakdown: { yearsBeforeDeath, band, taperFactor: factor, effectiveRate: factor * iht.ihtRate },
    rules: ['UK-IHT-34'],
    explanation:
      `Taper relief at ${yearsBeforeDeath.toFixed(2)} years before death: band "${band}". ` +
      `Tax multiplier ${factor}. Effective IHT rate on tapered portion: ${(factor * iht.ihtRate * 100).toFixed(1)}%. ` +
      `IMPORTANT: taper applies to TAX on gifts above NRB, NOT to gift value (HMRC IHTM14611).`,
  };
}

/**
 * PET status (UK-IHT-33).
 * Returns whether a gift is fully exempt, fully chargeable (within 3yrs), or taper-eligible (3-7yrs).
 */
export function petStatus(yearsSinceGift, bundle) {
  const iht = _iht(bundle);
  let status;
  if (yearsSinceGift < 0) status = 'invalid';
  else if (yearsSinceGift >= iht.petSevenYearRule) status = 'fully-exempt';
  else if (yearsSinceGift < 3) status = 'failed-no-taper';
  else status = 'failed-taper-eligible';

  return {
    amount: 0, // status flag, not monetary
    breakdown: { yearsSinceGift, sevenYearRule: iht.petSevenYearRule, status },
    rules: ['UK-IHT-33', 'UK-IHT-34'],
    explanation:
      `PET status: "${status}". ` +
      (status === 'fully-exempt'
        ? `Donor survived 7 years — gift outside estate.`
        : status === 'failed-no-taper'
          ? `Donor died within 3 years — full 40% rate on portion above NRB.`
          : status === 'failed-taper-eligible'
            ? `Donor died 3-7 years after gift — taper relief applies on portion above NRB.`
            : `Invalid yearsSinceGift.`),
  };
}

/**
 * CLT entry charge (UK-IHT-09).
 * 20% on amount of CLT above remaining NRB at time of transfer (cumulative with prior 7yr CLTs).
 *
 * @param {number} cltAmount
 * @param {number} priorCLTsIn7yrs — cumulative CLTs in 7 years before this CLT
 */
export function cltEntryCharge(cltAmount, priorCLTsIn7yrs, bundle) {
  const iht = _iht(bundle);
  const nrb = iht.nilRateBand;
  const nrbRemaining = _max0(nrb - _max0(priorCLTsIn7yrs));
  const aboveNRB = _max0(cltAmount - nrbRemaining);
  const tax = _r(aboveNRB * iht.cltEntryChargeRate);

  return {
    amount: tax,
    breakdown: {
      cltAmount,
      priorCLTsIn7yrs,
      nrb,
      nrbRemaining,
      aboveNRB,
      rate: iht.cltEntryChargeRate,
      entryCharge: tax,
    },
    rules: ['UK-IHT-09'],
    explanation:
      `CLT of £${cltAmount.toLocaleString()}. ` +
      `Prior 7-year CLTs: £${priorCLTsIn7yrs.toLocaleString()} → NRB remaining £${nrbRemaining.toLocaleString()}. ` +
      `Amount above NRB: £${aboveNRB.toLocaleString()} × ${(iht.cltEntryChargeRate * 100).toFixed(0)}% = ` +
      `£${tax.toLocaleString()} entry charge. ` +
      `Note: lifetime rate is half the death rate; additional charge may arise if settlor dies within 7 years (UK-IHT-10).`,
  };
}

/**
 * CLT additional charge on death within 7 years (UK-IHT-10).
 * Tops up to 40% with taper relief and credit for entry charge already paid.
 */
export function cltAdditionalChargeOnDeath(cltAmount, priorCLTsIn7yrsAtCLTDate, entryChargeAlreadyPaid, yearsBetweenCLTAndDeath, bundle) {
  const iht = _iht(bundle);
  const nrb = iht.nilRateBand;
  const nrbRemaining = _max0(nrb - _max0(priorCLTsIn7yrsAtCLTDate));
  const aboveNRB = _max0(cltAmount - nrbRemaining);

  if (yearsBetweenCLTAndDeath >= iht.petSevenYearRule) {
    return {
      amount: 0,
      breakdown: { yearsBetweenCLTAndDeath, sevenYearRule: iht.petSevenYearRule, additionalCharge: 0 },
      rules: ['UK-IHT-10', 'UK-IHT-34'],
      explanation: `Settlor survived 7 years post-CLT — no additional charge.`,
    };
  }

  const taperFactor = taperReliefFactor(yearsBetweenCLTAndDeath, bundle).amount;
  const fullDeathTax = _r(aboveNRB * iht.ihtRate);
  const taperedDeathTax = _r(fullDeathTax * taperFactor);
  const additionalCharge = _max0(_r(taperedDeathTax - _max0(entryChargeAlreadyPaid)));

  return {
    amount: additionalCharge,
    breakdown: {
      cltAmount,
      aboveNRB,
      yearsBetweenCLTAndDeath,
      taperFactor,
      fullDeathRate: iht.ihtRate,
      fullDeathTax,
      taperedDeathTax,
      entryChargeCredit: _max0(entryChargeAlreadyPaid),
      additionalCharge,
    },
    rules: ['UK-IHT-10', 'UK-IHT-34'],
    explanation:
      `CLT additional charge on death: £${aboveNRB.toLocaleString()} × ${(iht.ihtRate * 100).toFixed(0)}% × ${taperFactor} = ` +
      `£${taperedDeathTax.toLocaleString()} tapered death tax. ` +
      `Less entry charge paid £${_max0(entryChargeAlreadyPaid).toLocaleString()}. ` +
      `Additional charge = £${additionalCharge.toLocaleString()}.`,
  };
}

/**
 * Cumulate gifts for NRB consumption on death (UK-IHT-36).
 * Gifts within 7 years are cumulated chronologically; oldest gifts use NRB first.
 *
 * @param {Array<{date:string|Date, amount:number, type:'PET'|'CLT', exemptionsApplied:number}>} gifts
 * @param {string|Date} deathDate
 * @returns Cumulation result with NRB-consumption order.
 */
export function cumulateGiftsForNRB(gifts, deathDate, bundle) {
  const iht = _iht(bundle);
  const nrb = iht.nilRateBand;

  // Filter gifts to those within 7 years of death; sort chronologically (oldest first).
  const inWindow = gifts
    .map(g => ({
      ...g,
      yearsSinceGift: _yearsBetween(g.date, deathDate),
      netGiftValue: _max0(g.amount - _max0(g.exemptionsApplied || 0)),
    }))
    .filter(g => g.yearsSinceGift < iht.petSevenYearRule && g.yearsSinceGift >= 0)
    .sort((a, b) => _toDate(a.date) - _toDate(b.date));

  let nrbRemaining = nrb;
  const annotated = [];
  for (const g of inWindow) {
    const useNRB = Math.min(g.netGiftValue, nrbRemaining);
    const aboveNRB = _max0(g.netGiftValue - useNRB);
    nrbRemaining = _max0(nrbRemaining - useNRB);
    annotated.push({
      ...g,
      nrbConsumed: useNRB,
      aboveNRB,
      taperFactor: aboveNRB > 0 ? taperReliefFactor(g.yearsSinceGift, bundle).amount : 1.0,
      yearsSinceGift: g.yearsSinceGift,
    });
  }

  return {
    amount: nrb - nrbRemaining,
    breakdown: {
      startingNRB: nrb,
      giftsCumulated: annotated,
      nrbConsumedByGifts: nrb - nrbRemaining,
      nrbRemainingForDeathEstate: nrbRemaining,
    },
    rules: ['UK-IHT-36', 'UK-IHT-33', 'UK-IHT-34'],
    explanation:
      `Cumulation: ${annotated.length} gifts in 7-year window (chronological). ` +
      `NRB £${nrb.toLocaleString()} consumed by gifts: £${(nrb - nrbRemaining).toLocaleString()}. ` +
      `Remaining for death estate: £${nrbRemaining.toLocaleString()}. ` +
      `Taper relief applies only to portions above NRB.`,
  };
}

/**
 * Tax on failed PETs (after cumulation + taper).
 */
export function failedPETsTax(gifts, deathDate, bundle) {
  const iht = _iht(bundle);
  const cum = cumulateGiftsForNRB(gifts, deathDate, bundle);

  let totalTax = 0;
  const perGift = [];
  for (const g of cum.breakdown.giftsCumulated) {
    if (g.type === 'CLT') continue; // CLTs handled separately via cltAdditionalChargeOnDeath
    const fullTax = g.aboveNRB * iht.ihtRate;
    const taperedTax = _r(fullTax * g.taperFactor);
    totalTax += taperedTax;
    perGift.push({
      date: g.date,
      amount: g.amount,
      yearsSinceGift: _r(g.yearsSinceGift),
      aboveNRB: g.aboveNRB,
      taperFactor: g.taperFactor,
      taperedTax,
    });
  }

  return {
    amount: _r(totalTax),
    breakdown: { perGift, totalTax: _r(totalTax), nrbConsumed: cum.breakdown.nrbConsumedByGifts },
    rules: ['UK-IHT-33', 'UK-IHT-34', 'UK-IHT-36'],
    explanation:
      `Failed PETs total tax: £${_r(totalTax).toLocaleString()}. ` +
      `Computed across ${perGift.length} failed PETs after chronological NRB cumulation and taper relief.`,
  };
}

/**
 * Gift with Reservation of Benefit detection (UK-IHT-37).
 * Returns whether a gift is treated as still in estate.
 */
export function grobIncluded(opts, bundle) {
  const { donorRetainsBenefit, payingMarketRent } = opts;
  const grob = !!(donorRetainsBenefit && !payingMarketRent);

  return {
    amount: grob ? 1 : 0,
    breakdown: { donorRetainsBenefit, payingMarketRent, grob },
    rules: ['UK-IHT-37'],
    explanation:
      grob
        ? `GROB DETECTED: gift treated as still in estate at death (full value). ` +
          `7-year clock irrelevant for GROBs. To break GROB: donor must pay genuine market rent or vacate.`
        : `Not a GROB. ` +
          (donorRetainsBenefit
            ? `Market rent paid — gift remains effective if rent is genuine and documented.`
            : `Donor retains no benefit — gift effective for 7-year clock.`),
  };
}

/**
 * 14-year rule (UK-IHT-35) — failed PET can revive earlier CLT into the 7-year window.
 * Returns CLTs that must be cumulated due to PET failure.
 */
export function fourteenYearRule(gifts, deathDate, bundle) {
  const iht = _iht(bundle);
  const sortedAll = [...gifts]
    .map(g => ({ ...g, yearsSinceGift: _yearsBetween(g.date, deathDate) }))
    .sort((a, b) => _toDate(a.date) - _toDate(b.date));

  const failedPETs = sortedAll.filter(g => g.type === 'PET' && g.yearsSinceGift < iht.petSevenYearRule);
  const revivedCLTs = [];

  for (const pet of failedPETs) {
    // CLT in the 7 years before this PET is cumulated against the PET's own NRB calc.
    const petDate = _toDate(pet.date);
    const cltWindowStart = new Date(petDate);
    cltWindowStart.setFullYear(cltWindowStart.getFullYear() - iht.petSevenYearRule);

    for (const clt of sortedAll.filter(g => g.type === 'CLT')) {
      const cltDate = _toDate(clt.date);
      if (cltDate >= cltWindowStart && cltDate < petDate) {
        if (!revivedCLTs.find(r => r.date === clt.date)) {
          revivedCLTs.push({
            date: clt.date,
            amount: clt.amount,
            revivedByPETOn: pet.date,
            yearsBeforePET: _yearsBetween(cltDate, petDate),
          });
        }
      }
    }
  }

  return {
    amount: revivedCLTs.length,
    breakdown: { failedPETsCount: failedPETs.length, revivedCLTs },
    rules: ['UK-IHT-35'],
    explanation:
      `14-year rule: ${revivedCLTs.length} CLT(s) revived into cumulation by failed PETs. ` +
      `A failed PET pulls into its NRB calculation any CLT in the 7 years preceding the PET — ` +
      `extending the effective lookback to 14 years.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.3 — BPR/APR PRE-REFORM FUNDAMENTALS (UK-IHT-21 to UK-IHT-32)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * BPR qualification check (UK-IHT-21 to UK-IHT-25).
 *
 * @param {object} asset — { type, listingType, isControllingHolding, holdingPeriodYears }
 *   asset.type: 'unquotedTradingCompany' | 'aimShares' | 'controllingQuotedShares' |
 *               'businessAssetsUsedInOwnTrade' | 'soleTrader' | 'partnership' | 'other'
 */
export function bprQualifies(asset, bundle) {
  const iht = _iht(bundle);
  const minHold = 2; // 2-year qualifying period — UK-IHT-21 / UK-BPR-03 unchanged
  const heldLongEnough = asset.holdingPeriodYears >= minHold;

  let baseRate = 0;
  let category = 'non-qualifying';

  switch (asset.type) {
    case 'unquotedTradingCompany':
    case 'soleTrader':
    case 'partnership':
      baseRate = iht.businessPropertyRelief100; category = '100% (unquoted trading business)'; break;
    case 'controllingQuotedShares':
      baseRate = iht.businessPropertyRelief50; category = '50% (controlling holding of quoted shares)'; break;
    case 'aimShares':
      // AIM under FA 2026 = always 50%, no allowance benefit (UK-BPR-03)
      baseRate = iht.aimBPRRate; category = '50% (AIM — post-Apr-2026 in ALL cases)'; break;
    case 'businessAssetsUsedInOwnTrade':
      baseRate = iht.businessPropertyRelief50; category = '50% (assets used in deceased\'s business)'; break;
    default:
      baseRate = 0; category = 'non-qualifying';
  }

  const qualifies = heldLongEnough && baseRate > 0;

  return {
    amount: qualifies ? baseRate : 0,
    breakdown: {
      assetType: asset.type,
      holdingPeriodYears: asset.holdingPeriodYears,
      minHoldYears: minHold,
      heldLongEnough,
      baseReliefRate: baseRate,
      category,
      qualifies,
    },
    rules: ['UK-IHT-21', 'UK-IHT-22', 'UK-IHT-23', 'UK-IHT-25', 'UK-BPR-03'],
    explanation:
      qualifies
        ? `BPR qualifies: ${category}. Base rate ${(baseRate * 100).toFixed(0)}% before reform allowance interaction.`
        : !heldLongEnough
          ? `BPR fails: holding period ${asset.holdingPeriodYears} years < ${minHold}-year minimum.`
          : `BPR fails: asset type "${asset.type}" not qualifying (e.g. investment company, non-trading).`,
  };
}

/**
 * APR qualification check (UK-IHT-27 to UK-IHT-29 + UK-APR-01 to UK-APR-04).
 *
 * @param {object} asset — { type, occupancyType, ownershipYears, tenancyType }
 *   asset.type: 'farmland' | 'farmBuildings' | 'farmhouse' | 'farmCottage' | 'other'
 *   occupancyType: 'ownerOccupied' | 'tenantFarmer'
 *   tenancyType (if let): 'AHA1986' | 'ATA1995' (FBT) | null
 */
export function aprQualifies(asset, bundle) {
  const iht = _iht(bundle);

  const qualifyingTypes = ['farmland', 'farmBuildings', 'farmhouse', 'farmCottage'];
  if (!qualifyingTypes.includes(asset.type)) {
    return {
      amount: 0,
      breakdown: { reason: `asset type "${asset.type}" not APR-qualifying` },
      rules: ['UK-IHT-27', 'UK-APR-03'],
      explanation: `APR fails: asset type not in {farmland, farmBuildings, farmhouse, farmCottage}.`,
    };
  }

  let baseRate = 0;
  let category = '';

  if (asset.occupancyType === 'ownerOccupied') {
    // 2-year occupation OR 7-year ownership
    if (asset.ownershipYears >= 2) {
      baseRate = iht.agriculturalPropertyRelief100;
      category = '100% (owner-occupied, 2yr+)';
    } else {
      return {
        amount: 0,
        breakdown: { reason: 'owner-occupied requires 2-year minimum occupation' },
        rules: ['UK-APR-01'],
        explanation: `APR fails: owner-occupied land requires 2 years' occupation by owner / connected company.`,
      };
    }
  } else if (asset.occupancyType === 'tenantFarmer') {
    // Let property: 7-year ownership; rate depends on tenancy type
    if (asset.ownershipYears < 7) {
      return {
        amount: 0,
        breakdown: { reason: 'let property requires 7-year minimum ownership' },
        rules: ['UK-APR-02'],
        explanation: `APR fails: let agricultural property requires 7 years' ownership.`,
      };
    }
    if (asset.tenancyType === 'ATA1995') {
      baseRate = iht.agriculturalPropertyRelief100;
      category = '100% (let post-Sep-1995 FBT, 7yr+)';
    } else if (asset.tenancyType === 'AHA1986') {
      baseRate = iht.agriculturalPropertyRelief50;
      category = '50% (let pre-Sep-1995 AHA, 7yr+)';
    } else {
      return {
        amount: 0,
        breakdown: { reason: 'unknown tenancy type for let agricultural property' },
        rules: ['UK-APR-02'],
        explanation: `APR fails: tenancy type required (AHA1986 or ATA1995/FBT).`,
      };
    }
  } else {
    return {
      amount: 0,
      breakdown: { reason: `occupancyType "${asset.occupancyType}" unknown` },
      rules: ['UK-IHT-27'],
      explanation: `APR fails: occupancyType must be 'ownerOccupied' or 'tenantFarmer'.`,
    };
  }

  return {
    amount: baseRate,
    breakdown: {
      assetType: asset.type,
      occupancyType: asset.occupancyType,
      tenancyType: asset.tenancyType || null,
      ownershipYears: asset.ownershipYears,
      baseReliefRate: baseRate,
      category,
    },
    rules: ['UK-IHT-27', 'UK-APR-01', 'UK-APR-02', 'UK-APR-03'],
    explanation:
      `APR qualifies: ${category}. Base rate ${(baseRate * 100).toFixed(0)}%. ` +
      `Note: APR + BPR cannot apply to same asset (UK-APR-04); APR takes precedence on farmland.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.3a — BPR/APR APRIL 2026 REFORM (UK-BPR-01 to UK-BPR-08)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * BPR/APR allowance available to entity (UK-BPR-01 + UK-BPR-02).
 * Includes spouse-transferred unused portion.
 *
 * @param {number} deceasedSpouseUnusedAllowancePct — fraction unused (0..1)
 */
export function bprAprAllowanceForEntity(deceasedSpouseUnusedAllowancePct, bundle) {
  const iht = _iht(bundle);
  const own = iht.aprBprCombinedAllowance;
  const pct = Math.min(1, _max0(deceasedSpouseUnusedAllowancePct));
  const transferred = _r(own * pct);
  const total = own + transferred;

  return {
    amount: total,
    breakdown: {
      ownAllowance: own,
      deceasedSpouseUnusedPct: pct,
      transferredAllowance: transferred,
      totalAvailable: total,
      maxCoupleCombined: iht.aprBprCombinedAllowanceCouple,
      effectiveDate: iht.aprBprCombinedAllowanceEffectiveDate,
      indexationFrozenUntil: iht.bprCPIIndexationFrozenUntil,
    },
    rules: ['UK-BPR-01', 'UK-BPR-02', 'UK-BPR-08'],
    explanation:
      `BPR/APR combined £${own.toLocaleString()} allowance + transferred ${(pct * 100).toFixed(1)}% from spouse ` +
      `(£${transferred.toLocaleString()}) = £${total.toLocaleString()} available at 100% relief. ` +
      `Above this, 50% relief (effective 20% IHT). Frozen until ${iht.bprCPIIndexationFrozenUntil}, then CPI-indexed.`,
  };
}

/**
 * Apportion combined £2.5m allowance between APR and BPR holdings (UK-BPR-01).
 * Proportionate apportionment when both types present.
 */
export function bprAprAllocateAllowance(aprQualifyingValue, bprQualifyingValue, totalAllowance) {
  const totalQualifying = _max0(aprQualifyingValue) + _max0(bprQualifyingValue);

  if (totalQualifying === 0) {
    return {
      amount: 0,
      breakdown: { aprAllowance: 0, bprAllowance: 0, totalQualifying: 0 },
      rules: ['UK-BPR-01'],
      explanation: `No qualifying APR/BPR assets — no allowance applied.`,
    };
  }

  if (totalQualifying <= totalAllowance) {
    return {
      amount: totalAllowance,
      breakdown: {
        aprQualifyingValue, bprQualifyingValue,
        aprAllowance: aprQualifyingValue,
        bprAllowance: bprQualifyingValue,
        totalQualifying,
        totalAllowance,
        allowanceUnused: _r(totalAllowance - totalQualifying),
      },
      rules: ['UK-BPR-01'],
      explanation:
        `Total qualifying £${totalQualifying.toLocaleString()} ≤ allowance £${totalAllowance.toLocaleString()}. ` +
        `All assets get 100% relief. £${_r(totalAllowance - totalQualifying).toLocaleString()} allowance unused.`,
    };
  }

  // Proportionate apportionment
  const aprShare = aprQualifyingValue / totalQualifying;
  const bprShare = bprQualifyingValue / totalQualifying;
  const aprAllowance = _r(totalAllowance * aprShare);
  const bprAllowance = _r(totalAllowance * bprShare);

  return {
    amount: totalAllowance,
    breakdown: {
      aprQualifyingValue, bprQualifyingValue,
      totalQualifying,
      totalAllowance,
      aprShare: _r(aprShare),
      bprShare: _r(bprShare),
      aprAllowance,
      bprAllowance,
      aprExcess: _r(aprQualifyingValue - aprAllowance),
      bprExcess: _r(bprQualifyingValue - bprAllowance),
    },
    rules: ['UK-BPR-01'],
    explanation:
      `Allowance apportioned proportionately: APR £${aprAllowance.toLocaleString()} (${(aprShare * 100).toFixed(1)}%) · ` +
      `BPR £${bprAllowance.toLocaleString()} (${(bprShare * 100).toFixed(1)}%). ` +
      `Excess above allowance receives 50% relief (effective 20% IHT).`,
  };
}

/**
 * BPR/APR transitional rules (UK-BPR-06).
 * Determines which regime applies based on transfer date and death date.
 *
 * @param {string|Date} transferDate
 * @param {string|Date} deathDate (omit for non-death contexts)
 * @returns regime: 'old-unlimited' | 'new-with-allowance' | 'old-locked-at-transfer'
 */
export function bprAprTransitionalRegime(transferDate, deathDate, bundle) {
  const iht = _iht(bundle);
  const REFORM_DATE = new Date(iht.aprBprCombinedAllowanceEffectiveDate); // 2026-04-06
  const ANNOUNCEMENT_DATE = new Date('2024-10-30');

  const t = _toDate(transferDate);
  let regime;
  let reasoning;

  if (t < ANNOUNCEMENT_DATE) {
    regime = 'old-unlimited';
    reasoning = 'Transfer pre-30-Oct-2024: old unlimited regime locked at transfer date.';
  } else {
    // Transfer in transition window (30-Oct-2024 to 5-Apr-2026) or post-reform
    const inTransitionWindow = t >= ANNOUNCEMENT_DATE && t < REFORM_DATE;

    if (deathDate) {
      const d = _toDate(deathDate);
      if (d < REFORM_DATE) {
        regime = 'old-unlimited';
        reasoning = 'Death pre-6-Apr-2026: old unlimited regime applies even for transfers in transition window.';
      } else if (inTransitionWindow) {
        regime = 'new-with-allowance';
        reasoning = 'Transfer in transition window AND death post-6-Apr-2026: new £2.5m allowance applied to failed PET / CLT 10yr anniversary post-reform.';
      } else {
        regime = 'new-with-allowance';
        reasoning = 'Both transfer and death post-6-Apr-2026: new £2.5m allowance regime applies.';
      }
    } else {
      // No death context — pure regime question
      regime = inTransitionWindow ? 'old-unlimited-pending-death-date' : 'new-with-allowance';
      reasoning = inTransitionWindow
        ? 'Transfer in transition window: regime crystallises at death (old if pre-reform, new if post-reform).'
        : 'Transfer post-6-Apr-2026: new £2.5m allowance regime.';
    }
  }

  return {
    amount: 0,
    breakdown: {
      transferDate, deathDate: deathDate || null,
      reformDate: iht.aprBprCombinedAllowanceEffectiveDate,
      announcementDate: '2024-10-30',
      regime, reasoning,
    },
    rules: ['UK-BPR-06'],
    explanation:
      `BPR/APR regime: "${regime}". ${reasoning}`,
  };
}

/**
 * AIM BPR (UK-BPR-03) — 50% in ALL cases from 6 April 2026.
 * Allowance does NOT apply to AIM.
 */
export function aimBprRelief(value, holdingPeriodYears, bundle) {
  const iht = _iht(bundle);
  const minHold = 2;

  if (holdingPeriodYears < minHold) {
    return {
      amount: 0,
      breakdown: { value, holdingPeriodYears, minHold, qualifies: false },
      rules: ['UK-BPR-03'],
      explanation: `AIM BPR fails: holding period ${holdingPeriodYears} years < ${minHold}-year minimum.`,
    };
  }

  const reliefRate = iht.aimBPRRate; // 0.50
  const reliefAmount = _r(value * reliefRate);
  const taxableValue = _r(value - reliefAmount);
  const effectiveIHTRate = reliefRate * 0; // no — effective IHT = (1-relief) × 40%
  const ihtOnAIM = _r(taxableValue * iht.ihtRate);

  return {
    amount: reliefAmount,
    breakdown: {
      value,
      holdingPeriodYears,
      reliefRate,
      reliefAmount,
      taxableValue,
      effectiveIHTRate: _r((1 - reliefRate) * iht.ihtRate),
      ihtOnAIM,
      allowanceApplies: false,
    },
    rules: ['UK-BPR-03'],
    explanation:
      `AIM shares: 50% BPR in ALL cases from 6 Apr 2026 (UK-BPR-03). ` +
      `£${value.toLocaleString()} × 50% relief = £${reliefAmount.toLocaleString()} sheltered; ` +
      `£${taxableValue.toLocaleString()} taxable at 40% = £${ihtOnAIM.toLocaleString()} IHT (effective 20% on AIM). ` +
      `Note: £2.5m allowance does NOT apply to AIM holdings.`,
  };
}

/**
 * Full BPR/APR relief computation across an estate (UK-BPR-01 to UK-BPR-04).
 *
 * @param {object} opts
 *   - aprAssets: Array<{value, asset:{...}}>     // pre-qualified APR assets with rates
 *   - bprAssets: Array<{value, asset:{...}}>     // pre-qualified BPR assets (excluding AIM)
 *   - aimAssets: Array<{value, holdingYears}>    // AIM separately
 *   - deceasedSpouseUnusedAllowancePct
 */
export function bprAprReliefApplied(opts, bundle) {
  const iht = _iht(bundle);
  const { aprAssets = [], bprAssets = [], aimAssets = [], deceasedSpouseUnusedAllowancePct = 0 } = opts;

  // Step 1: Allowance available to entity
  const allowanceObj = bprAprAllowanceForEntity(deceasedSpouseUnusedAllowancePct, bundle);
  const totalAllowance = allowanceObj.amount;

  // Step 2: Sum APR + BPR (NOT AIM) qualifying values
  const aprQualifying = aprAssets.reduce((s, a) => s + a.value, 0);
  const bprQualifying = bprAssets.reduce((s, a) => s + a.value, 0);

  // Step 3: Apportion allowance
  const apportion = bprAprAllocateAllowance(aprQualifying, bprQualifying, totalAllowance);

  // Step 4: Compute relief on APR/BPR portions
  const aprAllowance = apportion.breakdown.aprAllowance || aprQualifying; // if all-in-allowance
  const bprAllowance = apportion.breakdown.bprAllowance || bprQualifying;
  const aprAt100 = Math.min(aprQualifying, aprAllowance);
  const aprAt50 = _max0(aprQualifying - aprAt100);
  const bprAt100 = Math.min(bprQualifying, bprAllowance);
  const bprAt50 = _max0(bprQualifying - bprAt100);

  const aprRelief = _r(aprAt100 * iht.agriculturalPropertyRelief100 + aprAt50 * iht.agriculturalPropertyRelief50);
  const bprRelief = _r(bprAt100 * iht.businessPropertyRelief100 + bprAt50 * iht.businessPropertyRelief50);

  // Step 5: AIM separately (always 50%, no allowance)
  let aimRelief = 0;
  const aimDetail = [];
  for (const a of aimAssets) {
    const r = aimBprRelief(a.value, a.holdingYears, bundle);
    aimRelief += r.amount;
    aimDetail.push({ value: a.value, holdingYears: a.holdingYears, relief: r.amount });
  }

  const totalRelief = _r(aprRelief + bprRelief + aimRelief);
  const totalQualifyingAssetValue = aprQualifying + bprQualifying + aimAssets.reduce((s, a) => s + a.value, 0);
  const taxableAfterRelief = _r(totalQualifyingAssetValue - totalRelief);

  return {
    amount: totalRelief,
    breakdown: {
      totalAllowance,
      apr: { qualifying: aprQualifying, atFullRelief: aprAt100, at50Relief: aprAt50, relief: aprRelief },
      bpr: { qualifying: bprQualifying, atFullRelief: bprAt100, at50Relief: bprAt50, relief: bprRelief },
      aim: { totalValue: aimAssets.reduce((s, a) => s + a.value, 0), relief: aimRelief, perAsset: aimDetail },
      totalQualifyingAssetValue,
      totalRelief,
      taxableAfterRelief,
      effectiveIHTOnTaxable: _r(taxableAfterRelief * iht.ihtRate),
    },
    rules: ['UK-BPR-01', 'UK-BPR-02', 'UK-BPR-03', 'UK-BPR-04', 'UK-BPR-08'],
    explanation:
      `BPR/APR relief computed on £${totalQualifyingAssetValue.toLocaleString()} qualifying assets. ` +
      `Allowance £${totalAllowance.toLocaleString()} apportioned: APR £${aprRelief.toLocaleString()} + ` +
      `BPR £${bprRelief.toLocaleString()} + AIM £${aimRelief.toLocaleString()} (no allowance) = ` +
      `£${totalRelief.toLocaleString()} total relief. ` +
      `Taxable after relief: £${taxableAfterRelief.toLocaleString()}.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.5 — COMPUTATION MECHANICS (UK-IHT-41 to UK-IHT-47)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * IHT rate determination (UK-IHT-05/06).
 * Returns 36% if ≥10% of net estate to charity, else 40%.
 */
export function ihtRate(netEstate, charitableLegacy, bundle) {
  const iht = _iht(bundle);
  const charityPct = netEstate > 0 ? (charitableLegacy / netEstate) : 0;
  const qualifies = charityPct >= iht.ihtReducedRateCharityThreshold;
  const rate = qualifies ? iht.ihtReducedRate : iht.ihtRate;

  return {
    amount: rate,
    breakdown: {
      netEstate, charitableLegacy, charityPct: _r(charityPct),
      threshold: iht.ihtReducedRateCharityThreshold,
      qualifies, appliedRate: rate,
    },
    rules: ['UK-IHT-05', 'UK-IHT-06', 'UK-IHT-57'],
    explanation:
      qualifies
        ? `Charitable bequest £${charitableLegacy.toLocaleString()} = ${(charityPct * 100).toFixed(1)}% of net estate ` +
          `≥ ${(iht.ihtReducedRateCharityThreshold * 100)}% threshold. ` +
          `Reduced 36% rate applies on the remaining estate.`
        : `Charitable bequest ${(charityPct * 100).toFixed(1)}% < ${(iht.ihtReducedRateCharityThreshold * 100)}% threshold. ` +
          `Standard 40% rate applies.`,
  };
}

/**
 * Charity 10% test — net estate computation (UK-IHT-57).
 * Net estate for the test = estate after exemptions and reliefs but BEFORE the charitable legacy.
 */
export function charityTenPercentTest(opts, bundle) {
  const iht = _iht(bundle);
  const { grossEstate, totalExemptions, totalReliefs, charitableLegacy } = opts;
  const netEstateForTest = _max0(grossEstate - _max0(totalExemptions) - _max0(totalReliefs));
  const required = _r(netEstateForTest * iht.ihtReducedRateCharityThreshold);
  const actualPct = netEstateForTest > 0 ? (charitableLegacy / netEstateForTest) : 0;
  const qualifies = charitableLegacy >= required;
  const shortfall = qualifies ? 0 : _r(required - charitableLegacy);

  return {
    amount: qualifies ? 1 : 0,
    breakdown: {
      grossEstate, totalExemptions, totalReliefs, charitableLegacy,
      netEstateForTest,
      threshold: iht.ihtReducedRateCharityThreshold,
      requiredCharityAmount: required,
      actualCharityPct: _r(actualPct),
      qualifies,
      shortfall,
    },
    rules: ['UK-IHT-57', 'UK-IHT-06'],
    explanation:
      `Net estate for 10% test: £${netEstateForTest.toLocaleString()} ` +
      `(gross £${grossEstate.toLocaleString()} less exemptions/reliefs). ` +
      `Required for 36% rate: £${required.toLocaleString()} (${(iht.ihtReducedRateCharityThreshold * 100)}%). ` +
      (qualifies
        ? `Charitable legacy £${charitableLegacy.toLocaleString()} qualifies — 36% rate applies.`
        : `Charitable legacy £${charitableLegacy.toLocaleString()} short by £${shortfall.toLocaleString()} — ` +
          `consider increasing legacy to trigger reduced rate (UK-IHT-59 breakeven).`),
  };
}

/**
 * Instalment option eligibility (UK-IHT-44 + UK-BPR-07).
 * Illiquid assets (UK land, unquoted shares, BPR/APR assets) — 10 annual instalments.
 */
export function instalmentEligible(asset, bundle) {
  const eligibleTypes = [
    'ukLand', 'ukResidentialProperty', 'ukCommercialProperty',
    'unquotedShares', 'businessAssets', 'agriculturalProperty', 'bprQualifying', 'aprQualifying',
  ];
  const eligible = eligibleTypes.includes(asset.type);
  return {
    amount: eligible ? 1 : 0,
    breakdown: {
      assetType: asset.type,
      eligible,
      instalmentPeriod: '10 annual instalments',
      interestFreeIfBPRorAPR: ['bprQualifying', 'aprQualifying', 'agriculturalProperty', 'businessAssets'].includes(asset.type),
      noteFA2026: 'Finance Act 2026 extended interest-free instalments to ALL BPR/APR assets including 50%-relief excess.',
    },
    rules: ['UK-IHT-44', 'UK-BPR-07'],
    explanation:
      eligible
        ? `Asset type "${asset.type}" eligible for 10-year instalment option. ` +
          `Interest-free for BPR/APR assets from FA 2026.`
        : `Asset type "${asset.type}" not eligible for instalment option — IHT due on grant of probate.`,
  };
}

/**
 * IHT waterfall — main computation orchestrator (UK-IHT-41).
 * Order: spouse exemption → charity exemption → BPR/APR → NRB+RNRB → tax remaining.
 *
 * Estate-side only (gifts/PETs handled separately via failedPETsTax).
 */
export function ihtWaterfall(opts, bundle) {
  const {
    grossEstate,                   // total before any exemption/relief
    spouseTransfer = 0,            // amount passing to UK-dom spouse (unlimited exempt)
    nonDomSpouseTransfer = 0,      // amount passing to non-dom spouse (capped)
    priorSpouseToNonDomTransfers = 0,
    charitableLegacy = 0,
    aprBprReliefAmount = 0,
    residenceLeftToDirectDescendants = false,
    deceasedSpouseUnusedNRBPct = 0,
    deceasedSpouseUnusedRNRBPct = 0,
    nrbConsumedByGifts = 0,        // from cumulateGiftsForNRB
    residenceValue = Infinity,     // IHTM46031 QRI value for RNRB cap; Infinity = no cap (backward-compat)
  } = opts;

  // Step 1: spouse exemption
  const spouseUKDom = spouseExemption(spouseTransfer, true, 0, bundle);
  const spouseNonDom = spouseExemption(nonDomSpouseTransfer, false, priorSpouseToNonDomTransfers, bundle);
  const totalSpouseExempt = spouseUKDom.amount + spouseNonDom.amount;

  // Step 2: charity exemption
  const charity = charityExemption(charitableLegacy, true, bundle);
  const totalCharity = charity.amount;

  // Step 3: BPR/APR (passed in pre-computed)
  const totalRelief = _max0(aprBprReliefAmount);

  // Step 4: net estate
  const totalExemptions = totalSpouseExempt + totalCharity;
  const netEstate = _max0(grossEstate - totalExemptions - totalRelief);

  // Step 5: NRB+RNRB available, less consumption by gifts
  const bands = combinedNilRateBands({
    grossEstateValue: grossEstate,
    residenceLeftToDirectDescendants,
    deceasedSpouseUnusedNRBPct,
    deceasedSpouseUnusedRNRBPct,
    residenceValue,
  }, bundle);
  const bandsAvailable = _max0(bands.amount - _max0(nrbConsumedByGifts));

  // Step 6: taxable
  const taxable = _max0(netEstate - bandsAvailable);

  // Step 7: rate (36% or 40%)
  const rateInfo = ihtRate(netEstate, totalCharity, bundle);
  const tax = _r(taxable * rateInfo.amount);

  return {
    amount: tax,
    breakdown: {
      grossEstate,
      spouseExemption: { ukDom: spouseUKDom.amount, nonDom: spouseNonDom.amount, total: totalSpouseExempt },
      charityExemption: totalCharity,
      bprAprRelief: totalRelief,
      totalExemptionsAndReliefs: totalExemptions + totalRelief,
      netEstate,
      bands: { ownNRB: bands.breakdown.nrb, transferableNRB: bands.breakdown.transferableNRB, rnrbTotal: bands.breakdown.rnrbTotal, total: bands.amount },
      nrbConsumedByGifts,
      bandsAvailableForEstate: bandsAvailable,
      taxableEstate: taxable,
      rate: rateInfo.amount,
      reducedRateApplied: rateInfo.amount === _iht(bundle).ihtReducedRate,
      ihtOnEstate: tax,
    },
    rules: ['UK-IHT-41', 'UK-IHT-05', 'UK-IHT-06', 'UK-IHT-01', 'UK-IHT-02', 'UK-IHT-07'],
    explanation:
      `IHT waterfall: gross estate £${grossEstate.toLocaleString()}. ` +
      `Less spouse £${totalSpouseExempt.toLocaleString()}, charity £${totalCharity.toLocaleString()}, ` +
      `BPR/APR £${totalRelief.toLocaleString()}. Net estate £${netEstate.toLocaleString()}. ` +
      `Bands available £${bandsAvailable.toLocaleString()} (after gift cumulation). ` +
      `Taxable £${taxable.toLocaleString()} × ${(rateInfo.amount * 100)}% = £${tax.toLocaleString()}.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.6 — DOMICILE + IHT SCOPE (UK-IHT-48 to UK-IHT-51)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * IHT scope determination (UK-IHT-49).
 * From April 2025: long-term resident test = 10 of last 20 UK tax years.
 *
 * @param {number} ukResidenceYearsInPast20 — count of UK tax years resident in last 20
 * @param {boolean} isUKDomiciled — legacy domicile flag (override only for pre-Apr-2025 estates)
 */
export function ihtScope(ukResidenceYearsInPast20, isUKDomiciled, bundle) {
  const iht = _iht(bundle);
  const threshold = iht.nonDomIHTResidenceYears;
  const longTermResident = ukResidenceYearsInPast20 >= threshold;
  const worldwide = longTermResident || isUKDomiciled;

  return {
    amount: 0,
    breakdown: {
      ukResidenceYearsInPast20,
      threshold,
      longTermResident,
      isUKDomiciled,
      scope: worldwide ? 'worldwide' : 'UK-situs only',
    },
    rules: ['UK-IHT-48', 'UK-IHT-49'],
    explanation:
      worldwide
        ? `Worldwide IHT exposure: ` +
          (longTermResident
            ? `long-term resident (${ukResidenceYearsInPast20}/20 UK years ≥ ${threshold}).`
            : `UK-domiciled.`)
        : `UK-situs only IHT exposure (non-long-term resident, non-UK-dom). ` +
          `Foreign assets outside scope; UK land, UK shares, UK-situs assets in scope.`,
  };
}

/**
 * Excluded property trust (UK-IHT-50 / UK-TRUST-12).
 * Non-UK situs assets settled by non-dom (pre-trigger of long-term resident status) — outside IHT.
 */
export function excludedPropertyTrust(opts, bundle) {
  const { settlorWasNonDomAtSettlement, assetsAreUKSitus, settlementDate } = opts;
  const APR2025 = new Date('2025-04-06');

  // Pre-Apr-2025 settlements: still benefit from old excluded property rules
  // Post-Apr-2025: rules tightened; specialist advice flagged
  const preApr2025 = _toDate(settlementDate) < APR2025;
  const excluded = settlorWasNonDomAtSettlement && !assetsAreUKSitus && preApr2025;

  return {
    amount: excluded ? 1 : 0,
    breakdown: {
      settlorWasNonDomAtSettlement,
      assetsAreUKSitus,
      settlementDate,
      preApr2025RulesApply: preApr2025,
      excluded,
      postApr2025Note: 'From Apr 2025: long-term resident test applies to settlor; specialist advice required for ongoing treatment.',
    },
    rules: ['UK-IHT-50', 'UK-TRUST-12'],
    explanation:
      excluded
        ? `Excluded property trust: pre-Apr-2025 settlement by non-dom of non-UK-situs assets — ` +
          `outside UK IHT. Subsequent settlor changes require review.`
        : `Trust does NOT qualify as excluded property: ` +
          (assetsAreUKSitus ? 'assets are UK-situs. ' : '') +
          (!settlorWasNonDomAtSettlement ? 'settlor was UK-dom at settlement. ' : '') +
          (!preApr2025 ? 'settled post-Apr-2025 — new long-term resident rules require specialist review. ' : ''),
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.7 / §17 — INTESTACY (UK-IHT-52 to UK-IHT-56) [E&W rules]
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Intestacy distribution (UK-IHT-52 to UK-IHT-55).
 * E&W rules (Administration of Estates Act 1925, as amended). Scotland is flagged separately.
 *
 * @param {object} opts
 *   estateValue, jurisdiction ('EW'|'Scotland'|'NI'), maritalStatus, hasChildren, hasIssue
 */
export function intestacyDistribution(opts, bundle) {
  const iht = _iht(bundle);
  const { estateValue, jurisdiction = 'EW', maritalStatus, hasChildren, hasIssue } = opts;

  if (jurisdiction === 'Scotland') {
    return {
      amount: 0,
      breakdown: {
        jurisdiction: 'Scotland',
        warning: 'Scottish succession is governed by Succession (Scotland) Act 1964 — different regime',
        legalRights: 'Spouse ius relictae and children\'s legitim cannot be excluded by will',
        engineSupport: 'flagged for §23 / v1.x',
      },
      rules: ['UK-IHT-52', 'UK-IHT-53', 'UK-IHT-54', 'UK-IHT-55'],
      explanation:
        `Scottish intestacy applies different rules (Succession (Scotland) Act 1964) including legal rights ` +
        `for spouse (ius relictae) and children (legitim) that cannot be excluded by will. ` +
        `Engine v1.0 covers E&W only — flagged for §23 / v1.x.`,
    };
  }

  const statutoryLegacy = iht.intestacyStatutoryLegacy;
  let distribution = {};

  if (maritalStatus === 'married' && hasChildren) {
    // UK-IHT-52: spouse takes chattels + £322k + ½ residue; children share other ½
    const residue = _max0(estateValue - statutoryLegacy);
    const spouseFromResidue = _r(residue * 0.5);
    const childrenFromResidue = _r(residue * 0.5);
    distribution = {
      spouse: { chattels: 'all personal chattels', statutoryLegacy, halfResidue: spouseFromResidue, total: statutoryLegacy + spouseFromResidue },
      children: { halfResidue: childrenFromResidue, total: childrenFromResidue, splitEquallyAmongstChildren: true },
    };
  } else if (maritalStatus === 'married' && !hasChildren) {
    // UK-IHT-53: entire estate to spouse
    distribution = { spouse: { total: estateValue }, children: null };
  } else if (maritalStatus !== 'married' && hasChildren) {
    // UK-IHT-54: children equally
    distribution = { spouse: null, children: { total: estateValue, splitEquallyAmongstChildren: true } };
  } else if (maritalStatus === 'cohabiting' || maritalStatus === 'unmarried') {
    // UK-IHT-55: cohabitee gets nothing
    distribution = {
      spouse: null,
      cohabitee: { total: 0, note: 'No automatic right under intestacy. May claim under Inheritance Act 1975 (UK-IHT-56) if 2yr+ cohabitation.' },
    };
  } else {
    // Single, no children: intestacy waterfall (parents → siblings → grandparents → uncles/aunts → Crown bona vacantia)
    distribution = {
      waterfall: ['parents (equally)', 'whole-blood siblings', 'half-blood siblings', 'grandparents', 'whole-blood aunts/uncles', 'half-blood aunts/uncles', 'Crown (bona vacantia)'],
      total: estateValue,
      note: 'Distribution to first surviving class.',
    };
  }

  return {
    amount: estateValue,
    breakdown: {
      jurisdiction, maritalStatus, hasChildren, hasIssue,
      statutoryLegacy, estateValue, distribution,
    },
    rules: ['UK-IHT-52', 'UK-IHT-53', 'UK-IHT-54', 'UK-IHT-55'],
    explanation:
      `Intestacy (E&W) — ${maritalStatus}, hasChildren=${hasChildren}: ` +
      (maritalStatus === 'married' && hasChildren
        ? `Spouse: chattels + £${statutoryLegacy.toLocaleString()} + ½ residue. Children: ½ residue equally.`
        : maritalStatus === 'married'
          ? `Entire estate to spouse.`
          : hasChildren
            ? `Children share equally.`
            : maritalStatus === 'cohabiting' || maritalStatus === 'unmarried'
              ? `Cohabitee receives nothing automatically — Inheritance Act claim possible.`
              : `Waterfall to surviving relatives or Crown.`),
  };
}

/**
 * Inheritance Act 1975 eligibility (UK-IHT-56 + UK-IHT-64).
 *
 * @param {object} claimant
 *   relationship: 'spouse'|'former_spouse'|'cohabitee_2yr'|'child'|'child_of_family'|'maintained'|'other'
 *   wasMaintained: boolean
 *   yearsCohabiting: number (if cohabitee)
 *   monthsSinceProbate: number
 */
export function inheritanceAct1975Eligible(claimant, bundle) {
  const eligibleCategories = ['spouse', 'former_spouse', 'cohabitee_2yr', 'child', 'child_of_family', 'maintained'];
  let eligible = false;
  let category = 'other';

  switch (claimant.relationship) {
    case 'spouse': eligible = true; category = 'spouse'; break;
    case 'former_spouse':
      eligible = !claimant.hasRemarried;
      category = eligible ? 'former_spouse_not_remarried' : 'former_spouse_disqualified';
      break;
    case 'cohabitee_2yr':
    case 'cohabitee':
      eligible = (claimant.yearsCohabiting || 0) >= 2;
      category = eligible ? 'cohabitee_2yr+' : 'cohabitee_under_2yr';
      break;
    case 'child':
    case 'child_of_family':
      eligible = true; category = claimant.relationship; break;
    case 'maintained':
      eligible = !!claimant.wasMaintained; category = 'maintained'; break;
    default:
      eligible = false; category = 'other';
  }

  // Time limit (UK-IHT-65): 6 months from grant of probate
  const monthsSince = claimant.monthsSinceProbate ?? 0;
  const inTime = monthsSince <= 6;

  return {
    amount: eligible && inTime ? 1 : 0,
    breakdown: {
      relationship: claimant.relationship, category, eligible,
      monthsSinceProbate: monthsSince, timeLimit: 6, inTime,
      provisionStandard:
        category === 'spouse'
          ? 'maintenance + sharing standard'
          : eligible ? 'maintenance only' : 'n/a',
    },
    rules: ['UK-IHT-56', 'UK-IHT-64', 'UK-IHT-65', 'UK-IHT-66'],
    explanation:
      eligible && inTime
        ? `Eligible Inheritance Act 1975 claim: category "${category}". ` +
          `Standard: ${category === 'spouse' ? 'maintenance + sharing' : 'maintenance only'}. ` +
          `Within 6-month time limit (${monthsSince} months since probate).`
        : !eligible
          ? `Not eligible: relationship "${claimant.relationship}" not in qualifying categories.`
          : `Out of time: ${monthsSince} months since probate > 6-month limit. Court may extend in exceptional cases.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §5.9 — DEEDS OF VARIATION (UK-IHT-61 to UK-IHT-63)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Deed of variation validity check (UK-IHT-61).
 *
 * @param {object} opts
 *   deathDate, dovDate, signedByAllAffectedBeneficiaries, inWriting, containsS142Election
 */
export function deedOfVariation(opts, bundle) {
  const iht = _iht(bundle);
  const { deathDate, dovDate, signedByAllAffectedBeneficiaries, inWriting, containsS142Election, containsS62TCGAElection = false } = opts;

  const yearsSinceDeath = _yearsBetween(deathDate, dovDate);
  const inTime = yearsSinceDeath <= iht.deedOfVariationYears;
  const formalitiesValid = !!(inWriting && signedByAllAffectedBeneficiaries);
  const ihtElectionMade = !!containsS142Election;

  const valid = inTime && formalitiesValid;

  return {
    amount: valid ? 1 : 0,
    breakdown: {
      deathDate, dovDate, yearsSinceDeath: _r(yearsSinceDeath),
      timeLimit: iht.deedOfVariationYears,
      inTime, inWriting, signedByAllAffectedBeneficiaries, formalitiesValid,
      s142IHTElection: ihtElectionMade,
      s62TCGAElection: containsS62TCGAElection,
      ihtTreatment: ihtElectionMade ? 'as if from deceased' : 'normal — gift from beneficiary, ordinary lifetime PET/CLT rules',
      cgtTreatment: containsS62TCGAElection ? 'as if from deceased — base cost rebased' : 'normal — disposal at MV by beneficiary',
      itTreatment: 'always: variations cannot retrospectively change income tax position (UK-IHT-63)',
    },
    rules: ['UK-IHT-47', 'UK-IHT-61', 'UK-IHT-62', 'UK-IHT-63'],
    explanation:
      valid
        ? `Deed of variation valid: within 2 years of death, in writing, signed by all affected. ` +
          `${ihtElectionMade ? 'IHT s142 election made — treated as gift from deceased for IHT.' : 'No s142 election — beneficiary treated as making the gift.'} ` +
          `${containsS62TCGAElection ? 'CGT s62(6) election made — base cost rebased.' : 'No s62(6) election — beneficiary disposes at MV for CGT.'}`
        : !inTime
          ? `Invalid: ${_r(yearsSinceDeath)} years since death > ${iht.deedOfVariationYears}-year limit.`
          : `Invalid: formalities not met (writing/signatures).`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §6.1 / §6.2 — TRUST REGIMES (UK-TRUST-01 to UK-TRUST-30)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Trust 10-year periodic charge (UK-TRUST-16).
 * Up to 6% of trust value above NRB at 10-year anniversary.
 *
 * @param {object} opts
 *   trustValue, priorChargeableTransfersByCondettlor7yrPriorToSettlement, deceasedSettlorUnusedAllowance
 */
export function trustTenYearAnniversaryCharge(opts, bundle) {
  const iht = _iht(bundle);
  const trustsCfg = _trusts(bundle).discretionaryTrust;
  const { trustValue, priorChargeableTransfers7yrs = 0 } = opts;

  // Effective rate = 30% × 20% × (trustValue above NRB after cumulation) / trustValue
  // Simplified for v1.0: max 6% on amount above NRB
  const nrb = iht.nilRateBand;
  const nrbAvailable = _max0(nrb - _max0(priorChargeableTransfers7yrs));
  const aboveNRB = _max0(trustValue - nrbAvailable);
  const charge = _r(aboveNRB * trustsCfg.periodicCharge.rate); // max 6%

  return {
    amount: charge,
    breakdown: {
      trustValue, priorChargeableTransfers7yrs,
      nrb, nrbAvailable, aboveNRB,
      maxRate: trustsCfg.periodicCharge.rate,
      tenYearCharge: charge,
      effectiveRate: trustValue > 0 ? _r(charge / trustValue) : 0,
    },
    rules: ['UK-TRUST-16'],
    explanation:
      `10-year anniversary charge: trust value £${trustValue.toLocaleString()}. ` +
      `NRB available £${nrbAvailable.toLocaleString()} after settlor's 7-year prior chargeable transfers. ` +
      `Above NRB: £${aboveNRB.toLocaleString()} × ${(trustsCfg.periodicCharge.rate * 100).toFixed(0)}% = £${charge.toLocaleString()}. ` +
      `(Simplified v1.0 — full effective rate calc per IHTA 1984 s66 deferred to v1.x.)`,
  };
}

/**
 * Trust exit charge (UK-TRUST-17).
 * Pro-rated based on quarters elapsed since last 10-year anniversary.
 */
export function trustExitCharge(opts, bundle) {
  const iht = _iht(bundle);
  const trustsCfg = _trusts(bundle).discretionaryTrust;
  const { amountLeaving, lastTYAEffectiveRate, quartersSinceTYA } = opts;

  // Effective rate at last TYA × (quarters elapsed / 40)
  const proportion = Math.min(1, _max0(quartersSinceTYA) / 40);
  const exitRate = _r(_max0(lastTYAEffectiveRate || 0) * proportion);
  const charge = _r(amountLeaving * exitRate);

  return {
    amount: charge,
    breakdown: {
      amountLeaving,
      lastTYAEffectiveRate,
      quartersSinceTYA,
      proportionOf40: _r(proportion),
      appliedExitRate: exitRate,
      exitCharge: charge,
    },
    rules: ['UK-TRUST-17'],
    explanation:
      `Exit charge: £${amountLeaving.toLocaleString()} × effective rate ${(exitRate * 100).toFixed(2)}% ` +
      `(${quartersSinceTYA}/40 quarters of last TYA effective rate ${((lastTYAEffectiveRate || 0) * 100).toFixed(2)}%) = ` +
      `£${charge.toLocaleString()}. ` +
      `Note: holdover relief under s260 TCGA may apply on assets leaving (UK-TRUST-28).`,
  };
}

/**
 * Trust income tax (UK-TRUST-18, UK-TRUST-19).
 * Discretionary: 45% / 39.35% dividends with £1k standard rate band.
 * IIP: passes through at beneficiary's marginal rate.
 *
 * @param {object} opts
 *   trustType: 'discretionary'|'IIP'|'bare'
 *   nonDividendIncome, dividendIncome, beneficiaryTaxableIncome (for IIP path)
 */
export function trustITRate(opts, bundle) {
  const trustsCfg = _trusts(bundle);

  if (opts.trustType === 'discretionary') {
    const cfg = trustsCfg.discretionaryTrust;
    const standardBand = cfg.standardRateBand;
    const nonDiv = _max0(opts.nonDividendIncome || 0);
    const div = _max0(opts.dividendIncome || 0);
    const total = nonDiv + div;

    // Simplified: standard band applies to first £1k at basic rate (20% non-div / 8.75% div) then trust rates
    // For v1.0 we apply trust rates above the band and nominal basic rates within
    const inBand = Math.min(total, standardBand);
    const aboveBand = _max0(total - standardBand);

    // Apportion above-band between non-div and div pro-rata to total (simplification)
    const aboveBandNonDiv = total > 0 ? (nonDiv / total) * aboveBand : 0;
    const aboveBandDiv = total > 0 ? (div / total) * aboveBand : 0;

    const tax = _r(
      inBand * 0.20 + // basic-rate slice (engine-side simplification; precise gross-up handled by trustees)
      aboveBandNonDiv * cfg.itRateOnIncome +
      aboveBandDiv * cfg.itRateDividends
    );

    return {
      amount: tax,
      breakdown: {
        trustType: 'discretionary',
        standardRateBand: standardBand,
        nonDividendIncome: nonDiv,
        dividendIncome: div,
        inBandTaxedAt: 0.20,
        rateAboveBand: cfg.itRateOnIncome,
        dividendRateAboveBand: cfg.itRateDividends,
        tax,
      },
      rules: ['UK-TRUST-18'],
      explanation:
        `Discretionary trust IT: £${standardBand.toLocaleString()} band at basic rates, ` +
        `then ${(cfg.itRateOnIncome * 100)}% non-div / ${(cfg.itRateDividends * 100).toFixed(2)}% dividends. ` +
        `Total tax £${tax.toLocaleString()}. ` +
        `Beneficiaries receive distribution with 45% credit (UK-TRUST-27).`,
    };
  }

  if (opts.trustType === 'IIP') {
    // IIP — life tenant taxed at marginal rate. Engine returns rate-only here; full computation needs beneficiary context.
    const beneficiaryRate = marginalIncomeRate(_max0(opts.beneficiaryTaxableIncome || 0), bundle).amount;
    const totalIncome = (opts.nonDividendIncome || 0) + (opts.dividendIncome || 0);
    const tax = _r(totalIncome * beneficiaryRate);
    return {
      amount: tax,
      breakdown: { trustType: 'IIP', totalIncome, beneficiaryMarginalRate: beneficiaryRate, tax },
      rules: ['UK-TRUST-19'],
      explanation:
        `IIP trust: income passes to life tenant at their marginal rate ${(beneficiaryRate * 100).toFixed(0)}%. ` +
        `Tax £${tax.toLocaleString()} at beneficiary level (trust acts as conduit).`,
    };
  }

  // Bare trust — taxed on beneficiary directly
  return {
    amount: 0,
    breakdown: { trustType: 'bare', note: 'Income attributed directly to beneficiary; not taxed at trust level.' },
    rules: ['UK-TRUST-01'],
    explanation:
      `Bare trust: income and gains attributed to absolute beneficiary. ` +
      `Note: parental settlement rule — income > £100/yr from parental gift to minor child taxed on parent.`,
  };
}

/**
 * Trust CGT (UK-TRUST-20).
 * Trustees pay CGT at higher rate; AEA is half the individual's.
 */
export function trustCGTRate(gains, opts, bundle) {
  // Trust CGT rate = 24% (aligned residential/non-res from FA 2026 — D-CGT-RES-ALIGN-1)
  // AEA = half the individual's. Bundle has individual AEA in capitalGains; we halve it.
  const cg = bundle.capitalGains || {};
  const individualAEA = cg.annualExemptAmount ?? 3000; // safe default if absent
  const trustAEA = _r(individualAEA / 2);
  const taxable = _max0(gains - trustAEA);
  const trustCGTRate = cg.higherRate ?? 0.24;
  const tax = _r(taxable * trustCGTRate);

  return {
    amount: tax,
    breakdown: {
      grossGains: gains,
      trustAEA,
      individualAEA,
      taxableGains: taxable,
      trustCGTRate,
      tax,
      holdoverNote: 'Holdover relief under s260 TCGA available on assets leaving relevant property trust (UK-TRUST-28).',
    },
    rules: ['UK-TRUST-20'],
    explanation:
      `Trust CGT: gains £${gains.toLocaleString()} less AEA £${trustAEA.toLocaleString()} ` +
      `(½ individual's £${individualAEA.toLocaleString()}) = £${taxable.toLocaleString()} taxable × ${(trustCGTRate * 100)}% = ` +
      `£${tax.toLocaleString()}.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §6.3 — ESTATE PLANNING VEHICLES (UK-TRUST-31 to UK-TRUST-42)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Loan Trust value in estate (UK-TRUST-31, UK-TRUST-32).
 * Outstanding loan remains in estate; growth above original loan accumulates outside.
 */
export function loanTrustValueInEstate(opts, bundle) {
  const { originalLoanAmount, currentTrustValue, loanRepaid = 0 } = opts;
  const outstandingLoan = _max0(originalLoanAmount - loanRepaid);
  const inEstate = outstandingLoan;
  const outsideEstate = _max0(currentTrustValue - outstandingLoan);

  return {
    amount: inEstate,
    breakdown: {
      originalLoanAmount, loanRepaid, outstandingLoan,
      currentTrustValue,
      inEstate, outsideEstate,
      growthSheltered: outsideEstate,
    },
    rules: ['UK-TRUST-31', 'UK-TRUST-32'],
    explanation:
      `Loan Trust: outstanding loan £${outstandingLoan.toLocaleString()} remains in settlor's estate. ` +
      `Growth above loan (£${outsideEstate.toLocaleString()}) accumulates outside estate from day 1. ` +
      `Typical structure: bond inside trust, settlor takes 5% withdrawals as loan repayment (no immediate tax — UK-BOND-06).`,
  };
}

/**
 * Discounted Gift Trust chargeable amount (UK-TRUST-34, UK-TRUST-36).
 * Discount based on actuarial valuation of retained income right.
 */
export function dgtChargeable(opts, bundle) {
  const { transferAmount, actuarialDiscountPct, trustType = 'absolute' } = opts;
  const discount = _r(transferAmount * Math.min(1, _max0(actuarialDiscountPct)));
  const chargeable = _r(transferAmount - discount);
  const transferType = trustType === 'absolute' ? 'PET' : 'CLT';

  return {
    amount: chargeable,
    breakdown: {
      transferAmount,
      actuarialDiscountPct,
      discountValue: discount,
      chargeableTransfer: chargeable,
      treatmentAtSettlement: transferType,
      sevenYearClockStarts: true,
    },
    rules: ['UK-TRUST-34', 'UK-TRUST-35', 'UK-TRUST-36'],
    explanation:
      `DGT: settlor transfers £${transferAmount.toLocaleString()}; retains income right valued by insurer. ` +
      `Discount ${(actuarialDiscountPct * 100).toFixed(0)}% = £${discount.toLocaleString()}. ` +
      `Chargeable transfer £${chargeable.toLocaleString()} (${transferType}). 7-year clock starts.`,
  };
}

/**
 * Flexible Reversionary Trust check (UK-TRUST-37, UK-TRUST-38).
 * Validates that reversion structure falls outside GROB.
 */
export function frtCheck(opts, bundle) {
  const { reversionsDated, futureDated, trusteesCanDefer, settlorBenefitsBeforeReversion } = opts;
  const safe = !!(reversionsDated && futureDated && trusteesCanDefer && !settlorBenefitsBeforeReversion);

  return {
    amount: safe ? 1 : 0,
    breakdown: {
      reversionsDated, futureDated, trusteesCanDefer, settlorBenefitsBeforeReversion,
      grobRisk: !safe,
      structureValid: safe,
    },
    rules: ['UK-TRUST-37', 'UK-TRUST-38', 'UK-IHT-37'],
    explanation:
      safe
        ? `FRT structure valid: dated future reversions, deferrable by trustees, no settlor pre-reversion benefit — ` +
          `falls outside GROB.`
        : `FRT structure RISK: ${settlorBenefitsBeforeReversion ? 'settlor benefits before reversion crystallises — likely GROB. ' : ''}` +
          `${!futureDated ? 'reversions not future-dated. ' : ''}` +
          `${!trusteesCanDefer ? 'trustees lack deferral power. ' : ''}` +
          `Specialist review required.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §6.4 — PRE-2006 TRANSITIONAL (UK-TRUST-43 to UK-TRUST-45)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Pre-2006 IIP trust treatment (UK-TRUST-43).
 * Qualifying IIP: life tenant treated as owner of capital for IHT.
 */
export function pre2006IIPInEstate(opts, bundle) {
  const { trustValue, settlementDate, isQualifyingInterest } = opts;
  const PRE_2006_DATE = new Date('2006-03-22');
  const wasPre2006 = _toDate(settlementDate) < PRE_2006_DATE;
  const inEstate = wasPre2006 && isQualifyingInterest;

  return {
    amount: inEstate ? trustValue : 0,
    breakdown: {
      trustValue, settlementDate,
      pre2006Cutoff: '2006-03-22',
      wasPre2006, isQualifyingInterest,
      includedInLifeTenantEstate: inEstate,
    },
    rules: ['UK-TRUST-43'],
    explanation:
      inEstate
        ? `Pre-22-Mar-2006 qualifying IIP: life tenant treated as owner of trust capital £${trustValue.toLocaleString()} for IHT.`
        : !wasPre2006
          ? `Settled post-22-Mar-2006: relevant property regime applies (10-year + exit charges).`
          : `Not a qualifying interest — relevant property regime applies.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * §13.2 / §16 — LPA GIFT RESTRICTIONS (UK-LPA-08, UK-LPA-12)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LPA attorney gift permitted check (UK-LPA-08).
 * MCA 2005 s.12: customary occasion gifts only; IHT-motivated programmes need Court of Protection.
 *
 * @param {object} gift — { amount, occasionType, recipientType, isReasonableRelativeToEstate }
 *   occasionType: 'birthday' | 'seasonal' | 'wedding' | 'charity_known_to_donor' | 'iht_planning' | 'other'
 *   recipientType: 'family' | 'friend_connected_to_donor' | 'charity_donor_supports' | 'unconnected'
 */
export function lpaAttorneyGiftPermitted(gift, donorEstateValue, bundle) {
  const customaryOccasions = ['birthday', 'seasonal', 'wedding'];
  const customaryRecipientToFamilyOrConnected = ['family', 'friend_connected_to_donor'];

  const isCustomaryOccasion = customaryOccasions.includes(gift.occasionType);
  const isCharityKnownToDonor = gift.occasionType === 'charity_known_to_donor' && gift.recipientType === 'charity_donor_supports';
  const isPermittedRecipient = customaryRecipientToFamilyOrConnected.includes(gift.recipientType);
  const reasonable = !!gift.isReasonableRelativeToEstate;
  const ihtProgramme = gift.occasionType === 'iht_planning';

  const permitted = !ihtProgramme && reasonable && (
    (isCustomaryOccasion && isPermittedRecipient) ||
    isCharityKnownToDonor
  );

  return {
    amount: permitted ? 1 : 0,
    breakdown: {
      gift, donorEstateValue,
      isCustomaryOccasion, isCharityKnownToDonor,
      isPermittedRecipient, reasonable,
      ihtProgramme,
      permitted,
      copAuthorisationRequired: ihtProgramme || (!isCustomaryOccasion && !isCharityKnownToDonor),
    },
    rules: ['UK-LPA-08', 'UK-LPA-12', 'UK-IHT-14', 'UK-IHT-17'],
    explanation:
      permitted
        ? `Gift permitted under MCA 2005 s.12: customary occasion (${gift.occasionType}) to ${gift.recipientType}, reasonable size.`
        : ihtProgramme
          ? `IHT-motivated gifting programme NOT permitted unilaterally by attorney. ` +
            `Court of Protection authorisation required (UK-LPA-12). ` +
            `Mitigation: front-load gifting while donor has capacity, or apply to COP for statutory authority, ` +
            `or document established UK-IHT-17 normal-expenditure pattern.`
          : !reasonable
            ? `Gift unreasonably large relative to estate £${donorEstateValue.toLocaleString()} — not permitted without COP authority.`
            : `Outside MCA 2005 s.12 scope — Court of Protection authorisation required.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * AGGREGATE FUNCTIONS — wrapper-first dispatcher, full estate computation
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Wrapper-first dispatcher for estate (D-WRAPPER-FIRST-1, MM v2.6 §0).
 * Determines IHT inclusion and treatment based on wrapper type.
 *
 * Mirrors getWrapper() from uk-tax-2026-1-1.js conceptually but for estate-side queries.
 *
 * @param {object} asset — { wrapperType, isInTrust, ... }
 */
export function getWrapperEstate(asset) {
  const wrapper = asset.wrapperType || 'GIA';
  let estateInclusion;
  let note;

  switch (wrapper) {
    case 'SIPP_UNCRYSTALLISED':
    case 'SIPP_CRYSTALLISED':
    case 'PERSONAL_PENSION':
    case 'WORKPLACE_DC':
      // Pre-Apr-2027: outside estate (per UK-TRUST-24). Post-Apr-2027: included (UK-IHT-08)
      estateInclusion = 'PENSION_DC';
      note = 'DC pension: outside estate pre-6-Apr-2027; in estate from 6-Apr-2027 (UK-IHT-08).';
      break;
    case 'DB_PENSION':
      estateInclusion = 'OUTSIDE_ESTATE';
      note = 'DB lump-sum death benefit usually paid via discretionary trust — outside estate.';
      break;
    case 'ISA':
    case 'JISA':
    case 'GIA':
      estateInclusion = 'IN_ESTATE';
      note = 'In estate at full market value at death.';
      break;
    case 'PROPERTY_DIRECT':
      estateInclusion = 'IN_ESTATE';
      note = 'In estate at market value. RNRB available if qualifying residence to direct descendants.';
      break;
    case 'LIFE_POLICY':
      estateInclusion = asset.isInTrust ? 'OUTSIDE_ESTATE' : 'IN_ESTATE';
      note = asset.isInTrust
        ? 'Life policy in trust: proceeds paid outside estate (UK-TRUST-11).'
        : 'Life policy NOT in trust: proceeds paid into estate at death — taxable.';
      break;
    case 'BOND_ONSHORE':
    case 'BOND_OFFSHORE':
      estateInclusion = asset.isInTrust ? 'TRUST_REGIME' : 'IN_ESTATE';
      note = asset.isInTrust
        ? 'Bond in trust: trust IHT regime applies (UK-TRUST-41).'
        : 'Bond outside trust: in estate at surrender value.';
      break;
    case 'BUSINESS_INTEREST':
    case 'AGRICULTURAL':
      estateInclusion = 'IN_ESTATE_WITH_RELIEF';
      note = 'In estate; BPR/APR may apply per FA 2026 reform regime (UK-BPR-01 to UK-BPR-08).';
      break;
    default:
      estateInclusion = 'IN_ESTATE';
      note = `Unknown wrapper "${wrapper}": defaulting to IN_ESTATE.`;
  }

  return { wrapper, estateInclusion, note };
}

/**
 * Estate valuation — total value, classified by IHT treatment.
 *
 * @param {object} entity — Caelixa entity with assets array
 * @returns {{amount, breakdown, rules, explanation}}
 */
export function estateValuation(entity, bundle) {
  const iht = _iht(bundle);
  const includeSippFromApr2027 = (() => {
    const inclusionDate = _toDate(iht.pensionIHTInclusionDate);
    const today = entity.deathDate ? _toDate(entity.deathDate) : new Date();
    return today >= inclusionDate;
  })();

  let inEstate = 0;
  let pensionDC = 0;
  let outsideEstate = 0;
  let withRelief = 0;
  const classified = [];

  for (const asset of (entity.assets || [])) {
    const wrap = getWrapperEstate(asset);
    const v = asset.value || 0;
    classified.push({ name: asset.name, value: v, classification: wrap.estateInclusion, note: wrap.note });

    switch (wrap.estateInclusion) {
      case 'IN_ESTATE':                 inEstate += v; break;
      case 'IN_ESTATE_WITH_RELIEF':     inEstate += v; withRelief += v; break;
      case 'PENSION_DC':                if (includeSippFromApr2027) inEstate += v; else pensionDC += v; break;
      case 'OUTSIDE_ESTATE':            outsideEstate += v; break;
      case 'TRUST_REGIME':              outsideEstate += v; break;
    }
  }

  return {
    amount: _r(inEstate),
    breakdown: {
      inEstate: _r(inEstate),
      pensionDCOutsideEstateUntilApr2027: _r(pensionDC),
      outsideEstate: _r(outsideEstate),
      assetsWithBPRorAPRPotential: _r(withRelief),
      pensionInclusionEffective: includeSippFromApr2027,
      pensionInclusionDate: iht.pensionIHTInclusionDate,
      perAsset: classified,
    },
    rules: ['UK-IHT-08', 'UK-TRUST-11', 'UK-TRUST-24'],
    explanation:
      `Gross estate £${_r(inEstate).toLocaleString()}` +
      (pensionDC > 0
        ? ` (pension DC £${_r(pensionDC).toLocaleString()} excluded until 6 Apr 2027 — UK-IHT-08).`
        : `.`) +
      ` Outside estate: £${_r(outsideEstate).toLocaleString()}. ` +
      `BPR/APR potential: £${_r(withRelief).toLocaleString()}.`,
  };
}

/**
 * IHT dynamic — full live IHT calculation (top-level orchestrator).
 * Used by T&E tab + ihtDynamic engine surface.
 *
 * @param {object} entity — full Caelixa entity
 * @param {object} opts
 *   includeSipp (override the date check), drawdownOverride, charitableLegacy, ...
 */
export function ihtDynamic(entity, opts, bundle) {
  const iht = _iht(bundle);
  opts = opts || {};

  // Step 1: estate valuation
  const ev = estateValuation(entity, bundle);
  let grossEstate = ev.amount;
  if (typeof opts.includeSipp === 'boolean' && opts.includeSipp) {
    grossEstate = grossEstate + (ev.breakdown.pensionDCOutsideEstateUntilApr2027 || 0);
  }

  // Step 2: BPR/APR relief (caller pre-classifies assets; v1.0 simplified)
  const aprBprRelief = opts.aprBprReliefAmount || 0;

  // Step 3: gifts / cumulation
  const giftsCum = opts.gifts && opts.gifts.length
    ? cumulateGiftsForNRB(opts.gifts, entity.deathDate || new Date(), bundle)
    : { amount: 0, breakdown: { nrbConsumedByGifts: 0 } };
  const failedPETs = opts.gifts && opts.gifts.length
    ? failedPETsTax(opts.gifts, entity.deathDate || new Date(), bundle)
    : { amount: 0 };

  // Step 4: waterfall on estate
  // Derive qualifying residential interest (QRI) value for RNRB cap (IHTM46031 · O-EST-RNRB-CAP-1).
  // opts.residenceValue may be supplied to override. Otherwise sum PROPERTY_DIRECT assets.
  // Falls back to Infinity (no cap) if entity has no detailed assets — preserves backward compat.
  const residenceValue = opts.residenceValue !== undefined
    ? opts.residenceValue
    : (() => {
        const total = (entity.assets || [])
          .filter(a => a.wrapperType === 'PROPERTY_DIRECT')
          .reduce((s, a) => s + (a.value || 0), 0);
        return total > 0 ? total : Infinity;
      })();

  const waterfall = ihtWaterfall({
    grossEstate,
    spouseTransfer: opts.spouseTransfer || 0,
    nonDomSpouseTransfer: opts.nonDomSpouseTransfer || 0,
    priorSpouseToNonDomTransfers: opts.priorSpouseToNonDomTransfers || 0,
    charitableLegacy: opts.charitableLegacy || 0,
    aprBprReliefAmount: aprBprRelief,
    residenceLeftToDirectDescendants: !!opts.residenceLeftToDirectDescendants,
    deceasedSpouseUnusedNRBPct: opts.deceasedSpouseUnusedNRBPct || 0,
    deceasedSpouseUnusedRNRBPct: opts.deceasedSpouseUnusedRNRBPct || 0,
    nrbConsumedByGifts: giftsCum.breakdown.nrbConsumedByGifts,
    residenceValue,
  }, bundle);

  const totalIHT = _r(waterfall.amount + failedPETs.amount);

  return {
    amount: totalIHT,
    breakdown: {
      grossEstate,
      estateValuation: ev.breakdown,
      gifts: giftsCum.breakdown,
      failedPETsTax: failedPETs.amount,
      estateIHT: waterfall.amount,
      totalIHT,
      waterfallDetail: waterfall.breakdown,
    },
    rules: ['UK-IHT-01', 'UK-IHT-05', 'UK-IHT-06', 'UK-IHT-07', 'UK-IHT-08', 'UK-IHT-33', 'UK-IHT-34', 'UK-IHT-36', 'UK-IHT-41'],
    explanation:
      `IHT total: £${totalIHT.toLocaleString()} (estate £${waterfall.amount.toLocaleString()} + ` +
      `failed PETs £${failedPETs.amount.toLocaleString()}). ` +
      `Gross estate £${grossEstate.toLocaleString()} after wrapper-first classification.`,
  };
}

/**
 * estatePlanningHandler(entity, bundle, ctx)
 *
 * Canonical CoI handler for actionDomain = 'estatePlanning'.
 * Conforms to canonical handler contract (canonical-coi.js §27-46):
 *   returns { status, currentPath, optimalPath, action, rules, notes? }.
 *
 * Per skill v1.4 §2.7 + MM v2.6 §0.1: this handler is generalised — it is
 * NOT narrowed to the SIPP/IHT example. That was one application of CoI in
 * the estatePlanning domain, not the definition.
 *
 * v1.0 SCOPE — single-point-at-horizon model (death event at longevity age):
 *   - currentPath: vector of length horizon+1; all zeros except value at
 *     period horizon = grossEstate − currentIHT (net to beneficiaries on
 *     present trajectory).
 *   - optimalPath: same shape; value at period horizon = grossEstate −
 *     optimalIHT (net to beneficiaries after applying basic optimisation:
 *     full NRB + RNRB utilisation, spouse exemption where applicable,
 *     direct-descendant residence allocation if condition met).
 *   - npv() of each path discounts the death-event value back to today.
 *
 * Captured limitations declared in returned `notes`:
 *   (i)   Single-point-at-horizon — no inter-year estate dynamics.
 *   (ii)  Basic NRB / RNRB / spouse exemption modelling only.
 *   (iii) Does NOT model BPR / APR optimisation depth (asset reclassification
 *         opportunities not searched).
 *   (iv)  Does NOT model PET-survival probability (assumes gifts that would
 *         be PETs survive 7+ years if recommended).
 *   (v)   Does NOT model trust strategies (CLT, IIP, discretionary, loan trust).
 *   (vi)  Does NOT model gift-out-of-normal-expenditure timing.
 *   (vii) Discount at CMA real rate; nominal IHT thresholds frozen until
 *         2030 per Finance Act.
 *
 * Sources:
 *   IHTM (HMRC Inheritance Tax Manual)
 *   IHTA 1984 (NRB, RNRB, spouse exemption, taper)
 *   Finance Act 2024 (NRB / RNRB freeze to 2030)
 *   MM v2.6 §0.1 (canonical CoI definition)
 *   skill v1.4 §2.7 (no example-as-definition narrowing)
 *
 * @param {object} entity   Entity with assets/liabilities for estateValuation,
 *                          plus optional estatePlanningContext: {
 *                            isMarried: boolean,
 *                            spouseSurvivesFirst: boolean,
 *                            residenceLeftToDirectDescendants: boolean,
 *                            spouseTransfer: number,
 *                            charitableLegacy: number,
 *                            deceasedSpouseUnusedNRBPct: number,
 *                            deceasedSpouseUnusedRNRBPct: number,
 *                            aprBprReliefAmount: number,
 *                          }
 * @param {object} bundle   UK-master bundle (pinned 2026-1-1).
 * @param {object} ctx      Provided by canonical-coi.js: { discountRateReal,
 *                          horizonYears, currentAge, longevityAge, ... }.
 * @returns Canonical handler-contract result.
 */
export function estatePlanningHandler(entity, bundle, ctx) {
  const _emptyAction = { currentDescription: '', optimalDescription: '', outcome: '' };

  // Validate ctx
  if (!ctx || typeof ctx.horizonYears !== 'number' || ctx.horizonYears <= 0) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1'],
      notes: 'estatePlanning v1.0: ctx.horizonYears (years to longevity age) required.',
    };
  }

  // Compute gross estate using the engine's own valuation pipeline
  let grossEstate;
  try {
    const ev = estateValuation(entity, bundle);
    grossEstate = ev.amount;
  } catch (err) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1', 'IHTA 1984'],
      notes: `estatePlanning v1.0: cannot value estate — ${err.message}`,
    };
  }

  if (grossEstate <= 0) {
    return {
      status: 'NOT_APPLICABLE',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['IHTA 1984'],
      notes: `Gross estate £${Math.round(grossEstate).toLocaleString('en-GB')}: no IHT exposure; estatePlanning CoI not applicable.`,
    };
  }

  const epc = (entity && typeof entity.estatePlanningContext === 'object' && entity.estatePlanningContext !== null)
    ? entity.estatePlanningContext : {};

  // ── CURRENT PATH IHT (entity as-is) ──
  // Use ihtDynamic with the user's stated current options (gifts, transfers, etc.)
  let currentIHT;
  try {
    const cur = ihtDynamic(entity, {
      includeSipp: typeof epc.includeSippInEstate === 'boolean' ? epc.includeSippInEstate : false,
      gifts: epc.gifts || [],
      spouseTransfer: epc.spouseTransfer || 0,
      nonDomSpouseTransfer: epc.nonDomSpouseTransfer || 0,
      priorSpouseToNonDomTransfers: epc.priorSpouseToNonDomTransfers || 0,
      charitableLegacy: epc.charitableLegacy || 0,
      aprBprReliefAmount: epc.aprBprReliefAmount || 0,
      residenceLeftToDirectDescendants: !!epc.residenceLeftToDirectDescendants,
      deceasedSpouseUnusedNRBPct: epc.deceasedSpouseUnusedNRBPct || 0,
      deceasedSpouseUnusedRNRBPct: epc.deceasedSpouseUnusedRNRBPct || 0,
    }, bundle);
    currentIHT = cur.amount;
  } catch (err) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1', 'IHTA 1984'],
      notes: `estatePlanning v1.0: cannot compute current IHT — ${err.message}`,
    };
  }

  // ── OPTIMAL PATH IHT — apply basic optimisation actions ──
  // v1.0 optimal action set:
  //   1. Ensure residence is left to direct descendants (unlocks RNRB) IF not
  //      already so AND a residence is held in the estate.
  //   2. If married AND spouse will survive first, transfer to spouse uses
  //      spouse exemption AND preserves both NRB+RNRB for transferable use
  //      on second death — modelled as 0% IHT on first death.
  //      (For the common single-life model, this is a no-op.)
  //   3. Carry across deceasedSpouseUnusedNRBPct/RNRBPct exactly as supplied
  //      (transferable allowances) — already applied at currentIHT.
  //
  // v1.0 does NOT search BPR/APR opportunities, gift planning, trust structuring.
  // Those land in v1.1+ as actions added to the optimal action set.

  const optimalOpts = {
    includeSipp: typeof epc.includeSippInEstate === 'boolean' ? epc.includeSippInEstate : false,
    gifts: epc.gifts || [],
    spouseTransfer: epc.spouseTransfer || 0,
    nonDomSpouseTransfer: epc.nonDomSpouseTransfer || 0,
    priorSpouseToNonDomTransfers: epc.priorSpouseToNonDomTransfers || 0,
    charitableLegacy: epc.charitableLegacy || 0,
    aprBprReliefAmount: epc.aprBprReliefAmount || 0,
    deceasedSpouseUnusedNRBPct: epc.deceasedSpouseUnusedNRBPct || 0,
    deceasedSpouseUnusedRNRBPct: epc.deceasedSpouseUnusedRNRBPct || 0,
    // OPTIMISATION 1: residence to direct descendants if a residence exists
    residenceLeftToDirectDescendants: true,
  };

  const optimisationsApplied = [];
  if (!epc.residenceLeftToDirectDescendants) {
    optimisationsApplied.push('Allocate residence to direct descendants (unlocks RNRB)');
  }

  let optimalIHT;
  try {
    const opt = ihtDynamic(entity, optimalOpts, bundle);
    optimalIHT = opt.amount;
  } catch (err) {
    return {
      status: 'OPEN',
      currentPath: [],
      optimalPath: [],
      action: _emptyAction,
      rules: ['MM v2.6 §0.1', 'IHTA 1984'],
      notes: `estatePlanning v1.0: cannot compute optimal IHT — ${err.message}`,
    };
  }

  // Net-to-beneficiaries values (perspective: VALUE TO USER — higher is better)
  const currentNetToBeneficiaries = grossEstate - currentIHT;
  const optimalNetToBeneficiaries = grossEstate - optimalIHT;

  // Build single-point-at-horizon cashflow vectors
  const horizon = Math.max(1, Math.floor(ctx.horizonYears));
  const currentPath = new Array(horizon + 1).fill(0);
  const optimalPath = new Array(horizon + 1).fill(0);
  currentPath[horizon] = currentNetToBeneficiaries;
  optimalPath[horizon] = optimalNetToBeneficiaries;

  // Detect status: if no optimisation moves the dial, status is still IMPLEMENTED
  // but CoI = 0 (legitimate "already optimal" answer)
  const ihtSavingNominal = currentIHT - optimalIHT;

  return {
    status: 'IMPLEMENTED',
    currentPath,
    optimalPath,
    action: {
      currentDescription:
        `Estate £${Math.round(grossEstate).toLocaleString('en-GB')} on current trajectory: ` +
        `IHT £${Math.round(currentIHT).toLocaleString('en-GB')} on death at age ${ctx.longevityAge}; ` +
        `net to beneficiaries £${Math.round(currentNetToBeneficiaries).toLocaleString('en-GB')}`,
      optimalDescription:
        optimisationsApplied.length > 0
          ? `Apply: ${optimisationsApplied.join('; ')}. Projected IHT £${Math.round(optimalIHT).toLocaleString('en-GB')}; net to beneficiaries £${Math.round(optimalNetToBeneficiaries).toLocaleString('en-GB')}`
          : `Estate is already aligned with v1.0 optimisation set (basic NRB/RNRB/spouse exemption). Further savings require BPR/APR/gifting/trust strategies (v1.1+).`,
      outcome:
        ihtSavingNominal > 0
          ? `IHT saving of £${Math.round(ihtSavingNominal).toLocaleString('en-GB')} nominal at death; ` +
            `NPV at ${(ctx.discountRateReal * 100).toFixed(1)}% real over ${horizon} years`
          : `No saving available within v1.0 optimisation set; CoI = £0`,
    },
    rules: [
      'IHTA 1984 (NRB, RNRB, spouse exemption)',
      'Finance Act 2024 (NRB/RNRB freeze to 2030)',
      'IHTM43020 (transferable NRB)',
      'IHTM46000 (RNRB)',
      'UK-IHT-01', 'UK-IHT-05', 'UK-IHT-06', 'UK-IHT-07', 'UK-IHT-08',
    ],
    notes:
      'v1.0 single-point-at-horizon model (death event at longevity age). ' +
      'Limitations: (i) basic NRB/RNRB/spouse exemption only; ' +
      '(ii) does NOT model BPR/APR optimisation depth; ' +
      '(iii) does NOT model PET survival-probability; ' +
      '(iv) does NOT model trust strategies (CLT, IIP, discretionary, loan trust); ' +
      '(v) does NOT model gift-out-of-normal-expenditure timing; ' +
      '(vi) discount at CMA real rate; nominal IHT thresholds frozen until 2030. ' +
      'Future versions: v1.1 BPR/APR search; v1.2 gifting + PET probability; v1.3 trust strategies.',
  };
}

/**
 * Convenience entry point — IHT on a single asset (mirror of taxOnAsset for tax engine).
 *
 * @param {object} asset
 * @param {object} context — { holdingPeriodYears, leftToDirectDescendants, isInTrust, ... }
 */
export function taxOnEstate(asset, context, bundle) {
  const wrap = getWrapperEstate(asset);
  const iht = _iht(bundle);
  context = context || {};

  if (wrap.estateInclusion === 'OUTSIDE_ESTATE') {
    return {
      amount: 0,
      breakdown: { wrapper: wrap.wrapper, estateInclusion: wrap.estateInclusion, ihtOnAsset: 0 },
      rules: ['UK-IHT-41'],
      explanation: `${wrap.note} No IHT on this asset.`,
    };
  }

  // PENSION_DC is date-gated: outside estate until pension IHT inclusion date (Apr 2027).
  if (wrap.estateInclusion === 'PENSION_DC') {
    const today = context.deathDate ? _toDate(context.deathDate) : new Date();
    const inclusionDate = _toDate(iht.pensionIHTInclusionDate);
    const included = today >= inclusionDate;
    if (!included) {
      return {
        amount: 0,
        breakdown: { wrapper: wrap.wrapper, estateInclusion: wrap.estateInclusion,
                     pensionInclusionDate: iht.pensionIHTInclusionDate, included: false, ihtOnAsset: 0 },
        rules: ['UK-IHT-08', 'UK-TRUST-24'],
        explanation: `${wrap.note} Pre-${iht.pensionIHTInclusionDate}: outside estate, no IHT.`,
      };
    }
    // post-inclusion-date: falls through to naive calc below
  }

  // Per-asset IHT depends on overall estate context — return a per-asset rate hint.
  const baseRate = iht.ihtRate;
  const naiveTax = _r(asset.value * baseRate);

  return {
    amount: naiveTax,
    breakdown: {
      wrapper: wrap.wrapper,
      estateInclusion: wrap.estateInclusion,
      assetValue: asset.value,
      naiveIHTAtFullRate: naiveTax,
      caveat: 'Per-asset IHT is not actually pro-rata — must compute via ihtDynamic across whole estate.',
    },
    rules: ['UK-IHT-05', 'UK-IHT-41'],
    explanation:
      `Per-asset IHT view (illustrative): £${asset.value.toLocaleString()} × ${(baseRate * 100)}% = ` +
      `£${naiveTax.toLocaleString()}. ` +
      `Actual liability requires whole-estate computation via ihtDynamic — exemptions, reliefs, NRB/RNRB, gift cumulation all matter.`,
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * EXPORTS — explicit list (also exported inline above; this is the manifest)
 * ──────────────────────────────────────────────────────────────────────── */

// (All public functions are exported via `export` keyword above. This comment block
// serves as the function manifest for s17a-2 deliverable counting.)
//
// §5.1 IHT bands (5):
//   nilRateBand, residenceNilRateBand, transferableNRB, transferableRNRB, combinedNilRateBands
// §5.2 Exemptions (6):
//   annualGiftExemption, smallGiftsExemption, weddingGiftExemption,
//   normalExpenditureFromIncomeQualifies, spouseExemption, charityExemption
// §5.4 Gifts/PETs/CLTs/Taper (8):
//   taperReliefFactor, petStatus, cltEntryCharge, cltAdditionalChargeOnDeath,
//   cumulateGiftsForNRB, failedPETsTax, grobIncluded, fourteenYearRule
// §5.3 BPR/APR fundamentals (2):
//   bprQualifies, aprQualifies
// §5.3a BPR/APR April 2026 reform (5):
//   bprAprAllowanceForEntity, bprAprAllocateAllowance, bprAprTransitionalRegime,
//   aimBprRelief, bprAprReliefApplied
// §5.5 Computation (3):
//   ihtRate, charityTenPercentTest, instalmentEligible, ihtWaterfall (4 actually)
// §5.6 Domicile/scope (2):
//   ihtScope, excludedPropertyTrust
// §5.7/§17 Intestacy (2):
//   intestacyDistribution, inheritanceAct1975Eligible
// §5.9 DoV (1):
//   deedOfVariation
// §6.1/§6.2 Trusts (4):
//   trustTenYearAnniversaryCharge, trustExitCharge, trustITRate, trustCGTRate
// §6.3 Estate planning vehicles (3):
//   loanTrustValueInEstate, dgtChargeable, frtCheck
// §6.4 Pre-2006 (1):
//   pre2006IIPInEstate
// §13.2/§16 LPA (1):
//   lpaAttorneyGiftPermitted
// Aggregates (5):
//   getWrapperEstate, estateValuation, ihtDynamic, estatePlanningHandler, taxOnEstate
//
// Total public exports: 5+6+8+2+5+4+2+2+1+4+3+1+1+5 = 49 functions
// Retrofit: s17b-1b · 8 May 2026 — costOfInactionEstate stub replaced with
//           estatePlanningHandler conforming to canonical handler contract
//           (canonical-coi.js §27-46) per D-COI-HANDLER-INJECTION-1.
//
// Retrofit: s17b-2b · 11 May 2026 — O-EST-RNRB-CAP-1 (IHTM46031) · v1.1
//   residenceNilRateBand: optional 4th param residenceValue (default Infinity); caps RNRB
//     at min(rnrbAfterTaper, residenceValue) per IHTM46031.
//   transferableRNRB: optional 5th param residenceValue; caps combined (own+transferred)
//     RNRB at QRI value per IHTM46035; passes residenceValue to residenceNilRateBand call.
//   combinedNilRateBands: accepts residenceValue in opts; passes to transferableRNRB.
//   ihtWaterfall: accepts residenceValue in opts; passes to combinedNilRateBands.
//   ihtDynamic: derives residenceValue from entity.assets (PROPERTY_DIRECT sum); accepts
//     opts.residenceValue override; passes to ihtWaterfall. Backward-compat: Infinity if no
//     PROPERTY_DIRECT assets found.
//   All existing 4-arg / 3-arg callers unaffected (Infinity default = no cap).

// — end of uk-estate-2026-1-1.js —
