import { useState, useEffect } from 'react'

import Welcome       from './screens/Welcome.jsx'
import Onboarding    from './screens/Onboarding.jsx'
import Account       from './screens/Account.jsx'
import Dashboard     from './screens/Dashboard.jsx'
import PersonaSelect from './screens/PersonaSelect.jsx'
import { EventsProvider, useEffectiveEntity } from './state/events.jsx'
import { AuthProvider, useAuth } from './state/auth.jsx'
import { installBundleAutoSync } from './engine/bundle-wiring.js'

// A4 (2026-05-28): bridge the global TY chip to the engine's setBundle so
// every consumer (PA, NRB, RNRB, dividend rates, NIC bands) live-updates
// when the user changes the temporal window. Idempotent at module-load.
installBundleAutoSync()
import { StepUpProvider } from './state/step-up.jsx'
import { bootRules } from './lib/boot-rules.js'

import personaA from './rules/personas/persona-a.json'
import personaB from './rules/personas/persona-b.json'
import personaC from './rules/personas/persona-c.json'
import personaD from './rules/personas/persona-d.json'
import personaE from './rules/personas/persona-e.json'
import personaF from './rules/personas/persona-f.json'
import personaG from './rules/personas/persona-g.json'

// Mr T fixture family — only mrT-core was rewritten to live-UI schema (v2.0,
// "Bruce app schema with spec-array overlays"). The other 12 mrT-* fixtures
// keep the engine-test shape (nested individual.{id,name,dob}) and are wired
// into the engine regression matrix via Supabase (Phase A4) and exercised by
// the harness. Until a normaliser lifts them to UI shape (Phase D), they ARE
// registered in ENTITIES so `?demo=mrt-landlord` resolves to the right object
// — but the renderer detects nested shape and shows an explicit
// "engine fixture only" notice instead of silently rendering Bruce (P0-14).
import mrTCore         from './rules/personas/mrT-core.json'
import mrTLandlord     from './rules/personas/mrT-landlord.json'
import mrTCouple       from './rules/personas/mrT-couple.json'
import mrTDivorced     from './rules/personas/mrT-divorced.json'
import mrTCohabSep     from './rules/personas/mrT-cohab-sep.json'
import mrTLtdDirector  from './rules/personas/mrT-ltd-director.json'
import mrTSoleTrader   from './rules/personas/mrT-sole-trader.json'
import mrTDecumComplex from './rules/personas/mrT-decum-complex.json'
import mrTAgedOut      from './rules/personas/mrT-aged-out.json'
import mrTBeneficiary  from './rules/personas/mrT-beneficiary.json'
import mrTFamily       from './rules/personas/mrT-family.json'
import mrTUkIn         from './rules/personas/mrT-uk-in.json'
import mrTUkTh         from './rules/personas/mrT-uk-th.json'

// Flat entity map — Anna Finch snapshots registered individually.
//
// 2026-05-28: `f` previously resolved to personaF — a `type:"life_arc"`
// wrapper holding `snapshots[]` with no top-level assets. MyMoney's readers
// (entity.assets.pensions, entity.income.*, etc.) then collapsed to 0 and
// the FinancesHeroCard hid because totalAssets === 0. Now `f` resolves to
// the FIRST snapshot (f-22, age 22) by default — matching how PERSONA_LIST
// presents Anna's selector entry. The full `personaF` wrapper is still
// available via `f-wrapper` for code that needs the snapshot index. URL
// users hitting `?demo=f` now get a renderable snapshot.
const _annaDefault = (personaF.snapshots && personaF.snapshots[0]) || personaF
const ENTITIES = {
  a: personaA, b: personaB, c: personaC, d: personaD, e: personaE, f: _annaDefault, 'f-wrapper': personaF, g: personaG,
  // Mr T routing fix (P0-14): every mrT variant resolves to its own object so
  // the URL ?demo=mrt-X is no longer a lie. mrT-core is the only one with
  // live-UI shape; the other 12 are nested-shape and the renderer surfaces
  // them as an explicit gap instead of silently rendering Bruce.
  mrt:                 mrTCore,
  'mrt-core':          mrTCore,
  'mrt-landlord':      mrTLandlord,
  'mrt-couple':        mrTCouple,
  'mrt-divorced':      mrTDivorced,
  'mrt-cohab-sep':     mrTCohabSep,
  'mrt-ltd-director':  mrTLtdDirector,
  'mrt-sole-trader':   mrTSoleTrader,
  'mrt-decum-complex': mrTDecumComplex,
  'mrt-aged-out':      mrTAgedOut,
  'mrt-beneficiary':   mrTBeneficiary,
  'mrt-family':        mrTFamily,
  'mrt-uk-in':         mrTUkIn,
  'mrt-uk-th':         mrTUkTh,
  ...Object.fromEntries((personaF.snapshots || []).map(s => [s.id, s])),
}

