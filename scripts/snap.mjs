// snap.mjs — Sonuswealth screen capture for Claude design review
// Usage: npm run snap [persona]      e.g. npm run snap mrt
//        npm run snap mrt risk       single tab only
//
// Captures every tab into ./screenshots/{persona}-{tab}.png at 390×844 (mobile).
// Saves a 1280×900 desktop variant alongside.
// Dev server must be running on http://localhost:5173 (default vite port).

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const PERSONA = process.argv[2] || 'mrt'
const ONLY    = process.argv[3] || null
const BASE    = process.env.SNAP_BASE || 'http://localhost:5173'
// Canonical tabs per Dashboard.jsx:39-46 (D-ASK-1: Ask is a pill not a tab).
// `timeline` id renders Timeline.jsx (renamed from 'plan' 2026-05-15, FIX-14).
// Dashboard's readTabParam includes a 'plan' → 'timeline' migration shim, so
// legacy URLs still resolve, but the canonical id is 'timeline'.
const TABS    = ['home','money','flow','tax','risk','timeline']
const OUT     = resolve('./screenshots')

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844  },
  { name: 'desktop', width: 1280, height: 900  },
]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const list = ONLY ? [ONLY] : TABS

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await ctx.newPage()

  for (const tab of list) {
    const url = `${BASE}/?demo=${PERSONA}&tab=${tab}`
    console.log(`→ ${vp.name.padEnd(7)}  ${tab.padEnd(5)}  ${url}`)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800) // settle FadeInOnMount + reveal animations
    const file = `${OUT}/${PERSONA}-${tab}-${vp.name}.png`
    await page.screenshot({ path: file, fullPage: true })
  }
  await ctx.close()
}

await browser.close()
console.log(`\n✓ Saved ${list.length * VIEWPORTS.length} screenshots to ${OUT}`)
