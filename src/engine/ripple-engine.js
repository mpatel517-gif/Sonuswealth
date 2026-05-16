// ─────────────────────────────────────────────────────────────────────────────
// ripple-engine — PP-5 / X28 §4 / Arch Master §32.4
//
// Single canonical function `rippleEffect(entity, change, affectedTabs)` —
// EVERY scenario-mode change, plan commit, goal-seek path commit, or manual
// edit calls this. No bespoke recalc paths.
//
// Contract:
//   · Input  — current entity, change descriptor, list of affected tabs.
//   · Output — { entity: newEntity, diffs: { [tab]: TileDiff[] } }
//   · Pure  — no side effects. Caller persists the new entity via events.jsx.
//
// Wave 1 scope:
//   · Mode/window changes (Actual/Forecast/Plan/Scenario, X28 window pill)
//     — no entity mutation, but downstream tabs render mode-appropriate values.
//   · Goal-seek path commit — applies path.deltaEntity to base entity.
//   · Plan commit — writes PLAN_COMMITMENT event-like payload (Wave 2: actually
//     persists to event store).
//
// Wave 2 will add:
//   · Manual asset CRUD (Voyant-style edit/delete)
//   · Real diff manifest with animationHint per tile (powers §13.6 What-If Cinema)
//   · Per-tab ripple computation using each tab's drivers
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TABS = ['home', 'money', 'flow', 'tax', 'risk', 'plan']

/**
 * @param {object} entity         — current entity snapshot
 * @param {object} change         — { kind, ...payload }
 *   kind = 'mode'         payload: { mode: 'actual'|'forecast'|'plan'|'scenario', tab? }
 *   kind = 'window'       payload: { window: WindowId, tab? }
 *   kind = 'goalSeekPath' payload: { path: GoalSeekPath } — applies path.deltaEntity
 *   kind = 'planCommit'   payload: PlanCommitmentEvent
 *   kind = 'scenarioSave' payload: ScenarioObject
 *   kind = 'assetEdit'    payload: { path, value } — Voyant-style CRUD
 * @param {string[]} affectedTabs — defaults to ['all']
 * @returns {{ entity, diffs }}
 */
export function rippleEffect(entity, change, affectedTabs = ['all']) {
  if (!entity || typeof entity !== 'object') {
    return { entity, diffs: {} }
  }
  if (!change || typeof change !== 'object') {
    return { entity, diffs: {} }
  }

  const tabs = affectedTabs[0] === 'all' ? ALL_TABS : affectedTabs
  const next = applyChange(entity, change)
  const diffs = computeDiffs(entity, next, tabs)

  return { entity: next, diffs }
}

// ─── Internal: apply change to entity ───────────────────────────────────────
function applyChange(entity, change) {
  switch (change.kind) {
    case 'mode':
    case 'window':
      // Mode/window changes don't mutate entity — they change which engine view
      // each metric renders. Downstream readers select the right path themselves.
      return entity

    case 'goalSeekPath': {
      const path = change.path
      if (!path?.deltaEntity) return entity
      return deepMerge(entity, path.deltaEntity)
    }

    case 'planCommit':
      // Wave 2 will push the PLAN_COMMITMENT event into the events log here.
      // For now, attach to entity for downstream readers.
      return {
        ...entity,
        plans: [...(entity.plans || []), change.payload],
      }

    case 'scenarioSave':
      return {
        ...entity,
        scenarios: [...(entity.scenarios || []), change.payload],
      }

    case 'assetEdit': {
      const { path, value } = change.payload || {}
      if (!path) return entity
      return setIn(entity, path, value)
    }

    default:
      return entity
  }
}

// ─── Internal: compute per-tab diffs ────────────────────────────────────────
// Wave 1: returns empty arrays (TileDiff renderer falls back to plain render).
// Wave 2: per-tab driver functions compute the actual {tile_id, before, after,
// animationHint} manifest that powers §13.6 What-If Cinema.
function computeDiffs(oldE, newE, tabs) {
  const diffs = {}
  for (const tab of tabs) {
    diffs[tab] = [] // Wave-2 computation goes here
  }
  return diffs
}

// ─── Helpers: immutable deep set / merge ────────────────────────────────────
function setIn(obj, path, value) {
  const keys = Array.isArray(path) ? path : String(path).split('.')
  if (!keys.length) return value
  const [head, ...rest] = keys
  return {
    ...obj,
    [head]: rest.length
      ? setIn(obj?.[head] ?? {}, rest, value)
      : value,
  }
}

function deepMerge(a, b) {
  if (b == null) return a
  if (a == null) return b
  if (typeof a !== 'object' || typeof b !== 'object') return b
  if (Array.isArray(a) || Array.isArray(b)) return b
  const out = { ...a }
  for (const k of Object.keys(b)) {
    out[k] = deepMerge(a[k], b[k])
  }
  return out
}
