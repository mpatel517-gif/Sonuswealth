// ─────────────────────────────────────────────────────────────────────────────
// LENS: FAMILY LAW SPECIALIST
//
// Perspective: a UK Resolution-accredited family law solicitor covering
// divorce, civil partnership dissolution, cohabitation rights gap, prenuptial
// /postnuptial agreements, child maintenance, and pension sharing orders.
//
// Citations:
//   MCA 1973   = Matrimonial Causes Act 1973
//   CHA 2014   = Child Maintenance Act 2014
//   PSA       = Pension Sharing Orders (Welfare Reform & Pensions Act 1999)
//   FLA 1996  = Family Law Act 1996
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  CIVIL_PARTNERSHIP_AGE: 18,
  COHAB_NO_AUTOMATIC_RIGHTS: true,            // no common-law marriage in UK
  PRENUP_BARDER_THRESHOLD_YEARS: 21,          // post-Radmacher case law
  CHILD_MAINTENANCE_BASIC_RATE: 0.12,         // 12% of gross for 1 child (gross income > £41,600 reduces)
  CHILD_MAINTENANCE_GROSS_CAP: 156000,        // annual gross income cap
  PENSION_SHARING_DEFAULT_SPLIT: 0.50,
};

export const lens = {
  id: 'family-law-specialist',
  name: 'Family Law Specialist',
  short_name: 'Family Law',
  display_avatar: '👥',
  expertise_domain: ['divorce', 'cohab', 'prenup', 'child_maintenance', 'pension_sharing'],
  description: 'A UK Resolution-accredited family solicitor covering divorce, cohabitation, prenup, and pension sharing.',

  is_relevant(persona) {
    const cohab = persona.relationship_status === 'cohabiting' || persona.cohabiting === true
    const recentEvent = persona.estate_plan?.recent_life_event || ''
    const inDivorce = /divorce|separat/i.test(recentEvent)
    const newRelationship = persona.relationship_status === 'remarried' || persona.relationship_start_year
    if (inDivorce) return { score: 1.0, reason: 'Active divorce — full specialist relevance' }
    if (cohab) return { score: 0.9, reason: 'Cohabiting — IHT and inheritance rights gap critical' }
    if (newRelationship) return { score: 0.7, reason: 'Recent relationship change — prenup/postnup review valuable' }
    return { score: 0.5, reason: 'Standard family-law review' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const isCohab = persona.relationship_status === 'cohabiting' || persona.cohabiting === true
    const recentEvent = persona.estate_plan?.recent_life_event || ''
    const assets = grossAssets(persona)

    // OBS-1: Cohabitation rights gap
    if (isCohab && assets > 100000) {
      obs.push(observation({
        id: 'FL-OBS-01',
        severity: SEVERITY.HIGH,
        category: 'cohab_iht',
        text: `Cohabiting (not married/civil partnered) gives ZERO automatic inheritance rights — no spousal IHT exemption, no automatic survivor pension, no statutory financial-claims framework on separation. On death, partner inherits NOTHING via intestacy. Spousal IHT exemption (potentially £1M+ unused) is lost.`,
        citation: 'IHTA 1984 s.18 (spousal exemption) + Administration of Estates Act 1925 (intestacy)',
        finding: { isCohab: true, assets, spousalExemptionLost: 'unlimited' },
      }))
    }

    // OBS-2: No prenup if remarried with prior wealth
    if (persona.relationship_status === 'remarried' && assets > 1000000 && !persona.prenup_in_place) {
      obs.push(observation({
        id: 'FL-OBS-02',
        severity: SEVERITY.MEDIUM,
        category: 'prenup',
        text: `Remarried with substantial assets (${fmt(assets)}) and no prenup recorded. Post-Radmacher v Granatino [2010] UKSC 42, prenups are afforded significant weight by English courts if entered with full disclosure, independent advice, and at least 28 days before marriage. Protects pre-marital and inheritance-acquired wealth.`,
        citation: 'Radmacher v Granatino [2010] UKSC 42 + MCA 1973 s.25',
        finding: { remarried: true, prenup: false, vulnerableAssets: assets },
      }))
    }

    // OBS-3: Active divorce — pension valuation needed
    if (/divorce|separat/i.test(recentEvent)) {
      const sipp = persona.assets?.sipp?.total ?? 0
      obs.push(observation({
        id: 'FL-OBS-03',
        severity: SEVERITY.HIGH,
        category: 'divorce_pension',
        text: `Active divorce with SIPP ${fmt(sipp)} — pension is matrimonial asset eligible for Pension Sharing Order (PSO), pension attachment order, or offsetting against other assets. PSO is usually fairest as it gives the receiving party a clean break, but requires actuarial valuation (CETV may not reflect true value, especially for DB schemes).`,
        citation: 'Welfare Reform and Pensions Act 1999 + MCA 1973 s.21A',
        finding: { sippValue: sipp, options: ['PSO', 'attachment', 'offset'] },
      }))
    }

    // OBS-4: Will needs update on separation
    if (/divorce|separat|marriage|remarried/i.test(recentEvent) && (persona.estate_plan?.will_last_updated_year ?? 0) < new Date().getFullYear() - 1) {
      obs.push(observation({
        id: 'FL-OBS-04',
        severity: SEVERITY.HIGH,
        category: 'will_update',
        text: `Relationship status change recorded but will not updated. Marriage REVOKES previous will entirely (Wills Act 1837 s.18). Divorce treats ex-spouse as predeceased (no inheritance) but does not revoke other beneficiary names. Both events demand a fresh will + LPA review.`,
        citation: 'Wills Act 1837 s.18 (revocation by marriage) + s.18A (effect of divorce)',
        finding: { lifeEvent: recentEvent, willCurrent: false },
      }))
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const isCohab = persona.relationship_status === 'cohabiting' || persona.cohabiting === true
    const recentEvent = persona.estate_plan?.recent_life_event || ''
    const assets = grossAssets(persona)

    // REC-1: Cohabitation agreement
    if (isCohab && assets > 100000) {
      recs.push(recommendation({
        id: 'FL-REC-01',
        strategy_id: 'STRAT-COHAB-AGREEMENT',
        headline: 'Sign a Cohabitation Agreement + mirror wills',
        drill_down: 'Cohabitation agreements are a contract documenting ownership of jointly-used assets, contribution to household, and intentions on separation. They are persuasive but not as bulletproof as marriage in terms of court enforcement. Combine with mirror wills (each leaving estate to the other) to protect against intestacy. Note: still no spousal IHT exemption — only marriage delivers that. Consider Cohabitation Rights Bill watch (pending legislation that may equalise rights).',
        action_steps: [
          'Engage Resolution-accredited solicitor for cohab agreement',
          'Disclose all material assets and contributions',
          'Both parties take independent advice',
          'Draft mirror wills leaving estate to partner',
          'Review every 3-5 years or on major life events',
        ],
        impact: { gbp_lifetime: Math.round(assets * 0.20), time_horizon: 'protection against separation/death disputes', certainty: 0.75 },
        risk: { reversibility: 'agreement can be revoked by mutual consent', downside: 'enforcement uncertainty pre-Cohabitation-Rights-Bill', complexity: 'medium' },
        citation: 'Family Law Act 1996 + Resolution best practice + IHTA 1984 s.18',
        assumptions: { both_parties_willing: 'requires both partners to engage', independent_advice: 'each must take separate advice' },
        flip_conditions: 'If marriage is on the table within 12 months, focus on prenup instead.',
        fca_boundary: 'Information only — legal advice essential.',
        common_mistakes: ['Believing common-law marriage exists in England (it does not)', 'Drafting without independent advice for both parties'],
      }))
    }

    // REC-2: Prenup if remarried
    if (persona.relationship_status === 'remarried' && assets > 1000000 && !persona.prenup_in_place) {
      recs.push(recommendation({
        id: 'FL-REC-02',
        strategy_id: 'STRAT-PRENUP',
        headline: 'Sign a Prenuptial / Postnuptial Agreement',
        drill_down: 'Post-Radmacher [2010], English courts give substantial weight to prenups when properly entered: full disclosure both ways, independent legal advice, signed at least 28 days before marriage (or as a postnup any time), no duress, no significant unfairness. Protects pre-marital and inherited wealth — particularly important on a second marriage where adult children from a first marriage are beneficiaries.',
        action_steps: [
          'Engage Resolution-accredited solicitor 3+ months before marriage (for prenup) or immediately (for postnup)',
          'Full asset disclosure both sides',
          'Both parties take separate independent advice',
          'Sign at least 28 days before marriage',
          'Review every 5 years and after major life events',
        ],
        impact: { gbp_lifetime: Math.round(assets * 0.30), time_horizon: 'protection on divorce', certainty: 0.78 },
        risk: { reversibility: 'can be revoked / superseded by postnup', downside: 'court can override if "significantly unfair"', complexity: 'medium' },
        citation: 'Radmacher v Granatino [2010] UKSC 42 + MCA 1973 s.25',
        assumptions: { both_parties_willing: 'requires both partners to engage', adequate_disclosure: 'full and frank disclosure', no_duress: 'no last-minute pressure' },
        flip_conditions: 'If first marriage with minimal pre-marital assets, less critical.',
        fca_boundary: 'Information only — Resolution-accredited family solicitor essential.',
        common_mistakes: ['Signing too close to wedding day (under 28 days)', 'No disclosure from one side', 'Drafting without independent advice'],
      }))
    }

    // REC-3: Update will + LPA on relationship change
    if (/divorce|separat|marriage|remarried/i.test(recentEvent) && (persona.estate_plan?.will_last_updated_year ?? 0) < new Date().getFullYear() - 1) {
      recs.push(recommendation({
        id: 'FL-REC-03',
        strategy_id: 'STRAT-WILL-LPA-UPDATE',
        headline: 'Update will + LPA immediately following relationship change',
        drill_down: 'Marriage automatically REVOKES previous wills (Wills Act 1837 s.18) — without a new will, you are intestate. Divorce treats ex-spouse as predeceased (so they cannot inherit) but does not revoke other names, including ex-spouse as trustee or guardian. LPA does NOT auto-revoke on divorce — must be actively cancelled and re-issued. Both documents must reflect current intent immediately.',
        action_steps: [
          'Engage solicitor within 30 days of life event',
          'Draft new will (if marriage) or codicil reflecting new circumstances',
          'Revoke + re-issue LPAs naming new attorneys',
          'Update beneficiary nominations on pension and life cover',
          'Inform executor and attorneys of changes',
        ],
        impact: { gbp_one_off: 1500, time_horizon: 'protection until next life event', certainty: 0.95 },
        risk: { reversibility: 'fully revocable', downside: 'solicitor cost £500-1,500', complexity: 'low' },
        citation: 'Wills Act 1837 s.18 + s.18A + MCA 2005',
        assumptions: { has_capacity: 'capacity to make will/LPA' },
        flip_conditions: 'None — universally beneficial post-life-event.',
        fca_boundary: 'Information only — solicitor essential.',
        common_mistakes: ['Forgetting marriage revokes wills', 'Not updating LPA after divorce', 'Forgetting pension/insurance beneficiary nominations'],
      }))
    }

    return recs
  },

  red_flags(persona) {
    const flags = []
    const recentEvent = persona.estate_plan?.recent_life_event || ''
    if (/marriage/i.test(recentEvent) && (persona.estate_plan?.will_last_updated_year ?? 0) < new Date().getFullYear() - 1) {
      flags.push(redFlag({
        id: 'FL-RF-01',
        urgency: URGENCY.IMMEDIATE,
        action: 'Make new will — previous will was REVOKED automatically by marriage',
        deadline: 'Within 30 days',
        cost_of_inaction: 'Intestacy applies — statutory order overrides your wishes',
        citation: 'Wills Act 1837 s.18',
      }))
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if I divorced this year — what happens to my SIPP?',
      "What if I'm cohabiting and my partner died?",
      'Do I need a prenup before remarrying?',
    ]
  },
}
