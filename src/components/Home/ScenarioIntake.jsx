/* ScenarioIntake — Task 5 placeholder
   Full question-bank UI will be implemented in Task 5.
   This stub allows ActionsCard to import and render without build errors.
*/

export default function ScenarioIntake({ scenario, onBack, onSubmit }) {
  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--c-acc)', fontSize: 13, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ← Back
      </button>
      <div style={{ fontSize: 13, color: 'var(--c-text)', marginTop: 12, fontWeight: 700 }}>
        {scenario?.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 4 }}>
        Loading question bank… (Task 5 placeholder)
      </div>
      <button
        onClick={() => onSubmit?.({ query: scenario?.query || '', eventId: scenario?.eventId })}
        style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 999,
          background: 'var(--c-acc)', border: 'none', color: '#0B1F3A',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Continue →
      </button>
    </div>
  )
}
