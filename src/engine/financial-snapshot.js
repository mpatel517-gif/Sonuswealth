// src/engine/financial-snapshot.js
// ─────────────────────────────────────────────────────────────────────────────
// A point-in-time snapshot of someone's financial position — the unit the
// net-worth history stores, and the basis every piece of guidance is stamped
// against. Pure & serializable; imports only netWorth (no solver → no cycle).
//
// WHY this exists (founder, 2026-06-03): a route/recommendation is a pure
// function of the wealth snapshot. If the wealth changes, the route can change.
// So guidance MUST carry the AS-OF date of the data it used, and net worth must
// be stored by date — so any past guidance is reproducible against what was
// known THEN, not today (Consumer Duty / auditability).
// ─────────────────────────────────────────────────────────────────────────────

import { netWorth } from './fq-calculator.js'

// Build a serializable snapshot of an entity's position.
// opts.asOf overrides the data date (else entity.dataLastUpdated).
export function financialSnapshot(entity = {}, opts = {}) {
  const a = entity.assets || {}
  const asOf = opts.asOf || entity.dataLastUpdated || entity.dataAsOf || null
  const nw = netWorth(entity) || 0
  const pots = {
    pension: +a.sipp?.total || (Array.isArray(a.sipp?.pensions) ? a.sipp.pensions.reduce((s, p) => s + (+p.value || 0), 0) : 0),
    isa: +(a.isa?.value ?? a.isa?.total ?? 0),
    gia: +(a.portfolio?.value ?? a.gia?.value ?? a.investments?.value ?? 0),
    cash: +(a.cash?.total ?? a.cash?.own ?? a.cash?.value ?? 0),
    property: (+a.residence?.value || 0) + (Array.isArray(a.property) ? a.property.reduce((s, p) => s + (+(p.value ?? p.value_gbp) || 0), 0) : 0),
  }
  return {
    schemaVersion: 1,
    personId: entity.id || entity.personId || null,
    asOf,                                   // date the DATA reflects (point-in-time)
    capturedAt: opts.capturedAt || null,    // when the snapshot was recorded (set by the store)
    netWorth: Math.round(nw),
    pots: Object.fromEntries(Object.entries(pots).map(([k, v]) => [k, Math.round(v)])),
    rulesVersion: entity.rulesVersion || null,
  }
}

// Stable hash over the position-defining fields — lets the store skip writing a
// duplicate snapshot and lets guidance detect "the data changed, re-run me".
export function snapshotHash(snap = {}) {
  const key = JSON.stringify({ personId: snap.personId, asOf: snap.asOf, netWorth: snap.netWorth, pots: snap.pots, rulesVersion: snap.rulesVersion })
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// Stamp a guidance result with the data date it was computed from. Every solver
// output passes through this so "based on info as at <date>" is never lost.
export function stampGuidance(result, entity, opts = {}) {
  const snap = financialSnapshot(entity, { asOf: opts.asOf || entity?.dataLastUpdated })
  return {
    ...result,
    asOf: snap.asOf,                                  // the data this guidance used
    generatedAt: opts.now ? new Date(opts.now).toISOString() : null,
    snapshot: snap,
    snapshotHash: snapshotHash(snap),
    provenance: `This guidance was computed from your financial position as at ${snap.asOf || 'an unknown date'}. If your wealth changes, re-run it — the recommended route can change with it.`,
  }
}
