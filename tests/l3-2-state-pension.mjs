// tests/l3-2-state-pension.mjs
//
// L3-2 Tier-A #3 contract test: StatePensionPanel data layer.
// Run via `npm run test:l3-2-state`.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildStatePensionSnapshot } from '../src/components/MyMoney/L3/L3Sections/StatePensionPanel.data.js'
import { statePensionAnnual } from '../src/engine/_helpers.js'
import { TAX, getBundle } from '../src/engine/_bundle.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

// Trigger bundle init so TAX has values before assertions run.
getBundle()

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}
const round = (n) => Math.round(n)

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — snapshot shape covers all required fields ────────────────────
console.log('\n── Case 1 — output shape ──')
{
  const e = await loadPersona('mrT-core.json')
  const s = buildStatePensionSnapshot(e)
  const required = ['entitlementNow', 'fullEntitlement', 'gapToFull',
    'qualifyingYearsNeeded', 'accruedYears', 'missingYears',
    'yearsToSpa', 'spa', 'onTrackForFull', 'gapFillableBySpa',
    'pensionFraction']
  for (const k of required) {
    log(s[k] !== undefined, `field '${k}' present (got ${JSON.stringify(s[k])})`)
  }
}

// ── Case 2 — entitlementNow === statePensionAnnual(entity) ────────────────
console.log('\n── Case 2 — entitlementNow reconciles with engine ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-f.json', 'mrT-aged-out.json']) {
    const e = await loadPersona(file)
    const s = buildStatePensionSnapshot(e)
    const engine = statePensionAnnual(e)
    log(Math.abs(s.entitlementNow - engine) < 0.5,
      `${file} → snap=£${round(s.entitlementNow).toLocaleString()} engine=£${round(engine).toLocaleString()}`)
  }
}

// ── Case 3 — fullEntitlement / qualifyingYearsNeeded / spa from bundle ────
console.log('\n── Case 3 — bundle-sourced thresholds (no hardcode) ──')
{
  const e = await loadPersona('mrT-core.json')
  const s = buildStatePensionSnapshot(e)
  log(s.fullEntitlement === TAX.statePensionFull,
    `fullEntitlement === TAX.statePensionFull (£${s.fullEntitlement.toLocaleString()})`)
  log(s.qualifyingYearsNeeded === TAX.statePensionQualYears,
    `qualifyingYearsNeeded === TAX.statePensionQualYears (${s.qualifyingYearsNeeded})`)
  log(s.spa === TAX.spa,
    `spa === TAX.spa (${s.spa})`)
}

// ── Case 4 — onTrackForFull when accrued + yearsToSpa >= needed ───────────
console.log('\n── Case 4 — on-track logic ──')
{
  const onTrack = buildStatePensionSnapshot({
    age: 40,
    individual: { state_pension_accrued_years: 20 }, // 20 + 26 to SPA(66) = 46 ≥ 35
  })
  const offTrack = buildStatePensionSnapshot({
    age: 60,
    individual: { state_pension_accrued_years: 10 }, // 10 + 6 to SPA(66) = 16 < 35
  })
  log(onTrack.onTrackForFull === true, `onTrack persona → onTrackForFull=true`)
  log(offTrack.onTrackForFull === false, `offTrack persona → onTrackForFull=false`)
}

// ── Case 5 — gapToFull = fullEntitlement - entitlementNow when partial ────
console.log('\n── Case 5 — gapToFull arithmetic ──')
{
  const partial = buildStatePensionSnapshot({
    age: 50,
    individual: { state_pension_accrued_years: 17 }, // ~50% of 35 → ~£5,751
  })
  const expectedGap = partial.fullEntitlement - partial.entitlementNow
  log(Math.abs(partial.gapToFull - expectedGap) < 1,
    `gapToFull=${round(partial.gapToFull)} === full-now=${round(expectedGap)}`)
}

// ── Case 6 — missingYears never negative ───────────────────────────────────
console.log('\n── Case 6 — missingYears never negative ──')
{
  const overfull = buildStatePensionSnapshot({
    age: 60,
    individual: { state_pension_accrued_years: 50 }, // exceeds 35
  })
  log(overfull.missingYears === 0, `over-accrued persona → missingYears=0`)
}

// ── Case 7 — yearsToSpa never negative (past SPA = 0) ──────────────────────
console.log('\n── Case 7 — past-SPA yearsToSpa=0 ──')
{
  const past = buildStatePensionSnapshot({ age: 75 })
  log(past.yearsToSpa === 0, `age 75 → yearsToSpa=0`)
}

// ── Case 8 — pensionFraction in [0, 1] ─────────────────────────────────────
console.log('\n── Case 8 — pensionFraction bounded [0, 1] ──')
{
  for (const accrued of [0, 17, 35, 50]) {
    const s = buildStatePensionSnapshot({
      age: 50,
      individual: { state_pension_accrued_years: accrued },
    })
    const ok = s.pensionFraction >= 0 && s.pensionFraction <= 1
    log(ok, `accrued=${accrued} → fraction=${s.pensionFraction.toFixed(2)}`)
  }
}

// ── Case 9 — empty entity → safe defaults, not crash ──────────────────────
// Empty entity = age 0, so yearsToSpa = spa (66) which is >> 35 needed years.
// onTrackForFull therefore evaluates true mathematically — not a bug, just a
// neutral starting point when no NI record exists yet.
console.log('\n── Case 9 — empty entity → safe defaults ──')
{
  const s = buildStatePensionSnapshot({})
  log(s.entitlementNow === 0, `entitlementNow=0`)
  log(s.accruedYears === 0,   `accruedYears=0`)
  log(s.onTrackForFull === true,
    `onTrackForFull=true (age 0 has full lifetime to accrue — correct neutral default)`)
  log(Number.isFinite(s.gapToFull), `gapToFull=${s.gapToFull} (finite)`)
}

// ── Case 10 — gapFillableBySpa = min(missing, yearsToSpa) ──────────────────
console.log('\n── Case 10 — gapFillableBySpa = min(missing, yearsToSpa) ──')
{
  const limitedByTime = buildStatePensionSnapshot({
    age: 60,
    individual: { state_pension_accrued_years: 10 }, // missing 25, only 6 years left
  })
  log(limitedByTime.gapFillableBySpa === 6,
    `time-limited persona → fillable=6 (got ${limitedByTime.gapFillableBySpa})`)

  const limitedByGap = buildStatePensionSnapshot({
    age: 40,
    individual: { state_pension_accrued_years: 30 }, // missing 5, 26 years left
  })
  log(limitedByGap.gapFillableBySpa === 5,
    `gap-limited persona → fillable=5 (got ${limitedByGap.gapFillableBySpa})`)
}

// ── Summary ───────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3-2 State-pension panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
