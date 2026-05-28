// HeroSection — fixed top of every L3.
// Renders the big number + sublabel + sparkline placeholder. Wave 4 wires
// <DrillableChart>; for now this is the layout shell.

export function HeroSection({ metric, label, sublabel, chartSeries }) {
  return (
    <div
      className="sw-l3-hero"
      style={{
        background: 'linear-gradient(180deg, rgba(93,219,194,0.10), rgba(93,219,194,0.02))',
        border: '1px solid rgba(93,219,194,0.3)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 90,
      }}
    >
      <div className="sw-l3-hero-text">
        {label && (
          <div
            className="sw-l3-hero-label"
            style={{
              fontSize: 8,
              opacity: 0.6,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        )}
        <div
          className="sw-l3-hero-value"
          style={{
            fontSize: 28,
            fontWeight: 850,
            color: 'var(--c-text, #fff)',
            letterSpacing: '-0.02em',
          }}
        >
          {metric}
        </div>
        {sublabel && (
          <div
            className="sw-l3-hero-sublabel"
            style={{
              fontSize: 9,
              opacity: 0.7,
              marginTop: 4,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
      <div
        className="sw-l3-hero-chart"
        style={{
          flex: 1,
          maxWidth: 360,
          marginLeft: 30,
          minHeight: 50,
        }}
      >
        {chartSeries && (
          // Wave 4 replaces this with <DrillableChart metric={...} series={chartSeries} />
          <div
            style={{
              opacity: 0.4,
              fontSize: 9,
            }}
          >
            chart wires in Wave 4 · {Array.isArray(chartSeries) ? chartSeries.length : 0} points
          </div>
        )}
      </div>
    </div>
  )
}
