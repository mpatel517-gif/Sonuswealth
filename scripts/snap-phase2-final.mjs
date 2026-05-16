// Final Phase 2 snap: Home + MyMoney + Cashflow + Timeline at 480/820/1440 dark theme.
import { chromium } from 'playwright'

const b = await chromium.launch()
const errors = []

const TABS = [
  { id: 'home',  label: 'home' },
  { id: 'money', label: 'money' },
  { id: 'flow',  label: 'cashflow' },
  { id: 'plan',  label: 'timeline' },
]
const VIEWPORTS = [
  { w: 480,  label: 'mobile' },
  { w: 1440, label: 'laptop' },
]

for (const vp of VIEWPORTS) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`[${vp.label}] ${e.message}`))
  p.on('console', m => { if (m.type() === 'error') errors.push(`[${vp.label} console] ${m.text().slice(0, 200)}`) })

  for (const t of TABS) {
    await p.goto(`http://localhost:5173/?demo=a&tab=${t.id}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(2200)
    await p.screenshot({ path: `screenshots/phase2-${vp.label}-${t.label}.png`, fullPage: false })
    console.log(`✓ ${vp.label} ${t.label}`)
  }
  await ctx.close()
}

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('\nNo errors.')
}
await b.close()
