import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
p.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
p.on('console', m => {
  if (m.type() === 'error' && !/api\.anthropic\.com|net::ERR_FAILED/.test(m.text())) {
    errs.push(`console: ${m.text().slice(0, 200)}`)
  }
})

async function pivot(persona, pivotId) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  // Find the PivotToggle group — it has a "Balance sheet" button. Click pivot button INSIDE the same group.
  const clicked = await p.evaluate((pid) => {
    const labels = { income: 'Income', insurance: 'Insurance', bonds: 'Bonds' }
    const target = labels[pid]
    // Locate the toggle row that contains "Balance sheet"
    const bsBtn = [...document.querySelectorAll('button')]
      .find(b => b.innerText.trim() === 'Balance sheet')
    if (!bsBtn?.parentElement) return false
    const sibs = [...bsBtn.parentElement.querySelectorAll('button')]
    const tgt = sibs.find(b => b.innerText.trim() === target)
    tgt?.click()
    return !!tgt
  }, pivotId)
  await p.waitForTimeout(1000)
  return { clicked, text: await p.evaluate(() => document.body.innerText) }
}

const inc = await pivot('mrt', 'income')
console.log('Income clicked:', inc.clicked,
  '| hasEachPound:', inc.text.includes('Where each pound of your income lands'))

const ins = await pivot('mrt', 'insurance')
console.log('Insurance clicked:', ins.clicked,
  '| hasProtectionGaps:', ins.text.includes('Protection gaps'),
  '| hasIfYouDie:', ins.text.includes('If you die'))

const bonds = await pivot('mrt', 'bonds')
console.log('Bonds clicked:', bonds.clicked,
  '| hasHero:', bonds.text.includes('Bonds — gilts'),
  '| hasMaturity:', bonds.text.includes('When the bonds come due'))

console.log('\nerrors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
