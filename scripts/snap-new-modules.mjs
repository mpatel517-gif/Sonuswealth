// Snap IFAPractice + DecisionEngine flows via Dashboard More menu.
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

await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

// Open More menu
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '⋯')
  if (btn) btn.click()
})
await p.waitForTimeout(400)

// Click "IFA Practice"
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /IFA Practice/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(600)
await expandScroll()
await p.screenshot({ path: 'screenshots/ifa-practice-roster.png', fullPage: true })
console.log('✓ IFA Practice roster')

// Click first client (Bruce Wayne)
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Bruce Wayne/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/ifa-adviser-mode.png', fullPage: true })
console.log('✓ IFA adviser mode preview')

// Reload and go to DecisionEngine
await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '⋯')
  if (btn) btn.click()
})
await p.waitForTimeout(400)

await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Decision Engine/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(500)
await p.screenshot({ path: 'screenshots/decision-step-1.png', fullPage: false })
console.log('✓ Decision step 1')

// Pick Property + advance to step 4 (Decision Wheel)
async function advance() {
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /^Context|^Options|^Weights|^Ranked|^Stress|^Commit/.test((b.innerText || '').trim()))
    if (btn && !btn.disabled) btn.click()
  })
  await p.waitForTimeout(350)
}

// Click Property tile
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Property: keep, sell, or let/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(300)

await advance()  // → Context
await advance()  // → Options
await advance()  // → Weights (Decision Wheel)
await expandScroll()
await p.screenshot({ path: 'screenshots/decision-wheel.png', fullPage: true })
console.log('✓ Decision Wheel (step 4)')

await advance()  // → Ranked
await expandScroll()
await p.screenshot({ path: 'screenshots/decision-ranked.png', fullPage: true })
console.log('✓ Ranked paths (step 5)')

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 10).join('\n'))
} else {
  console.log('\nNo errors.')
}

await b.close()
