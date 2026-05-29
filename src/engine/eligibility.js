// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH ELIGIBILITY ENGINE
//
// Registry of UK conditional/eligibility rules that gate access to allowances,
// reliefs and pension/benefit amounts. Each rule:
//   - predicate(persona, asOfDate)    → graded result
//   - applicability(persona)          → does this rule apply at all?
//   - savings(persona, asOfDate)      → £ impact of NOT qualifying (for Optimiser)
//   - optimiserHook(persona)          → what to surface in Optimiser if user doesn't qualify
//
// Predicate result shape:
//   {
//     qualifies: 'YES' | 'NO' | 'PARTIAL' | 'NA',
//     grade: 0..1,                   // for PARTIAL — how close (0.62 for 22/35 NI years)
//     applicableAmount: number,      // e.g. state pension £ given partial NI record
//     reason: string,                // plain-English explanation
//     fixHint: string,               // actionable Optimiser hint if NOT/PARTIAL
//   }
//
// Eligibility rules return data — they do not throw or modify the engine state.
// Callers decide what to do with PARTIAL/NO verdicts.
// ─────────────────────────────────────────────────────────────────────────────

const TAX_YEAR_END = '04-05';   // April 5, end of UK tax year
const STATE_PENSION_FULL_QUAL_YEARS = 35;
const STATE_PENSION_MIN_QUAL_YEARS = 10;

const _registry = new Map();

export function registerRule(rule) {
  if (!rule.id) throw new Error('eligibility rule needs id');
  if (typeof rule.predicate !== 'function') throw new Error(`rule ${rule.id} needs predicate fn`);
  _registry.set(rule.id, rule);
}

export function getRule(id) { return _registry.get(id); }
export function listRules(filter) {
  const all = [...new Map(_registry).values()];
  return filter ? all.filter(filter) : all;
}

export function evaluate(personaOrId, asOfDate = new Date(), filter) {
  const rules = listRules(filter);
  const results = [];
  for (const rule of rules) {
    if (rule.applicability && !rule.applicability(personaOrId)) continue;
    try {
      const r = rule.predicate(personaOrId, asOfDate);
      results.push({ id: rule.id, title: rule.title, category: rule.category, ...r });
    } catch (e) {
      results.push({ id: rule.id, qualifies: 'NA', reason: `eval error: ${e.message}` });
    }
  }
  return results;
}

