// Snap the rebuilt Home tab above-fold contract:
//   480×900 (mobile)  · 820×1180 (iPad) · 1440×900 (laptop)
//   Personas: Bruce (a) + Mr T (mrt). Both themes.
// Two captures per (persona × viewport × theme):
//   1. above-fold viewport screenshot — anchors + 6 state tiles + 1 critical
//      action must be visible without scroll at mobile 480×900.
//   2. full-page screenshot — verifies below-fold cluster (Trajectory closed,
//      radar closed, Z6, Z9, ForgottenMoney, conditional Z10/Z14/Z15).
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

mkdirSync('screenshots', { recursive: true })

const b = await chromium.launch()
const errors = []

const VIEWPORTS = [
  { w: 480,  h: 900,  label: 'mobile' },
  { w: 820,  h: 1180, label: 'ipad'   },
  { w: 1440, h: 900,  label: 'laptop' },
]
const PERSONAS = [
  { id: 'a',   name: 'bruce' },
  { id: 'mrt', name: 'mrt'   },
]
const THEMES = ['dark', 'light']

for (const persona of PERSONAS) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = `home-${persona.name}-${vp.label}-${theme}`
      const ctx = await b.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 2,
      })
      // Dismiss Z0 orientation BEFORE page load — the above-fold contract is
      // about the returning-user reality, not the first-render pill. Setting
      // localStorage after goto is too late; React reads it on first paint.
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem('sonuswealth.home.orientationDismissed', '1')
        } catch { /* silent */ }
      })
      const p = await ctx.newPage()
      p.on('pageerror', e => errors.push(`[${label}] ${e.message}`))
      p.on('console', m => {
        if (m.type() === 'error') {
          errors.push(`[${label} console] ${m.text().slice(0, 200)}`)
        }
      })

      await p.goto(
        `http://localhost:5173/?demo=${persona.id}&tab=home`,
        { waitUntil: 'networkidle' },
      )
      await p.waitForTimeout(1800)

      if (theme === 'light') {
        await p.evaluate(() => {
          const btn = [...document.querySelectorAll('button')]
            .find(b => b.getAttribute('aria-label')?.toLowerCase().includes('switch to light'))
          if (btn) btn.click()
        })
        await p.waitForTimeout(600)
      }

      // 1 — above-fold viewport screenshot (no fullPage). At 480×900 this is
      // the contract: anchors + 6 state tiles + 1 critical action visible.
      await p.screenshot({
        path: `screenshots/${label}-abovefold.png`,
        fullPage: false,
      })

      // 2 — full-page capture for the below-fold cluster verification.
      // Lift inner overflow so fullPage actually captures the scroll.
      await p.evaluate(() => {
        document.querySelectorAll('div').forEach(d => {
          const s = getComputedStyle(d)
          if (s.overflow === 'hidden' && s.flex.includes('1')) {
            d.style.overflow = 'visible'
            d.style.height = 'auto'
            d.style.maxHeight = 'none'
          }
        })
        document.documentElement.style.height = 'auto'
        document.body.style.height = 'auto'
        document.body.style.overflow = 'visible'
      })
      await p.waitForTimeout(400)
      await p.screenshot({
        path: `screenshots/${label}-full.png`,
        fullPage: true,
      })

      console.log(`✓ ${label}`)
      await ctx.close()
    }
  }
}

if (errors.length) {
  console.log('\nERRORS:')
  console.log(errors.slice(0, 24).join('\n'))
} else {
  console.log('\nNo errors.')
}
await b.close()
