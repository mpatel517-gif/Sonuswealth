#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sync-tax-bundle.mjs — VERIFY-AND-PATCH sync for the live UK tax bundle.
//
// The live source of truth, src/rules/UK-2026.1.1.json, is a large hand-curated
// knowledge artifact: nested sub-objects, prose notes, rule IDs (UK-IT-XX), the
// SRT matrix, split-year cases. It must NOT be blindly regenerated/overwritten
// (the old scripts/update-rules-uk.mjs regenerated a FLAT file → it wrote a dead
// file app-prototype/rules-uk.js precisely to avoid clobbering this bundle; the
// fake scripts/sync-legislation.js did no real research at all).
//
// This script instead VERIFIES the ~35 Budget-sensitive headline figures against
// gov.uk/HMRC (via Claude + live web search) and DIFFS each against its exact
// path in the bundle. It patches ONLY changed leaf values in place — every note,
// rule ID and structure is preserved. Human-gated by default.
//
// SAFE BY DEFAULT:
//   node scripts/sync-tax-bundle.mjs            → offline self-check: validate
//                                                 every CHECK path resolves +
//                                                 print current values. No API,
//                                                 no writes.
//   node scripts/sync-tax-bundle.mjs --live     → research (real API + web
//                                                 search) + diff + write report.
//                                                 NO bundle write.
//   ... --live --apply                          → also patch changed leaves into
//                                                 the bundle (anomalies need
//                                                 --force; everything reviewed in
//                                                 the report first).
//   ... --mock tests/fixtures/tax-mock.json     → diff against a values file
//                                                 instead of the API (offline /
//                                                 no-credit test of the mechanics)
//   flags: --threshold=0.10  --force  --out <path>
//
// Replaces: scripts/sync-legislation.js (fake) + scripts/update-rules-uk.mjs
// (real API but wrote the dead app-prototype/rules-uk.js).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUNDLE_PATH = resolve(__dirname, '../src/rules/UK-2026.1.1.json')

// ── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const valOf = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d }
const LIVE = has('--live')
const APPLY = has('--apply')
const FORCE = has('--force')
const MOCK = valOf('--mock', null)
const THRESHOLD = parseFloat(valOf('--threshold', '0.10'))
const OUT = valOf('--out', resolve(__dirname, '../tests/.tax-sync-report'))

