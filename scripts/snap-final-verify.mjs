import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE [${m.location()?.url?.split('/').pop()}]: ${m.text().slice(0,180)}`) })

const results = []

// 1. Smoke check all 6 personas — both themes — for console errors
for (const persona of ['mrt','a','b','c','d','e']) {
  for (const theme of ['dark','light']) {
    await p.goto(`http://localhost:5173/?demo=${persona}&theme=${theme}&tab=money`, { waitUntil: 'networkidle' })
    await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
    await p.waitForTimeout(900)
  }
}

// 2. Mr T MyMoney — verify all new surfaces
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const moneyFindings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    taxEfficiency: /Tax efficiency/i.test(text),
    cushion: /Cushion/i.test(text) && /(strong|comfortable|tight|stretched)/i.test(text),
    ebr: /p \/ £/i.test(text),
    whatIfTriggers: [...document.querySelectorAll('button[aria-label]')]
      .filter(b => (b.getAttribute('aria-label') || '').startsWith('What if this were different')).length,
    wrapperBar: /wrapper composition/i.test(text.toLowerCase()),
  }
})
results.push({ surface: 'MyMoney hero', ...moneyFindings })

// 3. Investments drill
await p.evaluate(() => {
  const tiles = [...document.querySelectorAll('button, [role=button], .sw-pressable')]
  const inv = tiles.find(t => /SAVINGS & INVESTMENTS/i.test((t.textContent || '')) )
  if (inv) inv.click()
})
await p.waitForTimeout(800)
const invFindings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    taxBlock: /Tax treatment by wrapper/i.test(text),
    sectorStub: /Sector breakdown.*currency/i.test(text) || /Global equity/i.test(text),
    askSonuStub: /Ask Sonu about this/i.test(text),
  }
})
results.push({ surface: 'Investments drill', ...invFindings })
await p.evaluate(() => {
  const back = [...document.querySelectorAll('button')].find(b => /^←?\s*Back/i.test(b.textContent || ''))
  if (back) back.click()
})
await p.waitForTimeout(400)

// 4. Property drill
await p.evaluate(() => {
  const tiles = [...document.querySelectorAll('button, [role=button], .sw-pressable')]
  const prop = tiles.find(t => /^PROPERTY/.test((t.textContent || '').trim()))
  if (prop) prop.click()
})
await p.waitForTimeout(800)
const propFindings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    twoTaxBlocks: /Main residence/i.test(text) && /Buy-to-let/i.test(text),
    mapStub: /Map preview.*sold-price.*comparables/i.test(text),
    pprChip: /Private Residence Relief/i.test(text),
  }
})
results.push({ surface: 'Property drill', ...propFindings })
await p.evaluate(() => {
  const back = [...document.querySelectorAll('button')].find(b => /^←?\s*Back/i.test(b.textContent || ''))
  if (back) back.click()
})
await p.waitForTimeout(400)

// 5. Pensions drill
await p.evaluate(() => {
  const tiles = [...document.querySelectorAll('button, [role=button], .sw-pressable')]
  const pens = tiles.find(t => /^PENSIONS/.test((t.textContent || '').trim()))
  if (pens) pens.click()
})
await p.waitForTimeout(800)
const pensFindings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    taxBlock: /Tax treatment.*Pension wrapper/i.test(text),
    schemeQualityStub: /Scheme quality.*charges/i.test(text) || /Defaqto rating/i.test(text),
    derLine: /Drawdown efficiency/i.test(text),
  }
})
results.push({ surface: 'Pension drill', ...pensFindings })

console.log('\n=== Final Verification ===')
console.log(JSON.stringify(results, null, 2))
console.log(`\nConsole errors: ${errs.length}`)
if (errs.length > 0) console.log(errs.slice(0, 8).join('\n'))

await ctx.close(); await b.close()
