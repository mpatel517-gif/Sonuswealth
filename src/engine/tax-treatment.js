// ─────────────────────────────────────────────────────────────────────────────
// TAX TREATMENT SUMMARY — Spec §2.3 (D-WRAPPER-FIRST-1)
//
// One-line plain-English IT / CGT / IHT statements per (wrapper, asset).
// Used by the L3 detail block and the drilldown TaxTreatmentBlock UI.
//
// Returns:
//   {
//     it:   string,         // Income tax line
//     cgt:  string,         // Capital gains tax line
//     iht:  string,         // Inheritance tax line
//     hints: [{ term, explainerId }],   // Inline ⓘ explainer hooks
//     confidence: 1.0|0.8|0.5,          // 1.0 when wrapper resolved, lower when ambiguous
//   }
//
// Spec excerpts (§2.3 v2.7):
//   SIPP (uncrystallised): "Growth tax-deferred; withdrawals taxed as income"
//   ISA:    "Income and growth tax-free" / "Gains exempt inside ISA" / "In your estate; APS available for spouse"
//   GIA:    "Income taxed at marginal rate" / "Gains above AEA at 18%/24%" / "In your estate at market value"
//   PROPERTY: "Rental income taxed as non-savings income" / "PPR may apply; 60-day report on disposal" / "In estate; RNRB may apply if residential"
// ─────────────────────────────────────────────────────────────────────────────

import { getWrapper } from './_helpers.js';

const PENSION_IHT_PRE_2027 = 'Outside your estate today.';
const PENSION_IHT_FROM_2027 = 'In your estate from April 2027.';

const HINT = {
  PA: 'MM-PA',
  AEA: 'MM-AEA',
  PSA: 'MM-PSA',
  PPR: 'MM-PPR',
  RNRB: 'MM-RNRB',
  S24: 'MM-S24',
  APS: 'MM-APS',
  BPR: 'MM-BPR',
  BADR: 'MM-BADR',
  AA: 'MM-AA',
  SIPP: 'MM-SIPP',
};

/**
 * @param {object} asset
 * @param {string} wrapper  Pre-resolved wrapper code (PENSION/ISA/...) or null
 * @param {object} [bundle] Rule bundle (currently unused; reserved for rate switch)
 * @returns {{it:string, cgt:string, iht:string, hints:{term:string, explainerId:string}[], confidence:number}}
 */
