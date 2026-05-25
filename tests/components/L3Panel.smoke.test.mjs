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

// 4. W0-T6 additions — DrillableNumber + L4NumberPanel
const drillableNumPath  = resolve(L3, 'DrillableNumber.jsx')
const l4NumberPanelPath = resolve(L3, 'L4NumberPanel.jsx')
assert(existsSync(drillableNumPath),  `file exists: DrillableNumber.jsx`)
assert(existsSync(l4NumberPanelPath), `file exists: L4NumberPanel.jsx`)

const drillableNumSrc  = readFileSync(drillableNumPath,  'utf8')
const l4NumberPanelSrc = readFileSync(l4NumberPanelPath, 'utf8')
const barrelSrcUpdated = readFileSync(files.barrel,      'utf8')

assert(/export\s+function\s+DrillableNumber\s*\(/.test(drillableNumSrc), 'DrillableNumber.jsx exports DrillableNumber function')
assert(drillableNumSrc.includes('onDrill'),                              'DrillableNumber wires onDrill callback')
assert(drillableNumSrc.includes('role="button"') || drillableNumSrc.includes("role='button'"),
       'DrillableNumber is keyboard-accessible (role=button)')
assert(drillableNumSrc.includes('tabIndex'),                             'DrillableNumber is keyboard-tabbable')
assert(drillableNumSrc.includes('borderBottom') && drillableNumSrc.includes('dotted'),
       'DrillableNumber renders dotted underline (PP-3 visual cue)')
assert(/onKeyDown/.test(drillableNumSrc) && /Enter/.test(drillableNumSrc) && /' '/.test(drillableNumSrc),
       'DrillableNumber handles Enter + Space keys')

assert(/export\s+function\s+L4NumberPanel\s*\(/.test(l4NumberPanelSrc), 'L4NumberPanel.jsx exports L4NumberPanel function')
assert(l4NumberPanelSrc.includes('HOW THIS IS CALCULATED'),    'L4NumberPanel section 2 is "How calculated"')
assert(l4NumberPanelSrc.includes('WHERE THE DATA CAME FROM'),  'L4NumberPanel section 3 is "Where data came from"')
assert(l4NumberPanelSrc.includes('VISUAL BREAKDOWN'),          'L4NumberPanel section 4 is "Visual breakdown"')
assert(l4NumberPanelSrc.includes('WHAT YOU CAN DO'),           'L4NumberPanel section 5 is "What you can do"')
assert(l4NumberPanelSrc.includes('WHAT IF THIS WERE DIFFERENT'),'L4NumberPanel section 6 is "What if different"')
assert(l4NumberPanelSrc.includes('data-metric'),               'L4NumberPanel exposes data-metric attr for testing')

assert(/export\s*\{\s*DrillableNumber\s*\}/.test(barrelSrcUpdated), 'barrel re-exports DrillableNumber')
assert(/export\s*\{\s*L4NumberPanel\s*\}/.test(barrelSrcUpdated),   'barrel re-exports L4NumberPanel')

// 5. W0-T7 additions — DrillableChart + L4ChartPanel
const drillableChartSrc = readFileSync(resolve(L3, 'DrillableChart.jsx'), 'utf8')
const l4ChartPanelSrc   = readFileSync(resolve(L3, 'L4ChartPanel.jsx'), 'utf8')
const barrelSrcT7       = readFileSync(resolve(L3, 'index.js'), 'utf8')

assert(drillableChartSrc.includes('export function DrillableChart'), 'DrillableChart.jsx exports DrillableChart function')
assert(drillableChartSrc.includes('onDrill'), 'DrillableChart wires onDrill callback')
assert(drillableChartSrc.includes("role=\"button\"") || drillableChartSrc.includes("role='button'"), 'DrillableChart is keyboard-accessible (role=button)')
assert(drillableChartSrc.includes('defaultWindow'), 'DrillableChart accepts defaultWindow prop')
assert(drillableChartSrc.includes('data-metric'), 'DrillableChart sets data-metric for testing')

assert(l4ChartPanelSrc.includes('export function L4ChartPanel'), 'L4ChartPanel.jsx exports L4ChartPanel function')
assert(l4ChartPanelSrc.includes("from '../../../engine/time-series.js'"), 'L4ChartPanel imports getTimeSeries from engine')
assert(l4ChartPanelSrc.includes('TIME_WINDOWS'), 'L4ChartPanel declares TIME_WINDOWS pill set')
assert(l4ChartPanelSrc.includes("'1M'") && l4ChartPanelSrc.includes("'10Y'"), 'L4ChartPanel covers 1M and 10Y windows')
assert(l4ChartPanelSrc.includes('COMPARISONS'), 'L4ChartPanel has comparison overlay control group')
assert(l4ChartPanelSrc.includes('CHART_TYPES'), 'L4ChartPanel has chart-type control group')
assert(l4ChartPanelSrc.includes('ANNOTATIONS'), 'L4ChartPanel has annotation toggle group')
assert(l4ChartPanelSrc.includes('series.gaps'), 'L4ChartPanel surfaces PP-7 gap markers')

assert(barrelSrcT7.includes('export { DrillableChart }'), 'barrel re-exports DrillableChart')
assert(barrelSrcT7.includes('export { L4ChartPanel }'), 'barrel re-exports L4ChartPanel')

console.log(`\n═══ ${passed} pass · ${failed} fail ═══`)
if (failed > 0) {
  console.error('\nFailures:'); for (const f of fails) console.error('  -', f)
  process.exit(1)
}
process.exit(0)
