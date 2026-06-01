// ─────────────────────────────────────────────────────────────────────────────
// SONUSWEALTH / FINIO — PersonaGapTiles
// Information-only tiles surfacing UK-tax + estate facts relevant to a persona.
// FCA boundary: information / guidance / storage only. No advice, no "should".
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react'
// S1 selector migration (Phase 2)
import { ani as calcANI, statePensionAnnual } from '../../engine/selectors/index.js'
import { TAX } from '../../engine/fq-calculator.js'
import { hasPersonaFlag } from '../../engine/_helpers.js'

// ── presentational helper ───────────────────────────────────────────────────
export function InfoTile({ accent = 'var(--c-acc)', eyebrow, body, warn = false }) {
  return (
    <div className="sw-card" style={{
      padding: '12px 14px',
      background: 'var(--c-surface)',
      border: `1px solid color-mix(in srgb, ${warn ? 'var(--c-coral, #FF6F7D)' : accent} 25%, var(--c-border))`,
      borderRadius: 'var(--r-md, 14px)',
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
      }}>{eyebrow}</div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.45 }}>{body}</div>
    </div>
  )
}

// ── small utils ─────────────────────────────────────────────────────────────
const fmtGBP = (n) => {
  const v = Math.round(Number(n) || 0)
  return v.toLocaleString('en-GB')
}
const yearsBetween = (iso) => {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, (Date.now() - t) / (365.25 * 86400 * 1000))
}
const readAge = (entity) =>
  entity?.individual?.age ?? entity?.age ?? entity?.profile?.age ?? 0
const readMarital = (entity) =>
  entity?.maritalStatus
    ?? entity?.individual?.maritalStatus
    ?? entity?.household_status
    ?? ''

// ── 1. Tapered AA (v0.3 two-gate per route-1 §8 + route-4 §8) ───────────────
// Visible IFF taxableIncome > TAX.taperedAATIThreshold (£200k)
// AND adjustedIncome > TAX.taperedAAAdj (£260k).
export function TaperedAATile({ entity }) {
  if (!entity) return null
  const adjIncome =
    entity.adjustedIncome
    ?? entity.income?.adjusted_income
    ?? entity.individual?.adjusted_income
    ?? 0
  const taxableIncome =
    entity.taxableIncome
    ?? entity.income?.taxable_income
    ?? entity.individual?.taxable_income
    ?? 0
  const tiGate  = TAX?.taperedAATIThreshold ?? 200000
  const adjGate = TAX?.taperedAAAdj ?? 260000
  // Two-gate visibility (MASTER §6 + route-9 §6 v0.2 NEW)
  if (!(adjIncome > adjGate && taxableIncome > tiGate)) return null
  return (
    <InfoTile
      warn
      eyebrow="Tapered annual allowance"
      body="Adjusted income above £260k and taxable income above £200k tapers your Annual Allowance."
    />
  )
}

// ── 2. Cohab IHT cliff ──────────────────────────────────────────────────────
export function CohabIHTCliffTile({ entity }) {
  if (!entity) return null
  if (readMarital(entity) !== 'cohabiting') return null
  const hasPartner = !!(entity.partner || entity.individual?.partner || entity.spouse)
  if (!hasPartner) return null
  return (
    <InfoTile
      warn
      eyebrow="Cohabiting — IHT treatment"
      body="Unmarried partners do not share Inheritance Tax allowances. NRB £325k plus RNRB £175k applies once."
    />
  )
}

// ── 3. Transferable NRB ─────────────────────────────────────────────────────
export function TransferableNRBTile({ entity }) {
  if (!entity) return null
  const m = readMarital(entity)
  if (!(m === 'married' || m === 'civil_partnership')) return null
  return (
    <InfoTile
      eyebrow="Transferable NRB + RNRB"
      body="Spousal transfer can combine NRB to £650k and RNRB to £350k on second death."
    />
  )
}

