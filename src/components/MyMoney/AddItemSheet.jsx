// ─────────────────────────────────────────────────────────────────────────────
// AddItemSheet — bucket-style guided add flow rooted in the canonical
// asset taxonomy (3-Engine-mm-asset-taxonomy-v1_0.md).
//
// Founder direction 2026-05-12: "not everyone will have all the information so
// we needed a way to work out how to add content. That's where the Voyant
// buckets come in. But needs to change to match our Domains."
//
// 3-step flow (my own design, not a Voyant copy):
//   1. Pick a category (one of the 10 per MyMoney v2.7 §3.4)
//   2. Pick an item TYPE from the taxonomy (e.g. SIPP vs SSAS vs Workplace DC)
//   3. Fill 2-3 critical fields for that type
//
// Each type has its own field schema. Submit fires an ASSET_VALUE_UPDATED
// (or DOCUMENT_CAPTURED) event via onCommit. No external parser — this is the
// manual high-trust entry path (FP-5 contract: manual = confidence 1.0).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

// Item taxonomy — distilled from 3-Engine-mm-asset-taxonomy-v1_0.md per category.
// Each item carries:
//   id, label, desc, fields (with `required` array + `optional` array),
//   source (the taxonomy ID + one-line tax position), and an explainerCode
//   that links to a definition entry in Explainer.jsx if applicable.
const CAT_TAXONOMY = {
  pensions: {
    label: 'Pensions',
    items: [
      { id: 'SIPP',           label: 'SIPP',                 desc: 'Self-invested personal pension',
        source: { id: 'A08', tax: 'Contributions tax-relieved at marginal rate · 25% PCLS (capped £268,275 LSA) · drawdown taxable · in estate from April 2027' },
        required: ['provider', 'value'], optional: ['monthlyContribution', 'employerContribution', 'nominationDate'] },
      { id: 'SSAS',           label: 'SSAS',                 desc: 'Small self-administered scheme (director)',
        source: { id: 'A09', tax: 'Employer contributions corp-tax deductible · can lend to sponsoring employer (up to 50%) · in estate from April 2027' },
        required: ['provider', 'value'], optional: ['monthlyContribution', 'employerContribution', 'loanToCompany'] },
      { id: 'WORKPLACE_DC',   label: 'Workplace DC',         desc: 'Auto-enrolment / employer scheme',
        source: { id: 'A03', tax: 'Net pay or salary sacrifice · in estate from April 2027 · MPAA on flexible withdrawal' },
        required: ['provider', 'value'], optional: ['monthlyContribution', 'employerMatchPct'] },
      { id: 'GPP',            label: 'GPP / Stakeholder',    desc: 'Group personal / stakeholder pension',
        source: { id: 'A04', tax: 'Same tax treatment as workplace DC · in estate from April 2027' },
        required: ['provider', 'value'], optional: ['monthlyContribution'] },
      { id: 'DB',             label: 'DB (defined benefit)', desc: 'Final-salary scheme · CETV or annual',
        source: { id: 'A12', tax: 'Income taxable as pension · outside estate (trust) · CETV counts against AA' },
        required: ['scheme', 'projectedAnnual'], optional: ['cetv', 'accrualYears', 'normalRetirementAge'] },
      { id: 'STATE',          label: 'State pension',        desc: 'Forecast from your NI record',
        source: { id: 'A01', tax: 'Taxable as income via PAYE coding · 35 NI years for full · not in estate' },
        required: ['weeklyAmount', 'startAge'], optional: ['niYearsAccrued'] },
      { id: 'FAD',            label: 'FAD (drawdown)',       desc: 'Flexi-access drawdown account',
        source: { id: 'B01', tax: 'PCLS up to LSA tax-free · drawdown income taxable · triggers MPAA on first withdrawal' },
        required: ['provider', 'value'], optional: ['annualWithdrawal', 'pclsTakenSoFar'] },
      { id: 'ANNUITY',        label: 'Annuity',              desc: 'Purchased income for life',
        source: { id: 'B05', tax: 'Income taxed via PAYE · ceases on death unless guarantee/survivor pension' },
        required: ['provider', 'annualIncome'], optional: ['guaranteePeriod', 'survivorPct'] },
    ],
  },
  investments: {
    label: 'Savings & Investments',
    items: [
      { id: 'ISA_SS',         label: 'Stocks & Shares ISA',  desc: '£20k annual allowance',                    fields: ['provider', 'value', 'ytdContribution'] },
      { id: 'ISA_CASH',       label: 'Cash ISA',             desc: 'Counts toward the same £20k cap',          fields: ['provider', 'value', 'interestRate'] },
      { id: 'LISA',           label: 'Lifetime ISA',         desc: 'First home or age-60 wrapper',             fields: ['provider', 'value'] },
      { id: 'GIA',            label: 'GIA / general account',desc: 'Unwrapped — CGT applies',                  fields: ['provider', 'value', 'embeddedGain'] },
      { id: 'EIS',            label: 'EIS',                  desc: 'Enterprise Investment Scheme',             fields: ['provider', 'value', 'yearPurchased'] },
      { id: 'SEIS',           label: 'SEIS',                 desc: 'Seed EIS — higher relief',                 fields: ['provider', 'value', 'yearPurchased'] },
      { id: 'VCT',            label: 'VCT',                  desc: 'Venture Capital Trust',                    fields: ['provider', 'value', 'yearPurchased'] },
      { id: 'BOND_ON',        label: 'Onshore bond',         desc: 'UK life-assurance investment bond',        fields: ['provider', 'value', 'withdrawalPctUsed'] },
      { id: 'BOND_OFF',       label: 'Offshore bond',        desc: 'Non-UK investment bond',                   fields: ['provider', 'value'] },
    ],
  },
  property: {
    label: 'Property',
    items: [
      { id: 'RESIDENCE',      label: 'Main residence',       desc: 'PPR — your home',
        source: { id: 'G01', tax: 'Full PPR relief on disposal if always main home · RNRB up to £175k if passes to direct descendants · in estate' },
        required: ['address', 'value', 'purchaseDate', 'purchasePrice'],
        optional: ['mortgageBalance', 'mortgageMonthly', 'mortgageRate', 'mortgageRateType', 'mortgageYears', 'ownership', 'ownershipShare'] },
      { id: 'BTL',            label: 'Buy-to-let',           desc: 'Rental income property',
        source: { id: 'G02', tax: 'CGT 18%/24% on disposal (60-day reporting) · S24 mortgage interest 20% tax-credit only · in estate · +5% SDLT on purchase' },
        required: ['label', 'address', 'value', 'purchaseDate', 'purchasePrice', 'monthlyRent'],
        optional: ['mortgageId', 'ownership', 'beneficialPct', 's24Position', 'lastValuationDate'] },
      { id: 'HOLIDAY_LET',    label: 'Furnished holiday let',desc: 'FHL — different tax treatment',
        source: { id: 'G04', tax: 'FHL status abolished April 2025 — now standard rental · trapped losses from prior FHL period' },
        required: ['address', 'value', 'annualNetIncome'],
        optional: ['fhlPreApr2025', 'mortgageBalance'] },
      { id: 'COMMERCIAL',     label: 'Commercial',           desc: 'Office, retail, industrial',
        source: { id: 'G07', tax: 'Full mortgage-interest deductibility · BPR possible if part of trading business · VAT option to tax' },
        required: ['address', 'value'],
        optional: ['monthlyRent', 'mortgageBalance', 'vatOption'] },
      { id: 'LAND',           label: 'Land',                 desc: 'Bare land · agricultural',
        source: { id: 'G09', tax: 'APR on agricultural value (2yr in-hand / 7yr let) · BPR on business value above ag value · combined £1m cap from April 2026' },
        required: ['description', 'value'],
        optional: ['acres', 'aprQualifying', 'underTenancy'] },
    ],
  },
  business: {
    label: 'Business Assets',
    items: [
      { id: 'PSC_EQUITY',     label: 'Ltd company equity',   desc: 'Your stake in a company you control',      fields: ['companyName', 'sharePct', 'estimatedValue'] },
      { id: 'PARTNERSHIP',    label: 'Partnership stake',    desc: 'LLP / general partnership interest',       fields: ['name', 'sharePct', 'estimatedValue'] },
      { id: 'EMI',            label: 'EMI options',          desc: 'Enterprise Management Incentive',          fields: ['employer', 'unvested', 'strike'] },
      { id: 'RSU',            label: 'RSUs',                 desc: 'Restricted stock units',                   fields: ['employer', 'unvested', 'estimatedValue'] },
      { id: 'SAYE',           label: 'SAYE',                 desc: 'Save-as-you-earn share option',            fields: ['employer', 'contributedTotal'] },
      { id: 'BPR_AIM',        label: 'BPR-qualifying AIM',   desc: 'AIM portfolio for IHT relief',             fields: ['provider', 'value', 'qualifyingYears'] },
      { id: 'DLA',            label: "Director's loan a/c",  desc: 'Owed to/from the company',                 fields: ['companyName', 'balance', 'inCredit'] },
    ],
  },
  protection: {
    label: 'Protection',
    items: [
      { id: 'LIFE',           label: 'Life cover',           desc: 'Death-benefit policy',                     fields: ['provider', 'coverAmount', 'inTrust'] },
      { id: 'CI',             label: 'Critical illness',     desc: 'Lump-sum on diagnosis',                    fields: ['provider', 'coverAmount'] },
      { id: 'IP',             label: 'Income protection',    desc: 'Monthly benefit if you can\'t work',       fields: ['provider', 'monthlyBenefit', 'deferralWeeks'] },
      { id: 'PMI',            label: 'Private medical',      desc: 'Health insurance',                         fields: ['provider', 'annualPremium'] },
      { id: 'RELEVANT_LIFE',  label: 'Relevant Life',        desc: 'Director life cover via company',          fields: ['provider', 'coverAmount'] },
      { id: 'KEYPERSON',      label: 'Keyperson',            desc: 'Company-owned life cover on a key person', fields: ['provider', 'coverAmount'] },
      { id: 'HOME_INS',       label: 'Home insurance',       desc: 'Buildings + contents',                     fields: ['provider', 'annualPremium'] },
      { id: 'MOTOR',          label: 'Motor',                desc: 'Vehicle cover',                            fields: ['provider', 'annualPremium'] },
      { id: 'PII',            label: 'Professional indemnity',desc: 'Business PI cover',                       fields: ['provider', 'coverAmount'] },
    ],
  },
  cash: {
    label: 'Cash',
    items: [
      { id: 'CURRENT',        label: 'Current account',      desc: 'Day-to-day bank account',                  fields: ['bank', 'balance'] },
      { id: 'SAVINGS',        label: 'Savings account',      desc: 'Easy-access or notice savings',            fields: ['bank', 'balance', 'interestRate'] },
      { id: 'FIXED',          label: 'Fixed-term deposit',   desc: 'Locked-in fixed-rate savings',             fields: ['bank', 'balance', 'maturityDate'] },
      { id: 'PREMIUM_BONDS',  label: 'Premium Bonds',        desc: 'NS&I — prize-draw return',                 fields: ['balance'] },
    ],
  },
  liabilities: {
    label: 'Liabilities',
    items: [
      { id: 'MORTGAGE',       label: 'Residential mortgage', desc: 'Loan secured on your home',                fields: ['lender', 'outstanding', 'monthlyPayment'] },
      { id: 'BTL_MORTGAGE',   label: 'BTL mortgage',         desc: 'Loan secured on rental property',          fields: ['lender', 'outstanding', 'rateType'] },
      { id: 'PERSONAL_LOAN',  label: 'Personal loan',        desc: 'Unsecured loan',                           fields: ['lender', 'outstanding', 'apr'] },
      { id: 'CREDIT_CARD',    label: 'Credit card',          desc: 'Revolving credit balance',                 fields: ['provider', 'outstanding', 'apr'] },
      { id: 'STUDENT_LOAN',   label: 'Student loan',         desc: 'Plan 1 / 2 / 4 / 5',                       fields: ['plan', 'outstanding'] },
      { id: 'HP',             label: 'Hire purchase / lease',desc: 'Car HP, equipment lease',                  fields: ['lender', 'outstanding', 'monthlyPayment'] },
    ],
  },
  income: {
    label: 'Income',
    items: [
      { id: 'EMPLOYMENT',     label: 'Employment salary',    desc: 'PAYE income',                              fields: ['employer', 'grossAnnual'] },
      { id: 'SELF_EMPLOYMENT',label: 'Self-employment',      desc: 'Sole-trader profit',                       fields: ['business', 'annualProfit'] },
      { id: 'DIRECTOR_SALARY',label: 'Director salary',      desc: 'Salary from your Ltd Co',                  fields: ['company', 'annualSalary'] },
      { id: 'DIRECTOR_DIV',   label: 'Director dividends',   desc: 'Dividends from your Ltd Co',               fields: ['company', 'annualDividend'] },
      { id: 'INVESTMENT_DIV', label: 'Investment dividends', desc: 'Dividends from listed shares',             fields: ['source', 'annualDividend'] },
      { id: 'RENTAL',         label: 'Rental income',        desc: 'Net rental from property',                 fields: ['source', 'annualNet'] },
      { id: 'INTEREST',       label: 'Interest',             desc: 'Savings interest received',                fields: ['source', 'annualInterest'] },
      { id: 'STATE_PENSION',  label: 'State pension (in pay)',desc: 'Currently receiving',                     fields: ['weeklyAmount'] },
      { id: 'BENEFIT',        label: 'Other benefit',        desc: 'Carer\'s allowance, PIP, etc',             fields: ['type', 'weeklyAmount'] },
    ],
  },
  alternatives: {
    label: 'Alternatives',
    items: [
      { id: 'CRYPTO',         label: 'Crypto',               desc: 'Tokens or coins',                          fields: ['asset', 'holdings', 'gbpValue'] },
      { id: 'GOLD',           label: 'Gold / bullion',       desc: 'Physical metal',                           fields: ['ounces', 'gbpValue'] },
      { id: 'ART',            label: 'Art',                  desc: 'Single works or collection',               fields: ['description', 'estimatedValue'] },
      { id: 'WINE',           label: 'Fine wine',            desc: 'Collection or En Primeur',                 fields: ['platform', 'estimatedValue'] },
      { id: 'PE',             label: 'Private equity',       desc: 'PE fund or co-invest',                     fields: ['fund', 'committed', 'currentValue'] },
      { id: 'COLLECTIBLE',    label: 'Collectible',          desc: 'Watches, classic cars, etc',               fields: ['description', 'estimatedValue'] },
    ],
  },
  obligations: {
    label: 'Obligations',
    items: [
      { id: 'PARENT_CARE',    label: 'Parent care',          desc: 'Care home or domiciliary support',         fields: ['annualCost'] },
      { id: 'SCHOOL_FEES',    label: 'School fees',          desc: 'Independent school fees',                  fields: ['school', 'annualFees'] },
      { id: 'ADULT_DEP',      label: 'Adult dependent',      desc: 'Disabled child, parent, sibling support',  fields: ['name', 'annualSupport'] },
      { id: 'MAINTENANCE',    label: 'Maintenance',          desc: 'Court-ordered or voluntary',               fields: ['payee', 'monthly'] },
    ],
  },
}

