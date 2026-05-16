// Snap full Home — both themes — by extending the inner scroll container
// before fullPage so the entire scrolled content is captured.
//
// Dashboard wraps screen content in `<div style={{ flex:1, overflow:'hidden' }}>`.
// Playwright's fullPage only sees document.scrollingElement.scrollHeight which
// equals viewport when the body itself isn't scrolling. To capture everything,
// we temporarily lift overflow on the wrapper so the body grows.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 480, height: 900 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()

await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

async function expandScroll() {
  await p.evaluate(() => {
    // Walk up the tree and remove overflow:hidden on the inner home wrapper
    document.querySelectorAll('div').forEach(d => {
      const s = getComputedStyle(d)
      if (s.overflow === 'hidden' && s.flex.includes('1')) {
        d.style.overflow = 'visible'
        d.style.height = 'auto'
        d.style.maxHeight = 'none'
      }
    })
    // Root wrapper: allow body to scroll
    document.documentElement.style.height = 'auto'
    document.body.style.height = 'auto'
    document.body.style.overflow = 'visible'
  })
  await p.waitForTimeout(400)
}

async function snap(name) {
  await expandScroll()
  await p.screenshot({ path: `screenshots/home-${name}-full.png`, fullPage: true })
  // Also viewport-only above-the-fold
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.waitForTimeout(200)
  await p.screenshot({ path: `screenshots/home-${name}-atf.png`, fullPage: false })
  console.log(`✓ ${name} saved (atf + full)`)
}

// Dark first (default)
await snap('dark')

// Switch to light
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(2000)
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
  if (btn) btn.click()
})
await p.waitForTimeout(800)
await snap('light')

await b.close()
