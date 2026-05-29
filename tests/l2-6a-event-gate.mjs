// ─────────────────────────────────────────────────────────────────────────────
// L2-6a — Event-shape validator gate test
//
// Covers validateEvent + reducer drop-behaviour. Mirrors the pattern from
// tests/l2-3-onboarding-gate.mjs.
//
// What this proves:
//   1. validateEvent rejects null / non-object / array events
//   2. validateEvent requires event.type as a non-empty string
//   3. validateEvent rejects non-object payloads
//   4. validateEvent rejects non-string schema_version
//   5. validateEvent warns (but allows) unregistered EV types
//   6. validateEvent warns (but allows) missing timestamps
//   7. validateEvent accepts the shape DataCapture produces
//   8. validateEvent accepts the shape Dashboard.handleCommit produces
//
// Run: node tests/l2-6a-event-gate.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { validateEvent, EV } from '../src/state/events-validator.js'

let fails = 0
function check(label, cond, detail) {
  if (cond) {
    console.log(`✓ ${label}`)
  } else {
    console.log(`✗ ${label} — ${detail || ''}`)
    fails++
  }
}

// ── Case 1 — null event ────────────────────────────────────────────────────
{
  const r = validateEvent(null)
  check(
    'Case 1 — null event is rejected',
    r.ok === false && /null|not an object/.test(r.errors.join(' ')),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 2 — array (not an object) ─────────────────────────────────────────
{
  const r = validateEvent([{ type: 'X' }])
  check(
    'Case 2 — array event is rejected',
    r.ok === false,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 3 — missing type ──────────────────────────────────────────────────
{
  const r = validateEvent({ payload: { foo: 1 } })
  check(
    'Case 3 — missing event.type is rejected',
    r.ok === false && r.errors.some(s => /type/.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 4 — empty-string type ─────────────────────────────────────────────
{
  const r = validateEvent({ type: '   ', payload: {} })
  check(
    'Case 4 — blank event.type is rejected',
    r.ok === false,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 5 — non-object payload ────────────────────────────────────────────
{
  const r = validateEvent({ type: EV.ASSET_VALUE_UPDATED, payload: 'a string' })
  check(
    'Case 5 — string payload is rejected',
    r.ok === false && r.errors.some(s => /payload/.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 6 — non-string schema_version ─────────────────────────────────────
{
  const r = validateEvent({ type: EV.ASSET_VALUE_UPDATED, schema_version: 1.0, payload: {} })
  check(
    'Case 6 — numeric schema_version is rejected',
    r.ok === false && r.errors.some(s => /schema_version/.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 7 — unregistered type (warn but allow) ────────────────────────────
{
  const r = validateEvent({ type: 'TOTALLY_NEW_EVENT', ts: 1, payload: {} })
  check(
    'Case 7 — unregistered EV type warns but is allowed',
    r.ok === true && r.warnings.some(s => /EV map/.test(s)),
    `ok=${r.ok} warnings=${JSON.stringify(r.warnings)}`
  )
}

// ── Case 8 — missing timestamp (warn but allow) ────────────────────────────
{
  const r = validateEvent({ type: EV.ASSET_VALUE_UPDATED, payload: {} })
  check(
    'Case 8 — missing timestamp warns but is allowed',
    r.ok === true && r.warnings.some(s => /timestamp/.test(s)),
    `ok=${r.ok} warnings=${JSON.stringify(r.warnings)}`
  )
}

// ── Case 9 — DataCapture envelope shape ────────────────────────────────────
{
  const envelope = {
    event_id: 'dc-1700000000-abc123',
    event_timestamp: '2026-05-28T00:00:00.000Z',
    client_timestamp: '2026-05-28T00:00:00.000Z',
    user_id: 'mrt',
    session_id: 'no-session',
    entity_id: 'mrt',
    entity_type: 'individual',
    field_path: 'sipp.contribMonthly',
    user_verified: false,
    user_verified_at: null,
    provenance: { source: 'data-capture', parser: 'mock', mode: 'upload' },
    prior_event_id: null,
    classifier_version: 'mock-1.0',
    rules_bundle_ref: 'UK-2026.1',
    from: 'upload',
    schema_version: '1.0',
    type: 'ASSET_VALUE_UPDATED',
    payload: { value: 500, unit: 'GBP', wrapper: 'sipp' },
    ts: 1700000000000,
    correlation_id: 'dc-1700000000',
  }
  const r = validateEvent(envelope)
  check(
    'Case 9 — DataCapture envelope passes',
    r.ok === true,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 10 — SCENARIO_SAVED back-flow shape (Dashboard.handleCommit) ──────
{
  const e = {
    type: 'SCENARIO_SAVED',
    ts: Date.now(),
    payload: { back_flow: 'iht', delta: 12000 },
  }
  const r = validateEvent(e)
  check(
    'Case 10 — SCENARIO_SAVED with back_flow passes',
    r.ok === true,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

console.log(`\nL2-6a event-gate test — fails=${fails}`)
if (fails > 0) process.exit(1)
