import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1100)
await p.screenshot({ path: 'screenshots/tappable-01-hero.png', fullPage: false })

// Count what-if triggers (ARIA-labelled buttons starting "What if this were different")
const triggerCount = await p.evaluate(() => {
  return [...document.querySelectorAll('button[aria-label]')]
    .filter(b => (b.getAttribute('aria-label') || '').startsWith('What if this were different')).length
})
console.log(`what-if triggers on screen: ${triggerCount}`)

// Click the first trigger to open the sheet
const opened = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button[aria-label]')]
    .find(b => (b.getAttribute('aria-label') || '').startsWith('What if this were different'))
  if (!btn) return false
  btn.click()
  return true
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/tappable-02-sheet-open.png', fullPage: false })

const sheetVisible = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    hasWhatIf: /What if\?/i.test(text),
    hasAskSonu: /Ask Sonu/i.test(text),
    hasTweakScenario: /Tweak in scenario mode/i.test(text),
  }
})

console.log(JSON.stringify({ opened, sheetVisible }, null, 2))
console.log(errs.length === 0 ? 'NO ERRORS' : `ERRORS:\n${errs.slice(0,5).join('\n')}`)
await ctx.close(); await b.close()
