// Snap DataCapture flow — open from "More" menu and verify the screen renders
// plus the FP-5 modal opens (we trigger it by injecting a fake file event,
// since we can't drive a real OS file picker from headless).
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

await p.goto('http://localhost:5173/?demo=a&tab=home', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

// Open "More" menu by clicking the ⋯ button in the header
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === '⋯')
  if (btn) btn.click()
})
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/datacapture-more-menu.png', fullPage: false })

// Click "Data capture" tile inside More menu
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Data capture/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(600)
await p.screenshot({ path: 'screenshots/datacapture-screen.png', fullPage: false })

// Click "Upload a document" — this will trigger the hidden file input.click()
// which a headless browser won't open, but we can confirm the channel state is set.
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Upload a document/.test(b.textContent || ''))
  if (btn) btn.click()
})
await p.waitForTimeout(300)

// Drive the FP-5 modal directly by setting a fake file on the hidden input.
// In headless chromium, we can use setInputFiles via element handle.
const fileInput = await p.$('input[type="file"]')
if (fileInput) {
  await fileInput.setInputFiles({
    name: 'aj-bell-sipp-2026q1.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('mock sipp statement'),
  })
}
await p.waitForTimeout(1800) // wait for simulated parse (1400ms)
await p.screenshot({ path: 'screenshots/datacapture-fp5-modal.png', fullPage: false })

// Now snap full scroll of modal to see all fields
await p.evaluate(() => {
  document.querySelectorAll('div').forEach(d => {
    const s = getComputedStyle(d)
    if (s.overflow === 'auto' || s.overflow === 'scroll') {
      d.style.overflow = 'visible'; d.style.maxHeight = 'none'
    }
  })
  document.documentElement.style.height = 'auto'
  document.body.style.height = 'auto'; document.body.style.overflow = 'visible'
})
await p.waitForTimeout(200)
await p.screenshot({ path: 'screenshots/datacapture-fp5-modal-full.png', fullPage: true })

if (errors.length) {
  console.log('ERRORS:')
  console.log(errors.slice(0, 12).join('\n'))
} else {
  console.log('No errors.')
}

await b.close()
