// ─────────────────────────────────────────────────────────────────────────────
// PensionDrillDown — ONION grouping layer in front of per-pension routing.
//
// ONION MODEL (2026-06-01 — "peel the layers"):
//   Layer 1  — five TYPE drawers (SIPP · SSAS · Workplace DC · DB · State).
//              Only types with ≥1 pension are rendered.
//   Layer 2  — tap a drawer → list of pensions in that type.
//              DB/State show income/entitlement framing, NOT a DC pot balance.
//              Tap a pension row → PensionLeaf (unchanged, same props).
//   Layer 3  — PensionLeaf (GOLD STANDARD — DO NOT EDIT).
//
// FCA stance: information / guidance / storage only.
// DB-vs-DC distinction is SUITABILITY-critical — rendering a DB as a drawable
// pot is a regulatory hazard. DB gets its own income/CETV framing throughout.
//
// Tax figures sourced from TAX/_bundle.js + rules-uk.js + HMRC gov.uk
// (confirmed 2026/27):
//   AA £60,000 (standard) · MPAA £10,000 · Tapered AA: TI >£200k AND AI >£260k,
//   floor £10,000 (at AI ≥£360k) · LSA £268,275 · LSDBA £1,073,100
//   NMPA: currently 55, rising to 57 from 6 April 2028 (ENACTED)
//   SIPP/DC IHT: ENACTED (Finance Act 2026, Royal Assent 18 Mar 2026),
//   effective 6 April 2027
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import { BRAND } from '../../config/brand.js'
import { LiquidityLadder } from '../charts/index.js'
import { pensions as pensionTotal } from '../../engine/selectors/index.js'
import { monteCarloPOS } from '../../engine/scenarios.js'
import { TAX } from '../../engine/fq-calculator.js'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import { MiniTrendLines } from './L3/MiniTrendLines.jsx'
import { PensionLeaf } from './L3/PensionLeaf.jsx'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: 'var(--c-text3)',
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
      }}>{title}</div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)'
    : tone === 'warn' ? '#FF9500'
    : tone === 'bad' ? 'var(--c-coral, #FF6F7D)'
    : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100,
      background: `color-mix(in srgb, ${fg} 14%, transparent)`, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

