// ─────────────────────────────────────────────────────────────────────────────
// L3-4 — Content bundle shape test
//
// Catches the failure modes that getContent()'s fail-soft fallback would
// hide silently:
//   1. uk-en.json is invalid JSON (typo, trailing comma) → build still passes
//      but every getContent() call returns the inline fallback. Wrong copy
//      ships under the false belief that the bundle is live.
//   2. A key listed in the test below disappears from the bundle. Same risk.
//   3. _meta block missing version / locale / lastUpdated.
//
// The list below records every key currently used by getContent() call sites.
// When you add a new getContent('a.b', fallback) call, add 'a.b' here too.
//
// Run: node tests/l3-4-bundle-shape.mjs
// ─────────────────────────────────────────────────────────────────────────────

import CONTENT from '../src/content/uk-en.json' with { type: 'json' }

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

function resolve(key) {
  const parts = key.split('.')
  let node = CONTENT
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return node
}

// ── _meta required ──────────────────────────────────────────────────────────
check('_meta.version is a string',  typeof CONTENT?._meta?.version === 'string')
check('_meta.locale is a string',   typeof CONTENT?._meta?.locale  === 'string')
check('_meta.lastUpdated is a string', typeof CONTENT?._meta?.lastUpdated === 'string')

// ── Keys currently in production code via getContent() ─────────────────────
const REQUIRED_KEYS = [
  // Cashflow.jsx
  'common.fcaFooter',
  'cashflow.noBillsState',
  'cashflow.noSubsState',
  // MoneyIncome.jsx
  'income.screenTitle',
  'income.subtitle',
  'income.yearChip',
  'income.backLabel',
  'income.emptyHeadline',
  'income.emptyCta',
  'income.footerNote',
  // Welcome.jsx
  'welcome.subhead',
  'welcome.previewEyebrow',
  'welcome.previewFootnote',
  'welcome.preLaunchHeading',
  'welcome.preLaunchBody',
  'welcome.primaryCta',
  'welcome.secondaryCta',
]

for (const key of REQUIRED_KEYS) {
  const v = resolve(key)
  check(
    `Required key present: ${key}`,
    typeof v === 'string' && v.length > 0,
    `value=${JSON.stringify(v)}`
  )
}

// ── Stale-key warning ─────────────────────────────────────────────────────
// If the bundle has keys NOT in REQUIRED_KEYS, that's not an error — those
// are bundle-only keys that get used once a call site lands. We just print
// the count so you can spot drift.
function* walk(obj, prefix = '') {
  if (obj == null || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta' && prefix === '') continue
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      yield* walk(v, path)
    } else {
      yield path
    }
  }
}
const bundleKeys = [...walk(CONTENT)]
const requiredSet = new Set(REQUIRED_KEYS)
const unused = bundleKeys.filter(k => !requiredSet.has(k))
console.log(`\nBundle has ${bundleKeys.length} keys total · ${REQUIRED_KEYS.length} wired · ${unused.length} pending wiring`)
if (unused.length > 0) {
  console.log(`Pending: ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? ` … (+${unused.length - 10} more)` : ''}`)
}

console.log(`\nL3-4 bundle-shape test — fails=${fails}`)
if (fails > 0) process.exit(1)
