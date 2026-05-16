/**
 * src/de/research/mock.js — [MOCK] research data for Decision Engine v1.0
 *
 * All entries are labelled [MOCK]. They stand in for Exa/Firecrawl live calls.
 * Post-demo: set VITE_USE_REAL_RESEARCH=true → real.js activates instead.
 *
 * Data is plausible and directionally correct but NOT verified live.
 * The validator never touches research[] — these are informational only.
 * Every entry must include a [MOCK] prefix so the UI can badge them.
 */

export const MOCK_RESEARCH_VERSION = '1.0.0';

// ── Rules-uk.js sourced facts (always real — not mock) ──────────────────────
// These are included here for convenience but sourced from the live file.

export const RULES_UK_FACTS = {
  sdlt_second_home_surcharge: {
    source: 'rules-uk.js',
    fact: 'SDLT second-home surcharge: +3% above standard rates (ENACTED 2016, increased Oct 2024)',
    status: 'ENACTED',
  },
  sdlt_standard_up_to_250k: {
    source: 'rules-uk.js',
    fact: 'SDLT standard rate 0–£250K: 0% (ENACTED)',
    status: 'ENACTED',
  },
  sdlt_standard_250k_925k: {
    source: 'rules-uk.js',
    fact: 'SDLT standard rate £250K–£925K: 5% (ENACTED)',
    status: 'ENACTED',
  },
  cgt_residential_basic: {
    source: 'rules-uk.js',
    fact: 'CGT residential property (basic-rate taxpayer): 18% (from Oct 2024)',
    status: 'ENACTED',
  },
  cgt_residential_higher: {
    source: 'rules-uk.js',
    fact: 'CGT residential property (higher-rate taxpayer): 24% (from Oct 2024)',
    status: 'ENACTED',
  },
  cgt_other_basic: {
    source: 'rules-uk.js',
    fact: 'CGT other assets (basic-rate): 18% (from Oct 2024)',
    status: 'ENACTED',
  },
  cgt_other_higher: {
    source: 'rules-uk.js',
    fact: 'CGT other assets (higher-rate): 24% (from Oct 2024)',
    status: 'ENACTED',
  },
  section_24_restriction: {
    source: 'rules-uk.js',
    fact: 'Section 24: BTL mortgage interest relief capped at basic-rate (20%) only — fully phased in from 2020/21',
    status: 'ENACTED',
  },
  sipp_iht_enacted: {
    source: 'rules-uk.js',
    fact: 'SIPP/pension enters estate for IHT: Finance Act 2026, Royal Assent 18 March 2026, effective 6 April 2027 (ENACTED)',
    status: 'ENACTED',
  },
  iht_nil_rate_band: {
    source: 'rules-uk.js',
    fact: 'IHT nil rate band: £325K per person (frozen to 2030)',
    status: 'ENACTED',
  },
  iht_rnrb: {
    source: 'rules-uk.js',
    fact: 'Residence nil rate band: £175K (tapers above £2M estate)',
    status: 'ENACTED',
  },
  gift_annual_exemption: {
    source: 'rules-uk.js',
    fact: 'IHT annual gift exemption: £3K per year (can carry forward 1 year)',
    status: 'ENACTED',
  },
  gift_small_gifts: {
    source: 'rules-uk.js',
    fact: 'Small gift exemption: £250 per recipient (unlimited recipients)',
    status: 'ENACTED',
  },
  pension_aa: {
    source: 'rules-uk.js',
    fact: 'Pension annual allowance: £60K (2024/25 onwards)',
    status: 'ENACTED',
  },
  mpaa: {
    source: 'rules-uk.js',
    fact: 'Money Purchase Annual Allowance: £10K — triggered by flexi-access drawdown (IRREVERSIBLE)',
    status: 'ENACTED',
  },
  isa_allowance: {
    source: 'rules-uk.js',
    fact: 'ISA annual allowance: £20K (2026/27)',
    status: 'ENACTED',
  },
  ltcg_badr: {
    source: 'rules-uk.js',
    fact: 'Business Asset Disposal Relief: 10% CGT rate on qualifying gains up to £1M lifetime (ENACTED 2025)',
    status: 'ENACTED',
  },
  nmpa_2028: {
    source: 'rules-uk.js',
    fact: 'Normal Minimum Pension Age rises from 55 to 57 on 6 April 2028 (ENACTED)',
    status: 'ENACTED',
  },
};

