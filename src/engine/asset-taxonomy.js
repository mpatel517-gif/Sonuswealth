// ─────────────────────────────────────────────────────────────────────────────
// asset-taxonomy.js — the CANONICAL UK personal-asset taxonomy.
//
// One source of truth for every asset, wrapper, scheme and policy a Sonuswealth
// user could hold. The asset-side mirror of liability-taxonomy.js — the surfaces
// read from here so they can never drift apart again:
//   · AddItemSheet        → the "+ Add" menu per category (grouped by sub-class)
//   · *DrillDown           → classifyAsset() (categorises a held asset)
//   · MyMoney / tiles     → assetLabel() (consistent human names everywhere)
//   · *Decisions           → decisionsForAssetType() (which verbs apply)
//
// WHY this file exists: before it, the Add-menu inlined ~48 asset types — a small
// curated subset of the ~150-instrument canon. It could not even reproduce Mr T's
// own property mix (he holds HMO / overseas / second-home; the menu had 5 generic
// property types). Founder 2026-06-02: "the asset categories for Mr T was not the
// entire Taxonomy." This closes that gap the way liability-taxonomy.js closed the
// 6-vs-46 debt gap.
//
// Spec source: 0 Knowledge Base/Wiki/3-Engine/3-Engine-mm-asset-taxonomy-v1_0.md
// (UK-2026.1 bundle · post FA 2026 · Autumn Budget 2025). Each type cites its
// canon domain ID (e.g. A08 = SIPP, G03 = HMO). `tax` here is DOCUMENTED GUIDANCE
// PROSE — any figure a calculation depends on is read live from the TAX bundle in
// the rendering component, never from this file (memory: never hardcode UK figures
// into maths; the prose may name a figure illustratively, the engine reads TAX).
//
// FCA boundary: decision verbs are information/guidance framings ("Review a
// transfer", "Check the relief clock") — never "transfer now" / "buy X". The
// modeller renders the £ + tax consequence; the user decides.
// ─────────────────────────────────────────────────────────────────────────────

// The MyMoney L1 categories that hold assets (order = Add-menu order).
export const ASSET_CATEGORIES = ['pensions', 'investments', 'property', 'business', 'cash', 'alternatives', 'protection']

// Sub-class metadata — drives the grouped headers inside each category's picker
// (AddItemSheet renders a header when item.class changes). Keyed by class id.
export const ASSET_CLASSES = {
  // pensions
  'dc-pension':          { label: 'Defined contribution (a pot)', icon: '📈' },
  'db-pension':          { label: 'Defined benefit (guaranteed income)', icon: '🏛️' },
  'pension-legacy':      { label: 'Legacy / protected', icon: '🗝️' },
  'overseas-pension':    { label: 'Overseas', icon: '🌍' },
  'state-pension':       { label: 'State', icon: '🇬🇧' },
  'pension-access':      { label: 'Taking an income (drawdown)', icon: '💸' },
  // investments
  'isa':                 { label: 'ISAs (tax-free wrapper)', icon: '🛡️' },
  'tax-efficient':       { label: 'Tax-efficient schemes', icon: '🌱' },
  'investment-bond':     { label: 'Investment bonds', icon: '📜' },
  'gia':                 { label: 'General account (GIA — unwrapped)', icon: '📊' },
  // property
  'own-use-property':    { label: 'Your own use', icon: '🏠' },
  'let-property':        { label: 'Let / rental', icon: '🏘️' },
  'commercial-land':     { label: 'Commercial & land', icon: '🏢' },
  'structured-property': { label: 'Equity release & structured', icon: '🔑' },
  // business
  'business-interest':   { label: 'Business interests', icon: '🏢' },
  'share-scheme':        { label: 'Employee share schemes', icon: '📑' },
  // cash
  'everyday-cash':       { label: 'Everyday & savings', icon: '💷' },
  'nsi':                 { label: 'NS&I (state-backed)', icon: '🏵️' },
  'special-cash':        { label: 'FX, offshore & children', icon: '🌐' },
  // alternatives
  'crypto-digital':      { label: 'Digital assets', icon: '₿' },
  'precious-hard':       { label: 'Precious & hard assets', icon: '🥇' },
  'collectible':         { label: 'Collectibles & chattels', icon: '🎨' },
  'private-alt':         { label: 'Private markets', icon: '🤝' },
  // protection
  'life-cover':          { label: 'Life cover', icon: '🛡️' },
  'health-income':       { label: 'Health & income', icon: '❤️' },
  'business-protection': { label: 'Business protection', icon: '💼' },
  'general-insurance':   { label: 'General insurance', icon: '🚗' },
}

// Human labels for the closed decision-verb vocabulary (FCA-safe guidance framings).
export const DECISION_LABELS = {
  'contribute':            'Contribute more',
  'use-allowance':         'Use this year’s allowance',
  'consolidate':           'Consolidate pots',
  'review-transfer':       'Review a transfer',
  'review-charges':        'Review the charges',
  'review-nomination':     'Check your nomination',
  'bed-and-isa':           'Bed & ISA',
  'realise-gain':          'Realise a gain (CGT)',
  'check-relief-clock':    'Check the relief clock',
  'take-income':           'Plan drawdown / income',
  'review-iht':            'Review the IHT position',
  'review-protection-gap': 'Check your cover gap',
  'review-trust':          'Check trust status',
  'sell':                  'Sell / dispose',
  'staircase':             'Staircase to full ownership',
  'review-equity-release': 'Review the release',
  'top-up-ni':             'Top up NI years',
  'check-fscs':            'Check FSCS cover',
  'rebalance':             'Rebalance',
  '5pct-withdrawal':       'Use the 5% allowance',
  'check-mvr':             'Check for an MVR',
  'review-badr':           'Review BADR eligibility',
}

// Generic match tokens that must NOT outrank a specific sub-type token — e.g.
// 'pension' should lose to 'sipp', 'property' to 'btl', 'isa' to 'lisa'. Scored 1.
const _GENERIC_TOKENS = new Set([
  'pension', 'property', 'isa', 'bond', 'share', 'shares', 'account', 'savings',
  'fund', 'investment', 'cover', 'insurance', 'scheme', 'loan', 'cash',
])
function _matchScore(token) { return _GENERIC_TOKENS.has(token) ? 1 : token.length }

// ── Builder — fills sensible defaults so each entry stays compact ──────────────
function A(o) {
  return {
    id: o.id,
    label: o.label,
    desc: o.desc ?? '',
    category: o.category,                 // MyMoney L1 (one of ASSET_CATEGORIES)
    class: o.class,                       // sub-group within the category
    common: o.common ?? false,            // floats to the top / surfaced as a chip
    icon: o.icon ?? '•',
    wrapper: o.wrapper ?? null,           // engine routing hint (wrapper tier)
    estate: o.estate ?? 'in',             // IHT: 'in' | 'outside' | 'from-2027'
    source: o.source,                     // { id, tax } canon provenance
    riskFlags: o.riskFlags ?? [],
    decisions: o.decisions ?? [],
    // substrings that classify a persona's raw type/use string → this entry.
    // Always includes the canonical id; highest _matchScore wins, so
    // 'second-charge'-style specific tokens beat generic 'mortgage'/'pension'.
    match: [o.id.toLowerCase(), ...(o.match ?? [])],
    required: o.required ?? ['provider', 'value'],
    optional: o.optional ?? [],
  }
}

