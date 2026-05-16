// Verify TappableNumber → Ask / Cashflow scenario routing
// Tests: in-app event path + URL-param bootstrap path.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`) })

// ── 1. In-app: TappableNumber → Ask sheet ──────────────────────────────────
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
// Click first ⚡ chip on the page (there are 13+ on MyMoney)
const sparked = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.getAttribute('aria-label')?.startsWith('What if'))
  if (btn) { btn.click(); return true } else return false
})
console.log('TappableNumber ⚡ found:', sparked)
await p.waitForTimeout(400)
// Click "Ask Sonu what happens" CTA in the sheet
const askClicked = await p.evaluate(() => {
  const a = [...document.querySelectorAll('a, button')]
    .find(el => /Ask Sonu what happens/i.test(el.innerText || ''))
  if (a) { a.click(); return true } else return false
})
console.log('Ask CTA clicked:', askClicked)
await p.waitForTimeout(900)
// Verify Ask sheet open + user message visible
const askOpen = await p.evaluate(() => {
  const body = document.body.innerText
  return {
    hasAskHeader: /Ask AI/i.test(body),
    hasUserQuestion: /What if|What happens|what if/i.test(body),
  }
})
console.log('Ask sheet state:', askOpen)

// ── 2. In-app: TappableNumber → Cashflow scenario ──────────────────────────
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.getAttribute('aria-label')?.startsWith('What if'))
  btn?.click()
})
await p.waitForTimeout(400)
await p.evaluate(() => {
  const a = [...document.querySelectorAll('a, button')]
    .find(el => /Tweak in scenario mode/i.test(el.innerText || ''))
  a?.click()
})
await p.waitForTimeout(900)
const cfState = await p.evaluate(() => {
  const body = document.body.innerText
  return {
    onCashflow: /Cashflow/i.test(body),
    hasModelingBanner: /Modeling/i.test(body),
    scenarioModeActive: !!document.querySelector('[aria-pressed="true"]')
      || /What if/i.test(body),
  }
})
console.log('Cashflow seed banner:', cfState)

// ── 3. Deep-link: URL ?askQ= → Ask sheet ───────────────────────────────────
await p.goto('http://localhost:5173/?demo=mrt&tab=money&askQ=What%20if%20my%20ISA%20doubled', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
const askDeep = await p.evaluate(() => {
  const body = document.body.innerText
  return {
    hasAskAi: /Ask AI/i.test(body),
    hasQuestion: /What if my ISA doubled/i.test(body),
  }
})
console.log('Ask deep-link:', askDeep)

// ── 4. Deep-link: URL cfTab=scenario&seed= → Cashflow scenario ─────────────
const seed = encodeURIComponent(JSON.stringify({ label: 'Pension headroom', current: 60000, proposed: 30000, formatted: '£60k', line: 'Engine seed test' }))
await p.goto(`http://localhost:5173/?demo=mrt&tab=flow&cfTab=scenario&seed=${seed}`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
const cfDeep = await p.evaluate(() => {
  const body = document.body.innerText
  return {
    onCashflow: /Cashflow/i.test(body),
    hasModelingBanner: /Modeling/i.test(body),
    hasSeedLabel: /Pension headroom/i.test(body),
    hasSeedLine: /Engine seed test/i.test(body),
  }
})
console.log('Cashflow deep-link:', cfDeep)

console.log('\nconsole errors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
