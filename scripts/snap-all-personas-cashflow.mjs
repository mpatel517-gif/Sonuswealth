// scripts/snap-all-personas-cashflow.mjs — verify the Cashflow tab boots + renders
// the tile grid for every persona (no ErrorBoundary, no pageerror, tiles present).
import { chromium } from 'playwright'
import fs from 'node:fs'
fs.mkdirSync('screenshots/personas', { recursive: true })
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined })

const PERSONAS = [
  ['a', 'Bruce Wayne'], ['b', 'Fred & Wilma'], ['c', 'Tony Stark'], ['d', 'Hermione'],
  ['e', 'Willy Wonka'], ['f', 'Anna Finch'], ['g', 'Priya Sharma'],
  ['mrt', 'Mr T core'], ['mrt-decum-complex', 'Mr T decum-complex'],
]
const rows = []
for (const [key, name] of PERSONAS) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1300 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message.slice(0, 100)))
  p.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/anthropic|net::ERR|favicon|Supabase|boot-rules|404/.test(t)) errs.push('console: ' + t.slice(0, 90)) } })
  try {
    await p.goto(`http://localhost:5173/?demo=${key}&tab=flow`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2600)
    for (const t of ['Strictly necessary only', 'Accept']) { const c = p.getByText(t, { exact: false }).first(); if (await c.count().catch(() => 0)) { await c.click().catch(() => {}); break } }
    await p.waitForTimeout(500)
  } catch (e) { errs.push('goto: ' + e.message.slice(0, 80)) }
  const crashed = await p.getByText(/error rendering this view|We hit an error/i).first().count().catch(() => 0)
  // tile grid present? count the question-tile buttons by their stable phrases
  const tileTexts = ['Will my money last?', 'What could break it?', "What's it costing?", 'Am I OK right now?']
  let tilesFound = 0
  for (const q of tileTexts) { if (await p.locator('button', { hasText: q }).first().count().catch(() => 0)) tilesFound++ }
  const headline = await p.getByText(/On these assumptions|Add income|Building wealth|saving enough/i).first().textContent().catch(() => null)
  await p.screenshot({ path: `screenshots/personas/${key}.png`, fullPage: false }).catch(() => {})
  rows.push({ key, name, crashed: !!crashed, tilesFound, errs: errs.length, headline: (headline || '').trim().slice(0, 60) })
  console.log(`${crashed ? '✗ CRASH' : tilesFound >= 2 ? '✓' : '⚠ thin'} ${key.padEnd(18)} tiles=${tilesFound} errs=${errs.length} | ${(headline || '').trim().slice(0, 50)}`)
  if (errs.length) console.log('     ' + errs.slice(0, 2).join(' | '))
  await ctx.close()
}
await b.close()
const bad = rows.filter(r => r.crashed || r.tilesFound < 2)
console.log(`\n── ${rows.length} personas · ${rows.length - bad.length} OK · ${bad.length} need attention ──`)
bad.forEach(r => console.log(`  ${r.key}: crashed=${r.crashed} tiles=${r.tilesFound} errs=${r.errs}`))
