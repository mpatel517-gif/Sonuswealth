import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,160)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
// dismiss cookie banner
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /accept all|strictly necessary/i.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(400)

// Open the "How resilient am I" drawer if collapsed, then tap a dimension (e.g. Protection / Income).
const tapped = await p.evaluate(() => {
  // expand any collapsed RevealCard headers
  document.querySelectorAll('[id^="rc-risk-"] [role="button"], [id^="rc-risk-"] button').forEach(()=>{})
  // find a dimension row/cell to tap — DimensionsPanel rows carry the dim label
  const labels = ['Protection Coverage','Income Resilience','Liquidity Buffer','Dependency','Debt Vulnerability','Protection','Income']
  const els = [...document.querySelectorAll('button, [role="button"], .sw-press, div')]
  for (const L of labels) {
    const el = els.find(e => (e.textContent || '').trim().startsWith(L) && e.offsetHeight > 10 && e.offsetHeight < 200)
    if (el) { el.click(); return L }
  }
  return null
})
await p.waitForTimeout(700)
const text = await p.evaluate(() => document.body.innerText)
const hasHow = /How this is built/i.test(text)
const hasTotal = /Total/i.test(text)
await p.screenshot({ path: 'screenshots/dim-trace.png', fullPage: false })
console.log(JSON.stringify({ tapped, hasHow, hasTotal, errs: errs.slice(0,4) }, null, 2))
// extract the breakdown block lines
const block = text.split('How this is built')[1]?.split('Got it')[0]?.trim().slice(0, 400)
console.log('\n--- breakdown block ---\n' + (block || '(not found)'))
await ctx.close(); await b.close()
