import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
p.on('console', m => { if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(m.text()) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

const before = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /\+\s+\d+\s+other open move/i.test(b.innerText))
  return { found: !!btn, label: btn?.innerText, aria: btn?.getAttribute('aria-expanded') }
})
console.log('before click:', before)

await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /\+\s+\d+\s+other open move/i.test(b.innerText))
  btn?.click()
})
await p.waitForTimeout(400)

const after = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => /(\+|Hide)\s+\d+\s+other open move/i.test(b.innerText))
  const list = document.getElementById('todays-other-moves')
  return {
    label: btn?.innerText,
    aria: btn?.getAttribute('aria-expanded'),
    listChildren: list?.children?.length || 0,
    listText: list?.innerText?.slice(0, 200) || '',
  }
})
console.log('after click:', after)

console.log('\nerrors:', errs.length)
errs.forEach(e => console.log('  ' + e))
await b.close()
