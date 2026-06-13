// LIVE-PATH verification: commit a risk-perception answer and confirm the loop
// works — "Stated appetite" updates AND attitude history records a version.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)
await p.evaluate(() => {
  const a = [...document.querySelectorAll('button')].find(b => /accept all|strictly necessary/i.test(b.innerText || ''))
  if (a) a.click()
})
await p.waitForTimeout(400)

const clickByText = async (re) => p.evaluate((src) => {
  const rx = new RegExp(src, 'i')
  const el = [...document.querySelectorAll('button,[role="button"]')].find(b => rx.test(b.innerText || ''))
  if (el) { el.click(); return (el.innerText || '').slice(0, 40) }
  return null
}, re.source)

const sectionText = (id) => p.evaluate((sid) => {
  const sec = document.querySelector(`[aria-labelledby="rc-${sid}-title"]`)
  return sec ? (sec.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) : 'SECTION NOT FOUND'
}, id)

// Open the investing drawer + launch the questionnaire.
await clickByText(/the risk in my investing/i); await p.waitForTimeout(400)
const beforeAppetite = await sectionText('risk-investing')
await clickByText(/update your risk perception/i); await p.waitForTimeout(500)

// Answer the 3 questions (each selection auto-advances).
await clickByText(/Growth — I accept volatility/i); await p.waitForTimeout(400)
await clickByText(/10–20 years/i); await p.waitForTimeout(400)
await clickByText(/Hold — wait for recovery/i); await p.waitForTimeout(1000)

// Re-read the investing section after commit.
const afterAppetite = await sectionText('risk-investing')

// Open "How it's changed" and read attitude history.
await clickByText(/how it's changed/i); await p.waitForTimeout(500)
const history = await sectionText('risk-changed')
await p.screenshot({ path: 'screenshots/risk-loop-verify.png', fullPage: false })

console.log('BEFORE stated appetite :', beforeAppetite)
console.log('AFTER  stated appetite :', afterAppetite)
console.log('ATTITUDE history       :', history)
console.log(errors.length ? `\nERRORS:\n${errors.slice(0, 8).join('\n')}` : '\nNo errors.')
await b.close()
