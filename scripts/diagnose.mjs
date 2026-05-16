// diagnose.mjs — capture console errors from blank pages
// Usage: node scripts/diagnose.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const TARGETS = [
  { persona: 'a',   tab: 'home' },
  { persona: 'a',   tab: 'risk' },
  { persona: 'mrt', tab: 'home' },
  { persona: 'mrt', tab: 'risk' },
]

const browser = await chromium.launch()
const ctx = await browser.newContext()

for (const t of TARGETS) {
  const page = await ctx.newPage()
  const errors = []
  const warnings = []

  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}\n${err.stack}`))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`)
    if (msg.type() === 'warning') warnings.push(`WARN: ${msg.text()}`)
  })

  const url = `${BASE}/?demo=${t.persona}&tab=${t.tab}`
  console.log(`\n══════ ${t.persona.toUpperCase()} / ${t.tab.toUpperCase()} ══════`)
  console.log(url)

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 })
    await page.waitForTimeout(800)
  } catch (e) {
    errors.push(`NAV: ${e.message}`)
  }

  if (errors.length === 0) {
    console.log('✓ No runtime errors')
  } else {
    errors.forEach(e => console.log(e))
  }
  if (warnings.length > 0 && warnings.length < 10) {
    warnings.slice(0, 5).forEach(w => console.log(w))
  }

  await page.close()
}

await browser.close()
console.log('\nDone.')
