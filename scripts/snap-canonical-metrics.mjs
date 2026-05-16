import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: 'screenshots/canonical-01-mrt.png', fullPage: false })

const findings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    hasTaxEfficiency: /Tax efficiency/i.test(text),
    hasEBR: /p of every £/i.test(text),
    hasStateTiles: /Safety Net/i.test(text) && /Debt/i.test(text) && /FI Ratio/i.test(text),
  }
})
console.log(JSON.stringify(findings, null, 2))
console.log(errs.length === 0 ? 'NO ERRORS' : `ERRORS:\n${errs.slice(0,5).join('\n')}`)
await ctx.close(); await b.close()
