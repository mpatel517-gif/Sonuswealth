// Final session snap — capture key surfaces showing all P0/P1/P2/P3 work.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

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

// Home — full scroll, shows everything
await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)
await expandScroll()
await p.screenshot({ path: 'screenshots/final-home-dark.png', fullPage: true })
console.log('✓ final home (dark)')

// Switch to Plan mode to see cinema banner
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Plan')
  if (btn) btn.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/final-home-plan-mode.png', fullPage: false })
console.log('✓ final home (plan mode w/ cinema banner)')

// Switch to Scenario to see violet banner
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'Scenario')
  if (btn) btn.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/final-home-scenario-mode.png', fullPage: false })
console.log('✓ final home (scenario mode w/ cinema banner)')

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 10).join('\n'))
} else {
  console.log('\nNo errors.')
}

await b.close()
