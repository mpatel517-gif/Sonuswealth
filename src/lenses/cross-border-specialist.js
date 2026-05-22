// ─────────────────────────────────────────────────────────────────────────────
// LENS: CROSS-BORDER SPECIALIST
//
// Perspective: a UK cross-border tax specialist (CIOT / ADIT-qualified)
// covering Statutory Residence Test, FIG regime (post-2025 non-dom reform),
// Double Tax Agreements, deemed-domicile rules, and NRI / NR tax position.
//
// Citations:
//   FA 2013 Sch 45 = Statutory Residence Test
//   FA 2025 = FIG regime (4-year foreign income & gains exemption)
//   IHTA 1984 s.267 = deemed domicile
//   DTAs = specific country agreements (HMRC International Manual)
// ─────────────────────────────────────────────────────────────────────────────

import {
  SEVERITY, URGENCY, fmt, pct,
  ageAt, grossAssets, grossIncome,
  observation, recommendation, redFlag,
} from './_base.js';

const REF = {
  SRT_AUTO_NONRES_DAYS_LEAVER: 16,
  SRT_AUTO_NONRES_DAYS_OTHER: 46,
  SRT_AUTO_RES_DAYS: 183,
  FIG_REGIME_YEARS: 4,                   // 4-year FIG window post-arrival (FA 2025)
  IHT_DEEMED_DOM_YEARS: 10,              // residence in 15 of 20 → IHT deemed dom
  IHT_TAIL_LEAVER_YEARS: 10,             // pre-2025 was 3, post-2025 is 10
};