// Helper: compute persona age at a given date
function ageAt(persona, asOfDate) {
  if (persona.dob) {
    const dob = new Date(persona.dob);
    let years = asOfDate.getFullYear() - dob.getFullYear();
    if (asOfDate.getMonth() < dob.getMonth() ||
       (asOfDate.getMonth() === dob.getMonth() && asOfDate.getDate() < dob.getDate())) years--;
    return years;
  }
  return persona.age ?? null;
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return '£' + Math.round(n).toLocaleString('en-GB');
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE 1 — NI QUALIFYING YEARS → STATE PENSION ENTITLEMENT
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'NI-QUAL-YEARS',
  title: 'State Pension qualifying years',
  category: 'pension',
  description: 'New State Pension requires 35 years of NI contributions for full amount, minimum 10 for any. Partial years pro-rata.',
  applicability: (p) => true,  // affects every persona who will/does claim state pension
  predicate: (p, asOfDate) => {
    const years = p.ni?.qualifying_years
               ?? p.individual?.state_pension_accrued_years
               ?? STATE_PENSION_FULL_QUAL_YEARS;  // default: assume full record
    const full = STATE_PENSION_FULL_QUAL_YEARS;
    const min = STATE_PENSION_MIN_QUAL_YEARS;
    const fullAmount = 12548;  // 2025/26 New State Pension full weekly × 52
    if (years >= full) {
      return { qualifies: 'YES', grade: 1.0, applicableAmount: fullAmount,
               reason: `${years} NI years ≥ ${full} required for full state pension`,
               fixHint: null };
    }
    if (years < min) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `${years} NI years < ${min} minimum — no state pension entitlement`,
               fixHint: `Buy voluntary Class 3 NI years: need ${min - years} more @ £907.40/yr = ${fmt((min - years) * 907.40)}` };
    }
    const grade = years / full;
    const amount = Math.round(grade * fullAmount);
    const missingYears = full - years;
    const cost = Math.round(missingYears * 907.40);
    const benefit = Math.round((1 - grade) * fullAmount);
    return { qualifies: 'PARTIAL', grade, applicableAmount: amount,
             reason: `${years}/${full} NI years → ${fmt(amount)}/yr (${(grade*100).toFixed(0)}% of full)`,
             fixHint: `Buy ${missingYears} voluntary Class 3 NI years for ${fmt(cost)} → recovers ${fmt(benefit)}/yr state pension. Payback ~${(cost/benefit).toFixed(1)} years.` };
  },
  savings: (p, asOfDate) => {
    const r = _registry.get('NI-QUAL-YEARS').predicate(p, asOfDate);
    if (r.qualifies === 'YES') return 0;
    return Math.round((1 - r.grade) * 12548);  // £/yr lost in state pension
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-D05',
    title: 'Buy back missing NI years',
    estimatedSavingPerYear: _registry.get('NI-QUAL-YEARS').savings(p, new Date()),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 2 — PERSONAL ALLOWANCE TAPER £100k-£125,140
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'PA-TAPER',
  title: 'Personal Allowance taper (£100k-£125,140)',
  category: 'income_tax',
  description: 'PA reduces £1 for every £2 of adjusted net income over £100k. Fully lost at £125,140. Effective marginal rate of 60% in this band.',
  applicability: (p) => {
    const income = (p.targetIncome ?? 0) + (p.income?.salary ?? 0) + (p.income?.bonus ?? 0);
    return income >= 100000;
  },
  predicate: (p, asOfDate) => {
    const PA = 12570;
    const TAPER_START = 100000;
    const TAPER_END = 125140;
    const income = (p.targetIncome ?? 0) + (p.income?.salary ?? 0) + (p.income?.bonus ?? 0);
    if (income < TAPER_START) {
      return { qualifies: 'YES', grade: 1.0, applicableAmount: PA,
               reason: `Income ${fmt(income)} < £100,000 — full PA retained`,
               fixHint: null };
    }
    if (income >= TAPER_END) {
      const lost = PA;
      const taxCost = Math.round(lost * 0.40);  // PA at 40% = £5,028
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Income ${fmt(income)} ≥ ${fmt(TAPER_END)} — PA fully lost (£${PA} × 40% = ${fmt(taxCost)} extra tax)`,
               fixHint: `Salary-sacrifice ${fmt(income - TAPER_START)} into pension to bring income to £100k. Recovers full PA + saves NI = ~${fmt((income - TAPER_START) * 0.6)}/yr` };
    }
    const reduction = (income - TAPER_START) / 2;
    const effPA = Math.max(0, PA - reduction);
    const grade = effPA / PA;
    const lostPA = PA - effPA;
    const taxCost = Math.round(lostPA * 0.40);
    return { qualifies: 'PARTIAL', grade, applicableAmount: effPA,
             reason: `Income ${fmt(income)} in taper band — PA reduced to ${fmt(effPA)} (lost ${fmt(lostPA)})`,
             fixHint: `Sacrifice ${fmt(income - TAPER_START)} into pension → recover full PA. Effective 60% marginal saved on the sacrificed amount.` };
  },
  savings: (p) => {
    const r = _registry.get('PA-TAPER').predicate(p, new Date());
    if (r.qualifies === 'YES') return 0;
    return Math.round((12570 - r.applicableAmount) * 0.40);
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-A01',
    title: 'Escape the £100k taper trap',
    estimatedSavingPerYear: _registry.get('PA-TAPER').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 3 — HICBC (High Income Child Benefit Charge)
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'HICBC',
  title: 'High Income Child Benefit Charge',
  category: 'income_tax',
  description: 'HICBC claws back Child Benefit if highest earner in household > £60k (from Apr 2024; was £50k). Fully clawed back at £80k.',
  applicability: (p) => {
    const dependants = p.dependants ?? 0;
    const childBenefitClaimed = p.benefits?.child_benefit_claimed ?? (dependants > 0);  // default: claimed if children
    return childBenefitClaimed && dependants > 0;
  },
  predicate: (p, asOfDate) => {
    // Threshold depends on year
    const year = asOfDate.getFullYear();
    const lower = year >= 2024 ? 60000 : 50000;
    const upper = year >= 2024 ? 80000 : 60000;
    const taperRange = upper - lower;
    const dependants = p.dependants ?? 0;
    const CB_PER_CHILD_FIRST = 26.05 * 52;     // 2025/26 weekly × 52
    const CB_PER_CHILD_OTHER = 17.25 * 52;
    const cbAnnual = dependants === 0 ? 0
                  : CB_PER_CHILD_FIRST + Math.max(0, dependants - 1) * CB_PER_CHILD_OTHER;
    const income = (p.targetIncome ?? 0) + (p.income?.salary ?? 0) + (p.income?.bonus ?? 0);

    if (income <= lower) {
      return { qualifies: 'YES', grade: 1.0, applicableAmount: cbAnnual,
               reason: `Income ${fmt(income)} ≤ ${fmt(lower)} threshold — full Child Benefit kept (${fmt(cbAnnual)}/yr)`,
               fixHint: null };
    }
    if (income >= upper) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Income ${fmt(income)} ≥ ${fmt(upper)} — Child Benefit fully clawed back (${fmt(cbAnnual)}/yr lost)`,
               fixHint: `Salary-sacrifice ${fmt(income - lower)} into pension to bring income below threshold. Recovers full CB.` };
    }
    const taperRatio = (income - lower) / taperRange;
    const charge = cbAnnual * taperRatio;
    const kept = cbAnnual - charge;
    return { qualifies: 'PARTIAL', grade: 1 - taperRatio, applicableAmount: kept,
             reason: `Income ${fmt(income)} in HICBC taper — CB charge ${fmt(charge)}, kept ${fmt(kept)}`,
             fixHint: `Reduce taxable income by ${fmt(income - lower)} (pension sacrifice) → save full ${fmt(charge)}/yr` };
  },
  savings: (p, asOfDate = new Date()) => {
    const r = _registry.get('HICBC').predicate(p, asOfDate);
    if (r.qualifies === 'YES' || r.qualifies === 'NA') return 0;
    const dependants = p.dependants ?? 0;
    const cbAnnual = dependants === 0 ? 0 : 26.05*52 + Math.max(0, dependants-1)*17.25*52;
    return Math.round(cbAnnual - r.applicableAmount);
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-A07',
    title: 'Avoid HICBC clawback',
    estimatedSavingPerYear: _registry.get('HICBC').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 4 — RNRB (Residence Nil-Rate Band) — direct descendant requirement
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'RNRB-DESCENDANT',
  title: 'RNRB direct-descendant requirement',
  category: 'iht',
  description: 'RNRB (£175k/£350k couple) only applies if main residence passes to direct descendants (children, grandchildren, including step/adopted/foster).',
  applicability: (p) => true,  // affects every estate
  predicate: (p, asOfDate) => {
    const RNRB = 175000;
    const property = p.assets?.residence?.value ?? p.assets?.property?.value ?? 0;
    const dependants = p.dependants ?? 0;
    const hasDirectDescendants = p.beneficiaries?.includes('direct_descendants')
                               ?? p.hasDirectDescendants
                               ?? (dependants > 0);

    if (property === 0) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: 'No primary residence in estate — RNRB does not apply',
               fixHint: null };
    }
    if (!hasDirectDescendants) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Property ${fmt(property)} in estate but no direct descendants — RNRB lost (${fmt(RNRB)} = ${fmt(RNRB*0.40)} IHT cost)`,
               fixHint: 'RNRB requires children/grandchildren (including step, adopted, foster, spouse of deceased descendant). If no eligible heirs: consider charity 10% rule or BPR strategies instead.' };
    }
    return { qualifies: 'YES', grade: 1.0, applicableAmount: RNRB,
             reason: `Property in estate + direct descendants — RNRB ${fmt(RNRB)} applies (saves ${fmt(RNRB*0.40)} IHT)`,
             fixHint: null };
  },
  savings: (p, asOfDate = new Date()) => {
    const r = _registry.get('RNRB-DESCENDANT').predicate(p, asOfDate);
    if (r.qualifies !== 'NO') return 0;
    return Math.round(175000 * 0.40);  // £70,000 IHT cost from losing RNRB
  },
  optimiserHook: null,  // no actionable fix beyond family planning
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 5 — RNRB taper above £2M estate
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'RNRB-TAPER',
  title: 'RNRB tapered above £2M estate',
  category: 'iht',
  description: 'RNRB reduces £1 for every £2 of gross estate above £2M. Fully lost at £2.35M (single) / £2.7M (couple combined).',
  applicability: (p) => {
    const gross = p.assets ? Object.values(p.assets).reduce((s, a) => {
      if (typeof a === 'object' && a) return s + (a.value ?? a.total ?? 0);
      return s;
    }, 0) : 0;
    return gross >= 2000000;
  },
  predicate: (p, asOfDate) => {
    const TAPER_START = 2000000;
    const RNRB_BASE = 175000;
    const isCouple = !!p.isCouple;
    const maxRnrb = isCouple ? 350000 : RNRB_BASE;
    const TAPER_END = TAPER_START + (maxRnrb * 2);   // £2.35M single, £2.7M couple

    const gross = p.assets ? Object.values(p.assets).reduce((s, a) => {
      if (typeof a === 'object' && a) return s + (a.value ?? a.total ?? 0);
      return s;
    }, 0) : 0;

    if (gross < TAPER_START) {
      return { qualifies: 'YES', grade: 1.0, applicableAmount: maxRnrb,
               reason: `Estate ${fmt(gross)} < £2M — full RNRB ${fmt(maxRnrb)} retained`,
               fixHint: null };
    }
    if (gross >= TAPER_END) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Estate ${fmt(gross)} ≥ ${fmt(TAPER_END)} — RNRB fully tapered away (${fmt(maxRnrb * 0.40)} IHT cost)`,
               fixHint: `Reduce gross estate below £2M via lifetime gifts, BPR-qualifying investments, or charity bequest. Each £2 reduction restores £1 of RNRB → £0.40 IHT.` };
    }
    const taper = (gross - TAPER_START) / 2;
    const effRnrb = Math.max(0, maxRnrb - taper);
    const grade = effRnrb / maxRnrb;
    const lostRnrb = maxRnrb - effRnrb;
    return { qualifies: 'PARTIAL', grade, applicableAmount: effRnrb,
             reason: `Estate ${fmt(gross)} in RNRB taper — RNRB reduced to ${fmt(effRnrb)} (lost ${fmt(lostRnrb)})`,
             fixHint: `Reduce estate by ${fmt(gross - TAPER_START)} to restore full RNRB. Each £2 reduction → £1 RNRB → £0.40 IHT saved.` };
  },
  savings: (p) => {
    const r = _registry.get('RNRB-TAPER').predicate(p, new Date());
    if (r.qualifies === 'YES' || r.qualifies === 'NA') return 0;
    const isCouple = !!p.isCouple;
    const maxRnrb = isCouple ? 350000 : 175000;
    return Math.round((maxRnrb - r.applicableAmount) * 0.40);
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-E05',
    title: 'Reduce estate below £2M to keep RNRB',
    estimatedSavingPerYear: 0,  // lifetime save
    estimatedLifetimeSaving: _registry.get('RNRB-TAPER').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 6 — 7-YEAR PET (Potentially Exempt Transfer) clock with taper
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'PET-7YR-CLOCK',
  title: '7-year PET clock with taper relief',
  category: 'iht',
  description: 'Gifts to individuals (PETs) become IHT-exempt 7 years after the gift. Tapered IHT relief applies between years 3-7. Each gift has its own clock.',
  applicability: (p) => Array.isArray(p.gifts) && p.gifts.length > 0,
  predicate: (p, asOfDate) => {
    const gifts = p.gifts || [];
    const today = asOfDate;
    const taperBands = [
      { minYrs: 0, maxYrs: 3, rate: 0.40 },     // full IHT
      { minYrs: 3, maxYrs: 4, rate: 0.32 },     // 20% relief
      { minYrs: 4, maxYrs: 5, rate: 0.24 },     // 40% relief
      { minYrs: 5, maxYrs: 6, rate: 0.16 },     // 60% relief
      { minYrs: 6, maxYrs: 7, rate: 0.08 },     // 80% relief
      { minYrs: 7, maxYrs: Infinity, rate: 0 }, // exempt
    ];
    let totalAtRisk = 0, totalIhtIfDeathNow = 0;
    const details = [];
    for (const g of gifts) {
      const giftDate = new Date(g.date);
      const yrsAgo = (today - giftDate) / (365.25 * 86400000);
      const band = taperBands.find(b => yrsAgo >= b.minYrs && yrsAgo < b.maxYrs);
      const iht = g.amount * band.rate;
      totalAtRisk += g.amount;
      totalIhtIfDeathNow += iht;
      details.push(`£${g.amount.toLocaleString()} given ${yrsAgo.toFixed(1)}y ago → ${band.rate * 100}% IHT if death now (${fmt(iht)})`);
    }
    if (totalIhtIfDeathNow === 0) {
      return { qualifies: 'YES', grade: 1, applicableAmount: totalAtRisk,
               reason: `All ${gifts.length} gift(s) totalling ${fmt(totalAtRisk)} are >7y old or exempt — IHT-free`,
               fixHint: null };
    }
    return { qualifies: 'PARTIAL', grade: 1 - (totalIhtIfDeathNow / (totalAtRisk * 0.40)),
             applicableAmount: totalAtRisk,
             reason: `${gifts.length} gifts in 7-yr window: ${details.join('; ')}. Total IHT if death now: ${fmt(totalIhtIfDeathNow)}`,
             fixHint: `Survive each gift's 7-year clock. Consider gift inter vivos insurance to cover IHT in interim.` };
  },
  savings: (p, asOfDate = new Date()) => {
    const r = _registry.get('PET-7YR-CLOCK').predicate(p, asOfDate);
    return r.qualifies === 'PARTIAL' ? Math.round((1 - r.grade) * 0.40 * (r.applicableAmount || 0)) : 0;
  },
  optimiserHook: null,
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 7 — MPAA (Money Purchase Annual Allowance) trigger
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'MPAA',
  title: 'MPAA reduces Annual Allowance to £10k',
  category: 'pension',
  description: 'Flexibly accessing pension (UFPLS, flexi-access drawdown income, certain lump sums) triggers MPAA. AA drops from £60k to £10k for money purchase contributions.',
  applicability: (p) => (p.assets?.sipp?.total ?? 0) > 0 || (p.assets?.pensions?.length ?? 0) > 0,
  predicate: (p, asOfDate) => {
    const triggered = p.pension?.mpaa_triggered
                   ?? (p.drawdown > 0 && p.drawdownPlan?.method === 'flexi-access');
    const normalAA = 60000;
    const mpaa = 10000;
    if (triggered) {
      return { qualifies: 'NO', grade: 0, applicableAmount: mpaa,
               reason: `MPAA triggered — annual money-purchase contributions capped at ${fmt(mpaa)} (was ${fmt(normalAA)})`,
               fixHint: `If income permits, use UFPLS slicing (25% TFC + 75% taxable) — does not trigger MPAA for some structures. Or take 25% TFC only (crystallise) without drawing taxable income.` };
    }
    return { qualifies: 'YES', grade: 1, applicableAmount: normalAA,
             reason: `MPAA not triggered — full AA ${fmt(normalAA)} available`,
             fixHint: null };
  },
  savings: (p) => {
    // Annual cost = lost AA × marginal relief rate, but only if user wants/needs to contribute more
    const r = _registry.get('MPAA').predicate(p, new Date());
    if (r.qualifies !== 'NO') return 0;
    const wantsToContribute = (p.pension?.intended_annual_contribution ?? 0) > 10000;
    return wantsToContribute ? Math.round((p.pension.intended_annual_contribution - 10000) * 0.40) : 0;
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-D04',
    title: 'Avoid MPAA trigger',
    estimatedSavingPerYear: _registry.get('MPAA').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 8 — Marriage Allowance eligibility
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'MARRIAGE-ALLOWANCE',
  title: 'Marriage Allowance transfer',
  category: 'income_tax',
  description: 'Transfer £1,260 of PA from one spouse to another. Worth £252/yr. Both must be married/CP. Transferring spouse must earn ≤ PA. Receiving spouse must be basic-rate (≤ £50,270).',
  applicability: (p) => !!p.isCouple,
  predicate: (p, asOfDate) => {
    const inc1 = (p.targetIncome ?? 0) + (p.income?.salary ?? 0);
    const inc2 = (p.spouse?.income?.salary ?? 0) + (p.spouse?.targetIncome ?? 0);
    const PA = 12570;
    const BRT = 50270;
    const ALLOWANCE = 1260;
    const SAVING = 252;
    const [lower, higher] = inc1 <= inc2 ? [inc1, inc2] : [inc2, inc1];
    if (lower > PA) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Lower-earning spouse ${fmt(lower)} > PA ${fmt(PA)} — both fully using own PA`,
               fixHint: null };
    }
    if (higher > BRT) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Higher-earning spouse ${fmt(higher)} > BRT ${fmt(BRT)} — Marriage Allowance disqualified`,
               fixHint: 'Reduce higher earner via pension sacrifice to below basic-rate threshold → restores Marriage Allowance eligibility.' };
    }
    return { qualifies: 'YES', grade: 1, applicableAmount: SAVING,
             reason: `Lower spouse ${fmt(lower)} ≤ PA, higher ${fmt(higher)} ≤ BRT → eligible. ${fmt(SAVING)}/yr saving.`,
             fixHint: p.marriage_allowance_claimed ? null : 'Claim Marriage Allowance via HMRC personal tax account (5 min). Can backdate 4 years = £1,008 refund.' };
  },
  savings: (p) => {
    const r = _registry.get('MARRIAGE-ALLOWANCE').predicate(p, new Date());
    return r.qualifies === 'YES' && !p.marriage_allowance_claimed ? 252 : 0;
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-A06',
    title: 'Claim Marriage Allowance',
    estimatedSavingPerYear: _registry.get('MARRIAGE-ALLOWANCE').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 9 — SDLT FTB (First-Time Buyer) relief
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'SDLT-FTB',
  title: 'SDLT first-time buyer relief',
  category: 'property',
  description: 'First-time buyer in UK (never owned residential property anywhere in world) gets SDLT relief: 0% to £300k, 5% £300k-£500k. Lost entirely above £500k.',
  applicability: (p) => p.intended_property_purchase != null || p.lifeStage === 1 /* foundation */,
  predicate: (p, asOfDate) => {
    const isFTB = p.first_time_buyer ?? (p.assets?.residence?.value == null && p.assets?.property == null);
    const intendedPrice = p.intended_property_purchase?.price ?? 0;
    if (!isFTB) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: 'Has owned property before — FTB relief unavailable',
               fixHint: null };
    }
    if (intendedPrice === 0) {
      return { qualifies: 'YES', grade: 1, applicableAmount: 15000,
               reason: 'Eligible FTB — up to £15,000 SDLT saving available on next purchase up to £500k',
               fixHint: 'Use FTB relief on first purchase (one-time, lifetime). Stay below £500k threshold.' };
    }
    if (intendedPrice > 500000) {
      const standardSDLT = standardSdlt(intendedPrice);
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Intended price ${fmt(intendedPrice)} > £500k — FTB relief lost entirely. Standard SDLT: ${fmt(standardSDLT)}`,
               fixHint: 'Below £500k = FTB relief works. Above £500k = pay full standard SDLT.' };
    }
    const ftbSDLT = Math.max(0, (intendedPrice - 300000) * 0.05);
    const standardSDLT = standardSdlt(intendedPrice);
    const saving = standardSDLT - ftbSDLT;
    return { qualifies: 'YES', grade: 1, applicableAmount: saving,
             reason: `Purchase ${fmt(intendedPrice)}: FTB SDLT ${fmt(ftbSDLT)} vs standard ${fmt(standardSDLT)} → saves ${fmt(saving)}`,
             fixHint: null };
  },
  savings: (p) => {
    const r = _registry.get('SDLT-FTB').predicate(p, new Date());
    return r.qualifies === 'YES' ? r.applicableAmount : 0;
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-P04',
    title: 'Use SDLT first-time buyer relief',
    estimatedLifetimeSaving: _registry.get('SDLT-FTB').savings(p),
  }),
});

function standardSdlt(price) {
  let sdlt = 0;
  if (price > 250000) sdlt += Math.min(price - 250000, 675000) * 0.05;
  if (price > 925000) sdlt += Math.min(price - 925000, 575000) * 0.10;
  if (price > 1500000) sdlt += (price - 1500000) * 0.12;
  return Math.round(sdlt);
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE 10 — BPR (Business Property Relief) 2-year holding period
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'BPR-2YR-HOLDING',
  title: 'BPR 2-year holding requirement',
  category: 'iht',
  description: 'Business Property Relief: 100% IHT exemption on qualifying business/AIM shares held for ≥2 years. From April 2026: £2.5M combined APR/BPR allowance, then 50% relief.',
  applicability: (p) => {
    const aim = p.assets?.aim_portfolio?.value ?? 0;
    const business = p.assets?.business?.value ?? 0;
    return (aim + business) > 0;
  },
  predicate: (p, asOfDate) => {
    const aim = p.assets?.aim_portfolio ?? {};
    const business = p.assets?.business ?? {};
    const aimValue = aim.value ?? 0;
    const businessValue = business.value ?? 0;
    const totalBpr = aimValue + businessValue;
    if (totalBpr === 0) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: 'No BPR-qualifying assets', fixHint: null };
    }
    const aimAcquired = aim.acquired_date ? new Date(aim.acquired_date) : null;
    const businessAcquired = business.acquired_date ? new Date(business.acquired_date) : null;
    const aimYrs = aimAcquired ? (asOfDate - aimAcquired) / (365.25 * 86400000) : null;
    const businessYrs = businessAcquired ? (asOfDate - businessAcquired) / (365.25 * 86400000) : null;
    const aimQualified = aimYrs == null || aimYrs >= 2;
    const businessQualified = businessYrs == null || businessYrs >= 2;
    const qualifiedValue = (aimQualified ? aimValue : 0) + (businessQualified ? businessValue : 0);
    const ihtSaved = Math.round(qualifiedValue * 0.40);
    if (qualifiedValue === totalBpr) {
      return { qualifies: 'YES', grade: 1, applicableAmount: qualifiedValue,
               reason: `${fmt(qualifiedValue)} BPR-qualifying (held ≥2y) — saves ${fmt(ihtSaved)} IHT`,
               fixHint: null };
    }
    if (qualifiedValue === 0) {
      const earliestQualify = aimAcquired || businessAcquired;
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `BPR assets ${fmt(totalBpr)} held <2y — full IHT exposure (${fmt(totalBpr * 0.40)})`,
               fixHint: earliestQualify ? `Hold until ${new Date(earliestQualify.getTime() + 2*365.25*86400000).toISOString().slice(0,10)} for BPR qualification.` : 'Hold for 2+ years.' };
    }
    return { qualifies: 'PARTIAL', grade: qualifiedValue / totalBpr, applicableAmount: qualifiedValue,
             reason: `${fmt(qualifiedValue)} of ${fmt(totalBpr)} BPR-qualifying. ${fmt((totalBpr - qualifiedValue) * 0.40)} IHT exposure remains.`,
             fixHint: 'Wait until newer holdings cross 2-year threshold.' };
  },
  savings: (p) => {
    const r = _registry.get('BPR-2YR-HOLDING').predicate(p, new Date());
    if (r.qualifies !== 'NO' && r.qualifies !== 'PARTIAL') return 0;
    const aim = p.assets?.aim_portfolio?.value ?? 0;
    const business = p.assets?.business?.value ?? 0;
    return Math.round((aim + business - r.applicableAmount) * 0.40);
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-E02',
    title: 'Hold AIM/business 2+ yrs for BPR',
    estimatedLifetimeSaving: _registry.get('BPR-2YR-HOLDING').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 11 — Charity 10% IHT rate reduction
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'CHARITY-10-PCT',
  title: 'Charity 10% IHT rate reduction',
  category: 'iht',
  description: 'Leaving ≥10% of NET estate (after NRB and other reliefs) to charity reduces IHT rate from 40% to 36%.',
  applicability: (p) => true,
  predicate: (p, asOfDate) => {
    const charityBequest = p.will?.charity_bequest ?? 0;
    const grossEstate = p.assets ? Object.values(p.assets).reduce((s, a) => {
      if (typeof a === 'object' && a) return s + (a.value ?? a.total ?? 0); return s;
    }, 0) : 0;
    const NRB = p.isCouple ? 650000 : 325000;
    const RNRB = p.isCouple ? 350000 : 175000;
    const netEstate = Math.max(0, grossEstate - NRB - RNRB);
    if (netEstate === 0) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: 'No taxable estate — charity rule N/A', fixHint: null };
    }
    const requiredCharityBequest = netEstate * 0.10;
    if (charityBequest >= requiredCharityBequest) {
      const ihtAtFull = netEstate * 0.40;
      const ihtAtReduced = (netEstate - charityBequest) * 0.36;
      const saving = ihtAtFull - ihtAtReduced - charityBequest;
      return { qualifies: 'YES', grade: 1, applicableAmount: saving,
               reason: `Charity ${fmt(charityBequest)} ≥ 10% of net estate ${fmt(netEstate)} → IHT rate drops 40%→36% on remainder. Family net saving: ${fmt(saving)} (charity gets ${fmt(charityBequest)}).`,
               fixHint: null };
    }
    const gap = requiredCharityBequest - charityBequest;
    const ihtAtFull = netEstate * 0.40;
    const ihtAtReduced = (netEstate - requiredCharityBequest) * 0.36;
    const familySavingIfDone = ihtAtFull - ihtAtReduced - requiredCharityBequest;
    if (familySavingIfDone <= 0) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: 'At current estate size, charity 10% rule reduces family inheritance net of charity — strategy only useful for very large taxable estates.',
               fixHint: null };
    }
    return { qualifies: 'NO', grade: 0, applicableAmount: 0,
             reason: `Charity ${fmt(charityBequest)} < 10% needed (${fmt(requiredCharityBequest)})`,
             fixHint: `Increase charity bequest by ${fmt(gap)} to qualify. Charity gains ${fmt(requiredCharityBequest)}, family net gains ${fmt(familySavingIfDone)} extra.` };
  },
  savings: (p) => {
    const r = _registry.get('CHARITY-10-PCT').predicate(p, new Date());
    return r.qualifies === 'YES' ? r.applicableAmount : 0;
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-E03',
    title: 'Charity 10% rule — IHT 40%→36%',
    estimatedLifetimeSaving: _registry.get('CHARITY-10-PCT').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 12 — Statutory Residence Test (simplified)
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'SRT-RESIDENCE',
  title: 'Statutory Residence Test',
  category: 'residency',
  description: 'UK tax residence based on (1) automatic overseas test, (2) automatic UK test, (3) sufficient ties test. Determines whether worldwide or UK-source income is taxed.',
  applicability: (p) => p.jurisdictionContext?.secondary != null || p.archetype?.includes('cross-border') || !!p.uk_days_in_year,
  predicate: (p, asOfDate) => {
    const ukDays = p.uk_days_in_year ?? p.srt?.uk_days ?? null;
    const wasUkResident = p.srt?.previously_resident ?? null;
    const ties = p.srt?.ties ?? null;  // array: ['family','accommodation','work','90day','country']

    if (ukDays == null) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: 'UK days not recorded — SRT cannot be determined',
               fixHint: 'Track UK days for tax year. Document family/accommodation/work ties.' };
    }
    // Automatic overseas tests
    if (wasUkResident && ukDays < 16) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0, // not UK resident
               reason: `Prior UK resident + ${ukDays} UK days < 16 → automatic non-resident`,
               fixHint: null };
    }
    if (!wasUkResident && ukDays < 46) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Not prior UK resident + ${ukDays} UK days < 46 → automatic non-resident`,
               fixHint: null };
    }
    // Automatic UK tests
    if (ukDays >= 183) {
      return { qualifies: 'YES', grade: 1, applicableAmount: 0,
               reason: `${ukDays} UK days ≥ 183 → automatic UK resident (worldwide income/gains taxable in UK)`,
               fixHint: null };
    }
    // Sufficient ties test (simplified — 4-ties for previously-resident, 3-ties otherwise based on day count)
    if (ties == null) {
      return { qualifies: 'NA', grade: 0, applicableAmount: 0,
               reason: `${ukDays} days in 16-182 range — sufficient ties test required but ties not recorded`,
               fixHint: 'Record family/accommodation/work/90-day/country ties.' };
    }
    const tieCount = ties.length;
    // Day-count to tie thresholds (simplified)
    let tiesNeeded;
    if (ukDays < 46) tiesNeeded = 999;
    else if (ukDays < 91) tiesNeeded = wasUkResident ? 4 : 999;
    else if (ukDays < 121) tiesNeeded = wasUkResident ? 3 : 4;
    else if (ukDays < 183) tiesNeeded = wasUkResident ? 2 : 3;
    else tiesNeeded = 1;
    const resident = tieCount >= tiesNeeded;
    return { qualifies: resident ? 'YES' : 'NO', grade: resident ? 1 : 0, applicableAmount: 0,
             reason: `${ukDays} days + ${tieCount} ties (need ${tiesNeeded}) → ${resident ? 'UK RESIDENT' : 'NOT UK RESIDENT'}`,
             fixHint: !resident ? 'Worldwide income/gains NOT taxed in UK. Track changes to maintain non-resident status.' : null };
  },
  savings: () => 0,  // residence status changes the tax base, not a simple £ saving
  optimiserHook: null,
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 13 — Principal Private Residence (PPR) relief
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'PPR',
  title: 'Principal Private Residence CGT relief',
  category: 'cgt',
  description: 'Sale of your main residence is CGT-free if you lived there throughout ownership. Partial relief if mixed-use or rented out for part of the period.',
  applicability: (p) => (p.assets?.residence?.value ?? 0) > 0,
  predicate: (p, asOfDate) => {
    const occupancy = p.assets?.residence?.occupancy_status ?? 'main_residence';
    const yearsOwned = p.assets?.residence?.years_owned ?? null;
    const yearsLetOrAbsent = p.assets?.residence?.years_let ?? 0;
    if (occupancy === 'main_residence' && yearsLetOrAbsent === 0) {
      return { qualifies: 'YES', grade: 1, applicableAmount: p.assets.residence.unrealised_gain ?? 0,
               reason: 'Main residence, full PPR — any gain CGT-free on sale',
               fixHint: null };
    }
    if (occupancy === 'btl' || occupancy === 'investment') {
      const gain = p.assets.residence?.unrealised_gain ?? 0;
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `Property is BTL/investment — no PPR. Full ${fmt(gain * 0.24)} CGT exposure on disposal.`,
               fixHint: 'Live in property for part of ownership to claim partial PPR. Or transfer to spouse first then sell.' };
    }
    if (yearsLetOrAbsent > 0 && yearsOwned) {
      const occupiedYears = yearsOwned - yearsLetOrAbsent + 0.75;  // final 9 months always count
      const reliefFraction = Math.min(1, occupiedYears / yearsOwned);
      const gain = p.assets.residence.unrealised_gain ?? 0;
      const reliefedGain = gain * reliefFraction;
      const taxableGain = gain - reliefedGain;
      return { qualifies: 'PARTIAL', grade: reliefFraction, applicableAmount: reliefedGain,
               reason: `${occupiedYears.toFixed(1)}/${yearsOwned} years as main residence → ${(reliefFraction*100).toFixed(0)}% PPR. Taxable gain ${fmt(taxableGain)} (CGT ${fmt(taxableGain * 0.24)})`,
               fixHint: 'Claim residence-nomination if multiple properties. Final 9 months always relieved regardless.' };
    }
    return { qualifies: 'YES', grade: 1, applicableAmount: 0,
             reason: 'Main residence — full PPR (default)',
             fixHint: null };
  },
  savings: () => 0,
  optimiserHook: null,
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 14 — Carry-forward Annual Allowance (scheme membership requirement)
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'CARRY-FORWARD-AA',
  title: 'Carry-forward Annual Allowance',
  category: 'pension',
  description: 'Unused pension AA from 3 prior tax years can be carried forward. Requirement: must have been a member of a UK-registered pension scheme in each year being carried forward.',
  applicability: (p) => true,
  predicate: (p, asOfDate) => {
    const history = p.pension?.contribution_history ?? [];  // array of {tax_year, contributed, aa}
    const memberInYear = p.pension?.scheme_member_in ?? [];  // array of tax years
    const currentYear = asOfDate.getFullYear();
    const priorYears = [currentYear - 3, currentYear - 2, currentYear - 1];
    let availableCarryForward = 0;
    const details = [];
    for (const yr of priorYears) {
      const wasMember = memberInYear.includes(yr) || memberInYear.includes(`${yr}/${(yr+1).toString().slice(-2)}`);
      if (!wasMember) {
        details.push(`${yr}: NOT a scheme member — no carry-forward`);
        continue;
      }
      const yearData = history.find(h => h.tax_year?.startsWith(String(yr)));
      const aa = yearData?.aa ?? (yr >= 2023 ? 60000 : 40000);
      const used = yearData?.contributed ?? 0;
      const unused = Math.max(0, aa - used);
      availableCarryForward += unused;
      details.push(`${yr}: unused ${fmt(unused)} of ${fmt(aa)} AA`);
    }
    if (availableCarryForward === 0) {
      return { qualifies: 'NO', grade: 0, applicableAmount: 0,
               reason: `No carry-forward available. ${details.join('; ')}`,
               fixHint: 'Join a pension scheme NOW. Even a £0-contribution membership preserves future carry-forward.' };
    }
    return { qualifies: 'YES', grade: 1, applicableAmount: availableCarryForward,
             reason: `${fmt(availableCarryForward)} carry-forward available. ${details.join('; ')}.`,
             fixHint: `Use carry-forward before April 6 of next year. Higher-rate relief: ${fmt(availableCarryForward * 0.40)}.` };
  },
  savings: (p) => {
    const r = _registry.get('CARRY-FORWARD-AA').predicate(p, new Date());
    return r.qualifies === 'YES' ? Math.round(r.applicableAmount * 0.40) : 0;
  },
  optimiserHook: (p) => ({
    optimiserId: 'OPT-A03',
    title: 'Use carry-forward AA before it expires',
    estimatedSavingPerYear: _registry.get('CARRY-FORWARD-AA').savings(p),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════
// RULE 15 — UK Domicile for worldwide IHT
// ═══════════════════════════════════════════════════════════════════════════
registerRule({
  id: 'UK-DOMICILE',
  title: 'UK domicile (worldwide IHT)',
  category: 'iht',
  description: 'UK-domiciled (origin/choice/deemed) = worldwide assets in UK IHT. Non-dom = only UK situs. Deemed dom after 15/20 yrs UK residence. New LTR regime from April 2025.',
  applicability: (p) => true,
  predicate: (p, asOfDate) => {
    const domicile = p.domicile?.status ?? 'uk-origin';
    const ukYears = p.domicile?.uk_years ?? null;
    if (domicile === 'uk-origin' || domicile === 'uk-choice') {
      return { qualifies: 'YES', grade: 1, applicableAmount: 0,
               reason: `UK-domiciled (${domicile}) — worldwide assets in scope of UK IHT`,
               fixHint: null };
    }
    if (domicile === 'deemed') {
      return { qualifies: 'YES', grade: 1, applicableAmount: 0,
               reason: `Deemed UK-domiciled (15+/20 yrs UK residence) — worldwide IHT applies`,
               fixHint: 'Leaving UK for 6+ years can break deemed status. Plan around the 15-year clock.' };
    }
    if (domicile === 'non-dom' && ukYears != null && ukYears >= 15) {
      return { qualifies: 'YES', grade: 1, applicableAmount: 0,
               reason: `Non-dom but ${ukYears} UK years ≥ 15 → automatic deemed dom — worldwide IHT applies`,
               fixHint: null };
    }
    return { qualifies: 'NO', grade: 0, applicableAmount: 0,
             reason: `Non-UK-domiciled (${ukYears ?? 0} UK years) — only UK situs assets in IHT scope`,
             fixHint: 'Pre-deemed-dom planning: gift non-UK assets to excluded property trust before 15-year clock expires. From April 2025: new Long-Term Resident regime — review treaty positions.' };
  },
  savings: () => 0,
  optimiserHook: null,
});

export { _registry };  // for testing/inspection only
