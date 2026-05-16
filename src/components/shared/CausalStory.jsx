// ─────────────────────────────────────────────────────────────────────────────
// CausalStory — §13.1 magic: "Why this number moved + what else it caused"
//
// Every wealth app shows a delta. None explain causality across domains.
// This is the AI-native moment that doesn't need an LLM — just rippleEffect()
// output rendered as natural language.
//
// Renders as a thin ribbon under any drilled metric, or inline next to a delta.
//
// Props:
//   event   { metric, delta, primary_driver, secondary_effects[] }
//     - metric: canonical metric name (e.g. 'wealthScore')
//     - delta: signed numeric change
//     - primary_driver: short cause description
//     - secondary_effects: [{ metric, delta, description }]
//   compact bool — if true, shows just one line; if false, expanded story.
// ─────────────────────────────────────────────────────────────────────────────

import { plain } from '../../copy/plain-english.js'

export default function CausalStory({ event, compact = false }) {
  if (!event || !event.primary_driver) return null

  const sign = (event.delta ?? 0) >= 0 ? '+' : ''
  const metricLabel = plain(event.metric)
  const oneLine = `${metricLabel} ${event.delta >= 0 ? 'climbed' : 'dropped'} ${sign}${Math.abs(event.delta || 0)} because ${event.primary_driver}`

  if (compact || !event.secondary_effects?.length) {
    return (
      <div
        className="sw-fade-in"
        style={{
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--c-text2)',
          background: 'var(--c-tint-neutral)',
          borderRadius: 'var(--r-md)',
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: 'var(--c-acc)', marginRight: 6 }}>✦</span>
        {oneLine}.
      </div>
    )
  }

  return (
    <div
      className="sw-fade-in"
      style={{
        padding: '10px 14px',
        fontSize: 12,
        color: 'var(--c-text2)',
        background: 'var(--c-tint-neutral)',
        borderRadius: 'var(--r-md)',
        lineHeight: 1.55,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--c-acc)', marginRight: 6 }}>✦</span>
        <strong style={{ color: 'var(--c-text)' }}>{oneLine}.</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
        That same change also caused:
      </div>
      <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 11 }}>
        {event.secondary_effects.map((s, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            {plain(s?.metric)} <strong style={{ color: 'var(--c-text2)' }}>{(s.delta ?? 0) >= 0 ? '+' : ''}{s.delta ?? 0}</strong>
            {s.description ? ` — ${s.description}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
