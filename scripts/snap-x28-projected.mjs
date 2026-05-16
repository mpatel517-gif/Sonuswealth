import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(`PAGE: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE: ${m.text().slice(0,180)}`) })

// Clear localStorage so stale window-id doesn't carry over
await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.removeItem('sonuswealth.temporal'))
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1100)

// Pre-state — windowId should be current-period (years=0)
const before = await p.evaluate(() => {
  const heroNum = [...document.querySelectorAll('*')].find(e => /^£[\d.,km]+$/.test((e.textContent||'').trim()) && e.closest('.sw-card-elevated'))
  return { hero: (heroNum?.textContent||'').trim() }
})
console.log('before window change:', before)

// Open the window picker and click 10-year
await p.evaluate(() => {
  const pillBtns = [...document.querySelectorAll('button')]
  // X28TopBar window pill is the first button with current-period label
  const btn = pillBtns.find(b => /This year|Tax Year|5 years|10 years/i.test((b.textContent||'').trim()) && b.getAttribute('aria-haspopup'))
  if (btn) btn.click()
  else {
    const fallback = pillBtns.find(b => /This year|Tax Year|5 years/i.test((b.textContent||'').trim()))
    if (fallback) fallback.click()
  }
})
await p.waitForTimeout(400)
await p.evaluate(() => {
  const items = [...document.querySelectorAll('button, [role=menuitem], li')]
  const ten = items.find(el => /^\s*10 years\s*$|10-year horizon/i.test((el.textContent||'').trim()))
  if (ten) ten.click()
})
await p.waitForTimeout(900)

const after = await p.evaluate(() => {
  const text = document.body.innerText
  const eyebrow = [...document.querySelectorAll('*')].find(e => /^Net worth\b/i.test((e.textContent||'').trim().split('\n')[0]))
  return {
    has10yearLabel: /10-year horizon/i.test(text),
    hasVsToday: /vs today/i.test(text),
    hasPlanMode: /·\s*plan\s*·/i.test(text),
    hasLowConfidence: /low\s+confidence/i.test(text),
    eyebrowText: (eyebrow?.textContent||'').trim().slice(0,80),
  }
})
console.log(JSON.stringify(after, null, 2))

// Scroll to Balance Sheet hero and snap
await p.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find(x => /^Balance sheet$/i.test((x.textContent||'').trim()))
  if (e) e.scrollIntoView({ block: 'center' })
})
await p.waitForTimeout(400)
await p.screenshot({ path: 'screenshots/x28-projected-ten-year.png', fullPage: false })

console.log(errs.length === 0 ? 'NO ERRORS' : `ERRORS:\n${errs.slice(0,5).join('\n')}`)
await ctx.close(); await b.close()
