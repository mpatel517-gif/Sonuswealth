// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx — Session 1 rewrite (22 April 2026)
// Changes vs prior:
//   · Uses OverlayShell for FQBreakdown + PersonaSwitcher (D08 / DQ-42)
//   · Threads persona + onCommit callback to children (HomeScreenJit, MyMoney)
//   · Wires Ask tab navigation for SimulatorPanel's onAskAI prop (D05)
//   · FQBreakdown now gets initialTab='actions' when activeDim is set (D04)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react'
import { TemporalModeProvider } from '../state/temporalMode.jsx'
import HomeScreen    from './HomeScreen.jsx'
import FQBreakdown   from './FQBreakdown.jsx'
import MyMoney       from './MyMoney.jsx'
import Cashflow      from './Cashflow.jsx'
import TaxEstate     from './TaxEstate.jsx'
import Risk          from './Risk.jsx'
import RiskOverlay   from './RiskOverlay.jsx'
import Timeline      from './Timeline.jsx'
import Ask           from './Ask.jsx'
import Settings      from './Settings.jsx'
import OverlayShell    from '../components/shared/OverlayShell.jsx'
import AskPill         from '../components/shared/AskPill.jsx'
import ThemeTogglePill from '../components/shared/ThemeTogglePill.jsx'
import DetailOverlay   from '../components/shared/DetailOverlay.jsx'
import Whisper         from '../components/shared/Whisper.jsx'
import DataCapture     from './DataCapture.jsx'
import Vault           from './Vault.jsx'
import NotificationCentre from './NotificationCentre.jsx'
import Reports         from './Reports.jsx'
import IFAPractice     from './IFAPractice.jsx'
import DecisionEngine  from './DecisionEngine.jsx'
import DecisionEngineV2 from './DecisionEngineV2.jsx'
import MagicShowcase   from './MagicShowcase.jsx'
// MyMoney sub-routes — section-nav chip targets (founder direction 2026-05-26):
// each chip is a full-page route, not a scroll anchor. These render in the
// money/* tab id namespace alongside the existing single-letter tabs.
import MoneyIncome     from './MoneyIncome.jsx'
import ErrorBoundary   from '../components/shared/ErrorBoundary.jsx'

// L1-3: per-route fallback that preserves outer chrome (TopBar, Sidebar,
// FCA footer) when a single tab crashes. The user can switch tabs and
// continue rather than seeing the full-page boundary.
function inlineTabFallback({ error, scope, onRetry, onReload }) {
  return (
    <div role="alert" aria-live="assertive" style={{
      padding: '32px 20px', textAlign: 'center', color: 'var(--c-text)',
    }}>
      <div style={{
        display: 'inline-block', maxWidth: 480, padding: 24, borderRadius: 16,
        background: 'var(--c-surface)', border: '1px solid var(--c-border)',
        boxShadow: 'var(--sh1)', textAlign: 'left',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--c-coral, #FF6F7D)', marginBottom: 8,
        }}>
          {scope || 'View'} crashed
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
          We hit an error rendering this view.
        </h2>
        <p style={{ fontSize: 13, color: 'var(--c-text2)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Other tabs still work. Try again, or switch to another view.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onRetry} style={{
            padding: '8px 14px', borderRadius: 100, background: 'var(--c-acc)',
            color: '#000', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            Try again
          </button>
          <button type="button" onClick={onReload} style={{
            padding: '8px 14px', borderRadius: 100, background: 'var(--c-surface2)',
            color: 'var(--c-text)', border: '1px solid var(--c-border)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Reload
          </button>
        </div>
        {(typeof import.meta !== 'undefined' && import.meta.env?.DEV) && error?.message && (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--c-text3)', fontFamily: 'ui-monospace, monospace' }}>
            {String(error.message).slice(0, 200)}
          </div>
        )}
      </div>
    </div>
  )
}
import MoneyProtection from './MoneyProtection.jsx'
import MoneyBusiness   from './MoneyBusiness.jsx'
import MoneyTrusts     from './MoneyTrusts.jsx'
import Sidebar         from '../components/Shell/Sidebar.jsx'
// Founder feedback 2026-05-28: TY chip should be present on every page.
// Hoist to Dashboard top-chrome so all routes inherit it (was only on
// Cashflow / MyMoney / TaxEstate / Timeline via X28TopBar; missing on
// Home, Risk, and the MoneyX sub-routes' chrome row).
import { TIME_WINDOWS } from '../components/shared/X28TopBar.jsx'
import YearStepper from '../components/shared/YearStepper.jsx'
import useTaxYear        from '../hooks/useTaxYear.jsx'
// P12-1 (2026-05-28) AppShell migration: centralised FCA disclaimer footer +
// canonical chrome slot for future ChromeBar (tax-year filter, mode strip).
import FCADisclaimerFooter from '../components/Shell/FCADisclaimerFooter.jsx'
import { driver }      from '../engine/driver-engine.js'
import { readDrill, recordDrill, drillAsWhisper } from '../state/drillMemory.js'
// S1 selector migration (Phase 2)
import { fq as calcFQ } from '../engine/selectors/index.js'
import { fqBand, calcAPQ, calcRisk, riskBand, fmt, totalCoI } from '../engine/fq-calculator.js'
import { useRipple } from '../state/ripple.jsx'
import { getWealthTarget, gapDims as gapDimsVsTarget } from '../config/wealth-targets.js'
import { useEvents } from '../state/events.jsx'

// Ask is no longer a tab — it's a persistent floating pill (D-ASK-1).
const TABS = [
  { id:'home',  label:'Overview',  icon:'⌂' },
  { id:'money', label:'My Money', icon:'◈' },
  { id:'flow',  label:'Cashflow', icon:'≋' },
  { id:'tax',   label:'Tax',      icon:'⚖' },
  { id:'risk',  label:'Risk',     icon:'◉' },
  { id:'timeline',  label:'Timeline', icon:'◷' },
]
// Decisions intentionally NOT a nav tab (founder 2026-06-06: too much clutter).
// They live as categorised "Decisions you can make here" drawers on the screen
// that owns each topic (My Money / Cashflow / Tax & Estate / Risk). The full
// catalogue (grouped) remains reachable via More (⋯) → All decisions (40).

// ─── Global Tax Year chip ───────────────────────────────────────────────
// Founder feedback 2026-05-28: TY selector must be visible on every page.
// Thin chrome strip rendered between top-bar and screen content. Persists
// to localStorage.sonuswealth.temporal (same key as X28TopBar) so the per-
// screen X28TopBar instances on Cashflow/MyMoney/TaxEstate/Timeline reflect
// the same selection automatically via the 'sonus:taxyear' event bus.
const TY_STORE_KEY = 'sonuswealth.temporal'

function GlobalTaxYearChip({ onOpenReports }) {
  const ty = useTaxYear()
  const current = TIME_WINDOWS.find(w => w.id === ty.window) || TIME_WINDOWS[0]

  function handleChange(newWindowId) {
    try {
      const raw = localStorage.getItem(TY_STORE_KEY)
      const prev = raw ? JSON.parse(raw) : {}
      // W1 coherence (2026-06-01): mirror X28TopBar.pickWindow — when the
      // selected window has a defaultMode, write viewMode too so the per-screen
      // X28TopBar instances and MyMoney lens all switch together. Without this
      // the GlobalTaxYearChip changes the window but tiles stay on 'actual',
      // so the projected horizon and the lens are out of sync.
      const selectedWindow = TIME_WINDOWS.find(w => w.id === newWindowId)
      const newViewMode = selectedWindow?.defaultMode ?? prev.viewMode ?? 'actual'
      const next = { ...prev, window: newWindowId, viewMode: newViewMode, ts: Date.now() }
      localStorage.setItem(TY_STORE_KEY, JSON.stringify(next))
      // Same-tab consumers (X28TopBar on other routes, useTaxYear() hooks).
      window.dispatchEvent(new Event('sonus:taxyear'))
    } catch (_e) { /* localStorage unavailable — silent */ }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 16px', flexShrink: 0, gap: 8,
      borderBottom: '1px solid var(--c-sep)',
      background: 'var(--c-surface)',
      fontSize: 12,
    }}>
      <label
        title="HORIZON — where in time you're looking (a projection viewpoint). Does not change which year's tax law applies; that's the RULES year on the right."
        style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--c-text3)', cursor: 'pointer',
      }}>
        <span aria-hidden="true">⏱</span>
        <span className="sw-eyebrow" style={{ fontSize: 10, letterSpacing: 0.5 }}>Horizon</span>
        <select
          value={current.id}
          onChange={e => handleChange(e.target.value)}
          aria-label="Projection horizon selector"
          style={{
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text)', borderRadius: 999,
            padding: '4px 10px', minHeight: 28,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {TIME_WINDOWS.map(w => (
            <option key={w.id} value={w.id}>{w.full}</option>
          ))}
        </select>
      </label>
      {/* Rule-year stepper owns WHICH tax year's rules apply (founder 2026-06-08),
          separate from the horizon dropdown on the left. The raw bundle id stays
          internal — the stepper surfaces only the friendly year. A divider makes
          the two controls read as distinct, not a single time-axis. */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {onOpenReports && (
          <>
            <button
              type="button"
              onClick={onOpenReports}
              aria-label="Open reports and financial statements"
              title="Reports & financial statements"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                color: 'var(--c-text2)', borderRadius: 999, padding: '4px 10px',
                minHeight: 28, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span aria-hidden="true">📊</span>
              <span className="sw-reports-pill-label">Reports</span>
            </button>
            <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--c-sep)' }} />
          </>
        )}
        <YearStepper />
      </div>
    </div>
  )
}

