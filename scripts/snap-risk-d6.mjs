// Snap the Risk D6 questionnaire flow:
// Risk tab → tap Dependency Exposure dim → DimSheet → tap "Update answers" → questionnaire.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

// Switch to Bars view so DimRow rows are clickable
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button[role="tab"]')]
    .find(b => (b.innerText || '').trim().toLowerCase() === 'bars')
  if (btn) btn.click()
})
await p.waitForTimeout(400)

// Click Dependency Exposure row
await p.evaluate(() => {
  const rows = [...document.querySelectorAll('div.sw-press')]
  const target = rows.find(r => /Dependency Exposure/.test(r.innerText || ''))
  if (target) target.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/risk-d6-dimsheet.png', fullPage: false })

// Click "Update answers" button to open questionnaire
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /Update answers/.test(b.innerText || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/risk-d6-q1.png', fullPage: false })

// Pick first option then advance
async function pickAndNext() {
  await p.evaluate(() => {
    const opts = [...document.querySelectorAll('button.sw-press')]
      .filter(b => b.offsetParent !== null && /Yes/.test(b.innerText || ''))
    if (opts[0]) opts[0].click()
  })
  await p.waitForTimeout(250)
  await p.evaluate(() => {
    const next = [...document.querySelectorAll('button')]
      .find(b => /Next/.test(b.innerText || ''))
    if (next && !next.disabled) next.click()
  })
  await p.waitForTimeout(250)
}

await pickAndNext()
await p.screenshot({ path: 'screenshots/risk-d6-q2.png', fullPage: false })

await pickAndNext()
await p.screenshot({ path: 'screenshots/risk-d6-q3.png', fullPage: false })

await pickAndNext()
await pickAndNext()
await p.screenshot({ path: 'screenshots/risk-d6-q5.png', fullPage: false })

if (errors.length) {
  console.log('ERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('No errors.')
}

await b.close()
