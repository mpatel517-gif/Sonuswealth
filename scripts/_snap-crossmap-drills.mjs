import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,160)}`) })

async function dismissCookies() {
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /accept all|strictly necessary/i.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await p.waitForTimeout(300)
}

const out = {}

// ── 1. CROSSMAP cell tap — must open a sheet, no dead-end, no engineering-speak
await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(900); await dismissCookies()
// tap the ideal corner cell (Exceptional / Resilient) — a non-current cell for persona-a
const cellTapped = await p.evaluate(() => {
  const btns = [...document.querySelectorAll('button[aria-label]')]
  const cell = btns.find(b => /\/\s*(Resilient|Protected|Managed)/i.test(b.getAttribute('aria-label') || ''))
  if (cell) { cell.click(); return cell.getAttribute('aria-label') }
  return null
})
await p.waitForTimeout(500)
const cmText = await p.evaluate(() => document.body.innerText)
out.crossmap = {
  cellTapped,
  sheetOpened: /About this position|Where you are now/i.test(cmText),
  noStub: !/Stub|movementPaths|engine\./i.test(cmText),
  hasComparison: /financial health|resilience/i.test(cmText),
}
await p.screenshot({ path: 'screenshots/crossmap-sheet.png', fullPage: false })

// ── 2. WEALTH dim drill → DetailOverlay table (other session's 3d6102d)
//    Reached via the Risk tab RiskPrimaryAnchor "Wealth Score" SecondaryTile.
await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil: 'networkidle' })
await p.waitForTimeout(900); await dismissCookies()
const wsTap = await p.evaluate(() => {
  // SecondaryTile: small tile whose text is "Wealth Score" + the value (e.g. 67)
  const lbl = [...document.querySelectorAll('*')].find(e => {
    const t = (e.textContent || '').replace(/\s+/g, ' ').trim()
    return /^Wealth Score\s*\d+/i.test(t) && t.length < 24
  })
  if (!lbl) return false
  let n = lbl
  for (let i = 0; i < 6 && n; i++) {
    if (n.offsetHeight >= 40 && n.offsetHeight <= 160) { n.click(); return true }
    n = n.parentElement
  }
  lbl.click(); return true
})
await p.waitForTimeout(700)
// inside DetailOverlay → tap a dimension driver button
const dimTap = await p.evaluate(() => {
  const dlg = document.querySelector('[role=dialog]')
  if (!dlg) return '(no dialog)'
  const el = [...dlg.querySelectorAll('button')]
    .find(b => /^(Behaviour|Estate|Protection|Capital|Cashflow)/i.test((b.textContent || '').trim()))
  if (el) { el.click(); return (el.textContent || '').trim().slice(0, 24) }
  return '(no dim row)'
})
await p.waitForTimeout(600)
const wText = await p.evaluate(() => document.querySelector('[role=dialog]')?.innerText || document.body.innerText)
out.wealthDrill = { wsTap, dimTap, hasBuilt: /How this number is built/i.test(wText), hasTotal: /Total/i.test(wText) }
await p.screenshot({ path: 'screenshots/wealth-drill.png', fullPage: false })

out.errs = errs.slice(0, 6)
console.log(JSON.stringify(out, null, 2))
await ctx.close(); await b.close()
