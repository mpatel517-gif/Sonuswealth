// Verify per-asset L3 overlay opens from Investments / Property / Liabilities drills.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
p.on('console', m => {
  if (m.type() === 'error' && !/api\.anthropic\.com|net::ERR_FAILED/.test(m.text())) {
    errs.push(`console: ${m.text().slice(0, 200)}`)
  }
})

async function openDrillByLabel(persona, ariaSubstring) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  return p.evaluate((needle) => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || '').includes(needle))
    if (!btn) return false
    btn.click()
    return true
  }, ariaSubstring)
}

// ── Investments ────────────────────────────────────────────────────────────
console.log('\n── Investments drill ──')
const invOpened = await openDrillByLabel('mrt', 'Savings & Investments')
console.log('drill open:', invOpened)
await p.waitForTimeout(1500)
const invRow = await p.evaluate(() => {
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /£/.test(b.innerText) && /›/.test(b.innerText) && !/View detail/i.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length, sample: buttons[0].innerText.slice(0, 100) }
})
console.log('row click:', invRow)
await p.waitForTimeout(800)
const invL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
  hasUpdateButton: !![...document.querySelectorAll('button')].find(b => /Update value/i.test(b.innerText)),
}))
console.log('L3 overlay:', invL3)

// Test edit flow
const editStart = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Update value/i.test(b.innerText))
  btn?.click()
  return !!btn
})
await p.waitForTimeout(300)
const editSaved = await p.evaluate(() => {
  const input = document.querySelector('input[type="number"]')
  if (!input) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, '99999')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const save = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Save')
  save?.click()
  return !!save
})
await p.waitForTimeout(400)
const editConfirmed = await p.evaluate(() => /Value updated/i.test(document.body.textContent))
console.log('edit→save→confirm:', { editStart, editSaved, editConfirmed })

// ── Property ──────────────────────────────────────────────────────────────
console.log('\n── Property drill ──')
const propOpened = await openDrillByLabel('mrt', 'Property')
console.log('drill open:', propOpened)
await p.waitForTimeout(1500)
const propRow = await p.evaluate(() => {
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /View details/i.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length }
})
console.log('View details click:', propRow)
await p.waitForTimeout(800)
const propL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
}))
console.log('Property L3:', propL3)

// ── Liabilities ───────────────────────────────────────────────────────────
console.log('\n── Liabilities drill ──')
const liabOpened = await openDrillByLabel('mrt', 'Liabilities')
console.log('drill open:', liabOpened)
await p.waitForTimeout(1500)
const liabRow = await p.evaluate(() => {
  // Loan row labels are sw-press buttons with › and NOT containing View
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /›/.test(b.innerText) && !/View detail|View details|Update/.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length }
})
console.log('liability row click:', liabRow)
await p.waitForTimeout(800)
const liabL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
}))
console.log('Liability L3:', liabL3)

console.log('\nconsole errors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
