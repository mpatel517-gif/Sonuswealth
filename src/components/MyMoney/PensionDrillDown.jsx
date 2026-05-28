// ─────────────────────────────────────────────────────────────────────────────
// PensionDrillDown — standalone pension drill panel.
//
// This file scopes the three IFA-audit additions cleanly so they can be
// composed into MyMoney without bloating the inline component:
//   3a. Effective AA — respects MPAA and tapered AA (IFA MED-19)
//   3b. Carry-forward per-year breakdown over the last 3 years (IFA MED-20)
//   3c. Decumulation methods comparison — UFPLS · FAD · Annuity (IFA HIGH-10)
//
// FCA stance: information / guidance / storage only. No imperative verbs.
// ─────────────────────────────────────────────────────────────────────────────
import OverlayShell from '../shared/OverlayShell.jsx'
import { BRAND } from '../../config/brand.js'
import { LiquidityLadder } from '../charts/index.js'
import { pensions as pensionTotal } from '../../engine/selectors/index.js'
import { monteCarloPOS } from '../../engine/scenarios.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

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

// ── 3a. Effective AA — MPAA + taper aware. Returns numeric limit + reason. ──
function computeEffectiveAA(entity) {
  if (entity.flexibleDrawdownTriggered || entity.mpaaTriggered) {
    return { aa: 10_000, reason: 'MPAA active', tone: 'warn' }
  }
  const adjInc = +(entity.adjustedIncome
    ?? entity.income?.adjustedIncome
    ?? entity.income?.adjusted_income
    ?? 0)
  if (adjInc > 260_000) {
    const tapered = Math.max(10_000, 60_000 - (adjInc - 260_000) / 2)
    return { aa: tapered, reason: 'Tapered AA', tone: 'warn' }
  }
  return { aa: 60_000, reason: 'Standard AA', tone: 'good' }
}

// ── 3b. Carry-forward per-year breakdown ──────────────────────────────────
function carryForwardByYear(entity) {
  const raw = entity.income?.allowance_use?.carry_forward_by_year
  if (!raw || typeof raw !== 'object') return null
  // Expected shape: { 'y-3': number, 'y-2': number, 'y-1': number } OR an
  // array of three numbers ordered oldest → newest.
  if (Array.isArray(raw) && raw.length >= 3) {
    return [+raw[0] || 0, +raw[1] || 0, +raw[2] || 0]
  }
  const y3 = raw['y-3'] ?? raw.year_minus_3 ?? raw['-3']
  const y2 = raw['y-2'] ?? raw.year_minus_2 ?? raw['-2']
  const y1 = raw['y-1'] ?? raw.year_minus_1 ?? raw['-1']
  if (y3 == null && y2 == null && y1 == null) return null
  return [+y3 || 0, +y2 || 0, +y1 || 0]
}

