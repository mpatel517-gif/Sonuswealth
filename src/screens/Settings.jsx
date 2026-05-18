// Settings.jsx — Telegram-style settings overlay
// ─────────────────────────────────────────────────────────────────────────────
// Spec: 2-Product/2-Product-settings-master-v1_5.md — 13 user-facing sections.
// Phase-1 sections are live; Phase-2 sections show titled stubs with an honest
// "Phase 2 — coming next" sub-label (project CLAUDE.md §9). Nothing in here
// fakes functionality that doesn't exist yet.
//
//   §S1  Profile & Identity        — live (read-only)
//   §S2  Households & Sharing      — Phase 2 stub
//   §S3  Connected Services        — Phase 2 stub
//   §S4  Privacy & Security        — Phase 2 stub
//   §S5  Feeds & Reports           — live IFA row + Phase 2 stub
//   §S6  Notifications             — Phase 2 stub
//   §S7  Personalisation           — live (theme, hide-balances, longevity)
//   §S-plans Plans                  — live, reads planFor() from engine
//   §S8  Data & Documents          — Phase 2 stub
//   §S9  Help & Support            — Phase 2 stub
//   §S10 Subscription & Billing    — Phase 2 stub
//   §S11 Regulatory & Compliance   — Phase 2 stub
//   §S12 About & Legal             — live (version + disclaimer)
//
// Tax Rules detail panel hangs off §S12 About (not its own section — per spec).
// Wealth Score row removed from Settings entirely per spec §Q1B.3 (canonical
// home is Home tab).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { BRAND } from '../config/brand.js'
import {
  calcFQ, fqBand, fmt,
  planFor, planStaleness,
  SCORING_VERSION, RISK_VERSION,
  TAX,
} from '../engine/fq-calculator.js'
import OverlayShell from '../components/shared/OverlayShell.jsx'

// Longevity bands — conservative/median/optimistic. Sourced here so the
// component reads consistent values; engine support comes in s02a.
const LONGEVITY_BANDS = [
  { id: 'conservative', age: 85, label: 'Conservative' },
  { id: 'median',       age: 88, label: 'Median'       },
  { id: 'optimistic',   age: 92, label: 'Optimistic'   },
]

// Plan types we surface in Settings — read via planFor() stub today.
const PLAN_TYPES = [
  { id: 'protection', label: 'Protection plan', glyph: '⛨', tab: 'money'    },
  { id: 'drawdown',   label: 'Drawdown plan',   glyph: '⊿', tab: 'flow'     },
  { id: 'estate',     label: 'Estate plan',     glyph: '◇', tab: 'tax'      },
  { id: 'cashflow',   label: 'Cashflow plan',   glyph: '≋', tab: 'flow'     },
]

// Inline pill selector for longevity band.
function LongevityPill({ value, onChange }) {
  return (
    <div style={{
      display:'flex', background:'var(--c-surface2)',
      borderRadius:100, padding:3, gap:2,
    }}>
      {LONGEVITY_BANDS.map(b => (
        <button
          key={b.id}
          onClick={() => onChange?.(b.id)}
          style={{
            background: value === b.id ? 'var(--c-acc)' : 'transparent',
            color:      value === b.id ? '#fff' : 'var(--c-text2)',
            border:'none', cursor:'pointer',
            padding:'6px 10px', borderRadius:100,
            fontSize:'var(--fs-small)', fontWeight:600,
            transition:'background .15s',
          }}
        >
          {b.age}
        </button>
      ))}
    </div>
  )
}

