// End-to-end test: simulate adding a new BTL via the bucket flow.
// Verifies that ASSET_VALUE_UPDATED is actually reflected in the entity —
// previously this was broken (reducer didn't handle the event).
import { chromium } from 'playwright'

const b = await chromium.launch()
const errors = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })

// 1. Load Bruce (no BTL initially in some persona fixtures — gives a clean test)
await p.goto('http://localhost:5173/?demo=a&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

// 2. Snap before
await p.screenshot({ path: 'screenshots/add-btl-01-before.png', fullPage: true })
console.log('✓ snapped before-add state')

// Read the Property tile value before
const propertyBefore = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('div')]
    .filter(d => d.className && d.className.includes && d.className.includes('sw-pressable'))
  for (const c of cards) {
    if (c.textContent.includes('PROPERTY') && /£/.test(c.textContent)) {
      const match = c.textContent.match(/£[\d.km,]+/i)
      return match ? match[0] : null
    }
  }
  return null
})
console.log('Property tile value before:', propertyBefore)

// 3. Click the floating add button (bottom-right + button)
const fabClicked = await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
    .filter(b => b.getAttribute('aria-label')?.toLowerCase().includes('add'))
  if (btns.length === 0) return false
  btns[0].click()
  return true
})
if (!fabClicked) {
  console.log('✗ FAB add button not found — trying tile + Add')
  // Try clicking the + Add on the Property tile
  await p.evaluate(() => {
    const cards = [...document.querySelectorAll('div')]
      .filter(d => d.className && d.className.includes && d.className.includes('sw-pressable'))
    for (const c of cards) {
      if (c.textContent.includes('PROPERTY')) {
        const addBtn = [...c.querySelectorAll('button')].find(b => b.textContent.includes('+ Add'))
        if (addBtn) { addBtn.click(); return }
      }
    }
  })
}
await p.waitForTimeout(700)
await p.screenshot({ path: 'screenshots/add-btl-02-sheet-open.png', fullPage: true })
console.log('✓ snapped sheet-open')

// 4. Pick Property category — scoped to the open sheet panel
const catClicked = await p.evaluate(() => {
  const sheet = document.querySelector('.sheet-panel')
  if (!sheet) return 'no-sheet'
  const btns = [...sheet.querySelectorAll('button')]
  const propBtn = btns.find(b => {
    const t = b.textContent.replace(/\s+/g, ' ').trim()
    return t.startsWith('Property') && /\d+ types/.test(t)
  })
  if (!propBtn) return `not-found:${btns.map(b => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)).join(' | ')}`
  propBtn.click()
  return 'clicked'
})
console.log('category click result:', catClicked)
await p.waitForTimeout(700)

// 5. Pick BTL — scoped to the sheet panel
await p.evaluate(() => {
  const sheet = document.querySelector('.sheet-panel')
  if (!sheet) return
  const btns = [...sheet.querySelectorAll('button')]
  const btl = btns.find(b => b.textContent.includes('Buy-to-let'))
  if (btl) btl.click()
})
await p.waitForTimeout(700)
await p.screenshot({ path: 'screenshots/add-btl-03-fields.png', fullPage: true })
console.log('✓ snapped fields step')

// 6. Fill the required fields
await p.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')]
  // Find inputs by their label sibling. Inputs are ordered same as required[].
  const values = {
    'Short label': 'Test Brighton BTL',
    'Address': '99 Test Lane · Brighton BN1',
    'Value (£)': '275000',
    'Purchase date': '2023-06-01',
    'Purchase price (£)': '240000',
    'Monthly rent (£)': '1450',
  }
  for (const input of inputs) {
    // walk up to find the eyebrow label sibling
    let label = ''
    const wrapper = input.parentElement
    if (wrapper) {
      const lbl = wrapper.querySelector('div')
      if (lbl) label = lbl.textContent.trim()
    }
    if (values[label]) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeSetter.call(input, values[label])
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
})
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/add-btl-04-filled.png', fullPage: true })

// 7. Submit
await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const submitBtn = btns.find(b => b.textContent.toLowerCase().includes('add to property'))
  if (submitBtn) submitBtn.click()
})
await p.waitForTimeout(1500)
await p.screenshot({ path: 'screenshots/add-btl-05-after-submit.png', fullPage: true })

// 8. Read the Property tile value after
const propertyAfter = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('div')]
    .filter(d => d.className && d.className.includes && d.className.includes('sw-pressable'))
  for (const c of cards) {
    if (c.textContent.includes('PROPERTY') && /£/.test(c.textContent)) {
      const match = c.textContent.match(/£[\d.km,]+/i)
      return match ? match[0] : null
    }
  }
  return null
})
console.log('Property tile value after:', propertyAfter)

const passed = propertyBefore !== propertyAfter
console.log(`\n${passed ? '✓ PASS' : '✗ FAIL'} — entity updated after add: ${propertyBefore} → ${propertyAfter}`)

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 8).join('\n'))
}
await ctx.close()
await b.close()
