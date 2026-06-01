// tests/tax-guards.mjs
//
// Two tripwires for the tax-currency bug class found in the 2026-06-01 audit.
//   Run:            `npm run test:tax-guards`
//   Refresh baseline `node tests/tax-guards.mjs --update-baseline`
//
// GUARD A — TAX key validity (the strong one).
//   Every `TAX.<key>` / `TAX?.<key>` read in src/ must reference a key the bundle
//   actually builds (Object.keys(TAX) from _bundle.js _buildTAX). A typo like
//   `TAX.dividendBasic` (real key: dividendBR) or `TAX.aa` (real: pensionAA)
//   compiles and runs fine because of the `?? literal` fallback — so the wrong key
//   is invisible to output-asserting tests. This guard makes it visible.
//
// GUARD B — stale-literal tripwire (focused, high-confidence).
//   A small denylist of values unambiguously wrong for the active tax year. Catches
//   the "bundle was refreshed, a hardcoded duplicate wasn't" drift (state pension
//   £11,502, dividend basic 8.75%). Kept deliberately small to avoid false
//   positives — many tax magic-numbers (0.3375 = S455, 6000 = chattels limit) are
//   legitimately current and are NOT denylisted.
//
// BASELINE: pre-existing violations are recorded in tests/.tax-guards-baseline.json
// so the gate fails only on NEWLY introduced debt. The baseline file IS the
// remediation backlog — burn it down to zero. Regenerate after fixing with
// --update-baseline.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { TAX } from '../src/engine/fq-calculator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const BASELINE_FILE = join(__dirname, '.tax-guards-baseline.json')
const UPDATE = process.argv.includes('--update-baseline')

const EXT = /\.(jsx?|mjs)$/
const SKIP_DIR = new Set(['node_modules', 'dist', 'backups', '.git', 'historical'])
// Test files legitimately carry old values as fixtures/parameters — exclude them.
const IS_TEST_FILE = (name) => /(^test[-.]|[.-]test\.|\.spec\.)/.test(name)
const VALID_KEYS = new Set(Object.keys(TAX))

// GUARD B denylist — high-confidence + unambiguous only.
const STALE = [
  { re: /\b11502\b/,   id: 'state-pension-11502', label: 'state pension £11,502 (2024/25) — now £12,547.60' },
  { re: /\b0\.0875\b/, id: 'dividend-basic-0875',  label: 'dividend basic 8.75% (pre-Apr-2026) — now 10.75% (TAX.dividendBR)' },
  { re: /\b0\.138\b/,  id: 'employer-ni-138',      label: 'employer NI 13.8% (pre-Apr-2025) — now 15% (TAX.employerNICRate)' },
]

async function walk(dir, acc = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!SKIP_DIR.has(ent.name)) await walk(join(dir, ent.name), acc) }
    else if (EXT.test(ent.name) && !IS_TEST_FILE(ent.name)) acc.push(join(dir, ent.name))
  }
  return acc
}
// Strip comments but PRESERVE newlines so reported line numbers stay accurate.
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/.*$/gm, '')

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1))
  return d[m][n]
}
function nearestKey(bad) {
  let best = null, bestD = Infinity
  for (const k of VALID_KEYS) { const dd = levenshtein(bad.toLowerCase(), k.toLowerCase()); if (dd < bestD) { bestD = dd; best = k } }
  return bestD <= Math.max(3, Math.ceil(bad.length / 2)) ? best : null
}
const KEY_RE = /(?<![\w$])TAX\s*\??\.\s*([A-Za-z_$][\w$]*)/g