// Plan list item — shows staleness chip if engine flags it.
function PlanRow({ entity, planType, onNav, onClose }) {
  const plan = planFor(entity, planType.id)
  const stale = planStaleness(entity, planType.id) || { stale: false, severity: 'none' }
  const exists = plan != null

  const chipColour = stale.stale
    ? (stale.severity === 'high' ? 'var(--c-acc3)' : 'var(--c-gold)')
    : 'var(--c-acc)'
  const chipLabel = exists
    ? (stale.stale ? 'Stale' : 'Current')
    : 'Not started'

  function handleClick() {
    if (planType.tab && onNav) {
      onClose?.()
      onNav(planType.tab)
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 16px',
        borderBottom:'1px solid var(--c-sep)',
        cursor: planType.tab && onNav ? 'pointer' : 'default',
      }}>
      <div style={{
        width:28, height:28, borderRadius:7,
        background: exists ? 'var(--c-acc-bg)' : 'var(--c-surface2)',
        color: exists ? 'var(--c-acc)' : 'var(--c-text3)',
        fontSize:'var(--fs-body)', fontWeight:700,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        {planType.glyph}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'var(--fs-body)', fontWeight:500, color:'var(--c-text)' }}>
          {planType.label}
        </div>
        <div style={{ fontSize:'var(--fs-label)', color:'var(--c-text3)', marginTop:2 }}>
          {exists
            ? `Last reviewed: ${plan.lastReviewedAt ? new Date(plan.lastReviewedAt).toISOString().slice(0,10) : '—'}`
            : 'No active plan'}
        </div>
      </div>
      <div style={{
        fontSize:'var(--fs-label)', fontWeight:700, color: chipColour,
        background: `${chipColour}1a`, padding:'3px 8px', borderRadius:100,
      }}>
        {chipLabel}
      </div>
      {planType.tab && onNav && (
        <span style={{ color:'var(--c-text3)', fontSize:'var(--fs-title)', flexShrink:0 }}>›</span>
      )}
    </div>
  )
}

// Coloured icon badge — square, rounded, solid colour background
function Badge({ colour, glyph }) {
  return (
    <div style={{
      width:28, height:28, borderRadius:7, background:colour,
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, color:'#fff', fontSize:'var(--fs-body)', fontWeight:700,
      fontFamily:'DM Sans, sans-serif',
    }}>{glyph}</div>
  )
}

// Single row — icon | label | value | chevron
function Row({ colour, glyph, label, value, onClick, phase2=false, danger=false, last=false }) {
  return (
    <div
      onClick={phase2 ? undefined : onClick}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--c-sep)',
        cursor: (phase2 || !onClick) ? 'default' : 'pointer',
        opacity: phase2 ? 0.55 : 1,
      }}>
      <Badge colour={colour} glyph={glyph}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'var(--fs-body)',
          fontWeight: danger ? 700 : 500,
          color: danger ? 'var(--c-coral-text)' : 'var(--c-text)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {label}
        </div>
        {phase2 && (
          <div style={{ fontSize:'var(--fs-label)', color:'var(--c-text3)',
            marginTop:2, textTransform:'uppercase', letterSpacing:0.8 }}>
            Coming in Phase 2
          </div>
        )}
      </div>
      {value != null && (
        <div style={{ fontSize:'var(--fs-small)', color:'var(--c-text3)',
          maxWidth:150, overflow:'hidden', textOverflow:'ellipsis',
          whiteSpace:'nowrap', textAlign:'right' }}>
          {value}
        </div>
      )}
      {!phase2 && !danger && onClick && (
        <span style={{ color:'var(--c-text3)', fontSize:'var(--fs-title)',
          flexShrink:0 }}>›</span>
      )}
    </div>
  )
}

// Section wrapper — header + group of rows
function Section({ title, children }) {
  return (
    <>
      <div style={{ fontSize:'var(--fs-label)', fontWeight:700,
        color:'var(--c-text3)', textTransform:'uppercase', letterSpacing:0.8,
        padding:'16px 16px 6px' }}>
        {title}
      </div>
      <div style={{ background:'var(--c-surface)',
        borderTop:'1px solid var(--c-sep)',
        borderBottom:'1px solid var(--c-sep)' }}>
        {children}
      </div>
    </>
  )
}

// Detail sub-panel — shown when user taps a row that drills in
function DetailPanel({ title, onBack, children }) {
  return (
    <div style={{ position:'absolute', inset:0, background:'var(--c-bg)',
      display:'flex', flexDirection:'column', zIndex:2 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12,
        padding:'12px 16px 10px',
        borderBottom:'1px solid var(--c-sep)', background:'var(--c-bg)',
        flexShrink:0 }}>
        <button onClick={onBack}
          style={{ background:'none', border:'none', color:'var(--c-acc)',
            fontSize:'var(--fs-body)', fontWeight:600, cursor:'pointer',
            padding:0 }}>← Back</button>
        <div style={{ fontSize:'var(--fs-title)', fontWeight:700,
          color:'var(--c-text)' }}>{title}</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 0 24px' }}>
        {children}
      </div>
    </div>
  )
}

