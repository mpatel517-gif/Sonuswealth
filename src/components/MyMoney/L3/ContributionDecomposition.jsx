// ContributionDecomposition.jsx — answers "how much did I put in vs how much
// grew" as a STACKED AREA, not an overlay on a skewed second scale (charting
// law: contributions as decomposition). The same total splits into a contributed
// base (you + employer) and an investment-growth band on top — one axis, no skew.
// Past contributions are folded into today's base; forward years add ongoing
// contributions so the user sees what they invest from here on.
import { projectValue } from '../../../engine/projection.js'

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

const BANDS = [
  { key: 'personal', label: 'You paid in', c: 'var(--c-acc,#5ddbc2)' },
  { key: 'employer', label: 'Employer paid in', c: 'var(--c-violet,#9B8CFF)' },
  { key: 'growth', label: 'Investment growth', c: 'var(--c-gold,#E8B84B)' },
]

export function ContributionDecomposition({ now = 0, currentAge = 60, retireAge = 67, rate = 0.05, contributedToDate = {}, contributionMonthly = {} }) {
  const pAnnual = (+contributionMonthly.personal || 0) * 12
  const eAnnual = (+contributionMonthly.employer || 0) * 12
  const p0 = +contributedToDate.personal || 0
  const e0 = +contributedToDate.employer || 0
  const horizon = Math.max(currentAge, retireAge)

  // Per-year stacked components from today to retirement.
  const rows = []
  for (let age = currentAge; age <= horizon; age++) {
    const y = age - currentAge
    const personal = p0 + pAnnual * y
    const employer = e0 + eAnnual * y
    const total = projectValue(now, rate, y, pAnnual + eAnnual)
    const growth = Math.max(0, total - personal - employer)
    rows.push({ age, personal, employer, growth, total })
  }

  const end = rows[rows.length - 1]
  const maxV = Math.max(...rows.map(r => r.total), 1)

  const W = 320, H = 120, L = 6, R = 6, T = 8, B = 16
  const xAt = (age) => L + ((age - currentAge) / (horizon - currentAge || 1)) * (W - L - R)
  const yAt = (v) => T + (1 - v / maxV) * (H - T - B)

  // Build a filled polygon for each band by stacking cumulative tops.
  const areaFor = (lowerKeys, key) => {
    const top = rows.map(r => lowerKeys.reduce((s, k) => s + r[k], 0) + r[key])
    const bot = rows.map(r => lowerKeys.reduce((s, k) => s + r[k], 0))
    const topPts = rows.map((r, i) => `${xAt(r.age).toFixed(1)},${yAt(top[i]).toFixed(1)}`)
    const botPts = rows.map((r, i) => `${xAt(r.age).toFixed(1)},${yAt(bot[i]).toFixed(1)}`).reverse()
    return [...topPts, ...botPts].join(' ')
  }

  const hasEmployer = e0 > 0 || eAnnual > 0
  const investedNow = p0 + e0
  const growthNow = Math.max(0, now - investedNow)

  return (
    <div style={{ background: 'var(--c-surface,rgba(255,255,255,0.04))', borderRadius: 'var(--r-lg,14px)', padding: 14 }}>
      <div className="sw-eyebrow">WHAT YOU PUT IN vs WHAT IT GREW</div>
      <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 3 }}>
        Of {fmt(now)} today, <b style={{ color: 'var(--c-text)' }}>{fmt(investedNow)}</b> is money paid in and <b style={{ color: 'var(--c-gold,#E8B84B)' }}>{fmt(growthNow)}</b> is investment growth.
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="contributions versus growth" style={{ display: 'block', marginTop: 8 }}>
        {[0, 0.5, 1].map(f => {
          const v = maxV * f, y = yAt(v)
          return <g key={f}><line x1={L} y1={y} x2={W - R} y2={y} stroke="var(--c-border,rgba(255,255,255,0.08))" strokeWidth="1" /><text x={L} y={y - 2} fontSize="7" fill="var(--c-text3,#8895a7)">{fmt(v)}</text></g>
        })}
        <polygon points={areaFor([], 'personal')} fill="var(--c-acc,#5ddbc2)" opacity="0.55" />
        {hasEmployer && <polygon points={areaFor(['personal'], 'employer')} fill="var(--c-violet,#9B8CFF)" opacity="0.55" />}
        <polygon points={areaFor(hasEmployer ? ['personal', 'employer'] : ['personal'], 'growth')} fill="var(--c-gold,#E8B84B)" opacity="0.45" />
        {[currentAge, horizon].map(a => <text key={a} x={xAt(a)} y={H - 5} fontSize="7" fill="var(--c-text3,#8895a7)" textAnchor={a === currentAge ? 'start' : 'end'}>age {a}</text>)}
      </svg>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {BANDS.filter(b => b.key !== 'employer' || hasEmployer).map(b => (
          <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--c-text2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: b.c, display: 'inline-block', opacity: 0.6 }} />
            {b.label} · <b style={{ color: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(end[b.key])}</b> by {horizon}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>Contributions are flat for illustration; growth uses the net rate from the projection above. Your assumption, not a forecast.</div>
    </div>
  )
}
