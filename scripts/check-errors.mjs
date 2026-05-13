import { chromium } from 'playwright'
const BASE = process.env.SNAP_BASE || 'http://localhost:5173'
const PERSONA = process.argv[2] || 'mrt'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`${BASE}/?demo=${PERSONA}&tab=home`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await browser.close()
console.log('Console error count:', errors.length)
if (errors.length) {
  errors.slice(0, 10).forEach(e => console.log('ERR:', e.slice(0, 300)))
} else {
  console.log('ZERO console errors')
}
