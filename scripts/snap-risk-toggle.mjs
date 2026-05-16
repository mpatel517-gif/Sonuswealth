// Snap Risk tab in each of the 3 toggle views (bars default, radar, orbit).
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)

async function expandScroll() {
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
}

async function tapView(name) {
  // Click the toggle tab with text matching the view name
  await p.evaluate((n) => {
    const btns = [...document.querySelectorAll('button[role="tab"]')]
    const t = btns.find(b => (b.innerText || '').trim().toLowerCase() === n)
    if (t) t.click()
  }, name)
  await p.waitForTimeout(400)
}

// Default (bars)
await expandScroll()
await p.screenshot({ path: 'screenshots/risk-view-bars.png', fullPage: true })
console.log('✓ bars')

await tapView('radar')
await p.screenshot({ path: 'screenshots/risk-view-radar.png', fullPage: true })
console.log('✓ radar')

await tapView('orbit')
await p.screenshot({ path: 'screenshots/risk-view-orbit.png', fullPage: true })
console.log('✓ orbit')

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('\nNo errors.')
}

await b.close()