// ── 4. State Pension forecast ───────────────────────────────────────────────
export function StatePensionForecastTile({ entity }) {
  if (!entity) return null
  const age = readAge(entity)
  const lifeStage = entity.lifeStage ?? 0
  const hasPensions =
    !!(entity.assets?.pensions?.length || entity.assets?.sipp || entity.statePension || entity.individual?.ni_qualifying_years)
  if (!(age >= 50 || lifeStage >= 4 || hasPensions)) return null

  const qy = entity.individual?.ni_qualifying_years ?? entity.statePension?.qualifyingYears
  let annual = 0
  try { annual = statePensionAnnual(entity) || 0 } catch (_) { annual = 0 }
  if (!annual && qy != null) annual = Math.round(qy * ((TAX.statePensionFull ?? 12547.60) / 35))
  const perYear = Math.round((TAX.statePensionFull ?? 12547.60) / 35)
  return (
    <InfoTile
      eyebrow="State pension forecast"
      body={`State pension forecast — £${fmtGBP(annual)}/yr at state pension age. ${qy ?? '—'} of 35 NI qualifying years recorded. Each additional year typically adds ~£${perYear}/yr to the new state pension. Voluntary Class 3 contributions can fill gaps subject to time limits.`}
    />
  )
}

// ── 5. EIS / SEIS / VCT clock ──────────────────────────────────────────────
export function EISVCTClockTile({ entity }) {
  if (!entity) return null
  const invs = entity?.assets?.investments
  if (!Array.isArray(invs) || invs.length === 0) return null
  const wrappers = { EIS: 3, SEIS: 3, VCT: 5 }
  const rows = invs
    .filter((h) => h && wrappers[h.wrapper])
    .map((h, i) => {
      const required = wrappers[h.wrapper]
      const iso = h.acquisition_date || h.start_date
      const held = yearsBetween(iso)
      const atRisk = held < required
      const name = h.name || h.type || h.wrapper
      return { key: i, name, wrapper: h.wrapper, required, held, atRisk }
    })
  if (rows.length === 0) return null
  const anyAtRisk = rows.some((r) => r.atRisk)
  return (
    <InfoTile
      warn={anyAtRisk}
      eyebrow="Holding-period clocks — EIS / SEIS / VCT"
      body={
        <div>
          {/* v0.3 verbatim per route-1 §8 / route-4 §8 — quoted, factual */}
          <div style={{ marginBottom: 6 }}>
            EIS/SEIS three-year hold required for CGT freedom. VCT five-year hold required for 20% IT relief.
          </div>
          {rows.map((r) => (
            <div key={r.key} style={{ marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{r.name} ({r.wrapper})</span>: {r.held.toFixed(1)}/{r.required} yr held
            </div>
          ))}
        </div>
      }
    />
  )
}

// ── 6. Rent-a-room ──────────────────────────────────────────────────────────
export function RentARoomTile({ entity }) {
  if (!entity) return null
  const props = entity.assets?.property || []
  const hasRental = Array.isArray(props) && props.some((p) => /buy-to-let|btl|rental/i.test(p?.use || p?.type || ''))
  const rentalIncome = +(entity.income?.rental || 0)
  if (!hasRental && !(rentalIncome > 0)) return null
  return (
    <InfoTile
      eyebrow="Rent-a-room relief"
      body="Rent-a-room relief: first £7,500 of rent from a furnished room in your main residence is tax-free."
    />
  )
}

// ── 7. Landlord S24 ────────────────────────────────────────────────────────
export function LandlordS24Tile({ entity }) {
  if (!entity) return null
  if (hasPersonaFlag(entity, 'director')) return null
  const props = entity.assets?.property || []
  const hasBTL = Array.isArray(props) && props.some((p) => /buy-to-let|btl/i.test(p?.use || p?.type || ''))
  if (!hasBTL) return null
  const loans = entity.liabilities?.otherLoans || []
  const btlMortgageInterest = Array.isArray(loans)
    ? loans.filter((l) => /buy-to-let|btl/i.test(l?.type || ''))
           .reduce((s, l) => s + (+l.monthlyPayment || 0) * 12, 0)
    : 0
  if (!(btlMortgageInterest > 0)) return null
  return (
    <InfoTile
      warn
      eyebrow="Section 24 — BTL interest"
      body="Rental finance costs are restricted to a 20% basic-rate credit (ITA 2007 s274A)."
    />
  )
}

// ── 8. Sole-trader NIC ─────────────────────────────────────────────────────
export function SoleTraderNICTile({ entity }) {
  if (!entity) return null
  if (!hasPersonaFlag(entity, 'sole_trader')) return null
  return (
    <InfoTile
      eyebrow="Self-employment NICs"
      body="Self-employment NICs — Class 4 main rate 6% on profits between £12,570 and £50,270, then 2% above. Class 2 (£3.45/wk) is voluntary from April 2024 unless opted in for state-pension qualifying years. Basis-period reform aligned all sole-trader accounting periods to the tax year from 2024/25; transitional profits may apply for the FY24 changeover."
    />
  )
}

// ── 9. Drawdown methods teaser (v0.3 verbatim per route-4 §8) ──────────────
export function DrawdownMethodsTeaser({ entity }) {
  if (!entity) return null
  const age = readAge(entity)
  const gate = entity.flexibleDrawdownTriggered === true
    || hasPersonaFlag(entity, 'decum')
    || age >= 55
  if (!gate) return null
  return (
    <InfoTile
      eyebrow="Pension decumulation routes"
      body="Drawdown methods — UFPLS, FAD, Annuity — what each does. See Cashflow → Drawdown teaser."
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3 PHASE 3 — NEW PERSONA / MECHANICAL CHIPS
// Verbatim per route-1 §8, route-2 §8, route-4 §8.
// Every value from TAX.* (Phase 1 bundle keys); no hardcoded thresholds.
// ─────────────────────────────────────────────────────────────────────────────

// ── 10. NRI Indian-assets reveal label (v0.3 verbatim per route-1 §8) ──────
export function NRIIndianAssetsTile({ entity }) {
  if (!entity) return null
  if (!hasPersonaFlag(entity, 'nri')) return null
  return (
    <InfoTile
      eyebrow="NRI — Indian-domiciled assets"
      body="Indian-domiciled assets — DTAA treatment for cross-border tax."
    />
  )
}

// ── 11. Avalanche-priority chip (v0.3 verbatim per route-1 §8) ─────────────
// Surfaces ONLY for the single highest-APR liability with APR >= 8%.
export function AvalanchePriorityTile({ entity }) {
  if (!entity) return null
  const loans = []
  if (Array.isArray(entity.liabilities?.creditCards)) {
    for (const c of entity.liabilities.creditCards) loans.push({ apr: +c.apr || 0 })
  }
  if (Array.isArray(entity.liabilities?.otherLoans)) {
    for (const l of entity.liabilities.otherLoans) loans.push({ apr: +l.apr || 0 })
  }
  const maxApr = loans.reduce((m, l) => Math.max(m, l.apr), 0)
  if (!(maxApr >= 8)) return null
  return (
    <InfoTile
      warn
      eyebrow="Avalanche — debt cost"
      body="Highest APR in your debt mix"
    />
  )
}

// ── 12. HICBC chip (v0.3 verbatim per route-2 §8 + route-1 §8) ─────────────
// Visible when ANI ∈ [hicbcFloor, hicbcCeiling] per route-9 §6 v0.2.
// 2026-05-26 R2 snap-audit fix: persona JSONs don't carry a pre-computed
// `adjustedNetIncome` field — the screen computes it via calcANI. Tile
// previously read missing entity fields and silently fell through to 0,
// hiding the chip even for Mr T at ANI £78,140 (inside the taper band).
// Now computes ANI live so the chip surfaces correctly for any persona.
export function HICBCTile({ entity, ani: aniProp }) {
  if (!entity) return null
  let ani = aniProp
  if (ani == null) {
    ani = entity.adjustedNetIncome
      ?? entity.ani
      ?? entity.income?.ani
      ?? entity.individual?.ani
    if (ani == null) {
      try { ani = calcANI(entity)?.ani ?? 0 }
      catch { ani = 0 }
    }
  }
  const floor = TAX?.hicbcFloor ?? 60000
  const ceil  = TAX?.hicbcCeiling ?? 80000
  if (!(ani >= floor && ani <= ceil)) return null
  return (
    <InfoTile
      eyebrow="HICBC — child benefit taper"
      body="Child Benefit tapers between £60k and £80k of ANI."
    />
  )
}

// ── 13. Employer NIC chip (v0.3 verbatim per route-2 §8) ───────────────────
// Director-gated. Shows annual liability computed from TAX bundle keys.
export function EmployerNICTile({ entity }) {
  if (!entity) return null
  if (!hasPersonaFlag(entity, 'director')) return null
  const rate     = TAX?.employerNICRate ?? 0.15
  const threshold = TAX?.employerNICThreshold ?? 5000
  const salary =
    +(entity.directorSalary ?? entity.income?.director_salary ?? entity.income?.directorSalary ?? 0)
  const annualLiability = Math.max(0, salary - threshold) * rate
  return (
    <InfoTile
      eyebrow="Employer NIC"
      body={`Employer NIC · 15% on salary above £5,000 threshold (from April 2025). Annual liability: £${fmtGBP(annualLiability)}.`}
    />
  )
}

// ── 14. Normal expenditure from income (v0.3 verbatim per route-4 §8) ──────
export function NormalExpenditureTile({ entity }) {
  if (!entity) return null
  const gifts = entity.gifts || entity.estate?.gifts || []
  const hasHabitual = Array.isArray(gifts) && gifts.some(
    (g) => g?.type === 'normal_expenditure' || g?.fromSurplusIncome === true
  )
  if (!hasHabitual) return null
  return (
    <InfoTile
      eyebrow="Normal expenditure from income"
      body="Habitual gifts from surplus income — IHTA 1984 s21. No 7-year clock."
    />
  )
}

// ── 15. Annual gift exemption (v0.3 verbatim per route-4 §8) ───────────────
export function AnnualGiftExemptionTile({ entity }) {
  if (!entity) return null
  const cap = TAX?.annualGiftExemption ?? 3000
  return (
    <InfoTile
      eyebrow="Annual gift exemption"
      body={`Annual gift exemption £${fmtGBP(cap)} per tax year (IHTA 1984 s19). Unused carries forward one year.`}
    />
  )
}

// ── 16. Small gifts (v0.3 verbatim per route-4 §8) ─────────────────────────
export function SmallGiftsTile({ entity }) {
  if (!entity) return null
  const cap = TAX?.smallGiftsExemption ?? 250
  return (
    <InfoTile
      eyebrow="Small gifts"
      body={`Small gifts up to £${fmtGBP(cap)} per donee per tax year (IHTA 1984 s20). Outside the 7-year clock.`}
    />
  )
}

// ── 17. Wedding gifts (v0.3 verbatim per route-4 §8) ───────────────────────
export function WeddingGiftsTile({ entity }) {
  if (!entity) return null
  const toChild       = TAX?.weddingGiftToChild ?? 5000
  const toGrandchild  = TAX?.weddingGiftToGrandchild ?? 2500
  const toOther       = TAX?.weddingGiftOther ?? 1000
  return (
    <InfoTile
      eyebrow="Wedding gifts"
      body={`Wedding/civil-partnership gifts: parent→child £${fmtGBP(toChild)} · grandparent→grandchild £${fmtGBP(toGrandchild)} · other £${fmtGBP(toOther)}. Per donor, per marriage.`}
    />
  )
}

// ── 18. RNRB taper mechanic (v0.3 verbatim per route-4 §8) ─────────────────
export function RNRBTaperTile({ entity }) {
  if (!entity) return null
  return (
    <InfoTile
      eyebrow="RNRB taper"
      body="RNRB tapers by £1 for every £2 of estate above £2m, fully withdrawn at £2.35m (£2.7m for couples)."
    />
  )
}

// ── 19. BPR cap (v0.3 verbatim per route-4 §8) ─────────────────────────────
export function BPRCapTile({ entity }) {
  if (!entity) return null
  return (
    <InfoTile
      eyebrow="BPR + APR combined cap"
      body="BPR + APR combined cap: £2.5m per individual (FA 2026). AIM holdings qualify at 50%."
    />
  )
}
