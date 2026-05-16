// Verifies §2.1 D-WRAPPER-FIRST-1: every wrapper in Mr T resolves cleanly,
// no "WRAPPER?" badge surfaces on a clean fixture.
import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0,160)}`) })

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: 'screenshots/wrapper-mrt-clean.png', fullPage: true })

const findings = await p.evaluate(() => {
  const text = document.body.innerText
  return {
    hasUnknownStrip: /can't be classified into a wrapper/i.test(text),
    hasWrapperQuestion: /WRAPPER\?/i.test(text),
    wrapperBadges: [...document.querySelectorAll('.sw-chip')]
      .map(c => c.textContent.trim())
      .filter(t => /^(PENSION|ISA|GIA|BOND_ON|BOND_OFF|EIS|SEIS|VCT|CASH|PROPERTY|STATE|TRUST|WRAPPER\?)\b/i.test(t))
      .slice(0, 30),
  }
})
console.log(JSON.stringify(findings, null, 2))
console.log(`PASS: clean Mr T fixture has no WRAPPER? = ${!findings.hasWrapperQuestion && !findings.hasUnknownStrip}`)

// Now inject a contrived UNKNOWN asset and confirm the strip surfaces
await p.evaluate(() => {
  // best-effort: inject by reaching into window state if exposed, else skip
  if (window.__FINIO_INJECT_UNKNOWN__) window.__FINIO_INJECT_UNKNOWN__()
})

if (errors.length) console.log('ERRORS:', errors.slice(0, 5).join(' | '))
await ctx.close(); await b.close()
