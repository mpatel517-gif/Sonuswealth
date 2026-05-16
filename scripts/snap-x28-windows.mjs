import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1100)

// Try changing the window to 10y via the X28 selector
const opened = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Tax Year|This year|Year/i.test(b.textContent || ''))
  if (!btn) return false
  btn.click()
  return true
})
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/x28-01-menu-open.png', fullPage: false })

// Pick 10-year window
await p.evaluate(() => {
  const items = [...document.querySelectorAll('button, [role=menuitem]')]
  const ten = items.find(el => /10\s*years|10-year/i.test(el.textContent || ''))
  if (ten) ten.click()
})
await p.waitForTimeout(900)
await p.screenshot({ path: 'screenshots/x28-02-ten-year-plan.png', fullPage: false })

// Read the hero state
const findings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    hasViewModePlanBanner: /PLAN · variance overlay active|10-year horizon/i.test(text),
    hasAsAt: /·\s*plan\s*·|10-year horizon|VS TODAY/i.test(text),
    hasConfidence: /(HIGH|MEDIUM|LOW)\s+confidence/i.test(text),
    bannerText: (document.querySelector('[role=alert]') || {}).textContent || '',
  }
})
console.log(JSON.stringify(findings, null, 2))
console.log(errs.length === 0 ? 'NO ERRORS' : `ERRORS:\n${errs.slice(0,5).join('\n')}`)
await ctx.close(); await b.close()
