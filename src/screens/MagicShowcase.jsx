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

import { useState, useEffect, useMemo, useRef } from 'react'
import { lens as taxAccountantLens }    from '../lenses/tax-accountant.js'
import { lens as pensionSpecialistLens } from '../lenses/pension-specialist.js'
import { lens as trustLawyerLens }       from '../lenses/trust-lawyer.js'

// Live lens registry — keyed by lens id, used by ElevenAdvisorsDemo to swap
// hand-crafted scaffold cards with real lens output where the engine exists.
const LIVE_LENSES = {
  'tax':     taxAccountantLens,
  'pension': pensionSpecialistLens,
  'trust':   trustLawyerLens,
}

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

// Map severity number (3/2/1) to label, since the lens uses numeric severity.
function sevLabel(severity) {
  return severity === 3 ? 'HIGH' : severity === 2 ? 'MED' : 'LOW'
}

// Format the £-impact line from a lens recommendation.
function fmtRecImpact(rec) {
  const imp = rec?.impact || {}
  if (imp.gbp_per_year)   return `£${imp.gbp_per_year.toLocaleString()}/yr`
  if (imp.gbp_lifetime)   return `£${imp.gbp_lifetime.toLocaleString()} lifetime`
  if (imp.gbp_one_off)    return `£${imp.gbp_one_off.toLocaleString()} one-off`
  return '—'
}

// Build a LIVE card from any registered lens. Returns null if the lens throws
// or produces no output — caller falls back to the hand-crafted scaffold card.
function buildLiveLensCard(lensId, lens, fallbackCard) {
  try {
    const obs = lens.observe(fallbackCard.__entity) || []
    const recs = lens.recommend(fallbackCard.__entity) || []
    if (obs.length === 0 && recs.length === 0) return null
    return {
      ...fallbackCard,
      _live: true,
      insights: obs.slice(0, 3).map(o => ({
        sev: sevLabel(o.severity),
        text: o.text,
        citation: o.citation,
      })),
      recs: recs.slice(0, 3).map(r => ({
        headline: r.headline,
        impact: fmtRecImpact(r),
        citation: r.citation,
      })),
    }
  } catch (err) {
    console.warn(`[MagicShowcase] ${lensId} lens failed — using hand-crafted fallback`, err)
    return null
  }
}

