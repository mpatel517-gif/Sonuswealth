// Exercise the 5 new drill panels + 3 pivot views (item 6 + item 7).
// Mr T persona has data in every domain, so all drill panels render.
import { chromium } from 'playwright'

const b = await chromium.launch()
const errors = []
const seen = new Set()
function record(label, msg) {
  const key = `${label}|${msg.slice(0, 120)}`
  if (seen.has(key)) return
  seen.add(key)
  errors.push(`[${label}] ${msg}`)
}

async function visit(p, label) {
  await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
}

const PIVOT_LABELS = ['Balance sheet', 'Income', 'Insurance', 'Bonds']
const TILE_LABELS = ['Pensions', 'Savings & Investments', 'Property', 'Business Assets', 'Protection', 'Liabilities']

const THEME = process.env.THEME || 'dark'
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('pageerror', e => record('pageerror', e.message))
p.on('console', m => { if (m.type() === 'error') record('console', m.text().slice(0, 200)) })

async function applyLightIfNeeded() {
  if (THEME !== 'light') return
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
    if (btn) btn.click()
  })
  await p.waitForTimeout(600)
}

// 1. Pivot views — click each toggle pill, snap, ensure no errors
for (const pivot of PIVOT_LABELS) {
  await visit(p, `pivot-${pivot}`)
  await applyLightIfNeeded()
  await p.evaluate(label => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label)
    if (btn) btn.click()
  }, pivot)
  await p.waitForTimeout(900)
  await p.screenshot({ path: `screenshots/mm-pivot-${pivot.replace(/\s+/g, '-').toLowerCase()}-${THEME}.png`, fullPage: true })
  console.log(`✓ pivot · ${pivot} · ${THEME}`)
}

// 2. Drill panels — click each tile's "View detail →" link, snap, close
for (const tile of TILE_LABELS) {
  await visit(p, `drill-${tile}`)
  // Find the tile by its label text, then click the "View detail →" button
  // inside the same card.
  const clicked = await p.evaluate(tileLabel => {
    const cards = [...document.querySelectorAll('div')]
      .filter(d => d.className && d.className.includes && d.className.includes('sw-pressable'))
    for (const card of cards) {
      if (card.textContent.includes(tileLabel)) {
        const detail = card.querySelector('button')
        if (detail) { detail.click(); return true }
      }
    }
    return false
  }, tile)
  if (!clicked) { console.log(`✗ ${tile} — tile not found`); continue }
  await p.waitForTimeout(1000)
  await applyLightIfNeeded()
  await p.screenshot({ path: `screenshots/mm-drill-${tile.replace(/\s+/g, '-').replace(/&/g, 'and').toLowerCase()}-${THEME}.png`, fullPage: true })
  console.log(`✓ drill · ${tile} · ${THEME}`)
}

await ctx.close()

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 20).join('\n'))
} else {
  console.log('\nNo errors.')
}
await b.close()
