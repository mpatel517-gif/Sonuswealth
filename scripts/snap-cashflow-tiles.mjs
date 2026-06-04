// scripts/snap-cashflow-tiles.mjs — snap the redesigned Cashflow tile grid + drawers.
import { chromium } from 'playwright'
import fs from 'node:fs'

fs.mkdirSync('screenshots', { recursive: true })
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const b = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined })

const consoleMsgs = []
async function snap(demo, label, viewport, theme) {
  const ctx = await b.newContext({ viewport: { width: viewport, height: 1200 }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') {
    const t = m.text(); if (!/anthropic|net::ERR|favicon|VITE_SUPABASE/.test(t)) consoleMsgs.push(`[${label}] ${m.type()}: ${t.slice(0, 160)}`)
  }})
  p.on('pageerror', e => consoleMsgs.push(`[${label}] PAGEERROR: ${e.message.slice(0, 160)}`))
  await p.goto(`http://localhost:5173/?demo=${demo}&tab=flow`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(1800)
  // Dismiss the cookie banner so it doesn't intercept tile clicks.
  for (const t of ['Strictly necessary only', 'Accept analytics', 'Accept']) {
    const c = p.getByText(t, { exact: false }).first()
    if (await c.count().catch(()=>0)) { await c.click().catch(()=>{}); await p.waitForTimeout(300); break }
  }
  if (theme === 'light') {
    await p.evaluate(() => { const btn=[...document.querySelectorAll('button')].find(b=>/light/i.test(b.getAttribute('aria-label')||'')); btn?.click() }).catch(()=>{})
    await p.waitForTimeout(400)
  }
  await p.screenshot({ path: `screenshots/${label}-grid.png`, fullPage: true }).catch(()=>{})
  // open each tile, screenshot its drawer, close
  const tiles = [['Am I OK right now?','now'], ['How do I draw it down?','drawdown'], ['How fast can I spend?','methods'], ["What's it costing?",'costs']]
  for (const [q, key] of tiles) {
    // Click the tile's View › button area via the question text inside a button.
    const btn = p.locator('button', { hasText: q }).first()
    if (!(await btn.count().catch(()=>0))) { console.log(`  (no tile: ${q})`); continue }
    await btn.scrollIntoViewIfNeeded().catch(()=>{})
    await btn.click().catch(()=>{})
    // Wait for the drawer (the ← Back button) to confirm it opened.
    const opened = await p.getByText('← Back', { exact: false }).first().waitFor({ timeout: 4000 }).then(()=>true).catch(()=>false)
    await p.waitForTimeout(900)
    await p.screenshot({ path: `screenshots/${label}-${key}.png`, fullPage: true }).catch(()=>{})
    console.log(`  ${key}: ${opened ? 'drawer opened' : 'NO DRAWER'}`)
    if (opened) { await p.getByText('← Back', { exact: false }).first().click().catch(()=>{}); await p.waitForTimeout(500) }
  }
  console.log(`✓ ${label}`)
  await ctx.close()
}

await snap('a', 'bruce-1280-dark', 1280, 'dark')
await snap('mrt', 'mrt-1280-dark', 1280, 'dark')
await snap('a', 'bruce-390-dark', 390, 'dark')
await b.close()

console.log(`\n── console warnings/errors (${consoleMsgs.length}) ──`)
const counts = {}
for (const m of consoleMsgs) { const key = m.replace(/\[.*?\]/, '').slice(0, 80); counts[key] = (counts[key]||0)+1 }
Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([k,n])=>console.log(`  ${n}× ${k}`))
