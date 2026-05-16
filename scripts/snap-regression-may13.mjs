// Regression sweep — all 6 primary tabs × {dark, light} at 1440 laptop.
// Verifies the shared RevealCard re-theme + sw-tab-slide wrap + L3 overlay
// changes didn't break Home / Cashflow / Tax & Estate / Risk / Timeline.
import { chromium } from 'playwright'

const TABS = [
  { id: 'home',  label: 'home' },
  { id: 'money', label: 'money' },
  { id: 'flow',  label: 'cashflow' },
  { id: 'tax',   label: 'tax' },
  { id: 'risk',  label: 'risk' },
  { id: 'plan',  label: 'timeline' },
]
const THEMES = ['dark', 'light']
const PERSONA = 'mrt'

const b = await chromium.launch()
const summary = []
const errs = []

for (const theme of THEMES) {
  for (const t of TABS) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    const tabErrs = []
    p.on('pageerror', e => tabErrs.push(`pageerror: ${e.message}`))
    p.on('console', m => {
      if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) {
        tabErrs.push(`console: ${m.text().slice(0, 200)}`)
      }
    })
    await p.goto(`http://localhost:5173/?demo=${PERSONA}&tab=${t.id}`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    if (theme === 'light') {
      await p.evaluate(() => {
        const btn = [...document.querySelectorAll('button')]
          .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
        btn?.click()
      })
      await p.waitForTimeout(500)
    }
    await p.screenshot({ path: `screenshots/reg-${t.label}-${theme}.png`, fullPage: false })
    summary.push({ tab: t.label, theme, errs: tabErrs.length, sample: tabErrs[0] || null })
    if (tabErrs.length) errs.push(...tabErrs.map(e => `[${t.label}/${theme}] ${e}`))
    await ctx.close()
  }
}

// Print summary
console.log('\n── Regression sweep summary ──')
for (const s of summary) {
  const status = s.errs === 0 ? '✓' : '✗'
  console.log(`${status} ${s.tab.padEnd(10)} ${s.theme.padEnd(5)} errs=${s.errs}${s.sample ? ' · ' + s.sample.slice(0,80) : ''}`)
}
console.log(errs.length === 0 ? '\nAll clean.' : `\nTotal errors: ${errs.length}`)
await b.close()
