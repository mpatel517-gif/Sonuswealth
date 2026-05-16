import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

async function drillInto(persona, category) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  // Find the CategoryTile whose label matches and click its "View detail" link
  const opened = await p.evaluate((cat) => {
    // CategoryTiles are <div role=button> or sw-pressable wrappers. Find by
    // the category label rendered inside (e.g. "PENSIONS").
    const tiles = [...document.querySelectorAll('.sw-pressable')]
    const tile = tiles.find(t => {
      const labelEl = [...t.querySelectorAll('div,span')]
        .find(e => (e.textContent||'').trim().toUpperCase() === cat.toUpperCase())
      return !!labelEl
    })
    if (!tile) return 'tile-not-found'
    // Click "View detail" if present, else click the tile body
    const view = [...tile.querySelectorAll('button,a')]
      .find(b => /view detail|drill/i.test(b.textContent || ''))
    if (view) { view.click(); return 'view-detail' }
    tile.click()
    return 'tile-click'
  }, category)
  await p.waitForTimeout(800)
  return opened
}

const results = []
const cases = [
  ['pensions',    'PENSIONS',              { taxBlock: /Tax treatment.*Pension/i, schemeQuality: /Scheme quality|Defaqto rating|FSCS/i, der: /Drawdown efficiency/i }],
  ['property',    'PROPERTY',              { mapStub: /Map preview|sold-price|drive-time/i, twoBlocks: /Main residence/i, pprChip: /Private Residence Relief/i }],
  ['investments', 'SAVINGS & INVESTMENTS', { taxBlock: /Tax treatment by wrapper/i, sectorStub: /Sector breakdown.*currency|Global equity/i, askSonu: /Ask Sonu about this/i }],
  ['business',    'BUSINESS',              { taxBlock: /Tax treatment.*Business/i, activityStub: /SIC code|Filed accounts|Sector trend/i }],
  ['protection',  'PROTECTION',            { claimsStub: /Provider quality|claims paid|Defaqto/i }],
]

for (const [persona, label, patterns] of cases) {
  const opened = await drillInto('mrt', label)
  const r = { drill: persona, opened }
  const text = await p.evaluate(() => document.body.innerText)
  for (const [k, re] of Object.entries(patterns)) r[k] = re.test(text)
  await p.screenshot({ path: `screenshots/drill-${persona}.png`, fullPage: false })
  results.push(r)
}

console.log(JSON.stringify(results, null, 2))
console.log(`\nErrors: ${errs.length}`)
if (errs.length) console.log(errs.slice(0, 5).join('\n'))

await ctx.close(); await b.close()
