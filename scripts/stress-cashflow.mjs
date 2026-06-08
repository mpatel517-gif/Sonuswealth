// scripts/stress-cashflow.mjs — stress the Cashflow tab across EVERY demo entity.
// For each: boot, capture pageerrors/console-errors, detect ErrorBoundary, count
// tiles, open the primary plan tile + costs tile and confirm the drawer renders.
import { chromium } from 'playwright'
import fs from 'node:fs'
fs.mkdirSync('screenshots/stress', { recursive: true })
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined })

const KEYS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'f-wrapper', 'g',
  'f-22', 'f-32', 'f-45', 'f-58', 'f-72', 'f-89',
  'mrt', 'mrt-core', 'mrt-aged-out', 'mrt-beneficiary', 'mrt-cohab-sep', 'mrt-couple',
  'mrt-decum-complex', 'mrt-divorced', 'mrt-family', 'mrt-landlord', 'mrt-ltd-director',
  'mrt-sole-trader', 'mrt-uk-in', 'mrt-uk-th',
]
const rows = []
for (const key of KEYS) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1300 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PE:' + e.message.slice(0, 70)))
  p.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/anthropic|net::ERR|favicon|Supabase|boot-rules|404|status of/.test(t)) errs.push('CE:' + t.slice(0, 60)) } })
  let crashed = false, tiles = 0, drawerOK = '-', drawerErr = false
  try {
    await p.goto(`http://localhost:5173/?demo=${key}&tab=flow`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2300)
    for (const t of ['Strictly necessary only', 'Accept']) { const c = p.getByText(t, { exact: false }).first(); if (await c.count().catch(() => 0)) { await c.click().catch(() => {}); break } }
    await p.waitForTimeout(350)
    crashed = !!(await p.getByText(/error rendering this view|We hit an error/i).first().count().catch(() => 0))
    for (const q of ['Will my money last?', 'What could break it?', "What's it costing?", 'Am I OK right now?']) {
      if (await p.locator('button', { hasText: q }).first().count().catch(() => 0)) tiles++
    }
    // open the primary plan tile (drawdown OR FI) + the costs tile, confirm a drawer opens
    if (!crashed) {
      const errsBefore = errs.length
      const plan = p.locator('button', { hasText: 'How do I draw it down?' }).first()
      const fi = p.locator('button', { hasText: 'Am I on track? (FI)' }).first()
      const tile = (await plan.count().catch(() => 0)) ? plan : (await fi.count().catch(() => 0)) ? fi : null
      if (tile) {
        await tile.scrollIntoViewIfNeeded().catch(() => {}); await tile.click().catch(() => {})
        const opened = await p.getByText('← Back', { exact: false }).first().waitFor({ timeout: 3500 }).then(() => true).catch(() => false)
        await p.waitForTimeout(700)
        drawerOK = opened ? 'open' : 'NO-DRAWER'
        if (errs.length > errsBefore) drawerErr = true
        if (opened) { await p.getByText('← Back', { exact: false }).first().click().catch(() => {}); await p.waitForTimeout(300) }
      }
    }
  } catch (e) { errs.push('GOTO:' + e.message.slice(0, 60)) }
  const bad = crashed || tiles < 2 || drawerOK === 'NO-DRAWER' || drawerErr || errs.length > 0
  if (bad) await p.screenshot({ path: `screenshots/stress/${key}.png`, fullPage: false }).catch(() => {})
  rows.push({ key, crashed, tiles, drawerOK, errs: errs.length })
  console.log(`${crashed ? '✗CRASH' : bad ? '⚠' : '✓'} ${key.padEnd(18)} tiles=${tiles} drawer=${drawerOK} errs=${errs.length}${errs.length ? ' :: ' + errs.slice(0, 2).join(' | ') : ''}`)
  await ctx.close()
}
await b.close()
const bad = rows.filter(r => r.crashed || r.tiles < 2 || r.drawerOK === 'NO-DRAWER' || r.errs > 0)
console.log(`\n── ${rows.length} entities · ${rows.length - bad.length} clean · ${bad.length} flagged ──`)
bad.forEach(r => console.log(`  ${r.key}: crashed=${r.crashed} tiles=${r.tiles} drawer=${r.drawerOK} errs=${r.errs}`))
