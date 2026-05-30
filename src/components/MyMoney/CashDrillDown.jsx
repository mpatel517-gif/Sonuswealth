// ─────────────────────────────────────────────────────────────────────────────
// CashDrillDown — drill-down for the Cash category tile (Domain B).
//
// Information-only. No advice verbs. Mechanical descriptions of what the
// numbers mean for tax, FSCS protection, and emergency cover.
//
// Sections:
//   1. Tax-treatment block (CASH wrapper) — IT marginal · CGT n/a · IHT estate
//   2. Account-by-account breakdown with FSCS per-institution flag
//   3. Tax bite on savings interest (PSA + marginal rate)
//   4. Emergency cover (months of essentials)
//   5. ISA room vs Cash
//   6. Wrapper mechanics teaser (Cash ISA / Premium Bonds / NS&I)
//
// Defensive read of both schemas: assets.bank[] (canonical) and the legacy
// assets.cash { total, own, easyAccess } scalar shape.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import OverlayShell from '../shared/OverlayShell.jsx'
import TaxTreatmentBlock from './TaxTreatmentBlock.jsx'
import { DrillStackProvider, useDrillStackContext } from './L3/DrillStack.jsx'
import { DrillableNumber } from './L3/DrillableNumber.jsx'
import AssetDetailOverlay from './AssetDetailOverlay.jsx'
import { SharedBullet, LiquidityLadder } from '../charts/index.js'
// S1 selector migration (Phase 2)
import {
  cash as cashTotal,
  monthlyEssentials as getMonthlyEssentials,
  annualIncome,
} from '../../engine/selectors/index.js'
import { runwayWithDrawdown } from '../../engine/_helpers.js'
import { BRAND } from '../../config/brand.js'
import { TAX } from '../../engine/fq-calculator.js'

function fmt(v) {
  const n = Math.round(+v || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '−' : ''}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000)     return `${n < 0 ? '−' : ''}£${(abs / 1_000).toFixed(0)}k`
  return `${n < 0 ? '−' : ''}£${abs.toLocaleString()}`
}

function pct(v) { return `${Math.round((+v || 0) * 100)}%` }

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

