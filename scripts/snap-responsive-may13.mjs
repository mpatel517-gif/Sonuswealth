// Responsive verification — mobile (480) + iPad (820) for MyMoney L1
// across themes, plus Cashflow scenario seed banner.
import { chromium } from 'playwright'
const b = await chromium.launch()
const TESTS = [
  { vp: 480,  theme: 'dark',  label: 'm-480-dark-mymoney',   url: '/?demo=mrt&tab=money' },
  { vp: 480,  theme: 'light', label: 'm-480-light-mymoney',  url: '/?demo=mrt&tab=money' },
  { vp: 820,  theme: 'dark',  label: 'ipad-820-dark-mymoney',  url: '/?demo=mrt&tab=money' },
  { vp: 820,  theme: 'light', label: 'ipad-820-light-mymoney', url: '/?demo=mrt&tab=money' },
  { vp: 480,  theme: 'dark',  label: 'm-480-dark-cashflow-seed',
    url: `/?demo=mrt&tab=flow&cfTab=scenario&seed=${encodeURIComponent(JSON.stringify({ label: 'Pension headroom', current: 60000, proposed: 30000, formatted: '£60k', line: '£24k of tax relief gone forever if not used by 5 April' }))}` },
  { vp: 820,  theme: 'dark',  label: 'ipad-820-dark-cashflow-seed',
    url: `/?demo=mrt&tab=flow&cfTab=scenario&seed=${encodeURIComponent(JSON.stringify({ label: 'Pension headroom', current: 60000, proposed: 30000, formatted: '£60k', line: '£24k of tax relief gone forever if not used by 5 April' }))}` },
]
const errs = []
for (const t of TESTS) {
  const ctx = await b.newContext({ viewport: { width: t.vp, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('pageerror', e => errs.push(`[${t.label}] ${e.message}`))
  p.on('console', m => {
    if (m.type() === 'error' && !/anthropic|net::ERR_FAILED/.test(m.text())) errs.push(`[${t.label}] ${m.text().slice(0, 200)}`)
  })
  await p.goto(`http://localhost:5173${t.url}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  if (t.theme === 'light') {
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
      btn?.click()
    })
    await p.waitForTimeout(500)
  }
  await p.evaluate(() => {
    document.querySelectorAll('div').forEach(d => {
      const s = getComputedStyle(d)
      if (s.overflow === 'hidden' && s.flex.includes('1')) {
        d.style.overflow = 'visible'; d.style.height = 'auto'; d.style.maxHeight = 'none'
      }
    })
    document.documentElement.style.height = 'auto'
    document.body.style.height = 'auto'; document.body.style.overflow = 'visible'
  })
  await p.waitForTimeout(300)
  await p.screenshot({ path: `screenshots/${t.label}.png`, fullPage: false })
  const overflow = await p.evaluate(() => {
    const html = document.documentElement
    return { hScroll: html.scrollWidth > html.clientWidth, scrollW: html.scrollWidth, clientW: html.clientWidth }
  })
  console.log(`✓ ${t.label} hOverflow=${overflow.hScroll ? `YES (${overflow.scrollW}>${overflow.clientW})` : 'no'}`)
  await ctx.close()
}
console.log(errs.length ? `\nerrors: ${errs.length}` : '\nNo errors.')
errs.forEach(e => console.log('  ' + e))
await b.close()