// ─── Persona switcher — now inside an OverlayShell-like pattern ──────────
function PersonaSwitcher({ personaList, currentPersona, onSelect, onClose }) {
  const TYPE_COLOURS = {
    individual: '#4D8EFF', couple: '#00E5A8', business: '#FFB347',
    ifa: '#AF52DE', life_arc: '#FF9500', nri: '#FF6B6B',
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel" style={{ maxHeight:'80vh' }}>
        <div className="sheet-handle" />
        <div style={{ fontSize:15, fontWeight:800, color:'var(--c-text)',
          marginBottom:16 }}>
          Demo Personas
        </div>
        {personaList.map(p => {
          const isCurrent = currentPersona === p.id ||
            (p.snapshots && p.snapshots.some(s => s.id === currentPersona))
          const col = TYPE_COLOURS[p.type] || '#4D8EFF'
          return (
            <div key={p.id}>
              <div onClick={() => !p.snapshots && onSelect(p.id)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'11px 0',
                  borderBottom:'1px solid var(--c-sep)',
                  cursor: p.snapshots ? 'default' : 'pointer',
                  opacity: 1,
                }}>
                <div style={{
                  width:36, height:36, borderRadius:10, flexShrink:0,
                  background: isCurrent ? col : `${col}22`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:800,
                  color: isCurrent ? (col === '#FFB347' ? '#0B1F3A' : '#fff') : col,
                }}>
                  {p.badge}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600,
                    color:'var(--c-text)' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize:11, color:'var(--c-text3)',
                    marginTop:1 }}>
                    {p.sub}
                  </div>
                </div>
                {isCurrent && !p.snapshots && (
                  <div style={{ fontSize:11, fontWeight:700, color:col,
                    background:`${col}18`, padding:'2px 8px',
                    borderRadius:100 }}>
                    Active
                  </div>
                )}
              </div>

              {p.snapshots && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap',
                  padding:'8px 0 12px 48px',
                  borderBottom:'1px solid var(--c-sep)' }}>
                  {p.snapshots.map(s => {
                    const active = currentPersona === s.id
                    return (
                      <button key={s.id} onClick={() => onSelect(s.id)} style={{
                        padding:'5px 12px', borderRadius:100,
                        fontSize:13, fontWeight:600, cursor:'pointer',
                        background: active ? col : `${col}18`,
                        color: active ? '#fff' : col,
                        border: `1px solid ${active ? col : `${col}33`}`,
                      }}>
                        Age {s.age}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <button onClick={onClose} style={{ width:'100%', marginTop:16,
          background:'var(--c-surface2)', border:'1px solid var(--c-sep)',
          borderRadius:100, padding:'13px 0', fontSize:14,
          fontWeight:600, color:'var(--c-text2)', cursor:'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

// Valid tab ids — top-level tabs + MyMoney sub-routes. The MyMoney sub-routes
// keep the bottom-nav "My Money" highlighted (see isMoneyTab below) so the
// user never feels lost between Income, Protection, Business, and the Balance
// Sheet root.
const VALID_TABS = [
  'home', 'money', 'flow', 'tax', 'risk', 'timeline', 'decisions',
  'money/income', 'money/protection', 'money/business', 'money/trusts',
]

function readTabParam() {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('tab')
  // Migration shim: legacy 'plan' id → 'timeline' (rename 2026-05-15, coord FIX-10).
  const p = raw === 'plan' ? 'timeline' : raw
  return VALID_TABS.includes(p) ? p : null
}

// MyMoney sub-routes still belong to the "money" bottom-nav lane.
function isMoneyTab(tab) {
  return tab === 'money' || tab.startsWith('money/')
}

export default function Dashboard({ entity, persona, personaList, onSwitchPersona, theme, onThemeChange }) {
  const [tab,          setTab]          = useState(readTabParam() || 'home')

  // Back-routing memory (2026-05-28). Most screens currently pass `onHome` to
  // their back button, so "Back" from MyMoney → Cashflow lands on Home rather
  // than MyMoney. We track the previous tab here and expose a `goBack` callback
  // that returns the user to where they came from (falling back to home if no
  // prior tab is on record). Updates inside an effect so multiple setTab calls
  // in one render still produce the right "previous" reading.
  const lastTabRef = useRef(tab)
  const prevTabRef = useRef(null)
  useEffect(() => {
    if (lastTabRef.current !== tab) {
      prevTabRef.current = lastTabRef.current
      lastTabRef.current = tab
    }
  }, [tab])
  const goBack = useCallback(() => {
    const prev = prevTabRef.current
    if (prev && prev !== tab) setTab(prev)
    else setTab('home')
  }, [tab])

  // Re-sync tab when URL param changes (snap script navigates between tabs)
  useEffect(() => {
    const onPop = () => { const t = readTabParam(); if (t) setTab(t) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [showFQBreak,  setShowFQBreak]  = useState(false)
  const [fqInitialTab, setFqInitialTab] = useState('radar')
  const [fqActiveDim,  setFqActiveDim]  = useState(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // Deep-link target for Settings (e.g. the "Based on…" assumptions chip in any
  // drill opens Settings straight to the Market-assumptions editor).
  const [settingsDetail, setSettingsDetail] = useState(null)
  const [showRiskOverlay, setShowRiskOverlay] = useState(false)
  const [askContext,   setAskContext]   = useState(null)
  const [showAsk,      setShowAsk]      = useState(false)

  // Open Settings at a given detail panel from anywhere (decoupled deep-link).
  // The assumptions chip in drill panels dispatches sonus:open-assumptions.
  useEffect(() => {
    const open = () => { setSettingsDetail('assumptions'); setShowSettings(true) }
    window.addEventListener('sonus:open-assumptions', open)
    return () => window.removeEventListener('sonus:open-assumptions', open)
  }, [])
  // Scenario seed bus — TappableNumber's "Tweak in scenario mode" route lands
  // here, then propagates into <Cashflow> which opens its scenario sub-view
  // and applies the seed values. Cleared once consumed.
  const [scenarioSeed, setScenarioSeed] = useState(null)
  const [dePayload,    setDePayload]    = useState(null)
  const [showMagic,    setShowMagic]    = useState(false)
  // v0.3 Phase 3 — deep-link hash bus (route-9 §5 v0.2 NEW).
  //   tabHash    — current in-tab anchor (e.g. 'iht-delta', 'scenario').
  //   tabSeed    — payload that travelled with the deep-link, consumed by
  //                the destination screen on first render.
  //   ihtForceKey — bumped on SCENARIO_SAVED back_flow:'iht' to force the
  //                IHT delta card to recompute against the new scenario
  //                without a full page reload (route-9 §7 test #8).
  const [tabHash,      setTabHash]      = useState(null)
  const [tabSeed,      setTabSeed]      = useState(null)
  const [ihtForceKey,  setIHTForceKey]  = useState(0)

  // Tab id migration shim (2026-05-15 rename 'plan' → 'timeline', coord FIX-10).
  // Children (HomeScreen onNav, NotificationCentre dest, persisted state) may
  // still pass the legacy id; remap at the boundary so we don't ship a dead nav.
  //
  // 2026-05-26: extended to handle the MyMoney section-nav chip targets.
  //   · 'estate' (Trusts & Estate chip) → 'tax' (Tax & Estate; estate section)
  //   · 'decisions' (Top decisions chip) → opens DecisionEngineV2 via dePayload
  //   · 'money/income' / 'money/protection' / 'money/business' pass through
  const setTabSafe = useCallback((id, opts) => {
    if (id === 'plan') return setTab('timeline')
    // Trusts & Estate chip — v0.3 route-9 §5: dedicated page `/money/trusts`,
    // NO LONGER `/tax#estate`. Section-nav chip lands here.
    if (id === 'estate' || id === 'trusts') {
      setTabHash(null); setTabSeed(null)
      return setTab('money/trusts')
    }
    if (id === 'decisions') {
      // v0.3 route-9 §5 — `/decisions#scenario` deep-link (R8 drawdown save)
      // still routes to the AI decision-tree (V2) with its seed.
      if (opts && opts.hash === 'scenario') {
        return setDePayload({ ...opts, hash: 'scenario', seed: opts.seed || null })
      }
      // Plain "Decisions" tap → the deterministic 40-decision catalogue
      // (DecisionEngine.jsx). Works with no API key and shows all 40 up front;
      // the LLM "ask in plain English" path is offered from inside it. Fixes
      // the founder's "I can't see the 40" — the AI front-door hid them.
      return setMoreScreen('decision')
    }
    // v0.3 route-9 §5 — `/tax#iht-delta` deep-link. Seed carries
    // `{ pension_total, post_2027_delta }` from R1 SIPP-IHT chip.
    if (id === 'tax' && opts && opts.hash === 'iht-delta') {
      setTabHash('iht-delta')
      setTabSeed(opts.seed || null)
      return setTab('tax')
    }
    // Default — clear any prior hash/seed and switch tab.
    setTabHash(null); setTabSeed(null)
    setTab(id)
  }, [])

  const handleHomeNav = useCallback((id, payload) => {
    if (id === 'de') { setDePayload(payload || {}); return }
    setTabSafe(id)
  }, [setTabSafe])

  // PP-3 drill stack — every <Drillable> push lands here. Pop on back, clear on close.
  // Each frame = { metric, label } resolved against driver(entity, metric).
  const [detailStack, setDetailStack] = useState([])

  // Phase 3 module overlay state — Data Capture, Vault, Notifications, Reports
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [moreScreen,   setMoreScreen]   = useState(null) // 'capture' | 'vault' | 'notif' | 'reports' | 'decision' | null
  // Decision deep-link: a per-screen "Decisions you can make here" drawer opens
  // the Decision Engine seeded straight into one decision (skips the catalogue).
  const [decisionSeed, setDecisionSeed] = useState(null)
  const openDecision = useCallback((id) => { setDecisionSeed(id); setMoreScreen('decision') }, [])
  // Decisions committed this session — merged into the entity Timeline reads so a
  // committed decision actually SHOWS in the decision log (founder 2026-06-06).
  const [sessionDecisions, setSessionDecisions] = useState([])

  // §13.8 Drill Memory — surface a resume-Whisper on first mount if a drill
  // session exists within TTL. The whisper carries an onTap that hydrates the
  // overlay stack to where the user left off.
  const [whispers, setWhispers] = useState([])
  useEffect(() => {
    const drill = readDrill()
    if (!drill?.frames?.length) return
    const w = drillAsWhisper(drill)
    if (w) {
      w.onTap = () => {
        if (drill.tab) setTab(drill.tab)
        setDetailStack(drill.frames)
        setWhispers(ws => ws.filter(x => x.id !== 'drill-resume'))
      }
      setWhispers(ws => [w, ...ws])
    }
  }, [])

  const { commit } = useEvents()

  const fq       = calcFQ(entity)  // align with HomeScreen anchor — single source of truth
  const band     = fqBand(fq.total)

  const _targetDims = getWealthTarget(entity)?.dims || {}
  const _gapCount   = gapDimsVsTarget(fq.dims || {}, _targetDims, 0.15).length
  const bandLabel   = _gapCount > 0 && band.name === 'Optimised' ? 'On Track' : band.name

  // Header anchor (founder direction 2026-05-25): all 3 anchor numbers
  // (NW + Wealth + Risk) live in the global header top-right. The body
  // TripleAnchor on MyMoney drops the You-Own tile (Wealth/Risk gauges stay
  // as visual depth). NW value sourced from ripple — single source of truth.
  const _nwRipple = useRipple(entity, ['balance_sheet'])
  const headerNW  = _nwRipple?.balance_sheet?.netWorth
  const headerRisk = calcRisk(entity)
  const headerRiskBand = riskBand(headerRisk.total)

  // Engine-generated alerts — replaces static entity.alerts for HomeV2
  const liveAlerts = calcAPQ(entity).map(a => ({
    level:    a.priority === 1 ? 'critical' : a.priority === 2 ? 'high' : 'medium',
    colour:   a.colour,
    badge:    a.priority === 1 ? 'CRITICAL' : a.priority === 2 ? 'HIGH' : 'MEDIUM',
    days:     a.impact?.deadline
      ? `${Math.max(0, Math.round((new Date(a.impact.deadline) - Date.now()) / 86400000))} days`
      : 'No date',
    headline: a.title,
    context:  a.detail,
    action:   'Review',
    screen:   a.screen,
  }))
  const wireEntity = { ...entity, alerts: liveAlerts }

  // Commit handler passed to any child that produces events.
  // v0.3 Phase 3 — intercepts SCENARIO_SAVED { back_flow:'iht' } per
  // route-9 §5 v0.2 NEW. On the back-flow signal, bump ihtForceKey so the
  // Route 4 IHTDeltaCard recomputes `ihtDeltaPrePost2027(entity)` against
  // the new scenario state. R1 SIPP-IHT chip listens to the same key via
  // its own engine read on next render (route-9 §7 consistency test #8).
  const handleCommit = useCallback((event) => {
    if (!event || !event.type) return
    commit(persona, event)
    // Surface committed Decision-Engine decisions on Timeline immediately.
    if (event.record && /^DE-/.test(event.type)) {
      setSessionDecisions(d => [event.record, ...d])
    }
    if (event.type === 'SCENARIO_SAVED' && event.payload?.back_flow === 'iht') {
      setIHTForceKey(k => k + 1)
    }
  }, [commit, persona])

  // Open Ask sheet with optional dim context (no longer a tab — D-ASK-1).
  const handleAskAI = useCallback((dimKey) => {
    setAskContext(dimKey ? { dimKey } : null)
    setShowAsk(true)
  }, [])

  // ── TappableNumber → in-app navigation bus ──────────────────────────────
  // TappableNumber dispatches `sonus:ask` and `sonus:scenario` window events
  // when the user clicks an action in the What-If sheet. We route those into
  // the existing Ask sheet / Cashflow scenario tab without a full reload.
  // Deep-link compatibility: on first mount we also read ?askQ / ?seed /
  // ?cfTab from the URL so bookmarks and the snap script can drive the same
  // destinations.
  useEffect(() => {
    function onAsk(e) {
      const d = e.detail || {}
      setAskContext({ question: d.question || null, seed: d.seed || null })
      setShowAsk(true)
    }
    function onScenario(e) {
      const d = e.detail || {}
      setScenarioSeed(d.seed || null)
      setTab('flow')
    }
    window.addEventListener('sonus:ask', onAsk)
    window.addEventListener('sonus:scenario', onScenario)
    // First-mount URL bootstrap — preserves seed on reload / bookmark.
    try {
      const sp = new URLSearchParams(window.location.search)
      const askQ = sp.get('askQ') || sp.get('q')
      const askSeedRaw = sp.get('askSeed') || (sp.get('q') ? sp.get('seed') : null)
      if (askQ) {
        let seed = null
        try { seed = askSeedRaw ? JSON.parse(askSeedRaw) : null } catch { /* ignore malformed seed */ }
        setAskContext({ question: askQ, seed })
        setShowAsk(true)
      } else if (sp.get('cfTab') === 'scenario' || sp.get('tab') === 'scenario') {
        const cfSeedRaw = sp.get('seed')
        let seed = null
        try { seed = cfSeedRaw ? JSON.parse(cfSeedRaw) : null } catch { /* ignore malformed seed */ }
        if (seed) setScenarioSeed(seed)
        setTab('flow')
      }
    } catch { /* SSR / non-browser */ }
    return () => {
      window.removeEventListener('sonus:ask', onAsk)
      window.removeEventListener('sonus:scenario', onScenario)
    }
  }, [])

  // Open FQBreakdown — accepts optional dim pre-selection (D04 fix)
  const openBreakdown = useCallback((opts = {}) => {
    setFqActiveDim(opts.activeDim || null)
    setFqInitialTab(opts.activeDim ? 'actions' : 'radar')
    setShowFQBreak(true)
  }, [])

  // Navigate to radar home (used by OverlayShell onHome)
  const goHome = useCallback(() => {
    setTab('home')
    setShowFQBreak(false)
    setShowSettings(false)
    setShowSwitcher(false)
    setShowAsk(false)
    setMoreScreen(null)
    setDePayload(null)
  }, [])

  // PP-3 drill stack handlers — every screen receives `onDrillMetric` and
  // pushes onto the stack. `pushDetail` resolves the metric to a driver tree.
  const pushDetail = useCallback((metric) => {
    setDetailStack(prev => {
      const next = [...prev, { metric, label: metric }]
      recordDrill(tab, next) // §13.8 — persist for Drill Memory
      return next
    })
  }, [tab])
  const popDetail = useCallback(() => {
    setDetailStack(prev => prev.slice(0, -1))
  }, [])
  const closeDetail = useCallback(() => {
    setDetailStack([])
  }, [])

  // Pill is hidden whenever any sub-screen / overlay is on top.
  const askPillHidden =
    showFQBreak || showSettings || showSwitcher || showRiskOverlay || showAsk ||
    detailStack.length > 0 || showMoreMenu || moreScreen !== null

  return (
    <TemporalModeProvider>
    <div className="sw-app-with-sidebar">
      {/* Phase 2 Batch B.5 — desktop sidebar (hidden at <1024px via CSS) */}
      <Sidebar
        tab={tab}
        onTabChange={setTabSafe}
        persona={persona}
        entity={entity}
        onScheduleReview={() => setShowAsk(true)}
        onAvatarClick={() => setShowSwitcher(true)}
      />
      <div style={{ display:'flex', flexDirection:'column', height:'100vh',
        background:'var(--c-bg)', overflow:'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      {/* V-1 fix (2026-05-28): className lets responsive CSS hide tagline +
          anchor pills at mobile width where the right cluster (avatar + 4
          pills + theme + more + settings = ~440px) was wrapping awkwardly
          under the brand. See B-V2-EXPANDED-FINDINGS V-1. */}
      <div className="sw-app-topbar" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', flexShrink:0, gap:8,
        borderBottom:'1px solid var(--c-sep)',
        background:'transparent',
      }}>
        {/* Logo mark + wordmark — theme-aware (2026-05-12 parity fix).
           Dark: navy gradient container + teal/cyan SVG fills + halo glow.
           Light: pure-white container + indigo + softer accents, no harsh
           dark-on-light cyan glow. Two SVG renders branch on theme. */}
        <div className="sw-app-topbar__brand" style={{ display:'flex', alignItems:'center', gap:10, flex:'1 1 auto', minWidth:0 }}>
          <div style={{
            width:44, height:44, borderRadius:14, flexShrink:0,
            background: theme === 'light'
              ? 'linear-gradient(145deg,#f5f0ff,#ede6ff)'
              : 'linear-gradient(145deg,#0d0822,#1a0d3d)',
            border: theme === 'light'
              ? '1px solid rgba(134,59,255,.15)'
              : '1px solid rgba(134,59,255,.30)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: theme === 'light'
              ? '0 4px 14px rgba(134,59,255,.15), 0 1px 3px rgba(35,48,68,.08)'
              : '0 8px 24px rgba(134,59,255,.25)',
            overflow:'hidden',
          }}>
            <img src="/assets/logo/logo-app-icon.png" width={36} height={36} alt="Sonuswealth" style={{ display:'block', borderRadius: 8 }} />
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:22, fontWeight:870, color:'var(--c-text)', letterSpacing:.02, lineHeight:1 }}>Sonuswealth</div>
            <div className="sw-app-topbar__tagline" style={{ fontSize:11, color:'var(--c-text3)', marginTop:2, letterSpacing:.02 }}>Your wealth, in one place.</div>
          </div>
        </div>

        {/* Right: avatar (persona) + Wealth Score + settings */}
        <div className="sw-app-topbar__actions" style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {/* Avatar button — theme-aware (2026-05-12 parity fix).
             Dark: warm peach gradient + dark text.
             Light: indigo gradient + white text. Both stay distinctively
             persona-flagged but read at-a-glance in their own theme. */}
          <button type="button" aria-label="Switch persona" onClick={() => setShowSwitcher(true)} style={{
            width:44, height:44, borderRadius:'50%', border:'none', cursor:'pointer',
            background: theme === 'light'
              ? 'linear-gradient(135deg,#1c3fe7,#7f57d9)'
              : 'linear-gradient(135deg,#f9d873,#ff8d7a)',
            fontSize:13, fontWeight:860,
            color: theme === 'light' ? '#ffffff' : '#111620',
            flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: theme === 'light'
              ? '0 2px 6px rgba(28,63,231,.30), 0 1px 2px rgba(35,48,68,.10)'
              : '0 2px 6px rgba(0,0,0,.20)',
          }}>
            {(entity?.displayName || entity?.name || 'B').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
          </button>

          {/* HeaderAnchor RESTORED (founder direction 2026-05-26 evening):
             Earlier removal made Cashflow / Tax / Protection look orphaned
             relative to Home which had a clear anchor row. Founder explicitly
             called this out: "we decided to place the 3 anchors on the top
             right to be consistent on every tab — it missing".

             Chrome pills are the canonical home for the 3 anchor numbers
             across every tab. Each route body MAY render its own depth
             panel (e.g. R1 has FinancesHeroCard) but the global header always
             shows the same 3 figures regardless of route. Consistency wins
             over the de-duplication argument. */}
          {(() => {
            const shortGBP = (v) => {
              if (typeof v !== 'number' || !isFinite(v)) return '—'
              const a = Math.abs(v)
              if (a >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`
              if (a >= 1_000)     return `£${Math.round(v / 1_000)}k`
              return `£${Math.round(v)}`
            }
            const nwShort = shortGBP(headerNW)
            const fqShort = fq?.total != null ? `${fq.total}` : '—'
            const rkShort = headerRisk?.total != null ? `${headerRisk.total}` : '—'
            const rkColour = headerRiskBand?.colour || 'var(--c-gold)'
            // CoI total (4th anchor — spec §2 contract). Defensive read.
            let coiTotal = 0
            try {
              coiTotal = +(totalCoI?.(entity)?.total ?? 0)
            } catch (_e) { /* engine may not be ready on first paint */ }
            const coiShort = shortGBP(coiTotal)
            const pill = (label, value, color, titleText) => (
              <div
                title={titleText || label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 50, padding: '4px 9px',
                  background: 'var(--c-surface2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 100,
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              </div>
            )
            return (
              <div className="sw-app-topbar__anchors" style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                {pill('NW', nwShort, 'var(--c-text)')}
                {pill('Wealth', fqShort, 'var(--c-acc)')}
                {pill('Risk', rkShort, rkColour)}
                {/* Founder 2026-06-08: kill the bare "CoI" acronym (basics rule).
                    Header total is the all-domain costOfInaction — label reflects scope. */}
                {pill('Cost of inaction', coiShort, 'var(--c-coral, #FF6F7D)', 'Cost of inaction · all domains')}
              </div>
            )
          })()}

          {/* Theme switcher — Stitch 58×38 pill (replaces invisible 36px circle) */}
          <ThemeTogglePill
            theme={theme}
            onToggle={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
          />

          {/* More menu — opens Data Capture / Vault / Notifications / Reports */}
          <button type="button" onClick={() => setShowMoreMenu(true)} aria-label="More menu" style={{
            width:44, height:44, borderRadius:'50%',
            background:'var(--c-surface2)', border:'1px solid var(--c-border)',
            color:'var(--c-text2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, lineHeight:1, padding:0, flexShrink:0,
          }}>⋯</button>

          <button type="button" onClick={() => setShowSettings(true)} aria-label="Settings" style={{
            width:44, height:44, borderRadius:'50%',
            background:'var(--c-surface2)', border:'1px solid var(--c-border)',
            color:'var(--c-text2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:16, lineHeight:1, padding:0, flexShrink:0,
          }}>⚙</button>
        </div>
      </div>

      {/* ── Mobile/tablet anchor strip (founder 2026-06-05) ──────────────
          The top-right pills (NW/Wealth/Risk/CoI) are hidden ≤768px to stop the
          header overflowing — but that left Cashflow (and any tab without its own
          in-body anchors) with NO scores on narrow screens. This full-width row
          restores the same 4 anchors on EVERY tab at ≤768px, so they're
          consistent for all users. Hidden >768 (the header pills show there). */}
      {(() => {
        const sg = (v) => (typeof v === 'number' && isFinite(v)) ? (Math.abs(v) >= 1e6 ? `£${(v / 1e6).toFixed(2)}m` : Math.abs(v) >= 1e3 ? `£${Math.round(v / 1e3)}k` : `£${Math.round(v)}`) : '—'
        let coi = 0; try { coi = +(totalCoI?.(entity)?.total ?? 0) } catch (_e) { /* */ }
        const cell = (l, v, c) => (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 4px', minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: c, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        )
        return (
          <div className="sw-mobile-anchors" style={{ display: 'none', gap: 6, padding: '4px 12px 6px', background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
            {cell('NW', sg(headerNW), 'var(--c-text)')}
            {cell('Wealth', fq?.total != null ? `${fq.total}` : '—', 'var(--c-acc)')}
            {cell('Risk', headerRisk?.total != null ? `${headerRisk.total}` : '—', headerRiskBand?.colour || 'var(--c-gold)')}
            {/* Founder 2026-06-08: bare "CoI" acronym killed here too (mobile strip). */}
            {cell('Cost of inaction', sg(coi), 'var(--c-coral, #FF6F7D)')}
          </div>
        )
      })()}

      {/* ── Global Tax Year chip ────────────────────────────────────────
          Founder direction 2026-05-28: TY must be visible on every page.
          Rendered here so every routed screen inherits it. */}
      <GlobalTaxYearChip onOpenReports={() => setMoreScreen('reports')} />

      {/* ── Whisper ribbon (§13.7) — ambient ticker, currently surfaces
           §13.8 Drill Memory resume on mount when applicable. ────────────────── */}
      {whispers.length > 0 && (
        <Whisper
          whispers={whispers}
          onSnooze={(id) => setWhispers(ws => ws.filter(w => w.id !== id))}
        />
      )}

      {/* ── Screen area ──────────────────────────────────────────────────── */}
      {/* P12-3 (2026-05-28): id + role main for skip-link target + landmark. */}
      {/* L1-3 (2026-05-28): per-tab ErrorBoundary keyed on `tab`. A render
          crash in one tab shows the inline fallback while preserving the
          surrounding chrome (TopBar, Sidebar, FCA footer). Switching to a
          different tab unmounts the boundary (key change) and re-renders. */}
      <main id="main-content" role="main" tabIndex={-1} style={{ flex:1, overflowY:'auto', overflowX:'hidden', display:'flex',
        flexDirection:'column', WebkitOverflowScrolling:'touch' }}>
        <ErrorBoundary key={tab} scope={`Tab:${tab}`} fallback={inlineTabFallback}>
        {tab === 'home'  && (
          <HomeScreen
            entity={wireEntity}
            personaId={persona}
            onNav={handleHomeNav}
            onCommit={handleCommit}
            onAskAI={handleAskAI}
            onOpenBreakdown={openBreakdown}
            onDrillMetric={pushDetail}
            onShowMagic={() => setShowMagic(true)}
          />
        )}
        {tab === 'money' && (
          <MyMoney
            entity={entity}
            personaId={persona}
            onCommit={handleCommit}
            onHome={goHome}
            onBack={goBack}
            onOpenRisk={() => setShowRiskOverlay(true)}
            onDrillMetric={pushDetail}
            onNav={setTabSafe}
            onOpenDecision={openDecision}
          />
        )}
        {/* MyMoney sub-routes (founder direction 2026-05-26).
           onBack returns to the Balance Sheet root (/money). */}
        {tab === 'money/income' && (
          <MoneyIncome
            entity={entity}
            personaId={persona}
            onBack={() => setTab('money')}
            onNav={setTabSafe}
          />
        )}
        {tab === 'money/protection' && (
          <MoneyProtection
            entity={entity}
            personaId={persona}
            onBack={() => setTab('money')}
            onHome={goHome}
          />
        )}
        {tab === 'money/business' && (
          <MoneyBusiness
            entity={entity}
            personaId={persona}
            onBack={() => setTab('money')}
            onHome={goHome}
            onNav={setTabSafe}
          />
        )}
        {/* v0.3 route-9 §5 — Trusts chip lands on dedicated `/money/trusts`,
            NOT `/tax#estate`. Phase 6 will build the full R4.5 surface; for
            now MoneyTrusts is the placeholder route target. */}
        {tab === 'money/trusts' && (
          <MoneyTrusts
            entity={entity}
            personaId={persona}
            onBack={() => setTab('money')}
            onHome={goHome}
            onNav={setTabSafe}
            onCommit={handleCommit}
          />
        )}
        {tab === 'flow'  && (
          <Cashflow
            entity={entity}
            onHome={goHome}
            onBack={goBack}
            onNav={setTabSafe}
            onOpenRisk={() => setShowRiskOverlay(true)}
            onDrillMetric={pushDetail}
            scenarioSeed={scenarioSeed}
            onScenarioSeedConsumed={() => setScenarioSeed(null)}
            onOpenDecision={openDecision}
          />
        )}
        {/* v0.3 route-9 §5 deep-link wiring — hash + seed + forceKey for the
            IHT pre/post-2027 delta card. R1 SIPP-IHT chip seeds the hash;
            R7 SCENARIO_SAVED back_flow bumps ihtForceKey for live recompute. */}
        {tab === 'tax'   && <TaxEstate   entity={entity} personaId={persona} onCommit={handleCommit} onHome={goHome} onBack={goBack} onNav={setTabSafe} onOpenRisk={() => setShowRiskOverlay(true)} onDrillMetric={pushDetail} hash={tabHash} seed={tabSeed} ihtForceKey={ihtForceKey} onOpenDecision={openDecision} />}
        {tab === 'risk'  && <Risk        entity={entity} onHome={goHome} onBack={goBack} onNav={setTabSafe} onDrillMetric={pushDetail} onCommit={handleCommit} onAddProtection={(type) => { /* routed to protection add flow */ }} onOpenDecision={openDecision} />}
        {tab === 'timeline'  && <Timeline     entity={sessionDecisions.length ? { ...entity, decisions: [...sessionDecisions, ...(entity?.decisions || [])] } : entity} onHome={goHome} onBack={goBack} onNav={setTabSafe} onDrillMetric={pushDetail} />}
        </ErrorBoundary>
        {/* P12-1 (2026-05-28) — canonical FCA disclaimer footer per AppShell
            slot contract. Rendered at Dashboard scope so every screen inherits
            without per-file duplication. Per-screen inline compliance notes
            (DB transfer, COBS 19.1A, etc.) stay where they are — they are
            contextual, not the boilerplate footer. */}
        <FCADisclaimerFooter variant="footer" />
      </main>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <nav aria-label="Primary" data-bottom-nav="true" style={{
        display:'flex', height:78, flexShrink:0,
        borderTop:'1px solid var(--c-sep)',
        background:'var(--c-bg)',
        paddingBottom:'env(safe-area-inset-bottom, 0px)',
      }}>
        {TABS.map(t => {
          // MyMoney sub-routes (money/income, money/protection, money/business)
          // keep the "My Money" lane active so the user doesn't feel orphaned.
          const active = t.id === 'money' ? isMoneyTab(tab) : tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTabSafe(t.id)} aria-current={active ? 'page' : undefined} aria-label={`Navigate to ${t.label}`} style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:3,
              border:'none', cursor:'pointer', background:'none',
              padding:0, minWidth:0, position:'relative',
            }}>
              {active && (
                <div style={{ position:'absolute', top:8, left:'50%',
                  transform:'translateX(-50%)', width:4, height:4,
                  borderRadius:'50%', background:'var(--c-acc)' }} />
              )}
              <div style={{ fontSize:16, color: active ? 'var(--c-acc)' : 'var(--c-text3)', marginTop:4, transition:'color 0.2s' }}>
                {t.icon}
              </div>
              <div style={{ fontSize:11, fontWeight: active ? 700 : 400,
                color: active ? 'var(--c-acc)' : 'var(--c-text3)',
                transition:'all 0.2s' }}>
                {t.label}
              </div>
            </button>
          )
        })}
      </nav>

      {/* ── FQ Breakdown overlay — now uses OverlayShell ─────────────────── */}
      {showFQBreak && (
        <OverlayShell
          title="Score Breakdown"
          subtitle={`${fq.total}/100 · ${band.name}`}
          onBack={() => setShowFQBreak(false)}
          onHome={goHome}
          contentStyle={{ padding: 0 }}
        >
          <FQBreakdown
            entity={entity}
            initialTab={fqInitialTab}
            activeDimKey={fqActiveDim}
            onClose={() => setShowFQBreak(false)}
            onNav={(tab) => { setShowFQBreak(false); setTabSafe(tab) }}
            embedded={true}
          />
        </OverlayShell>
      )}

      {/* ── Persona switcher (bottom sheet pattern) ──────────────────────── */}
      {showSwitcher && (
        <PersonaSwitcher
          personaList={personaList || []}
          currentPersona={persona}
          onSelect={(id) => { onSwitchPersona(id); setShowSwitcher(false) }}
          onClose={() => setShowSwitcher(false)}
        />
      )}

      {/* ── Settings (uses OverlayShell internally now) ──────────────────── */}
      {showSettings && (
        <Settings
          entity={entity}
          theme={theme}
          initialDetail={settingsDetail}
          onThemeChange={onThemeChange}
          onClose={() => { setShowSettings(false); setSettingsDetail(null) }}
          onHome={goHome}
          onNav={(tab) => { setShowSettings(false); setTabSafe(tab) }}
        />
      )}

      {/* ── Risk overlay — opens from Risk Score tile of triple anchor ───── */}
      {showRiskOverlay && (
        <RiskOverlay
          entity={entity}
          onClose={() => setShowRiskOverlay(false)}
        />
      )}

      {/* ── Ask AI persistent pill (D-ASK-1) ─────────────────────────────── */}
      <AskPill
        hidden={askPillHidden}
        archetype={entity?.archetype}
        tabHint={tab}
        onTap={() => setShowAsk(true)}
      />

      {/* ── Ask AI bottom sheet (D-SHEET-1) ──────────────────────────────── */}
      {showAsk && (
        <OverlayShell
          title="Ask AI"
          subtitle="Rules: UK-2026.1 · Data: April 2026"
          onBack={() => setShowAsk(false)}
          onHome={goHome}
          contentStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Ask
            entity={entity}
            context={askContext}
            onClearContext={() => setAskContext(null)}
            currentTab={tab}
            onCommit={handleCommit}
          />
        </OverlayShell>
      )}

      {/* ── PP-3 Detail drill stack — pushed by any <Drillable> in any screen.
           Top frame is resolved via driver(entity, metric). Recursive: each
           driver in the frame is itself <Drillable> by tapping. ─────────── */}
      {detailStack.length > 0 && (
        <DetailOverlay
          frame={driver(entity, detailStack[detailStack.length - 1].metric)}
          crumbs={detailStack.map(f => f.label || f.metric)}
          onDrill={pushDetail}
          onBack={popDetail}
          onClose={closeDetail}
        />
      )}

      {/* ── More menu sheet ───────────────────────────────────────────────── */}
      {showMoreMenu && (
        <div className="sheet-overlay">
          <div className="sheet-backdrop" onClick={() => setShowMoreMenu(false)} />
          <div className="sheet-panel sw-fade-in-up" style={{ maxHeight:'60vh' }}>
            <div className="sheet-handle" />
            <div className="sw-eyebrow" style={{ marginBottom:12 }}>More</div>
            {[
              { id: 'capture', icon: '⇧', label: 'Data capture',     body: 'Upload, scan, or enter manually' },
              { id: 'vault',   icon: '📁', label: 'Document vault',    body: 'Your wealth paper trail' },
              { id: 'notif',   icon: '🔔', label: 'Notifications',     body: "What you'll want to know" },
              { id: 'reports', icon: '📊', label: 'Reports',           body: 'On-demand or scheduled exports' },
              { id: 'ifa',     icon: '◊', label: 'IFA Practice',      body: 'Adviser dashboard + client roster' },
              { id: 'decision', icon: '◆', label: 'All decisions (40)',  body: 'Browse 40 money decisions — scored, no AI needed' },
            ].map(m => (
              <button key={m.id} onClick={() => { if (m.id === 'decision') setDecisionSeed(null); setMoreScreen(m.id); setShowMoreMenu(false) }}
                className="sw-tile sw-tile-interactive sw-press"
                style={{ width:'100%', textAlign:'left', marginBottom:10, cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:40, height:40, borderRadius:12,
                    background:'var(--c-tint-mint)', color:'var(--c-mint-text)',
                    display:'grid', placeItems:'center', fontSize:18, flexShrink:0,
                  }}>{m.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--c-text)' }}>{m.label}</div>
                    <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:2 }}>{m.body}</div>
                  </div>
                  <span style={{ color:'var(--c-text3)', fontSize:16 }}>›</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Module screens (rendered when selected from More menu) ──────────── */}
      {moreScreen === 'capture' && (
        <OverlayShell title="Data capture" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <DataCapture onBack={() => setMoreScreen(null)} onCommit={handleCommit} />
        </OverlayShell>
      )}
      {moreScreen === 'vault' && (
        <OverlayShell title="Document vault" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <Vault onBack={() => setMoreScreen(null)} />
        </OverlayShell>
      )}
      {moreScreen === 'notif' && (
        <OverlayShell title="Notifications" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <NotificationCentre
            entity={entity}
            onBack={() => setMoreScreen(null)}
            onNavigate={(dest) => {
              if (!dest) { setMoreScreen(null); return }
              // MASTER R13 / FIX-14: honour 'vault' dest — promote to the
              // More-menu Vault overlay rather than silently rewriting to home.
              if (dest === 'vault') { setMoreScreen('vault'); return }
              setMoreScreen(null)
              setTabSafe(dest)
            }}
          />
        </OverlayShell>
      )}
      {moreScreen === 'reports' && (
        <OverlayShell title="Reports" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <Reports
            entity={entity}
            personaId={persona}
            activeTab={tab}
            onCommit={handleCommit}
            onBack={() => setMoreScreen(null)}
            onHome={goHome}
          />
        </OverlayShell>
      )}
      {moreScreen === 'ifa' && (
        <OverlayShell title="IFA Practice" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <IFAPractice
            onBack={() => setMoreScreen(null)}
            onOpenClient={(id) => { onSwitchPersona?.(id); setMoreScreen(null) }}
            onCommit={handleCommit}
          />
        </OverlayShell>
      )}
      {moreScreen === 'decision' && (
        <OverlayShell title="Choices" onBack={() => setMoreScreen(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <DecisionEngine
            entity={wireEntity}
            initialDecisionId={decisionSeed}
            onBack={(opts) => {
              setMoreScreen(null)
              setDecisionSeed(null)
              // Navigate to Timeline after a commit so user sees their plan.
              if (opts?.committed) setTabSafe('timeline')
            }}
            onCommit={handleCommit}
            onAskAI={() => { setMoreScreen(null); setDecisionSeed(null); setDePayload({}) }}
          />
        </OverlayShell>
      )}
      {showMagic && <MagicShowcase entity={wireEntity} onClose={() => setShowMagic(false)} />}
      {dePayload !== null && (
        <OverlayShell title="Choices" onBack={() => setDePayload(null)} onHome={goHome} contentStyle={{ padding: 0 }}>
          <DecisionEngineV2
            entity={wireEntity}
            initialQuery={dePayload.query}
            initialEventIds={dePayload.eventId ? [dePayload.eventId] : undefined}
            onClose={(result) => {
              setDePayload(null)
              // Navigate to Timeline after a commit so user sees their plan.
              if (result?.committed) setTabSafe('timeline')
            }}
          />
        </OverlayShell>
      )}
      </div>{/* /content column */}
    </div>
    </TemporalModeProvider>
  )
}
