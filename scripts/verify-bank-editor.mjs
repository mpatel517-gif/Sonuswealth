// LIVE-PATH verification for the admin question-bank editor:
// admin gate → edit Q1 title → save → the live questionnaire reflects the edit.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 200)}`) })

const SENTINEL = 'ADMIN EDIT TEST — your approach?'

const clickByText = (re) => p.evaluate((src) => {
  const el = [...document.querySelectorAll('button,[role="button"]')].find(b => new RegExp(src, 'i').test(b.innerText || ''))
  if (el) { el.click(); return true }
  return false
}, re)

await p.goto('http://localhost:5173/?demo=a&tab=risk&admin=1', { waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
await p.evaluate(() => {
  const a = [...document.querySelectorAll('button')].find(b => /accept all|strictly necessary/i.test(b.innerText || ''))
  if (a) a.click()
})
await p.waitForTimeout(400)

// Open investing drawer → admin button should appear.
await clickByText('the risk in my investing'); await p.waitForTimeout(400)
const adminBtn = await clickByText('edit risk questions')
console.log('admin button present + clicked:', adminBtn)
await p.waitForTimeout(500)

// Editor open? Edit the first "Question title" input to the sentinel.
const edited = await p.evaluate((sentinel) => {
  const inp = [...document.querySelectorAll('input')].find(i => i.placeholder === 'Question title')
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, sentinel)
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}, SENTINEL)
console.log('Q1 title edited:', edited)
await p.waitForTimeout(300)

// Save the bank.
const saved = await clickByText('save question bank')
console.log('save clicked:', saved)
await p.waitForTimeout(900)

// Re-open the questionnaire and read the first question title.
await clickByText('update your risk perception'); await p.waitForTimeout(700)
const firstQ = await p.evaluate(() => {
  // The questionnaire title is the bold 16px line after the step eyebrow.
  const eyebrow = [...document.querySelectorAll('*')].find(e => /Risk perception/i.test(e.textContent || '') && /Step/i.test(e.textContent || ''))
  // Fallback: grab the modal's prominent heading text.
  const modal = document.querySelector('[style*="position: fixed"]')
  return (modal?.innerText || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200)
})
console.log('QUESTIONNAIRE TEXT:', firstQ)
console.log('REFLECTS EDIT:', firstQ.includes('ADMIN EDIT TEST'))
console.log(errors.length ? `\nERRORS:\n${errors.slice(0, 8).join('\n')}` : '\nNo errors.')
await b.close()
