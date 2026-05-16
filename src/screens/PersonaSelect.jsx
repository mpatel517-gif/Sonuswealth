// PersonaSelect.jsx — Demo persona landing screen
// Shown when user taps "View demo dashboard →" on Welcome.
// Presents all 7 personas. User picks one, then Dashboard loads.
// Anna Finch shows 6 age chips. Priya shows NRI badge.
// Do not touch HomeScreen.jsx or Jit's radar — this is upstream of both.

import { BRAND } from '../config/brand.js'

const TYPE_COLOURS = {
  individual: '#4D8EFF',
  couple:     '#00E5A8',
  business:   '#FFB347',
  ifa:        '#AF52DE',
  life_arc:   '#FF9500',
  nri:        '#FF6B6B',
}

// One-line pitch per persona — shown on the card
const PERSONA_PITCH = {
  a: 'SIPP deadline, IHT exposure, cost of inaction live',
  b: 'Joint decumulation, combined estate, sequencing two drawdowns',
  c: 'Peak-earning business owner — SSAS, salary vs dividend, exit planning',
  d: 'Early career IFA — consolidating pensions, first home, dual account',
  e: 'Late estate — post-75 death benefits, IHT at scale, beneficiary chains',
  f: 'Full 67-year life arc — age 22 through 89, six financial snapshots',
  g: 'UK resident with Indian investments — NRE/NRO, DTAA, cross-border',
}

function PersonaCard({ persona, onSelect }) {
  const col     = TYPE_COLOURS[persona.type] || '#4D8EFF'
  const pitch   = PERSONA_PITCH[persona.id] || ''
  const isArc   = !!persona.snapshots

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Main card */}
      <div
        onClick={() => !isArc && onSelect(persona.id)}
        style={{
          display:        'flex',
          alignItems:     'flex-start',
          gap:            14,
          padding:        '14px 16px',
          background:     'var(--c-surface)',
          border:         `1.5px solid var(--c-border)`,
          borderRadius:   18,
          cursor:         isArc ? 'default' : 'pointer',
          transition:     'border-color .15s, background .15s',
        }}
        onMouseEnter={e => {
          if (!isArc) {
            e.currentTarget.style.borderColor = col
            e.currentTarget.style.background = `${col}0D`
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--c-border)'
          e.currentTarget.style.background = 'var(--c-surface)'
        }}
      >
        {/* Badge */}
        <div style={{
          width:         42,
          height:        42,
          borderRadius:  12,
          background:    `${col}22`,
          border:        `1.5px solid ${col}44`,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          fontSize:      15,
          fontWeight:    800,
          color:         col,
          flexShrink:    0,
        }}>
          {persona.badge}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            marginBottom: 3,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>
              {persona.label}
            </div>
            {persona.type === 'nri' && (
              <div style={{
                fontSize:11,
                fontWeight: 700,
                color:      col,
                background: `${col}18`,
                border:     `1px solid ${col}33`,
                padding:    '2px 6px',
                borderRadius: 100,
                flexShrink: 0,
              }}>
                NRI
              </div>
            )}
            {persona.type === 'life_arc' && (
              <div style={{
                fontSize:11,
                fontWeight: 700,
                color:      col,
                background: `${col}18`,
                border:     `1px solid ${col}33`,
                padding:    '2px 6px',
                borderRadius: 100,
                flexShrink: 0,
              }}>
                LIFE ARC
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 5 }}>
            {persona.sub}
          </div>
          {pitch && (
            <div style={{ fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.5 }}>
              {pitch}
            </div>
          )}
        </div>

        {/* Arrow — only for non-arc personas */}
        {!isArc && (
          <div style={{
            fontSize:   18,
            color:      col,
            opacity:    0.5,
            flexShrink: 0,
            paddingTop: 2,
          }}>
            ›
          </div>
        )}
      </div>

      {/* Anna Finch age chips — shown below her card */}
      {isArc && persona.snapshots && (
        <div style={{
          display:    'flex',
          gap:        6,
          flexWrap:   'wrap',
          padding:    '10px 16px 4px',
        }}>
          <div style={{
            fontSize:11,
            fontWeight: 600,
            color:      'var(--c-text3)',
            width:      '100%',
            marginBottom: 2,
          }}>
            Pick an age to start her journey:
          </div>
          {persona.snapshots.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                padding:      '7px 16px',
                borderRadius: 100,
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                background:   `${col}18`,
                color:        col,
                border:       `1.5px solid ${col}33`,
                transition:   'all .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = col
                e.currentTarget.style.color = col === '#FF9500' ? '#0B1F3A' : '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${col}18`
                e.currentTarget.style.color = col
              }}
            >
              Age {s.age}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PersonaSelect({ personaList, onSelect, onBack }) {
  return (
    <div style={{
      position:   'absolute',
      inset:      0,
      background: 'var(--c-bg)',
      display:    'flex',
      flexDirection: 'column',
      overflow:   'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:    '52px 20px 16px',
        flexShrink: 0,
        borderBottom: '1px solid var(--c-sep)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border:     'none',
            color:      'var(--c-acc)',
            fontSize:   14,
            fontWeight: 600,
            cursor:     'pointer',
            padding:    '0 0 14px',
            display:    'block',
          }}
        >
          ← Back
        </button>
        <div style={{
          fontSize:      24,
          fontWeight:    800,
          color:         'var(--c-text)',
          letterSpacing: -.5,
          marginBottom:  6,
        }}>
          Demo Personas
        </div>
        <div style={{ fontSize: 13, color: 'var(--c-text3)', lineHeight: 1.5 }}>
          Seven real financial situations — same engine, same score, different lives.
          Pick one to explore.
        </div>
      </div>

      {/* Scrollable persona list */}
      <div style={{
        flex:                  1,
        overflowY:             'auto',
        padding:               '16px 20px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {(personaList || []).map(p => (
          <PersonaCard key={p.id} persona={p} onSelect={onSelect} />
        ))}
        <div style={{ height: 24 }} />
      </div>

      {/* Footer note */}
      <div style={{
        padding:      '10px 20px',
        paddingBottom:'max(16px,env(safe-area-inset-bottom))',
        borderTop:    '1px solid var(--c-sep)',
        flexShrink:   0,
      }}>
        <div style={{
          fontSize:11,
          color:      'var(--c-text3)',
          textAlign:  'center',
          lineHeight: 1.6,
        }}>
          Demo data only · Not regulated financial advice ·{' '}
          {BRAND.rulesVersion}
        </div>
      </div>
    </div>
  )
}
