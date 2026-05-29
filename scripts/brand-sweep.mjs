// One-shot brand sweep: Caelixa → Sonuswealth, CAELIXA → SONUSWEALTH,
// caelixa → sonuswealth (case-sensitive). Skips package.json (name stays
// 'caelixa'), package-lock.json, coverage/ (regenerates), and the historical
// MASTER-AUDIT report (frozen evidence).
//
// Run: node scripts/brand-sweep.mjs --dry      (preview)
//      node scripts/brand-sweep.mjs            (apply)

import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const DRY  = process.argv.includes('--dry')

const SKIP_PATHS = [
  /[\\/]node_modules[\\/]/,
  /[\\/]coverage[\\/]/,
  /[\\/]dist[\\/]/,
  /[\\/]\.git[\\/]/,
  /package\.json$/,
  /package-lock\.json$/,
  /MASTER-AUDIT-2026-05-25-rebuild\.md$/,
  /CLAUDE\.md$/,                     // founder's living doc — leave alone
  /SKILLS\.md$/,
  /brand-sweep\.mjs$/,                // this script itself
]

const TARGETS = [
  // Word-boundary versions to avoid catching identifier-embedded uses
  // like `caelixaScore` (a metric key, not a brand reference).
  { pattern: /\bCaelixa\b/g,  replacement: 'Sonuswealth' },
  { pattern: /\bCAELIXA\b/g,  replacement: 'SONUSWEALTH' },
  // Email/domain placeholders specifically (caelixa.example)
  { pattern: /caelixa\.example/g, replacement: 'sonuswealth.example' },
  // Standalone lowercase 'caelixa' in prose/SQL/log prefixes. Negative
  // lookbehind for / avoids node_modules paths and similar.
  { pattern: /(?<!\/)\bcaelixa\b(?![A-Z])/g, replacement: 'sonuswealth' },
]

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fpath = path.join(dir, entry.name)
    if (SKIP_PATHS.some(re => re.test(fpath))) continue
    if (entry.isDirectory()) walk(fpath, out)
    else if (entry.isFile()) out.push(fpath)
  }
  return out
}

const files = walk(ROOT)
let changedFiles = 0
let totalReplacements = 0

for (const f of files) {
  let raw
  try { raw = fs.readFileSync(f, 'utf8') } catch { continue }
  let next = raw
  let fileReplacements = 0
  for (const { pattern, replacement } of TARGETS) {
    const before = next
    next = next.replace(pattern, replacement)
    if (next !== before) {
      const matches = before.match(pattern) || []
      fileReplacements += matches.length
    }
  }
  if (fileReplacements > 0) {
    changedFiles++
    totalReplacements += fileReplacements
    const rel = path.relative(ROOT, f)
    console.log(`${DRY ? '[dry] ' : ''}${rel} — ${fileReplacements} replacement(s)`)
    if (!DRY) fs.writeFileSync(f, next)
  }
}

console.log(`\n${DRY ? 'DRY RUN: would touch' : 'Touched'} ${changedFiles} files, ${totalReplacements} replacements.`)
