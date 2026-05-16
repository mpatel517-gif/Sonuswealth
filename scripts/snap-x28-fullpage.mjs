import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1100)

// Pick 10-year window
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /^Year|Tax Year|This year/i.test((b.textContent||'').trim()))
  if (btn) btn.click()
})
await p.waitForTimeout(300)
await p.evaluate(() => {
  const items = [...document.querySelectorAll('button, [role=menuitem]')]
  const ten = items.find(el => /10\s*years/i.test(el.textContent || ''))
  if (ten) ten.click()
})
await p.waitForTimeout(900)
// Scroll down to the Balance Sheet hero
await p.evaluate(() => {
  const card = [...document.querySelectorAll('*')].find(e => /^Balance sheet$/i.test((e.textContent||'').trim().split('\n')[0]))
  if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' })
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/x28-03-hero-projected.png', fullPage: false })
await ctx.close(); await b.close()
console.log('done')
