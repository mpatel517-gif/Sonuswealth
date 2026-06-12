// W1-C audit helper — Playwright driver against localhost:5182 (audit server).
const { chromium } = require('playwright');

const BASE = 'http://localhost:5182';

async function launch(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 800 },
    colorScheme: opts.scheme || 'dark',
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${String(e).slice(0, 300)}`));
  return { browser, ctx, page, consoleErrors };
}

async function gotoScreen(page, ctx, { demo, tab, subTab }) {
  if (subTab) {
    await ctx.addInitScript((st) => {
      try { localStorage.setItem('sonuswealth.te.subTab', st); } catch {}
    }, subTab);
  }
  await page.goto(`${BASE}/?demo=${demo}&tab=${tab}`, { waitUntil: 'networkidle' });
  if (subTab) {
    // addInitScript only applies to future navigations on existing pages in some cases;
    // belt-and-braces: set + reload if mismatch.
    const cur = await page.evaluate(() => localStorage.getItem('sonuswealth.te.subTab'));
    if (cur !== subTab) {
      await page.evaluate((st) => localStorage.setItem('sonuswealth.te.subTab', st), subTab);
      await page.reload({ waitUntil: 'networkidle' });
    }
  }
  await page.waitForTimeout(900);
}

async function mainText(page) {
  return page.evaluate(() => {
    const m = document.querySelector('main') || document.body;
    return m.innerText;
  });
}

// Click first element (button/clickable) whose innerText contains `needle`.
async function clickByText(page, needle, scope = 'main') {
  return page.evaluate(({ needle, scope }) => {
    const root = document.querySelector(scope) || document.body;
    const els = [...root.querySelectorAll('button, [role=button], a, [onclick], div[style*=cursor], span[style*=cursor]')];
    const norm = (s) => (s || '').replace(/\s+/g, ' ').toLowerCase();
    // Prefer the SMALLEST matching element (innermost) so segment labels inside
    // other tiles don't steal the click; then prefer ones whose text STARTS with needle.
    const matches = els.filter((e) => norm(e.innerText).includes(norm(needle)));
    matches.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    const starts = matches.find((e) => norm(e.innerText).startsWith(norm(needle)));
    const el = starts || matches[0];
    if (!el) return false;
    el.click();
    return true;
  }, { needle, scope });
}

// Click tile by its TITLE text (CatTile title row), avoiding chart-label collisions.
async function clickTile(page, title) {
  return page.evaluate((title) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').toLowerCase();
    const els = [...document.querySelectorAll('main button, main [role=button], main div[style*=cursor]')];
    const matches = els.filter((e) => {
      const t = norm(e.innerText);
      return t.startsWith(norm(title)) || t.includes(norm(title));
    });
    matches.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    // pick the smallest element that contains the title at the START of its text
    const el = matches.find((e) => norm(e.innerText).startsWith(norm(title))) || matches[0];
    if (!el) return false;
    el.click();
    return true;
  }, title);
}

module.exports = { launch, gotoScreen, mainText, clickByText, clickTile, BASE };
