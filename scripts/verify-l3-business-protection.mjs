import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
p.on('console', m => {
  if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) {
    errs.push(`console: ${m.text().slice(0, 200)}`)
  }
})

async function openDrillByLabel(persona, ariaSubstring) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  return p.evaluate((needle) => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || '').includes(needle))
    btn?.click()
    return !!btn
  }, ariaSubstring)
}

// ── Business drill ───────────────────────────────────────────────────────
console.log('\n── Business drill ──')
const bizOpened = await openDrillByLabel('mrt', 'Business Assets')
console.log('drill open:', bizOpened)
await p.waitForTimeout(1500)
const bizRows = await p.evaluate(() => {
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /View details/i.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length, sample: buttons[0].innerText.slice(0, 80) }
})
console.log('View details:', bizRows)
await p.waitForTimeout(900)
const bizL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
}))
console.log('Business L3:', bizL3)

// ── Protection drill ────────────────────────────────────────────────────
console.log('\n── Protection drill ──')
const protOpened = await openDrillByLabel('mrt', 'Protection')
console.log('drill open:', protOpened)
await p.waitForTimeout(1500)
// Click first policy row (Life assurance — term)
const protRow = await p.evaluate(() => {
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /Life assurance|Critical illness|Income protection|Private medical|Relevant life|Keyperson/i.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length, sample: buttons[0].innerText.slice(0, 100) }
})
console.log('Policy click:', protRow)
await p.waitForTimeout(900)
const protL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
}))
console.log('Protection L3 (policy):', protL3)

// Also try a general-insurance row
await openDrillByLabel('mrt', 'Protection')
await p.waitForTimeout(1500)
const giRow = await p.evaluate(() => {
  const buttons = [...document.querySelectorAll('button.sw-press')]
    .filter(b => /home contents|car|travel|professional indemnity|cyber/i.test(b.innerText))
  if (buttons.length === 0) return { count: 0 }
  buttons[0].click()
  return { count: buttons.length, sample: buttons[0].innerText.slice(0, 100) }
})
console.log('GI/BI click:', giRow)
await p.waitForTimeout(900)
const giL3 = await p.evaluate(() => ({
  hasTaxedHeader: /How this is taxed/i.test(document.body.textContent),
  hasProvenanceHeader: /Where this came from/i.test(document.body.textContent),
}))
console.log('Protection L3 (GI):', giL3)

console.log('\nconsole errors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