function Tile({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)' : tone === 'warn' ? '#FF9500'
    : tone === 'bad' ? 'var(--c-coral,#FF6F7D)' : 'var(--c-text)'
  return (
    <div style={{
      padding: 12, background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)', borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>{sub}</div>}
    </div>
  )
}

// ── Pension type classification ───────────────────────────────────────────────
// Returns one of: 'sipp' | 'ssas' | 'db' | 'state' | 'dc'
function pensionTypeKey(pot) {
  const t = String(pot.type || pot.scheme_type || '').toLowerCase()
  const s = String(pot.scheme || '').toLowerCase()
  const combined = `${t} ${s}`
  if (/\bstate\b/.test(combined) || pot.isStatePension) return 'state'
  if (/\bssas\b/.test(combined)) return 'ssas'
  if (/\bsipp\b/.test(combined)) return 'sipp'
  if (/defined.?benefit|final.?salary|career.?average|\bdb\b/.test(combined)) return 'db'
  return 'dc'
}

// Is this pot a DB (income, not a spendable pot)?
function isDBPot(pot) {
  return pensionTypeKey(pot) === 'db'
}

// Is this pot a State Pension (entitlement, not a pot)?
function isStatePot(pot) {
  return pensionTypeKey(pot) === 'state'
}

// Display value for a pot — respects DB/State framing.
function potDisplayValue(pot) {
  if (isDBPot(pot)) {
    const gInc = +pot.guaranteed_income || +pot.annual_pension || +pot.db_income || 0
    const cetv  = +pot.cetv || +pot.transfer_value || 0
    if (gInc > 0) return `${fmt(gInc)}/yr`
    if (cetv > 0) return `${fmt(cetv)} CETV`
    return 'Income not captured'
  }
  if (isStatePot(pot)) {
    const weekly = +pot.weekly_amount || 0
    const annual = +pot.annual_amount || +(weekly * 52) || 0
    if (annual > 0) return `${fmt(annual)}/yr`
    return 'Entitlement not captured'
  }
  const v = +pot.value || +pot.balance || +pot.balance_gbp || 0
  return fmt(v)
}

// ── 12-month back-cast line for a pot (DC value only — DB/State show flat) ───
function potLine(pot) {
  const isIncomePot = isDBPot(pot) || isStatePot(pot)
  const value = isIncomePot ? 0 : (+pot.value || +pot.balance || +pot.balance_gbp || 0)
  if (value <= 0) return Array(12).fill(0)
  const rate = +pot.growth_rate_assumption || 0.05
  const rM = Math.pow(1 + rate, 1 / 12) - 1
  const out = []
  for (let i = 11; i >= 0; i--) out.push(Math.round(value / Math.pow(1 + rM, i)))
  return out
}

// ── TYPE GROUP METADATA ───────────────────────────────────────────────────────
const TYPE_META = {
  sipp: {
    icon: '◎',
    color: 'var(--c-acc2,#7aa7ff)',
    label: 'SIPP',
    full: 'Self-Invested Personal Pension',
    note: 'You control investment and drawdown. Sits outside your estate until 6 April 2027.',
    isPot: true,
  },
  ssas: {
    icon: '⬡',
    color: '#9B8CFF',
    label: 'SSAS',
    full: 'Small Self-Administered Scheme',
    note: 'Employer-sponsored self-invested scheme. Often used by owner-directors.',
    isPot: true,
  },
  dc: {
    icon: '⬤',
    color: 'var(--c-text3,#8895a7)',
    label: 'Workplace DC',
    full: 'Defined Contribution (Workplace / Legacy)',
    note: 'Pot you have built up via an employer or legacy personal pension. Verify guarantees before drawing.',
    isPot: true,
  },
  db: {
    icon: '⟁',
    color: 'var(--c-violet,#9B8CFF)',
    label: 'Defined Benefit',
    full: 'Defined Benefit (Final Salary / Career Average)',
    note: 'Guaranteed income for life — not a pot you draw down. Displays income/CETV only. Transfers above £30,000 legally require FCA pension-transfer specialist advice.',
    isPot: false,
  },
  state: {
    icon: '★',
    color: 'var(--c-gold,#E8B84B)',
    label: 'State Pension',
    full: 'UK State Pension Entitlement',
    note: 'An entitlement, not a pot. Based on your National Insurance record — up to 35 qualifying years for full new State Pension (£12,547.60/yr in 2026/27).',
    isPot: false,
  },
}

// ── Layer-1 type drawer ───────────────────────────────────────────────────────
function TypeDrawer({ typeKey, pots, onOpen }) {
  const meta = TYPE_META[typeKey]
  const count = pots.length

  // For DC/SIPP/SSAS: sum pot values. For DB: sum CETVs or flag income.
  // For State: sum annual amounts.
  let valueSummary = ''
  if (meta.isPot) {
    const total = pots.reduce((s, p) => s + (+p.value || +p.balance || +p.balance_gbp || 0), 0)
    valueSummary = fmt(total)
  } else if (typeKey === 'db') {
    const incomes = pots.filter(p => (+p.guaranteed_income || +p.annual_pension || +p.db_income) > 0)
    const cetvs   = pots.filter(p => (+p.cetv || +p.transfer_value) > 0)
    if (incomes.length > 0) {
      const totalInc = incomes.reduce((s, p) => s + (+p.guaranteed_income || +p.annual_pension || +p.db_income || 0), 0)
      valueSummary = `${fmt(totalInc)}/yr`
    } else if (cetvs.length > 0) {
      const totalCetv = cetvs.reduce((s, p) => s + (+p.cetv || +p.transfer_value || 0), 0)
      valueSummary = `${fmt(totalCetv)} CETV`
    } else {
      valueSummary = 'Income details pending'
    }
  } else if (typeKey === 'state') {
    const total = pots.reduce((s, p) => {
      const weekly = +p.weekly_amount || 0
      return s + (+p.annual_amount || weekly * 52 || 0)
    }, 0)
    valueSummary = total > 0 ? `${fmt(total)}/yr` : 'Entitlement pending'
  }

  // Aggregate line for DC/SIPP/SSAS only (income schemes have no growth line)
  const line = meta.isPot
    ? (() => {
        const total = pots.reduce((s, p) => s + (+p.value || +p.balance || +p.balance_gbp || 0), 0)
        const rate = 0.05
        const rM = Math.pow(1 + rate, 1 / 12) - 1
        const out = []
        for (let i = 11; i >= 0; i--) out.push(Math.round(total / Math.pow(1 + rM, i)))
        return out
      })()
    : null

  return (
    <button type="button" onClick={onOpen} className="sw-press" style={{
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 16px', borderRadius: 16, border: '1px solid var(--c-border)',
      background: 'var(--card-bg2)', cursor: 'pointer', textAlign: 'left', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: `color-mix(in srgb, ${meta.color} 14%, var(--c-surface2))`,
          color: meta.color, fontSize: 18,
        }}>{meta.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            {count} scheme{count !== 1 ? 's' : ''}
            {!meta.isPot && (
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color, fontSize: 9, fontWeight: 700, letterSpacing: 0.4 }}>
                {typeKey === 'db' ? 'INCOME' : 'ENTITLEMENT'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {line && <MiniTrendLines series={[line]} colors={[meta.color]} width={56} height={22} />}
        <div style={{ fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
          {valueSummary}
        </div>
        <span style={{ color: 'var(--c-text3)', fontSize: 18 }} aria-hidden>›</span>
      </div>
    </button>
  )
}

// ── Layer-2 pension row (within a type group) ─────────────────────────────────
function PensionRow({ pot, typeKey, onOpen }) {
  const meta = TYPE_META[typeKey]
  const display = potDisplayValue(pot)
  const line = potLine(pot)
  const name = pot.name || pot.scheme || pot.provider || 'Pension scheme'

  // Nomination staleness
  const stale = pot.nominationDate
    ? (Date.now() - new Date(pot.nominationDate)) > 2 * 365.25 * 864e5
    : true

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sw-press"
      style={{
        display: 'flex', width: '100%', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: 'transparent', border: 'none',
        borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))',
        textAlign: 'left', cursor: 'pointer',
      }}
    >
      <span style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 9,
        display: 'grid', placeItems: 'center', fontSize: 14,
        background: `color-mix(in srgb, ${meta.color} 12%, var(--c-surface2))`,
        color: meta.color,
      }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--c-text)', fontSize: 13 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 1 }}>
          {display}
          {!meta.isPot && (
            <span style={{ marginLeft: 6, color: meta.color, fontWeight: 600 }}>
              {typeKey === 'state' ? '· entitlement' : '· guaranteed income'}
            </span>
          )}
        </div>
        {meta.isPot && (+pot.value || +pot.balance || +pot.balance_gbp || 0) > 0 && (
          <div style={{ marginTop: 5 }}>
            <div style={{
              height: 4, borderRadius: 100, background: 'var(--c-surface2)',
              overflow: 'hidden', width: '100%',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (line[11] / (line[11] * 1.5 || 1)) * 100)}%`,
                background: meta.color,
              }} />
            </div>
          </div>
        )}
        <div style={{ marginTop: 4, fontSize: 10, color: stale ? '#FF9500' : 'var(--c-good,#5DDBA8)' }}>
          {stale ? 'Nomination — review required' : `Nomination on file (${pot.nominationDate})`}
        </div>
      </div>
      <span style={{ color: 'var(--c-text3)', fontSize: 18, flexShrink: 0 }} aria-hidden>›</span>
    </button>
  )
}

// ── DB/State inline detail (Layer-2 expansion — no leaf forced) ───────────────
// DB has guaranteed income + CETV — routing to a DC-style leaf makes no sense.
// State Pension is an entitlement row — no pot leaf.
// Both show their domain-native detail inline within the drawer.
function DBInlineDetail({ pot, typeKey }) {
  const meta = TYPE_META[typeKey]
  const guaranteedIncome = +pot.guaranteed_income || +pot.annual_pension || +pot.db_income || 0
  const cetv  = +pot.cetv || +pot.transfer_value || 0
  const accrualYears = pot.accrual_years ?? pot.accrualYears
  const projectedAnnual = pot.projected_annual_pension ?? pot.projectedAnnualPension
  const nra = pot.normal_retirement_age ?? pot.normalRetirementAge

  if (typeKey === 'state') {
    const weekly = +pot.weekly_amount || 0
    const annual = +pot.annual_amount || weekly * 52 || 0
    const qualYears = pot.qualifying_years ?? pot.qualifyingYears
    const fullYears = TAX?.statePensionQualYears ?? 35
    const fullAnnual = TAX?.statePensionFull ?? 12547.60  // rules-uk.js 2026/27: £12,547.60/yr · bundle fallback is 11502 (older)
    const statePensionAge = TAX?.spa ?? 66
    return (
      <div style={{
        padding: '12px 14px', background: 'var(--c-surface,rgba(255,255,255,0.03))',
        borderRadius: 12, marginBottom: 8,
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>STATE PENSION ENTITLEMENT</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
          {annual > 0 && (
            <Tile label="Your entitlement" value={`${fmt(annual)}/yr`} tone="good" />
          )}
          <Tile label="Full new State Pension" value={`${fmt(fullAnnual)}/yr`} sub="2026/27 · 35 qualifying years" />
          {qualYears != null && (
            <Tile label="Qualifying NI years" value={`${qualYears} / ${fullYears}`} tone={qualYears >= fullYears ? 'good' : 'warn'} />
          )}
          <Tile label="State Pension age" value={`Age ${statePensionAge}`} sub="Check your State Pension forecast on gov.uk" />
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          The State Pension is an entitlement based on your National Insurance record — not a pot that grows or depletes. You can get a personalised forecast at <strong>gov.uk/check-state-pension</strong>.
        </div>
      </div>
    )
  }

  // DB
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--c-surface,rgba(255,255,255,0.03))',
      borderRadius: 12, marginBottom: 8,
    }}>
      <div className="sw-eyebrow" style={{ marginBottom: 8 }}>GUARANTEED INCOME SCHEME</div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', marginBottom: 10, lineHeight: 1.45 }}>
        This is a <strong>defined-benefit</strong> scheme — it pays a guaranteed income for life. It is not a pot that grows and depletes, so we don't project it like a SIPP.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
        {guaranteedIncome > 0 && (
          <Tile label="Guaranteed income" value={`${fmt(guaranteedIncome)}/yr`} tone="good" sub="Inflation-linked — check your statement" />
        )}
        {projectedAnnual != null && (
          <Tile label="Projected at NRA" value={`${fmt(projectedAnnual)}/yr`} sub="From latest scheme statement" />
        )}
        {cetv > 0 && (
          <Tile label="Transfer value (CETV)" value={fmt(cetv)} tone="warn" sub="Transfer above £30k requires FCA advice" />
        )}
        {accrualYears != null && (
          <Tile label="Accrual" value={`${accrualYears} yr${accrualYears === 1 ? '' : 's'}`} sub="Service years in scheme" />
        )}
        {nra != null && (
          <Tile label="Normal retirement age" value={`Age ${nra}`} />
        )}
      </div>
      {cetv > 30000 && (
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,111,125,0.07)',
          border: '1px solid rgba(255,111,125,0.30)',
          fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.45,
          marginBottom: 8,
        }}>
          <strong>FCA COBS 19.1A:</strong> Defined-benefit transfers of £30,000 or more legally require regulated financial advice from an FCA pension-transfer specialist. Sonuswealth stores transfer values for information only and does not transact transfers.
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.45 }}>
        The FCA's starting position is that staying in a defined-benefit scheme is usually in your interest. Transferring gives up a guaranteed income for life.
      </div>
    </div>
  )
}

// ── Effective AA computation (sourced from TAX/_bundle.js) ───────────────────
function computeEffectiveAA(entity) {
  const mpaa = TAX?.mpaa ?? 10_000
  const aa   = TAX?.pensionAA ?? 60_000
  const tapAdj   = TAX?.taperedAAAdj   ?? 260_000   // adjusted income threshold
  const tapTI    = TAX?.taperedAATIThreshold ?? 200_000  // threshold income gate
  const tapFloor = TAX?.taperedAAFloor ?? 10_000

  if (entity.flexibleDrawdownTriggered || entity.mpaaTriggered) {
    return { aa: mpaa, reason: 'MPAA active (flexi-access drawdown triggered)', tone: 'warn' }
  }
  const adjInc = +(entity.adjustedIncome
    ?? entity.income?.adjustedIncome
    ?? entity.income?.adjusted_income
    ?? 0)
  const threshInc = +(entity.thresholdIncome
    ?? entity.income?.thresholdIncome
    ?? adjInc   // conservative: if threshold income not recorded, use adjusted
    ?? 0)
  if (adjInc > tapAdj && threshInc > tapTI) {
    const tapered = Math.max(tapFloor, aa - Math.floor((adjInc - tapAdj) / 2))
    return { aa: tapered, reason: 'Tapered AA (adjusted income > £260,000)', tone: 'warn' }
  }
  return { aa, reason: 'Standard AA', tone: 'good' }
}

// ── Carry-forward extraction ──────────────────────────────────────────────────
function carryForwardByYear(entity) {
  const raw = entity.income?.allowance_use?.carry_forward_by_year
  if (!raw || typeof raw !== 'object') return null
  if (Array.isArray(raw) && raw.length >= 3) {
    return [+raw[0] || 0, +raw[1] || 0, +raw[2] || 0]
  }
  const y3 = raw['y-3'] ?? raw.year_minus_3 ?? raw['-3']
  const y2 = raw['y-2'] ?? raw.year_minus_2 ?? raw['-2']
  const y1 = raw['y-1'] ?? raw.year_minus_1 ?? raw['-1']
  if (y3 == null && y2 == null && y1 == null) return null
  return [+y3 || 0, +y2 || 0, +y1 || 0]
}

// ── Build pension groups from entity ─────────────────────────────────────────
// Reads BOTH entity.assets.sipp.pensions[] (legacy) AND entity.assets.pensions[]
// Returns { sipp: [], ssas: [], dc: [], db: [], state: [] }
function buildPensionGroups(entity) {
  const a = entity.assets || {}
  const groups = { sipp: [], ssas: [], dc: [], db: [], state: [] }

  // Legacy SIPP sub-pensions
  ;(a.sipp?.pensions || []).forEach(p => {
    const key = pensionTypeKey(p)
    groups[key]?.push(p)
  })

  // New-spec pensions[]
  ;(a.pensions || []).forEach(p => {
    const key = pensionTypeKey(p)
    groups[key]?.push(p)
  })

  // Top-level sipp.total as a synthetic pot if no sub-pensions but total > 0
  if (groups.sipp.length === 0 && groups.ssas.length === 0 && (+a.sipp?.total || 0) > 0) {
    groups.sipp.push({
      name: a.sipp?.provider ? `SIPP — ${a.sipp.provider}` : 'SIPP',
      type: 'sipp',
      value: +a.sipp.total,
      provider: a.sipp?.provider,
      charge: a.sipp?.charges_percent || 0,
    })
  }

  // State pension from entity.statePension or entity.income.statePension
  const sp = entity.statePension || entity.income?.statePension
  if (sp && (+sp.annual || +sp.weekly)) {
    groups.state.push({
      name: 'UK State Pension',
      type: 'state',
      isStatePension: true,
      annual_amount: +sp.annual || 0,
      weekly_amount: +sp.weekly || 0,
      qualifying_years: sp.qualifyingYears ?? sp.qualifying_years,
    })
  }

  return groups
}

// Ordered display list — only types with pensions
const TYPE_ORDER = ['sipp', 'ssas', 'dc', 'db', 'state']

// ── ONION LAYER-2 VIEW ────────────────────────────────────────────────────────
function GroupDetail({ typeKey, pots, entity, personaId, onHome, onBack }) {
  const meta = TYPE_META[typeKey]
  const [leaf, setLeaf] = useState(null)

  // DB and State Pension pots route to inline detail (no DC-style leaf).
  // DC/SIPP/SSAS route to PensionLeaf.
  if (leaf) {
    return (
      <PensionLeaf
        pot={leaf}
        entity={entity}
        pots={pots}
        personaId={personaId}
        onClose={() => setLeaf(null)}
        onHome={onHome}
      />
    )
  }

  // Aggregate value for the header
  let headerValue = ''
  if (meta.isPot) {
    const total = pots.reduce((s, p) => s + (+p.value || +p.balance || +p.balance_gbp || 0), 0)
    headerValue = fmt(total)
  }

  return (
    <div>
      {/* Group header */}
      <div style={{
        padding: '10px 0 14px',
        borderBottom: '1px solid var(--c-border,rgba(255,255,255,0.08))',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: `color-mix(in srgb, ${meta.color} 14%, var(--c-surface2))`,
            color: meta.color, fontSize: 18, flexShrink: 0,
          }}>{meta.icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--c-text)', fontSize: 15 }}>{meta.full}</div>
            {headerValue && (
              <div style={{ fontSize: 12, color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>{headerValue}</div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.45 }}>
          {meta.note}
        </div>
      </div>

      {/* Pension rows */}
      <div style={{
        background: 'var(--card-bg2)', border: '1px solid var(--c-border)',
        borderRadius: 14, overflow: 'hidden', marginBottom: 14,
      }}>
        {pots.map((p, i) => {
          const name = p.name || p.scheme || p.provider || `Scheme ${i + 1}`
          if (!meta.isPot) {
            // DB / State — render inline detail, no leaf routing
            return (
              <div key={name + i} style={{
                padding: '12px 14px',
                borderBottom: i < pots.length - 1 ? '1px solid var(--c-border,rgba(255,255,255,0.08))' : 'none',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--c-text)', fontSize: 13, marginBottom: 6 }}>
                  {name}
                </div>
                <DBInlineDetail pot={p} typeKey={typeKey} />
              </div>
            )
          }
          // DC / SIPP / SSAS — row taps through to PensionLeaf
          return (
            <PensionRow
              key={name + i}
              pot={p}
              typeKey={typeKey}
              onOpen={() => setLeaf(p)}
            />
          )
        })}
      </div>

      {/* DB-specific: PS18/6 FCA warning at group level */}
      {typeKey === 'db' && pots.some(p => (+p.cetv || +p.transfer_value || 0) > 30_000) && (
        <div style={{ marginBottom: 14 }}>
          <Chip tone="warn">PS18/6 — DB transfers above £30,000 require FCA pension-transfer specialist advice. Information only.</Chip>
        </div>
      )}
    </div>
  )
}

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────
export default function PensionDrillDown(props) {
  return (
    <DrillStackProvider>
      <PensionDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function PensionDrillDownInner({ entity, personaId, onBack, onHome }) {
  const a = entity.assets || {}
  const groups = buildPensionGroups(entity)

  // DC pot total (SIPP + SSAS + DC) for hero + liquidity ladder + analysis sections
  const dcPotTotal = [...groups.sipp, ...groups.ssas, ...groups.dc]
    .reduce((s, p) => s + (+p.value || +p.balance || +p.balance_gbp || 0), 0)
  const sippTot = dcPotTotal  // keep alias for existing analysis code

  const { aa: effectiveAA, reason: aaReason, tone: aaTone } = computeEffectiveAA(entity)
  const cfYears = carryForwardByYear(entity)
  const cfTotal = cfYears ? cfYears.reduce((s, v) => s + v, 0) : null

  const age = +(entity.individual?.age ?? entity.age ?? 0)
  const showDecumulation = age >= 55 || entity.flexibleDrawdownTriggered || entity.mpaaTriggered

  const drillStack = useDrillStackContext()

  // Active types — in canonical order, non-empty only
  const activeTypes = TYPE_ORDER.filter(k => groups[k]?.length > 0)
  const totalSchemes = activeTypes.reduce((s, k) => s + groups[k].length, 0)

  // Layer state: null = Layer 1 (drawers), string = Layer 2 (group detail)
  const [openGroup, setOpenGroup] = useState(null)

  // Back pops group first, then exits
  const shellBack = openGroup ? () => setOpenGroup(null) : onBack
  const groupLabel = openGroup ? TYPE_META[openGroup]?.label : null

  // Breakdown for DrillableNumber
  const sippBreakdown = (() => {
    const items = []
    ;[...groups.sipp, ...groups.ssas, ...groups.dc].forEach((p, i) => {
      const v = +p.value || +p.balance || +p.balance_gbp || 0
      if (v > 0) {
        items.push({
          label: `${p.provider || p.name || `Pension #${i + 1}`} — ${p.type || 'DC'}`,
          value: fmt(v),
        })
      }
    })
    return items
  })()

  return (
    <OverlayShell
      title={groupLabel ? `Pensions · ${groupLabel}` : 'Pensions · drill-down'}
      subtitle={
        openGroup ? null : (
          <DrillableNumber
            metric="Total DC pension wealth"
            value={fmt(sippTot)}
            formula={`Sum of SIPP + SSAS + Workplace DC pots. DB/State shown separately as income/entitlement, not added here.${sippBreakdown.length > 0 ? ` ${sippBreakdown.length} pot${sippBreakdown.length === 1 ? '' : 's'} totalling ${fmt(sippTot)}.` : ''}`}
            source={
              sippBreakdown.length === 0
                ? 'No DC pots recorded'
                : `Latest valuation per scheme · ${sippBreakdown.length} source${sippBreakdown.length === 1 ? '' : 's'}`
            }
            confidence={sippBreakdown.length > 0 ? 'high' : 'low'}
            breakdown={sippBreakdown}
            onDrill={drillStack.pushNumber}
          />
        )
      }
      onBack={shellBack}
      onHome={onHome}
    >
      <div style={{ padding: '16px 16px 40px' }}>

        {/* ── LAYER 2 — type group detail ──────────────────────────────── */}
        {openGroup && (
          <GroupDetail
            typeKey={openGroup}
            pots={groups[openGroup]}
            entity={entity}
            personaId={personaId}
            onHome={onHome}
            onBack={() => setOpenGroup(null)}
          />
        )}

        {/* ── LAYER 1 — type drawers ───────────────────────────────────── */}
        {!openGroup && (
          <>
            <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 12 }}>
              Where your future income comes from — {totalSchemes} scheme{totalSchemes !== 1 ? 's' : ''}, {activeTypes.length} type{activeTypes.length !== 1 ? 's' : ''}. Tap a type to go deeper.
            </div>

            {/* Summary tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <Tile label="DC pot total" value={fmt(dcPotTotal)} tone="good" sub="SIPP + SSAS + Workplace DC" />
              <Tile label="Schemes" value={`${totalSchemes}`} sub={`across ${activeTypes.length} type${activeTypes.length !== 1 ? 's' : ''}`} />
            </div>

            {/* Type drawers — one per active type */}
            {activeTypes.map(k => (
              <TypeDrawer
                key={k}
                typeKey={k}
                pots={groups[k]}
                onOpen={() => setOpenGroup(k)}
              />
            ))}

            {/* ── Analysis sections below the drawers ─────────────────── */}

            {/* LSA / LSDBA usage */}
            {(() => {
              const lsaCap = TAX?.lsa ?? 268_275
              const lsdbaCap = TAX?.lsdba ?? 1_073_100
              const lsaUsed = +(entity.pension?.lsaUsed || entity.pension?.lump_sum_allowance_used || 0)
              const lsdbaUsed = +(entity.pension?.lsdbaUsed || entity.pension?.lump_sum_death_benefit_allowance_used || 0)
              const lsaPct = Math.min(100, (lsaUsed / lsaCap) * 100)
              const lsdbaPct = Math.min(100, (lsdbaUsed / lsdbaCap) * 100)
              const none = lsaUsed === 0 && lsdbaUsed === 0
              return (
                <Section title="LSA / LSDBA usage">
                  {none ? (
                    <Chip tone="neutral">No tax-free cash crystallisation events recorded</Chip>
                  ) : (
                    <div style={{
                      padding: 14, background: 'var(--card-bg2)',
                      border: '1px solid var(--c-border)', borderRadius: 14,
                    }}>
                      {[
                        { lbl: 'LSA', used: lsaUsed, cap: lsaCap, pct: lsaPct },
                        { lbl: 'LSDBA', used: lsdbaUsed, cap: lsdbaCap, pct: lsdbaPct },
                      ].map((row) => (
                        <div key={row.lbl} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                              {row.lbl} — {fmt(row.used)} / {fmt(row.cap)}
                            </div>
                            <Chip tone={row.pct > 80 ? 'warn' : 'neutral'}>{Math.round(row.pct)}% used</Chip>
                          </div>
                          <div style={{ height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                            <div style={{ width: `${row.pct}%`, height: '100%', background: row.pct > 80 ? '#FF9500' : 'var(--c-acc)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.4 }}>
                    Lump Sum Allowance (LSA) £{(TAX?.lsa ?? 268_275).toLocaleString()} and Lump Sum &amp; Death Benefit Allowance (LSDBA) £{(TAX?.lsdba ?? 1_073_100).toLocaleString()}. Pensions Schemes Act 2023.
                  </div>
                </Section>
              )
            })()}

            {/* Monte Carlo POS */}
            {(() => {
              let pos = entity.trajectories?.monteCarloPOS
              if (pos == null) {
                try {
                  const res = monteCarloPOS(entity, { annual: (pensionTotal(entity) * 0.04) }, { terminalAge: ((+(entity?.age ?? entity?.individual?.age) || 65) + 30) })
                  pos = res?.probability
                } catch { pos = null }
              }
              if (pos == null || !Number.isFinite(+pos)) return null
              const v = +pos > 1 ? +pos : +pos * 100
              if (!Number.isFinite(v) || v <= 0) return null
              const clamped = Math.min(100, Math.round(v))
              const color = clamped >= 85 ? 'var(--c-acc)' : clamped >= 70 ? '#FF9500' : 'var(--c-coral,#FF6F7D)'
              return (
                <Section title="Drawdown sustainability (Monte Carlo)"
                  sub="Probability of success over 30-year horizon at 4% withdrawal. DC pots only.">
                  <div style={{
                    padding: 14, background: 'var(--card-bg2)',
                    border: '1px solid var(--c-border)', borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                      {`${clamped}%`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
                      Modelling, not advice. Past performance is not a guarantee of future results.
                    </div>
                  </div>
                </Section>
              )
            })()}

            {/* Annual allowance */}
            <Section
              title="Annual allowance — what you can pay in this year"
              sub="Yearly cap on pension contributions attracting tax relief. MPAA (£10,000) triggered by flexi-access drawdown. Tapered AA applies if threshold income >£200,000 AND adjusted income >£260,000, reducing by £1 per £2 above £260,000 to a floor of £10,000 (at £360,000+)."
            >
              <div style={{
                padding: 14, background: 'var(--card-bg2)',
                border: '1px solid var(--c-border)', borderRadius: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                    Effective AA
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(effectiveAA)}
                  </div>
                </div>
                <div style={{
                  height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden', marginBottom: 8,
                }}>
                  <div style={{
                    width: `${Math.min(100, (effectiveAA / (TAX?.pensionAA ?? 60_000)) * 100)}%`,
                    height: '100%',
                    background: aaTone === 'warn' ? '#FF9500' : 'var(--c-acc)',
                  }} />
                </div>
                <Chip tone={aaTone}>{aaReason}</Chip>
              </div>
            </Section>

            {/* Carry forward */}
            <Section
              title="Carry forward — unused allowance from prior 3 years"
              sub="Unused annual allowance from the last three tax years can be carried forward, provided the current-year AA has been used first and the scheme was open in each year."
            >
              {cfYears ? (
                <div style={{
                  padding: 14, background: 'var(--card-bg2)',
                  border: '1px solid var(--c-border)', borderRadius: 14,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {['Year −3', 'Year −2', 'Year −1'].map((lbl, i) => {
                      const v = cfYears[i] || 0
                      const pct = Math.min(100, (v / (TAX?.pensionAA ?? 60_000)) * 100)
                      return (
                        <div key={lbl}>
                          <div style={{ fontSize: 10, color: 'var(--c-text3)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                            {lbl}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
                            {fmt(v)}
                          </div>
                          <div style={{ height: 6, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--c-acc)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {cfTotal != null && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-sep)' }}>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
                        Total carry-forward room: <strong style={{ color: 'var(--c-text)' }}>{fmt(cfTotal)}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.5 }}>
                        Higher-rate relief if used: <strong style={{ color: 'var(--c-acc)' }}>{fmt(Math.round(cfTotal * 0.40))}</strong> · additional-rate relief: <strong style={{ color: 'var(--c-text)' }}>{fmt(Math.round(cfTotal * 0.45))}</strong>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4, fontStyle: 'italic' }}>
                        Window closes on each 5 April — earliest year drops off first.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px', background: 'var(--card-bg2)',
                  border: '1px dashed var(--c-border)', borderRadius: 14,
                  fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5,
                }}>
                  Per-year breakdown not recorded — see carry-forward section in Tax &amp; Allowances.
                </div>
              )}
            </Section>

            {/* Decumulation */}
            {showDecumulation && (
              <Section
                title="Decumulation methods — comparison"
                sub={`Access from age ${TAX?.nmpa ?? 55} (rising to 57 from April 2028 — ENACTED). Information only.`}
              >
                <div style={{
                  padding: 14, background: 'var(--card-bg2)',
                  border: '1px solid var(--c-border)', borderRadius: 14,
                  fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6,
                }}>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: 'var(--c-text)' }}>UFPLS</strong> — each withdrawal is 25% tax-free + 75% taxable at marginal rate. Pot remains invested until drawn.
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: 'var(--c-text)' }}>FAD (Flexi-Access Drawdown)</strong> — take full 25% PCLS upfront (within LSA £{(TAX?.lsa ?? 268_275).toLocaleString()}), remaining pot stays invested, drawdown taxed as income. Triggers MPAA.
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: 'var(--c-text)' }}>Annuity</strong> — exchange pot for guaranteed lifetime income. Irreversible. Level or escalating; single or joint life; with or without guarantee period.
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                    Each has different tax, IHT, and longevity implications. Full comparison in the Cashflow tab. DB and State Pension already deliver guaranteed income — these methods apply to DC pots only.
                  </div>
                </div>
              </Section>
            )}

            {/* IHT from April 2027 */}
            <Section
              title="Pensions and inheritance tax from April 2027"
              sub="Finance Act 2026 received Royal Assent 18 March 2026. Effective for deaths on or after 6 April 2027."
            >
              <div style={{
                padding: 14, background: 'var(--card-bg2)',
                border: '1px solid var(--c-border)', borderRadius: 14,
                fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6,
              }}>
                From 6 April 2027, most unused DC pension funds and pension death benefits will count toward your estate for IHT purposes. This applies to SIPP, SSAS, and Workplace DC pots. DB scheme death benefits depend on scheme rules. State Pension dies with you (no transfer to estate). Review your nomination forms — they will matter more once pensions enter the estate.
              </div>
            </Section>

            {/* Liquidity ladder */}
            <Section title="Liquidity ladder">
              <LiquidityLadder
                tiers={[
                  { label: 'Hours', items: [] },
                  { label: 'Days', items: [{ name: 'Cash · Immediate', value: 0 }] },
                  { label: 'Weeks', items: [{ name: 'ISA · penalty-free', value: 0 }] },
                  { label: 'Months', items: [{ name: 'GIA · T+2 settlement', value: 0 }, { name: 'Property · months', value: 0 }] },
                  { label: 'Years', items: [{ name: 'DC Pension · age 55+', value: dcPotTotal }] },
                ]}
                ariaLabel="Pension liquidity ladder — DC pots sit in the Years tier; DB/State deliver income directly"
              />
            </Section>
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
    </OverlayShell>
  )
}
