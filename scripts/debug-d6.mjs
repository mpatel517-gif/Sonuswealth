import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button[role="tab"]')]
    .find(b => (b.innerText || '').trim().toLowerCase() === 'bars')
  if (btn) btn.click()
})
await p.waitForTimeout(400)

const clicked = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('div.sw-press')]
  const target = rows.find(r => /Dependency Exposure/.test(r.innerText || ''))
  if (target) { target.click(); return true }
  return false
})
console.log('Clicked dim row:', clicked)
await p.waitForTimeout(500)

const found = await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const u = btns.find(b => /Update answers/.test(b.innerText || ''))
  return u ? { text: u.innerText, visible: u.offsetParent !== null, rect: u.getBoundingClientRect().toJSON() } : null
})
console.log('Button found:', JSON.stringify(found))

// Look at all buttons inside the sheet panel
const allBtns = await p.evaluate(() => {
  const panel = document.querySelector('.sheet-panel')
  if (!panel) return '(no .sheet-panel found)'
  return [...panel.querySelectorAll('button')]
    .map(b => `[${b.tagName}] ${(b.innerText || '').slice(0, 60)} visible=${b.offsetParent !== null}`)
})
console.log('Sheet buttons:')
console.log(allBtns)

await b.close()