export function getTaxTreatmentSummary(asset, wrapper, bundle) {
  const w = wrapper || getWrapper(asset);
  const t = String(asset?.type || '').toLowerCase();
  const status = String(asset?.status || asset?.phase || '').toLowerCase();
  const isCrystallised = status.includes('crystallised') || status.includes('drawdown');

  switch (w) {
    case 'PENSION': {
      const isDB = t.includes('-db') || t === 'db' || t.includes('final-salary') ||
                   t.includes('career-average') || t.includes('occupational') ||
                   t.includes('workplace-dc') || t.includes('workplace dc');
      if (isDB) {
        return {
          it: 'Pension paid taxed as income above your personal allowance.',
          cgt: 'No capital gains tax inside the pension.',
          iht: `${PENSION_IHT_PRE_2027} ${PENSION_IHT_FROM_2027} Spouse pension generally untaxed.`,
          hints: [{ term: 'personal allowance', explainerId: HINT.PA }],
          confidence: 1.0,
        };
      }
      if (isCrystallised) {
        return {
          it: 'Drawdown taxed as income above your personal allowance. 25% tax-free portion may apply on uncrystallised slices.',
          cgt: 'No capital gains tax inside the pension.',
          iht: `${PENSION_IHT_PRE_2027} ${PENSION_IHT_FROM_2027}`,
          hints: [{ term: 'personal allowance', explainerId: HINT.PA }],
          confidence: 1.0,
        };
      }
      return {
        it: 'Growth is tax-deferred. Future withdrawals taxed as income (25% tax-free portion available).',
        cgt: 'No capital gains tax inside the pension wrapper.',
        iht: `${PENSION_IHT_PRE_2027} ${PENSION_IHT_FROM_2027}`,
        hints: [
          { term: 'annual allowance', explainerId: HINT.AA },
          { term: 'pension wrapper', explainerId: HINT.SIPP },
        ],
        confidence: 1.0,
      };
    }

    case 'STATE':
      return {
        it: 'State pension taxed as income above your personal allowance.',
        cgt: 'No capital gains tax — state pension has no asset value.',
        iht: 'Not in your estate — entitlement ends on death.',
        hints: [{ term: 'personal allowance', explainerId: HINT.PA }],
        confidence: 1.0,
      };

    case 'ISA':
      return {
        it: 'Income and growth tax-free inside the ISA.',
        cgt: 'Gains exempt — no CGT inside the ISA.',
        iht: 'In your estate. A spouse can inherit your full ISA allowance under APS.',
        hints: [{ term: 'APS', explainerId: HINT.APS }],
        confidence: 1.0,
      };

    case 'GIA': {
      const hasBPR = !!asset?.qualifies_for_bpr || !!asset?.bpr;
      if (hasBPR) {
        return {
          it: 'Income (dividends/interest) taxed at your marginal rate.',
          cgt: 'Gains above the annual exempt amount taxed at 18% / 24%.',
          iht: '100% relief under Business Relief after a 2-year qualifying hold (subject to £2.5m combined cap from April 2026).',
          hints: [
            { term: 'annual exempt amount', explainerId: HINT.AEA },
            { term: 'Business Relief', explainerId: HINT.BPR },
          ],
          confidence: 1.0,
        };
      }
      return {
        it: 'Income (dividends/interest) taxed at your marginal rate.',
        cgt: 'Gains above the annual exempt amount taxed at 18% / 24%.',
        iht: 'In your estate at market value.',
        hints: [{ term: 'annual exempt amount', explainerId: HINT.AEA }],
        confidence: 1.0,
      };
    }

    case 'BOND_ON':
      return {
        it: 'Basic-rate tax paid inside the bond (20% credit on encashment). Chargeable-event gains taxable at marginal rate above the basic-rate band; top-slicing relief may apply.',
        cgt: 'Not subject to CGT — taxed under the chargeable-event regime instead.',
        iht: 'In your estate at surrender value (unless held in trust).',
        hints: [],
        confidence: 1.0,
      };

    case 'BOND_OFF':
      return {
        it: 'No tax deducted inside the bond — gross roll-up. Chargeable-event gains fully taxable at marginal rate; top-slicing relief may apply.',
        cgt: 'Not subject to CGT — taxed under the chargeable-event regime instead.',
        iht: 'In your estate at surrender value (unless held in trust).',
        hints: [],
        confidence: 1.0,
      };

    case 'EIS':
      return {
        it: '30% income tax relief on subscription (held 3 years).',
        cgt: 'Gains tax-free on disposal after 3 years. Loss relief available against income or gains.',
        iht: '100% Business Relief after a 2-year qualifying hold (subject to £2.5m combined cap from April 2026).',
        hints: [{ term: 'Business Relief', explainerId: HINT.BPR }],
        confidence: 1.0,
      };

    case 'SEIS':
      return {
        it: '50% income tax relief on subscription (held 3 years). CGT reinvestment relief on 50% of gain reinvested.',
        cgt: 'Gains tax-free on disposal after 3 years.',
        iht: '100% Business Relief after a 2-year qualifying hold (subject to £2.5m combined cap from April 2026).',
        hints: [{ term: 'Business Relief', explainerId: HINT.BPR }],
        confidence: 1.0,
      };

    case 'VCT':
      return {
        it: '20% income tax relief on subscription (held 5 years) — reduced from 30% in April 2026. Dividends tax-free.',
        cgt: 'Gains tax-free on disposal.',
        iht: 'In your estate at market value — no Business Relief on VCTs.',
        hints: [],
        confidence: 1.0,
      };

    case 'PROPERTY': {
      const use = String(asset?.use || asset?.purpose || '').toLowerCase();
      const isBTL = t.includes('btl') || use.includes('btl') || use.includes('rental') || use.includes('let');
      const isResidence = t.includes('residence') || use.includes('main') || use.includes('home') || use.includes('ppr');
      if (isBTL) {
        return {
          it: 'Rental income taxed as non-savings income. Mortgage interest restricted to a 20% basic-rate credit (S24).',
          cgt: 'Gains on disposal taxed at 18% / 24%. 60-day reporting required. PPR not available.',
          iht: 'In your estate at market value.',
          hints: [
            { term: 'S24 mortgage restriction', explainerId: HINT.S24 },
          ],
          confidence: 1.0,
        };
      }
      if (isResidence) {
        return {
          it: 'Not income-producing — no income tax (unless let).',
          cgt: 'Private Residence Relief covers periods of main-home occupation.',
          iht: 'In your estate. Residence nil-rate band may apply when passed to direct descendants.',
          hints: [
            { term: 'Private Residence Relief', explainerId: HINT.PPR },
            { term: 'residence nil-rate band', explainerId: HINT.RNRB },
          ],
          confidence: 1.0,
        };
      }
      return {
        it: 'Rental income (if any) taxed as non-savings income. Mortgage interest restricted on residential lets (S24).',
        cgt: 'Gains on disposal taxed at 18% / 24%. 60-day reporting required.',
        iht: 'In your estate at market value. Residence nil-rate band may apply if residential.',
        hints: [
          { term: 'S24 mortgage restriction', explainerId: HINT.S24 },
          { term: 'residence nil-rate band', explainerId: HINT.RNRB },
        ],
        confidence: 0.8,
      };
    }

    case 'CASH':
      return {
        it: 'Interest taxed as savings income. Personal Savings Allowance (£1k basic / £500 higher / £0 additional) may apply.',
        cgt: 'No capital gains tax on cash deposits.',
        iht: 'In your estate at balance.',
        hints: [{ term: 'Personal Savings Allowance', explainerId: HINT.PSA }],
        confidence: 1.0,
      };

    case 'TRUST':
      return {
        it: 'Income tax treatment depends on trust type — settlor-interested, discretionary, life-interest each differ.',
        cgt: 'Trustees assessed on gains. Holdover relief may apply on transfers in.',
        iht: 'Outside your estate after 7 years from gift, subject to the relevant property regime (10-year and exit charges).',
        hints: [],
        confidence: 0.8,
      };

    case 'UNKNOWN':
    case null:
    case undefined:
      return {
        it: 'We can\'t yet work out income tax — wrapper not resolved.',
        cgt: 'We can\'t yet work out capital gains tax — wrapper not resolved.',
        iht: 'We can\'t yet work out inheritance tax — wrapper not resolved.',
        hints: [],
        confidence: 0,
      };

    default:
      return {
        it: 'Income taxed at marginal rate.',
        cgt: 'Gains above the annual exempt amount taxed at 18% / 24%.',
        iht: 'In your estate at market value.',
        hints: [{ term: 'annual exempt amount', explainerId: HINT.AEA }],
        confidence: 0.5,
      };
  }
}
