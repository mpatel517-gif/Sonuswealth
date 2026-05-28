// DataConfidenceSection — fixed bottom-right section.
// FP-4 confidence bar showing data quality + add-document affordance.

const LEVEL_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function DataConfidenceSection({
  level = 'high',
  totalFields,
  verifiedFields,
  lastValuation,
}) {
  const levelLabel = LEVEL_LABELS[level] ?? 'Unknown'
  const showFieldCount = totalFields != null && verifiedFields != null

  return (
    <div
      className="sw-l3-confidence"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div
        className="sw-l3-row-label"
        style={{
          fontSize: 8,
          opacity: 0.55,
          letterSpacing: '0.08em',
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        DATA QUALITY
      </div>
      <div
        className="sw-l3-row-value"
        style={{
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {levelLabel}
        {showFieldCount && ` · ${verifiedFields} of ${totalFields} fields verified`}
      </div>
      {lastValuation && (
        <div
          className="sw-l3-row-sub"
          style={{
            fontSize: 8,
            opacity: 0.65,
            marginTop: 3,
          }}
        >
          Last valuation {lastValuation} · Upload a statement to refresh
        </div>
      )}
    </div>
  )
}
