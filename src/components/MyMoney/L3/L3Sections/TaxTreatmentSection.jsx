// TaxTreatmentSection — fixed top section. The IT/CGT/IHT three-row per
// spec §2.3. Each row has plain-English headline + optional detail.

export function TaxTreatmentSection({ incomeTax, capitalGains, inheritance }) {
  return (
    <div
      className="sw-l3-tax-treatment"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        gap: 12,
      }}
    >
      <TaxRow label="INCOME TAX" data={incomeTax} />
      <TaxRow label="CAPITAL GAINS TAX" data={capitalGains} />
      <TaxRow label="INHERITANCE TAX" data={inheritance} />
    </div>
  )
}

function TaxRow({ label, data }) {
  return (
    <div
      className="sw-l3-tax-row"
      style={{
        flex: 1,
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
        {label}
      </div>
      <div
        className="sw-l3-row-value"
        style={{
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {data?.headline ?? '—'}
      </div>
      {data?.detail && (
        <div
          className="sw-l3-row-sub"
          style={{
            fontSize: 8,
            opacity: 0.65,
            marginTop: 3,
            lineHeight: 1.4,
          }}
        >
          {data.detail}
        </div>
      )}
    </div>
  )
}