export const lens = {
  id: 'cross-border-specialist',
  name: 'Cross-Border Specialist',
  short_name: 'Cross-Border',
  display_avatar: '🌍',
  expertise_domain: ['srt', 'fig', 'dta', 'deemed_dom', 'nri', 'remittance'],
  description: 'A UK cross-border tax specialist covering residence, domicile, FIG regime, and Double Tax Agreements.',

  is_relevant(persona) {
    const hasForeign = persona.jurisdictionContext?.foreign_income > 0 ||
                       persona.jurisdictionContext?.foreign_assets > 0 ||
                       persona.jurisdictionContext?.domicile && persona.jurisdictionContext.domicile !== 'UK' ||
                       (persona.recent_arrival_year && persona.recent_arrival_year > 2020)
    if (hasForeign) return { score: 1.0, reason: 'Cross-border circumstances — full specialist review essential' }
    return { score: 0.3, reason: 'UK-resident UK-domiciled — relevant only for future plans (emigration, foreign property)' }
  },

  observe(persona, asOfDate = new Date()) {
    const obs = []
    const ctx = persona.jurisdictionContext || {}
    const domicile = ctx.domicile || 'UK'
    const ukDaysThisYear = ctx.uk_days_this_year ?? null

    // OBS-1: SRT day-count status (if data available)
    if (ukDaysThisYear != null) {
      const planningToLeave = persona.recent_departure_year ?? null
      if (planningToLeave) {
        const threshold = REF.SRT_AUTO_NONRES_DAYS_LEAVER
        if (ukDaysThisYear > threshold) {
          obs.push(observation({
            id: 'CB-OBS-01',
            severity: SEVERITY.HIGH,
            category: 'srt',
            text: `Statutory Residence Test risk: ${ukDaysThisYear} UK days this tax year vs ${threshold}-day automatic non-resident threshold for "leaver" status. Above ${threshold} days you fail automatic non-residence and fall into the ties test — possibly triggering UK tax residence retrospectively.`,
            citation: 'FA 2013 Sch 45 Part 1 (automatic non-residence)',
            finding: { ukDays: ukDaysThisYear, threshold },
          }))
        }
      } else {
        const threshold = REF.SRT_AUTO_RES_DAYS
        if (ukDaysThisYear >= threshold) {
          obs.push(observation({
            id: 'CB-OBS-01b',
            severity: SEVERITY.HIGH,
            category: 'srt',
            text: `${ukDaysThisYear} UK days this tax year ≥ 183 → automatically UK tax resident under FA 2013 Sch 45 Part 1. UK tax applies on worldwide income and gains (subject to DTAs and FIG regime if you newly arrived).`,
            citation: 'FA 2013 Sch 45 Part 1 (automatic UK residence)',
            finding: { ukDays: ukDaysThisYear, threshold },
          }))
        }
      }
    }

    // OBS-2: FIG regime eligibility (post-Apr 2025 arrival)
    const yearsResident = ctx.years_uk_resident ?? null
    if (yearsResident != null && yearsResident <= REF.FIG_REGIME_YEARS && yearsResident >= 0) {
      const remaining = REF.FIG_REGIME_YEARS - yearsResident
      obs.push(observation({
        id: 'CB-OBS-02',
        severity: SEVERITY.LOW,
        category: 'fig',
        text: `You are in year ${yearsResident} of the 4-year Foreign Income & Gains (FIG) regime (post-2025 reform replacing remittance basis). Foreign income and gains arising during these 4 years remain UK-tax-free if not remitted. ${remaining} year${remaining === 1 ? '' : 's'} remaining.`,
        citation: 'FA 2025 (FIG regime, replacing non-dom remittance basis)',
        finding: { yearsResident, remaining },
      }))
    } else if (yearsResident != null && yearsResident > REF.FIG_REGIME_YEARS) {
      obs.push(observation({
        id: 'CB-OBS-02b',
        severity: SEVERITY.MEDIUM,
        category: 'fig',
        text: `4-year FIG window has closed (you are in year ${yearsResident} of UK residence). All worldwide income and gains now fully UK-taxable in real time, regardless of remittance.`,
        citation: 'FA 2025 (post-FIG-window taxation)',
        finding: { yearsResident, windowClosed: true },
      }))
    }

    // OBS-3: IHT deemed domicile timing
    if (yearsResident != null && yearsResident >= 10 && domicile !== 'UK') {
      obs.push(observation({
        id: 'CB-OBS-03',
        severity: SEVERITY.HIGH,
        category: 'iht_deemed_dom',
        text: `${yearsResident} years UK resident with non-UK domicile of origin → deemed UK-domiciled for IHT. Worldwide assets now in UK IHT estate. Pre-deemed-domicile excluded-property trusts retain protection only if settled BEFORE deemed-domicile status applied.`,
        citation: 'IHTA 1984 s.267 (deemed domicile after 15-of-20 years)',
        finding: { yearsResident, deemedDom: true },
      }))
    }

    // OBS-4: Departure IHT tail
    if (persona.recent_departure_year) {
      const yearsSinceLeaving = new Date().getFullYear() - persona.recent_departure_year
      if (yearsSinceLeaving < REF.IHT_TAIL_LEAVER_YEARS) {
        const remaining = REF.IHT_TAIL_LEAVER_YEARS - yearsSinceLeaving
        obs.push(observation({
          id: 'CB-OBS-04',
          severity: SEVERITY.HIGH,
          category: 'iht_tail',
          text: `You left ${yearsSinceLeaving} year${yearsSinceLeaving === 1 ? '' : 's'} ago — IHT still applies to your worldwide estate for another ${remaining} year${remaining === 1 ? '' : 's'} under the post-2025 10-year IHT tail (was 3 years pre-reform). Estate restructuring not yet effective for full IHT removal.`,
          citation: 'FA 2025 (10-year IHT tail for departing residents)',
          finding: { yearsSinceLeaving, tailRemaining: remaining },
        }))
      }
    }

    return obs
  },

  recommend(persona, asOfDate = new Date()) {
    const recs = []
    const ctx = persona.jurisdictionContext || {}
    const yearsResident = ctx.years_uk_resident ?? null
    const ukDaysThisYear = ctx.uk_days_this_year ?? null

    // REC-1: Lock SRT day-count discipline
    if (ukDaysThisYear != null || persona.recent_departure_year) {
      recs.push(recommendation({
        id: 'CB-REC-01',
        strategy_id: 'STRAT-SRT-TRACKER',
        headline: 'Implement SRT day-count tracker with monthly review',
        drill_down: 'The SRT is mechanical — count days, count ties, status follows. Use a dedicated tracking app (HMRC has guidance; commercial apps: TaxScouts, Smarttax). Track: arrival day counts as a UK day; midnight rule applies; work-day vs presence-day distinctions matter for ties. Monthly review keeps you below thresholds.',
        action_steps: [
          'Install SRT tracking app or maintain spreadsheet',
          'Log every UK day with arrival/departure times',
          'Track ties: family, accommodation, work, 90-day, country',
          'Monthly review against thresholds for your status',
        ],
        impact: { gbp_lifetime: 50000, time_horizon: 'protection against accidental UK residence', certainty: 0.95 },
        risk: { reversibility: 'tracking has no downside', downside: 'time cost only', complexity: 'low' },
        citation: 'FA 2013 Sch 45 + HMRC RDR3 guidance',
        assumptions: { honest_tracking: 'requires meticulous logging' },
        flip_conditions: 'None — universally good practice for cross-border individuals.',
        fca_boundary: 'Information only — SRT compliance is tax law not financial advice.',
        common_mistakes: ['Forgetting transit days count', 'Missing tie tests', 'Annual review instead of monthly'],
      }))
    }

    // REC-2: FIG regime — crystallise foreign gains
    if (yearsResident != null && yearsResident <= REF.FIG_REGIME_YEARS && ctx.foreign_assets > 100000) {
      const remaining = REF.FIG_REGIME_YEARS - yearsResident
      recs.push(recommendation({
        id: 'CB-REC-02',
        strategy_id: 'STRAT-FIG-REALISE',
        headline: `Realise foreign capital gains in your remaining ${remaining}-year FIG window`,
        drill_down: `Within the 4-year FIG window, foreign income and gains arising AND remaining outside the UK are UK-tax-free. After the window closes, all worldwide gains are taxable in real time. If you have unrealised foreign gains, realising them within the window (and keeping proceeds offshore) crystallises the tax-free uplift. Bring proceeds onshore later only after careful tax planning.`,
        action_steps: [
          'Inventory foreign holdings and unrealised gains',
          'Sequence realisations within remaining FIG window',
          'Keep proceeds offshore — track meticulously to avoid accidental remittance',
          'Specialist tax adviser review before each realisation',
        ],
        impact: { gbp_lifetime: 30000, time_horizon: 'FIG window remaining', certainty: 0.85 },
        risk: { reversibility: 'CGT once realised cannot be reversed', downside: 'currency risk on proceeds; future rule changes', complexity: 'high' },
        citation: 'FA 2025 (FIG regime) + HMRC Cross-Border Tax Manual',
        assumptions: { fig_eligible: 'must be in years 1-4 of UK residence', proceeds_offshore: 'must keep proceeds non-remitted' },
        flip_conditions: 'If holdings are minor or all loss-making, no benefit.',
        fca_boundary: 'Information only — cross-border tax is highly specialist. Mandatory advice.',
        common_mistakes: ['Remitting proceeds inadvertently', 'Missing the window deadline', 'Realising losses needlessly'],
      }))
    }

    return recs
  },

  red_flags(persona, asOfDate = new Date()) {
    const flags = []
    const ctx = persona.jurisdictionContext || {}
    const ukDaysThisYear = ctx.uk_days_this_year ?? null
    if (ukDaysThisYear != null && persona.recent_departure_year && ukDaysThisYear > REF.SRT_AUTO_NONRES_DAYS_LEAVER) {
      flags.push(redFlag({
        id: 'CB-RF-01',
        urgency: URGENCY.URGENT,
        action: 'Reduce UK day count immediately or accept UK tax residence',
        deadline: 'Tax year end (5 April)',
        cost_of_inaction: 'Retrospective UK tax residence — worldwide income/gains taxable',
        citation: 'FA 2013 Sch 45',
      }))
    }
    return flags
  },

  what_if_prompts(persona) {
    return [
      'What if I moved to Portugal under the IFICI regime?',
      'What if I exceeded my SRT day count by 5 days?',
      'How long do I retain IHT exposure after leaving the UK?',
    ]
  },
}
