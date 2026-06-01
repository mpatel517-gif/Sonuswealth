// ─────────────────────────────────────────────────────────────────────────────
// AlternativesDecisions — researched decision modeller for alternative assets.
//
// Tax treatment researched 2026-06-01 against:
//   · gov.uk/capital-gains-tax/rates (updated 6 Apr 2026)
//   · HS293 Personal possessions and CGT 2026 (gov.uk, Apr 2026)
//   · HS275 Business Asset Disposal Relief 2026 (gov.uk, Apr 2026)
//   · TAX bundle (src/engine/_bundle.js) — all rates pulled from TAX, no hardcoding
//
// Rates (2026/27 — ENACTED unless noted):
//   CGT on "other assets": 18% basic / 24% higher (post-Autumn Budget 2024)
//   Annual exempt amount: £3,000 (CGT)
//   BADR: 18% from 6 April 2026, £1m lifetime cap (Finance Act 2026)
//   Chattels threshold: £6,000 per disposal (s262 TCGA 1992, HS293)
//   Classic car: wasting asset — CGT-exempt (mechanical, ≤50y predictable life)
//   UK legal-tender gold coins (sovereigns post-1837, britannias): CGT-exempt as legal tender
//   EIS/SEIS: 3-year hold to retain IT relief + CGT exemption
//   VCT: 5-year hold; dividends + disposal gains tax-free if IT relief retained
//
// COMPLIANCE: information and guidance only, not personal advice (FCA boundary).
// Every £ figure derives from user data or a named, cited rule.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { TAX } from '../../engine/fq-calculator.js'
import { BRAND } from '../../config/brand.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function gbp(v) {
  const n = Math.round(+v || 0)
  return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB')}`
}

function Row({ label, value, tone, strong }) {
  const fg = tone === 'good' ? 'var(--c-acc)'
    : tone === 'bad' ? 'var(--c-coral,#FF6F7D)'
    : tone === 'warn' ? '#FF9500'
    : 'var(--c-text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--c-sep)' }}>
      <span style={{ fontSize: 12, color: 'var(--c-text3)' }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 850 : 700, color: fg, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Note({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 10, lineHeight: 1.45 }}>{children}</div>
}

// ── Chattels marginal relief (s262 TCGA 1992 / HS293 2026) ──────────────────
// If proceeds > £6,000: gain is MIN(actual-gain, 5/3 × (proceeds − 6000))
function chattelsGain(proceeds, costBasis) {
  const THRESHOLD = 6000
  if (proceeds <= THRESHOLD) return 0
  const actualGain = Math.max(0, proceeds - costBasis)
  const cappedGain = Math.round((5 / 3) * (proceeds - THRESHOLD))
  return Math.min(actualGain, cappedGain)
}

// ── Decision sets per asset type ─────────────────────────────────────────────
// Only decisions that are mechanically meaningful for the holding type.
const DECISION_SETS = {
  wine:         ['sell', 'illiquidity'],
  art:          ['sell', 'illiquidity'],
  gold:         ['sell', 'illiquidity'],
  crypto:       ['sell', 'illiquidity'],
  pe:           ['sell', 'illiquidity'],
  classic_car:  ['sell', 'illiquidity'],
  watches:      ['sell', 'illiquidity'],
  collectibles: ['sell', 'illiquidity'],
  eis:          ['hold_relief_eis', 'illiquidity'],
  seis:         ['hold_relief_seis', 'illiquidity'],
  vct:          ['hold_relief_vct', 'illiquidity'],
  other:        ['illiquidity'],
}

