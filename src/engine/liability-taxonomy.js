// ─────────────────────────────────────────────────────────────────────────────
// liability-taxonomy.js — the CANONICAL UK personal-liability taxonomy.
//
// One source of truth for every debt type a Sonuswealth user could hold. Three
// surfaces read from here so they can never drift apart again:
//   · AddItemSheet      → the "+ Add liability" menu (grouped by class)
//   · LiabilitiesDrillDown → classifyLiability() (categorises held debts) +
//                            the "Not captured yet" discovery chips
//   · MyMoney / tiles   → liabilityLabel() (consistent human names everywhere)
//   · DebtDecisions     → decisionsForType() (which decision verbs apply)
//
// WHY this file exists: before it, the Add-menu hardcoded 6 types, the drill's
// loanCategory() if-chain knew ~10 (and mis-filed second-charge as a residential
// mortgage, dumped HMRC + BNPL into "Other loan"), and a third hardcoded list of
// 14 chips advertised types nothing could add. Founder 2026-06-02: "6 liability
// categories does not represent the entire spectrum of the taxonomy."
//
// Spec source: 0-Active/uk-liabilities-taxonomy-2026-27.md (web-verified, tax
// year 2026/27). taxNote here is DOCUMENTED GUIDANCE PROSE — any figure a
// calculation depends on is read live from the TAX bundle in the rendering
// component, never from this file (memory: never hardcode UK figures into maths).
// ─────────────────────────────────────────────────────────────────────────────

// Ordered classes — drives Add-menu grouping and class headers.
export const LIABILITY_CLASSES = [
  { id: 'secured-on-property',            label: 'Secured on property',      icon: '🏠' },
  { id: 'unsecured-revolving-instalment', label: 'Loans, cards & overdrafts', icon: '💳' },
  { id: 'asset-finance',                  label: 'Car & asset finance',      icon: '🚗' },
  { id: 'tax-and-government',             label: 'Tax & government',         icon: '🏛️' },
  { id: 'business-personal',              label: 'Business (personal)',      icon: '🏢' },
  { id: 'informal-and-insolvency',        label: 'Informal & insolvency',    icon: '🤝' },
]

// Human labels for the closed decision-verb vocabulary.
export const DECISION_LABELS = {
  'overpay':                 'Overpay',
  'remortgage':              'Remortgage / switch rate',
  'switch-rate':             'Switch rate type',
  'consolidate':             'Consolidate',
  'balance-transfer':        'Balance transfer',
  'time-to-pay':             'Time to Pay',
  'clear-before-fees':       'Clear it',
  'voluntary-termination':   'Voluntary termination',
  'do-nothing-written-off':  'Leave it (written off)',
  'equity-release-review':   'Review the release',
  'port':                    'Port the mortgage',
  'staircase':               'Staircase / redeem',
  's455-repay':              'Repay within 9m+1d',
  'seek-debt-advice':        'Get free debt advice',
  'formalise':               'Formalise the loan',
  'reduce-poa':              'Reduce payments on account',
}

// ── Builder — fills sensible defaults so each entry stays compact ──────────────
function L(o) {
  return {
    id: o.id,
    label: o.label,
    class: o.class,
    secured: o.secured ?? false,
    priority: o.priority ?? false,             // priority debt (repossession/bailiff/prison risk)
    estateDeductible: o.estateDeductible ?? true,
    payrollContingent: o.payrollContingent ?? false,
    contingent: o.contingent ?? false,
    legacy: o.legacy ?? false,
    common: o.common ?? false,                 // surfaced as a discovery chip / top of Add list
    icon: o.icon ?? '•',
    taxCode: o.taxCode,
    taxNote: o.taxNote ?? '',
    riskFlags: o.riskFlags ?? [],
    decisions: o.decisions ?? ['overpay'],
    // substrings that classify a persona's raw type string → this entry.
    // Always includes the canonical id; longest matching substring wins, so
    // 'second-charge-mortgage' beats the generic 'mortgage'.
    match: [o.id, ...(o.match ?? [])],
    required: o.required ?? ['lender', 'outstanding'],
    optional: o.optional ?? [],
  }
}

