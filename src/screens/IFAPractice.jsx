// ─────────────────────────────────────────────────────────────────────────────
// IFAPractice — Phase 3 module entry point.
//
// Spec: 2-Product-ifa-practice-v1_0.md. Practice → Adviser → Client hierarchy.
// First wave delivers the practice dashboard + client roster + per-client
// adviser-mode preview. Notes, Reports, Meetings are stubbed for follow-up.
//
// Demo data: 7 fixture personas (Bruce, Fred & Wilma, Tony, Hermione, Willy,
// Anna, Priya) act as the practice's client list. Hermione is the adviser
// herself. Tapping a client opens an adviser-mode preview overlay with key
// metrics + open items + notes panel + report CTAs.
//
// FIX-18 (2026-05-16):
// — Roster KPIs now flow from fq-calculator engine, not hardcoded literals
//   (CRIT MATH-1, MATH-2). Each client carries an `entity` reference (persona
//   JSON); nw/fq/risk/coi computed at render time via netWorth/calcFQ/calcRisk/
//   costOfInaction. Falls back to a stub label if entity unavailable.
// — Report buttons honest-stubbed with inline toast confirming Phase 2 wiring
//   (CRIT STUB-1, D-IFA-REPORTS-1).
// — Practice → Adviser → Client entity hierarchy stubs added so the spec'd
//   Option B contract is visible in shape even before backend FKs land
//   (CRIT SPEC-1, SPEC-2).
// — saveNote() now captures data_snapshot (nw/fq/risk/timestamp) +
//   rules_bundle_ref so FCA audit-trail integrity holds (HIGH §6.1.2).
// — Reports/Meetings/Referrals/Practice-Settings/Compliance added as labelled
//   Phase 2 stubs so all 8 spec'd surfaces present (HIGH).
// — Consumer→IFA vocab drift fixed: "Sonuswealth Wealth Score" /
//   "Sonuswealth Risk Score" / "Net Worth" used precisely (HIGH).
// — Archetype + life-stage surfaced as filter pills on each client row (HIGH).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
// S1 selector migration (Phase 2)
import { netWorth, fq as calcFQ } from '../engine/selectors/index.js'
import { calcRisk, costOfInaction } from '../engine/fq-calculator.js'

// Persona JSONs — used as `entity` on each client row so engine calls return
// real numbers, not hardcoded literals. (CRIT MATH-1, MATH-2.)
import personaA from '../rules/personas/persona-a.json'
import personaB from '../rules/personas/persona-b.json'
import personaC from '../rules/personas/persona-c.json'
import personaE from '../rules/personas/persona-e.json'
import personaF from '../rules/personas/persona-f.json'
import personaG from '../rules/personas/persona-g.json'

// f-45 lives inside personaF.snapshots — pull it out so the roster row resolves
// to a real entity instead of degrading to the stub label.
const personaF45 = (personaF.snapshots || []).find(s => s.id === 'f-45') || personaF

// ── PRACTICE → ADVISER → CLIENT ENTITY HIERARCHY ────────────────────────────
// Spec mandates this shape (D-IFA-OPTION-B). Hardcoded for the demo, but the
// SHAPE communicates the contract that backend FKs will honour. (CRIT SPEC-1, SPEC-2.)
const PRACTICE = {
  id:    'pract-demo',
  name:  'Granger Wealth Advisory',
  fca:   'FCA #823104',
  rules_bundle_ref: 'UK-2026.1',
}

const ADVISERS = [
  { id: 'adv-1', practice_id: 'pract-demo', name: 'Hermione Granger', cert: 'Chartered FCSI' },
]

const CURRENT_ADVISER = ADVISERS[0]