// ── The headline checks — id → exact bundle path + how to research it ────────
// Only Budget-sensitive numeric leaves. Each maps to ONE path in the bundle so
// a patch touches exactly that value. `kind` drives equality tolerance + format.
const CHECKS = [
  // Income tax
  { id: 'personal_allowance',        path: 'income.personalAllowance',                 kind: 'money', q: 'UK personal allowance (income tax) 2026/27' },
  { id: 'basic_rate_threshold',      path: 'income.basicRateThreshold',                kind: 'money', q: 'UK higher-rate threshold (basic rate limit + PA) 2026/27' },
  { id: 'additional_rate_threshold', path: 'income.additionalRateThreshold',           kind: 'money', q: 'UK additional rate (45%) threshold 2026/27' },
  { id: 'dividend_allowance',        path: 'income.dividendAllowance',                 kind: 'money', q: 'UK dividend allowance 2026/27' },
  { id: 'dividend_basic_rate',       path: 'income.dividendBasicRate',                 kind: 'rate',  q: 'UK dividend ordinary (basic) rate 2026/27' },
  { id: 'dividend_higher_rate',      path: 'income.dividendHigherRate',                kind: 'rate',  q: 'UK dividend upper (higher) rate 2026/27' },
  { id: 'dividend_additional_rate',  path: 'income.dividendAdditionalRate',            kind: 'rate',  q: 'UK dividend additional rate 2026/27' },
  // CGT
  { id: 'cgt_aea',                   path: 'capitalGains.annualExemptAmount',          kind: 'money', q: 'UK CGT annual exempt amount 2026/27' },
  { id: 'cgt_basic_rate',            path: 'capitalGains.basicRate',                   kind: 'rate',  q: 'UK CGT basic rate (non-property) from 30 Oct 2024' },
  { id: 'cgt_higher_rate',           path: 'capitalGains.higherRate',                  kind: 'rate',  q: 'UK CGT higher rate (non-property) from 30 Oct 2024' },
  { id: 'badr_rate',                 path: 'capitalGains.badrRate',                    kind: 'rate',  q: 'UK Business Asset Disposal Relief rate from 6 April 2026' },
  // IHT
  { id: 'iht_nrb',                   path: 'inheritanceTax.nilRateBand',               kind: 'money', q: 'UK inheritance tax nil-rate band 2026/27' },
  { id: 'iht_rnrb',                  path: 'inheritanceTax.residenceNilRateBand',      kind: 'money', q: 'UK residence nil-rate band 2026/27' },
  { id: 'iht_rate',                  path: 'inheritanceTax.ihtRate',                   kind: 'rate',  q: 'UK inheritance tax standard rate' },
  { id: 'iht_annual_gift',          path: 'inheritanceTax.annualGiftExemption',       kind: 'money', q: 'UK IHT annual gift exemption' },
  { id: 'apr_bpr_allowance',         path: 'inheritanceTax.aprBprCombinedAllowance',   kind: 'money', q: 'UK combined APR/BPR 100% relief allowance from April 2026' },
  // Pension
  { id: 'pension_aa',                path: 'pension.annualAllowance',                  kind: 'money', q: 'UK pension annual allowance 2026/27' },
  { id: 'mpaa',                      path: 'pension.moneyPurchaseAnnualAllowance',     kind: 'money', q: 'UK money purchase annual allowance 2026/27' },
  { id: 'lump_sum_allowance',        path: 'pension.lumpSumAllowance',                 kind: 'money', q: 'UK pension Lump Sum Allowance (post-LTA) 2026/27' },
  { id: 'state_pension_annual',      path: 'pension.statePensionFullAmount',           kind: 'money', q: 'UK full new State Pension annual amount 2026/27' },
  { id: 'state_pension_weekly',      path: 'pension.statePensionWeeklyRate',           kind: 'money', q: 'UK full new State Pension weekly rate 2026/27' },
  // ISA
  { id: 'isa_allowance',             path: 'isa.annualAllowance',                      kind: 'money', q: 'UK ISA annual allowance 2026/27' },
  { id: 'lisa_allowance',            path: 'isa.lifetimeISAAllowance',                 kind: 'money', q: 'UK Lifetime ISA annual allowance 2026/27' },
  { id: 'jisa_allowance',            path: 'isa.juniorISAAllowance',                   kind: 'money', q: 'UK Junior ISA annual allowance 2026/27' },
  // Venture reliefs
  { id: 'vct_relief',                path: 'taxEfficientInvestments.vct.incomeTaxRelief', kind: 'rate', q: 'UK VCT income tax relief rate from 6 April 2026' },
  { id: 'eis_relief',                path: 'taxEfficientInvestments.eis.incomeTaxRelief', kind: 'rate', q: 'UK EIS income tax relief rate 2026/27' },
  { id: 'seis_relief',               path: 'taxEfficientInvestments.seis.incomeTaxRelief', kind: 'rate', q: 'UK SEIS income tax relief rate 2026/27' },
  // National Insurance
  { id: 'ni_employee_rate',          path: 'nationalInsurance.class1EmployeeRate',     kind: 'rate',  q: 'UK Class 1 employee NIC main rate 2026/27' },
  { id: 'ni_employer_rate',          path: 'nationalInsurance.class1EmployerRate',     kind: 'rate',  q: 'UK Class 1 employer (secondary) NIC rate from April 2025' },
  { id: 'ni_employer_threshold',     path: 'nationalInsurance.class1EmployerSecondaryThreshold', kind: 'money', q: 'UK employer NIC secondary threshold from April 2025' },
  { id: 'employment_allowance',      path: 'nationalInsurance.employmentAllowance',    kind: 'money', q: 'UK Employment Allowance from April 2025' },
  // Corporation tax (personal-impact context)
  { id: 'ct_small_rate',             path: 'corporationTax.smallProfitsRate',          kind: 'rate',  q: 'UK corporation tax small profits rate 2026' },
  { id: 'ct_main_rate',              path: 'corporationTax.mainRate',                  kind: 'rate',  q: 'UK corporation tax main rate 2026' },
  { id: 's455_rate',                 path: 'businessOwnerPersonal.directorsLoan.s455TaxRate', kind: 'rate', q: 'UK S455 tax rate on overdrawn director loans (note 35.75% from 6 April 2026)' },
  // Property
  { id: 'sdlt_surcharge',            path: 'property.sdlt.additionalPropertySurcharge', kind: 'rate', q: 'UK SDLT additional property surcharge from 31 Oct 2024' },
]

