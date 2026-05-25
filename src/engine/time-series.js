// ─────────────────────────────────────────────────────────────────────────────
// time-series — Wave 0 / E1 (W0-T3)
//
// Returns time-series data for any entity metric, scoped to a time window.
// Powers every sparkline + every L4 chart drill panel across the product.
//
// Reads from entity.trajectories.* first (populated by Phase 2 Batch A across
// every persona). Falls through to empty result with explicit gap markers if
// trajectory data is absent. Per PP-7 (no fake precision), this function NEVER
// synthesises history — when requested window exceeds available data, returns
// the available portion + a gaps[] entry describing the missing range. The
// caller (DrillableChart) renders gaps as visible discontinuities.
//
// Public API:
//   getTimeSeries(entity, metric, window='1Y', granularity='month')
//
// Returns: {
//   points:        [{ date: 'YYYY-MM-DD', value: number, contribution?, withdrawal?, event? }],
//   window:        echoes input
//   granularity:   echoes input
//   confidence:    'high' | 'medium' | 'low'
//   dataStartDate: 'YYYY-MM-DD' or null
//   dataEndDate:   'YYYY-MM-DD' or null
//   gaps:          [{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', reason: string }]
// }
//
// Supported metrics (W0 scope — extend as L3 panels need more):
//   net_worth, wealth_score, risk_score
//   pension_value, isa_value, gia_value, cash_value, property_value, iht_exposure
// ─────────────────────────────────────────────────────────────────────────────

// Map metric → trajectory accessor. Each accessor receives entity and returns
// an array of {date, value} OR {date, score} (legacy shape from older
// trajectorySeeder output).
const METRIC_ACCESSORS = {
  net_worth:      (e) => e?.trajectories?.netWorthHistory ?? [],
  wealth_score:   (e) => e?.trajectories?.scoreHistory    ?? [],
  risk_score:     (e) => e?.trajectories?.riskHistory     ?? [],
  pension_value:  (e) => e?.trajectories?.pensionHistory  ?? [],
  isa_value:      (e) => e?.trajectories?.isaHistory      ?? [],
  gia_value:      (e) => e?.trajectories?.giaHistory      ?? [],
  cash_value:     (e) => e?.trajectories?.cashHistory     ?? [],
  property_value: (e) => e?.trajectories?.propertyHistory ?? [],
  iht_exposure:   (e) => e?.trajectories?.ihtHistory      ?? [],
}

const WINDOW_DAYS = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '3Y': 1095,
  '5Y': 1825,
  '10Y': 3650,
  'All': Infinity,
}

// Extract a numeric value from a trajectory point that may use either
// {value: n} (newer) or {score: n} (legacy seeder output for score histories).
function pointValue(p) {
  if (typeof p?.value === 'number' && Number.isFinite(p.value)) return p.value
  if (typeof p?.score === 'number' && Number.isFinite(p.score)) return p.score
  return null
}

export function getTimeSeries(entity, metric, window = '1Y', granularity = 'month') {
  const baseResult = {
    points: [],
    window,
    granularity,
    confidence: 'low',
    dataStartDate: null,
    dataEndDate: null,
    gaps: [],
  }

  // 1. Null / missing entity — graceful return
  if (!entity) {
    return { ...baseResult, gaps: [{ from: null, to: null, reason: 'no entity provided' }] }
  }

  // 2. Unknown metric — graceful low-confidence empty
  const accessor = METRIC_ACCESSORS[metric]
  if (!accessor) {
    return { ...baseResult, gaps: [{ from: null, to: null, reason: `unknown metric: ${metric}` }] }
  }

  // 3. Read trajectory; map to normalised {date, value} shape
  const raw = accessor(entity)
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ...baseResult, gaps: [{ from: null, to: null, reason: `no trajectory data for ${metric}` }] }
  }

  const all = raw
    .map(p => ({ date: p.date, value: pointValue(p) }))
    .filter(p => p.date && p.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (all.length === 0) {
    return { ...baseResult, gaps: [{ from: null, to: null, reason: `trajectory points malformed for ${metric}` }] }
  }

  // 4. Apply window filter
  const days = WINDOW_DAYS[window] ?? 365
  const now = new Date()
  const cutoff = days === Infinity ? new Date(0) : new Date(now.getTime() - days * 86400000)
  const windowed = days === Infinity ? all : all.filter(p => new Date(p.date) >= cutoff)

  // 5. Gap detection — requested window vs available data
  const dataStartDate = all[0].date
  const dataEndDate   = all[all.length - 1].date
  const gaps = []
  if (days !== Infinity) {
    const dataStart = new Date(dataStartDate)
    if (dataStart > cutoff) {
      gaps.push({
        from: cutoff.toISOString().split('T')[0],
        to: dataStartDate,
        reason: 'data starts after requested window',
      })
    }
  }

  // 6. Confidence based on density of available data in the window
  const confidence =
    windowed.length >= 6 ? 'high' :
    windowed.length >= 3 ? 'medium' :
    'low'

  return {
    points: windowed,
    window,
    granularity,
    confidence,
    dataStartDate,
    dataEndDate,
    gaps,
  }
}