// ── The 50-type taxonomy ──────────────────────────────────────────────────────
export const LIABILITY_TYPES = [
  // ════ Class 1 — Secured on property ════
  L({ id: 'residential-mortgage', label: 'Residential mortgage', class: 'secured-on-property', secured: true, priority: true, common: true, icon: '🏠', taxCode: 'L1-01',
    taxNote: 'No income-tax relief on interest for your own home (MIRAS abolished 2000). Main residence is CGT-exempt under Private Residence Relief.',
    riskFlags: ['Repossession risk if you fall into arrears', 'Payment shock when a fixed rate ends'],
    decisions: ['overpay', 'remortgage', 'switch-rate', 'port'],
    match: ['mortgage', 'home-loan', 'repayment-mortgage'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType', 'rateEndDate', 'termYears'] }),
  L({ id: 'btl-mortgage', label: 'Buy-to-let mortgage', class: 'secured-on-property', secured: true, priority: true, common: true, icon: '🏘️', taxCode: 'L1-02',
    taxNote: 'Section 24: individual landlords get only a 20% basic-rate tax CREDIT on mortgage interest, not a deduction — higher-rate landlords are squeezed.',
    riskFlags: ['S24 hits higher-rate landlords', 'Void periods / rate reset', 'CGT on disposal (no PRR)'],
    decisions: ['overpay', 'remortgage', 'switch-rate'],
    match: ['buy-to-let', 'btl'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType', 'monthlyRent'] }),
  L({ id: 'interest-only-mortgage', label: 'Interest-only mortgage', class: 'secured-on-property', secured: true, priority: true, icon: '🏠', taxCode: 'L1-03',
    taxNote: 'No interest relief on a main home. The capital is NOT reducing — a separate repayment vehicle (savings/investment/sale) must clear the balance at term end.',
    riskFlags: ['Repayment-vehicle shortfall risk', 'Full principal due at term end', 'Lenders restrict at retirement'],
    decisions: ['overpay', 'remortgage', 'switch-rate'],
    match: ['interest-only'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType', 'termEndDate', 'repaymentVehicle'] }),
  L({ id: 'offset-mortgage', label: 'Offset mortgage', class: 'secured-on-property', secured: true, priority: true, icon: '🏠', taxCode: 'L1-04',
    taxNote: 'Linked savings reduce the interest-bearing balance instead of earning (taxable) interest — tax-efficient for higher-rate taxpayers vs holding taxable savings.',
    riskFlags: ['Rate premium over standard fixes', 'Savings locked to the offset'],
    decisions: ['overpay', 'remortgage', 'switch-rate'],
    match: ['offset'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType', 'offsetSavings'] }),
  L({ id: 'second-charge-mortgage', label: 'Second-charge mortgage', class: 'secured-on-property', secured: true, priority: true, common: true, icon: '🏠', taxCode: 'L1-05',
    taxNote: 'A second loan secured on your home, ranking BEHIND the first-charge lender on a sale. FCA-regulated under MCOB. Higher rate than a remortgage because of the subordination risk.',
    riskFlags: ['Ranks behind the first charge — repossession risk', 'Higher APR than remortgaging', 'Ties more borrowing to your home'],
    decisions: ['remortgage', 'consolidate', 'overpay', 'clear-before-fees'],
    match: ['second-charge', 'secured-loan', 'second-mortgage'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType'] }),
  L({ id: 'commercial-mortgage', label: 'Commercial mortgage', class: 'secured-on-property', secured: true, priority: true, icon: '🏢', taxCode: 'L1-06',
    taxNote: 'Section 24 does NOT apply to commercial/non-residential lending — interest is fully deductible against business/property profits. Watch non-residential SDLT and BADR on disposal.',
    riskFlags: ['Business-cashflow dependency', 'Variable/SONIA-linked rate', 'Personal guarantee often attached', 'Refinancing risk on short terms'],
    decisions: ['remortgage', 'switch-rate', 'overpay'],
    match: ['commercial'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'rateType'] }),
  L({ id: 'bridging-finance', label: 'Bridging loan', class: 'secured-on-property', secured: true, priority: true, icon: '🌉', taxCode: 'L1-07',
    taxNote: 'Short-term (≤12 months), interest usually rolled up not paid monthly. No relief for personal use; deductible for a genuine property business. Very high effective cost.',
    riskFlags: ['Very high effective cost', 'Full repayment due at short term end', 'Exit-strategy dependency', 'Default rates spike'],
    decisions: ['remortgage', 'clear-before-fees'],
    match: ['bridging', 'bridge-loan'],
    required: ['lender', 'outstanding'], optional: ['monthlyRatePct', 'termMonths', 'exitStrategy'] }),
  L({ id: 'equity-release-lifetime-mortgage', label: 'Equity release (lifetime mortgage)', class: 'secured-on-property', secured: true, icon: '🔓', taxCode: 'L1-08',
    taxNote: 'Cash released is TAX-FREE (it is a loan, not income). Interest rolls up and COMPOUNDS — the debt grows and deliberately erodes the estate. Equity Release Council: No-Negative-Equity Guarantee + tenure for life.',
    riskFlags: ['Compound roll-up can double the balance in ~10–12 yrs', 'Erodes inheritance', 'Large early-repayment charges', 'Affects means-tested benefits'],
    decisions: ['equity-release-review', 'do-nothing-written-off', 'port'],
    match: ['equity-release', 'lifetime-mortgage'],
    required: ['provider', 'outstanding'], optional: ['apr', 'amountReleased', 'borrowerAge'] }),
  L({ id: 'rio-mortgage', label: 'Retirement interest-only (RIO)', class: 'secured-on-property', secured: true, priority: true, icon: '🏠', taxCode: 'L1-09',
    taxNote: 'Interest paid monthly (NOT rolled up) so the balance stays level — unlike equity release, it does not compound. Capital repaid on death / move into care / sale. No relief.',
    riskFlags: ['Capital repayment deferred to death/care/sale', 'Must evidence affordability into retirement', 'Niche — few lenders'],
    decisions: ['equity-release-review', 'switch-rate', 'overpay'],
    match: ['retirement-interest', 'rio'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'borrowerAge'] }),
  L({ id: 'help-to-buy-equity-loan', label: 'Help-to-Buy equity loan', class: 'secured-on-property', secured: true, legacy: true, icon: '🪜', taxCode: 'L1-10',
    taxNote: 'LEGACY — scheme closed to new applicants (Oct 2022 / completions Mar 2023). You repay a % of the property\'s CURRENT value (not the cash borrowed), so the debt rises with house prices. Interest-free 5 years, then chargeable.',
    riskFlags: ['Repayment scales with house-price growth', 'Interest starts after year 5', 'Must redeem on sale or by year 25', 'Staircasing needs HE consent'],
    decisions: ['staircase', 'remortgage', 'clear-before-fees'],
    match: ['help-to-buy', 'htb-equity'],
    required: ['provider', 'outstanding'], optional: ['equityPercentage', 'currentPropertyValue'] }),
  L({ id: 'shared-ownership-mortgage', label: 'Shared-ownership mortgage + rent', class: 'secured-on-property', secured: true, priority: true, icon: '🏘️', taxCode: 'L1-11',
    taxNote: 'You own a share and pay rent on the rest to a housing association. Mortgage interest gets no relief. SDLT can be staged. Staircasing to buy more share has its own valuation/SDLT rules.',
    riskFlags: ['Dual cost: mortgage + rent + service charge', 'Rent rises annually (often RPI+0.5%)', 'Limited resale market'],
    decisions: ['staircase', 'remortgage', 'switch-rate'],
    match: ['shared-ownership'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'ownedSharePct', 'monthlyRent'] }),

  // ════ Class 2 — Unsecured revolving / instalment ════
  L({ id: 'personal-loan', label: 'Personal loan', class: 'unsecured-revolving-instalment', common: true, icon: '💷', taxCode: 'L2-01',
    taxNote: 'No tax relief on consumer borrowing. Fixed term, fixed instalments, FCA-regulated (CONC). Early settlement may carry up to ~58 days\' interest.',
    riskFlags: ['Default hits your credit file / can lead to a CCJ', 'Early-settlement interest charge'],
    decisions: ['overpay', 'consolidate', 'clear-before-fees'],
    match: ['unsecured-loan', 'unsecured'],
    required: ['lender', 'outstanding', 'apr'], optional: ['monthlyPayment', 'termMonths'] }),
  L({ id: 'credit-card', label: 'Credit card', class: 'unsecured-revolving-instalment', common: true, icon: '💳', taxCode: 'L2-02',
    taxNote: 'No relief. Section 75 gives joint-and-several protection on purchases £100–£30,000. The minimum-payment-only trap compounds the balance for years.',
    riskFlags: ['Minimum-payment trap — interest compounds', 'Easy to grow a revolving balance', 'Promo 0% reverts to full APR'],
    decisions: ['balance-transfer', 'consolidate', 'overpay', 'clear-before-fees'],
    match: ['creditcard', 'card'],
    required: ['provider', 'outstanding', 'apr'], optional: ['creditLimit', 'monthlyPayment', 'promoEndDate'] }),
  L({ id: 'arranged-overdraft', label: 'Overdraft', class: 'unsecured-revolving-instalment', common: true, icon: '🏧', taxCode: 'L2-03',
    taxNote: 'Since the 2020 FCA reforms an overdraft carries a SINGLE annual interest rate — no daily/monthly fees — and ~39.9% is now the most common. Designed for short-term use; costly as a standing balance.',
    riskFlags: ['High APR for persistent use', 'Repayable on demand — the bank can withdraw it', 'A standing overdraft signals cashflow stress'],
    decisions: ['consolidate', 'clear-before-fees', 'switch-rate'],
    match: ['overdraft'],
    required: ['provider', 'outstanding', 'apr'], optional: ['arrangedLimit'] }),
  L({ id: 'unarranged-overdraft', label: 'Unarranged overdraft', class: 'unsecured-revolving-instalment', icon: '🏧', taxCode: 'L2-04',
    taxNote: 'Post-2020 FCA rules: unarranged borrowing must use the SAME single rate as arranged — banks can no longer charge punitive unarranged fees. Refused-payment fees are capped to cost.',
    riskFlags: ['Unauthorised — the bank may bounce payments', 'Credit-file damage', 'Signals acute cashflow stress'],
    decisions: ['clear-before-fees', 'switch-rate', 'seek-debt-advice'],
    match: ['unarranged'],
    required: ['provider', 'outstanding', 'apr'], optional: [] }),
  L({ id: 'bnpl', label: 'Buy now, pay later (BNPL)', class: 'unsecured-revolving-instalment', common: true, icon: '🛍️', taxCode: 'L2-05',
    taxNote: 'Interest-free only while you stay on schedule. BNPL becomes FCA-regulated from 15 July 2026 — affordability checks, Section 75-style protections and Ombudsman access. A missed payment can then mark your credit file.',
    riskFlags: ['Easy to stack agreements — invisible total debt', 'Late fees / collections on default', 'Affordability not always checked pre-July-2026'],
    decisions: ['clear-before-fees', 'consolidate', 'seek-debt-advice'],
    match: ['buy-now', 'pay-later', 'klarna', 'clearpay'],
    required: ['provider', 'outstanding'], optional: ['instalmentsRemaining', 'nextPaymentDate'] }),
  L({ id: 'store-catalogue-card', label: 'Store / catalogue card', class: 'unsecured-revolving-instalment', icon: '🏬', taxCode: 'L2-06',
    taxNote: 'Often a HIGHER APR than mainstream cards. "Buy now, pay nothing for X months" deals frequently back-date interest to the purchase date ("deferred interest") if not cleared before the promo ends.',
    riskFlags: ['Deferred-interest sting if not cleared in full', 'High standard APR', 'Easy in-store impulse credit'],
    decisions: ['clear-before-fees', 'balance-transfer', 'consolidate'],
    match: ['store-card', 'catalogue'],
    required: ['provider', 'outstanding', 'apr'], optional: ['promoEndDate'] }),
  L({ id: 'payday-hcstc', label: 'Payday / high-cost short-term credit', class: 'unsecured-revolving-instalment', priority: false, icon: '⚠️', taxCode: 'L2-07',
    taxNote: 'FCA price cap (CONC 5A): interest + fees capped at 0.8% PER DAY, default fees capped at £15, and a 100% total-cost cap — you never repay more than double what you borrowed. A sign of acute distress: escalate to free debt advice.',
    riskFlags: ['Extremely high cost', 'Rollover/refinance debt spiral', 'Signals acute cashflow distress'],
    decisions: ['clear-before-fees', 'consolidate', 'seek-debt-advice'],
    match: ['payday', 'hcstc', 'short-term-credit'],
    required: ['lender', 'outstanding'], optional: ['dueDate'] }),
  L({ id: 'guarantor-loan', label: 'Guarantor loan', class: 'unsecured-revolving-instalment', icon: '🤝', taxCode: 'L2-08',
    taxNote: 'No relief. If you default, the GUARANTOR becomes legally liable for the full balance and their credit file is hit. Sub-prime pricing.',
    riskFlags: ['Guarantor on the hook for the full debt', 'Relationship + financial risk to the guarantor', 'High sub-prime APR'],
    decisions: ['consolidate', 'overpay', 'clear-before-fees', 'seek-debt-advice'],
    match: ['guarantor'],
    required: ['lender', 'outstanding', 'apr'], optional: ['monthlyPayment', 'guarantorName'] }),
  L({ id: 'credit-union-loan', label: 'Credit-union loan', class: 'unsecured-revolving-instalment', icon: '🏦', taxCode: 'L2-09',
    taxNote: 'Interest is statutorily CAPPED (max 3%/month ≈ 42.6% APR in Great Britain) — a regulated, low-cost alternative to payday/sub-prime credit. Often paired with required savings.',
    riskFlags: ['Membership / common-bond eligibility', 'Lower limits than banks', 'Lower risk than other sub-prime options'],
    decisions: ['overpay', 'consolidate', 'clear-before-fees'],
    match: ['credit-union'],
    required: ['lender', 'outstanding', 'apr'], optional: ['monthlyPayment'] }),
  L({ id: 'debt-consolidation-loan', label: 'Debt-consolidation loan', class: 'unsecured-revolving-instalment', icon: '🧮', taxCode: 'L2-10',
    taxNote: 'No relief. Rolls several debts into one payment. A lower monthly cost often comes from a LONGER term (more total interest). Consolidating unsecured debt into a secured loan converts it into repossession-risk debt.',
    riskFlags: ['Longer term = more total interest', 'Risk of re-borrowing on cleared cards', 'Secured consolidation adds repossession risk'],
    decisions: ['consolidate', 'overpay', 'clear-before-fees'],
    match: ['consolidation'],
    required: ['lender', 'outstanding', 'apr'], optional: ['monthlyPayment', 'termMonths'] }),

  // ════ Class 3 — Asset finance ════
  L({ id: 'car-finance-pcp', label: 'Car finance (PCP)', class: 'asset-finance', secured: true, common: true, icon: '🚗', taxCode: 'L3-01',
    taxNote: 'No relief (personal use). You do NOT own the car until the optional final (balloon / GMFV) payment. Three exit routes at term end: pay the balloon to own, hand it back (mileage/damage charges), or part-exchange.',
    riskFlags: ['Balloon (GMFV) due at term end', 'Excess-mileage & damage charges on return', 'Negative equity if balloon > value', 'Voluntary-termination right after 50% paid'],
    decisions: ['voluntary-termination', 'clear-before-fees', 'do-nothing-written-off'],
    match: ['pcp', 'personal-contract-purchase'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'balloonPayment', 'termEndDate'] }),
  L({ id: 'car-finance-hp', label: 'Car finance (HP)', class: 'asset-finance', secured: true, common: true, icon: '🚗', taxCode: 'L3-02',
    taxNote: 'No relief. You own the car automatically once ALL instalments are paid (no balloon). Voluntary-termination right under CCA s.99: hand it back once 50% of the total payable is paid, capping your liability.',
    riskFlags: ['VT right at 50% paid', 'Higher monthly than PCP (no balloon)', 'Default → repossession (court order after 1/3 paid)'],
    decisions: ['voluntary-termination', 'overpay', 'clear-before-fees'],
    match: ['hire-purchase', '-hp', 'car-finance'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'termMonths'] }),
  L({ id: 'personal-contract-hire', label: 'Car lease (PCH)', class: 'asset-finance', icon: '🚙', taxCode: 'L3-03',
    taxNote: 'A long-term rental, not a credit agreement — no ownership, no balloon, no voluntary-termination right. Early exit triggers an early-termination charge (often ~50% of remaining rentals).',
    riskFlags: ['Early-termination charges', 'Excess-mileage & damage charges', 'No asset built — pure cost'],
    decisions: ['do-nothing-written-off', 'clear-before-fees'],
    match: ['contract-hire', 'pch', 'car-lease', 'lease'],
    required: ['provider', 'outstanding'], optional: ['monthlyRental', 'contractEndDate'] }),
  L({ id: 'equipment-asset-finance', label: 'Equipment / asset finance', class: 'asset-finance', secured: true, icon: '⚙️', taxCode: 'L3-04',
    taxNote: 'For a sole trader/business, interest and (on HP/purchase) capital allowances may be deductible against profits. For personal use, no relief. Often personally guaranteed.',
    riskFlags: ['Asset repossession on default', 'Personal guarantee common', 'Business-cashflow dependency'],
    decisions: ['overpay', 'clear-before-fees'],
    match: ['equipment-finance', 'asset-finance'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['apr', 'assetType'] }),

  // ════ Class 4 — Tax & government ════
  L({ id: 'sa-balancing-payment-poa', label: 'HMRC — Self Assessment', class: 'tax-and-government', priority: true, common: true, icon: '🏛️', taxCode: 'L4-01',
    taxNote: 'Balancing payment due 31 Jan; two Payments on Account (31 Jan & 31 Jul). Late-payment INTEREST runs at the Bank of England base rate plus a margin and accrues daily; late-payment PENALTIES stack at 30 days, 6 and 12 months.',
    riskFlags: ['Priority debt — strong HMRC enforcement', 'Interest accrues daily', 'Penalties stack at 30d / 6m / 12m'],
    decisions: ['time-to-pay', 'clear-before-fees', 'reduce-poa'],
    match: ['hmrc', 'self-assessment', 'sa-balancing', 'self-assessment-tax'],
    required: ['lender', 'outstanding'], optional: ['dueDate', 'taxYear'] }),
  L({ id: 'hmrc-time-to-pay', label: 'HMRC Time-to-Pay plan', class: 'tax-and-government', priority: true, icon: '🏛️', taxCode: 'L4-02',
    taxNote: 'An agreed HMRC instalment plan (self-serve online up to £30,000 SA debt within 60 days of the deadline). Interest STILL accrues at base+margin on the outstanding balance, but a kept plan avoids further late-payment penalties.',
    riskFlags: ['Interest continues during the plan', 'Default reinstates full enforcement + penalties', 'Must keep current-year taxes up to date too'],
    decisions: ['time-to-pay', 'clear-before-fees'],
    match: ['time-to-pay', 'ttp'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: ['dueDate'] }),
  L({ id: 'cgt-owed', label: 'Capital Gains Tax owed', class: 'tax-and-government', priority: true, icon: '📈', taxCode: 'L4-03',
    taxNote: 'UK residential-property gains: 60-DAY reporting + payment window. Other gains: via Self Assessment by 31 Jan. Death gives a CGT base-cost uplift to market value (no CGT on death itself).',
    riskFlags: ['60-day residential deadline is easy to miss', 'Interest + penalties on late payment'],
    decisions: ['time-to-pay', 'clear-before-fees'],
    match: ['cgt', 'capital-gains'],
    required: ['lender', 'outstanding'], optional: ['dueDate'] }),
  L({ id: 'vat-owed', label: 'VAT owed', class: 'tax-and-government', priority: true, icon: '🧾', taxCode: 'L4-04',
    taxNote: 'Relevant to VAT-registered sole traders. Quarterly returns + payment. Late-payment penalties under the points-based regime; interest at base+margin. HMRC is a secondary preferential creditor for VAT in insolvency.',
    riskFlags: ['Priority / preferential debt', 'Points-based late penalties', 'Personal liability for sole traders'],
    decisions: ['time-to-pay', 'clear-before-fees'],
    match: ['vat'],
    required: ['lender', 'outstanding'], optional: ['dueDate'] }),
  L({ id: 'council-tax-arrears', label: 'Council tax arrears', class: 'tax-and-government', priority: true, common: true, icon: '🏛️', taxCode: 'L4-05',
    taxNote: 'PRIORITY DEBT. Miss an instalment → the WHOLE YEAR\'S balance can become due → the council gets a liability order → attachment of earnings/benefits, bailiffs, or (extreme) prison. No APR, but it escalates fast and bailiff fees stack on.',
    riskFlags: ['Priority debt — bailiff/enforcement risk', 'Full annual balance falls due on default', 'Liability order → attachment of earnings'],
    decisions: ['time-to-pay', 'seek-debt-advice', 'clear-before-fees'],
    match: ['council-tax'],
    required: ['lender', 'outstanding'], optional: ['taxYear'] }),
  L({ id: 'student-loan-plan2', label: 'Student loan (Plan 2)', class: 'tax-and-government', estateDeductible: false, payrollContingent: true, common: true, icon: '🎓', taxCode: 'L4-06',
    taxNote: 'Repaid via PAYROLL at 9% of income above the Plan 2 threshold. WRITTEN OFF ON DEATH (the estate is never liable) and 30 years after you became liable. For most graduates it is never fully repaid — overpaying is usually NOT worthwhile.',
    riskFlags: ['Not a conventional debt — never on credit files', 'Written off on death / after 30 years', 'Overpaying rarely optimal — model first'],
    decisions: ['do-nothing-written-off', 'overpay'],
    match: ['student-loan', 'student', 'plan-2', 'plan2'],
    required: ['outstanding'], optional: ['annualIncome'] }),
  L({ id: 'student-loan-plan1', label: 'Student loan (Plan 1)', class: 'tax-and-government', estateDeductible: false, payrollContingent: true, icon: '🎓', taxCode: 'L4-07',
    taxNote: 'Repaid via payroll at 9% of income above the Plan 1 threshold. Interest is the lower of RPI or base+1%. WRITTEN OFF ON DEATH and after 25 years / at a set age.',
    riskFlags: ['Written off on death', 'Income-contingent — not a fixed instalment'],
    decisions: ['do-nothing-written-off', 'overpay'],
    match: ['plan-1', 'plan1'],
    required: ['outstanding'], optional: ['annualIncome'] }),
  L({ id: 'student-loan-plan4', label: 'Student loan (Plan 4 · Scotland)', class: 'tax-and-government', estateDeductible: false, payrollContingent: true, icon: '🎓', taxCode: 'L4-08',
    taxNote: 'Scottish students. Repaid via payroll at 9% above the (highest) Plan 4 threshold. WRITTEN OFF ON DEATH and after 30 years.',
    riskFlags: ['Written off on death / after 30 years', 'Highest repayment threshold of the plans'],
    decisions: ['do-nothing-written-off', 'overpay'],
    match: ['plan-4', 'plan4'],
    required: ['outstanding'], optional: ['annualIncome'] }),
  L({ id: 'student-loan-plan5', label: 'Student loan (Plan 5 · 2023+)', class: 'tax-and-government', estateDeductible: false, payrollContingent: true, icon: '🎓', taxCode: 'L4-09',
    taxNote: 'For courses started Aug 2023+. Repaid via payroll at 9% above the (frozen) Plan 5 threshold. Interest capped at RPI. WRITTEN OFF after 40 YEARS (longer than Plan 2) and on death.',
    riskFlags: ['40-year write-off — longer repayment life', 'Frozen threshold drags more income in over time', 'Written off on death'],
    decisions: ['do-nothing-written-off', 'overpay'],
    match: ['plan-5', 'plan5'],
    required: ['outstanding'], optional: ['annualIncome'] }),
  L({ id: 'postgraduate-loan', label: 'Postgraduate loan', class: 'tax-and-government', estateDeductible: false, payrollContingent: true, icon: '🎓', taxCode: 'L4-10',
    taxNote: 'Master\'s/Doctoral loan. Repaid via payroll at 6% (not 9%) above the PGL threshold, CONCURRENTLY with an undergraduate plan (so 9% + 6% = 15% above both thresholds). WRITTEN OFF after 30 years and on death.',
    riskFlags: ['Stacks with the undergrad plan — 15% combined deduction', 'Written off on death / after 30 years'],
    decisions: ['do-nothing-written-off', 'overpay'],
    match: ['postgraduate', 'pgl', 'postgrad'],
    required: ['outstanding'], optional: ['annualIncome'] }),
  L({ id: 'dwp-benefit-overpayment', label: 'DWP / benefit overpayment', class: 'tax-and-government', priority: true, icon: '🏛️', taxCode: 'L4-11',
    taxNote: 'Recovered by deduction from ongoing benefits, from earnings via a Direct Earnings Attachment, or via a debt collector. Universal Credit overpayments are recoverable even when caused by official error. No interest, but a binding government debt.',
    riskFlags: ['Deducted at source — reduces cashflow', 'Direct Earnings Attachment without a court order', 'Official-error UC overpayments still recoverable'],
    decisions: ['time-to-pay', 'seek-debt-advice'],
    match: ['dwp', 'benefit-overpayment', 'overpayment'],
    required: ['lender', 'outstanding'], optional: [] }),
  L({ id: 'child-maintenance-arrears', label: 'Child maintenance arrears', class: 'tax-and-government', priority: true, icon: '👪', taxCode: 'L4-12',
    taxNote: 'Child Maintenance Service arrears are a PRIORITY debt. CMS can take a Deduction from Earnings Order, deduct from a bank account, obtain a liability order, and (extreme) remove a licence/passport or seek committal.',
    riskFlags: ['Priority debt — aggressive enforcement', 'Deduction from earnings/account without court', 'Licence/passport sanctions in extreme cases'],
    decisions: ['time-to-pay', 'seek-debt-advice'],
    match: ['child-maintenance', 'cms-arrears', 'maintenance-arrears'],
    required: ['lender', 'outstanding'], optional: [] }),

  // ════ Class 5 — Business-personal ════
  L({ id: 'directors-loan-overdrawn', label: "Director's loan (overdrawn)", class: 'business-personal', icon: '🏢', taxCode: 'L5-01',
    taxNote: 'You owe the company. S455 corporation-tax charge applies on any balance outstanding 9 months + 1 day after year-end (reclaimable once repaid). If the balance exceeds £10,000 at any point it is a benefit-in-kind unless interest is charged at HMRC\'s official rate.',
    riskFlags: ['S455 charge if not repaid within 9m+1d', 'Benefit-in-kind + Class 1A NIC if balance >£10k', "'Bed & breakfasting' anti-avoidance rules bite"],
    decisions: ['s455-repay', 'clear-before-fees'],
    match: ['directors-loan-overdrawn', 'overdrawn-dla', 'dla-overdrawn', 'overdrawn', 'director-loan'],
    required: ['company', 'outstanding'], optional: ['companyYearEnd'] }),
  L({ id: 'personal-guarantee-company-debt', label: 'Personal guarantee on company debt', class: 'business-personal', contingent: true, icon: '✍️', taxCode: 'L5-02',
    taxNote: 'A contingent personal liability: if the company defaults the lender calls the guarantee and you must pay personally — potentially losing the home if the PG is backed by a charge. No relief on repayments.',
    riskFlags: ['Contingent — crystallises on company default', 'May be secured over your home', 'Joint-and-several with co-directors', 'Survives company liquidation'],
    decisions: ['seek-debt-advice', 'clear-before-fees'],
    match: ['personal-guarantee', 'company-guarantee'],
    required: ['lender', 'outstanding'], optional: [] }),
  L({ id: 'bounce-back-business-loan-pg', label: 'Business loan (personally guaranteed)', class: 'business-personal', icon: '🏢', taxCode: 'L5-03',
    taxNote: 'Bounce-Back Loans carried NO personal guarantee (company debt only, unless fraud). CBILS/RLS and ordinary business loans frequently DO carry a personal guarantee — distinguish carefully before treating it as a personal liability.',
    riskFlags: ['BBLS: no personal liability unless fraud', 'Non-BBLS facilities may expose personal assets', 'Company default on a PG\'d loan → personal claim'],
    decisions: ['seek-debt-advice', 'time-to-pay', 'clear-before-fees'],
    match: ['bounce-back', 'bbls', 'cbils', 'rls', 'business-loan'],
    required: ['lender', 'outstanding'], optional: ['apr', 'monthlyPayment'] }),

  // ════ Class 6 — Informal & insolvency ════
  L({ id: 'family-informal-loan', label: 'Family / informal loan', class: 'informal-and-insolvency', icon: '🤝', taxCode: 'L6-01',
    taxNote: 'For inheritance tax, an informal debt is only deductible if it is GENUINE and actually repaid (IHTA 1984 s.5 + FA 2013 anti-avoidance). Undocumented family "loans" are often recharacterised as gifts (potentially exempt transfers).',
    riskFlags: ['IHT deductibility challenged without a written agreement', 'May be recharacterised as a gift (PET)', 'Relationship risk; no formal recourse'],
    decisions: ['overpay', 'formalise'],
    match: ['family-loan', 'informal-loan', 'family'],
    required: ['lender', 'outstanding'], optional: ['monthlyPayment'] }),
  L({ id: 'iva', label: 'Individual Voluntary Arrangement (IVA)', class: 'informal-and-insolvency', icon: '⚖️', taxCode: 'L6-02',
    taxNote: 'A legally binding 5–6 year deal with creditors via an Insolvency Practitioner: pay what you can afford, the remainder is WRITTEN OFF on completion. Interest is frozen. Appears on the Individual Insolvency Register + credit file for 6 years. Secured debts sit outside it.',
    riskFlags: ['6 years on credit file + public register', 'Failure can lead to bankruptcy', 'Home equity may need releasing in year 5'],
    decisions: ['seek-debt-advice'],
    match: ['iva', 'voluntary-arrangement'],
    required: ['lender', 'outstanding'], optional: ['monthlyPayment'] }),
  L({ id: 'dmp', label: 'Debt Management Plan (DMP)', class: 'informal-and-insolvency', icon: '📋', taxCode: 'L6-03',
    taxNote: 'INFORMAL and non-binding: one affordable monthly payment distributed to unsecured creditors (free via StepChange/PayPlan). Creditors are ASKED to freeze interest — they don\'t have to. No write-off — you repay in full, over longer.',
    riskFlags: ['Interest freeze is voluntary, not guaranteed', 'No write-off — full repayment over a long period', 'Creditors can still default the account'],
    decisions: ['seek-debt-advice', 'consolidate'],
    match: ['dmp', 'debt-management'],
    required: ['lender', 'outstanding', 'monthlyPayment'], optional: [] }),
  L({ id: 'dro', label: 'Debt Relief Order (DRO)', class: 'informal-and-insolvency', icon: '⚖️', taxCode: 'L6-04',
    taxNote: 'For people who can\'t pay and have little: qualifying unsecured debts ≤ £50,000, assets ≤ £2,000 (plus a vehicle ≤ £4,000), ≤ £75/month spare. A 12-month moratorium, then the debts are WRITTEN OFF. No upfront fee. England & Wales.',
    riskFlags: ['Strict eligibility (debt ≤£50k, assets ≤£2k)', 'Public register + 6 yrs credit file', 'Homeowners usually ineligible (asset cap)'],
    decisions: ['seek-debt-advice', 'do-nothing-written-off'],
    match: ['dro', 'debt-relief-order'],
    required: ['lender', 'outstanding'], optional: [] }),
  L({ id: 'mortgage-arrears', label: 'Mortgage arrears', class: 'informal-and-insolvency', secured: true, priority: true, icon: '🏠', taxCode: 'L6-05',
    taxNote: 'THE highest-priority debt — non-payment risks losing the home. FCA MCOB 13 requires lenders to treat you fairly, consider forbearance (payment holiday, term extension, capitalisation) and use repossession as a LAST resort.',
    riskFlags: ['Priority debt — repossession risk (highest stakes)', 'Arrears compound at the mortgage rate', 'Possession proceedings if unresolved'],
    decisions: ['seek-debt-advice', 'time-to-pay', 'remortgage', 'overpay'],
    match: ['mortgage-arrears', 'arrears'],
    required: ['lender', 'outstanding'], optional: ['monthlyPayment'] }),
  L({ id: 'pension-sharing-debit', label: 'Pension sharing debit (divorce)', class: 'informal-and-insolvency', estateDeductible: false, icon: '💔', taxCode: 'L6-06',
    taxNote: 'A Pension Sharing Order on divorce permanently REDUCES the member\'s pension (a "pension debit") — it is a transfer, not a tax event, and not a repayable cash debt. Relevant to retirement modelling, not the balance sheet of debts.',
    riskFlags: ['Permanent reduction in retirement provision', 'Interacts with the Lump Sum Allowance regime', 'Model the post-debit pension, not the pre-divorce figure'],
    decisions: [],
    match: ['pension-sharing', 'pension-debit'],
    required: ['outstanding'], optional: [] }),
]

// Generic fallback when a held type matches nothing in the taxonomy.
const GENERIC = L({
  id: 'other-loan', label: 'Other loan', class: 'unsecured-revolving-instalment',
  taxNote: 'No specific tax treatment recorded for this debt type.',
  decisions: ['overpay', 'clear-before-fees'], match: [],
})

function _norm(t) { return String(t || '').toLowerCase().trim().replace(/_/g, '-') }

// Generic tokens that must NEVER beat a specific qualifier. 'mortgage' matches
// residential, but a string like 'mortgage-btl' or 'btl-mortgage-commercial'
// must resolve to BTL/Commercial — even though 'mortgage' (8) is longer than
// 'btl' (3). So a generic token scores 1 (last resort); any specific match wins.
const _GENERIC_TOKENS = new Set(['mortgage', 'loan', 'card', 'finance'])
function _matchScore(token) { return _GENERIC_TOKENS.has(token) ? 1 : token.length }

// ── classifyLiability — persona type string → canonical entry ──────────────────
// Most-specific matching substring wins: 'second-charge-mortgage' → second-charge
// (token 'second-charge'); 'mortgage-btl' → BTL ('btl' beats generic 'mortgage');
// a bare 'mortgage' falls through to residential as a last resort.
// opts.strict — return null when nothing genuinely matches, instead of the
// GENERIC "Other loan" catch-all. Import validation needs this so an
// unrecognised row becomes an honest "pick a type" rather than silently
// becoming a debt (founder 2026-06-13: "I don't want a number to go to a wrong
// account"). Display callers keep the GENERIC fallback (default) so .label is
// always safe.
export function classifyLiability(typeString, opts = {}) {
  const t = _norm(typeString)
  if (!t) return opts.strict ? null : GENERIC
  let best = null, bestScore = 0
  for (const entry of LIABILITY_TYPES) {
    for (const m of entry.match) {
      const ms = _norm(m)
      if (!ms || !t.includes(ms)) continue
      const score = _matchScore(ms)
      if (score > bestScore) { best = entry; bestScore = score }
    }
  }
  return best || (opts.strict ? null : GENERIC)
}

// Human label for a raw type string (used by tiles / drill headers everywhere).
export function liabilityLabel(typeString) {
  return classifyLiability(typeString).label
}

// The decision-verb set that applies to a raw type string.
export function decisionsForType(typeString) {
  return classifyLiability(typeString).decisions
}

// The display class metadata for a raw type string.
export function liabilityClassOf(typeString) {
  const cls = classifyLiability(typeString).class
  return LIABILITY_CLASSES.find(c => c.id === cls) || LIABILITY_CLASSES[1]
}

// Whether a held debt is a priority debt (repossession/bailiff/prison risk).
export function isPriorityDebt(typeString) {
  return !!classifyLiability(typeString).priority
}

// ── Add-menu items, grouped by class (shape AddItemSheet consumes) ─────────────
// Each item: { id (UPPER id for itemType), label, desc, required, optional,
//              source: { id, tax } }. Legacy types are sorted to the end of their
// class; common types lead.
export function liabilityAddGroups() {
  return LIABILITY_CLASSES.map(cls => {
    const items = LIABILITY_TYPES
      .filter(t => t.class === cls.id)
      .sort((a, b) => (b.common - a.common) || (a.legacy - b.legacy))
      .map(t => ({
        id: t.id.toUpperCase().replace(/-/g, '_'),
        canonicalId: t.id,
        label: t.label,
        desc: t.taxNote.length > 90 ? t.taxNote.slice(0, 88) + '…' : t.taxNote,
        required: t.required,
        optional: t.optional,
        source: { id: t.taxCode, tax: t.taxNote },
        // class metadata so a flat picker can emit a header on class change
        class: cls.id,
        classLabel: cls.label,
        classIcon: cls.icon,
      }))
    return { class: cls.id, label: cls.label, icon: cls.icon, items }
  })
}

// A flat Add-menu list (back-compat with the single-list `items` shape).
export function liabilityAddItems() {
  return liabilityAddGroups().flatMap(g => g.items)
}

// ── Discovery chips — canonical types the user does NOT currently hold ─────────
// Pass the set of raw type strings the entity already has; returns the `common`
// taxonomy entries not yet held, so the "Not captured yet" row mirrors what the
// + Add control can actually add (no more advertising types nothing can create).
// Map from the Add-menu item id (UPPER_SNAKE, what AddItemSheet emits as
// `itemType`) → the canonical kebab `type` the reducer should store, so a
// freshly-added debt categorises identically to a fixture one.
export const ADD_ID_TO_TYPE = LIABILITY_TYPES.reduce((m, t) => {
  m[t.id.toUpperCase().replace(/-/g, '_')] = t.id
  return m
}, {})

export function gapLiabilityTypes(heldTypeStrings = []) {
  const heldIds = new Set((heldTypeStrings || []).map(t => classifyLiability(t).id))
  return LIABILITY_TYPES.filter(t => t.common && !heldIds.has(t.id))
}
