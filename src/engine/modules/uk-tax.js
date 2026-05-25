// ─────────────────────────────────────────────────────────────────────────────
// uk-tax.js — re-export pass-through to uk-tax-2026-1-1.js
//
// History: this file was a near-byte-identical 1389-line duplicate of
// uk-tax-2026-1-1.js. Zero importers in src/. Consolidated 2026-05-25 so any
// future caller still resolves but there's one source of truth.
//
// If you need the canonical 2026/27 calculators, import them directly from
// uk-tax-2026-1-1.js. This file exists only to absorb stale references.
// ─────────────────────────────────────────────────────────────────────────────

export * from './uk-tax-2026-1-1.js';
