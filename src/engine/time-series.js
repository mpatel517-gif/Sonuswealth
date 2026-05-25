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
//
// Public API parameters:
//   window:        '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'All'
//                  Window is anchored off the data's own end date (NOT wall-clock
//                  now), so the function is pure: same input → same output.
//                  Unknown window strings return an empty result with a gap
//                  entry (no silent fallback).
//   granularity:   'month' | 'quarter' | 'year' (echoed but NOT enforced in W0 —
//                  downsampling is deferred to Wave 1; caller receives whatever
//                  granularity the trajectory data provides, typically monthly)
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86400000

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

  // 4. Apply window filter — anchored off the data's own end date, NOT
  // wall-clock now. This keeps the function pure (deterministic) and
  // surfaces trailing-edge gaps when data is stale (PP-7).
  if (!(window in WINDOW_DAYS)) {
    return {
      ...baseResult,
      gaps: [{ from: null, to: null, reason: `unknown window: ${window}` }],
    }
  }
  const days = WINDOW_DAYS[window]
  const dataEnd = new Date(all[all.length - 1].date)
  const cutoff = days === Infinity ? new Date(0) : new Date(dataEnd.getTime() - days * MS_PER_DAY)
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
  // Trailing-edge staleness — surface if the data ends meaningfully before
  // wall-clock now (caller may want to render a "stale" indicator). We use
  // wall-clock here ONLY for staleness detection, not for windowing — the
  // function's windowing output is still pure.
  const wallNow = new Date()
  const staleness = wallNow.getTime() - dataEnd.getTime()
  if (staleness > 45 * MS_PER_DAY) {
    gaps.push({
      from: dataEndDate,
      to: wallNow.toISOString().split('T')[0],
      reason: `data is ${Math.round(staleness / MS_PER_DAY)} days stale`,
    })
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
