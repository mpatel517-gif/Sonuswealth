import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,200)}`) })
for (const persona of ['mrt','a','b','c','d','e']) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
}
console.log(errs.length === 0 ? 'CLEAN' : 'ERRORS:')
console.log(errs.slice(0,10).join('\n'))
await ctx.close(); await b.close()