const DECISION_LABEL = {
  sell:             'Sell / realise gain',
  hold_relief_eis:  'Hold for EIS relief',
  hold_relief_seis: 'Hold for SEIS relief',
  hold_relief_vct:  'Hold for VCT relief',
  illiquidity:      'Illiquidity & valuation',
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AlternativesDecisions({ asset = {}, wrapper, isHigherRate, costBasis, onAddToPlan }) {
  // Resolve value and cost basis from multiple possible shapes
  const value = +(asset.value ?? asset.value_gbp ?? asset.balance ?? 0)
  const type = (asset.type || 'other').toLowerCase()
  const name = asset.name || type

  // costBasis: prop wins, then _costBasis from drill wiring, then asset.raw fields
  const basis = +(costBasis ?? asset._costBasis ?? asset.raw?.cost_base ?? asset.raw?.acquisition_cost ?? asset.raw?.purchase_price ?? 0)
  const hasBasis = basis > 0

  // Higher-rate flag: prop wins, then _isHigherRate from drill wiring
  const higher = isHigherRate ?? asset._isHigherRate ?? true

  // Acquisition date for clock calculations
  const acqDate = asset.acquisitionDate || asset.raw?.acquisition_date || asset.raw?.purchase_date || null

  // TAX bundle rates (ENACTED 2026/27 unless noted in comments)
  // Source: src/engine/_bundle.js → UK-2026.1.1.json
  const exempt = TAX?.cgaAllowance ?? 3000           // CGT annual exempt amount — £3,000 (gov.uk 2026/27)
  const cgtRate = higher ? (TAX?.cgtHigher ?? 0.24) : (TAX?.cgtBasic ?? 0.18) // 18% / 24% post-Autumn Budget 2024
  const badrRate = TAX?.badrRate ?? 0.18             // 18% from 6 Apr 2026 (FA 2026) — previously 14% in 2025/26
  const badrLifetimeCap = 1_000_000                  // £1m lifetime cap — IHTA/TCGA / FA 2026
  const higherRateThreshold = TAX?.brt ?? 50270      // £50,270 basic/higher-rate boundary 2026/27

  // Decisions filtered for this type
  const decisions = DECISION_SETS[type] || DECISION_SETS.other
  const [pick, setPick] = useState(decisions[0])
  const active = decisions.includes(pick) ? pick : decisions[0]
  const [saved, setSaved] = useState(null)

  // Fire the Sonu Ask event
  const fireAsk = (q) => window.dispatchEvent(new CustomEvent('sonus:ask', {
    detail: {
      question: q,
      context: { metric: 'altDecision', decision: active, name, value, scope: 'mymoney' },
    },
  }))

  // Commit to plan
  const addPlan = (label, summary, deltas) => {
    onAddToPlan?.({ kind: 'alt-decision', decision: active, label, summary, asset: name, deltas })
    setSaved(active)
  }

  // Per-decision model
  let body = null
  let askQ = ''
  let planLabel = ''
  let planSummary = ''
  let planDeltas = []

  // ── SELL / REALISE GAIN ─────────────────────────────────────────────────────
  if (active === 'sell') {
    // Derive the correct CGT treatment per type
    let cgtDue = 0
    let cgtLabel = ''
    let cgtTone = 'warn'
    let noteText = ''
    let gain = hasBasis ? Math.max(0, value - basis) : null

    if (type === 'classic_car') {
      // Wasting asset exemption — mechanical asset, ≤50y predictable life
      // Source: TCGA 1992 s44 + HS293 §4; confirmed gov.uk 2026
      cgtDue = 0
      cgtLabel = 'No CGT — wasting asset (TCGA 1992 s44)'
      cgtTone = 'good'
      noteText = 'Classic and vintage cars are treated as wasting assets by HMRC — their predictable useful life is ≤50 years. Any gain is entirely exempt from CGT regardless of sale price. No annual exemption needed. (Edge case: a car modified to a non-mechanical static exhibit may lose wasting-asset status — uncommon and HMRC-challenged.)'
      planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: value }]
    } else if (type === 'gold') {
      // UK legal-tender coins CGT-exempt; investment bullion = standard CGT
      const isLikelyLegalTender = (name || '').toLowerCase().includes('sovereign') || (name || '').toLowerCase().includes('britannia')
      if (isLikelyLegalTender) {
        cgtDue = 0
        cgtLabel = 'No CGT — UK legal-tender coin (sovereign / britannia exempt)'
        cgtTone = 'good'
        noteText = 'UK legal-tender gold coins (sovereigns minted post-1837, Britannia coins) are exempt from CGT because they constitute legal currency. Other gold (bars, ETFs, non-legal-tender coins) is subject to standard CGT at 18%/24%.'
        planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: value }]
      } else {
        // Standard CGT on non-legal-tender gold
        const taxableGain = hasBasis ? Math.max(0, (gain ?? 0) - exempt) : null
        cgtDue = taxableGain != null ? Math.round(taxableGain * cgtRate) : 0
        const cgtRateLabel = `${Math.round(cgtRate * 100)}% (${higher ? 'higher' : 'basic'}-rate taxpayer)`
        cgtLabel = `CGT at ${cgtRateLabel} — after £${(exempt / 1000).toFixed(0)}k exempt`
        cgtTone = cgtDue > 0 ? 'bad' : 'good'
        noteText = 'Investment-grade bullion and gold ETFs are standard CGT assets — no special exemption. UK legal-tender coins (sovereigns post-1837, Britannia coins) are exempt; if this holding includes those, they can be excluded from the calculation.'
        const netProceeds = value - cgtDue
        planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: netProceeds }]
      }
    } else if (['wine', 'art', 'watches', 'collectibles'].includes(type)) {
      // Chattels exemption — s262 TCGA 1992 / HS293 2026
      // Single disposal proceeds ≤ £6,000: entirely exempt
      // Above £6,000: gain capped at 5/3 × (proceeds − £6,000); lower of actual gain or cap applies
      const THRESHOLD = 6000
      if (value <= THRESHOLD) {
        cgtDue = 0
        cgtLabel = `No CGT — proceeds ≤ £6,000 (chattels exemption, s262 TCGA)`
        cgtTone = 'good'
        noteText = `Chattels sold for £6,000 or less per item are entirely CGT-exempt (s262 TCGA 1992, HS293). Each item (each bottle lot, each piece) is assessed individually — a collection sold together may be treated as a single asset if HMRC views them as a set.`
        planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: value }]
      } else {
        // Above threshold — marginal relief
        const actualGain = hasBasis ? Math.max(0, value - basis) : 0
        const capGain = Math.round((5 / 3) * (value - THRESHOLD))
        const effectiveGain = hasBasis ? Math.min(actualGain, capGain) : capGain
        const taxableGain = Math.max(0, effectiveGain - exempt)
        cgtDue = Math.round(taxableGain * cgtRate)
        cgtLabel = `CGT at ${Math.round(cgtRate * 100)}% after marginal relief cap (HS293)`
        cgtTone = cgtDue > 0 ? 'bad' : 'good'
        noteText = `Chattels above £6,000 use marginal relief: the taxable gain is capped at 5/3 × (proceeds − £6,000). This cap (${gbp(capGain)}) is compared to the actual gain${hasBasis ? ` (${gbp(actualGain)})` : ' (unknown — cost basis not captured)'}; the lower figure is used. Sets sold piecemeal may be aggregated by HMRC.`
        const netProceeds = value - cgtDue
        planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: netProceeds }]
      }
    } else if (type === 'crypto') {
      // Crypto = property for HMRC; CGT at marginal rate; s104 pooling
      const taxableGain = hasBasis ? Math.max(0, (gain ?? 0) - exempt) : null
      cgtDue = taxableGain != null ? Math.round(taxableGain * cgtRate) : 0
      cgtLabel = `CGT at ${Math.round(cgtRate * 100)}% (${higher ? 'higher' : 'basic'}-rate) · s104 pool`
      cgtTone = cgtDue > 0 ? 'bad' : (hasBasis ? 'good' : 'warn')
      noteText = `HMRC treats cryptoassets as property, not currency. CGT applies on every disposal (including crypto-to-crypto swaps). The share-pool rules (s104 pool + 30-day bed-and-breakfast rule) mean you can't realise a loss and repurchase the same token within 30 days. Each wallet address / token type forms a separate pool. Staking rewards and airdrops may be income, not capital — classification depends on specific facts.`
      const netProceeds = value - cgtDue
      planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: netProceeds }]
    } else if (type === 'pe') {
      // Private equity — BADR may apply to unquoted trading-company disposals
      // BADR rate 18% from 6 Apr 2026 (FA 2026) · £1m lifetime cap · 2y hold + 5% qualifying
      const taxableGain = hasBasis ? Math.max(0, (gain ?? 0) - exempt) : null
      const cgtWithBADR = taxableGain != null ? Math.round(taxableGain * badrRate) : 0
      const cgtStandard = taxableGain != null ? Math.round(taxableGain * cgtRate) : 0
      cgtDue = cgtWithBADR   // optimistic — assumes BADR applies if it could
      cgtLabel = `BADR at ${Math.round(badrRate * 100)}% · £1m lifetime cap (if qualifying)`
      cgtTone = taxableGain != null && taxableGain > 0 ? 'warn' : 'good'
      noteText = `Business Asset Disposal Relief can reduce CGT to ${Math.round(badrRate * 100)}% (from 6 April 2026 — was 14% in 2025/26) on the first £1m of qualifying lifetime gains. To qualify: the company must be an unquoted trading company (or holding company of a trading group); you must have held ≥5% of ordinary shares AND ≥5% of voting rights for at least 2 years; you (or someone connected) must be an officer or employee. Without BADR, the standard rate applies (${Math.round(cgtRate * 100)}% for a ${higher ? 'higher' : 'basic'}-rate taxpayer). This model assumes BADR conditions may apply — confirm qualifying status with an adviser.`
      const netProceeds = value - cgtDue
      planDeltas = [{ category: 'alternatives', deltaNow: -value }, { category: 'cash', deltaNow: netProceeds }]
      body = (<>
        {!hasBasis && <Row label="Cost basis" value="Not captured — gain cannot be computed" tone="warn" />}
        {hasBasis && <Row label="Acquisition cost" value={gbp(basis)} />}
        <Row label="Current value" value={gbp(value)} />
        {hasBasis && <Row label="Gross gain" value={gbp(gain ?? 0)} tone={(gain ?? 0) > 0 ? 'warn' : 'good'} />}
        {hasBasis && <Row label={`Annual exempt amount (CGT, 2026/27)`} value={`−${gbp(exempt)}`} tone="good" />}
        <Row label={`CGT with BADR at ${Math.round(badrRate * 100)}% (if qualifying)`} value={hasBasis ? gbp(cgtWithBADR) : '—'} tone={hasBasis && cgtWithBADR > 0 ? 'bad' : 'neutral'} />
        <Row label={`CGT without BADR at ${Math.round(cgtRate * 100)}%`} value={hasBasis ? gbp(cgtStandard) : '—'} tone={hasBasis && cgtStandard > 0 ? 'bad' : 'neutral'} />
        <Row label="Net proceeds (BADR assumed)" value={hasBasis ? gbp(Math.max(0, value - cgtWithBADR)) : gbp(value)} tone="good" strong />
        <Note>{noteText}</Note>
      </>)
    }

    // For all non-PE types, build the standard body if body not already set
    if (!body) {
      askQ = `If I sold ${name} for ${gbp(value)}, what CGT would be due and how could I minimise it?`
      planLabel = `Sell ${name}`
      planSummary = `${gbp(value)} realised · ${gbp(cgtDue)} CGT`
      body = (<>
        {!hasBasis && type !== 'classic_car' && type !== 'gold' && value > 6000 && (
          <Row label="Cost basis" value="Not captured — gain calculation incomplete" tone="warn" />
        )}
        {hasBasis && <Row label="Acquisition cost" value={gbp(basis)} />}
        <Row label="Current value" value={gbp(value)} />
        {hasBasis && type !== 'classic_car' && !(type === 'gold' && cgtDue === 0 && (name || '').toLowerCase().includes('sovereign')) && (
          <Row label="Gross gain" value={gbp(gain ?? 0)} tone={(gain ?? 0) > 0 ? 'warn' : 'good'} />
        )}
        <Row label={cgtLabel} value={cgtDue > 0 ? gbp(cgtDue) : 'Nil'} tone={cgtTone} strong />
        {cgtDue > 0 && <Row label="Net cash after CGT" value={gbp(Math.max(0, value - cgtDue))} tone="good" />}
        <Note>{noteText}</Note>
      </>)
    } else {
      // PE body already set above — still need askQ / planLabel / planSummary
      askQ = `If I disposed of my ${name} private-equity stake (${gbp(value)}), would I qualify for Business Asset Disposal Relief at ${Math.round(badrRate * 100)}%, and what would I actually keep?`
      planLabel = `Sell ${name} (PE)`
      planSummary = `${gbp(value)} · BADR ${Math.round(badrRate * 100)}% · ${gbp(cgtDue)} CGT`
    }
  }

  // ── EIS HOLD FOR RELIEF ─────────────────────────────────────────────────────
  if (active === 'hold_relief_eis') {
    const MIN_YEARS = 3
    const yearsHeld = acqDate
      ? (Date.now() - new Date(acqDate).getTime()) / (365.25 * 86400000)
      : null
    const yearsRemaining = yearsHeld != null ? Math.max(0, MIN_YEARS - yearsHeld) : null
    const reliefAtRisk = yearsHeld == null || yearsHeld < MIN_YEARS
    const itReliefRate = TAX?.eisITRate ?? 0.30  // EIS income-tax relief: 30% (unchanged by FA 2026)
    const impliedRelief = Math.round(value * itReliefRate * 0.7)  // approximate IT relief at cost (cannot know cost reliably — illustrative)

    askQ = `I hold EIS shares in ${name}. How long do I have left to hold before I can sell without losing the income-tax relief, and what happens to CGT if I do?`
    planLabel = 'Hold EIS to relief date'
    planSummary = yearsRemaining != null
      ? (yearsRemaining > 0 ? `${yearsRemaining.toFixed(1)} years left to clear the 3y clock` : '3-year hold complete — CGT-exempt disposal available')
      : '3-year clock status unknown (no acquisition date)'
    planDeltas = []

    body = (<>
      <Row label="Minimum hold for relief" value="3 years (EIS rules, ITA 2007 s159)" />
      {yearsHeld != null
        ? <Row label="Held so far" value={`${yearsHeld.toFixed(1)} years`} tone={reliefAtRisk ? 'warn' : 'good'} strong />
        : <Row label="Acquisition date" value="Not recorded — cannot compute clock" tone="warn" />}
      {yearsRemaining != null && yearsRemaining > 0 && (
        <Row label="Years remaining to lock in relief" value={`${yearsRemaining.toFixed(1)} years`} tone="bad" />
      )}
      {yearsHeld != null && yearsHeld >= MIN_YEARS && (
        <Row label="Relief status" value="3-year hold met — disposal is CGT-exempt" tone="good" strong />
      )}
      <Note>EIS shares must be held for at least 3 years to retain the 30% income-tax relief. Selling early triggers a clawback — HMRC recovers the relief you claimed. After 3 years AND if the relief was not withdrawn, gains on disposal are CGT-exempt. CGT deferral relief may also have been claimed on reinvestment — that crystallises on disposal. Information only: specific facts matter for whether your shares qualify.</Note>
    </>)
  }

  // ── SEIS HOLD FOR RELIEF ────────────────────────────────────────────────────
  if (active === 'hold_relief_seis') {
    const MIN_YEARS = 3
    const yearsHeld = acqDate
      ? (Date.now() - new Date(acqDate).getTime()) / (365.25 * 86400000)
      : null
    const yearsRemaining = yearsHeld != null ? Math.max(0, MIN_YEARS - yearsHeld) : null
    const reliefAtRisk = yearsHeld == null || yearsHeld < MIN_YEARS

    askQ = `I hold SEIS shares in ${name}. How long do I need to hold before the 3-year minimum is met, and what happens to the income-tax relief if I sell early?`
    planLabel = 'Hold SEIS to relief date'
    planSummary = yearsRemaining != null
      ? (yearsRemaining > 0 ? `${yearsRemaining.toFixed(1)} years to complete the 3y SEIS clock` : '3-year hold complete — relief retained')
      : '3-year clock status unknown'
    planDeltas = []

    body = (<>
      <Row label="Minimum hold for relief" value="3 years (SEIS rules, ITA 2007 s257A)" />
      {yearsHeld != null
        ? <Row label="Held so far" value={`${yearsHeld.toFixed(1)} years`} tone={reliefAtRisk ? 'warn' : 'good'} strong />
        : <Row label="Acquisition date" value="Not recorded — cannot compute clock" tone="warn" />}
      {yearsRemaining != null && yearsRemaining > 0 && (
        <Row label="Years remaining to lock in relief" value={`${yearsRemaining.toFixed(1)} years`} tone="bad" />
      )}
      {yearsHeld != null && yearsHeld >= MIN_YEARS && (
        <Row label="Relief status" value="3-year hold met — disposal is CGT-exempt" tone="good" strong />
      )}
      <Note>SEIS offers 50% income-tax relief on up to £200,000 invested (2023/24+). Hold 3 years and disposal gains are CGT-exempt if the relief is retained. An additional CGT reinvestment relief exempts up to 50% of a capital gain reinvested into SEIS shares in the same year. Early disposal claws back the IT relief. Qualifying status (trading company conditions) must be confirmed.</Note>
    </>)
  }

  // ── VCT HOLD FOR RELIEF ─────────────────────────────────────────────────────
  if (active === 'hold_relief_vct') {
    const MIN_YEARS = 5
    const yearsHeld = acqDate
      ? (Date.now() - new Date(acqDate).getTime()) / (365.25 * 86400000)
      : null
    const yearsRemaining = yearsHeld != null ? Math.max(0, MIN_YEARS - yearsHeld) : null
    const reliefAtRisk = yearsHeld == null || yearsHeld < MIN_YEARS
    // VCT IT relief: was 30%, changed to 20% from April 2026 (FA 2026) — per TAX bundle
    const vctITRate = TAX?.vctITRate ?? 0.20

    askQ = `I hold VCT shares in ${name}. How long do I need to hold before the 5-year minimum for tax-free disposal, and what is the income-tax relief rate now?`
    planLabel = 'Hold VCT to 5-year mark'
    planSummary = yearsRemaining != null
      ? (yearsRemaining > 0 ? `${yearsRemaining.toFixed(1)} years to complete the 5y VCT clock` : '5-year hold complete — dividends and gains tax-free')
      : '5-year clock status unknown'
    planDeltas = []

    body = (<>
      <Row label="Minimum hold for tax-free disposal" value="5 years (VCT rules, ITA 2007 s261)" />
      <Row label="Income-tax relief (on subscription)" value={`${Math.round(vctITRate * 100)}%${vctITRate === 0.20 ? ' (reduced from 30% — Finance Act 2026)' : ''}`} tone="neutral" />
      {yearsHeld != null
        ? <Row label="Held so far" value={`${yearsHeld.toFixed(1)} years`} tone={reliefAtRisk ? 'warn' : 'good'} strong />
        : <Row label="Acquisition date" value="Not recorded — cannot compute clock" tone="warn" />}
      {yearsRemaining != null && yearsRemaining > 0 && (
        <Row label="Years remaining to lock in relief" value={`${yearsRemaining.toFixed(1)} years`} tone="bad" />
      )}
      {yearsHeld != null && yearsHeld >= MIN_YEARS && (
        <Row label="Disposal status" value="5-year hold met — gain is tax-free" tone="good" strong />
      )}
      <Note>VCT shares held for at least 5 years give tax-free dividends and CGT-exempt disposal gains, provided the income-tax relief was not withdrawn. VCTs are listed so they do not qualify for Business Property Relief (no IHT benefit — stays in the estate). Finance Act 2026 reduced the VCT IT relief rate from 30% to {Math.round(vctITRate * 100)}% for subscriptions from April 2026. Selling before 5 years triggers IT relief clawback. Early secondary-market purchases do not attract IT relief.</Note>
    </>)
  }

  // ── ILLIQUIDITY & VALUATION ─────────────────────────────────────────────────
  if (active === 'illiquidity') {
    const lastValued = asset.lastValued || asset.raw?.last_valuation_date || null
    const ageMs = lastValued ? (Date.now() - new Date(lastValued).getTime()) : null
    const ageDays = ageMs != null ? Math.round(ageMs / 86400000) : null
    const isStale = ageDays != null && ageDays > 90

    const LIQ_PROFILE = {
      crypto:       { label: 'Hours', note: 'Exchange order books offer near-immediate execution, subject to market depth.' },
      gold:         { label: 'Days', note: 'Bullion dealers and gold ETFs can settle in 1–3 business days.' },
      wine:         { label: 'Weeks', note: 'Wine exchange or auction house listings typically take 2–6 weeks to complete.' },
      art:          { label: 'Months', note: 'Major auction cycles run quarterly; private sales can take months to negotiate.' },
      classic_car:  { label: 'Months', note: 'Specialist auctions (Bonhams, RM Sotheby\'s) run seasonally; private sales vary.' },
      watches:      { label: 'Months', note: 'Auction and dealer platforms; desirable references sell faster than others.' },
      collectibles: { label: 'Months', note: 'Depends heavily on category — stamps faster than rare manuscripts.' },
      pe:           { label: 'Years', note: 'Exit routes (trade sale, IPO, secondary) may take 3–10+ years; no guaranteed liquidity.' },
      eis:          { label: 'Years', note: 'Minimum 3-year hold for relief; secondary market thin — effective hold often longer.' },
      seis:         { label: 'Years', note: 'Minimum 3-year hold for relief; early-stage companies rarely have secondary markets.' },
      vct:          { label: 'Years', note: 'Minimum 5-year hold for relief; listed on London Stock Exchange but thin secondary market.' },
      other:        { label: 'Months+', note: 'Disposal timeline depends on the specific asset class.' },
    }
    const liq = LIQ_PROFILE[type] || LIQ_PROFILE.other

    askQ = `How liquid is my ${name} holding, and how should I think about valuation when no market price is available?`
    planLabel = 'Acknowledge illiquidity'
    planSummary = `${name} · exit typically takes ${liq.label.toLowerCase()}`
    planDeltas = []

    body = (<>
      <Row label="Typical exit timeline" value={liq.label} tone="neutral" strong />
      <Row label="Live market price" value="Not available — periodic valuation only" tone="warn" />
      {lastValued
        ? <Row label="Last valued" value={`${lastValued}${isStale ? ' (>90 days ago — verify before acting)' : ''}`} tone={isStale ? 'warn' : 'neutral'} />
        : <Row label="Last valued" value="Valuation date not recorded" tone="warn" />}
      <Row label="Value shown on tile" value={gbp(value)} tone="neutral" />
      <Note>{liq.note} The value shown (${gbp(value)}) is only as current as the last recorded valuation — not a live quote. Before making any financial decision that depends on this figure (borrowing against it, estate planning, etc.) obtain a current professional valuation. Nothing here changes your records.</Note>
    </>)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Set planLabel/planSummary for non-sell decisions that set body above
  if (active !== 'sell' && planLabel) {
    // already set in block above
  }

  // For sell, if planLabel not yet set (non-PE sell branches), set it now
  if (active === 'sell' && !planLabel) {
    planLabel = `Sell ${name}`
    planSummary = gbp(value)
  }

  // Final askQ fallback for sell
  if (active === 'sell' && !askQ) {
    askQ = `If I sold ${name} for ${gbp(value)}, what tax would be due?`
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
        Model a decision
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
        Model the tax and trade-offs for this holding — before you act. Nothing here changes your records.
      </div>

      {/* Decision chip selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {decisions.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => { setPick(d); setSaved(null) }}
            className="sw-press"
            style={{
              padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: `1px solid ${active === d ? 'color-mix(in srgb, var(--c-acc) 45%, transparent)' : 'var(--c-border)'}`,
              background: active === d ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)' : 'var(--c-surface2)',
              color: active === d ? 'var(--c-acc)' : 'var(--c-text2)',
            }}
          >
            {DECISION_LABEL[d]}
          </button>
        ))}
      </div>

      {/* Body card */}
      <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '4px 14px 14px' }}>
        {body}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fireAsk(askQ)}
            className="sw-press"
            style={{
              background: 'color-mix(in srgb, var(--c-acc) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-acc) 35%, transparent)',
              color: 'var(--c-acc)', borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⚡ Explore this with Sonu
          </button>
          <button
            type="button"
            onClick={() => addPlan(planLabel, planSummary, planDeltas)}
            className="sw-press"
            style={{
              background: saved === active ? 'color-mix(in srgb, var(--c-acc) 18%, transparent)' : 'var(--c-surface2)',
              border: '1px solid var(--c-border)',
              color: saved === active ? 'var(--c-acc)' : 'var(--c-text2)',
              borderRadius: 12, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {saved === active ? '✓ Added to your Plan' : '+ Add to plan'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5, marginTop: 14 }}>{BRAND.disclaimer}</p>
    </div>
  )
}
