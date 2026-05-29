// ─────────────────────────────────────────────────────────────────────────────
// events-validator — plain-JS event-shape validator (L2-6a, 2026-05-28)
//
// Extracted from src/state/events.jsx so it can be unit-tested under Node
// without a JSX loader. events.jsx re-exports both `EV` and `validateEvent`
// from this file so call sites keep working unchanged.
//
// See the longer doc-comment in events.jsx for the rationale; this file is
// just the pure-JS guts.
// ─────────────────────────────────────────────────────────────────────────────

export const EV = {
  DRAWDOWN_SCHEDULE_SET: 'drawdown_schedule_set',
  DRAWDOWN_COMMITTED:    'drawdown_committed',
  NOMINATION_REVIEWED:   'nomination_reviewed',
  ASSET_VALUE_UPDATED:   'ASSET_VALUE_UPDATED',
  ASSET_REMOVED:         'ASSET_REMOVED',
  DOCUMENT_CAPTURED:     'DOCUMENT_CAPTURED',
  SCENARIO_SAVED:        'SCENARIO_SAVED',
  document_captured:     'document_captured', // legacy lowercase alias from DataCapture
}

export function validateEvent(event) {
  const errors = []
  const warnings = []

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { ok: false, errors: ['event is null, not an object, or an array'], warnings }
  }
  if (typeof event.type !== 'string' || !event.type.trim()) {
    errors.push('event.type is required and must be a non-empty string')
  }
  if (event.payload != null && (typeof event.payload !== 'object' || Array.isArray(event.payload))) {
    errors.push('event.payload, if present, must be an object')
  }
  if (event.schema_version != null && typeof event.schema_version !== 'string') {
    errors.push('event.schema_version, if present, must be a string')
  }

  if (event.type && !Object.values(EV).includes(event.type)) {
    warnings.push(`event.type '${event.type}' is not in the registered EV map — add to EV if intended`)
  }
  if (!event.ts && !event.event_timestamp && !event.client_timestamp) {
    warnings.push('event has no timestamp field (ts | event_timestamp | client_timestamp) — reducer will inject Date.now()')
  }

  return { ok: errors.length === 0, errors, warnings }
}
