import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1300)

// Zoom into the hero card region
const heroEl = await p.$('text=Net worth')
if (heroEl) {
  await heroEl.scrollIntoViewIfNeeded()
  await p.waitForTimeout(200)
  // Crop screenshot around the hero
  const box = await heroEl.boundingBox()
  if (box) {
    await p.screenshot({
      path: 'screenshots/tappable-hero-zoom.png',
      clip: { x: 0, y: Math.max(0, box.y - 30), width: 1440, height: 280 },
    })
  }
}

// Click on the first ⚡ to open sheet
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button[aria-label]')]
    .find(b => (b.getAttribute('aria-label') || '').startsWith('What if this were different'))
  if (btn) btn.click()
})
await p.waitForTimeout(900) // give animation full time
await p.screenshot({ path: 'screenshots/tappable-sheet-full.png', fullPage: false })

await ctx.close(); await b.close()
console.log('done')