// Info row — label on left, value on right, used inside detail panels
function InfoRow({ label, value, last=false }) {
  return (
    <div style={{ display:'flex', alignItems:'center',
      padding:'12px 16px', gap:12,
      borderBottom: last ? 'none' : '1px solid var(--c-sep)' }}>
      <div style={{ fontSize:'var(--fs-body)', color:'var(--c-text2)', flex:1 }}>
        {label}
      </div>
      <div style={{ fontSize:'var(--fs-body)', color:'var(--c-text)',
        fontWeight:600, textAlign:'right',
        maxWidth:180, overflow:'hidden', textOverflow:'ellipsis',
        whiteSpace:'nowrap' }}>
        {value}
      </div>
    </div>
  )
}

// Pill toggle — Dark / Light selector
function ThemePill({ value, onChange }) {
  const opts = [
    { id:'dark',  label:'Dark'  },
    { id:'light', label:'Light' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--c-surface2)',
      borderRadius:100, padding:3, gap:2 }}>
      {opts.map(o => (
        <button key={o.id} onClick={() => onChange?.(o.id)}
          style={{
            background: value === o.id ? 'var(--c-acc)' : 'transparent',
            color: value === o.id ? '#fff' : 'var(--c-text2)',
            border:'none', cursor:'pointer',
            padding:'6px 14px', borderRadius:100,
            fontSize:'var(--fs-small)', fontWeight:600,
            transition:'background .15s',
          }}>{o.label}</button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
// ─── Local persistence keys (S-2/S-3 quick fix) ─────────────────────────────
// TODO migrate to event-sourced state via EventsProvider — see src/state/events.jsx
// (spec §S7.5 SETTINGS_TEMPORAL_PREFS_CHANGED + §Q1B.1 X6 hide-balances).
// localStorage is a stop-gap so reload preserves the toggle; cross-tab read
// still requires consumers to read the same key (e.g. <Num/> via useEffect).
const LS_HIDE_BALANCES = 'sonus.settings.hideBalances'
const LS_LONGEVITY     = 'sonus.settings.longevity'

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch { return fallback }
}
function writeLS(key, value) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export default function Settings({ entity, theme='dark', onThemeChange, onClose, onHome, onNav }) {
  const [detail, setDetail] = useState(null)   // null | 'profile' | 'financial' | ...
  const [hideBalances, setHideBalances] = useState(() => readLS(LS_HIDE_BALANCES, false))
  const [longevity,    setLongevity]    = useState(() =>
    readLS(LS_LONGEVITY, entity?.longevityBand || 'median')
  )

  // Persist to localStorage on change (stop-gap for engine event integration).
  useEffect(() => { writeLS(LS_HIDE_BALANCES, hideBalances) }, [hideBalances])
  useEffect(() => { writeLS(LS_LONGEVITY,    longevity)     }, [longevity])

  const fq   = calcFQ(entity)
  const band = fqBand(fq.total)

  const rulesVer = entity.rulesVersion || BRAND.rulesVersion
  const dataDate = entity.dataLastUpdated || BRAND.dataDate

  // Escape handled by OverlayShell; local escape here only for detail drill-down
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && detail) { setDetail(null); e.stopPropagation() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [detail])

  return (
    <OverlayShell
      title="Settings"
      onBack={() => { if (detail) setDetail(null); else onClose?.() }}
      onHome={onHome}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Scroll body */}
        <div style={{ flex:1 }}>
          {/* Identity header */}
          <div style={{ textAlign:'center', padding:'20px 16px 8px' }}>
            <div style={{
              width:64, height:64, borderRadius:'50%',
              background:'linear-gradient(135deg,var(--c-acc),var(--c-acc2))',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontSize:24, fontWeight:700, margin:'0 auto 10px',
              fontFamily:'DM Sans,sans-serif',
            }}>
              {(entity.displayName || entity.name || '?').charAt(0)}
            </div>
            <div style={{ fontSize:'var(--fs-hero)', fontWeight:800,
              color:'var(--c-text)' }}>
              {entity.displayName || entity.name}
            </div>
            <div style={{ fontSize:'var(--fs-small)', color:'var(--c-text3)',
              marginTop:4, textTransform:'uppercase', letterSpacing:0.8 }}>
            Stage {entity?.lifeStage ?? '—'} · {entity?.lifeStageName ?? '—'}
          </div>
        </div>

        {/* §S1 — Profile & Identity + Financial Details */}
        <Section title="Profile & identity">
          <Row colour="#4D8EFF" glyph="@"
            label="My Profile"
            value={entity.displayName || entity.name}
            onClick={() => setDetail('profile')}/>
          <Row colour="#00E5A8" glyph="£"
            label="Financial Details"
            value="View"
            onClick={() => setDetail('financial')}
            last={true}/>
        </Section>

        {/* §S2 — Households & Sharing (Phase 2 stub) */}
        <Section title="Households & sharing">
          <Row colour="#FF9500" glyph="⌂"
            label="Households" phase2={true} last={true}/>
        </Section>

        {/* §S3 — Connected Services (Phase 2 stub) */}
        <Section title="Connected services">
          <Row colour="#FFB347" glyph="⚲"
            label="Connected accounts" phase2={true} last={true}/>
        </Section>

        {/* §S4 — Privacy & Security (Phase 2 stub) */}
        <Section title="Privacy & security">
          <Row colour="#FF453A" glyph="▲"
            label="Security" phase2={true} last={true}/>
        </Section>

        {/* §S5 — Feeds & Reports (IFA Access lives here per spec §Q1B.1) */}
        <Section title="Feeds & reports">
          <Row colour="#AF52DE" glyph="◆"
            label="IFA Access"
            value={entity.type === 'ifa' ? 'IFA account' : 'No IFA linked'}
            onClick={() => setDetail('ifa')}/>
          <Row colour="#8A4AF5" glyph="❑"
            label="Reports & feeds" phase2={true} last={true}/>
        </Section>

        {/* §S6 — Notifications (Phase 2 stub) */}
        <Section title="Notifications">
          <Row colour="#FF9500" glyph="◔"
            label="Notifications" phase2={true} last={true}/>
        </Section>

        {/* §S7 — Personalisation (theme + hide-balances + longevity → Plans below) */}
        <Section title="Personalisation">
          <div style={{ display:'flex', alignItems:'center', gap:12,
            padding:'12px 16px', borderBottom:'1px solid var(--c-sep)' }}>
            <Badge colour="#8A4AF5" glyph="◐"/>
            <div style={{ flex:1, fontSize:'var(--fs-body)',
              color:'var(--c-text)' }}>Theme</div>
            <ThemePill value={theme} onChange={onThemeChange}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12,
            padding:'12px 16px' }}>
            <Badge colour="#607D8B" glyph="⊘"/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'var(--fs-body)', color:'var(--c-text)' }}>
                Hide balances
              </div>
              <div style={{ fontSize:'var(--fs-small)', color:'var(--c-text3)',
                marginTop:2 }}>
                Replaces £ amounts with ••••
              </div>
            </div>
            <button
              onClick={() => setHideBalances(v => !v)}
              style={{
                background: hideBalances ? 'var(--c-acc)' : 'var(--c-surface2)',
                border:'none', borderRadius:100, width:44, height:26,
                cursor:'pointer', position:'relative', padding:0,
                transition:'background .15s',
              }}
              aria-pressed={hideBalances}>
              <div style={{
                width:20, height:20, borderRadius:'50%', background:'#fff',
                position:'absolute', top:3, left: hideBalances ? 21 : 3,
                transition:'left .15s',
              }}/>
            </button>
          </div>
        </Section>

        {/* §S-plans — longevity + plans list (spec heading: "Plans") */}
        <Section title="Plans">
          <div style={{ display:'flex', alignItems:'center', gap:12,
            padding:'12px 16px', borderBottom:'1px solid var(--c-sep)' }}>
            <Badge colour="#FF9500" glyph="∞"/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'var(--fs-body)', color:'var(--c-text)' }}>
                Longevity band
              </div>
              <div style={{ fontSize:'var(--fs-small)', color:'var(--c-text3)', marginTop:2 }}>
                Plan to age {LONGEVITY_BANDS.find(b => b.id === longevity)?.age || 88}
              </div>
            </div>
            <LongevityPill value={longevity} onChange={setLongevity} />
          </div>
          {PLAN_TYPES.map(pt => (
            <PlanRow key={pt.id} entity={entity} planType={pt} onNav={onNav} onClose={onClose} />
          ))}
        </Section>

        {/* §S8 — Data & Documents (Phase 2 stub) */}
        <Section title="Data & documents">
          <Row colour="#34C759" glyph="▣"
            label="Document vault" phase2={true} last={false}/>
          <Row colour="#607D8B" glyph="⤓"
            label="Export & delete" phase2={true} last={true}/>
        </Section>

        {/* §S9 — Help & Support (Phase 2 stub) */}
        <Section title="Help & support">
          <Row colour="#4D8EFF" glyph="?"
            label="Help & support" phase2={true} last={true}/>
        </Section>

        {/* §S10 — Subscription & Billing (Phase 2 stub) */}
        <Section title="Subscription & billing">
          <Row colour="#FF453A" glyph="$"
            label="Subscription & billing" phase2={true} last={true}/>
        </Section>

        {/* §S11 — Regulatory & Compliance (Phase 2 stub) */}
        <Section title="Regulatory & compliance">
          <Row colour="#6B7280" glyph="◱"
            label="Compliance & disclaimers" phase2={true} last={true}/>
        </Section>

        {/* §S12 — About & Legal (tax rules detail hangs off here) */}
        <Section title="About & legal">
          <Row colour="#FFB347" glyph="§"
            label="Tax Rules"
            value={rulesVer}
            onClick={() => setDetail('taxrules')}/>
          <Row colour="#4D8EFF" glyph="i"
            label={`About ${BRAND.name}`}
            value={`v${BRAND.version}`}
            onClick={() => setDetail('about')}
            last={true}/>
        </Section>

        {/* Sign out */}
        <div style={{ padding:'20px 16px 12px' }}>
          <div style={{ background:'var(--c-surface)',
            borderTop:'1px solid var(--c-sep)',
            borderBottom:'1px solid var(--c-sep)' }}>
            <Row colour="#FF453A" glyph="→" label="Sign Out"
              danger={true}
              onClick={() => {
                // No auth wired yet (FP-5) — returns to Welcome via parent
                onClose?.()
                if (typeof window !== 'undefined') window.location.href = '/'
              }}
              last={true}/>
          </div>
        </div>

        <div style={{ textAlign:'center', fontSize:'var(--fs-small)',
          color:'var(--c-text3)', padding:'8px 24px 20px', lineHeight:1.6 }}>
          {BRAND.name} · {BRAND.rulesLabel(rulesVer, dataDate)}<br/>
          Not financial advice
        </div>

        <div style={{ height:24 }}/>
      </div>

      {/* ── DETAIL PANELS ─────────────────────────────────────────────────── */}

      {detail === 'profile' && (
        <DetailPanel title="My Profile" onBack={() => setDetail(null)}>
          <InfoRow label="Name"        value={entity.displayName || entity.name || '—'}/>
          <InfoRow label="Age"         value={entity.age || '—'}/>
          <InfoRow label="Life stage"  value={`${entity?.lifeStage ?? '—'} · ${entity?.lifeStageName ?? '—'}`}/>
          <InfoRow label="Jurisdiction"
            value={entity?.jurisdictionContext?.primary || 'United Kingdom'}/>
          <InfoRow label="Type"        value={entity.type || 'individual'}/>
          <InfoRow label="Entity ID"   value={entity.id || '—'} last={true}/>
          <div style={{ padding:'16px', fontSize:'var(--fs-small)',
            color:'var(--c-text3)', lineHeight:1.5 }}>
            Profile editing is coming in Phase 2. For now, these values are
            defined in your persona file.
          </div>
        </DetailPanel>
      )}

      {detail === 'financial' && (
        <DetailPanel title="Financial Details" onBack={() => setDetail(null)}>
          <InfoRow label="Target income"
            value={entity.targetIncome ? `${fmt(entity.targetIncome)}/yr` : '—'}/>
          <InfoRow label="Higher-rate taxpayer"
            value={entity.isHigherRateTaxpayer ? 'Yes' : 'No'}/>
          <InfoRow label="Drawdown"
            value={entity.drawdown ? `${fmt(entity.drawdown)}/yr` : 'Not started'}/>
          <InfoRow label="Net worth"
            value={fq.netWorthVal ? fmt(fq.netWorthVal) : '—'} last={true}/>
          <div style={{ padding:'16px', fontSize:'var(--fs-small)',
            color:'var(--c-text3)', lineHeight:1.5 }}>
            These figures are used to calculate your Wealth Score. Editing is
            coming in Phase 2 once account linking is live.
          </div>
        </DetailPanel>
      )}

      {detail === 'ifa' && (
        <DetailPanel title="IFA Access" onBack={() => setDetail(null)}>
          {entity.type === 'ifa' ? (
            <>
              <InfoRow label="Account type"  value="Independent Financial Adviser"/>
              <InfoRow label="Firm"          value={entity.firmName || '—'}/>
              <InfoRow label="Client count"  value={entity.clientCount || '—'} last={true}/>
            </>
          ) : (
            <>
              <InfoRow label="Linked IFA" value="None" last={true}/>
              <div style={{ padding:'16px', fontSize:'var(--fs-small)',
                color:'var(--c-text3)', lineHeight:1.5 }}>
                Link an IFA to share your Sonuswealth profile securely. Feature
                coming in Phase 2.
              </div>
            </>
          )}
        </DetailPanel>
      )}

      {detail === 'taxrules' && (
        <DetailPanel title="Tax Rules" onBack={() => setDetail(null)}>
          <InfoRow label="Rules version" value={rulesVer}/>
          <InfoRow label="Data as of"    value={dataDate}/>
          <InfoRow label="Jurisdiction"
            value={entity?.jurisdictionContext?.primary || 'United Kingdom'}/>
          <InfoRow label="Tax year"      value={`${TAX.taxYear ?? '2026/27'} UK`}/>
          <InfoRow label="Applied since" value={BRAND.appliedSince}/>
          <InfoRow label="Next rules change" value={BRAND.nextRulesDate} last={true}/>
          <div style={{ padding:'16px', fontSize:'var(--fs-small)',
            color:'var(--c-text3)', lineHeight:1.5 }}>
            {`Your Wealth Score is calculated against the rules version shown. When rules change (next: ${BRAND.nextRulesDate}), you'll be notified and your score will recalculate automatically.`}
          </div>
        </DetailPanel>
      )}

      {/* finioscore detail panel removed — Wealth Score belongs on Home per
          spec §Q1B.3 (Settings does NOT own the score). */}

      {detail === 'about' && (
        <DetailPanel title={`About ${BRAND.name}`} onBack={() => setDetail(null)}>
          <InfoRow label="App"              value={BRAND.name}/>
          <InfoRow label="Version"          value={`v${BRAND.version}`}/>
          <InfoRow label="Rules bundle"     value={BRAND.rulesBundle}/>
          <InfoRow label="Applied since"    value={BRAND.appliedSince}/>
          <InfoRow label="Next rules date"  value={BRAND.nextRulesDate}/>
          <InfoRow label="Data last updated" value={dataDate}/>
          <InfoRow label="Scoring engine"   value={SCORING_VERSION}/>
          <InfoRow label="Risk engine"      value={RISK_VERSION} last={true}/>
          <div style={{ padding:'16px', fontSize:'var(--fs-small)',
            color:'var(--c-text3)', lineHeight:1.6 }}>
            {BRAND.disclaimer}
            {'\n\n'}
            {BRAND.name} does not provide financial advice. All figures are
            educational estimates based on data you've provided and current
            tax rules. Consult a qualified adviser before making financial
            decisions.
          </div>
        </DetailPanel>
      )}
      </div>
    </OverlayShell>
  )
}