function Tile({ label, value, sub, tone = 'neutral' }) {
  const fg = tone === 'good' ? 'var(--c-acc)'
    : tone === 'warn' ? '#FF9500'
    : tone === 'bad' ? 'var(--c-coral, #FF6F7D)'
    : 'var(--c-text)'
  return (
    <div className="sw-card" style={{
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

function Chip({ children, tone = 'neutral' }) {
  const bg = tone === 'good' ? 'color-mix(in srgb, var(--c-acc) 14%, transparent)'
    : tone === 'warn' ? 'color-mix(in srgb, #FF9500 14%, transparent)'
    : tone === 'bad' ? 'color-mix(in srgb, var(--c-coral, #FF6F7D) 14%, transparent)'
    : 'var(--c-surface2)'
  const fg = tone === 'good' ? 'var(--c-acc)'
    : tone === 'warn' ? '#FF9500'
    : tone === 'bad' ? 'var(--c-coral, #FF6F7D)'
    : 'var(--c-text2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100, background: bg, color: fg,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      border: `1px solid color-mix(in srgb, ${fg} 30%, transparent)`,
    }}>{children}</span>
  )
}

function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      marginTop: 10, background: 'var(--card-bg2)',
      border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden',
    }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          background: 'transparent', border: 'none', color: 'var(--c-text)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontSize: 12, fontWeight: 700,
        }}>
        <span>{title}</span>
        <span style={{ fontSize: 14, color: 'var(--c-text3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div style={{
          padding: '0 14px 12px', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Marginal rate (inline, since canonical-metrics doesn't export it) ────────
// Mirrors fq-calculator semantics: PA → BR → HR → AR using TAX bands.
function computeMarginalRate(entity) {
  const inc = +annualIncome(entity) || 0
  const pa  = +TAX.personalAllowance || 12570
  const hrt = +TAX.hrThreshold      || 50270
  const art = +TAX.additionalRateThreshold || 125140
  if (inc <= pa)  return 0
  if (inc <= hrt) return 0.20
  if (inc <= art) return 0.40
  return 0.45
}

// PSA: £1,000 basic · £500 higher · £0 additional
function computePSA(marginal) {
  if (marginal >= 0.45) return 0
  if (marginal >= 0.40) return 500
  return 1000
}

// Account type → display label
const TYPE_LABEL = {
  'current-account': 'Current',
  'current':         'Current',
  'savings':         'Easy access',
  'easy-access':     'Easy access',
  'notice':          'Notice',
  'fixed-term':      'Fixed-term',
  'fixed':           'Fixed-term',
  'cash-isa':        'Cash ISA',
  'isa-cash':        'Cash ISA',
  'premium-bonds':   'Premium Bonds',
  'ns-i':            'NS&I',
}

const FSCS_LIMIT = 85_000

// Normalise both schemas into a unified [{ id, name, bank, type, balance, rate, lastValued }] list.
function readAccounts(entity) {
  const a = entity?.assets || {}
  const out = []
  if (Array.isArray(a.bank) && a.bank.length > 0) {
    for (const b of a.bank) {
      out.push({
        id: b.id || b.account_name || b.bank,
        name: b.account_name || b.bank || 'Account',
        bank: b.bank || b.provider || 'Unknown',
        type: String(b.type || '').toLowerCase(),
        balance: +(b.balance_gbp ?? b.balance ?? 0) || 0,
        rate: +(b.interest_rate ?? b.rate ?? 0) || 0,
        lastValued: b.last_valuation_date || null,
      })
    }
    return out
  }
  // Legacy flat shape
  if (a.cash && typeof a.cash === 'object') {
    const c = a.cash
    if (c.total != null || c.own != null) {
      out.push({
        id: 'cash-aggregate',
        name: 'Cash (aggregated)',
        bank: '—',
        type: 'savings',
        balance: +(c.total ?? c.own ?? 0) || 0,
        rate: +(c.rate ?? 0) || 0,
        lastValued: null,
      })
    }
    if (c.current != null)      out.push({ id: 'cash-current', name: 'Current', bank: '—', type: 'current', balance: +c.current, rate: 0, lastValued: null })
    if (c.easyAccess != null)   out.push({ id: 'cash-ea',      name: 'Easy access', bank: '—', type: 'savings', balance: +c.easyAccess, rate: +(c.rate || 0), lastValued: null })
  }
  return out
}

// L3-1b (2026-05-28): DrillStack wrapper per README pattern.
export default function CashDrillDown(props) {
  return (
    <DrillStackProvider>
      <CashDrillDownInner {...props} />
    </DrillStackProvider>
  )
}

function CashDrillDownInner({ entity, personaId, onBack, onHome }) {
  const drillStack = useDrillStackContext()
  const [selected, setSelected] = useState(null)  // per-account leaf drill
  const accounts = readAccounts(entity)
  const totalCash = cashTotal(entity) || accounts.reduce((s, x) => s + x.balance, 0)

  // Tax on interest
  const marginal = computeMarginalRate(entity)
  const psa = computePSA(marginal)
  const fallbackRate = 0.04 // canonical-metrics cashInterestRate assumption
  const totalInterest = accounts.reduce((s, a) => {
    const r = a.rate > 0 ? a.rate : fallbackRate
    return s + (a.balance * r)
  }, 0)
  const taxableInterest = Math.max(0, totalInterest - psa)
  const taxBite = taxableInterest * marginal

  // Emergency cover
  const essObj = getMonthlyEssentials(entity)
  const monthlyEss = +(essObj && essObj.monthly) || 0
  const monthsCovered = monthlyEss > 0 ? totalCash / monthlyEss : null

  // Runway with drawdown (v0.3 delta — uses canonical helper at 60mo horizon).
  let runway = null
  try {
    runway = runwayWithDrawdown(entity, 60)
  } catch (_e) {
    // helper unavailable in some persona shapes — fall back to legacy months calc
    runway = monthsCovered != null
      ? { months: monthsCovered, cash: totalCash, essentialsMonthly: monthlyEss, isDecum: false }
      : null
  }

  // ISA room (read current-year ISA usage from investments[] if present)
  const inv = entity?.assets?.investments || []
  const isaUsed = inv
    .filter(i => String(i.wrapper || i.type || '').toUpperCase().includes('ISA'))
    .reduce((s, i) => s + (+i.contribution_current_tax_year || 0), 0)
  const isaAllowance = +TAX.isaAllowance || 20000
  const isaRoom = Math.max(0, isaAllowance - isaUsed)

  // FSCS aggregation per institution
  const byBank = accounts.reduce((acc, a) => {
    const key = a.bank || 'Unknown'
    acc[key] = (acc[key] || 0) + a.balance
    return acc
  }, {})
  const anyOverFSCS = Object.values(byBank).some(v => v > FSCS_LIMIT)

  return (
    <OverlayShell title="Cash · drill-down"
      subtitle={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          <DrillableNumber
            metric="Total cash"
            value={fmt(totalCash)}
            formula={`Sum of every cash account on file. ${accounts.length} account${accounts.length === 1 ? '' : 's'} totalling ${fmt(totalCash)}.`}
            source={accounts.length === 0 ? 'No cash accounts recorded' : `${accounts.length} account${accounts.length === 1 ? '' : 's'} on file`}
            confidence={accounts.length > 0 ? 'high' : 'low'}
            breakdown={accounts.map((a, i) => ({
              label: a.provider || a.name || `Account #${i + 1}`,
              value: fmt(+(a.balance ?? 0)),
            }))}
            onDrill={drillStack.pushNumber}
          />
          <span style={{ fontSize: 13, color: 'var(--c-text3)' }}>· {accounts.length} account{accounts.length === 1 ? '' : 's'}</span>
        </span>
      }
      onBack={onBack} onHome={onHome}>
      <div style={{ padding: '16px 16px 40px' }}>

        {/* Distinctive subtitle — v0.3 spec eyebrow */}
        <div
          className="sw-eyebrow"
          style={{
            fontStyle: 'italic',
            marginBottom: 14,
            color: 'var(--c-text2)',
            letterSpacing: 0.4,
          }}
        >
          Your cash safety net and how long it lasts
        </div>

        {/* Section 0 — Runway via shared bullet */}
        <Section title="Runway — how long cash lasts"
          sub="Cash on hand vs months of essential spending it covers. Adds planned drawdown over the next 60 months for decumulation personas.">
          {runway && Number.isFinite(runway.months) ? (
            <SharedBullet
              label="Months of essentials covered"
              current={runway.months}
              target={6}
              suffix="months"
              ariaLabel={`Cash ${fmt(runway.cash || totalCash)} covers ${runway.months.toFixed(1)} months of essentials. Target: 6 months.`}
              expansion={
                <>
                  Cash {fmt(runway.cash || totalCash)} ÷ essentials {fmt(runway.essentialsMonthly || monthlyEss)}/month
                  {runway.isDecum && runway.plannedDrawdownOverHorizon
                    ? ` + planned drawdown ${fmt(runway.plannedDrawdownOverHorizon)} over 60 months`
                    : ''}
                  {' '}= {runway.months.toFixed(1)} months.
                </>
              }
            />
          ) : (
            <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              Monthly essentials not captured yet — runway cannot be expressed in months.
            </div>
          )}
        </Section>

        {/* Section 1 — Tax treatment (information only) */}
        <Section title="1 · Tax treatment of cash savings"
          sub="Three taxes, mechanical view. No advice — just how HMRC treats balances and interest on UK cash accounts.">
          <TaxTreatmentBlock wrapper="CASH" />
        </Section>

        {/* Section 2 — Account-by-account */}
        <Section title="2 · Accounts" sub="FSCS protects up to £85,000 per person, per banking-licence institution. Multiple accounts at the same licence are pooled.">
          {/* v0.3 FSCS info chip — verbatim copy */}
          <div
            style={{
              marginBottom: 10,
              padding: '8px 12px',
              background: 'color-mix(in srgb, var(--c-acc) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-acc) 30%, transparent)',
              borderRadius: 12,
              fontSize: 11,
              color: 'var(--c-text2)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>FSCS protection</span>
            {' — first £85,000 per banking licence (£170,000 joint accounts). Multiple accounts at same bank share one licence cap.'}
          </div>
          <div style={{ background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {accounts.map((a, i) => {
              const aggregate = byBank[a.bank] || a.balance
              const overFSCS = aggregate > FSCS_LIMIT
              const typeLabel = TYPE_LABEL[a.type] || 'Cash'
              const rate = a.rate > 0 ? a.rate : null
              const interest = a.balance * (rate || fallbackRate)
              const borderTone = overFSCS ? 'var(--c-coral, #FF6F7D)' : 'transparent'
              return (
                <div key={a.id || i} style={{
                  padding: '12px 14px',
                  borderBottom: i < accounts.length - 1 ? '1px solid var(--c-sep)' : 'none',
                  borderLeft: `3px solid ${borderTone}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => setSelected(a)}
                        className="sw-press"
                        style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
                          cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--c-text)',
                          display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {a.name} <span style={{ color: 'var(--c-text3)', fontWeight: 500 }}>›</span>
                      </button>
                      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                        {a.bank} · {typeLabel}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(a.balance)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rate != null
                      ? <Chip tone="neutral">Rate {pct(rate)}</Chip>
                      : <Chip tone="warn">Rate unknown — {pct(fallbackRate)} assumed</Chip>}
                    <Chip tone="neutral">Interest {fmt(interest)}/yr</Chip>
                    {overFSCS
                      ? <Chip tone="bad">Above £85k FSCS limit at this institution — concentration risk</Chip>
                      : <Chip tone="good">FSCS-protected up to £85,000 per institution</Chip>}
                  </div>
                </div>
              )
            })}
            {accounts.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--c-text3)', textAlign: 'center', fontStyle: 'italic' }}>
                No cash accounts captured yet.
              </div>
            )}
          </div>
          {anyOverFSCS && (
            <Disclosure title="What FSCS protection actually covers">
              The Financial Services Compensation Scheme protects deposits up to £85,000 per eligible person, per banking-licence institution (not per account or per brand — some brands share a licence). Balances above that cap at the same licence are uncompensated if the bank fails. Joint accounts get £170,000 cover. Temporary high balances (e.g. house sale proceeds) carry a separate £1m limit for 6 months.
            </Disclosure>
          )}
        </Section>

        {/* Section 3 — Tax bite on savings interest */}
        <Section title="3 · Tax on savings interest"
          sub={`Personal Savings Allowance shields the first £${psa.toLocaleString()} of interest at this marginal rate (${pct(marginal)}). Cash ISA interest does not count toward PSA.`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Tile label="Interest this year" value={fmt(totalInterest)} sub="Across all accounts" />
            <Tile label="PSA available" value={fmt(psa)} sub={`At ${pct(marginal)} marginal rate`} />
            <Tile label="Taxable" value={fmt(taxableInterest)} tone={taxableInterest > 0 ? 'warn' : 'neutral'} />
            <Tile label="Tax bite" value={fmt(taxBite)} tone={taxBite > 0 ? 'bad' : 'good'} sub={`${pct(marginal)} × taxable interest`} />
          </div>
          {taxBite > 0 && (
            <div style={{ marginTop: 8 }}>
              <Chip tone="bad">{fmt(taxBite)}/yr lost to tax on savings interest</Chip>
            </div>
          )}
          <Disclosure title="How PSA interacts with marginal rate">
            Personal Savings Allowance: £1,000 of savings interest tax-free at basic rate, £500 at higher rate, £0 at additional rate. Starting Rate for Savings adds up to £5,000 more tax-free interest if non-savings income is below the personal allowance + £5k. Interest above PSA is taxed at the saver's marginal income-tax rate. ISA-wrapped cash sits entirely outside this regime.
          </Disclosure>
        </Section>

        {/* Section 4 — Emergency cover */}
        <Section title="4 · Emergency cover" sub="Months of essential spending covered by cash on hand. Common rule-of-thumb is 3–6 months; mechanical reading only.">
          {monthsCovered != null ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                <Tile label="Months covered" value={monthsCovered.toFixed(1)}
                  tone={monthsCovered >= 6 ? 'good' : monthsCovered >= 3 ? 'neutral' : 'warn'} />
                <Tile label="Monthly essentials" value={fmt(monthlyEss)} sub="From cashflow engine" />
                <Tile label="Rule-of-thumb" value="3–6 months" sub="Information only" />
              </div>
              <div style={{ height: 8, borderRadius: 100, background: 'var(--c-surface2)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (monthsCovered / 6) * 100)}%`,
                  height: '100%',
                  background: monthsCovered >= 6 ? 'var(--c-acc)' : monthsCovered >= 3 ? '#FF9500' : 'var(--c-coral, #FF6F7D)',
                  boxShadow: monthsCovered >= 6 ? '0 0 8px var(--c-acc)' : 'none',
                }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--c-text3)', fontStyle: 'italic' }}>
              Monthly essentials not captured yet — emergency cover cannot be expressed in months.
            </div>
          )}
        </Section>

        {/* Section 5 — ISA room vs cash */}
        {isaRoom > 0 && (
          <Section title="5 · ISA room this tax year"
            sub={`£${isaAllowance.toLocaleString()} ISA allowance is per person per tax year. Unused room does not roll over.`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Tile label="ISA used" value={fmt(isaUsed)} sub={`of ${fmt(isaAllowance)}`} />
              <Tile label="ISA room" value={fmt(isaRoom)} tone="good" sub="Available — Cash ISA or S&S ISA" />
            </div>
          </Section>
        )}

        {/* Section 6 — Wrapper mechanics teaser */}
        <Section title="6 · Wrapper mechanics" sub="Mechanical comparison only. Each wrapper has different tax treatment, access rules, and protection.">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="sw-card" style={{ padding: 12, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>Cash ISA</div>
              <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                Interest is free of UK income tax. Counts toward the £{isaAllowance.toLocaleString()} annual ISA cap (combined with S&S, IF, LISA). FSCS protected to £85k per institution. Withdrawal does not restore allowance unless the ISA is flexible.
              </div>
            </div>
            <div className="sw-card" style={{ padding: 12, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>Premium Bonds</div>
              <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                NS&I-issued. £50,000 holding cap per person. Prizes are tax-free. No guaranteed interest — expected prize rate is the published annual rate. 100% backed by HM Treasury (not FSCS, but equivalent protection).
              </div>
            </div>
            <div className="sw-card" style={{ padding: 12, background: 'var(--card-bg2)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>NS&I Direct Saver / Income Bonds</div>
              <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
                Interest is taxable (counts toward PSA). 100% backed by HM Treasury. No FSCS limit. Useful for balances above £85k that would otherwise breach FSCS at a single bank.
              </div>
            </div>
          </div>
        </Section>

        {/* Section 7 — Bed-and-ISA info panel (v0.3 verbatim) */}
        <Section title="Bed-and-ISA">
          <div
            className="sw-card"
            style={{
              padding: 12,
              background: 'var(--card-bg2)',
              border: '1px solid var(--c-border)',
              borderRadius: 14,
              fontSize: 11,
              color: 'var(--c-text2)',
              lineHeight: 1.55,
            }}
          >
            Bed-and-ISA — sell GIA shares, repurchase inside ISA. Crystallises CGT but shelters future growth. Allowed (different wrapper). 30-day rule (TCGA s106A) does not apply across wrappers.
          </div>
        </Section>

        {/* Section 8 — Liquidity ladder (R8 signature; Cash tier highlighted) */}
        <Section title="Liquidity ladder"
          sub="Where this domain sits on the access-speed spectrum. Cash is the most liquid tier.">
          <LiquidityLadder
            tiers={[
              { label: 'Hours', items: [{ name: 'Cash', value: totalCash }] },
              { label: 'Days', items: [{ name: 'ISA', value: 0 }] },
              { label: 'Weeks', items: [{ name: 'GIA', value: 0 }] },
              { label: 'Months', items: [{ name: 'Pension', value: 0 }] },
              { label: 'Years', items: [{ name: 'Property', value: 0 }] },
            ]}
            ariaLabel={`Liquidity ladder — Cash tier highlighted at ${fmt(totalCash)}. ISA, GIA, Pension, Property shown for context.`}
          />
        </Section>

        <p style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 16, lineHeight: 1.5 }}>
          {BRAND.disclaimer}
        </p>
      </div>
      {selected && (
        <AssetDetailOverlay
          asset={selected}
          domain="cash"
          category="cash"
          itemType={(selected.type || 'CURRENT').toUpperCase()}
          personaId={personaId}
          onBack={() => setSelected(null)}
          onHome={onHome}
        />
      )}
    </OverlayShell>
  )
}
