/**
 * src/screens/MagicShowcase.jsx — Demo-day WOW page.
 *
 * Self-contained showcase accessed from a single button on Home.
 * Three sections, each demonstrating a vision piece without touching
 * the main Home/Tab layout. Safe to delete post-demo.
 *
 * Sections:
 *   1. CoI Odometer — watch the number drop as you apply actions
 *   2. Eleven Advisors — the synthesised professional brain
 *   3. £70k Drawdown — how would you reduce tax on a £70k SIPP draw?
 */

import { useState, useEffect, useRef } from 'react'

// ── Section 1: CoI Odometer ──────────────────────────────────────────────────

const COI_ACTIONS = [
  { id: 'isa',     label: 'Use £20K ISA allowance',     saving: 24_000, scoreDelta: 2,  color: '#5DDBC2' },
  { id: 'cgt',     label: 'Use £3K CGT allowance',      saving: 1_200,  scoreDelta: 1,  color: '#5DDBC2' },
  { id: 'sipp',    label: 'Pre-2027 SIPP drawdown',    saving: 340_000, scoreDelta: 31, color: '#FFD66E' },
  { id: 'trust',   label: 'Life policy in trust',       saving: 18_000, scoreDelta: 8,  color: '#5DDBC2' },
  { id: 'pets',    label: 'Gift £100K to children',     saving: 40_000, scoreDelta: 12, color: '#5DDBC2' },
]

function CoIOdometerDemo() {
  const [coi, setCoi] = useState(412_000)
  const [score, setScore] = useState(69)
  const [applied, setApplied] = useState([])
  const [pulse, setPulse] = useState(null)

  function applyAction(action) {
    if (applied.includes(action.id)) return
    setApplied(prev => [...prev, action.id])
    setPulse(action.id)
    // animate over 800ms
    const startCoi = coi
    const startScore = score
    const targetCoi = Math.max(0, startCoi - action.saving)
    const targetScore = Math.min(100, startScore + action.scoreDelta)
    const t0 = Date.now()
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / 800)
      const eased = 1 - Math.pow(1 - t, 3)
      setCoi(Math.round(startCoi + (targetCoi - startCoi) * eased))
      setScore(Math.round(startScore + (targetScore - startScore) * eased))
      if (t < 1) requestAnimationFrame(tick)
      else setTimeout(() => setPulse(null), 600)
    }
    requestAnimationFrame(tick)
  }

  function reset() {
    setCoi(412_000)
    setScore(69)
    setApplied([])
    setPulse(null)
  }

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{
        background: 'linear-gradient(160deg, var(--c-surface) 0%, var(--c-surface2) 100%)',
        border: '1px solid var(--c-sep)', borderRadius: 20, padding: '28px 24px',
        marginBottom: 24,
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>
          Cost of Inaction · Bruce Wayne · Live
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{
              fontSize: 56, fontWeight: 800, color: 'var(--c-text)', letterSpacing: -1.5,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              transition: 'color .3s', color: pulse ? '#5DDBC2' : 'var(--c-text)',
            }}>
              £{coi.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text2)', marginTop: 8 }}>
              annual cost of staying on current path
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Wealth Score</div>
            <div style={{
              fontSize: 40, fontWeight: 800, color: 'var(--c-acc)',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 4,
            }}>
              {score}<span style={{ fontSize: 18, color: 'var(--c-text3)', fontWeight: 600 }}>/100</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6 }}>
              {score >= 75 ? 'Optimised' : score >= 60 ? 'Optimising' : score >= 45 ? 'Building' : 'Foundational'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 12, lineHeight: 1.6 }}>
        Click any action below. Watch the cost drop and the score rise in real time.
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {COI_ACTIONS.map(a => {
          const isApplied = applied.includes(a.id)
          const isPulsing = pulse === a.id
          return (
            <button
              key={a.id}
              onClick={() => applyAction(a)}
              disabled={isApplied}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 16px', borderRadius: 14,
                background: isApplied ? 'rgba(93,219,194,0.10)' : 'var(--c-surface)',
                border: `1px solid ${isApplied ? a.color : 'var(--c-sep)'}`,
                cursor: isApplied ? 'default' : 'pointer',
                opacity: isApplied ? 0.7 : 1,
                fontFamily: 'inherit', textAlign: 'left',
                transition: 'all .2s',
                transform: isPulsing ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text3)' }}>
                  Saves £{a.saving.toLocaleString()}/yr · +{a.scoreDelta} Wealth Score
                </div>
              </div>
              {isApplied ? (
                <span style={{ fontSize: 18, color: a.color }}>✓</span>
              ) : (
                <span style={{
                  padding: '5px 12px', borderRadius: 100,
                  background: a.color, color: '#0B1F3A',
                  fontSize: 11, fontWeight: 800,
                }}>
                  Apply
                </span>
              )}
            </button>
          )
        })}
      </div>

      {applied.length > 0 && (
        <button
          onClick={reset}
          style={{
            width: '100%', padding: '11px', borderRadius: 100,
            background: 'transparent', border: '1px solid var(--c-sep)',
            color: 'var(--c-text2)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ↻ Reset
        </button>
      )}
    </div>
  )
}