function ElevenAdvisorsDemo({ entity }) {
  const [expanded, setExpanded] = useState(null)

  // Replace hand-crafted scaffold cards with live lens output where engines exist.
  const lensesWithLive = useMemo(() => {
    if (!entity) return LENSES
    return LENSES.map(card => {
      const lens = LIVE_LENSES[card.id]
      if (!lens) return card
      const live = buildLiveLensCard(card.id, lens, { ...card, __entity: entity })
      return live || card
    })
  }, [entity])

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
        {lensesWithLive.map(lens => {
          const isExpanded = expanded === lens.id
          return (
            <button
              key={lens.id}
              onClick={() => setExpanded(isExpanded ? null : lens.id)}
              style={{
                position: 'relative',
                padding: '14px 12px', borderRadius: 14,
                background: isExpanded ? 'var(--c-acc)' : 'var(--c-surface)',
                border: `1px solid ${isExpanded ? 'var(--c-acc)' : 'var(--c-sep)'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'all .2s',
                transform: isExpanded ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {lens._live && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  padding: '2px 6px', borderRadius: 100,
                  background: isExpanded ? 'rgba(11,31,58,0.18)' : 'rgba(93,219,194,0.18)',
                  border: '1px solid ' + (isExpanded ? 'rgba(11,31,58,0.3)' : 'rgba(93,219,194,0.45)'),
                  fontSize: 8, fontWeight: 800, letterSpacing: 0.4,
                  color: isExpanded ? '#0B1F3A' : 'var(--c-acc)',
                }}>
                  LIVE
                </span>
              )}
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
        const lens = lensesWithLive.find(l => l.id === expanded)
        if (!lens) return null
        return (
          <div style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
            borderRadius: 18, padding: '20px 22px',
            animation: 'magic-fade-up .3s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 32 }}>{lens.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>{lens.name}</div>
                  {lens._live ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(93,219,194,0.18)',
                      border: '1px solid rgba(93,219,194,0.45)',
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                      color: 'var(--c-acc)',
                    }}>
                      LIVE ENGINE
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: 'var(--c-surface2)',
                      border: '1px solid var(--c-sep)',
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                      color: 'var(--c-text3)',
                    }}>
                      SCAFFOLD
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{lens.tagline}</div>
              </div>
            </div>

            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What I see</div>
            <div style={{ marginBottom: 16 }}>
              {lens.insights.map((o, i) => (
                <div key={i} style={{
                  padding: '8px 0',
                  borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
                }}>
                  <div style={{
                    display: 'flex', gap: 10,
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
                  {o.citation && (
                    <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4, paddingLeft: 36, fontStyle: 'italic' }}>
                      Source: {o.citation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>What I'd recommend</div>
            {lens.recs.map((r, i) => (
              <div key={i} style={{
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--c-sep)' : 'none',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>★ {r.headline}</div>
                  <div style={{
                    flexShrink: 0, padding: '3px 10px', borderRadius: 100,
                    background: 'rgba(93,219,194,0.12)',
                    border: '1px solid rgba(93,219,194,0.3)',
                    fontSize: 11, fontWeight: 700, color: 'var(--c-acc)',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.impact}
                  </div>
                </div>
                {r.citation && (
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 4, fontStyle: 'italic' }}>
                    Source: {r.citation}
                  </div>
                )}
              </div>
            ))}

            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 10,
              background: 'var(--c-surface2)', fontSize: 11,
              color: 'var(--c-text3)', lineHeight: 1.5,
              textAlign: 'center',
            }}>
              {lens._live
                ? 'Information only · Live computation from canonical UK rules · Not regulated advice'
                : `Information only · Scaffold preview — wires to live lens engine in upcoming release · Not regulated advice`
              }
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

// Reasoning trace — each step is shown sequentially during "analyse".
// Each step represents a lens being consulted or a transformation applied.
// Total runtime ~2.8s. Founder can pause on this screen to talk through the
// reasoning path that produced the strategy list.
const TRACE_STEPS = [
  { id: 'situation',    label: 'Reading your situation',                  detail: 'Income £150k · SIPP £1M · Marginal rate 40%',                ms: 450 },
  { id: 'tax',          label: 'Consulting Tax Accountant',                detail: '+5 strategies (TFC phasing, ISA, bed-and-ISA, CGT, carry-fwd)', ms: 500, live: true },
  { id: 'pension',      label: 'Consulting Pension Specialist',            detail: '+3 strategies (spouse split, defer SP, AA top-up)',          ms: 500 },
  { id: 'ifa',          label: 'Consulting IFA (Holistic)',                detail: '+2 strategies (stagger across years, asset location)',       ms: 500 },
  { id: 'philanthropy', label: 'Consulting Philanthropy Adviser',          detail: '+1 strategy (Charity 10% on TFC)',                          ms: 400 },
  { id: 'dedupe',       label: 'De-duplicating overlapping ideas',         detail: '11 raw → 8 distinct strategies',                            ms: 350 },
  { id: 'rank',         label: 'Ranking by (£ saving × certainty)',         detail: '0 strategies dropped (all ≥ £500 minimum threshold)',       ms: 350 },
]

function DrawdownDemo({ entity }) {  // eslint-disable-line no-unused-vars
  const [revealed, setRevealed] = useState(false)
  const [running, setRunning] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  const [showTrace, setShowTrace] = useState(false)
  const baseTax = 15_432
  const totalSaving = DRAWDOWN_STRATEGIES.reduce((s, st) => s + st.saving, 0)
  const timersRef = useRef([])

  function clearTimers() {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
  }

  function analyse() {
    setRunning(true)
    setCompletedSteps([])
    setRevealed(false)
    let acc = 0
    TRACE_STEPS.forEach((step, idx) => {
      acc += step.ms
      const t = setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id])
      }, acc)
      timersRef.current.push(t)
    })
    // Reveal strategy list shortly after the last step
    const t = setTimeout(() => {
      setRevealed(true)
      setRunning(false)
    }, acc + 350)
    timersRef.current.push(t)
  }

  function reset() {
    clearTimers()
    setRevealed(false)
    setRunning(false)
    setCompletedSteps([])
    setShowTrace(false)
  }

  // Clean up timers on unmount
  useEffect(() => () => clearTimers(), [])

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

      {!revealed && !running && (
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

      {(running || revealed) && (
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          borderRadius: 14, padding: '16px 18px',
          marginBottom: revealed ? 16 : 0,
          display: revealed && !showTrace ? 'none' : 'block',
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>How Sonu got to the answer</span>
            {revealed && (
              <button
                onClick={() => setShowTrace(false)}
                style={{ background: 'none', border: 'none', color: 'var(--c-text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                hide ✕
              </button>
            )}
          </div>
          {TRACE_STEPS.map((step, i) => {
            const done = completedSteps.includes(step.id)
            const active = !done && i === completedSteps.length && running
            return (
              <div key={step.id} style={{
                display: 'flex', gap: 10, padding: '7px 0',
                opacity: done || active ? 1 : 0.3,
                transition: 'opacity .25s',
              }}>
                <span style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  background: done ? 'var(--c-acc)' : 'transparent',
                  border: done ? 'none' : '1px solid var(--c-sep)',
                  color: done ? '#0B1F3A' : 'var(--c-text3)',
                }}>
                  {done ? '✓' : active ? '·' : ''}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--c-text)' }}>
                    {step.label}
                    {step.live && (
                      <span style={{
                        padding: '1px 5px', borderRadius: 100, fontSize: 8, fontWeight: 800, letterSpacing: 0.3,
                        background: 'rgba(93,219,194,0.18)', border: '1px solid rgba(93,219,194,0.4)',
                        color: 'var(--c-acc)',
                      }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2, lineHeight: 1.4 }}>
                    {step.detail}
                  </div>
                </div>
              </div>
            )
          })}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
              <div className="sw-eyebrow" style={{ color: 'var(--c-acc)' }}>Sonu found</div>
              {!showTrace && (
                <button
                  onClick={() => setShowTrace(true)}
                  style={{
                    padding: '4px 10px', borderRadius: 100,
                    background: 'transparent', border: '1px solid var(--c-acc)',
                    color: 'var(--c-acc)', fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  How did Sonu get here? ↑
                </button>
              )}
            </div>
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

// ── Section 4: £100k taper trap (live engine) ────────────────────────────────

// UK 2025-26 income-tax calculation. Inline rather than importing engine —
// keeps this section self-contained for demo robustness.
function computeIncomeTax(income) {
  const PA       = 12570
  const TAPER_S  = 100000
  const TAPER_E  = 125140
  const BR_CAP   = 50270   // basic-rate ceiling
  const AR_START = 125140
  // Tapered PA: lose £1 for every £2 over £100k
  let effectivePA = PA
  if (income > TAPER_S) {
    effectivePA = Math.max(0, PA - (income - TAPER_S) / 2)
  }
  const taxable = Math.max(0, income - effectivePA)
  let tax = 0
  // 20% band: first 37,700 of taxable
  const brBand = Math.min(taxable, 37700)
  tax += brBand * 0.20
  let remaining = taxable - brBand
  // 40% band: up to (AR_START - effectivePA) of taxable.
  // Additional rate fires at £125,140 of GROSS income, regardless of PA, so
  // hrCap in taxable terms shrinks as PA tapers.
  const hrCapTaxable = AR_START - effectivePA
  const hrBand = Math.max(0, Math.min(remaining, hrCapTaxable - 37700))
  tax += hrBand * 0.40
  remaining -= hrBand
  // 45% on the rest
  tax += Math.max(0, remaining) * 0.45
  return { effectivePA, taxable, tax: Math.round(tax), lostPA: PA - effectivePA }
}

function computeMarginalRate(income) {
  // Smooth small step to estimate the effective marginal rate
  const a = computeIncomeTax(income)
  const b = computeIncomeTax(income + 100)
  return (b.tax - a.tax) / 100
}

function TaperTrapDemo({ entity }) {  // eslint-disable-line no-unused-vars
  const [income, setIncome] = useState(120000)
  const [sacrifice, setSacrifice] = useState(0)
  const taxBefore = useMemo(() => computeIncomeTax(income),                [income])
  const taxAfter  = useMemo(() => computeIncomeTax(income - sacrifice),    [income, sacrifice])
  const marginal  = useMemo(() => computeMarginalRate(income),             [income])
  const saving    = taxBefore.tax - taxAfter.tax

  // Compute the visual band — colours by zone
  const inTaper = income > 100000 && income < 125140

  // Suggested sacrifice = move income just under £100k
  const suggestedSacrifice = useMemo(() => {
    if (income <= 100000) return 0
    return Math.min(income - 100000, 60000)  // cap at AA
  }, [income])

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '20px 22px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="sw-eyebrow">The £100k taper trap</div>
          <span style={{
            padding: '2px 8px', borderRadius: 100,
            background: 'rgba(93,219,194,0.18)', border: '1px solid rgba(93,219,194,0.45)',
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: 'var(--c-acc)',
          }}>
            LIVE ENGINE
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.55, marginTop: 6 }}>
          Between £100,000 and £125,140 your Personal Allowance tapers away at £1 for every £2 of income. Combined with the 40% higher-rate band, your effective marginal rate is <strong style={{ color: 'var(--c-acc3)' }}>60%</strong> in this zone. Move the slider to see.
        </div>
      </div>

      {/* Income slider */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '18px 22px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Your gross income
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
            £{income.toLocaleString()}
          </div>
        </div>
        <input
          type="range"
          min={80000}
          max={150000}
          step={1000}
          value={income}
          onChange={e => { setIncome(parseInt(e.target.value)); setSacrifice(0) }}
          style={{
            width: '100%', accentColor: inTaper ? 'var(--c-acc3)' : 'var(--c-acc)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
          <span>£80k</span>
          <span>£100k</span>
          <span style={inTaper ? { color: 'var(--c-acc3)', fontWeight: 700 } : {}}>£125k</span>
          <span>£150k</span>
        </div>
      </div>

      {/* Tax breakdown */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14,
      }}>
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Personal allowance
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: taxBefore.effectivePA < 12570 ? 'var(--c-acc3)' : 'var(--c-text)',
            marginTop: 4, fontVariantNumeric: 'tabular-nums',
          }}>
            £{Math.round(taxBefore.effectivePA).toLocaleString()}
          </div>
          {taxBefore.lostPA > 0 && (
            <div style={{ fontSize: 10, color: 'var(--c-acc3)', marginTop: 2 }}>
              -£{Math.round(taxBefore.lostPA).toLocaleString()} lost
            </div>
          )}
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Income tax due
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800, color: 'var(--c-text)',
            marginTop: 4, fontVariantNumeric: 'tabular-nums',
          }}>
            £{taxBefore.tax.toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: inTaper ? 'rgba(255,111,125,0.10)' : 'var(--c-surface)',
          border: '1px solid ' + (inTaper ? 'var(--c-acc3)' : 'var(--c-sep)'),
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Marginal rate
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: marginal >= 0.59 ? 'var(--c-acc3)' : 'var(--c-text)',
            marginTop: 4, fontVariantNumeric: 'tabular-nums',
          }}>
            {(marginal * 100).toFixed(0)}%
          </div>
          {marginal >= 0.59 && (
            <div style={{ fontSize: 10, color: 'var(--c-acc3)', marginTop: 2 }}>
              taper trap
            </div>
          )}
        </div>
      </div>

      {/* Strategy: pension sacrifice */}
      {income > 100000 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(93,219,194,0.10) 0%, rgba(93,219,194,0.02) 100%)',
          border: '1px solid rgba(93,219,194,0.35)',
          borderRadius: 18, padding: '18px 22px', marginBottom: 14,
        }}>
          <div className="sw-eyebrow" style={{ color: 'var(--c-acc)', marginBottom: 8 }}>
            🧾 Tax Accountant recommends
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6 }}>
            Salary-sacrifice into pension to escape the taper
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 14 }}>
            Sacrificing income below £100,000 restores the full Personal Allowance and clears the 60% marginal-rate zone. The sacrificed amount goes into your pension — not lost, just relocated.
          </div>

          {/* Sacrifice slider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pension sacrifice
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>
              £{sacrifice.toLocaleString()}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={Math.min(income - 80000, 60000)}
            step={500}
            value={sacrifice}
            onChange={e => setSacrifice(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--c-acc)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <button
              onClick={() => setSacrifice(suggestedSacrifice)}
              style={{
                padding: '5px 10px', borderRadius: 100,
                background: 'rgba(93,219,194,0.18)', border: '1px solid var(--c-acc)',
                color: 'var(--c-acc)', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Set to escape taper (£{suggestedSacrifice.toLocaleString()})
            </button>
            <button
              onClick={() => setSacrifice(0)}
              style={{
                padding: '5px 10px', borderRadius: 100,
                background: 'transparent', border: '1px solid var(--c-sep)',
                color: 'var(--c-text2)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reset
            </button>
          </div>

          {sacrifice > 0 && (
            <div style={{
              marginTop: 14, padding: '14px 16px', borderRadius: 12,
              background: 'var(--c-surface2)', border: '1px solid var(--c-sep)',
              animation: 'magic-fade-up .3s ease-out',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    New tax bill
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    £{taxAfter.tax.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                    was £{taxBefore.tax.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-acc)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Tax saved this year
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-acc)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    £{saving.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
                    + pension fund grows
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-sep)', fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.5 }}>
                The £{sacrifice.toLocaleString()} you sacrificed is in your pension, growing tax-free until you draw it. Effective cost to your take-home: £{(sacrifice - saving).toLocaleString()}.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--c-text2)', marginBottom: 4 }}>How this works</div>
        Numbers are computed live in your browser using 2025-26 UK income tax rules (PA £12,570 · BR 20% to £50,270 · HR 40% to £125,140 · AR 45%). The "Tax Accountant recommends" panel above fires the same logic the live lens (<code style={{ fontSize: 10, background: 'var(--c-surface2)', padding: '1px 5px', borderRadius: 3 }}>STRAT-100K-TAPER-ESCAPE</code>) would produce against your real persona.
      </div>

      <style>{`@keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'coi',        label: 'Watch the cost drop',     sub: 'Cost of Inaction in real time' },
  { id: 'lenses',     label: 'Talk to 11 advisors',     sub: 'The synthesised professional brain' },
  { id: 'strategies', label: '£70k drawdown',           sub: '8 ways to cut the tax' },
  { id: 'taper',      label: '£100k taper trap',         sub: 'Live engine · drag to play' },
]

export default function MagicShowcase({ entity, onClose }) {
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
      {section === 'lenses' && <ElevenAdvisorsDemo entity={entity} />}
      {section === 'strategies' && <DrawdownDemo entity={entity} />}
      {section === 'taper' && <TaperTrapDemo entity={entity} />}

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
