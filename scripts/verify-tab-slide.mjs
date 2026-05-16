// Verify MyMoney body re-keys on viewMode change (sw-tab-slide cascade).
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => { if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(m.text()) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

// Get sw-tab-slide count before
const before = await p.evaluate(() => {
  const slides = document.querySelectorAll('.sw-tab-slide')
  return { count: slides.length, viewMode: slides[0]?.getAttribute('data-react-key') }
})
console.log('before:', before)

// Click "Future" view mode in X28TopBar
const clicked = await p.evaluate(() => {
  // Find X28TopBar mode buttons — they have specific text "Today/Future/Plan/What if"
  const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Future')
  btn?.click()
  return !!btn
})
console.log('clicked Future:', clicked)
await p.waitForTimeout(500)

// Re-check
const after = await p.evaluate(() => {
  const slides = document.querySelectorAll('.sw-tab-slide')
  // Try to find the eyebrow that hints at active mode
  const eyebrow = [...document.querySelectorAll('*')].find(el => /variance overlay active/i.test(el.innerText || ''))
  return {
    count: slides.length,
    modeHint: eyebrow?.innerText || '(none)',
    bodyHasNW: /£727k|£0/.test(document.body.innerText), // basic sanity check
  }
})
console.log('after Future click:', after)

console.log('\nerrors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
