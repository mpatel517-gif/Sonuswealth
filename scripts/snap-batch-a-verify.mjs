// Verify Phase 2 Batch A: persona data layer + trajectories render correctly.
// Snap Bruce + Mr T + Tony at Home tab, each in Actual / Forecast / Plan / Scenario modes.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

async function expandScroll() {
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
}

async function clickMode(label) {
  await p.evaluate((l) => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === l)
    if (btn) btn.click()
  }, label)
  await p.waitForTimeout(600)
}

const personas = [
  { id: 'mrt', label: 'Mr T' },
  { id: 'a',   label: 'Bruce' },
  { id: 'c',   label: 'Tony' },
]
const modes = ['Actual', 'Forecast', 'Plan', 'Scenario']

for (const persona of personas) {
  for (const mode of modes) {
    await p.goto(`http://localhost:5173/?demo=${persona.id}&tab=home`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    if (mode !== 'Actual') await clickMode(mode)
    await expandScroll()
    await p.screenshot({ path: `screenshots/batchA-${persona.id}-${mode.toLowerCase()}.png`, fullPage: false })
    console.log(`✓ ${persona.label} · ${mode}`)
  }
}

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('\nNo errors.')
}

await b.close()
