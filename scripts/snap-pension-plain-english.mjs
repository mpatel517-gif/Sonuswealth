import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 1600 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const opened = await p.evaluate(() => {
  const tiles = [...document.querySelectorAll('.sw-pressable')]
  const tile = tiles.find(t => /^PENSIONS/.test((t.textContent || '').trim()))
  if (!tile) return 'not-found'
  const view = [...tile.querySelectorAll('button,a')].find(b => /view detail/i.test(b.textContent || ''))
  if (view) { view.click(); return 'view-detail' }
  return 'no-view-button'
})
await p.waitForTimeout(800)

const findings = await p.evaluate(() => {
  const text = document.body.innerText
  // Old jargon-only headers — should NOT appear
  const hasAATitle = /^2 · Allowances \(AA · MPAA · Carry Forward\)/m.test(text)
  const hasLSAOnly = /^3 · LSA · LSDBA · PCLS/m.test(text)
  const hasSchemeJargon = /Schemes & nominations \(SIPP · DB · workplace DC\)/.test(text)
  const hasOldStale = /Stale \(\d/.test(text)
  // New plain-English titles — should appear
  const hasPayInTitle = /How much you can still pay in this year/i.test(text)
  const hasCashTitle = /How much tax-free cash you can take/i.test(text)
  const hasTakeOutTitle = /How much to take out, year by year/i.test(text)
  const hasPlanDoTitle = /What this plan would do/i.test(text)
  const hasPensionsTitle = /Your pensions and who they pay out to/i.test(text)
  return {
    oldJargonAA: hasAATitle, oldJargonLSA: hasLSAOnly,
    oldJargonScheme: hasSchemeJargon, oldStale: hasOldStale,
    newPayIn: hasPayInTitle, newCash: hasCashTitle,
    newTakeOut: hasTakeOutTitle, newPlanDo: hasPlanDoTitle,
    newPensions: hasPensionsTitle,
  }
})

console.log(JSON.stringify(findings, null, 2))
await p.screenshot({ path: 'screenshots/pension-plain-english.png', fullPage: true })
console.log(errs.length === 0 ? 'NO ERRORS' : errs.slice(0,3).join('\n'))

await ctx.close(); await b.close()