const files = await walk(SRC)
const keyHits = []   // { rel, line, key, suggest, id:'A:rel::key' }
const staleHits = [] // { rel, line, label, text, id:'B:rel::staleid' }

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const code = stripComments(await readFile(file, 'utf8'))
  code.split('\n').forEach((line, i) => {
    let m; KEY_RE.lastIndex = 0
    while ((m = KEY_RE.exec(line)) !== null) {
      const key = m[1]
      if (!VALID_KEYS.has(key)) keyHits.push({ rel, line: i+1, key, suggest: nearestKey(key), id: `A:${rel}::${key}` })
    }
    for (const s of STALE) if (s.re.test(line)) staleHits.push({ rel, line: i+1, label: s.label, text: line.trim().slice(0, 90), id: `B:${rel}::${s.id}` })
  })
}

// ── baseline ──────────────────────────────────────────────────────────────────
const allIds = [...new Set([...keyHits.map(h => h.id), ...staleHits.map(h => h.id)])].sort()
if (UPDATE) {
  await writeFile(BASELINE_FILE, JSON.stringify({ _note: 'Pre-existing tax-wiring violations (backlog). Burn to []. Regenerate via --update-baseline.', generated: 'manual', ids: allIds }, null, 2) + '\n')
  console.log(`\n✓ baseline written: ${allIds.length} known violation(s) → ${relative(ROOT, BASELINE_FILE).replace(/\\/g,'/')}\n`)
  process.exit(0)
}
const baseline = existsSync(BASELINE_FILE) ? new Set(JSON.parse(await readFile(BASELINE_FILE, 'utf8')).ids) : new Set()

// ── report ──────────────────────────────────────────────────────────────────────
const newKey = keyHits.filter(h => !baseline.has(h.id))
const newStale = staleHits.filter(h => !baseline.has(h.id))

console.log(`\n══ TAX GUARDS ══  (${VALID_KEYS.size} valid TAX keys · ${files.length} src files · baseline ${baseline.size})\n`)

console.log(`── GUARD A: TAX key validity ──  ${keyHits.length} read(s) of unknown keys`)
if (!keyHits.length) console.log('   ✓ every TAX.<key> read resolves to a real bundle key')
else {
  const byKey = {}; for (const h of keyHits) (byKey[h.key] ??= []).push(h)
  for (const [key, rows] of Object.entries(byKey).sort((a,b)=>b[1].length-a[1].length)) {
    const known = rows.every(r => baseline.has(r.id)) ? ' [baselined]' : ''
    const sug = rows[0].suggest ? `→ TAX.${rows[0].suggest}?` : '→ no close key (may need a new bundle key)'
    console.log(`   ✗ TAX.${key} (${rows.length}×) ${sug}${known}`)
    for (const r of rows.slice(0,5)) console.log(`        ${r.rel}:${r.line}`)
    if (rows.length > 5) console.log(`        …${rows.length-5} more`)
  }
}
console.log(`\n── GUARD B: stale-literal tripwire ──  ${staleHits.length} hit(s)`)
if (!staleHits.length) console.log('   ✓ no denylisted stale tax literals found')
else for (const h of staleHits) console.log(`   ✗ ${h.rel}:${h.line} — ${h.label}${baseline.has(h.id) ? ' [baselined]' : ''}\n        ${h.text}`)

console.log(`\n── verdict ──`)
console.log(`   baselined (known backlog): ${keyHits.length - newKey.length} key · ${staleHits.length - newStale.length} stale`)
console.log(`   NEW (gated):               ${newKey.length} key · ${newStale.length} stale`)
const failures = newKey.length + newStale.length
if (!failures) { console.log('\n✓ PASS — no new tax-wiring violations (burn the baseline down to zero)\n'); process.exit(0) }
console.log('\n✗ FAIL — new tax-wiring violation(s). Read from the correct TAX key (grep _bundle.js _buildTAX), or add a bundle key.\n')
for (const h of newKey)   console.log(`   NEW key   ${h.rel}:${h.line}  TAX.${h.key}${h.suggest ? `  → TAX.${h.suggest}?` : ''}`)
for (const h of newStale) console.log(`   NEW stale ${h.rel}:${h.line}  ${h.label}`)
process.exit(1)
