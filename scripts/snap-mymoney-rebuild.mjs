// Snap the new MyMoney layout: BalanceSheet + 10 CategoryCards
// Mr T (all-domain canonical) + Bruce (real persona) at mobile + laptop.
import { chromium } from 'playwright'

const b = await chromium.launch()
const errors = []

const TESTS = [
  { persona: 'mrt', viewport: 480,  theme: 'dark',  label: 'mrt-mobile-dark' },
  { persona: 'mrt', viewport: 1440, theme: 'dark',  label: 'mrt-laptop-dark' },
  { persona: 'mrt', viewport: 1440, theme: 'light', label: 'mrt-laptop-light' },
  { persona: 'a',   viewport: 1440, theme: 'light', label: 'bruce-laptop-light' },
]

for (const t of TESTS) {
  const ctx = await b.newContext({
    viewport: { width: t.viewport, height: 900 },
    deviceScaleFactor: 2,
  })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`[${t.label}] ${e.message}`))
  p.on('console', m => { if (m.type() === 'error') errors.push(`[${t.label} console] ${m.text().slice(0, 200)}`) })

  await p.goto(`http://localhost:5173/?demo=${t.persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1800)

  if (t.theme === 'light') {
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
      if (btn) btn.click()
    })
    await p.waitForTimeout(800)
  }

  // Lift inner overflow so fullPage captures the whole scroll
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
  await p.waitForTimeout(400)
  await p.screenshot({ path: `screenshots/mm-rebuild-${t.label}.png`, fullPage: true })
  console.log(`✓ ${t.label}`)
  await ctx.close()
}

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('\nNo errors.')
}
await b.close()