const MOCK_CLIENTS = [
  {
    id: 'a',  name: 'Bruce Wayne',        sub: '62 · Decumulation',
    urgent: true, openItems: 3, lastSeen: '2 days ago',
    flags: ['SIPP IHT exposure 2027'],
    archetype: 'decumulator', lifeStage: 'Drawdown',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaA,
  },
  {
    id: 'b',  name: 'Fred & Wilma Flintstone', sub: '64/61 · Couple · Transition',
    urgent: false, openItems: 2, lastSeen: '5 days ago',
    flags: ['Spouse income gap'],
    archetype: 'couple-transition', lifeStage: 'Transition',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaB,
  },
  {
    id: 'c',  name: 'Tony Stark',         sub: '48 · Business owner',
    urgent: false, openItems: 1, lastSeen: '12 days ago',
    flags: ['BPR consolidation'],
    archetype: 'business-owner', lifeStage: 'Consolidation',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaC,
  },
  {
    id: 'e',  name: 'Willy Wonka',        sub: '78 · Preservation',
    urgent: true, openItems: 4, lastSeen: 'Today',
    flags: ['Estate plan stale 7mo', 'Gift clock active'],
    archetype: 'preservation', lifeStage: 'Preservation',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaE,
  },
  {
    id: 'f-45',  name: 'Anna Finch (age 45 snapshot)', sub: '45 · Growth',
    urgent: false, openItems: 1, lastSeen: '3 weeks ago',
    flags: ['Annual review due'],
    archetype: 'accumulator', lifeStage: 'Accumulation',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaF45,
  },
  {
    id: 'g',  name: 'Priya Sharma',       sub: '38 · NRI cross-border',
    urgent: true, openItems: 2, lastSeen: 'Yesterday',
    flags: ['FIG/TRF assessment'],
    archetype: 'cross-border', lifeStage: 'Accumulation',
    adviser_id: 'adv-1', practice_id: 'pract-demo',
    entity: personaG,
  },
]

