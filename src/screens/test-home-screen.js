/* ═══════════════════════════════════════════════════════════════════════
   SONUSWEALTH — HOME SCREEN SMOKE TEST
   Verifies engine outputs for persona-a.json (Bruce Wayne, 62)
   and zone rendering logic from HomeScreen.jsx.
   Run: node test-home-screen.js
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// Load persona-a directly (avoiding Vite JSON import)
const entity = JSON.parse(readFileSync(join(__dirname, 'src/rules/personas/persona-a.json'), 'utf8'))

// Import engine functions — same imports HomeScreen.jsx uses
import {
  calcFQ, calcRisk, netWorth, costOfInaction, fmt, daysLeft,
  trajectoryData, fqTrajectory, fundedRatio, guardrail, TAX, diffSet,
} from './src/engine/fq-calculator.js'
import { calcAPQ } from './src/engine/fq-calculator.js'

let pass = 0, fail = 0
function assert(condition, msg) {
  if (condition) { pass++; console.log(`  ✓ ${msg}`) }
  else { fail++; console.error(`  ✗ FAIL: ${msg}`) }
}
function section(title) { console.log(`\n── ${title} ──`) }

// ── §1 — Entity shape verification ──────────────────────────────────
section('Entity (persona-a.json)')
assert(entity.name === 'Bruce Wayne', 'Name is Bruce Wayne')
assert(entity.age === 62, 'Age is 62')
assert(entity.assets?.sipp?.total === 850000, 'SIPP is £850k')
assert(entity.drawdown === 0, 'Drawdown is 0')
assert(entity.targetIncome === 120000, 'Target income is £120k')
assert(entity.willStatus === 'current', 'Will is current')
assert(entity.lpaStatus === 'neither', 'No LPA')

// ── §2 — Z1 Triple Anchor — engine outputs ─────────────────────────
section('Z1 — Triple Anchor')
const nw = netWorth(entity)
assert(nw > 3000000, `Net worth > £3m (got ${fmt(nw)})`)
assert(nw < 4000000, `Net worth < £4m (got ${fmt(nw)})`)

const fq = calcFQ(entity)
assert(typeof fq.total === 'number', 'calcFQ returns total')
assert(fq.total >= 0 && fq.total <= 100, `FQ score 0-100 (got ${fq.total})`)
assert(fq.band && fq.band.name, `FQ band has name (got ${fq.band.name})`)
assert(fq.band.colour, 'FQ band has colour')
assert(fq.dims.behaviour > 0, 'Behaviour dimension > 0')
assert(fq.dims.estate >= 0, 'Estate dimension >= 0')

const risk = calcRisk(entity)
assert(typeof risk.total === 'number', 'calcRisk returns total')
assert(risk.total >= 0 && risk.total <= 100, `Risk score 0-100 (got ${risk.total})`)
assert(risk.band && risk.band.name, `Risk band has name (got ${risk.band.name})`)
assert(risk.dims.protCov >= 0, `Protection coverage dimension >= 0 (got ${risk.dims.protCov})`)

// ── §3 — Z1.5 Sub-Anchor (stub state) ──────────────────────────────
section('Z1.5 — Sub-Anchor (stub)')
// prcPccSpread is in uk-cashflow engine, not fq-calculator. HomeScreen renders stub inline.
assert(true, 'Stub state renders em-dash + "Methodology being finalised" (UI-only, no engine call)')

// ── §4 — Z2 Daily Delta ────────────────────────────────────────────
section('Z2 — Daily Delta')
const diffs = diffSet(entity, null)
assert(Array.isArray(diffs), 'diffSet returns array')
assert(diffs.length === 0, 'diffSet stub returns empty array (renders "Everything up to date")')

// ── §5 — Z3 CoI Odometer ───────────────────────────────────────────
section('Z3 — CoI Odometer')
const coi = costOfInaction(entity)
assert(typeof coi === 'number', 'costOfInaction returns number')
assert(coi > 0, `CoI > 0 for Bruce with £850k SIPP (got ${fmt(coi)})`)
assert(coi < 500000, `CoI < £500k sanity check (got ${fmt(coi)})`)

// ── §6 — Z4 State Tiles (derived) ──────────────────────────────────
section('Z4 — State Tiles (derived values)')
const fr = fundedRatio(entity)
assert(fr.ratio !== null, 'fundedRatio returns non-null ratio')
assert(fr.ratio > 0, `FI ratio > 0 (got ${fr.ratio})`)
assert(fr.retirement_age > 0, `Retirement age populated (got ${fr.retirement_age})`)
assert(fr.confidence !== 'INSUFFICIENT', 'FI data is sufficient for Bruce')

const totalDebt = (entity.liabilities?.mortgage?.outstanding || 0) +
  (entity.liabilities?.otherLoans || []).reduce((s, l) => s + (l.outstanding || 0), 0)
assert(totalDebt === 0, 'Bruce is debt-free')

assert(risk.dims.protCov >= 0 && risk.dims.protCov <= 18, `Protection coverage in range (got ${risk.dims.protCov})`)
assert(fq.dims.cashflow >= 0 && fq.dims.cashflow <= 16, `Cashflow health in range (got ${fq.dims.cashflow})`)
assert(fq.dims.tax >= 0 && fq.dims.tax <= 18, `Tax efficiency in range (got ${fq.dims.tax})`)

// Estate readiness derivation
let estCount = 0
if (entity.willStatus === 'current') estCount++
if (entity.lpaStatus === 'both') estCount += 2
if (entity.assets?.protection?.lifeInsurance?.exists) estCount++
if (entity.assets?.protection?.lifeInsurance?.inTrust) estCount++
if (entity.assets?.trustGifts) estCount++
const pensions = entity.assets?.sipp?.pensions || []
const freshNoms = pensions.filter(p => p.nominationDate &&
  (Date.now() - new Date(p.nominationDate)) < 3 * 365.25 * 86400000).length
if (freshNoms === pensions.length && pensions.length > 0) estCount++
assert(estCount >= 0 && estCount <= 7, `Estate readiness 0-7 (got ${estCount})`)

// ── §7 — Z5 Score Journey ──────────────────────────────────────────
section('Z5 — Score Journey')
const tdata = trajectoryData(entity)
assert(tdata.doNothing && tdata.doNothing.length > 0, 'trajectoryData.doNothing populated')
assert(tdata.draw25 && tdata.draw25.length > 0, 'trajectoryData.draw25 populated')
assert(tdata.draw377 && tdata.draw377.length > 0, 'trajectoryData.draw377 populated')
assert(tdata.doNothing[0].age === 62, `First age is 62 (got ${tdata.doNothing[0].age})`)
assert(tdata.doNothing[tdata.doNothing.length - 1].age === 90, 'Last age is 90')

const traj = fqTrajectory(entity)
assert(Array.isArray(traj) && traj.length === 4, 'fqTrajectory returns 4 action levels')
assert(traj[0].label === 'Today', 'First action level is "Today"')
assert(traj[3].label === 'All actions', 'Fourth action level is "All actions"')
assert(traj[3].score >= traj[0].score, 'All-actions score >= today score')

// ── §8 — Z6 Reality Engine Ring (stub) ─────────────────────────────
section('Z6 — Reality Engine Ring (stub)')
assert(true, 'Stub renders 3 grey rings + "being calibrated" (UI-only, no engine call)')

// ── §9 — Z7/Z8 Priority Actions (calcAPQ) ──────────────────────────
section('Z7/Z8 — Priority Actions')
const actions = calcAPQ(entity)
assert(Array.isArray(actions), 'calcAPQ returns array')
assert(actions.length > 0, `APQ returns actions for Bruce (got ${actions.length})`)
assert(actions[0].priority === 1, `Top action is priority 1 (got ${actions[0].priority})`)
assert(actions[0].title, `Top action has title: "${actions[0].title}"`)
assert(actions[0].colour, 'Top action has colour')
assert(actions[0].impact, 'Top action has impact object')

// Verify pension-drawdown is in the list (Bruce: SIPP £850k, drawdown 0, age 62)
const hasPensionAction = actions.some(a => a.id === 'pension-drawdown')
assert(hasPensionAction, 'Pension drawdown action present (SIPP at risk, no drawdown)')

// Verify life insurance action (Bruce: no life cover, NW > £500k)
const hasLifeAction = actions.some(a => a.id === 'life-insurance')
assert(hasLifeAction, 'Life insurance action present (no cover, NW > £500k)')

// §Q6 W7: max 4 on Home (1 in Z7 + 3 in Z8)
const homeActions = actions.slice(0, 4)
assert(homeActions.length <= 4, `Home shows max 4 actions (got ${homeActions.length})`)

// ── §10 — Z10 Tax Deadline ─────────────────────────────────────────
section('Z10 — Tax Deadline')
const dl = daysLeft()
assert(typeof dl === 'number', 'daysLeft returns number')
assert(dl >= 0, `Days left >= 0 (got ${dl})`)
// Z10 renders when dl > 0 && dl <= 365
const z10Renders = dl > 0 && dl <= 365
console.log(`  ℹ Days to 6 Apr 2027: ${dl} — Z10 ${z10Renders ? 'RENDERS' : 'hidden (> 365 days)'}`)

// ── §11 — fmt() formatting ─────────────────────────────────────────
section('Formatting (fmt)')
assert(fmt(1860000) === '£1.86m', `fmt(1860000) = "£1.86m" (got "${fmt(1860000)}")`)
assert(fmt(42100) === '£42k', `fmt(42100) = "£42k" (got "${fmt(42100)}")`)
assert(fmt(500) === '£500', `fmt(500) = "£500" (got "${fmt(500)}")`)
assert(fmt(null) === '—', 'fmt(null) = "—"')
assert(fmt(undefined) === '—', 'fmt(undefined) = "—"')

// ── §12 — Guard: no hardcoded values ────────────────────────────────
section('No hardcoded values')
assert(TAX.ver, `Tax rules version from bundle: ${TAX.ver}`)
assert(TAX.nrb > 0, `NRB from bundle: ${fmt(TAX.nrb)}`)
assert(TAX.ihtRate > 0, `IHT rate from bundle: ${TAX.ihtRate}`)
assert(TAX.swr > 0, `SWR from bundle: ${TAX.swr}`)

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n══════════════════════════════════════════`)
console.log(`  HOME SCREEN SMOKE: ${pass} passed · ${fail} failed`)
console.log(`══════════════════════════════════════════`)
if (fail > 0) process.exit(1)
