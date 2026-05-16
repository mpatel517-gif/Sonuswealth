// ─────────────────────────────────────────────────────────────────────────────
// BeneficiarySankey — SVG Sankey for the estate → IHT → beneficiary chain
// Spec: tax-estate §6.10
//
// Flow:    estate.gross → deductions[] → iht → net → beneficiaries[]
// Widths:  proportional to amount.
// Contingent edges: dashed.
// APS edge (surviving spouse): rendered separately as a top-edge over `gross`,
//          flowing diagonally down before the deductions stack.
//
// No external lib. Pure SVG paths (cubic Béziers).
//
// Props:
//   estate        { gross, deductions: [{label, amount}], iht, net }
//   beneficiaries [{ name, share, isContingent? }]   share is fraction (0..1) of net
//   apsEdge       { amount, label? }   optional surviving-spouse APS edge
// ─────────────────────────────────────────────────────────────────────────────

const W = 720
const H = 360
const PAD_X = 24
const PAD_Y = 24
const COL_W = 18
const COL_GAP = 130 // horizontal distance between node columns

function fmtGBP(n) {
  if (!Number.isFinite(n)) return '£—'
  return '£' + Math.round(n).toLocaleString('en-GB')
}

// Cubic-bezier path between (x1,y1) → (x2,y2) with curvature halfway.
function flowPath(x1, y1, x2, y2, thickness) {
  const mx = (x1 + x2) / 2
  return [
    `M ${x1},${y1 - thickness / 2}`,
    `C ${mx},${y1 - thickness / 2} ${mx},${y2 - thickness / 2} ${x2},${y2 - thickness / 2}`,
    `L ${x2},${y2 + thickness / 2}`,
    `C ${mx},${y2 + thickness / 2} ${mx},${y1 + thickness / 2} ${x1},${y1 + thickness / 2}`,
    'Z',
  ].join(' ')
}

