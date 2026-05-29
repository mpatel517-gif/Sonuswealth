// ─────────────────────────────────────────────────────────────────────────────
// taxonomy.js (L2-1, 2026-05-28)
//
// Single source of truth for entity-shape enumerations. Before this file,
// type values like 'employment', 'SIPP', 'discretionary-trust' were inline
// strings scattered across fixtures, selectors, drill panels, and engine
// helpers. A typo (`employmemt` → silently treated as new income type) had
// no way of being caught. A new income source someone wanted to model had
// no canonical key to reach for.
//
// Each enum entry carries:
//   - key:          canonical identifier (kebab-case)
//   - label:        user-facing string (UK English)
//   - fcaSensitive: true if regulated decisions hinge on this type
//                   (used to flag Ask Sonu responses + FCA banner gating)
//   - taxTreatment: shorthand for the dominant tax exposure
//                   ('IT' = Income Tax, 'CGT' = Capital Gains, 'IHT' = IHT,
//                    'NI' = National Insurance, 'none' = tax-neutral)
//   - validators:   array of value-checking predicates (sparse for v1; will
//                   tighten as fixtures stabilise)
//
// Versioning: TAXONOMY_VERSION bumps whenever a key is renamed or removed.
// Adding new keys does NOT require a bump. Fixtures should record the
// taxonomy version they were written against (`entity.taxonomy_version`)
// so migrations can detect drift.
//
// Used by:
//   - persona-normalizer.js → validateEntity()
//   - tests/dynamic-onboarding.mjs (L2-4)
//   - CI fixture-validator
//
// NOT used by:
//   - Selectors directly (they remain shape-agnostic). The taxonomy is a
//     SCHEMA contract, not a calc contract.
// ─────────────────────────────────────────────────────────────────────────────

export const TAXONOMY_VERSION = '1.0.0'

// Helper to assemble an enum with O(1) key lookup. Returns:
//   { entries: [...], byKey: Map, keys: Set, has(key): bool, get(key): entry }
function makeEnum(name, rows) {
  const entries = Object.freeze(rows.map(r => Object.freeze(r)))
  const byKey = new Map(entries.map(r => [r.key, r]))
  const keys = new Set(entries.map(r => r.key))
  return Object.freeze({
    name,
    entries,
    byKey,
    keys,
    has(k) { return keys.has(k) },
    get(k) { return byKey.get(k) || null },
    labelOf(k) { return byKey.get(k)?.label ?? k },
    list() { return entries },
  })
}

// Shorthand for tax-treatment composition — multiple treatments separated
// by '+'. Order is by relevance (the first treatment is the dominant one).
//   'IT'      — taxed as non-savings income
//   'IT-div'  — taxed as dividend (different rates)
//   'IT-sav'  — taxed as savings income (PSA, starting rate, etc.)
//   'CGT'     — capital gains tax on disposal
//   'IHT'     — within the estate for IHT
//   'NI'      — National Insurance (employee or self-employed)
//   'PR'      — property rental (S24 finance-cost restriction)
//   'BPR'     — qualifies for Business Property Relief
//   'none'    — tax-exempt within current rules

// ── Income types ────────────────────────────────────────────────────────────
export const incomeTypes = makeEnum('incomeTypes', [
  { key: 'employment',          label: 'Employment (PAYE)',         fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'director-salary',     label: 'Director salary',           fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'dividends',           label: 'Dividends',                 fcaSensitive: false, taxTreatment: 'IT-div' },
  { key: 'self-employment',     label: 'Self-employment',           fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'partnership',         label: 'Partnership profit share',  fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'rental-residential',  label: 'Rental (residential)',      fcaSensitive: false, taxTreatment: 'IT+PR' },
  { key: 'rental-commercial',   label: 'Rental (commercial)',       fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'rental-furnished-holiday', label: 'Furnished holiday let', fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'state-pension',       label: 'State Pension',             fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'pension-drawdown',    label: 'Pension drawdown',          fcaSensitive: true,  taxTreatment: 'IT' },
  { key: 'pension-ufpls',       label: 'Pension UFPLS',             fcaSensitive: true,  taxTreatment: 'IT' },
  { key: 'annuity',             label: 'Annuity income',            fcaSensitive: true,  taxTreatment: 'IT' },
  { key: 'savings-interest',    label: 'Savings interest',          fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'bond-coupons',        label: 'Bond coupons',              fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'isa-income',          label: 'ISA income (tax-free)',     fcaSensitive: false, taxTreatment: 'none' },
  { key: 'trust-income',        label: 'Income from trust',         fcaSensitive: true,  taxTreatment: 'IT' },
  { key: 'royalties',           label: 'Royalties',                 fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'other-taxable',       label: 'Other taxable income',      fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'gift-from-family',    label: 'Gift from family (non-taxable)', fcaSensitive: false, taxTreatment: 'none' },
])