// ── The taxonomy ──────────────────────────────────────────────────────────────
export const ASSET_TYPES = [

  // ════════════════════════════ PENSIONS ════════════════════════════
  // ── DC pots ──
  A({ id: 'SIPP', label: 'SIPP', desc: 'Self-invested personal pension', category: 'pensions', class: 'dc-pension', common: true, icon: '📈', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A08', tax: 'Contributions tax-relieved at marginal rate · 25% PCLS (capped at the Lump Sum Allowance) · drawdown taxable · in estate for IHT from April 2027' },
    decisions: ['contribute', 'consolidate', 'review-charges', 'review-nomination', 'take-income'],
    required: ['provider', 'value'], optional: ['monthlyContribution', 'employerContribution', 'nominationDate'] }),
  A({ id: 'SSAS', label: 'SSAS', desc: 'Small self-administered scheme (director)', category: 'pensions', class: 'dc-pension', icon: '🏗️', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A09', tax: 'Employer contributions corp-tax deductible · can lend to the sponsoring employer (up to 50% of fund) · in estate from April 2027' },
    decisions: ['contribute', 'review-charges', 'review-nomination'],
    required: ['provider', 'value'], optional: ['monthlyContribution', 'employerContribution', 'loanToCompany'] }),
  A({ id: 'WORKPLACE_DC', label: 'Workplace DC', desc: 'Auto-enrolment / employer scheme', category: 'pensions', class: 'dc-pension', common: true, icon: '🏢', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A03', tax: 'Net pay or salary sacrifice relief · employer match · in estate from April 2027 · MPAA on first flexible withdrawal' },
    decisions: ['contribute', 'consolidate', 'review-charges', 'review-nomination'],
    required: ['provider', 'value'], optional: ['monthlyContribution', 'employerMatchPct'] }),
  A({ id: 'GPP', label: 'Group personal pension', desc: 'Employer-arranged personal pension', category: 'pensions', class: 'dc-pension', icon: '📈', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A04', tax: 'Same tax treatment as workplace DC · individual contract · in estate from April 2027' },
    decisions: ['contribute', 'consolidate', 'review-charges'],
    required: ['provider', 'value'], optional: ['monthlyContribution'] }),
  A({ id: 'MASTER_TRUST', label: 'Master trust (NEST / People’s)', desc: 'Multi-employer auto-enrolment DC', category: 'pensions', class: 'dc-pension', icon: '🏢', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A05', tax: 'Occupational DC · limited fund selection · in estate from April 2027 · check default-fund charges' },
    decisions: ['contribute', 'consolidate', 'review-charges'], match: ['nest', 'peoples-pension', 'now-pensions', 'mastertrust'],
    required: ['provider', 'value'], optional: ['monthlyContribution', 'employerMatchPct'] }),
  A({ id: 'STAKEHOLDER', label: 'Stakeholder pension', desc: 'Capped-charge personal pension (legacy)', category: 'pensions', class: 'dc-pension', icon: '📈', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A06', tax: 'Charge cap (max 1.5% first 10yr, 1% after) · flexible stops/starts · in estate from April 2027' },
    decisions: ['contribute', 'consolidate', 'review-charges'],
    required: ['provider', 'value'], optional: ['monthlyContribution'] }),
  A({ id: 'PERSONAL_PENSION', label: 'Personal pension (retail)', desc: 'Individual relief-at-source contract', category: 'pensions', class: 'dc-pension', icon: '📈', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A07', tax: 'Relief at source (scheme adds basic rate; higher/additional rate claimed via Self Assessment) · in estate from April 2027' },
    decisions: ['contribute', 'consolidate', 'review-charges', 'review-nomination'],
    required: ['provider', 'value'], optional: ['monthlyContribution'] }),
  A({ id: 'DC_DEFERRED', label: 'Deferred / dormant pot', desc: 'Old workplace pension not yet accessed', category: 'pensions', class: 'dc-pension', icon: '💤', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A23', tax: 'Former workplace pot · in estate from April 2027 if DC · check for guaranteed annuity rates / protected tax-free cash before any transfer' },
    decisions: ['consolidate', 'review-transfer', 'review-charges'], match: ['dormant', 'frozen-pension', 'old-pension'],
    required: ['provider', 'value'], optional: ['monthlyContribution'] }),
  // ── DB / guaranteed ──
  A({ id: 'DB', label: 'DB — final salary', desc: 'Guaranteed income · CETV or annual', category: 'pensions', class: 'db-pension', icon: '🏛️', estate: 'outside',
    source: { id: 'A12', tax: 'Guaranteed income taxable as pension · outside the estate (held in trust) · CETV is the transfer value, NOT a spendable pot · 1/20 of CETV counts against the Annual Allowance' },
    riskFlags: ['A DB scheme is guaranteed income, not a fund you can spend — never model it as a pot'],
    decisions: ['review-transfer', 'take-income'], match: ['final-salary', 'defined-benefit'],
    required: ['scheme', 'projectedAnnual'], optional: ['cetv', 'accrualYears', 'normalRetirementAge'] }),
  A({ id: 'DB_CARE', label: 'DB — career average (CARE)', desc: 'Accrual on each year’s salary, revalued', category: 'pensions', class: 'db-pension', icon: '🏛️', estate: 'outside',
    source: { id: 'A13', tax: 'Career-average revalued earnings · revalued by CPI/RPI · outside estate in trust · income taxable' },
    decisions: ['take-income'], match: ['care-scheme', 'career-average'],
    required: ['scheme', 'projectedAnnual'], optional: ['accrualYears', 'normalRetirementAge'] }),
  A({ id: 'DB_PUBLIC', label: 'Public-sector DB', desc: 'NHS · Teachers · LGPS · Civil Service · uniformed', category: 'pensions', class: 'db-pension', icon: '🏛️', estate: 'outside',
    source: { id: 'A15', tax: 'Unfunded/funded government scheme · outside personal estate · survivor pension · high earners: check Annual Allowance (common issue)' },
    decisions: ['take-income'], match: ['nhs-pension', 'teachers-pension', 'lgps', 'civil-service-pension', 'police-pension', 'armed-forces-pension', 'public-sector'],
    required: ['scheme', 'projectedAnnual'], optional: ['accrualYears', 'normalRetirementAge'] }),
  A({ id: 'DB_HYBRID', label: 'Hybrid (DB + DC)', desc: 'Guaranteed element plus a fund element', category: 'pensions', class: 'db-pension', icon: '🏛️', estate: 'outside',
    source: { id: 'A14', tax: 'Split for modelling: DB element = entitlement (outside estate); DC element = fund value (in estate from April 2027)' },
    decisions: ['take-income', 'review-transfer'], match: ['hybrid-pension'],
    required: ['scheme', 'projectedAnnual'], optional: ['cetv', 'value'] }),
  // ── Legacy / protected ──
  A({ id: 'RAC_S226', label: 'RAC / Section 226', desc: 'Pre-1988 retirement annuity', category: 'pensions', class: 'pension-legacy', icon: '🗝️', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A10', tax: 'Pre-1988 contract · tax-free cash may differ from 25% · CHECK for a guaranteed annuity rate and protected tax-free cash before any action — often very valuable' },
    riskFlags: ['May hold a Guaranteed Annuity Rate worth far more than the open market — check before transferring'],
    decisions: ['review-transfer', 'take-income'], match: ['retirement-annuity', 's226', 'section-226'],
    required: ['provider', 'value'], optional: ['guaranteePeriod'] }),
  A({ id: 'SECTION_32', label: 'Section 32 buyout', desc: 'Deferred annuity with possible GMP', category: 'pensions', class: 'pension-legacy', icon: '🗝️', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'A11', tax: 'Bought out of an occupational scheme · may contain a Guaranteed Minimum Pension (GMP) — check before any transfer; may carry an enhanced transfer value' },
    decisions: ['review-transfer'], match: ['section-32', 's32', 'buyout', 'buy-out'],
    required: ['provider', 'value'], optional: ['guaranteePeriod'] }),
  // ── Overseas ──
  A({ id: 'QROPS', label: 'QROPS (overseas)', desc: 'UK pension transferred overseas', category: 'pensions', class: 'overseas-pension', icon: '🌍', wrapper: 'pension', estate: 'in',
    source: { id: 'A21', tax: 'Qualifying overseas scheme · 25% overseas-transfer charge if outside the EEA / member’s country · jurisdiction-dependent · 5-year reporting rule' },
    decisions: ['review-transfer'], match: ['qrops', 'overseas-pension', 'qnups'],
    required: ['provider', 'value'], optional: ['jurisdiction'] }),
  // ── State ──
  A({ id: 'STATE', label: 'State pension', desc: 'Forecast from your NI record', category: 'pensions', class: 'state-pension', common: true, icon: '🇬🇧', estate: 'outside',
    source: { id: 'A01', tax: 'Taxable as income via PAYE coding · 35 qualifying NI years for the full new State Pension · not in estate · buy missing years (Class 3) if cost-effective' },
    decisions: ['top-up-ni'], match: ['state-pension', 'new-state-pension', 'basic-state-pension'],
    required: ['weeklyAmount', 'startAge'], optional: ['niYearsAccrued'] }),
  // ── Decumulation ──
  A({ id: 'FAD', label: 'Flexi-access drawdown', desc: 'Pot kept invested, draw as needed', category: 'pensions', class: 'pension-access', icon: '💸', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'B01', tax: 'PCLS up to the Lump Sum Allowance tax-free · drawdown income taxable at marginal rate · triggers MPAA on first income withdrawal · residual fund in estate from April 2027' },
    decisions: ['take-income', 'review-charges', 'review-iht'], match: ['flexi-access', 'drawdown'],
    required: ['provider', 'value'], optional: ['annualWithdrawal', 'pclsTakenSoFar'] }),
  A({ id: 'UFPLS', label: 'UFPLS', desc: 'Lump sums: 25% tax-free / 75% taxable', category: 'pensions', class: 'pension-access', icon: '💸', wrapper: 'pension', estate: 'from-2027',
    source: { id: 'B03', tax: 'Each withdrawal is 25% tax-free / 75% taxable · triggers MPAA · the tax-free element counts against the Lump Sum Allowance' },
    decisions: ['take-income', 'review-iht'], match: ['ufpls', 'uncrystallised'],
    required: ['provider', 'value'], optional: ['annualWithdrawal'] }),
  A({ id: 'ANNUITY', label: 'Annuity', desc: 'Purchased income for life', category: 'pensions', class: 'pension-access', icon: '💸', estate: 'outside',
    source: { id: 'B05', tax: 'Guaranteed income taxed via PAYE · ceases on death unless a guarantee period or survivor pension applies · irreversible' },
    decisions: ['take-income'], match: ['annuity', 'lifetime-annuity'],
    required: ['provider', 'annualIncome'], optional: ['guaranteePeriod', 'survivorPct'] }),
  A({ id: 'ANNUITY_ENHANCED', label: 'Enhanced annuity', desc: 'Higher income for health/lifestyle', category: 'pensions', class: 'pension-access', icon: '💸', estate: 'outside',
    source: { id: 'B06', tax: 'Up to ~40% more income for medical/lifestyle factors · same tax as a standard annuity · medical underwriting required' },
    decisions: ['take-income'], match: ['enhanced-annuity', 'impaired-annuity'],
    required: ['provider', 'annualIncome'], optional: ['guaranteePeriod', 'survivorPct'] }),

  // ════════════════════════════ INVESTMENTS ════════════════════════════
  // ── ISAs ──
  A({ id: 'ISA_SS', label: 'Stocks & Shares ISA', desc: 'Tax-free growth · £20k annual cap', category: 'investments', class: 'isa', common: true, icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C03', tax: 'Dividends and gains exempt while inside the wrapper · in estate for IHT (no relief) · APS lets a surviving spouse inherit the allowance' },
    decisions: ['use-allowance', 'bed-and-isa', 'rebalance'], match: ['ss-isa', 'stocks-shares-isa', 'investment-isa'],
    required: ['provider', 'value'], optional: ['ytdContribution'] }),
  A({ id: 'ISA_CASH', label: 'Cash ISA', desc: 'Tax-free interest · same £20k cap', category: 'investments', class: 'isa', common: true, icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C01', tax: 'Interest exempt · counts toward the £20k limit (under-65 cash sub-limit from April 2026) · in estate · check flexible-ISA status' },
    decisions: ['use-allowance', 'check-fscs'], match: ['cash-isa'],
    required: ['provider', 'value'], optional: ['interestRate'] }),
  A({ id: 'LISA', label: 'Lifetime ISA', desc: 'First home or age-60 · 25% bonus', category: 'investments', class: 'isa', icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C05', tax: '25% government bonus on up to £4k/yr · withdraw at 60+ or for a first home (≤£450k) · 25% charge on other withdrawals (effectively takes 6.25% of your own money)' },
    decisions: ['use-allowance'], match: ['lifetime-isa', 'lisa'],
    required: ['provider', 'value'], optional: ['ytdContribution'] }),
  A({ id: 'JISA_SS', label: 'Junior ISA — Stocks & Shares', desc: 'Child under 18 · £9k/yr', category: 'investments', class: 'isa', icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C07', tax: 'Owned by the child · exempt growth · £9,000/yr · becomes an adult ISA at 18 · parental-settlement £100 rule if funded by a parent' },
    decisions: ['use-allowance'], match: ['junior-isa', 'jisa'],
    required: ['provider', 'value'], optional: ['childName', 'ytdContribution'] }),
  A({ id: 'JISA_CASH', label: 'Junior ISA — Cash', desc: 'Child under 18 · cash · £9k/yr', category: 'investments', class: 'isa', icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C06', tax: 'Owned by the child · exempt interest · £9,000/yr · parental-settlement £100 rule if funded by a parent' },
    decisions: ['use-allowance'], match: ['junior-cash-isa'],
    required: ['provider', 'value'], optional: ['childName', 'interestRate'] }),
  A({ id: 'IFISA', label: 'Innovative Finance ISA', desc: 'P2P / crowdfunding debt · tax-free', category: 'investments', class: 'isa', icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C04', tax: 'Interest exempt · holds P2P loans / crowdfunding debt · higher risk · NOT FSCS-protected — platform default risk' },
    riskFlags: ['Not FSCS-protected — capital at risk from platform/borrower default'],
    decisions: ['use-allowance'], match: ['innovative-finance-isa', 'ifisa', 'p2p-isa'],
    required: ['provider', 'value'], optional: ['interestRate'] }),
  A({ id: 'HTB_ISA', label: 'Help to Buy ISA (legacy)', desc: 'Closed to new entrants · bonus to Dec 2029', category: 'investments', class: 'isa', icon: '🛡️', wrapper: 'isa', estate: 'in',
    source: { id: 'C08', tax: 'Closed Dec 2019 to new savers · 25% bonus (max £3,000) on a qualifying first home · must close by Dec 2029 · cannot use both H2B and LISA bonus on the same purchase' },
    decisions: ['use-allowance'], match: ['help-to-buy-isa', 'htb-isa'],
    required: ['provider', 'value'], optional: [] }),
  // ── Tax-efficient ──
  A({ id: 'EIS', label: 'EIS', desc: 'Enterprise Investment Scheme', category: 'investments', class: 'tax-efficient', icon: '🌱', wrapper: 'eis', estate: 'from-2027',
    source: { id: 'E01', tax: '30% income-tax relief on subscription · CGT-exempt if held 3yr+ with relief · CGT deferral relief · BPR-qualifying after 2yr (within the £1m combined cap) · EIS3 certificate needed' },
    riskFlags: ['High-risk, illiquid · relief withdrawn if you dispose inside the holding period'],
    decisions: ['use-allowance', 'check-relief-clock', 'review-iht'], match: ['eis', 'enterprise-investment'],
    required: ['provider', 'value'], optional: ['yearPurchased'] }),
  A({ id: 'SEIS', label: 'SEIS', desc: 'Seed EIS — higher relief', category: 'investments', class: 'tax-efficient', icon: '🌱', wrapper: 'eis', estate: 'from-2027',
    source: { id: 'E02', tax: '50% income-tax relief on up to £200k/yr · 50% CGT reinvestment relief · CGT-exempt after 3yr with relief · BPR-qualifying after 2yr · SEIS3 certificate needed' },
    riskFlags: ['Earliest-stage companies — highest risk · relief withdrawn on early disposal'],
    decisions: ['use-allowance', 'check-relief-clock', 'review-iht'], match: ['seis', 'seed-eis'],
    required: ['provider', 'value'], optional: ['yearPurchased'] }),
  A({ id: 'VCT', label: 'VCT', desc: 'Venture Capital Trust', category: 'investments', class: 'tax-efficient', icon: '🌱', estate: 'in',
    source: { id: 'E03', tax: '20% income-tax relief (from April 2026) on up to £200k/yr · tax-free dividends · CGT-exempt after a 5yr hold · NO BPR — in estate at full value · relief clawed back on early disposal' },
    riskFlags: ['Relief withdrawn if disposed within the 5-year holding period'],
    decisions: ['use-allowance', 'check-relief-clock'], match: ['vct', 'venture-capital-trust'],
    required: ['provider', 'value'], optional: ['yearPurchased'] }),
  // ── Investment bonds ──
  A({ id: 'BOND_ON', label: 'Onshore bond', desc: 'UK life-assurance investment bond', category: 'investments', class: 'investment-bond', icon: '📜', wrapper: 'bond', estate: 'in',
    source: { id: 'F01', tax: 'Chargeable-event regime · 20% basic-rate credit inside the fund · 5% cumulative tax-deferred withdrawal allowance · top-slicing relief · often written in trust' },
    decisions: ['5pct-withdrawal', 'review-trust'], match: ['onshore-bond', 'investment-bond'],
    required: ['provider', 'value'], optional: ['withdrawalPctUsed'] }),
  A({ id: 'BOND_OFF', label: 'Offshore bond', desc: 'Non-UK investment bond', category: 'investments', class: 'investment-bond', icon: '📜', wrapper: 'bond', estate: 'in',
    source: { id: 'F02', tax: 'Gross roll-up · no basic-rate credit — full gain taxed at marginal rate · top-slicing + time-apportionment relief · 5% withdrawal allowance' },
    decisions: ['5pct-withdrawal', 'review-trust'], match: ['offshore-bond'],
    required: ['provider', 'value'], optional: ['withdrawalPctUsed'] }),
  A({ id: 'BOND_WP', label: 'With-profits bond', desc: 'Smoothed-return bond', category: 'investments', class: 'investment-bond', icon: '📜', wrapper: 'bond', estate: 'in',
    source: { id: 'F03', tax: 'Smoothed via annual + terminal bonuses · MVR (market-value reduction) may apply on early surrender — always check before acting' },
    riskFlags: ['A market-value reduction can cut the surrender value in poor markets'],
    decisions: ['5pct-withdrawal', 'check-mvr', 'review-trust'], match: ['with-profits-bond'],
    required: ['provider', 'value'], optional: ['withdrawalPctUsed'] }),
  A({ id: 'BOND_CR', label: 'Capital redemption bond', desc: 'No life assured · for trust use', category: 'investments', class: 'investment-bond', icon: '📜', wrapper: 'bond', estate: 'in',
    source: { id: 'F05', tax: 'Same chargeable-event regime · no life assured required · commonly held in trust — identify the trust type for IHT' },
    decisions: ['5pct-withdrawal', 'review-trust'], match: ['capital-redemption'],
    required: ['provider', 'value'], optional: ['withdrawalPctUsed'] }),
  // ── GIA / unwrapped ──
  A({ id: 'GIA', label: 'GIA / general account', desc: 'Unwrapped — CGT & dividend tax apply', category: 'investments', class: 'gia', common: true, icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D06', tax: 'No wrapper · gains above the CGT exempt amount taxed 18%/24% · dividends above the allowance taxed at dividend rates · Bed & ISA to shelter' },
    decisions: ['bed-and-isa', 'realise-gain', 'rebalance'], match: ['gia', 'general-account', 'unwrapped', 'dealing-account'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'EQUITIES', label: 'Direct shares', desc: 'UK or international listed equities', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D01', tax: 'Dividends taxed at dividend rates above the allowance · disposals 18%/24% (Section 104 pool) · AIM shares: 50% BPR from April 2026 · 0.5% SDRT on UK purchases' },
    decisions: ['realise-gain', 'bed-and-isa'], match: ['equities', 'shares', 'stocks', 'direct-shares'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'GILTS', label: 'UK gilts', desc: 'Government bonds — CGT-exempt', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D03', tax: 'Coupon taxable as interest above the PSA · CGT-EXEMPT on disposal (gilts are specifically exempt — unlike corporate bonds)' },
    decisions: ['rebalance'], match: ['gilts', 'government-bonds', 'treasury'],
    required: ['provider', 'value'], optional: [] }),
  A({ id: 'CORP_BONDS', label: 'Corporate bonds', desc: 'Company fixed-income securities', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D04', tax: 'Interest taxable above the PSA · disposals 18%/24% (NOT CGT-exempt, unlike gilts) · accrued interest on sale is income not capital' },
    decisions: ['realise-gain', 'rebalance'], match: ['corporate-bonds', 'corp-bond'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'FUNDS', label: 'Funds (OEIC / unit trust)', desc: 'Open-ended pooled funds', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D06', tax: 'Income distributions taxed as dividend or interest depending on fund type · disposals 18%/24% · equalisation on the first distribution is capital' },
    decisions: ['bed-and-isa', 'realise-gain', 'rebalance'], match: ['oeic', 'unit-trust', 'funds', 'mutual-fund'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'INV_TRUST', label: 'Investment trust', desc: 'Listed closed-end fund', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D07', tax: 'Trades at a discount/premium to NAV · dividends at dividend rates · disposals 18%/24% (S104 pool) · 0.5% SDRT' },
    decisions: ['realise-gain', 'rebalance'], match: ['investment-trust'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'ETF', label: 'ETF', desc: 'Exchange-traded fund', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D08', tax: 'Disposals 18%/24% · CHECK UK reporting-fund status — a non-reporting ETF has gains taxed as income, not CGT · accumulation units carry excess reportable income' },
    decisions: ['realise-gain', 'bed-and-isa', 'rebalance'], match: ['etf', 'exchange-traded'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'ETC_GOLD', label: 'Gold / commodity ETC', desc: 'Physically-backed metal ETC', category: 'investments', class: 'gia', icon: '📊', wrapper: 'gia', estate: 'in',
    source: { id: 'D10', tax: 'Exchange-traded commodity · no income · disposals 18%/24% · distinct from physical bullion (Alternatives)' },
    decisions: ['realise-gain'], match: ['etc', 'gold-etc', 'commodity-etc'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'REIT', label: 'REIT', desc: 'Listed property investment trust', category: 'investments', class: 'gia', icon: '🏬', wrapper: 'gia', estate: 'in',
    source: { id: 'G15', tax: 'Income is a PID (property income distribution) taxed as property income — the dividend allowance does NOT apply · disposals 18%/24% · 0.5% SDRT' },
    decisions: ['realise-gain', 'rebalance'], match: ['reit', 'property-trust'],
    required: ['provider', 'value'], optional: ['embeddedGain'] }),
  A({ id: 'STRUCTURED', label: 'Structured product', desc: 'Capital-protected / growth plan', category: 'investments', class: 'gia', icon: '📐', wrapper: 'gia', estate: 'in',
    source: { id: 'D11', tax: 'Income or growth elements taxed depending on structure · counterparty risk (not FSCS-protected beyond deposits) · identify the barrier/protection terms' },
    riskFlags: ['Counterparty risk — return depends on the issuer staying solvent'],
    decisions: ['realise-gain'], match: ['structured-product', 'structured-note'],
    required: ['provider', 'value'], optional: ['maturityDate'] }),
  A({ id: 'FX_INVEST', label: 'Foreign currency', desc: 'FX held as an investment', category: 'investments', class: 'gia', icon: '💱', wrapper: 'gia', estate: 'in',
    source: { id: 'D17', tax: 'Personal-use FX exempt up to £6,000 gain · investment FX gains 18%/24% · interest on FX accounts taxable above the PSA' },
    decisions: ['realise-gain'], match: ['fx', 'forex', 'currency-holding'],
    required: ['provider', 'value'], optional: ['currency'] }),

  // ════════════════════════════ PROPERTY ════════════════════════════
  // ── Own use ──
  A({ id: 'RESIDENCE', label: 'Main residence', desc: 'PPR — your home', category: 'property', class: 'own-use-property', common: true, icon: '🏠', estate: 'in',
    source: { id: 'G01', tax: 'Full PPR relief on disposal if always your main home · RNRB up to £175k if it passes to direct descendants · in estate minus mortgage · no BPR' },
    decisions: ['review-iht'],
    required: ['address', 'value', 'purchaseDate', 'purchasePrice'],
    optional: ['mortgageBalance', 'mortgageMonthly', 'mortgageRate', 'mortgageRateType', 'mortgageYears', 'ownership', 'ownershipShare'] }),
  A({ id: 'SECOND_HOME', label: 'Second home', desc: 'Personal-use leisure property', category: 'property', class: 'own-use-property', icon: '🏖️', estate: 'in',
    source: { id: 'G05', tax: 'No PPR unless nominated · CGT 18%/24% on the gain (60-day reporting) · +5% SDLT surcharge on purchase · in estate' },
    decisions: ['sell', 'review-iht'], match: ['second-home', 'holiday-home', 'leisure-property'],
    required: ['address', 'value', 'purchaseDate', 'purchasePrice'],
    optional: ['mortgageBalance', 'ownership', 'ownershipShare'] }),
  A({ id: 'OVERSEAS', label: 'Overseas property', desc: 'Property held abroad', category: 'property', class: 'own-use-property', icon: '🌍', estate: 'in',
    source: { id: 'G06', tax: 'UK residents are taxed on worldwide gains — UK CGT applies with relief for foreign tax · rental income taxable in the UK · local-country taxes and succession rules may also apply' },
    decisions: ['sell', 'review-iht'], match: ['overseas-property', 'foreign-property', 'abroad'],
    required: ['address', 'value'],
    optional: ['country', 'purchasePrice', 'monthlyRent', 'mortgageBalance'] }),
  // ── Let / rental ──
  A({ id: 'BTL', label: 'Buy-to-let', desc: 'Single-dwelling rental', category: 'property', class: 'let-property', common: true, icon: '🏘️', estate: 'in',
    source: { id: 'G02', tax: 'CGT 18%/24% on disposal (60-day reporting) · Section 24: mortgage interest is a 20% tax-credit only, not a deduction · in estate · +5% SDLT on purchase' },
    decisions: ['sell', 'review-iht'], match: ['btl', 'buy-to-let', 'rental-property', 'rental'],
    required: ['label', 'address', 'value', 'purchaseDate', 'purchasePrice', 'monthlyRent'],
    optional: ['mortgageId', 'ownership', 'beneficialPct', 's24Position', 'lastValuationDate'] }),
  A({ id: 'HMO', label: 'HMO', desc: 'House in multiple occupation', category: 'property', class: 'let-property', icon: '🏚️', estate: 'in',
    source: { id: 'G03', tax: 'Let to multiple unrelated tenants · same IT/CGT as BTL · needs an HMO licence · Article 4 areas restrict conversion · higher yield, more compliance' },
    decisions: ['sell', 'review-iht'], match: ['hmo', 'multiple-occupation', 'house-share'],
    required: ['label', 'address', 'value', 'monthlyRent'],
    optional: ['purchasePrice', 'mortgageId', 'hmoLicence', 'rooms'] }),
  A({ id: 'HOLIDAY_LET', label: 'Furnished holiday let', desc: 'FHL — status abolished April 2025', category: 'property', class: 'let-property', icon: '🏕️', estate: 'in',
    source: { id: 'G04', tax: 'FHL status abolished April 2025 — now taxed as standard rental (no BADR, no pension-relievable income, no capital allowances) · trapped losses from any prior FHL period' },
    decisions: ['sell', 'review-iht'], match: ['fhl', 'holiday-let', 'furnished-holiday'],
    required: ['address', 'value', 'annualNetIncome'],
    optional: ['fhlPreApr2025', 'mortgageBalance'] }),
  A({ id: 'MIXED_USE', label: 'Mixed-use property', desc: 'Shop with a flat above, etc.', category: 'property', class: 'let-property', icon: '🏪', estate: 'in',
    source: { id: 'G08', tax: 'Residential element: no interest deduction; commercial element: full deduction · CGT and SDLT apportioned (mixed-use SDLT rates are lower) · partial BPR if the commercial part is trading' },
    decisions: ['sell', 'review-iht'], match: ['mixed-use'],
    required: ['address', 'value'],
    optional: ['monthlyRent', 'mortgageBalance', 'residentialPct'] }),
  A({ id: 'SHARED_OWNERSHIP', label: 'Shared ownership', desc: 'Part-owned, part-rented', category: 'property', class: 'let-property', icon: '🤝', estate: 'in',
    source: { id: 'G12', tax: 'Own a share, rent the rest from a housing association · CGT 18%/24% on the owned share · SDLT election at outset affects future staircasing costs · staircase to 100%' },
    decisions: ['staircase', 'review-iht'], match: ['shared-ownership', 'staircasing'],
    required: ['address', 'value', 'ownershipShare'],
    optional: ['monthlyRent', 'mortgageBalance'] }),
  // ── Commercial & land ──
  A({ id: 'COMMERCIAL', label: 'Commercial property', desc: 'Office, retail, industrial', category: 'property', class: 'commercial-land', icon: '🏢', estate: 'in',
    source: { id: 'G07', tax: 'Full mortgage-interest deductibility (no Section 24 cap — that is residential only) · BPR possible if part of a trading business · VAT option to tax · roll-over relief' },
    decisions: ['sell', 'review-iht', 'review-badr'], match: ['commercial-property', 'commercial'],
    required: ['address', 'value'],
    optional: ['monthlyRent', 'mortgageBalance', 'vatOption'] }),
  A({ id: 'LAND', label: 'Agricultural land', desc: 'Farmland · pasture · let or in-hand', category: 'property', class: 'commercial-land', icon: '🌾', estate: 'in',
    source: { id: 'G09', tax: 'APR on agricultural value (2yr in-hand / 7yr let) · BPR on business value above agricultural value (combined £1m cap at 100% from April 2026) · development value gets no APR' },
    decisions: ['sell', 'review-iht'], match: ['agricultural-land', 'farmland', 'land', 'pasture'],
    required: ['description', 'value'],
    optional: ['acres', 'aprQualifying', 'underTenancy'] }),
  A({ id: 'WOODLAND', label: 'Woodland / forestry', desc: 'Commercial timber', category: 'property', class: 'commercial-land', icon: '🌲', estate: 'in',
    source: { id: 'G10', tax: 'Income from commercial woodland exempt from IT and CGT (Managed Forestry) · BPR-qualifying after 2yr as a trading woodland · separate land value (CGT) from timber value' },
    decisions: ['review-iht'], match: ['woodland', 'timber'],
    required: ['description', 'value'],
    optional: ['acres'] }),
  A({ id: 'DEVELOPMENT_LAND', label: 'Development land', desc: 'Land with planning potential', category: 'property', class: 'commercial-land', icon: '🏗️', estate: 'in',
    source: { id: 'G11', tax: 'Investor vs trader determines IT vs CGT on the planning uplift · in estate · BPR unlikely (investment asset) · SDLT, possible VAT and CIL on development' },
    decisions: ['sell', 'review-iht'], match: ['development-land', 'planning-land'],
    required: ['description', 'value'],
    optional: ['acres', 'planningStatus'] }),
  // ── Structured ──
  A({ id: 'EQUITY_RELEASE', label: 'Equity release (asset note)', desc: 'Lifetime mortgage against your home', category: 'property', class: 'structured-property', icon: '🔑', estate: 'in',
    source: { id: 'G13', tax: 'No IT or CGT event on release (borrowing is not a disposal) · interest rolls up and compounds · the loan + accrued interest reduces the estate — major IHT impact' },
    riskFlags: ['Compound roll-up erodes the equity left in the home over time'],
    decisions: ['review-equity-release', 'review-iht'], match: ['equity-release', 'lifetime-mortgage'],
    required: ['provider', 'value'],
    optional: ['interestRate', 'startDate'] }),
  A({ id: 'HOME_REVERSION', label: 'Home reversion plan', desc: 'Sold a % of the home now', category: 'property', class: 'structured-property', icon: '🔑', estate: 'in',
    source: { id: 'G14', tax: 'Sold a percentage of the home to a provider, retaining the right to live there · the disposed portion leaves the estate; the rest remains · PPR may apply to the part sold' },
    decisions: ['review-iht'], match: ['home-reversion'],
    required: ['provider', 'value'],
    optional: ['pctSold'] }),

  // ════════════════════════════ BUSINESS ════════════════════════════
  // ── Business interests ──
  A({ id: 'PSC_EQUITY', label: 'Ltd company equity', desc: 'Your stake in a company you control', category: 'business', class: 'business-interest', common: true, icon: '🏢', estate: 'in',
    source: { id: 'H04', tax: 'Trading company: BADR if 5%+ shares + votes, officer/employee, held 2yr (effective 18% up to £1m lifetime) · BPR 100% on the first £1m combined (50% above) if trading, not investment · corp tax 19%/25% within' },
    decisions: ['sell', 'review-badr', 'review-iht'], match: ['psc', 'ltd-shares', 'company-shares', 'private-company', 'limited-company'],
    required: ['companyName', 'sharePct', 'estimatedValue'], optional: ['role', 'tradingStatus'] }),
  A({ id: 'LTD_INVESTMENT', label: 'Investment company shares', desc: 'Company holding property/securities', category: 'business', class: 'business-interest', icon: '🏢', estate: 'in',
    source: { id: 'H05', tax: 'Investment (not trading) company: standard CGT 18%/24%, NO BADR, NO BPR · the trading-vs-investment test is the gateway to every relief' },
    decisions: ['sell', 'review-iht'], match: ['investment-company'],
    required: ['companyName', 'sharePct', 'estimatedValue'], optional: ['role'] }),
  A({ id: 'SOLE_TRADER', label: 'Sole-trader business', desc: 'Unincorporated · goodwill & assets', category: 'business', class: 'business-interest', icon: '🛠️', estate: 'in',
    source: { id: 'H01', tax: 'Trading profits taxed at marginal IT rates · Class 4 NI · BADR on a qualifying business disposal · BPR if trading (within the £1m cap) · MTD quarterly from April 2026 if income >£50k' },
    decisions: ['sell', 'review-badr', 'review-iht'], match: ['sole-trader', 'self-employed-business'],
    required: ['business', 'estimatedValue'], optional: ['annualProfit'] }),
  A({ id: 'PARTNERSHIP', label: 'Partnership interest', desc: 'General partnership share', category: 'business', class: 'business-interest', icon: '🤝', estate: 'in',
    source: { id: 'H02', tax: 'Profit share taxed at marginal IT rates · Class 4 NI · BADR on disposal if qualifying · BPR if a trading partnership (within the £1m cap)' },
    decisions: ['sell', 'review-badr', 'review-iht'], match: ['partnership', 'general-partnership'],
    required: ['name', 'sharePct', 'estimatedValue'], optional: [] }),
  A({ id: 'LLP', label: 'LLP interest', desc: 'Limited liability partnership', category: 'business', class: 'business-interest', icon: '🤝', estate: 'in',
    source: { id: 'H03', tax: 'Limited liability · salaried-member rules may reclassify as employment (3-condition test) · BADR on disposal if qualifying · BPR if trading' },
    decisions: ['sell', 'review-iht'], match: ['llp', 'limited-liability-partnership'],
    required: ['name', 'sharePct', 'estimatedValue'], optional: [] }),
  A({ id: 'BPR_AIM', label: 'AIM portfolio (BPR)', desc: 'AIM shares for IHT relief', category: 'business', class: 'business-interest', icon: '📈', wrapper: 'gia', estate: 'in',
    source: { id: 'H06', tax: 'AIM shares: 50% BPR from April 2026 (was 100%) — effective 20% IHT on the full holding · standard CGT 18%/24% · reassess any AIM-for-IHT strategy' },
    decisions: ['review-iht', 'realise-gain'], match: ['aim', 'aim-portfolio', 'aim-shares'],
    required: ['provider', 'value'], optional: ['qualifyingYears'] }),
  A({ id: 'EOT', label: 'EOT proceeds / interest', desc: 'Employee Ownership Trust', category: 'business', class: 'business-interest', icon: '🏢', estate: 'in',
    source: { id: 'H09', tax: 'Sale of a controlling interest to an EOT: only 50% of the gain is subject to CGT (conditions tightened post-Oct 2024) · ongoing trust conditions must be met annually' },
    decisions: ['review-iht'], match: ['eot', 'employee-ownership-trust'],
    required: ['companyName', 'estimatedValue'], optional: [] }),
  A({ id: 'IP_ASSET', label: 'Intellectual property', desc: 'Patents, trademarks, goodwill', category: 'business', class: 'business-interest', icon: '💡', estate: 'in',
    source: { id: 'H10', tax: 'Royalty income taxable (or Patent Box 10% corp tax within a company) · BADR if disposed as part of a qualifying business · BPR if integral to a trading business' },
    decisions: ['review-iht'], match: ['intellectual-property', 'patent', 'trademark'],
    required: ['description', 'estimatedValue'], optional: [] }),
  A({ id: 'DLA', label: "Director's loan account", desc: 'Owed to / from your company', category: 'business', class: 'business-interest', icon: '📒', estate: 'in',
    source: { id: 'H07', tax: 'Owed TO you: an asset in the estate · owed BY you: S455 charge (35.75% from April 2026) on any balance outstanding 9 months after year-end (refunded on repayment), plus a benefit-in-kind if over £10k below the official rate' },
    decisions: ['review-iht'], match: ['dla', 'directors-loan', 'director-loan'],
    required: ['companyName', 'balance', 'inCredit'], optional: [] }),
  // ── Share schemes ──
  A({ id: 'EMI', label: 'EMI options', desc: 'Enterprise Management Incentive', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I01', tax: 'No IT at grant (unless granted below market value) · BADR runs from the GRANT date (effective 18% up to £1m lifetime) · in estate at vested-option value' },
    decisions: ['check-relief-clock', 'review-badr'], match: ['emi', 'enterprise-management'],
    required: ['employer', 'unvested', 'strike'], optional: ['grantDate'] }),
  A({ id: 'CSOP', label: 'CSOP options', desc: 'Company Share Option Plan', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I02', tax: 'Up to £60k per employee · no IT at exercise if held 3–10yr · CGT on disposal above the exercise price · any company size' },
    decisions: ['check-relief-clock'], match: ['csop', 'company-share-option'],
    required: ['employer', 'unvested', 'strike'], optional: ['grantDate'] }),
  A({ id: 'SAYE', label: 'SAYE / Sharesave', desc: 'Save-as-you-earn share option', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I03', tax: 'Save £50–£500/mo over 3 or 5yr · option to buy at up to a 20% discount · no IT/NIC at exercise · transfer to ISA/pension within 90 days to shelter from CGT' },
    decisions: ['check-relief-clock'], match: ['saye', 'sharesave', 'save-as-you-earn'],
    required: ['employer', 'contributedTotal'], optional: ['maturityDate'] }),
  A({ id: 'SIP', label: 'SIP shares', desc: 'Share Incentive Plan', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I04', tax: 'Free / partnership / matching / dividend shares held in trust · no IT or NIC if held 5yr · partnership shares bought from pre-tax salary (NI saving) · CGT base cost = value at removal' },
    decisions: ['check-relief-clock'], match: ['sip', 'share-incentive'],
    required: ['employer', 'value'], optional: ['awardDate'] }),
  A({ id: 'RSU', label: 'RSUs / LTIPs', desc: 'Restricted stock / long-term incentive', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I09', tax: 'IT + NIC at VESTING on the market value · CGT on any further gain after vesting · single-employer concentration risk' },
    riskFlags: ['Concentrates your wealth in one employer — diversification matters'],
    decisions: ['sell', 'realise-gain'], match: ['rsu', 'ltip', 'restricted-stock'],
    required: ['employer', 'unvested', 'estimatedValue'], optional: ['vestDate'] }),
  A({ id: 'UNAPPROVED_OPTIONS', label: 'Unapproved options', desc: 'Non-tax-advantaged options', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I08', tax: 'IT + NIC at exercise on the gain (market value minus exercise price = employment income) · CGT on further gain after exercise · the tax at exercise is a cash-flow event' },
    decisions: ['sell', 'realise-gain'], match: ['unapproved-options', 'non-tax-advantaged'],
    required: ['employer', 'unvested', 'strike'], optional: [] }),
  A({ id: 'GROWTH_SHARES', label: 'Growth / freezer shares', desc: 'Private-company growth shares', category: 'business', class: 'share-scheme', icon: '📑', estate: 'in',
    source: { id: 'I10', tax: 'Issued at low/nil value; growth above the issue value accrues to you · CGT on disposal (base cost = market value at issue) · an HMRC-agreed valuation at grant is the key risk' },
    decisions: ['sell', 'review-iht'], match: ['growth-shares', 'freezer-shares'],
    required: ['employer', 'estimatedValue'], optional: ['issueDate'] }),

  // ════════════════════════════ CASH ════════════════════════════
  A({ id: 'CURRENT', label: 'Current account', desc: 'Day-to-day bank account', category: 'cash', class: 'everyday-cash', common: true, icon: '💷', estate: 'in',
    source: { id: 'M01', tax: 'Interest taxable above the Personal Savings Allowance · FSCS-protected to £85k per institution · check for multiple accounts at the same bank' },
    decisions: ['check-fscs'], match: ['current-account', 'checking'],
    required: ['bank', 'balance'], optional: [] }),
  A({ id: 'SAVINGS', label: 'Easy-access savings', desc: 'Variable-rate, instant access', category: 'cash', class: 'everyday-cash', common: true, icon: '💷', estate: 'in',
    source: { id: 'M02', tax: 'Interest taxable above the PSA · FSCS-protected to £85k per institution' },
    decisions: ['check-fscs', 'use-allowance'], match: ['easy-access', 'savings-account', 'instant-access'],
    required: ['bank', 'balance'], optional: ['interestRate'] }),
  A({ id: 'NOTICE', label: 'Notice account', desc: '32/60/90-day notice · higher rate', category: 'cash', class: 'everyday-cash', icon: '💷', estate: 'in',
    source: { id: 'M03', tax: 'Interest taxable above the PSA · access requires notice (or a penalty) — model the liquidity constraint' },
    decisions: ['check-fscs'], match: ['notice-account'],
    required: ['bank', 'balance'], optional: ['interestRate', 'noticeDays'] }),
  A({ id: 'REGULAR_SAVER', label: 'Regular saver', desc: 'Monthly limit · higher rate', category: 'cash', class: 'everyday-cash', icon: '💷', estate: 'in',
    source: { id: 'M04', tax: 'Interest taxable above the PSA · monthly contribution limit and restricted withdrawals — model the cap' },
    decisions: ['check-fscs'], match: ['regular-saver'],
    required: ['bank', 'balance'], optional: ['interestRate', 'monthlyLimit'] }),
  A({ id: 'FIXED', label: 'Fixed-rate bond', desc: 'Locked-in term deposit', category: 'cash', class: 'everyday-cash', icon: '💷', estate: 'in',
    source: { id: 'M05', tax: 'Interest taxable (in the year received or accrued) · early-access penalty · maturity date affects cash-flow planning' },
    decisions: ['check-fscs'], match: ['fixed-rate-bond', 'term-deposit', 'fixed-term'],
    required: ['bank', 'balance'], optional: ['maturityDate', 'interestRate'] }),
  // ── NS&I ──
  A({ id: 'PREMIUM_BONDS', label: 'Premium Bonds', desc: 'NS&I — prize-draw return', category: 'cash', class: 'nsi', common: true, icon: '🏵️', estate: 'in',
    source: { id: 'M06', tax: 'Prizes are tax-free · state-backed (effectively unlimited protection) · variable effective rate — compare against PSA-sheltered savings' },
    decisions: [], match: ['premium-bonds'],
    required: ['balance'], optional: [] }),
  A({ id: 'NSI_INCOME', label: 'NS&I bonds / saver', desc: 'Income, Direct Saver, Guaranteed', category: 'cash', class: 'nsi', icon: '🏵️', estate: 'in',
    source: { id: 'M07', tax: 'State-backed · interest taxable above the PSA · fixed-rate variants have a term/maturity that affects cash-flow' },
    decisions: ['check-fscs'], match: ['nsi-income', 'income-bonds', 'direct-saver', 'guaranteed-growth'],
    required: ['balance'], optional: ['interestRate', 'maturityDate'] }),
  A({ id: 'NSI_INDEX', label: 'NS&I Index-linked', desc: 'Inflation-linked certificates (legacy)', category: 'cash', class: 'nsi', icon: '🏵️', estate: 'in',
    source: { id: 'M10', tax: 'Tax-free, RPI-linked · not always on sale (held to maturity) · compare against gilts/TIPS/cash-ISA alternatives' },
    decisions: [], match: ['index-linked-certificates', 'nsi-index'],
    required: ['balance'], optional: ['maturityDate'] }),
  // ── FX / offshore / children ──
  A({ id: 'FX_ACCOUNT', label: 'Foreign currency account', desc: 'Multi-currency cash', category: 'cash', class: 'special-cash', icon: '💱', estate: 'in',
    source: { id: 'M12', tax: 'Interest taxable · FX gain above the £6,000 personal-use exemption is a CGT event · track the rate for both interest and gain' },
    decisions: ['realise-gain'], match: ['foreign-currency-account', 'multi-currency'],
    required: ['bank', 'balance'], optional: ['currency'] }),
  A({ id: 'OFFSHORE_CASH', label: 'Offshore deposit', desc: 'Jersey / Guernsey / IoM account', category: 'cash', class: 'special-cash', icon: '🌐', estate: 'in',
    source: { id: 'M13', tax: 'UK residents are taxable on worldwide interest at marginal rate · CRS reports automatically to HMRC · no protection beyond the institution’s own arrangements' },
    decisions: ['check-fscs'], match: ['offshore-deposit', 'offshore-account', 'crown-dependency'],
    required: ['bank', 'balance'], optional: ['interestRate', 'currency'] }),
  A({ id: 'CHILDREN_SAVINGS', label: 'Children’s savings', desc: 'Account for an under-18', category: 'cash', class: 'special-cash', icon: '🧒', estate: 'in',
    source: { id: 'M11', tax: 'Interest taxable · the parental-settlement £100 rule taxes income over £100/yr from a parental gift as the parent’s — identify the source of funds' },
    decisions: [], match: ['childrens-savings', 'child-savings'],
    required: ['bank', 'balance'], optional: ['childName'] }),

  // ════════════════════════════ ALTERNATIVES ════════════════════════════
  A({ id: 'CRYPTO', label: 'Cryptocurrency', desc: 'Tokens, coins, NFTs', category: 'alternatives', class: 'crypto-digital', common: true, icon: '₿', estate: 'in',
    source: { id: 'U01', tax: 'HMRC treats crypto as property · staking/mining/airdrops: IT on receipt; later growth is CGT · disposals 18%/24% (pooled cost) · CARF exchange reporting from Jan 2026' },
    decisions: ['realise-gain', 'review-iht'], match: ['crypto', 'bitcoin', 'ethereum', 'cryptocurrency', 'nft', 'digital-asset'],
    required: ['asset', 'holdings', 'gbpValue'], optional: [] }),
  A({ id: 'GOLD', label: 'Precious metals', desc: 'Physical gold / silver bullion', category: 'alternatives', class: 'precious-hard', common: true, icon: '🥇', estate: 'in',
    source: { id: 'U02', tax: 'UK legal-tender gold coins (Sovereigns, Britannias) are CGT-EXEMPT · bars and foreign coins: 18%/24% under chattel rules · storage & insurance costs' },
    decisions: ['realise-gain'], match: ['gold', 'silver', 'bullion', 'precious-metals'],
    required: ['ounces', 'gbpValue'], optional: ['form'] }),
  A({ id: 'ART', label: 'Art & antiques', desc: 'Paintings, sculpture, antiques', category: 'alternatives', class: 'collectible', icon: '🎨', estate: 'in',
    source: { id: 'U03', tax: 'Non-wasting chattel · CGT-exempt if sold ≤£6,000; marginal relief £6k–£15k; full 18%/24% above £15k · valuation needed for IHT' },
    decisions: ['realise-gain', 'review-iht'], match: ['art', 'antiques', 'painting', 'sculpture'],
    required: ['description', 'estimatedValue'], optional: [] }),
  A({ id: 'CLASSIC_CARS', label: 'Classic cars', desc: 'Collectible vehicles', category: 'alternatives', class: 'collectible', icon: '🚗', estate: 'in',
    source: { id: 'U04', tax: 'Generally a WASTING chattel (predicted life ≤50yr) → usually CGT-EXEMPT · in estate at market value (specialist valuation) · restoration may affect classification' },
    decisions: ['review-iht'], match: ['classic-car', 'classic-cars', 'collector-car'],
    required: ['description', 'estimatedValue'], optional: [] }),
  A({ id: 'WINE', label: 'Fine wine / whisky', desc: 'Wine or maturing casks', category: 'alternatives', class: 'collectible', icon: '🍷', estate: 'in',
    source: { id: 'U05', tax: 'Fine wine: non-wasting chattel (£6k exempt; marginal to £15k; full CGT above) · whisky casks may be wasting (exempt) · bond-warehouse status matters' },
    decisions: ['realise-gain', 'review-iht'], match: ['wine', 'whisky', 'fine-wine', 'cask'],
    required: ['platform', 'estimatedValue'], optional: [] }),
  A({ id: 'JEWELLERY', label: 'Jewellery & watches', desc: 'Luxury watches, heirloom jewellery', category: 'alternatives', class: 'collectible', icon: '💎', estate: 'in',
    source: { id: 'U06', tax: 'Non-wasting chattel: £6k exempt; marginal relief; full 18%/24% above £15k · specialist valuation; provenance matters where there is no receipt' },
    decisions: ['realise-gain', 'review-iht'], match: ['jewellery', 'jewelry', 'watch', 'watches'],
    required: ['description', 'estimatedValue'], optional: [] }),
  A({ id: 'COLLECTIBLE', label: 'Collectibles', desc: 'Coins, stamps, rare books', category: 'alternatives', class: 'collectible', icon: '🏺', estate: 'in',
    source: { id: 'U07', tax: 'Non-wasting chattel rules: £6k exempt; marginal; full CGT above £15k · a set may be treated as one chattel or individually (HMRC discretion)' },
    decisions: ['realise-gain', 'review-iht'], match: ['collectible', 'coins', 'stamps', 'rare-books', 'memorabilia'],
    required: ['description', 'estimatedValue'], optional: [] }),
  A({ id: 'PE', label: 'Private equity / debt', desc: 'Unlisted company or fund', category: 'alternatives', class: 'private-alt', icon: '🤝', estate: 'in',
    source: { id: 'U09', tax: 'Income taxable; CGT on disposal (BADR if qualifying) · illiquid; complex valuation · carried interest is IT + NI from April 2026' },
    riskFlags: ['Illiquid — no ready market; valuations are estimates'],
    decisions: ['review-iht', 'review-badr'], match: ['private-equity', 'private-debt', 'pe-fund', 'co-invest'],
    required: ['fund', 'committed', 'currentValue'], optional: [] }),
  A({ id: 'P2P', label: 'Peer-to-peer loans', desc: 'P2P lending (unwrapped)', category: 'alternatives', class: 'private-alt', icon: '🔗', estate: 'in',
    source: { id: 'U10', tax: 'Interest taxable above the PSA · bad-debt relief available on defaults (HMRC-approved process) · in estate as the outstanding loan value' },
    riskFlags: ['Capital at risk from borrower default · not FSCS-protected'],
    decisions: [], match: ['p2p', 'peer-to-peer', 'p2p-lending'],
    required: ['platform', 'currentValue'], optional: [] }),
  A({ id: 'CROWDFUNDING', label: 'Crowdfunding equity', desc: 'Direct stakes via crowdfunding', category: 'alternatives', class: 'private-alt', icon: '🌐', estate: 'in',
    source: { id: 'U11', tax: 'Usually pre-revenue (no income) · CGT on disposal · SEIS/EIS relief if qualifying — CHECK status first, the treatment is entirely different' },
    riskFlags: ['Highly illiquid · start-up failure risk'],
    decisions: ['check-relief-clock', 'review-iht'], match: ['crowdfunding', 'crowdcube', 'seedrs'],
    required: ['platform', 'currentValue'], optional: [] }),
  A({ id: 'FORESTRY', label: 'Forestry investment', desc: 'Commercial woodland fund', category: 'alternatives', class: 'private-alt', icon: '🌲', estate: 'in',
    source: { id: 'U08', tax: 'Timber income exempt from IT (Managed Forestry) · land disposal is CGT; timber itself is exempt · BPR-qualifying after 2yr of active commercial management' },
    decisions: ['review-iht'], match: ['forestry-investment', 'timber-fund'],
    required: ['fund', 'currentValue'], optional: [] }),

  // ════════════════════════════ PROTECTION ════════════════════════════
  // ── Life cover ──
  A({ id: 'LIFE', label: 'Life cover (level term)', desc: 'Fixed death benefit for a term', category: 'protection', class: 'life-cover', common: true, icon: '🛡️', estate: 'in',
    source: { id: 'J01', tax: 'Proceeds are not taxable · in the estate UNLESS written in trust — a trust keeps it out of the 40% IHT net and avoids probate delay' },
    decisions: ['review-trust', 'review-protection-gap'], match: ['life-cover', 'term-assurance', 'level-term', 'life-insurance'],
    required: ['provider', 'coverAmount'], optional: ['inTrust', 'termEnd'] }),
  A({ id: 'TERM_DECREASING', label: 'Decreasing term', desc: 'Cover falls (tracks a mortgage)', category: 'protection', class: 'life-cover', icon: '🛡️', estate: 'in',
    source: { id: 'J02', tax: 'Proceeds not taxable · usually tracks a repayment mortgage · in estate unless in trust · check it still aligns with the outstanding balance' },
    decisions: ['review-trust', 'review-protection-gap'], match: ['decreasing-term', 'mortgage-life'],
    required: ['provider', 'coverAmount'], optional: ['inTrust', 'termEnd'] }),
  A({ id: 'FIB', label: 'Family income benefit', desc: 'Monthly income to dependants on death', category: 'protection', class: 'life-cover', icon: '🛡️', estate: 'in',
    source: { id: 'J03', tax: 'Pays a monthly income (not a lump sum) to dependants · payments not taxable on receipt · in trust the IHT value is the present value of remaining payments' },
    decisions: ['review-trust', 'review-protection-gap'], match: ['family-income-benefit', 'fib'],
    required: ['provider', 'monthlyBenefit'], optional: ['termEnd', 'inTrust'] }),
  A({ id: 'WHOLE_OF_LIFE', label: 'Whole of life', desc: 'Permanent cover with a surrender value', category: 'protection', class: 'life-cover', icon: '🛡️', estate: 'in',
    source: { id: 'J04', tax: 'Pays out whenever death occurs · surrender value in estate unless in trust · with-profits variants carry MVR risk' },
    decisions: ['review-trust', 'review-iht'], match: ['whole-of-life', 'whole-life'],
    required: ['provider', 'coverAmount'], optional: ['surrenderValue', 'inTrust'] }),
  A({ id: 'RELEVANT_LIFE', label: 'Relevant Life', desc: 'Director life cover via the company', category: 'protection', class: 'life-cover', icon: '🛡️', estate: 'outside',
    source: { id: 'J13', tax: 'Company-paid, corp-tax-deductible premium · no benefit-in-kind on the employee · written in trust from outset — outside the estate · HMRC sum-assured limits apply' },
    decisions: ['review-protection-gap'], match: ['relevant-life'],
    required: ['provider', 'coverAmount'], optional: ['inTrust'] }),
  A({ id: 'GROUP_LIFE', label: 'Group life / death in service', desc: 'Employer-provided, 2–4× salary', category: 'protection', class: 'life-cover', icon: '🛡️', estate: 'outside',
    source: { id: 'J14', tax: 'Paid to the employer’s discretionary trust, not your estate · no IT · keep your expression of wishes current' },
    decisions: ['review-nomination', 'review-protection-gap'], match: ['group-life', 'death-in-service', 'dis'],
    required: ['provider', 'coverAmount'], optional: ['multipleOfSalary'] }),
  // ── Health & income ──
  A({ id: 'CI', label: 'Critical illness', desc: 'Lump sum on diagnosis', category: 'protection', class: 'health-income', common: true, icon: '❤️', estate: 'in',
    source: { id: 'J06', tax: 'Proceeds not taxable · in estate if received and not spent · conditions covered vary widely — not all CI policies are equal' },
    decisions: ['review-protection-gap'], match: ['critical-illness', 'ci-cover'],
    required: ['provider', 'coverAmount'], optional: ['inTrust'] }),
  A({ id: 'IP', label: 'Income protection', desc: 'Monthly benefit if you can’t work', category: 'protection', class: 'health-income', common: true, icon: '❤️', estate: 'outside',
    source: { id: 'J07', tax: 'Replaces ~50–65% of income to recovery/retirement · employee-paid premiums → benefit tax-free; employer-paid → benefit taxable · deferred period applies' },
    decisions: ['review-protection-gap'], match: ['income-protection', 'ip-cover', 'permanent-health'],
    required: ['provider', 'monthlyBenefit'], optional: ['deferralWeeks'] }),
  A({ id: 'IP_SHORT', label: 'Short-term income protection', desc: 'Benefit capped at 12–24 months', category: 'protection', class: 'health-income', icon: '❤️', estate: 'outside',
    source: { id: 'J08', tax: 'Same structure as income protection but benefit is time-limited (12–24 months) · same premium-payer tax rule' },
    decisions: ['review-protection-gap'], match: ['short-term-income-protection', 'asu'],
    required: ['provider', 'monthlyBenefit'], optional: ['deferralWeeks'] }),
  A({ id: 'PMI', label: 'Private medical', desc: 'Health insurance', category: 'protection', class: 'health-income', icon: '❤️', estate: 'outside',
    source: { id: 'J10', tax: 'Employer-paid: a taxable benefit-in-kind (Class 1A NI for the employer); employee-paid: no IT relief' },
    decisions: ['review-protection-gap'], match: ['pmi', 'private-medical', 'health-insurance'],
    required: ['provider', 'annualPremium'], optional: [] }),
  A({ id: 'MPPI', label: 'Mortgage payment protection', desc: 'Covers the mortgage if you can’t work', category: 'protection', class: 'health-income', icon: '❤️', estate: 'outside',
    source: { id: 'J09', tax: 'Pays the mortgage on accident/sickness/unemployment · benefit not taxable · check exclusions (pre-existing conditions, self-employed)' },
    decisions: ['review-protection-gap'], match: ['mppi', 'mortgage-payment-protection'],
    required: ['provider', 'monthlyBenefit'], optional: [] }),
  A({ id: 'HEALTH_CASH', label: 'Health cash plan', desc: 'Cashback on everyday healthcare', category: 'protection', class: 'health-income', icon: '❤️', estate: 'outside',
    source: { id: 'J12', tax: 'Cashback on dental/optical/physio · employer-paid: a benefit-in-kind; employee-paid: no relief' },
    decisions: [], match: ['health-cash-plan', 'cash-plan'],
    required: ['provider', 'annualPremium'], optional: [] }),
  // ── Business protection ──
  A({ id: 'KEYPERSON', label: 'Keyperson cover', desc: 'Company life cover on a key person', category: 'protection', class: 'business-protection', icon: '💼', estate: 'outside',
    source: { id: 'J16', tax: 'Business insures a key person · proceeds to the business · if the premium was a deductible trading expense the proceeds are taxable; if capital, may be capital · not in personal estate' },
    decisions: ['review-protection-gap'], match: ['keyperson', 'key-person', 'keyman'],
    required: ['provider', 'coverAmount'], optional: [] }),
  A({ id: 'SHAREHOLDER_PROT', label: 'Shareholder protection', desc: 'Funds a buyout on death', category: 'protection', class: 'business-protection', icon: '💼', estate: 'in',
    source: { id: 'J17', tax: 'Owners insure each other; a cross-option agreement funds the buyout · personal policy is tax-free but in estate unless in trust · CGT may arise on the share buyout' },
    decisions: ['review-trust', 'review-iht'], match: ['shareholder-protection', 'cross-option'],
    required: ['provider', 'coverAmount'], optional: ['inTrust'] }),
  A({ id: 'PII', label: 'Professional indemnity', desc: 'Business PI cover', category: 'protection', class: 'business-protection', icon: '💼', estate: 'outside',
    source: { id: 'L01', tax: 'Covers professional-advice errors · premium is an allowable business expense · a regulatory requirement for IFAs, solicitors, accountants — absence is a compliance risk' },
    decisions: [], match: ['professional-indemnity', 'pii', 'pi-cover'],
    required: ['provider', 'coverAmount'], optional: [] }),
  // ── General insurance ──
  A({ id: 'HOME_INS', label: 'Home insurance', desc: 'Buildings + contents', category: 'protection', class: 'general-insurance', icon: '🏠', estate: 'in',
    source: { id: 'K01', tax: 'No balance-sheet value · buildings cover should be on a rebuild-cost basis (not market value) · separately list high-value items · under-insurance risk if rebuild cost is stale' },
    decisions: [], match: ['home-insurance', 'buildings-insurance', 'contents-insurance'],
    required: ['provider', 'annualPremium'], optional: ['rebuildCost'] }),
  A({ id: 'MOTOR', label: 'Motor insurance', desc: 'Vehicle cover', category: 'protection', class: 'general-insurance', icon: '🚗', estate: 'in',
    source: { id: 'K05', tax: 'Annual premium · the business-mileage proportion is an allowable expense for the self-employed / directors' },
    decisions: [], match: ['motor-insurance', 'car-insurance'],
    required: ['provider', 'annualPremium'], optional: [] }),
  A({ id: 'TRAVEL_INS', label: 'Travel insurance', desc: 'Annual or single-trip', category: 'protection', class: 'general-insurance', icon: '✈️', estate: 'in',
    source: { id: 'K06', tax: 'Medical/cancellation/baggage cover · flag a coverage gap if travelling with pre-existing conditions and no annual policy' },
    decisions: [], match: ['travel-insurance'],
    required: ['provider', 'annualPremium'], optional: [] }),
]

// ── Lookups ────────────────────────────────────────────────────────────────

const _BY_ID = new Map(ASSET_TYPES.map(t => [t.id, t]))

// Classify a persona's raw type/use string → the canonical asset entry.
// Highest _matchScore wins so a specific sub-type ('hmo', 'btl', 'lisa') beats a
// generic token ('property', 'isa'). Optionally scope to a category to
// disambiguate (e.g. only consider property types for a property row).
export function classifyAsset(typeString, opts = {}) {
  const raw = String(typeString || '').toLowerCase().trim()
  if (!raw) return null
  const pool = opts.category ? ASSET_TYPES.filter(t => t.category === opts.category) : ASSET_TYPES
  let best = null
  let bestScore = 0
  for (const t of pool) {
    for (const tok of t.match) {
      let score = 0
      if (raw === tok) {
        // Exact token (or canonical id) match always wins — guards against a
        // short id ('db', 'ip', 'art') being swallowed by a longer token of
        // another type via reverse-substring.
        score = 1000 + tok.length
      } else if (raw.includes(tok)) {
        // The persona string CONTAINS a known token, e.g. 'mortgage_btl' ⊃ 'btl'.
        // Generic tokens ('pension', 'isa', …) are penalised to 1.
        score = _matchScore(tok)
      } else if (tok.includes(raw) && raw.length >= 4) {
        // The persona string is a PARTIAL of a token, e.g. 'nhs' → 'nhs-pension'.
        // Weak, and only for raw ≥4 chars so short ids don't reverse-collide.
        score = raw.length * 0.5
      }
      if (score > bestScore) { bestScore = score; best = t }
    }
  }
  return best
}

// Human label for a raw type string (falls back to a tidied version of the input).
export function assetLabel(typeString) {
  const hit = _BY_ID.get(typeString) || classifyAsset(typeString)
  if (hit) return hit.label
  return String(typeString || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || 'Asset'
}

// The Add-menu items for one category — shaped exactly as AddItemSheet expects,
// with class/classLabel/classIcon attached so the picker can render sub-headers.
export function assetAddItems(category) {
  return ASSET_TYPES
    .filter(t => t.category === category)
    .map(t => ({
      id: t.id,
      label: t.label,
      desc: t.desc,
      class: t.class,
      classLabel: ASSET_CLASSES[t.class]?.label || '',
      classIcon: ASSET_CLASSES[t.class]?.icon || '•',
      source: t.source,
      required: t.required,
      optional: t.optional,
    }))
}

// Decision verbs that apply to a held asset (raw type string), as label objects.
export function decisionsForAssetType(typeString) {
  const hit = _BY_ID.get(typeString) || classifyAsset(typeString)
  if (!hit) return []
  return hit.decisions.map(d => ({ id: d, label: DECISION_LABELS[d] || d }))
}

// Types in a category the user does NOT yet hold → discovery chips ("not captured
// yet"). `held` is an array of raw type strings.
export function gapAssetTypes(held, category) {
  const heldIds = new Set((held || []).map(h => (_BY_ID.get(h) || classifyAsset(h, { category }))?.id).filter(Boolean))
  return ASSET_TYPES
    .filter(t => t.category === category && !heldIds.has(t.id))
    .map(t => ({ id: t.id, label: t.label, class: t.class, common: t.common }))
}

// Whole-taxonomy counts (used by the Add-menu category cards: "N types").
export function assetTypeCount(category) {
  return ASSET_TYPES.filter(t => t.category === category).length
}
