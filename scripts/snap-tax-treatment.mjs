// Verifies spec §2.3 tax-treatment block surfaces in each drill panel.
// Tests both Mr T (full domains) and Bruce (sparse) across both themes.
import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0,160)}`) })

async function checkPanel(persona, theme, panelName, drillSel) {
  await p.goto(`http://localhost:5173/?demo=${persona}&theme=${theme}&tab=money`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)

  // Click the drill target inside the tile labelled panelName
  const opened = await p.evaluate((needle) => {
    const tiles = [...document.querySelectorAll('.sw-pressable, button, [role=button]')]
    const match = tiles.find(t => (t.textContent || '').toUpperCase().includes(needle.toUpperCase()))
    if (!match) return false
    match.click()
    return true
  }, panelName)
  if (!opened) return { persona, theme, panelName, error: 'tile-not-found' }
  await p.waitForTimeout(900)

  const findings = await p.evaluate(() => {
    const text = document.body.innerText
    return {
      hasTaxBlock: /Tax treatment/i.test(text),
      hasIncomeTax: /Income tax/i.test(text),
      hasCgt: /Capital gains|CGT/i.test(text),
      hasIht: /Inheritance|IHT|estate/i.test(text),
      hasUnresolvedBadge: /NEEDS WRAPPER/i.test(text),
    }
  })

  await p.screenshot({ path: `screenshots/tax-${persona}-${theme}-${panelName.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: false })

  // Close drill
  await p.evaluate(() => {
    const back = [...document.querySelectorAll('button')].find(b => /back|close|×/i.test(b.textContent || b.getAttribute('aria-label') || ''))
    if (back) back.click()
  })
  await p.waitForTimeout(400)
  return { persona, theme, panelName, ...findings }
}

const results = []
for (const persona of ['mrt', 'a']) {
  for (const theme of ['dark', 'light']) {
    results.push(await checkPanel(persona, theme, 'INVESTMENTS', '+ Add'))
    results.push(await checkPanel(persona, theme, 'PROPERTY', '+ Add'))
    results.push(await checkPanel(persona, theme, 'BUSINESS', '+ Add'))
  }
}

console.log(JSON.stringify(results, null, 2))
if (errors.length) console.log('ERRORS:', errors.slice(0,5).join(' | '))
await ctx.close(); await b.close()
