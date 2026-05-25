// L3Panel.smoke.test.mjs — verify L3 primitive scaffolds are structurally sound.
//
// Constraint: the repo has no JSX transformer (no esbuild-register, no babel,
// no vitest). Node ESM cannot import .jsx directly. So we verify the contract
// by static source inspection — each file exports the expected symbol, and
// the barrel re-exports them all.
//
// Visual / behavioural tests land in Wave 1 once a JSX-capable harness exists.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const L3 = resolve(ROOT, 'src/components/MyMoney/L3')

let passed = 0, failed = 0
const fails = []
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); return }
  failed++; fails.push(msg)
  console.error(`  ✗ ${msg}`)
}

console.log('═══ L3Panel scaffold smoke test ═══\n')

// 1. files exist
const files = {
  panel:       resolve(L3, 'L3Panel.jsx'),
  hero:        resolve(L3, 'L3Sections/HeroSection.jsx'),
  tax:         resolve(L3, 'L3Sections/TaxTreatmentSection.jsx'),
  estate:      resolve(L3, 'L3Sections/EstatePositionSection.jsx'),
  confidence:  resolve(L3, 'L3Sections/DataConfidenceSection.jsx'),
  barrel:      resolve(L3, 'index.js'),
}
for (const [k, p] of Object.entries(files)) {
  assert(existsSync(p), `file exists: ${k} (${p.replace(ROOT, '')})`)
}

// 2. each section file exports its named component
const panelSrc = readFileSync(files.panel, 'utf8')
assert(/export\s+function\s+L3Panel\s*\(/.test(panelSrc), 'L3Panel.jsx exports function L3Panel')
assert(/middle\s*=\s*\[\s*\]/.test(panelSrc),              'L3Panel defaults middle to []')
assert(/middle\.map/.test(panelSrc),                       'L3Panel iterates middle slot array')
assert(/section\.render\(\s*\{\s*entity\s*,\s*ripple\s*\}\s*\)/.test(panelSrc),
       'L3Panel passes {entity, ripple} into each middle.render()')
assert(/data-domain=\{domainKey\}/.test(panelSrc),         'L3Panel exposes data-domain attr for testing')

const heroSrc = readFileSync(files.hero, 'utf8')
assert(/export\s+function\s+HeroSection\s*\(/.test(heroSrc), 'HeroSection exported')

const taxSrc = readFileSync(files.tax, 'utf8')
assert(/export\s+function\s+TaxTreatmentSection\s*\(/.test(taxSrc), 'TaxTreatmentSection exported')
assert(/incomeTax/.test(taxSrc) && /capitalGains/.test(taxSrc) && /inheritance/.test(taxSrc),
       'TaxTreatmentSection accepts incomeTax/capitalGains/inheritance')

const estateSrc = readFileSync(files.estate, 'utf8')
assert(/export\s+function\s+EstatePositionSection\s*\(/.test(estateSrc), 'EstatePositionSection exported')

const confSrc = readFileSync(files.confidence, 'utf8')
assert(/export\s+function\s+DataConfidenceSection\s*\(/.test(confSrc), 'DataConfidenceSection exported')

// 3. barrel re-exports all five
const barrelSrc = readFileSync(files.barrel, 'utf8')
for (const sym of ['L3Panel', 'HeroSection', 'TaxTreatmentSection', 'EstatePositionSection', 'DataConfidenceSection']) {
  assert(new RegExp(`export\\s*\\{\\s*${sym}\\s*\\}`).test(barrelSrc), `barrel re-exports ${sym}`)
}

console.log(`\n═══ ${passed} pass · ${failed} fail ═══`)
if (failed > 0) {
  console.error('\nFailures:'); for (const f of fails) console.error('  -', f)
  process.exit(1)
}
process.exit(0)
