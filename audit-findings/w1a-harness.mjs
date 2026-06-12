// W1-A audit harness — Home + MyMoney + drills. Read-only; drives port 5180.
import { chromium } from 'playwright'
import fs from 'fs'

const BASE = 'http://localhost:5180/'
const OUT = 'C:/Users/Powernet/Desktop/finio/audit-findings'
const SHOTS = OUT + '/shots-w1a'
fs.mkdirSync(SHOTS, { recursive: true })

const PERSONAS = {
  'mrt-core': '/src/rules/personas/mrT-core.json',
  'a':        '/src/rules/personas/persona-a.json',
  'family':   '/src/rules/personas/persona-family.json',
  'e':        '/src/rules/personas/persona-e.json',
}
const TABS = ['home', 'money', 'money/income', 'money/protection', 'money/business', 'money/trusts']

const report = { sweeps: [], drills: [], shots: [] }
const browser = await chromium.launch()

function noiseFilter(msg) {
  return !/vite|hmr|\[sonuswealth\] engine booted|React DevTools|Download the React/i.test(msg)
}

async function freshPage(ctx) {
  const page = await ctx.newPage()
  const errors = [], warnings = []
  page.on('console', m => {
    const t = m.text()
    if (!noiseFilter(t)) return
    if (m.type() === 'error') errors.push(t.slice(0, 300))
    else if (m.type() === 'warning') warnings.push(t.slice(0, 300))
  })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)))
  return { page, errors, warnings }
}

// ---------- Phase 1: sweep all persona x tab ----------
for (const [pid, pfile] of Object.entries(PERSONAS)) {
  for (const tab of TABS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const { page, errors, warnings } = await freshPage(ctx)
    const url = `${BASE}?demo=${pid}&tab=${encodeURIComponent(tab)}&theme=dark`
    let entry = { pid, tab, url }
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(1200)
      const data = await page.evaluate(async (pf) => {
        const out = {}
        out.tieouts = [...document.querySelectorAll('[data-tieout]')].map(el => ({
          key: el.getAttribute('data-tieout'),
          raw: el.getAttribute('data-tieout-raw'),
          text: (el.textContent || '').trim().slice(0, 60),
        }))
        const body = document.body.innerText || ''
        out.bodyLen = body.length
        out.suspicious = []
        for (const pat of ['NaN', 'undefined', 'Infinity', '[object', '£0.00', 'null']) {
          let i = body.indexOf(pat)
          while (i !== -1 && out.suspicious.length < 12) {
            out.suspicious.push(pat + ' @ "' + body.slice(Math.max(0, i - 60), i + 30).replace(/\n/g, ' | ') + '"')
            i = body.indexOf(pat, i + 1)
          }
        }
        // engine tie-out
        try {
          const eng = await import('/src/engine/fq-calculator.js')
          const persona = (await import(pf, { with: { type: 'json' } })).default
          out.engine = { netWorth: Math.round(eng.netWorth(persona)), investable: Math.round(eng.investable(persona)) }
        } catch (e) { out.engineError = String(e).slice(0, 200) }
        // CTA inventory: buttons with no accessible label and links to nowhere
        const btns = [...document.querySelectorAll('button,[role="button"],a')]
        out.ctaCount = btns.length
        out.unlabeled = btns.filter(b => !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length
        out.deadLinks = [...document.querySelectorAll('a')].filter(a => {
          const h = a.getAttribute('href')
          return h === '#' || h === '' || h == null
        }).map(a => (a.innerText || '').trim().slice(0, 40)).slice(0, 10)
        out.firstText = body.slice(0, 700)
        return out
      }, pfile)
      entry = { ...entry, ...data, errors, warnings: warnings.slice(0, 5) }
    } catch (e) {
      entry.fatal = String(e).slice(0, 300)
      entry.errors = errors
    }
    report.sweeps.push(entry)
    await ctx.close()
    process.stdout.write(`sweep ${pid} ${tab} done\n`)
  }
}

// ---------- Phase 2: MyMoney drill click-through ----------
for (const pid of ['mrt-core', 'a', 'family', 'e']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const { page, errors } = await freshPage(ctx)
  const url = `${BASE}?demo=${pid}&tab=money&theme=dark`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1200)
    // inventory drillable tiles
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('button[aria-label^="Open"]')].map(b => b.getAttribute('aria-label')))
    report.drills.push({ pid, tiles })
    for (const label of tiles) {
      const errBefore = errors.length
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(900)
        const before = await page.evaluate(() => document.body.innerText.length)
        await page.click(`button[aria-label="${label.replace(/"/g, '\\"')}"]`, { timeout: 5000 })
        await page.waitForTimeout(900)
        const after = await page.evaluate(() => {
          const body = document.body.innerText
          // try to find overlay-ish container (highest z-index fixed element)
          const fixed = [...document.querySelectorAll('div')].filter(d => {
            const s = getComputedStyle(d)
            return s.position === 'fixed' && d.offsetHeight > 300
          })
          const top = fixed.sort((a, b) => (+getComputedStyle(b).zIndex || 0) - (+getComputedStyle(a).zIndex || 0))[0]
          return {
            bodyLen: body.length,
            overlayText: top ? (top.innerText || '').slice(0, 400) : null,
            hasBack: /←|Back/i.test(top ? top.innerText : body.slice(0, 600)),
          }
        })
        report.drills.push({
          pid, drill: label, changed: Math.abs(after.bodyLen - before) > 40,
          overlayHead: after.overlayText ? after.overlayText.slice(0, 250) : null,
          hasBack: after.hasBack,
          newErrors: errors.slice(errBefore),
        })
      } catch (e) {
        report.drills.push({ pid, drill: label, fatal: String(e).slice(0, 200), newErrors: errors.slice(errBefore) })
      }
    }
  } catch (e) {
    report.drills.push({ pid, fatal: String(e).slice(0, 300) })
  }
  await ctx.close()
  process.stdout.write(`drills ${pid} done\n`)
}

// ---------- Phase 3: viewport/theme screenshots (mrt-core + family, home+money) ----------
for (const pid of ['mrt-core', 'family']) {
  for (const tab of ['home', 'money']) {
    for (const theme of ['dark', 'light']) {
      for (const [vw, vh, vn] of [[375, 812, 'mob'], [1280, 800, 'desk']]) {
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh } })
        const { page, errors } = await freshPage(ctx)
        try {
          await page.goto(`${BASE}?demo=${pid}&tab=${tab}&theme=${theme}`, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(1200)
          const f = `${SHOTS}/${pid}-${tab.replace('/', '_')}-${theme}-${vn}.png`
          await page.screenshot({ path: f, fullPage: false })
          // horizontal overflow check
          const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          report.shots.push({ pid, tab, theme, vp: vn, file: f, hOverflow: ovf, errors: errors.slice(0, 3) })
        } catch (e) {
          report.shots.push({ pid, tab, theme, vp: vn, fatal: String(e).slice(0, 200) })
        }
        await ctx.close()
      }
    }
  }
}

await browser.close()
fs.writeFileSync(OUT + '/w1a-raw.json', JSON.stringify(report, null, 1))
console.log('WROTE', OUT + '/w1a-raw.json')
