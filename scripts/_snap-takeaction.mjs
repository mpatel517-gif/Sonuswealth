import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport:{width:430,height:920}, deviceScaleFactor:2 })).newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:5173/?demo=g&tab=risk', { waitUntil:'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(b=>/accept all|strictly/i.test(b.textContent||''));if(x)x.click()})
await p.waitForTimeout(400)
// open "What I'd do about it" drawer if collapsed, then tap a TakeAction row
const before = await p.evaluate(()=>{
  // expand drawers
  document.querySelectorAll('[aria-labelledby="rc-risk-act-title"]').forEach(()=>{})
  const hdr=[...document.querySelectorAll('[id="rc-risk-act-title"]')][0]
  if(hdr){ const btn=hdr.closest('[role="button"],button')||hdr.parentElement; btn&&btn.click() }
  return location.hash
})
await p.waitForTimeout(500)
const tapped = await p.evaluate(()=>{
  // TakeAction rows live under the "Take Action — top 3 for Risk" card
  const card=[...document.querySelectorAll('.card')].find(c=>/Take Action — top 3/i.test(c.textContent||''))
  if(!card) return '(no card)'
  const row=[...card.querySelectorAll('.sw-press')].find(r=>/\+\d/.test(r.textContent||''))
  if(!row) return '(no row)'
  const txt=(row.textContent||'').trim().slice(0,40)
  row.click()
  return txt
})
await p.waitForTimeout(900)
const after = await p.evaluate(()=>({ hash:location.hash, onMoneyTab: /My Money|Net worth|Assets|Protection/i.test(document.body.innerText), riskGone: !/Shock Lab|What would help most/i.test(document.body.innerText) }))
console.log(JSON.stringify({ tapped, after, errs:errs.slice(0,3) }, null, 2))
await p.screenshot({ path:'screenshots/takeaction-nav.png', fullPage:false })
await b.close()
