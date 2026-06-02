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

import { useState, useMemo } from 'react'
import OwnerChips, { getHouseholdOwners } from './OwnerChips.jsx'
import AccountsList from './AccountsList.jsx'
import { liabilityAddItems } from '../../engine/liability-taxonomy.js'
import { assetAddItems } from '../../engine/asset-taxonomy.js'

// Item taxonomy. The ASSET categories (pensions / investments / property /
// business / cash / alternatives / protection) now read from the canonical
// asset-taxonomy.js module — the full UK instrument spectrum (~115 types),
// grouped into sub-classes the picker renders as headers (the same pattern
// liabilities use). Before this, these categories inlined ~48 types — a subset
// that couldn't even reproduce Mr T's own property mix (founder 2026-06-02:
// "the asset categories for Mr T was not the entire Taxonomy"). income / gifts /
// obligations stay inline (income/obligations have their own taxonomy; gifts is
// the GIFT_RECORDED flow). Each item carries id, label, desc, source (canon ID
// + one-line tax position), required[] + optional[], and class/classLabel/
// classIcon for the grouped picker.
const CAT_TAXONOMY = {
  pensions: {
    label: 'Pensions',
    items: assetAddItems('pensions'),
  },
  investments: {
    label: 'Savings & Investments',
    items: assetAddItems('investments'),
  },
  property: {
    label: 'Property',
    items: assetAddItems('property'),
  },
  business: {
    label: 'Business Assets',
    items: assetAddItems('business'),
  },
  protection: {
    label: 'Protection',
    items: assetAddItems('protection'),
  },
  cash: {
    label: 'Cash',
    items: assetAddItems('cash'),
  },
  liabilities: {
    label: 'Liabilities',
    // Full canonical UK liability spectrum (~50 types across 6 classes) sourced
    // from the single taxonomy module — replaces the old hardcoded 6 that
    // couldn't even reproduce Mr T's own fixture (founder 2026-06-02). The
    // picker emits a class header when item.class changes.
    items: liabilityAddItems(),
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
    items: assetAddItems('alternatives'),
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
  // v0.3 Phase 3 — Gifts category (MASTER §3.3 GIFT_RECORDED · route-4 §8).
  // Each item maps to a `type` discriminator on the emitted GIFT_RECORDED
  // event. PET / CLT remain the existing two; the five new IHT-statutory
  // exemptions (s19 / s20 / s21 / s22) split out from the v0.2-era fabricated
  // `srsAllowance` per Tax v2 BLOCK-3.
  gifts: {
    label: 'Gifts',
    items: [
      { id: 'PET',                  label: 'PET (Potentially Exempt Transfer)', desc: 'Lifetime gift — 7-year clock applies',
        giftType: 'PET',
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'CLT',                  label: 'CLT (Chargeable Lifetime Transfer)', desc: 'Gift into relevant property trust — immediate IHT if above NRB',
        giftType: 'CLT',
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'NORMAL_EXPENDITURE',   label: 'Normal expenditure from income (IHTA 1984 s21)', desc: 'Habitual gifts from surplus income · no 7-year clock',
        giftType: 'normal_expenditure',
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'ANNUAL_EXEMPTION',     label: 'Annual exemption £3k (IHTA 1984 s19)', desc: 'Annual gift exemption · carry-forward 1 year',
        giftType: 'annual_exemption',
        cap: 3000, carryForwardYears: 1,
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'SMALL_GIFTS',          label: 'Small gifts £250 per donee (IHTA 1984 s20)', desc: 'Up to £250 per donee per tax year',
        giftType: 'small_gifts',
        cap: 250, perDonee: true,
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'WEDDING_PARENT',       label: 'Wedding gift — parent→child (IHTA 1984 s22)', desc: 'Up to £5,000 per donor, per marriage',
        giftType: 'wedding_parent',
        cap: 5000,
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'WEDDING_GRANDPARENT',  label: 'Wedding gift — grandparent→grandchild', desc: 'Up to £2,500 per donor, per marriage',
        giftType: 'wedding_grandparent',
        cap: 2500,
        required: ['to', 'amount', 'date'], optional: [] },
      { id: 'WEDDING_OTHER',        label: 'Wedding gift — other', desc: 'Up to £1,000 per donor, per marriage',
        giftType: 'wedding_other',
        cap: 1000,
        required: ['to', 'amount', 'date'], optional: [] },
    ],
  },
}

const CAT_ORDER = ['pensions', 'investments', 'property', 'business', 'protection', 'cash', 'liabilities', 'income', 'alternatives', 'gifts', 'obligations']

export default function AddItemSheet({ open, initialCategory = null, onClose, onCommit, entity = null }) {
  const [step, setStep] = useState(initialCategory ? 'type' : 'category')
  const [cat, setCat] = useState(initialCategory)
  const [itemType, setItemType] = useState(null)
  const [fields, setFields] = useState({})
  // Multi-owner attribution chips (Voyant-parity). Default self-only.
  const [owners, setOwners] = useState(['self'])
  // Link picker selection — stores the chosen property/mortgage id when the
  // category supports cross-linking.
  const [linkedId, setLinkedId] = useState(null)

  // Household owners derived from entity. Falls back to a single "You" chip.
  const householdOwners = useMemo(() => {
    const list = getHouseholdOwners(entity)
    return list.length ? list : [{ id: 'self', name: 'You', color: '#2DF2C3' }]
  }, [entity])

  // Existing properties / mortgages for the link pickers.
  const linkablePool = useMemo(() => {
    if (!entity) return { properties: [], mortgages: [] }
    const properties = (entity.assets?.property || []).map(p => ({
      id: p.id || `prop-${p.address || p.label}`,
      label: p.label || p.address || 'Property',
      sub: p.use || p.type || 'Residence',
      value: +p.value || 0,
    }))
    // Mortgages live on liabilities.mortgage (single) or in liabilities.otherLoans
    // tagged with a mortgage type. Filter out anything already linked to a property.
    const linkedSet = new Set(
      (entity.assets?.property || [])
        .map(p => p.linked_mortgage_id || p.mortgageId)
        .filter(Boolean)
    )
    const mortgages = []
    if (entity.liabilities?.mortgage && +entity.liabilities.mortgage.outstanding > 0) {
      const mid = entity.liabilities.mortgage.id || 'liab-mortgage'
      if (!linkedSet.has(mid)) {
        mortgages.push({
          id: mid,
          label: entity.liabilities.mortgage.lender || 'Mortgage',
          sub: `£${Math.round(+entity.liabilities.mortgage.outstanding).toLocaleString()} outstanding`,
        })
      }
    }
    for (const l of (entity.liabilities?.otherLoans || [])) {
      if (!/mortgage/i.test(l.type || '')) continue
      const lid = l.id || `liab-${l.type}`
      if (linkedSet.has(lid)) continue
      mortgages.push({
        id: lid,
        label: l.lender || l.type || 'Mortgage',
        sub: `£${Math.round(+l.outstanding || 0).toLocaleString()} outstanding`,
      })
    }
    return { properties, mortgages }
  }, [entity])

  if (!open) return null

  const catNode = cat ? CAT_TAXONOMY[cat] : null
  const itemNode = catNode && itemType ? catNode.items.find(i => i.id === itemType) : null

  function reset() {
    setStep('category'); setCat(null); setItemType(null); setFields({})
    setOwners(['self']); setLinkedId(null)
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
    if (!owners.length) return  // Required: at least one owner
    // Strip _docName/_docSize/_docMime out of the asset payload — they're
    // document metadata, not item fields.
    const { _docName, _docSize, _docMime, ...assetFields } = fields
    const assetId = `${itemType.toLowerCase()}-${Date.now().toString(36)}`
    // Voyant-parity link metadata. For a new mortgage we attach
    // linked_property_id; for a new property we attach linked_mortgage_id.
    const linkPayload = {}
    if (linkedId) {
      const isMortgageItem = cat === 'liabilities' && /MORTGAGE/i.test(itemType)
      const isPropertyItem = cat === 'property'
      if (isMortgageItem) linkPayload.linked_property_id = linkedId
      else if (isPropertyItem) linkPayload.linked_mortgage_id = linkedId
    }
    // v0.3 Phase 3 — Gifts emit GIFT_RECORDED per MASTER §3.3 / route-4 §8.
    // Shape: { to, amount, date, type } — type discriminator drives downstream
    // IHT computation (PET clock, CLT NRB, s19/s20/s21/s22 exemptions).
    if (cat === 'gifts') {
      const node = CAT_TAXONOMY.gifts.items.find(i => i.id === itemType)
      const giftType = node?.giftType || 'PET'
      onCommit?.({
        type: 'GIFT_RECORDED',
        ts: Date.now(),
        correlation_id: `mm-gift-${Date.now()}`,
        payload: {
          to:     assetFields.to    || '',
          amount: +assetFields.amount || 0,
          date:   assetFields.date  || '',
          type:   giftType,
          owners: [...owners],
          source: 'manual',
          confidence: 1.0,
        },
      })
      reset()
      onClose?.()
      return
    }
    onCommit?.({
      type: 'ASSET_VALUE_UPDATED',
      ts: Date.now(),
      correlation_id: `mm-add-${Date.now()}`,
      payload: {
        id: assetId,
        category: cat,
        itemType,
        owners: [...owners],
        ...linkPayload,
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

        {/* Close — exits the whole add flow (founder 2026-06-01: "no way to go
            back out of the screen"; ← Back only steps between 1→2→3). Backdrop
            tap also closes, but a visible affordance is required. */}
        <button
          type="button"
          onClick={close}
          aria-label="Close add"
          title="Close"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 32, height: 32, borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 16, lineHeight: 1, cursor: 'pointer',
          }}
        >
          ✕
        </button>

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
              {catNode.items.map((it, i) => {
                // Emit a class header when the item's class changes (the
                // liabilities taxonomy is grouped into 6 classes; other
                // categories carry no `class` so this is a no-op for them).
                const prev = catNode.items[i - 1]
                const showHeader = it.class && it.class !== prev?.class
                return (
                  <div key={it.id} style={{ display: 'contents' }}>
                    {showHeader && (
                      <div style={{
                        fontSize: 10, fontWeight: 800, color: 'var(--c-text3)',
                        letterSpacing: 0.6, textTransform: 'uppercase',
                        margin: i === 0 ? '0 0 2px' : '10px 0 2px',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>{it.classIcon}</span><span>{it.classLabel}</span>
                      </div>
                    )}
                    <button onClick={() => chooseType(it.id)}
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
                  </div>
                )
              })}
            </div>
            <button onClick={() => setStep('category')} className="sw-press" style={btnGhost}>← Back</button>
          </>
        )}

        {step === 'fields' && itemNode && (() => {
          // Support both shapes — new (required/optional) + legacy (fields)
          const requiredFields = itemNode.required || itemNode.fields || []
          const optionalFields = itemNode.optional || []
          // Link-picker mode for this item type:
          //   · Mortgage liability → pick a property to attach to
          //   · Property asset     → pick an existing unlinked mortgage
          const isMortgageItem = cat === 'liabilities' && /MORTGAGE/i.test(itemType)
          const isPropertyItem = cat === 'property'
          const linkOptions = isMortgageItem
            ? linkablePool.properties
            : isPropertyItem
              ? linkablePool.mortgages
              : []
          const linkLabel = isMortgageItem ? 'Linked property' : 'Existing mortgage'
          const linkEmpty = isMortgageItem
            ? 'No properties yet — add a property first to link this mortgage.'
            : 'No unlinked mortgages — every mortgage is already linked to a property.'
          const selectedLink = linkOptions.find(o => o.id === linkedId)
          return (
            <>
              <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Step 3 of 3 · Details</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>
                {itemNode.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 12, lineHeight: 1.5 }}>
                {itemNode.desc}
              </div>

              {/* ── Owners (Voyant-parity multi-attribution) ─────────────── */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Owners · who holds this {owners.length > 1 ? '· joint' : ''}
                </div>
                <OwnerChips owners={householdOwners} selected={owners} onChange={setOwners} />
              </div>

              {/* ── Linked-item picker (mortgage ↔ property) ─────────────── */}
              {(isMortgageItem || isPropertyItem) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
                    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    {linkLabel} {isMortgageItem ? '(optional)' : '(optional)'}
                  </div>
                  {linkOptions.length === 0 ? (
                    <div style={{
                      padding: '10px 12px', fontSize: 11,
                      color: 'var(--c-text3)',
                      background: 'var(--c-surface2)',
                      border: '1px dashed var(--c-border)',
                      borderRadius: 10,
                    }}>{linkEmpty}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {linkOptions.map(opt => {
                        const on = linkedId === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setLinkedId(on ? null : opt.id)}
                            className="sw-pressable"
                            style={{
                              padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                              background: on
                                ? 'color-mix(in srgb, var(--c-acc) 12%, var(--c-surface2))'
                                : 'var(--c-surface2)',
                              border: on
                                ? '1.5px solid var(--c-acc)'
                                : '1px solid var(--c-border)',
                              borderRadius: 10,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                              {opt.sub}
                            </div>
                          </button>
                        )
                      })}
                      {selectedLink && (
                        <div style={{
                          fontSize: 11, color: 'var(--c-acc)', fontWeight: 700,
                          marginTop: 2,
                        }}>
                          Linked to {selectedLink.label}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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

        {/* Voyant-pattern sidebar (founder direction 2026-05-26): existing
            accounts list lives INSIDE the add/edit sheet so users see what
            they already have while adding new items. Voyant uses a right
            rail; on the mobile-first sheet pattern this renders as a
            stacked footer section below the form. */}
        {entity && (
          <div style={{
            marginTop: 22, paddingTop: 14,
            borderTop: '1px solid var(--c-border)',
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Your existing accounts</div>
            <AccountsList entity={entity} />
          </div>
        )}
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
    // v0.3 Phase 3 — gift fields
    to: 'Recipient (donee)', amount: 'Gift amount (£)', date: 'Gift date',
    // Asset-taxonomy expansion 2026-06-02 — new sub-type fields
    childName: 'Child’s name', country: 'Country', currency: 'Currency',
    jurisdiction: 'Jurisdiction', noticeDays: 'Notice period (days)',
    monthlyLimit: 'Monthly limit (£)', rooms: 'Rooms / lettable units',
    hmoLicence: 'HMO licence held? (true/false)', residentialPct: 'Residential portion (%)',
    pctSold: 'Percentage sold (%)', planningStatus: 'Planning status',
    startDate: 'Start date', form: 'Form (coins · bars)',
    multipleOfSalary: 'Multiple of salary (×)', rebuildCost: 'Rebuild cost (£)',
    surrenderValue: 'Surrender value (£)', termEnd: 'Term ends (date)',
    grantDate: 'Grant date', awardDate: 'Award date', vestDate: 'Vesting date',
    tradingStatus: 'Trading or investment?', annualIncome: 'Annual income (£/yr)',
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
