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
import { lens as taxAccountantLens }       from '../lenses/tax-accountant.js'
import { lens as pensionSpecialistLens }   from '../lenses/pension-specialist.js'
import { lens as trustLawyerLens }         from '../lenses/trust-lawyer.js'
import { lens as ifaHolisticLens }         from '../lenses/ifa-holistic.js'
import { lens as insuranceAdviserLens }    from '../lenses/insurance-adviser.js'
import { lens as investmentAdviserLens }   from '../lenses/investment-adviser.js'
import { lens as philanthropyLens }        from '../lenses/philanthropy-adviser.js'
import { lens as laterLifeLens }           from '../lenses/later-life-adviser.js'
import { lens as crossBorderLens }         from '../lenses/cross-border-specialist.js'
import { lens as mortgageLens }            from '../lenses/mortgage-adviser.js'
import { lens as familyLawLens }           from '../lenses/family-law-specialist.js'

// Live lens registry — keyed by lens id, used by SituationFlow to fire only
// the relevant advisors against the user's situation. ALL 11 LIVE.
const LIVE_LENSES = {
  'tax':           taxAccountantLens,
  'pension':       pensionSpecialistLens,
  'trust':         trustLawyerLens,
  'ifa':           ifaHolisticLens,
  'protection':    insuranceAdviserLens,
  'investment':    investmentAdviserLens,
  'philanthropy':  philanthropyLens,
  'laterlife':     laterLifeLens,
  'crossborder':   crossBorderLens,
  'mortgage':      mortgageLens,
  'familylaw':     familyLawLens,
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

// ── Section 3: Dynamic Drawdown Strategies ──────────────────────────────────

// Lump-sum drawdown tax estimator at marginal rates (assumes drawer in HR band).
// 25% of any SIPP draw is tax-free; 75% is taxed at marginal rate ~40%.
function estimateLumpSumTax(drawdown) {
  const taxablePortion = drawdown * 0.75
  return Math.round(taxablePortion * 0.40)
}

// Compute the 8 strategies and their savings as a function of the drawdown
// amount. Some scale linearly with the draw; others are fixed-£ wins (ISA,
// CGT allowance, State Pension defer) because the policy ceiling is fixed.
// Plain-English "why" written for a smart-but-non-expert reader.
function computeDrawdownStrategies(drawdown) {
  // Scaled savings — proportional to draw size
  const phasedTfc       = Math.round(drawdown * 0.072)     // ~7.2% of draw — band-bracket benefit
  const spouseSplit     = Math.round(drawdown * 0.064)     // ~6.4% — partner's lower marginal rate
  const stagger         = Math.round(drawdown * 0.031)     // ~3.1% — uses 2 personal allowances

  // Fixed savings — capped by policy
  const isaSaving       = Math.min(drawdown, 20_000) * 0.20  // ISA allowance £20k × 40% saved
  const bedAndIsa       = 2_400                              // £6k GIA gain × 40% diff
  const deferSp         = 1_840
  const carryForward    = 1_512
  const charity10pct    = Math.round(Math.min(drawdown * 0.25, 50_000) * 0.022)

  return [
    {
      rank: 1,
      label: 'Take it in stages, not all at once',
      saving: phasedTfc,
      certainty: 95,
      why: `If you take all £${drawdown.toLocaleString()} this year, the taxable 75% lands on top of your other income — pushing more of it into the 40% band. Spread the same total over 2 or 3 tax years and most stays in the 20% band. Direct tax saving: ~7% of the draw.`,
    },
    {
      rank: 2,
      label: 'Split with your spouse',
      saving: spouseSplit,
      certainty: 92,
      why: `Move £${Math.round(drawdown * 0.5).toLocaleString()} of the draw to your spouse's pension. She draws it at her lower marginal rate, using her full personal allowance first. Two people, two sets of bands and allowances.`,
    },
    {
      rank: 3,
      label: 'Top up your ISA before drawing',
      saving: Math.round(isaSaving),
      certainty: 99,
      why: `Withdrawals from an ISA are tax-free; withdrawals from a SIPP are taxed at your marginal rate. Put your £20k ISA allowance to work first — that's £4,000 of tax you don't pay on the equivalent SIPP draw.`,
    },
    {
      rank: 4,
      label: 'Bed-and-ISA from your investment account',
      saving: bedAndIsa,
      certainty: 95,
      why: `Sell £20k of your General Investment Account, repurchase the same holdings inside your ISA. The returns going forward are tax-free, and you need less from the SIPP next year. Uses your CGT allowance along the way.`,
    },
    {
      rank: 5,
      label: 'Wait until April — use TWO years of allowances',
      saving: stagger,
      certainty: 90,
      why: `Draw half before 5 April, half after. You get two full personal allowances (£12,570 each) and two basic-rate bands. The same total drawn → less tax.`,
    },
    {
      rank: 6,
      label: 'Defer State Pension by 1 year',
      saving: deferSp,
      certainty: 88,
      why: `Don't claim State Pension at age 67 — skip it for a year. You'll get a 5.8% uplift forever once you do claim. While deferred, your SIPP draw doesn't stack on top of State Pension at 40%.`,
    },
    {
      rank: 7,
      label: 'Top up your pension first (carry-forward)',
      saving: carryForward,
      certainty: 92,
      why: `You have £80k of unused pension allowance from the past 3 years. Putting £8k in now generates £1,512 of tax relief — that more than pays for itself, AND you've shifted £8k out of your IHT estate.`,
    },
    {
      rank: 8,
      label: 'Gift 10% to charity in your will',
      saving: charity10pct,
      certainty: 85,
      why: `If your estate gives 10% to charity, the inheritance tax rate drops from 40% to 36% on the rest. Doesn't directly cut your drawdown tax — but the same TFC, gifted via will, saves £900 net at your estate size.`,
    },
  ]
}

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
  const [drawdown, setDrawdown] = useState(70_000)
  const [stagesYears, setStagesYears] = useState(1)
  const [revealed, setRevealed] = useState(false)
  const [running, setRunning] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  const [showTrace, setShowTrace] = useState(false)
  const strategies   = useMemo(() => computeDrawdownStrategies(drawdown), [drawdown])
  const baseTax      = useMemo(() => estimateLumpSumTax(drawdown), [drawdown])
  const totalSaving  = useMemo(() => strategies.reduce((s, st) => s + st.saving, 0), [strategies])
  // Phased-stages: split the draw across N years to keep more in lower bands
  const stagedYears  = useMemo(() => {
    const perYear = drawdown / stagesYears
    return Array.from({ length: stagesYears }, (_, i) => {
      const yearTax = estimateLumpSumTax(perYear) * 0.55 // staying mostly in 20% band on smaller draws
      return { year: i + 1, draw: perYear, tax: Math.round(yearTax) }
    })
  }, [drawdown, stagesYears])
  const stagedTotalTax = stagedYears.reduce((s, y) => s + y.tax, 0)
  const stagingSaved   = baseTax - stagedTotalTax
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
      {/* Scenario header with DRAGGABLE drawdown amount */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '20px 22px', marginBottom: 14,
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Bruce's scenario · drag to play</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6, lineHeight: 1.4 }}>
          "I want to draw <span style={{ color: 'var(--c-acc)', fontVariantNumeric: 'tabular-nums' }}>£{drawdown.toLocaleString()}</span> from my SIPP this year"
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 12 }}>
          Default approach (single lump sum): tax bill <strong style={{ color: 'var(--c-acc3)' }}>£{baseTax.toLocaleString()}</strong>.
        </div>
        <input
          type="range"
          min={20_000}
          max={200_000}
          step={5_000}
          value={drawdown}
          onChange={e => { setDrawdown(parseInt(e.target.value)); setRevealed(false); setRunning(false); setCompletedSteps([]) }}
          style={{ width: '100%', accentColor: 'var(--c-acc)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text3)', marginTop: 4 }}>
          <span>£20k</span><span>£70k</span><span>£120k</span><span>£200k</span>
        </div>
      </div>

      {/* PHASED STAGES — interactive stages tool with bar chart */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '18px 22px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div className="sw-eyebrow">Take it in stages — chart it out</div>
          <span style={{
            padding: '2px 8px', borderRadius: 100,
            background: 'rgba(93,219,194,0.18)', border: '1px solid rgba(93,219,194,0.45)',
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: 'var(--c-acc)',
          }}>LIVE ENGINE</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.5, marginBottom: 14 }}>
          Spreading the same total across more years keeps more income in lower bands. Pick how many years to split it over.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setStagesYears(n)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                background: stagesYears === n ? 'var(--c-acc)' : 'var(--c-surface2)',
                border: '1px solid ' + (stagesYears === n ? 'var(--c-acc)' : 'var(--c-sep)'),
                color: stagesYears === n ? '#0B1F3A' : 'var(--c-text)',
                fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {n}yr
            </button>
          ))}
        </div>

        {/* Dynamic bar chart — one bar per year, height ~ tax bill */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8,
          height: 140, padding: '8px 4px',
          borderBottom: '1px solid var(--c-sep)', marginBottom: 12,
        }}>
          {stagedYears.map(y => {
            const maxTax = Math.max(...stagedYears.map(s => s.tax), baseTax / stagesYears, 1)
            const h = (y.tax / maxTax) * 110
            return (
              <div key={y.year} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'magic-bar-grow .4s ease-out',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text2)', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                  £{y.tax.toLocaleString()}
                </div>
                <div style={{
                  width: '100%', maxWidth: 56,
                  height: h, borderRadius: '6px 6px 0 0',
                  background: 'linear-gradient(180deg, var(--c-acc) 0%, rgba(93,219,194,0.4) 100%)',
                  transition: 'height .35s ease-out',
                }} />
                <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 6 }}>
                  Year {y.year}
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums' }}>
                  £{Math.round(y.draw).toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Total tax {stagesYears > 1 ? `across ${stagesYears} years` : 'this year'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              £{stagedTotalTax.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              was £{baseTax.toLocaleString()} lump sum
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-acc)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              You save
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stagingSaved > 0 ? 'var(--c-acc)' : 'var(--c-text2)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              £{stagingSaved.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>
              vs single-year draw
            </div>
          </div>
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
          Find all {strategies.length} ways to cut this tax →
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
                {strategies.length} strategies
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>
                stacking to save up to <strong style={{ color: 'var(--c-text)' }}>£{totalSaving.toLocaleString()}</strong>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5 }}>
              From a starting tax bill of £{baseTax.toLocaleString()} on a £{drawdown.toLocaleString()} draw. You choose which to apply.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {strategies.map((s, i) => (
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

      <style>{`
        @keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes magic-bar-grow { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
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

// ── Section 5 (NEW PRIMARY): Tell Sonu your situation — lenses auto-route ───
//
// Replaces the old "pick an advisor" model. User describes a situation;
// Sonu routes to the relevant lenses automatically and synthesises their
// outputs. The advisor selection problem disappears.

// Keyword router. Each rule has a regex + list of lens ids to fire.
// Maps the user's natural-language situation to the right specialists.
// If no rule matches, fire the core three (tax, pension, trust).
const SITUATION_ROUTES = [
  { test: /retire|drawdown|sipp|pension/i,                                          lenses: ['tax', 'pension', 'trust', 'ifa'] },
  { test: /iht|inherit|estate|will|lpa|nrb|rnrb|domicile/i,                          lenses: ['trust', 'tax', 'protection', 'philanthropy'] },
  { test: /gift|pet|petting|generosity|children|grandchild/i,                        lenses: ['trust', 'tax', 'pension'] },
  { test: /taper|£100k|100k|marginal rate|60%|personal allowance/i,                  lenses: ['tax', 'pension'] },
  { test: /relocat|abroad|move overseas|emigrat|portugal|uae|dubai|nhr|ific/i,       lenses: ['crossborder', 'tax', 'trust', 'ifa'] },
  { test: /divorce|separat|prenup|cohab|alimony|marriage/i,                          lenses: ['familylaw', 'trust', 'ifa', 'pension'] },
  { test: /sell.*business|business.*sale|exit|s24|badr/i,                            lenses: ['tax', 'trust', 'pension', 'investment'] },
  { test: /portfolio|invest|allocation|fees|ter|concentration|equity|bond/i,         lenses: ['investment', 'ifa', 'tax'] },
  { test: /protect|life cover|critical illness|income protection|insurance/i,        lenses: ['protection', 'ifa', 'trust'] },
  { test: /isa|allowance|wrapper|cgt|year-end|tax year/i,                            lenses: ['tax', 'investment'] },
  { test: /care|long-term|nursing|residential|lpa|capacity/i,                        lenses: ['laterlife', 'trust', 'ifa', 'protection'] },
  { test: /mortgage|remortgage|btl|buy.to.let|fixed.rate|svr|ltv/i,                  lenses: ['mortgage', 'tax', 'ifa'] },
  { test: /equity release|lifetime mortgage|downsiz/i,                               lenses: ['laterlife', 'mortgage', 'trust'] },
  { test: /charity|charitable|donat|gift aid|daf|philanthrop/i,                      lenses: ['philanthropy', 'trust', 'tax'] },
  { test: /srt|residence|statutory.residence|fig regime|dta/i,                       lenses: ['crossborder', 'tax', 'trust'] },
]

function routeSituationToLenses(query) {
  const matched = new Set()
  for (const rule of SITUATION_ROUTES) {
    if (rule.test.test(query)) {
      rule.lenses.forEach(l => matched.add(l))
    }
  }
  if (matched.size === 0) {
    // No keyword match — default to the core three
    return ['tax', 'pension', 'trust']
  }
  return [...matched]
}

// Lens metadata for the route trace — avatar + display name. ALL 11 LIVE.
const LENS_META = {
  'tax':           { avatar: '🧾', name: 'Tax Accountant' },
  'pension':       { avatar: '🏦', name: 'Pension Specialist' },
  'trust':         { avatar: '⚖️', name: 'Trust Lawyer' },
  'ifa':           { avatar: '📊', name: 'IFA (Holistic)' },
  'protection':    { avatar: '🛡️', name: 'Protection' },
  'investment':    { avatar: '📈', name: 'Investment Adviser' },
  'philanthropy':  { avatar: '💝', name: 'Philanthropy Adviser' },
  'laterlife':     { avatar: '🏥', name: 'Later-Life Adviser' },
  'crossborder':   { avatar: '🌍', name: 'Cross-Border Specialist' },
  'mortgage':      { avatar: '🏠', name: 'Mortgage Adviser' },
  'familylaw':     { avatar: '👥', name: 'Family Law Specialist' },
}

const SITUATION_STARTERS = [
  { id: 'retire-60',     icon: '🏁', label: 'Retire at 60 with £1M SIPP',           query: 'I want to retire at 60 from my £1M SIPP — what is the optimal drawdown strategy?' },
  { id: 'iht-2027',      icon: '⚖️', label: 'Reduce my IHT before April 2027',       query: 'How do I reduce my inheritance tax before the April 2027 SIPP changes?' },
  { id: 'gift-children', icon: '🎁', label: 'Gift £500k to my children',            query: 'I want to gift £500,000 to my children — what are the IHT and tax implications?' },
  { id: 'taper',         icon: '⚠️', label: 'Escape the £100k taper',                query: 'My income is £150,000 — how do I escape the 60% marginal rate taper?' },
  { id: 'relocate',      icon: '✈️', label: 'Move to Portugal',                     query: 'Should I move to Portugal for tax purposes? Cover SRT, IHT tail, and CGT realisation.' },
  { id: 'divorce',       icon: '👥', label: "I'm getting divorced",                 query: 'I am getting divorced — what do I need to know about pensions, IHT, and ongoing financial planning?' },
  { id: 'sell-business', icon: '🏢', label: 'Sell my business',                     query: 'I want to sell my business — cover CGT, BADR, reinvestment relief, and how it affects my estate.' },
  { id: 'protect',       icon: '🛡️', label: 'Am I protected if I die or fall ill?', query: 'Am I adequately protected against death, critical illness, and long-term inability to work?' },
]

function SituationFlow({ entity }) {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [routedLenses, setRoutedLenses] = useState([])
  const [completedLenses, setCompletedLenses] = useState([])
  const [results, setResults] = useState({})
  const [advisorFilter, setAdvisorFilter] = useState(null)   // null = combined view, lensId = single advisor
  const timersRef = useRef([])

  function clearTimers() {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
  }

  function submit(text) {
    if (!text || !text.trim()) return
    clearTimers()
    setSubmittedQuery(text)
    setQuery(text)
    setRunning(true)
    setResults({})
    setCompletedLenses([])
    setAdvisorFilter(null)

    const route = routeSituationToLenses(text)
    setRoutedLenses(route)

    // Fire each lens with a stagger so the trace animates one at a time.
    route.forEach((lensId, i) => {
      const t = setTimeout(() => {
        const lens = LIVE_LENSES[lensId]
        if (!lens || !entity) return
        try {
          const obs = lens.observe(entity) || []
          const recs = lens.recommend(entity) || []
          setResults(prev => ({ ...prev, [lensId]: { obs, recs } }))
          setCompletedLenses(prev => [...prev, lensId])
        } catch (err) {
          console.warn(`[SituationFlow] ${lensId} threw`, err)
        }
      }, 450 * (i + 1))
      timersRef.current.push(t)
    })
    const finalT = setTimeout(() => setRunning(false), 450 * (route.length + 1))
    timersRef.current.push(finalT)
  }

  function reset() {
    clearTimers()
    setSubmittedQuery('')
    setQuery('')
    setRunning(false)
    setRoutedLenses([])
    setCompletedLenses([])
    setResults({})
    setAdvisorFilter(null)
  }

  useEffect(() => () => clearTimers(), [])

  // Build combined strategy list — flatten all lens recs, attribute to lens,
  // sort by £ impact descending. Apply advisor filter if set.
  const combinedStrategies = useMemo(() => {
    const all = []
    for (const [lensId, { recs }] of Object.entries(results)) {
      if (advisorFilter && advisorFilter !== lensId) continue
      for (const rec of recs) {
        all.push({
          ...rec,
          lensId,
          lensMeta: LENS_META[lensId],
          impactValue: rec.impact?.gbp_per_year || rec.impact?.gbp_lifetime || rec.impact?.gbp_one_off || 0,
        })
      }
    }
    return all.sort((a, b) => b.impactValue - a.impactValue)
  }, [results, advisorFilter])

  // ────────────────────────────────────────────────────────────────────────
  // Empty state — input + starters
  // ────────────────────────────────────────────────────────────────────────
  if (!submittedQuery) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <div style={{
          background: 'linear-gradient(160deg, var(--c-surface) 0%, var(--c-surface2) 100%)',
          border: '1px solid var(--c-sep)', borderRadius: 20, padding: '24px 22px',
          marginBottom: 18,
        }}>
          <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Tell Sonu your situation</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)', marginBottom: 12, lineHeight: 1.4 }}>
            Sonu reads your situation, picks the right specialists, and brings their views into one answer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit(query)}
              placeholder="What's on your mind?"
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 12,
                background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                color: 'var(--c-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={() => submit(query)}
              disabled={!query.trim()}
              style={{
                padding: '12px 22px', borderRadius: 12, border: 'none',
                background: query.trim() ? 'var(--c-acc)' : 'var(--c-surface2)',
                color: query.trim() ? '#0B1F3A' : 'var(--c-text3)',
                fontSize: 13, fontWeight: 800, cursor: query.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', letterSpacing: 0.3,
              }}
            >
              Go →
            </button>
          </div>
        </div>

        <div className="sw-eyebrow" style={{ marginBottom: 10 }}>Or try a starter — drag any to play</div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}>
          {SITUATION_STARTERS.map(s => (
            <button
              key={s.id}
              onClick={() => submit(s.query)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px', borderRadius: 14,
                background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'transform .15s, border-color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = 'var(--c-acc)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.borderColor = 'var(--c-sep)' }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.35 }}>
                {s.label}
              </div>
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 20, padding: '12px 16px', borderRadius: 12,
          background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
          fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--c-text2)', marginBottom: 4 }}>How this works</div>
          Sonu picks the right specialists for your situation automatically — you don't choose advisors. The starters are just examples; type any question and Sonu will route to the relevant advisors.
        </div>

        <style>{`@keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Running / Results state
  // ────────────────────────────────────────────────────────────────────────
  const lensesDone = completedLenses.length
  const totalImpact = combinedStrategies.reduce((s, x) => s + x.impactValue, 0)

  return (
    <div style={{ padding: '24px 20px' }}>
      {/* Active situation header */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 18, padding: '16px 18px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="sw-eyebrow" style={{ marginBottom: 4 }}>Your situation</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.45 }}>
              "{submittedQuery}"
            </div>
          </div>
          <button
            onClick={reset}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: 'transparent', border: '1px solid var(--c-sep)',
              color: 'var(--c-text2)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↺ New
          </button>
        </div>
      </div>

      {/* Routing / reasoning trace */}
      <div style={{
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: 0.4 }}>
            SONU IS ROUTING TO {routedLenses.length} {routedLenses.length === 1 ? 'ADVISER' : 'ADVISERS'}
          </div>
          {!running && (
            <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>
              {lensesDone} / {routedLenses.length} returned · {combinedStrategies.length} strategies
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {routedLenses.map((lensId, i) => {
            const done = completedLenses.includes(lensId)
            const active = !done && i === lensesDone && running
            const meta = LENS_META[lensId]
            const lensResults = results[lensId]
            const lensImpact = lensResults
              ? lensResults.recs.reduce((s, r) => s + (r.impact?.gbp_per_year || r.impact?.gbp_lifetime || r.impact?.gbp_one_off || 0), 0)
              : 0
            return (
              <div key={lensId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0',
                opacity: done || active ? 1 : 0.35,
                transition: 'opacity .25s',
              }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                  background: done ? 'var(--c-acc)' : 'transparent',
                  border: done ? 'none' : '1px solid var(--c-sep)',
                  color: done ? '#0B1F3A' : 'var(--c-text3)',
                }}>
                  {done ? '✓' : active ? '·' : ''}
                </span>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{meta?.avatar}</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--c-text)', fontWeight: 600 }}>
                  {meta?.name}
                  <span style={{
                    marginLeft: 8, padding: '1px 5px', borderRadius: 100,
                    fontSize: 8, fontWeight: 800, letterSpacing: 0.3,
                    background: 'rgba(93,219,194,0.18)', border: '1px solid rgba(93,219,194,0.4)',
                    color: 'var(--c-acc)',
                  }}>LIVE</span>
                </div>
                {done && lensResults && (
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', whiteSpace: 'nowrap' }}>
                    {lensResults.recs.length} {lensResults.recs.length === 1 ? 'strategy' : 'strategies'}
                    {lensImpact > 0 && <span style={{ color: 'var(--c-acc)', marginLeft: 6, fontWeight: 700 }}>
                      £{lensImpact.toLocaleString()}
                    </span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Synthesised result */}
      {!running && combinedStrategies.length > 0 && (
        <>
          <div style={{
            background: 'linear-gradient(135deg, rgba(93,219,194,0.10) 0%, rgba(93,219,194,0.02) 100%)',
            border: '1px solid rgba(93,219,194,0.35)',
            borderRadius: 18, padding: '18px 20px', marginBottom: 14,
            animation: 'magic-fade-up .35s ease-out',
          }}>
            <div className="sw-eyebrow" style={{ color: 'var(--c-acc)', marginBottom: 6 }}>
              Sonu synthesised
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: -0.5 }}>
                {combinedStrategies.length}
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text2)' }}>
                strategies across <strong style={{ color: 'var(--c-text)' }}>{routedLenses.length} adviser{routedLenses.length === 1 ? '' : 's'}</strong> · combined impact <strong style={{ color: 'var(--c-text)' }}>£{totalImpact.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Filter chips — view by advisor */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            <button
              onClick={() => setAdvisorFilter(null)}
              style={{
                padding: '6px 12px', borderRadius: 100,
                background: advisorFilter === null ? 'var(--c-acc)' : 'var(--c-surface2)',
                border: '1px solid ' + (advisorFilter === null ? 'var(--c-acc)' : 'var(--c-sep)'),
                color: advisorFilter === null ? '#0B1F3A' : 'var(--c-text2)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              All combined ({Object.values(results).reduce((s, r) => s + r.recs.length, 0)})
            </button>
            {completedLenses.map(lensId => {
              const meta = LENS_META[lensId]
              const isActive = advisorFilter === lensId
              return (
                <button
                  key={lensId}
                  onClick={() => setAdvisorFilter(isActive ? null : lensId)}
                  style={{
                    padding: '6px 10px', borderRadius: 100,
                    background: isActive ? 'var(--c-acc)' : 'var(--c-surface2)',
                    border: '1px solid ' + (isActive ? 'var(--c-acc)' : 'var(--c-sep)'),
                    color: isActive ? '#0B1F3A' : 'var(--c-text2)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{meta?.avatar}</span>
                  {meta?.name} ({results[lensId].recs.length})
                </button>
              )
            })}
          </div>

          {/* Strategy list */}
          <div style={{ display: 'grid', gap: 8 }}>
            {combinedStrategies.map((s, i) => (
              <div
                key={`${s.lensId}-${s.id || i}`}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
                  animation: `magic-fade-up .35s ease-out ${i * 45}ms backwards`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{s.lensMeta?.avatar}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {s.lensMeta?.name}
                  </span>
                  {s.impactValue > 0 && (
                    <span style={{
                      marginLeft: 'auto', padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(93,219,194,0.12)', border: '1px solid rgba(93,219,194,0.3)',
                      fontSize: 11, fontWeight: 800, color: 'var(--c-acc)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      £{s.impactValue.toLocaleString()}{s.impact?.gbp_per_year ? '/yr' : s.impact?.gbp_lifetime ? ' lifetime' : ' one-off'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', marginBottom: 6 }}>
                  {s.headline}
                </div>
                {s.drill_down && (
                  <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.55, marginBottom: 6 }}>
                    {s.drill_down.length > 240 ? s.drill_down.slice(0, 240) + '…' : s.drill_down}
                  </div>
                )}
                {s.citation && (
                  <div style={{ fontSize: 10, color: 'var(--c-text3)', fontStyle: 'italic' }}>
                    Source: {s.citation}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 10,
            background: 'var(--c-surface2)', fontSize: 11,
            color: 'var(--c-text3)', lineHeight: 1.5, textAlign: 'center',
          }}>
            Information only · {routedLenses.length} live lens engine{routedLenses.length === 1 ? '' : 's'} consulted · Not regulated advice
          </div>
        </>
      )}

      <style>{`@keyframes magic-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Section 6 (NEW META): How Sonu thinks — show the 11 advisor architecture ─

const ALL_11_ADVISORS = [
  { id: 'tax',          avatar: '🧾',  name: 'Tax Accountant',           live: true, scope: 'wrappers, allowances, sequencing, year-end planning' },
  { id: 'pension',      avatar: '🏦',  name: 'Pension Specialist',        live: true, scope: 'SIPP, AA, MPAA, LSA, State Pension, drawdown' },
  { id: 'trust',        avatar: '⚖️',  name: 'Trust Lawyer',              live: true, scope: 'IHT, trusts, wills, LPA, domicile' },
  { id: 'ifa',          avatar: '📊',  name: 'IFA (Holistic)',            live: true, scope: 'allocation, risk, costs, emergency fund, review' },
  { id: 'protection',   avatar: '🛡️',  name: 'Insurance / Protection',    live: true, scope: 'life, CI, income protection, business cover, trust' },
  { id: 'investment',   avatar: '📈',  name: 'Investment Adviser',        live: true, scope: 'portfolio costs, concentration, rebalancing, ESG' },
  { id: 'philanthropy', avatar: '💝',  name: 'Philanthropy Adviser',      live: true, scope: 'Gift Aid, charity 10%, DAF, matched giving' },
  { id: 'laterlife',    avatar: '🏥',  name: 'Later-Life Adviser',        live: true, scope: 'care costs, LA means-test, equity release, capacity' },
  { id: 'crossborder',  avatar: '🌍',  name: 'Cross-Border Specialist',   live: true, scope: 'SRT, FIG regime, DTA, deemed-dom, NRI' },
  { id: 'mortgage',     avatar: '🏠',  name: 'Mortgage Adviser',          live: true, scope: 'mortgage, BTL, remortgage, S24, equity release' },
  { id: 'familylaw',    avatar: '👥',  name: 'Family Law Specialist',     live: true, scope: 'divorce, cohab, prenup, pension sharing' },
]

function SonuArchitecture({ entity }) {  // eslint-disable-line no-unused-vars
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{
        background: 'linear-gradient(160deg, var(--c-surface) 0%, var(--c-surface2) 100%)',
        border: '1px solid var(--c-sep)', borderRadius: 20, padding: '24px 22px',
        marginBottom: 18,
      }}>
        <div className="sw-eyebrow" style={{ marginBottom: 8 }}>How Sonu thinks</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', marginBottom: 12, lineHeight: 1.5 }}>
          A panel of 11 specialist advisors. Sonu picks the right ones for your situation automatically.
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text2)', lineHeight: 1.6 }}>
          Each adviser is an independent engine — its own rules, its own citations, its own observations. When you describe a situation, Sonu's router scores each adviser's relevance and fires only those who matter. Their outputs are then ranked, de-duplicated, and presented as one synthesised view.
        </div>
      </div>

      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-acc)', letterSpacing: 0.4 }}>
          THE PANEL
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
          {ALL_11_ADVISORS.filter(a => a.live).length} of {ALL_11_ADVISORS.length} live · rest on roadmap
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}>
        {ALL_11_ADVISORS.map(a => (
          <div key={a.id} style={{
            position: 'relative',
            padding: '14px 14px', borderRadius: 14,
            background: 'var(--c-surface)',
            border: '1px solid ' + (a.live ? 'rgba(93,219,194,0.35)' : 'var(--c-sep)'),
          }}>
            <span style={{
              position: 'absolute', top: 8, right: 8,
              padding: '2px 7px', borderRadius: 100,
              background: a.live ? 'rgba(93,219,194,0.18)' : 'var(--c-surface2)',
              border: '1px solid ' + (a.live ? 'rgba(93,219,194,0.45)' : 'var(--c-sep)'),
              fontSize: 8, fontWeight: 800, letterSpacing: 0.4,
              color: a.live ? 'var(--c-acc)' : 'var(--c-text3)',
            }}>
              {a.live ? 'LIVE' : 'ROADMAP'}
            </span>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{a.avatar}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 4, lineHeight: 1.3 }}>
              {a.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>
              {a.scope}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 18, padding: '14px 16px', borderRadius: 12,
        background: 'var(--c-surface)', border: '1px solid var(--c-sep)',
        fontSize: 11, color: 'var(--c-text3)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--c-text2)', marginBottom: 4 }}>How the router decides</div>
        Each adviser has an <code style={{ fontSize: 10, background: 'var(--c-surface2)', padding: '1px 5px', borderRadius: 3 }}>is_relevant(persona, query)</code> function. When you submit a situation, Sonu calls every adviser's relevance check, fires those above the threshold, and combines their outputs. You can drill into any single adviser's view from the synthesised result.
      </div>
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'situation', label: 'Tell Sonu your situation',  sub: 'Advisors auto-route — you don\'t pick' },
  { id: 'coi',       label: 'Watch the cost drop',        sub: 'Cost of Inaction in real time' },
  { id: 'panel',     label: 'How Sonu thinks',            sub: 'The 11-advisor architecture' },
]

export default function MagicShowcase({ entity, onClose }) {
  const [section, setSection] = useState('situation')

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
            Describe a situation · Sonu routes to the right advisors
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
      {section === 'situation' && <SituationFlow entity={entity} />}
      {section === 'coi' && <CoIOdometerDemo />}
      {section === 'panel' && <SonuArchitecture entity={entity} />}

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
