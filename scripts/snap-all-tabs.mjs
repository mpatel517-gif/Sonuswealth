// Snap all 6 tabs for persona Bruce — above-the-fold AND full-scroll.
// Used to map current visible state vs spec before P0/P1 redesigns.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 480, height: 900 },
  deviceScaleFactor: 2,
})
const p = await ctx.newPage()

const TABS = [
  { id: 'home',  label: 'home' },
  { id: 'money', label: 'money' },
  { id: 'flow',  label: 'cashflow' },
  { id: 'tax',   label: 'tax' },
  { id: 'risk',  label: 'risk' },
  { id: 'plan',  label: 'timeline' },
]

async function expandScroll() {
  await p.evaluate(() => {
    document.querySelectorAll('div').forEach(d => {
      const s = getComputedStyle(d)
      if (s.overflow === 'hidden' && s.flex.includes('1')) {
        d.style.overflow = 'visible'
        d.style.height = 'auto'
        d.style.maxHeight = 'none'
      }
    })
    document.documentElement.style.height = 'auto'
    document.body.style.height = 'auto'
    document.body.style.overflow = 'visible'
  })
  await p.waitForTimeout(400)
}

for (const t of TABS) {
  await p.goto(`http://localhost:5173/?demo=a&tab=${t.id}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  // ATF first
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.screenshot({ path: `screenshots/tab-${t.label}-atf.png`, fullPage: false })
  // Full
  await expandScroll()
  await p.screenshot({ path: `screenshots/tab-${t.label}-full.png`, fullPage: true })
  console.log(`✓ ${t.label}`)
}

await b.close()