export default function BeneficiarySankey({
  estate = { gross: 0, deductions: [], iht: 0, net: 0 },
  beneficiaries = [],
  apsEdge = null,
}) {
  const grossTotal = Math.max(estate.gross || 0, 1) // avoid div0
  const usableH = H - PAD_Y * 2

  // Vertical scale: pixels per pound
  const yScale = usableH / grossTotal

  // ── Column 1: gross
  const col1X = PAD_X
  const grossY = PAD_Y
  const grossH = grossTotal * yScale

  // ── Column 2: deductions (vertically stacked) + iht
  const col2X = col1X + COL_GAP
  const items = []
  let runningY = PAD_Y
  ;(estate.deductions || []).forEach((d, i) => {
    const h = (d.amount || 0) * yScale
    items.push({
      kind: 'deduction',
      key: `ded-${i}`,
      label: d.label,
      amount: d.amount,
      y: runningY,
      h,
    })
    runningY += h
  })
  const ihtH = (estate.iht || 0) * yScale
  items.push({ kind: 'iht', key: 'iht', label: 'IHT',  amount: estate.iht, y: runningY, h: ihtH })
  runningY += ihtH

  const netH = Math.max(0, grossH - (runningY - PAD_Y))
  // ── Column 3: net
  const col3X = col2X + COL_GAP
  const netY = PAD_Y + grossH - netH

  // ── Column 4: beneficiaries
  const col4X = col3X + COL_GAP
  const benefs = (beneficiaries || []).map((b, i) => ({
    ...b,
    key: `b-${i}`,
    h: Math.max(0, (b.share || 0) * netH),
  }))
  let bY = netY
  benefs.forEach(b => { b.y = bY; bY += b.h })

  return (
    <div className="card">
      <div className="card-title">Beneficiary chain</div>
      <div style={{
        background: 'var(--c-surface2)',
        borderRadius: 12,
        padding: 8,
        overflow: 'auto',
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Estate to beneficiary Sankey diagram"
        >
          {/* ── APS edge (if present) ──────────────────────────────────── */}
          {apsEdge && apsEdge.amount > 0 && (() => {
            const apsH = apsEdge.amount * yScale
            const apsY1 = PAD_Y - 6 - apsH / 2
            const apsY2 = grossY + apsH / 2
            return (
              <g>
                <path
                  d={flowPath(col1X - 28, apsY1, col1X, apsY2, apsH)}
                  fill="color-mix(in srgb, var(--c-accent) 30%, transparent)"
                />
                <text
                  x={col1X - 30} y={apsY1 - 4}
                  fontSize={10} fill="var(--c-acc2)"
                  fontWeight={700} textAnchor="start"
                >
                  {apsEdge.label || 'APS allowance'} · {fmtGBP(apsEdge.amount)}
                </text>
              </g>
            )
          })()}

          {/* ── Gross node ──────────────────────────────────────────── */}
          <rect
            x={col1X} y={grossY} width={COL_W} height={grossH}
            fill="var(--c-acc)"
            opacity={0.85}
            rx={3}
          />
          <text
            x={col1X} y={grossY - 6}
            fontSize={11} fill="var(--c-text)"
            fontWeight={700}
          >
            Estate
          </text>
          <text
            x={col1X} y={grossY + grossH + 14}
            fontSize={10} fill="var(--c-text3)"
          >
            {fmtGBP(estate.gross)}
          </text>

          {/* ── Flows from gross → each col2 item (deductions + iht) ─── */}
          {items.map((it) => {
            const fill = it.kind === 'iht'
              ? 'color-mix(in srgb, var(--c-danger) 28%, transparent)'
              : 'color-mix(in srgb, var(--c-muted) 18%, transparent)'
            return (
              <path
                key={`flow1-${it.key}`}
                d={flowPath(
                  col1X + COL_W,
                  it.y + it.h / 2,
                  col2X,
                  it.y + it.h / 2,
                  it.h,
                )}
                fill={fill}
              />
            )
          })}

          {/* ── Column 2: deductions + IHT nodes ─────────────────────── */}
          {items.map((it) => (
            <g key={it.key}>
              <rect
                x={col2X} y={it.y} width={COL_W} height={it.h}
                fill={it.kind === 'iht' ? 'var(--c-acc3)' : 'var(--c-text3)'}
                opacity={0.85}
                rx={3}
              />
              <text
                x={col2X + COL_W + 6} y={it.y + it.h / 2 + 3}
                fontSize={10} fill="var(--c-text)"
              >
                {it.label} {fmtGBP(it.amount || 0)}
              </text>
            </g>
          ))}

          {/* ── Net node ─────────────────────────────────────────────── */}
          <rect
            x={col3X} y={netY} width={COL_W} height={netH}
            fill="var(--c-acc)"
            opacity={0.85}
            rx={3}
          />
          <text
            x={col3X} y={netY - 6}
            fontSize={11} fill="var(--c-text)" fontWeight={700}
          >
            Net to heirs
          </text>
          <text
            x={col3X} y={netY + netH + 14}
            fontSize={10} fill="var(--c-text3)"
          >
            {fmtGBP(estate.net)}
          </text>

          {/* ── Flow: col2 deductions are dead-ends; iht crosses to col3 only as
                 a label.  The "alive" flow from gross → net is one big ribbon
                 from gross (top portion sized to net) directly to net. ── */}
          <path
            d={flowPath(
              col1X + COL_W, grossY + netH / 2,
              col3X, netY + netH / 2,
              netH,
            )}
            fill="color-mix(in srgb, var(--c-success) 18%, transparent)"
          />

          {/* ── Beneficiary flows + nodes ────────────────────────────── */}
          {benefs.map(b => {
            const stroke = b.isContingent ? 'color-mix(in srgb, var(--c-accent) 70%, transparent)' : 'transparent'
            const dash = b.isContingent ? '6,4' : ''
            return (
              <g key={b.key}>
                <path
                  d={flowPath(
                    col3X + COL_W, b.y + b.h / 2,
                    col4X, b.y + b.h / 2,
                    b.h,
                  )}
                  fill={b.isContingent ? 'color-mix(in srgb, var(--c-accent) 10%, transparent)' : 'color-mix(in srgb, var(--c-success) 22%, transparent)'}
                  stroke={stroke}
                  strokeWidth={b.isContingent ? 1 : 0}
                  strokeDasharray={dash}
                />
                <rect
                  x={col4X} y={b.y} width={COL_W} height={b.h}
                  fill={b.isContingent ? 'var(--c-acc2)' : 'var(--c-acc)'}
                  opacity={0.85}
                  rx={3}
                />
                <text
                  x={col4X + COL_W + 6} y={b.y + b.h / 2 + 3}
                  fontSize={10} fill="var(--c-text)"
                >
                  {b.name} · {Math.round((b.share || 0) * 100)}%
                  {b.isContingent ? ' (contingent)' : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{
        marginTop: 10,
        fontSize: 'var(--fs-label)',
        color: 'var(--c-text3)',
        display: 'flex', gap: 14, flexWrap: 'wrap',
      }}>
        <span><span style={{ color: 'var(--c-acc)' }}>■</span> Direct</span>
        <span><span style={{ color: 'var(--c-acc2)' }}>■</span> Contingent (dashed)</span>
        <span><span style={{ color: 'var(--c-acc3)' }}>■</span> IHT</span>
      </div>
    </div>
  )
}

export { BeneficiarySankey }
