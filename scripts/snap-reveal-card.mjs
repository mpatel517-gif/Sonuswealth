// Snap the re-themed RevealCard in both closed + open states, both themes.
import { chromium } from 'playwright'
const b = await chromium.launch()
const TESTS = [
  { viewport: 1440, theme: 'dark',  label: 'rc-laptop-dark' },
  { viewport: 1440, theme: 'light', label: 'rc-laptop-light' },
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
  // Scroll to the ANI panel area
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('section[aria-labelledby^="rc-"]')][0]
    el?.scrollIntoView({ block: 'center' })
  })
  await p.waitForTimeout(400)
  // Click the first RevealCard header to open it
  await p.evaluate(() => {
    const first = [...document.querySelectorAll('section[aria-labelledby^="rc-"]')]
      .find(s => s.getAttribute('data-open') === 'false')
    const btn = first?.querySelector('[role="button"]')
    btn?.click()
  })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `screenshots/${t.label}.png`, fullPage: false })
  console.log(`✓ ${t.label}`)
  await ctx.close()
}
console.log(errs.length ? `errors: ${errs.length}` : 'No errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