const CAT_ORDER = ['pensions', 'investments', 'property', 'business', 'protection', 'cash', 'liabilities', 'income', 'alternatives', 'obligations']

export default function AddItemSheet({ open, initialCategory = null, onClose, onCommit }) {
  const [step, setStep] = useState(initialCategory ? 'type' : 'category')
  const [cat, setCat] = useState(initialCategory)
  const [itemType, setItemType] = useState(null)
  const [fields, setFields] = useState({})

  if (!open) return null

  const catNode = cat ? CAT_TAXONOMY[cat] : null
  const itemNode = catNode && itemType ? catNode.items.find(i => i.id === itemType) : null

  function reset() {
    setStep('category'); setCat(null); setItemType(null); setFields({})
  }
  function chooseCat(id) {
    setCat(id); setStep('type')
  }
  function chooseType(id) {
    setItemType(id)
    // initialise fields object — support both legacy (fields[]) and new
    // (required[] + optional[]) item shapes.
    const node = CAT_TAXONOMY[cat]?.items.find(i => i.id === id)
    if (node) {
      const init = {}
      const allFields = [...(node.required || node.fields || []), ...(node.optional || [])]
      for (const f of allFields) init[f] = ''
      setFields(init)
    }
    setStep('fields')
  }
  function submit() {
    if (!cat || !itemType) return
    // Strip _docName/_docSize/_docMime out of the asset payload — they're
    // document metadata, not item fields.
    const { _docName, _docSize, _docMime, ...assetFields } = fields
    const assetId = `${itemType.toLowerCase()}-${Date.now().toString(36)}`
    onCommit?.({
      type: 'ASSET_VALUE_UPDATED',
      ts: Date.now(),
      correlation_id: `mm-add-${Date.now()}`,
      payload: {
        id: assetId,
        category: cat,
        itemType,
        fields: assetFields,
        source: 'manual',
        confidence: 1.0,
      },
    })
    // If a document was attached, fire a follow-up DOCUMENT_CAPTURED that
    // attaches the file reference to the asset just created.
    if (_docName) {
      onCommit?.({
        type: 'DOCUMENT_CAPTURED',
        ts: Date.now(),
        correlation_id: `mm-doc-${Date.now()}`,
        payload: {
          assetId,
          category: cat,
          itemType,
          document: {
            name: _docName,
            size: _docSize || 0,
            mime: _docMime || '',
            capturedAt: new Date().toISOString(),
          },
          // parsed: {} — left empty; real OCR/parser lands separately
        },
      })
    }
    reset()
    onClose?.()
  }
  function close() { reset(); onClose?.() }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={close} />
      <div className="sheet-panel sw-fade-in-up" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        {/* Step strip */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {['category', 'type', 'fields'].map((s, i) => {
            const active = step === s
            const done = ['category', 'type', 'fields'].indexOf(step) > i
            return (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 100,
                background: (active || done) ? 'var(--c-acc)' : 'var(--c-surface2)',
                transition: 'background .25s',
              }} />
            )
          })}
        </div>

        {step === 'category' && (
          <>
            <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Step 1 of 3 · Category</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 12 }}>
              What kind of item are you adding?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {CAT_ORDER.map(id => (
                <button key={id} onClick={() => chooseCat(id)}
                  className="sw-pressable"
                  style={{
                    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 12,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-text)' }}>
                    {CAT_TAXONOMY[id].label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 3 }}>
                    {CAT_TAXONOMY[id].items.length} types
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'type' && catNode && (
          <>
            <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Step 2 of 3 · Type</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 12 }}>
              Which {catNode.label.toLowerCase()} type?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {catNode.items.map(it => (
                <button key={it.id} onClick={() => chooseType(it.id)}
                  className="sw-pressable"
                  style={{
                    padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                    background: 'var(--c-surface2)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 10,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{it.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{it.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('category')} className="sw-press" style={btnGhost}>← Back</button>
          </>
        )}

        {step === 'fields' && itemNode && (() => {
          // Support both shapes — new (required/optional) + legacy (fields)
          const requiredFields = itemNode.required || itemNode.fields || []
          const optionalFields = itemNode.optional || []
          return (
            <>
              <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Step 3 of 3 · Details</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>
                {itemNode.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 12, lineHeight: 1.5 }}>
                {itemNode.desc}
              </div>

              {/* Taxonomy source banner — from 3-Engine-mm-asset-taxonomy-v1_0.md.
                  Surfaces the canonical tax position so the user knows what
                  they're capturing (and the rules engine knows what to apply). */}
              {itemNode.source && (
                <div style={{
                  padding: '10px 12px', marginBottom: 14, borderRadius: 10,
                  background: 'color-mix(in srgb, var(--c-acc) 6%, var(--c-surface2))',
                  border: '1px solid color-mix(in srgb, var(--c-acc) 20%, var(--c-border))',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: 'var(--c-acc)',
                    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>From the canonical taxonomy</span>
                    <span style={{ color: 'var(--c-text3)' }}>·</span>
                    <span style={{ color: 'var(--c-text3)', textTransform: 'none', letterSpacing: 0.2, fontWeight: 700 }}>
                      ID {itemNode.source.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                    {itemNode.source.tax}
                  </div>
                </div>
              )}

              <div style={{
                fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
              }}>Required</div>
              {requiredFields.map(f => (
                <div key={f} style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
                    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
                  }}>
                    {prettyField(f)}
                  </div>
                  <input
                    value={fields[f] || ''}
                    onChange={e => setFields({ ...fields, [f]: e.target.value })}
                    type={fieldType(f)}
                    placeholder={fieldPlaceholder(f)}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 14,
                      background: 'var(--c-surface2)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 8, color: 'var(--c-text)',
                    }}
                  />
                </div>
              ))}

              {optionalFields.length > 0 && (
                <details style={{ marginBottom: 10, marginTop: 6 }}>
                  <summary style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--c-acc)',
                    cursor: 'pointer', padding: '6px 0', userSelect: 'none',
                  }}>
                    + Optional fields ({optionalFields.length}) — improves engine accuracy
                  </summary>
                  <div style={{ marginTop: 8, paddingLeft: 4 }}>
                    {optionalFields.map(f => (
                      <div key={f} style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
                          letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
                        }}>
                          {prettyField(f)}
                        </div>
                        <input
                          value={fields[f] || ''}
                          onChange={e => setFields({ ...fields, [f]: e.target.value })}
                          type={fieldType(f)}
                          placeholder={fieldPlaceholder(f)}
                          style={{
                            width: '100%', padding: '10px 12px', fontSize: 14,
                            background: 'var(--c-surface2)',
                            border: '1px solid var(--c-border)',
                            borderRadius: 8, color: 'var(--c-text)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Document upload — attaches a source document (statement,
                  valuation, certificate, etc.). Fires DOCUMENT_CAPTURED on
                  submit alongside the ASSET_VALUE_UPDATED event. */}
              <div style={{
                marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c-sep)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                }}>Source document (optional)</div>
                <label htmlFor="addsheet-doc" style={{
                  display: 'block', padding: '12px 14px',
                  background: 'var(--c-surface2)',
                  border: '1px dashed var(--c-border)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  fontSize: 12, color: 'var(--c-text2)',
                }}>
                  {fields._docName ? (
                    <>📎 <strong style={{ color: 'var(--c-text)' }}>{fields._docName}</strong> · {Math.round((fields._docSize || 0) / 1024)} KB</>
                  ) : (
                    <>📎 Attach statement / valuation / certificate</>
                  )}
                </label>
                <input id="addsheet-doc" type="file" style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.heic,.csv"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setFields(prev => ({
                      ...prev,
                      _docName: f.name,
                      _docSize: f.size,
                      _docMime: f.type,
                    }))
                  }} />
                {fields._docName && (
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, textAlign: 'center' }}>
                    Captured locally only · no OCR yet · acts as a placeholder reference
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setStep('type')} className="sw-press" style={btnGhost}>← Back</button>
                <button onClick={submit} className="sw-press" style={{ ...btnPrimary, flex: 1 }}>
                  Add to {catNode.label.toLowerCase()}
                </button>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

