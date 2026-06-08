// src/lib/event-store.js
// ─────────────────────────────────────────────────────────────────────────────
// Append-only event persistence over Supabase `core_events` (D-EVENTSTORE-1).
//
// F2 SCAFFOLD — deliberately INERT until the auth + entity model is wired:
//   · core_events.entity_id is a UUID FK to core_entities (currently 0 rows).
//   · core_entities has NO user_id column yet, so there is no user→entity link
//     in the live schema. This adapter resolves the entity from a forward hook
//     (auth user_metadata.entity_id) where the future onboarding flow will stash
//     it; until then currentEntityId() returns null and EVERY call no-ops.
//   · Demo personas are local-JSON fixtures with no auth and no entity → no-op.
//
// So this file changes NOTHING for the demo today. It exists so that the moment
// a real signed-in user with a core_entities row exists, committed events start
// persisting and hydrating with no further wiring. The in-memory event layer
// (src/state/events.jsx) stays the read-model and source of truth for the UI.
//
// I/O only — pure event shapes live in events-validator.js. Mirrors the
// net-worth-history.js Supabase-wrapper precedent (RLS scopes rows server-side).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase.js'

const EVENTS = 'core_events'

// Resolve the signed-in user's primary entity_id. Returns null in demo mode,
// when signed out, or until the user→entity mapping exists (inert by design).
async function currentEntityId() {
  try {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return null
    // Forward hook: the onboarding/auth flow will stamp the created entity id
    // onto the user. No fabrication — if it isn't there, we stay inert.
    return user.user_metadata?.entity_id || null
  } catch {
    return null
  }
}

// Persist one committed event (append-only). Fire-and-forget from the reducer;
// never throws into React. No-op when there is no resolvable entity.
export async function persistEvent(event) {
  if (!event || typeof event.type !== 'string') return { skipped: true, reason: 'no event' }
  const entityId = await currentEntityId()
  if (!entityId) return { skipped: true, reason: 'no entity (demo / signed-out / unmapped)' }
  const row = {
    entity_id: entityId,
    event_type: event.type,                    // event_family is GENERATED from this server-side
    occurred_at: new Date(event.ts || Date.now()).toISOString(),
    source: 'user',                            // CHECK constraint: user|engine|scheduler|aggregator|admin
    correlation_id: event.correlation_id || null,
    bundle_id: event.bundle_id || null,
    payload: event.payload || {},
  }
  try {
    const { data, error } = await supabase.from(EVENTS).insert(row).select('id').single()
    return { data, error }
  } catch (error) {
    return { error }
  }
}

// Hydrate the committed user-event log for the signed-in user's entity, mapped
// back to the in-memory shape { type, ts, payload } the reducer folds. Returns
// [] in demo / signed-out (inert) so callers can dispatch unconditionally.
export async function hydrateEvents() {
  const entityId = await currentEntityId()
  if (!entityId) return []
  try {
    const { data, error } = await supabase.from(EVENTS)
      .select('event_type, occurred_at, payload')
      .eq('entity_id', entityId)
      .eq('source', 'user')
      .order('occurred_at', { ascending: true })
    if (error || !Array.isArray(data)) return []
    return data.map(r => ({
      type: r.event_type,
      ts: new Date(r.occurred_at).getTime(),
      payload: r.payload || {},
    }))
  } catch {
    return []
  }
}