// ── path helpers ─────────────────────────────────────────────────────────────
function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}
function setPath(obj, p, v) {
  const keys = p.split('.')
  let o = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') return false
    o = o[keys[i]]
  }
  o[keys[keys.length - 1]] = v
  return true
}

// ── equality (rates have float tolerance; money/int exact) ───────────────────
function equalish(kind, a, b) {
  if (a == null || b == null) return false
  if (kind === 'rate') return Math.abs(Number(a) - Number(b)) < 1e-6
  return Number(a) === Number(b)
}
function fmt(kind, v) {
  if (v == null) return '—'
  if (kind === 'rate') return `${(Number(v) * 100).toFixed(3).replace(/\.?0+$/, '')}%`
  return `£${Number(v).toLocaleString('en-GB')}`
}

// ── research (live API) — reuses the proven update-rules-uk.mjs pattern ───────
function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*["']?(.+?)["']?\s*$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}
function resolveApiKey() {
  for (const name of ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_KEY', 'ANTHROPIC_KEY']) {
    const val = (process.env[name] || '').trim().replace(/^["']|["']$/g, '')
    if (val.startsWith('sk-ant-')) return val
  }
  return null
}

async function researchLive() {
  loadEnvLocal()
  const key = resolveApiKey()
  if (!key) {
    console.error('\n❌ --live needs an Anthropic API key (ANTHROPIC_API_KEY / VITE_ANTHROPIC_KEY in .env.local).')
    process.exit(1)
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: key })
  const today = new Date().toISOString().slice(0, 10)
  const SYSTEM = 'You are a UK financial compliance researcher. Verify current UK financial figures against authoritative sources only: gov.uk, HMRC, legislation.gov.uk, official Budget documents. Return ONLY verified numbers with a citation URL each. Never guess — if you cannot confirm a value, return it as null with status "UNVERIFIED".'
  const list = CHECKS.map(c => `- "${c.id}": ${c.q}`).join('\n')
  const USER = `Today is ${today}; UK tax year 2026/27 (Apr 2026–Apr 2027). Search the web and confirm the CURRENT value of each figure below. Rates as decimals (e.g. 0.20 for 20%); monetary amounts as plain numbers (no commas/£).\n\n${list}\n\nReturn ONLY a JSON object keyed by the id, each value: {"value": <number|null>, "status": "ENACTED"|"PROPOSED"|"UNVERIFIED", "source": "<url>", "asOf": "<tax year or date>"}. No prose.`
  console.log(`\n🔍 Researching ${CHECKS.length} figures via live web search (${today})…\n`)
  const res = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: SYSTEM,
    messages: [{ role: 'user', content: USER }],
  })
  const textBlocks = res.content.filter(b => b.type === 'text')
  let raw = textBlocks[textBlocks.length - 1]?.text?.trim() || ''
  raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}')
  if (a !== -1 && b !== -1) raw = raw.slice(a, b + 1)
  return JSON.parse(raw)
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(BUNDLE_PATH)) { console.error(`Bundle not found: ${BUNDLE_PATH}`); process.exit(1) }
  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'))

  // 1) Always: validate every CHECK path resolves (catches drift/typos in CHECKS).
  const broken = CHECKS.filter(c => getPath(bundle, c.path) === undefined)
  if (broken.length) {
    console.error(`\n❌ ${broken.length} CHECK path(s) do not resolve in the bundle — fix CHECKS before syncing:`)
    broken.forEach(c => console.error(`   ${c.id} → ${c.path}`))
    process.exit(1)
  }

  // Offline self-check (default, no flag): print current values and stop.
  if (!LIVE && !MOCK) {
    console.log(`\n✅ Offline self-check — all ${CHECKS.length} paths resolve in UK-2026.1.1.json:\n`)
    for (const c of CHECKS) console.log(`   ${c.id.padEnd(26)} ${c.path.padEnd(56)} ${fmt(c.kind, getPath(bundle, c.path))}`)
    console.log(`\n   Run with --live to research + diff against gov.uk/HMRC, or --mock <file> to test offline.`)
    return
  }

  // 2) Get researched values (live API or mock file).
  let researched
  if (MOCK) {
    researched = JSON.parse(readFileSync(resolve(process.cwd(), MOCK), 'utf8'))
    console.log(`\n📄 Diffing against mock values: ${MOCK}\n`)
  } else {
    researched = await researchLive()
  }

  // 3) Diff.
  const rows = CHECKS.map(c => {
    const current = getPath(bundle, c.path)
    const r = researched[c.id]
    const fetched = r && r.value != null ? r.value : null
    let state
    if (fetched == null) state = 'unverified'
    else if (equalish(c.kind, current, fetched)) state = 'unchanged'
    else {
      const rel = Math.abs(Number(fetched) - Number(current)) / (Math.abs(Number(current)) || 1)
      state = rel > THRESHOLD ? 'anomaly' : 'changed'
    }
    return { ...c, current, fetched, state, source: r?.source || '', status: r?.status || '', asOf: r?.asOf || '' }
  })

  const counts = rows.reduce((m, r) => ((m[r.state] = (m[r.state] || 0) + 1), m), {})
  const changed = rows.filter(r => r.state === 'changed' || r.state === 'anomaly')

  // 4) Report (console + files).
  console.log(`\n── TAX BUNDLE SYNC ── threshold ${(THRESHOLD * 100).toFixed(0)}%`)
  console.log(`   unchanged ${counts.unchanged || 0} · changed ${counts.changed || 0} · ⚠ anomaly ${counts.anomaly || 0} · unverified ${counts.unverified || 0}\n`)
  for (const r of rows) {
    if (r.state === 'unchanged') continue
    const tag = r.state === 'anomaly' ? '⚠ ANOMALY ' : r.state === 'changed' ? '~ changed  ' : '? unverified'
    console.log(`   ${tag} ${r.id.padEnd(24)} ${fmt(r.kind, r.current)} → ${fmt(r.kind, r.fetched)}   ${r.source}`)
  }

  const reportJson = { ranAt: new Date().toISOString(), threshold: THRESHOLD, source: MOCK ? `mock:${MOCK}` : 'live', counts, rows }
  writeFileSync(`${OUT}.json`, JSON.stringify(reportJson, null, 2))
  const md = [
    `# Tax bundle sync report`,
    ``,
    `- Source: ${MOCK ? `mock (${MOCK})` : 'live web search'} · threshold ${(THRESHOLD * 100).toFixed(0)}%`,
    `- unchanged **${counts.unchanged || 0}** · changed **${counts.changed || 0}** · anomaly **${counts.anomaly || 0}** · unverified **${counts.unverified || 0}**`,
    ``,
    `| state | id | path | current | researched | status | source |`,
    `|---|---|---|---|---|---|---|`,
    ...rows.map(r => `| ${r.state} | ${r.id} | \`${r.path}\` | ${fmt(r.kind, r.current)} | ${fmt(r.kind, r.fetched)} | ${r.status} | ${r.source} |`),
  ].join('\n')
  writeFileSync(`${OUT}.md`, md)
  console.log(`\n   Report → ${OUT}.json / .md`)

  // 5) Patch (gated). Only 'changed' by default; 'anomaly' needs --force.
  if (APPLY) {
    const toApply = changed.filter(r => r.state === 'changed' || (r.state === 'anomaly' && FORCE))
    const skippedAnomalies = changed.filter(r => r.state === 'anomaly' && !FORCE)
    if (skippedAnomalies.length) {
      console.log(`\n   ⚠ ${skippedAnomalies.length} anomaly(ies) NOT applied without --force (review the report first):`)
      skippedAnomalies.forEach(r => console.log(`     ${r.id}: ${fmt(r.kind, r.current)} → ${fmt(r.kind, r.fetched)}`))
    }
    if (toApply.length === 0) {
      console.log(`\n   Nothing to patch.`)
    } else {
      for (const r of toApply) setPath(bundle, r.path, r.fetched)
      bundle._lastUpdated = new Date().toISOString().slice(0, 10)
      bundle._meta = bundle._meta || {}
      bundle._meta.lastSyncedBy = `sync-tax-bundle.mjs (${MOCK ? 'mock' : 'live'})`
      bundle._meta.lastSyncedAt = new Date().toISOString().slice(0, 10)
      writeFileSync(BUNDLE_PATH, JSON.stringify(bundle, null, 2) + '\n')
      console.log(`\n   ✅ Patched ${toApply.length} leaf value(s) into UK-2026.1.1.json (structure + notes preserved). Review the diff before committing.`)
    }
  } else if (changed.length) {
    console.log(`\n   ${changed.length} value(s) differ. Re-run with --apply to patch them in place (anomalies need --force).`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