// P0-14: detect engine-test-shape personas that don't have UI-renderable
// root fields. mrT-core was rewritten to lift these to root; the other 12
// mrT fixtures store name/dob nested under `individual.*`. Rather than
// silently rendering Bruce (the pre-2026-05-27 behaviour), the renderer
// surfaces this as an explicit "engine fixture, not UI-renderable yet" state.
function isUiRenderable(entity) {
  if (!entity || typeof entity !== 'object') return false
  // Live-UI shape personas (a-g, mrT-core) have name at the root.
  // Engine-test shape has it under individual.{name,dob} and no root.name.
  if (typeof entity.name === 'string' && entity.name.length > 0) return true
  return false
}

const PERSONA_LIST = [
  { id:'mrt-core', badge:'T', label:'Mr T Core', sub:'35 · Director · all-domain', type:'individual' },
  { id:'a',    badge:'A', label:'Bruce Wayne',        sub:'62 · Decumulation',      type:'individual' },
  { id:'b',    badge:'B', label:'Fred & Wilma',       sub:'64/61 · Transition',     type:'couple'     },
  { id:'c',    badge:'C', label:'Tony Stark',         sub:'48 · Business owner',    type:'business'   },
  { id:'d',    badge:'D', label:'Hermione Granger',   sub:'IFA · 28',               type:'ifa'        },
  { id:'e',    badge:'E', label:'Willy Wonka',        sub:'78 · Preservation',      type:'individual' },
  {
    id:'f-22', badge:'F', label:'Anna Finch',         sub:'Life arc · pick an age', type:'life_arc',
    snapshots: (personaF.snapshots || []).map(s => ({ id:s.id, age:s.age })),
  },
  { id:'g',    badge:'G', label:'Priya Sharma',       sub:'38 · NRI cross-border',  type:'nri'        },
]

// Read URL params once at module load for deep-linking (snap script + bookmarks)
// e.g. /?demo=mrt&tab=home  → skips welcome, loads persona, jumps to tab
function readUrlParams() {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  return { demo: p.get('demo'), tab: p.get('tab'), theme: p.get('theme') }
}

// FIX-3.A — wire real user data from Onboarding through Account into
// Dashboard's entity. Was previously hardcoded persona='a' (Bruce Wayne) —
// every new user saw the same demo data regardless of what they typed.
//
// Mechanism: when Account fires onEnter(payload), we
//   (1) pick a sensible base persona from age + focus,
//   (2) spread the user's obData onto a deep clone of that base,
//   (3) register the result under a synthetic 'real-user' key in ENTITIES,
//   (4) set persona='real-user' so useEffectiveEntity feeds it to Dashboard.
// No persona JSON file is touched; the ENTITIES map is mutated at runtime
// only. This keeps the engine entity contract intact (engine reads the same
// shape) while letting onboarding answers actually drive the dashboard.
function deriveBasePersona(obData) {
  const age   = +obData?.age || 38
  const focus = Array.isArray(obData?.focus) ? obData.focus : []
  // focus is array of indices (multi-picker); business tile index 4 in
  // Onboarding QUESTIONS focus list = 'Business & tax planning'.
  const businessFocused = focus.includes(4)
  if (age >= 60)                    return personaA  // Bruce-like decumulation
  if (age >= 40 && businessFocused) return personaC  // Tony-like business owner
  return personaA                                    // default base structure
}

function buildUserPersona(obData) {
  const base = deriveBasePersona(obData)
  const clone = JSON.parse(JSON.stringify(base))
  // Top-level fields the engine reads directly off the entity root.
  clone.id           = 'real-user'
  clone.name         = obData?.name || 'You'
  clone.displayName  = `You · ${obData?.age || base.age}`
  clone.age          = +obData?.age || base.age
  // Income/property/cash are not always at root in persona JSONs (engine
  // helpers aggregate from nested arrays). Carry the raw obData under a
  // namespaced key so downstream readers / debug panels can introspect it.
  clone._obData      = { ...(obData || {}) }
  // Carry jurisdiction if user supplied one (default UK).
  if (obData?.jurisdiction) {
    clone.jurisdictionContext = {
      ...(clone.jurisdictionContext || {}),
      primary: obData.jurisdiction === 'UK' ? 'UK-2026.1' : obData.jurisdiction,
    }
  }
  return clone
}