// ── Mock live research by event category ─────────────────────────────────────

export const MOCK_RESEARCH = {

  // Property
  buy_second_home: [
    {
      source: 'live',
      fact: '[MOCK] BTL gross yield Birmingham B12 postcode: ~7.1% (based on Rightmove/Zoopla Q1 2026 — real data via Exa post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Average BTL void period UK: 2.3 weeks/year (Hamptons Lettings Index 2025 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Limited company BTL mortgage rates: ~5.8–6.4% (Molo Finance, Landbay Q2 2026 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Personal name BTL mortgage rates: ~5.2–6.1% (Barclays, NatWest Q2 2026 — real data post-demo)',
    },
  ],

  buy_btl: [
    {
      source: 'live',
      fact: '[MOCK] UK average BTL gross yield: 5.8% (Savills Residential Market Survey 2026 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] ICR stress test at FCA notional rate 5.5%: rental income must be ≥125% (personal) or ≥145% (SPV) of interest payment',
    },
    {
      source: 'live',
      fact: '[MOCK] SPV/Ltd Co setup cost: typically £1,000–£2,500 incl. legal + Companies House — real data post-demo',
    },
  ],

  upsize: [
    {
      source: 'live',
      fact: '[MOCK] Average conveyancing cost £600K–£1.2M property: ~£2,500–£4,000 (Solicitors Regulation Authority Q1 2026 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Average estate agent fee (1.2–1.5%): ~£12K–£18K on £1M sale — real data post-demo',
    },
  ],

  downsize: [
    {
      source: 'live',
      fact: '[MOCK] Average total selling + buying costs on downsizing: 2–3% of combined transaction value — real data post-demo',
    },
    {
      source: 'live',
      fact: '[MOCK] UK average downsizer equity release: ~£250K (Legal & General Housing research 2025 — real data post-demo)',
    },
  ],

  equity_release: [
    {
      source: 'live',
      fact: '[MOCK] Lifetime mortgage average interest rate: 6.2% (Equity Release Council Q1 2026 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Average equity release amount for 70-year-old: ~£150K (Key Equity Release 2025 — real data post-demo)',
    },
  ],

  // Retirement
  retire: [
    {
      source: 'live',
      fact: '[MOCK] State Pension 2026/27: £11,973/yr (new full single tier — ENACTED, real figure in rules-uk.js)',
    },
    {
      source: 'live',
      fact: '[MOCK] Drawdown average fee (wealth manager): 0.5–1.5% AUM/yr (FCA retirement income market report 2025 — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Average age at first pension access (HMRC 2025): 61 — real data post-demo',
    },
  ],

  pension_lump_sum: [
    {
      source: 'live',
      fact: '[MOCK] PCLS (pension commencement lump sum): 25% of crystallised value up to LSA of £268,275 — tax-free (ENACTED, real in rules-uk.js)',
    },
    {
      source: 'live',
      fact: '[MOCK] MPAA trigger: once flexi-access drawdown taken, pension AA drops permanently to £10K/yr — real data in rules-uk.js',
    },
  ],

  // IHT / Estate planning
  iht_planning: [
    {
      source: 'live',
      fact: '[MOCK] Average IHT bill per paying estate 2024/25: £215,000 (HMRC IHT receipts data — real data post-demo)',
    },
    {
      source: 'live',
      fact: '[MOCK] Average time for 7-year gifting strategy to halve estate: 12–15 years at typical estate growth rates — real data post-demo',
    },
    {
      source: 'live',
      fact: '[MOCK] Discretionary trust setup cost: £3,000–£8,000 (specialist solicitor, STEP member 2026 — real data post-demo)',
    },
  ],

  setup_trust: [
    {
      source: 'live',
      fact: '[MOCK] Discretionary trust 10-year periodic charge: 6% of value above NRB — real calculation via trustPeriodicCharge engine',
    },
    {
      source: 'live',
      fact: '[MOCK] RNRB eligibility: only on direct property passing directly to direct descendants — not preserved in a discretionary trust',
    },
  ],

  write_will: [
    {
      source: 'live',
      fact: '[MOCK] Intestacy: partner (unmarried) receives nothing — estate passes to children or parents under Rules of Intestacy 1925 as amended',
    },
    {
      source: 'live',
      fact: '[MOCK] Average solicitor will cost (mirror wills): £300–£700 (unregulated market — prices vary widely, real data post-demo)',
    },
  ],

  // Wealth events
  sell_business: [
    {
      source: 'live',
      fact: '[MOCK] BADR lifetime limit: £1M (from Oct 2024; was £10M). Rate 10% CGT on qualifying gains — ENACTED, verify in rules-uk.js',
    },
    {
      source: 'live',
      fact: '[MOCK] Average UK SME trade sale timescale: 8–18 months from instruction to completion (Deloitte Private 2025 — real data post-demo)',
    },
  ],

  rsu_vesting: [
    {
      source: 'live',
      fact: '[MOCK] EMI options: CGT on gain from exercise at disposal (not income tax at vest) if granted at AMV — HMRC ERS bulletin',
    },
    {
      source: 'live',
      fact: '[MOCK] SAYE (Save As You Earn): option price discount up to 20%, free of income tax at exercise if held to maturity — ENACTED',
    },
  ],

  // Career events
  retire_early: [
    {
      source: 'live',
      fact: '[MOCK] FIRE studies (Bengen 1994, updated 2021): 4% SWR survives 30yr horizon in 95%+ of scenarios — theoretical benchmark only',
    },
  ],

  redundancy: [
    {
      source: 'live',
      fact: '[MOCK] Tax-free redundancy exemption: up to £30K (statutory + non-statutory payments combined) — ENACTED, verify in rules-uk.js',
    },
  ],

  // Default fallback (used when no specific match)
  _default: [
    {
      source: 'live',
      fact: '[MOCK] Sonuswealth live data integration (Exa + Firecrawl) activates post-demo via VITE_USE_REAL_RESEARCH=true',
    },
  ],
};

/**
 * Get research items for a given event ID.
 * Always returns at least one item (the default).
 * Always includes relevant rules-uk.js facts for the event's key rules.
 *
 * @param {string} eventId   - Ontology event ID
 * @param {string[]} [ruleKeys] - Specific rules-uk.js keys to include
 * @returns {Array<{source: string, fact: string}>}
 */
export function getMockResearch(eventId, ruleKeys = []) {
  const items = [];

  // Always-included rules-uk.js facts
  const defaultRuleKeys = ['sipp_iht_enacted', 'iht_nil_rate_band'];
  const allRuleKeys = [...new Set([...defaultRuleKeys, ...ruleKeys])];

  for (const key of allRuleKeys) {
    if (RULES_UK_FACTS[key]) items.push(RULES_UK_FACTS[key]);
  }

  // Event-specific mock live data
  const specific = MOCK_RESEARCH[eventId] ?? MOCK_RESEARCH._default;
  items.push(...specific);

  return items;
}

/**
 * Returns true if real research is enabled via env var.
 * When false, this mock module is authoritative.
 */
export function isRealResearchEnabled() {
  try {
    return import.meta.env?.VITE_USE_REAL_RESEARCH === 'true';
  } catch {
    return false;
  }
}
