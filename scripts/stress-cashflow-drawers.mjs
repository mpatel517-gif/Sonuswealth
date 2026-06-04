// Deep drawer stress — open EVERY tile drawer for the edge personas and capture
// any per-drawer crash/console error. Edges: sparsest accumulator, deep decumulator,
// most-complex, nested-shape, target-less decumulator.
import { chromium } from 'playwright'
import fs from 'node:fs'
fs.mkdirSync('screenshots/stress', { recursive: true })
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const EDGES = ['d', 'f-22', 'f-89', 'c', 'mrt-decum-complex', 'mrt-uk-in', 'a', 'g']
const ALL_TILES = ['Am I OK right now?', 'Will my money last?', 'How do I draw it down?', 'Am I on track? (FI)',
  'What could break it?', 'What would change it most?', 'How fast can I spend?', "What's it costing?"]
const flags = []
for (const key of EDGES) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1300 } })).newPage()
  const errs = []
  p.on('pageerror', e => errs.push(`${key}/PE: ${e.message.slice(0, 70)}`))
  p.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/anthropic|net::ERR|favicon|Supabase|boot-rules|404|status of/.test(t)) errs.push(`${key}/CE: ${t.slice(0, 60)}`) } })
  await p.goto(`http://localhost:5173/?demo=${key}&tab=flow`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  for (const t of ['Strictly necessary only', 'Accept']) { const c = p.getByText(t, { exact: false }).first(); if (await c.count().catch(() => 0)) { await c.click().catch(() => {}); break } }
  await p.waitForTimeout(300)
  const opened = []
  for (const q of ALL_TILES) {
    const tile = p.locator('button', { hasText: q }).first()
    if (!(await tile.count().catch(() => 0))) continue
    const before = errs.length
    await tile.scrollIntoViewIfNeeded().catch(() => {}); await tile.click().catch(() => {})
    const ok = await p.getByText('← Back', { exact: false }).first().waitFor({ timeout: 3500 }).then(() => true).catch(() => false)
    await p.waitForTimeout(900) // let async compute (MC / goal-seek) settle + surface errors
    const drawerErr = errs.length > before
    if (!ok) flags.push(`${key} :: "${q}" NO-DRAWER`)
    if (drawerErr) { flags.push(`${key} :: "${q}" ERROR`); await p.screenshot({ path: `screenshots/stress/${key}-${q.slice(0,8).replace(/\W/g,'')}.png` }).catch(()=>{}) }
    opened.push(`${q.slice(0, 16)}${ok ? '' : '✗'}${drawerErr ? '!' : ''}`)
    if (ok) { await p.getByText('← Back', { exact: false }).first().click().catch(() => {}); await p.waitForTimeout(300) }
  }
  console.log(`${errs.length ? '⚠' : '✓'} ${key.padEnd(18)} drawers[${opened.length}]: ${opened.join(' · ')}${errs.length ? '\n     ' + errs.slice(0,3).join('\n     ') : ''}`)
  await p.context().close()
}
await b.close()
console.log(`\n── deep drawer stress · ${flags.length} flags ──`)
flags.forEach(f => console.log('  ' + f))
