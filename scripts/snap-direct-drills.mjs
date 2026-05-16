import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

// Direct test each drill in fresh page loads to avoid navigation flakiness.

async function openTile(persona, label) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  return await p.evaluate((needle) => {
    const cards = [...document.querySelectorAll('.sw-pressable, [role=button], button, div')]
      .filter(el => el.className && typeof el.className === 'string')
    const match = cards.find(c => {
      const t = (c.textContent || '').trim()
      return t.toUpperCase().includes(needle.toUpperCase()) && c.offsetHeight > 100
    })
    if (!match) return false
    match.click()
    return true
  }, label)
}

async function check(name, persona, label, patterns) {
  const opened = await openTile(persona, label)
  await p.waitForTimeout(800)
  const result = { name, persona, opened }
  for (const [k, re] of Object.entries(patterns)) {
    result[k] = re.test(await p.evaluate(() => document.body.innerText))
  }
  const safeName = name.toLowerCase().replace(/\s+/g, '-')
  await p.screenshot({ path: `screenshots/final-${safeName}.png`, fullPage: false })
  return result
}

const results = []
results.push(await check('property',    'mrt', 'PROPERTY', {
  mapStub: /Map preview|sold-price|drive-time/i,
  pprChip: /Private Residence Relief/i,
  twoBlocks: /Main residence/i,
}))
results.push(await check('pensions',    'mrt', 'PENSIONS', {
  taxBlock: /Tax treatment.*Pension/i,
  schemeQuality: /Scheme quality|Defaqto|FSCS/i,
  der: /Drawdown efficiency/i,
}))
results.push(await check('business',    'mrt', 'BUSINESS', {
  taxBlock: /Tax treatment.*Business/i,
  activityStub: /SIC code|Filed accounts|Sector trend/i,
}))
results.push(await check('protection',  'mrt', 'PROTECTION', {
  claimsStub: /claims.paid|Claims-paid|Defaqto|provider quality/i,
}))

console.log(JSON.stringify(results, null, 2))
console.log(`\nErrors: ${errs.length}`)
if (errs.length) console.log(errs.slice(0, 5).join('\n'))

await ctx.close(); await b.close()
