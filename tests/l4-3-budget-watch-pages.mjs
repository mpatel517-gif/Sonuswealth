// ─────────────────────────────────────────────────────────────────────────────
// L4-3 — budget-watch page registry test
//
// The Edge Function probes a fixed list of gov.uk URLs. A typo in the URL,
// a duplicate key, or a non-gov.uk URL would silently degrade the watch.
// This test locks the shape so the next PR that touches the registry fails
// CI on a typo instead of in production.
//
// Cases:
//   1. PAGES is non-empty array of { key, url, description }
//   2. Every URL is a https://www.gov.uk or https://gov.uk URL
//   3. No duplicate keys
//   4. validatePages helper returns same errors when given bad data
//
// Run: node tests/l4-3-budget-watch-pages.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { PAGES, validatePages } from '../supabase/functions/_shared/budget-watch-pages.js'

let fails = 0
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`)
  else { console.log(`✗ ${label} — ${detail || ''}`); fails++ }
}

// ── Case 1 — registry is well-formed ───────────────────────────────────────
{
  check('Case 1 — PAGES is non-empty array', Array.isArray(PAGES) && PAGES.length > 0)
  for (const p of PAGES) {
    check(
      `Case 1 — page "${p?.key}" has required string fields`,
      typeof p?.key === 'string' && p.key.length > 0
      && typeof p?.url === 'string' && p.url.length > 0
      && typeof p?.description === 'string' && p.description.length > 0,
      JSON.stringify(p)
    )
  }
}

// ── Case 2 — every URL is gov.uk ───────────────────────────────────────────
{
  for (const p of PAGES) {
    check(
      `Case 2 — ${p.key} URL is gov.uk`,
      /^https:\/\/(www\.)?gov\.uk\//.test(p.url),
      p.url
    )
  }
}

// ── Case 3 — no duplicate keys ─────────────────────────────────────────────
{
  const keys = PAGES.map(p => p.key)
  const unique = new Set(keys)
  check(`Case 3 — no duplicate page keys (${keys.length} unique of ${keys.length})`,
    keys.length === unique.size,
    `keys=${JSON.stringify(keys)}`
  )
}

// ── Case 4 — validatePages catches bad shape ──────────────────────────────
{
  check('Case 4a — validatePages returns [] for valid registry',
    validatePages(PAGES).length === 0)

  check('Case 4b — validatePages rejects non-array',
    validatePages(null).length > 0 && validatePages('a string').length > 0)

  const dup = [{ key: 'a', url: 'https://www.gov.uk/x', description: 'A' },
               { key: 'a', url: 'https://www.gov.uk/y', description: 'B' }]
  check('Case 4c — validatePages flags duplicate keys',
    validatePages(dup).some(e => /duplicate/i.test(e)),
    JSON.stringify(validatePages(dup)))

  const nonGovUk = [{ key: 'x', url: 'https://example.com/page', description: 'X' }]
  check('Case 4d — validatePages flags non-gov.uk URLs',
    validatePages(nonGovUk).some(e => /gov\.uk/i.test(e)),
    JSON.stringify(validatePages(nonGovUk)))

  const missingDesc = [{ key: 'x', url: 'https://www.gov.uk/x', description: '' }]
  check('Case 4e — validatePages flags missing description',
    validatePages(missingDesc).some(e => /description/i.test(e)),
    JSON.stringify(validatePages(missingDesc)))
}

console.log(`\nL4-3 budget-watch-pages test — fails=${fails}`)
if (fails > 0) process.exit(1)