// ── Asset types ─────────────────────────────────────────────────────────────
export const assetTypes = makeEnum('assetTypes', [
  { key: 'cash-current',        label: 'Current account',           fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'cash-savings',        label: 'Savings account',           fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'cash-easy-access',    label: 'Easy-access savings',       fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'cash-fixed-term',     label: 'Fixed-term deposit',        fcaSensitive: false, taxTreatment: 'IT-sav' },
  { key: 'isa-cash',            label: 'Cash ISA',                  fcaSensitive: false, taxTreatment: 'none' },
  { key: 'isa-stocks-shares',   label: 'Stocks & shares ISA',       fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'isa-lifetime',        label: 'Lifetime ISA',              fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'isa-junior',          label: 'Junior ISA',                fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'gia',                 label: 'General Investment Account', fcaSensitive: true, taxTreatment: 'CGT+IT-div' },
  { key: 'pension-sipp',        label: 'SIPP',                       fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'pension-personal',    label: 'Personal pension',           fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'pension-occupational-dc', label: 'Occupational DC pension', fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'pension-occupational-db', label: 'Occupational DB pension', fcaSensitive: true, taxTreatment: 'IT' },
  { key: 'pension-ssas',        label: 'SSAS',                       fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'pension-avc',         label: 'AVC',                        fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'pension-state-derived', label: 'State Pension entitlement', fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'property-residence',  label: 'Main residence',             fcaSensitive: false, taxTreatment: 'CGT-PPR+IHT' },
  { key: 'property-btl',        label: 'Buy-to-let property',        fcaSensitive: false, taxTreatment: 'IT+CGT+IHT' },
  { key: 'property-second-home', label: 'Second home',                fcaSensitive: false, taxTreatment: 'CGT+IHT' },
  { key: 'property-commercial', label: 'Commercial property',         fcaSensitive: false, taxTreatment: 'IT+CGT+IHT' },
  { key: 'property-overseas',   label: 'Overseas property',           fcaSensitive: false, taxTreatment: 'IT+CGT+IHT' },
  { key: 'business-equity',     label: 'Private company shares',      fcaSensitive: true,  taxTreatment: 'CGT+BPR+IHT' },
  { key: 'business-partnership', label: 'Partnership interest',       fcaSensitive: true,  taxTreatment: 'CGT+BPR+IHT' },
  { key: 'alt-aim',             label: 'AIM shares',                  fcaSensitive: true,  taxTreatment: 'CGT+BPR+IHT' },
  { key: 'alt-eis',             label: 'EIS investment',              fcaSensitive: true,  taxTreatment: 'CGT-defer+BPR+IHT' },
  { key: 'alt-seis',            label: 'SEIS investment',             fcaSensitive: true,  taxTreatment: 'CGT-defer+BPR+IHT' },
  { key: 'alt-vct',             label: 'VCT shares',                  fcaSensitive: true,  taxTreatment: 'none+IT-div' },
  { key: 'alt-crypto',          label: 'Cryptocurrency',              fcaSensitive: true,  taxTreatment: 'CGT+IHT' },
  { key: 'alt-art',             label: 'Art / collectibles',          fcaSensitive: false, taxTreatment: 'CGT+IHT' },
  { key: 'alt-physical-gold',   label: 'Physical gold',               fcaSensitive: false, taxTreatment: 'CGT+IHT' },
  { key: 'bond-onshore',        label: 'Onshore investment bond',     fcaSensitive: true,  taxTreatment: 'IT-chargeable' },
  { key: 'bond-offshore',       label: 'Offshore investment bond',    fcaSensitive: true,  taxTreatment: 'IT-chargeable' },
  { key: 'trust-bare-asset',    label: 'Bare-trust asset',            fcaSensitive: true,  taxTreatment: 'IT+CGT' },
  { key: 'trust-discretionary-asset', label: 'Discretionary-trust asset', fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
  { key: 'life-policy-cash-value', label: 'Whole-of-life cash value', fcaSensitive: true,  taxTreatment: 'IHT' },
])

// ── Liability types ─────────────────────────────────────────────────────────
export const liabilityTypes = makeEnum('liabilityTypes', [
  { key: 'mortgage-residence',  label: 'Residential mortgage',       fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'mortgage-btl',        label: 'BTL mortgage',               fcaSensitive: true,  taxTreatment: 'PR' },
  { key: 'mortgage-commercial', label: 'Commercial mortgage',        fcaSensitive: true,  taxTreatment: 'PR' },
  { key: 'mortgage-overseas',   label: 'Overseas mortgage',          fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'loan-personal',       label: 'Personal loan',              fcaSensitive: false, taxTreatment: 'none' },
  { key: 'loan-student',        label: 'Student loan',               fcaSensitive: false, taxTreatment: 'none' },
  { key: 'loan-hire-purchase',  label: 'Hire purchase',              fcaSensitive: false, taxTreatment: 'none' },
  { key: 'loan-car-finance',    label: 'Car finance',                fcaSensitive: false, taxTreatment: 'none' },
  { key: 'loan-director',       label: 'Director loan',              fcaSensitive: true,  taxTreatment: 'IT-bik' },
  { key: 'credit-card',         label: 'Credit card balance',        fcaSensitive: false, taxTreatment: 'none' },
  { key: 'overdraft',           label: 'Overdraft',                  fcaSensitive: false, taxTreatment: 'none' },
  { key: 'tax-owed',            label: 'Tax owed (HMRC)',            fcaSensitive: false, taxTreatment: 'none' },
  { key: 'other',               label: 'Other liability',            fcaSensitive: false, taxTreatment: 'none' },
])

// ── Wrapper types (overlay on assets, not the asset itself) ─────────────────
export const wrapperTypes = makeEnum('wrapperTypes', [
  { key: 'ISA',          label: 'ISA (any flavour)',             fcaSensitive: false, taxTreatment: 'none' },
  { key: 'SIPP',         label: 'SIPP',                          fcaSensitive: true,  taxTreatment: 'IHT-2027+IT' },
  { key: 'SSAS',         label: 'SSAS',                          fcaSensitive: true,  taxTreatment: 'IHT-2027+IT' },
  { key: 'GIA',          label: 'General Investment Account',    fcaSensitive: true,  taxTreatment: 'CGT+IT-div' },
  { key: 'Bond-onshore', label: 'Onshore bond',                  fcaSensitive: true,  taxTreatment: 'IT-chargeable' },
  { key: 'Bond-offshore', label: 'Offshore bond',                fcaSensitive: true,  taxTreatment: 'IT-chargeable' },
  { key: 'EIS',          label: 'EIS',                           fcaSensitive: true,  taxTreatment: 'CGT-defer+BPR+IHT' },
  { key: 'SEIS',         label: 'SEIS',                          fcaSensitive: true,  taxTreatment: 'CGT-defer+BPR+IHT' },
  { key: 'VCT',          label: 'VCT',                           fcaSensitive: true,  taxTreatment: 'none+IT-div' },
  { key: 'Trust-bare',   label: 'Bare trust',                    fcaSensitive: true,  taxTreatment: 'IT+CGT' },
  { key: 'Trust-discretionary', label: 'Discretionary trust',    fcaSensitive: true,  taxTreatment: 'IT+CGT+IHT' },
  { key: 'Trust-IIP',    label: 'Interest-in-possession trust',  fcaSensitive: true,  taxTreatment: 'IT+CGT' },
  { key: 'none',         label: 'No wrapper (unwrapped)',        fcaSensitive: false, taxTreatment: 'CGT+IT-div' },
])

// ── Spend categories (used by Cashflow + monthly-flow-engine) ───────────────
export const spendCategories = makeEnum('spendCategories', [
  { key: 'housing-mortgage',    label: 'Mortgage / rent',           fcaSensitive: false, taxTreatment: 'none' },
  { key: 'housing-utilities',   label: 'Utilities',                 fcaSensitive: false, taxTreatment: 'none' },
  { key: 'housing-council-tax', label: 'Council tax',               fcaSensitive: false, taxTreatment: 'none' },
  { key: 'housing-insurance',   label: 'Buildings & contents',      fcaSensitive: false, taxTreatment: 'none' },
  { key: 'food-groceries',      label: 'Groceries',                 fcaSensitive: false, taxTreatment: 'none' },
  { key: 'food-dining',         label: 'Eating out',                fcaSensitive: false, taxTreatment: 'none' },
  { key: 'transport-fuel',      label: 'Fuel',                      fcaSensitive: false, taxTreatment: 'none' },
  { key: 'transport-public',    label: 'Public transport',          fcaSensitive: false, taxTreatment: 'none' },
  { key: 'transport-vehicle',   label: 'Vehicle costs',             fcaSensitive: false, taxTreatment: 'none' },
  { key: 'healthcare',          label: 'Healthcare',                fcaSensitive: false, taxTreatment: 'none' },
  { key: 'education',           label: 'Education',                 fcaSensitive: false, taxTreatment: 'none' },
  { key: 'childcare',           label: 'Childcare',                 fcaSensitive: false, taxTreatment: 'none' },
  { key: 'insurance-life',      label: 'Life insurance',            fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'insurance-other',     label: 'Other insurance',           fcaSensitive: false, taxTreatment: 'none' },
  { key: 'savings-pension',     label: 'Pension contributions',     fcaSensitive: true,  taxTreatment: 'IT-relief' },
  { key: 'savings-isa',         label: 'ISA contributions',         fcaSensitive: false, taxTreatment: 'none' },
  { key: 'savings-other',       label: 'Other savings',             fcaSensitive: false, taxTreatment: 'none' },
  { key: 'debt-service',        label: 'Debt repayments',           fcaSensitive: false, taxTreatment: 'none' },
  { key: 'discretionary-leisure', label: 'Leisure / hobbies',       fcaSensitive: false, taxTreatment: 'none' },
  { key: 'discretionary-subs',  label: 'Subscriptions',             fcaSensitive: false, taxTreatment: 'none' },
  { key: 'discretionary-gifts', label: 'Gifts to family',           fcaSensitive: true,  taxTreatment: 'IHT-PET' },
  { key: 'charity',             label: 'Charitable giving',         fcaSensitive: false, taxTreatment: 'IT-relief' },
  { key: 'taxes',               label: 'Tax payments',              fcaSensitive: false, taxTreatment: 'none' },
  { key: 'other',               label: 'Other',                     fcaSensitive: false, taxTreatment: 'none' },
])

// ── Protection types ────────────────────────────────────────────────────────
export const protectionTypes = makeEnum('protectionTypes', [
  { key: 'life-term',           label: 'Term life insurance',       fcaSensitive: true,  taxTreatment: 'IHT-if-not-trust' },
  { key: 'life-whole',          label: 'Whole-of-life insurance',   fcaSensitive: true,  taxTreatment: 'IHT-if-not-trust' },
  { key: 'life-relevant-life',  label: 'Relevant Life Plan',        fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'critical-illness',    label: 'Critical illness',          fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'income-protection',   label: 'Income protection',         fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'pmi',                 label: 'Private medical',           fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'key-person',          label: 'Key-person cover',          fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'shareholder',         label: 'Shareholder protection',    fcaSensitive: true,  taxTreatment: 'none' },
  { key: 'family-income-benefit', label: 'Family income benefit',   fcaSensitive: true,  taxTreatment: 'IHT-if-not-trust' },
])

// ── Pension vehicle types (used by Pension drill) ───────────────────────────
export const pensionVehicleTypes = makeEnum('pensionVehicleTypes', [
  { key: 'occupational-DB',          label: 'Defined Benefit (final salary)', fcaSensitive: true, taxTreatment: 'IT' },
  { key: 'occupational-DC',          label: 'Defined Contribution (workplace)', fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'group-personal-pension',   label: 'Group Personal Pension',         fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'master-trust',             label: 'Master Trust',                   fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'personal-pension',         label: 'Personal Pension',               fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'stakeholder-pension',      label: 'Stakeholder Pension',            fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'SIPP',                     label: 'SIPP',                           fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'SSAS',                     label: 'SSAS',                           fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'AVC',                      label: 'AVC',                            fcaSensitive: true, taxTreatment: 'IHT-2027+IT' },
  { key: 'state-pension',            label: 'State Pension',                  fcaSensitive: false, taxTreatment: 'IT' },
  { key: 's2p',                      label: 'S2P / SERPS entitlement',        fcaSensitive: false, taxTreatment: 'IT' },
])

// ── Trust types ─────────────────────────────────────────────────────────────
export const trustTypes = makeEnum('trustTypes', [
  { key: 'bare',                       label: 'Bare trust',                   fcaSensitive: true, taxTreatment: 'IT+CGT' },
  { key: 'interest-in-possession',     label: 'Interest-in-possession trust', fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
  { key: 'discretionary',              label: 'Discretionary trust',          fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
  { key: 'accumulation-maintenance',   label: 'Accumulation & maintenance',   fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
  { key: 'bereaved-minor',             label: 'Bereaved minor trust',         fcaSensitive: true, taxTreatment: 'IT+CGT' },
  { key: '18-25',                      label: '18-to-25 trust',               fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
  { key: 'charitable',                 label: 'Charitable trust',             fcaSensitive: true, taxTreatment: 'none' },
  { key: 'employee-benefit',           label: 'Employee benefit trust',       fcaSensitive: true, taxTreatment: 'IT+IHT' },
  { key: 'flexible-power-of-appointment', label: 'Flexible power-of-appointment', fcaSensitive: true, taxTreatment: 'IT+CGT+IHT' },
])

// ── Ownership types ─────────────────────────────────────────────────────────
export const ownershipTypes = makeEnum('ownershipTypes', [
  { key: 'sole',                  label: 'Sole owner',                       fcaSensitive: false, taxTreatment: 'none' },
  { key: 'joint-tenants',         label: 'Joint tenants',                    fcaSensitive: false, taxTreatment: 'IHT-survivorship' },
  { key: 'tenants-in-common',     label: 'Tenants in common',                fcaSensitive: false, taxTreatment: 'IHT-share' },
  { key: 'beneficial-via-trust',  label: 'Beneficial — held in trust',       fcaSensitive: true,  taxTreatment: 'varies-by-trust' },
  { key: 'beneficial-via-company', label: 'Beneficial — held in company',    fcaSensitive: true,  taxTreatment: 'CT+CGT+IHT' },
  { key: 'nominee',               label: 'Nominee arrangement',              fcaSensitive: true,  taxTreatment: 'varies' },
])

// ── Residency statuses ──────────────────────────────────────────────────────
export const residencyStatuses = makeEnum('residencyStatuses', [
  { key: 'uk-domiciled',            label: 'UK domiciled',                   fcaSensitive: false, taxTreatment: 'worldwide' },
  { key: 'uk-resident-non-dom',     label: 'UK resident, non-domiciled',     fcaSensitive: true,  taxTreatment: 'arising-or-remittance' },
  { key: 'uk-resident-deemed-dom',  label: 'UK resident, deemed domiciled',  fcaSensitive: true,  taxTreatment: 'worldwide' },
  { key: 'non-resident',            label: 'Non-resident',                   fcaSensitive: true,  taxTreatment: 'uk-source-only' },
  { key: 'dual-resident',           label: 'Dual resident (treaty)',         fcaSensitive: true,  taxTreatment: 'treaty' },
  { key: 'split-year',              label: 'Split-year treatment',           fcaSensitive: true,  taxTreatment: 'split' },
])

// ── Marital statuses ────────────────────────────────────────────────────────
// Aligned with how persona-normalizer.js maritalStatus() already collapses
// inputs. Add new variants by extending the canonical set, never by inventing
// ad-hoc strings in fixtures.
export const maritalStatuses = makeEnum('maritalStatuses', [
  { key: 'single',                  label: 'Single',                         fcaSensitive: false, taxTreatment: 'none' },
  { key: 'married',                 label: 'Married',                        fcaSensitive: false, taxTreatment: 'spousal-exempt+spousal-nrb' },
  { key: 'civil-partnership',       label: 'Civil partnership',              fcaSensitive: false, taxTreatment: 'spousal-exempt+spousal-nrb' },
  { key: 'cohabitee',               label: 'Cohabiting (unmarried)',         fcaSensitive: false, taxTreatment: 'none' },
  { key: 'separated',               label: 'Separated',                      fcaSensitive: false, taxTreatment: 'transitional' },
  { key: 'divorced',                label: 'Divorced',                       fcaSensitive: false, taxTreatment: 'none' },
  { key: 'widowed',                 label: 'Widowed',                        fcaSensitive: false, taxTreatment: 'tnrb' },
])

// ── Employment types ────────────────────────────────────────────────────────
export const employmentTypes = makeEnum('employmentTypes', [
  { key: 'employed-paye',           label: 'Employed (PAYE)',                fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'self-employed',           label: 'Self-employed sole trader',      fcaSensitive: false, taxTreatment: 'IT+NI-class4' },
  { key: 'partner',                 label: 'Partner (LLP / partnership)',    fcaSensitive: false, taxTreatment: 'IT+NI-class4' },
  { key: 'director-employee',       label: 'Director taking salary',         fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'director-only-dividends', label: 'Director taking dividends only', fcaSensitive: false, taxTreatment: 'IT-div' },
  { key: 'contractor-umbrella',     label: 'Contractor via umbrella',        fcaSensitive: false, taxTreatment: 'IT+NI' },
  { key: 'contractor-personal-co',  label: 'Contractor via own company',     fcaSensitive: true,  taxTreatment: 'IT+IT-div+NI' },
  { key: 'retired',                 label: 'Retired',                        fcaSensitive: false, taxTreatment: 'IT' },
  { key: 'unemployed',              label: 'Not currently working',          fcaSensitive: false, taxTreatment: 'none' },
  { key: 'carer',                   label: 'Carer',                          fcaSensitive: false, taxTreatment: 'none' },
  { key: 'student',                 label: 'Student',                        fcaSensitive: false, taxTreatment: 'none' },
])

// ── Aggregate registry — `TAXONOMY.incomeTypes` etc. ────────────────────────
export const TAXONOMY = Object.freeze({
  version: TAXONOMY_VERSION,
  incomeTypes,
  assetTypes,
  liabilityTypes,
  wrapperTypes,
  spendCategories,
  protectionTypes,
  pensionVehicleTypes,
  trustTypes,
  ownershipTypes,
  residencyStatuses,
  maritalStatuses,
  employmentTypes,
})

// ── Convenience: look up an enum by name ────────────────────────────────────
const ENUM_BY_NAME = Object.freeze({
  incomeTypes,
  assetTypes,
  liabilityTypes,
  wrapperTypes,
  spendCategories,
  protectionTypes,
  pensionVehicleTypes,
  trustTypes,
  ownershipTypes,
  residencyStatuses,
  maritalStatuses,
  employmentTypes,
})

export function getEnum(name) {
  return ENUM_BY_NAME[name] || null
}

// ── Validation helper ───────────────────────────────────────────────────────
// Returns { ok: true } or { ok: false, error: string }. Pure — no I/O.
export function isValidKey(enumName, key) {
  const e = getEnum(enumName)
  if (!e) return { ok: false, error: `unknown_enum:${enumName}` }
  if (!e.has(key)) return { ok: false, error: `unknown_key:${enumName}:${key}` }
  return { ok: true }
}

// Returns all canonical keys for an enum (for CI lints / fixture migrations).
export function keysOf(enumName) {
  const e = getEnum(enumName)
  return e ? Array.from(e.keys) : []
}

// Returns true if the taxonomy treats this key as FCA-sensitive (regulated
// decision involvement). Used by Ask Sonu to gate boundary banners.
export function isFcaSensitive(enumName, key) {
  const e = getEnum(enumName)
  return !!e?.get(key)?.fcaSensitive
}
