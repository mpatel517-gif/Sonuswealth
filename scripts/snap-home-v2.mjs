// snap-home-v2.mjs — Home v2.0 6-card layout verification
// Usage: SNAP_BASE=http://localhost:5175 node scripts/snap-home-v2.mjs [persona]
//
// Captures Home tab at 3 viewports × 2 themes = 6 PNGs per persona.
// Dev server must be running.

import { chromium } from 'playwright'
import { mkdir }    from 'node:fs/promises'
import { resolve }  from 'node:path'

const PERSONA = process.argv[2] || 'mrt'
const BASE    = process.env.SNAP_BASE || 'http://localhost:5173'
const OUT     = resolve('./screenshots')

const VIEWPORTS = [
  { name: 'mobile-480',  width: 480,  height: 900  },
  { name: 'ipad-820',    width: 820,  height: 1180 },
  { name: 'laptop-1440', width: 1440, height: 900  },
]
const THEMES = ['dark', 'light']

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx  = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()

    const url = `${BASE}/?demo=${PERSONA}&tab=home`
    console.log(`→ ${theme.padEnd(5)}  ${vp.name.padEnd(14)}  ${url}`)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    // Apply theme
    if (theme === 'light') {
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light')
      })
      await page.waitForTimeout(300)
    }

    const file = `${OUT}/homev2-${PERSONA}-${vp.name}-${theme}.png`
    await page.screenshot({ path: file, fullPage: true })
    console.log(`   ✓ ${file}`)

    await ctx.close()
  }
}

await browser.close()
console.log(`\n✓ Done — 6 PNGs for persona: ${PERSONA}`)
