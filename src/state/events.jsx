// ─────────────────────────────────────────────────────────────────────────────
// FINIO EVENT STORE (session-1 stub)
// ─────────────────────────────────────────────────────────────────────────────
// Minimum-viable event-sourced state per Part 11 spec (DOCUMENTED) and FP-5
// (Ingest Integrity Principle). Events are the only way committed changes enter
// the system. Baseline entity comes from persona JSON; `applyEvents(base, evs)`
// folds committed events forward to produce the "effective entity" read by
// engine functions.
//
// Session-1 scope:
//   · In-memory only (resets on reload — Session 2 will add persistence)
//   · Three event types: drawdown_schedule_set · drawdown_committed · nomination_reviewed
//   · No provenance/confidence fields (those land with the full Part 11 build)
//
// This is a deliberate Path-A shortcut per OD-01a. The event shape below may
// not survive verbatim when Part 11 is formally specified — in particular the
// event envelope will gain id, timestamp, actor, source, confidence,
// provenance, and verification-state fields. Kept minimal here to avoid
// over-committing the data model before its design session.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
import { ADD_ID_TO_TYPE } from '../engine/liability-taxonomy.js'
import { classifyAsset } from '../engine/asset-taxonomy.js'

// Canonical sub-class of an Add-menu itemType (e.g. 'DB_PUBLIC' → 'db-pension').
// Drives event routing so the FULL asset spectrum lands in the right entity slot
// — a DB scheme must never become a spendable DC pot, decumulation products go to
// decumulation[], etc. Falls back to null for non-asset itemTypes.
function assetClassOf(itemType) {
  return classifyAsset(itemType)?.class || null
}

// ─── Event types + validator ────────────────────────────────────────────────
// Added 2026-05-12: ASSET_VALUE_UPDATED + ASSET_REMOVED + DOCUMENT_CAPTURED.
// Pre-fix, the add flow was wholly non-functional — events fired by
// AddItemSheet were appended to the log but `applyEvents` had no case for
// them, so the entity never reflected new items. Founder audit caught this.
//
// L2-6a (2026-05-28): EV + validateEvent live in a plain-JS sibling file
// (./events-validator.js) so they can be unit-tested under Node without a
// JSX loader. The re-exports below keep every existing call site working.
export { EV, validateEvent } from './events-validator.js'
// NOTE: the `export … from` above re-exports for the public surface but does
// NOT create a local binding. applyEvents() references `EV` in its switch
// cases, so it must also be IMPORTED locally — without this, folding ANY
// committed event throws "EV is not defined". (Latent since the fold path was
// never exercised end-to-end until the L3-2 leaf-edit shipped.)
import { EV, validateEvent as _validateEvent } from './events-validator.js'
import { resolveExistingId, applyFieldCorrection } from './events-fold-helpers.js'