// ── Section 2: Eleven Advisors ───────────────────────────────────────────────

const LENSES = [
  {
    id: 'tax', avatar: '🧮', name: 'Tax Accountant', tagline: 'wrappers, allowances, sequencing',
    insights: [
      { sev: 'HIGH', text: 'You are losing your personal allowance — income £150k > £125,140 taper.' },
      { sev: 'HIGH', text: 'CGT allowance £3,000 unused. You have £12,000 of realised gains.' },
      { sev: 'MED',  text: 'Pension carry-forward window — £80k available before April 2027.' },
    ],
    recs: [
      { headline: 'Phased SIPP drawdown', impact: '£340,000 lifetime' },
      { headline: 'Bed-and-ISA your GIA', impact: '£15,000/yr' },
      { headline: 'Loss harvest unrealised £2,500', impact: '£700' },
    ],
  },
  {
    id: 'pension', avatar: '🏦', name: 'Pension Specialist', tagline: 'AA, MPAA, LSA, drawdown',
    insights: [
      { sev: 'HIGH', text: 'You have not triggered MPAA — preserve £60k annual allowance.' },
      { sev: 'MED',  text: 'State Pension forecast £11,502/yr from age 67. NI record full.' },
      { sev: 'LOW',  text: 'Lifetime Sum Allowance headroom £198k remaining.' },
    ],
    recs: [
      { headline: 'Use carry-forward before April 2027', impact: '£32,000 tax relief' },
      { headline: 'Defer State Pension 2 years', impact: '£1,200/yr uplift' },
      { headline: 'Pension consolidation review', impact: 'Lower fees' },
    ],
  },
  {
    id: 'trust', avatar: '⚖️', name: 'Trust Lawyer', tagline: 'IHT, trusts, wills, LPA',
    insights: [
      { sev: 'HIGH', text: 'No LPA in place. Critical at age 62 — sign within 30 days.' },
      { sev: 'HIGH', text: 'Estate £3.9M; current IHT exposure £1.16M.' },
      { sev: 'MED',  text: 'April 2027 brings SIPP into estate — adds £300k–£580k exposure.' },
    ],
    recs: [
      { headline: 'Sign LPA (Property + Health)', impact: 'Capacity protection' },
      { headline: 'Discretionary trust for £325k NRB', impact: '£130k IHT saved' },
      { headline: 'Whole-of-life in trust, £1M cover', impact: 'Liquidity at death' },
    ],
  },
  {
    id: 'ifa', avatar: '📊', name: 'IFA (Holistic)', tagline: 'allocation, risk, cashflow',
    insights: [
      { sev: 'MED',  text: '78% equity allocation vs target 65% for your stage.' },
      { sev: 'MED',  text: 'Cash buffer 4 months — within target 3–6 months.' },
      { sev: 'LOW',  text: 'Annual review overdue — last 14 months ago.' },
    ],
    recs: [
      { headline: 'Rebalance to 65/35', impact: 'Vol reduction 18%' },
      { headline: 'Increase corporate-bond allocation', impact: 'Yield uplift' },
      { headline: 'Update risk profile questionnaire', impact: 'Suitability evidence' },
    ],
  },
  {
    id: 'mortgage', avatar: '🏠', name: 'Mortgage Adviser', tagline: 'BTL, remortgage, affordability',
    insights: [
      { sev: 'LOW', text: 'No mortgage on main residence — debt-free.' },
      { sev: 'LOW', text: 'No BTL portfolio — equity release available.' },
      { sev: 'LOW', text: 'Lifetime mortgage option exists but not optimal at age 62.' },
    ],
    recs: [
      { headline: 'Equity release: defer until age 70+', impact: 'Better rates' },
      { headline: 'Consider lending to children', impact: 'IHT planning' },
    ],
  },
  {
    id: 'protection', avatar: '🛡️', name: 'Insurance / Protection', tagline: 'life, IP, CI cover',
    insights: [
      { sev: 'HIGH', text: 'No life cover in place. Spouse dependent on assets only.' },
      { sev: 'MED',  text: 'No critical illness cover — gap of ~£500k.' },
      { sev: 'LOW',  text: 'Age 62 — premiums rising 12–18% per year of delay.' },
    ],
    recs: [
      { headline: 'Whole-of-life £1M in trust', impact: '£8,000/yr premium' },
      { headline: 'Critical illness top-up', impact: 'Lump-sum protection' },
    ],
  },
  {
    id: 'investment', avatar: '📈', name: 'Investment Adviser', tagline: 'portfolio, costs, rebalancing',
    insights: [
      { sev: 'MED', text: 'Portfolio TER 0.82% — above benchmark 0.45%.' },
      { sev: 'MED', text: 'Concentrated position: 14% in single stock (WayneTech).' },
      { sev: 'LOW', text: 'Cash drag £42k earning 0.5% in bank.' },
    ],
    recs: [
      { headline: 'Switch to low-cost trackers', impact: 'Save £14k/yr in fees' },
      { headline: 'Reduce single-stock concentration', impact: 'Risk reduction' },
      { headline: 'Move cash to money-market fund', impact: '4.5% vs 0.5%' },
    ],
  },
  {
    id: 'crossborder', avatar: '🌍', name: 'Cross-Border Specialist', tagline: 'SRT, FIG, DTA, deemed-dom',
    insights: [
      { sev: 'LOW', text: 'UK domicile, UK tax resident — single jurisdiction.' },
      { sev: 'LOW', text: 'No foreign assets currently.' },
      { sev: 'LOW', text: 'Statutory Residence Test — 365 UK days/year, no SRT risk.' },
    ],
    recs: [
      { headline: 'Pre-emptive: consider Portugal NHR before 2027', impact: 'Optional path' },
      { headline: 'Document SRT day-count', impact: 'Audit trail' },
    ],
  },
  {
    id: 'family', avatar: '👨‍👩‍👧', name: 'Family Law Specialist', tagline: 'divorce, cohab, prenup',
    insights: [
      { sev: 'LOW', text: 'Married 32 years — joint assets stable.' },
      { sev: 'MED', text: 'Wills last updated 7 years ago — pre-grandchildren.' },
      { sev: 'LOW', text: 'No cohab risk — formal marriage.' },
    ],
    recs: [
      { headline: 'Update wills for grandchildren', impact: 'Per-stirpes distribution' },
      { headline: 'Letter of wishes for guardians', impact: 'Clarity at death' },
    ],
  },
  {
    id: 'laterlife', avatar: '🏥', name: 'Later-Life Adviser', tagline: 'care, LA, equity release',
    insights: [
      { sev: 'MED',  text: 'Care cost projection £45k/yr (residential, 7-year average).' },
      { sev: 'MED',  text: 'Local Authority means-test threshold £23,250 — far above your assets.' },
      { sev: 'LOW',  text: 'Self-fund expected; ring-fence £315k for 7-year worst case.' },
    ],
    recs: [
      { headline: 'Ring-fence £315k for care', impact: '7-year cover' },
      { headline: 'Long-term care insurance review', impact: 'Premium quote pending' },
    ],
  },
  {
    id: 'philanthropy', avatar: '💝', name: 'Philanthropy Adviser', tagline: 'Gift Aid, charity, DAF',
    insights: [
      { sev: 'MED',  text: 'Charitable giving £12k/yr — could be Gift Aid uplifted.' },
      { sev: 'LOW',  text: 'No DAF (Donor Advised Fund) in place.' },
      { sev: 'LOW',  text: 'Charity 10% rule unmet — IHT rate stays at 40%.' },
    ],
    recs: [
      { headline: 'Claim Gift Aid £3,000/yr', impact: 'Higher-rate relief' },
      { headline: 'Will: 10% to charity → 36% IHT rate', impact: '£104k IHT saved' },
    ],
  },
]