// Compute engine-derived KPIs for every client row. Engine returns objects;
// guard against shape drift so a broken persona JSON doesn't blank the roster.
// (CRIT MATH-1, MATH-2.)
function deriveKpis(client) {
  if (!client.entity) {
    return { nw: null, fq: null, risk: null, coi: null, _stub: true }
  }
  try {
    const nw   = netWorth(client.entity)
    const fqR  = calcFQ(client.entity)
    const rkR  = calcRisk(client.entity)
    const coi  = costOfInaction(client.entity)
    return {
      nw:   typeof nw === 'number' ? nw : (nw?.total ?? null),
      fq:   fqR?.total ?? fqR?.score ?? null,
      risk: rkR?.total ?? rkR?.score ?? null,
      coi:  typeof coi === 'number' ? coi : (coi?.total ?? coi?.amount ?? null),
    }
  } catch (err) {
    // Engine shape drift — fail soft, surface stub.
    return { nw: null, fq: null, risk: null, coi: null, _stub: true, _err: err.message }
  }
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`
  return `£${n}`
}

const FILTERS = [
  { id: 'all',     label: 'All',         test: (c) => true },
  { id: 'urgent',  label: 'Urgent',      test: (c) => c.urgent },
  { id: 'review',  label: 'Open items',  test: (c) => c.openItems > 0 },
  { id: 'recent',  label: 'Recent',      test: (c) => /day|today|yesterday/i.test(c.lastSeen) },
]

const ARCHETYPE_FILTERS = [
  { id: 'arch-all',      label: 'All archetypes', test: (c) => true },
  { id: 'accumulator',   label: 'Accumulator',    test: (c) => c.archetype === 'accumulator' },
  { id: 'decumulator',   label: 'Decumulator',    test: (c) => c.archetype === 'decumulator' },
  { id: 'business-owner',label: 'Biz owner',      test: (c) => c.archetype === 'business-owner' },
  { id: 'cross-border',  label: 'Cross-border',   test: (c) => c.archetype === 'cross-border' },
  { id: 'preservation',  label: 'Preservation',   test: (c) => c.archetype === 'preservation' },
]

const PRACTICE_SECTIONS = [
  { id: 'roster',     label: 'Clients' },
  { id: 'reports',    label: 'Reports' },
  { id: 'meetings',   label: 'Meetings' },
  { id: 'referrals',  label: 'Referrals' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'settings',   label: 'Practice' },
]

export default function IFAPractice({ onBack, onOpenClient, onCommit }) {
  const [filter, setFilter] = useState('all')
  const [archFilter, setArchFilter] = useState('arch-all')
  const [activeClient, setActiveClient] = useState(null)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('roster')

  // Enrich every client with engine-derived KPIs once per render. (MATH-1, MATH-2.)
  const enriched = useMemo(
    () => MOCK_CLIENTS.map(c => ({ ...c, kpis: deriveKpis(c) })),
    []
  )

  const visible = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter)
    const a = ARCHETYPE_FILTERS.find(x => x.id === archFilter)
    return enriched
      .filter(f?.test || (() => true))
      .filter(a?.test || (() => true))
      .filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase()))
  }, [filter, archFilter, query, enriched])

  const stats = useMemo(() => ({
    aum:     enriched.reduce((s, c) => s + (c.kpis.nw || 0), 0),
    clients: enriched.length,
    urgent:  enriched.filter(c => c.urgent).length,
    open:    enriched.reduce((s, c) => s + c.openItems, 0),
  }), [enriched])

  return (
    <div className="screen" style={{ padding: '16px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} className="sw-press" style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            color: 'var(--c-text2)', fontSize: 13, cursor: 'pointer',
          }}>← Home</button>
        )}
        <div style={{ flex: 1 }}>
          <div className="sw-eyebrow">IFA · Practice</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
            {PRACTICE.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
            {ADVISERS.length} adviser · {CURRENT_ADVISER.name} · {CURRENT_ADVISER.cert}
            <span style={{ marginLeft: 6, opacity: 0.65 }}>· {PRACTICE.fca}</span>
          </div>
        </div>
      </div>

      {/* Practice stats — 4 KPI tiles. Vocab: IFA B2B precision. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        marginBottom: 14,
      }}>
        <KpiTile label="AUM (engine)" value={fmt(stats.aum)} colour="var(--c-text)" />
        <KpiTile label="Clients"      value={stats.clients}  colour="var(--c-acc)" />
        <KpiTile label="Urgent"       value={stats.urgent}   colour="var(--c-coral, #FF6F7D)" />
        <KpiTile label="Open items"   value={stats.open}     colour="var(--c-gold)" />
      </div>

      {/* Practice sections — 6 surfaces (spec'd 8 minus the per-client adviser
          mode which lives in the overlay + the per-client roster row). */}
      <div role="tablist" style={{
        display: 'flex', gap: 4, padding: 4, marginBottom: 14, flexWrap: 'wrap',
        border: '1px solid var(--c-sep)', borderRadius: 14,
        background: 'var(--c-surface2)',
      }}>
        {PRACTICE_SECTIONS.map(s => {
          const active = section === s.id
          return (
            <button key={s.id} role="tab" aria-selected={active}
              onClick={() => setSection(s.id)}
              className="sw-press"
              style={{
                flex: '1 1 auto', minHeight: 28, border: 0, borderRadius: 10, cursor: 'pointer',
                background: active ? 'var(--c-surface)' : 'transparent',
                color: active ? 'var(--c-text)' : 'var(--c-text3)',
                fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                textTransform: 'uppercase', padding: '0 10px',
              }}>{s.label}</button>
          )
        })}
      </div>

      {section === 'roster' && (
        <RosterSection
          visible={visible}
          query={query} setQuery={setQuery}
          filter={filter} setFilter={setFilter}
          archFilter={archFilter} setArchFilter={setArchFilter}
          enriched={enriched}
          onOpenClient={setActiveClient}
        />
      )}
      {section === 'reports'    && <Phase2Stub title="Reports library"     line="Practice-wide report templates + PDF generation. (D-IFA-REPORTS-1.) Phase 2 — coming next." />}
      {section === 'meetings'   && <Phase2Stub title="Meeting register"    line="Adviser diary + meeting notes linked to client records. Phase 2 — coming next." />}
      {section === 'referrals'  && <Phase2Stub title="Referral network"    line="Solicitor / accountant / specialist referrals with audit trail. Phase 2 — coming next." />}
      {section === 'compliance' && <Phase2Stub title="Compliance ledger"   line="Suitability docs, file reviews, T&Cs versions. Phase 2 — coming next." />}
      {section === 'settings'   && <Phase2Stub title="Practice settings"   line="Adviser roster, FCA permissions, billing, branding. Phase 2 — coming next." />}

      {activeClient && (
        <AdviserModePreview
          client={activeClient}
          practice={PRACTICE}
          adviser={CURRENT_ADVISER}
          onClose={() => setActiveClient(null)}
          onOpenClient={() => { onOpenClient?.(activeClient.id); setActiveClient(null) }}
          onCommit={onCommit}
        />
      )}
    </div>
  )
}

// ── Roster section ──────────────────────────────────────────────────────────
function RosterSection({ visible, query, setQuery, filter, setFilter, archFilter, setArchFilter, enriched, onOpenClient }) {
  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        style={{
          width: '100%', padding: '10px 12px', marginBottom: 10,
          background: 'var(--c-surface2)',
          border: '1px solid var(--c-border)',
          borderRadius: 100, fontSize: 13, color: 'var(--c-text)',
        }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {FILTERS.map(f => {
          const active = filter === f.id
          const count = enriched.filter(f.test).length
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`sw-chip sw-chip-sm ${active ? 'sw-chip-mint' : ''}`}
              style={{
                cursor: 'pointer', fontWeight: 700,
                padding: '5px 12px',
                border: active ? '1px solid var(--c-acc)' : '1px solid var(--c-border)',
              }}>
              {f.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
            </button>
          )
        })}
      </div>
      {/* Archetype filter pills — spec §4.2 5×5 cross-map cell. (HIGH.) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ARCHETYPE_FILTERS.map(a => {
          const active = archFilter === a.id
          return (
            <button key={a.id} onClick={() => setArchFilter(a.id)}
              className={`sw-chip sw-chip-sm ${active ? 'sw-chip-gold' : ''}`}
              style={{
                cursor: 'pointer', fontWeight: 600, fontSize: 10,
                padding: '4px 10px',
                border: active ? '1px solid var(--c-gold)' : '1px solid var(--c-border)',
                opacity: active ? 1 : 0.85,
              }}>
              {a.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--c-text3)', padding: 14, textAlign: 'center' }}>
            No clients match. Clear filter or search.
          </div>
        )}
        {visible.map(c => {
          const k = c.kpis
          return (
            <button key={c.id} onClick={() => onOpenClient(c)}
              className="sw-tile sw-tile-interactive sw-press"
              style={{
                textAlign: 'left', cursor: 'pointer',
                borderLeft: c.urgent ? '3px solid var(--c-coral, #FF6F7D)' : '3px solid transparent',
                padding: '12px 14px',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Avatar name={c.name} urgent={c.urgent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--c-text)' }}>
                      {c.name}
                    </span>
                    {c.urgent && (
                      <span className="sw-chip sw-chip-sm sw-chip-coral" style={{ fontSize: 9 }}>
                        Urgent
                      </span>
                    )}
                    <span className="sw-chip sw-chip-sm" style={{ fontSize: 9, opacity: 0.75 }}>
                      {c.archetype}
                    </span>
                    <span className="sw-chip sw-chip-sm" style={{ fontSize: 9, opacity: 0.75 }}>
                      {c.lifeStage}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>
                    {c.sub} · Last seen {c.lastSeen}
                  </div>
                  {k._stub ? (
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 6, fontStyle: 'italic' }}>
                      Engine data pending — Phase 2 IFA persona wiring.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: 11 }}>
                      <span><strong style={{ color: 'var(--c-text)' }}>{fmt(k.nw)}</strong> Net Worth</span>
                      <span><strong style={{ color: 'var(--c-acc)' }}>{k.fq ?? '—'}</strong> Sonuswealth Wealth Score</span>
                      <span><strong style={{ color: 'var(--c-gold)' }}>{k.risk ?? '—'}</strong> Sonuswealth Risk Score</span>
                      <span><strong style={{ color: 'var(--c-coral, #FF6F7D)' }}>{fmt(k.coi)}</strong> CoI</span>
                      <span><strong style={{ color: 'var(--c-text2)' }}>{c.openItems}</strong> open</span>
                    </div>
                  )}
                  {c.flags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {c.flags.map(f => (
                        <span key={f} className="sw-chip sw-chip-sm"
                          style={{ fontSize: 9, opacity: 0.85 }}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--c-text3)', fontSize: 16, alignSelf: 'center' }}>›</span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function Phase2Stub({ title, line }) {
  return (
    <div className="sw-tile" style={{ padding: 24, textAlign: 'center' }}>
      <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Phase 2 — coming next</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text3)', lineHeight: 1.5, maxWidth: 360, margin: '0 auto' }}>
        {line}
      </div>
    </div>
  )
}

function KpiTile({ label, value, colour }) {
  return (
    <div className="sw-tile" style={{ padding: '10px 8px', textAlign: 'center' }}>
      <div className="sw-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: colour, letterSpacing: -0.2 }}>
        {value}
      </div>
    </div>
  )
}

function Avatar({ name, urgent }) {
  const initials = name.split(/[\s&]/).filter(Boolean).slice(0, 2)
    .map(s => s[0]).join('').toUpperCase()
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: urgent
        ? 'linear-gradient(135deg, #FF6F7D, #FFB347)'
        : 'linear-gradient(135deg, var(--c-acc), var(--c-acc2, #4D8EFF))',
      color: '#0B1F3A', display: 'grid', placeItems: 'center',
      fontSize: 12, fontWeight: 800,
    }}>{initials}</div>
  )
}

// ── Adviser-mode preview ────────────────────────────────────────────────────
function AdviserModePreview({ client, practice, adviser, onClose, onOpenClient, onCommit }) {
  const [tab, setTab] = useState('overview')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState(null)   // { kind: 'note' | 'report', label: string }

  const k = client.kpis || deriveKpis(client)

  function saveNote() {
    if (!note.trim()) return
    // FCA audit-trail integrity — spec §6.1.2. Capture data_snapshot at the
    // moment of note creation so the record reflects what the adviser saw,
    // not what's true at retrieval time. (HIGH.)
    const snapshot = client.entity ? {
      nw:   k.nw,
      fq:   k.fq,
      risk: k.risk,
      coi:  k.coi,
      timestamp: new Date().toISOString(),
    } : { _stub: true, timestamp: new Date().toISOString() }

    onCommit?.({
      event_id: `note-${client.id}-${Date.now()}`,
      type: 'adviser_note_added',
      ts: Date.now(),
      correlation_id: `ifa-${client.id}-${Date.now()}`,
      payload: {
        clientId:         client.id,
        client_id:        client.id,
        practice_id:      practice?.id || client.practice_id,
        adviser_id:       adviser?.id  || client.adviser_id,
        note_body:        note.trim(),
        data_snapshot:    snapshot,
        rules_bundle_ref: practice?.rules_bundle_ref || 'UK-2026.1',
      },
    })
    setNote('')
    setToast({ kind: 'note', label: 'Note saved with snapshot.' })
    setTimeout(() => setToast(null), 2200)
  }
  function generateReport(kind, label) {
    onCommit?.({
      type: 'adviser_report_requested',
      ts: Date.now(),
      correlation_id: `ifa-rep-${client.id}-${Date.now()}`,
      payload: {
        clientId:    client.id,
        client_id:   client.id,
        practice_id: practice?.id || client.practice_id,
        adviser_id:  adviser?.id  || client.adviser_id,
        kind,
      },
    })
    // Honest stub — no PDF backend yet, so confirm + label as Phase 2.
    // (CRIT STUB-1, D-IFA-REPORTS-1.)
    setToast({
      kind: 'report',
      label: `${label}: request queued. PDF generation — Phase 2 (D-IFA-REPORTS-1).`,
    })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="sheet-overlay">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel sw-fade-in-up" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <Avatar name={client.name} urgent={client.urgent} />
          <div style={{ flex: 1 }}>
            <div className="sw-eyebrow">Client · adviser mode</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', marginTop: 2 }}>
              {client.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>
              {client.sub} · {client.archetype} · {client.lifeStage}
            </div>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2, opacity: 0.8 }}>
              {practice?.id} / {adviser?.id} / client:{client.id}
            </div>
          </div>
          {client.urgent && (
            <span className="sw-chip sw-chip-sm sw-chip-coral" style={{ fontSize: 9 }}>Urgent</span>
          )}
        </div>

        {/* Top stats — engine-derived, IFA vocab. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
          <KpiTile label="Net Worth"             value={fmt(k.nw)}      colour="var(--c-text)" />
          <KpiTile label="Wealth Score"          value={k.fq ?? '—'}    colour="var(--c-acc)" />
          <KpiTile label="Risk Score"            value={k.risk ?? '—'}  colour="var(--c-gold)" />
          <KpiTile label="Cost of Inaction"      value={fmt(k.coi)}     colour="var(--c-coral, #FF6F7D)" />
        </div>
        {k._stub && (
          <div style={{
            fontSize: 11, color: 'var(--c-text3)', fontStyle: 'italic',
            marginBottom: 10, textAlign: 'center',
          }}>
            Engine data pending — Phase 2 IFA persona wiring.
          </div>
        )}

        {/* Sub-tab */}
        <div role="tablist" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4, padding: 4, marginBottom: 12,
          border: '1px solid var(--c-sep)', borderRadius: 14,
          background: 'var(--c-surface2)',
        }}>
          {['overview', 'notes', 'reports'].map(t => {
            const active = tab === t
            return (
              <button key={t} role="tab" aria-selected={active}
                onClick={() => setTab(t)}
                className="sw-press"
                style={{
                  minHeight: 28, border: 0, borderRadius: 10, cursor: 'pointer',
                  background: active ? 'var(--c-surface)' : 'transparent',
                  color: active ? 'var(--c-text)' : 'var(--c-text3)',
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}>{t}</button>
            )
          })}
        </div>

        {tab === 'overview' && (
          <div>
            <div className="sw-eyebrow" style={{ marginBottom: 6 }}>Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {client.flags.map(f => (
                <div key={f} className="sw-tile" style={{
                  padding: '8px 12px', fontSize: 12, color: 'var(--c-text2)',
                  borderLeft: '3px solid var(--c-gold)',
                }}>{f}</div>
              ))}
            </div>
            <button onClick={onOpenClient} className="sw-press" style={{
              width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 800,
              background: 'var(--c-acc)', color: '#0B1F3A',
              border: 'none', borderRadius: 100, cursor: 'pointer',
            }}>
              Open {client.name.split(' ')[0]}'s plan →
            </button>
          </div>
        )}

        {tab === 'notes' && (
          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Suitability note, meeting summary, follow-up reminder…"
              rows={5}
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 8,
                background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
                borderRadius: 10, fontSize: 13, color: 'var(--c-text)',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <button onClick={saveNote} disabled={!note.trim()}
              className="sw-press" style={{
                width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                background: 'var(--c-acc)', color: '#0B1F3A',
                border: 'none', borderRadius: 100,
                cursor: note.trim() ? 'pointer' : 'not-allowed',
                opacity: note.trim() ? 1 : 0.5,
              }}>
              Save note (with data snapshot)
            </button>
            <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6, textAlign: 'center' }}>
              Note attaches to client record with engine snapshot + {practice?.rules_bundle_ref || 'UK-2026.1'} rules ref.
              Visible to {client.name.split(' ')[0]} only if shared.
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div>
            <div className="sw-eyebrow" style={{ marginBottom: 8 }}>Generate report on behalf of client</div>
            {[
              { id: 'estate',    label: 'Estate plan',          sub: 'IHT exposure + waterfall + Will & LPA' },
              { id: 'tax',       label: 'Tax summary',          sub: 'ANI build + allowances + CGT position' },
              { id: 'cashflow',  label: 'Cashflow projection',  sub: 'Drawdown method × 12 months × confidence band' },
              { id: 'networth',  label: 'Net worth snapshot',   sub: 'Wrapper composition + concentration risk' },
              { id: 'custom',    label: 'Custom report…',       sub: 'Build your own selection of zones' },
            ].map(r => (
              <button key={r.id} onClick={() => generateReport(r.id, r.label)}
                className="sw-tile sw-tile-interactive sw-press"
                style={{
                  width: '100%', textAlign: 'left', marginBottom: 8,
                  padding: '10px 12px', cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
                      {r.label}
                      <span style={{
                        marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                        color: 'var(--c-text3)', textTransform: 'uppercase',
                      }}>Phase 2</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 2 }}>{r.sub}</div>
                  </div>
                  <span style={{ color: 'var(--c-text3)', fontSize: 14 }}>›</span>
                </div>
              </button>
            ))}
            <div style={{
              fontSize: 10, color: 'var(--c-text3)', marginTop: 8, textAlign: 'center', lineHeight: 1.5,
            }}>
              Report request fires an event into the practice ledger.<br/>
              PDF generation backend — D-IFA-REPORTS-1, Phase 2.
            </div>
          </div>
        )}

        {/* Inline toast — confirms event fired so adviser knows the click landed.
            (CRIT STUB-1.) */}
        {toast && (
          <div style={{
            position: 'sticky', bottom: 8, marginTop: 12,
            background: toast.kind === 'report' ? 'var(--c-gold)' : 'var(--c-acc)',
            color: '#0B1F3A',
            padding: '10px 14px', borderRadius: 100, textAlign: 'center',
            fontSize: 12, fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }} role="status" aria-live="polite">
            {toast.label}
          </div>
        )}
      </div>
    </div>
  )
}
