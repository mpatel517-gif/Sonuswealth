// Snap Mr T's MyMoney tab to verify the all-domain rebuild renders.
import { chromium } from 'playwright'

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()

const errors = []
p.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text().slice(0, 240)}`) })

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

await p.goto('http://localhost:5173/?demo=mrt&tab=money', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)

// Count rendered domain cards + text presence
const stats = await p.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    nw: txt.match(/£[\d,.]+/g)?.slice(0, 6) || [],
    sawAJBell: txt.includes('AJ Bell'),
    sawSSAS: txt.includes('SSAS'),
    sawEIS: txt.includes('Octopus Titan'),
    sawSEIS: txt.includes('SyndicateRoom'),
    sawVCT: txt.includes('Octopus AIM'),
    sawBondOn: txt.includes('Pru Onshore'),
    sawBondOff: txt.includes('Quilter Offshore'),
    sawBTL: txt.includes('Manchester BTL') || txt.includes('Oldham Road'),
    sawDirectorCo: txt.includes('Synthetic Tech'),
    sawDLA: txt.includes("Director's Loan") || txt.includes('Director'),
    sawLifeCover: txt.includes('Life cover'),
    sawCI: txt.includes('Critical Illness'),
    sawIP: txt.includes('Income Protection'),
    sawCrypto: txt.includes('Ethereum') || txt.includes('Bitcoin') || txt.includes('ETH'),
    sawPE: txt.includes('Vintage 2023') || txt.includes('PE'),
    sawWillCurrent: txt.includes('Will current') || txt.includes('current'),
    txtSample: txt.slice(0, 800),
  }
})

await expandScroll()
await p.screenshot({ path: 'screenshots/mrt-money-full.png', fullPage: true })

console.log('--- Mr T MyMoney domain coverage ---')
console.log(JSON.stringify(stats, null, 2))
console.log('\n--- Errors ---')
console.log(errors.length ? errors.slice(0, 6).join('\n') : '(none)')

await b.close()
