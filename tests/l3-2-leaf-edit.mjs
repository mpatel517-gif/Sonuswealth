// tests/l3-2-leaf-edit.mjs
//
// L3-2 leaf-edit contract test. Two guarantees:
//   1. resolveExistingId — an edit to a name-keyed (id-less) fixture item
//      UPDATES in place, never inserts a duplicate (the capture-flow bug).
//   2. applyFieldCorrection — path-based surgical edit sets exactly one field,
//      leaves siblings untouched, writes provenance + audit trail, defaults
//      confidence by source, and no-ops on a broken path.
//
// Run via `npm run test:l3-2-edit`.

import {
  resolveExistingId,
  applyFieldCorrection,
  _parsePath,
  _getByPath,
  _setByPath,
  _slug,
} from '../src/state/events-fold-helpers.js'

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

// ── Case 1 — _parsePath handles dot + bracket ──────────────────────────────
console.log('\n── Case 1 — _parsePath ──')
{
  const segs = _parsePath('assets.sipp.pensions[0].value')
  log(JSON.stringify(segs) === JSON.stringify(['assets', 'sipp', 'pensions', 0, 'value']),
    `parsed → ${JSON.stringify(segs)}`)
  const segs2 = _parsePath('assets.property[2].rentalGrossAnnual')
  log(segs2[2] === 2 && segs2[3] === 'rentalGrossAnnual', `bracket index → ${JSON.stringify(segs2)}`)
}

// ── Case 2 — _getByPath / _setByPath round-trip ────────────────────────────
console.log('\n── Case 2 — get/set by path ──')
{
  const o = { assets: { sipp: { pensions: [{ name: 'Vanguard', value: 420000 }] } } }
  log(_getByPath(o, 'assets.sipp.pensions[0].value') === 420000, 'get nested value')
  const r = _setByPath(o, 'assets.sipp.pensions[0].value', 445000)
  log(r.ok === true, 'set returns ok')
  log(o.assets.sipp.pensions[0].value === 445000, 'value updated in place')
  log(r.parent === o.assets.sipp.pensions[0], 'parent is the containing object')
}

// ── Case 3 — _setByPath broken path no-ops ─────────────────────────────────
console.log('\n── Case 3 — broken path no-op ──')
{
  const o = { assets: {} }
  const r = _setByPath(o, 'assets.sipp.pensions[0].value', 1)
  log(r.ok === false, 'broken path returns ok=false')
  log(o.assets.sipp === undefined, 'no shape fabricated')
}

// ── Case 4 — resolveExistingId matches name-keyed pension, stamps id ───────
console.log('\n── Case 4 — resolveExistingId on id-less fixture item ──')
{
  const e = { assets: { sipp: { pensions: [
    { name: 'Vanguard SIPP', value: 420000 },
    { name: 'Hargreaves Lansdown SIPP', value: 280000 },
  ] } } }
  const id = resolveExistingId(e, 'pensions', 'SIPP', 'Vanguard SIPP')
  log(id != null, `resolved id (${id})`)
  log(e.assets.sipp.pensions[0].id === id, 'matched item stamped with the id')
  // Deterministic — re-resolve returns same id
  const id2 = resolveExistingId(e, 'pensions', 'SIPP', 'Vanguard SIPP')
  log(id === id2, 'deterministic across re-resolve')
  // No match → null
  log(resolveExistingId(e, 'pensions', 'SIPP', 'Nonexistent') === null, 'no match → null')
}

