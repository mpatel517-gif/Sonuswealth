// EstatePositionSection — fixed bottom-left section.
// Reads cross-tab IHT chip from T&E (via ripple.iht in Wave 0; via dedicated
// ihtChipsForMyMoney engine function in Wave 0.5).
//
// In Wave 0 this renders the placeholder. Wave 0.5 wires real data.

export function EstatePositionSection({ position, exposure, daysToActivation, action }) {
  return (
    <div
      className="sw-l3-estate"
      style={{
        background: 'linear-gradient(180deg, rgba(255,180,120,0.08), rgba(255,180,120,0.02))',
        border: '1px solid rgba(255,180,120,0.3)',
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
        INHERITANCE TAX POSITION
      </div>
      <div
        className="sw-l3-row-value"
        style={{
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {position ?? 'Position pending (Wave 0.5 wires real data)'}
      </div>
      {exposure != null && (
        <div
          className="sw-l3-row-sub"
          style={{
            fontSize: 8,
            opacity: 0.65,
            marginTop: 3,
          }}
        >
          Exposure: £{exposure.toLocaleString()}
          {daysToActivation != null && ` · ${daysToActivation} days until rule activates`}
        </div>
      )}
      {action && (
        <div
          className="sw-l3-row-sub"
          style={{
            fontSize: 8,
            opacity: 0.65,
            marginTop: 4,
            fontStyle: 'italic',
          }}
        >
          Action: {action}
        </div>
      )}
    </div>
  )
}
