import { useState, useEffect } from 'react'

import Welcome       from './screens/Welcome.jsx'
import Onboarding    from './screens/Onboarding.jsx'
import Account       from './screens/Account.jsx'
import Dashboard     from './screens/Dashboard.jsx'
import PersonaSelect from './screens/PersonaSelect.jsx'
import { EventsProvider, useEffectiveEntity } from './state/events.jsx'
import { bootRules } from './lib/boot-rules.js'

import personaA from './rules/personas/persona-a.json'
import personaB from './rules/personas/persona-b.json'
import personaC from './rules/personas/persona-c.json'
import personaD from './rules/personas/persona-d.json'
import personaE from './rules/personas/persona-e.json'
import personaF from './rules/personas/persona-f.json'
import personaG from './rules/personas/persona-g.json'
import mrTCore from './rules/personas/mrT-core.json'

// Flat entity map — Anna Finch snapshots registered individually
const ENTITIES = {
  a: personaA, b: personaB, c: personaC, d: personaD, e: personaE, g: personaG,
  mrt: personaA,   // Bruce Wilson is persona-a
  ...Object.fromEntries((personaF.snapshots || []).map(s => [s.id, s])),
}

const PERSONA_LIST = [
  { id:'mrt',  badge:'T', label:'Mr T (full fixture)', sub:'All-domain reference',   type:'individual' },
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
  return { demo: p.get('demo'), tab: p.get('tab') }
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

// Inner component — read effective entity via hook (must be inside provider)
function AppInner() {
  const urlParams = readUrlParams()
  const [screen,           setScreen]            = useState(urlParams.demo && ENTITIES[urlParams.demo] ? 'app' : 'welcome')
  const [theme,            setTheme]             = useState('dark')
  const [persona,          setPersona]           = useState(urlParams.demo && ENTITIES[urlParams.demo] ? urlParams.demo : 'a')
  const [obData,           setObData]            = useState({ age: 38, focus: [], setup: [] })
  const [showPersonaSelect, setShowPersonaSelect] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.style.background = theme === 'dark' ? '#000' : '#F2F2F7'
  }, [theme])

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

  const baseEntity = ENTITIES[persona] || personaA
  // Fold committed events onto base persona — this is what every screen reads
  const entity     = useEffectiveEntity(baseEntity, persona)

  return (
    <div style={{ position:'relative', width:'100%', minHeight:'100vh',
      display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--c-bg)' }}>

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
      {screen === 'app'      && (
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
    <EventsProvider>
      <AppInner />
    </EventsProvider>
  )
}
