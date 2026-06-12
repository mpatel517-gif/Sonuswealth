// Stage 1 — T&E Tax sub-tab, mrt-core: SA card, sub-anchors, all 7 tax drawers.
const { launch, gotoScreen, mainText, clickByText, clickTile } = require('./helper.cjs');
const fs = require('fs');

(async () => {
  const out = {};
  const { browser, ctx, page, consoleErrors } = await launch();
  await gotoScreen(page, ctx, { demo: 'mrt-core', tab: 'tax', subTab: 'tax' });

  out.taxBody = await mainText(page);

  // Open each tax drawer by tile title, scrape, close.
  const drawers = [
    ['Income & tax this year', 'income'],
    ['Allowances — what', 'allowances'],
    ['Pension relief & drawdown', 'pension'],
    ['Dividends & savings', 'dividends'],
    ['Capital gains', 'cgt'],
    ['Self-assessment & residency', 'selfassessment'],
    ['Other taxes in your situation', 'situational'],
  ];
  out.drawers = {};
  for (const [title, key] of drawers) {
    const clicked = await clickTile(page, title);
    if (!clicked) { out.drawers[key] = 'TILE NOT FOUND'; continue; }
    await page.waitForTimeout(700);
    out.drawers[key] = await mainText(page);
    // close drawer
    const closed = await clickByText(page, '✕') || await clickByText(page, 'Close') || await clickByText(page, '←');
    await page.waitForTimeout(500);
    if (!closed) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    // verify back on grid
    const t = await mainText(page);
    if (!t.includes('Or tap a card below')) {
      out.drawers[key + '_CLOSE_FAIL'] = t.slice(0, 200);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
    }
  }

  // PriorYearSAForm — open the add-prior-year form.
  await clickByText(page, 'Add last year') || await clickByText(page, 'Add another year');
  await page.waitForTimeout(600);
  out.priorYearForm = await mainText(page);
  out.priorYearInputs = await page.evaluate(() => [...document.querySelectorAll('main input, main select')].map(i => ({ tag: i.tagName, type: i.type, label: i.getAttribute('aria-label') || i.name || i.placeholder || '' })));

  out.consoleErrors = consoleErrors;
  fs.writeFileSync(__dirname + '/s1-tax.json', JSON.stringify(out, null, 1));
  console.log('done. errors:', consoleErrors.length);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