function ElevenAdvisorsDemo({ }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.6, marginBottom: 18 }}>
        Eleven specialist perspectives on Bruce Wayne's situation. Tap any to see what that adviser would say.
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 24,
      }}>
        {LENSES.map(lens => {
          const isExpanded = expanded === lens.id
          return (
            <button
              key={lens.id}
              onClick={() => setExpanded(isExpanded ? null : lens.id)}
              style={{
                padding: '14px 12px', borderRadius: 14,
                background: isExpanded ? 'var(--c-acc)' : 'var(--c-surface)',
                border: `1px solid ${isExpanded ? 'var(--c-acc)' : 'var(--c-sep)'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'all .2s',
                transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{lens.avatar}</div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: isExpanded ? '#0B1F3A' : 'var(--c-text)',
                marginBottom: 3, lineHeight: 1.3,
              }}>
                {lens.name}
              </div>
              <div style={{
                fontSize: 10,
                color: isExpanded ? 'rgba(11,31,58,0.7)' : 'var(--c-text3)',
                lineHeight: 1.3,
              }}>
                {lens.tagline}
              </div>
            </button>
          )
        })}
      </div>

      {expanded && (() => {
        const lens = LENSES.find(l => l.id === expanded)
        return (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '20px 22px',
            animation: 'magic-fade-up .3s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 32 }}>{lens.avatar}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>{lens.name}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{lens.tagline}</div>
              </div>
            </div>

            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What I see</div>
            <div style={{ marginBottom: 16 }}>
              {lens.insights.map((o, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '8px 0',
                  borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                  fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5,
                }}>
                  <span style={{
                    flexShrink: 0, padding: '2px 7px', borderRadius: 4,
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                    background: o.sev === 'HIGH' ? 'rgba(255,111,125,0.15)' : o.sev === 'MED' ? 'rgba(255,214,110,0.15)' : 'rgba(127,140,159,0.15)',
                    color: o.sev === 'HIGH' ? 'var(--c-acc3)' : o.sev === 'MED' ? 'var(--c-gold)' : 'var(--c-text3)',
                    alignSelf: 'flex-start',
                  }}>
                    {o.sev}
                  </span>
                  <span style={{ flex: 1 }}>{o.text}</span>
                </div>
              ))}
            </div>

            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What I'd recommend</div>
            {lens.recs.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>★ {r.headline}</div>
                <div style={{
                  flexShrink: 0, padding: '3px 10px', borderRadius: 100,
                  background: 'rgba(93,219,194,0.12)',
                  border: '1px solid rgba(93,219,194,0.3)',
                  fontSize: 11, fontWeight: 700, color: 'var(--c-acc)',
                }}>
                  {r.impact}
                </div>
              </div>
            ))}

            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 10,
              background: 'var(--c-surface2)', fontSize: 11,
              color: 'var(--c-text3)', lineHeight: 1.5,
              textAlign: 'center',
            }}>
              Information only · Drawn from canonical UK rules ({lens.id}-2026.1) · Not regulated advice
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Section 3: £70k Drawdown Strategies ──────────────────────────────────────

const DRAWDOWN_STRATEGIES = [
  { rank: 1, label: 'Phased Tax-Free Cash (TFC)',           saving: 5_028, certainty: 95, why: 'Crystallise £17,500 TFC across 2 tax years rather than one lump sum. Keeps marginal rate at 20%.' },
  { rank: 2, label: 'Spouse SIPP split',                    saving: 4_460, certainty: 92, why: 'Move £35K to spouse SIPP; she draws at her lower marginal rate using full personal allowance.' },
  { rank: 3, label: 'ISA top-up first',                     saving: 4_000, certainty: 99, why: '£20K ISA allowance gives tax-free withdrawal vs SIPP at marginal rate.' },
  { rank: 4, label: 'Bed-and-ISA from GIA',                 saving: 2_400, certainty: 95, why: 'Sell £20K GIA, repurchase inside ISA. Future returns shielded; less SIPP draw needed.' },
  { rank: 5, label: 'Stagger across tax years',             saving: 2_200, certainty: 90, why: 'Draw £35K in March 2027 + £35K in May 2027 → uses 2 personal allowances.' },
  { rank: 6, label: 'Defer State Pension 1 year',           saving: 1_840, certainty: 88, why: 'Skip State Pension claim; get 5.8% uplift later. Net effect £1,840 first-year saving.' },
  { rank: 7, label: 'Carry-forward AA contribution',        saving: 1_512, certainty: 92, why: 'Top up SIPP £8K (carry-forward) → reduces taxable income → £1,512 tax relief at 40%.' },
  { rank: 8, label: 'Charity 10% on TFC',                   saving:   900, certainty: 85, why: 'Gift Aid £1,750 of TFC (10%) → £450 higher-rate relief + £450 Gift Aid uplift.' },
]

function DrawdownDemo() {
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const baseTax = 15_432
  const totalSaving = DRAWDOWN_STRATEGIES.reduce((s, st) => s + st.saving, 0)

  function analyse() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setRevealed(true) }, 1400)
  }

  function reset() {
    setRevealed(false)
    setLoading(false)
  }

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '20px 22px', marginBottom: 18,
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Bruce's scenario</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6, lineHeight: 1.4 }}>
          "I want to draw £70,000 from my SIPP this year"
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5 }}>
          Default approach (single lump sum): tax bill £{baseTax.toLocaleString()}.
        </div>
      </div>

      {!revealed && !loading && (
        <button
          onClick={analyse}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: 'var(--c-acc)', border: 'none',
            color: '#0B1F3A', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
            letterSpacing: 0.3,
          }}
        >
          Analyse — find ways to reduce this tax →
        </button>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{
            display: 'inline-block', width: 28, height: 28,
            border: '3px solid var(--c-sep)', borderTopColor: 'var(--c-acc)',
            borderRadius: '50%', animation: 'magic-spin 0.9s linear infinite',
          }} />
          <div style={{ fontSize: 13, color: 'var(--c-text2)', marginTop: 12 }}>
            Sonu is consulting all 11 advisor lenses…
          </div>
          <style>{`@keyframes magic-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {revealed && (
        <>
          <div style={{
            background: 'linear-gradient(135deg, rgba(93,219,194,0.10) 0%, rgba(93,219,194,0.02) 100%)',
            border: '1px solid rgba(93,219,194,0.35)',
            borderRadius: 18, padding: '18px 20px', marginBottom: 16,
            animation: 'magic-fade-up .35s ease-out',
          }}>
            <div className="sw-eyebrow" style={{ marginBottom: 6, color: 'var(--c-acc)' }}>Sonu found</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
                {DRAWDOWN_STRATEGIES.length} strategies
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>
                stacking to save up to <strong style={{ color: 'var(--c-text)' }}>£{totalSaving.toLocaleString()}</strong>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5 }}>
              From a starting tax bill of £{baseTax.toLocaleString()}. Stacking these reduces net tax by ~85%. You choose which to apply.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {DRAWDOWN_STRATEGIES.map((s, i) => (
              <div
                key={s.rank}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                  animation: `magic-fade-up .35s ease-out ${i * 60}ms backwards`,
                }}
              >
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--c-acc)', color: '#0B1F3A',
                  fontSize: 11, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.rank}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', flex: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-acc)', whiteSpace: 'nowrap' }}>
                      £{s.saving.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 5 }}>{s.why}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
                    Certainty {s.certainty}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            style={{
              width: '100%', padding: '11px', borderRadius: 100,
              background: 'transparent', border: '1px solid var(--c-sep)',
              color: 'var(--c-text2)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↻ Reset
          </button>
        </>
      )}

      <style>{`@keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'coi',        label: 'Watch the cost drop',     sub: 'Cost of Inaction in real time' },
  { id: 'lenses',     label: 'Talk to 11 advisors',     sub: 'The synthesised professional brain' },
  { id: 'strategies', label: '£70k drawdown',           sub: '8 ways to cut the tax' },
]

export default function MagicShowcase({ onClose }) {
  const [section, setSection] = useState('coi')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'var(--c-bg)', color: 'var(--c-text)',
      overflowY: 'auto',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: '1px solid var(--c-sep)',
        background: 'var(--c-surface)', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-acc)', fontSize: 18, padding: 0,
          }}
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>The Sonuswealth difference</div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
            Three demonstrations of what makes this not-a-spreadsheet
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '14px 16px',
        background: 'var(--c-surface)', borderBottom: '1px solid var(--c-sep)',
        overflowX: 'auto',
      }}>
        {SECTIONS.map(s => {
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                flexShrink: 0, padding: '10px 14px', borderRadius: 12,
                background: active ? 'var(--c-acc)' : 'var(--c-surface2)',
                border: '1px solid ' + (active ? 'var(--c-acc)' : 'var(--c-sep)'),
                color: active ? '#0B1F3A' : 'var(--c-text)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{s.sub}</div>
            </button>
          )
        })}
      </div>

      {/* Section content */}
      {section === 'coi' && <CoIOdometerDemo />}
      {section === 'lenses' && <ElevenAdvisorsDemo />}
      {section === 'strategies' && <DrawdownDemo />}

      {/* Footer */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--c-text3)',
        padding: '20px 24px 60px', lineHeight: 1.6,
        borderTop: '1px solid var(--c-sep)', marginTop: 24,
      }}>
        Information only · Demo: Bruce Wayne (synthetic persona) · Not regulated advice
      </div>
    </div>
  )
}
