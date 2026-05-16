import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => { if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(m.text()) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
// Expand
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /\+\s+\d+\s+other open move/i.test(b.innerText))
  btn?.click()
})
await p.waitForTimeout(500)
// Scroll to card
await p.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(b => /HIDE|Hide.+other open move/i.test(b.innerText))
  el?.scrollIntoView({ block: 'center' })
})
await p.waitForTimeout(300)
await p.screenshot({ path: 'screenshots/today-move-expanded-dark.png', fullPage: false })
console.log('✓ today-move-expanded-dark')
console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