export default function PensionDrillDown({ entity, onBack, onHome }) {
  const a = entity.assets || {}
  const sippTot = (+(a.sipp?.total || 0))
    + (a.pensions || []).reduce((s, p) => s + +(p.balance_gbp || p.balance || p.cetv || p.value || 0), 0)

  const { aa: effectiveAA, reason: aaReason, tone: aaTone } = computeEffectiveAA(entity)
  const cfYears = carryForwardByYear(entity)
  const cfTotal = cfYears ? cfYears.reduce((s, v) => s + v, 0) : null

  const age = +(entity.individual?.age ?? entity.age ?? 0)
  const showDecumulation = age >= 55 || entity.flexibleDrawdownTriggered || entity.mpaaTriggered

  return (
    <OverlayShell title="Pensions · drill-down"
      subtitle={fmt(sippTot)}
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Distinctive subtitle (v0.3 delta 1) */}
        <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10 }}>
          Where your future income comes from
        </div>

        {/* ── v0.3 delta 2. LSA / LSDBA top-promotion ─────────────────── */}
        {(() => {
          const lsaCap = 268_275
          const lsdbaCap = 1_073_100
          const lsaUsed = +(entity.pension?.lsaUsed || 0)
          const lsdbaUsed = +(entity.pension?.lsdbaUsed || 0)
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
                Lump Sum Allowance (LSA) £268,275 and Lump Sum &amp; Death Benefit Allowance (LSDBA) £1,073,100. Pensions Schemes Act 2023.
              </div>
            </Section>
          )
        })()}

        {/* ── v0.3 delta 3. Monte Carlo POS ──────────────────────────── */}
        {(() => {
          let pos = entity.trajectories?.monteCarloPOS
          if (pos == null) {
            try {
              const res = monteCarloPOS(entity, { annual: (pensionTotal(entity) * 0.04) }, { terminalAge: ((+(entity?.age ?? entity?.individual?.age) || 65) + 30) })
              pos = res?.probability
            } catch {
              pos = null
            }
          }
          if (pos == null || !Number.isFinite(+pos)) return null
          const v = +pos
          const color = v >= 85 ? 'var(--c-acc)' : v >= 70 ? '#FF9500' : 'var(--c-coral, #FF6F7D)'
          return (
            <Section title="Drawdown sustainability (Monte Carlo)"
              sub="Probability of success over 30-year horizon. Bengen 4% comparator.">
              <div style={{
                padding: 14, background: 'var(--card-bg2)',
                border: '1px solid var(--c-border)', borderRadius: 14,
              }}>
                <div style={{ fontSize: 36, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                  {`${Math.round(v)}%`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
                  Past performance is not a guarantee. Modelling, not advice.
                </div>
              </div>
            </Section>
          )
        })()}

        {/* ── v0.3 delta 4. DB CETV PS18/6 advisory ─────────────────── */}
        {(entity.pension?.dbSchemes || []).some((s) => +(s?.cetv || 0) > 30_000) && (
          <div style={{ marginBottom: 18 }}>
            <Chip tone="warn">FCA PS18/6 — Defined Benefit transfers above £30,000 require regulated advice. We don&apos;t transact transfers. Information only.</Chip>
          </div>
        )}

        {/* ── 3a. Effective AA bar + modifier chip ─────────────────────── */}
        <Section title="Annual allowance — what you can pay in this year"
          sub="The yearly cap on pension contributions that attract tax relief. Two modifiers can reduce it: MPAA (triggered once flexible drawdown income is taken from a personal pension) and the taper (adjusted income above £260,000).">
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
                width: `${Math.min(100, (effectiveAA / 60_000) * 100)}%`,
                height: '100%',
                background: aaTone === 'warn' ? '#FF9500' : 'var(--c-acc)',
              }} />
            </div>
            <Chip tone={aaTone}>{aaReason}</Chip>
          </div>
        </Section>

        {/* ── 3b. Carry-forward per-year breakdown ─────────────────────── */}
        <Section title="Carry forward — unused allowance from prior 3 years"
          sub="Unused annual allowance from the last three tax years can be carried forward provided the current-year AA has been used first and the scheme was open in each year.">
          {cfYears ? (
            <div style={{
              padding: 14, background: 'var(--card-bg2)',
              border: '1px solid var(--c-border)', borderRadius: 14,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {['Year −3', 'Year −2', 'Year −1'].map((lbl, i) => {
                  const v = cfYears[i] || 0
                  const pct = Math.min(100, (v / 60_000) * 100)
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
                  {/* P13-4 (2026-05-28, IFA must-fix #4): surface the £-of-relief
                      number. A higher-rate taxpayer claiming the full carry-forward
                      saves cfTotal × 40% in income tax. This is the headline number
                      an IFA would put first — was hidden behind "room available". */}
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4, lineHeight: 1.5 }}>
                    Higher-rate relief if used: <strong style={{ color: 'var(--c-acc)' }}>{fmt(Math.round(cfTotal * 0.40))}</strong> · additional-rate relief: <strong style={{ color: 'var(--c-text)' }}>{fmt(Math.round(cfTotal * 0.45))}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4, fontStyle: 'italic' }}>
                    Window closes on each 5 April — earliest year drops off first. Schemes-member rule applies in each of the 3 years.
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

        {/* ── v0.3 delta 5. Three orders of decumulation explainer ───── */}
        {showDecumulation && (
          <div className="sw-eyebrow" style={{ fontStyle: 'italic', color: 'var(--c-text3)', marginBottom: 10, fontSize: 12, lineHeight: 1.5 }}>
            Three orders of decumulation: Order 1 — tax-free cash + crystallise. Order 2 — flexi-access drawdown. Order 3 — secured income (annuity / scheme pension).
          </div>
        )}

        {/* ── 3c. Decumulation methods comparison (information only) ──── */}
        {showDecumulation && (
          <Section title="Decumulation methods — comparison"
            sub="Information only. Three routes to take income from a pension after age 55 (57 from 2028).">
            <div style={{
              padding: 14, background: 'var(--card-bg2)',
              border: '1px solid var(--c-border)', borderRadius: 14,
              fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6,
            }}>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--c-text)' }}>UFPLS</strong> — each withdrawal is 25% tax-free + 75% taxable at marginal rate. Pot remains invested until drawn.
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--c-text)' }}>FAD (Flexi-Access Drawdown)</strong> — take full 25% PCLS upfront, remaining pot stays invested, drawdown taxed as income.
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong style={{ color: 'var(--c-text)' }}>Annuity</strong> — exchange pot for guaranteed lifetime income. Irreversible. Level or escalating; single or joint life; with or without guarantee period.
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
                Each has different tax, IHT, and longevity implications. Full comparison in the Cashflow tab.
              </div>
            </div>
          </Section>
        )}

        {/* ── v0.3 delta 6. Liquidity ladder (pension highlighted) ───── */}
        <Section title="Liquidity ladder">
          <LiquidityLadder
            tiers={[
              { label: 'Hours', items: [] },
              { label: 'Days', items: [{ name: 'Cash · Immediate', value: 0 }] },
              { label: 'Weeks', items: [{ name: 'ISA · penalty-free', value: 0 }] },
              { label: 'Months', items: [{ name: 'GIA · T+2 settlement', value: 0 }, { name: 'Property · months', value: 0 }] },
              { label: 'Years', items: [{ name: 'Pension · 55+ access', value: pensionTotal(entity) }] },
            ]}
            ariaLabel="Pension liquidity ladder — pension sits in the Years tier"
          />
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
    </OverlayShell>
  )
}
