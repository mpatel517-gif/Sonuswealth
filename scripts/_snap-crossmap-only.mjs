import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport:{width:430,height:920}, deviceScaleFactor:2 })).newPage()
await p.goto('http://localhost:5173/?demo=a&tab=risk', { waitUntil:'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(b=>/accept all|strictly/i.test(b.textContent||''));if(x)x.click()})
await p.waitForTimeout(400)
const tapped = await p.evaluate(()=>{
  const cell=[...document.querySelectorAll('button[aria-label]')].find(b=>/\/\s*(Resilient|Protected|Managed)/i.test(b.getAttribute('aria-label')||''))
  if(cell){cell.scrollIntoView({block:'center'});cell.click();return cell.getAttribute('aria-label')}
  return null
})
await p.waitForSelector('[role=dialog]', { timeout: 3000 }).catch(()=>{})
await p.waitForTimeout(700)
await p.screenshot({ path:'screenshots/crossmap-sheet.png', fullPage:false })
console.log('tapped:', tapped)
await b.close()