// P0-14 (2026-05-27): explicit gap notice for personas that resolve to a
// registered fixture but aren't in UI-renderable shape. Previously the app
// silently fell back to Bruce, hiding the gap — every screenshot ever taken
// of "Mr T Landlord" was actually Bruce. This component surfaces the gap.
function PersonaNotRenderable({ persona, isKnown, rawEntity, onSwitch }) {
  const nestedName = rawEntity?.individual?.name || rawEntity?.fixture_id || null
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--c-bg)', color: 'var(--c-text)',
    }}>
      <div style={{
        maxWidth: 560, padding: 32, borderRadius: 20,
        background: 'var(--c-surface)', border: '1px solid var(--c-border)',
        boxShadow: 'var(--sh1)', lineHeight: 1.55,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--c-coral, #FF6F7D)', marginBottom: 12,
        }}>
          Persona not UI-renderable
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.4,
        }}>
          {isKnown
            ? `${nestedName || persona} is an engine-test fixture, not a UI persona yet.`
            : `Unknown persona: "${persona}"`}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--c-text2)', margin: '0 0 16px' }}>
          {isKnown ? (
            <>
              This fixture exists in the engine regression matrix but its data is
              stored in nested-test shape (e.g. <code style={{ fontSize: 12 }}>
              individual.name</code>) that the UI screens don&rsquo;t read yet.
              We&rsquo;ve made this visible rather than silently rendering Bruce
              Wayne&rsquo;s data in its place.
            </>
          ) : (
            <>The <code style={{ fontSize: 12 }}>?demo=</code> URL parameter doesn&rsquo;t
              match any registered persona. Check the spelling, or pick from the list.</>
          )}
        </p>
        <button
          onClick={onSwitch}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 0, cursor: 'pointer',
            background: 'var(--c-acc)', color: 'var(--c-bg)', fontWeight: 700, fontSize: 14,
          }}>
          Pick a UI-renderable persona →
        </button>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 18 }}>
          UI-renderable today: <code>a</code> (Bruce), <code>b</code>, <code>c</code>,
          <code> d</code>, <code>e</code>, <code>f-*</code>, <code>g</code>, <code>mrt-core</code>.
        </div>
      </div>
    </div>
  )
}

