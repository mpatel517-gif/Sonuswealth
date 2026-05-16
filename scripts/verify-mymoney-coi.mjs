// Verify per-tile costOfInaction strings come from canonical coiForDomain.
// Looks for the engine-canonical phrases anywhere in the rendered MyMoney body.
import { chromium } from 'playwright'

const PERSONAS = ['mrt', 'a', 'b', 'c', 'd', 'e']
const PHRASES = {
  pensions:    'tax relief gone forever',
  investments: 'tax saved if you shelter',
  property:    'mortgage interest no longer fully offsets',
  business_p:  'Inheritance tax partially sheltered',
  business_f:  'Inheritance tax fully sheltered',
  protection:  'If you die today',
  liabilities: 'in interest while this debt runs',
  cash:        'in interest tax',
}
// Strings the old inline path produced — must NOT appear (proves removal).
const OLD = [
  "tax back is gone forever",            // old pensions
  "capital gains tax over 10 years",     // old investments
]

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`pageerror: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`) })

for (const persona of PERSONAS) {
  await p.goto(`http://localhost:5173/?demo=${persona}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const body = await p.evaluate(() => document.body.innerText)
  const present = Object.entries(PHRASES).filter(([, ph]) => body.includes(ph)).map(([k]) => k)
  const leaked  = OLD.filter(ph => body.includes(ph))
  console.log(`${persona.padEnd(4)} → engine phrases found: [${present.join(', ') || 'none'}]`)
  if (leaked.length) console.log(`       OLD INLINE LEAKED: ${leaked.join(' · ')}`)
}

console.log('\nerrors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
