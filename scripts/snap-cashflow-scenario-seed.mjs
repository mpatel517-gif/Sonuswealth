// Snap Cashflow scenario view with seed banner visible — both themes.
import { chromium } from 'playwright'

const b = await chromium.launch()
const seed = encodeURIComponent(JSON.stringify({
  label: 'Pension headroom', current: 60000, proposed: 30000,
  formatted: '£60k', line: '£24k of tax relief gone forever if not used by 5 April',
}))
const TESTS = [
  { viewport: 1440, theme: 'dark',  label: 'cf-seed-laptop-dark' },
  { viewport: 1440, theme: 'light', label: 'cf-seed-laptop-light' },
  { viewport: 480,  theme: 'dark',  label: 'cf-seed-mobile-dark'  },
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
  await p.goto(`http://localhost:5173/?demo=mrt&tab=flow&cfTab=scenario&seed=${seed}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  if (t.theme === 'light') {
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
      btn?.click()
    })
    await p.waitForTimeout(500)
  }
  await p.screenshot({ path: `screenshots/${t.label}.png`, fullPage: false })
  console.log(`✓ ${t.label}`)
  await ctx.close()
}
console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
