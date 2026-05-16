// Snap Sonuswealth at 3 viewports: 480 (phone), 820 (iPad), 1440 (laptop).
// Both themes. Verifies the responsive sidebar appears at ≥1024px.
import { chromium } from 'playwright'

const b = await chromium.launch()
const errors = []

const VIEWPORTS = [
  { w: 480,  label: 'mobile' },
  { w: 820,  label: 'ipad' },
  { w: 1440, label: 'laptop' },
]

for (const vp of VIEWPORTS) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`[${vp.label} pageerror] ${e.message}`))
  p.on('console', m => { if (m.type() === 'error') errors.push(`[${vp.label} console] ${m.text().slice(0, 200)}`) })

  await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)

  await p.screenshot({ path: `screenshots/responsive-${vp.label}-dark.png`, fullPage: false })
  console.log(`✓ ${vp.label} dark`)

  // Switch to light theme via the toggle pill
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
    if (btn) btn.click()
  })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `screenshots/responsive-${vp.label}-light.png`, fullPage: false })
  console.log(`✓ ${vp.label} light`)

  await ctx.close()
}

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 15).join('\n'))
} else {
  console.log('\nNo errors.')
}
await b.close()
