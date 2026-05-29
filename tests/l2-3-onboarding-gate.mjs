// ─────────────────────────────────────────────────────────────────────────────
// L2-3 — Onboarding validateEntity gate test
//
// Verifies that the Onboarding → Account → Dashboard handoff is guarded by
// validateEntity. The actual UI integration lives in App.jsx (handleAccountEnter),
// which calls validateEntity(builtPersona) and either passes or surfaces errors.
//
// This test exercises the engine-layer contract directly by calling
// validateEntity with each of the failure shapes the gate must catch:
//
//   1. Missing name           — hard error
//   2. Missing age + dob      — hard error
//   3. Future taxonomy version — hard error
//   4. Older taxonomy version  — soft warning, not blocking
//   5. Unknown employment key  — soft warning, not blocking
//   6. Well-formed entity      — passes ok=true
//
// Run: node tests/l2-3-onboarding-gate.mjs
// Exits non-zero on any case failing its expectation.
// ─────────────────────────────────────────────────────────────────────────────

import { validateEntity } from '../src/engine/persona-normalizer.js'

const TAXONOMY_VERSION_FROM_TAXONOMY = '1.0.0' // matches src/engine/taxonomy.js TAXONOMY_VERSION

let fails = 0
function check(label, cond, detail) {
  if (cond) {
    console.log(`✓ ${label}`)
  } else {
    console.log(`✗ ${label} — ${detail || ''}`)
    fails++
  }
}

// ── Case 1 — Missing name (hard error) ──────────────────────────────────────
{
  const e = { age: 35, individual: {} } // no name at any of the resolvable paths
  const r = validateEntity(e)
  check(
    'Case 1 — missing name is rejected',
    r.ok === false && r.errors.some(s => /name/i.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 2 — Missing age + dob (hard error) ────────────────────────────────
{
  const e = { name: 'Test User' } // no age, no dob anywhere
  const r = validateEntity(e)
  check(
    'Case 2 — missing age+dob is rejected',
    r.ok === false && r.errors.some(s => /age-or-dob/i.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 3 — Future taxonomy version (hard error) ──────────────────────────
{
  const e = { name: 'Test User', age: 35, taxonomy_version: '99.0.0' }
  const r = validateEntity(e)
  check(
    'Case 3 — forward-incompat taxonomy version is rejected',
    r.ok === false && r.errors.some(s => /taxonomy_version/i.test(s)),
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 4 — Older taxonomy version (soft warning) ─────────────────────────
{
  const e = { name: 'Test User', age: 35, taxonomy_version: '0.0.1' }
  const r = validateEntity(e)
  check(
    'Case 4 — older taxonomy version warns but is allowed',
    r.ok === true && r.warnings.some(s => /taxonomy_version/i.test(s)),
    `ok=${r.ok} warnings=${JSON.stringify(r.warnings)}`
  )
}

// ── Case 5 — Unknown employment key (soft warning) ─────────────────────────
{
  const e = {
    name: 'Test User',
    age: 35,
    individual: { employment_type: 'paje-employed' }, // typo, should warn
  }
  const r = validateEntity(e)
  check(
    'Case 5 — unknown employment key warns but is allowed',
    r.ok === true && r.warnings.some(s => /employment/i.test(s)),
    `ok=${r.ok} warnings=${JSON.stringify(r.warnings)}`
  )
}

// ── Case 6 — Well-formed entity passes ─────────────────────────────────────
{
  const e = {
    name: 'Test User',
    age: 35,
    individual: {
      gross_salary: 50000,
      employment_type: 'paye-employed',
    },
    income: { salary: 50000 },
    taxonomy_version: TAXONOMY_VERSION_FROM_TAXONOMY,
  }
  const r = validateEntity(e)
  check(
    'Case 6 — well-formed onboarding payload passes',
    r.ok === true && r.errors.length === 0,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

// ── Case 7 — App.jsx's buildUserPersona shape with realistic obData ────────
// Synthesise the structure that buildUserPersona produces from real onboarding
// answers, then check it passes. This is the closest-to-prod check we can run
// without mounting React.
{
  const buildLikePersona = {
    id: 'real-user',
    name: 'You',
    displayName: 'You · 38',
    age: 38,
    assets: {
      isa:        { value: 25000 },
      cash:       { value: 25000 },
      property:   { residential: [{ value: 400000 }] },
      sipp:       { total: 0, pensions: [] },
      protection: {},
    },
    income: { salary: 60000 },
    targetIncome: 60000,
    drawdown: 0,
    _obData: { age: 38, income: 60000 },
  }
  const r = validateEntity(buildLikePersona)
  check(
    'Case 7 — buildUserPersona-shaped entity passes',
    r.ok === true,
    `ok=${r.ok} errors=${JSON.stringify(r.errors)}`
  )
}

console.log(`\nL2-3 gate test — fails=${fails}`)
if (fails > 0) process.exit(1)
