import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push('PAGE: ' + e.message))
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
console.log('errors:', errs.length)
errs.forEach(e => console.log('  ', e))
const tile = await p.evaluate(() => {
  const els = document.querySelectorAll('div, section')
  let report = []
  for (const e of els) {
    const t = e.textContent?.slice(0, 50) || ''
    if (t.includes('Net Worth') || t.includes('£3.63') || t.includes('Established')) {
      const r = e.getBoundingClientRect()
      const s = getComputedStyle(e)
      report.push({ snippet: t, h: r.height, op: s.opacity, vis: s.visibility, disp: s.display })
      if (report.length >= 5) break
    }
  }
  return report
})
console.log('tiles:', JSON.stringify(tile, null, 2))
await p.screenshot({ path: 'screenshots/diagnose-home.png', fullPage: true })
await b.close()
