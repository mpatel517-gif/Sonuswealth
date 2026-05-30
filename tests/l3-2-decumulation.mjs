// tests/l3-2-decumulation.mjs
//
// L3 Decumulation panel data layer contract test.
// Run via: node tests/l3-2-decumulation.mjs
// Requires ≥12 assertions; exits non-zero on any failure.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildDecumulationSnapshot } from '../src/components/MyMoney/L3/L3Sections/DecumulationPanel.data.js'
import { getBundle } from '../src/engine/_bundle.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const personasDir = join(__dirname, '..', 'src', 'rules', 'personas')

// Trigger bundle init — TAX is mutated on getBundle() first call.
getBundle()

let fails = 0
let passes = 0
const log = (ok, msg) => {
  if (ok) { passes += 1; console.log(`✓ ${msg}`) }
  else    { fails  += 1; console.log(`✗ ${msg}`) }
}

async function loadPersona(file) {
  return JSON.parse(await readFile(join(personasDir, file), 'utf8'))
}

// ── Case 1 — snapshot shape: all required fields present ─────────────────────
console.log('\n── Case 1 — output shape (all required fields) ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDecumulationSnapshot(e)
  const required = [
    'fundedRatioPct', 'targetIncome', 'investableAssets',
    'sustainableIncome', 'swrLabel', 'swrRate',
    'runwayYears', 'onTrack', 'frConfidence', 'frInsufficient',
  ]
  for (const k of required) {
    log(s[k] !== undefined, `field '${k}' present (got ${JSON.stringify(s[k])})`)
  }
}

// ── Case 2 — all numeric fields are finite (no NaN / Infinity / undefined) ───
console.log('\n── Case 2 — numeric fields finite ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDecumulationSnapshot(e)
  for (const k of ['targetIncome', 'investableAssets', 'sustainableIncome', 'swrRate', 'runwayYears']) {
    log(Number.isFinite(s[k]), `${k}=${s[k]} is finite`)
  }
}

// ── Case 3 — onTrack is a boolean ────────────────────────────────────────────
console.log('\n── Case 3 — onTrack is boolean ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-d.json', 'persona-e.json']) {
    const e = await loadPersona(file)
    const s = buildDecumulationSnapshot(e)
    log(typeof s.onTrack === 'boolean', `${file} → onTrack is boolean (${s.onTrack})`)
  }
}

// ── Case 4 — targetIncome editable path is 'targetIncome' ────────────────────
console.log('\n── Case 4 — targetIncome editable.path === "targetIncome" ──')
{
  const { targetIncomePayload } = await import('../src/components/MyMoney/L3/L3Sections/DecumulationPayloads.js')
  const e = await loadPersona('persona-a.json')
  const s = buildDecumulationSnapshot(e)
  const p = targetIncomePayload(s)
  log(p.editable?.path === 'targetIncome', `editable.path === 'targetIncome' (got '${p.editable?.path}')`)
  log(typeof p.editable?.currentValue === 'number', `editable.currentValue is number (${p.editable?.currentValue})`)
  log(p.editable?.unit === '£', `editable.unit === '£' (got '${p.editable?.unit}')`)
}

// ── Case 5 — fundedRatioPct >= 0 when not INSUFFICIENT ───────────────────────
console.log('\n── Case 5 — fundedRatioPct >= 0 when not INSUFFICIENT ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-e.json']) {
    const e = await loadPersona(file)
    const s = buildDecumulationSnapshot(e)
    if (!s.frInsufficient && s.fundedRatioPct != null) {
      log(s.fundedRatioPct >= 0, `${file} → fundedRatioPct=${s.fundedRatioPct} >= 0`)
    } else {
      log(true, `${file} → INSUFFICIENT (no ratio to check; ok)`)
    }
  }
}

// ── Case 6 — sustainableIncome >= 0 ──────────────────────────────────────────
console.log('\n── Case 6 — sustainableIncome >= 0 ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-d.json', 'persona-e.json']) {
    const e = await loadPersona(file)
    const s = buildDecumulationSnapshot(e)
    log(s.sustainableIncome >= 0, `${file} → sustainableIncome=£${s.sustainableIncome.toLocaleString()} >= 0`)
  }
}

// ── Case 7 — wealthy persona (persona-c Tony Stark) → onTrack=true ───────────
console.log('\n── Case 7 — wealthy persona (persona-c) → onTrack true ──')
{
  // Tony Stark: investable ~£2.79M, targetIncome £95k, sustainable @4% = £111k > £95k
  const e = await loadPersona('persona-c.json')
  const s = buildDecumulationSnapshot(e)
  console.log(`  persona-c investable=£${s.investableAssets.toLocaleString()} targetIncome=£${s.targetIncome.toLocaleString()} sustainable=£${s.sustainableIncome.toLocaleString()} onTrack=${s.onTrack}`)
  log(s.onTrack === true, `persona-c (Tony Stark) → onTrack=true`)
}

// ── Case 8 — wealthy persona (persona-e Willy Wonka) → onTrack true ──────────
console.log('\n── Case 8 — wealthy persona (persona-e) → onTrack true ──')
{
  // Willy Wonka: investable ~£4.66M, targetIncome £80k, sustainable @4% = £186k > £80k
  const e = await loadPersona('persona-e.json')
  const s = buildDecumulationSnapshot(e)
  console.log(`  persona-e investable=£${s.investableAssets.toLocaleString()} targetIncome=£${s.targetIncome.toLocaleString()} sustainable=£${s.sustainableIncome.toLocaleString()} onTrack=${s.onTrack}`)
  log(s.onTrack === true, `persona-e (Willy Wonka) → onTrack=true`)
}