// Inner component — read effective entity via hook (must be inside provider)
function AppInner() {
  const urlParams = readUrlParams()
  // AU1 — auth gate. Demo URL param always wins (founder demos, snap script).
  // Otherwise: authenticated returning user lands on app; unauth lands on welcome.
  const auth = useAuth()
  const isDemoMode = !!(urlParams.demo && ENTITIES[urlParams.demo])
  const initialScreen = isDemoMode ? 'app'
    : (auth.isAuthenticated ? 'app' : 'welcome')
  const [screen,           setScreen]            = useState(initialScreen)
  // P9 (2026-05-26) — respect OS preference on first load. Hard-locked dark
  // ignored CLAUDE.md §9 "every snap inspected at every viewport in every
  // theme" because there was no theme to inspect. Order:
  //   1. URL param ?theme=light|dark — explicit override
  //   2. localStorage 'sw_theme' — last user choice
  //   3. window.matchMedia('(prefers-color-scheme: light)') — OS preference
  //   4. 'dark' fallback (existing default)
  const [theme, setTheme] = useState(() => {
    try {
      const urlTheme = (urlParams.theme || '').toLowerCase()
      if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme
      const saved = typeof window !== 'undefined' ? window.localStorage?.getItem('sw_theme') : null
      if (saved === 'light' || saved === 'dark') return saved
      if (typeof window !== 'undefined' && window.matchMedia) {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
        if (prefersLight) return 'light'
      }
    } catch (_e) { /* fall through */ }
    return 'dark'
  })
  const [persona,          setPersona]           = useState(isDemoMode ? urlParams.demo : 'a')
  const [obData,           setObData]            = useState({ age: 38, focus: [], setup: [] })
  const [showPersonaSelect, setShowPersonaSelect] = useState(false)

  // Sync auth state changes — if a returning user's session restores async,
  // jump to app. If they sign out from inside Dashboard, return to welcome.
  useEffect(() => {
    if (isDemoMode) return
    if (auth.loading) return
    if (auth.isAuthenticated && screen === 'welcome') {
      setScreen('app')
    } else if (!auth.isAuthenticated && screen === 'app') {
      setScreen('welcome')
    }
  }, [auth.isAuthenticated, auth.loading, isDemoMode, screen])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.style.background = theme === 'dark' ? '#000' : '#F2F2F7'
    // Persist the user's choice so subsequent visits honour it ahead of OS pref.
    try { window.localStorage?.setItem('sw_theme', theme) } catch (_e) { /* noop */ }
  }, [theme])

  // P9 — react to live OS theme changes only when the user has NOT made an
  // explicit choice this session. Keyed off the absence of a localStorage
  // entry written above, so the first OS flip after a clean install follows
  // the system, but any explicit toggle locks behaviour to the user's pick.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e) => {
      try {
        const saved = window.localStorage?.getItem('sw_theme')
        if (saved === 'light' || saved === 'dark') return // user has chosen
      } catch (_e) { /* fall through */ }
      setTheme(e.matches ? 'light' : 'dark')
    }
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else if (mq.addListener) mq.addListener(handler)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else if (mq.removeListener) mq.removeListener(handler)
    }
  }, [])

  // Phase 2b boot hook — fetch the live UK rules bundle + macro variables
  // from Supabase and inject into the engine via _bundle.js. The bundled JSON
  // is the synchronous default so first paint is correct; this useEffect
  // upgrades to whatever's currently active in Supabase (e.g. if cron-rules-
  // activation has activated UK-2026.1.2 since the deploy). Failure is silent
  // — the engine keeps using the bundled JSON.
  useEffect(() => {
    bootRules().then((r) => {
      if (r.bundleLoaded || r.macroLoaded) {
        // eslint-disable-next-line no-console
        console.info('[caelixa] engine booted', r)
      }
    }).catch(() => { /* silent — bundled JSON is fine */ })
  }, [])

  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  // FIX-3.A — Account's onEnter now ships the merged payload (email + every
  // obData field). Build a real-user persona, register it in ENTITIES, then
  // jump to Dashboard with persona='real-user'.
  function handleAccountEnter(payload) {
    const merged = { ...obData, ...(payload || {}) }
    setObData(merged)
    ENTITIES['real-user'] = buildUserPersona(merged)
    setPersona('real-user')
    setScreen('app')
  }

  // P0-14: explicit handling of three cases —
  //   1. persona registered + UI-renderable → render Dashboard normally
  //   2. persona registered but engine-test shape → render gap notice
  //   3. persona not registered → render gap notice (URL was wrong)
  const registeredEntity = ENTITIES[persona]
  const personaIsKnown   = !!registeredEntity
  const personaIsUi      = isUiRenderable(registeredEntity)
  const baseEntity       = personaIsUi ? registeredEntity : personaA
  // Fold committed events onto base persona — this is what every screen reads
  const entity     = useEffectiveEntity(baseEntity, persona)

  return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh',
      display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--c-bg)' }}>

      {/* P12-3 (2026-05-28) — WCAG 2.4.1 skip-to-content link.
          Invisible until keyboard-focused (Tab from page start); on activation
          jumps the user past chrome to the main screen content. */}
      <a href="#main-content" className="sw-skip-link">Skip to main content</a>

      {/* Floating theme toggle removed 2026-05-11 — now lives in Dashboard
          header as a prominent 58×38 Stitch pill (ThemeTogglePill).
          Pre-app screens (Welcome / Onboarding / Account) inherit theme via
          [data-theme] on <html>; toggle is restored once user enters Dashboard. */}

      {showPersonaSelect && (
        <PersonaSelect
          personaList={PERSONA_LIST}
          onSelect={(id) => {
            setPersona(id)
            setShowPersonaSelect(false)
            // FIX 2026-05-25: write ?demo=X to the URL so isDemoMode flips
            // true on the next render. Without this, the auth useEffect at
            // line 113 bounces unauthenticated demo users from screen='app'
            // back to 'welcome' — infinite loop. Side benefit: the demo state
            // is now bookmarkable and snap-script compatible.
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.set('demo', id)
              window.history.replaceState({}, '', url.toString())
            }
            setScreen('app')
          }}
          onBack={() => setShowPersonaSelect(false)}
        />
      )}

      {!showPersonaSelect && screen === 'welcome'  && (
        <Welcome
          onStart={() => setScreen('onboard')}
          onDemo={() => setShowPersonaSelect(true)}
        />
      )}
      {screen === 'onboard'  && <Onboarding onComplete={(d) => { setObData(d); setScreen('account') }} onBack={() => setScreen('welcome')} />}
      {screen === 'account'  && <Account    obData={obData} onEnter={handleAccountEnter} />}
      {screen === 'app' && !personaIsUi && (
        <PersonaNotRenderable
          persona={persona}
          isKnown={personaIsKnown}
          rawEntity={registeredEntity}
          onSwitch={() => setShowPersonaSelect(true)}
        />
      )}
      {screen === 'app' && personaIsUi && (
        <Dashboard
          entity={entity}
          persona={persona}
          personaList={PERSONA_LIST}
          onSwitchPersona={setPersona}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StepUpProvider>
        <EventsProvider>
          <AppInner />
        </EventsProvider>
      </StepUpProvider>
    </AuthProvider>
  )
}