// ── Case 5 — applyFieldCorrection updates field + siblings intact ──────────
console.log('\n── Case 5 — field correction surgical ──')
{
  const e = { assets: { sipp: { pensions: [
    { name: 'Vanguard SIPP', value: 420000, provider: 'Vanguard', charge: 0.0015 },
  ] } } }
  const ok = applyFieldCorrection(e, {
    path: 'assets.sipp.pensions[0].value',
    value: 445000,
    source: 'statement',
    label: 'Vanguard SIPP value',
  })
  log(ok === true, 'correction applied')
  log(e.assets.sipp.pensions[0].value === 445000, 'value updated to 445000')
  log(e.assets.sipp.pensions[0].name === 'Vanguard SIPP', 'sibling name intact')
  log(e.assets.sipp.pensions[0].provider === 'Vanguard', 'sibling provider intact')
  log(e.assets.sipp.pensions[0].charge === 0.0015, 'sibling charge intact')
}

// ── Case 6 — provenance attached + confidence by source ────────────────────
console.log('\n── Case 6 — provenance + confidence defaulting ──')
{
  const mk = (source) => {
    const e = { assets: { sipp: { pensions: [{ name: 'X', value: 1 }] } } }
    applyFieldCorrection(e, { path: 'assets.sipp.pensions[0].value', value: 2, source })
    return e.assets.sipp.pensions[0].provenance
  }
  log(mk('manual').confidence === 1.0,     `manual → confidence 1.0`)
  log(mk('statement').confidence === 0.95, `statement → confidence 0.95`)
  log(mk('estimate').confidence === 0.6,   `estimate → confidence 0.6`)
  const prov = mk('manual')
  log(prov.source === 'manual', 'provenance.source recorded')
  log(typeof prov.corrected_at === 'string', 'provenance.corrected_at stamped')
}

// ── Case 7 — explicit confidence overrides source default ──────────────────
console.log('\n── Case 7 — explicit confidence wins ──')
{
  const e = { assets: { sipp: { pensions: [{ name: 'X', value: 1 }] } } }
  applyFieldCorrection(e, { path: 'assets.sipp.pensions[0].value', value: 2, source: 'estimate', confidence: 0.8 })
  log(e.assets.sipp.pensions[0].provenance.confidence === 0.8, 'explicit 0.8 overrides estimate default 0.6')
}

// ── Case 8 — audit trail _corrections[] ────────────────────────────────────
console.log('\n── Case 8 — _corrections audit trail ──')
{
  const e = { assets: { sipp: { pensions: [{ name: 'X', value: 420000 }] } } }
  applyFieldCorrection(e, { path: 'assets.sipp.pensions[0].value', value: 445000, source: 'statement', label: 'Vanguard value' })
  log(Array.isArray(e._corrections) && e._corrections.length === 1, 'one correction logged')
  const c = e._corrections[0]
  log(c.previousValue === 420000, `previousValue captured (${c.previousValue})`)
  log(c.value === 445000, `new value captured (${c.value})`)
  log(c.label === 'Vanguard value', 'label recorded')
  log(c.source === 'statement', 'source recorded')
  // second correction appends
  applyFieldCorrection(e, { path: 'assets.sipp.pensions[0].value', value: 450000, source: 'manual' })
  log(e._corrections.length === 2, 'second correction appends')
}

// ── Case 9 — broken-path correction no-ops cleanly ─────────────────────────
console.log('\n── Case 9 — correction broken path ──')
{
  const e = { assets: {} }
  const ok = applyFieldCorrection(e, { path: 'assets.sipp.pensions[0].value', value: 1, source: 'manual' })
  log(ok === false, 'returns false on broken path')
  log(!Array.isArray(e._corrections) || e._corrections.length === 0, 'no audit entry on no-op')
}

// ── Case 10 — _slug deterministic + safe ───────────────────────────────────
console.log('\n── Case 10 — _slug ──')
{
  log(_slug('Vanguard SIPP') === 'vanguard-sipp', `'Vanguard SIPP' → ${_slug('Vanguard SIPP')}`)
  log(_slug('14 Bermondsey Street, London SE1 3PF').startsWith('14-bermondsey'), 'address slugged')
  log(_slug('') === 'item', 'empty → item fallback')
  log(_slug('Vanguard SIPP') === _slug('Vanguard SIPP'), 'deterministic')
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 leaf-edit — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
