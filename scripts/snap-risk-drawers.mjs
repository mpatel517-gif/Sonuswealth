// Snap the rebuilt Risk tab: open all 5 RevealCard drawers, capture full page +
// console errors. Verifies the drawer restructure, the investing-risk section,
// and the attitude history render for persona A.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

// Dismiss the cookie consent banner so it doesn't overlay the drawers.
await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const accept = btns.find(b => /accept all|strictly necessary/i.test(b.innerText || ''))
  if (accept) accept.click()
})
await p.waitForTimeout(500)

// Expand every collapsed RevealCard drawer (role=button, aria-expanded=false).
const opened = await p.evaluate(() => {
  const heads = [...document.querySelectorAll('[role="button"][aria-expanded="false"]')]
  heads.forEach(h => h.click())
  return heads.map(h => (h.innerText || '').split('\n')[0].trim())
})
await p.waitForTimeout(800)

// Report which drawer titles are present.
const titles = await p.evaluate(() =>
  [...document.querySelectorAll('[role="button"][aria-expanded]')]
    .map(h => (h.innerText || '').split('\n')[0].trim())
)

await p.screenshot({ path: 'screenshots/risk-drawers-all-open.png', fullPage: true })
console.log('✓ snapped risk-drawers-all-open.png')
console.log('Drawer titles:', JSON.stringify(titles))
console.log('Opened on this pass:', JSON.stringify(opened))

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 15).join('\n'))
} else {
  console.log('\nNo console/page errors.')
}

await b.close()
