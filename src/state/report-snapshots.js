// src/state/report-snapshots.js
// Interim persistence for Reports SP-1 (D-RPT-SP1-C). localStorage only — NO
// Supabase, NO immutable Vault artefact (that is SP-3). Two stores:
//   sonuswealth.snapshots  → per-persona position ledger (deduped per calendar day)
//   sonuswealth.reportlog  → "reports generated this session" list
// Backward comparison columns read priorPeriodSnapshot(); until a prior-period
// snapshot exists they render the honest-absence chip (never synthetic history).

import { netWorth, calcFQ, calcRisk } from '../engine/fq-calculator.js'

const SNAP_KEY = 'sonuswealth.snapshots'
const LOG_KEY  = 'sonuswealth.reportlog'

function read(key) {
  if (typeof localStorage === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function write(key, val) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* quota / disabled */ }
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

// Build the position vector we capture. Pure read of engine outputs.
export function positionVector(entity) {
  let nw = 0, wealth = null, risk = null, iht = null
  try { nw = netWorth(entity) } catch { /* */ }
  try { wealth = calcFQ(entity)?.total ?? null } catch { /* */ }
  try { risk = calcRisk(entity)?.total ?? null } catch { /* */ }
  return { netWorth: nw, wealthScore: wealth, riskScore: risk, iht }
}

// Capture a position snapshot for a persona, deduped per calendar day.
// Returns the snapshot written (or the existing one for today).
export function captureSnapshot(personaId, entity) {
  if (!personaId || !entity) return null
  const all = read(SNAP_KEY)
  const list = Array.isArray(all[personaId]) ? all[personaId] : []
  const date = todayISO()
  const existing = list.find(s => s.date === date)
  if (existing) return existing
  const snap = { date, ...positionVector(entity) }
  all[personaId] = [...list, snap].slice(-400) // cap growth
  write(SNAP_KEY, all)
  return snap
}

export function getSnapshots(personaId) {
  const all = read(SNAP_KEY)
  return Array.isArray(all[personaId]) ? all[personaId] : []
}

// Most-recent snapshot strictly before the given period boundary.
// period: 'lastMonth' | 'lastYear'. Returns null when no prior snapshot exists.
export function priorPeriodSnapshot(personaId, period) {
  const list = getSnapshots(personaId)
  if (list.length === 0) return null
  const now = new Date()
  const boundary = new Date(now)
  if (period === 'lastMonth') boundary.setMonth(boundary.getMonth() - 1)
  else if (period === 'lastYear') boundary.setFullYear(boundary.getFullYear() - 1)
  else return null
  const bISO = boundary.toISOString().slice(0, 10)
  // newest snapshot on or before the boundary
  const eligible = list.filter(s => s.date <= bISO).sort((a, b) => (a.date < b.date ? 1 : -1))
  return eligible[0] || null
}

export function recordReportGenerated(personaId, reportType) {
  if (!personaId || !reportType) return
  const all = read(LOG_KEY)
  const list = Array.isArray(all[personaId]) ? all[personaId] : []
  all[personaId] = [{ reportType, at: new Date().toISOString() }, ...list].slice(0, 50)
  write(LOG_KEY, all)
}

export function lastGenerated(personaId, reportType) {
  const all = read(LOG_KEY)
  const list = Array.isArray(all[personaId]) ? all[personaId] : []
  return list.find(r => r.reportType === reportType) || null
}
