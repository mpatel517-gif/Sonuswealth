/**
 * src/components/DecisionTree/OptionCard.jsx — Expandable option card
 *
 * Single decision path. Click to expand pros/cons/risks/sequence.
 * Spec: plan §Phase 2 — click option → drills into detail.
 */

// Irreversibility color map
const IRR_COLOR = {
  low:    '#5ddbc2',  // teal = reversible
  medium: '#ffbd59',  // gold = semi-reversible
  high:   '#ff6f7d',  // coral = hard to reverse
}
const IRR_LABEL = {
  low: 'Reversible', medium: 'Semi-reversible', high: 'Hard to reverse',
}

function ConfidenceChip({ confidence, engineValidated }) {
  if (engineValidated) return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 999,
      background: 'rgba(93,219,194,.12)', color: 'var(--c-acc)',
      border: '1px solid rgba(93,219,194,.25)', marginLeft: 6,
    }}>engine ✓</span>
  )
  const pct = Math.round((confidence ?? 0) * 100)
  const col = confidence >= 0.8 ? 'var(--c-acc)' : confidence >= 0.6 ? 'var(--c-gold)' : 'var(--c-acc3)'
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 999,
      background: `${col}18`, color: col,
      border: `1px solid ${col}40`, marginLeft: 6,
    }}>{pct}%</span>
  )
}

export default function OptionCard({
  option, isRecommended, isUnconsidered,
  expanded, onToggle, onCommit, onSaveScenario,
}) {
  const irrColor = IRR_COLOR[option.irreversibility] ?? 'var(--c-text3)'

  return (
    <div
      onClick={onToggle}
      style={{
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        background: expanded ? 'var(--c-surface2)' : 'var(--c-surface)',
        border: isRecommended
          ? '1px solid rgba(93,219,194,.45)'
          : isUnconsidered
            ? '1px dashed rgba(93,219,194,.35)'
            : '1px solid var(--c-sep)',
        borderLeft: isRecommended ? '3px solid var(--c-acc)' : undefined,
        boxShadow: expanded ? 'var(--sh)' : 'none',
        transition: 'background .15s, box-shadow .15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Letter badge */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isUnconsidered ? 'rgba(93,219,194,.15)' : 'rgba(93,219,194,.25)',
          color: 'var(--c-acc)', fontWeight: 700, fontSize: 13,
          border: '1px solid rgba(93,219,194,.4)',
        }}>{option.id}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            {isRecommended && (
              <span style={{ fontSize: 10, color: 'var(--c-acc)', fontWeight: 700, letterSpacing: '0.05em' }}>
                RECOMMENDED
              </span>
            )}
            {isUnconsidered && (
              <span style={{ fontSize: 10, color: 'var(--c-acc)', fontWeight: 700, letterSpacing: '0.05em' }}>
                UNCONSIDERED PATH
              </span>
            )}
            {/* Irreversibility pin */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: irrColor,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: irrColor, display: 'inline-block',
              }} />
              {IRR_LABEL[option.irreversibility] ?? option.irreversibility}
            </span>
          </div>

          {/* Option name */}
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--c-text)', lineHeight: 1.3 }}>
            {option.name}
          </div>

          {/* Rationale (collapsed) */}
          {!expanded && (
            <div style={{ fontSize: 13, color: 'var(--c-text2)', marginTop: 4, lineHeight: 1.4 }}>
              {option.rationale?.slice(0, 100)}{option.rationale?.length > 100 ? '…' : ''}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span style={{
          color: 'var(--c-text3)', fontSize: 14, flexShrink: 0, lineHeight: 1,
          transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
        }}>▾</span>
      </div>

      {/* Consequences (always visible) */}
      {(option.consequences ?? []).length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(option.consequences ?? []).map((c, i) => (
            <div key={i} style={{
              padding: '5px 10px', borderRadius: 8, flexShrink: 0,
              background: 'var(--c-surface3, rgba(39,54,71,.6))',
              border: '1px solid var(--c-sep)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', marginBottom: 1 }}>{c.metric}</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)' }}>{c.value}</span>
                <ConfidenceChip confidence={c.confidence} engineValidated={c.engineValidated} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 16 }}>
          {/* Rationale */}
          <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--c-text2)', lineHeight: 1.5 }}>
            {option.rationale}
          </p>

          {/* Pros / Cons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {option.pros?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-acc)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>For</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                  {option.pros.map((p, i) => <li key={i} style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 3 }}>{p}</li>)}
                </ul>
              </div>
            )}
            {option.cons?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-acc3)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Against</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                  {option.cons.map((c, i) => <li key={i} style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 3 }}>{c}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Sequence */}
          {option.sequence?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sequence</div>
              <ol style={{ margin: 0, padding: '0 0 0 20px' }}>
                {option.sequence.map((s, i) => (
                  <li key={i} style={{
                    fontSize: 13, color: 'var(--c-text2)', marginBottom: 6, lineHeight: 1.4,
                  }}>
                    <span style={{
                      display: 'inline-block', minWidth: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(93,219,194,.15)', color: 'var(--c-acc)',
                      fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: '20px',
                      marginRight: 8, verticalAlign: 'middle',
                    }}>{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Risks */}
          {option.risks?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--c-acc3)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risks</div>
              <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'none' }}>
                {option.risks.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--c-text2)', marginBottom: 4, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--c-acc3)', flexShrink: 0 }}>⚠</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sub-decisions */}
          {option.subDecisions?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--c-text3)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before committing</div>
              {option.subDecisions.map(sd => (
                <div key={sd.id} style={{
                  fontSize: 13, color: 'var(--c-text2)', marginBottom: 4,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(93,219,194,.06)',
                  border: '1px solid rgba(93,219,194,.15)',
                }}>
                  <span style={{ color: 'var(--c-acc)', fontWeight: 600, marginRight: 8 }}>{sd.id}</span>
                  {sd.q}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--c-sep)' }}>
            <button
              onClick={onCommit}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--c-acc)', color: 'var(--c-acc-contrast, #0B1F3A)',
                fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              }}>
              Commit to this path
            </button>
            <button
              onClick={onSaveScenario}
              style={{
                padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                background: 'none', border: '1px solid var(--c-acc)',
                color: 'var(--c-acc)', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
              }}>
              Save as scenario
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
