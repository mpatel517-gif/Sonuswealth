// Diagnose why Home renders only through CoI — capture console errors + page errors.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 1400 } })
const p = await ctx.newPage()

const errors = []
const warnings = []

p.on('console', m => {
  if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`)
  if (m.type() === 'warning') warnings.push(`[console.warn] ${m.text()}`)
})
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`))

await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

// Measure page height + zone presence + full text dump
const stats = await p.evaluate(() => {
  const h = document.body.scrollHeight
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  // Also count all elements inside the home tab pane
  const root = document.querySelector('.sw-tab-slide')
  const directChildren = root ? Array.from(root.children).map(el => ({
    tag: el.tagName.toLowerCase(),
    cls: el.className?.toString().slice(0, 60),
    h: el.offsetHeight,
    sample: (el.innerText || '').slice(0, 80),
  })) : []
  return {
    scrollHeight: h,
    rootChildCount: root?.children.length || 0,
    directChildren,
    sawFinancialHealth: txt.includes('Financial health'),
    sawScoreJourney: txt.includes('Score journey'),
    sawRealityEngine: txt.includes('Reality Engine'),
    sawPriorityActions: txt.includes('Priority actions'),
    sawForgotten: txt.includes('Forgotten') || txt.includes('forgotten'),
    fullTxt: txt.slice(0, 4000),
  }
})

console.log('--- ERRORS ---')
console.log(errors.length ? errors.join('\n\n') : '(none)')
console.log('\n--- WARNINGS ---')
console.log(warnings.slice(0, 5).join('\n') || '(none)')
console.log('\n--- STATS ---')
console.log(JSON.stringify({
  scrollHeight: stats.scrollHeight,
  rootChildCount: stats.rootChildCount,
  flags: {
    sawFinancialHealth: stats.sawFinancialHealth,
    sawScoreJourney: stats.sawScoreJourney,
    sawRealityEngine: stats.sawRealityEngine,
    sawPriorityActions: stats.sawPriorityActions,
    sawForgotten: stats.sawForgotten,
  },
  directChildren: stats.directChildren,
  fullTxt: stats.fullTxt,
}, null, 2))

await b.close()
