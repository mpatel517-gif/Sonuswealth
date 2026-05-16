// Snap the per-asset L3 overlay across themes.
import { chromium } from 'playwright'
const b = await chromium.launch()
const TESTS = [
  { viewport: 1440, theme: 'dark',  label: 'asset-l3-laptop-dark' },
  { viewport: 1440, theme: 'light', label: 'asset-l3-laptop-light' },
  { viewport: 480,  theme: 'dark',  label: 'asset-l3-mobile-dark'  },
]
const errs = []
for (const t of TESTS) {
  const ctx = await b.newContext({ viewport: { width: t.viewport, height: 1100 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('pageerror', e => errs.push(`[${t.label}] ${e.message}`))
  p.on('console', m => {
    if (m.type() === 'error' && !/api\.anthropic\.com|net::ERR_FAILED/.test(m.text())) {
      errs.push(`[${t.label} console] ${m.text().slice(0, 200)}`)
    }
  })
  await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  if (t.theme === 'light') {
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
      btn?.click()
    })
    await p.waitForTimeout(500)
  }
  // open investments drill
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || '').includes('Savings & Investments'))
    btn?.click()
  })
  await p.waitForTimeout(1200)
  // click first asset row
  await p.evaluate(() => {
    const buttons = [...document.querySelectorAll('button.sw-press')]
      .filter(b => /£/.test(b.innerText) && /›/.test(b.innerText) && !/View detail/i.test(b.innerText))
    buttons[0]?.click()
  })
  await p.waitForTimeout(900)
  await p.screenshot({ path: `screenshots/${t.label}.png`, fullPage: false })
  console.log(`✓ ${t.label}`)
  await ctx.close()
}
console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
