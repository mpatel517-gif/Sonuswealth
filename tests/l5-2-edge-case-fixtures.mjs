// ─────────────────────────────────────────────────────────────────────────────
// L5-2 — Edge-case persona fixtures smoke test
//
// Loads the three new vulnerability fixtures and exercises derivedVulnerability
// against each, asserting the result lines up with the fixture's
// _test_expectations block. Catches regressions where:
//   - A future fixture refit drops an events[] entry
//   - The selector's substring matching changes and stops catching 'spouse_died'
//   - JSON typos in the fixture (failing parse)
//
// Run: node tests/l5-2-edge-case-fixtures.mjs
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { derivedVulnerability } from '../src/engine/selectors/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PERSONAS_DIR = path.resolve(__dirname, '../src/rules/personas')

const FIXTURES = [
  'mrT-bereavement.json',
  'mrT-mental-capacity.json',
  'mrT-child-dependent.json',
]

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

for (const file of FIXTURES) {
  const fpath = path.join(PERSONAS_DIR, file)
  let persona
  try {
    persona = JSON.parse(fs.readFileSync(fpath, 'utf8'))
  } catch (e) {
    check(`${file} — JSON parses`, false, e.message)
    continue
  }
  check(`${file} — JSON parses`, true)

  // Identity + age sanity
  check(
    `${file} — has name + age`,
    typeof persona.name === 'string' && typeof persona.age === 'number',
    `name=${persona.name} age=${persona.age}`
  )

  // Vulnerability selector exercise
  const vuln = derivedVulnerability(persona)
  const exp = persona._test_expectations || {}

  if (exp.derivedVulnerability_status) {
    check(
      `${file} — derivedVulnerability.status === ${exp.derivedVulnerability_status}`,
      vuln.status === exp.derivedVulnerability_status,
      `got=${vuln.status} reasons=${JSON.stringify(vuln.reasons)}`
    )
  }
  if (Array.isArray(exp.derivedVulnerability_status_oneof)) {
    check(
      `${file} — derivedVulnerability.status ∈ ${JSON.stringify(exp.derivedVulnerability_status_oneof)}`,
      exp.derivedVulnerability_status_oneof.includes(vuln.status),
      `got=${vuln.status} reasons=${JSON.stringify(vuln.reasons)}`
    )
  }
  if (exp.derivedVulnerability_reason_pattern) {
    const re = new RegExp(exp.derivedVulnerability_reason_pattern, 'i')
    check(
      `${file} — vulnerability reasons include /${exp.derivedVulnerability_reason_pattern}/i`,
      vuln.reasons.some(r => re.test(r)),
      `reasons=${JSON.stringify(vuln.reasons)}`
    )
  }
  if (exp.toneHint_not) {
    check(
      `${file} — toneHint !== ${exp.toneHint_not}`,
      vuln.toneHint !== exp.toneHint_not,
      `got=${vuln.toneHint}`
    )
  }
  if (Array.isArray(exp.toneHint_oneof)) {
    check(
      `${file} — toneHint ∈ ${JSON.stringify(exp.toneHint_oneof)}`,
      exp.toneHint_oneof.includes(vuln.toneHint),
      `got=${vuln.toneHint}`
    )
  }

  // mrT-child-dependent has dependents — verify the count
  if (exp.dependents_count != null) {
    const got = (persona.dependents || []).length
    check(
      `${file} — dependents.length === ${exp.dependents_count}`,
      got === exp.dependents_count,
      `got=${got}`
    )
  }
}

console.log(`\nL5-2 fixtures smoke test — fails=${fails}`)
if (fails > 0) process.exit(1)