// ─── Pure reducer ───────────────────────────────────────────────────────────
// events[personaId] = [{ type, ts, payload }, ...]
function reducer(state, action) {
  switch (action.type) {
    case 'COMMIT': {
      const { personaId, event } = action
      // L2-6a — reject malformed events at the reducer boundary so they can't
      // corrupt applyEvents downstream. Hard errors are logged + dropped;
      // warnings are logged but still committed. Keeping the rejection silent
      // (no thrown error) because the caller is React state — throwing here
      // would crash a screen rather than surface a useful diagnostic.
      const validation = _validateEvent(event)
      if (!validation.ok) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[events] dropping malformed event for persona ${personaId}:`,
            validation.errors,
            'event:', event
          )
        }
        return state
      }
      if (validation.warnings.length > 0 && typeof console !== 'undefined' && console.info) {
        console.info(
          `[events] committing event with warnings for persona ${personaId}:`,
          validation.warnings
        )
      }
      const log = state[personaId] || []
      return {
        ...state,
        [personaId]: [...log, { ...event, ts: event.ts || Date.now() }],
      }
    }
    case 'RESET_PERSONA': {
      const { personaId } = action
      const { [personaId]: _omit, ...rest } = state
      return rest
    }
    case 'RESET_ALL':
      return {}
    default:
      return state
  }
}

// ─── Fold events onto base entity ──────────────────────────────────────────
// Pure function — given baseline persona and an event log, return the
// effective entity that reflects all committed events.
export function applyEvents(baseEntity, events = []) {
  if (!events.length) return baseEntity
  // Deep clone so engine functions can't mutate base persona JSON
  const e = JSON.parse(JSON.stringify(baseEntity))

  for (const ev of events) {
    switch (ev.type) {
      case EV.DRAWDOWN_SCHEDULE_SET: {
        // Schedule shape: [{ age, amount, reason? }, ...]
        e.drawdownSchedule = ev.payload.schedule
        // First-year draw also sets the legacy scalar so all existing
        // engine paths (ihtDynamic, calcFQ amplifiers, etc.) see it.
        e.drawdown = ev.payload.schedule?.[0]?.amount || 0
        break
      }
      case EV.DRAWDOWN_COMMITTED: {
        // Simple scalar commit — used by simulator panel
        e.drawdown = ev.payload.annual || 0
        // Materialise a flat 5-year schedule if no schedule exists yet
        if (!e.drawdownSchedule) {
          const startAge = ev.payload.startAge || e.age || 62
          e.drawdownSchedule = Array.from({ length: 5 }, (_, i) => ({
            age: startAge + i + 1,
            amount: ev.payload.annual || 0,
          }))
        }
        break
      }
      case EV.NOMINATION_REVIEWED: {
        // Mark the named pension as having a fresh review date
        const pensions = e.assets?.sipp?.pensions || []
        const match = pensions.find(p => p.name === ev.payload.pensionName)
        if (match) match.nominationDate = ev.payload.reviewedDate || new Date().toISOString().slice(0, 10)
        break
      }

      case EV.ASSET_VALUE_UPDATED: {
        // Add OR update an asset captured via the bucket flow (AddItemSheet).
        // Payload: { category, itemType, fields, source, confidence, id? }
        // - If payload.id is present and matches an existing asset → update.
        // - Otherwise → insert a new entry into the relevant assets/liabilities
        //   slot derived from category + itemType.
        applyAssetEvent(e, ev.payload)
        break
      }

      case EV.ASSET_REMOVED: {
        // Payload: { category, itemType, id }
        removeAssetEvent(e, ev.payload)
        break
      }

      case EV.ASSET_FIELD_CORRECTED: {
        // L3-2 leaf edit — surgical single-field correction with full
        // provenance + audit trail. Payload:
        //   { path, value, source, confidence, document?, label?, previousValue? }
        // `path` is a dot/bracket path into the effective entity
        // (e.g. 'assets.sipp.pensions[0].value'). Only that field is set;
        // sibling fields are untouched (unlike the full ASSET_VALUE_UPDATED
        // upsert). Every correction is appended to e._corrections[] so the
        // change history is inspectable (full-provenance requirement).
        applyFieldCorrection(e, ev.payload)
        break
      }

      case EV.DOCUMENT_CAPTURED: {
        // Payload: { assetId, category, itemType, document: { name, size, mime,
        // dataUrl|url, capturedAt }, parsed?: { ... fields ... } }
        // Attaches the document reference to the matching asset for source
        // provenance. If parsed fields are provided, they're applied as if
        // an ASSET_VALUE_UPDATED event with confidence=parsed.confidence
        // (default 0.7 — parser is OCR/heuristic, not user-confirmed).
        attachDocumentEvent(e, ev.payload)
        break
      }

      default:
        // Unknown event type — ignore (forward-compatible)
        break
    }
  }
  return e
}

// ─── Asset-event helpers ───────────────────────────────────────────────────
// Route a new/updated bucket-flow item to the right entity slot based on the
// (category, itemType) pair. Mirrors the shapes used by the readers in
// MyMoney's rowsForX functions.

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = []
  return obj[key]
}

function applyAssetEvent(e, payload) {
  if (!payload) return
  const { category, itemType, fields = {}, source = 'manual', confidence = 1.0, id } = payload
  if (!category || !itemType) return
  if (!e.assets) e.assets = {}

  // Resolve edits to existing items by matchKey (update-in-place) before
  // falling back to a generated id (insert). This is what makes a leaf
  // "correct this value" edit update the record instead of duplicating it.
  const resolvedId = id || resolveExistingId(e, category, itemType, payload.matchKey)
  const newId = resolvedId || `${itemType.toLowerCase()}-${Date.now().toString(36)}`

  // Provenance envelope attached to every item created/updated this way
  const provenance = {
    source,                                           // 'manual' | 'document' | 'feed'
    confidence,                                       // FP-5: 1.0 manual, <1 parsed
    captured_at: payload.captured_at || new Date().toISOString(),
    item_type: itemType,
    category,
  }

  // ──────────────────────────────────────────────────────────────────────
  // PENSIONS — sit under assets.sipp.pensions[] (legacy shape) for SIPP/
  // SSAS/DC; under assets.pensions[] for DB. State pension lives in
  // assets.statePension (singleton).
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'pensions') {
    if (itemType === 'STATE') {
      e.assets.statePension = {
        weeklyAmount: +fields.weeklyAmount || 0,
        annual:       (+fields.weeklyAmount || 0) * 52,
        startAge:     +fields.startAge || 67,
        provenance,
      }
      return
    }
    // DEFINED BENEFIT (final-salary / CARE / public-sector / hybrid) — a
    // guaranteed income + CETV, NOT a spendable pot. Routed to assets.pensions[]
    // so it is NEVER rendered as a drawable fund (IFA-critical). Class-driven so
    // every DB variant from the menu lands here, not just the bare 'DB'.
    if (assetClassOf(itemType) === 'db-pension') {
      const arr = ensureArray(e.assets, 'pensions')
      const idx = arr.findIndex(p => p.id === newId)
      const obj = {
        id: newId,
        name: fields.scheme || 'DB pension',
        scheme_name: fields.scheme || 'DB pension',
        type: 'occupational-DB',
        db_variant: itemType,                         // DB | DB_CARE | DB_PUBLIC | DB_HYBRID
        status: 'active',
        projected_annual_pension: +fields.projectedAnnual || 0,
        cetv: +fields.cetv || 0,
        balance: 0,                                   // never a spendable balance
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      return
    }
    // DECUMULATION (FAD / UFPLS / annuity / enhanced annuity) — assets.decumulation[]
    if (assetClassOf(itemType) === 'pension-access') {
      const accessTypeMap = {
        FAD: 'flexi-access-drawdown', UFPLS: 'ufpls',
        ANNUITY: 'annuity', ANNUITY_ENHANCED: 'enhanced-annuity',
      }
      const arr = ensureArray(e.assets, 'decumulation')
      const idx = arr.findIndex(p => p.id === newId)
      const obj = {
        id: newId,
        type: accessTypeMap[itemType] || 'flexi-access-drawdown',
        provider: fields.provider || '',
        value: +fields.value || 0,
        annualWithdrawal: +fields.annualWithdrawal || 0,
        annualIncome: +fields.annualIncome || 0,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      return
    }
    // ACCUMULATION DC pots — SIPP / SSAS / Workplace DC / GPP / Master Trust /
    // Stakeholder / Personal / Deferred / RAC / Section 32 / QROPS — all spendable
    // pots → assets.sipp.pensions[].
    if (!e.assets.sipp) e.assets.sipp = { total: 0, growth: 0.05, pensions: [] }
    const arr = ensureArray(e.assets.sipp, 'pensions')
    const idx = arr.findIndex(p => p.id === newId)
    const obj = {
      id: newId,
      name: fields.provider ? `${fields.provider} ${itemType}` : itemType,
      type: itemType,
      provider: fields.provider || '',
      value: +fields.value || 0,
      monthlyContribution: +fields.monthlyContribution || 0,
      employerMatchPct: +fields.employerMatchPct || 0,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    // Recompute legacy `total` so existing readers stay in sync
    e.assets.sipp.total = arr.reduce((s, p) => s + (+p.value || 0), 0)
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // INVESTMENTS — assets.investments[]
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'investments') {
    const arr = ensureArray(e.assets, 'investments')
    const idx = arr.findIndex(p => p.id === newId)
    const typeMap = {
      ISA_SS: 'stocks-and-shares-ISA', ISA_CASH: 'cash-ISA', LISA: 'lifetime-ISA',
      GIA: 'GIA', EIS: 'EIS', SEIS: 'SEIS', VCT: 'VCT',
      BOND_ON: 'BOND_ON', BOND_OFF: 'BOND_OFF',
    }
    const obj = {
      id: newId,
      type: typeMap[itemType] || itemType,
      name: fields.provider ? `${fields.provider} ${itemType}` : itemType,
      provider: fields.provider || '',
      value: +fields.value || 0,
      balance: +fields.value || 0,
      contribution_current_tax_year: +fields.ytdContribution || 0,
      interest_rate: +fields.interestRate || 0,
      embedded_gain: +fields.embeddedGain || 0,
      year_purchased: +fields.yearPurchased || null,
      withdrawal_5pct_used_pct: +fields.withdrawalPctUsed / 100 || 0,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // PROPERTY — assets.residence (RESIDENCE) or assets.property[] (BTL etc.)
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'property') {
    if (itemType === 'RESIDENCE') {
      e.assets.residence = {
        address: fields.address || '',
        value: +fields.value || 0,
        purchase_price: +fields.purchasePrice || 0,
        purchase_date: fields.purchaseDate || null,
        ownership: fields.ownership || 'sole',
        ownershipShare: +fields.ownershipShare || 1.0,
        provenance,
      }
      // If a mortgage balance is captured, mirror it onto liabilities.mortgage
      if (fields.mortgageBalance) {
        e.liabilities = e.liabilities || {}
        e.liabilities.mortgage = {
          outstanding: +fields.mortgageBalance || 0,
          monthlyPayment: +fields.mortgageMonthly || 0,
          rateType: fields.mortgageRateType || '',
          rate: +fields.mortgageRate / 100 || 0,
          remainingYears: +fields.mortgageYears || 0,
        }
      }
      return
    }
    const arr = ensureArray(e.assets, 'property')
    const idx = arr.findIndex(p => p.id === newId)
    const useMap = { BTL: 'buy-to-let', HOLIDAY_LET: 'furnished-holiday-let',
                     COMMERCIAL: 'commercial', LAND: 'land' }
    const obj = {
      id: newId,
      type: useMap[itemType] || itemType,
      use: useMap[itemType] || itemType,
      label: fields.label || fields.address || itemType,
      address: fields.address || '',
      value: +fields.value || 0,
      value_gbp: +fields.value || 0,
      purchase_price: +fields.purchasePrice || 0,
      purchase_date: fields.purchaseDate || null,
      ownership: fields.ownership || 'sole',
      beneficial_interest_this_individual: +fields.beneficialPct / 100 || 1.0,
      mortgage_id: fields.mortgageId || null,
      monthly_rent: +fields.monthlyRent || 0,
      annual_rent: (+fields.monthlyRent || 0) * 12,
      annual_net_income: +fields.annualNetIncome || 0,
      s24_position: fields.s24Position || (itemType === 'BTL' ? 'fully-restricted' : null),
      last_valuation_date: fields.lastValuationDate || new Date().toISOString().slice(0, 10),
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // BUSINESS — companies / share_schemes / directors_loan / business_assets
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'business') {
    if (itemType === 'PSC_EQUITY') {
      const arr = ensureArray(e, 'companies')
      const idx = arr.findIndex(c => c.id === newId)
      const obj = {
        id: newId,
        name: fields.companyName || 'Ltd Co',
        role: fields.role || 'Director',
        shareholding_pct: +fields.sharePct / 100 || 1.0,
        share_value_gbp: +fields.estimatedValue || 0,
        value: +fields.estimatedValue || 0,
        trading_status: 'trading',
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      // Auto-create a BPR-qualifying business asset entry for IHT purposes
      const baArr = ensureArray(e, 'business_assets')
      const bIdx = baArr.findIndex(b => b.id === `${newId}-bpr`)
      const ba = { id: `${newId}-bpr`, name: `${fields.companyName} equity stake`,
                   value: +fields.estimatedValue || 0, value_gbp: +fields.estimatedValue || 0,
                   qualifies_for_bpr: true, qualifies_for_badr: true,
                   shareholding_pct: +fields.sharePct / 100 || 1.0,
                   trading_status: 'trading', provenance }
      if (bIdx >= 0) baArr[bIdx] = ba; else baArr.push(ba)
      return
    }
    if (assetClassOf(itemType) === 'share-scheme') {
      const arr = ensureArray(e, 'share_schemes')
      const idx = arr.findIndex(s => s.id === newId)
      const obj = {
        id: newId, scheme_type: itemType,
        employer: fields.employer || '',
        estimated_value: +fields.estimatedValue || 0,
        value_gbp: +fields.estimatedValue || 0,
        unvested_count: +fields.unvested || 0,
        exercise_price: +fields.strike || 0,
        contributed_total: +fields.contributedTotal || 0,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      return
    }
    if (itemType === 'DLA') {
      const inCredit = String(fields.inCredit).toLowerCase() === 'true'
      e.directors_loan = {
        balance: +fields.balance || 0,
        in_credit: inCredit,
        company_id: fields.companyName || '',
        note: inCredit ? 'Company owes director' : 'Director owes company',
        provenance,
      }
      return
    }
    if (itemType === 'BPR_AIM') {
      const arr = ensureArray(e, 'business_assets')
      const idx = arr.findIndex(b => b.id === newId)
      const obj = {
        id: newId, name: `AIM portfolio (${fields.provider})`,
        value: +fields.value || 0, value_gbp: +fields.value || 0,
        qualifies_for_bpr: +fields.qualifyingYears >= 2,
        bpr_rate: 0.5, // AIM BPR from April 2026 is 50%
        trading_status: 'AIM-trading',
        years_held: +fields.qualifyingYears || 0,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      return
    }
    // Other business interests (sole trader / partnership / LLP / investment
    // company / EOT / IP) — land in companies[] with their value so the tile and
    // IHT see them. BPR/BADR flags set from the canonical type (investment
    // companies don't qualify). Without this they were silently dropped.
    {
      const nonTrading = itemType === 'LTD_INVESTMENT'
      const arr = ensureArray(e, 'companies')
      const idx = arr.findIndex(c => c.id === newId)
      const value = +fields.estimatedValue || +fields.value || 0
      const obj = {
        id: newId,
        name: fields.companyName || fields.business || fields.name || fields.description || itemType,
        role: fields.role || 'Owner',
        interest_type: itemType,
        shareholding_pct: +fields.sharePct / 100 || null,
        share_value_gbp: value,
        value,
        trading_status: nonTrading ? 'investment' : 'trading',
        qualifies_for_bpr: !nonTrading,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
      return
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // PROTECTION — assets.protection.{life,ci,ip,pmi,relevantLifePlan,...}
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'protection') {
    const p = e.assets.protection = e.assets.protection || {}
    if (itemType === 'LIFE') {
      p.lifeInsurance = {
        exists: true,
        amount: +fields.coverAmount || 0,
        inTrust: String(fields.inTrust).toLowerCase() === 'true',
        premium: +fields.premium || 0,
        provider: fields.provider || '',
        provenance,
      }
    } else if (itemType === 'CI') {
      p.criticalIllness = { exists: true, amount: +fields.coverAmount || 0, premium: +fields.premium || 0, provider: fields.provider || '', provenance }
    } else if (itemType === 'IP') {
      p.incomeProtection = { exists: true, monthlyBenefit: +fields.monthlyBenefit || 0, premium: +fields.premium || 0, provider: fields.provider || '', deferred_period_weeks: +fields.deferralWeeks || 0, provenance }
    } else if (itemType === 'PMI') {
      p.pmi = { exists: true, premium: (+fields.annualPremium || 0) / 12, provider: fields.provider || '', annualPremium: +fields.annualPremium || 0, provenance }
    } else if (itemType === 'RELEVANT_LIFE') {
      p.relevantLifePlan = { exists: true, amount: +fields.coverAmount || 0, premium: +fields.premium || 0, provider: fields.provider || '', via_company: true, provenance }
    } else if (itemType === 'KEYPERSON') {
      p.keyPerson = { exists: true, amount: +fields.coverAmount || 0, premium: +fields.premium || 0, provider: fields.provider || '', provenance }
    } else if (itemType === 'HOME_INS' || itemType === 'MOTOR') {
      const arr = ensureArray(e, 'general_insurance')
      const idx = arr.findIndex(g => g.id === newId)
      const obj = {
        id: newId,
        type: itemType === 'HOME_INS' ? 'home-buildings-contents' : 'motor-comprehensive',
        provider: fields.provider || '',
        cover_amount: +fields.coverAmount || 0,
        premium_annual: +fields.annualPremium || 0,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
    } else if (itemType === 'PII') {
      const arr = ensureArray(e, 'business_insurance')
      const idx = arr.findIndex(b => b.id === newId)
      const obj = {
        id: newId, type: 'professional-indemnity',
        provider: fields.provider || '',
        cover_amount: +fields.coverAmount || 0,
        premium_annual: +fields.annualPremium || 0,
        provenance,
      }
      if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
      else arr.push(obj)
    } else {
      // Any other protection / insurance type from the menu (decreasing term,
      // FIB, whole-of-life, group life, short-term IP, MPPI, health cash plan,
      // shareholder protection, travel) — route by canonical class so nothing is
      // dropped. Without this the new menu could add a policy that vanished.
      const cls = assetClassOf(itemType)
      if (cls === 'general-insurance') {
        const arr = ensureArray(e, 'general_insurance')
        const idx = arr.findIndex(g => g.id === newId)
        const obj = { id: newId, type: itemType.toLowerCase(), provider: fields.provider || '',
          cover_amount: +fields.coverAmount || 0, premium_annual: +fields.annualPremium || 0, provenance }
        if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }; else arr.push(obj)
      } else if (cls === 'business-protection') {
        const arr = ensureArray(e, 'business_insurance')
        const idx = arr.findIndex(b => b.id === newId)
        const obj = { id: newId, type: itemType.toLowerCase(), provider: fields.provider || '',
          cover_amount: +fields.coverAmount || 0, premium_annual: +fields.annualPremium || 0, provenance }
        if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }; else arr.push(obj)
      } else {
        // life-cover / health-income — a keyed policy on assets.protection
        const key = itemType.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
        p[key] = {
          exists: true,
          policy_type: itemType,
          amount: +fields.coverAmount || 0,
          monthlyBenefit: +fields.monthlyBenefit || 0,
          premium: (+fields.annualPremium ? (+fields.annualPremium / 12) : (+fields.premium || 0)),
          provider: fields.provider || '',
          inTrust: String(fields.inTrust).toLowerCase() === 'true',
          provenance,
        }
      }
    }
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // CASH — assets.bank[]
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'cash') {
    const arr = ensureArray(e.assets, 'bank')
    const idx = arr.findIndex(b => b.id === newId)
    const typeMap = { CURRENT: 'current-account', SAVINGS: 'savings', FIXED: 'fixed-term', PREMIUM_BONDS: 'premium-bonds' }
    const obj = {
      id: newId,
      account_name: fields.bank || itemType,
      bank: fields.bank || '',
      type: typeMap[itemType] || itemType,
      balance: +fields.balance || 0,
      balance_gbp: +fields.balance || 0,
      interest_rate: +fields.interestRate / 100 || 0,
      maturity_date: fields.maturityDate || null,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    // Update legacy `assets.cash.total` for older readers
    if (!e.assets.cash) e.assets.cash = { total: 0, own: 0, rate: 0 }
    e.assets.cash.total = arr.reduce((s, b) => s + (+b.balance || 0), 0)
    e.assets.cash.own = e.assets.cash.total
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIABILITIES — liabilities.mortgage (singleton) or otherLoans[]
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'liabilities') {
    if (!e.liabilities) e.liabilities = {}
    if (itemType === 'MORTGAGE') {
      e.liabilities.mortgage = {
        outstanding: +fields.outstanding || 0,
        monthlyPayment: +fields.monthlyPayment || 0,
        rateType: fields.rateType || '',
        rate: +fields.rate / 100 || 0,
        remainingYears: +fields.remainingYears || 0,
        provenance,
      }
      return
    }
    const arr = ensureArray(e.liabilities, 'otherLoans')
    const idx = arr.findIndex(l => l.id === newId)
    // Canonical kebab `type` for every taxonomy item (ADD_ID_TO_TYPE), so a
    // freshly-added debt categorises identically to a fixture one. A couple of
    // field-dependent specials override the generic map (student-loan plan
    // suffix; legacy STUDENT_LOAN/HP add ids that predate the per-plan menu).
    const typeSpecials = {
      STUDENT_LOAN: `student-loan-plan-${fields.plan || '2'}`,
      HP: 'hire-purchase',
    }
    const obj = {
      id: newId,
      type: typeSpecials[itemType] || ADD_ID_TO_TYPE[itemType] || itemType,
      lender: fields.lender || fields.provider || '',
      outstanding: +fields.outstanding || 0,
      outstanding_balance: +fields.outstanding || 0,
      monthly_payment: +fields.monthlyPayment || 0,
      interest_rate: +fields.apr / 100 || 0,
      apr: +fields.apr / 100 || 0,
      rate_type: fields.rateType || '',
      secured_on: fields.securedOn || null,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // INCOME — entity.income.* (singleton fields)
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'income') {
    if (!e.income) e.income = {}
    if (itemType === 'EMPLOYMENT')      e.income.employment = +fields.grossAnnual || 0
    else if (itemType === 'SELF_EMPLOYMENT') e.income.selfEmploymentNet = +fields.annualProfit || 0
    else if (itemType === 'DIRECTOR_SALARY') e.income.directorSalary = +fields.annualSalary || 0
    else if (itemType === 'DIRECTOR_DIV')    e.income.directorDividends = +fields.annualDividend || 0
    else if (itemType === 'INVESTMENT_DIV')  e.income.dividends = (+e.income.dividends || 0) + (+fields.annualDividend || 0)
    else if (itemType === 'RENTAL')          e.income.rentalIncomeNet = +fields.annualNet || 0
    else if (itemType === 'INTEREST')        e.income.interest = +fields.annualInterest || 0
    else if (itemType === 'STATE_PENSION') {
      e.income.statePension = { annual: (+fields.weeklyAmount || 0) * 52, startAge: 67 }
    }
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // ALTERNATIVES — assets.alternatives[]
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'alternatives') {
    const arr = ensureArray(e.assets, 'alternatives')
    const idx = arr.findIndex(a => a.id === newId)
    const obj = {
      id: newId,
      type: itemType.toLowerCase(),
      name: fields.description || fields.asset || fields.fund || fields.platform || itemType,
      value: +fields.gbpValue || +fields.estimatedValue || +fields.currentValue || 0,
      value_gbp: +fields.gbpValue || +fields.estimatedValue || +fields.currentValue || 0,
      holdings: +fields.holdings || 0,
      ounces: +fields.ounces || 0,
      committed: +fields.committed || 0,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    return
  }

  // ──────────────────────────────────────────────────────────────────────
  // OBLIGATIONS — family_obligations[]
  // ──────────────────────────────────────────────────────────────────────
  if (category === 'obligations') {
    const arr = ensureArray(e, 'family_obligations')
    const idx = arr.findIndex(o => o.id === newId)
    const obj = {
      id: newId,
      type: itemType.toLowerCase().replace(/_/g, '-'),
      label: fields.school || fields.name || fields.payee || itemType,
      annual_cost: +fields.annualCost || +fields.annualFees || +fields.annualSupport ||
                   (+fields.monthly || 0) * 12 || 0,
      provenance,
    }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...obj }
    else arr.push(obj)
    return
  }
}

function removeAssetEvent(e, payload) {
  if (!payload?.id) return
  const lists = [
    e.assets?.sipp?.pensions, e.assets?.pensions, e.assets?.investments,
    e.assets?.property, e.assets?.bank, e.assets?.alternatives,
    e.assets?.decumulation, e.liabilities?.otherLoans,
    e.companies, e.share_schemes, e.business_assets,
    e.general_insurance, e.business_insurance, e.family_obligations,
  ]
  for (const arr of lists) {
    if (!Array.isArray(arr)) continue
    const i = arr.findIndex(x => x.id === payload.id)
    if (i >= 0) { arr.splice(i, 1); return }
  }
}

function attachDocumentEvent(e, payload) {
  if (!payload) return
  const { assetId, document, parsed } = payload
  if (!document) return

  // Find the asset to attach to. Cheap: search every plausible list.
  const lists = [
    e.assets?.sipp?.pensions, e.assets?.pensions, e.assets?.investments,
    e.assets?.property, e.assets?.bank, e.assets?.alternatives,
    e.liabilities?.otherLoans, e.companies, e.share_schemes,
    e.business_assets, e.general_insurance, e.business_insurance,
  ]
  for (const arr of lists) {
    if (!Array.isArray(arr)) continue
    const match = arr.find(x => x.id === assetId)
    if (match) {
      if (!Array.isArray(match.documents)) match.documents = []
      match.documents.push({
        name: document.name,
        size: document.size,
        mime: document.mime,
        captured_at: document.capturedAt || new Date().toISOString(),
        // Don't persist data-urls into the entity (memory bloat); store ref only
        ref: document.ref || null,
      })
      // If the parse layer provided structured fields, apply them
      if (parsed && Object.keys(parsed).length > 0) {
        Object.assign(match, parsed)
        match.provenance = { ...(match.provenance || {}),
          source: 'document', confidence: parsed.confidence || 0.7,
          last_parsed_at: new Date().toISOString() }
      }
      return
    }
  }
}

// ─── React context + provider ──────────────────────────────────────────────
const EventsContext = createContext(null)

export function EventsProvider({ children }) {
  const [events, dispatch] = useReducer(reducer, {})

  const commit = useCallback((personaId, event) => {
    dispatch({ type: 'COMMIT', personaId, event })
  }, [])

  const resetPersona = useCallback((personaId) => {
    dispatch({ type: 'RESET_PERSONA', personaId })
  }, [])

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' })
  }, [])

  const value = useMemo(
    () => ({ events, commit, resetPersona, resetAll }),
    [events, commit, resetPersona, resetAll]
  )

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  )
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) {
    // Allow use outside provider — return a no-op shape for safe rendering
    return {
      events: {},
      commit: () => {},
      resetPersona: () => {},
      resetAll: () => {},
    }
  }
  return ctx
}

// Convenience: get the committed events for one persona
export function useEventsFor(personaId) {
  const { events } = useEvents()
  return events[personaId] || []
}

// Convenience: get the effective entity (base + committed events applied)
export function useEffectiveEntity(baseEntity, personaId) {
  const log = useEventsFor(personaId)
  return useMemo(() => applyEvents(baseEntity, log), [baseEntity, log])
}
