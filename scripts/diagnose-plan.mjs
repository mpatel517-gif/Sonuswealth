import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext()
for (const persona of ['a', 'mrt']) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', err => errors.push(`PAGE: ${err.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`) })
  await page.goto(`http://localhost:5173/?demo=${persona}&tab=plan`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const text = await page.evaluate(() => document.body.innerText)
  console.log(`\n══ ${persona} / plan ══`)
  console.log('Errors:', errors.length)
  errors.forEach(e => console.log(' ', e))
  // Check which sections render
  for (const section of ['Life Stage', 'Score Journey', 'Action Calendar', 'Decision Log', 'Scenario', 'Goals', 'Milestones']) {
    console.log(`  ${text.includes(section) ? '✓' : '✗'} ${section}`)
  }
  await page.close()
}
await browser.close()