// ── Case 9 — persona-d (Hermione Granger, low assets) → does not crash, onTrack false ──
console.log('\n── Case 9 — persona-d (low assets) → no crash, onTrack false ──')
{
  // Hermione: investable ~£80k, no age/targetIncome set explicitly
  // targetIncome() fallback = 60% of £60k salary = £36k; sustainable @4% = £3.2k < £36k
  const e = await loadPersona('persona-d.json')
  let s, crashed = false
  try { s = buildDecumulationSnapshot(e) }
  catch (err) { crashed = true; console.log('  ERROR:', err.message) }
  log(!crashed, `persona-d → did not crash`)
  if (!crashed) {
    log(s.onTrack === false, `persona-d → onTrack=false (sustainable=£${s.sustainableIncome} vs target=£${s.targetIncome})`)
  }
}

// ── Case 10 — persona-a (Bruce Wayne decumulation) ───────────────────────────
console.log('\n── Case 10 — persona-a Bruce Wayne (decumulation persona) ──')
{
  const e = await loadPersona('persona-a.json')
  const s = buildDecumulationSnapshot(e)
  console.log(`  Bruce: investable=£${s.investableAssets.toLocaleString()} target=£${s.targetIncome.toLocaleString()} fundedRatioPct=${s.fundedRatioPct}% sustainable=£${s.sustainableIncome.toLocaleString()} onTrack=${s.onTrack} runwayYears=${s.runwayYears}`)
  log(s.investableAssets > 0, `Bruce investableAssets=£${s.investableAssets.toLocaleString()} > 0`)
  log(s.targetIncome > 0,     `Bruce targetIncome=£${s.targetIncome.toLocaleString()} > 0`)
  log(s.runwayYears > 0,      `Bruce runwayYears=${s.runwayYears} > 0`)
  // Bruce has £1.83M investable, target £120k → sustainable @4% = £73.2k < £120k → onTrack=false
  log(s.onTrack === false,    `Bruce onTrack=false (sustainable £73k < target £120k)`)
}

// ── Case 11 — empty entity → safe defaults, no crash ─────────────────────────
console.log('\n── Case 11 — empty entity → safe defaults ──')
{
  let s, crashed = false
  try { s = buildDecumulationSnapshot({}) }
  catch (err) { crashed = true; console.log('  ERROR:', err.message) }
  log(!crashed,                              `empty entity → no crash`)
  if (!crashed) {
    log(s.investableAssets === 0,            `empty entity → investableAssets=0`)
    log(typeof s.onTrack === 'boolean',      `empty entity → onTrack is boolean`)
    log(Number.isFinite(s.sustainableIncome), `empty entity → sustainableIncome finite`)
    log(Number.isFinite(s.runwayYears),       `empty entity → runwayYears finite`)
  }
}

// ── Case 12 — swrRate is a valid positive number ──────────────────────────────
console.log('\n── Case 12 — swrRate is positive for all personas ──')
{
  for (const file of ['persona-a.json', 'persona-c.json', 'persona-d.json', 'persona-e.json']) {
    const e = await loadPersona(file)
    const s = buildDecumulationSnapshot(e)
    log(s.swrRate > 0 && s.swrRate < 1, `${file} → swrRate=${s.swrRate} in (0, 1)`)
  }
}

// ── Case 13 — full CMA projection (real ≤ nominal) + toggle payload ───────
console.log('\n── Case 13 — CMA projection + today\'s-money toggle ──')
{
  const { projectedSavingsPayload } = await import('../src/components/MyMoney/L3/L3Sections/DecumulationPayloads.js')
  const e = await loadPersona('persona-a.json')
  const s = buildDecumulationSnapshot(e)
  log(s.cmaUsed === true, `cmaUsed=true (fundedRatio fed the CMA bundle)`)
  log(!!s.projected && !!s.required, `projected + required present`)
  if (!s.frInsufficient && s.horizonYears > 0) {
    log(s.projected.real <= s.projected.nominal,
      `projected real (${s.projected.real}) ≤ nominal (${s.projected.nominal})`)
    const real = projectedSavingsPayload(s, 'real')
    const nom  = projectedSavingsPayload(s, 'nominal')
    log(real.breakdown.find(r => r.label === 'Shown as')?.value === "Today's money", `real → "Today's money"`)
    log(nom.breakdown.find(r => r.label === 'Shown as')?.value === 'Future pounds', `nominal → 'Future pounds'`)
  } else {
    log(true, `horizon ${s.horizonYears}/insufficient — toggle not applicable (skipped)`)
  }
  console.log(`  Bruce: funded ${s.fundedRatioPct}% · savings now £${s.investableAssets.toLocaleString()} · projected today's-money £${s.projected.real.toLocaleString()}`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passes + fails
console.log(`\n${'─'.repeat(67)}`)
console.log(`L3 Decumulation panel — pass=${passes} fail=${fails} total=${total}`)
console.log('═'.repeat(67))
process.exit(fails === 0 ? 0 : 1)
