// DrawOrderMap.jsx — the "which pot first" decision visual. Pots laid out on a
// Draw-first → Keep-longest axis, sized by value, numbered into a draw path,
// each with its deciding factor + honest "capture this to sharpen" chips.
// Pure-presentational: takes `ranked` from rankDrawOrder(). No engine calls.

const fmt = (n) => {
  const a = Math.abs(Math.round(+n || 0))
  if (a >= 1e6) return `£${(a / 1e6).toFixed(2)}m`
  if (a >= 1e3) return `£${(a / 1e3).toFixed(0)}k`
  return `£${a.toLocaleString('en-GB')}`
}

const TONE = {
  'draw-first':   'var(--c-coral,#FF6F7D)',
  'middle':       'var(--c-gold,#E8B84B)',
  'keep-longest': 'var(--c-good,#5DDBA8)',
  'verify-keep':  'var(--c-gold,#E8B84B)',
}
const PRIORITY_LABEL = {
  'draw-first':   'Draw first',
  'middle':       'Draw next',
  'keep-longest': 'Keep longest',
  'verify-keep':  'Verify before drawing',
}

export function DrawOrderMap({ ranked = [] }) {
  if (!ranked.length) return null
  const W = 320, H = 130, mx = 34, my = 56
  const n = ranked.length
  const xs = (i) => n <= 1 ? W / 2 : mx + (i / (n - 1)) * (W - 2 * mx)
  const vals = ranked.map(r => r.factors?.value || 0)
  const vMax = Math.max(...vals, 1)
  const r = (v) => 14 + 16 * Math.sqrt((v || 0) / vMax)

  const anyUnknown = [...new Set(ranked.flatMap(x => x.unknowns || []))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: '0.08em', color: 'var(--c-text3)', textTransform: 'uppercase', padding: '0 6px' }}>
        <span>← Draw first</span><span>Keep longest →</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Draw-order map" style={{ display: 'block' }}>
        {/* axis */}
        <line x1={mx} y1={my} x2={W - mx} y2={my} stroke="var(--c-border,rgba(255,255,255,0.15))" strokeWidth="1" />
        {/* draw path through nodes */}
        <polyline
          fill="none" stroke="var(--c-acc,#5ddbc2)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6"
          points={ranked.map((rk, i) => `${xs(i).toFixed(1)},${my}`).join(' ')}
        />
        {ranked.map((rk, i) => {
          const cx = xs(i), rad = r(rk.factors?.value)
          const tone = TONE[rk.priority] || 'var(--c-acc,#5ddbc2)'
          const dashed = rk.priority === 'verify-keep'
          return (
            <g key={i}>
              <circle cx={cx} cy={my} r={rad} fill={`color-mix(in srgb, ${tone} 22%, transparent)`} stroke={tone} strokeWidth="2" strokeDasharray={dashed ? '4 3' : 'none'} />
              <text x={cx} y={my + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--c-text)">{rk.order}</text>
            </g>
          )
        })}
      </svg>

      {/* reasoned list */}
      <ol style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 8 }}>
        {ranked.map((rk, i) => {
          const tone = TONE[rk.priority] || 'var(--c-acc,#5ddbc2)'
          return (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flex: '0 0 22px', height: 22, borderRadius: 11, background: tone, color: '#06231f', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{rk.order}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{rk.pot?.name}</span>
                  <span style={{ fontSize: 11, color: tone, fontWeight: 700, whiteSpace: 'nowrap' }}>{PRIORITY_LABEL[rk.priority]}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text3)' }}>{fmt(rk.factors?.value)} · {((rk.factors?.charge || 0) * 100).toFixed(2)}% fee · {((rk.factors?.growth || 0) * 100).toFixed(1)}% growth</div>
                <div style={{ fontSize: 12, color: 'var(--c-text2)', marginTop: 2 }}>{rk.primaryReason}</div>
              </div>
            </li>
          )
        })}
      </ol>

      {anyUnknown.length > 0 && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--r-md,10px)', border: '1px dashed var(--c-border,rgba(255,255,255,0.2))' }}>
          <div className="sw-eyebrow">TO SHARPEN THIS ORDER, TELL US</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {anyUnknown.map(u => (
              <span key={u} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--c-surface2,rgba(255,255,255,0.06))', color: 'var(--c-text2)' }}>{u}</span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 6 }}>Without these, the two SIPPs are ranked on fee and value alone — capture each fund and any exit penalties to separate them properly.</div>
        </div>
      )}
    </div>
  )
}
