// One-off — snap the Home radar in dark AND light to verify the theme-aware fix.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 1400 } })
const p = await ctx.newPage()

await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)

// Dark snap
await p.screenshot({ path: 'screenshots/radar-dark.png', fullPage: true })
console.log('✓ dark saved')

// Click the theme toggle pill
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
  if (btn) btn.click()
})
await p.waitForTimeout(800)

// Light snap
await p.screenshot({ path: 'screenshots/radar-light.png', fullPage: true })
console.log('✓ light saved')

await b.close()
