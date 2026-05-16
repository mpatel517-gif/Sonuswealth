import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => { if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(m.text()) })

async function snap(pivotId, label) {
  await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.evaluate((pid) => {
    const labels = { income: 'Income', insurance: 'Insurance', bonds: 'Bonds' }
    const bsBtn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Balance sheet')
    const sibs = [...bsBtn.parentElement.querySelectorAll('button')]
    const tgt = sibs.find(b => b.innerText.trim() === labels[pid])
    tgt?.click()
  }, pivotId)
  await p.waitForTimeout(1000)
  // Lift overflow
  await p.evaluate(() => {
    document.querySelectorAll('div').forEach(d => {
      const s = getComputedStyle(d)
      if (s.overflow === 'hidden' && s.flex.includes('1')) {
        d.style.overflow = 'visible'; d.style.height = 'auto'; d.style.maxHeight = 'none'
      }
    })
    document.documentElement.style.height = 'auto'
    document.body.style.height = 'auto'; document.body.style.overflow = 'visible'
  })
  await p.waitForTimeout(300)
  await p.screenshot({ path: `screenshots/pivot-${label}.png`, fullPage: true })
  console.log(`✓ ${label}`)
}

await snap('income', 'income')
await snap('insurance', 'insurance')
await snap('bonds', 'bonds')
console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
