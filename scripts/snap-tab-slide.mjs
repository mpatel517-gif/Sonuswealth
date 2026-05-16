import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => { if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(m.text()) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: 'screenshots/tab-slide-actual.png', fullPage: false })
console.log('✓ actual')

// Click "Plan" mode to switch viewMode
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Plan')
  btn?.click()
})
await p.waitForTimeout(800) // wait for slide animation
await p.screenshot({ path: 'screenshots/tab-slide-plan.png', fullPage: false })
console.log('✓ plan')

// Check the structural wrapper exists with viewmode reflected
const inspect = await p.evaluate(() => {
  const slides = document.querySelectorAll('.sw-tab-slide')
  return {
    count: slides.length,
    classes: [...slides].map(s => s.className),
    inMyMoneyContext: !!document.body.innerText.match(/MyMoney|My Money/i),
  }
})
console.log('inspect:', inspect)

console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