function prettyField(f) {
  const map = {
    provider: 'Provider', value: 'Value (£)', monthlyContribution: 'Monthly contribution (£)',
    employerMatchPct: 'Employer match (%)', scheme: 'Scheme name',
    projectedAnnual: 'Projected annual (£/yr)', weeklyAmount: 'Weekly amount (£/wk)',
    startAge: 'Start age', annualWithdrawal: 'Annual withdrawal (£)',
    annualIncome: 'Annual income (£/yr)', ytdContribution: 'YTD contribution (£)',
    interestRate: 'Interest rate (%)', embeddedGain: 'Embedded gain (£)',
    yearPurchased: 'Year purchased', withdrawalPctUsed: 'Withdrawal % used',
    address: 'Address', mortgageBalance: 'Mortgage outstanding (£)',
    monthlyRent: 'Monthly rent (£)', annualNetIncome: 'Annual net income (£/yr)',
    description: 'Description', companyName: 'Company name',
    sharePct: 'Your shareholding (%)', estimatedValue: 'Estimated value (£)',
    employer: 'Employer', unvested: 'Unvested units',
    strike: 'Strike price (£)', contributedTotal: 'Total contributed (£)',
    qualifyingYears: 'Qualifying years held', balance: 'Balance (£)',
    inCredit: 'In credit? (true / false)', coverAmount: 'Cover amount (£)',
    inTrust: 'Written in trust? (true / false)', monthlyBenefit: 'Monthly benefit (£)',
    deferralWeeks: 'Deferral period (weeks)', annualPremium: 'Annual premium (£)',
    bank: 'Bank', maturityDate: 'Maturity date',
    lender: 'Lender', outstanding: 'Outstanding (£)',
    monthlyPayment: 'Monthly payment (£)', rateType: 'Rate type',
    apr: 'APR (%)', plan: 'Plan',
    grossAnnual: 'Gross annual (£/yr)', business: 'Business name',
    annualProfit: 'Annual profit (£/yr)', company: 'Company',
    annualSalary: 'Annual salary (£/yr)', annualDividend: 'Annual dividend (£/yr)',
    source: 'Source', annualNet: 'Annual net (£/yr)',
    annualInterest: 'Annual interest (£/yr)', type: 'Type',
    asset: 'Asset (e.g. BTC)', holdings: 'Holdings (units)',
    gbpValue: 'GBP value (£)', ounces: 'Ounces',
    platform: 'Platform', fund: 'Fund name',
    committed: 'Committed (£)', currentValue: 'Current value (£)',
    annualCost: 'Annual cost (£/yr)', school: 'School',
    annualFees: 'Annual fees (£/yr)', name: 'Name',
    annualSupport: 'Annual support (£/yr)', payee: 'Payee',
    monthly: 'Monthly (£/mo)',
    // Expanded 2026-05-12 — BTL / property / pension optional fields
    purchasePrice: 'Purchase price (£)', purchaseDate: 'Purchase date',
    label: 'Short label (e.g. "Manchester BTL")', mortgageId: 'Linked mortgage ID',
    ownership: 'Ownership (sole · joint · trust)', ownershipShare: 'Your share (%)',
    beneficialPct: 'Your beneficial interest (%)',
    s24Position: 'S24 status (fully-restricted · partial · pre-2020 grandfathered)',
    lastValuationDate: 'Last valuation date',
    mortgageMonthly: 'Mortgage monthly payment (£)', mortgageRate: 'Mortgage rate (%)',
    mortgageRateType: 'Rate type (fixed-until-YYYY · tracker · SVR)', mortgageYears: 'Remaining years',
    fhlPreApr2025: 'Was FHL before April 2025? (true/false)',
    acres: 'Acres', aprQualifying: 'APR-qualifying? (true/false)',
    underTenancy: 'Under farm tenancy? (true/false)', vatOption: 'Option to tax for VAT? (true/false)',
    nominationDate: 'Last nomination review (date)',
    employerContribution: 'Employer contribution (£/mo)',
    loanToCompany: 'Loan to sponsoring employer (£ — SSAS only)',
    cetv: 'CETV — cash-equivalent transfer value (£)',
    accrualYears: 'Years of accrual', normalRetirementAge: 'Normal retirement age',
    niYearsAccrued: 'NI years accrued', pclsTakenSoFar: 'PCLS taken so far (£)',
    guaranteePeriod: 'Guarantee period (years)', survivorPct: 'Survivor benefit (%)',
    securedOn: 'Secured against (asset ID)', premium: 'Premium (£/mo)',
    role: 'Role (Director · Shareholder · Officer)',
  }
  return map[f] || f
}
function fieldType(f) {
  if (/Pct$|Percent|rate|apr|Rate|Years|Age|Weeks|Year/i.test(f)) return 'number'
  if (/value|balance|amount|rent|income|premium|fees|cost|salary|profit|dividend|interest|payment|outstanding|contribution|withdrawal|gbpValue|committed|holdings|ounces|monthly/i.test(f)) return 'number'
  if (/date/i.test(f)) return 'date'
  return 'text'
}
function fieldPlaceholder(f) {
  if (fieldType(f) === 'number') return '0'
  if (fieldType(f) === 'date')   return 'YYYY-MM-DD'
  return ''
}

const btnPrimary = {
  padding: '12px 16px', fontSize: 13, fontWeight: 800,
  background: 'var(--c-acc)', color: 'var(--c-bg, #0B1F3A)',
  border: 'none', borderRadius: 100, cursor: 'pointer',
}
const btnGhost = {
  padding: '12px 16px', fontSize: 12, fontWeight: 700,
  background: 'transparent', color: 'var(--c-text3)',
  border: '1px solid var(--c-border)', borderRadius: 100, cursor: 'pointer',
}
